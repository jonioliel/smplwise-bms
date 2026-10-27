import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-drawer';
import '../components/sw-dialog';
import '../components/sw-dropdown';
import '../components/sw-state-panel';
import '../access-external/identity-card';
import '../access-external/request-dialog';
import type { RouteState } from '../router';
import type { DropdownItem } from '../components/sw-dropdown';
import { ApiError, describeError } from '../api/client';
import { productSettings } from '../api/prefs';
import {
  acceptContact, approveGrant, attachCard, confirmGone, exportGrantsCsv, getHistory, type HistoryRow, getDigest, getDrift, getGrant, listGrants, listPendingContacts,
  provisionNow, pushName, putScreenSettings, readNow, refuseGrant, rejectPendingContact, revokeAll, revokeGrant, rotateCode, type Digest, type Drift, type DriftKind,
  type DriftRow, type Grant, type GrantsReply, type PendingReply, type ScreenSettings, getReadiness, setExternalGrants, type Readiness,
} from '../api/access-grants';
import {
  BUCKETS, DAYS, STATE_ICON, STATE_TONE, actionsOf, codeOf, counts, datesText, doorState, durationText, goneReferenceOk, hoursText, ladder, lastDay, localDate,
  narrowWindow, readOutcome, readbackView, stationsOf, timeline, uiState, visible, whyKey, wiskeyOffline, type Bucket, type Filter, type Query,
} from '../access-external/model';
import { subscribeClock } from '../api/clock-ticker';
import { xCss } from '../access-external/styles';
import { leftText, leftTone, sortPending, ticketText, waitText } from '../access-external/pending-model';
import { spt } from '../i18n/security-public';
import { xt, xtDynamic, xtLang, type XtKey } from '../i18n/access-external';
import { rt } from '../i18n/access-request';
import { SkinController } from '../design/skin';
import { applyExternalPlacement } from '../shell/nav';
import { bubbleChrome } from '../styles/bubble-chrome';
import { dateInputLang } from '../api/day-format';
import { leadReserveStyles } from '../styles/lead-reserve'; // header dropdown placement 4: the first row keeps the reserve free (integ/293)

const POLL_MS = 15_000;
const KPI_KEY: Record<Bucket, XtKey> = { attention: 'kpiAttention', waiting: 'kpiWaiting', moving: 'kpiMoving', active: 'kpiActive', history: 'kpiHistory' };
const KPI_TONE: Record<Bucket, string> = { attention: 'err', waiting: 'acc', moving: 'acc', active: 'ok', history: 'off' };
const SRC_KEY: Record<string, XtKey> = { rfq_order: 'srcRfq', ticket: 'srcTicket', manual: 'srcManual' };
const REVOKE_ALL_WORD = 'בטל הכל';
// GRANTSMIN-295: the drift view's tone and icon per kind of difference (the server sends them most urgent first)
const DRIFT_TONE: Record<DriftKind, string> = { missing: 'err', scope: 'err', unknown: 'warn', sync_pending: 'warn', name: 'warn', unverified: 'acc', idle_person: 'off' };
const DRIFT_ICON: Record<DriftKind, string> = { missing: 'user', scope: 'door', unknown: 'help', sync_pending: 'refresh', name: 'edit', unverified: 'help', idle_person: 'user' };
const READ_KINDS: DriftKind[] = ['missing', 'scope', 'unknown', 'unverified'];

/** Save a blob under a name through a temporary link (the browser's own download). */
function saveFile(blob: Blob, name: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
}

type Confirm = { title: string; body: TemplateResult; btn: string; danger?: boolean; word?: string; run: () => Promise<unknown>; done: XtKey; doneText?: string };
type Dialog =
  | null
  | { kind: 'confirm'; c: Confirm }
  | { kind: 'approve'; id: string }
  | { kind: 'gone'; id: string }
  | { kind: 'digest' }
  | { kind: 'drift' }
  | { kind: 'settings' }
  | { kind: 'request'; noPerm: boolean };

/**
 * SHAREDID-293: "גישת חוץ" - the shared Arx + WisKey identity screen, built from the owner-approved mockup
 * (private/planning/mockup_shared_identity_2026-10-20) and the owner's decisions of 2026-10-20:
 *  1 the product is "WisKey" in every text;
 *  2 "Active - verified" only when the server holds read-back proof (`scope_verified`), never from the write's answer;
 *  3 the manual "confirmed gone" (system administrators, three checks, a typed word, a reference; every manager is told);
 *  4 the weekly digest (a side panel, the full digest in a dialog; channel / day / hour are settings);
 *  5 name drift: the identity card's "push the name", automatic by a setting;
 *  6 the screen sits under access control, service management or both (a setting; shell/nav.ts);
 *  7 attach a recovered person (the identity card, system administrators only).
 * GRANTSMIN-295: the drift view (a side panel and a dialog: per person, where Arx and WisKey differ, from the server's stored read-back
 * and name digests - the page never contacts WisKey; "push the name", "read back now", "open the grant") and the CSV export of the
 * grants the caller may see (the server decides the rows and how much of a number the caller may see).
 * A list with KPI filters, the grant drawer (why, the ladder, doors, window, code, identity, what happened, actions), the approval
 * dialog (narrow only: doors and days), the confirmations. The entry code is never shown anywhere. The server decides every action.
 */
