import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { localhostOrigin } from './helpers/localhost-origin';

// MFA-RESET-CHANNEL-UI-2520: a home-system user whom the remote sign-in answers "enrol first" registers a passkey as that enrolment,
// while the owner's switch `security.passkey_remote_factor` is on. The server says so in the `details.passkey_enrol` of its 403
// `second_factor_enrollment_required` ({origin, publicKey: creation options}); without it the refusal ends the sign-in as before.
// Rendering checks mount the element and set its state directly; the ceremony test runs the whole remote sign-in against mocked
// sign-in endpoints and a Chromium virtual authenticator, which needs a `localhost` page (an IP address is never a WebAuthn RP id):
//   SW_UNIT_PAGES=1 SW_BASE_URL=http://localhost:5173/ npx playwright test -c playwright.unit.config.ts tests/unit-mfa-reset-channel-ui-2520.spec.ts --workers=2
// SW_SHOTS_DIR=<dir> also writes the compare-page pictures (desktop + phone, light + dark).

type Login = HTMLElement & { step: string; enrolOrigin: string | null };
const json = (route: Route, status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const ENROL_HE = 'מנהל המערכת דורש אימות דו־שלבי לחשבון הזה. הפעל אותו ב״החשבון שלי״ בכניסה מקומית, ואז היכנס מרחוק.';

async function mount(page: Page, origin: 'here' | 'elsewhere') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/v1/**', (route) => json(route, 404, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }));
  await page.goto('./');
  await page.evaluate(async (origin) => {
    const src = '/src/arx/arx-login.ts';
    await import(/* @vite-ignore */ src);
    const el = document.createElement('arx-login') as unknown as Login;
    document.body.innerHTML = '';
    document.body.appendChild(el);
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    el.enrolOrigin = origin === 'here' ? window.location.origin : 'https://arx.example.com';
    el.step = 'henrol';
  }, origin);
  return page.locator('arx-login');
}

test('the enrolment step at the passkey\'s address: the button, the other way, back', async ({ page }) => {
  const login = await mount(page, 'here');
  await expect(login.locator('[data-arx-ha-enrol] [data-arx-enrol-passkey-create]')).toBeEnabled();
  await expect(login.locator('[data-arx-passkey-wrong-host]')).toHaveCount(0);
  await expect(login.locator('[data-arx-enrol-other]')).toContainText('בכניסה מהרשת המקומית');
  await expect(login.locator('h1')).toHaveText('אימות דו־שלבי');
  await expect(login.locator('p.sub')).toContainText('אפשר להוסיף עכשיו מפתח גישה');
  await login.locator('[data-arx-ha-enrol] button.link').click();
  await expect(login.locator('#username')).toBeVisible();
});

test('another address: the button is disabled and the page says where passkeys work', async ({ page }) => {
  const login = await mount(page, 'elsewhere');
  await expect(login.locator('[data-arx-enrol-passkey-create]')).toBeDisabled();
  await expect(login.locator('[data-arx-passkey-wrong-host]')).toContainText('https://arx.example.com');
});

/** The mocked Home Assistant sign-in endpoints and an Arx exchange driven by `session(answer)`. */
async function signInMocks(page: Page, session: (answer: string | null, origin: string) => { status: number; body: unknown }) {
  await page.route('**/api/v1/**', (route) => json(route, 404, { code: 'not_found', user_message: 'x', retryable: false, correlation_id: 'mock', details: {} }));
  const answers: (string | null)[] = [];
  const revoked: string[] = [];
  await page.route(/\/(auth|api\/v1\/auth)\//, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    if (p.endsWith('/auth/providers')) return json(route, 200, [{ type: 'homeassistant', id: null, name: 'x' }]);
    if (p.endsWith('/auth/login_flow')) return json(route, 200, { type: 'form', flow_id: 'f1', step_id: 'init', errors: {} });
    if (p.includes('/auth/login_flow/')) return json(route, 200, { type: 'create_entry', result: 'c1' });
    if (p.endsWith('/auth/token')) {
      if ((req.postData() ?? '').includes('action=revoke')) revoked.push('r1');
      return json(route, 200, { access_token: 'h.e.y', refresh_token: 'r1', expires_in: 1800, token_type: 'Bearer' });
    }
    if (p.endsWith('/api/v1/auth/session')) {
      const answer = req.headers()['x-arx-second-factor'] ?? null;
      answers.push(answer);
      const r = session(answer, new URL(req.url()).origin);
      return json(route, r.status, r.body);
    }
    return json(route, 404, { code: 'not_found', user_message: 'x', retryable: false, correlation_id: 'mock', details: {} });
  });
  await page.evaluate(async () => {
    const src = '/src/arx/arx-login.ts';
    await import(/* @vite-ignore */ src);
    document.body.innerHTML = '';
    document.body.appendChild(document.createElement('arx-login'));
  });
  const login = page.locator('arx-login');
  const infra = login.locator('[data-arx-mode="infra"]');
  if (await infra.count()) await infra.click();
  await login.locator('#username').fill('dana');
  await login.locator('#password').fill('pw');
  await login.locator('[data-arx-submit]').click();
  return { login, answers, revoked };
}

const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

