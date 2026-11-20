import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-dialog';
import './sw-button';
import './sw-table';
import type { TableColumn } from './sw-table';
import { settingsStyles } from '../styles/settings';
import { outcomeOf, type DiffRow, type WriteOutcome } from '../api/installer';
import { fill, installerText as T } from '../i18n/wiskey-installer';
import { confirmWord, confirmWordKeyOf, confirmWordMatches, type ConfirmWordKey } from '../i18n/confirm-words';

export interface ConfirmRequest {
  heading: string;
  /** What will happen, in plain words. */
  body: string;
  /** The change, field by field (`label` is shown); empty when the action has no fields. */
  diff?: Array<DiffRow & { label: string; show?: (v: unknown) => string }>;
  /** A dangerous action: the exact phrase to type (the server checks it again). */
  typed?: string;
  /** `typed` is a FIXED phrase of the confirmation words (i18n/confirm-words.ts), not a station's name: the dialog shows the
   * interface's own phrase and takes the Hebrew or the English one, as the server does. */
  typedFixed?: boolean;
  danger?: boolean;
  /** WisKey's own upper bound for the call, in seconds - shown while waiting (honest: no invented stages). */
  maxSeconds?: number;
  /** Extra content between the body and the diff (an option the person sets before confirming). */
  extra?: () => TemplateResult;
  /** The one call; its result is handed to `done`. */
  send: (typed: string | undefined) => Promise<unknown>;
  done?: (reply: unknown) => void;
  failed?: (outcome: WriteOutcome) => void;
}

/**
 * WISKEY-INSTALLER-NATIVE-2400: the confirmation step of every installer write - what will change (before / after), the typed phrase of a
 * dangerous action, then ONE send with an honest wait (elapsed seconds against WisKey's own limit; the dialog cannot be closed while the
 * call is out) and the outcome in words: done, refused (nothing changed), not sent, or unknown (it may have happened - check first).
 */
type DiffLine = NonNullable<ConfirmRequest['diff']>[number];
/** CR-CMP2-TABLES-REST-2470 (owner N10): what will change - the setting, its value before and after; a changed row's new value in the
 * heading ink and weight, an unchanged row quiet */
const diffCols = (show: (row: DiffLine, v: unknown) => string): TableColumn<DiffLine>[] => [
  { key: 'label', label: T.confirm.willChange, render: (d) => (d.changed ? d.label : html`<span class="mut">${d.label}</span>`) },
  { key: 'before', label: T.confirm.before, render: (d) => (d.changed ? show(d, d.before) : html`<span class="mut">${show(d, d.before)}</span>`) },
  { key: 'after', label: T.confirm.after, render: (d) => (d.changed ? html`<span class="t1">${show(d, d.after)}</span>` : html`<span class="mut">${show(d, d.after)}</span>`) },
];

@customElement('wk-installer-confirm')
export class WkInstallerConfirm extends LitElement {
  @property({ attribute: false }) request: ConfirmRequest | null = null;
  @state() private typed = '';
  @state() private busy = false;
  @state() private elapsed = 0;
  @state() private outcome: WriteOutcome | null = null;
  private timer: number | null = null;

