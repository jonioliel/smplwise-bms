import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** CR-007 slice 6a: the glass style's evidence screenshots (desktop + phone), committed with the task. */
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/T025');

// Evidence for CR-007 slice 1 (חשמל והתקנים, read-only) against a running developer backend (SW_LIVE=1). The backend
// needs no Home Assistant: the HA floors, areas and entities are seeded through the dev-only registry / states
// endpoints (`POST /ha/dev/registry`, `POST /ha/dev/states`), the same writes the sync itself performs, so the tree
// and the area cards are exercised on a known structure. Every seeded id carries the `cr007_` prefix; the seed is
// idempotent (registries are rewritten whole) and is re-applied by each test. Run against a throwaway backend
// (`SW_API_PORT` for the preview proxy) rather than the owner's, since it rewrites the HA area / floor mirror.
// Slice 2 (single-entity control): most control tests mock the action route; the two "REAL action route" tests need
// tests/fixtures/devices_fake_ha.py as the backend (the real backend with a fake HA-side bridge) and SW_DEVICES_FIXTURE=1.

const HREF = '#/devices/building';

// Home redesign follow-up: the building screen's cards | tiles choice is a compact item of the user menu ("תצוגה"), not a row of the page.
const MENU = 'sw-app sw-user-menu';
async function openViewMenu(page: Page) {
  await page.locator('sw-app [data-profile-menu]:visible, sw-app [data-nav-me]:visible').first().click(); // the rail's button is hidden on a phone, the bottom bar's is not
  await expect(page.locator(`${MENU} [data-user-menu]`)).toBeVisible();
}
async function closeMenu(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.locator(`${MENU} [data-user-menu]`)).toBeHidden();
}
async function setView(page: Page, view: 'cards' | 'tiles') {
  await openViewMenu(page);
  await page.locator(`${MENU} [data-menu-screen-view] [data-menu-view-option="${view}"]`).click();
  await expect(page.locator(`${MENU} [data-menu-screen-view] [data-menu-view-option="${view}"]`)).toHaveAttribute('aria-pressed', 'true');
  await closeMenu(page);
}
async function expectView(page: Page, view: 'cards' | 'tiles') {
  await openViewMenu(page);
  await expect(page.locator(`${MENU} [data-menu-screen-view] [data-menu-view-option="${view}"]`)).toHaveAttribute('aria-pressed', 'true');
  await closeMenu(page);
}
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

  /** The area screen's switcher (devices-area-nav.ts): the area crumb's list on a wide screen, chips on a phone - both carry
   * `data-nav-option`. Opens the list when it is closed; `close` puts it away again. */
  async function areaOption(page: Page, id: string) {
    const nav = page.locator('devices-area devices-area-nav');
    const opt = nav.locator(`[data-nav-option="${id}"]`);
    if (!(await opt.count()) && (await nav.locator('[data-crumb="area"]').count())) await nav.locator('[data-crumb="area"]').click();
    return { opt, close: async () => { if (await nav.locator('[data-nav-menu]').count()) await page.keyboard.press('Escape'); } };
  }

  /** UI round 1c (shell/screen-edit.ts): the area screen has no "ערוך פריסה" button - its layout editor is an item of the user
   * menu ("עריכת פריסה", the corner avatar: the rail's on a wide screen, the bottom bar's on the phone). */
  async function openUserMenu(page: Page) {
    await page.locator('sw-app [data-profile-menu]:visible, sw-app [data-nav-me]:visible').first().click();
  }
  async function enterLayoutEdit(page: Page) {
    await openUserMenu(page);
    await page.locator('sw-app sw-user-menu [data-menu-screen-edit="devices-layout"]').click();
  }
  async function layoutEditOffered(page: Page): Promise<boolean> {
    await openUserMenu(page);
    await page.waitForTimeout(300);
    const offered = (await page.locator('sw-app sw-user-menu [data-menu-screen-edit="devices-layout"]').count()) > 0;
    await page.keyboard.press('Escape');
    return offered;
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
    await expect(screen.locator('home-widgets [data-home-widget="alarm"]')).toBeVisible(); // home redesign: the alarm is a read-only status card of the control-centre band, no longer a tile
    // nothing on this screen controls one device; the only buttons are the bulk actions (slice 3: the header buttons
    // and the "⋯" triggers, each of which opens the confirmation dialog - the admin holds devices.control_bulk)
    await expect(screen.locator('input, sw-toggle')).toHaveCount(0);
    // (CR-007 HA refresh adds "רענן מ־Home Assistant", which re-reads HA's registries and controls no device; 6b adds
    // "ערוך פריסה" for a system.configure holder - the layout, not a device)
    await expect(screen.locator('sw-button:visible:not([data-bulk-kind]):not([data-bulk-trigger]):not([data-devices-refresh]):not([data-quick-off])')).toHaveCount(0); // (the tree's hover "כבה אזור" is a bulk action; the tiles view shows the tree too since 2026-09-30)
    // a tile opens the area screen
    await lobby.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/areas/cr007_lobby');
    await expect(page.locator('devices-area sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
  });

  test('the area screen: cards per domain with the fields each needs, empty states after the filled cards, sibling chips, one-tap controls for a devices.control holder', async ({ page, request }, testInfo) => {
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
    // security (owner 2026-09-30, area redesign): a strip above the sections - lock, door contact, alarm, camera - read-only
    // chips; the section itself is drawn only where the owner laid the screen out
    const strip = screen.locator('[data-security-strip]');
    await expect(strip.locator('[data-sec-chip="lock.cr007_front"]')).toContainText('נעול');
    await expect(strip.locator('[data-sec-chip="binary_sensor.cr007_door"]')).toContainText('סגור');
    await expect(strip.locator('[data-sec-chip="alarm_control_panel.cr007_house"]')).toContainText('דרוכה');
    await expect(strip.locator('[data-sec-chip="camera.cr007_lobby"]')).toContainText('מקוון');
    await expect(screen.locator('sw-card[data-card="security"]')).toHaveCount(0);
    await expect(strip.locator('sw-button, sw-toggle, input, button')).toHaveCount(0);
    await expect(screen.locator('sw-badge[data-area-alarm]')).toBeVisible();
    // media and sensors: media gets power/play-pause/mute, sensors never a control
    const tv = screen.locator('.row[data-entity="media_player.cr007_tv"]');
    await expect(tv).toContainText('מנגן');
    await expect(tv).toContainText('HDMI 1');
    await expect(tv).toContainText('40%');
    await expect(tv.locator('sw-toggle[data-control="power"]')).toBeVisible();
    await expect(tv.locator('sw-button[data-control="playpause"]')).toBeVisible();
    await expect(tv.locator('sw-button[data-control="mute"]')).toBeVisible();
    // the temperature is one of the sensors' main strip (area redesign 2026-09-30), never a control
    const temp = screen.locator('[data-main-sensor="sensor.cr007_temp"]');
    await expect(temp).toContainText('23.5');
    await expect(temp.locator('sw-toggle, sw-button, input')).toHaveCount(0);
    // chips of the same floor, the current one selected; the empty storage area is one of them
    const lobby = await areaOption(page, 'cr007_lobby');
    const phone = testInfo.project.name === 'mobile';
    await expect(lobby.opt).toHaveAttribute(phone ? 'selected' : 'aria-checked', phone ? '' : 'true');
    await expect(screen.locator('[data-nav-option="cr007_storage"]')).toHaveCount(1);
    await expect(screen.locator('[data-nav-option="cr007_office"]')).toHaveCount(0); // another floor
    // the breadcrumb is a set of controls (owner 2026-09-30): home, the floor, the area
    await expect(screen.locator('devices-area-nav [data-crumb="home"]')).toContainText('חשמל והתקנים');
    await expect(screen.locator('devices-area-nav [data-crumb="floor"]')).toContainText('קרקע');
    await expect(page.locator('devices-area sw-page h1')).toHaveText('לובי');

    // the empty area (owner feedback 2026-09-29, "hide empty domains"): no card at all, one honest empty state
    await screen.locator('devices-area-nav [data-nav-option="cr007_storage"]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/areas/cr007_storage');
    await expect(screen.locator('sw-state-panel[data-devices-state="area_empty"]')).toBeVisible({ timeout: 30000 });
    await expect(screen.locator('sw-state-panel[data-devices-state="area_empty"]')).toHaveAttribute('heading', 'אין התקנים באזור הזה');
    await expect(screen.locator('sw-card[data-card]')).toHaveCount(0);

    // the office (lighting and covers only): exactly those two cards - no empty "climate", "media" ... cards
    await open(page, '/devices/areas/cr007_office', 'a');
    await expect(screen.locator('sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
    const order = await screen.locator('sw-card[data-card]').evaluateAll((els) => els.map((e) => e.getAttribute('data-card')));
    expect(order.sort()).toEqual(['covers', 'lighting']);
    await expect(screen.locator('sw-card[data-empty]')).toHaveCount(0);
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

  // ---------------------------------------------------------------- CR-007 HA refresh (owner report 2026-09-28)
  // A structure change made in Home Assistant (an entity moved to another area) used to show only after restarting the
  // add-on. With the fixture backend (SW_DEVICES_FIXTURE=1) the move goes through the fake HA: its registry changes and
  // HA's `entity_registry_updated` event reaches the real sync, which refreshes the registry and pushes
  // `structure_changed`. Against a plain developer backend the dev registry endpoint rewrites the registry and sends
  // the same push.
  const CONTROL = `http://127.0.0.1:${process.env.SW_FAKE_HA_CONTROL_PORT ?? String(Number(process.env.SW_API_PORT ?? '8099') + 1)}`;
  const FIXTURE = process.env.SW_DEVICES_FIXTURE === '1';

  async function moveInHa(request: APIRequestContext, entity_id: string, area_id: string, silent = false) {
    if (FIXTURE) {
      const r = await request.post(`${CONTROL}/move`, { data: { entity_id, area_id, silent } });
      expect(r.status()).toBe(200);
      if (!silent) expect(((await r.json()) as { delivered: number }).delivered, 'the real sync is subscribed to entity_registry_updated').toBeGreaterThan(0);
      return;
    }
    const entities = ENTITIES.map((e) => (e.entity_id === entity_id ? { ...e, area_id } : e));
    const r = await request.post('/api/v1/ha/dev/registry', { data: { entities, devices: [], areas: AREAS, floors: FLOORS } });
    expect(r.status()).toBe(200);
  }

  test('structure: an entity moved to another area in Home Assistant shows there on the tree and the area screen within seconds, without a reload', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/building', 'a');
    const storageTile = page.locator('devices-building a.tile[data-area="cr007_storage"]');
    const officeTile = page.locator('devices-building a.tile[data-area="cr007_office"]');
    await expect(officeTile).toHaveAttribute('data-counts', /lights:0\/1/, { timeout: 30000 });
    await expect(storageTile).not.toHaveAttribute('data-counts', /lights/);
    const area = await page.context().newPage();
    await area.goto('/?design=a#/devices/areas/cr007_storage');
    await area.waitForSelector('sw-app');
    await expect(area.locator('devices-area')).toBeVisible({ timeout: 30000 });
    await area.waitForTimeout(800);
    let loads = 0;
    page.on('load', () => (loads += 1));
    area.on('load', () => (loads += 1));
    const t0 = Date.now();
    await moveInHa(request, 'light.cr007_office', 'cr007_storage');
    await expect(storageTile).toHaveAttribute('data-counts', /lights:0\/1/, { timeout: 8000 });
    await expect(officeTile).not.toHaveAttribute('data-counts', /lights/);
    // the area screen's own push filter cannot know an entity moved IN: the structure notice refetches it
    await expect(area.locator('devices-area [data-entity="light.cr007_office"]')).toBeVisible({ timeout: 8000 });
    const tookMs = Date.now() - t0;
    await expect(page.locator('devices-building [data-structure-changed]')).toBeVisible();
    await expect(area.locator('devices-area [data-structure-changed]')).toBeVisible();
    expect(loads, 'no page reload').toBe(0);
    expect(tookMs).toBeLessThan(8000);
    test.info().annotations.push({ type: 'latency', description: `move → both screens updated in ${tookMs} ms (${FIXTURE ? 'fake HA registry event' : 'dev registry'})` });
    await area.close();
    await seed(request); // back to the seeded structure (the fake HA's registry follows the seed)
  });

  test('structure: "רענן" re-reads the registries on demand, says when, and is rate-limited', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/building', 'a');
    const button = page.locator('devices-building sw-button[data-devices-refresh]');
    await expect(button).toBeVisible({ timeout: 30000 });
    // owner notes 2026-09-30: one small icon-only button - its accessible name / tooltip carries "רענן" and when the
    // structure was last read; no standing text line and no "מסונכרן" chip while the state is fine
    await expect(button).toHaveAttribute('icononly', '');
    await expect(button).toHaveAttribute('label', /^רענן · המבנה/);
    await expect(button.locator('button')).toHaveAttribute('aria-label', /המבנה/);
    await expect(page.locator('devices-building [data-devices-refreshed], devices-building [data-devices-checked], devices-building [data-devices-sync]')).toHaveCount(0);
    if (!FIXTURE) {
      // no Home Assistant behind a plain developer backend: an honest refusal, nothing pretended
      await button.click();
      await expect(page.locator('devices-building [data-devices-refresh-note]')).toContainText('אין כרגע חיבור לתשתית המערכת', { timeout: 10000 });
      await expect(button).not.toHaveAttribute('disabled', /.*/);
      return;
    }
    const storageTile = page.locator('devices-building a.tile[data-area="cr007_storage"]');
    await expect(storageTile).not.toHaveAttribute('data-counts', /lights/, { timeout: 30000 });
    // HA changes but its event never arrives (a missed event): nothing moves by itself...
    await moveInHa(request, 'light.cr007_office', 'cr007_storage', true);
    await page.waitForTimeout(2500);
    await expect(storageTile).not.toHaveAttribute('data-counts', /lights/);
    // ...until the button re-reads the registries
    const treeFetches: number[] = [];
    page.on('request', (rq) => {
      if (rq.url().includes('/api/v1/devices/tree')) treeFetches.push(Date.now());
    });
    const answer = page.waitForResponse((r) => r.url().endsWith('/api/v1/devices/refresh'));
    await button.click();
    expect((await answer).status()).toBe(200);
    await expect(storageTile).toHaveAttribute('data-counts', /lights:0\/1/, { timeout: 5000 });
    await expect(page.locator('devices-building [data-structure-changed]')).toBeVisible();
    await expect(button).toHaveAttribute('label', /המבנה עודכן עכשיו/);
    await expect(button).toHaveAttribute('label', /נבדק עכשיו/);
    // one tree fetch for the button, not a second one for its own structure_changed echo
    await page.waitForTimeout(1500);
    expect(treeFetches.length).toBe(1);
    // at once again: one per user per 10 s
    const again = page.waitForResponse((r) => r.url().endsWith('/api/v1/devices/refresh'));
    await button.click();
    expect((await again).status()).toBe(429);
    await expect(page.locator('devices-building [data-devices-refresh-note]')).toContainText('בעוד');
    await seed(request);
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
      await expect(empty).toHaveAttribute('heading', 'אין קומות ואזורים');
      await expect(page.locator('devices-building a.tile[data-area="unassigned"]')).toHaveAttribute('data-counts', /switches:/);
    } finally {
      await seed(request);
    }
  });

  test('the devices entry is gated on devices.read; the screen refuses without it', async ({ page, browser, request }, testInfo) => {
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
      await without.close();

      // a plain viewer holds devices.read (like map.read)
      bindings.push(await bindUser(request, viewerUser, 'viewer'));
      const viewer = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': viewerUser } });
      const p2 = await viewer.newPage();
      await useLayout(p2, 'tiles');
      await open(p2, '/live', 'a');
      await expect(p2.locator(`${RAIL} a[href="${HREF}"]`)).toHaveCount(1, { timeout: 30000 });
      await expect(p2.locator(`${RAIL} a[href="${HREF}"]`)).toContainText('ראשי'); // CR-013: the device overview is "ראשי"
      await open(p2, '/devices/building', 'a');
      await expect(p2.locator('devices-building a.tile[data-area="cr007_lobby"]')).toBeVisible({ timeout: 30000 });
      await viewer.close();

      // the admin (dev-mode default identity) sees it
      await open(page, '/live', 'a');
      await expect(page.locator(`${RAIL} a[href="${HREF}"]`)).toHaveCount(1, { timeout: 30000 });
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      if (roleId) await request.delete(`/api/v1/access/roles/${roleId}`).catch(() => {});
    }
  });

  test('the phone bottom nav reaches the devices area directly, and the tree then the area screen fit the phone', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'nav.bottom only renders below the 768px breakpoint; other projects are wider');
    await seed(request);
    await open(page, '/live', 'a');
    const bottom = page.locator(BOTTOM);
    await expect(bottom).toBeVisible({ timeout: 30000 });
    const link = bottom.locator(`a[href="${HREF}"]`);
    await expect(link).toBeVisible();
    await expect(link).toContainText('ראשי'); // CR-013: the device overview is "ראשי", the bar's first tab
    // four tabs and the user avatar share the bar: no item may be pushed out of the viewport
    await expect(bottom.locator(':scope > a, :scope > button')).toHaveCount(5);
    await expect(bottom.locator(':scope > :last-child')).toHaveAttribute('data-nav-me', '');
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
    // the explicit way back exists on the phone, where the browser's own back is not at hand: since the area redesign it is the
    // header navigation bar's home crumb (an icon on the phone), not sw-page's backHref
    const home = page.locator('devices-area devices-area-nav [data-crumb="home"]');
    await expect(home).toBeVisible();
    await home.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(HREF);
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
    // the tree panel's area row: its "⋯" opens the area popover (the mockup's board 1; a click on the row itself enters
    // the area - owner feedback 2026-09-29) (below 900 px the tree panel folds away and the floor cards carry the same rows and popover)
    const wide = (page.viewportSize()?.width ?? 1440) >= 900;
    const menu = screen.locator(wide ? 'devices-bulk-menu[data-tree-area="cr007_hall"]' : 'devices-bulk-menu[data-card-area="cr007_hall"]');
    await expect(menu).toBeVisible({ timeout: 30000 });
    await menu.locator('[data-area-more]').click();
    const panel = menu.locator('[data-bulk-panel="popover"]');
    await expect(panel).toBeVisible();
    // the popover: the area's state chips, then the quick actions of the kinds the hall HAS (no climate there: no
    // "כבה מיזוג" - owner feedback 2026-09-29) and "all off"
    await expect(panel.locator('[data-chip="lights"]')).toContainText('2/2');
    await expect(panel.locator('[data-chip="locks"]')).toBeVisible();
    await expect(panel.locator('button[data-bulk-kind]')).toHaveCount(4);
    await expect(panel.locator('button[data-bulk-kind="climate_off"]')).toHaveCount(0);
    await expect(panel.locator('button[data-bulk-kind="all_off"]')).toContainText('כבה הכל באזור · אישור');
    await expect(panel.locator('a[data-open-area]')).toHaveAttribute('href', '#/devices/areas/cr007_hall');
    await panel.locator('button[data-bulk-kind="lights_off"]').click();
    const dialog = screen.locator('devices-bulk-dialog sw-dialog[data-bulk-dialog="confirm"]');
    await expect(dialog.locator('[data-bulk-what]')).toBeVisible({ timeout: 10000 }); // (the sw-dialog host itself has no box: its backdrop is fixed)
    await expect(dialog.locator('[data-bulk-count]')).toHaveAttribute('data-bulk-count', '2');
    await expect(dialog.locator('[data-bulk-domains] [data-domain="light"]')).toContainText('2');
    // re-review: a lights action no longer lists the locks / alarm as "not included" (only "כבה הכל" does)
    await expect(dialog.locator('[data-bulk-never]')).not.toContainText('נמצאים כאן ואינם נכללים');
    await expect.poll(() => focusedBulkButton(page)).toBe('cancel');
    expect(posted).toHaveLength(0); // opening the dialog sends nothing
    await dialog.locator('sw-button[data-bulk-cancel]').click();
    await expect(screen.locator('devices-bulk-dialog sw-dialog[open]')).toHaveCount(0);
    expect(posted).toHaveLength(0); // Cancel sends nothing
    // again, and this time the dialog's own confirm button
    await menu.locator('[data-area-more]').click();
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
    const hall = screen.locator('devices-bulk-menu[data-card-area="cr007_hall"] a[data-area-row]');
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
    await expect(screen.locator('devices-bulk-menu[data-card-area="cr007_den"] a[data-area-row]')).toHaveAttribute('data-counts', /lights:1\/2/, { timeout: 10000 });
    await seed(request);
  });

  test('bulk controls are gated on devices.control_bulk: an operator (devices.control) sees none and is refused; the admin sees the building buttons, floor menus and area popovers', async ({ page, browser, request }, testInfo) => {
    await seed(request);
    const user = `cr007opbulk${testInfo.project.name}`;
    const binding = await bindUser(request, user, 'operator');
    try {
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': user } });
      const p = await ctx.newPage();
      // the default (tree + floor cards): the area popover informs (chips, "פתח אזור"), it offers no action
      await open(p, '/devices/building');
      const scr = p.locator('devices-building');
      const row = scr.locator('devices-bulk-menu[data-card-area="cr007_hall"]');
      await expect(row).toBeVisible({ timeout: 30000 });
      await expect(scr.locator('[data-bulk-floor], [data-floor-menu], [data-bulk-building], [data-quick-off], devices-bulk-dialog')).toHaveCount(0);
      await row.locator('[data-area-more]').click();
      await expect(row.locator('[data-bulk-panel="popover"] a[data-open-area]')).toBeVisible();
      await expect(row.locator('[data-bulk-panel] button[data-bulk-kind]')).toHaveCount(0);
      await p.keyboard.press('Escape');
      // the tiles: no "⋯" on a tile, no building buttons, no dialog (owner notes 2026-09-30: the tiles view shows the
      // tree too, whose area rows only inform - the same summary popovers as in the cards view, no action)
      await setView(scr.page(), 'tiles');
      await expect(scr.locator('a.tile[data-area="cr007_hall"]')).toBeVisible({ timeout: 30000 });
      await expect(scr.locator('.floors devices-bulk-menu, [data-bulk-building], [data-quick-off], [data-bulk-floor], devices-bulk-dialog')).toHaveCount(0);
      await expect(scr.locator('nav.tree devices-bulk-menu [data-bulk-panel] button[data-bulk-kind]')).toHaveCount(0);
      await setView(scr.page(), 'cards');
      await open(p, '/devices/areas/cr007_hall');
      await expect(p.locator('devices-area sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
      await expect(p.locator('devices-area devices-bulk-menu, devices-area devices-bulk-dialog')).toHaveCount(0);
      await expect(p.locator('devices-area .tile[data-entity="light.cr007_hall_a"] sw-toggle[data-control="power"]')).toBeVisible(); // single-entity control stays
      const expires = new Date(Date.now() + 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const r = await p.request.post('/api/v1/devices/actions', { data: { scope: 'area', id: 'cr007_hall', kind: 'lights_off', confirmed: true, client_request_id: crypto.randomUUID(), expires_at: expires } });
      expect(r.status()).toBe(403);
      expect((await p.request.get('/api/v1/devices/actions/preview?scope=area&id=cr007_hall&kind=all_off')).status()).toBe(403);
      await ctx.close();
      // the admin (the dev-mode default identity holds devices.control_bulk installation-wide)
      const posted: string[] = [];
      page.on('request', (req) => {
        if (req.method() === 'POST' && /\/api\/v1\/devices\/actions$/.test(req.url())) posted.push(req.url());
      });
      // home redesign: with the quick-actions card on, the building buttons live in that card; switched off they are in the toolbar row
      await request.patch('/api/v1/settings', { data: { 'home.widgets': { quick: { on: false } } } });
      await open(page, '/devices/building');
      const adminScr = page.locator('devices-building');
      await expect(adminScr.locator('[data-bulk-building] sw-button[data-bulk-kind="lights_off"]')).toBeVisible({ timeout: 30000 });
      await expect(adminScr.locator('[data-bulk-building] sw-button[data-bulk-kind="all_off"]')).toBeVisible();
      await expect(adminScr.locator('.floors devices-bulk-menu[data-bulk-floor="cr007_annex"]')).toBeVisible(); // (the tiles view also has the tree's own floor menu)
      await expect(adminScr.locator('devices-bulk-menu[data-bulk-area="cr007_hall"]')).toBeVisible();
      await expect(adminScr.locator('devices-bulk-menu[data-bulk-area="unassigned"]')).toHaveCount(0); // the bucket is not an area
      // a building button opens the confirmation dialog; nothing is sent until its own confirm button
      await adminScr.locator('[data-bulk-building] sw-button[data-bulk-kind="all_off"]').click();
      await expect(adminScr.locator('devices-bulk-dialog sw-dialog[open] sw-button[data-bulk-cancel]')).toBeVisible({ timeout: 10000 });
      await expect(adminScr.locator('devices-bulk-dialog sw-dialog[open]')).toHaveAttribute('heading', /כבה הכל · המבנה/);
      await expect.poll(() => focusedBulkButton(page)).toBe('cancel');
      await adminScr.locator('devices-bulk-dialog sw-button[data-bulk-cancel]').click();
      await expect(adminScr.locator('devices-bulk-dialog sw-dialog[open]')).toHaveCount(0);
      await open(page, '/devices/areas/cr007_hall');
      await expect(page.locator('devices-area devices-bulk-menu[data-bulk-area="cr007_hall"]')).toBeVisible({ timeout: 30000 });
      expect(posted).toHaveLength(0);
    } finally {
      await request.patch('/api/v1/settings', { data: { 'home.widgets': {} } }).catch(() => {});
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
      await expectView(scr.page(), 'cards');
      await expect(tree.locator('button[data-tree="all"]')).toContainText('כל המבנה');
      // floors as group headers in level order, each with its areas (a state dot and the lit count)
      const groups = await tree.locator('[data-tree-floor]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tree-floor')));
      expect(groups.indexOf('cr007_ground')).toBeLessThan(groups.indexOf('cr007_upper'));
      expect(groups.indexOf('cr007_upper')).toBeLessThan(groups.indexOf('cr007_annex'));
      const lobbyRow = tree.locator('devices-bulk-menu[data-tree-area="cr007_lobby"] a[data-area-row]');
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
      await expect(ground.locator('a[data-area-row="cr007_lobby"]')).toHaveAttribute('data-counts', /lights:1\/2/);
      await expect(ground.locator('a[data-area-row="cr007_storage"]')).toContainText('אין התקנים');
      await expect(scr.locator('section[data-floor-card]')).toHaveCount(await scr.locator('nav[data-devices-tree] [data-tree-floor]').count() + 1); // + ללא שיוך
      // "פתח קומה" (or the floor in the tree) narrows the cards to that floor; "כל המבנה" brings everything back
      await ground.locator('sw-button[data-open-floor="cr007_ground"]').click();
      await expect(scr.locator('section[data-floor-card]')).toHaveCount(1);
      await expect(tree.locator('button[data-tree-select="cr007_ground"]')).toHaveAttribute('aria-current', 'true');
      await tree.locator('button[data-tree="all"]').click();
      await expect(scr.locator('section[data-floor-card="cr007_annex"]')).toBeVisible();
      // an area row's "⋯" opens the popover; "פתח אזור ›" opens the area screen
      const cardRow = scr.locator('devices-bulk-menu[data-card-area="cr007_lobby"]');
      await cardRow.locator('[data-area-more]').click();
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
      await setView(scr.page(), 'tiles');
      await expect(scr.locator('a.tile[data-area="cr007_lobby"]')).toBeVisible();
      await expect(scr.locator('nav[data-devices-tree]')).toHaveCount(1); // owner notes 2026-09-30: the tiles view shows the floors tree too
      await p.reload();
      await expect(p.locator('devices-building a.tile[data-area="cr007_lobby"]')).toBeVisible({ timeout: 30000 });
      await expectView(p, 'tiles');
      // owner's screenshot: the floor's summary chips sat at the far edge of the page, detached from its title
      const head = p.locator('devices-building section[data-floor="cr007_ground"]');
      const title = await head.locator('.floor-head h2').boundingBox();
      const sum = await head.locator('.floor-sum').boundingBox();
      const section = await head.boundingBox();
      expect(title && sum && section).toBeTruthy();
      // RTL: the title on the right, the chips right after it (not pushed to the section's left edge)
      if ((p.viewportSize()?.width ?? 1280) >= 900) {
        expect(title!.x - (sum!.x + sum!.width)).toBeLessThan(260);
        // owner notes 2026-09-30: the floors are packed sections now (a floor with two areas is not page-wide), so the chips
        // may fill their section; they stay inside it and are never pushed out to the page's far edge
        expect(sum!.x).toBeGreaterThanOrEqual(section!.x - 1);
        expect(section!.width).toBeLessThan(900);
      }
      await setView(p, 'cards');
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

  test('owner 2026-09-30: the area screen shows nothing about bulk eligibility (it is managed in הגדרות › חשמל › פעולה קבוצתית)', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/areas/cr007_lobby', 'a');
    const sign = page.locator('devices-area .tile[data-entity="switch.cr007_sign"]');
    await expect(sign).toBeVisible({ timeout: 30000 });
    await expect(page.locator('devices-area [data-bulk-safe], devices-area [data-bulk-safe-toggle]')).toHaveCount(0);
    await expect(sign).not.toContainText('כיבוי מרוכז');
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
    // open all: the office's one closed cover. Area redesign (2026-09-30): "פתח" / "סגור" are the section header's bulk buttons now
    // (the group control under it keeps stop-all and the position for all), and they open the same confirmation dialog
    await screen.locator('[data-section-bulk="covers"] sw-button[data-section-bulk-kind="covers_open"]').click();
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
    // owner 2026-09-30 (area redesign): the main strip (temperature first) on top, the rest behind "עוד N חיישנים"
    if ((await card.getAttribute('collapsed')) !== null) await card.locator('button.fold').click(); // a phone starts the sensors section folded
    await expect(card.locator('[data-main-sensor="sensor.cr007_temp"]')).toContainText('23.5');
    await card.locator('[data-sensors-more]').click();
    const groups = await card.locator('[data-sensor-group]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sensor-group')));
    expect(groups).not.toContain('temperature'); // the only temperature sensor is the main strip's
    expect(groups).toContain('power');
    expect(groups).toContain('moisture'); // a binary sensor outside the security set, grouped by its own device class
    const temp = card.locator('[data-main-sensor="sensor.cr007_temp"]');
    await expect(temp).toContainText('23.5');
    await expect(temp.locator('sw-toggle, sw-button, input')).toHaveCount(0);
    const power = card.locator('[data-sensor-group="power"] .tile[data-entity="sensor.cr007_power"]');
    await expect(power).toContainText('120 W');
    const moist = card.locator('[data-sensor-group="moisture"] .tile[data-entity="binary_sensor.cr007_moist"]');
    await expect(moist).toBeVisible();
  });

  // ------------------------------------------------ CR-007 slice 6a: הגדרות › חשמל והתקנים and the two styles
  // Installation-wide settings: every test restores the defaults (the specs run with one worker, in order).
  const DEVICES_DEFAULTS = { 'devices.style': 'smplwise', 'devices.theme': 'default', 'devices.default_view': 'cards', 'devices.show_sensors': 'true', 'devices.show_climate_strip': 'true', 'devices.density': 'comfortable', 'devices.scheme': 'light' };

  async function devicesSettings(request: APIRequestContext, body: Record<string, string>) {
    const r = await request.patch('/api/v1/settings', { data: body });
    expect(r.status(), 'settings PATCH (the dev default identity holds system.configure)').toBe(200);
  }

  /** An element's glass material: its computed backdrop-filter and its background's alpha (1 = the solid fallback). */
  async function material(loc: Locator): Promise<{ filter: string; alpha: number }> {
    return loc.evaluate((e) => {
      const cs = getComputedStyle(e);
      const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor);
      const parts = m ? m[1].split(/[\s,/]+/).filter(Boolean) : [];
      return { filter: cs.backdropFilter || 'none', alpha: parts.length === 4 ? Number(parts[3]) : 1 };
    });
  }

  const glassOrSolid = (m: { filter: string; alpha: number }) => m.filter.includes('blur(') || (m.filter === 'none' && m.alpha === 1);

  /** The shell's own navigation (rail on a desktop, bottom bar on a phone): its look must not change with the style. */
  const navLook = (page: Page) =>
    page.evaluate(() => {
      const root = document.querySelector('sw-app')?.shadowRoot;
      const nav = root ? [...root.querySelectorAll('nav')].find((n) => getComputedStyle(n).display !== 'none') : null;
      if (!nav) return '';
      const cs = getComputedStyle(nav);
      return `${cs.backgroundColor}|${cs.backdropFilter}|${cs.color}|${cs.fontFamily}`;
    });

  async function evidenceShot(page: Page, name: string, project: string) {
    if (project !== 'desktop' && project !== 'mobile') return;
    fs.mkdirSync(EVIDENCE, { recursive: true });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(EVIDENCE, `devices-glass-${name}-${project}.png`), animations: 'disabled' });
  }

  test('6a: הגדרות › חשמל והתקנים switches the device screens to the glass style - the attribute and the glass material on the building, the area and the bulk dialog, the shell untouched; RTL first, mirrored for an LTR viewer', async ({ page, request }, testInfo) => {
    await seed(request);
    // home redesign: the building buttons are asserted in the toolbar row, so the quick-actions card (which carries them) is off here
    await request.patch('/api/v1/settings', { data: { 'home.widgets': { quick: { on: false } } } });
    await devicesSettings(request, DEVICES_DEFAULTS);
    const project = testInfo.project.name;
    const posted: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/api\/v1\/devices\/actions$/.test(req.url())) posted.push(req.url());
    });
    try {
      // the section, in the settings screen's own language: plain rows, two previews, the 6b note
      await open(page, '/system/diagnostics?tab=devices', 'a');
      const sec = page.locator('system-diagnostics sw-card[data-devices-settings]');
      await expect(sec).toBeVisible({ timeout: 30000 });
      await expect(sec).toHaveAttribute('heading', 'חשמל והתקנים');
      await expect(sec.locator('button[data-devices-swatch]')).toHaveCount(2);
      await expect(sec.locator('button[data-devices-swatch="smplwise"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(sec.locator('[data-devices-layout-next]')).toContainText('ערוך פריסה');
      const navBefore = await navLook(page);
      expect(navBefore).not.toBe('');
      // the glass preview picks the style (the select follows), and "שמור" stores it for the installation
      await sec.locator('button[data-devices-swatch="glass"]').click();
      await expect(sec.locator('button[data-devices-swatch="glass"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(sec.locator('select[data-set-devices-style]')).toHaveValue('glass');
      const saved = page.waitForResponse((r) => r.url().endsWith('/api/v1/settings') && r.request().method() === 'PATCH');
      await sec.locator('sw-button[data-save-devices]').click();
      expect((await saved).status()).toBe(200);
      expect((await (await request.get('/api/v1/settings')).json()).settings['devices.style']).toBe('glass');

      // the building screen carries the style; the glass material is on its surfaces (or the solid fallback)
      await open(page, '/devices/building', 'a');
      const b = page.locator('devices-building');
      const grid = b.locator('section[data-floor="cr007_ground"] .areas');
      const first = grid.locator('a.tile').first();
      await expect(first).toBeVisible({ timeout: 30000 });
      await expect(b).toHaveAttribute('data-devices-style', 'glass');
      await expect(b).toHaveAttribute('data-devices-theme', 'default'); // the one built-in palette (styles/devices-themes.ts)
      expect(await b.evaluate((e) => getComputedStyle(e).getPropertyValue('--sw-glass-blur').trim())).toContain('blur(');
      // the style reads named knobs (docs/design/DEVICE_THEMES.md); a knob drives what the tiles show
      expect(await b.evaluate((e) => getComputedStyle(e).getPropertyValue('--dv-radius-md').trim())).toBe('22px');
      expect(glassOrSolid(await material(b.locator('sw-kpi').first()))).toBe(true);
      expect(glassOrSolid(await material(first))).toBe(true);
      expect(await first.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe('22px'); // rounded tiles
      // the rest of the app is untouched: the shell's navigation looks exactly as before, and carries no style
      expect(await navLook(page)).toBe(navBefore);
      expect(await page.evaluate(() => document.querySelector('sw-app')!.hasAttribute('data-devices-style'))).toBe(false);

      // RTL (the product default): the first area tile starts on the right edge of its grid
      expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
      let gb = (await grid.boundingBox())!;
      let tb = (await first.boundingBox())!;
      expect(Math.abs(tb.x + tb.width - (gb.x + gb.width))).toBeLessThanOrEqual(2);
      expect(tb.x - gb.x).toBeGreaterThan(20); // more than one column: the tile is not simply full width
      expect(await b.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
      // an LTR viewer gets the mirror image, nothing overflows
      await page.evaluate(() => document.documentElement.setAttribute('dir', 'ltr'));
      await page.waitForTimeout(300);
      gb = (await grid.boundingBox())!;
      tb = (await first.boundingBox())!;
      expect(Math.abs(tb.x - gb.x)).toBeLessThanOrEqual(2);
      expect(await b.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));

      // prefers-reduced-motion: no hover lift; otherwise the tile lifts
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(await first.evaluate((e) => getComputedStyle(e).transitionProperty)).not.toContain('transform');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      expect(await first.evaluate((e) => getComputedStyle(e).transitionProperty)).toContain('transform');

      // the bulk dialog is in the style too; Escape closes it and nothing is sent
      await b.locator('sw-button[data-bulk-kind="lights_off"]').click();
      const dlg = b.locator('devices-bulk-dialog sw-dialog[data-bulk-dialog="confirm"]');
      await expect(dlg).toHaveCount(1);
      const box = await dlg.evaluate((d) => {
        const x = d.shadowRoot!.querySelector('.box')!;
        const cs = getComputedStyle(x);
        return { filter: cs.backdropFilter || 'none', bg: cs.backgroundColor };
      });
      expect(box.filter.includes('blur(') || /^rgb\(/.test(box.bg)).toBe(true);
      await page.keyboard.press('Escape');
      await expect(b.locator('devices-bulk-dialog sw-dialog[open]')).toHaveCount(0);
      expect(posted).toEqual([]);

      // evidence: the mockup's own view (tree panel + floor cards) in the glass style
      await setView(b.page(), 'cards');
      await expect(b.locator('section[data-floor-card="cr007_ground"]')).toBeVisible();
      expect(glassOrSolid(await material(b.locator('section[data-floor-card="cr007_ground"]')))).toBe(true);
      await evidenceShot(page, 'building', project);

      // the area screen: glass cards, icon-forward tiles with the icon at the tile's start (right) edge
      await open(page, '/devices/areas/cr007_lobby', 'a');
      const a = page.locator('devices-area');
      const lighting = a.locator('sw-card[data-card="lighting"]');
      await expect(lighting).toBeVisible({ timeout: 30000 });
      await expect(a).toHaveAttribute('data-devices-style', 'glass');
      expect(glassOrSolid(await material(lighting))).toBe(true);
      const tile = lighting.locator('.tile[data-entity="light.cr007_lobby"]');
      const icon = tile.locator('.t > sw-icon');
      expect(await icon.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe('50%');
      const tileBox = (await tile.boundingBox())!;
      const iconBox = (await icon.boundingBox())!;
      expect(tileBox.x + tileBox.width - (iconBox.x + iconBox.width)).toBeLessThan(24);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await evidenceShot(page, 'area', project);

      // dark: a dark OS alone changes nothing (the shell is light only); only the explicit host attribute - set by
      // slice 6b's devices.scheme - switches the palette to the mockup's dark glass
      const surface = () => a.evaluate((e) => getComputedStyle(e).getPropertyValue('--dv-surface').trim());
      await page.emulateMedia({ colorScheme: 'dark' });
      expect(await surface()).toBe('rgba(255, 255, 255, 0.64)');
      await page.emulateMedia({ colorScheme: 'light' });
      await a.evaluate((e) => e.setAttribute('data-devices-scheme', 'dark'));
      expect(await surface()).toBe('rgba(28, 28, 30, 0.72)');
      if (project === 'desktop') await evidenceShot(page, 'area-dark', project);
      await a.evaluate((e) => e.removeAttribute('data-devices-scheme'));
      expect(await surface()).toBe('rgba(255, 255, 255, 0.64)');
      expect(glassOrSolid(await material(lighting))).toBe(true);
      // less transparency asked for → the solid fallback (the same one an engine without backdrop-filter gets)
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
      if (await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches)) {
        const solid = await material(lighting);
        expect(solid.filter).toBe('none');
        expect(solid.alpha).toBe(1);
      } else {
        testInfo.annotations.push({ type: 'note', description: 'this engine cannot emulate prefers-reduced-transparency; the solid fallback was not exercised' });
      }
      await cdp.send('Emulation.setEmulatedMedia', { features: [] });
    } finally {
      await request.patch('/api/v1/settings', { data: { 'home.widgets': {} } }).catch(() => {});
      await devicesSettings(request, DEVICES_DEFAULTS);
    }
  });

  test('6a: devices.default_view opens a new viewer on that view (their own toggle wins after), devices.density tightens the screens, and the sensors card / climate strip can be hidden', async ({ browser, request }) => {
    await seed(request);
    await devicesSettings(request, DEVICES_DEFAULTS);
    // (a tall window: the home screen drops the climate strips first when it has to fit a shorter one - home redesign)
    let ctx = await browser.newContext({ viewport: { width: 1920, height: 1700 } }); // a fresh viewer (the dev default identity): no stored layout
    try {
      let p = await ctx.newPage();
      await open(p, '/devices/building', 'a');
      const b1 = p.locator('devices-building');
      await expect(b1.locator('section[data-floor-card="cr007_ground"]')).toBeVisible({ timeout: 30000 });
      await expectView(b1.page(), 'cards');
      await expect(b1).toHaveAttribute('data-devices-style', 'smplwise');
      await expect(b1).toHaveAttribute('data-devices-density', 'comfortable');
      await expect(b1.locator('[data-climate-strip]').first()).toBeVisible();
      await setView(b1.page(), 'tiles');
      const lobby1 = b1.locator('a.tile[data-area="cr007_lobby"]');
      await expect(lobby1.locator('.pills span[title="חיישנים"]')).toHaveCount(1);
      const padComfortable = await lobby1.evaluate((e) => parseFloat(getComputedStyle(e).paddingTop));
      await ctx.close();

      await devicesSettings(request, { 'devices.default_view': 'tiles', 'devices.density': 'compact', 'devices.show_sensors': 'false', 'devices.show_climate_strip': 'false' });
      ctx = await browser.newContext();
      p = await ctx.newPage();
      await open(p, '/devices/building', 'a');
      const b2 = p.locator('devices-building');
      const lobby = b2.locator('a.tile[data-area="cr007_lobby"]');
      await expect(lobby).toBeVisible({ timeout: 30000 }); // a viewer who never chose opens on the installation's view
      await expectView(b2.page(), 'tiles');
      await expect(b2).toHaveAttribute('data-devices-density', 'compact');
      expect(await lobby.evaluate((e) => parseFloat(getComputedStyle(e).paddingTop))).toBeLessThan(padComfortable);
      await expect(b2.locator('[data-climate-strip]')).toHaveCount(0);
      await expect(lobby.locator('.pills span[title="חיישנים"]')).toHaveCount(0);
      await expect(lobby.locator('.pills span[title="תאורה"]')).toHaveCount(1); // only the sensors count goes
      await expect(lobby).not.toHaveAttribute('data-counts', /sensors:/);
      // the viewer's own toggle wins from then on (remembered in this browser)
      await setView(b2.page(), 'cards');
      await p.reload();
      await expect(p.locator('devices-building section[data-floor-card="cr007_ground"]')).toBeVisible({ timeout: 30000 });
      await expectView(p, 'cards');
      // the floor card's area row: its data-counts follow the shown pills (no sensors count either)
      const row = p.locator('devices-building section[data-floor-card="cr007_ground"] a[data-area-row="cr007_lobby"]');
      await expect(row).toHaveAttribute('data-counts', /lights:1\/2/);
      await expect(row).not.toHaveAttribute('data-counts', /sensors:/);
      // the area screen: no sensors card, every other card as before, compact
      await open(p, '/devices/areas/cr007_lobby', 'a');
      const area = p.locator('devices-area');
      await expect(area.locator('sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
      await expect(area.locator('sw-card[data-card="sensors"]')).toHaveCount(0);
      // the security state is a read-only strip above the sections (area redesign 2026-09-30), not a card, until the owner lays the screen out
      await expect(area.locator('[data-security-strip]')).toHaveCount(1);
      await expect(area.locator('sw-card[data-card="security"]')).toHaveCount(0);
      await expect(area).toHaveAttribute('data-devices-density', 'compact');
      expect(await area.locator('sw-card[data-card="lighting"]').evaluate((e) => parseFloat(getComputedStyle(e).paddingTop))).toBe(10);
    } finally {
      await ctx.close().catch(() => {});
      await devicesSettings(request, DEVICES_DEFAULTS);
    }
  });

  test('6a: a viewer sees the section read-only (nothing to edit, no save) and is not offered the settings entry, while their device screens follow the installation style', async ({ browser, request }, testInfo) => {
    await seed(request);
    const user = `cr007six${testInfo.project.name}`;
    const bindings: string[] = [];
    await devicesSettings(request, { ...DEVICES_DEFAULTS, 'devices.style': 'glass' });
    try {
      bindings.push(await bindUser(request, user, 'viewer'));
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': user } });
      const p = await ctx.newPage();
      await open(p, '/live', 'a');
      await expect(p.locator(`sw-app a[href="${HREF}"]`).first()).toBeAttached({ timeout: 30000 });
      // the settings entry lives in the user menu (CR-013). A viewer holds alarm.view (since 2026-09-30), which opens exactly one
      // settings page - the alarm page of הגדרות › אבטחה (the section's address) - so the entry is offered but leads only there
      await p.locator(testInfo.project.name === 'mobile' ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]').click();
      await expect(p.locator('sw-app sw-user-menu [data-user-menu]')).toBeVisible();
      await expect(p.locator('sw-app sw-user-menu [data-menu-settings]')).toHaveAttribute('href', /^#\/system\/security(\/alarm)?$/);
      await expect(p.locator('sw-app nav a[href^="#/system/"]')).toHaveCount(0);
      await p.keyboard.press('Escape');
      // reached directly: the section shows the installation's choices, every control disabled, no save
      await open(p, '/system/diagnostics?tab=devices', 'a');
      const sec = p.locator('system-diagnostics sw-card[data-devices-settings]');
      await expect(sec).toBeVisible({ timeout: 30000 });
      await expect(sec.locator('[data-devices-readonly]')).toContainText('הרשאת מנהל מערכת');
      await expect(sec.locator('sw-button[data-save-devices]')).toHaveCount(0);
      for (const sel of ['select[data-set-devices-style]', 'select[data-set-devices-view]', 'select[data-set-devices-density]', 'select[data-set-devices-sensors]', 'select[data-set-devices-climate]']) {
        await expect(sec.locator(sel)).toBeDisabled();
      }
      await expect(sec.locator('button[data-devices-swatch="smplwise"]')).toBeDisabled();
      await expect(sec.locator('button[data-devices-swatch="glass"]')).toBeDisabled();
      await expect(sec.locator('button[data-devices-swatch="glass"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(sec.locator('select[data-set-devices-style]')).toHaveValue('glass');
      expect((await p.request.patch('/api/v1/settings', { data: { 'devices.style': 'smplwise' } })).status()).toBe(403);
      expect((await (await request.get('/api/v1/settings')).json()).settings['devices.style']).toBe('glass');
      // the viewer's own device screens follow the installation's style
      await open(p, '/devices/building', 'a');
      await expect(p.locator('devices-building')).toHaveAttribute('data-devices-style', 'glass', { timeout: 30000 });
      await ctx.close();
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      await devicesSettings(request, DEVICES_DEFAULTS);
    }
  });

  // ------------------------------------------------ CR-007 slice 6b: the layout editor and the colour themes
  // One layout per installation and screen (routers/device_layouts.py): every test starts from the automatic layout
  // and resets what it stored in `finally`.
  const LAYOUT_SCREENS = [['building', 'main'], ...AREAS.map((a) => ['area', a.area_id]), ['area', 'unassigned']] as const;

  async function resetLayouts(request: APIRequestContext) {
    for (const [scope, id] of LAYOUT_SCREENS) {
      const r = await request.delete(`/api/v1/devices/layouts/${scope}/${id}`);
      expect(r.status(), `reset ${scope}/${id}`).toBe(200);
    }
  }

  async function layoutShot(page: Page, name: string) {
    fs.mkdirSync(EVIDENCE, { recursive: true });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(EVIDENCE, `devices-layout-${name}.png`), animations: 'disabled' });
  }

  /** An item's layout in edit mode: "x,y,w,h" in grid units. */
  /** Owner notes 2026-09-30: the home screen's edit mode opens by address (the user menu's "עריכת המסך הראשי"), not by a button. */
  async function editBuilding(page: Page) {
    await page.evaluate(() => {
      location.hash = '#/devices/building?edit=1';
    });
    await expect(page.locator('devices-building [data-layout-bar]')).toBeVisible({ timeout: 15000 });
  }

  async function pos(item: Locator): Promise<{ x: number; y: number; w: number; h: number }> {
    const [x, y, w, h] = ((await item.getAttribute('data-lay-pos')) ?? '').split(',').map(Number);
    return { x, y, w, h };
  }

  /** The grid's column step (px) of a laid-out grid. */
  async function colStep(grid: Locator, cols: number): Promise<number> {
    return grid.evaluate((g, n) => (g.getBoundingClientRect().width + (parseFloat(getComputedStyle(g).columnGap) || 0)) / n, cols);
  }

  async function drag(page: Page, handle: Locator, dx: number, dy: number) {
    const b = (await handle.boundingBox())!;
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y + (dy * i) / 8);
    await page.mouse.up();
  }

  test('6b: "עריכת פריסה" (a user menu item) is offered only with system.configure, and a viewer\'s layout writes are refused by the server', async ({ page, browser, request }, testInfo) => {
    test.setTimeout(180_000);
    await seed(request);
    await resetLayouts(request);
    const user = `cr007lay${testInfo.project.name}`;
    const bindings: string[] = [];
    try {
      // the administrator (system.configure from the session) sees the button on both screens
      await open(page, '/devices/areas/cr007_lobby', 'a');
      await expect(page.locator('devices-area sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
      expect(await layoutEditOffered(page)).toBe(true);
      // owner notes 2026-09-30: the home screen has no button at all - its edit mode is `?edit=1` (the user menu)
      await open(page, '/devices/building', 'a');
      await expect(page.locator('devices-building a.tile[data-area="cr007_lobby"]')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('devices-building [data-layout-edit]')).toHaveCount(0);
      await open(page, '/devices/building?edit=1', 'a');
      await expect(page.locator('devices-building [data-layout-bar]')).toBeVisible({ timeout: 30000 });

      bindings.push(await bindUser(request, user, 'viewer'));
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': user } });
      const p = await ctx.newPage();
      await open(p, '/devices/areas/cr007_lobby', 'a');
      await expect(p.locator('devices-area sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
      expect(await layoutEditOffered(p)).toBe(false);
      await open(p, '/devices/building', 'a');
      await expect(p.locator('devices-building section[data-floor-card="cr007_ground"]')).toBeVisible({ timeout: 30000 }); // a fresh viewer: the cards view
      await expect(p.locator('devices-building [data-layout-edit]')).toHaveCount(0);
      // ?edit=1 gives a viewer no edit mode and leaves a clean address
      await open(p, '/devices/building?edit=1', 'a');
      await expect(p.locator('devices-building section[data-floor-card="cr007_ground"]')).toBeVisible({ timeout: 30000 });
      await expect(p.locator('devices-building [data-layout-bar], devices-building [data-home-edit]')).toHaveCount(0);
      await expect.poll(() => p.evaluate(() => location.hash)).toBe('#/devices/building');
      // the viewer reads the layout (it is shown to everyone) but every write is refused
      const got = await p.request.get('/api/v1/devices/layouts/area/cr007_lobby');
      expect(got.status()).toBe(200);
      expect((await got.json()).can_edit).toBe(false);
      const layout = { v: 1, cols: 12, items: { 'card:lighting': { x: 0, y: 0, w: 12, h: 10 } } };
      expect((await p.request.put('/api/v1/devices/layouts/area/cr007_lobby', { data: { variant: 'desktop', revision: 0, layout } })).status()).toBe(403);
      expect((await p.request.delete('/api/v1/devices/layouts/area/cr007_lobby')).status()).toBe(403);
      expect((await p.request.post('/api/v1/devices/layouts/area/cr007_lobby/copy-to-all-areas', { data: {} })).status()).toBe(403);
      expect((await (await request.get('/api/v1/devices/layouts/area/cr007_lobby')).json()).desktop).toBeNull();
      await ctx.close();
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      await resetLayouts(request);
    }
  });

  test('6b: the area layout on a desktop - drag and resize on the 8 px grid, the side panel, the keyboard; saved for everyone; RTL start edge; reset', async ({ page, browser, request }, testInfo) => {
    test.setTimeout(180_000);
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout (the phone layout has its own test)');
    await seed(request);
    await resetLayouts(request);
    await devicesSettings(request, DEVICES_DEFAULTS);
    const user = 'cr007layreader';
    const bindings: string[] = [];
    try {
      await open(page, '/devices/areas/cr007_lobby', 'a');
      const a = page.locator('devices-area');
      await expect(a.locator('sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
      await expect(a.locator('.lay-grid')).toHaveCount(0); // nothing stored: the automatic grid
      await enterLayoutEdit(page);
      await expect(a.locator('[data-layout-bar]')).toBeVisible();
      const grid = a.locator('.lay-grid[data-lay-cols="12"]');
      await expect(grid).toHaveCount(1);
      const light = a.locator('.lay-item[data-lay-key="card:lighting"]');
      const p0 = await pos(light);
      // the editor starts from what the automatic layout showed: the first card at the start edge, a third wide
      expect(p0.x).toBe(0);
      expect([3, 4]).toContain(p0.w); // 12 columns over the 3 or 4 automatic ones
      // RTL: column 1 is the start edge - on the right
      let gb = (await grid.boundingBox())!;
      let lb = (await light.boundingBox())!;
      expect(Math.abs(lb.x + lb.width - (gb.x + gb.width))).toBeLessThanOrEqual(2);
      await layoutShot(page, 'edit-desktop');

      // drag the card two columns toward the end (to the LEFT in RTL): x 0 -> 2; whatever it now covers moves down
      const step = await colStep(grid, 12);
      await drag(page, light.locator('[data-lay-handle]'), -2 * step, 0);
      let p1 = await pos(light);
      expect(p1.x).toBe(2);
      expect(p1.y).toBe(p0.y);
      // resize from the end corner: one column wider, 5 rows (40 px) taller - in grid units
      await drag(page, light.locator('[data-lay-resize]'), -step, 40);
      p1 = await pos(light);
      expect(p1.w).toBe(p0.w + 1);
      expect(p1.h).toBeGreaterThanOrEqual(p0.h + 4);
      // no two cards overlap after the moves
      const all = await a.locator('.lay-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-lay-pos')!.split(',').map(Number)));
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++) {
          const [ax, ay, aw, ah] = all[i];
          const [bx, by, bw, bh] = all[j];
          expect(ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah, `cards ${i} and ${j} overlap`).toBe(false);
        }
      // the keyboard: arrows move (ArrowRight = toward the start in RTL), Shift + arrows resize
      await light.focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowRight');
      let p2 = await pos(light);
      expect(p2).toEqual({ ...p1, x: p1.x - 1, y: p1.y + 2 });
      await page.keyboard.press('Shift+ArrowLeft');
      p2 = await pos(light);
      expect(p2.w).toBe(p1.w + 1);
      await expect(a.locator('[data-layout-live]')).toContainText(`רוחב ${p1.w + 1}`);

      // the side panel: title, icon, text size, colours by role, hidden
      const panel = a.locator('[data-layout-panel="card:lighting"]');
      await expect(panel).toBeVisible();
      await panel.locator('[data-layout-title]').fill('תאורה ראשית');
      await panel.locator('[data-layout-icon]').selectOption('star');
      await panel.locator('[data-layout-text="lg"]').click();
      await panel.locator('[data-layout-bg="warm"]').click();
      await panel.locator('[data-layout-border="accent"]').click();
      await expect(panel.locator('[data-layout-bg="warm"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(panel.locator('[data-layout-bg]')).toHaveCount(8); // "none" + the seven roles; no free colour
      await expect(panel.locator('input[type="color"]')).toHaveCount(0);
      await layoutShot(page, 'panel-desktop');
      const sensors = a.locator('.lay-item[data-lay-key="card:sensors"]');
      await sensors.click();
      await a.locator('[data-layout-panel="card:sensors"] [data-layout-hidden]').check();
      await expect(sensors).toHaveClass(/lay-hidden/);

      // save: one PUT, the editor closes, the layout is applied (grid units, never pixels)
      const saved = page.waitForResponse((r) => r.url().includes('/api/v1/devices/layouts/area/cr007_lobby') && r.request().method() === 'PUT');
      await a.locator('sw-button[data-layout-save]').click();
      expect((await saved).status()).toBe(200);
      await expect(a.locator('[data-layout-bar]')).toHaveCount(0);
      const applied = a.locator('.lay-item[data-lay-key="card:lighting"]');
      expect(await applied.evaluate((e) => (e as HTMLElement).style.gridColumn)).toBe(`${p2.x + 1} / span ${p2.w}`);
      await expect(applied.locator('sw-card')).toHaveAttribute('heading', 'תאורה ראשית');
      await expect(applied).toHaveAttribute('data-lay-bg', 'warm');
      expect(await applied.locator('sw-card').evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('gradient');
      const scaled = await applied.locator('sw-card').evaluate((e) => parseFloat(getComputedStyle(e.shadowRoot!.querySelector('h3')!).fontSize));
      const base = await a.locator('sw-card[data-card="climate"]').evaluate((e) => parseFloat(getComputedStyle(e.shadowRoot!.querySelector('h3')!).fontSize));
      expect(scaled).toBeGreaterThan(base * 1.1);
      await expect(a.locator('sw-card[data-card="sensors"]')).toHaveCount(0); // hidden for everyone
      const rec = await (await request.get('/api/v1/devices/layouts/area/cr007_lobby')).json();
      expect(rec.desktop.revision).toBe(1);
      expect(rec.desktop.layout.items['card:lighting']).toMatchObject({ x: p2.x, w: p2.w, text: 'lg', bg: 'warm', border: 'accent', title: 'תאורה ראשית', icon: 'star' });

      // persisted for another user: a viewer sees the same layout after a reload, and no editor
      bindings.push(await bindUser(request, user, 'viewer'));
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': user } });
      const p = await ctx.newPage();
      await open(p, '/devices/areas/cr007_lobby', 'a');
      const va = p.locator('devices-area');
      await expect(va.locator('.lay-item[data-lay-key="card:lighting"] sw-card')).toHaveAttribute('heading', 'תאורה ראשית', { timeout: 30000 });
      await expect(va.locator('sw-card[data-card="sensors"]')).toHaveCount(0);
      expect(await layoutEditOffered(p)).toBe(false);
      // an LTR viewer gets the mirror image of the same record: column 1 on the left
      await p.evaluate(() => document.documentElement.setAttribute('dir', 'ltr'));
      await p.waitForTimeout(300);
      const vg = (await va.locator('.lay-grid').boundingBox())!;
      const starts = va.locator('.lay-item').filter({ has: p.locator('sw-card') });
      const atStart = await starts.evaluateAll((els) => els.filter((e) => (e as HTMLElement).style.gridColumn.startsWith('1 /')).map((e) => e.getAttribute('data-lay-key')));
      expect(atStart.length).toBeGreaterThan(0);
      const firstBox = (await va.locator(`.lay-item[data-lay-key="${atStart[0]}"]`).boundingBox())!;
      expect(Math.abs(firstBox.x - vg.x)).toBeLessThanOrEqual(2);
      await ctx.close();

      // a stale editor is told so (409) and offered a reload, nothing is overwritten
      await page.reload();
      await page.waitForSelector('sw-app');
      await expect(a.locator('.lay-item[data-lay-key="card:lighting"] sw-card')).toHaveAttribute('heading', 'תאורה ראשית', { timeout: 30000 });
      await enterLayoutEdit(page);
      await a.locator('.lay-item[data-lay-key="card:lighting"]').focus();
      await page.keyboard.press('ArrowDown');
      const bump = await request.put('/api/v1/devices/layouts/area/cr007_lobby', { data: { variant: 'desktop', revision: 1, layout: rec.desktop.layout } });
      expect(bump.status()).toBe(200);
      await a.locator('sw-button[data-layout-save]').click();
      await expect(a.locator('[data-layout-error]')).toContainText('מישהו אחר שמר');
      await a.locator('[data-layout-error] sw-button[data-layout-reload]').click();
      await expect(a.locator('[data-layout-bar]')).toHaveCount(0);

      // "אפס לברירת מחדל": a confirmation, then the automatic grid again - for everyone
      await enterLayoutEdit(page);
      await a.locator('sw-button[data-layout-reset]').click();
      const dlg = a.locator('sw-dialog[data-layout-confirm="reset"]');
      await expect(dlg).toHaveAttribute('open', '');
      await dlg.locator('sw-button[data-layout-confirm-ok]').click();
      await expect(a.locator('.lay-grid')).toHaveCount(0);
      await expect(a.locator('sw-card[data-card="sensors"]')).toHaveCount(1);
      const after = await (await request.get('/api/v1/devices/layouts/area/cr007_lobby')).json();
      expect(after.desktop).toBeNull();
      expect(after.phone).toBeNull();
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      await resetLayouts(request);
    }
  });

  test('6b: "העתק לכל האזורים" copies the stored area layout after a confirmation; the building screen has its own layout (floor cards), the tiles view stays automatic', async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    test.skip(testInfo.project.name !== 'desktop', 'desktop editor flow');
    await seed(request);
    await resetLayouts(request);
    await devicesSettings(request, DEVICES_DEFAULTS);
    const layout = { v: 1, cols: 12, items: { 'card:climate': { x: 0, y: 0, w: 6, h: 30, bg: 'cool' }, 'card:lighting': { x: 6, y: 0, w: 6, h: 30 } } };
    try {
      expect((await request.put('/api/v1/devices/layouts/area/cr007_lobby', { data: { variant: 'desktop', revision: 0, layout } })).status()).toBe(200);
      await open(page, '/devices/areas/cr007_lobby', 'a');
      const a = page.locator('devices-area');
      await expect(a.locator('.lay-item[data-lay-key="card:climate"]')).toHaveAttribute('data-lay-bg', 'cool', { timeout: 30000 });
      await enterLayoutEdit(page);
      await a.locator('sw-button[data-layout-copy]').click();
      const dlg = a.locator('sw-dialog[data-layout-confirm="copy"]');
      await expect(dlg).toHaveAttribute('open', '');
      await expect(dlg).toContainText('כל שאר האזורים');
      // cancelling copies nothing
      await dlg.locator('sw-button[data-layout-confirm-cancel]').click();
      expect((await (await request.get('/api/v1/devices/layouts/area/cr007_office')).json()).desktop).toBeNull();
      await a.locator('sw-button[data-layout-copy]').click();
      const copied = page.waitForResponse((r) => r.url().endsWith('/copy-to-all-areas'));
      await a.locator('sw-dialog[data-layout-confirm="copy"] sw-button[data-layout-confirm-ok]').click();
      expect((await copied).status()).toBe(200);
      await expect(a.locator('[data-layout-bar]')).toContainText('הועתקה');
      for (const id of ['cr007_office', 'cr007_storage', 'cr007_hall', 'cr007_den', 'unassigned']) {
        const r = await (await request.get(`/api/v1/devices/layouts/area/${id}`)).json();
        expect(r.desktop?.layout.items['card:climate'].bg, id).toBe('cool');
      }
      await a.locator('sw-button[data-layout-cancel]').click();
      // another area shows the copied layout
      // (the office has no climate device: that card is not drawn there - owner feedback 2026-09-29 - the lighting card
      // takes the copied place)
      await open(page, '/devices/areas/cr007_office', 'a');
      await expect(page.locator('devices-area .lay-item[data-lay-key="card:lighting"]')).toHaveAttribute('style', /grid-column: ?7 \/ span 6/, { timeout: 30000 });
      await expect(page.locator('devices-area .lay-item[data-lay-key="card:climate"]')).toHaveCount(0);

      // the building screen: the floor cards are edited on their own grid; the tiles view is untouched (automatic)
      await open(page, '/devices/building', 'a');
      const b = page.locator('devices-building');
      await setView(b.page(), 'cards');
      await expect(b.locator('section[data-floor-card="cr007_ground"]')).toBeVisible({ timeout: 30000 });
      await editBuilding(page);
      await openViewMenu(page); // one view at a time while editing: the user menu offers no view choice then
      await expect(page.locator('sw-app sw-user-menu [data-menu-screen-view]')).toHaveCount(0);
      await closeMenu(page);
      const ground = b.locator('.lay-item[data-lay-key="floor:cr007_ground"]');
      const g0 = await pos(ground);
      await ground.focus();
      await page.keyboard.press('ArrowDown');
      await b.locator('[data-layout-panel="floor:cr007_ground"] [data-layout-title]').fill('קומת כניסה');
      await b.locator('sw-button[data-layout-save]').click();
      await expect(b.locator('[data-layout-bar]')).toHaveCount(0);
      await expect(b.locator('section[data-floor-card="cr007_ground"] header h2')).toHaveText('קומת כניסה');
      const brec = await (await request.get('/api/v1/devices/layouts/building/main')).json();
      expect(brec.desktop.layout.items['floor:cr007_ground'].y).toBe(g0.y + 1);
      expect(Object.keys(brec.desktop.layout.items).every((k: string) => k.startsWith('floor:'))).toBe(true);
      await setView(b.page(), 'tiles');
      await expect(b.locator('a.tile[data-area="cr007_lobby"]')).toBeVisible();
      await expect(b.locator('.areas.lay-grid')).toHaveCount(0);
    } finally {
      await resetLayouts(request);
    }
  });

  test('6b: the phone layout is derived from the desktop order (one column), then edited on its own - long press to pick, arrows to move; "חזור לאוטומטי"', async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    await seed(request);
    await resetLayouts(request);
    await devicesSettings(request, DEVICES_DEFAULTS);
    const mobile = testInfo.project.name === 'mobile';
    // desktop order: climate first (top), lighting under it
    const layout = { v: 1, cols: 12, items: { 'card:climate': { x: 6, y: 0, w: 6, h: 24 }, 'card:lighting': { x: 0, y: 30, w: 12, h: 30 }, 'card:covers': { x: 0, y: 0, w: 6, h: 20 } } };
    try {
      expect((await request.put('/api/v1/devices/layouts/area/cr007_lobby', { data: { variant: 'desktop', revision: 0, layout } })).status()).toBe(200);
      await open(page, '/devices/areas/cr007_lobby', 'a');
      const a = page.locator('devices-area');
      await expect(a.locator('.lay-item[data-lay-key="card:lighting"]')).toBeVisible({ timeout: 30000 });
      if (mobile) {
        // a viewer's phone: derived automatically - four columns, every card full width, in the desktop reading order
        const grid = a.locator('.lay-grid[data-lay-cols="4"]');
        await expect(grid).toHaveCount(1);
        const order = await a.locator('.lay-item').evaluateAll((els) => els.map((e) => [e.getAttribute('data-lay-key'), e.getBoundingClientRect().top] as [string, number]).sort((x, y) => x[1] - y[1]).map((x) => x[0]));
        expect(order.slice(0, 3)).toEqual(['card:covers', 'card:climate', 'card:lighting']);
        const gw = (await grid.boundingBox())!.width;
        expect((await a.locator('.lay-item[data-lay-key="card:climate"]').boundingBox())!.width).toBeGreaterThan(gw - 2);
        await enterLayoutEdit(page);
        await expect(a.locator('[data-layout-variant="phone"]')).toHaveAttribute('aria-pressed', 'true');
        await expect(a.locator('[data-layout-bar]')).toContainText('אוטומטית עד שתישמר');
        // a long press picks the card (a plain touch scrolls); the panel's arrows then move and resize it
        const item = a.locator('.lay-item[data-lay-key="card:lighting"]');
        await item.scrollIntoViewIfNeeded();
        const box = (await item.boundingBox())!;
        const cdp = await page.context().newCDPSession(page);
        const pt = { x: box.x + box.width / 2, y: box.y + Math.min(60, box.height / 2) };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
        await page.waitForTimeout(700);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect(a.locator('[data-layout-panel="card:lighting"]')).toBeVisible();
      } else {
        await enterLayoutEdit(page);
        await a.locator('[data-layout-variant="phone"]').click();
        await expect(a.locator('.lay-grid[data-lay-cols="4"][data-lay-phone-preview]')).toHaveCount(1);
        const order = await a.locator('.lay-item').evaluateAll((els) => els.map((e) => [e.getAttribute('data-lay-key'), e.getBoundingClientRect().top] as [string, number]).sort((x, y) => x[1] - y[1]).map((x) => x[0]));
        expect(order.slice(0, 3)).toEqual(['card:covers', 'card:climate', 'card:lighting']);
        await a.locator('.lay-item[data-lay-key="card:lighting"]').click();
      }
      const item = a.locator('.lay-item[data-lay-key="card:lighting"]');
      const before = await pos(item);
      expect(before).toMatchObject({ x: 0, w: 4 });
      const panel = a.locator('[data-layout-panel="card:lighting"]');
      await panel.locator('[data-layout-nudge="narrower"]').click();
      await panel.locator('[data-layout-nudge="narrower"]').click();
      await panel.locator('[data-layout-nudge="end"]').click();
      expect(await pos(item)).toMatchObject({ x: 1, w: 2 });
      if (mobile) await layoutShot(page, 'phone-edit');
      const saved = page.waitForResponse((r) => r.url().includes('/api/v1/devices/layouts/area/cr007_lobby') && r.request().method() === 'PUT');
      await a.locator('sw-button[data-layout-save]').click();
      const put = await saved;
      expect(put.status()).toBe(200);
      expect(JSON.parse(put.request().postData() ?? '{}').variant).toBe('phone');
      const rec = await (await request.get('/api/v1/devices/layouts/area/cr007_lobby')).json();
      expect(rec.phone.layout.cols).toBe(4);
      expect(rec.phone.layout.items['card:lighting']).toMatchObject({ x: 1, w: 2 });
      expect(rec.desktop.layout.items['card:lighting']).toMatchObject({ x: 0, w: 12 }); // the desktop layout is its own
      if (mobile) expect(await a.locator('.lay-item[data-lay-key="card:lighting"]').evaluate((e) => (e as HTMLElement).style.gridColumn)).toBe('2 / span 2');
      // "חזור לאוטומטי": the phone layout goes, derived from the desktop one again
      await enterLayoutEdit(page);
      if (!mobile) await a.locator('[data-layout-variant="phone"]').click();
      await a.locator('sw-button[data-layout-phone-auto]').click();
      await expect.poll(async () => (await (await request.get('/api/v1/devices/layouts/area/cr007_lobby')).json()).phone).toBeNull();
      expect(await pos(a.locator('.lay-item[data-lay-key="card:lighting"]'))).toMatchObject({ x: 0, w: 4 });
      await a.locator('sw-button[data-layout-cancel]').click();
    } finally {
      await resetLayouts(request);
    }
  });

  test('6b: the colour theme swatches set devices.theme and the knobs follow; dark applies only when chosen (devices.scheme light | dark | auto)', async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    await seed(request);
    await devicesSettings(request, { ...DEVICES_DEFAULTS, 'devices.style': 'glass' });
    const project = testInfo.project.name;
    const knob = (loc: Locator, name: string) => loc.evaluate((e, n) => getComputedStyle(e).getPropertyValue(n).trim(), name);
    /** A real page load (the installation settings are read once per load). */
    const fresh = async (hash: string) => {
      await page.goto('about:blank');
      await open(page, hash, 'a');
    };
    try {
      await open(page, '/system/diagnostics?tab=devices', 'a');
      const sec = page.locator('system-diagnostics sw-card[data-devices-settings]');
      await expect(sec).toBeVisible({ timeout: 30000 });
      const picker = sec.locator('devices-theme-picker');
      await expect(picker.locator('button[data-devices-theme-swatch]')).toHaveCount(4);
      await expect(picker.locator('button[data-devices-theme-swatch="default"]')).toHaveAttribute('aria-pressed', 'true');
      await picker.locator('button[data-devices-theme-swatch="forest"]').click();
      await expect(picker.locator('button[data-devices-theme-swatch="forest"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(picker.locator('select[data-set-devices-scheme]')).toHaveValue('light');
      await picker.scrollIntoViewIfNeeded();
      if (project === 'desktop') await layoutShot(page, 'theme-picker');
      const saved = page.waitForResponse((r) => r.url().endsWith('/api/v1/settings') && r.request().method() === 'PATCH');
      await sec.locator('sw-button[data-save-devices]').click();
      expect((await saved).status()).toBe(200);
      expect((await (await request.get('/api/v1/settings')).json()).settings['devices.theme']).toBe('forest');

      await fresh('/devices/areas/cr007_lobby');
      const a = page.locator('devices-area');
      await expect(a.locator('sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
      await expect(a).toHaveAttribute('data-devices-theme', 'forest');
      await expect(a).toHaveAttribute('data-devices-scheme', 'light');
      expect(await knob(a, '--dv-accent')).toBe('#2e7d4f');
      expect(await knob(a, '--dv-surface')).toBe('rgba(255, 255, 255, 0.66)');
      expect(await knob(a, '--dv-radius-md')).toBe('22px'); // the shape knobs are shared by every palette
      expect(await knob(a, '--dv-role-accent-bg')).toContain('46 125 79');
      // a dark operating system alone changes nothing: the default scheme is light
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(200);
      await expect(a).toHaveAttribute('data-devices-scheme', 'light');
      expect(await knob(a, '--dv-surface')).toBe('rgba(255, 255, 255, 0.66)');
      // "לפי המכשיר" (auto): dark on a dark device, and it follows the device live
      await devicesSettings(request, { 'devices.scheme': 'auto' });
      await fresh('/devices/areas/cr007_lobby');
      await expect(a.locator('sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
      await expect(a).toHaveAttribute('data-devices-scheme', 'dark');
      expect(await knob(a, '--dv-surface')).toBe('rgba(22, 32, 26, 0.74)');
      expect(await knob(a, '--dv-role-accent-bg')).toContain('79 191 127');
      await page.emulateMedia({ colorScheme: 'light' });
      await expect(a).toHaveAttribute('data-devices-scheme', 'light');
      // "כהה": dark whatever the device says
      await devicesSettings(request, { 'devices.scheme': 'dark' });
      await fresh('/devices/areas/cr007_lobby');
      await expect(a.locator('sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
      await expect(a).toHaveAttribute('data-devices-scheme', 'dark');
      expect(await knob(a, '--dv-color-scheme')).toBe('dark');
      // every palette sets its own colours, light and dark
      const accents = new Set<string>();
      for (const theme of ['default', 'sand', 'forest', 'graphite']) {
        await devicesSettings(request, { 'devices.theme': theme, 'devices.scheme': 'light' });
        await fresh('/devices/areas/cr007_lobby');
        await expect(a).toHaveAttribute('data-devices-theme', theme, { timeout: 30000 });
        await expect(a.locator('sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
        accents.add(await knob(a, '--dv-accent'));
        expect(await knob(a, '--dv-role-warm-bg'), theme).not.toBe('');
      }
      expect(accents.size).toBe(4);
      // the SMPLWISE style: its own tokens stay, the card colour roles still resolve per palette
      await devicesSettings(request, { 'devices.style': 'smplwise', 'devices.theme': 'sand', 'devices.scheme': 'dark' });
      await fresh('/devices/areas/cr007_lobby');
      await expect(a).toHaveAttribute('data-devices-style', 'smplwise', { timeout: 30000 });
      expect(await knob(a, '--dv-role-accent-bg')).toContain('179 87 42'); // sand's light role (smplwise is light only)
      expect(await knob(a, '--dv-surface')).toBe('');
    } finally {
      await page.emulateMedia({ colorScheme: 'light' });
      await devicesSettings(request, DEVICES_DEFAULTS);
    }
  });

  // ------------------------------------------------ 6b review round 1
  /** An item's first grid row (1-based) as the viewer's layout places it. */
  const rowOf = (loc: Locator) => loc.evaluate((e) => Number((e as HTMLElement).style.gridRow.split('/')[0].trim()));

  test('6b review: a floor-scoped viewer gets only their floors\' layout keys and no empty band; a hidden card or entity leaves no hole; compact packs the gaps', async ({ page, browser, request }, testInfo) => {
    test.setTimeout(180_000);
    await seed(request);
    await resetLayouts(request);
    await devicesSettings(request, DEVICES_DEFAULTS);
    const tag = testInfo.project.name;
    const bindings: string[] = [];
    let siteId: string | undefined;
    try {
      // floor A (a VMS floor) holds the office light: its viewer sees HA floor cr007_upper only
      const site = await request.post('/api/v1/sites', { data: { name: `CR-007 6b scoped site (${tag})` } });
      siteId = ((await site.json()) as { id: string }).id;
      const building = await request.post(`/api/v1/sites/${siteId}/buildings`, { data: { name: 'CR-007 6b building' } });
      const buildingId = ((await building.json()) as { id: string }).id;
      const floorA = ((await (await request.post(`/api/v1/buildings/${buildingId}/floors`, { data: { name: 'CR-007 6b floor A', level: 1 } })).json()) as { id: string }).id;
      const png = await (await request.get('/brand/smplwise-mark.png')).body();
      const asset = await request.post(`/api/v1/floors/${floorA}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } });
      const version = await request.post(`/api/v1/floors/${floorA}/plan-versions`, { data: { asset_id: ((await asset.json()) as { id: string }).id } });
      await request.post(`/api/v1/plan-versions/${((await version.json()) as { id: string }).id}/publish`);
      expect((await request.post(`/api/v1/floors/${floorA}/anchors`, { data: { resource_type: 'ha_entity', resource_id: 'light.cr007_office', x: 0.3, y: 0.3 } })).status()).toBe(201);
      const user = `cr007layA${tag}`;
      const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': user } })).json();
      const b = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: 'viewer', scope_type: 'floor', scope_id: floorA } });
      bindings.push(((await b.json()) as { id: string }).id);

      // the building's floor cards, one under the other; the ground floor first, with a title only its viewers may read
      const floors = { v: 1, cols: 12, items: {
        'floor:cr007_ground': { x: 0, y: 0, w: 12, h: 30, title: 'קומת הכניסה הפרטית' },
        'floor:cr007_upper': { x: 0, y: 32, w: 12, h: 30 },
        'floor:cr007_annex': { x: 0, y: 64, w: 12, h: 30 },
        'floor:unassigned': { x: 0, y: 96, w: 12, h: 20 },
      } };
      expect((await request.put('/api/v1/devices/layouts/building/main', { data: { variant: 'desktop', revision: 0, layout: floors } })).status()).toBe(200);
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': user } });
      const p = await ctx.newPage();
      const got = await p.request.get('/api/v1/devices/layouts/building/main');
      const text = await got.text();
      const body = JSON.parse(text);
      expect(Object.keys(body.desktop.layout.items)).toEqual(['floor:cr007_upper']);
      expect(body.narrowed).toBe(true);
      expect(body.desktop.updated_by).toBeNull();
      for (const leak of ['cr007_ground', 'cr007_annex', 'cr007_lobby', 'הפרטית']) expect(text).not.toContain(leak);
      await open(p, '/devices/building', 'a');
      const card = p.locator('devices-building .lay-item[data-lay-key="floor:cr007_upper"]');
      await expect(card).toBeVisible({ timeout: 30000 });
      expect(await rowOf(card)).toBe(1); // the rows the other floors held are packed away: no empty band above it
      await ctx.close();

      // a hidden card leaves no hole, desktop and (derived) phone alike; a hidden entity leaves the card, not its numbers
      const area = { v: 1, cols: 12, items: {
        'card:lighting': { x: 0, y: 0, w: 12, h: 20, hidden_entities: ['light.cr007_lobby_2'] },
        'card:climate': { x: 0, y: 22, w: 12, h: 20, hidden: true },
        'card:covers': { x: 0, y: 44, w: 12, h: 20 },
      } };
      expect((await request.put('/api/v1/devices/layouts/area/cr007_lobby', { data: { variant: 'desktop', revision: 0, layout: area } })).status()).toBe(200);
      await open(page, '/devices/areas/cr007_lobby', 'a');
      const a = page.locator('devices-area');
      const covers = a.locator('.lay-item[data-lay-key="card:covers"]');
      await expect(covers).toBeVisible({ timeout: 30000 });
      await expect(a.locator('sw-card[data-card="climate"]')).toHaveCount(0);
      expect(await rowOf(covers)).toBe(23); // lighting 0-20, the 2-row gap, then covers: climate's rows are gone
      const lighting = a.locator('sw-card[data-card="lighting"]');
      await expect(lighting.locator('.tile[data-entity="light.cr007_lobby"]')).toHaveCount(1);
      await expect(lighting.locator('.tile[data-entity="light.cr007_lobby_2"]')).toHaveCount(0);
      await expect(lighting).toHaveAttribute('subheading', /^2 התקנים/); // still counted
      // the editor still shows the hidden card in place, and the checklist lists both lights
      if (tag === 'desktop') {
        await enterLayoutEdit(page);
        await expect(a.locator('.lay-item.lay-hidden[data-lay-key="card:climate"]')).toHaveCount(1);
        await a.locator('.lay-item[data-lay-key="card:lighting"]').click();
        const checklist = a.locator('[data-layout-panel="card:lighting"] [data-layout-entities]');
        await expect(checklist.locator('input[data-layout-entity]')).toHaveCount(2);
        await expect(checklist.locator('input[data-layout-entity="light.cr007_lobby_2"]')).not.toBeChecked();
        await a.locator('sw-button[data-layout-cancel]').click();
      }
      // the compact density: one-row gaps and tighter columns under a saved layout
      await devicesSettings(request, { 'devices.density': 'compact' });
      await page.goto('about:blank');
      await open(page, '/devices/areas/cr007_lobby', 'a');
      await expect(covers).toBeVisible({ timeout: 30000 });
      expect(await rowOf(covers)).toBe(22);
      expect(await a.locator('.lay-grid').evaluate((g) => getComputedStyle(g).columnGap)).toBe('8px');
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      if (siteId) await request.delete(`/api/v1/sites/${siteId}`).catch(() => {});
      await devicesSettings(request, DEVICES_DEFAULTS);
      await resetLayouts(request);
    }
  });

  test('6b review: in edit mode the cards\' own controls are inert (Tab goes from the toolbar to the next card, never into one); the building tiles view is laid out on its own grids', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'keyboard editor flow');
    test.setTimeout(180_000);
    await seed(request);
    await resetLayouts(request);
    await devicesSettings(request, DEVICES_DEFAULTS);
    try {
      await open(page, '/devices/areas/cr007_lobby', 'a');
      const a = page.locator('devices-area');
      await expect(a.locator('sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
      await enterLayoutEdit(page);
      const body = a.locator('.lay-item[data-lay-key="card:lighting"] > sw-card');
      await expect(body).toHaveAttribute('inert', '');
      await expect(body).toHaveAttribute('aria-hidden', 'true');
      await a.locator('sw-button[data-layout-save] button').focus();
      const focused = async () => a.evaluate((e) => {
        const f = e.shadowRoot!.activeElement as HTMLElement | null;
        return f ? { item: f.classList.contains('lay-item'), key: f.getAttribute('data-lay-key'), inCard: !!f.closest('sw-card') } : null;
      });
      await page.keyboard.press('Tab');
      const first = await focused();
      expect(first?.item).toBe(true);
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Tab');
        const f = await focused();
        if (f) expect(f.inCard).toBe(false);
      }
      // Home / End / PageUp on the editor never reach a device: nothing is sent
      const sent: string[] = [];
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/ha\/entities\/[^/]+\/actions$/.test(r.url())) sent.push(r.url());
      });
      for (const k of ['Home', 'End', 'PageUp', 'PageDown', ' ']) await page.keyboard.press(k);
      expect(sent).toEqual([]);
      await a.locator('sw-button[data-layout-cancel]').click();
      await expect(a.locator('[data-lay-inert]')).toHaveCount(0); // controls live again after the editor closes

      // the building's tiles view: each floor's tiles on their own grid, saved as area:<id> items
      await open(page, '/devices/building', 'a');
      const b = page.locator('devices-building');
      await expect(b.locator('a.tile[data-area="cr007_lobby"]')).toBeVisible({ timeout: 30000 });
      await editBuilding(page);
      const lobby = b.locator('.lay-item[data-lay-key="area:cr007_lobby"]');
      const l0 = await pos(lobby);
      await lobby.focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await b.locator('[data-layout-panel="area:cr007_lobby"] [data-layout-title]').fill('לובי ראשי');
      await b.locator('sw-button[data-layout-save]').click();
      await expect(b.locator('[data-layout-bar]')).toHaveCount(0);
      const rec = await (await request.get('/api/v1/devices/layouts/building/main')).json();
      expect(rec.desktop.layout.items['area:cr007_lobby'].y).toBe(l0.y + 2);
      expect(Object.keys(rec.desktop.layout.items).every((k: string) => k.startsWith('area:'))).toBe(true);
      await page.reload();
      await page.waitForSelector('sw-app');
      await expect(b.locator('section[data-floor="cr007_ground"] .areas.lay-grid')).toHaveCount(1, { timeout: 30000 });
      await expect(b.locator('a.tile[data-area="cr007_lobby"] .name')).toHaveText('לובי ראשי');
      // the cards view keeps its automatic layout
      await setView(b.page(), 'cards');
      await expect(b.locator('.fcards.lay-grid')).toHaveCount(0);
      await setView(b.page(), 'tiles');
    } finally {
      await resetLayouts(request);
    }
  });

  // ------------------------------------------------ owner feedback 2026-09-29 (building screen screenshots)
  test('owner 2026-09-29: a click on an area row enters the area; hover and keyboard focus show its summary, the row\'s "⋯" opens it on touch; the popover stays in the viewport near the bottom edge, closes on Escape and on scroll; the floor title enters the floor', async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    await seed(request);
    await useLayout(page, 'cards');
    const mobile = testInfo.project.name === 'mobile';
    await open(page, '/devices/building', 'a');
    const scr = page.locator('devices-building');
    const wide = (page.viewportSize()?.width ?? 1440) >= 900;
    const menu = scr.locator(wide ? 'devices-bulk-menu[data-tree-area="cr007_lobby"]' : 'devices-bulk-menu[data-card-area="cr007_lobby"]');
    const row = menu.locator('a[data-area-row="cr007_lobby"]');
    await expect(row).toBeVisible({ timeout: 30000 });
    await expect(row).toHaveAttribute('href', '#/devices/areas/cr007_lobby');
    const panel = menu.locator('[data-bulk-panel="popover"]');
    if (!mobile) {
      // hover: the summary after a short delay - the chips and the quick actions; leaving closes it
      await row.hover();
      await expect(panel).toBeVisible();
      await expect(panel).toHaveAttribute('data-open-how', 'hover');
      await expect(panel.locator('[data-chip="lights"]')).toContainText('1/2');
      await expect(panel.locator('button[data-bulk-kind="lights_off"]')).toBeVisible();
      // the top layer: nothing paints over the popover (what is under its first line is the popover itself)
      const onTop = await panel.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = (el.getRootNode() as ShadowRoot).elementFromPoint(r.left + r.width / 2, r.top + 12);
        return !!hit && (hit === el || el.contains(hit));
      });
      expect(onTop).toBe(true);
      await page.mouse.move(2, 2);
      await expect(panel).toHaveCount(0);
      // keyboard focus shows it too; Escape closes it
      await page.keyboard.press('Tab');
      await row.focus();
      await expect(panel).toHaveAttribute('data-open-how', 'focus');
      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
    }
    // the row's own "⋯" opens the same popover (a touch screen has no hover)
    await menu.locator('[data-area-more]').click();
    await expect(panel).toBeVisible();
    await expect(panel.locator('a[data-open-area]')).toHaveAttribute('href', '#/devices/areas/cr007_lobby');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);

    // near the bottom edge: the popover opens above its row and stays inside the viewport; a scroll closes it
    const size = page.viewportSize()!;
    if (!mobile) await page.setViewportSize({ width: size.width, height: 600 });
    const low = scr.locator('devices-bulk-menu[data-card-area="cr007_den"]');
    await low.evaluate((el) => el.scrollIntoView({ block: 'end' }));
    await page.waitForTimeout(300);
    const rowBox = (await low.boundingBox())!;
    await low.locator('[data-area-more]').click();
    const lowPanel = low.locator('[data-bulk-panel="popover"]');
    await expect(lowPanel).toBeVisible();
    const vh = page.viewportSize()!.height;
    const vw = page.viewportSize()!.width;
    const box = (await lowPanel.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(vh + 1);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
    if (rowBox.y + rowBox.height + box.height > vh - 8) {
      await expect(lowPanel).toHaveAttribute('data-placement', 'above');
      expect(box.y + box.height).toBeLessThanOrEqual(rowBox.y + 1);
    }
    await scr.locator('.kpis').evaluate((el) => el.scrollIntoView({ block: 'start' })); // the page scrolls: the row moves away
    await expect(lowPanel).toHaveCount(0);
    if (!mobile) await page.setViewportSize(size);

    // a click on the row enters the area
    await row.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/areas/cr007_lobby');
    await expect(page.locator('devices-area sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
    // the floor card's title enters the floor (as "פתח קומה")
    await open(page, '/devices/building', 'a');
    await scr.locator('section[data-floor-card="cr007_annex"] button[data-floor-title="cr007_annex"]').click();
    await expect(scr.locator('section[data-floor-card]')).toHaveCount(1);
    await expect(scr.locator('section[data-floor-card="cr007_annex"]')).toBeVisible();
    await scr.locator('sw-button[data-open-floor="all"]').click();
  });

  test('owner 2026-09-29: empty domains are not shown - an area without covers has no covers card, a building without media players no "מסכים" counter; a card hidden because empty keeps its layout slot, its rows pack away, and it returns in place', async ({ page, request }, testInfo) => {
    test.setTimeout(150_000);
    await seed(request);
    await resetLayouts(request);
    await devicesSettings(request, DEVICES_DEFAULTS);
    const desktop = testInfo.project.name === 'desktop';
    try {
      // the den: lights and a climate only - exactly those two cards
      await open(page, '/devices/areas/cr007_den', 'a');
      const a = page.locator('devices-area');
      await expect(a.locator('sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
      expect((await a.locator('sw-card[data-card]').evaluateAll((els) => els.map((e) => e.getAttribute('data-card')))).sort()).toEqual(['climate', 'lighting']);
      await expect(a.locator('sw-card[data-card="covers"]')).toHaveCount(0);

      // a saved layout with a covers card on top: not drawn, and its rows are packed away
      const layout = { v: 1, cols: 12, items: { 'card:covers': { x: 0, y: 0, w: 12, h: 20 }, 'card:lighting': { x: 0, y: 22, w: 12, h: 20 }, 'card:climate': { x: 0, y: 44, w: 12, h: 20 } } };
      expect((await request.put('/api/v1/devices/layouts/area/cr007_den', { data: { variant: 'desktop', revision: 0, layout } })).status()).toBe(200);
      await page.goto('about:blank');
      await open(page, '/devices/areas/cr007_den', 'a');
      const lighting = a.locator('.lay-item[data-lay-key="card:lighting"]');
      await expect(lighting).toBeVisible({ timeout: 30000 });
      await expect(a.locator('sw-card[data-card="covers"]')).toHaveCount(0);
      if (desktop) {
        expect(await rowOf(lighting)).toBe(1);
        expect(await rowOf(a.locator('.lay-item[data-lay-key="card:climate"]'))).toBe(23);
        // the editor keeps the covers slot: moving the lighting card onto it pushes the slot down, and the save is not an overlap
        await enterLayoutEdit(page);
        await a.locator('.lay-item[data-lay-key="card:lighting"]').focus();
        for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowUp');
        const saved = page.waitForResponse((r) => r.url().includes('/api/v1/devices/layouts/area/cr007_den') && r.request().method() === 'PUT');
        await a.locator('sw-button[data-layout-save]').click();
        expect((await saved).status()).toBe(200);
        const rec = await (await request.get('/api/v1/devices/layouts/area/cr007_den')).json();
        expect(rec.desktop.layout.items['card:lighting'].y).toBe(16);
        expect(rec.desktop.layout.items['card:covers'].y).toBeGreaterThanOrEqual(38); // under the moved card
      }
      // the domain appears (a cover moves into the den): the card comes back in its saved slot
      const moved = ENTITIES.map((e) => (e.entity_id === 'cover.cr007_office' ? { ...e, area_id: 'cr007_den' } : e));
      expect((await request.post('/api/v1/ha/dev/registry', { data: { entities: moved, devices: [], areas: AREAS, floors: FLOORS } })).status()).toBe(200);
      await page.goto('about:blank');
      await open(page, '/devices/areas/cr007_den', 'a');
      await expect(a.locator('.lay-item[data-lay-key="card:covers"] sw-card[data-card="covers"]')).toBeVisible({ timeout: 30000 });
      const back = await (await request.get('/api/v1/devices/layouts/area/cr007_den')).json();
      if (desktop) expect(await a.locator('.lay-item[data-lay-key="card:covers"]').evaluate((e) => (e as HTMLElement).style.gridRow)).toContain(`${back.desktop.layout.items['card:covers'].y + 1}`);

      // the building without media players (disabled in Home Assistant): no "מסכים דולקים" counter, no media pill
      const noMedia = ENTITIES.map((e) => (e.entity_id.startsWith('media_player.') ? { ...e, disabled_by: 'user' } : e));
      expect((await request.post('/api/v1/ha/dev/registry', { data: { entities: noMedia, devices: [], areas: AREAS, floors: FLOORS } })).status()).toBe(200);
      const tree = await (await request.get('/api/v1/devices/tree')).json();
      expect(tree.building.media).toBe(0);
      await useLayout(page, 'cards');
      await page.goto('about:blank'); // a real load, so the init script picks the cards view
      await open(page, '/devices/building', 'a');
      const b = page.locator('devices-building');
      await expect(b.locator('sw-kpi[data-kpi="תאורה דולקת"]')).toBeVisible({ timeout: 30000 });
      await expect(b.locator('sw-kpi[data-kpi="מסכים דולקים"]')).toHaveCount(0);
      expect(await b.locator('sw-kpi').evaluateAll((els) => els.filter((e) => (e.getAttribute('detail') ?? '').includes('אין במבנה') || e.getAttribute('data-value') === '0/0').length)).toBe(0);
      const hall = b.locator('section[data-floor-card="cr007_annex"] a[data-area-row="cr007_hall"]');
      await expect(hall).toHaveAttribute('data-counts', /lights:/);
      await expect(hall).not.toHaveAttribute('data-counts', /media:/);
      // and the hall's quick actions offer no "כבה מסכים" (the hall has no screen now)
      await b.locator('devices-bulk-menu[data-card-area="cr007_hall"] [data-area-more]').click();
      await expect(b.locator('devices-bulk-menu[data-card-area="cr007_hall"] [data-bulk-panel] button[data-bulk-kind="screens_off"]')).toHaveCount(0);
      await expect(b.locator('devices-bulk-menu[data-card-area="cr007_hall"] [data-bulk-panel] button[data-bulk-kind="lights_off"]')).toHaveCount(1);
    } finally {
      await seed(request);
      await resetLayouts(request);
    }
  });

  // ------------------------------------------------ CR-007 slice 6c: device tiles inside the area cards (owner "1.א")
  /** The device tiles of an arranged card, in the order drawn. */
  const tileOrder = (scope: Locator) => scope.locator('.lay-tile').evaluateAll((els) => els.map((e) => e.getAttribute('data-lay-tile')));

  test('6c: "סידור התקנים" arranges a card\'s device tiles - drag and keyboard reorder, span, size, title, H hides (the card still counts it); saved for everyone, a viewer sees the order and cannot edit; "אפס סידור"', async ({ page, browser, request }, testInfo) => {
    test.setTimeout(180_000);
    await seed(request);
    await resetLayouts(request);
    await devicesSettings(request, DEVICES_DEFAULTS);
    const mobile = testInfo.project.name === 'mobile';
    const variant = mobile ? 'phone' : 'desktop'; // the editor opens on the viewport's own layout
    const user = `cr007tiles${testInfo.project.name}`;
    const bindings: string[] = [];
    try {
      await open(page, '/devices/areas/cr007_lobby', 'a');
      const a = page.locator('devices-area');
      const lightingCard = a.locator('sw-card[data-card="lighting"]');
      await expect(lightingCard).toBeVisible({ timeout: 30000 });
      await expect(lightingCard).toHaveAttribute('subheading', /^2 התקנים · 1 פעילים/);
      const areaCount = async () => {
        const o = await areaOption(page, 'cr007_lobby');
        const n = await o.opt.getAttribute('data-count');
        await o.close();
        return n;
      };
      const chipCount = await areaCount();
      await enterLayoutEdit(page);
      await expect(a.locator(`[data-layout-variant="${variant}"]`)).toHaveAttribute('aria-pressed', 'true');
      // the card's own "סידור התקנים": the card alone, a breadcrumb back, the tiles panel
      await a.locator('[data-lay-tiles-enter="card:lighting"]').click();
      const stage = a.locator('[data-lay-stage="card:lighting"]');
      await expect(stage).toBeVisible();
      await expect(a.locator('[data-layout-tiles-crumb]')).toContainText('סידור התקנים');
      await expect(a.locator('sw-card[data-card="climate"]')).toHaveCount(0);
      await expect(a.locator('[data-layout-panel="tiles:card:lighting"]')).toBeVisible();
      // the automatic order (the server's: by name - "ספוט לובי" before "תאורת לובי")
      expect(await tileOrder(stage)).toEqual(['light.cr007_lobby_2', 'light.cr007_lobby']);
      // the tiles' own controls are inert while arranged (a key never reaches a device)
      const lobbyTile = stage.locator('.lay-tile[data-lay-tile="light.cr007_lobby"]');
      const spotTile = stage.locator('.lay-tile[data-lay-tile="light.cr007_lobby_2"]');
      await expect(lobbyTile.locator('.tile[data-entity="light.cr007_lobby"]')).toHaveAttribute('inert', '');
      await expect(lobbyTile.locator('.tile[data-entity="light.cr007_lobby"]')).toHaveAttribute('aria-hidden', 'true');
      const sent: string[] = [];
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/ha\/entities\/[^/]+\/actions$/.test(r.url())) sent.push(r.url());
      });
      if (!mobile) {
        // drag the second tile onto the first: it takes its place
        await drag(page, lobbyTile.locator('[data-lay-thandle]'), 0, 0); // a press without a move selects only
        expect(await tileOrder(stage)).toEqual(['light.cr007_lobby_2', 'light.cr007_lobby']);
        const from = (await lobbyTile.locator('[data-lay-thandle]').boundingBox())!;
        const to = (await spotTile.boundingBox())!;
        await drag(page, lobbyTile.locator('[data-lay-thandle]'), to.x + to.width / 2 - (from.x + from.width / 2), to.y + to.height / 2 - (from.y + from.height / 2));
        expect(await tileOrder(stage)).toEqual(['light.cr007_lobby', 'light.cr007_lobby_2']);
        // and back with the keyboard: ArrowLeft moves toward the end in RTL (later)
        await lobbyTile.focus();
        await page.keyboard.press('ArrowLeft');
        await expect.poll(() => tileOrder(stage)).toEqual(['light.cr007_lobby_2', 'light.cr007_lobby']);
      }
      // the keyboard: ArrowRight moves a tile toward the start in RTL (earlier), Shift + arrows change its span
      await lobbyTile.focus();
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => tileOrder(stage)).toEqual(['light.cr007_lobby', 'light.cr007_lobby_2']);
      await expect(a.locator('[data-layout-live]')).toContainText('מקום 1 מתוך 2');
      await page.keyboard.press('Shift+ArrowLeft');
      await expect(lobbyTile).toHaveAttribute('data-lay-tpos', '0,2,m');
      await expect(a.locator('[data-layout-live]')).toContainText('רוחב מלא');
      const tgrid = stage.locator('.lay-tgrid');
      expect((await lobbyTile.boundingBox())!.width).toBeGreaterThan((await tgrid.boundingBox())!.width - 4);
      // the panel: a custom title (text) and the size
      const panel = a.locator('[data-layout-panel="tile:light.cr007_lobby"]');
      await expect(panel).toBeVisible();
      await panel.locator('[data-layout-tile-title]').fill('תאורה <b>ראשית</b>');
      await panel.locator('[data-layout-tile-size="l"]').click();
      await expect(lobbyTile).toHaveAttribute('data-tile-size', 'l');
      await expect(lobbyTile.locator('.tile .t > span')).toHaveText('תאורה <b>ראשית</b>'); // text, never markup
      await expect(lobbyTile.locator('.tile .t > span b')).toHaveCount(0);
      // H hides the spot (dimmed here, still in place); nothing reached a device
      await spotTile.focus();
      await page.keyboard.press('h');
      await expect(spotTile).toHaveClass(/lay-hidden/);
      await expect(spotTile).toHaveAttribute('data-lay-tpos', '1,1,m');
      for (const k of ['Home', 'End', ' ', 'PageDown']) await page.keyboard.press(k);
      expect(sent).toEqual([]);
      await lobbyTile.focus();
      if (mobile) {
        // the phone evidence: the short hint sheet (nothing selected) and the card in view under the compact bar
        await page.keyboard.press('Escape');
        await expect(a.locator('[data-layout-panel="tiles:card:lighting"]')).toBeVisible();
        await expect(a.locator('[data-layout-bar] [data-layout-copy]')).toBeHidden();
        await stage.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      }
      await layoutShot(page, mobile ? 'tiles-phone' : 'tiles-desktop');

      // the breadcrumb goes back to the cards (the arrangement stays in the draft); save for everyone
      await a.locator('[data-layout-tiles-crumb] [data-layout-tiles-back]').click();
      await expect(stage).toHaveCount(0);
      await expect(a.locator('.lay-item.lay-edit[data-lay-key="card:climate"]')).toHaveCount(1);
      const saved = page.waitForResponse((r) => r.url().includes('/api/v1/devices/layouts/area/cr007_lobby') && r.request().method() === 'PUT');
      await a.locator('sw-button[data-layout-save]').click();
      const put = await saved;
      expect(put.status()).toBe(200);
      expect(JSON.parse(put.request().postData() ?? '{}')).toMatchObject({ variant, layout: { v: 2 } });
      await expect(a.locator('[data-layout-bar]')).toHaveCount(0);
      const rec = await (await request.get('/api/v1/devices/layouts/area/cr007_lobby')).json();
      const item = rec[variant].layout.items['card:lighting'];
      expect(rec[variant].layout.v).toBe(2);
      expect(item.tiles['light.cr007_lobby']).toEqual({ order: 0, span: 2, size: 'l', hidden: false, title: 'תאורה <b>ראשית</b>' });
      expect(item.tiles['light.cr007_lobby_2']).toMatchObject({ order: 1, span: 1, size: 'm', hidden: true });
      expect(item.hidden_entities).toEqual(['light.cr007_lobby_2']);
      // applied: the saved order, span and size; the hidden spot gone from the card but still counted
      const card = a.locator('sw-card[data-card="lighting"]');
      expect(await tileOrder(card)).toEqual(['light.cr007_lobby']);
      await expect(card.locator('.lay-tile[data-lay-tile="light.cr007_lobby"]')).toHaveAttribute('data-tile-size', 'l');
      await expect(card.locator('.lay-tile[data-lay-tile="light.cr007_lobby"]')).toHaveAttribute('style', /span 2/);
      await expect(card.locator('.tile[data-entity="light.cr007_lobby"]')).toContainText('תאורה <b>ראשית</b>');
      await expect(card).toHaveAttribute('subheading', /^2 התקנים · 1 פעילים/);
      expect(await areaCount()).toBe(chipCount);
      // the tile's controls work again outside the editor
      await expect(card.locator('.tile[data-entity="light.cr007_lobby"] sw-toggle[data-control="power"]')).toBeVisible();
      await expect(a.locator('[data-lay-inert]')).toHaveCount(0);

      // a viewer sees the same order and cannot edit (no button, and the server refuses)
      bindings.push(await bindUser(request, user, 'viewer'));
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': user }, viewport: page.viewportSize()!, locale: 'he-IL' });
      const p = await ctx.newPage();
      await open(p, '/devices/areas/cr007_lobby', 'a');
      const vcard = p.locator('devices-area sw-card[data-card="lighting"]');
      await expect(vcard.locator('.lay-tile[data-lay-tile="light.cr007_lobby"]')).toBeVisible({ timeout: 30000 });
      expect(await tileOrder(vcard)).toEqual(['light.cr007_lobby']);
      await expect(vcard).toContainText('תאורה <b>ראשית</b>');
      await expect(vcard).toHaveAttribute('subheading', /^2 התקנים/);
      expect(await layoutEditOffered(p)).toBe(false);
      await expect(p.locator('devices-area [data-lay-tiles-enter]')).toHaveCount(0);
      expect((await p.request.put('/api/v1/devices/layouts/area/cr007_lobby', { data: { variant, revision: rec[variant].revision, layout: rec[variant].layout } })).status()).toBe(403);
      await ctx.close();

      // "אפס סידור": the card's automatic order again, its hidden light stays hidden; the change is only a draft until saved
      await enterLayoutEdit(page);
      await a.locator('[data-lay-tiles-enter="card:lighting"]').click();
      expect(await tileOrder(stage)).toEqual(['light.cr007_lobby', 'light.cr007_lobby_2']);
      await a.locator('[data-layout-panel="tiles:card:lighting"] [data-layout-tiles-reset]').click();
      await expect.poll(() => tileOrder(stage)).toEqual(['light.cr007_lobby_2', 'light.cr007_lobby']);
      await expect(stage.locator('.lay-tile[data-lay-tile="light.cr007_lobby_2"]')).toHaveClass(/lay-hidden/);
      await expect(stage.locator('.lay-tile[data-lay-tile="light.cr007_lobby"]')).toHaveAttribute('data-lay-tpos', '1,1,m');
      // Escape with nothing selected goes back to the cards; "בטל" drops the draft
      await stage.locator('.lay-tile[data-lay-tile="light.cr007_lobby"]').focus();
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await expect(stage).toHaveCount(0);
      await a.locator('sw-button[data-layout-cancel]').click();
      expect((await (await request.get('/api/v1/devices/layouts/area/cr007_lobby')).json())[variant].revision).toBe(rec[variant].revision);
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      await resetLayouts(request);
    }
  });

  test('6c: the phone layout derives the tile order from the desktop (every tile full width), then is arranged on its own; the desktop arrangement stays', async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    await seed(request);
    await resetLayouts(request);
    await devicesSettings(request, DEVICES_DEFAULTS);
    const mobile = testInfo.project.name === 'mobile';
    const layout = { v: 2, cols: 12, items: {
      'card:lighting': { x: 0, y: 0, w: 12, h: 20, tiles: { 'light.cr007_lobby_2': { order: 0, span: 1 }, 'light.cr007_lobby': { order: 1, span: 1 } } },
      'card:climate': { x: 0, y: 22, w: 12, h: 20 },
    } };
    try {
      expect((await request.put('/api/v1/devices/layouts/area/cr007_lobby', { data: { variant: 'desktop', revision: 0, layout } })).status()).toBe(200);
      await open(page, '/devices/areas/cr007_lobby', 'a');
      const a = page.locator('devices-area');
      const card = a.locator('sw-card[data-card="lighting"]');
      await expect(card.locator('.lay-tile[data-lay-tile="light.cr007_lobby_2"]')).toBeVisible({ timeout: 30000 });
      // the viewer's own layout: the desktop order on both; on a phone every tile is the card's full width
      expect(await tileOrder(card)).toEqual(['light.cr007_lobby_2', 'light.cr007_lobby']);
      const spans = await card.locator('.lay-tile').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile-span')));
      expect(spans).toEqual(mobile ? ['2', '2'] : ['1', '1']);
      if (mobile) {
        const gw = (await card.locator('.lay-tgrid').boundingBox())!.width;
        expect((await card.locator('.lay-tile').first().boundingBox())!.width).toBeGreaterThan(gw - 4);
      }
      // the phone layout, arranged on its own
      await enterLayoutEdit(page);
      if (!mobile) await a.locator('[data-layout-variant="phone"]').click();
      await expect(a.locator('[data-layout-variant="phone"]')).toHaveAttribute('aria-pressed', 'true');
      await a.locator('[data-lay-tiles-enter="card:lighting"]').click();
      const stage = a.locator('[data-lay-stage="card:lighting"]');
      if (!mobile) await expect(stage).toHaveAttribute('data-lay-phone-preview', '');
      expect(await tileOrder(stage)).toEqual(['light.cr007_lobby_2', 'light.cr007_lobby']);
      const spot = stage.locator('.lay-tile[data-lay-tile="light.cr007_lobby_2"]');
      await expect(spot).toHaveAttribute('data-lay-tpos', '0,2,m');
      await spot.focus();
      await page.keyboard.press('ArrowLeft'); // RTL: toward the end - later
      await expect.poll(() => tileOrder(stage)).toEqual(['light.cr007_lobby', 'light.cr007_lobby_2']);
      await page.keyboard.press('Shift+ArrowRight'); // narrower: half the card
      await expect(spot).toHaveAttribute('data-lay-tpos', '1,1,m');
      const saved = page.waitForResponse((r) => r.url().includes('/api/v1/devices/layouts/area/cr007_lobby') && r.request().method() === 'PUT');
      await a.locator('sw-button[data-layout-save]').click();
      const put = await saved;
      expect(put.status()).toBe(200);
      expect(JSON.parse(put.request().postData() ?? '{}').variant).toBe('phone');
      const rec = await (await request.get('/api/v1/devices/layouts/area/cr007_lobby')).json();
      expect(rec.phone.layout.cols).toBe(4);
      expect(rec.phone.layout.items['card:lighting'].tiles).toMatchObject({ 'light.cr007_lobby': { order: 0, span: 2 }, 'light.cr007_lobby_2': { order: 1, span: 1 } });
      expect(rec.desktop.layout.items['card:lighting'].tiles).toMatchObject({ 'light.cr007_lobby_2': { order: 0, span: 1 }, 'light.cr007_lobby': { order: 1, span: 1 } }); // its own
      // each viewport draws its own arrangement
      await expect.poll(() => tileOrder(card)).toEqual(mobile ? ['light.cr007_lobby', 'light.cr007_lobby_2'] : ['light.cr007_lobby_2', 'light.cr007_lobby']);
    } finally {
      await resetLayouts(request);
    }
  });

  test('6c review: the card being arranged loses its last device (a structure refresh) - the editor goes back to the cards and says why, no breadcrumb or tile panel left behind', async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    test.skip(testInfo.project.name !== 'desktop', 'editor flow');
    await seed(request);
    await resetLayouts(request);
    try {
      await open(page, '/devices/areas/cr007_den', 'a');
      const a = page.locator('devices-area');
      await expect(a.locator('sw-card[data-card="climate"]')).toBeVisible({ timeout: 30000 });
      await enterLayoutEdit(page);
      await a.locator('[data-lay-tiles-enter="card:climate"]').click();
      await expect(a.locator('[data-lay-stage="card:climate"]')).toBeVisible();
      // Home Assistant moves the den's only climate device to the hall (the fixture's registry control)
      const moved = ENTITIES.map((e) => (e.entity_id === 'climate.cr007_den' ? { ...e, area_id: 'cr007_hall' } : e));
      expect((await request.post('/api/v1/ha/dev/registry', { data: { entities: moved, devices: [], areas: AREAS, floors: FLOORS } })).status()).toBe(200);
      await expect(a.locator('[data-lay-stage]')).toHaveCount(0, { timeout: 20000 });
      await expect(a.locator('[data-layout-tiles-crumb]')).toHaveCount(0);
      await expect(a.locator('[data-layout-panel^="tile"]')).toHaveCount(0);
      await expect(a.locator('[data-layout-bar]')).toContainText('כבר אין התקנים');
      await expect(a.locator('.lay-item.lay-edit[data-lay-key="card:lighting"]')).toBeVisible(); // still editing, the cards back
      await a.locator('sw-button[data-layout-cancel]').click();
    } finally {
      await seed(request);
      await resetLayouts(request);
    }
  });
});
