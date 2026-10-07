import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Window walls (glass curtain walls, document 2.1) against a running backend: draw one with the kind choice, convert a
// wall to glass and back in one click, edit the glazing (panel width, an opening panel, the bulk equal division) with
// undo, the phone guard, and evidence screenshots of the 2D map in every skin and both themes and of the 3D view, with
// the glTF export. The spec builds its own site / building / floor with a generated plan picture and removes them.
// Runs only with SW_LIVE=1 (a backend behind the preview proxy; SW_API_PORT picks a throwaway instance).
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'design', 'evidence', 'wall-glass');
const ids = { site: '', building: '', floor: '', version: '' };
let api: APIRequestContext;
type GltfReport = { issues: { numErrors: number; messages: { severity: number; code: string; message: string }[] } };
const gltfValidator = createRequire(import.meta.url)('gltf-validator') as { validateString: (json: string, opts?: Record<string, unknown>) => Promise<GltfReport> };

const ED = 'explore-plan-editor';
const MAP = 'explore-floor-map';
const GLAZING = { panel_width_m: 1.2, panel_count: null, mullion_m: 0.06, sill_m: 0.5, glazed_height_m: null, tint: 'clear', opacity: 0.35, operable: [] as unknown[] };
const WALL = (id: string, polyline: [number, number][], kind = 'exterior', extra: Record<string, unknown> = {}) => ({ id, level_id: 'L0', polyline, thickness_m: kind === 'glass' ? 0.12 : 0.25, height_m: null,
  base_z_m: 0, kind, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });

