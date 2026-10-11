import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-dialog';
import '../components/sw-dropdown';
import '../components/sw-schedule-bar';
import './schedule-drawer';
import type { ScheduleActions } from './schedule-drawer';
import type { DropdownItem } from '../components/sw-dropdown';
import { aIcon, type AutomationIconName } from '../components/automation-icons';
import { automationsStyles } from '../styles/automations-glass';
import { mediaPageStyles, measureHeaderBar } from '../styles/media-page';
import { ApiError } from '../api/client';
import { isApi } from '../api/session';
import { applyAutomationsGlass, autoApi, autoReady } from '../api/automations-demo';
import { visibleKinds } from '../api/automations';
import type { ItemKind } from '../api/automations';
import { SEGMENTS, itemPath } from './automations-logic';
import type { KavarnitSegments } from '../shell/nav';
import { bidi } from '../i18n/bidi';
import { onRouteChange, parseRoute, navigate, pushRoute, replaceRoute, type RouteState } from '../router';
import { registerScreenEdit } from '../shell/screen-edit';
import { DEMO_SUN } from '../api/schedules-mock';
import {
  ACKABLE_ISSUES,
  DAY_ORDER,
  DAY_SHORT,
  REVIEW_LABEL,
  STATE_LABEL,
  acknowledgeScheduleIssue,
  bulkSchedules,
  getSchedule,
  getScheduleReview,
  getScheduleStatus,
  listSchedules,
  listTrash,
  purgeTrash,
  restoreFromTrash,
  subscribeSchedules,
  type AckableIssue,
  type DayId,
  type ReviewItem,
  type Schedule,
  type ScheduleStatus,
  type TrashItem,
} from '../api/schedules';
import {
  NO_FILTERS,
  STATE_SEGMENTS,
  activeFilterCount,
  conditionOptions,
  deletedText,
  devicesLine,
  extraFilterCount,
  filterSchedules,
  filtersToParams,
  groupSchedules,
  keptText,
  nextRunText,
  parseFilters,
  parseView,
  periodLabel,
  placeOptions,
  screenState,
  slotChips,
  sortSchedules,
  stateCounts,
  tagOptions,
  togglable,
  upcomingToday,
  windowText,
  STALE_TEXT,
  type ListFilters,
  type ListGroup,
  type ListSort,
  type ListView,
  type StateFilter,
  scheduleErrorText,
} from './schedules-logic';
import { toneColor } from '../components/sw-schedule-bar';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const VIEW_KEY = 'sw.schedules.view';
const FILTERS_KEY = 'sw.schedules.filters';
const BASE = '/devices/schedules';

interface Note {
  text: string;
  tone: 'ok' | 'error';
  action?: { label: string; run: () => void };
}

const VIEW_ICON: Record<ListView, AutomationIconName> = { cards: 'grid', table: 'list', week: 'calendar' };
const VIEW_LABEL: Record<ListView, string> = { cards: 'כרטיסים', table: 'טבלה', week: 'שבוע' };

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStored<T>(key: string): T | null {
  try {
    const raw = store()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the choice is not remembered */
  }
}

/** The floor of a schedule's devices when they share one ("קומת קרקע"), else '' (the card's bold "where" word). */
function floorOf(s: Schedule): string {
  const floors = [...new Set(s.entities.map((e) => e.floor_name).filter((x): x is string => !!x))];
  return floors.length === 1 ? floors[0] : '';
}

/**
 * CR-014 "תזמונים", the first segment of "קברניט" (`#/devices/schedules`). Owner 2026-10-04: designed exactly like the automations
 * and scenes screens (docs/design/schedules-parity.md) - the same page frame and glass material (styles/media-page.ts +
 * styles/automations-glass.ts, light or dark by `devices.scheme`, the bubble skin through its knobs): a large title with the
 * floors as chips, the segment strip (תזמונים · אוטומציות · סצנות · סקריפטים), the state filter with counts, "סינון", the search and
 * "+ תזמון חדש"; cards of the automation card's shape (the whole card opens the drawer, the switch and the "⋯" menu on it), the
 * table and the week as further views, a bulk bar for a selection; the same state boxes, banners and toast. The trash is in the
 * user menu ("סל מחזור"), as on the automations screen; the administrator's review list opens from its banner.
 * Written only against the typed client (api/schedules.ts) - the server decides what is visible and what may change.
 * Filtering, sorting and grouping run in the browser over the visible list (docs/architecture/SCHEDULER_API.md §3.2).
 */
