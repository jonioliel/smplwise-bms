import type { Page, Route } from '@playwright/test';

// A stand-in for Home Assistant's frontend page at /hikvision-intercom, served by a Playwright route stub (no real Home
// Assistant or WisKey is reached): the same element structure as HA's frontend (home-assistant > #shadow >
// home-assistant-main > #shadow > ha-drawer > ha-sidebar + hikvision-intercom-panel), with a fake WisKey panel in one of
// these flavours:
//   legacy       an older WisKey (before 2.0.0-rc.19): no `data-embed-api` marker, no messages; the panel keeps its tab
//                in memory, and its navigate() refuses until its session loads (600 ms), like the old panel.ts
//   v1           WisKey embed API v1 (rc.19): honours `embed=1&tab&tool`, marks the root `data-embed-api="1"`, posts
//                `wiskey:ready` (version 1 + catalog) to its parent after its session loads, answers `wiskey:navigate`
//                from its parent with `wiskey:location` (the old location when `window.__dirty` is set - a declined
//                unsaved-change prompt) and `wiskey:title`, and keeps its URL in step with replaceState
//   marker-only  the marker "1" but never a handshake (loading / authentication that never completes)
//   v2-ready     a future breaking contract announced by the handshake: `wiskey:ready` with version 2 (marker "2")
//   v2-marker    a future breaking contract seen only by discovery: marker "2", no messages at all
// `announce: false` (v1): the handshake is not followed by a location message - ready promises none.
// In the frame: `__ignore = true` answers nothing to a navigate (session lock); `__defer` / `__flush()` hold them.
// Every flavour records what SMPLWISE did to it: `__kioskEvents` (hass-kiosk-mode events on the frame's window),
// `__navigates` (calls of the panel's internal navigate()), `__received` (messages from the parent), `__posted`.
// It proves the wiring, NOT the behaviour of the real nested Home Assistant / WisKey: that is the owner's lab check.

export type FakeApi = 'legacy' | 'v1' | 'marker-only' | 'v2-ready' | 'v2-marker';
export interface FakeCatalog {
  tabs: { id: string; label: string }[];
  tools: { id: string; label: string }[];
}
export interface FakeHa {
  kiosk: boolean;
  panels: boolean;
  api?: FakeApi;
  catalog?: FakeCatalog;
  /** v1: post the location (and title) right after ready (default true). */
  announce?: boolean;
  /** Home Assistant's external (Companion app) sign-in: start only after a token from the app's bridge (FAKE_CORE). */
  externalAuth?: boolean;
}

export const PANEL_URL = /\/hikvision-intercom(\?|$)/;

/** A small catalog in the shape rc.19 sends (Hebrew labels, ids apart from labels). */
export const FAKE_CATALOG: FakeCatalog = {
  tabs: [
    { id: 'overview', label: 'סקירת כניסה' },
    { id: 'users', label: 'אנשים ב-WisKey' },
    { id: 'devices', label: 'עמדות' },
    { id: 'events', label: 'אירועים' },
    { id: 'sync', label: 'סנכרון' },
    { id: 'tools', label: 'כלי ניהול' },
    { id: 'camera_wall', label: 'קיר מצלמות' },
  ],
  tools: [
    { id: 'media_options', label: 'וידאו, שמע והכרזות' },
    { id: 'schedules', label: 'לוחות זמנים' },
    { id: 'health', label: 'בריאות' },
    { id: 'audit', label: 'יומן שינויים' },
    { id: 'users', label: 'אנשים' },
    { id: 'devices', label: 'עמדות' },
    { id: 'camera_wall', label: 'קיר מצלמות' },
  ],
};

