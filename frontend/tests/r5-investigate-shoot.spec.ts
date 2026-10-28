import { test, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { LONG_HE, MIXED, UNBREAK } from './breakui-worst';

// R5-INVESTIGATE-297 shoot harness, not a test: every investigate screen (events, playback, sync, history map, reviews, cases, case,
// exports, search, rules, rule editor, live incidents) in the demo mode of the real build, plus the event page and the sensor events
// list through a faked backend (page.route; no device, no recorder). Every selectable skin, light + dark, desktop + phone.
//   R5_OUT=<dir> R5_SCREENS=events,playback R5_SKINS=classic,domus SW_BASE_URL=http://127.0.0.1:4197/ npx playwright test tests/r5-investigate-shoot.spec.ts --project=desktop --project=mobile
const OUT = process.env.R5_OUT ?? '';
const SCREENS = (process.env.R5_SCREENS ?? 'events,events-drawer,playback,sync,history,reviews,reviews-drawer,cases,case,exports,search,rules,rule,incidents,incident,event,ha-events,ha-drawer').split(',');
const SKINS = (process.env.R5_SKINS ?? 'classic,domus,tesla,crystal,infra,soft').split(',');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const PERMS = ['events.read', 'events.ack', 'devices.read', 'map.read', 'cases.read', 'cases.write', 'video.playback'];

const LOBBY = { floor_id: 'f2', floor_name: 'קומה 2', building_name: 'בניין A', zone: 'לובי' };
const vms = (id: string, min: number, type: string, cam: string, severity = 'info', extra: Record<string, unknown> = {}) => ({
  id, source: 'alertstream', raw_type: 'VMD', type, camera_id: 'c1', camera_name: cam, recorder_id: 'nvr-1', channel: 1, occurred_at: ago(min), ended_at: ago(min - 0.5), received_at: ago(min),
  state: 'inactive', count: 1, severity, confidence: 'measured', details: {}, acked_at: null, acked_by_username: null, thumbnail: 'unavailable', ...extra,
});
const EVENTS = [
  vms('e1', 12, 'person', 'כניסה ראשית', 'alert'),
  vms('e2', 14, 'vehicle', 'חניה מקורה'),
  vms('e3', 16, 'motion', 'מסדרון מזרחי'),
  vms('e4', 18, 'line', 'חצר אחורית', 'critical'),
];
const ha = (id: string, min: number, type: string, name: string, d: Record<string, unknown>, severity = 'info', place: unknown = null, count = 1) => ({
  id, source: 'ha', raw_type: `${d.domain}.${d.device_class ?? ''}`, type, camera_id: null, camera_name: name, recorder_id: null, channel: null,
  occurred_at: ago(min), ended_at: null, received_at: ago(min), state: 'none', count, severity, confidence: 'measured', acked_at: null, acked_by_username: null,
  thumbnail: 'unavailable', place, details: { entity_id: `${d.domain}.${name}`, name, ...d },
});
const HA_EVENTS = [
  ha('h1', 3, 'door', 'דלת כניסה ראשית', { domain: 'binary_sensor', device_class: 'door', from: 'off', to: 'on' }, 'alert', LOBBY),
  ha('h2', 9, 'motion', 'תנועה במסדרון', { domain: 'binary_sensor', device_class: 'motion', from: 'off', to: 'on' }, 'info', LOBBY, 3),
  ha('h3', 14, 'door', 'מנעול דלת ראשית', { domain: 'lock', from: 'unlocked', to: 'locked' }, 'info', LOBBY),
  ha('h4', 31, 'door', 'דלת מחסן', { domain: 'binary_sensor', device_class: 'door', from: 'off', to: 'on' }, 'alert', null),
  ha('h5', 62, 'other', 'לוח אזעקה', { domain: 'alarm_control_panel', from: 'disarmed', to: 'armed_home' }, 'info', LOBBY),
  ha('h6', 95, 'motion', 'תנועה בלובי', { domain: 'binary_sensor', device_class: 'occupancy', from: 'on', to: 'off' }, 'info', LOBBY),
];
const FACETS = {
  days: 90, since: ago(90 * 1440), types: [{ type: 'door', count: 3 }, { type: 'motion', count: 2 }, { type: 'other', count: 1 }], sources: [{ source: 'ha', count: 6 }], severities: [{ severity: 'info', count: 4 }, { severity: 'alert', count: 2 }],
  unavailable_types: [], notes: [],
  places: [{ id: 's1', name: 'אתר', buildings: [{ id: 'b1', name: 'בניין A', floors: [{ id: 'f2', name: 'קומה 2', cameras: 0, sensors: 4, zones: [{ id: 'z1', name: 'לובי', kind: 'room', cameras: 0, sensors: 3 }] }] }] }],
};
const ingest = { connected: true, last_heartbeat_at: ago(1), last_event_at: ago(12), last_error: null, reconnects: 0, events_stored: 4, started_at: ago(600) };

/** The faked backend: a session with the event permissions; `haOnly` = an installation without a recorder (the sensor events list). */
async function installApi(page: Page, skin: string, scheme: string, haOnly: boolean, worst = false) {
  await page.routeWebSocket('**/events/ws', () => { /* accepted, silent */ });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') {
      return json(route, {
        user: { id: 'u1', username: 'dana', display_name: 'דנה', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: PERMS, permissions_any: PERMS,
        has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: haOnly ? 'ha_only' : 'full',
        capabilities: { nvr: !haOnly, go2rtc: !haOnly, ha: true, live_video: !haOnly, playback: !haOnly, events_recorder: !haOnly, events_ha: true, ha_cameras_still: true, ha_cameras_live: false, supported: true, unsupported_reason: null },
      });
    }
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'ui.skin': skin, 'ui.scheme': scheme, 'time.zone': 'Asia/Jerusalem' }, can_edit: false });
    if (p === 'events/facets') return json(route, FACETS);
    if (p === 'events') {
      const rows = haOnly ? HA_EVENTS : EVENTS;
      return json(route, { events: rows, from: ago(1440), to: ago(-5), timezone: 'Asia/Jerusalem', types: ['door', 'motion', 'other'], filters: { applied: {}, unsupported: [] }, ingest, derive: { last_run: null, last_ok: null, last_error: null, derived: 0 } });
    }
    const m = /^events\/([^/]+)$/.exec(p);
    if (m) {
      const ev = EVENTS.find((e) => e.id === m[1]) ?? EVENTS[0];
      const camName = worst ? `${LONG_HE} ${UNBREAK}` : ev.camera_name;
      return json(route, { ...ev, camera_name: camName, count: worst ? 1234567 : 1, location: { anchor_id: 'a1', floor_id: 'f2', floor_name: worst ? MIXED : 'קומה 2', building_id: 'b1', building_name: 'בניין A', zone: worst ? LONG_HE : 'לובי', has_plan: false }, timezone: 'Asia/Jerusalem' });
    }
    if (/^events\/[^/]+\/(correlation|route)/.test(p)) return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
    if (p === 'cameras') return json(route, { cameras: [] });
    if (p === 'incidents/summary') return json(route, { enabled: false, open: 0, latest_id: null, red_dot: 'off' });
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
}

