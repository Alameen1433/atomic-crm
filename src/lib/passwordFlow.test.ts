import { describe, expect, it } from "vitest";

import {
  createPasswordFlowMarker,
  parsePasswordFlowMarker,
  PASSWORD_FLOW_TTL_MS,
} from "./passwordFlow";

describe("password flow markers", () => {
  const now = 2_000_000;

  it("accepts a fresh marker for the authenticated user", () => {
    const marker = createPasswordFlowMarker({
      type: "recovery",
      userId: "user-1",
      verifiedAt: now - 1_000,
    });

    expect(
      parsePasswordFlowMarker(JSON.stringify(marker), "user-1", now),
    ).toEqual(marker);
  });

  it("rejects a marker for another authenticated user", () => {
    const marker = createPasswordFlowMarker({
      type: "invite",
      userId: "user-1",
      verifiedAt: now,
    });

    expect(
      parsePasswordFlowMarker(JSON.stringify(marker), "user-2", now),
    ).toBeNull();
  });

  it("rejects expired and future markers", () => {
    const expired = createPasswordFlowMarker({
      type: "recovery",
      userId: "user-1",
      verifiedAt: now - PASSWORD_FLOW_TTL_MS - 1,
    });
    const future = createPasswordFlowMarker({
      type: "recovery",
      userId: "user-1",
      verifiedAt: now + 1,
    });

    expect(
      parsePasswordFlowMarker(JSON.stringify(expired), "user-1", now),
    ).toBeNull();
    expect(
      parsePasswordFlowMarker(JSON.stringify(future), "user-1", now),
    ).toBeNull();
  });

  it.each([null, "not-json", '{"type":"signup"}'])(
    "rejects malformed marker %s",
    (rawMarker) => {
      expect(parsePasswordFlowMarker(rawMarker, "user-1", now)).toBeNull();
    },
  );
});
