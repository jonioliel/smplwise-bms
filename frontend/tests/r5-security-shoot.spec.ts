import { test, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installAccessMock, NOW as ACCESS_NOW, type MockOptions } from './access-control-mocks';
import { installExternalMock, XNOW } from './access-external-mocks';
import { install as installPeople, newMock as newPeople, type PeopleMock } from './wiskey-people-mock';
import { installWrites, newWrites } from './wiskey-writes-mock';
import { installStationsMock, newMock as newStations, NOW_ISO as STATIONS_NOW } from './wiskey-stations-mocks';
import { AR, EMOJI, LONG_HE, MIXED, ONE, RU, UNBREAK } from './breakui-worst';

// R5 SECURITY-WISKEY shoot harness (round 5 design pass), not a test: every screen of the group through the mocked API boundary
// (people / writes / stations / access-control mocks of this folder) or the demo data (the alarm, the entry center, the settings
// pages), every selectable skin, light + dark, desktop 1440x900 + phone 390x844. Nothing here touches a device.
//   R5_OUT=<dir> R5_SCREENS=alarm,people R5_SKINS=classic,domus SW_BASE_URL=http://127.0.0.1:4187/ npx playwright test tests/r5-security-shoot.spec.ts --project=desktop --project=mobile
const OUT = process.env.R5_OUT ?? '';
const ONLY = process.env.R5_SCREENS ? process.env.R5_SCREENS.split(',') : null;
const SKINS = (process.env.R5_SKINS ?? 'classic,domus,tesla,crystal,infra,soft').split(',');
const PEOPLE_NOW = '2026-10-12T10:00:00Z';
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NAMES = [LONG_HE, UNBREAK, MIXED, ONE, EMOJI, AR, RU, 'ב'.repeat(80)];

type Boot = (page: Page, skin: string, scheme: 'light' | 'dark', vp: 'desktop' | 'phone') => Promise<void>;
interface Screen { boot: Boot; full?: boolean; matrix: 'full' | 'lite' }

const url = (hash: string, skin: string, scheme: string, extra = '') => `/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}${extra}#${hash}`;
const go = async (page: Page, hash: string, skin: string, scheme: string, extra = '') => {
  await page.goto('about:blank');
  await page.goto(url(hash, skin, scheme, extra));
  await page.waitForSelector('sw-app', { state: 'attached' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.fonts.ready);
};
const settle = (page: Page, ms = 700) => page.waitForTimeout(ms);

// --- demo data (the static preview, no backend) --------------------------------------------------------------------------------
const demo = (hash: string): Boot => async (page, skin, scheme) => { await go(page, hash, skin, scheme); };

// --- the native people screen and everything that opens from it -----------------------------------------------------------------
const people = (prep: (st: PeopleMock) => void = () => {}, after: (page: Page, vp: 'desktop' | 'phone') => Promise<void> = async () => {}): Boot => async (page, skin, scheme, vp) => {
  const st = newPeople('admin');
  st.messaging = true;
  st.msg.quota = { limit: 40, used: 3 };
  prep(st);
  const w = newWrites();
  await page.clock.setFixedTime(new Date(PEOPLE_NOW));
  await installPeople(page, st);
  await installWrites(page, st, w);
  await go(page, '/wiskey/people', skin, scheme);
  await page.locator('wiskey-people sw-page[data-people-phase="ready"]').waitFor({ timeout: 20_000 });
  await after(page, vp);
  await settle(page);
};
const openPerson = async (page: Page, id = 'p3') => {
  await page.locator(`wiskey-people [data-person-row="${id}"]`).click();
  await page.locator('wiskey-person-drawer [data-person-section="details"]').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);
};
const worstPeople = (st: PeopleMock) => { st.people.forEach((p, i) => { p.display_name = NAMES[i % NAMES.length]; p.employee_no = i % 2 ? '1234567890123456' : p.employee_no; }); };

// --- the entry log, the schedules, the embed: the access-control mock -----------------------------------------------------------
const access = (hash: string, opts: MockOptions = {}, after: (page: Page) => Promise<void> = async () => {}, ready = ''): Boot => async (page, skin, scheme) => {
  await installAccessMock(page, opts);
  await page.clock.setFixedTime(ACCESS_NOW);
  await go(page, hash, skin, scheme);
  if (ready) await page.locator(ready).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  await after(page);
  await settle(page);
};

