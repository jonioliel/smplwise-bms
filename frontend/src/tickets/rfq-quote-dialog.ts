import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import type { LineKind } from '../api/tickets-costs';
import { ticketsRfqApi, type RfqDetail, type RfqVendor } from '../api/tickets-rfq';
import { blankLine, formatMoney, lineProblem, previewTotals, wireLine, type EditLine } from './cost-model';
import { ct, type CostTextKey } from './cost-text';
import { tIcon } from './icons';
import { rt } from './rfq-text';
import { rfqStyles } from './rfq-styles';
import { dayToIso } from './rfq-model';
import { rfqError } from './rfq-new';
import { ticketsLang } from './text';

/**
 * TKRFQ2 `<tickets-rfq-quote-dialog .rfq .vendor .open>`: a quote entered on the vendor's behalf (the manual channel: the manager spoke
 * to the vendor himself; contract section 9 `POST .../vendors/{rv}/quotes`, the DETAIL quote body). The lines are the request's allowed
 * kinds only; every number is sent as a decimal string and the server recomputes the figures (the total shown here is a preview by
 * the same integer rules, tickets/cost-model.ts). The person who enters a quote can never approve it (409 self_approval).
 * Events: `saved` (detail: the new RfqDetail), `close`.
 */
@customElement('tickets-rfq-quote-dialog')
export class TicketsRfqQuoteDialog extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) rfq: RfqDetail | null = null;
  @property({ attribute: false }) vendor: RfqVendor | null = null;
  @property({ attribute: false }) currencies: string[] = ['ILS'];
  @state() private lines: EditLine[] = [blankLine('labor')];
  @state() private currency = 'ILS';
  @state() private includesVat = true;
  @state() private from = '';
  @state() private to = '';
  @state() private note = '';
  @state() private ref = '';
  @state() private tried = false;
  @state() private busy = false;
  @state() private error = '';

  static styles = [bubbleChrome, ...automationsStyles, rfqStyles];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('open') && this.open) {
      this.lines = [blankLine('labor')];
      this.currency = this.currencies[0] ?? 'ILS';
      this.includesVat = true;
      this.from = '';
      this.to = '';
      this.note = '';
      this.ref = '';
      this.tried = false;
      this.error = '';
    }
  }

  private kinds(): LineKind[] {
    return this.rfq?.allowed_line_kinds?.length ? this.rfq.allowed_line_kinds : ['labor', 'parts'];
  }

  private setLine(i: number, patch: Partial<EditLine>): void {
    this.lines = this.lines.map((l, k) => (k === i ? { ...l, ...patch } : l));
  }

  private setKind(i: number, kind: LineKind): void {
    const old = this.lines[i];
    this.lines = this.lines.map((l, k) => (k === i ? { ...blankLine(kind), description: old.description } : l));
  }

  private valid(): boolean {
    return this.lines.length > 0 && this.lines.every((l) => !lineProblem(l));
  }

  private async save(): Promise<void> {
    this.tried = true;
    if (!this.valid() || !this.rfq || !this.vendor) return;
    this.busy = true;
    this.error = '';
    try {
      const d = await ticketsRfqApi().quoteOnBehalf(this.rfq.id, this.vendor.id, {
        lines: this.lines.map(wireLine), currency: this.currency, amounts_include_vat: this.includesVat,
        ...(this.from ? { work_from: dayToIso(this.from) } : {}), ...(this.to ? { work_to: dayToIso(this.to) } : {}),
        ...(this.note.trim() ? { note: this.note.trim() } : {}), ...(this.ref.trim() ? { vendor_ref: this.ref.trim() } : {}),
      });
      this.dispatchEvent(new CustomEvent('saved', { detail: d }));
    } catch (e) {
      this.error = rfqError(e);
    } finally {
      this.busy = false;
    }
  }

  private num(i: number, key: keyof EditLine, label: string, bad: boolean): TemplateResult {
    const l = this.lines[i];
    return html`<label class="fld">${label}<input class="inp num" inputmode="decimal" dir="ltr" .value=${String(l[key])} aria-invalid=${String(bad)}
      data-q-field=${key} @input=${(e: Event) => this.setLine(i, { [key]: (e.target as HTMLInputElement).value } as Partial<EditLine>)} /></label>`;
  }

  private line(l: EditLine, i: number): TemplateResult {
    const prob = this.tried ? lineProblem(l) : '';
    return html`<div class="qline" data-q-line=${i}>
      <label class="fld">${rt('qKind')}<select class="inp" data-q-kind @change=${(e: Event) => this.setKind(i, (e.target as HTMLSelectElement).value as LineKind)}>
        ${this.kinds().map((k) => html`<option value=${k} ?selected=${l.kind === k}>${ct(`k_${k}` as CostTextKey)}</option>`)}</select></label>
      <label class="fld desc">${rt('qDescription')}<input class="inp" maxlength="120" .value=${l.description} aria-invalid=${String(prob === 'description')} data-q-field="description"
        @input=${(e: Event) => this.setLine(i, { description: (e.target as HTMLInputElement).value })} /></label>
      ${l.kind === 'labor' ? html`${this.num(i, 'hours', rt('qHours'), prob === 'hours')}${this.num(i, 'rate', rt('qRate'), prob === 'rate')}`
        : l.kind === 'parts' ? html`${this.num(i, 'quantity', rt('qQuantity'), prob === 'quantity')}${this.num(i, 'unit_price', rt('qUnit'), prob === 'unit_price')}`
        : html`<div class="one">${this.num(i, 'amount', rt('qAmount'), prob === 'amount')}</div>`}
      <button type="button" class="ibtn" aria-label=${rt('qRemoveLine')} ?disabled=${this.lines.length < 2} data-q-remove @click=${() => (this.lines = this.lines.filter((_, k) => k !== i))}>${tIcon('trash')}</button>
    </div>`;
  }

  render() {
    const name = this.vendor ? this.vendor.contact.company || this.vendor.contact.name : '';
    const t = previewTotals(this.lines, this.includesVat ? 'included' : 'excluded', 1800);
    const lang = ticketsLang() === 'en' ? 'en' : 'he';
    return html`<sw-dialog ?open=${this.open} ?locked=${this.busy} wide heading=${rt('onBehalfTitle', { name })} data-rfq-quote-dialog @close=${() => this.dispatchEvent(new CustomEvent('close'))}>
      <div class="stack">
        <div class="qlines" role="group" aria-label=${rt('qLines')}>${this.lines.map((l, i) => this.line(l, i))}</div>
        <div><button type="button" class="btn sm quiet" data-q-add ?disabled=${this.lines.length >= 30} @click=${() => (this.lines = [...this.lines, blankLine(this.kinds()[0] ?? 'labor')])}>${tIcon('plus')}${rt('qAddLine')}</button></div>
        <div class="frm">
          <label class="fld">${rt('qCurrency')}<select class="inp" data-q-currency @change=${(e: Event) => (this.currency = (e.target as HTMLSelectElement).value)}>
            ${this.currencies.map((c) => html`<option value=${c} ?selected=${c === this.currency}>${c}</option>`)}</select></label>
          <label class="chk"><input type="checkbox" data-q-vat .checked=${this.includesVat} @change=${(e: Event) => (this.includesVat = (e.target as HTMLInputElement).checked)} />${rt('qIncludesVat')}</label>
          <label class="fld">${rt('qWindowFrom')}<input class="inp" type="date" .value=${this.from} @change=${(e: Event) => (this.from = (e.target as HTMLInputElement).value)} /></label>
          <label class="fld">${rt('qWindowTo')}<input class="inp" type="date" .value=${this.to} min=${this.from || ''} @change=${(e: Event) => (this.to = (e.target as HTMLInputElement).value)} /></label>
          <label class="fld wide">${rt('qNote')}<input class="inp" maxlength="500" .value=${this.note} @input=${(e: Event) => (this.note = (e.target as HTMLInputElement).value)} /></label>
          <label class="fld">${rt('qVendorRef')}<input class="inp" maxlength="60" .value=${this.ref} @input=${(e: Event) => (this.ref = (e.target as HTMLInputElement).value)} /></label>
        </div>
        <div class="totals" data-q-total>${t ? html`<span>${rt('qTotal')}: <b class="num">${formatMoney(t.total, this.currency, lang)}</b></span>` : nothing}</div>
        ${this.tried && !this.valid() ? html`<div class="err" role="alert">${this.lines.length ? rt('qBadLine') : rt('qNoLines')}</div>` : nothing}
        ${this.error ? html`<div class="err" role="alert" data-q-error>${this.error}</div>` : nothing}
      </div>
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.busy} @click=${() => this.dispatchEvent(new CustomEvent('close'))}>${rt('cancel')}</button>
      <button slot="footer" type="button" class="btn primary" data-q-submit ?disabled=${this.busy} @click=${() => void this.save()}>${tIcon('check')}${rt('qSubmit')}</button>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-rfq-quote-dialog': TicketsRfqQuoteDialog;
  }
}
