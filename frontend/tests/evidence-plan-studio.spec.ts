import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Plan Studio phase 1 (T084) against the running developer backend. The spec builds its own site / building / floor
// with a generated plan picture, so the owner's floors are never touched, and removes them at the end.
// Runs only with SW_LIVE=1 (backend on 8099 behind the preview proxy).
const ids = { site: '', building: '', floor: '', version: '', asset: '' };
let api: APIRequestContext;

const WALL = (id: string, polyline: [number, number][]) => ({ id, level_id: 'L0', polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'exterior',
  confidence: 1, source: 'manual', locked: false, external_ids: {} });

/** Click a normalized plan point on the canvas of `screen` (the canvas converts plan to host pixels itself). */
export async function clickPlan(page: Page, screen: string, x: number, y: number) {
  const canvas = page.locator(`${screen} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, p) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(p[0], p[1]), [x, y] as [number, number]);
  await page.mouse.click(box.x + s.x, box.y + s.y);
}

test.describe.serial('plan studio (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173/' });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת סטודיו ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה בדיקה' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומת בדיקה', level: 0 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
    await page.setContent('<div style="box-sizing:border-box;width:800px;height:500px;background:#fff;border:10px solid #333"></div>');
    const png = await page.screenshot();
    await page.close();
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
    ids.asset = asset.id;
    ids.version = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
  });

  test.afterAll(async () => {
    if (!api) return;
    try {
      // every delete is asserted, so a test site left on the developer backend is reported (each route answers 204)
      if (ids.floor) expect((await api.delete(`api/v1/floors/${ids.floor}?force=true`)).status(), 'test floor removed').toBe(204);
      if (ids.building) expect((await api.delete(`api/v1/buildings/${ids.building}`)).status(), 'test building removed').toBe(204);
      if (ids.site) expect((await api.delete(`api/v1/sites/${ids.site}`)).status(), 'test site removed').toBe(204);
    } finally {
      await api.dispose();
    }
  });

  test('a published structure shows on the live map, with a layer switch, and on the history map', async ({ page }) => {
    const g = await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json();
    const doc = { ...g.doc, walls: [WALL('lw1', [[0.1, 0.1], [0.9, 0.1]]), WALL('lw2', [[0.1, 0.1], [0.1, 0.9]])],
      openings: [{ id: 'lo1', wall_id: 'lw1', t: 0.5, kind: 'door', width_m: 0.9, height_m: 2.1, sill_m: 0, swing: 'right', hinge: 'start', anchor_ref: null,
        confidence: 1, source: 'manual', external_ids: {} }] };
    expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc, base_revision: g.geometry.revision } })).status()).toBe(200);
    expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const walls = page.locator('explore-floor-map sw-plan-canvas [data-structure] [data-wall]');
    await expect(walls).toHaveCount(3, { timeout: 20000 }); // lw1 is cut by its door into two parts, plus lw2
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-opening="lo1"][data-kind="door"]')).toHaveCount(1);
    await page.locator('explore-floor-map .layers button[aria-label="מבנה"]').click();
    await expect(walls).toHaveCount(0);
    await page.locator('explore-floor-map .layers button[aria-label="מבנה"]').click();
    await expect(walls).toHaveCount(3);
    await page.waitForTimeout(1100); // the instant must be after the publish second
    const t = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    await page.goto(`/?design=a#/investigate/floors/${ids.floor}/history?t=${t}`);
    await expect(page.locator('investigate-history-map sw-plan-canvas [data-wall]')).toHaveCount(3, { timeout: 20000 });
  });
});
