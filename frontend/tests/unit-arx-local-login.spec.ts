import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// USR2 phase 1: the sign-in page's "משתמש Arx" mode and the welcome (set-password) page, bundled as they are and run on a mocked
// same-origin page (no backend, no Home Assistant). Negative first: the mode exists only when the server offers it; the local mode
// never touches Home Assistant's login flow; a refusal shows the server's uniform text and clears the password; the welcome token
// leaves the address bar before anything is typed.
//   npx playwright test tests/unit-arx-local-login.spec.ts --project=desktop

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'http://arx.test';
const UNIFORM = 'שם המשתמש או הסיסמה אינם נכונים.';

test.use({ serviceWorkers: 'block' });

let bundled = '';

async function bundle(): Promise<string> {
  if (bundled) return bundled;
  const out = await build({
    stdin: { contents: "import '../design/boot';\nimport './arx-login';\nimport './arx-welcome';\nimport '../screens/system-local-users';\n", resolveDir: path.join(HERE, '../src/arx'), loader: 'ts' },
    bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', tsconfig: path.join(HERE, '../tsconfig.json'),
    define: { 'import.meta.env.BASE_URL': '"/arx/"' },
  });
  bundled = out.outputFiles[0].text;
  return bundled;
}

type Call = { path: string; method: string; body: string };

