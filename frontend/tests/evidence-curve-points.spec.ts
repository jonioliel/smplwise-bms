import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// WALLP (owner request 2026-10-08) in the plan editor's structure tool, against a running backend:
// - "קיר מעוגל" (R): points clicked ON the curve, a live preview with length and radius, a double click builds the wall
//   through them; undo / redo per point while drawing; Esc cancels; a click on the first point builds a round room;
// - the clicked points stay the wall's handles: a drag re-fits the curve, a point is added and removed, Ctrl+Z undoes;
// - "קיר זכוכית" (G, also named "קיר מסך"): a glass wall drawn directly, straight or through points (curved glass);
// - a tablet with touch draws by taps and the finish button; the phone keeps the editor desktop-only and draws the walls;
// - evidence screenshots: 2D (light and dark), 3D, tablet, phone. They go to SW_SHOTS or private-evidence/curve-points
//   (not committed). The spec builds its own site / building / floor and removes them. Runs only with SW_LIVE=1.
const BASE = process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
const ED = 'explore-plan-editor';
const ids = { site: '', building: '', floor: '', version: '' };
let api: APIRequestContext;
const OUT = process.env.SW_SHOTS || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'private-evidence', 'curve-points');
fs.mkdirSync(OUT, { recursive: true });

type P = [number, number];
interface Wall { id: string; kind: string; polyline: P[]; bulges?: number[]; external_ids?: Record<string, string>; glazing?: Record<string, unknown> }
interface Draft { geometry: { revision: number }; doc: Record<string, unknown> & { schema_version: string; walls: Wall[]; openings: { id: string; wall_id: string; t: number }[] } }
const draft = async () => (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json()) as Draft;
const throughOf = (w: Wall): P[] => (w.external_ids?.curve_through ?? '').split(',').filter(Boolean).map((i) => w.polyline[Number(i)]);
const curved = (w: Wall) => !!w.bulges && w.bulges.some((b) => b !== 0);
const near = (a: P, b: P, tol = 0.004) => Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol;

async function at(page: Page, p: P): Promise<{ x: number; y: number }> {
  const canvas = page.locator(`${ED} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, q) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(q[0], q[1]), p);
  return { x: box.x + s.x, y: box.y + s.y };
}
async function clickAt(page: Page, p: P) {
  const s = await at(page, p);
  await page.mouse.move(s.x, s.y, { steps: 3 });
  await page.mouse.click(s.x, s.y);
}
async function drag(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 6 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 6 });
  await page.mouse.up();
}
const saved = (page: Page) => expect(page.locator(`${ED} [data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
async function clearWalls() {
  const g = await draft();
  expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc: { ...g.doc, walls: [], openings: [] }, base_revision: g.geometry.revision } })).status()).toBe(200);
}
async function openStructure(page: Page) {
  await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
  await expect(page.locator(`${ED} sw-plan-canvas`)).toHaveCount(1, { timeout: 20000 });
  await page.locator(`${ED} [data-tool="structure"]`).click();
  await expect(page.locator(`${ED} [data-studio-panel]`)).toHaveCount(1, { timeout: 15000 });
}
async function newWalls(before: number): Promise<Wall[]> {
  const d = await draft();
  expect(d.doc.walls.length).toBeGreaterThan(before);
  return d.doc.walls.slice(before);
}

