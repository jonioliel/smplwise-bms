import { test, expect, type Page } from '@playwright/test';
import { BUBBLE_SCREENS_ENABLED } from '../src/design/skins';
import { SKINS_UNDER_TEST } from './helpers/frozen-skins';
import { settlePage } from './pixel-settle';

// BUBBLECLEAN-297: while the bubble skin is frozen, the bubble-only screens are gone (the Look dials card in Settings > General, the
// #/styleguide/bubble demo), and a stored / requested bubble skin lands on the fallback with no console error. Demo mode, no backend.
//   SW_BASE_URL=http://127.0.0.1:4802/ npx playwright test tests/evidence-bubble-clean-297.spec.ts --workers=1
// Unfreeze: BUBBLE_SCREENS_ENABLED turns true by itself and the first test below is skipped (docs/design/BUBBLE_FREEZE_RESTORE.md).

async function open(page: Page, query: string, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full${query}#${hash}`);
  await page.waitForSelector('sw-app');
  await settlePage(page);
}

test.describe('BUBBLECLEAN-297', () => {
  for (const skin of SKINS_UNDER_TEST) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`settings General renders for ${skin} / ${scheme} without the bubble Look dials card`, async ({ page }) => {
        test.skip(BUBBLE_SCREENS_ENABLED, 'the bubble skin is not frozen any more');
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await open(page, `&skin=${skin}&scheme=${scheme}`, '/system/diagnostics');
        await expect(page.locator('html')).toHaveAttribute('data-skin', skin);
        await expect(page.locator('sw-app system-diagnostics system-design')).toHaveCount(1);
        await expect(page.locator('sw-app system-diagnostics system-look')).toHaveCount(0);
        await expect(page.locator('sw-app system-diagnostics system-design [data-skin-option]')).toHaveCount(SKINS_UNDER_TEST.length);
        await expect(page.locator('sw-app system-diagnostics system-design [data-skin-option="bubble"]')).toHaveCount(0);
        expect(errors).toEqual([]);
      });
    }
  }

  test('#/styleguide/bubble no longer renders the bubble demo; a stored bubble skin reads as domus without errors', async ({ page }) => {
    test.skip(BUBBLE_SCREENS_ENABLED, 'the bubble skin is not frozen any more');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/diagnostics');
    await page.evaluate(() => localStorage.setItem('sw.ui.design', JSON.stringify({ skin: 'bubble', scheme: 'dark' })));
    await open(page, '', '/styleguide/bubble');
    await expect(page.locator('html')).toHaveAttribute('data-skin', 'domus');
    await expect(page.locator('sw-app bubble-demo')).toHaveCount(0);
    await open(page, '', '/system/diagnostics');
    await expect(page.locator('html')).toHaveAttribute('data-skin', 'domus');
    await expect(page.locator('sw-app system-diagnostics system-look')).toHaveCount(0);
    expect(errors.filter((e) => !/favicon|Failed to load resource/i.test(e))).toEqual([]);
  });
});
