import { test, expect, type Page } from '@playwright/test';
import { EL, noOverflow, open, screen, shot, watchErrors } from './electricity-ui';

// Bills (CR-023 §9-§12; mock layer): the list with the status filter, the A4 preview in every state, the confirmation dialogs (issue, cancel with a
// mandatory reason, correct, mark sent, mark paid, delete a draft), the PDF failure, generating a bill with the period choice and the overlap error.
// Fixture ids: b101 draft (shared areas), b102 sent, b103 paid, b104 issued, b105 cancelled, b106 corrected revision of b105.
const bill = (id: string) => `${EL}/bills/${id}`;
const state = (page: Page) => page.locator('[data-elec="bill"]');

test.describe('bills list', () => {
  test('status filter with counts, month filter, search, row opens the bill', async ({ page }, info) => {
    await open(page, `${EL}/bills`);
    await screen(page, 'bills');
    await expect(page.locator('[data-filter=""]')).toContainText('12');
    for (const [s, label] of [['draft', 'טיוטה'], ['issued', 'הונפק'], ['sent', 'נשלח'], ['paid', 'שולם'], ['void', 'בוטל']] as const) {
      await expect(page.locator(`[data-filter="${s}"]`)).toContainText(label);
    }
    await page.locator('[data-filter="void"]').click();
    await expect(page.locator('[data-bill-row]')).toHaveCount(1);
    await page.locator('[data-filter="draft"]').click();
    await expect(page.locator('[data-bill-row][data-bill-state="draft"]')).toHaveCount(1);
    await page.locator('[data-filter=""]').click();
    await page.locator('[data-month]').selectOption('2026-07');
    await expect(page.locator('[data-bill-row]')).toHaveCount(2);
    await page.locator('[data-month]').selectOption('');
    await page.locator('[data-search]').fill('09-0002/2');
    await expect(page.locator('[data-bill-row]')).toHaveCount(1);
    await page.locator('[data-search]').fill('אין כזה');
    await expect(page.locator('[data-elec-state="empty"]')).toBeVisible();
    await shot(page, info, 'bills-filtered-empty');
    await page.locator('[data-search]').fill('גל-טק');
    await page.locator('[data-bill-row]').first().locator('a.rowlink, a.li').first().click();
    await screen(page, 'bill');
  });
});

test.describe('bill page: every state', () => {
  test('draft: watermark, data warning, the allowed actions, the consumption chart', async ({ page }, info) => {
    const errs = watchErrors(page);
    await open(page, bill('b101'));
    await screen(page, 'bill');
    await expect(state(page)).toHaveAttribute('data-bill-state', 'draft');
    await expect(page.locator('[data-watermark]')).toHaveText('טיוטה');
    await expect(page.locator('[data-bill-number]')).toHaveText('טיוטה');
    for (const a of ['issue', 'recalculate', 'pdf', 'delete']) await expect(page.locator(`[data-act="${a}"]`)).toBeVisible();
    for (const a of ['sent', 'paid', 'correct', 'void']) await expect(page.locator(`[data-act="${a}"]`)).toHaveCount(0);
    await expect(state(page).locator('.alert.warn').first()).toContainText('לא מדווח');
    await expect(page.locator('[data-elec-paper]')).toContainText('מתאריך 01.09.2026 עד תאריך 30.09.2026');
    await expect(page.locator('[data-elec-paper]')).not.toContainText('NaN');
    await shot(page, info, 'bill-draft-state');
    await noOverflow(page);
    errs.expectNone();
  });

  test('issued, sent, paid: chips, actions per state, the paper shows the number and the period from-to', async ({ page }, info) => {
    const cases: [string, string, string[], string[]][] = [
      ['b104', 'issued', ['sent', 'paid', 'pdf', 'correct', 'void'], ['issue', 'delete', 'recalculate']],
      ['b102', 'sent', ['paid', 'pdf', 'correct', 'void'], ['sent', 'issue']],
      ['b103', 'paid', ['pdf', 'correct'], ['sent', 'paid', 'void', 'issue']],
    ];
    for (const [id, st, yes, no] of cases) {
      await open(page, bill(id));
      await screen(page, 'bill');
      await expect(state(page)).toHaveAttribute('data-bill-state', st);
      await expect(page.locator('[data-watermark]')).toHaveCount(0);
      for (const a of yes) await expect(page.locator(`[data-act="${a}"]`), `${st} ${a}`).toBeVisible();
      for (const a of no) await expect(page.locator(`[data-act="${a}"]`), `${st} no ${a}`).toHaveCount(0);
      await expect(page.locator('[data-elec-paper]')).toContainText('חשבון צריכת חשמל ודרישת תשלום');
      await expect(page.locator('[data-elec-paper]')).toContainText('אינו חשבונית מס');
      if (st !== 'paid') await shot(page, info, `bill-${st}-state`);
    }
    await shot(page, info, 'bill-paid-state');
  });

  test('cancelled bill: watermark and the reason, only the PDF; a corrected revision links to the original', async ({ page }, info) => {
    await open(page, bill('b105'));
    await screen(page, 'bill');
    await expect(page.locator('[data-watermark]')).toHaveText('בוטל');
    await expect(state(page).locator('.alert.err')).toContainText('קריאת סוף תקופה שגויה');
    await expect(page.locator('[data-act]')).toHaveCount(1);
    await expect(page.locator('[data-act="pdf"]')).toBeVisible();
    await shot(page, info, 'bill-void-state');
    await open(page, bill('b106'));
    await screen(page, 'bill');
    await expect(page.locator('[data-bill-number]')).toHaveText('2026-08-0001-2');
    await expect(state(page)).toContainText('מחליף את');
    await expect(page.locator('[data-elec-paper]')).toContainText('(מחליף את');
    await shot(page, info, 'bill-revision-state');
    await state(page).locator('a.lnk', { hasText: '2026-08-0001' }).first().click();
    await expect(page.locator('[data-bill-number]')).toHaveText('2026-08-0001');
  });

  test('PDF failure: the bill stays issued, the error shows with "create the PDF again"', async ({ page }, info) => {
    await open(page, bill('b104'), { ctl: { pdf_failed: true } });
    await screen(page, 'bill');
    await page.locator('[data-act="pdf"]').click();
    await expect(page.locator('[data-pdf-error]')).toContainText('נכשלה');
    await expect(state(page)).toHaveAttribute('data-bill-state', 'issued');
    await shot(page, info, 'bill-pdf-error');
    const dl = page.waitForEvent('download');
    await page.locator('[data-pdf-retry]').click();
    expect((await dl).suggestedFilename()).toMatch(/\.pdf$/);
    await expect(page.locator('[data-pdf-error]')).toHaveCount(0);
  });
});

