/**
 * CR-023 §7 / §15 / owner decisions 4 and 6 (mockup "הגדרות › תשתיות › חשמל"): the two sections of the billing settings this half
 * owns - <elec-settings-prices> (the fixed price per kWh with versions and the before / including-VAT choice, the separate VAT-rate
 * setting with its history, the default entry mode) and <elec-settings-business> (business details, the logo, the accent colour,
 * the fixed note, the bill numbering, the payment terms - days after issue or a fixed day of the month -, and the automatic
 * generation delay), with a live preview of the bill header. Holders of the manage permission edit; others read (bills) or see
 * the forbidden state.
 */
import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { recommendedColors } from '../design/palette';
import { elec, elecErrorText, elecFieldErrors, elecPerms, elecToday, type BillSnapshot, type BillingSettings, type PaymentTerms, type PriceMode, type Tariff, type VatRates } from '../api/electricity-billing';
import { ElecBase, alertBox, n, skeleton, stateBox, type LoadState } from './elec-ui';
import './elec-bill-paper';
import { addDays, f4, fmtDate, isIsoDate } from './elec-format';

const NUM = /^\d+(\.\d+)?$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const lum = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

// ================================================================================================ prices
@customElement('elec-settings-prices')
export class ElecSettingsPrices extends ElecBase {
  @state() private st: LoadState = 'loading';
  @state() private tariffs: Tariff[] = [];
  @state() private vat: VatRates | null = null;
  @state() private settings: BillingSettings | null = null;
  @state() private tOpen = false;
  @state() private tEdit: Tariff | null = null;
  @state() private tf = { name: '', price: '', mode: 'ex_vat' as PriceMode, from: '' };
  @state() private tErr: Record<string, string> = {};
  @state() private vOpen = false;
  @state() private vf = { rate: '', from: '' };
  @state() private vErr: Record<string, string> = {};
  @state() private busy = false;
  @state() private error = '';

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }
  private async load() {
    this.st = 'loading';
    try {
      const b = elec();
      [this.tariffs, this.vat, this.settings] = await Promise.all([b.listTariffs(), b.getVat(), b.getSettings().catch(() => null)]);
      this.st = 'ready';
    } catch (e) {
      this.st = /הרשאה/.test(elecErrorText(e)) ? 'forbidden' : 'error';
    }
  }

  private rate(): number {
    return this.vat?.current ? Number(this.vat.current.rate_percent) / 100 : 0;
  }
  private derived(price: string, mode: PriceMode): { ex: number; vat: number; inc: number } {
    const p = Number(price) || 0;
    const r = this.rate();
    return mode === 'ex_vat' ? { ex: p, vat: p * r, inc: p * (1 + r) } : { ex: p / (1 + r), vat: p - p / (1 + r), inc: p };
  }

  private openTariff(t: Tariff | null) {
    this.tEdit = t;
    this.tf = t?.current ? { name: t.name, price: t.current.price, mode: t.current.price_mode, from: elecToday() } : { name: '', price: '', mode: this.settings?.default_price_mode ?? 'ex_vat', from: elecToday() };
    this.tErr = {};
    this.error = '';
    this.tOpen = true;
  }
  private async saveTariff() {
    const f = this.tf;
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'צריך לתת שם לתעריף';
    if (!NUM.test(f.price) || Number(f.price) <= 0) e.price = 'המחיר חייב להיות מספר גדול מאפס';
    if (!isIsoDate(f.from)) e.from = 'צריך לבחור תאריך';
    this.tErr = e;
    if (Object.keys(e).length || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const body = { name: f.name.trim(), price: f.price, price_mode: f.mode, effective_from: f.from };
      if (this.tEdit) await elec().addTariffVersion(this.tEdit.id, body);
      else await elec().createTariff(body);
      this.tOpen = false;
      this.tariffs = await elec().listTariffs();
    } catch (er) {
      const fe = elecFieldErrors(er);
      if (Object.keys(fe).length) this.tErr = fe;
      else this.error = elecErrorText(er);
    } finally {
      this.busy = false;
    }
  }
  private async saveVat() {
    const e: Record<string, string> = {};
    if (!NUM.test(this.vf.rate) || Number(this.vf.rate) > 50) e.rate_percent = 'שיעור המע״מ חייב להיות בין 0 ל-50';
    if (!isIsoDate(this.vf.from)) e.effective_from = 'צריך לבחור תאריך';
    this.vErr = e;
    if (Object.keys(e).length || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      this.vat = await elec().addVat(this.vf.rate, this.vf.from);
      this.vOpen = false;
    } catch (er) {
      const fe = elecFieldErrors(er);
      if (Object.keys(fe).length) this.vErr = fe;
      else this.error = elecErrorText(er);
    } finally {
      this.busy = false;
    }
  }
  private async setMode(m: PriceMode) {
    if (!this.settings || !elecPerms().manage || this.settings.default_price_mode === m) return;
    try {
      this.settings = await elec().saveSettings(this.settings.revision, { default_price_mode: m });
      this.error = '';
    } catch (e) {
      this.error = elecErrorText(e);
    }
  }

  render() {
    const perms = elecPerms();
    if (!perms.bills && !perms.manage) return html`<div class="page" data-elec="settings-prices" data-state="forbidden">${stateBox('forbidden', 'lock', 'אין הרשאה למחירים')}</div>`;
    if (this.st === 'loading') return html`<div class="page" data-elec="settings-prices" data-state="loading">${skeleton(4)}</div>`;
    if (this.st === 'forbidden') return html`<div class="page" data-elec="settings-prices" data-state="forbidden">${stateBox('forbidden', 'lock', 'אין הרשאה למחירים')}</div>`;
    if (this.st === 'error') return html`<div class="page" data-elec="settings-prices" data-state="error">${stateBox('error', 'warning', 'לא ניתן לטעון את המחירים', { label: 'נסה שוב', run: () => void this.load() })}</div>`;
    const cur = this.vat?.current;
    const vh = (this.vat?.items ?? []).slice().sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
    const edit = perms.manage;
    const d = this.derived(this.tf.price, this.tf.mode);
    const mode = this.settings?.default_price_mode ?? 'ex_vat';
    return html`<div class="page" data-elec="settings-prices" data-state="ready">
      ${this.error && !this.tOpen && !this.vOpen ? alertBox('err', this.error) : nothing}
      ${!cur ? alertBox('warn', 'לא הוגדר שיעור מע״מ. בלי שיעור אי אפשר להפיק חיובים.') : nothing}
      <div class="cols side-l">
        <div class="card ${this.phone ? '' : 'flush'}"><div class="hd"><b class="h3">תעריפים</b><span class="sp"></span>${edit ? html`<button type="button" class="btn pri sm" data-new-tariff @click=${() => this.openTariff(null)}>+ תעריף</button>` : nothing}</div>
          ${!this.tariffs.length ? stateBox('empty', 'bolt', 'אין תעריפים עדיין', edit ? { label: '+ תעריף', primary: true, run: () => this.openTariff(null) } : undefined)
            : this.phone
              ? html`<div class="list" data-tariffs>${this.tariffs.map((t) => html`<button type="button" class="li" data-tariff-row=${t.id} ?disabled=${!edit} @click=${() => edit && this.openTariff(t)}><div class="grow"><div class="t1">${t.name}</div><div class="t2">הוזן ${t.current?.price_mode === 'inc_vat' ? 'כולל' : 'לפני'} מע״מ · מ-${n(fmtDate(t.current?.effective_from ?? ''))}</div></div><b class="num">${f4(t.current?.price ?? 0)} ₪</b></button>`)}</div>`
              : html`<div class="scrollx"><table class="t" data-tariffs><thead><tr><th>שם</th><th class="num">מחיר שהוזן</th><th>הוזן</th><th class="num">לפני מע״מ</th><th class="num">כולל מע״מ</th><th>בתוקף מ</th><th>חשבונות</th></tr></thead><tbody>
                ${this.tariffs.map((t) => { const x = this.derived(t.current?.price ?? '0', t.current?.price_mode ?? 'ex_vat'); return html`<tr class="${edit ? 'go' : ''}" data-tariff-row=${t.id} @click=${() => edit && this.openTariff(t)}><td class="b">${t.name}</td><td class="num">${f4(t.current?.price ?? 0)} ₪</td><td>${t.current?.price_mode === 'inc_vat' ? 'כולל מע״מ' : 'לפני מע״מ'}</td><td class="num">${f4(x.ex)} ₪</td><td class="num">${f4(x.inc)} ₪</td><td class="num" style="text-align:start">${fmtDate(t.current?.effective_from ?? '')}</td><td>${t.used_by}</td></tr>`; })}</tbody></table></div>`}
        </div>
        <div class="col">
          <div class="card" data-card="vat"><div class="hd"><b class="h3">שיעור מע״מ</b><span class="sp"></span>${edit ? html`<button type="button" class="btn sm" data-new-vat @click=${() => { this.vf = { rate: '', from: elecToday() }; this.vErr = {}; this.error = ''; this.vOpen = true; }}>+ שיעור חדש</button>` : nothing}</div>
            ${cur ? html`<div class="row" style="align-items:baseline"><span style="font-size:28px;font-weight:700" data-vat-rate>${n(cur.rate_percent + '%')}</span><span class="mut">מ-${n(fmtDate(cur.effective_from))}</span></div>` : html`<div class="mut">לא הוגדר</div>`}
            ${vh.slice(1).map((v, i) => html`<div class="ver" style="margin-block-start:8px"><span class="num">${v.rate_percent}%</span><span>עד ${n(fmtDate(addDays(vh[i].effective_from, -1)))}</span></div>`)}</div>
          <div class="card" data-card="mode"><div class="hd"><b class="h3">ברירת מחדל להזנת מחיר</b></div><div class="list" role="radiogroup" aria-label="ברירת מחדל להזנת מחיר">
            ${(['ex_vat', 'inc_vat'] as PriceMode[]).map((m) => html`<label class="li ${mode === m ? 'sel' : ''}"><input type="radio" name="mode" data-default-mode=${m} .checked=${mode === m} ?disabled=${!edit} @change=${() => void this.setMode(m)} /><span class="ind"></span><div class="grow t1">${m === 'ex_vat' ? 'לפני מע״מ' : 'כולל מע״מ'}</div></label>`)}</div></div>
        </div>
      </div>
      <elec-dialog heading=${this.tEdit ? 'עריכת תעריף' : 'תעריף חדש'} ?open=${this.tOpen} data-dialog="tariff" @close=${() => (this.tOpen = false)}>
        <div class="form">
          <div class="fld wide"><label for="tn">שם התעריף</label><input id="tn" class="${this.tErr.name ? 'err' : ''}" data-tariff-name .value=${this.tf.name} @input=${(e: Event) => (this.tf = { ...this.tf, name: (e.target as HTMLInputElement).value })} />${this.tErr.name ? html`<div class="msg" role="alert">${this.tErr.name}</div>` : nothing}</div>
          <div class="fld"><label for="tp">מחיר לקוט״ש</label><div class="unit"><input id="tp" class="ltr ${this.tErr.price ? 'err' : ''}" data-tariff-price inputmode="decimal" .value=${this.tf.price} @input=${(e: Event) => (this.tf = { ...this.tf, price: (e.target as HTMLInputElement).value })} /><span>₪</span></div>${this.tErr.price ? html`<div class="msg" role="alert">${this.tErr.price}</div>` : nothing}</div>
          <div class="fld"><span class="lbl">המחיר שהוזן</span><div class="seg" role="group" aria-label="סוג מחיר"><button type="button" data-tariff-mode="ex_vat" aria-pressed=${this.tf.mode === 'ex_vat'} @click=${() => (this.tf = { ...this.tf, mode: 'ex_vat' })}>לפני מע״מ</button><button type="button" data-tariff-mode="inc_vat" aria-pressed=${this.tf.mode === 'inc_vat'} @click=${() => (this.tf = { ...this.tf, mode: 'inc_vat' })}>כולל מע״מ</button></div></div>
          <div class="fld"><label for="tf">בתוקף מתאריך</label><input id="tf" type="date" class="ltr ${this.tErr.effective_from ? 'err' : ''}" data-tariff-from .value=${this.tf.from} @change=${(e: Event) => (this.tf = { ...this.tf, from: (e.target as HTMLInputElement).value })} />${this.tErr.effective_from ? html`<div class="msg" role="alert">${this.tErr.effective_from}</div>` : nothing}</div>
        </div>
        ${cur ? html`<div class="card soft" data-tariff-derived><dl class="kv"><dt>לפני מע״מ</dt><dd>${n(f4(d.ex) + ' ₪')}</dd><dt>מע״מ ${n(cur.rate_percent + '%')}</dt><dd>${n(f4(d.vat) + ' ₪')}</dd><dt>כולל מע״מ</dt><dd>${n(f4(d.inc) + ' ₪')}</dd></dl></div>` : nothing}
        ${this.tEdit && this.tEdit.versions.length ? html`<b class="h3">גרסאות</b><div class="list" data-tariff-versions>${this.tEdit.versions.map((v) => html`<div class="ver"><span class="num">${f4(v.price)} ₪</span><span>${v.price_mode === 'inc_vat' ? 'כולל מע״מ' : 'לפני מע״מ'} · מ-${n(fmtDate(v.effective_from))}</span></div>`)}</div>` : nothing}
        ${this.error ? alertBox('err', this.error) : nothing}
        <button slot="actions" type="button" class="btn pri" data-save ?disabled=${this.busy} @click=${() => void this.saveTariff()}>שמירה</button>
        <button slot="actions" type="button" class="btn" @click=${() => (this.tOpen = false)}>ביטול</button>
      </elec-dialog>
      <elec-dialog heading="שיעור מע״מ חדש" ?open=${this.vOpen} data-dialog="vat" @close=${() => (this.vOpen = false)}>
        <div class="form">
          <div class="fld"><label for="vr">שיעור</label><div class="unit"><input id="vr" class="ltr ${this.vErr.rate_percent ? 'err' : ''}" data-vat-input inputmode="decimal" .value=${this.vf.rate} @input=${(e: Event) => (this.vf = { ...this.vf, rate: (e.target as HTMLInputElement).value })} /><span>%</span></div>${this.vErr.rate_percent ? html`<div class="msg" role="alert">${this.vErr.rate_percent}</div>` : nothing}</div>
          <div class="fld"><label for="vf">בתוקף מתאריך</label><input id="vf" type="date" class="ltr ${this.vErr.effective_from ? 'err' : ''}" data-vat-from .value=${this.vf.from} @change=${(e: Event) => (this.vf = { ...this.vf, from: (e.target as HTMLInputElement).value })} />${this.vErr.effective_from ? html`<div class="msg" role="alert">${this.vErr.effective_from}</div>` : nothing}</div>
        </div>
        ${this.error ? alertBox('err', this.error) : nothing}
        <button slot="actions" type="button" class="btn pri" data-save ?disabled=${this.busy} @click=${() => void this.saveVat()}>שמירה</button>
        <button slot="actions" type="button" class="btn" @click=${() => (this.vOpen = false)}>ביטול</button>
      </elec-dialog>
    </div>`;
  }
}

