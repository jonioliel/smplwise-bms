import { expect, type Page, type Route } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockP2 } from './home-v3-p2-mocks';
import { overview } from './home-simple-mocks';
import { installCalendarsMock } from './calendars-mocks';

// MULTI-BUILDING-FILTER-2520: the mock layer of the building filter in the home interface (notice board, shared rooms) and the resident's
// phone calendar - an invented site ("מגדל א", "מגדל ב", the shared "חניון משותף"; no real place, device or person). "before" = the answer of
// a site whose multi-building switch (or filter setting) is off - exactly the answer of the previous version, so nothing new is drawn;
// "after" = the same list with the server's `building_filter` (services/building_filter) and each item's `buildings`.

export const A = 'bA';
export const B = 'bB';
export const P = 'bP';
export const FILTER = { buildings: [{ id: A, name: 'מגדל א', is_shared: false }, { id: B, name: 'מגדל ב', is_shared: false }, { id: P, name: 'חניון משותף', is_shared: true }], building: null };
export const NOW = new Date('2026-11-25T12:00:00+02:00').getTime();
const BLD_OF: Record<string, string> = { g: A, f1: B, out: P };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
export const homeOf = (page: Page) => page.locator('sw-home');

const at = (minsFromNow: number) => new Date(NOW + minsFromNow * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Four notices: tower A's, both towers', tower B's, and one for everyone (no floor: every building). */
function notices(after: boolean) {
  const n = (id: string, title: string, body: string, minsAgo: number, read: boolean, buildings: string[], severity = 'info') => ({
    id, title, body, severity, pinned: severity !== 'info', read, starts_at: at(-minsAgo), ends_at: null, published_at: at(-minsAgo), when_text: null, ...(after ? { buildings } : {}),
  });
  return {
    notices: [
      n('n1', 'החלפת מעלית במגדל א', 'ביום שני תוחלף המעלית הצפונית במגדל א. המעלית הדרומית תפעל כרגיל.', 120, false, [A], 'important'),
      n('n2', 'ניקוי חלונות בשני המגדלים', 'ביום רביעי ינוקו החלונות החיצוניים של שני המגדלים.', 900, false, [A, B]),
      n('n3', 'צביעת הלובי במגדל ב', 'הלובי של מגדל ב ייצבע בסוף השבוע. הכניסה דרך החניון.', 1500, false, [B]),
      n('n4', 'מסיבת חנוכה לכל הדיירים', 'כולם מוזמנים לחגוג איתנו בגינה המשותפת.', 3000, true, []),
    ],
    ...(after ? { building_filter: FILTER } : {}),
  };
}

/** Three shared rooms: tower A's club, tower B's gym, and the shared building's roof (it serves every building). */
function rooms(after: boolean) {
  const r = (calendar_id: string, name: string, capacity: number, buildings: string[]) => ({
    calendar_id, name, capacity, equipment: [], open: [{ from: '08:00', to: '22:00' }], entries: [], ...(after ? { buildings } : {}),
  });
  return { rooms: [r('room-club', 'מועדון דיירים', 20, [A]), r('room-gym', 'חדר כושר', 10, [B]), r('room-roof', 'פינת מנגל בגג', 12, [A, B, P])], ...(after ? { building_filter: FILTER } : {}) };
}

/** The home overview of the site: the ground floor in tower A, the first floor in tower B, outside in the shared building (MB-HOME-2500). */
function multiOverview(entry: string | null) {
  const ov = overview('demo') as ReturnType<typeof overview> & Record<string, unknown>;
  for (const r of ov.rooms as { floor_id: string; building_id?: string | null }[]) r.building_id = BLD_OF[r.floor_id] ?? null;
  ov.buildings = FILTER.buildings;
  ov.area_buildings = Object.fromEntries((ov.rooms as { id: string; floor_id: string }[]).map((r) => [r.id, BLD_OF[r.floor_id]]));
  ov.building_all = false;
  ov.entry_building = entry;
  return ov;
}

export interface HomeOpen { after: boolean; scheme: 'light' | 'dark'; entry?: string | null; kiosk?: boolean }

/** The home interface at `route` (notices, calendar/book) on the multi-building site. */
export async function openHomeList(page: Page, route: string, o: HomeOpen): Promise<void> {
  await page.clock.setFixedTime(NOW);
  await mockP2(page, { now: NOW, kiosk: o.kiosk, features: { transit: { on: false } }, policy: o.kiosk ? { wall: { rest: false, night: false } } : {} });
  const ov = multiOverview(o.entry === undefined ? A : o.entry);
  await page.route('**/api/v1/home/overview', (r) => json(r, ov));
  await page.route('**/api/v1/notices', (r) => json(r, notices(o.after)));
  await page.route('**/api/v1/calendar/rooms/day?**', (r) => json(r, rooms(o.after)));
  const layout = { welcomed: true, theme: o.scheme === 'dark' ? 'midnight' : 'classic', scheme: o.scheme };
  await page.route('**/api/v1/home/prefs', (r) => (r.request().method() === 'GET' ? json(r, { favourites: {}, layout, seed: {} }) : r.fallback()));
  await page.goto('about:blank');
  await page.addInitScript(() => { try { localStorage.removeItem('sw.building_filter'); localStorage.removeItem('home.building'); } catch { /* */ } });
  await page.goto(`/#/home/${route}`);
  await homeOf(page).waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await expect(homeOf(page)).toHaveAttribute('data-hs-scheme', o.scheme);
  await settle(page);
}

/** No scrolling on the home element (the page, the shell, the main area) and no sideways overflow. */
export async function homeOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
    const out: string[] = [];
    const doc = document.scrollingElement!;
    if (doc.scrollHeight - doc.clientHeight > 1) out.push(`document ${doc.scrollHeight}>${doc.clientHeight}`);
    if (doc.scrollWidth - doc.clientWidth > 1) out.push(`document-x ${doc.scrollWidth}>${doc.clientWidth}`);
    for (const sel of ['#main', '.hs']) {
      const el = root.querySelector(sel) as HTMLElement | null;
      if (el && el.scrollHeight - el.clientHeight > 1) out.push(`${sel} ${el.scrollHeight}>${el.clientHeight}`);
      if (el && el.scrollWidth - el.clientWidth > 1) out.push(`${sel}-x ${el.scrollWidth}>${el.clientWidth}`);
    }
    return out;
  });
}

