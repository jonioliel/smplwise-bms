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
];
const AREAS = [
  { area_id: 'cr007_office', name: 'משרד', floor_id: 'cr007_upper', icon: 'mdi:desk' },
  { area_id: 'cr007_lobby', name: 'לובי', floor_id: 'cr007_ground', icon: 'mdi:sofa' },
  { area_id: 'cr007_storage', name: 'מחסן', floor_id: 'cr007_ground' },
];
const LOBBY = ['light.cr007_lobby', 'light.cr007_lobby_2', 'switch.cr007_sign', 'climate.cr007_lobby', 'cover.cr007_blind', 'lock.cr007_front', 'binary_sensor.cr007_door', 'camera.cr007_lobby', 'media_player.cr007_tv', 'sensor.cr007_temp', 'alarm_control_panel.cr007_house'];
const ENTITIES = [
  ...LOBBY.map((entity_id) => ({ entity_id, area_id: 'cr007_lobby' })),
  { entity_id: 'light.cr007_office', area_id: 'cr007_office' },
  { entity_id: 'cover.cr007_office', area_id: 'cr007_office' },
  { entity_id: 'switch.cr007_loose', area_id: null },
];
const STATES = [
  { entity_id: 'light.cr007_lobby', state: 'on', attributes: { friendly_name: 'תאורת לובי', brightness: 128 } },
  { entity_id: 'light.cr007_lobby_2', state: 'off', attributes: { friendly_name: 'ספוט לובי' } },
  { entity_id: 'switch.cr007_sign', state: 'on', attributes: { friendly_name: 'שלט מואר' } },
  { entity_id: 'climate.cr007_lobby', state: 'cool', attributes: { friendly_name: 'מזגן לובי', current_temperature: 25.5, temperature: 22, hvac_action: 'cooling', fan_mode: 'auto', hvac_modes: ['off', 'cool', 'heat', 'fan_only'], fan_modes: ['auto', 'low', 'high'], min_temp: 16, max_temp: 30 } },
  { entity_id: 'cover.cr007_blind', state: 'open', attributes: { friendly_name: 'תריס לובי', current_position: 70, device_class: 'blind' } },
  { entity_id: 'lock.cr007_front', state: 'locked', attributes: { friendly_name: 'דלת ראשית', device_class: 'lock' } },
  { entity_id: 'binary_sensor.cr007_door', state: 'off', attributes: { friendly_name: 'מגע דלת', device_class: 'door' } },
  { entity_id: 'camera.cr007_lobby', state: 'idle', attributes: { friendly_name: 'מצלמת לובי' } },
  { entity_id: 'media_player.cr007_tv', state: 'playing', attributes: { friendly_name: 'טלוויזיה לובי', media_title: 'חדשות', source: 'HDMI 1', volume_level: 0.4 } },
  { entity_id: 'sensor.cr007_temp', state: '23.5', attributes: { friendly_name: 'טמפרטורת לובי', unit_of_measurement: '°C', device_class: 'temperature' } },
  { entity_id: 'alarm_control_panel.cr007_house', state: 'armed_away', attributes: { friendly_name: 'אזעקה' } },
  { entity_id: 'light.cr007_office', state: 'off', attributes: { friendly_name: 'תאורת משרד' } },
  { entity_id: 'cover.cr007_office', state: 'closed', attributes: { friendly_name: 'תריס משרד', current_position: 0 } },
  { entity_id: 'switch.cr007_loose', state: 'off', attributes: { friendly_name: 'מתג ללא אזור' } },
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
    // nothing on this screen is a control
    await expect(screen.locator('sw-button, button, input, sw-toggle')).toHaveCount(0);
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
});
