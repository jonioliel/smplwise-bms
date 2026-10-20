import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// NVRLESS-295: the sensor events list of an installation with no NVR, from the REAL build against a faked backend (page.route; no
// device, no recorder, no home system). The faked /me says "no NVR, events from the sensors"; /events filters the fake list the way the
// server does (source, type, free text, floor / zone through the sensor's place, day or range). Shots: ready, filtered, drawer, empty,
// filtered-empty, error, loading - light and dark - in the desktop / tablet / phone projects; plus the English column and the direct
// URLs that stay closed without a recorder. Screenshots in docs/evidence/nvrless-ha-events/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-ha-events.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/nvrless-ha-events');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const PERMS = ['events.read', 'devices.read', 'map.read'];

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const LOBBY = { floor_id: 'f2', floor_name: 'קומה 2', building_name: 'בניין A', zone: 'לובי' };
const HALL = { floor_id: 'f2', floor_name: 'קומה 2', building_name: 'בניין A', zone: null };
const row = (id: string, min: number, type: string, name: string, d: Record<string, unknown>, severity = 'info', place: unknown = null, count = 1) => ({
  id, source: 'ha', raw_type: `${d.domain}.${d.device_class ?? ''}`, type, camera_id: null, camera_name: name, recorder_id: null, channel: null,
  occurred_at: ago(min), ended_at: null, received_at: ago(min), state: 'none', count, severity, confidence: 'measured', acked_at: null, acked_by_username: null,
  thumbnail: 'unavailable', place, details: { entity_id: `${d.domain}.${name}`, name, ...d },
});
const EVENTS = [
  row('e1', 3, 'door', 'דלת כניסה ראשית', { domain: 'binary_sensor', device_class: 'door', from: 'off', to: 'on' }, 'alert', LOBBY),
  row('e2', 9, 'motion', 'תנועה במסדרון', { domain: 'binary_sensor', device_class: 'motion', from: 'off', to: 'on' }, 'info', HALL, 3),
  row('e3', 14, 'door', 'מנעול דלת ראשית', { domain: 'lock', from: 'unlocked', to: 'locked' }, 'info', LOBBY),
  row('e4', 31, 'door', 'דלת מחסן', { domain: 'binary_sensor', device_class: 'door', from: 'off', to: 'on' }, 'alert', null),
  row('e5', 47, 'door', 'דלת מחסן', { domain: 'binary_sensor', device_class: 'door', from: 'on', to: 'unavailable', availability: 'lost' }, 'alert', null),
  row('e6', 62, 'other', 'לוח אזעקה', { domain: 'alarm_control_panel', from: 'disarmed', to: 'armed_home' }, 'info', LOBBY),
  row('e7', 95, 'motion', 'תנועה בלובי', { domain: 'binary_sensor', device_class: 'occupancy', from: 'on', to: 'off' }, 'info', LOBBY),
  row('e8', 130, 'door', 'דלת מרפסת', { domain: 'binary_sensor', device_class: 'door', from: 'on', to: 'off' }, 'info', HALL),
];
const FACETS = {
  days: 90, since: ago(90 * 1440), types: [{ type: 'door', count: 5 }, { type: 'motion', count: 2 }, { type: 'other', count: 1 }], sources: [{ source: 'ha', count: 8 }], severities: [{ severity: 'info', count: 5 }, { severity: 'alert', count: 3 }],
  unavailable_types: [], notes: [],
  places: [{ id: 's1', name: 'אתר', buildings: [{ id: 'b1', name: 'בניין A', floors: [
    { id: 'f2', name: 'קומה 2', cameras: 0, sensors: 4, zones: [{ id: 'z1', name: 'לובי', kind: 'room', cameras: 0, sensors: 3 }] },
    { id: 'f3', name: 'קומה 3', cameras: 0, sensors: 0, zones: [] },
  ] }] }],
};

