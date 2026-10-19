import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-dialog';
import { describeError } from '../api/client';
import { needsReviewApi, type ReviewReport, type ReviewRow } from '../api/tickets-needs-review';
import { ticketsApi } from '../api/tickets';
import { tt, ticketsLang } from './text';

/**
 * NEEDSREVIEW (2.8.0, lead decisions 2026-10-18): "דורש בחינה" - the privacy review report on "מטפלים וספקים" › דורש בחינה, for the
 * directory's editors (`tickets.configure`; the page shows the segment only to them and the server refuses anyone else). Two lists:
 *   - technicians a vendor added that nobody accepted, waiting longer than the threshold (default 30 days) - row action "דחייה ומחיקה",
 *     the existing reject route (POST access-grants/pending-contacts/{id}/reject);
 *   - people Arx knows for door access with no activity for the threshold (default 12 months) - row action "מחיקה עכשיו" (the directory
 *     erase, POST tickets/contacts-review/{id}/delete).
 * Every deletion is manual, one row at a time, after a confirmation dialog. Nothing here reaches the door system: a row linked to a person
 * there says so, and the dialog notes that removing that person is a separate manual step. The thresholds card shows only when the
 * installation settings are readable (system.configure). Events: `notice` {ok | error}, `review-count` {n}.
 */