async function setup(page: import('@playwright/test').Page, answers: Record<string, { status: number; body: unknown }>) {
  const calls: Call[] = [];
  await page.route(`${ORIGIN}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    calls.push({ path: url.pathname, method: req.method(), body: req.postData() ?? '' });
    if (url.pathname === '/arx/' || url.pathname === '/arx/index.html') {
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="he" dir="rtl"><head><title>t</title></head><body></body></html>' });
    }
    const a = answers[`${req.method()} ${url.pathname}`];
    if (a) return route.fulfill({ status: a.status, contentType: 'application/json', body: JSON.stringify(a.body) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"not_found"}' });
  });
  await page.goto(`${ORIGIN}/arx/`);
  await page.addScriptTag({ content: await bundle() });
  return calls;
}

async function mountLogin(page: import('@playwright/test').Page, localEnabled: boolean) {
  await page.evaluate((on) => {
    const el = document.createElement('arx-login') as HTMLElement & { localEnabled: boolean };
    el.localEnabled = on;
    el.addEventListener('arx-signed-in', () => document.body.setAttribute('data-signed-in', '1'));
    document.body.appendChild(el);
  }, localEnabled);
}

test('the local mode is absent unless the server offers it', async ({ page }) => {
  await setup(page, {});
  await mountLogin(page, false);
  await expect(page.locator('arx-login [data-arx-login-modes]')).toHaveCount(0);
});

test('local mode: a refusal shows the uniform text, never calls Home Assistant, clears the password', async ({ page }) => {
  const calls = await setup(page, { 'POST /arx/api/v1/auth/local/sign-in': { status: 401, body: { code: 'sign_in_failed', user_message: UNIFORM, retryable: false, details: {} } } });
  await mountLogin(page, true);
  await page.locator('arx-login [data-arx-mode="local"]').click();
  await page.locator('arx-login #username').fill('maria');
  await page.locator('arx-login #password').fill('wrong password here');
  await page.locator('arx-login [data-arx-submit]').click();
  await expect(page.locator('arx-login [data-arx-error]')).toHaveText(UNIFORM);
  await expect(page.locator('arx-login #password')).toHaveValue('');
  const signIn = calls.filter((c) => c.path === '/arx/api/v1/auth/local/sign-in');
  expect(signIn).toHaveLength(1);
  expect(JSON.parse(signIn[0].body)).toEqual({ username: 'maria', password: 'wrong password here' });
  expect(calls.some((c) => c.path.startsWith('/auth/'))).toBe(false); // Home Assistant's login flow is never touched
  expect(await page.evaluate(() => JSON.stringify({ ...window.localStorage }))).not.toContain('wrong password here');
});

test('local mode: 202 asks for the code, then the session', async ({ page }) => {
  const calls = await setup(page, {
    'POST /arx/api/v1/auth/local/sign-in': { status: 202, body: { second_factor: 'required' } },
    'POST /arx/api/v1/auth/local/sign-in/second-factor': { status: 200, body: { second_factor: 'none', user: { id: 'l_X', source: 'local' } } },
    'GET /arx/api/v1/me': { status: 200, body: { user: { id: 'l_X', source: 'local' }, local_identity: { gate: null, admin_permissions_blocked: false, must_change_password: false } } },
  });
  await mountLogin(page, true);
  await page.locator('arx-login [data-arx-mode="local"]').click();
  await page.locator('arx-login #username').fill('maria');
  await page.locator('arx-login #password').fill('tree river lamp 47');
  await page.locator('arx-login [data-arx-submit]').click();
  await expect(page.locator('arx-login #code')).toBeVisible();
  await page.locator('arx-login #code').fill('123 456');
  await page.locator('arx-login [data-arx-verify]').click();
  await expect(page.locator('body')).toHaveAttribute('data-signed-in', '1');
  const step = calls.find((c) => c.path === '/arx/api/v1/auth/local/sign-in/second-factor');
  expect(JSON.parse(step!.body)).toEqual({ code: '123456' });
});

test('local mode: a gated session stays on the page (enrolment / new password)', async ({ page }) => {
  await setup(page, {
    'POST /arx/api/v1/auth/local/sign-in': { status: 200, body: { second_factor: 'enroll_required', must_change_password: true } },
    'GET /arx/api/v1/me': { status: 200, body: { user: { id: 'l_X', source: 'local' }, local_identity: { gate: 'change' } } },
  });
  await mountLogin(page, true);
  await page.locator('arx-login [data-arx-mode="local"]').click();
  await page.locator('arx-login #username').fill('maria');
  await page.locator('arx-login #password').fill('tree river lamp 47');
  await page.locator('arx-login [data-arx-submit]').click();
  await expect(page.locator('arx-login [data-arx-change]')).toBeVisible();
  await expect(page.locator('body')).not.toHaveAttribute('data-signed-in', '1');
});

test('welcome: the token leaves the address bar, a mismatch is caught, the password is posted once', async ({ page }) => {
  const calls = await setup(page, { 'POST /arx/api/v1/auth/local/set-password': { status: 200, body: { must_enrol: false } } });
  const token = 'T'.repeat(43);
  await page.evaluate((t) => {
    window.history.replaceState(null, '', `/arx/#/welcome?t=${t}`);
    const el = document.createElement('arx-welcome') as HTMLElement & { token: string };
    el.token = t;
    el.addEventListener('arx-password-set', () => document.body.setAttribute('data-set', '1'));
    document.body.appendChild(el);
  }, token);
  await expect(page.locator('arx-welcome [data-arx-welcome]')).toBeVisible();
  expect(await page.evaluate(() => window.location.href)).not.toContain(token);
  await page.locator('arx-welcome #pw').fill('tree river lamp 47');
  await page.locator('arx-welcome #again').fill('tree river lamp 48');
  await page.locator('arx-welcome [data-arx-welcome-save]').click();
  await expect(page.locator('arx-welcome [data-arx-welcome-error]')).toBeVisible();
  expect(calls.some((c) => c.path.endsWith('/set-password'))).toBe(false);
  await page.locator('arx-welcome #again').fill('tree river lamp 47');
  await page.locator('arx-welcome [data-arx-welcome-save]').click();
  await expect(page.locator('body')).toHaveAttribute('data-set', '1');
  const posted = calls.filter((c) => c.path === '/arx/api/v1/auth/local/set-password');
  expect(posted).toHaveLength(1);
  expect(JSON.parse(posted[0].body)).toEqual({ token, password: 'tree river lamp 47' });
});

// ---------------------------------------------------------------- USR2 phase 2: self-service reset, WhatsApp links

