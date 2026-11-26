import { expect, type Page, type Route } from '@playwright/test';
import { appReady } from './helpers/app-ready';
import { installCalendarsMock } from './calendars-mocks';
import { url as appUrl } from './generator-mocks';

// DST-TIMELINE-2540: the API-mode answers of the DST-day specs (evidence + pixel): one room, open all day, the given entries (fake data).

export const P = 'sw-app calendars-page cal-view-rooms';
export const R = 'sw-app calendars-page cal-resident';
const json = (r: Route, body: unknown) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

// the DST days (2026 and 2027): spring = 02:00 -> 03:00 (23 hours), autumn = 02:00 -> 01:00 (25 hours)
export const DAYS = [
  { date: '2026-03-27', kind: 'spring' }, { date: '2026-10-25', kind: 'autumn' }, { date: '2027-03-26', kind: 'spring' }, { date: '2027-10-31', kind: 'autumn' },
] as const;

/** A local clock time of `date` in the installation's zone (the Node side is pinned to it by playwright.config.ts, as the browser is),
 * `plusMin` later; a repeated clock time is its first pass. */
export const localIso = (date: string, h: number, m = 0, plusMin = 0) => {
  const [y, mo, da] = date.split('-').map(Number);
  return new Date(new Date(y, mo - 1, da, h, m).getTime() + plusMin * 60000).toISOString();
};

export type Entry = { id: string; start: string; end: string; title?: string };
export async function mockRooms(page: Page, o: { manage?: boolean; timeline?: boolean; entries: (date: string) => Entry[] }) {
  await installCalendarsMock(page, o.manage ? { can: { manage: true } } : {});
  await page.route('**/api/v1/calendar/module', (r) => json(r, { enabled: true, menu_position: 'rail', can: { view: true, book: true, book_for_others: false, manage: !!o.manage, maintenance: false, guests: false, configure: false, connect: false },
    ...(o.timeline ? { ui: { phone_time_picker: 'timeline' } } : {}) }));
  await page.route('**/api/v1/me/calendar**', (r) => json(r, { occurrences: [] }));
  await page.route('**/api/v1/calendar/rooms/day**', async (r) => {
    const date = new URL(r.request().url()).searchParams.get('date') as string;
    const entries = o.entries(date).map((e) => ({ occurrence_id: e.id, event_id: e.id, calendar_id: 'a', room_calendar_ids: ['a'], start: e.start, end: e.end, all_day: false,
      title: e.title ?? 'ישיבה', state: 'confirmed', kind: 'booking', organizer: { id: 'p', name: 'נועה' }, on_behalf_label: null, recurring: false, revision: 1 }));
    return json(r, { rooms: [{ calendar_id: 'a', name: 'חדר ישיבות אלון', capacity: 8, equipment: [], open: [{ from: '00:00', to: '24:00' }], entries }] });
  });
}

export async function open(page: Page, hash: string, clock: string, scheme: 'light' | 'dark' = 'light') {
  await page.clock.setFixedTime(new Date(clock));
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: scheme });
  await page.goto('about:blank');
  await page.goto(appUrl(hash, 'classic', scheme));
  await appReady(page);
}

export async function openResidentBar(page: Page, date: string, kind: 'spring' | 'autumn', entries: (date: string) => Entry[], scheme: 'light' | 'dark' = 'light') {
  await mockRooms(page, { timeline: true, entries });
  // the clock: noon of the day before, so the DST day is "tomorrow" (day 1 of the strip); the bar opens at 08:00 and moves back to 00:00
  const prev = new Date(`${date}T12:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  await open(page, '/calendars/cal', `${prev.toISOString().slice(0, 10)}T12:00:00${kind === 'spring' ? '+02:00' : '+03:00'}`, scheme);
  await page.locator(`${R} [data-res-day="1"]`).click();
  await page.locator(`${R} [data-res-room="a"]`).click();
  await expect(page.locator(`${R} [data-res-timeline]`)).toBeVisible();
  const earlier = page.locator(`${R} [data-res-timeline]`).getByRole('button', { name: 'מוקדם יותר' });
  for (let i = 0; i < 3; i += 1) await earlier.click();
  await expect(earlier).toBeDisabled(); // the window starts at 00:00
}

