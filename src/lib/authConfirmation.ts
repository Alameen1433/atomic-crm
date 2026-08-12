const SUPPORTED_AUTH_TYPES = new Set(["invite", "recovery"]);
const SUPPORTED_CALLBACK_PATHS = new Set([
  "/auth-callback",
  "/auth-callback.html",
]);

type AuthConfirmationInput = {
  tokenHash: string | null;
  type: string | null;
  redirectTo: string | null;
  siteOrigin: string;
  supabaseUrl: string;
};

export function buildAuthVerificationUrl({
  tokenHash,
  type,
  redirectTo,
  siteOrigin,
  supabaseUrl,
}: AuthConfirmationInput) {
  if (!tokenHash || !type || !redirectTo || !SUPPORTED_AUTH_TYPES.has(type)) {
    return null;
  }

  try {
    const callbackUrl = new URL(redirectTo);
    if (
      callbackUrl.origin !== siteOrigin ||
      !SUPPORTED_CALLBACK_PATHS.has(callbackUrl.pathname)
    ) {
      return null;
    }

    const verificationUrl = new URL("auth/v1/verify", `${supabaseUrl}/`);
    verificationUrl.searchParams.set("token", tokenHash);
    verificationUrl.searchParams.set("type", type);
    verificationUrl.searchParams.set("redirect_to", callbackUrl.toString());
    return verificationUrl.toString();
  } catch {
    return null;
  }
}
