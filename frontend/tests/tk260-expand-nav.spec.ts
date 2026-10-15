import { test, expect, type Page } from '@playwright/test';
import { installTicketsMock } from './tickets-mocks';
import { installBoardMock } from './tickets-board-mocks';

// TK260: the drawer's expand arrow (data-full-screen) opens the request on the full screen (#/tickets/<id>), and the full page's
// "to drawer" link goes back; plain and under a path prefix (the remote channel serves the app at /arx/, signed in with a stored session).
// Root cause: leaving the list unmounts its modal drawer; the dialog's queued native `close` was re-raised as the drawer's `close`, and the
// list's drawer-close handler rewrote the address back to the list.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/tk260-expand-nav.spec.ts --project=desktop --workers=1
const ID = '0000000000000a01';
const L = 'sw-app';

async function open(page: Page, prefix: string): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installTicketsMock(page, {});
  if (prefix) {
    const origin = new URL(test.info().project.use.baseURL ?? 'http://127.0.0.1:4173/').origin;
    await page.route(`**${prefix}**`, async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname.includes('/api/v1/')) return route.fallback();
      const r = await route.fetch({ url: origin + u.pathname.slice(prefix.length - 1) + u.search });
      await route.fulfill({ response: r });
    });
    await page.route(`**${prefix}api/v1/auth/session`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'u-ronit', username: 'ronit', display_name: 'Ronit L.' }, session_expires_in: 3600 }) }));
    await page.addInitScript(([key, clientId]) => {
      const tokens = { hassUrl: 'https://ha.invalid', clientId, access_token: 'a', refresh_token: 'r', expires: Date.now() + 3_600_000, expires_in: 1800, user_id: 'u-ronit' };
      try { window.localStorage.setItem(key, JSON.stringify(tokens)); } catch { /* none */ }
    }, ['arx.auth.v1', `${origin}${prefix}`]);
  }
  await page.goto('about:blank');
  await page.goto(`${prefix || '/'}?design=a&skin=classic&scheme=light#/tickets/mine?t=${ID}`);
}

for (const prefix of ['', '/arx/']) {
  test(`TK260 expand and collapse, prefix "${prefix}"`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await open(page, prefix);
    const full = page.locator(`${L} tickets-list ticket-detail [data-full-screen]`);
    await full.waitFor();
    await full.click();
    await expect(page).toHaveURL(new RegExp(`${prefix || '/'}\\?[^#]*#/tickets/${ID}$`));
    await expect(page.locator(`${L} tickets-detail [data-to-drawer]`)).toBeVisible();
    await expect(page.locator(`${L} tickets-list`)).toHaveCount(0);
    await page.waitForTimeout(600); // the address stays on the full screen (nothing rewrites it back to the list)
    await expect(page).toHaveURL(new RegExp(`#/tickets/${ID}$`));
    await page.locator(`${L} tickets-detail [data-to-drawer]`).click();
    await expect(page).toHaveURL(new RegExp(`#/tickets/mine[?]t=${ID}$`));
    await expect(page.locator(`${L} tickets-list [data-ticket-detail="${ID}"]`)).toBeVisible();
    // the other way: the full page's back link returns to the list
    await page.locator(`${L} tickets-list ticket-detail [data-full-screen]`).click();
    await expect(page.locator(`${L} tickets-detail`)).toBeVisible();
    await page.locator(`${L} tickets-detail [data-back]`).click(); // the back link of the full page
    await expect(page).toHaveURL(/#\/tickets\/mine$/);
    await expect(page.locator(`${L} tickets-list ticket-card`).first()).toBeVisible();
  });
}

test('TK260 the manager board drawer expands to the full screen too', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installBoardMock(page, {});
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=classic&scheme=light#/tickets/board?t=${ID}`);
  const full = page.locator(`${L} tickets-board ticket-detail [data-full-screen]`);
  await full.waitFor();
  await full.click();
  await expect(page.locator(`${L} tickets-detail [data-to-drawer]`)).toBeVisible();
  await page.waitForTimeout(600);
  await expect(page).toHaveURL(new RegExp(`#/tickets/${ID}$`));
});
