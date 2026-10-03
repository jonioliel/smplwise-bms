/**
 * CR-023 §13 / owner decision 2 (mockup "לקוחות"): the customers list (cards, search, a new customer) and the customer card (a drawer
 * on a desktop, the whole screen on a phone): name, customer number, registration id, billing address, phone, e-mail, notes, the
 * customer's accounts and last bills, save and delete. Contact fields and the page itself need the bills permission; creating
 * and editing a customer needs the manage permission (the fields are read-only without it).
 */
import { html, nothing, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { elec, elecErrorText, elecFieldErrors, elecPerms, type Customer } from '../api/electricity-billing';
import { ElecBase, alertBox, n, skeleton, stateBox, type LoadState } from './elec-ui';
import { elecCss } from './elec-css';
import { billsTable } from './elec-bills-table';
import { go, href, route } from './elec-routes';

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

  static styles = [
    elecCss,
    css`
      .scrim {
        position: fixed;
        inset: 0;
        background: var(--sw-overlay);
        z-index: var(--sw-z-drawer, 90);
      }
      aside.drawer {
        position: fixed;
        inset-block: 0;
        inset-inline-end: 0;
        inline-size: min(460px, 100%);
        background: var(--sw-surface-solid);
        box-shadow: var(--sw-shadow-3);
        z-index: calc(var(--sw-z-drawer, 90) + 1);
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        overflow: auto;
      }
      @media (max-width: 767px) {
        aside.drawer {
          inline-size: 100%;
          padding: 14px;
        }
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    if (elecPerms().bills) void this.loadList();
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
      this.form = { name: c.name, customer_number: c.customer_number, tax_id: c.tax_id ?? '', address: c.address ?? '', phone: c.phone ?? '', email: c.email ?? '', notes: c.notes ?? '' };
      this.cardSt = 'ready';
    } catch {
      this.cardSt = 'error';
    }
  }
  private close() {
    go(route.customers());
  }

  private validate(): boolean {
    const e: Record<string, string> = {};
    if (!this.form.name.trim()) e.name = 'צריך לכתוב שם ללקוח';
    if (this.form.email && !EMAIL.test(this.form.email)) e.email = 'כתובת דוא״ל לא תקינה';
    if (!/^\d{1,9}$/.test(this.form.customer_number)) e.customer_number = 'מספר לקוח הוא ספרות בלבד';
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
        const body = { ...f } as Partial<Form>;
        if (f.customer_number === this.card.customer_number) delete body.customer_number;
        this.card = await elec().updateCustomer(this.card.id, this.card.revision, body);
      } else {
        const c = await elec().createCustomer(f);
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
    const ro = o.ro || !elecPerms().manage;
    return html`<div class="fld ${o.wide ? 'wide' : ''}"><label for="f-${k}">${label}</label>
      ${o.area
        ? html`<textarea id="f-${k}" name=${k} ?readonly=${ro} placeholder=${o.ph ?? ''} .value=${this.form[k]} @input=${(e: Event) => (this.form = { ...this.form, [k]: (e.target as HTMLTextAreaElement).value })}></textarea>`
        : html`<input id="f-${k}" name=${k} class="${o.ltr ? 'ltr' : ''} ${err ? 'err' : ''}" aria-invalid=${err ? 'true' : 'false'} ?readonly=${ro} placeholder=${o.ph ?? ''} .value=${this.form[k]} @input=${(e: Event) => { this.form = { ...this.form, [k]: (e.target as HTMLInputElement).value }; if (this.errs[k]) this.errs = { ...this.errs, [k]: '' }; }} />`}
      ${err ? html`<div class="msg" role="alert" data-field-error=${k}>${err}</div>` : nothing}</div>`;
  }

  private renderCard() {
    const perms = elecPerms();
    const c = this.card;
    return html`<div class="scrim" @click=${() => this.close()}></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="כרטיס לקוח" data-customer-card>
        <div class="row"><b class="h2">${c ? 'כרטיס לקוח' : 'לקוח חדש'}</b><span class="sp"></span><button type="button" class="btn ghost sm" data-close @click=${() => this.close()}>סגירה</button></div>
        ${this.cardSt === 'loading' ? skeleton(4) : this.cardSt === 'error' ? stateBox('error', 'warning', 'לא ניתן לטעון את הלקוח', { label: 'נסה שוב', run: () => void this.loadCard(this.segments[0]) }) : html`
          <div class="form">${this.field('name', 'שם הלקוח', { wide: true })}${this.field('customer_number', 'מספר לקוח', { ltr: true })}${this.field('tax_id', 'ח.פ. / ע.מ. (לא חובה)', { ltr: true, ph: 'לא חובה' })}
            ${this.field('address', 'כתובת למשלוח החיוב', { wide: true })}${this.field('phone', 'טלפון', { ltr: true })}${this.field('email', 'דוא״ל', { ltr: true })}${this.field('notes', 'הערות', { wide: true, ph: 'לא חובה', area: true })}</div>
          ${c ? html`<b class="h3">חשבונות</b>
            <div class="list" data-customer-accounts>${(c.accounts ?? []).map((a) => html`<a class="li" href=${href.account(a.id)}><div class="grow"><div class="t1">${a.name}</div></div></a>`)}${c.accounts?.length ? nothing : html`<div class="mut">אין חשבונות ללקוח</div>`}</div>
            ${c.bills?.length ? html`<b class="h3">חיובים אחרונים</b>${billsTable(c.bills.slice(0, 4), { phone: true })}` : nothing}` : nothing}
          ${this.error ? alertBox('err', this.error) : nothing}
          ${perms.manage ? html`<div class="row"><button type="button" class="btn pri" data-save ?disabled=${this.busy} @click=${() => void this.save()}>שמירה</button><span class="sp"></span>${c ? html`<button type="button" class="btn dng" data-delete @click=${() => (this.confirmDel = true)}>מחיקת לקוח</button>` : nothing}</div>` : nothing}`}
        <elec-dialog heading="מחיקת לקוח" ?open=${this.confirmDel} data-dialog="delete-customer" @close=${() => (this.confirmDel = false)}>
          <div>הלקוח יימחק. חיובים שהונפקו שומרים עותק של פרטיו.</div>
          <button slot="actions" type="button" class="btn dng pri" data-confirm ?disabled=${this.busy} @click=${() => void this.removeCustomer()}>מחיקה</button>
          <button slot="actions" type="button" class="btn" @click=${() => (this.confirmDel = false)}>ביטול</button>
        </elec-dialog>
      </aside>`;
  }

  render() {
    const perms = elecPerms();
    if (!perms.bills) return html`<div class="page" data-elec="customers" data-state="forbidden">${stateBox('forbidden', 'lock', 'אין הרשאה ללקוחות')}</div>`;
    const q = this.q.trim();
    const list = this.list.filter((c) => !q || c.name.includes(q) || c.customer_number.includes(q));
    let body;
    if (this.st === 'loading') body = skeleton(5);
    else if (this.st === 'error') body = stateBox('error', 'warning', 'לא ניתן לטעון את הלקוחות', { label: 'נסה שוב', run: () => void this.loadList() });
    else if (this.st === 'empty') body = stateBox('empty', 'user', 'אין לקוחות עדיין', perms.manage ? { label: '+ לקוח חדש', primary: true, run: () => go(`${route.customers()}/new`) } : undefined);
    else if (!list.length) body = stateBox('empty', 'search', 'לא נמצאו לקוחות');
    else
      body = html`<div class="grid-cards" data-elec-list>${list.map((c) => html`<div class="card" data-customer-row=${c.id}>
        <div class="row" style="flex-wrap:nowrap"><div class="chip c-acc nodot" style="inline-size:36px;block-size:36px;justify-content:center;padding:0" aria-hidden="true">${c.name.slice(0, 2)}</div><div style="min-inline-size:0"><a class="rowlink h3" href=${href.customer(c.id)}>${c.name}</a><div class="mut">מספר לקוח ${n(c.customer_number)}</div></div></div>
        <dl class="kv" style="margin-block-start:10px"><dt>חשבונות</dt><dd>${c.account_count}</dd>${c.phone ? html`<dt>טלפון</dt><dd>${n(c.phone)}</dd>` : nothing}${c.email ? html`<dt>דוא״ל</dt><dd>${n(c.email)}</dd>` : nothing}</dl></div>`)}</div>`;
    return html`<div class="page" data-elec="customers" data-state=${this.st}>
      <div class="row"><input type="search" data-search aria-label="חיפוש לקוח" placeholder="חיפוש לקוח" .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} /><span class="sp"></span>
        ${perms.manage ? html`<a class="btn pri ${this.phone ? 'sm' : ''}" data-new-customer href=${`#${route.customers()}/new`}>+ לקוח חדש</a>` : nothing}</div>
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
