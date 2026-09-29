import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Stairs between floors and stairs with a landing (T085, owner 2026-09-29: "stairs connect only between levels"), the
// owner's flow against the running developer backend: on floor 0 a U stair with a landing is placed with the stairs
// tool, "מחבר אל" takes it to the gallery level of floor 1; floor 1 shows the twin with the label back to floor 0; the
// building page draws the link between the stacked floors once both are published; deleting the stairs asks
// "למחוק גם בקומה השנייה?" and deletes both. The spec builds its own site / building / two floors and removes them.
// Runs only with SW_LIVE=1 (backend behind the preview proxy). Screenshots go to SW_SHOT_DIR (default private-evidence).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = process.env.SW_SHOT_DIR || path.resolve(HERE, '..', '..', 'private-evidence', 'plan-studio-stairs');
const ids = { site: '', building: '', f0: '', f1: '', v0: '', v1: '' };
let api: APIRequestContext;
const ed = 'explore-plan-editor';

type Conn = { id: string; level_from: string; level_to: string | null; floor_ids: string[]; polyline: [number, number][]; shape?: string; flights?: { steps: number }[]; far?: { floor_name: string | null; level_name: string | null } | null };
const draft = async (version: string) => (await (await api.get(`api/v1/plan-versions/${version}/geometry?draft=true`)).json()) as { geometry: { revision: number }; doc: Record<string, unknown> & { connectors: Conn[]; levels: unknown[] } };

