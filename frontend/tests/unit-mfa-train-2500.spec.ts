import { test, expect, type Page, type Route } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// MFA-TRAIN-2500: the shell's step-up dialog (slice 2) after the passkey slice (slice 4) - a passkey-only administrator can now pass
// the central gate. Against a MOCKED wire contract (PATCH settings with the gate's 403, auth/step-up/challenge, auth/step-up/verify;
// an invented administrator, no secrets) and a Chromium VIRTUAL authenticator (CDP WebAuthn) holding one passkey for `localhost`.
// Covered: a passkey-only user sees only the passkey button and the save is sent again exactly once after the passkey proof; a user
// with both methods sees the passkey and the code, and the code path is unchanged; a server refusal of the passkey keeps the dialog
// open with the message, the next try passes, still one retry; cancel after a refusal sends nothing more.
// WebAuthn needs a domain RP id: the page is opened at `localhost` (a 127.0.0.1 base address is rewritten to localhost).
//   SW_BASE_URL=http://localhost:5297/ npx playwright test tests/unit-mfa-train-2500.spec.ts --project=desktop --project=mobile --workers=2
// SW_SHOTS_DIR=<dir> also writes the compare-page shots of the dialog (both methods / passkey only; light + dark).

const REMOTE_TAB = '/?design=a#/system/diagnostics?tab=remote';
const PERMS = ['video.live', 'map.read', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign'];
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (code: string, msg: string, details: Record<string, unknown> = {}) => ({ code, user_message: msg, retryable: false, correlation_id: 'mock', details });
const b64u = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const GOOD = '246810';
const CRED_ID = Buffer.from('arx-train-2500-passkey');

interface Verify {
  method: string;
  code?: string;
  challenge_id?: string;
  action?: string;
}

interface Mock {
  methods: string[];
  patches: Record<string, unknown>[];
  refused: number;
  challenges: { action?: string }[];
  verifies: Verify[];
  until: string | null;
  challenge: string;
  /** the next passkey verifications the server refuses (400 step_up_failed) */
  refusePasskey: number;
}

async function setup(page: Page, methods: string[], over: Partial<Mock> = {}): Promise<Mock> {
  const st: Mock = { methods, patches: [], refused: 0, challenges: [], verifies: [], until: null, challenge: '', refusePasskey: 0, ...over };
  const settings: Record<string, unknown> = { 'ui.design': 'a', 'security.second_factor_policy': 'optional', 'remote.policy': 'flag', 'security.step_up': 'on', 'security.step_up_minutes': 5, 'security.step_up_local': 'off' };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me') return json(route, { user: { id: 'u-admin', username: 'admin', display_name: 'מנהל', source: 'ingress' }, channel: 'local', remote: null, active: true, bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל מערכת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'settings' && method === 'PATCH') {
      if (!st.until) {
        st.refused += 1;
        return json(route, err('step_up_required', 'לפני שינוי הגדרות, משתמשים או הרשאות צריך לאשר שוב את הזהות.', { action: 'system.configure', methods: st.methods, minutes: 5, verify_path: 'auth/step-up/verify' }), 403);
      }
      const body = req.postDataJSON() as Record<string, unknown>;
      st.patches.push(body);
      Object.assign(settings, body);
      return json(route, { settings, can_edit: true });
    }
    if (p === 'settings') return json(route, { settings, can_edit: true });
    if (p === 'auth/step-up' && method === 'GET') return json(route, { enabled: true, minutes: 5, local_channel: false, applies: true, reason: null, methods: st.methods, valid_until: st.until });
    if (p === 'auth/step-up/challenge' && method === 'POST') {
      const body = (req.postDataJSON() ?? {}) as { action?: string };
      st.challenges.push({ action: body.action });
      st.challenge = b64u(crypto.randomBytes(32));
      return json(route, {
        challenge_id: 'suc_train', action: body.action ?? '', expires_in: 60, methods: st.methods,
        webauthn: { publicKey: { challenge: st.challenge, rpId: 'localhost', timeout: 60000, userVerification: 'required', allowCredentials: [{ type: 'public-key', id: b64u(CRED_ID) }] } },
      });
    }
    if (p === 'auth/step-up/verify' && method === 'POST') {
      const body = req.postDataJSON() as { method: string; code?: string; challenge_id?: string; action?: string; assertion?: { rawId?: string; response?: { clientDataJSON?: string; signature?: string } } };
      st.verifies.push({ method: body.method, code: body.code, challenge_id: body.challenge_id, action: body.action });
      if (body.method === 'passkey') {
        const cd = JSON.parse(fromB64u(body.assertion?.response?.clientDataJSON ?? '').toString('utf8') || '{}') as { type?: string; challenge?: string };
        const ok = body.challenge_id === 'suc_train' && cd.type === 'webauthn.get' && cd.challenge === st.challenge && body.assertion?.rawId === b64u(CRED_ID) && !!body.assertion?.response?.signature;
        if (!ok || st.refusePasskey > 0) {
          st.refusePasskey = Math.max(0, st.refusePasskey - 1);
          return json(route, err('step_up_failed', 'האישור במפתח הגישה נכשל. נסה שוב.'), 400);
        }
        st.until = '2026-11-24T10:05:00+00:00';
        return json(route, { method: 'passkey', minutes: 5, valid_until: st.until });
      }
      if (body.code !== GOOD) return json(route, err('second_factor_invalid', 'קוד האימות אינו נכון. בדוק את הקוד באפליקציית האימות ונסה שוב.'), 400);
      st.until = '2026-11-24T10:05:00+00:00';
      return json(route, { method: 'totp', minutes: 5, valid_until: st.until });
    }
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-11-24T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });
    if (p === 'auth/sessions') return json(route, { scope: 'all', can_manage: true, channel: 'local', sessions: [] });
    return json(route, err('not_found', 'לא נמצא (בדיקה)'), 404);
  });
  return st;
}

