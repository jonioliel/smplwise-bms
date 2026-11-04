import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { installTriageMock, openTriage, PANEL } from './wiskey-triage-mocks';

// WISKEY-CONFLICTS-2400 pixel baselines: the conflicts and fleet alerts screen - the conflicts list, the review drawer with its impact, and
// the alerts tab with the snooze dialog - classic light, desktop 1440 and phone 390, against the mocked backend (fixed clock,
// performance:full). Baselines are per OS, generated on the runner and reviewed image by image; until they exist the checks are skipped
// (annotated), never failed on a missing file.
//   run_smart.py preview <branch> tests/pixel-wiskey-triage-2400.spec.ts --project=desktop --project=mobile [--update-snapshots=changed]
const noBaseline = (info: Pick<TestInfo, 'snapshotPath' | 'config'>, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function shoot(page: Page, info: TestInfo, name: string) {
  await page.mouse.move(0, 0);
  await settlePage(page);
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

async function ready(page: Page, hash: string) {
  await installTriageMock(page, {});
  await openTriage(page, hash, { look: 'performance:full' });
  await expect(page.locator(`${PANEL} [data-wkt-panel="full"]`)).toBeVisible({ timeout: 30_000 });
  await settlePage(page);
}

test.describe('pixel: WisKey conflicts and fleet alerts', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name === 'tablet', 'desktop and phone only'));

  test('classic is pixel-stable: the conflicts list', async ({ page }, info) => {
    await ready(page, '/wiskey/conflicts');
    await expect(page.locator(`${PANEL} [data-wkt-conflict]`)).toHaveCount(3);
    await shoot(page, info, 'triage-classic-conflicts');
  });

  test('classic is pixel-stable: the review drawer with the impact', async ({ page }, info) => {
    await ready(page, '/wiskey/conflicts');
    await page.locator(`${PANEL} [data-wkt-conflict="entry-c:u7"] [data-wkt-review]`).click();
    await expect(page.locator(`${PANEL} sw-drawer[data-wkt-drawer] [data-wkt-compare]`)).toBeVisible();
    await shoot(page, info, 'triage-classic-review');
  });

  test('classic is pixel-stable: the alerts tab with the snooze dialog', async ({ page }, info) => {
    await ready(page, '/wiskey/alerts');
    await page.locator(`${PANEL} [data-wkt-alert="entry-c/offline"] [data-wkt-snooze]`).click();
    await expect(page.locator(`${PANEL} sw-dialog[data-wkt-alert-dialog]`)).toHaveAttribute('open', '');
    await shoot(page, info, 'triage-classic-alerts-snooze');
  });
});
