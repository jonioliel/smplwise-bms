import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './tickets-mocks';
import { installDeleteMock, type DeleteMock, type DeleteMockOptions } from './tickets-delete-mocks';

// Owner 14.10 evidence: full deletion of tickets from the REAL build against the mock layer (fake data) - the drawer's "מחיקת בקשת
// שירות" (danger, only with tickets.delete), its dialog (the number typed, a reason, what goes in one line), the drawer closing and the
// table refreshing; the table's bulk bar "מחיקה" with the count typed and per-ticket results; a refusal shown as the server sent it.
// Desktop 1440 and phone 390, light / dark, classic / domus (the five-skin sweep is layout-tickets-delete.spec.ts).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-delete.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-delete');
const T = 'sw-app tickets-list tickets-table';
const D = 'sw-app tickets-list ticket-detail';
const DLG = `${D} tickets-delete-dialog`;
const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 768;
const A02 = '0000000000000a02'; // #1043, maintenance, new

async function go(page: Page, hash: string, o: DeleteMockOptions = {}, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<DeleteMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const mock = await installDeleteMock(page, o);
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

test.describe('tickets deletion evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the drawer: the danger action, the dialog (number + reason), the drawer closes and the row leaves', async ({ page }) => {
    test.slow(); // FLAKY-2250-297: five page loads and ten screenshots (four skin/scheme sweeps, then the real flow) in one test: 60 s is not enough on a loaded runner's phone project
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, `/tickets/mine?t=${A02}`, {}, scheme, skin);
        await page.locator(`${D} [data-more]`).click(); // TKUI1: the deletion lives in the drawer's "⋯" menu
        const btn = page.locator(`${D} [data-delete-ticket]`);
        await btn.waitFor();
        await expect(btn).toContainText('מחיקת בקשת שירות');
        await shot(page, 'drawer-action', scheme, skin);
        await btn.click();
        await page.locator(`${DLG} [data-delete-confirm]`).waitFor();
        await shot(page, 'dialog-empty', scheme, skin);
        await page.locator(`${DLG} [data-delete-confirm]`).fill('1043');
        await page.locator(`${DLG} [data-delete-reason]`).fill('נפתחה פעמיים בטעות');
        await shot(page, 'dialog-ready', scheme, skin);
      }
    const mock = await go(page, `/tickets/mine?t=${A02}`);
    await page.locator(`${D} [data-more]`).click();
    await page.locator(`${D} [data-delete-ticket]`).click();
    const go_ = page.locator(`${DLG} [data-delete-go]`);
    await expect(page.locator(`${DLG} [data-delete-goes]`)).toContainText('הערות, תמונות, קישורים');
    await expect(go_).toBeDisabled();
    await page.locator(`${DLG} [data-delete-confirm]`).fill('1042');
    await page.locator(`${DLG} [data-delete-reason]`).fill('כפילות');
    await expect(go_).toBeDisabled(); // the wrong number
    await page.locator(`${DLG} [data-delete-confirm]`).fill('1043');
    await expect(go_).toBeEnabled();
    await go_.click();
    await expect.poll(() => mock.calls.at(-1)?.path).toBe(`tickets/${A02}/delete`);
    expect(mock.calls.at(-1)?.body).toMatchObject({ reason: 'כפילות', confirm_number: 1043 });
    await expect(page).not.toHaveURL(/t=0000000000000a02/);
    await expect(page.locator(`${DLG} [data-delete-confirm]`)).toHaveCount(0); // 2.5.4: the dialog closes after the first answer
    await expect(page.locator('sw-app tickets-list [data-tickets-toast]')).toContainText('נמחקה');
    if (!isPhone(page)) await expect(page.locator(`${T} tbody tr[data-row="${A02}"]`)).toHaveCount(0);
    await shot(page, 'after-delete');
  });

  test('a refusal is shown as the server sent it (an approved cost claim)', async ({ page }) => {
    await go(page, `/tickets/mine?t=${A02}`, { costBlocked: [A02] });
    await page.locator(`${D} [data-more]`).click();
    await page.locator(`${D} [data-delete-ticket]`).click();
    await page.locator(`${DLG} [data-delete-confirm]`).fill('1043');
    await page.locator(`${DLG} [data-delete-reason]`).fill('כפילות');
    await page.locator(`${DLG} [data-delete-go]`).click();
    await expect(page.locator(`${DLG} [data-delete-error]`)).toContainText('דרישת תשלום שאושרה');
    await shot(page, 'dialog-refused');
  });

  test('without tickets.delete: no action in the drawer, no entry in the bulk bar', async ({ page }) => {
    await go(page, `/tickets/mine?t=${A02}`, { noDelete: true });
    await page.locator(`${D} [data-ticket-detail]`).waitFor();
    await page.locator(`${D} [data-more]`).click();
    await expect(page.locator(`${D} [data-drawer-menu]`)).toBeVisible();
    await expect(page.locator(`${D} [data-delete-ticket]`)).toHaveCount(0);
    await page.keyboard.press('Escape');
    test.skip(isPhone(page), 'the bar on desktop');
    await page.goto(url('/tickets/mine'));
    await page.locator(`${T} tbody [data-select]`).first().click();
    await page.locator(`${T} tickets-table-bulk [data-bulk-bar]`).waitFor();
    await expect(page.locator(`${T} tickets-table-bulk [data-bulk="delete"]`)).toHaveCount(0);
  });

  test('the bulk bar: "מחיקה", the count typed, per-ticket results, the rows leave', async ({ page }) => {
    test.skip(isPhone(page), 'the table selection on desktop');
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, '/tickets/mine', {}, scheme, skin);
        await page.locator(`${T} tbody [data-select]`).nth(0).click();
        await page.locator(`${T} tbody [data-select]`).nth(2).click({ modifiers: ['Shift'] });
        await page.locator(`${T} tickets-table-bulk [data-bulk="delete"]`).click();
        await page.locator(`${T} tickets-delete-dialog [data-delete-confirm]`).fill('3');
        await page.locator(`${T} tickets-delete-dialog [data-delete-reason]`).fill('ניקוי כפילויות');
        await shot(page, 'bulk-dialog', scheme, skin);
      }
    const mock = await go(page, '/tickets/mine', { costBlocked: ['0000000000000a04'] });
    await page.locator(`${T} tbody tr`).first().waitFor();
    const before = await page.locator(`${T} tbody tr`).count();
    await page.locator(`${T} tbody [data-select]`).nth(0).click();
    await page.locator(`${T} tbody [data-select]`).nth(2).click({ modifiers: ['Shift'] });
    const dlg = `${T} tickets-delete-dialog`;
    await page.locator(`${T} tickets-table-bulk [data-bulk="delete"]`).click();
    await page.locator(`${dlg} [data-delete-confirm]`).fill('2');
    await page.locator(`${dlg} [data-delete-reason]`).fill('ניקוי');
    await expect(page.locator(`${dlg} [data-delete-go]`)).toBeDisabled();
    await page.locator(`${dlg} [data-delete-confirm]`).fill('3');
    await page.locator(`${dlg} [data-delete-go]`).click();
    await expect.poll(() => mock.calls.at(-1)?.path).toBe('tickets/bulk-delete');
    expect((mock.calls.at(-1)?.body as { ids: string[] }).ids).toHaveLength(3);
    await expect(page.locator(`${T} tbody tr`)).toHaveCount(before - 2); // two deleted; the blocked one stays (selected for a retry)
    await expect(page.locator(`${T} tbody tr[data-row="0000000000000a04"]`)).toHaveCount(1);
    await shot(page, 'bulk-after');
  });
});
