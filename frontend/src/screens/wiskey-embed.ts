import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { can, isApi } from '../api/session';
import './wiskey-overview';
import './wiskey-events';
import './wiskey-people';

/**
 * WisKey's own Home Assistant panel, embedded as-is (CR-005 recorded decision 2026-09-28, "embedded panel").
 *
 * The `hikvision_intercom` integration registers a custom panel at `/hikvision-intercom` (panel_custom,
 * `require_admin=False`, `embed_iframe=False`, webcomponent `hikvision-intercom-panel`). SMPLWISE runs under Supervisor
 * Ingress on Home Assistant's own origin, so a root-relative frame source is same-origin with Home Assistant: the frame
 * is a second, complete Home Assistant frontend that signs in with the user's own HA session - WisKey's permissions
 * and audit apply inside it, not SMPLWISE's. Home Assistant sends `X-Frame-Options: SAMEORIGIN`, which permits this.
 *
 * Same origin also lets this screen reach into the frame, defensively and fail-soft:
 * - the chrome: first the official lever, the frontend's `hass-kiosk-mode` window event (HA frontend 2026.1+; not
 *   persisted, unlike `hass-dock-sidebar`, which would also hide the sidebar in the user's own HA tabs); when that is
 *   not honoured, a style injected into `home-assistant-main`'s shadow root hides `ha-sidebar` and zeroes the sidebar
 *   width variables. If neither takes, the panel still works with HA's sidebar visible and a one-line note says so.
 * - the tab: WisKey's panel keeps its tab in memory only (panel.ts `_tab`, no URL routing), so the deep link is applied
 *   by calling the panel's own `navigate(tab)` once per SMPLWISE tab change or frame load, after the panel's session has
 *   loaded - it refuses tabs the user may not view, exactly as a click would - and the panel is then left alone. The
 *   `?tab=` in the frame address does nothing today; it is there for when the panel learns to read it.
 * What this screen reads inside the frame: `hass.kioskMode` and the keys of `hass.panels` on `<home-assistant>`, and the
 * panel's `_tab` / `_session` (whether it is loaded, never its content). No tokens, no localStorage, no entity state.
 *
 * The Home Assistant Companion app (owner's phone report, 0.1.122) is never nested. In the app, Home Assistant signs in
 * through the native bridge (frontend `src/data/external.ts` `isExternal`: `window.externalAppV2` / `externalApp` on
 * Android, `webkit.messageHandlers.getExternalAuth` on iOS), not through tokens in localStorage; the app answers the
 * frontend's token request by running `externalAuthSetToken` in its top document only. A second Home Assistant inside a
 * frame therefore either waits for a token that never comes (the bridge is visible in the frame: `<home-assistant>`
 * never gets `hass`) or, without the bridge and without stored tokens, redirects to `/auth/authorize`. So, before
 * framing, the app is detected (`isCompanionApp`: its user agent, or the bridge on this window or the top one), and a
 * login redirect or a Home Assistant that never connects inside the frame is `login_required`, never "not Home
 * Assistant". In both cases the tab shows the SMPLWISE screen where one exists (overview, events, people) or a short
 * note, plus "פתח ב-WisKey", which moves the TOP Home Assistant frontend to the panel the way its own `navigate()`
 * does (`src/common/navigate.ts`: pushState on the main window, then `location-changed`, which `home-assistant.ts`
 * routes on).
 */

/** The panel's address on the Home Assistant origin (panel.py `frontend_url_path`). */
export const WISKEY_PANEL_PATH = '/hikvision-intercom';
const PANEL_TAG = 'hikvision-intercom-panel';
const LOAD_TIMEOUT_MS = 20000; // no `load` at all: nothing answers at the address
const PANEL_TIMEOUT_MS = 25000; // Home Assistant loaded but never mounted the panel
const TAB_TIMEOUT_MS = 15000; // the panel's session (its permissions) loads after it mounts; navigate() refuses until then
const TICK_MS = 400;
const KEEP_MS = 2000; // after everything is settled: re-apply cheaply, Home Assistant may re-render

