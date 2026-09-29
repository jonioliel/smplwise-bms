import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

// CR-008 P2 (remote-access hardening), end to end against tests/fixtures/arx_fake_ha.py (the real backend with /arx on,
// a fake Home Assistant core). Run like evidence-arx-remote.spec.ts: SW_LIVE=1 SW_ARX_FIXTURE=1 SW_API_PORT=<port>.
// Desktop only. It proves: the administrator's "כניסות פעילות מרחוק" card lists every remote sign-in with the current
// one marked; revoking one ends it at once (the revoked browser lands on the sign-in page and says why, and cannot
// come back with a refreshed token); the profile menu's "הסשנים שלי" lists the user's own sign-ins and "התנתק מכל
// המקומות" ends every one of them - the other browser included - and the HA refresh tokens behind them.

const ENABLED = process.env.SW_ARX_FIXTURE === '1';
const PORT = process.env.SW_API_PORT || '8349';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const FAKE = `http://127.0.0.1:${process.env.SW_FAKE_HA_PORT || String(Number(PORT) + 2)}`;
const ARX = `${ORIGIN}/arx/`;

test.skip(!ENABLED, 'needs the Arx fixture backend (SW_ARX_FIXTURE=1, tests/fixtures/arx_fake_ha.py)');
test.describe.configure({ mode: 'serial' });

/** One "device": its own browser context and its own client address (the tunnel's CF-Connecting-IP), so the three
 * devices' sign-ins do not share the per-address sign-in limit (10 a minute) with each other or with other specs. */
async function device(browser: Browser, address: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ serviceWorkers: 'block', locale: 'he-IL', timezoneId: 'Asia/Jerusalem', viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { 'CF-Connecting-IP': address } });
  const page = await context.newPage();
  await page.route(`${ORIGIN}/auth/**`, async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${FAKE}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  return { context, page };
}

async function signIn(page: Page, username: string, password: string) {
  await page.goto(ARX);
  const login = page.locator('arx-login');
  await expect(login).toBeVisible();
  await login.locator('#username').fill(username);
  await login.locator('#password').fill(password);
  await login.locator('[data-arx-submit]').click();
  await expect(page.locator('sw-app')).toBeVisible();
  await expect(page.locator('arx-login')).toHaveCount(0);
}

async function currentSessionId(page: Page): Promise<string> {
  const list = await page.evaluate(async () => (await fetch('api/v1/auth/sessions')).json());
  return list.sessions.find((s: { current: boolean }) => s.current).id;
}

/** The HA refresh token of this browser's Arx sign-in, as the fake HA lists it (by its last 8 characters). */
async function refreshTokenState(page: Page, tail: string): Promise<{ revoked: boolean } | undefined> {
  const state = await (await page.request.get(`${FAKE}/fake/state`)).json();
  return state.refresh_tokens.find((t: { tail: string }) => t.tail === tail);
}

async function refreshTail(page: Page): Promise<string> {
  return page.evaluate(() => (JSON.parse(localStorage.getItem('arx.auth.v1') ?? '{}').refresh_token ?? '').slice(-8));
}

