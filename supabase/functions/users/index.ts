import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { getAuthCallbackUrl } from "../_shared/authRedirect.ts";

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

async function createSale(
  user_id: string,
  data: {
    email: string;
    first_name: string;
    last_name: string;
    disabled: boolean;
    administrator: boolean;
    new_client_commission_rate: number;
    recurring_client_commission_rate: number;
  },
) {
  const { data: sales, error: salesError } = await supabaseAdmin
    .from("sales")
    .insert({ ...data, user_id })
    .select("*");

  if (!sales?.length || salesError) {
    console.error("Error creating user:", salesError);
    throw salesError ?? new Error("Failed to create sale");
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
    password,
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

  const { data, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { first_name, last_name },
  });

  let user = data?.user;

  if (!user && userError?.code === "email_exists") {
    // This may happen if users cleared their database but not the users
    // We have to create the sale directly
    const { data, error } = await supabaseAdmin.rpc("get_user_id_by_email", {
      email,
    });

    if (!data || error) {
      console.error(
        `Error inviting user: error=${error ?? "could not fetch users for email"}`,
      );
      return createErrorResponse(500, "Internal Server Error");
    }

    user = data[0];
    try {
      const { data: existingSale, error: salesError } = await supabaseAdmin
        .from("sales")
        .select("*")
        .eq("user_id", user.id);
      if (salesError) {
        return createErrorResponse(salesError.status, salesError.message, {
          code: salesError.code,
        });
      }
      if (existingSale.length > 0) {
        return createErrorResponse(
          400,
          "A sales for this email already exists",
        );
      }

      const sale = await createSale(user.id, {
        email,
        first_name,
        last_name,
        disabled,
        administrator,
        new_client_commission_rate,
        recurring_client_commission_rate,
      });

      return new Response(
        JSON.stringify({
          data: sale,
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    } catch (error) {
      return createErrorResponse(
        (error as any).status ?? 500,
        (error as Error).message,
        {
          code: (error as any).code,
        },
      );
    }
  } else {
    if (userError) {
      console.error(`Error inviting user: user_error=${userError}`);
      return createErrorResponse(userError.status, userError.message, {
        code: userError.code,
      });
    }
    if (!data?.user) {
      console.error("Error inviting user: undefined user");
      return createErrorResponse(500, "Internal Server Error");
    }
    let redirectTo: string;
    try {
      redirectTo = getAuthCallbackUrl();
    } catch (error) {
      console.error("Cannot send invitation:", error);
      return createErrorResponse(500, "Invitation redirect is not configured");
    }

    const { error: emailError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo });

    if (emailError) {
      console.error(`Error inviting user, email_error=${emailError}`);
      return createErrorResponse(500, "Failed to send invitation mail");
    }
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

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
