import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { installStationsMock, newMock, openStations } from './wiskey-stations-mocks';
import { installWaterMock, waterUrl, type WaterMockOptions } from './wkwater-mocks';

// WKWATER-POLISH-2331: the evidence of the polish wave on the stations and doors screen and the seven water pages - against mocked
// backends only (tests/wiskey-stations-mocks.ts, tests/wkwater-mocks.ts: invented stations and meters, no device). Every project
// (desktop 1440, tablet 1024, phone 390); WKW_SIZES=1 adds 1920, 1180 and 1024-wide desktop shots. Screenshots land in
// docs/evidence/WKWATER-POLISH-2331/<WKW_PHASE or "after">/. What it pins besides the pictures:
//   - a control screen (the meters, the alerts, the usage list, the stations cards) never scrolls the page at a desktop / tablet size:
//     the document is no taller than the window;
//   - every page draws its ready state with the mocked data, and its empty / error state when the data says so.
//   $env:SW_BASE_URL='http://127.0.0.1:4206/'; npx playwright test tests/evidence-wkwater-2331.spec.ts --workers=2

const PHASE = process.env.WKW_PHASE || 'after';
const DIR = `../docs/evidence/WKWATER-POLISH-2331/${PHASE}`;
const phone = (info: TestInfo) => info.project.name === 'mobile';

async function shot(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450); // the R5 entrance (fade from a short rise) settles
  await page.screenshot({ path: `${DIR}/${name}-${info.project.name}.png` });
}

/** The page itself does not scroll: neither the document nor the shell's <main> (a list may scroll inside its own box). */
async function pageScroll(page: Page): Promise<number> {
  return page.evaluate(() => {
    const deep = (root: Document | ShadowRoot): number => {
      let worst = 0;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const e = el as HTMLElement;
        const st = getComputedStyle(e);
        if (e.tagName === 'MAIN' && /(auto|scroll)/.test(st.overflowY) && e.scrollHeight - e.clientHeight > 1) worst = Math.max(worst, e.scrollHeight - e.clientHeight);
        if (e.shadowRoot) worst = Math.max(worst, deep(e.shadowRoot));
      }
      return worst;
    };
    return Math.max(document.documentElement.scrollHeight - window.innerHeight, deep(document));
  });
}

async function water(page: Page, hash: string, opts: WaterMockOptions = {}) {
  await installWaterMock(page, opts);
  await page.goto('about:blank');
  await page.goto(waterUrl(hash));
  await page.waitForSelector('sw-app');
}

// the shared workstation runs many builds at once: a shot waits longer than the default 60 s test budget
test.describe.configure({ timeout: 300_000 });

const ready = (page: Page, name: string, state = 'ready') => expect(page.locator(`[data-water="${name}"][data-state="${state}"]`).first()).toBeVisible({ timeout: 90_000 });

