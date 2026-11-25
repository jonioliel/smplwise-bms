import { test, expect, type Page, type Route } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// MFA-T095-REST-2530 (CR-011 option D and 4E / Q6): the step-up dialog's two action-bound methods and the phone's approval sheet,
// against a MOCKED wire contract (an invented administrator, no secrets).
// * APPROVE ON THE PHONE (`push`): the dialog opens a request, shows its number, waits; approved -> it spends the approval
//   (`auth/step-up/verify {method: "push"}`) and the save is sent again exactly once; denied -> the message, no retry; cancel -> the open
//   request is cancelled on the server. Next to a passkey held by a Chromium VIRTUAL authenticator for `localhost` (WebAuthn on
//   localhost): both buttons, the passkey path unchanged.
// * THE PERSONAL ALARM CODE (`alarm_pin`): the only field when the account has no authenticator code; behind a link otherwise.
// * THE PHONE (a fake Android shell bridge with a phone key): the approval sheet lists three numbers; a pick asks the phone-key challenge
//   for that number, the bridge signs the server's text, the server approves; "not me" denies.
//   SW_BASE_URL=http://localhost:5297/ npx playwright test tests/unit-mfa-t095-rest-2530.spec.ts --project=desktop --project=mobile --workers=2

const REMOTE_TAB = '/?design=a#/system/diagnostics?tab=remote';
const PERMS = ['video.live', 'map.read', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign'];
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (code: string, msg: string, details: Record<string, unknown> = {}) => ({ code, user_message: msg, retryable: false, correlation_id: 'mock', details });
const b64u = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const CRED_ID = Buffer.from('arx-t095-rest-passkey');
const PIN = '583027';
const REQ = 'pa_mockrequest_0123456789abcdef';

interface Mock {
  methods: string[];
  action: string;
  patches: Record<string, unknown>[];
  refused: number;
  verifies: { method: string; code?: string; challenge_id?: string; action?: string }[];
  until: string | null;
  starts: string[];
  cancels: string[];
  /** the statuses the requester's polls answer, in order (the last one repeats) */
  states: string[];
  /** the phone side */
  pending: { request_id: string; action: string; choices: number[]; expires_in: number }[];
  picks: number[];
  approvals: { challenge_id: string; key_id: string; signature: string }[];
  denies: string[];
}

async function setup(page: Page, over: Partial<Mock> = {}): Promise<Mock> {
  const st: Mock = { methods: ['totp'], action: 'system.configure', patches: [], refused: 0, verifies: [], until: null, starts: [], cancels: [], states: ['pending', 'approved'],
    pending: [], picks: [], approvals: [], denies: [], ...over };
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
        return json(route, err('step_up_required', 'צריך לאשר שוב את הזהות.', { action: st.action, methods: st.methods, minutes: 5, verify_path: 'auth/step-up/verify' }), 403);
      }
      const body = req.postDataJSON() as Record<string, unknown>;
      st.patches.push(body);
      st.until = null; // an action-bound proof: one request
      Object.assign(settings, body);
      return json(route, { settings, can_edit: true });
    }
    if (p === 'settings') return json(route, { settings, can_edit: true });
    if (p === 'auth/step-up' && method === 'GET') return json(route, { enabled: true, minutes: 5, local_channel: false, applies: true, reason: null, methods: st.methods, valid_until: st.until });
    if (p === 'auth/step-up/challenge' && method === 'POST') {
      return json(route, { challenge_id: 'suc_t095', action: st.action, expires_in: 60, methods: st.methods,
        webauthn: { publicKey: { challenge: b64u(crypto.randomBytes(32)), rpId: 'localhost', timeout: 60000, userVerification: 'required', allowCredentials: [{ type: 'public-key', id: b64u(CRED_ID) }] } } });
    }
    if (p === 'auth/step-up/push' && method === 'POST') {
      st.starts.push((req.postDataJSON() as { action: string }).action);
      return json(route, { request_id: REQ, number: 42, action: st.action, expires_in: 90 });
    }
    if (p === `auth/step-up/push/${REQ}` && method === 'GET') {
      const status = st.states.length > 1 ? st.states.shift()! : st.states[0];
      return json(route, { request_id: REQ, status, reason: status === 'denied' ? 'user_denied' : null, expires_in: status === 'pending' ? 80 : 0 });
    }
    if (p === `auth/step-up/push/${REQ}` && method === 'DELETE') {
      st.cancels.push(REQ);
      return json(route, { request_id: REQ, status: 'cancelled', reason: 'cancelled', expires_in: 0 });
    }
    if (p === 'auth/step-up/verify' && method === 'POST') {
      const body = req.postDataJSON() as { method: string; code?: string; challenge_id?: string; action?: string };
      st.verifies.push(body);
      if (body.method === 'push') {
        st.until = 'one';
        return json(route, { method: 'push', minutes: 0, valid_until: '2026-11-25T10:01:00+00:00' });
      }
      if (body.method === 'alarm_pin') {
        if (body.code !== PIN) return json(route, err('wrong_code', 'קוד שגוי.'), 403);
        st.until = 'one';
        return json(route, { method: 'alarm_pin', minutes: 0, valid_until: '2026-11-25T10:01:00+00:00' });
      }
      if (body.method === 'passkey') {
        st.until = 'window';
        return json(route, { method: 'passkey', minutes: 5, valid_until: '2026-11-25T10:05:00+00:00' });
      }
      return json(route, err('second_factor_invalid', 'קוד שגוי'), 400);
    }
    if (p === 'auth/push-approvals' && method === 'GET') return json(route, { enabled: true, pending: st.pending });
    const m = /^auth\/push-approvals\/([^/]+)\/(challenge|approve|deny)$/.exec(p);
    if (m && method === 'POST') {
      const body = (req.postDataJSON() ?? {}) as { number?: number; challenge_id?: string; key_id?: string; signature?: string };
      if (m[2] === 'challenge') {
        st.picks.push(body.number ?? -1);
        return json(route, { challenge_id: 'dkn_' + 'p'.repeat(43), payload: `arx-device-key|v1|step_up|http://localhost|u-admin|dk_000000000000000000000001|auth.push_approval.n${body.number}|dkn_${'p'.repeat(43)}`, expires_in: 60 });
      }
      if (m[2] === 'approve') {
        st.approvals.push({ challenge_id: body.challenge_id ?? '', key_id: body.key_id ?? '', signature: body.signature ?? '' });
        st.pending = [];
        if (st.picks[st.picks.length - 1] !== 42) return json(route, err('push_approval_number_mismatch', 'המספר שבחרת לא תואם למספר שעל המסך שביקש. הבקשה נדחתה.'), 409);
        return json(route, { request_id: m[1], status: 'approved', reason: null, expires_in: 0 });
      }
      st.denies.push(m[1]);
      st.pending = [];
      return json(route, { request_id: m[1], status: 'denied', reason: 'user_denied', expires_in: 0 });
    }
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-11-25T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });
    if (p === 'auth/sessions') return json(route, { scope: 'all', can_manage: true, channel: 'local', sessions: [] });
    return json(route, err('not_found', 'לא נמצא (בדיקה)'), 404);
  });
  return st;
}

