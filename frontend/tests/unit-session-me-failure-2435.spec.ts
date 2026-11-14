import { expect, test, type Page, type Route } from '@playwright/test';

// SESSION-DEMO-WS-2435 (code review 2026-11-13, frontend core F1): a failed GET /me used to turn a real installation into the static demo
// (fabricated data, the user "יוני" with the role "מנהל מערכת", every capability gate open). Now the demo comes only when no backend can be
// behind the page; a gateway answer (502 while the add-on restarts) keeps the app connecting, asks again with back-off and grants nothing.
// Runs against the preview build (`npm run build`); the browser parts mock /api/v1 with page.route.

const PERMS = ['devices.read', 'devices.control', 'entity.state.read', 'events.read', 'map.read', 'system.configure', 'video.live'];
const REAL_NAME = 'בודקת אמת';
const ME = {
  channel: 'local', remote: null, user: { id: 'u-real', username: 'u-real', display_name: REAL_NAME, source: 'ingress' }, active: true,
  bindings: [{ id: 'b1', role_id: 'r', role_name: 'תפקיד אמת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
  permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
};
const NOT_FOUND = { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} };

/** Records every session mode the shell went through, and whether a demo marker or the demo user was ever in the page. */
async function watchModes(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __modes: string[]; __demoSeen: boolean };
    w.__modes = [];
    w.__demoSeen = false;
    const deep = (root: Document | ShadowRoot, sel: string): boolean => {
      if (root.querySelector(sel)) return true;
      for (const el of root.querySelectorAll('*')) if (el.shadowRoot && deep(el.shadowRoot, sel)) return true;
      return false;
    };
    const tick = () => {
      const app = document.querySelector('sw-app') as unknown as { session?: { mode: string } } | null;
      const mode = app?.session?.mode;
      if (mode && w.__modes.at(-1) !== mode) w.__modes.push(mode);
      // the demo markers, and the demo user on the account button (its name and role are the button's label)
      if (deep(document, '[data-demo-dot], [data-demo-pill], button.me[title*="יוני"], button.me[title*="מנהל מערכת"]')) w.__demoSeen = true;
    };
    window.setInterval(tick, 25);
  });
}

