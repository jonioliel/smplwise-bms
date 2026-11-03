import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { installStationsMock, newMock, openStations } from './wiskey-stations-mocks';
import { installStationMediaMock, newMediaMock, type StationMediaMock } from './wiskey-station-media-mocks';

// WISKEY-TALK-DIAL-2382 pixel baselines: the drawer's "חיוג לעמדה" in its states - talk available (idle, and in a call with the duration and
// hang up), the source is Arx's own (why not + the classic panel), the signed pairing missing - classic skin, desktop 1440 and phone 390,
// against the mocked backend. The moving live picture is masked. Baselines are written on the runner (-u) and reviewed image by image;
// until they exist the checks are skipped (annotated), never failed on a missing file.
//   run_smart.py preview <branch> tests/pixel-wiskey-talk-dial-2382.spec.ts --project=desktop --project=mobile --workers=1 [-u]
const SCREEN = 'wiskey-stations';

const noBaseline = (info: Pick<TestInfo, 'snapshotPath' | 'config'>, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));
const player = (page: Page) => page.locator(`${SCREEN} sw-drawer wk-station-live sw-live-player`);
const call = (page: Page) => page.locator(`${SCREEN} sw-drawer[data-wk-drawer] [data-wk-dsec="call"]`);

async function toDrawer(page: Page, over: Partial<StationMediaMock> = {}, station = 'lobby') {
  const base = newMock();
  await installStationsMock(page, base);
  await installStationMediaMock(page, base, newMediaMock({ mode: 'video_talk', ...over }));
  await openStations(page, { skin: 'classic', scheme: 'light' });
  await page.waitForSelector(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`, { timeout: 30_000 });
  await settlePage(page);
  await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="${station}"] button.open`).click();
  await expect(page.locator(`${SCREEN} sw-drawer[data-wk-drawer]`)).toHaveAttribute('open', '');
  await call(page).scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
}

async function shoot(page: Page, info: TestInfo, name: string) {
  await settlePage(page);
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(call(page)).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled', mask: [player(page)] });
}

test.describe('pixel: dial the station from the drawer', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name === 'tablet', 'desktop and phone only'));

  test('classic is pixel-stable: dial idle and in a call', async ({ page }, info) => {
    await toDrawer(page);
    const btn = call(page).locator('wk-talk-button[data-wk-dial="native"] [data-wk-ptt]');
    await expect(btn).toHaveAttribute('data-phase', 'idle');
    await shoot(page, info, 'talk-dial-classic-idle');
    await btn.click();
    await expect(btn).toHaveAttribute('data-phase', 'talking', { timeout: 10_000 });
    await shoot(page, info, 'talk-dial-classic-in-call');
  });

  test('classic is pixel-stable: provider local and pairing missing', async ({ page }, info) => {
    await toDrawer(page, { talkReason: 'provider_local' });
    await expect(call(page).locator('[data-wk-dial="reason"]')).toHaveAttribute('data-reason', 'provider_local');
    await shoot(page, info, 'talk-dial-classic-provider-local');
    await page.goto('about:blank');
    await toDrawer(page, { talkReason: 'pairing' });
    await expect(call(page).locator('[data-wk-dial="reason"]')).toHaveAttribute('data-reason', 'pairing');
    await shoot(page, info, 'talk-dial-classic-pairing');
  });
});
