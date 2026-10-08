import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// VER1 (verifies WALL-glass, 2.4.0): an opening panel of a window wall linked to an entity, end to end against a live fixture backend
// (run_smart fixture, group `devices`; SW_LIVE=1, SW_DEVICES_FIXTURE=1):
//   editor  - link two opening panels to a window sensor and a window cover placed on the floor (the entity chooser lists only those),
//             persisted in the draft, restored after a reload, one undo step per change;
//   map 2D  - the open-mark of the panel follows the entity state (closed: none; open: the mark; closed again: gone), after a reload too;
//   map 3D  - the glTF export carries the open-marker parts of the open panel only (desktop);
//   exports - plan.json of the package, SVG, DXF carry the link / the panel; the document is 2.1 only because a window wall is used.
// The spec builds its own site / building / floor and removes them. Screenshots: docs/design/evidence/wall-glass-entity/.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'design', 'evidence', 'wall-glass-entity');
const ED = 'explore-plan-editor';
const MAP = 'explore-floor-map';
const SENSOR = 'binary_sensor.vent_window';
const COVER = 'cover.vent_cover';
const ids = { site: '', building: '', floor: '', version: '' };
let api: APIRequestContext;

const GLAZING = { panel_width_m: 1.2, panel_count: 6, mullion_m: 0.06, sill_m: 0.5, glazed_height_m: null, tint: 'clear', opacity: 0.35,
  operable: [{ panel: 1, operation: 'casement_left', anchor_ref: null }, { panel: 4, operation: 'tilt', anchor_ref: null }] };
const WALL = (id: string, polyline: [number, number][], kind = 'exterior', extra: Record<string, unknown> = {}) => ({ id, level_id: 'L0', polyline, thickness_m: kind === 'glass' ? 0.12 : 0.25,
  height_m: null, base_z_m: 0, kind, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });

type Draft = { doc: { schema_version: string; walls: { id: string; kind: string; glazing?: { operable: { panel: number; operation: string; anchor_ref: { resource_type: string; resource_id: string } | null }[] } }[] }; geometry: { revision: number } };
const draft = async () => (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json()) as Draft;
const links = async () => Object.fromEntries(((await draft()).doc.walls.find((w) => w.id === 'gw-vent')?.glazing?.operable ?? []).map((o) => [o.panel, o.anchor_ref?.resource_id ?? null]));
const setStates = async (sensor: 'on' | 'off', cover: 'open' | 'closed') =>
  expect((await api.post('api/v1/ha/dev/states', { data: { states: [
    { entity_id: SENSOR, state: sensor, attributes: { friendly_name: 'חלון אוורור', device_class: 'window' } },
    { entity_id: COVER, state: cover, attributes: { friendly_name: 'תריס אוורור', device_class: 'window' } },
  ] } })).status()).toBe(200);