export const RES = 'sw-app calendars-page cal-resident';

/** The resident's phone calendar (a person who manages no calendar, on a phone): the room list. */
export async function openResident(page: Page, after: boolean, scheme: 'light' | 'dark'): Promise<void> {
  await page.clock.setFixedTime(NOW);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installCalendarsMock(page);
  const cal = (id: string, name: string, capacity: number) => ({ id, name, type: 'room', color: 'blue', tz: 'Asia/Jerusalem', owner: { id: 'u2', name: 'נועה ברק' }, my_role: 'book',
    visibility: 'members', approval_mode: 'none', approval_timeout_h: 2, capacity, equipment: [], floor_id: null, area_ref: null, overlap_override: null, sync: null, pending_count: 0, archived: false, revision: 1 });
  await page.route('**/api/v1/calendar/calendars', (r) => json(r, { calendars: [cal('room-club', 'מועדון דיירים', 20), cal('room-gym', 'חדר כושר', 10), cal('room-roof', 'פינת מנגל בגג', 12)] }));
  await page.route('**/api/v1/calendar/rooms/day?**', (r) => json(r, rooms(after)));
  await page.route('**/api/v1/me/calendar?**', (r) => json(r, { occurrences: [], pending: [] }));
  await page.goto('about:blank');
  await page.addInitScript(() => { try { localStorage.removeItem('sw.building_filter'); } catch { /* */ } });
  await page.goto(`/?design=a&skin=domus&scheme=${scheme}#/calendars/cal`);
  await page.locator(`${RES} [data-res-view="rooms"]`).waitFor({ timeout: 30_000 });
  await settle(page);
}

/** The page never scrolls and nothing overflows sideways (the app's main area). */
export async function appOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    if (main && main.scrollHeight - main.clientHeight > 1) out.push(`main ${main.scrollHeight}>${main.clientHeight}`);
    const doc = document.documentElement;
    if (doc.scrollWidth - doc.clientWidth > 1) out.push(`document-x ${doc.scrollWidth}>${doc.clientWidth}`);
    return out;
  });
}
