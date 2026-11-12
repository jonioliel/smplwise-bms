import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { PIXEL_SKINS, pixelTitle, skinCheck } from './helpers/pixel-skins';

// AUDIT30-G-VIDEO (design audit round 30, branch G): pixel baselines of the screens this branch reshaped, demo mode (invented data,
// a fixed clock, performance:full):
//   - camera health (#/investigate/health): the recorder facts moved to a drawer, measured values in the product face;
//   - the live event list (#/investigate/incidents): the sw-page frame and the shared filled badges.
// Baselines are per OS; the Linux ones are taken on the runner with `--update-snapshots`, an OS without a baseline skips the compare.
//   run_smart.py preview <branch> tests/pixel-audit30g-video.spec.ts --project=desktop --project=mobile [-u]

const FIXED = new Date('2026-11-12T08:40:00Z');

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function compare(page: Page, info: Parameters<typeof noBaseline>[0], file: string) {
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

async function open(page: Page, hash: string, skin: string, scheme: 'light' | 'dark', ready: string) {
  await page.clock.setFixedTime(FIXED);
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector(ready, { timeout: 30_000 });
  await settlePage(page);
}

const width = (name: string) => (name === 'mobile' ? '390' : '1440');

test.describe('AUDIT30-G-VIDEO', () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and the phone');
  });

  for (const skin of PIXEL_SKINS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(pixelTitle(skin, `camera health, demo cameras (${scheme})`), async ({ page }, info) => {
        const check = skinCheck(page, skin);
        await open(page, '/investigate/health', skin, scheme, 'sw-app system-devices sw-table');
        await check(() => compare(page, info, `health-${skin}-${scheme}-${width(info.project.name)}.png`), 'sw-app system-devices');
      });

      test(pixelTitle(skin, `live event list (${scheme})`), async ({ page }, info) => {
        const check = skinCheck(page, skin);
        await open(page, '/investigate/incidents', skin, scheme, 'sw-app investigate-incidents [data-incidents-list]');
        await check(() => compare(page, info, `incidents-${skin}-${scheme}-${width(info.project.name)}.png`), 'sw-app investigate-incidents');
      });
    }
  }
});
