import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for R2 (0.1.69) against the running developer backend: the coverage cone's range handle, the manual
// polygon (convert, drag a vertex, add on a midpoint, remove with a double click), save, and the viewer drawing it.
// Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'owner-round-live');

type Pt = { x: number; y: number };

test.describe('owner round 6: manual coverage area (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1800);
  }

  test('range handle, polygon editing, save, viewer', async ({ page, request }, testInfo) => {
    test.setTimeout(150000);
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    const floor = floors.find((f: { has_plan: boolean }) => f.has_plan);
    expect(floor).toBeTruthy();
    const map = await (await request.get(`/api/v1/floors/${floor.id}/map?draft=true`)).json();
    const anchor = map.anchors.find((a: { resource_type: string; field_of_view_degrees: number | null }) => a.resource_type === 'camera' && a.field_of_view_degrees);
    expect(anchor, 'a camera with a cone must be on the plan').toBeTruthy();
    const before = { coverage_radius: anchor.coverage_radius ?? null, coverage_polygon: anchor.coverage_polygon ?? null };
    try {
      await open(page, `/explore/floors/${floor.id}/edit`);
      const editor = page.locator('explore-plan-editor');
      const canvas = editor.locator('sw-plan-canvas');
      await expect(canvas).toBeVisible();
      const box = (await canvas.boundingBox())!;
      const centre = await canvas.evaluate((el, id) => {
        const c = el as unknown as { markers: { id: string; x: number; y: number }[]; toScreen: (x: number, y: number) => Pt };
        const m = c.markers.find((x) => x.id === id)!;
        return c.toScreen(m.x, m.y);
      }, anchor.id);
      // select the camera: a press without a move
      await page.mouse.click(box.x + centre.x, box.y + centre.y);
      await page.waitForTimeout(300);
      const range = canvas.locator('[data-cov-range]');
      await expect(range).toBeVisible();
      // 1) drag the range handle away from the pin: the radius grows
      const rb = (await range.boundingBox())!;
      const rx = rb.x + rb.width / 2;
      const ry = rb.y + rb.height / 2;
      const dx = rx - (box.x + centre.x);
      const dy = ry - (box.y + centre.y);
      const len = Math.hypot(dx, dy) || 1;
      await page.mouse.move(rx, ry);
      await page.mouse.down();
      await page.mouse.move(rx + (dx / len) * 60, ry + (dy / len) * 60, { steps: 6 });
      await page.mouse.move(rx + (dx / len) * 120, ry + (dy / len) * 120, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const radius = await editor.evaluate((el, id) => (el as unknown as { anchors: { id: string; coverage_radius?: number | null }[] }).anchors.find((a) => a.id === id)!.coverage_radius, anchor.id);
      expect(radius).toBeGreaterThan(0.02);
      await expect(editor.locator('[data-coverage-radius]')).toHaveValue(String(Math.round(radius! * 100)));
      await page.screenshot({ path: path.join(OUT, `coverage-range-${testInfo.project.name}.png`) });
      // 2) convert to a polygon: the cone becomes a polygon with vertex and midpoint handles
      await editor.locator('[data-coverage-polygon]').click();
      await page.waitForTimeout(300);
      await expect(canvas.locator('[data-cov-polygon]')).toHaveCount(1);
      const n0 = await canvas.locator('[data-cov-vertex]').count();
      expect(n0).toBeGreaterThanOrEqual(4);
      // a vertex drag moves that point only
      const v1 = (await canvas.locator('[data-cov-vertex="1"]').boundingBox())!;
      await page.mouse.move(v1.x + v1.width / 2, v1.y + v1.height / 2);
      await page.mouse.down();
      await page.mouse.move(v1.x + v1.width / 2 + 40, v1.y + v1.height / 2 + 25, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const poly1 = await editor.evaluate((el, id) => (el as unknown as { anchors: { id: string; coverage_polygon?: [number, number][] | null }[] }).anchors.find((a) => a.id === id)!.coverage_polygon, anchor.id);
      expect(poly1!.length).toBe(n0);
      // a midpoint click adds a vertex; a double click on a vertex removes one
      await canvas.locator('[data-cov-mid="0"]').click();
      await page.waitForTimeout(200);
      await expect(canvas.locator('[data-cov-vertex]')).toHaveCount(n0 + 1);
      await canvas.locator('[data-cov-vertex="2"]').dblclick();
      await page.waitForTimeout(200);
      await expect(canvas.locator('[data-cov-vertex]')).toHaveCount(n0);
      await page.screenshot({ path: path.join(OUT, `coverage-polygon-${testInfo.project.name}.png`) });
      // 3) save: the API carries the polygon and the radius
      await editor.locator('sw-button', { hasText: 'שמירת מיקום' }).first().click();
      await page.waitForTimeout(1500);
      const saved = (await (await request.get(`/api/v1/floors/${floor.id}/anchors`)).json()).anchors.find((a: { id: string }) => a.id === anchor.id);
      expect(saved.coverage_polygon?.length).toBe(n0);
      expect(saved.coverage_radius).toBeCloseTo(radius!, 3);
      // 4) the viewer draws the polygon instead of the cone
      await open(page, `/explore/floors/${floor.id}`);
      const viewer = page.locator('explore-floor-map sw-plan-canvas');
      await expect(viewer.locator('[data-cov-polygon]')).toHaveCount(1, { timeout: 30000 });
      await page.screenshot({ path: path.join(OUT, `coverage-viewer-${testInfo.project.name}.png`) });
    } finally {
      const cur = (await (await request.get(`/api/v1/floors/${floor.id}/anchors`)).json()).anchors.find((a: { id: string }) => a.id === anchor.id);
      if (cur) await request.patch(`/api/v1/map-anchors/${anchor.id}`, { data: { revision: cur.revision, ...before } });
    }
  });
});
