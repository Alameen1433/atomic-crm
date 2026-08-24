import type { AuthEmailType } from "./authConfirmation";

export const PASSWORD_FLOW_STORAGE_KEY = "xenora.auth.password-flow";
export const PASSWORD_FLOW_TTL_MS = 30 * 60 * 1000;

export type PasswordFlowMarker = {
  type: AuthEmailType;
  userId: string;
  verifiedAt: number;
};

export function createPasswordFlowMarker({
  type,
  userId,
  verifiedAt = Date.now(),
}: {
  type: AuthEmailType;
  userId: string;
  verifiedAt?: number;
}): PasswordFlowMarker {
  return { type, userId, verifiedAt };
}

export function parsePasswordFlowMarker(
  rawMarker: string | null,
  currentUserId: string | null,
  now = Date.now(),
): PasswordFlowMarker | null {
  if (!rawMarker || !currentUserId) return null;

  try {
    const marker = JSON.parse(rawMarker) as Partial<PasswordFlowMarker>;
    const age = now - Number(marker.verifiedAt);
    if (
      (marker.type !== "invite" && marker.type !== "recovery") ||
      marker.userId !== currentUserId ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > PASSWORD_FLOW_TTL_MS
    ) {
      return null;
    }

    return marker as PasswordFlowMarker;
  } catch {
    return null;
  }
}

export function savePasswordFlowMarker(
  storage: Storage,
  marker: PasswordFlowMarker,
) {
  storage.setItem(PASSWORD_FLOW_STORAGE_KEY, JSON.stringify(marker));
}

export function clearPasswordFlowMarker(storage: Storage) {
  storage.removeItem(PASSWORD_FLOW_STORAGE_KEY);
}