/** A virtual platform authenticator (fingerprint / device PIN always passes) holding the administrator's passkey for `localhost`. */
async function device(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  await cdp.send('WebAuthn.addCredential', {
    authenticatorId,
    credential: {
      credentialId: CRED_ID.toString('base64'), isResidentCredential: true, rpId: 'localhost',
      privateKey: (privateKey.export({ format: 'der', type: 'pkcs8' }) as Buffer).toString('base64'), signCount: 0, userHandle: Buffer.from('u-admin').toString('base64'),
    },
  });
}

async function openRemote(page: Page, baseURL: string | undefined) {
  const base = (baseURL || 'http://localhost:4173/').replace('//127.0.0.1', '//localhost');
  await page.goto(new URL(REMOTE_TAB, base).toString());
  await page.waitForSelector('sw-app system-diagnostics');
  await expect(page.locator('system-diagnostics [data-step-up-settings]')).toBeVisible();
}

const dialog = (page: Page) => page.locator('sw-step-up-dialog');
const save = (page: Page) => page.locator('system-diagnostics [data-save-remote]');

async function changeAndSave(page: Page) {
  const minutes = page.locator('system-diagnostics input[data-set-step-up="security.step_up_minutes"]');
  await minutes.fill('10');
  await minutes.dispatchEvent('change');
  await expect(save(page)).not.toHaveAttribute('disabled', '');
  await save(page).click();
}

test('a passkey-only administrator: only the passkey button; the passkey proof re-sends the save exactly once', async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const st = await setup(page, ['passkey']);
  await device(page);
  await openRemote(page, baseURL);
  await changeAndSave(page);
  const d = dialog(page);
  const pk = d.locator('[data-step-up-passkey]');
  await expect(pk).toBeVisible();
  await expect(pk).toHaveAttribute('variant', 'primary');
  await expect(d.locator('[data-step-up-text]')).toContainText('מפתח גישה');
  await expect(d.locator('[data-step-up-code]')).toHaveCount(0);
  await expect(d.locator('[data-step-up-confirm]')).toHaveCount(0);
  await expect(d.locator('[data-step-up-no-method]')).toHaveCount(0);

  await pk.click();
  await expect(d).toHaveCount(0);
  await expect.poll(() => st.patches).toEqual([{ 'security.step_up_minutes': 10 }]);
  expect(st.refused).toBe(1);
  expect(st.challenges).toEqual([{ action: 'system.configure' }]);
  expect(st.verifies).toEqual([{ method: 'passkey', code: undefined, challenge_id: 'suc_train', action: 'system.configure' }]);
  await expect(page.locator('system-diagnostics .foot .ok')).toBeVisible();
  expect(errors).toEqual([]);
});

