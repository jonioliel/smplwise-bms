import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// CLIENT-RESILIENCE-2540 (review FC-03): on the remote channel, "the sign-in service could not be reached" is not "signed out".
// arx/boot.ts, arx/auth.ts and api/client.ts are bundled as they are (esbuild) and run on a mocked same-origin page: the sign-in
// service's /auth/token and the Arx session exchange are mocked, the network failure is an aborted request (no real tokens, no backend).
// Covered: a refresh / resume that cannot reach the service keeps the stored sign-in and says `retry`; the start-up shows "no connection,
// trying again" instead of the sign-in form and mounts the shell once the service answers; an explicit refusal still shows the form; a
// 401 mid-session while the service is unreachable fails the request like an offline one (no reload); a new sign-in revokes the old
// refresh token instead of orphaning it.
//   npx playwright test -c playwright.unit.config.ts tests/unit-arx-resilience-2540.spec.ts
// SW_SHOTS_DIR=<dir> also writes the compare page's pictures of the start-up without a connection (desktop + phone, light + dark).

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'http://arx.test';
const KEY = 'arx.auth.v1';

test.use({ serviceWorkers: 'block' });

let bundled = '';
async function bundle(): Promise<string> {
  if (bundled) return bundled;
  const out = await build({
    stdin: {
      contents: [
        "import '../design/boot';",
        "import * as B from './boot';",
        "import * as A from './auth';",
        "import * as C from '../api/client';",
        'Object.assign(window as unknown as Record<string, unknown>, { ArxBoot: B, ArxAuth: A, ArxClient: C });',
      ].join('\n'),
      resolveDir: path.join(HERE, '../src/arx'), loader: 'ts',
    },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', tsconfig: path.join(HERE, '../tsconfig.json'),
    define: { 'import.meta.env.BASE_URL': '"/arx/"', 'import.meta.env.DEV': 'false', __ARX_BUILD__: '"test"' },
  });
  bundled = out.outputFiles[0].text;
  return bundled;
}

/** What the mocked services answer; changed by a test while the page runs. */
interface Net {
  token: 'abort' | 'ok' | 'invalid' | 502;
  session: 200 | 503 | 'abort';
  me: 200 | 401;
  calls: string[];
}

async function setup(page: Page, net: Net, stored: 'near-expiry' | 'fresh' | 'none' = 'near-expiry'): Promise<void> {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const body = req.postData() ?? '';
    if (p === '/arx/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="he" dir="rtl"><head><title>t</title></head><body></body></html>' });
    if (p === '/arx/api/v1/auth/remote-config') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ path: '/arx/', session: 'rolling_90d', idle_lock_minutes: 720 }) });
    if (p === '/auth/token') {
      const grant = new URLSearchParams(body);
      net.calls.push(grant.get('action') === 'revoke' ? `revoke:${grant.get('token')}` : `token:${grant.get('grant_type')}`);
      if (grant.get('action') === 'revoke') return route.fulfill({ status: 200, body: '' });
      if (grant.get('grant_type') === 'authorization_code') {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ access_token: 'ACCESS-NEW', refresh_token: 'REFRESH-NEW', expires_in: 1800, token_type: 'Bearer' }) });
      }
      if (net.token === 'abort') return route.abort('internetdisconnected');
      if (net.token === 502) return route.fulfill({ status: 502, contentType: 'text/html', body: '<html>bad gateway</html>' });
      if (net.token === 'invalid') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant' }) });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ access_token: 'ACCESS-FRESH', expires_in: 1800, token_type: 'Bearer' }) });
    }
    if (p === '/arx/api/v1/auth/session' && req.method() === 'POST') {
      net.calls.push('exchange');
      if (net.session === 'abort') return route.abort('internetdisconnected');
      if (net.session === 503) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'remote_unavailable', user_message: 'x', retryable: true, correlation_id: '', details: {} }) });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ user: { id: 'u1', username: 'dana', display_name: 'דנה' }, session_expires_in: 1800 }) });
    }
    if (p === '/arx/api/v1/me') {
      net.calls.push(`me:${net.me}`);
      if (net.me === 401) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'remote_login_required', user_message: 'x', retryable: false, correlation_id: '', details: {} }) });
      return route.fulfill({ contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"not_found"}' });
  });
  await page.goto(`${ORIGIN}/arx/`);
  if (stored !== 'none') {
    await page.evaluate(([key, origin, left]) => {
      window.localStorage.setItem(key, JSON.stringify({ hassUrl: origin, clientId: `${origin}/arx/`, access_token: 'ACCESS-OLD', refresh_token: 'REFRESH-OLD', expires: Date.now() + Number(left), expires_in: 1800, user_id: 'u1' }));
      (window as unknown as { __sameDocument: boolean }).__sameDocument = true; // gone after a reload
    }, [KEY, ORIGIN, stored === 'fresh' ? 20 * 60_000 : 60_000] as const);
  }
  await page.addScriptTag({ content: await bundle(), type: 'module' });
  await page.waitForFunction(() => 'ArxBoot' in window);
}

const stored = (page: Page) => page.evaluate((key) => window.localStorage.getItem(key) ?? '', KEY);
type W = { ArxBoot: { bootRemote(): Promise<void> }; ArxAuth: Record<string, (...a: unknown[]) => Promise<unknown>>; ArxClient: { get(p: string): Promise<unknown> } };

