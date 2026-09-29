import { test, expect, type Page, type BrowserContext, type Worker } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
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
    expect(manifest).toMatchObject({
      id: './',
      name: 'SmplWise Arx',
      short_name: 'Arx',
      start_url: './',
      scope: './',
      display: 'standalone',
      orientation: 'any',
      dir: 'rtl',
      lang: 'he',
      theme_color: '#2f6bff',
      background_color: '#f5f7fb',
    });
    // maskable icons ship at both sizes, separate from the "any" purpose entries
    const bySize = (size: string, purpose: string) => manifest.icons.find((i: { sizes: string; purpose: string }) => i.sizes === size && i.purpose === purpose);
    expect(bySize('192x192', 'any')).toBeTruthy();
    expect(bySize('512x512', 'any')).toBeTruthy();
    expect(bySize('192x192', 'maskable')).toBeTruthy();
    expect(bySize('512x512', 'maskable')).toBeTruthy();
    for (const icon of manifest.icons) expect((await page.request.get(icon.src)).status(), icon.src).toBe(200);
    // shortcuts: live view and notifications, both inside the app's own scope
    expect(manifest.shortcuts?.map((s: { name: string }) => s.name)).toEqual(expect.arrayContaining(['צפייה חיה', 'התראות']));
    for (const s of manifest.shortcuts ?? []) expect(new URL(s.url, new URL('arx-manifest.webmanifest', baseURL)).href.startsWith(new URL('./', baseURL).href)).toBe(true);
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

  test('a new release: update notice, new worker, old cache deleted', async ({ page }) => {
    // The worker names its cache after the build (the add-on version), so a new release is a changed arx-sw.js. The
    // browser fetches the worker script itself (not routable), so this test serves dist/ from its own tiny server and
    // swaps the script for a "next release" copy half-way.
    const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
    const original = fs.readFileSync(path.join(dist, 'arx-sw.js'), 'utf8');
    const oldName = /arx-shell-[0-9A-Za-z.\-]+/.exec(original)?.[0] ?? '';
    expect(oldName, 'the build id is baked into the worker').toMatch(/^arx-shell-.+/);
    let sw = original;
    const types: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
      if (rel === 'arx-sw.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' });
        res.end(sw);
        return;
      }
      const file = path.join(dist, rel);
      if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{"code":"not_found"}');
        return;
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
    try {
      await page.goto(origin);
      await controlled(page);
      await page.reload();
      const shellCaches = () => page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('arx-shell-')));
      expect(await shellCaches()).toEqual([oldName]);
      sw = original.split(oldName).join(`${oldName}-next`);
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
      const toast = page.locator('arx-pwa-prompts [data-pwa-update]');
      await expect(toast).toBeVisible({ timeout: 15_000 });
      await Promise.all([page.waitForEvent('load'), toast.locator('sw-button').click()]);
      await expect.poll(shellCaches, { timeout: 15_000 }).toEqual([`${oldName}-next`]);
      await expect(toast).toBeHidden();
    } finally {
      await page.goto('about:blank');
      await new Promise<void>((ok) => server.close(() => ok()));
    }
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

  test('iPhone: the guide and its push hint hide once the app reports standalone (display-mode)', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({
      baseURL,
      locale: 'he-IL',
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
    // simulate an installed home-screen app: `(display-mode: standalone)` matches, as iOS sets it once launched from
    // the home-screen icon (real Safari also sets `navigator.standalone`, not reproducible from a normal browser context)
    await ctx.addInitScript(() => {
      const real = window.matchMedia?.bind(window);
      window.matchMedia = (query: string) => {
        if (query.includes('display-mode') && query.includes('standalone')) return { matches: true, media: query } as MediaQueryList;
        return real ? real(query) : ({ matches: false, media: query } as MediaQueryList);
      };
    });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForFunction(() => !!customElements.get('arx-pwa-prompts'));
    await page.waitForTimeout(300);
    await expect(page.locator('arx-pwa-prompts [data-pwa-ios]')).toBeHidden();
    await expect(page.locator('arx-pwa-prompts [data-pwa-install]')).toBeHidden();
    // the notifications tab no longer needs the "install first" hint: push works in the installed app (a denied
    // browser permission is a separate, unrelated state - this only checks the iOS "install it first" branch)
    await page.goto('/#/system/notifications');
    await expect(page.locator('arx-notifications-settings [data-push-support="ios_install"]')).toHaveCount(0);
    await ctx.close();
  });

  test('apple meta tags for the iOS home-screen install', async ({ page }) => {
    await page.goto('/');
    const head = page.locator('head');
    await expect(head.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(head.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Arx');
    // "default": the shell's top bar does not add safe-area-inset-top padding, so it relies on the opaque status bar
    // iOS reserves in that mode; switching to black-translucent needs the top bar to handle the inset first (CR-008 P4)
    await expect(head.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', 'default');
    await expect(head.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', './icons/arx-180.png');
    await expect(head.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
    await expect(head.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#2f6bff');
    const icon = await (await page.request.get('icons/arx-180.png')).body();
    expect(icon.length).toBeGreaterThan(0);
  });

  test('the shell reserves the safe area on the top bar, the side rail and the bottom nav', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'safe-area-inset only matters on the phone layout');
    await page.goto('/#/live');
    await page.waitForFunction(() => !!document.querySelector('sw-app')?.shadowRoot);
    const rules = await page.evaluate(() => {
      const root = document.querySelector('sw-app')!.shadowRoot!;
      const texts: string[] = [];
      for (const sheet of root.adoptedStyleSheets) for (const rule of Array.from(sheet.cssRules)) texts.push(rule.cssText);
      return texts;
    });
    const withInset = (selectorPart: string) => rules.filter((r) => r.includes(selectorPart) && r.includes('safe-area-inset'));
    expect(withInset('header.topbar').length, rules.join('\n')).toBeGreaterThan(0);
    expect(withInset('nav.rail').length, rules.join('\n')).toBeGreaterThan(0);
    expect(withInset('nav.bottom').length, rules.join('\n')).toBeGreaterThan(0);
  });

  test('update notice: רענון applies the waiting worker and reloads (stubbed registration)', async ({ page }) => {
    // Unlike "a new release" above (a real worker install, a real new cache), this stubs navigator.serviceWorker
    // outright: no worker ever installs, so watchUpdates() sees an already-waiting worker from the first tick and the
    // notice shows immediately. It proves the button's own contract - postMessage('arx-skip-waiting'), reload on
    // controllerchange - without a real service worker lifecycle.
    await page.addInitScript(() => {
      const messages: unknown[] = [];
      (window as unknown as { __swMessages: unknown[] }).__swMessages = messages;
      const target = new EventTarget();
      const worker = { postMessage: (m: unknown) => messages.push(m) };
      const registration = { waiting: worker, installing: null, active: worker, addEventListener: () => undefined, update: async () => undefined };
      const container = {
        controller: worker,
        ready: Promise.resolve(registration),
        register: async () => registration,
        getRegistration: async () => registration,
        addEventListener: (type: string, cb: EventListenerOrEventListenerObject) => target.addEventListener(type, cb),
        removeEventListener: (type: string, cb: EventListenerOrEventListenerObject) => target.removeEventListener(type, cb),
        dispatchEvent: (e: Event) => target.dispatchEvent(e),
      };
      Object.defineProperty(window.navigator, 'serviceWorker', { value: container, configurable: true });
    });
    await page.goto('/');
    const toast = page.locator('arx-pwa-prompts [data-pwa-update]');
    await expect(toast).toBeVisible({ timeout: 10_000 });
    await toast.locator('sw-button').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __swMessages: { type?: string }[] }).__swMessages.some((m) => m?.type === 'arx-skip-waiting'))).toBe(true);
    await Promise.all([
      page.waitForEvent('load'),
      page.evaluate(() => (navigator.serviceWorker as unknown as { dispatchEvent: (e: Event) => void }).dispatchEvent(new Event('controllerchange'))),
    ]);
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
