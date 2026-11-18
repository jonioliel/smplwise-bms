import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// CR-LOCAL-USER-CREATE-2438 (owner 18.11: "the user is not saved, and I have no way to set a password"). The real components, bundled
// as they are, on a mocked same-origin page. First the root cause: `sw-button type="submit"` keeps its native button in a shadow root,
// where it has no form owner - the click submitted nothing, so the create form never sent a request. Then the feature: the
// administrator sets the password at creation (or sends the link instead) and on an existing user; every refusal is shown in the form.
//   npx playwright test tests/unit-local-user-create-2438.spec.ts --project=desktop

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'http://arx.test';
const API = '/arx/api/v1/identity/local-users';
const TAB = 'system-local-users';
const PW = 'seven green boats 91';

test.use({ serviceWorkers: 'block' });

let bundled = '';

async function bundle(): Promise<string> {
  if (bundled) return bundled;
  const out = await build({
    stdin: { contents: "import '../design/boot';\nimport '../components/sw-button';\nimport '../screens/system-local-users';\n", resolveDir: path.join(HERE, '../src/arx'), loader: 'ts' },
    bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', tsconfig: path.join(HERE, '../tsconfig.json'),
    define: { 'import.meta.env.BASE_URL': '"/arx/"' },
  });
  bundled = out.outputFiles[0].text;
  return bundled;
}

type Call = { path: string; method: string; body: string };
type Answer = { status: number; body: unknown };

function user(id: string, username: string, display: string, over: Record<string, unknown> = {}) {
  return { id, username, display_name: display, email: null, notes: null, status: 'active', active: true, created_at: '2026-11-18T08:00:00Z', last_sign_in_at: null,
    last_sign_in_from: null, role_id: 'viewer', role_name: 'צופה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', admin: false, second_factor: false,
    reset_mode: 'manager_only', must_change_password: false, sessions: 0, ha_user_id: null, ...over };
}

const NOA = user('l_01JTEST0000000000000000011', 'noa', 'נועה');
const BOSS = user('l_01JTEST0000000000000000012', 'site.lead', 'אבי לוי', { role_id: 'site_admin', role_name: 'מנהל אתר', admin: true });

/** The tab on a mocked server: the list (with what was created so far) and whatever `answers` says for the writes. */
async function open(page: Page, answers: Record<string, Answer | ((body: string) => Answer)>, opts: { channel?: 'local' | 'remote'; lang?: 'he' | 'en'; min?: number } = {}) {
  const calls: Call[] = [];
  const users: unknown[] = [NOA, BOSS];
  await page.route(`${ORIGIN}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postData() ?? '';
    if (url.pathname === '/arx/' || url.pathname === '/arx/index.html') {
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="${opts.lang ?? 'he'}" dir="${opts.lang === 'en' ? 'ltr' : 'rtl'}"><head><title>t</title></head><body></body></html>` });
    }
    calls.push({ path: url.pathname, method: req.method(), body });
    if (req.method() === 'GET' && url.pathname === API) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, can_manage: true, channel: opts.channel ?? 'remote', users, password_min: opts.min ?? 12 }) });
    }
    const hit = answers[`${req.method()} ${url.pathname}`];
    const a = typeof hit === 'function' ? hit(body) : hit;
    if (!a) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"not_found","user_message":"","details":{}}' });
    if (a.status === 201) users.push((a.body as { user: unknown }).user);
    return route.fulfill({ status: a.status, contentType: 'application/json', body: JSON.stringify(a.body) });
  });
  await page.goto(`${ORIGIN}/arx/`);
  await page.addScriptTag({ content: await bundle() });
  await page.evaluate(() => {
    const el = document.createElement('system-local-users') as HTMLElement & { roles: unknown[]; scopes: unknown[] };
    el.roles = [{ id: 'viewer', name: 'צופה', permissions: ['map.read'] }, { id: 'site_admin', name: 'מנהל אתר', permissions: ['rbac.assign'] }];
    el.scopes = [{ type: 'installation', id: '*', name: 'כל ההתקנה' }];
    document.body.appendChild(el);
  });
  await expect(page.locator(`${TAB} [data-local-users]`)).toBeVisible();
  return calls;
}

