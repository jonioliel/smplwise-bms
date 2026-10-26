import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lobbyFeed, serveFeed, settled, tvUrl } from './notice-tv-fixtures';
import { columns, digest, screen, serveTransit } from './bustimes-fixtures';

// BUSTIMES-295: pixel baselines of the bus-times layouts on the product TV page (side / strip / slide x day / night, landscape and portrait).
// THE BASELINES ARE GENERATED ON THE RUNNER ONLY (never on a workstation: fonts and anti-aliasing differ):
//   npx playwright test tests/pixel-bustimes-295.spec.ts --project=desktop --update-snapshots
// Until the baselines exist this spec skips itself, so a gate does not fail on a missing image; after the first generation it compares for real.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAPS = path.resolve(HERE, 'pixel-bustimes-295.spec.ts-snapshots');
const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop', 'one pixel set, desktop Chromium');
  test.skip(!fs.existsSync(SNAPS) && test.info().config.updateSnapshots === 'none', 'no baselines yet: generate them on the runner with --update-snapshots');
});

async function shot(page: Page, layout: 'side' | 'strip' | 'slide', theme: 'day' | 'night', w: number, h: number, extra = {}) {
  await page.setViewportSize({ width: w, height: h });
  await serveFeed(page, lobbyFeed({ theme, transit: screen({ layout }) }));
  await serveTransit(page, digest({ layout, nstops: layout === 'slide' ? 3 : 1, multi: layout === 'slide', columns: layout === 'slide' ? columns(3) : undefined, ...extra }));
  await page.goto(new URL(tvUrl(), base()).toString());
  await settled(page);
  if (layout === 'slide') {
    await page.evaluate(() => window.postMessage({ smplwise: 'tv', cmd: 'prev' }, location.origin));
    await page.waitForTimeout(1300);
  }
}

for (const layout of ['side', 'strip', 'slide'] as const) {
  for (const theme of ['day', 'night'] as const) {
    test(`bus times ${layout} ${theme} 1920x1080`, async ({ page }) => {
      await shot(page, layout, theme, 1920, 1080);
      await expect(page).toHaveScreenshot(`bus-${layout}-${theme}-1920.png`, { maxDiffPixelRatio: 0.005, animations: 'disabled' });
    });
  }
  test(`bus times ${layout} night portrait`, async ({ page }) => {
    await shot(page, layout, 'night', 1080, 1920);
    await expect(page).toHaveScreenshot(`bus-${layout}-night-portrait.png`, { maxDiffPixelRatio: 0.005, animations: 'disabled' });
  });
}

test('bus times states: cached (side), expired (side), no buses (strip)', async ({ page }) => {
  await shot(page, 'side', 'day', 1920, 1080, { state: 'cached', updated_hm: '08:53', age_s: 900 });
  await expect(page).toHaveScreenshot('bus-side-cached-day.png', { maxDiffPixelRatio: 0.005, animations: 'disabled' });
  await shot(page, 'side', 'night', 1920, 1080, { state: 'expired', items: [], overflow: 0, age_s: 4000 });
  await expect(page).toHaveScreenshot('bus-side-expired-night.png', { maxDiffPixelRatio: 0.005, animations: 'disabled' });
  await shot(page, 'strip', 'day', 1920, 1080, { items: [], overflow: 0, window_min: 30, next: { line: '28', dest: 'קניון השרון', stop: 33323, at: '2026-10-23T08:30:00Z', hm: '11:30', mins: 138 } });
  await expect(page).toHaveScreenshot('bus-strip-empty-day.png', { maxDiffPixelRatio: 0.005, animations: 'disabled' });
});
