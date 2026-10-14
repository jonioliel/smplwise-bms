import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-card';
import '../components/sw-toggle';
import '../components/sw-button';
import '../components/sw-state-panel';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import { COST_MODES, CURRENCIES, ticketCostsApi, type CostMode, type CostsSettings, type CostsSettingsDoc, type DepartmentCosts, type DepartmentCostsAnswer } from '../api/tickets-costs';
import { ticketSettingsCss } from './settings-styles';
import { ct } from './cost-text';
import { bpToPercent, decimalToMinor, minorToInput, percentToBp } from './cost-model';

type Field = 'vat' | 'window' | 'max' | 'flag' | 'retention';

/** The validation of one numeric draft; the ranges are the server's (routers/tickets_admin.CostsPatch). Pure, so the unit spec can run it. */
export function costFieldValue(field: Field, text: string): number | null {
  const t = text.trim();
  switch (field) {
    case 'vat': {
      const bp = percentToBp(t);
      return bp !== null && bp <= 5000 ? bp : null;
    }
    case 'max': {
      const m = decimalToMinor(t);
      return m !== null && m >= 100 && m <= 99_999_999_999 ? m : null;
    }
    case 'flag': {
      const m = decimalToMinor(t);
      return m !== null && m <= 99_999_999_999 ? m : null;
    }
    case 'window':
    case 'retention': {
      if (!/^\d{1,5}$/.test(t)) return null;
      const n = Number(t);
      const [lo, hi] = field === 'window' ? [1, 90] : [730, 3650];
      return n >= lo && n <= hi ? n : null;
    }
  }
}

const RANGE: Record<Field, [string, string]> = { vat: ['0', '50'], window: ['1', '90'], max: ['1', '999999999'], flag: ['0', '999999999'], retention: ['730', '3650'] };

/**
 * CR-038 slice 9b: Settings › the module › "עלויות" (11A.14; system.configure for the installation document, tickets.configure for the
 * department defaults). The `costs` block of `PUT /tickets/settings` (default requirement, currencies, VAT, submission window, invoice
 * required, caps, vendor notice, retention) and the per-department overrides (`PUT /tickets/costs/departments/{id}`; empty = the
 * installation value). Amounts are typed in main units and travel as minor units. Events: `notice` {ok | error}.
 */
