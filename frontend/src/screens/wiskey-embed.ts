import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-tabs';
import { can, canNav, isApi } from '../api/session';
import { parseRoute, pushRoute, replaceRoute } from '../router';
import { WISKEY_PHONE_EMBED, WISKEY_SCREENS, WISKEY_TABS, WISKEY_UI, activeTabOf, isWiskeyHref, setWiskeyEmbedNav, visibleTabs, wiskeyPath, wiskeyRequest, wiskeyRoute, wiskeySegmentOf, type WiskeyScreen } from '../shell/nav';
import { attachWiskey, WISKEY_PANEL_PATH, WISKEY_PANEL_TAG, type WiskeyCatalog, type WiskeyConnector, type WiskeyLocation } from '../wiskey/embed-connector';
import { attachCompanionBridge, bridgeWindow, type CompanionBridge, type ShimState } from '../wiskey/companion-bridge';
import './wiskey-overview';
import './wiskey-events';
import './wiskey-people';

/**
 * WisKey's own Home Assistant panel, embedded as-is (CR-005 recorded decision 2026-09-28, "embedded panel").
 *
 * The `hikvision_intercom` integration registers a custom panel at `/hikvision-intercom` (panel_custom,
 * `require_admin=False`, `embed_iframe=False`, webcomponent `hikvision-intercom-panel`). SMPLWISE runs under Supervisor
 * Ingress on Home Assistant's own origin, so the frame (built from `location.origin`, never the Ingress path) is
 * same-origin with Home Assistant: a second, complete Home Assistant frontend that signs in with the user's own HA
 * session - WisKey's permissions and audit apply inside it, not SMPLWISE's. HA sends `X-Frame-Options: SAMEORIGIN`.
 *
 * WisKey embed API v1 (WisKey 2.0.0-rc.19+, `docs/integrations/wiskey/embed-api-v1/WISKEY_EMBED_API_V1.md`) first:
 * the frame opens `/hikvision-intercom?embed=1&tab=<tab>[&tool=<tool>]` through the typed connector
 * (`wiskey/embed-connector.ts`, the reference adapter ported). WisKey omits its own toolbar and handles Home Assistant's
 * sidebar itself; this screen dispatches NO `hass-kiosk-mode` and calls NO panel method on that path. `wiskey:ready`
 * brings the catalog the WisKey tab row is built from (nav.ts `setWiskeyEmbedNav`), a SMPLWISE tab click becomes a
 * `wiskey:navigate` message, the tab row keeps the previous selection until `wiskey:location` confirms, and the confirmed
 * location is mirrored into SMPLWISE's own address (`wiskey_tab` / `wiskey_tool`, replaceState - never a history entry,
 * never fed back to the panel). `wiskey:title` is shown as text.
 *
 * Until the handshake, a read-only probe only tells the failure states apart (a sign-in redirect, not Home Assistant,
 * the panel not registered, a refused frame) - it touches nothing. After 12 s without a handshake the connector looks
 * for the public panel root's `data-embed-api` marker: marker "1" = loading / authentication (a waiting state - never
 * the older adapter, never a look of authorisation), another value = unsupported, NO marker = an older WisKey build,
 * and only then the previous adapter runs (`legacy` mode, unchanged):
 * - the chrome: first the official lever, the frontend's `hass-kiosk-mode` window event (HA frontend 2026.1+; not
 *   persisted, unlike `hass-dock-sidebar`); when that is not honoured, a style injected into `home-assistant-main`'s
 *   shadow root hides `ha-sidebar` and zeroes the sidebar width variables. If neither takes, a one-line note says so.
 * - the tab: the older panel keeps its tab in memory only, so the deep link is applied by calling the panel's own
 *   `navigate(tab)` once per SMPLWISE tab change or frame load, after the panel's session has loaded, then the panel is
 *   left alone.
 * What the legacy adapter reads inside the frame: `hass.kioskMode` and the keys of `hass.panels` on `<home-assistant>`,
 * and the panel's `_tab` / `_session` (whether it is loaded, never its content). No tokens, no localStorage.
 *
 * The Home Assistant Companion app (owner's phone report, 0.1.122) is never nested. In the app, Home Assistant signs in
 * through the native bridge (frontend `src/data/external.ts` `isExternal`: `window.externalAppV2` / `externalApp` on
 * Android, `webkit.messageHandlers.getExternalAuth` on iOS), not through tokens in localStorage; the app answers the
 * frontend's token request by running `externalAuthSetToken` in its top document only. A second Home Assistant inside a
 * frame therefore either waits for a token that never comes or redirects to `/auth/authorize`. So, before framing, the
 * app is detected (`isCompanionApp`), and a login redirect or a Home Assistant that never connects inside the frame is
 * `login_required`, never "not Home Assistant". In both cases the tab shows the SMPLWISE screen where one exists
 * (overview, events, people) or a short note, plus "פתח ב-WisKey", which moves the TOP Home Assistant frontend to the
 * panel's deep link (`/hikvision-intercom?tab=…&tool=…`, honoured in normal mode since rc.19) the way its own
 * `navigate()` does (`src/common/navigate.ts`: pushState on the main window, then `location-changed`).
 *
 * Experimental (owner request 2026-09-29, הגדרות › בקרות כניסה "הטמעה גם באפליקציית Companion", `access.phone_embed`,
 * default off): in the app the frame IS opened, with `external_auth=1`, and `wiskey/companion-bridge.ts` relays the app's
 * sign-in bridge from Home Assistant's top document into it (details and HA source lines there). If the nested
 * frontend still cannot sign in (a login redirect, or no connection within the panel timeout) the tab falls back to the
 * screen above, with a note that the phone embed did not work. Off: exactly the behaviour above.
 *
 * On module exit the frame is disposed and removed, so WisKey cleans up its listeners and media; a deliberate refresh
 * (the bar's "רענן", or "נסה שוב") reopens the panel on the last confirmed tab/tool.
 *
 * Height (owner report 2026-09-29, "only 4 cameras even after choosing 12"): the frame already fills the viewport below
 * SMPLWISE's chrome (a flex column down to the bottom edge, no max-height), but WisKey's rc.25 overview sizes its page
 * from the frame's own viewport in fixed steps (`panel.ts` `fitWall`: 1200 px or wider and under 800 px high = 4 cards,
 * under 880 = 8, else 12) and caps the "תחנות בתצוגה" choice by that (`Math.min(density || 12, capacity)`). At 1440×900
 * the frame is ~720-750 px high, so 4. "הגדל" (desktop) lifts the embed over SMPLWISE's top bar, rail and tab row - the
 * WisKey tab row moves into the embed's own bar - so the frame gets the viewport minus that one bar; remembered per
 * browser. WisKey's own full-screen button works inside the frame too (`allow="fullscreen"`). The cap itself is a
 * request to the WisKey developers (docs/integrations/wiskey/WISKEY_FOLLOWUP_REQUESTS.md).
 */

