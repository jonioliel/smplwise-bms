import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for M13 §3 "עריכת vertices": in the plan editor the selected zone's corners are dragged with the
// mouse, a midpoint handle inserts a corner, a double-click removes one; every change is saved through the
// API with the zone's revision. Uses a zone created for the run and deleted afterwards. Runs with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T007-zones-live');

test.describe('zone vertex editing (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1800);
  }

  test('drag a corner, insert one, remove one', async ({ page, request }, testInfo) => {
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    const floor = floors.find((f: { has_plan: boolean }) => f.has_plan);
    expect(floor).toBeTruthy();
    const created = await request.post(`/api/v1/floors/${floor.id}/zones`, { data: { name: 'פינת עריכה', kind: 'zone', polygon: [{ x: 0.03, y: 0.55 }, { x: 0.15, y: 0.55 }, { x: 0.15, y: 0.68 }, { x: 0.03, y: 0.68 }] } });
    expect(created.status()).toBe(201);
    const zone = await created.json();
    try {
      await open(page, `/explore/floors/${floor.id}/edit`);
      const editor = page.locator('explore-plan-editor');
      const canvas = editor.locator('sw-plan-canvas');
      await expect(canvas).toBeVisible();
      await editor.getByRole('button', { name: 'חדרים ואזורים' }).click();
      await editor.locator('[data-zone-row]', { hasText: 'פינת עריכה' }).click();
      const sel = canvas.locator('g.zone.selected');
      await expect(sel).toHaveCount(1);
      await expect(sel.locator('circle.vtx')).toHaveCount(4);
      await expect(sel.locator('circle.vmid')).toHaveCount(4);

      // 1) drag corner 0 by +40,+30 px
      const v0 = (await sel.locator('circle.vtx[data-vertex="0"]').boundingBox())!;
      const cx = v0.x + v0.width / 2;
      const cy = v0.y + v0.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 20, cy + 15, { steps: 5 });
      await page.mouse.move(cx + 40, cy + 30, { steps: 5 });
      await page.mouse.up();
      await expect.poll(async () => (await (await request.get(`/api/v1/floors/${floor.id}/zones`)).json()).zones.find((z: { id: string }) => z.id === zone.id).polygon[0].x, { timeout: 10000 }).toBeGreaterThan(0.03);
      const moved = (await (await request.get(`/api/v1/floors/${floor.id}/zones`)).json()).zones.find((z: { id: string }) => z.id === zone.id);
      expect(moved.polygon[0].y).toBeGreaterThan(0.55);
      expect(moved.revision).toBe(2);

      // 2) drag the first midpoint handle: a fifth corner appears
      await expect(sel).toHaveCount(1); // still selected after the save
      const m0 = (await sel.locator('circle.vmid').first().boundingBox())!;
      const mx = m0.x + m0.width / 2;
      const my = m0.y + m0.height / 2;
      await page.mouse.move(mx, my);
      await page.mouse.down();
      await page.mouse.move(mx + 10, my - 15, { steps: 5 });
      await page.mouse.move(mx + 20, my - 30, { steps: 5 });
      await page.mouse.up();
      await expect.poll(async () => (await (await request.get(`/api/v1/floors/${floor.id}/zones`)).json()).zones.find((z: { id: string }) => z.id === zone.id).polygon.length, { timeout: 10000 }).toBe(5);
      await expect(sel.locator('circle.vtx')).toHaveCount(5);
      await page.screenshot({ path: path.join(OUT, `zone-vertices-${testInfo.project.name}.png`) });

      // 3) double-click the new corner: removed again
      const v1 = (await sel.locator('circle.vtx[data-vertex="1"]').boundingBox())!;
      await page.mouse.dblclick(v1.x + v1.width / 2, v1.y + v1.height / 2);
      await expect.poll(async () => (await (await request.get(`/api/v1/floors/${floor.id}/zones`)).json()).zones.find((z: { id: string }) => z.id === zone.id).polygon.length, { timeout: 10000 }).toBe(4);
      await expect(sel.locator('circle.vtx')).toHaveCount(4);
    } finally {
      await request.delete(`/api/v1/zones/${zone.id}`);
    }
  });
});
