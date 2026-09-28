import { test, expect, type Page, type Route } from '@playwright/test';
import { setAccessUi, type AccessUi } from './wiskey-ui-mode';

// Evidence for the WisKey embed on the Home Assistant Companion app and on a sign-in inside the frame (owner's phone
// report on 0.1.122: "לא ניתן לטעון את WisKey מתוך Home Assistant"). In the app, Home Assistant's frontend signs in
// through the native bridge (frontend src/data/external.ts `isExternal`), whose token answer reaches the app's top
// document only, so a nested Home Assistant never connects (bridge visible in the frame) or redirects to /auth/authorize
// (no bridge, no stored tokens). The embed must therefore not nest in the app, and must read a login redirect or a
// Home Assistant that never connects as `login_required`, never as "not Home Assistant".
//
// Runs with SW_LIVE=1 against a plain developer backend (no Home Assistant). The Companion app is simulated by its user
// agent (Playwright override) or by a stand-in top page that carries the bridge name and routes on `location-changed`
// like Home Assistant's `home-assistant.ts`. It proves the wiring, NOT the real app: that is the owner's lab check in
// CR-005-ACCESS-CONTROL-INTEGRATION.md. Run with --workers=1: the screen choice is installation-wide.

const FRAME = 'wiskey-embed iframe[data-wiskey-embed-frame]';
const PANEL_URL = /\/hikvision-intercom(\?|$)/;
const AUTH_URL = /\/auth\/authorize/;
const HA_TOP = /\/ha-top$/;
const ANDROID_APP_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 Home Assistant/2026.9.1-full (Android 14; Pixel 7)';

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
}

/** Counts every request for the panel address: in the app there must be none. */
async function countPanelLoads(page: Page): Promise<{ n: number }> {
  const hits = { n: 0 };
  await page.route(PANEL_URL, (route: Route) => {
    hits.n++;
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body>panel</body></html>' });
  });
  return hits;
}

let saved: AccessUi | null = null;