const modes = (page: Page) => page.evaluate(() => (window as unknown as { __modes: string[] }).__modes);
const demoSeen = (page: Page) => page.evaluate(() => (window as unknown as { __demoSeen: boolean }).__demoSeen);
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test.describe('SESSION-DEMO-WS-2435 a failed /me', () => {
  test('502 (the add-on restarting) then 200: no demo ever, the connecting state, then the real user after the retry', async ({ page }) => {
    await watchModes(page);
    const meCalls: number[] = [];
    let fail = 1;
    await page.route('**/api/v1/**', (route) => {
      const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
      if (p === 'me') {
        meCalls.push(Date.now());
        // what HA Ingress answers while the add-on restarts: a bare text 502
        if (fail-- > 0) return route.fulfill({ status: 502, contentType: 'text/plain', body: '502: Bad Gateway' });
        return json(route, ME);
      }
      if (p === 'me/ws') return route.abort();
      return json(route, NOT_FOUND, 404);
    });
    await page.goto('./#/devices');
    await expect(page.locator('[data-session-retry]')).toBeVisible();
    await expect(page.locator('[data-session-retry]')).toContainText('אין חיבור לשרת');
    expect(await page.evaluate(() => (document.querySelector('sw-app') as unknown as { session: { retrying?: boolean; capabilities: Record<string, unknown> } }).session)).toMatchObject({
      retrying: true,
      capabilities: { nvr: false, ha: false, live_video: false, supported: false },
    });
    // the retry (1 s) brings the real user
    await expect(page.locator('[data-session-retry]')).toHaveCount(0, { timeout: 10_000 });
    await expect.poll(() => page.evaluate(() => (document.querySelector('sw-app') as unknown as { session: { mode: string; me: { user: { display_name: string } } | null } }).session.me?.user.display_name ?? null)).toBe(REAL_NAME);
    await expect(page.locator('button.me').first()).toHaveAttribute('title', new RegExp(REAL_NAME.split(' ')[0]));
    expect(meCalls.length).toBeGreaterThanOrEqual(2);
    expect(meCalls[1] - meCalls[0]).toBeGreaterThanOrEqual(800); // the first step of the back-off (1 s)
    expect(await modes(page)).not.toContain('demo');
    expect(await demoSeen(page)).toBe(false);
  });

  test('502 repeated: stays connecting with back-off (1 s, 2 s, 4 s ...), never the demo; the button asks at once', async ({ page }) => {
    await watchModes(page);
    const meCalls: number[] = [];
    await page.route('**/api/v1/**', (route) => {
      const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
      if (p === 'me') {
        meCalls.push(Date.now());
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'ha_unavailable', user_message: 'השרת מופעל מחדש', retryable: true, correlation_id: '', details: {} }) });
      }
      return route.abort();
    });
    await page.goto('./#/devices');
    await expect(page.locator('[data-session-retry]')).toContainText('השרת מופעל מחדש');
    await expect.poll(() => meCalls.length, { timeout: 12_000 }).toBeGreaterThanOrEqual(4);
    const gaps = meCalls.slice(1, 4).map((t, i) => t - meCalls[i]);
    expect(gaps[0]).toBeGreaterThanOrEqual(800);
    expect(gaps[1]).toBeGreaterThanOrEqual(1_700);
    expect(gaps[2]).toBeGreaterThanOrEqual(3_500);
    const before = meCalls.length;
    await page.locator('[data-session-retry]').getByRole('button', { name: 'נסה עכשיו' }).click();
    await expect.poll(() => meCalls.length).toBe(before + 1);
    expect(await modes(page)).not.toContain('demo');
    expect(await demoSeen(page)).toBe(false);
  });

  test('the demo path the pixel specs use: every /api/v1 aborted still gives the demo', async ({ page }) => {
    await page.route('**/api/v1/**', (route) => route.abort());
    await page.goto('./#/devices');
    await expect(page.locator('[data-demo-dot]')).toBeVisible();
    await expect(page.locator('sw-app[data-shell-ready]')).toHaveCount(1, { timeout: 20_000 });
    expect(await page.evaluate(() => (document.querySelector('sw-app') as unknown as { session: { mode: string; retrying?: boolean } }).session)).toMatchObject({ mode: 'demo' });
    await expect(page.locator('[data-session-retry]')).toHaveCount(0);
  });

  test('the preview without a backend (its proxy answers a bare 500) and a fixture catch-all 404 still give the demo', async ({ page }) => {
    await page.route('**/api/v1/**', (route) => route.fulfill({ status: 500, contentType: 'text/plain', body: '' }));
    await page.goto('./#/devices');
    await expect(page.locator('[data-demo-dot]')).toBeVisible();
    await page.unroute('**/api/v1/**');
    await page.route('**/api/v1/**', (route) => json(route, NOT_FOUND, 404));
    await page.reload();
    await expect(page.locator('[data-demo-dot]')).toBeVisible();
    await expect(page.locator('[data-session-retry]')).toHaveCount(0);
  });

  test('a 401 is still the sign-in gate, not the demo and not the retry', async ({ page }) => {
    await page.route('**/api/v1/**', (route) => json(route, { code: 'unauthenticated', user_message: 'נדרשת כניסה', retryable: false, correlation_id: '', details: {} }, 401));
    await page.goto('./#/devices');
    await expect(page.getByText('נדרשת כניסה למערכת')).toBeVisible();
    await expect(page.locator('[data-demo-dot]')).toHaveCount(0);
    await expect(page.locator('[data-session-retry]')).toHaveCount(0);
  });
});

test.describe('SESSION-DEMO-WS-2435 the demo rule (Node)', () => {
  test('never under Ingress or on the remote channel; at the root only when no backend can be there', async () => {
    const { demoOnMeFailure } = await import('../src/api/session');
    const { ApiError } = await import('../src/api/client');
    const err = (status: number, code = `http_${status}`) => new ApiError(status, { code, user_message: '', retryable: false, correlation_id: '', details: {} });
    const net = new TypeError('Failed to fetch');
    // a real installation: never the demo
    for (const path of ['/api/hassio_ingress/abc123/', '/arx/', '/remote_x/index.html']) {
      for (const e of [net, err(500), err(502), err(503), err(404, 'not_found'), err(500, 'internal')]) expect(demoOnMeFailure(e, path)).toBe(false);
    }
    // the origin root: the preview / design review
    expect(demoOnMeFailure(net, '/')).toBe(true);
    expect(demoOnMeFailure(err(500), '/')).toBe(true); // the preview proxy, nothing behind it
    expect(demoOnMeFailure(err(404, 'not_found'), '/')).toBe(true); // a fixture's catch-all
    expect(demoOnMeFailure(err(502), '/')).toBe(false);
    expect(demoOnMeFailure(err(503, 'ha_unavailable'), '/')).toBe(false);
    expect(demoOnMeFailure(err(504), '/')).toBe(false);
    expect(demoOnMeFailure(err(500, 'internal'), '/')).toBe(false); // the server's own error model: a backend is there
  });
});