test('the administrator revokes a sign-in; the user signs out everywhere', async ({ browser }) => {
  test.skip(test.info().project.name !== 'desktop', 'desktop only');
  const phone = await device(browser, '198.51.100.21');
  const laptop = await device(browser, '198.51.100.22');
  const admin = await device(browser, '198.51.100.23');
  await signIn(admin.page, 'joni', 'pw-joni');
  // a clean start on a reused fixture: no earlier sign-ins of dana, no other sign-ins of the administrator
  await admin.page.evaluate(async () => {
    await fetch('api/v1/auth/sessions?user_id=u-viewer', { method: 'DELETE' });
    const mine = (await (await fetch('api/v1/auth/sessions')).json()).sessions as { id: string; current: boolean }[];
    for (const s of mine.filter((x) => !x.current)) await fetch(`api/v1/auth/sessions/${s.id}`, { method: 'DELETE' });
  });
  await signIn(phone.page, 'dana', 'pw-dana');
  await signIn(laptop.page, 'dana', 'pw-dana');
  const laptopId = await currentSessionId(laptop.page);

  // הגדרות › גישה מרחוק: every remote sign-in, the administrator's own marked
  await admin.page.goto(`${ARX}#/system/diagnostics?tab=remote`);
  const card = admin.page.locator('system-diagnostics [data-remote-sessions-card]');
  await expect(card).toBeVisible();
  const rows = card.locator('sw-remote-sessions [data-remote-session]');
  await expect(rows).toHaveCount(3);
  await expect(card.locator('sw-remote-sessions [data-remote-session] [data-current]')).toHaveCount(1);
  await expect(card.locator(`[data-remote-session="${laptopId}"]`)).toContainText('דנה כהן');
  await expect(card.locator(`[data-remote-session="${laptopId}"]`)).toContainText('דפדפן');
  await card.scrollIntoViewIfNeeded();
  await admin.page.screenshot({ path: test.info().outputPath('arx-p2-sessions-card.png'), fullPage: true });

  // revoke the laptop: gone from the list at once
  await card.locator(`[data-remote-session="${laptopId}"] [data-revoke]`).click();
  await expect(card.locator('sw-remote-sessions [data-remote-sessions-message]')).toHaveText('הכניסה נותקה.');
  await expect(rows).toHaveCount(2);
  // the laptop's next load: the sign-in page, saying why (its refreshed token is refused too)
  await laptop.page.reload();
  await expect(laptop.page.locator('arx-login')).toBeVisible();
  await expect(laptop.page.locator('arx-login [data-arx-notice]')).toContainText('הכניסה במכשיר הזה נותקה');
  expect((await laptop.page.request.get(`${ARX}api/v1/me`)).status()).toBe(401);
  const revoked = await admin.page.evaluate(async () => (await fetch('api/v1/audit?prefix=&view=remote_sign_ins&limit=20')).json());
  expect(revoked.rows.some((r: { action: string; reason: string }) => r.action === 'auth.remote_session.revoked' && r.reason === 'revoked_by_admin')).toBe(true);

  // the laptop signs in again; from the phone, the profile menu's "הסשנים שלי" lists both
  await signIn(laptop.page, 'dana', 'pw-dana');
  const tails = [await refreshTail(phone.page), await refreshTail(laptop.page)];
  for (const tail of tails) expect(await refreshTokenState(phone.page, tail)).toMatchObject({ revoked: false });
  await phone.page.reload();
  await expect(phone.page.locator('sw-app')).toBeVisible();
  await phone.page.locator('sw-app sw-profile-menu [data-profile-menu]').click();
  const menu = phone.page.locator('sw-app sw-profile-menu [data-profile-menu-panel]');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-my-sessions] [data-remote-session]')).toHaveCount(2);
  await expect(menu.locator('[data-my-sessions] [data-current]')).toHaveCount(1);
  await phone.page.screenshot({ path: test.info().outputPath('arx-p2-my-sessions.png') });

  // "התנתק מכל המקומות": asks once, then ends every sign-in of the user - this browser and the laptop
  const everywhere = menu.locator('[data-signout-everywhere]');
  await everywhere.click();
  await expect(everywhere).toContainText('לאשר?');
  await everywhere.click();
  await expect(phone.page.locator('arx-login')).toBeVisible();
  await expect(phone.page.locator('arx-login [data-arx-notice]')).toHaveText('יצאת מ־SmplWise Arx בכל המכשירים.');
  await laptop.page.reload();
  await expect(laptop.page.locator('arx-login')).toBeVisible();
  for (const tail of tails) expect(await refreshTokenState(phone.page, tail)).toMatchObject({ revoked: true }); // the HA sign-ins too
  const stores = await phone.page.evaluate(() => ({ hass: localStorage.getItem('hassTokens'), arx: localStorage.getItem('arx.auth.v1') }));
  expect(stores).toEqual({ hass: null, arx: null });

  // the administrator is untouched
  await admin.page.reload();
  await expect(admin.page.locator('system-diagnostics [data-remote-sessions-card] [data-remote-session]')).toHaveCount(1);
  for (const d of [phone, laptop, admin]) await d.context.close();
});
