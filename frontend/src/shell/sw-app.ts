import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import '../components/sw-icon';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-tabs';
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
import type { IconName } from '../components/sw-icon';
import type { TabItem } from '../components/sw-tabs';
import { onRouteChange, type Mode, type RouteState } from '../router';
import { t } from '../i18n/he';

const MODES: { id: Mode; icon: IconName; label: () => string }[] = [
  { id: 'live', icon: 'live', label: () => t('modes.live') },
  { id: 'explore', icon: 'explore', label: () => t('modes.explore') },
  { id: 'investigate', icon: 'investigate', label: () => t('modes.investigate') },
  { id: 'system', icon: 'system', label: () => t('modes.system') },
];

// Secondary navigation per mode: routes, drawers and editors are never top-level items.
const MODE_TABS: Record<Mode, TabItem[]> = {
  live: [
    { id: 'overview', label: 'סקירה', href: '#/live' },
    { id: 'wall', label: 'קיר מצלמות', href: '#/live/wall' },
    { id: 'views', label: 'תצוגות שמורות', href: '#/live/views' },
  ],
  explore: [
    { id: 'sites', label: 'אתרים', href: '#/explore/sites' },
    { id: 'floors', label: 'מפת קומה', href: '#/explore/floors/f0' },
    { id: 'entities', label: 'ישויות HA', href: '#/explore/entities' },
    { id: 'access', label: 'דלתות', href: '#/explore/access/d1' },
  ],
  investigate: [
    { id: 'playback', label: 'הקלטות', href: '#/investigate/playback' },
    { id: 'events', label: 'אירועים', href: '#/investigate/events' },
    { id: 'floors', label: 'מפה היסטורית', href: '#/investigate/floors/f0/history' },
    { id: 'reviews', label: 'Review', href: '#/investigate/reviews' },
    { id: 'cases', label: 'תיקים', href: '#/investigate/cases' },
    { id: 'exports', label: 'ייצוא', href: '#/investigate/exports' },
    { id: 'search', label: 'חיפוש', href: '#/investigate/search' },
    { id: 'rules', label: 'חוקים', href: '#/investigate/rules' },
  ],
  system: [
    { id: 'access', label: 'משתמשים והרשאות', href: '#/system/access' },
    { id: 'audit', label: 'אודיט', href: '#/system/audit' },
    { id: 'devices', label: 'מכשירים', href: '#/system/devices' },
    { id: 'diagnostics', label: 'הגדרות', href: '#/system/diagnostics' },
    { id: 'storage', label: 'אחסון', href: '#/system/storage' },
    { id: 'setup', label: 'אשף התקנה', href: '#/system/setup' },
  ],
};

/**
 * Application shell: four primary modes only (Live / Explore / Investigate / System). Desktop shows a
 * navigation rail at the inline start (right side in RTL); phones use a bottom bar.
 */
@customElement('sw-app')
export class SwApp extends LitElement {
  @state() private route: RouteState | null = null;
  private stopRouter?: () => void;

