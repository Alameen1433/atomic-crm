import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { canResetPassword } from "./canResetPassword.ts";

/**
 * Initiates a password reset email for the authenticated user or an authorized target user.
 *
 * @param req - Request containing an optional `sales_id` identifying the target user
 * @param user - Authenticated user whose permissions determine whether the reset is authorized
 * @returns A JSON response indicating success or an error response when authorization or lookup fails
 */
async function updatePassword(req: Request, user: any) {
  const currentSale = await getUserSale(user);
  if (!currentSale) {
    return createErrorResponse(403, "CRM user profile not found");
  }

  const { sales_id: targetSalesId = currentSale.id } = await req.json();
  if (!canResetPassword(currentSale, targetSalesId)) {
    return createErrorResponse(
      403,
      "Only administrators can reset another user's password",
    );
  }

  const { data: targetSale, error: targetError } = await supabaseAdmin
    .from("sales")
    .select("email")
    .eq("id", targetSalesId)
    .single();

  if (!targetSale || targetError) {
    return createErrorResponse(404, "User not found");
  }

  const { data, error } = await supabaseAdmin.auth.resetPasswordForEmail(
    targetSale.email,
  );

  if (!data || error) {
    return createErrorResponse(500, "Internal Server Error");
  }

  return new Response(
    JSON.stringify({
      data: true,
    }),
    {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        if (req.method === "PATCH") {
          return updatePassword(req, user);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