test('forgot password: offered only in the local mode; the request answer is the same, the code step posts code + password once', async ({ page }) => {
  const calls = await setup(page, {
    'POST /arx/api/v1/auth/local/reset/request': { status: 202, body: { accepted: true, expires_in_s: 600, resend_after_s: 60 } },
    'POST /arx/api/v1/auth/local/reset/confirm': { status: 200, body: { must_enrol: false } },
  });
  await mountLogin(page, true);
  await page.locator('arx-login [data-arx-mode="infra"]').click();
  await expect(page.locator('arx-login [data-arx-forgot]')).toHaveCount(0); // never for the infrastructure sign-in
  await page.locator('arx-login [data-arx-mode="local"]').click();
  await page.locator('arx-login #username').fill('maria');
  await page.locator('arx-login [data-arx-forgot]').click();
  await expect(page.locator('arx-login #runame')).toHaveValue('maria');
  await page.locator('arx-login [data-arx-send-code]').click();
  await expect(page.locator('arx-login [data-arx-reset-form]')).toBeVisible();
  await page.locator('arx-login #rcode').fill('123 456');
  await page.locator('arx-login #next').fill('silver canyon morning tide');
  await page.locator('arx-login #again').fill('silver canyon morning tidx');
  await page.locator('arx-login [data-arx-reset-save]').click();
  await expect(page.locator('arx-login [data-arx-error]')).toBeVisible(); // the mismatch is caught on the page
  expect(calls.some((c) => c.path.endsWith('/reset/confirm'))).toBe(false);
  await page.locator('arx-login #again').fill('silver canyon morning tide');
  await page.locator('arx-login [data-arx-reset-save]').click();
  await expect(page.locator('arx-login [data-arx-notice]')).toBeVisible();
  await expect(page.locator('arx-login #username')).toHaveValue('maria');
  const req = calls.filter((c) => c.path === '/arx/api/v1/auth/local/reset/request');
  const conf = calls.filter((c) => c.path === '/arx/api/v1/auth/local/reset/confirm');
  expect(req.map((c) => JSON.parse(c.body))).toEqual([{ username: 'maria' }]);
  expect(conf.map((c) => JSON.parse(c.body))).toEqual([{ username: 'maria', code: '123456', password: 'silver canyon morning tide' }]);
  expect(calls.some((c) => c.path.startsWith('/auth/'))).toBe(false);
  expect(await page.evaluate(() => JSON.stringify({ ...window.localStorage, ...window.sessionStorage }))).not.toContain('silver canyon');
});

test('forgot password: a refused code shows the uniform text and keeps the step', async ({ page }) => {
  await setup(page, {
    'POST /arx/api/v1/auth/local/reset/request': { status: 202, body: { accepted: true } },
    'POST /arx/api/v1/auth/local/reset/confirm': { status: 422, body: { code: 'code_invalid', user_message: 'הקוד שגוי או שפג תוקפו. אפשר לבקש קוד חדש.', retryable: false, details: {} } },
  });
  await mountLogin(page, true);
  await page.locator('arx-login [data-arx-mode="local"]').click();
  await page.locator('arx-login [data-arx-forgot]').click();
  await page.locator('arx-login #runame').fill('ghost');
  await page.locator('arx-login [data-arx-send-code]').click();
  await page.locator('arx-login #rcode').fill('000000');
  await page.locator('arx-login #next').fill('silver canyon morning tide');
  await page.locator('arx-login #again').fill('silver canyon morning tide');
  await page.locator('arx-login [data-arx-reset-save]').click();
  await expect(page.locator('arx-login [data-arx-error]')).toHaveText('הקוד שגוי או שפג תוקפו. אפשר לבקש קוד חדש.');
  await expect(page.locator('arx-login [data-arx-reset-form]')).toBeVisible();
});

const P2_ROWS = {
  enabled: true, can_manage: true, channel: 'local', whatsapp_ready: true, public_url: 'https://arx.example.com',
  users: [
    { ...ROWS_BASE('l_01JTEST0000000000000000011', 'noa', 'נועה'), reset_mode: 'self_service', whatsapp: { verified: true, masked: '····91' }, self_service_blocked: null },
    { ...ROWS_BASE('l_01JTEST0000000000000000012', 'site.lead', 'אבי לוי'), role_id: 'site_admin', role_name: 'מנהל אתר', admin: true, whatsapp: { verified: true, masked: '····22' }, self_service_blocked: null },
    { ...ROWS_BASE('l_01JTEST0000000000000000013', 'guard2', 'שומר'), reset_mode: 'self_service', whatsapp: { verified: false, masked: null }, self_service_blocked: 'no_verified_number' },
  ],
};

function ROWS_BASE(id: string, username: string, display: string) {
  return { id, username, display_name: display, email: null, notes: null, status: 'active', active: true, created_at: '2026-10-16T08:00:00Z', last_sign_in_at: null,
    last_sign_in_from: null, role_id: 'viewer', role_name: 'צופה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', admin: false, second_factor: false,
    reset_mode: 'manager_only', must_change_password: false, sessions: 0, ha_user_id: null };
}