  static styles = css`
    :host {
      display: grid;
      grid-template-columns: var(--sw-rail-w-wide) minmax(0, 1fr);
      grid-template-rows: var(--sw-topbar-h) auto minmax(0, 1fr);
      grid-template-areas:
        'rail topbar'
        'rail tabs'
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
      padding: var(--sw-s-3);
      gap: var(--sw-s-1);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      padding: var(--sw-s-2) var(--sw-s-2) var(--sw-s-4);
      min-block-size: 56px;
    }
    .brand img {
      block-size: 28px;
      inline-size: auto;
    }
    .brand .name {
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-md);
      color: var(--sw-text);
      white-space: nowrap;
    }
    .brand .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-medium);
      letter-spacing: 0.04em;
    }
    a.item {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      min-block-size: var(--sw-touch);
      padding: 0 var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      text-decoration: none;
      font-weight: var(--sw-fw-medium);
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    a.item:hover {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    a.item.active {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .rail .grow {
      flex: 1;
    }
    a.item.small {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      min-block-size: 36px;
    }
    header.topbar {
      grid-area: topbar;
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      padding: 0 var(--sw-s-4);
      background: var(--sw-surface);
      border-block-end: 1px solid var(--sw-border);
      z-index: var(--sw-z-topbar);
    }
    .search {
      flex: 1;
      max-inline-size: 520px;
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-block-size: 40px;
      padding: 0 var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
      color: var(--sw-text-3);
    }
    .search input {
      flex: 1;
      border: 0;
      background: transparent;
      font: inherit;
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
      block-size: 26px;
      inline-size: auto;
    }
    .avatar {
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      display: grid;
      place-items: center;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
    }
    .modetabs {
      grid-area: tabs;
      background: var(--sw-surface);
      border-block-end: 1px solid var(--sw-border);
      padding: 0 var(--sw-s-4);
    }
    .modetabs sw-tabs {
      border-block-end: 0;
    }
    main {
      grid-area: main;
      min-block-size: 0;
      min-inline-size: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
    }
    main > * {
      flex: 1;
      min-block-size: 0;
    }
    nav.bottom {
      display: none;
    }
    @media (max-width: 1279px) {
      :host {
        grid-template-columns: var(--sw-rail-w) minmax(0, 1fr);
      }
      .brand .name,
      .brand .sub,
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
    }
    @media (max-width: 767px) {
      :host {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: var(--sw-topbar-h) auto minmax(0, 1fr) var(--sw-bottomnav-h);
        grid-template-areas:
          'topbar'
          'tabs'
          'main'
          'bottom';
      }
      nav.rail {
        display: none;
      }
      .modetabs {
        padding: 0 var(--sw-s-2);
      }
      nav.bottom {
        grid-area: bottom;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        background: var(--sw-surface);
        border-block-start: 1px solid var(--sw-border);
        padding-block-end: env(safe-area-inset-bottom);
      }
      nav.bottom a {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-2);
        text-decoration: none;
        min-block-size: var(--sw-bottomnav-h);
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
    this.stopRouter = onRouteChange((route) => {
      this.route = route;
      this.toggleAttribute('data-kiosk', route.segments[0] === 'kiosk');
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopRouter?.();
  }

  private activeTab(): string {
    const s = this.route?.segments ?? [];
    if (!this.route?.mode) return '';
    if (s.length === 1) return this.route.mode === 'live' ? 'overview' : this.route.mode === 'explore' ? 'floors' : this.route.mode === 'investigate' ? 'playback' : 'access';
    if (this.route.mode === 'live' && s[1] === 'cameras') return 'wall';
    if (this.route.mode === 'explore' && (s[1] === 'buildings' || s[1] === 'floors')) return 'floors';
    return s[1];
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
        if (s[1] === 'diagnostics') return html`<system-diagnostics></system-diagnostics>`;
        if (s[1] === 'storage') return html`<system-storage></system-storage>`;
        return html`<system-access></system-access>`;
      case 'explore':
      default: {
        if (s[1] === 'sites') return html`<explore-sites></explore-sites>`;
        if (s[1] === 'buildings') return html`<explore-floors .buildingId=${s[2] ?? 'bld-a'}></explore-floors>`;
        if (s[1] === 'entities') return html`<explore-entities></explore-entities>`;
        if (s[1] === 'access') return html`<explore-access></explore-access>`;
        if (s[1] === 'floors' && s[3] === 'import') return html`<explore-plan-import></explore-plan-import>`;
        if (s[1] === 'floors' && s[3] === 'edit') return html`<explore-plan-editor></explore-plan-editor>`;
        const floorId = s[1] === 'floors' && s[2] ? s[2] : 'f0';
        const screenState = (r.params.get('state') ?? 'ready') as 'ready';
        return html`<explore-floor-map .floorId=${floorId} .screenState=${screenState}></explore-floor-map>`;
      }
    }
  }

  private navItem(m: (typeof MODES)[number]) {
    const active = this.route?.mode === m.id;
    return html`<a class=${classMap({ item: true, active })} href=${`#/${m.id}`} aria-current=${active ? 'page' : 'false'}>
      <sw-icon .name=${m.icon} size=${22}></sw-icon><span>${m.label()}</span>
    </a>`;
  }

  render() {
    const base = import.meta.env.BASE_URL;
    if (this.route?.segments[0] === 'kiosk') return html`<main style="block-size:100dvh">${this.renderScreen()}</main>`;
    const mode = this.route?.mode;
    const tabs = mode ? MODE_TABS[mode] : [];
    return html`
      <nav class="rail" aria-label="ניווט ראשי">
        <div class="brand">
          <img src="${base}brand/smplwise-mark.png" alt="SmplWise" />
          <div><div class="name">SmplWise</div><div class="sub">VMS</div></div>
        </div>
        ${MODES.map((m) => this.navItem(m))}
        <div class="grow"></div>
        <a class=${classMap({ item: true, small: true, active: this.route?.segments[0] === 'screens' })} href="#/screens">
          <sw-icon name="list" size=${18}></sw-icon><span>כל המסכים</span>
        </a>
        <a class=${classMap({ item: true, small: true, active: this.route?.segments[0] === 'styleguide' })} href="#/styleguide">
          <sw-icon name="layers" size=${18}></sw-icon><span>${t('nav.styleguide')}</span>
        </a>
      </nav>
      <header class="topbar">
        <span class="brand-mobile"><img src="${base}brand/smplwise-mark.png" alt="SmplWise" /></span>
        <label class="search"><sw-icon name="search" size=${18}></sw-icon><input type="search" placeholder=${t('app.search')} aria-label=${t('app.search')} /></label>
        <span class="spacer"></span>
        <sw-badge kind="stale" label="נתוני הדגמה"></sw-badge>
        <sw-button variant="ghost" iconOnly icon="bell" label=${t('app.notifications')}></sw-button>
        <span class="avatar" title=${t('app.account')} aria-label=${t('app.account')}>HA</span>
      </header>
      <div class="modetabs">${tabs.length ? html`<sw-tabs .items=${tabs} .active=${this.activeTab()}></sw-tabs>` : nothing}</div>
      <main>${this.renderScreen()}</main>
      <nav class="bottom" aria-label="ניווט ראשי">
        ${MODES.map(
          (m) => html`<a class=${classMap({ active: this.route?.mode === m.id })} href=${`#/${m.id}`}><sw-icon .name=${m.icon} size=${22}></sw-icon>${m.label()}</a>`,
        )}
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-app': SwApp;
  }
}