@customElement('access-external-screen')
export class AccessExternalScreen extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private data: GrantsReply | null = null;
  @state() private error = '';
  @state() private query: Query = { filter: 'live', q: '', station: '', source: '' };
  @state() private sel: string | null = null;
  @state() private detail: Grant | null = null;
  @state() private dialog: Dialog = null;
  @state() private digest: Digest | null = null;
  @state() private drift: Drift | null = null;
  @state() private exporting = false;
  @state() private pending: PendingReply | null = null;
  @state() private busy = false;
  @state() private dlgError = '';
  // EXTERNALBUILD-297 (X1): the readiness check shown in the settings dialog (system administrators); null = loading, 'error' = not loaded
  @state() private readiness: Readiness | null | 'error' = null;
  @state() private toasts: { id: number; text: string }[] = [];
  @state() private tz = 'Asia/Jerusalem';
  // GRANTS3-295: the card typed for a card grant (held only until the save answers) and the owner's per-grant history
  @state() private cardNo = '';
  @state() private history: { id: string; rows: HistoryRow[] | null; error: string } | null = null;
  // the approval dialog
  @state() private apDoors = new Set<string>();
  @state() private apFrom = '';
  @state() private apUntil = '';
  @state() private apTold = false;
  // the confirmed-gone dialog
  @state() private goneChecks = [false, false, false];
  @state() private goneRef = '';
  @state() private word = '';
  // the settings dialog
  @state() private draft: ScreenSettings | null = null;
  // SHAREDUI-295: when the list shown was read (a failed poll keeps it, marked stale), and the last "read back now" answer per grant
  @state() private loadedAt = 0;
  @state() private stale = false;
  @state() private reading: string | null = null;
  @state() private rb: { id: string; at: string; kind: 'still' | 'error'; key: string; why?: string } | null = null;
  private timer?: number;
  private unclock?: () => void;
  private readonly onResume = () => {
    if (document.visibilityState === 'visible') void this.load();
  };
  private toastSeq = 0;
  private routed = false;

  static styles = [
    xCss,
    leadReserveStyles,
    css`
      :host { display: flex; flex-direction: column; gap: 14px; padding: 14px var(--sw-page-pad) 32px; max-inline-size: var(--sw-content-max); inline-size: 100%; box-sizing: border-box;
        /* SHAREDUI-295: every button of the screen, its drawer and dialogs is a 44 px target (the system-access screens do the same) */
        --sw-ctl-h-md: max(44px, var(--sw-touch-desktop, 44px)); --sw-ctl-h-sm: max(44px, var(--sw-touch-desktop, 44px)); }
      .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .top h1 { margin: 0; font-size: var(--sw-fs-3xl); line-height: 1.2; color: var(--sw-heading); }
      .top .sub { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-base); }
      .top .sp { flex: 1; }
      .banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--cs); color: var(--ct); font-weight: 500; flex-wrap: wrap; }
      .banner b { font-weight: 700; }
      .banner .sp { flex: 1; }
      .cols { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
      .main, .side { display: grid; gap: 14px; min-inline-size: 0; }
      .kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
      .kpi { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: var(--sw-r-md); background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); cursor: pointer; text-align: start; font: inherit; color: inherit; min-inline-size: 0; min-block-size: var(--sw-touch-desktop); }
      .kpi .dot { inline-size: 11px; block-size: 11px; border-radius: 50%; background: var(--c); flex: none; }
      .kpi b { display: block; font-size: var(--sw-fs-2xl); line-height: 1.05; color: var(--sw-heading); font-variant-numeric: tabular-nums; }
      .kpi span { font-size: var(--sw-fs-sm); color: var(--sw-text-2); line-height: 1.25; display: block; }
      .kpi[aria-pressed='true'] { outline: 2px solid var(--sw-accent); outline-offset: -2px; }
      .kpi:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 2px; }
      .tcard { border-radius: var(--sw-r-lg); background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); overflow: hidden; min-inline-size: 0; }
      .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 12px 14px; border-block-end: 1px solid var(--sw-border-strong); }
      .filters .in { flex: 1 1 200px; inline-size: auto; }
      .gl-h, .gl-r { display: grid; grid-template-columns: minmax(170px, 1.3fr) minmax(140px, 1fr) 100px minmax(200px, 2fr) 130px 16px; gap: 12px; align-items: start; padding: 10px 16px; }
      .gl-h { font-size: var(--sw-fs-sm); color: var(--sw-text-2); font-weight: 600; background: var(--sw-surface-2); border-block-end: 1px solid var(--sw-border-strong); }
      .gl-r { border: 0; border-block-end: 1px solid var(--sw-border); background: transparent; inline-size: 100%; text-align: start; color: inherit; cursor: pointer; font: inherit; }
      .gl-r:last-child { border-block-end: 0; }
      .gl-r:hover { background: var(--sw-hover-wash); }
      .gl-r[aria-current='true'] { background: var(--sw-accent-soft); }
      .gl-r:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: -2px; }
      .pn b { display: block; color: var(--sw-heading); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pn small, .win small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pn .sr { display: block; font-size: var(--sw-fs-xs); color: var(--sw-text-2); margin-block-start: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .st { display: grid; gap: 5px; min-inline-size: 0; }
      .st .why { font-size: var(--sw-fs-sm); color: var(--sw-text-2); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .code { display: grid; gap: 4px; justify-items: start; min-inline-size: 0; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .chev { color: var(--sw-text-3); align-self: center; }
      /* SHAREDUI-295: the read-back wait - an indeterminate mark (still under reduced motion), never a number */
      .rb { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px; border-radius: var(--sw-r-md); background: var(--cs); }
      .rb-mark { inline-size: 28px; block-size: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--sw-surface-solid); }
      .rb-mark i { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--c); animation: rbpulse 1.8s ease-in-out infinite; }
      .rb[data-readback='offline'] .rb-mark i { animation: none; }
      @keyframes rbpulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.7); } }
      @media (prefers-reduced-motion: reduce) { .rb-mark i { animation: none; } }
      .rb-t { display: grid; gap: 2px; min-inline-size: 0; font-size: var(--sw-fs-sm); color: var(--sw-text); }
      .rb-t b { color: var(--sw-heading); }
      .rb-line { display: flex; gap: 6px; align-items: center; margin: 4px 0 0; font-size: var(--sw-fs-sm); font-weight: 600; color: var(--sw-text); }
      .rb-line[data-tone='err'] { color: var(--x-err-t); }
      @media (max-width: 600px) { .rb { grid-template-columns: auto minmax(0, 1fr); } .rb > sw-button { grid-column: 1 / -1; } }
      .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; padding: 10px 16px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); border-block-start: 1px solid var(--sw-border-strong); }
      .legend span { display: inline-flex; gap: 6px; align-items: center; }
      .panel { border-radius: var(--sw-r-lg); background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); padding: 16px; display: grid; gap: 12px; align-content: start; min-inline-size: 0; }
      .panel h3 { margin: 0; font-size: var(--sw-fs-md); color: var(--sw-heading); font-weight: 600; display: flex; align-items: center; gap: 8px; }
      .panel h3 .sp { flex: 1; }
      .panel .lead { margin: 0; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .minis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .mini { padding: 9px 10px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); display: grid; gap: 2px; }
      .mini b { font-size: var(--sw-fs-xl); color: var(--sw-heading); font-variant-numeric: tabular-nums; line-height: 1.1; }
      .mini b[data-tone] { color: var(--ct); }
      .mini span { font-size: var(--sw-fs-xs); color: var(--sw-text-2); line-height: 1.25; }
      .lockrow { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; padding: 10px 12px; border-radius: var(--sw-r-sm); border: 1px dashed var(--sw-border-strong); color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .lockrow b { display: block; color: var(--sw-heading); font-size: var(--sw-fs-base); }
      .lockrow input { inline-size: 20px; block-size: 20px; }
      .db { display: grid; gap: 16px; padding-block-end: 8px; }
      .dfoot { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding-block-start: 12px; border-block-start: 1px solid var(--sw-border-strong); }
      .dfoot .sp { flex: 1; }
      .dhead { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .diff { display: grid; grid-template-columns: auto 1fr 1fr; gap: 8px 12px; padding: 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); align-items: start; }
      .diff .h { font-weight: 600; color: var(--sw-text-3); }
      .flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .flow div { padding: 10px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); font-size: var(--sw-fs-xs); color: var(--sw-text-2); display: grid; gap: 4px; }
      .flow b { color: var(--sw-heading); font-size: var(--sw-fs-sm); }
      .bubble { padding: 12px 14px; border-radius: var(--sw-r-md); background: var(--sw-success-soft); color: var(--sw-text); font-size: var(--sw-fs-sm); line-height: 1.55; }
      .ap { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 18px; }
      .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .dgrid { display: grid; gap: 8px; }
      .toasts { position: fixed; inset-block-end: 24px; inset-inline: 0; display: grid; justify-items: center; gap: 8px; z-index: var(--sw-z-toast); pointer-events: none; }
      .toast { background: var(--sw-toast-bg); color: var(--sw-toast-text); padding: 10px 16px; border-radius: var(--sw-r-pill); box-shadow: var(--sw-shadow-2); font-size: var(--sw-fs-sm); display: inline-flex; gap: 8px; align-items: center; }
      .gaps { display: grid; gap: 8px; }
      .gap { display: grid; grid-template-columns: 28px 1fr; gap: 10px; padding: 10px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .gap b { display: block; color: var(--sw-heading); }
      .gap .ik { inline-size: 28px; block-size: 28px; border-radius: var(--sw-r-xs); display: grid; place-items: center; background: var(--cs); color: var(--ct); }
      .drows { display: grid; gap: 8px; }
      .drow { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 10px; padding: 10px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); color: var(--sw-text-2); align-items: start; }
      .drow .ik { inline-size: 28px; block-size: 28px; border-radius: var(--sw-r-xs); display: grid; place-items: center; background: var(--cs); color: var(--ct); }
      .drow .dmain { display: grid; gap: 6px; min-inline-size: 0; }
      .drow .dname { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; min-inline-size: 0; }
      .drow .dname b { color: var(--sw-heading); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-inline-size: 100%; }
      .drow .dname small, .drow .dwhen { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
      .drow .dk { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .drow .dlist { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
      .drow .dlist li { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; line-height: 1.45; }
      .drow .dlist b { color: var(--sw-text); font-weight: 600; }
      .drow .dact { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
      .pd-r { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 16px; border-block-end: 1px solid var(--sw-border); }
      .pd-r:last-child { border-block-end: 0; }
      .pd-w { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; }
      .pd-a { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
      .seg { display: flex; flex-wrap: wrap; gap: 6px; }
      .seg button { border: 1px solid var(--sw-border-strong); background: var(--sw-surface-solid); color: var(--sw-text); padding: 0 14px; border-radius: var(--sw-r-pill); min-block-size: var(--sw-touch-desktop); font: inherit; cursor: pointer; }
      .seg button[aria-pressed='true'] { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); font-weight: 600; }
      .seg button:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 2px; }
      @media (max-width: 1180px) {
        .cols { grid-template-columns: 1fr; }
        .side { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
      }
      @media (max-width: 900px) {
        .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .gl-h { display: none; }
        .gl-r { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'pn chev' 'st st' 'doors doors' 'win code'; gap: 8px 12px; }
        .gl-r .pn { grid-area: pn; } .gl-r .st { grid-area: st; } .gl-r .doors { grid-area: doors; } .gl-r .win { grid-area: win; } .gl-r .code { grid-area: code; justify-items: end; } .gl-r .chev { grid-area: chev; }
        .ap { grid-template-columns: 1fr; }
      }
      @media (max-width: 600px) {
        .pd-r { grid-template-columns: 1fr; }
        .pd-a { justify-content: flex-start; }
        .top { flex-direction: column; align-items: stretch; }
        .top .sp { display: none; }
        .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .flow { grid-template-columns: 1fr 1fr; }
        .two { grid-template-columns: 1fr; }
        .minis { grid-template-columns: repeat(2, 1fr); }
        .gl-r .code { justify-items: start; }
        .drow { grid-template-columns: 28px minmax(0, 1fr); }
        .drow .dact { grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; }
      }
    `,
    bubbleChrome,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void productSettings().then((ps) => (this.tz = String((ps as unknown as Record<string, unknown>)['time.zone'] || 'Asia/Jerusalem'))).catch(() => undefined);
    void this.load();
    void this.loadDigest();
    void this.loadDrift();
    this.timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !this.dialog) void this.load();
    }, POLL_MS);
    // a background tab skips the polls: it refreshes at once when it is shown again or the network returns
    document.addEventListener('visibilitychange', this.onResume);
    window.addEventListener('online', this.onResume);
    // the open drawer's "open since · duration" ages with the shared wall-clock ticker (CLOCK-293), never with a timer of its own
    this.unclock = subscribeClock(() => {
      if (this.sel) this.requestUpdate();
    });
  }

  disconnectedCallback(): void {
    window.clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.onResume);
    window.removeEventListener('online', this.onResume);
    this.unclock?.();
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('route') && this.data && !this.routed) this.applyRoute();
  }

  private applyRoute(): void {
    this.routed = true;
    const p = this.route?.params;
    const gid = p?.get('grant');
    if (gid && this.data?.grants.some((g) => g.id === gid)) void this.openDrawer(gid);
    if (p?.get('digest') === '1') this.openDigest();
    if (p?.get('request') === '1') this.openRequest();
    if (p?.get('drift') === '1') this.openDrift();
  }

  private async load(): Promise<void> {
    void this.loadPending();
    try {
      this.data = await listGrants(true);
      this.error = '';
      this.stale = false;
      this.loadedAt = Date.now();
      if (!this.routed) this.applyRoute();
      if (this.sel && !this.dialog) {
        const g = this.data.grants.find((x) => x.id === this.sel);
        if (g) this.detail = { ...g, closure: g.closure ? { ...g.closure, reference: this.detail?.closure?.reference } : null };
      }
    } catch (e) {
      // with a list on the screen, a failed poll keeps it and says how old it is (stale); without one, the error panel
      this.error = describeError(e);
      this.stale = !!this.data;
    }
  }

  /** SECFIX2-295: the undecided vendor-typed technicians - only for those who may decide (a 403 or any failure shows nothing). */
  private async loadPending(): Promise<void> {
    try {
      this.pending = await listPendingContacts();
    } catch {
      this.pending = null;
    }
  }

  private async loadDigest(): Promise<void> {
    try {
      this.digest = (await getDigest()).digest;
    } catch {
      this.digest = null;
    }
  }

  private async loadDrift(): Promise<void> {
    try {
      this.drift = (await getDrift()).drift;
    } catch {
      this.drift = null;
    }
  }

  private async exportCsv(): Promise<void> {
    this.exporting = true;
    try {
      const res = await exportGrantsCsv(xtLang() === 'he' ? 'he' : 'en');
      saveFile(res.blob, res.filename);
      this.toast('exportDone', { n: res.rows });
    } catch (e) {
      if (e instanceof ApiError && e.body.code === 'export_rate') this.toast('exportRate');
      else {
        this.error = describeError(e);
        this.toast('failed');
      }
    } finally {
      this.exporting = false;
    }
  }

  private toast(key: XtKey, vars?: Record<string, string | number>): void {
    this.toastText(xt(key, vars));
  }

  private toastText(text: string): void {
    const id = ++this.toastSeq;
    this.toasts = [...this.toasts, { id, text }];
    window.setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), 3200);
  }

  private fmt(iso: string | null | undefined, withDate = true): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    try {
      return d.toLocaleString(document.documentElement.lang || 'he-IL', { timeZone: this.tz, ...(withDate ? { day: '2-digit', month: '2-digit' } : {}), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    } catch {
      return d.toLocaleString();
    }
  }

  // ---------------------------------------------------------------- the drawer

  private async openDrawer(id: string): Promise<void> {
    this.sel = id;
    this.detail = this.data?.grants.find((g) => g.id === id) ?? null;
    try {
      const g = (await getGrant(id)).grant;
      if (this.sel === id) this.detail = g; // a drawer closed (or another opened) meanwhile stays as it is
    } catch {
      /* the list row stays */
    }
  }

  private closeDrawer(): void {
    this.sel = null;
    this.detail = null;
    this.rb = null;
    this.cardNo = '';
    this.history = null;
  }

  private async act(fn: () => Promise<unknown>, done: XtKey, vars?: Record<string, string | number>, doneText?: string): Promise<boolean> {
    this.busy = true;
    this.dlgError = '';
    try {
      await fn();
      if (doneText) this.toastText(doneText);
      else this.toast(done, vars);
      await this.load();
      if (this.sel) await this.openDrawer(this.sel);
      void this.loadDigest();
      void this.loadDrift();
      return true;
    } catch (e) {
      this.dlgError = describeError(e);
      if (!this.dialog) this.toast('failed');
      return false;
    } finally {
      this.busy = false;
    }
  }

  /**
   * SHAREDUI-295: "read back now" with a terminal answer. The worker keeps its own holds (a read while an earlier write may still land
   * decides nothing), so the screen never counts down: it asks, then says what came back - the new state (a toast), or "checked at HH:MM:
   * still ..." (kept in the drawer), or why the read failed - and the button is ready again.
   */
  private async readBack(id: string): Promise<void> {
    const before = this.data?.grants.find((g) => g.id === id) ?? (this.detail?.id === id ? this.detail : null);
    this.reading = id;
    this.rb = null;
    try {
      const r = await readNow(id);
      const at = new Date().toISOString();
      await this.load();
      const after = this.data?.grants.find((g) => g.id === id) ?? r?.grant ?? null;
      if (this.sel === id) await this.openDrawer(id);
      void this.loadDigest();
      if (!before) return;
      const o = readOutcome(before, after);
      if (o.kind === 'changed') this.toast('rb_changed', { state: xt(o.key as XtKey) });
      else {
        this.rb = { id, at, kind: 'still', key: o.key };
        if (this.sel !== id) this.toast(o.key as XtKey, { t: this.fmt(at, false) }); // from the digest: no drawer to keep the line in
      }
    } catch (e) {
      this.rb = { id, at: new Date().toISOString(), kind: 'error', key: 'rb_failed', why: describeError(e) };
      if (this.sel !== id) this.toast('failed');
    } finally {
      this.reading = null;
    }
  }

  private rbLine(g: Grant): TemplateResult | typeof nothing {
    const r = this.rb;
    if (!r || r.id !== g.id) return nothing;
    const t = this.fmt(r.at, false);
    return r.kind === 'error'
      ? html`<p class="rb-line" data-tone="err" role="alert" data-readback-result="error"><sw-icon name="warning" size="14"></sw-icon>${xt('rb_failed', { t, why: r.why ?? '' })}</p>`
      : html`<p class="rb-line" role="status" data-readback-result="still"><sw-icon name="clock" size="14"></sw-icon>${xt(r.key as XtKey, { t })}</p>`;
  }

  private readBtn(g: Grant, primary: boolean, offline: boolean): TemplateResult {
    const busy = this.reading === g.id;
    const again = this.rb?.id === g.id;
    return html`<sw-button variant=${primary ? 'primary' : 'secondary'} icon="refresh" data-action="read" aria-busy=${String(busy)} ?disabled=${busy || offline || this.busy}
      @click=${() => this.readBack(g.id)}>${busy ? xt('rb_reading') : again ? xt('a_readAgain') : xt('a_readNow')}</sw-button>`;
  }

  private confirm(c: Confirm): void {
    this.word = '';
    this.dlgError = '';
    this.dialog = { kind: 'confirm', c };
  }

  private name(g: Grant): string {
    return g.person.name || '—';
  }

  private badge(g: Grant, soft = false): TemplateResult {
    const s = uiState(g);
    return html`<span class="badge ${soft ? 'soft' : ''}" data-tone=${STATE_TONE[s]} data-ui-state=${s}><sw-icon name=${STATE_ICON[s]} size="14"></sw-icon>${xt(`st_${s}` as XtKey)}</span>`;
  }

  private codeCell(g: Grant): TemplateResult {
    const c = codeOf(g);
    if (!c) return html`<span class="chip" data-tone="off">${xt('code_hidden')}</span>`;
    const when = c.key === 'code_pending' ? this.fmt(g.code_due_at) : '';
    return html`<span class="chip" data-tone=${c.tone} data-code-state=${g.code_state ?? ''}><sw-icon name=${c.tone === 'warn' ? 'warning' : 'mail'} size="13"></sw-icon>${xt(c.key as XtKey, { when })}</span>${g.person.number ? html`<small class="num">${xt('whatsapp')} ${g.person.number}</small>` : nothing}`;
  }

  private doorChips(g: Grant): TemplateResult {
    return html`<span class="chips">${g.doors.map((d) => html`<span class="chip door" data-tone="acc"><sw-icon name="door" size="13"></sw-icon>${d.name}</span>`)}${this.amendAdds(g).map((d) => html`<span class="chip door add"><sw-icon name="plus" size="13"></sw-icon>${d}</span>`)}</span>`;
  }

  /** Stations a widening adds (names when the list knows them). */
  private amendAdds(g: Grant): string[] {
    if (!g.pending_amendment) return [];
    const have = new Set(g.doors.map((d) => d.station_id));
    const names = new Map((this.data?.grants ?? []).flatMap((x) => x.doors).map((d) => [d.station_id, d.name] as const));
    return Object.keys(g.pending_amendment.doors).filter((s) => !have.has(s)).map((s) => names.get(s) ?? s);
  }

  private reasonText(reason: string | null): string {
    return xtDynamic(`reason_${reason ?? 'manual'}`, 'reason_manual');
  }

  private drawer(): TemplateResult | typeof nothing {
    const g = this.detail;
    if (!g) return nothing;
    const s = uiState(g);
    const a = actionsOf(g, !!this.data?.system_admin);
    const lad = ladder(g);
    const ds = doorState(g);
    const tone = STATE_TONE[s];
    const sub = [g.company, xt(g.category === 'contractor' ? 'contractor' : 'visitor'), g.source_ref ? `${xt(SRC_KEY[g.source] ?? 'srcManual')} ${g.source_ref}` : xt(SRC_KEY[g.source] ?? 'srcManual')].filter(Boolean).join(' · ');
    const since = g.revoking_since ? Math.max(0, (Date.now() - Date.parse(g.revoking_since)) / 60000) : 0;
    const missing = g.link?.state === 'wiskey_missing';
    const offline = wiskeyOffline(this.data);
    const rbv = readbackView(g, offline);
    return html`<sw-drawer modal .open=${true} heading=${this.name(g)} subheading=${sub} data-grant-drawer=${g.id} @close=${() => this.closeDrawer()}>
      <div class="db">
        <div class="dhead">${this.badge(g, true)}${g.pending_amendment ? html`<span class="chip" data-tone="acc">${xt('widening')}</span>` : nothing}</div>
        <div class="callout" data-tone=${tone}><sw-icon name=${STATE_ICON[s]} size="18"></sw-icon><div><b>${xt(`st_${s}` as XtKey)}</b>${xtDynamic(whyKey(g), 'why_pending')}</div></div>
        ${s === 'revoking'
          ? html`<div class="callout" data-tone="off" data-revoke-box><sw-icon name="bell" size="18"></sw-icon><div><b>${xt('openSince', { t: this.fmt(g.revoking_since), d: durationText(since, xtLang()) })}</b>${this.reasonText(g.end_reason)}</div></div>`
          : nothing}
        ${rbv ? this.readbackBox(g, rbv, a.readNow) : nothing}
        ${g.pending_amendment
          ? html`<section class="sec"><h4><sw-icon name="plus" size="14"></sw-icon>${xt('amendTitle')}</h4><div class="diff"><span class="h"></span><span class="h">${xt('amendNow')}</span><span class="h">${xt('amendAsked')}</span>
              <span>${xt('doorsTitle')}</span><span class="chips">${g.doors.map((d) => html`<span class="chip door" data-tone="acc">${d.name}</span>`)}</span><span class="chips">${g.doors.map((d) => html`<span class="chip door" data-tone="acc">${d.name}</span>`)}${this.amendAdds(g).map((d) => html`<span class="chip door add">${d}</span>`)}</span>
              <span>${xt('dates')}</span><b class="num">${datesText(g.valid_from, g.valid_until, this.tz)}</b><b class="num">${datesText(g.pending_amendment.valid_from, g.pending_amendment.valid_until, this.tz)}</b></div></section>`
          : nothing}
        ${s === 'sync' ? html`<div class="callout" data-tone="warn"><sw-icon name="refresh" size="18"></sw-icon><div><b>${xt('syncTitle')}</b>${xt('syncText')}</div></div>` : nothing}
        ${s === 'unknown'
          ? html`<div class="ku"><div><h4><sw-icon name="check" size="14"></sw-icon>${xt('un_known')}</h4><ul><li>${xt('un_k1')}</li><li>${xt('un_k2')}</li></ul></div>
              <div class="unk"><h4><sw-icon name="help" size="14"></sw-icon>${xt('un_unknown')}</h4><ul><li>${xt('un_u1')}</li><li>${xt('un_u2')}</li><li>${xt('un_u3')}</li></ul></div></div>`
          : nothing}
        <section class="sec"><h4><sw-icon name="layers" size="14"></sw-icon>${xt(lad.revoke ? 'ladderRevokeTitle' : 'ladderTitle')}</h4>
          <div class="ladder" style=${`--n:${lad.steps.length}`} role="list" data-ladder>${lad.steps.map((st) => html`<div class="stp" role="listitem" data-s=${st.mark}><i aria-hidden="true">${{ done: '✓', cur: '•', unk: '?', stop: '!', no: '' }[st.mark]}</i>${xt(st.key as XtKey)}</div>`)}</div>
          ${this.howBlock(s, missing)}</section>
        <section class="sec"><h4><sw-icon name="door" size="14"></sw-icon>${xt('doorsTitle')}${s === 'unknown' ? html`<span class="chip" data-tone="warn">${xt('mapUnknown')}</span>` : nothing}</h4>
          <div class="dtable">${g.doors.flatMap((d) => d.relays.map((r) => html`<div data-door=${`${d.station_id}:${r}`}><span><b>${d.name}</b><small>${xt('doorN', { n: r })}</small></span><span class="chip" data-tone=${ds.tone}>${xt(ds.key as XtKey)}</span></div>`))}</div></section>
        <section class="sec"><h4><sw-icon name="calendar" size="14"></sw-icon>${xt('windowTitle')}</h4><div class="kv">
          <div><span>${xt('dates')}</span><b class="num">${datesText(g.valid_from, g.valid_until, this.tz)}</b></div>
          <div><span>${xt('hours')}</span><b class="num">${hoursText(g, this.tz)}</b></div>
          <div><span>${xt('source')}</span><b>${xt(SRC_KEY[g.source] ?? 'srcManual')} ${g.source_ref ? html`<span class="num">${g.source_ref}</span>` : nothing}</b></div></div></section>
        ${g.credential === 'pin'
          ? html`<section class="sec"><h4><sw-icon name="mail" size="14"></sw-icon>${xt('codeTitle')}</h4><div class="kv">
              <div><span>${xt('codeState')}</span><b>${this.codeCell(g)}</b></div>
              ${g.person.number ? html`<div><span>${xt('sentTo')}</span><b class="num">${xt('whatsapp')} ${g.person.number}</b></div>` : nothing}
              <div><span>${xt('theCode')}</span><b style="color:var(--sw-text-3)"><sw-icon name="lock" size="14"></sw-icon> ${xt('neverShown')}</b></div></div></section>`
          : nothing}
        ${this.cardBlock(g)}
        ${g.closure?.reference ? html`<section class="sec"><h4><sw-icon name="info" size="14"></sw-icon>${xt('gone_ref_label')}</h4><p style="margin:0" data-closure-reference>${g.closure.reference}</p></section>` : nothing}
        <section class="sec" data-grant-identity><access-identity-card compact contact-id=${g.person.contact_id} name=${this.name(g)} .tz=${this.tz} @changed=${() => this.load()}></access-identity-card></section>
        ${this.timelineBlock(g)}
        ${rbv ? nothing : this.rbLine(g)}
        ${this.historyBlock(g)}
        <div class="dfoot">${this.drawerActions(g, a, !!rbv, offline)}</div>
      </div>
    </sw-drawer>`;
  }

  /** The explanations of the state (how Arx decides) sit behind one disclosure: the drawer itself stays facts and actions. */
  private howBlock(s: string, missing: boolean): TemplateResult {
    const items: XtKey[] = [
      ...(s === 'unknown' ? (['un_a1', 'un_a2', 'un_a3', 'un_a4'] as XtKey[]) : []),
      ...(s === 'revoking' ? ((missing ? ['rv_missing1', 'rv_missing2'] : ['rv_note1', 'rv_note2']) as XtKey[]) : []),
      'ladNote',
    ];
    return html`<details class="more" data-how><summary><sw-icon name="info" size="14"></sw-icon>${xt('moreWhy')}</summary><ul>${items.map((k) => html`<li>${xt(k)}</li>`)}</ul></details>`;
  }

  /**
   * SHAREDUI-295: the read-back wait - no number (see model.readbackView): an indeterminate mark, what Arx does by itself, "read back
   * now" with its terminal answer under it. With WisKey offline it says so and the read waits for the connection.
   */
  private readbackBox(g: Grant, v: 'pending' | 'offline', canRead: boolean): TemplateResult {
    const off = v === 'offline';
    return html`<div class="rb" data-readback=${v} data-tone=${off ? 'off' : 'warn'}>
      <span class="rb-mark" aria-hidden="true"><i></i></span>
      <div class="rb-t"><b>${xt('rb_waitTitle')}</b><span>${off ? xt('rb_offline') : xt('rb_waitText')}</span>${this.rbLine(g)}</div>
      ${canRead ? this.readBtn(g, uiState(g) === 'unknown', off) : nothing}
    </div>`;
  }

  /** GRANTS3-295 (X5): a card grant's card - its state, and for an active grant waiting for its card the number field (the number goes to
   * WisKey only and is cleared from this screen at once); reading the card at a reader stays off (the capture lease route). */
  private cardBlock(g: Grant): TemplateResult | typeof nothing {
    if (g.credential !== 'card') return nothing;
    const cs = g.card_state ?? null;
    const tone = cs === 'attached' ? 'ok' : cs === 'unknown' ? 'warn' : cs === 'removed' ? 'off' : 'acc';
    const canSave = g.state === 'active' && (cs === 'awaiting' || cs === 'unknown');
    return html`<section class="sec" data-card-block=${cs ?? ''}><h4><sw-icon name="lock" size="14"></sw-icon>${xt('cardTitle')}</h4><div class="kv">
        <div><span>${xt('codeState')}</span><b>${cs ? html`<span class="chip" data-tone=${tone} data-card-state=${cs}>${xt(`card_${cs}` as XtKey)}</span>` : html`<span class="chip" data-tone="off">${xt('code_hidden')}</span>`}</b></div>
        <div><span>${xt('cardNo')}</span><b style="color:var(--sw-text-3)"><sw-icon name="lock" size="14"></sw-icon> ${xt('cardNeverKept')}</b></div></div>
      ${canSave ? html`<div class="row" style="margin-block-start:8px;flex-wrap:wrap;gap:8px">
          <input class="in" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="32" dir="ltr" aria-label=${xt('cardNo')} placeholder=${xt('cardNo')}
            data-card-no .value=${this.cardNo} @input=${(e: Event) => { this.cardNo = (e.target as HTMLInputElement).value; }} style="flex:1 1 160px;min-inline-size:0" />
          <sw-button variant="primary" icon="check" data-action="card-save" ?disabled=${this.busy || !this.cardNo.trim()} @click=${() => this.saveCard(g)}>${xt('cardAttach')}</sw-button>
          <sw-button icon="lock" data-action="card-read" disabled title=${xt('cardReadOff')}>${xt('cardRead')}</sw-button></div>
          <p class="note" data-card-read-off><sw-icon name="info" size="14"></sw-icon>${xt('cardReadOff')}</p>` : nothing}
    </section>`;
  }

  private async saveCard(g: Grant): Promise<void> {
    const number = this.cardNo.trim();
    this.cardNo = ''; // the field never keeps the number after the press, whatever the answer
    await this.act(() => attachCard(g.id, g.revision, number), 'cardAttachDone');
  }

  /** GRANTS3-295: the owner's per-grant history (system administrators): who, what and the closed reason codes - never a code or a number. */
  private historyBlock(g: Grant): TemplateResult | typeof nothing {
    if (!this.data?.system_admin) return nothing;
    const h = this.history?.id === g.id ? this.history : null;
    const who = (r: HistoryRow) => (r.by.kind === 'page' ? xt('hist_page') : r.by.kind === 'system' ? xt('hist_system') : r.by.name ?? '—');
    return html`<section class="sec" data-grant-history><h4><sw-icon name="history" size="14"></sw-icon>${xt('histTitle')}</h4>
      ${!h ? html`<sw-button size="sm" data-history-show @click=${() => void this.loadHistory(g.id)}>${xt('histShow')}</sw-button>`
        : h.error ? html`<p class="err-line" role="alert">${h.error}</p>`
        : !h.rows ? html`<sw-state-panel state="loading"></sw-state-panel>`
        : !h.rows.length ? html`<p class="note">${xt('histEmpty')}</p>`
        : html`<ol class="tl" data-history>${h.rows.map((r) => html`<li data-history-action=${r.action}><time>${this.fmt(r.at)}</time><i data-tone=${r.decision === 'denied' ? 'warn' : 'acc'}></i>
            <span>${xtDynamic(`h_${r.action}`, 'h_other')}${r.decision === 'denied' ? html` · <b>${xt('hist_denied')}</b>` : nothing} · ${who(r)}${r.reason ? html` · <small class="num">${r.reason}</small>` : nothing}</span></li>`)}</ol>`}
    </section>`;
  }

  private async loadHistory(id: string): Promise<void> {
    this.history = { id, rows: null, error: '' };
    try {
      const rows = (await getHistory(id)).history;
      if (this.history?.id === id) this.history = { id, rows, error: '' };
    } catch (e) {
      if (this.history?.id === id) this.history = { id, rows: null, error: describeError(e) };
    }
  }

  private timelineBlock(g: Grant): TemplateResult | typeof nothing {
    const ev = timeline(g);
    if (!ev.length) return nothing;
    return html`<section class="sec"><h4><sw-icon name="clock" size="14"></sw-icon>${xt('happened')}</h4><ol class="tl" data-timeline>${ev.map(
      (e) => html`<li><time>${this.fmt(e.at)}</time><i data-tone=${e.tone}></i><span>${xt(e.key as XtKey, e.key === 'ev_revoking' ? { reason: this.reasonText(e.vars?.reason ?? null) } : e.vars)}</span></li>`,
    )}</ol></section>`;
  }

  private drawerActions(g: Grant, a: ReturnType<typeof actionsOf>, inBox = false, offline = false): TemplateResult {
    const out: TemplateResult[] = [];
    const name = this.name(g);
    if (a.accept)
      out.push(html`<sw-button variant="primary" icon="user" data-action="accept" ?disabled=${this.busy} @click=${() => this.confirm({ title: xt('acceptQ'), body: html`<p>${xt('acceptText')}</p>`, btn: xt('a_accept'), run: () => acceptContact(g.person.contact_id), done: 'acceptDone' })}>${xt('a_accept')}</sw-button>`);
    if (a.approve) out.push(html`<sw-button variant="primary" icon="check" data-action="approve" ?disabled=${this.busy} @click=${() => this.openApprove(g)}>${g.pending_amendment ? xt('a_reviewWidening') : xt('a_approve')}</sw-button>`);
    if (a.refuse)
      out.push(html`<sw-button variant="danger" data-action="refuse" ?disabled=${this.busy} @click=${() => this.confirm({ title: xt('refuseQ'), body: html`<p>${g.pending_amendment && g.state !== 'requested' ? xt('refuseWidenText') : xt('refuseText')}</p>`, btn: xt('a_refuse'), danger: true, run: () => refuseGrant(g.id, g.revision), done: 'refuseDone' })}>${xt('a_refuse')}</sw-button>`);
    if (a.retry) out.push(html`<sw-button icon="refresh" data-action="retry" ?disabled=${this.busy || offline} @click=${() => this.act(() => provisionNow(g.id), 'retryDone')}>${xt('a_retry')}</sw-button>`);
    if (a.rotate)
      out.push(html`<sw-button icon="refresh" data-action="rotate" ?disabled=${this.busy} @click=${() => this.confirm({ title: xt('rotateQ'), body: html`<p>${xt('rotateText', { n: g.person.number ?? '', left: Math.max(0, 3 - (g.code_sends ?? 0)) })}</p>`, btn: xt('a_rotate'), run: () => rotateCode(g.id, g.revision), done: 'rotateDone' })}>${xt('a_rotate')}</sw-button>`);
    if (a.readNow && !inBox) out.push(this.readBtn(g, false, offline));
    out.push(html`<span class="sp"></span>`);
    if (a.gone) out.push(html`<sw-button variant="danger" icon="user" data-action="gone" ?disabled=${this.busy} @click=${() => this.openGone(g)}>${xt('a_gone')}</sw-button>`);
    if (a.revoke)
      out.push(html`<sw-button variant="danger" icon="lock" data-action="revoke" ?disabled=${this.busy} @click=${() => this.confirm({ title: xt('revokeQ', { name }), body: html`<p>${xt('revokeText')}</p>${this.doorChips(g)}`, btn: xt('a_revoke'), danger: true, run: () => revokeGrant(g.id), done: 'revokeDone' })}>${xt('a_revoke')}</sw-button>`);
    const any = Object.values(a).some(Boolean);
    return any ? html`${out}` : html`<span class="note">${xt('noActions')}</span>`;
  }

  // ---------------------------------------------------------------- dialogs

  private openApprove(g: Grant): void {
    const scope = g.pending_amendment;
    const doors = scope ? Object.entries(scope.doors).flatMap(([s, rs]) => rs.map((r) => `${s}:${r}`)) : g.doors.flatMap((d) => d.relays.map((r) => `${d.station_id}:${r}`));
    this.apDoors = new Set(doors);
    const vf = scope?.valid_from ?? g.valid_from;
    const vu = scope?.valid_until ?? g.valid_until;
    this.apFrom = localDate(vf, this.tz);
    this.apUntil = lastDay(vu, this.tz);
    this.apTold = false;
    this.dlgError = '';
    this.dialog = { kind: 'approve', id: g.id };
  }

  private approveDialog(g: Grant): TemplateResult {
    const scope = g.pending_amendment;
    const wide = !!scope && g.state !== 'requested';
    const vf = scope?.valid_from ?? g.valid_from;
    const vu = scope?.valid_until ?? g.valid_until;
    const rules = this.data?.rules;
    const max = rules?.max_days ?? 14;
    const win = narrowWindow(vf, vu, this.apFrom, this.apUntil, this.tz, max);
    const names = new Map((this.data?.grants ?? []).flatMap((x) => x.doors).map((d) => [d.station_id, d.name] as const));
    const rows = scope ? Object.entries(scope.doors).flatMap(([s, rs]) => rs.map((r) => ({ s, r, name: names.get(s) ?? s }))) : g.doors.flatMap((d) => d.relays.map((r) => ({ s: d.station_id, r, name: d.name })));
    const have = new Set(g.doors.flatMap((d) => d.relays.map((r) => `${d.station_id}:${r}`)));
    const n = this.apDoors.size;
    const pageNotice = g.notice.find((x) => x.via === 'page');
    const anyNotice = g.notice[0];
    const needTold = !pageNotice && !g.notice.some((x) => x.via === 'approver');
    const ok = n > 0 && !win.error && (!needTold || this.apTold) && !this.busy;
    const record = g.link ? (g.link.origin === 'matched' ? 'ap_recordMatched' : 'ap_recordOurs') : 'ap_recordNew';
    const doorsObj: Record<string, number[]> = {};
    for (const k of this.apDoors) {
      const [s, r] = [k.slice(0, k.lastIndexOf(':')), Number(k.slice(k.lastIndexOf(':') + 1))];
      (doorsObj[s] ??= []).push(r);
    }
    const doorNames = [...new Set([...this.apDoors].map((k) => names.get(k.slice(0, k.lastIndexOf(':'))) ?? ''))].filter(Boolean).join(', ');
    const send = () =>
      this.act(async () => {
        await approveGrant(g.id, { revision: g.revision, doors: doorsObj, valid_from: win.valid_from, valid_until: win.valid_until, told: this.apTold || !needTold });
        this.dialog = null;
      }, 'ap_done');
    const winHint = win.error === 'too_long' ? xt('ap_tooLong', { n: win.days, max }) : win.error === 'before' ? xt('ap_before') : win.error === 'outside' ? xt('ap_outside') : xt('ap_days', { n: win.days, max, tz: this.tz });
    return html`<sw-dialog open wide heading=${wide ? xt('ap_widenTitle') : xt('ap_title')} subheading=${xt('ap_lead')} data-approve-dialog=${g.id} @close=${() => (this.dialog = null)}>
      <div class="ap">
        <div class="stack">
          ${wide ? html`<div class="callout" data-tone="warn"><sw-icon name="plus" size="18"></sw-icon><div>${xt('ap_widenCallout')}</div></div>` : nothing}
          <section class="sec"><h4><sw-icon name="user" size="14"></sw-icon>${xt('ap_who')}</h4><div class="kv">
            <div><span>${this.name(g)}</span><b>${[g.company, xt(g.category === 'contractor' ? 'contractor' : 'visitor')].filter(Boolean).join(' · ')}</b></div>
            <div><span>${xt('whatsapp')}</span><b class="num">${g.person.number ?? xt('ap_noNumber')}</b></div>
            <div><span>${xt('source')}</span><b>${xt(SRC_KEY[g.source] ?? 'srcManual')} ${g.source_ref ?? ''}</b></div>
            <div><span>${xt('ap_notice')}</span><b>${pageNotice ? xt('ap_noticePage', { v: pageNotice.version }) : anyNotice ? xt('ap_noticeApprover', { v: anyNotice.version }) : xt('ap_noticeNone')}</b></div>
            <div><span>${xt('ap_record')}</span><b>${xt(record)}</b></div></div></section>
          <section class="sec"><h4><sw-icon name="door" size="14"></sw-icon>${xt('ap_doors')} <span class="chip" data-tone="acc">${xt('ap_doorsCount', { n, max: rules?.max_doors ?? 4 })}</span></h4>
            <div class="dgrid">${rows.map(({ s, r, name }) => {
              const k = `${s}:${r}`;
              return html`<label class="cb"><input type="checkbox" data-approve-door=${k} .checked=${this.apDoors.has(k)} @change=${(e: Event) => {
                const next = new Set(this.apDoors);
                (e.target as HTMLInputElement).checked ? next.add(k) : next.delete(k);
                this.apDoors = next;
              }} /><span><b>${name}</b><small>${xt('doorN', { n: r })}${wide && !have.has(k) ? ` · ${xt('dr_amend')}` : ''}</small></span></label>`;
            })}</div>
            <span class="note ${n ? '' : 'e'}" style=${n ? '' : 'color:var(--sw-danger-text);font-weight:600'}>${n ? xt('ap_onlyNarrow') : xt('ap_pickOne')}</span></section>
          <section class="sec"><h4><sw-icon name="calendar" size="14"></sw-icon>${xt('ap_window')}</h4>
            <div class="two"><div class="field"><label for="vf">${xt('ap_from')}</label><input id="vf" class="in num" type="date" lang=${dateInputLang()} .value=${this.apFrom} min=${localDate(vf, this.tz)} max=${lastDay(vu, this.tz)} @input=${(e: Event) => (this.apFrom = (e.target as HTMLInputElement).value)} /></div>
            <div class="field"><label for="vu">${xt('ap_until')}</label><input id="vu" class="in num" type="date" lang=${dateInputLang()} .value=${this.apUntil} min=${localDate(vf, this.tz)} max=${lastDay(vu, this.tz)} aria-invalid=${win.error ? 'true' : 'false'} @input=${(e: Event) => (this.apUntil = (e.target as HTMLInputElement).value)} /></div></div>
            <span class="note" style=${win.error ? 'color:var(--sw-danger-text);font-weight:600' : ''} data-window-hint>${winHint}</span></section>
          <section class="sec"><h4><sw-icon name="clock" size="14"></sw-icon>${xt('ap_hours')}</h4><b class="num">${hoursText({ timing: scope?.timing ?? g.timing, valid_from: vf, valid_until: vu }, this.tz)}</b></section>
          ${needTold ? html`<label class="cb"><input type="checkbox" data-approve-told .checked=${this.apTold} @change=${(e: Event) => (this.apTold = (e.target as HTMLInputElement).checked)} /><span>${xt('ap_told')}</span></label>` : nothing}
        </div>
        <div class="stack">
          <div class="callout" data-tone="acc"><sw-icon name="shield" size="18"></sw-icon><div><b>${xt('ap_nothingTitle')}</b>${xt('ap_nothingText')}</div></div>
          <section class="sec"><h4><sw-icon name="mail" size="14"></sw-icon>${xt('ap_msgTitle')}</h4>
            <div class="bubble" data-approve-message>${xt('ap_msgBody', { doors: doorNames || '-', dates: win.error ? '-' : datesText(win.valid_from, win.valid_until, this.tz) })}</div>
            <p class="note"><sw-icon name="lock" size="14"></sw-icon>${xt('ap_msgNote')}</p></section>
          <section class="sec"><h4><sw-icon name="refresh" size="14"></sw-icon>${xt('ap_after')}</h4>
            <div class="flow"><div><b>1 · ${xt('ap_f1')}</b>${xt('ap_f1t')}</div><div><b>2 · ${xt('ap_f2')}</b>${xt('ap_f2t')}</div><div><b>3 · ${xt('ap_f3')}</b>${xt('ap_f3t')}</div><div><b>4 · ${xt('ap_f4')}</b><span class="num">${g.code_due_at ? this.fmt(g.code_due_at) : xt('r_codeAtValue', { h: rules?.code_hour ?? 18 })}</span></div></div></section>
        </div>
      </div>
      ${this.dlgError ? html`<p class="err-line" role="alert">${this.dlgError}</p>` : nothing}
      <div class="dfoot"><sw-button variant="danger" ?disabled=${this.busy} @click=${() => this.confirm({ title: xt('refuseQ'), body: html`<p>${wide ? xt('refuseWidenText') : xt('refuseText')}</p>`, btn: wide ? xt('ap_refuseWiden') : xt('a_refuse'), danger: true, run: () => refuseGrant(g.id, g.revision), done: 'refuseDone' })}>${wide ? xt('ap_refuseWiden') : xt('a_refuse')}</sw-button>
        <span class="sp"></span><sw-button variant="ghost" @click=${() => (this.dialog = null)}>${xt('back')}</sw-button>
        <sw-button variant="primary" icon="check" data-approve-ok ?disabled=${!ok} @click=${send}>${xt('ap_ok')}</sw-button></div>
    </sw-dialog>`;
  }

  private openGone(_g: Grant): void {
    this.goneChecks = [false, false, false];
    this.goneRef = '';
    this.word = '';
    this.dlgError = '';
    this.dialog = { kind: 'gone', id: _g.id };
  }

  private goneDialog(g: Grant): TemplateResult {
    const w = xt('gone_word');
    const refOk = goneReferenceOk(this.goneRef);
    const ok = this.goneChecks.every(Boolean) && refOk && this.word.trim() === w && !this.busy;
    const checks: XtKey[] = ['gone_ch1', 'gone_ch2', 'gone_ch3'];
    return html`<sw-dialog open wide heading=${xt('gone_title')} subheading=${`${this.name(g)} · ${xt('gone_sub')}`} data-gone-dialog=${g.id} @close=${() => (this.dialog = null)}>
      <div class="stack">
        <div class="ku"><div><h4><sw-icon name="check" size="14"></sw-icon>${xt('gone_knows')}</h4><ul><li>${xt('gone_k1')}</li>${g.link?.origin === 'created_from_arx' ? html`<li>${xt('gone_k2')}</li>` : nothing}</ul></div>
          <div class="unk"><h4><sw-icon name="help" size="14"></sw-icon>${xt('gone_cannot')}</h4><ul><li>${xt('gone_c1')}</li><li>${xt('gone_c2')}</li></ul></div></div>
        <div class="callout" data-tone="acc"><sw-icon name="info" size="18"></sw-icon><div><b>${xt('gone_does')}</b><ul><li>${xt('gone_d1')}</li><li>${xt('gone_d2')}</li><li>${xt('gone_d3')}</li><li>${xt('gone_d4')}</li></ul></div></div>
        <section class="sec"><h4><sw-icon name="check" size="14"></sw-icon>${xt('gone_checked')}</h4>${checks.map(
          (k, i) => html`<label class="cb"><input type="checkbox" data-gone-check=${i} .checked=${this.goneChecks[i]} @change=${(e: Event) => {
            const next = [...this.goneChecks];
            next[i] = (e.target as HTMLInputElement).checked;
            this.goneChecks = next;
          }} /><span>${xt(k)}</span></label>`,
        )}</section>
        <div class="field"><label for="gref">${xt('gone_ref')}</label><input id="gref" class="in" maxlength="128" placeholder=${xt('gone_refPh')} .value=${this.goneRef} aria-invalid=${this.goneRef && !refOk ? 'true' : 'false'} @input=${(e: Event) => (this.goneRef = (e.target as HTMLInputElement).value)} /><span class="hint ${this.goneRef && !refOk ? 'e' : ''}">${xt('gone_refHint')}</span></div>
        <div class="field"><label for="gw">${xt('typeWord', { w })}</label><input id="gw" class="in" autocomplete="off" .value=${this.word} @input=${(e: Event) => (this.word = (e.target as HTMLInputElement).value)} /></div>
      </div>
      ${this.dlgError ? html`<p class="err-line" role="alert">${this.dlgError}</p>` : nothing}
      <div class="dfoot"><span class="sp"></span><sw-button variant="ghost" @click=${() => (this.dialog = null)}>${xt('back')}</sw-button>
        <sw-button variant="danger" data-gone-ok ?disabled=${!ok} @click=${() => this.act(async () => {
          await confirmGone(g.id, { reference: this.goneRef, confirm: this.word.trim(), checks: this.goneChecks });
          this.dialog = null;
        }, 'gone_done')}>${xt('gone_ok')}</sw-button></div>
    </sw-dialog>`;
  }

  private confirmDialog(c: Confirm): TemplateResult {
    const ok = !this.busy && (!c.word || this.word.trim() === c.word);
    return html`<sw-dialog open heading=${c.title} data-confirm-dialog @close=${() => (this.dialog = null)}>
      <div class="stack">${c.body}${c.word ? html`<div class="field"><label for="cw">${xt('typeWord', { w: c.word })}</label><input id="cw" class="in" autocomplete="off" .value=${this.word} @input=${(e: Event) => (this.word = (e.target as HTMLInputElement).value)} /></div>` : nothing}</div>
      ${this.dlgError ? html`<p class="err-line" role="alert">${this.dlgError}</p>` : nothing}
      <div class="dfoot"><span class="sp"></span><sw-button variant="ghost" @click=${() => (this.dialog = null)}>${xt('back')}</sw-button>
        <sw-button variant=${c.danger ? 'danger' : 'primary'} data-confirm-ok ?disabled=${!ok} @click=${async () => {
          const r = await this.act(c.run, c.done, undefined, c.doneText);
          if (r) this.dialog = null;
        }}>${c.btn}</sw-button></div>
    </sw-dialog>`;
  }

  private openDigest(): void {
    void this.loadDigest();
    this.dialog = { kind: 'digest' };
  }

  private digestDialog(): TemplateResult {
    const d = this.digest;
    const mini = (n: number, k: XtKey, tone?: string) => html`<div class="mini"><b data-tone=${tone ?? nothing}>${n}</b><span>${xt(k)}</span></div>`;
    return html`<sw-dialog open wide heading=${xt('dg_title')} subheading=${d ? xt('dg_period', { from: this.fmt(d.period.from), until: this.fmt(d.period.until) }) : ''} data-digest-dialog @close=${() => (this.dialog = null)}>
      ${!d
        ? html`<sw-state-panel state="loading"></sw-state-panel>`
        : html`<div class="ap">
            <div class="stack">
              <section class="sec"><h4><sw-icon name="layers" size="14"></sw-icon>${xt('dg_numbers')}</h4><div class="minis">
                ${mini(d.counts.requests, 'c_requests')}${mini(d.counts.approved, 'c_approved')}${mini(d.counts.refused, 'c_refused')}
                ${mini(d.counts.ended_or_revoked, 'c_ended')}${mini(d.counts.closed_no_person, 'c_noPerson')}${mini(d.counts.confirmed_gone, 'c_gone')}</div></section>
              <section class="sec"><h4><sw-icon name="warning" size="14"></sw-icon>${xt('dg_gaps')}</h4>
                ${d.gaps.length
                  ? html`<div class="gaps">${d.gaps.map((x) => {
                      const k = x.kind === 'name' ? 'gap_name' : x.kind === 'scope' ? 'gap_scope' : 'gap_idle';
                      const t = x.kind === 'name' ? 'gap_nameText' : x.kind === 'scope' ? 'gap_scopeText' : 'gap_idleText';
                      return html`<div class="gap" data-gap=${x.kind} data-tone=${x.kind === 'idle_person' ? 'acc' : 'warn'}><span class="ik"><sw-icon name=${x.kind === 'idle_person' ? 'user' : 'warning'} size="15"></sw-icon></span>
                        <div><b>${xt(k as XtKey, { name: x.name ?? '—' })}</b>${xt(t as XtKey)}${x.since ? ` ${xt('gap_since', { t: this.fmt(x.since) })}` : ''}
                        ${x.kind === 'scope' && x.grant_id ? html`<div class="row" style="margin-block-start:6px"><sw-button size="sm" ?disabled=${this.reading === x.grant_id || wiskeyOffline(this.data)} @click=${() => this.readBack(x.grant_id!)}>${this.reading === x.grant_id ? xt('rb_reading') : xt('readBack')}</sw-button></div>` : nothing}</div></div>`;
                    })}</div>`
                  : html`<p class="note">${xt('dg_noGaps')}</p>`}</section>
            </div>
            <div class="stack">
              <section class="sec"><h4><sw-icon name="bell" size="14"></sw-icon>${xt('dg_slow')}</h4>${d.slow_revokes.length
                ? html`<div class="kv">${d.slow_revokes.map((x) => html`<div><span>${x.name ?? '—'}</span><b><span class="chip" data-tone=${x.open ? 'err' : 'off'}>${x.open ? xt('slowOpen', { d: durationText(x.minutes, xtLang()) }) : durationText(x.minutes, xtLang())}</span></b></div>`)}</div>`
                : html`<p class="note">${xt('dg_noSlow')}</p>`}</section>
              <section class="sec"><h4><sw-icon name="users" size="14"></sw-icon>${xt('dg_who')}</h4>${d.approvers.length
                ? html`<div class="kv">${d.approvers.map((x) => html`<div><span>${x.name ?? '—'}</span><b class="num">${x.count}</b></div>`)}</div>`
                : html`<p class="note">${xt('dg_noSlow')}</p>`}</section>
              <section class="sec"><h4><sw-icon name="mail" size="14"></sw-icon>${xt('dg_codes')}</h4><div class="kv">
                <div><span>${xt('codesSent')}</span><b class="num">${d.counts.codes_sent}</b></div><div><span>${xt('codesReplaced')}</span><b class="num">${d.counts.codes_replaced}</b></div>
                <div><span>${xt('codesNot')}</span><b class="num">${d.counts.codes_not_delivered}</b></div></div></section>
            </div>
          </div>
          <p class="note" style="margin-block-start:12px"><sw-icon name="info" size="14"></sw-icon>${xt('dg_foot')}</p>`}
    </sw-dialog>`;
  }

  // ---------------------------------------------------------------- ACCESSREQ-293: the manual request form

  private openRequest(): void {
    this.dialog = { kind: 'request', noPerm: !this.data?.may_request || !this.data?.enabled };
  }

  private requestDialog(noPerm: boolean): TemplateResult {
    const live = new Set((this.data?.grants ?? []).filter((g) => ['requested', 'approved', 'provisioning', 'active', 'unknown'].includes(g.state)).map((g) => g.person.contact_id));
    return html`<access-request-dialog .tz=${this.tz} .codeHour=${this.data?.rules.code_hour ?? 18} .live=${live} ?noPerm=${noPerm} ?cards=${this.data?.rules.cards === 'on'} @close=${() => (this.dialog = null)}
      @done=${(e: CustomEvent<{ text: string; grant?: Grant }>) => {
        this.dialog = null;
        this.toastText(e.detail.text);
        void this.load().then(() => (e.detail.grant ? this.openDrawer(e.detail.grant.id) : undefined));
      }}></access-request-dialog>`;
  }

  // ---------------------------------------------------------------- GRANTSMIN-295: the drift view (CR 2.3 / T12)

  private openDrift(): void {
    void this.loadDrift();
    this.dlgError = '';
    this.dialog = { kind: 'drift' };
  }

  private driftChecked(r: DriftRow): string {
    const t = [r.scope_checked_at, r.name_checked_at].filter((x): x is string => !!x).sort().at(-1);
    return t ? xt('drChecked', { t: this.fmt(t) }) : xt('drNotChecked');
  }

  private driftActions(r: DriftRow): TemplateResult[] {
    const out: TemplateResult[] = [];
    const kinds = r.diffs.map((d) => d.kind);
    const grant = r.grant;
    if (r.can.push_name && kinds.includes('name'))
      out.push(html`<sw-button size="sm" icon="refresh" data-drift-push=${r.link_id} ?disabled=${this.busy} @click=${() => this.act(() => pushName(r.link_id), 'act_pushDone')}>${xt('act_pushBtn')}</sw-button>`);
    if (grant && r.can.read_now && kinds.some((k) => READ_KINDS.includes(k)))
      out.push(html`<sw-button size="sm" icon="refresh" data-drift-read=${grant.id} ?disabled=${this.busy} @click=${() => this.act(() => readNow(grant.id), 'readDone')}>${xt('readBack')}</sw-button>`);
    if (grant && this.data?.grants.some((g) => g.id === grant.id))
      out.push(html`<sw-button size="sm" variant="ghost" data-drift-open=${grant.id} @click=${() => {
        this.dialog = null;
        void this.openDrawer(grant.id);
      }}>${xt('drOpen')}</sw-button>`);
    return out;
  }

  private driftRow(r: DriftRow, compact = false): TemplateResult {
    const head = r.diffs[0];
    return html`<div class="drow" role="listitem" data-drift-row=${r.contact_id} data-drift-kinds=${r.diffs.map((d) => d.kind).join(' ')} data-tone=${DRIFT_TONE[head.kind]}>
      <span class="ik" aria-hidden="true"><sw-icon name=${DRIFT_ICON[head.kind]} size="15"></sw-icon></span>
      <div class="dmain">
        <div class="dname"><b>${r.name ?? '—'}</b>${r.company ? html`<small>${r.company}</small>` : nothing}${compact ? nothing : html`<span class="chip" data-tone="off">${xt(`rec_${r.origin}` as XtKey)}</span>`}</div>
        ${compact
          ? html`<span class="dk">${r.diffs.map((d) => xt(`dk_${d.kind}` as XtKey)).join(' · ')}</span>`
          : html`<ul class="dlist">${r.diffs.map((d) => html`<li data-drift-kind=${d.kind}><span class="chip" data-tone=${DRIFT_TONE[d.kind]}>${xt(`dk_${d.kind}` as XtKey)}</span><span>${xt(`dkt_${d.kind}` as XtKey)}${d.kind === 'name' && r.name ? html` <b>${xt('drArxName', { name: r.name })}</b>` : nothing}${d.kind === 'idle_person' && d.since ? ` ${xt('gap_since', { t: this.fmt(d.since) })}` : ''}</span></li>`)}</ul>
              ${r.grant?.doors.length ? html`<span class="chips">${r.grant.doors.map((x) => html`<span class="chip door" data-tone="acc"><sw-icon name="door" size="13"></sw-icon>${x.name}</span>`)}</span>` : nothing}
              <small class="dwhen">${this.driftChecked(r)}</small>`}
      </div>
      ${compact ? nothing : html`<div class="dact">${this.driftActions(r)}</div>`}
    </div>`;
  }

  private driftDialog(): TemplateResult {
    const d = this.drift;
    return html`<sw-dialog open wide heading=${xt('drTitle')} subheading=${xt('drLead')} data-drift-dialog @close=${() => (this.dialog = null)}>
      ${!d
        ? html`<sw-state-panel state="loading"></sw-state-panel>`
        : html`<div class="stack">
            <div class="row"><span class="chip" data-tone="ok" data-drift-insync>${xt('drInSync', { n: d.in_sync })}</span>${d.name_sync === 'auto' ? html`<span class="chip" data-tone="acc">${xt('drAuto')}</span>` : nothing}</div>
            ${d.rows.length
              ? html`<div class="drows" role="list">${d.rows.map((r) => this.driftRow(r))}</div>`
              : html`<sw-state-panel icon="layers" state="empty" heading=${xt('drNone')} hint=${xt('drNoneText')}></sw-state-panel>`}
          </div>`}
      ${this.dlgError ? html`<p class="err-line" role="alert">${this.dlgError}</p>` : nothing}
      <div class="dfoot"><span class="sp"></span><sw-button variant="ghost" @click=${() => (this.dialog = null)}>${xt('back')}</sw-button></div>
    </sw-dialog>`;
  }

  private driftPanel(): TemplateResult | typeof nothing {
    const d = this.drift;
    if (!d || !d.enabled) return nothing;
    return html`<section class="panel" data-drift-panel>
      <h3><sw-icon name="layers" size="18"></sw-icon>${xt('drTitle')}<span class="sp"></span><span class="chip num" data-tone=${d.rows.length ? 'warn' : 'ok'}>${d.rows.length}</span></h3>
      ${d.rows.length ? html`<div class="drows" role="list">${d.rows.slice(0, 3).map((r) => this.driftRow(r, true))}</div>` : html`<p class="lead">${xt('drNoneText')}</p>`}
      <div class="row"><sw-button size="sm" data-open-drift @click=${() => this.openDrift()}>${xt('drAll', { n: d.rows.length })}</sw-button><span class="note">${xt('drInSync', { n: d.in_sync })}</span></div>
    </section>`;
  }

  private openSettings(): void {
    const s = this.data?.screen;
    if (!s) return;
    this.draft = { ...s };
    this.dlgError = '';
    this.dialog = { kind: 'settings' };
    this.loadReadiness();
  }

  private loadReadiness(): void {
    this.readiness = null;
    getReadiness().then((r) => (this.readiness = r)).catch(() => (this.readiness = 'error'));
  }

  /** EXTERNALBUILD-297: the main switch and the read-only readiness lines (ok / missing / unknown, the server's Hebrew text). */
  private activationSection(): TemplateResult {
    const on = !!this.data?.enabled;
    const r = this.readiness;
    const tone = { ok: 'ok', blocked: 'err', unknown: 'warn' } as const;
    const set = (v: 'on' | 'off') => this.act(async () => {
      await setExternalGrants(v);
      await this.load();
      this.loadReadiness();
    }, 'set_saved');
    return html`<section class="sec" data-sec="activation"><h4>${xt('act_title')}</h4>
      <div class="seg" role="group" data-external-switch><button type="button" aria-pressed=${String(!on)} data-setting="external_grants:off" ?disabled=${this.busy} @click=${() => on && void set('off')}>${xt('act_off')}</button>
        <button type="button" aria-pressed=${String(on)} data-setting="external_grants:on" ?disabled=${this.busy} @click=${() => !on && void set('on')}>${xt('act_on')}</button></div>
      <h4>${xt('rd_title')}</h4>
      ${r === null ? html`<p class="note" data-readiness="loading">${xt('rd_loading')}</p>`
        : r === 'error' ? html`<p class="err-line" data-readiness="error">${xt('rd_error')}</p>`
        : html`<p class="note" data-readiness=${r.ready ? 'ready' : 'missing'}><b>${r.summary}</b></p>
          <ul class="rd" role="list">${r.lines.map((ln) => html`<li data-rd=${ln.key} data-rd-state=${ln.state}><span class="chip" data-tone=${tone[ln.state]}>${xt(`rd_${ln.state}` as XtKey)}</span>
            <span><b>${ln.label}</b> · ${ln.text}</span></li>`)}</ul>`}
    </section>`;
  }

  private settingsDialog(): TemplateResult {
    const d = this.draft!;
    const seg = <K extends keyof ScreenSettings>(key: K, items: [ScreenSettings[K], XtKey][]) => html`<div class="seg" role="group">${items.map(
      ([v, k]) => html`<button type="button" aria-pressed=${String(d[key] === v)} data-setting=${`${String(key)}:${String(v)}`} @click=${() => (this.draft = { ...d, [key]: v })}>${xt(k)}</button>`,
    )}</div>`;
    const days: DropdownItem[] = DAYS.map((n) => ({ id: String(n), label: xt(`day${n}` as XtKey) }));
    const hours: DropdownItem[] = Array.from({ length: 24 }, (_, h) => ({ id: String(h), label: `${String(h).padStart(2, '0')}:00` }));
    return html`<sw-dialog open heading=${xt('set_title')} subheading=${xt('set_sub')} data-settings-dialog @close=${() => (this.dialog = null)}>
      <div class="stack">
        ${this.activationSection()}
        <section class="sec"><h4>${xt('set_placement')}</h4>${seg('placement', [['access', 'pl_access'], ['tickets', 'pl_tickets'], ['both', 'pl_both']])}</section>
        <section class="sec"><h4>${xt('set_digest')}</h4>
          <div class="field"><label>${xt('set_channel')}</label>${seg('digest_channel', [['app', 'ch_app'], ['app_whatsapp', 'ch_app_whatsapp']])}</div>
          <div class="two"><sw-dropdown tall label=${xt('set_day')} .items=${days} .value=${String(d.digest_day)} @change=${(e: CustomEvent<{ id: string }>) => (this.draft = { ...d, digest_day: Number(e.detail.id) })}></sw-dropdown>
          <sw-dropdown tall label=${xt('set_hour')} .items=${hours} .value=${String(d.digest_hour)} @change=${(e: CustomEvent<{ id: string }>) => (this.draft = { ...d, digest_hour: Number(e.detail.id) })}></sw-dropdown></div></section>
        <section class="sec"><h4>${xt('set_name')}</h4>${seg('name_sync', [['manual', 'ns_manual'], ['auto', 'ns_auto']])}</section>
        <section class="sec"><h4>${xt('set_arrival')}</h4>${seg('arrival_after_grant', [['off', 'ar_off'], ['on', 'ar_on']])}</section>
      </div>
      ${this.dlgError ? html`<p class="err-line" role="alert">${this.dlgError}</p>` : nothing}
      <div class="dfoot"><span class="sp"></span><sw-button variant="ghost" @click=${() => (this.dialog = null)}>${xt('back')}</sw-button>
        <sw-button variant="primary" data-settings-save ?disabled=${this.busy} @click=${() => this.act(async () => {
          await putScreenSettings(d);
          this.dialog = null;
          applyExternalPlacement({ 'access.external.placement': d.placement }); // owner decision 6: the tab moves at once
        }, 'set_saved')}>${xt('set_save')}</sw-button></div>
    </sw-dialog>`;
  }

  private dialogs(): TemplateResult | typeof nothing {
    const dl = this.dialog;
    if (!dl) return nothing;
    if (dl.kind === 'confirm') return this.confirmDialog(dl.c);
    if (dl.kind === 'digest') return this.digestDialog();
    if (dl.kind === 'drift') return this.driftDialog();
    if (dl.kind === 'settings') return this.draft ? this.settingsDialog() : nothing;
    if (dl.kind === 'request') return this.requestDialog(dl.noPerm);
    const g = this.data?.grants.find((x) => x.id === dl.id) ?? (this.detail?.id === dl.id ? this.detail : null);
    if (!g) return nothing;
    if (dl.kind === 'approve') return this.approveDialog(g);
    if (dl.kind === 'gone') return this.goneDialog(g);
    return nothing;
  }

  // ---------------------------------------------------------------- SECFIX2-295: undecided vendor-typed technicians

  /** The technicians vendors typed on the public page that nobody decided yet: name, vendor, the request (only while tickets are on;
   * text, never a link), how long waiting, the auto-delete countdown; approve / reject-and-delete through the existing routes only.
   * Hidden when empty or when the caller may not decide (the server answered 403). */
  private pendingPanel(): TemplateResult | typeof nothing {
    const p = this.pending;
    if (!p || !p.pending.length) return nothing;
    return html`<section class="tcard" data-pending-panel>
      <div class="filters"><b>${spt('pendTitle')}</b><span class="chip" data-tone="acc" data-pending-count>${p.pending.length}</span></div>
      <div role="list">${sortPending(p.pending).map((r) => html`<div role="listitem" class="pd-r" data-pending=${r.contact_id}>
        <span class="pn"><b>${r.name || '—'}</b><small>${[r.vendor, ticketText(r)].filter(Boolean).join(' · ')}</small></span>
        <span class="pd-w"><span class="num">${waitText(r)}</span><span class="chip" data-tone=${leftTone(r)} data-left>${leftText(r)}</span></span>
        <span class="pd-a">
          <sw-button size="sm" variant="primary" data-pending-approve ?disabled=${this.busy} @click=${() => this.confirm({ title: spt('approveQ', { name: r.name }), body: html`<p>${spt('approveText')}</p>`, btn: spt('approve'), run: () => acceptContact(r.contact_id), done: 'failed', doneText: spt('approveDone') })}>${spt('approve')}</sw-button>
          <sw-button size="sm" variant="danger" data-pending-reject ?disabled=${this.busy} @click=${() => this.confirm({ title: spt('rejectQ', { name: r.name }), body: html`<p>${spt('rejectText')}</p>`, btn: spt('reject'), danger: true, run: () => rejectPendingContact(r.contact_id), done: 'failed', doneText: spt('rejectDone') })}>${spt('reject')}</sw-button>
        </span></div>`)}</div>
    </section>`;
  }

  // ---------------------------------------------------------------- the page

  private side(): TemplateResult {
    const d = this.digest;
    const r = this.data?.rules;
    const sch = this.data?.screen;
    const off = !this.data?.enabled;
    const mini = (n: number, k: XtKey, tone?: string) => html`<div class="mini"><b data-tone=${tone ?? nothing}>${n}</b><span>${xt(k)}</span></div>`;
    return html`<aside class="side">
      ${off || !d
        ? nothing
        : html`<section class="panel" data-digest-panel>
            <h3><sw-icon name="calendar" size="18"></sw-icon>${xt('weekTitle')}<span class="sp"></span><span class="chip num">${datesText(d.period.from, d.period.until, this.tz)}</span></h3>
            <div class="minis">${mini(d.counts.approved, 'd_approved')}${mini(d.counts.refused, 'd_refused')}${mini(d.counts.ended_or_revoked, 'd_ended')}
              ${mini(d.slow_revokes.length, 'd_slow', 'err')}${mini(d.counts.codes_not_delivered, 'd_notDelivered', 'warn')}${mini(d.gaps.length, 'd_gaps', 'warn')}</div>
            <p class="lead">${xt('weekLead', { day: xt(`day${sch?.digest_day ?? 0}` as XtKey), hour: `${String(sch?.digest_hour ?? 8).padStart(2, '0')}:00` })}</p>
            <div><sw-button size="sm" data-open-digest @click=${() => this.openDigest()}>${xt('fullDigest')}</sw-button></div>
          </section>`}
      ${off ? nothing : this.driftPanel()}
      <section class="panel" data-rules-panel>
        <h3><sw-icon name="filter" size="18"></sw-icon>${xt('rulesTitle')}</h3>
        <div class="kv">
          <div><span>${xt('r_feature')}</span><b>${off ? html`<span class="chip" data-tone="off"><sw-icon name="lock" size="13"></sw-icon>${xt('r_off')}</span>` : html`<span class="chip" data-tone="ok">${xt('r_on')}</span>`}</b></div>
          ${r
            ? html`<div><span>${xt('r_longest')}</span><b>${xt('r_days', { n: r.max_days })}</b></div>
                <div><span>${xt('r_doorsPerGrant')}</span><b>${xt('r_upTo', { n: r.max_doors })}</b></div>
                <div><span>${xt('r_codeAt')}</span><b class="num">${xt('r_codeAtValue', { h: r.code_hour })}</b></div>
                <div><span>${xt('r_phoneWithin')}</span><b>${xt('r_days', { n: r.phone_fresh_days })}</b></div>
                <div><span>${xt('r_local')}</span><b>${r.local_approvers === 'on' ? xt('r_yes') : xt('r_no')}</b></div>`
            : nothing}
        </div>
        <div class="lockrow" data-extended-identity="locked"><sw-icon name="lock" size="18"></sw-icon><div><b>${xt('extTitle')}</b>${xt('extText')}</div><input type="checkbox" disabled aria-label=${xt('extTitle')} /></div>
      </section>
    </aside>`;
  }

  /**
   * SHAREDUI-295: what the list can and cannot tell right now - WisKey offline (the server's freshness of its copy: the states are the
   * last known) and a list that could not be refreshed (stale: the server did not answer the last poll). Each with its time and a safe
   * action that only reads again.
   */
  private statusBanners(data: GrantsReply): TemplateResult {
    const wk = data.wiskey;
    const offline = wiskeyOffline(data);
    const at = (iso: string | null) => (iso ? this.fmt(iso, localDate(iso, this.tz) !== localDate(new Date().toISOString(), this.tz)) : '');
    return html`${offline
      ? html`<div class="banner" data-tone="warn" data-banner="wiskey-offline" role="status"><sw-icon name="offline" size="18"></sw-icon>
          <span><b>${wk?.as_of && wk.has_copy ? xt('wk_offTitle', { t: at(wk.as_of) }) : xt('wk_offTitleNoTime')}</b> ${xt('wk_offText')}</span><span class="sp"></span>
          <sw-button size="sm" icon="refresh" @click=${() => this.load()}>${xt('checkAgain')}</sw-button></div>`
      : nothing}
      ${this.stale
        ? html`<div class="banner" data-tone="warn" data-banner="stale" role="alert"><sw-icon name="warning" size="18"></sw-icon>
            <span><b>${xt('stale_title', { t: at(new Date(this.loadedAt).toISOString()) })}</b> ${xt('stale_text')}</span><span class="sp"></span>
            <sw-button size="sm" icon="refresh" @click=${() => this.load()}>${xt('retry')}</sw-button></div>`
        : nothing}`;
  }

  private list(grants: Grant[]): TemplateResult {
    const off = !this.data?.enabled;
    const rows = visible(grants, this.query);
    const stations: DropdownItem[] = [{ id: '', label: xt('allDoors') }, ...stationsOf(grants).map((s) => ({ id: s.id, label: s.name }))];
    const sources: DropdownItem[] = [{ id: '', label: xt('allSources') }, { id: 'ticket', label: xt('srcTicket') }, { id: 'rfq_order', label: xt('srcRfq') }, { id: 'manual', label: xt('srcManual') }];
    let body: TemplateResult;
    if (!rows.length) {
      const empty = !grants.length;
      const [h, p] = off && empty ? ['emptyOffTitle', 'emptyOffText'] : empty ? ['emptyTitle', 'emptyText'] : ['noMatchTitle', 'noMatchText'];
      // the empty list offers the one useful next step: a new request (when the caller may ask), or clearing the filter
      const canAsk = empty && !off && !!this.data?.may_request;
      body = html`<div style="padding:28px 16px" data-external-empty=${off && empty ? 'off' : empty ? 'empty' : 'filter'}><sw-state-panel icon="link" state="empty" heading=${xt(h as XtKey)} hint=${xt(p as XtKey)}
        actionLabel=${!empty ? xt('showAllOpen') : canAsk ? rt('newBtn') : ''} @action=${() => (canAsk ? this.openRequest() : (this.query = { filter: 'live', q: '', station: '', source: '' }))}></sw-state-panel></div>`;
    } else {
      body = html`<div class="gl-h" aria-hidden="true"><span>${xt('colPerson')}</span><span>${xt('colDoors')}</span><span>${xt('colWindow')}</span><span>${xt('colState')}</span><span>${xt('colCode')}</span><span></span></div>
        <div role="list">${rows.map((g) => html`<button type="button" role="listitem" class="gl-r" data-grant=${g.id} data-ui-state=${uiState(g)} aria-current=${String(this.sel === g.id)} @click=${() => this.openDrawer(g.id)}>
          <span class="pn"><b>${this.name(g)}</b><small>${[g.company, xt(g.category === 'contractor' ? 'contractor' : 'visitor')].filter(Boolean).join(' · ')}</small><span class="sr">${xt(SRC_KEY[g.source] ?? 'srcManual')}${g.source_ref ? html` <span class="num">${g.source_ref}</span>` : nothing}</span></span>
          <span class="doors">${this.doorChips(g)}</span>
          <span class="win"><span class="num">${datesText(g.valid_from, g.valid_until, this.tz)}</span><small class="num">${hoursText(g, this.tz)}</small></span>
          <span class="st"><span class="row">${this.badge(g)}${g.pending_amendment ? html`<span class="chip" data-tone="acc">${xt('widening')}</span>` : nothing}${g.code_mode === 'single_entry' ? html`<span class="chip" data-tone="acc" data-once>${xt('once_chip')}</span>` : nothing}</span><span class="why">${xtDynamic(whyKey(g), 'why_pending')}</span></span>
          <span class="code">${g.credential === 'pin' ? this.codeCell(g) : html`<span class="chip" data-tone="off">${xt('code_not_needed')}</span>`}</span>
          <span class="chev"><sw-icon name="chevronBack" size="16"></sw-icon></span></button>`)}</div>`;
    }
    return html`<div class="tcard">
      <div class="filters">
        <input class="in" type="search" aria-label=${xt('search')} placeholder=${xt('search')} .value=${this.query.q} @input=${(e: Event) => (this.query = { ...this.query, q: (e.target as HTMLInputElement).value })} />
        <sw-dropdown tall .items=${stations} .value=${this.query.station} label=${xt('colDoors')} @change=${(e: CustomEvent<{ id: string }>) => (this.query = { ...this.query, station: e.detail.id })}></sw-dropdown>
        <sw-dropdown tall .items=${sources} .value=${this.query.source} label=${xt('source')} @change=${(e: CustomEvent<{ id: string }>) => (this.query = { ...this.query, source: e.detail.id })}></sw-dropdown>
        <span class="chip" data-tone="acc" data-shown>${xt('shown', { n: rows.length })}</span>
      </div>
      ${body}
      <div class="legend"><span><sw-icon name="lock" size="14"></sw-icon>${xt('legendCode')}</span><span><sw-icon name="help" size="14"></sw-icon>${xt('legendVerified')}</span></div>
    </div>`;
  }

  render() {
    const data = this.data;
    if (!data && this.error) return html`<sw-state-panel state="error" heading=${xt('loadError')} hint=${this.error} actionLabel=${xt('retry')} @action=${() => this.load()}></sw-state-panel>`;
    if (!data) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const grants = data.grants;
    const c = counts(grants);
    const revoking = grants.filter((g) => uiState(g) === 'revoking');
    const off = !data.enabled;
    return html`
      <div class="top lead-head">
        <div><h1>${xt('title')}</h1><p class="sub">${xt('sub')}</p></div>
        <span class="sp"></span>
        ${data.may_request && !off ? html`<sw-button variant="primary" icon="plus" data-open-request @click=${() => this.openRequest()}>${rt('newBtn')}</sw-button>` : nothing}
        <sw-button icon="download" data-export-csv ?disabled=${this.exporting || !grants.length} @click=${() => void this.exportCsv()}>${xt('exportCsv')}</sw-button>
        ${data.system_admin
          ? html`<sw-button icon="system" data-open-settings @click=${() => this.openSettings()}>${xt('settings')}</sw-button>
              <sw-button variant="danger" icon="lock" data-revoke-all ?disabled=${off || !grants.some((g) => ['requested', 'approved', 'provisioning', 'active', 'unknown'].includes(g.state))}
                @click=${() => this.confirm({ title: xt('revokeAllQ'), body: html`<p>${xt('revokeAllText')}</p>`, btn: xt('revokeAll'), danger: true, word: REVOKE_ALL_WORD, run: () => revokeAll(REVOKE_ALL_WORD), done: 'revokeAllDone' })}>${xt('revokeAll')}</sw-button>`
          : nothing}
      </div>
      ${off ? html`<div class="banner" data-tone="off" data-banner="off"><sw-icon name="lock" size="18"></sw-icon><span><b>${xt('offTitle')}</b> ${xt('offText')}</span></div>` : nothing}
      ${revoking.length
        ? html`<div class="banner" data-tone="err" data-banner="revoking"><sw-icon name="bell" size="18"></sw-icon><span><b>${xt('revokingBanner', { n: revoking.length })}</b> · ${xt('revokingBannerText')}</span><span class="sp"></span><sw-button size="sm" @click=${() => this.openDrawer(revoking[0].id)}>${xt('open')}</sw-button></div>`
        : nothing}
      ${this.statusBanners(data)}
      <div class="cols">
        <div class="main">
          <div class="kpis" role="group" aria-label=${xt('filterLabel')}>${BUCKETS.map(
            (b) => html`<button type="button" class="kpi" data-kpi=${b} data-tone=${KPI_TONE[b]} aria-pressed=${String(this.query.filter === b)} @click=${() => (this.query = { ...this.query, filter: (this.query.filter === b ? 'live' : b) as Filter })}><span class="dot" aria-hidden="true"></span><div><b>${c[b]}</b><span>${xt(KPI_KEY[b])}</span></div></button>`,
          )}</div>
          ${this.list(grants)}
          ${this.pendingPanel()}
        </div>
        ${this.side()}
      </div>
      ${this.dialog ? nothing : this.drawer()}
      ${this.dialogs()}
      <div class="toasts" aria-live="polite">${this.toasts.map((t) => html`<div class="toast" data-toast><sw-icon name="check" size="16"></sw-icon>${t.text}</div>`)}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'access-external-screen': AccessExternalScreen;
  }
}
