import { test, expect, request as pwRequest, type Page, type Route } from '@playwright/test';
import { setAccessUi, type AccessUi } from './wiskey-ui-mode';
import { stubPanel } from './wiskey-fake-ha';

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
    return page.evaluate(() => ({ path: location.pathname, search: location.search, marker: (window as unknown as { __marker?: number }).__marker ?? null, routed: (window as unknown as { __routed?: string[] }).__routed ?? null }));
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
    expect(st.search).toBe('?tab=sync'); // the panel's deep link (WisKey rc.19 honours it in normal mode), no embed=1
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
    expect(new URL(page.url()).search).toBe('?tab=sync');
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

// ---------------------------------------------------------------------------------------------------------------------
// Experimental phone embed (owner request 2026-09-29; הגדרות › בקרות כניסה "הטמעה גם באפליקציית Companion (ניסיוני)",
// `access.phone_embed`): in the app the frame is opened with `external_auth=1` and src/wiskey/companion-bridge.ts
// relays the app's sign-in bridge from Home Assistant's top document into it. The stand-in top document below carries a
// fake Android bridge whose answer is evaluated in the TOP document only (as the app's evaluateJavascript does), plus the
// top frontend's own `externalAuthSetToken`; the panel address answers a fake HA whose entry module (loaded by import(),
// like HA's core entry) signs in the way HA's external_auth.ts does and starts only with a token. Stubs, not the real
// app: whether Android / iOS accept the relayed call is the owner's device check (CR-005).

const HA_TOP_RELAY = /\/ha-top-relay$/;
const AUTH_PAYLOAD = JSON.stringify({ callback: 'externalAuthSetToken' });

function haTopRelay(answers: boolean): string {
  return `<!doctype html><html><body style="margin:0"><script>
window.__asked = []; window.__topTokens = []; window.__revoked = 0; window.__bus = [];
window.externalApp = {
  getExternalAuth(p) {
    window.__asked.push(p);
    const n = window.__asked.length;
    const cb = JSON.parse(p).callback;
    ${answers ? `setTimeout(() => (0, eval)(cb + '(true, ' + JSON.stringify({ access_token: 'tok-' + n, expires_in: 1800 }) + ')'), 20);` : ''}
  },
  revokeExternalAuth(p) { window.__revoked++; },
  externalBus(p) { window.__bus.push(p); },
};
window.externalAuthSetToken = (ok, data) => window.__topTokens.push(data);
window.externalApp.getExternalAuth(${JSON.stringify(AUTH_PAYLOAD)});
</script><iframe id="ingress" src="/?design=a#/wiskey/overview" style="width:100%;height:780px;border:0"></iframe></body></html>`;
}

type TopRelayState = { asked: string[]; tokens: unknown[]; revoked: number; bus: string[] };
const topRelayState = (page: Page): Promise<TopRelayState> =>
  page.evaluate(() => {
    const w = window as unknown as { __asked: string[]; __topTokens: unknown[]; __revoked: number; __bus: string[] };
    return { asked: w.__asked, tokens: w.__topTokens, revoked: w.__revoked, bus: w.__bus };
  });
const wiskeyFrame = (page: Page) => page.frames().find((f) => PANEL_URL.test(f.url()));
type FrameAuth = { isExternal: boolean; proxied: boolean; bus: boolean; token: { access_token: string; expires_in: number } | null; error: string | null };
/** What the frame's fake HA saw; null while there is none - or while the frame is between documents ("רענן"), when
 * the evaluate fails with "Execution context was destroyed" (a poll simply tries again). */
const frameAuth = async (page: Page): Promise<FrameAuth | null> => {
  try {
    return (await wiskeyFrame(page)?.evaluate(() => (window as unknown as { __auth?: FrameAuth }).__auth ?? null)) ?? null;
  } catch {
    return null;
  }
};

/** The top window's relay hygiene: whether our registry is there, and how the two callbacks are held. */
const topCallbacks = (page: Page) =>
  page.evaluate(() => {
    const d = (n: string) => {
      const x = Object.getOwnPropertyDescriptor(window, n);
      return !x ? 'none' : x.get ? 'accessor' : typeof x.value;
    };
    return { registry: '__smplwiseCompanionRelay' in window, setToken: d('externalAuthSetToken'), revokeToken: d('externalAuthRevokeToken') };
  });

