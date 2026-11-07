import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-dialog';
import { describeError } from '../api/client';
import { revealNewCode, revokeBridgeKey, type BridgeKeyStatus, type RevealResult } from '../api/bridge-key';
import { bkt, bktLang } from '../i18n/bridge-key';

function when(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const locale = { he: 'he-IL', en: 'en-GB', ar: 'ar', ru: 'ru-RU' }[bktLang()];
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(locale, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * WXH4-EMERGENCY-REVOKE-2407 (CR-034 section 8, owner decisions of 07.11): the emergency revocation of the bridge key, inside the
 * "Bridge key" card (Settings › Connections; system administrator, local sessions - the card itself hides otherwise, and the server
 * enforces both).
 *
 * - The button is never disabled for want of an owner contact (decision 6). The confirm dialog lists what happens; while WisKey is
 *   installed it also warns that door opening through WisKey stops until the re-pair, and the confirm waits for that acknowledgement
 *   (decision 3; the server refuses without it too).
 * - While revoked: who revoked and when (decision 4), whether the new code reaches the bridge by itself (decision 1), and "Show the new
 *   code" for any system administrator after a fresh re-authentication with their own authenticator code (decision 2). The revealed
 *   code lives in this element's memory only while its dialog is open - never in browser storage, never in the address bar.
 */
@customElement('sw-bridge-key-revoke')
export class SwBridgeKeyRevoke extends LitElement {
  @property({ attribute: false }) status: BridgeKeyStatus | null = null;
  @state() private dialog: 'confirm' | 'reveal' | null = null;
  @state() private ack = false;
  @state() private otp = '';
  @state() private shown: RevealResult | null = null;
  @state() private copied = false;
  @state() private busy = false;
  @state() private error = '';
  @state() private done = false;

  static styles = css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px 14px;
      padding: 10px 0;
      border-block-start: 1px solid var(--sw-border);
      flex-wrap: wrap;
    }
    .lbl {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    .note,
    .alert,
    .err,
    .ok,
    li,
    p {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .note {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      padding-block: 4px;
    }
    .alert {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      padding-block: 6px;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      margin: 8px 0 0;
    }
    .ok {
      color: var(--sw-success-text, var(--sw-text-2));
      font-size: var(--sw-fs-sm);
    }
    ul {
      margin: 0;
      padding-inline-start: 18px;
      display: grid;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    .warn {
      margin-block-start: 12px;
      padding: 10px 12px;
      border: 1px solid var(--sw-danger-border, var(--sw-border-strong));
      border-radius: var(--sw-r-sm);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    label.ack {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-block-start: 10px;
      font-size: var(--sw-fs-sm);
    }
    label.ack input {
      margin-block-start: 3px;
      inline-size: 18px;
      block-size: 18px;
      flex: none;
    }
    .field {
      display: grid;
      gap: 6px;
      margin-block-start: 12px;
    }
    .field input {
      min-block-size: 40px;
      inline-size: min(220px, 100%);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-md);
      letter-spacing: 0.15em;
      padding-inline: 10px;
      direction: ltr;
    }
    .code {
      display: grid;
      gap: 4px;
      margin-block-start: 8px;
    }
    .code output {
      direction: ltr;
      unicode-bidi: isolate;
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      font-size: var(--sw-fs-md);
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      overflow-wrap: anywhere;
      user-select: all;
    }
    .foot {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-block-start: 16px;
      flex-wrap: wrap;
    }
    @media (max-width: 767px) and (pointer: coarse) {
      sw-button {
        --sw-ctl-h-sm: 44px;
      }
      .field input {
        min-block-size: 44px;
      }
    }
  `;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.shown = null; // the revealed code never outlives the element
  }

  private close(): void {
    this.dialog = null;
    this.ack = false;
    this.otp = '';
    this.shown = null;
    this.copied = false;
    this.error = '';
  }

  private changed(): void {
    this.dispatchEvent(new CustomEvent('changed', { bubbles: true, composed: true }));
  }

  private async revoke(): Promise<void> {
    const rev = this.status?.revocation;
    this.busy = true;
    this.error = '';
    try {
      await revokeBridgeKey(!!rev?.wiskey_present && this.ack);
      this.close();
      this.done = true;
      this.changed();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async reveal(): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      this.shown = await revealNewCode(this.otp.trim());
      this.otp = '';
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied = true;
    } catch {
      this.copied = false;
    }
  }

  private confirmDialog() {
    const rev = this.status?.revocation;
    const wiskey = !!rev?.wiskey_present;
    return html`<sw-dialog open heading=${bkt('rvDlgTitle')} data-bridge-key-revoke-dialog @close=${() => this.close()}>
      <ul>
        <li>${bkt('rvDlg1')}</li>
        <li>${bkt('rvDlg2')}</li>
        <li>${bkt('rvDlg3')}</li>
        <li>${bkt('rvDlg4')}</li>
      </ul>
      ${wiskey
        ? html`<div class="warn" role="alert" data-bridge-key-revoke-wiskey>${bkt('rvWiskeyWarn')}</div>
            <label class="ack"><input type="checkbox" data-bridge-key-revoke-ack .checked=${this.ack}
              @change=${(e: Event) => (this.ack = (e.target as HTMLInputElement).checked)} />${bkt('rvWiskeyAck')}</label>`
        : nothing}
      ${this.error ? html`<p class="err" role="alert">${this.error}</p>` : nothing}
      <div class="foot">
        <sw-button variant="ghost" @click=${() => this.close()}>${bkt('rvBack')}</sw-button>
        <sw-button variant="danger" ?disabled=${this.busy || (wiskey && !this.ack)} data-bridge-key-revoke-yes @click=${() => void this.revoke()}>${bkt('rvConfirm')}</sw-button>
      </div>
    </sw-dialog>`;
  }

  private revealDialog() {
    const ready = this.status?.revocation?.step_up_ready !== false;
    const shown = this.shown;
    return html`<sw-dialog open heading=${bkt('rvRevealTitle')} data-bridge-key-reveal-dialog @close=${() => this.close()}>
      ${shown
        ? html`<div class="code"><span class="lbl">${bkt('rvCode')}</span><output data-bridge-key-new-code>${shown.pairing_code}</output></div>
            <div class="code"><span class="lbl">${bkt('rvAddress')}</span><output>${shown.addon_url}</output></div>
            <p class="note">${bkt('rvSteps')}</p>
            <div class="foot">
              ${this.copied ? html`<span class="ok" role="status">${bkt('rvCopied')}</span>` : nothing}
              <sw-button @click=${() => void this.copy(shown.pairing_code)}>${bkt('rvCopy')}</sw-button>
              <sw-button variant="primary" @click=${() => this.close()}>${bkt('rvClose')}</sw-button>
            </div>`
        : ready
          ? html`<p class="note">${bkt('rvStepUp')}</p>
              <div class="field">
                <label for="otp" class="lbl">${bkt('rvCodeLabel')}</label>
                <input id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" data-bridge-key-otp .value=${this.otp}
                  @input=${(e: Event) => (this.otp = (e.target as HTMLInputElement).value.replace(/\D/g, ''))}
                  @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' && this.otp.length >= 6 && !this.busy) void this.reveal(); }} />
              </div>
              ${this.error ? html`<p class="err" role="alert">${this.error}</p>` : nothing}
              <div class="foot">
                <sw-button variant="ghost" @click=${() => this.close()}>${bkt('rvBack')}</sw-button>
                <sw-button variant="primary" ?disabled=${this.busy || this.otp.length < 6} data-bridge-key-reveal-yes @click=${() => void this.reveal()}>${bkt('rvShow')}</sw-button>
              </div>`
          : html`<p class="note" role="status" data-bridge-key-step-up-none>${bkt('rvStepUpNone')}</p>
              <div class="foot"><sw-button variant="primary" @click=${() => this.close()}>${bkt('rvClose')}</sw-button></div>`}
    </sw-dialog>`;
  }

  render() {
    const s = this.status;
    const rev = s?.revocation;
    if (!s || !rev) return nothing;
    const revoked = rev.state === 'revoked';
    return html`<div data-bridge-key-revoke=${rev.state}>
      ${revoked
        ? html`<div class="alert" role="alert" data-bridge-key-revoked>${bkt('rvRevoked', { t: when(rev.revoked_at), name: rev.revoked_by_name ?? '' })}</div>
            <div class="note" data-bridge-key-revoke-path=${rev.announce_path ? 'auto' : 'manual'}>${bkt(rev.announce_path ? 'rvAuto' : 'rvManual')}</div>`
        : rev.state === 'repaired' && rev.repaired_at
          ? html`<div class="note" data-bridge-key-repaired>${bkt('rvRepaired', { t: when(rev.repaired_at) })}</div>`
          : nothing}
      <div class="row">
        <span class="lbl">${bkt('rvTitle')}</span>
        <span>
          ${revoked
            ? html`<sw-button size="sm" variant="primary" ?disabled=${this.busy} data-bridge-key-reveal @click=${() => { this.close(); this.dialog = 'reveal'; }}>${bkt('rvReveal')}</sw-button>`
            : nothing}
          <sw-button size="sm" variant="danger" ?disabled=${this.busy} data-bridge-key-revoke-open @click=${() => { this.close(); this.done = false; this.dialog = 'confirm'; }}>${bkt('rvButton')}</sw-button>
        </span>
      </div>
      <div class="note">${bkt('rvNote')}</div>
      ${this.done ? html`<p class="ok" role="status">${bkt('rvDone')}</p>` : nothing}
      ${this.dialog === 'confirm' ? this.confirmDialog() : this.dialog === 'reveal' ? this.revealDialog() : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-bridge-key-revoke': SwBridgeKeyRevoke;
  }
}
