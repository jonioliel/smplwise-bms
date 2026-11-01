import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// SWITCH-LIGHT-DIMMER-2331 (owner 2026-11-01). Against a mocked backend (every name synthetic, no device, no Home Assistant):
//  1. the brightness slider: only a light that really takes a brightness - never a relay switch typed as a light, never an on/off-only light;
//  2. the synoptic board and the cross-section: a press on a floor's lights strip / count opens the floor lights popup - every light of the
//     floor's areas (light.* and the switches counted as lights, by "מפסקים בעמודת התאורה"), grouped by area, a toggle each, "הדלק הכל" /
//     "כבה הכל" through the existing bulk confirmation (count, then the result per device), Escape closes.
// Run on a preview build of this worktree:
//   npm run build && npx vite preview --port 4197 --strictPort &
//   SW_BASE_URL=http://127.0.0.1:4197/ npx playwright test tests/evidence-switch-light-dimmer-2331.spec.ts --workers=1

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/SWITCH-LIGHT-DIMMER-2331');
const PERMS = ['devices.read', 'devices.control', 'devices.control_bulk', 'map.read', 'entity.state.read'];
const NOT_FOUND = { code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} };
const SYNC = { connected: true, last_snapshot_at: '2026-11-01T10:00:00Z', last_event_at: '2026-11-01T10:00:00Z', last_registry_at: '2026-11-01T09:00:00Z', last_error: null, reconnects: 0, sequence: 10, entities: 20, started_at: '2026-11-01T08:00:00Z', ha_version: null };
const XS = { desktop_place: 'left', phone_place: 'side', many: 'steps', links: 'fold', click: 'select', shafts: true, animate: true, temp_threshold: 2, syn_tab: true, syn_columns: 'all', syn_custom: ['light', 'temp', 'presence', 'cameras', 'doors', 'alerts', 'fire'], syn_hide_empty: true, syn_events: true, syn_switches: 'typed', fire_column: 'hidden', fire_ui: false, ack: 'hold', ack_who: 'separate', alarm_bar: 'everywhere', wall: true };

const counts = (o: Record<string, number | string | null> = {}) => ({ entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, switch_entities: 0, switch_entities_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0, ...o });

function row(entity_id: string, name: string, state: string, area: [string, string], extra: Record<string, unknown> = {}) {
  const domain = entity_id.split('.')[0];
  return { entity_id, name, domain, device_class: null, state, available: true, fresh: true, active: state === 'on', icon: null, last_changed: '2026-11-01T09:40:00Z', can_control: true, activity: false, area_id: area[0], area_name: area[1], floor_id: 'ha_p', floor_name: 'Parking', bulk_excluded: null, ...extra };
}

const PARK: [string, string] = ['parking', 'חניון'];
const RAMP: [string, string] = ['ramp', 'רמפה'];
// the owner's case: relays (switch.*) typed as lights, an on/off-only light (a relay shown as a light), one real dimmer, one plain switch
const LIGHTS = [
  row('switch.parking_row_a', 'תאורת חניון שורה א', 'on', PARK, { activity_kind: 'light', dimmable: false }),
  row('switch.parking_row_b', 'תאורת חניון שורה ב', 'off', PARK, { activity_kind: 'light', dimmable: false }),
  row('light.parking_relay', 'תאורת מעבר (ממסר)', 'on', PARK, { brightness_pct: null, color_mode: 'onoff', dimmable: false }),
  row('light.ramp_dimmer', 'תאורת רמפה מעומעמת', 'on', RAMP, { brightness_pct: 60, color_mode: 'brightness', dimmable: true }),
];
const PLAIN = [row('switch.parking_fan', 'מפוח אוורור', 'on', PARK, { bulk_protected: false, bulk_reason: 'allowed' })];

