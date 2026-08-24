import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import {
  formatDeleteUserResult,
  parseDeleteUserRequest,
  type PreparedUserDeletion,
} from "./deleteUserPolicy.ts";

const hasValidCommissionRates = (newRate: unknown, recurringRate: unknown) =>
  typeof newRate === "number" &&
  typeof recurringRate === "number" &&
  Number.isFinite(newRate) &&
  Number.isFinite(recurringRate) &&
  newRate >= 0 &&
  newRate <= 100 &&
  recurringRate >= 0 &&
  recurringRate <= 100;

async function updateSaleDisabled(user_id: string, disabled: boolean) {
  const { data: sales, error } = await supabaseAdmin
    .from("sales")
    .update({ disabled: disabled ?? false })
    .eq("user_id", user_id)
    .select("id");

  if (!sales?.length || error) {
    console.error("Error updating disabled status:", error);
    throw error ?? new Error("Failed to update disabled status");
  }
  return sales.at(0);
}

async function updateSaleAdministrator(
  user_id: string,
  administrator: boolean,
) {
  const { data: sales, error: salesError } = await supabaseAdmin
    .from("sales")
    .update({ administrator })
    .eq("user_id", user_id)
    .select("*");

  if (!sales?.length || salesError) {
    console.error("Error updating user:", salesError);
    throw salesError ?? new Error("Failed to update sale");
  }
  return sales.at(0);
}

async function updateSaleAvatar(user_id: string, avatar: string) {
  const { data: sales, error: salesError } = await supabaseAdmin
    .from("sales")
    .update({ avatar })
    .eq("user_id", user_id)
    .select("*");

  if (!sales?.length || salesError) {
    console.error("Error updating user:", salesError);
    throw salesError ?? new Error("Failed to update sale");
  }
  return sales.at(0);
}

