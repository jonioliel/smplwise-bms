import { test, expect as baseExpect, type Browser, type Page } from '@playwright/test';

// a real backend hashes passwords (two hashing threads) and the workstation may be busy: every wait gets 20 s, not the default 5
const expect = baseExpect.configure({ timeout: 20_000 });

// CR-LOCAL-USER-CREATE-2438 (owner 18.11: "the user is not saved, and I have no way to set a password"). The REAL backend with the
// remote channel at /arx/ (tests/fixtures/arx_fake_ha.py; only Home Assistant core is fake) and the REAL screen: Settings > Users and
// permissions > Arx users, on the remote channel (the owner's way in) and on the local one. It proves: the create button sends the
// form and the user is saved; typical owner inputs (Hebrew display name, a username with capitals / a space / Hebrew) either work or
// are refused with the server's sentence inside the form; a password set by the administrator signs the user in, and "must change at
// the first sign-in" is honoured; "send a link instead" still hands over the one-time link; set-password on an existing user.
//   <venv-python> tests/fixtures/arx_fake_ha.py   (SW_PORT=<port>, a fresh SW_DATA_DIR: the spec creates users)
//   SW_ARX_FIXTURE=1 SW_API_PORT=<port> npx playwright test tests/evidence-local-user-create-2438.spec.ts --project=desktop --workers=1

const ENABLED = process.env.SW_ARX_FIXTURE === '1';
const PORT = process.env.SW_API_PORT || '8349';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const FAKE = `http://127.0.0.1:${process.env.SW_FAKE_HA_PORT || String(Number(PORT) + 2)}`;
const ARX = `${ORIGIN}/arx/`;
const TAB = 'system-local-users';
const RUN = Date.now().toString(36).slice(-5); // the usernames of this run (a re-run on the same data dir does not collide)
const ADMIN_PW = 'seven green boats 91';
const OWN_PW = 'quiet lantern over harbor';
const AVI = `אבי מקומי ${RUN}`; // the display name of this run's local-channel user (a re-run on the same data dir keeps the old one)

test.skip(!ENABLED, 'needs the Arx fixture backend (SW_ARX_FIXTURE=1, tests/fixtures/arx_fake_ha.py)');
test.describe.configure({ mode: 'serial' });
test.use({ serviceWorkers: 'block' });
test.setTimeout(120_000);