function tree() {
  const area = (area_id: string, name: string, floor_id: string, c: Record<string, number | string | null>) => ({ area_id, name, icon: null, floor_id, counts: counts(c), has_camera: false, can_bulk: true, climate: [], temperature: 23, open_count: 0 });
  const floor = (floor_id: string, name: string, level: number, areas: ReturnType<typeof area>[]) => ({ floor_id, name, level, icon: null, areas, counts: counts(), can_bulk: true, climate: [] });
  return {
    floors: [
      floor('ha_1', 'Level one', 1, [area('office', 'משרדים', 'ha_1', { entities: 4, lights: 3, lights_on: 1 })]),
      floor('ha_0', 'Ground', 0, [area('lobby', 'לובי', 'ha_0', { entities: 5, lights: 4, lights_on: 4 })]),
      floor('ha_p', 'Parking', -1, [
        area('parking', 'חניון', 'ha_p', { entities: 4, lights: 3, lights_on: 2, switches: 1, switches_on: 1, switch_entities: 1, switch_entities_on: 1 }),
        area('ramp', 'רמפה', 'ha_p', { entities: 1, lights: 1, lights_on: 1 }),
      ]),
    ],
    unassigned: { area_id: 'unassigned', name: 'ללא שיוך', counts: counts() },
    building: counts({ entities: 14, lights: 11, lights_on: 8, switches: 1, switches_on: 1, switch_entities: 1, switch_entities_on: 1 }),
    building_climate: [],
    scoped: false,
    can_bulk: true,
    sync: SYNC,
  };
}

const fl = (id: string, name: string, level: number, i: number) => ({ id, building_id: 'b1', name, level, sort_order: i, ha_area_id: null, has_plan: true, published_version_id: 'v', plan_width_px: 1000, plan_height_px: 700, draft_version_id: null, anchor_count: 3, camera_count: 2, updated_at: '' });
const SITES = { sites: [{ id: 's1', name: 'אתר בדיקה', address: '', timezone: 'Asia/Jerusalem', sort_order: 0, updated_at: '', buildings: [{ id: 'b1', site_id: 's1', name: 'מבנה בדיקה', sort_order: 0, updated_at: '', floors: [fl('f1', 'קומה 1', 1, 2), fl('f0', 'קרקע', 0, 1), fl('fp', 'חניון', -1, 0)] }] }], can_create_site: false };

function areaDetail() {
  const lighting = LIGHTS.filter((r) => r.domain === 'light' && r.area_id === 'parking');
  const switches = [...LIGHTS.filter((r) => r.domain === 'switch'), ...PLAIN];
  const card = (id: string, label: string, entities: Record<string, unknown>[]) => ({ id, label, entities, count: entities.length, active: entities.filter((e) => e.active).length });
  const empty = (id: string, label: string) => card(id, label, []);
  return {
    area: { area_id: 'parking', name: 'חניון', icon: null, floor_id: 'ha_p', floor_name: 'Parking', level: -1 },
    floor_areas: [{ area_id: 'parking', name: 'חניון', icon: null, counts: counts({ entities: 4 }) }],
    cards: {
      lighting: card('lighting', 'תאורה', [...lighting, { ...LIGHTS[3], area_id: 'parking' }]),
      switches: card('switches', 'מתגים', switches),
      climate: empty('climate', 'מיזוג'), heating: empty('heating', 'חימום'), covers: empty('covers', 'תריסים'), security: empty('security', 'אבטחה'), media: empty('media', 'מסכים ונגנים'), sensors: empty('sensors', 'חיישנים'),
    },
    counts: counts({ entities: 4, lights: 3, lights_on: 2, switches: 1, switches_on: 1 }),
    scoped: false,
    can_bulk: true,
    sync: SYNC,
  };
}

interface MockState { items: string[]; previews: string[]; runs: Record<string, unknown>[]; actions: string[] }

