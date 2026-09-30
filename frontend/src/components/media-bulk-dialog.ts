import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import { commandId } from '../api/request-id';
import { isApi } from '../api/session';
import { bulkHeadline, followBulk, getBulk, type BulkRecord } from '../api/device-bulk';
import { media, type BulkPreview, type BulkScope } from '../api/media-screens';
import { bidi } from '../i18n/bidi';

const REASON: Record<string, string> = {
  already_off: 'כבוי כבר',
  not_confirmed: 'לא אושר שהוא דולק',
  unavailable: 'לא זמין',
  not_allowed: 'אין הרשאה',
};

export interface MediaBulkRequest {
  scope: BulkScope;
  /** The HA floor / area id. */
  id: string;
  /** The floor / area name for the question. */
  name: string;
}

type Phase = 'closed' | 'loading' | 'confirm' | 'nothing' | 'sending' | 'running' | 'result' | 'error';

/**
 * CR-015 decision 7a: the confirmation of "כבה מסכים" on a floor and "כבה הכל" on an area (screens only; receivers are never
 * included). Short: the question with the count and two buttons; the screens, what is skipped and why sit under a closed
 * "פרטים". Only its confirm button sends (`confirmed: true`, through the server's preview - the server decides which screens are
 * confirmed on); then the honest per-screen result ("בוצע" only when every screen confirmed, otherwise "בוצע חלקית: k לא אושרו"). The engine is the
 * devices area's bulk record (GET /devices/actions/{id}), followed here like devices-bulk-dialog does.
 * Usage: `<media-bulk-dialog @bulk-done=${...}></media-bulk-dialog>` and `el.show({ scope, id, name })`. Used by the screens page
 * and S3's area card. It inherits the glass tokens of the screen it sits in.
 */
