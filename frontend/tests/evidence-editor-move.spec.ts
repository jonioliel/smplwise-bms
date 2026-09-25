import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Hotfix 0.1.87 (owner report 2026-09-25): in the plan editor's select tool ("בחירה וגרירה") a wall is selected by a
// click and then moves as a whole by its body (its door keeps its place along it, the arrow keys nudge it), a small
// object is easy to press at a zoomed-out view and drags, a room / zone is selected with its handles and moves as a
// whole, and on a phone the same presses work by touch. Against the running backend: the spec builds its own site /
// building / floor with a generated plan picture and removes them at the end. Runs only with SW_LIVE=1.
const BASE = process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
const ED = 'explore-plan-editor';
const ids = { site: '', building: '', floor: '', version: '' };
const zoneIds: string[] = [];
let api: APIRequestContext;

type P = [number, number];
const WALL = (id: string, polyline: P[]) => ({ id, level_id: 'L0', polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} });
const DOOR = (id: string, wallId: string, t: number) => ({ id, wall_id: wallId, t, kind: 'door', width_m: 0.9, height_m: 2.1, sill_m: 0, swing: 'right', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} });
const CHAIR = (id: string, pos: P) => ({ id, item_id: 'chair.basic', level_id: 'L0', position: pos, rotation_deg: 0, size: { w_m: 0.4, d_m: 0.4, h_m: 0.85 }, z_m: 0, params: {}, label: null, anchor_ref: null,
  group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {} });

interface Draft {
  geometry: { revision: number };
  doc: Record<string, unknown> & { walls: { id: string; polyline: P[] }[]; openings: { id: string; wall_id: string; t: number }[]; objects: { id: string; position: P }[] };
}
const draft = async () => (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json()) as Draft;
const saveDraft = async (patch: Record<string, unknown>) => {
  const g = await draft();
  expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc: { ...g.doc, ...patch }, base_revision: g.geometry.revision } })).status()).toBe(200);
};
/** The seeded structure: a wall with a door across the upper half, a second wall lower down, a 0.4 m chair. */
const SEED = { walls: [WALL('mw1', [[0.2, 0.3], [0.6, 0.3]]), WALL('mw2', [[0.2, 0.85], [0.5, 0.85]])], openings: [DOOR('md1', 'mw1', 0.5)], objects: [CHAIR('mo1', [0.75, 0.55])] };
const wallOf = (d: Draft, id: string) => d.doc.walls.find((w) => w.id === id)!;
const zoneOf = async (id: string) => ((await (await api.get(`api/v1/floors/${ids.floor}/zones`)).json()) as { zones: { id: string; revision: number; polygon: { x: number; y: number }[] }[] }).zones.find((z) => z.id === id)!;

