import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";

const hasValidCommissionRates = (newRate: number, recurringRate: number) =>
  Number.isFinite(Number(newRate)) &&
  Number.isFinite(Number(recurringRate)) &&
  Number(newRate) >= 0 &&
  Number(newRate) <= 100 &&
  Number(recurringRate) >= 0 &&
  Number(recurringRate) <= 100;

/**
 * Updates whether a sale associated with a user is disabled.
 *
 * @param user_id - The user's identifier
 * @param disabled - Whether the sale should be disabled
 */
async function updateSaleDisabled(user_id: string, disabled: boolean) {
  return await supabaseAdmin
    .from("sales")
    .update({ disabled: disabled ?? false })
    .eq("user_id", user_id);
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

/**
 * Creates a sale record for a user.
 *
 * @param user_id - The associated authentication user ID
 * @param data - The sale's account, status, administrator, and commission-rate details
 * @returns The created sale record
 * @throws An error when the sale cannot be created
 */
async function createSale(
  user_id: string,
  data: {
    email: string;
    password: string;
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

/**
 * Updates the avatar associated with a sale user.
 *
 * @param user_id - The authenticated user's identifier
 * @param avatar - The avatar value to store
 * @returns The updated sale record
 */
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

/**
 * Invites a sales user or creates a missing sales record for an existing Auth user.
 *
 * @param req - The request containing the user's details and commission rates.
 * @param currentUserSale - The current user's sales record, used to verify administrator access.
 * @returns A response containing the created or updated sale, or an error response.
 */
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
        password,
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
    const { error: emailError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (emailError) {
      console.error(`Error inviting user, email_error=${emailError}`);
      return createErrorResponse(500, "Failed to send invitation mail");
    }
  }

  try {
    await updateSaleDisabled(user.id, disabled);
    const sale = await updateSaleAdministrator(user.id, administrator);
    await supabaseAdmin
      .from("sales")
      .update({ new_client_commission_rate, recurring_client_commission_rate })
      .eq("id", sale.id);

    return new Response(
      JSON.stringify({
        data: sale,
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

/**
 * Updates a sales user's profile and, for administrators, their account status and commission rates.
 *
 * @param req - The request containing the target sales user ID and fields to update.
 * @param currentUserSale - The authenticated user's sales record, used to determine authorization and record commission-rate changes.
 * @returns A response containing the updated sale record or an error response.
 */
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

  const { data, error: userError } =
    await supabaseAdmin.auth.admin.updateUserById(sale.user_id, {
      email,
      ban_duration: disabled ? "87600h" : "none",
      user_metadata: { first_name, last_name },
    });

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
      const { error: rateError } = await supabaseAdmin
        .from("sales")
        .update({
          new_client_commission_rate: nextNewClientCommissionRate,
          recurring_client_commission_rate: nextRecurringClientCommissionRate,
        })
        .eq("id", sale.id);
      if (rateError) throw rateError;
      const { error: historyError } = await supabaseAdmin
        .from("sales_commission_rate_history")
        .insert({
          sales_id: sale.id,
          actor_sales_id: currentUserSale.id,
          previous_new_rate: sale.new_client_commission_rate,
          new_new_rate: nextNewClientCommissionRate,
          previous_recurring_rate: sale.recurring_client_commission_rate,
          new_recurring_rate: nextRecurringClientCommissionRate,
        });
      if (historyError) throw historyError;
    }
    await updateSaleDisabled(data.user.id, disabled);
    const sale = await updateSaleAdministrator(data.user.id, administrator);
    return new Response(
      JSON.stringify({
        data: sale,
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
