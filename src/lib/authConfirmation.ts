export const AUTH_EMAIL_TYPES = ["invite", "recovery"] as const;

export type AuthEmailType = (typeof AUTH_EMAIL_TYPES)[number];

export type AuthConfirmation = {
  tokenHash: string;
  type: AuthEmailType;
};

type VerifyOtpClient = {
  auth: {
    verifyOtp: (params: {
      token_hash: string;
      type: AuthEmailType;
    }) => Promise<{
      data: {
        session: { user: { id: string } } | null;
        user: { id: string } | null;
      };
      error: { code?: string; message: string } | null;
    }>;
  };
};

export function parseAuthConfirmation({
  tokenHash,
  type,
}: {
  tokenHash: string | null;
  type: string | null;
}): AuthConfirmation | null {
  const normalizedTokenHash = tokenHash?.trim();
  if (
    !normalizedTokenHash ||
    !AUTH_EMAIL_TYPES.includes(type as AuthEmailType)
  ) {
    return null;
  }

  return {
    tokenHash: normalizedTokenHash,
    type: type as AuthEmailType,
  };
}

export async function verifyAuthConfirmation(
  client: VerifyOtpClient,
  confirmation: AuthConfirmation,
) {
  const { data, error } = await client.auth.verifyOtp({
    token_hash: confirmation.tokenHash,
    type: confirmation.type,
  });

  if (error) {
    throw error;
  }

  const userId = data.session?.user.id ?? data.user?.id;
  if (!data.session || !userId) {
    throw new Error("Supabase did not establish an authentication session");
  }

  return { userId, type: confirmation.type };
}

export function getAuthConfirmationError(error: unknown) {
  const authError = error as { code?: string; message?: string } | null;
  const code = authError?.code;

  if (code === "otp_expired" || code === "otp_disabled") {
    return {
      retryable: false,
      message:
        "This link has expired or has already been used. Request a fresh email and try again.",
    };
  }

  if (code === "validation_failed" || code === "bad_code_verifier") {
    return {
      retryable: false,
      message: "This link is invalid. Request a fresh email and try again.",
    };
  }

  return {
    retryable: true,
    message:
      "We could not verify this link. Check your connection and try again.",
  };
}

export function getLegacyAuthErrorMessage(code: string | null) {
  if (code === "otp_expired" || code === "otp_disabled") {
    return "This invitation or password-reset link has expired or has already been used. Request a fresh email.";
  }

  return "This authentication link could not be completed. Request a fresh email and try again.";
}