/** A virtual platform authenticator holding the administrator's passkey for `localhost` (WebAuthn on localhost). */
async function device(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  await cdp.send('WebAuthn.addCredential', {
    authenticatorId,
    credential: { credentialId: CRED_ID.toString('base64'), isResidentCredential: true, rpId: 'localhost',
      privateKey: (privateKey.export({ format: 'der', type: 'pkcs8' }) as Buffer).toString('base64'), signCount: 0, userHandle: Buffer.from('u-admin').toString('base64') },
  });
}

/** The Android shell's bridge with a phone key (mobile/android-shell BridgeScript.kt): records what it was asked to sign. */
async function androidShell(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const signed: { payload: string; text: string }[] = [];
    w.__signed = signed;
    w.ArxApp = {
      platform: 'android',
      switchServer() {},
      deviceKey: {
        status: async () => ({ available: true, exists: true, keyId: 'dk_000000000000000000000001' }),
        sign: async (payload: string, text: string) => {
          signed.push({ payload, text });
          return { signature: 'MEUCIQ' + 'A'.repeat(60) };
        },
      },
    };
  });
}

async function openRemote(page: Page, baseURL: string | undefined) {
  const base = (baseURL || 'http://localhost:4173/').replace('//127.0.0.1', '//localhost');
  await page.goto(new URL(REMOTE_TAB, base).toString());
  await page.waitForSelector('sw-app system-diagnostics');
}

