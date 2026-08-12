import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { type User } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import { canResetPassword } from "./canResetPassword.ts";
import { getAuthCallbackUrl } from "../_shared/authRedirect.ts";

async function updatePassword(req: Request, user: User) {
  const currentSale = await getUserSale(user);
  if (!currentSale) {
    return createErrorResponse(403, "CRM user profile not found");
  }

  let body: { sales_id?: string | number };
  try {
    body = await req.json();
  } catch {
    return createErrorResponse(400, "Invalid request body");
  }
  const { sales_id: targetSalesId = currentSale.id } = body;
  if (!canResetPassword(currentSale, targetSalesId)) {
    return createErrorResponse(
      403,
      "Only administrators can reset another user's password",
    );
  }

  const { data: targetSale, error: targetError } = await supabaseAdmin
    .from("sales")
    .select("email, disabled")
    .eq("id", targetSalesId)
    .single();

  if (!targetSale || targetError) {
    return createErrorResponse(404, "User not found");
  }

  if (targetSale.disabled) {
    return createErrorResponse(
      409,
      "Enable the user before resetting their password",
    );
  }

  let redirectTo: string;
  try {
    redirectTo = getAuthCallbackUrl();
  } catch (error) {
    console.error("Cannot send password reset:", error);
    return createErrorResponse(
      500,
      "Password reset redirect is not configured",
    );
  }

  const { data, error } = await supabaseAdmin.auth.resetPasswordForEmail(
    targetSale.email,
    { redirectTo },
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