test.describe('WisKey on the Home Assistant Companion app and on a sign-in inside the frame', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE === '1', 'set SW_LIVE=1 with a plain backend running (no WisKey fixture)');
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({}, testInfo) => {
    saved = await setAccessUi(testInfo.project.use.baseURL, { 'access.ui.overview': 'wiskey', 'access.ui.events': 'wiskey', 'access.ui.people': 'wiskey' });
  });
  test.afterAll(async ({}, testInfo) => {
    if (saved && Object.keys(saved).length) await setAccessUi(testInfo.project.use.baseURL, saved);
  });

  test.describe('the Companion app user agent', () => {
    test.use({ userAgent: ANDROID_APP_UA });

    test('a tab with a SMPLWISE screen shows it, the phone note and "פתח ב-WisKey" - and never frames Home Assistant', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile', 'the Companion app is a phone');
      const hits = await countPanelLoads(page);
      await open(page, '/wiskey/overview');
      const embed = page.locator('wiskey-embed');
      await expect(embed).toHaveAttribute('data-direct', 'companion', { timeout: 30000 });
      await expect(embed.locator('wiskey-overview')).toHaveCount(1);
      await expect(embed.locator('[data-wiskey-embed-note="companion"]')).toHaveText('בטלפון WisKey נפתח באפליקציה עצמה');
      await expect(embed.locator('sw-button[data-wiskey-open-ha]')).toHaveText('פתח ב-WisKey');
      await expect(page.locator(FRAME)).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath('wiskey-companion-overview.png') });

      // people (the panel's "users") and events: their SMPLWISE screens, still no frame
      await page.locator('sw-tabs a[href="#/wiskey/people"]').click();
      await expect(embed.locator('wiskey-people')).toHaveCount(1, { timeout: 30000 });
      await page.locator('sw-tabs a[href="#/wiskey/events"]').click();
      await expect(embed.locator('wiskey-events')).toHaveCount(1, { timeout: 30000 });
      await expect(page.locator(FRAME)).toHaveCount(0);
      expect(hits.n).toBe(0);
    });

    test('an embed-only tab shows the note and "פתח ב-WisKey" as its content, with no frame', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile', 'the Companion app is a phone');
      const hits = await countPanelLoads(page);
      await open(page, '/wiskey/sync');
      const embed = page.locator('wiskey-embed');
      await expect(embed).toHaveAttribute('data-direct', 'companion', { timeout: 30000 });
      const only = embed.locator('[data-wiskey-embed-only="sync"]');
      await expect(only).toBeVisible();
      await expect(only.locator('sw-state-panel')).toHaveAttribute('hint', /בטלפון WisKey נפתח באפליקציה עצמה/);
      await expect(only.locator('sw-button[data-wiskey-open-ha]')).toHaveText('פתח ב-WisKey');
      await expect(embed.locator('wiskey-overview, wiskey-events, wiskey-people')).toHaveCount(0);
      await expect(page.locator(FRAME)).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath('wiskey-companion-sync.png') });
      await page.locator('sw-tabs a[href="#/wiskey/health"]').click();
      await expect(embed.locator('[data-wiskey-embed-only="health"]')).toBeVisible({ timeout: 30000 });
      expect(hits.n).toBe(0);
    });
  });

  /** A stand-in for the app's top Home Assistant document: the bridge name only (no user agent), SMPLWISE in an
   * Ingress-like frame, and - when `router` - a `location-changed` listener that switches panels by removing that frame,
   * as Home Assistant's router does. */
  function haTop(router: boolean): string {
    return `<!doctype html><html><body style="margin:0"><script>
window.externalApp = { getExternalAuth() {}, revokeExternalAuth() {}, externalBus() {} };
window.__marker = 7;
window.__routed = [];
${router ? `window.addEventListener('location-changed', () => { window.__routed.push(location.pathname); document.getElementById('ingress')?.remove(); });` : ''}
</script><iframe id="ingress" src="/?design=a#/wiskey/sync" style="width:100%;height:800px;border:0"></iframe></body></html>`;
  }

  async function topState(page: Page) {
    return page.evaluate(() => ({ path: location.pathname, marker: (window as unknown as { __marker?: number }).__marker ?? null, routed: (window as unknown as { __routed?: string[] }).__routed ?? null }));
  }

  test('"פתח ב-WisKey" moves the top Home Assistant frontend to the panel the way its navigate() does (bridge on the top window)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the Companion app is a phone');
    await page.route(HA_TOP, (route: Route) => route.fulfill({ status: 200, contentType: 'text/html', body: haTop(true) }));
    const hits = await countPanelLoads(page);
    await page.goto('/ha-top');
    const app = page.frameLocator('#ingress');
    await expect(app.locator('wiskey-embed')).toHaveAttribute('data-direct', 'companion', { timeout: 30000 });
    await expect(app.locator(FRAME)).toHaveCount(0);
    await app.locator('[data-wiskey-embed-only="sync"] sw-button[data-wiskey-open-ha]').click();
    await expect.poll(async () => (await topState(page)).path).toBe('/hikvision-intercom');
    await page.waitForTimeout(1500); // longer than the fallback window
    const st = await topState(page);
    expect(st.routed).toEqual(['/hikvision-intercom']); // routed in place by the frontend's own router
    expect(st.marker).toBe(7); // the same document: no full page load
    expect(hits.n).toBe(0);
  });

  test('"פתח ב-WisKey" falls back to a full page load when the top frontend does not switch within a second', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the Companion app is a phone');
    await page.route(HA_TOP, (route: Route) => route.fulfill({ status: 200, contentType: 'text/html', body: haTop(false) }));
    const hits = await countPanelLoads(page);
    await page.goto('/ha-top');
    const app = page.frameLocator('#ingress');
    await expect(app.locator('wiskey-embed')).toHaveAttribute('data-direct', 'companion', { timeout: 30000 });
    await app.locator('[data-wiskey-embed-only="sync"] sw-button[data-wiskey-open-ha]').click();
    await expect.poll(async () => hits.n, { timeout: 10000 }).toBe(1);
    await expect.poll(async () => (await topState(page)).marker).toBeNull(); // a new top document
    expect(new URL(page.url()).pathname).toBe('/hikvision-intercom');
  });

  test('a login redirect inside the frame is login_required, not "not Home Assistant": the frame is dropped', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop browser path');
    let authLoads = 0;
    await page.route(PANEL_URL, (route: Route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><html><body><script>location.replace('/auth/authorize?client_id=x&redirect_uri=y');</script></body></html>` }),
    );
    await page.route(AUTH_URL, (route: Route) => {
      authLoads++;
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><ha-authorize>login</ha-authorize></body></html>' });
    });
    await open(page, '/wiskey/overview');
    const embed = page.locator('wiskey-embed');
    await expect(embed).toHaveAttribute('data-direct', 'login_required', { timeout: 30000 });
    expect(authLoads).toBe(1);
    await expect(page.locator(FRAME)).toHaveCount(0);
    await expect(embed.locator('[data-wiskey-embed-error]')).toHaveCount(0);
    await expect(embed.locator('[data-wiskey-embed-note="login_required"]')).toBeVisible();
    await expect(embed.locator('wiskey-overview')).toHaveCount(1);
    await expect(embed.locator('sw-button[data-wiskey-open-ha]')).toHaveText('פתח ב-WisKey');
    await expect(embed.locator('a[data-wiskey-embed-full]')).toHaveAttribute('href', '/hikvision-intercom?tab=overview');
    await page.screenshot({ path: testInfo.outputPath('wiskey-login-required.png') });

    // an embed-only tab after a redirect: the note, "פתח ב-WisKey" and a retry
    await open(page, '/wiskey/devices');
    await expect(embed).toHaveAttribute('data-direct', 'login_required', { timeout: 30000 });
    await expect(embed.locator('[data-wiskey-embed-only="devices"] sw-button[data-wiskey-open-ha]')).toBeVisible();
    await expect(embed.locator('[data-wiskey-embed-only="devices"] sw-button[data-wiskey-embed-retry]')).toBeVisible();
  });

  test('Home Assistant that never connects inside the frame (the app\'s bridge waiting for a token) is login_required too', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop browser path');
    test.setTimeout(90_000);
    // <home-assistant> is on the page, but `hass` never arrives: what a nested frontend does while its token request
    // goes unanswered
    await page.route(PANEL_URL, (route: Route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><home-assistant></home-assistant></body></html>' }));
    await open(page, '/wiskey/sync');
    const embed = page.locator('wiskey-embed');
    await expect(page.locator(FRAME)).toHaveAttribute('data-phase', 'loading', { timeout: 30000 });
    await expect(embed).toHaveAttribute('data-direct', 'login_required', { timeout: 45000 });
    await expect(embed.locator('[data-wiskey-embed-error="unreachable"]')).toHaveCount(0);
    await expect(page.locator(FRAME)).toHaveCount(0);
    await expect(embed.locator('[data-wiskey-embed-only="sync"] sw-button[data-wiskey-open-ha]')).toBeVisible();
  });
});