const dialog = (page: Page) => page.locator('sw-step-up-dialog');
const save = (page: Page) => page.locator('system-diagnostics [data-save-remote]');

async function changeAndSave(page: Page) {
  await page.locator('system-diagnostics select[data-set-remote="remote.policy"]').selectOption('any_role');
  await expect(save(page)).not.toHaveAttribute('disabled', '');
  await save(page).click();
}

// ---------------------------------------------------------------- approve on the phone (the requesting screen)

test('approve on the phone: the number is shown, the approval is spent and the save is sent exactly once', async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const st = await setup(page, { methods: ['device_key', 'push'], states: ['pending', 'pending', 'approved'] });
  await openRemote(page, baseURL);
  await changeAndSave(page);
  const d = dialog(page);
  const btn = d.locator('[data-step-up-push]');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAttribute('variant', 'primary');
  await expect(d.locator('[data-step-up-code]')).toHaveCount(0);
  await btn.click();
  await expect(d.locator('[data-step-up-push-number]')).toHaveText('42');
  await expect(d).toHaveCount(0, { timeout: 15000 });
  await expect.poll(() => st.patches).toEqual([{ 'remote.policy': 'any_role' }]);
  expect(st.refused).toBe(1);
  expect(st.starts).toEqual(['system.configure']);
  expect(st.verifies).toEqual([{ method: 'push', challenge_id: REQ, action: 'system.configure' }]);
  expect(st.cancels).toEqual([]);
  expect(errors).toEqual([]);
});

test('approve on the phone: a denial shows the message and sends nothing; cancel cancels the open request', async ({ page, baseURL }) => {
  const st = await setup(page, { methods: ['totp', 'push'], states: ['denied'] });
  await openRemote(page, baseURL);
  await changeAndSave(page);
  const d = dialog(page);
  await expect(d.locator('[data-step-up-push]')).toHaveAttribute('variant', 'secondary');
  await expect(d.locator('[data-step-up-code]')).toBeVisible();
  await d.locator('[data-step-up-push]').click();
  await expect(d.locator('[data-step-up-error]')).toContainText('נדחתה', { timeout: 10000 });
  expect(st.patches).toEqual([]);
  expect(st.verifies).toEqual([]);
  // ask again, then cancel while it waits
  st.states = ['pending'];
  await d.locator('[data-step-up-push]').click();
  await expect(d.locator('[data-step-up-push-number]')).toBeVisible();
  await d.locator('[data-step-up-cancel]').click();
  await expect(d).toHaveCount(0);
  await expect.poll(() => st.cancels).toEqual([REQ]);
  expect(st.patches).toEqual([]);
});

test('WebAuthn on localhost: the passkey and the phone approval side by side; the passkey path is unchanged', async ({ page, baseURL }) => {
  const st = await setup(page, { methods: ['passkey', 'device_key', 'push'] });
  await device(page);
  await openRemote(page, baseURL);
  await changeAndSave(page);
  const d = dialog(page);
  await expect(d.locator('[data-step-up-passkey]')).toBeVisible();
  await expect(d.locator('[data-step-up-push]')).toBeVisible();
  await d.locator('[data-step-up-passkey]').click();
  await expect(d).toHaveCount(0);
  await expect.poll(() => st.patches).toEqual([{ 'remote.policy': 'any_role' }]);
  expect(st.verifies.map((v) => v.method)).toEqual(['passkey']);
  expect(st.starts).toEqual([]);
});

