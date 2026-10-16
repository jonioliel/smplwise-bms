import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import type { LineKind, TicketCostsFull } from '../api/tickets-costs';
import { ticketQuotesApi, type QuotesAnswer } from '../api/tickets-quotes';
import { blankLine, bpToPercent, formatMoney, lineProblem, lineTotal, previewTotals, vatModeFor, type EditLine } from './cost-model';
import { ct, type CostTextKey } from './cost-text';
import { cIcon } from './cost-icons';
import { ticketsLang } from './text';
import { onTicketNames } from './naming';
import { editorKinds, quoteBodyOf, quoteFormProblem, validUntilProblem, workWindowProblem, type OnBehalfTarget, type QuoteForm } from './quote-model';
import { qt, type QuoteTextKey } from './quote-text';
import { ticketDetailStyles, ticketFormStyles } from './styles';
import { costCardStyles, costDialogStyles } from './cost-styles';

const PROBLEM_TEXT: Record<string, QuoteTextKey> = { lines: 'obLinesRequired', kind: 'obLinesRequired', work_format: 'obWorkFormat', work_range: 'obWorkRange', work_order: 'obWorkOrder', valid_format: 'obValidFormat', valid_range: 'obValidRange' };

/**
 * TKUI3B `<ticket-quote-form .ticketId .costs .target>`: the dialog of a quote a manager enters ON THE VENDOR'S BEHALF (contract v1.4
 * `POST /tickets/{id}/quotes`; the costs tab opens it from the empty quote stage and from the "…" menu of the quote card). Open from the
 * moment it is rendered; the tab renders it only while it is wanted.
 *   - the line editor offers the kinds the request allows (labour always); amounts are decimal strings, the preview is DISPLAY ONLY;
 *   - the amounts are with or without VAT (an exempt vendor's quote has none whatever is picked); the work window is optional;
 *   - it says plainly, before saving, that the quote is recorded as entered by the manager and that the same person cannot approve it
 *     (server rule, 409 `self_approval`);
 *   - TKQVALID: an optional "תוקף ההצעה" date (the end of that day is sent by the model; the server allows one day back to a year ahead).
 * Events (bubble, composed): `quote-entered` {answer} after the server accepted it, `quote-form-close` when it is closed without saving.
 */
