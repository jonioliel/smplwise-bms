import { test, expect, type Frame, type Page, type Route } from '@playwright/test';
import { setAccessUi, type AccessUi } from './wiskey-ui-mode';
import { FAKE_CATALOG, PANEL_URL, stubPanel, type FakeCatalog } from './wiskey-fake-ha';

// Evidence for the embedded WisKey panel (CR-005 recorded decision 2026-09-28): the WisKey area shows WisKey's own
// Home Assistant panel (/hikvision-intercom) in a same-origin frame by default, הגדרות › בקרות כניסה switches each of
// the three screens SMPLWISE built back to its own screen, and WisKey's other screens are embedded-only tabs.
//
// WisKey embed API v1 (WisKey 2.0.0-rc.19, docs/integrations/wiskey/embed-api-v1/): the frame opens
// `/hikvision-intercom?embed=1&tab=…&tool=…`, the tab row is built from `wiskey:ready`, a tab click is a
// `wiskey:navigate` message, the tab row and SMPLWISE's address follow the CONFIRMED `wiskey:location`, and SMPLWISE
// dispatches no kiosk event and calls no panel method. The older adapter runs only when the panel carries no
// `data-embed-api` marker 12 s after the load.
//
// Runs with SW_LIVE=1 against a plain developer backend (no Home Assistant). The frame address is answered by a route
// stub (tests/wiskey-fake-ha.ts: HA's element structure with a fake WisKey panel - v1, legacy, marker-only or v2). It
// proves the wiring, NOT the behaviour of the real nested Home Assistant: that is the owner's lab check listed in
// CR-005-ACCESS-CONTROL-INTEGRATION.md. Run with --workers=1: the screen choice is installation-wide.

const FRAME = 'wiskey-embed iframe[data-wiskey-embed-frame]';
const LEGACY_MS = 45_000; // the older adapter starts only after the 12 s discovery

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

type Msg = { type: string; tab?: string; tool?: string | null };

async function frameState(page: Page) {
  return panelFrame(page).evaluate(() => {
    const ham = document.querySelector('home-assistant')?.shadowRoot?.querySelector('home-assistant-main');
    const panel = ham?.shadowRoot?.querySelector('hikvision-intercom-panel') as (HTMLElement & { _tab: string; loc?: { tab: string; tool: string | null } }) | null | undefined;
    const sidebar = ham?.shadowRoot?.querySelector('ha-sidebar');
    const ha = document.querySelector('home-assistant') as (HTMLElement & { hass: { kioskMode?: boolean } }) | null;
    const w = window as unknown as { __loads: number; __menuToggles: number; __navigates: number; __kioskEvents: number; __received: Msg[] };
    return {
      tab: panel?._tab ?? null,
      tool: panel?.loc?.tool ?? null,
      marker: panel?.getAttribute('data-embed-api') ?? null,
      sidebar: sidebar ? getComputedStyle(sidebar).display : null,
      injected: !!ham?.shadowRoot?.querySelector('style[data-smplwise-chrome]'),
      kiosk: ha?.hass?.kioskMode ?? null,
      loads: w.__loads,
      menu: w.__menuToggles,
      navigates: w.__navigates,
      kioskEvents: w.__kioskEvents,
      received: w.__received,
      search: location.search,
    };
  });
}

const hash = (page: Page) => page.evaluate(() => decodeURIComponent(location.hash));
const activeTab = (page: Page) => page.locator('sw-tabs a[aria-current="page"]');

/** T054 follow-up (dark frame around the embed, owner report 2026-09-29): the iframe must fill its `.stage` box
 * exactly - no border, no outline, and no darker background sitting behind it while it loads or after it is ready. */
async function frameGeometry(page: Page) {
  // wiskey-embed is nested inside sw-app's own shadow root: document.querySelector cannot pierce it, so resolve the
  // element through Playwright's (shadow-piercing) locator first and evaluate from there.
  return page.locator('wiskey-embed').evaluate((embed: HTMLElement) => {
    const root = embed.shadowRoot;
    const stage = root?.querySelector('.stage') as HTMLElement | null;
    const frame = root?.querySelector('iframe') as HTMLIFrameElement | null;
    if (!stage || !frame) return null;
    const s = stage.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    const cs = getComputedStyle(frame);
    return {
      dLeft: Math.abs(s.left - f.left),
      dTop: Math.abs(s.top - f.top),
      dWidth: Math.abs(s.width - f.width),
      dHeight: Math.abs(s.height - f.height),
      borderWidth: cs.borderTopWidth,
      outlineStyle: cs.outlineStyle,
      stageBg: getComputedStyle(stage).backgroundColor,
      frameBg: cs.backgroundColor,
    };
  });
}

