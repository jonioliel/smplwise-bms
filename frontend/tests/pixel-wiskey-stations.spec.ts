import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { pixelTitle, skinCheck } from './helpers/pixel-skins';
import { settlePage } from './pixel-settle';
import { installStationsMock, newMock, openStations, type StationsMock } from './wiskey-stations-mocks';

// CR-036 slice S6 pixel baselines: the native stations and doors screen's new states, desktop 1440 and phone 390, against the mocked
// backend (invented stations, drawn stills, fixed clock, performance:full). The cards and the station's drawer in every skin the build
// has; the list, the table, the release confirmation, the announcement composer, a last-known copy, the empty and the forbidden state
// and the places sheet in the default skin. Baselines are per OS (fonts and text shaping differ): the Linux ones are generated on the
// runner with `--update-snapshots`; on an OS without a baseline the check is skipped instead of failing on a missing file (the
// design-foundation rule).
//   run_smart.py linux-pixel <branch> tests/pixel-wiskey-stations.spec.ts --project=desktop --project=mobile [--update-snapshots]
const SCREEN = 'wiskey-stations';

/** `--update-snapshots` is "changed" by default in this Playwright ("all" when spelled out): both write the baseline. */
const noBaseline = (info: Pick<TestInfo, 'snapshotPath' | 'config'>, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function toScreen(page: Page, skin: string, over: Partial<StationsMock> = {}) {
  await installStationsMock(page, newMock(over));
  await openStations(page, { skin, scheme: 'light' });
  await page.waitForSelector(`${SCREEN} [data-wk-stations]`, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
}

const readyCards = async (page: Page) => {
  await expect(page.locator(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible();
  await expect(page.locator(`${SCREEN} [data-wk-still] img`).first()).toBeVisible();
};

async function shoot(page: Page, info: TestInfo, name: string) {
  await settlePage(page);
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

test.describe('pixel: the stations and doors screen', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  for (const skin of SKIN_IDS) {
    // "pixel-stable" in the title: the release gate runs its pixel group with --grep pixel-stable (a title without it ran zero tests)
    // GATELANES-297: pixels for the skins in helpers/pixel-skins.ts (classic, domus), the structural smoke for the others
    test(pixelTitle(skin, "the station cards and a station's drawer"), async ({ page }, info) => {
      test.skip(info.project.name === 'tablet', 'desktop and phone only');
      const check = skinCheck(page, skin);
      await toScreen(page, skin);
      await readyCards(page);
      await check(() => shoot(page, info, `stations-${skin}-cards`), `${SCREEN} [data-wk-stations][data-wk-state="ready"]`);
      await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="gate"] button.open`).click();
      await expect(page.locator(`${SCREEN} sw-drawer[data-wk-drawer]`)).toHaveAttribute('open', '');
      await expect(page.locator(`${SCREEN} sw-drawer [data-wk-live] img`)).toBeVisible();
      await check(() => shoot(page, info, `stations-${skin}-drawer`), `${SCREEN} sw-drawer [data-wk-live] img`);
    });
  }

  test('classic is pixel-stable: list, table, and the door settings of a station', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    await toScreen(page, 'classic');
    await readyCards(page);
    await page.locator(`${SCREEN} sw-view-switch button[data-view="list"]`).click();
    await expect(page.locator(`${SCREEN} [data-wk-rows] [data-wk-station]`)).toHaveCount(6);
    await shoot(page, info, 'stations-classic-list');
    if (info.project.name !== 'mobile') {
      await page.locator(`${SCREEN} sw-view-switch button[data-view="table"]`).click();
      await expect(page.locator(`${SCREEN} sw-table[data-wk-table] tbody tr`)).toHaveCount(6);
      await shoot(page, info, 'stations-classic-table');
    }
    await page.locator(`${SCREEN} sw-view-switch button[data-view="cards"]`).click();
    await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="lobby"] button.open`).click();
    await page.locator(`${SCREEN} sw-drawer [data-wk-settings-toggle]`).click();
    await expect(page.locator(`${SCREEN} sw-drawer [data-wk-codes]`)).toBeVisible();
    await page.locator(`${SCREEN} sw-drawer [data-wk-dsec="settings"]`).scrollIntoViewIfNeeded();
    await shoot(page, info, 'stations-classic-settings');
  });

  test('classic is pixel-stable: the release confirmation, and the sent result', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    await toScreen(page, 'classic');
    await readyCards(page);
    await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="lobby"] [data-wk-door="lobby/1"]`).click();
    await expect(page.locator(`${SCREEN} sw-dialog[data-wk-release-dialog]`)).toHaveAttribute('open', '');
    await shoot(page, info, 'stations-classic-release');
    await page.locator(`${SCREEN} [data-wk-release-confirm]`).click();
    await expect(page.locator(`${SCREEN} [data-wk-grid] [data-wk-result="lobby"]`)).toContainText('פתיחה נשלחה');
    await shoot(page, info, 'stations-classic-sent');
  });

  test('classic is pixel-stable: the announcement composer and its outcome', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    await toScreen(page, 'classic');
    await readyCards(page);
    await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="lobby"] [data-wk-announce-at="lobby"]`).click();
    const dlg = page.locator(`${SCREEN} wk-announce-dialog`);
    await dlg.locator('[data-wk-phrase]').first().click();
    await expect(dlg.locator('[data-wk-announce-send]')).not.toHaveAttribute('disabled', '');
    await shoot(page, info, 'stations-classic-announce');
    await dlg.locator('[data-wk-announce-send]').click();
    await expect(dlg.locator('[data-wk-announce-result]')).toContainText('ההכרזה נשלחה');
    await shoot(page, info, 'stations-classic-announce-sent');
  });

  test('classic is pixel-stable: a last-known copy, an empty installation, a refused read', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    await toScreen(page, 'classic', { feed: 'stale' });
    await readyCards(page);
    await shoot(page, info, 'stations-classic-stale');
    await page.goto('about:blank');
    await toScreen(page, 'classic', { stations: [] });
    await expect(page.locator(`${SCREEN} [data-wk-panel="empty"]`)).toBeVisible();
    await shoot(page, info, 'stations-classic-empty');
    await page.goto('about:blank');
    await toScreen(page, 'classic', { stationsStatus: 403 });
    await expect(page.locator(`${SCREEN} [data-wk-panel="forbidden"]`)).toBeVisible();
    await shoot(page, info, 'stations-classic-forbidden');
  });

  test('classic is pixel-stable: the places sheet of a phone', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'the phone replaces the tree with a sheet');
    await toScreen(page, 'classic');
    await readyCards(page);
    await page.locator(`${SCREEN} [data-wk-places-chip]`).click();
    await expect(page.locator(`${SCREEN} sw-drawer[data-wk-places-sheet]`)).toHaveAttribute('open', '');
    await shoot(page, info, 'stations-classic-places');
  });
});
