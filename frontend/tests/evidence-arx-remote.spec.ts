import { test, expect, type Page } from '@playwright/test';

// CR-008 SmplWise Arx MVP, end to end against tests/fixtures/arx_fake_ha.py (the real backend with the remote channel
// ON at /arx/, serving the built UI; a fake Home Assistant core). Run with SW_ARX_FIXTURE=1 and SW_API_PORT = the
// fixture's port; see the fixture's docstring. The browser talks to HA's /auth endpoints on the same origin, as it does
// behind the tunnel: here page.route forwards them to the fake's HTTP server.
//
// It proves: /arx opens OUR sign-in page (not HA's), HA's login flow with PKCE and the MFA step, the Arx session cookie,
// the same principal and roles as Ingress, HA's `hassTokens` seeded in the exact AuthData shape (the WisKey frame's
// sign-in), a reload resuming the sign-in, the per-user remote flag refusing a user, and sign-out revoking the HA
// refresh token and clearing both stores. What it does not prove: the real HA, the real Cloudflare tunnel and the real
// WisKey panel accepting the seed - the owner's check on the lab site.

const ENABLED = process.env.SW_ARX_FIXTURE === '1';
const PORT = process.env.SW_API_PORT || '8349';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const FAKE = `http://127.0.0.1:${process.env.SW_FAKE_HA_PORT || String(Number(PORT) + 2)}`;
const ARX = `${ORIGIN}/arx/`;

test.skip(!ENABLED, 'needs the Arx fixture backend (SW_ARX_FIXTURE=1, tests/fixtures/arx_fake_ha.py)');
test.describe.configure({ mode: 'serial' });
// page.route cannot see requests a service worker makes; the worker registration itself is covered by the build
test.use({ serviceWorkers: 'block' });

async function routeHa(page: Page) {
  await page.route(`${ORIGIN}/auth/**`, async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${FAKE}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
}

async function signIn(page: Page, username: string, password: string) {
  const login = page.locator('arx-login');
  await expect(login).toBeVisible();
  await login.locator('#username').fill(username);
  await login.locator('#password').fill(password);
  await login.locator('[data-arx-submit]').click();
}

async function fakeState(page: Page): Promise<{ refresh_tokens: { user_id: string; client_id: string; revoked: boolean; tail: string }[] }> {
  const r = await page.request.get(`${FAKE}/fake/state`);
  return r.json();
}

test('/arx opens the Arx sign-in page, not Home Assistant', async ({ page }) => {
  await routeHa(page);
  const res = await page.goto(`${ORIGIN}/arx`);
  expect(page.url()).toBe(ARX); // 308 /arx -> /arx/
  expect(res?.headers()['content-security-policy']).toContain("frame-ancestors 'self'");
  const login = page.locator('arx-login');
  await expect(login).toBeVisible();
  await expect(login).toContainText('SmplWise Arx');
  await expect(login).toContainText('היכנס עם שם המשתמש והסיסמה של Home Assistant');
  await expect(page.locator('sw-app')).toHaveCount(0); // the shell waits for a session
  // the server confirms: no session, no API
  const me = await page.request.get(`${ARX}api/v1/me`, { headers: { 'X-Remote-User-Id': 'u-owner' } });
  expect(me.status()).toBe(401);
  expect((await me.json()).code).toBe('remote_login_required');
  await page.screenshot({ path: test.info().outputPath('arx-login.png') });
});

test('a wrong password shows HA\'s error, then the viewer signs in, resumes after a reload and signs out', async ({ page, context }) => {
  await routeHa(page);
  await page.goto(ARX);
  await signIn(page, 'dana', 'wrong');
  await expect(page.locator('arx-login [data-arx-error]')).toHaveText('שם משתמש או סיסמה לא תקינים');
  await page.locator('arx-login #password').fill('pw-dana');
  await page.locator('arx-login [data-arx-submit]').click();

  // the product shell, as the same principal Ingress would give (HA user id, the viewer role)
  await expect(page.locator('arx-login')).toHaveCount(0);
  await expect(page.locator('sw-app')).toBeVisible();
  const me = await page.evaluate(async () => (await fetch('api/v1/me')).json());
  expect(me.user).toMatchObject({ id: 'u-viewer', username: 'dana', display_name: 'דנה כהן', source: 'remote' });
  expect(me.channel).toBe('remote');
  expect(me.bindings.map((b: { role_id: string }) => b.role_id)).toEqual(['viewer']);
  expect(me.permissions_installation).not.toContain('system.configure');
  const nav = test.info().project.name === 'mobile' ? page.locator('sw-app nav.bottom') : page.locator('sw-app nav.rail');
  await expect(nav).toBeVisible();
  await expect(nav.locator('a').first()).toBeVisible();
  await expect(page.locator('sw-app [data-arx-signout]')).toBeVisible();

  // the Arx session cookie: HttpOnly, SameSite=Strict, Path=/arx/ (plain http here, so not the __Secure- name)
  const cookie = (await context.cookies(ARX)).find((c) => c.name === 'arx_session');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/arx/' });
  expect((await context.cookies(ORIGIN)).find((c) => c.name === 'arx_session')).toBeUndefined(); // never sent to HA's paths
  expect(await page.evaluate(() => document.cookie)).not.toContain('arx_session'); // HttpOnly: no script reads it

  // HA's own token store, seeded in home-assistant-js-websocket's AuthData shape (the WisKey frame's sign-in)
  const stores = await page.evaluate(() => ({ hass: localStorage.getItem('hassTokens'), arx: localStorage.getItem('arx.auth.v1') }));
  const hass = JSON.parse(stores.hass ?? 'null');
  expect(Object.keys(hass).sort()).toEqual(['access_token', 'clientId', 'expires', 'expires_in', 'hassUrl', 'refresh_token']);
  expect(hass.hassUrl).toBe(ORIGIN);
  expect(hass.clientId).toBe(ARX);
  expect(hass.expires).toBeGreaterThan(Date.now() + 20 * 60_000);
  expect(hass.expires_in).toBe(1800);
  expect(hass.access_token.split('.')).toHaveLength(3);
  const arx = JSON.parse(stores.arx ?? 'null');
  expect(arx.refresh_token).toBe(hass.refresh_token);
  expect(arx.clientId).toBe(ARX);
  const issued = (await fakeState(page)).refresh_tokens.find((t) => t.tail === hass.refresh_token.slice(-8));
  expect(issued).toMatchObject({ user_id: 'u-viewer', client_id: ARX, revoked: false }); // HA sees the client "…/arx/" (Profile › Security)

  // a reload resumes the sign-in without the sign-in page
  await page.reload();
  await expect(page.locator('sw-app')).toBeVisible();
  await expect(page.locator('arx-login')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('arx-signed-in.png') });

  // sign-out: HA's refresh token revoked, the session gone, both stores cleared, the sign-in page again
  await page.locator('sw-app [data-arx-signout]').click();
  await expect(page.locator('arx-login')).toBeVisible();
  await expect(page.locator('arx-login [data-arx-notice]')).toHaveText('יצאת מ־SmplWise Arx.');
  const after = await page.evaluate(() => ({ hass: localStorage.getItem('hassTokens'), arx: localStorage.getItem('arx.auth.v1') }));
  expect(after).toEqual({ hass: null, arx: null });
  const mine = (await fakeState(page)).refresh_tokens.find((t) => t.tail === hass.refresh_token.slice(-8));
  expect(mine).toMatchObject({ user_id: 'u-viewer', client_id: ARX, revoked: true });
  expect((await page.request.get(`${ARX}api/v1/me`)).status()).toBe(401);
});

