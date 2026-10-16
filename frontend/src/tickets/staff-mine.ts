import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-toggle';
import { ApiError, describeError } from '../api/client';
import { ticketsApi, type StaffMine } from '../api/tickets';
import { codeLooksComplete, phoneVerifyApi } from '../api/tickets-phone-verify';
import { tt } from './text';

/**
 * TKSTAFF1, security review F3 / F4 (owner 2026-10-16): החשבון שלי › "נייד לקישורי עבודה" - the signed-in user's OWN mobile for the
 * no-login staff links. A number a manager set stays pending until the user confirms exactly that number here (the GET's token is
 * echoed; only the last four digits are shown); the user's own "WhatsApp on assignment" switch lives here too. Only ever the caller's
 * row (GET / PUT /tickets/me/staff-mobile - no user id is sent). Hidden when the module is off for the caller (403 / 404).
 */
@customElement('tickets-staff-mine')
export class TicketsStaffMine extends LitElement {
  @state() private view: StaffMine | null = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private hiddenAll = false;
  /** TKNOTIFOTP: the code step (only while verification is required for the caller's number) */
  @state() private codeSent = false;
  @state() private code = '';
  @state() private cooldown = 0;
  private timer: number | undefined;

  static styles = css`
    :host { display: block; }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 0; }
    .num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .tag { font-size: var(--sw-fs-xs); padding: 2px 8px; border-radius: 999px; background: var(--sw-surface-2); }
    .warn { color: var(--sw-warning-text); }
    button { font: inherit; padding: 4px 10px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border); background: transparent; color: inherit; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: default; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-xs); }
    .hint { font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
    input { font: inherit; width: 9ch; padding: 4px 8px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border); background: transparent; color: inherit;
      direction: ltr; text-align: center; letter-spacing: 0.15em; font-variant-numeric: tabular-nums; }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.view = await ticketsApi().myStaffMobile();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) this.hiddenAll = true;
      else this.error = describeError(e);
    }
  }

  private async save(body: Parameters<ReturnType<typeof ticketsApi>['setMyStaffMobile']>[0]): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      this.view = await ticketsApi().setMyStaffMobile(body);
    } catch (e) {
      this.error = describeError(e);
      if (e instanceof ApiError && e.status === 409) await this.load();
    } finally {
      this.busy = false;
    }
  }

  private async sendCode(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await phoneVerifyApi.mySend();
      this.codeSent = true;
      this.cooldown = 60;
      window.clearInterval(this.timer);
      this.timer = window.setInterval(() => {
        this.cooldown = Math.max(0, this.cooldown - 1);
        if (!this.cooldown) window.clearInterval(this.timer);
      }, 1000);
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async checkCode(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      this.view = await phoneVerifyApi.myCheck(this.code);
      this.code = '';
      this.codeSent = false;
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
  }

  render() {
    if (this.hiddenAll) return nothing;
    const v = this.view;
    if (!v) return this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing;
    if (!v.has_phone) return html`<div class="row" data-staff-mine="none">${tt('myMobileNone')}</div>`;
    const byCode = !v.confirmed && !!v.verify_required; // TKNOTIFOTP: the number is confirmed only by typing the code sent to it
    return html`<div class="row" data-staff-mine=${v.confirmed ? 'confirmed' : byCode ? 'code' : 'pending'}>
        <span class="num" data-staff-mine-number>${v.phone}</span>
        ${v.confirmed
          ? html`<span class="tag">${tt('myMobileConfirmed')}</span>
              <button type="button" ?disabled=${this.busy} data-staff-mine-withdraw @click=${() => void this.save({ confirmed: false })}>${tt('myMobileWithdraw')}</button>`
          : byCode
            ? html`<span class="tag warn">${tt('otpRequired')}</span>
                <button type="button" ?disabled=${this.busy || this.cooldown > 0} data-staff-mine-send @click=${() => void this.sendCode()}>
                  ${this.codeSent ? tt('otpResend') : tt('otpSend')}${this.cooldown ? ` (${this.cooldown})` : ''}</button>`
            : html`<span class="tag warn">${tt('myMobilePending')}</span>
              <button type="button" ?disabled=${this.busy || !v.confirm} data-staff-mine-confirm @click=${() => v.confirm && void this.save({ confirm: v.confirm })}>${tt('myMobileConfirm')}</button>`}
      </div>
      ${byCode ? html`<div class="hint">${this.codeSent ? tt('otpSent') : tt('otpMineHint')}</div>
        ${this.codeSent ? html`<div class="row"><input inputmode="numeric" autocomplete="one-time-code" maxlength="9" aria-label=${tt('otpCodeLabel')} placeholder="000000"
            .value=${this.code} data-staff-mine-code @input=${(e: Event) => { this.code = (e.target as HTMLInputElement).value; }}>
          <button type="button" ?disabled=${this.busy || !codeLooksComplete(this.code)} data-staff-mine-check @click=${() => void this.checkCode()}>${tt('otpVerify')}</button></div>` : nothing}` : nothing}
      <div class="row"><sw-toggle label=${tt('hdMobileWhatsapp')} .checked=${v.notify_whatsapp} ?disabled=${this.busy} data-staff-mine-whatsapp
        @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ notify_whatsapp: e.detail.checked })}></sw-toggle></div>
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-staff-mine': TicketsStaffMine;
  }
}
