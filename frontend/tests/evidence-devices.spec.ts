import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Evidence for CR-007 slice 1 (חשמל והתקנים, read-only) against a running developer backend (SW_LIVE=1). The backend
// needs no Home Assistant: the HA floors, areas and entities are seeded through the dev-only registry / states
// endpoints (`POST /ha/dev/registry`, `POST /ha/dev/states`), the same writes the sync itself performs, so the tree
// and the area cards are exercised on a known structure. Every seeded id carries the `cr007_` prefix; the seed is
// idempotent (registries are rewritten whole) and is re-applied by each test. Run against a throwaway backend
// (`SW_API_PORT` for the preview proxy) rather than the owner's, since it rewrites the HA area / floor mirror.

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
  { entity_id: 'climate.cr007_lobby', state: 'cool', attributes: { friendly_name: 'מזגן לובי', current_temperature: 25.5, temperature: 22, hvac_action: 'cooling', fan_mode: 'auto' } },
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

test.describe('Electricity and devices (CR-007 slice 1, read-only)', () => {
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

  test('the area screen: cards per domain with the fields each needs, empty states after the filled cards, sibling chips, no controls', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/areas/cr007_lobby', 'a');
    const screen = page.locator('devices-area');
    await expect(screen.locator('sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
    // lighting: a lit light is a warm tile with its brightness, an unlit one is plain
    const lit = screen.locator('.tile[data-entity="light.cr007_lobby"]');
    await expect(lit).toHaveClass(/\bon\b/);
    await expect(lit).toContainText('50%');
    await expect(screen.locator('.tile[data-entity="light.cr007_lobby_2"]')).toHaveClass(/\boff\b/);
    await expect(screen.locator('.tile[data-entity="light.cr007_lobby_2"]')).toContainText('כבוי');
    // climate: current and target temperature, mode and action
    const clim = screen.locator('.row[data-entity="climate.cr007_lobby"]');
    await expect(clim).toContainText('25.5');
    await expect(clim).toContainText('קירור');
    await expect(clim).toContainText('מקרר');
    await expect(clim).toContainText('22');
    // cover: state with position and a bar, no slider
    const cover = screen.locator('.row[data-entity="cover.cr007_blind"]');
    await expect(cover).toContainText('פתוח');
    await expect(cover).toContainText('70%');
    await expect(cover.locator('.bar i')).toHaveAttribute('style', /70%/);
    // security: lock badge, door contact, alarm, and the HA camera row (no still served here yet)
    await expect(screen.locator('.row[data-entity="lock.cr007_front"] sw-badge')).toHaveAttribute('label', 'נעול');
    await expect(screen.locator('.row[data-entity="binary_sensor.cr007_door"] sw-badge')).toHaveAttribute('label', 'סגורה');
    await expect(screen.locator('.row[data-entity="alarm_control_panel.cr007_house"] sw-badge')).toHaveAttribute('label', /דרוכה/);
    await expect(screen.locator('.row[data-entity="camera.cr007_lobby"]')).toContainText('אין תמונה');
    await expect(screen.locator('sw-badge[data-area-alarm]')).toBeVisible();
    // media and sensors
    const tv = screen.locator('.row[data-entity="media_player.cr007_tv"]');
    await expect(tv).toContainText('מנגן');
    await expect(tv).toContainText('HDMI 1');
    await expect(tv).toContainText('40%');
    await expect(screen.locator('.tile[data-entity="sensor.cr007_temp"]')).toContainText('23.5 °C');
    // chips of the same floor, the current one selected; the empty storage area is one of them
    await expect(screen.locator('sw-chip[data-area-chip="cr007_lobby"]')).toHaveAttribute('selected', '');
    await expect(screen.locator('sw-chip[data-area-chip="cr007_storage"]')).toHaveCount(1);
    await expect(screen.locator('sw-chip[data-area-chip="cr007_office"]')).toHaveCount(0); // another floor
    // breadcrumb back to the tree
    await expect(page.locator('devices-area sw-page')).toHaveAttribute('crumbs', /חשמל והתקנים \| קרקע \| לובי/);
    // no controls anywhere inside the cards
    await expect(screen.locator('sw-card sw-button, sw-card button, sw-card input, sw-card sw-toggle')).toHaveCount(0);

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
});
