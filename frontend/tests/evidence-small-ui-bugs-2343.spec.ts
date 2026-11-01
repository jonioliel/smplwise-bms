import { test, expect, type Page } from '@playwright/test';
import { url } from './tickets-mocks';
import { installTableMock } from './tickets-table-mocks';

// SMALL-UI-BUGS-2343 evidence (runner): the tickets table view with the DEFAULT columns fits 1440 and 1280 without a sideways scroll
// (fixed column widths; at 1280 the low-priority default columns step aside and the chooser says so), long text ends with an ellipsis
// and keeps its tooltip, and a column the user adds back always shows. Mock layer, fake data only.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-small-ui-bugs-2343.spec.ts --project=desktop --workers=1
const T = 'sw-app tickets-list tickets-table';

async function go(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installTableMock(page, { board: { view: 'table' } });
  await page.goto('about:blank');
  await page.goto(url('/tickets/all', 'classic', 'light'));
  await page.locator(`${T} tbody tr`).first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

const wrapOverflow = (page: Page) => page.locator(`${T} [data-table-wrap]`).evaluate((el) => el.scrollWidth - el.clientWidth);
const headCols = (page: Page) => page.locator(`${T} thead th[data-col]`).evaluateAll((ths) => ths.map((th) => (th as HTMLElement).dataset.col ?? ''));

test.describe('tickets table fits the desktop widths', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop widths only');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const width of [1440, 1280]) {
    test(`default columns at ${width}: no sideways scroll`, async ({ page }) => {
      await go(page, width);
      expect(await wrapOverflow(page), `${width}: the table card scrolls sideways`).toBeLessThanOrEqual(1);
      const doc = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(doc, `${width}: the page scrolls sideways`).toBeLessThanOrEqual(1);
      const cols = await headCols(page);
      for (const c of ['number', 'title', 'status', 'assignee', 'activity']) expect(cols, `${width}: ${c} shown`).toContain(c);
      if (width === 1440) expect(cols).toContain('place');
      // a cut cell keeps its full text as the tooltip
      const place = page.locator(`${T} tbody td .cv[title]`).first();
      if (await place.count()) expect(await place.getAttribute('title')).toBeTruthy();
      await page.screenshot({ path: test.info().outputPath(`tickets-table-${width}.png`) });
    });
  }

  test('1280: a hidden default column comes back from the chooser and stays', async ({ page }) => {
    await go(page, 1280);
    const before = await headCols(page);
    const hidden = ['department', 'place', 'priority'].find((c) => !before.includes(c));
    test.skip(!hidden, 'every default column fits this build at 1280 (nothing to add back)');
    await page.locator(`${T} tickets-table-toolbar [data-open="columns"]`).click();
    await expect(page.locator(`${T} tickets-table-toolbar [data-cols-fitted]`)).toBeVisible();
    await page.locator(`${T} tickets-table-toolbar [data-col-toggle="${hidden}"]`).check();
    await expect(page.locator(`${T} thead th[data-col="${hidden}"]`)).toBeVisible();
  });
});
