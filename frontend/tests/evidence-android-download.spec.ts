import { test, expect, type Page } from '@playwright/test';

// Owner request 2026-10-06: the Arx sign-in page offers the Android app only to an Android device, and only when the public
// answer carries an https address. The page is mounted directly (the dev server runs the demo shell, not the remote channel)
// and the public route is mocked; the route itself is covered by backend/tests/test_app_download.py.

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SHA = 'ab'.repeat(32);
const CONFIGURED = { android: { url: 'https://downloads.example.com/arx.apk', version: '0.9.1', sha256: SHA } };

async function mountLogin(page: Page, answer: unknown, opts: { inApp?: boolean } = {}) {
  const hits: string[] = [];
  await page.route('**/api/v1/auth/app-download', async (route) => {
    hits.push(route.request().url());
    await route.fulfill({ json: answer as object });
  });
  if (opts.inApp) {
    await page.addInitScript(() => {
      (window as unknown as { ArxApp: unknown }).ArxApp = { platform: 'android', shell: 'webview', version: '1', switchServer() {} };
    });
  }
  await page.goto('./');
  await page.evaluate(async () => {
    await import('/src/arx/arx-login.ts');
    document.body.appendChild(document.createElement('arx-login'));
  });
  const login = page.locator('arx-login');
  await expect(login.locator('[data-arx-submit]')).toBeVisible();
  await page.waitForTimeout(400); // the offer arrives after the first paint
  return { login, hits };
}

test.describe('Android device', () => {
  test.use({ userAgent: ANDROID_UA });

  test('configured: one quiet link with the version and the hash', async ({ page }) => {
    const { login, hits } = await mountLogin(page, CONFIGURED);
    const link = login.locator('[data-arx-android-download]');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://downloads.example.com/arx.apk');
    await expect(link).toHaveText(/הורדת אפליקציית Android|Download the Android app/);
    await expect(login.locator('[data-arx-android-version]')).toContainText('0.9.1');
    await expect(login.locator('[data-arx-android-sha] code')).toHaveText(SHA);
    expect(hits).toHaveLength(1);
    await page.screenshot({ path: test.info().outputPath('login-android-offer.png') });
  });

  test('not configured: nothing is shown', async ({ page }) => {
    const { login } = await mountLogin(page, { android: null });
    await expect(login.locator('[data-arx-android-download-box]')).toHaveCount(0);
  });

  test('an address that is not https is refused by the page too', async ({ page }) => {
    const { login } = await mountLogin(page, { android: { url: 'http://downloads.example.com/arx.apk', version: '', sha256: '' } });
    await expect(login.locator('[data-arx-android-download-box]')).toHaveCount(0);
  });

  test('inside the Android app nothing is offered', async ({ page }) => {
    const { login, hits } = await mountLogin(page, CONFIGURED, { inApp: true });
    await expect(login.locator('[data-arx-android-download-box]')).toHaveCount(0);
    expect(hits).toHaveLength(0);
  });
});

for (const [name, ua] of [['iPhone', IPHONE_UA], ['iPad posing as a Mac', IPAD_AS_MAC_UA], ['a computer', DESKTOP_UA]] as const) {
  test.describe(name, () => {
    test.use({ userAgent: ua });
    test('never sees the offer, and nothing is even requested', async ({ page }) => {
      const { login, hits } = await mountLogin(page, CONFIGURED);
      await expect(login.locator('[data-arx-android-download-box]')).toHaveCount(0);
      expect(hits).toHaveLength(0);
    });
  });
}