  static styles = [
    settingsStyles,
    css`
      :host {
        display: contents;
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: 12px;
        line-height: 1.5;
      }
      /* CR-CMP2-TABLES-REST-2470 (owner N10): what will change is the shared table in the dialog (no card of its own, never wider than the
         dialog; values wrap anywhere, as before). A changed row's new value is in the heading ink and weight, an unchanged row is quiet. */
      sw-table[data-diff] {
        --sw-table-min: 0;
        --sw-table-cell-pad: 6px 8px;
        font-variant-numeric: tabular-nums;
      }
      sw-table[data-diff]::part(cell) {
        white-space: normal;
        overflow-wrap: anywhere;
        vertical-align: top;
      }
      .typed {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .typed b {
        user-select: all;
        unicode-bidi: plaintext;
      }
      .typed input {
        font: inherit;
        min-block-size: 40px;
        padding: 0 10px;
        border: 1px solid var(--sw-border-strong, var(--sw-border));
        border-radius: var(--sw-r-md);
        background: var(--sw-surface);
        color: var(--sw-text);
      }
      .typed input:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: 1px;
      }
      .wait {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .bar {
        block-size: 4px;
        border-radius: 2px;
        background: var(--sw-surface-3);
        overflow: hidden;
      }
      .bar span {
        display: block;
        block-size: 100%;
        background: var(--sw-accent);
        transition: inline-size 1s linear;
      }
      .note {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
    `,
  ];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopTimer();
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('request') && this.request) {
      this.typed = '';
      this.outcome = null;
      this.busy = false;
      this.elapsed = 0;
    }
  }

  private stopTimer(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private close(): void {
    if (this.busy) return;
    this.request = null;
    this.dispatchEvent(new CustomEvent('closed', { bubbles: true, composed: true }));
  }

  private get typedOk(): boolean {
    const want = this.request?.typed;
    if (!want) return true;
    const norm = (s: string) => s.normalize('NFC').split(/\s+/).filter(Boolean).join(' ');
    const key = this.wordKey;
    return key ? confirmWordMatches(key, this.typed, null, norm) : norm(this.typed) === norm(want);
  }

  /** The key of a fixed phrase (see `typedFixed`); undefined for a station's name. */
  private get wordKey(): ConfirmWordKey | undefined {
    const r = this.request;
    return r?.typed && r.typedFixed ? confirmWordKeyOf(r.typed) : undefined;
  }

  private async send(): Promise<void> {
    const r = this.request;
    if (!r || this.busy || !this.typedOk) return;
    this.busy = true;
    this.outcome = null;
    this.elapsed = 0;
    const started = Date.now();
    this.timer = window.setInterval(() => (this.elapsed = Math.floor((Date.now() - started) / 1000)), 1000);
    try {
      const reply = await r.send(r.typed ? this.typed : undefined);
      this.stopTimer();
      this.busy = false;
      r.done?.(reply);
      this.request = null;
      this.dispatchEvent(new CustomEvent('closed', { bubbles: true, composed: true }));
    } catch (err) {
      this.stopTimer();
      this.busy = false;
      this.outcome = outcomeOf(err);
      r.failed?.(this.outcome);
    }
  }

  private outcomeLine(o: WriteOutcome): TemplateResult {
    const tone = o.status === 'refused' || o.status === 'not_sent' ? 'err' : 'warn';
    const text =
      o.status === 'refused'
        ? fill(T.result.refused, { code: o.code ?? '' })
        : o.status === 'not_sent'
          ? fill(T.result.not_sent, { message: o.message })
          : T.result.unknown;
    return html`<div class="msg ${tone}" role="alert" data-outcome=${o.status}>
      ${text}${o.retryAfterS ? html` ${fill(T.result.retryIn, { s: Math.ceil(o.retryAfterS) })}` : nothing}
    </div>`;
  }

  render(): TemplateResult {
    const r = this.request;
    const max = r?.maxSeconds ?? 30;
    const pct = Math.min(100, Math.round((this.elapsed / max) * 100));
    const show = (row: { show?: (v: unknown) => string }, v: unknown) => (row.show ? row.show(v) : v === undefined || v === null || v === '' ? T.none : String(v));
    return html`<sw-dialog ?open=${!!r} heading=${r?.heading ?? ''} ?locked=${this.busy} @close=${() => this.close()} data-installer-confirm>
      ${r
        ? html`<div class="body">
            <div>${r.body}</div>
            ${r.extra ? r.extra() : nothing}
            ${r.diff && r.diff.length
              ? html`<sw-table bare static-rows data-diff rowKey="key" .columns=${diffCols(show) as unknown as TableColumn[]} .rows=${r.diff as unknown as Record<string, unknown>[]}
                  .rowAttrs=${(d: Record<string, unknown>) => ({ 'data-key': String(d.key), 'data-changed': !!d.changed })}></sw-table>`
              : nothing}
            ${r.typed
              ? html`<label class="typed">
                  <span>${T.confirm.typeToConfirm.split('{phrase}')[0]}<b dir="auto" data-phrase>${this.wordKey ? confirmWord(this.wordKey) : r.typed}</b></span>
                  <input dir="auto" autocomplete="off" spellcheck="false" aria-label=${T.confirm.typedLabel} .value=${this.typed} ?disabled=${this.busy}
                    @input=${(e: Event) => (this.typed = (e.target as HTMLInputElement).value)} data-typed />
                </label>`
              : nothing}
            ${this.busy
              ? html`<div class="wait" role="status" data-waiting>
                  <span>${fill(T.confirm.sending, { s: this.elapsed, max })}</span>
                  <div class="bar" aria-hidden="true"><span style="inline-size:${pct}%"></span></div>
                </div>`
              : nothing}
            ${this.outcome ? this.outcomeLine(this.outcome) : nothing}
            <div class="note">${T.confirm.once}</div>
          </div>`
        : nothing}
      <div slot="footer" class="actions">
        <sw-button variant=${r?.danger ? 'danger' : 'primary'} ?disabled=${this.busy || !this.typedOk || !!(this.outcome && this.outcome.status === 'unknown')}
          @click=${() => void this.send()} data-confirm-send>${T.confirm.send}</sw-button>
        <sw-button variant="ghost" ?disabled=${this.busy} @click=${() => this.close()} data-confirm-cancel>${this.outcome ? T.close : T.cancel}</sw-button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-installer-confirm': WkInstallerConfirm;
  }
}
