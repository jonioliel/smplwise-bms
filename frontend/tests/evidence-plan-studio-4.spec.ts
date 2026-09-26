import { test, expect, type APIRequestContext, type Locator, type Page, type WebSocketRoute } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTION_STATUS_LABEL } from '../src/api/ha';

// Plan Studio phase 4 (T087) against the running developer backend in real Chrome: the 3D toggle on the live map, the
// history map and the event page, selection sync, layers, levels, live states through the dev state route, the lamp
// action through the existing route (answered in the browser - ruling R-P2-T13-1), coverage stopped by walls, the
// anchor fields, the building page isometric, the glTF export, embed mode, the WebGL gate, the phone and the frame rate.
// The spec builds its own site / building / floor on the committed apartment fixture and removes them at the end.
// Runs only with SW_LIVE=1 SW_CHROME=1 (backend on 8099 behind the preview proxy on 4173).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'tests', 'fixtures', 'plan_detect', 'apartment.png');
export const HOST = 'explore-floor-map';
export const ENTITIES = { lamp: 'light.p4_lamp', lock: 'lock.p4_door', sw: 'switch.p4_k' };
export const ids = { site: '', building: '', floor: '', version: '', camera: '', camAnchor: '', lockAnchor: '', lampAnchor: '', floor2: '' };
export let api: APIRequestContext;

type Desc = { estimated: boolean; parts: { id: string; kind: string; color: string; opacity: number; position: [number, number, number]; rotation: [number, number, number]; level_id: string | null; polygon?: [number, number][]; userData: { id: string; kind: string } }[] };

/** The element's description, read straight off the element (it is a public property). */
export const describe3d = (page: Page, host: string) => page.locator(`${host} sw-plan-3d`).evaluate((node) => (node as unknown as { description: Desc }).description);
/** Host pixels of a part's centre, projected by the element. */
export async function partScreen(page: Page, host: string, partId: string): Promise<{ x: number; y: number }> {
  const el = page.locator(`${host} sw-plan-3d`);
  const box = (await el.boundingBox())!;
  const at = await el.evaluate((node, id) => {
    const e = node as unknown as { description: Desc; toScreen: (p: [number, number, number]) => { x: number; y: number } | null };
    const p = e.description.parts.find((x) => x.id === id);
    return p ? e.toScreen(p.position) : null;
  }, partId);
  expect(at, `part ${partId} on screen`).toBeTruthy();
  return { x: box.x + at!.x, y: box.y + at!.y };
}
export const draft = async () => (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json()) as { geometry: { revision: number }; doc: Record<string, unknown> };
export const saveDraft = async (patch: Record<string, unknown>) => {
  const g = await draft();
  expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc: { ...g.doc, ...patch }, base_revision: g.geometry.revision } })).status()).toBe(200);
};
export const publish = async () => expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
/** sw-button is not a native control, so toBeEnabled cannot fail on it (Task 9 review): the host's disabled attribute can. */
export async function expectEnabled(l: Locator, timeout = 30000): Promise<void> {
  await expect(l).toBeAttached({ timeout });
  await expect(l).not.toHaveAttribute('disabled', '', { timeout });
}
type Bundle = { anchors: { entity: { fresh: boolean } | null }[]; circuit_states: Record<string, { fresh: boolean; can_control: boolean; actions: unknown[] }> };
/** The developer backend runs without Home Assistant: its sync is down and every entity answers fresh=false, which the
 * live map (2D and 3D) shows as unknown. For the live-state tests the screen sees a connected sync: the floor's bundle
 * and the WebSocket frames are answered fresh here - the states themselves still come from the dev state route.
 * `mutate` edits the bundle further; `syncLost` / `syncBack` send the sync message Home Assistant's loss would. */
export async function connectedHa(page: Page, floorId: string, mutate: (b: Bundle) => void = () => undefined) {
  let client: WebSocketRoute | null = null;
  let connected = true;
  await page.route(`**/api/v1/floors/${floorId}/map*`, async (r) => {
    const res = await r.fetch();
    const body = (await res.json()) as Bundle;
    for (const a of body.anchors) if (a.entity) a.entity.fresh = true;
    for (const c of Object.values(body.circuit_states)) c.fresh = true;
    mutate(body);
    await r.fulfill({ response: res, json: body });
  });
  await page.routeWebSocket('**/api/v1/ha/ws', (ws) => {
    client = ws;
    const server = ws.connectToServer();
    server.onMessage((m) => {
      try {
        const env = JSON.parse(String(m)) as { type: string; payload: { entity?: { fresh: boolean }; connected?: boolean; sync?: { connected: boolean } } };
        if (env.payload.entity) env.payload.entity.fresh = connected;
        if (env.type === 'ha_sync_state') env.payload.connected = connected;
        if (env.payload.sync) env.payload.sync.connected = connected;
        ws.send(JSON.stringify(env));
      } catch {
        ws.send(m);
      }
    });
  });
  const say = (on: boolean) => {
    connected = on;
    client?.send(JSON.stringify({ type: 'ha_sync_state', payload: { connected: on } }));
  };
  return { syncLost: () => say(false), syncBack: () => say(true), unroute: () => page.unroute(`**/api/v1/floors/${floorId}/map*`) };
}
/** The local date the screens stamp on a download (YYYY-MM-DD in the browser's time zone). */
const localDate = (page: Page) => page.evaluate(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; });
const WALL = (id: string, polyline: [number, number][], level = 'L0', extra: Record<string, unknown> = {}) => ({ id, level_id: level, polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });
const OBJ = (id: string, item_id: string, position: [number, number], extra: Record<string, unknown> = {}) => ({ id, item_id, level_id: 'L0', position, rotation_deg: 0, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });

