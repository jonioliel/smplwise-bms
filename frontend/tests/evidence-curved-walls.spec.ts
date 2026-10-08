import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Curved walls (owner request 2026-10-08) in the plan editor's structure tool, against a running backend: C opens the
// curve mode, dragging the middle of a segment bends it (one undo step; its door stays on it), the panel sets a
// segment's radius and straightens it, a corner is rounded with a radius, the arc mode draws an arc wall from three
// clicks, the exports carry the arcs, and a phone keeps the curve tools away. The spec builds its own site / building /
// floor and removes them. Runs only with SW_LIVE=1. Screenshots for review go to private-evidence (not committed).
const BASE = process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
const ED = 'explore-plan-editor';
const ids = { site: '', building: '', floor: '', version: '' };
let api: APIRequestContext;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'private-evidence', 'curved-walls');

type P = [number, number];
interface Wall { id: string; polyline: P[]; bulges?: number[] }
interface Draft { geometry: { revision: number }; doc: Record<string, unknown> & { schema_version: string; walls: Wall[]; openings: { id: string; wall_id: string; t: number }[] } }
const WALL = (id: string, polyline: P[]) => ({ id, level_id: 'L0', polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} });
const DOOR = (id: string, wallId: string, t: number) => ({ id, wall_id: wallId, t, kind: 'door', width_m: 0.9, height_m: 2.1, sill_m: 0, swing: 'right', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} });
const draft = async () => (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json()) as Draft;
const wallOf = (d: Draft, id: string) => d.doc.walls.find((w) => w.id === id)!;
const curvedOf = (w: Wall) => !!w.bulges && w.bulges.some((b) => b !== 0);
const SEED = { walls: [WALL('cw1', [[0.2, 0.35], [0.6, 0.35]]), WALL('cw2', [[0.2, 0.55], [0.45, 0.55], [0.45, 0.85], [0.2, 0.85], [0.2, 0.55]])], openings: [DOOR('cd1', 'cw1', 0.3)] };

async function at(page: Page, p: P): Promise<{ x: number; y: number }> {
  const canvas = page.locator(`${ED} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, q) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(q[0], q[1]), p);
  return { x: box.x + s.x, y: box.y + s.y };
}
async function drag(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 6 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 6 });
  await page.mouse.up();
}
const saved = (page: Page) => expect(page.locator(`${ED} [data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
async function seed() {
  const g = await draft();
  expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc: { ...g.doc, ...SEED }, base_revision: g.geometry.revision } })).status()).toBe(200);
}
/** A bent wall and a round room (a closed outline of two half circles), saved by the API and published. */
async function seedCurved() {
  const g = await draft();
  const bent = { ...WALL('cw1', [[0.2, 0.35], [0.6, 0.35]]), bulges: [0.4] };
  const round = { ...WALL('cr1', [[0.7, 0.3], [0.9, 0.3], [0.7, 0.3]]), bulges: [1, 1] };
  const res = await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc: { ...g.doc, walls: [bent, round], openings: [DOOR('cd1', 'cw1', 0.3)] }, base_revision: g.geometry.revision } });
  expect(res.status()).toBe(200);
  expect((await draft()).doc.schema_version).toBe('2.1');
  expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
}
async function openStructure(page: Page) {
  await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
  await expect(page.locator(`${ED} sw-plan-canvas [data-wall]`)).not.toHaveCount(0, { timeout: 20000 });
  await page.locator(`${ED} [data-tool="structure"]`).click();
  await expect(page.locator(`${ED} [data-studio-panel]`)).toHaveCount(1);
}