export function fakeHaPage({ kiosk, panels, api = 'legacy', catalog = FAKE_CATALOG, announce = true, externalAuth = false }: FakeHa): string {
  const config = JSON.stringify({ api, catalog, announce, marker: api === 'v1' || api === 'marker-only' ? '1' : api.startsWith('v2') ? '2' : null });
  return `<!doctype html><html><body style="margin:0"><home-assistant></home-assistant><script>
function __boot() {
const CONFIG = ${config};
window.__loads = (window.__loads || 0) + 1;
window.__menuToggles = 0;
window.__navigates = 0;
window.__kioskEvents = 0;
window.__received = [];
window.__posted = [];
window.__dirty = false;
window.__defer = false;
window.__ignore = false;
window.__deferred = [];
window.__flush = () => {
  const panel = document.querySelector('home-assistant').shadowRoot.querySelector('home-assistant-main').shadowRoot.querySelector('hikvision-intercom-panel');
  const held = window.__deferred;
  window.__deferred = [];
  window.__defer = false;
  held.forEach((d) => panel.handle(d));
};
window.addEventListener('hass-kiosk-mode', () => { window.__kioskEvents++; });
const TOP = CONFIG.catalog.tabs.map((t) => t.id);
const TOOLS = CONFIG.catalog.tools.map((t) => t.id);
const label = (loc) => {
  const t = loc.tool ? CONFIG.catalog.tools.find((x) => x.id === loc.tool) : CONFIG.catalog.tabs.find((x) => x.id === loc.tab);
  return t ? t.label : loc.tab;
};
/** WisKey's canonicalisation: tool ids as a tab open under tools, hub links to top-level screens become that tab,
 * unknown ids fall back to the default. */
function canon(tab, tool) {
  if (tab && !TOP.includes(tab) && TOOLS.includes(tab)) return { tab: 'tools', tool: tab };
  if (tab === 'tools' && tool) {
    if (TOP.includes(tool)) return { tab: tool, tool: null };
    return { tab: 'tools', tool: TOOLS.includes(tool) ? tool : null };
  }
  if (tab && TOP.includes(tab)) return { tab, tool: null };
  return null;
}
class Panel extends HTMLElement {
  constructor() {
    super();
    this._tab = 'overview';
    this._session = undefined;
    this.ready = false;
  }
  connectedCallback() {
    if (CONFIG.marker) this.setAttribute('data-embed-api', CONFIG.marker);
    if (CONFIG.api !== 'legacy') {
      const q = new URLSearchParams(location.search);
      this.embedded = q.get('embed') === '1';
      this.loc = canon(q.get('tab'), q.get('tool')) || { tab: TOP.includes('overview') ? 'overview' : TOP[0], tool: null }; // the allowed default
      this._tab = this.loc.tab;
      window.addEventListener('message', (e) => this.onMessage(e));
    }
    this.render();
    setTimeout(() => {
      this._session = { allowed: true };
      if (CONFIG.api === 'v1' || CONFIG.api === 'v2-ready') {
        this.ready = true;
        this.post({ type: 'wiskey:ready', version: CONFIG.api === 'v2-ready' ? 2 : 1, tabs: CONFIG.catalog.tabs, tools: CONFIG.catalog.tools });
        if (CONFIG.announce) {
          this.post({ type: 'wiskey:location', tab: this.loc.tab, tool: this.loc.tool });
          this.post({ type: 'wiskey:title', text: label(this.loc) });
        }
      }
    }, 600);
  }
  render() {
    this.textContent = 'panel:' + this._tab + (this.loc && this.loc.tool ? '/' + this.loc.tool : '');
  }
  post(msg) {
    window.__posted.push(msg);
    window.parent.postMessage(msg, location.origin);
  }
  onMessage(e) {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    window.__received.push(e.data);
    if (window.__ignore) return; // a locked session / an unavailable screen: no navigation, no location
    if (window.__defer) {
      window.__deferred.push(e.data); // held until __flush(): a navigation still in flight
      return;
    }
    this.handle(e.data);
  }
  handle(data) {
    if (!this.ready || !data || data.type !== 'wiskey:navigate') return;
    const next = canon(data.tab, data.tool);
    if (!next) return; // unknown ids are ignored
    if (window.__dirty) {
      this.post({ type: 'wiskey:location', tab: this.loc.tab, tool: this.loc.tool }); // the user kept the unsaved edit
      return;
    }
    this.loc = next;
    this._tab = next.tab;
    const url = new URL(location.href);
    url.searchParams.set('tab', next.tab);
    if (next.tool) url.searchParams.set('tool', next.tool); else url.searchParams.delete('tool');
    history.replaceState(history.state, '', url);
    this.render();
    this.post({ type: 'wiskey:location', tab: next.tab, tool: next.tool });
    this.post({ type: 'wiskey:title', text: label(next) });
  }
  /** The older panel's internal method: SMPLWISE's legacy adapter calls it; the v1 path must never. */
  navigate(tab) {
    window.__navigates++;
    if (!this._session) return;
    this._tab = tab;
    if (this.loc) this.loc = { tab, tool: null };
    this.render();
  }
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
}
${externalAuth ? `window.__boot = __boot;
</script><script>import('${FAKE_CORE_PATH}');` : '__boot();'}
</script></body></html>`;
}

