import { expect, test, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import { installElectricityMock, url as elecUrl } from './electricity-mocks';
import { installCalendarsMock } from './calendars-mocks';
import { fixtureMeters } from '../src/electricity/fixtures';
import { ScheduleDemoStore } from '../src/api/schedules-mock';

// MULTI-BUILDING-NEXT-2500 (owner 22.11, Q67 / Q69 "then the filtering"; T119 MB-SCREENS-FILTER): the building filter of the full
// interface's lists against the REAL build with the mock layer - an invented site ("מגדל א", "מגדל ב", the shared "חניון"; no real place,
// device or person). "before" = the answer of a site whose multi-building switch (or filter setting) is off - exactly the answer of the
// previous version, so the screen draws nothing new; "after" = the same list with the server's `building_filter` (services/building_filter).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-mb-next-2500.spec.ts --project=desktop --workers=2
// SW_SHOTS: where the captures go (default test-results/mb-next-2500).

const OUT = process.env.SW_SHOTS || 'test-results/mb-next-2500';
const SIZES = [{ id: 'desktop', width: 1440, height: 900 }, { id: 'phone', width: 390, height: 844 }];
const SCHEMES = ['light', 'dark'] as const;
const A = 'bA', B = 'bB', P = 'bP';
const FILTER = { buildings: [{ id: A, name: 'מגדל א', is_shared: false }, { id: B, name: 'מגדל ב', is_shared: false }, { id: P, name: 'חניון', is_shared: true }], building: null };
/** item i serves: tower A, tower B, every building (the shared car park) - Q67 */
const SERVES = [[A], [B], [A, B, P]];

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function fresh(page: Page) {
  await page.goto('about:blank');
  await page.addInitScript(() => { try { localStorage.removeItem('sw.building_filter'); } catch { /* */ } });
}

/** The building filter of a screen (inside the app's shadow roots - Playwright's CSS pierces them). */
const filterOf = (page: Page, host: string) => page.locator(`sw-app ${host} sw-building-filter`);

// ---------------------------------------------------------------------------------------------------------------- electricity meters

function meterRows(withFilter: boolean) {
  return fixtureMeters().map((m, i) => ({
    id: m.id, display_name: m.name, device_id: null, device_name: null, entity_name: m.name, source_ref: `sensor.${m.id}_energy`, unit: 'kWh',
    area_id: m.area_id, area_name: m.area_name, status: m.status === 'paused' ? 'paused' : 'active', status_reason: m.status === 'paused' ? 'manual' : null, revision: 1,
    state: m.status === 'stale' ? 'not_reporting' : m.status === 'paused' ? 'paused' : 'reporting', last_report_at: m.last_report_at, value_kwh: m.reading_kwh,
    today_kwh: m.today_kwh, accounts_count: m.accounts.length,
    ...(withFilter ? { buildings: SERVES[i % 3] } : {}),
  }));
}

async function openMeters(page: Page, after: boolean, scheme: 'light' | 'dark') {
  await installElectricityMock(page);
  await page.route('**/api/v1/energy/meters', (r) => json(r, { items: meterRows(after), stale_after_minutes: 30, ...(after ? { building_filter: FILTER } : {}) }));
  await fresh(page);
  await page.goto(elecUrl('/infra/electricity/meters', 'domus', scheme));
  await page.locator('sw-app elec-meters-page [data-meters-search]').waitFor();
}

// ---------------------------------------------------------------------------------------------------------------- the shared rooms

async function openRooms(page: Page, after: boolean, scheme: 'light' | 'dark') {
  await installCalendarsMock(page, { perms: ['devices.read', 'calendar.view', 'calendar.book'] });
  const cal = (id: string, name: string) => ({ id, name, type: 'room', color: 'blue', tz: 'Asia/Jerusalem', owner: { id: 'u2', name: 'נועה ברק' }, my_role: 'book', visibility: 'members',
    approval_mode: 'none', approval_timeout_h: 2, capacity: 8, equipment: [], floor_id: null, area_ref: null, overlap_override: null, sync: null, pending_count: 0, archived: false, revision: 1 });
  const rooms = [['a', 'חדר ישיבות אלון'], ['b', 'חדר ישיבות ברוש'], ['c', 'אולם הלובי']] as const;
  await page.route('**/api/v1/calendar/calendars', (r) => json(r, { calendars: rooms.map(([id, name]) => cal(id, name)) }));
  await page.route('**/api/v1/calendar/rooms/day**', (r) => json(r, {
    rooms: rooms.map(([id, name], i) => ({ calendar_id: id, name, capacity: 8, equipment: [], open: [{ from: '07:00', to: '22:00' }], entries: [], ...(after ? { buildings: SERVES[i] } : {}) })),
    ...(after ? { building_filter: FILTER } : {}),
  }));
  await fresh(page);
  await page.goto(`/?design=a&skin=domus&scheme=${scheme}#/calendars/rooms`);
  await page.locator('sw-app cal-view-rooms [data-cal-rooms]').waitFor();
}

// ---------------------------------------------------------------------------------------------------------------- the schedules

async function openSchedules(page: Page, after: boolean, scheme: 'light' | 'dark') {
  const store = new ScheduleDemoStore();
  const perms = ['video.live', 'devices.read', 'map.read', 'entity.state.read', 'events.read', 'schedule.view', 'schedule.manage'];
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') {
      return json(route, { channel: 'local', remote: null, user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full' });
    }
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'schedules.enabled': 'true' } });
    if (p === 'schedules/status') return json(route, await store.status());
    if (p === 'schedules') {
      const list = await store.list({ limit: 500 });
      if (!after) return json(route, list);
      return json(route, { ...list, items: list.items.map((s, i) => ({ ...s, buildings: SERVES[i % 3] })), building_filter: FILTER });
    }
    if (p.startsWith('schedules/')) return json(route, { items: [], tags: [], entities: [], truncated: false });
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-10-05T09:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p === 'alarm/panels') return json(route, { panels: [], counts: { panels: 0 } });
    return json(route, { code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
  await fresh(page);
  await page.goto(`/?design=a&skin=domus&scheme=${scheme}&sched_view=rows#/devices/schedules`);
  await page.locator('sw-app devices-schedules [data-sched-rows]').waitFor();
}

// ---------------------------------------------------------------------------------------------------------------- the tests

test.describe('MULTI-BUILDING-NEXT-2500 the building filter of the lists', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sizes are set per test'));

  for (const size of SIZES) {
    test(`electricity meters: none before, the filter after - tower B keeps its meters and the shared one with "גם ב..." (${size.id})`, async ({ page }) => {
      await page.setViewportSize(size);
      for (const scheme of SCHEMES) {
        await openMeters(page, false, scheme);
        await expect(filterOf(page, 'elec-meters-page')).toHaveCount(0);
        await shot(page, `meters-before-${size.id}-${scheme}`);
        await openMeters(page, true, scheme);
        const f = filterOf(page, 'elec-meters-page');
        await expect(f).toBeVisible();
        await f.locator('[data-building="bB"]').click();
        await expect(f.locator('[data-building="bB"]')).toHaveAttribute('aria-checked', 'true'); // a radio sw-segmented key: aria-checked only since A11Y-AUDIT-2490 (2.48)
        await expect(page.locator('sw-app elec-meters-page [data-also]').first()).toContainText('גם ב');
        expect(await overflowX(page)).toBeLessThanOrEqual(0);
        await shot(page, `meters-after-${size.id}-${scheme}`);
      }
    });

    test(`shared rooms: tower A shows its room and the car park's (${size.id})`, async ({ page }) => {
      await page.setViewportSize(size);
      for (const scheme of SCHEMES) {
        await openRooms(page, false, scheme);
        await expect(filterOf(page, 'cal-view-rooms')).toHaveCount(0);
        await shot(page, `rooms-before-${size.id}-${scheme}`);
        await openRooms(page, true, scheme);
        const f = filterOf(page, 'cal-view-rooms');
        await expect(f).toBeVisible();
        await f.locator('[data-building="bA"]').click();
        await expect(page.locator('sw-app cal-view-rooms')).not.toContainText('חדר ישיבות ברוש');
        await expect(page.locator('sw-app cal-view-rooms')).toContainText('אולם הלובי');
        expect(await overflowX(page)).toBeLessThanOrEqual(0);
        await shot(page, `rooms-after-${size.id}-${scheme}`);
      }
    });

    test(`schedules: the filter in the toolbar, tower B narrows the rows (${size.id})`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.clock.install({ time: new Date('2026-10-05T09:00:00Z') }); // the runs still to come today do not depend on the wall clock
      for (const scheme of SCHEMES) {
        await openSchedules(page, false, scheme);
        await expect(filterOf(page, 'devices-schedules')).toHaveCount(0);
        await shot(page, `schedules-before-${size.id}-${scheme}`);
        await openSchedules(page, true, scheme);
        const f = filterOf(page, 'devices-schedules');
        await expect(f).toBeVisible();
        const all = await page.locator('sw-app devices-schedules [data-schedule]').count();
        await f.locator('[data-building="bB"]').click();
        await expect.poll(() => page.locator('sw-app devices-schedules [data-schedule]').count()).toBeLessThanOrEqual(all);
        expect(await overflowX(page)).toBeLessThanOrEqual(0);
        await shot(page, `schedules-after-${size.id}-${scheme}`);
      }
    });

    test(`settings: the "סינון לפי בניין ברשימות" row of the mapping page (${size.id})`, async ({ page }) => {
      await page.setViewportSize(size);
      for (const scheme of SCHEMES) {
        await fresh(page);
        await page.goto(`/?design=a&skin=domus&scheme=${scheme}&mb=on#/system/diagnostics?tab=buildings`);
        const row = page.locator('system-mapping [data-mapping-setting="filter"]');
        await row.waitFor();
        await expect(row.locator('[data-mapping-option="on"]')).toHaveAttribute('aria-pressed', 'true');
        await row.scrollIntoViewIfNeeded();
        expect(await overflowX(page)).toBeLessThanOrEqual(0);
        await shot(page, `mapping-filter-row-${size.id}-${scheme}`);
      }
    });
  }
});
