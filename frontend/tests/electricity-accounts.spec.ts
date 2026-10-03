import { test, expect } from '@playwright/test';
import { EL, noOverflow, open, phone, screen, shot, watchErrors } from './electricity-ui';

// Accounts list and page, customers and billing settings (CR-023; mock layer): table and cards, the account's three tabs, the unreported meter, the
// consumption chart (full, partial, none), customers (new, edit, delete, errors), prices and VAT, business details (logo, brand colour, payment
// terms, automatic generation), permissions gating (view-only hides money everywhere), RTL.
test.describe('accounts list', () => {
  test('table and cards, search, status chips, money columns, new account button', async ({ page }, info) => {
    const errs = watchErrors(page);
    await open(page, `${EL}/accounts`);
    await screen(page, 'accounts');
    await expect(page.locator('[data-account-row]')).toHaveCount(5);
    await expect(page.locator('[data-elec="accounts"]')).toContainText('מונה לא מדווח');
    await expect(page.locator('[data-new-account]')).toBeVisible();
    if (!phone(info)) {
      await expect(page.locator('[data-elec-list]')).toContainText('סכום עד כה');
      await page.locator('[data-view="cards"]').click();
      await expect(page.locator('.grid-cards [data-account-row]')).toHaveCount(5);
      await shot(page, info, 'accounts-cards');
      await page.locator('[data-view="table"]').click();
    }
    await page.locator('[data-search]').fill('גל-טק');
    await expect(page.locator('[data-account-row]')).toHaveCount(2);
    await page.locator('[data-search]').fill('');
    await page.locator('[data-account-row="a1"] a').first().click();
    await screen(page, 'account');
    errs.expectNone();
  });

  test('loading state, empty state with the new-account action, error with retry', async ({ page }, info) => {
    await open(page, `${EL}/accounts`, { ctl: { latency: 600 } });
    await expect(page.locator('[data-elec="accounts"]')).toHaveAttribute('data-state', 'loading');
    await shot(page, info, 'accounts-loading', { full: false });
    await screen(page, 'accounts');
    await open(page, `${EL}/accounts`, { ctl: { empty: true } });
    await screen(page, 'accounts', 'empty');
    await page.locator('[data-elec-state="empty"] button').click();
    await screen(page, 'wizard');
    await open(page, `${EL}/accounts`, { ctl: { fail: 'accounts' } });
    await screen(page, 'accounts', 'error');
    await expect(page.locator('[data-elec-state="error"]')).toContainText('לא ניתן לטעון את החשבונות');
  });

  test('view-only user: no money, no amounts, no new-account button', async ({ page }) => {
    await open(page, `${EL}/accounts`, { ctl: { persona: 'view' } });
    await screen(page, 'accounts');
    const txt = await page.locator('[data-elec="accounts"]').innerText();
    expect(txt).not.toMatch(/₪/);
    expect(txt).not.toContain('סכום עד כה');
    await expect(page.locator('[data-new-account]')).toHaveCount(0);
  });
});