@customElement('tickets-needs-review')
export class TicketsNeedsReview extends LitElement {
  @state() private report: ReviewReport | null = null;
  @state() private failed = '';
  @state() private confirming: ReviewRow | null = null;
  @state() private busy = false;
  @state() private dialogError = '';
  /** the threshold settings (null = not readable by this viewer, or an older server) */
  @state() private limits: { revision: number; pending: number; idle: number } | null = null;
  @state() private draftPending = '';
  @state() private draftIdle = '';
  @state() private savingLimits = false;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-inline-size: 0;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      padding-block: 10px;
      border-block-end: 1px solid var(--sw-border);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .who {
      flex: 1 1 220px;
      min-inline-size: 0;
    }
    .name {
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      overflow-wrap: anywhere;
    }
    .age {
      font-variant-numeric: tabular-nums;
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
    }
    .tag {
      display: inline-block;
      font-size: var(--sw-fs-xs);
      padding: 1px 8px;
      border-radius: 999px;
      border: 1px solid var(--sw-border);
      color: var(--sw-text-2);
      margin-inline-start: 6px;
    }
    .empty {
      color: var(--sw-text-3);
      padding-block: 6px;
    }
    .msg.err {
      color: var(--sw-danger-text);
    }
    .dlg {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .note {
      font-size: var(--sw-fs-sm);
      padding: 8px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-warning-bg, var(--sw-surface-2));
      color: var(--sw-warning-text);
    }
    .foot {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .limits {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 12px;
    }
    .limits label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .limits input {
      inline-size: 96px;
      block-size: 34px;
      box-sizing: border-box;
      padding-inline: 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-variant-numeric: tabular-nums;
    }
    @media (max-width: 767px) {
      .row sw-button {
        flex: 1 1 100%;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
    void this.loadLimits();
  }

  private emit(name: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  async load(): Promise<void> {
    try {
      this.report = await needsReviewApi.report();
      this.failed = '';
      this.emit('review-count', { n: this.report.pending.length + this.report.idle.length });
    } catch (e) {
      this.failed = describeError(e);
    }
  }

  private async loadLimits(): Promise<void> {
    try {
      const doc = await ticketsApi().settings();
      const d = doc.directory;
      if (!d || typeof d.review_pending_days !== 'number' || typeof d.review_idle_months !== 'number') return;
      this.limits = { revision: doc.revision, pending: d.review_pending_days, idle: d.review_idle_months };
      this.draftPending = String(d.review_pending_days);
      this.draftIdle = String(d.review_idle_months);
    } catch {
      this.limits = null; // not a system administrator: the card is simply absent
    }
  }

  private date(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(ticketsLang() === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }

  private open(r: ReviewRow): void {
    this.dialogError = '';
    this.confirming = r;
  }

  private close(): void {
    if (this.busy) return;
    this.confirming = null;
    this.dialogError = '';
  }

  private async go(): Promise<void> {
    const r = this.confirming;
    if (!r || this.busy) return;
    this.busy = true;
    this.dialogError = '';
    try {
      if (r.action === 'reject') {
        await needsReviewApi.reject(r.contact_id);
        this.emit('notice', { ok: tt('nrRejected') });
      } else {
        const out = await needsReviewApi.erase(r.contact_id);
        this.emit('notice', { ok: out.door_system_linked ? tt('nrDeletedDoor') : tt('nrDeleted') });
      }
      this.busy = false;
      this.confirming = null;
      await this.load();
    } catch (e) {
      this.dialogError = describeError(e);
      this.busy = false;
    }
  }

  private async saveLimits(): Promise<void> {
    const l = this.limits;
    if (!l || this.savingLimits) return;
    const pending = Number(this.draftPending);
    const idle = Number(this.draftIdle);
    this.savingLimits = true;
    try {
      const doc = await ticketsApi().saveInstallation(l.revision, { directory: { review_pending_days: pending, review_idle_months: idle } });
      const d = doc.directory;
      this.limits = { revision: doc.revision, pending: d?.review_pending_days ?? pending, idle: d?.review_idle_months ?? idle };
      this.emit('notice', { ok: tt('nrSaved') });
      await this.load();
    } catch (e) {
      this.emit('notice', { error: describeError(e) });
      await this.loadLimits();
    } finally {
      this.savingLimits = false;
    }
  }

  private rowView(r: ReviewRow): TemplateResult {
    const age = r.section === 'pending' ? tt('nrDays', { n: r.days ?? 0 }) : tt('nrMonths', { n: r.months ?? 0 });
    const when = r.section === 'pending' ? tt('nrSince', { date: this.date(r.since) }) : tt('nrLast', { date: this.date(r.since) });
    return html`<div class="row" data-review-row=${r.contact_id} data-review-section=${r.section}>
      <div class="who">
        <div class="name" dir="auto">${r.name}${r.door_system_linked ? html`<span class="tag" data-review-door>${tt('nrDoorTag')}</span>` : nothing}</div>
        <div class="sub" dir="auto">${r.vendor ? html`<bdi>${r.vendor}</bdi> · ` : nothing}${r.phone ? html`<bdi dir="ltr">${r.phone}</bdi> · ` : nothing}${when}</div>
      </div>
      <span class="age" data-review-age>${age}</span>
      <sw-button size="sm" variant="danger" ?disabled=${this.busy} data-review-action=${r.action} @click=${() => this.open(r)}>
        ${r.action === 'reject' ? tt('nrReject') : tt('nrDelete')}</sw-button>
    </div>`;
  }

  private section(title: string, rows: ReviewRow[], key: string): TemplateResult {
    return html`<sw-card heading=${title} data-review-list=${key}>
      ${rows.length ? rows.map((r) => this.rowView(r)) : html`<div class="empty" data-review-empty>${tt('nrEmpty')}</div>`}
    </sw-card>`;
  }

  private dialog(): TemplateResult | typeof nothing {
    const r = this.confirming;
    if (!r) return nothing;
    const reject = r.action === 'reject';
    return html`<sw-dialog open ?locked=${this.busy} heading=${reject ? tt('nrRejectTitle', { name: r.name }) : tt('nrDeleteTitle', { name: r.name })}
      data-review-dialog=${r.action} @close=${() => this.close()}>
      <div class="dlg">
        <div>${reject ? tt('nrRejectBody') : tt('nrDeleteBody')}</div>
        ${r.door_system_linked ? html`<div class="note" role="note" data-review-door-note>${tt('nrDoorNote')}</div>` : nothing}
        ${this.dialogError ? html`<div class="msg err" role="alert" data-review-dialog-error>${this.dialogError}</div>` : nothing}
      </div>
      <div slot="footer" class="foot">
        <sw-button size="sm" ?disabled=${this.busy} data-review-cancel @click=${() => this.close()}>${tt('nrCancel')}</sw-button>
        <sw-button size="sm" variant="danger" ?disabled=${this.busy} data-review-confirm @click=${() => void this.go()}>
          ${reject ? tt('nrConfirmReject') : tt('nrConfirmDelete')}</sw-button>
      </div>
    </sw-dialog>`;
  }

  private limitsCard(): TemplateResult | typeof nothing {
    const l = this.limits;
    if (!l) return nothing;
    const p = Number(this.draftPending);
    const i = Number(this.draftIdle);
    const ok = Number.isInteger(p) && p >= 7 && p <= 365 && Number.isInteger(i) && i >= 1 && i <= 60;
    const changed = p !== l.pending || i !== l.idle;
    return html`<sw-card heading=${tt('nrThresholds')} data-review-limits>
      <div class="limits">
        <label>${tt('nrPendingDays')}<input type="number" inputmode="numeric" min="7" max="365" data-review-pending-days aria-invalid=${String(!ok)}
          .value=${this.draftPending} @input=${(e: Event) => (this.draftPending = (e.target as HTMLInputElement).value)} /></label>
        <label>${tt('nrIdleMonths')}<input type="number" inputmode="numeric" min="1" max="60" data-review-idle-months aria-invalid=${String(!ok)}
          .value=${this.draftIdle} @input=${(e: Event) => (this.draftIdle = (e.target as HTMLInputElement).value)} /></label>
        <sw-button size="sm" ?disabled=${!ok || !changed || this.savingLimits} data-review-limits-save @click=${() => void this.saveLimits()}>${tt('nrSave')}</sw-button>
      </div>
    </sw-card>`;
  }

  render() {
    if (this.failed && !this.report) return html`<div class="msg err" role="alert" data-review-failed>${tt('nrLoadFailed')}: ${this.failed}</div>`;
    const r = this.report;
    if (!r) return nothing;
    return html`<div data-needs-review style="display:contents">
      ${this.section(tt('nrPendingTitle', { n: r.pending_days }), r.pending, 'pending')}
      ${this.section(tt('nrIdleTitle', { n: r.idle_months }), r.idle, 'idle')}
      ${this.limitsCard()}
      ${this.dialog()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-needs-review': TicketsNeedsReview;
  }
}
