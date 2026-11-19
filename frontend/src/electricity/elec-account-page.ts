/**
 * CR-023 (mockup "עמוד חשבון"): one account - the consumption status (period progress, forecast, amount so far, the meters of the
 * formula, the customer, the price, the next bill; a meter that does not report), the history (a 12 / 24 period chart with the same
 * period last year, a table with the change, the amount and the bill) and the account's bills. Money, the customer's contact fields
 * and the bills tab only with the bills permission.
 */
import { html, nothing } from 'lit';
import '../components/sw-button';
import { customElement, property, state } from 'lit/decorators.js';
import { elec, elecErrorText, type AccountHistory, type AccountStatus, type BillSummary, type HistoryRow } from '../api/electricity-billing';
import { energyAccess, type EnergyAccess } from './access';
import { ElecBase, alertBox, n, skeleton, stateBox, takeFlash, type LoadState } from './elec-ui';
import './elec-bill-create';
import './elec-chart';
import { billsTable } from './elec-bills-table';
import { billCellChip } from './elec-ui';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import { f0, f2, f4, fmtDate, periodLabel, readingText } from './elec-format';
import { go, href, route } from './elec-routes';
import { hasComparison } from './elec-chart-data';
import { tr } from '../i18n/msg/electricity';

type Tab = 'status' | 'history' | 'bills';

@customElement('elec-account-page')
export class ElecAccountPage extends ElecBase {
  @property() accountId = '';
  @property() tab: Tab = 'status';
  @state() private st: LoadState = 'loading';
  @state() private err = '';
  @state() private status: AccountStatus | null = null;
  @state() private hist: AccountHistory | null = null;
  @state() private histMonths: 12 | 24 = 12;
  @state() private histSt: LoadState = 'loading';
  @state() private bills: BillSummary[] = [];
  @state() private billsSt: LoadState = 'loading';
  @state() private createOpen = false;
  @state() private flash = '';
  private loaded = '';

  willUpdate(ch: Map<string, unknown>) {
    if (ch.has('accountId') && this.accountId && this.loaded !== this.accountId) {
      this.loaded = this.accountId;
      void this.load();
    }
    if ((ch.has('tab') || ch.has('accountId')) && this.accountId) {
      if (this.tab === 'history') void this.loadHistory();
      if (this.tab === 'bills') void this.loadBills();
    }
  }

  private async load() {
    this.st = 'loading';
    try {
      this.flash = takeFlash();
      this.status = await elec().accountStatus(this.accountId);
      this.st = 'ready';
    } catch (e) {
      this.err = elecErrorText(e);
      this.st = 'error';
    }
  }
  private async loadHistory() {
    this.histSt = 'loading';
    try {
      this.hist = await elec().accountHistory(this.accountId, this.histMonths);
      // empty: no ended period with data (rows of "no data" only are not a history)
      this.histSt = this.hist.rows.some((r) => r.kwh !== null) || hasComparison(this.hist.comparison) ? 'ready' : 'empty';
    } catch {
      this.histSt = 'error';
    }
  }
  private async loadBills() {
    this.billsSt = 'loading';
    try {
      this.bills = (await elec().listBills({ account_id: this.accountId })).items;
      this.billsSt = this.bills.length ? 'ready' : 'empty';
    } catch {
      this.billsSt = 'error';
    }
  }

  private head(perms: EnergyAccess) {
    const s = this.status;
    const a = s?.account;
    const tabs: [Tab, string][] = [['status', tr('מצב')], ['history', tr('היסטוריה')], ...(perms.bills ? ([['bills', tr('חיובים')]] as [Tab, string][]) : [])];
    return html`<div class="row"><a class="btn ghost sm" href=${href.accounts()} data-back>${tr('→ חשבונות')}</a></div>
      <div class="row">
        <div><b class="h2" data-account-name>${a?.name ?? ''}</b>
          <div class="mut">${a ? html`${perms.bills ? html`<a class="lnk" href=${href.customer(a.customer.id)}>${a.customer.name}</a>` : a.customer.name} · ${periodLabel(a.period_months, a.period_anchor_day, a.period_anchor_month)}` : ''}</div></div>
        <span class="sp"></span>
        ${perms.bills && a ? html`<sw-button variant="primary" data-create-bill @click=${() => (this.createOpen = true)}>${tr('הפקת חיוב')}</sw-button>` : nothing}
        ${perms.manage && a ? html`<a class="btn" data-edit-account href=${href.account(a.id, 'edit')}>${tr('עריכה')}</a>` : nothing}
      </div>
      <div class="seg" style="align-self:flex-start" role="tablist" aria-label=${tr('חלקי החשבון')}>
        ${tabs.map(([id, l]) => html`<button type="button" role="tab" data-tab=${id} aria-pressed=${this.tab === id} @click=${() => go(route.account(this.accountId, id === 'status' ? '' : id))}>${l}</button>`)}
      </div>`;
  }