test.describe('account page', () => {
  test('status: consumption, progress, forecast, amount, formula meters, customer, price, next bill', async ({ page }, info) => {
    await open(page, `${EL}/accounts/a1`);
    await screen(page, 'account');
    await expect(page.locator('[data-elec-tiles]')).toContainText('110.46');
    await expect(page.locator('[data-elec-tiles]')).toContainText('יום 4 מתוך 31');
    await expect(page.locator('[data-tile="amount"]')).toContainText('70.78');
    await expect(page.locator('[data-card="price"]')).toContainText('0.5430');
    await expect(page.locator('[data-card="price"]')).toContainText('0.6407');
    await expect(page.locator('[data-card="next"]')).toContainText('01.10.2026');
    await expect(page.locator('[data-card="next"]')).toContainText('2026-10-0001');
    if (!phone(info)) {
      await expect(page.locator('[data-elec-meters] tbody tr')).toHaveCount(2);
      await expect(page.locator('[data-elec-meters] tfoot')).toContainText('110.46');
    }
    await expect(page.locator('[data-create-bill]')).toBeVisible();
    await expect(page.locator('[data-edit-account]')).toBeVisible();
  });

  test('a meter that does not report: the warning with the time, the chip in the table', async ({ page }, info) => {
    await open(page, `${EL}/accounts/a3`);
    await screen(page, 'account');
    await expect(page.locator('[data-elec="account"] .alert.warn')).toContainText('לוח מאפייה - פאזה 3 לא מדווח');
    await expect(page.locator('[data-elec="account"] .alert.warn')).toContainText('18:40');
    if (!phone(info)) await expect(page.locator('[data-elec-meters]')).toContainText('לא מדווח');
    await shot(page, info, 'account-status-stale-state');
  });

  test('history: the chart with last year, the table with change, amount and bill, 12 / 24 toggle, numbers table', async ({ page }, info) => {
    await open(page, `${EL}/accounts/a1/history`);
    await screen(page, 'account');
    const chart = page.locator('elec-chart');
    await expect(chart.locator('[data-elec-chart]')).toBeVisible();
    await expect(chart.locator('[data-bar="cur"]')).toHaveCount(1);
    await expect(chart.locator('.legend')).toContainText('אותה תקופה אשתקד');
    await expect(chart.locator('[data-bar="prev"]')).toHaveCount(12);
    await chart.locator('summary').click();
    await expect(chart.locator('[data-elec-chart-table] td').first()).toBeVisible();
    await page.locator('[data-months="24"]').click();
    await expect(page.locator('[data-months="24"]')).toHaveAttribute('aria-pressed', 'true');
    if (!phone(info)) {
      await expect(page.locator('[data-elec-history-table] tbody tr').first()).toContainText('2026-09-0001');
      await expect(page.locator('[data-elec-history-table] tbody tr').first()).toContainText('נשלח');
    }
    await shot(page, info, 'account-history-state');
  });

  test('history with partial data: a gap, hatched bars, no last year; an account without history says so', async ({ page }) => {
    await open(page, `${EL}/accounts/a2/history`);
    await screen(page, 'account');
    await expect(page.locator('elec-chart [data-bar="gap"]')).toHaveCount(1);
    await expect(page.locator('elec-chart .legend')).toContainText('נתונים חלקיים');
    await open(page, `${EL}/accounts/a5/history`);
    await screen(page, 'account');
    await expect(page.locator('elec-chart .legend')).not.toContainText('אשתקד');
    await expect(page.locator('elec-chart [data-bar="prev"]')).toHaveCount(4);
    await open(page, `${EL}/accounts/a4/history`);
    await screen(page, 'account');
    await expect(page.locator('[data-elec-state="empty"]')).toContainText('אין עדיין נתוני עבר');
    await expect(page.locator('elec-chart')).toHaveCount(0);
  });

  test('bills tab lists the account bills; view-only has no bills tab and no amounts', async ({ page }) => {
    await open(page, `${EL}/accounts/a1/bills`);
    await screen(page, 'account');
    await expect(page.locator('[data-bill-row]')).toHaveCount(4);
    await open(page, `${EL}/accounts/a1`, { ctl: { persona: 'view' } });
    await screen(page, 'account');
    await expect(page.locator('[data-tab="bills"]')).toHaveCount(0);
    await expect(page.locator('[data-create-bill]')).toHaveCount(0);
    await expect(page.locator('[data-edit-account]')).toHaveCount(0);
    expect(await page.locator('[data-elec="account"]').innerText()).not.toMatch(/₪|0\.5430/);
    await open(page, `${EL}/accounts/a1/bills`, { ctl: { persona: 'view' } });
    await screen(page, 'account', 'forbidden');
  });

  test('edit mode: the wizard opens with the saved formula and saves the change', async ({ page }) => {
    await open(page, `${EL}/accounts/a1/edit`);
    await screen(page, 'wizard');
    await expect(page.locator('[data-elec="wizard"] h2, [data-elec="wizard"] .h2').first()).toContainText('עריכת חשבון');
    await page.locator('[data-step-btn="2"]').click();
    await expect(page.locator('[data-sentence]')).toHaveText('לוח סטודיו + 30% × תאורת לובי');
    await page.locator('[data-step-btn="6"]').click();
    await page.locator('[data-opt="off"]').click();
    await page.locator('[data-save]').click();
    await screen(page, 'account');
  });
});