test.describe.serial('plan editor: curved walls through points and the glass wall tool', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: BASE });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת קיר דרך נקודות ${stamp}`, address: '' } })).json()).id;
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

  test('the chips: the wall tools first, the glass wall also named curtain wall, no separate arc / bend chips', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop drawing');
    await clearWalls();
    await openStructure(page);
    const chips = page.locator(`${ED} [data-studio-panel] [data-studio-mode]`);
    await expect(chips).toHaveCount(9);
    expect(await chips.evaluateAll((els) => els.map((e) => e.getAttribute('data-studio-mode')))).toEqual(['select', 'wall', 'curved', 'glass', 'door', 'markdoor', 'window', 'passage', 'label']);
    const glass = page.locator(`${ED} [data-studio-mode="glass"]`);
    await expect(glass).toHaveText('קיר זכוכית');
    await expect(glass).toHaveAttribute('aria-label', /קיר מסך/);
    await expect(page.locator(`${ED} [data-studio-mode="curve"], ${ED} [data-studio-mode="arc"]`)).toHaveCount(0);
    // every chip stays on the panel's width (no horizontal overflow)
    const panel = (await page.locator(`${ED} [data-studio-panel] .modes`).first().boundingBox())!;
    for (const b of await chips.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right))) expect(b).toBeLessThanOrEqual(panel.x + panel.width + 1);
    await page.locator(`${ED} [data-studio-panel]`).screenshot({ path: path.join(OUT, 'chips-desktop.png') });
  });

  test('R draws a curved wall through clicked points: live preview, undo / redo per point, a double click builds it', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop drawing');
    await clearWalls();
    await openStructure(page);
    await page.keyboard.press('r');
    await expect(page.locator(`${ED} [data-studio-mode="curved"]`)).toHaveAttribute('aria-pressed', 'true');
    const pts: P[] = [[0.15, 0.6], [0.28, 0.4], [0.42, 0.35], [0.56, 0.45]];
    for (const p of pts.slice(0, 3)) await clickAt(page, p);
    const hint = page.locator(`${ED} [data-curve-hint]`);
    await expect(hint).toHaveAttribute('data-curve-hint', '3');
    // undo / redo per point while drawing (nothing reaches the document yet)
    await page.keyboard.press('Control+z');
    await expect(hint).toHaveAttribute('data-curve-hint', '2');
    await page.keyboard.press('Control+y');
    await expect(hint).toHaveAttribute('data-curve-hint', '3');
    await page.keyboard.press('Backspace');
    await expect(hint).toHaveAttribute('data-curve-hint', '2');
    await clickAt(page, pts[2]);
    const last = await at(page, pts[3]);
    await page.mouse.move(last.x, last.y, { steps: 5 });
    await expect(page.locator(`${ED} sw-plan-canvas [data-curve-preview]`)).toHaveCount(1);
    await expect(page.locator(`${ED} [data-curve-length]`)).toContainText('מ׳');
    await expect(page.locator(`${ED} [data-curve-radius]`)).toContainText('מ׳');
    await page.screenshot({ path: path.join(OUT, 'curve-draw-preview-desktop.png') });
    expect((await draft()).doc.walls.length).toBe(0);
    await page.mouse.dblclick(last.x, last.y); // the last point, then a second click on it builds the wall
    await saved(page);
    await expect(hint).toHaveCount(0);
    const [w] = await newWalls(0);
    expect(curved(w)).toBe(true);
    const through = throughOf(w);
    expect(through.length).toBe(4);
    through.forEach((q, k) => expect(near(q, pts[k]), `point ${k}: ${q} vs ${pts[k]}`).toBe(true));
    expect((await draft()).doc.schema_version).toBe('2.1');
    // the new wall is selected: its clicked points are its handles, the panel says how many
    await expect(page.locator(`${ED} sw-plan-canvas [data-curve-point]`)).toHaveCount(4);
    await expect(page.locator(`${ED} [data-curve-points="4"]`)).toHaveCount(1);
    await page.screenshot({ path: path.join(OUT, 'curve-built-desktop.png') });
    // Esc cancels a started one: nothing added
    await clickAt(page, [0.7, 0.75]);
    await clickAt(page, [0.8, 0.7]);
    await page.keyboard.press('Escape');
    await expect(hint).toHaveCount(0);
    expect((await draft()).doc.walls.length).toBe(1);
  });

  test('a dragged point re-fits the curve; a point is added and removed; Ctrl+Z / Ctrl+Y', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop drawing');
    const before = (await draft()).doc.walls.find((x) => !!x.external_ids?.curve_through)!;
    await openStructure(page);
    await page.locator(`${ED} [data-studio-mode="select"]`).click();
    const body = await at(page, before.polyline[1]);
    await page.mouse.click(body.x, body.y); // select the wall (a press on a point of its path)
    const handle = page.locator(`${ED} sw-plan-canvas [data-curve-point="2"]`);
    await expect(handle).toHaveCount(1);
    const hb = (await handle.boundingBox())!;
    await drag(page, { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }, 0, 80);
    await saved(page);
    const moved = (await draft()).doc.walls.find((x) => x.id === before.id)!;
    const tb = throughOf(before);
    const tm = throughOf(moved);
    expect(tm.length).toBe(4);
    expect(tm[2][1]).toBeGreaterThan(tb[2][1] + 0.03);
    expect(near(tm[0], tb[0], 1e-6) && near(tm[3], tb[3], 1e-6)).toBe(true);
    await page.screenshot({ path: path.join(OUT, 'curve-point-dragged.png') });
    await page.locator(`${ED} [data-curve-add]`).click();
    await saved(page);
    expect(throughOf((await draft()).doc.walls.find((x) => x.id === before.id)!).length).toBe(5);
    await expect(page.locator(`${ED} sw-plan-canvas [data-curve-point]`)).toHaveCount(5);
    await page.locator(`${ED} sw-plan-canvas [data-curve-point="1"]`).click();
    await expect(page.locator(`${ED} [data-curve-point-selected="1"]`)).toHaveCount(1);
    await page.locator(`${ED} [data-curve-remove]`).click();
    await saved(page);
    expect(throughOf((await draft()).doc.walls.find((x) => x.id === before.id)!).length).toBe(4);
    await page.keyboard.press('Control+z');
    await saved(page);
    expect(throughOf((await draft()).doc.walls.find((x) => x.id === before.id)!).length).toBe(5);
    await page.keyboard.press('Control+y');
    await saved(page);
    expect(throughOf((await draft()).doc.walls.find((x) => x.id === before.id)!).length).toBe(4);
  });

  test('a click on the first point builds a round room: closed, its area in the panel, a door on it', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop drawing');
    await clearWalls();
    await openStructure(page);
    await page.locator(`${ED} [data-studio-mode="curved"]`).click();
    const ring: P[] = [[0.55, 0.3], [0.8, 0.3], [0.8, 0.75], [0.55, 0.75]];
    for (const p of ring) await clickAt(page, p);
    await clickAt(page, ring[0]);
    await saved(page);
    const [w] = await newWalls(0);
    expect(w.polyline[0]).toEqual(w.polyline[w.polyline.length - 1]);
    expect(throughOf(w).length).toBe(4);
    await expect(page.locator(`${ED} [data-wall-area]`)).toContainText('מ״ר');
    await page.locator(`${ED} [data-studio-mode="door"]`).click();
    // the four points are a rectangle's corners, so the ring is their circle: on the 1000 x 600 px plan its centre is
    // (675, 315) px and its radius 184 px - the bottom of the arc at 499 px = 0.832
    await clickAt(page, [0.675, 0.83]); // on the bulging arc below the bottom span, not on its chord
    await saved(page);
    const d = await draft();
    expect(d.doc.openings.filter((o) => o.wall_id === w.id).length).toBe(1);
    await page.screenshot({ path: path.join(OUT, 'round-room-door-desktop.png') });
  });

  test('the glass wall tool: straight and curved glass, glazing defaults, the DXF arcs, 2D light / dark and 3D', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop drawing');
    await openStructure(page);
    const n0 = (await draft()).doc.walls.length;
    await page.keyboard.press('g');
    await expect(page.locator(`${ED} [data-studio-mode="glass"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${ED} [data-glass-shape]`)).toHaveCount(1);
    await clickAt(page, [0.1, 0.15]);
    await clickAt(page, [0.45, 0.15]);
    await page.keyboard.press('Enter');
    await saved(page);
    const [straight] = await newWalls(n0);
    expect(straight.kind).toBe('glass');
    expect(straight.glazing).toBeTruthy();
    expect(curved(straight)).toBe(false);
    await page.locator(`${ED} [data-glass-shape-curved]`).click();
    for (const p of [[0.1, 0.45], [0.25, 0.32], [0.4, 0.45]] as P[]) await clickAt(page, p);
    await page.locator(`${ED} [data-curve-finish]`).click();
    await saved(page);
    const glassWalls = await newWalls(n0);
    const arc = glassWalls.find((x) => x.id !== straight.id)!;
    expect(arc.kind).toBe('glass');
    expect(curved(arc)).toBe(true);
    expect(arc.polyline.length).toBe(3); // three points: one arc
    await expect(page.locator(`${ED} [data-glazing-inspector]`)).toHaveCount(1);
    await expect(page.locator(`${ED} [data-studio-panel] .selhead strong`).first()).toHaveText('קיר זכוכית');
    await page.screenshot({ path: path.join(OUT, 'glass-tool-desktop-light.png') });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, 'glass-tool-desktop-dark.png') });
    await page.emulateMedia({ colorScheme: 'light' });
    // the DXF writes the curved glass as arcs on the glazing layer
    const dxf = await (await api.get(`api/v1/plan-versions/${ids.version}/export.dxf?draft=true`)).text();
    expect(dxf).toContain('SW_GLAZING');
    // publish, then the floor map draws it in 2D and in 3D
    expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator('explore-floor-map');
    await expect(host.locator(`sw-plan-canvas [data-structure] [data-wall="${arc.id}"]`).first()).toBeAttached({ timeout: 20000 });
    await page.screenshot({ path: path.join(OUT, 'map-2d-desktop.png') });
    const toggle = host.locator('[data-view-3d]');
    await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 15000 });
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-floor-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    const parts = await el.evaluate((node) => (node as unknown as { description: { parts: { id: string }[] } }).description.parts.map((p) => p.id));
    expect(parts.filter((id) => id.startsWith(`wall:${arc.id}#`)).length, 'the curved glass wall is drawn in 3D').toBeGreaterThan(0);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'map-3d-desktop.png') });
  });

  test('tablet with touch: taps place the points, the finish button builds the wall', async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'one touch run is enough');
    const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1024, height: 768 }, hasTouch: true, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
    const page = await ctx.newPage();
    try {
      await openStructure(page);
      const n0 = (await draft()).doc.walls.length;
      await page.locator(`${ED} [data-studio-mode="curved"]`).tap();
      for (const p of [[0.12, 0.85], [0.25, 0.72], [0.38, 0.85]] as P[]) {
        const s = await at(page, p);
        await page.touchscreen.tap(s.x, s.y);
      }
      await expect(page.locator(`${ED} [data-curve-hint]`)).toHaveAttribute('data-curve-hint', '3');
      await page.screenshot({ path: path.join(OUT, 'curve-draw-tablet.png') });
      await page.locator(`${ED} [data-curve-finish]`).tap();
      await saved(page);
      const [w] = await newWalls(n0);
      expect(throughOf(w).length).toBe(3);
      await page.screenshot({ path: path.join(OUT, 'curve-built-tablet.png') });
    } finally {
      await ctx.close();
    }
  });

  test('phone: the walls drawn through points are drawn on the floor map; the editor stays desktop only', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'the phone guard');
    // each project builds its own floor: the walls the frontend fit draws (the shared fixture) are seeded and published
    const fx = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'contracts', 'fixtures', 'plan_geometry', 'sample-curve-points.json'), 'utf8')) as { walls: Wall[]; openings: unknown[] };
    const g = await draft();
    expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc: { ...g.doc, walls: fx.walls, openings: fx.openings }, base_revision: g.geometry.revision } })).status()).toBe(200);
    expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const walls = page.locator('explore-floor-map sw-plan-canvas [data-structure] [data-wall]');
    await expect(walls.first()).toBeAttached({ timeout: 20000 });
    await page.screenshot({ path: path.join(OUT, 'phone-map.png') });
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator('sw-app [data-desktop-only="structure"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-studio-mode="curved"], [data-studio-mode="glass"]')).toHaveCount(0);
    await page.keyboard.press('r');
    await page.keyboard.press('g');
    await expect(page.locator('[data-curve-hint]')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, 'phone-guard.png') });
  });
});
