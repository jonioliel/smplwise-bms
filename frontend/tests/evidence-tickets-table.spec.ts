import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './tickets-mocks';
import { installTableMock, type TableMock, type TableMockOptions } from './tickets-table-mocks';

// CR-038 slice 6b evidence (D24, section 13.6): the board TABLE from the REAL build against the mock layer (fake data) - desktop 1440 and
// phone 390, light / dark, classic / domus (the five-skin sweep is layout-tickets-table.spec.ts). Behaviour asserted on the way: the view
// switch and its per-user memory, server-side sort with Shift+click and aria-sort, the sticky header, the column chooser (opaque, hide /
// reorder / reset, remembered), saved filters (save, apply, default), the table's own filters, multi-select with Shift ranges and the
// bulk bar (one request, per-ticket results), inline status and handler changes with the revision, the keyboard path, density, the CSV
// download and its refusals, the phone's compact list, the states, and the configured module name (D33).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-table.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-s6b');
const T = 'sw-app tickets-list tickets-table';
const TABLE = { board: { view: 'table' } };
const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 768;

async function go(page: Page, hash: string, o: TableMockOptions = TABLE, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<TableMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const mock = await installTableMock(page, o);
  await page.goto('about:blank');
  await page.goto(url(hash, skin, scheme));
  return mock;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`) });
}

const lastCall = (m: TableMock, p: string, method = 'GET') => m.calls.filter((c) => c.path === p && c.method === method).at(-1);

test.describe('tickets table evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the table: light / dark x classic / domus; the view switch is remembered per user', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, '/tickets/mine', TABLE, scheme, skin);
        await page.waitForSelector(isPhone(page) ? `${T} [data-compact-list]` : `${T} table[data-tickets-table] tbody tr`);
        await shot(page, 'table', scheme, skin);
      }
    // from the cards to the table and back: tickets.board.view is written
    const mock = await go(page, '/tickets/mine', {});
    await page.waitForSelector('sw-app tickets-list ticket-card');
    await page.locator('sw-app tickets-list [data-view-switch] [data-view="table"]').click();
    await page.waitForSelector(isPhone(page) ? `${T} [data-compact-list]` : `${T} table[data-tickets-table]`);
    await expect.poll(() => mock.prefs()?.view).toBe('table');
    await page.locator('sw-app tickets-list [data-view-switch] [data-view="cards"]').click();
    await expect.poll(() => mock.prefs()?.view).toBe('cards');
    await expect(page.locator('sw-app tickets-list ticket-card').first()).toBeVisible();
  });

  test('server-side sort: a click, Shift+click for a second key, aria-sort; the sticky header; remembered', async ({ page }) => {
    test.skip(isPhone(page), 'desktop');
    const mock = await go(page, '/tickets/mine');
    const head = (c: string) => page.locator(`${T} th[data-col="${c}"]`);
    await head('title').waitFor();
    await expect(head('activity')).toHaveAttribute('aria-sort', 'descending');
    await head('title').locator('button').click();
    await expect.poll(() => new URLSearchParams(lastCall(mock, 'tickets/table')?.search).get('sort')).toBe('title:asc');
    await expect(head('title')).toHaveAttribute('aria-sort', 'ascending');
    await expect(head('activity')).toHaveAttribute('aria-sort', 'none');
    await head('priority').locator('button').click({ modifiers: ['Shift'] });
    await expect.poll(() => new URLSearchParams(lastCall(mock, 'tickets/table')?.search).get('sort')).toBe('title:asc,priority:asc');
    await expect(head('priority').locator('small')).toHaveText('2');
    await expect.poll(() => mock.prefs()?.sort).toBe('title:asc,priority:asc');
    const sticky = await page.locator(`${T} thead th`).first().evaluate((e) => getComputedStyle(e).position);
    expect(sticky).toBe('sticky');
    const titles = await page.locator(`${T} tbody td.c-title .cv`).allTextContents();
    expect(titles).toEqual([...titles].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });

  test('the column chooser: opaque, hide / show / reorder / reset, remembered', async ({ page }) => {
    test.skip(isPhone(page), 'desktop');
    const mock = await go(page, '/tickets/mine');
    await page.locator(`${T} tbody tr`).first().waitFor();
    await page.locator(`${T} tickets-table-toolbar [data-open="columns"]`).click();
    const pop = page.locator(`${T} tickets-table-toolbar [data-pop="columns"]`);
    await expect(pop).toBeVisible();
    const bg = await pop.evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(bg, 'an OPAQUE menu surface').not.toMatch(/rgba\([^)]*,\s*0(\.\d+)?\)/);
    await shot(page, 'columns');
    await pop.locator('[data-col-toggle="department"]').uncheck();
    await expect(page.locator(`${T} th[data-col="department"]`)).toHaveCount(0);
    await pop.locator('[data-col-toggle="sla"]').check();
    await expect(page.locator(`${T} th[data-col="sla"]`)).toHaveCount(1);
    await expect(pop.locator('[data-col-toggle="title"]')).toBeDisabled();
    await pop.locator('[data-col-up="sla"]').click();
    await expect.poll(() => (mock.prefs()?.columns as string[] | undefined)?.slice(-2)).toEqual(['sla', 'activity']);
    await pop.locator('[data-col-reset]').click();
    await expect(page.locator(`${T} th[data-col="department"]`)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(pop).toHaveCount(0);
  });

  test('saved filters: save the current view, apply one (its filters reach the server), mark the default', async ({ page }) => {
    test.skip(isPhone(page), 'desktop');
    const mock = await go(page, '/tickets/mine', { ...TABLE, views: [{ id: 'v1', name: 'דחופות שלי', view: { view: 'table', filters: { scope: 'mine', status: 'open', priority: ['urgent'] }, sort: 'sla:asc', columns: ['number', 'title', 'status', 'sla'], density: 'compact' } }] });
    await page.locator(`${T} tbody tr`).first().waitFor();
    const tb = page.locator(`${T} tickets-table-toolbar`);
    await tb.locator('[data-open="views"]').click();
    await expect(tb.locator('[data-view="v1"]')).toBeVisible();
    await shot(page, 'views');
    await tb.locator('[data-view-apply="v1"]').click();
    await expect.poll(() => { const s = new URLSearchParams(lastCall(mock, 'tickets/table')?.search); return [s.get('priority'), s.get('sort')]; }).toEqual(['urgent', 'sla:asc']);
    await expect(page.locator(T)).toHaveAttribute('data-density', 'compact');
    await expect(page.locator(`${T} th[data-col="department"]`)).toHaveCount(0);
    await tb.locator('[data-open="views"]').click();
    await tb.locator('[data-view-default="v1"]').click();
    await expect.poll(() => mock.prefs()?.default_view).toBe('v1');
    await tb.locator('[data-view-new]').click();
    await tb.locator('[data-view-name]').fill('תצוגה שנייה');
    await tb.locator('[data-view-save]').click();
    await expect.poll(() => (lastCall(mock, 'tickets/views', 'POST')?.body as { name: string } | undefined)?.name).toBe('תצוגה שנייה');
    expect((lastCall(mock, 'tickets/views', 'POST')?.body as { view: { filters: { priority: string[] } } }).view.filters.priority).toEqual(['urgent']);
  });

  test('the default saved view opens with the table', async ({ page }) => {
    const mock = await go(page, '/tickets/mine', { board: { view: 'table', default_view: 'v1' }, views: [{ id: 'v1', name: 'ממתין לי', view: { view: 'table', filters: { waiting: 'manager' }, sort: 'priority:asc', columns: [], density: 'comfortable' } }] });
    await expect.poll(() => { const s = new URLSearchParams(mock.calls.find((c) => c.path === 'tickets/table')?.search); return [s.get('waiting'), s.get('sort')]; }).toEqual(['manager', 'priority:asc']);
  });

  test('the table filters: priority, handler, waiting - one request with them', async ({ page }) => {
    const mock = await go(page, '/tickets/mine');
    await page.waitForSelector(isPhone(page) ? `${T} [data-compact-list]` : `${T} tbody tr`);
    const tb = page.locator(`${T} tickets-table-toolbar`);
    await tb.locator('[data-open="filters"]').click();
    await tb.locator('[data-f-priority="urgent"]').click();
    await tb.locator('[data-f-assignee="none"]').click();
    await shot(page, 'filters');
    await expect.poll(() => { const s = new URLSearchParams(lastCall(mock, 'tickets/table')?.search); return [s.get('priority'), s.get('assignee')]; }).toEqual(['urgent', 'none']);
    await expect(tb.locator('[data-open="filters"]')).toContainText('2');
    await tb.locator('[data-f-clear]').click();
    await expect.poll(() => new URLSearchParams(lastCall(mock, 'tickets/table')?.search).get('priority')).toBeNull();
  });

  test('multi-select (Shift range, the page) and the bulk bar: one request, per-ticket results', async ({ page }) => {
    test.skip(isPhone(page), 'no multi-select on a phone');
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, '/tickets/mine', TABLE, scheme, skin);
        await page.locator(`${T} tbody tr`).first().waitFor();
        const boxes = page.locator(`${T} tbody [data-select]`);
        await boxes.nth(0).click();
        await boxes.nth(2).click({ modifiers: ['Shift'] });
        await expect(page.locator(`${T} tickets-table-bulk [data-bulk-count]`)).toContainText('3');
        await shot(page, 'selected', scheme, skin);
      }
    const mock = await go(page, '/tickets/mine', { ...TABLE, bulkResults: { '0000000000000a03': 'stale' } });
    await page.locator(`${T} tbody tr`).first().waitFor();
    const boxes = page.locator(`${T} tbody [data-select]`);
    await boxes.nth(0).click();
    await boxes.nth(1).click({ modifiers: ['Shift'] });
    const bulk = page.locator(`${T} tickets-table-bulk`);
    await bulk.locator('[data-bulk="close"]').click();
    await bulk.locator('[data-bulk-go]').click();
    await expect(bulk.locator('[data-bulk-error]')).toBeVisible();
    await bulk.locator('[data-bulk-note]').fill('טופל בסבב הבוקר');
    await shot(page, 'bulk-close');
    await bulk.locator('[data-bulk-go]').click();
    await expect.poll(() => lastCall(mock, 'tickets/bulk', 'POST')?.body).toMatchObject({ action: 'close', params: { note: 'טופל בסבב הבוקר' }, items: [{ id: '0000000000000a02', revision: 3 }, { id: '0000000000000a03', revision: 3 }] });
    await expect(page.locator(`${T} [data-table-toast]`)).toContainText('בוצע ב־1 מתוך 2');
    await shot(page, 'bulk-result');
    await expect(page.locator(`${T} tickets-table-bulk [data-bulk-count]`), 'what failed stays selected').toContainText('1');
    // the page checkbox selects every row of the page; Escape clears
    await page.locator(`${T} tickets-table-bulk [data-bulk-clear]`).click();
    await page.locator(`${T} [data-select-page]`).click();
    await expect(page.locator(`${T} tickets-table-bulk [data-bulk-count]`)).toContainText(String(await page.locator(`${T} tbody tr`).count()));
  });

  test('inline status and handler changes post with the revision the row showed', async ({ page }) => {
    test.skip(isPhone(page), 'desktop');
    const mock = await go(page, '/tickets/mine');
    const row = page.locator(`${T} tbody tr[data-row="0000000000000a03"]`);
    await row.waitFor();
    await row.locator('[data-menu-for^="status:"]').click();
    const menu = row.locator('td.cellmenu .pop[role="menu"]');
    await expect(menu).toBeVisible();
    await shot(page, 'status-menu');
    await menu.locator('[data-move-to="in_progress"]').click();
    await expect.poll(() => lastCall(mock, 'tickets/0000000000000a03/status', 'POST')?.body).toEqual({ to: 'in_progress', revision: 3 });
    await expect(row).toHaveAttribute('data-status', 'in_progress');
    // a move that needs a reason asks for it first
    await row.locator('[data-menu-for^="status:"]').click();
    await row.locator('[data-move-to="closed"]').click();
    const dlg = page.locator(`${T} sw-dialog[data-dialog="table-move"]`);
    await dlg.locator('[data-move-note]').fill('כפילות');
    await dlg.locator('[data-move-ok]').click();
    await expect.poll(() => lastCall(mock, 'tickets/0000000000000a03/status', 'POST')?.body).toEqual({ to: 'closed', note: 'כפילות', revision: 4 });
    const row2 = page.locator(`${T} tbody tr[data-row="0000000000000a02"]`);
    await row2.locator('[data-menu-for^="assignee:"]').click();
    await row2.locator('[data-assign-to="u-avi"]').click();
    await expect.poll(() => lastCall(mock, 'tickets/0000000000000a02/assign', 'POST')?.body).toEqual({ assignee: { kind: 'user', id: 'u-avi' }, revision: 3 });
  });

  test('keyboard: arrows move, Space selects, Ctrl+A the page, Esc clears, Enter opens, / goes to the search', async ({ page }) => {
    test.skip(isPhone(page), 'desktop');
    await go(page, '/tickets/mine');
    const rows = page.locator(`${T} tbody tr`);
    await rows.first().waitFor();
    await rows.first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Control+A');
    await expect(page.locator(`${T} tbody tr[aria-selected="true"]`)).toHaveCount(await rows.count());
    await page.keyboard.press('Escape');
    await expect(page.locator(`${T} tbody tr[aria-selected="true"]`)).toHaveCount(0);
    await rows.nth(1).focus();
    await page.keyboard.press('/');
    await expect(page.locator('sw-app tickets-list input[data-search]')).toBeFocused();
    await rows.nth(0).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/[?&]t=0000000000000a02/);
    await page.locator('sw-app tickets-list ticket-detail [data-ticket-detail]').waitFor();
    await shot(page, 'drawer-over-table');
  });

  test('density: compact rows, remembered', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, '/tickets/mine', { board: { view: 'table', density: 'compact' } }, scheme, skin);
        await page.waitForSelector(isPhone(page) ? `${T} [data-compact-list]` : `${T} tbody tr`);
        await expect(page.locator(T)).toHaveAttribute('data-density', 'compact');
        await shot(page, 'dense', scheme, skin);
      }
    const mock = await go(page, '/tickets/mine');
    await page.locator(`${T} tickets-table-toolbar [data-density]`).click();
    await expect.poll(() => mock.prefs()?.density).toBe('compact');
  });

  test('CSV export: a file download; too many rows and the rate are said in one line', async ({ page }) => {
    test.skip(isPhone(page), 'desktop');
    const mock = await go(page, '/tickets/mine');
    await page.locator(`${T} tbody tr`).first().waitFor();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator(`${T} tickets-table-toolbar [data-export]`).click()]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const params = new URLSearchParams(lastCall(mock, 'tickets/export.csv')?.search);
    expect(params.get('columns')).toBe('number,title,department,priority,status,assignee,place,activity');
    await expect(page.locator(`${T} [data-table-toast]`)).toContainText('3');
    await go(page, '/tickets/mine', { ...TABLE, exportFail: 'too_large' });
    await page.locator(`${T} tbody tr`).first().waitFor();
    await page.locator(`${T} tickets-table-toolbar [data-export]`).click();
    await expect(page.locator(`${T} [data-table-toast]`)).toContainText('5,000');
  });

  test('phone: the compact list (number, title, state, age), no selection; a tap opens the ticket', async ({ page }) => {
    test.skip(!isPhone(page), 'phone');
    await go(page, '/tickets/mine');
    const items = page.locator(`${T} [data-compact-list] a.ci`);
    await items.first().waitFor();
    await expect(page.locator(`${T} [data-select]`)).toHaveCount(0);
    await expect(page.locator(`${T} tickets-table-toolbar [data-open="columns"]`)).toHaveCount(0);
    await items.first().click();
    await expect(page).toHaveURL(/[?&]t=0000000000000a02/);
  });

  test('states: empty, no match, load failure; many rows load page by page', async ({ page }) => {
    await go(page, '/tickets/mine', { ...TABLE, empty: true });
    await page.waitForSelector(`${T} [data-table-state="empty"]`);
    await shot(page, 'empty');
    await go(page, '/tickets/mine', { ...TABLE, failTable: true });
    await page.waitForSelector(`${T} [data-table-state="error"]`);
    await shot(page, 'error');
    const mock = await go(page, '/tickets/mine?status=all', { ...TABLE, many: 70 });
    await page.waitForSelector(isPhone(page) ? `${T} [data-compact-list]` : `${T} tbody tr`);
    await page.locator(`${T} [data-load-more]`).click();
    await expect.poll(() => mock.calls.filter((c) => c.path === 'tickets/table').at(-1)?.search ?? '').toContain('cursor=o50');
  });

  test('D33: a renamed module - the count and the table name carry the new name', async ({ page }) => {
    await go(page, '/tickets/mine', { ...TABLE, name: { one: 'תקלה', many: 'תקלות', gender: 'f' } });
    await page.waitForSelector(isPhone(page) ? `${T} [data-compact-list]` : `${T} tbody tr`);
    await expect(page.locator(`${T} tickets-table-toolbar [data-table-count]`)).toContainText('תקלות');
    const texts = await page.evaluate(() => {
      const out: string[] = [];
      const walk = (root: ParentNode) => {
        for (const el of Array.from(root.querySelectorAll('*'))) {
          if (el.shadowRoot) walk(el.shadowRoot);
          for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && n.textContent?.trim()) out.push(n.textContent.trim());
          for (const a of ['aria-label', 'title']) if (el.getAttribute(a)) out.push(el.getAttribute(a) as string);
        }
      };
      walk(document);
      return out.join(' | ');
    });
    // the default name - the original one and the one of the owner's rename of 14.10 - appears nowhere once renamed
    expect(texts, 'the default name appears nowhere once renamed').not.toMatch(/קריא(ה|ות)|בקש(ת|ות) שירות/);
  });
});
