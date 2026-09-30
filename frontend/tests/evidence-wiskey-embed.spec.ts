import { test, expect, request as pwRequest, type Frame, type Page, type Route } from '@playwright/test';
import { setAccessUi, setWiskeySize, type AccessUi, type WiskeySizeSetting } from './wiskey-ui-mode';
import { FAKE_CATALOG, PANEL_URL, stubPanel, type FakeCatalog } from './wiskey-fake-ha';

// Evidence for the embedded WisKey panel (CR-005 recorded decision 2026-09-28): the WisKey area shows WisKey's own
// Home Assistant panel (/hikvision-intercom) in a same-origin frame by default, הגדרות › בקרות כניסה switches each of
// the three screens SMPLWISE built back to its own screen, and WisKey's other screens are embedded-only tabs.
//
// WisKey embed API v1 (WisKey 2.0.0-rc.19, docs/integrations/wiskey/embed-api-v1/): the frame opens
// `/hikvision-intercom?embed=1&chrome=none&tab=…&tool=…`, the tab row is built from `wiskey:ready`, a tab click is a
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

/** Owner notes 2026-09-30: the embed is the frame and nothing else - no bar, no refresh / enlarge / new-window controls,
 * no title strip, no status row while the panel is healthy. (The tools row of ניהול is a strip of its own, counted apart.) */
async function expectNothingAroundFrame(page: Page) {
  await expect(page.locator('wiskey-embed [data-wiskey-embed-bar], wiskey-embed [data-wiskey-embed-refresh], wiskey-embed [data-wiskey-expand], wiskey-embed [data-wiskey-embed-full], wiskey-embed [data-wiskey-embed-title]:not(iframe)')).toHaveCount(0);
  const n = await page.locator('wiskey-embed').evaluate((embed: HTMLElement) => embed.shadowRoot!.querySelectorAll('.bar, sw-button, a.full, sw-tabs, [data-wiskey-embed-status]').length);
  expect(n).toBe(0);
}

/** The frame against the shell's content area: `<main>`'s edges, the `.screen` box, the bottom edge / the phone's bottom
 * bar, and every scroll container that could give a second scrollbar. */
async function layoutOf(page: Page) {
  return page.locator('wiskey-embed').evaluate((embed: HTMLElement) => {
    const sr = embed.getRootNode() as ShadowRoot;
    const main = sr.querySelector('main')!;
    const screen = main.querySelector(':scope > .screen')!;
    const f = embed.shadowRoot!.querySelector('iframe')!;
    const fr = f.getBoundingClientRect();
    const mr = main.getBoundingClientRect();
    const sc = screen.getBoundingClientRect();
    const bottom = sr.querySelector('nav.bottom') as HTMLElement | null;
    const bottomShown = !!bottom && getComputedStyle(bottom).display !== 'none';
    const root = document.documentElement;
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      frame: { left: fr.left, right: fr.right, top: fr.top, bottom: fr.bottom, width: fr.width, height: fr.height },
      screen: { top: sc.top, bottom: sc.bottom },
      main: { left: mr.left, right: mr.right, bottom: mr.bottom, scrolls: main.scrollHeight > main.clientHeight + 1 },
      bottomTop: bottomShown ? bottom!.getBoundingClientRect().top : null,
      pageScrolls: root.scrollHeight > window.innerHeight + 1 || root.scrollWidth > window.innerWidth + 1,
      inner: { w: f.contentWindow!.innerWidth, h: f.contentWindow!.innerHeight }, // what WisKey's layout reads
      bars: embed.shadowRoot!.querySelectorAll('.bar, sw-button, a.full, sw-tabs, [data-wiskey-embed-status]').length,
    };
  });
}

async function expectFrameFillsContentArea(page: Page, scale = 1) {
  const l = await layoutOf(page);
  const near = (a: number, b: number, tol = 1) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
  near(l.frame.left, l.main.left); // edge to edge, both sides
  near(l.frame.right, l.main.right);
  near(l.frame.bottom, l.screen.bottom); // down to the end of the shell's screen box ...
  near(l.frame.bottom, l.bottomTop ?? l.vh); // ... which is the bottom edge, or the top of the phone's bottom bar
  expect(l.frame.top).toBeGreaterThanOrEqual(l.screen.top - 1);
  // the panel's own viewport is the whole frame - or, in the scaled size, the frame's box before the scale (1/scale larger)
  near(l.inner.h * scale, l.frame.height, scale < 1 ? 2 : 1);
  near(l.inner.w * scale, l.frame.width, scale < 1 ? 2 : 1);
  expect(l.main.scrolls).toBe(false); // no scroll container gives the frame less than it shows
  expect(l.pageScrolls).toBe(false);
  return l;
}

let saved: AccessUi | null = null;
let savedSize: WiskeySizeSetting | null = null;

