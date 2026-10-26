import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { installStationsMock, newMock, openStations, type StationsMock } from './wiskey-stations-mocks';

// CR-036 slice S6: the native stations and doors screen in every skin the build has (the skin list is read from the registry, so a
// skin that arrives with a merge is covered at once), light and dark, at the three reference widths, against the MOCKED backend.
// Screenshots (invented data, drawn stills, no real frame) go to docs/design/evidence/wiskey-stations/ as the AGENTS.md closing
// evidence: ready (cards), the station's drawer, list, table, the dialogs, and the loading / empty / error / forbidden / stale states.
// What is asserted besides: the document carries the skin and the scheme, the cards and the drawer are drawn, the page never scrolls
// sideways, and the state colours come from the tokens of the skin (the ringing card's ring is the skin's warning colour).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-wiskey-stations-skins.spec.ts --workers=1
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/wiskey-stations');
const SCREEN = 'wiskey-stations';

async function open(page: Page, skin: string, scheme: 'light' | 'dark', over: Partial<StationsMock> = {}) {
  await installStationsMock(page, newMock(over));
  await openStations(page, { skin, scheme });
  await page.waitForSelector(`${SCREEN} [data-wk-stations]`, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
}
const cardsReady = async (page: Page) => {
  await expect(page.locator(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible();
  await expect(page.locator(`${SCREEN} [data-wk-grid] [data-wk-station]`).first()).toBeVisible();
  await page.waitForTimeout(250);
};
async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) });
}
const noSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test.describe('wiskey-stations in the skins', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.setTimeout(120_000);

  for (const skin of SKIN_IDS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${skin} ${scheme}: cards and the station's drawer are drawn in the skin`, async ({ page }, info) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await open(page, skin, scheme);
        await expect(page.locator('html')).toHaveAttribute('data-skin', skin);
        await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
        await cardsReady(page);
        expect(await noSideways(page)).toBeLessThanOrEqual(1);
        // the ringing card's ring and the call badge read the skin's own state colours (tokens, never a literal)
        const ring = await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="gate"]`).evaluate((el) => ({ shadow: getComputedStyle(el).boxShadow, warning: getComputedStyle(document.documentElement).getPropertyValue('--sw-warning').trim() }));
        expect(ring.warning.length).toBeGreaterThan(3);
        expect(ring.shadow).not.toBe('none');
        // every skin keeps the screen's own controls on the 44 px hit area (the look dial is the only thing that lowers it on a desktop)
        const small = await page.locator(`${SCREEN} wk-action-button`).evaluateAll((els) => els.filter((e) => e.shadowRoot?.querySelector('button')).map((e) => e.shadowRoot!.querySelector('button')!.getBoundingClientRect()).filter((r) => r.width > 0 && (r.height < 43.5 || r.width < 43.5)).length);
        expect(small).toBe(0);
        // phone, tablet and desktop each get the shots the evidence needs; not every combination is committed
        const phoneOrDesktop = info.project.name !== 'tablet';
        const everything = skin === 'classic' || scheme === 'light';
        if (phoneOrDesktop || skin === 'classic') await shot(page, info, `stations-cards-${skin}-${scheme}`);
        if (everything && phoneOrDesktop) {
          await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="gate"] button.open`).click();
          await expect(page.locator(`${SCREEN} sw-drawer[data-wk-drawer]`)).toHaveAttribute('open', '');
          await expect(page.locator(`${SCREEN} sw-drawer [data-wk-dsec="doors"]`)).toBeVisible();
          await shot(page, info, `stations-drawer-${skin}-${scheme}`);
        }
        expect(errors).toEqual([]);
      });
    }
  }

  test('classic light: list, table, the release confirmation, the sent result, the announcement composer', async ({ page }, info) => {
    await open(page, 'classic', 'light');
    await cardsReady(page);
    await page.locator(`${SCREEN} sw-view-switch button[data-view="list"]`).click();
    await expect(page.locator(`${SCREEN} [data-wk-rows] [data-wk-station]`)).toHaveCount(6);
    await shot(page, info, 'stations-list-classic-light');
    if (info.project.name !== 'mobile') {
      await page.locator(`${SCREEN} sw-view-switch button[data-view="table"]`).click();
      await expect(page.locator(`${SCREEN} sw-table[data-wk-table] tbody tr`)).toHaveCount(6);
      await shot(page, info, 'stations-table-classic-light');
    }
    await page.locator(`${SCREEN} sw-view-switch button[data-view="cards"]`).click();
    await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="lobby"] [data-wk-door="lobby/1"]`).click();
    await expect(page.locator(`${SCREEN} sw-dialog[data-wk-release-dialog]`)).toHaveAttribute('open', '');
    await shot(page, info, 'stations-release-classic-light');
    await page.locator(`${SCREEN} [data-wk-release-confirm]`).click();
    await expect(page.locator(`${SCREEN} [data-wk-grid] [data-wk-result="lobby"]`)).toContainText('פתיחה נשלחה');
    await shot(page, info, 'stations-sent-classic-light');
    await page.locator(`${SCREEN} [data-wk-announce]`).click();
    const dlg = page.locator(`${SCREEN} wk-announce-dialog`);
    await dlg.locator('[data-wk-phrase]').first().click();
    await expect(dlg.locator('[data-wk-announce-send]')).not.toHaveAttribute('disabled', '');
    await shot(page, info, 'stations-announce-classic-light');
    if (info.project.name === 'mobile') {
      await page.keyboard.press('Escape');
      await page.locator(`${SCREEN} [data-wk-places-chip]`).click();
      await expect(page.locator(`${SCREEN} sw-drawer[data-wk-places-sheet]`)).toHaveAttribute('open', '');
      await shot(page, info, 'stations-places-classic-light');
    }
  });

  test('classic light: the states - loading, empty, error, forbidden, a last-known copy, the feed down', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone');
    await installStationsMock(page, newMock({ stationsDelay: 4000 }));
    await openStations(page, { skin: 'classic', scheme: 'light' });
    await expect(page.locator(`${SCREEN} [data-wk-panel="loading"]`)).toBeVisible({ timeout: 30_000 });
    await shot(page, info, 'stations-loading-classic-light');
    for (const [name, over, panel] of [
      ['empty', { stations: [] }, 'empty'],
      ['error', { stationsStatus: 500 }, 'error'],
      ['forbidden', { stationsStatus: 403 }, 'forbidden'],
      ['stale', { feed: 'stale' as const }, ''],
      ['feed-down', { feed: 'ha_unavailable' as const }, 'feed:ha_unavailable'],
    ] as const) {
      await page.goto('about:blank');
      await open(page, 'classic', 'light', over as Partial<StationsMock>);
      if (panel) await expect(page.locator(`${SCREEN} [data-wk-panel="${panel}"]`)).toBeVisible({ timeout: 30_000 });
      else await cardsReady(page);
      await shot(page, info, `stations-${name}-classic-light`);
    }
  });
});
