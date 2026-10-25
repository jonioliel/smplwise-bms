import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url, type TicketsMock, type TicketsMockOptions } from './tickets-mocks';
import { installBoardMock, type BoardMock, type BoardMockOptions } from './tickets-board-mocks';
import { installTableMock, type TableMock, type TableMockOptions } from './tickets-table-mocks';

// TKUI4 evidence (release 2.6.0, mock-up v5): the request LIST in its three modes from the REAL build against the mock layer (fake data) -
// the page frame (scope and state segments with counts, department chips with counts, the filter row, the view switch), the cards (the
// status sentence, the sub-state inside the chip, at most three chips, the avatar pair), the table (the "what is happening" column, the
// floating bulk bar), and the manager board (the today row - the board only - the load meter, the warning line, the quiet closed rows).
// Desktop 1440 and phone 390, light / dark, classic / domus (the five-skin sweep is layout-tickets*.spec.ts). Screenshots in
// docs/design/evidence/tickets-ui4/. The weekly calendar (task TKCAL) is the fourth mode: evidence-tickets-calendar.spec.ts.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-ui4.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-ui4');
const L = 'sw-app tickets-list';
const B = 'sw-app tickets-board';
const T = 'sw-app tickets-list tickets-table';
const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 768;

async function goList(page: Page, hash: string, o: TicketsMockOptions = {}, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<TicketsMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const mock = await installTicketsMock(page, o);
  await page.goto('about:blank');
  await page.goto(url(hash, skin, scheme));
  return mock;
}
async function goBoard(page: Page, hash: string, o: BoardMockOptions = {}, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<BoardMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const mock = await installBoardMock(page, o);
  await page.goto('about:blank');
  await page.goto(url(hash, skin, scheme));
  return mock;
}
async function goTable(page: Page, hash: string, o: TableMockOptions = { board: { view: 'table' } }, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<TableMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const mock = await installTableMock(page, o);
  await page.goto('about:blank');
  await page.goto(url(hash, skin, scheme));
  return mock;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', skin = 'classic', full = false): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`), fullPage: full });
}