function tunnelIp() {
  return `198.18.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
}

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ 'CF-Connecting-IP': tunnelIp() });
});

async function routeHa(page: Page) {
  await page.route(`${ORIGIN}/auth/**`, async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${FAKE}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
}

/** The owner's way in: the remote channel, signed in as the system administrator (an HA identity). */
async function remoteAdmin(page: Page) {
  await routeHa(page);
  await page.goto(ARX);
  const login = page.locator('arx-login');
  await expect(login).toBeVisible();
  if (await login.locator('[data-arx-mode="infra"]').count()) await login.locator('[data-arx-mode="infra"]').click();
  await login.locator('#username').fill('joni');
  await login.locator('#password').fill('pw-joni');
  await login.locator('[data-arx-submit]').click();
  await expect(page.locator('sw-app')).toBeVisible();
}

async function openTab(page: Page) {
  // the shell settles its first route after the session loads: ask for the tab until it is the one shown
  await expect(async () => {
    await page.evaluate(() => (location.hash = '#/system/access?tab=local'));
    await expect(page.locator(`${TAB} [data-local-users]`)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  // the feature switch (CR-LOCAL-ID-SWITCH-2442): on, when the installation still has it off
  if (await page.locator(`${TAB} [data-local-switch="on"]`).count()) {
    await page.locator(`${TAB} [data-local-switch="on"]`).click();
    await page.locator(`${TAB} [data-local-switch-confirm]`).click();
  }
  await expect(page.locator(`${TAB} [data-local-add]`)).toBeVisible();
}

/** Every POST to the create route this page makes, to tell "never sent" from "refused". */
function watchCreates(page: Page): { status: number }[] {
  const seen: { status: number }[] = [];
  page.on('response', (r) => {
    if (r.request().method() === 'POST' && /\/api\/v1\/identity\/local-users$/.test(new URL(r.url()).pathname)) seen.push({ status: r.status() });
  });
  return seen;
}

async function fillCreate(page: Page, username: string, display: string, pw?: string) {
  if (!(await page.locator(`${TAB} [data-local-create]`).count())) await page.locator(`${TAB} [data-local-add]`).click();
  await page.locator(`${TAB} [data-local-username]`).fill(username);
  await page.locator(`${TAB} [data-local-display]`).fill(display);
  if (pw !== undefined) {
    await page.locator(`${TAB} [data-local-pw-mode]`).selectOption('set'); // the form remembers the administrator's last choice
    await page.locator(`${TAB} [data-local-pw="create"]`).fill(pw);
    await page.locator(`${TAB} [data-local-pw-again="create"]`).fill(pw);
  }
}

/** Does the server accept what the pickers offer? Every role the open form's picker has ENABLED x every scope it lists, sent from the
 * page itself with the form's own body shape (no password: 35 roles x 4 scopes of hashing would take the test minutes). */
async function pickerMatrix(page: Page, tag: string): Promise<{ roles: number; scopes: number; sent: number; refused: string[] }> {
  if (!(await page.locator(`${TAB} [data-local-create]`).count())) await page.locator(`${TAB} [data-local-add]`).click();
  const roles = await page.locator(`${TAB} [data-local-role] option:not([disabled])`).evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  const scopes = await page.locator(`${TAB} [data-local-create] select`).nth(1).locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  const refused = await page.evaluate(async ({ roles, scopes, tag }) => {
    const out: string[] = [];
    let n = 0;
    for (const role of roles) {
      for (const scope of scopes) {
        n += 1;
        const i = scope.indexOf(':');
        const r = await fetch('api/v1/identity/local-users', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: `${tag}${n}.x${Date.now().toString(36).slice(-5)}`, display_name: `תפקיד ${n}`, role_id: role, scope_type: scope.slice(0, i), scope_id: scope.slice(i + 1),
            email: null, notes: null, reset_mode: 'manager_only' }) });
        if (r.status !== 201) out.push(`${role} @ ${scope}: ${r.status} ${((await r.json()) as { code?: string }).code ?? ''}`);
      }
    }
    return out;
  }, { roles, scopes, tag });
  return { roles: roles.length, scopes: scopes.length, sent: roles.length * scopes.length, refused };
}

/** A separate device: the Arx-user mode of the remote sign-in page. */
async function localSignIn(browser: Browser, username: string, password: string) {
  const context = await browser.newContext({ serviceWorkers: 'block', locale: 'he-IL', timezoneId: 'Asia/Jerusalem', viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { 'CF-Connecting-IP': tunnelIp() } });
  const page = await context.newPage();
  await page.goto(ARX);
  const login = page.locator('arx-login');
  await expect(login).toBeVisible();
  await login.locator('[data-arx-mode="local"]').click();
  await login.locator('#username').fill(username);
  await login.locator('#password').fill(password);
  await login.locator('[data-arx-submit]').click();
  return { context, page, login };
}

test('remote channel: create with a password, the user is saved, signs in and must choose their own password', async ({ page, browser }) => {
  const name = `dana.${RUN}`;
  await remoteAdmin(page);
  await openTab(page);
  const posts = watchCreates(page);

  // typical owner inputs first: a username in Hebrew, then with a space - refused, and the form SAYS so with the server's sentence
  await fillCreate(page, 'דנה', 'דנה קליין', ADMIN_PW);
  await page.locator(`${TAB} [data-local-create-save]`).click();
  const err = page.locator(`${TAB} [data-local-create-error]`);
  await expect(err).toContainText('שם משתמש: 3-32 תווים באנגלית קטנה');
  await page.locator(`${TAB} [data-local-username]`).fill('dana klein');
  await page.locator(`${TAB} [data-local-create-save]`).click();
  await expect.poll(() => posts.length).toBe(2);
  await expect(err).toContainText('שם משתמש: 3-32 תווים באנגלית קטנה');
  expect(posts.map((p) => p.status)).toEqual([422, 422]);
  // a password the policy refuses
  await fillCreate(page, name, 'דנה קליין', 'aaaaaaaaaaaaaaaa');
  await page.locator(`${TAB} [data-local-create-save]`).click();
  await expect(err).toContainText('תו חוזר');
  await page.screenshot({ path: test.info().outputPath('create-refused.png') });

  // capitals are fine (the name is kept lower-case); a Hebrew display name; the password the administrator chose
  await fillCreate(page, name.toUpperCase(), 'דנה קליין', ADMIN_PW);
  await expect(page.locator(`${TAB} [data-local-pw-must="create"]`)).toHaveAttribute('checked', '');
  await page.locator(`${TAB} [data-local-create-save]`).click();
  await expect(page.locator(`${TAB} [data-local-done]`)).toContainText(name);
  expect(posts.at(-1)?.status).toBe(201);
  await expect(page.locator(`${TAB} [data-local-link]`)).toHaveCount(0);
  await expect(page.locator(TAB).getByText('דנה קליין').first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('created-with-password.png') });
  // saved for real: the server lists it after a reload
  const listed = await page.evaluate(async () => (await (await fetch('api/v1/identity/local-users')).json()) as { users: { username: string; status: string; must_change_password: boolean }[] });
  expect(listed.users.find((u) => u.username === name)).toMatchObject({ status: 'active', must_change_password: true });

  // the new user, on another device: the password works, and the first sign-in asks for a password of their own
  const u = await localSignIn(browser, name, ADMIN_PW);
  await expect(u.login.locator('[data-arx-change]')).toBeVisible();
  await expect(u.page.locator('sw-app')).toHaveCount(0);
  await u.login.locator('#current').fill(ADMIN_PW);
  await u.login.locator('#next').fill(OWN_PW);
  await u.login.locator('#again').fill(OWN_PW);
  await u.login.locator('[data-arx-change-save]').click();
  await expect(u.page.locator('sw-app')).toBeVisible();
  const me = await u.page.evaluate(async () => (await fetch('api/v1/me')).json());
  expect(me.user).toMatchObject({ username: name, source: 'local' });
  await u.context.close();
  // the administrator's password no longer works
  const again = await localSignIn(browser, name, ADMIN_PW);
  await expect(again.login.locator('[data-arx-error]')).toBeVisible();
  await again.context.close();
});