async function mockApi(page: Page, xs: Record<string, unknown> = {}): Promise<MockState> {
  const st: MockState = { items: [], previews: [], runs: [], actions: [] };
  await page.route('**/api/v1/**', (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.start_route': 'devices', 'ui.design': 'a', 'ui.xs': { ...XS, ...xs } }, can_edit: false });
    if (p === 'sites') return json(SITES);
    if (p === 'devices/tree') return json(tree());
    if (p === 'devices/areas/parking') return json(areaDetail());
    if (p === 'devices/items') {
      st.items.push(url.search);
      const all = url.searchParams.get('switches') === 'all';
      const rows = [...LIGHTS, ...(all ? PLAIN : [])];
      const areas = [PARK, RAMP].map(([id, name]) => ({ area_id: id, name, items: rows.filter((r) => r.area_id === id) })).filter((a) => a.items.length);
      const on = rows.filter((r) => r.active).length;
      return json({ kind: 'lights', scope: url.searchParams.get('scope'), id: url.searchParams.get('id') ?? '*', name: 'Parking', floor_name: null, counts: { total: rows.length, active: on, inactive: rows.length - on, unavailable: 0 }, floors: [{ floor_id: 'ha_p', name: 'Parking', level: -1, areas }], truncated: false, scoped: false, can_bulk: true, sync: SYNC });
    }
    if (p === 'devices/actions/preview') {
      st.previews.push(url.search);
      const only = (url.searchParams.get('only') ?? '').split(',').filter(Boolean);
      const kind = url.searchParams.get('kind') ?? '';
      const pool = [...LIGHTS, ...(url.searchParams.get('switches') === 'all' ? PLAIN : [])].filter((r) => !only.length || only.includes(r.entity_id));
      const targets = pool.filter((r) => (kind === 'lights_off' ? r.active : !r.active)).map((r) => ({ entity_id: r.entity_id, name: r.name, domain: r.domain, area_name: r.area_name, action_id: `${r.domain}.${kind === 'lights_off' ? 'turn_off' : 'turn_on'}` }));
      const by: Record<string, number> = {};
      for (const t of targets) by[t.domain] = (by[t.domain] ?? 0) + 1;
      return json({ scope: url.searchParams.get('scope'), id: url.searchParams.get('id'), name: 'Parking', floor_name: null, kind, kind_label: kind === 'lights_off' ? 'כיבוי תאורה' : 'הדלקת תאורה', count: targets.length, targets, by_domain: by, domain_labels: { light: 'תאורה', switch: 'מתגים' }, skipped: { already: pool.length - targets.length, unavailable: 0 }, excluded: [], never_included: {}, digest: 'dg1', note: '', server_time_ms: Date.now() });
    }
    if (p === 'devices/actions' && req.method() === 'POST') {
      const body = req.postDataJSON() as Record<string, unknown>;
      st.runs.push(body);
      const only = (body.only as string[] | undefined) ?? [];
      const pool = [...LIGHTS, ...(body.switches === 'all' ? PLAIN : [])].filter((r) => !only.length || only.includes(r.entity_id)).filter((r) => (body.kind === 'lights_off' ? r.active : !r.active));
      // one relay does not report back: the result names it (a partial failure per device)
      const items = pool.map((r, i) => ({ entity_id: r.entity_id, name: r.name, domain: r.domain, area_name: r.area_name, action_id: `${r.domain}.turn_off`, outcome: i === 0 ? 'not_confirmed' : 'confirmed', status: 'done', error: null, observed_state: null, expected_state: null, sent: true }));
      const c = { queued: 0, accepted: 0, confirmed: items.length - 1, sent: 0, not_confirmed: 1, refused: 0, unknown: 0, total: items.length };
      return json({ id: 'bk1', scope: body.scope, scope_id: body.id, scope_name: 'Parking', kind: body.kind, kind_label: 'כיבוי תאורה', status: 'done', done: true, all_confirmed: false, counts: c, items, note: '' }, 202);
    }
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-11-01T00:00:00Z', version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', nvr_configured: true, mode: 'full', discovery: { cameras: 0, cameras_last_ok: null, cameras_last_error: null }, events: { ingest: { connected: true, last_error: null } } });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json({ unread: 0, items: [] });
    const act = p.match(/^ha\/entities\/([^/]+)\/actions$/);
    if (act && req.method() === 'POST') {
      st.actions.push(`${decodeURIComponent(act[1])}:${(req.postDataJSON() as { action_id?: string }).action_id ?? ''}`);
      return json({ id: 'a1', status: 'confirmed', phase: 'confirmed', state: 'off' }, 202);
    }
    return json(NOT_FOUND, 404);
  });
  return st;
}

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(900);
}