async function setPhoneEmbed(baseURL: string | undefined, value: 'true' | 'false'): Promise<string | null> {
  const ctx = await pwRequest.newContext({ baseURL });
  try {
    const before = ((await (await ctx.get('/api/v1/settings')).json()) as { settings: Record<string, string> }).settings['access.phone_embed'] ?? null;
    const r = await ctx.patch('/api/v1/settings', { data: { 'access.phone_embed': value } });
    if (!r.ok()) throw new Error(`PATCH /settings ${r.status()}: ${await r.text()}`);
    return before;
  } finally {
    await ctx.dispose();
  }
}

let phoneBefore: string | null = null;
let relayUiBefore: AccessUi | null = null;

async function phoneEmbedOn(baseURL: string | undefined) {
  relayUiBefore = await setAccessUi(baseURL, { 'access.ui.overview': 'wiskey', 'access.ui.events': 'wiskey', 'access.ui.people': 'wiskey' });
  phoneBefore = await setPhoneEmbed(baseURL, 'true');
}
async function phoneEmbedBack(baseURL: string | undefined) {
  await setPhoneEmbed(baseURL, phoneBefore === 'true' ? 'true' : 'false');
  if (relayUiBefore && Object.keys(relayUiBefore).length) await setAccessUi(baseURL, relayUiBefore);
}

test.describe('experimental: WisKey embedded inside the Companion app through the sign-in relay', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE === '1', 'set SW_LIVE=1 with a plain backend running (no WisKey fixture)');
  test.describe.configure({ mode: 'serial' });
  test.use({ userAgent: ANDROID_APP_UA });
  test.beforeAll(async ({}, testInfo) => phoneEmbedOn(testInfo.project.use.baseURL));
  test.afterAll(async ({}, testInfo) => phoneEmbedBack(testInfo.project.use.baseURL));

  test('the frame\'s Home Assistant receives externalAuthSetToken through the top window and WisKey embeds; the top frontend still gets every answer, unchanged', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the Companion app is a phone');
    await page.route(HA_TOP_RELAY, (route: Route) => route.fulfill({ status: 200, contentType: 'text/html', body: haTopRelay(true) }));
    const { hits } = await stubPanel(page, { kiosk: true, panels: true, api: 'v1', externalAuth: true });
    await page.goto('/ha-top-relay');
    const app = page.frameLocator('#ingress');
    const frame = app.locator(FRAME);
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 30000 });
    await expect(frame).toHaveAttribute('data-phase', 'ready');
    await expect(app.locator('wiskey-embed')).toHaveAttribute('data-direct', '');
    await expect(frame).toHaveAttribute('data-companion-shim', 'early'); // installed while the frame's document was parsing
    expect(new URL(hits[0]).searchParams.get('external_auth')).toBe('1');
    expect(new URL(hits[0]).searchParams.get('embed')).toBe('1');

    // the nested frontend took the external sign-in with our proxy (no app bus), asked once and got the app's answer
    const auth = await frameAuth(page);
    expect(auth).toMatchObject({ isExternal: true, proxied: true, bus: false, error: null });
    expect(auth!.token).toEqual({ access_token: 'tok-2', expires_in: 1800 });
    let top = await topRelayState(page);
    expect(top.asked).toEqual([AUTH_PAYLOAD, AUTH_PAYLOAD]); // the top's own request, then the frame's - payload unchanged
    expect(top.tokens).toEqual([{ access_token: 'tok-1', expires_in: 1800 }, { access_token: 'tok-2', expires_in: 1800 }]); // delivered to BOTH
    expect(top.bus).toEqual([]); // the frame never talks to the app's message bus
    await page.screenshot({ path: testInfo.outputPath('wiskey-companion-relay.png') });

    // the top frontend replacing its callback later (every token refresh does) is honoured; the frame still gets it
    await page.evaluate((p) => {
      const w = window as unknown as { __topTokens2: unknown[]; externalAuthSetToken: unknown; externalApp: { getExternalAuth(p: string): void } };
      w.__topTokens2 = [];
      w.externalAuthSetToken = (_ok: boolean, d: unknown) => w.__topTokens2.push(d);
      w.externalApp.getExternalAuth(p);
    }, AUTH_PAYLOAD);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __topTokens2: unknown[] }).__topTokens2)).toEqual([{ access_token: 'tok-3', expires_in: 1800 }]);

    // the frame can never sign the app out: its revoke is answered as failed and never reaches the bridge
    const revoke = await wiskeyFrame(page)!.evaluate(
      () =>
        new Promise<{ ok: boolean }>((res) => {
          const w = window as unknown as { externalAuthRevokeToken: unknown; externalApp: { revokeExternalAuth(p: string): void } };
          w.externalAuthRevokeToken = (ok: boolean) => res({ ok });
          w.externalApp.revokeExternalAuth(JSON.stringify({ callback: 'externalAuthRevokeToken' }));
        }),
    );
    expect(revoke.ok).toBe(false);
    expect((await topRelayState(page)).revoked).toBe(0);

    // the embed works as in a browser: a tab click is confirmed by WisKey
    await app.locator('sw-tabs a[href="#/wiskey/sync"]').click();
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'sync');

    // "רענן": the new document in the frame is caught again and signs in with a fresh answer
    await app.locator('sw-button[data-wiskey-embed-refresh]').click();
    await expect.poll(async () => (await frameAuth(page))?.token?.access_token ?? null, { timeout: 20000 }).toBe('tok-4');
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await expect(frame).toHaveAttribute('data-companion-shim', 'early');
    top = await topRelayState(page);
    expect(top.asked).toHaveLength(4);
    expect(top.revoked).toBe(0);
  });

  test('when the nested Home Assistant still cannot sign in, the tab falls back to the 0.1.123 screen with a note', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the Companion app is a phone');
    test.setTimeout(90_000);
    await page.route(HA_TOP_RELAY, (route: Route) => route.fulfill({ status: 200, contentType: 'text/html', body: haTopRelay(false) }));
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1', externalAuth: true });
    await page.goto('/ha-top-relay');
    const app = page.frameLocator('#ingress');
    await expect(app.locator(FRAME)).toHaveAttribute('data-companion-shim', 'early', { timeout: 30000 });
    const embed = app.locator('wiskey-embed');
    await expect(embed).toHaveAttribute('data-direct', 'login_required', { timeout: 45000 }); // the panel timeout
    await expect(app.locator(FRAME)).toHaveCount(0);
    await expect(embed.locator('[data-wiskey-embed-note="login_required"]')).toHaveText('ההטמעה באפליקציה (ניסיוני) לא הצליחה להתחבר, ולכן WisKey נפתח באפליקציה עצמה');
    await expect(embed.locator('wiskey-overview')).toHaveCount(1);
    await expect(embed.locator('sw-button[data-wiskey-open-ha]')).toHaveText('פתח ב-WisKey');
    await expect(embed.locator('a[data-wiskey-embed-full]')).toHaveCount(0); // no new-window link inside the app
    expect((await topRelayState(page)).revoked).toBe(0);
  });
});