@customElement('tickets-costs-settings')
export class TicketsCostsSettings extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private doc: CostsSettingsDoc | null = null;
  @state() private depts: DepartmentCostsAnswer | null = null;
  @state() private failed = '';
  @state() private forbidden = false;
  @state() private busy = false;
  @state() private drafts: Partial<Record<Field, string>> = {};
  @state() private deptWindow: Record<string, string> = {};

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
    }
  `, bubbleChrome];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private notice(detail: { ok?: string; error?: string }): void {
    this.dispatchEvent(new CustomEvent('notice', { detail, bubbles: true, composed: true }));
  }

  private async load(): Promise<void> {
    this.failed = '';
    try {
      this.doc = await ticketCostsApi().settings();
      this.drafts = {};
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) this.forbidden = true;
      else this.failed = describeError(e);
      return;
    }
    try {
      this.depts = await ticketCostsApi().departments();
      this.deptWindow = {};
    } catch {
      this.depts = null; // tickets.configure is a separate permission: the department card is simply absent
    }
  }

  private async save(patch: Partial<CostsSettings>): Promise<void> {
    const d = this.doc;
    if (!d || this.busy) return;
    this.busy = true;
    try {
      this.doc = await ticketCostsApi().saveSettings(d.revision, patch);
      this.drafts = {};
      this.notice({ ok: ct('setSaved') });
    } catch (e) {
      this.notice({ error: describeError(e) });
      if (e instanceof ApiError && e.status === 409) await this.load();
    } finally {
      this.busy = false;
    }
  }

  private async saveDept(dept: DepartmentCosts, body: { cost_claim: CostMode | null; claim_window_days: number | null }): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      this.depts = await ticketCostsApi().saveDepartment(dept.id, body);
      const next = { ...this.deptWindow };
      delete next[dept.id];
      this.deptWindow = next;
      this.notice({ ok: ct('setSaved') });
    } catch (e) {
      this.notice({ error: describeError(e) });
    } finally {
      this.busy = false;
    }
  }

  private shown(field: Field, s: CostsSettings): string {
    const own = this.drafts[field];
    if (own !== undefined) return own;
    switch (field) {
      case 'vat': return bpToPercent(s.vat_rate_bp);
      case 'window': return String(s.claim_window_days);
      case 'max': return minorToInput(s.max_claim_total_minor);
      case 'flag': return minorToInput(s.review_flag_above_minor);
      case 'retention': return String(s.retention_days);
    }
  }

  private current(field: Field, s: CostsSettings): number {
    switch (field) {
      case 'vat': return s.vat_rate_bp;
      case 'window': return s.claim_window_days;
      case 'max': return s.max_claim_total_minor;
      case 'flag': return s.review_flag_above_minor;
      case 'retention': return s.retention_days;
    }
  }

  private numRow(field: Field, label: string, s: CostsSettings, hint = ''): TemplateResult {
    const text = this.shown(field, s);
    const value = costFieldValue(field, text);
    const patchKey = ({ vat: 'vat_rate_bp', window: 'claim_window_days', max: 'max_claim_total_minor', flag: 'review_flag_above_minor', retention: 'retention_days' } as const)[field];
    const [min, max] = RANGE[field];
    return html`<div class="row"><span class="lbl">${label}${hint ? html`<span class="muted">${hint}</span>` : nothing}</span>
      <span class="end"><input class="in num" inputmode="decimal" dir="ltr" data-costs-field=${field} aria-invalid=${String(value === null)} .value=${text}
        @input=${(e: Event) => (this.drafts = { ...this.drafts, [field]: (e.target as HTMLInputElement).value })} />
        <sw-button size="sm" data-costs-save=${field} ?disabled=${this.busy || value === null || value === this.current(field, s)}
          @click=${() => value !== null && void this.save({ [patchKey]: value } as Partial<CostsSettings>)}>${ct('save')}</sw-button></span>
      ${value === null ? html`<span class="err" role="status">${ct('rangeErr', { min, max })}</span>` : nothing}</div>`;
  }

  private modeSeg(current: CostMode | null, onPick: (m: CostMode | null) => void, nullable: boolean, attr: string): TemplateResult {
    const values: readonly (CostMode | null)[] = nullable ? [null, ...COST_MODES] : COST_MODES;
    return html`<span class="seg" role="radiogroup" aria-label=${ct('setMode')}>${values.map((m) => html`<button type="button" role="radio" ?disabled=${this.busy}
      aria-checked=${String(current === m)} aria-pressed=${String(current === m)} data-costs-mode=${`${attr}:${m ?? 'default'}`}
      @click=${() => onPick(m)}>${m ? ct(`m_${m}` as 'm_required') : ct('ctCostClaimDefault')}</button>`)}</span>`;
  }

  private installationCard(s: CostsSettings): TemplateResult {
    const extra = CURRENCIES.filter((c) => !s.currencies.includes(c));
    return html`<sw-card heading=${ct('setCard')} data-card="costs-installation">
      <div class="row"><span class="lbl">${ct('setMode')}<span class="muted">${ct('setModeSub')}</span></span>${this.modeSeg(s.mode, (m) => { if (m) void this.save({ mode: m }); }, false, 'installation')}</div>
      <div class="row"><span class="lbl">${ct('setCurrency')}<span class="muted">${ct('setCurrenciesHint')}</span></span>
        <span class="chipsrow" data-costs-currencies>${s.currencies.map((c, i) => html`<button type="button" class="rc" aria-pressed="true" data-costs-currency=${c}
          ?disabled=${this.busy || s.currencies.length === 1} title=${ct('removeFile')}
          @click=${() => void this.save({ currencies: s.currencies.filter((x) => x !== c) })}>${i === 0 ? html`<b>${c}</b>` : c}</button>`)}</span></div>
      ${extra.length ? html`<div class="row"><span class="lbl">${ct('setMoreCurrencies')}</span>
        <span class="chipsrow">${repeat(extra, (c) => c, (c) => html`<button type="button" class="rc" aria-pressed="false" data-costs-add-currency=${c}
          ?disabled=${this.busy || s.currencies.length >= 5} @click=${() => void this.save({ currencies: [...s.currencies, c] })}>${c}</button>`)}</span></div>` : nothing}
      ${this.numRow('vat', ct('setVat'), s)}
      ${this.numRow('window', ct('setWindow'), s)}
      <div class="row"><span class="lbl">${ct('setRequireInvoice')}</span>
        <sw-toggle label=${ct('setRequireInvoice')} labelHidden .checked=${s.require_invoice} ?disabled=${this.busy} data-costs-toggle="require_invoice"
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ require_invoice: e.detail.checked })}></sw-toggle></div>
      ${this.numRow('max', ct('setMax'), s, ct('setAmountsHint'))}
      ${this.numRow('flag', ct('setFlag'), s)}
      <div class="row"><span class="lbl">${ct('setNotify')}</span>
        <sw-toggle label=${ct('setNotify')} labelHidden .checked=${s.notify_vendor_approved} ?disabled=${this.busy} data-costs-toggle="notify_vendor_approved"
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ notify_vendor_approved: e.detail.checked })}></sw-toggle></div>
      ${this.numRow('retention', ct('setRetention'), s)}
    </sw-card>`;
  }

  private departmentsCard(a: DepartmentCostsAnswer): TemplateResult {
    return html`<sw-card heading=${ct('setDeptCard')} subheading=${ct('setDeptHint')} data-card="costs-departments">
      ${a.departments.filter((d) => d.active).map((d) => {
        const typed = this.deptWindow[d.id];
        const text = typed ?? (d.claim_window_days === null ? '' : String(d.claim_window_days));
        const n = text.trim() === '' ? null : /^\d{1,3}$/.test(text.trim()) && Number(text) >= 1 && Number(text) <= 90 ? Number(text) : undefined;
        return html`<div class="row stack" data-costs-dept=${d.id}><span class="lbl">${bidi(d.name)}</span>
          <div class="line">${this.modeSeg(d.cost_claim, (m) => void this.saveDept(d, { cost_claim: m, claim_window_days: d.claim_window_days }), true, d.id)}
            <span class="end"><span class="muted">${ct('setDeptWindow')}</span>
              <input class="in num" inputmode="numeric" dir="ltr" data-costs-dept-window=${d.id} placeholder=${String(a.installation.claim_window_days)} aria-invalid=${String(n === undefined)} .value=${text}
                @input=${(e: Event) => (this.deptWindow = { ...this.deptWindow, [d.id]: (e.target as HTMLInputElement).value })} />
              <sw-button size="sm" data-costs-dept-save=${d.id} ?disabled=${this.busy || n === undefined || n === d.claim_window_days}
                @click=${() => { if (n !== undefined) void this.saveDept(d, { cost_claim: d.cost_claim, claim_window_days: n }); }}>${ct('save')}</sw-button></span></div></div>`;
      })}
    </sw-card>`;
  }

  render() {
    if (this.forbidden) return html`<sw-state-panel state="forbidden"></sw-state-panel>`;
    if (this.failed) return html`<sw-state-panel state="error" heading=${this.failed}></sw-state-panel>`;
    const d = this.doc;
    if (!d) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    return html`<div class="stack" data-costs-settings>${this.installationCard(d.costs)}${this.depts ? this.departmentsCard(this.depts) : nothing}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-costs-settings': TicketsCostsSettings;
  }
}