test.describe.serial('plan studio phase 4 (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173/' });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת תלת-ממד ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה 3D' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'אולם 3D', level: 0 } })).json()).id;
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'apartment.png', mimeType: 'image/png', buffer: fs.readFileSync(FIXTURE) } } })).json();
    ids.version = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
    // 1 m = 100 px: the 1600 px plan is 16 m wide
    expect((await api.patch(`api/v1/plan-versions/${ids.version}/calibration`, { data: { pairs: [{ a: [0, 0.5], b: [1, 0.5], metres: 16 }] } })).status()).toBe(200);
    // entities as if Home Assistant sent them (developer identity mode only), then the anchors
    expect((await api.post('api/v1/ha/dev/states', { data: { states: [
      { entity_id: ENTITIES.lamp, state: 'off', attributes: { friendly_name: 'מנורת אולם' } },
      { entity_id: ENTITIES.lock, state: 'locked', attributes: { friendly_name: 'דלת אולם' } },
      { entity_id: ENTITIES.sw, state: 'on', attributes: { friendly_name: 'מפסק אולם' } },
    ] } })).status()).toBe(200);
    const cams = (await (await api.get('api/v1/cameras')).json()).cameras as { id: string }[];
    ids.camera = cams[0]?.id ?? (await (await api.post('api/v1/cameras', { data: { channel: 61, alias: 'מצלמת 3D' } })).json()).id;
    // the camera at the plan centre (8 m, 6 m) looks north at the room's wall 4.8 m ahead; its radius (0.5 x 1600 px) is 8 m
    ids.camAnchor = (await (await api.post(`api/v1/floors/${ids.floor}/anchors`, { data: { resource_type: 'camera', resource_id: ids.camera, x: 0.5, y: 0.5, rotation_degrees: 0, field_of_view_degrees: 90, coverage_radius: 0.5, mount_height_m: 3, tilt_deg: 15 } })).json()).id;
    ids.lockAnchor = (await (await api.post(`api/v1/floors/${ids.floor}/anchors`, { data: { resource_type: 'ha_entity', resource_id: ENTITIES.lock, x: 0.5, y: 0.1, rotation_degrees: 0, field_of_view_degrees: null } })).json()).id;
    ids.lampAnchor = (await (await api.post(`api/v1/floors/${ids.floor}/anchors`, { data: { resource_type: 'ha_entity', resource_id: ENTITIES.lamp, x: 0.2, y: 0.2, rotation_degrees: 0, field_of_view_degrees: null } })).json()).id;
    expect(ids.camAnchor && ids.lockAnchor && ids.lampAnchor).toBeTruthy();
    // the structure: a room with a door bound to the lock, a window, a passage; a lower level with a tribune; lamps; stairs
    const chairs = Array.from({ length: 6 }, (_, k) => OBJ(`ch${k}`, 'chair.basic', [0.25 + 0.08 * (k % 3), 0.35 + 0.1 * Math.floor(k / 3)]));
    await saveDraft({
      levels: [{ id: 'L0', name: 'ראשי', elevation_m: 0, ceiling_height_m: 3, is_default: true, external_ids: {} }, { id: 'L1', name: 'תחתון', elevation_m: -1.2, ceiling_height_m: 6, is_default: false, external_ids: {} }],
      walls: [WALL('n', [[0.1, 0.1], [0.9, 0.1]]), WALL('e', [[0.9, 0.1], [0.9, 0.6]]), WALL('s', [[0.9, 0.6], [0.1, 0.6]]), WALL('w', [[0.1, 0.6], [0.1, 0.1]]), WALL('lw', [[0.2, 0.9], [0.8, 0.9]], 'L1', { kind: 'low', height_m: 1 })],
      openings: [
        { id: 'dr', wall_id: 'n', t: 0.5, kind: 'door', width_m: 0.9, height_m: 2.1, sill_m: 0, swing: 'left', hinge: 'start', anchor_ref: { resource_type: 'ha_entity', resource_id: ENTITIES.lock }, confidence: 1, source: 'manual', external_ids: {} },
        { id: 'wn', wall_id: 'e', t: 0.5, kind: 'window', width_m: 1.2, height_m: 1.2, sill_m: 0.9, swing: 'none', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} },
        { id: 'ps', wall_id: 's', t: 0.5, kind: 'passage', width_m: 1.0, height_m: 2.1, sill_m: 0, swing: 'none', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} },
      ],
      objects: [...chairs,
        OBJ('lb', 'light.ceiling', [0.2, 0.2], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: -0.3, anchor_ref: { resource_type: 'ha_entity', resource_id: ENTITIES.lamp } }),
        OBJ('lk', 'light.ceiling', [0.6, 0.3], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: -0.3 }),
        OBJ('tr', 'tribune.stepped', [0.5, 0.8], { level_id: 'L1', size: { w_m: 8, d_m: 3, h_m: 1.2 }, params: { rows: 4, step_height_m: 0.3, step_width_m: 0.75 } })],
      circuits: [{ id: 'k', name: 'מעגל אולם', switch_entity_id: ENTITIES.sw, member_ids: ['lk'], color_token: 'circuit-1', power_w: 0 }],
      connectors: [{ id: 'st', kind: 'stairs', level_from: 'L0', level_to: 'L1', floor_ids: [], polyline: [[0.15, 0.7], [0.15, 0.78]], width_m: 1.2, label: null, object_id: null, source: 'manual', external_ids: {} }],
    });
    await publish();
  });

  test.afterAll(async () => {
    if (!api) return;
    try {
      if (ids.floor) expect((await api.delete(`api/v1/floors/${ids.floor}?force=true`)).status(), 'test floor removed').toBe(204);
      if (ids.floor2) expect((await api.delete(`api/v1/floors/${ids.floor2}?force=true`)).status(), 'second test floor removed').toBe(204);
      if (ids.building) expect((await api.delete(`api/v1/buildings/${ids.building}`)).status(), 'test building removed').toBe(204);
      if (ids.site) expect((await api.delete(`api/v1/sites/${ids.site}`)).status(), 'test site removed').toBe(204);
    } finally {
      await api.dispose();
    }
  });

  test('live map: the 3D loads on demand, mirrors the layers, the level, the live states and the selection, and toggles a lamp through the existing route', async ({ page }) => {
    test.setTimeout(150_000);
    const chunkRequests: string[] = [];
    page.on('request', (r) => {
      if (/\/assets\/three-[\w-]+\.js$/.test(r.url())) chunkRequests.push(r.url());
    });
    await connectedHa(page, ids.floor);
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator(HOST);
    await expect(host.locator('sw-plan-canvas [data-structure] [data-wall]').first()).toBeAttached({ timeout: 20000 });
    // the 2D cone is cut by the walls of the room (Task 2)
    await expect(host.locator('sw-plan-canvas [data-cov-clipped]')).toHaveCount(1);
    const toggle = host.locator('[data-view-3d]');
    await expectEnabled(toggle, 10000);
    expect(chunkRequests).toHaveLength(0);
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-floor-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    expect(chunkRequests).toHaveLength(1);
    let all = Number(await el.getAttribute('data-parts'));
    expect(all).toBeGreaterThan(20);
    // what the description says: the door is closed (the lock is locked), the bound lamp is off, the circuit lamp glows, the camera cone is clipped
    let d = await describe3d(page, HOST);
    expect(d.estimated).toBe(false);
    const part = (id: string) => d.parts.find((p) => p.id === id)!;
    expect(part('door:dr').rotation[1]).toBe(0);
    expect(part('obj:lb').color).toBe('obj-light');
    expect(part('obj:lk').color).toBe('map-glow');
    expect(d.parts.some((p) => p.id === 'obj:lk#glow')).toBe(true);
    expect(part(`cam:${ids.camAnchor}`).position[1]).toBe(3); // the stored mount height
    expect(part(`cam:${ids.camAnchor}`).rotation[0]).toBe(-15); // the stored tilt as the pitch (ruling R-P4-T4-1: pitch = -tilt looks down)
    expect(part(`cam:${ids.camAnchor}#cone`).polygon!.length).toBeGreaterThan(10);
    expect(Math.min(...part(`cam:${ids.camAnchor}#cone`).polygon!.map((p) => p[1]))).toBeGreaterThanOrEqual(-4.81); // the north wall 4.8 m ahead stops every ray while the door is closed
    expect(d.parts.filter((p) => p.id.startsWith('obj:tr#')).length).toBe(4);
    expect(d.parts.filter((p) => p.id.startsWith('conn:st#')).length).toBeGreaterThanOrEqual(3);
    // live states arrive through the existing push: the door opens, the lamp glows, the cone passes through the door. The
    // lock reports 'open' (Home Assistant's lock state after lock.open): 'unlocked' is not an open door by the 2D leaf
    // rules (OPEN_STATES in coverage.ts - open / opening / on), which the builder shares
    expect((await api.post('api/v1/ha/dev/states', { data: { states: [{ entity_id: ENTITIES.lock, state: 'open' }, { entity_id: ENTITIES.lamp, state: 'on' }] } })).status()).toBe(200);
    // (the screen collects pushes for 100 ms: wait for the scene that holds both states)
    await expect.poll(async () => { d = await describe3d(page, HOST); return part('obj:lb').color === 'map-glow' ? Math.abs(part('door:dr').rotation[1]) : -1; }, { timeout: 15000 }).toBe(80);
    expect(part('obj:lb').color).toBe('map-glow');
    expect(Math.min(...part(`cam:${ids.camAnchor}#cone`).polygon!.map((p) => p[1]))).toBeLessThan(-7); // the middle rays pass the open door (0.9 m wide, straight ahead) out to the 8 m radius
    // the layers of the 2D apply, the level chips too (counted from the lit scene: the open lamp added its glow)
    all = Number(await el.getAttribute('data-parts'));
    expect(all).toBe(d.parts.length);
    // a layer switched off removes exactly its parts: the objects take their glows along, the cameras their cones
    const objectParts = d.parts.filter((p) => p.kind === 'object' || (p.kind === 'glow' && p.id.startsWith('obj:'))).length;
    const cameraParts = d.parts.filter((p) => p.kind === 'camera' || p.kind === 'cone').length;
    expect(objectParts).toBeGreaterThan(8);
    expect(cameraParts).toBe(2);
    await host.locator('.layers button[aria-label="עצמים"]').click();
    await expect.poll(async () => Number(await el.getAttribute('data-parts'))).toBe(all - objectParts);
    expect((await describe3d(page, HOST)).parts.filter((p) => p.kind === 'object' || p.id.startsWith('obj:'))).toHaveLength(0);
    await host.locator('.layers button[aria-label="עצמים"]').click();
    await expect.poll(async () => Number(await el.getAttribute('data-parts'))).toBe(all);
    await host.locator('.layers button[aria-label="מצלמות"]').click();
    await expect.poll(async () => Number(await el.getAttribute('data-parts'))).toBe(all - cameraParts);
    expect((await describe3d(page, HOST)).parts.filter((p) => p.kind === 'camera' || p.kind === 'cone')).toHaveLength(0);
    await host.locator('.layers button[aria-label="מצלמות"]').click();
    await expect.poll(async () => Number(await el.getAttribute('data-parts'))).toBe(all);
    await host.locator('[data-level-chip="L1"]').click();
    await expect.poll(async () => { d = await describe3d(page, HOST); return d.parts.every((p) => p.level_id === 'L1' || p.kind === 'connector'); }).toBe(true);
    expect(d.parts.filter((p) => p.kind === 'wall').map((p) => p.id)).toEqual(['wall:lw#0']);
    await host.locator('[data-level-chip="all"]').click();
    await expect.poll(async () => Number(await el.getAttribute('data-parts'))).toBe(all);
    // selection: a click on the camera body opens its card (drawer) and the 2D selection follows the same id
    await el.locator('[data-preset-top]').click();
    const camAt = await partScreen(page, HOST, `cam:${ids.camAnchor}`);
    await page.mouse.click(camAt.x, camAt.y);
    await expect(el).toHaveAttribute('data-selected', ids.camAnchor);
    await expect(host.locator('sw-drawer[open]')).toBeAttached();
    await expect(host.locator('sw-drawer[open] sw-camera-tile')).toBeAttached(); // the existing live tile
    await page.keyboard.press('3'); // back to 2D: the same pin is selected there
    await expect(host.locator('sw-plan-canvas g.marker.selected')).toHaveAttribute('data-id', ids.camAnchor, { timeout: 10000 });
    await host.locator('sw-plan-canvas').click({ position: { x: 5, y: 5 } }); // an empty corner clears the 2D selection
    await host.locator('[data-sidelist-toggle]').click();
    await host.locator(`[data-side-entity="${ENTITIES.lock}"]`).click(); // the 2D list selects the lock
    await expect(host.locator('sw-plan-canvas g.marker.selected')).toHaveAttribute('data-id', ids.lockAnchor);
    await page.keyboard.press('3'); // to 3D: the shared selection shows there
    await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-selected', ids.lockAnchor, { timeout: 15000 });
    expect(chunkRequests).toHaveLength(1); // the chunk was fetched once
    await page.keyboard.press('Escape');
    await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-selected', '');
    // the circuit lamp: a click runs switch.turn_off through the existing action route, answered here (R-P2-T13-1)
    const sent: unknown[] = [];
    await page.route('**/api/v1/ha/entities/*/actions', async (r) => {
      sent.push(r.request().postDataJSON());
      await r.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 'p4-fake', entity_id: ENTITIES.sw, action_id: 'switch.turn_off', status: 'failed', error: 'bridge_error', requested_at: new Date().toISOString(), confirmed_at: null }) });
    });
    await el.locator('[data-preset-top]').click();
    const lampAt = await partScreen(page, HOST, 'obj:lk');
    await page.mouse.click(lampAt.x, lampAt.y);
    await expect(host.locator('[data-circuit-status]')).toContainText(ACTION_STATUS_LABEL.failed, { timeout: 10000 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ allowed_action_id: 'switch.turn_off' });
    await page.unroute('**/api/v1/ha/entities/*/actions');
    // the states back for the later tests
    expect((await api.post('api/v1/ha/dev/states', { data: { states: [{ entity_id: ENTITIES.lock, state: 'locked' }, { entity_id: ENTITIES.lamp, state: 'off' }] } })).status()).toBe(200);
  });

  test('live map: a card never floats over the 3D, the door bound to the lock selects the lock, a stale screen draws every state unknown, a blocked lamp sends nothing and is selected', async ({ page }) => {
    test.setTimeout(150_000);
    // the lock open and the lamp on, so the stale screen has something to hide
    expect((await api.post('api/v1/ha/dev/states', { data: { states: [{ entity_id: ENTITIES.lock, state: 'open' }, { entity_id: ENTITIES.lamp, state: 'on' }] } })).status()).toBe(200);
    // a room to click (removed at the end)
    const zone = (await (await api.post(`api/v1/floors/${ids.floor}/zones`, { data: { name: 'פינת 3D', polygon: [{ x: 0.12, y: 0.46 }, { x: 0.22, y: 0.46 }, { x: 0.22, y: 0.58 }, { x: 0.12, y: 0.58 }] } })).json()).id as string;
    // a connected sync; the circuit arrives without control (as a viewer's bundle would): the lamp click must be blocked
    const ha = await connectedHa(page, ids.floor, (body) => {
      for (const c of Object.values(body.circuit_states)) {
        c.can_control = false;
        c.actions = [];
      }
    });
    const sent: unknown[] = [];
    await page.route('**/api/v1/ha/entities/*/actions', async (r) => {
      sent.push(r.request().postDataJSON());
      await r.abort();
    });
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator(HOST);
    const toggle = host.locator('[data-view-3d]');
    await expectEnabled(toggle);
    // a 2D pin opens its card as a popover at the pin; once the 3D is on screen the same card is a drawer
    await host.locator(`sw-plan-canvas g.marker[data-id="${ids.camAnchor}"]`).click();
    await expect(host.locator('sw-popover')).toHaveCount(1);
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-floor-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    await expect(host.locator('sw-popover')).toHaveCount(0);
    await expect(host.locator('sw-drawer[open]')).toBeAttached();
    await page.keyboard.press('Escape');
    await expect(el).toHaveAttribute('data-selected', '');
    let d = await describe3d(page, HOST);
    const part = (id: string) => d.parts.find((p) => p.id === id)!;
    await expect.poll(async () => { d = await describe3d(page, HOST); return Math.abs(part('door:dr').rotation[1]); }, { timeout: 15000 }).toBe(80);
    expect(part('obj:lb').color).toBe('map-glow');
    // the door (its lintel, the part above the leaf) is bound to the lock: the click selects the lock's anchor - the rule
    // the history map and the event page share (part-select.boundItemOf)
    await el.locator('[data-preset-top]').click();
    await el.evaluate((node) => {
      const w = window as unknown as { __sel: unknown[] };
      w.__sel = [];
      node.addEventListener('part-select', (e) => w.__sel.push((e as CustomEvent).detail));
    });
    const doorAt = await partScreen(page, HOST, 'lintel:dr');
    await page.mouse.click(doorAt.x, doorAt.y);
    await expect(el).toHaveAttribute('data-selected', ids.lockAnchor);
    expect(await page.evaluate(() => (window as unknown as { __sel: unknown[] }).__sel)).toEqual([{ id: 'dr', kind: 'opening' }]);
    await expect(host.locator('sw-drawer[open]')).toBeAttached();
    // a wall is a stray click: the lock stays selected
    const wallAt = await partScreen(page, HOST, 'wall:w#0');
    await page.mouse.click(wallAt.x, wallAt.y);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __sel: { kind: string }[] }).__sel.length)).toBe(2);
    expect(await page.evaluate(() => (window as unknown as { __sel: { kind: string }[] }).__sel[1].kind)).toBe('wall');
    await expect(el).toHaveAttribute('data-selected', ids.lockAnchor);
    await page.keyboard.press('3');
    await expect(host.locator('sw-plan-canvas g.marker.selected')).toHaveAttribute('data-id', ids.lockAnchor, { timeout: 10000 });
    await page.keyboard.press('Escape');
    await page.keyboard.press('3');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 15000 });
    // the blocked lamp of the circuit: nothing is sent, the lamp is selected, the strip says why
    await el.locator('[data-preset-top]').click();
    const lampAt = await partScreen(page, HOST, 'obj:lk');
    await page.mouse.click(lampAt.x, lampAt.y);
    await expect(el).toHaveAttribute('data-selected', 'lk');
    await page.waitForTimeout(500);
    expect(sent).toHaveLength(0);
    // a room toggles its selection on the live map, as in 2D
    const roomAt = await el.evaluate((node, id) => {
      const e = node as unknown as { description: Desc; toScreen: (p: [number, number, number]) => { x: number; y: number } | null };
      const room = e.description.parts.find((p) => p.id === `room:${id}`)!;
      const n = room.polygon!.length;
      const [cx, cz] = room.polygon!.reduce(([x, z], q) => [x + q[0] / n, z + q[1] / n], [0, 0]);
      return e.toScreen([room.position[0] + cx, room.position[1] + 0.01, room.position[2] + cz]);
    }, zone);
    const elBox = (await el.boundingBox())!;
    await page.mouse.click(elBox.x + roomAt!.x, elBox.y + roomAt!.y);
    await expect(el).toHaveAttribute('data-selected', zone);
    await page.mouse.click(elBox.x + roomAt!.x, elBox.y + roomAt!.y);
    await expect(el).toHaveAttribute('data-selected', '');
    // a stale screen hands the builder explicit nulls: the door closes, the lock turns stale, no lamp glows
    await host.evaluate((n) => { (n as unknown as { screenState: string }).screenState = 'stale'; });
    await expect.poll(async () => { d = await describe3d(page, HOST); return part('door:dr').rotation[1]; }, { timeout: 15000 }).toBe(0);
    expect(part(`ent:${ids.lockAnchor}`).color).toBe('stale');
    expect(part('obj:lb').color).toBe('obj-light');
    expect(part('obj:lk').color).not.toBe('map-glow');
    expect(d.parts.filter((p) => p.kind === 'glow')).toHaveLength(0);
    await host.evaluate((n) => { (n as unknown as { screenState: string }).screenState = 'ready'; });
    await expect.poll(async () => { d = await describe3d(page, HOST); return Math.abs(part('door:dr').rotation[1]); }, { timeout: 15000 }).toBe(80);
    // the Home Assistant sync is lost (the message the backend sends): the 3D dims like the 2D - the door closes, no glow
    ha.syncLost();
    await expect.poll(async () => { d = await describe3d(page, HOST); return part('door:dr').rotation[1]; }, { timeout: 15000 }).toBe(0);
    expect(part(`ent:${ids.lockAnchor}`).color).toBe('stale');
    expect(part('obj:lb').color).toBe('obj-light');
    expect(d.parts.filter((p) => p.kind === 'glow')).toHaveLength(0);
    ha.syncBack();
    await expect.poll(async () => { d = await describe3d(page, HOST); return Math.abs(part('door:dr').rotation[1]); }, { timeout: 15000 }).toBe(80);
    expect(part('obj:lb').color).toBe('map-glow');
    await ha.unroute();
    expect((await api.delete(`api/v1/zones/${zone}`)).status()).toBe(204);
    await page.unroute('**/api/v1/ha/entities/*/actions');
    expect((await api.post('api/v1/ha/dev/states', { data: { states: [{ entity_id: ENTITIES.lock, state: 'locked' }, { entity_id: ENTITIES.lamp, state: 'off' }] } })).status()).toBe(200);
  });

  test('2D coverage: an offline camera keeps its wall-clipped cone dimmed, a manual polygon wins over the walls, a floor without walls keeps the plain cone and cannot open the 3D', async ({ page }) => {
    test.setTimeout(120_000);
    const host = page.locator(HOST);
    const cam = `sw-plan-canvas g.marker[data-id="${ids.camAnchor}"]`;
    // offline, as the recorder would report it (the bundle is answered here)
    const mapRoute = `**/api/v1/floors/${ids.floor}/map*`;
    await page.route(mapRoute, async (r) => {
      const res = await r.fetch();
      const body = (await res.json()) as { anchors: { camera: { status: string } | null }[] };
      for (const a of body.anchors) if (a.camera) a.camera.status = 'offline';
      await r.fulfill({ response: res, json: body });
    });
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    await expect(host.locator(`${cam} polygon.fov.off[data-cov-clipped]`)).toHaveCount(1, { timeout: 30000 });
    await page.unroute(mapRoute);
    // a manual polygon is drawn as stored, never clipped by the walls
    const listed = (await (await api.get(`api/v1/floors/${ids.floor}/anchors`)).json()).anchors as { id: string; revision: number }[];
    const rev = listed.find((a) => a.id === ids.camAnchor)!.revision;
    expect((await api.patch(`api/v1/map-anchors/${ids.camAnchor}`, { data: { revision: rev, coverage_polygon: [[0.5, 0.5], [0.3, 0.02], [0.7, 0.02]] } })).status()).toBe(200);
    try {
      await page.goto('about:blank');
      await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
      await expect(host.locator(`${cam} [data-cov-polygon]`)).toHaveCount(1, { timeout: 30000 });
      await expect(host.locator(`${cam} [data-cov-clipped]`)).toHaveCount(0);
    } finally {
      expect((await api.patch(`api/v1/map-anchors/${ids.camAnchor}`, { data: { revision: rev + 1, coverage_polygon: null } })).status()).toBe(200);
    }
    // a second floor with a plan and a camera but no structure: the plain cone, the toggle disabled with its reason
    ids.floor2 = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומה ללא מבנה', level: 1 } })).json()).id;
    const asset = await (await api.post(`api/v1/floors/${ids.floor2}/plan-assets`, { multipart: { file: { name: 'apartment.png', mimeType: 'image/png', buffer: fs.readFileSync(FIXTURE) } } })).json();
    const v2 = (await (await api.post(`api/v1/floors/${ids.floor2}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${v2}/publish`)).status()).toBe(200);
    const a2 = (await (await api.post(`api/v1/floors/${ids.floor2}/anchors`, { data: { resource_type: 'camera', resource_id: ids.camera, x: 0.5, y: 0.5, rotation_degrees: 0, field_of_view_degrees: 90, coverage_radius: 0.3 } })).json()).id;
    // a hash navigation only: the running screen's floor list predates the new floor, so it reads the tree again
    await page.goto(`/?design=a#/explore/floors/${ids.floor2}`);
    await expect(host.locator(`sw-plan-canvas g.marker[data-id="${a2}"] path.fov`)).toHaveCount(1, { timeout: 30000 });
    await expect(host.locator('sw-plan-canvas [data-cov-clipped]')).toHaveCount(0);
    const toggle = host.locator('[data-view-3d]');
    await expect(toggle).toHaveAttribute('disabled', '');
    await expect(toggle).toHaveAttribute('title', 'אין מבנה מפורסם לקומה הזו');
    // gone again before the building page test, which counts the structure reads of the building's floors
    expect((await api.delete(`api/v1/floors/${ids.floor2}?force=true`)).status()).toBe(204);
    ids.floor2 = '';
  });

  test('history map: the 3D shows the structure and the states of the instant, opens from the camera of ?camera=, and the key 3 toggles', async ({ page }) => {
    test.setTimeout(120_000);
    const t = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    await page.goto(`/?design=a#/investigate/floors/${ids.floor}/history?t=${encodeURIComponent(t)}&camera=${ids.camera}`);
    const host = page.locator('investigate-history-map');
    await expect(host.locator('sw-plan-canvas [data-structure] [data-wall]').first()).toBeAttached({ timeout: 30000 });
    await expect(host.locator('[data-history-camera]')).not.toContainText('לחץ על מצלמה');
    const toggle = host.locator('[data-view-3d]');
    await expectEnabled(toggle, 10000);
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-history-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    await expect(el).toHaveAttribute('data-preset', 'camera'); // "מבט מהמצלמה": the camera the page was opened with
    await expect(el).toHaveAttribute('data-selected', ids.camAnchor);
    const d = await describe3d(page, 'investigate-history-map');
    const part = (id: string) => d.parts.find((p) => p.id === id)!;
    expect(part('door:dr').rotation[1]).toBe(0); // the lock was locked at the instant (the local history knows it)
    expect(part(`ent:${ids.lockAnchor}`).color).toBe('text-3');
    expect(part('obj:lb').color).toBe('obj-light');
    expect(d.parts.filter((p) => p.kind === 'wall').length).toBeGreaterThanOrEqual(5);
    // a click on the lock symbol selects it in the panel's terms (no action is offered in the history)
    await el.locator('[data-preset-top]').click();
    const lockAt = await partScreen(page, 'investigate-history-map', `ent:${ids.lockAnchor}`);
    await page.mouse.click(lockAt.x, lockAt.y);
    await expect(el).toHaveAttribute('data-selected', ids.lockAnchor);
    await expect(host.locator('[data-history-camera]')).toContainText('לחץ על מצלמה');
    await page.keyboard.press('3');
    await expect(host.locator('sw-plan-canvas')).toBeAttached();
    await expect(host.locator('sw-plan-canvas g.marker.selected')).toHaveAttribute('data-id', ids.lockAnchor);
    await page.keyboard.press('3');
    await expect(host.locator('sw-plan-3d[data-history-3d]')).toHaveAttribute('data-ready', '', { timeout: 15000 });
  });

  test('event page: the map card toggles to 3D from the camera of the event', async ({ page }) => {
    test.setTimeout(120_000);
    // the developer backend holds events only when the NVR delivered them: find one on a floor with a plan, else NOT_RUN
    const list = (await (await api.get('api/v1/events?limit=300')).json()).events as { id: string; camera_id: string | null }[];
    let found: { id: string; anchor: string } | null = null;
    for (const e of list.filter((x) => x.camera_id)) {
      const d = (await (await api.get(`api/v1/events/${e.id}`)).json()) as { location: { has_plan: boolean; anchor_id: string } | null };
      if (d.location?.has_plan) {
        found = { id: e.id, anchor: d.location.anchor_id };
        break;
      }
    }
    test.skip(!found, 'no event with a camera on a floor with a plan on this backend (recorded NOT_RUN)');
    await page.goto(`/?design=a#/investigate/events/${found!.id}`);
    const host = page.locator('investigate-event-detail');
    await expect(host.locator('sw-plan-canvas')).toBeAttached({ timeout: 30000 });
    const toggle = host.locator('sw-button[data-event-3d-toggle]'); // the element keeps data-event-3d
    await expectEnabled(toggle, 15000);
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-event-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    await expect(el).toHaveAttribute('data-preset', 'camera');
    await expect(el).toHaveAttribute('data-selected', found!.anchor);
    expect(Number(await el.getAttribute('data-parts'))).toBeGreaterThan(0);
    await toggle.click();
    await expect(host.locator('sw-plan-canvas')).toBeAttached();
  });

  test('building page: the floor list shows a true isometric of the published walls', async ({ page }) => {
    const reads: string[] = []; // the page reads the PUBLISHED structure, once per version (cached across renders)
    page.on('request', (r) => { if (r.url().includes('/geometry')) reads.push(r.url()); });
    await page.goto(`/?design=a#/explore/buildings/${ids.building}/floors`);
    const iso = page.locator(`explore-floors sw-floor-iso[data-floor-iso="${ids.floor}"]`);
    await expect(iso).toHaveAttribute('data-iso', 'real', { timeout: 30000 });
    expect(await iso.locator('polygon.side').count()).toBeGreaterThan(8); // five walls, each a box with four sides (openings cut them further)
    expect(await iso.locator('polygon.plate').count()).toBe(2); // two levels
    const tabs = page.locator('explore-floors sw-tabs button');
    await tabs.filter({ hasText: 'פרטים' }).click(); // away from the list and back: the thumbnail is built again from the cache
    await expect(iso).toHaveCount(0);
    await tabs.filter({ hasText: 'קומות' }).click();
    await expect(iso).toHaveAttribute('data-iso', 'real');
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatch(new RegExp(`/plan-versions/${ids.version}/geometry$`));
  });

  test('glTF export: the button downloads a glTF JSON with the instanced parts', async ({ page }) => {
    test.setTimeout(120_000);
    // the download pattern is an <a download> click on a Blob URL: capture the Blob instead of saving a file
    await page.addInitScript(() => {
      const w = window as unknown as { __gltf: { name: string; text: string } | null };
      w.__gltf = null;
      const origCreate = URL.createObjectURL.bind(URL);
      const blobs = new Map<string, Blob>();
      URL.createObjectURL = (b: Blob | MediaSource) => { const u = origCreate(b); if (b instanceof Blob) blobs.set(u, b); return u; };
      HTMLAnchorElement.prototype.click = function () { const b = blobs.get(this.href); if (b) void b.text().then((text) => { w.__gltf = { name: this.download, text }; }); };
    });
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator(HOST);
    await expectEnabled(host.locator('[data-view-3d]'), 30000);
    await host.locator('[data-view-3d]').click();
    const el = host.locator('sw-plan-3d[data-floor-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    await el.locator('[data-export-gltf]').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __gltf: unknown }).__gltf !== null), { timeout: 30000 }).toBe(true);
    const got = await page.evaluate(() => (window as unknown as { __gltf: { name: string; text: string } }).__gltf);
    expect(got.name).toBe(`plan-3d-אולם-3D-${await localDate(page)}.gltf`); // the floor name without its space (the Hebrew stays), the local date
    const gltf = JSON.parse(got.text) as { asset: { generator: string; version: string }; nodes: unknown[]; meshes: unknown[]; extensionsUsed?: string[] };
    expect(gltf.asset.generator).toContain('GLTFExporter');
    expect(gltf.asset.version).toBe('2.0');
    expect(gltf.nodes.length).toBeGreaterThan(10);
    expect(gltf.meshes.length).toBeGreaterThan(3);
    expect(gltf.extensionsUsed ?? []).toContain('EXT_mesh_gpu_instancing'); // the chairs and the wall parts travel as instances
    console.log(`GLTF ${got.name}: ${gltf.nodes.length} nodes, ${gltf.meshes.length} meshes, ${got.text.length} bytes`);
  });

  test('embed mode (the Lovelace card path): the floor screen toggles to 3D without its chrome, the chunk fetched from the page own assets folder', async ({ page }) => {
    test.setTimeout(120_000);
    const chunkRequests: string[] = [];
    page.on('request', (r) => {
      if (/\/assets\/three-[\w-]+\.js$/.test(r.url())) chunkRequests.push(r.url());
    });
    await page.goto('about:blank');
    await page.goto(`/#/explore/floors/${ids.floor}?embed=1`);
    await page.waitForSelector('sw-app');
    await expect(page.locator('sw-app')).toHaveAttribute('data-embed', '', { timeout: 30000 });
    await expect(page.locator('sw-app nav')).toHaveCount(0);
    const host = page.locator(HOST);
    await expectEnabled(host.locator('[data-view-3d]'), 30000);
    await host.locator('[data-view-3d]').click();
    await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-ready', '', { timeout: 30000 });
    expect(chunkRequests).toHaveLength(1);
    expect(new URL(chunkRequests[0]).pathname).toMatch(/^\/assets\/three-[\w-]+\.js$/); // next to the page that embedded it
    await page.goto('about:blank'); // leave embed mode for the next tests (it is remembered per session)
  });

  test('without WebGL the toggle is disabled with a Hebrew note and the 2D map keeps working', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
        return (orig as (this: HTMLCanvasElement, t: string, ...a: unknown[]) => RenderingContext | null).call(this, type, ...rest);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator(HOST);
    await expect(host.locator('sw-plan-canvas [data-structure] [data-wall]').first()).toBeAttached({ timeout: 30000 });
    // sw-button carries the disabled attribute on its host (not a native control, so not toBeDisabled - see evidence-plan-studio-2.spec.ts)
    await expect(host.locator('[data-view-3d]')).toHaveAttribute('disabled', '');
    await expect(host.locator('[data-3d-unavailable]')).toHaveText('תלת-ממד לא זמין בדפדפן זה');
    await page.keyboard.press('3');
    await expect(host.locator('sw-plan-3d')).toHaveCount(0);
    await host.locator(`sw-plan-canvas g.marker[data-id="${ids.camAnchor}"]`).click();
    await expect(host.locator('sw-popover, sw-drawer[open]')).toHaveCount(1); // the 2D card still opens
  });

  test('phone: the toggle sits in the tool row, the 3D fills the stage without sideways scroll, the canvas takes touch', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const chunkRequests: string[] = [];
    page.on('request', (r) => {
      if (/\/assets\/three-[\w-]+\.js$/.test(r.url())) chunkRequests.push(r.url());
    });
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator(HOST);
    await expect(host.locator('sw-plan-canvas')).toBeAttached({ timeout: 30000 });
    const toggle = host.locator('.tools [data-view-3d]');
    await expect(toggle).toBeVisible();
    await expectEnabled(toggle, 30000);
    expect(chunkRequests).toHaveLength(0);
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-floor-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    expect(chunkRequests).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const stage = await el.boundingBox();
    expect(stage!.width).toBeLessThanOrEqual(390);
    expect(stage!.width).toBeGreaterThan(300);
    const touch = await el.evaluate((node) => { const c = (node as HTMLElement).shadowRoot!.querySelector('canvas')!; return { action: getComputedStyle(c).touchAction, w: c.clientWidth }; });
    expect(touch.action).toBe('none'); // OrbitControls owns the gestures: one finger orbits, two zoom and pan
    expect(touch.w).toBeGreaterThan(300);
    await expect(el.locator('[data-preset-top]')).toBeVisible();
    await el.locator('[data-preset-top]').click();
    await expect(el).toHaveAttribute('data-preset', 'top');
  });
  test('the anchor panel edits the mount height and the tilt; the bundle and the 3D take them', async ({ page }) => {
    test.setTimeout(120_000);
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} sw-plan-canvas g.marker[data-id="${ids.camAnchor}"]`)).toBeAttached({ timeout: 30000 });
    await page.locator(`${ed} sw-plan-canvas g.marker[data-id="${ids.camAnchor}"]`).click();
    await expect(page.locator(`${ed} [data-anchor-mount]`)).toHaveValue('3');
    await expect(page.locator(`${ed} [data-anchor-tilt]`)).toHaveValue('15');
    // a value beyond the range is clamped and the field shows the clamped value (live binding)
    await page.locator(`${ed} [data-anchor-mount]`).fill('45');
    await page.locator(`${ed} [data-anchor-mount]`).press('Tab');
    await expect(page.locator(`${ed} [data-anchor-mount]`)).toHaveValue('30');
    await page.locator(`${ed} [data-anchor-mount]`).fill('45');
    await page.locator(`${ed} [data-anchor-mount]`).press('Tab');
    await expect(page.locator(`${ed} [data-anchor-mount]`)).toHaveValue('30'); // the same clamped value again: still shown as 30
    await page.locator(`${ed} [data-anchor-mount]`).fill('2.2');
    await page.locator(`${ed} [data-anchor-mount]`).press('Tab');
    await page.locator(`${ed} [data-anchor-tilt]`).fill('');
    await page.locator(`${ed} [data-anchor-tilt]`).press('Tab'); // emptied: back to the kind's default (10), stored as null
    await expect(page.locator(`${ed} [data-anchor-tilt]`)).toHaveAttribute('placeholder', '10');
    const patched = page.waitForResponse((r) => r.url().includes('/map-anchors/') && r.request().method() === 'PATCH');
    await page.locator(`${ed} sw-button`, { hasText: 'שמירת מיקום' }).first().click();
    const body = (await patched).request().postDataJSON() as { mount_height_m: number | null; tilt_deg: number | null };
    expect(body).toMatchObject({ mount_height_m: 2.2, tilt_deg: null });
    const bundle = (await (await api.get(`api/v1/floors/${ids.floor}/map`)).json()) as { anchors: { id: string; mount_height_m: number | null; tilt_deg: number | null }[] };
    const cam = bundle.anchors.find((a) => a.id === ids.camAnchor)!;
    expect(cam.mount_height_m).toBe(2.2);
    expect(cam.tilt_deg).toBeNull();
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator(HOST);
    await expectEnabled(host.locator('[data-view-3d]'));
    await host.locator('[data-view-3d]').click();
    await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-ready', '', { timeout: 30000 });
    const d = await describe3d(page, HOST);
    const camPart = d.parts.find((p) => p.id === `cam:${ids.camAnchor}`)!;
    expect(camPart.position[1]).toBe(2.2);
    expect(camPart.rotation[0]).toBe(-10); // the default tilt of 10 deg down (ruling R-P4-T4-1: pitch = -tilt)
    // an entity anchor gets the mount field only (no tilt), with the door-station default as its placeholder
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await page.locator(`${ed} sw-plan-canvas g.marker[data-id="${ids.lockAnchor}"]`).click({ timeout: 30000 });
    await expect(page.locator(`${ed} [data-anchor-mount]`)).toHaveAttribute('placeholder', '1.4');
    await expect(page.locator(`${ed} [data-anchor-tilt]`)).toHaveCount(0);
  });

  test('performance: frames over four seconds on the floor and on a 3,000-chair floor (>= 20 fps asserted; the numbers are reported)', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const report = (line: string) => {
      console.log(line);
      testInfo.annotations.push({ type: 'perf', description: line });
    };
    /** Continuous frames (data-measure) counted between the element's own counter reports: every report is timed in the
     * page when it lands, so the one-second resolution of the counters does not skew the rate. */
    const measure = async (label: string) => {
      const el = page.locator(`${HOST} sw-plan-3d[data-floor-3d]`);
      await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
      await el.evaluate((node) => { (node as unknown as { continuous: boolean }).continuous = true; });
      await expect(el).toHaveAttribute('data-measure', '');
      await page.waitForTimeout(1000); // the first frames and the chunk settle
      const r = await el.evaluate(async (node) => {
        const marks: [number, number][] = [];
        const mo = new MutationObserver(() => marks.push([performance.now(), Number((node as HTMLElement).getAttribute('data-frames'))]));
        mo.observe(node, { attributes: true, attributeFilter: ['data-frames'] });
        await new Promise((res) => setTimeout(res, 4200));
        mo.disconnect();
        const last = Number((node as HTMLElement).getAttribute('data-fps'));
        if (marks.length < 2) return { fps: 0, last, reports: marks.length };
        const [t0, f0] = marks[0];
        const [t1, f1] = marks[marks.length - 1];
        return { fps: Math.round(((f1 - f0) * 1000) / (t1 - t0)), last, reports: marks.length };
      });
      await el.evaluate((node) => { (node as unknown as { continuous: boolean }).continuous = false; });
      await expect(el).not.toHaveAttribute('data-measure', '');
      const parts = Number(await el.getAttribute('data-parts'));
      report(`PERF ${label} fps=${r.fps} parts=${parts}`);
      report(`PERF ${label} detail: data-fps=${r.last} counter-reports=${r.reports}`);
      return { fps: r.fps, parts };
    };
    const open3d = async (label: string) => {
      const host = page.locator(HOST);
      await expectEnabled(host.locator('[data-view-3d]'), 60000);
      const t0 = Date.now();
      await host.locator('[data-view-3d]').click();
      await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-ready', '', { timeout: 60000 });
      report(`PERF ${label} time-to-3d ms=${Date.now() - t0}`); // design: within 3 s on desktop (reported, not asserted)
    };
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    await open3d('sample');
    const small = await measure('sample');
    expect(small.fps).toBeGreaterThanOrEqual(20);
    // 3,000 chairs in a 60 x 50 grid inside the room, published. A chair (0.45 x 0.45 x 0.85 m) is never "small" by
    // SMALL_PART_M (the largest dimension, 0.85 > 0.6), so the far-camera hiding does not apply: this measures raw instancing
    const chairs = Array.from({ length: 3000 }, (_, i) => OBJ(`big${i}`, 'chair.basic', [0.12 + (i % 60) * (0.76 / 59), 0.12 + Math.floor(i / 60) * (0.46 / 49)]));
    const g = await draft();
    const objects = (g.doc.objects as Record<string, unknown>[]).filter((o) => !String(o.id).startsWith('big'));
    await saveDraft({ objects: [...objects, ...chairs] });
    await publish();
    try {
      await page.goto('about:blank');
      await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
      await open3d('chairs');
      const big = await measure('chairs');
      expect(big.parts).toBeGreaterThanOrEqual(3000);
      expect(big.fps).toBeGreaterThanOrEqual(20);
      const d = await describe3d(page, HOST);
      expect(d.parts.filter((p) => p.id.startsWith('obj:big')).length).toBe(3000);
      // the phone width on the same machine (not a phone GPU: the design's 30 fps phone target is reported, never asserted)
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('about:blank');
      await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
      await open3d('chairs-390px');
      await measure('chairs-390px');
    } finally {
      await saveDraft({ objects }); // the small floor again for anyone who reruns a single test
      await publish();
    }
  });
});
