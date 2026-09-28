import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Evidence for CR-007 slice 1 (חשמל והתקנים, read-only) against a running developer backend (SW_LIVE=1). The backend
// needs no Home Assistant: the HA floors, areas and entities are seeded through the dev-only registry / states
// endpoints (`POST /ha/dev/registry`, `POST /ha/dev/states`), the same writes the sync itself performs, so the tree
// and the area cards are exercised on a known structure. Every seeded id carries the `cr007_` prefix; the seed is
// idempotent (registries are rewritten whole) and is re-applied by each test. Run against a throwaway backend
// (`SW_API_PORT` for the preview proxy) rather than the owner's, since it rewrites the HA area / floor mirror.
// Slice 2 (single-entity control): most control tests mock the action route; the two "REAL action route" tests need
// tests/fixtures/devices_fake_ha.py as the backend (the real backend with a fake HA-side bridge) and SW_DEVICES_FIXTURE=1.

const HREF = '#/devices/building';
const RAIL = 'sw-app nav.rail';
const BOTTOM = 'sw-app nav.bottom';

const FLOORS = [
  { floor_id: 'cr007_upper', name: 'קומה 1', level: 1 },
  { floor_id: 'cr007_ground', name: 'קרקע', level: 0 },
  // slice 3 (bulk actions): a floor of its own, so a bulk action never changes what the other tests look at
  { floor_id: 'cr007_annex', name: 'אגף', level: 2 },
];
const AREAS = [
  { area_id: 'cr007_office', name: 'משרד', floor_id: 'cr007_upper', icon: 'mdi:desk' },
  { area_id: 'cr007_lobby', name: 'לובי', floor_id: 'cr007_ground', icon: 'mdi:sofa' },
  { area_id: 'cr007_storage', name: 'מחסן', floor_id: 'cr007_ground' },
  { area_id: 'cr007_hall', name: 'אולם', floor_id: 'cr007_annex' },
  { area_id: 'cr007_den', name: 'חדר ישיבות', floor_id: 'cr007_annex' },
];
const HALL = ['light.cr007_hall_a', 'light.cr007_hall_b', 'cover.cr007_hall', 'lock.cr007_hall_door', 'media_player.cr007_hall_tv'];
const DEN = ['light.cr007_den', 'light.cr007_den_stuck', 'climate.cr007_den'];
const LOBBY = [
  'light.cr007_lobby', 'light.cr007_lobby_2', 'switch.cr007_sign', 'climate.cr007_lobby', 'cover.cr007_blind', 'lock.cr007_front', 'binary_sensor.cr007_door', 'camera.cr007_lobby', 'media_player.cr007_tv', 'sensor.cr007_temp', 'alarm_control_panel.cr007_house',
  // CR-007 slice 4: a second sensor group and a non-security binary sensor, for the sensors card's own grouping
  'sensor.cr007_power', 'binary_sensor.cr007_moist',
];
const ENTITIES = [
  ...LOBBY.map((entity_id) => ({ entity_id, area_id: 'cr007_lobby' })),
  { entity_id: 'light.cr007_office', area_id: 'cr007_office' },
  { entity_id: 'cover.cr007_office', area_id: 'cr007_office' },
  { entity_id: 'switch.cr007_loose', area_id: null },
  ...HALL.map((entity_id) => ({ entity_id, area_id: 'cr007_hall' })),
  ...DEN.map((entity_id) => ({ entity_id, area_id: 'cr007_den' })),
];
const STATES = [
  { entity_id: 'light.cr007_lobby', state: 'on', attributes: { friendly_name: 'תאורת לובי', brightness: 128 } },
  { entity_id: 'light.cr007_lobby_2', state: 'off', attributes: { friendly_name: 'ספוט לובי' } },
  { entity_id: 'switch.cr007_sign', state: 'on', attributes: { friendly_name: 'שלט מואר' } },
  {
    entity_id: 'climate.cr007_lobby',
    state: 'cool',
    attributes: {
      friendly_name: 'מזגן לובי', current_temperature: 25.5, temperature: 22, hvac_action: 'cooling', fan_mode: 'auto', hvac_modes: ['off', 'cool', 'heat', 'fan_only'], fan_modes: ['auto', 'low', 'high'], min_temp: 16, max_temp: 30,
      // CR-007 slice 4: preset / swing / humidity - only what this entity itself reports
      preset_mode: 'none', preset_modes: ['none', 'eco', 'boost'], swing_mode: 'off', swing_modes: ['off', 'vertical'], humidity: 50, min_humidity: 30, max_humidity: 80,
    },
  },
  { entity_id: 'cover.cr007_blind', state: 'open', attributes: { friendly_name: 'תריס לובי', current_position: 70, current_tilt_position: 40, device_class: 'blind' } },
  { entity_id: 'lock.cr007_front', state: 'locked', attributes: { friendly_name: 'דלת ראשית', device_class: 'lock' } },
  { entity_id: 'binary_sensor.cr007_door', state: 'off', attributes: { friendly_name: 'מגע דלת', device_class: 'door' } },
  { entity_id: 'camera.cr007_lobby', state: 'idle', attributes: { friendly_name: 'מצלמת לובי' } },
  { entity_id: 'media_player.cr007_tv', state: 'playing', attributes: { friendly_name: 'טלוויזיה לובי', media_title: 'חדשות', source: 'HDMI 1', volume_level: 0.4 } },
  { entity_id: 'sensor.cr007_temp', state: '23.5', attributes: { friendly_name: 'טמפרטורת לובי', unit_of_measurement: '°C', device_class: 'temperature' } },
  { entity_id: 'sensor.cr007_power', state: '120', attributes: { friendly_name: 'צריכת לובי', unit_of_measurement: 'W', device_class: 'power' } },
  { entity_id: 'binary_sensor.cr007_moist', state: 'off', attributes: { friendly_name: 'לחות רצפה', device_class: 'moisture' } },
  { entity_id: 'alarm_control_panel.cr007_house', state: 'armed_away', attributes: { friendly_name: 'אזעקה' } },
  { entity_id: 'light.cr007_office', state: 'off', attributes: { friendly_name: 'תאורת משרד' } },
  { entity_id: 'cover.cr007_office', state: 'closed', attributes: { friendly_name: 'תריס משרד', current_position: 0 } },
  { entity_id: 'switch.cr007_loose', state: 'off', attributes: { friendly_name: 'מתג ללא אזור' } },
  { entity_id: 'light.cr007_hall_a', state: 'on', attributes: { friendly_name: 'תאורת אולם א' } },
  { entity_id: 'light.cr007_hall_b', state: 'on', attributes: { friendly_name: 'תאורת אולם ב' } },
  { entity_id: 'cover.cr007_hall', state: 'open', attributes: { friendly_name: 'תריס אולם', current_position: 100, device_class: 'shutter' } },
  { entity_id: 'lock.cr007_hall_door', state: 'locked', attributes: { friendly_name: 'דלת אולם', device_class: 'lock' } },
  { entity_id: 'media_player.cr007_hall_tv', state: 'on', attributes: { friendly_name: 'מסך אולם' } },
  { entity_id: 'light.cr007_den', state: 'on', attributes: { friendly_name: 'תאורת חדר ישיבות' } },
  // the fixture bridge accepts every call to an id containing "_stuck" and never reports its effect
  { entity_id: 'light.cr007_den_stuck', state: 'on', attributes: { friendly_name: 'ספוט תקוע' } },
  { entity_id: 'climate.cr007_den', state: 'cool', attributes: { friendly_name: 'מזגן חדר ישיבות', hvac_modes: ['off', 'cool'] } },
];