test.describe('tickets list v5 evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('cards: the sentence is the status, the sub-state sits inside the chip, at most three chips, the avatar pair', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await goList(page, '/tickets/mine', {}, scheme, skin);
        await page.waitForSelector(`${L} ticket-card`);
        await shot(page, 'cards', scheme, skin);
      }
    const cards = page.locator(`${L} ticket-card`);
    const n = await cards.count();
    expect(n).toBeGreaterThan(3);
    for (let i = 0; i < n; i++) {
      const c = cards.nth(i);
      await expect(c.locator('[data-card-sentence]'), `card ${i}: the sentence`).not.toHaveText('');
      expect(await c.locator('[data-card-chips] .chip').count(), `card ${i}: at most three chips`).toBeLessThanOrEqual(3);
      await expect(c.locator('[data-card-status]'), `card ${i}: ONE status chip`).toHaveCount(1);
      await expect(c.locator('[data-card-excerpt]'), 'the description excerpt is gone: the sentence replaced it').toHaveCount(0);
    }
    // the part wait is "בטיפול" with the sub-label inside the SAME chip (never a second chip, never a step)
    const part = page.locator(`${L} ticket-card[data-picked], ${L} ticket-card`).locator('[data-card-status] .subst').first();
    await expect(part).toHaveText(/ממתין לחלק/);
    await expect(page.locator(`${L} ticket-card [data-card-status]`).filter({ has: page.locator('.subst') }).first()).toHaveAttribute('aria-label', 'בטיפול · ממתין לחלק');
    // the assigned ones carry the avatar pair (labelled for a screen reader), the unassigned ones none
    const pair = page.locator(`${L} ticket-card [data-card-pair] .av`).first();
    await expect(pair).toHaveAttribute('role', 'img');
    expect(((await pair.getAttribute('aria-label')) ?? '').length).toBeGreaterThan(3);
    // a card never shows the warning line on the list (that is the board's)
    await expect(page.locator(`${L} [data-card-warning]`)).toHaveCount(0);
  });

  test('the page frame: scope and state segments with counts, department counts, the scope is a link to its list', async ({ page }) => {
    const mock = await goList(page, '/tickets/mine');
    await page.waitForSelector(`${L} ticket-card`);
    // SERVICEIA2-295: the segment offers exactly the scopes the old level-1 tabs were offered for; the default persona (manager) has no
    // tickets.all_departments, so "הכול" is not his (the three-scope admin case is evidence-serviceia2-list.spec.ts)
    await expect(page.locator(`${L} [data-scope-seg] [data-scope]`)).toHaveCount(2);
    await expect(page.locator(`${L} [data-scope-seg] [data-scope="all"]`)).toHaveCount(0);
    await expect(page.locator(`${L} [data-scope-seg] [data-scope="mine"]`)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator(`${L} [data-scope-seg] [data-scope="department"] small`)).toBeVisible();
    const open = await page.locator(`${L} [data-status-filter="open"] small`).textContent();
    expect(Number(open)).toBe(await page.locator(`${L} ticket-card`).count()); // the segment's count IS what the list shows
    await expect(page.locator(`${L} [data-status-filter="all"] small`)).toBeVisible();
    await expect(page.locator(`${L} [data-dept=""] small`)).toBeVisible();
    expect(mock.calls.some((c) => c.path.startsWith('tickets/facets'))).toBe(true);
    await page.locator(`${L} [data-scope-seg] [data-scope="department"]`).click();
    await expect(page).toHaveURL(/#\/tickets\/department/);
    await expect(page.locator(`${L} [data-scope-seg] [data-scope="department"]`)).toHaveAttribute('aria-checked', 'true');
    await page.waitForSelector(`${L} ticket-card`);
    await shot(page, 'frame-department');
  });

  test('the page title compacts while the page scrolls (a layer over the title row, no change of height)', async ({ page }) => {
    await goList(page, '/tickets/mine');
    await page.waitForSelector(`${L} ticket-card`);
    const header = page.locator(`${L} [data-tickets-header]`);
    await expect(header).not.toHaveClass(/compact/);
    const before = (await header.boundingBox())?.height ?? 0;
    await page.locator(L).evaluate((h) => { (h as HTMLElement).scrollTop = 400; });
    await expect(header).toHaveClass(/compact/);
    expect(Math.abs(((await header.boundingBox())?.height ?? 0) - before), 'compacting never changes the header height').toBeLessThanOrEqual(1);
  });

  test('the filter row: hidden until asked for, narrows the held cards, counts its choices, clears', async ({ page }) => {
    await goList(page, '/tickets/mine');
    await page.waitForSelector(`${L} ticket-card`);
    await expect(page.locator(`${L} [data-filter-row]`)).toHaveCount(0);
    const toggle = page.locator(`${L} [data-filter-toggle]`);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`${L} [data-filter-row]`)).toBeVisible();
    await shot(page, 'filter-row');
    const total = await page.locator(`${L} ticket-card`).count();
    const first = page.locator(`${L} [data-f-priority]`).first();
    const name = ((await first.textContent()) ?? '').trim();
    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toContainText('1');
    const shown = page.locator(`${L} ticket-card`);
    expect(await shown.count()).toBeLessThanOrEqual(total);
    for (let i = 0; i < (await shown.count()); i++) await expect(shown.nth(i).locator('[data-chip="priority"]')).toContainText(name);
    await page.locator(`${L} [data-f-clear]`).click();
    await expect(page.locator(`${L} ticket-card`)).toHaveCount(total);
    await expect(toggle).not.toContainText('·');
    // a handler nobody holds among the held cards: the no-match state with its own clear button
    await page.locator(`${L} [data-f-handler]`).selectOption('none');
    const none = await page.locator(`${L} ticket-card`).count();
    expect(none).toBeLessThan(total);
    await page.locator(`${L} [data-f-handler]`).selectOption('');
    await expect(page.locator(`${L} ticket-card`)).toHaveCount(total);
  });

  test('the view switch: cards and table for everyone, the manager board for managers; the weekly calendar for everyone (TKCAL)', async ({ page }) => {
    await goBoard(page, '/tickets/mine');
    await page.waitForSelector(`${L} ticket-card`);
    await expect(page.locator(`${L} [data-view-switch] [data-view]`)).toHaveCount(4);
    await expect(page.locator(`${L} [data-view-switch] [data-view="calendar"]`)).toHaveCount(1);
    await expect(page.locator(`${L} [data-view-switch] [data-view="cards"]`)).toHaveAttribute('aria-checked', 'true');
    await page.locator(`${L} [data-view-switch] [data-view="board"]`).click();
    await expect(page).toHaveURL(/#\/tickets\/board/);
    await page.waitForSelector(`${B} ticket-card`);
    await expect(page.locator(`${B} [data-view-switch] [data-view="board"]`)).toHaveAttribute('aria-checked', 'true');
    await page.locator(`${B} [data-view-switch] [data-view="cards"]`).click();
    await expect(page).toHaveURL(/#\/tickets\/(mine|department|all)/);
    // not a manager: no board entry in the switch
    await goList(page, '/tickets/mine', { persona: 'operator' });
    await page.waitForSelector(`${L} ticket-card`);
    await expect(page.locator(`${L} [data-view-switch] [data-view]`)).toHaveCount(3);
    await expect(page.locator(`${L} [data-view-switch] [data-view="board"]`)).toHaveCount(0);
  });

  test('the phone: 44 px targets in the page frame and on the card', async ({ page }) => {
    test.skip(!isPhone(page), 'phone only');
    await goList(page, '/tickets/mine');
    await page.waitForSelector(`${L} ticket-card`);
    await page.locator(`${L} [data-filter-toggle]`).click();
    await shot(page, 'phone-frame');
    for (const sel of [`${L} [data-scope-seg] [data-scope="mine"]`, `${L} [data-filter-toggle]`, `${L} [data-f-priority]`, `${L} ticket-card [data-card-menu]`, `${L} ticket-card [data-card-timeline]`]) {
      const box = await page.locator(sel).first().boundingBox();
      expect(box?.height ?? 0, sel).toBeGreaterThanOrEqual(43.5);
    }
  });

  test('the table: the "what is happening" column, the chip cells, the floating bulk bar, the column is a client-only choice', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await goTable(page, '/tickets/mine', { board: { view: 'table' } }, scheme, skin);
        await page.waitForSelector(isPhone(page) ? `${T} [data-compact-list]` : `${T} table[data-tickets-table] tbody tr`);
        await shot(page, 'table', scheme, skin);
      }
    if (isPhone(page)) {
      await expect(page.locator(`${T} [data-compact-list] [data-row-sentence]`).first()).not.toHaveText('');
      return;
    }
    await expect(page.locator(`${T} th[data-col="sentence"]`)).toBeVisible();
    const cells = page.locator(`${T} tbody [data-row-sentence]`);
    expect(await cells.count()).toBeGreaterThan(3);
    for (let i = 0; i < (await cells.count()); i++) await expect(cells.nth(i)).not.toHaveText('');
    await expect(page.locator(`${T} th[data-col="sentence"] button`), 'the sentence column is not sortable (the server knows nothing of it)').toHaveCount(0);
    // columns, saved filters, density and the CSV stay
    for (const sel of ['[data-open="columns"]', '[data-open="views"]', '[data-open="filters"]', '[data-density]', '[data-export]']) await expect(page.locator(`${T} tickets-table-toolbar ${sel}`)).toBeVisible();
    // the bulk bar floats (sticky) after the table once rows are selected
    await page.locator(`${T} [data-select-page]`).check();
    const bar = page.locator(`${T} tickets-table-bulk`);
    await expect(bar.locator('[data-bulk-bar]')).toBeVisible();
    expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
    await shot(page, 'table-bulk');
    await page.locator(`${T} tickets-table-bulk [data-bulk-clear]`).click();
    // the sentence column off: gone, remembered in this browser, back on from the same chooser
    await page.locator(`${T} tickets-table-toolbar [data-open="columns"]`).click();
    await page.locator(`${T} tickets-table-toolbar [data-col-sentence]`).uncheck();
    await expect(page.locator(`${T} th[data-col="sentence"]`)).toHaveCount(0);
    await goTable(page, '/tickets/mine');
    await page.waitForSelector(`${T} table[data-tickets-table] tbody tr`);
    await expect(page.locator(`${T} th[data-col="sentence"]`)).toHaveCount(0);
    await page.locator(`${T} tickets-table-toolbar [data-open="columns"]`).click();
    await page.locator(`${T} tickets-table-toolbar [data-col-sentence]`).check();
    await expect(page.locator(`${T} th[data-col="sentence"]`)).toBeVisible();
  });

  test('the manager board: the today row (the board ONLY), the warning line, the load meter, the quiet closed rows, the floors tree kept', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await goBoard(page, '/tickets/board', {}, scheme, skin);
        await page.waitForSelector(`${B} ticket-card`);
        await shot(page, 'board', scheme, skin, true);
      }
    await expect(page.locator(`${B} [data-board-today]`)).toBeVisible();
    await expect(page.locator(`${B} [data-board-today] [data-today="waiting"]`)).toContainText('4');
    await expect(page.locator(`${B} ticket-card [data-card-sentence]`).first()).not.toHaveText('');
    // the warning line REPLACES the chips of a board card: a card with a warning has no chips row, a card without keeps its chips
    const warned = page.locator(`${B} ticket-card`).filter({ has: page.locator('[data-card-warning]') });
    expect(await warned.count()).toBeGreaterThan(1);
    await expect(warned.first().locator('[data-card-chips]')).toHaveCount(0);
    await expect(page.locator(`${B} [data-section="stuck"] [data-card-warning="stuck"]`)).toHaveAttribute('role', 'note');
    // the handler groups: avatar, name, the count and the oldest, the load meter
    const groups = page.locator(`${B} [data-section="handling"] [data-assignee]`);
    await expect(groups).toHaveCount(3);
    await expect(groups.first().locator('.load')).toHaveAttribute('role', 'img');
    expect(((await groups.first().locator('.load').getAttribute('aria-label')) ?? '').length).toBeGreaterThan(4);
    // the closed ones are quiet rows that open the request
    await expect(page.locator(`${B} [data-closed-row]`)).toHaveCount(0);
    await page.locator(`${B} [data-closed-toggle]`).click();
    await expect(page.locator(`${B} [data-closed-row]`)).toHaveCount(3);
    await shot(page, 'board-closed-rows', 'light', 'classic', true);
    // the floors / areas tree survives (owner requirement) - or the chips on a phone
    await page.locator(B).evaluate((h) => { (h as HTMLElement).scrollTop = 0; });
    if (isPhone(page)) await expect(page.locator(`${B} [data-floor-chips]`)).toBeVisible();
    else await expect(page.locator(`${B} ticket-board-tree`)).toBeVisible();
    await page.locator(`${B} [data-closed-row]`).first().click();
    await expect(page).toHaveURL(/board\?t=/);
  });

  test('the today row is not on the list; the board has the filter row and the same view switch', async ({ page }) => {
    await goList(page, '/tickets/mine');
    await page.waitForSelector(`${L} ticket-card`);
    await expect(page.locator(`${L} [data-board-today]`)).toHaveCount(0);
    await goBoard(page, '/tickets/board');
    await page.waitForSelector(`${B} ticket-card`);
    await page.locator(`${B} [data-filter-toggle]`).click();
    await expect(page.locator(`${B} [data-filter-row]`)).toBeVisible();
    await expect(page.locator(`${B} [data-f-flag="stuck"]`)).toBeVisible(); // board rows carry their stuck state
    const total = await page.locator(`${B} ticket-card`).count();
    await page.locator(`${B} [data-f-flag="stuck"]`).click();
    expect(await page.locator(`${B} ticket-card`).count()).toBeLessThan(total);
    await shot(page, 'board-filter-row');
    await page.locator(`${B} [data-f-clear]`).click();
    await expect(page.locator(`${B} ticket-card`)).toHaveCount(total);
  });
  test('the running clock: on the cards, in the table, on the board and its strip tooltips; static text, no live region', async ({ page }) => {
    await goList(page, '/tickets/mine');
    await page.waitForSelector(`${L} ticket-card`);
    const clock = page.locator(`${L} ticket-card ticket-elapsed [data-elapsed]`);
    // FIX2200: the cards arrive in more than one render - a count taken the moment the first card exists read 3 on the busy runner
    await expect.poll(() => clock.count()).toBeGreaterThan(3);
    await expect(clock.first()).toHaveText(/(פתוחה|טופלה|פתוח|טופל)/);
    await expect(clock.first()).not.toHaveAttribute('aria-live', /.+/);
    expect(await page.locator(`${L} ticket-card ticket-elapsed [aria-live]`).count()).toBe(0);
    await shot(page, 'cards-clock');
    await goBoard(page, '/tickets/board');
    await page.waitForSelector(`${B} ticket-card`);
    await expect(page.locator(`${B} ticket-card ticket-elapsed [data-elapsed="open"]`).first()).toHaveText(/פתוחה/);
    await expect(page.locator(`${B} [data-state="all"]`)).toHaveAttribute('title', /הוותיקה פתוחה/);
    await page.locator(`${B} [data-closed-toggle]`).click();
    await shot(page, 'board-clock');
    if (isPhone(page)) return;
    await goTable(page, '/tickets/mine');
    await page.waitForSelector(`${T} table[data-tickets-table] tbody tr`);
    await page.locator(`${T} tickets-table-toolbar [data-open="columns"]`).click();
    await page.locator(`${T} tickets-table-toolbar [data-col-toggle="created"]`).check();
    await expect(page.locator(`${T} th[data-col="created"] button`)).toHaveAttribute('aria-label', /פתוחה/);
    await expect(page.locator(`${T} tbody td.c-created ticket-elapsed`).first()).toBeVisible();
  });
});
