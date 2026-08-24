import { getSupabaseClient } from "./components/atomic-crm/providers/supabase/supabase";
import {
  getAuthConfirmationError,
  parseAuthConfirmation,
  verifyAuthConfirmation,
} from "./lib/authConfirmation";
import {
  createPasswordFlowMarker,
  savePasswordFlowMarker,
} from "./lib/passwordFlow";

const params = new URLSearchParams(window.location.search);
const confirmation = parseAuthConfirmation({
  tokenHash: params.get("token_hash"),
  type: params.get("type"),
});

const title = document.querySelector<HTMLElement>("[data-confirm-title]");
const description = document.querySelector<HTMLElement>(
  "[data-confirm-description]",
);
const button = document.querySelector<HTMLButtonElement>(
  "[data-confirm-button]",
);
const error = document.querySelector<HTMLElement>("[data-confirm-error]");
const recoveryLink = document.querySelector<HTMLAnchorElement>(
  "[data-confirm-recovery-link]",
);

const showError = (message: string, showRecoveryLink: boolean) => {
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
  if (recoveryLink) {
    recoveryLink.hidden = !showRecoveryLink;
  }
};

if (confirmation && title && description && button) {
  const isRecovery = confirmation.type === "recovery";
  title.textContent = isRecovery ? "Reset your password" : "Accept invitation";
  description.textContent = isRecovery
    ? "Continue to securely choose a new password for your Xenora CRM account."
    : "Continue to securely activate your Xenora CRM account and choose your password.";
  button.textContent = isRecovery ? "Continue to reset password" : "Continue";
  button.hidden = false;

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Verifying…";
    if (error) error.hidden = true;
    if (recoveryLink) recoveryLink.hidden = true;

    try {
      const result = await verifyAuthConfirmation(
        getSupabaseClient(),
        confirmation,
      );
      savePasswordFlowMarker(
        window.sessionStorage,
        createPasswordFlowMarker(result),
      );
      window.history.replaceState(null, "", window.location.pathname);
      window.location.replace(`./#/set-password?flow=${result.type}`);
    } catch (verificationError) {
      const failure = getAuthConfirmationError(verificationError);
      showError(failure.message, isRecovery && !failure.retryable);
      button.disabled = !failure.retryable;
      button.textContent = failure.retryable
        ? "Try again"
        : isRecovery
          ? "Request a fresh link below"
          : "Ask your administrator for a fresh invitation";
    }
  });
} else {
  showError(
    "This link is incomplete or invalid. Request a fresh email and try again.",
    false,
  );
}
