import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle } from './helpers/settle';
import { mockHonestArea, openBuilding } from './area-honest-count-2540-mocks';

// AREA-HONEST-COUNT-2540 pixel baselines (titles carry `pixel-stable`: the gate's pixel shard runs only those): the building screen's
// floor card with the area rows' lock and alarm indicators - an offline lock as a grey "לא ידוע" apart from the warm unlocked count, an
// unavailable panel grey - desktop 1440 and phone 390, light and dark, domus (the default skin), mocked backend, a fixed clock.
// Baselines are per OS: the Linux ones are generated on the runner with `--update-snapshots`; on an OS without a baseline the check is
// skipped, not failed. Same raster rules as pixel-honest-states-2540 (grayscale text, fonts loaded first).
test.use({ launchOptions: { args: ['--disable-lcd-text'] } });

const NOW = new Date('2026-11-26T10:00:00+02:00');

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, scheme: 'light' | 'dark') {
  await page.clock.setFixedTime(NOW);
  await mockHonestArea(page, { scheme });
  await openBuilding(page, scheme);
  await page.evaluate(async () => { await Promise.all(['400', '500', '600', '700'].map((w) => document.fonts.load(`${w} 16px Heebo`, 'אבג abc 123'))); await document.fonts.ready; });
  await settle(page);
}

test.describe('pixel: the area row with unknown locks / alarm (full interface)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`pixel-stable: floor card area rows with an offline lock and an unavailable alarm ${scheme}`, async ({ page }, info) => {
      await open(page, scheme);
      const card = page.locator('sw-app devices-building section[data-floor-card="ahc_g"]');
      await expect(card.locator('a.arow[data-area-row="ahc_entry"] [data-ind="locks"][data-ind-unknown]')).toHaveText('1 לא ידוע');
      const file = `area-honest-rows-${scheme}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
      if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
      else await expect(card).toHaveScreenshot(file, { maxDiffPixels: 250, animations: 'disabled', caret: 'hide', timeout: 15_000 });
    });
  }
});
