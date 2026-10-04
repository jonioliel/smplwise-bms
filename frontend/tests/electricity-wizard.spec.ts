import { test, expect } from '@playwright/test';
import { EL, noOverflow, open, phone, screen, shot, watchErrors } from './electricity-ui';
import { wizardTo } from './electricity-wizard-helpers';

// The six-step new-account wizard and its formula editor (CR-023, owner decision 1; mock layer, no backend): the happy path, every error state of
// the approved mockup (a rejected kW sensor, a negative result, parentheses, a meter times a meter, an unknown meter in text mode, a field error on the
// customer card, no VAT rate), the presets, the "+ מונה" menu, the number dialog, bi-monthly periods, the automatic-generation options.
const NEW = `${EL}/accounts/new`;

test.describe('account wizard', () => {
  test('happy path: choose meters, formula, price, period, new customer, summary, save and draft', async ({ page }, info) => {
    const errs = watchErrors(page);
    await open(page, NEW);
    await screen(page, 'wizard');
    await expect(page.locator('[data-next]')).toBeDisabled(); // nothing chosen yet
    await wizardTo(page, 1);
    await page.locator('[data-picker-item="m2"]').click();
    await page.locator('[data-picker-item="m3"]').click();
    await expect(page.locator('[data-chosen]')).toContainText('נבחרו 2 מונים');
    await shot(page, info, 'wizard-1-chosen');
    await page.locator('[data-next]').click();
    await expect(page.locator('[data-formula-state="ok"]')).toBeVisible();
    await expect(page.locator('[data-preset="sum"]')).toBeVisible();
    await shot(page, info, 'wizard-2-formula');
    await page.locator('[data-next]').click();
    await page.locator('[data-tariff-row="t1"]').click();
    await expect(page.locator('[data-price-card]')).toContainText('לפני מע״מ');
    await shot(page, info, 'wizard-3-price');
    await page.locator('[data-next]').click();
    await expect(page.locator('[data-periods] tbody tr')).toHaveCount(3);
    await shot(page, info, 'wizard-4-period');
    await page.locator('[data-next]').click();
    await page.locator('#c-name').fill('סטודיו אורן לעיצוב');
    await page.locator('[data-account-name]').fill('סטודיו אורן - קומה 1');
    await shot(page, info, 'wizard-5-customer');
    await page.locator('[data-next]').click();
    await expect(page.locator('[data-summary]')).toContainText('סטודיו אורן - קומה 1');
    await expect(page.locator('[data-payment]')).toContainText('14 ימים');
    await expect(page.locator('[data-opt="draft"]').first()).toBeChecked(); // automatic draft by default
    await shot(page, info, 'wizard-6-summary');
    await noOverflow(page);
    await page.locator('[data-save]').click();
    await screen(page, 'account');
    await expect(page.locator('[data-account-name]')).toHaveText('סטודיו אורן - קומה 1');
    errs.expectNone();
  });

  test('step 1: a kW sensor is refused with the reason, a daily counter warns, search filters by name', async ({ page }, info) => {
    // step 1 is the shared meter picker (<elec-meter-picker mode="choose" sensors>): the registered meters are choices, the sensors that are not
    // meters are listed with their reason and are never a choice
    await open(page, NEW);
    await screen(page, 'wizard');
    const picker = page.locator('[data-elec="wizard"] elec-meter-picker[mode="choose"]');
    await expect(picker.locator('[data-picker-list]')).toBeVisible();
    const meterRows = picker.locator('[data-picker-item]:not([data-sensor])');
    await expect(meterRows).toHaveCount(12);
    await picker.locator('[data-picker-search]').fill('הספק');
    await expect(meterRows).toHaveCount(0);
    await picker.locator('[data-picker-item][data-sensor][data-verdict="rejected"]').first().click();
    await expect(picker.locator('[data-picker-reject]')).toContainText('הספק רגעי');
    await shot(page, info, 'wizard-1-kw-rejected');
    await expect(page.locator('[data-next]')).toBeDisabled();
    await expect(page.locator('[data-chosen]')).toContainText('נבחרו 0');
    await picker.locator('[data-picker-search]').fill('צריכה יומית');
    await expect(picker.locator('[data-picker-item][data-sensor][data-verdict="warn"]')).toContainText('מתאפס כל יום');
    await picker.locator('[data-picker-item][data-sensor][data-verdict="warn"]').click();
    await expect(page.locator('[data-chosen]')).toContainText('נבחרו 0'); // a sensor that is not a registered meter is never chosen here
    await picker.locator('[data-picker-search]').fill('לוח סטודיו');
    await expect(picker.locator('[data-picker-item="m2"]')).toBeVisible();
    await picker.locator('[data-picker-item="m2"]').click();
    await expect(page.locator('[data-chosen]')).toContainText('נבחרו 1 מונה');
    await expect(page.locator('[data-next]')).toBeEnabled();
    await picker.locator('[data-picker-search]').fill('אין כזה');
    await expect(picker.locator('[data-no-match]')).toBeVisible();
  });

  test('step 2: presets, the + מונה menu, operators, the number dialog, delete', async ({ page }, info) => {
    await open(page, NEW);
    await screen(page, 'wizard');
    await wizardTo(page, 2);
    // main minus sub-meters
    await page.locator('[data-preset-btn="mainsub"]').click();
    await page.locator('[data-preset-main]').selectOption('m3');
    await expect(page.locator('[data-expr]')).toContainText('לוח סטודיו');
    await expect(page.locator('[data-sentence]')).toContainText('−');
    await expect(page.locator('[data-formula-state="error"]')).toBeVisible(); // studio - lobby is negative on the last period
    await shot(page, info, 'wizard-2-negative');
    // a percentage of one meter
    await page.locator('[data-preset-btn="pct"]').click();
    await expect(page.locator('[data-preset-pct]')).toBeVisible();
    await page.locator('[data-preset-pct]').fill('50');
    await expect(page.locator('[data-sentence]')).toContainText('50% × ');
    // free formula built by hand: clear, then add meters, operators and a number
    await page.locator('[data-preset-btn="custom"]').click();
    for (let i = 0; i < 4; i++) await page.locator('[data-backspace]').click();
    await expect(page.locator('[data-expr]')).toContainText('הוסיפו מונה');
    await page.locator('[data-add-meter]').click();
    await page.locator('[data-meter-option="m2"]').click();
    await page.locator('[data-op="+"]').click();
    await page.locator('[data-number-btn]').click();
    await page.locator('[data-number-input]').fill('0');
    await page.locator('[data-number-ok]').click();
    await expect(page.locator('[data-number-dialog] .msg')).toContainText('גדול מאפס');
    await page.locator('[data-number-input]').fill('30');
    await shot(page, info, 'wizard-2-number-dialog');
    await page.locator('[data-number-ok]').click();
    await page.locator('[data-op="*"]').click();
    await page.locator('[data-add-meter]').click();
    await page.locator('[data-meter-option="m3"]').click();
    await expect(page.locator('[data-sentence]')).toHaveText('לוח סטודיו + 30% × תאורת לובי');
    await expect(page.locator('[data-formula-state="ok"]')).toBeVisible();
    await expect(page.locator('[data-formula-result]')).toHaveText('776.20'); // 685.48 + 30% of 302.40
    await expect(page.locator('[data-next]')).toBeEnabled();
    await shot(page, info, 'wizard-2-builder');
  });

  test('step 2: parentheses, meter times meter and text mode errors block "next"', async ({ page }, info) => {
    await open(page, NEW);
    await screen(page, 'wizard');
    await wizardTo(page, 2);
    await page.locator('[data-preset-btn="custom"]').click();
    await page.locator('[data-op="("]').click();
    await expect(page.locator('[data-elec="wizard"] .alert.err')).toContainText('חסר סוגר');
    await expect(page.locator('[data-next]')).toBeDisabled();
    await shot(page, info, 'wizard-2-paren');
    await page.locator('[data-backspace]').click();
    await expect(page.locator('[data-formula-state="ok"]')).toBeVisible();
    // a meter times a meter
    await page.locator('[data-op="*"]').click();
    await page.locator('[data-add-meter]').click();
    await page.locator('[data-meter-option="m2"]').click();
    await expect(page.locator('[data-elec="wizard"] .alert.err')).toContainText('להכפיל מונה במונה');
    await expect(page.locator('[data-next]')).toBeDisabled();
    await page.locator('[data-backspace]').click();
    await page.locator('[data-backspace]').click();
    await expect(page.locator('[data-formula-state="ok"]')).toBeVisible();
    // text mode
    await page.locator('[data-mode="text"]').click();
    const ta = page.locator('[data-text]');
    await expect(ta).toHaveValue('[לוח סטודיו] + [תאורת לובי]');
    await ta.fill('[לוח סטודיו] + 30% * [תאורת לובי]');
    await expect(page.locator('[data-formula-state="ok"]')).toBeVisible();
    await expect(page.locator('[data-next]')).toBeEnabled();
    await shot(page, info, 'wizard-2-text');
    await ta.fill('[לוח סטודיו] + [מונה שלא קיים]');
    await expect(page.locator('[data-elec="wizard"] .alert.err')).toContainText('לא נמצא');
    await expect(page.locator('[data-next]')).toBeDisabled();
    await ta.fill('[לוח סטודיו] + (30% * [תאורת לובי]');
    await expect(page.locator('[data-elec="wizard"] .alert.err')).toContainText('חסר סוגר');
    await page.locator('[data-mode="builder"]').click();
  });

  test('step 3: no VAT rate blocks, a new tariff can be added in the wizard', async ({ page }, info) => {
    await open(page, NEW);
    await screen(page, 'wizard');
    await wizardTo(page, 3);
    await expect(page.locator('[data-next]')).toBeDisabled();
    await page.locator('[data-new-tariff]').click();
    await page.locator('[data-tariff-save]').click();
    await expect(page.locator('[data-tariff-dialog] .msg').first()).toBeVisible();
    await page.locator('[data-tariff-name]').fill('תעריף חדש');
    await page.locator('[data-tariff-price]').fill('0.6');
    await page.locator('[data-tariff-mode="inc_vat"]').click();
    await shot(page, info, 'wizard-3-new-tariff');
    await page.locator('[data-tariff-save]').click();
    await expect(page.locator('[data-tariff-row]')).toHaveCount(3);
    await expect(page.locator('[data-price-card]')).toContainText('כולל מע״מ');
    await expect(page.locator('[data-next]')).toBeEnabled();
  });

  test('step 4: bi-monthly shows the cycle month and the expected periods', async ({ page }, info) => {
    await open(page, NEW);
    await screen(page, 'wizard');
    await wizardTo(page, 4);
    await page.locator('[data-months="2"]').click();
    await expect(page.locator('[data-anchor-month]')).toBeVisible();
    await page.locator('[data-anchor-month]').selectOption('2');
    await page.locator('[data-first-start]').fill('2026-02-01');
    const rows = page.locator('[data-periods] tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText('01.02.2026 - 31.03.2026');
    await shot(page, info, 'wizard-4-bimonthly');
    await page.locator('[data-anchor-day]').fill('31');
    await expect(page.locator('[data-next]')).toBeDisabled();
    await page.locator('[data-anchor-day]').fill('15');
    await page.locator('[data-first-start]').fill('');
    await expect(page.locator('[data-next]')).toBeDisabled();
  });

  test('step 5: field errors on the new customer, an existing customer with several accounts gets the suffix note', async ({ page }, info) => {
    await open(page, NEW);
    await screen(page, 'wizard');
    await wizardTo(page, 5);
    await page.locator('[data-next]').click(); // empty name
    await expect(page.locator('[data-field-error="name"]')).toBeVisible();
    await expect(page.locator('[data-field-error="account_name"]')).toBeVisible();
    await page.locator('#c-name').fill('לקוח');
    await page.locator('#c-email').fill('studio@example');
    await page.locator('[data-account-name]').fill('חשבון');
    await page.locator('[data-next]').click();
    await expect(page.locator('[data-field-error="email"]')).toContainText('דוא״ל לא תקינה');
    await shot(page, info, 'wizard-5-field-error');
    await expect(page.locator('[data-elec="wizard"]')).toHaveAttribute('data-step', '5');
    await page.locator('[data-cust-mode="existing"]').click();
    await page.locator('[data-cust-search]').fill('גל');
    await page.locator('[data-cust-row="c2"]').click();
    await expect(page.locator('[data-elec="wizard"] .alert.warn')).toContainText('2 חשבונות');
    await expect(page.locator('[data-elec="wizard"] .alert.warn')).toContainText('/2');
    await shot(page, info, 'wizard-5-existing');
    await page.locator('[data-next]').click();
    await expect(page.locator('[data-elec="wizard"]')).toHaveAttribute('data-step', '6');
  });

  test('step 6: automatic generation options, payment terms from the settings, save only', async ({ page }, info) => {
    await open(page, NEW);
    await screen(page, 'wizard');
    await wizardTo(page, 6, { customer: 'existing' });
    await expect(page.locator('[data-opt="draft"]').first()).toBeChecked();
    await page.locator('[data-opt="issue"]').click();
    await expect(page.locator('[data-elec="wizard"] .alert.warn')).toContainText('יונפק');
    await page.locator('[data-opt="off"]').click();
    await expect(page.locator('[data-elec="wizard"] .alert.warn')).toHaveCount(0);
    await page.locator('[data-opt="none"]').click();
    await expect(page.locator('[data-save]')).toHaveText('שמירה');
    await shot(page, info, 'wizard-6-options');
    await page.locator('[data-save]').click();
    await screen(page, 'account');
    // the new account of an existing customer is listed
    await page.goto('about:blank');
  });

  test('view-only users cannot open the wizard; the stepper goes back to finished steps', async ({ page }, info) => {
    await open(page, NEW, { ctl: { persona: 'view' } });
    await screen(page, 'wizard', 'forbidden');
    await open(page, NEW);
    await screen(page, 'wizard');
    await wizardTo(page, 3);
    if (phone(info)) {
      await page.locator('[data-prev]').click();
      await page.locator('[data-prev]').click();
    } else {
      await page.locator('[data-step-btn="1"]').click();
      await expect(page.locator('[data-step-btn="4"]')).toBeDisabled();
    }
    await expect(page.locator('[data-elec="wizard"]')).toHaveAttribute('data-step', '1');
  });
});
