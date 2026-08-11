import { commands } from "vitest/browser";

import {
  getTodayInputDateString,
  parseInputDateAtLocalMidnight,
  toInputDateString,
} from "./localDate";

describe("toInputDateString", () => {
  it("formats a date as YYYY-MM-DD in the local calendar", () => {
    expect(toInputDateString(new Date(2026, 7, 11, 15, 30))).toBe("2026-08-11");
  });

  it("pads month and day", () => {
    expect(toInputDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("getTodayInputDateString", () => {
  let originalTimezone: string;

  beforeEach(() => {
    originalTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  afterEach(async () => {
    await commands.setTimezone(originalTimezone);
  });

  it("matches the local calendar date in every timezone", async () => {
    for (const timeZone of [
      "America/New_York",
      "Asia/Tokyo",
      "UTC",
      "Pacific/Auckland",
    ]) {
      await commands.setTimezone(timeZone);
      const now = new Date();
      expect(getTodayInputDateString()).toBe(toInputDateString(now));
    }
  });
});

describe("parseInputDateAtLocalMidnight", () => {
  let originalTimezone: string;

  beforeEach(() => {
    originalTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  afterEach(async () => {
    await commands.setTimezone(originalTimezone);
  });

  it("parses a date-only string at local midnight in every timezone", async () => {
    for (const timeZone of [
      "America/New_York",
      "Asia/Tokyo",
      "UTC",
      "Pacific/Auckland",
    ]) {
      await commands.setTimezone(timeZone);
      const parsed = parseInputDateAtLocalMidnight("2026-08-11");
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(7);
      expect(parsed.getDate()).toBe(11);
      expect(parsed.getHours()).toBe(0);
    }
  });
});
