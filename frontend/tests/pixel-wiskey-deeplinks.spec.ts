import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { installStationsMock, newMock, openStations } from './wiskey-stations-mocks';

// WISKEY-DEEPLINKS-2382 pixel baselines: the deep links into the embedded intercom panel, opened - the list from the stations screen's
// page actions, and the station drawer's technical section with its links - classic light, desktop 1440 and phone 390, against the
// mocked backend (fixed clock, performance:full). Baselines are per OS, generated on the runner and reviewed image by image; until
// they exist the checks are skipped (annotated), never failed on a missing file.
//   run_smart.py linux-pixel <branch> tests/pixel-wiskey-deeplinks.spec.ts --project=desktop --project=mobile [--update-snapshots]
const SCREEN = 'sw-app wiskey-stations';

const noBaseline = (info: Pick<TestInfo, 'snapshotPath' | 'config'>, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function shoot(page: Page, info: TestInfo, name: string) {
  await settlePage(page);
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

async function ready(page: Page) {
  await installStationsMock(page, newMock());
  await openStations(page, { skin: 'classic', scheme: 'light' });
  await expect(page.locator(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible({ timeout: 30_000 });
  await settlePage(page);
}

test.describe('pixel: deep links into the intercom panel', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name === 'tablet', 'desktop and phone only'));

  test('classic is pixel-stable: the stations screen with its deep-link list open', async ({ page }, info) => {
    await ready(page);
    const host = page.locator(`${SCREEN} wk-deep-links[place="stations"]`);
    await host.locator('[data-wk-deeplinks-toggle]').click();
    await expect(host.locator('[data-wk-deeplinks-list]')).toBeVisible();
    await page.mouse.move(0, 0);
    await shoot(page, info, 'deeplinks-classic-stations-menu');
  });

  test('classic is pixel-stable: the station drawer with the technical links open', async ({ page }, info) => {
    await ready(page);
    await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="gate"] button.open`).click();
    await expect(page.locator(`${SCREEN} sw-drawer[data-wk-drawer]`)).toHaveAttribute('open', '');
    const host = page.locator(`${SCREEN} sw-drawer[data-wk-drawer] wk-deep-links[place="station"]`);
    await host.locator('[data-wk-deeplinks-toggle]').click();
    await expect(host.locator('[data-wk-deeplinks-list]')).toBeVisible();
    await host.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await shoot(page, info, 'deeplinks-classic-drawer');
  });
});