test.describe('customers', () => {
  test('list, search, the card with accounts and bills, edit and save', async ({ page }, info) => {
    const errs = watchErrors(page);
    await open(page, `${EL}/customers`);
    await screen(page, 'customers');
    await expect(page.locator('[data-customer-row]')).toHaveCount(4);
    await page.locator('[data-search]').fill('גל');
    await expect(page.locator('[data-customer-row]')).toHaveCount(1);
    await page.locator('[data-customer-row="c2"] a').click();
    const card = page.locator('[data-customer-card]');
    await expect(card.locator('#f-name')).toBeVisible();
    await expect(card.locator('#f-name')).toHaveValue('גל-טק פתרונות בע״מ');
    await expect(card.locator('[data-customer-accounts] a')).toHaveCount(2);
    await shot(page, info, 'customer-card-state');
    await card.locator('#f-phone').fill('050-1111111');
    await card.locator('[data-save]').click();
    await page.locator('[data-close]').click();
    await expect(page.locator('[data-customer-card]')).toHaveCount(0);
    await expect(page.locator('[data-customer-row="c2"]')).toContainText('050-1111111');
    errs.expectNone();
  });

  test('new customer: required name, e-mail error, number taken; then created', async ({ page }, info) => {
    await open(page, `${EL}/customers/new`);
    await screen(page, 'customers');
    const card = page.locator('[data-customer-card]');
    await expect(card.locator('#f-customer_number')).toHaveValue('0005');
    await card.locator('[data-save]').click();
    await expect(card.locator('[data-field-error="name"]')).toBeVisible();
    await card.locator('#f-name').fill('לקוח חדש');
    await card.locator('#f-email').fill('x@y');
    await card.locator('[data-save]').click();
    await expect(card.locator('[data-field-error="email"]')).toContainText('לא תקינה');
    await shot(page, info, 'customer-new-errors');
    await card.locator('#f-email').fill('new@example.co.il');
    await card.locator('#f-customer_number').fill('0001');
    await card.locator('[data-save]').click();
    await expect(card.locator('.alert.err')).toContainText('כבר בשימוש');
    await card.locator('#f-customer_number').fill('0005');
    await card.locator('[data-save]').click();
    await expect(page.locator('[data-customer-card] #f-name')).toHaveValue('לקוח חדש');
    await page.locator('[data-close]').click();
    await expect(page.locator('[data-customer-row]')).toHaveCount(5);
  });

  test('delete: refused while the customer has accounts; allowed for a new customer', async ({ page }) => {
    await open(page, `${EL}/customers/c2`);
    await screen(page, 'customers');
    await page.locator('[data-delete]').click();
    await page.locator('[data-dialog="delete-customer"] [data-confirm]').click();
    await expect(page.locator('[data-customer-card] .alert.err')).toContainText('חשבונות פעילים');
    await open(page, `${EL}/customers/new`);
    await screen(page, 'customers');
    await page.locator('#f-name').fill('למחיקה');
    await expect(page.locator('#f-customer_number')).toHaveValue('0005');
    await page.locator('[data-save]').click();
    await expect(page.locator('[data-delete]')).toBeVisible();
    await page.locator('[data-delete]').click();
    await page.locator('[data-dialog="delete-customer"] [data-confirm]').click();
    await expect(page.locator('[data-customer-card]')).toHaveCount(0);
    await expect(page.locator('[data-customer-row]')).toHaveCount(4);
  });

  test('without the bills permission the page is forbidden and shows nothing', async ({ page }) => {
    await open(page, `${EL}/customers`, { ctl: { persona: 'view' } });
    await screen(page, 'customers', 'forbidden');
    expect(await page.locator('[data-elec="customers"]').innerText()).not.toMatch(/example|050-/);
  });
});

