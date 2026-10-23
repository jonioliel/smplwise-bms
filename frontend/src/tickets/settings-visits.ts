import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ApiError, describeError, put } from '../api/client';
import { intIn } from './durations';
import { vst } from './visits-settings-text';

export interface VisitsSettings {
  enabled: boolean;
  public_arrival: boolean;
  claim_counts: boolean;
  offer_access_request: boolean;
  notify_vendor_on_miss: boolean;
  grace_min: number;
  early_min: number;
}

type NumKey = 'grace_min' | 'early_min';
const NUMS: { key: NumKey; label: 'grace' | 'early'; sub: 'graceSub' | 'earlySub'; lo: number; hi: number }[] = [
  { key: 'grace_min', label: 'grace', sub: 'graceSub', lo: 0, hi: 240 },
  { key: 'early_min', label: 'early', sub: 'earlySub', lo: 0, hi: 720 },
];
type Flag = 'enabled' | 'public_arrival' | 'claim_counts' | 'offer_access_request' | 'notify_vendor_on_miss';
const FLAGS: { key: Flag; label: 'enabled' | 'publicArrival' | 'claimCounts' | 'offer' | 'notifyVendor'; sub: 'enabledSub' | 'publicArrivalSub' | 'claimCountsSub' | 'offerSub' | 'notifyVendorSub' }[] = [
  { key: 'enabled', label: 'enabled', sub: 'enabledSub' },
  { key: 'public_arrival', label: 'publicArrival', sub: 'publicArrivalSub' },
  { key: 'claim_counts', label: 'claimCounts', sub: 'claimCountsSub' },
  { key: 'offer_access_request', label: 'offer', sub: 'offerSub' },
  { key: 'notify_vendor_on_miss', label: 'notifyVendor', sub: 'notifyVendorSub' },
];
// the server's own defaults (settings_doc.py `visits`); the document it returns always carries every key
const DEFAULTS: VisitsSettings = { enabled: true, public_arrival: true, claim_counts: true, offer_access_request: false, notify_vendor_on_miss: false, grace_min: 60, early_min: 60 };

/**
 * VENDORARRIVAL126B-295: Settings > the module > general - the planned vendor visits, the vendor's "I have arrived" tap and the
 * missed-arrival detector (the `visits` block of `PUT /tickets/settings`, system.configure; the server validates again). Every
 * switch and number is edited here. Light DOM, like the sibling settings rows. Toggles save at once; the two numbers save with one
 * button. The new document goes up as `doc-changed`.
 */
@customElement('ticket-visits-settings')
export class TicketVisitsSettings extends LitElement {
  @property({ attribute: false }) doc: { revision: number; visits?: Partial<VisitsSettings> } | null = null;
  @property({ type: Boolean }) disabled = false;
  @state() private draft: Partial<Record<NumKey, string>> = {};
  @state() private busy = false;
  @state() private error = '';

  protected createRenderRoot() {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.style.display = 'contents';
  }

  private get cur(): VisitsSettings {
    return { ...DEFAULTS, ...(this.doc?.visits ?? {}) };
  }

  private get off(): boolean {
    return this.disabled || this.busy;
  }

  private async save(visits: Record<string, unknown>, after?: () => void): Promise<void> {
    if (!this.doc || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const doc = await put<{ revision: number }>('tickets/settings', { revision: this.doc.revision, visits });
      this.dispatchEvent(new CustomEvent('doc-changed', { detail: doc, bubbles: true, composed: true }));
      after?.();
    } catch (e) {
      this.error = e instanceof ApiError ? e.body.user_message || describeError(e) : describeError(e);
    } finally {
      this.busy = false;
    }
  }

  render(): TemplateResult {
    if (!this.doc) return html`${nothing}`;
    const c = this.cur;
    const nums = NUMS.map((n) => {
      const raw = this.draft[n.key] ?? String(c[n.key]);
      return { ...n, raw, v: intIn(raw, n.lo, n.hi) };
    });
    const bad = nums.some((n) => Number.isNaN(n.v));
    const dirty = nums.some((n) => n.v !== c[n.key]);
    return html`
      ${FLAGS.map((f) => html`<div class="row"><span class="lbl">${vst(f.label)}<span class="muted">${vst(f.sub)}</span></span>
        <sw-toggle label=${vst(f.label)} labelHidden .checked=${c[f.key]} ?disabled=${this.off} data-vs=${f.key}
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ [f.key]: e.detail.checked })}></sw-toggle></div>`)}
      ${nums.map((n) => html`<div class="row"><span class="lbl">${vst(n.label)}<span class="muted">${vst(n.sub)}</span></span>
        <span class="unit"><input class="in num" type="number" min=${n.lo} max=${n.hi} data-vs-num=${n.key} aria-label=${vst(n.label)} aria-invalid=${String(Number.isNaN(n.v))}
          ?disabled=${this.off} .value=${n.raw} @input=${(e: Event) => (this.draft = { ...this.draft, [n.key]: (e.target as HTMLInputElement).value })} /><span class="muted">${vst('minutes')}</span></span></div>`)}
      <div class="row"><span class="end"><sw-button size="sm" variant="primary" data-vs-save ?disabled=${bad || !dirty || this.off}
        @click=${() => void this.save({ grace_min: nums[0].v, early_min: nums[1].v }, () => (this.draft = {}))}>${vst('save')}</sw-button>
        ${bad ? html`<span class="field-error">${vst('errRange')}</span>` : nothing}</span></div>
      ${this.error ? html`<div class="row"><span class="field-error" role="alert">${this.error}</span></div>` : nothing}`;
  }
}
