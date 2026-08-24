export type DeleteUserRequest = {
  sales_id: number;
  replacement_sales_id: number;
  confirmation_email: string;
};

export type PreparedUserDeletion = {
  event_id: number;
  auth_user_id: string;
  source_sales_id: number;
  replacement_sales_id: number;
  transfer_counts: Record<string, number>;
  deletion_pending: boolean;
};

export function parseDeleteUserRequest(value: unknown): DeleteUserRequest {
  if (value == null || typeof value !== "object") {
    throw new Error("Invalid deletion request");
  }

  const input = value as Record<string, unknown>;
  const salesId = Number(input.sales_id);
  const replacementSalesId = Number(input.replacement_sales_id);
  const confirmationEmail = String(input.confirmation_email ?? "").trim();

  if (!Number.isSafeInteger(salesId) || salesId <= 0) {
    throw new Error("A valid user is required");
  }
  if (!Number.isSafeInteger(replacementSalesId) || replacementSalesId <= 0) {
    throw new Error("A valid replacement user is required");
  }
  if (salesId === replacementSalesId) {
    throw new Error("Replacement user must be different");
  }
  if (!confirmationEmail || !confirmationEmail.includes("@")) {
    throw new Error("Enter the user's email to confirm deletion");
  }

  return {
    sales_id: salesId,
    replacement_sales_id: replacementSalesId,
    confirmation_email: confirmationEmail,
  };
}

export function formatDeleteUserResult(prepared: PreparedUserDeletion) {
  return {
    eventId: prepared.event_id,
    sourceSalesId: prepared.source_sales_id,
    replacementSalesId: prepared.replacement_sales_id,
    transferCounts: prepared.transfer_counts ?? {},
    storageObjectsTransferred: prepared.transfer_counts?.storage_objects ?? 0,
  };
}