// --- the stations and doors ------------------------------------------------------------------------------------------------------
const stations = (after: (page: Page) => Promise<void> = async () => {}, view = ''): Boot => async (page, skin, scheme) => {
  await installStationsMock(page, newStations());
  await page.clock.setFixedTime(new Date(STATIONS_NOW));
  await page.addInitScript((v) => { try { if (v) localStorage.setItem('sw.wiskey.stations.view', v); else localStorage.removeItem('sw.wiskey.stations.view'); localStorage.removeItem('sw.wiskey.stations.treeCollapsed'); } catch {} }, view);
  await go(page, '/wiskey/devices', skin, scheme);
  await page.locator('wiskey-stations [data-wk-stations][data-wk-state="ready"]').waitFor({ timeout: 30_000 });
  await page.locator('wiskey-stations [data-wk-still] img').first().waitFor({ timeout: 15_000 }).catch(() => undefined);
  await after(page);
  await settle(page);
};

// --- Settings > Security > access-control reads (the four switches) ---------------------------------------------------------------
const switches: Boot = async (page, skin, scheme) => {
  await installExternalMock(page, {});
  const KEYS = ['wiskey.acr5_access_state', 'wiskey.acr5_normalize_user', 'wiskey.acr5_presence', 'wiskey.acr5_feature_plans'];
  const state: Record<string, string> = Object.fromEntries(KEYS.map((k) => [k, 'off']));
  state['wiskey.acr5_presence'] = 'on';
  await page.route('**/api/v1/wiskey/switches', (r) => json(r, { switches: state, go_live_permitted: true }));
  await page.clock.setFixedTime(XNOW);
  await go(page, '/system/security/wiskey', skin, scheme);
  await page.locator('system-security-wiskey [data-wiskey-switches]').waitFor({ timeout: 20_000 }).catch(() => undefined);
  await settle(page);
};

