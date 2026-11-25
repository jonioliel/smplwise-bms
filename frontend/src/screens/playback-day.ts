/**
 * SCREENS-FIX-B-2520 SCR-02: which local day recorded playback is on. A session is not clipped to the day (the server plays on past
 * midnight, and a late-evening seek may start in a next-day segment), so the screen's date follows the PLAYING POSITION in the
 * installation's zone - never "the day that was picked + the cursor". Pure (no DOM, no network): tests/unit-screens-fix-b-2520.spec.ts.
 */
import { dateInZone, instantInZone } from '../api/recordings';

/** The day to switch to when the position is on another local day than `current`, else null (no position, or the same day). */
export function dayToFollow(current: string, position: Date | null | undefined, timeZone: string): string | null {
  if (!position || !Number.isFinite(position.getTime())) return null;
  const day = dateInZone(position, timeZone);
  return day && day !== current ? day : null;
}

/** The instant the screen stands on: the playing position when there is one, else the picked day + the cursor minute. */
export function standingInstant(position: Date | null | undefined, date: string, cursor: number, timeZone: string): Date {
  return position && Number.isFinite(position.getTime()) ? position : instantInZone(date, cursor, timeZone);
}

/** The stamp's date: the local day of the instant the screen stands on (yesterday's date never carries today's time). */
export function stampDate(position: Date | null | undefined, date: string, cursor: number, timeZone: string): string {
  return dateInZone(standingInstant(position, date, cursor, timeZone), timeZone);
}
