import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-dialog';
import './sw-button';
import { settingsStyles } from '../styles/settings';
import { outcomeOf, type DiffRow, type WriteOutcome } from '../api/installer';
import { fill, installerText as T } from '../i18n/wiskey-installer';

export interface ConfirmRequest {
  heading: string;
  /** What will happen, in plain words. */
  body: string;
  /** The change, field by field (`label` is shown); empty when the action has no fields. */
  diff?: Array<DiffRow & { label: string; show?: (v: unknown) => string }>;
  /** A dangerous action: the exact phrase to type (the server checks it again). */
  typed?: string;
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
      table {
        inline-size: 100%;
        border-collapse: collapse;
        font-variant-numeric: tabular-nums;
      }
      th,
      td {
        text-align: start;
        padding: 6px 8px;
        border-block-end: 1px solid var(--sw-border);
        vertical-align: top;
        overflow-wrap: anywhere;
      }
      th {
        color: var(--sw-text-3);
        font-weight: var(--sw-fw-medium);
        font-size: var(--sw-fs-sm);
      }
      tr[data-changed] td.after {
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      tr:not([data-changed]) td {
        color: var(--sw-text-3);
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
    return norm(this.typed) === norm(want);
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
              ? html`<table data-diff>
                  <thead><tr><th>${T.confirm.willChange}</th><th>${T.confirm.before}</th><th>${T.confirm.after}</th></tr></thead>
                  <tbody>
                    ${r.diff.map(
                      (d) => html`<tr ?data-changed=${d.changed} data-key=${d.key}><td>${d.label}</td><td>${show(d, d.before)}</td><td class="after">${show(d, d.after)}</td></tr>`,
                    )}
                  </tbody>
                </table>`
              : nothing}
            ${r.typed
              ? html`<label class="typed">
                  <span>${T.confirm.typeToConfirm.split('{phrase}')[0]}<b dir="auto" data-phrase>${r.typed}</b></span>
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
