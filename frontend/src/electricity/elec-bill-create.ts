/**
 * CR-023 §9 (mockup "הפקת חיוב"): create a bill draft for an account. Period choice: the last period, the current period up to today,
 * or another range (from / to date fields). An overlap with an issued bill is shown before the click (and a server refusal after it);
 * the other refusals (a negative result, no price, no VAT rate, an invalid range) are shown in the dialog.
 */
import { html, nothing, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { elec, elecErrorCode, elecErrorText, elecToday, type Account, type BillSummary, type PeriodChoice } from '../api/electricity-billing';
import { SkinController } from '../design/skin';
import { elecCss } from './styles';
import './elec-ui';
import { alertBox, n } from './elec-ui';
import { addDays, fmtRange, isIsoDate, periodContaining } from './elec-format';
import { go, href, route } from './elec-routes';
import { ApiError } from '../api/client';

type Choice = 'last' | 'current' | 'range';

@customElement('elec-bill-create')
export class ElecBillCreate extends LitElement {
  @property({ attribute: false }) account: Account | null = null;
  @property({ type: Boolean, reflect: true }) open = false;
  @state() private choice: Choice = 'last';
  @state() private from = '';
  @state() private to = '';
  @state() private busy = false;
  @state() private error = '';
  @state() private errorBill = '';
  @state() private existing: BillSummary[] = [];
  protected skin = new SkinController(this);

  static styles = [elecCss, css`:host { display: contents; }`];

  willUpdate(ch: Map<string, unknown>) {
    if (ch.has('open') && this.open && this.account) {
      this.choice = 'last';
      this.error = '';
      this.errorBill = '';
      const p = this.periods();
      this.from = p.last.from;
      this.to = p.last.to;
      void elec().listBills({ account_id: this.account.id }).then((r) => (this.existing = r.items)).catch(() => (this.existing = []));
    }
  }

  private periods() {
    const a = this.account as Account;
    const today = elecToday();
    const cur = periodContaining(today, a.period_months, a.period_anchor_day, a.period_anchor_month);
    const lastTo = addDays(cur.from, -1);
    const last = { from: periodContaining(lastTo, a.period_months, a.period_anchor_day, a.period_anchor_month).from, to: lastTo };
    return { last, current: { from: cur.from, to: today } };
  }
  private range(): { from: string; to: string } {
    const p = this.periods();
    return this.choice === 'last' ? p.last : this.choice === 'current' ? p.current : { from: this.from, to: this.to };
  }
  private rangeError(): string {
    if (this.choice !== 'range') return '';
    if (!isIsoDate(this.from) || !isIsoDate(this.to)) return 'צריך לבחור תאריך התחלה ותאריך סיום';
    if (this.to < this.from) return 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה';
    return '';
  }
  private overlap(): BillSummary | undefined {
    const r = this.range();
    return this.existing.find((b) => b.state !== 'void' && b.state !== 'draft' && !(r.to < b.period.from || r.from > b.period.to));
  }

  private close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }
  private async create() {
    if (!this.account || this.busy) return;
    this.busy = true;
    this.error = '';
    this.errorBill = '';
    const r = this.range();
    const period: PeriodChoice = this.choice === 'last' ? { kind: 'last' } : { kind: 'range', from: r.from, to: r.to };
    try {
      const b = await elec().createBill(this.account.id, period);
      this.close();
      go(route.bill(b.id));
    } catch (e) {
      this.error = elecErrorText(e);
      if (e instanceof ApiError && (elecErrorCode(e) === 'period_overlap' || elecErrorCode(e) === 'draft_exists')) this.errorBill = String(e.body.details?.bill_id ?? '');
    } finally {
      this.busy = false;
    }
  }

  render() {
    const a = this.account;
    if (!a) return nothing;
    const p = this.periods();
    const ov = this.overlap();
    const re = this.rangeError();
    const opt = (id: Choice, title: string, sub: unknown) => html`<label class="li ${this.choice === id ? 'sel' : ''}"><input type="radio" name="period" data-period=${id} .checked=${this.choice === id} @change=${() => { this.choice = id; this.error = ''; }} /><span class="ind"></span>
      <div class="grow"><div class="t1">${title}</div>${sub ? html`<div class="t2">${sub}</div>` : nothing}</div></label>`;
    return html`<elec-dialog heading="הפקת חיוב" ?open=${this.open} data-bill-create @close=${() => this.close()}>
      <div class="mut">${a.name}</div>
      <div class="list" role="radiogroup" aria-label="תקופה">
        ${opt('last', 'התקופה האחרונה', n(fmtRange(p.last.from, p.last.to)))}
        ${opt('current', 'התקופה הנוכחית עד היום', n(fmtRange(p.current.from, p.current.to)))}
        ${opt('range', 'טווח אחר', nothing)}
      </div>
      ${this.choice === 'range'
        ? html`<div class="form">
            <div class="fld"><label for="bf">מתאריך</label><input id="bf" type="date" name="from" data-range-from .value=${this.from} @change=${(e: Event) => (this.from = (e.target as HTMLInputElement).value)} /></div>
            <div class="fld"><label for="bt">עד תאריך</label><input id="bt" type="date" name="to" data-range-to .value=${this.to} @change=${(e: Event) => (this.to = (e.target as HTMLInputElement).value)} /></div>
          </div>`
        : nothing}
      ${re ? alertBox('err', re) : nothing}
      ${ov ? alertBox('err', html`כבר קיים חיוב ${n(ov.number ?? '')} לתקופה הזו. אפשר <a class="lnk" href=${href.bill(ov.id)}>לתקן אותו</a> במקום ליצור חדש.`) : nothing}
      ${this.error && !ov ? alertBox('err', html`${this.error}${this.errorBill ? html` <a class="lnk" href=${href.bill(this.errorBill)}>לפתיחת החיוב</a>` : nothing}`) : nothing}
      <button slot="actions" type="button" class="btn pri" data-create ?disabled=${this.busy || !!ov || !!re} @click=${() => void this.create()}>יצירת טיוטה</button>
      <button slot="actions" type="button" class="btn" @click=${() => this.close()}>ביטול</button>
    </elec-dialog>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'elec-bill-create': ElecBillCreate;
  }
}