@customElement('ticket-quote-form')
export class TicketQuoteForm extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property() ticketId = '';
  @property({ attribute: false }) costs: TicketCostsFull | null = null;
  @property({ attribute: false }) target: OnBehalfTarget | null = null;
  @state() private form: QuoteForm | null = null;
  @state() private tried = false;
  @state() private busy = false;
  @state() private err = '';
  private offNames: (() => void) | null = null;

  static styles = [bubbleChrome, ...automationsStyles, ticketDetailStyles, ticketFormStyles, costCardStyles, costDialogStyles];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.offNames = onTicketNames(() => this.requestUpdate());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.offNames?.();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (this.form || !this.target || !this.costs) return;
    if (!changed.has('target') && !changed.has('costs')) return;
    const claim = this.costs.claims.find((c) => c.assignment_id === this.target?.assignmentId);
    this.form = {
      assignment: this.target.assignmentId,
      currency: this.costs.settings?.currencies[0] ?? 'ILS',
      include: false,
      from: '',
      to: '',
      validUntil: '',
      note: '',
      lines: [blankLine('labor', claim?.labor_rate_minor)],
    };
  }

  private money(minor: number | null | undefined, currency: string): string {
    return formatMoney(minor, currency, ticketsLang());
  }

  private set(patch: Partial<QuoteForm>): void {
    if (!this.form) return;
    this.form = { ...this.form, ...patch };
    this.err = '';
  }

  private setLine(i: number, patch: Partial<EditLine>): void {
    if (!this.form) return;
    this.set({ lines: this.form.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  }

  private close = (e?: Event) => {
    e?.stopPropagation(); // the drawer around must not close with it
    this.dispatchEvent(new CustomEvent('quote-form-close', { bubbles: true, composed: true }));
  };

  private async save(): Promise<void> {
    const f = this.form;
    const d = this.costs;
    if (!f || !d || this.busy) return;
    this.tried = true;
    const allowed = d.allowed_line_kinds?.kinds;
    const problem = quoteFormProblem(f, allowed);
    if (problem) {
      if (!problem.startsWith('work_') && !problem.startsWith('valid_')) this.err = qt(PROBLEM_TEXT[problem]); // a work-window problem is shown at its fields
      return;
    }
    this.busy = true;
    this.err = '';
    try {
      const answer: QuotesAnswer = await ticketQuotesApi().onBehalf(this.ticketId, quoteBodyOf(f, { multiCurrency: (d.settings?.currencies.length ?? 1) > 1 }));
      this.dispatchEvent(new CustomEvent('quote-entered', { detail: { answer }, bubbles: true, composed: true }));
    } catch (e) {
      this.err = e instanceof ApiError && e.code === 'self_approval' ? qt('selfApproval') : describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private lineEditor(f: QuoteForm, kinds: LineKind[], rateMinor: number | null | undefined): TemplateResult {
    const field = (i: number, l: EditLine, key: keyof EditLine, label: string, mode: 'decimal' | 'text', wide = false) => {
      const bad = this.tried && lineProblem(l) === key;
      return html`<label class=${`fld${wide ? ' wide' : ''}`}><span>${label}</span><input class="inp" inputmode=${mode} maxlength=${key === 'description' ? 120 : 12} data-line-field=${key}
        dir=${mode === 'decimal' ? 'ltr' : 'auto'} aria-invalid=${String(bad)} .value=${l[key]} @input=${(e: Event) => this.setLine(i, { [key]: (e.target as HTMLInputElement).value } as Partial<EditLine>)} /></label>`;
    };
    return html`<div class="lines" data-lines>
      ${f.lines.map((l, i) => {
        const total = lineTotal(l);
        const bad = this.tried && !!lineProblem(l);
        return html`<div class="line" data-line=${i} data-line-kind=${l.kind} aria-invalid=${String(bad)}>
          <label class="fld"><span>${ct('lineKind')}</span><select class="inp" data-line-kind-select @change=${(e: Event) => { const k = (e.target as HTMLSelectElement).value as LineKind; this.set({ lines: f.lines.map((x, j) => (j === i ? { ...blankLine(k, rateMinor), description: x.description } : x)) }); }}>
            ${kinds.map((k) => html`<option value=${k} ?selected=${k === l.kind}>${ct(`k_${k}` as CostTextKey)}</option>`)}</select></label>
          ${field(i, l, 'description', ct('description'), 'text', true)}
          ${l.kind === 'labor' ? html`${field(i, l, 'hours', ct('hours'), 'decimal')}${field(i, l, 'rate', ct('rate'), 'decimal')}`
            : l.kind === 'parts' ? html`${field(i, l, 'quantity', ct('quantity'), 'decimal')}${field(i, l, 'unit_price', ct('unitPrice'), 'decimal')}`
            : html`${field(i, l, 'amount', ct('amount'), 'decimal')}<span></span>`}
          <button type="button" class="btn sm quiet rmv" aria-label=${ct('removeLine')} data-line-remove ?disabled=${f.lines.length < 2} @click=${() => this.set({ lines: f.lines.filter((_, j) => j !== i) })}>${cIcon('x')}</button>
          <span class="lt" data-line-total>${ct('lineTotal')}: ${total === null ? '—' : this.money(total, f.currency)}</span>
        </div>`;
      })}
      <div><button type="button" class="btn sm" data-line-add ?disabled=${f.lines.length >= 30} @click=${() => this.set({ lines: [...f.lines, blankLine(kinds.includes('parts') ? 'parts' : 'labor', rateMinor)] })}>${cIcon('plus')}${ct('addLine')}</button></div>
    </div>`;
  }

  render() {
    const f = this.form;
    const d = this.costs;
    const target = this.target;
    if (!f || !d || !target) return nothing;
    const claim = d.claims.find((c) => c.assignment_id === f.assignment);
    const exempt = !!claim?.vat_exempt;
    const currencies = d.settings?.currencies ?? ['ILS'];
    const rateBp = d.settings?.vat_rate_bp ?? 1800;
    const mode = vatModeFor(exempt, f.include, false);
    const kinds = editorKinds(d.allowed_line_kinds?.kinds);
    const t = previewTotals(f.lines, mode, rateBp);
    const v = (n: number | undefined) => (t && n !== undefined ? this.money(n, f.currency) : '—');
    const wp = this.tried ? workWindowProblem(f.from, f.to) : '';
    const workBad = wp ? qt(PROBLEM_TEXT[`work_${wp}`]) : '';
    const vp = this.tried ? validUntilProblem(f.validUntil) : '';
    const validBad = vp ? qt(PROBLEM_TEXT[`valid_${vp}`]) : '';
    return html`<sw-dialog open wide heading=${qt('obTitle')} data-dialog="quote-on-behalf" @close=${this.close}>
      <div class="form">
        <div class="banner info" role="note" data-ob-notice>${cIcon('lock')}<div>${bidi(qt('obNotice', { vendor: target.name }))}</div></div>
        ${target.replaces ? html`<span class="muted" data-ob-replaces>${qt('obReplaces')}</span>` : nothing}
        <div class="two">
          ${currencies.length > 1 ? html`<label class="fld"><span>${ct('currency')}</span><select class="inp" data-ob-currency @change=${(e: Event) => this.set({ currency: (e.target as HTMLSelectElement).value })}>
            ${currencies.map((x) => html`<option value=${x} ?selected=${x === f.currency}>${x}</option>`)}</select></label>` : nothing}
          ${exempt ? nothing : html`<div class="fld"><span>${ct('vatToggle')}</span><span class="seg sm" role="radiogroup" aria-label=${ct('vatToggle')}>
            <button type="button" role="radio" aria-checked=${String(!f.include)} data-ob-vat="excluded" @click=${() => this.set({ include: false })}>${ct('amountsExcl')}</button>
            <button type="button" role="radio" aria-checked=${String(f.include)} data-ob-vat="included" @click=${() => this.set({ include: true })}>${ct('amountsIncl')}</button></span></div>`}
        </div>
        ${this.lineEditor(f, kinds, claim?.labor_rate_minor)}
        <dl class="preview" data-preview>
          <dt>${ct('net')}</dt><dd data-preview-net>${v(t?.net)}</dd>
          <dt>${mode === 'none' ? ct('vatNone') : ct('vatAt', { rate: bpToPercent(rateBp) })}</dt><dd data-preview-vat>${v(t?.vat)}</dd>
          <dt class="tot">${ct('total')}</dt><dd class="tot" data-preview-total>${v(t?.total)}</dd>
        </dl>
        <div class="two" data-ob-window>
          <label class="fld"><span>${qt('obWorkFrom')}</span><input class="inp" type="datetime-local" dir="ltr" data-ob-work-from aria-invalid=${String(!!workBad)} .value=${f.from} @input=${(e: Event) => this.set({ from: (e.target as HTMLInputElement).value })} /></label>
          <label class="fld"><span>${qt('obWorkTo')}</span><input class="inp" type="datetime-local" dir="ltr" data-ob-work-to aria-invalid=${String(!!workBad)} .value=${f.to} @input=${(e: Event) => this.set({ to: (e.target as HTMLInputElement).value })} /></label>
        </div>
        ${workBad ? html`<span class="err" data-ob-work-error>${workBad}</span>` : html`<span class="muted" data-ob-work-hint>${qt('obWorkHint')}</span>`}
        <label class="fld"><span>${qt('obValidUntil')}</span><input class="inp" type="date" dir="ltr" data-ob-valid-until aria-invalid=${String(!!validBad)} .value=${f.validUntil} @input=${(e: Event) => this.set({ validUntil: (e.target as HTMLInputElement).value })} /></label>
        ${validBad ? html`<span class="err" data-ob-valid-error>${validBad}</span>` : html`<span class="muted" data-ob-valid-hint>${qt('obValidHint')}</span>`}
        <label class="fld"><span>${qt('quoteNote')}</span><textarea class="inp" maxlength="1000" data-ob-note .value=${f.note} @input=${(e: Event) => this.set({ note: (e.target as HTMLTextAreaElement).value })}></textarea></label>
        ${this.err ? html`<div class="err" role="alert" data-ob-error>${this.err}</div>` : nothing}
      </div>
      <div slot="footer" class="sheetfoot">
        <button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${() => void this.save()}>${cIcon('check')}${qt('obSave')}</button>
        <button type="button" class="btn" data-dialog-cancel @click=${() => this.close()}>${qt('back')}</button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-quote-form': TicketQuoteForm;
  }
}
