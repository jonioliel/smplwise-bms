import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { keyed } from 'lit/directives/keyed.js';
import '../components/sw-icon';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-tabs';
import '../components/sw-avatar';
import './sw-user-menu';
import './sw-nav-order';
import { openAlertsText } from './sw-user-menu';
import { loadNavOrder, navOrder, onNavOrder, resetNavOrder, saveNavOrder } from './nav-order';
import { findScreenEdit, onScreenEdits, screenEdits } from './screen-edit';
import { findScreenView, onScreenViews, screenViews } from './screen-view';
import { loadNavSize, navCssVars, navDims, navSize, onNavSize, setInstallationNavSize, type NavDims } from './nav-size';
import { listAlerts } from '../api/rules';
import { inAndroidShell } from '../arx/android-app';
import '../screens/explore-floor-map';
import '../screens/explore-sites';
import '../screens/explore-floors';
import '../screens/explore-plan-import';
import '../screens/explore-plan-editor';
import { DESKTOP_ONLY, STRUCTURE_DESKTOP_ONLY, phoneRestricted, routeGuardKind, onMobileOptions, setInstallationMobileOptions, type MobileKind } from './phone';
import '../screens/explore-entities';
import '../screens/wiskey-overview';
import '../screens/wiskey-events';
import '../screens/wiskey-people';
import '../screens/wiskey-embed';
import '../screens/devices-building';
import '../screens/devices-area';
import '../screens/devices-schedules';
import '../screens/system-schedules';
import '../screens/multimedia-screens'; // CR-015: the screens page (the remote, <media-remote>, is S3's and registers itself where it is imported)
import '../screens/system-multimedia';
import '../screens/security-alarm';
import '../screens/schedule-editor';
import '../screens/live-overview';
import '../screens/live-wall';
import '../screens/live-camera';
import '../screens/live-views';
import '../screens/kiosk-wall';
import '../screens/investigate-playback';
import '../screens/investigate-sync';
import '../screens/investigate-history-map';
import '../screens/investigate-events';
import '../screens/investigate-event-detail';
import '../screens/investigate-reviews';
import '../screens/investigate-cases';
import '../screens/investigate-exports';
import '../screens/investigate-search';
import '../screens/investigate-rules';
import '../screens/system-access';
import '../screens/system-audit';
import '../screens/system-setup';
import '../screens/system-wizard';
import '../screens/system-devices';
import '../screens/system-diagnostics';
import '../screens/system-security';
import '../screens/system-storage';
import '../pwa/notifications-settings';
import '../screens/screens-index';
import '../screens/styleguide-screen';
import '../components/media-remote';
import { onRouteChange, type RouteState, parseRoute } from '../router';
import { KIND_ICON, KIND_LABEL, routeFor, search as apiSearch, type SearchResult } from '../api/search';
import { healthSummary, type HealthSummary } from '../api/health';
import { setupState } from '../api/setup';
import { AREA_TABS, areaOf, activeAreaTab, visibleTabs, visibleAreas, demoRedirect, legacyRedirect, liveOverviewTarget, applySnapshotHidden, applySchedulesHidden, applyMultimediaHidden, isHomeEditRoute, isHomeRoute, isMultimediaEditRoute, applyAlarmPresent, HIDDEN_HREFS, START_ROUTES, MAP_HREFS, WISKEY_TABS, applyWiskeyUi, applyWiskeyHidden, WISKEY_HIDDEN, wiskeyRoute, onWiskeyEmbedNav, applyNvrLess, isNvrRoute, NVR_LESS, SECTION_TABS, pageTargets, rememberSection, sectionOf, securityTarget, visibleSections, settingsEntry, landingTarget, applyTabsConfig, onTabsConfig, areaRowSection, tabStyleOf, type LegacyAccess, tabAllowed, type NavTabId } from './nav';
import { ENTER_GAP_MS, alarmPresence, onAlarmPresence, refreshAlarmPresence, resetAlarmPresence } from '../api/alarm-presence';
import { t } from '../i18n/he';
import { can, canNav, isApi, loadSession, nvrLess, onSession, watchPermissions, type Session } from '../api/session';
import { productSettings } from '../api/prefs';
import '../components/sw-state-panel';
import '../components/sw-page';

/**
 * Application shell (design SW A, the only design since 0.1.148 - the earlier "SW B" with a top bar was removed): a compact
 * side rail (phones: a bottom bar) of the areas, and the section's pages as a quiet pill-tab row above the content.
 * UI round 1: no top bar at all - a small search button and the system-status dot float in the content's
 * corner (RTL: the top left; Ctrl/Cmd+K opens the same search popover), the breadcrumb is gone, the security sections are
 * a segmented control at the head of the page, and the rail / bottom bar are ~20% smaller.
 * CR-013 (design SW A): the user avatar is the navigation's last item - the side rail's foot and the phone bottom
 * bar's last slot - and opens the user menu (sw-user-menu: התראות, סדר הלשוניות, מערכת, sign-out); the bell is gone
 * (a red dot on the avatar); the phone has no top bar (the security sections become a sticky row above the tab row);
 * the tabs follow the user's own order (nav-order.ts, stored on the server).
 */
