import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for R1 (0.1.67) against the running developer backend: site / building edit, photo upload and removal,
// the delete guard for a site with buildings, and the floor tree in the map's side list. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'owner-round-live');

// a 64x48 PNG made in the browser (no fixture file needed)
async function pngBytes(page: import('@playwright/test').Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 48;
    const g = c.getContext('2d')!;
    g.fillStyle = '#2f5fd0'; g.fillRect(0, 0, 64, 48);
    return c.toDataURL('image/png');
  });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

test.describe('owner round 4: catalog admin tools (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('edit, photo, delete guard, floor tree', async ({ page, request }, testInfo) => {
    test.setTimeout(150000);
    // a site of its own so the dev catalogue stays untouched
    const site = await (await request.post('/api/v1/sites', { data: { name: `R1 אתר ${Date.now()}`, address: 'רחוב הבדיקה 1' } })).json();
    const building = await (await request.post(`/api/v1/sites/${site.id}/buildings`, { data: { name: 'מבנה בדיקה' } })).json();
    try {
      await page.goto('/?design=a#/explore/sites');
      const screen = page.locator('explore-sites');
      const card = screen.locator(`[data-site-card="${site.id}"]`);
      await expect(card).toBeVisible({ timeout: 30000 });
      // edit the name
      await card.locator(`[data-edit="${site.id}"]`).click();
      const dlg = screen.locator('[data-edit-dialog]');
      await expect(dlg.locator('[data-form-name]')).toBeVisible();
      await dlg.locator('[data-form-name]').fill(`${site.name} ערוך`);
      await dlg.locator('[data-form-submit]').click();
      await expect(card).toContainText('ערוך', { timeout: 15000 });
      expect((await (await request.get('/api/v1/sites?tree=true')).json()).sites.find((s: { id: string }) => s.id === site.id).name).toBe(`${site.name} ערוך`);
      // photo through the API path the button uses (the file picker is a native dialog): upload, then the card shows it
      const png = await pngBytes(page);
      const up = await request.post(`/api/v1/buildings/${building.id}/image`, { multipart: { file: { name: 'b.png', mimeType: 'image/png', buffer: png } } });
      expect(up.status()).toBe(200);
      await page.reload();
      await expect(screen.locator(`[data-site-card="${site.id}"]`)).toBeVisible({ timeout: 30000 });
      await screen.locator('sw-tabs').getByText('מבנים').click();
      const bcard = screen.locator(`[data-building-card="${building.id}"]`);
      await expect(bcard.locator('img.photo')).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: path.join(OUT, `catalog-photo-${testInfo.project.name}.png`) });
      // delete guard: the site still has a building
      await screen.locator('sw-tabs').getByText('כל האתרים').click();
      await card.locator(`[data-delete="${site.id}"]`).click();
      const del = screen.locator('[data-delete-dialog]');
      await expect(del).toContainText('לאתר יש 1 מבנים');
      await expect(del.locator('[data-delete-confirm]')).toHaveAttribute('disabled', '');
      await del.locator('sw-button', { hasText: 'ביטול' }).click();
      // floor tree in the map's side list
      const tree = await (await request.get('/api/v1/sites?tree=true')).json();
      const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors)) as { id: string; has_plan: boolean }[];
      const start = floors.find((f) => f.has_plan) ?? floors[0]; // the map (and its side list) needs a plan
      await page.goto(`/?design=a#/explore/floors/${start.id}`);
      const viewer = page.locator('explore-floor-map');
      await expect(viewer.locator('[data-sidelist-toggle]')).toBeVisible({ timeout: 30000 });
      await expect(viewer.locator('[data-floorchip]')).toBeVisible({ timeout: 30000 }); // the bundle is in: the list can render
      await page.waitForTimeout(800);
      if (!(await viewer.locator('[data-sidelist]').isVisible())) await viewer.locator('[data-sidelist-toggle]').click();
      await expect(viewer.locator('[data-side-floor]')).toHaveCount(floors.length);
      await expect(viewer.locator(`[data-side-floor="${start.id}"]`)).toHaveClass(/on/);
      const other = floors.find((f) => f.id !== start.id);
      if (other) {
        await viewer.locator(`[data-side-floor="${other.id}"]`).click();
        await expect.poll(() => page.evaluate(() => location.hash)).toContain(other.id);
      }
    } finally {
      await request.delete(`/api/v1/buildings/${building.id}/image`);
      await request.delete(`/api/v1/buildings/${building.id}`);
      await request.delete(`/api/v1/sites/${site.id}`);
    }
  });
});
