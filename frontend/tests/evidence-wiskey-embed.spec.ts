import { test, expect, type Frame, type Page, type Route } from '@playwright/test';
import { setAccessUi, type AccessUi } from './wiskey-ui-mode';

// Evidence for the embedded WisKey panel (CR-005 recorded decision 2026-09-28): the WisKey area shows WisKey's own
// Home Assistant panel (/hikvision-intercom) in a same-origin frame by default, הגדרות › בקרות כניסה switches each of
// the three screens SMPLWISE built back to its own screen, and WisKey's other screens are embedded-only tabs.
//
// Runs with SW_LIVE=1 against a plain developer backend (no Home Assistant). There is no real Home Assistant frontend
// here, so the frame address is answered by a route stub: a small page with the same element structure as Home
// Assistant's frontend (home-assistant > #shadow > home-assistant-main > #shadow > ha-drawer > ha-sidebar +
// hikvision-intercom-panel), in two flavours - a frontend that honours the `hass-kiosk-mode` event (2026.1+) and an
// older one that does not. It proves the wiring (address, deep link, chrome levers, error states), NOT the behaviour of
// the real nested Home Assistant: that is the owner's lab check listed in CR-005-ACCESS-CONTROL-INTEGRATION.md.
// Run with --workers=1: the screen choice is installation-wide.

const FRAME = 'wiskey-embed iframe[data-wiskey-embed-frame]';
const PANEL_URL = /\/hikvision-intercom(\?|$)/;

type Flavour = { kiosk: boolean; panels: boolean };

/** A stand-in for Home Assistant's frontend page at /hikvision-intercom. The panel's navigate() refuses until its
 * session loads (600 ms), like WisKey's panel.ts does before `_session` arrives. */
function fakeHa({ kiosk, panels }: Flavour): string {
  return `<!doctype html><html><body style="margin:0"><home-assistant></home-assistant><script>
window.__loads = (window.__loads || 0) + 1;
window.__menuToggles = 0;
class Panel extends HTMLElement {
  constructor() { super(); this._tab = 'overview'; this.ready = false; setTimeout(() => { this.ready = true; }, 600); }
  connectedCallback() { this.textContent = 'panel:' + this._tab; }
  navigate(tab) { if (!this.ready) return; this._tab = tab; this.textContent = 'panel:' + tab; }
  menu() { this.dispatchEvent(new CustomEvent('hass-toggle-menu', { bubbles: true, composed: true })); }
}
customElements.define('hikvision-intercom-panel', Panel);
class Main extends HTMLElement {
  constructor() {
    super();
    const r = this.attachShadow({ mode: 'open' });
    r.innerHTML = '<style>:host{--ha-sidebar-width:256px;display:block}ha-sidebar{display:block;width:var(--ha-sidebar-width);height:40px;background:#123}</style>'
      + '<ha-drawer><ha-sidebar></ha-sidebar><partial-panel-resolver><ha-panel-custom>'
      + ${panels ? `'<hikvision-intercom-panel></hikvision-intercom-panel>'` : `''`}
      + '</ha-panel-custom></partial-panel-resolver></ha-drawer>';
    this.addEventListener('hass-toggle-menu', () => { window.__menuToggles++; });
  }
}
customElements.define('home-assistant-main', Main);
class Ha extends HTMLElement {
  constructor() {
    super();
    this.hass = { panels: ${panels ? `{ 'hikvision-intercom': {}, lovelace: {} }` : `{ lovelace: {} }`}${kiosk ? ', kioskMode: false' : ''} };
    this.attachShadow({ mode: 'open' }).innerHTML = '<home-assistant-main></home-assistant-main>';
    ${kiosk ? `window.addEventListener('hass-kiosk-mode', (ev) => { this.hass = { ...this.hass, kioskMode: ev.detail.enable }; });` : ''}
  }
}
customElements.define('home-assistant', Ha);
</script></body></html>`;
}

async function stubPanel(page: Page, answer: Flavour | 'down') {
  await page.route(PANEL_URL, (route: Route) =>
    answer === 'down'
      ? route.fulfill({ status: 502, contentType: 'text/plain', body: 'Bad Gateway' })
      : route.fulfill({ status: 200, contentType: 'text/html', body: fakeHa(answer) }),
  );
}

