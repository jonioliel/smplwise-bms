import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { url } from './tickets-mocks';
import { installTableMock, type TableMockOptions } from './tickets-table-mocks';

// TICKETS-PAGING-2490 (owner rule 2026-10-24: a control screen never scrolls; owner decision Q20: the tickets TABLE pages, the case
// details stay a scrolling document): the board table (קריאות › טבלה) cuts its loaded rows into pages that fit the room the screen
// gives it - measured from the real rows (components/page-fit.ts), the pager at the end of the toolbar row.
// At desktop 1280 / 1440 / 1920 and tablet 1024x768 / 820x1180 (desktop project), 40 rows:
//   - paged (the default): the region does not overflow, the page (the tickets screen / the shell's main) does not scroll, a full page
//     reaches the card's bottom edge (its rows stretched over the room left, at most 3 px short), every row is on exactly one page;
//   - `?long_lists=scroll`: every row drawn, no pager, the table scrolls inside itself as before.
// Phone 390x844 (mobile project): unchanged - the compact list, every loaded row, the page scrolls (the header leaves room for about one
// compact row: owner question in docs/changes/TICKETS-PAGING-2490.md);
//   - selection across pages, the keyboard across pages, "load more" on the last page, the place kept when the bulk bar shows.
// TKPAGE_SHOTS=<dir> saves screenshots (the before / after comparison; TKPAGE_SHOTS_ONLY=1 skips the assertions - for the base commit).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-tickets-table-paging-2490.spec.ts --project=desktop --project=mobile

const SHOTS = process.env.TKPAGE_SHOTS ?? '';
const SHOTS_ONLY = process.env.TKPAGE_SHOTS_ONLY === '1';
const T = 'sw-app tickets-list tickets-table';
const MANY: TableMockOptions = { board: { view: 'table' }, many: 40 };

const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800, project: 'desktop' },
  { name: '1440x900', width: 1440, height: 900, project: 'desktop' },
  { name: '1920x1080', width: 1920, height: 1080, project: 'desktop' },
  { name: '1024x768', width: 1024, height: 768, project: 'desktop' },
  { name: '820x1180', width: 820, height: 1180, project: 'desktop' },
  { name: '390x844', width: 390, height: 844, project: 'mobile' },
] as const;

interface Fit {
  on: boolean;
  page: number;
  pages: number;
  drawn: number[];
  total: number;
  regionOverflow: number;
  roomLeft: number;
  rowH: number;
  screenOverflow: number;
  mainOverflow: number;
}

async function open(page: Page, o: TableMockOptions = MANY, query = '') {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installTableMock(page, o);
  await page.goto('about:blank');
  await page.goto(url('/tickets/mine?status=all').replace('/?', `/?${query ? `${query}&` : ''}`));
  await page.waitForSelector(`${T} [data-row]`);
  await settle(page);
}

const settle = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 4; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(150);
};

/** Where the pages stand: what is drawn, the region's and the screen's overflow, the room left below the last row. */
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
    const host = deep(document, 'tickets-table') as HTMLElement;
    const list = deep(document, 'tickets-list') as HTMLElement;
    const main = deep(document, 'main') as HTMLElement;
    const sr = host.shadowRoot!;
    const region = sr.querySelector<HTMLElement>('[data-compact-list], [data-table-wrap]')!;
    const rows = [...sr.querySelectorAll<HTMLElement>('[data-row]')];
    const table = sr.querySelector('table[data-tickets-table]');
    const pager = sr.querySelector('[data-table-pager]') as (HTMLElement & { page: number; pages: number }) | null;
    const count = Number((sr.querySelector('tickets-table-toolbar') as unknown as { count: number }).count);
    const rb = region.getBoundingClientRect();
    const inner = rb.top + region.clientTop + region.clientHeight;
    const last = rows.at(-1)!.getBoundingClientRect();
    return {
      on: host.hasAttribute('data-pages-on'),
      page: pager?.page ?? 1,
      pages: pager?.pages ?? 1,
      drawn: rows.map((r) => (table ? Number(r.dataset.rowIndex) : rows.indexOf(r))).map((n, i) => (Number.isNaN(n) ? i : n)),
      total: count,
      regionOverflow: region.scrollHeight - region.clientHeight,
      roomLeft: Math.round(inner - last.bottom),
      rowH: Math.round(rows.reduce((s, r) => s + r.getBoundingClientRect().height, 0) / rows.length),
      screenOverflow: list.scrollHeight - list.clientHeight,
      mainOverflow: main ? main.scrollHeight - main.clientHeight : 0,
    };
  });

/** The ids of the rows drawn now. */
const drawnIds = (page: Page) => page.locator(`${T} [data-row]`).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.row ?? ''));

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

