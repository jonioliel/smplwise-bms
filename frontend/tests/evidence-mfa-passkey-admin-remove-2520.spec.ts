import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installAccessMock, NOW, url } from './access-control-mocks';

// MFA-PASSKEY-ADMIN-REMOVE-2520 (review MFA-REVIEW-2520 N-2): Settings › Users and permissions › Arx users › a user › "Remove passkey"
// uses the factor reset's dialog pattern (components/factor-reset-confirm), against a MOCKED backend (invented user):
//   1. "remove" reads the preflight `GET identity/local-users/{id}/passkeys/{pk}/remove-check` and opens a box under the passkey: what
//      goes, the typed username; the remove button waits for the exact username; the DELETE carries `{confirm}`; no browser dialog and
//      no confirm sheet any more; cancel sends nothing;
//   2. the preflight refuses (three removals / resets this hour): the refusal in the reader's language, no remove button, nothing sent;
//   3. an administrator with the authenticator code also types their own code (sent as the header);
//   4. the server's refusal (a typed username that does not match, when the preflight could not be read) is shown inside the box.
//   Hebrew and English. SW_BASE_URL=http://localhost:4173/ npx playwright test tests/evidence-mfa-passkey-admin-remove-2520.spec.ts --project=desktop --project=mobile --workers=2
// SW_SHOT_DIR=<dir> (+ SW_SCHEME=light|dark) also writes the compare-page pictures.

const skipTablet = () => test.skip(test.info().project.name === 'tablet', 'desktop + phone');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const at = (h: number) => new Date(Date.UTC(2026, 10, 20, h, 15)).toISOString();
const ADMIN_PERMS = ['map.read', 'video.live', 'system.configure', 'rbac.assign', 'audit.read', 'identity.directory.read', 'identity.local.manage', 'access.read', 'access.admin.read'];
const USER = { id: 'l_01', username: 'maria', display_name: 'מריה כהן', email: null, notes: null, status: 'active', active: true, created_at: at(1), last_sign_in_at: at(8),
  last_sign_in_from: null, role_id: 'operator', role_name: 'מפעיל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', admin: false, second_factor: true,
  reset_mode: 'manager_only', must_change_password: false, sessions: 1, ha_user_id: null, passkeys: 1, passkey_first: false, passkey_only: false };
const PASSKEYS = { user_id: 'l_01', available: true, rp_id: 'arx.example.com', origin: 'https://arx.example.com', first_allowed: false, first_on: false, only_on: false, only_effective: false,
  credentials: [{ id: 'pk_1', label: 'הטלפון של מריה', created_at: at(2), last_used_at: at(7), synced: true, backed_up: true, transports: ['internal'], usable: true, user_verifying: true }] };
type Check = Record<string, unknown>;
const CHECK = (over: Check = {}): Check => ({ user_id: 'l_01', allowed: true, reason: null, confirm_text: 'maria', channel: 'any', remote: false, resets_left: 2, rate_max: 3,
  factors: { totp: false, passkeys: 1, device_keys: 0, recovery_codes: 0 }, must_enroll_after: false,
  step_up: { action: 'auth.local.passkey.removed', methods: [], minutes: 0, once: true, verify_path: 'auth/step-up/verify' }, ...over });

interface Calls { deletes: { path: string; body: unknown; code: string | null }[]; checks: number; nativeDialogs: number }

