/**
 * CR-023 / owner decision 1 (mockup "אשף חשבון חדש"): the six-step new-account wizard - 1 choose meters, 2 the account formula (the
 * formula editor), 3 price and VAT, 4 billing period, 5 customer card (new, or an existing customer with several accounts), 6 summary
 * with the automatic-generation option and the payment terms. Every error state of the mockup is built: a rejected sensor (kW instead
 * of kWh), a negative result, parentheses, a missing price or VAT rate, a field error on the customer card. Also the edit mode of an
 * existing account (`accountId`). No history-import step (owner round 2).
 */
import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  AUTO_LABEL, elec, elecErrorText, elecFieldErrors, elecMeters, elecToday, type Account, type AutoMode, type Customer, type ElecMeter, type PriceMode, type Tariff, type VatRates,
  type BillingSettings,
} from '../api/electricity-billing';
import { energyAccess } from './access';
import { ElecBase, alertBox, n, setFlash, skeleton, stateBox } from './elec-ui';
import './elec-formula-editor';
import './meter-picker';
import type { ElecFormulaEditor, FormulaChange } from './elec-formula-editor';
import { astToTokens, parseTokens, presetTokens, type Tok } from './elec-formula';
import { MONTH_NAMES, addDays, billNumber, f2, f4, fmtDate, fmtRange, isIsoDate, monthName, nextPeriods, periodContaining, r2 } from './elec-format';
import { go, href, route } from './elec-routes';
import { meterNames } from './meter-name';