async function open(page: Page, hash: string, design: 'a' | 'b' = 'a') {
  await page.goto('about:blank'); // a goto that changes only the hash is not a navigation: always load afresh
  await page.goto(`/?design=${design}#${hash}`);
  await page.waitForSelector('sw-app');
}

function panelFrame(page: Page): Frame {
  const f = page.frames().find((x) => PANEL_URL.test(x.url()));
  if (!f) throw new Error('no WisKey frame');
  return f;
}

async function frameState(page: Page) {
  return panelFrame(page).evaluate(() => {
    const ham = document.querySelector('home-assistant')?.shadowRoot?.querySelector('home-assistant-main');
    const panel = ham?.shadowRoot?.querySelector('hikvision-intercom-panel') as (HTMLElement & { _tab: string }) | null | undefined;
    const sidebar = ham?.shadowRoot?.querySelector('ha-sidebar');
    const ha = document.querySelector('home-assistant') as (HTMLElement & { hass: { kioskMode?: boolean } }) | null;
    return {
      tab: panel?._tab ?? null,
      sidebar: sidebar ? getComputedStyle(sidebar).display : null,
      injected: !!ham?.shadowRoot?.querySelector('style[data-smplwise-chrome]'),
      kiosk: ha?.hass?.kioskMode ?? null,
      loads: (window as unknown as { __loads: number }).__loads,
      menu: (window as unknown as { __menuToggles: number }).__menuToggles,
    };
  });
}

let saved: AccessUi | null = null;