// ---------------------------------------------------------------- the personal alarm code

test('the alarm code is the only field when the account has no authenticator code; a wrong code keeps the dialog open', async ({ page, baseURL }) => {
  const st = await setup(page, { methods: ['alarm_pin'], action: 'alarm.disarm' });
  await openRemote(page, baseURL);
  await changeAndSave(page);
  const d = dialog(page);
  const field = d.locator('[data-step-up-pin-field]');
  await expect(field).toBeVisible();
  await expect(field).toHaveAttribute('type', 'password');
  await expect(d.locator('[data-step-up-recovery]')).toHaveCount(0);
  await field.fill('1111');
  await d.locator('[data-step-up-confirm]').click();
  await expect(d.locator('[data-step-up-error]')).toContainText('קוד שגוי');
  await d.locator('[data-step-up-pin-field]').fill(PIN);
  await d.locator('[data-step-up-confirm]').click();
  await expect(d).toHaveCount(0);
  await expect.poll(() => st.patches).toEqual([{ 'remote.policy': 'any_role' }]);
  expect(st.verifies).toEqual([{ method: 'alarm_pin', code: '1111', action: 'alarm.disarm' }, { method: 'alarm_pin', code: PIN, action: 'alarm.disarm' }]);
});

test('with the authenticator code too, the alarm code is behind a link and the recovery link hides while it is chosen', async ({ page, baseURL }) => {
  const st = await setup(page, { methods: ['totp', 'alarm_pin'], action: 'alarm.disarm' });
  await openRemote(page, baseURL);
  await changeAndSave(page);
  const d = dialog(page);
  await expect(d.locator('[data-step-up-pin-field]')).toHaveCount(0);
  await d.locator('[data-step-up-pin]').click();
  await expect(d.locator('[data-step-up-pin-field]')).toBeVisible();
  await expect(d.locator('[data-step-up-recovery]')).toHaveCount(0);
  await d.locator('[data-step-up-pin-field]').fill(PIN);
  await d.locator('[data-step-up-confirm]').click();
  await expect(d).toHaveCount(0);
  expect(st.verifies).toEqual([{ method: 'alarm_pin', code: PIN, action: 'alarm.disarm' }]);
});

// ---------------------------------------------------------------- the phone's approval sheet

test('the phone: three numbers, the pick is signed by the phone key and approved', async ({ page, baseURL }) => {
  const st = await setup(page, { pending: [{ request_id: REQ, action: 'alarm.disarm', choices: [17, 42, 88], expires_in: 80 }] });
  await androidShell(page);
  await openRemote(page, baseURL);
  const sheet = page.locator('sw-push-approval-sheet');
  await expect(sheet.locator('[data-push-approval-what]')).toContainText('נטרול האזעקה', { timeout: 15000 });
  await expect(sheet.locator('[data-push-approval-choice]')).toHaveCount(3);
  await sheet.locator('[data-push-approval-choice="42"]').click();
  await expect(sheet.locator('[data-push-approval-done]')).toContainText('אושר');
  expect(st.picks).toEqual([42]);
  expect(st.approvals).toHaveLength(1);
  expect(st.approvals[0].key_id).toBe('dk_000000000000000000000001');
  const signed = (await page.evaluate(() => (window as unknown as { __signed: { payload: string; text: string }[] }).__signed));
  expect(signed).toHaveLength(1);
  expect(signed[0].payload).toContain('auth.push_approval.n42');
  expect(signed[0].text).toContain('42');
  await sheet.locator('[data-push-approval-close]').click();
  await expect(sheet).toHaveCount(0);
});