test.describe('WKWATER-POLISH-2331: water pages', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('meters: table, cards, the meter card, the add dialog', async ({ page }, info) => {
    await water(page, '/infra/water/meters');
    await ready(page, 'meters');
    await shot(page, info, 'water-meters-table');
    if (!phone(info)) {
      expect(await pageScroll(page), 'the meters page fits the window').toBeLessThanOrEqual(2);
      await page.locator('[data-view="cards"]').first().click();
      await shot(page, info, 'water-meters-cards');
      await page.locator('[data-view="table"]').first().click();
    }
    await page.locator('[data-meter="w2"]').filter({ visible: true }).first().click();
    await expect(page.locator('water-meter-card')).toHaveCount(1);
    await shot(page, info, 'water-meter-card');
    await page.goto(waterUrl('/infra/water/meters?add=1'));
    await expect(page.locator('sw-dialog[data-add-dialog]')).toHaveCount(1, { timeout: 30_000 });
    await shot(page, info, 'water-meters-add');
  });

  test('usage: the four ranges view and the per-meter table', async ({ page }, info) => {
    await water(page, '/infra/water/usage');
    await ready(page, 'usage');
    await shot(page, info, 'water-usage');
    if (!phone(info)) expect(await pageScroll(page), 'the usage page fits the window').toBeLessThanOrEqual(2);
  });

  test('alerts: open and all', async ({ page }, info) => {
    await water(page, '/infra/water/alerts');
    await ready(page, 'alerts');
    await shot(page, info, 'water-alerts-open');
    await page.locator('[data-alert-filter] [data-f="all"]').click();
    await shot(page, info, 'water-alerts-all');
    if (!phone(info)) expect(await pageScroll(page), 'the alerts page fits the window').toBeLessThanOrEqual(2);
  });

  test('accounts: list, one account, its history, the form', async ({ page }, info) => {
    await water(page, '/infra/water/accounts');
    await ready(page, 'accounts');
    await shot(page, info, 'water-accounts');
    await page.goto(waterUrl('/infra/water/accounts/ac1'));
    await ready(page, 'account');
    await shot(page, info, 'water-account');
    await page.goto(waterUrl('/infra/water/accounts/ac1/history'));
    await expect(page.locator('[data-acc-history]')).toBeVisible({ timeout: 30_000 });
    await shot(page, info, 'water-account-history');
    await page.goto(waterUrl('/infra/water/accounts/ac4/edit'));
    await expect(page.locator('sw-sheet[data-account-form]')).toHaveCount(1, { timeout: 30_000 });
    await shot(page, info, 'water-account-form');
  });

  test('bills: list and one bill', async ({ page }, info) => {
    await water(page, '/infra/water/bills');
    await ready(page, 'bills');
    await shot(page, info, 'water-bills');
    await page.goto(waterUrl('/infra/water/bills/b1'));
    await ready(page, 'bill');
    await shot(page, info, 'water-bill');
  });

  test('customers: list and the customer card', async ({ page }, info) => {
    await water(page, '/infra/water/customers');
    await ready(page, 'customers');
    await shot(page, info, 'water-customers');
    await page.goto(waterUrl('/infra/water/customers/c1'));
    await expect(page.locator('sw-sheet[data-customer-card]')).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator('[data-customer-accounts]')).toBeVisible();
    await shot(page, info, 'water-customer-card');
  });

  test('settings: tariffs and alerts', async ({ page }, info) => {
    await water(page, '/infra/water/settings?set=prices');
    await expect(page.locator('[data-tariff="t1"]')).toBeVisible({ timeout: 30_000 });
    await shot(page, info, 'water-settings-prices');
    await page.locator('[data-set="alerts"]').click();
    await expect(page.locator('[data-card="snooze"]')).toBeVisible();
    await shot(page, info, 'water-settings-alerts');
  });

  test('states: empty, error, loading, forbidden', async ({ page }, info) => {
    await water(page, '/infra/water/meters', { data: 'empty' });
    await ready(page, 'meters', 'empty');
    await shot(page, info, 'water-meters-empty');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await water(page, '/infra/water/meters', { data: 'error' });
    await ready(page, 'meters', 'error');
    await shot(page, info, 'water-meters-error');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await water(page, '/infra/water/usage', { data: 'slow' });
    await ready(page, 'usage', 'loading');
    await shot(page, info, 'water-usage-loading');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await water(page, '/infra/water/bills/b1', { rights: { can_bills: false } });
    await expect(page.locator('[data-water="bills"][data-state="forbidden"]')).toHaveCount(1, { timeout: 30_000 });
    await shot(page, info, 'water-bills-forbidden');
  });
});

test.describe('WKWATER-POLISH-2331: stations and doors', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  const SCREEN = 'wiskey-stations';

  test('cards, list, table, a drawer', async ({ page }, info) => {
    await installStationsMock(page, newMock());
    await openStations(page);
    await expect(page.locator(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible({ timeout: 30_000 });
    await shot(page, info, 'stations-cards');
    if (info.project.name === 'desktop') expect(await pageScroll(page), 'the stations screen fits the window').toBeLessThanOrEqual(2);
    await page.locator(`${SCREEN} sw-view-switch button[data-view="list"]`).click();
    await shot(page, info, 'stations-list');
    if (!phone(info)) {
      await page.locator(`${SCREEN} sw-view-switch button[data-view="table"]`).click();
      await shot(page, info, 'stations-table');
    }
    await page.locator(`${SCREEN} sw-view-switch button[data-view="cards"]`).click();
    await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="lobby"] [data-wk-open]`).first().click();
    await expect(page.locator(`${SCREEN} sw-drawer[data-wk-drawer]`)).toHaveAttribute('open', '');
    await shot(page, info, 'stations-drawer');
  });

  test('wide and in-between sizes', async ({ page }, info) => {
    test.skip(phone(info) || !process.env.WKW_SIZES, 'WKW_SIZES=1 only');
    for (const [w, h] of [[1920, 1080], [1180, 820]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await installStationsMock(page, newMock());
      await openStations(page);
      await expect(page.locator(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible({ timeout: 30_000 });
      await shot(page, info, `stations-cards-${w}`);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await water(page, '/infra/water/meters');
      await ready(page, 'meters');
      await shot(page, info, `water-meters-${w}`);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  });
});