test.describe('the embedded WisKey panel (CR-005 recorded decision 2026-09-28)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE === '1', 'set SW_LIVE=1 with a plain backend running (no WisKey fixture)');
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({}, testInfo) => {
    // start from the default for every screen (the embed), and put the owner's choice back at the end
    saved = await setAccessUi(testInfo.project.use.baseURL, { 'access.ui.overview': 'wiskey', 'access.ui.events': 'wiskey', 'access.ui.people': 'wiskey' });
  });
  test.afterAll(async ({}, testInfo) => {
    if (saved && Object.keys(saved).length) await setAccessUi(testInfo.project.use.baseURL, saved);
  });

  test('by default the WisKey tabs embed the panel, deep-linked per tab, with Home Assistant\'s sidebar hidden by the kiosk event', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough for the wiring; the phone test is below');
    const s = (await (await request.get('/api/v1/settings')).json()).settings;
    expect([s['access.ui.overview'], s['access.ui.events'], s['access.ui.people']]).toEqual(['wiskey', 'wiskey', 'wiskey']);
    await stubPanel(page, { kiosk: true, panels: true });

    await open(page, '/wiskey/overview');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('src', '/hikvision-intercom?tab=overview', { timeout: 30000 });
    await expect(page.locator('wiskey-overview')).toHaveCount(0);
    await expect(frame).toHaveAttribute('data-phase', 'ready', { timeout: 30000 });
    await expect(frame).toHaveAttribute('data-chrome', 'kiosk');
    await expect(frame).toHaveAttribute('data-tab-applied', 'true', { timeout: 20000 });
    let st = await frameState(page);
    expect(st.kiosk).toBe(true);
    expect(st.injected).toBe(false); // the official lever took, so no DOM hack
    expect(st.tab).toBe('overview');
    // the full-window link opens the same panel on the Home Assistant origin
    await expect(page.locator('wiskey-embed a[data-wiskey-embed-full]').first()).toHaveAttribute('href', '/hikvision-intercom?tab=overview');
    await expect(page.locator('wiskey-embed a[data-wiskey-embed-full]').first()).toHaveAttribute('target', '_blank');
    await expect(page.locator('wiskey-embed a[data-wiskey-embed-full]').first()).toContainText('פתח בחלון מלא');
    // the panel's own menu button would open Home Assistant's drawer over it: swallowed while the chrome is hidden
    await panelFrame(page).evaluate(() => (document.querySelector('home-assistant')!.shadowRoot!.querySelector('home-assistant-main')!.shadowRoot!.querySelector('hikvision-intercom-panel') as HTMLElement & { menu(): void }).menu());
    expect((await frameState(page)).menu).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('wiskey-embed-overview.png') });

    // another SMPLWISE tab: the same loaded frame is navigated (no second Home Assistant load); people = the panel's "users"
    await panelFrame(page).evaluate(() => ((window as unknown as { __marker: number }).__marker = 42));
    await page.locator('sw-tabs a[href="#/wiskey/people"]').click();
    await expect.poll(async () => (await frameState(page)).tab, { timeout: 20000 }).toBe('users');
    await page.locator('sw-tabs a[href="#/wiskey/sync"]').click();
    await expect.poll(async () => (await frameState(page)).tab, { timeout: 20000 }).toBe('sync');
    st = await frameState(page);
    expect(st.loads).toBe(1);
    expect(await panelFrame(page).evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(42); // the same document
    await expect(frame).toHaveAttribute('data-tab-applied', 'true');

    // a direct address deep-links too: a fresh load carries the tab in the frame address and applies it once the panel can
    await open(page, '/wiskey/people');
    await expect(page.locator(FRAME)).toHaveAttribute('src', '/hikvision-intercom?tab=users', { timeout: 30000 });
    await expect.poll(async () => (await frameState(page)).tab, { timeout: 20000 }).toBe('users');
    for (const [seg, tab] of [['events', 'events'], ['devices', 'devices'], ['health', 'health'], ['audit', 'audit'], ['tools', 'tools']]) {
      await open(page, `/wiskey/${seg}`);
      await expect(page.locator(FRAME)).toHaveAttribute('src', `/hikvision-intercom?tab=${tab}`, { timeout: 30000 });
    }
  });

  test('an older Home Assistant frontend without the kiosk event: the injected style hides the sidebar instead', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await stubPanel(page, { kiosk: false, panels: true });
    await open(page, '/wiskey/devices');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('data-phase', 'ready', { timeout: 30000 });
    await expect(frame).toHaveAttribute('data-chrome', 'css');
    const st = await frameState(page);
    expect(st.injected).toBe(true);
    expect(st.sidebar).toBe('none');
    await expect.poll(async () => (await frameState(page)).tab, { timeout: 20000 }).toBe('devices');
    await expect(page.locator('wiskey-embed [data-wiskey-embed-note="chrome"]')).toHaveCount(0);
  });

  test('honest error states: nothing answers the panel address, and Home Assistant without the WisKey panel', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await stubPanel(page, 'down');
    await open(page, '/wiskey/overview');
    const err = page.locator('wiskey-embed [data-wiskey-embed-error="unreachable"]');
    await expect(err).toBeVisible({ timeout: 30000 });
    await expect(err.locator('sw-state-panel')).toHaveAttribute('heading', 'לא ניתן לטעון את WisKey מתוך Home Assistant');
    await expect(err.locator('[data-wiskey-embed-retry]')).toBeVisible();
    await expect(err.locator('a[data-wiskey-embed-full]')).toHaveAttribute('href', '/hikvision-intercom?tab=overview');
    await page.screenshot({ path: testInfo.outputPath('wiskey-embed-unreachable.png') });

    // retry after Home Assistant answers, but without the panel registered
    await page.unroute(PANEL_URL);
    await stubPanel(page, { kiosk: true, panels: false });
    await err.locator('[data-wiskey-embed-retry]').click();
    await expect(page.locator('wiskey-embed [data-wiskey-embed-error="not_installed"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('wiskey-embed [data-wiskey-embed-error="not_installed"] sw-state-panel')).toHaveAttribute('heading', 'לוח WisKey לא נמצא ב־Home Assistant');
  });

  test('הגדרות › בקרות כניסה switches one tab between the embed and the SMPLWISE screen', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await stubPanel(page, { kiosk: true, panels: true });
    try {
      await open(page, '/system/diagnostics?tab=access-control');
      const people = page.locator('system-diagnostics select[data-set-access-ui="people"]');
      await expect(people).toBeEnabled({ timeout: 30000 });
      await expect(people).toHaveValue('wiskey');
      await expect(page.locator('system-diagnostics select[data-set-access-ui="overview"]')).toHaveValue('wiskey');
      await expect(page.locator('system-diagnostics select[data-set-access-ui="events"]')).toHaveValue('wiskey');
      await expect(page.locator('system-diagnostics [data-access-ui-fixed]')).toContainText('שאר מסכי WisKey');
      await expect(people.locator('option')).toHaveText(['WisKey (מוטמע)', 'SMPLWISE']);
      await page.screenshot({ path: testInfo.outputPath('wiskey-embed-settings.png') });
      await people.selectOption('smplwise');
      const save = page.locator('system-diagnostics sw-button[data-save-access-ui]');
      await expect(save).not.toHaveAttribute('disabled', '');
      await save.locator('button').click();
      await expect.poll(async () => (await (await request.get('/api/v1/settings')).json()).settings['access.ui.people']).toBe('smplwise');
      // the audit trail records the choice like any other product setting
      const audit = await (await request.get('/api/v1/audit?action=settings.update&limit=5')).json().catch(() => null);
      if (audit && Array.isArray(audit.items)) expect(JSON.stringify(audit.items)).toContain('access.ui.people');

      // same page, no reload: the people tab now renders the SMPLWISE screen; the entry center stays embedded
      await page.evaluate(() => (location.hash = '#/wiskey/people'));
      await expect(page.locator('wiskey-people')).toHaveCount(1, { timeout: 30000 });
      await expect(page.locator('wiskey-embed')).toHaveCount(0);
      await expect(page.locator('sw-tabs a[href="#/wiskey/people"]')).toContainText('אנשים'); // the tab label stays
      await page.evaluate(() => (location.hash = '#/wiskey/overview'));
      await expect(page.locator('wiskey-embed')).toHaveCount(1, { timeout: 30000 });
      await expect(page.locator('wiskey-overview')).toHaveCount(0);
      // and after a reload (the shell reads the choice from the product settings)
      await open(page, '/wiskey/people');
      await expect(page.locator('wiskey-people')).toHaveCount(1, { timeout: 30000 });
      await expect(page.locator('wiskey-embed')).toHaveCount(0);

      // back to the embed
      await open(page, '/system/diagnostics?tab=access-control');
      await expect(people).toHaveValue('smplwise', { timeout: 30000 });
      await people.selectOption('wiskey');
      await save.locator('button').click();
      await expect.poll(async () => (await (await request.get('/api/v1/settings')).json()).settings['access.ui.people']).toBe('wiskey');
      await page.evaluate(() => (location.hash = '#/wiskey/people'));
      await expect(page.locator(FRAME)).toHaveAttribute('src', '/hikvision-intercom?tab=users', { timeout: 30000 });
      await expect(page.locator('wiskey-people')).toHaveCount(0);
    } finally {
      await request.patch('/api/v1/settings', { data: { 'access.ui.people': 'wiskey' } });
    }
  });

  test('the embedded tabs are gated on access.read at installation scope, like the SMPLWISE WisKey screens', async ({ page, browser, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    const bindings: string[] = [];
    let roleId: string | undefined;
    let siteId: string | undefined;
    const tag = testInfo.project.name;
    const bind = async (username: string, role: string, scopeType = 'installation', scopeId = '*') => {
      const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': username } })).json();
      const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: role, scope_type: scopeType, scope_id: scopeId } });
      expect(r.status()).toBeLessThan(300);
      bindings.push(((await r.json()) as { id: string }).id);
    };
    try {
      // 1. no access.read: no WisKey area, no embedded tabs, and a typed address shows "no permission" with no frame
      const role = await request.post('/api/v1/access/roles', { data: { name: `WisKey embed no access (${tag})`, description: 'evidence', permissions: ['map.read', 'video.live'] } });
      expect(role.status()).toBeLessThan(300);
      roleId = ((await role.json()) as { id: string }).id;
      const noAccess = `wiskeyembno${tag}`;
      await bind(noAccess, roleId);
      const c1 = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': noAccess } });
      const p1 = await c1.newPage();
      await stubPanel(p1, { kiosk: true, panels: true });
      await open(p1, '/live');
      await expect(p1.locator('sw-app nav.rail a[href="#/explore/sites"]')).toHaveCount(1, { timeout: 30000 });
      await expect(p1.locator('sw-app nav.rail a[href^="#/wiskey/"]')).toHaveCount(0);
      for (const seg of ['sync', 'overview']) {
        await open(p1, `/wiskey/${seg}`);
        await expect(p1.locator('wiskey-embed sw-state-panel[data-wiskey-state="no_permission"]')).toBeVisible({ timeout: 30000 });
        await expect(p1.locator(FRAME)).toHaveCount(0);
        await expect(p1.locator('sw-tabs a[href^="#/wiskey/"]')).toHaveCount(0);
      }
      await c1.close();

      // 2. access.read only below installation scope: the embedded tabs are not offered either
      const site = await request.post('/api/v1/sites', { data: { name: `WisKey embed scoped (${tag})` } });
      siteId = ((await site.json()) as { id: string }).id;
      const building = await request.post(`/api/v1/sites/${siteId}/buildings`, { data: { name: 'B' } });
      const floor = await request.post(`/api/v1/buildings/${((await building.json()) as { id: string }).id}/floors`, { data: { name: 'F' } });
      const floorUser = `wiskeyembfloor${tag}`;
      await bind(floorUser, 'viewer', 'floor', ((await floor.json()) as { id: string }).id);
      const c2 = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': floorUser } });
      const p2 = await c2.newPage();
      await stubPanel(p2, { kiosk: true, panels: true });
      await open(p2, '/wiskey/health');
      await expect(p2.locator('wiskey-embed sw-state-panel[data-wiskey-state="no_permission"]')).toBeVisible({ timeout: 30000 });
      await expect(p2.locator('sw-tabs a[href="#/wiskey/health"]')).toHaveCount(0);
      await c2.close();

      // 3. an installation-wide viewer: every WisKey tab is offered and the embed loads
      const viewer = `wiskeyembviewer${tag}`;
      await bind(viewer, 'viewer');
      const c3 = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': viewer } });
      const p3 = await c3.newPage();
      await stubPanel(p3, { kiosk: true, panels: true });
      await open(p3, '/wiskey/audit');
      await expect(p3.locator('sw-tabs a[href^="#/wiskey/"]')).toHaveCount(8, { timeout: 30000 });
      await expect(p3.locator(FRAME)).toHaveAttribute('data-phase', 'ready', { timeout: 30000 });
      await c3.close();
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      if (roleId) await request.delete(`/api/v1/access/roles/${roleId}`).catch(() => {});
      if (siteId) await request.delete(`/api/v1/sites/${siteId}`).catch(() => {});
    }
    void page;
  });

  test('both phone navigations reach the embedded WisKey tabs', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'nav.bottom only renders below the 768px breakpoint');
    await stubPanel(page, { kiosk: true, panels: true });
    // design A: WisKey is a direct icon of the bottom bar; its tab row carries the embedded-only tabs
    await open(page, '/live', 'a');
    const bottom = page.locator('sw-app nav.bottom');
    await expect(bottom).toBeVisible({ timeout: 30000 });
    await bottom.locator('a[href="#/wiskey/overview"]').click();
    await expect(page.locator('sw-tabs a[href="#/wiskey/sync"]')).toHaveCount(1, { timeout: 30000 });
    await page.locator('sw-tabs a[href="#/wiskey/sync"]').click();
    await expect(page.locator(FRAME)).toHaveAttribute('data-phase', 'ready', { timeout: 30000 });
    await expect.poll(async () => (await frameState(page)).tab, { timeout: 20000 }).toBe('sync');
    await page.screenshot({ path: testInfo.outputPath('wiskey-embed-phone-a.png') });

    // design B: WisKey sits behind "עוד"
    await open(page, '/live', 'b');
    await expect(bottom).toBeVisible({ timeout: 30000 });
    await bottom.locator('button').click();
    await page.locator('sw-app .bottom-overflow a[href="#/wiskey/overview"]').click();
    await expect(page.locator('sw-tabs a[href="#/wiskey/health"]')).toHaveCount(1, { timeout: 30000 });
    await page.locator('sw-tabs a[href="#/wiskey/health"]').click();
    await expect(page.locator(FRAME)).toHaveAttribute('src', /\/hikvision-intercom\?tab=(health|overview)/, { timeout: 30000 });
    await expect.poll(async () => (await frameState(page)).tab, { timeout: 20000 }).toBe('health');
    await page.screenshot({ path: testInfo.outputPath('wiskey-embed-phone-b.png') });
  });
});