test.describe('the embedded WisKey panel (CR-005 recorded decision 2026-09-28)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE === '1', 'set SW_LIVE=1 with a plain backend running (no WisKey fixture)');
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({}, testInfo) => {
    // start from the default for every screen (the embed), and put the owner's choice back at the end
    saved = await setAccessUi(testInfo.project.use.baseURL, { 'access.ui.overview': 'wiskey', 'access.ui.events': 'wiskey', 'access.ui.people': 'wiskey' });
    savedSize = await setWiskeySize(testInfo.project.use.baseURL, { 'ui.wiskey_size': 'normal', 'ui.wiskey_scale': '90' }); // the default size
  });
  test.afterAll(async ({}, testInfo) => {
    if (saved && Object.keys(saved).length) await setAccessUi(testInfo.project.use.baseURL, saved);
    if (savedSize) await setWiskeySize(testInfo.project.use.baseURL, savedSize);
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
    expect(hits).toEqual([`${origin}/hikvision-intercom?embed=1&chrome=none&tab=users`]); // the origin, never the Ingress path
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'users');
    await expect(page.locator('wiskey-people')).toHaveCount(0);

    // the tab row: exactly the catalog's top-level screens, WisKey's labels, SMPLWISE's `people` segment for `users`
    const tabs = page.locator('sw-tabs a[href^="#/wiskey/"]');
    await expect(tabs).toHaveCount(FAKE_CATALOG.tabs.length);
    expect(await tabs.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['#/wiskey/overview', '#/wiskey/people', '#/wiskey/devices', '#/wiskey/events', '#/wiskey/sync', '#/wiskey/tools', '#/wiskey/camera_wall']);
    expect(await tabs.allTextContents()).toEqual(FAKE_CATALOG.tabs.map((t) => t.label));
    await expect(activeTab(page)).toHaveAttribute('href', '#/wiskey/people');
    // the panel's title, as text; the confirmed location mirrored into SMPLWISE's own address
    // (owner notes 2026-09-30: no visible title strip; the title is the frame's accessible name and a data attribute)
    await expect(frame).toHaveAttribute('data-wiskey-embed-title', 'אנשים ב-WisKey');
    await expect(frame).toHaveAttribute('title', 'WisKey · אנשים ב-WisKey');
    await expect.poll(() => hash(page)).toBe('#/wiskey/people?wiskey_tab=users');
    // WisKey handles HA's sidebar itself: SMPLWISE dispatched nothing, injected nothing, called no panel method
    const st = await frameState(page);
    expect(st.kioskEvents).toBe(0);
    expect(st.injected).toBe(false);
    expect(st.navigates).toBe(0);
    expect(st.marker).toBe('1');
    await expect(page.locator('wiskey-embed [data-wiskey-embed-note="legacy"]')).toHaveCount(0);
    // nothing above the frame (owner notes 2026-09-30): no bar, no refresh / enlarge / new-window controls, no title strip
    await expectNothingAroundFrame(page);
    await expect(frame).toHaveAttribute('allow','autoplay; microphone; camera; fullscreen; clipboard-write');
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
    await expect(frame).toHaveAttribute('data-wiskey-embed-title', 'וידאו, שמע והכרזות');
    await expect(activeTab(page)).toHaveAttribute('href', '#/wiskey/tools');
    await expect(page.locator('wiskey-embed nav[data-wiskey-tools] a[aria-current="page"]')).toHaveAttribute('data-wiskey-tool', 'media_options');
    st = await frameState(page);
    expect(st.search).toBe('?embed=1&chrome=none&tab=tools&tool=media_options'); // WisKey keeps its own URL canonical
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
    await expect(frame).toHaveAttribute('data-wiskey-embed-title', 'עמדות');
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
    expect(hits[1]).toMatch(/\/hikvision-intercom\?embed=1&chrome=none&tab=sync$/); // WisKey's own replaced URL
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
  test('v1: leaving the module removes the frame; coming back reopens the last confirmed location (there is no refresh control any more)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    const { hits } = await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    await open(page, '/wiskey/tools/media_options');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await expect(frame).toHaveAttribute('data-confirmed-tool', 'media_options');
    // owner notes 2026-09-30: "רענן" is gone from the embed (a deliberate reload is only offered by the failure states)
    await expect(page.locator('wiskey-embed [data-wiskey-embed-refresh]')).toHaveCount(0);
    expect(hits).toHaveLength(1);

    // module exit: the frame is gone (WisKey's page unloaded)
    await page.evaluate(() => (location.hash = '#/live'));
    await expect(page.locator('wiskey-embed')).toHaveCount(0);
    await expect.poll(() => page.frames().filter((f) => PANEL_URL.test(f.url())).length).toBe(0);
    // back: a new frame on the last confirmed location (the address carries the mirror)
    await page.goBack();
    await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    expect(hits).toHaveLength(2);
    expect(hits[1]).toMatch(/\/hikvision-intercom\?embed=1&chrome=none&tab=tools&tool=media_options$/);
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
    await expect(frame).toHaveAttribute('src', /\/hikvision-intercom\?embed=1&chrome=none&tab=overview$/, { timeout: 30000 });
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
    await expect(page.locator('wiskey-embed [data-wiskey-embed-note]')).toHaveCount(0); // a healthy older build: nothing shown over the frame
    st = await frameState(page);
    expect(st.kiosk).toBe(true);
    expect(st.injected).toBe(false); // the official lever took, so no DOM hack
    expect(st.tab).toBe('overview');
    expect(st.received).toEqual([]); // nothing was posted to an older panel
    await expect(page.locator('wiskey-embed a[data-wiskey-embed-full]')).toHaveCount(0); // only the failure states offer the new-window link
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
    await expect(page.locator(FRAME)).toHaveAttribute('src', /\/hikvision-intercom\?embed=1&chrome=none&tab=users$/, { timeout: 30000 });
    // (the frame's address commits a moment after its src is assigned: a poll that throws on "no frame yet" is a race)
    await expect.poll(async () => { try { return (await frameState(page)).tab; } catch { return null; } }, { timeout: LEGACY_MS }).toBe('users');
    expect((await frameState(page)).navigates).toBe(1); // one call, after the panel's session loaded - no retry storm
    for (const [seg, tab] of [['events', 'events'], ['devices', 'devices'], ['health', 'health'], ['audit', 'audit'], ['tools', 'tools']]) {
      await open(page, `/wiskey/${seg}`);
      await expect(page.locator(FRAME)).toHaveAttribute('src', new RegExp(`/hikvision-intercom\\?embed=1&chrome=none&tab=${tab}$`), { timeout: 30000 });
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

  // WisKey rc.25 panel.ts fitWall (wiskey appearance): the cards per page for a frame of this size (their step function,
  // not ours - recorded only to show what the frame's size means to the panel)
  const wiskeyCapacity = (w: number, hgt: number) => (w < 700 ? 4 : w < 980 ? (hgt < 760 ? 4 : 6) : w < 1200 ? (hgt < 820 ? 6 : 9) : hgt < 800 ? 4 : hgt < 880 ? 8 : 12);

  test('layout: the frame is the whole content area at 1440×900 and 1920×1080, follows a window resize, and has no second scrollbar (owner notes 2026-09-30)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only; the phone layout is in the phone test below');
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    await open(page, '/wiskey/camera_wall');
    const frame = page.locator(FRAME);
    await expect(frame).toHaveAttribute('data-confirmed-tab', 'camera_wall', { timeout: 15000 });
    await expectNothingAroundFrame(page);

    for (const [w, h] of [
      [1440, 900],
      [1920, 1080],
      [1440, 900],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      // the frame follows the window: poll until the stage has taken the new size
      await expect.poll(async () => Math.round((await layoutOf(page)).frame.bottom), { timeout: 5000 }).toBe(h);
      const l = await expectFrameFillsContentArea(page);
      expect(l.frame.width).toBeGreaterThanOrEqual(w - 260); // the rail is the only thing beside it (72-256 px)
      expect(l.frame.top).toBeGreaterThan(0); // below the tab row, never over the shell
      expect(Math.abs(l.frame.top - l.screen.top)).toBeLessThanOrEqual(1); // nothing between the tab row and the frame
      testInfo.annotations.push({ type: `frame ${w}×${h}`, description: `frame ${Math.round(l.frame.width)}×${Math.round(l.frame.height)} at y=${Math.round(l.frame.top)} → WisKey rc.25 capacity ${wiskeyCapacity(l.frame.width, l.frame.height)}` });
      if (w === 1920) await page.screenshot({ path: testInfo.outputPath('wiskey-embed-layout-1920.png') });
    }
    await page.screenshot({ path: testInfo.outputPath('wiskey-embed-layout-1440.png') });
    await expectFrameFillsStage(page);
  });

  test('layout: the alert banner takes its own strip and the frame still reaches the bottom edge without a scrollbar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await page.route('**/api/v1/health/summary', (route: Route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', items: [{ id: 'nvr', status: 'error', label: 'מקליט לא זמין' }], checked_at: new Date().toISOString(), version: 'test' }) }),
    );
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    await open(page, '/wiskey/overview');
    await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'overview', { timeout: 15000 });
    const banner = page.locator('sw-app [data-sys-banner]');
    await expect(banner).toBeVisible();
    const l = await expectFrameFillsContentArea(page);
    const b = await banner.boundingBox();
    expect(l.frame.top).toBeGreaterThanOrEqual(b!.y + b!.height - 1); // the frame never sits under the banner
    await page.screenshot({ path: testInfo.outputPath('wiskey-embed-layout-banner.png') });
  });

  test('a framed document that declares color-scheme: dark is left alone - matching it on the iframe would hide its default-coloured text (measured, not implemented)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1', colorScheme: 'dark' }); // a dark theme's document with a transparent body
    await open(page, '/wiskey/overview');
    await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'overview', { timeout: 15000 });
    const pixel = async () => {
      const box = (await page.locator(FRAME).boundingBox())!;
      const b64 = (await page.screenshot({ clip: { x: box.x + 600, y: box.y + 300, width: 4, height: 4 } })).toString('base64');
      return page.evaluate(async (data) => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0);
        return Array.from(g.getImageData(1, 1, 1, 1).data).slice(0, 3);
      }, b64);
    };
    // the mismatch (light shell, dark document) gives the frame an opaque dark canvas: this is the mechanism behind a
    // dark area inside the frame, and it is the document's own
    expect(await pixel()).toEqual([18, 18, 18]);
    expect(await page.locator(FRAME).evaluate((f: HTMLElement) => f.style.colorScheme)).toBe(''); // we set nothing on the frame (it inherits the light shell's)
    // matching it would make the canvas transparent (white here) - and the document's default light text vanishes on it
    await page.locator(FRAME).evaluate((f: HTMLElement) => (f.style.colorScheme = 'dark'));
    await expect.poll(pixel).toEqual([255, 255, 255]);
    await page.screenshot({ path: '../docs/evidence/UIR1-wiskey/cs-matched-text-vanishes.png', clip: { x: 0, y: 160, width: 500, height: 120 } });
  });

  test('layout: the WisKey tools row (ניהול) is the only strip above the frame, and the frame still fills the rest', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    await open(page, '/wiskey/tools');
    await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'tools', { timeout: 15000 });
    await expect(page.locator('wiskey-embed nav[data-wiskey-tools]')).toBeVisible();
    await expectFrameFillsContentArea(page);
    const l = await layoutOf(page);
    expect(l.bars).toBe(0); // no bar, no refresh / enlarge / new-window controls, even with the tools row
  });

  // ------------------------------------------------------------------ "גודל תצוגת WisKey" (ui.wiskey_size, owner 2026-09-30)

  /** The shell parts the full-screen size must cover and make inert: the rail, the tab row, the floating corner (search
   * button + status dot, and the search scrim), the alert banner, the phone bottom bar. */
  const SHELL_PARTS = ['nav.rail', 'main > .subnav', '.float', '[data-sys-pill]', '[data-search-open]', '[data-search-scrim]', '.sysbanner', 'nav.bottom'];

  const sizeOf = (page: Page) => page.locator('wiskey-embed').getAttribute('data-size');

  /** A click recorder inside the panel's document: where the panel itself sees a pointer press (its own coordinates). */
  async function recordClicks(page: Page) {
    await panelFrame(page).evaluate(() => {
      const w = window as unknown as { __clicks: number[][] };
      w.__clicks = [];
      document.addEventListener('click', (e) => w.__clicks.push([e.clientX, e.clientY]));
    });
  }
  const clicksOf = (page: Page) => panelFrame(page).evaluate(() => (window as unknown as { __clicks: number[][] }).__clicks);

  test('size "מותאם": the frame is rendered 1/scale larger and scaled down; the wrapper still fills the content area, clicks land where they should, WisKey sees a bigger frame', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only; the phone is below');
    test.setTimeout(120_000);
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    const base = testInfo.project.use.baseURL;
    const table: string[] = [];
    // the reference: the normal size at both screens (what WisKey sees today)
    await setWiskeySize(base, { 'ui.wiskey_size': 'normal' });
    for (const [w, h] of [[1440, 900], [1920, 1080]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await open(page, '/wiskey/overview');
      await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'overview', { timeout: 15000 });
      await expect.poll(() => sizeOf(page)).toBe('normal');
      const l = await expectFrameFillsContentArea(page);
      table.push(`${w}×${h} normal: wrapper ${Math.round(l.frame.width)}×${Math.round(l.frame.height)}, WisKey sees ${l.inner.w}×${l.inner.h} → ${wiskeyCapacity(l.inner.w, l.inner.h)} cards`);
    }
    for (const scale of ['100', '90', '80', '70'] as const) {
      await setWiskeySize(base, { 'ui.wiskey_size': 'fit', 'ui.wiskey_scale': scale });
      const s = Number(scale) / 100;
      for (const [w, h] of [[1440, 900], [1920, 1080]] as const) {
        await page.setViewportSize({ width: w, height: h });
        await open(page, '/wiskey/overview');
        await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'overview', { timeout: 15000 });
        await expect.poll(() => sizeOf(page)).toBe(scale === '100' ? 'normal' : 'fit'); // 100% is the normal size
        const l = await expectFrameFillsContentArea(page, s); // the visible wrapper is exactly the content area, no double scrollbar
        await expectNothingAroundFrame(page);
        if (scale !== '100') {
          expect(l.inner.h).toBeGreaterThan(l.frame.height); // WisKey's box is bigger than what is shown
          expect(Math.abs(l.inner.h - Math.round(l.frame.height / s))).toBeLessThanOrEqual(2);
          // pointer coordinates: a press at (x, y) in the wrapper is (x / scale, y / scale) inside WisKey's own document
          await recordClicks(page);
          const box = (await page.locator(FRAME).boundingBox())!;
          await page.mouse.click(box.x + 300, box.y + 200);
          const [[cx, cy]] = await clicksOf(page);
          expect(Math.abs(cx - 300 / s)).toBeLessThanOrEqual(2);
          expect(Math.abs(cy - 200 / s)).toBeLessThanOrEqual(2);
        }
        table.push(`${w}×${h} fit ${scale}%: wrapper ${Math.round(l.frame.width)}×${Math.round(l.frame.height)}, WisKey sees ${l.inner.w}×${l.inner.h} → ${wiskeyCapacity(l.inner.w, l.inner.h)} cards`);
        if (scale === '90' && w === 1440) await page.screenshot({ path: '../docs/evidence/UIR1-wiskey/wiskey-embed-fit-90-1440.png' });
      }
    }
    for (const row of table) testInfo.annotations.push({ type: 'cards', description: row });
    await setWiskeySize(base, { 'ui.wiskey_size': 'normal', 'ui.wiskey_scale': '90' });
  });

  test('size "מסך מלא": the panel covers the whole viewport with one small exit control; the exit button and Esc leave it for this visit, the next visit is full again', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only; the phone is below');
    test.setTimeout(90_000);
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    const base = testInfo.project.use.baseURL;
    await setWiskeySize(base, { 'ui.wiskey_size': 'full' });
    const cards: string[] = [];
    for (const [w, h] of [[1440, 900], [1920, 1080]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await open(page, '/wiskey/overview');
      await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'overview', { timeout: 15000 });
      await expect(page.locator('wiskey-embed')).toHaveAttribute('data-size', 'full');
      const g = await page.locator('wiskey-embed').evaluate((embed: HTMLElement, parts: string[]) => {
        const sr = embed.getRootNode() as ShadowRoot;
        const r = embed.getBoundingClientRect();
        const f = embed.shadowRoot!.querySelector('iframe')!;
        const fr = f.getBoundingClientRect();
        const ex = embed.shadowRoot!.querySelectorAll('button.exit');
        const eb = ex[0]?.getBoundingClientRect();
        // what is on top at the rail, the top bar and the corner: always the embed
        const on = (x: number, y: number) => !!sr.elementFromPoint(x, y)?.closest('wiskey-embed');
        return {
          embed: [r.left, r.top, r.width, r.height],
          frame: [fr.left, fr.top, fr.width, fr.height],
          inner: [f.contentWindow!.innerWidth, f.contentWindow!.innerHeight],
          exits: ex.length,
          exit: eb ? [eb.left, eb.top, eb.width, eb.height] : null,
          covers: [on(window.innerWidth - 30, 200), on(30, 30), on(window.innerWidth / 2, 20), on(window.innerWidth - 30, window.innerHeight - 30)],
          shell: parts.flatMap((s) => {
            const el = sr.querySelector(s) as HTMLElement | null;
            if (!el) return []; // only the parts that exist right now are judged
            const b = el.getBoundingClientRect();
            const shown = b.width > 0 && b.height > 0;
            return [{ sel: s, inert: !!el.closest('[inert]'), covered: shown ? !!sr.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest('wiskey-embed') : null }];
          }),
          scrolls: document.documentElement.scrollHeight > window.innerHeight + 1 || document.documentElement.scrollWidth > window.innerWidth + 1,
        };
      }, SHELL_PARTS);
      expect(g.embed).toEqual([0, 0, w, h]);
      expect(g.frame).toEqual([0, 0, w, h]);
      expect(g.inner).toEqual([w, h]);
      expect(g.exits).toBe(1); // one control, nothing else
      expect(g.exit![2]).toBeLessThanOrEqual(32);
      expect(g.exit![3]).toBeLessThanOrEqual(32);
      expect(g.exit![1]).toBeLessThan(40); // a top corner
      expect(g.exit![0] < 60 || g.exit![0] + g.exit![2] > w - 60).toBe(true);
      expect(g.covers).toEqual([true, true, true, true]); // rail, top bar, tab row, bottom-corner: all covered
      // every shell part that exists is inert (Tab never reaches it) and, when it has a box, under the panel - design A's
      // floating corner cluster (search + status dot) and the alert banner included, not floating above the panel
      const present = g.shell.map((x) => x.sel);
      expect(present).toEqual(expect.arrayContaining(['nav.rail', '.float']));
      for (const x of g.shell) {
        expect(x.inert, `${x.sel} is inert`).toBe(true);
        if (x.covered !== null) expect(x.covered, `${x.sel} is covered by the panel`).toBe(true);
      }
      expect(g.scrolls).toBe(false);
      await expectNothingAroundFrame(page);
      cards.push(`${w}×${h} full: WisKey sees ${g.inner[0]}×${g.inner[1]} → ${wiskeyCapacity(g.inner[0], g.inner[1])} cards`);
      if (w === 1440) await page.screenshot({ path: '../docs/evidence/UIR1-wiskey/wiskey-embed-full-1440.png' });
    }
    for (const row of cards) testInfo.annotations.push({ type: 'cards', description: row });

    // the exit control gives the shell back (for this visit)
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/wiskey/overview');
    await expect(page.locator('wiskey-embed')).toHaveAttribute('data-size', 'full', { timeout: 15000 });
    await page.locator('wiskey-embed button[data-wiskey-exit]').click();
    await expect(page.locator('wiskey-embed')).toHaveAttribute('data-size', 'normal');
    await expect(page.locator('wiskey-embed button[data-wiskey-exit]')).toHaveCount(0);
    await expectFrameFillsContentArea(page);
    const inertAfter = await page.locator('wiskey-embed').evaluate((embed: HTMLElement, parts: string[]) => parts.flatMap((s) => { const el = (embed.getRootNode() as ShadowRoot).querySelector(s) as HTMLElement | null; return el ? [{ sel: s, inert: !!el.closest('[inert]') }] : []; }), SHELL_PARTS);
    expect(inertAfter.length).toBeGreaterThan(1);
    expect(inertAfter.filter((x) => x.inert)).toEqual([]); // the shell is given back whole
    await expect(page.locator('sw-tabs a[href="#/wiskey/devices"]')).toBeVisible(); // the tab row is back
    // another tab in the same visit stays normal; leaving the area and coming back is full again
    await page.locator('sw-tabs a[href="#/wiskey/devices"]').click();
    await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'devices');
    await expect(page.locator('wiskey-embed')).toHaveAttribute('data-size', 'normal');
    await page.evaluate(() => (location.hash = '#/live'));
    await expect(page.locator('wiskey-embed')).toHaveCount(0);
    await page.evaluate(() => (location.hash = '#/wiskey/overview'));
    await expect(page.locator('wiskey-embed')).toHaveAttribute('data-size', 'full', { timeout: 15000 });

    // Esc leaves it too
    await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'overview', { timeout: 15000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('wiskey-embed')).toHaveAttribute('data-size', 'normal');
    await setWiskeySize(base, { 'ui.wiskey_size': 'normal' });
  });

  test('size on a phone: "מסך מלא" covers the bottom bar too, "מותאם" still fills the area above it', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'phone only');
    test.setTimeout(90_000);
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    const base = testInfo.project.use.baseURL;
    await setWiskeySize(base, { 'ui.wiskey_size': 'fit', 'ui.wiskey_scale': '80' });
    await open(page, '/wiskey/overview');
    await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'overview', { timeout: 15000 });
    await expect(page.locator('wiskey-embed')).toHaveAttribute('data-size', 'fit');
    const l = await expectFrameFillsContentArea(page, 0.8);
    expect(l.bottomTop).not.toBeNull();
    testInfo.annotations.push({ type: 'cards', description: `phone fit 80%: wrapper ${Math.round(l.frame.width)}×${Math.round(l.frame.height)}, WisKey sees ${l.inner.w}×${l.inner.h} → ${wiskeyCapacity(l.inner.w, l.inner.h)} cards` });
    await page.screenshot({ path: '../docs/evidence/UIR1-wiskey/wiskey-embed-fit-phone.png' });

    await setWiskeySize(base, { 'ui.wiskey_size': 'full' });
    await open(page, '/wiskey/overview');
    await expect(page.locator('wiskey-embed')).toHaveAttribute('data-size', 'full', { timeout: 15000 });
    const g = await page.locator('wiskey-embed').evaluate((embed: HTMLElement) => {
      const sr = embed.getRootNode() as ShadowRoot;
      const f = embed.shadowRoot!.querySelector('iframe')!.getBoundingClientRect();
      const bn = sr.querySelector('nav.bottom')!.getBoundingClientRect();
      return { frame: [f.left, f.top, f.width, f.height], vw: innerWidth, vh: innerHeight, bottomCovered: !!sr.elementFromPoint(bn.left + bn.width / 2, bn.top + bn.height / 2)?.closest('wiskey-embed') };
    });
    expect(g.frame).toEqual([0, 0, g.vw, g.vh]); // (a plain browser has no safe-area insets)
    expect(g.bottomCovered).toBe(true);
    await page.screenshot({ path: '../docs/evidence/UIR1-wiskey/wiskey-embed-full-phone.png' });
    await page.locator('wiskey-embed button[data-wiskey-exit]').click();
    await expect(page.locator('wiskey-embed')).toHaveAttribute('data-size', 'normal');
    await setWiskeySize(base, { 'ui.wiskey_size': 'normal', 'ui.wiskey_scale': '90' });
  });

  test('הגדרות › "גודל תצוגת WisKey": three values, the scale choice only with "מותאם" (default 90%), saved installation-wide', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await open(page, '/system/diagnostics?tab=media');
    const size = page.locator('system-diagnostics [data-set-wiskey-size]');
    await expect(size).toBeVisible({ timeout: 30000 });
    expect(await size.locator('option').allTextContents()).toEqual(['רגיל', 'מותאם', 'מסך מלא']);
    await expect(size).toHaveValue('normal'); // the default stays "רגיל"
    await expect(page.locator('system-diagnostics [data-set-wiskey-scale]')).toHaveCount(0);
    await size.selectOption('fit');
    const scale = page.locator('system-diagnostics [data-set-wiskey-scale]');
    await expect(scale).toBeVisible();
    expect(await scale.locator('option').allTextContents()).toEqual(['100%', '90%', '80%', '70%']);
    await expect(scale).toHaveValue('90'); // the default scale
    await scale.selectOption('80');
    await page.locator('system-diagnostics .foot sw-button[variant="primary"] button').first().click();
    await expect.poll(async () => { const s = (await (await request.get('/api/v1/settings')).json()).settings; return `${s['ui.wiskey_size']}/${s['ui.wiskey_scale']}`; }).toBe('fit/80');
    await setWiskeySize(testInfo.project.use.baseURL, { 'ui.wiskey_size': 'normal', 'ui.wiskey_scale': '90' });
  });

  test('rc.37 הגדרות › מדיה: the installation defaults for the overview cards and the camera wall (default: automatic), saved installation-wide', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    const base = testInfo.project.use.baseURL;
    await setWiskeyView(base, { install: ['auto', 'auto'], own: [null, null] });
    try {
      await open(page, '/system/diagnostics?tab=media');
      const density = page.locator('system-diagnostics [data-set-wiskey-density]');
      const wall = page.locator('system-diagnostics [data-set-wiskey-wall]');
      await expect(density).toBeVisible({ timeout: 30000 });
      expect(await density.locator('option').allTextContents()).toEqual(['אוטומטי', '4', '6', '8', '9', '12']);
      expect(await wall.locator('option').allTextContents()).toEqual(['ברירת מחדל', '4', '9', '12']);
      await expect(density).toHaveValue('auto');
      await expect(wall).toHaveValue('auto');
      await density.selectOption('9');
      await wall.selectOption('12');
      await page.locator('system-diagnostics .foot sw-button[variant="primary"] button').first().click();
      await expect.poll(async () => { const s = (await (await request.get('/api/v1/settings')).json()).settings; return `${s['ui.wiskey_density']}/${s['ui.wiskey_wall']}`; }).toBe('9/12');
      // and the next opening of WisKey carries them (no choice of the user's own)
      const { hits } = await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
      await open(page, '/wiskey/camera_wall');
      await expect(page.locator(FRAME)).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
      expect(new URL(hits[hits.length - 1]).search).toBe('?embed=1&chrome=none&tab=camera_wall&density=9&wall=12');
    } finally {
      await setWiskeyView(base, { install: ['auto', 'auto'], own: [null, null] });
    }
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
      await expect(people.locator('option')).toHaveText(['WisKey (מוטמע)', 'Arx']);
      // the section names the embed API and the fallback for older WisKey builds
      await expect(page.locator('system-diagnostics [data-access-ui-embed-api]')).toContainText('2.0.0-rc.19');
      await expect(page.locator('system-diagnostics [data-access-ui-embed-api]')).toContainText('לשיטה הקודמת');
      // the section says plainly that inside the embed door release and people edits bypass SMPLWISE's confirmation and audit
      await expect(page.locator('system-diagnostics [data-access-ui-warning]')).toContainText('לפתוח דלתות');
      await expect(page.locator('system-diagnostics [data-access-ui-warning]')).toContainText('בלי רישום באודיט של Arx');
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

  test('the phone bottom bar reaches the embedded WisKey tabs built from the catalog', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'nav.bottom only renders below the 768px breakpoint');
    await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    // WisKey is a direct icon of the bottom bar; its tab row carries the catalog's tabs
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
    // owner notes 2026-09-30: edge to edge, down to the top of the bottom bar, nothing above it, no second scrollbar
    await expectNothingAroundFrame(page);
    const pl = await expectFrameFillsContentArea(page);
    expect(pl.bottomTop).not.toBeNull();
    expect(Math.abs(pl.frame.top - pl.screen.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(pl.frame.width - pl.vw)).toBeLessThanOrEqual(1);
    testInfo.annotations.push({ type: 'phone frame', description: `frame ${Math.round(pl.frame.width)}×${Math.round(pl.frame.height)} at y=${Math.round(pl.frame.top)} of ${pl.vh}, bottom bar at y=${Math.round(pl.bottomTop!)}` });
    await page.screenshot({ path: testInfo.outputPath('wiskey-embed-phone-a.png') });
    // a short window (a phone on its side, the keyboard up): the frame shrinks with it - no minimum height, no scrollbar
    const full = page.viewportSize()!;
    await page.setViewportSize({ width: 700, height: 340 });
    await expect.poll(async () => Math.round((await layoutOf(page)).vh), { timeout: 5000 }).toBe(340);
    await expect.poll(async () => (await layoutOf(page)).frame.height, { timeout: 5000 }).toBeLessThan(340);
    await expectFrameFillsContentArea(page);
    await page.setViewportSize(full);

    // and again from the start: the bar's WisKey icon, then a tab the catalog names
    await open(page, '/live', 'a');
    await expect(bottom).toBeVisible({ timeout: 30000 });
    await bottom.locator('a[href="#/wiskey/overview"]').click();
    await expect(page.locator(FRAME)).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
    await page.locator('sw-tabs a[href="#/wiskey/camera_wall"]').click();
    await expect(page.locator(FRAME)).toHaveAttribute('data-confirmed-tab', 'camera_wall');
    const st = await frameState(page);
    expect(st.tab).toBe('camera_wall');
    expect(st.kioskEvents).toBe(0);
    // WisKey moves by itself: the mirror follows into the address (it is not a navigation of the user's)
    await panelFrame(page).evaluate(() => {
      const panel = document.querySelector('home-assistant')!.shadowRoot!.querySelector('home-assistant-main')!.shadowRoot!.querySelector('hikvision-intercom-panel') as HTMLElement & { post(m: unknown): void };
      panel.post({ type: 'wiskey:location', tab: 'devices', tool: null });
    });
    await expect.poll(() => hash(page)).toBe('#/wiskey/devices?wiskey_tab=devices');
  });

  // ------------------------------------------------------------------ WisKey rc.37: chrome=none, density and wall

  test('rc.37: the address carries chrome=none and the start choices - the user\'s own, else the installation\'s, else none', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    const base = testInfo.project.use.baseURL;
    const { hits } = await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    const last = () => new URL(hits[hits.length - 1]);
    const cases: { install: [string, string]; own: [string | null, string | null]; expected: string }[] = [
      { install: ['auto', 'auto'], own: [null, null], expected: '?embed=1&chrome=none&tab=overview' },
      { install: ['12', '9'], own: [null, null], expected: '?embed=1&chrome=none&tab=overview&density=12&wall=9' },
      { install: ['12', '9'], own: ['6', null], expected: '?embed=1&chrome=none&tab=overview&density=6&wall=9' },
      { install: ['12', '9'], own: ['auto', '4'], expected: '?embed=1&chrome=none&tab=overview&wall=4' }, // "אוטומטי" leaves the density out
      { install: ['12', 'auto'], own: [null, null], expected: '?embed=1&chrome=none&tab=overview&density=12' },
      { install: ['auto', '12'], own: ['9', '9'], expected: '?embed=1&chrome=none&tab=overview&density=9&wall=9' },
    ];
    try {
      for (const c of cases) {
        await setWiskeyView(base, { install: c.install, own: c.own });
        const before = hits.length;
        await open(page, '/wiskey/overview');
        await expect(page.locator(FRAME)).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
        expect(hits.length).toBe(before + 1); // the frame is opened once, with the choices already in its address
        expect(last().search).toBe(c.expected);
        expect(last().origin).toBe(new URL(page.url()).origin);
      }
    } finally {
      await setWiskeyView(base, { install: ['auto', 'auto'], own: [null, null] });
    }
  });

  test('rc.37: החשבון שלי › WisKey keeps the choice on the server per user and reloads an open frame once, on the tab it shows', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    const base = testInfo.project.use.baseURL;
    await setWiskeyView(base, { install: ['auto', 'auto'], own: [null, null] });
    const { hits } = await stubPanel(page, { kiosk: true, panels: true, api: 'v1' });
    try {
      await open(page, '/wiskey/people');
      const frame = page.locator(FRAME);
      await expect(frame).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15000 });
      await expect(frame).toHaveAttribute('data-confirmed-tab', 'users');
      expect(hits.length).toBe(1);
      expect(new URL(hits[0]).search).toBe('?embed=1&chrome=none&tab=users');

      await page.locator('sw-app [data-profile-menu]').click();
      const menu = page.locator('sw-app sw-user-menu [data-profile-menu-panel]');
      await expect(menu).toBeVisible();
      await menu.locator('[data-menu-account]').click();
      await menu.locator('[data-my-wiskey] summary').click();
      const density = menu.locator('[data-my-wiskey-density]');
      const wall = menu.locator('[data-my-wiskey-wall]');
      await expect(density).toBeVisible();
      await expect(menu.locator('[data-my-wiskey-note]')).toHaveText('נקודת פתיחה בכל טעינה. שינוי בתוך WisKey אינו נשמר.');
      expect(await density.locator('option').allTextContents()).toEqual(['ברירת מחדל (אוטומטי)', 'אוטומטי', '4', '6', '8', '9', '12']);
      expect(await wall.locator('option').allTextContents()).toEqual(['ברירת מחדל', '4', '9', '12']);
      await page.screenshot({ path: testInfo.outputPath('account-wiskey-block.png') });

      await density.selectOption('8');
      await expect.poll(() => hits.length).toBe(2); // the open frame is reopened once ...
      expect(new URL(hits[1]).search).toBe('?embed=1&chrome=none&tab=users&density=8'); // ... on the tab it shows
      expect((await myPrefs(base))['wiskey.density']).toBe('8');
      await wall.selectOption('12');
      await expect.poll(() => hits.length).toBe(3);
      expect(new URL(hits[2]).search).toBe('?embed=1&chrome=none&tab=users&density=8&wall=12');
      expect(await myPrefs(base)).toMatchObject({ 'wiskey.density': '8', 'wiskey.wall': '12' });

      await density.selectOption('auto'); // an explicit "אוטומטי": the parameter is left out
      await expect.poll(() => hits.length).toBe(4);
      expect(new URL(hits[3]).search).toBe('?embed=1&chrome=none&tab=users&wall=12');
      await wall.selectOption(''); // back to the installation's default (none): nothing changes in the address of the wall
      await expect.poll(() => hits.length).toBe(5);
      expect(new URL(hits[4]).search).toBe('?embed=1&chrome=none&tab=users');
      await page.waitForTimeout(1500);
      expect(hits.length).toBe(5); // no reload storm
      expect(await myPrefs(base)).toMatchObject({ 'wiskey.density': 'auto', 'wiskey.wall': null });

      // it is the user's own: another user sees the default (the server keeps it per user)
      const other = await pwRequest.newContext({ baseURL: base, extraHTTPHeaders: { 'x-sw-dev-user': 'wiskey-view-check' } });
      try {
        const r = await other.get('/api/v1/me/prefs');
        if (r.ok()) expect(((await r.json()) as { prefs: Record<string, unknown> }).prefs['wiskey.density']).toBeNull();
      } finally {
        await other.dispose();
      }
    } finally {
      await setWiskeyView(base, { install: ['auto', 'auto'], own: [null, null] });
    }
  });
});

/** Sets the installation defaults (`ui.wiskey_density` / `ui.wiskey_wall`) and the signed-in user's own choices (null = none). */
async function setWiskeyView(baseURL: string | undefined, v: { install: [string, string]; own: [string | null, string | null] }) {
  const ctx = await pwRequest.newContext({ baseURL });
  try {
    const s = await ctx.patch('/api/v1/settings', { data: { 'ui.wiskey_density': v.install[0], 'ui.wiskey_wall': v.install[1] } });
    if (!s.ok()) throw new Error(`PATCH /settings ${s.status()}: ${await s.text()}`);
    const p = await ctx.put('/api/v1/me/prefs', { data: { 'wiskey.density': v.own[0], 'wiskey.wall': v.own[1] } });
    if (!p.ok()) throw new Error(`PUT /me/prefs ${p.status()}: ${await p.text()}`);
  } finally {
    await ctx.dispose();
  }
}

async function myPrefs(baseURL: string | undefined): Promise<Record<string, unknown>> {
  const ctx = await pwRequest.newContext({ baseURL });
  try {
    return ((await (await ctx.get('/api/v1/me/prefs')).json()) as { prefs: Record<string, unknown> }).prefs;
  } finally {
    await ctx.dispose();
  }
}
