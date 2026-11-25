import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// MFA-HA-PASSKEY-2520: the remote second step of a home-system user answered with a passkey, behind the owner's switch
// `security.passkey_remote_factor` (default off). The server tells the page what it offers in the `details` of its 401
// `second_factor_required` ({methods, passkey: {origin, publicKey}}); without that offer the step is the one of before (code + recovery
// code). Rendering checks mount the element and set its state directly (as unit-mfa-signin-methods-2510.spec.ts); the ceremony test runs
// the whole remote sign-in against mocked sign-in endpoints and a Chromium virtual authenticator, which needs a `localhost` page
// (an IP address is never a WebAuthn RP id - commit 319f81676):
//   SW_UNIT_PAGES=1 SW_BASE_URL=http://localhost:5173/ npx playwright test -c playwright.unit.config.ts tests/unit-mfa-ha-passkey-2520.spec.ts --workers=2
// SW_SHOTS_DIR=<dir> also writes the compare-page pictures (desktop + phone, light + dark).

type Login = HTMLElement & { step: string; haMethods: string[]; haPasskeyOrigin: string | null };

async function mount(page: Page, methods: string[], origin: 'here' | 'elsewhere' | null) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }) }),
  );
  await page.goto('./');
  await page.evaluate(
    async ({ methods, origin }) => {
      const src = '/src/arx/arx-login.ts';
      await import(/* @vite-ignore */ src);
      const el = document.createElement('arx-login') as unknown as Login;
      document.body.innerHTML = '';
      document.body.appendChild(el);
      await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
      el.haMethods = methods;
      el.haPasskeyOrigin = origin === 'here' ? window.location.origin : origin === 'elsewhere' ? 'https://arx.example.com' : null;
      el.step = 'factor';
    },
    { methods, origin },
  );
  return page.locator('arx-login');
}

test('no offer (the switch off): the step of before - code and recovery code, no passkey', async ({ page }) => {
  const login = await mount(page, ['totp'], null);
  await expect(login.locator('[data-arx-methods] [data-arx-method]')).toHaveCount(2);
  await expect(login.locator('[data-arx-method="passkey"]')).toHaveCount(0);
  await expect(login.locator('[data-arx-code]')).toBeVisible();
});

test('code and passkey offered at this address: three ways; the passkey shows its button, the code comes back', async ({ page }) => {
  const login = await mount(page, ['totp', 'passkey'], 'here');
  await expect(login.locator('[data-arx-methods] [data-arx-method]')).toHaveCount(3);
  await login.locator('[data-arx-method="passkey"]').click();
  await expect(login.locator('[data-arx-ha-passkey] [data-arx-passkey-factor]')).toBeEnabled();
  await expect(login.locator('[data-arx-passkey-factor]')).toBeFocused();
  await expect(login.locator('[data-arx-code]')).toHaveCount(0);
  await login.locator('[data-arx-method="totp"]').click();
  await expect(login.locator('[data-arx-code]')).toBeVisible();
});

test('passkey only: no chooser, the button alone', async ({ page }) => {
  const login = await mount(page, ['passkey'], 'here');
  await expect(login.locator('[data-arx-methods]')).toHaveCount(0);
  await expect(login.locator('[data-arx-passkey-factor]')).toBeEnabled();
  await expect(login.locator('[data-arx-passkey-wrong-host]')).toHaveCount(0);
});

test('another address: the passkey is not offered beside the code, and a passkey-only user is told where it works', async ({ page }) => {
  let login = await mount(page, ['totp', 'passkey'], 'elsewhere');
  await expect(login.locator('[data-arx-methods] [data-arx-method]')).toHaveCount(2);
  await expect(login.locator('[data-arx-method="passkey"]')).toHaveCount(0);
  login = await mount(page, ['passkey'], 'elsewhere');
  await expect(login.locator('[data-arx-passkey-factor]')).toBeDisabled();
  await expect(login.locator('[data-arx-passkey-wrong-host]')).toContainText('https://arx.example.com');
});

// ---------------------------------------------------------------- the whole remote sign-in with a passkey (mocked endpoints)