test.describe('bill actions and dialogs', () => {
  test('issue a draft: confirmation, a number is assigned, the state is issued, the log shows it', async ({ page }, info) => {
    await open(page, bill('b101'));
    await screen(page, 'bill');
    await page.locator('[data-act="issue"]').click();
    const d = page.locator('[data-dialog="issue"]');
    await expect(d).toContainText('אי אפשר לערוך');
    await shot(page, info, 'dialog-issue');
    await d.locator('[data-confirm]').click();
    await expect(state(page)).toHaveAttribute('data-bill-state', 'issued');
    await expect(page.locator('[data-bill-number]')).toHaveText('2026-09-0004');
    await expect(page.locator('[data-watermark]')).toHaveCount(0);
    await expect(page.locator('[data-bill-log]')).toContainText('הונפק');
    await expect(page.locator('[data-act="void"]')).toBeVisible();
  });

  test('cancel needs a reason; the cancelled bill keeps its number and shows the reason', async ({ page }, info) => {
    await open(page, bill('b104'));
    await screen(page, 'bill');
    await page.locator('[data-act="void"]').click();
    const d = page.locator('[data-dialog="void"]');
    await expect(d.locator('[data-confirm]')).toBeDisabled();
    await d.locator('[data-reason]').fill('x');
    await d.locator('[data-reason]').fill('');
    await expect(d.locator('[data-reason-error]')).toContainText('צריך לכתוב סיבה');
    await expect(d.locator('[data-confirm]')).toBeDisabled();
    await shot(page, info, 'dialog-void-required');
    await d.locator('[data-reason]').fill('נשלח ללקוח הלא נכון');
    await d.locator('[data-confirm]').click();
    await expect(state(page)).toHaveAttribute('data-bill-state', 'void');
    await expect(page.locator('[data-watermark]')).toHaveText('בוטל');
    await expect(state(page).locator('.alert.err')).toContainText('נשלח ללקוח הלא נכון');
    await expect(page.locator('[data-bill-number]')).toHaveText('2026-09-0002/2');
  });

  test('correct creates a draft revision; issuing it cancels the original', async ({ page }, info) => {
    await open(page, bill('b103'));
    await screen(page, 'bill');
    await page.locator('[data-act="correct"]').click();
    const d = page.locator('[data-dialog="correct"]');
    await expect(d).toContainText('2026-09-0002-2');
    await shot(page, info, 'dialog-correct');
    await d.locator('[data-confirm]').click();
    await expect(state(page)).toHaveAttribute('data-bill-state', 'draft');
    await expect(state(page)).toContainText('מחליף את');
    await page.locator('[data-act="issue"]').click();
    await page.locator('[data-dialog="issue"] [data-confirm]').click();
    await expect(page.locator('[data-bill-number]')).toHaveText('2026-09-0002-2');
    await state(page).locator('a.lnk', { hasText: '2026-09-0002' }).first().click();
    await expect(state(page)).toHaveAttribute('data-bill-state', 'void');
    await expect(state(page).locator('.alert.err')).toContainText('הוחלף ב-2026-09-0002-2');
  });

  test('mark sent (date and how) then mark paid (date and reference)', async ({ page }, info) => {
    await open(page, bill('b104'));
    await screen(page, 'bill');
    await page.locator('[data-act="sent"]').click();
    const s = page.locator('[data-dialog="sent"]');
    await expect(s.locator('[data-date]')).toHaveValue('2026-10-04');
    await s.locator('[data-how="hand"]').click();
    await shot(page, info, 'dialog-sent');
    await s.locator('[data-confirm]').click();
    await expect(state(page)).toHaveAttribute('data-bill-state', 'sent');
    await expect(state(page)).toContainText('מסירה ידנית');
    await page.locator('[data-act="paid"]').click();
    const p = page.locator('[data-dialog="paid"]');
    await p.locator('[data-reference]').fill('A-1234');
    await shot(page, info, 'dialog-paid');
    await p.locator('[data-confirm]').click();
    await expect(state(page)).toHaveAttribute('data-bill-state', 'paid');
    await expect(state(page)).toContainText('A-1234');
    await expect(page.locator('[data-act="sent"]')).toHaveCount(0);
  });

  test('delete a draft returns to the list; recalculate keeps the draft', async ({ page }) => {
    await open(page, bill('b101'));
    await screen(page, 'bill');
    await page.locator('[data-act="recalculate"]').click();
    await expect(page.locator('[data-bill-log]')).toContainText('חושב מחדש');
    await page.locator('[data-act="delete"]').click();
    await page.locator('[data-dialog="delete"] [data-confirm]').click();
    await screen(page, 'bills');
    await expect(page.locator('[data-filter="draft"]')).toContainText('0');
  });

  test('Escape closes a dialog without acting', async ({ page }) => {
    await open(page, bill('b104'));
    await screen(page, 'bill');
    await page.locator('[data-act="void"]').click();
    await expect(page.locator('[data-dialog="void"]')).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-dialog="void"]')).not.toHaveAttribute('open', '');
    await expect(state(page)).toHaveAttribute('data-bill-state', 'issued');
  });
});

