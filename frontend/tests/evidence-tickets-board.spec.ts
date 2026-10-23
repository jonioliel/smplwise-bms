import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './tickets-mocks';
import { installBoardMock, type BoardMock, type BoardMockOptions } from './tickets-board-mocks';

// CR-038 slice 6 evidence: the manager board from the REAL build against the mock layer (fake data), desktop 1440 and phone 390, light and
// dark, the classic and domus skins (the five-skin sweep is layout-tickets-board.spec.ts). Also asserts behaviour: the sections (ממתין לי /
// תקועות / בטיפול by assignee), the counts of the state strip (D21), a state filter flattens the cards (D20), the floors as a side tree /
// chips / chips + filter panel (D19) and the personal hide / show of the tree (D30, PUT /me/prefs), the display settings rows (PUT
// /tickets/settings), the board tab for managers only and the "not a manager" state.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-board.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-s6');
const B = 'sw-app tickets-board';
const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 768;

async function go(page: Page, hash: string, o: BoardMockOptions = {}, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<BoardMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const mock = await installBoardMock(page, o);
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

test.describe('tickets board evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the board: sections, state strip, side tree - light / dark x classic / domus', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, '/tickets/board', {}, scheme, skin);
        await page.waitForSelector(`${B} ticket-card`);
        await shot(page, 'board', scheme, skin, true);
      }
    await expect(page.locator(`${B} [data-section="waiting"] ticket-card`)).toHaveCount(4);
    await expect(page.locator(`${B} [data-section="stuck"] ticket-card`)).toHaveCount(1);
    await expect(page.locator(`${B} [data-section="handling"] ticket-card`)).toHaveCount(4);
    await expect(page.locator(`${B} [data-section="handling"] [data-assignee]`)).toHaveCount(3);
    await expect(page.locator(`${B} [data-section="closed"] ticket-card`)).toHaveCount(0); // collapsed
    await expect(page.locator(`${B} [data-state-strip] [data-state="all"] small`)).toHaveText('9');
    await expect(page.locator(`${B} [data-state-strip] [data-state="closed"]`)).toContainText('סגורות (הכול)');
    await expect(page.locator(`${B} [data-stuck-banner]`)).toContainText('2 תקועות');
    // TKUI4 (v5): the board card shows the ONE ranked warning line instead of its chips (never both)
    await expect(page.locator(`${B} [data-section="stuck"] [data-card-warning="stuck"]`)).toContainText('ללא עדכון');
    await expect(page.locator(`${B} [data-section="stuck"] [data-card-warning="stuck"]`)).toContainText('נשלחו 2 תזכורות');
    await expect(page.locator(`${B} [data-section="waiting"] [data-card-warning]`).first()).toBeVisible();
    await expect(page.locator(`${B} [data-section="stuck"] [data-card-chips]`)).toHaveCount(0);
    if (!isPhone(page)) {
      await expect(page.locator(`${B} ticket-board-tree`)).toBeVisible();
      await expect(page.locator(`${B} ticket-board-tree [data-place=""] .n`)).toHaveText('9');
    } else {
      await expect(page.locator(`${B} ticket-board-tree`)).toHaveCount(0);
      await expect(page.locator(`${B} [data-floor-chips]`)).toBeVisible();
    }
    // SERVICEIA1-295: the board is a page of the requests section (the level-2 row under the sections)
    await expect(page.locator('sw-app sw-tabs[data-tickets-pages]')).toContainText('לוח מנהל');
  });

  test('a state filter flattens the cards (D20) and lands in the address; the banner jumps to the stuck ones', async ({ page }) => {
    const mock = await go(page, '/tickets/board');
    await page.waitForSelector(`${B} ticket-card`);
    await page.locator(`${B} [data-stuck-go]`).click();
    await expect(page).toHaveURL(/state=stuck/);
    await expect(page.locator(`${B} [data-cards="flat"] ticket-card`)).toHaveCount(2);
    await expect(page.locator(`${B} [data-section]`)).toHaveCount(0);
    expect(mock.calls.some((c) => c.path.startsWith('tickets/board?state=stuck'))).toBe(true);
    await shot(page, 'board-stuck');
    await page.locator(`${B} [data-state="closed"]`).click();
    await expect(page.locator(`${B} [data-cards="flat"] ticket-card`)).toHaveCount(3);
  });

  test('D19 chips and D21 "this week"; D20 never', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, '/tickets/board', { board: { board_floors: 'chips', closed_strip: 'week', grouping: 'never' } }, scheme);
      await page.waitForSelector(`${B} ticket-card`);
      await shot(page, 'board-chips', scheme);
    }
    await expect(page.locator(`${B} ticket-board-tree`)).toHaveCount(0);
    await expect(page.locator(`${B} [data-tree-toggle]`)).toHaveCount(0); // the tree is fully off for the installation
    await expect(page.locator(`${B} [data-state-strip] [data-state="closed"]`)).toContainText('נסגרו השבוע');
    await expect(page.locator(`${B} [data-cards="flat"]`)).toHaveCount(1);
    await page.locator(`${B} [data-floor-chips] [data-place="floor:f1"]`).click();
    await expect(page).toHaveURL(/place=floor%3Af1|place=floor:f1/);
    await expect(page.locator(`${B} ticket-card`)).toHaveCount(2);
  });

  test('D19 chips + tree behind the filter button; D30 the user hides the tree (remembered)', async ({ page }) => {
    test.skip(isPhone(page), 'the tree is never drawn on a phone');
    await go(page, '/tickets/board', { board: { board_floors: 'chips_tree' } });
    await page.waitForSelector(`${B} ticket-card`);
    await page.locator(`${B} [data-filter-btn]`).click();
    await expect(page.locator(`${B} [data-filter-panel] ticket-board-tree`)).toBeVisible();
    await shot(page, 'board-filter-tree');
    const mock = await go(page, '/tickets/board');
    await page.waitForSelector(`${B} ticket-board-tree`);
    await page.locator(`${B} [data-tree-toggle]`).click();
    await expect(page.locator(`${B} ticket-board-tree`)).toHaveCount(0);
    await expect(page.locator(`${B} [data-floor-chips]`)).toBeVisible();
    await expect.poll(() => mock.calls.find((c) => c.method === 'PUT' && c.path === 'me/prefs')?.body).toEqual({ 'tickets.board.tree_hidden': 'hidden' });
    await go(page, '/tickets/board', { treeHidden: true });
    await page.waitForSelector(`${B} ticket-card`);
    await expect(page.locator(`${B} ticket-board-tree`)).toHaveCount(0);
    await shot(page, 'board-tree-hidden');
    await page.locator(`${B} ticket-board-tree, ${B} [data-tree-toggle]`).first().click();
    await expect(page.locator(`${B} ticket-board-tree`)).toBeVisible();
  });

  test('a card opens the ticket in the drawer over the board (D18)', async ({ page }) => {
    await go(page, '/tickets/board');
    await page.waitForSelector(`${B} ticket-card`);
    await page.locator(`${B} [data-section="handling"] ticket-card`).first().locator('a.name').click();
    await expect(page).toHaveURL(/board\?t=0000000000000b0/);
  });

  test('not a manager: the board says so, and its tab is not offered', async ({ page }) => {
    await go(page, '/tickets/board', { persona: 'operator' });
    await page.waitForSelector(`${B} [data-tickets-state="forbidden"]`);
    await shot(page, 'board-forbidden');
    await expect(page.locator('sw-app sw-tabs').first()).not.toContainText('לוח מנהל');
  });

  test('empty board and the module off', async ({ page }) => {
    await go(page, '/tickets/board', { emptyBoard: true });
    await page.waitForSelector(`${B} [data-tickets-state="empty"]`);
    await shot(page, 'board-empty');
    await go(page, '/tickets/board', { enabled: false });
    await page.waitForSelector(`${B} [data-tickets-state="off"]`);
  });

  test('Settings > display: the board rows (D19-D21; the D28 row is slice 2s)', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, '/system/tickets?tab=display', { persona: 'admin' }, scheme);
      await page.waitForSelector('sw-app system-tickets ticket-board-settings [data-ui-board]');
      await page.locator('sw-app system-tickets [data-card="display"]').scrollIntoViewIfNeeded();
      await shot(page, 'settings-display', scheme);
    }
    const mock = await go(page, '/system/tickets?tab=display', { persona: 'admin' });
    await page.waitForSelector('sw-app system-tickets [data-ui-board="grouping:never"]');
    await page.locator('sw-app system-tickets [data-ui-board="grouping:never"]').click();
    await expect.poll(() => mock.calls.find((c) => c.method === 'PUT' && c.path === 'tickets/settings')?.body).toEqual({ revision: 1, ui: { grouping: 'never' } });
    await expect(page.locator('sw-app system-tickets [data-ui-board="grouping:never"]')).toHaveAttribute('aria-checked', 'true');
    await page.locator('sw-app system-tickets [data-ui-board="closed_strip:week"]').click();
    await expect.poll(() => mock.calls.filter((c) => c.method === 'PUT' && c.path === 'tickets/settings').at(-1)?.body).toEqual({ revision: 2, ui: { closed_strip: 'week' } });
  });

  test('a rename reaches the board (D33)', async ({ page }) => {
    await go(page, '/tickets/board', { name: { one: 'פנייה', many: 'פניות', gender: 'f' } });
    await page.waitForSelector(`${B} ticket-card`);
    await expect(page.locator(`${B} [data-tickets-title]`)).toHaveText('פניות');
    const text = await page.locator(B).evaluate((el) => (el.shadowRoot?.textContent ?? '') + document.body.innerText);
    expect(text).not.toMatch(/קריא(ה|ות)/);
  });
});