test.describe('experimental relay: hygiene and refusal (security review 2026-09-29)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE === '1', 'set SW_LIVE=1 with a plain backend running (no WisKey fixture)');
  test.describe.configure({ mode: 'serial' });
  test.use({ userAgent: ANDROID_APP_UA });
  test.beforeAll(async ({}, testInfo) => phoneEmbedOn(testInfo.project.use.baseURL));
  test.afterAll(async ({}, testInfo) => phoneEmbedBack(testInfo.project.use.baseURL));

  test('a native bridge in the frame that cannot be shadowed: the frame is dropped at once - the 0.1.123 screen, the top window restored', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the Companion app is a phone');
    // what the app's addJavascriptInterface does: the bridge exists in the frame before any of its scripts, and here it
    // is not configurable, so the relay cannot put its proxy in its place
    await page.addInitScript(() => {
      if (location.pathname !== '/hikvision-intercom') return;
      Object.defineProperty(window, 'externalApp', {
        value: { getExternalAuth() { (window as unknown as { __native: number }).__native = 1; }, revokeExternalAuth() {}, externalBus() {} },
        configurable: false,
        writable: false,
        enumerable: true,
      });
    });
    await page.route(HA_TOP_RELAY, (route: Route) => route.fulfill({ status: 200, contentType: 'text/html', body: haTopRelay(true) }));
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1', externalAuth: true });
    await page.goto('/ha-top-relay');
    const app = page.frameLocator('#ingress');
    const embed = app.locator('wiskey-embed');
    await expect(embed).toHaveAttribute('data-direct', 'login_required', { timeout: 30000 });
    await expect(app.locator(FRAME)).toHaveCount(0);
    const note = embed.locator('[data-wiskey-embed-note="login_required"]');
    await expect(note).toHaveAttribute('data-relay-refused', 'native');
    await expect(note).toHaveText('ההטמעה באפליקציה (ניסיוני) לא נתמכת במכשיר הזה, ולכן WisKey נפתח באפליקציה עצמה');
    await expect(embed.locator('wiskey-overview')).toHaveCount(1);
    const top = await topRelayState(page);
    expect(top.asked).toEqual([AUTH_PAYLOAD]); // only the top frontend's own request reached the bridge
    expect(top.revoked).toBe(0);
    expect(top.bus).toEqual([]);
    expect(await topCallbacks(page)).toEqual({ registry: false, setToken: 'function', revokeToken: 'none' });
  });

  test('nothing is delivered to a frame on another origin; the top window gets plain callbacks back when the frame goes and when SMPLWISE\'s page goes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the Companion app is a phone');
    await page.route(HA_TOP_RELAY, (route: Route) => route.fulfill({ status: 200, contentType: 'text/html', body: haTopRelay(true) }));
    await page.route('**/other-origin', (route: Route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><script>window.__got = 0; window.externalAuthSetToken = () => { window.__got++; };</script>other</body></html>' }),
    );
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1', externalAuth: true });
    await page.goto('/ha-top-relay');
    const app = page.frameLocator('#ingress');
    const frame = app.locator(FRAME);
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 30000 });
    expect(await topCallbacks(page)).toEqual({ registry: true, setToken: 'accessor', revokeToken: 'accessor' });

    // the frame goes to another origin: an answer from the app is not delivered there
    const other = `${new URL(page.url()).protocol}//localhost:${new URL(page.url()).port}/other-origin`;
    await wiskeyFrame(page)!.evaluate((u) => location.assign(u), other);
    await expect.poll(() => page.frames().some((f) => f.url() === other)).toBe(true);
    const otherFrame = () => page.frames().find((f) => f.url() === other)!;
    await expect.poll(() => otherFrame().evaluate(() => typeof (window as unknown as { __got?: number }).__got)).toBe('number');
    await page.evaluate((p) => (window as unknown as { externalApp: { getExternalAuth(p: string): void } }).externalApp.getExternalAuth(p), AUTH_PAYLOAD);
    await expect.poll(async () => (await topRelayState(page)).tokens.length).toBe(3); // the top frontend got it
    expect(await otherFrame().evaluate(() => (window as unknown as { __got: number }).__got)).toBe(0);

    // leaving the WisKey area removes the frame: the relay goes, the top frontend's own callbacks are plain again
    await page.frame({ url: /#\/wiskey\// })!.evaluate(() => (location.hash = '#/live'));
    await expect.poll(() => topCallbacks(page)).toEqual({ registry: false, setToken: 'function', revokeToken: 'none' });
    await page.evaluate((p) => (window as unknown as { externalApp: { getExternalAuth(p: string): void } }).externalApp.getExternalAuth(p), AUTH_PAYLOAD);
    await expect.poll(async () => (await topRelayState(page)).tokens.length).toBe(4); // still reaches the top frontend

    // back in the area: the relay again; then SMPLWISE's own page goes away (pagehide): restored as well
    await page.frame({ url: /#\/live/ })!.evaluate(() => (location.hash = '#/wiskey/overview'));
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 30000 });
    expect(await topCallbacks(page)).toEqual({ registry: true, setToken: 'accessor', revokeToken: 'accessor' });
    await page.evaluate(() => ((document.getElementById('ingress') as HTMLIFrameElement).src = 'about:blank'));
    await expect.poll(() => topCallbacks(page)).toEqual({ registry: false, setToken: 'function', revokeToken: 'none' });
    expect((await topRelayState(page)).revoked).toBe(0);
  });
});

test.describe('experimental phone embed switched on, in a mobile browser (no app)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE === '1', 'set SW_LIVE=1 with a plain backend running (no WisKey fixture)');
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(async ({}, testInfo) => phoneEmbedOn(testInfo.project.use.baseURL));
  test.afterAll(async ({}, testInfo) => phoneEmbedBack(testInfo.project.use.baseURL));

  test('the ordinary embed: no relay, no external_auth', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'a phone browser');
    const { hits } = await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    await open(page, '/wiskey/overview');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await expect(frame).toHaveAttribute('data-companion-shim', '');
    expect(new URL(hits[0]).searchParams.get('external_auth')).toBeNull();
  });
});
