import type { AuthProvider } from "ra-core";
import { supabaseAuthProvider } from "ra-supabase-core";

import { canAccess } from "../commons/canAccess";
import { getSupabaseClient } from "./supabase";

const getBaseAuthProvider = () =>
  supabaseAuthProvider(getSupabaseClient(), {
    getIdentity: async () => {
      const sale = await getSale();

      if (sale == null) {
        throw new Error();
      }

      return {
        id: sale.id,
        fullName: `${sale.first_name} ${sale.last_name}`,
        avatar: sale.avatar?.src,
        administrator: sale.administrator,
        new_client_commission_rate: sale.new_client_commission_rate,
        recurring_client_commission_rate: sale.recurring_client_commission_rate,
      };
    },
  });

// Initialization is stable and cached. The current sales record is refreshed
// so role and negotiated commission changes take effect without a new login.
const IS_INITIALIZED_CACHE_KEY = "RaStore.auth.is_initialized";
const CURRENT_SALE_CACHE_KEY = "RaStore.auth.current_sale";

function getLocalStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export async function getIsInitialized() {
  const storage = getLocalStorage();
  const cachedValue = storage?.getItem(IS_INITIALIZED_CACHE_KEY);
  if (cachedValue != null) {
    return cachedValue === "true";
  }

  const { data, error } = await getSupabaseClient()
    .from("init_state")
    .select("is_initialized");
  const isInitialized = resolveInitializationState(data, error);

  if (isInitialized) {
    storage?.setItem(IS_INITIALIZED_CACHE_KEY, "true");
  }

  return isInitialized;
}

export function resolveInitializationState(
  data: Array<{ is_initialized: number | string | null }> | null,
  error: unknown,
) {
  if (error) throw error;

  const initializedCount = data?.at(0)?.is_initialized;
  if (initializedCount == null) {
    throw new Error("Unable to verify whether the CRM is initialized");
  }

  return Number(initializedCount) > 0;
}

export function resolveSupabaseResult<T>(data: T, error: unknown) {
  if (error) throw error;
  return data ?? undefined;
}

const getSale = async () => {
  const storage = getLocalStorage();
  const { data: sessionResult, error: sessionError } =
    await getSupabaseClient().auth.getSession();
  const dataSession = resolveSupabaseResult(sessionResult, sessionError);

  // Shouldn't happen after login but just in case
  if (dataSession?.session?.user == null) {
    return undefined;
  }

  const { data: saleResult, error: saleError } = await getSupabaseClient()
    .from("sales")
    .select(
      "id, first_name, last_name, avatar, administrator, disabled, new_client_commission_rate, recurring_client_commission_rate",
    )
    .match({ user_id: dataSession?.session?.user.id })
    .eq("disabled", false)
    .maybeSingle();
  const dataSale = resolveSupabaseResult(saleResult, saleError);

  // Shouldn't happen either as all users are sales but just in case
  if (dataSale == null) {
    return undefined;
  }

  storage?.setItem(CURRENT_SALE_CACHE_KEY, JSON.stringify(dataSale));
  return dataSale;
};

export function clearAuthCache() {
  const storage = getLocalStorage();
  storage?.removeItem(IS_INITIALIZED_CACHE_KEY);
  storage?.removeItem(CURRENT_SALE_CACHE_KEY);
  storage?.removeItem("REACT_QUERY_OFFLINE_CACHE");
}

export const getAuthProvider = (): AuthProvider => {
  const baseAuthProvider = getBaseAuthProvider();
  return {
    ...baseAuthProvider,
    login: async (params) => {
      if (params.ssoDomain) {
        const { error } = await getSupabaseClient().auth.signInWithSSO({
          domain: params.ssoDomain,
        });
        if (error) {
          throw error;
        }
        return;
      }
      return baseAuthProvider.login(params);
    },
    logout: async (params) => {
      clearAuthCache();
      return baseAuthProvider.logout(params);
    },
    checkAuth: async (params) => {
      // Users are on the set-password page, nothing to do
      if (
        window.location.pathname === "/set-password" ||
        window.location.hash.includes("#/set-password")
      ) {
        return;
      }
      // Users are on the forgot-password page, nothing to do
      if (
        window.location.pathname === "/forgot-password" ||
        window.location.hash.includes("#/forgot-password")
      ) {
        return;
      }
      // Users are on the sign-up page, nothing to do
      if (
        window.location.pathname === "/sign-up" ||
        window.location.hash.includes("#/sign-up")
      ) {
        return;
      }

      const isInitialized = await getIsInitialized();

      if (!isInitialized) {
        await getSupabaseClient().auth.signOut();
        throw {
          redirectTo: "/sign-up",
          message: false,
        };
      }

      await baseAuthProvider.checkAuth(params);
      const sale = await getSale();
      if (sale == null) {
        clearAuthCache();
        await getSupabaseClient().auth.signOut();
        throw {
          redirectTo: "/login",
          message: "This CRM account is disabled",
        };
      }
    },
    canAccess: async (params) => {
      const isInitialized = await getIsInitialized();
      if (!isInitialized) return false;

      // Get the current user
      const sale = await getSale();
      if (sale == null) return false;

      // Compute access rights from the sale role
      const role = sale.administrator ? "admin" : "user";
      return canAccess(role, params);
    },
    getAuthorizationDetails(authorizationId: string) {
      return getSupabaseClient().auth.oauth.getAuthorizationDetails(
        authorizationId,
      );
    },
    approveAuthorization(authorizationId: string) {
      return getSupabaseClient().auth.oauth.approveAuthorization(
        authorizationId,
      );
    },
    denyAuthorization(authorizationId: string) {
      return getSupabaseClient().auth.oauth.denyAuthorization(authorizationId);
    },
  };
};
