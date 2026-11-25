import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// FE-SAFETY-FIX-2520 (deep review 2520 frontend core, FC-02 - the browser half): the remote sign-out ends this browser's Web Push
// subscription - its server row first (while the session still stands), then the browser's own - before the refresh token is revoked
// and the session deleted; best effort and bounded, so a slow or failing push call never blocks the sign-out. arx/auth.ts is bundled
// as it is (esbuild; the dynamic import of pwa/push-signout.ts is bundled in) and run on a mocked same-origin page with a fake service-worker
// registration (no real push service, no real tokens).
//   npx playwright test -c playwright.unit.config.ts tests/unit-fe-safety-fix-2520-signout.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://arx.test'; // a secure page: Web Push and crypto.subtle (the endpoint hash) exist only there
const KEY = 'arx.auth.v1';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/fake-browser-0001';

test.use({ serviceWorkers: 'block' });

async function bundle(): Promise<string> {
  const out = await build({
    stdin: { contents: "import * as A from './auth';\n(window as unknown as { ArxAuth: typeof A }).ArxAuth = A;\n", resolveDir: path.join(HERE, '../src/arx'), loader: 'ts' },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
  });
  return out.outputFiles[0].text;
}

async function sha32(text: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

interface Setup {
  /** 'yes' = this browser holds a subscription; 'no' = none; 'hang' = the push list never answers */
  subscribed: 'yes' | 'no' | 'hang';
}

async function setup(page: Page, opts: Setup): Promise<string[]> {
  const order: string[] = [];
  const hash = await sha32(ENDPOINT);
  await page.route(`${ORIGIN}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    if (p === '/arx/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>t</title>' });
    if (p === '/auth/token') {
      order.push('revoke');
      return route.fulfill({ status: 200, body: '' });
    }
    if (p === '/arx/api/v1/auth/session' && req.method() === 'DELETE') {
      order.push('session');
      return route.fulfill({ status: 204, body: '' });
    }
    if (p === '/arx/api/v1/push/subscriptions' && req.method() === 'GET') {
      order.push('list');
      if (opts.subscribed === 'hang') return; // never answered: the sign-out must not wait for it
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ subscriptions: [
        { id: 'other', endpoint_hash: '0'.repeat(32) }, { id: 'mine', endpoint_hash: hash },
      ] }) });
    }
    if (p.startsWith('/arx/api/v1/push/subscriptions/') && req.method() === 'DELETE') {
      order.push(`delete:${p.split('/').pop()}`);
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  // a fake service-worker registration with (or without) a push subscription; `unsubscribe` is recorded on window
  await page.addInitScript(([endpoint, subscribed]) => {
    const w = window as unknown as { __unsub: number; PushManager?: unknown };
    w.__unsub = 0;
    if (!('PushManager' in window)) w.PushManager = function PushManager() {};
    const sub = subscribed === 'no' ? null : { endpoint, unsubscribe: async () => { w.__unsub += 1; return true; }, options: {}, toJSON: () => ({}) };
    const reg = { active: {}, pushManager: { getSubscription: async () => sub } };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: async () => reg, ready: Promise.resolve(reg) } });
  }, [ENDPOINT, opts.subscribed] as const);
  await page.goto(`${ORIGIN}/arx/`);
  await page.addScriptTag({ content: await bundle(), type: 'module' });
  await page.waitForFunction(() => 'ArxAuth' in window);
  await page.evaluate(([key, origin]) => {
    window.localStorage.setItem(key, JSON.stringify({ hassUrl: origin, clientId: `${origin}/arx/`, access_token: 'ACCESS', refresh_token: 'REFRESH', expires: Date.now() + 600_000, expires_in: 1800, user_id: 'u1' }));
  }, [KEY, ORIGIN]);
  return order;
}

const signOut = (page: Page) => page.evaluate(async () => {
  const A = (window as unknown as { ArxAuth: { logout(r?: string): Promise<void> } }).ArxAuth;
  const t0 = Date.now();
  await A.logout('logout');
  return { ms: Date.now() - t0, unsub: (window as unknown as { __unsub: number }).__unsub };
});

test('sign-out: this browser subscription row is deleted and the browser unsubscribed, before the token and the session end', async ({ page }) => {
  const order = await setup(page, { subscribed: 'yes' });
  const r = await signOut(page);
  expect(order).toEqual(['list', 'delete:mine', 'revoke', 'session']);
  expect(r.unsub).toBe(1);
});

test('sign-out without a subscription: no push call at all, the sign-out as before', async ({ page }) => {
  const order = await setup(page, { subscribed: 'no' });
  const r = await signOut(page);
  expect(order).toEqual(['revoke', 'session']);
  expect(r.unsub).toBe(0);
});

test('sign-out while the push list never answers: bounded, the browser still unsubscribes, the token and the session still end', async ({ page }) => {
  const order = await setup(page, { subscribed: 'hang' });
  const r = await signOut(page);
  expect(order).toEqual(['list', 'revoke', 'session']);
  expect(r.unsub).toBe(1);
  expect(r.ms).toBeLessThan(8000);
});