  render() {
    const perms = energyAccess();
    if (!perms.view) return html`<div class="page" data-elec="account" data-state="forbidden">${stateBox('forbidden', 'lock', tr('אין הרשאה לצפות בחשבון'))}</div>`;
    if (this.tab === 'bills' && !perms.bills) return html`<div class="page" data-elec="account" data-state="forbidden">${stateBox('forbidden', 'lock', tr('אין הרשאה לחיובים'))}</div>`;
    if (this.st === 'loading') return html`<div class="page" data-elec="account" data-state="loading">${skeleton(5)}</div>`;
    if (this.st === 'error' || !this.status)
      return html`<div class="page" data-elec="account" data-state="error"><div class="row"><a class="btn ghost sm" href=${href.accounts()}>${tr('→ חשבונות')}</a></div>${stateBox('error', 'warning', this.err || tr('לא ניתן לטעון את החשבון'), { label: tr('נסה שוב'), run: () => void this.load() })}</div>`;
    return html`<div class="page" data-elec="account" data-state="ready" data-tab-now=${this.tab}>
      ${this.head(perms)}
      ${this.flash ? alertBox('warn', this.flash) : nothing}
      ${this.tab === 'status' ? this.renderStatus(this.status, perms) : this.tab === 'history' ? this.renderHistory(perms) : this.renderBills()}
      <elec-bill-create .account=${this.status.account} ?open=${this.createOpen} @close=${() => (this.createOpen = false)}></elec-bill-create>
    </div>`;
  }

  /** CR-CMP2-TABLES-CONSUMPTION-2450 (owner N10): the meters of the formula as the shared sw-table (bare in its card, a read-only list):
   * the meter (+ a "not reporting" chip in the shared tones), the period's readings, consumption, factor and the billed part (LTR figures
   * at the reading end), the total to bill in the foot row. */
  private meterColumns(s: AccountStatus, hasReadings: boolean): TableColumn<AccountStatus['rows'][number]>[] {
    return [
      { key: 'name', label: tr('מונה'), render: (r) => html`<b>${r.name}</b>${r.stale ? html` <span class="chip" data-tone="warn">${tr('לא מדווח')}</span>` : nothing}`, foot: () => tr('סה״כ לחיוב') },
      ...(hasReadings
        ? ([
            { key: 'start', label: tr('קריאה בתחילת התקופה'), kind: 'num', render: (r) => readingText(r.start) },
            { key: 'end', label: tr('קריאה נוכחית'), kind: 'num', render: (r) => readingText(r.end) },
          ] satisfies TableColumn<AccountStatus['rows'][number]>[])
        : []),
      { key: 'kwh', label: tr('צריכה'), kind: 'num', render: (r) => f2(r.kwh) },
      { key: 'factor', label: tr('חלק'), kind: 'num', render: (r) => String(r.factor) },
      { key: 'part', label: tr('לחיוב (קוט״ש)'), kind: 'num', render: (r) => html`<b>${f2(r.part)}</b>`, foot: () => f2(s.kwh) },
    ];
  }

  /** CR-CMP2-TABLES-CONSUMPTION-2450: the periods as the shared sw-table (bare in its card, read-only); row hooks `data-history-row` +
   * `data-status`; the bill number is a link, its state a chip in the shared tones. */
  private historyColumns(money: boolean, kwhCell: (r: HistoryRow) => unknown, change: (r: HistoryRow) => string): TableColumn<HistoryRow>[] {
    const cols: TableColumn<HistoryRow>[] = [
      { key: 'label', label: tr('תקופה'), render: (r) => n(r.label) },
      { key: 'kwh', label: tr('קוט״ש'), kind: 'num', render: (r) => html`${kwhCell(r)}` },
      { key: 'change', label: tr('שינוי'), kind: 'num', render: (r) => change(r) },
    ];
    if (money)
      cols.push(
        { key: 'amount', label: tr('סכום'), kind: 'num', render: (r) => (r.amount !== undefined ? f2(r.amount) + ' ₪' : '') },
        { key: 'bill', label: tr('חיוב'), kind: 'status', render: (r) => (r.bill ? html`<a class="lnk num" href=${href.bill(r.bill.id)}>${r.bill.number}</a> ${billCellChip(r.bill.state)}` : html`<span class="mut">-</span>`) },
      );
    return cols;
  }

