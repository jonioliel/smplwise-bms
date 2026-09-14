import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import '../components/sw-icon';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-tabs';
import '../components/sw-avatar';
import '../screens/explore-floor-map';
import '../screens/explore-sites';
import '../screens/explore-floors';
import '../screens/explore-plan-import';
import '../screens/explore-plan-editor';
import '../screens/explore-entities';
import '../screens/explore-access';
import '../screens/live-overview';
import '../screens/live-wall';
import '../screens/live-camera';
import '../screens/live-views';
import '../screens/kiosk-wall';
import '../screens/investigate-playback';
import '../screens/investigate-sync';
import '../screens/investigate-history-map';
import '../screens/investigate-events';
import '../screens/investigate-reviews';
import '../screens/investigate-cases';
import '../screens/investigate-exports';
import '../screens/investigate-search';
import '../screens/investigate-rules';
import '../screens/system-access';
import '../screens/system-audit';
import '../screens/system-setup';
import '../screens/system-devices';
import '../screens/system-diagnostics';
import '../screens/system-storage';
import '../screens/screens-index';
import '../screens/styleguide-screen';
import { onRouteChange, type RouteState } from '../router';
import { NAV, GROUP_TABS, groupOf, activeTabOf } from './nav';
import { t } from '../i18n/he';
import { loadSession, onSession, type Session } from '../api/session';
import '../components/sw-state-panel';

/**
 * Application shell in the boards' language: a compact white side nav (brand mark, six flat entries,
 * active entry as a soft-blue pill), a white top bar with a small search field, alerts and the HA
 * identity avatar, and the section's pages as a quiet pill-tab row above the content. Phones use a
 * bottom bar; narrow tablets collapse the side nav to icons.
 */
@customElement('sw-app')
export class SwApp extends LitElement {
  @state() private route: RouteState | null = null;
  @state() private session: Session = { mode: 'loading', me: null, error: null };
  private stopRouter?: () => void;
  private stopSession?: () => void;

