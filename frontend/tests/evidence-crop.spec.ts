import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the owner's report "the saved crop is not what the preview showed": the import wizard now
// shows the server-rotated page, the crop rectangle is drawn with the mouse over that picture, and the
// derived version contains exactly the drawn area. Uses a synthetic four-colour page on a throwaway floor
// (created and deleted through the API). Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T020-crop-live');
const FIXTURE = path.join(HERE, 'fixtures', 'quadrant.png'); // TL red, TR green, BL blue, BR yellow (400x200)

test.describe('plan import crop (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('rotated preview, mouse-drawn crop, saved version matches', async ({ page, request }, testInfo) => {
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const building = tree.sites.flatMap((s: { buildings: { id: string }[] }) => s.buildings)[0];
    expect(building).toBeTruthy();
    const created = await request.post(`/api/v1/buildings/${building.id}/floors`, { data: { name: 'בדיקת חיתוך (זמנית)', level: 9, sort_order: 99 } });
    expect(created.status()).toBe(201);
    const floorId = (await created.json()).id as string;
    try {
      await open(page, `/explore/floors/${floorId}/import`);
      const wiz = page.locator('explore-plan-import');
      await wiz.locator('input[type=file]').setInputFiles({ name: 'quadrant.png', mimeType: 'image/png', buffer: fs.readFileSync(FIXTURE) });
      const frame = wiz.locator('.frame');
      await expect(frame).toBeVisible({ timeout: 15000 });
      const img = frame.locator('img');
      await expect(img).toBeVisible();
      const before = (await img.boundingBox())!;
      expect(before.width).toBeGreaterThan(before.height); // landscape source
      await page.screenshot({ path: path.join(OUT, `crop-source-${testInfo.project.name}.png`) });

      // 1) rotate: the preview itself is served rotated (portrait now), not CSS-rotated in a landscape box
      await wiz.getByRole('button', { name: 'סובב 90°' }).click();
      await expect(img).toHaveAttribute('src', /rotation=90/);
      await expect.poll(async () => { const b = await img.boundingBox(); return b ? b.height > b.width : false; }, { timeout: 10000 }).toBe(true);
      const box = (await frame.boundingBox())!;
      expect(box.height).toBeGreaterThan(box.width);

      // 2) draw the crop with the mouse over the top-left area of the rotated page (8%..48%)
      const at = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
      const s = at(0.08, 0.08);
      const e = at(0.48, 0.48);
      await page.mouse.move(s.x, s.y);
      await page.mouse.down();
      await page.mouse.move((s.x + e.x) / 2, (s.y + e.y) / 2, { steps: 6 });
      await page.mouse.move(e.x, e.y, { steps: 6 });
      await page.mouse.up();
      const cropbox = frame.locator('.cropbox');
      await expect(cropbox).toBeVisible();
      const style = await cropbox.getAttribute('style');
      const pct = (k: string) => Number(new RegExp(`${k}:([\\d.]+)%`).exec(style ?? '')?.[1]);
      expect(Math.abs(pct('left') - 8)).toBeLessThan(2);
      expect(Math.abs(pct('top') - 8)).toBeLessThan(2);
      expect(Math.abs(pct('width') - 40)).toBeLessThan(2.5);
      expect(Math.abs(pct('height') - 40)).toBeLessThan(2.5);
      // the drawn rectangle sits exactly where the box is painted (frame-relative, over the rotated picture)
      const cb = (await cropbox.boundingBox())!;
      expect(Math.abs(cb.x - s.x)).toBeLessThan(4);
      expect(Math.abs(cb.y - s.y)).toBeLessThan(4);
      await page.screenshot({ path: path.join(OUT, `crop-drawn-${testInfo.project.name}.png`) });

      // 3) save: the derived version is the drawn area of the rotated page → portrait and solid blue
      await wiz.getByRole('button', { name: 'הבא' }).click();
      await wiz.getByRole('button', { name: 'הבא' }).click();
      await wiz.getByRole('button', { name: 'שמור כטיוטה' }).click();
      await expect(wiz.locator('.ok')).toBeVisible({ timeout: 20000 });
      const version = await wiz.evaluate((el) => (el as unknown as { version: { id: string; width_px: number; height_px: number; image_url: string } }).version);
      expect(version.height_px).toBeGreaterThan(version.width_px);
      expect(Math.abs(version.width_px - 80)).toBeLessThan(6); // 40% of the rotated width (200 px)
      expect(Math.abs(version.height_px - 160)).toBeLessThan(6); // 40% of the rotated height (400 px)
      const rgb = await page.evaluate(async (url) => {
        const im = new Image();
        im.src = url;
        await im.decode();
        const c = document.createElement('canvas');
        c.width = 1;
        c.height = 1;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(im, 0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2]];
      }, '/api/v1/' + version.image_url.replace(/^\/?api\/v1\//, ''));
      expect(Math.abs(rgb[0] - 30)).toBeLessThan(14);
      expect(Math.abs(rgb[1] - 60)).toBeLessThan(14);
      expect(Math.abs(rgb[2] - 220)).toBeLessThan(14);
      await page.screenshot({ path: path.join(OUT, `crop-saved-${testInfo.project.name}.png`) });
    } finally {
      await request.delete(`/api/v1/floors/${floorId}?force=true`);
    }
  });
});
