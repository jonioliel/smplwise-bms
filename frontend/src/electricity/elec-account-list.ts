/** CR-023 (mockup "רשימת חשבונות"): the accounts list, a table or cards (a list on a phone), with search, the loading / empty / error states. */
import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { elec, type AccountRow } from '../api/electricity-billing';
import { energyAccess } from './access';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import { ElecBase, billCellChip, billChip, n, skeleton, stateBox, type LoadState } from './elec-ui';
import { f2, ils, periodLabel } from './elec-format';
import { go, href, route } from './elec-routes';
import { tr } from '../i18n/msg/electricity';

const VIEW_KEY = 'sw.elec.accounts.view';

@customElement('elec-accounts-list')
export class ElecAccountsList extends ElecBase {
  @state() private st: LoadState = 'loading';
  @state() private rows: AccountRow[] = [];
  @state() private q = '';
  @state() private view: 'table' | 'cards' = 'table';

  connectedCallback() {
    super.connectedCallback();
    try {
      this.view = localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'table';
    } catch {
      /* storage unavailable */
    }
    void this.load();
  }

  private async load() {
    this.st = 'loading';
    try {
      this.rows = await elec().listAccounts();
      this.st = this.rows.length ? 'ready' : 'empty';
    } catch {
      this.st = 'error';
    }
  }
  private setView(v: 'table' | 'cards') {
    this.view = v;
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage unavailable */
    }
  }

  private status = (r: AccountRow) => (r.stale ? html`<span class="chip c-warn">${tr('מונה לא מדווח')}</span>` : html`<span class="chip c-ok">${tr('תקין')}</span>`);
  private last = (r: AccountRow) => {
    const b = r.account.last_bill;
    return b ? html`${b.number ? n(b.number) : tr('טיוטה')} ${billChip(b.state)}` : html`<span class="mut">-</span>`;
  };

  /** CR-CMP2-TABLES-CONSUMPTION-2450 (owner N10): the accounts table is the shared sw-table - the account's name is the row's link (its
   * tab stop: `no-focus-rows`, a click anywhere on the row opens it too), the formula sentence cut with an ellipsis (steps out below
   * 1024 px), figures as LTR isolates at the reading end, the last bill and the state as chips in the shared tones. */
  private columns(money: boolean): TableColumn<AccountRow>[] {
    const cols: TableColumn<AccountRow>[] = [
      { key: 'name', label: tr('חשבון'), render: (r) => html`<a class="t1" href=${href.account(r.account.id)} @click=${(e: Event) => e.stopPropagation()}>${r.account.name}</a>` },
      { key: 'customer', label: tr('לקוח'), render: (r) => r.account.customer.name },
      { key: 'formula', label: tr('נוסחה'), kind: ['muted', 'truncate'], hideBelow: 'tablet', render: (r) => r.account.formula.sentence_he, cellTitle: (r) => r.account.formula.sentence_he },
      { key: 'period', label: tr('תקופה'), render: (r) => periodLabel(r.account.period_months, r.account.period_anchor_day, r.account.period_anchor_month) },
      { key: 'kwh', label: tr('צריכה בתקופה'), kind: 'num', render: (r) => f2(r.kwh ?? 0) },
    ];
    if (money)
      cols.push(
        { key: 'amount', label: tr('סכום עד כה'), kind: 'num', render: (r) => (r.amount !== undefined ? ils(r.amount) : '') },
        { key: 'last', label: tr('חיוב אחרון'), kind: 'status', render: (r) => this.lastCell(r) },
      );
    cols.push({ key: 'state', label: tr('מצב'), kind: 'status', render: (r) => this.statusCell(r) });
    return cols;
  }
  private statusCell = (r: AccountRow) => (r.stale ? html`<span class="chip" data-tone="warn">${tr('מונה לא מדווח')}</span>` : html`<span class="chip" data-tone="ok">${tr('תקין')}</span>`);
  private lastCell = (r: AccountRow) => {
    const b = r.account.last_bill;
    return b ? html`${b.number ? n(b.number) : tr('טיוטה')} ${billCellChip(b.state)}` : html`<span class="mut">-</span>`;
  };

  render() {
    const perms = energyAccess();
    const money = perms.bills;
    if (!perms.view) return html`<div class="page" data-elec="accounts" data-state="forbidden">${stateBox('forbidden', 'lock', tr('אין הרשאה לצפות בחשבונות'))}</div>`;
    const q = this.q.trim();
    const rows = this.rows.filter((r) => !q || r.account.name.includes(q) || r.account.customer.name.includes(q));
    const head = html`<div class="row">
      <input type="search" data-search aria-label=${tr('חיפוש חשבון או לקוח')} placeholder=${tr('חיפוש חשבון או לקוח')} .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} />
      ${this.phone ? nothing : html`<div class="seg" role="group" aria-label=${tr('תצוגה')}>
        <button type="button" data-view="cards" aria-pressed=${this.view === 'cards'} @click=${() => this.setView('cards')}>${tr('כרטיסים')}</button>
        <button type="button" data-view="table" aria-pressed=${this.view === 'table'} @click=${() => this.setView('table')}>${tr('טבלה')}</button></div>`}
      <span class="sp"></span>
      ${perms.manage ? html`<a class="btn pri ${this.phone ? 'sm' : ''}" data-new-account href=${href.accountNew()}>${tr('+ חשבון חדש')}</a>` : nothing}
    </div>`;
    let body;
    if (this.st === 'loading') body = skeleton(6);
    else if (this.st === 'error') body = stateBox('error', 'warning', tr('לא ניתן לטעון את החשבונות'), { label: tr('נסה שוב'), run: () => void this.load() });
    else if (this.st === 'empty')
      body = stateBox('empty', 'bolt', tr('אין חשבונות עדיין'), perms.manage ? { label: tr('+ חשבון חדש'), primary: true, run: () => go(route.accountNew()) } : undefined);
    else if (!rows.length) body = stateBox('empty', 'search', tr('לא נמצאו חשבונות'));
    else if (this.phone) {
      body = html`<div class="list" data-elec-list>${rows.map((r) => html`<a class="li" href=${href.account(r.account.id)} data-account-row=${r.account.id}>
        <div class="grow"><div class="t1">${r.account.name}</div><div class="t2">${r.account.customer.name} · ${n(f2(r.kwh ?? 0))} ${tr('קוט״ש')}${money && r.amount !== undefined ? html` · ${n(ils(r.amount))}` : nothing}</div></div>${this.status(r)}</a>`)}</div>`;
    } else if (this.view === 'cards') {
      body = html`<div class="grid-cards" data-elec-list>${rows.map((r) => html`<div class="card" data-account-row=${r.account.id}>
        <div class="row"><a class="rowlink h3" href=${href.account(r.account.id)}>${r.account.name}</a><span class="sp"></span>${this.status(r)}</div>
        <div class="mut">${r.account.customer.name} · ${periodLabel(r.account.period_months, r.account.period_anchor_day, r.account.period_anchor_month)}</div>
        <div class="row" style="margin-block-start:10px;align-items:baseline"><span class="big">${n(f2(r.kwh ?? 0))}</span><span class="mut">${tr('קוט״ש בתקופה')}</span><span class="sp"></span>${money && r.amount !== undefined ? html`<b class="big amt">${n(ils(r.amount))}</b>` : nothing}</div>
        ${money ? html`<div class="mut" style="margin-block-start:6px">${tr('חיוב אחרון:')} ${this.last(r)}</div>` : nothing}</div>`)}</div>`;
    } else {
      body = html`<sw-table class="t card flush" data-elec-list no-focus-rows .columns=${this.columns(money) as unknown as TableColumn[]} .rows=${rows as unknown as Record<string, unknown>[]}
        .rowAttrs=${(r: Record<string, unknown>) => ({ 'data-account-row': (r as unknown as AccountRow).account.id })}
        @row-select=${(e: CustomEvent<{ row: Record<string, unknown> }>) => go(route.account((e.detail.row as unknown as AccountRow).account.id))}></sw-table>`;
    }
    return html`<div class="page" data-elec="accounts" data-state=${this.st === 'ready' && !rows.length ? 'empty' : this.st}>
      ${this.st === 'ready' || this.st === 'empty' || this.st === 'loading' ? head : nothing}
      ${body}
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'elec-accounts-list': ElecAccountsList;
  }
}
