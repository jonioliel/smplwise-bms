/**
 * CR-023 §12: the bill as an A4 page, an HTML rendering of the bill snapshot (ELECTRICITY_BILL_SNAPSHOT.md): the same sections as
 * the server's PDF (header and business, customer and period boxes, total, meters table with the formula, charge lines, VAT,
 * notes, the consumption chart of the previous periods and the same period last year, footer with the short hash). One neutral
 * print style: white paper even when the UI is dark, the business accent colour. The PDF itself is produced by the server; this
 * component never computes a number, it prints the snapshot.
 */
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { BillSnapshot } from '../api/electricity-billing';
import './elec-chart';
import { hasComparison } from './elec-chart-data';
import { f2, f4, fmtDate, fmtDateTime } from './elec-format';
import { factorLabel } from './elec-formula';

const n = (s: string | number) => html`<span class="n">${s}</span>`;

@customElement('elec-bill-paper')
export class ElecBillPaper extends LitElement {
  @property({ attribute: false }) snapshot: BillSnapshot | null = null;
  /** "טיוטה" or "בוטל": a diagonal watermark */
  @property() watermark = '';
  /** the stored logo (an <img> source) or '' for none */
  @property() logo = '';
  /** the short snapshot hash printed in the footer */
  @property() hash = '';
  @state() private zoom = 1;
  private ro?: ResizeObserver;