test.describe('billing settings', () => {
  test('prices: tariffs with before / including VAT, a new price version, the VAT rate and its history', async ({ page }, info) => {
    await open(page, '/system/infra/prices');
    await screen(page, 'settings-prices');
    await expect(page.locator('[data-tariff-row]')).toHaveCount(2);
    await expect(page.locator('[data-card="vat"]')).toContainText('18%');
    await expect(page.locator('[data-card="vat"]')).toContainText('17%');
    await page.locator('[data-tariff-row="t1"]').click();
    const d = page.locator('[data-dialog="tariff"]');
    await expect(d.locator('[data-tariff-versions] .ver')).toHaveCount(3);
    await d.locator('[data-tariff-price]').fill('0.5500');
    await d.locator('[data-tariff-mode="inc_vat"]').click();
    await expect(d.locator('[data-tariff-derived]')).toContainText('0.4661');
    await d.locator('[data-tariff-from]').fill('2026-07-01');
    await shot(page, info, 'settings-tariff-edit');
    await d.locator('[data-save]').click();
    await expect(d.locator('.alert.err')).toContainText('תאריך התחלה זהה');
    await d.locator('[data-tariff-from]').fill('2026-10-01');
    await d.locator('[data-save]').click();
    await expect(page.locator('[data-tariff-row="t1"]')).toContainText('כולל מע״מ');
    await page.locator('[data-new-vat]').click();
    await page.locator('[data-vat-input]').fill('60');
    await page.locator('[data-dialog="vat"] [data-save]').click();
    await expect(page.locator('[data-dialog="vat"] .msg').first()).toContainText('בין 0 ל-50');
    await page.locator('[data-vat-input]').fill('17.5');
    await page.locator('[data-vat-from]').fill('2027-01-01');
    await page.locator('[data-dialog="vat"] [data-save]').click();
    await expect(page.locator('[data-vat-rate]')).toContainText('17.5%');
    await page.locator('[data-default-mode="inc_vat"]').check({ force: true });
    await expect(page.locator('[data-default-mode="inc_vat"]')).toBeChecked();
  });

  test('business: details, brand colour picker, payment terms (days or a fixed day), automatic generation, logo, numbering', async ({ page }, info) => {
    const errs = watchErrors(page);
    await open(page, '/system/infra/business');
    await screen(page, 'settings-business');
    await expect(page.locator('[data-numbering]')).toContainText('YYYY-MM-NNNN');
    await expect(page.locator('[data-preview] [data-elec-paper]')).toContainText('נכסי הדוגמה בע״מ');
    await page.locator('#b-name').fill('עסק חדש בע״מ');
    await expect(page.locator('[data-preview]')).toContainText('עסק חדש בע״מ');
    // brand colour: a swatch from the palettes, the free colour picker, a too-light colour is refused
    await page.locator('[data-swatch]').first().click();
    await page.locator('[data-accent-color]').fill('#ffffe0');
    await page.locator('[data-save]').click();
    await expect(page.locator('[data-field-error="accent_color"]')).toContainText('בהיר מדי');
    await page.locator('[data-accent-color]').fill('#1a7f5a');
    // payment terms
    await page.locator('[data-terms="day_of_month"]').click();
    await page.locator('[data-day-of-month]').fill('40');
    await page.locator('[data-save]').click();
    await expect(page.locator('[data-field-error="terms"]')).toContainText('בין 1 ל-31');
    await page.locator('[data-day-of-month]').fill('15');
    await page.locator('[data-terms="net_days"]').click();
    await page.locator('[data-days]').fill('30');
    await page.locator('[data-delay]').fill('99');
    await page.locator('[data-save]').click();
    await expect(page.locator('[data-field-error="delay_hours"]')).toBeVisible();
    await page.locator('[data-delay]').fill('12');
    await shot(page, info, 'settings-business-edit');
    await page.locator('[data-save]').click();
    await expect(page.locator('[data-elec="settings-business"] .alert.ok')).toContainText('נשמרו');
    // logo: upload a tiny PNG, then remove it
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.locator('[data-logo-input]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('[data-logo] img')).toBeVisible();
    await page.locator('[data-logo-remove]').click();
    await expect(page.locator('[data-logo] img')).toHaveCount(0);
    await page.locator('[data-logo-input]').setInputFiles({ name: 'x.gif', mimeType: 'image/gif', buffer: png });
    await expect(page.locator('[data-elec="settings-business"] .alert.err')).toContainText('PNG או JPEG');
    errs.expectNone();
  });

  test('settings: a user without the manage permission reads only; a user without money sees nothing', async ({ page }) => {
    await open(page, '/system/infra/prices', { ctl: { persona: 'bills_only' } });
    await screen(page, 'settings-prices');
    await expect(page.locator('[data-new-tariff]')).toHaveCount(0);
    await expect(page.locator('[data-new-vat]')).toHaveCount(0);
    await open(page, '/system/infra/business', { ctl: { persona: 'bills_only' } });
    await screen(page, 'settings-business');
    await expect(page.locator('[data-save]')).toHaveCount(0);
    await open(page, '/system/infra/prices', { ctl: { persona: 'view' } });
    await screen(page, 'settings-prices', 'forbidden');
    await open(page, '/system/infra/business', { ctl: { persona: 'view' } });
    await screen(page, 'settings-business', 'forbidden');
  });
});

test.describe('RTL and layout basics', () => {
  test('the document and every screen read right to left, nothing scrolls sideways', async ({ page }) => {
    for (const r of [`${EL}/accounts`, `${EL}/accounts/a1`, `${EL}/accounts/new`, `${EL}/bills`, `${EL}/bills/b102`, `${EL}/customers`, '/system/infra/prices', '/system/infra/business']) {
      await open(page, r);
      await page.waitForSelector('[data-elec]');
      await page.waitForFunction(() => document.querySelector('[data-elec]')?.getAttribute('data-state') !== 'loading');
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).direction), r).toBe('rtl');
      await noOverflow(page);
    }
  });
});
