import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Plan Studio phase 1 (T084) against the running developer backend. The spec builds its own site / building / floor
// with a generated plan picture, so the owner's floors are never touched, and removes them at the end.
// Runs only with SW_LIVE=1 (backend on 8099 behind the preview proxy).
const ids = { site: '', building: '', floor: '', version: '', asset: '' };
let api: APIRequestContext;

const WALL = (id: string, polyline: [number, number][]) => ({ id, level_id: 'L0', polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'exterior',
  confidence: 1, source: 'manual', locked: false, external_ids: {} });

/** Click a normalized plan point on the canvas of `screen` (the canvas converts plan to host pixels itself). */
async function clickPlan(page: Page, screen: string, x: number, y: number) {
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

  test('draw a wall, place a door, select, delete and undo in the editor; the draft autosaves and viewers keep the published one', async ({ page }) => {
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`)).toHaveCount(3, { timeout: 20000 });
    await page.locator(`${ed} [data-tool="structure"]`).click();
    await expect(page.locator(`${ed} [data-studio-panel]`)).toBeVisible();
    await page.locator(`${ed} [data-studio-mode="wall"]`).click();
    await clickPlan(page, ed, 0.3, 0.6);
    await clickPlan(page, ed, 0.7, 0.6);
    await page.keyboard.press('Enter');
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`)).toHaveCount(4);
    await page.locator(`${ed} [data-studio-mode="door"]`).click();
    await clickPlan(page, ed, 0.5, 0.6);
    await expect(page.locator(`${ed} sw-plan-canvas [data-opening][data-kind="door"]`)).toHaveCount(2);
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`)).toHaveCount(5); // the door cuts the new wall
    await expect(page.locator(`${ed} [data-selected-opening]`)).toBeVisible();
    await expect(page.locator(`${ed} [data-studio-panel][data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
    const draft = await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json();
    expect(draft.geometry.status).toBe('draft');
    expect(draft.doc.walls).toHaveLength(3);
    expect(draft.doc.openings).toHaveLength(2);
    const published = await (await api.get(`api/v1/plan-versions/${ids.version}/geometry`)).json();
    expect(published.doc.walls).toHaveLength(2); // viewers see nothing until it is published
    // a click back on the first point closes the outline into one wall; dragging that corner keeps it closed
    const draftWall = async (id: string) => (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json()).doc.walls.find((w: { id: string }) => w.id === id);
    await page.locator(`${ed} [data-studio-mode="wall"]`).click();
    await clickPlan(page, ed, 0.2, 0.7);
    await clickPlan(page, ed, 0.4, 0.7);
    await clickPlan(page, ed, 0.4, 0.85);
    await clickPlan(page, ed, 0.2, 0.7);
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`)).toHaveCount(6); // one more part: the outline
    await expect(page.locator(`${ed} [data-selected-wall]`)).toBeVisible();
    const ringId = (await page.locator(`${ed} [data-selected-wall]`).getAttribute('data-selected-wall'))!;
    await expect.poll(async () => (await draftWall(ringId))?.polyline.length ?? 0, { timeout: 10000 }).toBe(4);
    const ring = await draftWall(ringId);
    expect(ring.polyline[3]).toEqual(ring.polyline[0]);
    await page.locator(`${ed} [data-studio-mode="select"]`).click();
    await clickPlan(page, ed, 0.3, 0.7);
    await expect(page.locator(`${ed} [data-selected-wall="${ringId}"]`)).toBeVisible();
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall-vertex]`)).toHaveCount(3); // one handle per corner
    const corner = (await page.locator(`${ed} sw-plan-canvas [data-wall-vertex="0"]`).boundingBox())!;
    await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
    await page.mouse.down();
    await page.mouse.move(corner.x + corner.width / 2 + 30, corner.y + corner.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await draftWall(ringId)).polyline[0][0], { timeout: 10000 }).toBeGreaterThan(ring.polyline[0][0] + 0.01);
    const dragged = await draftWall(ringId);
    expect(dragged.polyline[0]).toEqual(dragged.polyline[3]); // still closed
    await page.locator(`${ed} [data-studio-mode="select"]`).click();
    await clickPlan(page, ed, 0.35, 0.6);
    await expect(page.locator(`${ed} [data-selected-wall]`)).toBeVisible();
    await page.keyboard.press('Delete');
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`)).toHaveCount(4); // 3 before the outline
    await expect(page.locator(`${ed} sw-plan-canvas [data-opening]`)).toHaveCount(1); // its door went with it
    await page.keyboard.press('Control+z');
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`)).toHaveCount(6); // 5 before the outline
    await expect(page.locator(`${ed} [data-studio-panel][data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
  });
});
