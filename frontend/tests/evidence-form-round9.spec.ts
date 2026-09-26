import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Round 9 of the owner test form (2026-09-26): the items of the form that had no assertion of their own in the earlier
// specs, checked in real Chrome against the running developer backend - the structure tools (3-7), the estimates
// setting (16), the live map's remembered layers, the label and the exports (6, 9, 13), what a viewer sees (14, 29, 50)
// and the library panel (21-24, 31, 42). The spec builds its own site / building / floor with a generated plan picture
// and removes them at the end; the dev viewer's binding is revoked and plan.estimates is put back. Nothing here reaches
// Home Assistant or the NVR. Runs only with SW_LIVE=1 (backend on 8099 behind the preview proxy on 4173).
const BASE = process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
const ED = 'explore-plan-editor';
const MAP = 'explore-floor-map';
const VIEWER = 'r9viewer';
const ids = { site: '', building: '', floor: '', version: '', binding: '', custom: '' };
let api: APIRequestContext;
let estimatesBefore: string | null | undefined;

type Pt = [number, number];
type Wall = { id: string; level_id: string; polyline: Pt[] };
type Opening = { id: string; wall_id: string; kind: string; swing: string; hinge: string };
type Obj = { id: string; item_id: string; level_id: string; position: Pt; size: { w_m: number; d_m: number; h_m: number }; label: string | null; group_id: string | null };
type Doc = Record<string, unknown> & { walls: Wall[]; openings: Opening[]; labels: { id: string; text: string }[]; objects: Obj[]; groups: { id: string; member_ids: string[] }[]; levels: { id: string }[] };
const draft = async () => (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json()) as { geometry: { revision: number }; doc: Doc };
const saveDraft = async (patch: Partial<Doc>) => {
  const g = await draft();
  expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc: { ...g.doc, ...patch }, base_revision: g.geometry.revision } })).status()).toBe(200);
};
const publish = async () => expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
const WALL = (id: string, polyline: Pt[], level = 'L0') => ({ id, level_id: level, polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} });
const OBJ = (id: string, item: string, pos: Pt) => ({ id, item_id: item, level_id: 'L0', position: pos, rotation_deg: 0, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {} });