async function boot(page: Page, lang: 'he' | 'en', opts: { check?: Check | 'fail'; remove?: { status: number; body: unknown } } = {}): Promise<Calls> {
  const st: Calls = { deletes: [], checks: 0, nativeDialogs: 0 };
  page.on('dialog', (d) => { st.nativeDialogs += 1; void d.dismiss(); });
  await installAccessMock(page, { persona: 'admin' });
  const dark = process.env.SW_SCHEME === 'dark';
  await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
  await page.addInitScript(([scheme, l]) => { localStorage.setItem('sw.ui.scheme', scheme); if (l === 'en') localStorage.setItem('sw.ui.lang', 'en'); }, [dark ? 'dark' : 'light', lang]);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') {
      return json(route, { user: { id: 'u-admin', username: 'admin', display_name: 'מנהלת המערכת', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: ADMIN_PERMS,
        permissions_any: ADMIN_PERMS, has_access: true, permission_revision: 41, bootstrap_state: 'done' });
    }
    if (p === 'me/prefs' && lang === 'en') return json(route, { prefs: { 'ui.lang': 'en' }, stored: ['ui.lang'], updated_at: null });
    if (p === 'identity/local-users/l_01/passkeys/pk_1/remove-check') {
      st.checks += 1;
      return opts.check === 'fail' ? json(route, { code: 'internal', user_message: 'x', retryable: true, correlation_id: 'mock', details: {} }, 500) : json(route, opts.check ?? CHECK());
    }
    if (p === 'identity/local-users/l_01/passkeys/pk_1' && req.method() === 'DELETE') {
      st.deletes.push({ path: p, body: req.postDataJSON(), code: req.headers()['x-arx-second-factor'] ?? null });
      const r = opts.remove ?? { status: 200, body: { ...PASSKEYS, credentials: [], removed: 'pk_1', sessions_ended: 1, passkey_first: false, factor_cleared: false, must_enroll: false, resets_left: 1 } };
      return json(route, r.body, r.status);
    }
    if (p === 'identity/local-users/l_01/passkeys') return json(route, st.deletes.length && !opts.remove ? { ...PASSKEYS, credentials: [] } : PASSKEYS);
    if (p === 'identity/local-users') return json(route, { enabled: true, can_manage: true, channel: 'local', passkey_first_allowed: false, users: [{ ...USER, passkeys: st.deletes.length && !opts.remove ? 0 : 1 }] });
    if (p === 'identity/users') return json(route, { users: [], directory: { paired: true, last_directory_at: at(9), users: 0 }, revision: 1, can_assign: true, remote_policy: 'flag' });
    if (p === 'access/roles') return json(route, { roles: [{ id: 'operator', name: 'מפעיל', permissions: ['map.read'], sensitive_included: [], sensitive_missing: [], system_role: false, delegable: true }], labels: {}, sensitive: [], system_permissions: [], delegable_roles: ['operator'], can_manage_roles: true, delegated: false });
    if (p === 'access/groups') return json(route, { groups: [], can_manage: true, delegated: false });
    if (p === 'sites') return json(route, { sites: [], can_create_site: true });
    if (p.startsWith('audit')) return json(route, { rows: [] });
    return route.fallback();
  });
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(url('/system/access?tab=local', 'classic', dark ? 'dark' : 'light'));
  await page.waitForSelector('sw-app');
  return st;
}

const LU = 'sw-app system-access system-local-users';

async function openPasskeys(page: Page): Promise<Locator> {
  await expect(page.locator(`${LU} [data-local-users]`)).toBeVisible({ timeout: 30_000 });
  await page.locator(LU).getByText('מריה כהן').first().click();
  const box = page.locator(`${LU} [data-local-passkeys]`);
  await expect(box.locator('[data-local-passkey="pk_1"]')).toBeVisible();
  return box;
}

async function shot(loc: Locator, name: string) {
  const dir = process.env.SW_SHOT_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  await loc.scrollIntoViewIfNeeded();
  await loc.screenshot({ path: path.join(dir, `${name}-${test.info().project.name}-${process.env.SW_SCHEME ?? 'light'}.png`), animations: 'disabled' });
}

const T = {
  he: { removes: 'יוסרו: מפתחות גישה: 1', label: 'לאישור, יש להקליד את שם המשתמש: maria', rate: 'אפשר לאפס דרכי אימות לשלושה משתמשים לכל היותר בשעה', mismatch: 'שם המשתמש שהוקלד אינו תואם לחשבון', remove: 'הסרת מפתח' },
  en: { removes: 'To be removed: Passkeys: 1', label: 'To confirm, type the username: maria', rate: 'Sign-in methods can be reset for at most three users an hour', mismatch: 'The username typed does not match the account', remove: 'Remove passkey' },
};

