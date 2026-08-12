const AUTH_CALLBACK_PATH = "/auth-callback.html";

export function getAuthCallbackUrl() {
  const crmBaseUrl = Deno.env.get("CRM_BASE_URL");
  if (!crmBaseUrl) {
    throw new Error("CRM_BASE_URL is not configured");
  }

  const callbackUrl = new URL(AUTH_CALLBACK_PATH, crmBaseUrl);
  if (
    callbackUrl.protocol !== "https:" &&
    callbackUrl.hostname !== "localhost" &&
    callbackUrl.hostname !== "127.0.0.1"
  ) {
    throw new Error("CRM_BASE_URL must use HTTPS outside local development");
  }

  return callbackUrl.toString();
}
