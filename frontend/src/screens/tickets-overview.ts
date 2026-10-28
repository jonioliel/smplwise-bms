import { LitElement, html, svg, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
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
import { dashboardApi, DASH_PERIODS, type DashboardResponse, type DashPeriod, type PayClaim, type PayInstalment, type PaymentsResponse, type SecondApproval, type TicketApproval } from '../api/tickets-dashboard';
import { boardHref, fmtDur, waitingLabel } from '../tickets/board-model';
import { rfqHref } from '../tickets/rfq-model';
import { listHref, NO_FILTERS, relTime } from '../tickets/model';
import { bt, type BoardTextKey } from '../tickets/board-text';
import { tt, ticketsLang } from '../tickets/text';
import { tIcon } from '../tickets/icons';
import { onTicketNames, setTicketNames } from '../tickets/naming';
import { LiveRefresh } from '../tickets/live-refresh';
import { formatMoney } from '../tickets/cost-model';
import { asHandledDays, HANDLED_DEFAULT, installationHandledDays, readStoredPeriod, storePeriod, type HandledDays } from '../tickets/handler-load';
import { ot, type OverviewTextKey } from '../tickets/overview-text';
import {
  agenda, APPROVALS_SHOWN, approvalsTotal, dailyTotals, dayKey, daysOfPeriod, deptComparison, FOLD_STORAGE_KEY, foldedOf, handlerRows, kpiDeltas, lanes, METER_SEGMENTS,
  overdueRows, OVERDUE_SHOWN, overviewSettingsOf, packPages, filledSpans, parseKpiStore, paymentDates, paymentOverdueRows, paymentsTotal, payWhen, periodOfDays, rfqStageOf, rollKpis, serverPaymentDates, shortDay, signed, sortDepartments, splitVendors,
  STUCK_REASONS, stuckPlaces, stuckReasonCounts,
  type AgendaEntry, type CardKey, type HandlerRow, type KpiKey, type Kpis, type OverviewSettings,
} from '../tickets/overview-model';
import { timeText, dayMonthText } from '../api/day-format';

type Screen = 'loading' | 'ready' | 'error' | 'forbidden' | 'off';
/** OVERVIEWFIT-297: a drawn widget with what the pages need - its grid span, its title (the pager's labels) and whether it carries a red count */
interface OverviewWidget { key: CardKey; title: string; span: number; alert: boolean; fill?: number; make: (span?: number) => TemplateResult }

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
 * The server's single visibility rule decides every row of every answer; nothing here filters for security. Phase 3 (DASH3-290) reads the
 * phase-2 summary route GET /tickets/dashboard with the board every minute and draws its cards: 5 how much was handled (the period shared
 * with the handler cards), 6 opened vs closed (bars + a table for screen readers), 7 waiting for my approval (amounts only as the server
 * sends them), 8 the requests for quotation to decide, 11 the department comparison; the "waiting for my approval" number of the numbers
 * row counts the summary's three groups. A failed summary leaves the board's cards and says "not available" on its own cards only.
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
  /** phase 3: the summary route (cards 5-8 and 11); null until the first answer */
  @state() private summary: DashboardResponse | null = null;
  @state() private summaryFailed = false;
  /** the period of "כמה טופל" - the viewer's remembered handled period (shared with the handler cards), else the installation default */
  @state() private period: DashPeriod | null = null;
  @state() private expanded: Set<CardKey> = new Set();
  /** phase 4: the payments board (GET /tickets/dashboard/payments) - only for a manager who may pay somewhere; null = not read / not shown */
  @state() private payments: PaymentsResponse | null = null;
  @state() private paymentsFailed = false;
  /** OVERVIEWFIT-297: on a desktop the widgets are cut into pages of two rows (no page scroll); the page on screen */
  @state() private paged = TicketsOverview.pagedMq.matches;
  @state() private pageIdx = 0;
  private pageOfKey = new Map<CardKey, number>();
  private pageCount = 0;
  /** the paged board: a desktop wide enough for the three-column grid and tall enough for two rows; anything smaller scrolls as before
   * (the tablet and the phone layouts are unchanged) */
  static readonly pagedMq = window.matchMedia('(min-width: 1181px) and (min-height: 700px)');
  private onPaged = () => {
    this.paged = TicketsOverview.pagedMq.matches;
    this.pageIdx = 0;
  };
  private seq = 0;
  private sumSeq = 0;
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
    /* POLISH-CONTROL-297: the number tile is a link - it answers hover (fine pointers only), the press and the keyboard (it had a pointer
       cursor and nothing else); transform and colour only, token durations - zero under reduced motion */
    .kpi { transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease); }
    .kpi:active { transform: scale(0.98); }
    .kpi:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: 2px; }
    .kpi small { font-size: var(--sw-fs-sm); color: var(--dv-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* round 2 (dataviz hero number): the tile's number at display size, heavy and tight; the word stays a quiet line */
    .kpi b { font-size: var(--sw-fs-4xl); font-weight: 800; letter-spacing: -0.03em; line-height: 1; font-variant-numeric: tabular-nums; color: var(--dv-text); overflow-wrap: anywhere; display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 6px; }
    .kpi { gap: 6px; padding: 16px 20px; }
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
    .w > header h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-xl); font-weight: 700; letter-spacing: -0.015em; line-height: 1.25; min-inline-size: 0; }
    .w > header .q { font-size: var(--sw-fs-sm); font-weight: 500; color: var(--dv-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-inline-size: 0; }
    .w > header .fold { all: unset; box-sizing: border-box; margin-inline-start: auto; display: grid; place-items: center; inline-size: 32px; block-size: 32px; border-radius: 50%; color: var(--dv-text-3); cursor: pointer; flex: none; }
    .w > header .fold { transition: background-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease); }
    .w > header .fold:active { transform: scale(0.92); }
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
    /* round 2 loop 1 (impeccable harden): a widget's "not available now" is a tinted field with its retry, not a grey line in an empty card */
    .unavail { display: flex; align-items: center; gap: 10px; min-block-size: 52px; padding: 10px 14px; border-radius: var(--sw-r-lg); background: color-mix(in srgb, var(--dv-text) 5%, transparent); font-size: var(--sw-fs-base); font-weight: 600; color: var(--dv-text-2); }
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
    .tree .row { transition: background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease); }
    .tree .row:active { transform: scale(0.99); }
    .tree .row:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: -2px; }
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
    .crow { transition: background-color var(--sw-t-fast) var(--sw-ease); }
    .crow:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: -2px; }
    .crow b { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; font-weight: 700; }
    .crow .nm small { display: block; color: var(--dv-text-3); font-size: var(--sw-fs-xs); }
    .av { display: inline-grid; place-items: center; flex: none; inline-size: 36px; block-size: 36px; border-radius: 50%; font-weight: 800; font-size: var(--sw-fs-sm); background: var(--dv-accent-soft); color: var(--dv-accent-text); }
    .av.ext { color: var(--au-warn-text); background: var(--dv-warning-soft); }
    .st { display: flex; gap: 0; }
    .cell { font-size: var(--sw-fs-md); color: var(--dv-text); font-variant-numeric: tabular-nums; min-inline-size: 58px; text-align: center; }
    .cell small { display: none; font-size: var(--sw-fs-xs); color: var(--dv-text-3); }
    .cell.bad { color: var(--dv-danger); font-weight: 700; }
    .cell.warn { color: var(--au-warn-text); font-weight: 700; }
    .ldc { min-inline-size: 70px; display: grid; justify-items: center; gap: 3px; }
    .ldc small { font-size: var(--sw-fs-xs); color: var(--dv-text-3); }
    .load { display: inline-flex; gap: 3px; align-items: center; }
    .load i { inline-size: 14px; block-size: 6px; border-radius: var(--sw-r-pill); background: var(--dv-surface-3); }
    .load i.on { background: var(--dv-accent); }
    .load i.hot { background: var(--dv-danger); }
    /* POLISH-CONTROL-297: the column heads of the handler table one step up from the smallest size (the audit's 10 px tier) */
    .hhead { display: grid; grid-template-columns: 36px minmax(0, 1.4fr) auto auto; gap: 12px; padding-inline: 6px; font-size: var(--sw-fs-xs); color: var(--dv-text-2); }
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
    .lane .big { font-size: var(--sw-fs-3xl); font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--dv-text); min-inline-size: 32px; text-align: center; }
    .lane .bi.me { background: var(--dv-accent-soft); color: var(--dv-accent-text); }
    .lane .bi.ext { background: color-mix(in srgb, var(--sw-purple) 16%, transparent); color: color-mix(in srgb, var(--sw-purple) 68%, var(--dv-text)); }
    /* rows: overdue and the agenda */
    .closedrows { display: flex; flex-direction: column; padding: 4px 0; }
    .closedrows .cr { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 6px 14px; min-block-size: 44px; padding: 6px 10px; color: var(--dv-text); font-size: var(--sw-fs-base); text-align: start; text-decoration: none; border-radius: var(--sw-r-lg); }
    .closedrows .cr + .cr { border-block-start: 1px solid var(--dv-border); }
    .closedrows .cr { transition: background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease); }
    .closedrows .cr:active { transform: scale(0.99); }
    .closedrows .cr:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: -2px; }
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
    /* phase 3: how much was handled, opened vs closed, waiting for my approval, requests for quotation */
    .w > header .pseg { margin-inline-start: auto; flex: none; }
    .w > header .pseg + .fold { margin-inline-start: 4px; }
    .rtbl.tp td.who { font-weight: 600; max-inline-size: 0; inline-size: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rtbl.tp td.mut { color: var(--dv-text-2); font-size: var(--sw-fs-sm); }
    .rtbl tfoot td { font-weight: 700; border-block-start: 1px solid var(--dv-border-strong, var(--dv-border)); border-block-end: 0; }
    .net { font-size: var(--sw-fs-sm); color: var(--dv-text-2); }
    .bars { display: grid; gap: 6px; }
    .bars svg { inline-size: 100%; block-size: 132px; display: block; overflow: visible; }
    .bars .bo { fill: var(--dv-accent); }
    .bars .bc { fill: var(--dv-success, var(--sw-success)); }
    .bars .bl { font-size: var(--sw-fs-2xs); text-anchor: middle; fill: var(--dv-text-2); }
    .bars .ax { font-size: var(--sw-fs-2xs); text-anchor: middle; fill: var(--dv-text-3); }
    .bars .base { stroke: var(--dv-border); }
    .bars .lg { display: flex; gap: 14px; font-size: var(--sw-fs-xs); color: var(--dv-text-2); }
    .bars .lg span { display: inline-flex; align-items: center; gap: 5px; }
    .bars .lg i { inline-size: 10px; block-size: 10px; border-radius: 3px; display: inline-block; }
    .bars .lg i.o { background: var(--dv-accent); }
    .bars .lg i.c { background: var(--dv-success, var(--sw-success)); }
    .closedrows .cr .amt { font-weight: 700; color: var(--dv-text); white-space: nowrap; }
    .closedrows .cr .tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
    .closedrows .cr .tags .chip .ic { font-size: var(--sw-fs-xs); }
    .dcard.total { background: transparent; }
    /* phase 4: an instalment row - the title takes the line, the due chip and the amount the line under it (the card is a third wide) */
    .closedrows .cr[data-pay-row='instalment'] { grid-template-columns: auto minmax(0, 1fr) auto; }
    .closedrows .cr[data-pay-row='instalment'] .tags { grid-column: 2; grid-row: 2; justify-content: flex-start; align-items: center; gap: 8px; }
    .closedrows .cr[data-pay-row='instalment'] .back { grid-column: 3; grid-row: 1 / span 2; }
    .vh { position: absolute !important; inline-size: 1px; block-size: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    /* OVERVIEWFIT-297 (owner rule: a control screen never scrolls on a desktop; owner option א): on a desktop (.paged, set from
       TicketsOverview.pagedMq) the screen takes the window's height; the widgets keep their order and grid spans and are cut into pages
       of two rows that fill what is left under the numbers row; the pages sit side by side in a track that snaps page by page (the
       pager, a swipe, a trackpad, the keyboard focus). A long widget scrolls inside its own card. Elsewhere .wb is transparent and the
       page scrolls as before (tablet, phone, a short window). */
    .wb { display: contents; }
    .page.paged { block-size: 100%; min-block-size: 0; box-sizing: border-box; padding-block-end: 0; }
    .paged .wpages { flex: 1 1 auto; min-block-size: 420px; display: grid; grid-auto-flow: column; grid-auto-columns: 100%; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: none; margin-inline: -36px; outline: none; }
    .paged .wpages::-webkit-scrollbar { display: none; }
    .paged .pg { box-sizing: border-box; min-inline-size: 0; min-block-size: 0; padding: 2px 36px 22px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: var(--dv-gap-lg, 18px); scroll-snap-align: start; scroll-snap-stop: always; }
    .paged .pg > .w { min-block-size: 0; overflow: hidden; }
    .paged .pg > .w.folded { align-self: start; }
    .paged .w > .wb { flex: 1 1 auto; min-block-size: 0; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; overscroll-behavior-y: contain; scrollbar-width: thin; margin-inline: -6px; padding-inline: 6px; padding-block-end: 14px; -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent); mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent); }
    /* break-ui: a reference number never splits over two lines in a third-wide card */
    .closedrows .cr .num { white-space: nowrap; }
    .paged .wgrid.top > .w { max-block-size: 30vh; overflow: hidden; }
    .paged .wgrid.top > .w > .wb { flex: 1 1 auto; min-block-size: 0; overflow-y: auto; scrollbar-width: thin; display: flex; flex-direction: column; gap: 12px; }
    /* many departments: one row that scrolls sideways (the controls row never grows into the widgets' room) */
    .paged .dh-det { flex-wrap: nowrap; }
    .paged .dh-det .depts { flex: 0 1 auto; min-inline-size: 0; overflow-x: auto; scrollbar-width: none; }
    .paged .dh-det .depts.over:dir(rtl) { -webkit-mask-image: linear-gradient(to left, transparent, #000 28px); mask-image: linear-gradient(to left, transparent, #000 28px); }
    .paged .dh-det .depts.over:dir(ltr) { -webkit-mask-image: linear-gradient(to right, transparent, #000 28px); mask-image: linear-gradient(to right, transparent, #000 28px); }
    .paged .dh-det .depts > button { flex: none; }
    .paged .dh-det .amb { white-space: nowrap; }
    .pager { display: inline-flex; align-items: center; gap: 2px; flex: none; }
    .pager .pgb { all: unset; box-sizing: border-box; display: grid; place-items: center; inline-size: 34px; block-size: 34px; border-radius: 50%; color: var(--dv-text-2); cursor: pointer; }
    .pager .pgb .ic { font-size: var(--sw-fs-lg); }
    .pager .pgb.next .ic { transform: scaleX(-1); }
    .pager:dir(ltr) .pgb.prev .ic { transform: scaleX(-1); }
    .pager:dir(ltr) .pgb.next .ic { transform: none; }
    .pager .pgb { transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1), background-color 140ms ease; }
    .pager .pgb:active:not([disabled]) { transform: scale(0.94); }
    /* mobile-native: a large touch screen (an iPad Pro in landscape) also gets the pages - no tap flash, no double-tap delay, no label selection */
    .pager .pgb, .pager .pd { touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
    .pager .pgb[disabled] { opacity: 0.35; cursor: default; }
    .pager .pds { display: inline-flex; align-items: center; }
    .pager .pd { all: unset; box-sizing: border-box; display: grid; place-items: center; min-inline-size: 24px; block-size: 34px; padding-inline: 2px; cursor: pointer; }
    .pager .pd i { display: block; inline-size: 8px; block-size: 8px; border-radius: var(--sw-r-pill); background: var(--dv-border-strong, var(--dv-text-3)); transition: inline-size 180ms cubic-bezier(0.23, 1, 0.32, 1), background-color 180ms ease; }
    .pager .pd.alert i { background: var(--dv-danger); }
    .pager .pd[aria-current='page'] i { inline-size: 22px; background: var(--dv-accent); }
    @media (hover: hover) and (pointer: fine) {
      .pager .pgb:hover:not([disabled]) { background: var(--dv-surface-3); color: var(--dv-text); }
      .pager .pd:hover i { background: var(--dv-text-2); }
      .pager .pd[aria-current='page']:hover i { background: var(--dv-accent); }
    }
    .pager .pgb:focus-visible, .pager .pd:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: 2px; border-radius: var(--sw-r-pill); }
    .pager .pgn { font-size: var(--sw-fs-sm); color: var(--dv-text-2); font-weight: 600; min-inline-size: 30px; text-align: center; }
    @media (pointer: coarse) {
      .pager .pgb { inline-size: 44px; block-size: 44px; }
      .pager .pd { block-size: 44px; }
    }
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
      .bars svg { block-size: 110px; }
      .closedrows .cr.ap { grid-template-columns: auto minmax(0, 1fr) auto; }
      .closedrows .cr.ap .back, .closedrows .cr.rq .back { display: none; }
      .closedrows .cr.rq { grid-template-columns: auto minmax(0, 1fr); }
      .closedrows .cr.rq .tags { grid-column: 2; justify-content: flex-start; }
      .closedrows .cr[data-pay-row] .back { display: none; }
      .w > header .pseg button { min-block-size: 36px; }
    }
    @media (pointer: coarse) {
      .tree .row, .closedrows .cr, .tl { min-block-size: 44px; }
    }
    /* POLISH-CONTROL-297: hover is for fine pointers only - a touch never leaves a tile, a row or the fold button lit */
    @media (hover: hover) and (pointer: fine) {
      .kpi:hover { border-color: var(--dv-border-strong, var(--dv-border)); box-shadow: var(--dv-shadow-2); }
      .w > header .fold:hover { background: var(--dv-surface-3); color: var(--dv-text); }
      .tree .row:hover { background: color-mix(in srgb, var(--dv-text) 6%, transparent); }
      .crow:hover { background: var(--dv-surface-2); }
      .closedrows .cr:hover { background: var(--dv-surface-3); }
    }
    @media (prefers-reduced-motion: reduce) {
      .w > header .fold .ic { transition: none; }
      .kpi, .tree .row, .crow, .closedrows .cr, .w > header .fold { transition: none; }
      .pager .pd i, .pager .pgb { transition: none; }
    }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.phoneMq.addEventListener('change', this.onPhone);
    TicketsOverview.pagedMq.addEventListener('change', this.onPaged);
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
    TicketsOverview.pagedMq.removeEventListener('change', this.onPaged);
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
        this.summary = null;
        this.summaryFailed = false;
        if (this.screen === 'ready') void this.load(false);
      }
    }
  }

  protected updated(): void {
    measureHeaderBar(this.renderRoot, this.phone);
    // a widget set that shrank (another department, a widget that left) leaves no empty page on screen
    if (this.paged && this.pageCount && this.pageIdx >= this.pageCount) this.goPage(this.pageCount - 1, false);
    // break-ui: a departments row longer than the room fades at its end (it scrolls sideways); a row that fits keeps its edge
    const seg = this.renderRoot.querySelector<HTMLElement>('[data-dept-chips]');
    seg?.classList.toggle('over', this.paged && seg.scrollWidth > seg.clientWidth + 1);
  }

  // ---------------------------------------------------------------- pages (OVERVIEWFIT-297)

  private track(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('[data-overview-pages]');
  }

  /** Shows page `i`: the track scrolls by whole pages (it snaps there anyway); RTL scrolls towards negative offsets. */
  private goPage(i: number, smooth = true): void {
    const n = Math.max(1, this.pageCount);
    const next = Math.min(n - 1, Math.max(0, i));
    this.pageIdx = next;
    const tr = this.track();
    if (!tr) return;
    const sign = getComputedStyle(tr).direction === 'rtl' ? -1 : 1;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    tr.scrollTo({ left: sign * next * tr.clientWidth, behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }

  /** The page on screen follows the track: a swipe, a trackpad, the keyboard focus moving into a widget of another page. */
  private onTrack = (e: Event) => {
    const tr = e.currentTarget as HTMLElement;
    const i = Math.round(Math.abs(tr.scrollLeft) / Math.max(1, tr.clientWidth));
    if (i !== this.pageIdx && i < this.pageCount) this.pageIdx = i;
  };

  /** The pager's keys: the arrows in the reading direction (RTL: left = next), Home and End. */
  private onPagerKey = (e: KeyboardEvent) => {
    const rtl = getComputedStyle(this).direction === 'rtl';
    const step = e.key === 'ArrowLeft' ? (rtl ? 1 : -1) : e.key === 'ArrowRight' ? (rtl ? -1 : 1) : 0;
    let to = -1;
    if (step) to = this.pageIdx + step;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = this.pageCount - 1;
    if (to < 0 || to >= this.pageCount) return;
    e.preventDefault();
    this.goPage(to, false); // a key press moves at once (no animation on a keyboard action)
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(`[data-page-dot="${to}"]`)?.focus());
  };

  private pager(pages: readonly (readonly OverviewWidget[])[]): TemplateResult | typeof nothing {
    if (pages.length < 2) return nothing;
    const of = pages.length;
    const idx = Math.min(this.pageIdx, of - 1);
    return html`<div class="pager" role="group" aria-label=${ot('pagesGroup')} data-overview-pager @keydown=${this.onPagerKey}>
      <button type="button" class="pgb prev" data-page-prev ?disabled=${idx === 0} aria-label=${ot('pagePrev')} title=${ot('pagePrev')} @click=${() => this.goPage(idx - 1)}>${tIcon('back')}</button>
      <span class="pds">${pages.map((p, i) => html`<button type="button" class=${`pd${p.some((w) => w.alert) ? ' alert' : ''}`} data-page-dot=${i} aria-current=${i === idx ? 'page' : 'false'}
        aria-label=${ot('pageDot', { n: i + 1, of, names: p.map((w) => w.title).join(', ') }) + (p.some((w) => w.alert) ? ` · ${ot('pageAlert')}` : '')} title=${p.map((w) => w.title).join(' · ')} @click=${() => this.goPage(i)}><i></i></button>`)}</span>
      <span class="pgn" aria-hidden="true"><span class="n">${idx + 1}/${of}</span></span>
      <button type="button" class="pgb next" data-page-next ?disabled=${idx >= of - 1} aria-label=${ot('pageNext')} title=${ot('pageNext')} @click=${() => this.goPage(idx + 1)}>${tIcon('back')}</button>
    </div>`;
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
      void this.loadSummary(quiet);
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
    void this.loadPayments();
  }

  /** Phase 4: who may pay (tickets.costs + view somewhere) reads the payments board with the ten-minute part; a refusal = not shown. */
  private mayPay(): boolean {
    return canAnywhere('tickets.costs.view') && canAnywhere('tickets.costs');
  }

  private async loadPayments(): Promise<void> {
    if (!this.mayPay()) {
      this.payments = null;
      this.paymentsFailed = false;
      return;
    }
    const dept = this.dept;
    try {
      const p = await dashboardApi().payments({ department_id: dept || undefined });
      if (dept !== this.dept) return;
      this.payments = p;
      this.paymentsFailed = false;
      if (this.data) this.rememberKpis();
    } catch (e) {
      if (dept !== this.dept) return;
      if (e instanceof ApiError && e.status === 403) {
        this.payments = null;
        this.paymentsFailed = false;
      } else if (!this.payments) {
        this.paymentsFailed = true;
      }
    }
  }

  private retryPayments = () => {
    this.paymentsFailed = false;
    void this.loadPayments();
  };

  /** Card 9: the board's and the requests' rows, plus the instalments past their day (phase 4, when the payments board answered). */
  private allOverdueRows() {
    const d = this.data as BoardResponse;
    const rows = overdueRows(d.items, this.rfqs ?? [], this.now);
    if (!this.payments?.overdue.items.length) return rows;
    return [...rows, ...paymentOverdueRows(this.payments.overdue.items, this.now)]
      .sort((a, b) => Number(b.tone === 'bad') - Number(a.tone === 'bad') || b.late - a.late);
  }

  /** The period shown by "כמה טופל": the viewer's choice (remembered with the handler cards' period), else the installation default. */
  private chosenPeriod(): DashPeriod {
    return this.period ?? periodOfDays(readStoredPeriod() ?? installationHandledDays(this.module?.ui as { handled_days?: unknown } | undefined));
  }

  /**
   * Phase 3: the summary route, read with the board (every minute while visible; the server keeps the answer 30 seconds per caller). A
   * failure keeps the last answer on a quiet refresh; without one the cards of this route say "not available" (the board's cards stay).
   */
  private async loadSummary(quiet: boolean): Promise<void> {
    const seq = ++this.sumSeq;
    const dept = this.dept;
    const period = this.chosenPeriod();
    try {
      const s = await dashboardApi().summary({ department_id: dept || undefined, period });
      if (seq !== this.sumSeq) return;
      this.summary = s;
      this.summaryFailed = false;
      if (this.data) this.rememberKpis();
    } catch {
      if (seq !== this.sumSeq) return;
      if (quiet && this.summary && this.summary.department_id === (dept || null)) return;
      this.summary = null;
      this.summaryFailed = true;
    }
  }

  private setPeriod(p: DashPeriod): void {
    if (p === this.chosenPeriod() && this.summary?.period === p) return;
    this.period = p;
    storePeriod(daysOfPeriod(p));
    void this.loadSummary(false);
    // the handler cards' "handled" number follows the same remembered period
    void boardApi().handlerLoad(daysOfPeriod(p)).then((r) => (this.handled = { days: asHandledDays(r.days) ?? HANDLED_DEFAULT, counts: r.handled })).catch(() => (this.handled = null));
  }

  private retrySummary = () => {
    this.summaryFailed = false;
    void this.loadSummary(false);
  };

  private kpis(): Kpis {
    const d = this.data as BoardResponse;
    const approval = this.summary ? approvalsTotal(this.summary.approvals) : this.approval;
    return { open: d.counts.all, stuck: d.counts.stuck, waiting: d.counts.waiting, overdue: this.allOverdueRows().length, approval };
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
    this.summary = null;
    this.summaryFailed = false;
    this.payments = null;
    this.paymentsFailed = false;
    this.expanded = new Set();
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

  private widget(key: CardKey, title: string, q: string, body: TemplateResult, opts: { cls?: string; badge?: TemplateResult | typeof nothing; extra?: TemplateResult; span?: number } = {}): TemplateResult {
    const folded = this.folded.has(key);
    // OVERVIEWFIT-297: on a desktop page the last widget of a short row widens to the row's end (no empty cell)
    return html`<section class=${`glass w ${opts.cls ?? ''}${folded ? ' folded' : ''}`} data-widget=${key} id=${`w-${key}`} style=${opts.span ? `grid-column: span ${opts.span}` : nothing}>
      <header><h2>${title}${opts.badge ?? nothing}</h2>${q ? html`<span class="q">${q}</span>` : nothing}${opts.extra && !folded ? opts.extra : nothing}
        <button type="button" class="fold" data-fold=${key} aria-expanded=${String(!folded)} aria-label=${ot(folded ? 'unfold' : 'fold', { name: title })} @click=${() => this.toggleFold(key)}>${tIcon('chevronDown')}</button></header>
      <div class="wb">${body}</div>
    </section>`;
  }

  private quiet(text: string): TemplateResult {
    return html`<div class="body"><div class="quiet" data-quiet>${tIcon('check')}${text}</div></div>`;
  }

  private skeleton(rows: number, h: number): TemplateResult {
    return html`<div class="skel" aria-busy="true">${Array.from({ length: rows }, () => html`<span class="skl" style=${`block-size:${h}px`}></span>`)}</div>`;
  }

  private header(pages: OverviewWidget[][] | null = null): TemplateResult {
    const d = this.data;
    const depts = d?.departments ?? [];
    const all = !!d?.all_departments;
    const total = depts.reduce((s, x) => s + x.count, 0);
    return html`<header class=${`dh${this.compactHeader ? ' compact' : ''}`} data-overview-header>
      ${this.offline && this.lastOk ? html`<div class="offline-top" role="status" data-offline>${tIcon('offline')}${ot('offline', { time: timeText(this.lastOk) })}</div>` : nothing}
      <div class="dh-row"><div class="titles"><div class="crumbs">${tt('area')}</div><h1 data-overview-title>${ot('title')}</h1></div></div>
      ${this.screen === 'ready' || this.screen === 'loading' ? html`<div class="dh-det">
        ${depts.length > 1 ? html`<div class="seg sm depts" role="radiogroup" aria-label=${ot('deptGroup')} data-dept-chips>
          <button type="button" role="radio" aria-checked=${String(!this.dept)} data-dept="" @click=${() => this.setDept('')}>${ot(all ? 'allDepts' : 'allMyDepts')}<small>${total}</small></button>
          ${depts.map((x) => html`<button type="button" role="radio" aria-checked=${String(this.dept === x.id)} data-dept=${x.id} @click=${() => this.setDept(x.id)}>${bidi(x.name)}<small>${x.count}</small></button>`)}
        </div>` : nothing}
        ${this.lastOk ? html`<span class="amb" data-updated>${ot('updated', { when: '' }).trim()} <em>${this.now.getTime() - this.lastOk.getTime() < 60_000 ? ot('justNow') : relTime(this.lastOk.toISOString(), this.now)}</em></span>` : nothing}
        <span class="grow"></span>
        ${pages ? this.pager(pages) : nothing}
        <a class="btn sm hide-ph" href=${this.href()} data-to-board>${tIcon('ticket')}${ot('toBoard')}</a>
      </div>` : nothing}
    </header>`;
  }

  private kpiRow(): TemplateResult {
    if (this.screen === 'loading' || !this.data) return html`<div class="kpis" aria-busy="true">${Array.from({ length: 5 }, () => html`<span class="skl" style="block-size:76px;border-radius:14px"></span>`)}</div>`;
    const k = this.kpis();
    const deltas = kpiDeltas(k, this.yesterday);
    const truncated = this.data.truncated;
    const tile = (key: KpiKey, label: OverviewTextKey, tone: 'warn' | 'bad' | '', href: string | null, value: number, least = false, reveal: CardKey = 'overdue') => {
      const dv = deltas[key];
      const inner = html`<small>${ot(label)}</small><b>${least && value ? html`<span class="least" data-at-least>${ot('atLeast', { n: '' }).trim()}</span>` : nothing}<span class="n">${value}</span>${dv ? html`<span class=${`d ${dv > 0 ? 'up' : 'down'}`} title=${ot(dv > 0 ? 'yesterdayUp' : 'yesterdayDown', { n: Math.abs(dv) })} data-delta=${dv}>${tIcon(dv > 0 ? 'up' : 'down')}<span class="n">${Math.abs(dv)}</span><span class="vh">${ot(dv > 0 ? 'yesterdayUp' : 'yesterdayDown', { n: Math.abs(dv) })}</span></span>` : nothing}</b>`;
      const cls = `kpi ${value ? tone : ''}`;
      return href
        ? html`<a class=${cls} href=${href} data-kpi=${key}>${inner}</a>`
        : html`<button type="button" class=${cls} data-kpi=${key} @click=${() => this.reveal(reveal)}>${inner}</button>`;
    };
    return html`<div class="kpis" data-kpis>
      ${tile('open', 'kOpen', '', this.href(), k.open)}
      ${tile('stuck', 'kStuck', 'warn', this.href({ state: 'stuck' }), k.stuck)}
      ${tile('waiting', 'kWaiting', '', this.href({ state: 'waiting' }), k.waiting)}
      ${tile('overdue', 'kOverdue', 'bad', null, k.overdue, truncated)}
      ${k.approval !== null ? (this.summary ? tile('approval', 'kApproval', '', null, k.approval, false, 'approvals') : tile('approval', 'kApproval', '', '#/tickets/accounts', k.approval)) : nothing}
    </div>`;
  }

  private reveal(key: CardKey): void {
    if (this.folded.has(key)) this.toggleFold(key);
    // OVERVIEWFIT-297: on a desktop the widget's page comes on screen (the track scrolls sideways only)
    const page = this.paged ? this.pageOfKey.get(key) : undefined;
    if (page !== undefined) {
      this.goPage(page);
      return;
    }
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
    const rows = this.allOverdueRows();
    if (!rows.length) return { body: this.quiet(ot('odNone')), count: 0 };
    const shown = this.allOverdue ? rows : rows.slice(0, OVERDUE_SHOWN);
    const what: Record<string, OverviewTextKey> = { sla: 'odSla', eta: 'odEta', rfq: 'odRfq', pay: 'odPay' };
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
    const pays = this.payments ? serverPaymentDates(this.payments.upcoming.items) : paymentDates([...this.details.values()]);
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
        <span class="num">${e.timed ? timeText(new Date(e.at)) : ot('agAllDay')}</span>
        <b><i class=${`dot ${dot[e.kind]}`}></i> ${ot(label[e.kind])}<small>${[e.who, `${e.ref} · ${e.title}`, e.place].filter(Boolean).map((x) => bidi(x)).join(' · ')}</small></b>
        <span></span><span class="back">${tIcon('back')}</span></a>`)}</div></div>`)}</div>`;
  }

  // ---------------------------------------------------------------- phase 3: the cards of the summary route

  /** The body of a summary card before its answer: a skeleton the first time, "not available · try again" after a failure. */
  private summaryPending(rows: number, h: number): TemplateResult | null {
    if (this.summaryFailed) return html`<div class="body"><div class="unavail" data-unavailable>${ot('unavailable')}<button type="button" class="btn sm" data-retry-summary @click=${this.retrySummary}>${tIcon('refresh')}${ot('retry')}</button></div></div>`;
    if (!this.summary) return this.skeleton(rows, h);
    return null;
  }

  private moreButton(key: CardKey, total: number): TemplateResult {
    const open = this.expanded.has(key);
    const flip = () => {
      const next = new Set(this.expanded);
      if (open) next.delete(key);
      else next.add(key);
      this.expanded = next;
    };
    return html`<div><button type="button" class="btn sm" aria-expanded=${String(open)} data-more=${key} @click=${flip}>${open ? ot('showLess') : ot('showAll')}<small class="mut">· ${total}</small></button></div>`;
  }

  private sinceText(since: string | null): string {
    const t = since ? Date.parse(since) : NaN;
    return Number.isNaN(t) ? '' : ot('apWaits', { age: fmtDur(this.now.getTime() - t) });
  }

  // card 5
  private periodSeg(): TemplateResult {
    const p = this.chosenPeriod();
    return html`<div class="seg sm pseg" role="radiogroup" aria-label=${ot('thPeriod')} data-period-seg>${DASH_PERIODS.map((x) => html`<button type="button" role="radio" aria-checked=${String(p === x)} data-period=${x} @click=${() => this.setPeriod(x)}>${ot(`pd_${x}` as OverviewTextKey)}</button>`)}</div>`;
  }

  private throughputCard(): TemplateResult {
    const pending = this.summaryPending(4, 40);
    if (pending) return pending;
    const s = this.summary as DashboardResponse;
    if (s.period !== this.chosenPeriod()) return this.skeleton(4, 40);
    const rows = s.throughput.rows;
    if (!rows.length) return this.quiet(ot('thNone'));
    const med = (sec: number | null) => (sec === null ? '-' : fmtDur(sec * 1000));
    const name = (n: string) => (n ? bidi(n) : '-');
    const t = s.throughput.total;
    return html`<div class="body" data-throughput=${s.period}>
      <table class="rtbl tp"><thead><tr><th>${ot('thHandler')}</th><th class="num">${ot('thDone')}</th><th class="num">${ot('thClosed')}</th><th class="num">${ot('thReturned')}</th><th class="num">${ot('thMedian')}</th></tr></thead>
        <tbody>${rows.map((r) => html`<tr data-tp-row=${r.key}><td class="who">${name(r.name)}</td><td class="num"><span class="n">${r.done}</span></td><td class="num"><span class="n">${r.closed}</span></td><td class="num"><span class="n">${r.returned}</span></td><td class="num mut">${med(r.median_seconds)}</td></tr>`)}</tbody>
        <tfoot><tr data-tp-total><td>${ot('thTotal')}</td><td class="num"><span class="n">${t.done}</span></td><td class="num"><span class="n">${t.closed}</span></td><td class="num"><span class="n">${t.returned}</span></td><td class="num mut">${med(t.median_seconds)}</td></tr></tfoot></table>
      <div class="dcards">${rows.map((r) => html`<div class="dcard" data-tp-card=${r.key}><b>${name(r.name)}</b><span class="nums"><span>${ot('thDone')} <em>${r.done}</em></span><span>${ot('thClosed')} <em>${r.closed}</em></span><span>${ot('thReturned')} <em>${r.returned}</em></span><span>${ot('thMedian')} <em>${med(r.median_seconds)}</em></span></span></div>`)}
        <div class="dcard total"><b>${ot('thTotal')}</b><span class="nums"><span>${ot('thDone')} <em>${t.done}</em></span><span>${ot('thClosed')} <em>${t.closed}</em></span><span>${ot('thReturned')} <em>${t.returned}</em></span></span></div></div>
    </div>`;
  }

  // card 6
  private dailyCard(): TemplateResult {
    const pending = this.summaryPending(1, 150);
    if (pending) return pending;
    const days = (this.summary as DashboardResponse).daily.days;
    const tot = dailyTotals(days);
    if (!tot.opened && !tot.closed) return this.quiet(ot('dyNone'));
    const W = 420, H = 110, pad = 14, bw = 9;
    const gap = (W - pad * 2) / Math.max(1, days.length);
    const bars = days.map((d, i) => {
      const x = pad + i * gap + gap / 2;
      const ho = (d.opened / tot.max) * H, hc = (d.closed / tot.max) * H;
      return svg`<rect x=${x - bw - 1} y=${H - ho} width=${bw} height=${ho} rx="2.5" class="bo"></rect><rect x=${x + 1} y=${H - hc} width=${bw} height=${hc} rx="2.5" class="bc"></rect>
        ${d.opened ? svg`<text x=${x - bw / 2 - 1} y=${H - ho - 3} class="bl">${d.opened}</text>` : nothing}${d.closed ? svg`<text x=${x + bw / 2 + 1} y=${H - hc - 3} class="bl">${d.closed}</text>` : nothing}
        ${i % 2 === days.length % 2 ? svg`<text x=${x} y=${H + 12} class="ax">${shortDay(d.date)}</text>` : nothing}`;
    });
    return html`<div class="body" data-daily>
      <div class="net" data-net=${tot.net}>${ot('dyNetLabel', { n: signed(tot.net) })} · ${ot('dyOpened')} <span class="n">${tot.opened}</span> · ${ot('dyClosed')} <span class="n">${tot.closed}</span></div>
      <div class="bars" aria-hidden="true"><svg viewBox=${`0 0 ${W} ${H + 16}`}><line x1=${pad} x2=${W - pad} y1=${H + 0.5} y2=${H + 0.5} class="base"></line>${bars}</svg>
        <div class="lg"><span><i class="o"></i>${ot('dyOpened')}</span><span><i class="c"></i>${ot('dyClosed')}</span></div></div>
      <table class="vh" data-daily-table><caption>${ot('dyChart')}</caption><thead><tr><th>${ot('dyDay')}</th><th>${ot('dyOpened')}</th><th>${ot('dyClosed')}</th></tr></thead>
        <tbody>${days.map((d) => html`<tr><td>${shortDay(d.date)}</td><td>${d.opened}</td><td>${d.closed}</td></tr>`)}</tbody></table>
    </div>`;
  }

  // card 7
  private approvalsCard(): TemplateResult {
    const pending = this.summaryPending(4, 44);
    if (pending) return pending;
    const a = (this.summary as DashboardResponse).approvals;
    if (!approvalsTotal(a)) return this.quiet(ot('apNone'));
    const all = this.expanded.has('approvals');
    const lang = ticketsLang();
    const amount = (x: { amount_minor: number | null; currency: string | null }) => (x.amount_minor !== null && x.currency ? html`<span class="amt n" data-amount>${formatMoney(x.amount_minor, x.currency, lang)}</span>` : html`<span></span>`);
    const ticketRow = (kind: 'quote' | 'claim', x: TicketApproval) => html`<a class="cr ap" href=${`${this.href({}, x.ticket.id)}&tab=costs`} data-approval-row=${kind}>
      <span class="num">#${x.ticket.number}</span><b>${bidi(x.ticket.title)}<small>${[x.vendor ? bidi(x.vendor) : '', this.sinceText(x.since)].filter(Boolean).join(' · ')}</small></b>${amount(x)}<span class="back">${tIcon('back')}</span></a>`;
    const secondRow = (x: SecondApproval) => html`<a class="cr ap" href=${rfqHref({ id: x.rfq.id })} data-approval-row="second">
      <span class="num">${x.rfq.ref}</span><b>${bidi(x.rfq.title)}<small>${[x.vendor ? bidi(x.vendor) : '', this.sinceText(x.since)].filter(Boolean).join(' · ')}</small></b>${amount(x)}<span class="back">${tIcon('back')}</span></a>`;
    const group = <T,>(key: string, title: string, g: { count: number; items: T[] }, row: (x: T) => TemplateResult) => (g.count ? html`<div class="sect" data-approvals=${key}>
      <h4>${title} <span class="n">· ${g.count}</span></h4>
      <div class="closedrows">${(all ? g.items : g.items.slice(0, APPROVALS_SHOWN)).map(row)}</div>
      ${all && g.count > g.items.length ? html`<div class="note" data-truncated>${ot('truncated', { n: g.items.length })}</div>` : nothing}</div>` : nothing);
    const more = [a.quotes, a.claims, a.second].some((g) => g.count > APPROVALS_SHOWN);
    return html`<div class="body">
      ${group('quotes', ot('apQuotes'), a.quotes, (x: TicketApproval) => ticketRow('quote', x))}
      ${group('claims', ot('apClaims'), a.claims, (x: TicketApproval) => ticketRow('claim', x))}
      ${group('second', ot('apSecond'), a.second, secondRow)}
      ${more ? this.moreButton('approvals', approvalsTotal(a) ?? 0) : nothing}
    </div>`;
  }

  // phase 4: the payments board - instalments past their day, the next two weeks' instalments, approved demands not paid
  private paymentsCard(): TemplateResult {
    if (!this.payments) {
      if (this.paymentsFailed) return html`<div class="body"><div class="unavail" data-unavailable>${ot('unavailable')}<button type="button" class="btn sm" data-retry-payments @click=${this.retryPayments}>${tIcon('refresh')}${ot('retry')}</button></div></div>`;
      return this.skeleton(3, 44);
    }
    const p = this.payments;
    if (!paymentsTotal(p)) return this.quiet(ot('pyNone'));
    const all = this.expanded.has('payments');
    const lang = ticketsLang();
    const money = (minor: number | null, cur: string | null) => (minor !== null && cur ? html`<span class="amt n" data-amount>${formatMoney(minor, cur, lang)}</span>` : html`<span></span>`);
    const instRow = (x: PayInstalment) => {
      const w = payWhen(x.days);
      const tone = x.days < 0 ? (x.days <= -2 ? 'bad' : 'warn') : x.days <= 1 ? 'warn' : 'info';
      return html`<a class="cr ap" href=${rfqHref({ id: x.rfq.id })} data-pay-row="instalment" data-days=${x.days}>
        <span class="num">${x.rfq.ref}</span><b>${bidi(x.rfq.title)}<small>${[x.vendor ? bidi(x.vendor) : '', ot(`pyKind_${x.instalment_kind}` as OverviewTextKey), ot(x.demand === 'open' ? 'pyDemandOpen' : 'pyDemandNone')].filter(Boolean).join(' · ')}</small></b>
        <span class="tags"><span class=${`chip xs ${tone}`} data-when>${tIcon('clock')}${ot(w.key, { n: w.n })}</span>${money(x.amount_minor, x.currency)}</span>
        <span class="back">${tIcon('back')}</span></a>`;
    };
    const claimRow = (x: PayClaim) => html`<a class="cr ap" href=${`${this.href({}, x.ticket.id)}&tab=costs`} data-pay-row="claim">
      <span class="num">#${x.ticket.number}</span><b>${bidi(x.ticket.title)}<small>${[x.vendor ? bidi(x.vendor) : '', x.since ? ot('pyApproved', { age: fmtDur(this.now.getTime() - Date.parse(x.since)) }) : ''].filter(Boolean).join(' · ')}</small></b>
      ${money(x.amount_minor, x.currency)}<span class="back">${tIcon('back')}</span></a>`;
    const group = <T,>(key: string, title: string, g: { count: number; items: T[] }, row: (x: T) => TemplateResult) => (g.count ? html`<div class="sect" data-payments=${key}>
      <h4>${title} <span class="n">· ${g.count}</span></h4>
      <div class="closedrows">${(all ? g.items : g.items.slice(0, APPROVALS_SHOWN)).map(row)}</div>
      ${all && g.count > g.items.length ? html`<div class="note" data-truncated>${ot('truncated', { n: g.items.length })}</div>` : nothing}</div>` : nothing);
    const more = [p.overdue, p.upcoming, p.claims].some((g) => g.count > APPROVALS_SHOWN);
    return html`<div class="body">
      ${group('overdue', ot('pyOverdue'), p.overdue, instRow)}
      ${group('upcoming', ot('pyUpcoming'), p.upcoming, instRow)}
      ${group('claims', ot('pyClaims'), p.claims, claimRow)}
      ${more ? this.moreButton('payments', paymentsTotal(p)) : nothing}
    </div>`;
  }

  // card 8
  private rfqsCard(): TemplateResult {
    const pending = this.summaryPending(4, 44);
    if (pending) return pending;
    const r = (this.summary as DashboardResponse).rfqs;
    if (!r.items.length) return this.quiet(ot('rqNone'));
    const all = this.expanded.has('rfqs');
    const shown = all ? r.items : r.items.slice(0, OVERDUE_SHOWN);
    const due = (iso: string | null) => (iso ? dayMonthText(new Date(iso)) : '');
    return html`<div class="body"><div class="closedrows" data-rfqs>${shown.map((x) => {
      const st = rfqStageOf(x);
      return html`<a class="cr rq" href=${rfqHref({ id: x.id })} data-rfq-row=${x.stage}>
        <span class="num">${x.ref}</span><b>${bidi(x.title)}${x.due_at ? html`<small>${ot('rqDue', { date: due(x.due_at) })}</small>` : nothing}</b>
        <span class="tags"><span class=${`chip xs ${st.tone}`} data-stage>${ot(st.text, { quoted: x.quoted, invited: x.invited })}</span>${x.questions ? html`<span class="chip warn xs" data-question>${tIcon('note')}${x.questions > 1 ? ot('rqQuestions', { n: x.questions }) : ot('rqQuestion')}</span>` : nothing}</span>
        <span class="back">${tIcon('back')}</span></a>`;
    })}</div>
      ${r.items.length > OVERDUE_SHOWN ? this.moreButton('rfqs', r.count) : nothing}
      ${all && r.count > r.items.length ? html`<div class="note" data-truncated>${ot('truncated', { n: r.items.length })}</div>` : nothing}
    </div>`;
  }

  // card 11: the summary route's comparison (phase 3); the board's own count (phase 1) never mixes in
  private departmentsCard(): TemplateResult {
    const pending = this.summaryPending(3, 40);
    if (pending) return pending;
    const rows = sortDepartments(this.summary?.departments ?? []);
    if (!this.summary?.departments) return this.departmentsFromBoard();
    const go = (id: string) => `#/tickets/overview?${new URLSearchParams({ dept: id }).toString()}`;
    const bad = (n: number) => (n > 2 ? ' bad' : '');
    return html`<div class="body" data-compare="summary">
      <table class="rtbl"><thead><tr><th>${ot('cmpDept')}</th><th class="num">${ot('cmpOpen')}</th><th class="num">${ot('cmpStuck')}</th><th class="num">${ot('cmpOverdue')}</th><th class="num">${ot('cmpDecide')}</th><th class="num">${ot('cmpDone7')}</th><th class="num">${ot('cmpBusy')}</th></tr></thead>
        <tbody>${rows.map((r) => html`<tr data-dept-row=${r.id}><td><a class="tl" href=${go(r.id)}>${bidi(r.name)}</a></td><td class="num"><span class="n">${r.open}</span></td><td class=${`num${bad(r.stuck)}`}><span class="n">${r.stuck}</span></td><td class=${`num${bad(r.overdue)}`}><span class="n">${r.overdue}</span></td><td class="num"><span class="n">${r.waiting}</span></td><td class="num"><span class="n">${r.done_7d}</span></td><td class="num"><span class="n">${r.busy_handlers}</span></td></tr>`)}</tbody></table>
      <div class="dcards">${rows.map((r) => html`<a class="dcard" href=${go(r.id)} data-dept-card=${r.id}><b>${bidi(r.name)}</b><span class="nums"><span>${ot('cmpOpen')} <em>${r.open}</em></span><span>${ot('cmpStuck')} <em>${r.stuck}</em></span><span>${ot('cmpOverdue')} <em>${r.overdue}</em></span><span>${ot('cmpDecide')} <em>${r.waiting}</em></span><span>${ot('cmpDone7')} <em>${r.done_7d}</em></span><span>${ot('cmpBusy')} <em>${r.busy_handlers}</em></span></span></a>`)}</div>
    </div>`;
  }

  // card 11 (phase 1, from the board) - only when the summary answered without a comparison (an older server)
  private departmentsFromBoard(): TemplateResult {
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
    // OVERVIEWFIT-297: on a desktop the skeleton is the first page (two rows), the same frame the widgets land in
    if (this.paged) return html`<div class="wpages" data-overview-state="loading"><div class="pg">${card('wide', 5, 40)}${card('', 3, 56)}${card('wide', 5, 52)}${card('', 4, 44)}</div></div>`;
    return html`<div class="wgrid" data-overview-state="loading">${card('wide', 5, 40)}${card('', 3, 56)}${card('wide', 5, 52)}${card('', 4, 44)}${card('', 4, 44)}${card('', 4, 44)}${card('', 4, 44)}${card('wide', 4, 40)}${card('', 1, 150)}</div>`;
  }

  /** The ready screen's widgets in their order (the comparison's place from the settings), or null when the screen shows a state box. */
  private widgets(): { list: OverviewWidget[]; top: OverviewWidget | null } | null {
    if (this.screen !== 'ready' || !this.data) return null;
    const d = this.data;
    if (!d.counts.all && !d.counts.closed_all && !d.items.length) return null;
    const s = this.settings();
    const w = (key: CardKey, title: string, q: string, body: TemplateResult, opts: { cls?: string; badge?: TemplateResult | typeof nothing; extra?: TemplateResult } = {}, alert = false): OverviewWidget =>
      ({ key, title, span: opts.cls === 'full' ? 3 : opts.cls === 'wide' ? 2 : 1, alert, make: (span?: number) => this.widget(key, title, q, body, { ...opts, span }) });
    const compare = d.all_departments && !this.dept && d.departments.length > 1 ? w('departments', ot('cmpTitle'), ot('cmpQ'), this.departmentsCard(), { cls: 'full' }) : null;
    const load = this.loadCard();
    const od = this.overdueCard();
    const stuckN = d.counts.stuck;
    const sum = this.summary;
    const apN = sum ? approvalsTotal(sum.approvals) : 0;
    const rqN = sum ? sum.rfqs.count : 0;
    const pyN = paymentsTotal(this.payments);
    const pyBad = !!this.payments?.overdue.count;
    const daily = sum ? dailyTotals(sum.daily.days) : null;
    const list: (OverviewWidget | null)[] = [
      s.compare === 'below_numbers' ? compare : null,
      w('stuck', ot('stTitle'), ot('stQ'), this.whereStuck(), { cls: 'wide', badge: stuckN ? html` <span class="cnt" data-count>${stuckN}</span>` : nothing }),
      w('waits', ot('wwTitle'), ot('wwQ'), this.whoWaits()),
      w('load', ot('ldTitle'), ot('ldQ'), load.body, { cls: 'wide', badge: load.busy ? html` <span class="cnt bad" data-count>${ot('ldBusyCount', { n: load.busy })}</span>` : nothing }, !!load.busy),
      w('overdue', ot('odTitle'), ot('odQ'), od.body, { badge: od.count ? html` <span class="cnt bad" data-count>${od.count}</span>` : nothing }, !!od.count),
      w('approvals', ot('apTitle'), ot('apQ'), this.approvalsCard(), { badge: apN ? html` <span class="cnt" data-count>${apN}</span>` : nothing }),
      this.payments || this.paymentsFailed ? w('payments', ot('pyTitle'), ot('pyQ'), this.paymentsCard(), { badge: pyN ? html` <span class=${`cnt${pyBad ? ' bad' : ''}`} data-count>${pyN}</span>` : nothing }, pyBad) : null,
      w('rfqs', ot('rqTitle'), ot('rqQ'), this.rfqsCard(), { badge: rqN ? html` <span class="cnt info" data-count>${rqN}</span>` : nothing }),
      w('upcoming', ot('agTitle'), ot('agQ'), this.agendaCard()),
      w('throughput', ot('thTitle'), ot('thQ'), this.throughputCard(), { cls: 'wide', extra: this.periodSeg() }),
      w('daily', ot('dyTitle'), ot('dyQ'), this.dailyCard(), { badge: daily && (daily.opened || daily.closed) ? html` <span class=${`cnt${daily.net > 0 ? '' : ' info'}`} data-count data-net-badge>${ot('dyNet', { n: signed(daily.net) })}</span>` : nothing }),
      s.compare === 'bottom' ? compare : null,
    ];
    return { list: list.filter((x): x is OverviewWidget => !!x), top: s.compare === 'top' ? compare : null };
  }

  private body(ws: { list: OverviewWidget[]; top: OverviewWidget | null } | null, pages: OverviewWidget[][] | null): TemplateResult {
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
    if (!ws) {
      return this.stateBox('ticket', ot('emptyAll'), 'empty', this.meta?.can.create ? html`<a class="btn primary" href=${listHref('mine', NO_FILTERS, { create: true })} data-new>${tIcon('plus')}${ot('newTicket')}</a>` : undefined);
    }
    const top = ws.top ? html`<div class="wgrid top">${ws.top.make()}</div>` : nothing;
    if (!pages) {
      return html`${top}${this.kpiRow()}<div class="wgrid">${ws.list.map((x) => x.make())}</div>`;
    }
    // OVERVIEWFIT-297: the pages side by side in a track that snaps page by page (a swipe, a trackpad, the pager, the keyboard focus);
    // every widget stays in the document (the numbers row and a focused widget bring their page on screen)
    const idx = Math.min(this.pageIdx, pages.length - 1);
    return html`${top}${this.kpiRow()}
      <div class="wpages" data-overview-pages tabindex="-1" @scroll=${this.onTrack}>
        ${pages.map((p, i) => html`<div class="pg" role="group" aria-label=${ot('pageOf', { n: i + 1, of: pages.length })} data-page=${i} data-current=${String(i === idx)}>${p.map((x) => x.make(x.fill))}</div>`)}
      </div>`;
  }

  render() {
    const ws = this.widgets();
    const fill = ws ? filledSpans(ws.list.map((x) => x.span), 3) : [];
    const pages = this.paged && ws ? packPages(ws.list.map((x) => x.span), 3).map((p) => p.map((i) => ({ ...ws.list[i], fill: fill[i] }))) : null;
    this.pageCount = pages?.length ?? 0;
    this.pageOfKey = new Map((pages ?? []).flatMap((p, i) => p.map((x) => [x.key, i] as const)));
    return html`<div class=${`page${this.offline ? ' stale' : ''}${this.paged ? ' paged' : ''}`} data-screen="tickets-overview">
      ${this.header(pages)}
      ${this.body(ws, pages)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-overview': TicketsOverview;
  }
}
