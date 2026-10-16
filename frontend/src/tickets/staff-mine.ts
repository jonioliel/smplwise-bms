import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-toggle';
import { ApiError, describeError } from '../api/client';
import { ticketsApi, type StaffMine } from '../api/tickets';
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

  static styles = css`
    :host { display: block; }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 0; }
    .num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .tag { font-size: var(--sw-type-xs, 12px); padding: 2px 8px; border-radius: 999px; background: var(--sw-surface-2, rgba(127, 127, 127, 0.15)); }
    .warn { color: var(--sw-warn, #b45309); }
    button { font: inherit; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--sw-border, rgba(127, 127, 127, 0.4)); background: transparent; color: inherit; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: default; }
    .err { color: var(--sw-danger, #b91c1c); font-size: var(--sw-type-xs, 12px); }
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

  render() {
    if (this.hiddenAll) return nothing;
    const v = this.view;
    if (!v) return this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing;
    if (!v.has_phone) return html`<div class="row" data-staff-mine="none">${tt('myMobileNone')}</div>`;
    return html`<div class="row" data-staff-mine=${v.confirmed ? 'confirmed' : 'pending'}>
        <span class="num" data-staff-mine-number>${v.phone}</span>
        ${v.confirmed
          ? html`<span class="tag">${tt('myMobileConfirmed')}</span>
              <button type="button" ?disabled=${this.busy} data-staff-mine-withdraw @click=${() => void this.save({ confirmed: false })}>${tt('myMobileWithdraw')}</button>`
          : html`<span class="tag warn">${tt('myMobilePending')}</span>
              <button type="button" ?disabled=${this.busy || !v.confirm} data-staff-mine-confirm @click=${() => v.confirm && void this.save({ confirm: v.confirm })}>${tt('myMobileConfirm')}</button>`}
      </div>
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