/** Page pixels of a normalized plan point (the canvas converts plan to host pixels itself). */
async function at(page: Page, p: P): Promise<{ x: number; y: number }> {
  const canvas = page.locator(`${ED} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, q) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(q[0], q[1]), p);
  return { x: box.x + s.x, y: box.y + s.y };
}

/** A mouse drag by (dx, dy) page pixels from a page point, in small steps. */
async function mouseDrag(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 5 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 5 });
  await page.mouse.up();
}

/** A one-finger drag through the browser's touch input (pointerType "touch"), with a finger-sized contact. */
async function touchDrag(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  const cdp = await page.context().newCDPSession(page);
  const point = (x: number, y: number) => [{ x: Math.round(x), y: Math.round(y), radiusX: 8, radiusY: 8, force: 1, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from.x, from.y) });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(from.x + (dx * i) / 8, from.y + (dy * i) / 8) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

async function openEditor(page: Page) {
  await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
  await expect(page.locator(`${ED} sw-plan-canvas [data-wall]`)).not.toHaveCount(0, { timeout: 20000 });
  await expect(page.locator(`${ED} [data-tool="select"]`)).toHaveAttribute('aria-pressed', 'true'); // the editor opens in the select tool
  await expect(page.locator(`${ED} sw-plan-canvas [data-hit-wall="mw1"]`)).toHaveCount(2); // the select tool picks the structure (the door cuts mw1 in two)
}

const saved = (page: Page) => expect(page.locator(`${ED} [data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });

test.describe.serial('editor: select and move walls, objects and zones (0.1.87)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: BASE });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת הזזה ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה בדיקה' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומת הזזה', level: 0 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent('<div style="box-sizing:border-box;width:1000px;height:600px;background:#fff;border:10px solid #333"></div>');
    const png = await page.screenshot();
    await page.close();
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
    ids.version = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
    // 1 m = 25 px: the 1000 px plan is 40 m wide, so a 0.4 m chair is 10 plan px - a few screen px zoomed out
    expect((await api.patch(`api/v1/plan-versions/${ids.version}/calibration`, { data: { pairs: [{ a: [0, 0.5], b: [1, 0.5], metres: 40 }] } })).status()).toBe(200);
  });

  test.afterAll(async () => {
    if (!api) return;
    // every delete is tried, even after one fails, so a single leftover does not keep the rest in the backend
    const failures: string[] = [];
    const remove = async (what: string, path: string) => {
      try {
        const status = (await api.delete(path)).status();
        if (status !== 204) failures.push(`${what}: ${status}`);
      } catch (err) {
        failures.push(`${what}: ${String(err)}`);
      }
    };
    try {
      for (const z of zoneIds) await remove(`zone ${z}`, `api/v1/zones/${z}`);
      if (ids.floor) await remove('test floor', `api/v1/floors/${ids.floor}?force=true`);
      if (ids.building) await remove('test building', `api/v1/buildings/${ids.building}`);
      if (ids.site) await remove('test site', `api/v1/sites/${ids.site}`);
    } finally {
      await api.dispose();
    }
    expect(failures, 'test data removed').toEqual([]);
  });

  test('select tool: a click selects a wall with its inspector, a drag on its body moves it whole, the door rides along, the arrows nudge it', async ({ page }) => {
    await saveDraft(SEED);
    await openEditor(page);
    const before = await draft();
    const w0 = wallOf(before, 'mw1').polyline;
    // a first press on an unselected wall only selects it: nothing moves
    const grab = await at(page, [0.3, 0.3]);
    await page.mouse.click(grab.x, grab.y);
    await expect(page.locator(`${ED} [data-studio-compact] [data-selected-wall="mw1"]`)).toBeVisible();
    await expect(page.locator(`${ED} [data-select-geom-hint]`)).toContainText('קיר זז רק אחרי שנבחר');
    await expect(page.locator(`${ED} [data-tool="select"]`)).toHaveAttribute('aria-pressed', 'true'); // still the select tool
    await expect(page.locator(`${ED} sw-plan-canvas [data-hit-wall="mw1"][data-wall-body]`)).not.toHaveCount(0);
    await expect(page.locator(`${ED} sw-plan-canvas [data-wall-vertex]`)).toHaveCount(2);
    expect(await page.locator(`${ED} sw-plan-canvas [data-hit-wall="mw1"][data-wall-body]`).first().evaluate((el) => getComputedStyle(el).cursor)).toBe('move');
    expect(wallOf(await draft(), 'mw1').polyline).toEqual(w0);

    // the drag on its body: both corners by the same delta, the door keeps t, the draft revision rises
    await mouseDrag(page, grab, 60, 45);
    await expect.poll(async () => wallOf(await draft(), 'mw1').polyline[0][1], { timeout: 10000 }).toBeGreaterThan(w0[0][1] + 0.02);
    await saved(page);
    const after = await draft();
    const w1 = wallOf(after, 'mw1').polyline;
    const d0 = [w1[0][0] - w0[0][0], w1[0][1] - w0[0][1]];
    const d1 = [w1[1][0] - w0[1][0], w1[1][1] - w0[1][1]];
    expect(d0[0]).toBeGreaterThan(0.02);
    expect(d1[0]).toBeCloseTo(d0[0], 4);
    expect(d1[1]).toBeCloseTo(d0[1], 4);
    expect(after.doc.openings.find((o) => o.id === 'md1')).toMatchObject({ wall_id: 'mw1', t: 0.5 });
    expect(after.geometry.revision).toBeGreaterThan(before.geometry.revision);
    expect(wallOf(after, 'mw2').polyline).toEqual(wallOf(before, 'mw2').polyline);
    await expect(page.locator(`${ED} [data-selected-wall="mw1"]`)).toBeVisible(); // still selected after the drop

    // two Shift+ArrowRight presses: 10 cm each (2.5 plan px of 1000), one undo step
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(async () => wallOf(await draft(), 'mw1').polyline[0][0], { timeout: 10000 }).toBeCloseTo(w1[0][0] + 0.005, 5);
    const nudged = wallOf(await draft(), 'mw1').polyline;
    expect(nudged[1][0]).toBeCloseTo(w1[1][0] + 0.005, 5);
    expect(nudged[0][1]).toBe(w1[0][1]);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => wallOf(await draft(), 'mw1').polyline, { timeout: 10000 }).toEqual(w1);

    // Esc clears the selection
    const again = await at(page, [0.3 + d0[0], 0.3 + d0[1]]);
    await page.mouse.click(again.x, again.y);
    await expect(page.locator(`${ED} [data-selected-wall="mw1"]`)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator(`${ED} [data-selected-wall]`)).toHaveCount(0);
    await expect(page.locator(`${ED} sw-plan-canvas [data-wall-vertex]`)).toHaveCount(0);
  });

  test('select tool: a 0.4 m object at a zoomed-out view is pressed beside its drawn footprint, selected and dragged', async ({ page }) => {
    await saveDraft(SEED);
    await openEditor(page);
    const canvas = page.locator(`${ED} sw-plan-canvas`);
    await canvas.evaluate((el) => (el as unknown as { zoomBy: (f: number) => void }).zoomBy(0.5));
    const fp = (await page.locator(`${ED} sw-plan-canvas [data-object="mo1"] .fp`).boundingBox())!;
    expect(fp.width, 'the chair is drawn a few pixels wide').toBeLessThan(12);
    const hit = (await page.locator(`${ED} sw-plan-canvas [data-hit-object="mo1"]`).boundingBox())!;
    expect(hit.width, 'its hit area is at least 24 px').toBeGreaterThanOrEqual(23.5);
    expect(hit.height).toBeGreaterThanOrEqual(23.5);
    const c = await at(page, [0.75, 0.55]);
    // a press 9 px beside the centre: outside the drawn chair, inside its hit area
    await page.mouse.click(c.x + 9, c.y - 9);
    await expect(page.locator(`${ED} [data-selected-object="mo1"]`)).toBeVisible();
    await expect(page.locator(`${ED} [data-tool="select"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${ED} [data-library-panel]`)).toHaveCount(0); // the inspector only, not the library
    await mouseDrag(page, { x: c.x + 9, y: c.y - 9 }, -50, 40);
    await expect.poll(async () => (await draft()).doc.objects.find((o) => o.id === 'mo1')!.position[0], { timeout: 10000 }).toBeLessThan(0.74);
    const moved = (await draft()).doc.objects.find((o) => o.id === 'mo1')!.position;
    expect(moved[1]).toBeGreaterThan(0.56);
    await saved(page);
  });

  test('select tool: a click on a zone shows its handles and the hint; a drag on its body moves the polygon and saves it once', async ({ page }) => {
    await saveDraft(SEED);
    const poly = [{ x: 0.05, y: 0.45 }, { x: 0.15, y: 0.45 }, { x: 0.15, y: 0.6 }, { x: 0.05, y: 0.6 }];
    const created = await api.post(`api/v1/floors/${ids.floor}/zones`, { data: { name: 'חדר הזזה', kind: 'room', polygon: poly } });
    expect(created.status()).toBe(201);
    const zone = await created.json();
    zoneIds.push(zone.id);
    await openEditor(page);
    const c = await at(page, [0.1, 0.52]);
    await page.mouse.click(c.x, c.y);
    const sel = page.locator(`${ED} sw-plan-canvas g.zone.selected`);
    await expect(sel).toHaveCount(1);
    await expect(sel.locator('circle.vtx')).toHaveCount(4);
    await expect(sel.locator('circle.vmid')).toHaveCount(4);
    await expect(page.locator(`${ED} [data-zone-hint]`)).toHaveText('גרור פינה כדי לשנות צורה, גרור נקודת אמצע כדי להוסיף פינה, גרור את הגוף כדי להזיז; Delete על פינה מסיר אותה');
    expect(await sel.locator('[data-zone-body]').evaluate((el) => getComputedStyle(el).cursor)).toBe('move');
    const rev = (await zoneOf(zone.id)).revision;

    await mouseDrag(page, c, 50, 30);
    await expect.poll(async () => (await zoneOf(zone.id)).polygon[0].x, { timeout: 10000 }).toBeGreaterThan(0.06);
    const moved = await zoneOf(zone.id);
    expect(moved.revision).toBe(rev + 1); // one PATCH on the release
    const dx = moved.polygon[0].x - poly[0].x;
    const dy = moved.polygon[0].y - poly[0].y;
    expect(dy).toBeGreaterThan(0.01);
    moved.polygon.forEach((q, i) => {
      expect(q.x).toBeCloseTo(poly[i].x + dx, 3);
      expect(q.y).toBeCloseTo(poly[i].y + dy, 3);
    });
    await expect(sel).toHaveCount(1); // still selected

    // a press on a corner picks it; Delete removes that corner, not the zone
    const v = (await sel.locator('circle.vtx[data-vertex="2"]').boundingBox())!;
    await page.mouse.click(v.x + v.width / 2, v.y + v.height / 2);
    await expect(sel.locator('circle.vtx.on[data-vertex="2"]')).toHaveCount(1);
    await page.keyboard.press('Delete');
    await expect.poll(async () => (await zoneOf(zone.id)).polygon.length, { timeout: 10000 }).toBe(3);
    expect((await zoneOf(zone.id)).revision).toBe(rev + 2);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('a wall and a small object are selected by a tap and dragged by a finger', async ({ page }) => {
      await saveDraft(SEED);
      await openEditor(page);
      await page.locator(`${ED} sw-plan-canvas`).scrollIntoViewIfNeeded();
      // the wall: a tap selects, a finger drag on its body moves it
      const w0 = wallOf(await draft(), 'mw1').polyline;
      const grab = await at(page, [0.3, 0.3]);
      await page.touchscreen.tap(grab.x, grab.y + 4); // a finger lands a little off the centre line
      await expect(page.locator(`${ED} [data-selected-wall="mw1"]`)).toBeAttached();
      await touchDrag(page, { x: grab.x, y: grab.y + 3 }, 30, 40);
      await expect.poll(async () => wallOf(await draft(), 'mw1').polyline[0][1], { timeout: 10000 }).toBeGreaterThan(w0[0][1] + 0.02);
      const w1 = wallOf(await draft(), 'mw1').polyline;
      expect(w1[1][1] - w0[1][1]).toBeCloseTo(w1[0][1] - w0[0][1], 4);
      await saved(page);
      // the chair: a few pixels on a phone; a tap beside it selects it and a finger drag moves it
      const fp = (await page.locator(`${ED} sw-plan-canvas [data-object="mo1"] .fp`).boundingBox())!;
      expect(fp.width).toBeLessThan(10);
      const c = await at(page, [0.75, 0.55]);
      await page.touchscreen.tap(c.x + 7, c.y + 6);
      await expect(page.locator(`${ED} [data-selected-object="mo1"]`)).toBeAttached();
      await touchDrag(page, { x: c.x + 6, y: c.y + 5 }, -40, 30);
      await expect.poll(async () => (await draft()).doc.objects.find((o) => o.id === 'mo1')!.position[0], { timeout: 10000 }).toBeLessThan(0.72);
      await saved(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), 'no sideways scroll').toBe(390);
    });
  });
});
