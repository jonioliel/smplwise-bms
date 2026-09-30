import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-toggle';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import '../components/sw-schedule-bar';
import './schedule-drawer';
import type { ScheduleActions } from './schedule-drawer';
import { ApiError, describeError } from '../api/client';
import { isApi } from '../api/session';
import { onRouteChange, parseRoute, navigate, pushRoute, replaceRoute, type RouteState } from '../router';
import type { IconName } from '../components/sw-icon';
import { DEMO_SUN } from '../api/schedules-mock';
import {
  DAY_ORDER,
  DAY_SHORT,
  REVIEW_LABEL,
  STATE_LABEL,
  bulkSchedules,
  getSchedule,
  getScheduleReview,
  getScheduleStatus,
  listSchedules,
  listTrash,
  purgeTrash,
  restoreFromTrash,
  subscribeSchedules,
  type DayId,
  type ReviewItem,
  type Schedule,
  type ScheduleStatus,
  type TrashItem,
} from '../api/schedules';
import {
  NO_FILTERS,
  activeFilterCount,
  conditionOptions,
  deletedText,
  devicesLine,
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
  summarize,
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
} from './schedules-logic';
import { toneColor } from '../components/sw-schedule-bar';

const VIEW_KEY = 'sw.schedules.view';
const FILTERS_KEY = 'sw.schedules.filters';
const BASE = '/devices/schedules';

interface Note {
  text: string;
  tone: 'ok' | 'error';
  action?: { label: string; run: () => void };
}

const VIEW_ICON: Record<ListView, IconName> = { cards: 'grid', table: 'list', week: 'calendar' };
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

/**
 * CR-014 "תזמונים": the second tab of the home area (`#/devices/schedules`). The list of the schedules the caller may see,
 * as cards, a table or the week (S4's `<schedules-week-view>`, by tag), with a summary strip, search, filters (area, floor,
 * state, day, tag, the Shabbat / holiday condition), grouping, sorting and a bulk selection bar; the detail drawer
 * (`#/devices/schedules/<id>`), the trash (`.../trash`) and the administrator's review list (`.../review`).
 * Written only against the typed client (api/schedules.ts) - the server decides what is visible and what may change, this
 * screen shows it: a control the caller may not use is disabled with the reason, never hidden behind a client rule.
 * Filtering, sorting and grouping run in the browser over the visible list (docs/architecture/SCHEDULER_API.md §3.2: the
 * server applies visibility before it answers).
 */
@customElement('devices-schedules')
export class DevicesSchedules extends LitElement {
  @state() private status: ScheduleStatus | null = null;
  @state() private items: Schedule[] | null = null;
  @state() private failed = '';
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

  private offRoute: (() => void) | null = null;
  private stopWs: (() => void) | null = null;
  private lastWritten = '';
  private urlTimer = 0;
  private noteTimer = 0;

