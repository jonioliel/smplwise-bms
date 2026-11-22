/** CR-023 (mockup "רשימת חיובים"): all bills with the status filter (טיוטה, הונפק, נשלח, שולם, בוטל), a month filter and a search by number, customer or account. Bills permission only. */
import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BILL_STATES, BILL_STATE_LABEL, elec, type BillState, type BillSummary } from '../api/electricity-billing';
import { energyAccess } from './access';
import { ElecBase, n, skeleton, stateBox, type LoadState } from './elec-ui';
import { billsTable } from './elec-bills-table';
import { monthName } from './elec-format';
import { go, route } from './elec-routes';
import { tr } from '../i18n/msg/electricity';
import '../components/sw-segmented';
import type { SegmentedChange } from '../components/sw-segmented';
import '../components/sw-field';

@customElement('elec-bills-list')
export class ElecBillsList extends ElecBase {
  @state() private st: LoadState = 'loading';
  @state() private all: BillSummary[] = [];
  @state() private filter: BillState | '' = '';
  @state() private month = '';
  @state() private q = '';

  connectedCallback() {
    super.connectedCallback();
    if (energyAccess().bills) void this.load();
  }
  private async load() {
    this.st = 'loading';
    try {
      this.all = (await elec().listBills()).items;
      this.st = this.all.length ? 'ready' : 'empty';
    } catch {
      this.st = 'error';
    }
  }

  render() {
    if (!energyAccess().bills) return html`<div class="page" data-elec="bills" data-state="forbidden">${stateBox('forbidden', 'lock', tr('אין הרשאה לחיובים'))}</div>`;
    if (this.st === 'loading') return html`<div class="page" data-elec="bills" data-state="loading">${skeleton(7)}</div>`;
    if (this.st === 'error') return html`<div class="page" data-elec="bills" data-state="error">${stateBox('error', 'warning', tr('לא ניתן לטעון את החיובים'), { label: tr('נסה שוב'), run: () => void this.load() })}</div>`;
    if (this.st === 'empty') return html`<div class="page" data-elec="bills" data-state="empty">${stateBox('empty', 'bolt', tr('אין חיובים עדיין'), { label: tr('לחשבונות'), primary: true, run: () => go(route.accounts()) })}</div>`;
    const cnt = (s: BillState) => this.all.filter((b) => b.state === s).length;
    const months = [...new Set(this.all.map((b) => b.period.to.slice(0, 7)))].sort().reverse();
    const q = this.q.trim();
    const list = this.all.filter((b) => (!this.filter || b.state === this.filter) && (!this.month || b.period.to.startsWith(this.month)) && (!q || (b.number ?? '').includes(q) || b.customer.name.includes(q) || b.account_name.includes(q)));
    return html`<div class="page" data-elec="bills" data-state=${list.length ? 'ready' : 'filtered-empty'}>
      <div class="row">
        <sw-segmented label=${tr('סינון לפי מצב')} data-state-filter value=${this.filter} @change=${(e: CustomEvent<SegmentedChange>) => (this.filter = e.detail.value as typeof this.filter)}
          .options=${[{ value: '', label: tr('הכול'), count: n(this.all.length), attrs: { 'data-filter': '' } }, ...BILL_STATES.map((s) => ({ value: s, label: BILL_STATE_LABEL[s], count: n(cnt(s)), attrs: { 'data-filter': s } }))]}></sw-segmented>
        <span class="sp"></span>
        <sw-field flow><select data-month aria-label=${tr('חודש')} style="inline-size:auto" @change=${(e: Event) => (this.month = (e.target as HTMLSelectElement).value)}><option value="">${tr('כל החודשים')}</option>${months.map((m) => html`<option value=${m} ?selected=${m === this.month}>${monthName(`${m}-01`)}</option>`)}</select></sw-field>
        <input type="search" data-search aria-label=${tr('חיפוש מספר או לקוח')} placeholder=${tr('חיפוש מספר או לקוח')} .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} />
      </div>
      ${list.length ? billsTable(list, { phone: this.phone }) : stateBox('empty', 'search', tr('לא נמצאו חיובים'))}
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'elec-bills-list': ElecBillsList;
  }
}
