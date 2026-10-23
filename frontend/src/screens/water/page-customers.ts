import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../../components/sw-icon';
import '../../components/sw-sheet';
import '../../components/sw-state-panel';
import '../../electricity/elec-ui'; // elec-dialog (the electricity confirmation dialog)
import { ApiError, describeError } from '../../api/client';
import { waterBilling, type Customer } from '../../api/water-billing';
import { navigate } from '../../router';
import { onWaterAccess, waterAccess, type WaterAccess } from '../../water/access';
import { waterCss } from '../../water/styles';
import { fmtIls } from '../../water/billing-format';
import { wt, type WtKey } from '../../water/i18n';
import { SkinController } from '../../design/skin';
import { bubbleChrome } from '../../styles/bubble-chrome';
import { billsTable } from './page-accounts';

const BASE = '/infra/water/customers';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
interface Form {
  name: string;
  customer_number: string;
  tax_id: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
}
const blank = (no = ''): Form => ({ name: '', customer_number: no, tax_id: '', address: '', phone: '', email: '', notes: '' });
const skeletonCard = (n = 6) => html`<div class="card" aria-busy="true">${Array.from({ length: n }, () => html`<div class="row" style="padding:10px 0"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div>`;

/**
 * תשתיות › מים › לקוחות (CR-WATER78 section 16, D11): the electricity customers (elec-customers.ts) - the SHARED customer card - as a table
 * (מספר, שם, כתובת / יחידה, טלפון, דוא״ל, חשבונות, יתרה פתוחה), search, a new customer, and the customer card in a sheet (the fields, the
 * customer's water accounts, the recent bills, save and delete). A customer with accounts (water or electricity) cannot be deleted - the
 * server refuses, the card says so. water.bills for the page; water.manage to create and edit.
 */
@customElement('water-customers-page')
export class WaterCustomersPage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) segments: string[] = [];
  @property({ attribute: false }) params: URLSearchParams = new URLSearchParams();
  @state() private access: WaterAccess = waterAccess();
  @state() private st: 'loading' | 'ready' | 'error' = 'loading';
  @state() private list: Customer[] = [];
  @state() private q = '';
  @state() private card: Customer | null = null;
  @state() private cardSt: 'loading' | 'ready' | 'error' = 'loading';
  @state() private form: Form = blank();
  @state() private errs: Record<string, string> = {};
  @state() private busy = false;
  @state() private error = '';
  @state() private confirmDel = false;
  private shown: string | null = null;
  private stop?: () => void;

  static styles = [waterCss, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onWaterAccess((a) => (this.access = a));
    if (this.access.bills) void this.loadList();
  }
  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  willUpdate(ch: Map<string, unknown>) {
    if (!ch.has('segments')) return;
    const key = this.segments[0] ?? '';
    if (key === this.shown) return;
    this.shown = key;
    this.error = '';
    this.errs = {};
    this.confirmDel = false;
    if (!key) this.card = null;
    else if (key === 'new') {
      this.card = null;
      this.cardSt = 'ready';
      this.form = blank();
      void waterBilling.nextCustomerNumber().then((r) => (this.form = { ...this.form, customer_number: r.customer_number })).catch(() => undefined);
    } else void this.loadCard(key);
  }

  private async loadList() {
    this.st = 'loading';
    try {
      this.list = (await waterBilling.listCustomers()).items;
      this.st = 'ready';
    } catch {
      this.st = 'error';
    }
  }

  private async loadCard(id: string) {
    this.cardSt = 'loading';
    try {
      const c = await waterBilling.customer(id);
      this.card = c;
      this.form = { name: c.name, customer_number: c.customer_number, tax_id: c.tax_id ?? '', address: c.address ?? '', phone: c.phone ?? '', email: c.email ?? '', notes: c.notes ?? '' };
      this.cardSt = 'ready';
    } catch {
      this.cardSt = 'error';
    }
  }

  private validate(): boolean {
    const e: Record<string, string> = {};
    if (!this.form.name.trim()) e.name = wt('errName');
    if (this.form.email && !EMAIL.test(this.form.email)) e.email = wt('errEmail');
    if (this.form.customer_number && !/^\d{1,9}$/.test(this.form.customer_number)) e.customer_number = wt('errCustNo');
    this.errs = e;
    return !Object.keys(e).length;
  }

  private async save() {
    if (this.busy || !this.validate()) return;
    this.busy = true;
    this.error = '';
    try {
      const f = { ...this.form, name: this.form.name.trim() };
      if (this.card) {
        const body: Partial<Form> = { ...f };
        if (f.customer_number === this.card.customer_number) delete body.customer_number;
        this.card = await waterBilling.updateCustomer(this.card.id, { ...body, base_revision: this.card.revision });
        await this.loadList();
      } else {
        const c = await waterBilling.createCustomer({ ...f, customer_number: f.customer_number || undefined });
        await this.loadList();
        navigate(`${BASE}/${c.id}`);
      }
    } catch (e) {
      const fields = e instanceof ApiError ? (e.body.details?.fields as string[] | undefined) : undefined;
      if (fields?.length) this.errs = Object.fromEntries(fields.map((k) => [k, describeError(e)]));
      else this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async removeRecord() {
    if (!this.card || this.busy) return;
    this.busy = true;
    try {
      await waterBilling.deleteCustomer(this.card.id, this.card.revision);
      this.confirmDel = false;
      await this.loadList();
      navigate(BASE);
    } catch (e) {
      this.confirmDel = false;
      this.error = e instanceof ApiError && e.status === 409 ? describeError(e) || wt('cDeleteRefused') : describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private field(k: keyof Form, label: WtKey, o: { wide?: boolean; ltr?: boolean; area?: boolean } = {}) {
    const err = this.errs[k];
    const ro = !this.access.manage;
    const set = (v: string) => {
      this.form = { ...this.form, [k]: v };
      if (this.errs[k]) this.errs = { ...this.errs, [k]: '' };
    };
    return html`<div class="fld ${o.wide ? 'wide' : ''}"><label for="wc-${k}">${wt(label)}</label>
      ${o.area
        ? html`<textarea id="wc-${k}" name=${k} ?readonly=${ro} .value=${this.form[k]} @input=${(e: Event) => set((e.target as HTMLTextAreaElement).value)}></textarea>`
        : html`<input id="wc-${k}" name=${k} class="${o.ltr ? 'ltr' : ''} ${err ? 'err' : ''}" aria-invalid=${err ? 'true' : 'false'} ?readonly=${ro} .value=${this.form[k]} @input=${(e: Event) => set((e.target as HTMLInputElement).value)} />`}
      ${err ? html`<div class="msg" role="alert" data-field-error=${k}>${err}</div>` : nothing}</div>`;
  }

  private renderCard() {
    const c = this.card;
    const blocked = !!c && (c.account_count > 0 || c.energy_account_count > 0);
    return html`<sw-sheet open wide .heading=${c ? wt('customerCard') : wt('newCustomer')} data-customer-card @close=${() => navigate(BASE)}>
      <div class="col">
        ${this.cardSt === 'loading' ? skeletonCard(4) : this.cardSt === 'error' ? html`<sw-state-panel state="error" compact heading=${wt('loadCustomerError')} actionLabel=${wt('retry')} @action=${() => void this.loadCard(this.segments[0])}></sw-state-panel>` : html`
          <div class="form">${this.field('name', 'cName', { wide: true })}${this.field('customer_number', 'cNumber', { ltr: true })}${this.field('tax_id', 'cTaxId', { ltr: true })}
            ${this.field('address', 'cAddress', { wide: true })}${this.field('phone', 'cPhone', { ltr: true })}${this.field('email', 'cEmail', { ltr: true })}${this.field('notes', 'cNotes', { wide: true, area: true })}</div>
          <div class="mut">${wt('cShared')}</div>
          ${c ? html`<b class="h3">${wt('accounts')}</b>
            <div class="list" data-customer-accounts>${(c.accounts ?? []).map((a) => html`<a class="li" href=${`#/infra/water/accounts/${a.id}`}><div class="grow"><div class="t1">${a.name}</div></div>${a.status === 'paused' ? html`<span class="chip c-mut">${wt('accPaused')}</span>` : nothing}</a>`)}${c.accounts?.length ? nothing : html`<div class="mut">${wt('cNoAccounts')}</div>`}</div>
            ${c.bills?.length ? html`<b class="h3">${wt('cRecentBills')}</b>${billsTable(c.bills.slice(0, 4), true)}` : nothing}` : nothing}
          ${this.error ? html`<div class="alert err" role="alert" data-customer-error>${this.error}</div>` : nothing}
          ${this.access.manage ? html`<div class="row"><button type="button" class="btn pri" data-save ?disabled=${this.busy} @click=${() => void this.save()}>${wt('save')}</button><span class="sp"></span>
            ${c ? html`<button type="button" class="btn dng" data-delete title=${blocked ? wt('cDeleteRefused') : ''} @click=${() => { if (blocked) this.error = wt('cDeleteRefused'); else this.confirmDel = true; }}>${wt('cDelete')}</button>` : nothing}</div>` : nothing}`}
        <elec-dialog heading=${wt('cDelete')} ?open=${this.confirmDel} data-dialog="delete-customer" @close=${() => (this.confirmDel = false)}>
          <div>${wt('cDeleteBody')}</div>
          <button slot="actions" type="button" class="btn dng pri" data-confirm ?disabled=${this.busy} @click=${() => void this.removeRecord()}>${wt('cDelete')}</button>
          <button slot="actions" type="button" class="btn" @click=${() => (this.confirmDel = false)}>${wt('cancel')}</button>
        </elec-dialog>
      </div>
    </sw-sheet>`;
  }

  render() {
    if (!this.access.bills) return html`<sw-state-panel state="forbidden" data-water="customers" data-state="forbidden"></sw-state-panel>`;
    const q = this.q.trim();
    const list = this.list.filter((c) => !q || c.name.includes(q) || c.customer_number.includes(q) || (c.address ?? '').includes(q));
    const head = html`<div class="row head">
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-cust-search placeholder=${wt('custSearch')} aria-label=${wt('custSearch')} .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} /></label>
      <span class="sp"></span>
      ${this.access.manage ? html`<button type="button" class="btn pri" data-new-customer @click=${() => navigate(`${BASE}/new`)}><sw-icon name="plus" size="15"></sw-icon>${wt('newCustomer')}</button>` : nothing}
    </div>`;
    let body;
    if (this.st === 'loading') body = skeletonCard(5);
    else if (this.st === 'error') body = html`<sw-state-panel state="error" heading=${wt('loadCustomersError')} actionLabel=${wt('retry')} @action=${() => void this.loadList()}></sw-state-panel>`;
    else if (!this.list.length) body = html`<sw-state-panel icon="users" state="empty" heading=${wt('emptyCustomers')}></sw-state-panel>`;
    else if (!list.length) body = html`<sw-state-panel icon="search" state="empty" compact heading=${wt('noCustomers')}></sw-state-panel>`;
    else
      body = html`<div class="card flush scrollx desk-only"><table class="t" data-cust-table>
          <thead><tr><th>${wt('colCustNo')}</th><th>${wt('colName')}</th><th>${wt('colAddress')}</th><th>${wt('colPhone')}</th><th>${wt('colEmail')}</th><th class="n">${wt('colAccounts')}</th><th class="n">${wt('colBalance')}</th></tr></thead>
          <tbody>${list.map((c) => html`<tr class="go" data-customer-row=${c.id} @click=${() => navigate(`${BASE}/${c.id}`)}>
            <td class="num" style="text-align:start">${c.customer_number}</td><td class="b"><a class="rowlink" href=${`#${BASE}/${c.id}`} @click=${(e: Event) => e.stopPropagation()}>${c.name}</a></td>
            <td>${c.address ?? ''}</td><td class="num" style="text-align:start">${c.phone ?? ''}</td><td class="num" style="text-align:start">${c.email ?? ''}</td>
            <td class="n"><span class="num">${c.account_count}</span></td><td class="n"><span class="num">${c.open_balance !== undefined ? fmtIls(c.open_balance) : ''}</span></td></tr>`)}</tbody></table></div>
        <div class="list phone-only" style="flex-direction:column" data-cust-rows>${list.map((c) => html`<a class="li" href=${`#${BASE}/${c.id}`} data-customer-row=${c.id}>
          <div class="grow"><div class="t1">${c.name} · <span class="num">${c.customer_number}</span></div><div class="t2">${c.address ?? ''}${c.phone ? html` · <span class="num">${c.phone}</span>` : nothing}</div></div>
          <div class="t2 num" style="text-align:end">${c.open_balance !== undefined ? fmtIls(c.open_balance) : ''}</div></a>`)}</div>`;
    return html`<div class="page" data-water="customers" data-state=${this.st}>${head}${body}${this.segments[0] ? this.renderCard() : nothing}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'water-customers-page': WaterCustomersPage;
  }
}