async function mountUsers(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const el = document.createElement('system-local-users') as HTMLElement & { roles: unknown[]; scopes: unknown[] };
    el.roles = [{ id: 'viewer', name: 'צופה', permissions: ['map.read'] }, { id: 'site_admin', name: 'מנהל אתר', permissions: ['rbac.assign'] }];
    el.scopes = [{ type: 'installation', id: '*', name: 'כל ההתקנה' }];
    document.body.appendChild(el);
  });
  await expect(page.locator('system-local-users [data-local-users]')).toBeVisible();
}

test('settings: a plain user\'s link goes by WhatsApp and is never shown; an administrator gets no WhatsApp action', async ({ page }) => {
  const calls = await setup(page, {
    'GET /arx/api/v1/identity/local-users': { status: 200, body: P2_ROWS },
    'POST /arx/api/v1/identity/local-users/l_01JTEST0000000000000000011/link': { status: 200, body: { user_id: 'l_01JTEST0000000000000000011', link: { purpose: 'reset', via: 'whatsapp', expires_at: '2026-10-19T08:00:00Z', queued: true } } },
  });
  await mountUsers(page);
  await page.locator('system-local-users').getByText('אבי לוי').click();
  await expect(page.locator('system-local-users [data-local-wa-admin]')).toBeVisible();
  await expect(page.locator('system-local-users [data-local-issue-wa]')).toHaveCount(0);
  await expect(page.locator('system-local-users [data-local-reset-admin]')).toBeVisible();
  await page.locator('system-local-users').getByText('שומר').click();
  await expect(page.locator('system-local-users [data-local-reset-blocked="no_verified_number"]')).toBeVisible();
  await expect(page.locator('system-local-users [data-local-issue-wa]')).toHaveCount(0);
  await page.locator('system-local-users').getByText('נועה').click();
  await expect(page.locator('system-local-users [data-local-wa-state]')).toContainText('····91');
  await page.locator('system-local-users [data-local-issue-wa="reset"]').click();
  await expect(page.locator('system-local-users [data-local-link-sent]')).toBeVisible();
  await expect(page.locator('system-local-users [data-local-link-text]')).toHaveCount(0); // nothing to copy: the link went by WhatsApp only
  const posted = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/link'));
  expect(posted.map((c) => JSON.parse(c.body))).toEqual([{ purpose: 'reset', via: 'whatsapp' }]);
});

// Build screenshots for the design review (desktop / mobile, RTL; error and ready states; the settings tab with mocked rows).
// Written to docs/evidence/USR2/ - mocked data only, no real name, address or secret.
const EVIDENCE = path.join(HERE, '../../docs/evidence/USR2');
const ROWS = {
  enabled: true, can_manage: true, channel: 'local',
  users: [
    { id: 'l_01JTEST0000000000000000001', username: 'maria', display_name: 'מריה כהן', email: null, notes: null, status: 'active', active: true, created_at: '2026-10-16T08:00:00Z',
      last_sign_in_at: '2026-10-16T09:30:00Z', last_sign_in_from: '203.0.113.0/24 IL', role_id: 'operator', role_name: 'מפעיל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה',
      admin: false, second_factor: true, reset_mode: 'manager_only', must_change_password: false, sessions: 2, ha_user_id: null },
    { id: 'l_01JTEST0000000000000000002', username: 'site.lead', display_name: 'אבי לוי', email: null, notes: 'ניהול אתר', status: 'pending_first_login', active: true, created_at: '2026-10-16T08:10:00Z',
      last_sign_in_at: null, last_sign_in_from: null, role_id: 'site_admin', role_name: 'מנהל אתר', scope_type: 'site', scope_id: 's1', scope_name: 'אתר הדגמה',
      admin: true, second_factor: false, reset_mode: 'manager_only', must_change_password: false, sessions: 0, ha_user_id: 'u-1' },
    { id: 'l_01JTEST0000000000000000003', username: 'cleaner1', display_name: 'צוות ניקיון', email: null, notes: null, status: 'delayed', active: true, created_at: '2026-10-15T08:00:00Z',
      last_sign_in_at: '2026-10-15T18:00:00Z', last_sign_in_from: null, role_id: 'viewer', role_name: 'צופה', scope_type: 'floor', scope_id: 'f1', scope_name: 'קומה 2',
      admin: false, second_factor: false, reset_mode: 'self_service', must_change_password: false, sessions: 0, ha_user_id: null },
  ],
};