test('the phone: a wrong number is refused by the server; "not me" denies', async ({ page, baseURL }) => {
  const st = await setup(page, { pending: [{ request_id: REQ, action: 'system.configure', choices: [17, 42, 88], expires_in: 80 }] });
  await androidShell(page);
  await openRemote(page, baseURL);
  const sheet = page.locator('sw-push-approval-sheet');
  await expect(sheet.locator('[data-push-approval-choice]')).toHaveCount(3, { timeout: 15000 });
  await sheet.locator('[data-push-approval-choice="17"]').click();
  await expect(sheet.locator('[data-push-approval-error]')).toContainText('לא תואם');
  await expect(sheet.locator('[data-push-approval-choice]')).toHaveCount(0);
  await sheet.locator('[data-push-approval-close]').click();
  await expect(sheet).toHaveCount(0);
  // the next request: "not me"
  st.pending = [{ request_id: REQ, action: 'system.configure', choices: [17, 42, 88], expires_in: 80 }];
  await expect(sheet.locator('[data-push-approval-deny]')).toBeVisible({ timeout: 15000 });
  await sheet.locator('[data-push-approval-deny]').click();
  await expect(sheet.locator('[data-push-approval-done]')).toContainText('נדחתה');
  expect(st.denies).toEqual([REQ]);
});

test('outside the app the watcher never asks the server', async ({ page, baseURL }) => {
  const asked: string[] = [];
  page.on('request', (r) => { if (r.url().includes('push-approvals')) asked.push(r.url()); });
  await setup(page, { pending: [{ request_id: REQ, action: 'alarm.disarm', choices: [17, 42, 88], expires_in: 80 }] });
  await openRemote(page, baseURL);
  await page.waitForTimeout(4500);
  expect(asked).toEqual([]);
  await expect(page.locator('sw-push-approval-sheet')).toHaveCount(0);
});

// ---------------------------------------------------------------- compare-page screenshots (SW_SHOTS_DIR only)

const SHOTS = process.env.SW_SHOTS_DIR || '';
async function shoot(page: Page, name: string, project: string) {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.evaluate((sc) => document.documentElement.setAttribute('data-theme', sc), scheme);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, `${project}-${scheme}-${name}.png`) });
  }
}

test('shots: the dialog waiting for the phone', async ({ page, baseURL }, info) => {
  test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
  fs.mkdirSync(SHOTS, { recursive: true });
  await setup(page, { methods: ['totp', 'push'], states: ['pending'] });
  await openRemote(page, baseURL);
  await changeAndSave(page);
  await dialog(page).locator('[data-step-up-push]').click();
  await expect(dialog(page).locator('[data-step-up-push-number]')).toBeVisible();
  await shoot(page, 'dialog-push', info.project.name);
});

test('shots: the dialog with both buttons and the alarm code', async ({ page, baseURL }, info) => {
  test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
  fs.mkdirSync(SHOTS, { recursive: true });
  await setup(page, { methods: ['totp', 'push', 'alarm_pin'], action: 'alarm.disarm' });
  await openRemote(page, baseURL);
  await changeAndSave(page);
  await expect(dialog(page).locator('[data-step-up-push]')).toBeVisible();
  await shoot(page, 'dialog-methods', info.project.name);
  await dialog(page).locator('[data-step-up-pin]').click();
  await expect(dialog(page).locator('[data-step-up-pin-field]')).toBeVisible();
  await shoot(page, 'dialog-pin', info.project.name);
});

test('shots: the phone approval sheet', async ({ page, baseURL }, info) => {
  test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
  fs.mkdirSync(SHOTS, { recursive: true });
  await setup(page, { pending: [{ request_id: REQ, action: 'alarm.disarm', choices: [17, 42, 88], expires_in: 80 }] });
  await androidShell(page);
  await openRemote(page, baseURL);
  await expect(page.locator('sw-push-approval-sheet [data-push-approval-choice]')).toHaveCount(3, { timeout: 15000 });
  await shoot(page, 'phone-sheet', info.project.name);
});