test('a user with MFA gets the code step', async ({ page }) => {
  await routeHa(page);
  await page.goto(ARX);
  await signIn(page, 'avi', 'pw-avi');
  const code = page.locator('arx-login #code');
  await expect(code).toBeVisible();
  await expect(page.locator('arx-login h1')).toHaveText('אימות דו־שלבי');
  await code.fill('000000');
  await page.locator('arx-login [data-arx-verify]').click();
  await expect(page.locator('arx-login [data-arx-error]')).toHaveText('קוד אימות לא תקין');
  await page.locator('arx-login #code').fill('123456');
  await page.locator('arx-login [data-arx-verify]').click();
  await expect(page.locator('sw-app')).toBeVisible();
  const me = await page.evaluate(async () => (await fetch('api/v1/me')).json());
  expect(me.user.id).toBe('u-mfa');
  await page.locator('sw-app [data-arx-signout]').click();
  await expect(page.locator('arx-login')).toBeVisible();
});

test('a user without the remote flag is refused in Hebrew and keeps no sign-in', async ({ page }) => {
  await routeHa(page);
  await page.goto(ARX);
  await signIn(page, 'noa', 'pw-noa');
  await expect(page.locator('arx-login [data-arx-error]')).toContainText('הגישה מרחוק לא הופעלה עבור המשתמש שלך');
  await expect(page.locator('sw-app')).toHaveCount(0);
  const stores = await page.evaluate(() => ({ hass: localStorage.getItem('hassTokens'), arx: localStorage.getItem('arx.auth.v1') }));
  expect(stores).toEqual({ hass: null, arx: null });
  const left = (await fakeState(page)).refresh_tokens.filter((t) => t.user_id === 'u-noflag' && !t.revoked);
  expect(left).toEqual([]); // the HA sign-in it just made was revoked again
});
