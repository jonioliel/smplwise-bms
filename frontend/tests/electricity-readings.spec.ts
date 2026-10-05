import { test, expect, type Page } from '@playwright/test';
import { installElectricityMock, PERMS, url, type MockOptions } from './electricity-mocks';

// EL6 electricity UI: manual readings and calibration in the meter card - the section (calibration in force, suggestion, readings, calibrations),
// the manual-reading dialog with its live preview (dry run), save and undo, calibration from the suggestion, the billed-date refusal, field
// validation, and the read-only view without energy.manage. Against the mock layer (tests/electricity-mocks.ts; fake data). All three projects.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/electricity-readings.spec.ts

const CARD = 'sw-app elec-meters-page elec-meter-card';
const SECTION = `${CARD} elec-meter-readings`;
const DIALOGS = `${CARD} elec-reading-dialogs`;

async function openCard(page: Page, meter: string, opts: MockOptions = {}) {
  const mock = await installElectricityMock(page, opts);
  await page.goto('about:blank');
  await page.goto(url(`/infra/electricity/meters?meter=${meter}`));
  await expect(page.locator(`${CARD} [data-meter-card="${meter}"]`)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(`${SECTION} [data-readings]`)).toBeVisible();
  return mock;
}

const click = (page: Page, sel: string) => page.locator(sel).first().evaluate((el) => (el as HTMLElement).click());

