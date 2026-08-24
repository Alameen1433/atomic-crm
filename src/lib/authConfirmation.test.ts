import { describe, expect, it, vi } from "vitest";

import {
  getAuthConfirmationError,
  getLegacyAuthErrorMessage,
  parseAuthConfirmation,
  verifyAuthConfirmation,
} from "./authConfirmation";

describe("parseAuthConfirmation", () => {
  it.each(["invite", "recovery"])("accepts a valid %s token", (type) => {
    expect(
      parseAuthConfirmation({ tokenHash: " token-hash ", type }),
    ).toEqual({ tokenHash: "token-hash", type });
  });

  it.each([
    { tokenHash: null, type: "invite" },
    { tokenHash: "", type: "recovery" },
    { tokenHash: "token-hash", type: "signup" },
    { tokenHash: "token-hash", type: null },
  ])("rejects incomplete or unsupported parameters", (params) => {
    expect(parseAuthConfirmation(params)).toBeNull();
  });
});

describe("verifyAuthConfirmation", () => {
  it("verifies the token hash and requires an established session", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: {
        session: { user: { id: "user-1" } },
        user: { id: "user-1" },
      },
      error: null,
    });

    await expect(
      verifyAuthConfirmation(
        { auth: { verifyOtp } },
        { tokenHash: "token-hash", type: "invite" },
      ),
    ).resolves.toEqual({ userId: "user-1", type: "invite" });
    expect(verifyOtp).toHaveBeenCalledOnce();
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "token-hash",
      type: "invite",
    });
  });

  it("propagates Supabase verification errors", async () => {
    const authError = { code: "otp_expired", message: "expired" };
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { session: null, user: null },
      error: authError,
    });

    await expect(
      verifyAuthConfirmation(
        { auth: { verifyOtp } },
        { tokenHash: "expired-token", type: "recovery" },
      ),
    ).rejects.toBe(authError);
  });

  it("rejects a response that does not establish a session", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { session: null, user: { id: "user-1" } },
      error: null,
    });

    await expect(
      verifyAuthConfirmation(
        { auth: { verifyOtp } },
        { tokenHash: "token-hash", type: "invite" },
      ),
    ).rejects.toThrow("did not establish an authentication session");
  });
});

describe("auth confirmation errors", () => {
  it("makes consumed OTP errors terminal", () => {
    expect(getAuthConfirmationError({ code: "otp_expired" })).toMatchObject({
      retryable: false,
    });
  });

  it("keeps connection failures retryable", () => {
    expect(getAuthConfirmationError(new TypeError("Failed to fetch"))).toEqual({
      retryable: true,
      message:
        "We could not verify this link. Check your connection and try again.",
    });
  });

  it("explains legacy expired callbacks on the login page", () => {
    expect(getLegacyAuthErrorMessage("otp_expired")).toContain("expired");
  });
});