/** The page coordinates of a normalized plan point on the canvas of `screen`. */
async function planPoint(page: Page, screen: string, x: number, y: number) {
  const canvas = page.locator(`${screen} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, p) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(p[0], p[1]), [x, y] as Pt);
  return { x: box.x + s.x, y: box.y + s.y, rel: s };
}
async function clickPlan(page: Page, screen: string, x: number, y: number, modifiers: ('Shift' | 'Alt')[] = []) {
  const p = await planPoint(page, screen, x, y);
  for (const m of modifiers) await page.keyboard.down(m); // mouse.click takes no modifiers in this Playwright
  await page.mouse.click(p.x, p.y);
  for (const m of modifiers) await page.keyboard.up(m);
}
const saved = (page: Page) => expect(page.locator(`${ED} [data-studio-save="saved"]`).first()).toBeAttached({ timeout: 10000 });
async function openEditor(page: Page) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
  await expect(page.locator(`${ED} sw-plan-canvas`)).toBeAttached({ timeout: 20000 });
  await page.waitForTimeout(800); // the studio loads its draft after the canvas
}

test.describe.serial('owner form round 9: the items without an assertion of their own (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: BASE });
    estimatesBefore = (await (await api.get('api/v1/settings')).json()).settings['plan.estimates'];
    expect((await api.patch('api/v1/settings', { data: { 'plan.estimates': 'true' } })).status(), 'plan.estimates pinned').toBe(200);
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת טופס 9 ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה בדיקה' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומת טופס', level: 0 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent('<div style="box-sizing:border-box;width:1000px;height:600px;background:#fff;border:10px solid #333"></div>');
    const png = await page.screenshot();
    await page.close();
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
    ids.version = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
  });

  test.afterAll(async () => {
    if (!api) return;
    const failures: string[] = [];
    const step = async (what: string, run: () => Promise<number>, ok: number) => {
      try {
        const status = await run();
        if (status !== ok) failures.push(`${what}: ${status}`);
      } catch (err) {
        failures.push(`${what}: ${String(err)}`);
      }
    };
    try {
      if (estimatesBefore && estimatesBefore !== 'true') await step('plan.estimates restored', async () => (await api.patch('api/v1/settings', { data: { 'plan.estimates': estimatesBefore } })).status(), 200);
      if (ids.binding) await step('viewer binding revoked', async () => (await api.delete(`api/v1/access/bindings/${ids.binding}`)).status(), 200);
      if (ids.floor) await step('test floor removed', async () => (await api.delete(`api/v1/floors/${ids.floor}?force=true`)).status(), 204);
      if (ids.building) await step('test building removed', async () => (await api.delete(`api/v1/buildings/${ids.building}`)).status(), 204);
      if (ids.site) await step('test site removed', async () => (await api.delete(`api/v1/sites/${ids.site}`)).status(), 204);
      if (ids.custom) await step('custom item removed', async () => (await api.delete(`api/v1/catalog/objects/${ids.custom}`)).status(), 204);
    } finally {
      await api.dispose();
    }
    expect(failures, 'test data removed').toEqual([]);
  });

  test('structure tools: Shift frees the wall angle; window, passage and door cut the wall and the door takes its swing and hinge; a label; a corner is deleted and undone; the measure shows area and perimeter (items 3-7)', async ({ page }) => {
    await openEditor(page);
    await page.locator(`${ED} [data-tool="structure"]`).click();
    await page.locator(`${ED} [data-studio-mode="wall"]`).click();
    // item 4: a slightly tilted second point snaps to the horizontal; with Shift held the third keeps its tilt
    await clickPlan(page, ED, 0.1, 0.3);
    await clickPlan(page, ED, 0.4, 0.33);
    await clickPlan(page, ED, 0.7, 0.36, ['Shift']);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await draft()).doc.walls.length, { timeout: 10000 }).toBe(1);
    await expect(page.locator(`${ED} [data-studio-panel][data-studio-save="saved"]`)).toContainText('הטיוטה נשמרה', { timeout: 10000 });
    const wall = (await draft()).doc.walls[0];
    const [a, b, c] = wall.polyline;
    expect(wall.polyline).toHaveLength(3);
    expect(b[1], 'snapped to the horizontal (the nearest 45 degrees)').toBe(a[1]);
    expect(b[0]).toBeGreaterThan(0.39);
    expect(c[1] - b[1], 'Shift: no snap, the click itself').toBeGreaterThan(0.05);
    const parts = async () => page.locator(`${ED} sw-plan-canvas [data-wall]`).count();
    const parts0 = await parts();

    // item 5: a window and a passage on the first segment, a door on the second; each cuts the wall
    await page.locator(`${ED} [data-studio-mode="window"]`).click();
    await clickPlan(page, ED, 0.2, a[1]);
    await expect(page.locator(`${ED} sw-plan-canvas [data-opening][data-kind="window"]`)).toHaveCount(1);
    await page.locator(`${ED} [data-studio-mode="passage"]`).click();
    await clickPlan(page, ED, 0.33, a[1]);
    await expect(page.locator(`${ED} sw-plan-canvas [data-opening][data-kind="passage"]`)).toHaveCount(1);
    await page.locator(`${ED} [data-studio-mode="door"]`).click();
    await clickPlan(page, ED, (b[0] + c[0]) / 2, (b[1] + c[1]) / 2);
    await expect(page.locator(`${ED} sw-plan-canvas [data-opening][data-kind="door"]`)).toHaveCount(1);
    expect(await parts(), 'three openings cut three more pieces').toBe(parts0 + 3);
    await expect(page.locator(`${ED} [data-selected-opening]`)).toBeVisible();
    await page.locator(`${ED} [data-selected-opening] select[aria-label="כיוון פתיחה"]`).selectOption('left');
    await page.locator(`${ED} [data-selected-opening] select[aria-label="ציר"]`).selectOption('end');
    await expect.poll(async () => (await draft()).doc.openings.find((o) => o.kind === 'door')?.swing, { timeout: 10000 }).toBe('left');
    expect((await draft()).doc.openings.find((o) => o.kind === 'door')!.hinge).toBe('end');
    expect((await draft()).doc.openings.map((o) => o.kind).sort()).toEqual(['door', 'passage', 'window']);

    // item 6: a label placed by a click, its text typed in the panel, shown on the plan
    await page.locator(`${ED} [data-studio-mode="label"]`).click();
    await clickPlan(page, ED, 0.5, 0.7);
    await expect(page.locator(`${ED} [data-selected-label]`)).toBeVisible();
    await page.locator(`${ED} [data-label-text]`).fill('מחסן');
    await page.locator(`${ED} [data-label-text]`).dispatchEvent('change');
    await expect(page.locator(`${ED} sw-plan-canvas text[data-label]`)).toHaveText('מחסן');
    await expect.poll(async () => (await draft()).doc.labels.map((l) => l.text), { timeout: 10000 }).toEqual(['מחסן']);

    // item 7: select the wall, pick its middle corner, Delete removes the corner; Ctrl+Z brings it back
    await page.locator(`${ED} [data-studio-mode="select"]`).click();
    await clickPlan(page, ED, 0.27, a[1]);
    await expect(page.locator(`${ED} [data-selected-wall="${wall.id}"]`)).toBeVisible();
    await expect(page.locator(`${ED} sw-plan-canvas [data-wall-vertex]`)).toHaveCount(3);
    const v1 = (await page.locator(`${ED} sw-plan-canvas [data-wall-vertex="1"]`).boundingBox())!;
    await page.mouse.click(v1.x + v1.width / 2, v1.y + v1.height / 2);
    await expect(page.locator(`${ED} [data-selected-vertex="1"]`)).toContainText('Delete מוחק את הפינה');
    await page.keyboard.press('Delete');
    await expect.poll(async () => (await draft()).doc.walls[0]?.polyline.length, { timeout: 10000 }).toBe(2);
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await draft()).doc.walls[0]?.polyline.length, { timeout: 10000 }).toBe(3);
    expect((await draft()).doc.openings).toHaveLength(3);
    await saved(page);

    // item 3: three points and more show the area and the perimeter (estimated: the plan is not calibrated)
    await page.locator(`${ED} [data-tool="measure"]`).click();
    await clickPlan(page, ED, 0.1, 0.8);
    await clickPlan(page, ED, 0.3, 0.8);
    await expect(page.locator(`${ED} [data-measure-area]`)).toHaveCount(0);
    await clickPlan(page, ED, 0.3, 0.95);
    await expect(page.locator(`${ED} [data-measure-area]`)).toContainText('≈');
    await expect(page.locator(`${ED} [data-measure-panel]`)).toContainText('היקף');
  });

  test('the setting "מידות לפני כיול" from the settings screen hides the estimated metres ("לא מכויל") and brings them back (item 16)', async ({ page }) => {
    const setEstimates = async (value: 'true' | 'false') => {
      await page.goto('about:blank');
      await page.goto('/?design=a#/system/diagnostics');
      const screen = page.locator('system-diagnostics');
      await screen.getByText('וידאו ומדיה').first().click();
      const sel = screen.locator('select[data-set-plan-estimates]');
      await expect(sel).toBeEnabled({ timeout: 20000 });
      await sel.selectOption(value);
      const patched = page.waitForResponse((r) => r.url().includes('/api/v1/settings') && r.request().method() === 'PATCH');
      await screen.locator('.foot sw-button', { hasText: /^\s*שמור\s*$/ }).click(); // the tab's rows are saved together
      expect((await patched).status()).toBe(200);
      expect((await (await api.get('api/v1/settings')).json()).settings['plan.estimates']).toBe(value);
    };
    const measure = async () => {
      await openEditor(page);
      await page.locator(`${ED} [data-tool="measure"]`).click();
      await clickPlan(page, ED, 0.1, 0.8);
      await clickPlan(page, ED, 0.6, 0.8);
      return page.locator(`${ED} [data-measure-distance]`);
    };
    await setEstimates('false');
    const hidden = await measure();
    await expect(hidden).toHaveText('לא מכויל');
    await setEstimates('true');
    const shown = await measure();
    await expect(shown).toContainText('≈');
    await expect(shown).not.toContainText('לא מכויל');
  });

  test('published: the label shows on the live map, the structure layer is remembered for the floor across a reload, the panel exports SVG, PNG and JSON (items 6, 9, 13)', async ({ page }) => {
    await publish();
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const walls = page.locator(`${MAP} sw-plan-canvas [data-structure] [data-wall]`);
    await expect(walls.first()).toBeAttached({ timeout: 20000 });
    const n = await walls.count();
    await expect(page.locator(`${MAP} sw-plan-canvas text[data-label]`)).toHaveText('מחסן');
    await page.locator(`${MAP} .layers button[aria-label="מבנה"]`).click();
    await expect(walls).toHaveCount(0);
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    await expect(page.locator(`${MAP} sw-plan-canvas`)).toBeAttached({ timeout: 20000 });
    await page.waitForTimeout(1500);
    await expect(walls, 'the choice is kept for this floor after a reload').toHaveCount(0);
    expect(await page.evaluate((f) => localStorage.getItem(`sw.floor.layers.${f}`), ids.floor)).toContain('-structure');
    await page.locator(`${MAP} .layers button[aria-label="מבנה"]`).click();
    await expect(walls).toHaveCount(n);

    // item 13: the panel's three exports. SVG and PNG are links to the export routes; JSON is a download of the draft
    await page.addInitScript(() => {
      const w = window as unknown as { __dl: { name: string; text: string } | null };
      w.__dl = null;
      const orig = URL.createObjectURL.bind(URL);
      const blobs = new Map<string, Blob>();
      URL.createObjectURL = (b: Blob | MediaSource) => { const u = orig(b); if (b instanceof Blob) blobs.set(u, b); return u; };
      HTMLAnchorElement.prototype.click = function () { const b = blobs.get(this.href); if (b) void b.text().then((text) => { w.__dl = { name: this.download, text }; }); };
    });
    await openEditor(page);
    await page.locator(`${ED} [data-tool="structure"]`).click();
    const rel = (href: string) => { const u = new URL(href, page.url()); return `${u.pathname}${u.search}`.replace(/^\//, ''); }; // the draft exports carry ?draft=true
    const svgA = page.locator(`${ED} [data-export-svg]`);
    const pngA = page.locator(`${ED} [data-export-png]`);
    await expect(svgA).toHaveAttribute('download', '');
    const svgRes = await api.get(rel((await svgA.getAttribute('href'))!));
    expect(svgRes.status()).toBe(200);
    expect(svgRes.headers()['content-type']).toContain('image/svg+xml');
    const svgText = await svgRes.text();
    const parsed = await page.evaluate((t) => { const d = new DOMParser().parseFromString(t, 'image/svg+xml'); return { error: d.querySelector('parsererror')?.textContent ?? null, root: d.documentElement.nodeName, walls: d.querySelectorAll('[data-wall]').length }; }, svgText);
    expect(parsed.error, 'the SVG is well-formed XML (it opens in a browser)').toBeNull();
    expect(parsed.root).toBe('svg');
    expect(parsed.walls).toBeGreaterThan(0);
    const pngRes = await api.get(rel((await pngA.getAttribute('href'))!));
    expect(pngRes.status()).toBe(200);
    expect([...(await pngRes.body()).subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    await page.locator(`${ED} [data-export-json]`).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __dl: unknown }).__dl !== null), { timeout: 10000 }).toBe(true);
    const dl = await page.evaluate(() => (window as unknown as { __dl: { name: string; text: string } }).__dl);
    expect(dl.name).toBe(`plan-structure-${ids.version}.json`);
    const doc = JSON.parse(dl.text) as Doc;
    expect(doc.walls).toHaveLength(1);
    expect(doc.openings).toHaveLength(3);
  });

  test('a viewer sees the published structure and objects only: no draft wall or object, no edit button, no library, the draft refused (items 14, 29, 50)', async ({ page }) => {
    await saveDraft({ objects: [OBJ('pub-chair', 'chair.basic', [0.5, 0.5])] as unknown as Obj[] });
    await publish();
    const g = await draft();
    await saveDraft({ walls: [...g.doc.walls, WALL('draft-only', [[0.2, 0.9], [0.8, 0.9]]) as unknown as Wall], objects: [...g.doc.objects, OBJ('draft-chair', 'chair.basic', [0.6, 0.5]) as unknown as Obj] });
    const viewerHeaders = { 'x-sw-dev-user': VIEWER };
    expect((await api.get('api/v1/me', { headers: viewerHeaders })).status()).toBe(200); // the dev principal exists from its first request
    const bound = await api.post('api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: `dev-${VIEWER}`, role_id: 'viewer', scope_type: 'floor', scope_id: ids.floor } });
    expect(bound.status()).toBe(201);
    ids.binding = (await bound.json()).id;
    expect((await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`, { headers: viewerHeaders })).status(), 'a viewer gets no draft').toBe(403);
    const pub = await (await api.get(`api/v1/plan-versions/${ids.version}/geometry`, { headers: viewerHeaders })).json();
    expect(pub.doc.walls.map((w: Wall) => w.id)).not.toContain('draft-only');

    await page.setExtraHTTPHeaders(viewerHeaders);
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const canvas = page.locator(`${MAP} sw-plan-canvas`);
    await expect(canvas.locator('[data-structure] [data-wall]').first()).toBeAttached({ timeout: 20000 });
    await expect(canvas.locator('[data-object="pub-chair"]')).toHaveCount(1);
    await expect(canvas.locator('[data-object="draft-chair"]')).toHaveCount(0);
    await expect(canvas.locator('[data-wall="draft-only"]')).toHaveCount(0);
    await expect(page.locator(`${MAP} sw-button`, { hasText: 'עריכת תוכנית' })).toHaveCount(0);
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await page.waitForTimeout(2000);
    await expect(page.locator(`${ED} [data-library-panel]`)).toHaveCount(0);
    const lib = page.locator(`${ED} [data-tool="library"]`);
    if (await lib.count()) await expect(lib).toBeDisabled();
    await expect(page.locator(`${ED} sw-plan-canvas [data-wall="draft-only"]`)).toHaveCount(0);
  });

  test('library: Hebrew and English search, a category chip, a favourite kept across a reload, an item dragged onto the plan, Shift keeps the ratio, arrows nudge, the size and the label from the panel, an array deleted whole, the level filter and the level field (items 21-24, 31, 32, 42)', async ({ page }) => {
    test.setTimeout(120_000);
    // 1 m = 100 px: the 1000 px plan is 10 m wide; a second level for item 42
    expect((await api.patch(`api/v1/plan-versions/${ids.version}/calibration`, { data: { pairs: [{ a: [0, 0.5], b: [1, 0.5], metres: 10 }] } })).status()).toBe(200);
    await saveDraft({ levels: [{ id: 'L0', name: 'ראשי', elevation_m: 0, ceiling_height_m: 3, is_default: true, external_ids: {} }, { id: 'L1', name: 'גלריה', elevation_m: 3, ceiling_height_m: 3, is_default: false, external_ids: {} }] as unknown as Doc['levels'] });
    await openEditor(page);
    await page.evaluate(() => { try { localStorage.removeItem('sw.studio.fav'); } catch { /* none */ } });
    await page.locator(`${ED} [data-tool="library"]`).click();
    const rows = page.locator(`${ED} [data-lib-item]`);
    const search = page.locator(`${ED} [data-lib-search]`);
    // item 21: results while typing, in Hebrew and in English; a category chip narrows the list
    await search.fill('כיסא');
    await expect(page.locator(`${ED} [data-lib-item="chair.basic"]`)).toHaveCount(1);
    await search.fill('chair');
    await expect(page.locator(`${ED} [data-lib-item="chair.basic"]`)).toHaveCount(1);
    await search.fill('מטף');
    await expect(page.locator(`${ED} [data-lib-item="extinguisher.co2"]`)).toHaveCount(1);
    await expect(page.locator(`${ED} [data-lib-item="chair.basic"]`)).toHaveCount(0);
    await search.fill('');
    await page.locator(`${ED} [data-lib-cat="safety"]`).click();
    await expect(page.locator(`${ED} [data-lib-item="extinguisher.co2"]`)).toHaveCount(1);
    await expect(page.locator(`${ED} [data-lib-item="chair.basic"]`)).toHaveCount(0);
    // a favourite is kept in this browser
    await page.locator(`${ED} [data-lib-fav="extinguisher.co2"]`).click();
    await page.reload();
    await expect(page.locator(`${ED} sw-plan-canvas`)).toBeAttached({ timeout: 20000 });
    await page.locator(`${ED} [data-tool="library"]`).click();
    await page.locator(`${ED} [data-lib-cat="favorites"]`).click();
    await expect(rows).toHaveCount(1);
    await expect(page.locator(`${ED} [data-lib-item="extinguisher.co2"]`)).toHaveCount(1);

    // item 22: an item dragged from the panel onto the plan lands at the drop point
    await page.locator(`${ED} [data-lib-cat="all"]`).click();
    await search.fill('desk');
    const before = new Set((await draft()).doc.objects.map((o) => o.id));
    const drop = await planPoint(page, ED, 0.3, 0.55);
    await page.locator(`${ED} [data-lib-item="table.desk"]`).dragTo(page.locator(`${ED} sw-plan-canvas`), { targetPosition: drop.rel });
    await expect.poll(async () => (await draft()).doc.objects.filter((o) => !before.has(o.id)).length, { timeout: 10000 }).toBe(1);
    const desk = (await draft()).doc.objects.find((o) => !before.has(o.id))!;
    expect(desk.item_id).toBe('table.desk');
    expect(Math.abs(desk.position[0] - 0.3)).toBeLessThan(0.01);
    expect(Math.abs(desk.position[1] - 0.55)).toBeLessThan(0.01);
    const deskOf = async () => (await draft()).doc.objects.find((o) => o.id === desk.id)!;

    // item 23: Shift while stretching keeps the width / depth ratio; the arrows nudge 1 cm (Shift 10 cm)
    await page.keyboard.press('Escape');
    await clickPlan(page, ED, 0.3, 0.55);
    await expect(page.locator(`${ED} [data-selected-object="${desk.id}"]`)).toBeVisible();
    const edge = (await page.locator(`${ED} sw-plan-canvas [data-object-stretch="1"]`).boundingBox())!;
    await page.keyboard.down('Shift');
    await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2);
    await page.mouse.down();
    await page.mouse.move(edge.x + edge.width / 2 + 40, edge.y + edge.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect.poll(async () => (await deskOf()).size.w_m, { timeout: 10000 }).toBeGreaterThan(1.5);
    const stretched = (await deskOf()).size;
    expect(stretched.d_m / stretched.w_m, 'the 1.4 x 0.7 ratio is kept').toBeCloseTo(0.5, 2);
    await clickPlan(page, ED, 0.3, 0.55);
    await expect(page.locator(`${ED} [data-selected-object="${desk.id}"]`)).toBeVisible();
    const x0 = (await deskOf()).position[0];
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await deskOf()).position[0], { timeout: 10000 }).toBeCloseTo(x0 + 0.001, 4);
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(async () => (await deskOf()).position[0], { timeout: 10000 }).toBeCloseTo(x0 + 0.011, 4);

    // item 24: the panel's size fields and the label
    const fp = page.locator(`${ED} sw-plan-canvas [data-object="${desk.id}"] .fp`);
    const wide0 = (await fp.boundingBox())!.width;
    await page.locator(`${ED} [data-object-w]`).fill('3');
    await page.locator(`${ED} [data-object-w]`).dispatchEvent('change');
    await page.locator(`${ED} [data-object-h]`).fill('1.1');
    await page.locator(`${ED} [data-object-h]`).dispatchEvent('change');
    await expect.poll(async () => (await deskOf()).size.w_m, { timeout: 10000 }).toBe(3);
    expect((await deskOf()).size.h_m).toBe(1.1);
    await expect.poll(async () => (await fp.boundingBox())!.width).toBeGreaterThan(wide0 * 1.3);
    await page.locator(`${ED} [data-object-label]`).fill('דלפק קבלה');
    await page.locator(`${ED} [data-object-label]`).dispatchEvent('change');
    await expect(page.locator(`${ED} sw-plan-canvas [data-object="${desk.id}"] text.olabel`)).toHaveText('דלפק קבלה');
    await expect.poll(async () => (await deskOf()).label, { timeout: 10000 }).toBe('דלפק קבלה');

    // item 42: the level filter hides the selected object and closes its panel; with a level filter on, the level field
    // moves the filter with the object (under "all levels" nothing needs to follow)
    await page.locator(`${ED} [data-level-chip="L1"]`).click();
    await expect(page.locator(`${ED} [data-selected-object]`)).toHaveCount(0);
    await page.locator(`${ED} [data-level-chip="L0"]`).click(); // the desk's own level: it shows again
    await clickPlan(page, ED, (await deskOf()).position[0], 0.55);
    await expect(page.locator(`${ED} [data-selected-object="${desk.id}"]`)).toBeVisible();
    await page.locator(`${ED} [data-selected-object] select[data-item-level]`).selectOption('L1');
    await expect(page.locator(`${ED} [data-level-chip="L1"]`)).toHaveAttribute('selected', '');
    await expect(page.locator(`${ED} [data-selected-object="${desk.id}"]`)).toBeVisible();
    await expect(page.locator(`${ED} sw-plan-canvas [data-object="${desk.id}"]`)).toHaveCount(1);
    await expect.poll(async () => (await deskOf()).level_id, { timeout: 10000 }).toBe('L1');
    await page.locator(`${ED} [data-level-chip="all"]`).click();

    // item 32: a custom item (made through the API here; its dialog is covered by evidence-plan-studio-2) is found and placed
    const custom = await api.post('api/v1/catalog/objects', { data: { based_on: 'chair.basic', names: { he: 'כיסא טופס תשע', en: 'Form nine chair' } } });
    expect(custom.status()).toBe(201);
    ids.custom = (await custom.json()).id;
    await page.goto('about:blank');
    await openEditor(page);
    await page.locator(`${ED} [data-tool="library"]`).click();
    await search.fill('טופס תשע');
    await expect(rows).toHaveCount(1);
    await page.locator(`${ED} [data-lib-item="${ids.custom}"]`).click();
    await clickPlan(page, ED, 0.85, 0.8);
    await expect.poll(async () => (await draft()).doc.objects.filter((o) => o.item_id === ids.custom).length, { timeout: 10000 }).toBe(1);

    // item 31: an array deleted whole from the in-page dialog ("מחק הכול")
    await page.keyboard.press('Escape');
    await search.fill('כיסא');
    await page.locator(`${ED} [data-lib-item="chair.basic"]`).click();
    await clickPlan(page, ED, 0.7, 0.2);
    await page.keyboard.press('Escape');
    await expect(page.locator(`${ED} [data-selected-object]`)).toBeVisible();
    const origin = (await page.locator(`${ED} [data-selected-object]`).getAttribute('data-selected-object'))!;
    await expect.poll(async () => (await draft()).doc.objects.some((o) => o.id === origin), { timeout: 10000 }).toBe(true); // the placement is saved
    const count0 = (await draft()).doc.objects.length;
    await page.locator(`${ED} [data-object-array]`).click();
    await page.locator(`${ED} [data-array-rows]`).fill('2');
    await page.locator(`${ED} [data-array-cols]`).fill('2');
    await page.locator(`${ED} [data-array-create]`).click();
    await expect(page.locator(`${ED} [data-selected-group]`)).toContainText('4');
    await expect.poll(async () => (await draft()).doc.objects.length, { timeout: 10000 }).toBe(count0 + 3);
    await page.keyboard.press('Delete');
    await expect(page.locator(`${ED} [data-group-delete-dialog] [data-group-delete-all]`)).toBeVisible();
    await page.locator(`${ED} [data-group-delete-all]`).click();
    await expect.poll(async () => (await draft()).doc.objects.length, { timeout: 10000 }).toBe(count0 - 1);
    expect((await draft()).doc.groups).toHaveLength(0);
    await saved(page);
  });
});
