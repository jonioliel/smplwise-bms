import { test, expect, type Page } from '@playwright/test';
import { url } from './tickets-mocks';
import { installTableMock, type TableMock } from './tickets-table-mocks';

// REVIEW-2490-FIXES-2500 (finding F1 of REVIEW-2490-DIFF): the tickets table loads on its own after a short first answer (the server's
// scan budget under the visibility check: fewer than 10 rows and a cursor). That AUTOMATIC follow-up load must not jump to the page of its
// first new row - the table opened on page 1 stays on page 1. A PRESSED "load more" still shows the page of its first new row.
// The first answer is cut to as many rows as page 1 holds (so the old code would have opened page 2), the automatic load answers 40 rows,
// a pressed "load more" answers the rest. The phone (mobile project) keeps its compact list: every row drawn, the first one on screen.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-tickets-table-autoload-2500.spec.ts --project=desktop --project=mobile

const T = 'sw-app tickets-list tickets-table';
const TOTAL = 70;

const settle = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 4; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(150);
};

/** Open the board table; `first` > 0 cuts the first answer to that many rows and the automatic follow-up load to 40. */
async function open(page: Page, first = 0): Promise<TableMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const st = await installTableMock(page, { board: { view: 'table' }, many: TOTAL });
  if (first > 0) {
    // registered after the table mock, so it runs first: it only changes the page size the table mock answers with
    await page.route('**/api/v1/tickets/table**', (route) => {
      const u = new URL(route.request().url());
      const cursor = u.searchParams.get('cursor');
      if (!cursor) u.searchParams.set('limit', String(first));
      else if (cursor === `o${first}`) u.searchParams.set('limit', '40');
      else return route.fallback();
      return route.fallback({ url: u.toString() });
    });
  }
  await page.goto('about:blank');
  await page.goto(url('/tickets/mine?status=all'));
  await page.waitForSelector(`${T} [data-row]`);
  await settle(page);
  return st;
}

interface Fit {
  page: number;
  pages: number;
  drawn: number[];
  total: number;
}

const measure = (page: Page): Promise<Fit> =>
  page.evaluate(() => {
    const deep = (root: ParentNode, sel: string): Element | null => {
      const f = root.querySelector(sel);
      if (f) return f;
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) {
          const x = deep(el.shadowRoot, sel);
          if (x) return x;
        }
      }
      return null;
    };
    const sr = (deep(document, 'tickets-table') as HTMLElement).shadowRoot!;
    const rows = [...sr.querySelectorAll<HTMLElement>('[data-row]')];
    const table = sr.querySelector('table[data-tickets-table]');
    const pager = sr.querySelector('[data-table-pager]') as (HTMLElement & { page: number; pages: number }) | null;
    return {
      page: pager?.page ?? 1,
      pages: pager?.pages ?? 1,
      drawn: rows.map((r, i) => (table ? Number(r.dataset.rowIndex) : i)).map((n, i) => (Number.isNaN(n) ? i : n)),
      total: Number((sr.querySelector('tickets-table-toolbar') as unknown as { count: number }).count),
    };
  });

const goPage = (page: Page, n: number) =>
  page.locator(`${T} [data-table-pager]`).evaluate((el, p) => el.dispatchEvent(new CustomEvent('page-change', { detail: { page: p }, bubbles: true, composed: true })), n);

test.describe('tickets table: the automatic follow-up load keeps page 1 (REVIEW-2490-FIXES-2500)', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  });

  test('desktop: a short first answer loads on its own and stays on page 1; a pressed "load more" still shows its first new row', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop');
    // a window short enough that page 1 holds fewer than 10 rows (the automatic load runs below 10 rows)
    let k = 0;
    for (const h of [600, 520, 460]) {
      await page.setViewportSize({ width: 1280, height: h });
      await open(page);
      k = (await measure(page)).drawn.length;
      if (k <= 9) break;
    }
    expect(k, 'page 1 holds fewer than 10 rows (else the automatic load does not run)').toBeLessThanOrEqual(9);
    expect(k).toBeGreaterThan(0);

    // the first answer holds exactly the rows of page 1: the old code opened page 2 (the page of row k) after the automatic load
    const st = await open(page, k);
    await expect.poll(async () => (await measure(page)).total).toBe(k + 40);
    await settle(page);
    expect(st.calls.some((c) => c.path === 'tickets/table' && c.search.includes(`cursor=o${k}`)), 'the automatic follow-up load ran').toBe(true);
    const f = await measure(page);
    console.log(`page 1 holds ${k} rows; after the automatic load: page ${f.page}/${f.pages}, first row drawn ${f.drawn[0]}, ${f.total} rows`);
    expect(f.pages, 'more than one page').toBeGreaterThan(1);
    expect(f.page, 'the table stays on page 1').toBe(1);
    expect(f.drawn[0]).toBe(0);
    await expect(page.locator(`${T} tbody tr[data-row-index="0"]`)).toBeVisible();

    // a pressed "load more" (on the last page) still shows the page of its first new row
    await goPage(page, f.pages);
    await settle(page);
    const more = page.locator(`${T} tickets-table-toolbar [data-load-more]`);
    await expect(more).toBeVisible();
    await more.click();
    const firstNew = k + 40;
    await expect(page.locator(`${T} tbody tr[data-row-index="${firstNew}"]`)).toBeVisible();
    await settle(page);
    const g = await measure(page);
    expect(g.total).toBe(TOTAL);
    expect(g.drawn, 'the page of the first new row').toContain(firstNew);
    expect(g.page).toBeGreaterThan(1);
  });

  test('phone: the compact list takes the automatic load, every row drawn, the first one on screen', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'mobile');
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, 6);
    await expect.poll(async () => (await measure(page)).total).toBe(46);
    await settle(page);
    const f = await measure(page);
    expect(f.drawn.length).toBe(46);
    await expect(page.locator(`${T} [data-table-pager]`)).toHaveCount(0);
    await expect(page.locator(`${T} [data-row]`).first()).toBeInViewport();
  });
});
