import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// MFA-SCREENS-2510 (slice 11 of the second-factor train): the sign-in page's second step - ONE chooser of the ways to answer it,
// replacing slice 7's "use a recovery code" link and the separate passkey button: the remote sign-in of a home-system user offers the
// authenticator code and a recovery code; an Arx-only identity with the code and a passkey gets three keys (code / passkey / recovery
// code); a passkey-only identity gets no chooser. The Q14 hook (a recovery-code sign-in asks to set up the authenticator again) is OFF
// unless the page is told otherwise: off, a recovery-code sign-in goes straight on; on, it lands on the enrolment step.
// The element is mounted directly (the dev server runs the demo shell, not the remote channel), as in unit-mfa-recovery-codes-2490.spec.ts.
//   SW_UNIT_PAGES=1 SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test -c playwright.unit.config.ts tests/unit-mfa-signin-methods-2510.spec.ts --workers=2
// SW_SHOTS_DIR=<dir> also writes the compare-page pictures (desktop + phone, light + dark).

type Login = HTMLElement & { step: string; factorMethods: string[]; recoveryReenrol: boolean };

async function mount(page: Page, step: 'factor' | 'lfactor', methods: ('totp' | 'passkey')[], reenrol = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const calls: { path: string; body: unknown }[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    let body: unknown = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = null;
    }
    calls.push({ path: p, body });
    if (p === 'auth/local/sign-in/second-factor') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }) });
  });
  await page.goto('./');
  await page.evaluate(
    async ({ step, methods, reenrol }) => {
      const src = '/src/arx/arx-login.ts';
      await import(/* @vite-ignore */ src);
      const el = document.createElement('arx-login') as unknown as Login;
      el.recoveryReenrol = reenrol;
      document.body.innerHTML = '';
      document.body.appendChild(el);
      await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
      el.factorMethods = methods;
      el.step = step;
    },
    { step, methods, reenrol },
  );
  const login = page.locator('arx-login');
  return { login, calls };
}

test('the remote second step of a home-system user: code and recovery code, one chooser, no link', async ({ page }) => {
  const { login } = await mount(page, 'factor', ['totp']);
  const methods = login.locator('[data-arx-methods] [data-arx-method]');
  await expect(methods).toHaveCount(2);
  await expect(login.locator('[data-arx-method="totp"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(login.locator('[data-arx-recovery-toggle]')).toHaveCount(0); // the old link is gone
  await expect(login.locator('[data-arx-method="passkey"]')).toHaveCount(0);
  const code = login.locator('[data-arx-code]');
  await expect(code).toHaveAttribute('inputmode', 'numeric');
  await login.locator('[data-arx-method="recovery"]').click();
  await expect(login.locator('[data-arx-method="recovery"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(code).toHaveAttribute('inputmode', 'text');
  await expect(code).toHaveAttribute('placeholder', 'XXXX-XXXX');
  await expect(code).toBeFocused();
  await expect(login.locator('p.sub')).toHaveText('הזן אחד מקודי השחזור ששמרת. כל קוד עובד פעם אחת.');
  await login.locator('[data-arx-method="totp"]').click();
  await expect(code).toHaveAttribute('inputmode', 'numeric');
});

test('an Arx-only identity with the code and a passkey: three ways; the passkey shows its button, the code form comes back', async ({ page }) => {
  const { login } = await mount(page, 'lfactor', ['totp', 'passkey']);
  await expect(login.locator('[data-arx-methods] [data-arx-method]')).toHaveCount(3);
  await login.locator('[data-arx-method="passkey"]').click();
  await expect(login.locator('[data-arx-passkey-only] [data-arx-passkey-factor]')).toBeVisible();
  await expect(login.locator('[data-arx-passkey-factor]')).toBeFocused();
  await expect(login.locator('[data-arx-code]')).toHaveCount(0);
  await login.locator('[data-arx-method="recovery"]').click();
  await expect(login.locator('[data-arx-code]')).toHaveAttribute('placeholder', 'XXXX-XXXX');
  await expect(login.locator('[data-arx-passkey-factor]')).toHaveCount(0);
});

test('a passkey-only identity: no chooser, the passkey button alone', async ({ page }) => {
  const { login } = await mount(page, 'lfactor', ['passkey']);
  await expect(login.locator('[data-arx-methods]')).toHaveCount(0);
  await expect(login.locator('[data-arx-passkey-factor]')).toBeVisible();
});

test('Q14 hook OFF (default): a recovery-code sign-in goes on to the app; nothing asks to enrol again', async ({ page }) => {
  const { login, calls } = await mount(page, 'lfactor', ['totp']);
  const done = page.evaluate(() => new Promise<boolean>((resolve) => {
    document.querySelector('arx-login')!.addEventListener('arx-signed-in', () => resolve(true), { once: true });
    setTimeout(() => resolve(false), 8000);
  }));
  await login.locator('[data-arx-method="recovery"]').click();
  await login.locator('[data-arx-code]').fill('H4TW-2PRB');
  await login.locator('[data-arx-verify]').click();
  expect(await done).toBe(true);
  expect(calls.filter((c) => c.path === 'auth/local/sign-in/second-factor').map((c) => c.body)).toEqual([{ code: 'H4TW-2PRB' }]);
  await expect(login.locator('[data-arx-enrol-continue]')).toHaveCount(0);
});

test('Q14 hook ON (not used by any server yet): a recovery-code sign-in lands on the enrolment step; the app code does not', async ({ page }) => {
  const { login } = await mount(page, 'lfactor', ['totp'], true);
  await login.locator('[data-arx-method="recovery"]').click();
  await login.locator('[data-arx-code]').fill('H4TW-2PRB');
  await login.locator('[data-arx-verify]').click();
  await expect(login.locator('[data-arx-enrol-continue]')).toBeVisible();
});

const SHOTS = process.env.SW_SHOTS_DIR || '';
for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  test(`shots: the second step, ${vp.name}`, async ({ page }) => {
    test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const [name, step, methods] of [['signin-remote', 'factor', ['totp']], ['signin-local', 'lfactor', ['totp', 'passkey']]] as const) {
      const { login } = await mount(page, step, [...methods]);
      await expect(login.locator('#code')).toBeVisible();
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(SHOTS, `${name}-${vp.name}-${scheme}.png`) });
      }
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  });
}
