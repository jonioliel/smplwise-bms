import { test, expect, type Page } from '@playwright/test';

// CR-A11Y-ROWS-2443 (code review 2026-11-13, D14 / 06:A11Y-1): a keyboard-only pass over a clickable card that had no keyboard path.
// Demo data, no backend (npm run build first; the preview serves dist/). The source-level pass over all eight screens of the row is
// tests/unit-a11y-rows-2443.spec.ts; this spec proves the wiring in a real browser on the one screen whose demo data needs no mock.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-a11y-rows-2443.spec.ts --project=desktop

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
}

test.describe('keyboard-only: explore-sites cards', () => {
  for (const key of ['Enter', 'Space']) {
    test(`a site card is a tab stop and opens its first building on ${key}`, async ({ page }) => {
      test.skip(test.info().project.name !== 'desktop', 'one width is enough: the keyboard wiring does not change with the width');
      await open(page, '/explore/sites');
      const card = page.locator('explore-sites sw-card[data-site-card][role="link"]').first();
      await expect(card).toBeVisible({ timeout: 30000 });
      await expect(card).toHaveAttribute('tabindex', '0');
      await card.focus();
      await expect(card).toBeFocused();
      await page.keyboard.press(key);
      await expect.poll(() => page.evaluate(() => location.hash), { timeout: 15000 }).toMatch(/^#\/explore\/buildings\/[^/]+\/floors/);
    });
  }
});