  static styles = css`
    :host {
      display: block;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .banner {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 9px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      border: 1px solid #d7e4ff;
    }
    .banner.stale {
      background: var(--sw-stale-soft);
      color: #92400e;
      border-color: #fde3b4;
    }
    /* ---- the summary strip ---- */
    .strip {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr);
      gap: 12px;
    }
    .strip.two {
      grid-template-columns: minmax(0, 1fr) minmax(0, 2.4fr);
    }
    .kpi {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-1);
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
      text-align: start;
      font: inherit;
      color: inherit;
    }
    button.kpi {
      cursor: pointer;
    }
    button.kpi:hover {
      border-color: var(--sw-border-strong);
    }
    .kpi .ic {
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      border-radius: 9px;
      background: var(--sw-success-soft);
      color: #15803d;
    }
    .kpi .ic.warn {
      background: var(--sw-stale-soft);
      color: #b45309;
    }
    .kpi .ic.acc {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .kpi .big {
      font-size: 28px;
      font-weight: var(--sw-fw-bold);
      line-height: 1.1;
      color: var(--sw-heading, var(--sw-text));
    }
    .kpi .big small {
      font-size: var(--sw-fs-lg);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-medium);
    }
    .kpi .lbl {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .kpi .sm {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .kpi h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .kpi .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .upnext {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .up {
      display: grid;
      grid-template-columns: 46px minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 3px 0;
      font-size: var(--sw-fs-sm);
    }
    .up time {
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
      direction: ltr;
      text-align: end;
    }
    .up .what {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .up .nm {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .up i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--c);
    }
    /* ---- the toolbar ---- */
    .toolbar {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .trow {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .trow sw-field {
      min-inline-size: 0;
    }
    .search {
      flex: 1 1 220px;
      max-inline-size: 360px;
    }
    .extra {
      display: contents;
    }
    .days {
      display: inline-flex;
      gap: 3px;
    }
    .dc {
      inline-size: 26px;
      block-size: 26px;
      border-radius: 50%;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font: inherit;
      font-size: 11px;
      cursor: pointer;
      padding: 0;
    }
    .dc[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .seg {
      display: inline-flex;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      overflow: hidden;
      background: var(--sw-surface);
      margin-inline-start: auto;
    }
    .seg button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 0;
      background: transparent;
      padding: 0 12px;
      min-block-size: 30px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .seg button + button {
      border-inline-start: 1px solid var(--sw-border);
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .filter-toggle {
      display: none;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .chips .sep {
      inline-size: 1px;
      block-size: 18px;
      background: var(--sw-border-strong);
      margin-inline: 4px;
    }
    /* ---- cards ---- */
    .group h3 {
      margin: 6px 2px 8px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 12px;
    }
    .card {
      position: relative;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-1);
      padding: 14px 16px 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-inline-size: 0;
      cursor: pointer;
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    .card:hover {
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-2);
    }
    .card.picked {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 2px var(--sw-accent-soft);
    }
    .card.off .bar,
    .card.off .meta {
      opacity: 0.55;
    }
    .card header {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
    }
    .card h3,
    .name {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    a.name {
      color: var(--sw-heading, var(--sw-text));
      text-decoration: none;
      display: block;
    }
    a.name:hover {
      color: var(--sw-accent-text);
    }
    .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 8px;
      align-items: center;
      min-block-size: 24px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 9px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .pill.warn {
      background: var(--sw-stale-soft);
      color: #b45309;
    }
    .pill.ok {
      background: var(--sw-success-soft);
      color: #15803d;
    }
    .pill.mute {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .card footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      border-block-start: 1px solid var(--sw-border);
      padding-block-start: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .card footer b {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .next {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-inline-size: 0;
    }
    .btns {
      display: inline-flex;
      gap: 2px;
    }
    input[type='checkbox'] {
      inline-size: 16px;
      block-size: 16px;
      accent-color: var(--sw-accent);
      margin: 0;
      cursor: pointer;
    }
    /* ---- table ---- */
    .tbl {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-1);
      overflow: hidden;
    }
    .tr {
      display: grid;
      grid-template-columns: 34px minmax(160px, 1.4fr) auto minmax(230px, 1.9fr) minmax(120px, 1fr) 118px 54px 64px;
      gap: 12px;
      align-items: center;
      padding: 9px 14px;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .tr:last-child {
      border-block-end: 0;
    }
    .tr.h {
      background: var(--sw-surface-2);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      padding-block: 8px;
    }
    .tr.picked {
      background: var(--sw-accent-soft);
    }
    .tr.off .name,
    .tr.off .slotrows {
      opacity: 0.6;
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
      font-weight: var(--sw-fw-semibold);
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
      border-radius: 6px;
      font-size: var(--sw-fs-xs);
      background: color-mix(in srgb, var(--c) 14%, white);
      color: var(--sw-text);
      max-inline-size: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .more {
      font-size: var(--sw-fs-xs);
      color: var(--sw-accent-text);
      background: none;
      border: 0;
      padding: 0;
      cursor: pointer;
      text-align: start;
      font-family: inherit;
    }
    /* ---- states ---- */
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      text-align: center;
      padding: 48px 20px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
    }
    .empty .tile {
      display: grid;
      place-items: center;
      inline-size: 54px;
      block-size: 54px;
      border-radius: 14px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .empty h2 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-semibold);
    }
    .empty p {
      margin: 0;
      max-inline-size: 52ch;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .skel {
      background: linear-gradient(90deg, var(--sw-surface-3), var(--sw-surface-2), var(--sw-surface-3));
      background-size: 200% 100%;
      animation: shimmer 1.4s linear infinite;
      border-radius: 8px;
    }
    .skel-card {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .skel {
        animation: none;
      }
    }
    /* ---- trash, review ---- */
    .list {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-1);
      overflow: hidden;
    }
    .li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 11px 14px;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .li:last-child {
      border-block-end: 0;
    }
    .li .t {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
    }
    .li .d {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .li .issues {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      margin-block-start: 4px;
    }
    .li .ops {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    /* ---- bulk bar, note ---- */
    .bulk {
      position: sticky;
      inset-block-end: 12px;
      align-self: center;
      z-index: 4;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: var(--sw-text);
      color: var(--sw-text-inverse);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3);
      font-size: var(--sw-fs-sm);
      flex-wrap: wrap;
    }
    .bulk sw-button {
      --sw-text: #111827;
    }
    .note {
      position: fixed;
      inset-block-end: calc(var(--sw-bottomnav-h, 0px) + 16px);
      inset-inline: 0;
      margin-inline: auto;
      inline-size: max-content;
      max-inline-size: calc(100vw - 32px);
      z-index: var(--sw-z-toast);
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 9px 14px;
      background: var(--sw-text);
      color: var(--sw-text-inverse);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      font-size: var(--sw-fs-sm);
    }
    .note.error {
      background: #991b1b;
    }
    .note button {
      border: 0;
      background: transparent;
      color: #bcd2ff;
      font: inherit;
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
      padding: 0;
    }
    @media (max-width: 1100px) {
      .tr {
        grid-template-columns: 34px minmax(140px, 1.4fr) minmax(200px, 2fr) minmax(100px, 1fr) 118px 54px 64px;
      }
      .tr > .cdays {
        display: none;
      }
    }
    @media (max-width: 767px) {
      .strip,
      .strip.two {
        grid-template-columns: 1fr 1fr;
      }
      .strip .wide {
        grid-column: 1 / -1;
        order: 3;
      }
      .filter-toggle {
        display: inline-flex;
      }
      .extra {
        display: none;
      }
      .extra[data-open] {
        display: contents;
      }
      .search {
        max-inline-size: none;
      }
      .seg {
        margin-inline-start: 0;
      }
      .grid {
        grid-template-columns: 1fr;
      }
      .tr.h {
        display: none;
      }
      .tr {
        grid-template-columns: 26px minmax(0, 1fr) auto;
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
      .note {
        inset-block-end: calc(var(--sw-bottomnav-h, 50px) + 12px);
      }
      .bulk {
        inset-block-end: calc(var(--sw-bottomnav-h, 50px) + 8px);
      }
    }
  `;

