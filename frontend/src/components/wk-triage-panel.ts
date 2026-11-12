import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-button';
import './sw-dialog';
import './sw-dropdown';
import type { DropdownChange } from './sw-dropdown';
import './sw-drawer';
import './sw-icon';
import type { StateKind } from './sw-badge';
import { describeError } from '../api/client';
import { getAlerts, getConflicts, getStatusStations, type FleetAlert, type SyncConflict } from '../api/access-status';
import type { DisplayZone } from '../api/intercom';
import {
  DURATIONS,
  REASONS,
  alertActions,
  alertKey,
  choices,
  conflictKey,
  deviceTime,
  getTriage,
  outcomeOf,
  postAlertAction,
  postResolve,
  postReview,
  putTriageSettings,
  restoreKind,
  reviewKind,
  reviewSecondsLeft,
  type AlertAction,
  type Direction,
  type RecordSide,
  type Review,
  type SnoozeReason,
  type StepOutcome,
  type TriageStatus,
  type TriageView,
} from '../api/wiskey-triage';
import { tt } from '../i18n/wiskey-triage';
import { formatTime, UTC_ZONE } from '../screens/wiskey-format';

type Tab = 'conflicts' | 'alerts';
const TONE: Record<TriageStatus, StateKind> = {
  sending: 'unknown',
  sent: 'unknown',
  acknowledged: 'live',
  completed: 'live',
  failed: 'error',
  not_sent: 'stale',
  unknown: 'stale',
  stale: 'stale',
};
const COMPACT_ROWS = 4;

interface AlertDraft {
  alert: FleetAlert;
  action: AlertAction;
  kind: string;
  duration: number;
  reason: SnoozeReason;
}

/**
 * WisKey's sync conflicts and fleet alerts, acted on from Arx (WISKEY-CONFLICTS-2400). One component in two sizes: `full` on the screen
 * #/wiskey/conflicts | #/wiskey/alerts (a tab switch, every row, the notification setting) and `compact` as a section of the "מצב WisKey"
 * card (both lists, the first rows, a link to the screen).
 *
 * A conflict is never resolved from the list: "בדיקה" opens a drawer that asks WisKey for its preview (a READ of the station: the device
 * record against the managed one, what would change, which resolutions WisKey allows), and a resolution is offered only from there,
 * behind a confirmation, sent once. The result is said as it is: accepted and queued, refused with the reason, "the record changed -
 * review again", not sent, or sent without a clear answer. An alert can be snoozed (a duration and a reason) or its snooze restored -
 * WisKey has no acknowledge or close - each behind a confirmation. Nothing runs by itself: the lists are read when the component opens
 * and when the operator asks.
 *
 * What is offered follows the server: without the manage right (`may_resolve` / `may_act_alerts`) the lists are read only and say why.
 */
@customElement('wk-triage-panel')
export class WkTriagePanel extends LitElement {
  @property() mode: 'full' | 'compact' = 'full';
  @property() tab: Tab = 'conflicts';

  @state() private view: TriageView | null = null;
  @state() private conflicts: SyncConflict[] | null = null;
  @state() private alerts: FleetAlert[] | null = null;
  @state() private alertCounts = { active: 0, snoozed: 0 };
  @state() private names: Record<string, string> = {};
  @state() private zone: DisplayZone = UTC_ZONE;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private conflictsError = '';
  @state() private alertsError = '';
  @state() private showSnoozed = false;
  @state() private results: Record<string, StepOutcome> = {};
  // the review drawer
  @state() private reviewing: SyncConflict | null = null;
  @state() private review: Review | null = null;
  @state() private reviewError: StepOutcome | null = null;
  @state() private reviewBusy = false;
  @state() private asking: Direction | null = null;
  @state() private sending = false;
  @state() private resolved: StepOutcome | null = null;
  // the alert dialog
  @state() private draft: AlertDraft | null = null;
  @state() private alertBusy = false;
  @state() private notifyBusy = false;
  @state() private now = Date.now();
  private timer = 0;
  private seq = 0;

