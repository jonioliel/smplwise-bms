import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../../components/sw-icon';
import '../../components/sw-sheet';
import '../../components/sw-state-panel';
import '../../electricity/elec-ui'; // elec-dialog (the electricity confirmation dialog)
import { describeError } from '../../api/client';
import { water, type Meter } from '../../api/water';
import { waterBilling, type Account, type AccountStatus, type AutoMode, type BillSummary, type Customer, type HistoryPeriod, type Tariff } from '../../api/water-billing';
import { navigate } from '../../router';
import { onWaterAccess, waterAccess, type WaterAccess } from '../../water/access';
import { waterCss } from '../../water/styles';
import { AUTO_LABEL, BILL_STATE, accountChip, astOf, fmtIls, fmtM3, periodLabel, termsOf, type Term } from '../../water/billing-format';
import { fmtDate } from '../../electricity/format';
import { wt } from '../../water/i18n';
import { SkinController } from '../../design/skin';
import { bubbleChrome } from '../../styles/bubble-chrome';
import { dateInputLang } from '../../api/day-format';

const BASE = '/infra/water/accounts';
const chip = (c: { label: string; cls: string }) => html`<span class="chip ${c.cls}">${c.label}</span>`;
export const billChipW = (b: Pick<BillSummary, 'state'>) => html`<span class="chip ${BILL_STATE[b.state].cls}" data-bill-state=${b.state}>${BILL_STATE[b.state].label}</span>`;
const range = (p: { from: string; to: string } | null) => (p ? `${fmtDate(p.from)} - ${fmtDate(p.to)}` : '-');
const skeletonCard = (n = 6) => html`<div class="card" aria-busy="true">${Array.from({ length: n }, () => html`<div class="row" style="padding:10px 0"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div>`;

interface Form {
  name: string;
  customer_id: string;
  terms: Term[];
  /** an existing formula the editor cannot show as signed terms (a share): kept unless the terms are edited */
  keepAst: unknown | null;
  tariff_id: string;
  period_months: 1 | 2;
  period_anchor_day: number;
  first_period_start: string;
  auto_mode: AutoMode;
  status: 'active' | 'paused';
}
const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => `${today().slice(0, 8)}01`;
const blank = (): Form => ({ name: '', customer_id: '', terms: [{ sign: 1, meter_id: '' }], keepAst: null, tariff_id: '', period_months: 1, period_anchor_day: 1, first_period_start: firstOfMonth(), auto_mode: 'draft', status: 'active' });

/**
 * תשתיות › מים › חשבונות (CR-WATER78 section 16): the electricity accounts (elec-account-list.ts / elec-account-page.ts) with water content -
 * the list (search, tiles, table, phone rows), one account with the tabs מצב / היסטוריה / חיובים, and the account form (a customer, a signed
 * meter formula with "+ / − מונה" and the losses preset, a tariff, a period, the automatic bill mode). Money only with water.bills (the
 * server omits the keys); creating and editing need water.manage.
 */
@customElement('water-accounts-page')
export class WaterAccountsPage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) segments: string[] = [];
  @property({ attribute: false }) params: URLSearchParams = new URLSearchParams();
  @state() private access: WaterAccess = waterAccess();
  @state() private st: 'loading' | 'ready' | 'error' = 'loading';
  @state() private rows: Account[] = [];
  @state() private drafts: number | null = null;
  @state() private statuses: Record<string, AccountStatus | null> = {};
  @state() private q = '';
  // one account
  @state() private acc: Account | null = null;
  @state() private accSt: 'loading' | 'ready' | 'error' = 'loading';
  @state() private status: AccountStatus | null = null;
  @state() private history: HistoryPeriod[] | null = null;
  @state() private bills: BillSummary[] | null = null;
  @state() private error = '';
  @state() private busy = false;
  // the form
  @state() private form: Form = blank();
  @state() private errs: Record<string, string> = {};
  @state() private customers: Customer[] = [];
  @state() private tariffs: Tariff[] = [];
  @state() private meters: Meter[] = [];
  @state() private confirmDel = false;
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
    const [a, b] = this.segments;
    const key = `${a ?? ''}/${b ?? ''}`;
    if (key === this.shown) return;
    const prevId = this.shown.split('/')[0];
    this.shown = key;
    this.error = '';
    this.errs = {};
    this.confirmDel = false;
    if (!a) void this.loadList();
    else if (a === 'new') void this.openForm(null);
    else {
      if (a !== prevId || !this.acc) void this.loadAccount(a);
      if (b === 'edit') void this.openForm(a);
      if (b === 'history' && !this.history) void this.loadHistory(a);
      if (b === 'bills' && !this.bills && this.access.bills) void this.loadBills(a);
    }
  }

  private async loadList() {
    this.st = 'loading';
    try {
      const r = await waterBilling.listAccounts();
      this.rows = r.items;
      this.drafts = r.summary.drafts;
      this.st = 'ready';
      const out: Record<string, AccountStatus | null> = {};
      await Promise.all(r.items.slice(0, 60).map(async (x) => (out[x.id] = await waterBilling.accountStatus(x.id).catch(() => null))));
      this.statuses = out;
    } catch {
      this.st = 'error';
    }
  }

  private async loadAccount(id: string) {
    this.accSt = 'loading';
    this.history = null;
    this.bills = null;
    try {
      const [a, s] = await Promise.all([waterBilling.account(id), waterBilling.accountStatus(id).catch(() => null)]);
      this.acc = a;
      this.status = s;
      this.accSt = 'ready';
      const tab = this.segments[1];
      if (tab === 'history') void this.loadHistory(id);
      if (tab === 'bills' && this.access.bills) void this.loadBills(id);
    } catch (e) {
      this.error = describeError(e);
      this.accSt = 'error';
    }
  }

  private async loadHistory(id: string) {
    try {
      this.history = (await waterBilling.accountHistory(id)).periods;
    } catch {
      this.history = [];
    }
  }

  private async loadBills(id: string) {
    try {
      this.bills = (await waterBilling.accountBills(id)).items;
    } catch {
      this.bills = [];
    }
  }

  // ---------------------------------------------------------------- the form
  private async openForm(id: string | null) {
    this.errs = {};
    this.error = '';
    if (!id) this.form = blank();
    const [c, t, m] = await Promise.all([
      waterBilling.listCustomers().then((r) => r.items).catch(() => [] as Customer[]),
      waterBilling.listTariffs().then((r) => r.items).catch(() => [] as Tariff[]),
      water.listMeters().catch(() => [] as Meter[]),
    ]);
    this.customers = c;
    this.tariffs = t;
    this.meters = m.filter((x) => x.status !== 'retired');
    if (id) {
      const a = this.acc?.id === id ? this.acc : await waterBilling.account(id).catch(() => null);
      if (a) {
        const terms = termsOf(a.formula.ast);
        this.form = {
          name: a.name, customer_id: a.customer?.id ?? '', terms: terms ?? [], keepAst: terms ? null : a.formula.ast, tariff_id: a.tariff.id, period_months: a.period_months,
          period_anchor_day: a.period_anchor_day, first_period_start: a.first_period_start, auto_mode: a.auto_mode, status: a.status,
        };
      }
    } else if (!this.form.tariff_id && t.length === 1) this.form = { ...this.form, tariff_id: t[0].id };
  }

  private setF<K extends keyof Form>(k: K, v: Form[K]) {
    this.form = { ...this.form, [k]: v };
    if (this.errs[k]) this.errs = { ...this.errs, [k]: '' };
  }

  private setTerm(i: number, t: Partial<Term>) {
    const terms = this.form.terms.map((x, j) => (j === i ? { ...x, ...t } : x));
    this.form = { ...this.form, terms, keepAst: null };
    this.errs = { ...this.errs, formula: '' };
  }

  private async lossPreset() {
    const main = this.form.terms.find((t) => t.sign > 0 && t.meter_id)?.meter_id ?? this.meters.find((m) => m.kind === 'main')?.id ?? this.meters[0]?.id;
    if (!main) return;
    try {
      const r = await waterBilling.preset('main_minus_subs', this.meters.map((m) => m.id), main);
      const terms = termsOf(r.ast);
      if (terms) this.form = { ...this.form, terms, keepAst: null, name: this.form.name || wt('accLossPreset') };
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private validate(): boolean {
    const f = this.form;
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = wt('errName');
    if (!f.customer_id) e.customer_id = wt('errCustomer');
    if (!f.keepAst && !astOf(f.terms)) e.formula = wt('errFormula');
    if (!f.tariff_id) e.tariff_id = wt('errTariff');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.first_period_start)) e.first_period_start = wt('errDate');
    this.errs = e;
    return !Object.keys(e).length;
  }

  private async save(id: string | null) {
    if (this.busy || !this.validate()) return;
    const f = this.form;
    const body: Record<string, unknown> = {
      name: f.name.trim(), customer_id: f.customer_id, tariff_id: f.tariff_id, period_months: f.period_months, period_anchor_day: f.period_anchor_day,
      first_period_start: f.first_period_start, auto_mode: f.auto_mode, ...(f.keepAst ? {} : { formula: { ast: astOf(f.terms) } }),
    };
    this.busy = true;
    this.error = '';
    try {
      if (id && this.acc) {
        const a = await waterBilling.updateAccount(id, { ...body, status: f.status, base_revision: this.acc.revision });
        this.acc = a;
        navigate(`${BASE}/${a.id}`);
        void this.loadAccount(a.id);
      } else {
        const a = await waterBilling.createAccount(body);
        navigate(`${BASE}/${a.id}`);
      }
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async removeRecord() {
    if (!this.acc || this.busy) return;
    this.busy = true;
    try {
      await waterBilling.deleteAccount(this.acc.id, this.acc.revision);
      this.acc = null;
      navigate(BASE);
    } catch (e) {
      this.error = describeError(e);
      this.confirmDel = false;
    } finally {
      this.busy = false;
    }
  }

  private fld(k: string, label: string, control: TemplateResult, wide = false) {
    return html`<div class="fld ${wide ? 'wide' : ''}"><label for="wa-${k}">${label}</label>${control}${this.errs[k] ? html`<div class="msg" role="alert" data-field-error=${k}>${this.errs[k]}</div>` : nothing}</div>`;
  }

  private renderForm(id: string | null) {
    const f = this.form;
    const meterOpts = (sel: string) => html`<option value="" ?selected=${!sel}>${wt('accPickMeter')}</option>${this.meters.map((m) => html`<option value=${m.id} ?selected=${m.id === sel}>${m.display_name}</option>`)}`;
    return html`<sw-sheet open wide .heading=${id ? wt('accFormEdit') : wt('accFormNew')} data-account-form @close=${() => navigate(id ? `${BASE}/${id}` : BASE)}>
      <div class="col">
        <div class="formgrid">
          ${this.fld('name', wt('accName'), html`<input id="wa-name" name="name" class=${this.errs.name ? 'err' : ''} .value=${f.name} @input=${(e: Event) => this.setF('name', (e.target as HTMLInputElement).value)} />`, true)}
          ${this.fld('customer_id', wt('accCustomer'), html`<select id="wa-customer_id" name="customer_id" @change=${(e: Event) => this.setF('customer_id', (e.target as HTMLSelectElement).value)}><option value="" ?selected=${!f.customer_id}>${wt('accPickCustomer')}</option>${this.customers.map((c) => html`<option value=${c.id} ?selected=${c.id === f.customer_id}>${c.name} · ${c.customer_number}</option>`)}</select>`)}
          ${this.fld('tariff_id', wt('accTariff'), html`<select id="wa-tariff_id" name="tariff_id" @change=${(e: Event) => this.setF('tariff_id', (e.target as HTMLSelectElement).value)}><option value="" ?selected=${!f.tariff_id}>-</option>${this.tariffs.map((t) => html`<option value=${t.id} ?selected=${t.id === f.tariff_id}>${t.name}</option>`)}</select>`)}
        </div>
        <div class="fld"><span class="lbl">${wt('accFormula')}</span>
          ${f.keepAst && this.acc ? html`<div class="mut" data-formula-kept>${this.acc.formula.sentence_he}</div>` : nothing}
          <div class="list" data-formula-terms>${f.terms.map((t, i) => html`<div class="row" style="flex-wrap:nowrap" data-term=${i}>
            <div class="seg" role="group" aria-label=${wt('accFormula')}><button type="button" aria-pressed=${t.sign > 0 ? 'true' : 'false'} data-sign="+" @click=${() => this.setTerm(i, { sign: 1 })}>+</button><button type="button" aria-pressed=${t.sign < 0 ? 'true' : 'false'} data-sign="-" @click=${() => this.setTerm(i, { sign: -1 })}>−</button></div>
            <select aria-label=${wt('accPickMeter')} style="flex:1" @change=${(e: Event) => this.setTerm(i, { meter_id: (e.target as HTMLSelectElement).value })}>${meterOpts(t.meter_id)}</select>
            <button type="button" class="btn ghost sm icononly" aria-label=${wt('remove')} @click=${() => (this.form = { ...this.form, terms: f.terms.filter((_, j) => j !== i), keepAst: null })}><sw-icon name="close" size="13"></sw-icon></button></div>`)}</div>
          <div class="row">
            <button type="button" class="btn sm" data-add-plus @click=${() => (this.form = { ...f, terms: [...f.terms, { sign: 1, meter_id: '' }], keepAst: null })}>${wt('accAddPlus')}</button>
            <button type="button" class="btn sm" data-add-minus @click=${() => (this.form = { ...f, terms: [...f.terms, { sign: -1, meter_id: '' }], keepAst: null })}>${wt('accAddMinus')}</button>
            <span class="sp"></span>
            <button type="button" class="btn sm" data-loss-preset ?disabled=${!this.meters.length} @click=${() => void this.lossPreset()}>${wt('accLossPreset')}</button></div>
          ${this.errs.formula ? html`<div class="msg" role="alert" data-field-error="formula">${this.errs.formula}</div>` : nothing}</div>
        <div class="formgrid">
          <div class="fld"><span class="lbl">${wt('accPeriod')}</span><div class="seg" role="group" aria-label=${wt('accPeriod')}>
            <button type="button" aria-pressed=${f.period_months === 1 ? 'true' : 'false'} @click=${() => this.setF('period_months', 1)}>${wt('accMonthly')}</button>
            <button type="button" aria-pressed=${f.period_months === 2 ? 'true' : 'false'} @click=${() => this.setF('period_months', 2)}>${wt('accBimonthly')}</button></div></div>
          ${this.fld('period_anchor_day', wt('accAnchorDay'), html`<input id="wa-period_anchor_day" type="number" min="1" max="31" class="ltr" .value=${String(f.period_anchor_day)} @input=${(e: Event) => this.setF('period_anchor_day', Math.min(31, Math.max(1, Number((e.target as HTMLInputElement).value) || 1)))} />`)}
          ${this.fld('first_period_start', wt('accFirstStart'), html`<input id="wa-first_period_start" type="date" lang=${dateInputLang()} class="ltr ${this.errs.first_period_start ? 'err' : ''}" .value=${f.first_period_start} @change=${(e: Event) => this.setF('first_period_start', (e.target as HTMLInputElement).value)} />`)}
          ${this.fld('auto_mode', wt('accAuto'), html`<select id="wa-auto_mode" @change=${(e: Event) => this.setF('auto_mode', (e.target as HTMLSelectElement).value as AutoMode)}>${(['off', 'draft', 'issue'] as AutoMode[]).map((m) => html`<option value=${m} ?selected=${m === f.auto_mode}>${AUTO_LABEL[m]}</option>`)}</select>`)}
          ${id ? html`<div class="fld"><span class="lbl">${wt('accStatus')}</span><div class="seg" role="group" aria-label=${wt('accStatus')}>
            <button type="button" aria-pressed=${f.status === 'active' ? 'true' : 'false'} @click=${() => this.setF('status', 'active')}>${wt('accActive')}</button>
            <button type="button" aria-pressed=${f.status === 'paused' ? 'true' : 'false'} @click=${() => this.setF('status', 'paused')}>${wt('accPaused')}</button></div></div>` : nothing}
        </div>
        ${this.error ? html`<div class="alert err" role="alert">${this.error}</div>` : nothing}
        <div class="row"><button type="button" class="btn pri" data-save ?disabled=${this.busy} @click=${() => void this.save(id)}>${wt('save')}</button>
          <button type="button" class="btn" @click=${() => navigate(id ? `${BASE}/${id}` : BASE)}>${wt('cancel')}</button><span class="sp"></span>
          ${id ? html`<button type="button" class="btn dng" data-delete @click=${() => (this.confirmDel = true)}>${wt('accDelete')}</button>` : nothing}</div>
      </div>
      <elec-dialog heading=${wt('accDelete')} ?open=${this.confirmDel} data-dialog="delete-account" @close=${() => (this.confirmDel = false)}>
        <div>${wt('accDeleteBody')}</div>
        <button slot="actions" type="button" class="btn dng pri" data-confirm ?disabled=${this.busy} @click=${() => void this.removeRecord()}>${wt('accDelete')}</button>
        <button slot="actions" type="button" class="btn" @click=${() => (this.confirmDel = false)}>${wt('cancel')}</button>
      </elec-dialog>
    </sw-sheet>`;
  }

  // ---------------------------------------------------------------- the list
  private renderList() {
    const money = this.access.bills;
    const q = this.q.trim();
    const rows = this.rows.filter((r) => !q || r.name.includes(q) || (r.customer?.name ?? '').includes(q));
    const head = html`<div class="row head">
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-acc-search placeholder=${wt('accSearch')} aria-label=${wt('accSearch')} .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} /></label>
      <span class="sp"></span>
      ${this.access.manage ? html`<button type="button" class="btn pri" data-new-account @click=${() => navigate(`${BASE}/new`)}><sw-icon name="plus" size="15"></sw-icon>${wt('newAccount')}</button>` : nothing}
    </div>`;
    if (this.st === 'loading') return html`<div class="page" data-water="accounts" data-state="loading">${head}${skeletonCard()}</div>`;
    if (this.st === 'error') return html`<div class="page" data-water="accounts" data-state="error"><sw-state-panel state="error" heading=${wt('loadAccountsError')} actionLabel=${wt('retry')} @action=${() => void this.loadList()}></sw-state-panel></div>`;
    if (!this.rows.length) {
      return html`<div class="page" data-water="accounts" data-state="empty"><sw-state-panel icon="drop" state="empty" heading=${wt('emptyAccounts')}>${this.access.manage ? html`<button type="button" class="btn pri" data-new-account @click=${() => navigate(`${BASE}/new`)}>${wt('newAccount')}</button>` : nothing}</sw-state-panel></div>`;
    }
    const st = this.statuses;
    const m3sum = this.rows.reduce((s, r) => s + Number(st[r.id]?.m3_so_far ?? 0), 0);
    const amt = this.rows.reduce((s, r) => s + Number(st[r.id]?.amount_so_far ?? 0), 0);
    const tiles = html`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${wt('tActiveAccounts')}</div><div class="v"><span class="num">${this.rows.filter((r) => r.status === 'active').length}</span></div></div>
      <div class="tile"><div class="k">${wt('tPeriodUsage')}</div><div class="v"><span class="num">${fmtM3(m3sum)}</span><span class="u">${wt('m3')}</span></div></div>
      ${money ? html`<div class="tile"><div class="k">${wt('tAmountSoFar')}</div><div class="v"><span class="num">${fmtIls(amt).replace(' ₪', '')}</span><span class="u">₪</span></div></div>
        <div class="tile"><div class="k">${wt('tDrafts')}</div><div class="v"><span class="num">${this.drafts ?? 0}</span></div></div>` : nothing}
    </div>`;
    const last = (r: Account) => (r.last_bill ? html`${r.last_bill.number ? html`<span class="num">${r.last_bill.number}</span>` : wt('tBillDrafts')} ${billChipW(r.last_bill)}` : html`<span class="mut">-</span>`);
    const body = !rows.length
      ? html`<sw-state-panel icon="search" state="empty" compact heading=${wt('noAccounts')}></sw-state-panel>`
      : html`<div class="card flush scrollx desk-only"><table class="t" data-acc-table>
          <thead><tr><th>${wt('colAccount')}</th><th>${wt('colCustomer')}</th><th class="hide-tablet">${wt('colFormula')}</th><th>${wt('colPeriod')}</th><th class="n">${wt('colPeriodUsage')}</th>${money ? html`<th class="n">${wt('colAmount')}</th><th>${wt('colLastBill')}</th>` : nothing}<th>${wt('colState')}</th></tr></thead>
          <tbody>${rows.map((r) => html`<tr class="go" data-account-row=${r.id} @click=${() => navigate(`${BASE}/${r.id}`)}>
            <td class="b"><a class="rowlink" href=${`#${BASE}/${r.id}`} @click=${(e: Event) => e.stopPropagation()}>${r.name}</a></td><td>${r.customer?.name ?? '-'}</td>
            <td class="mut ell hide-tablet">${r.formula.sentence_he}</td><td>${periodLabel(r.period_months, r.period_anchor_day)}</td>
            <td class="n"><span class="num">${fmtM3(st[r.id]?.m3_so_far ?? null)}</span></td>
            ${money ? html`<td class="n"><span class="num">${st[r.id]?.amount_so_far !== undefined ? fmtIls(st[r.id]?.amount_so_far) : ''}</span></td><td>${last(r)}</td>` : nothing}
            <td>${chip(accountChip(r))}</td></tr>`)}</tbody></table></div>
        <div class="list phone-only" style="flex-direction:column" data-acc-rows>${rows.map((r) => html`<a class="li" href=${`#${BASE}/${r.id}`} data-account-row=${r.id}>
          <div class="grow"><div class="t1">${r.name}</div><div class="t2">${r.customer?.name ?? ''} · <span class="num">${fmtM3(st[r.id]?.m3_so_far ?? null)}</span> ${wt('m3')}${money && st[r.id]?.amount_so_far ? html` · <span class="num">${fmtIls(st[r.id]?.amount_so_far)}</span>` : nothing}</div></div>${chip(accountChip(r))}</a>`)}</div>`;
    return html`<div class="page" data-water="accounts" data-state="ready">${head}${tiles}${body}</div>`;
  }

  // ---------------------------------------------------------------- one account
  private renderStatus(a: Account) {
    const s = this.status;
    const money = this.access.bills;
    const tiles = html`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${wt('tPeriodUsage')}</div><div class="v"><span class="num">${fmtM3(s?.m3_so_far ?? null)}</span><span class="u">${wt('m3')}</span></div></div>
      <div class="tile"><div class="k">${wt('colPeriod')}</div><div class="v"><span class="num" style="font-size:var(--sw-fs-md)">${s?.day_of_period && s.days ? wt('accDayOf', { d: s.day_of_period, n: s.days }) : '-'}</span></div></div>
      <div class="tile"><div class="k">${wt('tForecast')}</div><div class="v"><span class="num">${fmtM3(s?.m3_forecast ?? null)}</span><span class="u">${wt('m3')}</span></div></div>
      ${money ? html`<div class="tile"><div class="k">${wt('tAmountSoFar')}</div><div class="v"><span class="num">${s?.amount_so_far ? fmtIls(s.amount_so_far).replace(' ₪', '') : '-'}</span><span class="u">₪</span></div></div>` : nothing}
    </div>`;
    const meters = html`<div class="card flush scrollx" data-acc-meters><table class="t">
      <thead><tr><th>${wt('colMeter')}</th><th class="n">${wt('colStartReading')}</th><th class="n">${wt('colCurrentReading')}</th><th class="n">${wt('colUsage')}</th><th class="n">${wt('colContribution')}</th></tr></thead>
      <tbody>${(s?.meters ?? []).map((m) => html`<tr data-acc-meter=${m.meter_id}><td class="b">${Number(m.coefficient) < 0 ? '− ' : ''}${m.name}${m.reporting ? nothing : html` <span class="chip c-warn">${wt('stNotReporting')}</span>`}</td>
        <td class="n"><span class="num">${fmtM3(m.start_m3)}</span></td><td class="n"><span class="num">${fmtM3(m.current_m3)}</span></td><td class="n"><span class="num">${fmtM3(m.consumption_m3)}</span></td><td class="n"><span class="num">${fmtM3(m.contribution_m3)}</span></td></tr>`)}</tbody></table></div>`;
    const t = a.tariff;
    const side = html`<div class="col">
      <div class="card"><div class="hd"><b>${wt('customerCard')}</b></div><dl class="kv"><dt>${wt('cName')}</dt><dd>${a.customer?.name ?? '-'}</dd><dt>${wt('cNumber')}</dt><dd class="num">${a.customer?.customer_number ?? '-'}</dd>${a.customer?.address ? html`<dt>${wt('cAddress')}</dt><dd>${a.customer.address}</dd>` : nothing}</dl></div>
      <div class="card"><div class="hd"><b>${wt('priceCard')}</b></div><dl class="kv"><dt>${wt('accTariff')}</dt><dd>${t.name}</dd>
        ${money && t.water_price != null ? html`<dt>${wt('waterPrice')}</dt><dd class="num">${fmtIls(t.water_price)}</dd><dt>${wt('sewagePrice')}</dt><dd class="num">${fmtIls(t.sewage_price)}</dd><dt>${wt('colIncVat')}</dt><dd class="num">${t.price_inc_vat ? fmtIls(t.price_inc_vat) : '-'}</dd>` : nothing}
        <dt>${wt('autoMode')}</dt><dd>${AUTO_LABEL[a.auto_mode]}</dd></dl></div>
      <div class="card"><div class="hd"><b>${wt('tNextBill')}</b></div><dl class="kv"><dt>${wt('colPeriod')}</dt><dd class="num">${range(a.next_period)}</dd><dt>${wt('accPeriod')}</dt><dd>${periodLabel(a.period_months, a.period_anchor_day)}</dd></dl></div>
    </div>`;
    return html`${tiles}${(s?.stale ?? []).map((x) => html`<div class="alert warn" role="status"><span class="x" aria-hidden="true">!</span><div>${wt('staleNote', { name: x.name })}</div></div>`)}<div class="cols side"><div class="col"><div class="mut">${a.formula.sentence_he}</div>${meters}</div>${side}</div>`;
  }

  private renderHistory() {
    const h = this.history;
    if (!h) return skeletonCard(4);
    if (!h.length) return html`<sw-state-panel icon="history" state="empty" compact heading=${wt('noHistory')}></sw-state-panel>`;
    const lbl = { measured: wt('hMeasured'), partial: wt('hPartial'), missing: wt('hMissing'), open: wt('hOpen') };
    return html`<div class="card flush scrollx" data-acc-history><table class="t"><thead><tr><th>${wt('colPeriod')}</th><th class="n">${wt('colM3')}</th><th class="n">${wt('colChange')}</th><th>${wt('colState')}</th>${this.access.bills ? html`<th class="n">${wt('colSum')}</th>` : nothing}</tr></thead>
      <tbody>${h.map((p, i) => {
        const prev = h[i + 1]?.m3;
        const ch = p.m3 !== null && prev ? Math.round(((Number(p.m3) - Number(prev)) / Number(prev)) * 100) : null;
        return html`<tr><td class="num" style="text-align:start">${range(p)}</td><td class="n"><span class="num">${fmtM3(p.m3)}</span></td><td class="n ${ch === null || ch === 0 ? '' : ch > 0 ? 'up' : 'down'}"><span class="num">${ch === null ? '-' : `${ch > 0 ? '+' : ''}${ch}%`}</span></td>
          <td>${lbl[p.status]}</td>${this.access.bills ? html`<td class="n"><span class="num">${p.bill?.total ? fmtIls(p.bill.total) : '-'}</span></td>` : nothing}</tr>`;
      })}</tbody></table></div>`;
  }

  private renderBills() {
    if (!this.access.bills) return html`<sw-state-panel state="forbidden" compact></sw-state-panel>`;
    const b = this.bills;
    if (!b) return skeletonCard(4);
    if (!b.length) return html`<sw-state-panel icon="list" state="empty" compact heading=${wt('noBills')}></sw-state-panel>`;
    return billsTable(b, false);
  }

  private async createDraft(a: Account) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const b = await waterBilling.createBill(a.id);
      navigate(`/infra/water/bills/${b.id}`);
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private renderAccount(id: string, tab: string) {
    if (this.accSt === 'loading' && this.acc?.id !== id) return html`<div class="page" data-water="account" data-state="loading">${skeletonCard(5)}</div>`;
    if (this.accSt === 'error' || !this.acc) {
      return html`<div class="page" data-water="account" data-state="error"><div class="backrow"><a class="btn ghost sm" href=${`#${BASE}`}><sw-icon name="chevronBack" size="13"></sw-icon>${wt('accounts')}</a></div>
        <sw-state-panel state="error" heading=${wt('loadAccountError')} hint=${this.error} actionLabel=${wt('retry')} @action=${() => void this.loadAccount(id)}></sw-state-panel></div>`;
    }
    const a = this.acc;
    const t = tab === 'history' || tab === 'bills' ? tab : 'status';
    return html`<div class="page" data-water="account" data-state="ready" data-account-id=${a.id}>
      <div class="backrow"><a class="btn ghost sm" href=${`#${BASE}`} data-back><sw-icon name="chevronBack" size="13"></sw-icon>${wt('accounts')}</a><b class="h3">${a.name}</b>${chip(accountChip(a))}<span class="sp"></span>
        ${this.access.bills ? html`<button type="button" class="btn" data-create-bill ?disabled=${this.busy} @click=${() => void this.createDraft(a)}>${wt('createBill')}</button>` : nothing}
        ${this.access.manage ? html`<button type="button" class="btn" data-edit @click=${() => navigate(`${BASE}/${a.id}/edit`)}><sw-icon name="edit" size="14"></sw-icon>${wt('edit')}</button>` : nothing}</div>
      <div class="seg" role="group" aria-label=${wt('accounts')} data-acc-tabs style="align-self:flex-start">
        <button type="button" aria-pressed=${t === 'status' ? 'true' : 'false'} @click=${() => navigate(`${BASE}/${a.id}`)}>${wt('tabStatus')}</button>
        <button type="button" aria-pressed=${t === 'history' ? 'true' : 'false'} @click=${() => navigate(`${BASE}/${a.id}/history`)}>${wt('tabHistory')}</button>
        ${this.access.bills ? html`<button type="button" aria-pressed=${t === 'bills' ? 'true' : 'false'} @click=${() => navigate(`${BASE}/${a.id}/bills`)}>${wt('tabBills')}</button>` : nothing}</div>
      ${this.error && !this.segments.includes('edit') ? html`<div class="alert err" role="alert">${this.error}</div>` : nothing}
      ${t === 'status' ? this.renderStatus(a) : t === 'history' ? this.renderHistory() : this.renderBills()}
    </div>`;
  }

  render() {
    if (!this.access.view) return html`<sw-state-panel state="forbidden" data-water="accounts" data-state="forbidden"></sw-state-panel>`;
    const [a, b] = this.segments;
    if (!a) return this.renderList();
    if (a === 'new') return html`${this.renderList()}${this.access.manage ? this.renderForm(null) : nothing}`;
    return html`${this.renderAccount(a, b ?? '')}${b === 'edit' && this.access.manage ? this.renderForm(a) : nothing}`;
  }
}

/** The bills table of the bills page, the account page and the customer card (bills permission only). */
export function billsTable(list: BillSummary[], phone: boolean): TemplateResult {
  const go = (b: BillSummary) => navigate(`/infra/water/bills/${b.id}`);
  return html`<div class="card flush scrollx ${phone ? '' : 'desk-only'}"><table class="t" data-bill-table>
      <thead><tr><th>${wt('colNumber')}</th><th>${wt('colCustomer')}</th><th>${wt('colAccount')}</th><th>${wt('colPeriod')}</th><th class="n">${wt('colM3')}</th><th class="n">${wt('colTotal')}</th><th>${wt('colDue')}</th><th>${wt('colState')}</th></tr></thead>
      <tbody>${list.map((b) => html`<tr class="go" data-bill-row=${b.id} @click=${() => go(b)}>
        <td class="b"><a class="rowlink num" href=${`#/infra/water/bills/${b.id}`} @click=${(e: Event) => e.stopPropagation()}>${b.number ?? wt('tBillDrafts')}</a></td><td>${b.customer.name ?? '-'}</td><td>${b.account_name}</td>
        <td class="num" style="text-align:start">${range(b.period)}</td><td class="n"><span class="num">${fmtM3(b.m3)}</span></td><td class="n"><span class="num">${b.total !== undefined ? fmtIls(b.total) : ''}</span></td>
        <td class="num" style="text-align:start">${b.due_date ? fmtDate(b.due_date) : '-'}</td><td>${billChipW(b)}</td></tr>`)}</tbody></table></div>
    ${phone ? nothing : html`<div class="list phone-only" style="flex-direction:column" data-bill-rows>${list.map((b) => html`<a class="li" href=${`#/infra/water/bills/${b.id}`} data-bill-row=${b.id}>
      <div class="grow"><div class="t1"><span class="num">${b.number ?? wt('tBillDrafts')}</span> · ${b.customer.name ?? ''}</div><div class="t2">${b.account_name} · <span class="num">${range(b.period)}</span> · <span class="num">${fmtM3(b.m3)}</span> ${wt('m3')}</div></div>
      <div style="text-align:end">${billChipW(b)}<div class="t2 num" style="margin-block-start:4px">${b.total !== undefined ? fmtIls(b.total) : ''}</div></div></a>`)}</div>`}`;
}

declare global {
  interface HTMLElementTagNameMap {
    'water-accounts-page': WaterAccountsPage;
  }
}
