import { test, expect, type Page, type BrowserContext, type Worker } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-008 P3 - PWA + Web Push. Two groups:
//
// 1. Always (demo mode is enough; any preview of `npm run build`): the service worker and manifest under the app's base,
//    the "התקן את Arx" install banner (a synthetic beforeinstallprompt), the iPhone add-to-home-screen guide, and the
//    notification-click deep link driven inside the real service worker (desktop + phone projects).
//
// 2. Live (SW_LIVE=1 SW_PUSH=1) against a throwaway backend - the real backend in the NVR-less mode on its own data dir:
//
//      SW_PORT=8391 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni SW_MODE=ha_only \
//        SW_OPTIONS_FILE=<dir>/none.json <repo>/.venv/Scripts/python.exe -m smplwise      (from smplwise_vms/backend)
//      SW_LIVE=1 SW_PUSH=1 SW_API_PORT=8391 SW_BASE_URL=http://127.0.0.1:4197/ \
//        npx playwright test tests/evidence-pwa-push.spec.ts --project=desktop --project=mobile --workers=1
//
//    הגדרות › התראות: subscribe / unsubscribe this device with a mocked PushManager (a real P-256 key pair from
//    WebCrypto, an FCM-shaped endpoint that is never called: the test button is answered by a route mock), the
//    preferences and quiet hours saved per user.

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/cr008-p3');
const LIVE = process.env.SW_LIVE === '1' && process.env.SW_PUSH === '1';

async function shot(page: Page, name: string, project: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${project}.png`) });
}

async function worker(context: BrowserContext, page: Page): Promise<Worker> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const existing = context.serviceWorkers();
  return existing[0] ?? (await context.waitForEvent('serviceworker'));
}

async function controlled(page: Page) {
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15_000 });
}

test.describe('PWA shell (CR-008 P3)', () => {
  test('service worker and manifest live under the app base', async ({ page, context, baseURL }) => {
    await page.goto('/');
    const reg = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      return { scope: r.scope, script: r.active?.scriptURL ?? '' };
    });
    expect(reg.scope).toBe(new URL('./', baseURL).href);
    expect(reg.script).toBe(new URL('arx-sw.js', baseURL).href);
    const manifest = await (await page.request.get('arx-manifest.webmanifest')).json();
    expect(manifest).toMatchObject({ name: 'SmplWise Arx', short_name: 'Arx', start_url: './', scope: './', display: 'standalone', dir: 'rtl', lang: 'he' });
    expect(manifest.icons.map((i: { purpose: string }) => i.purpose)).toContain('maskable');
    for (const icon of manifest.icons) expect((await page.request.get(icon.src)).status(), icon.src).toBe(200);
    expect(await page.locator('link[rel="manifest"]').getAttribute('href')).toBe('./arx-manifest.webmanifest');
    // the app shell only: an API response never lands in the worker's cache
    await controlled(page);
    await page.reload();
    const cached = await page.evaluate(async () => {
      const keys: string[] = [];
      for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) keys.push(req.url);
      return keys;
    });
    expect(cached.some((u) => /\/assets\/index-[\w-]+\.js$/.test(u)), cached.join('\n')).toBe(true);
    expect(cached.filter((u) => u.includes('/api/'))).toEqual([]);
    expect(context.serviceWorkers().length).toBe(1);
  });

  test('install banner "התקן את Arx" (beforeinstallprompt)', async ({ page }, info) => {
    await page.goto('/');
    await page.waitForFunction(() => !!customElements.get('arx-pwa-prompts'));
    const fire = () =>
      page.evaluate(() => {
        const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
        e.prompt = async () => {
          (window as unknown as { __prompted: number }).__prompted = ((window as unknown as { __prompted?: number }).__prompted ?? 0) + 1;
        };
        e.userChoice = Promise.resolve({ outcome: (window as unknown as { __choice?: string }).__choice ?? 'accepted' });
        window.dispatchEvent(e);
        return e.defaultPrevented;
      });
    expect(await fire(), 'the browser mini-infobar is suppressed; our banner decides').toBe(true);
    const banner = page.locator('arx-pwa-prompts [data-pwa-install]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('התקן את Arx');
    await shot(page, 'install-banner', info.project.name);
    await banner.locator('[data-pwa-install-go]').click();
    await expect(banner).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { __prompted: number }).__prompted)).toBe(1);

    // "לא עכשיו" keeps it away across reloads
    await page.reload();
    await fire();
    await expect(banner).toBeVisible();
    await banner.locator('[data-pwa-install-later]').click();
    await expect(banner).toBeHidden();
    await page.reload();
    await fire();
    await page.waitForTimeout(300);
    await expect(banner).toBeHidden();
  });

  test('iPhone: add-to-home-screen guide', async ({ browser, baseURL }, info) => {
    const ctx = await browser.newContext({
      baseURL,
      locale: 'he-IL',
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
    const page = await ctx.newPage();
    await page.goto('/');
    const hint = page.locator('arx-pwa-prompts [data-pwa-ios]');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('הוספה למסך הבית');
    await shot(page, 'ios-hint', info.project.name);
    await hint.locator('[data-pwa-ios-close]').click();
    await expect(hint).toBeHidden();
    await page.reload();
    await page.waitForTimeout(500);
    await expect(hint).toBeHidden();
    // the notifications tab says why push needs the installed app on iOS
    await page.goto('/#/system/notifications');
    await expect(page.locator('arx-notifications-settings [data-push-support="ios_install"]')).toBeVisible();
    await ctx.close();
  });

  test('notification click opens the deep link under the app base', async ({ page, context }) => {
    await page.goto('/#/live');
    await controlled(page);
    const sw = await worker(context, page);
    const did = await sw.evaluate((url) => (self as unknown as { arxOpenTarget: (d: unknown) => Promise<string> }).arxOpenTarget({ url }), '#/investigate/events/ev-deeplink');
    expect(did).toBe('focused');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/investigate/events/ev-deeplink');
    // a link that is not an in-app route lands on the app's start, never elsewhere
    await sw.evaluate(() => (self as unknown as { arxOpenTarget: (d: unknown) => Promise<string> }).arxOpenTarget({ url: 'https://evil.example/' }));
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/');
    expect(new URL(page.url()).origin).toBe(new URL(sw.url()).origin);

    // no Arx window open: the link is kept and the next start of the app goes there
    await page.goto('about:blank');
    await sw.evaluate((url) => (self as unknown as { arxOpenTarget: (d: unknown) => Promise<string> }).arxOpenTarget({ url }).catch(() => 'no-activation'), '#/investigate/events/ev-cold');
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 10_000 }).toBe('#/investigate/events/ev-cold');
  });
});

const MOCK_PUSH = () => {
  const state: { sub: unknown } = { sub: null };
  const w = window as unknown as { __perm?: string; __endpoint?: string | null };
  Object.defineProperty(Notification, 'permission', { get: () => w.__perm ?? 'default', configurable: true });
  Notification.requestPermission = async () => {
    w.__perm = 'granted';
    return 'granted';
  };
  const b64u = (u8: Uint8Array) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  PushManager.prototype.getSubscription = async function () {
    return state.sub as PushSubscription | null;
  };
  PushManager.prototype.subscribe = async function (opts?: PushSubscriptionOptionsInit) {
    const kp = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const endpoint = `https://fcm.googleapis.com/fcm/send/playwright-${Math.random().toString(36).slice(2)}`;
    const key = opts?.applicationServerKey as Uint8Array;
    const sub = {
      endpoint,
      expirationTime: null,
      options: { applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength), userVisibleOnly: true },
      getKey: (n: string) => (n === 'p256dh' ? raw.buffer : auth.buffer),
      toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: b64u(raw), auth: b64u(auth) } }),
      unsubscribe: async () => {
        state.sub = null;
        w.__endpoint = null;
        return true;
      },
    };
    state.sub = sub;
    w.__endpoint = endpoint;
    return sub as unknown as PushSubscription;
  };
};