async function inviteUser(req: Request, currentUserSale: any) {
  const {
    email,
    first_name,
    last_name,
    disabled,
    administrator,
    new_client_commission_rate = 20,
    recurring_client_commission_rate = 15,
  } = await req.json();

  if (!currentUserSale.administrator) {
    return createErrorResponse(401, "Not Authorized");
  }
  if (
    !hasValidCommissionRates(
      new_client_commission_rate,
      recurring_client_commission_rate,
    )
  ) {
    return createErrorResponse(
      400,
      "Commission rates must be between 0 and 100",
    );
  }

  // inviteUserByEmail creates the unconfirmed Auth user and sends an invite
  // whose callback type is `invite`. Creating a password user first turns this
  // into an existing-user flow and bypasses the CRM's set-password route.
  const { data, error: userError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { first_name, last_name },
    });

  const user = data?.user;
  if (userError) {
    console.error(`Error inviting user: user_error=${userError}`);
    return createErrorResponse(userError.status ?? 400, userError.message, {
      code: userError.code,
    });
  }
  if (!user) {
    console.error("Error inviting user: undefined user");
    return createErrorResponse(500, "Internal Server Error");
  }

  try {
    await updateSaleDisabled(user.id, disabled);
    const sale = await updateSaleAdministrator(user.id, administrator);
    const { data: updatedSale, error: rateUpdateError } = await supabaseAdmin
      .from("sales")
      .update({ new_client_commission_rate, recurring_client_commission_rate })
      .eq("id", sale.id)
      .select("*")
      .single();
    if (rateUpdateError || !updatedSale) {
      throw rateUpdateError ?? new Error("Failed to update commission rates");
    }

    return new Response(
      JSON.stringify({
        data: updatedSale,
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (e) {
    console.error("Error patching sale:", e);
    return createErrorResponse(500, "Internal Server Error");
  }
}

async function patchUser(req: Request, currentUserSale: any) {
  const {
    sales_id,
    email,
    first_name,
    last_name,
    avatar,
    administrator,
    disabled,
    new_client_commission_rate,
    recurring_client_commission_rate,
  } = await req.json();
  const { data: sale } = await supabaseAdmin
    .from("sales")
    .select("*")
    .eq("id", sales_id)
    .single();

  if (!sale) {
    return createErrorResponse(404, "Not Found");
  }

  // Users can only update their own profile unless they are an administrator
  if (!currentUserSale.administrator && currentUserSale.id !== sale.id) {
    return createErrorResponse(401, "Not Authorized");
  }

  const nextNewClientCommissionRate =
    new_client_commission_rate ?? sale.new_client_commission_rate;
  const nextRecurringClientCommissionRate =
    recurring_client_commission_rate ?? sale.recurring_client_commission_rate;
  const nextDisabled = currentUserSale.administrator
    ? (disabled ?? sale.disabled)
    : sale.disabled;
  const nextAdministrator = currentUserSale.administrator
    ? (administrator ?? sale.administrator)
    : sale.administrator;

  if (
    currentUserSale.administrator &&
    !hasValidCommissionRates(
      nextNewClientCommissionRate,
      nextRecurringClientCommissionRate,
    )
  ) {
    return createErrorResponse(
      400,
      "Commission rates must be between 0 and 100",
    );
  }

  const userAttributes = currentUserSale.administrator
    ? {
        email,
        ban_duration: nextDisabled ? "87600h" : "none",
        user_metadata: { first_name, last_name },
      }
    : {
        email,
        user_metadata: { first_name, last_name },
      };
  const { data, error: userError } =
    await supabaseAdmin.auth.admin.updateUserById(sale.user_id, userAttributes);

  if (!data?.user || userError) {
    console.error("Error patching user:", userError);
    return createErrorResponse(500, "Internal Server Error");
  }

  if (avatar) {
    await updateSaleAvatar(data.user.id, avatar);
  }

  // Only administrators can update the administrator and disabled status
  if (!currentUserSale.administrator) {
    const { data: new_sale } = await supabaseAdmin
      .from("sales")
      .select("*")
      .eq("id", sales_id)
      .single();
    return new Response(
      JSON.stringify({
        data: new_sale,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }

  try {
    const ratesChanged =
      Number(sale.new_client_commission_rate) !==
        Number(nextNewClientCommissionRate) ||
      Number(sale.recurring_client_commission_rate) !==
        Number(nextRecurringClientCommissionRate);
    if (ratesChanged) {
      // Atomic rate update + audit record: both changes happen in a single
      // transaction inside the RPC, so neither persists if the other fails.
      const { error: ratesError } = await supabaseAdmin.rpc(
        "update_sales_commission_rates",
        {
          p_sales_id: sale.id,
          p_actor_sales_id: currentUserSale.id,
          p_new_new_rate: nextNewClientCommissionRate,
          p_new_recurring_rate: nextRecurringClientCommissionRate,
        },
      );
      if (ratesError) throw ratesError;
    }
    await updateSaleDisabled(data.user.id, nextDisabled);
    const updatedSale = await updateSaleAdministrator(
      data.user.id,
      nextAdministrator,
    );
    return new Response(
      JSON.stringify({
        data: updatedSale,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (e) {
    console.error("Error patching sale:", e);
    return createErrorResponse(500, "Internal Server Error");
  }
}

async function deleteUser(req: Request, currentUserSale: any) {
  if (!currentUserSale.administrator) {
    return createErrorResponse(403, "Only administrators can delete users", {
      code: "ADMIN_REQUIRED",
      phase: "authorization",
      retryable: false,
    });
  }

  let requestBody;
  try {
    requestBody = parseDeleteUserRequest(await req.json());
  } catch (error) {
    return createErrorResponse(400, error?.message ?? "Invalid request", {
      code: "INVALID_DELETE_REQUEST",
      phase: "validation",
      retryable: false,
    });
  }

  if (Number(currentUserSale.id) === requestBody.sales_id) {
    return createErrorResponse(
      400,
      "Administrators cannot delete their own account",
      {
        code: "SELF_DELETE_FORBIDDEN",
        phase: "validation",
        retryable: false,
      },
    );
  }

  const { data: preparedData, error: prepareError } = await supabaseAdmin.rpc(
    "prepare_sales_user_deletion",
    {
      p_source_sales_id: requestBody.sales_id,
      p_replacement_sales_id: requestBody.replacement_sales_id,
      p_actor_sales_id: currentUserSale.id,
      p_confirmation_email: requestBody.confirmation_email,
    },
  );
  if (prepareError || !preparedData) {
    console.error("Error preparing user deletion:", prepareError);
    return createErrorResponse(
      400,
      prepareError?.message ?? "Failed to prepare user deletion",
      {
        code: "DELETE_PREPARATION_FAILED",
        phase: "transfer",
        retryable: false,
      },
    );
  }

  const prepared = preparedData as PreparedUserDeletion;

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
    prepared.auth_user_id,
  );
  if (deleteError) {
    console.error("Error deleting Auth user:", deleteError);
    return createErrorResponse(
      deleteError.status ?? 500,
      "User access was revoked and records were transferred, but Auth cleanup failed. Retry deletion.",
      {
        code: "AUTH_DELETE_FAILED",
        phase: "auth",
        retryable: true,
        deletionPending: true,
      },
    );
  }

  const { error: finalizeError } = await supabaseAdmin.rpc(
    "finalize_sales_user_deletion",
    { p_event_id: prepared.event_id },
  );
  if (finalizeError) {
    // Auth and CRM deletion already succeeded. Do not report a false failure to
    // the administrator for an audit-finalization issue.
    console.error("Error finalizing user deletion audit:", finalizeError);
  }

  return new Response(
    JSON.stringify({
      data: {
        ...formatDeleteUserResult(prepared),
        auditFinalized: !finalizeError,
      },
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        const currentUserSale = await getUserSale(user);
        if (!currentUserSale) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (req.method === "POST") {
          return inviteUser(req, currentUserSale);
        }

        if (req.method === "PATCH") {
          return patchUser(req, currentUserSale);
        }

        if (req.method === "DELETE") {
          return deleteUser(req, currentUserSale);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
