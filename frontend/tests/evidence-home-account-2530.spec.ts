import { expect, test, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockAccount } from './home-account-mocks';

// HOME-T120-REST-2530: before / after captures for the owner's compare page (SW_SHOTS=1 only; never part of a gate run). The same mocked
// home-only resident at 1440x900 and 390x844, light and dark: the personal menu, and - where the build has it - "החשבון שלי" on each
// tab. On a build without the account row only the menu is captured (the "before").
const DIR = process.env.SW_SHOT_DIR || 'test-results/home-account-2530-shots';
const NOW = new Date('2026-11-03T10:00:00+02:00');
const home = (page: Page) => page.locator('sw-home');

async function open(page: Page, scheme: 'light' | 'dark') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockAccount(page, { now: NOW.getTime() });
  const layout = { welcomed: true, theme: scheme === 'dark' ? 'midnight' : 'classic', scheme };
  await page.route('**/api/v1/home/prefs', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ favourites: {}, layout, seed: {} }) }));
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto('/#/home/r/home');
  await home(page).waitFor();
  await expect.poll(() => page.evaluate(() => document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.getAttribute('data-hs-scheme'))).toBe(scheme);
  await settle(page);
}

test.describe('evidence: home my account (SW_SHOTS)', () => {
  test.skip(process.env.SW_SHOTS !== '1', 'captures for the compare page only');
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sizes are set per test'));

  for (const size of [{ id: 'desktop', width: 1440, height: 900 }, { id: 'phone', width: 390, height: 844 }]) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${size.id} ${scheme}`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await open(page, scheme);
        await home(page).locator('[data-act="menu"]').click();
        await settle(page);
        await page.screenshot({ path: `${DIR}/menu-${size.id}-${scheme}.png` });
        const row = home(page).locator('[data-home-account]');
        if (!(await row.count())) return; // the "before" build
        await row.click();
        for (const tab of ['security', 'sessions', 'lang']) {
          await home(page).locator(`[data-sheet="account"] sw-segmented button[data-v="${tab}"]`).click();
          await expect(home(page).locator(`[data-acc-tab="${tab}"]`)).toBeVisible();
          if (tab === 'security') await expect(home(page).locator('sw-account-security [data-sec-overview]')).toBeVisible();
          await settle(page);
          await page.screenshot({ path: `${DIR}/account-${tab}-${size.id}-${scheme}.png` });
        }
      });
    }
  }
});