export { WISKEY_PANEL_PATH };
const PANEL_TAG = WISKEY_PANEL_TAG;
const LOAD_TIMEOUT_MS = 20000; // no `load` at all: nothing answers at the address
const PANEL_TIMEOUT_MS = 25000; // Home Assistant loaded but never mounted the panel
const RELAY_PANEL_TIMEOUT_MS = 10000; // the same, with the experimental phone relay: fall back sooner (review 2026-09-29)
const TAB_TIMEOUT_MS = 15000; // legacy: the panel's session (its permissions) loads after it mounts; navigate() refuses until then
const TICK_MS = 400;
const IN_FLIGHT_MS = 3000; // v1: a navigation with no wiskey:location by then is taken as not acted on
const KEEP_MS = 2000; // after everything is settled: re-apply cheaply, Home Assistant may re-render

const TOP_SWITCH_MS = 1000; // "פתח ב-WisKey": Home Assistant's router gets this long before a full page load
const EXPANDED_KEY = 'sw-wiskey-expanded'; // "הגדל": a per-browser convenience (localStorage), never a setting

function readExpanded(): boolean {
  try {
    return localStorage.getItem(EXPANDED_KEY) === '1';
  } catch {
    return false; // storage blocked: the default layout
  }
}

function writeExpanded(on: boolean): void {
  try {
    if (on) localStorage.setItem(EXPANDED_KEY, '1');
    else localStorage.removeItem(EXPANDED_KEY);
  } catch {
    /* storage blocked: this page view only */
  }
}

export type EmbedPhase = 'loading' | 'waiting' | 'ready' | 'unsupported' | 'login_required' | 'not_installed' | 'unreachable' | 'blocked';
/** Which adapter drives the frame: before the handshake / discovery, the embed API v1, the older panel, or neither. */
export type EmbedMode = 'pending' | 'v1' | 'legacy' | 'unsupported';
/** Why the tab does not nest Home Assistant: the Companion app (known before framing) or a sign-in inside the frame. */
export type DirectReason = 'companion' | 'login_required' | '';
/** How the Home Assistant chrome ended up (legacy adapter): hidden by the kiosk event, by the injected style, or visible. */
export type ChromeLever = 'kiosk' | 'css' | 'visible' | '';

const TAB_LABELS: Record<string, string> = {
  overview: 'מרכז הכניסה',
  events: 'פעילות',
  users: 'אנשים',
  devices: 'עמדות',
  sync: 'סנכרון',
  health: 'בריאות',
  audit: 'יומן שינויים',
  tools: 'ניהול',
  camera_wall: 'קיר מצלמות',
};

type AnyEl = HTMLElement & Record<string, unknown>;
type PanelEl = AnyEl & { _tab?: unknown; _session?: unknown; navigate?: (tab: string) => void };

