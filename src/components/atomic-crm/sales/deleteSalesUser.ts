import type { Identifier } from "ra-core";

export function canDeleteSalesUser(
  administrator: boolean,
  actorId: Identifier | undefined,
  sourceId: Identifier | undefined,
) {
  return (
    administrator && actorId != null && sourceId != null && actorId !== sourceId
  );
}

export function matchesDeletionEmail(value: string, expected: string) {
  return value.trim().toLowerCase() === expected.trim().toLowerCase();
}

export function totalTransferredRecords(counts: Record<string, number>) {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}
