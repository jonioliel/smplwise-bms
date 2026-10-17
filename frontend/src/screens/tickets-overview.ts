import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { automationsStyles } from '../styles/automations-glass';
import { mediaPageStyles, measureHeaderBar } from '../styles/media-page';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import { ApiError } from '../api/client';
import { canAnywhere, onMeEvent } from '../api/session';
import { replaceRoute, type RouteState } from '../router';
import { ticketsApi, type Meta, type ModuleState } from '../api/tickets';
import { boardApi, type BoardResponse, type StuckKind } from '../api/tickets-board';
import { ticketsRfqApi, type RfqDetail, type RfqSummary } from '../api/tickets-rfq';
import { ticketsS4Api } from '../api/tickets-s4';
import { ticketCostsApi } from '../api/tickets-costs';
import { boardHref, fmtDur, waitingLabel } from '../tickets/board-model';
import { rfqHref } from '../tickets/rfq-model';
import { listHref, NO_FILTERS, relTime } from '../tickets/model';
import { bt, type BoardTextKey } from '../tickets/board-text';
import { tt } from '../tickets/text';
import { tIcon } from '../tickets/icons';
import { onTicketNames, setTicketNames } from '../tickets/naming';
import { LiveRefresh } from '../tickets/live-refresh';
import { asHandledDays, HANDLED_DEFAULT, readStoredPeriod, type HandledDays } from '../tickets/handler-load';
import { ot, type OverviewTextKey } from '../tickets/overview-text';
import {
  agenda, dayKey, deptComparison, FOLD_STORAGE_KEY, foldedOf, handlerRows, kpiDeltas, lanes, METER_SEGMENTS, overdueRows, OVERDUE_SHOWN, overviewSettingsOf,
  parseKpiStore, paymentDates, rollKpis, splitVendors, STUCK_REASONS, stuckPlaces, stuckReasonCounts,
  type AgendaEntry, type CardKey, type HandlerRow, type KpiKey, type Kpis, type OverviewSettings,
} from '../tickets/overview-model';

type Screen = 'loading' | 'ready' | 'error' | 'forbidden' | 'off';

/** the board and the numbers row every minute while visible (spec 5); the requests for quotation, the payment dates, the handled counts and
 * the cost claims - which do not change minute by minute - every ten minutes */
export const OVERVIEW_REFRESH_MS = 60_000;
export const SLOW_REFRESH_MS = 600_000;
/** at most this many awarded requests are read in detail for their payment dates (one request each) */
export const DETAIL_CAP = 12;
const DEPT_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const KPI_STORE = 'sw.tickets.overview.kpis.';

const readStore = (key: string): string | null => {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStore = (key: string, value: string): void => {
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    /* not remembered */
  }
};

/**
 * MGRDASH phase 1 - the manager overview (`#/tickets/overview[?dept=<id>]`, docs/design/MANAGER_DASHBOARD_SPEC_HE.md, mock-up
 * docs/design/mockups/manager-dashboard-v2.html): the first tab of the service area, for managers only. Built on existing routes only (the
 * spec's phase 1 - no new data route): the manager board (cards 1-4, 9, 10 and the department comparison), the requests for quotation
 * (deadlines, work starts, payment-schedule dates), the handler load route ("handled" = marked done), the cost claims (tickets.costs.view).
 * The server's single visibility rule decides every row of every answer; nothing here filters for security. Phase 2-3 add the summary
 * route (throughput, opened vs closed, approvals, RFQ decisions) and its cards.
 * States: loading (skeletons of the same size), ready, all fine (a quiet green line per card), empty (no requests at all), partial (the RFQ
 * part failed: its rows say "not available"), offline (the last numbers stay, greyed, with the time), forbidden, error, the module off.
 */