type Mode = 'ready' | 'empty' | 'error' | 'slow';
async function install(page: Page, mode: Mode = 'ready', caps: Record<string, boolean> = {}) {
  const seen: string[] = [];
  await page.routeWebSocket('**/events/ws', () => { /* accepted, silent: the list shows "connecting" honestly */ });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') {
      return json(route, {
        user: { id: 'u1', username: 'dana', display_name: 'דנה', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: PERMS, permissions_any: PERMS,
        has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'ha_only',
        capabilities: { nvr: false, go2rtc: false, ha: true, live_video: false, playback: false, events_recorder: false, events_ha: true, ha_cameras_still: true, ha_cameras_live: false, supported: true, unsupported_reason: null, ...caps },
      });
    }
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'ui.skin': 'classic', 'time.zone': 'Asia/Jerusalem' }, can_edit: false });
    if (p === 'events/facets') return json(route, FACETS);
    if (p === 'events') {
      seen.push(url.search);
      if (mode === 'error') return json(route, { code: 'internal', user_message: 'השרת לא ענה. נסו שוב בעוד רגע.', retryable: true, correlation_id: 'x', details: {} }, 500);
      if (mode === 'slow') await new Promise((r) => setTimeout(r, 20_000));
      const q = url.searchParams;
      let rows = mode === 'empty' ? [] : EVENTS.filter((e) => e.source === (q.get('source') ?? e.source));
      if (q.get('type')) rows = rows.filter((e) => e.type === q.get('type'));
      if (q.get('q')) rows = rows.filter((e) => JSON.stringify(e).includes(q.get('q') as string));
      if (q.get('floor_id')) rows = rows.filter((e) => (e.place as { floor_id?: string } | null)?.floor_id === q.get('floor_id'));
      if (q.get('zone_id')) rows = rows.filter((e) => (e.place as { zone?: string | null } | null)?.zone === 'לובי');
      return json(route, { events: rows, from: ago(1440), to: ago(-5), timezone: 'Asia/Jerusalem', types: ['door', 'motion', 'other'], filters: { applied: {}, unsupported: [] }, ingest: { connected: false, last_heartbeat_at: null, last_event_at: null, last_error: null, reconnects: 0, events_stored: 0, started_at: null }, derive: { last_run: null, last_ok: null, last_error: null, derived: 0 } });
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return seen;
}

