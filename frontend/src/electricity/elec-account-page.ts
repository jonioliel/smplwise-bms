/**
 * CR-023 (mockup "עמוד חשבון"): one account - the consumption status (period progress, forecast, amount so far, the meters of the
 * formula, the customer, the price, the next bill; a meter that does not report), the history (a 12 / 24 period chart with the same
 * period last year, a table with the change, the amount and the bill) and the account's bills. Money, the customer's contact fields
 * and the bills tab only with the bills permission.
 */
import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { elec, elecErrorText, elecPerms, type AccountHistory, type AccountStatus, type BillSummary } from '../api/electricity-billing';
import { ElecBase, alertBox, n, skeleton, stateBox, takeFlash, type LoadState } from './elec-ui';
import './elec-bill-create';
import './elec-chart';
import { billsTable } from './elec-bills-table';
import { billChip } from './elec-ui';
import { f0, f2, f4, fmtDate, periodLabel } from './elec-format';
import { go, href, route } from './elec-routes';
import { hasComparison } from './elec-chart-data';

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
      this.histSt = this.hist.rows.length || hasComparison(this.hist.comparison) ? 'ready' : 'empty';
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

  private head(perms: ReturnType<typeof elecPerms>) {
    const s = this.status;
    const a = s?.account;
    const tabs: [Tab, string][] = [['status', 'מצב'], ['history', 'היסטוריה'], ...(perms.bills ? ([['bills', 'חיובים']] as [Tab, string][]) : [])];
    return html`<div class="row"><a class="btn ghost sm" href=${href.accounts()} data-back>→ חשבונות</a></div>
      <div class="row">
        <div><b class="h2" data-account-name>${a?.name ?? ''}</b>
          <div class="mut">${a ? html`${perms.bills ? html`<a class="lnk" href=${href.customer(a.customer.id)}>${a.customer.name}</a>` : a.customer.name} · ${periodLabel(a.period_months, a.period_anchor_day, a.period_anchor_month)}` : ''}</div></div>
        <span class="sp"></span>
        ${perms.bills && a ? html`<button type="button" class="btn pri" data-create-bill @click=${() => (this.createOpen = true)}>הפקת חיוב</button>` : nothing}
        ${perms.manage && a ? html`<a class="btn" data-edit-account href=${href.account(a.id, 'edit')}>עריכה</a>` : nothing}
      </div>
      <div class="seg" style="align-self:flex-start" role="tablist" aria-label="חלקי החשבון">
        ${tabs.map(([id, l]) => html`<button type="button" role="tab" data-tab=${id} aria-pressed=${this.tab === id} @click=${() => go(route.account(this.accountId, id === 'status' ? '' : id))}>${l}</button>`)}
      </div>`;
  }

  render() {
    const perms = elecPerms();
    if (!perms.view) return html`<div class="page" data-elec="account" data-state="forbidden">${stateBox('forbidden', 'lock', 'אין הרשאה לצפות בחשבון')}</div>`;
    if (this.tab === 'bills' && !perms.bills) return html`<div class="page" data-elec="account" data-state="forbidden">${stateBox('forbidden', 'lock', 'אין הרשאה לחיובים')}</div>`;
    if (this.st === 'loading') return html`<div class="page" data-elec="account" data-state="loading">${skeleton(5)}</div>`;
    if (this.st === 'error' || !this.status)
      return html`<div class="page" data-elec="account" data-state="error"><div class="row"><a class="btn ghost sm" href=${href.accounts()}>→ חשבונות</a></div>${stateBox('error', 'warning', this.err || 'לא ניתן לטעון את החשבון', { label: 'נסה שוב', run: () => void this.load() })}</div>`;
    return html`<div class="page" data-elec="account" data-state="ready" data-tab-now=${this.tab}>
      ${this.head(perms)}
      ${this.flash ? alertBox('warn', this.flash) : nothing}
      ${this.tab === 'status' ? this.renderStatus(this.status, perms) : this.tab === 'history' ? this.renderHistory(perms) : this.renderBills()}
      <elec-bill-create .account=${this.status.account} ?open=${this.createOpen} @close=${() => (this.createOpen = false)}></elec-bill-create>
    </div>`;
  }

  // ---------------------------------------------------------------- status
  private renderStatus(s: AccountStatus, perms: ReturnType<typeof elecPerms>) {
    const hasReadings = s.rows.some((r) => r.start !== null);
    const c = s.customer;
    const rows = s.rows;
    const main = html`${s.stale ? alertBox('warn', html`<b>${s.stale.meter}</b> לא מדווח${s.stale.since ? html` מאז ${n(s.stale.since)}` : ''}. הצריכה תיספר כשהמונה יחזור לדווח.`) : nothing}
      ${s.notes.map((t) => alertBox('warn', t))}
      <div class="tiles" data-elec-tiles>
        <div class="tile"><div class="k">צריכה בתקופה</div><div class="v">${n(f2(s.kwh))}<span class="u">קוט״ש</span></div></div>
        <div class="tile"><div class="k">יום ${n(s.period.day)} מתוך ${n(s.period.days)}</div><div class="prog" style="margin-block-start:14px" role="progressbar" aria-valuenow=${s.period.day} aria-valuemin="0" aria-valuemax=${s.period.days}><i style="inline-size:${Math.round((s.period.day / s.period.days) * 100)}%"></i></div></div>
        <div class="tile"><div class="k">צפי לסוף התקופה</div><div class="v">${n(f0(s.forecast_kwh))}<span class="u">קוט״ש</span></div></div>
        ${s.amount_so_far !== undefined
          ? html`<div class="tile" data-tile="amount"><div class="k">סכום עד כה</div><div class="v">${n(s.amount_so_far)}<span class="u">₪</span></div></div>`
          : html`<div class="tile"><div class="k">ממוצע ליום</div><div class="v">${n(f2(s.avg_per_day))}<span class="u">קוט״ש</span></div></div>`}
      </div>
      <div class="card ${this.phone ? '' : 'flush'}"><div class="hd"><b class="h3">מונים בנוסחה</b><span class="sp"></span><span class="mut">${s.account.formula.sentence_he}</span></div>
        ${this.phone
          ? html`<div class="list">${rows.map((r) => html`<div class="li"><div class="grow"><div class="t1">${r.name}${r.factor ? html` <span class="mut">(${r.factor})</span>` : nothing}</div><div class="t2">${hasReadings && r.start !== null ? html`${n(f2(r.start))} ← ${n(f2(r.end ?? 0))}` : html`${n(f2(r.kwh))} קוט״ש`}</div></div><b class="num">${f2(r.part)}</b></div>`)}</div>
            <div class="row" style="margin-block-start:10px"><b>סה״כ לחיוב</b><span class="sp"></span><b class="num">${f2(s.kwh)}</b></div>`
          : html`<div class="scrollx"><table class="t" data-elec-meters><thead><tr><th>מונה</th>${hasReadings ? html`<th class="num">קריאה בתחילת התקופה</th><th class="num">קריאה נוכחית</th>` : nothing}<th class="num">צריכה</th><th class="num">חלק</th><th class="num">לחיוב (קוט״ש)</th></tr></thead>
            <tbody>${rows.map((r) => html`<tr><td class="b">${r.name} ${r.stale ? html`<span class="chip c-warn">לא מדווח</span>` : nothing}</td>${hasReadings ? html`<td class="num">${r.start !== null ? f2(r.start) : ''}</td><td class="num">${r.end !== null ? f2(r.end) : ''}</td>` : nothing}<td class="num">${f2(r.kwh)}</td><td class="num">${r.factor}</td><td class="num b">${f2(r.part)}</td></tr>`)}</tbody>
            <tfoot><tr><td colspan=${hasReadings ? 5 : 3}>סה״כ לחיוב</td><td class="num">${f2(s.kwh)}</td></tr></tfoot></table></div>`}
      </div>`;
    const side = html`<div class="card"><div class="hd"><b class="h3">לקוח</b><span class="sp"></span>${perms.bills && c ? html`<a class="btn ghost sm" href=${href.customer(c.id)}>כרטיס לקוח</a>` : nothing}</div>
        <dl class="kv"><dt>שם</dt><dd>${s.account.customer.name}</dd><dt>מספר לקוח</dt><dd>${n(s.account.customer.customer_number)}</dd>${perms.bills && c?.phone ? html`<dt>טלפון</dt><dd>${n(c.phone)}</dd>` : nothing}${perms.bills && c?.email ? html`<dt>דוא״ל</dt><dd>${n(c.email)}</dd>` : nothing}</dl></div>
      ${s.price && perms.bills
        ? html`<div class="card" data-card="price"><div class="hd"><b class="h3">מחיר</b></div><dl class="kv"><dt>תעריף</dt><dd>${s.price.tariff}</dd><dt>לפני מע״מ</dt><dd>${n(f4(s.price.ex_vat) + ' ₪')}</dd><dt>כולל מע״מ</dt><dd>${n(f4(s.price.inc_vat) + ' ₪')}</dd><dt>מע״מ</dt><dd>${n(s.price.vat + '%')}</dd></dl></div>`
        : nothing}
      <div class="card" data-card="next"><div class="hd"><b class="h3">חיוב הבא</b></div><dl class="kv"><dt>תקופה</dt><dd>${n(fmtDate(s.next.from))} - ${n(fmtDate(s.next.to))}</dd><dt>מספר צפוי</dt><dd>${n(s.next.number)}</dd>${s.account.auto_mode !== 'off' ? html`<dt>${s.account.auto_mode === 'issue' ? 'הנפקה אוטומטית' : 'טיוטה אוטומטית'}</dt><dd>${n(fmtDate(s.next.draft_on))}</dd>` : nothing}</dl></div>`;
    return html`<div class="cols side-l"><div class="col">${main}</div><div class="col">${side}</div></div>`;
  }

  // ---------------------------------------------------------------- history
  private renderHistory(perms: ReturnType<typeof elecPerms>) {
    if (this.histSt === 'loading') return skeleton(5);
    if (this.histSt === 'error') return stateBox('error', 'warning', 'לא ניתן לטעון את ההיסטוריה', { label: 'נסה שוב', run: () => void this.loadHistory() });
    const h = this.hist as AccountHistory;
    if (this.histSt === 'empty') return stateBox('empty', 'bolt', 'אין עדיין נתוני עבר לחשבון');
    const money = perms.bills;
    const rows = [...h.rows].reverse();
    return html`<div class="card" data-elec-history><div class="hd"><b class="h3">צריכה לפי תקופה</b><span class="sp"></span>
        <div class="seg" role="group" aria-label="טווח"><button type="button" data-months="12" aria-pressed=${this.histMonths === 12} @click=${() => this.setMonths(12)}>12 תקופות</button><button type="button" data-months="24" aria-pressed=${this.histMonths === 24} @click=${() => this.setMonths(24)}>24 תקופות</button></div></div>
      <elec-chart .series=${h.comparison} table="details" .height=${this.phone ? 200 : 220}></elec-chart></div>
      <div class="card ${this.phone ? '' : 'flush'}">${this.phone
        ? html`<div class="list">${rows.map((r) => html`<div class="li"><div class="grow"><div class="t1">${n(r.label)}</div><div class="t2">${n(f2(r.kwh))} קוט״ש${r.change_pct !== null ? html` · ${n((r.change_pct > 0 ? '+' : '') + r.change_pct.toFixed(1) + '%')}` : nothing}</div></div>${money && r.amount !== undefined ? html`<b class="num">${f2(r.amount)} ₪</b>` : nothing}</div>`)}</div>`
        : html`<table class="t" data-elec-history-table><thead><tr><th>תקופה</th><th class="num">קוט״ש</th><th class="num">שינוי</th>${money ? html`<th class="num">סכום</th><th>חיוב</th>` : nothing}</tr></thead>
          <tbody>${rows.map((r) => html`<tr><td class="num" style="text-align:start">${r.label}</td><td class="num">${f2(r.kwh)}</td><td class="num">${r.change_pct !== null ? (r.change_pct > 0 ? '+' : '') + r.change_pct.toFixed(1) + '%' : '-'}</td>${money ? html`<td class="num">${r.amount !== undefined ? f2(r.amount) + ' ₪' : ''}</td><td>${r.bill ? html`<a class="lnk num" href=${href.bill(r.bill.id)}>${r.bill.number}</a> ${billChip(r.bill.state)}` : html`<span class="mut">-</span>`}</td>` : nothing}</tr>`)}</tbody></table>`}</div>`;
  }
  private setMonths(m: 12 | 24) {
    this.histMonths = m;
    void this.loadHistory();
  }

  // ---------------------------------------------------------------- bills
  private renderBills() {
    if (this.billsSt === 'loading') return skeleton(4);
    if (this.billsSt === 'error') return stateBox('error', 'warning', 'לא ניתן לטעון את החיובים', { label: 'נסה שוב', run: () => void this.loadBills() });
    if (this.billsSt === 'empty') return stateBox('empty', 'bolt', 'אין חיובים לחשבון הזה', { label: 'הפקת חיוב', primary: true, run: () => (this.createOpen = true) });
    return billsTable(this.bills, { phone: this.phone, compact: true });
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'elec-account-page': ElecAccountPage;
  }
}