@customElement('tickets-overview')
export class TicketsOverview extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private screen: Screen = 'loading';
  @state() private module: ModuleState | null = null;
  @state() private meta: Meta | null = null;
  @state() private data: BoardResponse | null = null;
  @state() private dept = '';
  @state() private rfqs: RfqSummary[] | null = null;
  @state() private rfqFailed = false;
  @state() private details = new Map<string, RfqDetail>();
  @state() private vendorIds: ReadonlySet<string> = new Set();
  @state() private handled: { days: HandledDays; counts: Record<string, number> } | null = null;
  @state() private approval: number | null = null;
  @state() private reason: StuckKind | '' = '';
  @state() private folded: Set<CardKey> = foldedOf(readStore(FOLD_STORAGE_KEY), window.matchMedia('(max-width: 767px)').matches);
  @state() private allOverdue = false;
  @state() private offline = false;
  @state() private lastOk: Date | null = null;
  @state() private now = new Date();
  @state() private phone = window.matchMedia('(max-width: 767px)').matches;
  @state() private compactHeader = false;
  @state() private yesterday: Kpis | null = null;
  private seq = 0;
  private slowAt = 0;
  private slowKey = '';
  private phoneMq = window.matchMedia('(max-width: 767px)');
  private onPhone = () => (this.phone = this.phoneMq.matches);
  private offNames: (() => void) | null = null;
  private offMe: (() => void) | null = null;
  private pushAt = 0;
  private live = new LiveRefresh(() => { this.now = new Date(); if (this.screen === 'ready') void this.load(true); }, OVERVIEW_REFRESH_MS);

  static styles = [bubbleChrome, ...automationsStyles, mediaPageStyles, css`
    .n { direction: ltr; unicode-bidi: isolate; display: inline-block; font-variant-numeric: tabular-nums; }
    .amb { font-size: var(--sw-fs-md); color: var(--dv-text-2); }
    .amb em { font-style: normal; color: var(--dv-text); font-weight: 600; }
    .crumbs { font-size: var(--sw-fs-sm); color: var(--dv-text-2); margin-block-end: 2px; }
    .titles { min-inline-size: 0; }
    .seg button small { font-size: var(--sw-fs-xs); color: var(--dv-text-2); font-weight: 600; font-variant-numeric: tabular-nums; margin-inline-start: 6px; }
    .offline-top { position: sticky; inset-block-start: 0; z-index: 16; margin: 0 -36px -16px; padding: 8px 36px; background: linear-gradient(var(--dv-warning-soft), var(--dv-warning-soft)), var(--dv-surface-solid); border-block-end: 1px solid color-mix(in srgb, var(--dv-warning) 38%, transparent); font-size: var(--sw-fs-sm); font-weight: 600; color: var(--au-warn-text); display: flex; align-items: center; gap: 8px; }
    /* the numbers row: the RFQ board's tiles */
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--sw-s-3); }
    .kpi { display: flex; flex-direction: column; gap: 4px; padding: 14px 18px; border-radius: var(--sw-r-xl); border: 1px solid var(--dv-border); background: var(--dv-surface); -webkit-backdrop-filter: var(--dv-surface-blur); backdrop-filter: var(--dv-surface-blur); box-shadow: var(--dv-shadow-1); min-inline-size: 0; color: inherit; text-decoration: none; font: inherit; text-align: start; cursor: pointer; }
    .kpi small { font-size: var(--sw-fs-sm); color: var(--dv-text-2); }
    .kpi b { font-size: var(--sw-fs-2xl); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--dv-text); overflow-wrap: anywhere; display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 6px; }
    .kpi.warn b { color: var(--au-warn-text); }
    .kpi.bad b { color: var(--dv-danger); }
    .kpi .d { display: inline-flex; align-items: center; gap: 2px; font-size: var(--sw-fs-xs); font-weight: 600; color: var(--dv-text-3); font-variant-numeric: tabular-nums; }
    .kpi .d.up { color: var(--dv-danger); }
    .kpi .d.down { color: var(--au-ok-text); }
    .kpi .d .ic { font-size: var(--sw-fs-2xs); stroke-width: 2.4; }
    .kpi .least { font-size: var(--sw-fs-xs); font-weight: 600; color: var(--dv-text-3); }
    .page.stale .kpi b, .page.stale .lane .big, .page.stale .tree .n, .page.stale .cell { color: var(--dv-text-3); }
    .page.stale .load i.on, .page.stale .load i.hot { background: var(--dv-border-strong); }
    /* the widget grid and the widget card */
    .wgrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--dv-gap-lg, 18px); align-items: start; }
    .w { display: flex; flex-direction: column; gap: 12px; padding: 16px 18px 14px; border-radius: var(--sw-r-2xl); min-inline-size: 0; }
    .w.wide { grid-column: span 2; }
    .w.full { grid-column: 1 / -1; }
    .w > header { display: flex; align-items: center; gap: 10px; min-inline-size: 0; }
    .w > header h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-lg); font-weight: 700; letter-spacing: -0.015em; line-height: 1.25; min-inline-size: 0; }
    .w > header .q { font-size: var(--sw-fs-sm); font-weight: 500; color: var(--dv-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-inline-size: 0; }
    .w > header .fold { all: unset; box-sizing: border-box; margin-inline-start: auto; display: grid; place-items: center; inline-size: 32px; block-size: 32px; border-radius: 50%; color: var(--dv-text-3); cursor: pointer; flex: none; }
    .w > header .fold:hover { background: var(--dv-surface-3); color: var(--dv-text); }
    .w > header .fold:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: 2px; }
    .w > header .fold .ic { font-size: var(--sw-fs-xl); transition: transform var(--mm-motion, 200ms) var(--mm-ease, ease); }
    .w.folded > header .fold .ic { transform: rotate(90deg); }
    .w.folded > :not(header) { display: none; }
    .w .body { display: flex; flex-direction: column; gap: 10px; min-inline-size: 0; }
    .cnt { display: inline-grid; place-items: center; min-inline-size: 22px; block-size: 22px; padding-inline: 6px; box-sizing: border-box; border-radius: var(--sw-r-pill); background: var(--dv-warning-soft); color: var(--au-warn-text); font-size: var(--sw-fs-sm); font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .cnt.info { background: var(--dv-accent-soft); color: var(--dv-accent-text); }
    .cnt.bad { background: var(--dv-danger-soft); color: var(--dv-danger); }
    .quiet { display: inline-flex; align-items: center; gap: 8px; min-block-size: 36px; font-size: var(--sw-fs-base); font-weight: 600; color: var(--au-ok-text); }
    .quiet .ic { font-size: var(--sw-fs-lg); }
    .unavail { display: flex; align-items: center; gap: 10px; min-block-size: 44px; font-size: var(--sw-fs-base); color: var(--dv-text-2); }
    .unavail .btn { margin-inline-start: auto; }
    .skel { display: flex; flex-direction: column; gap: 10px; }
    .mut { color: var(--dv-text-3); font-size: var(--sw-fs-sm); }
    .note { font-size: var(--sw-fs-sm); color: var(--dv-text-2); }
    /* where stuck */
    .rooms { flex-wrap: wrap; }
    .rc small { display: inline-grid; place-items: center; min-inline-size: 18px; block-size: 18px; padding-inline: 5px; box-sizing: border-box; margin-inline-start: 8px; border-radius: var(--sw-r-pill); background: color-mix(in srgb, var(--dv-text) 8%, transparent); color: var(--dv-text-2); font-size: var(--sw-fs-xs); font-weight: 700; font-variant-numeric: tabular-nums; }
    .rc[aria-pressed='true'] small { background: color-mix(in srgb, currentColor 18%, transparent); color: inherit; }
    .tree { display: flex; flex-direction: column; gap: 2px; }
    .place { display: grid; grid-template-columns: minmax(0, 1fr) 110px auto; align-items: center; gap: 12px; }
    .tree .row { box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px; min-block-size: 40px; padding-inline: 8px 12px; border-radius: var(--sw-r-lg); color: var(--dv-text); font-size: var(--sw-fs-base); text-decoration: none; }
    .tree .row:hover, .tree .row:focus-visible { background: color-mix(in srgb, var(--dv-text) 6%, transparent); outline: none; }
    .tree .row.l0 .nm { font-weight: 700; }
    .tree .row.l1 { padding-inline-start: 28px; color: var(--dv-text-2); }
    .tree .row.l2 { padding-inline-start: 48px; color: var(--dv-text-2); }
    .tree .row .n { color: var(--dv-accent-text); font-size: var(--sw-fs-sm); font-weight: 600; }
    .tree .row .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .track { display: flex; block-size: 6px; border-radius: var(--sw-r-pill); background: var(--dv-surface-3); overflow: hidden; }
    .track span { background: var(--dv-warning); }
    .why { display: flex; flex-wrap: wrap; gap: 4px 10px; padding-inline-start: 8px; margin-block: -2px 4px; font-size: var(--sw-fs-xs); color: var(--dv-text-3); }
    .why span { display: inline-flex; align-items: center; gap: 4px; }
    .dot { inline-size: 6px; block-size: 6px; border-radius: 50%; flex: none; background: var(--dv-offline); display: inline-block; }
    .dot.bad { background: var(--sw-danger); }
    .dot.warn { background: var(--sw-warning); }
    .dot.acc { background: var(--dv-accent); }
    .dot.ok { background: var(--sw-success); }
    .dot.pur { background: var(--sw-purple); }
    /* handler load */
    .crows { display: flex; flex-direction: column; }
    .crow { display: grid; grid-template-columns: auto minmax(0, 1.4fr) auto auto; gap: 12px; align-items: center; padding: 6px; min-block-size: 56px; border-block-end: 1px solid var(--dv-border); color: inherit; text-decoration: none; font-size: var(--sw-fs-md); }
    .crow:last-child { border-block-end: 0; }
    .crow:hover, .crow:focus-visible { background: var(--dv-surface-2); outline: none; }
    .crow b { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; font-weight: 700; }
    .crow .nm small { display: block; color: var(--dv-text-3); font-size: var(--sw-fs-xs); }
    .av { display: inline-grid; place-items: center; flex: none; inline-size: 36px; block-size: 36px; border-radius: 50%; font-weight: 800; font-size: var(--sw-fs-sm); background: var(--dv-accent-soft); color: var(--dv-accent-text); }
    .av.ext { color: var(--au-warn-text); background: var(--dv-warning-soft); }
    .st { display: flex; gap: 0; }
    .cell { font-size: var(--sw-fs-md); color: var(--dv-text); font-variant-numeric: tabular-nums; min-inline-size: 58px; text-align: center; }
    .cell small { display: none; font-size: var(--sw-fs-2xs); color: var(--dv-text-3); }
    .cell.bad { color: var(--dv-danger); font-weight: 700; }
    .cell.warn { color: var(--au-warn-text); font-weight: 700; }
    .ldc { min-inline-size: 70px; display: grid; justify-items: center; gap: 3px; }
    .ldc small { font-size: var(--sw-fs-2xs); color: var(--dv-text-3); }
    .load { display: inline-flex; gap: 3px; align-items: center; }
    .load i { inline-size: 14px; block-size: 6px; border-radius: var(--sw-r-pill); background: var(--dv-surface-3); }
    .load i.on { background: var(--dv-accent); }
    .load i.hot { background: var(--dv-danger); }
    .hhead { display: grid; grid-template-columns: 36px minmax(0, 1.4fr) auto auto; gap: 12px; padding-inline: 6px; font-size: var(--sw-fs-2xs); color: var(--dv-text-3); }
    .hhead .st span { min-inline-size: 58px; text-align: center; }
    .hhead .ldc { min-inline-size: 70px; text-align: center; }
    .chip.pur { background: color-mix(in srgb, var(--sw-purple) 16%, transparent); color: color-mix(in srgb, var(--sw-purple) 68%, var(--dv-text)); }
    .sect { display: flex; flex-direction: column; gap: 8px; }
    .sect > h4 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); font-weight: 600; color: var(--dv-text-2); }
    .sect > h4 .today { color: var(--dv-accent-text); }
    /* who waits for whom */
    .lanes { display: grid; gap: 8px; }
    a.blk { text-decoration: none; color: inherit; }
    .lane .bt b { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-md); color: var(--dv-text); }
    .lane .bt small { display: flex; flex-wrap: wrap; gap: 2px 10px; }
    .lane .big { font-size: var(--sw-fs-2xl); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--dv-text); min-inline-size: 28px; text-align: center; }
    .lane .bi.me { background: var(--dv-accent-soft); color: var(--dv-accent-text); }
    .lane .bi.ext { background: color-mix(in srgb, var(--sw-purple) 16%, transparent); color: color-mix(in srgb, var(--sw-purple) 68%, var(--dv-text)); }
    /* rows: overdue and the agenda */
    .closedrows { display: flex; flex-direction: column; padding: 4px 0; }
    .closedrows .cr { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 6px 14px; min-block-size: 44px; padding: 6px 10px; color: var(--dv-text); font-size: var(--sw-fs-base); text-align: start; text-decoration: none; border-radius: var(--sw-r-lg); }
    .closedrows .cr + .cr { border-block-start: 1px solid var(--dv-border); }
    .closedrows .cr:hover, .closedrows .cr:focus-visible { background: var(--dv-surface-3); outline: none; }
    .closedrows .cr .num { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; color: var(--dv-text-3); font-weight: 600; }
    .closedrows .cr b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-inline-size: 0; }
    .closedrows .cr b small { display: block; font-weight: 400; color: var(--dv-text-2); overflow: hidden; text-overflow: ellipsis; }
    .closedrows .cr .who { color: var(--dv-text-2); white-space: nowrap; }
    .cwarn { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--au-warn-text); }
    .cwarn.bad { color: var(--dv-danger); }
    .back { color: var(--dv-text-3); }
    /* the department comparison */
    .rtbl { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-base); }
    .rtbl th { text-align: start; font-size: var(--sw-fs-sm); font-weight: 600; color: var(--dv-text-2); padding: 6px 8px; border-block-end: 1px solid var(--dv-border); white-space: nowrap; }
    .rtbl td { padding: 10px 8px; border-block-end: 1px solid var(--dv-border); vertical-align: middle; font-variant-numeric: tabular-nums; }
    .rtbl tr:last-child td { border-block-end: 0; }
    .rtbl .num { text-align: center; }
    .rtbl td.bad { color: var(--dv-danger); font-weight: 700; }
    .tl { display: inline-flex; align-items: center; gap: 5px; color: var(--dv-accent-text); font-weight: 600; text-decoration: none; min-block-size: 32px; }
    .tl:hover { text-decoration: underline; }
    .dcards { display: none; }
    .vh { position: absolute !important; inline-size: 1px; block-size: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    @media (max-width: 1180px) {
      .wgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 767px) {
      .dh-row { display: grid; grid-template-columns: minmax(0, 1fr) var(--sw-float-reserve, 0px); grid-template-areas: 't .'; gap: 10px; }
      .amb, .hide-ph { display: none; }
      .dh-det .seg { inline-size: 100%; box-sizing: border-box; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-radius: var(--sw-r-xl); }
      .dh-det .seg button { min-inline-size: 0; padding-inline: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dh-det .grow { display: none; }
      .offline-top { margin: 0 -14px -10px; padding: 8px 14px; }
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .kpi { padding: 12px 14px; }
      .wgrid { grid-template-columns: minmax(0, 1fr); gap: 12px; }
      .w.wide, .w.full { grid-column: auto; }
      .w { padding: 14px 14px 12px; }
      .w > header .q { display: none; }
      .w > header .fold { inline-size: 44px; block-size: 44px; margin-block: -6px; }
      .place { grid-template-columns: minmax(0, 1fr) auto; }
      .place .track { display: none; }
      .rooms { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin-inline: -14px; padding-inline: 14px; }
      .hhead { display: none; }
      .crow { grid-template-columns: auto minmax(0, 1fr) auto; grid-template-areas: 'av nm ld' 'av st st'; row-gap: 4px; padding-block: 10px; }
      .crow .av { grid-area: av; }
      .crow .nm { grid-area: nm; }
      .crow .ldc { grid-area: ld; }
      .crow .st { grid-area: st; display: flex; gap: 16px; }
      .cell { min-inline-size: 0; text-align: start; display: inline-flex; gap: 4px; align-items: baseline; font-size: var(--sw-fs-base); }
      .cell small { display: inline; font-size: var(--sw-fs-xs); }
      .closedrows .cr { grid-template-columns: auto minmax(0, 1fr) auto; }
      .closedrows .cr .who { display: none; }
      .rtbl { display: none; }
      .dcards { display: flex; flex-direction: column; gap: 8px; }
      .dcard { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--sw-r-lg); background: var(--dv-surface); border: 1px solid var(--dv-border); color: inherit; text-decoration: none; min-block-size: 44px; }
      .dcard .nums { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: var(--sw-fs-sm); color: var(--dv-text-2); }
      .dcard .nums em { font-style: normal; font-weight: 700; color: var(--dv-text); font-variant-numeric: tabular-nums; }
    }
    @media (pointer: coarse) {
      .tree .row, .closedrows .cr, .tl { min-block-size: 44px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .w > header .fold .ic { transition: none; }
    }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.phoneMq.addEventListener('change', this.onPhone);
    this.addEventListener('scroll', this.onScroll, { passive: true });
    this.offNames = onTicketNames(() => this.requestUpdate());
    // spec 5: a notification of the module is a trigger to re-read, never the data itself (no new push channel)
    this.offMe = onMeEvent((env) => {
      if (env.type !== 'notification' || this.screen !== 'ready') return;
      const t = Date.now();
      if (t - this.pushAt < 5_000) return;
      this.pushAt = t;
      void this.load(true);
    });
    window.addEventListener('online', this.onOnline);
    this.live.start();
    void this.boot();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.phoneMq.removeEventListener('change', this.onPhone);
    this.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('online', this.onOnline);
    this.offNames?.();
    this.offMe?.();
    this.live.stop();
  }

  private onOnline = () => {
    if (this.screen === 'ready') void this.load(true);
  };

  private onScroll = () => {
    const compact = this.scrollTop > 40;
    if (compact !== this.compactHeader) this.compactHeader = compact;
  };

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('route') && this.route) {
      const d = this.route.params.get('dept') ?? '';
      const next = DEPT_RE.test(d) ? d : '';
      if (next !== this.dept) {
        this.dept = next;
        this.reason = '';
        this.allOverdue = false;
        if (this.screen === 'ready') void this.load(false);
      }
    }
  }

  protected updated(): void {
    measureHeaderBar(this.renderRoot, this.phone);
  }

  // ---------------------------------------------------------------- data

  private settings(): OverviewSettings {
    return overviewSettingsOf({ ...((this.module?.ui ?? {}) as Record<string, unknown>), ...((this.data?.ui ?? {}) as Record<string, unknown>) });
  }

  private async boot(): Promise<void> {
    try {
      const m = await ticketsApi().module();
      this.module = m;
      setTicketNames(m.name);
      if (!m.enabled) {
        this.screen = 'off';
        return;
      }
      this.meta = await ticketsApi().meta().catch(() => null);
      void ticketsS4Api().contacts({ kind: 'vendor' }).then((r) => (this.vendorIds = new Set(r.contacts.map((c) => c.id)))).catch(() => undefined);
      await this.load(false);
    } catch (e) {
      this.fail(e);
    }
  }

  private fail(e: unknown): void {
    if (e instanceof ApiError && e.status === 403) this.screen = 'forbidden';
    else if (e instanceof ApiError && e.status === 404 && e.body.code === 'feature_disabled') this.screen = 'off';
    else this.screen = 'error';
  }

  /** `quiet`: the minute refresh - nothing moves while it runs; a failure keeps the last numbers (offline: greyed, with their time). */
  private async load(quiet: boolean): Promise<void> {
    const seq = ++this.seq;
    if (!quiet && !this.data) this.screen = 'loading';
    try {
      const d = await boardApi().board({ department_id: this.dept || undefined });
      if (seq !== this.seq) return;
      this.data = d;
      this.now = new Date();
      this.lastOk = this.now;
      this.offline = false;
      this.screen = 'ready';
      this.rememberKpis();
      const key = this.dept;
      if (!quiet || key !== this.slowKey || Date.now() - this.slowAt >= SLOW_REFRESH_MS) {
        this.slowKey = key;
        this.slowAt = Date.now();
        void this.loadSlow();
      }
    } catch (e) {
      if (seq !== this.seq) return;
      if (this.data && !(e instanceof ApiError)) {
        this.offline = true; // no answer at all: the numbers stay, greyed, with the time they are from
        return;
      }
      if (quiet && this.data && e instanceof ApiError && e.status >= 500) return;
      this.fail(e);
    }
  }

  /** The ten-minute part: the requests for quotation (+ the detail of the awarded ones for their payment dates), the handled counts, the
   * claims waiting for approval. Each fails on its own; a refusal (no permission) is "nothing to show", not a failure. */
  private async loadSlow(): Promise<void> {
    const dept = this.dept || undefined;
    const rfq = ticketsRfqApi();
    const pages = Promise.all((['open', 'awarded', 'ordered'] as const).map((state) => rfq.list({ state, department_id: dept, limit: 100 })));
    void pages.then(async (ps) => {
      if (this.slowKey !== (dept ?? '')) return; // the viewer moved to another department meanwhile
      const all = ps.flatMap((p) => p.items);
      this.rfqs = all;
      this.rfqFailed = false;
      const awarded = all.filter((r) => r.state === 'awarded' || r.state === 'ordered').slice(0, DETAIL_CAP);
      const got = await Promise.all(awarded.map((r) => rfq.get(r.id).catch(() => null)));
      const next = new Map<string, RfqDetail>();
      for (const g of got) if (g) next.set(g.id, g);
      this.details = next;
    }).catch((e: unknown) => {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
        this.rfqs = [];
        this.rfqFailed = false;
      } else {
        this.rfqFailed = true;
      }
    });
    const period = readStoredPeriod();
    void boardApi().handlerLoad(period ?? undefined).then((r) => {
      const days = asHandledDays(r.days) ?? HANDLED_DEFAULT;
      this.handled = { days, counts: r.handled };
    }).catch(() => (this.handled = null));
    if (canAnywhere('tickets.costs.view')) {
      void ticketCostsApi().accountClaims({ status: ['submitted'], ...(dept ? { department: dept } : {}) })
        .then((r) => (this.approval = r.rows.length)).catch(() => (this.approval = null));
    } else {
      this.approval = null;
    }
  }

  private kpis(): Kpis {
    const d = this.data as BoardResponse;
    return { open: d.counts.all, stuck: d.counts.stuck, waiting: d.counts.waiting, overdue: overdueRows(d.items, this.rfqs ?? [], this.now).length, approval: this.approval };
  }

  /** The arrow against yesterday: the last numbers of each day, kept in this browser per view (all / one department). */
  private rememberKpis(): void {
    const key = `${KPI_STORE}${this.dept || 'all'}`;
    const { store, yesterday } = rollKpis(parseKpiStore(readStore(key)), this.kpis(), dayKey(this.now));
    writeStore(key, JSON.stringify(store));
    this.yesterday = yesterday;
  }

  private toggleFold(k: CardKey): void {
    const next = new Set(this.folded);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    this.folded = next;
    writeStore(FOLD_STORAGE_KEY, JSON.stringify([...next]));
  }

  private setDept(id: string): void {
    replaceRoute('/tickets/overview', id ? new URLSearchParams({ dept: id }) : undefined);
    this.dept = id;
    this.reason = '';
    this.allOverdue = false;
    void this.load(false);
  }

  private retrySlow = () => {
    this.slowAt = 0;
    void this.loadSlow();
  };

  // ---------------------------------------------------------------- render: pieces

  private href(patch: Parameters<typeof boardHref>[0] = {}, t?: string): string {
    return boardHref({ dept: this.dept, ...patch }, t ? { t } : {});
  }

  private widget(key: CardKey, title: string, q: string, body: TemplateResult, opts: { cls?: string; badge?: TemplateResult | typeof nothing } = {}): TemplateResult {
    const folded = this.folded.has(key);
    return html`<section class=${`glass w ${opts.cls ?? ''}${folded ? ' folded' : ''}`} data-widget=${key} id=${`w-${key}`}>
      <header><h2>${title}${opts.badge ?? nothing}</h2>${q ? html`<span class="q">${q}</span>` : nothing}
        <button type="button" class="fold" data-fold=${key} aria-expanded=${String(!folded)} aria-label=${ot(folded ? 'unfold' : 'fold', { name: title })} @click=${() => this.toggleFold(key)}>${tIcon('chevronDown')}</button></header>
      ${body}
    </section>`;
  }

  private quiet(text: string): TemplateResult {
    return html`<div class="body"><div class="quiet" data-quiet>${tIcon('check')}${text}</div></div>`;
  }

  private skeleton(rows: number, h: number): TemplateResult {
    return html`<div class="skel" aria-busy="true">${Array.from({ length: rows }, () => html`<span class="skl" style=${`block-size:${h}px`}></span>`)}</div>`;
  }

  private header(): TemplateResult {
    const d = this.data;
    const depts = d?.departments ?? [];
    const all = !!d?.all_departments;
    const total = depts.reduce((s, x) => s + x.count, 0);
    return html`<header class=${`dh${this.compactHeader ? ' compact' : ''}`} data-overview-header>
      ${this.offline && this.lastOk ? html`<div class="offline-top" role="status" data-offline>${tIcon('offline')}${ot('offline', { time: this.lastOk.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}</div>` : nothing}
      <div class="dh-row"><div class="titles"><div class="crumbs">${tt('area')}</div><h1 data-overview-title>${ot('title')}</h1></div></div>
      ${this.screen === 'ready' || this.screen === 'loading' ? html`<div class="dh-det">
        ${depts.length > 1 ? html`<div class="seg sm depts" role="radiogroup" aria-label=${ot('deptGroup')} data-dept-chips>
          <button type="button" role="radio" aria-checked=${String(!this.dept)} data-dept="" @click=${() => this.setDept('')}>${ot(all ? 'allDepts' : 'allMyDepts')}<small>${total}</small></button>
          ${depts.map((x) => html`<button type="button" role="radio" aria-checked=${String(this.dept === x.id)} data-dept=${x.id} @click=${() => this.setDept(x.id)}>${bidi(x.name)}<small>${x.count}</small></button>`)}
        </div>` : nothing}
        ${this.lastOk ? html`<span class="amb" data-updated>${ot('updated', { when: '' }).trim()} <em>${this.now.getTime() - this.lastOk.getTime() < 60_000 ? ot('justNow') : relTime(this.lastOk.toISOString(), this.now)}</em></span>` : nothing}
        <span class="grow"></span>
        <a class="btn sm hide-ph" href=${this.href()} data-to-board>${tIcon('ticket')}${ot('toBoard')}</a>
      </div>` : nothing}
    </header>`;
  }

  private kpiRow(): TemplateResult {
    if (this.screen === 'loading' || !this.data) return html`<div class="kpis" aria-busy="true">${Array.from({ length: 5 }, () => html`<span class="skl" style="block-size:76px;border-radius:14px"></span>`)}</div>`;
    const k = this.kpis();
    const deltas = kpiDeltas(k, this.yesterday);
    const truncated = this.data.truncated;
    const tile = (key: KpiKey, label: OverviewTextKey, tone: 'warn' | 'bad' | '', href: string | null, value: number, least = false) => {
      const dv = deltas[key];
      const inner = html`<small>${ot(label)}</small><b>${least && value ? html`<span class="least" data-at-least>${ot('atLeast', { n: '' }).trim()}</span>` : nothing}<span class="n">${value}</span>${dv ? html`<span class=${`d ${dv > 0 ? 'up' : 'down'}`} title=${ot(dv > 0 ? 'yesterdayUp' : 'yesterdayDown', { n: Math.abs(dv) })} data-delta=${dv}>${tIcon(dv > 0 ? 'up' : 'down')}<span class="n">${Math.abs(dv)}</span><span class="vh">${ot(dv > 0 ? 'yesterdayUp' : 'yesterdayDown', { n: Math.abs(dv) })}</span></span>` : nothing}</b>`;
      const cls = `kpi ${value ? tone : ''}`;
      return href
        ? html`<a class=${cls} href=${href} data-kpi=${key}>${inner}</a>`
        : html`<button type="button" class=${cls} data-kpi=${key} @click=${() => this.reveal('overdue')}>${inner}</button>`;
    };
    return html`<div class="kpis" data-kpis>
      ${tile('open', 'kOpen', '', this.href(), k.open)}
      ${tile('stuck', 'kStuck', 'warn', this.href({ state: 'stuck' }), k.stuck)}
      ${tile('waiting', 'kWaiting', '', this.href({ state: 'waiting' }), k.waiting)}
      ${tile('overdue', 'kOverdue', 'bad', null, k.overdue, truncated)}
      ${k.approval !== null ? tile('approval', 'kApproval', '', '#/tickets/accounts', k.approval) : nothing}
    </div>`;
  }

  private reveal(key: CardKey): void {
    if (this.folded.has(key)) this.toggleFold(key);
    void this.updateComplete.then(() => this.renderRoot.querySelector(`#w-${key}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }

  // card 2
  private whereStuck(): TemplateResult {
    const d = this.data as BoardResponse;
    if (!d.counts.stuck && !d.items.some((i) => i.stuck)) return this.quiet(ot('stNone'));
    const counts = stuckReasonCounts(d.items);
    const totalStuck = Object.values(counts).reduce((s, n) => s + n, 0);
    const rows = stuckPlaces(d.items, d.tree, this.reason);
    const max = Math.max(1, ...rows.map((r) => r.count));
    const dotOf: Record<StuckKind, string> = { unopened: 'bad', overdue: 'bad', ack: 'warn', stuck: 'warn', waiting: 'acc', unassigned: '' };
    return html`<div class="body">
      <div class="rooms" role="group" aria-label=${ot('stReasons')} data-reasons>
        <button type="button" class="rc" aria-pressed=${String(!this.reason)} data-reason="" @click=${() => (this.reason = '')}>${ot('stAll')}<small>${totalStuck}</small></button>
        ${STUCK_REASONS.filter((r) => counts[r]).map((r) => html`<button type="button" class="rc" aria-pressed=${String(this.reason === r)} data-reason=${r} @click=${() => (this.reason = this.reason === r ? '' : r)}>${ot(`rs_${r}` as OverviewTextKey)}<small>${counts[r]}</small></button>`)}
      </div>
      <div class="tree" role="list" aria-label=${ot('stTree')} data-places>
        ${rows.map((p) => html`<div class="place" role="listitem" data-place=${p.key}>
            <a class=${`row l${p.level}`} href=${this.href({ state: 'stuck', place: p.key })}><span class="nm">${p.kind === 'none' ? ot('noPlace') : bidi(p.name)}</span><span class="n">${p.count}</span></a>
            <div class="track" aria-hidden="true"><span style=${`inline-size:${Math.round((p.count / max) * 100)}%`}></span></div>
            <span class="mut">${p.level === 0 && p.open ? ot('stOfOpen', { n: p.open }) : ''}</span>
          </div>
          ${p.level === 0 && !this.reason ? html`<div class="why" data-why=${p.key}>${STUCK_REASONS.filter((r) => p.why[r]).map((r) => html`<span><i class=${`dot ${dotOf[r]}`}></i>${ot(`rs_${r}` as OverviewTextKey)} <span class="n">${p.why[r]}</span></span>`)}</div>` : nothing}`)}
      </div>
    </div>`;
  }

  // card 3
  private handlerList(rows: readonly HandlerRow[]): TemplateResult {
    const days = this.handled?.days;
    return html`<div class="crows">${rows.map((h) => {
      const ini = h.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('');
      return html`<a class="crow" href=${this.href({ assignee: h.key })} data-handler=${h.key} ?data-busy=${h.busy}>
        <span class=${`av${h.vendor ? ' ext' : ''}`} aria-hidden="true">${ini}</span>
        <span class="nm"><b>${bidi(h.name)}${h.vendor && this.settings().vendors === 'tagged' ? html`<span class="chip pur xs" data-vendor-tag>${ot('ldVendor')}</span>` : nothing}${h.busy ? html`<span class="chip warn xs" data-busy-tag>${ot('ldBusy')}</span>` : nothing}</b>
          <small>${h.open ? ot('ldOldest', { age: fmtDur(this.now.getTime() - Date.parse(h.oldestAt ?? '')) }) : ot('ldFree')}</small></span>
        <span class="st">
          <span class="cell"><span class="n">${h.open}</span><small>${ot('ldOpen')}</small></span>
          <span class=${`cell${h.waiting ? ' warn' : ''}`}><span class="n">${h.waiting}</span><small>${ot('ldWaiting')}</small></span>
          <span class=${`cell${h.stuck ? ' bad' : ''}`}><span class="n">${h.stuck}</span><small>${ot('ldStuck')}</small></span>
          ${days && h.handled !== undefined ? html`<span class="cell" data-handled><span class="n">${h.handled}</span><small>${ot('ldHandled')}</small></span>` : nothing}
        </span>
        <span class="ldc"><span class="load" role="img" aria-label=${ot('ldMeter', { on: h.meter, total: METER_SEGMENTS })}>${Array.from({ length: METER_SEGMENTS }, (_, i) => html`<i class=${i < h.meter ? (h.busy ? 'hot' : 'on') : ''}></i>`)}</span><small>${h.meter}/${METER_SEGMENTS}</small></span>
      </a>`;
    })}</div>`;
  }

  private loadCard(): { body: TemplateResult; busy: number } {
    const d = this.data as BoardResponse;
    const s = this.settings();
    const rows = handlerRows(d.items, this.vendorIds, s, this.handled?.counts ?? null);
    const busy = rows.filter((r) => r.busy).length;
    if (!rows.length) return { body: this.quiet(ot('ldNone')), busy };
    const { staff, vendors } = splitVendors(rows, s.vendors);
    const days = this.handled?.days;
    const head = html`<div class="hhead" aria-hidden="true"><span></span><span></span><span class="st"><span>${ot('ldOpen')}</span><span>${ot('ldWaiting')}</span><span>${ot('ldStuck')}</span>${days ? html`<span>${ot('ldHandled')} · ${bt(`hd_${days}` as BoardTextKey)}</span>` : nothing}</span><span class="ldc">${ot('ldLoad')}</span></div>`;
    return {
      busy,
      body: html`<div class="body" data-load-mode=${s.vendors}>
        ${head}
        ${s.vendors === 'separate' ? html`<div class="sect"><h4>${ot('ldStaff')} <span class="n">· ${staff.length}</span></h4>${this.handlerList(staff)}</div>
          ${vendors.length ? html`<div class="sect" data-vendor-list><h4>${ot('ldVendors')} <span class="n">· ${vendors.length}</span></h4>${this.handlerList(vendors)}</div>` : nothing}` : this.handlerList(staff)}
      </div>`,
    };
  }

  // card 4
  private whoWaits(): TemplateResult {
    const d = this.data as BoardResponse;
    const ls = lanes(d.items, this.vendorIds);
    if (!ls.some((l) => l.count)) return this.quiet(ot('wwNone'));
    const meta: Record<string, { label: OverviewTextKey; icon: 'user' | 'users' | 'truck'; cls: string; href: string }> = {
      me: { label: 'wwMe', icon: 'user', cls: 'me', href: this.href({ state: 'waiting' }) },
      staff: { label: 'wwStaff', icon: 'users', cls: '', href: this.href() },
      vendors: { label: 'wwVendors', icon: 'truck', cls: 'ext', href: this.href() },
    };
    const reasonLabel = (lane: string, key: string) => (lane === 'me' ? waitingLabel(key) : STUCK_REASONS.includes(key as StuckKind) ? ot(`rs_${key}` as OverviewTextKey) : '');
    return html`<div class="body"><div class="lanes">${ls.filter((l) => l.count || l.id === 'me').map((l) => {
      const m = meta[l.id];
      const why = l.reasons.map((r) => ({ t: reasonLabel(l.id, r.key), n: r.n })).filter((r) => r.t);
      return html`<a class="blk lane" href=${m.href} data-lane=${l.id}><span class=${`bi ${m.cls}`}>${tIcon(m.icon)}</span>
        <span class="bt"><b>${ot(m.label)}${l.oldestAt ? html`<span class="mut">${ot('wwOldest', { age: fmtDur(this.now.getTime() - Date.parse(l.oldestAt)) })}</span>` : nothing}</b>
          ${why.length ? html`<small>${why.map((r, i) => html`${i ? html`<span aria-hidden="true">·</span>` : nothing}<span>${r.t} · <span class="n">${r.n}</span></span>`)}</small>` : nothing}</span>
        <span class="big"><span class="n">${l.count}</span></span></a>`;
    })}</div></div>`;
  }

  // card 9
  private overdueCard(): { body: TemplateResult; count: number } {
    const d = this.data as BoardResponse;
    const rows = overdueRows(d.items, this.rfqs ?? [], this.now);
    if (!rows.length) return { body: this.quiet(ot('odNone')), count: 0 };
    const shown = this.allOverdue ? rows : rows.slice(0, OVERDUE_SHOWN);
    const what: Record<string, OverviewTextKey> = { sla: 'odSla', eta: 'odEta', rfq: 'odRfq' };
    return {
      count: rows.length,
      body: html`<div class="body"><div class="closedrows" data-overdue>${shown.map((r) => html`<a class="cr" href=${r.rfq ? rfqHref({ id: r.id }) : this.href({}, r.id)} data-overdue-row=${r.kind}>
          <span class="num">${r.ref}</span><b>${bidi(r.title)}<small><span class=${`cwarn ${r.tone}`}>${tIcon('clock')}${ot('odBy', { what: ot(what[r.kind]), dur: fmtDur(r.late) })}</span></small></b>
          <span class="who">${r.who ? bidi(r.who) : ot('odNobody')}</span><span class="back">${tIcon('back')}</span></a>`)}</div>
        ${rows.length > OVERDUE_SHOWN ? html`<div><button type="button" class="btn sm" aria-expanded=${String(this.allOverdue)} data-overdue-all @click=${() => (this.allOverdue = !this.allOverdue)}>${this.allOverdue ? ot('showLess') : ot('showAll')}<small class="mut">· ${rows.length}</small></button></div>` : nothing}
        ${d.truncated ? html`<div class="note" data-truncated>${ot('truncated', { n: d.items.length })}</div>` : nothing}
      </div>`,
    };
  }

  // card 10
  private agendaCard(): TemplateResult {
    const d = this.data as BoardResponse;
    const pays = paymentDates([...this.details.values()]);
    const days = agenda(d.items, this.rfqs ?? [], this.details, pays, this.vendorIds, this.now);
    const label: Record<AgendaEntry['kind'], OverviewTextKey> = { visit_vendor: 'agVisitVendor', visit_staff: 'agVisitStaff', work_start: 'agWorkStart', rfq_due: 'agRfqDue', payment: 'agPayment' };
    const dot: Record<AgendaEntry['kind'], string> = { visit_vendor: 'acc', visit_staff: 'acc', work_start: 'ok', rfq_due: 'pur', payment: 'warn' };
    const dayTitle = (key: string, offset: number) => {
      const [y, m, dd] = key.split('-').map(Number);
      const date = new Date(y, m - 1, dd).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'numeric' });
      return offset === 0 ? `${ot('agToday')} · ${date}` : offset === 1 ? `${ot('agTomorrow')} · ${date}` : date;
    };
    const partial = this.rfqFailed ? html`<div class="unavail" data-partial>${ot('agRfqPartial')}<button type="button" class="btn sm" @click=${this.retrySlow}>${tIcon('refresh')}${ot('retry')}</button></div>` : nothing;
    if (!days.length) return html`${partial}${this.quiet(ot('agNone'))}`;
    return html`<div class="body" data-agenda>${partial}${days.map((day) => html`<div class="sect day" data-day=${day.key}><h4><span class=${day.offset === 0 ? 'today' : ''}>${dayTitle(day.key, day.offset)}</span></h4>
      <div class="closedrows">${day.entries.map((e) => html`<a class="cr" href=${e.rfq ? rfqHref({ id: e.id }) : this.href({}, e.id)} data-agenda-row=${e.kind}>
        <span class="num">${e.timed ? new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ot('agAllDay')}</span>
        <b><i class=${`dot ${dot[e.kind]}`}></i> ${ot(label[e.kind])}<small>${[e.who, `${e.ref} · ${e.title}`, e.place].filter(Boolean).map((x) => bidi(x)).join(' · ')}</small></b>
        <span></span><span class="back">${tIcon('back')}</span></a>`)}</div></div>`)}</div>`;
  }

  // card 11 (phase 1, from the board)
  private departmentsCard(): TemplateResult {
    const d = this.data as BoardResponse;
    const rows = deptComparison(d.items, d.departments, this.vendorIds, this.settings(), this.now);
    const go = (id: string) => `#/tickets/overview?${new URLSearchParams({ dept: id }).toString()}`;
    return html`<div class="body" data-compare>
      <table class="rtbl"><thead><tr><th>${ot('cmpDept')}</th><th class="num">${ot('cmpOpen')}</th><th class="num">${ot('cmpStuck')}</th><th class="num">${ot('cmpOverdue')}</th><th class="num">${ot('cmpWaiting')}</th><th class="num">${ot('cmpBusy')}</th></tr></thead>
        <tbody>${rows.map((r) => html`<tr data-dept-row=${r.id}><td><a class="tl" href=${go(r.id)}>${bidi(r.name)}</a></td><td class="num"><span class="n">${r.open}</span></td><td class=${`num${r.stuck > 2 ? ' bad' : ''}`}><span class="n">${r.stuck}</span></td><td class=${`num${r.overdue > 2 ? ' bad' : ''}`}><span class="n">${r.overdue}</span></td><td class="num"><span class="n">${r.waiting}</span></td><td class="num"><span class="n">${r.busy}</span></td></tr>`)}</tbody></table>
      <div class="dcards">${rows.map((r) => html`<a class="dcard" href=${go(r.id)} data-dept-card=${r.id}><b>${bidi(r.name)}</b><span class="nums"><span>${ot('cmpOpen')} <em>${r.open}</em></span><span>${ot('cmpStuck')} <em>${r.stuck}</em></span><span>${ot('cmpOverdue')} <em>${r.overdue}</em></span><span>${ot('cmpWaiting')} <em>${r.waiting}</em></span><span>${ot('cmpBusy')} <em>${r.busy}</em></span></span></a>`)}</div>
    </div>`;
  }

  private stateBox(icon: Parameters<typeof tIcon>[0], title: string, kind: string, action?: TemplateResult): TemplateResult {
    return html`<div class="statebox glass" role="status" data-overview-state=${kind}><span class="ring">${tIcon(icon)}</span><b>${title}</b>${action ?? nothing}</div>`;
  }

  private loadingGrid(): TemplateResult {
    const card = (cls: string, rows: number, h: number) => html`<section class=${`glass w ${cls}`}><header><span class="skl" style="block-size:20px;inline-size:40%"></span></header>${this.skeleton(rows, h)}</section>`;
    return html`<div class="wgrid" data-overview-state="loading">${card('wide', 5, 40)}${card('', 3, 56)}${card('wide', 5, 52)}${card('', 4, 44)}${card('full', 4, 44)}</div>`;
  }

  private body(): TemplateResult {
    switch (this.screen) {
      case 'loading':
        return html`${this.kpiRow()}${this.loadingGrid()}`;
      case 'off':
        return this.stateBox('ticket', tt('moduleOff'), 'off');
      case 'forbidden':
        return this.stateBox('lock', ot('notManager'), 'forbidden');
      case 'error':
        return this.stateBox('warning', ot('loadFailed'), 'error', html`<button type="button" class="btn sm" data-retry @click=${() => { this.screen = 'loading'; this.data = null; void this.boot(); }}>${tIcon('refresh')}${ot('retry')}</button>`);
      default:
        break;
    }
    const d = this.data as BoardResponse;
    if (!d.counts.all && !d.counts.closed_all && !d.items.length) {
      return this.stateBox('ticket', ot('emptyAll'), 'empty', this.meta?.can.create ? html`<a class="btn primary" href=${listHref('mine', NO_FILTERS, { create: true })} data-new>${tIcon('plus')}${ot('newTicket')}</a>` : undefined);
    }
    const s = this.settings();
    const compare = d.all_departments && !this.dept && d.departments.length > 1 ? this.widget('departments', ot('cmpTitle'), ot('cmpQ'), this.departmentsCard(), { cls: 'full' }) : nothing;
    const load = this.loadCard();
    const od = this.overdueCard();
    const stuckN = d.counts.stuck;
    return html`
      ${s.compare === 'top' ? html`<div class="wgrid">${compare}</div>` : nothing}
      ${this.kpiRow()}
      <div class="wgrid">
        ${s.compare === 'below_numbers' ? compare : nothing}
        ${this.widget('stuck', ot('stTitle'), ot('stQ'), this.whereStuck(), { cls: 'wide', badge: stuckN ? html` <span class="cnt" data-count>${stuckN}</span>` : nothing })}
        ${this.widget('waits', ot('wwTitle'), ot('wwQ'), this.whoWaits())}
        ${this.widget('load', ot('ldTitle'), ot('ldQ'), load.body, { cls: 'wide', badge: load.busy ? html` <span class="cnt bad" data-count>${ot('ldBusyCount', { n: load.busy })}</span>` : nothing })}
        ${this.widget('overdue', ot('odTitle'), ot('odQ'), od.body, { badge: od.count ? html` <span class="cnt bad" data-count>${od.count}</span>` : nothing })}
        ${this.widget('upcoming', ot('agTitle'), ot('agQ'), this.agendaCard(), { cls: 'full' })}
        ${s.compare === 'bottom' ? compare : nothing}
      </div>`;
  }

  render() {
    return html`<div class=${`page${this.offline ? ' stale' : ''}`} data-screen="tickets-overview">
      ${this.header()}
      ${this.body()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-overview': TicketsOverview;
  }
}
