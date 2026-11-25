import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle } from './helpers/settle';
import { mockAccount } from './home-account-mocks';

// HOME-T120-REST-2530 pixel baselines (titles carry `pixel-stable`: the gate's pixel shard runs only those): the home interface's
// personal menu with the new "החשבון שלי" row, and the account sheet on its security tab - desktop 1440 and phone 390, light and dark,
// mocked backend, a fixed clock. Baselines are per OS: the Linux ones are generated on the runner with `--update-snapshots`; on an OS
// without a baseline the check is skipped, not failed. Same raster rules as pixel-home-gaps-2436 (grayscale text, fonts loaded first).
test.use({ launchOptions: { args: ['--disable-lcd-text'] } });

const NOW = new Date('2026-11-03T10:00:00+02:00');
const home = (page: Page) => page.locator('sw-home');

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, scheme: 'light' | 'dark') {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // the sheet's entry is drawn at rest
  await mockAccount(page, { now: NOW.getTime() });
  const layout = { welcomed: true, theme: scheme === 'dark' ? 'midnight' : 'classic', scheme };
  await page.route('**/api/v1/home/prefs', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ favourites: {}, layout, seed: {} }) }));
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto('/#/home/r/home');
  await home(page).waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await expect.poll(() => page.evaluate(() => document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.getAttribute('data-hs-scheme'))).toBe(scheme);
  await settle(page);
}

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, sel: string, name: string) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  await page.evaluate(async () => { await Promise.all(['400', '500', '600', '700'].map((w) => document.fonts.load(`${w} 16px Heebo`, 'אבג abc 123'))); await document.fonts.ready; });
  await settle(page);
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(home(page).locator(sel)).toHaveScreenshot(file, { maxDiffPixels: 250 /* the runner's two rasterisations of bold Hebrew (pixel-home-gaps-2436) */, animations: 'disabled', caret: 'hide', timeout: 15_000 });
}

test.describe('pixel: home my account (menu row, account sheet)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`pixel-stable: personal menu with my account ${scheme}`, async ({ page }, info) => {
      await open(page, scheme);
      await home(page).locator('[data-act="menu"]').click();
      await expect(home(page).locator('[data-home-account]')).toBeVisible();
      await compare(page, info, '.sheet.umenu', `home-account-menu-${scheme}`);
    });

    test(`pixel-stable: my account sheet, security ${scheme}`, async ({ page }, info) => {
      await open(page, scheme);
      await home(page).locator('[data-act="menu"]').click();
      await home(page).locator('[data-home-account]').click();
      await expect(home(page).locator('[data-sheet="account"] sw-account-security [data-sec-overview]')).toBeVisible();
      await expect(home(page).locator('[data-sheet="account"] sw-passkeys')).toContainText('הטלפון של נועה');
      await compare(page, info, '[data-sheet="account"]', `home-account-security-${scheme}`);
    });
  }
});