test.describe('tickets table pages (TICKETS-PAGING-2490)', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  });

  for (const vp of VIEWPORTS) {
    test(`${vp.name}: paged by default (fills the room, nothing scrolls), every row on one page; long_lists=scroll scrolls as before`, async ({ page }, info) => {
      test.skip(info.project.name !== vp.project, `${vp.project} project`);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await open(page);
      if (vp.project === 'mobile') {
        // the phone keeps the compact list and the page's own scroll
        const m = await measure(page);
        await shot(page, `table-${vp.name}-p1`);
        console.log(`${vp.name}: compact rows drawn ${m.drawn.length} of ${m.total}, screen overflow ${m.screenOverflow}`);
        if (!SHOTS_ONLY) {
          expect(m.on).toBe(false);
          expect(m.drawn.length).toBe(40);
          await expect(page.locator(`${T} [data-table-pager]`)).toHaveCount(0);
          expect(m.screenOverflow, 'a phone: the page scrolls').toBeGreaterThan(1);
        }
        return;
      }
      const f = await measure(page);
      await shot(page, `table-${vp.name}-p1`);
      test.info().annotations.push({ type: 'measured', description: `${vp.name} paged: ${JSON.stringify({ ...f, drawn: f.drawn.length })}` });
      console.log(`${vp.name} paged: page ${f.page}/${f.pages}, rows on page 1 ${f.drawn.length} of ${f.total}, row ${f.rowH}px, room left ${f.roomLeft}px, region overflow ${f.regionOverflow}, screen overflow ${f.screenOverflow}, main overflow ${f.mainOverflow}`);
      if (!SHOTS_ONLY) {
        expect(f.on, 'the pages are in force').toBe(true);
        expect(f.total).toBe(40);
        expect(f.pages, 'more than one page').toBeGreaterThan(1);
        expect(f.drawn.length).toBeLessThan(f.total);
        expect(f.regionOverflow, 'the table region does not scroll').toBeLessThanOrEqual(1);
        expect(f.screenOverflow, 'the tickets screen does not scroll').toBeLessThanOrEqual(1);
        expect(f.mainOverflow, 'the shell does not scroll').toBeLessThanOrEqual(1);
        expect(f.roomLeft, 'a full page reaches the bottom edge of the card (its rows stretched)').toBeLessThanOrEqual(3);
        expect(f.roomLeft).toBeGreaterThanOrEqual(-1);
        // every row on exactly one page
        const seen: string[] = [...(await drawnIds(page))];
        for (let p = 2; p <= f.pages; p++) {
          await page.locator(`${T} [data-table-pager]`).evaluate((el, n) => el.dispatchEvent(new CustomEvent('page-change', { detail: { page: n }, bubbles: true, composed: true })), p);
          await settle(page);
          const g = await measure(page);
          expect(g.page).toBe(p);
          expect(g.regionOverflow, `page ${p} does not scroll`).toBeLessThanOrEqual(1);
          expect(g.screenOverflow).toBeLessThanOrEqual(1);
          if (p < f.pages) expect(g.roomLeft, `page ${p} reaches the bottom edge`).toBeLessThanOrEqual(3);
          if (p === 2) await shot(page, `table-${vp.name}-p2`);
          seen.push(...(await drawnIds(page)));
        }
        expect(seen.length, 'every row once').toBe(40);
        expect(new Set(seen).size).toBe(40);
      }
      // the installation's long lists set to scroll: the old inner scroll
      await open(page, MANY, 'long_lists=scroll');
      const s = await measure(page);
      await shot(page, `table-${vp.name}-scroll`);
      console.log(`${vp.name} long_lists=scroll: rows drawn ${s.drawn.length}, region overflow ${s.regionOverflow}, screen overflow ${s.screenOverflow}`);
      if (!SHOTS_ONLY) {
        expect(s.on).toBe(false);
        expect(s.drawn.length).toBe(40);
        await expect(page.locator(`${T} [data-table-pager]`)).toHaveCount(0);
        expect(s.regionOverflow, 'the table scrolls inside itself').toBeGreaterThan(1);
        expect(s.screenOverflow).toBeLessThanOrEqual(1);
      }
    });
  }

  test('a few rows: one page, no pager, the table looks as before', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop' || SHOTS_ONLY, 'desktop');
    await open(page, { board: { view: 'table' }, many: 4 });
    const f = await measure(page);
    expect(f.total).toBe(4);
    expect(f.pages).toBe(1);
    await expect(page.locator(`${T} [data-table-pager]`)).toHaveCount(0);
    expect(f.drawn.length).toBe(f.total);
    expect(f.regionOverflow).toBeLessThanOrEqual(1);
  });

  test('selection across pages: the header box takes this page, the bulk bar names the other pages, "select all" takes every loaded row', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop' || SHOTS_ONLY, 'desktop');
    await open(page);
    const f = await measure(page);
    const head = page.locator(`${T} [data-select-page]`);
    await head.click();
    const bulk = page.locator(`${T} tickets-table-bulk`);
    await expect(bulk.locator('[data-bulk-count]')).toContainText(String(f.drawn.length));
    await expect(bulk.locator('[data-bulk-off]')).toHaveCount(0);
    await settle(page);
    const g = await measure(page);
    expect(g.regionOverflow, 'the bulk bar takes its room: the page is cut again').toBeLessThanOrEqual(1);
    const p1 = await drawnIds(page);
    await page.locator(`${T} [data-table-pager]`).evaluate((el) => el.dispatchEvent(new CustomEvent('page-change', { detail: { page: 2 }, bubbles: true, composed: true })));
    await settle(page);
    const off = await bulk.locator('[data-bulk-off]').textContent();
    // the rows still selected from page 1 that page 2 does not draw
    const p2 = await drawnIds(page);
    const stillOff = p1.filter((id) => !p2.includes(id)).length;
    expect(off).toContain(String(stillOff));
    await expect(page.locator(`${T} tbody tr[aria-selected="true"]`)).toHaveCount(p1.filter((id) => p2.includes(id)).length);
    await shot(page, 'select-page2');
    // Ctrl+A: this page joins, the first page keeps its rows
    await page.locator(`${T} tbody tr`).first().focus();
    await page.keyboard.press('Control+A');
    await expect(page.locator(`${T} tbody tr[aria-selected="true"]`)).toHaveCount(p2.length);
    await expect(bulk.locator('[data-bulk-count]')).toContainText(String(new Set([...p1, ...p2]).size));
    // "select all N": every loaded row
    await bulk.locator('[data-bulk-all]').click();
    await expect(bulk.locator('[data-bulk-count]')).toContainText('40');
    await expect(bulk.locator('[data-bulk-all]')).toHaveCount(0);
    // the header box clears this page only
    await head.click();
    await expect(page.locator(`${T} tbody tr[aria-selected="true"]`)).toHaveCount(0);
    await expect(bulk.locator('[data-bulk-count]')).toContainText(String(40 - (await drawnIds(page)).length));
  });

  test('the keyboard crosses the pages; a row selected on page 2 keeps page 2 when the bulk bar shows', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop' || SHOTS_ONLY, 'desktop');
    await open(page);
    const f = await measure(page);
    const lastIdx = f.drawn.at(-1)!;
    await page.locator(`${T} tbody tr[data-row-index="${lastIdx}"]`).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator(`${T} tbody tr[data-row-index="${lastIdx + 1}"]`)).toBeFocused();
    const g = await measure(page);
    expect(g.page).toBe(2);
    expect(g.drawn[0]).toBe(lastIdx + 1);
    await page.keyboard.press('Home');
    await expect(page.locator(`${T} tbody tr[data-row-index="0"]`)).toBeFocused();
    expect((await measure(page)).page).toBe(1);
    // page 2, select its second row: the bulk bar appears, the page keeps its first row
    await page.locator(`${T} [data-table-pager]`).evaluate((el) => el.dispatchEvent(new CustomEvent('page-change', { detail: { page: 2 }, bubbles: true, composed: true })));
    await settle(page);
    const before = await measure(page);
    await page.locator(`${T} tbody [data-select]`).nth(1).click();
    await page.locator(`${T} tickets-table-bulk [data-bulk-bar]`).waitFor();
    await settle(page);
    const after = await measure(page);
    expect(after.drawn[0], 'the place is kept').toBe(before.drawn[0]);
    expect(after.regionOverflow).toBeLessThanOrEqual(1);
  });

  test('"load more" sits beside the pager on the last page and shows the page of its first new row', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop' || SHOTS_ONLY, 'desktop');
    await open(page, { board: { view: 'table' }, many: 70 });
    const f = await measure(page);
    expect(f.total).toBe(50);
    await expect(page.locator(`${T} [data-load-more]`)).toHaveCount(0);
    await page.locator(`${T} [data-table-pager]`).evaluate((el, n) => el.dispatchEvent(new CustomEvent('page-change', { detail: { page: n }, bubbles: true, composed: true })), f.pages);
    await settle(page);
    const more = page.locator(`${T} tickets-table-toolbar [data-load-more]`);
    await expect(more).toBeVisible();
    await more.click();
    await expect(page.locator(`${T} tbody tr[data-row-index="50"]`)).toBeVisible();
    await settle(page);
    const g = await measure(page);
    expect(g.total).toBe(70);
    expect(g.drawn).toContain(50);
    expect(g.regionOverflow).toBeLessThanOrEqual(1);
  });
});