interface Screen { hash: string; api?: 'full' | 'ha'; open?: string; worst?: boolean; tab?: string }
const DEF: Record<string, Screen> = {
  events: { hash: '/investigate/events' },
  'events-drawer': { hash: '/investigate/events', open: 'investigate-events sw-table tr[data-row-id]' },
  playback: { hash: '/investigate/playback' },
  sync: { hash: '/investigate/playback/sync' },
  history: { hash: '/investigate/floors/f0/history' },
  reviews: { hash: '/investigate/reviews' },
  'reviews-drawer': { hash: '/investigate/reviews', open: 'investigate-reviews frigate-review-card [data-review-open]' },
  cases: { hash: '/investigate/cases' },
  case: { hash: '/investigate/cases/case-1' },
  exports: { hash: '/investigate/exports' },
  search: { hash: '/investigate/search' },
  rules: { hash: '/investigate/rules' },
  rule: { hash: '/investigate/rules/r-1' },
  incidents: { hash: '/investigate/incidents' },
  incident: { hash: '/investigate/incidents/demo-incident' },
  event: { hash: '/investigate/events/e1', api: 'full' },
  'event-worst': { hash: '/investigate/events/e1', api: 'full', worst: true },
  'ha-events': { hash: '/investigate/events', api: 'ha' },
  'ha-drawer': { hash: '/investigate/events', api: 'ha', open: 'investigate-ha-events sw-table tr[data-row-id]' },
};

async function boot(page: Page, s: Screen, skin: string, scheme: 'light' | 'dark') {
  if (s.api) await installApi(page, skin, scheme, s.api === 'ha', s.worst);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}#${s.hash}`);
  await page.waitForSelector('sw-app', { state: 'attached' });
  await page.waitForTimeout(1800);
  await page.evaluate(() => document.fonts.ready);
  if (s.open) {
    const row = page.locator(s.open).first();
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    await row.click();
    await page.waitForTimeout(1000);
  }
}

test.describe('r5 investigate shoot', () => {
  test.skip(!OUT, 'R5_OUT not set');
  test.beforeAll(() => { if (OUT) fs.mkdirSync(OUT, { recursive: true }); });
  for (const skin of SKINS) for (const scheme of ['light', 'dark'] as const) for (const id of SCREENS) {
    test(`${id} ${skin} ${scheme}`, async ({ page }, info) => {
      const vp = info.project.name === 'mobile' ? 'phone' : 'desktop';
      const s = DEF[id];
      await page.emulateMedia({ colorScheme: scheme });
      await boot(page, s, skin, scheme);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const file = path.join(OUT, `${id}-${skin}-${scheme}-${vp}.png`);
      await page.screenshot({ path: file, fullPage: false });
      if (over > 1) fs.appendFileSync(path.join(OUT, 'overflow.log'), `${path.basename(file)} sideways ${over}px\n`);
    });
  }
});
