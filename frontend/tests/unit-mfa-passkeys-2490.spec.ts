import { test, expect, type Page, type Route, type CDPSession } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// MFA-PASSKEYS-2490 (second-factor train, slice 4): passkeys for every user in החשבון שלי › אימות דו־שלבי › מפתחות גישה, against a
// MOCKED wire contract of routers/local_passkeys.py (auth/passkeys*, auth/step-up/challenge) and routers/second_factor.py
// (auth/step-up/verify) - an invented Home Assistant user, no secrets. A Chromium VIRTUAL authenticator (CDP WebAuthn) plays the
// device: the page really calls navigator.credentials.create / get. Covered: a user who is not an Arx-only identity sees the section
// and adds a passkey, renames it, adding a second one asks for a step-up in place and the passkey answers it (the change is sent again
// exactly once), the authenticator code answers it too (a wrong code says so), a refusal after the proof is shown and never retried,
// removing the last factor warns and needs the proof, and cancel sends nothing.
// The page must run at http://localhost:<port>/ (WebAuthn needs a secure context and a domain RP id):
//   SW_BASE_URL=http://localhost:5295/ npx playwright test tests/unit-mfa-passkeys-2490.spec.ts --project=desktop --project=mobile --workers=2
// SW_SHOTS=<dir>: also writes the compare-page screenshots (light + dark). SW_PK_BEFORE=1: the server of before (403 for this user).

const phone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 860;
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (code: string, msg: string, details: Record<string, unknown> = {}) => ({ code, user_message: msg, retryable: false, correlation_id: 'mock', details });
const b64u = (s: string) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const GOOD = '246810';
const BEFORE = process.env.SW_PK_BEFORE === '1';

interface Cred {
  id: string;
  rawId: string;
  label: string | null;
}

interface Mock {
  origin: string;
  creds: Cred[];
  totp: boolean;
  proof: boolean;
  /** the next step-up-protected call is refused even after a proof (a server that keeps refusing) */
  alwaysRefuse: boolean;
  challenge: string;
  calls: { method: string; path: string; body: unknown }[];
}

const pk = (c: Cred) => ({ id: c.id, label: c.label, created_at: '2026-11-24T08:00:00+00:00', last_used_at: null, synced: true, backed_up: true, transports: ['internal'], usable: true, user_verifying: true });

function summary(st: Mock) {
  return {
    available: true, rp_id: 'localhost', origin: st.origin, first_allowed: false, first_on: false, only_on: false, only_effective: false,
    credentials: st.creds.map(pk),
  };
}

function hasFactor(st: Mock) {
  return st.totp || st.creds.length > 0;
}

function needProof(st: Mock, action: string) {
  return err('step_up_required', 'כדי לשנות את מפתחות הגישה צריך לאשר שוב את הזהות: במפתח גישה או בקוד מאפליקציית האימות.', {
    action, methods: [...(st.totp ? ['totp'] : []), ...(st.creds.length ? ['passkey'] : [])], minutes: 5, verify_path: 'auth/step-up/verify', challenge_path: 'auth/step-up/challenge',
  });
}