  // ---------------------------------------------------------------- status
  private renderStatus(s: AccountStatus, perms: EnergyAccess) {
    const hasReadings = s.rows.some((r) => r.start !== null);
    const c = s.customer;
    const rows = s.rows;
    const main = html`${s.stale ? alertBox('warn', html`<b>${s.stale.meter}</b> ${tr('לא מדווח')}${s.stale.since ? html` ${tr('מאז')} ${n(s.stale.since)}` : ''}. ${tr('הצריכה תיספר כשהמונה יחזור לדווח.')}`) : nothing}
      ${s.notes.map((t) => alertBox('warn', t.text_he))}
      <div class="tiles" data-elec-tiles>
        <div class="tile"><div class="k">${tr('צריכה בתקופה')}</div><div class="v">${n(f2(s.kwh))}<span class="u">${tr('קוט״ש')}</span></div></div>
        <div class="tile"><div class="k">${tr('יום')} ${n(s.period.day)} ${tr('מתוך')} ${n(s.period.days)}</div><div class="prog" style="margin-block-start:14px" role="progressbar" aria-valuenow=${s.period.day} aria-valuemin="0" aria-valuemax=${s.period.days}><i style="inline-size:${Math.round((s.period.day / s.period.days) * 100)}%"></i></div></div>
        <div class="tile"><div class="k">${tr('צפי לסוף התקופה')}</div><div class="v">${n(f0(s.forecast_kwh))}<span class="u">${tr('קוט״ש')}</span></div></div>
        ${s.amount_so_far !== undefined
          ? html`<div class="tile" data-tile="amount"><div class="k">${tr('סכום עד כה')}</div><div class="v">${n(s.amount_so_far)}<span class="u">₪</span></div></div>`
          : html`<div class="tile"><div class="k">${tr('ממוצע ליום')}</div><div class="v">${n(f2(s.avg_per_day))}<span class="u">${tr('קוט״ש')}</span></div></div>`}
      </div>
      <div class="card ${this.phone ? '' : 'flush'}"><div class="hd"><b class="h3">${tr('מונים בנוסחה')}</b><span class="sp"></span><span class="mut">${s.account.formula.sentence_he}</span></div>
        ${this.phone
          ? html`<div class="list">${rows.map((r) => html`<div class="li"><div class="grow"><div class="t1">${r.name}${r.factor ? html` <span class="mut">(${r.factor})</span>` : nothing}</div><div class="t2">${hasReadings && r.start !== null ? html`${n(f2(r.start))} ${tr('←')} ${n(f2(r.end ?? 0))}` : html`${n(f2(r.kwh))} ${tr('קוט״ש')}`}</div></div><b class="num">${f2(r.part)}</b></div>`)}</div>
            <div class="row" style="margin-block-start:10px"><b>${tr('סה״כ לחיוב')}</b><span class="sp"></span><b class="num">${f2(s.kwh)}</b></div>`
          : html`<sw-table bare static-rows class="t" data-elec-meters .columns=${this.meterColumns(s, hasReadings) as unknown as TableColumn[]} .rows=${rows as unknown as Record<string, unknown>[]}></sw-table>`}
      </div>`;
    const side = html`<div class="card"><div class="hd"><b class="h3">${tr('לקוח')}</b><span class="sp"></span>${perms.bills && c ? html`<a class="btn ghost sm" href=${href.customer(c.id)}>${tr('כרטיס לקוח')}</a>` : nothing}</div>
        <dl class="kv"><dt>${tr('שם')}</dt><dd>${s.account.customer.name}</dd><dt>${tr('מספר לקוח')}</dt><dd>${n(s.account.customer.customer_number)}</dd>${perms.bills && c?.phone ? html`<dt>${tr('טלפון')}</dt><dd>${n(c.phone)}</dd>` : nothing}${perms.bills && c?.email ? html`<dt>${tr('דוא״ל')}</dt><dd>${n(c.email)}</dd>` : nothing}</dl></div>
      ${s.price && perms.bills
        ? html`<div class="card" data-card="price"><div class="hd"><b class="h3">${tr('מחיר')}</b></div><dl class="kv"><dt>${tr('תעריף')}</dt><dd>${s.price.tariff}</dd><dt>${tr('לפני מע״מ')}</dt><dd>${n(f4(s.price.ex_vat) + ' ₪')}</dd><dt>${tr('כולל מע״מ')}</dt><dd>${n(f4(s.price.inc_vat) + ' ₪')}</dd><dt>${tr('מע״מ')}</dt><dd>${n(s.price.vat + '%')}</dd></dl></div>`
        : s.account.tariff.kind === 'tou' && perms.bills
          ? html`<div class="card" data-card="price" data-kind="tou"><div class="hd"><b class="h3">${tr('מחיר')}</b></div><dl class="kv"><dt>${tr('תעריף')}</dt><dd>${s.account.tariff.name}</dd><dt>${tr('חישוב')}</dt><dd>${tr('לפי שעות (תעו״ז)')}</dd></dl></div>`
          : nothing}
      <div class="card" data-card="next"><div class="hd"><b class="h3">${tr('חיוב הבא')}</b></div><dl class="kv"><dt>${tr('תקופה')}</dt><dd>${n(fmtDate(s.next.from))} - ${n(fmtDate(s.next.to))}</dd><dt>${tr('מספר צפוי')}</dt><dd>${n(s.next.number)}</dd>${s.account.auto_mode !== 'off' ? html`<dt>${s.account.auto_mode === 'issue' ? tr('הנפקה אוטומטית') : tr('טיוטה אוטומטית')}</dt><dd>${n(fmtDate(s.next.draft_on))}</dd>` : nothing}</dl></div>`;
    return html`<div class="cols side-l"><div class="col">${main}</div><div class="col">${side}</div></div>`;
  }

