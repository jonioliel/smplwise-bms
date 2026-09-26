import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Plan Studio phase 1 (T084) against the running developer backend. The spec builds its own site / building / floor
// with a generated plan picture, so the owner's floors are never touched, and removes them at the end.
// Runs only with SW_LIVE=1 (backend on 8099 behind the preview proxy).
const ids = { site: '', building: '', floor: '', version: '', asset: '' };
let api: APIRequestContext;
/** The installation's plan.estimates before the run: the spec pins it to "true" (estimates shown) and puts it back. */
let estimatesBefore: string | null = null;

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
    api = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    estimatesBefore = (await (await api.get('api/v1/settings')).json()).settings['plan.estimates'];
    expect((await api.patch('api/v1/settings', { data: { 'plan.estimates': 'true' } })).status(), 'plan.estimates pinned').toBe(200);
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
      if (estimatesBefore) expect((await api.patch('api/v1/settings', { data: { 'plan.estimates': estimatesBefore } })).status(), 'plan.estimates restored').toBe(200);
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
    // an instant before the structure's publish (and after the plan's, in beforeAll): the history shows no walls then
    await page.waitForTimeout(1100);
    const tBefore = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    await page.waitForTimeout(1100);
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
    // owner form item 10 (round 9): before the publish, the same floor's history has its plan and no structure
    await page.goto('about:blank');
    // the history reads the version's publish timeline and draws the period that holds the instant: none yet
    const timeline = page.waitForResponse((r) => r.url().includes(`/plan-versions/${ids.version}/geometry/timeline`), { timeout: 20000 });
    await page.goto(`/?design=a#/investigate/floors/${ids.floor}/history?t=${tBefore}`);
    const periods = ((await (await timeline).json()) as { timeline: { published_at: string }[] }).timeline;
    expect(periods.length, 'the version has a published structure').toBeGreaterThan(0);
    expect(periods.every((p) => p.published_at > tBefore), 'no structure was in force at the instant').toBe(true);
    await expect.poll(() => page.locator('investigate-history-map sw-plan-canvas').evaluate((el) => (el as unknown as { imageUrl: string | null }).imageUrl ?? ''), { timeout: 20000 }).toContain(ids.version);
    await expect(page.locator('investigate-history-map sw-plan-canvas [data-wall]')).toHaveCount(0);
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

  test('calibrate with two points and a known distance, then measure in metres', async ({ page }) => {
    const ed = 'explore-plan-editor';
    // Every click is on a corner of the seeded walls lw1 / lw2: calibrate and measure snap to corners within 10 screen px,
    // so the points are the corners themselves and the assertions are exact at any canvas size or zoom.
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`).first()).toBeAttached({ timeout: 20000 });
    // before calibration: estimates, marked "≈" (plan.estimates is pinned to "true" for the run)
    await page.locator(`${ed} [data-tool="measure"]`).click();
    await clickPlan(page, ed, 0.1, 0.1);
    await clickPlan(page, ed, 0.1, 0.9);
    await expect(page.locator(`${ed} [data-measure-distance]`)).toContainText('≈');
    await page.locator(`${ed} [data-measure-clear]`).click();
    await page.locator(`${ed} [data-tool="calibrate"]`).click();
    await expect(page.locator(`${ed} [data-calib-panel]`)).toBeVisible();
    await clickPlan(page, ed, 0.1, 0.1); // lw1 from end to end: 0.8 x 800 = 640 px
    await clickPlan(page, ed, 0.9, 0.1);
    await page.locator(`${ed} [data-calib-metres]`).fill('16');
    await expect(page.locator(`${ed} [data-calib-save]`)).not.toHaveAttribute('disabled', '');
    const saved = page.waitForResponse((r) => r.url().includes('/calibration') && r.request().method() === 'PATCH');
    await page.locator(`${ed} [data-calib-save]`).click();
    expect((await saved).status()).toBe(200);
    await expect(page.locator(`${ed} [data-calib-result]`)).toContainText('40.0'); // 1 m = 40 px
    const v = await (await api.get(`api/v1/plan-versions/${ids.version}`)).json();
    expect(v.scale_m_per_px).toBeCloseTo(0.025, 6); // 16 m over 640 px
    expect(v.calibration.method).toBe('two_point');
    await page.locator(`${ed} [data-tool="measure"]`).click();
    await clickPlan(page, ed, 0.1, 0.1); // lw2 from end to end: 0.8 x 500 = 400 px
    await clickPlan(page, ed, 0.1, 0.9);
    await expect(page.locator(`${ed} [data-measure-distance]`)).toContainText('10.0'); // 400 px x 0.025 (one decimal from 10 m)
    await expect(page.locator(`${ed} [data-measure-distance]`)).not.toContainText('≈');
  });

  test('publish the structure through its preview; an invalid draft is blocked and fixed from the issue list; a new drawing copies the structure and publishes it with the plan', async ({ page }) => {
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} [data-publish]`)).toContainText('פרסום המבנה', { timeout: 20000 });
    await page.locator(`${ed} [data-publish]`).click();
    await expect(page.locator(`${ed} [data-geom-diff-rows]`)).toContainText('קירות');
    const published = page.waitForResponse((r) => r.url().includes('/geometry/publish'));
    await page.locator(`${ed} [data-geom-publish]`).click();
    expect((await published).status()).toBe(200);
    await expect(page.locator(`${ed} [data-publish]`)).toHaveCount(0);
    const pub = await (await api.get(`api/v1/plan-versions/${ids.version}/geometry`)).json();
    expect(pub.doc.walls).toHaveLength(4); // lw1, lw2, the drawn wall and the closed outline of the second test
    expect(pub.doc.dimensions.scale_m_per_px).toBeCloseTo(0.025, 4);

    // a wall outside the plan blocks publishing; the issue list selects it and Delete fixes the draft
    const g = await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json();
    const bad = { ...g.doc, walls: [...g.doc.walls, WALL('bad1', [[0.2, 0.8], [1.4, 0.8]])] };
    expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc: bad, base_revision: g.geometry.revision } })).status()).toBe(200);
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await page.locator(`${ed} [data-tool="structure"]`).click();
    await expect(page.locator(`${ed} [data-issue="bounds"]`)).toBeVisible({ timeout: 20000 });
    await page.locator(`${ed} [data-publish]`).click();
    await expect(page.locator(`${ed} [data-geom-diff-error]`)).toContainText('שגיאה חוסמת אחת'); // the blocking line (bad1), not a failed comparison
    await expect(page.locator(`${ed} [data-geom-publish] button`)).toBeDisabled();
    await page.locator(`${ed} [data-geom-cancel]`).click();
    await page.locator(`${ed} [data-issue="bounds"]`).click();
    await expect(page.locator(`${ed} [data-selected-wall="bad1"]`)).toBeVisible();
    await page.keyboard.press('Delete');
    await expect(page.locator(`${ed} [data-studio-panel][data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator(`${ed} [data-issue]`)).toHaveCount(0);
    await expect(page.locator(`${ed} [data-publish]`)).toHaveCount(0); // the fixed draft is the published structure again

    // a new plan version of another drawing (rotated) starts empty and offers the published structure
    const turned = await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: ids.asset, rotation: 90 } })).json();
    expect(turned.geometry_carry).toBe('none');
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await page.locator(`${ed} [data-tool="structure"]`).click();
    await page.locator(`${ed} [data-copy-from="${ids.version}"]`).click();
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`)).toHaveCount(6, { timeout: 10000 }); // 4 walls: lw1 and the drawn wall are cut by their doors
    await page.locator(`${ed} [data-publish]`).click();
    await expect(page.locator(`${ed} [data-diff-structure]`)).toContainText('4 קירות');
    const planPublished = page.waitForResponse((r) => r.url().endsWith(`/plan-versions/${turned.id}/publish`));
    await page.locator(`${ed} [data-diff-confirm]`).click();
    expect((await planPublished).status()).toBe(200);
    await expect(page.locator(`${ed} [data-publish]`)).toHaveCount(0); // the studio was reloaded: no structure publish is offered for what went out with the plan
    const after = await (await api.get(`api/v1/plan-versions/${turned.id}/geometry`)).json();
    expect(after.doc.walls).toHaveLength(4);
    const svgExport = await api.get(`api/v1/plan-versions/${turned.id}/export.svg`);
    expect(svgExport.status()).toBe(200);
    expect(await svgExport.text()).toContain('data-wall=');
  });

  test('in door mode an existing door is dragged along its wall (not doubled), nudged with the arrow keys as one undo step and placed exactly by its distance from the wall start', async ({ page }) => {
    const ed = 'explore-plan-editor';
    // The version the editor shows (after the previous test: the rotated drawing, not calibrated) gets a draft of one
    // horizontal wall from (0.2, 0.5) to (0.8, 0.5) with nothing on it.
    const map = await (await api.get(`api/v1/floors/${ids.floor}/map?draft=true`)).json();
    const vid: string = map.plan.id;
    const g = await (await api.get(`api/v1/plan-versions/${vid}/geometry?draft=true`)).json();
    expect(g.doc.dimensions.calibration.status).not.toBe('measured');
    const seeded = { ...g.doc, walls: [WALL('pw1', [[0.2, 0.5], [0.8, 0.5]])], openings: [], labels: [] };
    expect((await api.put(`api/v1/plan-versions/${vid}/geometry`, { data: { doc: seeded, base_revision: g.geometry.revision } })).status()).toBe(200);
    const draft = async () => (await (await api.get(`api/v1/plan-versions/${vid}/geometry?draft=true`)).json()).doc;
    const doorT = async () => ((await draft()).openings as { t: number }[]).map((o) => o.t);
    // the pointer lands on whole screen pixels, so a click at a plan point is exact only to a fraction of a pixel
    const near = (value: string, want: number, tol: number) => expect(Math.abs(parseFloat(value) - want), `${value} vs ${want}`).toBeLessThan(tol);

    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`)).toHaveCount(1, { timeout: 20000 });
    await page.locator(`${ed} [data-tool="structure"]`).click();
    await page.locator(`${ed} [data-studio-mode="door"]`).click();
    await expect(page.locator(`${ed} [data-studio-drag-hint]`)).toContainText('גרירת פתח קיים');
    // a door a quarter of the way along the wall; before calibration its place is a percentage of the wall
    await clickPlan(page, ed, 0.35, 0.5);
    await expect(page.locator(`${ed} sw-plan-canvas [data-opening][data-kind="door"]`)).toHaveCount(1);
    const pct = page.locator(`${ed} [data-opening-percent]`);
    await expect(pct).toBeVisible();
    near(await pct.inputValue(), 25, 1);
    await expect(page.locator(`${ed} [data-opening-distance]`)).toHaveCount(0);
    // 0.1.91: a double door has no hinge jamb to pick, so the same field chooses the side of the wall it opens to
    await expect(page.locator(`${ed} [data-opening-hinge]`)).toHaveAttribute('aria-label', 'ציר');
    await page.locator(`${ed} select[aria-label="כיוון פתיחה"]`).selectOption('double');
    await expect(page.locator(`${ed} [data-opening-hinge]`)).toHaveAttribute('aria-label', 'צד הפתיחה');
    await expect(page.locator(`${ed} [data-opening-hinge] option[value="end"]`)).toHaveText('לצד ימין של הקיר');
    await page.locator(`${ed} [data-opening-hinge]`).selectOption('end');
    await expect.poll(async () => { const o = (await draft()).openings?.[0] as { swing: string; hinge: string } | undefined; return o ? `${o.swing}/${o.hinge}` : "unsaved"; }, { timeout: 10000 }).toBe('double/end');
    await expect(page.locator(`${ed} sw-plan-canvas [data-opening][data-kind="door"]`)).toHaveCount(1);

    // calibrate on the wall's own ends (calibration snaps to corners): the wall is 12 m long
    await page.locator(`${ed} [data-tool="calibrate"]`).click();
    await clickPlan(page, ed, 0.2, 0.5);
    await clickPlan(page, ed, 0.8, 0.5);
    await page.locator(`${ed} [data-calib-metres]`).fill('12');
    await expect(page.locator(`${ed} [data-calib-save]`)).not.toHaveAttribute('disabled', '');
    const saved = page.waitForResponse((r) => r.url().includes('/calibration') && r.request().method() === 'PATCH');
    await page.locator(`${ed} [data-calib-save]`).click();
    expect((await saved).status()).toBe(200);
    await expect(page.locator(`${ed} [data-calib-result]`)).toBeVisible();
    const cal = await draft();
    const L = 0.6 * map.plan.width_px * cal.dimensions.scale_m_per_px; // the wall's length in metres
    expect(L).toBeCloseTo(12, 3);
    const placed = await doorT(); // the door was saved before the calibration
    expect(placed).toHaveLength(1);
    const t0 = placed[0];
    expect(Math.abs(t0 - 0.25)).toBeLessThan(0.01);

    // back in the structure tool, still in door mode: a press on the door selects it and places nothing
    await page.locator(`${ed} [data-tool="structure"]`).click();
    await expect(page.locator(`${ed} [data-studio-mode="door"]`)).toHaveAttribute('aria-pressed', 'true');
    await clickPlan(page, ed, 0.35, 0.5);
    await expect(page.locator(`${ed} [data-selected-opening]`)).toBeVisible();
    const dist = page.locator(`${ed} [data-opening-distance]`);
    await expect(dist).toBeVisible();
    const startValue = await dist.inputValue();
    near(startValue, t0 * L, 0.006); // metres from the wall's start, two decimals
    await expect(page.locator(`${ed} sw-plan-canvas [data-opening]`)).toHaveCount(1);

    // drag it 40 px towards the wall's end, without leaving the door mode, grabbed 4 px off its centre: it moves by the
    // pointer's 40 px (no jump to the pointer), and the distance field follows before the drop
    const canvas = page.locator(`${ed} sw-plan-canvas`);
    const box = (await canvas.boundingBox())!;
    const at = await canvas.evaluate((el) => {
      const c = el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number }; zoom: number; planWidth: number; planHeight: number };
      return { ...c.toScreen(0.35, 0.5), zoom: c.zoom, w: c.planWidth, h: c.planHeight };
    });
    const tpx = 1 / (at.zoom * 0.6 * at.w); // one screen pixel along the wall, as a fraction of the wall
    await page.mouse.move(box.x + at.x + 4, box.y + at.y);
    await page.mouse.down();
    await page.mouse.move(box.x + at.x + 44, box.y + at.y, { steps: 8 });
    await expect(dist).not.toHaveValue(startValue); // live, before the drop
    await page.mouse.up();
    const expected = t0 + 40 * tpx;
    await expect.poll(async () => (await doorT())[0], { timeout: 10000 }).toBeGreaterThan(t0 + 20 * tpx);
    const [t1, ...more] = await doorT();
    expect(more, 'the press took the existing door: no second door').toHaveLength(0);
    expect(Math.abs(t1 - expected), `moved ${(t1 - t0) / tpx} px`).toBeLessThan(1.5 * tpx);
    await expect(page.locator(`${ed} sw-plan-canvas [data-opening]`)).toHaveCount(1);

    // ArrowRight three times on this left-to-right wall: 1 cm each to the right (the arrow's direction) on a calibrated plan
    const before = await dist.inputValue();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await expect(dist).not.toHaveValue(before);
    await expect.poll(async () => (await doorT())[0], { timeout: 10000 }).toBeCloseTo(t1 + 0.03 / L, 4);
    // the burst is one undo step: Ctrl+Z puts the door back where the drag left it (and clears the selection)
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await doorT())[0], { timeout: 10000 }).toBeCloseTo(t1, 5);

    // a click just past the door's end and 10 px off the wall - outside the door's own target, inside the band in which a
    // click finds the wall - takes the door instead of stacking a second one on it
    await clickPlan(page, ed, 0.2 + 0.6 * (t1 + 0.45 / L + 3 * tpx), 0.5 + 10 / (at.zoom * at.h));
    await expect(page.locator(`${ed} [data-selected-opening]`)).toBeVisible();
    await expect(page.locator(`${ed} sw-plan-canvas [data-opening]`)).toHaveCount(1);
    // type its distance from the wall's start (Enter commits it and leaves the focus in the field)
    await dist.fill('7.5');
    await dist.press('Enter');
    await expect(dist).toHaveValue('7.50');
    await expect.poll(async () => (await doorT())[0], { timeout: 10000 }).toBeCloseTo(7.5 / L, 3);
    // a press on the door takes the focus from the field, so the arrow moves the door and does not go to the field
    const t2 = (await doorT())[0];
    await clickPlan(page, ed, 0.2 + 0.6 * t2, 0.5);
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await doorT())[0], { timeout: 10000 }).toBeCloseTo(t2 + 0.01 / L, 4);
    // owner form item 7a (round 9): Shift makes the step 10 cm, and ArrowLeft moves it the other way along the wall
    await page.keyboard.press('Shift+ArrowLeft');
    await expect.poll(async () => (await doorT())[0], { timeout: 10000 }).toBeCloseTo(t2 + 0.01 / L - 0.1 / L, 4);
    expect(await doorT()).toHaveLength(1);
    await expect(page.locator(`${ed} [data-studio-panel][data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
  });
});