  // ---------------------------------------------------------------------------- lifecycle

  connectedCallback() {
    super.connectedCallback();
    const stored = readStored<Partial<ListFilters>>(FILTERS_KEY);
    const storedView = parseView(store()?.getItem(VIEW_KEY) ?? null);
    const params = parseRoute().params;
    // the address carries the state (a link keeps it); without one, this browser's last choice
    this.filters = params.toString() ? parseFilters(params) : stored ? parseFilters(filtersToParams({ ...NO_FILTERS, ...stored })) : { ...NO_FILTERS };
    this.view = parseView(params.get('view')) ?? storedView ?? 'cards';
    this.offRoute = onRouteChange((r) => this.onRoute(r));
    void this.load();
    this.stopWs = subscribeSchedules(() => void this.refresh());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.offRoute?.();
    this.stopWs?.();
    window.clearTimeout(this.urlTimer);
    window.clearTimeout(this.noteTimer);
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
      this.failed = describeError(err);
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
      if (this.items === null) this.failed = describeError(err);
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
      this.subError = describeError(err);
    }
  }

  private async loadReview() {
    try {
      this.review = (await getScheduleReview()).items;
      this.subError = '';
    } catch (err) {
      this.subError = describeError(err);
    }
  }

  // ---------------------------------------------------------------------------- feedback

  private say(text: string, tone: Note['tone'] = 'ok', action?: Note['action']) {
    window.clearTimeout(this.noteTimer);
    this.note = { text, tone, action };
    this.noteTimer = window.setTimeout(() => (this.note = null), action ? 12000 : 5000);
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
    this.say(`התזמון "${name}" נמחק ונשמר בסל המחזור ל־30 יום.`, 'ok', { label: 'שחזור', run: () => void this.restore(trashId) });
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
      this.say(`התזמון "${r.schedule.display_name}" שוחזר.`, 'ok', { label: 'פתיחה', run: () => this.go(r.schedule.id) });
      await this.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'lowering_confirmation_required' && item) {
        this.trashLowering = item;
        return;
      }
      this.say(describeError(err), 'error');
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
      this.say(`התזמון "${r.schedule.display_name}" שוחזר.`, 'ok', { label: 'פתיחה', run: () => this.go(r.schedule.id) });
      await this.refresh();
    } catch (err) {
      this.trashLowering = null;
      this.say(describeError(err), 'error');
    }
  }

  // ---------------------------------------------------------------------------- actions

  private setFilter(patch: Partial<ListFilters>, delay = 0) {
    this.filters = { ...this.filters, ...patch };
    this.syncUrl(delay);
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
      this.say(skippedLowering ? 'תזמונים שפותחים או מנטרלים מופעלים אחד־אחד.' : 'אין בבחירה תזמונים לשינוי.', 'error');
      return;
    }
    this.busy = true;
    try {
      const r = await bulkSchedules(op, eligible.map((s) => s.id));
      const ok = r.results.filter((x) => x.ok).length;
      const bad = r.results.length - ok;
      const verb = op === 'enable' ? 'הופעלו' : 'הושבתו';
      this.say(bad ? `${verb} ${ok} תזמונים; ${bad} לא שונו.` : `${verb} ${ok} תזמונים${skippedLowering ? `; ${skippedLowering} מופעלים אחד־אחד` : ''}.`, bad ? 'error' : 'ok');
      this.selected = new Set();
    } catch (err) {
      this.say(describeError(err), 'error');
    } finally {
      this.busy = false;
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
      this.say(`הושבתו ${ok} תזמונים.`, ok === r.results.length ? 'ok' : 'error');
      this.reviewSel = new Set();
    } catch (err) {
      this.say(describeError(err), 'error');
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
      this.say(`"${item.name || 'תזמון ללא שם'}" נמחק לצמיתות.`);
    } catch (err) {
      this.purging = null;
      this.say(describeError(err), 'error');
    }
    await this.loadTrash();
  }

  // ---------------------------------------------------------------------------- render: pieces

  private empty(icon: IconName, title: string, text: string, actions: TemplateResult | typeof nothing = nothing, kind = '') {
    return html`<div class="empty" data-sched-state=${kind}><span class="tile"><sw-icon name=${icon} size=${26}></sw-icon></span><h2>${title}</h2>${text ? html`<p>${text}</p>` : nothing}${actions}</div>`;
  }

  private renderSkeleton() {
    return html`<div data-sched-state="loading" aria-busy="true" style="display:flex;flex-direction:column;gap:14px">
      <div class="strip">${[0, 1, 2].map(() => html`<div class="skel-card"><div class="skel" style="block-size:26px;inline-size:30px"></div><div class="skel" style="block-size:26px"></div><div class="skel" style="block-size:10px"></div></div>`)}</div>
      <div class="grid">${[0, 1, 2, 3, 4, 5].map(() => html`<div class="skel-card"><div class="skel" style="block-size:18px;inline-size:60%"></div><div class="skel" style="block-size:12px;inline-size:40%"></div><div class="skel" style="block-size:14px"></div><div class="skel" style="block-size:22px;inline-size:70%"></div></div>`)}</div>
    </div>`;
  }

  private renderStrip(items: Schedule[], st: ReturnType<typeof screenState>) {
    const sum = summarize(items);
    const ups = upcomingToday(items);
    const attention = st.admin ? this.status?.counts.attention ?? 0 : 0;
    return html`<div class=${attention ? 'strip' : 'strip two'} data-sched-strip>
      <div class="kpi" data-kpi="active"><span class="ic"><sw-icon name="check" size=${16}></sw-icon></span><div class="big">${sum.active}<small>/${sum.total}</small></div><div class="lbl">תזמונים פעילים</div>${sum.disabled ? html`<div class="sm">${sum.disabled} מושבתים</div>` : nothing}</div>
      <div class="kpi wide" data-kpi="upcoming">
        <div class="head"><h4>ההרצות הבאות היום</h4><span class="ic acc"><sw-icon name="clock" size=${16}></sw-icon></span></div>
        <div class="upnext">${ups.length
          ? ups.map((u) => html`<div class="up" data-upcoming=${u.scheduleId}><time>${u.time}</time><span class="nm">${u.name}${u.conditional ? html` <span class="what">· בתנאי</span>` : nothing}</span><span class="what" style="display:inline-flex;align-items:center;gap:6px">${u.what}<i style=${`--c:${toneColor(u.tone)}`}></i></span></div>`)
          : html`<div class="sm">אין עוד הרצות היום.</div>`}</div>
      </div>
      ${attention
        ? html`<button class="kpi" data-kpi="attention" @click=${() => this.go('review')}><span class="ic warn"><sw-icon name="warning" size=${16}></sw-icon></span><div class="big">${attention}</div><div class="lbl">דורשים בדיקה</div></button>`
        : nothing}
    </div>`;
  }

  private select(label: string, value: string, options: { value: string; label: string }[], onChange: (v: string) => void, attr: string, all = true) {
    return html`<sw-field><select aria-label=${label} data-filter=${attr} @change=${(e: Event) => onChange((e.target as HTMLSelectElement).value)}>${all ? html`<option value="" .selected=${value === ''}>${label}</option>` : nothing}${options.map((o) => html`<option value=${o.value} .selected=${o.value === value}>${o.label}</option>`)}</select></sw-field>`;
  }

  private renderToolbar(items: Schedule[]) {
    const f = this.filters;
    const areas = placeOptions(items, 'area');
    const floors = placeOptions(items, 'floor');
    const tags = tagOptions(items);
    const conds = conditionOptions(items);
    const sensor = this.status?.settings.shabbat_sensor ?? null;
    const anyPreset = items.some((s) => s.conditions.preset);
    const anyCond = items.some((s) => s.conditions.items.length);
    const active = activeFilterCount(f);
    return html`<div class="toolbar" data-sched-toolbar>
      <div class="trow">
        <sw-field class="search"><input type="search" data-filter="q" aria-label="חיפוש" placeholder="חיפוש תזמון, התקן או תג" .value=${live(f.q)} @input=${(e: Event) => this.setFilter({ q: (e.target as HTMLInputElement).value }, 250)} /></sw-field>
        <sw-button class="filter-toggle" icon="filter" data-filters-toggle @click=${() => (this.filtersOpen = !this.filtersOpen)}>סינון${active ? ` (${active})` : ''}</sw-button>
        <span class="extra" ?data-open=${this.filtersOpen}>
          ${areas.length > 1 ? this.select('כל האזורים', f.area, areas, (v) => this.setFilter({ area: v }), 'area') : nothing}
          ${floors.length > 1 ? this.select('כל הקומות', f.floor, floors, (v) => this.setFilter({ floor: v }), 'floor') : nothing}
          ${this.select('כל המצבים', f.state, [{ value: 'enabled', label: 'פעילים' }, { value: 'disabled', label: 'מושבתים' }, { value: 'triggered', label: STATE_LABEL.triggered }, { value: 'completed', label: 'הסתיימו' }], (v) => this.setFilter({ state: v as StateFilter }), 'state')}
          <span class="days" role="group" aria-label="ימים">${DAY_ORDER.map((d) => html`<button type="button" class="dc" data-day-filter=${d} aria-pressed=${f.day === d} aria-label=${`יום ${DAY_SHORT[d]}`} @click=${() => this.setFilter({ day: f.day === d ? '' : (d as DayId) })}>${DAY_SHORT[d]}</button>`)}</span>
          ${this.select('ללא קיבוץ', f.group, [{ value: 'area', label: 'לפי אזור' }, { value: 'floor', label: 'לפי קומה' }, { value: 'tag', label: 'לפי תג' }, { value: 'state', label: 'לפי מצב' }], (v) => this.setFilter({ group: v as ListGroup }), 'group')}
          ${this.select('מיון: הרצה הבאה', f.sort === 'next_run' ? '' : f.sort, [{ value: 'name', label: 'מיון: שם' }, { value: 'order', label: 'מיון: סדר ידני' }, { value: 'updated', label: 'מיון: עודכן לאחרונה' }], (v) => this.setFilter({ sort: (v || 'next_run') as ListSort }), 'sort')}
        </span>
        <span class="seg" role="group" aria-label="תצוגה">${(['cards', 'table', 'week'] as ListView[]).map((v) => html`<button type="button" data-view-btn=${v} aria-pressed=${this.view === v} @click=${() => this.setView(v)}><sw-icon name=${VIEW_ICON[v]} size=${14}></sw-icon>${VIEW_LABEL[v]}</button>`)}</span>
      </div>
      ${anyCond || tags.length || active
        ? html`<div class="chips" data-sched-chips>
            ${sensor || anyPreset ? html`<sw-chip data-chip-preset="only_holy_days" ?selected=${f.preset === 'only_holy_days'} @click=${() => this.setFilter({ preset: f.preset === 'only_holy_days' ? '' : 'only_holy_days' })}>רק בשבת ובחג</sw-chip><sw-chip data-chip-preset="not_holy_days" ?selected=${f.preset === 'not_holy_days'} @click=${() => this.setFilter({ preset: f.preset === 'not_holy_days' ? '' : 'not_holy_days' })}>לא בשבת ובחג</sw-chip>` : nothing}
            ${anyCond ? html`<sw-chip data-chip-has-cond ?selected=${f.hasConditions} @click=${() => this.setFilter({ hasConditions: !f.hasConditions })}>עם תנאי</sw-chip>` : nothing}
            ${conds.length > 1 ? html`<span class="extra" ?data-open=${this.filtersOpen}>${this.select('כל התנאים', f.condition, conds, (v) => this.setFilter({ condition: v }), 'condition')}</span>` : nothing}
            ${tags.length ? html`<span class="sep"></span>${tags.map((t) => html`<sw-chip data-chip-tag=${t.value} ?selected=${f.tag === t.value} @click=${() => this.setFilter({ tag: f.tag === t.value ? '' : t.value })}>${t.label}</sw-chip>`)}` : nothing}
            ${active ? html`<sw-button variant="ghost" size="sm" data-clear-filters @click=${() => { this.filters = { ...NO_FILTERS, sort: f.sort, group: f.group }; this.syncUrl(); }}>נקה סינון</sw-button>` : nothing}
          </div>`
        : nothing}
    </div>`;
  }

  private stateChip(s: Schedule) {
    if (s.state === 'triggered') return html`<span class="pill ok" data-state-chip="triggered">${STATE_LABEL.triggered}</span>`;
    if (s.state === 'completed') return html`<span class="pill mute" data-state-chip="completed">הסתיים</span>`;
    if (s.enabled && s.state === 'unavailable') return html`<span class="pill mute" data-state-chip="unavailable">${STATE_LABEL.unavailable}</span>`;
    return nothing;
  }

  private toggle(s: Schedule, checked: boolean) {
    void this.actionsHost?.enable(s, checked);
  }

  private renderCard(s: Schedule) {
    const period = periodLabel(s);
    const sun = isApi() ? null : DEMO_SUN;
    return html`<article class=${`card${s.enabled ? '' : ' off'}${this.selected.has(s.id) ? ' picked' : ''}`} data-schedule=${s.id} data-enabled=${s.enabled} @click=${() => this.go(s.id)}>
      <header>
        <input type="checkbox" data-select=${s.id} aria-label=${`בחירת ${s.display_name}`} .checked=${this.selected.has(s.id)} @click=${(e: Event) => e.stopPropagation()} @change=${(e: Event) => this.toggleSel(s.id, (e.target as HTMLInputElement).checked)} />
        <div style="min-inline-size:0"><a class="name" href=${this.href(s.id)} @click=${(e: Event) => e.stopPropagation()}>${s.display_name}</a><div class="sub">${devicesLine(s)}</div></div>
        <span @click=${(e: Event) => e.stopPropagation()}><sw-toggle label=${`${s.enabled ? 'השבתת' : 'הפעלת'} ${s.display_name}`} labelHidden .checked=${live(s.enabled)} ?disabled=${!s.can.toggle || this.busy} data-toggle=${s.id} @change=${(e: CustomEvent<{ checked: boolean }>) => this.toggle(s, e.detail.checked)}></sw-toggle></span>
      </header>
      <div class="bar"><sw-schedule-bar .slots=${s.slots} .sun=${sun}></sw-schedule-bar></div>
      <div class="meta">
        <sw-day-chips .days=${s.days} compact></sw-day-chips>
        ${period ? html`<span class="pill" data-period><sw-icon name="calendar" size=${12}></sw-icon>${period}</span>` : nothing}
        <schedule-condition-chip .conditions=${s.conditions}></schedule-condition-chip>
        <sw-schedule-markers .sensitive=${s.sensitive} .lowering=${s.lowering}></sw-schedule-markers>
        ${this.stateChip(s)}
      </div>
      <footer>
        <span class="next"><sw-icon name="clock" size=${14}></sw-icon>הרצה הבאה <b data-next-run>${nextRunText(s)}</b></span>
        <span class="btns" @click=${(e: Event) => e.stopPropagation()}>
          <sw-button variant="ghost" size="sm" iconOnly icon="play" label=${`הרצה עכשיו: ${s.display_name}`} data-run=${s.id} ?disabled=${!s.can.run} @click=${() => this.actionsHost?.run(s)}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="edit" label=${`עריכת ${s.display_name}`} data-edit=${s.id} ?disabled=${!s.can.edit} @click=${() => navigate(`${BASE}/${s.id}/edit`)}></sw-button>
        </span>
      </footer>
    </article>`;
  }

  private renderRow(s: Schedule) {
    const shown = s.slots.slice(0, 3);
    return html`<div class=${`tr${s.enabled ? '' : ' off'}${this.selected.has(s.id) ? ' picked' : ''}`} data-schedule=${s.id} data-enabled=${s.enabled}>
      <span class="csel"><input type="checkbox" data-select=${s.id} aria-label=${`בחירת ${s.display_name}`} .checked=${this.selected.has(s.id)} @change=${(e: Event) => this.toggleSel(s.id, (e.target as HTMLInputElement).checked)} /></span>
      <span class="cname" style="min-inline-size:0"><a class="name" href=${this.href(s.id)}>${s.display_name}</a><div class="sub">${devicesLine(s)}</div>${s.sensitive || s.lowering ? html`<sw-schedule-markers .sensitive=${s.sensitive} .lowering=${s.lowering}></sw-schedule-markers>` : nothing}</span>
      <span class="cdays"><sw-day-chips .days=${s.days} compact></sw-day-chips></span>
      <span class="cslots slotrows">${shown.map((sl) => html`<span class="sr"><span class="w">${windowText(sl)}</span><span class="a">${slotChips(sl, s).map((c) => html`<span class="ac" style=${`--c:${toneColor(c.tone)}`} title=${c.devices.join(', ')}>${c.label}${c.devices.length > 1 ? ` · ${c.devices.length}` : ''}</span>`)}</span></span>`)}${s.slots.length > shown.length ? html`<button class="more" @click=${() => this.go(s.id)}>ועוד ${s.slots.length - shown.length} משבצות</button>` : nothing}</span>
      <span class="ccond"><schedule-condition-chip .conditions=${s.conditions} compact></schedule-condition-chip></span>
      <span class="cnext"><b data-next-run>${nextRunText(s)}</b></span>
      <span class="ctog"><sw-toggle label=${`${s.enabled ? 'השבתת' : 'הפעלת'} ${s.display_name}`} labelHidden .checked=${live(s.enabled)} ?disabled=${!s.can.toggle || this.busy} data-toggle=${s.id} @change=${(e: CustomEvent<{ checked: boolean }>) => this.toggle(s, e.detail.checked)}></sw-toggle></span>
      <span class="cops"><sw-button variant="ghost" size="sm" iconOnly icon="play" label=${`הרצה עכשיו: ${s.display_name}`} data-run=${s.id} ?disabled=${!s.can.run} @click=${() => this.actionsHost?.run(s)}></sw-button><sw-button variant="ghost" size="sm" iconOnly icon="edit" label=${`עריכת ${s.display_name}`} data-edit=${s.id} ?disabled=${!s.can.edit} @click=${() => navigate(`${BASE}/${s.id}/edit`)}></sw-button></span>
    </div>`;
  }

  private renderTable(rows: Schedule[]) {
    const all = rows.length > 0 && rows.every((s) => this.selected.has(s.id));
    return html`<div class="tbl" data-sched-table>
      <div class="tr h"><span><input type="checkbox" aria-label="בחירת הכול" data-select-all .checked=${all} @change=${(e: Event) => (this.selected = (e.target as HTMLInputElement).checked ? new Set([...this.selected, ...rows.map((s) => s.id)]) : new Set([...this.selected].filter((id) => !rows.some((s) => s.id === id))))} /></span><span>שם</span><span class="cdays">ימים</span><span>משעה · פעולה</span><span>תנאי</span><span>הרצה הבאה</span><span>פעיל</span><span></span></div>
      ${rows.map((s) => this.renderRow(s))}
    </div>`;
  }

  private renderList(rows: Schedule[]) {
    if (this.view === 'week') {
      return html`<schedules-week-view .schedules=${rows} .sun=${isApi() ? null : DEMO_SUN} .snap=${this.status?.settings.snap_minutes ?? 15} @open-schedule=${(e: CustomEvent<{ id: string }>) => this.go(e.detail.id)}></schedules-week-view>`;
    }
    const groups = groupSchedules(sortSchedules(rows, this.filters.sort), this.filters.group);
    if (this.view === 'table') return html`${this.filters.group ? groups.map((g) => html`<div class="group" data-group=${g.key}><h3>${g.label}</h3>${this.renderTable(g.items)}</div>`) : this.renderTable(groups[0].items)}`;
    return html`${groups.map((g) => html`<div class="group" data-group=${g.key}>${g.label ? html`<h3>${g.label}</h3>` : nothing}<div class="grid" data-sched-grid>${g.items.map((s) => this.renderCard(s))}</div></div>`)}`;
  }

  private renderBulk() {
    const n = this.selected.size;
    if (!n || this.view === 'week') return nothing;
    const can = !!this.status?.can.manage && !!this.status?.writable;
    return html`<div class="bulk" role="region" aria-label="פעולות על הבחירה" data-bulk-bar>
      <b>${n} נבחרו</b>
      ${can ? html`<sw-button size="sm" data-bulk-enable ?disabled=${this.busy} @click=${() => void this.bulk('enable')}>הפעלה</sw-button><sw-button size="sm" data-bulk-disable ?disabled=${this.busy} @click=${() => void this.bulk('disable')}>השבתה</sw-button>` : nothing}
      <sw-button size="sm" variant="ghost" data-bulk-clear @click=${() => (this.selected = new Set())}><span style="color:#fff">ביטול בחירה</span></sw-button>
    </div>`;
  }

  // ---------------------------------------------------------------------------- render: the sub-views

  private renderTrash() {
    if (this.subError) return html`<sw-state-panel state="error" hint=${this.subError} actionLabel="נסו שוב" @action=${() => void this.loadTrash()}></sw-state-panel>`;
    if (this.trash === null) return this.renderSkeleton();
    if (!this.trash.length) return this.empty('trash', 'סל המחזור ריק', 'תזמון שנמחק נשמר כאן 30 יום ואפשר לשחזר אותו.', nothing, 'trash-empty');
    const canPurge = !!this.status?.can.configure && !!this.status?.can.manage;
    return html`<div class="list" data-sched-trash>${this.trash.map(
      (t) => html`<div class="li" data-trash-item=${t.trash_id}>
        <div><div class="t">${t.name || 'תזמון ללא שם'}</div><div class="d">${t.entities.map((e) => e.name).join(' · ')}</div><div class="d">${deletedText(t.deleted_at)}${t.deleted_by ? ` · ${t.deleted_by.display_name}` : ''} · ${keptText(t.expires_at)}</div></div>
        <div class="ops">${t.sensitive ? html`<sw-schedule-markers .sensitive=${true}></sw-schedule-markers>` : nothing}
          <sw-button size="sm" variant="primary" data-restore=${t.trash_id} ?disabled=${!t.can_restore} title=${t.can_restore ? '' : 'אין הרשאה לשחזר תזמון זה.'} @click=${() => void this.restore(t.trash_id, t)}>שחזור</sw-button>
          ${canPurge ? html`<sw-button size="sm" variant="ghost" iconOnly icon="trash" label="מחיקה לצמיתות" data-purge=${t.trash_id} @click=${() => (this.purging = t)}></sw-button>` : nothing}</div>
      </div>`,
    )}</div>`;
  }

  private renderReview() {
    if (this.subError) return html`<sw-state-panel state="error" hint=${this.subError} actionLabel="נסו שוב" @action=${() => void this.loadReview()}></sw-state-panel>`;
    if (this.review === null) return this.renderSkeleton();
    if (!this.review.length) return this.empty('check', 'אין תזמונים הדורשים בדיקה', '', nothing, 'review-empty');
    const n = this.reviewSel.size;
    return html`<div class="list" data-sched-review>${this.review.map(
      (r) => html`<div class="li" data-review-item=${r.schedule.id}>
        <div style="display:flex;gap:10px;align-items:flex-start">
          <input type="checkbox" data-review-select=${r.schedule.id} aria-label=${`בחירת ${r.schedule.display_name}`} ?disabled=${!r.schedule.enabled || !r.schedule.can.toggle} .checked=${this.reviewSel.has(r.schedule.id)} @change=${(e: Event) => { const next = new Set(this.reviewSel); if ((e.target as HTMLInputElement).checked) next.add(r.schedule.id); else next.delete(r.schedule.id); this.reviewSel = next; }} />
          <div><div class="t"><a class="name" style="display:inline" href=${this.href(r.schedule.id)}>${r.schedule.display_name}</a></div><div class="d">${devicesLine(r.schedule)}${r.schedule.owner ? ` · ${r.schedule.owner.display_name}` : ''}</div>
          <div class="issues">${r.issues.map((i) => html`<span class="pill warn" data-issue=${i}>${REVIEW_LABEL[i]}</span>`)}</div></div>
        </div>
        <div class="ops"><span class=${r.schedule.enabled ? 'pill ok' : 'pill mute'}>${r.schedule.enabled ? 'פעיל' : 'מושבת'}</span></div>
      </div>`,
    )}</div>
    ${n ? html`<div class="bulk" data-bulk-bar="review"><b>${n} נבחרו</b><sw-button size="sm" data-review-disable ?disabled=${this.busy} @click=${() => void this.bulkReview()}>השבתת הנבחרים</sw-button></div>` : nothing}`;
  }

  // ---------------------------------------------------------------------------- render

  private renderReady(st: ReturnType<typeof screenState>) {
    const all = this.items ?? [];
    const rows = filterSchedules(all, this.filters);
    return html`
      ${st.stale ? html`<div class="banner stale" role="status" data-sched-stale><sw-icon name="offline" size=${16}></sw-icon>${STALE_TEXT}</div>` : nothing}
      ${st.readOnly ? html`<div class="banner" role="status" data-sched-readonly><sw-icon name=${this.status?.can.manage ? 'lock' : 'eye'} size=${16}></sw-icon>${st.readOnlyText}</div>` : nothing}
      ${all.length ? this.renderStrip(all, st) : nothing}
      ${all.length
        ? html`${this.renderToolbar(all)}
          ${rows.length
            ? this.renderList(rows)
            : this.empty('search', 'לא נמצאו תזמונים תואמים', '', html`<sw-button size="sm" data-clear-filters @click=${() => (this.filters = { ...NO_FILTERS })}>נקה סינון</sw-button>`, 'no-match')}`
        : this.empty(
            'calendar',
            'אין עדיין תזמונים',
            st.readOnly ? '' : 'תזמון מפעיל התקנים בשעות קבועות, בימים שבחרתם.',
            !st.readOnly ? html`<sw-button variant="primary" icon="plus" data-new-schedule @click=${() => this.newSchedule()}>תזמון חדש</sw-button>` : nothing,
            'empty',
          )}
      ${this.renderBulk()}
    `;
  }

  private renderBody(st: ReturnType<typeof screenState>) {
    const settingsBtn = st.admin ? html`<sw-button variant="primary" icon="system" data-open-settings @click=${() => navigate('/system/schedules')}>פתיחת הגדרות התזמונים</sw-button>` : nothing;
    switch (st.kind) {
      case 'loading':
        return this.renderSkeleton();
      case 'error':
        return html`<sw-state-panel state="error" hint=${this.failed} actionLabel="נסו שוב" data-sched-state="error" @action=${() => { this.failed = ''; void this.load(); }}></sw-state-panel>`;
      case 'no_view':
        return html`<sw-state-panel data-sched-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בתזמונים" hint="נדרשת ההרשאה צפייה בתזמונים. פנה למנהל המערכת."></sw-state-panel>`;
      case 'feature_disabled':
        return this.empty('calendar', 'התזמונים כבויים', st.admin ? 'אפשר להפעיל אותם בהגדרות התזמונים.' : 'התזמונים כבויים בהגדרות המערכת.', settingsBtn, 'feature_disabled');
      case 'missing':
        return st.admin
          ? this.empty('calendar', 'רכיב התזמונים אינו מחובר', 'מסך התזמונים פועל דרך רכיב התזמונים של תשתית המערכת, והוא לא נמצא. ההוראות, בדיקת החיבור ושאר ההגדרות נמצאות בהגדרות המערכת.', settingsBtn, 'missing_admin')
          : this.empty('calendar', 'אין תזמונים להצגה', 'הפעלת התזמונים מנוהלת בהגדרות.', nothing, 'missing');
      default:
        return this.sub === 'trash' ? this.renderTrash() : this.sub === 'review' ? this.renderReview() : this.renderReady(st);
    }
  }

  private headerActions(st: ReturnType<typeof screenState>) {
    if (st.kind !== 'ready' || this.sub === 'trash' || this.sub === 'review') return nothing;
    const st2 = this.status;
    return html`<div class="actions" slot="actions">
      <sw-button variant="ghost" icon="trash" data-open-trash @click=${() => this.go('trash')}>סל מחזור</sw-button>
      ${st.admin && (st2?.counts.attention ?? 0) > 0 ? html`<sw-button variant="ghost" icon="warning" data-open-review @click=${() => this.go('review')}>לבדיקה</sw-button>` : nothing}
      <sw-button variant="primary" icon="plus" data-new-schedule ?disabled=${st.readOnly} title=${st.readOnly ? st.readOnlyText : ''} @click=${() => this.newSchedule()}>תזמון חדש</sw-button>
    </div>`;
  }

  render() {
    const st = screenState(this.status, !!this.failed && !this.status);
    const listFailed = st.kind === 'ready' && this.items === null && !!this.failed;
    const scr = listFailed ? { ...st, kind: 'error' as const } : st.kind === 'ready' && this.items === null ? { ...st, kind: 'loading' as const } : st;
    const sub = this.sub;
    const heading = sub === 'trash' ? 'סל מחזור' : sub === 'review' ? 'תזמונים לבדיקה' : 'תזמונים';
    const summary = this.items && scr.kind === 'ready' && !sub ? summarize(this.items) : null;
    const areas = this.items && !sub ? new Set(this.items.flatMap((s) => s.entities.map((e) => e.area_id).filter(Boolean))).size : 0;
    const next = this.items && !sub ? upcomingToday(this.items, new Date(), 1)[0] : undefined;
    const subheading = summary && summary.total ? [`${summary.total} תזמונים`, `${summary.active} פעילים`, areas ? `${areas} אזורים` : '', next ? `הפעלה הבאה היום ${next.time}` : ''].filter(Boolean).join(' · ') : '';
    const drawerId = sub && sub !== 'trash' && sub !== 'review' ? sub : '';
    return html`<sw-page heading=${heading} subheading=${subheading} wide data-sched-screen=${scr.kind} backHref=${sub === 'trash' || sub === 'review' ? BASE : ''}>
      ${this.headerActions(scr)}
      ${this.renderBody(scr)}
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
        ? html`<sw-dialog open heading="מחיקה לצמיתות" @close=${() => (this.purging = null)}><p style="margin:0;font-size:var(--sw-fs-sm)">למחוק את "${this.purging.name || 'תזמון ללא שם'}" מסל המחזור? אי אפשר יהיה לשחזר אותו.</p><sw-button slot="footer" variant="ghost" @click=${() => (this.purging = null)}>ביטול</sw-button><sw-button slot="footer" variant="danger" data-purge-confirm @click=${() => void this.doPurge()}>מחיקה</sw-button></sw-dialog>`
        : nothing}
      <schedule-actions .status=${this.status} @changed=${this.onChanged} @deleted=${this.onDeleted} @copied=${this.onCopied} @result=${this.onResult}></schedule-actions>
      ${this.note ? html`<div class=${this.note.tone === 'error' ? 'note error' : 'note'} role="status" data-sched-note>${this.note.text}${this.note.action ? html`<button data-note-action @click=${() => { const a = this.note?.action; this.note = null; a?.run(); }}>${this.note.action.label}</button>` : nothing}</div>` : nothing}
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-schedules': DevicesSchedules;
  }
}
