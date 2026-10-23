import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../../components/sw-icon';
import '../../components/sw-state-panel';
import '../../electricity/elec-ui'; // elec-dialog (the electricity confirmation dialog)
import { describeError } from '../../api/client';
import { waterBilling, type Bill, type BillEvent, type BillLine, type BillState, type BillSummary } from '../../api/water-billing';
import { navigate } from '../../router';
import { onWaterAccess, waterAccess, type WaterAccess } from '../../water/access';
import { waterCss } from '../../water/styles';
import { BILL_STATE, fmtIls, fmtM3, isLate, linesByComponent } from '../../water/billing-format';
import { fmtDate, fmtDateTime } from '../../electricity/format';
import { wt, type WtKey } from '../../water/i18n';
import { SkinController } from '../../design/skin';
import { bubbleChrome } from '../../styles/bubble-chrome';
import { billChipW, billsTable } from './page-accounts';

const BASE = '/infra/water/bills';
const STATES: BillState[] = ['draft', 'issued', 'sent', 'paid', 'void'];
const range = (p: { from: string; to: string }) => `${fmtDate(p.from)} - ${fmtDate(p.to)}`;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const csvCell = (s: string) => `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
const skeletonCard = (n = 6) => html`<div class="card" aria-busy="true">${Array.from({ length: n }, () => html`<div class="row" style="padding:10px 0"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div>`;
type Dlg = '' | 'issue' | 'void' | 'correct' | 'sent' | 'paid' | 'delete';
type How = 'email' | 'hand' | 'other';
const HOW_KEY = { email: 'howEmail', hand: 'howHand', other: 'howOther' } as const;
const ACTION_KEY: Record<string, 'aRecalc' | 'aIssue' | 'aSent' | 'aPaid' | 'aCorrect' | 'aVoid' | 'aDelete'> = {
  recalculate: 'aRecalc', issue: 'aIssue', sent: 'aSent', paid: 'aPaid', correct: 'aCorrect', void: 'aVoid', delete: 'aDelete',
};
const EVENT_KEY: Record<string, WtKey> = { created: 'evCreated', draft: 'evCreated', recalculated: 'evRecalculated', recalculate: 'evRecalculated', issued: 'evIssued', issue: 'evIssued', auto_issue: 'evIssued', auto_draft: 'evCreated', sent: 'evSent', paid: 'evPaid', voided: 'evVoided', void: 'evVoided', corrected: 'evCorrected', correct: 'evCorrected', deleted: 'evDeleted' };

/**
 * תשתיות › מים › חיובים (CR-WATER78 section 16): the electricity bills (elec-bills-list.ts / elec-bill-page.ts) with water content - the list
 * (the state filter with counts, search, CSV of the shown rows, tiles טיוטות / ממתינים לתשלום / שולמו / באיחור), one bill with the paper
 * (a water line and a sewage line per piece, subtotal, VAT, total), the details and the log, and the lifecycle actions the server offers
 * (recalculate, issue, sent, paid, correct, void, delete draft). The PDF is not built for water yet: the button says so. water.bills only.
 */
@customElement('water-bills-page')
export class WaterBillsPage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) segments: string[] = [];
  @property({ attribute: false }) params: URLSearchParams = new URLSearchParams();
  @state() private access: WaterAccess = waterAccess();
  @state() private st: 'loading' | 'ready' | 'error' = 'loading';
  @state() private all: BillSummary[] = [];
  @state() private sums = { open: '0.00', paid: '0.00' };
  @state() private filter: BillState | '' = '';
  @state() private q = '';
  @state() private bill: Bill | null = null;
  @state() private billSt: 'loading' | 'ready' | 'error' = 'loading';
  @state() private events: BillEvent[] = [];
  @state() private dlg: Dlg = '';
  @state() private reason = '';
  @state() private how: How = 'email';
  @state() private ref = '';
  @state() private busy = false;
  @state() private error = '';
  private shown = '';
  private stop?: () => void;

  static styles = [waterCss, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onWaterAccess((a) => (this.access = a));
  }
  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  willUpdate(ch: Map<string, unknown>) {
    if (!ch.has('segments')) return;
    const id = this.segments[0] ?? '';
    if (id === this.shown) return;
    this.shown = id;
    this.dlg = '';
    this.error = '';
    if (id) void this.loadBill(id);
    else void this.loadList();
  }

  private async loadList() {
    this.st = 'loading';
    try {
      const r = await waterBilling.listBills();
      this.all = r.items;
      this.sums = r.sums;
      this.st = 'ready';
    } catch {
      this.st = 'error';
    }
  }

  private async loadBill(id: string) {
    this.billSt = 'loading';
    try {
      this.bill = await waterBilling.bill(id);
      this.billSt = 'ready';
      void this.loadEvents(id);
    } catch (e) {
      this.error = describeError(e);
      this.billSt = 'error';
    }
  }

  private async loadEvents(id: string) {
    try {
      this.events = (await waterBilling.billEvents(id)).items;
    } catch {
      this.events = [];
    }
  }

  private open(d: Dlg) {
    this.dlg = d;
    this.error = '';
    this.reason = '';
    this.ref = '';
    this.how = 'email';
  }

  private async act(run: () => Promise<Bill | void>) {
    if (this.busy || !this.bill) return;
    this.busy = true;
    this.error = '';
    try {
      const b = await run();
      this.dlg = '';
      if (b) {
        if (b.id !== this.bill.id) {
          navigate(`${BASE}/${b.id}`);
          return;
        }
        this.bill = b;
        void this.loadEvents(b.id);
      }
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private exportCsv(list: BillSummary[]) {
    const head = [wt('colNumber'), wt('colCustomer'), wt('colAccount'), wt('colPeriod'), wt('colM3'), wt('colTotal'), wt('colDue'), wt('colState')];
    const rows = list.map((b) => [b.number ?? '', b.customer.name ?? '', b.account_name, range(b.period), b.m3 ?? '', b.total ?? '', b.due_date ?? '', BILL_STATE[b.state].label]);
    const blob = new Blob(['﻿' + [head, ...rows].map((l) => l.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `water-bills-${today()}.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  private renderList() {
    if (this.st === 'loading') return html`<div class="page" data-water="bills" data-state="loading">${skeletonCard(7)}</div>`;
    if (this.st === 'error') return html`<div class="page" data-water="bills" data-state="error"><sw-state-panel state="error" heading=${wt('loadBillsError')} actionLabel=${wt('retry')} @action=${() => void this.loadList()}></sw-state-panel></div>`;
    if (!this.all.length) {
      return html`<div class="page" data-water="bills" data-state="empty"><sw-state-panel icon="list" state="empty" heading=${wt('emptyBills')}><button type="button" class="btn pri" @click=${() => navigate('/infra/water/accounts')}>${wt('toAccounts')}</button></sw-state-panel></div>`;
    }
    const cnt = (s: BillState) => this.all.filter((b) => b.state === s).length;
    const q = this.q.trim();
    const list = this.all.filter((b) => (!this.filter || b.state === this.filter) && (!q || (b.number ?? '').includes(q) || (b.customer.name ?? '').includes(q) || b.account_name.includes(q)));
    const t = today();
    const late = this.all.filter((b) => isLate(b, t)).length;
    return html`<div class="page" data-water="bills" data-state=${list.length ? 'ready' : 'filtered-empty'}>
      <div class="row head">
        <div class="seg" role="group" aria-label=${wt('stateFilter')} data-bill-filter>
          <button type="button" data-filter="" aria-pressed=${this.filter === '' ? 'true' : 'false'} @click=${() => (this.filter = '')}>${wt('fAll')} <span class="num">${this.all.length}</span></button>
          ${STATES.map((s) => html`<button type="button" data-filter=${s} aria-pressed=${this.filter === s ? 'true' : 'false'} @click=${() => (this.filter = s)}>${BILL_STATE[s].label} <span class="num">${cnt(s)}</span></button>`)}</div>
        <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-bill-search placeholder=${wt('billSearch')} aria-label=${wt('billSearch')} .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} /></label>
        <span class="sp"></span>
        <button class="btn" type="button" data-csv ?disabled=${!list.length} @click=${() => this.exportCsv(list)}><sw-icon name="download" size="15"></sw-icon>${wt('csv')}</button>
      </div>
      <div class="tiles" data-tiles>
        <div class="tile"><div class="k">${wt('tBillDrafts')}</div><div class="v"><span class="num" data-bt="draft">${cnt('draft')}</span></div></div>
        <div class="tile"><div class="k">${wt('tOpenAmount')}</div><div class="v"><span class="num" data-bt="open">${fmtIls(this.sums.open).replace(' ₪', '')}</span><span class="u">₪</span></div></div>
        <div class="tile"><div class="k">${wt('tPaid')}</div><div class="v"><span class="num" data-bt="paid">${fmtIls(this.sums.paid).replace(' ₪', '')}</span><span class="u">₪</span></div></div>
        <div class="tile"><div class="k">${wt('tLate')}</div><div class="v" style=${late ? 'color:var(--sw-danger-text)' : ''}><span class="num" data-bt="late">${late}</span></div></div>
      </div>
      ${list.length ? billsTable(list, false) : html`<sw-state-panel icon="search" state="empty" compact heading=${wt('noBillsFound')}></sw-state-panel>`}
    </div>`;
  }

  private paper(b: Bill) {
    const s = b.snapshot as Bill['snapshot'] & { doc?: { title_he?: string; subtitle_he?: string }; period?: { from: string; to: string } };
    const parts = linesByComponent(s.lines ?? []);
    const row = (l: BillLine, label: string) => html`<tr data-line=${l.component}><td>${label}${(s.lines ?? []).filter((x) => x.component === l.component).length > 1 ? html` <span class="mut num">${range(l)}</span>` : nothing}</td>
      <td class="n"><span class="num">${fmtM3(l.m3)}</span> ${wt('m3')}</td><td class="n"><span class="num">${fmtIls(l.unit_price_ex_vat)}</span></td><td class="n"><span class="num">${fmtIls(l.amount_ex_vat)}</span></td></tr>`;
    const vats = [...new Set((s.lines ?? []).map((l) => l.vat_rate_percent))];
    return html`<div class="paper" data-bill-paper>
      <div class="row" style="align-items:flex-start"><div><b class="h3">${s.business?.name ?? ''}</b>${s.business?.registration_no ? html`<div class="mut num">${s.business.registration_no}</div>` : nothing}${s.business?.address ? html`<div class="mut">${s.business.address}</div>` : nothing}</div>
        <span class="sp"></span><div style="text-align:end"><b>${s.doc?.title_he ?? wt('billDraft')}</b>${s.doc?.subtitle_he ? html`<div class="mut">${s.doc.subtitle_he}</div>` : nothing}<div class="num">${b.number ?? wt('tBillDrafts')}</div></div></div>
      <dl class="kv">
        <dt>${wt('colCustomer')}</dt><dd>${s.customer?.name ?? ''} · <span class="num">${s.customer?.customer_number ?? ''}</span>${s.customer?.address ? ` · ${s.customer.address}` : ''}</dd>
        <dt>${wt('colAccount')}</dt><dd>${s.account?.name ?? b.account_name}</dd>
        <dt>${wt('pPeriod')}</dt><dd class="num">${range(b.period)}</dd>
        <dt>${wt('pFormula')}</dt><dd>${s.account?.formula?.sentence_he ?? ''}</dd>
        ${b.issue_date ? html`<dt>${wt('pIssued')}</dt><dd class="num">${fmtDate(b.issue_date)}</dd>` : nothing}
        <dt>${wt('pDue')}</dt><dd class="num">${fmtDate(b.due_date ?? s.bill?.expected_due_date ?? null)}</dd>
      </dl>
      <table><thead><tr><th>${wt('pItem')}</th><th class="n">${wt('pQty')}</th><th class="n">${wt('pPrice')}</th><th class="n">${wt('pAmount')}</th></tr></thead>
        <tbody>${parts.water.map((l) => row(l, wt('pWater')))}${parts.sewage.map((l) => row(l, wt('pSewage')))}</tbody>
        <tfoot>
          <tr><td colspan="3">${wt('pSubtotal')}</td><td class="n"><span class="num" data-subtotal>${fmtIls(s.totals?.amount_ex_vat)}</span></td></tr>
          <tr><td colspan="3">${wt('pVat', { p: vats.join(' / ') })}</td><td class="n"><span class="num" data-vat>${fmtIls(s.totals?.vat_amount)}</span></td></tr>
          <tr class="tot"><td colspan="3">${wt('pTotal')}</td><td class="n"><span class="num" data-total>${fmtIls(s.totals?.total)}</span></td></tr>
        </tfoot></table>
      ${(s.notes ?? []).map((x) => html`<div class="mut">${x.text_he}</div>`)}
    </div>`;
  }

  private renderBill() {
    const id = this.segments[0];
    const back = html`<a class="btn ghost sm" href=${`#${BASE}`} data-back><sw-icon name="chevronBack" size="13"></sw-icon>${wt('bills')}</a>`;
    if (this.billSt === 'loading' && this.bill?.id !== id) return html`<div class="page" data-water="bill" data-state="loading">${skeletonCard(5)}</div>`;
    if (this.billSt === 'error' || !this.bill) {
      return html`<div class="page" data-water="bill" data-state="error"><div class="backrow">${back}</div><sw-state-panel state="error" heading=${wt('loadBillError')} hint=${this.error} actionLabel=${wt('retry')} @action=${() => void this.loadBill(id)}></sw-state-panel></div>`;
    }
    const b = this.bill;
    const order: string[] = ['issue', 'sent', 'paid', 'recalculate', 'correct', 'void', 'delete'];
    const acts = [...b.actions].sort((x, y) => order.indexOf(x) - order.indexOf(y));
    const btn = (a: string) => {
      const dng = a === 'void' || a === 'delete';
      const pri = a === 'issue' || a === 'paid';
      const run = () => (a === 'recalculate' ? void this.act(() => waterBilling.recalculate(b)) : this.open(a as Dlg));
      return html`<button type="button" class="btn ${pri ? 'pri' : ''} ${dng ? 'dng' : ''}" data-act=${a} ?disabled=${this.busy} @click=${run}>${wt(ACTION_KEY[a] ?? 'aIssue')}</button>`;
    };
    const side = html`<div class="col">
      <div class="card"><div class="hd"><b>${wt('details')}</b></div><dl class="kv" data-bill-details>
        <dt>${wt('colAccount')}</dt><dd><a class="lnk" href=${`#/infra/water/accounts/${b.account_id}`}>${b.account_name}</a></dd><dt>${wt('colCustomer')}</dt><dd>${b.customer.name ?? '-'}</dd>
        <dt>${wt('pPeriod')}</dt><dd class="num">${range(b.period)}</dd><dt>${wt('colM3')}</dt><dd class="num">${fmtM3(b.m3)}</dd>
        ${b.sent ? html`<dt>${wt('sentOn')}</dt><dd><span class="num">${fmtDate(b.sent.at)}</span> · ${wt(HOW_KEY[b.sent.how as How] ?? 'howOther')}</dd>` : nothing}
        ${b.paid ? html`<dt>${wt('paidOn')}</dt><dd><span class="num">${fmtDate(b.paid.at)}</span>${b.paid.reference ? html` · <span class="num">${b.paid.reference}</span>` : nothing}</dd>` : nothing}
        <dt>${wt('source')}</dt><dd>${b.origin === 'auto' ? wt('originAuto') : wt('originManual')}</dd></dl></div>
      <div class="card"><div class="hd"><b>${wt('log')}</b></div><div class="list" data-bill-log>${this.events.map((e) => html`<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="num mut" style="min-inline-size:112px">${fmtDateTime(e.at)}</span><span>${EVENT_KEY[e.action] ? wt(EVENT_KEY[e.action]) : e.action}${e.actor.display_name ? ` · ${e.actor.display_name}` : ''}</span></div>`)}</div></div>
    </div>`;
    return html`<div class="page" data-water="bill" data-state="ready" data-bill-state=${b.state} data-bill-id=${b.id}>
      <div class="backrow">${back}<b class="h3 num" data-bill-number>${b.number ? wt('billNo', { no: b.number }) : wt('billDraft')}</b>${billChipW(b)}
        ${b.replaces_bill_id && b.snapshot.bill?.replaces ? html`<span class="mut">${wt('replaces', { no: '' })}<a class="lnk num" href=${`#${BASE}/${b.replaces_bill_id}`}>${b.snapshot.bill.replaces.number ?? ''}</a></span>` : nothing}
        ${b.replaced_by_bill_id ? html`<a class="lnk mut" href=${`#${BASE}/${b.replaced_by_bill_id}`}>${wt('replacedBy')}</a>` : nothing}
        <span class="sp"></span>${acts.map(btn)}
        <button type="button" class="btn" disabled title=${wt('pdfLater')} aria-describedby="wpdf" data-pdf><sw-icon name="download" size="15"></sw-icon>${wt('pdf')}</button></div>
      <div class="mut" id="wpdf" data-pdf-reason>${wt('pdfLater')}</div>
      ${b.state === 'void' && b.void ? html`<div class="alert err" role="alert"><span class="x" aria-hidden="true">!</span><div><b>${BILL_STATE.void.label}:</b> ${b.void.reason}</div></div>` : nothing}
      ${this.error && !this.dlg ? html`<div class="alert err" role="alert">${this.error}</div>` : nothing}
      <div class="cols side"><div style="min-inline-size:0">${this.paper(b)}</div>${side}</div>
      ${this.dialogs(b)}
    </div>`;
  }

  private dialogs(b: Bill) {
    const err = this.error && this.dlg ? html`<div class="alert err" role="alert">${this.error}</div>` : nothing;
    const cancel = html`<button slot="actions" type="button" class="btn" @click=${() => (this.dlg = '')}>${wt('cancel')}</button>`;
    const empty = !this.reason.trim();
    return html`
      <elec-dialog heading=${wt('dIssueTitle')} ?open=${this.dlg === 'issue'} data-dialog="issue" @close=${() => (this.dlg = '')}>
        <div>${wt('dIssueBody')}</div><dl class="kv"><dt>${wt('colAccount')}</dt><dd>${b.account_name}</dd><dt>${wt('pPeriod')}</dt><dd class="num">${range(b.period)}</dd><dt>${wt('pTotal')}</dt><dd class="num">${fmtIls(b.total)}</dd></dl>${err}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy} @click=${() => void this.act(() => waterBilling.issue(b))}>${wt('aIssue')}</button>${cancel}
      </elec-dialog>
      <elec-dialog heading=${wt('dVoidTitle')} ?open=${this.dlg === 'void'} data-dialog="void" @close=${() => (this.dlg = '')}>
        <div>${wt('dVoidBody')}</div>
        <div class="fld"><label for="wvr">${wt('dVoidReason')}</label><textarea id="wvr" data-reason aria-required="true" .value=${this.reason} @input=${(e: Event) => (this.reason = (e.target as HTMLTextAreaElement).value)}></textarea></div>${err}
        <button slot="actions" type="button" class="btn dng pri" data-confirm ?disabled=${this.busy || empty} @click=${() => void this.act(() => waterBilling.void(b, this.reason.trim()))}>${wt('aVoid')}</button>${cancel}
      </elec-dialog>
      <elec-dialog heading=${wt('dCorrectTitle')} ?open=${this.dlg === 'correct'} data-dialog="correct" @close=${() => (this.dlg = '')}>
        <div>${wt('dCorrectBody')}</div>${err}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy} @click=${() => void this.act(() => waterBilling.correct(b))}>${wt('dCorrectGo')}</button>${cancel}
      </elec-dialog>
      <elec-dialog heading=${wt('dSentTitle')} ?open=${this.dlg === 'sent'} data-dialog="sent" @close=${() => (this.dlg = '')}>
        <div class="fld"><span class="lbl">${wt('dSentHow')}</span><div class="seg" role="group" aria-label=${wt('dSentHow')}>${(['email', 'hand', 'other'] as How[]).map((h) => html`<button type="button" data-how=${h} aria-pressed=${this.how === h ? 'true' : 'false'} @click=${() => (this.how = h)}>${wt(HOW_KEY[h])}</button>`)}</div></div>${err}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy} @click=${() => void this.act(() => waterBilling.markSent(b, this.how))}>${wt('save')}</button>${cancel}
      </elec-dialog>
      <elec-dialog heading=${wt('dPaidTitle')} ?open=${this.dlg === 'paid'} data-dialog="paid" @close=${() => (this.dlg = '')}>
        <div class="fld"><label for="wpr">${wt('dPaidRef')}</label><input id="wpr" class="ltr" data-reference placeholder=${wt('optional')} .value=${this.ref} @input=${(e: Event) => (this.ref = (e.target as HTMLInputElement).value)} /></div>${err}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy} @click=${() => void this.act(() => waterBilling.markPaid(b, this.ref.trim()))}>${wt('save')}</button>${cancel}
      </elec-dialog>
      <elec-dialog heading=${wt('dDeleteTitle')} ?open=${this.dlg === 'delete'} data-dialog="delete" @close=${() => (this.dlg = '')}>
        <div>${wt('dDeleteBody')}</div>${err}
        <button slot="actions" type="button" class="btn dng pri" data-confirm ?disabled=${this.busy} @click=${() => void this.act(async () => { await waterBilling.deleteDraft(b); navigate(BASE); })}>${wt('aDelete')}</button>${cancel}
      </elec-dialog>`;
  }

  render() {
    if (!this.access.bills) return html`<sw-state-panel state="forbidden" data-water="bills" data-state="forbidden"></sw-state-panel>`;
    return this.segments[0] ? this.renderBill() : this.renderList();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'water-bills-page': WaterBillsPage;
  }
}