test.describe.serial('plan editor: curved walls', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: BASE });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת קשתות ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה בדיקה' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומת קשתות', level: 0 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent('<div style="box-sizing:border-box;width:1000px;height:600px;background:#fff;border:10px solid #333"></div>');
    const png = await page.screenshot();
    await page.close();
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
    ids.version = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
    expect((await api.patch(`api/v1/plan-versions/${ids.version}/calibration`, { data: { pairs: [{ a: [0, 0.5], b: [1, 0.5], metres: 20 }] } })).status()).toBe(200);
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

  test('C opens the curve mode; dragging a segment middle bends it, the door stays on it, undo straightens', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop drawing');
    await seed();
    await openStructure(page);
    await page.keyboard.press('c');
    await expect(page.locator(`${ED} [data-studio-mode="curve"]`)).toHaveAttribute('aria-pressed', 'true');
    // pick the wall away from its door, then its segment handle appears in the middle
    const pick = await at(page, [0.52, 0.35]);
    await page.mouse.click(pick.x, pick.y);
    const handle = page.locator(`${ED} sw-plan-canvas [data-wall-segment="0"]`);
    await expect(handle).toHaveCount(1);
    const mid = await at(page, [0.4, 0.35]);
    await drag(page, mid, 0, -70);
    await saved(page);
    const d = await draft();
    const w = wallOf(d, 'cw1');
    expect(curvedOf(w)).toBe(true);
    expect(d.doc.schema_version).toBe('2.1');
    const door = d.doc.openings.find((o) => o.id === 'cd1')!;
    expect(door.t).toBeGreaterThan(0.15);
    expect(door.t).toBeLessThan(0.45);
    await page.screenshot({ path: path.join(OUT, 'curve-bend-desktop.png') });
    await page.keyboard.press('Control+z');
    await saved(page);
    expect(curvedOf(wallOf(await draft(), 'cw1'))).toBe(false);
    expect((await draft()).doc.schema_version).toBe('2.0');
    await page.keyboard.press('Control+y');
    await saved(page);
    expect(curvedOf(wallOf(await draft(), 'cw1'))).toBe(true);
  });

  test('the panel sets a segment radius and straightens it', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop drawing');
    await seed();
    await openStructure(page);
    await page.locator(`${ED} [data-studio-mode="curve"]`).click();
    const pick = await at(page, [0.52, 0.35]);
    await page.mouse.click(pick.x, pick.y);
    await page.locator(`${ED} sw-plan-canvas [data-wall-segment="0"]`).click();
    const radius = page.locator(`${ED} [data-segment-radius]`);
    await expect(radius).toHaveCount(1);
    await expect(radius).toHaveValue('');
    await radius.fill('6');
    await radius.press('Enter');
    await saved(page);
    const w = wallOf(await draft(), 'cw1');
    expect(curvedOf(w)).toBe(true);
    // chord 8 m (0.4 of 20 m), radius 6 m: |bulge| = tan(asin(4/6)/2)
    expect(Math.abs(w.bulges![0])).toBeCloseTo(Math.tan(Math.asin(4 / 6) / 2), 3);
    await expect(radius).toHaveValue('6.00');
    await radius.fill('3'); // shorter than half the chord: refused, nothing changes
    await radius.press('Enter');
    await page.waitForTimeout(400);
    expect(Math.abs(wallOf(await draft(), 'cw1').bulges![0])).toBeCloseTo(Math.tan(Math.asin(4 / 6) / 2), 3);
    await page.screenshot({ path: path.join(OUT, 'curve-radius-panel.png') });
    await page.locator(`${ED} [data-segment-straighten]`).click();
    await saved(page);
    expect(curvedOf(wallOf(await draft(), 'cw1'))).toBe(false);
  });

  test('a corner is rounded with a radius tangent to both sides', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop drawing');
    await seed();
    await openStructure(page);
    await page.locator(`${ED} [data-studio-mode="curve"]`).click();
    const pick = await at(page, [0.3, 0.85]);
    await page.mouse.click(pick.x, pick.y);
    await page.locator(`${ED} sw-plan-canvas [data-wall-vertex="2"]`).click();
    const r = page.locator(`${ED} [data-corner-radius]`);
    await expect(r).toHaveCount(1);
    await r.fill('1.5');
    await page.locator(`${ED} [data-corner-apply]`).click();
    await saved(page);
    const w = wallOf(await draft(), 'cw2');
    expect(w.polyline.length).toBe(6);
    expect(w.bulges!.length).toBe(5);
    expect(w.bulges!.filter((b) => b !== 0).length).toBe(1);
    expect(w.polyline[0]).toEqual(w.polyline[w.polyline.length - 1]); // still a closed outline
    await page.screenshot({ path: path.join(OUT, 'corner-rounded.png') });
  });

  test('the arc mode draws an arc wall from start, end and a point on it; Esc cancels a started one', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop drawing');
    await seed();
    await openStructure(page);
    await page.locator(`${ED} [data-studio-mode="arc"]`).click();
    for (const p of [[0.6, 0.8], [0.85, 0.8]] as P[]) {
      const s = await at(page, p);
      await page.mouse.click(s.x, s.y);
    }
    await expect(page.locator(`${ED} [data-arc-hint]`)).toHaveCount(1);
    const through = await at(page, [0.725, 0.62]);
    await page.mouse.move(through.x, through.y, { steps: 4 });
    await expect(page.locator(`${ED} sw-plan-canvas [data-arc-preview]`)).toHaveCount(1);
    await page.screenshot({ path: path.join(OUT, 'arc-mode-preview.png') });
    await page.mouse.click(through.x, through.y);
    await saved(page);
    const d = await draft();
    const arc = d.doc.walls.find((w) => !['cw1', 'cw2'].includes(w.id))!;
    expect(arc.polyline.length).toBe(2);
    expect(Math.abs(arc.bulges![0])).toBeGreaterThan(0.5);
    // a started arc and Esc: nothing added
    const s = await at(page, [0.62, 0.2]);
    await page.mouse.click(s.x, s.y);
    await page.keyboard.press('Escape');
    await expect(page.locator(`${ED} [data-arc-hint]`)).toHaveCount(0);
    expect((await draft()).doc.walls.length).toBe(3);
    // the exports carry the arcs: the SVG draws the sampled path, the DXF writes bulges
    const svg = await (await api.get(`api/v1/plan-versions/${ids.version}/export.svg?draft=true`)).text();
    const line = svg.split('\n').find((l) => l.includes(`data-wall="${arc.id}"`)) ?? '';
    expect(line.split(',').length).toBeGreaterThan(10);
    await page.locator(`${ED} [data-tool="layers"]`).click().catch(() => undefined);
    await page.screenshot({ path: path.join(OUT, 'arc-wall-drawn.png') });
  });

  test('a round room (two half circles) is drawn round on the map and in 3D', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop 3D');
    await seedCurved();
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator('explore-floor-map');
    const round = host.locator('sw-plan-canvas [data-structure] [data-wall="cr1"] polyline');
    await expect(round).toHaveCount(1, { timeout: 20000 });
    expect(((await round.getAttribute('points')) ?? '').trim().split(/\s+/).length).toBeGreaterThan(30);
    await page.screenshot({ path: path.join(OUT, 'round-room-map.png') });
    const toggle = host.locator('[data-view-3d]');
    await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 15000 });
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-floor-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    const parts = await el.evaluate((node) => (node as unknown as { description: { parts: { id: string }[] } }).description.parts.map((p) => p.id));
    expect(parts.filter((id) => id.startsWith('wall:cr1#')).length, 'the round wall is many short boxes').toBeGreaterThan(20);
    expect(parts.filter((id) => id.startsWith('wall:cw1#')).length, 'the bent wall too').toBeGreaterThan(4);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'round-room-3d.png') });
  });

  test('phone: the curved walls are drawn on the floor map; the editor stays desktop only (no curve tools)', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'the phone guard');
    await seedCurved();
    // viewing: the floor map draws the sampled arcs
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const bent = page.locator('explore-floor-map sw-plan-canvas [data-structure] [data-wall="cw1"] polyline');
    await expect(bent).toHaveCount(2, { timeout: 20000 }); // the door cd1 cuts the bent wall into two parts
    for (const part of await bent.all()) expect(((await part.getAttribute('points')) ?? '').trim().split(/\s+/).length).toBeGreaterThan(4);
    await page.screenshot({ path: path.join(OUT, 'phone-map.png') });
    // editing: the editor route is the desktop-only state (owner decision 2026-09-30), so no curve or arc tool exists
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator('sw-app [data-desktop-only="structure"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator(`sw-app ${ED}`)).toHaveCount(0);
    await expect(page.locator('[data-studio-mode="curve"], [data-studio-mode="arc"], sw-plan-canvas [data-wall-segment]')).toHaveCount(0);
    await page.keyboard.press('c');
    await expect(page.locator('sw-plan-canvas [data-wall-segment]')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, 'phone-guard.png') });
    expect(curvedOf(wallOf(await draft(), 'cw1'))).toBe(true); // nothing changed
  });
});
