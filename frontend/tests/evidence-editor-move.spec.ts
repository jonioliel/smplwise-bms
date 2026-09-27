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

// ---- T085 multi-select helpers ----
type ZP = { x: number; y: number };
/** A zone made through the API (and its level set when given), removed in afterAll unless a test deleted it itself. */
async function makeZone(name: string, polygon: ZP[], level?: string): Promise<string> {
  const r = await api.post(`api/v1/floors/${ids.floor}/zones`, { data: { name, kind: 'room', polygon } });
  expect(r.status()).toBe(201);
  const z = (await r.json()) as { id: string; revision: number };
  zoneIds.push(z.id);
  if (level) expect((await api.patch(`api/v1/zones/${z.id}`, { data: { revision: z.revision, level_id: level } })).status()).toBe(200);
  return z.id;
}
const allZones = async () => ((await (await api.get(`api/v1/floors/${ids.floor}/zones`)).json()) as { zones: { id: string; level_id?: string | null }[] }).zones;
const positions = async (idList: string[]) => {
  const d = await draft();
  return idList.map((id) => d.doc.objects.find((o) => o.id === id)!.position);
};
const objAt = (page: Page, id: string) => page.locator(`${ED} sw-plan-canvas [data-structure] [data-object="${id}"]`);
/** A marquee: a mouse drag from one normalized plan point to another. */
async function marquee(page: Page, from: P, to: P) {
  const a = await at(page, from);
  const b = await at(page, to);
  await mouseDrag(page, a, b.x - a.x, b.y - a.y);
}

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

    // Shift keeps a diagonal drag horizontal (the larger screen component)
    const body1 = await at(page, [0.3 + d0[0], 0.3 + d0[1]]);
    await page.mouse.click(body1.x, body1.y);
    await expect(page.locator(`${ED} [data-selected-wall="mw1"]`)).toBeVisible();
    await page.keyboard.down('Shift');
    await mouseDrag(page, body1, 50, 18);
    await page.keyboard.up('Shift');
    await expect.poll(async () => wallOf(await draft(), 'mw1').polyline[0][0], { timeout: 10000 }).toBeGreaterThan(w1[0][0] + 0.02);
    const w2 = wallOf(await draft(), 'mw1').polyline;
    expect(w2[0][1]).toBe(w1[0][1]); // no vertical component
    expect(w2[1][1]).toBe(w1[1][1]);
    expect(w2[1][0] - w1[1][0]).toBeCloseTo(w2[0][0] - w1[0][0], 4);

    // corner snap: the start corner dropped 4 px / -5 px off the other wall's end lands exactly on it, the wall follows
    const start2 = await at(page, w2[0]);
    const target = await at(page, [0.5, 0.85]);
    const body2 = await at(page, [(w2[0][0] + w2[1][0]) / 2 - 0.05, w2[0][1]]);
    await mouseDrag(page, body2, target.x + 4 - start2.x, target.y - 5 - start2.y);
    await expect.poll(async () => wallOf(await draft(), 'mw1').polyline[0], { timeout: 10000 }).toEqual([0.5, 0.85]);
    const w3 = wallOf(await draft(), 'mw1').polyline;
    expect(w3[1][0]).toBeCloseTo(0.5 + (w2[1][0] - w2[0][0]), 4);
    expect(w3[1][1]).toBe(0.85);
    await saved(page);

    // one undo step per drag: Ctrl+Z back to before the snap drag, again back to before the Shift drag
    await page.keyboard.press('Control+z');
    await expect.poll(async () => wallOf(await draft(), 'mw1').polyline, { timeout: 10000 }).toEqual(w2);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => wallOf(await draft(), 'mw1').polyline, { timeout: 10000 }).toEqual(w1);

    // Delete the selected wall (its door goes with it), then Ctrl+Z restores both; a further Ctrl+Z keeps undoing the
    // structure (the first drag) even though nothing is selected any more
    const body3 = await at(page, [0.3 + d0[0], 0.3 + d0[1]]);
    await page.mouse.click(body3.x, body3.y);
    await expect(page.locator(`${ED} [data-selected-wall="mw1"]`)).toBeVisible();
    await page.keyboard.press('Delete');
    await expect.poll(async () => (await draft()).doc.walls.some((w) => w.id === 'mw1'), { timeout: 10000 }).toBe(false);
    await expect(page.locator(`${ED} [data-rail-undo]`)).not.toHaveAttribute('disabled', '');
    await page.keyboard.press('Control+z');
    await expect.poll(async () => wallOf(await draft(), 'mw1')?.polyline, { timeout: 10000 }).toEqual(w1);
    expect((await draft()).doc.openings.some((o) => o.id === 'md1')).toBe(true);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => wallOf(await draft(), 'mw1').polyline, { timeout: 10000 }).toEqual(w0);

    // Esc clears the selection
    const again = await at(page, [0.3, 0.3]);
    await page.mouse.click(again.x, again.y);
    await expect(page.locator(`${ED} [data-selected-wall="mw1"]`)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator(`${ED} [data-selected-wall]`)).toHaveCount(0);
    await expect(page.locator(`${ED} sw-plan-canvas [data-wall-vertex]`)).toHaveCount(0);
  });

  test('select tool: after a wall is selected, dragging a pin makes the pin the selection - Delete offers the pin and the wall stays', async ({ page }) => {
    const cams = (await (await api.get('api/v1/cameras')).json()) as { cameras?: { id: string }[] } | { id: string }[];
    const list = Array.isArray(cams) ? cams : cams.cameras ?? [];
    test.skip(!list.length, 'no registered camera to place a pin with');
    await saveDraft(SEED);
    const anchor = await api.post(`api/v1/floors/${ids.floor}/anchors`, { data: { resource_type: 'camera', resource_id: list[0].id, x: 0.85, y: 0.2 } });
    expect(anchor.status()).toBe(201);
    const pin = (await anchor.json()) as { id: string };
    const anchors = async () => ((await (await api.get(`api/v1/floors/${ids.floor}/anchors`)).json()) as { anchors: { id: string }[] }).anchors.length;
    await openEditor(page);
    const grab = await at(page, [0.3, 0.3]);
    await page.mouse.click(grab.x, grab.y);
    await expect(page.locator(`${ED} [data-selected-wall="mw1"]`)).toBeVisible();
    const m = (await page.locator(`${ED} sw-plan-canvas g.marker[data-id="${pin.id}"] circle.pin`).boundingBox())!;
    await mouseDrag(page, { x: m.x + m.width / 2, y: m.y + m.height / 2 }, 30, 30);
    await expect(page.locator(`${ED} [data-selected-wall]`)).toHaveCount(0); // the pin is the selection now
    await expect(page.locator(`${ED} sw-plan-canvas [data-wall-vertex]`)).toHaveCount(0);
    let asked = '';
    page.once('dialog', (d) => {
      asked = d.message();
      void d.accept();
    });
    const walls = (await draft()).doc.walls.length;
    await page.keyboard.press('Delete');
    await expect.poll(() => asked).toContain('להסיר את'); // the pin is offered for removal
    await expect.poll(anchors, { timeout: 10000 }).toBe(0);
    expect((await draft()).doc.walls.length).toBe(walls);
    expect(wallOf(await draft(), 'mw1').polyline).toEqual(SEED.walls[0].polyline);
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

  // T085 multi-select (owner report 2026-09-26): Shift+click, a marquee and Ctrl+A select several items; the selection
  // moves, is copied and is deleted together, each as one undo step; Ctrl+A keeps to the level filter.
  test('select tool: Shift+click and a marquee select several objects; they move, are copied and deleted together; Ctrl+A keeps to the level filter', async ({ page }) => {
    const levels0 = ((await draft()).doc as { levels?: unknown[] }).levels ?? [];
    const LEVEL = (id: string, name: string, isDefault: boolean) => ({ id, name, elevation_m: isDefault ? 0 : -1.2, ceiling_height_m: 3, is_default: isDefault, external_ids: {} });
    const three: P[] = [[0.3, 0.55], [0.4, 0.55], [0.5, 0.55]];
    const names = ['ms1', 'ms2', 'ms3'];
    await saveDraft({ ...SEED, levels: [LEVEL('L0', 'קומת כניסה', true), LEVEL('L1', 'מרתף', false)],
      objects: [...SEED.objects, ...names.map((id, i) => CHAIR(id, three[i])), { ...CHAIR('ms4', [0.6, 0.7]), level_id: 'L1' }, { ...CHAIR('ms5', [0.7, 0.7]), level_id: 'L1' }] });
    try {
      await openEditor(page);
      const obj = (id: string) => objAt(page, id);
      const panel = page.locator(`${ED} [data-multi-panel]`);
      const shiftClick = async (p: P) => {
        const s = await at(page, p);
        await page.keyboard.down('Shift');
        await page.mouse.click(s.x, s.y);
        await page.keyboard.up('Shift');
      };

      // Shift+click two chairs: one alone is the ordinary selection, the second makes a multi-selection of two
      await shiftClick(three[0]);
      await expect(page.locator(`${ED} [data-selected-object="ms1"]`)).toBeVisible();
      await shiftClick(three[1]);
      await expect(panel).toHaveAttribute('data-multi-count', '2');
      await expect(obj('ms1')).toHaveClass(/\bsel\b/);
      await expect(obj('ms2')).toHaveClass(/\bsel\b/);
      await expect(obj('ms3')).not.toHaveClass(/\bsel\b/);

      // a marquee from the bare plan around all three picks all three and nothing else
      await marquee(page, [0.25, 0.47], [0.56, 0.63]);
      await expect(panel).toHaveAttribute('data-multi-count', '3');
      for (const id of names) await expect(obj(id)).toHaveClass(/\bsel\b/);
      await expect(obj('mo1')).not.toHaveClass(/\bsel\b/);

      // dragging one of them moves all three by the same delta; the rest stays; one Ctrl+Z puts all three back
      const p0 = await positions([...names, 'mo1']);
      await mouseDrag(page, await at(page, three[1]), 60, 40);
      await expect.poll(async () => (await positions(['ms2']))[0][0], { timeout: 10000 }).toBeGreaterThan(p0[1][0] + 0.02);
      const p1 = await positions([...names, 'mo1']);
      const dx = p1[0][0] - p0[0][0];
      const dy = p1[0][1] - p0[0][1];
      expect(dy).toBeGreaterThan(0.02);
      for (const i of [1, 2]) {
        expect(p1[i][0] - p0[i][0]).toBeCloseTo(dx, 4);
        expect(p1[i][1] - p0[i][1]).toBeCloseTo(dy, 4);
      }
      expect(p1[3]).toEqual(p0[3]);
      await expect(panel).toHaveAttribute('data-multi-count', '3'); // the selection stays after the drop
      await saved(page);
      await page.keyboard.press('Control+z');
      await expect.poll(async () => JSON.stringify(await positions(names)), { timeout: 10000 }).toBe(JSON.stringify(p0.slice(0, 3)));
      await page.keyboard.press('Control+y');
      await expect.poll(async () => JSON.stringify(await positions(names)), { timeout: 10000 }).toBe(JSON.stringify(p1.slice(0, 3)));

      // undo / redo clear the selection: the marquee takes the three again where they are now
      const xs = p1.slice(0, 3).map((p) => p[0]);
      const ys = p1.slice(0, 3).map((p) => p[1]);
      await marquee(page, [Math.min(...xs) - 0.04, Math.min(...ys) - 0.06], [Math.max(...xs) + 0.04, Math.max(...ys) + 0.06]);
      await expect(panel).toHaveAttribute('data-multi-count', '3');

      // "שכפל": three copies as one block beside the three, every copy by the same shift, and the copies are the selection
      const known = new Set((await draft()).doc.objects.map((o) => o.id));
      await page.locator(`${ED} [data-multi-duplicate]`).click();
      await expect.poll(async () => (await draft()).doc.objects.length, { timeout: 10000 }).toBe(known.size + 3);
      const copies = (await draft()).doc.objects.filter((o) => !known.has(o.id));
      const sx = copies[0].position[0] - p1[0][0];
      const sy = copies[0].position[1] - p1[0][1];
      expect(Math.abs(sx) + Math.abs(sy)).toBeGreaterThan(0.05);
      copies.forEach((c, i) => {
        expect(c.position[0] - p1[i][0]).toBeCloseTo(sx, 4);
        expect(c.position[1] - p1[i][1]).toBeCloseTo(sy, 4);
      });
      await expect(panel).toHaveAttribute('data-multi-count', '3');
      for (const c of copies) await expect(obj(c.id)).toHaveClass(/\bsel\b/);
      for (const id of names) await expect(obj(id)).not.toHaveClass(/\bsel\b/);

      // Delete removes all three copies in one action; one Ctrl+Z brings all three back, Ctrl+Y removes them again
      await page.keyboard.press('Delete');
      await expect(panel).toHaveCount(0);
      await expect.poll(async () => (await draft()).doc.objects.filter((o) => !known.has(o.id)).length, { timeout: 10000 }).toBe(0);
      expect((await draft()).doc.objects.map((o) => o.id).sort()).toEqual([...known].sort());
      await page.keyboard.press('Control+z');
      await expect.poll(async () => (await draft()).doc.objects.length, { timeout: 10000 }).toBe(known.size + 3);
      await page.keyboard.press('Control+y');
      await expect.poll(async () => (await draft()).doc.objects.length, { timeout: 10000 }).toBe(known.size);

      // Ctrl+A under the L1 filter: the two L1 chairs and the zones of L1 - never an L0 wall, object or zone, although the
      // editor draws every zone under every filter; a zone without a level is on the default level L0, as the backend,
      // the inspector and the 3D view read it (review S2, corrected by R1: filter, Ctrl+A, Delete must not take the other
      // level's rooms, and most rooms never get a level by hand)
      const myZone = { id: await makeZone('חדר מרתף', [{ x: 0.82, y: 0.6 }, { x: 0.9, y: 0.6 }, { x: 0.9, y: 0.7 }, { x: 0.82, y: 0.7 }], 'L1') };
      const groundZone = await makeZone('חדר קרקע', [{ x: 0.04, y: 0.04 }, { x: 0.12, y: 0.04 }, { x: 0.12, y: 0.12 }, { x: 0.04, y: 0.12 }], 'L0');
      const noLevelZone = await makeZone('חדר בלי מפלס', [{ x: 0.04, y: 0.16 }, { x: 0.12, y: 0.16 }, { x: 0.12, y: 0.22 }, { x: 0.04, y: 0.22 }]);
      const zoneCount = (await allZones()).filter((z) => z.level_id === 'L1').length;
      await page.reload(); // the editor loads the new zones
      await expect(page.locator(`${ED} sw-plan-canvas g.zone[data-zone="${myZone.id}"]`)).toHaveCount(1, { timeout: 20000 });
      await page.locator(`${ED} [data-level-chip="L1"]`).click();
      await expect(obj('ms1')).toHaveCount(0); // the L0 chairs are not drawn under the L1 filter
      await expect(page.locator(`${ED} sw-plan-canvas g.zone[data-zone="${groundZone}"]`)).toHaveCount(1); // the L0 zone is drawn
      await page.keyboard.press('Control+a');
      await expect(panel).toHaveAttribute('data-multi-count', String(2 + zoneCount));
      await expect(obj('ms4')).toHaveClass(/\bsel\b/);
      await expect(obj('ms5')).toHaveClass(/\bsel\b/);
      await expect(page.locator(`${ED} sw-plan-canvas g.zone.selected[data-zone="${myZone.id}"]`)).toHaveCount(1);
      await expect(page.locator(`${ED} sw-plan-canvas g.zone.selected[data-zone="${groundZone}"]`)).toHaveCount(0); // ... but not selected
      await expect(page.locator(`${ED} sw-plan-canvas g.zone[data-zone="${noLevelZone}"]`)).toHaveCount(1);
      await expect(page.locator(`${ED} sw-plan-canvas g.zone.selected[data-zone="${noLevelZone}"]`)).toHaveCount(0); // the default level's (R1)
      // dragging one chair moves the selected zones with it by the same delta, each zone saved once
      const z0 = await zoneOf(myZone.id);
      const m0 = (await positions(['ms4']))[0];
      await mouseDrag(page, await at(page, [0.6, 0.7]), 40, 30);
      await expect.poll(async () => (await positions(['ms4']))[0][0], { timeout: 10000 }).toBeGreaterThan(m0[0] + 0.01);
      await expect.poll(async () => (await zoneOf(myZone.id)).revision, { timeout: 10000 }).toBe(z0.revision + 1);
      const m1 = (await positions(['ms4']))[0];
      (await zoneOf(myZone.id)).polygon.forEach((q, i) => {
        expect(q.x - z0.polygon[i].x).toBeCloseTo(m1[0] - m0[0], 3);
        expect(q.y - z0.polygon[i].y).toBeCloseTo(m1[1] - m0[1], 3);
      });
      await expect(panel).toHaveAttribute('data-multi-count', String(2 + zoneCount)); // still selected
      await page.locator(`${ED} [data-level-chip="all"]`).click();
      await expect(page.locator(`${ED} sw-plan-canvas [data-structure] [data-object].sel`)).toHaveCount(2); // back on every level: only ms4 and ms5
      await expect(page.locator(`${ED} sw-plan-canvas [data-structure] [data-wall].sel`)).toHaveCount(0);
      // Esc clears the multi-selection
      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
      await expect(page.locator(`${ED} sw-plan-canvas [data-structure] [data-object].sel`)).toHaveCount(0);
    } finally {
      await saveDraft({ levels: levels0, objects: SEED.objects }); // the phone test below expects the plain seed
    }
  });

  // Review of T085, B1 and S1: zones are saved by a PATCH each after a group drop. A second group drag while those saves
  // are in flight would start from stale polygons and revisions - it is refused and said, and nothing is lost; a zone
  // delete that fails in a bulk delete is counted in the message and becomes the selection again.
  test('select tool: a group drag while the last drop still saves its zones is refused and said; a failed zone delete is counted and stays selected', async ({ page }) => {
    await saveDraft({ ...SEED, objects: [...SEED.objects, CHAIR('mb1', [0.3, 0.55]), CHAIR('mb2', [0.4, 0.55])] });
    const za = await makeZone('חדר א', [{ x: 0.45, y: 0.5 }, { x: 0.52, y: 0.5 }, { x: 0.52, y: 0.6 }, { x: 0.45, y: 0.6 }]);
    const zb = await makeZone('חדר ב', [{ x: 0.55, y: 0.5 }, { x: 0.62, y: 0.5 }, { x: 0.62, y: 0.6 }, { x: 0.55, y: 0.6 }]);
    try {
      await openEditor(page);
      const panel = page.locator(`${ED} [data-multi-panel]`);
      await marquee(page, [0.25, 0.46], [0.65, 0.64]);
      await expect(panel).toHaveAttribute('data-multi-count', '4'); // two chairs and two zones
      const zoneDelta = async (id: string, from: { polygon: ZP[] }) => { const z = await zoneOf(id); return [z.polygon[0].x - from.polygon[0].x, z.polygon[0].y - from.polygon[0].y]; };

      // hold every zone PATCH until released: the first drop's zone saves stay in flight
      let release: () => void = () => {};
      const gate = new Promise<void>((r) => (release = r));
      await page.route('**/api/v1/zones/*', async (route) => {
        if (route.request().method() === 'PATCH') await gate;
        await route.continue();
      });
      const za0 = await zoneOf(za);
      const zb0 = await zoneOf(zb);
      const p0 = await positions(['mb1', 'mb2']);
      await mouseDrag(page, await at(page, [0.3, 0.55]), 50, 0);
      await expect.poll(async () => (await positions(['mb1']))[0][0], { timeout: 10000 }).toBeGreaterThan(p0[0][0] + 0.02);
      const p1 = await positions(['mb1', 'mb2']);
      const d1 = p1[0][0] - p0[0][0];
      // the second, corrective drag while the zones are still saving: refused, said, and nothing moves
      await mouseDrag(page, await at(page, p1[0]), 0, 40);
      await expect(page.locator(ED).getByText('האזורים של ההזזה הקודמת עדיין נשמרים')).toBeVisible();
      await page.waitForTimeout(2600); // longer than the draft autosave delay: a refused drag leaves nothing to save
      expect(await positions(['mb1', 'mb2'])).toEqual(p1);
      expect((await zoneOf(za)).revision).toBe(za0.revision); // still held
      release();
      await expect.poll(async () => (await zoneOf(za)).revision, { timeout: 10000 }).toBe(za0.revision + 1);
      await expect.poll(async () => (await zoneOf(zb)).revision, { timeout: 10000 }).toBe(zb0.revision + 1);
      for (const [id, z0] of [[za, za0], [zb, zb0]] as const) {
        const [dx, dy] = await zoneDelta(id, z0);
        expect(dx).toBeCloseTo(d1, 3); // the zones moved with the chairs, by the first drag only
        expect(dy).toBeCloseTo(0, 3);
      }
      await page.unroute('**/api/v1/zones/*');
      // once the saves have answered the group drags again, chairs and zones in step
      await mouseDrag(page, await at(page, p1[0]), 0, 40);
      await expect.poll(async () => (await zoneOf(za)).revision, { timeout: 10000 }).toBe(za0.revision + 2);
      await expect.poll(async () => (await positions(['mb1']))[0][1], { timeout: 10000 }).toBeGreaterThan(p1[0][1] + 0.02);
      const p2 = await positions(['mb1', 'mb2']);
      const [tx, ty] = await zoneDelta(za, za0);
      expect(tx).toBeCloseTo(p2[0][0] - p0[0][0], 3);
      expect(ty).toBeCloseTo(p2[0][1] - p0[0][1], 3);
      await expect(panel).toHaveAttribute('data-multi-count', '4');
      await saved(page);

      // R9 / R2: a group move with one zone PATCH failing - the count is said, the zone left behind alone becomes the
      // selection, and a drag of it by the same distance puts it where the rest went (a group drag would keep its offset)
      const q0 = await positions(['mb1', 'mb2']);
      const zaMid = await zoneOf(za);
      const zbMid = await zoneOf(zb);
      await page.route(`**/api/v1/zones/${zb}`, (route) => (route.request().method() === 'PATCH' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'test failure' }) }) : route.continue()));
      await mouseDrag(page, await at(page, q0[0]), 40, 0);
      await expect(page.locator(ED).getByText('1 מתוך 2 אזורים לא הוזזו')).toBeVisible();
      await expect(panel).toHaveCount(0);
      await expect(page.locator(`${ED} [data-zone-inspector]`)).toBeVisible(); // the one zone left behind: the single selection
      await expect(page.locator(`${ED} sw-plan-canvas g.zone.selected[data-zone="${zb}"]`)).toHaveCount(1);
      await expect(page.locator(`${ED} sw-plan-canvas g.zone.selected[data-zone="${za}"]`)).toHaveCount(0);
      await expect.poll(async () => (await zoneOf(za)).revision, { timeout: 10000 }).toBe(zaMid.revision + 1);
      await expect.poll(async () => (await positions(['mb1']))[0][0], { timeout: 10000 }).toBeGreaterThan(q0[0][0] + 0.02);
      const q1 = await positions(['mb1', 'mb2']);
      const moved = q1[0][0] - q0[0][0];
      expect((await zoneDelta(za, zaMid))[0]).toBeCloseTo(moved, 3);
      expect(await zoneOf(zb)).toMatchObject({ revision: zbMid.revision, polygon: zbMid.polygon }); // not moved
      await page.unroute(`**/api/v1/zones/${zb}`);
      const zbc: P = [zbMid.polygon.reduce((t, q) => t + q.x, 0) / zbMid.polygon.length, zbMid.polygon.reduce((t, q) => t + q.y, 0) / zbMid.polygon.length];
      await mouseDrag(page, await at(page, zbc), 40, 0);
      await expect.poll(async () => (await zoneOf(zb)).revision, { timeout: 10000 }).toBe(zbMid.revision + 1);
      expect((await zoneDelta(zb, zbMid))[0]).toBeCloseTo(moved, 3); // in line with the rest again
      expect((await zoneDelta(zb, zbMid))[1]).toBeCloseTo(0, 3);

      // take the four again: a marquee just around them
      const zNow = [await zoneOf(za), await zoneOf(zb)];
      const xs = [...q1.map((p) => p[0]), ...zNow.flatMap((z) => z.polygon.map((q) => q.x))];
      const ys = [...q1.map((p) => p[1]), ...zNow.flatMap((z) => z.polygon.map((q) => q.y))];
      await marquee(page, [Math.min(...xs) - 0.015, Math.min(...ys) - 0.025], [Math.max(...xs) + 0.015, Math.max(...ys) + 0.025]);
      await expect(panel).toHaveAttribute('data-multi-count', '4');

      // Delete with one zone DELETE failing: the chairs and the other zone go, the failure is counted, the zone left is
      // the selection again
      await page.route(`**/api/v1/zones/${zb}`, (route) => (route.request().method() === 'DELETE' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'test failure' }) }) : route.continue()));
      page.once('dialog', (d) => void d.accept());
      await page.keyboard.press('Delete');
      await expect(page.locator(ED).getByText('1 מתוך 2 אזורים לא נמחקו')).toBeVisible();
      await expect(page.locator(`${ED} sw-plan-canvas g.zone.selected[data-zone="${zb}"]`)).toHaveCount(1);
      await expect(page.locator(`${ED} [data-zone-inspector]`)).toBeVisible(); // one zone left: the ordinary single selection
      await expect.poll(async () => (await allZones()).some((z) => z.id === za), { timeout: 10000 }).toBe(false);
      zoneIds.splice(zoneIds.indexOf(za), 1); // deleted by the test itself
      expect((await allZones()).some((z) => z.id === zb)).toBe(true);
      await expect.poll(async () => (await draft()).doc.objects.some((o) => o.id === 'mb1' || o.id === 'mb2'), { timeout: 10000 }).toBe(false);
      await page.unroute(`**/api/v1/zones/${zb}`);
    } finally {
      await saveDraft({ objects: SEED.objects });
    }
  });

  // Review of T085, S3: the marquee took the left drag on the bare plan, so the select tool pans by Space + drag (a
  // trackpad has no middle button) and by the middle button.
  test('select tool: a plain drag on the bare plan draws the marquee and does not pan; Space + drag and the middle button pan', async ({ page }) => {
    await saveDraft(SEED);
    await openEditor(page);
    const ref: P = [0.75, 0.2];
    const s0 = await at(page, ref);
    await mouseDrag(page, await at(page, [0.8, 0.12]), 60, 40);
    expect(await at(page, ref)).toEqual(s0); // the marquee: the plan stays put
    await page.keyboard.down('Space');
    await expect(page.locator(`${ED} sw-plan-canvas .viewport[data-space-pan="on"]`)).toHaveCount(1);
    await mouseDrag(page, await at(page, [0.8, 0.12]), 60, 40);
    await page.keyboard.up('Space');
    const s1 = await at(page, ref);
    expect(s1.x - s0.x).toBeCloseTo(60, -1);
    expect(s1.y - s0.y).toBeCloseTo(40, -1);
    await expect(page.locator(`${ED} [data-multi-panel]`)).toHaveCount(0); // a pan selects nothing
    // Space + drag over an object pans too, the object stays
    const c = await at(page, [0.75, 0.55]);
    const before = (await positions(['mo1']))[0];
    await page.keyboard.down('Space');
    await mouseDrag(page, c, -40, 0);
    await page.keyboard.up('Space');
    expect((await at(page, ref)).x - s1.x).toBeCloseTo(-40, -1);
    expect((await positions(['mo1']))[0]).toEqual(before);
    // the middle button
    const s2 = await at(page, ref);
    const from = await at(page, [0.8, 0.12]);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(from.x - 30, from.y + 25, { steps: 6 });
    await page.mouse.up({ button: 'middle' });
    const s3 = await at(page, ref);
    expect(s3.x - s2.x).toBeCloseTo(-30, -1);
    expect(s3.y - s2.y).toBeCloseTo(25, -1);
    // R3: a focused button keeps its own Space - it is pressed, and nothing pans
    const layers = page.locator(`${ED} [data-tool="layers"]`);
    await layers.focus();
    await page.keyboard.down('Space');
    await expect(page.locator(`${ED} sw-plan-canvas .viewport[data-space-pan="on"]`)).toHaveCount(0);
    await page.keyboard.up('Space');
    await expect(layers).toHaveAttribute('aria-pressed', 'true');
    expect(await at(page, ref)).toEqual(s3);
  });

  // T085 pan/help (owner request 2026-09-27): a persistent hand-tool toggle in the rail, beside the tool buttons - unlike
  // Space (held down, and only in the select tool's marquee mode) it stays on across every tool until clicked again or
  // Esc, and it overrides every tool's drag, not only the select tool's. It reuses the exact same panning gate the
  // previous test exercises through Space (`data-space-pan`), so a drag over the bare plan or an object pans and nothing
  // else fires while it is on.
  test('hand tool: toggling it on pans every drag (bare plan and an object), draws no marquee; Esc and a second click return to normal editing', async ({ page }) => {
    await saveDraft(SEED);
    await openEditor(page);
    const pan = page.locator(`${ED} [data-tool-pan]`);
    await expect(pan).toHaveAttribute('aria-pressed', 'false');
    await pan.click();
    await expect(pan).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${ED} sw-plan-canvas .viewport[data-space-pan="on"]`)).toHaveCount(1);

    const ref: P = [0.75, 0.2];
    const s0 = await at(page, ref);
    // a drag on the bare plan pans; it does not draw the marquee (which would leave the plan in place and select nothing)
    await mouseDrag(page, await at(page, [0.8, 0.12]), 60, 40);
    const s1 = await at(page, ref);
    expect(s1.x - s0.x).toBeCloseTo(60, -1);
    expect(s1.y - s0.y).toBeCloseTo(40, -1);
    await expect(page.locator(`${ED} [data-multi-panel]`)).toHaveCount(0);

    // a drag starting on an object pans too: the object itself does not move
    const before = (await positions(['mo1']))[0];
    const c = await at(page, [0.75, 0.55]);
    await mouseDrag(page, c, -40, 0);
    expect((await positions(['mo1']))[0]).toEqual(before);
    const s2 = await at(page, ref);
    expect(s2.x - s1.x).toBeCloseTo(-40, -1);

    // Esc is the quick way out: back to the select tool exactly as it was, hand tool off
    await page.keyboard.press('Escape');
    await expect(pan).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator(`${ED} sw-plan-canvas .viewport[data-space-pan="on"]`)).toHaveCount(0);
    await expect(page.locator(`${ED} [data-tool="select"]`)).toHaveAttribute('aria-pressed', 'true');

    // normal select behaviour is back: a plain drag on the bare plan draws the marquee, the plan itself stays put
    const s3 = await at(page, ref);
    await mouseDrag(page, await at(page, [0.8, 0.12]), 60, 40);
    expect(await at(page, ref)).toEqual(s3);

    // the toggle button re-enters and leaves the hand tool just as well as Esc
    await pan.click();
    await expect(page.locator(`${ED} sw-plan-canvas .viewport[data-space-pan="on"]`)).toHaveCount(1);
    await pan.click();
    await expect(page.locator(`${ED} sw-plan-canvas .viewport[data-space-pan="on"]`)).toHaveCount(0);
  });

  // T085 pan/help: the "?" button on the map toolbar opens a panel listing the editor's real keyboard shortcuts,
  // grouped by topic - a representative sample is asserted (structure and a few known lines), not the exact wording,
  // so small phrasing tweaks later do not break this test.
  test('keyboard-shortcuts help: the "?" button lists real shortcuts grouped by topic; Esc closes it', async ({ page }) => {
    await openEditor(page);
    const help = page.locator(`${ED} [data-tool-help]`);
    const dialog = page.locator(`${ED} [data-shortcuts-dialog]`);
    await expect(dialog).toHaveCount(0);
    await help.click();
    await expect(dialog).toHaveCount(1);
    const rows = dialog.locator('[data-shortcuts-row]');
    expect(await rows.count()).toBeGreaterThanOrEqual(10);
    await expect(dialog.locator('[data-shortcuts-group]')).not.toHaveCount(0);
    await expect(dialog).toContainText('Ctrl+D');
    await expect(dialog).toContainText('Ctrl+Z');
    await expect(dialog).toContainText('Delete');
    await expect(dialog).toContainText('Esc');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  // T085 (owner request 2026-09-26): free-text tags - one item's in its inspector, several at once in the bulk panel - a
  // multi-selection moved to another level in one undoable step, its lamps (only its lamps) added to a circuit, and a tag
  // turned back into a selection that keeps to the level filter.
  test('select tool: tags on one item and on a multi-selection, the selection moved to a level in one undo step, only its lamps join a circuit, select by tag keeps to the level', async ({ page }) => {
    type Tagged = { id: string; level_id: string; tags?: string[] };
    type TagDoc = { walls: Tagged[]; objects: Tagged[]; circuits: { id: string; member_ids: string[] }[]; levels?: unknown[] };
    const doc0 = (await draft()).doc as unknown as TagDoc;
    const LEVEL = (id: string, name: string, isDefault: boolean) => ({ id, name, elevation_m: isDefault ? 0 : -1.2, ceiling_height_m: 3, is_default: isDefault, external_ids: {} });
    const LAMP = (id: string, pos: P) => ({ ...CHAIR(id, pos), item_id: 'light.ceiling', size: { w_m: 0.6, d_m: 0.6, h_m: 0.1 }, z_m: 2.5, params: { power_w: 36 } });
    const tagDoc = async () => (await draft()).doc as unknown as TagDoc;
    const tagsOf = async (id: string) => {
      const d = await tagDoc();
      return JSON.stringify([...d.walls, ...d.objects].find((x) => x.id === id)?.tags ?? []);
    };
    const levelOf = async (id: string) => [...(await tagDoc()).walls, ...(await tagDoc()).objects].find((x) => x.id === id)!.level_id;
    const pts: Record<string, P> = { tg1: [0.3, 0.55], tg2: [0.4, 0.55], tl1: [0.5, 0.55], tg9: [0.6, 0.7], mw2: [0.35, 0.85] };
    await saveDraft({ ...SEED, levels: [LEVEL('L0', 'קומת כניסה', true), LEVEL('L1', 'מרתף', false)],
      objects: [...SEED.objects, CHAIR('tg1', pts.tg1), CHAIR('tg2', pts.tg2), LAMP('tl1', pts.tl1), { ...CHAIR('tg9', pts.tg9), level_id: 'L1', tags: ['מטבח'] }],
      circuits: [{ id: 'tk1', name: 'צפון', switch_entity_id: 'switch.tags_north', member_ids: [], color_token: 'circuit-2', power_w: 0 }] });
    const zone = await makeZone('מטבח קטן', [{ x: 0.82, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.2 }, { x: 0.82, y: 0.2 }]); // no level: the default level L0
    const panel = page.locator(`${ED} [data-multi-panel]`);
    const obj = (id: string) => objAt(page, id);
    const click = async (p: P, shift = false) => {
      const s = await at(page, p);
      if (shift) await page.keyboard.down('Shift');
      await page.mouse.click(s.x, s.y);
      if (shift) await page.keyboard.up('Shift');
    };
    try {
      await openEditor(page);

      // one object: its inspector adds a tag by Enter, the chip shows it, the draft has it
      await click(pts.tg1);
      const insp = page.locator(`${ED} [data-selected-object="tg1"]`);
      await expect(insp).toBeVisible();
      await insp.locator('[data-tag-input]').fill('  מטבח ');
      await insp.locator('[data-tag-input]').press('Enter');
      await expect(insp.locator('sw-chip[data-tag="מטבח"]')).toHaveCount(1);
      await expect.poll(() => tagsOf('tg1'), { timeout: 10000 }).toBe(JSON.stringify(['מטבח']));
      // one zone: the same editor in the zone inspector, saved by the zone PATCH
      await click([0.86, 0.15]);
      const zinsp = page.locator(`${ED} [data-zone-inspector]`);
      await expect(zinsp).toBeVisible();
      await zinsp.locator('[data-tag-input]').fill('מטבח');
      await zinsp.locator('[data-tag-add]').click();
      await expect.poll(async () => JSON.stringify(((await (await api.get(`api/v1/floors/${ids.floor}/zones`)).json()) as { zones: { id: string; tags: string[] }[] }).zones.find((z) => z.id === zone)!.tags), { timeout: 10000 })
        .toBe(JSON.stringify(['מטבח']));
      await page.keyboard.press('Escape');

      // three objects and a wall: the bulk panel adds a tag to all four, then a click on its chip removes it from all four
      await click(pts.tg1);
      for (const id of ['tg2', 'tl1', 'mw2']) await click(pts[id], true);
      await expect(panel).toHaveAttribute('data-multi-count', '4');
      await panel.locator('[data-tag-input]').fill('יציאת חירום');
      await panel.locator('[data-tag-add]').click();
      for (const [id, tags] of [['tg1', ['מטבח', 'יציאת חירום']], ['tg2', ['יציאת חירום']], ['tl1', ['יציאת חירום']], ['mw2', ['יציאת חירום']]] as const) {
        await expect.poll(() => tagsOf(id), { timeout: 10000 }).toBe(JSON.stringify(tags));
      }
      await expect(panel.locator('[data-multi-note]')).toContainText('נוספה ל־4 מתוך 4');
      await expect(panel.locator('sw-chip[data-tag="יציאת חירום"]')).toHaveAttribute('data-tag-count', '4');
      await expect(panel.locator('sw-chip[data-tag="מטבח"]')).toHaveAttribute('data-tag-count', '1');
      await panel.locator('sw-chip[data-tag="יציאת חירום"]').click();
      for (const [id, tags] of [['tg1', ['מטבח']], ['tg2', []], ['tl1', []], ['mw2', []]] as const) {
        await expect.poll(() => tagsOf(id), { timeout: 10000 }).toBe(JSON.stringify(tags));
      }
      await expect(panel.locator('[data-multi-note]')).toContainText('הוסרה מ־4');
      await expect(panel.locator('sw-chip[data-tag="יציאת חירום"]')).toHaveCount(0);
      await saved(page);

      // the four to the basement level in one action; the rail's undo puts all four back in one step (tags untouched)
      await panel.locator('[data-multi-level]').selectOption('L1');
      for (const id of ['tg1', 'tg2', 'tl1', 'mw2']) await expect.poll(() => levelOf(id), { timeout: 10000 }).toBe('L1');
      await expect(panel.locator('[data-multi-note]')).toContainText('4 פריטים הועברו למפלס "מרתף"');
      await saved(page);
      await page.locator(`${ED} [data-rail-undo]`).click();
      await expect.poll(async () => JSON.stringify(await Promise.all(['tg1', 'tg2', 'tl1', 'mw2'].map(levelOf))), { timeout: 10000 }).toBe(JSON.stringify(['L0', 'L0', 'L0', 'L0']));
      expect(await tagsOf('tg1')).toBe(JSON.stringify(['מטבח'])); // one step: only the level change was undone (the draft poll above is the save)

      // two chairs: no circuit action at all; a lamp and a chair: only the lamp joins, and the note says 1 of 2
      await page.keyboard.press('Escape');
      await click(pts.tg1);
      await click(pts.tg2, true);
      await expect(panel).toHaveAttribute('data-multi-count', '2');
      await expect(panel.locator('[data-multi-circuits]')).toHaveCount(0);
      await click(pts.tg2, true); // out
      await click(pts.tl1, true); // in
      await expect(panel).toHaveAttribute('data-multi-count', '2');
      await panel.locator('sw-chip[data-multi-circuit="tk1"]').click();
      await expect.poll(async () => JSON.stringify((await tagDoc()).circuits.find((k) => k.id === 'tk1')!.member_ids), { timeout: 10000 }).toBe(JSON.stringify(['tl1']));
      await expect(panel.locator('[data-multi-note]')).toContainText('1 מתוך 2 פריטים שנבחרו נוספו למעגל "צפון"');
      await saved(page);

      // review of the tags round, S3: under the ground-floor filter two chairs and a zone go to the basement while the
      // zone's save fails - the zone stays on its level, so it leaves the selection before the filter follows the chairs
      // (the selection never spans two levels); the chairs come back with one undo
      await page.locator(`${ED} [data-level-chip="L0"]`).click();
      await click(pts.tg1);
      await click(pts.tg2, true);
      await click([0.86, 0.15], true);
      await expect(panel).toHaveAttribute('data-multi-count', '3');
      await page.route(`**/api/v1/zones/${zone}`, (route) => (route.request().method() === 'PATCH' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'test failure' }) }) : route.continue()));
      await panel.locator('[data-multi-level]').selectOption('L1');
      await expect(panel).toHaveAttribute('data-multi-count', '2');
      await expect(page.locator(`${ED} sw-plan-canvas g.zone.selected[data-zone="${zone}"]`)).toHaveCount(0);
      await expect(page.locator(`${ED} [data-level-chip="L1"]`)).toHaveAttribute('selected', ''); // the filter followed the chairs
      await expect(panel.locator('[data-multi-note]')).toContainText('1 מתוך 1 אזורים לא עודכנו');
      await expect(panel.locator('[data-multi-note]')).toContainText('האזור שלא הועבר הוצא מהבחירה');
      for (const id of ['tg1', 'tg2']) await expect.poll(() => levelOf(id), { timeout: 10000 }).toBe('L1');
      expect(((await (await api.get(`api/v1/floors/${ids.floor}/zones`)).json()) as { zones: { id: string; level_id?: string | null }[] }).zones.find((z) => z.id === zone)!.level_id ?? null).toBeNull();
      await page.unroute(`**/api/v1/zones/${zone}`);
      await saved(page);
      await page.locator(`${ED} [data-rail-undo]`).click();
      for (const id of ['tg1', 'tg2']) await expect.poll(() => levelOf(id), { timeout: 10000 }).toBe('L0');
      await page.locator(`${ED} [data-level-chip="all"]`).click();

      // select by tag, beside the level chips: every level - the two objects, the basement chair and the zone; the ground
      // floor - the zone without a level too (the default level's), not the basement chair; the basement - that chair alone
      await page.keyboard.press('Escape');
      const pick = page.locator(`${ED} [data-tag-select]`);
      await pick.selectOption('מטבח');
      await expect(panel).toHaveAttribute('data-multi-count', '3');
      for (const id of ['tg1', 'tg9']) await expect(obj(id)).toHaveClass(/\bsel\b/);
      await expect(page.locator(`${ED} sw-plan-canvas g.zone.selected[data-zone="${zone}"]`)).toHaveCount(1);
      await expect(obj('tl1')).not.toHaveClass(/\bsel\b/);
      await page.locator(`${ED} [data-level-chip="L0"]`).click();
      await pick.selectOption('מטבח');
      await expect(panel).toHaveAttribute('data-multi-count', '2');
      await expect(obj('tg1')).toHaveClass(/\bsel\b/);
      await expect(page.locator(`${ED} sw-plan-canvas g.zone.selected[data-zone="${zone}"]`)).toHaveCount(1);
      await page.locator(`${ED} [data-level-chip="L1"]`).click();
      await pick.selectOption('מטבח');
      await expect(page.locator(`${ED} [data-selected-object="tg9"]`)).toBeVisible(); // one item: the ordinary single selection
      await expect(panel).toHaveCount(0);
      // from another tool the picker switches to the select tool, where a multi-selection lives
      await page.locator(`${ED} [data-level-chip="all"]`).click();
      await page.locator(`${ED} [data-tool="layers"]`).click();
      await pick.selectOption('מטבח');
      await expect(page.locator(`${ED} [data-tool="select"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(panel).toHaveAttribute('data-multi-count', '3');
    } finally {
      await saveDraft({ levels: doc0.levels ?? [], walls: SEED.walls, objects: SEED.objects, circuits: doc0.circuits ?? [] }); // the tests below expect the plain seed
      if ((await api.delete(`api/v1/zones/${zone}`)).status() === 204) zoneIds.splice(zoneIds.indexOf(zone), 1);
    }
  });

  // T085 grid, snap and alignment (owner request 2026-09-26: "five lamps on one line, easily"). The plan is 1000 x 600 px
  // at 25 px per metre, so the default 0.5 m grid is 12.5 plan px and a 0.4 m chair is 10 px.
  const GRID_PX = 12.5;
  const onGrid = (p: P) => [p[0] * 1000, p[1] * 600].every((v) => Math.abs(v / GRID_PX - Math.round(v / GRID_PX)) < 1e-3);

  test('grid and guides: the layers tool turns the grid on (remembered per floor), a dragged chair lands on it, a guide shows and wins its axis, Ctrl drags free', async ({ page }) => {
    await saveDraft({ ...SEED, objects: [...SEED.objects, CHAIR('gd1', [0.3, 0.55]), CHAIR('gd2', [0.5, 0.45])] });
    try {
      await openEditor(page);
      const canvas = page.locator(`${ED} sw-plan-canvas`);
      await expect(canvas.locator('[data-grid]')).toHaveCount(0); // a floor never switched: no grid
      await page.locator(`${ED} [data-tool="layers"]`).click();
      await page.locator(`${ED} [data-grid-toggle]`).check();
      await expect(page.locator(`${ED} [data-grid-step]`)).toHaveValue('0.5'); // the default spacing, on the calibrated scale
      await expect(page.locator(`${ED} [data-grid-step] option:checked`)).toHaveText('0.50 מ׳');
      await expect(canvas.locator('[data-grid]')).toHaveAttribute('data-grid-px', String(GRID_PX));
      await expect(page.locator(`${ED} [data-grid-chip]`)).toHaveAttribute('selected', '');
      await page.locator(`${ED} [data-tool="select"]`).click();

      // a plain drag to an arbitrary point: the chair's centre lands on a grid intersection
      await mouseDrag(page, await at(page, [0.3, 0.55]), 71, 43);
      await expect.poll(async () => (await positions(['gd1']))[0][0], { timeout: 10000 }).toBeGreaterThan(0.33);
      const [p1] = await positions(['gd1']);
      expect(onGrid(p1), `on the grid: ${p1}`).toBe(true);

      // dragged to 2 px below gd2's line (y 272 vs 270), off both grid lines: the guide shows while dragging, and on its
      // axis it wins over the grid (the drop is on gd2's line, not the grid's 275); the other axis takes the grid. Esc first:
      // the chair the last drop selected is 9 screen px here, all covered by its own stretch handles
      await page.keyboard.press('Escape');
      const from = await at(page, p1);
      const to = await at(page, [0.4, 272 / 600]);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
      await page.mouse.move(to.x, to.y, { steps: 5 });
      await expect(canvas.locator('[data-guide="y"][data-at="270"]')).toHaveCount(1);
      await page.mouse.up();
      await expect(canvas.locator('[data-guide]')).toHaveCount(0); // the guides go with the drop
      await expect.poll(async () => (await positions(['gd1']))[0][1], { timeout: 10000 }).toBe(0.45);
      const [p2] = await positions(['gd1']);
      expect(Math.abs((p2[0] * 1000) / GRID_PX - Math.round((p2[0] * 1000) / GRID_PX))).toBeLessThan(1e-3);

      // Ctrl held while dragging: neither the grid nor a guide - the chair goes exactly where it is dragged
      await page.keyboard.press('Escape');
      const p2s = await at(page, p2);
      await page.keyboard.down('Control');
      await mouseDrag(page, p2s, 37, 29);
      await page.keyboard.up('Control');
      await expect.poll(async () => (await positions(['gd1']))[0][0], { timeout: 10000 }).toBeGreaterThan(p2[0] + 0.02);
      const [p3] = await positions(['gd1']);
      expect(onGrid(p3), `off the grid: ${p3}`).toBe(false);

      // a group drag: the grabbed chair (gd2) lands on the grid and gd1 moves by the same corrected delta
      await page.keyboard.press('Escape');
      const [q0, g0] = await positions(['gd1', 'gd2']);
      for (const [p, shift] of [[q0, false], [g0, true]] as const) {
        const s = await at(page, p);
        if (shift) await page.keyboard.down('Shift');
        await page.mouse.click(s.x, s.y);
        if (shift) await page.keyboard.up('Shift');
      }
      await expect(page.locator(`${ED} [data-multi-panel]`)).toHaveAttribute('data-multi-count', '2');
      await mouseDrag(page, await at(page, g0), 41, 23);
      await expect.poll(async () => (await positions(['gd2']))[0][0], { timeout: 10000 }).toBeGreaterThan(g0[0] + 0.02);
      const [q1, g1] = await positions(['gd1', 'gd2']);
      expect(onGrid(g1), `group member on the grid: ${g1}`).toBe(true);
      expect(q1[0] - q0[0]).toBeCloseTo(g1[0] - g0[0], 4);
      expect(q1[1] - q0[1]).toBeCloseTo(g1[1] - g0[1], 4);

      // remembered for this floor in this browser: after a reload the grid is still on
      await page.reload();
      await expect(canvas.locator('[data-grid]')).toHaveAttribute('data-grid-px', String(GRID_PX), { timeout: 20000 });
      await page.locator(`${ED} [data-grid-chip]`).click(); // and the chip turns it off
      await expect(canvas.locator('[data-grid]')).toHaveCount(0);
    } finally {
      await saveDraft({ walls: SEED.walls, objects: SEED.objects }); // the tests below expect the plain seed
    }
  });

  test('align and distribute: four ragged chairs and a wall selected - centres on one horizontal line, spaced evenly, left edges lined up, each one undo step; the wall stays', async ({ page }) => {
    const pts: P[] = [[0.3, 0.5], [0.38, 0.53], [0.5, 0.48], [0.62, 0.51]];
    const names = ['al1', 'al2', 'al3', 'al4'];
    await saveDraft({ ...SEED, objects: [...SEED.objects, ...names.map((id, i) => CHAIR(id, pts[i]))] });
    try {
      await openEditor(page);
      const panel = page.locator(`${ED} [data-multi-panel]`);
      const wall0 = wallOf(await draft(), 'mw2').polyline;
      const click = async (p: P, shift = false) => {
        const s = await at(page, p);
        if (shift) await page.keyboard.down('Shift');
        await page.mouse.click(s.x, s.y);
        if (shift) await page.keyboard.up('Shift');
      };
      // one object and a wall: nothing to align
      await click([0.75, 0.55]);
      await click([0.35, 0.85], true);
      await expect(panel).toHaveAttribute('data-multi-count', '2');
      await expect(panel.locator('[data-multi-align]')).toHaveCount(0);
      await page.keyboard.press('Escape');

      // the four chairs by a marquee, and the wall below them by Shift+click
      await marquee(page, [0.25, 0.42], [0.66, 0.6]);
      await expect(panel).toHaveAttribute('data-multi-count', '4');
      await click([0.35, 0.85], true);
      await expect(panel).toHaveAttribute('data-multi-count', '5');
      await expect(panel.locator('[data-multi-align] [data-align]')).toHaveCount(6);
      await expect(panel.locator('[data-multi-align] [data-distribute]')).toHaveCount(2);

      // centres on one horizontal line: the box of the four is y 283..323 px -> every centre at 303 px (0.505); x stays
      await panel.locator('[data-align="center-y"]').click();
      await expect.poll(async () => JSON.stringify((await positions(names)).map((p) => p[1])), { timeout: 10000 }).toBe(JSON.stringify([0.505, 0.505, 0.505, 0.505]));
      const aligned = await positions(names);
      expect(aligned.map((p) => p[0])).toEqual(pts.map((p) => p[0]));
      await expect(panel.locator('[data-multi-note]')).toContainText('4 עצמים זזו');
      await expect(panel).toHaveAttribute('data-multi-count', '5'); // the selection stays for the next action

      // distributed across: the outer two stay (centres 300 and 620 px), 10 px wide chairs with three equal gaps of 96.67 px
      await panel.locator('[data-distribute="x"]').click();
      await expect.poll(async () => (await positions(['al2']))[0][0], { timeout: 10000 }).toBeCloseTo(0.40667, 5);
      const spread = await positions(names);
      [0.3, 0.40667, 0.51333, 0.62].forEach((x, i) => expect(spread[i][0]).toBeCloseTo(x, 5));
      spread.forEach((p) => expect(p[1]).toBe(0.505));

      // left edges on the box's left edge (295 px): every centre at 300 px
      await panel.locator('[data-align="left"]').click();
      await expect.poll(async () => JSON.stringify((await positions(names)).map((p) => p[0])), { timeout: 10000 }).toBe(JSON.stringify([0.3, 0.3, 0.3, 0.3]));
      expect(wallOf(await draft(), 'mw2').polyline).toEqual(wall0); // the wall of the selection never moved
      await saved(page);

      // one undo step per action: the first undo puts all four back where the distribute left them, the second before it
      await page.locator(`${ED} [data-rail-undo]`).click();
      await expect.poll(async () => JSON.stringify(await positions(names)), { timeout: 10000 }).toBe(JSON.stringify(spread));
      await page.locator(`${ED} [data-rail-undo]`).click();
      await expect.poll(async () => JSON.stringify(await positions(names)), { timeout: 10000 }).toBe(JSON.stringify(aligned));
    } finally {
      await saveDraft({ walls: SEED.walls, objects: SEED.objects }); // the tests below expect the plain seed
    }
  });

  // Review of T085, S4: `any-pointer: coarse` is true on a touchscreen laptop even when it is used with a mouse; a
  // member of a multi-selection must still drag the group there, not start a marquee.
  test.describe('on a touchscreen laptop used with a mouse', () => {
    test.use({ hasTouch: true });

    test('a chair of a multi-selection drags the whole group with the mouse', async ({ page }) => {
      await saveDraft({ ...SEED, objects: [...SEED.objects, CHAIR('mh1', [0.3, 0.55]), CHAIR('mh2', [0.4, 0.55])] });
      try {
        await openEditor(page);
        expect(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches), 'the page sees a touch screen').toBe(true);
        await marquee(page, [0.25, 0.47], [0.45, 0.63]);
        await expect(page.locator(`${ED} [data-multi-panel]`)).toHaveAttribute('data-multi-count', '2');
        const p0 = await positions(['mh1', 'mh2']);
        await mouseDrag(page, await at(page, p0[0]), 50, 30);
        await expect.poll(async () => (await positions(['mh2']))[0][0], { timeout: 10000 }).toBeGreaterThan(p0[1][0] + 0.02);
        const p1 = await positions(['mh1', 'mh2']);
        expect(p1[0][0] - p0[0][0]).toBeCloseTo(p1[1][0] - p0[1][0], 4);
        expect(p1[0][1] - p0[0][1]).toBeCloseTo(p1[1][1] - p0[1][1], 4);
        await expect(page.locator(`${ED} [data-multi-panel]`)).toHaveAttribute('data-multi-count', '2');
        await saved(page);
      } finally {
        await saveDraft({ objects: SEED.objects });
      }
    });
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
      await page.touchscreen.tap(grab.x, grab.y + 8); // 8 px off the centre line: inside the 20 px touch band only
      await expect(page.locator(`${ED} [data-selected-wall="mw1"]`)).toBeAttached();
      await touchDrag(page, { x: grab.x, y: grab.y + 7 }, 30, 40);
      await expect.poll(async () => wallOf(await draft(), 'mw1').polyline[0][1], { timeout: 10000 }).toBeGreaterThan(w0[0][1] + 0.02);
      const w1 = wallOf(await draft(), 'mw1').polyline;
      expect(w1[1][1] - w0[1][1]).toBeCloseTo(w1[0][1] - w0[0][1], 4);
      await saved(page);
      // the chair: a few pixels on a phone. Not selected, a finger drag over it pans the plan and never moves it
      const fp = (await page.locator(`${ED} sw-plan-canvas [data-object="mo1"] .fp`).boundingBox())!;
      expect(fp.width).toBeLessThan(10);
      const c0 = await at(page, [0.75, 0.55]);
      await touchDrag(page, { x: c0.x + 3, y: c0.y + 3 }, -30, 20);
      await expect.poll(async () => (await at(page, [0.75, 0.55])).x, { timeout: 5000 }).toBeLessThan(c0.x - 20); // the plan moved
      expect((await draft()).doc.objects.find((o) => o.id === 'mo1')!.position).toEqual([0.75, 0.55]);
      await expect(page.locator(`${ED} [data-selected-object]`)).toHaveCount(0);
      // a tap beside it selects it, then a finger drag moves it
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