// ================================================================================================ business
function sample(b: BillingSettings['business'], terms: PaymentTerms, hasLogo: boolean): BillSnapshot {
  const today = elecToday();
  return {
    schema: 'arx.energy.bill_snapshot/1',
    doc: { title_he: 'חשבון צריכת חשמל ודרישת תשלום', subtitle_he: 'אינו חשבונית מס', is_tax_invoice: false },
    bill: { id: '', number: '2026-09-0001', revision: 1, replaces: null, state: 'issued', issue_date: today, due_date: terms.mode === 'net_days' ? addDays(today, terms.days) : `${today.slice(0, 7)}-${String(terms.day_of_month).padStart(2, '0')}`, expected_due_date: null, payment_terms: { mode: terms.mode, days: terms.days, day_of_month: terms.day_of_month } },
    period: { from: '2026-09-01', to: '2026-09-30', days: 30 },
    business: { ...b, logo: hasLogo ? { sha256: 'x', mime: 'image/png' } : null },
    customer: { id: 'c', customer_number: '0001', name: 'לקוח לדוגמה', address: 'רחוב הדוגמה 12, עיר לדוגמה', phone: '', email: '', tax_id: '' },
    account: { id: 'a', name: 'חשבון לדוגמה', tariff: { id: 't', name: 'תעריף' }, formula: { text: '[מונה]', sentence_he: 'מונה לדוגמה' } },
    meters: [{ meter_id: 'm', name: 'מונה לדוגמה', coefficient: '1', start: { at: '2026-09-01T00:00:00Z', reading_kwh: '1000.00', kind: 'reading' }, end: { at: '2026-09-30T23:59:00Z', reading_kwh: '1776.20', kind: 'reading' }, consumption_kwh: '776.20', contribution_kwh: '776.20' }],
    lines: [{ from: '2026-09-01', to: '2026-09-30', kwh: '776.20', price_entered: '0.5430', price_mode: 'ex_vat', unit_price_ex_vat: '0.5430', amount_ex_vat: '421.48', vat_rate_percent: '18', vat_amount: '75.87', total: '497.35' }],
    totals: { currency: 'ILS', kwh: '776.20', amount_ex_vat: '421.48', vat_amount: '75.87', total: '497.35', vat_breakdown: [{ rate_percent: '18', base: '421.48', vat: '75.87' }], price_mode_note_he: null },
    notes: [],
    history: { current: null, previous: [], same_period_last_year: null },
    meta: { software_version: '', computed_at: '' },
  };
}

