import { test, expect } from '@playwright/test';
import { lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';

// NOTICESAVER-295: the TV's saver layer, the three logo layouts and the right-aligned clock, in the product TV page.
//   npx playwright test tests/notice-tv-saver-295.spec.ts --project=desktop

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'desktop Chromium only'));

const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';

async function open(page: import('@playwright/test').Page, display: Parameters<typeof lobbyFeed>[0], w = 1920, h = 1080) {
  await page.setViewportSize({ width: w, height: h });
  await serveFeed(page, lobbyFeed(display));
  await page.goto(new URL(tvUrl(), base()).toString());
  await page.waitForSelector('#cv[data-tpl] .pg .hd', { state: 'attached' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(1200);
}

for (const [w, h] of [[1920, 1080], [1280, 720], [3840, 2160]] as const) {
  test(`the clock sits at the right edge of its column (RTL) at ${w}x${h}`, async ({ page }) => {
    await open(page, { template: 1 }, w, h);
    const r = await page.evaluate(() => {
      const t = document.querySelector('.clock .t') as HTMLElement;
      const range = document.createRange();
      range.selectNodeContents(t);
      const a = range.getBoundingClientRect();
      const b = t.getBoundingClientRect();
      return { textRight: a.right, boxRight: b.right, textLeft: a.left, boxLeft: b.left };
    });
    expect(Math.abs(r.boxRight - r.textRight)).toBeLessThan(2);
  });
}

for (const s of ['wash', 'cycle', 'wave', 'ambient'] as const) {
  test(`saver ${s} draws its layer`, async ({ page }) => {
    await open(page, { saver: s });
    await expect(page.locator(`#saver[data-m="${s}"]`)).toHaveCount(1);
  });
}

test('saver off draws no layer; a saver setting sets the canvas mark', async ({ page }) => {
  await open(page, {});
  await expect(page.locator('#saver')).toHaveCount(0);
  await expect(page.locator('#cv')).toHaveAttribute('data-saver', 'off');
});

for (const lay of ['a', 'b', 'c'] as const) {
  test(`logo layout ${lay}`, async ({ page }) => {
    await open(page, { logos: lay });
    const n = (sel: string) => page.locator(sel).count();
    if (lay === 'a') {
      expect(await n('.hd .lg.product')).toBe(0);
      expect(await n('.ft .lg.product')).toBe(1);
      expect(await n('.hd .lg.company')).toBe(1);
    } else if (lay === 'b') {
      await expect(page.locator('.hd')).toBeHidden();
      expect(await n('.ft .lgs .lg.product')).toBe(1);
      expect(await n('.ft .lgs .lg.company')).toBe(1);
    } else {
      expect(await n('.hd .lg.product')).toBe(1);
      expect(await n('.hd .lg.company')).toBe(1);
      expect(await n('.ft .lg.product')).toBe(0);
      await expect(page.locator('.ft .pwr')).toContainText('SmplWise Arx');
    }
  });
}