test('no offer (the switch off): "enrol first" ends the sign-in as before', async ({ page }) => {
  await page.goto('./');
  const { login, answers, revoked } = await signInMocks(page, () => ({ status: 403, body: { code: 'second_factor_enrollment_required', user_message: ENROL_HE, retryable: false, correlation_id: 'mock', details: {} } }));
  await expect(login.locator('[data-arx-error]')).toContainText('בכניסה מקומית');
  await expect(login.locator('#username')).toBeVisible();
  await expect(login.locator('[data-arx-ha-enrol]')).toHaveCount(0);
  expect(answers).toEqual([null]);
  await expect.poll(() => revoked.length).toBeGreaterThan(0); // no valid home-system sign-in is left behind
});

// FIX-SECURITY2-2570 (SA2-05 b): this test and the next skipped themselves on every lane (they all serve 127.0.0.1) - now they open a
// localhost origin there and fail, never skip, when they cannot have one.
test('the ceremony: "enrol first" with an offer - a new passkey answers in the header and the sign-in completes', async ({ page, baseURL }) => {
  await page.goto(`${await localhostOrigin(page, baseURL)}/`);
  expect(new URL(page.url()).hostname, 'WebAuthn needs a localhost page').toBe('localhost');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  let offers = 0;
  const { login, answers } = await signInMocks(page, (answer, origin) => {
    if (answer?.startsWith('pkr1:')) return { status: 200, body: { user: { id: 'u-viewer', username: 'dana', display_name: 'dana' }, session_expires_in: 3600 } };
    offers += 1;
    return { status: 403, body: { code: 'second_factor_enrollment_required', user_message: ENROL_HE, retryable: false, correlation_id: 'mock',
      details: { passkey_enrol: { origin, user_verification_required: false, publicKey: {
        rp: { id: 'localhost', name: 'SmplWise Arx' }, user: { id: b64(Array.from({ length: 32 }, (_, i) => i)), name: 'dana', displayName: 'דנה' },
        challenge: b64(Array.from({ length: 32 }, (_, i) => (i * 7 + offers) % 256)), pubKeyCredParams: [{ type: 'public-key', alg: -7 }], timeout: 60000,
        attestation: 'none', authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'preferred' }, excludeCredentials: [] } } } } };
  });
  const create = login.locator('[data-arx-ha-enrol] [data-arx-enrol-passkey-create]');
  await expect(create).toBeEnabled();
  await expect(login.locator('[data-arx-error]')).toHaveCount(0);
  expect(answers).toEqual([null]);
  const signedIn = page.evaluate(() => new Promise<boolean>((resolve) => {
    document.querySelector('arx-login')!.addEventListener('arx-signed-in', () => resolve(true), { once: true });
    setTimeout(() => resolve(false), 20_000);
  }));
  await create.click();
  expect(await signedIn).toBe(true);
  const last = answers[answers.length - 1] ?? '';
  expect(last.startsWith('pkr1:')).toBe(true);
  expect(last.split('.').length).toBeGreaterThanOrEqual(3); // rawId.clientDataJSON.attestationObject[.transports]
});

test('a cancelled ceremony keeps the enrolment step and says so', async ({ page, baseURL }) => {
  await page.goto(`${await localhostOrigin(page, baseURL)}/`);
  expect(new URL(page.url()).hostname, 'WebAuthn needs a localhost page').toBe('localhost');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable'); // no authenticator at all: the ceremony fails on the device side
  const { login, answers } = await signInMocks(page, (_answer, origin) => ({ status: 403, body: { code: 'second_factor_enrollment_required', user_message: ENROL_HE, retryable: false, correlation_id: 'mock',
    details: { passkey_enrol: { origin, user_verification_required: false, publicKey: { rp: { id: 'localhost', name: 'SmplWise Arx' }, user: { id: 'AAAA', name: 'dana', displayName: 'dana' },
      challenge: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', pubKeyCredParams: [{ type: 'public-key', alg: -7 }], timeout: 3000, attestation: 'none',
      authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'preferred' }, excludeCredentials: [] } } } } }));
  await login.locator('[data-arx-enrol-passkey-create]').click();
  await expect(login.locator('[data-arx-error]')).toBeVisible({ timeout: 20_000 });
  await expect(login.locator('[data-arx-enrol-passkey-create]')).toBeVisible();
  expect(answers.filter((a) => a?.startsWith('pkr1:'))).toHaveLength(0);
});

const SHOTS = process.env.SW_SHOTS_DIR || '';
// the same test on the base build makes the "before" pictures: there the offer is ignored and the refusal ends the sign-in
for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  test(`shots: "enrol first" with a passkey offer, ${vp.name}`, async ({ page }) => {
    test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    const { login } = await signInMocks(page, (_answer, origin) => ({ status: 403, body: { code: 'second_factor_enrollment_required', user_message: ENROL_HE, retryable: false, correlation_id: 'mock',
      details: { passkey_enrol: { origin, user_verification_required: false, publicKey: { rp: { id: 'localhost', name: 'SmplWise Arx' }, user: { id: 'AAAA', name: 'dana', displayName: 'dana' },
        challenge: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', pubKeyCredParams: [{ type: 'public-key', alg: -7 }], timeout: 60000, attestation: 'none',
        authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'preferred' }, excludeCredentials: [] } } } } }));
    await expect(login.locator('[data-arx-ha-enrol], [data-arx-error]').first()).toBeVisible();
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(SHOTS, `ha-enrol-${vp.name}-${scheme}.png`) });
    }
  });
}
