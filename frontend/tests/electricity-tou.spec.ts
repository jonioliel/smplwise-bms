import { test, expect } from '@playwright/test';
import { EL, noOverflow, open, screen, shot, watchErrors } from './electricity-ui';
// Needs the Vite DEV server: the electricity harness page is served from /tests/electricity-harness/ (the release gate runs it
// in its dev phase on every project: --project=desktop --project=tablet --project=mobile).

// EL5 time-of-use (תעו״ז) on the mock layer: a time-of-use tariff from the template (prices required, band and season table, day bars,
// an added hour range), its row in the list, a bill with band lines and the daily table (demo control `tou`), the special-days settings
// (retype a computed day, restore it, add a day; read-only without the manage permission), RTL without horizontal overflow.
const PRICES: Record<string, string> = {
  'summer:offpeak': '0.4800', 'summer:peak': '1.6900', 'winter:offpeak': '0.4500', 'winter:peak': '1.2000', 'transition:offpeak': '0.4600', 'transition:peak': '0.8900',
};

test.describe('time-of-use tariffs', () => {
  test('a new time-of-use tariff from the template: prices are required, then it is listed', async ({ page }, info) => {
    const errs = watchErrors(page);
    await open(page, '/system/infra/prices');
    await screen(page, 'settings-prices');
    await page.locator('[data-new-tariff]').first().click();
    const d = page.locator('[data-dialog="tariff"]');
    await d.locator('[data-tariff-name]').fill('תעו״ז דירות');
    await d.locator('[data-tariff-kind="tou"]').click();
    const ed = d.locator('elec-tou-editor');
    await expect(ed.locator('[data-tou-price]')).toHaveCount(6);
    await expect(d.locator('[data-tariff-price]')).toHaveCount(0); // no flat price for a time-of-use tariff
    await expect(d.locator('.alert.info')).toContainText('לא אומת'); // the template says where its hours come from
    // the summer weekday bar: off-peak, peak 17:00-23:00, off-peak
    await expect(ed.locator('[data-tou-day="summer:weekday"] [data-cell]')).toHaveCount(3);
    await expect(ed.locator('[data-tou-day="winter:saturday"] [data-cell="peak"]')).toHaveCount(1);
    await expect(ed.locator('[data-tou-day="summer:saturday"] [data-cell="peak"]')).toHaveCount(0);
    await d.locator('[data-save]').click();
    await expect(d.locator('.alert.err')).toContainText('חסר מחיר');
    await expect(ed.locator('[data-tou-price].err')).toHaveCount(1);
    for (const [k, v] of Object.entries(PRICES)) await ed.locator(`[data-tou-price="${k}"]`).fill(v);
    await expect(ed.locator('[data-tou-prices]')).toContainText('כולל מע״מ'); // the other side of the VAT under each price
    // one more hour range on summer Fridays (a new range starts as 17:00-22:00 in the first non-default band)
    await ed.locator('[data-tou-add="summer:friday"]').click();
    await expect(ed.locator('[data-tou-day="summer:friday"] [data-cell="peak"]')).toHaveCount(1);
    await shot(page, info, 'settings-tou-tariff');
    await d.locator('[data-save]').click();
    await expect(d).toBeHidden();
    const row = page.locator('[data-tariff-row][data-kind="tou"]');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('לפי שעות');
    await expect(row).toContainText('שפל / פסגה');
    // opening it again shows the editor with the saved prices and its version
    await row.click();
    await expect(d.locator('elec-tou-editor [data-tou-price="summer:peak"]')).toHaveValue('1.6900');
    await expect(d.locator('[data-tariff-versions] .ver')).toContainText('לפי שעות');
    await expect(d.locator('[data-tariff-kind]')).toHaveCount(0); // the kind is fixed once the tariff exists
    await noOverflow(page);
    errs.expectNone();
  });

  test('the bill of a time-of-use account: band lines on the paper, the per-band card and the daily table', async ({ page }, info) => {
    const errs = watchErrors(page);
    await open(page, `${EL}/bills/b101`, { ctl: { tou: true } });
    await screen(page, 'bill');
    const paper = page.locator('elec-bill-paper');
    await expect(paper.locator('[data-line="peak"]')).toContainText('צריכת חשמל - פסגה (קיץ)');
    await expect(paper.locator('[data-line="offpeak"]')).toContainText('צריכת חשמל - שפל (קיץ)');
    const card = page.locator('[data-card="tou"]');
    await expect(card.locator('[data-band]')).toHaveCount(2);
    await expect(card).toContainText('יום כיפור');
    await card.locator('[data-tou-daily]').click();
    const table = page.locator('[data-tou-daily-table]');
    await expect(table.locator('[data-day]')).toHaveCount(30);
    await expect(table.locator('[data-day="2026-09-21"]')).toContainText('יום כיפור');
    await expect(table.locator('[data-day="2026-09-21"]')).toContainText('שבת וחג');
    await shot(page, info, 'bill-tou');
    await noOverflow(page);
    errs.expectNone();
  });
});

test.describe('special days', () => {
  test('a computed day is retyped and restored, a day is added', async ({ page }, info) => {
    const errs = watchErrors(page);
    await open(page, '/system/infra/calendar');
    const s = await screen(page, 'settings-calendar');
    await expect(s.locator('[data-year]')).toHaveText('2026');
    const ind = s.locator('[data-day="2026-04-22"]');
    await expect(ind).toHaveAttribute('data-kind', 'holiday');
    await expect(ind).toContainText('יום העצמאות');
    await s.locator('[data-kind-select="2026-04-22"]').selectOption('regular');
    await expect(ind).toHaveAttribute('data-kind', 'regular');
    await expect(ind).toContainText('ידני');
    await shot(page, info, 'settings-calendar');
    await s.locator('[data-restore="2026-04-22"]').click();
    await expect(ind).toHaveAttribute('data-kind', 'holiday');
    await expect(ind).toContainText('מחושב');
    await s.locator('[data-add-date]').fill('2026-11-10');
    await s.locator('[data-add-name]').fill('יום מנוחה מקומי');
    await s.locator('[data-add-day]').click();
    await expect(s.locator('[data-day="2026-11-10"]')).toContainText('יום מנוחה מקומי');
    await s.locator('[data-year-next]').click();
    await expect(s.locator('[data-year]')).toHaveText('2027');
    await expect(s.locator('[data-day="2027-04-22"]')).toHaveAttribute('data-kind', 'holiday');
    await noOverflow(page);
    errs.expectNone();
  });

  test('without the manage permission the list is read-only', async ({ page }) => {
    await open(page, '/system/infra/calendar', { ctl: { persona: 'bills_only' } });
    const s = await screen(page, 'settings-calendar');
    await expect(s.locator('[data-day="2026-09-21"]')).toContainText('חג');
    await expect(s.locator('[data-kind-select]')).toHaveCount(0);
    await expect(s.locator('[data-calendar-add]')).toHaveCount(0);
  });
});
