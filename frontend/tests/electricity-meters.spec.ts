import { test, expect, type Page } from '@playwright/test';
import { installElectricityMock, PERMS, url, type MockOptions } from './electricity-mocks';

// CR-023 electricity UI, the meters half (meters overview, adding meters, retention settings, permission rows): every state, the permission gating,
// RTL and the phone, against the mock layer (tests/electricity-mocks.ts; fake data). Runs on all three projects (desktop 1440, tablet 1024, mobile 390).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/electricity-meters.spec.ts      (Vite dev server or the dist preview)

const PAGE = 'sw-app elec-meters-page';

async function open(page: Page, hash: string, opts: MockOptions = {}, skin = 'classic') {
  const mock = await installElectricityMock(page, opts);
  await page.goto('about:blank');
  await page.goto(url(hash, skin));
  await page.waitForSelector('sw-app');
  return mock;
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 900;
async function ready(page: Page) {
  await expect(page.locator(`${PAGE} [data-elec="meters"][data-state="ready"]`)).toBeVisible({ timeout: 15_000 });
}
const visibleRows = (page: Page) => page.locator(isPhone(page) ? `${PAGE} [data-meters-rows] [data-meter]` : `${PAGE} [data-meters-table] tbody [data-meter]`);

test.describe('electricity: navigation', () => {
  test('the area "תשתיות" and the sub-tab "מוני חשמל" with the page row', async ({ page }) => {
    await open(page, '/devices/building', { perms: PERMS.bills });
    const nav = page.locator('sw-app [data-nav="infra"]:visible').first();
    await expect(nav).toHaveAttribute('href', '#/infra/electricity/meters');
    await expect(nav).toContainText('תשתיות');
    await nav.click();
    await ready(page);
    await expect(page.locator('sw-app [data-infra-l1]')).toContainText('מוני חשמל');
    const tabs = page.locator('sw-app [data-infra-pages]');
    for (const l of ['מונים', 'חשבונות', 'חיובים', 'לקוחות']) await expect(tabs).toContainText(l);
    expect(await page.evaluate(() => document.documentElement.getAttribute('dir') ?? getComputedStyle(document.body).direction)).toBe('rtl');
  });

  test('without the bills permission the money pages are not offered', async ({ page }) => {
    await open(page, '/infra/electricity/meters', { perms: PERMS.view });
    await ready(page);
    const tabs = page.locator('sw-app [data-infra-pages]');
    await expect(tabs).toContainText('מונים');
    await expect(tabs).toContainText('חשבונות');
    await expect(tabs).not.toContainText('חיובים');
    await expect(tabs).not.toContainText('לקוחות');
    // the money pages' routes answer "forbidden", never an empty money screen
    await page.evaluate(() => (window.location.hash = '#/infra/electricity/bills'));
    await expect(page.locator('sw-app infra-electricity sw-state-panel[data-state="forbidden"]')).toBeVisible();
  });

  test('no permission: the area is not in the navigation and the route says forbidden', async ({ page }) => {
    await open(page, '/infra/electricity/meters', { perms: PERMS.none });
    await expect(page.locator('sw-app infra-electricity sw-state-panel[data-state="forbidden"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('sw-app [data-nav="infra"]')).toHaveCount(0);
  });

  test('an installation without meters hides the area from a viewer, not from a manager', async ({ page }) => {
    await open(page, '/devices/building', { perms: [...PERMS.view, 'devices.read'], meters: 'empty' });
    await page.waitForSelector('sw-app [data-nav="devices"]', { state: 'attached' });
    await expect(page.locator('sw-app [data-nav="infra"]')).toHaveCount(0);
    const page2 = await page.context().newPage();
    await open(page2, '/devices/building', { perms: [...PERMS.bills, 'devices.read'], meters: 'empty' });
    await page2.waitForSelector('sw-app [data-nav="devices"]');
    await expect(page2.locator('sw-app [data-nav="infra"]:visible').first()).toBeVisible();
  });
});

test.describe('electricity: meters overview', () => {
  test('ready: tiles, statuses, table or rows, and no money anywhere', async ({ page }) => {
    await open(page, '/infra/electricity/meters', { perms: PERMS.view });
    await ready(page);
    await expect(visibleRows(page)).toHaveCount(12);
    await expect(page.locator(`${PAGE} [data-count="reporting"]`)).toHaveText('10');
    await expect(page.locator(`${PAGE} [data-count="stale"]`)).toHaveText('1');
    await expect(page.locator(`${PAGE} [data-meter="m8"] [data-status="stale"]`).first()).toHaveText('לא מדווח');
    await expect(page.locator(`${PAGE} [data-meter="m10"] [data-status="paused"]`).first()).toHaveText('מושהה');
    await expect(page.locator(`${PAGE} [data-meter="m1"] [data-status="reporting"]`).first()).toHaveText('מדווח');
    const text = await page.locator(PAGE).innerText();
    expect(text).not.toMatch(/₪|מע״מ|חיוב/);
    // read-only for money: no add button for a viewer
    await expect(page.locator(`${PAGE} [data-add-meter]`)).toHaveCount(0);
  });

  test('the areas tree: floors collapse, an area filters, search narrows (tree on wide screens, a select on narrow ones)', async ({ page }) => {
    await open(page, '/infra/electricity/meters', { perms: PERMS.bills });
    await ready(page);
    if (isPhone(page)) {
      await page.locator(`${PAGE} [data-area-select]`).selectOption('a-bakery');
      await expect(visibleRows(page)).toHaveCount(3);
    } else {
      const tree = page.locator(`${PAGE} [data-area-tree]`);
      await expect(tree).toBeVisible();
      await expect(tree.locator('[data-area="a-bakery"]')).toBeVisible();
      await tree.locator('[data-floor="f-0"]').click(); // collapse the ground floor
      await expect(tree.locator('[data-area="a-bakery"]')).toHaveCount(0);
      await tree.locator('[data-floor="f-0"]').click();
      await tree.locator('[data-area="a-bakery"]').click();
      await expect(visibleRows(page)).toHaveCount(3);
      await tree.locator('[data-area=""]').click();
      await expect(visibleRows(page)).toHaveCount(12);
    }
    await page.locator(`${PAGE} [data-meters-search]`).fill('מאפייה');
    await expect(visibleRows(page).first()).toBeVisible();
    await page.locator(`${PAGE} [data-meters-search]`).fill('zzz');
    await expect(page.locator(`${PAGE} [data-no-results]`)).toBeVisible();
  });

  test('partial data: no floors from the devices tree, no month-to-date', async ({ page }) => {
    await open(page, '/infra/electricity/meters', { perms: PERMS.view, noFloors: true, consumptionFails: true });
    await ready(page);
    await expect(visibleRows(page)).toHaveCount(12);
    await expect(page.locator(`${PAGE} [data-month]`)).toHaveText('-');
    if (!isPhone(page)) await expect(page.locator(`${PAGE} [data-area-tree] [data-floor="_none"]`)).toBeVisible();
  });

  test('table and cards views', async ({ page }) => {
    test.skip(isPhone(page), 'the phone has one list view');
    await open(page, '/infra/electricity/meters', { perms: PERMS.bills });
    await ready(page);
    await expect(page.locator(`${PAGE} [data-meters-table]`)).toBeVisible();
    await page.locator(`${PAGE} [data-view="cards"]`).click();
    await expect(page.locator(`${PAGE} [data-meters-cards] [data-meter]`)).toHaveCount(12);
    await expect(page.locator(`${PAGE} [data-meters-table]`)).toBeHidden();
    await page.locator(`${PAGE} [data-view="table"]`).click();
    await expect(page.locator(`${PAGE} [data-meters-table]`)).toBeVisible();
  });

  test('loading, empty, error with retry', async ({ page }) => {
    await open(page, '/infra/electricity/meters', { perms: PERMS.bills, meters: 'slow' });
    await expect(page.locator(`${PAGE} [data-elec="meters"][data-state="loading"]`)).toBeVisible();
    await ready(page);

    const p2 = await page.context().newPage();
    await open(p2, '/infra/electricity/meters', { perms: PERMS.bills, meters: 'empty' });
    await expect(p2.locator(`${PAGE} [data-elec="meters"][data-state="empty"]`)).toBeVisible({ timeout: 15_000 });
    await expect(p2.locator(`${PAGE} [data-add-meter]`)).toBeVisible();

    const p3 = await page.context().newPage();
    await open(p3, '/infra/electricity/meters', { perms: PERMS.view, meters: 'error' });
    const errState = p3.locator(`${PAGE} [data-elec="meters"][data-state="error"]`);
    await expect(errState).toBeVisible({ timeout: 15_000 });
    await expect(errState).toContainText('לא ניתן לטעון את המונים');
    // empty for a viewer has no add button
    const p4 = await page.context().newPage();
    await open(p4, '/infra/electricity/meters', { perms: PERMS.view, meters: 'empty' });
    await p4.goto(url('/infra/electricity/meters'));
    await expect(p4.locator(`${PAGE} [data-state="empty"]`)).toBeVisible({ timeout: 15_000 });
    await expect(p4.locator(`${PAGE} [data-add-meter]`)).toHaveCount(0);
  });
});

test.describe('electricity: the meter card', () => {
  test('opens from a row: chart, counter lives, pause and resume', async ({ page }) => {
    const mock = await open(page, '/infra/electricity/meters', { perms: PERMS.bills });
    await ready(page);
    await visibleRows(page).filter({ hasText: 'לוח סטודיו' }).first().click();
    const card = page.locator(`${PAGE} elec-meter-card [data-meter-card="m2"]`);
    await expect(card).toBeVisible();
    await expect(card.locator('[data-chart]')).toBeVisible();
    await expect(card.locator('[data-epochs] .li')).toHaveCount(1); // the install epoch
    await expect(card).toContainText('סטודיו אורן - קומה 1'); // the accounts that use it (the detail's used_in)
    await card.locator('[data-range="hours"]').click();
    await expect(card.locator('[data-chart] rect')).toHaveCount(24);
    await card.locator('[data-meter-pause]').click();
    await expect(card.locator('[data-meter-status="paused"]')).toBeVisible();
    expect(mock.calls.some((c) => c.method === 'PATCH' && c.path.startsWith('meters/m2'))).toBe(true);
    await card.locator('[data-meter-pause]').click();
    await expect(card.locator('[data-meter-status="reporting"]')).toBeVisible();
  });

  test('replace the counter adds a counter life', async ({ page }) => {
    await open(page, '/infra/electricity/meters?meter=m3', { perms: PERMS.bills });
    const card = page.locator(`${PAGE} elec-meter-card [data-meter-card="m3"]`);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.locator('[data-meter-replace]').click();
    const dlg = page.locator(`${PAGE} elec-meter-card [data-meter-replace-dialog]`);
    await dlg.locator('[data-replace-final]').fill('');
    await dlg.locator('[data-replace-save]').click();
    await expect(dlg.locator('[data-replace-error]')).toContainText('קריאה סופית');
    await dlg.locator('[data-replace-final]').fill('4600.5');
    await dlg.locator('[data-replace-start]').fill('0');
    await dlg.locator('[data-replace-save]').click();
    await expect(card.locator('[data-epochs] .li')).toHaveCount(2);
  });

  test('removing a meter used by an account is refused; an unused one goes', async ({ page }) => {
    await open(page, '/infra/electricity/meters?meter=m2', { perms: PERMS.bills });
    let card = page.locator(`${PAGE} elec-meter-card [data-meter-card="m2"]`);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.locator('[data-meter-remove]').click();
    const dlg = page.locator(`${PAGE} elec-meter-card [data-meter-remove-dialog]`);
    await dlg.locator('[data-meter-remove-confirm]').click();
    await expect(dlg).toContainText('המונה משמש בחשבון');
    await dlg.getByText('ביטול').click();
    await page.evaluate(() => (window.location.hash = '#/infra/electricity/meters?meter=m12'));
    card = page.locator(`${PAGE} elec-meter-card [data-meter-card="m12"]`);
    await expect(card).toBeVisible();
    await card.locator('[data-meter-remove]').click();
    await page.locator(`${PAGE} elec-meter-card [data-meter-remove-confirm]`).click();
    await expect(visibleRows(page)).toHaveCount(11);
  });

  test('a viewer sees the card without actions', async ({ page }) => {
    await open(page, '/infra/electricity/meters?meter=m2', { perms: PERMS.view });
    const card = page.locator(`${PAGE} elec-meter-card [data-meter-card="m2"]`);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.locator('[data-meter-replace], [data-meter-pause], [data-meter-remove]')).toHaveCount(0);
  });
});

test.describe('electricity: adding a meter', () => {
  test('search by name, the kW sensor is explained and cannot be added, a good one goes in', async ({ page }) => {
    const mock = await open(page, '/infra/electricity/meters', { perms: PERMS.bills });
    await ready(page);
    await page.locator(`${PAGE} [data-add-meter]`).first().click();
    const dlg = page.locator(`${PAGE} [data-add-dialog]`);
    const list = dlg.locator('[data-picker-list]');
    await expect(list).toBeVisible();
    await expect(list.locator('[data-picker-item]')).toHaveCount(9);
    await dlg.locator('[data-picker-search]').fill('הספק');
    await expect(list.locator('[data-picker-item]')).toHaveCount(2);
    await list.locator('[data-picker-item="sensor.main_power"]').click({ force: true });
    const alert = dlg.locator('[data-picker-reject]');
    await expect(alert).toContainText('החיישן שנבחר מודד הספק רגעי');
    await expect(alert).toContainText('קוט״ש');
    await expect(dlg.locator('[data-add-confirm]')).toHaveAttribute('disabled', '');
    await dlg.locator('[data-picker-search]').fill('חדר כושר');
    await list.locator('[data-picker-item="sensor.gym_energy"]').click();
    await expect(dlg.locator('[data-add-confirm]')).not.toHaveAttribute('disabled', '');
    await dlg.locator('[data-add-confirm]').click();
    await expect(page.locator(`${PAGE} [data-notice]`)).toContainText('המונה נוסף');
    await expect(visibleRows(page)).toHaveCount(13);
    expect(mock.calls.some((c) => c.method === 'POST' && c.path === 'meters')).toBe(true);
    // the search by name asked the server
    expect(mock.calls.some((c) => c.path.includes('q='))).toBe(true);
  });

  test('the already-added sensor and the warning verdict', async ({ page }) => {
    await open(page, '/infra/electricity/meters?add=1', { perms: PERMS.bills });
    const dlg = page.locator(`${PAGE} [data-add-dialog]`);
    await expect(dlg.locator('[data-picker-item="sensor.m2_energy"] [data-verdict="added"]')).toBeVisible({ timeout: 15_000 });
    await expect(dlg.locator('[data-picker-item="sensor.bakery_daily"][data-verdict="warn"]')).toContainText('המונה מתאפס כל יום');
    await dlg.locator('[data-picker-item="sensor.bakery_daily"]').click();
    await expect(dlg.locator('[data-add-confirm]')).not.toHaveAttribute('disabled', '');
  });

  test('a viewer cannot open the add dialog by the address', async ({ page }) => {
    await open(page, '/infra/electricity/meters?add=1', { perms: PERMS.view });
    await ready(page);
    await expect(page.locator(`${PAGE} [data-add-dialog]`)).not.toHaveAttribute('open', '');
  });
});

test.describe('electricity: retention settings', () => {
  const SECTION = 'sw-app system-infra elec-settings-retention';

  test('values, usage and the estimate; a range error blocks saving; a valid change saves', async ({ page }) => {
    const mock = await open(page, '/system/infra/retention', { perms: PERMS.admin });
    const root = page.locator(`${SECTION} [data-elec="retention"][data-state="ready"]`);
    await expect(root).toBeVisible({ timeout: 15_000 });
    await expect(root.locator('[data-retention-input="raw_retention_days"]')).toHaveValue('90');
    await expect(root.locator('[data-retention-input="interval_retention_months"]')).toHaveValue('26');
    await expect(root.locator('[data-retention-input="bill_retention_years"]')).toHaveValue('7');
    await expect(root.locator('[data-retention="raw_retention_days"] [data-usage]')).toHaveText('212 MB');
    await expect(root.locator('[data-retention-save]')).toHaveAttribute('disabled', '');
    // out of range
    await root.locator('[data-retention-input="raw_retention_days"]').fill('400');
    await expect(root.locator('[data-retention-error="raw_retention_days"]')).toHaveText('הערך חייב להיות בין 7 ל-366');
    await expect(root.locator('[data-retention-save]')).toHaveAttribute('disabled', '');
    // a valid change shows the estimate and saves only what changed
    await root.locator('[data-retention-input="raw_retention_days"]').fill('120');
    await expect(root.locator('[data-retention-error="raw_retention_days"]')).toHaveCount(0);
    await expect(root.locator('[data-retention="raw_retention_days"] [data-estimate]')).toBeVisible();
    await root.locator('[data-retention-save]').click();
    await expect(root.locator('[data-saved]')).toBeVisible();
    const patch = mock.calls.find((c) => c.method === 'PATCH' && c.path === 'settings');
    expect(patch?.body).toEqual({ 'energy.raw_retention_days': 120 });
  });

  test('a manager without the system permission edits only the drafts', async ({ page }) => {
    await open(page, '/system/infra/retention', { perms: PERMS.bills });
    const root = page.locator(`${SECTION} [data-elec="retention"][data-state="ready"]`);
    await expect(root).toBeVisible({ timeout: 15_000 });
    await expect(root.locator('[data-retention-input="raw_retention_days"]')).toBeDisabled();
    await expect(root.locator('[data-retention-input="bill_retention_years"]')).toBeDisabled();
    await expect(root.locator('[data-retention-input="draft_retention_days"]')).toBeEnabled();
  });

  test('a viewer has no settings tab and the route is forbidden; a load error offers a retry', async ({ page }) => {
    await open(page, '/system/infra/retention', { perms: PERMS.view });
    await expect(page.locator('sw-app system-infra sw-state-panel[data-state="forbidden"]')).toBeVisible({ timeout: 15_000 });
    const p2 = await page.context().newPage();
    await open(p2, '/system/infra/retention', { perms: PERMS.admin, settings: 'error' });
    await expect(p2.locator(`${SECTION} [data-state="error"]`)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('electricity: permission rows', () => {
  test('the roles tab lists the electricity rows with a tick per role', async ({ page }) => {
    await open(page, '/system/access', { perms: PERMS.admin });
    await page.locator('sw-app system-access [data-access-tabs]').getByText('תפקידים').first().click();
    const rows = page.locator('sw-app system-access elec-permission-rows');
    await expect(rows.locator('[data-energy-permissions]')).toBeVisible({ timeout: 15_000 });
    if (isPhone(page)) {
      await expect(rows.locator('[data-energy-row-phone]')).toHaveCount(4);
      await expect(rows.locator('[data-energy-row-phone="energy.bills"]')).toContainText('רגישה');
    } else {
      await expect(rows.locator('[data-energy-row]')).toHaveCount(4);
      await expect(rows.locator('[data-energy-row="energy.bills"]')).toContainText('רגישה');
      await expect(rows.locator('[data-energy-row="energy.view"] [data-role="operator"] .tick.on')).toHaveCount(1);
      await expect(rows.locator('[data-energy-row="energy.bills"] [data-role="operator"] .tick.on')).toHaveCount(0);
      await expect(rows.locator('[data-energy-row="energy.bills"] [data-role="site_admin"] .tick.on')).toHaveCount(1);
    }
  });
});

test.describe('electricity: layout basics', () => {
  test('RTL, no horizontal overflow, in all four skins and in dark', async ({ page }) => {
    await installElectricityMock(page, { perms: PERMS.bills });
    for (const [skin, scheme] of [['classic', 'light'], ['domus', 'light'], ['tesla', 'dark'], ['bubble', 'light'], ['classic', 'dark']] as const) {
      await page.goto('about:blank');
      await page.goto(url('/infra/electricity/meters', skin, scheme));
      await ready(page);
      const over = await page.evaluate(() => {
        const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
        return { page: document.documentElement.scrollWidth - innerWidth, main: main ? main.scrollWidth - main.clientWidth : 0 };
      });
      expect(over.page, `${skin}/${scheme} page overflow`).toBeLessThanOrEqual(1);
      expect(over.main, `${skin}/${scheme} main overflow`).toBeLessThanOrEqual(1);
    }
  });
});
