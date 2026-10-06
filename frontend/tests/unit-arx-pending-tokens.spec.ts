import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Security review 2.2.0, I3: while the second factor is pending, Home Assistant tokens that have not passed the Arx factor are
// never written to browser storage (memory only); abandoning or failing the step leaves nothing behind. auth.ts is bundled
// as it is and run on a mocked same-origin page (HA's /auth/token and the Arx session exchange are mocked; no real tokens).
//   npx playwright test tests/unit-arx-pending-tokens.spec.ts --project=desktop

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'http://arx.test';
const KEY = 'arx.auth.v1';

test.use({ serviceWorkers: 'block' });

async function bundle(): Promise<string> {
  const out = await build({
    entryPoints: [path.join(HERE, '../src/arx/auth.ts')], bundle: true, write: false, format: 'iife', globalName: 'ArxAuth', platform: 'browser', target: 'es2022',
  });
  return out.outputFiles[0].text;
}

async function setup(page: import('@playwright/test').Page, sessionStatus: { status: number; code: string }) {
  const tokenCalls: string[] = [];
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/arx/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>t</title>' });
    if (url.pathname === '/auth/token') {
      const body = route.request().postData() ?? '';
      tokenCalls.push(body);
      if (body.includes('action=revoke')) return route.fulfill({ status: 200, body: '' });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ access_token: 'FRESH-ACCESS-PENDING', expires_in: 1800, token_type: 'Bearer' }) });
    }
    if (url.pathname === '/arx/api/v1/auth/session') {
      return route.fulfill({ status: sessionStatus.status, contentType: 'application/json', body: JSON.stringify({ code: sessionStatus.code, user_message: 'x' }) });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/arx/`);
  await page.addScriptTag({ content: await bundle() });
  // a browser that signed in earlier and passed the factor: a stored entry whose access token is close to its end
  await page.evaluate(([key, origin]) => {
    window.localStorage.setItem(key, JSON.stringify({ hassUrl: origin, clientId: `${origin}/arx/`, access_token: 'OLD-VERIFIED-ACCESS', refresh_token: 'REFRESH-VERIFIED', expires: Date.now() + 1000, expires_in: 1800, user_id: 'u1' }));
  }, [KEY, ORIGIN]);
  return tokenCalls;
}

const dump = (page: import('@playwright/test').Page) => page.evaluate(() => JSON.stringify([{ ...window.localStorage }, { ...window.sessionStorage }]));

test('a refresh that meets the second factor keeps the new tokens in memory only', async ({ page }) => {
  await setup(page, { status: 401, code: 'second_factor_required' });
  const ok = await page.evaluate(async () => {
    const A = (window as unknown as { ArxAuth: { refreshNow(): Promise<boolean>; hasPendingSecondFactor(): boolean } }).ArxAuth;
    const r = await A.refreshNow();
    return { r, pending: A.hasPendingSecondFactor() };
  });
  expect(ok).toEqual({ r: false, pending: true });
  const stored = await dump(page);
  expect(stored).not.toContain('FRESH-ACCESS-PENDING'); // the unverified access token is nowhere in storage
  expect(stored).toContain('REFRESH-VERIFIED'); // the entry this browser already had verified is untouched
});

test('abandoning the pending step clears storage and revokes the refresh token', async ({ page }) => {
  const calls = await setup(page, { status: 401, code: 'second_factor_required' });
  await page.evaluate(async () => {
    const A = (window as unknown as { ArxAuth: { refreshNow(): Promise<boolean>; abandonSecondFactor(): Promise<void> } }).ArxAuth;
    await A.refreshNow();
    await A.abandonSecondFactor();
  });
  const stored = await dump(page);
  expect(stored).not.toContain('FRESH-ACCESS-PENDING');
  expect(stored).not.toContain('REFRESH-VERIFIED');
  expect(calls.some((b) => b.includes('action=revoke'))).toBe(true);
});

test('a verified refresh still saves the new tokens (no regression of the normal session)', async ({ page }) => {
  await setup(page, { status: 200, code: '' });
  const r = await page.evaluate(async () => (window as unknown as { ArxAuth: { refreshNow(): Promise<boolean> } }).ArxAuth.refreshNow());
  expect(r).toBe(true);
  expect(await dump(page)).toContain('FRESH-ACCESS-PENDING');
});
