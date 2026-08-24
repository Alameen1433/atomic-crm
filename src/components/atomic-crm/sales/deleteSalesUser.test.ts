import { describe, expect, it } from "vitest";
import {
  assertGenericDeleteAllowed,
  canDeleteSalesUser,
  GENERIC_SALES_DELETE_ERROR,
  matchesDeletionEmail,
  totalTransferredRecords,
} from "./deleteSalesUser";

describe("assertGenericDeleteAllowed", () => {
  it("blocks generic sales deletion but allows other resources", () => {
    expect(() => assertGenericDeleteAllowed("sales")).toThrow(
      GENERIC_SALES_DELETE_ERROR,
    );
    expect(() => assertGenericDeleteAllowed("contacts")).not.toThrow();
  });
});

describe("canDeleteSalesUser", () => {
  it("only allows an administrator to delete another user", () => {
    expect(canDeleteSalesUser(true, 1, 2)).toBe(true);
    expect(canDeleteSalesUser(false, 1, 2)).toBe(false);
    expect(canDeleteSalesUser(true, 1, 1)).toBe(false);
  });
});

describe("matchesDeletionEmail", () => {
  it("matches exact email text case-insensitively", () => {
    expect(matchesDeletionEmail(" User@Example.com ", "user@example.com")).toBe(
      true,
    );
    expect(matchesDeletionEmail("other@example.com", "user@example.com")).toBe(
      false,
    );
  });
});

describe("totalTransferredRecords", () => {
  it("sums the transfer result", () => {
    expect(totalTransferredRecords({ contacts: 2, deals: 3 })).toBe(5);
  });
});
