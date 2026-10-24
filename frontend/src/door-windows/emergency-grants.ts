import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-drawer';
import { ApiError, describeError } from '../api/client';
import { dayTimeText } from '../api/day-format';
import { getEmergencyGrants, grantEmergencyOpen, revokeEmergencyGrant, type GrantsView } from '../api/door-windows';
import { DWT_KEYS, dwt, type DwtKey } from '../i18n/door-windows';
import { defaultExpiryValue, expiryToUtc, grantProblem } from './grants-logic';
import { dwCss } from './styles';

/**
 * EMROLE-295 (owner decisions 2026-10-24): who holds the built-in emergency-open role - a guard, a temporary guard, a reception desk clerk -
 * and the way to give it (with an expiry) or take it away. Offered to a system administrator and to a security manager; the server judges
 * every call (who may grant, the longest expiry, the place) and enforces the expiry at use time. No hints or badges: a list, one form.
 */
@customElement('door-emergency-grants')
export class DoorEmergencyGrants extends LitElement {
  static styles = [dwCss];

  @property({ type: Boolean }) open = false;
  @state() private view: GrantsView | null = null;
  @state() private person = '';
  @state() private place = 'installation:*';
  @state() private expiry = '';
  @state() private noExpiry = false;
  @state() private revoking = '';
  @state() private busy = false;
  @state() private error = '';

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('open') && this.open) void this.load();
  }

  private async load(): Promise<void> {
    this.error = '';
    try {
      this.view = await getEmergencyGrants();
      this.expiry = defaultExpiryValue(new Date(), this.view.default_hours);
      this.noExpiry = this.view.default_hours === 0 && this.view.can_no_expiry;
      const first = this.view.scopes[0];
      this.place = first ? `${first.scope_type}:${first.scope_id}` : '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private fail(err: unknown): void {
    const key = err instanceof ApiError ? `grErr_${err.code}` : '';
    this.error = (DWT_KEYS as string[]).includes(key) ? dwt(key as DwtKey) : describeError(err);
  }

  private async give(): Promise<void> {
    if (!this.view) return;
    const at = this.place.indexOf(':');
    this.busy = true;
    this.error = '';
    try {
      await grantEmergencyOpen(this.person, { scope_type: this.place.slice(0, at), scope_id: this.place.slice(at + 1) }, expiryToUtc(this.expiry), this.noExpiry);
      this.person = '';
      this.dispatchEvent(new CustomEvent('notice', { detail: dwt('grGranted'), bubbles: true, composed: true }));
      await this.load();
    } catch (err) {
      this.fail(err);
    } finally {
      this.busy = false;
    }
  }

  private async take(id: string): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      await revokeEmergencyGrant(id);
      this.revoking = '';
      this.dispatchEvent(new CustomEvent('notice', { detail: dwt('grRevoked'), bubbles: true, composed: true }));
      await this.load();
    } catch (err) {
      this.fail(err);
    } finally {
      this.busy = false;
    }
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing;
    const v = this.view;
    const problem = v ? grantProblem(v, this.person, this.expiry, this.noExpiry, new Date()) : 'person';
    return html`<sw-drawer open modal heading=${dwt('grTitle')} @close=${() => this.close()} data-dw-grants>
      ${v ? html`<div class="form">
        <section>
          <ul class="lines" data-dw-grants-list>
            ${v.holders.length ? v.holders.map((h) => html`<li data-dw-grant=${h.id}>
              <span><b>${h.name}</b> · ${h.scope_name}</span>
              <span>${h.expires_at ? dwt('grUntil', { when: dayTimeText(h.expires_at) }) : dwt('grNoExpiry')}</span>
              ${this.revoking === h.id
                ? html`<sw-button size="sm" variant="danger" data-dw-grant-revoke-confirm ?disabled=${this.busy} @click=${() => void this.take(h.id)}>${dwt('grRevokeConfirm')}</sw-button>`
                : html`<sw-button size="sm" variant="ghost" data-dw-grant-revoke @click=${() => (this.revoking = h.id)}>${dwt('grRevoke')}</sw-button>`}
            </li>`) : html`<li data-dw-grants-none><span>${dwt('grNone')}</span></li>`}
          </ul>
        </section>
        <section>
          <div class="field"><label for="dwg-person">${dwt('grPerson')}</label>
            <select id="dwg-person" data-dw-grant-person @change=${(e: Event) => (this.person = (e.target as HTMLSelectElement).value)}>
              <option value="" ?selected=${this.person === ''}>${dwt('grChoose')}</option>
              ${v.candidates.map((c) => html`<option value=${c.id} ?selected=${c.id === this.person}>${c.name}</option>`)}</select></div>
          ${v.scopes.length > 1 ? html`<div class="field"><label for="dwg-place">${dwt('grPlace')}</label>
            <select id="dwg-place" data-dw-grant-place @change=${(e: Event) => (this.place = (e.target as HTMLSelectElement).value)}>
              ${v.scopes.map((s) => html`<option value=${`${s.scope_type}:${s.scope_id}`} ?selected=${`${s.scope_type}:${s.scope_id}` === this.place}>${s.name}</option>`)}</select></div>` : nothing}
          <div class="field"><label for="dwg-expiry">${dwt('grExpiry')}</label>
            <input id="dwg-expiry" type="datetime-local" data-dw-grant-expiry .value=${this.expiry} ?disabled=${this.noExpiry}
              @input=${(e: Event) => (this.expiry = (e.target as HTMLInputElement).value)}></div>
          ${v.can_no_expiry ? html`<label class="occ"><input type="checkbox" data-dw-grant-noexpiry .checked=${this.noExpiry}
            @change=${(e: Event) => (this.noExpiry = (e.target as HTMLInputElement).checked)}> ${dwt('grNoExpiry')}</label>` : nothing}
        </section>
      </div>` : nothing}
      ${this.error ? html`<div class="err" role="alert" data-dw-grants-error>${this.error}</div>` : nothing}
      <div slot="footer" class="footer">
        <sw-button variant="ghost" @click=${() => this.close()}>${dwt('cancel')}</sw-button>
        <sw-button variant="primary" data-dw-grant-add ?disabled=${this.busy || !v || problem !== null} @click=${() => void this.give()}>${dwt('grAdd')}</sw-button>
      </div>
    </sw-drawer>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'door-emergency-grants': DoorEmergencyGrants;
  }
}
