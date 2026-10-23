import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ApiError, describeError, get, put } from '../api/client';
import { dateInputLang } from '../api/day-format';
import { intIn } from './durations';
import { vat } from './vendor-arrival-text';

export interface VendorArrivalDoc {
  enabled: boolean;
  default_window_min: number;
  day_from: string;
  day_to: string;
  grace_min: number;
  repeat_min: number;
  max_alerts: number;
  recipients: { managers: boolean; users: string[] };
  offer_access_request: boolean;
}

type NumKey = 'default_window_min' | 'grace_min' | 'repeat_min' | 'max_alerts';
const NUMS: { key: NumKey; label: 'window' | 'grace' | 'repeat' | 'max'; sub: 'windowSub' | 'graceSub' | 'repeatSub' | 'maxSub'; lo: number; hi: number; unit: boolean }[] = [
  { key: 'default_window_min', label: 'window', sub: 'windowSub', lo: 15, hi: 1440, unit: true },
  { key: 'grace_min', label: 'grace', sub: 'graceSub', lo: 0, hi: 720, unit: true },
  { key: 'repeat_min', label: 'repeat', sub: 'repeatSub', lo: 0, hi: 1440, unit: true },
  { key: 'max_alerts', label: 'max', sub: 'maxSub', lo: 1, hi: 5, unit: false },
];
const DEFAULTS: VendorArrivalDoc = { enabled: false, default_window_min: 120, day_from: '08:00', day_to: '17:00', grace_min: 30, repeat_min: 60, max_alerts: 2,
  recipients: { managers: true, users: [] }, offer_access_request: true };

/**
 * VENDORARRIVAL126-295: Settings > the module > general - the vendor's "I have arrived" tap and the missed-arrival alert. The switch is
 * OFF by default; every window, grace, repeat and recipient value is edited here (the `vendor_arrival` block of `PUT /tickets/settings`,
 * system.configure; the server validates again). Light DOM, like the sibling settings rows: the card's `.row` / `.lbl` styles reach it,
 * the controls are the product's own (sw-toggle, sw-button). Toggles save at once; the numbers and the day hours save with one button.
 * The new document goes up as `doc-changed`.
 */
@customElement('ticket-vendor-arrival')
export class TicketVendorArrival extends LitElement {
  @property({ attribute: false }) doc: { revision: number; vendor_arrival?: Partial<VendorArrivalDoc> } | null = null;
  @property({ type: Boolean }) disabled = false;
  @state() private draft: Partial<Record<NumKey | 'day_from' | 'day_to', string>> = {};
  @state() private users: { id: string; name: string }[] = [];
  @state() private busy = false;
  @state() private error = '';

  protected createRenderRoot() {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.style.display = 'contents';
    get<{ users: { id: string; name: string }[] }>('tickets/settings/notify-matrix').then((m) => (this.users = m.users ?? [])).catch(() => undefined);
  }

  private get cur(): VendorArrivalDoc {
    const v = this.doc?.vendor_arrival ?? {};
    return { ...DEFAULTS, ...v, recipients: { ...DEFAULTS.recipients, ...(v.recipients ?? {}) } };
  }

  private get off(): boolean {
    return this.disabled || this.busy;
  }

