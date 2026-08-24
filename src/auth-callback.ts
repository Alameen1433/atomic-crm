import { getSupabaseClient } from "./components/atomic-crm/providers/supabase/supabase";
import { AUTH_EMAIL_TYPES, type AuthEmailType } from "./lib/authConfirmation";
import {
  createPasswordFlowMarker,
  savePasswordFlowMarker,
} from "./lib/passwordFlow";

const authParams = new URLSearchParams(window.location.hash.substring(1));
const accessToken = authParams.get("access_token");
const refreshToken = authParams.get("refresh_token");
const type = authParams.get("type") as AuthEmailType | null;
const errorCode = authParams.get("error_code");

const redirectToLogin = (code: string) => {
  window.history.replaceState(null, "", window.location.pathname);
  window.location.replace(`./#/login?auth_error=${encodeURIComponent(code)}`);
};

const completeLegacyCallback = async () => {
  if (errorCode) {
    redirectToLogin(errorCode);
    return;
  }

  if (
    !accessToken ||
    !refreshToken ||
    !type ||
    !AUTH_EMAIL_TYPES.includes(type)
  ) {
    redirectToLogin("invalid_callback");
    return;
  }

  const { data, error } = await getSupabaseClient().auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.session?.user.id) {
    redirectToLogin(error?.code ?? "invalid_callback");
    return;
  }

  savePasswordFlowMarker(
    window.sessionStorage,
    createPasswordFlowMarker({ type, userId: data.session.user.id }),
  );
  window.history.replaceState(null, "", window.location.pathname);
  window.location.replace(`./#/set-password?flow=${type}`);
};

void completeLegacyCallback();