test.describe('generate a bill', () => {
  const acc = (id: string) => `${EL}/accounts/${id}`;

  test('the last period overlaps an issued bill: the error shows before the click and the button is disabled', async ({ page }, info) => {
    await open(page, acc('a1'));
    await screen(page, 'account');
    await page.locator('[data-create-bill]').click();
    const d = page.locator('[data-bill-create]');
    await expect(d.locator('.alert.err')).toContainText('כבר קיים חיוב 2026-09-0001');
    await expect(d.locator('[data-create]')).toBeDisabled();
    await shot(page, info, 'dialog-generate-overlap');
    // the current period up to today is free
    await d.locator('[data-period="current"]').check({ force: true });
    await expect(d.locator('.alert.err')).toHaveCount(0);
    await expect(d.locator('[data-create]')).toBeEnabled();
  });

  test('another range: validation, an overlap with the range, then a draft is created and opened', async ({ page }, info) => {
    await open(page, acc('a1'));
    await screen(page, 'account');
    await page.locator('[data-create-bill]').click();
    const d = page.locator('[data-bill-create]');
    await d.locator('[data-period="range"]').check({ force: true });
    await d.locator('[data-range-from]').fill('2026-10-03');
    await d.locator('[data-range-to]').fill('2026-10-01');
    await expect(d.locator('.alert.err')).toContainText('אחרי תאריך ההתחלה');
    await expect(d.locator('[data-create]')).toBeDisabled();
    await d.locator('[data-range-from]').fill('2026-09-15');
    await d.locator('[data-range-to]').fill('2026-10-02');
    await expect(d.locator('.alert.err')).toContainText('2026-09-0001');
    await d.locator('[data-range-from]').fill('2026-10-01');
    await d.locator('[data-range-to]').fill('2026-10-03');
    await shot(page, info, 'dialog-generate-range');
    await d.locator('[data-create]').click();
    await screen(page, 'bill');
    await expect(state(page)).toHaveAttribute('data-bill-state', 'draft');
    await expect(page.locator('[data-elec-paper]')).toContainText('01.10.2026');
    await expect(page.locator('[data-elec-paper]')).toContainText('03.10.2026');
  });

  for (const [code, text] of [['formula_negative', 'שלילית'], ['tariff_missing', 'אין מחיר'], ['vat_missing', 'מע״מ']] as const) {
    test(`server refusal ${code} is shown in the dialog`, async ({ page }, info) => {
      await open(page, acc('a1'), { ctl: { create_error: code } });
      await screen(page, 'account');
      await page.locator('[data-create-bill]').click();
      const d = page.locator('[data-bill-create]');
      await d.locator('[data-period="current"]').check({ force: true });
      await d.locator('[data-create]').click();
      await expect(d.locator('.alert.err')).toContainText(text);
      if (code === 'formula_negative') await shot(page, info, 'dialog-generate-negative');
    });
  }
});