@customElement('elec-settings-business')
export class ElecSettingsBusiness extends ElecBase {
  @state() private st: LoadState = 'loading';
  @state() private s: BillingSettings | null = null;
  @state() private biz = { name: '', registration_no: '', address: '', phone: '', email: '', accent_color: '#2767ed', footer_note: '' };
  @state() private terms: PaymentTerms = { mode: 'net_days', days: 14, day_of_month: 15 };
  @state() private delay = '6';
  @state() private errs: Record<string, string> = {};
  @state() private busy = false;
  @state() private error = '';
  @state() private ok = false;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }
  private async load() {
    this.st = 'loading';
    try {
      this.apply(await elec().getSettings());
      this.st = 'ready';
    } catch (e) {
      this.st = /הרשאה/.test(elecErrorText(e)) ? 'forbidden' : 'error';
    }
  }
  private apply(s: BillingSettings) {
    this.s = s;
    this.biz = { ...s.business };
    this.terms = { ...s.payment_terms };
    this.delay = String(s.auto.delay_hours);
  }

  private validate(): boolean {
    const e: Record<string, string> = {};
    if (this.biz.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.biz.email)) e.email = 'כתובת דוא״ל לא תקינה';
    if (!HEX.test(this.biz.accent_color)) e.accent_color = 'צבע לא תקין';
    else if (lum(this.biz.accent_color) > 0.6) e.accent_color = 'הצבע בהיר מדי להדפסה';
    if (this.terms.mode === 'net_days' && !(Number.isInteger(this.terms.days) && this.terms.days >= 0 && this.terms.days <= 120)) e.days = 'מספר הימים חייב להיות בין 0 ל-120';
    if (this.terms.mode === 'day_of_month' && !(Number.isInteger(this.terms.day_of_month) && this.terms.day_of_month >= 1 && this.terms.day_of_month <= 31)) e.day_of_month = 'היום בחודש חייב להיות בין 1 ל-31';
    if (!/^\d+$/.test(this.delay) || Number(this.delay) > 72) e.delay_hours = 'ההשהיה חייבת להיות בין 0 ל-72 שעות';
    this.errs = e;
    return !Object.keys(e).length;
  }
  private async save() {
    if (!this.s || this.busy || !this.validate()) return;
    this.busy = true;
    this.error = '';
    this.ok = false;
    try {
      this.apply(await elec().saveSettings(this.s.revision, { business: this.biz, payment_terms: this.terms, auto: { delay_hours: Number(this.delay) } }));
      this.ok = true;
    } catch (e) {
      const fe = elecFieldErrors(e);
      if (Object.keys(fe).length) this.errs = fe;
      else this.error = elecErrorText(e);
    } finally {
      this.busy = false;
    }
  }
  private async logo(file: File | undefined) {
    if (!file) return;
    this.error = '';
    if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > 1024 * 1024) {
      this.error = 'הלוגו חייב להיות PNG או JPEG עד 1MB.';
      return;
    }
    try {
      await elec().uploadLogo(file);
      this.apply(await elec().getSettings());
    } catch (e) {
      this.error = elecErrorText(e);
    }
  }
  private async removeLogo() {
    try {
      await elec().removeLogo();
      this.apply(await elec().getSettings());
    } catch (e) {
      this.error = elecErrorText(e);
    }
  }

  private fld(k: keyof BillingSettings['business'], label: string, o: { wide?: boolean; ltr?: boolean; ro?: boolean; area?: boolean } = {}) {
    const err = this.errs[k];
    return html`<div class="fld ${o.wide ? 'wide' : ''}"><label for="b-${k}">${label}</label>
      ${o.area
        ? html`<textarea id="b-${k}" name=${k} .value=${this.biz[k]} @input=${(e: Event) => (this.biz = { ...this.biz, [k]: (e.target as HTMLTextAreaElement).value })}></textarea>`
        : html`<input id="b-${k}" name=${k} class="${o.ltr ? 'ltr' : ''} ${err ? 'err' : ''}" aria-invalid=${err ? 'true' : 'false'} .value=${this.biz[k]} @input=${(e: Event) => { this.biz = { ...this.biz, [k]: (e.target as HTMLInputElement).value }; this.errs = { ...this.errs, [k]: '' }; }} />`}
      ${err ? html`<div class="msg" role="alert" data-field-error=${k}>${err}</div>` : nothing}</div>`;
  }

  render() {
    const perms = elecPerms();
    if (!perms.bills && !perms.manage) return html`<div class="page" data-elec="settings-business" data-state="forbidden">${stateBox('forbidden', 'lock', 'אין הרשאה לפרטי העסק')}</div>`;
    if (this.st === 'loading') return html`<div class="page" data-elec="settings-business" data-state="loading">${skeleton(4)}</div>`;
    if (this.st === 'forbidden') return html`<div class="page" data-elec="settings-business" data-state="forbidden">${stateBox('forbidden', 'lock', 'אין הרשאה לפרטי העסק')}</div>`;
    if (this.st === 'error' || !this.s) return html`<div class="page" data-elec="settings-business" data-state="error">${stateBox('error', 'warning', 'לא ניתן לטעון את ההגדרות', { label: 'נסה שוב', run: () => void this.load() })}</div>`;
    const edit = perms.manage;
    const s = this.s;
    const logoSrc = s.logo ? elec().logoUrl(s.logo.sha256) : '';
    const swatches = recommendedColors('accent', 'light', 8);
    const t = this.terms;
    return html`<div class="page" data-elec="settings-business" data-state="ready">
      <div class="cols side-l"><div class="card" style="min-inline-size:0"><fieldset style="border:0;margin:0;padding:0;min-inline-size:0" ?disabled=${!edit}><div class="form">
        <div class="fld wide"><span class="lbl">לוגו</span><div class="row">
          <div class="chip c-mut nodot" style="inline-size:96px;block-size:96px;padding:0;justify-content:center;border-radius:14px;overflow:hidden" data-logo>${logoSrc ? html`<img src=${logoSrc} alt="לוגו" style="max-inline-size:100%;max-block-size:100%" />` : html`<span class="mut">אין לוגו</span>`}</div>
          <div><label class="btn" style="cursor:pointer">${s.logo ? 'החלפה' : 'העלאת לוגו'}<input type="file" accept="image/png,image/jpeg" data-logo-input style="position:absolute;inline-size:1px;block-size:1px;opacity:0" @change=${(e: Event) => void this.logo((e.target as HTMLInputElement).files?.[0])} /></label>
            ${s.logo ? html` <button type="button" class="btn ghost" data-logo-remove @click=${() => void this.removeLogo()}>הסרה</button>` : nothing}<div class="mut" style="margin-block-start:6px">PNG או JPEG, עד 1MB</div></div></div></div>
        ${this.fld('name', 'שם העסק', { wide: true })}${this.fld('registration_no', 'ח.פ. / ע.מ.', { ltr: true })}${this.fld('phone', 'טלפון', { ltr: true })}${this.fld('address', 'כתובת', { wide: true })}${this.fld('email', 'דוא״ל', { ltr: true })}
        <div class="fld"><span class="lbl" id="acc">צבע המותג</span><div class="row" role="group" aria-labelledby="acc" data-accent>
          ${swatches.map((c) => html`<button type="button" class="tok swatch" data-swatch=${c} aria-label=${`צבע ${c}`} aria-pressed=${this.biz.accent_color.toLowerCase() === c} style="background:${c};border:2px solid ${this.biz.accent_color.toLowerCase() === c ? 'var(--sw-text)' : 'transparent'}" @click=${() => (this.biz = { ...this.biz, accent_color: c })}></button>`)}
          <input type="color" data-accent-color aria-label="בחירה חופשית של צבע" .value=${HEX.test(this.biz.accent_color) ? this.biz.accent_color : '#2767ed'} @input=${(e: Event) => (this.biz = { ...this.biz, accent_color: (e.target as HTMLInputElement).value })} /></div>
          ${this.errs.accent_color ? html`<div class="msg" role="alert" data-field-error="accent_color">${this.errs.accent_color}</div>` : nothing}</div>
        ${this.fld('footer_note', 'הערה קבועה בתחתית החיוב', { wide: true, area: true })}
        <div class="fld wide"><span class="lbl">מספור חיובים</span><div class="row" data-numbering style="padding:8px 12px;border:1px solid var(--sw-border-strong);border-radius:var(--sw-r-sm)"><span class="num">${s.numbering.format}</span><span class="sp"></span><span class="mut">שנה-חודש-מספר לקוח, למשל ${n('2026-12-0001')}</span></div></div>
        <div class="fld wide"><span class="lbl" id="pt">תנאי תשלום</span><div class="row"><div class="seg" role="group" aria-labelledby="pt"><button type="button" data-terms="net_days" aria-pressed=${t.mode === 'net_days'} @click=${() => (this.terms = { ...t, mode: 'net_days' })}>ימים מיום ההפקה</button><button type="button" data-terms="day_of_month" aria-pressed=${t.mode === 'day_of_month'} @click=${() => (this.terms = { ...t, mode: 'day_of_month' })}>יום קבוע בחודש</button></div>
          ${t.mode === 'net_days'
            ? html`<div class="unit"><input class="ltr" data-days type="number" min="0" max="120" aria-label="ימים לתשלום" style="inline-size:90px" .value=${String(t.days)} @input=${(e: Event) => (this.terms = { ...t, days: Number((e.target as HTMLInputElement).value) })} /><span>ימים</span></div>`
            : html`<div class="unit"><input class="ltr" data-day-of-month type="number" min="1" max="31" aria-label="יום בחודש" style="inline-size:90px" .value=${String(t.day_of_month)} @input=${(e: Event) => (this.terms = { ...t, day_of_month: Number((e.target as HTMLInputElement).value) })} /><span>בחודש</span></div>`}</div>
          ${this.errs.days || this.errs.day_of_month ? html`<div class="msg" role="alert" data-field-error="terms">${this.errs.days || this.errs.day_of_month}</div>` : nothing}</div>
        <div class="fld wide"><label for="dl">יצירת טיוטה אוטומטית</label><div class="unit"><input id="dl" class="ltr ${this.errs.delay_hours ? 'err' : ''}" data-delay type="number" min="0" max="72" style="inline-size:90px" .value=${this.delay} @input=${(e: Event) => (this.delay = (e.target as HTMLInputElement).value)} /><span>שעות אחרי סוף התקופה</span></div>${this.errs.delay_hours ? html`<div class="msg" role="alert" data-field-error="delay_hours">${this.errs.delay_hours}</div>` : nothing}</div>
      </div></fieldset>
      ${this.error ? alertBox('err', this.error) : nothing}${this.ok ? alertBox('ok', 'ההגדרות נשמרו') : nothing}
      ${edit ? html`<div class="row" style="margin-block-start:14px"><button type="button" class="btn pri" data-save ?disabled=${this.busy} @click=${() => void this.save()}>שמירה</button></div>` : nothing}</div>
      <div class="card"><div class="hd"><b class="h3">תצוגה מקדימה</b></div><div style="overflow:hidden;max-block-size:320px;border-radius:8px" data-preview><elec-bill-paper .snapshot=${sample(this.biz, t, !!s.logo)} .logo=${logoSrc} hash=""></elec-bill-paper></div></div></div>
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'elec-settings-prices': ElecSettingsPrices;
    'elec-settings-business': ElecSettingsBusiness;
  }
}
