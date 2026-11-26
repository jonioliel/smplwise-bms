import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle } from './helpers/settle';
import { mockHonestHome } from './honest-states-2540-mocks';

// HONEST-STATES-2540 pixel baselines (titles carry `pixel-stable`: the gate's pixel shard runs only those): the home screen's category
// chips and the doors list with an offline lock, a lock in an unknown state and an unavailable alarm panel (neutral "unknown" /
// "not available", never an open door or "armed") - desktop 1440 and phone 390, light and dark, mocked backend, a fixed clock.
// Baselines are per OS: the Linux ones are generated on the runner with `--update-snapshots`; on an OS without a baseline the check is
// skipped, not failed. Same raster rules as pixel-home-account-2530 (grayscale text, fonts loaded first).
test.use({ launchOptions: { args: ['--disable-lcd-text'] } });

const NOW = new Date('2026-11-03T10:00:00+02:00');
const home = (page: Page) => page.locator('sw-home');

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, scheme: 'light' | 'dark', route: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await mockHonestHome(page, 'offline', { theme: scheme === 'dark' ? 'midnight' : 'classic', scheme });
  await page.goto(`/#/home/${route}`);
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

test.describe('pixel: home honest states (offline / unknown lock, unavailable alarm)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`pixel-stable: home chips with an offline lock and an unavailable alarm ${scheme}`, async ({ page }, info) => {
      await open(page, scheme, 'r/home');
      await expect(home(page).locator('.chip3[data-cat="security"]')).toContainText('לא זמין');
      await compare(page, info, 'nav.chips3', `honest-home-chips-${scheme}`);
    });

    test(`pixel-stable: doors list with an offline and an unknown lock ${scheme}`, async ({ page }, info) => {
      await open(page, scheme, 'doors');
      await expect(home(page).locator('.drow[data-fid="lock.gate"] .dst')).toContainText('לא ידוע');
      await compare(page, info, '.door-list', `honest-doors-${scheme}`);
    });
  }
});
