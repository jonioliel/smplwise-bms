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
//   v2           a future breaking contract: marker "2" and `wiskey:ready` with version 2
// Every flavour records what SMPLWISE did to it: `__kioskEvents` (hass-kiosk-mode events on the frame's window),
// `__navigates` (calls of the panel's internal navigate()), `__received` (messages from the parent), `__posted`.
// It proves the wiring, NOT the behaviour of the real nested Home Assistant / WisKey: that is the owner's lab check.

export type FakeApi = 'legacy' | 'v1' | 'marker-only' | 'v2';
export interface FakeCatalog {
  tabs: { id: string; label: string }[];
  tools: { id: string; label: string }[];
}
export interface FakeHa {
  kiosk: boolean;
  panels: boolean;
  api?: FakeApi;
  catalog?: FakeCatalog;
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

export function fakeHaPage({ kiosk, panels, api = 'legacy', catalog = FAKE_CATALOG }: FakeHa): string {
  const config = JSON.stringify({ api, catalog, marker: api === 'v1' || api === 'marker-only' ? '1' : api === 'v2' ? '2' : null });
  return `<!doctype html><html><body style="margin:0"><home-assistant></home-assistant><script>
const CONFIG = ${config};
window.__loads = (window.__loads || 0) + 1;
window.__menuToggles = 0;
window.__navigates = 0;
window.__kioskEvents = 0;
window.__received = [];
window.__posted = [];
window.__dirty = false;
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
      if (CONFIG.api === 'v1' || CONFIG.api === 'v2') {
        this.ready = true;
        this.post({ type: 'wiskey:ready', version: CONFIG.api === 'v2' ? 2 : 1, tabs: CONFIG.catalog.tabs, tools: CONFIG.catalog.tools });
        this.post({ type: 'wiskey:location', tab: this.loc.tab, tool: this.loc.tool });
        this.post({ type: 'wiskey:title', text: label(this.loc) });
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
    if (!this.ready || !e.data || e.data.type !== 'wiskey:navigate') return;
    const next = canon(e.data.tab, e.data.tool);
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
</script></body></html>`;
}

/** Answer the panel address with the fake page (or a 502 when `down`); every load of it is counted in `hits`. */
export async function stubPanel(page: Page, answer: FakeHa | 'down'): Promise<{ hits: string[] }> {
  const hits: string[] = [];
  await page.route(PANEL_URL, (route: Route) => {
    hits.push(route.request().url());
    return answer === 'down'
      ? route.fulfill({ status: 502, contentType: 'text/plain', body: 'Bad Gateway' })
      : route.fulfill({ status: 200, contentType: 'text/html', body: fakeHaPage(answer) });
  });
  return { hits };
}