test('a refresh that cannot reach the sign-in service keeps the sign-in and says "retry"; a refusal ends it', async ({ page }) => {
  const net: Net = { token: 'abort', session: 200, me: 200, calls: [] };
  await setup(page, net);
  expect(await page.evaluate(() => (window as unknown as W).ArxAuth.refreshOutcome())).toBe('retry');
  expect(await stored(page)).toContain('REFRESH-OLD');
  net.token = 502; // the platform restarting: "try again"
  expect(await page.evaluate(() => (window as unknown as W).ArxAuth.refreshOutcome())).toBe('retry');
  expect(await stored(page)).toContain('REFRESH-OLD');
  net.token = 'invalid'; // an explicit refusal: the sign-in is over (as before)
  expect(await page.evaluate(() => (window as unknown as W).ArxAuth.refreshOutcome())).toBe('ended');
  expect(await stored(page)).toBe('');
});

test('resume with a fresh token while the server says "try again" keeps the sign-in ("retry", not the sign-in page)', async ({ page }) => {
  const net: Net = { token: 'ok', session: 503, me: 200, calls: [] };
  await setup(page, net, 'fresh');
  expect(await page.evaluate(() => (window as unknown as W).ArxAuth.resume())).toBe('retry');
  expect(await stored(page)).toContain('REFRESH-OLD');
  net.session = 'abort';
  expect(await page.evaluate(() => (window as unknown as W).ArxAuth.resume())).toBe('retry');
  net.session = 200;
  expect(await page.evaluate(() => (window as unknown as W).ArxAuth.resume())).toBe('ok');
});

test('the start-up without a connection shows "no connection, trying again" - never the sign-in form - and starts once the service answers', async ({ page }) => {
  const net: Net = { token: 'abort', session: 200, me: 200, calls: [] };
  await setup(page, net);
  void page.evaluate(() => (window as unknown as W).ArxBoot.bootRemote());
  const panel = page.locator('arx-reconnect [data-arx-reconnect]');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('heading', 'אין חיבור לשרת');
  await expect(page.locator('arx-login')).toHaveCount(0);
  await expect(page.locator('sw-app')).toHaveCount(0);
  expect(await stored(page)).toContain('REFRESH-OLD');
  net.token = 'ok'; // the network is back
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('sw-app')).toHaveCount(1);
  await expect(page.locator('arx-reconnect')).toHaveCount(0);
  await expect(page.locator('arx-login')).toHaveCount(0);
  expect(await stored(page)).toContain('ACCESS-FRESH');
});

test('"try now" tries again at once; a refusal on that try shows the sign-in form', async ({ page }) => {
  const net: Net = { token: 'abort', session: 200, me: 200, calls: [] };
  await setup(page, net);
  void page.evaluate(() => (window as unknown as W).ArxBoot.bootRemote());
  await expect(page.locator('arx-reconnect [data-arx-reconnect]')).toBeVisible();
  const before = net.calls.filter((c) => c === 'token:refresh_token').length;
  net.token = 'invalid';
  await page.locator('arx-reconnect sw-state-panel sw-button').click();
  await expect(page.locator('arx-login')).toBeVisible();
  await expect(page.locator('arx-reconnect')).toHaveCount(0);
  expect(net.calls.filter((c) => c === 'token:refresh_token').length).toBe(before + 1);
});

test('an explicit refusal at start-up still shows the sign-in form (no regression)', async ({ page }) => {
  const net: Net = { token: 'invalid', session: 200, me: 200, calls: [] };
  await setup(page, net);
  void page.evaluate(() => (window as unknown as W).ArxBoot.bootRemote());
  await expect(page.locator('arx-login')).toBeVisible();
  await expect(page.locator('arx-reconnect')).toHaveCount(0);
});

test('a 401 mid-session while the sign-in service is unreachable fails the request like an offline one - no reload, sign-in kept', async ({ page }) => {
  const net: Net = { token: 'ok', session: 200, me: 200, calls: [] };
  await setup(page, net, 'fresh');
  await page.evaluate(() => (window as unknown as W).ArxBoot.bootRemote());
  await expect(page.locator('sw-app')).toHaveCount(1);
  net.me = 401;
  net.token = 'abort';
  const out = await page.evaluate(async () => {
    try {
      await (window as unknown as W).ArxClient.get('me');
      return 'resolved';
    } catch (e) {
      return `${(e as Error).name}:${e instanceof TypeError}`;
    }
  });
  expect(out).toBe('ApiUnreachable:true');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument === true)).toBe(true); // not reloaded
  expect(await stored(page)).toContain('REFRESH-OLD');
});

test('a new sign-in revokes the refresh token stored before (never left valid with no device holding it)', async ({ page }) => {
  const net: Net = { token: 'abort', session: 200, me: 200, calls: [] };
  await setup(page, net);
  await page.evaluate(() => (window as unknown as W).ArxAuth.completeSignIn({ verifier: null, flowId: 'f1', handler: ['homeassistant', null] }, 'CODE-1'));
  await expect.poll(() => net.calls.includes('revoke:REFRESH-OLD')).toBe(true);
  expect(net.calls).not.toContain('revoke:REFRESH-NEW');
  const now = await stored(page);
  expect(now).toContain('REFRESH-NEW');
  expect(now).not.toContain('REFRESH-OLD');
});

// ---------------------------------------------------------------- compare-page pictures (SW_SHOTS_DIR only)

const SHOTS = process.env.SW_SHOTS_DIR || '';
for (const scheme of ['light', 'dark'] as const) {
  for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
    test(`shots: remote start-up without a connection, ${vp.name} ${scheme}`, async ({ page }) => {
      test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      const net: Net = { token: 'abort', session: 200, me: 200, calls: [] };
      await setup(page, net);
      if (scheme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      void page.evaluate(() => (window as unknown as W).ArxBoot.bootRemote());
      await page.waitForSelector('arx-reconnect, arx-login');
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(SHOTS, `remote-offline-${vp.name}-${scheme}.png`) });
    });
  }
}