async function setup(page: Page, over: Partial<Mock> = {}): Promise<Mock> {
  const st: Mock = { origin: '', creds: [], totp: false, proof: false, alwaysRefuse: false, challenge: '', calls: [], ...over };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    st.origin = url.origin;
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const perms = ['video.live', 'devices.read'];
    if (p === 'me') return json(route, { user: { id: 'u-dana', username: 'dana', display_name: 'דנה', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'ui.scheme': 'auto' }, can_edit: false });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'auth/sessions') return json(route, { scope: 'own', can_manage: false, channel: 'local', sessions: [] });
    if (p === 'auth/second-factor' && method === 'GET') return json(route, { enabled: st.totp, enabled_at: st.totp ? '2026-11-01T09:00:00Z' : null, last_used_at: null, policy: 'optional' });
    const body = method === 'GET' || method === 'DELETE' ? null : (req.postDataJSON() as Record<string, unknown> | null);
    if (p.startsWith('auth/passkeys') || p.startsWith('auth/step-up')) st.calls.push({ method, path: p, body });
    if (BEFORE && p.startsWith('auth/passkeys')) return json(route, err('not_local_identity', 'הפעולה זמינה רק למשתמשי Arx.'), 403);
    if (p === 'auth/passkeys' && method === 'GET') {
      return json(route, { ...summary(st), recent_auth: st.proof, recent_auth_left_s: st.proof ? 240 : 0, totp: st.totp, user_kind: 'user' });
    }
    if (p === 'auth/passkeys/register/options') {
      if ((hasFactor(st) && !st.proof) || st.alwaysRefuse) return json(route, needProof(st, 'auth.passkey.register'), 403);
      st.challenge = b64u(`reg-${Date.now()}-${Math.random()}`);
      return json(route, {
        publicKey: {
          rp: { id: 'localhost', name: 'SmplWise Arx' }, user: { id: b64u('u-dana-handle'), name: 'dana', displayName: 'דנה' }, challenge: st.challenge,
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], timeout: 60000, attestation: 'none',
          authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'preferred' },
          excludeCredentials: st.creds.map((c) => ({ type: 'public-key', id: c.rawId })),
        },
        user_verification_required: false,
      });
    }
    if (p === 'auth/passkeys/register') {
      const cred = (body?.credential ?? {}) as { rawId?: string; response?: { attestationObject?: string; clientDataJSON?: string } };
      const cd = JSON.parse(fromB64u(cred.response?.clientDataJSON ?? '').toString('utf8') || '{}') as { type?: string; challenge?: string };
      if (!cred.response?.attestationObject || cd.type !== 'webauthn.create' || cd.challenge !== st.challenge) return json(route, err('passkey_invalid', 'מפתח הגישה לא נשמר. נסה שוב.'), 400);
      const c: Cred = { id: `pk_${st.creds.length + 1}`, rawId: cred.rawId ?? '', label: (body?.label as string) ?? null };
      const first = !hasFactor(st);
      st.creds.push(c);
      if (first) st.proof = true;
      return json(route, { passkey: pk(c), first_factor: first, other_sessions_ended: 0 }, 201);
    }
    const one = /^auth\/passkeys\/(pk_\d+)$/.exec(p);
    if (one && method === 'PATCH') {
      const c = st.creds.find((x) => x.id === one[1]);
      if (!c) return json(route, err('passkey_not_found', 'מפתח הגישה לא נמצא.'), 404);
      c.label = ((body?.label as string) || '').trim() || null;
      return json(route, summary(st));
    }
    if (one && method === 'DELETE') {
      if ((hasFactor(st) && !st.proof) || st.alwaysRefuse) return json(route, needProof(st, 'auth.passkey.remove'), 403);
      st.creds = st.creds.filter((x) => x.id !== one[1]);
      const cleared = !hasFactor(st);
      if (cleared) st.proof = false;
      return json(route, { removed: one[1], sessions_ended: 0, passkey_first: false, factor_cleared: cleared, ...summary(st) });
    }
    if (p === 'auth/step-up/challenge') {
      st.challenge = b64u(`su-${Date.now()}-${Math.random()}`);
      return json(route, {
        challenge_id: 'suc_mock', action: (body?.action as string) ?? '', expires_in: 60, methods: ['passkey'],
        webauthn: { publicKey: { challenge: st.challenge, rpId: 'localhost', timeout: 60000, userVerification: 'preferred', allowCredentials: st.creds.map((c) => ({ type: 'public-key', id: c.rawId })) } },
      });
    }
    if (p === 'auth/step-up/verify') {
      if (body?.method === 'totp') {
        if (body.code !== GOOD) return json(route, err('second_factor_invalid', 'קוד האימות אינו נכון. בדוק את הקוד באפליקציית האימות ונסה שוב.'), 400);
        st.proof = true;
        return json(route, { method: 'totp', minutes: 5, valid_until: '2026-11-24T10:05:00+00:00' });
      }
      const a = (body?.assertion ?? {}) as { response?: { clientDataJSON?: string; authenticatorData?: string; signature?: string } };
      const cd = JSON.parse(fromB64u(a.response?.clientDataJSON ?? '').toString('utf8') || '{}') as { type?: string; challenge?: string };
      if (body?.challenge_id !== 'suc_mock' || cd.type !== 'webauthn.get' || cd.challenge !== st.challenge || !a.response?.signature) {
        return json(route, err('step_up_failed', 'האישור במפתח הגישה נכשל. נסה שוב.'), 400);
      }
      st.proof = true;
      return json(route, { method: 'passkey', minutes: 5, valid_until: '2026-11-24T10:05:00+00:00' });
    }
    return json(route, err('not_found', 'לא נמצא (בדיקה)'), 404);
  });
  return st;
}