const created = (body: string, over: Record<string, unknown> = {}): Answer => {
  const b = JSON.parse(body) as { username: string; display_name: string; password?: string; must_change?: boolean };
  const withPw = b.password !== undefined;
  return { status: 201, body: {
    user: user('l_01JTEST0000000000000000099', b.username.toLowerCase(), b.display_name, { status: withPw ? 'active' : 'pending_first_login', must_change_password: withPw && b.must_change !== false, ...over }),
    password_set: withPw,
    link: withPw ? null : { purpose: 'first_login', path: '/arx/#/welcome?t=TOKEN', url: 'https://arx.example.com/arx/#/welcome?t=TOKEN', expires_at: '2026-11-21T08:00:00Z' },
  } };
};

const posts = (calls: Call[]) => calls.filter((c) => c.method === 'POST' && c.path === API).map((c) => JSON.parse(c.body) as Record<string, unknown>);

async function fill(page: Page, username: string, display: string, pw?: [string, string]) {
  await page.locator(`${TAB} [data-local-add]`).click();
  await page.locator(`${TAB} [data-local-username]`).fill(username);
  await page.locator(`${TAB} [data-local-display]`).fill(display);
  if (pw) {
    await page.locator(`${TAB} [data-local-pw="create"]`).fill(pw[0]);
    await page.locator(`${TAB} [data-local-pw-again="create"]`).fill(pw[1]);
  }
}

// ---------------------------------------------------------------- the root cause