test.describe('electricity: manual readings and calibration', () => {
  test('the section shows the calibration in force, the suggestion, the readings and the calibrations', async ({ page }) => {
    await openCard(page, 'm1');
    await expect(page.locator(`${SECTION} [data-calibration="c1"]`)).toContainText('02.10.2026');
    await expect(page.locator(`${SECTION} [data-calibration="c1"]`)).toContainText('1,385.5');
    await expect(page.locator(`${SECTION} [data-suggestion]`)).toContainText('1.0073');
    await expect(page.locator(`${SECTION} [data-reading-list] [data-reading]`)).toHaveCount(2);
    await expect(page.locator(`${SECTION} [data-reading="r2"] [data-effect]`)).toHaveText('להשוואה');
    await expect(page.locator(`${SECTION} [data-reading="r2"]`)).toContainText('+1,385.5');
    await expect(page.locator(`${SECTION} [data-cal-list] [data-cal="c1"]`)).toContainText('בתוקף');
    const text = await page.locator(SECTION).innerText();
    expect(text).not.toMatch(/₪|Home Assistant|\bHA\b|sensor\./);
  });

  test('a manual reading: preview by dry run, save, then undo; the item stays listed as undone', async ({ page }) => {
    const mock = await openCard(page, 'm1');
    await click(page, `${SECTION} [data-reading-add]`);
    const dlg = `${DIALOGS} [data-reading-dialog]`;
    await expect(page.locator(`${dlg} [data-reading-value]`)).toBeVisible();
    await page.locator(`${dlg} [data-reading-value]`).fill('248950.5');
    await page.locator(`${dlg} [data-reading-note]`).fill('קריאה בלוח');
    await expect(page.locator(`${dlg} [data-reading-preview="reported"]`)).toBeVisible();
    await expect(page.locator(`${dlg} [data-reading-preview]`)).toContainText('+38.1');
    await expect(page.locator(`${dlg} [data-preview-message]`)).toContainText('להשוואה');
    expect(mock.calls.some((c) => c.method === 'POST' && c.path.endsWith('/manual-readings') && (c.body as { dry_run?: boolean }).dry_run === true)).toBe(true);
    await click(page, `${dlg} [data-reading-save]`);
    await expect(page.locator(dlg)).toHaveCount(0);
    const saved = mock.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/manual-readings') && (c.body as { dry_run?: boolean }).dry_run === false);
    expect(saved).toHaveLength(1);
    expect(saved[0].body).toMatchObject({ value: '248950.5', unit: 'kWh', note: 'קריאה בלוח' });
    await expect(page.locator(`${SECTION} [data-reading-list] [data-reading]`)).toHaveCount(3);
    const fresh = page.locator(`${SECTION} [data-reading-undo]`).first();
    await expect(fresh).toBeVisible();
    await fresh.evaluate((el) => (el as HTMLElement).click());
    await page.locator(`${DIALOGS} [data-undo-reason]`).fill('הקלדה שגויה');
    await click(page, `${DIALOGS} [data-undo-confirm]`);
    await expect(page.locator(`${DIALOGS} [data-undo-dialog]`)).toHaveCount(0);
    await expect(page.locator(`${SECTION} [data-reading-list] .li.dis`)).toHaveCount(1);
    await expect(page.locator(`${SECTION} [data-reading-list] .li.dis`)).toContainText('בוטלה');
    await expect(page.locator(`${SECTION} [data-reading-undo]`)).toHaveCount(0);
  });

  test('field validation and a lower value than an earlier reading are refused in place', async ({ page }) => {
    await openCard(page, 'm1');
    await click(page, `${SECTION} [data-reading-add]`);
    const dlg = `${DIALOGS} [data-reading-dialog]`;
    await page.locator(`${dlg} [data-reading-value]`).fill('abc');
    await click(page, `${dlg} [data-reading-save]`);
    await expect(page.locator(`${dlg} [data-field-error="value"]`)).toHaveText('צריך להזין מספר תקין');
    await page.locator(`${dlg} [data-reading-value]`).fill('100');
    await click(page, `${dlg} [data-reading-save]`);
    await expect(page.locator(`${dlg} [data-dialog-error]`)).toContainText('נמוכה מקריאה ידנית קודמת');
    await expect(page.locator(`${dlg} [data-reading-value]`)).toBeVisible(); // the dialog stays open with what was typed
    await expect(page.locator(`${dlg} [data-reading-value]`)).toHaveValue('100');
  });

  test('a not-reporting meter: the reading closed the gap and can still be undone', async ({ page }) => {
    await openCard(page, 'm8');
    await expect(page.locator(`${SECTION} [data-reading="r3"] [data-effect="open_gap"]`)).toHaveText('השלימה פער');
    await expect(page.locator(`${SECTION} [data-reading="r3"] [data-reading-undo]`)).toBeVisible();
    await expect(page.locator(`${SECTION} [data-calibration="none"]`)).toBeVisible();
  });

  test('calibrate from the suggestion; a date inside a billed period is refused', async ({ page }) => {
    const mock = await openCard(page, 'm1');
    await click(page, `${SECTION} [data-suggestion-apply]`);
    const dlg = `${DIALOGS} [data-calibrate-dialog]`;
    await expect(page.locator(`${dlg} [data-cal-factor]`)).toHaveValue('1.0073');
    await expect(page.locator(`${dlg} [data-cal-mode="anchor"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${dlg} [data-cal-date]`)).toHaveAttribute('min', '2026-10-01');
    await expect(page.locator(`${dlg} [data-cal-preview]`)).toBeVisible();
    await page.locator(`${dlg} [data-cal-date]`).fill('2026-09-15');
    await expect(page.locator(`${dlg} [data-cal-preview="error"]`)).toContainText('כבר חויבה');
    await page.locator(`${dlg} [data-cal-date]`).fill('2026-10-06');
    await expect(page.locator(`${dlg} [data-cal-preview]:not([data-cal-preview="error"])`)).toBeVisible();
    await click(page, `${dlg} [data-cal-save]`);
    await expect(page.locator(dlg)).toHaveCount(0);
    const saved = mock.calls.filter((c) => c.path.endsWith('/calibrations') && (c.body as { dry_run?: boolean }).dry_run === false);
    expect(saved).toHaveLength(1);
    expect(saved[0].body).toMatchObject({ effective_date: '2026-10-06', factor: '1.0073', anchor_reading_id: 'r2' });
    await expect(page.locator(`${SECTION} [data-cal-list] [data-cal]`)).toHaveCount(2);
  });

  test('without energy.manage the section is read-only', async ({ page }) => {
    await openCard(page, 'm1', { perms: PERMS.view });
    await expect(page.locator(`${SECTION} [data-reading-list] [data-reading]`)).toHaveCount(2);
    for (const sel of ['[data-reading-add]', '[data-calibrate]', '[data-suggestion]', '[data-reading-undo]', '[data-cal-undo]']) await expect(page.locator(`${SECTION} ${sel}`)).toHaveCount(0);
  });
});
