import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { can, isApi } from '../api/session';

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
 */

/** The panel's address on the Home Assistant origin (panel.py `frontend_url_path`). */
export const WISKEY_PANEL_PATH = '/hikvision-intercom';
const PANEL_TAG = 'hikvision-intercom-panel';
const LOAD_TIMEOUT_MS = 20000; // no `load` at all: nothing answers at the address
const PANEL_TIMEOUT_MS = 25000; // Home Assistant loaded but never mounted the panel
const TAB_TIMEOUT_MS = 15000; // the panel's session (its permissions) loads after it mounts; navigate() refuses until then
const TICK_MS = 400;
const KEEP_MS = 2000; // after everything is settled: re-apply cheaply, Home Assistant may re-render

export type EmbedPhase = 'loading' | 'ready' | 'login' | 'not_installed' | 'unreachable' | 'blocked';
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

@customElement('wiskey-embed')
export class WiskeyEmbed extends LitElement {
  /** The WisKey panel's own tab id (panel.ts `_tab`): overview, events, users, devices, sync, health, audit, tools. */
  @property() tab = 'overview';
  @state() private phase: EmbedPhase = 'loading';
  @state() private chrome: ChromeLever = '';
  /** null while being applied, true once the panel shows the tab, false when it did not take (the panel stays put). */
  @state() private tabApplied: boolean | null = null;
  @state() private src = '';
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
    if (!this.src) this.src = this.address(this.tab);
    this.startLoadTimer();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopTimers();
  }

  protected updated(changed: PropertyValues<this>) {
    if (!changed.has('tab') || changed.get('tab') === undefined || this.forbidden) return;
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
        // Home Assistant asks the user to sign in inside the frame (no stored session for this origin); leave it usable
        this.phase = 'login';
        return;
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

  /** A final state: stop polling (the retry button starts over). */
  private settle() {
    window.clearInterval(this.timer);
    this.timer = 0;
  }

  // ------------------------------------------------------------------ render

  private renderError() {
    const common = 'אפשר לנסות שוב, לפתוח את WisKey בחלון מלא, או לבחור בהגדרות › בקרות כניסה את מסכי SMPLWISE.';
    const map: Record<string, { heading: string; hint: string; state: 'error' | 'stale' | 'empty' }> = {
      not_installed: { heading: 'לוח WisKey לא נמצא ב־Home Assistant', hint: `האינטגרציה hikvision_intercom לא רשמה את הלוח ${WISKEY_PANEL_PATH} (לא מותקנת, לא נטענה, או שהמשתמש לא רואה אותו). ${common}`, state: 'empty' },
      unreachable: { heading: 'לא ניתן לטעון את WisKey מתוך Home Assistant', hint: `הכתובת ${WISKEY_PANEL_PATH} לא החזירה את Home Assistant (למשל כשהממשק פתוח שלא דרך Home Assistant). ${common}`, state: 'stale' },
      blocked: { heading: 'הדפדפן לא מאפשר להטמיע את WisKey כאן', hint: `המסגרת נחסמה (מדיניות מסגרות) או הופנתה לכתובת אחרת. ${common}`, state: 'error' },
    };
    const m = map[this.phase];
    if (!m) return nothing;
    return html`<div class="over" data-wiskey-embed-error=${this.phase}>
      <div>
        <sw-state-panel state=${m.state} heading=${m.heading} hint=${m.hint}></sw-state-panel>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <sw-button size="sm" icon="refresh" data-wiskey-embed-retry @click=${() => this.reload()}>נסה שוב</sw-button>
          ${this.fullLink()}
        </div>
      </div>
    </div>`;
  }

  private fullLink() {
    return html`<a class="full" data-wiskey-embed-full href=${this.address(this.tab)} target="_blank" rel="noopener"><sw-icon name="expand" size=${14}></sw-icon>פתח בחלון מלא</a>`;
  }

  private statusNote() {
    if (this.phase === 'loading') return html`<span class="note" data-wiskey-embed-note="loading">טוען את WisKey מתוך Home Assistant…</span>`;
    if (this.phase === 'login') return html`<span class="note warn" data-wiskey-embed-note="login">Home Assistant מבקש התחברות בתוך המסגרת; אפשר להתחבר כאן או לפתוח בחלון מלא.</span>`;
    const notes = [];
    if (this.phase === 'ready' && this.chrome === 'visible') notes.push(html`<span class="note" data-wiskey-embed-note="chrome">התפריט של Home Assistant מוצג סביב WisKey (ההסתרה לא נתמכת בגרסה הזו).</span>`);
    if (this.phase === 'ready' && this.tabApplied === false) notes.push(html`<span class="note" data-wiskey-embed-note="tab">לא ניתן לפתוח ישירות את "${TAB_LABELS[this.tab] ?? this.tab}"; WisKey נפתח במסך שלו.</span>`);
    return notes;
  }

  render() {
    if (this.forbidden) {
      return html`<sw-page heading="WisKey"><sw-state-panel data-wiskey-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בבקרת הכניסה" hint="נדרשת ההרשאה צפייה בבקרת כניסה (WisKey). פנה למנהל המערכת."></sw-state-panel></sw-page>`;
    }
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