  static styles = css`
    :host {
      display: block;
    }
    .wrap {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3, 12px);
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }
    .bar .sp {
      flex: 1 1 auto;
    }
    .tabs {
      display: inline-flex;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      overflow: hidden;
    }
    .tabs button {
      font: inherit;
      font-size: var(--sw-fs-sm);
      padding: 6px 14px;
      min-block-size: 36px;
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .tabs button[aria-selected='true'] {
      background: var(--sw-accent-soft);
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .tabs .n {
      margin-inline-start: 6px;
      padding: 0 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-xs);
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .note {
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.45;
    }
    .err {
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      overflow-wrap: anywhere;
    }
    .list {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
    }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 6px 12px;
      padding: 10px 14px;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      min-block-size: 52px;
    }
    .row:last-child {
      border-block-end: 0;
    }
    .main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .main b {
      font-weight: var(--sw-fw-semibold);
      overflow-wrap: anywhere;
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow-wrap: anywhere;
    }
    .acts {
      display: flex;
      gap: 6px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .result {
      grid-column: 1 / -1;
      display: flex;
      gap: 8px;
      align-items: flex-start;
      font-size: var(--sw-fs-sm);
      line-height: 1.45;
    }
    .empty {
      padding: 14px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    code,
    bdi {
      unicode-bidi: isolate;
    }
    code {
      font-family: var(--sw-font-mono, monospace);
      font-size: var(--sw-fs-xs);
      direction: ltr;
    }
    .more {
      align-self: flex-start;
      font-size: var(--sw-fs-sm);
    }
    label.chk {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      font-size: var(--sw-fs-sm);
      min-block-size: 36px;
    }
    .notify {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 4px 12px;
      align-items: center;
      padding: 10px 14px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      font-size: var(--sw-fs-sm);
    }
    /* the review drawer */
    .rv {
      display: flex;
      flex-direction: column;
      gap: 14px;
      font-size: var(--sw-fs-sm);
      line-height: 1.45;
    }
    .cmp {
      display: grid;
      grid-template-columns: minmax(90px, auto) 1fr 1fr;
      gap: 0;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      overflow: hidden;
    }
    .cmp > span {
      padding: 6px 8px;
      border-block-end: 1px solid var(--sw-border);
      overflow-wrap: anywhere;
    }
    .cmp > .h {
      background: var(--sw-surface-2);
      font-weight: var(--sw-fw-semibold);
    }
    .cmp > .diff {
      background: var(--sw-warning-soft);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .chip {
      padding: 1px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-xs);
    }
    .choice {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .choice[data-allowed='false'] {
      opacity: 0.7;
    }
    .choice .why {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    ul {
      margin: 0;
      padding-inline-start: 18px;
    }
    .dlg {
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    .dlg label:not(.chk),
    .dlg div.f {
      display: grid;
      gap: 4px;
    }
    .dfoot {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding-block-start: 12px;
      flex-wrap: wrap;
    }
    @media (max-width: 767px) {
      .row {
        grid-template-columns: minmax(0, 1fr) auto;
      }
      .row .acts {
        grid-column: 1 / -1;
        justify-content: flex-start;
      }
      .cmp {
        grid-template-columns: minmax(70px, auto) 1fr 1fr;
        font-size: var(--sw-fs-xs);
      }
      .notify {
        grid-template-columns: 1fr;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
    this.timer = window.setInterval(() => (this.now = Date.now()), 15_000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
  }

  /** Reads the page facts and both lists (each list fails on its own). */
  async load() {
    const seq = ++this.seq;
    this.phase = this.view ? this.phase : 'loading';
    try {
      const [view, conflicts, alerts, stations] = await Promise.allSettled([
        getTriage(),
        getConflicts(),
        getAlerts({ includeSuppressed: true, limit: 200 }),
        getStatusStations(),
      ]);
      if (seq !== this.seq) return;
      if (view.status === 'rejected') throw view.reason;
      this.view = view.value;
      if (conflicts.status === 'fulfilled') {
        this.conflicts = conflicts.value.conflicts ?? [];
        this.conflictsError = conflicts.value.conflicts ? '' : tt.feedDown;
      } else {
        this.conflicts = null;
        this.conflictsError = describeError(conflicts.reason);
      }
      if (alerts.status === 'fulfilled') {
        const page = alerts.value.alerts;
        this.alerts = page?.items ?? [];
        this.alertCounts = { active: page?.active_count ?? 0, snoozed: page?.suppressed_count ?? 0 };
        this.alertsError = page ? '' : tt.feedDown;
      } else {
        this.alerts = null;
        this.alertsError = describeError(alerts.reason);
      }
      if (stations.status === 'fulfilled') {
        this.names = Object.fromEntries((stations.value.stations ?? []).map((s) => [s.id, s.name]));
        this.zone = stations.value.default_zone ?? UTC_ZONE;
      }
      this.phase = 'ready';
      this.error = '';
    } catch (err) {
      if (seq !== this.seq) return;
      this.phase = 'error';
      this.error = describeError(err);
    }
  }

  private station(id: string | null | undefined): string {
    return (id && this.names[id]) || id || '—';
  }

  private time(v: string | null | undefined): string {
    return formatTime(v, 'he-IL', this.zone);
  }

  // ------------------------------------------------------------- conflicts

  private async openReview(row: SyncConflict) {
    const kind = reviewKind(row);
    if (!kind || !row.person?.id) return;
    this.reviewing = row;
    this.review = null;
    this.reviewError = null;
    this.resolved = null;
    this.asking = null;
    this.reviewBusy = true;
    try {
      this.review = await postReview(row.station_id, row.person.id, kind);
    } catch (err) {
      this.reviewError = outcomeOf(err);
    } finally {
      this.reviewBusy = false;
    }
  }

  private closeReview() {
    this.reviewing = null;
    this.review = null;
    this.asking = null;
    this.reviewError = null;
    if (this.resolved) void this.load();
    this.resolved = null;
  }

  private async resolve(direction: Direction) {
    const r = this.review;
    const row = this.reviewing;
    if (!r || !row || this.sending) return;
    this.sending = true;
    const key = conflictKey(row);
    this.results = { ...this.results, [key]: { status: 'sending', code: null, message: '', retry_after_s: null } };
    let out: StepOutcome;
    try {
      await postResolve(r.review_id, direction);
      out = { status: 'acknowledged', code: null, message: '', retry_after_s: null };
    } catch (err) {
      out = outcomeOf(err);
    }
    this.results = { ...this.results, [key]: out };
    this.resolved = out;
    this.asking = null;
    this.sending = false;
  }

  private renderConflicts(): TemplateResult {
    const rows = this.conflicts;
    const may = !!this.view?.may_resolve;
    const shown = rows && this.mode === 'compact' ? rows.slice(0, COMPACT_ROWS) : rows;
    return html`<section class="wrap" data-wkt-conflicts>
      ${this.mode === 'compact' ? html`<div class="bar"><h4>${tt.conflicts.heading}</h4><span class="muted">${rows ? tt.conflicts.count(rows.length) : ''}</span></div>` : nothing}
      ${this.conflictsError ? html`<div class="err" role="alert">${this.conflictsError}</div>` : nothing}
      ${rows === null
        ? nothing
        : rows.length === 0
          ? html`<div class="list"><div class="empty" data-wkt-empty>${tt.conflicts.empty}</div></div>`
          : html`<div class="list">${shown!.map((r) => this.renderConflict(r, may))}</div>
              ${shown!.length < rows.length ? html`<a class="more" href="#/wiskey/conflicts" data-wkt-more>${tt.openFull} (${rows.length})</a>` : nothing}`}
    </section>`;
  }

  private renderConflict(r: SyncConflict, may: boolean): TemplateResult {
    const key = conflictKey(r);
    const kind = reviewKind(r);
    const res = this.results[key];
    const recent = this.view?.recent?.conflicts?.[key];
    const who = r.person?.display_name || (r.person?.id ? tt.conflicts.hiddenPerson : '—');
    return html`<div class="row" data-wkt-conflict=${key} data-kind=${r.kind}>
      <div class="main">
        <b>${who}</b>
        <span class="sub">${tt.conflicts.kind[r.kind] ?? tt.conflicts.kind.other}${r.person?.employee_no ? html` · <bdi>${r.person.employee_no}</bdi>` : nothing}</span>
      </div>
      <div class="main">
        <span><bdi>${this.station(r.station_id)}</bdi></span>
        ${r.last_error ? html`<span class="sub">${tt.conflicts.lastError}: <code>${r.last_error}</code></span>` : nothing}
      </div>
      <sw-badge kind=${r.sync_state === 'error' ? 'error' : 'stale'} label=${tt.conflicts.state[r.sync_state] ?? tt.conflicts.state.other}></sw-badge>
      <div class="acts">
        ${kind && may
          ? html`<sw-button size="sm" icon="search" data-wkt-review ?disabled=${res?.status === 'sending'} @click=${() => this.openReview(r)}>${tt.conflicts.review}</sw-button>`
          : !kind
            ? html`<span class="sub">${tt.conflicts.noReview}</span>`
            : nothing}
      </div>
      ${res ? this.renderResult(res) : recent ? this.renderResult({ status: recent.status, code: recent.code, message: '', retry_after_s: null }, recent.at) : nothing}
    </div>`;
  }

  private renderResult(res: StepOutcome, at?: string): TemplateResult {
    return html`<div class="result" data-wkt-result=${res.status} role=${res.status === 'failed' || res.status === 'stale' ? 'alert' : 'status'}>
      <sw-badge kind=${TONE[res.status]} label=${tt.statusShort[res.status] ?? res.status}></sw-badge>
      <span>${res.message || tt.status[res.status]}${res.code && res.status !== 'acknowledged' && res.status !== 'completed' ? html` <code>${res.code}</code>` : nothing}${at ? html` · <bdi>${this.time(at)}</bdi>` : nothing}</span>
    </div>`;
  }

  private side(s: RecordSide | null, field: 'name' | 'validity' | 'doors' | 'pin' | 'cards'): string {
    const d = tt.drawer.side;
    if (!s || !s.present) return tt.drawer.missing;
    switch (field) {
      case 'name':
        return s.display_name ?? '—';
      case 'validity':
        return s.validity.timed ? `${deviceTime(s.validity.from)} – ${deviceTime(s.validity.until)}` : d.always;
      case 'doors':
        return s.door_rights.length ? s.door_rights.join(', ') : '—';
      case 'pin':
        return s.pin_configured === null ? d.unknown : s.pin_configured ? d.yes : d.no;
      case 'cards':
        return String(s.card_count);
    }
  }

  private renderReview(): TemplateResult | typeof nothing {
    const row = this.reviewing;
    if (!row) return nothing;
    const r = this.review;
    const left = r ? reviewSecondsLeft(r, this.now) : 0;
    const diff = new Set(r?.impact.differences ?? []);
    const cmpRow = (label: string, field: 'name' | 'validity' | 'doors' | 'pin' | 'cards', keys: string[]) => {
      const changed = keys.some((k) => diff.has(k));
      return html`<span class=${changed ? 'diff' : ''}>${label}</span><span class=${changed ? 'diff' : ''}><bdi>${this.side(r!.impact.central, field)}</bdi></span><span class=${changed ? 'diff' : ''}><bdi>${this.side(r!.impact.device, field)}</bdi></span>`;
    };
    return html`<sw-drawer modal open heading=${tt.drawer.heading} subheading=${`${row.person?.display_name || tt.conflicts.hiddenPerson} · ${this.station(row.station_id)}`} data-wkt-drawer
      @close=${(e: Event) => e.target === e.currentTarget && this.closeReview()}>
      <div class="rv">
        ${this.reviewBusy ? html`<div class="note" data-wkt-reading aria-busy="true">${tt.drawer.reading}</div>` : html`<div class="muted">${tt.drawer.intro}</div>`}
        ${this.reviewError ? html`<div class="err" role="alert" data-wkt-review-error>${this.reviewError.message || tt.status[this.reviewError.status]} ${this.reviewError.code ? html`<code>${this.reviewError.code}</code>` : nothing}</div>` : nothing}
        ${r
          ? html`<div class="muted" data-wkt-reviewed>${tt.drawer.reviewed}: <bdi>${this.time(r.impact.reviewed_at)}</bdi> · <span data-wkt-ttl>${tt.drawer.expires(left)}</span></div>
              ${r.kind === 'person'
                ? html`<div class="cmp" data-wkt-compare>
                    <span class="h"></span><span class="h">${tt.drawer.managed}</span><span class="h">${tt.drawer.device}</span>
                    ${cmpRow(tt.drawer.side.name, 'name', ['display_name', 'presence'])} ${cmpRow(tt.drawer.side.validity, 'validity', ['validity'])}
                    ${cmpRow(tt.drawer.side.doors, 'doors', ['door_rights'])} ${cmpRow(tt.drawer.side.pin, 'pin', ['pin'])} ${cmpRow(tt.drawer.side.cards, 'cards', ['cards'])}
                  </div>`
                : html`<div class="cmp" data-wkt-compare><span class="h"></span><span class="h">${tt.drawer.device}</span><span class="h"></span>
                    ${(['name', 'doors', 'cards'] as const).map((f) => html`<span>${tt.drawer.side[f]}</span><span><bdi>${this.side(r.impact.device, f)}</bdi></span><span></span>`)}</div>`}
              <div>
                <b>${tt.drawer.differences}</b>
                <div class="chips" data-wkt-diffs>${r.impact.differences.length ? r.impact.differences.map((d) => html`<span class="chip">${tt.drawer.field[d] ?? tt.drawer.field.other}</span>`) : html`<span class="muted">${tt.drawer.noDifferences}</span>`}</div>
              </div>
              ${r.impact.plan && r.kind === 'person'
                ? html`<div data-wkt-plan><b>${tt.drawer.plan}</b><ul>
                    <li>${tt.drawer.planPerson[r.impact.plan.person ?? 'unknown'] ?? tt.drawer.planPerson.unknown}</li>
                    <li>${tt.drawer.planPin[r.impact.plan.pin ?? 'unknown'] ?? tt.drawer.planPin.unknown}</li>
                    <li>${tt.drawer.cards(r.impact.plan.cards_add ?? 0, r.impact.plan.cards_remove ?? 0, r.impact.plan.cards_update ?? 0)}</li>
                  </ul></div>`
                : nothing}
              ${r.impact.affected_stations.length
                ? html`<div data-wkt-affected><b>${tt.drawer.affected}</b><div class="chips">${r.impact.affected_stations.map((s) => html`<span class="chip"><bdi>${this.station(s)}</bdi></span>`)}</div>
                    ${r.kind === 'person' ? html`<div class="muted">${tt.drawer.affectedHint}</div>` : nothing}</div>`
                : nothing}
              ${r.impact.unverified_fields.includes('pin') ? html`<div class="note">${tt.drawer.unverified}</div>` : nothing}
              <div><b>${tt.drawer.choose}</b></div>
              ${choices(r).map(
                (c) => html`<div class="choice" data-wkt-choice=${c.direction} data-allowed=${String(c.allowed)}>
                  <b>${tt.direction[c.direction].label}</b>
                  <span class="muted">${tt.direction[c.direction].hint}</span>
                  ${c.allowed
                    ? html`<div><sw-button size="sm" variant=${c.direction === 'central' ? 'primary' : 'secondary'} data-wkt-choose=${c.direction}
                        ?disabled=${this.sending || left <= 0 || !!this.resolved} @click=${() => (this.asking = c.direction)}>${tt.direction[c.direction].label}</sw-button></div>`
                    : html`<span class="why">${tt.drawer.notAllowed}: ${tt.reason[c.reason ?? 'unknown'] ?? c.reason}</span>`}
                </div>`,
              )}
              ${this.resolved ? html`<div data-wkt-resolved>${this.renderResult(this.resolved)}</div>` : nothing}`
          : nothing}
        ${this.renderConfirm()}
      </div>
      <sw-button slot="footer" variant="ghost" data-wkt-close @click=${() => this.closeReview()}>${tt.drawer.close}</sw-button>
      ${!this.reviewBusy && (this.reviewError || this.resolved || (r && left <= 0))
        ? html`<sw-button slot="footer" icon="refresh" data-wkt-again @click=${() => this.openReview(row)}>${tt.drawer.again}</sw-button>`
        : nothing}
    </sw-drawer>`;
  }

  private renderConfirm(): TemplateResult | typeof nothing {
    const d = this.asking;
    if (!d) return nothing;
    return html`<sw-dialog open heading=${tt.confirm.heading} data-wkt-confirm @close=${(e: Event) => {
      e.stopPropagation();
      this.asking = null;
    }}>
      <div class="dlg">
        <b>${tt.direction[d].label}</b>
        <div>${tt.direction[d].hint}</div>
        <div class="muted">${tt.confirm.body}</div>
      </div>
      <div class="dfoot">
        <sw-button variant="ghost" @click=${() => (this.asking = null)}>${tt.confirm.cancel}</sw-button>
        <sw-button variant=${d === 'central' ? 'primary' : 'danger'} data-wkt-confirm-ok ?disabled=${this.sending} @click=${() => this.resolve(d)}>${this.sending ? tt.status.sending : tt.confirm.ok}</sw-button>
      </div>
    </sw-dialog>`;
  }

  // ------------------------------------------------------------- alerts

  private visibleAlerts(): FleetAlert[] {
    const all = this.alerts ?? [];
    return this.mode === 'full' && this.showSnoozed ? all : all.filter((a) => !a.suppressed);
  }

  private ask(alert: FleetAlert, action: AlertAction, kind = action === 'restore' ? restoreKind(alert) : alert.kind) {
    this.draft = { alert, action, kind, duration: 60, reason: kind === 'maintenance' ? 'planned_maintenance' : 'investigating' };
  }

  private async sendAlert() {
    const d = this.draft;
    if (!d || this.alertBusy || !d.alert.station_id) return;
    this.alertBusy = true;
    const key = alertKey(d.alert);
    this.results = { ...this.results, [key]: { status: 'sending', code: null, message: '', retry_after_s: null } };
    let out: StepOutcome;
    try {
      await postAlertAction(d.alert.station_id, d.kind, d.action, d.duration, d.reason);
      out = { status: 'completed', code: null, message: '', retry_after_s: null };
    } catch (err) {
      out = outcomeOf(err);
    }
    this.results = { ...this.results, [key]: out };
    this.draft = null;
    this.alertBusy = false;
    if (out.status === 'completed' || out.status === 'stale') void this.load();
  }

  private renderAlerts(): TemplateResult {
    const may = !!this.view?.may_act_alerts;
    const rows = this.visibleAlerts();
    const shown = this.mode === 'compact' ? rows.slice(0, COMPACT_ROWS) : rows;
    return html`<section class="wrap" data-wkt-alerts>
      <div class="bar">
        ${this.mode === 'compact' ? html`<h4>${tt.alerts.heading}</h4>` : nothing}
        <span class="muted" data-wkt-alert-count>${tt.alerts.count(this.alertCounts.active, this.alertCounts.snoozed)}</span>
        <span class="sp"></span>
        ${this.mode === 'full'
          ? html`<label class="chk"><input type="checkbox" data-wkt-show-snoozed .checked=${this.showSnoozed} @change=${(e: Event) => (this.showSnoozed = (e.target as HTMLInputElement).checked)} />${tt.alerts.showSnoozed}</label>`
          : nothing}
      </div>
      ${this.alertsError ? html`<div class="err" role="alert">${this.alertsError}</div>` : nothing}
      ${this.alerts === null
        ? nothing
        : shown.length === 0
          ? html`<div class="list"><div class="empty" data-wkt-empty>${tt.alerts.empty}</div></div>`
          : html`<div class="list">${shown.map((a) => this.renderAlert(a, may))}</div>
              ${shown.length < rows.length ? html`<a class="more" href="#/wiskey/alerts" data-wkt-more>${tt.openFull} (${rows.length})</a>` : nothing}`}
      ${this.mode === 'full' ? html`<div class="note" data-wkt-no-ack>${tt.alerts.noAck}</div>` : nothing}
    </section>`;
  }

  private renderAlert(a: FleetAlert, may: boolean): TemplateResult {
    const key = alertKey(a);
    const res = this.results[key];
    const recent = this.view?.recent?.alerts?.[key];
    return html`<div class="row" data-wkt-alert=${a.id} data-suppressed=${String(a.suppressed)}>
      <div class="main">
        <b>${tt.alerts.kind[a.kind] ?? tt.alerts.kind.other}</b>
        <span class="sub"><bdi>${a.station_name || this.station(a.station_id)}</bdi></span>
      </div>
      <div class="main">
        ${a.suppressed && a.suppression
          ? html`<span>${tt.alerts.snoozedUntil} <bdi>${this.time(a.suppression.until)}</bdi></span><span class="sub">${tt.alerts.reasons[a.suppression.reason ?? ''] ?? ''}${a.suppression.kind === 'maintenance' ? ` · ${tt.alerts.kind.maintenance}` : ''}</span>`
          : html`<span class="sub">${tt.alerts.since} <bdi>${this.time(a.observed_since)}</bdi></span>`}
      </div>
      <sw-badge kind=${a.suppressed ? 'neutral' : a.severity === 'error' ? 'error' : 'stale'} label=${a.suppressed ? tt.alerts.snooze : tt.alerts.severity[a.severity] ?? a.severity}></sw-badge>
      <div class="acts">
        ${may && a.station_id
          ? alertActions(a).map((act) =>
              act === 'snooze'
                ? html`<sw-button size="sm" icon="bellOff" data-wkt-snooze ?disabled=${res?.status === 'sending'} @click=${() => this.ask(a, 'snooze')}>${tt.alerts.snooze}</sw-button>`
                : html`<sw-button size="sm" icon="bell" data-wkt-restore ?disabled=${res?.status === 'sending'} @click=${() => this.ask(a, 'restore')}>${tt.alerts.restore}</sw-button>`,
            )
          : nothing}
      </div>
      ${res ? this.renderResult(res) : recent ? this.renderResult({ status: recent.status, code: recent.code, message: '', retry_after_s: null }, recent.at) : nothing}
    </div>`;
  }

  private renderAlertDialog(): TemplateResult | typeof nothing {
    const d = this.draft;
    if (!d) return nothing;
    const snooze = d.action === 'snooze';
    return html`<sw-dialog open heading=${snooze ? tt.alerts.confirmSnooze : tt.alerts.confirmRestore} data-wkt-alert-dialog @close=${(e: Event) => {
      e.stopPropagation();
      this.draft = null;
    }}>
      <div class="dlg">
        <b>${tt.alerts.kind[d.alert.kind] ?? d.alert.kind} · <bdi>${d.alert.station_name || this.station(d.alert.station_id)}</bdi></b>
        ${snooze
          ? html`<label class="chk"><input type="checkbox" data-wkt-whole-station .checked=${d.kind === 'maintenance'}
                @change=${(e: Event) => (this.draft = { ...d, kind: (e.target as HTMLInputElement).checked ? 'maintenance' : d.alert.kind })} />${tt.alerts.stationSnooze}</label>
              <div class="f"><span>${tt.alerts.durationLabel}</span>
                <sw-dropdown block data-wkt-duration label=${tt.alerts.durationLabel} .value=${String(d.duration)}
                  .items=${DURATIONS.map((m) => ({ id: String(m), label: tt.alerts.duration[m] }))}
                  @change=${(e: CustomEvent<DropdownChange>) => (this.draft = { ...d, duration: Number(e.detail.id) })}></sw-dropdown></div>
              <div class="f"><span>${tt.alerts.reasonLabel}</span>
                <sw-dropdown block data-wkt-reason label=${tt.alerts.reasonLabel} .value=${d.reason}
                  .items=${REASONS.map((r) => ({ id: r, label: tt.alerts.reasons[r] }))}
                  @change=${(e: CustomEvent<DropdownChange>) => (this.draft = { ...d, reason: e.detail.id as SnoozeReason })}></sw-dropdown></div>`
          : d.kind === 'maintenance'
            ? html`<div>${tt.alerts.kind.maintenance}</div>`
            : nothing}
        <div class="muted">${tt.alerts.confirmBody}</div>
      </div>
      <div class="dfoot">
        <sw-button variant="ghost" @click=${() => (this.draft = null)}>${tt.confirm.cancel}</sw-button>
        <sw-button variant="primary" data-wkt-alert-ok ?disabled=${this.alertBusy} @click=${() => this.sendAlert()}>${this.alertBusy ? tt.status.sending : snooze ? tt.alerts.snooze : tt.alerts.restore}</sw-button>
      </div>
    </sw-dialog>`;
  }

  // ------------------------------------------------------------- the notification setting

  private async setNotify(on: boolean) {
    this.notifyBusy = true;
    try {
      const r = await putTriageSettings(on);
      if (this.view) this.view = { ...this.view, notify: r.notify };
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.notifyBusy = false;
    }
  }

  private renderNotify(): TemplateResult | typeof nothing {
    const n = this.view?.notify;
    if (!n || this.mode !== 'full') return nothing;
    return html`<div class="notify" data-wkt-notify=${n.enabled ? 'on' : 'off'}>
      <div class="main"><b>${tt.notify.label}</b><span class="sub">${tt.notify.hint}</span>${n.can_edit ? nothing : html`<span class="sub">${tt.notify.noEdit}</span>`}</div>
      ${this.renderNotifyPick(n.enabled, !n.can_edit || this.notifyBusy)}
    </div>`;
  }

  /** AUDIT30-WK (audit round 30, #16): the shared sw-dropdown, not a native select. sw-dropdown has no disabled state (branch B's
   * file), so a locked pick is `inert` + `aria-disabled` and fades with `--sw-disabled-opacity`. */
  private renderNotifyPick(on: boolean, locked: boolean): TemplateResult {
    return html`<sw-dropdown data-wkt-notify-select label=${tt.notify.label} .value=${on ? 'on' : 'off'}
      .items=${[{ id: 'off', label: tt.notify.off }, { id: 'on', label: tt.notify.on }]}
      ?inert=${locked} aria-disabled=${locked ? 'true' : nothing} style=${locked ? 'opacity: var(--sw-disabled-opacity)' : ''}
      @change=${(e: CustomEvent<DropdownChange>) => this.setNotify(e.detail.id === 'on')}></sw-dropdown>`;
  }

  render() {
    if (this.phase === 'loading' && !this.view) return html`<div class="note" data-wkt-loading aria-busy="true">${tt.loading}</div>`;
    if (this.phase === 'error' && !this.view) return html`<div class="err" role="alert" data-wkt-error>${this.error}</div>`;
    const may = !!this.view?.may_resolve;
    const nConflicts = this.conflicts?.length ?? 0;
    const nAlerts = this.alertCounts.active;
    return html`<div class="wrap" data-wkt-panel=${this.mode}>
      <div class="bar">
        ${this.mode === 'full'
          ? html`<div class="tabs" role="tablist">
              <button role="tab" data-wkt-tab="conflicts" aria-selected=${String(this.tab === 'conflicts')} @click=${() => this.switchTab('conflicts')}>${tt.tabs.conflicts}<span class="n">${nConflicts}</span></button>
              <button role="tab" data-wkt-tab="alerts" aria-selected=${String(this.tab === 'alerts')} @click=${() => this.switchTab('alerts')}>${tt.tabs.alerts}<span class="n">${nAlerts}</span></button>
            </div>`
          : nothing}
        <span class="sp"></span>
        ${this.mode === 'compact' ? html`<a href="#/wiskey/conflicts" data-wkt-open-full>${tt.openFull}</a>` : nothing}
        <sw-button size="sm" variant="ghost" icon="refresh" data-wkt-refresh @click=${() => this.load()}>${tt.refresh}</sw-button>
      </div>
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      ${!may && this.view ? html`<div class="note" data-wkt-readonly>${tt.readOnly}</div>` : nothing}
      ${this.mode === 'compact' ? html`${this.renderConflicts()} ${this.renderAlerts()}` : this.tab === 'alerts' ? html`${this.renderAlerts()} ${this.renderNotify()}` : this.renderConflicts()}
      ${this.renderReview()} ${this.renderAlertDialog()}
    </div>`;
  }

  private switchTab(tab: Tab) {
    if (tab === this.tab) return;
    this.tab = tab;
    this.dispatchEvent(new CustomEvent('wkt-tab', { detail: { tab }, bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-triage-panel': WkTriagePanel;
  }
}
