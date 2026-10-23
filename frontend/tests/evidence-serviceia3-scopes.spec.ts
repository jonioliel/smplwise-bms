import { test, expect, type Page, type Route } from '@playwright/test';
import { installTicketsMock, url, type TicketsMockOptions } from './tickets-mocks';

// SERVICEIA3-295 (owner decision, after slice 2): SERVICEIA2 turned שלי · המחלקה · הכול into the request list's scope segment and, with it,
// removed the administrator's ability to hide each scope separately. This restores it: הגדרות › כללי › לשוניות has a card for the segment
// (`ui.tabs` section `tickets.scopes`), each scope has its own show / hide switch and its own place in the order, the list offers exactly
// what is left, and the scope ADDRESSES keep working (presentation only). Real build against the mock layer + a stateful `ui.tabs`, desktop and phone.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-serviceia3-scopes.spec.ts --project=desktop --project=mobile --workers=1
const L = 'sw-app tickets-list';
const ED = 'sw-app system-diagnostics system-tabs-config';

interface Srv {
  uiTabs: Record<string, unknown>;
  patches: Record<string, unknown>[];
}

async function go(page: Page, srv: Srv, hash: string, o: TicketsMockOptions = { persona: 'admin' }): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installTicketsMock(page, o);
  // registered after the tickets mock, so it answers first: the same settings plus a stateful `ui.tabs`
  await page.route('**/api/v1/settings', (route: Route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      srv.patches.push(body);
      if ('ui.tabs' in body) srv.uiTabs = body['ui.tabs'] as Record<string, unknown>;
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: { 'ui.design': 'a', 'tickets.enabled': 'true', 'ui.tabs': srv.uiTabs }, can_edit: true }) });
  });
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', 'light'));
}

const scopes = (page: Page) => page.locator(`${L} [data-scope-seg] button[data-scope]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-scope')));

test.describe('service area: the administrator hides each scope of the request list (SERVICEIA3-295)', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the editor has the card; hiding המחלקה and saving removes that one scope from the list, the others stay', async ({ page }) => {
    const srv: Srv = { uiTabs: {}, patches: [] };
    await go(page, srv, '/system/diagnostics?tab=tabs');
    const ed = page.locator(ED);
    const card = ed.locator('[data-tabs-section="tickets.scopes"]');
    await expect(card).toHaveCount(1);
    expect(await ed.locator('li[data-sec="tickets.scopes"] .name').allTextContents()).toEqual(['שלי', 'המחלקה', 'הכול']);
    // each scope has its own switch; the last visible one cannot be switched off
    await expect(ed.locator('li[data-sec="tickets.scopes"] sw-toggle[data-visible]')).toHaveCount(3);
    await ed.locator('li[data-sec="tickets.scopes"][data-tab="department"] sw-toggle[data-visible="department"]').scrollIntoViewIfNeeded();
    await ed.locator('li[data-sec="tickets.scopes"][data-tab="department"] sw-toggle[data-visible="department"]').click();
    await ed.locator('[data-tabs-save]').click();
    await expect.poll(() => srv.patches.length).toBe(1);
    const saved = srv.patches[0]['ui.tabs'] as Record<string, { order: string[]; hidden: string[] }>;
    expect(saved['tickets.scopes'].hidden).toEqual(['department']);

    // after a reload the list offers שלי and הכול only
    await go(page, srv, '/tickets/mine');
    await page.waitForSelector(`${L} [data-scope-seg]`);
    await expect.poll(() => scopes(page)).toEqual(['mine', 'all']);
    await expect(page.locator(`${L} button[data-scope="department"]`)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test('each of the three can be hidden on its own, and the order is the configured one', async ({ page }) => {
    for (const [hide, left] of [['mine', ['department', 'all']], ['department', ['mine', 'all']], ['all', ['mine', 'department']]] as const) {
      const srv: Srv = { uiTabs: { 'tickets.scopes': { order: [], hidden: [hide] } }, patches: [] };
      await go(page, srv, left[0] === 'mine' ? '/tickets/mine' : '/tickets/department');
      await page.waitForSelector(`${L} [data-scope-seg]`);
      await expect.poll(() => scopes(page), hide).toEqual(left);
    }
    const srv: Srv = { uiTabs: { 'tickets.scopes': { order: ['all', 'department', 'mine'], hidden: [] } }, patches: [] };
    await go(page, srv, '/tickets/all');
    await page.waitForSelector(`${L} [data-scope-seg]`);
    await expect.poll(() => scopes(page)).toEqual(['all', 'department', 'mine']);
  });

  test('presentation only: a hidden scope address still opens and still shows where the user is; #/tickets/list lands on the first scope left', async ({ page }) => {
    const srv: Srv = { uiTabs: { 'tickets.scopes': { order: [], hidden: ['mine'] } }, patches: [] };
    await go(page, srv, '/tickets/mine');
    await page.waitForSelector(`${L} [data-scope-seg]`);
    await expect(page).toHaveURL(/#\/tickets\/mine$/); // no redirect: the address keeps working
    await expect(page.locator(`${L} button[data-scope="mine"]`)).toHaveAttribute('aria-checked', 'true'); // a direct link shows where he is
    await go(page, srv, '/tickets/list?status=closed');
    await expect(page).toHaveURL(/#\/tickets\/department\?status=closed/);
  });

  test('a user without "הכול" is offered the same scopes as before whatever is hidden (permissions first)', async ({ page }) => {
    const srv: Srv = { uiTabs: { 'tickets.scopes': { order: [], hidden: ['department'] } }, patches: [] };
    await go(page, srv, '/tickets/mine', { persona: 'operator' });
    await page.waitForSelector(`${L} [data-scope-seg]`);
    await expect.poll(() => scopes(page)).toEqual(['mine']);
  });
});
