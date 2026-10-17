import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ApiError, describeError } from '../api/client';
import { boardApi, type BoardSettingsDoc } from '../api/tickets-board';
import { ticketsApi } from '../api/tickets';
import { bidi } from '../i18n/bidi';
import { COMPARE_PLACES, HANDLER_NUMBERS, overviewSettingsOf, parseBusyInput, VENDOR_MODES } from './overview-model';
import { ot, type OverviewTextKey } from './overview-text';

/**
 * MGRDASH phase 1: the manager overview's rows of Settings > the module > display (owner decisions 2026-10-17) - who sees a handler's own
 * numbers, where vendors go in the load card, the "busy" threshold (the default and one per department) and where the department
 * comparison sits. Rows of the display card of screens/system-tickets.ts (light DOM: the card's `.row` / `.lbl` / `.seg` styles reach
 * them), saved through PUT /tickets/settings with the card's document revision like ticket-board-settings; the new document goes back
 * up as `doc-changed`. The morning summary's settings arrive with its sender (phase 5) - no switch is drawn before it does anything.
 */
@customElement('ticket-overview-settings')
export class TicketOverviewSettings extends LitElement {
  @property({ attribute: false }) doc: BoardSettingsDoc | null = null;
  @property({ type: Boolean }) disabled = false;
  @state() private busy = false;
  @state() private error = '';
  @state() private departments: { id: string; name: string }[] = [];
  @state() private bad = '';

  protected createRenderRoot() {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.style.display = 'contents';
    void ticketsApi().departments().then((r) => (this.departments = r.departments.filter((d) => d.active).map((d) => ({ id: d.id, name: d.name }))))
      .catch(() => ticketsApi().meta().then((m) => (this.departments = m.departments.map((d) => ({ id: d.id, name: d.name })))).catch(() => undefined));
  }

  private async save(ui: Record<string, unknown>): Promise<void> {
    if (!this.doc || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const doc = await boardApi().saveSettings(this.doc.revision, { ui: ui as never });
      this.dispatchEvent(new CustomEvent('doc-changed', { detail: doc, bubbles: true, composed: true }));
    } catch (e) {
      this.error = e instanceof ApiError ? e.body.user_message || describeError(e) : describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private seg<T extends string>(key: string, label: OverviewTextKey, sub: OverviewTextKey, values: readonly T[], cur: T, prefix: string): TemplateResult {
    return html`<div class="row"><span class="lbl">${ot(label)}<span class="muted">${ot(sub)}</span></span>
      <span class="seg" role="radiogroup" aria-label=${ot(label)}>${values.map((v) => html`<button type="button" role="radio" aria-pressed=${String(cur === v)} aria-checked=${String(cur === v)} data-ui-overview=${`${key}:${v}`}
        ?disabled=${this.disabled || this.busy} @click=${() => void this.save({ [key]: v })}>${ot(`${prefix}${v}` as OverviewTextKey)}</button>`)}</span></div>`;
  }

  private onBusy(e: Event, dept: string | null): void {
    const input = e.target as HTMLInputElement;
    const v = parseBusyInput(input.value);
    const s = overviewSettingsOf(this.doc?.ui);
    if (v === undefined || (dept === null && v === null)) {
      this.bad = dept ?? '*';
      return;
    }
    this.bad = '';
    if (dept === null) {
      if (v !== s.busy) void this.save({ dash_busy: v });
      return;
    }
    const next = { ...s.busyByDept };
    if (v === null) delete next[dept];
    else next[dept] = v;
    if (JSON.stringify(next) !== JSON.stringify(s.busyByDept)) void this.save({ dash_busy_departments: next });
  }

  private busyRows(): TemplateResult {
    const s = overviewSettingsOf(this.doc?.ui);
    const field = (dept: string | null, value: string, label: string) => html`<input type="text" inputmode="numeric" maxlength="2" size="3" class="num-in" .value=${value}
      placeholder=${dept === null ? '' : String(s.busy)} aria-label=${label} aria-invalid=${String(this.bad === (dept ?? '*'))} data-busy-input=${dept ?? '*'}
      ?disabled=${this.disabled || this.busy} @change=${(e: Event) => this.onBusy(e, dept)} />`;
    return html`<div class="row"><span class="lbl">${ot('setBusy')}<span class="muted">${ot('setBusySub')}</span></span>${field(null, String(s.busy), ot('setBusy'))}</div>
      ${this.departments.length ? html`<div class="row" data-busy-departments><span class="lbl">${ot('setBusyDept')}<span class="muted">${ot('setBusyDeptSub')}</span></span>
        <span class="busy-depts">${this.departments.map((d) => html`<label class="busy-dept"><span>${bidi(d.name)}</span>${field(d.id, s.busyByDept[d.id] ? String(s.busyByDept[d.id]) : '', `${ot('setBusyDept')} · ${d.name}`)}</label>`)}</span></div>` : nothing}
      ${this.bad ? html`<div class="row"><span class="field-error" role="alert" data-busy-error>${ot('setBusyInvalid')}</span></div>` : nothing}`;
  }

  render() {
    const s = overviewSettingsOf(this.doc?.ui);
    return html`
      ${this.seg('dash_handler_numbers', 'setHandlerNumbers', 'setHandlerNumbersSub', HANDLER_NUMBERS, s.handlerNumbers, 'hn_')}
      ${this.seg('dash_vendors', 'setVendors', 'setVendorsSub', VENDOR_MODES, s.vendors, 'vd_')}
      ${this.busyRows()}
      ${this.seg('dash_compare', 'setCompare', 'setCompareSub', COMPARE_PLACES, s.compare, 'cp_')}
      ${this.error ? html`<div class="row"><span class="field-error" role="alert" data-overview-settings-error>${this.error}</span></div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-overview-settings': TicketOverviewSettings;
  }
}
