/**
 * Helpers for HTML date inputs (`<input type="date">`) that manipulate
 * calendar dates without time-of-day, avoiding UTC off-by-one errors.
 */

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Formats a date as a `YYYY-MM-DD` string in the local calendar, suitable for
 * the value of an `<input type="date">`. Unlike `date.toISOString().slice(0, 10)`,
 * this never shifts the day across timezones.
 */
export function toInputDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Returns the current local calendar date as a `YYYY-MM-DD` string.
 */
export function getTodayInputDateString(): string {
  return toInputDateString(new Date());
}

/**
 * Parses a `YYYY-MM-DD` date-only string at local midnight. Unlike
 * `new Date(value)`, which interprets date-only strings as UTC midnight, the
 * resulting Date keeps the intended calendar day in every timezone.
 */
export function parseInputDateAtLocalMidnight(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
