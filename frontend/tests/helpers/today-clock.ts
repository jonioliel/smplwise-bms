import type { Page } from '@playwright/test';

/**
 * TEST-STABLE-2442: one "now" for a mocked page and its mock data - noon of the installation's current day.
 *
 * A mock that stamps "today's" rows relative to the real clock (`Date.now() + 30 minutes`) is right only while that offset stays inside
 * the day: the home calendar's "today" event started 30 minutes from now, so every run after 23:30 put it on tomorrow and the specs
 * that wait for it failed (seen 16.11 23:45); stamps "a few minutes ago" fall on yesterday right after midnight in the same way.
 * `pinToday(page)` fixes the page's clock (`page.clock.setFixedTime`: Date is fixed, timers keep running) at 12:00 of the current day
 * and returns that instant; the mock builds its stamps on it. Offsets between -12 h and +12 h are then inside "today" at any hour of
 * the run. The Node side runs in the installation's zone (playwright.config.ts sets TZ), the same as the browser's `timezoneId`.
 *
 * SW_FAKE_SYSTEM_TIME (an ISO time, e.g. 2026-11-16T23:50:00+02:00) stands in for the real clock, to prove that a run does not depend
 * on its hour.
 */
export function systemNow(): number {
  const fake = process.env.SW_FAKE_SYSTEM_TIME;
  if (!fake) return Date.now();
  const t = Date.parse(fake);
  if (Number.isNaN(t)) throw new Error(`SW_FAKE_SYSTEM_TIME is not a time: ${fake}`);
  return t;
}

/** 12:00 of the current day (the installation's zone). */
export function todayNoon(): number {
  const d = new Date(systemNow());
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

const pinned = new WeakMap<Page, number>();

/** Fix the page's clock at noon of the current day; returns the instant. A second call on the same page returns the same instant. */
export async function pinToday(page: Page): Promise<number> {
  const had = pinned.get(page);
  if (had !== undefined) return had;
  const now = todayNoon();
  await page.clock.setFixedTime(now);
  pinned.set(page, now);
  return now;
}

/** The instant `pinToday` fixed on this page (throws when the page was never pinned, so a spec cannot mix two clocks by mistake). */
export function pinnedNow(page: Page): number {
  const now = pinned.get(page);
  if (now === undefined) throw new Error('pinnedNow: the page has no pinned clock (call pinToday or a mock that pins it first)');
  return now;
}