  private async save(vendor_arrival: Record<string, unknown>, after?: () => void): Promise<void> {
    if (!this.doc || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const doc = await put<{ revision: number }>('tickets/settings', { revision: this.doc.revision, vendor_arrival });
      this.dispatchEvent(new CustomEvent('doc-changed', { detail: doc, bubbles: true, composed: true }));
      after?.();
    } catch (e) {
      this.error = e instanceof ApiError ? e.body.user_message || describeError(e) : describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private toggle(label: 'on' | 'managers' | 'offer', sub: 'onSub' | 'managersSub' | 'offerSub', checked: boolean, attr: string, patch: (v: boolean) => Record<string, unknown>): TemplateResult {
    return html`<div class="row"><span class="lbl">${vat(label)}<span class="muted">${vat(sub)}</span></span>
      <sw-toggle label=${vat(label)} labelHidden .checked=${checked} ?disabled=${this.off} data-va=${attr}
        @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save(patch(e.detail.checked))}></sw-toggle></div>`;
  }

  render(): TemplateResult {
    if (!this.doc) return html`${nothing}`;
    const c = this.cur;
    const nums = NUMS.map((n) => {
      const raw = this.draft[n.key] ?? String(c[n.key]);
      return { ...n, raw, v: intIn(raw, n.lo, n.hi) };
    });
    const from = this.draft.day_from ?? c.day_from;
    const to = this.draft.day_to ?? c.day_to;
    const dayBad = !from || !to || from >= to;
    const bad = nums.some((n) => Number.isNaN(n.v)) || dayBad;
    const dirty = nums.some((n) => n.v !== c[n.key]) || from !== c.day_from || to !== c.day_to;
    const nameOf = (id: string) => this.users.find((u) => u.id === id)?.name ?? id;
    const picked = c.recipients.users;
    const setUsers = (ids: string[]) => void this.save({ recipients: { users: ids } });
    return html`
      ${this.toggle('on', 'onSub', c.enabled, 'enabled', (v) => ({ enabled: v }))}
      ${nums.map((n) => html`<div class="row"><span class="lbl">${vat(n.label)}<span class="muted">${vat(n.sub)}</span></span>
        <span class="unit"><input class="in num" type="number" min=${n.lo} max=${n.hi} data-va-num=${n.key} aria-label=${vat(n.label)} aria-invalid=${String(Number.isNaN(n.v))}
          ?disabled=${this.off} .value=${n.raw} @input=${(e: Event) => (this.draft = { ...this.draft, [n.key]: (e.target as HTMLInputElement).value })} />${n.unit ? html`<span class="muted">${vat('minutes')}</span>` : nothing}</span></div>`)}
      <div class="row"><span class="lbl">${vat('day')}<span class="muted">${vat('daySub')}</span></span>
        <span class="end"><input class="in time" type="time" lang=${dateInputLang()} data-va-day="from" aria-label=${vat('day')} aria-invalid=${String(dayBad)} ?disabled=${this.off} .value=${from}
          @input=${(e: Event) => (this.draft = { ...this.draft, day_from: (e.target as HTMLInputElement).value })} />
          <input class="in time" type="time" lang=${dateInputLang()} data-va-day="to" aria-label=${vat('day')} aria-invalid=${String(dayBad)} ?disabled=${this.off} .value=${to}
          @input=${(e: Event) => (this.draft = { ...this.draft, day_to: (e.target as HTMLInputElement).value })} /></span></div>
      <div class="row"><span class="end"><sw-button size="sm" variant="primary" data-va-save ?disabled=${bad || !dirty || this.off}
        @click=${() => void this.save({ default_window_min: nums[0].v, grace_min: nums[1].v, repeat_min: nums[2].v, max_alerts: nums[3].v, day_from: from, day_to: to }, () => (this.draft = {}))}>${vat('save')}</sw-button>
        ${bad ? html`<span class="field-error">${dayBad ? vat('errDay') : vat('errRange')}</span>` : nothing}</span></div>
      ${this.toggle('managers', 'managersSub', c.recipients.managers, 'managers', (v) => ({ recipients: { managers: v } }))}
      <div class="row"><span class="lbl">${vat('users')}</span>
        <span class="end nm-chips" data-va-users>
          ${picked.map((id) => html`<span class="nm-chip">${nameOf(id)}<button type="button" class="nm-x" aria-label=${vat('remove', { name: nameOf(id) })}
            ?disabled=${this.off} @click=${() => setUsers(picked.filter((x) => x !== id))}>×</button></span>`)}
          <select class="in" aria-label=${vat('addUser')} ?disabled=${this.off} data-va-add-user
            @change=${(e: Event) => { const s = e.target as HTMLSelectElement; if (s.value) setUsers([...picked, s.value]); s.value = ''; }}>
            <option value="">${vat('addUser')}</option>
            ${this.users.filter((u) => !picked.includes(u.id)).map((u) => html`<option value=${u.id}>${u.name}</option>`)}
          </select></span></div>
      ${this.toggle('offer', 'offerSub', c.offer_access_request, 'offer', (v) => ({ offer_access_request: v }))}
      ${this.error ? html`<div class="row"><span class="field-error" role="alert">${this.error}</span></div>` : nothing}`;
  }
}
