import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import { commandId } from '../api/request-id';
import { players, playerErrorText, type GroupRecord, type PausePreview } from '../api/media-players';
import type { BulkScope } from '../api/media-screens';
import { bidi } from '../i18n/bidi';
import { summarizeRecord } from '../screens/multimedia-players-layout';

const PAUSE_REASON: Record<string, string> = { not_playing: 'לא מנגן', unavailable: 'לא זמין', not_allowed: 'אין הרשאה' };

/** A generic confirmation: the question, one sentence, the rooms under a closed "פרטים", and what the confirm button does. */
export interface GroupConfirmRequest {
  heading: string;
  sub?: string;
  /** The rooms / devices of the preview, by name. */
  names?: string[];
  ok: string;
  danger?: boolean;
  /** Runs when the confirm button is pressed (only there); a rejection is shown in the dialog. The dialog closes when it resolves. */
  run: () => Promise<void>;
}
export interface PauseRequest {
  scope: BulkScope;
  /** The HA floor / area id. */
  id: string;
  name: string;
}

type Phase = 'closed' | 'loading' | 'confirm' | 'nothing' | 'sending' | 'running' | 'result' | 'error';

/**
 * CR-016: the confirmations of the players area, the shape of `media-bulk-dialog` (CR-015 7a). Two uses:
 *  - `confirm(req)`: the party rule (CR §6.2) - a group of 4 or more rooms, or one spanning more than one floor, asks once, with the
 *    server's preview ("לצרף 4 חדרים לקבוצה אחת?"); only the confirm button sends (`confirmed: true`, by the caller's `run`);
 *  - `pause(req)`: a floor's "עצור מוזיקה" - the server's preview (who pauses, who is skipped and why), then the honest per-room
 *    result by name ("בוצע" only when every room confirmed, otherwise "בוצע חלקית: <room> לא נעצר").
 * Short: the question and two buttons; the details sit under a closed "פרטים". Focus starts on the cancel button, so a stray Enter
 * never starts anything. It inherits the glass tokens of the page it sits in.
 *   <media-group-dialog @group-done=${...}></media-group-dialog>
 */
@customElement('media-group-dialog')
export class MediaGroupDialog extends LitElement {
  @state() private phase: Phase = 'closed';
  @state() private req: GroupConfirmRequest | null = null;
  @state() private pauseReq: PauseRequest | null = null;
  @state() private preview: PausePreview | null = null;
  @state() private record: GroupRecord | null = null;
  @state() private error = '';
  private stopped = false;

  static styles = css`
    .what {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    details {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    summary {
      cursor: pointer;
      min-block-size: 44px;
      display: inline-flex;
      align-items: center;
    }
    ul {
      margin: 4px 0 0;
      padding-inline-start: 18px;
      max-block-size: 160px;
      overflow: auto;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-block-start: 6px;
    }
    .headline {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .headline.ok {
      color: var(--sw-success);
    }
    .headline.partial {
      color: var(--sw-warning);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .tag {
      color: var(--sw-text-3);
      margin-inline-start: 6px;
    }
  `;

  /** The party confirmation (or any "are you sure" of the players area). */
  confirm(req: GroupConfirmRequest) {
    if (this.phase === 'sending' || this.phase === 'running') return;
    this.stopped = false;
    this.req = req;
    this.pauseReq = null;
    this.preview = null;
    this.record = null;
    this.error = '';
    this.phase = 'confirm';
  }

  /** Floor / room "עצור מוזיקה": reads the server's preview, then waits for Cancel or the confirm button. */
  async pause(req: PauseRequest) {
    if (this.phase === 'sending' || this.phase === 'running') return;
    this.stopped = false;
    this.req = null;
    this.pauseReq = req;
    this.preview = null;
    this.record = null;
    this.error = '';
    this.phase = 'loading';
    try {
      const p = await players().pausePreview(req.scope, req.id);
      if (this.pauseReq !== req) return;
      this.preview = p;
      this.phase = p.counts.send ? 'confirm' : 'nothing';
    } catch (err) {
      if (this.pauseReq !== req) return;
      this.error = err instanceof ApiError && err.status === 403 ? 'אין לך הרשאה לעצירה מרוכזת כאן.' : playerErrorText(err);
      this.phase = 'error';
    }
  }

  private close = () => {
    if (this.phase === 'sending') return;
    this.stopped = true;
    this.phase = 'closed';
  };

  private async runConfirm() {
    const req = this.req;
    if (!req || this.phase !== 'confirm') return;
    this.phase = 'sending';
    try {
      await req.run();
      this.phase = 'closed';
    } catch (err) {
      this.error = playerErrorText(err);
      this.phase = 'error';
    }
  }

  private async runPause() {
    const req = this.pauseReq;
    if (!req || this.phase !== 'confirm') return;
    this.phase = 'sending';
    try {
      const run = await players().pauseRun(req.scope, req.id, commandId(), new Date(Date.now() + 15_000).toISOString());
      this.phase = 'running';
      this.record = await this.follow(run.bulk_id);
      this.phase = 'result';
      this.dispatchEvent(new CustomEvent('group-done', { detail: this.record, bubbles: true, composed: true }));
    } catch (err) {
      this.error = err instanceof ApiError && err.code === 'target_changed' ? 'רשימת הנגנים השתנתה; לא נשלח דבר. פתחו מחדש.' : describeError(err);
      this.phase = 'error';
      this.dispatchEvent(new CustomEvent('group-done', { detail: null, bubbles: true, composed: true }));
    }
  }