test.describe('Electricity and devices (CR-007 slice 1 read-only, slice 2 single-entity control)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function seed(request: APIRequestContext) {
    const reg = await request.post('/api/v1/ha/dev/registry', { data: { entities: ENTITIES, devices: [], areas: AREAS, floors: FLOORS } });
    expect(reg.status(), 'dev registry seed (developer identity mode only)').toBe(200);
    const st = await request.post('/api/v1/ha/dev/states', { data: { states: STATES } });
    expect(st.status()).toBe(200);
  }

  async function setState(request: APIRequestContext, entity_id: string, state: string, attributes: Record<string, unknown> = {}) {
    const r = await request.post('/api/v1/ha/dev/states', { data: { states: [{ entity_id, state, attributes }] } });
    expect(r.status()).toBe(200);
  }

  /** Owner feedback on 0.1.115: the building screen opens on the mockup's tree + floor cards by default; the slice-1/2
   * tests were written against the tiles presentation and choose it explicitly (an init script, before navigation). */
  async function useLayout(page: Page, layout: 'cards' | 'tiles') {
    await page.addInitScript((l) => {
      try {
        localStorage.setItem('sw.devices.layout', l);
      } catch {
        /* storage unavailable */
      }
    }, layout);
  }

  test.beforeEach(async ({ page }) => {
    await useLayout(page, 'tiles');
  });

  async function open(page: Page, hash: string, design: 'a' | 'b' = 'a') {
    await page.goto(`/?design=${design}#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1200);
  }

  async function bindUser(request: APIRequestContext, username: string, roleId: string): Promise<string> {
    const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': username } })).json();
    const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: roleId, scope_type: 'installation', scope_id: '*' } });
    expect(r.status()).toBeLessThan(300);
    return ((await r.json()) as { id: string }).id;
  }

  test('the building tree: floors in level order, area tiles with counts, building KPIs and the unassigned bucket', async ({ page, request }) => {
    await seed(request);
    const tree = await (await request.get('/api/v1/devices/tree')).json();
    const ids = (tree.floors as { floor_id: string }[]).map((f) => f.floor_id);
    expect(ids.indexOf('cr007_ground')).toBeLessThan(ids.indexOf('cr007_upper')); // level 0 before level 1
    await open(page, '/devices/building', 'a');
    const screen = page.locator('devices-building');
    await expect(screen.locator('section[data-floor="cr007_ground"]')).toBeVisible({ timeout: 30000 });
    // floors in level order on screen too
    const floors = await screen.locator('section[data-floor]').evaluateAll((els) => els.map((e) => e.getAttribute('data-floor')));
    expect(floors.indexOf('cr007_ground')).toBeLessThan(floors.indexOf('cr007_upper'));
    expect(floors[floors.length - 1]).toBe('unassigned');
    // the lobby tile: warm (something is on), with per-kind counts
    const lobby = screen.locator('a.tile[data-area="cr007_lobby"]');
    await expect(lobby).toBeVisible();
    await expect(lobby).toHaveAttribute('data-on', 'true');
    const counts = (await lobby.getAttribute('data-counts')) ?? '';
    expect(counts).toMatch(/lights:1\/2/);
    expect(counts).toMatch(/switches:1\/1/);
    expect(counts).toMatch(/covers:1\/1/);
    expect(counts).toMatch(/climate:1\/1/);
    expect(counts).toMatch(/media:1\/1/);
    expect(counts).toMatch(/locks:1\/1/);
    expect(counts).toMatch(/cameras:1/);
    await expect(lobby).toContainText('לובי');
    // an area with nothing in it is still a tile, honest about it
    const storage = screen.locator('a.tile[data-area="cr007_storage"]');
    await expect(storage).toHaveAttribute('data-on', 'false');
    await expect(storage).toContainText('אין התקנים');
    // the office (upper floor): nothing on
    await expect(screen.locator('a.tile[data-area="cr007_office"]')).toHaveAttribute('data-on', 'false');
    // the unassigned bucket carries the loose switch
    await expect(screen.locator('a.tile[data-area="unassigned"]')).toHaveAttribute('data-counts', /switches:0\/1/);
    // building KPIs: what the API counts over the whole installation (other seeded entities may exist on this backend)
    const b = tree.building as Record<string, number>;
    await expect(screen.locator('sw-kpi[data-kpi="תאורה דולקת"]')).toHaveAttribute('data-value', `${b.lights_on}/${b.lights}`);
    await expect(screen.locator('sw-kpi[data-kpi="תריסים פתוחים"]')).toHaveAttribute('data-value', `${b.covers_open}/${b.covers}`);
    await expect(screen.locator('sw-kpi[data-kpi="אזעקה"]')).toBeVisible();
    // nothing on this screen controls one device; the only buttons are the bulk actions (slice 3: the header buttons
    // and the "⋯" triggers, each of which opens the confirmation dialog - the admin holds devices.control_bulk)
    await expect(screen.locator('input, sw-toggle')).toHaveCount(0);
    await expect(screen.locator('sw-button:visible:not([data-bulk-kind]):not([data-bulk-trigger])')).toHaveCount(0);
    // a tile opens the area screen
    await lobby.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/areas/cr007_lobby');
    await expect(page.locator('devices-area sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
  });

  test('the area screen: cards per domain with the fields each needs, empty states after the filled cards, sibling chips, one-tap controls for a devices.control holder', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/areas/cr007_lobby', 'a');
    const screen = page.locator('devices-area');
    await expect(screen.locator('sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
    // lighting: a lit light is a warm tile with its brightness, an unlit one is plain; both carry a power toggle
    // (the default identity here is the bootstrap system_admin, who holds devices.control installation-wide - CR-007 slice 2)
    const lit = screen.locator('.tile[data-entity="light.cr007_lobby"]');
    await expect(lit).toHaveClass(/\bon\b/);
    await expect(lit).toContainText('50%');
    await expect(lit).toHaveAttribute('data-can-control', '');
    await expect(lit.locator('sw-toggle[data-control="power"]')).toBeVisible();
    await expect(lit.locator('input[data-control="brightness"]')).toBeVisible();
    const litOff = screen.locator('.tile[data-entity="light.cr007_lobby_2"]');
    await expect(litOff).toHaveClass(/\boff\b/);
    await expect(litOff).toContainText('כבוי');
    await expect(litOff.locator('sw-toggle[data-control="power"]')).toBeVisible();
    await expect(litOff.locator('input[data-control="brightness"]')).toHaveCount(0); // brightness only shown while on
    // climate: current and target temperature, mode and action, plus temp +/- and a mode select
    const clim = screen.locator('.row[data-entity="climate.cr007_lobby"]');
    await expect(clim).toContainText('25.5');
    await expect(clim).toContainText('קירור');
    await expect(clim).toContainText('מקרר');
    await expect(clim).toContainText('22');
    await expect(clim.locator('[data-control="temp-up"]')).toBeVisible();
    await expect(clim.locator('select[data-control="mode"]')).toBeVisible();
    // cover: state with position and a bar, plus open/stop/close and a position slider
    const cover = screen.locator('.row[data-entity="cover.cr007_blind"]');
    await expect(cover).toContainText('פתוח');
    await expect(cover).toContainText('70%');
    await expect(cover.locator('.bar i')).toHaveAttribute('style', /70%/);
    await expect(cover.locator('sw-button[data-control="open"]')).toBeVisible();
    await expect(cover.locator('sw-button[data-control="stop"]')).toBeVisible();
    await expect(cover.locator('sw-button[data-control="close"]')).toBeVisible();
    await expect(cover.locator('input[data-control="position"]')).toBeVisible();
    // security: lock badge, door contact, alarm, and the HA camera row (no still served here yet) - never a control here
    await expect(screen.locator('.row[data-entity="lock.cr007_front"] sw-badge')).toHaveAttribute('label', 'נעול');
    await expect(screen.locator('.row[data-entity="binary_sensor.cr007_door"] sw-badge')).toHaveAttribute('label', 'סגורה');
    await expect(screen.locator('.row[data-entity="alarm_control_panel.cr007_house"] sw-badge')).toHaveAttribute('label', /דרוכה/);
    await expect(screen.locator('.row[data-entity="camera.cr007_lobby"]')).toContainText('אין תמונה');
    await expect(screen.locator('.row[data-entity="lock.cr007_front"] sw-button, .row[data-entity="lock.cr007_front"] sw-toggle')).toHaveCount(0);
    await expect(screen.locator('.row[data-entity="alarm_control_panel.cr007_house"] sw-button, .row[data-entity="alarm_control_panel.cr007_house"] sw-toggle')).toHaveCount(0);
    await expect(screen.locator('sw-badge[data-area-alarm]')).toBeVisible();
    // media and sensors: media gets power/play-pause/mute, sensors never a control
    const tv = screen.locator('.row[data-entity="media_player.cr007_tv"]');
    await expect(tv).toContainText('מנגן');
    await expect(tv).toContainText('HDMI 1');
    await expect(tv).toContainText('40%');
    await expect(tv.locator('sw-toggle[data-control="power"]')).toBeVisible();
    await expect(tv.locator('sw-button[data-control="playpause"]')).toBeVisible();
    await expect(tv.locator('sw-button[data-control="mute"]')).toBeVisible();
    const temp = screen.locator('.tile[data-entity="sensor.cr007_temp"]');
    await expect(temp).toContainText('23.5 °C');
    await expect(temp.locator('sw-toggle, sw-button, input')).toHaveCount(0);
    // chips of the same floor, the current one selected; the empty storage area is one of them
    await expect(screen.locator('sw-chip[data-area-chip="cr007_lobby"]')).toHaveAttribute('selected', '');
    await expect(screen.locator('sw-chip[data-area-chip="cr007_storage"]')).toHaveCount(1);
    await expect(screen.locator('sw-chip[data-area-chip="cr007_office"]')).toHaveCount(0); // another floor
    // breadcrumb back to the tree
    await expect(page.locator('devices-area sw-page')).toHaveAttribute('crumbs', /חשמל והתקנים \| קרקע \| לובי/);

    // the empty area: every card is there and says what is missing (DomusUI's empty-state copy, in Hebrew)
    await screen.locator('sw-chip[data-area-chip="cr007_storage"]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/areas/cr007_storage');
    await expect(screen.locator('sw-card[data-card="climate"] [data-card-empty]')).toBeVisible({ timeout: 30000 });
    await expect(screen.locator('sw-card[data-card="climate"] [data-card-empty]')).toHaveAttribute('heading', 'אין התקן מיזוג באזור הזה');
    await expect(screen.locator('sw-card[data-card="lighting"] [data-card-empty]')).toHaveAttribute('heading', 'אין תאורה באזור הזה');
    await expect(screen.locator('sw-card[data-empty]')).toHaveCount(7);

    // the office: filled cards (lighting, covers) come first, the empty ones after
    await open(page, '/devices/areas/cr007_office', 'a');
    await expect(screen.locator('sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
    const order = await screen.locator('sw-card[data-card]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-card')}:${e.hasAttribute('data-empty') ? 'empty' : 'filled'}`));
    expect(order.slice(0, 2).sort()).toEqual(['covers:filled', 'lighting:filled']);
    expect(order.slice(2).every((x) => x.endsWith(':empty'))).toBe(true);
    // and the unassigned bucket is an area screen of its own
    await open(page, '/devices/areas/unassigned', 'a');
    await expect(screen.locator('.tile[data-entity="switch.cr007_loose"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('devices-area sw-page')).toHaveAttribute('heading', 'ללא שיוך');
  });

  test('live refresh: a state change pushed on /ha/ws refetches the area and the tree', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/areas/cr007_lobby', 'a');
    const tile = page.locator('devices-area .tile[data-entity="light.cr007_lobby_2"]');
    await expect(tile).toHaveClass(/\boff\b/, { timeout: 30000 });
    await setState(request, 'light.cr007_lobby_2', 'on', { friendly_name: 'ספוט לובי', brightness: 255 });
    await expect(tile).toHaveClass(/\bon\b/, { timeout: 10000 });
    await expect(tile).toContainText('100%');
    // the tree follows the same push
    await open(page, '/devices/building', 'a');
    const lobby = page.locator('devices-building a.tile[data-area="cr007_lobby"]');
    await expect(lobby).toHaveAttribute('data-counts', /lights:2\/2/, { timeout: 30000 });
    await setState(request, 'light.cr007_lobby_2', 'off', { friendly_name: 'ספוט לובי' });
    await setState(request, 'light.cr007_lobby', 'off', { friendly_name: 'תאורת לובי' });
    await expect(lobby).toHaveAttribute('data-counts', /lights:0\/2/, { timeout: 10000 });
    await setState(request, 'light.cr007_lobby', 'on', { friendly_name: 'תאורת לובי', brightness: 128 });
  });

  test('a burst of pushes faster than the refresh window still refetches (throttle, not a starving debounce)', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/areas/cr007_lobby', 'a');
    const tile = page.locator('devices-area .tile[data-entity="light.cr007_lobby_2"]');
    await expect(tile).toHaveClass(/\boff\b/, { timeout: 30000 });
    await page.waitForTimeout(800); // let the initial load and any push from the seed settle
    const fetches: number[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/v1/devices/areas/cr007_lobby')) fetches.push(Date.now());
    });
    // 24 pushes about this area's own entities, ~60 ms apart (~1.5 s): well inside a 400 ms window every time
    const t0 = Date.now();
    for (let i = 0; i < 24; i++) {
      await setState(request, i % 2 ? 'sensor.cr007_temp' : 'light.cr007_lobby_2', i % 2 ? `${20 + (i % 7)}.5` : 'on', i % 2 ? { friendly_name: 'טמפרטורת לובי', unit_of_measurement: '°C', device_class: 'temperature' } : { friendly_name: 'ספוט לובי', brightness: 255 });
      await page.waitForTimeout(60);
    }
    const burstMs = Date.now() - t0;
    // a refetch happened WHILE the burst was still running - a resetting debounce would have fired none
    await expect.poll(() => fetches.filter((t) => t - t0 < burstMs).length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
    await expect(tile).toHaveClass(/\bon\b/, { timeout: 10000 });
    // and it was coalesced: far fewer requests than pushes
    await page.waitForTimeout(1000);
    expect(fetches.length).toBeLessThan(12);
    // a push about another area's entity does not refetch this one
    const before = fetches.length;
    await setState(request, 'light.cr007_office', 'on', { friendly_name: 'תאורת משרד' });
    await page.waitForTimeout(1200);
    expect(fetches.length).toBe(before);
    await setState(request, 'light.cr007_office', 'off', { friendly_name: 'תאורת משרד' });
    await setState(request, 'light.cr007_lobby_2', 'off', { friendly_name: 'ספוט לובי' });
    await setState(request, 'sensor.cr007_temp', '23.5', { friendly_name: 'טמפרטורת לובי', unit_of_measurement: '°C', device_class: 'temperature' });
  });

  test('a floor-scoped viewer sees only their floors, a viewer with nothing placed sees the scoped empty state, and no HA structure at all is said plainly', async ({ page, browser, request }, testInfo) => {
    await seed(request);
    const tag = testInfo.project.name;
    const bindings: string[] = [];
    let siteId: string | undefined;
    try {
      // a VMS site → building → two floors; the office light is anchored on floor A (needs a published plan)
      const site = await request.post('/api/v1/sites', { data: { name: `CR-007 scoped site (${tag})` } });
      expect(site.status()).toBe(201);
      siteId = ((await site.json()) as { id: string }).id;
      const building = await request.post(`/api/v1/sites/${siteId}/buildings`, { data: { name: 'CR-007 building' } });
      const buildingId = ((await building.json()) as { id: string }).id;
      const floorA = ((await (await request.post(`/api/v1/buildings/${buildingId}/floors`, { data: { name: 'CR-007 floor A', level: 1 } })).json()) as { id: string }).id;
      const floorB = ((await (await request.post(`/api/v1/buildings/${buildingId}/floors`, { data: { name: 'CR-007 floor B', level: 2 } })).json()) as { id: string }).id;
      const png = await (await request.get('/brand/smplwise-mark.png')).body();
      const asset = await request.post(`/api/v1/floors/${floorA}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } });
      expect(asset.status()).toBeLessThan(300);
      const version = await request.post(`/api/v1/floors/${floorA}/plan-versions`, { data: { asset_id: ((await asset.json()) as { id: string }).id } });
      expect(version.status()).toBeLessThan(300);
      expect((await request.post(`/api/v1/plan-versions/${((await version.json()) as { id: string }).id}/publish`)).status()).toBeLessThan(300);
      const anchor = await request.post(`/api/v1/floors/${floorA}/anchors`, { data: { resource_type: 'ha_entity', resource_id: 'light.cr007_office', x: 0.3, y: 0.3 } });
      expect(anchor.status()).toBe(201);

      for (const [username, floorId] of [[`cr007floorA${tag}`, floorA], [`cr007floorB${tag}`, floorB]] as const) {
        const headers = { 'X-SW-Dev-User': username };
        const me = await (await request.get('/api/v1/me', { headers })).json();
        const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: 'viewer', scope_type: 'floor', scope_id: floorId } });
        expect(r.status()).toBeLessThan(300);
        bindings.push(((await r.json()) as { id: string }).id);
      }
      // floor A's viewer: the entry is there (devices.read at floor scope counts), the tree holds only the office
      const ctxA = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': `cr007floorA${tag}` } });
      const pA = await ctxA.newPage();
      await useLayout(pA, 'tiles');
      await open(pA, '/devices/building', 'a');
      const screenA = pA.locator('devices-building');
      await expect(screenA.locator('a.tile[data-area="cr007_office"]')).toBeVisible({ timeout: 30000 });
      await expect(screenA.locator('a.tile[data-area="cr007_lobby"]')).toHaveCount(0);
      await expect(screenA.locator('section[data-floor="cr007_ground"]')).toHaveCount(0);
      await expect(screenA.locator('section[data-floor="unassigned"]')).toHaveCount(0);
      await expect(screenA.locator('sw-badge[label="לפי הקומות שלך"]')).toBeVisible();
      await expect(screenA.locator('a.tile[data-area="cr007_office"]')).toHaveAttribute('data-counts', /^lights:0\/1$/); // the office cover is not placed: not theirs
      await expect(pA.locator(`${RAIL} a[href="${HREF}"]`)).toHaveCount(1);
      await open(pA, '/devices/areas/cr007_lobby', 'a');
      await expect(pA.locator('devices-area sw-state-panel[data-devices-state="not_found"]')).toBeVisible({ timeout: 30000 });
      await ctxA.close();
      // floor B's viewer: nothing placed there - an honest empty tree, not a refusal
      const ctxB = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': `cr007floorB${tag}` } });
      const pB = await ctxB.newPage();
      await useLayout(pB, 'tiles');
      await open(pB, '/devices/building', 'a');
      const emptyB = pB.locator('devices-building sw-state-panel[data-devices-state="empty"]');
      await expect(emptyB).toBeVisible({ timeout: 30000 });
      await expect(emptyB).toHaveAttribute('heading', 'אין התקנים בקומות שלך');
      await expect(pB.locator('devices-building a.tile')).toHaveCount(0);
      await ctxB.close();
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      if (siteId) await request.delete(`/api/v1/sites/${siteId}`).catch(() => {});
    }

    // no floors or areas from Home Assistant at all (every entity unassigned): the admin sees the plain empty state
    const wipe = await request.post('/api/v1/ha/dev/registry', { data: { entities: ENTITIES.map((e) => ({ ...e, area_id: null })), devices: [], areas: [], floors: [] } });
    expect(wipe.status()).toBe(200);
    try {
      const other = await (await request.get('/api/v1/devices/tree')).json();
      test.skip(other.floors.length > 0, 'this backend holds HA areas beyond the cr007_ seed; the no-structure state cannot be shown here');
      await open(page, '/devices/building', 'a');
      const empty = page.locator('devices-building sw-state-panel[data-devices-state="empty"]');
      await expect(empty).toBeVisible({ timeout: 30000 });
      await expect(empty).toHaveAttribute('heading', 'אין קומות ואזורים מ־Home Assistant');
      await expect(page.locator('devices-building a.tile[data-area="unassigned"]')).toHaveAttribute('data-counts', /switches:/);
    } finally {
      await seed(request);
    }
  });

  test('the devices entry is gated on devices.read in both designs; the screen refuses without it', async ({ page, browser, request }, testInfo) => {
    await seed(request);
    const tag = testInfo.project.name;
    const bindings: string[] = [];
    let roleId: string | undefined;
    const noUser = `cr007no${tag}`;
    const viewerUser = `cr007viewer${tag}`;
    try {
      const role = await request.post('/api/v1/access/roles', { data: { name: `CR-007 no devices (${tag})`, description: 'evidence', permissions: ['map.read', 'video.live'] } });
      expect(role.status()).toBeLessThan(300);
      roleId = ((await role.json()) as { id: string }).id;
      bindings.push(await bindUser(request, noUser, roleId));
      const without = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': noUser } });
      const p1 = await without.newPage();
      await open(p1, '/live', 'a');
      await expect(p1.locator(`${RAIL} a[href="#/explore/sites"]`)).toHaveCount(1, { timeout: 30000 });
      await expect(p1.locator(`${RAIL} a[href="${HREF}"]`)).toHaveCount(0);
      await open(p1, '/devices/building', 'a');
      await expect(p1.locator('devices-building sw-state-panel[data-devices-state="no_permission"]')).toBeVisible({ timeout: 30000 });
      await open(p1, '/devices/areas/cr007_lobby', 'a');
      await expect(p1.locator('devices-area sw-state-panel[data-devices-state="no_permission"]')).toBeVisible({ timeout: 30000 });
      expect((await p1.request.get('/api/v1/devices/tree')).status()).toBe(403);
      expect((await p1.request.get('/api/v1/devices/areas/cr007_lobby')).status()).toBe(403);
      await open(p1, '/live', 'b');
      await expect(p1.locator(`${RAIL} a[href="${HREF}"]`)).toHaveCount(0);
      await without.close();

      // a plain viewer holds devices.read (like map.read)
      bindings.push(await bindUser(request, viewerUser, 'viewer'));
      const viewer = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': viewerUser } });
      const p2 = await viewer.newPage();
      await useLayout(p2, 'tiles');
      await open(p2, '/live', 'a');
      await expect(p2.locator(`${RAIL} a[href="${HREF}"]`)).toHaveCount(1, { timeout: 30000 });
      await expect(p2.locator(`${RAIL} a[href="${HREF}"]`)).toContainText('חשמל');
      await open(p2, '/live', 'b');
      await expect(p2.locator(`${RAIL} a[href="${HREF}"]`)).toContainText('חשמל והתקנים');
      await open(p2, '/devices/building', 'b');
      await expect(p2.locator('devices-building a.tile[data-area="cr007_lobby"]')).toBeVisible({ timeout: 30000 });
      await viewer.close();

      // the admin (dev-mode default identity) sees it in both designs
      await open(page, '/live', 'a');
      await expect(page.locator(`${RAIL} a[href="${HREF}"]`)).toHaveCount(1, { timeout: 30000 });
      await open(page, '/live', 'b');
      await expect(page.locator(`${RAIL} a[href="${HREF}"]`)).toHaveCount(1, { timeout: 30000 });
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      if (roleId) await request.delete(`/api/v1/access/roles/${roleId}`).catch(() => {});
    }
  });

  test('the phone bottom nav (design A) reaches the devices area directly, and the tree then the area screen fit the phone', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'nav.bottom only renders below the 768px breakpoint; other projects are wider');
    await seed(request);
    await open(page, '/live', 'a');
    const bottom = page.locator(BOTTOM);
    await expect(bottom).toBeVisible({ timeout: 30000 });
    const link = bottom.locator(`a[href="${HREF}"]`);
    await expect(link).toBeVisible();
    await expect(link).toContainText('חשמל');
    // six areas share the bar: no item may be pushed out of the viewport
    const box = await link.boundingBox();
    const vw = page.viewportSize()!.width;
    expect(box && box.x >= 0 && box.x + box.width <= vw + 1).toBe(true);
    await link.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(HREF);
    const lobby = page.locator('devices-building a.tile[data-area="cr007_lobby"]');
    await expect(lobby).toBeVisible({ timeout: 30000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await lobby.click();
    await expect(page.locator('devices-area sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    // the explicit way back (sw-page backHref) exists on the phone, where the browser's own back is not at hand
    await expect(page.locator('devices-area sw-page')).toHaveAttribute('backHref', '/devices/building');
  });

  test('the phone bottom nav (design B) reaches the devices area through the "עוד" overflow', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'nav.bottom only renders below the 768px breakpoint; other projects are wider');
    await seed(request);
    await open(page, '/live', 'b');
    const bottom = page.locator(BOTTOM);
    await expect(bottom).toBeVisible({ timeout: 30000 });
    await expect(bottom.locator(`a[href="${HREF}"]`)).toHaveCount(0); // the 6th of 8 groups: behind "עוד"
    const more = bottom.locator('button');
    await expect(more).toContainText('עוד');
    await more.click();
    const overflowLink = page.locator(`sw-app .bottom-overflow a[href="${HREF}"]`);
    await expect(overflowLink).toBeVisible({ timeout: 5000 });
    await expect(overflowLink).toContainText('חשמל והתקנים');
    await overflowLink.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(HREF);
    await expect(page.locator('sw-app .bottom-overflow')).toHaveCount(0);
    await expect(bottom.locator('button')).toHaveClass(/active/);
    await expect(page.locator('devices-building a.tile[data-area="cr007_lobby"]')).toBeVisible({ timeout: 30000 });
  });

  // ---------------------------------------------------------------- CR-007 slice 2: single-entity control

  // A pending record as the action route answers it (routers/ha.py); `confirmation` says how it can be confirmed.
  const record = (id: string, entity_id: string, action_id: string, status: string, confirmation: 'state' | 'attribute' | 'none' = 'state') =>
    JSON.stringify({ id, entity_id, action_id, status, error: null, requested_at: new Date().toISOString(), confirmed_at: status === 'confirmed' ? new Date().toISOString() : null, confirmation });

  test('a toggle shows a visible "awaiting confirmation" line, keeps the reported state as the fact, then confirms (action route mocked)', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/areas/cr007_lobby', 'a');
    const screen = page.locator('devices-area');
    const tile = screen.locator('.tile[data-entity="light.cr007_lobby_2"]'); // seeded off
    await expect(tile).toHaveClass(/\boff\b/, { timeout: 30000 });
    let confirmed = false;
    await page.route('**/api/v1/ha/entities/*/actions', (r) => r.fulfill({ status: 202, contentType: 'application/json', body: record('cr007-toggle-1', 'light.cr007_lobby_2', 'light.turn_on', 'pending') }));
    await page.route('**/api/v1/ha/actions/*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: record('cr007-toggle-1', 'light.cr007_lobby_2', 'light.turn_on', confirmed ? 'confirmed' : 'pending') }));
    await tile.locator('sw-toggle[data-control="power"]').click();
    // pending: a visible line (not only dimming); the toggle shows the target, the row's text and class stay the fact
    const status = tile.locator('[data-cmd-status]');
    await expect(status).toHaveAttribute('data-cmd-status', 'pending');
    await expect(status).toContainText('ממתין לאישור');
    await expect(tile.locator('sw-toggle[data-control="power"]')).toHaveAttribute('checked', '');
    await expect(tile).toHaveAttribute('data-active', 'false');
    await expect(tile.locator('.s')).toHaveText('כבוי');
    // Home Assistant's own state changes (a real /ha/dev/states write + /ha/ws push) and the next poll answers confirmed
    confirmed = true;
    await setState(request, 'light.cr007_lobby_2', 'on', { friendly_name: 'ספוט לובי', brightness: 255 });
    await expect(status).toHaveAttribute('data-cmd-status', 'confirmed', { timeout: 5000 });
    await expect(tile).toHaveClass(/\bon\b/, { timeout: 5000 });
    await expect(tile.locator('.rollback-note')).toHaveCount(0);
    await page.unroute('**/api/v1/ha/entities/*/actions');
    await page.unroute('**/api/v1/ha/actions/*');
    await setState(request, 'light.cr007_lobby_2', 'off', { friendly_name: 'ספוט לובי' });
  });

  test('a toggle that never confirms rolls back with an inline note once the domain timeout passes (action route mocked)', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/areas/cr007_lobby', 'a');
    const screen = page.locator('devices-area');
    const tile = screen.locator('.tile[data-entity="light.cr007_lobby_2"]');
    await expect(tile).toHaveClass(/\boff\b/, { timeout: 30000 });
    await page.route('**/api/v1/ha/entities/*/actions', (r) => r.fulfill({ status: 202, contentType: 'application/json', body: record('cr007-toggle-2', 'light.cr007_lobby_2', 'light.turn_on', 'pending') }));
    // Home Assistant never reports the expected state: the action stays pending forever from the client's view
    await page.route('**/api/v1/ha/actions/*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: record('cr007-toggle-2', 'light.cr007_lobby_2', 'light.turn_on', 'pending') }));
    await tile.locator('sw-toggle[data-control="power"]').click();
    await expect(tile.locator('[data-cmd-status="pending"]')).toBeVisible();
    // light/switch domain timeout is 5s (DomusUI's own number, recorded in api/device-commands.ts): a note appears, never before it
    await expect(tile.locator('.rollback-note')).toHaveCount(0);
    await expect(tile.locator('.rollback-note')).toBeVisible({ timeout: 7000 });
    await expect(tile.locator('[data-cmd-status="pending"]')).toHaveCount(0);
    await expect(tile).toHaveClass(/\boff\b/); // the last reported state - the target was never claimed as fact
    await expect(tile.locator('sw-toggle[data-control="power"]')).not.toHaveAttribute('checked', '');
    await page.unroute('**/api/v1/ha/entities/*/actions');
    await page.unroute('**/api/v1/ha/actions/*');
  });

  test('the brightness slider: an older command confirming inside the debounce window never overwrites the newer value (action route mocked)', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/areas/cr007_lobby', 'a');
    const screen = page.locator('devices-area');
    const tile = screen.locator('.tile[data-entity="light.cr007_lobby"]'); // seeded on, 50%
    await expect(tile).toHaveClass(/\bon\b/, { timeout: 30000 });
    // every status line and slider value the tile ever shows, recorded in the page as it happens
    await page.evaluate(() => {
      const w = window as unknown as { __cmdLog: string[] };
      w.__cmdLog = [];
      const deep = (node: Document | ShadowRoot, sel: string): Element | null => {
        const hit = node.querySelector(sel);
        if (hit) return hit;
        for (const el of Array.from(node.querySelectorAll('*'))) {
          const found = el.shadowRoot ? deep(el.shadowRoot, sel) : null;
          if (found) return found;
        }
        return null;
      };
      const root = deep(document, 'devices-area')?.shadowRoot;
      const find = () => root?.querySelector('.tile[data-entity="light.cr007_lobby"]');
      const snap = () => {
        const t = find();
        const st = t?.querySelector('[data-cmd-status]');
        const range = t?.querySelector('input[data-control="brightness"]') as HTMLInputElement | null;
        w.__cmdLog.push(`${st?.getAttribute('data-cmd-status') ?? '-'}|${st?.textContent?.trim() ?? ''}|${range?.value ?? ''}`);
      };
      new MutationObserver(snap).observe(root!, { subtree: true, childList: true, attributes: true, characterData: true });
      root!.addEventListener('input', snap, true);
    });
    const sent: number[] = [];
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/v1/ha/entities/*/actions', async (r) => {
      const pct = (r.request().postDataJSON() as { arguments: { brightness_pct: number } }).arguments.brightness_pct;
      sent.push(pct);
      const id = `cr007-bright-${sent.length}`;
      if (sent.length === 1) {
        await held; // the first request answers only after the slider has moved on - and answers "confirmed" at once
        await r.fulfill({ status: 202, contentType: 'application/json', body: record(id, 'light.cr007_lobby', 'light.turn_on', 'confirmed') });
      } else {
        await r.fulfill({ status: 202, contentType: 'application/json', body: record(id, 'light.cr007_lobby', 'light.turn_on', 'pending') });
      }
    });
    await page.route('**/api/v1/ha/actions/*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: record(r.request().url().split('/').pop()!, 'light.cr007_lobby', 'light.turn_on', 'confirmed') }));
    const range = tile.locator('input[data-control="brightness"]');
    await range.fill('30');
    await range.dispatchEvent('input');
    await expect.poll(() => sent.length, { timeout: 2000 }).toBe(1); // debounce elapsed, the first request is on the wire
    await range.fill('80');
    await range.dispatchEvent('input');
    release(); // the 30% confirmation lands now, inside the 300 ms debounce window of the 80% drag
    await expect.poll(() => sent, { timeout: 3000 }).toEqual([30, 80]);
    await expect(tile.locator('[data-cmd-status="confirmed"]')).toContainText('80%', { timeout: 5000 });
    const log = (await page.evaluate(() => (window as unknown as { __cmdLog: string[] }).__cmdLog)) as string[];
    // from the moment the screen shows the 80% command (the raw input event itself can be logged a frame earlier)
    const start = log.findIndex((l) => l.includes('80%'));
    expect(start).toBeGreaterThanOrEqual(0);
    const after80 = log.slice(start);
    expect(after80.filter((l) => l.includes('30%')), `the superseded 30% came back: ${after80.join(' / ')}`).toEqual([]);
    expect(after80.filter((l) => l.endsWith('|30'))).toEqual([]);
    expect(log.filter((l) => l.startsWith('confirmed') && l.includes('30%'))).toEqual([]);
    await page.unroute('**/api/v1/ha/entities/*/actions');
    await page.unroute('**/api/v1/ha/actions/*');
  });

  test('cover: open arms then confirms (sending the confirmation), Stop stays enabled while it moves and supersedes the open (action route mocked)', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/areas/cr007_lobby', 'a');
    const row = page.locator('devices-area .row[data-entity="cover.cr007_blind"]');
    await expect(row.locator('sw-button[data-control="open"]')).toBeVisible({ timeout: 30000 });
    const bodies: { allowed_action_id: string; confirmation_grant: string | null }[] = [];
    await page.route('**/api/v1/ha/entities/*/actions', (r) => {
      const b = r.request().postDataJSON() as { allowed_action_id: string; confirmation_grant: string | null };
      bodies.push(b);
      return r.fulfill({ status: 202, contentType: 'application/json', body: record(`cr007-cover-${bodies.length}`, 'cover.cr007_blind', b.allowed_action_id, 'pending', b.allowed_action_id === 'cover.stop_cover' ? 'none' : 'state') });
    });
    await page.route('**/api/v1/ha/actions/*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: record(r.request().url().split('/').pop()!, 'cover.cr007_blind', 'cover.open_cover', 'pending') }));
    await row.locator('sw-button[data-control="open"]').click();
    await expect(row.locator('sw-button[data-control="open"]')).toHaveText('לאשר פתיחה?');
    expect(bodies).toEqual([]); // the first tap only arms
    await row.locator('sw-button[data-control="open"]').click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0]).toMatchObject({ allowed_action_id: 'cover.open_cover', confirmation_grant: 'confirmed' });
    await expect(row.locator('[data-cmd-status="pending"]')).toContainText('פתיחה');
    // while the movement is pending: open / close / position are disabled, Stop is not
    await expect(row.locator('sw-button[data-control="open"]')).toHaveAttribute('disabled', '');
    await expect(row.locator('sw-button[data-control="close"]')).toHaveAttribute('disabled', '');
    await expect(row.locator('input[data-control="position"]')).toBeDisabled();
    await expect(row.locator('sw-button[data-control="stop"]')).not.toHaveAttribute('disabled', '');
    await row.locator('sw-button[data-control="stop"]').click();
    await expect.poll(() => bodies.map((b) => b.allowed_action_id)).toEqual(['cover.open_cover', 'cover.stop_cover']);
    expect(bodies[1].confirmation_grant).toBeNull(); // stop needs no confirmation
    // Stop supersedes the open still awaiting confirmation: the movement controls come back at once, the pending
    // line is gone, and the open's own timeout (7 s for covers) never turns into a "not confirmed" note
    await expect(row.locator('sw-button[data-control="open"]')).not.toHaveAttribute('disabled', '', { timeout: 1000 });
    await expect(row.locator('sw-button[data-control="close"]')).not.toHaveAttribute('disabled', '');
    await expect(row.locator('input[data-control="position"]')).toBeEnabled();
    await expect(row.locator('[data-cmd-status="pending"]')).toHaveCount(0);
    await page.waitForTimeout(8000);
    await expect(row.locator('.rollback-note')).toHaveCount(0);
    // the row's text is still the reported fact (open, 70%) - never the target
    await expect(row.locator('.v')).toContainText('70%');
    await page.unroute('**/api/v1/ha/entities/*/actions');
    await page.unroute('**/api/v1/ha/actions/*');
  });

  test('climate controls offer only what the entity reports: its hvac_modes, its fan_modes, its target range', async ({ page, request }) => {
    await seed(request);
    await setState(request, 'climate.cr007_lobby', 'cool', { friendly_name: 'מזגן לובי', current_temperature: 25.5, temperature: 26, hvac_action: 'cooling', fan_mode: 'auto', hvac_modes: ['off', 'cool', 'heat'], fan_modes: ['auto', 'low', 'high'], min_temp: 18, max_temp: 26 });
    await open(page, '/devices/areas/cr007_lobby', 'a');
    const clim = page.locator('devices-area .row[data-entity="climate.cr007_lobby"]');
    await expect(clim.locator('select[data-control="mode"]')).toBeVisible({ timeout: 30000 });
    expect(await clim.locator('select[data-control="mode"] option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))).toEqual(['off', 'cool', 'heat']);
    await expect(clim.locator('select[data-control="mode"]')).toHaveValue('cool');
    // fan mode is a menu of the entity's own fan_modes, not free text
    await expect(clim.locator('input[data-control="fan-mode"]')).toHaveCount(0);
    expect(await clim.locator('select[data-control="fan-mode"] option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))).toEqual(['auto', 'low', 'high']);
    // the target is at the entity's max_temp: "+" is disabled, "-" is not
    await expect(clim.locator('sw-button[data-control="temp-up"]')).toHaveAttribute('disabled', '');
    await expect(clim.locator('sw-button[data-control="temp-down"]')).not.toHaveAttribute('disabled', '');
    await seed(request); // back to the seeded climate state
  });

  test('through the REAL action route (fixture bridge): a toggle confirmed by the state change, a cover position armed on release then confirmed from its attribute, Stop honestly "sent"', async ({ page, request }) => {
    test.skip(process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py as the backend (SW_DEVICES_FIXTURE=1)');
    await seed(request);
    await open(page, '/devices/areas/cr007_lobby', 'a');
    const screen = page.locator('devices-area');
    const tile = screen.locator('.tile[data-entity="light.cr007_lobby_2"]');
    await expect(tile).toHaveClass(/\boff\b/, { timeout: 30000 });
    const posted: number[] = [];
    page.on('response', (res) => {
      if (/\/api\/v1\/ha\/entities\/[^/]+\/actions$/.test(res.url())) posted.push(res.status());
    });
    await tile.locator('sw-toggle[data-control="power"]').click();
    await expect(tile.locator('[data-cmd-status="confirmed"]')).toBeVisible({ timeout: 8000 });
    await expect(tile).toHaveClass(/\bon\b/, { timeout: 5000 });
    expect(posted).toEqual([202]);
    // the cover: a drag sends nothing; the release arms; the confirming tap sends set_cover_position with the
    // confirmation; the fake device reports current_position and the attribute confirms it
    const row = screen.locator('.row[data-entity="cover.cr007_blind"]');
    const range = row.locator('input[data-control="position"]');
    await range.fill('30');
    await range.dispatchEvent('input');
    await range.dispatchEvent('change');
    await expect(row.locator('sw-button[data-control="position-confirm"]')).toHaveText('לאשר מיקום 30%?');
    expect(posted).toEqual([202]);
    await row.locator('sw-button[data-control="position-confirm"]').click();
    await expect(row.locator('[data-cmd-status="confirmed"]')).toContainText('מיקום 30%', { timeout: 8000 });
    await expect(row.locator('.v')).toContainText('30%', { timeout: 5000 });
    // stop: accepted, nothing observable - "sent", never "confirmed"
    await row.locator('sw-button[data-control="stop"]').click();
    await expect(row.locator('[data-cmd-status="sent"]')).toContainText('נשלח', { timeout: 5000 });
    expect(posted).toEqual([202, 202, 202]);
    await seed(request);
  });

  test('through the REAL action route (fixture bridge): a 4xx answer rolls the control back with the reason, and nothing changes', async ({ browser, request }, testInfo) => {
    test.skip(process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py as the backend (SW_DEVICES_FIXTURE=1)');
    await seed(request);
    const user = `cr007revoked${testInfo.project.name}`;
    let binding: string | null = await bindUser(request, user, 'operator');
    try {
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': user } });
      const p = await ctx.newPage();
      await open(p, '/devices/areas/cr007_lobby', 'a');
      const tile = p.locator('devices-area .tile[data-entity="light.cr007_lobby_2"]');
      await expect(tile.locator('sw-toggle[data-control="power"]')).toBeVisible({ timeout: 30000 });
      // the operator's control is withdrawn after the page loaded: the real route answers 403 on the next tap
      await request.delete(`/api/v1/access/bindings/${binding}`);
      binding = null;
      const answer = p.waitForResponse((res) => /\/api\/v1\/ha\/entities\/[^/]+\/actions$/.test(res.url()));
      await tile.locator('sw-toggle[data-control="power"]').click();
      expect((await answer).status()).toBe(403);
      await expect(tile.locator('.rollback-note')).toBeVisible({ timeout: 5000 });
      await expect(tile.locator('sw-toggle[data-control="power"]')).not.toHaveAttribute('checked', '');
      await expect(tile).toHaveClass(/\boff\b/);
      const e = await (await request.get('/api/v1/ha/entities/light.cr007_lobby_2')).json();
      expect(e.state).toBe('off'); // nothing reached the (fake) device
      await ctx.close();
    } finally {
      if (binding) await request.delete(`/api/v1/access/bindings/${binding}`).catch(() => {});
    }
  });

  test('controls are absent without devices.control: a plain viewer (devices.read only) sees the same cards read-only', async ({ browser, request }, testInfo) => {
    await seed(request);
    const tag = testInfo.project.name;
    const bindings: string[] = [];
    const viewerUser = `cr007viewerctl${tag}`;
    try {
      bindings.push(await bindUser(request, viewerUser, 'viewer'));
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': viewerUser } });
      const p = await ctx.newPage();
      await open(p, '/devices/areas/cr007_lobby', 'a');
      const screen = p.locator('devices-area');
      const lit = screen.locator('.tile[data-entity="light.cr007_lobby"]');
      await expect(lit).toBeVisible({ timeout: 30000 });
      await expect(lit).toContainText('50%'); // the read-only value is still shown
      await expect(lit).not.toHaveAttribute('data-can-control', '');
      // no control of any kind anywhere inside the cards for this identity
      await expect(screen.locator('sw-card sw-toggle, sw-card sw-button, sw-card input[type="range"], sw-card input[type="text"]')).toHaveCount(0);
      await expect(screen.locator('.note')).toContainText('תצוגה לקריאה בלבד');
      await ctx.close();
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
    }
  });

  // ---------------------------------------------------------------- slice 3: bulk actions (devices.control_bulk)

  /** Which button of the bulk dialog holds the keyboard focus (walking the shadow roots' activeElement chain). */
  async function focusedBulkButton(page: Page): Promise<string | null> {
    return page.evaluate(() => {
      const chain: Element[] = [];
      let el: Element | null = document.activeElement;
      while (el) {
        chain.push(el);
        el = (el as HTMLElement).shadowRoot?.activeElement ?? null;
      }
      const host = chain.reverse().find((e) => e.tagName === 'SW-BUTTON');
      if (!host) return null;
      return host.hasAttribute('data-bulk-cancel') ? 'cancel' : host.hasAttribute('data-bulk-confirm') ? 'confirm' : 'other';
    });
  }

  test('bulk (REAL route, fixture bridge): the area popover opens a dialog that states what is sent, focus on Cancel, Cancel sends nothing; confirm → progress → "בוצע" when all confirmed', async ({ page, request }) => {
    test.skip(process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py as the backend (SW_DEVICES_FIXTURE=1)');
    test.setTimeout(90_000);
    await seed(request);
    const posted: Record<string, unknown>[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/api\/v1\/devices\/actions$/.test(req.url())) posted.push(req.postDataJSON() as Record<string, unknown>);
    });
    await useLayout(page, 'cards');
    await open(page, '/devices/building', 'a');
    const screen = page.locator('devices-building');
    // the tree panel's area row opens the area popover (the mockup's board 1)
    // (below 900 px the tree panel folds away and the floor cards carry the same rows and popover)
    const wide = (page.viewportSize()?.width ?? 1440) >= 900;
    const menu = screen.locator(wide ? 'devices-bulk-menu[data-tree-area="cr007_hall"]' : 'devices-bulk-menu[data-card-area="cr007_hall"]');
    await expect(menu).toBeVisible({ timeout: 30000 });
    await menu.locator('button[data-area-row]').click();
    const panel = menu.locator('[data-bulk-panel="popover"]');
    await expect(panel).toBeVisible();
    // the popover: the area's state chips, then the four quick actions and "all off"
    await expect(panel.locator('[data-chip="lights"]')).toContainText('2/2');
    await expect(panel.locator('[data-chip="locks"]')).toBeVisible();
    await expect(panel.locator('button[data-bulk-kind]')).toHaveCount(5);
    await expect(panel.locator('button[data-bulk-kind="climate_off"]')).toBeDisabled(); // nothing of that kind is on here
    await expect(panel.locator('button[data-bulk-kind="all_off"]')).toContainText('כבה הכל באזור · אישור');
    await expect(panel.locator('a[data-open-area]')).toHaveAttribute('href', '#/devices/areas/cr007_hall');
    await panel.locator('button[data-bulk-kind="lights_off"]').click();
    const dialog = screen.locator('devices-bulk-dialog sw-dialog[data-bulk-dialog="confirm"]');
    await expect(dialog.locator('[data-bulk-what]')).toBeVisible({ timeout: 10000 }); // (the sw-dialog host itself has no box: its backdrop is fixed)
    await expect(dialog.locator('[data-bulk-count]')).toHaveAttribute('data-bulk-count', '2');
    await expect(dialog.locator('[data-bulk-domains] [data-domain="light"]')).toContainText('2');
    await expect(dialog.locator('[data-bulk-never]')).toContainText('מנעולים');
    await expect(dialog.locator('[data-bulk-never]')).toContainText('(1)'); // the hall's lock is there, and not included
    await expect.poll(() => focusedBulkButton(page)).toBe('cancel');
    expect(posted).toHaveLength(0); // opening the dialog sends nothing
    await dialog.locator('sw-button[data-bulk-cancel]').click();
    await expect(screen.locator('devices-bulk-dialog sw-dialog[open]')).toHaveCount(0);
    expect(posted).toHaveLength(0); // Cancel sends nothing
    // again, and this time the dialog's own confirm button
    await menu.locator('button[data-area-row]').click();
    await panel.locator('button[data-bulk-kind="lights_off"]').click();
    await expect(dialog.locator('[data-bulk-what]')).toBeVisible({ timeout: 10000 }); // (the sw-dialog host itself has no box: its backdrop is fixed)
    await dialog.locator('sw-button[data-bulk-confirm]').click();
    const progress = screen.locator('devices-bulk-dialog [data-bulk-progress]');
    await expect(progress).toBeVisible({ timeout: 10000 });
    const result = screen.locator('devices-bulk-dialog [data-bulk-result="ok"]');
    await expect(result).toContainText('בוצע', { timeout: 30000 });
    await expect(result).not.toContainText('חלקית');
    await expect(progress).toHaveAttribute('data-confirmed', '2');
    await expect(progress).toHaveAttribute('data-done', 'true');
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ scope: 'area', id: 'cr007_hall', kind: 'lights_off', confirmed: true });
    // the tree refetched after completion: the hall's lights are off, its cover untouched, the lock still locked
    const hall = screen.locator('devices-bulk-menu[data-card-area="cr007_hall"] button[data-area-row]');
    await expect(hall).toHaveAttribute('data-counts', /lights:0\/2/, { timeout: 10000 });
    await expect(hall).toHaveAttribute('data-counts', /covers:1\/1/);
    expect((await (await request.get('/api/v1/ha/entities/lock.cr007_hall_door')).json()).state).toBe('locked');
    await seed(request);
  });

  test('bulk (REAL route, fixture bridge): the floor menu "כבה הכל" with one device that never confirms shows progress, then "בוצע חלקית: 1 לא אושרו" naming it - never "everything is off"', async ({ page, request }) => {
    test.skip(process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py as the backend (SW_DEVICES_FIXTURE=1)');
    test.setTimeout(120_000);
    await seed(request);
    await useLayout(page, 'cards');
    await open(page, '/devices/building', 'a');
    const screen = page.locator('devices-building');
    // the floor card's "כבה קומה ▾" (the tree's floor "⋯" opens the same menu)
    const menu = screen.locator('section[data-floor-card="cr007_annex"] devices-bulk-menu[data-floor-menu="cr007_annex"]');
    await expect(menu).toBeVisible({ timeout: 30000 });
    await expect(menu.locator('sw-button[data-bulk-trigger]')).toContainText('כבה קומה');
    await menu.locator('sw-button[data-bulk-trigger]').click();
    await menu.locator('[data-bulk-panel="menu"] button[data-bulk-kind="all_off"]').click();
    const dialog = screen.locator('devices-bulk-dialog sw-dialog[data-bulk-dialog="confirm"]');
    await expect(dialog.locator('[data-bulk-count]')).toHaveAttribute('data-bulk-count', '7', { timeout: 10000 });
    for (const [d, n] of [['light', '4'], ['cover', '1'], ['climate', '1'], ['media_player', '1']]) await expect(dialog.locator(`[data-domain="${d}"]`)).toContainText(n);
    await expect(dialog.locator('[data-domain="lock"]')).toHaveCount(0);
    await expect(dialog.locator('[data-bulk-never]')).toContainText('מנעולים (1)');
    await expect.poll(() => focusedBulkButton(page)).toBe('cancel');
    await dialog.locator('sw-button[data-bulk-confirm]').click();
    const progress = screen.locator('devices-bulk-dialog [data-bulk-progress]');
    await expect(progress).toHaveAttribute('data-total', '7', { timeout: 10000 });
    await expect(progress).toHaveAttribute('data-confirmed', '6', { timeout: 15000 });
    await expect(progress).toHaveAttribute('data-done', 'false'); // the stuck light is still inside its window
    await expect(screen.locator('devices-bulk-dialog [data-bulk-result="running"]')).toContainText('6 מתוך 7 אושרו');
    const partial = screen.locator('devices-bulk-dialog [data-bulk-result="partial"]');
    await expect(partial).toContainText('בוצע חלקית: 1 לא אושרו', { timeout: 45000 });
    const missing = screen.locator('devices-bulk-dialog [data-bulk-not-confirmed] li');
    await expect(missing).toHaveCount(1);
    await expect(missing.first()).toHaveAttribute('data-entity', 'light.cr007_den_stuck');
    await expect(missing.first()).toHaveAttribute('data-outcome', 'not_confirmed');
    await expect(missing.first()).toContainText('לא אושר');
    await expect(screen.locator('devices-bulk-dialog')).not.toContainText('הכל כבוי');
    expect((await (await request.get('/api/v1/ha/entities/lock.cr007_hall_door')).json()).state).toBe('locked');
    // the tree refetched: the den still shows its stuck light on
    await expect(screen.locator('devices-bulk-menu[data-card-area="cr007_den"] button[data-area-row]')).toHaveAttribute('data-counts', /lights:1\/2/, { timeout: 10000 });
    await seed(request);
  });

  test('bulk controls are gated on devices.control_bulk in both designs: an operator (devices.control) sees none and is refused; the admin sees the building buttons, floor menus and area popovers', async ({ page, browser, request }, testInfo) => {
    await seed(request);
    const user = `cr007opbulk${testInfo.project.name}`;
    const binding = await bindUser(request, user, 'operator');
    try {
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': user } });
      const p = await ctx.newPage();
      for (const design of ['a', 'b'] as const) {
        // the default (tree + floor cards): the area popover informs (chips, "פתח אזור"), it offers no action
        await open(p, '/devices/building', design);
        const scr = p.locator('devices-building');
        const row = scr.locator('devices-bulk-menu[data-card-area="cr007_hall"]');
        await expect(row).toBeVisible({ timeout: 30000 });
        await expect(scr.locator('[data-bulk-floor], [data-floor-menu], [data-bulk-building], [data-quick-off], devices-bulk-dialog')).toHaveCount(0);
        await row.locator('button[data-area-row]').click();
        await expect(row.locator('[data-bulk-panel="popover"] a[data-open-area]')).toBeVisible();
        await expect(row.locator('[data-bulk-panel] button[data-bulk-kind]')).toHaveCount(0);
        await p.keyboard.press('Escape');
        // the tiles: no "⋯" at all
        await scr.locator('button[data-layout="tiles"]').click();
        await expect(scr.locator('a.tile[data-area="cr007_hall"]')).toBeVisible({ timeout: 30000 });
        await expect(scr.locator('devices-bulk-menu, [data-bulk-building], devices-bulk-dialog')).toHaveCount(0);
        await scr.locator('button[data-layout="cards"]').click();
        await open(p, '/devices/areas/cr007_hall', design);
        await expect(p.locator('devices-area sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
        await expect(p.locator('devices-area devices-bulk-menu, devices-area devices-bulk-dialog')).toHaveCount(0);
        await expect(p.locator('devices-area .tile[data-entity="light.cr007_hall_a"] sw-toggle[data-control="power"]')).toBeVisible(); // single-entity control stays
      }
      const expires = new Date(Date.now() + 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const r = await p.request.post('/api/v1/devices/actions', { data: { scope: 'area', id: 'cr007_hall', kind: 'lights_off', confirmed: true, client_request_id: crypto.randomUUID(), expires_at: expires } });
      expect(r.status()).toBe(403);
      expect((await p.request.get('/api/v1/devices/actions/preview?scope=area&id=cr007_hall&kind=all_off')).status()).toBe(403);
      await ctx.close();
      // the admin (the dev-mode default identity holds devices.control_bulk installation-wide), in both designs
      const posted: string[] = [];
      page.on('request', (req) => {
        if (req.method() === 'POST' && /\/api\/v1\/devices\/actions$/.test(req.url())) posted.push(req.url());
      });
      for (const design of ['a', 'b'] as const) {
        await open(page, '/devices/building', design);
        const scr = page.locator('devices-building');
        await expect(scr.locator('[data-bulk-building] sw-button[data-bulk-kind="lights_off"]')).toBeVisible({ timeout: 30000 });
        await expect(scr.locator('[data-bulk-building] sw-button[data-bulk-kind="all_off"]')).toBeVisible();
        await expect(scr.locator('devices-bulk-menu[data-bulk-floor="cr007_annex"]')).toBeVisible();
        await expect(scr.locator('devices-bulk-menu[data-bulk-area="cr007_hall"]')).toBeVisible();
        await expect(scr.locator('devices-bulk-menu[data-bulk-area="unassigned"]')).toHaveCount(0); // the bucket is not an area
        // a building button opens the confirmation dialog; nothing is sent until its own confirm button
        await scr.locator('[data-bulk-building] sw-button[data-bulk-kind="all_off"]').click();
        await expect(scr.locator('devices-bulk-dialog sw-dialog[open] sw-button[data-bulk-cancel]')).toBeVisible({ timeout: 10000 });
        await expect(scr.locator('devices-bulk-dialog sw-dialog[open]')).toHaveAttribute('heading', /כבה הכל · המבנה/);
        await expect.poll(() => focusedBulkButton(page)).toBe('cancel');
        await scr.locator('devices-bulk-dialog sw-button[data-bulk-cancel]').click();
        await expect(scr.locator('devices-bulk-dialog sw-dialog[open]')).toHaveCount(0);
        await open(page, '/devices/areas/cr007_hall', design);
        await expect(page.locator('devices-area devices-bulk-menu[data-bulk-area="cr007_hall"]')).toBeVisible({ timeout: 30000 });
      }
      expect(posted).toHaveLength(0);
    } finally {
      await request.delete(`/api/v1/access/bindings/${binding}`).catch(() => {});
    }
  });

  test('the building screen opens on the mockup layout (tree panel + floor cards), keeps the tiles as a second view remembered per viewer, and floor stats sit next to the title', async ({ browser, request }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the tree panel folds away below 900 px (the floor cards carry the same rows and actions; the bulk tests cover them there)');
    await seed(request);
    const ctx = await browser.newContext(); // a fresh viewer (the dev default identity, the admin): no stored layout
    const p = await ctx.newPage();
    try {
      await open(p, '/devices/building', 'a');
      const scr = p.locator('devices-building');
      const tree = scr.locator('nav[data-devices-tree]');
      await expect(tree).toBeVisible({ timeout: 30000 });
      await expect(scr.locator('button[data-layout="cards"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(tree.locator('button[data-tree="all"]')).toContainText('כל המבנה');
      // floors as group headers in level order, each with its areas (a state dot and the lit count)
      const groups = await tree.locator('[data-tree-floor]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tree-floor')));
      expect(groups.indexOf('cr007_ground')).toBeLessThan(groups.indexOf('cr007_upper'));
      expect(groups.indexOf('cr007_upper')).toBeLessThan(groups.indexOf('cr007_annex'));
      const lobbyRow = tree.locator('devices-bulk-menu[data-tree-area="cr007_lobby"] button[data-area-row]');
      await expect(lobbyRow).toHaveAttribute('data-on', 'true');
      await expect(lobbyRow.locator('.sdot.on')).toHaveCount(1);
      await expect(lobbyRow.locator('.lit')).toHaveText(/^‎?1$/);
      await expect(tree.locator('[data-tree-floor="cr007_annex"] devices-bulk-menu[data-bulk-floor="cr007_annex"]')).toHaveCount(1); // the floor "⋯"
      await expect(tree.locator('.tree-area sw-button[data-quick-off="cr007_hall"]')).toHaveCount(1); // hover "כבה אזור"
      // the floor cards: header with the lit count and "כבה קומה ▾", a row per area with its chips, footer "פתח קומה"
      const ground = scr.locator('section[data-floor-card="cr007_ground"]');
      await expect(ground.locator('header .lit')).toHaveAttribute('data-lit', '1');
      await expect(ground.locator('header .lit')).toContainText(/1 דולקות מתוך \u200E?2/);
      await expect(ground.locator('devices-bulk-menu[data-floor-menu="cr007_ground"]')).toHaveCount(1);
      await expect(ground.locator('button[data-area-row="cr007_lobby"]')).toHaveAttribute('data-counts', /lights:1\/2/);
      await expect(ground.locator('button[data-area-row="cr007_storage"]')).toContainText('אין התקנים');
      await expect(scr.locator('section[data-floor-card]')).toHaveCount(await scr.locator('nav[data-devices-tree] [data-tree-floor]').count() + 1); // + ללא שיוך
      // "פתח קומה" (or the floor in the tree) narrows the cards to that floor; "כל המבנה" brings everything back
      await ground.locator('sw-button[data-open-floor="cr007_ground"]').click();
      await expect(scr.locator('section[data-floor-card]')).toHaveCount(1);
      await expect(tree.locator('button[data-tree-select="cr007_ground"]')).toHaveAttribute('aria-current', 'true');
      await tree.locator('button[data-tree="all"]').click();
      await expect(scr.locator('section[data-floor-card="cr007_annex"]')).toBeVisible();
      // an area row of a floor card opens the popover; "פתח אזור ›" opens the area screen
      const cardRow = scr.locator('devices-bulk-menu[data-card-area="cr007_lobby"]');
      await cardRow.locator('button[data-area-row]').click();
      const pop = cardRow.locator('[data-bulk-panel="popover"]');
      await expect(pop.locator('[data-chip="lights"]')).toContainText('1/2');
      await expect(pop.locator('[data-chip="alarm"]')).toBeVisible();
      await expect(pop.locator('button[data-bulk-kind]')).toHaveCount(5);
      await pop.locator('a[data-open-area]').click();
      await expect.poll(() => p.evaluate(() => location.hash)).toBe('#/devices/areas/cr007_lobby');
      await expect(p.locator('devices-area sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
      await expect(p.locator('devices-area devices-bulk-menu[data-bulk-area="cr007_lobby"]')).toHaveCount(1); // the area's own popover
      // the tiles view is still there, and the choice is remembered for this viewer
      await open(p, '/devices/building', 'a');
      await scr.locator('button[data-layout="tiles"]').click();
      await expect(scr.locator('a.tile[data-area="cr007_lobby"]')).toBeVisible();
      await expect(scr.locator('nav[data-devices-tree]')).toHaveCount(0);
      await p.reload();
      await expect(p.locator('devices-building a.tile[data-area="cr007_lobby"]')).toBeVisible({ timeout: 30000 });
      await expect(p.locator('devices-building button[data-layout="tiles"]')).toHaveAttribute('aria-pressed', 'true');
      // owner's screenshot: the floor's summary chips sat at the far edge of the page, detached from its title
      const head = p.locator('devices-building section[data-floor="cr007_ground"]');
      const title = await head.locator('.floor-head h2').boundingBox();
      const sum = await head.locator('.floor-sum').boundingBox();
      const section = await head.boundingBox();
      expect(title && sum && section).toBeTruthy();
      // RTL: the title on the right, the chips right after it (not pushed to the section's left edge)
      if ((p.viewportSize()?.width ?? 1280) >= 900) {
        expect(title!.x - (sum!.x + sum!.width)).toBeLessThan(260);
        expect(sum!.x - section!.x).toBeGreaterThan(120);
      }
      await p.locator('devices-building button[data-layout="cards"]').click();
      await expect(p.locator('devices-building nav[data-devices-tree]')).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('bulk (REAL route, fixture bridge): a device clock minutes fast or slow still sends - the expiry is computed on the server clock learned from the preview', async ({ browser, request }) => {
    test.skip(process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py as the backend (SW_DEVICES_FIXTURE=1)');
    test.setTimeout(120_000);
    for (const skewMs of [5 * 60_000, -5 * 60_000]) {
      await seed(request);
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await p.addInitScript((skew) => {
        const realNow = Date.now.bind(Date);
        Date.now = () => realNow() + skew;
      }, skewMs);
      const posted: Record<string, unknown>[] = [];
      p.on('request', (req) => {
        if (req.method() === 'POST' && /\/api\/v1\/devices\/actions$/.test(req.url())) posted.push(req.postDataJSON() as Record<string, unknown>);
      });
      await open(p, '/devices/areas/cr007_hall', 'a');
      const menu = p.locator('devices-area devices-bulk-menu[data-bulk-area="cr007_hall"]');
      await expect(menu).toBeVisible({ timeout: 30000 });
      await menu.locator('sw-button[data-bulk-trigger]').click();
      await menu.locator('[data-bulk-panel] button[data-bulk-kind="lights_off"]').click();
      const dialog = p.locator('devices-area devices-bulk-dialog sw-dialog[data-bulk-dialog="confirm"]');
      await expect(dialog.locator('[data-bulk-count]')).toHaveAttribute('data-bulk-count', '2', { timeout: 10000 });
      await dialog.locator('sw-button[data-bulk-confirm]').click();
      await expect(p.locator('devices-area devices-bulk-dialog [data-bulk-result="ok"]')).toContainText('בוצע', { timeout: 30000 });
      // the expiry sent lies ~15 s ahead of the SERVER's clock, whatever this device's clock says
      const lead = Date.parse(String(posted[0].expires_at)) - Date.now();
      expect(lead, `skew ${skewMs}`).toBeGreaterThan(5_000);
      expect(lead, `skew ${skewMs}`).toBeLessThan(20_000);
      await ctx.close();
    }
    await seed(request);
  });

  test('a bulk holder sees whether each switch is included in bulk actions; an administrator marks one safe and back', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/areas/cr007_lobby', 'a');
    const sign = page.locator('devices-area .tile[data-entity="switch.cr007_sign"]');
    const line = sign.locator('[data-bulk-safe]');
    await expect(line).toHaveAttribute('data-bulk-safe', 'switch_not_marked', { timeout: 30000 });
    await expect(line).toContainText('לא נכלל בכיבוי מרוכז');
    await line.locator('sw-button[data-bulk-safe-toggle]').click();
    await expect(line).toHaveAttribute('data-bulk-safe', 'marked', { timeout: 10000 });
    await expect(line).toContainText('נכלל בכיבוי מרוכז (סומן כבטוח)');
    await line.locator('sw-button[data-bulk-safe-toggle]').click();
    await expect(line).toHaveAttribute('data-bulk-safe', 'switch_not_marked', { timeout: 10000 });
  });

  // ---------------------------------------------------------------- slice 4: climate/covers in full, sensors, assign

  test('through the REAL action route (fixture bridge): climate preset mode and target humidity confirm from their own attribute', async ({ page, request }) => {
    test.skip(process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py as the backend (SW_DEVICES_FIXTURE=1)');
    await seed(request);
    await open(page, '/devices/areas/cr007_lobby', 'a');
    const clim = page.locator('devices-area .row[data-entity="climate.cr007_lobby"]');
    await expect(clim.locator('select[data-control="preset-mode"]')).toBeVisible({ timeout: 30000 });
    await expect(clim.locator('select[data-control="preset-mode"]')).toHaveValue('none');
    await clim.locator('select[data-control="preset-mode"]').selectOption('eco');
    await expect(clim.locator('[data-cmd-status="confirmed"]')).toContainText('eco', { timeout: 8000 });
    await expect(clim).toContainText('מצב מוגדר: eco', { timeout: 5000 });
    // target humidity: +/- in steps of 5, confirmed from the humidity attribute (never compared to the state)
    await expect(clim).toContainText(/לחות יעד ‎?50%/);
    await clim.locator('sw-button[data-control="humidity-up"]').click();
    await expect(clim.locator('[data-cmd-status="confirmed"]')).toContainText('55', { timeout: 8000 });
    await expect(clim).toContainText(/לחות יעד ‎?55%/, { timeout: 5000 });
    await seed(request);
  });

  test('through the REAL action route (fixture bridge): cover tilt arms then confirms from current_tilt_position, independent of the top position', async ({ page, request }) => {
    test.skip(process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py as the backend (SW_DEVICES_FIXTURE=1)');
    await seed(request);
    await open(page, '/devices/areas/cr007_lobby', 'a');
    const row = page.locator('devices-area .row[data-entity="cover.cr007_blind"]');
    const tilt = row.locator('input[data-control="tilt-position"]');
    await expect(tilt).toBeVisible({ timeout: 30000 });
    await expect(row).toContainText(/הטיה ‎?40%/);
    await tilt.fill('80');
    await tilt.dispatchEvent('input');
    await tilt.dispatchEvent('change');
    await expect(row.locator('sw-button[data-control="tilt-position-confirm"]')).toHaveText('לאשר הטיה 80%?');
    await row.locator('sw-button[data-control="tilt-position-confirm"]').click();
    await expect(row.locator('[data-cmd-status="confirmed"]')).toContainText('הטיה 80%', { timeout: 8000 });
    await expect(row).toContainText(/הטיה ‎?80%/, { timeout: 5000 });
    // open tilt: attention risk like the top movement, arm then confirm; nothing observable on the cover's own
    // state (tilt, not position) - honestly "sent", never "confirmed"
    await row.locator('sw-button[data-control="open-tilt"]').click();
    await expect(row.locator('sw-button[data-control="open-tilt"]')).toHaveText('לאשר פתיחת הטיה?');
    await row.locator('sw-button[data-control="open-tilt"]').click();
    await expect(row.locator('[data-cmd-status="sent"]')).toContainText('נשלח', { timeout: 8000 });
    // the top position is untouched by any of this
    await expect(row).toContainText('70%');
    await seed(request);
  });

  test('bulk (REAL route, fixture bridge): the covers card\'s own "כל התריסים" group control - open all and position all - through the same confirmation dialog', async ({ page, request }) => {
    test.skip(process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py as the backend (SW_DEVICES_FIXTURE=1)');
    await seed(request);
    const posted: Record<string, unknown>[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/api\/v1\/devices\/actions$/.test(req.url())) posted.push(req.postDataJSON() as Record<string, unknown>);
    });
    await open(page, '/devices/areas/cr007_office', 'a');
    const screen = page.locator('devices-area');
    const group = screen.locator('[data-cover-group]');
    await expect(group).toBeVisible({ timeout: 30000 });
    const dialog = screen.locator('devices-bulk-dialog sw-dialog[data-bulk-dialog="confirm"]');
    // open all: the office's one closed cover
    await group.locator('sw-button[data-cover-group-kind="covers_open"]').click();
    await expect(dialog.locator('[data-bulk-count]')).toHaveAttribute('data-bulk-count', '1', { timeout: 10000 });
    await dialog.locator('sw-button[data-bulk-confirm]').click();
    await expect(screen.locator('devices-bulk-dialog [data-bulk-result="ok"]')).toContainText('בוצע', { timeout: 30000 });
    expect(posted[0]).toMatchObject({ scope: 'area', id: 'cr007_office', kind: 'covers_open' });
    // the dialog stays open until closed (as every bulk result does): close it before the group control's next
    // action, or its fixed backdrop would swallow the click
    await screen.locator('devices-bulk-dialog sw-button[data-bulk-cancel]').click();
    await expect(screen.locator('devices-bulk-dialog sw-dialog[open]')).toHaveCount(0);
    // position all: the range + "קבע מיקום לכולם" sends covers_position with the value on the slider, never a
    // fan-out path of its own - the same bulk record/run as every other kind
    const range = group.locator('input[data-cover-group-position-input]');
    await range.fill('55');
    await range.dispatchEvent('input');
    await group.locator('sw-button[data-cover-group-kind="covers_position"]').click();
    await expect(dialog.locator('[data-bulk-count]')).toHaveAttribute('data-bulk-count', '1', { timeout: 10000 });
    await dialog.locator('sw-button[data-bulk-confirm]').click();
    await expect(screen.locator('devices-bulk-dialog [data-bulk-result="ok"]')).toContainText('בוצע', { timeout: 30000 });
    expect(posted[1]).toMatchObject({ scope: 'area', id: 'cr007_office', kind: 'covers_position', position: 55 });
    await seed(request);
  });

  test('assign flow: an admin assigns an unassigned entity to an HA area; the bucket and the target area both refresh', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/areas/unassigned', 'a');
    const screen = page.locator('devices-area');
    const tile = screen.locator('.tile[data-entity="switch.cr007_loose"]');
    await expect(tile).toBeVisible({ timeout: 30000 });
    await tile.locator('sw-button[data-assign-entity="switch.cr007_loose"]').click();
    const dialog = screen.locator('sw-dialog[data-assign-dialog="open"]');
    await expect(dialog.locator('select[data-assign-select]')).toBeVisible({ timeout: 10000 }); // (the sw-dialog host itself has no box: its backdrop is fixed)
    await expect(dialog.locator('sw-button[data-assign-confirm]')).toHaveAttribute('disabled', ''); // no area picked yet - custom element: the attribute is the contract
    await dialog.locator('select[data-assign-select]').selectOption('cr007_storage');
    await dialog.locator('sw-button[data-assign-confirm]').click();
    await expect(screen.locator('.tile[data-entity="switch.cr007_loose"]')).toHaveCount(0, { timeout: 10000 });
    await open(page, '/devices/areas/cr007_storage', 'a');
    await expect(page.locator('devices-area .tile[data-entity="switch.cr007_loose"]')).toBeVisible({ timeout: 30000 });
    await seed(request); // restores switch.cr007_loose to "ללא שיוך" for the other tests
  });

  test('the sensors card groups rows by device class, compact, with unit and last-changed - and never a control', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/areas/cr007_lobby', 'a');
    const card = page.locator('devices-area sw-card[data-card="sensors"]');
    await expect(card).toBeVisible({ timeout: 30000 });
    const groups = await card.locator('[data-sensor-group]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sensor-group')));
    expect(groups).toContain('temperature');
    expect(groups).toContain('power');
    expect(groups).toContain('moisture'); // a binary sensor outside the security set, grouped by its own device class
    const temp = card.locator('[data-sensor-group="temperature"] .tile[data-entity="sensor.cr007_temp"]');
    await expect(temp).toContainText('23.5 °C');
    await expect(temp.locator('[data-last-changed]')).toBeVisible();
    await expect(temp.locator('sw-toggle, sw-button, input')).toHaveCount(0);
    const power = card.locator('[data-sensor-group="power"] .tile[data-entity="sensor.cr007_power"]');
    await expect(power).toContainText('120 W');
    const moist = card.locator('[data-sensor-group="moisture"] .tile[data-entity="binary_sensor.cr007_moist"]');
    await expect(moist).toBeVisible();
  });
});