async function virtualAuthenticator(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return cdp;
}

async function openSection(page: Page) {
  await page.goto('/?design=a#/live/cameras');
  await page.waitForSelector('sw-app');
  await page.locator(phone(page) ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]').click();
  const menu = page.locator('sw-app sw-user-menu [data-profile-menu-panel]');
  await expect(menu).toBeVisible();
  await menu.locator('[data-menu-account]').click();
  await menu.locator('[data-my-second-factor] summary').click();
  return menu.locator('[data-my-second-factor] sw-passkeys');
}

async function shots(page: Page, name: string) {
  const dir = process.env.SW_SHOTS;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(dir, `${name}-${page.viewportSize()?.width ?? 0}-${scheme}.png`) });
  }
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
}

test.describe('passkeys for every user', () => {
  test.skip(BEFORE, 'the server of before answers 403 for this user (compare shots only)');

  test('add, rename, a second passkey after a passkey step-up (sent again once), remove the last with a warning', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const st = await setup(page);
    await virtualAuthenticator(page);
    const section = await openSection(page);
    await expect(section.locator('[data-pk-title]')).toBeVisible();
    await expect(section.locator('[data-pk-note]')).toContainText('לפני שינויים רגישים');
    await expect(section.locator('[data-pk-empty]')).toBeVisible();
    await expect(section.locator('[data-pk-first], [data-pk-only]')).toHaveCount(0); // the sign-in modes are an Arx-only feature

    // the first passkey: no proof needed (no factor yet)
    await section.locator('[data-pk-add-form] input').fill('המחשב שלי');
    await section.locator('[data-pk-add]').click();
    await expect(section.locator('[data-pk-item]')).toHaveCount(1);
    await expect(section.locator('[data-pk-message]')).toBeVisible();
    expect(st.creds[0].label).toBe('המחשב שלי');

    // rename
    await section.locator('[data-pk-rename]').click();
    await section.locator('[data-pk-rename-input]').fill('מחשב העבודה');
    await section.locator('[data-pk-rename-save]').click();
    await expect(section.locator('[data-pk-item]').first()).toContainText('מחשב העבודה');
    await shots(page, 'pk-list');

    // a second passkey: the server wants a fresh proof; the passkey gives it; the change goes again exactly once
    st.proof = false;
    await section.locator('[data-pk-add-form] input').fill('הטלפון');
    await section.locator('[data-pk-add]').click();
    const confirm = section.locator('[data-pk-step-up]');
    await expect(confirm).toBeVisible();
    await expect(section.locator('[data-pk-step-up-code]')).toHaveCount(0); // no authenticator code on this account
    await shots(page, 'pk-confirm');
    await section.locator('[data-pk-step-up-passkey]').click();
    await expect(section.locator('[data-pk-item]')).toHaveCount(2);
    await expect(confirm).toHaveCount(0);
    expect(st.calls.filter((c) => c.path === 'auth/passkeys/register/options').length).toBe(3); // first, refused, sent again once
    const verify = st.calls.filter((c) => c.path === 'auth/step-up/verify');
    expect(verify.length).toBe(1);
    expect((verify[0].body as { method: string; action: string }).method).toBe('passkey');
    expect((verify[0].body as { method: string; action: string }).action).toBe('auth.passkey.register');

    // removing: one, then the last (a warning), the proof expired in between
    await section.locator('[data-pk-remove]').first().click();
    await section.locator('[data-pk-remove-confirm]').click();
    await expect(section.locator('[data-pk-item]')).toHaveCount(1);
    st.proof = false;
    await section.locator('[data-pk-remove]').click();
    await expect(section.locator('[data-pk-last-factor]')).toBeVisible();
    await shots(page, 'pk-remove-last');
    await section.locator('[data-pk-remove-confirm]').click();
    await expect(section.locator('[data-pk-step-up]')).toBeVisible();
    await section.locator('[data-pk-step-up-passkey]').click();
    await expect(section.locator('[data-pk-empty]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the authenticator code answers the step-up; a wrong code says so; cancel sends nothing', async ({ page }) => {
    const st = await setup(page, { totp: true, creds: [{ id: 'pk_1', rawId: b64u('no-such-device'), label: 'מפתח ישן' }] });
    const section = await openSection(page);
    await expect(section.locator('[data-pk-item]')).toHaveCount(1);
    await section.locator('[data-pk-remove]').click();
    await expect(section.locator('[data-pk-last-factor]')).toHaveCount(0); // the code stays
    await section.locator('[data-pk-remove-confirm]').click();
    await expect(section.locator('[data-pk-step-up]')).toBeVisible();
    // cancel: nothing more is sent
    const before = st.calls.length;
    await section.locator('[data-pk-step-up-cancel]').click();
    await expect(section.locator('[data-pk-step-up]')).toHaveCount(0);
    expect(st.calls.length).toBe(before);
    // again, with a wrong code and then the right one
    await section.locator('[data-pk-remove]').click();
    await section.locator('[data-pk-remove-confirm]').click();
    await section.locator('[data-pk-step-up-code]').fill('111111');
    await section.locator('[data-pk-step-up-code-go]').click();
    await expect(section.locator('[data-pk-error]')).toContainText('קוד האימות אינו נכון');
    await expect(section.locator('[data-pk-step-up]')).toBeVisible();
    await section.locator('[data-pk-step-up-code]').fill(GOOD);
    await section.locator('[data-pk-step-up-code-go]').click();
    await expect(section.locator('[data-pk-empty]')).toBeVisible();
    expect(st.calls.filter((c) => c.method === 'DELETE').length).toBe(3); // refused, refused (after cancel), sent again once
  });

  test('a refusal after the proof is shown and never retried again', async ({ page }) => {
    const st = await setup(page, { totp: true, alwaysRefuse: true, creds: [{ id: 'pk_1', rawId: b64u('x'), label: 'מפתח' }] });
    const section = await openSection(page);
    await section.locator('[data-pk-remove]').click();
    await section.locator('[data-pk-remove-confirm]').click();
    await section.locator('[data-pk-step-up-code]').fill(GOOD);
    await section.locator('[data-pk-step-up-code-go]').click();
    await expect(section.locator('[data-pk-error]')).toContainText('לאשר שוב את הזהות');
    await page.waitForTimeout(300);
    expect(st.calls.filter((c) => c.method === 'DELETE').length).toBe(2); // the first refusal and ONE retry
  });
});

// The compare page: the section of a Home Assistant user before (the server refused: nothing) and after (passkeys). Only with SW_SHOTS.
test('compare shots: the second-factor section of a Home Assistant user', async ({ page }) => {
  test.skip(!process.env.SW_SHOTS, 'compare-page pictures only (SW_SHOTS=<dir>)');
  await setup(page, { creds: [{ id: 'pk_1', rawId: b64u('a'), label: 'מחשב העבודה' }, { id: 'pk_2', rawId: b64u('b'), label: 'הטלפון של דנה' }] });
  const section = await openSection(page);
  if (!BEFORE) await expect(section.locator('[data-pk-item]')).toHaveCount(2);
  await page.waitForTimeout(400);
  await shots(page, 'cmp-section');
});