for (const view of [{ name: 'desktop', w: 1440, h: 900 }, { name: 'mobile', w: 390, h: 844 }]) {
  test(`screens for review (${view.name})`, async ({ page }) => {
    await page.setViewportSize({ width: view.w, height: view.h });
    await setup(page, {
      'POST /arx/api/v1/auth/local/sign-in': { status: 401, body: { code: 'sign_in_failed', user_message: UNIFORM, retryable: false, details: {} } },
      'GET /arx/api/v1/identity/local-users': { status: 200, body: ROWS },
    });
    await mountLogin(page, true);
    await page.locator('arx-login [data-arx-mode="local"]').click();
    await page.screenshot({ path: path.join(EVIDENCE, `login-local-ready-${view.name}.png`) });
    await page.locator('arx-login #username').fill('maria');
    await page.locator('arx-login #password').fill('x');
    await page.locator('arx-login [data-arx-submit]').click();
    await expect(page.locator('arx-login [data-arx-error]')).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE, `login-local-error-${view.name}.png`) });
    await page.evaluate(() => {
      document.querySelector('arx-login')?.remove();
      const el = document.createElement('arx-welcome') as HTMLElement & { token: string };
      el.token = 'T'.repeat(43);
      document.body.appendChild(el);
    });
    await expect(page.locator('arx-welcome [data-arx-welcome]')).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE, `welcome-${view.name}.png`) });
    await page.evaluate(() => {
      document.querySelector('arx-welcome')?.remove();
      const el = document.createElement('system-local-users') as HTMLElement & { roles: unknown[]; scopes: unknown[] };
      el.roles = [{ id: 'viewer', name: 'צופה', permissions: ['map.read'] }, { id: 'operator', name: 'מפעיל', permissions: ['map.read'] }, { id: 'site_admin', name: 'מנהל אתר', permissions: ['rbac.assign'] }];
      el.scopes = [{ type: 'installation', id: '*', name: 'כל ההתקנה' }];
      el.style.cssText = 'display:block;padding:16px;max-width:1100px;margin:auto';
      document.body.appendChild(el);
    });
    await expect(page.locator('system-local-users [data-local-users]')).toBeVisible();
    await page.locator('system-local-users [data-local-add]').click();
    await page.locator('system-local-users [data-local-role]').selectOption('site_admin');
    await expect(page.locator('system-local-users [data-local-admin-note]')).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE, `settings-local-users-${view.name}.png`), fullPage: true });
  });
}

// USR2 phase 2 screenshots for the design review (mocked data only): the reset code step and the WhatsApp actions of the settings tab.
for (const view of [{ name: 'desktop', w: 1440, h: 900 }, { name: 'mobile', w: 390, h: 844 }]) {
  test(`phase 2 screens for review (${view.name})`, async ({ page }) => {
    await page.setViewportSize({ width: view.w, height: view.h });
    await setup(page, {
      'POST /arx/api/v1/auth/local/reset/request': { status: 202, body: { accepted: true } },
      'GET /arx/api/v1/identity/local-users': { status: 200, body: P2_ROWS },
    });
    await mountLogin(page, true);
    await page.locator('arx-login [data-arx-mode="local"]').click();
    await page.locator('arx-login [data-arx-forgot]').click();
    await page.screenshot({ path: path.join(EVIDENCE, `login-local-forgot-${view.name}.png`) });
    await page.locator('arx-login #runame').fill('noa');
    await page.locator('arx-login [data-arx-send-code]').click();
    await expect(page.locator('arx-login [data-arx-reset-form]')).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE, `login-local-reset-code-${view.name}.png`) });
    await page.evaluate(() => document.querySelector('arx-login')?.remove());
    await mountUsers(page);
    await page.locator('system-local-users').getByText('נועה').click();
    await expect(page.locator('system-local-users [data-local-wa]')).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE, `settings-local-users-whatsapp-${view.name}.png`), fullPage: true });
  });
}
