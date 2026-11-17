/**
 * CR-FORMAT-2440 (review finding 08:F10): calendar arithmetic on day keys (`YYYY-MM-DD`), once. Five modules carried their own copy of
 * "add N days" and three of "inclusive days between". A day key has no clock and no zone: everything here is plain UTC date
 * arithmetic, so a DST change never moves a day.
 * Pure; no DOM, no imports beyond `./pad`.
 */
import { dayKey } from './pad';

export const DAY_MS = 86_400_000;

/** The three numbers of a day key: `'2026-03-07'` -> `[2026, 3, 7]` (by position; no validation). */
export function dayKeyParts(key: string): [number, number, number] {
  return [Number(key.slice(0, 4)), Number(key.slice(5, 7)), Number(key.slice(8, 10))];
}

/** UTC midnight of a day key, in ms. An impossible day rolls over as `Date.UTC` does (`2026-02-30` is 2 March). */
export function dayKeyToUtc(key: string): number {
  const [y, m, d] = dayKeyParts(key);
  return Date.UTC(y, m - 1, d);
}

/** The day key of a UTC instant (the first ten characters of its ISO form). Throws `RangeError` for an invalid instant, as `toISOString` does. */
export const utcToDayKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** `key` moved by `n` calendar days: `addDays('2026-03-27', 1)` is `'2026-03-28'`. */
export const addDays = (key: string, n: number): string => utcToDayKey(dayKeyToUtc(key) + n * DAY_MS);

/**
 * The same sum, written from the calendar numbers (`${y}-${mm}-${dd}`) instead of the ISO string. Identical to `addDays` for every
 * day in the years 1000-9999; kept for the tickets calendar, whose keys were always built this way (a year outside that range is
 * written as a plain number here - "89-01-18" - and as `0089-01-18` / `+010009-...` by the ISO form).
 */
export function addDaysByParts(key: string, n: number): string {
  const [y, m, d] = dayKeyParts(key);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return dayKey(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/**
 * The same sum with the key read by the ISO parser (`${key}T00:00:00Z`) instead of by position. Identical to `addDays` for a
 * well-formed key; kept for the access events feed, where a malformed key must keep failing the way it did (`RangeError` from
 * `toISOString`) instead of being read by position.
 */
export const addDaysIso = (key: string, n: number): string => utcToDayKey(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS);

/** Whole days from `from` to `to` (0 for the same day, negative when `to` is earlier). */
export const daysDiff = (from: string, to: string): number => Math.round((dayKeyToUtc(to) - dayKeyToUtc(from)) / DAY_MS);

/** Inclusive number of calendar days of `from`..`to` (1 for the same day). */
export const daysInclusive = (from: string, to: string): number => daysDiff(from, to) + 1;
