import { describe, expect, it } from "vitest";

import { canResetPassword } from "./canResetPassword";

describe("canResetPassword", () => {
  it("allows an administrator to reset another user's password", () => {
    expect(canResetPassword({ id: 1, administrator: true }, 2)).toBe(true);
  });

  it("allows a user to request their own password reset", () => {
    expect(canResetPassword({ id: 2, administrator: false }, 2)).toBe(true);
  });

  it("prevents a non-admin from resetting another user", () => {
    expect(canResetPassword({ id: 2, administrator: false }, 3)).toBe(false);
  });
});