// --- Settings > phone app (the presence settings) with one registered device -----------------------------------------------------
const presence: Boot = async (page, skin, scheme) => {
  const ALL = ['video.live', 'map.read', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign', 'presence.report', 'presence.sensors.view'];
  const SENSORS = ['location', 'activity', 'steps', 'altitude', 'battery', 'network', 'beacon', 'app_state'];
  const settings = {
    enabled: true, mode: 'continuous', interval_s: 60, distance_filter_m: 50, notice_text: 'המכשיר משתף מיקום בשעות העבודה בלבד.', notice_version: 2, sensors_allowed: SENSORS, intervals_s: {},
    sites: [{ id: 'site_main', name: 'המשרד', lat: 32.0853, lon: 34.7818, radius_m: 150 }], beacons: [], wifi_sites: [],
    retention_days: 30, required_sensors: { enabled: true, sensors: ['location'], apply_to_web: false, max_stale_hours: 48, roles: [], users: [], exempt_users: [] }, break_glass: { until: null, reason: '', by: null },
    people: { stale_minutes: 30, beacon_max_age_minutes: 10, wifi_max_age_minutes: 15, min_proximity: 'near', show_names: true, refresh_seconds: 30 }, people_opt_out_count: 2,
  };
  const dev = (i: number, name: string, platform: string, inside: boolean) => ({
    device_id: `dev_${i}`, name, platform, app_version: '1.2.0', registered_at: '2026-10-05T08:00:00Z', last_seen_at: `2026-10-12T0${i}:00:00Z`, last_event_at: `2026-10-12T0${i}:00:00Z`,
    notice_ack_version: i === 3 ? 1 : 2, status: { location_auth: i === 3 ? 'denied' : 'always', precise: true, sharing: i !== 3, sensors: Object.fromEntries(SENSORS.map((k) => [k, k === 'location' || k === 'battery' ? 'on' : 'off'])) },
    presence: { inside, site_id: 'site_main', at: '2026-10-12T09:00:00Z' }, push: { registered: true, platform, muted: [], last_ok_at: null, failures: i === 3 ? 4 : 0 },
    user: { id: `u${i}`, username: `user${i}`, display_name: name.replace('הנייד של ', ''), active: true },
  });
  await page.route('**/api/v1/**', (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') return json(route, { channel: 'local', remote: null, user: { id: 'u-admin', username: 'admin', display_name: 'יוני', source: 'ingress' }, active: true, bindings: [], permissions_installation: ALL, permissions_any: ALL, has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'presence/settings') return json(route, { settings, sensors: [], devices: 3 });
    if (p === 'presence/devices') return json(route, { devices: [dev(1, 'הנייד של יוסי', 'ios', true), dev(2, 'Galaxy S24 · דנה', 'android', true), dev(3, 'הנייד של ' + LONG_HE, 'android', false)] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a' }, can_edit: true });
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-10-05T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
  await page.routeWebSocket(/\/api\/v1\/(ha|me|intercom)\/ws/, () => {});
  await page.clock.setFixedTime(new Date(PEOPLE_NOW));
  await go(page, '/system/diagnostics?tab=mobile', skin, scheme);
  await settle(page, 1200);
};

const DEF: Record<string, Screen> = {
  // demo data
  alarm: { boot: demo('/security/alarm'), matrix: 'full' },
  'alarm-settings': { boot: demo('/system/security/alarm'), matrix: 'lite', full: true },
  overview: { boot: demo('/wiskey/overview'), matrix: 'full' },
  'access-ui': { boot: demo('/system/diagnostics?tab=access-control'), matrix: 'lite', full: true },
  // people
  people: { boot: people(), matrix: 'full' },
  'people-worst': { boot: people(worstPeople), matrix: 'lite' },
  'people-empty': { boot: people((st) => { st.mode = 'empty'; }), matrix: 'lite' },
  'people-error': { boot: people((st) => { st.mode = 'error'; }), matrix: 'lite' },
  'people-select': { boot: people(() => {}, async (page) => { await page.locator('wiskey-people [data-people-select-mode]').click(); for (const id of ['p1', 'p2', 'p3']) await page.locator(`wiskey-people [data-person-select="${id}"]`).click(); }), matrix: 'lite' },
  person: { boot: people(() => {}, async (page) => openPerson(page)), matrix: 'full' },
  'person-access': { boot: people(() => {}, async (page) => { await openPerson(page); await page.locator('wiskey-person-drawer [data-person-tab="access"]').click(); await page.waitForTimeout(400); }), matrix: 'lite' },
  'person-messages': { boot: people((st) => { st.msg.history.p3 = [{ id: 'a', at: '2026-10-12T08:21:00Z', by: 'מנהל האתר', kind: 'template', template_id: 'closure', template_label: 'הכניסה סגורה זמנית', outcome: 'sent', reason: null, bulk: true }, { id: 'b', at: '2026-10-11T16:02:00Z', by: 'בודק', kind: 'free', template_id: null, template_label: null, outcome: 'refused', reason: 'not_registered', bulk: false }]; }, async (page) => { await openPerson(page); await page.locator('wiskey-person-drawer [data-person-tab="messages"]').click(); await page.waitForTimeout(400); }), matrix: 'lite' },
  'person-worst': { boot: people(worstPeople, async (page) => openPerson(page, 'p1')), matrix: 'lite' },
  actions: { boot: people(() => {}, async (page) => { await openPerson(page, 'p1'); await page.locator('wiskey-person-drawer [data-person-actions-open]').click(); await page.locator('wiskey-person-actions sw-dialog').waitFor({ state: 'attached' }); await page.waitForTimeout(700); }), matrix: 'lite' },
  'actions-cards': { boot: people(() => {}, async (page) => { await openPerson(page, 'p1'); await page.locator('wiskey-person-drawer [data-person-actions-open]').click(); await page.locator('wiskey-person-actions [data-person-action="cards"]').click(); await page.waitForTimeout(500); }), matrix: 'lite' },
  message: { boot: people(() => {}, async (page) => { await openPerson(page, 'p3'); await page.locator('wiskey-person-drawer [data-person-message]').click(); await page.locator('wiskey-message-dialog [data-msg-recipient]').waitFor(); await page.waitForTimeout(500); }), matrix: 'lite' },
  'message-bulk': { boot: people(() => {}, async (page) => { await page.locator('wiskey-people [data-people-select-mode]').click(); for (const id of ['p1', 'p2', 'p3']) await page.locator(`wiskey-people [data-person-select="${id}"]`).click(); await page.locator('wiskey-people [data-people-bulk-message]').click(); await page.locator('wiskey-message-dialog [data-msg-preview]').waitFor(); await page.waitForTimeout(500); }), matrix: 'lite' },
  editor: { boot: people(() => {}, async (page) => { await openPerson(page, 'p2'); await page.locator('wiskey-person-drawer [data-wiskey-person-edit]').click(); await page.locator('wiskey-person-editor [data-wiskey-editor-name]').waitFor({ timeout: 15_000 }); await page.waitForTimeout(600); }), matrix: 'full' },
  'editor-new': { boot: people(() => {}, async (page) => { await page.locator('wiskey-people [data-wiskey-people-add]').click(); await page.locator('wiskey-person-editor [data-wiskey-editor-name]').waitFor({ timeout: 15_000 }); await page.waitForTimeout(600); }), matrix: 'lite' },
  capture: { boot: people(() => {}, async (page) => { await openPerson(page, 'p2'); await page.locator('wiskey-person-drawer [data-wiskey-person-edit]').click(); await page.locator('wiskey-person-editor [data-wiskey-editor-name]').waitFor({ timeout: 15_000 }); const b = page.locator('wiskey-person-editor [data-wiskey-editor-capture-open]'); await b.scrollIntoViewIfNeeded(); await b.click(); await page.locator('wiskey-card-capture [data-wiskey-capture]').waitFor({ state: 'attached', timeout: 10_000 }); await page.waitForTimeout(900); }), matrix: 'lite' },
  // the entry log
  events: { boot: access('/wiskey/events', {}, async () => {}, 'wiskey-events button.row[data-row-id]'), matrix: 'full' },
  event: { boot: access('/wiskey/events', {}, async (page) => { await page.locator('wiskey-events button.row[data-row-id]').first().click(); await page.locator('wiskey-events sw-drawer[open] wiskey-event-drawer').waitFor({ timeout: 10_000 }); await page.waitForTimeout(600); }, 'wiskey-events button.row[data-row-id]'), matrix: 'full' },
  'events-empty': { boot: access('/wiskey/events', { events: 'empty' }, async () => {}, 'wiskey-events sw-state-panel'), matrix: 'lite' },
  'events-error': { boot: access('/wiskey/events', { events: 'error' }, async () => {}, 'wiskey-events sw-state-panel'), matrix: 'lite' },
  'events-off': { boot: access('/wiskey/events', { events: 'not_configured' }, async () => {}, 'wiskey-events sw-state-panel'), matrix: 'lite' },
  // the schedules (read only)
  schedules: { boot: access('/wiskey/schedules', { settings: { 'access.ui.schedules': 'smplwise' } }, async () => {}, 'wiskey-schedules [data-sch-program]'), matrix: 'full' },
  'schedules-empty': { boot: access('/wiskey/schedules', { settings: { 'access.ui.schedules': 'smplwise' }, schedules: 'empty' }, async () => {}, 'wiskey-schedules sw-state-panel'), matrix: 'lite' },
  // the embedded panel (the frame before WisKey answers)
  embed: { boot: access('/wiskey/overview', { settings: { 'access.ui.overview': 'wiskey' } }, async (page) => { await page.waitForTimeout(1500); }, 'wiskey-embed'), matrix: 'lite' },
  // the stations and doors
  stations: { boot: stations(), matrix: 'full' },
  'stations-list': { boot: stations(async () => {}, 'list'), matrix: 'lite' },
  'stations-table': { boot: stations(async () => {}, 'table'), matrix: 'lite' },
  station: { boot: stations(async (page) => { await page.locator('wiskey-stations [data-wk-grid] [data-wk-station="gate"] button.open').click(); await page.locator('wiskey-stations sw-drawer[data-wk-drawer][open]').waitFor({ timeout: 10_000 }); await page.locator('wiskey-stations sw-drawer [data-wk-live] img').waitFor({ timeout: 10_000 }).catch(() => undefined); await page.waitForTimeout(700); }), matrix: 'full' },
  // settings
  switches: { boot: switches, matrix: 'lite', full: true },
  presence: { boot: presence, matrix: 'lite', full: true },
};

const LITE: [string, 'light' | 'dark'][] = [['classic', 'light'], ['classic', 'dark'], ['domus', 'light'], ['crystal', 'dark'], ['infra', 'light'], ['soft', 'dark']];

test.describe('r5 security-wiskey shoot', () => {
  test.skip(!OUT, 'R5_OUT not set');
  test.beforeAll(() => { if (OUT) fs.mkdirSync(OUT, { recursive: true }); });
  for (const [id, s] of Object.entries(DEF)) {
    if (ONLY && !ONLY.includes(id)) continue;
    const combos: [string, 'light' | 'dark'][] = s.matrix === 'full' ? SKINS.flatMap((k) => [[k, 'light'], [k, 'dark']] as [string, 'light' | 'dark'][]) : LITE.filter(([k]) => SKINS.includes(k));
    for (const [skin, scheme] of combos) {
      test(`${id} ${skin} ${scheme}`, async ({ page }, info) => {
        test.skip(info.project.name === 'tablet', 'desktop and phone only');
        const vp = info.project.name === 'mobile' ? 'phone' : 'desktop';
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
        await page.emulateMedia({ colorScheme: scheme });
        const file = path.join(OUT, `${id}-${skin}-${scheme}-${vp}.png`);
        try {
          await s.boot(page, skin, scheme, vp);
        } catch (e) {
          fs.appendFileSync(path.join(OUT, 'errors.log'), `${path.basename(file)} boot: ${String(e).slice(0, 200)}\n`);
        }
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        await page.screenshot({ path: file, fullPage: !!s.full && vp === 'phone' });
        if (over > 1) fs.appendFileSync(path.join(OUT, 'overflow.log'), `${path.basename(file)} sideways ${over}px\n`);
        if (errors.length) fs.appendFileSync(path.join(OUT, 'errors.log'), `${path.basename(file)} pageerror: ${errors.join(' | ')}\n`);
      });
    }
  }
});