  static styles = css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .wrap {
      display: flex;
      justify-content: center;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-lg);
      padding: 20px;
      overflow: hidden;
    }
    .box {
      flex: none;
    }
    .paper {
      inline-size: 794px;
      min-block-size: 1123px;
      background: #fff;
      color: #1d2433;
      box-shadow: 0 6px 30px rgba(0, 0, 0, 0.18);
      padding: 56px 52px 40px;
      font-family: 'Heebo', Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      position: relative;
      direction: rtl;
      display: flex;
      flex-direction: column;
      --acc: #2767ed;
      color-scheme: light;
    }
    .ph {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      border-block-end: 3px solid var(--acc);
      padding-block-end: 18px;
    }
    h1 {
      margin: 0;
      font-size: 22px;
      color: #1d2433;
    }
    .sub {
      color: #5b6a85;
      font-size: 12px;
    }
    .biz {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .biz .info {
      text-align: end;
    }
    .logo {
      inline-size: 64px;
      block-size: 64px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--acc), color-mix(in srgb, var(--acc) 60%, #fff));
      color: #fff;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 22px;
      flex: none;
      overflow: hidden;
    }
    .logo img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
      background: #fff;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-block-start: 18px;
    }
    .bx {
      border: 1px solid #d5dbe6;
      border-radius: 10px;
      padding: 12px 14px;
    }
    .big {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-block-start: 18px;
      background: color-mix(in srgb, var(--acc) 9%, #fff);
      border-radius: 10px;
      padding: 14px 18px;
    }
    .big b {
      font-size: 26px;
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      margin-block-start: 16px;
    }
    th {
      background: #f1f4f9;
      text-align: start;
      padding: 7px 9px;
      font-size: 12px;
      color: #1d2433;
    }
    td {
      border-block-end: 1px solid #e3e7ef;
      padding: 7px 9px;
    }
    .n {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    td.r,
    th.r {
      text-align: left;
    }
    td.r {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .tot td {
      font-weight: 800;
      font-size: 16px;
      border-block-start: 2px solid #1d2433;
      border-block-end: 0;
    }
    .note {
      margin-block-start: 12px;
      color: #5b6a85;
      font-size: 11.5px;
    }
    .note b {
      color: #1d2433;
    }
    .sec {
      margin-block-start: 18px;
      font-weight: 700;
      color: #1d2433;
    }
    .foot {
      margin-block-start: auto;
      padding-block-start: 8px;
      border-block-start: 1px solid #e3e7ef;
      display: flex;
      justify-content: space-between;
      color: #8a94a8;
      font-size: 10.5px;
    }
    .spacer {
      flex: 1;
      min-block-size: 24px;
    }
    .wm {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      pointer-events: none;
      font-size: 130px;
      font-weight: 800;
      color: rgba(39, 103, 237, 0.08);
      transform: rotate(-24deg);
      overflow: hidden;
    }
    .wm.void {
      color: rgba(217, 56, 56, 0.13);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.ro = new ResizeObserver((e) => {
      const avail = e[0].contentRect.width - (e[0].contentRect.width < 520 ? 16 : 40);
      const z = Math.max(0.3, Math.min(1, avail / 794));
      if (Math.abs(z - this.zoom) > 0.005) this.zoom = z;
    });
    this.ro.observe(this);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.ro?.disconnect();
  }

  render() {
    const s = this.snapshot;
    if (!s) return nothing;
    const b = s.business;
    const total = s.totals.total;
    const due = s.bill.due_date ?? s.bill.expected_due_date;
    const multi = s.lines.length > 1;
    const pieces = new Set(s.lines.map((l) => `${l.from}|${l.to}`)).size;
    const readingNote = s.meters.filter((m) => m.start.kind !== 'reading' || m.end.kind !== 'reading');
    const prev = s.history.previous.filter((p) => p.kwh !== null);
    const prevKwh = prev.length ? prev[prev.length - 1].kwh : null;
    const wm = this.watermark;
    return html`<div class="wrap" data-elec-paper>
      <div class="box" style="zoom:${this.zoom}">
        <div class="paper" style="--acc:${b.accent_color || '#2767ed'}">
          ${wm ? html`<div class="wm ${wm === 'בוטל' ? 'void' : ''}" data-watermark>${wm}</div>` : nothing}
          <div class="ph">
            <div>
              <h1>${s.doc.title_he}</h1>
              <div class="sub">${s.doc.subtitle_he}</div>
              <div style="margin-block-start:12px">
                <b>מספר:</b> ${n(s.bill.number ?? '-')}${s.bill.replaces ? html` <span class="sub">(מחליף את ${n(s.bill.replaces.number)})</span>` : nothing}<br />
                <b>תאריך הפקה:</b> ${n(fmtDate(s.bill.issue_date ?? '') || '-')}
              </div>
            </div>
            <div class="biz">
              <div class="info">
                <b>${b.name}</b><br />
                <span class="sub">${b.registration_no ? html`ח.פ. ${n(b.registration_no)}<br />` : nothing}${b.address}<br />${b.phone ? n(b.phone) : nothing}${b.phone && b.email ? ' · ' : ''}${b.email ? n(b.email) : nothing}</span>
              </div>
              <div class="logo">${this.logo ? html`<img src=${this.logo} alt="" />` : (b.name || 'A').slice(0, 2)}</div>
            </div>
          </div>
          <div class="two">
            <div class="bx"><b>לכבוד</b><br />${s.customer.name}<br />${s.customer.address}<br />מספר לקוח: ${n(s.customer.customer_number)}<br />חשבון: ${s.account.name}</div>
            <div class="bx">
              <b>תקופת החיוב</b><br />מתאריך ${n(fmtDate(s.period.from))} עד תאריך ${n(fmtDate(s.period.to))} (${s.period.days} ימים)<br />תעריף: ${s.account.tariff.name}<br />לתשלום עד: ${n(fmtDate(due ?? ''))}
            </div>
          </div>
          <div class="big"><span>סה״כ לתשלום</span><b class="n">${f2(total)} ₪</b></div>
          <table>
            <thead><tr><th>מונה</th><th class="r">קריאה בתחילת התקופה</th><th class="r">קריאה בסוף התקופה</th><th class="r">צריכה (קוט״ש)</th><th class="r">חלק</th><th class="r">לחיוב (קוט״ש)</th></tr></thead>
            <tbody>
              ${s.meters.map((m) => html`<tr><td>${m.name}</td><td class="r">${f2(m.start.reading_kwh)}</td><td class="r">${f2(m.end.reading_kwh)}</td><td class="r">${f2(m.consumption_kwh)}</td><td class="r">${factorLabel(Number(m.coefficient))}</td><td class="r">${f2(m.contribution_kwh)}</td></tr>`)}
            </tbody>
          </table>
          <div class="note">נוסחת החשבון: ${s.account.formula.sentence_he}</div>
          ${readingNote.map((m) => html`<div class="note">${m.name}: ${m.end.kind !== 'reading' ? html`קריאת סוף התקופה ב-${n(fmtDateTime(m.end.at))}` : ''}${m.start.kind !== 'reading' && m.end.kind !== 'reading' ? '; ' : ''}${m.start.kind !== 'reading' ? html`קריאת תחילת התקופה לפי ${m.start.kind === 'interpolated' ? 'חישוב בין שתי קריאות' : 'סוף החיוב הקודם'}` : ''}.</div>`)}
          <table>
            <thead><tr><th>פירוט</th><th class="r">כמות</th><th class="r">מחיר ליחידה</th><th class="r">סכום (₪)</th></tr></thead>
            <tbody>
              ${s.lines.map((l) => html`<tr data-line=${l.band?.id ?? 'flat'}><td>צריכת חשמל${l.band ? ` - ${l.band.name_he}${l.season ? ` (${l.season.name_he})` : ''}` : ''}${(l.band ? pieces > 1 : multi) ? html` (${n(fmtDate(l.from))} - ${n(fmtDate(l.to))})` : nothing}</td><td class="r">${f2(l.kwh)} קוט״ש</td><td class="r">${f4(l.unit_price_ex_vat)} ₪</td><td class="r">${f2(l.amount_ex_vat)}</td></tr>`)}
              <tr><td>סה״כ לפני מע״מ</td><td></td><td></td><td class="r">${f2(s.totals.amount_ex_vat)}</td></tr>
              <tr><td>מע״מ ${n(s.totals.vat_breakdown[0]?.rate_percent ?? s.lines[0]?.vat_rate_percent ?? '')}%</td><td></td><td></td><td class="r">${f2(s.totals.vat_amount)}</td></tr>
              <tr class="tot"><td>סה״כ לתשלום</td><td></td><td></td><td class="r">${f2(total)} ₪</td></tr>
            </tbody>
          </table>
          <div class="note">
            ${s.totals.price_mode_note_he ? html`${s.totals.price_mode_note_he}; המחיר לפני מע״מ מוצג מעוגל ל-4 ספרות. ` : nothing}הקריאות הן קריאות מונה מצטברות שנמדדו בפועל.${prevKwh ? html` צריכה בתקופה הקודמת: ${n(f2(prevKwh))} קוט״ש.` : nothing}
          </div>
          ${s.notes.map((x) => html`<div class="note" data-note=${x.code}>${x.text_he}</div>`)}
          ${b.footer_note ? html`<div class="note"><b>הערות:</b> ${b.footer_note}</div>` : nothing}
          ${hasComparison(s.history) ? html`<div class="sec">השוואת צריכה</div><elec-chart print .series=${s.history} table="visible" .height=${190}></elec-chart>` : nothing}
          <div class="spacer"></div>
          <div class="foot"><span>הופק ב-SmplWise Arx</span><span>עמוד 1 מתוך 1</span><span class="n">${this.hash}</span></div>
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'elec-bill-paper': ElecBillPaper;
  }
}