const shot = (page: Page, name: string, scheme = 'light') => page.screenshot({ path: path.join(OUT, `${name}-${scheme}-${test.info().project.name}.png`), fullPage: false });
const open = async (page: Page, scheme = 'light', hash = '#/investigate/events') => {
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=classic&scheme=${scheme}${hash}`);
};
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test.describe('sensor events list (no NVR)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

  for (const scheme of ['light', 'dark']) {
    test(`ready, ${scheme}: the sensor events with their area, no clip, read only`, async ({ page }) => {
      const seen = await install(page);
      await open(page, scheme);
      const host = page.locator('investigate-ha-events');
      await expect(host).toHaveCount(1);
      await expect(page.locator('investigate-events')).toHaveCount(0);
      await expect(host.locator('[data-ha-summary]')).toContainText('8 אירועים · 3 התראות · 7 חיישנים');
      await expect(host.locator('tr[data-row-id]')).toHaveCount(8);
      await expect(host.locator('tr[data-row-id="e1"]')).toContainText('נפתח');
      await expect(host.locator('tr[data-row-id="e1"]')).toContainText('דלת כניסה ראשית');
      await expect(host.locator('tr[data-row-id="e1"]')).toContainText('לובי · קומה 2');
      await expect(host.locator('tr[data-row-id="e4"]')).toContainText('לא ממוקם בתוכנית');
      await expect(host.locator('tr[data-row-id="e3"]')).toContainText('ננעל');
      await expect(host.locator('tr[data-row-id="e5"]')).toContainText('החיישן אינו זמין');
      await expect(host.locator('[data-ha-readonly]')).toBeVisible();
      await expect(host.locator('img, sw-live-player, video')).toHaveCount(0); // no picture, no player
      expect(seen[0]).toContain('source=ha');
      await noOverflow(page);
      await shot(page, 'ready', scheme);
    });
  }

  test('filters: type, area (floor and room), free text, range - each one a server request; clearing returns the list', async ({ page }) => {
    const seen = await install(page);
    await open(page);
    const host = page.locator('investigate-ha-events');
    await expect(host.locator('tr[data-row-id]')).toHaveCount(8);
    await host.locator('[data-ha-type]').selectOption('motion');
    await expect(host.locator('tr[data-row-id]')).toHaveCount(2);
    expect(seen.at(-1)).toContain('type=motion');
    await host.locator('[data-ha-type]').selectOption('');
    await host.locator('[data-ha-area]').selectOption('zone:z1');
    await expect(host.locator('tr[data-row-id]')).toHaveCount(4);
    expect(seen.at(-1)).toContain('zone_id=z1');
    await host.locator('[data-ha-area]').selectOption('floor:f3');
    await expect(host.locator('[data-ha-empty="filtered"]')).toBeVisible();
    await shot(page, 'filtered-empty');
    await host.locator('[data-ha-clear]').click();
    await expect(host.locator('tr[data-row-id]')).toHaveCount(8);
    await host.locator('[data-ha-q]').fill('מחסן');
    await expect(host.locator('tr[data-row-id]')).toHaveCount(2);
    expect(seen.at(-1)).toContain('q=');
    await host.locator('[data-ha-q]').fill('');
    await host.locator('[data-ha-range-set="7"]').click();
    await expect(host.locator('[data-ha-range-set="7"]')).toHaveAttribute('aria-pressed', 'true');
    expect(seen.at(-1)).toMatch(/from=.*to=/);
    await noOverflow(page);
  });

  test('the row opens a drawer: facts, the previous and the new state, and why there is no clip', async ({ page }) => {
    await install(page);
    await open(page);
    const host = page.locator('investigate-ha-events');
    await host.locator('tr[data-row-id="e2"]').click();
    const drawer = host.locator('[data-ha-drawer]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('זוהתה תנועה');
    await expect(drawer).toContainText('תנועה במסדרון');
    await expect(drawer).toContainText('3 חזרות');
    await expect(drawer.locator('[data-ha-noclip]')).toContainText('אין הקלטה או תמונה');
    await expect(drawer.locator('button, sw-button', { hasText: /להקלטה|נגן|סמן טופל|סקירה/ })).toHaveCount(0); // read only: no ack, no playback
    await shot(page, 'drawer');
  });

  test('empty and error and loading states', async ({ page }) => {
    await install(page, 'empty');
    await open(page);
    await expect(page.locator('investigate-ha-events [data-ha-empty="none"]')).toContainText('אין אירועי חיישנים בטווח הזה');
    await shot(page, 'empty');
    await noOverflow(page);
  });

  test('error: a failed read is said, with a retry', async ({ page }) => {
    await install(page, 'error');
    await open(page);
    const panel = page.locator('investigate-ha-events sw-state-panel[state="error"]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('heading', 'לא ניתן לטעון את האירועים');
    await shot(page, 'error');
  });

  test('loading: the panel shows while the answer is on its way', async ({ page }) => {
    await install(page, 'slow');
    await open(page);
    await expect(page.locator('investigate-ha-events sw-state-panel[state="loading"]')).toBeVisible();
    await shot(page, 'loading');
  });

  test('English: the column follows the document language, left to right', async ({ page }) => {
    await install(page);
    await open(page);
    const host = page.locator('investigate-ha-events');
    await expect(host.locator('tr[data-row-id]')).toHaveCount(8);
    await page.evaluate(() => { document.documentElement.lang = 'en'; document.documentElement.dir = 'ltr'; });
    await host.locator('[data-ha-type]').selectOption('door'); // any change re-renders with the new language
    await expect(host.locator('tr[data-row-id="e1"]')).toContainText('Opened');
    await expect(host.locator('tr[data-row-id="e3"]')).toContainText('Locked');
    await expect(host.locator('[data-ha-readonly]')).toContainText('View only');
    await shot(page, 'english');
  });

  test('the rest of the area stays closed without a recorder: reviews, rules, cases, the event page', async ({ page }) => {
    await install(page);
    for (const hash of ['#/investigate/reviews', '#/investigate/rules', '#/investigate/cases', '#/investigate/events/e1', '#/investigate/playback']) {
      await open(page, 'light', hash);
      await expect(page.locator('investigate-ha-events')).toHaveCount(0);
      await expect(page.locator('investigate-event-detail, investigate-reviews, investigate-rules, investigate-cases, investigate-playback')).toHaveCount(0);
    }
  });

  test('with recorder events the event centre itself is shown, not the sensor list', async ({ page }) => {
    await install(page, 'ready', { nvr: true, go2rtc: true, events_recorder: true, live_video: true, playback: true });
    await open(page);
    await expect(page.locator('investigate-events')).toHaveCount(1);
    await expect(page.locator('investigate-ha-events')).toHaveCount(0);
  });

  test('no sensor events source at all: the neutral panel, not a list', async ({ page }) => {
    await install(page, 'ready', { events_ha: false, ha: false });
    await open(page);
    await expect(page.locator('investigate-ha-events')).toHaveCount(0);
    await expect(page.locator('investigate-events')).toHaveCount(0);
  });
});
