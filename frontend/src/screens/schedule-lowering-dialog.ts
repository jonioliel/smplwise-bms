import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-icon';
import type { LoweringSummary } from './schedule-edit-logic';

/**
 * CR-014 S4: the explicit confirmation of a sensitive schedule (SCHEDULER_API §5.3, decision 3/4): a schedule that opens a
 * lock, door or gate, or disarms the alarm, acts with nobody present - the person confirms in plain words, ticks the box, and
 * (only when the creator's own alarm policy asks, §5.6) types the alarm code once; the code is sent with the request and never
 * stored in the schedule. The same dialog serves the editor's save and S3's enable / run of such a schedule.
 *
 * `<schedule-lowering-dialog .open .summary .needsCode .busy .error @confirm={alarm_code} @close>`
 */

/**
 * What the schedule does that lowers protection. Two producers, one dialog: the editor's `loweringSummary`
 * (schedule-edit-logic.ts: kinds and a times string) and S3's (schedules-logic.ts: `{entities, times[], text}`, the sentence
 * already written). `text`, when given, is shown as is; otherwise the sentence is built from the rest.
 */
export interface LoweringDialogSummary {
  entities: string[];
  times?: string | string[];
  text?: string;
  kinds?: string[];
  sensitive?: boolean;
  lowering?: boolean;
}
export type { LoweringSummary };

@customElement('schedule-lowering-dialog')
export class ScheduleLoweringDialog extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ attribute: false }) summary: LoweringDialogSummary = { entities: [], kinds: [], times: '', sensitive: true, lowering: true };
  /** The alarm code is asked for (the creator's policy requires it). */
  @property({ type: Boolean }) needsCode = false;
  @property({ type: Boolean }) busy = false;
  @property() error = '';
  /** The button's words: "שמירה" (default), "הפעלה", "הרצה". */
  @property() confirmLabel = 'שמירה';
  @state() private ack = false;
  @state() private code = '';

  static styles = css`
    :host {
      display: contents;
    }
    .warn {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-danger-soft);
      color: #991b1b;
      font-size: var(--sw-fs-md);
      line-height: 1.5;
    }
    .warn.soft {
      background: var(--sw-warning-soft);
      color: #92400e;
    }
    .warn sw-icon {
      flex: none;
      margin-block-start: 2px;
    }
    label.ack {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      font-size: var(--sw-fs-md);
      cursor: pointer;
    }
    label.ack input {
      inline-size: 18px;
      block-size: 18px;
      margin: 2px 0 0;
      accent-color: var(--sw-danger);
    }
    .code {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .code label {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    .code input {
      min-block-size: 34px;
      padding: 4px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      font: inherit;
      direction: ltr;
      text-align: start;
      letter-spacing: 0.2em;
    }
    .code input:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .code small {
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
  `;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open) {
      this.ack = false;
      this.code = '';
    }
  }

  private close() {
    if (this.busy) return;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private confirm() {
    if (!this.ack || this.busy || (this.needsCode && !this.code.trim())) return;
    this.dispatchEvent(new CustomEvent('confirm', { detail: { alarm_code: this.needsCode ? this.code.trim() : null }, bubbles: true, composed: true }));
  }

  private sentence(): string {
    const s = this.summary;
    if (s.text) return s.text;
    const who = s.entities.join(', ');
    const times = Array.isArray(s.times) ? s.times.join(', ') : s.times ?? '';
    const kinds = s.kinds ?? [];
    if (s.lowering !== false) {
      const verb = kinds.length === 1 ? (kinds[0] === 'מנטרל' ? 'ינטרל' : kinds[0] === 'פותח נעילה' ? 'יפתח את נעילת' : 'יפתח') : 'יפתח / ינטרל';
      return `התזמון ${verb} ${who}${times ? ` ב־${times}` : ''} גם כשאיש אינו נמצא במקום.`;
    }
    return `התזמון כולל פעולה רגישה (אזעקה, מנעול, דלת או שער)${times ? ` ב־${times}` : ''} והוא יפעל גם כשאיש אינו נמצא במקום.`;
  }

  render() {
    const lowering = this.summary.lowering !== false;
    return html`<sw-dialog ?open=${this.open} heading=${lowering ? 'תזמון שפותח או מנטרל' : 'תזמון של פעולה רגישה'} data-lowering-dialog @close=${this.close}>
      <div class="warn ${lowering ? '' : 'soft'}" role="alert" data-lowering-warning><sw-icon name="warning" size="20"></sw-icon><div>${this.sentence()}</div></div>
      <label class="ack"><input type="checkbox" data-lowering-ack .checked=${this.ack} @change=${(e: Event) => (this.ack = (e.target as HTMLInputElement).checked)} /><span>${lowering ? 'אני מבין שהפעולה תתבצע אוטומטית, ומאשר.' : 'אני מאשר את הפעולה הרגישה.'}</span></label>
      ${this.needsCode
        ? html`<div class="code"><label for="alarm-code">קוד האזעקה</label><input id="alarm-code" type="password" inputmode="numeric" autocomplete="off" data-lowering-code .value=${this.code} @input=${(e: Event) => (this.code = (e.target as HTMLInputElement).value)} /><small>הקוד נבדק פעם אחת ואינו נשמר בתזמון.</small></div>`
        : nothing}
      ${this.error ? html`<div class="err" role="alert" data-lowering-error>${this.error}</div>` : nothing}
      <div slot="footer" style="display:contents">
        <sw-button data-lowering-cancel ?disabled=${this.busy} @click=${this.close}>ביטול</sw-button>
        <sw-button variant="primary" data-lowering-ok ?disabled=${!this.ack || this.busy || (this.needsCode && !this.code.trim())} @click=${this.confirm}>${this.busy ? 'שולח…' : this.confirmLabel}</sw-button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schedule-lowering-dialog': ScheduleLoweringDialog;
  }
}
