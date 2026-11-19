import { test, expect, type Page, type TestInfo } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EL, noOverflow, open, screen, watchErrors } from './electricity-ui';
// Needs the Vite DEV server: the electricity harness page is served from /tests/electricity-harness/ (as electricity-tou.spec.ts).

// CR-FE-LOGEXPORT-TARIFF-EN-2440 (CR-BE-SMALL-2440 question 3 a): the English names of a time-of-use tariff, on the mock layer, Domus.
//   1. the editor's structure part has an optional "שם באנגלית" for every season, day type and band (the template's are filled in);
//      a Hebrew letter is marked under the field at once; the saved tariff keeps what was typed;
//   2. the English interface shows the English names wherever a name is shown (price table, day bars, legend, the tariff list, the
//      per-band card and the daily table of a bill) and the Hebrew name where there is none; the Hebrew bill paper stays Hebrew;
//   no sideways page scroll.
//   npx playwright test tests/evidence-tariff-names-en-2440.spec.ts --project=desktop --project=mobile --workers=1  (dev server)

const PRICES: Record<string, string> = {
  'summer:offpeak': '0.4800', 'summer:peak': '1.6900', 'winter:offpeak': '0.4500', 'winter:peak': '1.2000', 'transition:offpeak': '0.4600', 'transition:peak': '0.8900',
};
const SKIN = { skin: 'domus' } as const;
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'design', 'evidence', 'CR-FE-LOGEXPORT-TARIFF-EN-2440');
async function shot(page: Page, info: TestInfo, name: string) {
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`), fullPage: true });
}

async function english(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.ui.lang', 'en');
    } catch {
      /* about:blank has no storage */
    }
  });
}

async function newTouTariff(page: Page, name: string) {
  await page.locator('[data-new-tariff]').first().click();
  const d = page.locator('[data-dialog="tariff"]');
  await d.locator('[data-tariff-name]').fill(name);
  await d.locator('[data-tariff-kind="tou"]').click();
  const ed = d.locator('elec-tou-editor');
  await expect(ed.locator('[data-tou-price]')).toHaveCount(6);
  return { d, ed };
}

test.describe('time-of-use tariff names in English', () => {
  test('the editor: an optional English name for seasons, day types and bands, Latin only', async ({ page }, info) => {
    const errs = watchErrors(page);
    await open(page, '/system/infra/prices', SKIN);
    await screen(page, 'settings-prices');
    const { d, ed } = await newTouTariff(page, 'תעו״ז דירות');
    await ed.locator('[data-tou-structure] > summary').click();
    await expect(ed.locator('[data-tou-structure]')).toHaveAttribute('open', ''); // a tap opens it on the phone sheet too (sw-sheet fix)
    const en = (k: string) => ed.locator(`[data-tou-name-en="${k}"]`);
    await expect(ed.locator('[data-tou-name-en]')).toHaveCount(8); // 3 seasons, 3 day types, 2 bands
    await expect(en('seasons:summer')).toHaveValue('Summer');
    await expect(en('day_types:saturday')).toHaveValue('Shabbat and holidays');
    await expect(en('bands:offpeak')).toHaveValue('Off-peak');
    await expect(en('bands:peak')).toHaveAttribute('maxlength', '40');
    // a Hebrew letter: marked at once, under the field
    await en('bands:peak').fill('פסגה');
    await expect(ed.locator('[data-tou-name-en-error]')).toHaveCount(1);
    await expect(en('bands:peak')).toHaveClass(/err/);
    await en('bands:peak').fill('Peak hours');
    await expect(ed.locator('[data-tou-name-en-error]')).toHaveCount(0);
    // emptied = no English name (the Hebrew interface never shows it anyway)
    await en('seasons:transition').fill('');
    await en('day_types:friday').fill('Fri & holiday eves');
    await shot(page, info, 'tou-editor-he');
    for (const [k, v] of Object.entries(PRICES)) await ed.locator(`[data-tou-price="${k}"]`).fill(v);
    await d.locator('[data-save]').click();
    await expect(d).toBeHidden();
    const row = page.locator('[data-tariff-row][data-kind="tou"]');
    await expect(row).toContainText('שפל / פסגה'); // Hebrew interface: Hebrew names
    await row.click();
    await d.locator('elec-tou-editor [data-tou-structure] > summary').click();
    await expect(d.locator('elec-tou-editor [data-tou-structure]')).toHaveAttribute('open', '');
    await expect(en('bands:peak')).toHaveValue('Peak hours');
    await expect(en('seasons:transition')).toHaveValue('');
    await expect(en('day_types:friday')).toHaveValue('Fri & holiday eves');
    await noOverflow(page);
    errs.expectNone();
  });

  test('the English interface shows the English names, else the Hebrew', async ({ page }, info) => {
    const errs = watchErrors(page);
    await english(page);
    await open(page, '/system/infra/prices', SKIN);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await screen(page, 'settings-prices');
    const { d, ed } = await newTouTariff(page, 'TOU flats');
    const prices = ed.locator('[data-tou-prices]');
    await expect(prices.locator('thead th')).toHaveText(['Band', 'Summer', 'Winter', 'Transition']); // the header of the band column is msg/electricity's 'פס'
    await expect(prices).toContainText('Off-peak');
    await expect(prices).toContainText('Peak');
    await expect(ed.locator('[data-tou-hours] .legend')).toHaveText(/Off-peak\s*Peak/);
    await expect(ed.locator('[data-tou-season="summer"]')).toContainText('Weekdays');
    // a band renamed in Hebrew without an English name shows its Hebrew name
    await ed.locator('[data-tou-structure] > summary').click();
    await expect(ed.locator('[data-tou-structure]')).toHaveAttribute('open', ''); // a tap opens it on the phone sheet too (sw-sheet fix)
    await ed.locator('[data-tou-band-name="peak"]').fill('שיא');
    await ed.locator('[data-tou-name-en="bands:peak"]').fill('');
    await expect(prices).toContainText('שיא');
    await ed.locator('[data-tou-name-en="bands:peak"]').fill('Top');
    await expect(prices).toContainText('Top');
    await shot(page, info, 'tou-editor-en');
    for (const [k, v] of Object.entries(PRICES)) await ed.locator(`[data-tou-price="${k}"]`).fill(v);
    await d.locator('[data-save]').click();
    await expect(d).toBeHidden();
    await expect(page.locator('[data-tariff-row][data-kind="tou"]')).toContainText('Off-peak / Top');
    await noOverflow(page);

    // a time-of-use bill: the per-band card and the daily table in English; the bill paper is the Hebrew document
    await open(page, `${EL}/bills/b101`, { ...SKIN, ctl: { tou: true } });
    await screen(page, 'bill');
    await expect(page.locator('elec-bill-paper [data-line="peak"]')).toContainText('צריכת חשמל - פסגה (קיץ)');
    const card = page.locator('[data-card="tou"]');
    await expect(card.locator('[data-band="peak"]')).toContainText('Peak');
    await expect(card.locator('[data-band="offpeak"]')).toContainText('Off-peak');
    await card.locator('[data-tou-daily]').click();
    const table = page.locator('[data-tou-daily-table]');
    await expect(table.locator('[data-day="2026-09-21"]')).toContainText('Shabbat and holidays');
    await expect(table.locator('thead')).toContainText('Peak');
    await shot(page, info, 'bill-tou-en');
    await noOverflow(page);
    errs.expectNone();
  });
});