const STEPS = ['בחירת מונים', 'נוסחת החשבון', 'מחיר ומע״מ', 'תקופת חיוב', 'כרטיס לקוח', 'סיכום והפקה'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface NewCust {
  name: string;
  customer_number: string;
  tax_id: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
}
const emptyCust = (): NewCust => ({ name: '', customer_number: '', tax_id: '', address: '', phone: '', email: '', notes: '' });

@customElement('elec-account-wizard')
export class ElecAccountWizard extends ElecBase {
  /** set: edit this account instead of creating one */
  @property() accountId = '';
  @state() private loadSt: 'loading' | 'ready' | 'error' = 'loading';
  @state() private step = 1;
  @state() private reached = 1;
  // data
  @state() private meters: ElecMeter[] = [];
  @state() private tariffs: Tariff[] = [];
  @state() private vat: VatRates | null = null;
  @state() private settings: BillingSettings | null = null;
  @state() private customers: Customer[] = [];
  @state() private nextNo = '';
  // 1 (the meters picker: src/electricity/meter-picker.ts, mode 'choose')
  @state() private meterIds: string[] = [];
  // 2
  @state() private tokens: Tok[] = [];
  @state() private formulaValid = false;
  @state() private formulaChecked = false;
  // 3
  @state() private tariffId = '';
  @state() private tariffOpen = false;
  @state() private tf = { name: '', price: '', mode: 'ex_vat' as PriceMode, from: '', err: {} as Record<string, string>, busy: false, error: '' };
  // 4
  @state() private months: 1 | 2 = 1;
  @state() private anchorDay = 1;
  @state() private anchorMonth = 1;
  @state() private firstStart = '';
  // 5
  @state() private custMode: 'new' | 'existing' = 'new';
  @state() private custQ = '';
  @state() private existingId = '';
  @state() private nc: NewCust = emptyCust();
  @state() private ncErr: Record<string, string> = {};
  @state() private accName = '';
  @state() private accNameErr = '';
  // 6
  @state() private auto: AutoMode = 'draft';
  @state() private afterSave: 'draft' | 'none' = 'draft';
  @state() private saving = false;
  @state() private saveErr = '';
  @state() private sampleResult: number | null = null;
  @state() private numOpen = false;
  @state() private numVal = '';
  @state() private numPct = true;
  @state() private numErr = '';
  private account: Account | null = null;
  private createdCustomerId = '';

  connectedCallback() {
    super.connectedCallback();
    void this.init();
  }

  private get edit(): boolean {
    return !!this.accountId;
  }

  private async init() {
    this.loadSt = 'loading';
    const perms = energyAccess();
    try {
      const b = elec();
      const [meters, tariffs, vat, settings, customers, nextNo] = await Promise.all([
        elecMeters(), b.listTariffs(), b.getVat(), b.getSettings().catch(() => null), perms.view ? b.listCustomers().catch(() => []) : Promise.resolve([] as Customer[]), b.nextCustomerNumber().catch(() => ''),
      ]);
      this.meters = meters;
      this.tariffs = tariffs;
      this.vat = vat;
      this.settings = settings;
      this.customers = customers;
      this.nextNo = nextNo;
      this.nc = { ...emptyCust(), customer_number: nextNo };
      this.tf = { ...this.tf, mode: settings?.default_price_mode ?? 'ex_vat', from: elecToday() };
      this.firstStart = elecToday();
      if (tariffs.length === 1) this.tariffId = tariffs[0].id;
      if (this.edit) {
        const a = await b.getAccount(this.accountId);
        this.account = a;
        this.meterIds = a.formula.meter_ids;
        this.tokens = astToTokens(a.formula.ast);
        this.formulaValid = true;
        this.tariffId = a.tariff.id;
        this.months = a.period_months;
        this.anchorDay = a.period_anchor_day;
        this.anchorMonth = a.period_anchor_month;
        this.firstStart = a.first_period_start;
        this.auto = a.auto_mode;
        this.accName = a.name;
        this.existingId = a.customer.id;
        this.custMode = 'existing';
        this.reached = 6;
      }
      this.loadSt = 'ready';
    } catch {
      this.loadSt = 'error';
    }
  }

  // ---------------------------------------------------------------- derived
  private chosen(): ElecMeter[] {
    return this.meterIds.map((id) => this.meters.find((m) => m.id === id)).filter((m): m is ElecMeter => !!m);
  }
  private tariff(): Tariff | undefined {
    return this.tariffs.find((t) => t.id === this.tariffId);
  }
  private cust(): { name: string; number: string; count: number } {
    if (this.custMode === 'existing') {
      const c = this.customers.find((x) => x.id === this.existingId) ?? (this.account ? { name: this.account.customer.name, customer_number: this.account.customer.customer_number, account_count: 1 } : null);
      return c ? { name: c.name, number: c.customer_number, count: c.account_count } : { name: '', number: this.nextNo, count: 0 };
    }
    return { name: this.nc.name, number: this.nc.customer_number || this.nextNo, count: 0 };
  }
  private canNext(): boolean {
    switch (this.step) {
      case 1: return this.meterIds.length > 0;
      case 2: return this.formulaValid && this.formulaChecked;
      case 3: return !!this.tariffId && !!this.vat?.current;
      case 4: return isIsoDate(this.firstStart) && this.anchorDay >= 1 && this.anchorDay <= 28;
      case 5: return true;
      default: return true;
    }
  }
  private goStep(s: number) {
    if (s < 1 || s > 6 || s > this.reached) return;
    this.step = s;
  }
  private next() {
    if (this.step === 5 && !this.validateStep5()) return;
    if (!this.canNext() || this.step >= 6) return;
    if (this.step === 1) this.enterFormula();
    this.step += 1;
    this.reached = Math.max(this.reached, this.step);
    if (this.step === 2) this.formulaChecked = false;
  }
  /** entering step 2 from step 1: a formula that mentions a meter that is no longer chosen starts again from the sum preset */
  private enterFormula() {
    const ok = this.tokens.every((t) => t.t !== 'm' || this.meterIds.includes(t.id)) && this.tokens.some((t) => t.t === 'm');
    if (!ok) {
      this.tokens = presetTokens('sum', this.meterIds);
      this.formulaValid = true;
      this.formulaChecked = false;
    }
  }
  private validateStep5(): boolean {
    this.ncErr = {};
    this.accNameErr = '';
    let ok = true;
    if (!this.accName.trim()) {
      this.accNameErr = 'צריך לתת שם לחשבון';
      ok = false;
    }
    if (this.edit) return ok;
    if (this.custMode === 'new') {
      if (!this.nc.name.trim()) (this.ncErr = { ...this.ncErr, name: 'צריך לכתוב שם ללקוח' }, (ok = false));
      if (this.nc.email && !EMAIL.test(this.nc.email)) (this.ncErr = { ...this.ncErr, email: 'כתובת דוא״ל לא תקינה' }, (ok = false));
      if (!/^\d{1,9}$/.test(this.nc.customer_number)) (this.ncErr = { ...this.ncErr, customer_number: 'מספר לקוח הוא ספרות בלבד' }, (ok = false));
    } else if (!this.existingId) ok = false;
    return ok;
  }

  // ---------------------------------------------------------------- save
  private async save() {
    if (this.saving) return;
    const t = this.tariff();
    const ast = parseTokens(this.tokens).ast;
    if (!t || !ast) return;
    this.saving = true;
    this.saveErr = '';
    const b = elec();
    try {
      if (this.edit && this.account) {
        await b.updateAccount(this.account.id, this.account.revision, { name: this.accName.trim(), formula: { ast }, tariff_id: this.tariffId, auto_mode: this.auto });
        go(route.account(this.account.id));
        return;
      }
      let customerId = this.existingId;
      if (this.custMode === 'new') {
        if (!this.createdCustomerId) {
          try {
            const c = await b.createCustomer({ name: this.nc.name.trim(), customer_number: this.nc.customer_number, address: this.nc.address, phone: this.nc.phone, email: this.nc.email, tax_id: this.nc.tax_id, notes: this.nc.notes });
            this.createdCustomerId = c.id;
          } catch (e) {
            const f = elecFieldErrors(e);
            this.ncErr = Object.keys(f).length ? f : { customer_number: elecErrorText(e) };
            if (!Object.keys(f).length && !/מספר/.test(elecErrorText(e))) this.ncErr = { name: elecErrorText(e) };
            this.step = 5;
            return;
          }
        }
        customerId = this.createdCustomerId;
      }
      const r = await b.createAccount(
        { name: this.accName.trim(), customer_id: customerId, formula: { ast }, tariff_id: this.tariffId, period_months: this.months, period_anchor_day: this.anchorDay, period_anchor_month: this.months === 2 ? this.anchorMonth : 1, first_period_start: this.firstStart, auto_mode: this.auto },
        this.draftPossible() ? this.afterSave : 'none',
      );
      if (r.billError) setFlash(`החשבון נשמר, אבל לא נוצרה טיוטה: ${r.billError}`);
      go(route.account(r.account.id));
    } catch (e) {
      this.saveErr = elecErrorText(e);
    } finally {
      this.saving = false;
    }
  }
  /** the last ended period of the new account (a draft needs a period that already ended and started after the account's first period) */
  private lastPeriod(): { from: string; to: string } | null {
    const today = elecToday();
    const cur = periodContaining(today, this.months, this.anchorDay, this.months === 2 ? this.anchorMonth : 1);
    const to = addDays(cur.from, -1);
    if (!isIsoDate(this.firstStart) || to < this.firstStart) return null;
    return { from: this.firstStart > periodContaining(to, this.months, this.anchorDay, this.months === 2 ? this.anchorMonth : 1).from ? this.firstStart : periodContaining(to, this.months, this.anchorDay, this.months === 2 ? this.anchorMonth : 1).from, to };
  }
  private draftPossible = (): boolean => !!this.lastPeriod();

  // ---------------------------------------------------------------- step views
  /** Step 1: the shared meter picker (mode 'choose': the registered meters, with the infrastructure sensors that cannot be meters and why). */
  private renderStep1() {
    const chosen = this.chosen();
    return html`<elec-meter-picker mode="choose" multi sensors .meters=${this.meters} .selected=${this.meterIds} data-meter-picker
        @change=${(e: CustomEvent<{ selected: string[] }>) => (this.meterIds = e.detail.selected)}></elec-meter-picker>
      <div class="row" data-chosen><span class="chip c-acc nodot">נבחרו ${chosen.length} ${chosen.length === 1 ? 'מונה' : 'מונים'}</span><span class="mut">${chosen.map((m) => meterNames(m).primary).join(', ')}</span></div>`;
  }

  private onFormula = (e: CustomEvent<FormulaChange>) => {
    this.tokens = e.detail.tokens;
    this.formulaValid = e.detail.valid;
    this.formulaChecked = false;
  };
  private onChecked = (e: CustomEvent<{ ok: boolean; result: number | null }>) => {
    this.formulaChecked = e.detail.ok && this.formulaValid;
    this.sampleResult = e.detail.result;
  };
  private renderStep2() {
    return html`<elec-formula-editor .meters=${this.chosen()} .tokens=${this.tokens} @change=${this.onFormula} @checked=${this.onChecked} @number-request=${() => { this.numOpen = true; this.numErr = ''; }}></elec-formula-editor>`;
  }
  private confirmNumber() {
    const raw = this.numVal.trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(raw) || Number(raw) <= 0) {
      this.numErr = 'צריך להקליד מספר גדול מאפס';
      return;
    }
    if (this.numPct && Number(raw) > 1000) {
      this.numErr = 'האחוז גדול מדי';
      return;
    }
    this.numOpen = false;
    this.numErr = '';
    this.renderRoot.querySelector<ElecFormulaEditor>('elec-formula-editor')?.addNumber(raw, this.numPct);
    this.numVal = '';
  }
  private renderNumberDialog() {
    return html`<elec-dialog heading="הוספת מספר" ?open=${this.numOpen} data-number-dialog @close=${() => (this.numOpen = false)}>
      <div class="fld"><label for="numv">ערך</label>
        <input id="numv" class="ltr ${this.numErr ? 'err' : ''}" data-number-input inputmode="decimal" .value=${this.numVal} @input=${(e: Event) => { this.numVal = (e.target as HTMLInputElement).value; this.numErr = ''; }} @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.confirmNumber()} />
        ${this.numErr ? html`<div class="msg" role="alert">${this.numErr}</div>` : nothing}</div>
      <div class="seg" role="group" aria-label="סוג">
        <button type="button" data-number-kind="pct" aria-pressed=${this.numPct} @click=${() => (this.numPct = true)}>אחוז</button>
        <button type="button" data-number-kind="num" aria-pressed=${!this.numPct} @click=${() => (this.numPct = false)}>מספר</button>
      </div>
      <button slot="actions" type="button" class="btn pri" data-number-ok @click=${() => this.confirmNumber()}>הוספה</button>
      <button slot="actions" type="button" class="btn" @click=${() => (this.numOpen = false)}>ביטול</button>
    </elec-dialog>`;
  }

  private exOf(t: Tariff): { ex: number; inc: number; vat: number } {
    const v = t.current;
    const rate = this.vat?.current ? Number(this.vat.current.rate_percent) / 100 : 0;
    const p = v ? Number(v.price) : 0;
    return v?.price_mode === 'inc_vat' ? { ex: p / (1 + rate), inc: p, vat: rate } : { ex: p, inc: p * (1 + rate), vat: rate };
  }
  private renderStep3() {
    const t = this.tariff();
    const rate = this.vat?.current;
    return html`${!rate ? alertBox('err', html`לא הוגדר שיעור מע״מ. <a class="lnk" href=${href.settings('prices')}>הגדרת שיעור מע״מ</a>`) : nothing}
      ${!this.tariffs.length ? stateBox('empty', 'bolt', 'אין תעריפים עדיין', { label: '+ תעריף חדש', primary: true, run: () => (this.tariffOpen = true) }) : html`<div class="list" role="radiogroup" aria-label="תעריף" data-tariff-list>
        ${this.tariffs.map((x) => html`<label class="li ${x.id === this.tariffId ? 'sel' : ''}" data-tariff-row=${x.id}><input type="radio" name="tariff" .checked=${x.id === this.tariffId} @change=${() => (this.tariffId = x.id)} /><span class="ind"></span>
          <div class="grow"><div class="t1">${x.name}</div><div class="t2">הוזן ${x.current?.price_mode === 'inc_vat' ? 'כולל' : 'לפני'} מע״מ · בתוקף מ-${n(fmtDate(x.current?.effective_from ?? ''))}</div></div><b class="num">${f4(x.current?.price ?? 0)} ₪</b></label>`)}</div>
        <div class="row"><button type="button" class="btn ghost sm" data-new-tariff @click=${() => (this.tariffOpen = true)}>+ תעריף חדש</button></div>`}
      ${t && rate ? this.priceCard(t) : nothing}`;
  }
  private priceCard(t: Tariff) {
    const p = this.exOf(t);
    const kwh = this.sampleKwh();
    const total = t.current?.price_mode === 'inc_vat' ? r2(kwh * p.inc) : r2(r2(kwh * p.ex) + r2(r2(kwh * p.ex) * p.vat));
    return html`<div class="card soft" data-price-card><dl class="kv"><dt>מחיר לקוט״ש לפני מע״מ</dt><dd>${n(f4(p.ex) + ' ₪')}</dd><dt>מע״מ</dt><dd>${n((p.vat * 100).toFixed(0) + '%')} <span class="mut">(מההגדרות)</span></dd><dt>מחיר לקוט״ש כולל מע״מ</dt><dd>${n(f4(p.inc) + ' ₪')}</dd>
      ${kwh ? html`<dt>לדוגמה, ${monthName(addDays(periodContaining(elecToday(), 1, 1, 1).from, -1))}</dt><dd>${n(f2(kwh))} קוט״ש = ${n(f2(total) + ' ₪')}</dd>` : nothing}</dl></div>`;
  }
  /** the formula's result on the last full period (the editor's check); 0 when unknown */
  private sampleKwh(): number {
    return this.sampleResult !== null && this.sampleResult > 0 ? this.sampleResult : 0;
  }

  private renderStep4() {
    const anch = this.months === 2 ? this.anchorMonth : 1;
    const periods = isIsoDate(this.firstStart) ? nextPeriods(this.firstStart, this.months, this.anchorDay, anch, '', 3) : [];
    const c = this.cust();
    return html`<div class="form">
        <div class="fld"><span class="lbl" id="len">אורך תקופה</span><div class="seg" role="group" aria-labelledby="len"><button type="button" data-months="1" aria-pressed=${this.months === 1} ?disabled=${this.edit} @click=${() => (this.months = 1)}>חודשית</button><button type="button" data-months="2" aria-pressed=${this.months === 2} ?disabled=${this.edit} @click=${() => (this.months = 2)}>דו-חודשית</button></div></div>
        ${this.months === 2 ? html`<div class="fld"><label for="am">חודש פתיחת המחזור</label><select id="am" data-anchor-month ?disabled=${this.edit} @change=${(e: Event) => (this.anchorMonth = Number((e.target as HTMLSelectElement).value))}>${MONTH_NAMES.map((m, i) => html`<option value=${i + 1} ?selected=${this.anchorMonth === i + 1}>${m}</option>`)}</select></div>` : nothing}
        <div class="fld"><label for="ad">יום תחילת תקופה</label><div class="unit"><input id="ad" class="ltr" type="number" min="1" max="28" data-anchor-day ?disabled=${this.edit} .value=${String(this.anchorDay)} @input=${(e: Event) => (this.anchorDay = Number((e.target as HTMLInputElement).value))} /><span>בחודש</span></div>
          ${this.anchorDay < 1 || this.anchorDay > 28 ? html`<div class="msg" role="alert">היום חייב להיות בין 1 ל-28</div>` : nothing}</div>
        <div class="fld"><label for="fs">תחילת החיוב הראשון</label><input id="fs" type="date" class="ltr ${isIsoDate(this.firstStart) ? '' : 'err'}" data-first-start ?disabled=${this.edit} .value=${this.firstStart} @change=${(e: Event) => (this.firstStart = (e.target as HTMLInputElement).value)} />
          ${isIsoDate(this.firstStart) ? nothing : html`<div class="msg" role="alert">צריך לבחור תאריך</div>`}</div>
      </div>
      <div class="card flush soft"><div class="hd"><b class="h3">התקופות הבאות</b></div>${periods.length ? html`<table class="t" data-periods><thead><tr><th>תקופה</th><th>מספר חיוב</th></tr></thead><tbody>
        ${periods.map((p) => html`<tr><td><span class="num">${fmtRange(p.from, p.to)}</span></td><td class="num" style="text-align:start">${billNumber(p.to, c.number, '')}</td></tr>`)}</tbody></table>` : html`<div class="mut" style="padding:0 16px 14px">בחרו תאריך התחלה</div>`}</div>`;
  }

  private renderStep5() {
    const nf = (k: keyof NewCust, label: string, o: { wide?: boolean; ltr?: boolean; ph?: string; area?: boolean } = {}) => {
      const err = this.ncErr[k];
      return html`<div class="fld ${o.wide ? 'wide' : ''}"><label for="c-${k}">${label}</label>
        ${o.area ? html`<textarea id="c-${k}" name=${k} .value=${this.nc[k]} placeholder=${o.ph ?? ''} @input=${(e: Event) => (this.nc = { ...this.nc, [k]: (e.target as HTMLTextAreaElement).value })}></textarea>`
          : html`<input id="c-${k}" name=${k} class="${o.ltr ? 'ltr' : ''} ${err ? 'err' : ''}" aria-invalid=${err ? 'true' : 'false'} placeholder=${o.ph ?? ''} .value=${this.nc[k]} @input=${(e: Event) => { this.nc = { ...this.nc, [k]: (e.target as HTMLInputElement).value }; if (this.ncErr[k]) this.ncErr = { ...this.ncErr, [k]: '' }; }} />`}
        ${err ? html`<div class="msg" role="alert" data-field-error=${k}>${err}</div>` : nothing}</div>`;
    };
    const ex = this.customers.find((c) => c.id === this.existingId);
    const q = this.custQ.trim();
    const list = this.customers.filter((c) => !q || c.name.includes(q) || c.customer_number.includes(q));
    return html`${this.edit ? alertBox('info', html`הלקוח של חשבון קיים לא משתנה כאן. <b>${this.account?.customer.name}</b>`) : html`<div class="seg" style="align-self:flex-start" role="group" aria-label="לקוח"><button type="button" data-cust-mode="new" aria-pressed=${this.custMode === 'new'} @click=${() => (this.custMode = 'new')}>לקוח חדש</button><button type="button" data-cust-mode="existing" aria-pressed=${this.custMode === 'existing'} @click=${() => (this.custMode = 'existing')}>לקוח קיים</button></div>`}
      ${this.edit ? nothing : this.custMode === 'existing'
        ? html`<input type="search" data-cust-search style="max-inline-size:none" aria-label="חיפוש לקוח" placeholder="חיפוש לקוח" .value=${this.custQ} @input=${(e: Event) => (this.custQ = (e.target as HTMLInputElement).value)} />
            <div class="list" role="radiogroup" aria-label="לקוח קיים" data-cust-list>${list.map((c) => html`<label class="li ${c.id === this.existingId ? 'sel' : ''}" data-cust-row=${c.id}><input type="radio" name="cust" .checked=${c.id === this.existingId} @change=${() => (this.existingId = c.id)} /><span class="ind"></span><div class="grow"><div class="t1">${c.name}</div><div class="t2">מספר לקוח ${n(c.customer_number)} · ${c.account_count} חשבונות</div></div></label>`)}
              ${!list.length ? html`<div class="mut">לא נמצא לקוח</div>` : nothing}</div>
            ${ex && ex.account_count > 0 ? alertBox('warn', html`ללקוח יש כבר ${ex.account_count} ${ex.account_count === 1 ? 'חשבון' : 'חשבונות'}. חיובים של אותו לקוח שמסתיימים באותו חודש יקבלו סיומת רצה, למשל <b class="num">${billNumber(periodContaining(elecToday(), 1, 1, 1).to, ex.customer_number, '')}/2</b>.`, 'i') : nothing}`
        : html`<div class="form">${nf('name', 'שם הלקוח', { wide: true })}${nf('customer_number', 'מספר לקוח', { ltr: true })}${nf('tax_id', 'ח.פ. / ע.מ. (לא חובה)', { ltr: true, ph: 'לא חובה' })}${nf('address', 'כתובת למשלוח החיוב', { wide: true })}${nf('phone', 'טלפון', { ltr: true })}${nf('email', 'דוא״ל', { ltr: true })}${nf('notes', 'הערות', { wide: true, ph: 'לא חובה', area: true })}</div>`}
      <div class="fld"><label for="an">שם החשבון</label><input id="an" name="account_name" data-account-name class="${this.accNameErr ? 'err' : ''}" .value=${this.accName} placeholder="למשל: סטודיו אורן - קומה 1" @input=${(e: Event) => { this.accName = (e.target as HTMLInputElement).value; this.accNameErr = ''; }} />
        ${this.accNameErr ? html`<div class="msg" role="alert" data-field-error="account_name">${this.accNameErr}</div>` : nothing}</div>`;
  }

  private renderStep6() {
    const t = this.tariff();
    const c = this.cust();
    const kwh = this.sampleKwh();
    const p = t ? this.exOf(t) : null;
    const sentenceTxt = this.tokens.map((x) => (x.t === 'm' ? this.meters.find((m) => m.id === x.id)?.name ?? '' : x.t === 'n' ? x.v + (x.pct ? '%' : '') : x.v === '*' ? '×' : x.v === '-' ? '−' : x.v)).join(' ').replace(/\( /g, '(').replace(/ \)/g, ')');
    const pt = this.settings?.payment_terms;
    const last = this.lastPeriod();
    const total = p && t ? (t.current?.price_mode === 'inc_vat' ? r2(kwh * p.inc) : r2(r2(kwh * p.ex) + r2(r2(kwh * p.ex) * p.vat))) : 0;
    const opt = (group: string, id: string, label: string, checked: boolean, on: () => void, dis = false) => html`<label class="li ${checked ? 'sel' : ''} ${dis ? 'dis' : ''}"><input type="radio" name=${group} data-opt=${id} .checked=${checked} ?disabled=${dis} @change=${on} /><span class="ind"></span><div class="grow t1">${label}</div></label>`;
    return html`<dl class="kv" data-summary><dt>מונים</dt><dd>${this.chosen().map((m) => meterNames(m).primary).join(', ')}</dd><dt>נוסחה</dt><dd>${sentenceTxt}</dd>
        <dt>מחיר</dt><dd>${t ? html`${t.name}, ${n(f4(t.current?.price ?? 0) + ' ₪')} ${t.current?.price_mode === 'inc_vat' ? 'כולל' : 'לפני'} מע״מ, מע״מ ${n(this.vat?.current?.rate_percent ?? '')}%` : ''}</dd>
        <dt>תקופה</dt><dd>${this.months === 1 ? 'חודשית' : 'דו-חודשית'}, מה-${this.anchorDay} בחודש, החל מ-${n(fmtDate(this.firstStart))}</dd>
        <dt>לקוח</dt><dd>${c.name}, מספר ${n(c.number)}</dd><dt>שם החשבון</dt><dd>${this.accName}</dd>
        <dt>תנאי תשלום</dt><dd data-payment>${pt ? (pt.mode === 'net_days' ? html`${n(pt.days)} ימים מיום ההפקה` : html`ב-${n(pt.day_of_month)} בחודש`) : '-'} <a class="lnk" href=${href.settings('business')}>שינוי בהגדרות</a></dd></dl>
      ${kwh ? html`<div class="card soft"><div class="hd"><b class="h3">לפי הנתונים של התקופה האחרונה</b></div><div class="row"><span style="font-size:22px;font-weight:700">${n(f2(kwh))}</span><span class="mut">קוט״ש</span><span class="sp"></span><span style="font-size:22px;font-weight:700">${n(f2(total) + ' ₪')}</span></div></div>` : nothing}
      <div class="fld"><span class="lbl">יצירה אוטומטית בסוף כל תקופה</span><div class="list" role="radiogroup" aria-label="יצירה אוטומטית">
        ${(['draft', 'issue', 'off'] as AutoMode[]).map((a) => opt('auto', a, AUTO_LABEL[a], this.auto === a, () => (this.auto = a)))}</div>
        ${this.auto === 'issue' ? alertBox('warn', 'החיוב יונפק ויקבל מספר בלי בדיקה שלך. אפשר לבטל או לתקן אחר כך.') : nothing}</div>
      ${this.edit ? nothing : html`<div class="fld"><span class="lbl">אחרי השמירה</span><div class="list" role="radiogroup" aria-label="אחרי השמירה">
        ${opt('after', 'draft', last ? `שמירה והפקת טיוטה ל${this.months === 1 ? monthName(last.to) : fmtRange(last.from, last.to)}` : 'שמירה והפקת טיוטה (אין עדיין תקופה שהסתיימה)', this.afterSave === 'draft' && !!last, () => (this.afterSave = 'draft'), !last)}
        ${opt('after', 'none', 'שמירה בלבד', this.afterSave === 'none' || !last, () => (this.afterSave = 'none'))}</div></div>`}
      ${this.saveErr ? alertBox('err', this.saveErr) : nothing}`;
  }

  // ---------------------------------------------------------------- tariff dialog
  private async saveTariff() {
    const f = this.tf;
    const err: Record<string, string> = {};
    if (!f.name.trim()) err.name = 'צריך לתת שם לתעריף';
    if (!(Number(f.price) > 0)) err.price = 'המחיר חייב להיות מספר גדול מאפס';
    if (!isIsoDate(f.from)) err.from = 'צריך לבחור תאריך';
    if (Object.keys(err).length) {
      this.tf = { ...f, err };
      return;
    }
    this.tf = { ...f, busy: true, error: '', err: {} };
    try {
      const t = await elec().createTariff({ name: f.name.trim(), price: f.price, price_mode: f.mode, effective_from: f.from });
      this.tariffs = [...this.tariffs, t];
      this.tariffId = t.id;
      this.tariffOpen = false;
      this.tf = { ...this.tf, name: '', price: '', busy: false };
    } catch (e) {
      this.tf = { ...this.tf, busy: false, error: elecErrorText(e), err: elecFieldErrors(e) };
    }
  }
  private renderTariffDialog() {
    const f = this.tf;
    const set = (k: 'name' | 'price' | 'from', v: string) => (this.tf = { ...this.tf, [k]: v, err: { ...this.tf.err, [k]: '' } });
    return html`<elec-dialog heading="תעריף חדש" ?open=${this.tariffOpen} data-tariff-dialog @close=${() => (this.tariffOpen = false)}>
      <div class="form">
        <div class="fld wide"><label for="tn">שם התעריף</label><input id="tn" class="${f.err.name ? 'err' : ''}" data-tariff-name .value=${f.name} @input=${(e: Event) => set('name', (e.target as HTMLInputElement).value)} />${f.err.name ? html`<div class="msg" role="alert">${f.err.name}</div>` : nothing}</div>
        <div class="fld"><label for="tp">מחיר לקוט״ש</label><div class="unit"><input id="tp" class="ltr ${f.err.price ? 'err' : ''}" data-tariff-price inputmode="decimal" .value=${f.price} @input=${(e: Event) => set('price', (e.target as HTMLInputElement).value)} /><span>₪</span></div>${f.err.price ? html`<div class="msg" role="alert">${f.err.price}</div>` : nothing}</div>
        <div class="fld"><span class="lbl">המחיר שהוזן</span><div class="seg" role="group" aria-label="סוג מחיר"><button type="button" data-tariff-mode="ex_vat" aria-pressed=${f.mode === 'ex_vat'} @click=${() => (this.tf = { ...f, mode: 'ex_vat' })}>לפני מע״מ</button><button type="button" data-tariff-mode="inc_vat" aria-pressed=${f.mode === 'inc_vat'} @click=${() => (this.tf = { ...f, mode: 'inc_vat' })}>כולל מע״מ</button></div></div>
        <div class="fld"><label for="tf">בתוקף מתאריך</label><input id="tf" type="date" class="ltr ${f.err.from ? 'err' : ''}" data-tariff-from .value=${f.from} @change=${(e: Event) => set('from', (e.target as HTMLInputElement).value)} />${f.err.from ? html`<div class="msg" role="alert">${f.err.from}</div>` : nothing}</div>
      </div>
      ${f.error ? alertBox('err', f.error) : nothing}
      <button slot="actions" type="button" class="btn pri" data-tariff-save ?disabled=${f.busy} @click=${() => void this.saveTariff()}>שמירה</button>
      <button slot="actions" type="button" class="btn" @click=${() => (this.tariffOpen = false)}>ביטול</button>
    </elec-dialog>`;
  }

  // ---------------------------------------------------------------- render
  render() {
    const perms = energyAccess();
    if (!perms.manage) return html`<div class="page" data-elec="wizard" data-state="forbidden">${stateBox('forbidden', 'lock', 'אין הרשאה לניהול חשבונות')}</div>`;
    if (this.loadSt === 'loading') return html`<div class="page" data-elec="wizard" data-state="loading">${skeleton(5)}</div>`;
    if (this.loadSt === 'error') return html`<div class="page" data-elec="wizard" data-state="error">${stateBox('error', 'warning', 'לא ניתן לטעון את האשף', { label: 'נסה שוב', run: () => void this.init() })}</div>`;
    const s = this.step;
    const body = [this.renderStep1, this.renderStep2, this.renderStep3, this.renderStep4, this.renderStep5, this.renderStep6][s - 1].call(this);
    const can = this.canNext();
    return html`<div class="page" data-elec="wizard" data-state="ready" data-step=${s}>
      <div class="row"><a class="btn ghost sm" href=${this.edit ? href.account(this.accountId) : href.accounts()} data-back>${this.edit ? '→ לחשבון' : '→ חשבונות'}</a><b class="h2">${this.edit ? 'עריכת חשבון' : 'חשבון חדש'}</b></div>
      <div class="wiz">
        <nav class="card steps" aria-label="שלבי האשף">${STEPS.map((l, i) => html`<button type="button" data-step-btn=${i + 1} class="${i + 1 === s ? 'on' : i + 1 < s ? 'done' : ''}" aria-current=${i + 1 === s ? 'step' : 'false'} ?disabled=${i + 1 > this.reached} @click=${() => this.goStep(i + 1)}><span class="n">${i + 1 < s ? '✓' : i + 1}</span>${l}</button>`)}</nav>
        <div class="card col" style="gap:14px">
          <div class="pstep"><b>שלב ${s} מתוך 6</b><span class="mut">${STEPS[s - 1]}</span><div class="bar"><i style="inline-size:${(s / 6) * 100}%"></i></div></div>
          <b class="h2 hide-phone" data-step-title>${STEPS[s - 1]}</b>
          ${body}
          <div class="wfoot">${s > 1 ? html`<button type="button" class="btn" data-prev @click=${() => (this.step = s - 1)}>הקודם</button>` : html`<span></span>`}
            ${s < 6 ? html`<button type="button" class="btn pri" data-next ?disabled=${!can} @click=${() => this.next()}>הבא</button>`
              : html`<button type="button" class="btn pri" data-save ?disabled=${this.saving || !this.accName.trim()} @click=${() => void this.save()}>${this.edit ? 'שמירת שינויים' : this.afterSave === 'draft' && this.draftPossible() ? 'שמירה והפקת טיוטה' : 'שמירה'}</button>`}</div>
        </div>
      </div>
      ${this.renderTariffDialog()}${this.renderNumberDialog()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'elec-account-wizard': ElecAccountWizard;
  }
}
