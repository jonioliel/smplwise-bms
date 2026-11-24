import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import '../components/sw-button';
import { toggled } from '../components/sw-toggle';
import '../components/sw-icon';
import type { LoweringSummary } from './schedule-edit-logic';
import { tr } from '../i18n/msg/automation';

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
interface LoweringDialogSummary {
  entities: string[];
  times?: string | string[];
  text?: string;
  kinds?: string[];
  sensitive?: boolean;
  lowering?: boolean;
}
export type { LoweringSummary };

export class ScheduleLoweringDialog extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ attribute: false }) summary: LoweringDialogSummary = { entities: [], kinds: [], times: '', sensitive: true, lowering: true };
  /** The alarm code is asked for (the creator's policy requires it). */
  @property({ type: Boolean }) needsCode = false;
  @property({ type: Boolean }) busy = false;
  @property() error = '';
  /** The button's words: "שמירה" (default), "הפעלה", "הרצה". */
  @property() confirmLabel = tr('שמירה');
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
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-md);
      line-height: 1.5;
    }
    .warn.soft {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
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
    label.ack sw-toggle {
      flex: none;
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
      const verb = kinds.length === 1 ? (kinds[0] === 'מנטרל' ? tr('ינטרל') : kinds[0] === 'פותח נעילה' ? tr('יפתח את נעילת') : tr('יפתח')) : tr('יפתח / ינטרל');
      return tr('התזמון {verb} {who}{when} גם כשאיש אינו נמצא במקום.', { verb, who, when: times ? ` ${tr('ב־{times}', { times })}` : '' });
    }
    return tr('התזמון כולל פעולה רגישה (אזעקה, מנעול, דלת או שער){when} והוא יפעל גם כשאיש אינו נמצא במקום.', { when: times ? ` ${tr('ב־{times}', { times })}` : '' });
  }

  render() {
    const lowering = this.summary.lowering !== false;
    const ackText = lowering ? tr('אני מבין שהפעולה תתבצע אוטומטית, ומאשר.') : tr('אני מאשר את הפעולה הרגישה.');
    return html`<sw-dialog ?open=${this.open} heading=${lowering ? tr('תזמון שפותח או מנטרל') : tr('תזמון של פעולה רגישה')} data-lowering-dialog @close=${this.close}>
      <div class="warn ${lowering ? '' : 'soft'}" role="alert" data-lowering-warning><sw-icon name="warning" size="20"></sw-icon><div>${this.sentence()}</div></div>
      <label class="ack"><sw-toggle size="sm" labelHidden in-label label=${ackText} data-lowering-ack .checked=${this.ack} @change=${(e: Event) => (this.ack = toggled(e))}></sw-toggle><span>${ackText}</span></label>
      ${this.needsCode
        ? html`<div class="code"><label for="alarm-code">${tr('קוד האזעקה')}</label><input id="alarm-code" type="password" inputmode="numeric" autocomplete="off" data-lowering-code .value=${this.code} @input=${(e: Event) => (this.code = (e.target as HTMLInputElement).value)} /><small>${tr('הקוד נבדק פעם אחת ואינו נשמר בתזמון.')}</small></div>`
        : nothing}
      ${this.error ? html`<div class="err" role="alert" data-lowering-error>${this.error}</div>` : nothing}
      <div slot="footer" style="display:contents">
        <sw-button data-lowering-cancel ?disabled=${this.busy} @click=${this.close}>${tr('ביטול')}</sw-button>
        <sw-button variant="primary" data-lowering-ok ?disabled=${!this.ack || this.busy || (this.needsCode && !this.code.trim())} @click=${this.confirm}>${this.busy ? tr('שולח…') : this.confirmLabel}</sw-button>
      </div>
    </sw-dialog>`;
  }
}

// Registered once and only if the tag is free (S3's list spec stands its own double in first; the product never does).
if (!customElements.get('schedule-lowering-dialog')) customElements.define('schedule-lowering-dialog', ScheduleLoweringDialog);

declare global {
  interface HTMLElementTagNameMap {
    'schedule-lowering-dialog': ScheduleLoweringDialog;
  }
}
