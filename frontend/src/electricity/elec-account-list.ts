/** CR-023 (mockup "רשימת חשבונות"): the accounts list, a table or cards (a list on a phone), with search, the loading / empty / error states. */
import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { elec, type AccountRow } from '../api/electricity-billing';
import { energyAccess } from './access';
import { ElecBase, billChip, n, skeleton, stateBox, type LoadState } from './elec-ui';
import { f2, ils, periodLabel } from './elec-format';
import { go, href, route } from './elec-routes';

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

  private status = (r: AccountRow) => (r.stale ? html`<span class="chip c-warn">מונה לא מדווח</span>` : html`<span class="chip c-ok">תקין</span>`);
  private last = (r: AccountRow) => {
    const b = r.account.last_bill;
    return b ? html`${b.number ? n(b.number) : 'טיוטה'} ${billChip(b.state)}` : html`<span class="mut">-</span>`;
  };

  render() {
    const perms = energyAccess();
    const money = perms.bills;
    if (!perms.view) return html`<div class="page" data-elec="accounts" data-state="forbidden">${stateBox('forbidden', 'lock', 'אין הרשאה לצפות בחשבונות')}</div>`;
    const q = this.q.trim();
    const rows = this.rows.filter((r) => !q || r.account.name.includes(q) || r.account.customer.name.includes(q));
    const head = html`<div class="row">
      <input type="search" data-search aria-label="חיפוש חשבון או לקוח" placeholder="חיפוש חשבון או לקוח" .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} />
      ${this.phone ? nothing : html`<div class="seg" role="group" aria-label="תצוגה">
        <button type="button" data-view="cards" aria-pressed=${this.view === 'cards'} @click=${() => this.setView('cards')}>כרטיסים</button>
        <button type="button" data-view="table" aria-pressed=${this.view === 'table'} @click=${() => this.setView('table')}>טבלה</button></div>`}
      <span class="sp"></span>
      ${perms.manage ? html`<a class="btn pri ${this.phone ? 'sm' : ''}" data-new-account href=${href.accountNew()}>+ חשבון חדש</a>` : nothing}
    </div>`;
    let body;
    if (this.st === 'loading') body = skeleton(6);
    else if (this.st === 'error') body = stateBox('error', 'warning', 'לא ניתן לטעון את החשבונות', { label: 'נסה שוב', run: () => void this.load() });
    else if (this.st === 'empty')
      body = stateBox('empty', 'bolt', 'אין חשבונות עדיין', perms.manage ? { label: '+ חשבון חדש', primary: true, run: () => go(route.accountNew()) } : undefined);
    else if (!rows.length) body = stateBox('empty', 'search', 'לא נמצאו חשבונות');
    else if (this.phone) {
      body = html`<div class="list" data-elec-list>${rows.map((r) => html`<a class="li" href=${href.account(r.account.id)} data-account-row=${r.account.id}>
        <div class="grow"><div class="t1">${r.account.name}</div><div class="t2">${r.account.customer.name} · ${n(f2(r.kwh ?? 0))} קוט״ש${money && r.amount !== undefined ? html` · ${n(ils(r.amount))}` : nothing}</div></div>${this.status(r)}</a>`)}</div>`;
    } else if (this.view === 'cards') {
      body = html`<div class="grid-cards" data-elec-list>${rows.map((r) => html`<div class="card" data-account-row=${r.account.id}>
        <div class="row"><a class="rowlink h3" href=${href.account(r.account.id)}>${r.account.name}</a><span class="sp"></span>${this.status(r)}</div>
        <div class="mut">${r.account.customer.name} · ${periodLabel(r.account.period_months, r.account.period_anchor_day, r.account.period_anchor_month)}</div>
        <div class="row" style="margin-block-start:10px;align-items:baseline"><span style="font-size:22px;font-weight:700;color:var(--sw-heading)">${n(f2(r.kwh ?? 0))}</span><span class="mut">קוט״ש בתקופה</span><span class="sp"></span>${money && r.amount !== undefined ? html`<b>${n(ils(r.amount))}</b>` : nothing}</div>
        ${money ? html`<div class="mut" style="margin-block-start:6px">חיוב אחרון: ${this.last(r)}</div>` : nothing}</div>`)}</div>`;
    } else {
      body = html`<div class="card flush scrollx" data-elec-list><table class="t">
        <thead><tr><th>חשבון</th><th>לקוח</th><th class="hide-tablet">נוסחה</th><th>תקופה</th><th class="num">צריכה בתקופה</th>${money ? html`<th class="num">סכום עד כה</th><th>חיוב אחרון</th>` : nothing}<th>מצב</th></tr></thead>
        <tbody>${rows.map((r) => html`<tr class="go" data-account-row=${r.account.id} @click=${() => go(route.account(r.account.id))}>
          <td class="b"><a class="rowlink" href=${href.account(r.account.id)} @click=${(e: Event) => e.stopPropagation()}>${r.account.name}</a></td><td>${r.account.customer.name}</td>
          <td class="mut ell hide-tablet">${r.account.formula.sentence_he}</td><td>${periodLabel(r.account.period_months, r.account.period_anchor_day, r.account.period_anchor_month)}</td>
          <td class="num">${f2(r.kwh ?? 0)}</td>${money ? html`<td class="num">${r.amount !== undefined ? ils(r.amount) : ''}</td><td>${this.last(r)}</td>` : nothing}<td>${this.status(r)}</td></tr>`)}</tbody></table></div>`;
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
