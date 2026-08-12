export function getAuthCallbackUrl() {
  const crmBaseUrl = Deno.env.get("CRM_BASE_URL");
  if (!crmBaseUrl) {
    throw new Error("CRM_BASE_URL is not configured");
  }

  const baseUrl = new URL(crmBaseUrl);
  const isLocal =
    baseUrl.hostname === "localhost" || baseUrl.hostname === "127.0.0.1";
  // Cloudflare Pages canonicalizes .html pages to extensionless URLs. Point
  // production Auth links at the canonical URL so the token fragment does not
  // have to survive an additional redirect. Vite serves the .html path locally.
  const callbackUrl = new URL(
    isLocal ? "/auth-callback.html" : "/auth-callback",
    baseUrl,
  );
  if (callbackUrl.protocol !== "https:" && !isLocal) {
    throw new Error("CRM_BASE_URL must use HTTPS outside local development");
  }

  return callbackUrl.toString();
}
