import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ApiError, describeError, get, put } from '../api/client';
import { cycleMode, matrixOf, MATRIX_MODES, setCell, type MatrixMode, type NotifyDoc, type NotifySource, type NotifyMatrix } from './notify-matrix-model';

interface Meta { sources: NotifySource[]; departments: { id: string; name: string }[]; pending: number }

/**
 * TKNOTIFMATRIX: the notification matrix and the daily digest, rows of Settings > the module > general (administrator, `system.configure`).
 * Two switches that are OFF by default (today's behaviour): the matrix (which event reaches a department's managers at once / in the
 * digest / not at all, per department with "all departments" as the fallback) and the digest (one grouped notification per day at a
 * set time). The channels of each event stay in the notification policy screen. Light DOM, like the sibling settings rows: the card's
 * `.row` / `.lbl` / `.seg` styles reach it. Saves with the card's revision; the new document goes back up as `doc-changed`.
 */
@customElement('ticket-notify-matrix')
export class TicketNotifyMatrix extends LitElement {
  @property({ attribute: false }) doc: { revision: number; notify?: NotifyDoc } | null = null;
  @property({ type: Boolean }) disabled = false;
  @state() private meta: Meta | null = null;
  @state() private dept = '*';
  @state() private busy = false;
  @state() private error = '';
  @state() private time: string | null = null;

  protected createRenderRoot() {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.style.display = 'contents';
    get<Meta>('tickets/settings/notify-matrix').then((m) => (this.meta = m)).catch((e) => (this.error = describeError(e)));
  }

  private async save(notify: Record<string, unknown>): Promise<void> {
    if (!this.doc || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const doc = await put<{ revision: number; notify?: NotifyDoc }>('tickets/settings', { revision: this.doc.revision, notify });
      this.dispatchEvent(new CustomEvent('doc-changed', { detail: doc, bubbles: true, composed: true }));
      this.time = null;
      get<Meta>('tickets/settings/notify-matrix').then((m) => (this.meta = m)).catch(() => undefined);
    } catch (e) {
      this.error = e instanceof ApiError ? e.body.user_message || describeError(e) : describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private toggle(label: string, sub: string, checked: boolean, attr: string, key: string): TemplateResult {
    return html`<div class="row"><span class="lbl">${label}<span class="muted">${sub}</span></span>
      <sw-toggle label=${label} labelHidden .checked=${checked} ?disabled=${this.disabled || this.busy} data-notify=${attr}
        @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ [key]: e.detail.checked })}></sw-toggle></div>`;
  }

  private pick(src: NotifySource, matrix: NotifyMatrix): TemplateResult {
    const cur = matrixOf(matrix, this.dept, src.key);
    const modes = MATRIX_MODES.filter((m) => m !== 'digest' || src.digest);
    const name = { now: 'מיידי', digest: 'בתקציר', off: 'כבוי' } as const;
    return html`<div class="row"><span class="lbl">${src.label}</span>
      <span class="seg" role="radiogroup" aria-label=${src.label}>${modes.map((m: MatrixMode) => html`<button type="button" role="radio" aria-pressed=${String(cur === m)} aria-checked=${String(cur === m)}
        data-notify-cell=${`${src.key}:${m}`} ?disabled=${this.disabled || this.busy}
        @click=${() => void this.save({ matrix: setCell(matrix, this.dept, src.key, cycleMode(cur, m)) })}>${name[m]}</button>`)}</span></div>`;
  }

  render() {
    const n = this.doc?.notify;
    if (!n) return nothing;
    const timeVal = this.time ?? n.digest_time;
    const dirty = this.time !== null && this.time !== n.digest_time && /^([01]\d|2[0-3]):[0-5]\d$/.test(this.time);
    return html`
      ${this.toggle('התאמת התראות לפי מחלקה', 'כשכבוי כל האירועים מתריעים כרגיל', n.matrix_enabled, 'matrix-enabled', 'matrix_enabled')}
      ${this.toggle('תקציר יומי', 'אירועים שסומנו "בתקציר" נאספים ונשלחים פעם ביום, הודעה אחת לכל מחלקה', n.digest_enabled, 'digest-enabled', 'digest_enabled')}
      <div class="row"><span class="lbl">שעת התקציר<span class="muted">${this.meta ? `${this.meta.pending} אירועים ממתינים` : ''}</span></span>
        <span class="end"><input class="in time" type="time" aria-label="שעת התקציר" data-notify-time .value=${timeVal} ?disabled=${this.disabled || this.busy}
          @input=${(e: Event) => (this.time = (e.target as HTMLInputElement).value)} />
          <sw-button size="sm" variant="primary" data-notify-time-save ?disabled=${!dirty || this.busy} @click=${() => void this.save({ digest_time: this.time })}>שמירה</sw-button></span></div>
      ${n.matrix_enabled && this.meta ? html`
        <div class="row"><span class="lbl">מחלקה</span>
          <select class="in" aria-label="מחלקה" data-notify-dept .value=${this.dept} @change=${(e: Event) => (this.dept = (e.target as HTMLSelectElement).value)}>
            <option value="*">כל המחלקות</option>
            ${this.meta.departments.map((d) => html`<option value=${d.id} ?selected=${this.dept === d.id}>${d.name}</option>`)}
          </select></div>
        ${this.meta.sources.map((s) => this.pick(s, n.matrix))}` : nothing}
      ${this.error ? html`<div class="row"><span class="field-error" role="alert" data-notify-error>${this.error}</span></div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-notify-matrix': TicketNotifyMatrix;
  }
}