  // ---------------------------------------------------------------- history
  private renderHistory(perms: EnergyAccess) {
    if (this.histSt === 'loading') return skeleton(5);
    if (this.histSt === 'error') return stateBox('error', 'warning', tr('לא ניתן לטעון את ההיסטוריה'), { label: tr('נסה שוב'), run: () => void this.loadHistory() });
    const h = this.hist as AccountHistory;
    if (this.histSt === 'empty') return stateBox('empty', 'bolt', tr('אין עדיין נתוני עבר לחשבון'));
    const money = perms.bills;
    const rows = [...h.rows].reverse();
    // a period with no data says so (never a zero); a partial one carries a chip
    const kwhCell = (r: HistoryRow) => (r.kwh === null ? html`<span class="mut" data-no-data>${tr('אין נתונים')}</span>` : html`${n(f2(r.kwh))}${r.status === 'partial' ? html` <span class="chip c-warn nodot" data-tone="warn" data-nodot data-partial>${tr('חלקי')}</span>` : nothing}`);
    const change = (r: HistoryRow) => (r.change_pct !== null ? (r.change_pct > 0 ? '+' : '') + r.change_pct.toFixed(1) + '%' : '-');
    return html`<div class="card" data-elec-history><div class="hd"><b class="h3">${tr('צריכה לפי תקופה')}</b><span class="sp"></span>
        <div class="seg" role="group" aria-label=${tr('טווח')}><button type="button" data-months="12" aria-pressed=${this.histMonths === 12} @click=${() => this.setMonths(12)}>${tr('12 תקופות')}</button><button type="button" data-months="24" aria-pressed=${this.histMonths === 24} @click=${() => this.setMonths(24)}>${tr('24 תקופות')}</button></div></div>
      <elec-chart .series=${h.comparison} table="details" .height=${this.phone ? 200 : 220}></elec-chart></div>
      <div class="card ${this.phone ? '' : 'flush'}">${this.phone
        ? html`<div class="list">${rows.map((r) => html`<div class="li" data-history-row data-status=${r.status}><div class="grow"><div class="t1">${n(r.label)}</div><div class="t2">${kwhCell(r)}${r.kwh !== null ? html` ${tr('קוט״ש')}` : ''}${r.change_pct !== null ? html` · ${n(change(r))}` : nothing}</div></div>${money && r.amount !== undefined ? html`<b class="num">${f2(r.amount)} ₪</b>` : nothing}</div>`)}</div>`
        : html`<sw-table bare static-rows class="t" data-elec-history-table .columns=${this.historyColumns(money, kwhCell, change) as unknown as TableColumn[]} .rows=${rows as unknown as Record<string, unknown>[]}
            .rowAttrs=${(r: Record<string, unknown>) => ({ 'data-history-row': true, 'data-status': String(r.status) })}></sw-table>`}</div>`;
  }
  private setMonths(m: 12 | 24) {
    this.histMonths = m;
    void this.loadHistory();
  }

  // ---------------------------------------------------------------- bills
  private renderBills() {
    if (this.billsSt === 'loading') return skeleton(4);
    if (this.billsSt === 'error') return stateBox('error', 'warning', tr('לא ניתן לטעון את החיובים'), { label: tr('נסה שוב'), run: () => void this.loadBills() });
    if (this.billsSt === 'empty') return stateBox('empty', 'bolt', tr('אין חיובים לחשבון הזה'), { label: tr('הפקת חיוב'), primary: true, run: () => (this.createOpen = true) });
    return billsTable(this.bills, { phone: this.phone, compact: true });
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'elec-account-page': ElecAccountPage;
  }
}