async function clickPlan(page: Page, screen: string, x: number, y: number) {
  const canvas = page.locator(`${screen} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, p) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(p[0], p[1]), [x, y] as [number, number]);
  await page.mouse.click(box.x + s.x, box.y + s.y);
}
async function expectEnabled(l: Locator, timeout = 30000): Promise<void> {
  await expect(l).toBeAttached({ timeout });
  await expect(l).not.toHaveAttribute('disabled', '', { timeout });
}
const draft = async () => (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json()) as { doc: { schema_version: string; walls: { id: string; kind: string; glazing?: Record<string, unknown> }[] }; geometry: { revision: number } };
const wallOf = async (id: string) => (await draft()).doc.walls.find((w) => w.id === id);

test.describe.serial('window walls (glass curtain walls)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת קיר חלונות ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה בדיקה' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומת זכוכית', level: 0 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent('<div style="box-sizing:border-box;width:1000px;height:600px;background:#fff;border:6px solid #ccc"></div>');
    const png = await page.screenshot();
    await page.close();
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
    ids.version = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
    // calibrate: 800 px = 20 m, 0.025 m per plan pixel (a calibrated plan shows real panel widths)
    expect((await api.patch(`api/v1/plan-versions/${ids.version}/calibration`, { data: { pairs: [{ a: [0.1, 0.5], b: [0.9, 0.5], metres: 20 }] } })).status()).toBeLessThan(300);
    const g = await draft();
    const doc = {
      ...g.doc,
      walls: [
        // a showroom: a glass facade with a door and two opening panels, a glass corner, solid back walls
        WALL('gw-facade', [[0.15, 0.2], [0.65, 0.2]], 'glass', { glazing: { ...GLAZING, operable: [{ panel: 1, operation: 'casement_left', anchor_ref: null }, { panel: 7, operation: 'tilt', anchor_ref: null }] } }),
        WALL('gw-corner', [[0.65, 0.2], [0.85, 0.2], [0.85, 0.55]], 'glass', { glazing: { ...GLAZING, sill_m: 0, glazed_height_m: 2.2, tint: 'tinted', panel_width_m: 1.5 } }),
        WALL('sw-back', [[0.85, 0.55], [0.85, 0.8], [0.15, 0.8], [0.15, 0.2]]),
        WALL('sw-inner', [[0.45, 0.45], [0.45, 0.8]], 'interior'),
      ],
      openings: [{ id: 'go-door', wall_id: 'gw-facade', t: 0.5, kind: 'door', width_m: 1.8, height_m: 2.2, sill_m: 0, swing: 'double', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} }],
      labels: [{ id: 'gl-1', text: 'אולם תצוגה', position: [0.3, 0.55], level_id: 'L0', size: 16 }],
    };
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

  test('evidence: the 2D map draws window walls apart from solid walls in every skin and both themes', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop evidence');
    test.setTimeout(180_000);
    for (const skin of ['classic', 'tesla', 'domus', 'bubble']) {
      for (const scheme of ['light', 'dark']) {
        await page.goto('about:blank');
        await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}#/explore/floors/${ids.floor}`);
        const canvas = page.locator(`${MAP} sw-plan-canvas`);
        await expect(canvas.locator('[data-structure] [data-wall-glass]')).toHaveCount(3, { timeout: 20000 }); // the facade in two parts + the corner
        await expect(canvas.locator('[data-structure] [data-glazing]')).toHaveCount(2);
        await expect(canvas.locator('[data-glazing="gw-facade"] [data-operable]')).toHaveCount(2);
        await page.waitForTimeout(600);
        await canvas.screenshot({ path: path.join(OUT, `map-2d-${skin}-${scheme}.png`) });
      }
    }
  });

  test('evidence: the 3D view - glass panes over a sill, mullions, and the glTF export carries the glass', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop evidence');
    test.setTimeout(150_000);
    await page.addInitScript(() => {
      const w = window as unknown as { __gltf: { name: string; text: string } | null };
      w.__gltf = null;
      const origCreate = URL.createObjectURL.bind(URL);
      const blobs = new Map<string, Blob>();
      URL.createObjectURL = (b: Blob | MediaSource) => { const u = origCreate(b); if (b instanceof Blob) blobs.set(u, b); return u; };
      HTMLAnchorElement.prototype.click = function () { const b = blobs.get(this.href); if (b) void b.text().then((text) => { w.__gltf = { name: this.download, text }; }); };
    });
    for (const scheme of ['light', 'dark']) {
      await page.goto('about:blank');
      await page.goto(`/?design=a&scheme=${scheme}#/explore/floors/${ids.floor}`);
      const host = page.locator(MAP);
      await expectEnabled(host.locator('[data-view-3d]'), 30000);
      await host.locator('[data-view-3d]').click();
      const el = host.locator('sw-plan-3d[data-floor-3d]');
      await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
      await page.waitForTimeout(1500);
      await el.screenshot({ path: path.join(OUT, `map-3d-${scheme}.png`) });
      if (scheme === 'light') {
        await el.locator('[data-export-gltf]').click();
        await expect.poll(() => page.evaluate(() => (window as unknown as { __gltf: unknown }).__gltf !== null), { timeout: 30000 }).toBe(true);
        const got = await page.evaluate(() => (window as unknown as { __gltf: { name: string; text: string } }).__gltf);
        const gltf = JSON.parse(got.text) as { nodes: { name?: string }[]; materials: { alphaMode?: string }[] };
        const names = gltf.nodes.map((n) => n.name ?? '');
        expect(names.filter((n) => /^wall:gw-facade#\d+:glass$/.test(n)).length, names.join(',')).toBe(2); // the door cuts the facade into two panes
        expect(names.filter((n) => /^wall:gw-corner#0(\.1)?:glass$/.test(n)).length, names.join(',')).toBe(2); // the L: a pane per run (the sill, heads and mullions travel as instances)
        expect(gltf.materials.some((m) => m.alphaMode === 'BLEND')).toBe(true);
        const report = await gltfValidator.validateString(got.text, { uri: got.name, maxIssues: 200 });
        expect(report.issues.numErrors, JSON.stringify(report.issues.messages.filter((m) => m.severity === 0).slice(0, 5))).toBe(0);
      }
    }
  });

  test('draw a window wall with the kind choice; convert a wall to glass and back in one click; glazing edits with undo', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the editor on a desktop');
    test.setTimeout(120_000);
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    const canvas = page.locator(`${ED} sw-plan-canvas`);
    await expect(canvas.locator('[data-wall]').first()).toBeAttached({ timeout: 20000 });
    await page.locator(`${ED} [data-tool="structure"]`).click();
    await page.locator(`${ED} [data-studio-mode="wall"]`).click();
    // the kind choice of the drawing defaults: 'קיר חלונות'
    await page.locator(`${ED} select[data-wall-kind]`).selectOption('glass');
    await clickPlan(page, ED, 0.2, 0.92);
    await clickPlan(page, ED, 0.6, 0.92);
    await page.keyboard.press('Enter');
    await expect(canvas.locator('[data-structure] [data-wall-glass]')).toHaveCount(4);
    const drawnId = (await page.locator(`${ED} [data-selected-wall]`).getAttribute('data-selected-wall'))!;
    await expect(page.locator(`${ED} [data-glazing-inspector="${drawnId}"]`)).toBeVisible();
    await expect.poll(async () => (await wallOf(drawnId))?.kind, { timeout: 10000 }).toBe('glass');
    expect((await draft()).doc.schema_version).toBe('2.1');
    await page.locator(`${ED} [data-studio-mode="select"]`).click();

    // one click: the inner solid wall becomes a window wall, and back
    await clickPlan(page, ED, 0.45, 0.65);
    await expect(page.locator(`${ED} [data-selected-wall="sw-inner"]`)).toBeVisible();
    await page.locator(`${ED} [data-wall-to-glass]`).click();
    await expect(page.locator(`${ED} [data-glazing-inspector="sw-inner"]`)).toBeVisible();
    await expect(canvas.locator('[data-glazing="sw-inner"]')).toHaveCount(1);
    await expect.poll(async () => (await wallOf('sw-inner'))?.kind, { timeout: 10000 }).toBe('glass');
    // glazing: a panel width of 1 m -> 5 panels on the 5.25 m wall (210 px); panel 3 opens
    const width = page.locator(`${ED} [data-glazing-width]`);
    await width.fill('1');
    await width.press('Enter');
    await width.blur();
    await expect(page.locator(`${ED} [data-glazing-inspector="sw-inner"]`)).toHaveAttribute('data-glazing-panels', '5');
    await page.locator(`${ED} [data-glazing-panel="2"]`).click();
    await expect(page.locator(`${ED} [data-glazing-panel="2"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${ED} [data-operable-row="2"]`)).toBeVisible();
    await page.locator(`${ED} [data-operable-row="2"] [data-operable-operation]`).selectOption('sliding');
    await expect.poll(async () => (await wallOf('sw-inner'))?.glazing?.operable, { timeout: 10000 }).toEqual([{ panel: 2, operation: 'sliding', anchor_ref: null }]);
    // bulk layout: equal panels between 1.6 and 1.8 m -> 3 panels of 1.75 m; panel 3 still exists
    await page.locator(`${ED} [data-glazing-auto-min]`).fill('1.6');
    await page.locator(`${ED} [data-glazing-auto-min]`).blur();
    await page.locator(`${ED} [data-glazing-auto-max]`).fill('1.8');
    await page.locator(`${ED} [data-glazing-auto-max]`).blur();
    await page.locator(`${ED} [data-glazing-auto]`).click();
    await expect(page.locator(`${ED} [data-glazing-inspector="sw-inner"]`)).toHaveAttribute('data-glazing-panels', '3');
    await expect.poll(async () => (await wallOf('sw-inner'))?.glazing?.panel_count, { timeout: 10000 }).toBe(3);
    await expect(canvas.locator('[data-glazing="sw-inner"]')).toHaveAttribute('data-panels', '3');
    await page.locator(`${ED} [data-studio-panel]`).screenshot({ path: path.join(OUT, 'editor-glazing-panel.png') });
    await canvas.screenshot({ path: path.join(OUT, 'editor-2d-converted.png') });
    // undo: back to 5 panels; redo: 3 again (an undo clears the selection, as for every structure edit: read the map)
    await page.keyboard.press('Control+z');
    await expect(canvas.locator('[data-glazing="sw-inner"]')).toHaveAttribute('data-panels', '5');
    await page.keyboard.press('Control+y');
    await expect(canvas.locator('[data-glazing="sw-inner"]')).toHaveAttribute('data-panels', '3');
    // back to a solid wall in one click: no glazing left; undo brings the window wall back as it was
    await clickPlan(page, ED, 0.45, 0.65);
    await expect(page.locator(`${ED} [data-glazing-inspector="sw-inner"]`)).toHaveAttribute('data-glazing-panels', '3');
    await page.locator(`${ED} [data-wall-to-solid]`).click();
    await expect(page.locator(`${ED} [data-glazing-inspector]`)).toHaveCount(0);
    await expect(canvas.locator('[data-glazing="sw-inner"]')).toHaveCount(0);
    await expect.poll(async () => { const w = await wallOf('sw-inner'); return w ? `${w.kind}:${'glazing' in w}` : ''; }, { timeout: 10000 }).toBe('exterior:false');
    await page.keyboard.press('Control+z');
    await expect(canvas.locator('[data-glazing="sw-inner"]')).toHaveAttribute('data-panels', '3');
    await expect.poll(async () => (await wallOf('sw-inner'))?.glazing?.operable, { timeout: 10000 }).toEqual([{ panel: 2, operation: 'sliding', anchor_ref: null }]);
    await expect(page.locator(`${ED} [data-studio-panel][data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
  });

  test('phone guard: the editor (and with it the glazing) is desktop only; the phone map draws the window walls', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'the phone');
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    // the app's own phone guard: no editor, so no glazing inspector, no kind choice, no conversion
    await expect(page.getByRole('heading', { name: 'עריכת מבנה וקומות זמינה במחשב בלבד' })).toBeVisible({ timeout: 20000 });
    await expect(page.locator(`${ED} [data-glazing-inspector]`)).toHaveCount(0);
    await expect(page.locator(`${ED} [data-wall-to-glass], ${ED} [data-wall-to-solid]`)).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, 'phone-editor-guard.png') });
    // the operator's map on the phone shows the window walls as on the desktop
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const canvas = page.locator(`${MAP} sw-plan-canvas`);
    await expect(canvas.locator('[data-structure] [data-wall-glass]')).toHaveCount(3, { timeout: 20000 });
    await expect(canvas.locator('[data-structure] [data-glazing]')).toHaveCount(2);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'phone-map-2d.png') });
  });
});