test('both methods: the passkey and the code are offered; the code path is unchanged (one retry)', async ({ page, baseURL }) => {
  const st = await setup(page, ['totp', 'passkey']);
  await device(page);
  await openRemote(page, baseURL);
  await changeAndSave(page);
  const d = dialog(page);
  await expect(d.locator('[data-step-up-passkey]')).toBeVisible();
  await expect(d.locator('[data-step-up-passkey]')).toHaveAttribute('variant', 'secondary');
  await expect(d.locator('[data-step-up-code]')).toBeVisible();
  await expect(d.locator('[data-step-up-text]')).toContainText('מפתח גישה');
  await expect(d.locator('[data-step-up-text]')).toContainText('אפליקציית האימות');

  await d.locator('[data-step-up-code]').fill(GOOD);
  await d.locator('[data-step-up-confirm]').click();
  await expect(d).toHaveCount(0);
  await expect.poll(() => st.patches).toEqual([{ 'security.step_up_minutes': 10 }]);
  expect(st.refused).toBe(1);
  expect(st.challenges).toEqual([]);
  expect(st.verifies).toEqual([{ method: 'totp', code: GOOD, challenge_id: undefined, action: 'system.configure' }]);
});

test('a refused passkey keeps the dialog open with the message; the next try passes and the save is sent once', async ({ page, baseURL }) => {
  const st = await setup(page, ['totp', 'passkey'], { refusePasskey: 1 });
  await device(page);
  await openRemote(page, baseURL);
  await changeAndSave(page);
  const d = dialog(page);
  await d.locator('[data-step-up-passkey]').click();
  await expect(d.locator('[data-step-up-error]')).toContainText('האישור במפתח הגישה נכשל');
  await expect(d.locator('[data-step-up-passkey]')).toBeVisible();
  expect(st.patches).toEqual([]);

  await d.locator('[data-step-up-passkey]').click();
  await expect(d).toHaveCount(0);
  await expect.poll(() => st.patches).toEqual([{ 'security.step_up_minutes': 10 }]);
  expect(st.refused).toBe(1);
  expect(st.challenges).toHaveLength(2); // every try asks a fresh single-use challenge
  expect(st.verifies.map((v) => v.method)).toEqual(['passkey', 'passkey']);
});

test('cancel after a refused passkey sends nothing more and the save row shows the refusal', async ({ page, baseURL }) => {
  const st = await setup(page, ['passkey'], { refusePasskey: 5 });
  await device(page);
  await openRemote(page, baseURL);
  await changeAndSave(page);
  const d = dialog(page);
  await d.locator('[data-step-up-passkey]').click();
  await expect(d.locator('[data-step-up-error]')).toBeVisible();
  await d.locator('[data-step-up-cancel]').click();
  await expect(d).toHaveCount(0);
  await expect(page.locator('system-diagnostics .foot .err')).toContainText('לאשר שוב את הזהות');
  expect(st.patches).toEqual([]);
  expect(st.refused).toBe(1);
  expect(st.verifies).toHaveLength(1);
});

// ---------------------------------------------------------------- compare-page screenshots (SW_SHOTS_DIR only)

const SHOTS = process.env.SW_SHOTS_DIR || '';
for (const variant of [{ name: 'both', methods: ['totp', 'passkey'] }, { name: 'passkey', methods: ['passkey'] }]) {
  test(`shots: dialog ${variant.name}`, async ({ page, baseURL }, info) => {
    test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
    fs.mkdirSync(SHOTS, { recursive: true });
    await setup(page, variant.methods);
    await device(page);
    await openRemote(page, baseURL);
    await changeAndSave(page);
    await expect(dialog(page).locator('sw-dialog')).toBeVisible();
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.evaluate((s) => document.documentElement.setAttribute('data-theme', s), scheme);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SHOTS, `${info.project.name}-${scheme}-${variant.name}.png`) });
    }
  });
}
