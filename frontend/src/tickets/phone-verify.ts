import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { describeError } from '../api/client';
import { codeLooksComplete, phoneVerifyApi } from '../api/tickets-phone-verify';
import { tt } from './text';

/**
 * TKNOTIFOTP (owner decision 2026-10-16): the verification line of ONE directory row on a configurer's screen (the contact card of
 * "מטפלים וספקים", a staff member's mobile on the members card). Verification is optional and off by default:
 * - confirmed: a tag naming how (code / manager / user);
 * - required, a vendor / contact: "send code", the six digits the vendor reads out, "verify";
 * - required, a row that names a user: only a hint - the user verifies in "החשבון שלי" (the server refuses the admin side anyway);
 * - not required and unconfirmed: "אני בטוח שזה המספר שלו" (the server's token of the number shown is echoed; audited there).
 * Fires `changed` after a successful act so the host reloads its row. Never shows or keeps a code beyond the input.
 */
@customElement('tickets-phone-verify')
export class TicketsPhoneVerify extends LitElement {
  @property({ attribute: false }) contactId: string | null = null;
  @property({ type: Boolean }) hasPhone = false;
  @property({ type: Boolean }) userLinked = false;
  @property({ type: Boolean }) required = false;
  @property({ type: Boolean }) confirmed = false;
  @property({ attribute: false }) via: 'user' | 'manager' | 'code' | null = null;
  @property({ attribute: false }) confirmToken: string | null = null;
  @state() private busy = false;
  @state() private sent = false;
  @state() private code = '';
  @state() private error = '';
  @state() private cooldown = 0;
  private timer: number | undefined;

  static styles = css`
    :host { display: block; }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 4px 0; }
    .tag { font-size: var(--sw-fs-xs); padding: 2px 8px; border-radius: 999px; background: var(--sw-surface-2); }
    .ok { color: var(--sw-success-text, inherit); }
    .warn { color: var(--sw-warning-text); }
    .hint { font-size: var(--sw-fs-xs); color: var(--sw-text-2, inherit); }
    input { font: inherit; width: 9ch; padding: 4px 8px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border); background: transparent; color: inherit;
      direction: ltr; text-align: center; letter-spacing: 0.15em; font-variant-numeric: tabular-nums; }
    button { font: inherit; padding: 4px 10px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border); background: transparent; color: inherit; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: default; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-xs); }
  `;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
  }

  private startCooldown(s: number): void {
    this.cooldown = s;
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      this.cooldown = Math.max(0, this.cooldown - 1);
      if (!this.cooldown) window.clearInterval(this.timer);
    }, 1000);
  }

  private async act(fn: () => Promise<unknown>, after?: () => void): Promise<void> {
    if (this.busy || !this.contactId) return;
    this.busy = true;
    this.error = '';
    try {
      await fn();
      after?.();
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private done(): void {
    this.sent = false;
    this.code = '';
    this.dispatchEvent(new CustomEvent('changed', { bubbles: true, composed: true }));
  }

  private viaText(): string {
    return this.via === 'code' ? tt('otpConfirmedCode') : this.via === 'manager' ? tt('otpConfirmedManager') : tt('otpConfirmedUser');
  }

  render() {
    if (!this.hasPhone || !this.contactId) return nothing;
    const id = this.contactId;
    if (this.confirmed) return html`<div class="row" data-phone-verify="confirmed"><span class="tag ok">${tt('otpConfirmed')} · ${this.viaText()}</span></div>`;
    const err = this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing;
    if (this.required && this.userLinked) {
      return html`<div class="row" data-phone-verify="user-only"><span class="tag warn">${tt('otpRequired')}</span><span class="hint">${tt('otpUserOnly')}</span></div>`;
    }
    if (this.required) {
      return html`<div class="row" data-phone-verify="required">
          <span class="tag warn">${tt('otpRequired')}</span>
          <button type="button" ?disabled=${this.busy || this.cooldown > 0} data-phone-verify-send
            @click=${() => void this.act(() => phoneVerifyApi.contactSend(id), () => { this.sent = true; this.startCooldown(60); })}>
            ${this.sent ? tt('otpResend') : tt('otpSend')}${this.cooldown ? ` (${this.cooldown})` : ''}</button>
        </div>
        ${this.sent ? html`<div class="hint">${tt('otpSent')}</div>
          <div class="row"><input inputmode="numeric" autocomplete="one-time-code" maxlength="9" aria-label=${tt('otpCodeLabel')} placeholder="000000"
              .value=${this.code} data-phone-verify-code @input=${(e: Event) => { this.code = (e.target as HTMLInputElement).value; }}>
            <button type="button" ?disabled=${this.busy || !codeLooksComplete(this.code)} data-phone-verify-check
              @click=${() => void this.act(() => phoneVerifyApi.contactCheck(id, this.code), () => this.done())}>${tt('otpVerify')}</button></div>` : nothing}
        ${err}`;
    }
    const token = this.confirmToken;
    return html`<div class="row" data-phone-verify="unconfirmed"><span class="tag">${tt('otpUnconfirmed')}</span>
        ${token ? html`<button type="button" ?disabled=${this.busy} data-phone-verify-sure
          @click=${() => void this.act(() => phoneVerifyApi.contactConfirm(id, token), () => this.done())}>${tt('otpManagerSure')}</button>` : nothing}</div>${err}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-phone-verify': TicketsPhoneVerify;
  }
}
