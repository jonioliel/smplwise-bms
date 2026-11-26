import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settle } from './helpers/settle';
import { mountPlayer, openPage, playerError } from './player-error-text-2530-harness';

// PLAYER-ERROR-TEXT-2530 pixel baselines: the player's error state for the relay's `upstream_error` (a live camera tile that does not
// retry by itself: the sentence and its "try again" hint), desktop (a 480 px tile) and phone (a 360 px tile), light and dark. Before
// this row the same state read "שגיאת זרם: upstream_error". Baselines are per OS: the Linux ones are generated on the runner with
// `--update-snapshots`; on an OS without a baseline the check is skipped, not failed.
//   npx playwright test tests/pixel-player-error-text-2530.spec.ts --project=desktop --project=mobile -u --workers=1

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, id: string, name: string) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  await settle(page);
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page.locator(`#${id}`)).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled', caret: 'hide', timeout: 15_000 });
}

test.describe('pixel-stable: the player error state of a relay error code', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`live tile, upstream_error ${scheme}`, async ({ page }, info) => {
      await openPage(page, { scheme });
      await mountPlayer(page, 'probe', { cameraId: 'probe-cam', mode: 'mse', retry: false }, info.project.name === 'mobile');
      await playerError(page, 'probe');
      await expect(page.locator('#probe [data-stream-error-hint]')).toBeVisible();
      await compare(page, info, 'probe', `player-error-upstream-${scheme}`);
    });
  }
});
