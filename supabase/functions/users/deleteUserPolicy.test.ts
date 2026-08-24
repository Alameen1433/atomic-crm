import { describe, expect, it } from "vitest";
import {
  formatDeleteUserResult,
  parseDeleteUserRequest,
} from "./deleteUserPolicy";

describe("parseDeleteUserRequest", () => {
  it("normalizes a valid request", () => {
    expect(
      parseDeleteUserRequest({
        sales_id: "7",
        replacement_sales_id: 9,
        confirmation_email: "  user@example.com ",
      }),
    ).toEqual({
      sales_id: 7,
      replacement_sales_id: 9,
      confirmation_email: "user@example.com",
    });
  });

  it.each([
    [{}, "A valid user is required"],
    [
      { sales_id: 1, replacement_sales_id: 1, confirmation_email: "a@b.com" },
      "Replacement user must be different",
    ],
    [
      { sales_id: 1, replacement_sales_id: 2, confirmation_email: "" },
      "Enter the user's email to confirm deletion",
    ],
  ])("rejects invalid input", (input, message) => {
    expect(() => parseDeleteUserRequest(input)).toThrow(message);
  });
});

describe("formatDeleteUserResult", () => {
  it("returns the public camelCase contract", () => {
    expect(
      formatDeleteUserResult({
        event_id: 3,
        auth_user_id: "auth-id",
        source_sales_id: 4,
        replacement_sales_id: 5,
        transfer_counts: { contacts: 2, storage_objects: 1 },
        deletion_pending: true,
      }),
    ).toEqual({
      eventId: 3,
      sourceSalesId: 4,
      replacementSalesId: 5,
      transferCounts: { contacts: 2, storage_objects: 1 },
      storageObjectsTransferred: 1,
    });
  });
});
