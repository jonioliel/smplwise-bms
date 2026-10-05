import { test, expect, type Page } from '@playwright/test';
import { mock, openAndPlay } from './playback-stall-mock';

// CMP3 (owner decisions 2026-10-05): (1) the camera picker's foot ("נקה" / "סיום") is part of the phone variant too: 44 px targets and no
// horizontal overflow at 320 and 390; (2) the search dial (ui.dd_search -> data-dd-search) applies to the camera pickers only
// (`camera-picker`); any other dropdown keeps the fixed rule (search from 8 options). Every project (desktop / tablet / mobile).
const MORE = [{ name: 'מחסן' }, { name: 'לובי' }, { name: 'מעלית' }];
const pick = (page: Page) => page.locator('investigate-playback sw-dropdown[data-compare-pick]');

async function open(page: Page) {
  await mock(page, { cameras: MORE });
  await openAndPlay(page, '');
}
const setDial = (page: Page, v: string) => page.evaluate((x) => document.documentElement.setAttribute('data-dd-search', x), v);

test.describe('CMP3: the camera picker', () => {
  for (const w of [320, 390]) {
    test(`phone foot at ${w} px: both buttons are 44 px targets and nothing overflows`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'phone widths');
      await page.setViewportSize({ width: w, height: 800 });
      await open(page);
      await pick(page).locator('.chip').click();
      const foot = pick(page).locator('[data-dd-foot]');
      await expect(foot).toBeVisible();
      for (const sel of ['[data-dd-clear]', '[data-dd-done]']) {
        const b = (await foot.locator(sel).boundingBox())!;
        expect(b.height).toBeGreaterThanOrEqual(43.5);
        expect(b.width).toBeGreaterThanOrEqual(43.5);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(w + 0.5);
      }
      const fb = (await foot.boundingBox())!;
      expect(fb.x).toBeGreaterThanOrEqual(-0.5);
      expect(fb.x + fb.width).toBeLessThanOrEqual(w + 0.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`foot-${w}.png`) });
    });
  }

  test('the search dial moves the camera picker but not another dropdown', async ({ page }) => {
    await open(page);
    // a plain 5-option dropdown beside the page, dial "always": no search (the fixed rule is 8)
    await page.evaluate(() => {
      const d = document.createElement('sw-dropdown') as HTMLElement & { items: unknown; label: string };
      d.id = 'plain';
      d.label = 'רגיל';
      d.items = [1, 2, 3, 4, 5].map((n) => ({ id: `p${n}`, label: `אפשרות ${n}` }));
      document.body.appendChild(d);
    });
    await setDial(page, 'always');
    const plain = page.locator('#plain');
    await plain.locator('.chip').click();
    await expect(plain.locator('[role=option]')).toHaveCount(5);
    await expect(plain.locator('[data-dd-search]')).toHaveCount(0);
    await plain.locator('.chip').click();
    // the camera picker follows the dial: "never" hides, "always" shows
    await pick(page).locator('.chip').click();
    await expect(pick(page).locator('[data-dd-search]')).toBeVisible();
    await pick(page).locator('.chip').click();
    await setDial(page, 'never');
    await pick(page).locator('.chip').click();
    await expect(pick(page).locator('[data-dd-search]')).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('dial.png') });
  });
});