async function clickPlan(page: Page, x: number, y: number) {
  const canvas = page.locator(`${ed} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, p) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(p[0], p[1]), [x, y] as [number, number]);
  await page.mouse.click(box.x + s.x, box.y + s.y);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

test.describe.serial('stairs between floors (T085)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת מדרגות ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'בניין מדרגות' } })).json()).id;
    ids.f0 = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומה 0', level: 0 } })).json()).id;
    ids.f1 = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומה 1', level: 1 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent('<div style="box-sizing:border-box;width:1000px;height:600px;background:#fff;border:10px solid #333"></div>');
    const png = await page.screenshot();
    await page.close();
    for (const [floor, key] of [[ids.f0, 'v0'], [ids.f1, 'v1']] as const) {
      const asset = await (await api.post(`api/v1/floors/${floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
      ids[key] = (await (await api.post(`api/v1/floors/${floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
      expect((await api.post(`api/v1/plan-versions/${ids[key]}/publish`)).status()).toBe(200);
      // the same sheet on both floors, 1 m = 50 px: the twin lands at the same plan coordinates
      expect((await api.patch(`api/v1/plan-versions/${ids[key]}/calibration`, { data: { pairs: [{ a: [0, 0.5], b: [1, 0.5], metres: 20 }] } })).status()).toBe(200);
    }
    const g1 = await draft(ids.v1);
    const put = await api.put(`api/v1/plan-versions/${ids.v1}/geometry`, { data: { doc: { ...g1.doc, levels: [...g1.doc.levels, { id: 'L-gal', name: 'גלריה', elevation_m: 1.5, ceiling_height_m: 2.6, is_default: false, external_ids: {} }] }, base_revision: g1.geometry.revision } });
    expect(put.status()).toBe(200);
  });

  test.afterAll(async () => {
    if (!api) return;
    const failures: string[] = [];
    for (const [what, p] of [['floor 0', `api/v1/floors/${ids.f0}?force=true`], ['floor 1', `api/v1/floors/${ids.f1}?force=true`], ['building', `api/v1/buildings/${ids.building}`], ['site', `api/v1/sites/${ids.site}`]] as const) {
      try {
        const status = (await api.delete(p)).status();
        if (status !== 204) failures.push(`${what}: ${status}`);
      } catch (err) {
        failures.push(`${what}: ${String(err)}`);
      }
    }
    await api.dispose();
    expect(failures, 'test data removed').toEqual([]);
  });

  test('a U stair with a landing on floor 0 reaches the gallery of floor 1; the twin shows there; both publish; the building page links them; delete asks and removes both', async ({ page }) => {
    await page.goto(`/?design=a#/explore/floors/${ids.f0}/edit`);
    await page.locator(`${ed} [data-tool="connectors"]`).click();
    await page.locator(`${ed} [data-conn-mode="stairs"]`).click();
    await page.locator(`${ed} [data-stair-draw-shape="u"]`).click();
    // the first flight: from (0.45, 0.85) up to (0.45, 0.55) - 0.3 x 600 px = 180 px = 3.6 m, 13 steps
    await clickPlan(page, 0.45, 0.85);
    await clickPlan(page, 0.45, 0.55);
    const sel = page.locator(`${ed} [data-selected-connector]`);
    await expect(sel).toBeVisible();
    const sid = (await sel.getAttribute('data-selected-connector'))!;
    const g = page.locator(`${ed} sw-plan-canvas [data-connector="${sid}"]`);
    await expect(g).toHaveAttribute('data-shape', 'u');
    await expect(g).toHaveAttribute('data-flights', '13+13');
    await expect(g.locator('[data-stair-flight]')).toHaveCount(2);
    await expect(g.locator('[data-stair-landing]')).toHaveCount(1);
    await expect(g.locator('[data-stair-flight="0"] line')).toHaveCount(12);
    await expect(g.locator('[data-stair-caption]')).toHaveText('13+13 מדרגות · פודסט');
    // the picker lists this floor's levels and floor 1's levels, by name
    const target = page.locator(`${ed} [data-conn-target]`);
    await expect(target.locator('option')).toContainText(['בחר מפלס או קומה', 'קומה 1 · מפלס ראשי', 'קומה 1 · גלריה'], { timeout: 10000 });
    // steps per flight from the panel: the drawing follows
    await page.locator(`${ed} [data-stair-steps="1"]`).fill('12');
    await page.locator(`${ed} [data-stair-steps="1"]`).dispatchEvent('change');
    await expect(g).toHaveAttribute('data-flights', '13+12');
    await target.selectOption(`${ids.f1}:L-gal`);
    await expect.poll(async () => (await draft(ids.v1)).doc.connectors.map((c) => c.id), { timeout: 15000 }).toEqual([sid]);
    const mine = (await draft(ids.v0)).doc.connectors.find((c) => c.id === sid)!;
    const theirs = (await draft(ids.v1)).doc.connectors[0];
    expect(mine.level_to).toBe('L-gal');
    expect(mine.far?.floor_name).toBe('קומה 1');
    expect(theirs.level_from).toBe('L-gal');
    expect(theirs.flights).toEqual([{ steps: 12 }, { steps: 13 }]); // walked back from the gallery
    expect(theirs.polyline).toEqual([...mine.polyline].reverse()); // the same sheet: the same place
    await expect(page.locator(`${ed} sw-plan-canvas [data-connector="${sid}"] [data-conn-text]`)).toHaveText('↑ קומה 1 · גלריה');
    await expect(page.locator(`${ed} [data-conn-twin-note]`)).toContainText('לא מזיזה את המדרגות בקומה השנייה');
    await page.waitForTimeout(800);
    await shot(page, 'stairs-1-floor0-u-linked');
    // floor 1: the twin, labelled back down to floor 0
    await page.goto('about:blank'); // a hash-only change of the same path is not a navigation
    await page.goto(`/?design=a#/explore/floors/${ids.f1}/edit`);
    await page.locator(`${ed} [data-tool="connectors"]`).click();
    await expect(page.locator(`${ed} sw-plan-canvas [data-connector="${sid}"] [data-conn-text]`)).toHaveText('↓ קומה 0 · מפלס ראשי', { timeout: 15000 });
    await expect(page.locator(`${ed} sw-plan-canvas [data-connector="${sid}"]`)).toHaveAttribute('data-flights', '12+13');
    await page.locator(`${ed} [data-conn-row="${sid}"]`).click();
    await page.waitForTimeout(800);
    await shot(page, 'stairs-2-floor1-twin');
    // both publish; the building page draws the link between the stacked floors
    for (const v of [ids.v0, ids.v1]) expect((await api.post(`api/v1/plan-versions/${v}/geometry/publish`)).status()).toBe(200);
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/buildings/${ids.building}/floors`);
    await expect(page.locator(`explore-floors [data-floor-links] [data-stack-link="${sid}"] line`)).toHaveCount(1, { timeout: 20000 });
    await expect(page.locator(`explore-floors [data-link-row="${sid}"]`)).toContainText('קומה 0 · מפלס ראשי');
    await expect(page.locator(`explore-floors [data-link-row="${sid}"]`)).toContainText('קומה 1 · גלריה');
    await shot(page, 'stairs-3-building-links');
    // delete on floor 0: "למחוק גם בקומה השנייה?" - both
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.f0}/edit`);
    await page.locator(`${ed} [data-tool="connectors"]`).click();
    await page.locator(`${ed} [data-conn-row="${sid}"]`).click();
    await page.locator(`${ed} [data-selected-connector] [data-geom-delete]`).click();
    await expect(page.locator(`${ed} [data-twin-delete-dialog] [data-twin-delete-both]`)).toBeVisible(); // the sw-dialog host itself has no box
    await shot(page, 'stairs-4-delete-both');
    await page.locator(`${ed} [data-twin-delete-both]`).click();
    await expect.poll(async () => (await draft(ids.v1)).doc.connectors.length, { timeout: 15000 }).toBe(0);
    await expect.poll(async () => (await draft(ids.v0)).doc.connectors.length, { timeout: 15000 }).toBe(0);
  });

  test('stairs with a landing from the library are placed as a connector with one click', async ({ page }) => {
    await page.goto(`/?design=a#/explore/floors/${ids.f0}/edit`);
    await page.locator(`${ed} [data-tool="library"]`).click();
    await page.locator(`${ed} [data-lib-search]`).fill('פודסט');
    const item = page.locator(`${ed} [data-lib-item="stairs.landing"]`);
    await item.first().click();
    await clickPlan(page, 0.7, 0.9);
    const sel = page.locator(`${ed} [data-selected-connector]`);
    await expect(sel).toBeVisible();
    const sid = (await sel.getAttribute('data-selected-connector'))!;
    await expect(page.locator(`${ed} sw-plan-canvas [data-connector="${sid}"]`)).toHaveAttribute('data-shape', 'u');
    await expect(page.locator(`${ed} sw-plan-canvas [data-connector="${sid}"]`)).toHaveAttribute('data-flights', '9+9');
    await expect.poll(async () => (await draft(ids.v0)).doc.connectors.find((c) => c.id === sid)?.shape ?? null, { timeout: 10000 }).toBe('u');
  });
});
