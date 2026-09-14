import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import '../components/sw-icon';
import '../components/sw-button';
import '../screens/explore-floor-map';
import '../screens/placeholder-screen';
import '../screens/styleguide-screen';
import type { IconName } from '../components/sw-icon';
import { onRouteChange, type Mode, type RouteState } from '../router';
import { t } from '../i18n/he';

const MODES: { id: Mode; icon: IconName; label: () => string }[] = [
  { id: 'live', icon: 'live', label: () => t('modes.live') },
  { id: 'explore', icon: 'explore', label: () => t('modes.explore') },
  { id: 'investigate', icon: 'investigate', label: () => t('modes.investigate') },
  { id: 'system', icon: 'system', label: () => t('modes.system') },
];

/**
 * Application shell: four primary modes only (Live / Explore / Investigate / System). Desktop shows a
 * navigation rail at the inline start (right side in RTL); phones use a bottom bar. Sub-screens,
 * drawers and editors never become extra top-level items.
 */
@customElement('sw-app')
export class SwApp extends LitElement {
  @state() private route: RouteState | null = null;
  private stopRouter?: () => void;

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
        grid-template-rows: var(--sw-topbar-h) minmax(0, 1fr) var(--sw-bottomnav-h);
        grid-template-areas:
          'topbar'
          'main'
          'bottom';
      }
      nav.rail {
        display: none;
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
    this.stopRouter = onRouteChange((route) => (this.route = route));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopRouter?.();
  }

  private renderScreen() {
    const r = this.route;
    if (!r) return nothing;
    if (r.segments[0] === 'styleguide') return html`<styleguide-screen></styleguide-screen>`;
    switch (r.mode) {
      case 'live':
        return html`<placeholder-screen heading=${t('modes.live')} task="T017 / T018"></placeholder-screen>`;
      case 'investigate':
        return html`<placeholder-screen heading=${t('modes.investigate')} task="T029 / T030"></placeholder-screen>`;
      case 'system':
        return html`<placeholder-screen heading=${t('modes.system')} task="T033 / T078"></placeholder-screen>`;
      case 'explore':
      default: {
        const floorId = r.segments[1] === 'floors' && r.segments[2] ? r.segments[2] : 'f0';
        const screenState = (r.params.get('state') ?? 'ready') as 'ready';
        return html`<explore-floor-map .floorId=${floorId} .screenState=${screenState}></explore-floor-map>`;
      }
    }
  }

  private navItem(m: (typeof MODES)[number], small = false) {
    const active = this.route?.mode === m.id;
    return html`<a class=${classMap({ item: true, active, small })} href=${`#/${m.id}`} aria-current=${active ? 'page' : 'false'}>
      <sw-icon .name=${m.icon} size=${22}></sw-icon><span>${m.label()}</span>
    </a>`;
  }

  render() {
    const base = import.meta.env.BASE_URL;
    return html`
      <nav class="rail" aria-label="ניווט ראשי">
        <div class="brand">
          <img src="${base}brand/smplwise-mark.png" alt="SmplWise" />
          <div><div class="name">SmplWise</div><div class="sub">VMS</div></div>
        </div>
        ${MODES.map((m) => this.navItem(m))}
        <div class="grow"></div>
        <a class=${classMap({ item: true, small: true, active: this.route?.segments[0] === 'styleguide' })} href="#/styleguide">
          <sw-icon name="layers" size=${18}></sw-icon><span>${t('nav.styleguide')}</span>
        </a>
      </nav>
      <header class="topbar">
        <span class="brand-mobile"><img src="${base}brand/smplwise-mark.png" alt="SmplWise" /></span>
        <label class="search"><sw-icon name="search" size=${18}></sw-icon><input type="search" placeholder=${t('app.search')} aria-label=${t('app.search')} /></label>
        <span class="spacer"></span>
        <sw-button variant="ghost" iconOnly icon="bell" label=${t('app.notifications')}></sw-button>
        <span class="avatar" title=${t('app.account')} aria-label=${t('app.account')}>HA</span>
      </header>
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
