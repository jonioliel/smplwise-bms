import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { installAccessMock, NOW, SKINS } from './access-control-mocks';
import { installWiskeyStatusMock, type WkMode } from './wiskey-system-status-mock';
import { settlePage } from './pixel-settle';
import { pixelTitle, skinCheck } from './helpers/pixel-skins';

// WISKEY-STATUS-UI-2520 pixel baselines: the segment "מערכת האינטרקום" of the Settings page "בקרת כניסה" (#/system/access-control/wiskey) -
// ready in every pixel skin, and in the classic skin the lab's case (WisKey rc10 lists neither read), WisKey's refusal of the jobs read
// and the empty answer - desktop 1440 and phone 390, against the mocked backend (fixed clock, performance:full). Linux baselines are made on
// the runner with --update-snapshots; on an OS without a baseline the compare is skipped (the design-foundation rule).
//   ~/run_remote.sh spec <branch> tests/pixel-access-wiskey-status-2520.spec.ts --project=desktop --project=mobile [--update-snapshots]
const WK = 'sw-app system-access-control system-access-wiskey';
const HOME = '/system/access-control/wiskey';

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, skin: string, modes: { system?: WkMode; jobs?: WkMode }, ready: string) {
  await installAccessMock(page, {});
  await installWiskeyStatusMock(page, modes);
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=light#${HOME}`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector(ready, { timeout: 30_000 });
  await settlePage(page);
}

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, name: string, full = false) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled', fullPage: full });
}

const READY = `${WK} sw-table[data-wk-jobs]`;

test.describe('pixel: the segment "מערכת האינטרקום"', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const skin of SKINS) {
    test(pixelTitle(skin, 'the WisKey system status, ready'), async ({ page }, info) => {
      const check = skinCheck(page, skin);
      await open(page, skin, {}, READY);
      await check(() => compare(page, info, `wkstatus-${skin}-ready`, true), READY);
    });
  }

  test('classic is pixel-stable: rc10 lists neither read, WisKey refuses the jobs read, the empty answer', async ({ page }, info) => {
    await open(page, 'classic', { system: 'unsupported', jobs: 'unsupported' }, `${WK} sw-state-panel[data-wk-read="jobs"]`);
    await compare(page, info, 'wkstatus-classic-rc10');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, 'classic', { system: 'ready', jobs: 'refused' }, `${WK} sw-state-panel[data-wk-state="refused"]`);
    await page.locator(`${WK} [data-wk-card="jobs"]`).scrollIntoViewIfNeeded();
    await settlePage(page);
    await compare(page, info, 'wkstatus-classic-refused');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, 'classic', { system: 'empty', jobs: 'empty' }, `${WK} [data-wk-jobs-empty]`);
    await compare(page, info, 'wkstatus-classic-empty', true);
  });
});
