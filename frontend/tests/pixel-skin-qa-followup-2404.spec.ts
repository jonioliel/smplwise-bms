import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { openWall, tagFacts } from './helpers/skin-qa-wall';
import { FOLDS, installCardsMock, openAccess } from './settings-cards-mocks';
import { settlePage } from './pixel-settle';

// SKIN-QA-FOLLOWUP-2404 pixel baselines: the "moved to the main stream" CHIP on a narrow remote tile (a phone wall of three columns at
// 390 px: the profile badge on top, the camera's name and the chip on the bottom row), as an element image of the tile. The video is the
// fake media's still grey ('still' mode, tests/live-fake-media.ts), so the picture under the scrim does not move. Classic light (the
// default), crystal dark and domus dark (the glass skins at night). Titles carry "pixel-stable" (the gate's pixel lane).
// Baselines are per OS: the Linux ones are generated on the runner with --update-snapshots, looked at, then committed; on an OS without a
// baseline the check is skipped instead of failing on a missing file.
//   ~/run_remote.sh preview <branch> tests/pixel-skin-qa-followup-2404.spec.ts --project=mobile [--update-snapshots]

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

test.describe('pixel: SKIN-QA-FOLLOWUP-2404', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  for (const [skin, scheme] of [['classic', 'light'], ['crystal', 'dark'], ['domus', 'dark']] as const) {
    test(`${skin} ${scheme} is pixel-stable: the fallback chip on a three-column remote tile`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'the phone');
      const file = `chip-3col-${skin}-${scheme}-390.png`;
      if (noBaseline(info, file)) {
        info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
        test.skip(true, `${file}: no baseline on ${process.platform}`);
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openWall(page, skin, scheme, { cols: 3, channel: 'remote', still: true });
      await tagFacts(page, 'c1');
      const tile = page.locator('live-wall sw-camera-tile[data-cam="c1"]');
      await expect(tile.locator('sw-live-player')).toHaveAttribute('data-subchip', '');
      await page.mouse.move(0, 0);
      await settlePage(page, { timeout: 8_000 }).catch(() => undefined);
      await expect(tile).toHaveScreenshot(file, { maxDiffPixels: 20, animations: 'disabled' });
    });
  }

  // Q5: the filled success badge (no existing baseline draws it): the pairing verdict "מצומד", classic light and dark, as an element image
  for (const scheme of ['light', 'dark'] as const) {
    test(`classic ${scheme} is pixel-stable: the filled success badge (the pairing verdict)`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'one size');
      const file = `badge-verdict-classic-${scheme}.png`;
      if (noBaseline(info, file)) {
        info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
        test.skip(true, `${file}: no baseline on ${process.platform}`);
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await installCardsMock(page);
      await openAccess(page, undefined, { scheme });
      await page.locator(`${FOLDS} [data-fold-toggle="pairing"]`).click({ timeout: 30_000 });
      const badge = page.locator('sw-app system-diagnostics system-wiskey-pairing sw-badge[data-wkp-verdict]');
      await expect(badge).toBeVisible({ timeout: 20_000 });
      await page.mouse.move(0, 0);
      await settlePage(page, { timeout: 8_000 }).catch(() => undefined);
      await expect(badge).toHaveScreenshot(file, { maxDiffPixels: 10, animations: 'disabled' });
    });
  }
});