/** `externalAuth`: the entry module, loaded with import() like Home Assistant's core entry (index.html.template). It
 * does what home-assistant/frontend `src/data/external.ts` 1-5, `src/entrypoints/core.ts` 69-80 and
 * `src/external_app/external_auth.ts` 61-65 / 102-126 do at start-up: fix `isExternal` from the bridge names or
 * `external_auth=1`, throw without a bridge, set `externalAuthSetToken` on its own window and ask the bridge - and only
 * once a token arrives does Home Assistant (and the fake panel) start. Without `isExternal`: the sign-in redirect. What
 * it saw is recorded in `window.__auth`. */
const FAKE_CORE_PATH = '/fake-ha/core.js';
const FAKE_CORE = `const isExternal = !!(window.externalAppV2 || window.externalApp || (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.getExternalAuth) || location.search.includes('external_auth=1'));
const A = (window.__auth = { isExternal, proxied: !!(window.externalApp && window.externalApp.__smplwiseBridgeProxy), bus: !!(window.externalAppV2 || (window.externalApp && window.externalApp.externalBus)), readyState: document.readyState, asked: 0, token: null, error: null });
(async () => {
  if (!isExternal) { location.replace('/auth/authorize?client_id=x&redirect_uri=y'); return; }
  if (!window.externalApp && !window.webkit && !window.externalAppV2) { A.error = 'External auth requires either externalApp, externalAppV2, or webkit defined on Window object.'; return; }
  const p = new Promise((resolve, reject) => { window.externalAuthSetToken = (ok, data) => (ok ? resolve(data) : reject(data)); });
  await Promise.resolve();
  const payload = { callback: 'externalAuthSetToken' };
  A.asked++;
  if (window.externalAppV2) window.externalAppV2.postMessage(JSON.stringify({ type: 'getExternalAuth', payload }));
  else if (window.externalApp) window.externalApp.getExternalAuth(JSON.stringify(payload));
  else window.webkit.messageHandlers.getExternalAuth.postMessage(payload);
  A.token = await p;
  window.__boot();
})();`;

/** Answer the panel address with the fake page (or a 502 when `down`); every load of it is counted in `hits`. */
export async function stubPanel(page: Page, answer: FakeHa | 'down'): Promise<{ hits: string[] }> {
  const hits: string[] = [];
  if (answer !== 'down' && answer.externalAuth) {
    // a network round trip like the real entry module (never answered from the page itself)
    await page.route(`**${FAKE_CORE_PATH}`, (route: Route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_CORE }));
  }
  await page.route(PANEL_URL, (route: Route) => {
    hits.push(route.request().url());
    return answer === 'down'
      ? route.fulfill({ status: 502, contentType: 'text/plain', body: 'Bad Gateway' })
      : route.fulfill({ status: 200, contentType: 'text/html', body: fakeHaPage(answer) });
  });
  return { hits };
}