test('remote channel: "send a link instead" still hands over the one-time link; every role and scope the pickers offer is accepted', async ({ page }) => {
  await remoteAdmin(page);
  await openTab(page);
  const posts = watchCreates(page);
  await fillCreate(page, `link.${RUN}`, 'משתמש קישור');
  await page.locator(`${TAB} [data-local-pw-mode]`).selectOption('link');
  await page.locator(`${TAB} [data-local-create-save]`).click();
  await expect(page.locator(`${TAB} [data-local-link-text]`)).toContainText('/arx/#/welcome?t=');
  expect(posts.map((p) => p.status)).toEqual([201]);

  // every role the picker offers on this channel (the administrative ones are disabled here) x every scope it offers
  const m = await pickerMatrix(page, 'r');
  test.info().annotations.push({ type: 'matrix', description: `remote: ${m.roles} roles x ${m.scopes} scopes = ${m.sent} creates, refused: ${m.refused.length ? m.refused.join(' | ') : 'none'}` });
  expect(m.roles).toBeGreaterThan(0);
  expect(m.scopes).toBeGreaterThan(1); // the installation + the fixture's site / building / floor
  expect(m.refused).toEqual([]);
});

test('local channel: create with a password that need not be changed, then set a new password on the existing user', async ({ page, browser }) => {
  const name = `avi.${RUN}`;
  await page.goto(`${ORIGIN}/`);
  await expect(page.locator('sw-app')).toBeVisible();
  await openTab(page);
  const posts = watchCreates(page);
  await fillCreate(page, name, AVI, ADMIN_PW);
  await page.locator(`${TAB} [data-local-pw-must="create"]`).click();
  await page.locator(`${TAB} [data-local-display]`).press('Enter'); // Enter sends the form too
  await expect(page.locator(`${TAB} [data-local-done]`)).toContainText(name);
  expect(posts.map((p) => p.status)).toEqual([201]);

  const first = await localSignIn(browser, name, ADMIN_PW);
  await expect(first.page.locator('sw-app')).toBeVisible(); // no forced change: the administrator turned it off

  // set-password on the existing user: the pair, the default "must change", and the user's open sign-in ends
  await page.locator(`${TAB} sw-table`).getByText(AVI).first().click(); // the row, not the result line that names the user
  await page.locator(`${TAB} [data-local-pw-set]`).click();
  await page.locator(`${TAB} [data-local-pw="user"]`).fill(OWN_PW);
  await page.locator(`${TAB} [data-local-pw-again="user"]`).fill(OWN_PW);
  await expect(page.locator(`${TAB} [data-local-pw-must="user"]`)).toHaveAttribute('checked', '');
  await page.screenshot({ path: test.info().outputPath('set-password-panel.png') });
  await page.locator(`${TAB} [data-local-pw-save]`).click();
  await expect(page.locator(`${TAB} [data-local-done]`)).toContainText(`הסיסמה של ${AVI} נקבעה`);
  const meAfter = await first.page.evaluate(async () => (await fetch('api/v1/me')).status);
  expect(meAfter).toBe(401);
  await first.context.close();

  const second = await localSignIn(browser, name, OWN_PW);
  await expect(second.login.locator('[data-arx-change]')).toBeVisible(); // must change: honoured at the sign-in
  await second.context.close();

  // the local channel offers every role (the administrative ones too): each one x each scope is accepted by the server
  const m = await pickerMatrix(page, 'l');
  test.info().annotations.push({ type: 'matrix', description: `local: ${m.roles} roles x ${m.scopes} scopes = ${m.sent} creates, refused: ${m.refused.length ? m.refused.join(' | ') : 'none'}` });
  expect(m.refused).toEqual([]);
});
