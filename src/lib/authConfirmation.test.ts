import { describe, expect, it } from "vitest";

import { buildAuthVerificationUrl } from "./authConfirmation";

const validInput = {
  tokenHash: "invite-token",
  type: "invite",
  redirectTo: "https://crm.example.com/auth-callback",
  siteOrigin: "https://crm.example.com",
  supabaseUrl: "https://project.supabase.co",
};

describe("buildAuthVerificationUrl", () => {
  it("builds a Supabase verification URL for a valid invitation", () => {
    const result = buildAuthVerificationUrl(validInput);
    const url = new URL(result!);

    expect(url.origin).toBe("https://project.supabase.co");
    expect(url.pathname).toBe("/auth/v1/verify");
    expect(url.searchParams.get("token")).toBe("invite-token");
    expect(url.searchParams.get("type")).toBe("invite");
    expect(url.searchParams.get("redirect_to")).toBe(
      "https://crm.example.com/auth-callback",
    );
  });

  it("accepts recovery links and the local html callback", () => {
    expect(
      buildAuthVerificationUrl({
        ...validInput,
        type: "recovery",
        redirectTo: "http://localhost:5173/auth-callback.html",
        siteOrigin: "http://localhost:5173",
        supabaseUrl: "http://127.0.0.1:54321",
      }),
    ).toContain("http://127.0.0.1:54321/auth/v1/verify?");
  });

  it("rejects unsupported auth types", () => {
    expect(buildAuthVerificationUrl({ ...validInput, type: "signup" })).toBe(
      null,
    );
  });

  it("rejects callbacks to another origin", () => {
    expect(
      buildAuthVerificationUrl({
        ...validInput,
        redirectTo: "https://attacker.example/auth-callback",
      }),
    ).toBe(null);
  });

  it("rejects callbacks outside the token bridge", () => {
    expect(
      buildAuthVerificationUrl({
        ...validInput,
        redirectTo: "https://crm.example.com/login",
      }),
    ).toBe(null);
  });
});