test('the ceremony: the sign-in asks, the passkey answers in the header, a cancelled ceremony keeps the step', async ({ page }) => {
  await page.goto('./');
  test.skip(new URL(page.url()).hostname !== 'localhost', 'WebAuthn needs a localhost page (run with SW_BASE_URL=http://localhost:<port>/)');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  // a passkey of this page's RP id (what My Account would have made)
  const credId = await page.evaluate(async () => {
    const rnd = (n: number) => crypto.getRandomValues(new Uint8Array(n));
    const c = (await navigator.credentials.create({ publicKey: { rp: { id: 'localhost', name: 'SmplWise Arx' }, user: { id: rnd(32), name: 'dana', displayName: 'dana' },
      challenge: rnd(32), pubKeyCredParams: [{ type: 'public-key', alg: -7 }], authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' } } })) as PublicKeyCredential;
    return btoa(String.fromCharCode(...new Uint8Array(c.rawId))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  });
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'not_found', user_message: 'x', retryable: false, correlation_id: 'mock', details: {} }) }),
  );
  const answers: (string | null)[] = [];
  let challenges = 0;
  await page.route(/\/(auth|api\/v1\/auth)\//, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const json = (status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p.endsWith('/auth/providers')) return json(200, [{ type: 'homeassistant', id: null, name: 'x' }]);
    if (p.endsWith('/auth/login_flow')) return json(200, { type: 'form', flow_id: 'f1', step_id: 'init', errors: {} });
    if (p.includes('/auth/login_flow/')) return json(200, { type: 'create_entry', result: 'c1' });
    if (p.endsWith('/auth/token')) return json(200, { access_token: 'h.e.y', refresh_token: 'r1', expires_in: 1800, token_type: 'Bearer' });
    if (p.endsWith('/api/v1/auth/session')) {
      const answer = req.headers()['x-arx-second-factor'] ?? null;
      answers.push(answer);
      if (answer?.startsWith('pk1:')) return json(200, { user: { id: 'u-viewer', username: 'dana', display_name: 'dana' }, session_expires_in: 3600 });
      challenges += 1;
      const challenge = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => (i * 7 + challenges) % 256))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return json(401, { code: 'second_factor_required', user_message: 'נדרש קוד אימות מאפליקציית האימות.', retryable: false, correlation_id: 'mock',
        details: { methods: ['passkey'], passkey: { origin: new URL(req.url()).origin, publicKey: { challenge, rpId: 'localhost', timeout: 3000, userVerification: 'preferred', allowCredentials: [{ type: 'public-key', id: credId }] } } } });
    }
    return json(404, { code: 'not_found', user_message: 'x', retryable: false, correlation_id: 'mock', details: {} });
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
  await expect(login.locator('[data-arx-ha-passkey] [data-arx-passkey-factor]')).toBeEnabled();
  await expect(login.locator('[data-arx-methods]')).toHaveCount(0);
  expect(answers).toEqual([null]);

  // a cancelled ceremony (no user presence answered) keeps the step and says so
  await cdp.send('WebAuthn.setAutomaticPresenceSimulation', { authenticatorId, enabled: false });
  await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
  await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
  await login.locator('[data-arx-passkey-factor]').click();
  await expect(login.locator('[data-arx-error]')).toBeVisible({ timeout: 20_000 });
  await expect(login.locator('[data-arx-passkey-factor]')).toBeVisible();
  expect(answers.filter((a) => a?.startsWith('pk1:'))).toHaveLength(0);

  // the right ceremony: a fresh offer is asked first (the first one was used), then the assertion goes in the header
  const again = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  void again;
  // the new virtual authenticator does not hold the passkey made above: let the page make one there and point the next offer at it
  const credId2 = await page.evaluate(async () => {
    const rnd = (n: number) => crypto.getRandomValues(new Uint8Array(n));
    const c = (await navigator.credentials.create({ publicKey: { rp: { id: 'localhost', name: 'SmplWise Arx' }, user: { id: rnd(32), name: 'dana', displayName: 'dana' },
      challenge: rnd(32), pubKeyCredParams: [{ type: 'public-key', alg: -7 }], authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' } } })) as PublicKeyCredential;
    return btoa(String.fromCharCode(...new Uint8Array(c.rawId))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  });
  await page.unroute(/\/(auth|api\/v1\/auth)\//);
  await page.route(/\/api\/v1\/auth\/session/, async (route) => {
    const req = route.request();
    const answer = req.headers()['x-arx-second-factor'] ?? null;
    answers.push(answer);
    const json = (status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (answer?.startsWith('pk1:')) return json(200, { user: { id: 'u-viewer', username: 'dana', display_name: 'dana' }, session_expires_in: 3600 });
    return json(401, { code: 'second_factor_required', user_message: 'x', retryable: false, correlation_id: 'mock',
      details: { methods: ['passkey'], passkey: { origin: new URL(req.url()).origin, publicKey: { challenge: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', rpId: 'localhost', timeout: 60000, userVerification: 'preferred', allowCredentials: [{ type: 'public-key', id: credId2 }] } } } });
  });
  const signedIn = page.evaluate(() => new Promise<boolean>((resolve) => {
    document.querySelector('arx-login')!.addEventListener('arx-signed-in', () => resolve(true), { once: true });
    setTimeout(() => resolve(false), 20_000);
  }));
  await login.locator('[data-arx-passkey-factor]').click();
  expect(await signedIn).toBe(true);
  const last = answers[answers.length - 1] ?? '';
  expect(answers[answers.length - 2]).toBeNull(); // the fresh offer
  expect(last.startsWith('pk1:' + credId2 + '.')).toBe(true);
  expect(last.split('.').length).toBeGreaterThanOrEqual(5); // rawId.clientDataJSON.authenticatorData.signature[.userHandle]
});

const SHOTS = process.env.SW_SHOTS_DIR || '';
for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  test(`shots: the remote second step with a passkey, ${vp.name}`, async ({ page }) => {
    test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const [name, methods] of [['ha-passkey-chooser', ['totp', 'passkey']], ['ha-passkey-only', ['passkey']]] as const) {
      const login = await mount(page, [...methods], 'here');
      await expect(login.locator(methods.length > 1 ? '#code' : '[data-arx-passkey-factor]')).toBeVisible();
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(SHOTS, `${name}-${vp.name}-${scheme}.png`) });
      }
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  });
}