@customElement('devices-schedules')
export class DevicesSchedules extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  /** 0.1.154: the segments of "קברניט" this user is offered (set by the shell). This screen is the first segment; the strip leads to the others. */
  @property({ attribute: false }) kavarnit: KavarnitSegments = { schedules: true, automations: true };
  /** The kinds of the automations screen this user may open and their counts (null = not loaded / not offered). */
  @state() private autoKinds: ItemKind[] | null = null;
  @state() private autoCounts: Record<ItemKind, number> | null = null;
  @state() private status: ScheduleStatus | null = null;
  @state() private items: Schedule[] | null = null;
  @state() private failed = '';
  @state() private noView = false;
  @state() private filters: ListFilters = { ...NO_FILTERS };
  @state() private view: ListView = 'cards';
  @state() private filtersOpen = false;
  @state() private selected = new Set<string>();
  @state() private sub = '';
  @state() private detail: Schedule | null = null;
  @state() private detailMissing = false;
  @state() private drawerUsed = false;
  @state() private trash: TrashItem[] | null = null;
  @state() private review: ReviewItem[] | null = null;
  @state() private subError = '';
  @state() private note: Note | null = null;
  @state() private createOpen = false;
  @state() private busy = false;
  @state() private reviewSel = new Set<string>();
  @state() private menuFor = '';
  @state() private compactHeader = false;
  @state() private phone = window.matchMedia('(max-width: 767px)').matches;

  private phoneMq = window.matchMedia('(max-width: 767px)');
  private onPhone = () => (this.phone = this.phoneMq.matches);
  private offRoute: (() => void) | null = null;
  private offEdit: (() => void) | null = null;
  private stopWs: (() => void) | null = null;
  private lastWritten = '';
  private urlTimer = 0;
  private noteTimer = 0;

  static styles = [bubbleChrome, ...automationsStyles, mediaPageStyles, css`
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    .dh-det .seg.kinds button {
      padding-inline: 14px;
    }
    .dh-det .grow {
      min-inline-size: 0;
    }
    .search {
      min-inline-size: 200px;
      flex: 0 1 260px;
    }
    .newbtn[disabled] {
      opacity: 0.5;
    }
    .foldbtn small {
      font-size: var(--sw-fs-xs);
      font-weight: 700;
      color: var(--dv-accent-text);
    }
    .vwrap {
      flex: none;
    }
    .views button {
      padding-inline: 12px;
      min-inline-size: 40px;
    }
    .views .ic {
      font-size: var(--sw-fs-lg);
    }
    /* the filters behind "סינון": the same chips and dropdown chips as the header */
    .more {
      flex: 1 1 100%;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 10px;
    }
    .more .days {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px;
      max-inline-size: 100%;
    }
    /* the bubble skin: the card's selection box and "..." key meet the touch dial on every width (the skin's rule) */
    @media (min-width: 1101px) and (pointer: fine) {
      :host([data-skin='bubble']) .pick,
      :host([data-skin='bubble']) .more-btn {
        inline-size: var(--sw-touch-desktop);
        block-size: var(--sw-touch-desktop);
      }
    }
    .rc.day {
      inline-size: 38px;
      padding-inline: 0;
    }
    .more .sep {
      inline-size: 1px;
      block-size: 22px;
      background: var(--dv-border);
    }
    .dh.compact .more {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .cgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
      gap: var(--dv-gap-lg, 16px);
      align-items: stretch;
    }
    /* ---- "today" (the runs still to come today): one quiet glass row ---- */
    .upnext {
      display: flex;
      align-items: center;
      gap: 10px 14px;
      padding: 10px 16px;
      flex-wrap: wrap;
    }
    .upnext::-webkit-scrollbar {
      display: none;
    }
    .upnext > b {
      flex: none;
      font-size: var(--sw-fs-base);
      font-weight: 700;
      color: var(--dv-text-2);
    }
    .up {
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: var(--sw-fs-base);
      color: var(--dv-text);
      white-space: nowrap;
    }
    .up time {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .up .what {
      color: var(--dv-text-2);
    }
    .up i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--c);
      flex: none;
    }
    /* ---- the card: the automation card's shape (sw-automation-card.ts), a schedule's content ---- */
    .acard {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 18px 14px;
      block-size: 100%;
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border: 1px solid var(--dv-border);
      border-radius: var(--sw-r-2xl);
      box-shadow: var(--dv-shadow-1);
      transition: box-shadow var(--mm-motion) var(--mm-ease), border-color var(--mm-motion);
    }
    .acard:hover {
      box-shadow: var(--dv-shadow-2);
    }
    .acard:focus-within {
      border-color: color-mix(in srgb, var(--dv-accent) 55%, transparent);
      box-shadow: var(--dv-shadow-2), 0 0 0 3px var(--dv-accent-soft);
    }
    .acard[data-picked] {
      border-color: var(--dv-accent);
      box-shadow: var(--dv-shadow-2), 0 0 0 3px var(--dv-accent-soft);
    }
    .acard[data-menu] {
      z-index: 20;
    }
    .acard.off .bar,
    .acard.off .meta {
      opacity: 0.55;
    }
    .acard header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-inline-size: 0;
    }
    .ttl {
      flex: 1;
      min-inline-size: 0;
    }
    .acard h3 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      font-weight: 700;
      letter-spacing: -0.015em;
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    a.name {
      color: inherit;
      text-decoration: none;
    }
    .acard a.name::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }
    a.name:focus-visible {
      outline: none;
    }
    .where {
      display: flex;
      align-items: center;
      gap: 0 8px;
      margin-block-start: 3px;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      min-inline-size: 0;
    }
    .where b {
      color: var(--dv-text);
      font-weight: 700;
      white-space: nowrap;
    }
    .where .ic {
      font-size: var(--sw-fs-md);
      color: var(--dv-text-3);
    }
    .where .ar {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ctl,
    .pick,
    .bar,
    .meta,
    .acard footer {
      position: relative;
      z-index: 2;
    }
    .ctl {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: none;
    }
    .pick {
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      margin-block-start: -2px;
      margin-inline-start: -6px;
      border-radius: 50%;
      flex: none;
      cursor: pointer;
    }
    .pick:hover {
      background: var(--dv-surface-3);
    }
    input[type='checkbox'] {
      inline-size: 17px;
      block-size: 17px;
      accent-color: var(--dv-accent);
      margin: 0;
      cursor: pointer;
    }
    .more-btn {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      border: 0;
      background: transparent;
      color: var(--dv-text-2);
    }
    .more-btn:hover,
    .more-btn[aria-expanded='true'] {
      background: var(--dv-surface-3);
      color: var(--dv-text);
    }
    .more-btn .ic {
      font-size: var(--sw-fs-2xl);
    }
    .acard .pop {
      background: var(--dv-surface-solid, #fff);
      inset-block-start: 52px;
      inset-inline-end: 12px;
      min-inline-size: 190px;
    }
    .acard .pop button {
      flex: none;
    }
    .pop button.dz,
    .pop button.dz .ic {
      color: var(--dv-danger);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 8px;
      align-items: center;
      min-block-size: 26px;
    }
    .acard footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin-block-start: auto;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
    }
    .run {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-variant-numeric: tabular-nums;
      min-inline-size: 0;
    }
    .run b {
      color: var(--dv-text);
      font-weight: 600;
    }
    /* ---- the table ---- */
    .tbl {
      overflow: hidden;
      padding: 0;
    }
    .tr {
      display: grid;
      grid-template-columns: 34px minmax(160px, 1.4fr) auto minmax(230px, 1.9fr) minmax(120px, 1fr) 118px 60px 92px;
      gap: 12px;
      align-items: center;
      padding: 10px 16px;
      border-block-end: 1px solid var(--dv-border);
      font-size: var(--sw-fs-base);
    }
    .tr:last-child {
      border-block-end: 0;
    }
    .tr.h {
      background: var(--dv-surface-2);
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: 600;
      padding-block: 9px;
    }
    .tr[data-picked] {
      background: var(--dv-accent-soft);
    }
    .tr.off .name,
    .tr.off .slotrows {
      opacity: 0.6;
    }
    .tr .name {
      display: block;
      font-weight: 700;
      font-size: var(--sw-fs-md);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tr .name:hover {
      color: var(--dv-accent-text);
    }
    .tr .sub {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .slotrows {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-inline-size: 0;
    }
    .sr {
      display: grid;
      grid-template-columns: 92px minmax(0, 1fr);
      gap: 8px;
      align-items: center;
    }
    .sr .w {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      direction: ltr;
      text-align: end;
      unicode-bidi: isolate;
    }
    .sr .a {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      min-inline-size: 0;
    }
    .ac {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 1px 8px;
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
      background: color-mix(in srgb, var(--c) 16%, transparent);
      color: var(--dv-text);
      max-inline-size: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .linkbtn {
      font-size: var(--sw-fs-sm);
      font-weight: 600;
      color: var(--dv-accent-text);
      background: none;
      border: 0;
      padding: 0;
      text-align: start;
      min-block-size: 28px;
    }
    .ops {
      display: inline-flex;
      gap: 2px;
      justify-content: flex-end;
    }
    /* ---- trash, review: rows of the drawer's block style ---- */
    .rows {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 14px 16px;
      border-radius: var(--sw-r-2xl);
    }
    .li .t {
      font-weight: 700;
      font-size: var(--sw-fs-lg);
    }
    .li .d {
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
    }
    .li .issues {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-block-start: 6px;
    }
    /* an issue is a sentence-long chip: it wraps inside the row on a narrow phone */
    .li .issues .chip {
      white-space: normal;
      block-size: auto;
      min-block-size: 26px;
      padding-block: 3px;
      max-inline-size: 100%;
    }
    .li .lops {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    /* 2026-10-04: an administrator's "fine from our side" - the warning chip gives way to a small muted state */
    .li .issues .iss {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      max-inline-size: 100%;
    }
    .li .issues .chip.acked {
      background: transparent;
      color: var(--dv-text-2);
      border: 1px solid var(--dv-line, var(--sw-border));
      font-weight: 500;
    }
    /* ---- the bulk bar: the edit bar of the glass style, kept at the bottom while scrolling ---- */
    .bulk {
      position: sticky;
      inset-block-end: 14px;
      z-index: 6;
      align-self: center;
      max-inline-size: 100%;
    }
    /* the note is a popover (top layer): a modal drawer or dialog is open while most notes appear, and must not dim them */
    .toast[popover] {
      inset-block-start: auto;
      margin-block: 0;
      padding: 11px 20px 11px 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      overflow: visible;
    }
    .toast .btn {
      min-block-size: 28px;
      padding-inline: 12px;
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
      border-color: transparent;
      box-shadow: none;
      margin-inline-start: 6px;
    }
    .toast.bad .ic {
      color: #ff453a;
    }
    .dlgform {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-block-start: 4px;
    }
    .dlgform p {
      margin: 0;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-md);
    }
    .dlgrow {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    @media (pointer: coarse), (max-width: 1100px) {
      .pick,
      .more-btn {
        inline-size: 44px;
        block-size: 44px;
      }
      .views button {
        min-inline-size: 44px;
      }
      .rc.day {
        inline-size: 44px;
      }
      .linkbtn {
        min-block-size: 44px;
      }
    }
    @media (max-width: 1100px) {
      .tr {
        grid-template-columns: 34px minmax(120px, 1.4fr) minmax(160px, 2fr) minmax(80px, 1fr) 104px 56px 92px;
      }
      .tr > .cdays {
        display: none;
      }
    }
    @media (max-width: 767px) {
      /* the phone: the view switch moves under the search row (the title row keeps the automations screen's height, so the
         segment strip stays in place when switching between the two screens) */
      .dh-row {
        grid-template-areas: 't .' 'r r';
        grid-template-columns: minmax(0, 1fr) var(--sw-float-reserve, 0px);
      }
      .dh-det .vwrap {
        order: 4;
      }
      .dh-det {
        gap: 10px;
      }
      .dh-det .seg.kinds {
        order: 1;
        inline-size: 100%;
      }
      .dh-det .seg.kinds button {
        flex: 1;
        padding-inline: 8px;
      }
      .dh-det .stf {
        order: 2;
        inline-size: 100%;
        display: none;
        flex-wrap: wrap;
        justify-content: flex-start;
      }
      .dh-det .stf::-webkit-scrollbar {
        display: none;
      }
      .dh-det .stf[data-open] {
        display: inline-flex;
      }
      .dh-det .grow {
        display: none;
      }
      .dh-det .search {
        order: 3;
        flex: 1 1 120px;
        min-inline-size: 0;
      }
      .dh-det .foldbtn,
      .dh-det .newbtn {
        order: 3;
      }
      .more {
        order: 5;
      }
      .tr.h {
        display: none;
      }
      .tr {
        grid-template-columns: 34px minmax(0, 1fr) auto;
        grid-template-areas: 'sel name tog' '. slots slots' '. days days' '. cond next';
        row-gap: 8px;
        padding: 12px 14px;
      }
      .tr > .csel {
        grid-area: sel;
      }
      .tr > .cname {
        grid-area: name;
      }
      .tr > .cslots {
        grid-area: slots;
      }
      .tr > .cdays {
        grid-area: days;
        display: block;
      }
      .tr > .ccond {
        grid-area: cond;
      }
      .tr > .cnext {
        grid-area: next;
        text-align: end;
      }
      .tr > .ctog {
        grid-area: tog;
      }
      .tr > .cops {
        display: none;
      }
      .acard {
        padding: 14px 16px 12px;
        border-radius: var(--sw-r-2xl);
      }
      .bulk {
        inset-block-end: calc(var(--sw-bottomnav-h) + 10px);
      }
    }
  `];

  // ---------------------------------------------------------------------------- lifecycle

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.phoneMq.addEventListener('change', this.onPhone);
    this.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('pointerdown', this.onOutside, true);
    window.addEventListener('keydown', this.onKey);
    // the trash is in the user menu, as on the automations screen (screen-edit.ts)
    this.offEdit = registerScreenEdit({ id: 'schedules-trash', label: 'סל מחזור', icon: 'trash', can: () => screenState(this.status).kind === 'ready' && this.sub !== 'trash', run: () => this.go('trash') });
    const stored = readStored<Partial<ListFilters>>(FILTERS_KEY);
    const storedView = parseView(store()?.getItem(VIEW_KEY) ?? null);
    const params = parseRoute().params;
    // the address carries the state (a link keeps it); without one, this browser's last choice
    this.filters = params.toString() ? parseFilters(params) : stored ? parseFilters(filtersToParams({ ...NO_FILTERS, ...stored })) : { ...NO_FILTERS };
    this.view = parseView(params.get('view')) ?? storedView ?? 'cards';
    this.filtersOpen = extraFilterCount(this.filters) > 0;
    this.offRoute = onRouteChange((r) => this.onRoute(r));
    void this.load();
    void this.loadSegments();
    this.stopWs = subscribeSchedules(() => void this.refresh());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.phoneMq.removeEventListener('change', this.onPhone);
    this.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('pointerdown', this.onOutside, true);
    window.removeEventListener('keydown', this.onKey);
    this.offRoute?.();
    this.offEdit?.();
    this.stopWs?.();
    window.clearTimeout(this.urlTimer);
    window.clearTimeout(this.noteTimer);
  }

  protected updated(_c: PropertyValues) {
    measureHeaderBar(this.renderRoot, this.phone);
    const t = this.renderRoot.querySelector<HTMLElement>('.toast[popover]');
    if (t) {
      try {
        if (!t.matches(':popover-open')) t.showPopover();
      } catch {
        /* no popover support: the note stays in the page */
      }
    }
  }

  private onScroll = () => {
    const compact = this.scrollTop > 40;
    if (compact !== this.compactHeader) this.compactHeader = compact;
  };

  private onOutside = (e: PointerEvent) => {
    if (!this.menuFor) return;
    const card = this.renderRoot.querySelector(`[data-schedule="${CSS.escape(this.menuFor)}"]`);
    if (!card || !e.composedPath().includes(card)) this.menuFor = '';
  };

  private onKey = (e: KeyboardEvent) => {
    if (this.menuFor && e.key === 'Escape') this.menuFor = '';
  };

  /** The other segments of "קברניט": which kinds the automations screen offers this caller, with their counts (best effort: no answer = only "אוטומציות"). */
  private async loadSegments() {
    if (!this.kavarnit.automations) return;
    try {
      await autoReady();
      const st = await autoApi().status();
      if (st.available === 'feature_disabled') return;
      this.autoKinds = visibleKinds(st);
      this.autoCounts = { automation: st.counts.automations, script: st.counts.scripts, scene: st.counts.scenes };
    } catch {
      this.autoKinds = null;
    }
  }

  // ---------------------------------------------------------------------------- routing

  private onRoute(r: RouteState) {
    if (r.segments[0] !== 'devices' || r.segments[1] !== 'schedules') return;
    const raw = r.segments[2] ?? '';
    const sub = raw === 'new' ? '' : decodeURIComponent(raw);
    const incoming = r.params.toString();
    if (incoming !== this.lastWritten && (incoming || this.lastWritten)) {
      this.filters = parseFilters(r.params);
      this.view = parseView(r.params.get('view')) ?? this.view;
      this.lastWritten = incoming;
    }
    if (sub !== this.sub) {
      this.sub = sub;
      this.menuFor = '';
      void this.onSub();
    }
  }

  private path(sub: string): string {
    return sub ? `${BASE}/${encodeURIComponent(sub)}` : BASE;
  }

  private params(): URLSearchParams {
    return filtersToParams(this.filters, this.view);
  }

  /** Change the sub-route (the drawer, the trash, the review, or back to the list): a history entry. */
  private go(sub: string) {
    const p = this.params();
    this.lastWritten = p.toString();
    pushRoute(this.path(sub), p);
  }

  /** The filters into the address, without a history entry (and after a short pause while typing). */
  private syncUrl(delay = 0) {
    window.clearTimeout(this.urlTimer);
    this.urlTimer = window.setTimeout(() => {
      const p = this.params();
      this.lastWritten = p.toString();
      replaceRoute(this.path(this.sub), p);
      writeStored(FILTERS_KEY, this.filters);
    }, delay);
  }

  private href(id: string): string {
    const q = this.params().toString();
    return `#${this.path(id)}${q ? `?${q}` : ''}`;
  }

  private async onSub() {
    const sub = this.sub;
    this.subError = '';
    if (sub === 'trash') return void this.loadTrash();
    if (sub === 'review') return void this.loadReview();
    if (!sub) {
      this.detail = null;
      this.detailMissing = false;
      return;
    }
    this.drawerUsed = true;
    this.detailMissing = false;
    this.detail = this.items?.find((s) => s.id === sub) ?? null;
    try {
      const fresh = await getSchedule(sub);
      if (this.sub === sub) this.detail = fresh;
    } catch (err) {
      if (this.sub === sub && err instanceof ApiError && err.status === 404) {
        this.detail = null;
        this.detailMissing = true;
      }
    }
  }

  // ---------------------------------------------------------------------------- data

  private demoLoading(): boolean {
    return !isApi() && parseRoute().params.get('state') === 'loading';
  }

  private async load() {
    if (this.demoLoading()) return;
    try {
      this.status = await getScheduleStatus();
    } catch (err) {
      // /schedules/status answers only holders of schedule.view: a refusal is "no permission", not a failure
      if (err instanceof ApiError && err.status === 403) this.noView = true;
      else this.failed = scheduleErrorText(err);
      return;
    }
    if (screenState(this.status).kind !== 'ready') {
      this.items = [];
      return;
    }
    await this.loadList();
    if (this.sub) void this.onSub();
  }

  private async loadList() {
    try {
      const r = await listSchedules({ limit: 500 });
      this.items = r.items;
      this.failed = '';
      this.selected = new Set([...this.selected].filter((id) => r.items.some((s) => s.id === id)));
    } catch (err) {
      if (this.items === null) this.failed = scheduleErrorText(err);
    }
  }

  /** The server says something changed (or a write finished): status, list and whatever is open, again. */
  private async refresh() {
    try {
      this.status = await getScheduleStatus();
    } catch {
      /* keep the last answer; the list below reports its own failure */
    }
    if (screenState(this.status).kind === 'ready') await this.loadList();
    if (this.sub === 'trash') await this.loadTrash();
    else if (this.sub === 'review') await this.loadReview();
    else if (this.sub) {
      try {
        this.detail = await getSchedule(this.sub);
      } catch {
        /* the detail keeps its last copy */
      }
    }
  }

  private async loadTrash() {
    try {
      this.trash = (await listTrash()).items;
      this.subError = '';
    } catch (err) {
      this.subError = scheduleErrorText(err);
    }
  }

  private async loadReview() {
    try {
      this.review = (await getScheduleReview()).items;
      this.subError = '';
    } catch (err) {
      this.subError = scheduleErrorText(err);
    }
  }

  // ---------------------------------------------------------------------------- feedback

  private say(text: string, tone: Note['tone'] = 'ok', action?: Note['action']) {
    window.clearTimeout(this.noteTimer);
    this.note = { text, tone, action };
    this.noteTimer = window.setTimeout(() => (this.note = null), action ? 10000 : 4000);
  }

  private get actionsHost(): ScheduleActions | null {
    return this.renderRoot.querySelector('schedule-actions');
  }

  // ---------------------------------------------------------------------------- events from the actions host and the drawer

  private onChanged = (e: CustomEvent<{ schedule: Schedule | null }>) => {
    const s = e.detail?.schedule;
    if (s) {
      this.items = (this.items ?? []).map((x) => (x.id === s.id ? { ...s, raw: undefined } : x));
      if (this.detail?.id === s.id) this.detail = s;
      void this.refreshStatusOnly();
    } else void this.refresh();
  };

  private async refreshStatusOnly() {
    try {
      this.status = await getScheduleStatus();
    } catch {
      /* keep */
    }
  }

  private onDeleted = (e: CustomEvent<{ trashId: string; name: string; scheduleId: string }>) => {
    const { trashId, name, scheduleId } = e.detail;
    this.items = (this.items ?? []).filter((s) => s.id !== scheduleId);
    if (this.sub === scheduleId) this.go('');
    void this.refreshStatusOnly();
    this.say(`"${name}" נמחק`, 'ok', { label: 'שחזור', run: () => void this.restore(trashId) });
  };

  private onCopied = (e: CustomEvent<{ schedule: Schedule }>) => {
    void this.refresh();
    this.go(e.detail.schedule.id);
  };

  private onResult = (e: CustomEvent<{ text: string; tone: 'ok' | 'error' }>) => {
    this.say(e.detail.text, e.detail.tone);
  };

  private async restore(trashId: string, item?: TrashItem) {
    try {
      const r = await restoreFromTrash(trashId);
      this.say(`"${r.schedule.display_name}" שוחזר`, 'ok', { label: 'פתיחה', run: () => this.go(r.schedule.id) });
      await this.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'lowering_confirmation_required' && item) {
        this.trashLowering = item;
        return;
      }
      this.say(scheduleErrorText(err), 'error');
      await this.refresh();
    }
  }

  /** A trashed schedule that opens or disarms something: confirmed through S4's dialog before it is re-created (§3.13). */
  @state() private trashLowering: TrashItem | null = null;

  private async confirmTrashLowering(e: CustomEvent<{ alarm_code: string | null }>) {
    const item = this.trashLowering;
    if (!item) return;
    e.stopPropagation();
    try {
      const r = await restoreFromTrash(item.trash_id, { confirm_lowering: true, alarm_code: e.detail?.alarm_code ?? null });
      this.trashLowering = null;
      this.say(`"${r.schedule.display_name}" שוחזר`, 'ok', { label: 'פתיחה', run: () => this.go(r.schedule.id) });
      await this.refresh();
    } catch (err) {
      this.trashLowering = null;
      this.say(scheduleErrorText(err), 'error');
    }
  }

  // ---------------------------------------------------------------------------- actions

  private setFilter(patch: Partial<ListFilters>, delay = 0) {
    this.filters = { ...this.filters, ...patch };
    this.syncUrl(delay);
  }

  private clearFilters() {
    this.filters = { ...NO_FILTERS, sort: this.filters.sort, group: this.filters.group };
    this.syncUrl();
  }

  private setView(v: ListView) {
    this.view = v;
    writeStored(VIEW_KEY, v);
    this.syncUrl();
  }

  private newSchedule() {
    if (customElements.get('schedule-create-dialog')) this.createOpen = true;
    else navigate(`${BASE}/new/edit`);
  }

  private toggleSel(id: string, on: boolean) {
    const next = new Set(this.selected);
    if (on) next.add(id);
    else next.delete(id);
    this.selected = next;
  }

  private async bulk(op: 'enable' | 'disable') {
    const picked = (this.items ?? []).filter((s) => this.selected.has(s.id));
    const eligible = togglable(picked).filter((s) => (op === 'disable' ? s.enabled : !s.enabled)).filter((s) => op === 'disable' || !s.lowering);
    const skippedLowering = op === 'enable' ? picked.filter((s) => s.lowering && !s.enabled).length : 0;
    if (!eligible.length) {
      this.say(skippedLowering ? 'תזמונים שפותחים או מנטרלים מופעלים אחד־אחד' : 'אין בבחירה תזמונים לשינוי', 'error');
      return;
    }
    this.busy = true;
    try {
      const r = await bulkSchedules(op, eligible.map((s) => s.id));
      const ok = r.results.filter((x) => x.ok).length;
      const bad = r.results.length - ok;
      const verb = op === 'enable' ? 'הופעלו' : 'הושבתו';
      this.say(bad ? `${verb} ${ok}; ${bad} לא שונו` : `${verb} ${ok}${skippedLowering ? `; ${skippedLowering} מופעלים אחד־אחד` : ''}`, bad ? 'error' : 'ok');
      this.selected = new Set();
    } catch (err) {
      this.say(scheduleErrorText(err), 'error');
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  /** Acknowledge (or restore) one review warning: a system administrator's decision, bound by the server to the schedule's content. */
  private async ack(scheduleId: string, issue: AckableIssue, undo: boolean) {
    this.busy = true;
    try {
      await acknowledgeScheduleIssue(scheduleId, issue, undo);
      this.say(undo ? 'האזהרה הוחזרה' : 'סומן כתקין');
    } catch (err) {
      this.say(scheduleErrorText(err), 'error');
    } finally {
      this.busy = false;
      await this.loadReview();
      await this.refresh();
    }
  }

  private async bulkReview() {
    const picked = (this.review ?? []).map((r) => r.schedule).filter((s) => this.reviewSel.has(s.id) && s.enabled && s.can.toggle);
    if (!picked.length) return;
    this.busy = true;
    try {
      const r = await bulkSchedules('disable', picked.map((s) => s.id));
      const ok = r.results.filter((x) => x.ok).length;
      this.say(`הושבתו ${ok}`, ok === r.results.length ? 'ok' : 'error');
      this.reviewSel = new Set();
    } catch (err) {
      this.say(scheduleErrorText(err), 'error');
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  @state() private purging: TrashItem | null = null;

  private async doPurge() {
    const item = this.purging;
    if (!item) return;
    try {
      await purgeTrash(item.trash_id);
      this.purging = null;
      this.say(`"${item.name || 'תזמון ללא שם'}" נמחק לצמיתות`);
    } catch (err) {
      this.purging = null;
      this.say(scheduleErrorText(err), 'error');
    }
    await this.loadTrash();
  }

  private toggle(s: Schedule, on: boolean) {
    void this.actionsHost?.enable(s, on);
  }

  private menuAct(s: Schedule, action: 'run' | 'edit' | 'copy' | 'delete') {
    this.menuFor = '';
    if (action === 'run') this.actionsHost?.run(s);
    else if (action === 'edit') navigate(`${BASE}/${s.id}/edit`);
    else if (action === 'copy') this.actionsHost?.copy(s);
    else this.actionsHost?.askDelete(s);
  }

  // ---------------------------------------------------------------------------- render: the header (media-page.ts, as on the automations screen)

  private header(scr: ReturnType<typeof screenState>): TemplateResult {
    const sub = this.sub;
    if (sub === 'trash' || sub === 'review') {
      return html`<header class=${`dh${this.compactHeader ? ' compact' : ''}`} data-sched-header>
        <div class="dh-row">
          <h1 data-sched-title style="display:flex;align-items:center;gap:12px"><a class="rb" href=${`#${BASE}`} aria-label="חזרה לתזמונים" data-back @click=${(e: Event) => { e.preventDefault(); this.go(''); }}>${aIcon('chevron')}</a>${sub === 'trash' ? 'סל מחזור' : 'תזמונים לבדיקה'}</h1>
          <span class="grow"></span>
        </div>
      </header>`;
    }
    const all = this.items ?? [];
    const floors = placeOptions(all, 'floor');
    const f = this.filters;
    const tools = scr.kind === 'ready' && this.items !== null;
    const manage = !!this.status?.can.manage;
    const extra = extraFilterCount(f);
    const sc = stateCounts(all);
    return html`<header class=${`dh${this.compactHeader ? ' compact' : ''}`} data-sched-header>
      <div class="dh-row">
        <h1 data-sched-title>תזמונים</h1>
        ${tools && floors.length ? html`<div class="rooms" role="group" aria-label="קומות">
          <button type="button" class="rc" aria-pressed=${String(!f.floor)} data-floor="" @click=${() => this.setFilter({ floor: '' })}>הכל</button>
          ${floors.map((x) => html`<button type="button" class="rc" aria-pressed=${String(f.floor === x.value)} data-floor=${x.value} @click=${() => this.setFilter({ floor: x.value })}>${bidi(x.label)}</button>`)}
        </div>` : html`<span class="grow"></span>`}
        ${tools && all.length && !this.phone ? html`<div class="vwrap">${this.viewSwitch()}</div>` : nothing}
      </div>
      ${tools ? html`<div class="dh-det" data-sched-toolbar>
        ${this.renderSegments()}
        ${all.length ? html`<div class="seg sm stf" role="radiogroup" aria-label="סינון לפי מצב" ?data-open=${this.filtersOpen}>${STATE_SEGMENTS.map((s) => html`<button type="button" role="radio" aria-checked=${String(f.state === s.id)} data-state-filter=${s.id || 'all'} @click=${() => this.setFilter({ state: s.id as StateFilter })}>${s.label}<small>${sc[s.id]}</small></button>`)}</div>` : nothing}
        ${all.length ? html`<button type="button" class="btn foldbtn" data-filters-toggle aria-expanded=${String(this.filtersOpen)} @click=${() => (this.filtersOpen = !this.filtersOpen)}>${aIcon('filter')}<span class="lbl">סינון</span>${extra ? html`<small>${extra}</small>` : nothing}</button>` : nothing}
        <span class="grow"></span>
        ${all.length && this.phone ? html`<div class="vwrap">${this.viewSwitch()}</div>` : nothing}
        ${all.length ? html`<label class="search">${aIcon('search')}<span class="sr-only">חיפוש</span><input type="search" data-filter="q" placeholder=${this.phone ? 'חיפוש' : 'חיפוש תזמון, התקן או תג'} .value=${live(f.q)} @input=${(e: Event) => this.setFilter({ q: (e.target as HTMLInputElement).value }, 250)} /></label>` : nothing}
        ${manage ? html`<button type="button" class="btn primary newbtn" data-new-schedule ?disabled=${scr.readOnly} title=${scr.readOnly ? scr.readOnlyText : ''} @click=${() => this.newSchedule()}>${aIcon('plus')}<span class="lbl">חדש</span></button>` : nothing}
        ${all.length && this.filtersOpen ? this.renderMoreFilters(all) : nothing}
      </div>` : nothing}
    </header>`;
  }

  /** Cards · table · week: the view switch sits where the media pages keep their floor menu (the end of the title row). */
  private viewSwitch(): TemplateResult {
    return html`<div class="seg sm views" role="group" aria-label="תצוגה">${(['cards', 'table', 'week'] as ListView[]).map((v) => html`<button type="button" data-view-btn=${v} aria-pressed=${String(this.view === v)} aria-label=${VIEW_LABEL[v]} title=${VIEW_LABEL[v]} @click=${() => this.setView(v)}>${aIcon(VIEW_ICON[v])}</button>`)}</div>`;
  }

  /** The strip of "קברניט": תזמונים (this screen) first, then the automations screen's segments. Shown only when there is a second segment to go to. */
  private renderSegments() {
    const others = this.kavarnit.automations ? SEGMENTS.filter((s) => (this.autoKinds ? this.autoKinds.includes(s.kind) : s.id === 'automations')) : [];
    if (!others.length) return nothing;
    const n = this.status?.counts.visible;
    return html`<div class="seg kinds" role="tablist" aria-label="קברניט" data-kavarnit-segments>
      <button type="button" role="tab" aria-selected="true" data-segment="schedules">תזמונים${n === undefined ? nothing : html` <small>${n}</small>`}</button>
      ${others.map((s) => html`<button type="button" role="tab" aria-selected="false" data-segment=${s.id} @click=${() => navigate(itemPath(s.id))}>${s.label}${this.autoCounts ? html` <small>${this.autoCounts[s.kind]}</small>` : nothing}</button>`)}
    </div>`;
  }

  private dd(attr: string, label: string, value: string, items: DropdownItem[], on: (v: string) => void): TemplateResult {
    return html`<sw-dropdown data-filter=${attr} .label=${label} .placeholder=${label} .value=${value} .items=${items} @change=${(e: CustomEvent<{ id: string }>) => on(e.detail.id)}></sw-dropdown>`;
  }

  /** "סינון": the area, the days, the conditions, the tags, grouping and sorting (chips and dropdown chips, never a paragraph). */
  private renderMoreFilters(items: Schedule[]): TemplateResult {
    const f = this.filters;
    const areas = placeOptions(items, 'area');
    const tags = tagOptions(items);
    const conds = conditionOptions(items);
    const sensor = this.status?.settings.shabbat_sensor ?? null;
    const anyPreset = items.some((s) => s.conditions.preset);
    const anyCond = items.some((s) => s.conditions.items.length);
    const opts = (all: string, list: { value: string; label: string }[]): DropdownItem[] => [{ id: '', label: all }, ...list.map((o) => ({ id: o.value, label: o.label }))];
    return html`<div class="more" data-sched-filters>
      ${areas.length > 1 ? this.dd('area', 'כל האזורים', f.area, opts('כל האזורים', areas), (v) => this.setFilter({ area: v })) : nothing}
      <span class="days" role="group" aria-label="ימים">${DAY_ORDER.map((d) => html`<button type="button" class="rc day" data-day-filter=${d} aria-pressed=${String(f.day === d)} aria-label=${`יום ${DAY_SHORT[d]}`} @click=${() => this.setFilter({ day: f.day === d ? '' : (d as DayId) })}>${DAY_SHORT[d]}</button>`)}</span>
      ${sensor || anyPreset ? html`<button type="button" class="rc" data-chip-preset="only_holy_days" aria-pressed=${String(f.preset === 'only_holy_days')} @click=${() => this.setFilter({ preset: f.preset === 'only_holy_days' ? '' : 'only_holy_days' })}>רק בשבת ובחג</button><button type="button" class="rc" data-chip-preset="not_holy_days" aria-pressed=${String(f.preset === 'not_holy_days')} @click=${() => this.setFilter({ preset: f.preset === 'not_holy_days' ? '' : 'not_holy_days' })}>לא בשבת ובחג</button>` : nothing}
      ${anyCond ? html`<button type="button" class="rc" data-chip-has-cond aria-pressed=${String(f.hasConditions)} @click=${() => this.setFilter({ hasConditions: !f.hasConditions })}>עם תנאי</button>` : nothing}
      ${conds.length > 1 ? this.dd('condition', 'כל התנאים', f.condition, opts('כל התנאים', conds), (v) => this.setFilter({ condition: v })) : nothing}
      ${tags.length ? html`<span class="sep" aria-hidden="true"></span>${tags.map((t) => html`<button type="button" class="rc" data-chip-tag=${t.value} aria-pressed=${String(f.tag === t.value)} @click=${() => this.setFilter({ tag: f.tag === t.value ? '' : t.value })}>${bidi(t.label)}</button>`)}` : nothing}
      <span class="sep" aria-hidden="true"></span>
      ${this.dd('group', 'ללא קיבוץ', f.group, [{ id: '', label: 'ללא קיבוץ' }, { id: 'area', label: 'לפי אזור' }, { id: 'floor', label: 'לפי קומה' }, { id: 'tag', label: 'לפי תג' }, { id: 'state', label: 'לפי מצב' }], (v) => this.setFilter({ group: v as ListGroup }))}
      ${this.dd('sort', 'מיון: הרצה הבאה', f.sort, [{ id: 'next_run', label: 'מיון: הרצה הבאה' }, { id: 'name', label: 'מיון: שם' }, { id: 'order', label: 'מיון: סדר ידני' }, { id: 'updated', label: 'מיון: עודכן לאחרונה' }], (v) => this.setFilter({ sort: (v || 'next_run') as ListSort }))}
      ${activeFilterCount(f) ? html`<button type="button" class="btn sm quiet" data-clear-filters @click=${() => this.clearFilters()}>נקה סינון</button>` : nothing}
    </div>`;
  }

  // ---------------------------------------------------------------------------- render: states, banners

  private skeleton(): TemplateResult {
    const card = html`<div class="glass" style="padding:18px;display:flex;flex-direction:column;gap:12px;border-radius:24px"><span class="skl" style="block-size:20px;inline-size:55%"></span><span class="skl" style="block-size:13px;inline-size:35%"></span><span class="skl" style="block-size:28px"></span><span class="skl" style="block-size:14px;inline-size:60%"></span></div>`;
    return html`<div data-sched-state="loading" aria-busy="true"><div class="cgrid">${Array.from({ length: this.phone ? 3 : 6 }, () => card)}</div></div>`;
  }

  private stateBox(icon: AutomationIconName, title: string, kind: string, action?: TemplateResult): TemplateResult {
    return html`<div class="statebox glass" role="status" data-sched-state=${kind}><span class="ring">${aIcon(icon)}</span><b>${title}</b>${action ?? nothing}</div>`;
  }

  private bannerRow(st: ReturnType<typeof screenState>): TemplateResult | typeof nothing {
    const attention = st.admin ? this.status?.counts.attention ?? 0 : 0;
    // a viewer sees no banner (the automations screen does the same): the screen simply offers nothing to change
    const blocked = st.readOnly && !!this.status?.can.manage;
    if (!st.stale && !blocked && !attention) return nothing;
    return html`<div class="stack">
      ${st.stale ? html`<div class="banner warn" role="status" data-sched-stale>${aIcon('wifiOff')}<div>${STALE_TEXT}</div><button type="button" class="btn sm" data-banner-retry @click=${() => void this.refresh()}>${aIcon('refresh')}נסו שוב</button></div>` : nothing}
      ${blocked ? html`<div class="banner info" role="status" data-sched-readonly>${aIcon('lock')}<div>${st.readOnlyText}</div></div>` : nothing}
      ${attention ? html`<div class="banner warn" role="status" data-sched-attention>${aIcon('warning')}<div><b>${attention} דורשים בדיקה</b></div><button type="button" class="btn sm" data-open-review @click=${() => this.go('review')}>לבדיקה</button></div>` : nothing}
    </div>`;
  }

  private renderUpcoming(items: Schedule[]): TemplateResult | typeof nothing {
    const ups = upcomingToday(items);
    if (!ups.length) return nothing;
    return html`<div class="upnext glass" data-sched-upnext role="list" aria-label="ההרצות הבאות היום"><b>היום</b>${ups.map((u) => html`<span class="up" role="listitem" data-upcoming=${u.scheduleId}><time class="n">${u.time}</time><span>${bidi(u.name)}</span>${u.conditional ? html`<span class="what">· בתנאי</span>` : nothing}<i style=${`--c:${toneColor(u.tone)}`}></i></span>`)}</div>`;
  }

  // ---------------------------------------------------------------------------- render: the cards

  private stateChip(s: Schedule) {
    if (s.state === 'triggered') return html`<span class="chip ok" data-state-chip="triggered">${STATE_LABEL.triggered}</span>`;
    if (s.state === 'completed') return html`<span class="chip" data-state-chip="completed">הסתיים</span>`;
    if (s.enabled && s.state === 'unavailable') return html`<span class="chip" data-state-chip="unavailable">${STATE_LABEL.unavailable}</span>`;
    return nothing;
  }

  private switchOf(s: Schedule): TemplateResult {
    if (!s.can.toggle) return html`<span class=${`chip ${s.enabled ? 'ok' : ''}`} data-card-state>${s.enabled ? 'פעיל' : 'מושבת'}</span>`;
    return html`<button type="button" class="tog" role="switch" aria-checked=${String(s.enabled)} aria-label=${`${s.enabled ? 'השבתה' : 'הפעלה'} · ${s.display_name}`} data-toggle=${s.id} ?disabled=${this.busy} @click=${() => this.toggle(s, !s.enabled)}></button>`;
  }

  private menu(s: Schedule): TemplateResult {
    const row = (action: 'run' | 'edit' | 'copy' | 'delete', icon: AutomationIconName, label: string, show: boolean, cls = '') =>
      show ? html`<button type="button" role="menuitem" class=${cls} data-card-action=${action} @click=${() => this.menuAct(s, action)}>${aIcon(icon)}${label}</button>` : nothing;
    return html`<div class="pop" role="menu" aria-label=${`פעולות · ${s.display_name}`}>
      ${row('edit', 'edit', 'עריכה', s.can.edit)}
      ${row('run', 'play', 'הרץ עכשיו', s.can.run)}
      ${row('copy', 'copy', 'שכפול', s.can.copy)}
      ${s.can.delete ? html`<hr />` : nothing}
      ${row('delete', 'trash', 'מחיקה', s.can.delete, 'dz')}
    </div>`;
  }

  private renderCard(s: Schedule) {
    const period = periodLabel(s);
    const sun = isApi() ? null : DEMO_SUN;
    const floor = floorOf(s);
    const hasMenu = s.can.edit || s.can.run || s.can.copy || s.can.delete;
    const open = this.menuFor === s.id;
    return html`<article class=${`acard ${s.enabled ? 'on' : 'off'}`} data-schedule=${s.id} data-enabled=${s.enabled} ?data-picked=${this.selected.has(s.id)} ?data-menu=${open} aria-label=${s.display_name}>
      <header>
        <label class="pick" title="בחירה"><input type="checkbox" data-select=${s.id} aria-label=${`בחירת ${s.display_name}`} .checked=${this.selected.has(s.id)} @change=${(e: Event) => this.toggleSel(s.id, (e.target as HTMLInputElement).checked)} /></label>
        <div class="ttl">
          <h3><a class="name" href=${this.href(s.id)} data-card-open>${bidi(s.display_name)}</a></h3>
          <div class="where">${aIcon('layers')}${floor ? html`<b>${bidi(floor)}</b>` : nothing}<span class="ar">${bidi(devicesLine(s))}</span></div>
        </div>
        <div class="ctl">
          ${this.switchOf(s)}
          ${hasMenu ? html`<button type="button" class="more-btn" aria-haspopup="menu" aria-expanded=${String(open)} aria-label=${`עוד · ${s.display_name}`} data-card-menu @click=${() => (this.menuFor = open ? '' : s.id)}>${aIcon('dots')}</button>` : nothing}
        </div>
        ${open ? this.menu(s) : nothing}
      </header>
      <div class="bar"><sw-schedule-bar .slots=${s.slots} .sun=${sun}></sw-schedule-bar></div>
      <div class="meta">
        <sw-day-chips .days=${s.days} compact></sw-day-chips>
        ${period ? html`<span class="chip info" data-period>${aIcon('calendar')}${period}</span>` : nothing}
        <schedule-condition-chip .conditions=${s.conditions}></schedule-condition-chip>
        <sw-schedule-markers .sensitive=${s.sensitive} .lowering=${s.lowering}></sw-schedule-markers>
        ${s.slots.some((sl) => sl.actions.some((a) => a.invalid)) ? html`<span class="chip warn" data-invalid title=${s.slots.flatMap((sl) => sl.actions).find((a) => a.invalid)?.invalid?.message ?? ''}>${aIcon('warning')}פעולה לא תקפה</span>` : nothing}
        ${s.slots.some((sl) => sl.actions.some((a) => a.blocked)) ? html`<span class="chip warn" data-script-blocked title=${s.slots.flatMap((sl) => sl.actions).find((a) => a.blocked)?.blocked?.message ?? ''}>${aIcon('lock')}סקריפט לא מאושר</span>` : nothing}
        ${this.stateChip(s)}
      </div>
      <footer>
        <span class="run" data-card-run><i class=${`dot ${s.enabled && s.next_run ? 'ok' : ''}`}></i>הרצה הבאה <b data-next-run>${nextRunText(s)}</b></span>
      </footer>
    </article>`;
  }

  // ---------------------------------------------------------------------------- render: the table

  private renderRow(s: Schedule) {
    const shown = s.slots.slice(0, 3);
    return html`<div class=${`tr${s.enabled ? '' : ' off'}`} data-schedule=${s.id} data-enabled=${s.enabled} ?data-picked=${this.selected.has(s.id)}>
      <span class="csel"><label class="pick"><input type="checkbox" data-select=${s.id} aria-label=${`בחירת ${s.display_name}`} .checked=${this.selected.has(s.id)} @change=${(e: Event) => this.toggleSel(s.id, (e.target as HTMLInputElement).checked)} /></label></span>
      <span class="cname" style="min-inline-size:0"><a class="name" href=${this.href(s.id)}>${bidi(s.display_name)}</a><div class="sub">${bidi(devicesLine(s))}</div>${s.sensitive || s.lowering ? html`<sw-schedule-markers .sensitive=${s.sensitive} .lowering=${s.lowering}></sw-schedule-markers>` : nothing}</span>
      <span class="cdays"><sw-day-chips .days=${s.days} compact></sw-day-chips></span>
      <span class="cslots slotrows">${shown.map((sl) => html`<span class="sr"><span class="w">${windowText(sl)}</span><span class="a">${slotChips(sl, s).map((c) => html`<span class="ac" style=${`--c:${toneColor(c.tone)}`} title=${c.devices.join(', ')}>${c.label}${c.devices.length > 1 ? ` · ${c.devices.length}` : ''}</span>`)}</span></span>`)}${s.slots.length > shown.length ? html`<button type="button" class="linkbtn" @click=${() => this.go(s.id)}>ועוד ${s.slots.length - shown.length} משבצות</button>` : nothing}</span>
      <span class="ccond"><schedule-condition-chip .conditions=${s.conditions} compact></schedule-condition-chip></span>
      <span class="cnext"><b data-next-run>${nextRunText(s)}</b></span>
      <span class="ctog">${this.switchOf(s)}</span>
      <span class="cops ops">${s.can.run ? html`<button type="button" class="rb sm" aria-label=${`הרץ עכשיו · ${s.display_name}`} title="הרץ עכשיו" data-run=${s.id} @click=${() => this.actionsHost?.run(s)}>${aIcon('play')}</button>` : nothing}${s.can.edit ? html`<button type="button" class="rb sm" aria-label=${`עריכה · ${s.display_name}`} title="עריכה" data-edit=${s.id} @click=${() => navigate(`${BASE}/${s.id}/edit`)}>${aIcon('edit')}</button>` : nothing}</span>
    </div>`;
  }

  private renderTable(rows: Schedule[]) {
    const all = rows.length > 0 && rows.every((s) => this.selected.has(s.id));
    return html`<div class="tbl glass" data-sched-table>
      <div class="tr h"><span><label class="pick"><input type="checkbox" aria-label="בחירת הכול" data-select-all .checked=${all} @change=${(e: Event) => (this.selected = (e.target as HTMLInputElement).checked ? new Set([...this.selected, ...rows.map((s) => s.id)]) : new Set([...this.selected].filter((id) => !rows.some((s) => s.id === id))))} /></label></span><span>שם</span><span class="cdays">ימים</span><span>משעה · פעולה</span><span>תנאי</span><span>הרצה הבאה</span><span>פעיל</span><span></span></div>
      ${repeat(rows, (s) => s.id, (s) => this.renderRow(s))}
    </div>`;
  }

  private renderList(rows: Schedule[]) {
    if (this.view === 'week') {
      return html`<schedules-week-view .schedules=${rows} .sun=${isApi() ? null : DEMO_SUN} .snap=${this.status?.settings.snap_minutes ?? 15} @open-schedule=${(e: CustomEvent<{ id: string }>) => this.go(e.detail.id)}></schedules-week-view>`;
    }
    const groups = groupSchedules(sortSchedules(rows, this.filters.sort), this.filters.group);
    const body = (items: Schedule[]) => (this.view === 'table' ? this.renderTable(items) : html`<div class="cgrid" data-sched-grid>${repeat(items, (s) => s.id, (s) => this.renderCard(s))}</div>`);
    if (!this.filters.group) return html`<div class="groups"><section class="fsec group" data-group="">${body(groups[0].items)}</section></div>`;
    return html`<div class="groups">${groups.map((g) => html`<section class="fsec group" data-group=${g.key}><header class="sh"><h2>${bidi(g.label)}</h2></header>${body(g.items)}</section>`)}</div>`;
  }

  private renderBulk() {
    const n = this.selected.size;
    if (!n || this.view === 'week') return nothing;
    const can = !!this.status?.can.manage && !!this.status?.writable;
    return html`<div class="editbar bulk" role="region" aria-label="פעולות על הבחירה" data-bulk-bar>
      <span class="t">${aIcon('check')}${n} נבחרו</span>
      <span class="grow"></span>
      ${can ? html`<button type="button" class="btn sm" data-bulk-enable ?disabled=${this.busy} @click=${() => void this.bulk('enable')}>${aIcon('play')}הפעלה</button><button type="button" class="btn sm" data-bulk-disable ?disabled=${this.busy} @click=${() => void this.bulk('disable')}>${aIcon('stop')}השבתה</button>` : nothing}
      <button type="button" class="btn sm quiet" data-bulk-clear @click=${() => (this.selected = new Set())}>ביטול בחירה</button>
    </div>`;
  }

  // ---------------------------------------------------------------------------- render: the sub-views

  private renderTrash() {
    if (this.subError) return this.stateBox('warning', this.subError, 'error', html`<button type="button" class="btn sm" data-sched-retry @click=${() => void this.loadTrash()}>${aIcon('refresh')}נסו שוב</button>`);
    if (this.trash === null) return this.skeleton();
    if (!this.trash.length) return this.stateBox('trash', 'סל המחזור ריק', 'trash-empty');
    const canPurge = !!this.status?.can.configure && !!this.status?.can.manage;
    return html`<div class="rows" data-sched-trash>${this.trash.map(
      (t) => html`<div class="li glass" data-trash-item=${t.trash_id}>
        <div><div class="t">${bidi(t.name || 'תזמון ללא שם')}</div><div class="d">${t.entities.map((e) => e.name).join(' · ')}</div><div class="d">${deletedText(t.deleted_at)}${t.deleted_by ? ` · ${t.deleted_by.display_name}` : ''} · ${keptText(t.expires_at)}</div></div>
        <div class="lops">${t.sensitive ? html`<sw-schedule-markers .sensitive=${true}></sw-schedule-markers>` : nothing}
          <button type="button" class="btn sm primary" data-restore=${t.trash_id} ?disabled=${!t.can_restore} title=${t.can_restore ? '' : 'אין הרשאה לשחזר תזמון זה'} @click=${() => void this.restore(t.trash_id, t)}>${aIcon('restore')}שחזור</button>
          ${canPurge ? html`<button type="button" class="rb sm" aria-label="מחיקה לצמיתות" title="מחיקה לצמיתות" data-purge=${t.trash_id} @click=${() => (this.purging = t)}>${aIcon('trash')}</button>` : nothing}</div>
      </div>`,
    )}</div>`;
  }

  private renderReview() {
    if (this.subError) return this.stateBox('warning', this.subError, 'error', html`<button type="button" class="btn sm" data-sched-retry @click=${() => void this.loadReview()}>${aIcon('refresh')}נסו שוב</button>`);
    if (this.review === null) return this.skeleton();
    if (!this.review.length) return this.stateBox('check', 'אין תזמונים הדורשים בדיקה', 'review-empty');
    const n = this.reviewSel.size;
    const canAck = !!this.status?.can.acknowledge;
    return html`<div class="rows" data-sched-review>${this.review.map(
      (r) => html`<div class="li glass" data-review-item=${r.schedule.id}>
        <div style="display:flex;gap:10px;align-items:flex-start;min-inline-size:0">
          <label class="pick"><input type="checkbox" data-review-select=${r.schedule.id} aria-label=${`בחירת ${r.schedule.display_name}`} ?disabled=${!r.schedule.enabled || !r.schedule.can.toggle} .checked=${this.reviewSel.has(r.schedule.id)} @change=${(e: Event) => { const next = new Set(this.reviewSel); if ((e.target as HTMLInputElement).checked) next.add(r.schedule.id); else next.delete(r.schedule.id); this.reviewSel = next; }} /></label>
          <div style="min-inline-size:0"><div class="t"><a class="name" href=${this.href(r.schedule.id)}>${bidi(r.schedule.display_name)}</a></div><div class="d">${devicesLine(r.schedule)}${r.schedule.owner ? ` · ${r.schedule.owner.display_name}` : ''}</div>
          <div class="issues">${r.issues.map((i) => {
            const ackable = canAck && (ACKABLE_ISSUES as string[]).includes(i);
            return html`<span class="iss"><span class="chip warn" data-issue=${i}>${REVIEW_LABEL[i]}</span>${ackable ? html`<button type="button" class="linkbtn" data-ack=${i} ?disabled=${this.busy} @click=${() => void this.ack(r.schedule.id, i as AckableIssue, false)}>אשר כתקין</button>` : nothing}</span>`;
          })}${(r.acknowledged ?? []).map((a) => html`<span class="iss"><span class="chip acked" data-acked=${a.issue} title=${`${REVIEW_LABEL[a.issue]} · אושר${a.by?.display_name ? ` על ידי ${a.by.display_name}` : ''}`}>${aIcon('check')}אושר</span>${canAck ? html`<button type="button" class="linkbtn" data-unack=${a.issue} ?disabled=${this.busy} @click=${() => void this.ack(r.schedule.id, a.issue, true)}>בטל אישור</button>` : nothing}</span>`)}</div></div>
        </div>
        <div class="lops"><span class=${r.schedule.enabled ? 'chip ok' : 'chip'}>${r.schedule.enabled ? 'פעיל' : 'מושבת'}</span></div>
      </div>`,
    )}</div>
    ${n ? html`<div class="editbar bulk" data-bulk-bar="review"><span class="t">${aIcon('check')}${n} נבחרו</span><span class="grow"></span><button type="button" class="btn sm" data-review-disable ?disabled=${this.busy} @click=${() => void this.bulkReview()}>${aIcon('stop')}השבתת הנבחרים</button></div>` : nothing}`;
  }

  // ---------------------------------------------------------------------------- render

  private renderReady(st: ReturnType<typeof screenState>) {
    const all = this.items ?? [];
    const rows = filterSchedules(all, this.filters);
    const manage = !!this.status?.can.manage;
    let content: TemplateResult;
    if (!all.length) {
      content = this.stateBox('calendar', 'אין עדיין תזמונים', 'empty', manage && !st.readOnly ? html`<button type="button" class="btn primary" data-new-schedule @click=${() => this.newSchedule()}>${aIcon('plus')}תזמון חדש</button>` : undefined);
    } else if (!rows.length) {
      content = this.stateBox('search', 'לא נמצאו תזמונים', 'no-match', html`<button type="button" class="btn sm" data-clear-filters @click=${() => this.clearFilters()}>נקה סינון</button>`);
    } else {
      content = html`${this.view !== 'week' ? this.renderUpcoming(all) : nothing}${this.renderList(rows)}`;
    }
    return html`${this.bannerRow(st)}${content}${this.renderBulk()}`;
  }

  private renderBody(st: ReturnType<typeof screenState>) {
    const settings = st.admin ? html`<button type="button" class="btn sm" data-open-settings @click=${() => navigate('/system/schedules')}>${aIcon('settings')}הגדרות התזמונים</button>` : undefined;
    switch (st.kind) {
      case 'loading':
        return this.skeleton();
      case 'error':
        return this.stateBox('warning', 'לא ניתן לטעון את הרשימה', 'error', html`<button type="button" class="btn sm" data-sched-retry @click=${() => { this.failed = ''; this.items = null; void this.load(); }}>${aIcon('refresh')}נסו שוב</button>`);
      case 'no_view':
        return this.stateBox('lock', 'אין הרשאה לצפות בתזמונים', 'no_permission');
      case 'feature_disabled':
        return this.stateBox('settings', 'התזמונים כבויים', 'feature_disabled', settings);
      case 'missing':
        return st.admin ? this.stateBox('settings', 'רכיב התזמונים אינו מחובר', 'missing_admin', settings) : this.stateBox('calendar', 'אין תזמונים להצגה', 'missing');
      default:
        return this.sub === 'trash' ? this.renderTrash() : this.sub === 'review' ? this.renderReview() : this.renderReady(st);
    }
  }

  render() {
    const st = this.noView && !this.status ? { ...screenState(null), kind: 'no_view' as const } : screenState(this.status, !!this.failed && !this.status);
    const listFailed = st.kind === 'ready' && this.items === null && !!this.failed;
    const scr = listFailed ? { ...st, kind: 'error' as const } : st.kind === 'ready' && this.items === null ? { ...st, kind: 'loading' as const } : st;
    const sub = this.sub;
    const drawerId = sub && sub !== 'trash' && sub !== 'review' ? sub : '';
    return html`<div class="page" data-screen="devices-schedules" data-sched-screen=${scr.kind}>
        ${this.header(scr)}
        ${this.renderBody(scr)}
      </div>
      ${scr.kind === 'ready' && this.drawerUsed
        ? html`<schedule-drawer ?open=${!!drawerId} .schedule=${this.detail} .status=${this.status} ?missing=${this.detailMissing} @drawer-close=${() => this.go('')} @edit=${(e: CustomEvent<{ id: string }>) => navigate(`${BASE}/${e.detail.id}/edit`)} @changed=${this.onChanged} @deleted=${this.onDeleted} @copied=${this.onCopied}></schedule-drawer>`
        : nothing}
      ${scr.kind === 'ready' && this.createOpen
        ? html`<schedule-create-dialog .open=${true} @close=${() => (this.createOpen = false)} @created=${(e: CustomEvent<{ id: string }>) => { this.createOpen = false; void this.refresh(); this.go(e.detail.id); }}></schedule-create-dialog>`
        : nothing}
      ${this.trashLowering
        ? html`<schedule-lowering-dialog .open=${true} .summary=${{ entities: this.trashLowering.entities.filter((e) => e.sensitive).map((e) => e.name), times: [], text: `השחזור יחזיר תזמון שפותח או מנטרל ${this.trashLowering.entities.filter((e) => e.sensitive).map((e) => e.name).join(', ')} גם כשאיש אינו נמצא במקום.` }} .needsCode=${false} @confirm=${(e: CustomEvent<{ alarm_code: string | null }>) => void this.confirmTrashLowering(e)} @close=${() => (this.trashLowering = null)}></schedule-lowering-dialog>`
        : nothing}
      ${this.purging
        ? html`<sw-dialog open heading=${`למחוק לצמיתות את "${this.purging.name || 'תזמון ללא שם'}"?`} data-dialog="purge" @close=${() => (this.purging = null)}><div class="dlgform"><p>אי אפשר יהיה לשחזר אותו.</p><div class="dlgrow"><button type="button" class="btn" @click=${() => (this.purging = null)}>ביטול</button><button type="button" class="btn danger" data-purge-confirm @click=${() => void this.doPurge()}>מחיקה</button></div></div></sw-dialog>`
        : nothing}
      <schedule-actions .status=${this.status} @changed=${this.onChanged} @deleted=${this.onDeleted} @copied=${this.onCopied} @result=${this.onResult}></schedule-actions>
      ${this.note ? html`<div class=${`toast${this.note.tone === 'error' ? ' bad' : ''}`} popover="manual" role="status" data-sched-note>${aIcon(this.note.tone === 'error' ? 'warning' : 'check')}${this.note.text}${this.note.action ? html`<button type="button" class="btn sm" data-note-action @click=${() => { const a = this.note?.action; this.note = null; a?.run(); }}>${this.note.action.label}</button>` : nothing}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-schedules': DevicesSchedules;
  }
}
