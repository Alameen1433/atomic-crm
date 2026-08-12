import { buildAuthVerificationUrl } from "./lib/authConfirmation";

const params = new URLSearchParams(window.location.search);
const type = params.get("type");
const verificationUrl = buildAuthVerificationUrl({
  tokenHash: params.get("token_hash"),
  type,
  redirectTo: params.get("redirect_to"),
  siteOrigin: window.location.origin,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
});

const title = document.querySelector<HTMLElement>("[data-confirm-title]");
const description = document.querySelector<HTMLElement>(
  "[data-confirm-description]",
);
const button = document.querySelector<HTMLAnchorElement>(
  "[data-confirm-button]",
);
const error = document.querySelector<HTMLElement>("[data-confirm-error]");

if (verificationUrl && title && description && button) {
  const isRecovery = type === "recovery";
  title.textContent = isRecovery ? "Reset your password" : "Accept invitation";
  description.textContent = isRecovery
    ? "Continue to securely choose a new password for your Xenora CRM account."
    : "Continue to securely activate your Xenora CRM account and choose your password.";
  button.textContent = isRecovery ? "Continue to reset password" : "Continue";
  button.href = verificationUrl;
  button.hidden = false;
} else if (error) {
  error.hidden = false;
}
