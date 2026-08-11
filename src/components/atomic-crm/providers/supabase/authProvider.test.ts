import {
  resolveInitializationState,
  resolveSupabaseResult,
} from "./authProvider";

describe("resolveInitializationState", () => {
  it("reports an initialized CRM when a user exists", () => {
    expect(resolveInitializationState([{ is_initialized: 1 }], null)).toBe(
      true,
    );
  });

  it("allows first-user setup only after confirming the CRM is empty", () => {
    expect(resolveInitializationState([{ is_initialized: 0 }], null)).toBe(
      false,
    );
  });

  it("does not treat a Supabase error as an empty CRM", () => {
    const error = new Error("Supabase is unreachable");

    expect(() => resolveInitializationState(null, error)).toThrow(error);
  });

  it("does not treat a missing response as an empty CRM", () => {
    expect(() => resolveInitializationState([], null)).toThrow(
      "Unable to verify whether the CRM is initialized",
    );
  });
});

describe("resolveSupabaseResult", () => {
  it("returns successful query data", () => {
    const sale = { id: 1, disabled: false };

    expect(resolveSupabaseResult(sale, null)).toBe(sale);
  });

  it("preserves an explicit missing record result", () => {
    expect(resolveSupabaseResult(null, null)).toBeUndefined();
  });

  it("propagates query errors instead of treating the account as disabled", () => {
    const error = new Error("Supabase is unreachable");

    expect(() => resolveSupabaseResult(null, error)).toThrow(error);
  });
});