const TOP_SWITCH_MS = 1000; // "פתח ב-WisKey": Home Assistant's router gets this long before a full page load

export type EmbedPhase = 'loading' | 'ready' | 'login_required' | 'not_installed' | 'unreachable' | 'blocked';
/** Why the tab does not nest Home Assistant: the Companion app (known before framing) or a sign-in inside the frame. */
export type DirectReason = 'companion' | 'login_required' | '';
/** How the Home Assistant chrome ended up: hidden by the kiosk event, hidden by the injected style, or left visible. */
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

/** Hide Home Assistant's own sidebar around the panel; returns the lever that took, 'visible' when none did, or '' when
 * the structure is not there (yet). Never throws. */
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

/** "פתח ב-WisKey": move the TOP Home Assistant frontend to the WisKey panel, as its own `navigate()` does - pushState on
 * the main window, then `location-changed`, which `home-assistant.ts` routes on. When Home Assistant's router takes it,
 * the Ingress frame this code runs in is replaced and the check below never runs; when this frame is still in place
 * after a second and the panel is nowhere in the top document, a full page load of the address does it instead. */
export function openWiskeyInHa(win: Window = window): void {
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
    win.location.assign(WISKEY_PANEL_PATH);
    return;
  }
  const assign = () => {
    try {
      top.location.assign(WISKEY_PANEL_PATH);
    } catch {
      win.open(WISKEY_PANEL_PATH, '_top');
    }
  };
  try {
    top.history.pushState(null, '', WISKEY_PANEL_PATH);
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

@customElement('wiskey-embed')
export class WiskeyEmbed extends LitElement {
  /** The WisKey panel's own tab id (panel.ts `_tab`): overview, events, users, devices, sync, health, audit, tools. */
  @property() tab = 'overview';
  @state() private phase: EmbedPhase = 'loading';
  @state() private chrome: ChromeLever = '';
  /** null while being applied, true once the panel shows the tab, false when it did not take (the panel stays put). */
  @state() private tabApplied: boolean | null = null;
  @state() private src = '';
  /** Set when this tab does not nest Home Assistant (reflected for the evidence specs and the host style). */
  @property({ reflect: true, attribute: 'data-direct' }) direct: DirectReason = '';
  private forbidden = false;
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
    .stage {
      position: relative;
      flex: 1;
      min-block-size: 360px;
      display: flex;
    }
    iframe {
      flex: 1;
      inline-size: 100%;
      block-size: 100%;
      min-block-size: 360px;
      border: 0;
      background: var(--sw-bg);
    }
    iframe[data-hidden] {
      visibility: hidden;
    }
    .over {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: var(--sw-bg);
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
      // the app signs Home Assistant in through its native bridge, which a nested frame cannot use: never frame it
      this.direct = 'companion';
      return;
    }
    if (this.direct) return;
    if (!this.src) this.src = this.address(this.tab);
    this.startLoadTimer();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopTimers();
  }

  protected updated(changed: PropertyValues<this>) {
    if (!changed.has('tab') || changed.get('tab') === undefined || this.forbidden || this.direct) return;
    if (this.phase === 'ready' || this.phase === 'loading') {
      // same frame, other tab: navigate the loaded panel instead of loading all of Home Assistant again
      this.resetTab();
      this.tick();
    } else {
      this.reload();
    }
  }

  /** The frame address: the panel on the Home Assistant origin, with the tab for a panel that reads it some day. */
  private address(tab: string) {
    return `${WISKEY_PANEL_PATH}?tab=${encodeURIComponent(tab)}`;
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
      if (this.phase === 'loading' && !this.loadedAt) this.phase = 'unreachable';
    }, LOAD_TIMEOUT_MS);
  }

  private reload() {
    this.stopTimers();
    this.direct = '';
    this.phase = 'loading';
    this.chrome = '';
    this.tabApplied = null;
    this.loadedAt = 0;
    const next = this.address(this.tab);
    // the same address again still has to reload: clear it first
    this.src = '';
    void this.updateComplete.then(() => {
      this.src = next;
      this.startLoadTimer();
    });
  }

  private frame(): HTMLIFrameElement | null {
    return this.renderRoot.querySelector('iframe');
  }

  private onFrameNav = () => this.tick();

  private onLoad() {
    const f = this.frame();
    if (!f || !this.src) return;
    this.loadedAt = Date.now();
    this.panelEl = null;
    this.resetTab(); // a new document (ours or Home Assistant reloading itself): the deep link is owed once more
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
    this.frameWin?.removeEventListener('location-changed', this.onFrameNav);
    this.frameWin = f.contentWindow;
    this.frameWin?.addEventListener('location-changed', this.onFrameNav); // Home Assistant's own in-app navigation
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  /** One pass over the frame: what state it is in, the chrome, the tab. Idempotent, cheap, never throws. */
  private tick() {
    const f = this.frame();
    if (!f || !this.loadedAt) return;
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
      this.chrome = this.chrome === 'kiosk' || this.chrome === 'css' ? this.keepChrome(win, doc) : hideHaChrome(win, doc);
      if (!this.panelEl?.isConnected || this.panelEl.ownerDocument !== doc) this.panelEl = deepFind(doc, PANEL_TAG) as PanelEl | null;
      const panel = this.panelEl;
      if (!panel) {
        if (Date.now() - this.loadedAt > PANEL_TIMEOUT_MS) {
          // Home Assistant's page answered but never connected: its sign-in did not complete inside the frame (the
          // Companion bridge waits for a token the app delivers to its top document only) - not "not Home Assistant"
          if (!ha.hass) return this.goDirect();
          this.phase = path.startsWith(WISKEY_PANEL_PATH) ? 'unreachable' : 'not_installed';
          this.settle();
        }
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

  /** With the chrome hidden, the panel's own menu button would open Home Assistant's drawer over it; swallow that. */
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

  /** The deep link is applied ONCE per SMPLWISE tab change or frame load, then the panel is left alone: WisKey's own
   * navigation (a tool opened from ניהול, a drill-down) must never be undone by a later tick, and a navigate() into a
   * schedule with unsaved edits asks WisKey's canLeave() confirm - at most once, as a click would.
   * WisKey's navigate() refuses every tab until the panel's `_session` (its permissions) has loaded, so it is called
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

  /** Home Assistant cannot sign in inside the frame: drop the frame and show the tab without nesting. */
  private goDirect() {
    this.stopTimers();
    this.phase = 'login_required';
    this.direct = 'login_required';
    this.panelEl = null;
    this.src = '';
  }

  /** A final state: stop polling (the retry button starts over). */
  private settle() {
    window.clearInterval(this.timer);
    this.timer = 0;
  }

  // ------------------------------------------------------------------ render

  private renderError() {
    const common = 'אפשר לנסות שוב, לפתוח את WisKey ב־Home Assistant או בחלון מלא, או לבחור בהגדרות › בקרות כניסה את מסכי SMPLWISE.';
    const map: Record<string, { heading: string; hint: string; state: 'error' | 'stale' | 'empty' }> = {
      not_installed: { heading: 'לוח WisKey לא נמצא ב־Home Assistant', hint: `האינטגרציה hikvision_intercom לא רשמה את הלוח ${WISKEY_PANEL_PATH} (לא מותקנת, לא נטענה, או שהמשתמש לא רואה אותו). ${common}`, state: 'empty' },
      unreachable: { heading: 'לא ניתן לטעון את WisKey מתוך Home Assistant', hint: `הכתובת ${WISKEY_PANEL_PATH} לא החזירה את Home Assistant בתוך המסגרת. כנראה אפליקציית Home Assistant - ההזדהות שלה אינה זמינה בתוך מסגרת; או שהממשק פתוח שלא דרך Home Assistant. ${common}`, state: 'stale' },
      blocked: { heading: 'הדפדפן לא מאפשר להטמיע את WisKey כאן', hint: `המסגרת נחסמה (מדיניות מסגרות) או הופנתה לכתובת אחרת. ${common}`, state: 'error' },
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
    return html`<sw-button size="sm" variant=${variant} icon="door" data-wiskey-open-ha @click=${() => openWiskeyInHa()}>פתח ב-WisKey</sw-button>`;
  }

  /** The tab without a nested Home Assistant: the SMPLWISE screen where one exists, otherwise a short note. */
  private renderDirect() {
    const label = TAB_LABELS[this.tab] ?? this.tab;
    const phone = this.direct === 'companion';
    const note = phone
      ? 'בטלפון WisKey נפתח באפליקציה עצמה'
      : 'Home Assistant מבקש התחברות בתוך המסגרת, ולכן WisKey נפתח ב־Home Assistant עצמו';
    const screen = SMPLWISE_SCREEN[this.tab];
    return html`
      <div class="bar" data-wiskey-embed-bar>
        <span class="note ${phone ? '' : 'warn'}" data-wiskey-embed-note=${this.direct}>${note}</span>
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
            : html`<div class="only" data-wiskey-embed-only=${this.tab}>
                <div>
                  <sw-state-panel state="empty" heading=${`WisKey · ${label}`} hint=${`${note}. המסך "${label}" קיים רק בממשק של WisKey.`}></sw-state-panel>
                  <div class="actions">
                    ${this.openInHaButton('primary')}
                    ${phone ? nothing : html`<sw-button size="sm" icon="refresh" data-wiskey-embed-retry @click=${() => this.reload()}>נסה שוב</sw-button>`}
                  </div>
                </div>
              </div>`}
    `;
  }

  private fullLink() {
    return html`<a class="full" data-wiskey-embed-full href=${this.address(this.tab)} target="_blank" rel="noopener"><sw-icon name="expand" size=${14}></sw-icon>פתח בחלון מלא</a>`;
  }

  private statusNote() {
    if (this.phase === 'loading') return html`<span class="note" data-wiskey-embed-note="loading">טוען את WisKey מתוך Home Assistant…</span>`;
    const notes = [];
    if (this.phase === 'ready' && this.chrome === 'visible') notes.push(html`<span class="note" data-wiskey-embed-note="chrome">התפריט של Home Assistant מוצג סביב WisKey (ההסתרה לא נתמכת בגרסה הזו).</span>`);
    if (this.phase === 'ready' && this.tabApplied === false) notes.push(html`<span class="note" data-wiskey-embed-note="tab">לא ניתן לפתוח ישירות את "${TAB_LABELS[this.tab] ?? this.tab}"; WisKey נפתח במסך שלו.</span>`);
    return notes;
  }

  render() {
    if (this.forbidden) {
      return html`<sw-page heading="WisKey"><sw-state-panel data-wiskey-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בבקרת הכניסה" hint="נדרשת ההרשאה צפייה בבקרת כניסה (WisKey). פנה למנהל המערכת."></sw-state-panel></sw-page>`;
    }
    if (this.direct) return this.renderDirect();
    const failed = this.phase === 'not_installed' || this.phase === 'unreachable' || this.phase === 'blocked';
    return html`
      <div class="bar" data-wiskey-embed-bar>
        <span class="note">WisKey · ${TAB_LABELS[this.tab] ?? this.tab} · הממשק המקורי של WisKey</span>
        ${this.statusNote()}
        <span class="grow"></span>
        ${this.fullLink()}
      </div>
      <div class="stage">
        ${this.src
          ? html`<iframe
              data-wiskey-embed-frame
              data-phase=${this.phase}
              data-chrome=${this.chrome}
              data-tab-applied=${this.tabApplied === null ? '' : String(this.tabApplied)}
              title="WisKey"
              src=${this.src}
              ?data-hidden=${failed}
              allow="microphone; camera; autoplay; fullscreen; clipboard-write"
              allowfullscreen
              @load=${() => this.onLoad()}
            ></iframe>`
          : nothing}
        ${this.phase === 'loading' ? html`<div class="over"><sw-state-panel state="loading" heading="טוען את WisKey…" hint="Home Assistant נטען בתוך המסך; בפעם הראשונה זה לוקח כמה שניות."></sw-state-panel></div>` : nothing}
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