  /** The per-room record, polled until it is done (6 s at most). A record that cannot be read (the static demo has none) ends as null = "בוצע". */
  private async follow(bulkId: string): Promise<GroupRecord | null> {
    const deadline = Date.now() + 6000;
    let last: GroupRecord | null = null;
    while (Date.now() < deadline && !this.stopped) {
      try {
        last = await players().groupRecord(bulkId);
        if (last.status === 'done') return last;
      } catch {
        return last;
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    return last;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopped = true;
  }

  /** Focus starts on Cancel at every step. */
  protected updated(changed: Map<string, unknown>) {
    if (!changed.has('phase') || this.phase === 'closed' || this.phase === 'sending' || this.phase === 'running') return;
    requestAnimationFrame(() => {
      const btn = this.renderRoot.querySelector<HTMLElement>('sw-button[data-gd-cancel]');
      (btn?.shadowRoot?.querySelector<HTMLElement>('button') ?? btn)?.focus({ preventScroll: true });
    });
  }

  render() {
    if (this.phase === 'closed' || (!this.req && !this.pauseReq)) return html`<sw-dialog data-group-dialog="closed"></sw-dialog>`;
    const p = this.preview;
    const pr = this.pauseReq;
    const heading = this.req
      ? this.req.heading
      : this.phase === 'confirm' && p && pr ? `לעצור ${p.counts.send === 1 ? 'נגן אחד' : `${p.counts.send} נגנים`} ב${bidi(pr.name)}?` : `עצירת מוזיקה · ${bidi(pr?.name ?? '')}`;
    return html`<sw-dialog open ?locked=${this.phase === 'sending'} data-group-dialog=${this.phase} heading=${heading} @close=${this.close}>${this.body()}</sw-dialog>`;
  }

  private cancel(label = 'ביטול') {
    return html`<sw-button data-gd-cancel autofocus @click=${this.close}>${label}</sw-button>`;
  }

  private body() {
    const p = this.preview;
    if (this.phase === 'loading') return html`<div class="muted">בודק…</div><div class="actions">${this.cancel()}</div>`;
    if (this.phase === 'error') return html`<div class="err" data-gd-error>${this.error}</div><div class="actions">${this.cancel('סגור')}</div>`;
    if (this.req) {
      const r = this.req;
      return html`<div class="what" data-gd-what>${r.sub ? html`<div>${r.sub}</div>` : nothing}
        ${r.names?.length ? html`<details data-gd-details><summary>פרטים</summary><ul>${r.names.map((n) => html`<li>${bidi(n)}</li>`)}</ul></details>` : nothing}</div>
        <div class="actions">${this.cancel()}<sw-button data-gd-confirm variant=${r.danger ? 'danger' : 'primary'} @click=${() => void this.runConfirm()}>${r.ok}</sw-button></div>`;
    }
    if (this.phase === 'nothing' && p) return html`<div class="what" data-gd-nothing><div>אין נגן מנגן שאושר לעצירה.</div>${this.details(p)}</div><div class="actions">${this.cancel('סגור')}</div>`;
    if (this.phase === 'confirm' && p) {
      return html`<div class="what" data-gd-what>${this.details(p)}</div>
        <div class="actions">${this.cancel()}<sw-button data-gd-confirm variant="primary" @click=${() => void this.runPause()}>עצור (${p.counts.send})</sw-button></div>`;
    }
    if (this.phase === 'sending' || (!this.record && this.phase === 'running')) return html`<div class="muted" data-gd-progress>שולח…</div>`;
    // a room that was skipped (it was not playing, it is unavailable ...) is in the record as `will: skip` - not a room that failed to pause
    const s = summarizeRecord(this.record && { ...this.record, members: this.record.members.filter((m) => m.will !== 'skip') });
    const partial = !!this.record && s.failed.length > 0;
    return html`<div class="what" data-gd-result=${partial ? 'partial' : 'ok'}>
        <div class=${classMap({ headline: true, ok: !partial, partial })}><sw-icon .name=${partial ? 'warning' : 'check'} size="16"></sw-icon>${partial ? `בוצע חלקית: ${s.failed.length} לא נעצרו` : 'בוצע'}</div>
        ${partial ? html`<ul>${s.failed.map((f) => html`<li>${bidi(f.room)}<span class="tag">לא נעצר</span></li>`)}</ul>` : nothing}
      </div><div class="actions">${this.cancel('סגור')}</div>`;
  }

  /** The folded "פרטים": who is paused, who is skipped and why. */
  private details(p: PausePreview) {
    const send = p.devices.filter((d) => d.will === 'pause');
    const skip = p.devices.filter((d) => d.will === 'skip');
    return html`<details data-gd-details><summary>פרטים</summary>
      ${send.length ? html`<ul>${send.map((d) => html`<li>${bidi(d.name)}</li>`)}</ul>` : nothing}
      ${skip.length ? html`<div class="muted">לא נכללו:</div><ul>${skip.map((d) => html`<li>${bidi(d.name)}<span class="tag">${d.reason ? PAUSE_REASON[d.reason] ?? d.reason : ''}</span></li>`)}</ul>` : nothing}
    </details>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-group-dialog': MediaGroupDialog;
  }
}