test('sw-button type="submit" submits the form around it (it sat in a shadow root and submitted nothing)', async ({ page }) => {
  await open(page, {});
  const result = await page.evaluate(async () => {
    const form = document.createElement('form');
    form.innerHTML = '<input name="a" value="1" /><input name="b" value="2" /><sw-button type="submit" id="go">go</sw-button><sw-button id="plain">plain</sw-button><sw-button type="submit" disabled id="off">off</sw-button>';
    let submits = 0;
    form.addEventListener('submit', (e) => { e.preventDefault(); submits += 1; });
    document.body.appendChild(form);
    await (form.querySelector('#go') as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
    const press = (id: string) => (form.querySelector(id)!.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    press('#plain');
    const afterPlain = submits;
    press('#off');
    const afterDisabled = submits;
    press('#go');
    return { afterPlain, afterDisabled, afterSubmit: submits };
  });
  expect(result).toEqual({ afterPlain: 0, afterDisabled: 0, afterSubmit: 1 });
});

test('the create button sends the form: one POST, the user appears, the form closes', async ({ page }) => {
  const calls = await open(page, { [`POST ${API}`]: created });
  await fill(page, 'Dana.K', 'דנה קליין', [PW, PW]);
  await page.locator(`${TAB} [data-local-create-save]`).click();
  await expect(page.locator(`${TAB} [data-local-done]`)).toContainText('דנה קליין');
  expect(posts(calls)).toEqual([{ username: 'Dana.K', display_name: 'דנה קליין', role_id: 'viewer', scope_type: 'installation', scope_id: '*', email: null, notes: null,
    reset_mode: 'manager_only', password: PW, must_change: true }]);
  await expect(page.locator(`${TAB} [data-local-done]`)).toContainText('dana.k');
  await expect(page.locator(`${TAB} [data-local-done]`)).toContainText('יתבקש לבחור סיסמה משלו');
  await expect(page.locator(`${TAB} [data-local-create]`)).toHaveCount(0);
  await expect(page.locator(`${TAB} [data-local-link]`)).toHaveCount(0); // a password was set: no link to hand over
  await expect(page.locator(TAB).getByText('דנה קליין').first()).toBeVisible();
  // the typed password is not kept in the page: a reopened form starts empty
  await page.locator(`${TAB} [data-local-add]`).click();
  await expect(page.locator(`${TAB} [data-local-pw="create"]`)).toHaveValue('');
  await expect(page.locator(`${TAB} [data-local-pw-again="create"]`)).toHaveValue('');
  expect(await page.evaluate(() => JSON.stringify({ ...window.localStorage, ...window.sessionStorage }))).not.toContain(PW);
});

test('Enter in a field sends the form too', async ({ page }) => {
  const calls = await open(page, { [`POST ${API}`]: created });
  await fill(page, 'enter.key', 'מקש אנטר', [PW, PW]);
  await page.locator(`${TAB} [data-local-pw-again="create"]`).press('Enter');
  await expect(page.locator(`${TAB} [data-local-done]`)).toBeVisible();
  expect(posts(calls)).toHaveLength(1);
});

// ---------------------------------------------------------------- the password

test('the page checks the pair before sending: missing, different, too short - nothing is sent', async ({ page }) => {
  const calls = await open(page, { [`POST ${API}`]: created }, { min: 14 });
  const err = page.locator(`${TAB} [data-local-create-error]`);
  const save = page.locator(`${TAB} [data-local-create-save]`);
  await page.locator(`${TAB} [data-local-add]`).click();
  await expect(page.locator(`${TAB} [data-local-create]`)).toContainText('לפחות 14 תווים');
  await save.click();
  await expect(err).toHaveText('יש למלא שם משתמש ושם תצוגה.');
  await page.locator(`${TAB} [data-local-username]`).fill('dana');
  await page.locator(`${TAB} [data-local-display]`).fill('דנה');
  await save.click();
  await expect(err).toHaveText('יש להזין את הסיסמה פעמיים.');
  await page.locator(`${TAB} [data-local-pw="create"]`).fill(PW);
  await page.locator(`${TAB} [data-local-pw-again="create"]`).fill(PW + 'x');
  await save.click();
  await expect(err).toHaveText('שתי הסיסמאות אינן זהות.');
  await page.locator(`${TAB} [data-local-pw="create"]`).fill('thirteen char');
  await page.locator(`${TAB} [data-local-pw-again="create"]`).fill('thirteen char');
  await save.click();
  await expect(err).toHaveText('הסיסמה קצרה מדי: נדרשים לפחות 14 תווים.');
  expect(posts(calls)).toHaveLength(0);
  await page.locator(`${TAB} [data-local-pw="create"]`).fill(PW);
  await page.locator(`${TAB} [data-local-pw-again="create"]`).fill(PW);
  await save.click();
  await expect(page.locator(`${TAB} [data-local-done]`)).toBeVisible();
  expect(posts(calls)).toHaveLength(1);
});

test('"must change at the first sign-in" is on by default and the administrator may turn it off', async ({ page }) => {
  const calls = await open(page, { [`POST ${API}`]: created });
  await fill(page, 'dana', 'דנה', [PW, PW]);
  const must = page.locator(`${TAB} [data-local-pw-must="create"]`);
  await expect(must).toBeChecked();
  await must.uncheck();
  await page.locator(`${TAB} [data-local-create-save]`).click();
  await expect(page.locator(`${TAB} [data-local-done]`)).toBeVisible();
  await expect(page.locator(`${TAB} [data-local-done]`)).not.toContainText('יתבקש');
  expect(posts(calls)[0]).toMatchObject({ password: PW, must_change: false });
});

test('"send a link instead": no password travels and the one-time link is shown', async ({ page }) => {
  const calls = await open(page, { [`POST ${API}`]: created });
  await fill(page, 'dana', 'דנה');
  await page.locator(`${TAB} [data-local-pw-mode]`).selectOption('link');
  await expect(page.locator(`${TAB} [data-local-pw="create"]`)).toHaveCount(0);
  await expect(page.locator(`${TAB} [data-local-pw-link-help]`)).toBeVisible();
  await page.locator(`${TAB} [data-local-create-save]`).click();
  await expect(page.locator(`${TAB} [data-local-link-text]`)).toHaveText('https://arx.example.com/arx/#/welcome?t=TOKEN');
  expect(posts(calls)).toHaveLength(1);
  expect(posts(calls)[0]).not.toHaveProperty('password');
  expect(posts(calls)[0]).not.toHaveProperty('must_change');
  await expect(page.locator(`${TAB} [data-local-done]`)).toHaveCount(0);
});

// ---------------------------------------------------------------- refusals are visible

for (const [name, status, body] of [
  ['a username the server refuses', 422, { code: 'validation', user_message: 'שם משתמש: 3-32 תווים באנגלית קטנה, ספרות, נקודה, קו תחתון או מקף, ומתחיל באות או ספרה.', retryable: false, details: { field: 'username' } }],
  ['a taken username', 409, { code: 'username_taken', user_message: 'שם המשתמש תפוס (גם שמות של משתמשי תשתית המערכת שמורים).', retryable: false, details: {} }],
  ['a password the policy refuses', 400, { code: 'password_policy', user_message: 'הסיסמה נפוצה מדי וקלה לניחוש. בחר משפט או צירוף ארוך יותר.', retryable: false, details: { reason: 'common', min_length: 12 } }],
  ['a scope that no longer exists', 422, { code: 'scope_unknown', user_message: 'ההיקף (אתר / מבנה / קומה / מצלמה) לא נמצא.', retryable: false, details: {} }],
] as const) {
  test(`a refusal is shown inside the form with the server's sentence, and the form keeps what was typed: ${name}`, async ({ page }) => {
    const calls = await open(page, { [`POST ${API}`]: { status, body } });
    await fill(page, 'דנה כהן', 'דנה כהן', [PW, PW]);
    await page.locator(`${TAB} [data-local-create-save]`).click();
    const err = page.locator(`${TAB} [data-local-create] [data-local-create-error]`);
    await expect(err).toHaveText(body.user_message);
    await expect(err).toHaveAttribute('role', 'alert');
    await expect(err).toBeInViewport();
    expect(posts(calls)).toHaveLength(1);
    await expect(page.locator(`${TAB} [data-local-username]`)).toHaveValue('דנה כהן');
    await expect(page.locator(`${TAB} [data-local-pw="create"]`)).toHaveValue(PW);
    await expect(page.locator(`${TAB} [data-local-create-save]`)).not.toHaveAttribute('disabled', ''); // ready for the next try
  });
}

test('offline: the form says there is no connection', async ({ page }) => {
  await open(page, {});
  await page.route(`${ORIGIN}${API}`, (route) => (route.request().method() === 'POST' ? route.abort('internetdisconnected') : route.fallback()));
  await fill(page, 'dana', 'דנה', [PW, PW]);
  await page.locator(`${TAB} [data-local-create-save]`).click();
  await expect(page.locator(`${TAB} [data-local-create-error]`)).toHaveText('אין חיבור לשרת.');
});

test('remote channel: an administrative role cannot be created (disabled option, disabled button, Enter sends nothing)', async ({ page }) => {
  const calls = await open(page, { [`POST ${API}`]: created }, { channel: 'remote' });
  await fill(page, 'boss2', 'מנהל', [PW, PW]);
  await expect(page.locator(`${TAB} [data-local-role] option[value="site_admin"]`)).toHaveAttribute('disabled', '');
  await page.evaluate(() => {
    const el = document.querySelector('system-local-users') as unknown as { form: Record<string, string> };
    el.form = { ...el.form, role_id: 'site_admin' };
  });
  await expect(page.locator(`${TAB} [data-local-create-save] button`)).toBeDisabled();
  await page.locator(`${TAB} [data-local-display]`).press('Enter');
  await page.waitForTimeout(300);
  expect(posts(calls)).toHaveLength(0);
});

// ---------------------------------------------------------------- an existing user

test('set password on an existing user: the pair is checked, the PUT carries it, the result is said', async ({ page }) => {
  const url = `${API}/${NOA.id}/password`;
  const calls = await open(page, { [`PUT ${url}`]: { status: 200, body: { ...NOA, must_change_password: true, sessions_ended: 1, links_invalidated: 0 } } });
  await page.locator(TAB).getByText('נועה').first().click();
  await page.locator(`${TAB} [data-local-pw-set]`).click();
  const form = page.locator(`${TAB} [data-local-pw-form]`);
  await expect(form).toContainText('כל הכניסות הפעילות של המשתמש מסתיימות');
  await expect(form).toContainText('המשתמש חייב להחליף סיסמה בכניסה הבאה');
  await expect(form.locator('[data-local-pw-must="user"]')).toBeChecked();
  await form.locator('[data-local-pw="user"]').fill(PW);
  await form.locator('[data-local-pw-again="user"]').fill('something else 123');
  await form.locator('[data-local-pw-save]').click();
  await expect(form.locator('[data-local-pw-error]')).toHaveText('שתי הסיסמאות אינן זהות.');
  expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
  await form.locator('[data-local-pw-again="user"]').fill(PW);
  await form.locator('[data-local-pw-save]').click();
  await expect(page.locator(`${TAB} [data-local-done]`)).toContainText('הסיסמה של נועה נקבעה');
  await expect(page.locator(`${TAB} [data-local-pw-form]`)).toHaveCount(0);
  expect(calls.filter((c) => c.method === 'PUT').map((c) => [c.path, JSON.parse(c.body)])).toEqual([[url, { password: PW, must_change: true }]]);
});

test('set password: the server\'s refusal is shown in the panel', async ({ page }) => {
  const url = `${API}/${NOA.id}/password`;
  await open(page, { [`PUT ${url}`]: { status: 400, body: { code: 'password_policy', user_message: 'הסיסמה מבוססת על שם המשתמש, שם המערכת או שם האתר. בחר סיסמה אחרת.', retryable: false, details: { reason: 'contextual' } } } });
  await page.locator(TAB).getByText('נועה').first().click();
  await page.locator(`${TAB} [data-local-pw-set]`).click();
  await page.locator(`${TAB} [data-local-pw="user"]`).fill(PW);
  await page.locator(`${TAB} [data-local-pw-again="user"]`).fill(PW);
  await page.locator(`${TAB} [data-local-pw-save]`).click();
  await expect(page.locator(`${TAB} [data-local-pw-error]`)).toHaveText('הסיסמה מבוססת על שם המשתמש, שם המערכת או שם האתר. בחר סיסמה אחרת.');
  await expect(page.locator(`${TAB} [data-local-pw-form]`)).toBeVisible();
});

test('an administrative user on the remote channel gets no set-password action (local channel only); on the local channel it does', async ({ page }) => {
  await open(page, {}, { channel: 'remote' });
  await page.locator(TAB).getByText('אבי לוי').first().click();
  await expect(page.locator(`${TAB} [data-local-only]`)).toBeVisible();
  await expect(page.locator(`${TAB} [data-local-pw-set]`)).toHaveCount(0);
  await page.locator(TAB).getByText('נועה').first().click();
  await expect(page.locator(`${TAB} [data-local-pw-set]`)).toBeVisible();
});

test('local channel: the administrative user has the set-password action', async ({ page }) => {
  await open(page, {}, { channel: 'local' });
  await page.locator(TAB).getByText('אבי לוי').first().click();
  await expect(page.locator(`${TAB} [data-local-pw-set]`)).toBeVisible();
});

// ---------------------------------------------------------------- English

test('English: the password texts follow the document language', async ({ page }) => {
  await open(page, { [`POST ${API}`]: created }, { lang: 'en' });
  await page.locator(`${TAB} [data-local-add]`).click();
  const form = page.locator(`${TAB} [data-local-create]`);
  await expect(form).toContainText('How the user gets a password');
  await expect(form).toContainText('The user must change the password at the first sign-in');
  await expect(form.locator('[data-local-pw-mode] option[value="link"]')).toHaveText('Send a link instead (the user chooses a password)');
  await page.locator(`${TAB} [data-local-create-save]`).click();
  await expect(page.locator(`${TAB} [data-local-create-error]`)).toHaveText('Fill in the username and the display name.');
});