async function expectFrameFillsStage(page: Page) {
  const g = await frameGeometry(page);
  expect(g).not.toBeNull();
  expect(g!.dLeft).toBeLessThanOrEqual(1);
  expect(g!.dTop).toBeLessThanOrEqual(1);
  expect(g!.dWidth).toBeLessThanOrEqual(1);
  expect(g!.dHeight).toBeLessThanOrEqual(1);
  expect(g!.borderWidth).toBe('0px');
  expect(g!.outlineStyle).toBe('none');
  expect(g!.stageBg).toBe('rgb(255, 255, 255)'); // --sw-surface, never a darker canvas token behind the frame
  expect(g!.frameBg).toBe('rgb(255, 255, 255)');
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

  // ------------------------------------------------------------------ embed API v1

  test('v1: the frame opens embed=1 on the origin, the tab row comes from the catalog, the title is shown - and no kiosk event, no panel method', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough for the wiring; the phone test is below');
    const s = (await (await request.get('/api/v1/settings')).json()).settings;
    expect([s['access.ui.overview'], s['access.ui.events'], s['access.ui.people']]).toEqual(['wiskey', 'wiskey', 'wiskey']);
    const { hits } = await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });

    await open(page, '/wiskey/people');
    const frame = page.locator(FRAME);
    const origin = new URL(page.url()).origin;
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await expect(frame).toHaveAttribute('data-phase', 'ready');
    expect(hits).toEqual([`${origin}/hikvision-intercom?embed=1&tab=users`]); // the origin, never the Ingress path
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'users');
    await expect(page.locator('wiskey-people')).toHaveCount(0);

    // the tab row: exactly the catalog's top-level screens, WisKey's labels, SMPLWISE's `people` segment for `users`
    const tabs = page.locator('sw-tabs a[href^="#/wiskey/"]');
    await expect(tabs).toHaveCount(FAKE_CATALOG.tabs.length);
    expect(await tabs.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['#/wiskey/overview', '#/wiskey/people', '#/wiskey/devices', '#/wiskey/events', '#/wiskey/sync', '#/wiskey/tools', '#/wiskey/camera_wall']);
    expect(await tabs.allTextContents()).toEqual(FAKE_CATALOG.tabs.map((t) => t.label));
    await expect(activeTab(page)).toHaveAttribute('href', '#/wiskey/people');
    // the panel's title, as text; the confirmed location mirrored into SMPLWISE's own address
    await expect(page.locator('wiskey-embed [data-wiskey-embed-title]')).toHaveText('אנשים ב-WisKey');
    await expect.poll(() => hash(page)).toBe('#/wiskey/people?wiskey_tab=users');
    // WisKey handles HA's sidebar itself: SMPLWISE dispatched nothing, injected nothing, called no panel method
    const st = await frameState(page);
    expect(st.kioskEvents).toBe(0);
    expect(st.injected).toBe(false);
    expect(st.navigates).toBe(0);
    expect(st.marker).toBe('1');
    await expect(page.locator('wiskey-embed [data-wiskey-embed-note="legacy"]')).toHaveCount(0);
    // the full-window link is the normal deep link (no embed=1)
    await expect(page.locator('wiskey-embed a[data-wiskey-embed-full]').first()).toHaveAttribute('href', '/hikvision-intercom?tab=users');
    await expect(frame).toHaveAttribute('allow', 'autoplay; microphone; camera; fullscreen; clipboard-write');
    // the frame fills its box exactly: no border/outline, no darker background behind it (owner report 2026-09-29)
    await expectFrameFillsStage(page);
    await page.screenshot({ path: testInfo.outputPath('wiskey-embed-v1-people.png') });
  });

  test('v1: a tab click is a wiskey:navigate message; the confirmed location moves the tab row and the address; tools and back/forward', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    await open(page, '/wiskey/overview');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await panelFrame(page).evaluate(() => ((window as unknown as { __marker: number }).__marker = 42));

    await page.locator('sw-tabs a[href="#/wiskey/devices"]').click();
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'devices');
    await expect(activeTab(page)).toHaveAttribute('href', '#/wiskey/devices');
    await expect.poll(() => hash(page)).toBe('#/wiskey/devices?wiskey_tab=devices');
    let st = await frameState(page);
    expect(st.received.filter((m) => m.type === 'wiskey:navigate')).toEqual([{ type: 'wiskey:navigate', tab: 'devices', tool: null }]);
    expect(st.tab).toBe('devices');
    expect(st.loads).toBe(1);
    expect(await panelFrame(page).evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(42); // the same document

    // ניהול: the tools row comes from the catalog's tools (not those that are top-level tabs too)
    await page.locator('sw-tabs a[href="#/wiskey/tools"]').click();
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'tools');
    const tools = page.locator('wiskey-embed nav[data-wiskey-tools] a');
    await expect(tools).toHaveCount(5); // the hub + media_options, schedules, health, audit
    expect(await tools.evaluateAll((as) => as.map((a) => a.getAttribute('data-wiskey-tool')))).toEqual(['', 'media_options', 'schedules', 'health', 'audit']);
    await page.locator('wiskey-embed nav[data-wiskey-tools] a[data-wiskey-tool="media_options"]').click();
    await expect(frame).toHaveAttribute('data-confirmed-tool', 'media_options');
    await expect.poll(() => hash(page)).toBe('#/wiskey/tools/media_options?wiskey_tab=tools&wiskey_tool=media_options');
    await expect(page.locator('wiskey-embed [data-wiskey-embed-title]')).toHaveText('וידאו, שמע והכרזות');
    await expect(activeTab(page)).toHaveAttribute('href', '#/wiskey/tools');
    await expect(page.locator('wiskey-embed nav[data-wiskey-tools] a[aria-current="page"]')).toHaveAttribute('data-wiskey-tool', 'media_options');
    await expect(page.locator('wiskey-embed a[data-wiskey-embed-full]').first()).toHaveAttribute('href', '/hikvision-intercom?tab=tools&tool=media_options');
    st = await frameState(page);
    expect(st.search).toBe('?embed=1&tab=tools&tool=media_options'); // WisKey keeps its own URL canonical
    const sent = st.received.filter((m) => m.type === 'wiskey:navigate').length;

    // back / forward in SMPLWISE re-send the navigation; the mirror itself never does (no echo)
    await page.goBack();
    await expect(frame).toHaveAttribute('data-confirmed-tool', '');
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'tools');
    await page.goBack();
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'devices');
    await page.goForward();
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'tools');
    await page.waitForTimeout(800);
    st = await frameState(page);
    expect(st.received.filter((m) => m.type === 'wiskey:navigate').slice(sent)).toEqual([
      { type: 'wiskey:navigate', tab: 'tools', tool: null },
      { type: 'wiskey:navigate', tab: 'devices', tool: null },
      { type: 'wiskey:navigate', tab: 'tools', tool: null },
    ]);
    expect(st.kioskEvents).toBe(0);
    expect(st.navigates).toBe(0);
    expect(st.loads).toBe(1);
  });

  test('v1: a declined navigation (unsaved schedule) keeps the selection; a second click goes through', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    await open(page, '/wiskey/tools/schedules');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await expect(frame).toHaveAttribute('data-confirmed-tool', 'schedules');
    await panelFrame(page).evaluate(() => ((window as unknown as { __dirty: boolean }).__dirty = true));
    const entries = await page.evaluate(() => history.length);

    await page.locator('sw-tabs a[href="#/wiskey/people"]').click();
    await expect.poll(async () => (await frameState(page)).received.some((m) => m.type === 'wiskey:navigate' && m.tab === 'users')).toBe(true);
    await expect.poll(() => hash(page)).toBe('#/wiskey/tools/schedules?wiskey_tab=tools&wiskey_tool=schedules');
    await expect(activeTab(page)).toHaveAttribute('href', '#/wiskey/tools');
    await expect(frame).toHaveAttribute('data-confirmed-tool', 'schedules');
    expect((await frameState(page)).tab).toBe('tools');
    expect(await page.evaluate(() => history.length)).toBe(entries); // a declined change leaves no history entry

    await panelFrame(page).evaluate(() => ((window as unknown as { __dirty: boolean }).__dirty = false));
    await page.locator('sw-tabs a[href="#/wiskey/people"]').click();
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'users');
    await expect(activeTab(page)).toHaveAttribute('href', '#/wiskey/people');
    await expect.poll(() => hash(page)).toBe('#/wiskey/people?wiskey_tab=users');
    expect(await page.evaluate(() => history.length)).toBe(entries + 1); // the confirmed change: one entry

    // Back before the answer to a click arrives: the Back is sent (not matched against the stale confirmation), and
    // the late answer to the click does not overwrite the Back entry
    await panelFrame(page).evaluate(() => ((window as unknown as { __defer: boolean }).__defer = true));
    const before = await page.evaluate(() => history.length);
    await page.locator('sw-tabs a[href="#/wiskey/devices"]').click();
    expect(await hash(page)).toBe('#/wiskey/people?wiskey_tab=users'); // not moved, no entry until WisKey confirms
    await page.goBack(); // to tools/schedules
    await expect.poll(() => panelFrame(page).evaluate(() => (window as unknown as { __deferred: Msg[] }).__deferred)).toEqual([
      { type: 'wiskey:navigate', tab: 'devices', tool: null },
      { type: 'wiskey:navigate', tab: 'tools', tool: 'schedules' },
    ]);
    await panelFrame(page).evaluate(() => (window as unknown as { __flush(): void }).__flush());
    await expect(frame).toHaveAttribute('data-confirmed-tool', 'schedules');
    await expect.poll(() => hash(page)).toBe('#/wiskey/tools/schedules?wiskey_tab=tools&wiskey_tool=schedules');
    await page.waitForTimeout(800);
    expect(await hash(page)).toBe('#/wiskey/tools/schedules?wiskey_tab=tools&wiskey_tool=schedules');
    expect((await frameState(page)).tab).toBe('tools');
    expect(await page.evaluate(() => history.length)).toBe(before); // the late answer to the click pushed nothing
  });

  test('v1: a navigation WisKey does not answer (session lock) expires - the same click later is sent again', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    await open(page, '/wiskey/overview');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'overview');
    const navigates = async () => (await frameState(page)).received.filter((m) => m.type === 'wiskey:navigate');
    await panelFrame(page).evaluate(() => ((window as unknown as { __ignore: boolean }).__ignore = true)); // locked
    await page.locator('sw-tabs a[href="#/wiskey/devices"]').click();
    await expect.poll(navigates).toEqual([{ type: 'wiskey:navigate', tab: 'devices', tool: null }]);
    await page.waitForTimeout(3500); // no answer: longer than the in-flight window
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'overview');
    await expect(activeTab(page)).toHaveAttribute('href', '#/wiskey/overview');
    expect(await hash(page)).toBe('#/wiskey/overview?wiskey_tab=overview');
    await panelFrame(page).evaluate(() => ((window as unknown as { __ignore: boolean }).__ignore = false)); // unlocked
    await page.locator('sw-tabs a[href="#/wiskey/devices"]').click();
    await expect.poll(async () => (await navigates()).length).toBe(2); // sent again, not matched against the stale request
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'devices');
    await expect.poll(() => hash(page)).toBe('#/wiskey/devices?wiskey_tab=devices');
  });
  test('v1: messages from another window or another origin are ignored', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    const other = `http://localhost:${new URL(testInfo.project.use.baseURL ?? 'http://127.0.0.1:4173/').port}`; // another origin, same server
    await page.route(/\/wiskey-evil$/, (route: Route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: `<script>parent.postMessage({ type: 'wiskey:location', tab: 'sync', tool: null }, '*'); parent.postMessage({ type: 'wiskey:title', text: 'EVIL' }, '*');</script>` }),
    );
    await open(page, '/wiskey/devices');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'devices');

    // 1. the SMPLWISE page itself (right origin, wrong source)
    await page.evaluate(() => {
      window.postMessage({ type: 'wiskey:location', tab: 'sync', tool: null }, location.origin);
      window.postMessage({ type: 'wiskey:title', text: 'EVIL' }, location.origin);
    });
    // 2. a frame nested inside the WisKey frame (same origin, not the frame itself)
    await panelFrame(page).evaluate(() => {
      const f = document.createElement('iframe');
      f.srcdoc = `<script>parent.parent.postMessage({ type: 'wiskey:location', tab: 'sync', tool: null }, location.origin === 'null' ? '*' : parent.location.origin);</script>`;
      document.body.appendChild(f);
    });
    // 3. another origin (localhost vs 127.0.0.1) framed by the page
    await page.evaluate((src) => {
      const f = document.createElement('iframe');
      f.src = src;
      document.body.appendChild(f);
    }, `${other}/wiskey-evil`);
    await page.waitForTimeout(1500);
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'devices');
    await expect(page.locator('wiskey-embed [data-wiskey-embed-title]')).toHaveText('עמדות');
    expect(await hash(page)).toBe('#/wiskey/devices?wiskey_tab=devices');
  });

  test('v1: a restricted operator - WisKey falls back to its default and the tab row follows the LOCATION, not the request', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    const restricted: FakeCatalog = { tabs: [{ id: 'events', label: 'אירועים' }, { id: 'devices', label: 'עמדות' }], tools: [] };
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1', catalog: restricted });
    await open(page, '/wiskey/sync'); // not in this operator's catalog
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'events'); // WisKey's allowed default, as it reported it
    await expect(activeTab(page)).toHaveAttribute('href', '#/wiskey/events');
    await expect.poll(() => hash(page)).toBe('#/wiskey/events?wiskey_tab=events');
    await expect(page.locator('sw-tabs a[href^="#/wiskey/"]')).toHaveCount(2);
    await expect(page.locator('sw-app nav.rail a[href^="#/wiskey/"]')).toHaveAttribute('href', '#/wiskey/events'); // the area opens on a permitted tab
    // a typed id outside the catalog is not sent, and the address goes back to what WisKey confirmed
    await page.evaluate(() => (location.hash = '#/wiskey/sync'));
    await expect.poll(() => hash(page)).toBe('#/wiskey/events?wiskey_tab=events');
    await page.waitForTimeout(500);
    expect((await frameState(page)).received.filter((m) => m.type === 'wiskey:navigate')).toEqual([]);
  });

  test('v1: ready without a location confirms nothing - a click on the screen WisKey fell back to is still sent', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    const restricted: FakeCatalog = { tabs: [{ id: 'events', label: 'אירועים' }, { id: 'devices', label: 'עמדות' }], tools: [] };
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1', catalog: restricted, announce: false });
    await open(page, '/wiskey/sync');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await page.waitForTimeout(800);
    await expect(frame).toHaveAttribute('data-confirmed-tab', ''); // the request is not rendered as confirmed
    await expect(page.locator('wiskey-embed nav[data-wiskey-tools]')).toHaveCount(0);
    expect(await hash(page)).toBe('#/wiskey/sync'); // nothing mirrored
    expect((await frameState(page)).tab).toBe('events'); // what WisKey actually shows
    await page.locator('sw-tabs a[href="#/wiskey/events"]').click();
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'events');
    expect((await frameState(page)).received.filter((m) => m.type === 'wiskey:navigate')).toEqual([{ type: 'wiskey:navigate', tab: 'events', tool: null }]);
    await expect(activeTab(page)).toHaveAttribute('href', '#/wiskey/events');
  });

  test('v1: a screen set to SMPLWISE stays in the tab row even when the WisKey catalog does not list it', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    const restricted: FakeCatalog = { tabs: [{ id: 'events', label: 'אירועים' }, { id: 'devices', label: 'עמדות' }], tools: [] };
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1', catalog: restricted });
    try {
      await request.patch('/api/v1/settings', { data: { 'access.ui.people': 'smplwise', 'access.ui.overview': 'smplwise' } });
      await open(page, '/wiskey/devices');
      await expect(page.locator(FRAME)).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
      const tabs = page.locator('sw-tabs a[href^="#/wiskey/"]');
      await expect(tabs).toHaveCount(4);
      expect(await tabs.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['#/wiskey/overview', '#/wiskey/events', '#/wiskey/people', '#/wiskey/devices']);
      await expect(page.locator('sw-tabs a[href="#/wiskey/people"]')).toHaveText('אנשים');
      // and it stays after leaving for it (the catalog is kept for the session)
      await page.locator('sw-tabs a[href="#/wiskey/people"]').click();
      await expect(page.locator('wiskey-people')).toHaveCount(1, { timeout: 30000 });
      await expect(tabs).toHaveCount(4);
    } finally {
      await request.patch('/api/v1/settings', { data: { 'access.ui.people': 'wiskey', 'access.ui.overview': 'wiskey' } });
    }
  });

  test('v1: a reload inside the frame needs a fresh handshake; a sign-in redirect after it is login_required', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    const { hits } = await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    let authLoads = 0;
    await page.route(/\/auth\/authorize/, (route: Route) => {
      authLoads++;
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><ha-authorize>login</ha-authorize></body></html>' });
    });
    await open(page, '/wiskey/devices');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await page.locator('sw-tabs a[href="#/wiskey/sync"]').click();
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'sync');
    // Home Assistant reloads its frontend inside the frame: the remounted panel's ready is accepted
    await panelFrame(page).evaluate(() => location.reload()).catch(() => undefined);
    await expect.poll(() => hits.length).toBe(2);
    expect(hits[1]).toMatch(/\/hikvision-intercom\?embed=1&tab=sync$/); // WisKey's own replaced URL
    await expect.poll(async () => { try { return (await frameState(page)).loads; } catch { return 0; } }).toBe(1);
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'sync');
    await page.locator('sw-tabs a[href="#/wiskey/devices"]').click();
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'devices'); // the new handshake's catalog works
    // the operator's session ends: HA sends the frame to its sign-in page
    await panelFrame(page).evaluate(() => location.assign('/auth/authorize?client_id=x&redirect_uri=y')).catch(() => undefined);
    const embed = page.locator('wiskey-embed');
    await expect(embed).toHaveAttribute('data-direct', 'login_required', { timeout: 30000 });
    expect(authLoads).toBe(1);
    await expect(page.locator(FRAME)).toHaveCount(0);
  });
  test('v1: leaving the module removes the frame; coming back and "רענן" reopen the last confirmed location', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    const { hits } = await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    await open(page, '/wiskey/tools/media_options');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await expect(frame).toHaveAttribute('data-confirmed-tool', 'media_options');
    await panelFrame(page).evaluate(() => ((window as unknown as { __marker: number }).__marker = 42));

    // "רענן": the same URL, a fresh document and a fresh handshake
    await page.locator('wiskey-embed sw-button[data-wiskey-embed-refresh] button').click();
    await expect.poll(() => hits.length).toBe(2);
    expect(hits[1]).toMatch(/\/hikvision-intercom\?embed=1&tab=tools&tool=media_options$/);
    await expect.poll(async () => { try { return await panelFrame(page).evaluate(() => (window as unknown as { __marker?: number }).__marker ?? 'fresh'); } catch { return 'navigating'; } }).toBe('fresh');
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await expect(frame).toHaveAttribute('data-confirmed-tool', 'media_options');

    // module exit: the frame is gone (WisKey's page unloaded)
    await page.evaluate(() => (location.hash = '#/live'));
    await expect(page.locator('wiskey-embed')).toHaveCount(0);
    await expect.poll(() => page.frames().filter((f) => PANEL_URL.test(f.url())).length).toBe(0);
    // back: a new frame on the last confirmed location (the address carries the mirror)
    await page.goBack();
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    expect(hits[2]).toMatch(/\/hikvision-intercom\?embed=1&tab=tools&tool=media_options$/);
    expect((await frameState(page)).loads).toBe(1);
  });

  test('v1: the marker without a handshake is a waiting state - never the older adapter; a future contract is unsupported', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    test.setTimeout(90_000);
    await stubPanel(page, { kiosk: true, panels: true, api: 'marker-only' });
    await open(page, '/wiskey/devices');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('data-phase', 'waiting', { timeout: 30000 });
    await expect(frame).toHaveAttribute('data-embed-mode', 'pending');
    await expect(page.locator('wiskey-embed [data-wiskey-embed-note="waiting"]')).toBeVisible();
    await page.waitForTimeout(3000);
    let st = await frameState(page);
    expect(st.kioskEvents).toBe(0);
    expect(st.navigates).toBe(0);
    expect(st.injected).toBe(false);
    await expect(page.locator('sw-tabs a[href^="#/wiskey/"]')).toHaveCount(8); // no catalog: nothing new is offered
    await page.screenshot({ path: testInfo.outputPath('wiskey-embed-waiting.png') });

    // a future contract announced by the handshake: unsupported at once (well before the 12 s discovery)
    for (const api of ['v2-ready', 'v2-marker'] as const) {
      await page.unrouteAll();
      await stubPanel(page, { kiosk: true, panels: true, api });
      await open(page, '/wiskey/devices');
      await expect(frame).toHaveAttribute('data-phase', 'unsupported', { timeout: api === 'v2-ready' ? 8000 : 30000 });
      const err = page.locator('wiskey-embed [data-wiskey-embed-error="unsupported"]');
      await expect(err).toBeVisible();
      await expect(err.locator('sw-state-panel')).toHaveAttribute('hint', /גרסת ממשק הטמעה 2/);
      await expect(err.locator('a[data-wiskey-embed-full]')).toHaveAttribute('href', '/hikvision-intercom?tab=devices');
      st = await frameState(page);
      expect(st.kioskEvents).toBe(0);
      expect(st.navigates).toBe(0);
      expect(st.received).toEqual([]);
    }
  });

  // ------------------------------------------------------------------ an older WisKey (no marker): the previous adapter

  test('older WisKey (no marker): after the 12 s discovery the previous adapter hides the sidebar by the kiosk event and deep-links', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    test.setTimeout(150_000);
    await stubPanel(page, { kiosk: true, panels: true, api: 'legacy' });

    await open(page, '/wiskey/overview');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('src', /\/hikvision-intercom\?embed=1&tab=overview$/, { timeout: 30000 });
    await expect(page.locator('wiskey-overview')).toHaveCount(0);
    // before the discovery: nothing is done to the frame
    await page.waitForTimeout(5000);
    let st = await frameState(page);
    expect(st.kioskEvents).toBe(0);
    await expect(frame).toHaveAttribute('data-embed-mode', 'pending');
    await expect(frame).toHaveAttribute('data-embed-mode', 'legacy', { timeout: LEGACY_MS });
    await expect(frame).toHaveAttribute('data-phase', 'ready', { timeout: 30000 });
    await expect(frame).toHaveAttribute('data-chrome', 'kiosk');
    await expect(frame).toHaveAttribute('data-tab-applied', 'true', { timeout: 20000 });
    await expect(page.locator('wiskey-embed [data-wiskey-embed-note="legacy"]')).toBeVisible();
    st = await frameState(page);
    expect(st.kiosk).toBe(true);
    expect(st.injected).toBe(false); // the official lever took, so no DOM hack
    expect(st.tab).toBe('overview');
    expect(st.received).toEqual([]); // nothing was posted to an older panel
    await expect(page.locator('wiskey-embed a[data-wiskey-embed-full]').first()).toHaveAttribute('href', '/hikvision-intercom?tab=overview');
    await expect(page.locator('sw-tabs a[href^="#/wiskey/"]')).toHaveCount(8); // the static tab row
    // the panel's own menu button would open Home Assistant's drawer over it: swallowed while the chrome is hidden
    await panelFrame(page).evaluate(() => (document.querySelector('home-assistant')!.shadowRoot!.querySelector('home-assistant-main')!.shadowRoot!.querySelector('hikvision-intercom-panel') as HTMLElement & { menu(): void }).menu());
    expect((await frameState(page)).menu).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('wiskey-embed-legacy-overview.png') });

    // another SMPLWISE tab: the same loaded frame is navigated (no second Home Assistant load); people = the panel's "users"
    await panelFrame(page).evaluate(() => ((window as unknown as { __marker: number }).__marker = 42));
    await page.locator('sw-tabs a[href="#/wiskey/people"]').click();
    await expect.poll(async () => (await frameState(page)).tab, { timeout: 20000 }).toBe('users');
    await page.locator('sw-tabs a[href="#/wiskey/sync"]').click();
    await expect.poll(async () => (await frameState(page)).tab, { timeout: 20000 }).toBe('sync');
    st = await frameState(page);
    expect(st.loads).toBe(1);
    expect(await panelFrame(page).evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(42);

    // the deep link is applied once, then WisKey's own navigation is left alone
    await page.locator('sw-tabs a[href="#/wiskey/tools"]').click();
    await expect.poll(async () => (await frameState(page)).tab, { timeout: 20000 }).toBe('tools');
    await expect(frame).toHaveAttribute('data-tab-applied', 'true');
    const before = (await frameState(page)).navigates;
    await panelFrame(page).evaluate(() => (document.querySelector('home-assistant')!.shadowRoot!.querySelector('home-assistant-main')!.shadowRoot!.querySelector('hikvision-intercom-panel') as HTMLElement & { navigate(t: string): void }).navigate('camera_wall'));
    await page.waitForTimeout(5000); // more than two of the settled 2 s ticks
    st = await frameState(page);
    expect(st.tab).toBe('camera_wall');
    expect(st.navigates).toBe(before + 1);

    // a direct address: the frame carries the tab, the adapter applies it once the discovery said "older WisKey"
    await open(page, '/wiskey/people');
    await expect(page.locator(FRAME)).toHaveAttribute('src', /\/hikvision-intercom\?embed=1&tab=users$/, { timeout: 30000 });
    await expect.poll(async () => (await frameState(page)).tab, { timeout: LEGACY_MS }).toBe('users');
    expect((await frameState(page)).navigates).toBe(1); // one call, after the panel's session loaded - no retry storm
    for (const [seg, tab] of [['events', 'events'], ['devices', 'devices'], ['health', 'health'], ['audit', 'audit'], ['tools', 'tools']]) {
      await open(page, `/wiskey/${seg}`);
      await expect(page.locator(FRAME)).toHaveAttribute('src', new RegExp(`/hikvision-intercom\\?embed=1&tab=${tab}$`), { timeout: 30000 });
    }
  });

  test('older WisKey on an older Home Assistant frontend without the kiosk event: the injected style hides the sidebar instead', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    test.setTimeout(90_000);
    await stubPanel(page, { kiosk: false, panels: true, api: 'legacy' });
    await open(page, '/wiskey/devices');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('data-embed-mode', 'legacy', { timeout: LEGACY_MS });
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
    await expect(err.locator('sw-state-panel')).toHaveAttribute('heading', 'לא ניתן לטעון את WisKey');
    await expect(err.locator('[data-wiskey-embed-retry]')).toBeVisible();
    await expect(err.locator('a[data-wiskey-embed-full]')).toHaveAttribute('href', '/hikvision-intercom?tab=overview');
    await page.screenshot({ path: testInfo.outputPath('wiskey-embed-unreachable.png') });

    // retry after Home Assistant answers, but without the panel registered
    await page.unrouteAll();
    await stubPanel(page, { kiosk: true, panels: false, api: 'v1' });
    await err.locator('[data-wiskey-embed-retry]').click();
    await expect(page.locator('wiskey-embed [data-wiskey-embed-error="not_installed"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('wiskey-embed [data-wiskey-embed-error="not_installed"] sw-state-panel')).toHaveAttribute('heading', 'לוח WisKey לא נמצא');
  });

  test('height: at 1440×900 the frame gets the whole viewport below SMPLWISE\'s chrome; "הגדל" gives it the viewport minus the embed bar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only (the owner report is a desktop one)');
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    await open(page, '/wiskey/overview');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'overview', { timeout: 15000 });
    expect(page.viewportSize()).toEqual({ width: 1440, height: 900 });

    // the chrome, measured from the DOM: the top bar, <main>'s banner padding, everything in <main> before the screen
    // (setup hint, tab row), and the embed's own bar (+ the tools row when it shows)
    const measure = () =>
      page.locator('wiskey-embed').evaluate((embed: HTMLElement) => {
        const shell = (embed.getRootNode() as ShadowRoot).host as HTMLElement;
        const sr = shell.shadowRoot!;
        const h = (el: Element | null | undefined) => (el ? el.getBoundingClientRect().height : 0);
        const main = sr.querySelector('main')!;
        const screen = main.querySelector(':scope > .screen')!;
        // <main>'s banner padding plus everything before the screen, margins included (setup hint, tab row)
        const beforeScreen = screen.getBoundingClientRect().top - main.getBoundingClientRect().top;
        const root = embed.shadowRoot!;
        const f = root.querySelector('iframe')!;
        const fr = f.getBoundingClientRect();
        const expanded = embed.hasAttribute('data-expanded');
        const shellChrome = expanded ? 0 : h(sr.querySelector('header.topbar')) + beforeScreen;
        const embedChrome = h(root.querySelector('.bar')) + h(root.querySelector('nav.tools'));
        return {
          viewport: window.innerHeight,
          chrome: shellChrome + embedChrome,
          top: fr.top,
          bottom: fr.bottom,
          height: fr.height,
          width: fr.width,
          inner: f.contentWindow!.innerHeight, // what WisKey's fitWall reads (visualViewport.height = the frame's)
          mainScrolls: main.scrollHeight > main.clientHeight + 1,
          barTabs: root.querySelectorAll('.bar sw-tabs').length,
        };
      });
    // WisKey rc.25 panel.ts fitWall (wiskey appearance): the cards per page for a frame of this size
    const wiskeyCapacity = (w: number, hgt: number) => (w < 700 ? 4 : w < 980 ? (hgt < 760 ? 4 : 6) : w < 1200 ? (hgt < 820 ? 6 : 9) : hgt < 800 ? 4 : hgt < 880 ? 8 : 12);

    const base = await measure();
    testInfo.annotations.push({ type: 'default layout', description: `frame ${Math.round(base.width)}×${Math.round(base.height)} (chrome ${Math.round(base.chrome)} px) → WisKey rc.25 capacity ${wiskeyCapacity(base.width, base.height)}` });
    expect(base.height).toBeGreaterThanOrEqual(base.viewport - base.chrome - 1);
    expect(Math.abs(base.bottom - base.viewport)).toBeLessThanOrEqual(1); // down to the bottom edge, no max-height
    expect(Math.abs(base.inner - base.height)).toBeLessThanOrEqual(1); // the panel's own viewport is the whole frame
    expect(base.mainScrolls).toBe(false); // no scroll container gives the frame less than it shows
    expect(base.barTabs).toBe(0);
    await expectFrameFillsStage(page);

    // "הגדל": over the shell's top bar and tab row; the WisKey tabs move into the embed's bar
    await page.locator('wiskey-embed sw-button[data-wiskey-expand]').click();
    await expect(page.locator('wiskey-embed')).toHaveAttribute('data-expanded', '');
    const big = await measure();
    testInfo.annotations.push({ type: 'expanded', description: `frame ${Math.round(big.width)}×${Math.round(big.height)} (chrome ${Math.round(big.chrome)} px) → WisKey rc.25 capacity ${wiskeyCapacity(big.width, big.height)}` });
    expect(big.height).toBeGreaterThanOrEqual(big.viewport - big.chrome - 1);
    expect(Math.abs(big.top - big.chrome)).toBeLessThanOrEqual(1);
    expect(Math.abs(big.bottom - big.viewport)).toBeLessThanOrEqual(1);
    expect(big.width).toBeGreaterThanOrEqual(1439);
    expect(big.height).toBeGreaterThan(base.height + 100);
    expect(big.height).toBeGreaterThanOrEqual(800); // WisKey's 8-card step at this width
    await expectFrameFillsStage(page);
    const barTabs = page.locator('wiskey-embed .bar sw-tabs a[href^="#/wiskey/"]');
    await expect(barTabs).toHaveCount(FAKE_CATALOG.tabs.length);
    await page.screenshot({ path: testInfo.outputPath('wiskey-embed-expanded.png') });
    // a tab in the embed's bar is a wiskey:navigate message like the shell's row
    await page.locator('wiskey-embed .bar sw-tabs a[href="#/wiskey/devices"]').click();
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'devices');
    expect((await frameState(page)).received).toContainEqual({ type: 'wiskey:navigate', tab: 'devices', tool: null });
    await expect(page.locator('wiskey-embed .bar sw-tabs a[aria-current="page"]')).toHaveAttribute('href', '#/wiskey/devices');

    // remembered by this browser; "צמצם" restores the layout
    await open(page, '/wiskey/overview');
    await expect(page.locator('wiskey-embed')).toHaveAttribute('data-expanded', '', { timeout: 15000 });
    await page.locator('wiskey-embed sw-button[data-wiskey-expand]').click();
    await expect(page.locator('wiskey-embed')).not.toHaveAttribute('data-expanded', '');
    const back = await measure();
    expect(Math.abs(back.height - base.height)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => localStorage.getItem('sw-wiskey-expanded'))).toBeNull();
  });

  test('"הגדל" keeps the system alert banner visible above it, makes the covered shell inert, and Esc leaves it', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await page.route('**/api/v1/health/summary', (route: Route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', items: [{ id: 'nvr', status: 'error', label: 'מקליט לא זמין' }], checked_at: new Date().toISOString(), version: 'test' }) }),
    );
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    await open(page, '/wiskey/overview');
    await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'overview', { timeout: 15000 });
    const banner = page.locator('sw-app [data-sys-banner]');
    await expect(banner).toBeVisible();
    await page.locator('wiskey-embed sw-button[data-wiskey-expand]').click();
    await expect(page.locator('wiskey-embed')).toHaveAttribute('data-expanded', '');
    const g = await page.locator('wiskey-embed').evaluate((embed: HTMLElement) => {
      const sr = (embed.getRootNode() as ShadowRoot);
      const b = sr.querySelector('[data-sys-banner]')!.getBoundingClientRect();
      const e = embed.getBoundingClientRect();
      const hit = sr.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return {
        bannerTop: b.top,
        bannerBottom: b.bottom,
        embedTop: e.top,
        embedBottom: e.bottom,
        bannerOnTop: !!hit && !!hit.closest('[data-sys-banner]'),
        shellMarked: (sr.host as HTMLElement).hasAttribute('data-wiskey-expanded'),
        inert: ['nav.rail', 'header.topbar', 'main > .subnav'].map((s) => (sr.querySelector(s) as HTMLElement | null)?.inert ?? null),
        screenInert: (sr.querySelector('main > .screen') as HTMLElement).inert,
      };
    });
    expect(g.bannerTop).toBe(0);
    expect(g.bannerOnTop).toBe(true); // the layer never covers the alert
    expect(Math.abs(g.embedTop - g.bannerBottom)).toBeLessThanOrEqual(1); // the layer starts right below it
    expect(Math.abs(g.embedBottom - 900)).toBeLessThanOrEqual(1);
    expect(g.shellMarked).toBe(true);
    expect(g.inert).toEqual([true, true, true]); // Tab cannot reach the covered shell
    expect(g.screenInert).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('wiskey-embed-expanded-banner.png') });

    // Esc leaves "הגדל" and gives the shell back
    await page.locator('wiskey-embed sw-button[data-wiskey-expand]').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('wiskey-embed')).not.toHaveAttribute('data-expanded', '');
    const after = await page.locator('wiskey-embed').evaluate((embed: HTMLElement) => {
      const sr = embed.getRootNode() as ShadowRoot;
      return {
        shellMarked: (sr.host as HTMLElement).hasAttribute('data-wiskey-expanded'),
        inert: ['nav.rail', 'header.topbar', 'main > .subnav'].map((s) => (sr.querySelector(s) as HTMLElement | null)?.inert ?? null),
        bannerTop: sr.querySelector('[data-sys-banner]')!.getBoundingClientRect().top,
      };
    });
    expect(after).toEqual({ shellMarked: false, inert: [false, false, false], bannerTop: expect.any(Number) });
    expect(after.bannerTop).toBeGreaterThan(0); // back under the top bar
  });

  test('הגדרות › בקרות כניסה switches one tab between the embed and the SMPLWISE screen', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    try {
      await open(page, '/system/diagnostics?tab=access-control');
      const people = page.locator('system-diagnostics select[data-set-access-ui="people"]');
      await expect(people).toBeEnabled({ timeout: 30000 });
      await expect(people).toHaveValue('wiskey');
      await expect(page.locator('system-diagnostics select[data-set-access-ui="overview"]')).toHaveValue('wiskey');
      await expect(page.locator('system-diagnostics select[data-set-access-ui="events"]')).toHaveValue('wiskey');
      await expect(page.locator('system-diagnostics [data-access-ui-fixed]')).toContainText('שאר מסכי WisKey');
      await expect(people.locator('option')).toHaveText(['WisKey (מוטמע)', 'SMPLWISE']);
      // the section names the embed API and the fallback for older WisKey builds
      await expect(page.locator('system-diagnostics [data-access-ui-embed-api]')).toContainText('2.0.0-rc.19');
      await expect(page.locator('system-diagnostics [data-access-ui-embed-api]')).toContainText('לשיטה הקודמת');
      // the section says plainly that inside the embed door release and people edits bypass SMPLWISE's confirmation and audit
      await expect(page.locator('system-diagnostics [data-access-ui-warning]')).toContainText('לפתוח דלתות');
      await expect(page.locator('system-diagnostics [data-access-ui-warning]')).toContainText('בלי רישום באודיט של SMPLWISE');
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
      await expect(page.locator('sw-tabs a[href="#/wiskey/people"]')).toContainText('אנשים'); // the tab stays
      await page.evaluate(() => (location.hash = '#/wiskey/overview'));
      await expect(page.locator('wiskey-embed')).toHaveCount(1, { timeout: 30000 });
      await expect(page.locator('wiskey-overview')).toHaveCount(0);
      // the embedded panel going to "users" by itself (a hub link) does not swap the embed out under the user: the
      // address keeps its path and mirrors the location only
      await expect(page.locator(FRAME)).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
      await page.locator('sw-tabs a[href="#/wiskey/devices"]').click();
      await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'devices');
      await panelFrame(page).evaluate(() => {
        const panel = document.querySelector('home-assistant')!.shadowRoot!.querySelector('home-assistant-main')!.shadowRoot!.querySelector('hikvision-intercom-panel') as HTMLElement & { loc: unknown; _tab: string; post(m: unknown): void };
        panel.loc = { tab: 'users', tool: null };
        panel._tab = 'users';
        panel.post({ type: 'wiskey:location', tab: 'users', tool: null });
      });
      await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'users');
      await expect.poll(() => hash(page)).toBe('#/wiskey/devices?wiskey_tab=users');
      await expect(page.locator('wiskey-embed')).toHaveCount(1);
      await expect(page.locator('wiskey-people')).toHaveCount(0);
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
      await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'users', { timeout: 30000 });
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
      const s1 = await stubPanel(p1, { kiosk: true, panels: true, api: 'v1' });
      await open(p1, '/live');
      await expect(p1.locator('sw-app nav.rail a[href="#/explore/sites"]')).toHaveCount(1, { timeout: 30000 });
      await expect(p1.locator('sw-app nav.rail a[href^="#/wiskey/"]')).toHaveCount(0);
      for (const seg of ['sync', 'overview', 'camera_wall']) {
        await open(p1, `/wiskey/${seg}`);
        await expect(p1.locator('wiskey-embed sw-state-panel[data-wiskey-state="no_permission"]')).toBeVisible({ timeout: 30000 });
        await expect(p1.locator(FRAME)).toHaveCount(0);
        await expect(p1.locator('sw-tabs a[href^="#/wiskey/"]')).toHaveCount(0);
      }
      expect(s1.hits).toEqual([]);
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
      await stubPanel(p2, { kiosk: true, panels: true, api: 'v1' });
      await open(p2, '/wiskey/health');
      await expect(p2.locator('wiskey-embed sw-state-panel[data-wiskey-state="no_permission"]')).toBeVisible({ timeout: 30000 });
      await expect(p2.locator('sw-tabs a[href="#/wiskey/health"]')).toHaveCount(0);
      await c2.close();

      // 3. an installation-wide viewer: the embed loads and the catalog's tabs are offered
      const viewer = `wiskeyembviewer${tag}`;
      await bind(viewer, 'viewer');
      const c3 = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': viewer } });
      const p3 = await c3.newPage();
      await stubPanel(p3, { kiosk: true, panels: true, api: 'v1' });
      await open(p3, '/wiskey/sync');
      await expect(p3.locator(FRAME)).toHaveAttribute('data-embed-mode', 'v1', { timeout: 30000 });
      await expect(p3.locator('sw-tabs a[href^="#/wiskey/"]')).toHaveCount(FAKE_CATALOG.tabs.length);
      await c3.close();
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      if (roleId) await request.delete(`/api/v1/access/roles/${roleId}`).catch(() => {});
      if (siteId) await request.delete(`/api/v1/sites/${siteId}`).catch(() => {});
    }
    void page;
  });

  test('both phone navigations reach the embedded WisKey tabs built from the catalog', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'nav.bottom only renders below the 768px breakpoint');
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    // design A: WisKey is a direct icon of the bottom bar; its tab row carries the catalog's tabs
    await open(page, '/live', 'a');
    const bottom = page.locator('sw-app nav.bottom');
    await expect(bottom).toBeVisible({ timeout: 30000 });
    await bottom.locator('a[href="#/wiskey/overview"]').click();
    await expect(page.locator(FRAME)).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await expect(page.locator('sw-tabs a[href="#/wiskey/camera_wall"]')).toHaveCount(1);
    await page.locator('sw-tabs a[href="#/wiskey/sync"]').click();
    await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'sync');
    expect((await frameState(page)).tab).toBe('sync');
    await expectFrameFillsStage(page); // the frame fills its box exactly on mobile too
    await page.screenshot({ path: testInfo.outputPath('wiskey-embed-phone-a.png') });

    // design B: WisKey sits behind "עוד"
    await open(page, '/live', 'b');
    await expect(bottom).toBeVisible({ timeout: 30000 });
    await bottom.locator('button').click();
    await page.locator('sw-app .bottom-overflow a[href="#/wiskey/overview"]').click();
    await expect(page.locator(FRAME)).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await page.locator('sw-tabs a[href="#/wiskey/camera_wall"]').click();
    await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'camera_wall');
    const st = await frameState(page);
    expect(st.tab).toBe('camera_wall');
    expect(st.kioskEvents).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('wiskey-embed-phone-b.png') });
    // the "עוד" sheet stays open while WisKey moves by itself (the mirror is not a navigation of the user's)
    await bottom.locator('button').click();
    await expect(page.locator('sw-app .bottom-overflow')).toBeVisible();
    await panelFrame(page).evaluate(() => {
      const panel = document.querySelector('home-assistant')!.shadowRoot!.querySelector('home-assistant-main')!.shadowRoot!.querySelector('hikvision-intercom-panel') as HTMLElement & { post(m: unknown): void };
      panel.post({ type: 'wiskey:location', tab: 'devices', tool: null });
    });
    await expect.poll(() => hash(page)).toBe('#/wiskey/devices?wiskey_tab=devices');
    await expect(page.locator('sw-app .bottom-overflow')).toBeVisible();
  });
});