test.describe('the administrator removes an Arx user\'s passkey through the reset dialog (MFA-PASSKEY-ADMIN-REMOVE-2520)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.setTimeout(120_000);

  for (const lang of ['he', 'en'] as const) {
    test(`the box: what goes, the typed username, the DELETE carries it; cancel sends nothing (${lang})`, async ({ page }) => {
      skipTablet();
      const st = await boot(page, lang);
      const box = await openPasskeys(page);
      await box.locator('[data-local-passkey-remove]').click();
      const arm = box.locator('[data-local-passkey-remove-box]');
      await expect(arm.locator('[data-reset-removes]')).toHaveText(T[lang].removes);
      await expect(arm.locator('[data-reset-confirm-label]')).toContainText(T[lang].label);
      await expect(page.locator('sw-confirm-dialog')).toHaveCount(0); // the old confirm sheet is gone
      const go = arm.locator('[data-local-passkey-remove-confirm]');
      await expect(go).toHaveText(T[lang].remove);
      await expect(go).toHaveAttribute('disabled', '');
      await arm.locator('[data-reset-confirm-text]').fill('mari');
      await expect(go).toHaveAttribute('disabled', '');
      await arm.locator('[data-reset-confirm-text]').fill('Maria ');
      await expect(go).not.toHaveAttribute('disabled', '');
      await shot(arm, `remove-armed-${lang}`);
      // cancel: nothing sent, the row's own button again
      await arm.locator('[data-local-passkey-remove-cancel]').click();
      await expect(box.locator('[data-local-passkey-remove-box]')).toHaveCount(0);
      expect(st.deletes).toEqual([]);
      // again, and remove
      await box.locator('[data-local-passkey-remove]').click();
      await box.locator('[data-reset-confirm-text]').fill('maria');
      await box.locator('[data-local-passkey-remove-confirm]').click();
      await expect.poll(() => st.deletes.length).toBe(1);
      expect(st.deletes[0]).toEqual({ path: 'identity/local-users/l_01/passkeys/pk_1', body: { confirm: 'maria' }, code: null });
      await expect(box.locator('[data-local-passkey-remove-box]')).toHaveCount(0);
      expect(st.checks).toBe(2);
      expect(st.nativeDialogs).toBe(0);
    });

    test(`the preflight refuses: the reason in the reader's language, no remove button, nothing sent (${lang})`, async ({ page }) => {
      skipTablet();
      const st = await boot(page, lang, { check: CHECK({ allowed: false, reason: 'rate_limited', resets_left: 0 }) });
      const box = await openPasskeys(page);
      await box.locator('[data-local-passkey-remove]').click();
      const arm = box.locator('[data-local-passkey-remove-box]');
      await expect(arm.locator('[data-reset-refused="rate_limited"]')).toContainText(T[lang].rate);
      await expect(arm.locator('[data-local-passkey-remove-confirm]')).toHaveCount(0);
      await expect(arm.locator('[data-reset-confirm-text]')).toHaveCount(0);
      await shot(arm, `remove-refused-${lang}`);
      expect(st.deletes).toEqual([]);
    });
  }

  test('an administrator with the authenticator code types their own code too; it goes as the header', async ({ page }) => {
    skipTablet();
    const st = await boot(page, 'he', { check: CHECK({ step_up: { action: 'auth.local.passkey.removed', methods: ['totp'], minutes: 0, once: true, verify_path: 'auth/step-up/verify' } }) });
    const box = await openPasskeys(page);
    await box.locator('[data-local-passkey-remove]').click();
    const arm = box.locator('[data-local-passkey-remove-box]');
    await arm.locator('[data-reset-confirm-text]').fill('maria');
    const go = arm.locator('[data-local-passkey-remove-confirm]');
    await expect(go).toHaveAttribute('disabled', ''); // the own code is still missing
    await arm.locator('[data-local-passkey-code]').fill('123456');
    await expect(go).not.toHaveAttribute('disabled', '');
    await go.click();
    await expect.poll(() => st.deletes.length).toBe(1);
    expect(st.deletes[0].code).toBe('123456');
  });

  test('the preflight could not be read: the typed field is still asked and the server\'s refusal shows inside the box', async ({ page }) => {
    skipTablet();
    const st = await boot(page, 'he', { check: 'fail', remove: { status: 422, body: { code: 'factor_reset_confirm_mismatch', user_message: 'x', retryable: false, correlation_id: 'mock', details: { field: 'confirm' } } } });
    const box = await openPasskeys(page);
    await box.locator('[data-local-passkey-remove]').click();
    const arm = box.locator('[data-local-passkey-remove-box]');
    await expect(arm.locator('[data-reset-removes]')).toHaveCount(0);
    await arm.locator('[data-reset-confirm-text]').fill('someone');
    await arm.locator('[data-local-passkey-remove-confirm]').click();
    await expect(arm.locator('[data-local-passkey-remove-error]')).toContainText(T.he.mismatch);
    expect(st.deletes).toHaveLength(1);
    await expect(box.locator('[data-local-passkey="pk_1"]')).toBeVisible(); // nothing removed
  });
});