  static styles = css`
    :host {
      display: grid;
      grid-template-columns: var(--sw-rail-w-wide) minmax(0, 1fr);
      grid-template-rows: var(--sw-topbar-h) minmax(0, 1fr);
      grid-template-areas:
        'rail topbar'
        'rail main';
      block-size: 100dvh;
      background: var(--sw-bg);
    }
    :host([data-kiosk]) {
      display: block;
    }
    nav.rail {
      grid-area: rail;
      display: flex;
      flex-direction: column;
      background: var(--sw-surface);
      border-inline-end: 1px solid var(--sw-border);
      padding: 10px 10px 8px;
      gap: 2px;
      overflow: auto;
      scrollbar-width: none;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 6px 14px;
      min-block-size: 44px;
    }
    .brand img {
      block-size: 26px;
      inline-size: auto;
    }
    .brand .name {
      font-weight: var(--sw-fw-bold);
      font-size: 13px;
      color: var(--sw-text);
      white-space: nowrap;
      letter-spacing: -0.01em;
    }
    a.item {
      display: flex;
      align-items: center;
      gap: 9px;
      min-block-size: 32px;
      padding: 0 10px;
      border-radius: 8px;
      color: var(--sw-text-2);
      text-decoration: none;
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-sm);
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    a.item sw-icon {
      color: var(--sw-text-3);
    }
    a.item:hover {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    a.item.active {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    a.item.active sw-icon {
      color: var(--sw-accent);
    }
    .rail .grow {
      flex: 1;
    }
    a.item.small {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      min-block-size: 26px;
      font-weight: var(--sw-fw-regular);
    }
    header.topbar {
      grid-area: topbar;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 20px;
      background: var(--sw-surface);
      border-block-end: 1px solid var(--sw-border);
      z-index: var(--sw-z-topbar);
    }
    .search {
      inline-size: 280px;
      display: flex;
      align-items: center;
      gap: 8px;
      block-size: 30px;
      padding: 0 10px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-surface-2);
      color: var(--sw-text-3);
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    .search:focus-within {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
      background: var(--sw-surface);
    }
    .search input {
      flex: 1;
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      outline: none;
      min-inline-size: 0;
    }
    .topbar .spacer {
      flex: 1;
    }
    .brand-mobile {
      display: none;
      align-items: center;
    }
    .brand-mobile img {
      block-size: 24px;
      inline-size: auto;
    }
    .bell {
      position: relative;
    }
    .bell::after {
      content: '';
      position: absolute;
      inset-inline-end: 6px;
      inset-block-start: 5px;
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: var(--sw-danger);
      border: 1.5px solid var(--sw-surface);
    }
    main {
      grid-area: main;
      min-block-size: 0;
      min-inline-size: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
    }
    .subnav {
      padding: 12px 24px 0;
      display: flex;
    }
    .subnav:empty {
      display: none;
    }
    main > .screen {
      flex: 1;
      min-block-size: 0;
      display: flex;
      flex-direction: column;
    }
    main > .screen > * {
      flex: 1;
      min-block-size: 0;
    }
    nav.bottom {
      display: none;
    }
    .gate {
      flex: 1;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .who {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .who b {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    @media (max-width: 1023px) {
      :host {
        grid-template-columns: var(--sw-rail-w) minmax(0, 1fr);
      }
      .brand .name,
      a.item span {
        display: none;
      }
      a.item {
        justify-content: center;
        padding: 0;
      }
      .brand {
        justify-content: center;
        padding-inline: 0;
      }
      .subnav {
        padding: 10px 16px 0;
        overflow-x: auto;
        scrollbar-width: none;
      }
    }
    @media (max-width: 767px) {
      :host {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: var(--sw-topbar-h) minmax(0, 1fr) var(--sw-bottomnav-h);
        grid-template-areas:
          'topbar'
          'main'
          'bottom';
      }
      nav.rail {
        display: none;
      }
      header.topbar {
        padding: 0 12px;
      }
      .subnav {
        padding: 8px 12px 0;
      }
      nav.bottom {
        grid-area: bottom;
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        background: var(--sw-surface);
        border-block-start: 1px solid var(--sw-border);
        padding-block-end: env(safe-area-inset-bottom);
      }
      nav.bottom a {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        font-size: 10px;
        color: var(--sw-text-3);
        text-decoration: none;
        min-block-size: var(--sw-bottomnav-h);
        font-weight: var(--sw-fw-medium);
      }
      nav.bottom a.active {
        color: var(--sw-accent-text);
      }
      .brand-mobile {
        display: inline-flex;
      }
      .search {
        display: none;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.stopSession = onSession((s) => (this.session = s));
    void loadSession();
    this.stopRouter = onRouteChange((route) => {
      this.route = route;
      this.toggleAttribute('data-kiosk', route.segments[0] === 'kiosk');
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopRouter?.();
    this.stopSession?.();
  }

  /** Full-screen gate for identity problems; `null` (not lit's `nothing`, which is truthy) when the app may render. */
  private renderGate() {
    const s = this.session;
    if (s.mode === 'unauthenticated') {
      return html`<div class="gate"><sw-state-panel state="forbidden" heading="הזדהות דרך Home Assistant נדרשת" hint=${s.error ?? ''}></sw-state-panel></div>`;
    }
    if (s.mode === 'no_access') {
      return html`<div class="gate"><sw-state-panel state="forbidden" heading="אין לך עדיין תפקיד במערכת" hint="המשתמש ${s.me?.user.display_name || s.me?.user.username || ''} מזוהה מ־Home Assistant, אך מנהל ה־VMS טרם שייך לו תפקיד והיקף. פנה למנהל המערכת."></sw-state-panel></div>`;
    }
    return null;
  }

  private renderScreen() {
    const r = this.route;
    if (!r) return nothing;
    const s = r.segments;
    if (s[0] === 'styleguide') return html`<styleguide-screen></styleguide-screen>`;
    if (s[0] === 'screens') return html`<screens-index></screens-index>`;
    if (s[0] === 'kiosk') return html`<kiosk-wall></kiosk-wall>`;
    switch (r.mode) {
      case 'live':
        if (s[1] === 'wall') return html`<live-wall></live-wall>`;
        if (s[1] === 'views') return html`<live-views></live-views>`;
        if (s[1] === 'cameras') return html`<live-camera .cameraId=${s[2] ?? 'cam-1'}></live-camera>`;
        return html`<live-overview></live-overview>`;
      case 'investigate':
        if (s[1] === 'playback' && s[2] === 'sync') return html`<investigate-sync></investigate-sync>`;
        if (s[1] === 'playback') return html`<investigate-playback></investigate-playback>`;
        if (s[1] === 'floors') return html`<investigate-history-map .floorId=${s[2] ?? 'f0'}></investigate-history-map>`;
        if (s[1] === 'events') return html`<investigate-events></investigate-events>`;
        if (s[1] === 'reviews') return html`<investigate-reviews></investigate-reviews>`;
        if (s[1] === 'cases' && s[2]) return html`<investigate-case-detail .caseId=${s[2]}></investigate-case-detail>`;
        if (s[1] === 'cases') return html`<investigate-cases></investigate-cases>`;
        if (s[1] === 'exports') return html`<investigate-exports></investigate-exports>`;
        if (s[1] === 'search') return html`<investigate-search></investigate-search>`;
        if (s[1] === 'rules' && s[2]) return html`<investigate-rule-editor .ruleId=${s[2]}></investigate-rule-editor>`;
        if (s[1] === 'rules') return html`<investigate-rules></investigate-rules>`;
        return html`<investigate-playback></investigate-playback>`;
      case 'system':
        if (s[1] === 'audit') return html`<system-audit></system-audit>`;
        if (s[1] === 'setup') return html`<system-setup></system-setup>`;
        if (s[1] === 'devices') return html`<system-devices></system-devices>`;
        if (s[1] === 'storage') return html`<system-storage></system-storage>`;
        if (s[1] === 'access') return html`<system-access></system-access>`;
        return html`<system-diagnostics></system-diagnostics>`;
      case 'explore':
      default: {
        if (s[1] === 'sites') return html`<explore-sites></explore-sites>`;
        if (s[1] === 'buildings') return html`<explore-floors .buildingId=${s[2] ?? 'bld-a'}></explore-floors>`;
        if (s[1] === 'entities') return html`<explore-entities></explore-entities>`;
        if (s[1] === 'access') return html`<explore-access></explore-access>`;
        if (s[1] === 'floors' && s[3] === 'import') return html`<explore-plan-import .floorId=${s[2]}></explore-plan-import>`;
        if (s[1] === 'floors' && s[3] === 'edit') return html`<explore-plan-editor .floorId=${s[2]}></explore-plan-editor>`;
        const floorId = s[1] === 'floors' && s[2] ? s[2] : 'f0';
        const screenState = (r.params.get('state') ?? 'ready') as 'ready';
        return html`<explore-floor-map .floorId=${floorId} .screenState=${screenState}></explore-floor-map>`;
      }
    }
  }

  render() {
    const base = import.meta.env.BASE_URL;
    if (this.route?.segments[0] === 'kiosk') return html`<main style="block-size:100dvh">${this.renderScreen()}</main>`;
    const group = groupOf(this.route);
    const tabs = group ? GROUP_TABS[group] : [];
    const editor = this.route?.segments[3] === 'edit' || this.route?.segments[3] === 'import';
    return html`
      <nav class="rail" aria-label="ניווט ראשי">
        <div class="brand">
          <img src="${base}brand/smplwise-mark.png" alt="SmplWise" />
          <span class="name">SmplWise</span>
        </div>
        ${NAV.map(
          (n) => html`<a class=${classMap({ item: true, active: group === n.id })} href=${n.href} title=${n.label} aria-current=${group === n.id ? 'page' : 'false'}>
            <sw-icon .name=${n.icon} size=${16}></sw-icon><span>${n.label}</span>
          </a>`,
        )}
        <div class="grow"></div>
        <a class=${classMap({ item: true, small: true, active: this.route?.segments[0] === 'screens' })} href="#/screens" title="כל המסכים">
          <sw-icon name="list" size=${14}></sw-icon><span>כל המסכים</span>
        </a>
        <a class=${classMap({ item: true, small: true, active: this.route?.segments[0] === 'styleguide' })} href="#/styleguide" title=${t('nav.styleguide')}>
          <sw-icon name="layers" size=${14}></sw-icon><span>${t('nav.styleguide')}</span>
        </a>
      </nav>
      <header class="topbar">
        <span class="brand-mobile"><img src="${base}brand/smplwise-mark.png" alt="SmplWise" /></span>
        <label class="search"><sw-icon name="search" size=${14}></sw-icon><input type="search" placeholder=${t('app.search')} aria-label=${t('app.search')} /></label>
        <span class="spacer"></span>
        ${this.session.mode === 'api' || this.session.mode === 'no_access'
          ? html`<span class="who"><b>${this.session.me?.user.display_name || this.session.me?.user.username}</b>${this.session.me?.bindings[0] ? html`<span>· ${this.session.me.bindings[0].role_name}</span>` : nothing}</span>`
          : this.session.mode === 'demo'
            ? html`<sw-badge kind="neutral" label="נתוני הדגמה"></sw-badge>`
            : nothing}
        <sw-button class="bell" variant="ghost" size="sm" iconOnly icon="bell" label=${t('app.notifications')}></sw-button>
        <sw-avatar name=${this.session.me?.user.display_name || this.session.me?.user.username || 'יוני'} size=${28} title=${t('app.account')} aria-label=${t('app.account')}></sw-avatar>
      </header>
      <main>
        ${this.renderGate() || html`
          <div class="subnav">${tabs.length > 1 && !editor ? html`<sw-tabs .items=${tabs} .active=${activeTabOf(this.route)}></sw-tabs>` : nothing}</div>
          <div class="screen">${this.session.mode === 'loading' ? nothing : this.renderScreen()}</div>`}
      </main>
      <nav class="bottom" aria-label="ניווט ראשי">
        ${NAV.slice(0, 4).map((n) => html`<a class=${classMap({ active: group === n.id })} href=${n.href}><sw-icon .name=${n.icon} size=${20}></sw-icon>${n.label}</a>`)}
        <a class=${classMap({ active: group === 'settings' || group === 'playback' })} href="#/system/diagnostics"><sw-icon name="more" size=${20}></sw-icon>עוד</a>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-app': SwApp;
  }
}
