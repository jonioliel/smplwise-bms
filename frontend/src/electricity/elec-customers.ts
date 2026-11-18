/**
 * CR-023 §13 / owner decision 2 (mockup "לקוחות"): the customers list (cards, search, a new customer) and the customer card (a drawer
 * on a desktop, the whole screen on a phone): name, customer number, registration id, billing address, phone, e-mail, notes, the
 * customer's accounts and last bills, save and delete. Contact fields and the page itself need the bills permission; creating
 * and editing a customer needs the manage permission (the fields are read-only without it).
 */
import { html, nothing } from 'lit';
import '../components/sw-button';
import { customElement, property, state } from 'lit/decorators.js';
import { elec, elecErrorText, elecFieldErrors, type Customer } from '../api/electricity-billing';
import { energyAccess } from './access';
import { ElecBase, alertBox, n, skeleton, stateBox, type LoadState } from './elec-ui';
import { elecCss } from './styles';
import '../components/sw-sheet';
import { billsTable } from './elec-bills-table';
import { go, href, route } from './elec-routes';
import { tr } from '../i18n/msg/electricity';
import { blankCustomerForm as blank, customerFormOf, customerFormProblems, customerMatches, customerSaveBody, type CustomerForm as Form } from './customer-form';

@customElement('elec-customers-page')
export class ElecCustomersPage extends ElecBase {
  /** the route segments after /customers: [] = the list, ['new'], [id] = the card */
  @property({ attribute: false }) segments: string[] = [];
  @property({ attribute: false }) params: URLSearchParams = new URLSearchParams();
  @state() private st: LoadState = 'loading';
  @state() private list: Customer[] = [];
  @state() private q = '';
  @state() private card: Customer | null = null;
  @state() private cardSt: LoadState = 'loading';
  @state() private form: Form = blank();
  @state() private errs: Record<string, string> = {};
  @state() private busy = false;
  @state() private error = '';
  @state() private confirmDel = false;
  private shown = '';

  static styles = [elecCss];

  connectedCallback() {
    super.connectedCallback();
    if (energyAccess().bills) void this.loadList();
  }
  willUpdate(ch: Map<string, unknown>) {
    if (!ch.has('segments')) return;
    const key = this.segments[0] ?? '';
    if (key === this.shown) return;
    this.shown = key;
    this.error = '';
    this.errs = {};
    this.confirmDel = false;
    if (!key) {
      this.card = null;
    } else if (key === 'new') {
      this.card = null;
      this.cardSt = 'ready';
      this.form = blank();
      void elec().nextCustomerNumber().then((no) => (this.form = { ...this.form, customer_number: no })).catch(() => undefined);
    } else void this.loadCard(key);
  }

  private async loadList() {
    this.st = 'loading';
    try {
      this.list = await elec().listCustomers();
      this.st = this.list.length ? 'ready' : 'empty';
    } catch {
      this.st = 'error';
    }
  }
  private async loadCard(id: string) {
    this.cardSt = 'loading';
    try {
      const c = await elec().getCustomer(id);
      this.card = c;
      this.form = customerFormOf(c);
      this.cardSt = 'ready';
    } catch {
      this.cardSt = 'error';
    }
  }
  private close() {
    go(route.customers());
  }

  private validate(): boolean {
    const text = { name: tr('צריך לכתוב שם ללקוח'), email: tr('כתובת דוא״ל לא תקינה'), customer_number: tr('מספר לקוח הוא ספרות בלבד') };
    const e: Record<string, string> = {};
    for (const k of customerFormProblems(this.form, { numberRequired: true })) e[k] = text[k];
    this.errs = e;
    return !Object.keys(e).length;
  }
  private async save() {
    if (this.busy || !this.validate()) return;
    this.busy = true;
    this.error = '';
    try {
      if (this.card) {
        this.card = await elec().updateCustomer(this.card.id, this.card.revision, customerSaveBody(this.form, this.card));
      } else {
        const c = await elec().createCustomer(customerSaveBody(this.form));
        await this.loadList();
        go(route.customer(c.id));
        return;
      }
      await this.loadList();
    } catch (e) {
      const fe = elecFieldErrors(e);
      if (Object.keys(fe).length) this.errs = fe;
      else this.error = elecErrorText(e);
    } finally {
      this.busy = false;
    }
  }
  private async removeCustomer() {
    if (!this.card || this.busy) return;
    this.busy = true;
    try {
      await elec().deleteCustomer(this.card.id, this.card.revision);
      this.confirmDel = false;
      await this.loadList();
      this.close();
    } catch (e) {
      this.confirmDel = false;
      this.error = elecErrorText(e);
    } finally {
      this.busy = false;
    }
  }

  private field(k: keyof Form, label: string, o: { wide?: boolean; ltr?: boolean; ph?: string; area?: boolean; ro?: boolean } = {}) {
    const err = this.errs[k];
    const ro = o.ro || !energyAccess().manage;
    return html`<div class="fld ${o.wide ? 'wide' : ''}"><label for="f-${k}">${label}</label>
      ${o.area
        ? html`<textarea id="f-${k}" name=${k} ?readonly=${ro} placeholder=${o.ph ?? ''} .value=${this.form[k]} @input=${(e: Event) => (this.form = { ...this.form, [k]: (e.target as HTMLTextAreaElement).value })}></textarea>`
        : html`<input id="f-${k}" name=${k} class="${o.ltr ? 'ltr' : ''} ${err ? 'err' : ''}" aria-invalid=${err ? 'true' : 'false'} ?readonly=${ro} placeholder=${o.ph ?? ''} .value=${this.form[k]} @input=${(e: Event) => { this.form = { ...this.form, [k]: (e.target as HTMLInputElement).value }; if (this.errs[k]) this.errs = { ...this.errs, [k]: '' }; }} />`}
      ${err ? html`<div class="msg" role="alert" data-field-error=${k}>${err}</div>` : nothing}</div>`;
  }