@customElement('sw-app')
export class SwApp extends LitElement {
  @state() private route: RouteState | null = null;
  @state() private session: Session = { mode: 'loading', me: null, error: null };
  @state() private sys: HealthSummary | null = null;
  private sysTimer = 0;
  /** T071: "complete the setup" for a system administrator while wizard steps remain; dismissed per browser session. */
  @state() private setupHint: { done: number; total: number } | null = null;
  @state() private searchQ = '';
  @state() private searchResults: SearchResult[] = [];
  @state() private searchOpen = false;
  @state() private searchIndex = -1;
  @state() private searchBusy = false;
  /** UI round 1 (design A, no top bar): the search popover that opens from the corner button or Ctrl/Cmd+K. */
  @state() private searchPanel = false;
  private searchTimer = 0;
  private searchSeq = 0;
  private stopRouter?: () => void;
  private stopSession?: () => void;
  /** T055: the /me/ws access channel - a permissions change re-fetches /me, re-mounts the screen and says so. */
  private stopPermissions?: () => void;
  @state() private permEpoch = 0;
  @state() private permToast = '';
  private permToastTimer = 0;
  private stopWiskeyNav?: () => void;
  private stopAlarmPresence?: () => void;
  /** CR-013: the user menu (from the avatar, the navigation's last item), the tab-order dialog, the open alerts
   * (the avatar's red dot; null = this user may not read alerts) and this user's tab order. */
  @state() private menuOpen = false;
  @state() private orderOpen = false;
  @state() private alertCount: number | null = null;
  @state() private navOrder: NavTabId[] = navOrder();
  private menuTrigger: HTMLElement | null = null;
  /** The phone layout (< 768 px): the user menu is a sheet, the tab row the underline variant. */
  private phoneMq = window.matchMedia('(max-width: 767px)');
  @state() private phone = this.phoneMq.matches;
  private onPhoneMq = () => (this.phone = this.phoneMq.matches);
  private stopNavOrder?: () => void;
  /** UI round 1b: the navigation's size (shell/nav-size.ts: the user's own over the installation's), as pixel sizes. */
  @state() private nav: NavDims = navDims(navSize());
  private stopNavSize?: () => void;
  private stopScreenEdits?: () => void;
  private stopScreenViews?: () => void;
  private railObs: ResizeObserver | null = null;
  private observedRail: HTMLElement | null = null;
  private stopTabsConfig?: () => void;
  private stopMobileOptions?: () => void;
  private navOrderUser: string | null = null;

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
      /* RTL always: inline-start is the visual right, inline-end the visual left */
      padding-block: 10px 8px;
      padding-inline-start: max(10px, env(safe-area-inset-right, 0px));
      padding-inline-end: max(10px, env(safe-area-inset-left, 0px));
      gap: 2px;
      overflow: auto;
      scrollbar-width: none;
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
    main {
      grid-area: main;
      min-block-size: 0;
      min-inline-size: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
      padding-block-start: var(--sw-banner-h, 0px);
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
    @media (max-width: 1023px) {
      :host {
        grid-template-columns: var(--sw-rail-w) minmax(0, 1fr);
      }
      a.item span {
        display: none;
      }
      a.item {
        justify-content: center;
        padding: 0;
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
      .subnav {
        padding: 8px 12px 0;
      }
      nav.bottom {
        grid-area: bottom;
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        background: var(--sw-surface);
        border-block-start: 1px solid var(--sw-border);
        /* a landscape phone's notch/rounded corners sit on the inline edges too, not only the home indicator below */
        padding-inline: env(safe-area-inset-right, 0px) env(safe-area-inset-left, 0px);
        padding-block-end: env(safe-area-inset-bottom);
      }
      nav.bottom a,
      nav.bottom button {
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
        background: none;
        border: none;
        padding: 0;
        font-family: inherit;
        cursor: pointer;
      }
      nav.bottom a.active,
      nav.bottom button.active {
        color: var(--sw-accent-text);
      }
      .search {
        display: none;
      }
    }

    /* ---- design SW A: four-area icon rail on the right, 72px top bar with crumbs, wide search, user chip ---- */
    :host([data-design='a']) {
      /* UI round 1: no top bar - the content owns the whole column; search and status float in its corner (.float) */
      grid-template-rows: minmax(0, 1fr);
      grid-template-areas: 'rail main';
      /* UI round 1b (shell/nav-size.ts): the rail is as wide as its widest label needs (never clipped); sw-app measures it
         into --sw-rail-w for what is placed beside it (the user menu, the alert banner) */
      grid-template-columns: auto minmax(0, 1fr);
    }
    :host([data-design='a']) nav.rail {
      padding-block: 12px 10px;
      padding-inline-start: max(7px, env(safe-area-inset-right, 0px));
      padding-inline-end: max(7px, env(safe-area-inset-left, 0px));
      gap: 4px;
      align-items: stretch;
    }
    :host([data-design='a']) nav.rail .brand-tile {
      align-self: center;
    }
    .brand-tile {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 10px;
      background: var(--sw-accent);
      color: #fff;
      font-weight: 800;
      font-size: 18px;
      text-decoration: none;
      margin-block-end: 8px;
      box-shadow: 0 5px 12px rgba(39, 103, 237, 0.25);
    }
    a.item.a {
      flex-direction: column;
      justify-content: center;
      gap: 3px;
      box-sizing: border-box;
      min-inline-size: var(--nav-item-w, 56px);
      min-block-size: var(--nav-item-h, 52px);
      padding: 6px 4px;
      line-height: 1.3;
      border-radius: 10px;
      font-size: var(--nav-label, 10.5px);
      white-space: nowrap;
      position: relative;
    }
    a.item.a span {
      display: inline;
    }
    /* labels off (a free size with no label): the icon alone; the link keeps its aria-label */
    :host([data-nolabels]) a.item.a span,
    :host([data-nolabels]) button.me .lbl,
    :host([data-nolabels]) nav.bottom .lbl {
      display: none;
    }
    a.item.a.active::after {
      content: '';
      position: absolute;
      inset-inline-end: -8px;
      inset-block: 16px;
      inline-size: 3px;
      border-radius: 3px;
      background: var(--sw-accent);
    }
    .secure {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      font-size: 10.5px;
      color: var(--sw-text-3);
      padding: 8px 0 4px;
      text-align: center;
      line-height: 1.25;
    }
    .results {
      position: absolute;
      inset-inline-start: 0;
      inset-block-start: calc(100% + 6px);
      inline-size: min(560px, 90vw);
      max-block-size: 60vh;
      overflow: auto;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 12px;
      box-shadow: var(--sw-shadow-3);
      padding: 6px;
      z-index: var(--sw-z-drawer);
    }
    .results .row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      color: var(--sw-text);
    }
    .results .row.on,
    .results .row:hover {
      background: var(--sw-accent-soft);
    }
    .results .row sw-icon {
      color: var(--sw-text-3);
      flex: none;
    }
    .results .txt {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      flex: 1;
    }
    .results .t {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
    }
    .results .s {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .results .kind {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      flex: none;
    }
    .results .empty {
      padding: 10px 12px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
    }
    .search.a {
      block-size: 44px;
      border-radius: 12px;
      padding: 0 14px;
      border: 0;
      background: transparent;
    }
    .search.a:focus-within {
      box-shadow: none;
      background: transparent;
    }
    .search.a input {
      font-size: 14px;
    }

    /* ---- UI round 1: no top bar. Search and the system status float in the content's corner (RTL: the top left) ---- */
    :host([data-design='a']) {
      position: relative;
    }
    .float {
      position: absolute;
      inset-block-start: calc(var(--sw-banner-h, 0px) + var(--sw-safe-top, 0px) + 8px);
      inset-inline-end: 22px;
      z-index: var(--sw-z-topbar);
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    .float .pillrow {
      display: inline-flex;
      align-items: center;
      block-size: 34px;
      padding-inline: 4px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-1);
    }
    .float button {
      all: unset;
      box-sizing: border-box;
      position: relative;
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      color: var(--sw-text-2);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    /* a 44px hit area on the phone without a bigger drawing */
    .float button::after {
      content: '';
      position: absolute;
      inset: -6px;
    }
    .float button:hover,
    .float button[aria-expanded='true'] {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .float button:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    /* the status dot of a user who may not open הגדרות › בריאות: the same dot, not a button */
    .float span.sysdot {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      cursor: default;
    }
    .float .sysdot i {
      inline-size: 9px;
      block-size: 9px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .float .sysdot.warn i {
      background: var(--sw-stale);
    }
    .float .sysdot.error i {
      background: var(--sw-danger);
    }
    .float .sysdot.unknown i {
      background: var(--sw-border-strong);
    }
    .float .demodot {
      display: grid;
      place-items: center;
      inline-size: 20px;
      block-size: 28px;
    }
    .float .demodot i {
      inline-size: 9px;
      block-size: 9px;
      border-radius: 50%;
      background: var(--sw-border-strong);
    }
    @media (max-width: 767px) {
      .float button::after {
        inset: -8px;
      }
      .float {
        inset-inline-end: 10px;
      }
    }
    .searchpanel {
      margin-block-start: 6px;
      inline-size: min(440px, calc(100vw - 24px));
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 14px;
      box-shadow: var(--sw-shadow-3);
      overflow: hidden;
    }
    .searchpanel .search.a {
      display: flex;
      inline-size: auto;
    }
    .searchpanel .results {
      position: static;
      inline-size: auto;
      max-block-size: min(60vh, 420px);
      border: 0;
      border-radius: 0;
      box-shadow: none;
      border-block-start: 1px solid var(--sw-border);
    }
    .searchscrim {
      position: fixed;
      inset: 0;
      z-index: calc(var(--sw-z-topbar) - 1);
    }
    /* the first thing in the content (a page header) keeps clear of the floating corner; wide screens with a tab row
       or a section switch above it have their own row and need no reserve */
    :host {
      --sw-float-reserve: 0px;
    }
    :host([data-design='a'][data-top='page']) {
      --sw-float-reserve: 76px;
    }
    .perm-toast {
      position: fixed;
      inset-block-end: calc(24px + env(safe-area-inset-bottom, 0px));
      inset-inline-start: 50%;
      transform: translateX(50%);
      z-index: var(--sw-z-topbar);
      padding: 10px 18px;
      border-radius: 10px;
      background: var(--sw-text, #0f172a);
      color: var(--sw-surface, #fff);
      font-size: var(--sw-fs-sm, 14px);
      box-shadow: 0 6px 24px rgb(0 0 0 / 0.18);
      max-inline-size: calc(100vw - 32px);
    }
    .sysbanner {
      position: fixed;
      inset-inline: 0;
      inset-block-start: var(--sw-topbar-h);
      /* one level under the topbar: at the topbar's own level the banner (later in the DOM) painted over the
         search results that drop out of the topbar, and their first rows could not be clicked (0.1.79 sweep) */
      z-index: calc(var(--sw-z-topbar) - 1);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 20px;
      background: #fef2f2;
      color: #991b1b;
      border-block-end: 1px solid #fecaca;
      font-size: var(--sw-fs-sm);
    }
    /* no top bar (design A): the alert sits over the content column only, not over the rail's brand mark */
    @media (min-width: 768px) {
      :host([data-design='a']) .sysbanner {
        inset-inline-start: var(--sw-rail-w);
      }
    }
    .setuphint {
      flex: none;
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 12px 24px 0;
      padding: 8px 12px;
      border-radius: 10px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
    }
    .setuphint a {
      margin-inline-start: auto;
      color: inherit;
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
    }
    .setuphint .x {
      all: unset;
      cursor: pointer;
      display: grid;
      place-items: center;
      inline-size: 24px;
      block-size: 24px;
      border-radius: 6px;
    }
    .setuphint .x:focus-visible {
      outline: 2px solid var(--sw-accent);
    }
    @media (max-width: 767px) {
      .setuphint {
        margin: 8px 12px 0;
      }
    }
    /* from 768 px up the floating search / status corner sits over the far end of this first row (a phone held sideways; and at
       desktop widths the hint's dismiss button, release stage 0.1.148): the row leaves room for it at every height */
    @media (min-width: 768px) {
      .setuphint {
        padding-inline-end: 86px;
      }
    }
    .sysbanner a {
      color: inherit;
      font-weight: var(--sw-fw-semibold);
      margin-inline-start: auto;
    }
    :host([data-design='a']) .subnav {
      padding: 14px 30px 0;
      /* the security sections (a page-level segmented control) sit before the page's own tab row */
      align-items: center;
      gap: 16px;
    }
    :host([data-design='a']) nav.bottom {
      /* 0.1.103: WisKey made this 5 areas (was 4); CR-007 made it 6 (חשמל); CR-010 folded לייב and חקירה into אבטחה (5).
         visibleAreas() renders unsliced here, so the grid follows the item count. */
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      grid-template-columns: none;
    }
    :host([data-design='a']) nav.bottom a {
      font-size: 9px;
      padding-inline: 2px;
    }
    /* CR-010 / UI round 1: the security area's sections as a segmented control at the head of the page (the row above the
       page's own tab row; on the phone a sticky row) - not in a top bar */
    nav.sections {
      display: inline-flex;
      flex: none;
      gap: 2px;
      padding: 3px;
      background: var(--sw-surface-3);
      border-radius: 12px;
    }
    nav.sections a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 34px;
      box-sizing: border-box;
      padding: 0 14px;
      border-radius: 9px;
      color: var(--sw-text-2);
      text-decoration: none;
      font-size: 13px;
      font-weight: var(--sw-fw-medium);
      white-space: nowrap;
    }
    nav.sections a:hover {
      color: var(--sw-text);
    }
    nav.sections a.on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    nav.sections a:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    @media (max-width: 767px) {
      nav.sections sw-icon {
        display: none;
      }
      nav.sections a {
        padding: 0 11px;
        font-size: 12.5px;
      }
    }
    @media (max-width: 1023px) {
      :host([data-design='a']) {
        grid-template-columns: auto minmax(0, 1fr);
      }
      :host([data-design='a']) a.item.a span {
        display: inline;
      }
      :host([data-design='a'][data-nolabels]) a.item.a span {
        display: none;
      }
      :host([data-design='a']) .subnav {
        padding: 10px 16px 0;
      }
    }
    @media (max-width: 767px) {
      /* the tablet rule above (rail + content) is more specific than the base phone rule: repeat the
         single-column phone grid for SW A, otherwise the hidden rail keeps an empty column */
      :host([data-design='a']) {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: var(--sw-topbar-h) minmax(0, 1fr) var(--sw-bottomnav-h);
        grid-template-areas:
          'topbar'
          'main'
          'bottom';
      }
    }

    /* ---- CR-013: the user as the navigation's last item; no top bar on the phone ---- */
    :host {
      /* the status-bar inset the page must keep clear of; the Android app's own WebView reserves it natively */
      --sw-safe-top: env(safe-area-inset-top, 0px);
    }
    :host([data-android-shell]) {
      --sw-safe-top: 0px;
    }
    nav.sections a .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    nav.secrow {
      display: none;
    }
    nav.sectabs {
      display: inline-flex;
      flex: none;
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    /* the phone's copy exists only on the phone (renderSections builds it there), and hides on wider screens like .secrow */
    nav.sectabs.phone {
      display: none;
    }
    button.me {
      all: unset;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      cursor: pointer;
      color: var(--sw-text-2);
      -webkit-tap-highlight-color: transparent;
    }
    button.me .av {
      position: relative;
      display: inline-grid;
      border-radius: 50%;
      box-shadow: 0 0 0 2px var(--sw-surface), 0 0 0 3px transparent;
      transition: box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    /* review M9: a neutral grey circle; blue only while the menu is open or on the settings (the avatar's own area) */
    button.me sw-avatar {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    button.me.open sw-avatar,
    button.me.active sw-avatar {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    @media (hover: hover) {
      button.me:hover .av {
        box-shadow: 0 0 0 2px var(--sw-surface), 0 0 0 4px var(--sw-surface-3);
      }
    }
    button.me:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 2px;
      border-radius: 12px;
    }
    button.me .dot {
      position: absolute;
      inset-block-start: -1px;
      inset-inline-end: -1px;
      inline-size: 11px;
      block-size: 11px;
      border-radius: 50%;
      background: var(--sw-danger);
      border: 2px solid var(--sw-surface);
      box-sizing: border-box;
    }
    button.me .lbl {
      max-inline-size: 8em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    button.me.rail {
      min-inline-size: var(--nav-item-w, 56px);
      min-block-size: var(--nav-item-h, 52px);
      padding: 5px 4px 3px;
      border-radius: 10px;
      gap: 2px;
      line-height: 1.3;
      font-size: var(--nav-label, 10.5px);
      font-weight: var(--sw-fw-medium);
    }
    button.me.rail.open {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    button.me.rail.active {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    button.me.bottom {
      display: none;
    }
    .menu-pills {
      display: contents;
    }
    .setup-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: 12.5px;
      font-weight: var(--sw-fw-semibold);
      text-decoration: none;
      white-space: nowrap;
    }
    @media (max-width: 767px) {
      :host([data-design='a']) {
        grid-template-rows: minmax(0, 1fr) auto;
        grid-template-areas:
          'main'
          'bottom';
      }
      /* the kiosk and the Lovelace card view have no bars and keep the whole screen (review M5) */
      :host([data-design='a']:not([data-kiosk]):not([data-embed])) {
        padding-block-start: var(--sw-safe-top);
      }
      /* the degraded-system alert keeps the top edge (below the status bar) now that no top bar is there */
      :host([data-design='a']) .sysbanner {
        inset-block-start: var(--sw-safe-top);
        padding-inline: 12px;
      }
      /* the setup progress moved into the user menu's header (a pill), with the health pill and "נתוני הדגמה" */
      :host([data-design='a']) .setuphint {
        display: none;
      }
      /* review M7: only the section selector stays (slim, sticky); the page's tab row is the second level - the underline
         variant - and scrolls away with the content. Its tabs keep 44 px targets (review M8). */
      :host([data-design='a']) .subnav {
        padding: 2px 12px 0;
        --sw-tab-min-h: 44px;
      }
      :host([data-design='a']) .subnav sw-tabs {
        align-self: stretch;
      }
      /* 0.1.148: a segmented (pill) row keeps its natural width at the start of the row (the pill's 44 px tap area already
         holds 5 px of air around the 34 px track); the compact underline row takes no more room than its 32 px (its 44 px tap
         targets overlap the empty space below it) */
      :host([data-design='a']) .subnav[data-tabstyle='pill'] sw-tabs {
        align-self: flex-start;
      }
      /* the sections as an underline row (the installation's choice): sticky like the segmented row, tap targets of 44 px */
      :host([data-design='a']) nav.sectabs.phone {
        position: sticky;
        inset-block-start: var(--sw-banner-h, 0px);
        z-index: 4;
        display: flex;
        flex: none;
        padding-inline: 12px 84px;
        background: var(--sw-bg);
        --sw-tab-min-h: 44px;
      }
      :host([data-design='a']) nav.sectabs.phone sw-tabs {
        flex: 1;
      }
      /* the floating search / status corner sits over the first row's far end: that row keeps clear of it */
      :host([data-design='a'][data-top='tabs']) .subnav {
        padding-inline-end: 84px;
      }
      :host([data-design='a']) nav.secrow {
        position: sticky;
        inset-block-start: var(--sw-banner-h, 0px);
        z-index: 4;
        display: flex;
        flex: none;
        gap: 0;
        padding-block: 0;
        padding-inline: 12px 84px;
        border-radius: 0;
        background: var(--sw-bg);
        border-block-end: 1px solid var(--sw-border);
      }
      /* the track is drawn slim (34px); each segment keeps a 44px tap target */
      :host([data-design='a']) nav.secrow::before {
        content: '';
        position: absolute;
        inset-block: 5px;
        inset-inline: 12px 84px;
        border-radius: 10px;
        background: var(--sw-surface-3);
      }
      :host([data-design='a']) nav.secrow a {
        position: relative;
        flex: 1;
        justify-content: center;
        min-block-size: 44px;
        padding: 0 3px;
        background: none;
        box-shadow: none;
        border-radius: 0;
        font-size: 13px;
      }
      :host([data-design='a']) nav.secrow a .pill {
        justify-content: center;
        inline-size: 100%;
        block-size: 28px;
        border-radius: 8px;
        transition: background var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
      }
      :host([data-design='a']) nav.secrow a.on {
        background: none;
        box-shadow: none;
      }
      :host([data-design='a']) nav.secrow a.on .pill {
        background: var(--sw-surface);
        box-shadow: var(--sw-shadow-1), 0 0 0 1px var(--sw-border);
      }
      :host([data-design='a']) nav.secrow a:focus-visible {
        outline: none;
      }
      :host([data-design='a']) nav.secrow a:focus-visible .pill {
        outline: 2px solid var(--sw-focus);
      }
      :host([data-design='a']) nav.bottom {
        position: relative;
        z-index: var(--sw-z-topbar);
        box-shadow: 0 -6px 18px rgba(34, 49, 76, 0.06);
      }
      :host([data-design='a']) nav.bottom a,
      :host([data-design='a']) nav.bottom button.me {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        box-sizing: border-box;
        min-block-size: var(--sw-bottomnav-h);
        min-inline-size: 44px;
        padding: 3px 2px 4px;
        font-size: var(--nav-p-label, 10px);
        font-weight: var(--sw-fw-medium);
        color: var(--sw-text-3);
        -webkit-tap-highlight-color: transparent;
      }
      :host([data-design='a']) nav.bottom .ic {
        display: grid;
        place-items: center;
        inline-size: var(--nav-pill-w, 44px);
        block-size: var(--nav-pill-h, 26px);
        border-radius: 999px;
        transition: background var(--sw-t-med) var(--sw-ease), color var(--sw-t-med) var(--sw-ease);
      }
      :host([data-design='a']) nav.bottom a.active {
        color: var(--sw-accent-text);
        font-weight: var(--sw-fw-semibold);
      }
      :host([data-design='a']) nav.bottom a.active .ic {
        background: var(--sw-accent-soft);
        color: var(--sw-accent);
      }
      :host([data-design='a']) nav.bottom a:focus-visible,
      :host([data-design='a']) nav.bottom button.me:focus-visible {
        outline: none;
      }
      :host([data-design='a']) nav.bottom a:focus-visible .ic,
      :host([data-design='a']) nav.bottom button.me:focus-visible .ic {
        outline: 2px solid var(--sw-focus);
      }
      :host([data-design='a']) nav.bottom button.me.open {
        color: var(--sw-text);
      }
      :host([data-design='a']) nav.bottom button.me.active {
        color: var(--sw-accent-text);
        font-weight: var(--sw-fw-semibold);
      }
      :host([data-design='a']) nav.bottom button.me.active .ic {
        background: var(--sw-accent-soft);
      }
      :host([data-design='a']) nav.bottom button.me .dot {
        inline-size: 9px;
        block-size: 9px;
        border-width: 1.5px;
      }
      :host([data-design='a']) nav.bottom .lbl {
        max-inline-size: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  `;

  /** True when the page opened without a route: the start screen decides where it lands. CR-013: an explicit
   * #/explore/floors/f0 is a deep link like any other (it used to count as "no route" while the map was the default). */
  private landedDefault = ['', '#', '#/'].includes(window.location.hash);

  /** Replace the bare address with the start screen, now - not on the next hashchange, so no other screen mounts in between. */
  private land(path: string) {
    this.landedDefault = false;
    window.location.replace(`#${path}`);
    this.route = parseRoute(`#${path}`);
  }
  /** The default screen waits for the product settings (the start-screen choice) before it renders - otherwise the
   * map's own floor redirect would race the start-screen redirect. */
  @state() private startResolved = false;

  connectedCallback() {
    super.connectedCallback();
    this.toggleAttribute('data-android-shell', inAndroidShell()); // the app reserves the status bar itself (CR-013)
    this.setAttribute('data-design', 'a'); // the one design: the attribute stays as the styling hook of the shell's CSS
    this.phoneMq.addEventListener('change', this.onPhoneMq);
    window.addEventListener('popstate', this.onPopState);
    this.stopNavOrder = onNavOrder((o) => (this.navOrder = o));
    this.stopNavSize = onNavSize((sz) => (this.nav = navDims(sz)));
    this.stopScreenEdits = onScreenEdits(() => this.requestUpdate()); // a screen registered / dropped its edit mode
    this.stopScreenViews = onScreenViews(() => this.requestUpdate()); // a screen registered / dropped / changed its view choice
    this.stopTabsConfig = onTabsConfig(() => this.requestUpdate()); // הגדרות › כללי › לשוניות: every tab row follows at once
    this.stopMobileOptions = onMobileOptions(() => this.requestUpdate()); // הגדרות › כללי › אפשרויות נייד: the phone guards follow at once
    this.stopSession = onSession((s) => {
      this.session = s;
      applyNvrLess(nvrLess()); // NVR-less mode: the NVR areas leave the navigation for everyone (nav.ts)
      // CR-013: this user's tab order (cached copy at once, the server's copy when it answers) and open alerts
      const who = s.mode === 'demo' ? 'demo' : s.me?.user.id ?? null;
      if (who && who !== this.navOrderUser) {
        this.navOrderUser = who;
        void loadNavOrder(who, s.mode === 'api' || s.mode === 'no_access');
        void loadNavSize(who, s.mode === 'api' || s.mode === 'no_access');
      }
      if (s.mode !== 'loading') void this.pollAlerts();
      // the static demo has no start-screen setting: the bare address opens "ראשי"
      if (s.mode === 'demo' && this.landedDefault) this.land(START_ROUTES.devices);
      if (s.mode === 'api' && this.route) this.redirectDemo(this.route);
      if (s.mode === 'api') void refreshAlarmPresence(); // one answer per session, kept 10 minutes (no request per screen)
      if ((s.mode === 'api' || s.mode === 'no_access') && !this.stopPermissions) this.stopPermissions = watchPermissions(() => void this.onPermissionsChanged());
      if (s.mode === 'api' && !this.sysTimer) {
        void productSettings().then((ps) => {
          HIDDEN_HREFS.clear();
          setInstallationNavSize(ps['ui.nav_size']); // the installation's default size of the navigation
          setInstallationMobileOptions(ps['ui.mobile']); // the phone UX guards (הגדרות › כללי › אפשרויות נייד)
          if (String(ps['ui.hide_search'] ?? 'false') === 'true') HIDDEN_HREFS.add('#/investigate/search');
          const hideMap = String(ps['ui.hide_map'] ?? 'false') === 'true';
          if (hideMap) for (const h of MAP_HREFS) HIDDEN_HREFS.add(h);
          // הגדרות › בקרות כניסה: hide the whole WisKey area for everyone, regardless of role (T054 follow-up) - same
          // "hidden for everyone" shape as hideMap above, applied to the whole WISKEY_TABS group at once.
          if (applyWiskeyHidden(ps as unknown as Record<string, unknown>)) for (const wt of WISKEY_TABS) HIDDEN_HREFS.add(wt.href ?? '');
          applyWiskeyUi(ps as unknown as Record<string, unknown>); // הגדרות › בקרות כניסה: embed or SMPLWISE per WisKey screen
          applySnapshotHidden(ps as unknown as Record<string, unknown>); // ui.security_snapshot: the live overview leaves the navigation
          applySchedulesHidden(ps as unknown as Record<string, unknown>); // schedules.enabled (CR-014): the "תזמונים" tab of the home area
          applyMultimediaHidden(ps as unknown as Record<string, unknown>); // multimedia.enabled (CR-015): the "מולטימדיה" area
          applyTabsConfig(ps as unknown as Record<string, unknown>); // ui.tabs: the installation's tab order and hidden tabs (before the landing target below)
          // the start screen (0.1.68): only when the address carried no route of its own. CR-013: "ראשי" (the device
          // overview) by default; a start screen this user does not see falls back to their first tab
          const start = START_ROUTES[String(ps['ui.start_route'] ?? 'devices')] ?? START_ROUTES.devices;
          let target = hideMap && start.startsWith('/explore') ? '/live/wall' : start;
          // NVR-less mode: a start screen that needs the NVR opens the map (or, with the map hidden, the device control)
          if (NVR_LESS && isNvrRoute(parseRoute(`#${target}`))) target = hideMap ? START_ROUTES.devices : START_ROUTES.explore;
          target = landingTarget(target, true, canNav, navOrder());
          if (this.landedDefault) this.land(target);
          this.requestUpdate();
        }).catch(() => undefined).finally(() => {
          // settings unreadable: still no bare address - "ראשי", or this user's first tab
          if (this.landedDefault) this.land(landingTarget(START_ROUTES.devices, true, canNav, navOrder()));
          this.startResolved = true;
        });
        void this.pollSummary();
        this.sysTimer = window.setInterval(() => {
          void this.pollSummary();
          void this.pollAlerts();
        }, 60_000);
        void this.loadSetupHint();
      }
    });
    window.addEventListener('sw-setup-state', this.onSetupState);
    void loadSession();
    window.addEventListener('keydown', this.onGlobalKey);
    // WisKey embed API v1: the tab row follows the panel's catalog and its confirmed location
    this.stopWiskeyNav = onWiskeyEmbedNav(() => this.requestUpdate());
    // הגדרות › אבטחה: the alarm pages exist only while the platform has an alarm panel (one cached answer, api/alarm-presence.ts)
    applyAlarmPresent(alarmPresence());
    this.stopAlarmPresence = onAlarmPresence((v) => {
      applyAlarmPresent(v);
      this.requestUpdate();
    });
    this.stopRouter = onRouteChange((route, replaced) => {
      this.route = route;
      // not the WisKey embed mirroring the panel's own moves into the address (replaced)
      if (!replaced) {
        // CR-013: a menu item (or any navigation) closes the user menu and the tab-order dialog; their history entry
        // is behind the new one now and simply stays (Back returns to the same screen)
        this.overlayEntry = false;
        this.closeMenu(false, false);
        this.orderOpen = false;
      }
      if (this.redirectDemo(route)) return;
      // CR-010: the security section in use, so #/security (the rail entry) reopens it
      const section = sectionOf(route);
      if (section) rememberSection(section);
      // the alarm tab: entering the security area while the "is there a panel" answer is not a yes asks again (a panel may
      // have appeared since a negative answer)
      if (areaOf(route) === 'security' && alarmPresence() !== true) void refreshAlarmPresence(true, ENTER_GAP_MS);
      this.toggleAttribute('data-kiosk', route.segments[0] === 'kiosk');
      // embed=1 (Lovelace card iframe, T056): no chrome for the rest of the session, whatever the in-app navigation does
      if (route.params.get('embed') === '1') {
        try {
          sessionStorage.setItem('sw-embed', '1');
        } catch {
          /* private mode: the attribute below still applies to this route */
        }
      }
      this.toggleAttribute('data-embed', this.embedded(route));
    });
  }

  /** The degraded-system banner is fixed under the top bar and used to cover the first rows of <main> (the tab row, and
   * since T071 the setup hint's link). Its measured height pads <main>, so nothing sits under it at rest. Caveat: a
   * screen toolbar that is `position: sticky; top: 0` inside <main> sticks to the scrollport's top edge, which the padding
   * does not move, so while scrolled it still passes under the banner; such a toolbar should use
   * `top: var(--sw-banner-h, 0px)` (inherited from sw-app's host) if it must stay clear. */
  private bannerObs: ResizeObserver | null = null;
  private observedBanner: HTMLElement | null = null;

  /** The navigation's sizes onto the host as CSS variables (the one design), the rail's real width into --sw-rail-w (the
   * user menu and the alert banner sit beside it), and whether labels show at all. */
  private applyNavSize() {
    for (const [k, v] of Object.entries(navCssVars(this.nav))) this.style.setProperty(k, v);
    this.style.setProperty('--sw-bottomnav-h', `${this.nav.bar}px`);
    this.toggleAttribute('data-nolabels', !this.nav.labels);
    const rail = this.renderRoot.querySelector<HTMLElement>('nav.rail');
    if (rail !== this.observedRail) {
      this.railObs?.disconnect();
      this.railObs = null;
      this.observedRail = rail;
      if (rail) {
        this.railObs = new ResizeObserver(() => {
          const w = rail.offsetWidth;
          if (w > 0) this.style.setProperty('--sw-rail-w', `${w}px`);
        });
        this.railObs.observe(rail);
      } else this.style.removeProperty('--sw-rail-w');
    }
  }

  protected updated() {
    this.applyNavSize();
    // what the floating corner (search, status) sits above: the phone's sticky section row, a tab / section row, or
    // the page's own header (sw-page reads --sw-float-reserve to keep its actions clear)
    const top = this.renderRoot.querySelector('nav.secrow, nav.sectabs.phone') ? 'secrow' :this.renderRoot.querySelector('.subnav > *') ? 'tabs' : 'page';
    if (this.getAttribute('data-top') !== top) this.setAttribute('data-top', top);
    const banner = this.renderRoot.querySelector<HTMLElement>('[data-sys-banner]');
    if (banner === this.observedBanner) return;
    this.bannerObs?.disconnect();
    this.bannerObs = null;
    this.observedBanner = banner;
    if (!banner) {
      this.style.removeProperty('--sw-banner-h');
      return;
    }
    this.bannerObs = new ResizeObserver(() => this.style.setProperty('--sw-banner-h', `${banner.offsetHeight}px`));
    this.bannerObs.observe(banner);
  }

  disconnectedCallback() {
    this.bannerObs?.disconnect();
    super.disconnectedCallback();
    this.stopRouter?.();
    this.stopSession?.();
    this.stopPermissions?.();
    this.stopPermissions = undefined;
    window.clearTimeout(this.permToastTimer);
    this.stopWiskeyNav?.();
    this.stopAlarmPresence?.();
    this.stopNavOrder?.();
    this.stopNavSize?.();
    this.stopScreenEdits?.();
    this.stopScreenViews?.();
    this.railObs?.disconnect();
    this.railObs = null;
    this.stopTabsConfig?.();
    this.stopMobileOptions?.();
    this.phoneMq.removeEventListener('change', this.onPhoneMq);
    window.removeEventListener('popstate', this.onPopState);
    window.removeEventListener('keydown', this.onGlobalKey);
    window.removeEventListener('sw-setup-state', this.onSetupState);
    window.clearInterval(this.sysTimer);
    this.sysTimer = 0;
  }

  // ---- system status (top-bar pill + degraded banner) ----

  private async pollSummary() {
    try {
      this.sys = await healthSummary();
    } catch {
      /* keep the last known state; the pill shows what we last knew */
    }
  }

  /** The status in words (the pill's text, the dot's accessible name) and the per-component detail (its tooltip). */
  private sysWords(s: HealthSummary): { text: string; title: string } {
    const first = s.items.find((i) => i.status === 'error') ?? s.items[0];
    const text = s.status === 'ok' ? 'מערכת תקינה' : s.status === 'warn' ? 'יש מה לבדוק' : `תקלה: ${first?.label.split(' — ')[0] ?? ''}`;
    const title = s.items.length ? s.items.map((i) => `• ${i.label}`).join('\n') : 'כל הרכיבים שהמערכת רואה עובדים';
    return { text, title };
  }

  /** UI round 1 (design A): the system status as a small dot in the floating corner - the state is its accessible name
   * and tooltip; a click opens הגדרות › בריאות. The demo data have no status, only a grey dot that says so. */
  private renderSysDot() {
    const mode = this.session.mode;
    if (mode === 'demo') return html`<span class="demodot" data-demo-dot role="img" title="נתוני הדגמה" aria-label="נתוני הדגמה"><i></i></span>`;
    if (mode !== 'api' && mode !== 'no_access') return nothing;
    const s = this.sys;
    const status = s?.status ?? 'unknown';
    const { text, title } = s ? this.sysWords(s) : { text: 'מערכת מקומית', title: 'מערכת מקומית' };
    // only for users who may open הגדרות › בריאות (system.configure); everyone else sees the state without a link that
    // would end on a refusal
    if (!this.canOpenHealth()) return html`<span class="sysdot ${status}" data-sys-pill data-sys-static data-status=${status} role="img" title=${`${text}\n${title}`.trim()} aria-label=${`מצב המערכת: ${text}`}><i></i></span>`;
    return html`<button type="button" class="sysdot ${status}" data-sys-pill data-status=${status} title=${`${text}\n${title}`.trim()} aria-label=${`מצב המערכת: ${text}`} @click=${() => (window.location.hash = '#/system/diagnostics?tab=health')}><i></i></button>`;
  }

  /** The status dot, the legacy pill and the alert banner lead to הגדרות › בריאות: allowed only with system.configure. */
  private canOpenHealth(): boolean {
    return tabAllowed('#/system/diagnostics', canNav);
  }

  private renderSysBanner() {
    const s = this.sys;
    if (!s || s.status !== 'error') return nothing;
    const errors = s.items.filter((i) => i.status === 'error');
    return html`<div class="sysbanner" role="alert" data-sys-banner><sw-icon name="warning" size=${16}></sw-icon><span>${errors.map((i) => i.label).join(' · ')}</span>${this.canOpenHealth() ? html`<a href="#/system/diagnostics?tab=health">לבריאות המערכת</a>` : nothing}</div>`;
  }

  // ---- setup hint (T071) ----

  private static readonly SETUP_HINT_KEY = 'sw.setupHint.dismissed';

  private setupHintDismissed(): boolean {
    try {
      return window.sessionStorage.getItem(SwApp.SETUP_HINT_KEY) === '1';
    } catch {
      return false;
    }
  }

  /** GET /setup/state never probes a device, so this costs a few database reads, once per session load. */
  private async loadSetupHint() {
    if (!can('system.configure') || this.setupHintDismissed()) return;
    try {
      const s = await setupState();
      this.setupHint = s.ready ? null : { done: s.done, total: s.total };
    } catch {
      this.setupHint = null;
    }
  }

  private onSetupState = (e: Event) => {
    const d = (e as CustomEvent<{ ready: boolean; done: number; total: number }>).detail;
    if (!can('system.configure') || this.setupHintDismissed()) return;
    this.setupHint = d.ready ? null : { done: d.done, total: d.total };
  };

  private dismissSetupHint() {
    try {
      window.sessionStorage.setItem(SwApp.SETUP_HINT_KEY, '1');
    } catch {
      /* private mode: dismissed for this page only */
    }
    this.setupHint = null;
  }

  private renderSetupHint() {
    const h = this.setupHint;
    if (!h || this.gated || (this.route?.mode === 'system' && this.route.segments[1] === 'wizard')) return nothing;
    return html`<div class="setuphint" role="status" data-setup-hint><sw-icon name="info" size=${16}></sw-icon><span><b>השלם את ההתקנה</b> · ${h.done} מתוך ${h.total} שלבים הושלמו</span><a href="#/system/wizard">לאשף ההתקנה</a><button type="button" class="x" aria-label="הסתר עד הכניסה הבאה" title="הסתר עד הכניסה הבאה" data-setup-hint-dismiss @click=${() => this.dismissSetupHint()}><sw-icon name="close" size=${14}></sw-icon></button></div>`;
  }

  // ---- global search (top bar) ----

  private onGlobalKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.openSearch();
      return;
    }
    if (e.key === 'Escape' && this.searchPanel) this.closeSearchPanel();
  };

  private onSearchInput(e: Event) {
    const q = (e.target as HTMLInputElement).value;
    this.searchQ = q;
    window.clearTimeout(this.searchTimer);
    if (!q.trim()) {
      this.searchResults = [];
      this.searchOpen = false;
      return;
    }
    this.searchTimer = window.setTimeout(() => void this.runSearch(q), 180);
  }

  /** CR-010: the app's own screens matching the query (the security sections), shown before the server's results. */
  private pageHits(q: string): SearchResult[] {
    return pageTargets(q, isApi(), canNav).map((p) => ({ kind: 'page' as const, id: p.href, title: p.label, subtitle: p.subtitle, route: p.href.replace(/^#/, '') }));
  }

  private async runSearch(q: string) {
    if (!isApi()) {
      this.searchResults = this.pageHits(q);
      this.searchIndex = this.searchResults.length ? 0 : -1;
      this.searchOpen = true;
      return;
    }
    const seq = ++this.searchSeq;
    this.searchBusy = true;
    try {
      const r = await apiSearch(q, 6);
      if (seq !== this.searchSeq) return;
      this.searchResults = [...this.pageHits(q), ...r.results];
      this.searchIndex = r.results.length ? 0 : -1;
      this.searchOpen = true;
    } catch {
      if (seq === this.searchSeq) {
        this.searchResults = this.pageHits(q);
        this.searchOpen = true;
      }
    } finally {
      if (seq === this.searchSeq) this.searchBusy = false;
    }
  }

  /** Design A: open the search popover (the corner button, Ctrl/Cmd+K) with the input focused and, when it still holds
   * the last query, that query selected. Not inside the kiosk / Lovelace card view (no shell there), nor behind the gate. */
  private openSearch() {
    if (this.gated || this.route?.segments[0] === 'kiosk' || this.embedded()) return;
    this.searchPanel = true;
    if (this.searchQ.trim() && this.searchResults.length) this.searchOpen = true;
    void this.updateComplete.then(() => {
      const input = this.renderRoot.querySelector<HTMLInputElement>('.searchpanel input');
      input?.focus();
      input?.select();
    });
  }

  private closeSearchPanel(restoreFocus = true) {
    if (!this.searchPanel) return;
    this.searchPanel = false;
    this.closeSearch();
    if (restoreFocus) this.renderRoot.querySelector<HTMLElement>('[data-search-open]')?.focus({ preventScroll: true });
  }

  private onSearchKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.closeSearchPanel();
      return;
    }
    if (!this.searchOpen || !this.searchResults.length) {
      if (e.key === 'Enter' && this.searchQ.trim()) void this.runSearch(this.searchQ);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.searchIndex = (this.searchIndex + 1) % this.searchResults.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.searchIndex = (this.searchIndex - 1 + this.searchResults.length) % this.searchResults.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = this.searchResults[this.searchIndex] ?? this.searchResults[0];
      if (r) this.openResult(r);
    }
  }

  private openResult(r: SearchResult) {
    this.closeSearch();
    const input = this.renderRoot.querySelector<HTMLInputElement>('.search input');
    if (input) {
      input.value = '';
      input.blur();
    }
    this.searchQ = '';
    this.searchResults = [];
    this.searchPanel = false;
    window.location.hash = `#${routeFor(r, this.route?.path)}`;
  }

  private closeSearch() {
    this.searchOpen = false;
    this.searchIndex = -1;
  }

  /** Demo-only routes land on their real counterpart once a backend is known (F1 F3 F4 F5 F6 F10). */
  private redirectDemo(route: RouteState): boolean {
    if (this.enforceKiosk(route)) return true;
    // routes that moved (the alarm, camera health, the alarm management): with or without a backend, query kept
    const moved = legacyRedirect(route, this.legacyAccess());
    if (moved) {
      window.location.replace(`#${moved}`);
      return true;
    }
    const target = demoRedirect(route.path, this.session.mode === 'api');
    if (!target) return false;
    window.location.replace(`#${target}`);
    return true;
  }

  /** Who is asking, for the redirects that depend on it (the device catalogue: settings for system.configure, else the map). */
  private legacyAccess(): LegacyAccess {
    return { api: this.session.mode === 'api', ready: this.session.mode !== 'loading', can: canNav };
  }

  /** A user whose only role is the kiosk role belongs on the wall: the shell keeps such a session there (T057).
   * The API already limits the role to map.read + video.live; this closes the navigation side. */
  private get kioskOnly(): boolean {
    const b = (this.session.me?.bindings ?? []).filter((x) => x.effect !== 'deny');
    return this.session.mode === 'api' && b.length > 0 && b.every((x) => x.role_id === 'kiosk');
  }

  private enforceKiosk(route: RouteState): boolean {
    if (!this.kioskOnly || route.segments[0] === 'kiosk') return false;
    window.location.replace('#/kiosk/all');
    return true;
  }

  private get gated(): boolean {
    return this.session.mode === 'no_access' || this.session.mode === 'unauthenticated';
  }

  /** The result list of the search popover. */
  private renderResults() {
    return html`<div class="results" id="search-results" role="listbox" aria-label="תוצאות חיפוש">
      ${!isApi() && !this.searchResults.length
        ? html`<div class="empty">החיפוש עובד מול השרת (במצב הדגמה אין נתונים).</div>`
        : this.searchBusy && !this.searchResults.length
          ? html`<div class="empty">מחפש…</div>`
          : this.searchResults.length
            ? this.searchResults.map((r, i) => html`<div class="row ${i === this.searchIndex ? 'on' : ''}" role="option" aria-selected=${i === this.searchIndex} @mousedown=${(e: Event) => e.preventDefault()} @click=${() => this.openResult(r)}><sw-icon .name=${KIND_ICON[r.kind]} size=${16}></sw-icon><span class="txt"><span class="t">${r.title}</span><span class="s">${r.subtitle}</span></span><span class="kind">${KIND_LABEL[r.kind]}</span></div>`)
            : html`<div class="empty">לא נמצא דבר עבור "${this.searchQ}". חדרים מופיעים רק אם סומנו "הכללה בחיפוש מרחבי"; אירועים מסוננים במרכז האירועים.</div>`}
    </div>`;
  }

  /** Design A: the floating corner - the system status dot and the search button (the popover opens under them). */
  private renderFloat() {
    const dot = this.renderSysDot();
    const canSearch = !this.gated;
    if (dot === nothing && !canSearch) return nothing;
    const open = this.searchOpen && !!this.searchQ.trim();
    return html`${this.searchPanel ? html`<div class="searchscrim" data-search-scrim @click=${() => this.closeSearchPanel(false)}></div>` : nothing}
      <div class="float" data-float>
        <div class="pillrow">${dot}${canSearch ? html`<button type="button" data-search-open aria-label=${t('app.search')} title=${t('app.search')} aria-haspopup="dialog" aria-expanded=${this.searchPanel ? 'true' : 'false'} @click=${() => (this.searchPanel ? this.closeSearchPanel(false) : this.openSearch())}><sw-icon name="search" size=${16}></sw-icon></button>` : nothing}</div>
        ${this.searchPanel
          ? html`<div class="searchpanel" data-search-panel role="dialog" aria-label="חיפוש">
              <label class="search a"><sw-icon name="search" size=${16}></sw-icon><input type="search" placeholder="חיפוש חדרים, מצלמות, קומות וישויות…" aria-label=${t('app.search')} autocomplete="off" role="combobox" aria-expanded=${open} aria-controls="search-results" .value=${this.searchQ} @input=${this.onSearchInput} @keydown=${this.onSearchKey} @focus=${() => { if (this.searchResults.length) this.searchOpen = true; }} /></label>
              ${open ? this.renderResults() : nothing}
            </div>`
          : nothing}
      </div>`;
  }

  /** Full-screen gate for identity problems; `null` (not lit's `nothing`, which is truthy) when the app may render. */
  private renderGate() {
    const s = this.session;
    if (s.mode === 'unauthenticated') {
      return html`<div class="gate"><sw-state-panel state="forbidden" heading="נדרשת כניסה למערכת" hint=${s.error ?? ''}></sw-state-panel></div>`;
    }
    if (s.mode === 'no_access') {
      return html`<div class="gate"><sw-state-panel state="forbidden" heading="אין לך עדיין תפקיד במערכת" hint="המשתמש ${s.me?.user.display_name || s.me?.user.username || ''} מזוהה במערכת, אך מנהל המערכת טרם שייך לו תפקיד והיקף. פנה למנהל המערכת."></sw-state-panel></div>${this.renderPermToast()}`;
    }
    return null;
  }

  private renderPermToast() {
    return this.permToast ? html`<div class="perm-toast" role="status" aria-live="polite" data-perm-toast>${this.permToast}</div>` : nothing;
  }

  /** T055: the server says this user's access changed - re-read /me (navigation and gates follow the session), re-mount
   * the current screen so it re-fetches what it may still see, and tell the user. */
  private async onPermissionsChanged() {
    await loadSession();
    resetAlarmPresence(); // the alarm pages follow the new permissions (the session listener asks again)
    this.permEpoch += 1;
    this.permToast = 'ההרשאות שלך עודכנו';
    window.clearTimeout(this.permToastTimer);
    this.permToastTimer = window.setTimeout(() => (this.permToast = ''), 5000);
    window.dispatchEvent(new CustomEvent('sw-permissions-changed'));
  }

  private renderScreen() {
    return html`${keyed(this.permEpoch, this.renderRoute())}${this.renderPermToast()}`;
  }

  private renderRoute() {
    const r = this.route;
    if (!r) return nothing;
    if (this.landedDefault && this.session.mode === 'api' && !this.startResolved) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const s = r.segments;
    const moved = legacyRedirect(r, this.legacyAccess()); // safety net: the route handler redirects first
    if (moved) {
      queueMicrotask(() => window.location.replace(`#${moved}`));
      return html`<sw-state-panel state="loading"></sw-state-panel>`;
    }
    if (this.session.mode === 'api' && NVR_LESS && isNvrRoute(r)) return this.renderNvrLess();
    // Mobile options (owner 2026-09-30, הגדרות › כללי › אפשרויות נייד): a screen that creates, edits or deletes things is not
    // offered on a phone while its option is on. A UX guard, NOT a security boundary: the server still enforces every permission.
    const guarded = routeGuardKind(s);
    if (guarded && phoneRestricted(guarded)) return this.desktopOnly(guarded, s);
    if (s[0] === 'styleguide') return html`<styleguide-screen></styleguide-screen>`;
    if (s[0] === 'screens') return html`<screens-index></screens-index>`;
    if (s[0] === 'kiosk') return html`<kiosk-wall></kiosk-wall>`;
    switch (r.mode) {
      case 'live':
        if (s[1] === 'wall') return html`<live-wall .cameras=${r.params.get('cameras') ?? ''}></live-wall>`;
        if (s[1] === 'views') return html`<live-views></live-views>`;
        if (s[1] === 'cameras') return html`<live-camera .cameraId=${s[2] ?? 'cam-1'}></live-camera>`;
        return this.snapshotHidden() ?? html`<live-overview></live-overview>`;
      case 'investigate':
        if (s[1] === 'playback' && s[2] === 'sync') return html`<investigate-sync></investigate-sync>`;
        if (s[1] === 'playback') return html`<investigate-playback .cameraId=${r.params.get('camera') ?? ''} .at=${r.params.get('t') ?? ''} .extraParam=${r.params.get('extra') ?? ''}></investigate-playback>`;
        if (s[1] === 'floors') return html`<investigate-history-map .floorId=${s[2] ?? 'f0'} .at=${r.params.get('t') ?? ''} .camera=${r.params.get('camera') ?? ''}></investigate-history-map>`;
        if (s[1] === 'events' && s[2]) return html`<investigate-event-detail .eventId=${s[2]}></investigate-event-detail>`;
        if (s[1] === 'events') return html`<investigate-events .cameraId=${r.params.get('camera') ?? ''} .date=${r.params.get('date') ?? ''}></investigate-events>`;
        if (s[1] === 'reviews') return this.session.mode === 'api' ? html`<investigate-events .initialMode=${'windows'} .cameraId=${r.params.get('camera') ?? ''} .date=${r.params.get('date') ?? ''}></investigate-events>` : html`<investigate-reviews></investigate-reviews>`;
        if (s[1] === 'cases' && s[2]) return html`<investigate-case-detail .caseId=${s[2]}></investigate-case-detail>`;
        if (s[1] === 'cases') return html`<investigate-cases></investigate-cases>`;
        if (s[1] === 'exports') return html`<investigate-exports></investigate-exports>`;
        if (s[1] === 'health') return html`<system-devices></system-devices>`; // camera health (was #/system/devices)
        if (s[1] === 'search') return html`<investigate-search></investigate-search>`;
        if (s[1] === 'rules' && s[2]) return html`<investigate-rule-editor .ruleId=${s[2]}></investigate-rule-editor>`;
        if (s[1] === 'rules') return html`<investigate-rules .initialTab=${r.params.get('tab') ?? ''}></investigate-rules>`;
        return html`<investigate-playback></investigate-playback>`;
      case 'system':
        if (s[1] === 'audit') return html`<system-audit></system-audit>`;
        if (s[1] === 'setup') return html`<system-setup></system-setup>`;
        if (s[1] === 'wizard') return html`<system-wizard></system-wizard>`;
        if (s[1] === 'security') return html`<system-security .sub=${s[2] ?? ''} .panelId=${r.params.get('panel') ?? ''}></system-security>`;
        if (s[1] === 'storage') return html`<system-storage></system-storage>`;
        if (s[1] === 'schedules') return html`<system-schedules></system-schedules>`; // הגדרות › תזמונים (CR-014)
        if (s[1] === 'multimedia') return html`<system-multimedia></system-multimedia>`; // הגדרות › מולטימדיה (CR-015)
        if (s[1] === 'entities') return html`<explore-entities></explore-entities>`; // the device catalogue, formerly the map's "התקנים" tab (system.configure only: the screen checks it too)
        if (s[1] === 'access') return html`<system-access></system-access>`;
        if (s[1] === 'notifications') return html`<arx-notifications-settings></arx-notifications-settings>`;
        return html`<system-diagnostics></system-diagnostics>`;
      case 'wiskey': {
        // T054/0.1.103: WisKey entry center (CR-005), now its own top-level area, not an explore sub-tab.
        // CR-005 phase 1b: the read-only activity log at #/wiskey/events and people directory at #/wiskey/people.
        // CR-005 recorded decision 2026-09-28: each of those three renders either the SMPLWISE screen or WisKey's own
        // panel embedded as-is (הגדרות › בקרות כניסה, the embed by default); WisKey's other tabs are always embedded.
        // The choice lives in the product settings, so wait for them rather than flash one screen and swap to the other.
        if (this.session.mode === 'api' && !this.startResolved) return html`<sw-state-panel state="loading"></sw-state-panel>`;
        // T054 follow-up: the whole area hidden (הגדרות › בקרות כניסה) - a direct URL lands on the same "not
        // available" panel a missing access.read permission shows (wiskey-*.ts `data-wiskey-state="no_permission"`),
        // not the embed or either SMPLWISE screen; the per-screen choice does not apply while the area is hidden.
        if (this.session.mode === 'api' && WISKEY_HIDDEN) {
          return html`<sw-page heading="WisKey"><sw-state-panel data-wiskey-state="hidden" state="forbidden" heading="אזור WisKey מוסתר" hint="מנהל המערכת הסתיר את אזור WisKey עבור כל המשתמשים, בהגדרות › בקרות כניסה. אפשר להציג אותו מחדש שם."></sw-state-panel></sw-page>`;
        }
        const w = wiskeyRoute(r, this.session.mode === 'api');
        // one call site: switching embedded tabs keeps the loaded frame (embed API v1: a wiskey:navigate message)
        if (w.kind === 'embed') return html`<wiskey-embed .tab=${w.tab} .tool=${w.tool ?? ''}></wiskey-embed>`;
        if (w.screen === 'events') return html`<wiskey-events></wiskey-events>`;
        if (w.screen === 'people') return html`<wiskey-people></wiskey-people>`;
        return html`<wiskey-overview></wiskey-overview>`;
      }
      case 'security': {
        // CR-010: #/security/alarm is the alarm section again (0.1.147) - the same screen as הגדרות › אבטחה › אזעקה; a link
        // to it on a system without a panel shows the screen's own "no alarm panel" state, never a blank page.
        // #/security itself opens the section this browser used last (לייב by default).
        if (s[1] === 'alarm') return html`<security-alarm .panelId=${r.params.get('panel') ?? ''}></security-alarm>`;
        if (this.session.mode === 'loading') return html`<sw-state-panel state="loading"></sw-state-panel>`;
        // ui.tabs decides which section and page open first: wait for the product settings (as the start screen does)
        if (this.session.mode === 'api' && !this.startResolved) return html`<sw-state-panel state="loading"></sw-state-panel>`;
        const target = securityTarget(this.session.mode === 'api', canNav);
        queueMicrotask(() => window.location.replace(target));
        return html`<sw-state-panel state="loading"></sw-state-panel>`;
      }
      case 'devices':
        // CR-007 slice 1: the read-only electricity / device control area - the building tree and one area's cards.
        if (s[1] === 'areas' && s[2]) return html`<devices-area .areaId=${decodeURIComponent(s[2])}></devices-area>`;
        // CR-014: "תזמונים", the second tab of the home area. The list, its drawer (#/devices/schedules/<id>), the trash
        // and the review are one element (it reads the address itself); the editor is a screen of its own (registered by
        // screens/schedule-editor), and `new` / `trash` / `review` are not schedule ids (the component's ids are 6-hex).
        if (s[1] === 'schedules' && s[3] === 'edit') {
          return html`<schedule-editor .scheduleId=${s[2] === 'new' ? '' : decodeURIComponent(s[2] ?? '')} .template=${r.params.get('template') ?? ''} .preset=${r.params.get('preset') ?? ''}></schedule-editor>`;
        }
        if (s[1] === 'schedules') return html`<devices-schedules></devices-schedules>`;
        return html`<devices-building></devices-building>`;
      case 'multimedia':
        // CR-015: the screens page. Players / groups (0.1.150) have an address but no tab yet: a plain "soon" state.
        if (s[1] === 'players' || s[1] === 'groups') {
          return html`<sw-page heading=${s[1] === 'players' ? 'נגנים ורמקולים' : 'קבוצות'}><sw-state-panel data-multimedia-state="later" state="empty" heading="בקרוב"></sw-state-panel></sw-page>`;
        }
        return html`<multimedia-screens .remoteKey=${r.params.get('remote') ?? ''}></multimedia-screens>`;
      case 'explore':
      default: {
        if (s[1] === 'sites') return html`<explore-sites></explore-sites>`;
        if (s[1] === 'buildings') return html`<explore-floors .buildingId=${s[2] ?? 'bld-a'}></explore-floors>`;
        if (s[1] === 'entities') return html`<sw-state-panel state="loading"></sw-state-panel>`; // legacyRedirect decides once the session is known
        if (s[1] === 'floors' && s[3] === 'import') return html`<explore-plan-import .floorId=${s[2]}></explore-plan-import>`;
        if (s[1] === 'floors' && s[3] === 'edit') return keyed(s[2], html`<explore-plan-editor .floorId=${s[2]} .presetEntity=${r.params.get('entity') ?? ''} .presetCandidates=${r.params.get('candidates') ?? ''} .presetZone=${r.params.get('zone') ?? ''}></explore-plan-editor>`); // keyed: another floor is another editor (CR-009 section 14 jump)
        const floorId = s[1] === 'floors' && s[2] ? s[2] : 'f0';
        const screenState = (r.params.get('state') ?? 'ready') as 'ready';
        const focus = r.params.get('focus') ?? '';
        return html`<explore-floor-map .floorId=${floorId} .screenState=${screenState} .focusZone=${r.params.get('zone') ?? ''} .focusCamera=${r.params.get('camera') ?? ''} .focusEntity=${r.params.get('entity') ?? ''} .focusObject=${focus.startsWith('object:') ? focus.slice('object:'.length) : ''}></explore-floor-map>`;
      }
    }
  }

  /** The phone's answer to #/explore/floors/<id>/edit and /import: a short clean state and a way back to the map (viewing, layers, tools
   * and the read-only map stay fully available on a phone). */
  private desktopOnly(kind: MobileKind, s: readonly string[]) {
    const floorId = kind === 'structure' ? s[2] : undefined;
    const back = floorId ? `#/explore/floors/${encodeURIComponent(floorId)}` : kind === 'structure' ? '#/explore/sites' : '#/system/diagnostics';
    const label = floorId ? 'חזרה למפת הקומה' : kind === 'structure' ? 'חזרה לאתרים' : 'חזרה להגדרות';
    return html`<div data-desktop-only=${kind}>
      <sw-state-panel state="empty" heading=${kind === 'structure' ? STRUCTURE_DESKTOP_ONLY : DESKTOP_ONLY} hint="">
        <div style="margin-block-start:10px"><sw-button variant="primary" size="lg" icon="chevron" data-desktop-only-back @click=${() => { window.location.hash = back; }}>${label}</sw-button></div>
      </sw-state-panel>
    </div>`;
  }

  /** ui.security_snapshot off: the live overview ("תמונת מצב") sends its address to the next live page this user sees
   * (a bookmark keeps working); null when it is shown, or when there is no other live page to go to. */
  private snapshotHidden() {
    if (this.session.mode !== 'api') return null;
    if (!this.startResolved) return html`<sw-state-panel state="loading"></sw-state-panel>`; // the settings decide
    const target = liveOverviewTarget(true, canNav);
    if (!target) return null;
    queueMicrotask(() => window.location.replace(target));
    return html`<sw-state-panel state="loading"></sw-state-panel>`;
  }

  /** NVR-less mode: a URL of an NVR area (a bookmark, an old link, the Lovelace card) lands here instead of a screen that
   * would only fail. Inside the Lovelace card (embed=1) the card degrades to the map, its only view that needs no NVR. */
  private renderNvrLess() {
    if (this.embedded()) return html`<explore-floor-map .floorId=${'f0'} .screenState=${'ready'}></explore-floor-map>`;
    return html`<sw-page heading="מצב ללא NVR"><sw-state-panel data-nvr-less state="empty" heading="האזור הזה דורש NVR"
      hint="ההתקנה פועלת במצב ללא NVR (תשתית המערכת בלבד): לייב, מצלמות, אירועים, הקלטות, תיקים וייצוא אינם זמינים; המפה, חשמל והתקנים ו־WisKey עובדים כרגיל. להוספת NVR: מלאו nvr_host, nvr_username ו־nvr_password בהגדרות SmplWise Arx בתשתית המערכת והפעילו מחדש - הנתונים נשארים כמו שהם."
      actionLabel="לחיבורים" @action=${() => (window.location.hash = '#/system/setup')}></sw-state-panel></sw-page>`;
  }

  // ---- CR-013: the user (avatar) as the navigation's last item, its menu and the tab order ----

  private get userName(): string {
    const me = this.session.me;
    return me?.user.display_name || me?.user.username || (this.session.mode === 'demo' ? 'יוני' : '');
  }

  private get userRole(): string {
    const me = this.session.me;
    return me?.bindings[0]?.role_name ?? (this.session.mode === 'demo' ? 'מנהל מערכת' : this.session.mode === 'loading' ? '' : 'ללא שיוך');
  }

  /** The avatar's accessible name: who, and the open alerts (the red dot says it visually). */
  private userLabel(): string {
    const n = this.alertCount ?? 0;
    return `תפריט המשתמש${this.userName ? ` · ${this.userName}` : ''}${n ? ` · ${openAlertsText(n)}` : ''}`;
  }

  /** The alert count for the red dot and the menu: the server's `unacked`, the open alerts in this user's scope
   * (routers/rules.py filters by camera scope). Null = this user may not read alerts. Never inside the kiosk or the
   * Lovelace card view: they have no user menu. */
  private async pollAlerts() {
    if (this.route?.segments[0] === 'kiosk' || this.embedded()) return;
    if (this.session.mode === 'demo') {
      this.alertCount = 0;
      return;
    }
    if (this.session.mode !== 'api' || !canNav('events.read')) {
      this.alertCount = null;
      return;
    }
    try {
      this.alertCount = (await listAlerts(true)).unacked;
    } catch {
      /* keep the last known count */
    }
  }

  // ---- overlays and the Back button (review M4): while the phone sheet or the tab-order dialog is open, one history
  // entry (same address) stands for it, so Back closes the overlay instead of leaving the screen underneath ----

  private overlayEntry = false;

  private pushOverlay() {
    if (this.overlayEntry) return;
    this.overlayEntry = true;
    try {
      window.history.pushState({ ...(window.history.state ?? {}), swOverlay: true }, '');
    } catch {
      this.overlayEntry = false;
    }
  }

  /** The overlay closed by itself (✕, Esc, save): drop its history entry. */
  private popOverlay() {
    if (!this.overlayEntry) return;
    this.overlayEntry = false;
    if ((window.history.state as { swOverlay?: boolean } | null)?.swOverlay) window.history.back();
  }

  /** What a menu item does once its overlay entry is gone (navigateFromOverlay / runFromOverlay). */
  private pendingRun: (() => void) | null = null;

  /** A menu item's navigation: close the overlay, drop its history entry first (Back then returns to the screen the
   * user was on, not to a duplicate of it), then go. */
  private navigateFromOverlay(href: string) {
    this.closeMenu(false, false);
    this.orderOpen = false;
    const own = this.overlayEntry && (window.history.state as { swOverlay?: boolean } | null)?.swOverlay;
    this.overlayEntry = false;
    if (own) {
      this.pendingRun = () => (window.location.hash = href);
      window.history.back();
    } else {
      window.location.hash = href;
    }
  }

  /** A menu item that acts on the screen instead of leaving it (a screen's edit mode): the same order as a navigation -
   * close the menu, drop its history entry (Back then still means "leave the screen"), then run. */
  private runFromOverlay(run: () => void) {
    this.closeMenu(false, false);
    this.orderOpen = false;
    const own = this.overlayEntry && (window.history.state as { swOverlay?: boolean } | null)?.swOverlay;
    this.overlayEntry = false;
    if (own) {
      this.pendingRun = run;
      window.history.back();
    } else {
      run();
    }
  }

  private onPopState = (e: PopStateEvent) => {
    if (this.pendingRun) {
      const run = this.pendingRun;
      this.pendingRun = null;
      run();
      return;
    }
    if (!this.overlayEntry || (e.state as { swOverlay?: boolean } | null)?.swOverlay) return;
    this.overlayEntry = false;
    this.orderOpen = false;
    this.closeMenu(true, false);
  };

  private openMenu(from: HTMLElement | null) {
    this.menuTrigger = from;
    this.menuOpen = true;
    if (this.phone) this.pushOverlay();
    void this.pollAlerts();
  }

  private closeMenu(restoreFocus = true, dropEntry = true) {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    if (dropEntry) this.popOverlay();
    if (restoreFocus) this.menuTrigger?.focus({ preventScroll: true });
  }

  private renderMe(where: 'rail' | 'bottom') {
    const n = this.alertCount ?? 0;
    const first = this.userName.split(/\s+/)[0] || 'חשבון';
    // review M6: the settings (#/system/...) are reached from here, so the avatar is the active item there
    const here = areaOf(this.route) === 'system';
    return html`<button type="button" class=${classMap({ me: true, [where]: true, open: this.menuOpen, active: here })} ?data-profile-menu=${where === 'rail'} ?data-nav-me=${where === 'bottom'} data-has-alerts=${n ? 'true' : 'false'}
      aria-current=${here ? 'page' : 'false'} aria-haspopup="dialog" aria-expanded=${this.menuOpen ? 'true' : 'false'} aria-label=${this.userLabel()} title=${this.userLabel()}
      @click=${(e: Event) => (this.menuOpen ? this.closeMenu(false) : this.openMenu(e.currentTarget as HTMLElement))}>
      <span class="ic"><span class="av"><sw-avatar name=${this.userName} size=${where === 'rail' ? this.nav.avatar : this.nav.pAvatar}></sw-avatar>${n ? html`<i class="dot" data-alert-dot aria-hidden="true"></i>` : nothing}</span></span><span class="lbl">${first}</span>
    </button>`;
  }

  /** The status pills of the old phone top bar (demo data, the setup progress), now in the user menu's header on the
   * phone (sw-user-menu shows the slot there only). The system health is the corner dot on every width. */
  private renderMenuPills() {
    // only while the phone sheet is open: on a wide screen the setup progress is the hint under the tab row
    if (!this.menuOpen || !this.phone) return nothing;
    const h = this.setupHint;
    return html`<span slot="pills" class="menu-pills">
      ${this.session.mode === 'demo' ? html`<sw-badge kind="neutral" label="נתוני הדגמה" data-demo-pill></sw-badge>` : nothing}
      ${h ? html`<a class="setup-pill" href="#/system/wizard" data-setup-pill @click=${(e: Event) => { e.preventDefault(); this.navigateFromOverlay('#/system/wizard'); }}><sw-icon name="info" size=${14}></sw-icon>השלם את ההתקנה · ${h.done}/${h.total}</a>` : nothing}
    </span>`;
  }

  /** "עריכת המסך הראשי": the same people who may edit the home screen's layout - devices-layout.ts `canEdit` (a backend
   * answers and the user holds system.configure at the installation) - and only while the home area is in their navigation.
   * Like every screen-level edit item (shell/screen-edit.ts) it is offered only on its own screen: the home (isHomeRoute),
   * not on the wall, the maps or an area (owner 2026-09-30). */
  private canEditHome(): boolean {
    return !this.gated && isHomeRoute(this.route) && isApi() && can('system.configure') && !phoneRestricted('layout_editor') && visibleAreas(true, canNav, this.navOrder).some((a) => a.id === 'devices');
  }

  private renderUserMenu() {
    const api = this.session.mode === 'api';
    const settings = this.gated ? null : settingsEntry(api, canNav);
    const noTabs = this.gated || !visibleAreas(api, canNav, this.navOrder).length;
    return html`<sw-user-menu .open=${this.menuOpen} .name=${this.userName} .role=${this.userRole} .api=${api} .gated=${noTabs} .alerts=${this.gated ? null : this.alertCount}
        .settingsHref=${settings?.href ?? ''} .editHomeHref=${this.canEditHome() ? '#/devices/building?edit=1' : ''}
        .screenEdits=${this.gated ? [] : screenEdits().map((a) => ({ id: a.id, label: a.label, icon: a.icon ?? 'edit' }))}
        .screenViews=${this.gated ? [] : screenViews()}
        @screen-view=${(e: CustomEvent<{ id: string; value: string }>) => findScreenView(e.detail.id)?.set(e.detail.value)}
        @screen-edit=${(e: CustomEvent<{ id: string }>) => { const a = findScreenEdit(e.detail.id); if (a) this.runFromOverlay(() => a.run()); }}
        @close=${() => this.closeMenu()} @navigate=${(e: CustomEvent<{ href: string }>) => this.navigateFromOverlay(e.detail.href)} @nav-order=${() => {
          // the sheet hands over to the dialog: its history entry now stands for the dialog
          this.closeMenu(false, false);
          this.orderOpen = true;
          this.pushOverlay();
        }}>${this.renderMenuPills()}</sw-user-menu>
      <sw-nav-order .open=${this.orderOpen} .tabs=${visibleAreas(api, canNav, this.navOrder)} .order=${[...this.navOrder]}
        .onSave=${(o: string[]) => saveNavOrder(o)} .onReset=${() => resetNavOrder()}
        @close=${() => {
          if (!this.orderOpen) return;
          this.orderOpen = false;
          this.popOverlay();
          this.menuTrigger?.focus({ preventScroll: true });
        }}></sw-nav-order>`;
  }

  private renderA() {
    const area = areaOf(this.route);
    const api = this.session.mode === 'api';
    // CR-010: in the security area the tab row shows the current SECTION's pages; the sections themselves are the
    // segmented control at the head of the page (renderSections) - on the phone, the sticky row above the tab row (CR-013)
    const section = area === 'security' ? sectionOf(this.route) : null;
    const tabs = section ? visibleTabs(SECTION_TABS[section], api, canNav) : area && area !== 'security' ? visibleTabs(AREA_TABS[area], api, canNav) : [];
    // the plan editors' and the schedule editor's routes, and the home layout editor (`?edit=1`, CR-014): no tab row
    const editor = this.route?.segments[3] === 'edit' || this.route?.segments[3] === 'import' || isHomeEditRoute(this.route) || isMultimediaEditRoute(this.route);
    const areas = visibleAreas(api, canNav, this.navOrder);
    const showSections = area === 'security' && !this.gated;
    // 0.1.148: the look of this row (pill / underline / compact underline) is the installation's choice per hierarchy level,
    // overridable per section (הגדרות › כללי › לשוניות) - one helper for every row (nav.ts tabStyleOf)
    const rowStyle = tabStyleOf(areaRowSection(area, section));
    return html`
      <nav class="rail" aria-label="ניווט ראשי">
        <span class="brand-tile" aria-hidden="true"><span>S</span></span>
        ${areas.map(
          (n) => html`<a class=${classMap({ item: true, a: true, active: area === n.id })} href=${n.href} title=${n.label} aria-label=${n.label} aria-current=${area === n.id ? 'page' : 'false'} data-nav=${n.id}>
            <sw-icon .name=${n.icon} size=${this.nav.icon}></sw-icon><span>${n.label}</span>
          </a>`,
        )}
        <div class="grow"></div>
        ${this.renderMe('rail')}
      </nav>
      ${this.renderFloat()}
      ${this.renderSysBanner()}
      <main>
        ${this.renderSetupHint()}
        ${this.renderGate() || html`
          ${showSections && this.phone ? this.renderSections(section, true) : nothing}<div class="subnav" data-tabstyle=${rowStyle}>${showSections && !this.phone ? this.renderSections(section) : nothing}${tabs.length > 1 && !editor ? html`<sw-tabs .items=${tabs} .active=${activeAreaTab(this.route)} .variant=${rowStyle} data-area-tabs></sw-tabs>` : nothing}</div>
          <div class="screen">${this.session.mode === 'loading' ? nothing : this.renderScreen()}</div>`}
      </main>
      <nav class="bottom" aria-label="ניווט ראשי">
        ${areas.map((n) => html`<a class=${classMap({ active: area === n.id })} href=${n.href} aria-label=${n.label} aria-current=${area === n.id ? 'page' : 'false'} data-nav=${n.id}><span class="ic"><sw-icon .name=${n.icon} size=${this.nav.pIcon}></sw-icon></span><span class="lbl">${n.label}</span></a>`)}
        ${this.renderMe('bottom')}
      </nav>
      ${this.renderUserMenu()}
    `;
  }

  /** CR-010: the security area's sections (לייב | חקירה | אזעקה) as a segmented control - at the head of the page on a
   * wide screen (before the page's tab row; UI round 1: no top bar), and on the phone as a slim sticky row above the tab row: area (rail / bottom bar),
   * section (here), page (the tab row), each on its own level. `row` = the phone's copy inside the content. */
  private renderSections(active: ReturnType<typeof sectionOf>, row = false) {
    const sections = visibleSections(this.session.mode === 'api', canNav);
    if (sections.length < 2) return nothing;
    const style = tabStyleOf('security');
    if (style !== 'pill') {
      // the installation chose an underline look for the sections: the same items as a tab row (sw-tabs draws it)
      return html`<nav class=${row ? 'sectabs phone' : 'sectabs'} aria-label="אבטחה" ?data-security-sections=${!row} ?data-security-row=${row}><sw-tabs .items=${sections.map((s) => ({ id: s.id, label: s.label, href: s.href }))} .active=${active ?? ''} .variant=${style} data-section-tabs></sw-tabs></nav>`;
    }
    return html`<nav class=${row ? 'sections secrow' : 'sections'} aria-label="אבטחה" ?data-security-sections=${!row} ?data-security-row=${row}>${sections.map(
      (s) => html`<a href=${s.href} class=${classMap({ on: s.id === active })} aria-current=${s.id === active ? 'page' : 'false'} data-section=${s.id}><span class="pill">${row ? nothing : html`<sw-icon .name=${s.icon} size=${15}></sw-icon>`}<span>${s.label}</span></span></a>`,
    )}</nav>`;
  }

  private embedded(route = this.route): boolean {
    if (route?.params.get('embed') === '1') return true;
    try {
      return sessionStorage.getItem('sw-embed') === '1';
    } catch {
      return false;
    }
  }

  render() {
    if (this.route?.segments[0] === 'kiosk') return html`<main style="block-size:100dvh">${this.renderScreen()}</main>`;
    if (this.embedded()) return html`<main class="embed" style="block-size:100dvh;overflow:auto">${this.renderScreen()}</main>`;
    return this.renderA();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-app': SwApp;
  }
}