async function shot(page: Page, name: string, project: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${project}.png`) });
}

const panel = (page: Page, floor = 'fp') => page.locator(`devices-tiles-panel[data-floor-lights="${floor}"]`);

test.describe('the floor lights popup (synoptic board)', () => {
  test('a press on the lights count opens every light of the floor, grouped by area; a slider only for the dimmer; all-off confirms and reports per device', async ({ page }, info) => {
    const st = await mockApi(page);
    await open(page, '/devices/synoptic');
    await expect(page.locator('[data-syn-board]')).toBeVisible();
    // the parking floor: 4 lights counted (3 + the ramp), 3 on - the relays typed as lights are in the count
    const hit = page.locator('[data-syn-lights="fp"]');
    await expect(hit).toContainText('3/4');
    await hit.click();
    const p = panel(page);
    await expect(p.locator('sw-drawer')).toHaveAttribute('heading', 'תאורה · חניון');
    await expect(p.locator('.row[data-entity]')).toHaveCount(4);
    expect(st.items.at(-1)).toContain('scope=floor');
    expect(st.items.at(-1)).toContain('id=ha_p');
    expect(st.items.at(-1)).not.toContain('switches=all');
    await expect(p.locator('[data-panel-area="parking"] .row')).toHaveCount(3);
    await expect(p.locator('[data-panel-area="ramp"] .row')).toHaveCount(1);
    // every row has its toggle; only the real dimmer has a brightness slider
    await expect(p.locator('.row sw-toggle[data-control="power"]')).toHaveCount(4);
    await expect(p.locator('input[data-control="brightness"]')).toHaveCount(1);
    await expect(p.locator('.row[data-entity="light.ramp_dimmer"] input[data-control="brightness"]')).toHaveCount(1);
    for (const id of ['switch.parking_row_a', 'switch.parking_row_b', 'light.parking_relay']) await expect(p.locator(`.row[data-entity="${id}"] input[type="range"]`)).toHaveCount(0);
    // the two actions
    const paired = p.locator('[data-paired]');
    await expect(paired.locator('sw-button')).toHaveText(['הדלק הכל', 'כבה הכל']);
    await page.waitForTimeout(300);
    await shot(page, 'syn-popup', info.project.name);
    // "כבה הכל": the confirmation states the count, then the result names the device that did not confirm
    await paired.locator('sw-button[data-master="lights_off"]').click();
    const dlg = p.locator('devices-bulk-dialog');
    await expect(dlg.locator('[data-bulk-count]')).toHaveAttribute('data-bulk-count', '3');
    await expect(dlg.locator('sw-button[data-bulk-confirm]')).toContainText('(3)');
    expect(st.previews.at(-1)).toContain('kind=lights_off');
    expect(decodeURIComponent(st.previews.at(-1)!)).toContain('only=switch.parking_row_a,switch.parking_row_b,light.parking_relay,light.ramp_dimmer');
    await shot(page, 'syn-popup-confirm', info.project.name);
    await dlg.locator('sw-button[data-bulk-confirm]').click();
    await expect(dlg.locator('[data-outcome="not_confirmed"]')).toHaveCount(1);
    expect(st.runs.at(-1)).toMatchObject({ scope: 'floor', id: 'ha_p', kind: 'lights_off', confirmed: true });
    await shot(page, 'syn-popup-partial', info.project.name);
    // Escape closes (the bulk dialog first, then the popup)
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(p.locator('sw-drawer')).not.toHaveAttribute('open', '');
  });

  test('"כל המפסקים": the column counts the plain switch too, the popup lists it (no slider) and the actions reach it', async ({ page }, info) => {
    const st = await mockApi(page, { syn_switches: 'all' });
    await open(page, '/devices/synoptic');
    const hit = page.locator('[data-syn-lights="fp"]');
    await expect(hit).toContainText('4/5');
    await hit.click();
    const p = panel(page);
    await expect(p.locator('.row[data-entity]')).toHaveCount(5);
    expect(st.items.at(-1)).toContain('switches=all');
    await expect(p.locator('.row[data-entity="switch.parking_fan"] sw-toggle[data-control="power"]')).toHaveCount(1);
    await expect(p.locator('.row[data-entity="switch.parking_fan"] input[type="range"]')).toHaveCount(0);
    await p.locator('[data-paired] sw-button[data-master="lights_off"]').click();
    await expect(p.locator('devices-bulk-dialog [data-bulk-count]')).toHaveAttribute('data-bulk-count', '4');
    expect(st.previews.at(-1)).toContain('switches=all');
    await shot(page, 'syn-popup-all-switches', info.project.name);
  });

  test('keyboard: the selected floor offers the popup as a button; Escape closes it', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'a keyboard path');
    await mockApi(page);
    await open(page, '/devices/synoptic');
    await page.locator('[data-syn-row="fp"]').click();
    const btn = page.locator('sw-button[data-syn-lights-open="fp"]');
    await expect(btn).toBeVisible();
    await btn.locator('button').focus();
    await page.keyboard.press('Enter');
    await expect(panel(page).locator('.row[data-entity]')).toHaveCount(4);
    await page.keyboard.press('Escape');
    await expect(panel(page).locator('sw-drawer')).not.toHaveAttribute('open', '');
  });
});

test.describe('the floor lights popup (cross-section)', () => {
  test('a press on the floor\'s lights strip opens the popup; elsewhere on the row it still selects the floor', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the section beside the floor cards is a computer layout');
    await mockApi(page);
    await open(page, '/explore/buildings/b1/floors');
    const row = page.locator('[data-xs-row="fp"]');
    await expect(row).toHaveAttribute('data-xs-lights', '');
    await row.locator('.t').click();
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await expect(panel(page).locator('sw-drawer')).not.toHaveAttribute('open', '');
    await row.locator('.fac').click();
    await expect(panel(page).locator('.row[data-entity]')).toHaveCount(4);
    await page.waitForTimeout(300);
    await shot(page, 'xs-popup', info.project.name);
  });
});

test.describe('the brightness slider on the area screen', () => {
  test('lighting card: the dimmer has a slider, the on/off-only light has none; the relays typed as lights stay on/off switches', async ({ page }, info) => {
    await mockApi(page);
    await page.addInitScript(() => {
      try {
        localStorage.setItem('sw.devices.layout', 'cards');
      } catch {
        /* storage unavailable */
      }
    });
    await open(page, '/devices/areas/parking');
    const tile = (id: string) => page.locator(`[data-entity="${id}"]`).first();
    await expect(tile('light.ramp_dimmer')).toBeVisible({ timeout: 15000 });
    await expect(tile('light.ramp_dimmer').locator('input[data-control="brightness"]')).toHaveCount(1);
    await expect(tile('light.parking_relay').locator('input[data-control="brightness"]')).toHaveCount(0);
    for (const id of ['switch.parking_row_a', 'switch.parking_row_b', 'switch.parking_fan']) await expect(tile(id).locator('input[data-control="brightness"]')).toHaveCount(0);
    await page.waitForTimeout(300);
    await shot(page, 'area-sliders', info.project.name);
  });
});