@customElement('media-bulk-dialog')
export class MediaBulkDialog extends LitElement {
  @state() private phase: Phase = 'closed';
  @state() private req: MediaBulkRequest | null = null;
  @state() private preview: BulkPreview | null = null;
  @state() private record: BulkRecord | null = null;
  @state() private error = '';
  private follow: { stopped: boolean } | null = null;

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
      min-block-size: 32px;
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
    .bar {
      block-size: 8px;
      border-radius: 999px;
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .bar > div {
      block-size: 100%;
      background: var(--sw-success);
      transition: inline-size var(--sw-t-med) var(--sw-ease);
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
    .headline.partial,
    .headline.none {
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

  /** Opens the dialog for one floor / area: reads the server's preview, then waits for Cancel or the confirm button. */
  async show(req: MediaBulkRequest) {
    if (this.phase === 'sending' || this.phase === 'running') return;
    this.req = req;
    this.preview = null;
    this.record = null;
    this.error = '';
    this.phase = 'loading';
    try {
      const p = await media().bulkPreview(req.scope, req.id);
      if (this.req !== req) return;
      this.preview = p;
      this.phase = p.counts.send ? 'confirm' : 'nothing';
    } catch (err) {
      if (this.req !== req) return;
      this.error = err instanceof ApiError && err.status === 403 ? 'אין לך הרשאה לכיבוי מרוכז כאן.' : describeError(err);
      this.phase = 'error';
    }
  }

  private close = () => {
    if (this.phase === 'sending') return; // the request is on its way
    this.phase = 'closed';
  };

  private async confirm() {
    const req = this.req;
    const p = this.preview;
    if (!req || !p || this.phase !== 'confirm') return;
    this.phase = 'sending';
    try {
      const run = await media().bulkRun(req.scope, req.id, commandId(), new Date(Date.now() + 15_000).toISOString());
      this.phase = 'running';
      if (isApi()) {
        this.follow = { stopped: false };
        this.record = await followBulk(await getBulk(run.bulk_id), (r) => (this.record = r), this.follow);
      }
      this.phase = 'result';
      this.dispatchEvent(new CustomEvent('bulk-done', { detail: this.record, bubbles: true, composed: true }));
    } catch (err) {
      this.error = err instanceof ApiError && err.code === 'target_changed' ? 'רשימת המסכים השתנתה; לא נשלח דבר. פתחו מחדש.' : describeError(err);
      this.phase = 'error';
      this.dispatchEvent(new CustomEvent('bulk-done', { detail: null, bubbles: true, composed: true }));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.follow) this.follow.stopped = true;
  }

  /** Focus starts on Cancel at every step: a stray Enter never turns screens off. */
  protected updated(changed: Map<string, unknown>) {
    if (!changed.has('phase') || this.phase === 'closed' || this.phase === 'sending' || this.phase === 'running') return;
    requestAnimationFrame(() => {
      const btn = this.renderRoot.querySelector<HTMLElement>('sw-button[data-bulk-cancel]');
      (btn?.shadowRoot?.querySelector<HTMLElement>('button') ?? btn)?.focus({ preventScroll: true });
    });
  }

  render() {
    const req = this.req;
    if (this.phase === 'closed' || !req) return html`<sw-dialog data-media-bulk="closed"></sw-dialog>`;
    const p = this.preview;
    const heading = this.phase === 'confirm' && p ? `לכבות ${p.counts.send === 1 ? 'מסך אחד' : `${p.counts.send} מסכים`} ב${bidi(req.name)}?` : `כיבוי מסכים · ${bidi(req.name)}`;
    return html`<sw-dialog open ?locked=${this.phase === 'sending'} data-media-bulk=${this.phase} heading=${heading} @close=${this.close}>${this.body()}</sw-dialog>`;
  }

  private cancel(label = 'ביטול') {
    return html`<sw-button data-bulk-cancel autofocus @click=${this.close}>${label}</sw-button>`;
  }

  private body() {
    const p = this.preview;
    if (this.phase === 'loading') return html`<div class="muted">בודק…</div><div class="actions">${this.cancel()}</div>`;
    if (this.phase === 'error') return html`<div class="err" data-bulk-error>${this.error}</div><div class="actions">${this.cancel('סגור')}</div>`;
    if (this.phase === 'nothing' && p) return html`<div class="what" data-bulk-nothing><div>אין מסך דולק שאושר לכיבוי.</div>${this.details(p)}</div><div class="actions">${this.cancel('סגור')}</div>`;
    if (this.phase === 'confirm' && p) {
      return html`<div class="what" data-bulk-what>${this.details(p)}</div>
        <div class="actions">${this.cancel()}<sw-button data-bulk-confirm variant="danger" @click=${() => void this.confirm()}>כבה (${p.counts.send})</sw-button></div>`;
    }
    const r = this.record;
    if (this.phase === 'sending' || (!r && this.phase === 'running')) return html`<div class="muted" data-bulk-progress>שולח…</div>`;
    if (!r) return html`<div class="what" data-bulk-result="ok"><div class="headline ok"><sw-icon name="check" size="16"></sw-icon>בוצע</div></div><div class="actions">${this.cancel('סגור')}</div>`;
    const h = bulkHeadline(r);
    const c = r.counts;
    const pct = c.total ? Math.round((c.confirmed / c.total) * 100) : 0;
    const notOk = r.items.filter((i) => i.outcome !== 'confirmed');
    return html`<div class="what" data-bulk-progress data-confirmed=${c.confirmed} data-total=${c.total}>
        <div class=${classMap({ headline: true, [h.tone]: true })} data-bulk-result=${r.done ? h.tone : 'running'}>${r.done ? html`<sw-icon .name=${h.tone === 'ok' ? 'check' : 'warning'} size="16"></sw-icon>` : nothing}${h.text}</div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax=${c.total} aria-valuenow=${c.confirmed} aria-label="אושרו"><div style=${`inline-size:${pct}%`}></div></div>
        ${r.done && notOk.length ? html`<ul>${notOk.map((i) => html`<li>${bidi(i.name)}<span class="tag">לא אושר</span></li>`)}</ul>` : nothing}
      </div>
      <div class="actions">${this.cancel('סגור')}</div>`;
  }

  /** The folded "פרטים": who is turned off, who is skipped and why. */
  private details(p: BulkPreview) {
    const off = p.devices.filter((d) => d.will === 'off');
    const skip = p.devices.filter((d) => d.will === 'skip');
    return html`<details data-bulk-details><summary>פרטים</summary>
      ${off.length ? html`<ul>${off.map((d) => html`<li>${bidi(d.name)}</li>`)}</ul>` : nothing}
      ${skip.length ? html`<div class="muted">לא נכללו:</div><ul>${skip.map((d) => html`<li>${bidi(d.name)}<span class="tag">${d.reason ? REASON[d.reason] ?? d.reason : ''}</span></li>`)}</ul>` : nothing}
    </details>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-bulk-dialog': MediaBulkDialog;
  }
}