  private renderCard() {
    const perms = energyAccess();
    const c = this.card;
    return html`<sw-sheet open wide .heading=${c ? tr('כרטיס לקוח') : tr('לקוח חדש')} data-customer-card @close=${() => this.close()}>
        <div class="col" style="gap:14px">
        ${this.cardSt === 'loading' ? skeleton(4) : this.cardSt === 'error' ? stateBox('error', 'warning', tr('לא ניתן לטעון את הלקוח'), { label: tr('נסה שוב'), run: () => void this.loadCard(this.segments[0]) }) : html`
          <div class="form">${this.field('name', tr('שם הלקוח'), { wide: true })}${this.field('customer_number', tr('מספר לקוח'), { ltr: true })}${this.field('tax_id', tr('ח.פ. / ע.מ. (לא חובה)'), { ltr: true, ph: tr('לא חובה') })}
            ${this.field('address', tr('כתובת למשלוח החיוב'), { wide: true })}${this.field('phone', tr('טלפון'), { ltr: true })}${this.field('email', tr('דוא״ל'), { ltr: true })}${this.field('notes', tr('הערות'), { wide: true, ph: tr('לא חובה'), area: true })}</div>
          ${c ? html`<b class="h3">${tr('חשבונות')}</b>
            <div class="list" data-customer-accounts>${(c.accounts ?? []).map((a) => html`<a class="li" href=${href.account(a.id)}><div class="grow"><div class="t1">${a.name}</div></div></a>`)}${c.accounts?.length ? nothing : html`<div class="mut">${tr('אין חשבונות ללקוח')}</div>`}</div>
            ${c.bills?.length ? html`<b class="h3">${tr('חיובים אחרונים')}</b>${billsTable(c.bills.slice(0, 4), { phone: true })}` : nothing}` : nothing}
          ${this.error ? alertBox('err', this.error) : nothing}
          ${perms.manage ? html`<div class="row"><sw-button variant="primary" data-save ?disabled=${this.busy} @click=${() => void this.save()}>${tr('שמירה')}</sw-button><span class="sp"></span>${c ? html`<sw-button variant="danger" data-delete @click=${() => (this.confirmDel = true)}>${tr('מחיקת לקוח')}</sw-button>` : nothing}</div>` : nothing}`}
        <elec-dialog heading=${tr('מחיקת לקוח')} ?open=${this.confirmDel} data-dialog="delete-customer" @close=${() => (this.confirmDel = false)}>
          <div>${tr('הלקוח יימחק. חיובים שהונפקו שומרים עותק של פרטיו.')}</div>
          <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${() => void this.removeCustomer()}>${tr('מחיקה')}</sw-button>
          <sw-button slot="actions" @click=${() => (this.confirmDel = false)}>${tr('ביטול')}</sw-button>
        </elec-dialog>
        </div>
      </sw-sheet>`;
  }

  render() {
    const perms = energyAccess();
    if (!perms.bills) return html`<div class="page" data-elec="customers" data-state="forbidden">${stateBox('forbidden', 'lock', tr('אין הרשאה ללקוחות'))}</div>`;
    const list = this.list.filter((c) => customerMatches(c, this.q));
    let body;
    if (this.st === 'loading') body = skeleton(5);
    else if (this.st === 'error') body = stateBox('error', 'warning', tr('לא ניתן לטעון את הלקוחות'), { label: tr('נסה שוב'), run: () => void this.loadList() });
    else if (this.st === 'empty') body = stateBox('empty', 'user', tr('אין לקוחות עדיין'), perms.manage ? { label: tr('+ לקוח חדש'), primary: true, run: () => go(`${route.customers()}/new`) } : undefined);
    else if (!list.length) body = stateBox('empty', 'search', tr('לא נמצאו לקוחות'));
    else
      body = html`<div class="grid-cards" data-elec-list>${list.map((c) => html`<div class="card" data-customer-row=${c.id}>
        <div class="row" style="flex-wrap:nowrap"><div class="chip c-acc nodot" style="inline-size:36px;block-size:36px;justify-content:center;padding:0" aria-hidden="true">${c.name.slice(0, 2)}</div><div style="min-inline-size:0"><a class="rowlink h3" href=${href.customer(c.id)}>${c.name}</a><div class="mut">${tr('מספר לקוח')} ${n(c.customer_number)}</div></div></div>
        <dl class="kv" style="margin-block-start:10px"><dt>${tr('חשבונות')}</dt><dd>${c.account_count}</dd>${c.phone ? html`<dt>${tr('טלפון')}</dt><dd>${n(c.phone)}</dd>` : nothing}${c.email ? html`<dt>${tr('דוא״ל')}</dt><dd>${n(c.email)}</dd>` : nothing}</dl></div>`)}</div>`;
    return html`<div class="page" data-elec="customers" data-state=${this.st}>
      <div class="row"><input type="search" data-search aria-label=${tr('חיפוש לקוח')} placeholder=${tr('חיפוש לקוח')} .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} /><span class="sp"></span>
        ${perms.manage ? html`<a class="btn pri ${this.phone ? 'sm' : ''}" data-new-customer href=${`#${route.customers()}/new`}>${tr('+ לקוח חדש')}</a>` : nothing}</div>
      ${body}
      ${this.segments[0] ? this.renderCard() : nothing}
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'elec-customers-page': ElecCustomersPage;
  }
}