/** Depth-first search through open shadow roots (bounded), for elements Home Assistant nests inside several of them. */
function deepFind(root: Document | ShadowRoot | Element, tag: string, depth = 0): Element | null {
  if (depth > 12) return null;
  const direct = root.querySelector(tag);
  if (direct) return direct;
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const sr = (el as HTMLElement).shadowRoot;
    if (sr) {
      const hit = deepFind(sr, tag, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/** Legacy adapter only: hide Home Assistant's own sidebar around the panel; returns the lever that took, 'visible' when
 * none did, or '' when the structure is not there (yet). Never throws. */
export function hideHaChrome(win: Window, doc: Document): ChromeLever {
  try {
    const ha = doc.querySelector('home-assistant') as AnyEl | null;
    const ham = ha?.shadowRoot?.querySelector('home-assistant-main') as AnyEl | null;
    if (!ha || !ham) return '';
    // 1. the official lever: `hass-kiosk-mode` on the frame's window sets hass.kioskMode (in memory only) and makes the
    //    drawer modal and closed. Older frontends ignore the event, and hass.kioskMode stays unset.
    const hass = () => ha.hass as { kioskMode?: boolean } | undefined;
    if (hass()?.kioskMode !== true) {
      const Ev = (win as unknown as { CustomEvent: typeof CustomEvent }).CustomEvent;
      win.dispatchEvent(new Ev('hass-kiosk-mode', { detail: { enable: true } }));
    }
    if (hass()?.kioskMode === true) return 'kiosk';
    // 2. the fallback: a style in home-assistant-main's shadow root (ha-drawer reads --ha-sidebar-width since 2025;
    //    older frontends used the Material drawer's --mdc-drawer-width).
    const root = ham.shadowRoot;
    if (!root) return 'visible';
    if (!root.querySelector('style[data-smplwise-chrome]')) {
      const st = doc.createElement('style');
      st.setAttribute('data-smplwise-chrome', '');
      st.textContent = ':host{--ha-sidebar-width:0px!important;--mdc-drawer-width:0px!important;--ha-top-app-bar-width:100%!important}ha-sidebar{display:none!important}';
      root.appendChild(st);
    }
    const sidebar = root.querySelector('ha-sidebar');
    return sidebar && win.getComputedStyle(sidebar).display === 'none' ? 'css' : 'visible';
  } catch {
    return 'visible';
  }
}

type BridgeWin = Window & {
  externalApp?: unknown;
  externalAppV2?: unknown;
  webkit?: { messageHandlers?: { getExternalAuth?: unknown; externalBus?: unknown } };
};

/** The native sign-in bridge Home Assistant's frontend looks for (`src/data/external.ts`); presence only. */
function hasBridge(w: Window | null | undefined): boolean {
  try {
    const b = w as BridgeWin | null | undefined;
    return !!b && !!(b.externalAppV2 || b.externalApp || b.webkit?.messageHandlers?.getExternalAuth || b.webkit?.messageHandlers?.externalBus);
  } catch {
    return false; // a cross-origin top window: nothing to read there
  }
}

/** The Home Assistant Companion app: its user agent (Android `Home Assistant/<version> (Android ...)`; iOS
 * `Home Assistant/<version> (...) Mobile/HomeAssistant, like Safari`), or the native bridge on this window or on the top
 * one (same origin under Ingress). Reads nothing but the presence of those names. */
export function isCompanionApp(win: Window = window): boolean {
  if (/Home ?Assistant\//.test(win.navigator.userAgent)) return true;
  if (hasBridge(win)) return true;
  try {
    return win.top !== win && hasBridge(win.top);
  } catch {
    return false;
  }
}

/** The panel's normal (top-level, not embedded) deep link, root-relative: `/hikvision-intercom?tab=…[&tool=…]`. */
export function wiskeyDeepLink(loc: { tab: string; tool?: string | null }): string {
  const q = new URLSearchParams({ tab: loc.tab });
  if (loc.tool) q.set('tool', loc.tool);
  return `${WISKEY_PANEL_PATH}?${q.toString()}`;
}

/** "פתח ב-WisKey": move the TOP Home Assistant frontend to the WisKey panel (its deep link), as its own `navigate()`
 * does - pushState on the main window, then `location-changed`, which `home-assistant.ts` routes on. When Home
 * Assistant's router takes it, the Ingress frame this code runs in is replaced and the check below never runs; when
 * this frame is still in place after a second and the panel is nowhere in the top document, a full page load does it. */
export function openWiskeyInHa(win: Window = window, target: string = WISKEY_PANEL_PATH): void {
  let top: Window = win;
  try {
    if (win.top && win.top !== win) {
      void win.top.location.pathname; // throws for a cross-origin top: then this window navigates itself
      top = win.top;
    }
  } catch {
    top = win;
  }
  if (top === win) {
    win.location.assign(target);
    return;
  }
  const assign = () => {
    try {
      top.location.assign(target);
    } catch {
      win.open(target, '_top');
    }
  };
  try {
    top.history.pushState(null, '', target);
    const Ev = (top as unknown as { CustomEvent: typeof CustomEvent }).CustomEvent;
    top.dispatchEvent(new Ev('location-changed', { detail: { replace: false } }));
  } catch {
    assign();
    return;
  }
  const frameEl = win.frameElement;
  win.setTimeout(() => {
    try {
      const switched = (frameEl && !frameEl.isConnected) || !!deepFind(top.document, PANEL_TAG);
      if (!switched) assign();
    } catch {
      assign();
    }
  }, TOP_SWITCH_MS);
}

/** WisKey panel tab → the SMPLWISE screen built for it (the other tabs exist only in WisKey's own panel). */
const SMPLWISE_SCREEN: Record<string, 'wiskey-overview' | 'wiskey-events' | 'wiskey-people'> = {
  overview: 'wiskey-overview',
  events: 'wiskey-events',
  users: 'wiskey-people',
};

const sameLocation = (a: WiskeyLocation | null, b: WiskeyLocation | null) => !!a && !!b && a.tab === b.tab && (a.tool || null) === (b.tool || null);

@customElement('wiskey-embed')
export class WiskeyEmbed extends LitElement {
  /** The WisKey tab id asked for by the route: overview, events, users, devices, sync, tools, camera_wall, … */
  @property() tab = 'overview';
  /** The WisKey management tool asked for under `tools` ('' = the tools hub). */
  @property() tool = '';
  @state() private phase: EmbedPhase = 'loading';
  @state() private mode: EmbedMode = 'pending';
  @state() private chrome: ChromeLever = '';
  /** Legacy: null while being applied, true once the panel shows the tab, false when it did not take. */
  @state() private tabApplied: boolean | null = null;
  /** Embed API v1: the handshake's catalog, the confirmed location and the panel's title. */
  @state() private catalog: WiskeyCatalog | null = null;
  @state() private confirmed: WiskeyLocation | null = null;
  @state() private panelTitle = '';
  @state() private unsupportedVersion = '';
  /** A new value renders a fresh iframe element (a retry, or coming back after the module was left). */
  @state() private frameKey = 0;
  /** Set when this tab does not nest Home Assistant (reflected for the evidence specs and the host style). */
  @property({ reflect: true, attribute: 'data-direct' }) direct: DirectReason = '';
  /** "הגדל" (desktop only, see the header): the embed covers SMPLWISE's top bar, rail and tab row. */
  @property({ type: Boolean, reflect: true, attribute: 'data-expanded' }) expanded = readExpanded();
  private forbidden = false;
  private connector: WiskeyConnector | null = null;
  /** v1: the location the frame was opened on (its URL) - asked for, never taken as confirmed. */
  private opened: WiskeyLocation | null = null;
  /** v1: the newest navigation sent and not answered yet (`push` = record a history entry once confirmed), and the
   * older ones it superseded (their late answers are recorded, not mirrored). Entries expire after IN_FLIGHT_MS: WisKey
   * answers nothing to a request during a session lock or to an unavailable screen. */
  private sent: { loc: WiskeyLocation; push: boolean; at: number }[] = [];
  /** A request made before the handshake: sent once the catalog is known. */
  private wanted: WiskeyLocation | null = null;
  private detached = false;
  private timer = 0;
  private loadTimer = 0;
  private loadedAt = 0;
  private tabSince = 0;
  private tabAttempts = 0;
  private lastAttempt = 0;
  /** The panel element, found once per frame load (not re-walked through the nested shadow roots every tick). */
  private panelEl: PanelEl | null = null;
  private guarded = new WeakSet<Element>();
  private frameWin: Window | null = null;
  /** Experimental phone embed: framed inside the Companion app through the sign-in relay. */
  private phoneRelay = false;
  private bridge: CompanionBridge | null = null;
  /** Where the relay's proxies went for the frame's current document (reflected on the frame for the evidence specs). */
  @state() private shim: ShimState = '';
  /** The relay could not guarantee "no bus, no revoke" for a document (native / late / failed): the frame was dropped. */
  @state() private relayRefused: ShimState = '';
  /** "הגדל" actually in force (desktop, framed): the shell is covered and inert, Esc leaves it. */
  private expandedActive = false;
  private inerted: HTMLElement[] = [];
  private desktopMq = window.matchMedia('(min-width: 768px)');

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 0;
      block-size: 100%;
    }
    :host([data-direct]:not([data-direct=''])) {
      /* no frame: the SMPLWISE screen (or the note) flows and scrolls with the shell like any other screen */
      block-size: auto;
    }
    .only {
      display: grid;
      place-items: center;
      padding: 24px var(--sw-page-pad, 16px);
    }
    .actions {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 12px;
      padding: 6px var(--sw-page-pad, 16px);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      border-block-end: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    .bar .grow {
      flex: 1;
    }
    .title {
      color: var(--sw-text);
      font-weight: 600;
    }
    .note {
      color: var(--sw-text-2);
    }
    .note.warn {
      color: var(--sw-warning-text, var(--sw-text));
    }
    a.full {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--sw-accent-text);
      text-decoration: none;
      font-weight: 600;
      white-space: nowrap;
    }
    a.full:hover {
      text-decoration: underline;
    }
    nav.tools {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      scrollbar-width: none;
      padding: 6px var(--sw-page-pad, 16px);
      border-block-end: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    nav.tools a {
      padding: 4px 10px;
      border-radius: 6px;
      color: var(--sw-text-2);
      text-decoration: none;
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
    }
    nav.tools a:hover {
      color: var(--sw-text);
    }
    nav.tools a.on {
      background: var(--sw-surface-3);
      color: var(--sw-accent-text);
      font-weight: 600;
    }
    /* "הגדל" (desktop, framed only): over SMPLWISE's top bar, rail and tab row; the frame gets the viewport minus the
       embed's own bar, which then carries the WisKey tab row */
    .bar sw-tabs {
      display: none;
    }
    @media (min-width: 768px) {
      :host([data-expanded][data-direct='']) {
        position: fixed;
        /* below the system alert banner, which sw-app raises to the top edge while expanded */
        inset: var(--sw-banner-h, 0px) 0 0 0;
        z-index: calc(var(--sw-z-topbar) + 1);
        block-size: auto;
        background: var(--sw-surface);
      }
      :host([data-expanded][data-direct='']) .bar sw-tabs {
        display: block;
      }
    }
    @media (max-width: 767px) {
      [data-wiskey-expand] {
        display: none;
      }
    }
    .stage {
      position: relative;
      flex: 1 1 auto;
      min-block-size: 360px;
      display: flex;
      background: var(--sw-surface);
    }
    iframe {
      flex: 1;
      inline-size: 100%;
      block-size: 100%;
      min-block-size: 0;
      display: block;
      border: 0;
      outline: none;
      background: var(--sw-surface);
    }
    iframe[data-hidden] {
      visibility: hidden;
    }
    .over {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: var(--sw-surface);
      padding: 16px;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (isApi() && !can('access.read')) {
      this.forbidden = true;
      return;
    }
    if (isCompanionApp()) {
      // the app signs Home Assistant in through its native bridge, which a nested frame cannot use by itself: frame it
      // only with the experimental relay switched on and a bridge to relay; otherwise never
      this.phoneRelay = WISKEY_PHONE_EMBED && !!bridgeWindow() && this.direct !== 'companion';
      if (!this.phoneRelay) {
        this.direct = 'companion';
        return;
      }
    }
    // v1: a WisKey tab / tool link is sent as a message first; its history entry is written once the panel confirms
    window.addEventListener('click', this.onClick, true);
    if (this.detached) {
      // back after the module was left: a fresh frame (the old one was removed on exit)
      this.detached = false;
      this.resetFrameState();
      this.frameKey++;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('click', this.onClick, true);
    this.desktopMq.removeEventListener('change', this.onMq);
    this.setExpandedActive(false);
    this.dropFrame();
    this.detached = true;
  }

  protected firstUpdated() {
    this.desktopMq.addEventListener('change', this.onMq);
  }

  protected updated(changed: PropertyValues<this>) {
    this.syncExpanded();
    this.ensureConnector();
    const moved = (changed.has('tab') && changed.get('tab') !== undefined) || (changed.has('tool') && changed.get('tool') !== undefined);
    if (moved && !this.forbidden && !this.direct) this.onRequest();
  }

  /** What the route asks for. */
  private request(): WiskeyLocation {
    return { tab: this.tab || 'overview', tool: this.tab === 'tools' && this.tool ? this.tool : null };
  }

  /** A request in the catalog's terms: an id WisKey lists as a tool (an old bookmark such as #/wiskey/health) is
   * opened as that tool. Unknown ids stay as they are - the connector refuses them. */
  private resolve(loc: WiskeyLocation): WiskeyLocation {
    const c = this.catalog;
    if (!c || c.tabs.some((t) => t.id === loc.tab)) return loc;
    if (!loc.tool && c.tools.some((t) => t.id === loc.tab)) return { tab: 'tools', tool: loc.tab };
    return loc;
  }

  // ------------------------------------------------------------------ frame lifecycle

  private frame(): HTMLIFrameElement | null {
    return this.renderRoot.querySelector('iframe');
  }

  /** Attach the connector to a freshly rendered frame: its listener goes in first, then it assigns the src. */
  private ensureConnector() {
    if (this.connector || this.forbidden || this.direct) return;
    const f = this.frame();
    if (!f) return;
    this.resetFrameState();
    this.opened = this.request();
    // the relay watches the frame from before its address is assigned (the connector assigns it right away)
    this.bridge?.dispose();
    this.bridge = this.phoneRelay ? attachCompanionBridge(f, (s) => this.onShim(s)) : null;
    this.connector = attachWiskey(f, {
      initial: this.opened,
      extraParams: this.bridge ? { external_auth: '1' } : undefined,
      onReady: (c) => this.onReady(c),
      onLocation: (l) => this.onLocation(l),
      onTitle: (t) => (this.panelTitle = t),
      onLegacy: () => this.onLegacy(),
      onWaiting: () => this.onWaiting(),
      onUnsupported: (v) => this.onUnsupported(v),
      onRemount: () => this.onRemount(),
    });
    this.startLoadTimer();
  }

  private resetFrameState() {
    this.stopTimers();
    this.phase = 'loading';
    this.mode = 'pending';
    this.chrome = '';
    this.tabApplied = null;
    this.panelTitle = '';
    this.unsupportedVersion = '';
    this.catalog = null;
    this.confirmed = null;
    this.sent = [];
    this.wanted = null;
    this.loadedAt = 0;
    this.panelEl = null;
  }

  /** Module exit (or a sign-in the frame cannot do): detach the connector and remove the frame, so WisKey cleans up. */
  private dropFrame() {
    this.stopTimers();
    this.connector?.dispose();
    this.connector = null;
    this.bridge?.dispose();
    this.bridge = null;
    this.shim = '';
    const f = this.frame();
    if (f) {
      try {
        f.src = 'about:blank';
      } catch {
        /* already gone */
      }
      f.remove();
    }
    this.panelEl = null;
    setWiskeyEmbedNav({ confirmed: null });
  }

  /** A deliberate refresh ("רענן", "נסה שוב"): with a handshake, the connector reopens the last CONFIRMED tab/tool;
   * otherwise a fresh frame opens what the route asks for. */
  private reload() {
    this.direct = '';
    this.relayRefused = '';
    if (this.connector && this.mode === 'v1') {
      // the old catalog goes before the deliberate reload (contract §5.2); the panel reopens its last confirmed place
      this.resetFrameState();
      setWiskeyEmbedNav({ catalog: null, confirmed: null });
      this.opened = this.connector.confirmed;
      this.connector.refresh();
      this.startLoadTimer();
      return;
    }
    this.dropFrame();
    this.resetFrameState();
    this.frameKey++; // the next render brings a new iframe; updated() attaches a new connector to it
  }

  private stopTimers() {
    window.clearInterval(this.timer);
    window.clearTimeout(this.loadTimer);
    this.timer = 0;
    this.loadTimer = 0;
    this.frameWin?.removeEventListener('location-changed', this.onFrameNav);
    this.frameWin = null;
  }

  private startLoadTimer() {
    window.clearTimeout(this.loadTimer);
    this.loadTimer = window.setTimeout(() => {
      // (an early discovery pass over the frame's initial empty document may already have said "waiting")
      if ((this.phase === 'loading' || this.phase === 'waiting') && !this.loadedAt) this.phase = 'unreachable';
    }, LOAD_TIMEOUT_MS);
  }

  // ------------------------------------------------------------------ embed API v1

  private onReady(catalog: WiskeyCatalog) {
    this.stopTimers(); // the panel is WisKey's now: no probe, no chrome lever, no DOM navigation
    this.mode = 'v1';
    this.phase = 'ready';
    this.catalog = catalog;
    // ready promises no location: nothing is confirmed until wiskey:location (WisKey may have fallen back to its
    // default for an id this operator may not open); until then the tab row shows the route's request
    this.confirmed = null;
    this.sent = [];
    setWiskeyEmbedNav({ catalog, confirmed: null });
    const wanted = this.wanted ? this.resolve(this.wanted) : null;
    this.wanted = null;
    if (wanted && !sameLocation(wanted, this.opened)) this.send(wanted, false);
  }

  /** What the panel shows or is about to show: the newest navigation in flight, else the confirmed location, else the
   * place the frame was opened on. A request equal to it is not sent again (no echo). */
  private reference(): WiskeyLocation | null {
    this.expireSent();
    return this.sent.length ? this.sent[this.sent.length - 1].loc : (this.confirmed ?? this.opened);
  }

  /** Drop navigations that got no answer within IN_FLIGHT_MS (a locked session, an unavailable screen): a later click
   * on the same screen must be sent again, not matched against a request WisKey never acted on. */
  private expireSent() {
    const now = Date.now();
    this.sent = this.sent.filter((s) => now - s.at <= IN_FLIGHT_MS);
  }

  private send(target: WiskeyLocation, push: boolean): boolean {
    if (!this.connector?.navigate(target)) return false;
    this.expireSent();
    // the newest request is the one in flight; older ones only wait for a late answer (never pushed)
    this.sent = [...this.sent.map((s) => ({ ...s, push: false })), { loc: target, push, at: Date.now() }].slice(-4);
    return true;
  }

  /** The CONFIRMED location (possibly the old one: a declined unsaved-change prompt): the tab row follows it and it is
   * mirrored into SMPLWISE's address, which the shell re-reads without treating it as a new request (no echo). A
   * location answering an older navigation while a newer one is still in flight (click, then Back) is recorded but not
   * mirrored - the newer answer decides the address. A tab the user clicked gets its history entry only now. */
  private onLocation(loc: WiskeyLocation) {
    this.confirmed = loc;
    setWiskeyEmbedNav({ confirmed: loc });
    this.expireSent();
    const newest = this.sent[this.sent.length - 1];
    const older = this.sent.findIndex((s, i) => i < this.sent.length - 1 && sameLocation(loc, s.loc));
    if (newest && !sameLocation(loc, newest.loc) && older >= 0) {
      this.sent.splice(older, 1); // the late answer to a superseded request: recorded, not mirrored
      return;
    }
    const last = this.sent[this.sent.length - 1];
    const push = !!last && last.push && sameLocation(loc, last.loc);
    this.sent = [];
    this.mirror(loc, push);
  }

  private mirror(loc: WiskeyLocation, push = false) {
    const r = parseRoute();
    if (r.mode !== 'wiskey') return; // the user already left the area
    const seg = wiskeySegmentOf(loc.tab);
    // a screen the owner set to SMPLWISE keeps its own path: rewriting it would swap the embed out under the user
    const own = (WISKEY_SCREENS as string[]).includes(seg) && WISKEY_UI[seg as WiskeyScreen] === 'smplwise';
    const params = new URLSearchParams(r.params);
    params.set('wiskey_tab', loc.tab);
    if (loc.tool) params.set('wiskey_tool', loc.tool);
    else params.delete('wiskey_tool');
    (push ? pushRoute : replaceRoute)(own ? r.path : wiskeyPath(loc), params);
  }

  /** v1: a plain click on a WisKey tab / tool link that renders the embed is a message, not a hash change: the address
   * and its history entry follow the panel's confirmation, so a declined change leaves no entry behind. Links to a
   * screen the owner set to SMPLWISE, modified clicks and everything else navigate as usual. */
  private onClick = (e: MouseEvent) => {
    if (this.mode !== 'v1' || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.composedPath().find((n): n is HTMLAnchorElement => n instanceof HTMLAnchorElement);
    const href = a?.getAttribute('href') ?? '';
    if (!a || !isWiskeyHref(href) || (a.target && a.target !== '_self')) return;
    const r = parseRoute(href);
    if (wiskeyRoute(r, isApi()).kind !== 'embed') return;
    e.preventDefault();
    const target = this.resolve(wiskeyRequest(r));
    if (sameLocation(target, this.reference())) return;
    this.send(target, true); // an id the panel did not list is not sent: nothing moves
  };

  /** The route asked for another place (a SMPLWISE tab click, back / forward, a typed address). */
  private onRequest() {
    if (this.phase === 'not_installed' || this.phase === 'unreachable' || this.phase === 'blocked' || this.phase === 'unsupported') {
      this.reload();
      return;
    }
    if (this.mode === 'legacy') {
      // same frame, other tab: navigate the loaded panel instead of loading all of Home Assistant again
      this.resetTab();
      this.tick();
      return;
    }
    const target = this.resolve(this.request());
    if (this.mode === 'v1') {
      if (sameLocation(target, this.reference())) return; // what the panel shows or is going to: nothing to send
      // the tab row keeps its selection until wiskey:location arrives; an id the panel did not list is not sent, and
      // the address goes back to what the panel confirmed
      if (!this.send(target, false) && this.confirmed) this.mirror(this.confirmed);
      return;
    }
    this.wanted = target; // before the handshake: sent once the catalog is known
  }

  /** The frame loaded a new document after the handshake (HA reloaded, a sign-in redirect after revocation): back to
   * pending - a fresh handshake is needed, and the probe watches for a sign-in or a dead frame again. */
  private onRemount() {
    if (this.mode !== 'v1') return;
    const last = this.confirmed ?? this.opened;
    this.resetFrameState();
    this.opened = last;
    setWiskeyEmbedNav({ catalog: null, confirmed: null });
  }

  private onLegacy() {
    if (this.mode !== 'pending' || (this.phase !== 'loading' && this.phase !== 'waiting')) return;
    // no marker after discovery: an older WisKey build - the previous adapter, and the static tab row
    this.mode = 'legacy';
    this.catalog = null;
    setWiskeyEmbedNav({ catalog: null, confirmed: null });
    this.resetTab();
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  private onWaiting() {
    // the marker is there (or the panel root is not, yet) but no handshake: loading / authentication - never the older
    // adapter, never the look of an authorised user; the probe keeps watching for a sign-in or a dead frame
    if (this.mode === 'pending' && (this.phase === 'loading' || this.phase === 'waiting')) this.phase = 'waiting';
  }

  private onUnsupported(version: unknown) {
    if (this.mode === 'v1') return; // a working v1 embed is not torn down (the connector already ignores it too)
    if (this.phase === 'login_required' || this.phase === 'not_installed' || this.phase === 'unreachable' || this.phase === 'blocked') return;
    this.stopTimers();
    this.mode = 'unsupported';
    this.phase = 'unsupported';
    this.unsupportedVersion = String(version ?? '');
    this.catalog = null;
    setWiskeyEmbedNav({ catalog: null, confirmed: null });
  }

  // ------------------------------------------------------------------ frame probe (+ the legacy adapter)

  private onFrameNav = () => this.tick();

  /** Lit's listener runs before the connector's: judge the load a tick later, once the connector has decided whether
   * it was a remount (a new document after a handshake). */
  private onLoad() {
    window.setTimeout(() => this.afterLoad(), 0);
  }

  private afterLoad() {
    const f = this.frame();
    if (!f || !this.connector) return;
    try {
      if (f.contentWindow?.location.href === 'about:blank') return; // the frame's initial empty document
    } catch {
      /* another origin: judged below */
    }
    this.loadedAt = Date.now();
    this.panelEl = null;
    this.resetTab(); // a new document (ours or Home Assistant reloading itself): the legacy deep link is owed once more
    window.clearTimeout(this.loadTimer);
    let doc: Document | null = null;
    try {
      doc = f.contentDocument;
      void f.contentWindow?.location.pathname; // throws when the frame ended up on another origin
    } catch {
      doc = null;
    }
    if (!doc) {
      // a refused frame (X-Frame-Options / CSP) or a redirect to another origin leaves a document we may not read
      this.phase = 'blocked';
      return;
    }
    if (this.mode === 'v1' || this.mode === 'unsupported') return; // the handshake's own document: nothing to watch
    this.frameWin?.removeEventListener('location-changed', this.onFrameNav);
    this.frameWin = f.contentWindow;
    this.frameWin?.addEventListener('location-changed', this.onFrameNav); // Home Assistant's own in-app navigation
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  /** One pass over the frame. Before the handshake: only which failure state it is in (read-only). In legacy mode: also
   * the chrome and the tab. Idempotent, cheap, never throws. */
  private tick() {
    const f = this.frame();
    if (!f || !this.loadedAt || this.mode === 'v1' || this.mode === 'unsupported') return;
    try {
      const win = f.contentWindow;
      const doc = f.contentDocument;
      if (!win || !doc) {
        this.phase = 'blocked';
        return this.settle();
      }
      const path = win.location.pathname;
      if (path.startsWith('/auth/')) {
        // Home Assistant asks the user to sign in inside the frame: its session is not available there (the Companion
        // app keeps it in the app; a browser that signed in without "keep me signed in" keeps it in that one document)
        return this.goDirect();
      }
      const ha = doc.querySelector('home-assistant') as AnyEl | null;
      if (!ha) {
        // Home Assistant's page carries <home-assistant> in its HTML: without it, something else answered the address
        if (doc.readyState === 'complete') {
          this.phase = 'unreachable';
          this.settle();
        }
        return;
      }
      const panels = (ha.hass as { panels?: Record<string, unknown> } | undefined)?.panels;
      if (panels && !Object.keys(panels).includes(WISKEY_PANEL_PATH.slice(1))) {
        this.phase = 'not_installed';
        return this.settle();
      }
      const legacy = this.mode === 'legacy';
      if (legacy) this.chrome = this.chrome === 'kiosk' || this.chrome === 'css' ? this.keepChrome(win, doc) : hideHaChrome(win, doc);
      if (!this.panelEl?.isConnected || this.panelEl.ownerDocument !== doc) this.panelEl = deepFind(doc, PANEL_TAG) as PanelEl | null;
      const panel = this.panelEl;
      if (!panel) {
        if (Date.now() - this.loadedAt > (this.bridge ? RELAY_PANEL_TIMEOUT_MS : PANEL_TIMEOUT_MS)) {
          // Home Assistant's page answered but never connected: its sign-in did not complete inside the frame (the
          // Companion bridge waits for a token the app delivers to its top document only) - not "not Home Assistant"
          if (!ha.hass) return this.goDirect();
          this.phase = path.startsWith(WISKEY_PANEL_PATH) ? 'unreachable' : 'not_installed';
          this.settle();
        }
        return;
      }
      if (!legacy) {
        // the panel is mounted: the handshake (or the 12 s discovery) decides from here; keep a slow watch only
        if (this.timer) this.slowDown();
        return;
      }
      this.phase = 'ready';
      this.guardMenu(panel);
      this.applyTab(panel);
      if (this.tabApplied !== null && (this.chrome === 'kiosk' || this.chrome === 'css' || Date.now() - this.loadedAt > PANEL_TIMEOUT_MS)) this.slowDown();
    } catch {
      // the frame navigated away mid-pass, or Home Assistant's structure changed: try again on the next tick
    }
  }

  /** Re-apply a lever that took (Home Assistant may re-render); fall back to the other one if it stopped holding. */
  private keepChrome(win: Window, doc: Document): ChromeLever {
    const lever = hideHaChrome(win, doc);
    return lever || this.chrome;
  }

  /** Legacy: with the chrome hidden, the panel's own menu button would open Home Assistant's drawer over it; swallow it. */
  private guardMenu(panel: Element) {
    if (this.guarded.has(panel) || (this.chrome !== 'kiosk' && this.chrome !== 'css')) return;
    this.guarded.add(panel);
    panel.addEventListener('hass-toggle-menu', (e) => e.stopPropagation());
  }

  private resetTab() {
    this.tabApplied = null;
    this.tabSince = 0; // the clock starts when the panel is first seen, not at frame load (a phone's HA start-up can take longer than the window)
    this.tabAttempts = 0;
    this.lastAttempt = 0;
  }

  /** Legacy: the deep link is applied ONCE per SMPLWISE tab change or frame load, then the panel is left alone: WisKey's
   * own navigation (a tool opened from ניהול, a drill-down) must never be undone by a later tick, and a navigate() into a
   * schedule with unsaved edits asks WisKey's canLeave() confirm - at most once, as a click would.
   * The older panel's navigate() refuses every tab until its `_session` (its permissions) has loaded, so it is called
   * once that is known; without that field (a changed panel) a few spaced attempts, then give up. */
  private applyTab(panel: PanelEl) {
    if (this.tabApplied !== null) return; // done for this tab and this document
    if (panel._tab === this.tab) {
      this.tabApplied = true;
      return;
    }
    if (this.tabSince === 0) this.tabSince = Date.now(); // counted from the panel's mount (review nit)
    const expired = Date.now() - this.tabSince > TAB_TIMEOUT_MS;
    if (typeof panel.navigate !== 'function') {
      this.tabApplied = false;
      return;
    }
    if ('_session' in panel) {
      if (panel._session === undefined) {
        if (expired) this.tabApplied = false; // the panel never finished loading its session
        return;
      }
      panel.navigate(this.tab); // exactly once
      this.tabApplied = panel._tab === this.tab;
      return;
    }
    if (expired || this.tabAttempts >= 5) {
      this.tabApplied = false;
      return;
    }
    if (Date.now() - this.lastAttempt < 1000) return;
    this.lastAttempt = Date.now();
    this.tabAttempts++;
    panel.navigate(this.tab);
    if (panel._tab === this.tab) this.tabApplied = true;
  }

  private slowDown() {
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), KEEP_MS);
  }

  /** The relay's outcome for the frame's current document. Only `early` (every proxy in place before Home Assistant's
   * scripts ran) keeps the frame; anything else would leave the app's real bridge (its bus, its revoke) inside it, so
   * the frame goes at once and the tab shows the 0.1.123 screen (security review 2026-09-29, M1). */
  private onShim(s: ShimState) {
    this.shim = s;
    if (s === 'early') return;
    this.relayRefused = s;
    this.goDirect();
  }

  /** Home Assistant cannot sign in inside the frame: drop the frame and show the tab without nesting. */
  private goDirect() {
    this.dropFrame();
    this.phase = 'login_required';
    this.direct = 'login_required';
  }

  /** A final state: stop polling (the retry button starts over). */
  private settle() {
    window.clearInterval(this.timer);
    this.timer = 0;
  }

  // ------------------------------------------------------------------ render

  /** What the frame shows (v1: the confirmed location), for labels and the full-window link. */
  private shown(): WiskeyLocation {
    return this.mode === 'v1' && this.confirmed ? this.confirmed : this.request();
  }

  private labelOf(tab: string): string {
    return this.catalog?.tabs.find((t) => t.id === tab)?.label || TAB_LABELS[tab] || tab;
  }

  private renderError() {
    const common = 'אפשר לנסות שוב, לעבור למסך WisKey העצמאי או לפתוח אותו בחלון חדש, או לבחור בהגדרות › בקרות כניסה את מסכי Arx.';
    const map: Record<string, { heading: string; hint: string; state: 'error' | 'stale' | 'empty' }> = {
      not_installed: { heading: 'לוח WisKey לא נמצא', hint: `האינטגרציה hikvision_intercom לא רשמה את הלוח ${WISKEY_PANEL_PATH} (לא מותקנת, לא נטענה, או שהמשתמש לא רואה אותו). ${common}`, state: 'empty' },
      unreachable: { heading: 'לא ניתן לטעון את WisKey', hint: `הכתובת ${WISKEY_PANEL_PATH} לא נטענה בתוך המסגרת. ייתכן שההזדהות אינה זמינה בתוך מסגרת; או שהממשק נפתח ישירות, לא דרך תשתית המערכת. ${common}`, state: 'stale' },
      blocked: { heading: 'הדפדפן לא מאפשר להטמיע את WisKey כאן', hint: `המסגרת נחסמה (מדיניות מסגרות) או הופנתה לכתובת אחרת. ${common}`, state: 'error' },
      unsupported: { heading: 'גרסת ממשק ההטמעה של WisKey אינה נתמכת', hint: `WisKey המותקן מדבר בגרסת ממשק הטמעה ${this.unsupportedVersion || 'לא ידועה'}, ו־Arx מכיר את גרסה 1. ${common}`, state: 'error' },
    };
    const m = map[this.phase];
    if (!m) return nothing;
    return html`<div class="over" data-wiskey-embed-error=${this.phase}>
      <div>
        <sw-state-panel state=${m.state} heading=${m.heading} hint=${m.hint}></sw-state-panel>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <sw-button size="sm" icon="refresh" data-wiskey-embed-retry @click=${() => this.reload()}>נסה שוב</sw-button>
          ${this.openInHaButton()}
          ${this.fullLink()}
        </div>
      </div>
    </div>`;
  }

  private openInHaButton(variant: 'primary' | 'secondary' = 'secondary') {
    return html`<sw-button size="sm" variant=${variant} icon="door" data-wiskey-open-ha @click=${() => openWiskeyInHa(window, wiskeyDeepLink(this.shown()))}>פתח ב-WisKey</sw-button>`;
  }

  /** The tab without a nested Home Assistant: the SMPLWISE screen where one exists, otherwise a short note. */
  private renderDirect() {
    const label = TAB_LABELS[this.tab] ?? this.tab;
    // the experimental phone embed that could not sign in counts as the phone case (no new-window link in the app)
    const phone = this.direct === 'companion' || this.phoneRelay;
    const note =
      this.direct === 'companion'
        ? 'בטלפון WisKey נפתח באפליקציה עצמה'
        : this.phoneRelay && this.relayRefused
          ? 'ההטמעה באפליקציה (ניסיוני) לא נתמכת במכשיר הזה, ולכן WisKey נפתח באפליקציה עצמה'
          : this.phoneRelay
          ? 'ההטמעה באפליקציה (ניסיוני) לא הצליחה להתחבר, ולכן WisKey נפתח באפליקציה עצמה'
          : 'נדרשת התחברות בתוך המסגרת, ולכן WisKey עובר למסך נפרד';
    const screen = SMPLWISE_SCREEN[this.tab];
    const only = wiskeySegmentOf(this.tab);
    return html`
      <div class="bar" data-wiskey-embed-bar>
        <span class="note ${this.direct === 'companion' ? '' : 'warn'}" data-wiskey-embed-note=${this.direct} ?data-phone-relay=${this.phoneRelay} data-relay-refused=${this.relayRefused}>${note}</span>
        <span class="grow"></span>
        ${screen ? this.openInHaButton() : nothing}
        ${phone ? nothing : this.fullLink()}
      </div>
      ${screen === 'wiskey-overview'
        ? html`<wiskey-overview></wiskey-overview>`
        : screen === 'wiskey-events'
          ? html`<wiskey-events></wiskey-events>`
          : screen === 'wiskey-people'
            ? html`<wiskey-people></wiskey-people>`
            : html`<div class="only" data-wiskey-embed-only=${only}>
                <div>
                  <sw-state-panel state="empty" heading=${`WisKey · ${label}`} hint=${`${note}. המסך "${label}" קיים רק בממשק של WisKey.`}></sw-state-panel>
                  <div class="actions">
                    ${this.openInHaButton('primary')}
                    ${this.direct === 'companion' ? nothing : html`<sw-button size="sm" icon="refresh" data-wiskey-embed-retry @click=${() => this.reload()}>נסה שוב</sw-button>`}
                  </div>
                </div>
              </div>`}
    `;
  }

  private toggleExpanded() {
    this.expanded = !this.expanded;
    writeExpanded(this.expanded);
  }

  private onMq = () => this.syncExpanded();

  private onEsc = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !this.expandedActive || e.defaultPrevented) return;
    this.toggleExpanded(); // Esc leaves "הגדל" (inside the frame the key belongs to WisKey)
  };

  /** "הגדל" is in force only on a desktop width with a frame (see the host style). */
  private syncExpanded() {
    this.setExpandedActive(this.isConnected && this.expanded && this.direct === '' && !this.forbidden && this.desktopMq.matches);
  }

  /** While expanded: the shell's rail, top bar, tab row and bottom nav are inert (Tab never reaches what is covered),
   * the system alert banner is raised above the layer (sw-app `:host([data-wiskey-expanded]) .sysbanner`, and the layer
   * starts below it), and Esc leaves. Everything is undone when it ends or the module is left. */
  private setExpandedActive(on: boolean) {
    if (on === this.expandedActive) return;
    this.expandedActive = on;
    const root = this.getRootNode();
    const shell = root instanceof ShadowRoot ? (root.host as HTMLElement) : null;
    shell?.toggleAttribute('data-wiskey-expanded', on);
    if (on) {
      const covered = root instanceof ShadowRoot ? Array.from(root.querySelectorAll<HTMLElement>('nav.rail, header.topbar, nav.bottom, main > :not(.screen)')) : [];
      this.inerted = covered.filter((el) => !el.inert);
      for (const el of this.inerted) el.inert = true;
      window.addEventListener('keydown', this.onEsc);
    } else {
      for (const el of this.inerted) el.inert = false;
      this.inerted = [];
      window.removeEventListener('keydown', this.onEsc);
    }
  }

  /** "הגדל" / "צמצם" (desktop; hidden on a phone, where the frame already has the screen below the top bar). */
  private expandButton() {
    const on = this.expanded;
    return html`<sw-button size="sm" variant="ghost" icon=${on ? 'close' : 'expand'} data-wiskey-expand aria-pressed=${String(on)} title=${on ? 'החזר את סרגל Arx ואת שורת הלשוניות' : 'הגדל את WisKey לכל גובה החלון; שורת הלשוניות עוברת לסרגל הזה'} @click=${() => this.toggleExpanded()}>${on ? 'צמצם' : 'הגדל'}</sw-button>`;
  }

  /** Expanded, the shell's tab row is covered: the same WisKey tabs, in the embed's bar (hidden by CSS otherwise). */
  private expandedTabs() {
    if (!this.expanded) return nothing;
    return html`<sw-tabs data-wiskey-bar-tabs .items=${visibleTabs(WISKEY_TABS, isApi(), canNav)} .active=${activeTabOf(parseRoute())}></sw-tabs>`;
  }

  private fullLink() {
    return html`<a class="full" data-wiskey-embed-full href=${wiskeyDeepLink(this.shown())} target="_blank" rel="noopener"><sw-icon name="expand" size=${14}></sw-icon>פתח בחלון מלא</a>`;
  }

  private statusNote() {
    if (this.phase === 'loading') return html`<span class="note" data-wiskey-embed-note="loading">טוען את WisKey…</span>`;
    if (this.phase === 'waiting') return html`<span class="note warn" data-wiskey-embed-note="waiting">WisKey עדיין לא אישר את החיבור - ממתין לטעינה או להזדהות בתוך WisKey</span>`;
    const notes = [];
    if (this.mode === 'legacy') notes.push(html`<span class="note" data-wiskey-embed-note="legacy">גרסת WisKey ללא ממשק ההטמעה (לפני rc.19) - ההטמעה בשיטה הקודמת</span>`);
    if (this.phase === 'ready' && this.mode === 'legacy' && this.chrome === 'visible') notes.push(html`<span class="note" data-wiskey-embed-note="chrome">תפריט נוסף מוצג סביב WisKey (ההסתרה לא נתמכת בגרסה הזו).</span>`);
    if (this.phase === 'ready' && this.mode === 'legacy' && this.tabApplied === false) notes.push(html`<span class="note" data-wiskey-embed-note="tab">לא ניתן לפתוח ישירות את "${TAB_LABELS[this.tab] ?? this.tab}"; WisKey נפתח במסך שלו.</span>`);
    return notes;
  }

  /** Embed API v1: the management tools of WisKey's ניהול hub (from the catalog), while the panel shows `tools`. Ids that
   * are top-level tabs too (users, devices, …) are already in the tab row. */
  private renderTools() {
    const c = this.catalog;
    if (this.mode !== 'v1' || !c || this.confirmed?.tab !== 'tools') return nothing;
    const tabIds = new Set(c.tabs.map((t) => t.id));
    const tools = c.tools.filter((t) => t.id && !tabIds.has(t.id));
    if (!tools.length) return nothing;
    const on = this.confirmed.tool;
    return html`<nav class="tools" aria-label="כלי הניהול של WisKey" data-wiskey-tools>
      <a href=${`#${wiskeyPath({ tab: 'tools' })}`} class=${on ? '' : 'on'} data-wiskey-tool="" aria-current=${on ? 'false' : 'page'}>${this.labelOf('tools')}</a>
      ${tools.map((t) => html`<a href=${`#${wiskeyPath({ tab: 'tools', tool: t.id })}`} class=${on === t.id ? 'on' : ''} data-wiskey-tool=${t.id} aria-current=${on === t.id ? 'page' : 'false'}>${t.label || t.id}</a>`)}
    </nav>`;
  }

  render() {
    if (this.forbidden) {
      return html`<sw-page heading="WisKey"><sw-state-panel data-wiskey-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בבקרת הכניסה" hint="נדרשת ההרשאה צפייה בבקרת כניסה (WisKey). פנה למנהל המערכת."></sw-state-panel></sw-page>`;
    }
    if (this.direct) return this.renderDirect();
    const failed = this.phase === 'not_installed' || this.phase === 'unreachable' || this.phase === 'blocked' || this.phase === 'unsupported';
    const shown = this.shown();
    const heading = this.mode === 'v1' && this.panelTitle ? this.panelTitle : this.labelOf(shown.tab);
    const confirmed = this.mode === 'v1' ? this.confirmed : null;
    return html`
      <div class="bar" data-wiskey-embed-bar>
        <span class="note">WisKey · <span class="title" data-wiskey-embed-title>${heading}</span></span>
        ${this.expandedTabs()}
        ${this.statusNote()}
        <span class="grow"></span>
        ${this.phase === 'ready' || this.phase === 'waiting'
          ? html`<sw-button size="sm" variant="ghost" icon="refresh" data-wiskey-embed-refresh title="טען מחדש את WisKey במסך הנוכחי (שינויים שלא נשמרו בתוך WisKey יאבדו)" @click=${() => this.reload()}>רענן</sw-button>`
          : nothing}
        ${this.expandButton()}
        ${this.fullLink()}
      </div>
      ${this.renderTools()}
      <div class="stage">
        ${keyed(
          this.frameKey,
          html`<iframe
            data-wiskey-embed-frame
            data-phase=${this.phase}
            data-embed-mode=${this.mode}
            data-chrome=${this.chrome}
            data-tab-applied=${this.tabApplied === null ? '' : String(this.tabApplied)}
            data-confirmed-tab=${confirmed?.tab ?? ''}
            data-confirmed-tool=${confirmed?.tool ?? ''}
            data-companion-shim=${this.shim}
            title="WisKey"
            ?data-hidden=${failed}
            allow="autoplay; microphone; camera; fullscreen; clipboard-write"
            allowfullscreen
            @load=${() => this.onLoad()}
          ></iframe>`,
        )}
        ${this.phase === 'loading' ? html`<div class="over"><sw-state-panel state="loading" heading="טוען את WisKey…" hint="הלוח נטען בתוך המסך; בפעם הראשונה זה לוקח כמה שניות."></sw-state-panel></div>` : nothing}
        ${failed ? this.renderError() : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-embed': WiskeyEmbed;
  }
}
