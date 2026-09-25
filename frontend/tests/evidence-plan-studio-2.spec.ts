import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Plan Studio phase 2 (T085) against the running developer backend: objects and connectors on the live map, the library
// in the editor, arrays, levels, connectors, circuits with simulated switch states (the dev-only state route), the global
// search and the custom library. The spec builds its own site / building / two floors with generated plan pictures and
// removes them at the end. Runs only with SW_LIVE=1 (backend on 8099 behind the preview proxy) in real Chrome.
const ids = { site: '', building: '', floor: '', floor2: '', version: '', version2: '', asset: '' };
let api: APIRequestContext;

const LEVEL = (id: string, name: string, elevation: number, ceiling: number, isDefault = false) => ({ id, name, elevation_m: elevation, ceiling_height_m: ceiling, is_default: isDefault, external_ids: {} });
const OBJ = (id: string, item: string, pos: [number, number], extra: Record<string, unknown> = {}) => ({ id, item_id: item, level_id: 'L0', position: pos, rotation_deg: 0, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 },
  z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });

/** Click a normalized plan point on the canvas of `screen` (the canvas converts plan to host pixels itself). Exported, like
 * dragPlan, for the later tasks' tests of this file (an unused module function fails noUnusedLocals). */
export async function clickPlan(page: Page, screen: string, x: number, y: number, modifiers: ('Alt' | 'Shift')[] = []) {
  const canvas = page.locator(`${screen} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, p) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(p[0], p[1]), [x, y] as [number, number]);
  for (const m of modifiers) await page.keyboard.down(m); // mouse.click takes no modifiers: hold them like dragPlan
  await page.mouse.click(box.x + s.x, box.y + s.y);
  for (const m of modifiers) await page.keyboard.up(m);
}

/** Drag from one normalized plan point to another on the canvas of `screen`. */
export async function dragPlan(page: Page, screen: string, from: [number, number], to: [number, number], modifiers: ('Alt' | 'Shift')[] = []) {
  const canvas = page.locator(`${screen} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const conv = async (p: [number, number]) => canvas.evaluate((el, q) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(q[0], q[1]), p);
  const a = await conv(from);
  const b = await conv(to);
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.move(box.x + a.x, box.y + a.y);
  await page.mouse.down();
  await page.mouse.move(box.x + (a.x + b.x) / 2, box.y + (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(box.x + b.x, box.y + b.y, { steps: 4 });
  await page.mouse.up();
  for (const m of modifiers) await page.keyboard.up(m);
}

const draft = async (version = ids.version) => (await (await api.get(`api/v1/plan-versions/${version}/geometry?draft=true`)).json()) as { geometry: { revision: number }; doc: Record<string, unknown> & { objects: { id: string; item_id: string; position: [number, number]; group_id: string | null; anchor_ref: unknown }[]; groups: { id: string; member_ids: string[] }[]; connectors: { id: string; kind: string; level_to: string | null; floor_ids: string[] }[]; circuits: { id: string; member_ids: string[]; power_w: number }[]; levels: { id: string }[] } };
const saveDraft = async (patch: Record<string, unknown>, version = ids.version) => {
  const g = await draft(version);
  expect((await api.put(`api/v1/plan-versions/${version}/geometry`, { data: { doc: { ...g.doc, ...patch }, base_revision: g.geometry.revision } })).status()).toBe(200);
};
const publish = async (version = ids.version) => expect((await api.post(`api/v1/plan-versions/${version}/geometry/publish`)).status()).toBe(200);

test.describe.serial('plan studio phase 2 (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173/' });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת סטודיו 2 ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'אולם ספורט' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'אולם', level: 0 } })).json()).id;
    ids.floor2 = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'גלריה', level: 1 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent('<div style="box-sizing:border-box;width:1000px;height:600px;background:#fff;border:10px solid #333"></div>');
    const png = await page.screenshot();
    await page.close();
    for (const [floor, key, vkey] of [[ids.floor, 'asset', 'version'], [ids.floor2, '', 'version2']] as const) {
      const asset = await (await api.post(`api/v1/floors/${floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
      if (key) ids[key] = asset.id;
      ids[vkey] = (await (await api.post(`api/v1/floors/${floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
      expect((await api.post(`api/v1/plan-versions/${ids[vkey]}/publish`)).status()).toBe(200);
    }
    // 1 m = 100 px: the whole 1000 px plan is 10 m wide
    expect((await api.patch(`api/v1/plan-versions/${ids.version}/calibration`, { data: { pairs: [{ a: [0, 0.5], b: [1, 0.5], metres: 10 }] } })).status()).toBe(200);
  });

  test.afterAll(async () => {
    if (!api) return;
    try {
      for (const f of [ids.floor, ids.floor2]) if (f) expect((await api.delete(`api/v1/floors/${f}?force=true`)).status(), 'test floor removed').toBe(204);
      if (ids.building) expect((await api.delete(`api/v1/buildings/${ids.building}`)).status(), 'test building removed').toBe(204);
      if (ids.site) expect((await api.delete(`api/v1/sites/${ids.site}`)).status(), 'test site removed').toBe(204);
    } finally {
      await api.dispose();
    }
  });

  test('published objects and connectors show on the live map with their own layer switches and in the exports', async ({ page }) => {
    await saveDraft({
      levels: [LEVEL('L0', 'מפלס ראשי', 0, 2.8, true), LEVEL('L1', 'אולם תחתון', -1.2, 6)],
      objects: [OBJ('seed-chair', 'chair.basic', [0.2, 0.2]), OBJ('seed-lamp', 'light.ceiling', [0.5, 0.3], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: 2.5 })],
      connectors: [{ id: 'seed-stairs', kind: 'stairs', level_from: 'L0', level_to: 'L1', floor_ids: [], polyline: [[0.7, 0.7], [0.8, 0.7]], width_m: 1.2, label: null, object_id: null, source: 'manual', external_ids: {} }],
    });
    await publish();
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const objects = page.locator('explore-floor-map sw-plan-canvas [data-structure] [data-object]');
    await expect(objects).toHaveCount(2, { timeout: 20000 });
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-object="seed-chair"][data-item="chair.basic"]')).toHaveCount(1);
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-connector="seed-stairs"][data-kind="stairs"]')).toHaveCount(1);
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-connector="seed-stairs"] text')).toHaveText('↓ −1.2 מ׳');
    await page.locator('explore-floor-map .layers button[aria-label="עצמים"]').click();
    await expect(objects).toHaveCount(0);
    await page.locator('explore-floor-map .layers button[aria-label="עצמים"]').click();
    await expect(objects).toHaveCount(2);
    await page.locator('explore-floor-map .layers button[aria-label="מחברים"]').click();
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-connector]')).toHaveCount(0);
    await page.locator('explore-floor-map .layers button[aria-label="מחברים"]').click();
    await page.locator('explore-floor-map sw-button[icon="layers"]').click();
    await expect(page.locator('explore-floor-map [data-layers-panel] [data-layer="objects"]')).toHaveCount(1);
    await expect(page.locator('explore-floor-map [data-layers-panel] [data-layer="connectors"]')).toHaveCount(1);
    const svg = await (await api.get(`api/v1/plan-versions/${ids.version}/export.svg`)).text();
    expect(svg).toContain('data-object="seed-chair"');
    expect(svg).toContain('data-symbol="chair"');
    expect(await (await api.get(`api/v1/plan-versions/${ids.version}/export.svg?layers=structure`)).text()).not.toContain('data-object');
    // a circuit's colour reaches the lamp's inline style only as one of the six circuit tokens: any other document string is dropped
    const CIRCUIT = (token: string) => ({ id: 'seed-k', name: 'מעגל בדיקה', switch_entity_id: 'light.t085_seed', member_ids: ['seed-lamp'], color_token: token, power_w: 0 });
    const lamp = page.locator('explore-floor-map sw-plan-canvas [data-object="seed-lamp"]');
    for (const [token, kc] of [['circuit-1); fill: red; --x: (', null], ['circuit-2', 'var(--sw-circuit-2)']] as const) {
      await saveDraft({ circuits: [CIRCUIT(token)] });
      await publish();
      await page.reload();
      await expect(lamp).toHaveAttribute('data-circuit', 'seed-k', { timeout: 20000 });
      expect(await lamp.evaluate((el) => (el as SVGElement).style.getPropertyValue('--kc').trim() || null)).toBe(kc);
    }
    await saveDraft({ circuits: [] });
    await publish();
  });
});