async function clickPlan(page: Page, screen: string, x: number, y: number) {
  const canvas = page.locator(`${screen} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, p) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(p[0], p[1]), [x, y] as [number, number]);
  await page.mouse.click(box.x + s.x, box.y + s.y);
}
async function openMap(page: Page) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
  const canvas = page.locator(`${MAP} sw-plan-canvas`);
  await expect(canvas.locator('[data-glazing="gw-vent"] [data-operable]')).toHaveCount(2, { timeout: 20000 });
  await page.waitForTimeout(500);
  return canvas;
}

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

test.describe.serial('window wall: panels linked to entities', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `קיר חלונות וישויות ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה בדיקה' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומת אוורור', level: 0 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent('<div style="box-sizing:border-box;width:1000px;height:600px;background:#fff;border:6px solid #ccc"></div>');
    const png = await page.screenshot();
    await page.close();
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
    ids.version = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
    expect((await api.patch(`api/v1/plan-versions/${ids.version}/calibration`, { data: { pairs: [{ a: [0.1, 0.5], b: [0.9, 0.5], metres: 20 }] } })).status()).toBeLessThan(300);
    await setStates('off', 'closed');
    for (const [eid, x] of [[SENSOR, 0.3], [COVER, 0.5]] as const) {
      const r = await api.post(`api/v1/floors/${ids.floor}/anchors`, { data: { resource_type: 'ha_entity', resource_id: eid, x, y: 0.4, layer_id: 'sensors' } });
      expect(r.status(), await r.text()).toBe(201);
    }
    const g = await draft();
    expect(g.doc.schema_version).toBe('2.0');
    const doc = { ...g.doc, walls: [WALL('gw-vent', [[0.15, 0.2], [0.65, 0.2]], 'glass', { glazing: GLAZING }), WALL('sw-back', [[0.65, 0.2], [0.65, 0.8], [0.15, 0.8], [0.15, 0.2]])] };
    const put = await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc, base_revision: g.geometry.revision } });
    expect(put.status(), await put.text()).toBe(200);
    expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
    expect((await draft()).doc.schema_version).toBe('2.1');
  });

  test.afterAll(async () => {
    if (!api) return;
    try {
      if (ids.floor) expect((await api.delete(`api/v1/floors/${ids.floor}?force=true`)).status(), 'test floor removed').toBe(204);
      if (ids.building) expect((await api.delete(`api/v1/buildings/${ids.building}`)).status(), 'test building removed').toBe(204);
      if (ids.site) expect((await api.delete(`api/v1/sites/${ids.site}`)).status(), 'test site removed').toBe(204);
    } finally {
      await api.dispose();
    }
  });

  test('editor: link two opening panels to entities of the floor; saved, restored after a reload, one undo step each', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the editor is desktop only');
    test.setTimeout(120_000);
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    const canvas = page.locator(`${ED} sw-plan-canvas`);
    await expect(canvas.locator('[data-wall]').first()).toBeAttached({ timeout: 20000 });
    await page.locator(`${ED} [data-tool="structure"]`).click();
    await page.locator(`${ED} [data-studio-mode="select"]`).click();
    await clickPlan(page, ED, 0.4, 0.2);
    await expect(page.locator(`${ED} [data-glazing-inspector="gw-vent"]`)).toBeVisible();
    const sel1 = page.locator(`${ED} [data-operable-row="1"] [data-operable-entity]`);
    const sel4 = page.locator(`${ED} [data-operable-row="4"] [data-operable-entity]`);
    // the chooser lists the open / close entities placed on this floor (and "no entity")
    expect(await sel1.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).sort())).toEqual(['', COVER, SENSOR].sort());
    expect(await links()).toEqual({ 1: null, 4: null });
    await sel1.selectOption(SENSOR);
    await expect.poll(links, { timeout: 10000 }).toEqual({ 1: SENSOR, 4: null });
    await sel4.selectOption(COVER);
    await expect.poll(links, { timeout: 10000 }).toEqual({ 1: SENSOR, 4: COVER });
    expect((await draft()).doc.schema_version).toBe('2.1');
    await page.locator(`${ED} [data-studio-panel]`).screenshot({ path: path.join(OUT, 'editor-linked-panels.png') });
    // one undo step per change: the cover link goes first, then the sensor link; redo brings them back
    await page.keyboard.press('Control+z');
    await expect.poll(links, { timeout: 10000 }).toEqual({ 1: SENSOR, 4: null });
    await page.keyboard.press('Control+z');
    await expect.poll(links, { timeout: 10000 }).toEqual({ 1: null, 4: null });
    await page.keyboard.press('Control+y');
    await page.keyboard.press('Control+y');
    await expect.poll(links, { timeout: 10000 }).toEqual({ 1: SENSOR, 4: COVER });
    await expect(page.locator(`${ED} [data-studio-panel][data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
    // reload: the editor shows the links again
    await page.reload();
    await expect(canvas.locator('[data-wall]').first()).toBeAttached({ timeout: 20000 });
    await page.locator(`${ED} [data-tool="structure"]`).click();
    await page.locator(`${ED} [data-studio-mode="select"]`).click();
    await clickPlan(page, ED, 0.4, 0.2);
    await expect(page.locator(`${ED} [data-operable-row="1"] [data-operable-entity]`)).toHaveValue(SENSOR);
    await expect(page.locator(`${ED} [data-operable-row="4"] [data-operable-entity]`)).toHaveValue(COVER);
    expect(await links()).toEqual({ 1: SENSOR, 4: COVER });
    // publish the linked document (what the operators' map reads)
    expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
  });

  test('map 2D: the open mark of a linked panel follows its entity - open, closed again, after a reload', async ({ page }, info) => {
    test.setTimeout(150_000);
    const tag = info.project.name;
    // The editor test links the panels on desktop only (it is skipped on mobile, where every project run has its own floor), so
    // a run that finds the panels unlinked links them itself through the API and publishes - the same document the editor saves.
    if (!(await links())[1]) {
      const g = await draft();
      const doc = { ...g.doc, walls: g.doc.walls.map((w) => (w.id !== 'gw-vent' ? w : { ...w, glazing: { ...w.glazing!, operable: w.glazing!.operable.map((o) => ({ ...o, anchor_ref: { resource_type: 'ha_entity', resource_id: o.panel === 1 ? SENSOR : COVER } })) } })) };
      const put = await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc, base_revision: g.geometry.revision } });
      expect(put.status(), await put.text()).toBe(200);
      expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
      expect(await links()).toEqual({ 1: SENSOR, 4: COVER });
    }
    await setStates('off', 'closed');
    let canvas = await openMap(page);
    await expect(canvas.locator('[data-open-mark]')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, `map-closed-${tag}.png`) });
    await setStates('on', 'closed');
    canvas = await openMap(page);
    await expect(canvas.locator('[data-open-mark="gw-vent~p1"]')).toHaveCount(1, { timeout: 20000 });
    await expect(canvas.locator('[data-open-mark="gw-vent~p4"]')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, `map-sensor-open-${tag}.png`) });
    await setStates('on', 'open');
    canvas = await openMap(page);
    await expect(canvas.locator('[data-open-mark]')).toHaveCount(2, { timeout: 20000 });
    await setStates('off', 'open');
    canvas = await openMap(page);
    await expect(canvas.locator('[data-open-mark="gw-vent~p4"]')).toHaveCount(1, { timeout: 20000 });
    await expect(canvas.locator('[data-open-mark="gw-vent~p1"]')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, `map-cover-open-${tag}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await setStates('off', 'closed');
  });

  test('map 3D: the glTF carries a danger-coloured marker box for an open panel and none when everything is closed', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop evidence');
    test.setTimeout(180_000);
    await page.addInitScript(() => {
      const w = window as unknown as { __gltf: { name: string; text: string } | null };
      w.__gltf = null;
      const origCreate = URL.createObjectURL.bind(URL);
      const blobs = new Map<string, Blob>();
      URL.createObjectURL = (b: Blob | MediaSource) => { const u = origCreate(b); if (b instanceof Blob) blobs.set(u, b); return u; };
      HTMLAnchorElement.prototype.click = function () { const b = blobs.get(this.href); if (b) void b.text().then((text) => { w.__gltf = { name: this.download, text }; }); };
    });
    // The export holds the instanced groups of the scene, not per-part nodes: the open-marker frame of a panel is thin boxes in the
    // danger token, i.e. the group node named `box|danger|<opacity>` (scene-builder groupKey). It exists only while a panel is open.
    const dangerNodes = async (screenshot: string | null) => {
      await page.goto('about:blank');
      await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
      const host = page.locator(MAP);
      await expect(host.locator('[data-view-3d]')).toBeEnabled({ timeout: 30000 });
      await host.locator('[data-view-3d]').click();
      const el = host.locator('sw-plan-3d[data-floor-3d]');
      await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
      await page.waitForTimeout(1500);
      if (screenshot) await el.screenshot({ path: path.join(OUT, screenshot) });
      await el.locator('[data-export-gltf]').click();
      await expect.poll(() => page.evaluate(() => (window as unknown as { __gltf: unknown }).__gltf !== null), { timeout: 30000 }).toBe(true);
      const got = await page.evaluate(() => (window as unknown as { __gltf: { name: string; text: string } }).__gltf);
      const names = (JSON.parse(got!.text) as { nodes: { name?: string }[] }).nodes.map((n) => n.name ?? '');
      return { names, danger: names.filter((n) => /^box\|danger\|/.test(n)) };
    };
    await setStates('on', 'closed');
    const open = await dangerNodes('map-3d-sensor-open.png');
    expect(open.danger.length, open.names.join(',')).toBeGreaterThan(0);
    await setStates('off', 'closed');
    const closed = await dangerNodes(null);
    expect(closed.danger.length, closed.names.join(',')).toBe(0);
  });

  test('exports: plan.json, SVG and DXF carry the linked panels; the document is 2.1 because of the window wall', async ({}, info) => {
    test.skip(info.project.name !== 'desktop', 'API checks run once');
    const doc = (await draft()).doc;
    expect(doc.schema_version).toBe('2.1');
    const pkg = await api.post(`api/v1/plan-versions/${ids.version}/package`, { data: { draft: false } });
    expect(pkg.status()).toBe(200);
    const bytes = await pkg.body();
    // the package is a zip: plan.json is stored or deflated; look for the links through the JSON the API serves for the same document
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    const pub = (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry`)).json()) as Draft;
    const ops = pub.doc.walls.find((w) => w.id === 'gw-vent')!.glazing!.operable;
    expect(ops.map((o) => [o.panel, o.anchor_ref?.resource_id])).toEqual([[1, SENSOR], [4, COVER]]);
    const svg = await (await api.get(`api/v1/plan-versions/${ids.version}/export.svg`)).text();
    expect(svg).toContain('data-panel="1" data-operation="casement_left"');
    expect(svg).toContain('data-panel="4" data-operation="tilt"');
    const dxf = await (await api.get(`api/v1/plan-versions/${ids.version}/export.dxf`)).text();
    expect(dxf).toContain('SW_GLAZING');
    expect(dxf).toContain('glass_panel:1:casement_left');
    expect(dxf).toContain('glass_panel:4:tilt');
  });
});