test.describe('הגדרות › התראות (live, throwaway backend)', () => {
  test.skip(!LIVE, 'needs the throwaway backend (SW_LIVE=1 SW_PUSH=1, see the header)');

  test.beforeEach(async ({ request }) => {
    for (const s of (await (await request.get('/api/v1/push/subscriptions')).json()).subscriptions) await request.delete(`/api/v1/push/subscriptions/${s.id}`);
    await request.put('/api/v1/push/prefs', { data: {} });
  });

  test('subscribe, preferences, test, unsubscribe', async ({ page, request }, info) => {
    await page.addInitScript(MOCK_PUSH);
    await page.goto('/#/system/notifications');
    const screen = page.locator('arx-notifications-settings');
    await expect(screen.locator('[data-push-settings][data-loaded="1"]')).toBeVisible({ timeout: 20_000 });
    // the tab is offered to every user in the settings tab row
    await expect(page.locator('sw-app').getByRole('link', { name: 'התראות' }).first()).toBeAttached();
    await expect(screen.locator('[data-push-state="off"]')).toBeVisible();
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()));
    await shot(page, 'notifications-off', info.project.name);

    await screen.locator('[data-push-enable]').click();
    await expect(screen.locator('[data-push-state="on"]')).toBeVisible();
    const subs = (await (await request.get('/api/v1/push/subscriptions')).json()).subscriptions;
    expect(subs).toHaveLength(1);
    expect(subs[0].endpoint_host).toBe('fcm.googleapis.com');
    expect(JSON.stringify(subs)).not.toContain('playwright-'); // the endpoint itself is never served back
    await expect(screen.locator(`[data-push-row="${subs[0].id}"]`)).toContainText('המכשיר הזה');

    // preferences: a category off, quiet hours on (22:00-06:30), saved for this user
    await screen.locator('[data-push-cat="system"]').locator('button').click();
    await screen.locator('[data-push-quiet]').locator('button').click();
    await screen.locator('[data-push-to]').fill('06:30');
    await screen.locator('[data-push-to]').dispatchEvent('change');
    await screen.locator('[data-push-save]').click();
    await expect(screen.locator('[data-push-message]')).toContainText('נשמרו');
    const prefs = await (await request.get('/api/v1/push/prefs')).json();
    expect(prefs.categories.system).toBe(false);
    expect(prefs.quiet).toMatchObject({ enabled: true, from: '22:00', to: '06:30', allow_critical: true });

    // the test button (answered here; the endpoint is fake and must not reach Google)
    await page.route('**/api/v1/push/test', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sent: 1, results: [{ id: subs[0].id, endpoint_host: 'fcm.googleapis.com', status: 201, outcome: 'sent' }] }) }));
    await screen.locator('[data-push-test]').click();
    await expect(screen.locator('[data-push-message]')).toContainText('נשלחה התראת בדיקה');
    await shot(page, 'notifications-on', info.project.name);

    await screen.locator('[data-push-disable]').click();
    await expect(screen.locator('[data-push-state="off"]')).toBeVisible();
    expect((await (await request.get('/api/v1/push/subscriptions')).json()).subscriptions).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __endpoint?: string | null }).__endpoint ?? null)).toBeNull();
  });
});
