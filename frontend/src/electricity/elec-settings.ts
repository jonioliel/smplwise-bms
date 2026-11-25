/**
 * CR-023 §7 / §15 / owner decisions 4 and 6 (mockup "הגדרות › תשתיות › חשמל"): the two sections of the billing settings this half
 * owns - <elec-settings-prices> (the fixed price per kWh with versions and the before / including-VAT choice, the separate VAT-rate
 * setting with its history, the default entry mode) and <elec-settings-business> (business details, the logo, the accent colour,
 * the fixed note, the bill numbering, the payment terms - days after issue or a fixed day of the month -, and the automatic
 * generation delay), with a live preview of the bill header. Holders of the manage permission edit; others read (bills) or see
 * the forbidden state.
 */
import { html, nothing } from 'lit';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-segmented';
import type { SegmentedChange } from '../components/sw-segmented';
import { customElement, state } from 'lit/decorators.js';
import { recommendedColors } from '../design/palette';
import { problemsOf } from '../api/client';
import { elec, elecErrorText, elecFieldErrors, elecForbidden, elecToday, type BillSnapshot, type BillingSettings, type PaymentTerms, type PriceMode, type Tariff, type TariffKind, type TariffVersion, type TariffVersionPlan, type VatRates } from '../api/electricity-billing';
import { energyAccess } from './access';
import { ElecBase, alertBox, n, skeleton, stateBox, type LoadState } from './elec-ui';
import './elec-bill-paper';
import './elec-tou-editor';
import { addDays, f4, fmtDate, isIsoDate } from './elec-format';
import { cloneDef, heOrEn, israelTemplate, type TouDefinition, touName } from './elec-tou';
import { dateInputLang } from '../api/day-format';
import { tr } from '../i18n/msg/electricity';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';

const NUM = /^\d+(\.\d+)?$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const lum = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

/** EL5: one line about a time-of-use tariff for the list ("2 פסים · 3 עונות"). */
function touSummary(t: Tariff): string {
  const d = t.current?.definition;
  return d ? `${d.bands.map((b) => touName('bands', b, t.current?.names_en)).join(' / ')} · ${tr('{n} עונות', { n: d.seasons.length })}` : tr('לפי שעות');
}

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
  /** The price version being corrected (null = a new price). */
  @state() private tVer: TariffVersion | null = null;
  /** The plan the server returned for a correction; shown for one confirmation. */
  @state() private tPlan: TariffVersionPlan | null = null;
  /** EL5: a fixed price or a time-of-use tariff (chosen when the tariff is created; one kind per tariff) */
  @state() private tKind: TariffKind = 'fixed';
  @state() private tDef: TouDefinition | null = null;
  /** the path of the server's first error in the time-of-use definition */
  @state() private tErrPath = '';
  @state() private tSource = '';
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
      this.st = elecForbidden(e) ? 'forbidden' : 'error';
    }
  }

  private rate(): number {
    return this.vat?.current ? Number(this.vat.current.rate_percent) / 100 : 0;
  }
  /** CR-CMP2-TABLES-CONSUMPTION-2450 (owner N10): the tariffs as the shared sw-table (bare in the card; row hooks `data-tariff-row` +
   * `data-kind`): a manager opens a tariff from its row (click, Enter / Space - the rows are tab stops now); a viewer's rows are
   * read-only. A time-of-use tariff shows its summary where a fixed one shows its price. */
  private tariffColumns(): TableColumn<Tariff>[] {
    const mode = (t: Tariff) => (t.current?.price_mode === 'inc_vat' ? tr('כולל מע״מ') : tr('לפני מע״מ'));
    const x = (t: Tariff) => this.derived(t.current?.price ?? '0', t.current?.price_mode ?? 'ex_vat');
    return [
      { key: 'name', label: tr('שם'), render: (t) => html`<b>${t.name}</b>${t.kind === 'tou' ? html` <span class="chip" data-tone="info" data-nodot>${tr('לפי שעות')}</span>` : nothing}` },
      { key: 'price', label: tr('מחיר שהוזן'), align: 'end', render: (t) => (t.kind === 'tou' ? html`<span class="mut">${touSummary(t)}</span>` : html`<span class="num">${f4(t.current?.price ?? 0)} ₪</span>`) },
      { key: 'mode', label: tr('הוזן'), render: (t) => mode(t) },
      { key: 'ex', label: tr('לפני מע״מ'), kind: 'num', render: (t) => (t.kind === 'tou' ? '-' : `${f4(x(t).ex)} ₪`) },
      { key: 'inc', label: tr('כולל מע״מ'), kind: 'num', render: (t) => (t.kind === 'tou' ? '-' : `${f4(x(t).inc)} ₪`) },
      { key: 'from', label: tr('בתוקף מ'), render: (t) => html`<span class="num">${fmtDate(t.current?.effective_from ?? '')}</span>` },
      { key: 'used', label: tr('חשבונות'), render: (t) => String(t.used_by) },
    ];
  }

  private derived(price: string, mode: PriceMode): { ex: number; vat: number; inc: number } {
    const p = Number(price) || 0;
    const r = this.rate();
    return mode === 'ex_vat' ? { ex: p, vat: p * r, inc: p * (1 + r) } : { ex: p / (1 + r), vat: p - p / (1 + r), inc: p };
  }

  private openTariff(t: Tariff | null) {
    this.tEdit = t;
    this.tf = t?.current ? { name: t.name, price: t.current.price ?? '', mode: t.current.price_mode, from: elecToday() } : { name: '', price: '', mode: this.settings?.default_price_mode ?? 'ex_vat', from: elecToday() };
    this.tKind = t?.kind === 'tou' ? 'tou' : 'fixed';
    this.tDef = t?.kind === 'tou' && t.current?.definition ? cloneDef(t.current.definition) : null;
    this.tSource = '';
    this.tErrPath = '';
    this.tErr = {};
    this.tVer = null;
    this.tPlan = null;
    this.error = '';
    this.tOpen = true;
  }
  /** EL5: a new tariff is a fixed price or time-of-use; time-of-use starts from the template (hours filled, prices empty). */
  private async setKind(k: TariffKind) {
    if (this.tEdit || this.tKind === k) return;
    this.tKind = k;
    this.tErrPath = '';
    this.error = '';
    if (k === 'tou' && !this.tDef) {
      try {
        const tpl = (await elec().touTemplates())[0];
        this.tDef = cloneDef(tpl?.definition ?? israelTemplate());
        this.tSource = tpl ? heOrEn(tpl.source_he, tpl.source_en) : '';
      } catch (er) {
        this.tDef = israelTemplate();
        this.error = elecErrorText(er);
      }
    }
  }
  /** Load one existing price version into the form so it can be corrected. */
  private editVersion(v: TariffVersion) {
    if (!this.tEdit) return;
    this.tVer = v;
    this.tPlan = null;
    this.tErr = {};
    this.tErrPath = '';
    this.error = '';
    this.tf = { name: this.tEdit.name, price: v.price ?? '', mode: v.price_mode, from: v.effective_from };
    if (v.definition) this.tDef = cloneDef(v.definition);
  }
  private setTf(patch: Partial<{ name: string; price: string; mode: PriceMode; from: string }>) {
    this.tf = { ...this.tf, ...patch };
    this.tPlan = null;
  }
  private planText(p: TariffVersionPlan): string {
    const part = (x: { price: string | null; price_mode: PriceMode }) => (x.price === null ? (x.price_mode === 'inc_vat' ? tr('מחירים לפי שעות כולל מע״מ') : tr('מחירים לפי שעות לפני מע״מ')) : `${f4(x.price)} ₪ ${x.price_mode === 'inc_vat' ? tr('כולל מע״מ') : tr('לפני מע״מ')}`);
    return `${part(p.old)} ← ${part(p.new)}. ${p.message_he}`;
  }
  private async saveTariff() {
    const f = this.tf;
    const tou = this.tKind === 'tou';
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = tr('צריך לתת שם לתעריף');
    if (!tou && (!NUM.test(f.price) || Number(f.price) <= 0)) e.price = tr('המחיר חייב להיות מספר גדול מאפס');
    if (!isIsoDate(f.from)) e.from = tr('צריך לבחור תאריך');
    this.tErr = e;
    if (Object.keys(e).length || this.busy || (tou && !this.tDef)) return;
    this.busy = true;
    this.error = '';
    this.tErrPath = '';
    try {
      const body = { name: f.name.trim(), price: tou ? '' : f.price, price_mode: f.mode, effective_from: f.from, definition: tou ? this.tDef : null };
      if (this.tEdit) {
        // a correction (or a new price on an existing date) is shown once for confirmation before anything is written
        const r = await elec().correctTariffVersion(this.tEdit.id, body, { replaceId: this.tVer?.id ?? null, base: this.tVer, confirm: !!this.tPlan });
        if (!r.applied && r.plan) {
          this.tPlan = r.plan;
          return;
        }
      } else await elec().createTariff(body);
      this.tPlan = null;
      this.tOpen = false;
      this.tariffs = await elec().listTariffs();
    } catch (er) {
      const fe = elecFieldErrors(er);
      if (Object.keys(fe).length) this.tErr = fe;
      else this.error = elecErrorText(er);
      // ADR-019: the refused definition path from `problems` (`definition.<path>`), the legacy `errors[0].path` second
      const first = problemsOf(er)[0];
      if (first && (first.field === 'definition' || first.field.startsWith('definition.'))) this.tErrPath = first.field.replace(/^definition\.?/, '');
    } finally {
      this.busy = false;
    }
  }
  private async saveVat() {
    const e: Record<string, string> = {};
    if (!NUM.test(this.vf.rate) || Number(this.vf.rate) > 50) e.rate_percent = tr('שיעור המע״מ חייב להיות בין 0 ל-50');
    if (!isIsoDate(this.vf.from)) e.effective_from = tr('צריך לבחור תאריך');
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
    if (!this.settings || !energyAccess().manage || this.settings.default_price_mode === m) return;
    try {
      this.settings = await elec().saveSettings(this.settings.revision, { default_price_mode: m });
      this.error = '';
    } catch (e) {
      this.error = elecErrorText(e);
    }
  }

  render() {
    const perms = energyAccess();
    if (!perms.bills && !perms.manage) return html`<div class="page" data-elec="settings-prices" data-state="forbidden">${stateBox('forbidden', 'lock', tr('אין הרשאה למחירים'))}</div>`;
    if (this.st === 'loading') return html`<div class="page" data-elec="settings-prices" data-state="loading">${skeleton(4)}</div>`;
    if (this.st === 'forbidden') return html`<div class="page" data-elec="settings-prices" data-state="forbidden">${stateBox('forbidden', 'lock', tr('אין הרשאה למחירים'))}</div>`;
    if (this.st === 'error') return html`<div class="page" data-elec="settings-prices" data-state="error">${stateBox('error', 'warning', tr('לא ניתן לטעון את המחירים'), { label: tr('נסה שוב'), run: () => void this.load() })}</div>`;
    const cur = this.vat?.current;
    const vh = (this.vat?.items ?? []).slice().sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
    const edit = perms.manage;
    const d = this.derived(this.tf.price, this.tf.mode);
    const mode = this.settings?.default_price_mode ?? 'ex_vat';
    return html`<div class="page" data-elec="settings-prices" data-state="ready">
      ${this.error && !this.tOpen && !this.vOpen ? alertBox('err', this.error) : nothing}
      ${!cur ? alertBox('warn', tr('לא הוגדר שיעור מע״מ. בלי שיעור אי אפשר להפיק חיובים.')) : nothing}
      <div class="cols side-l">
        <div class="card ${this.phone ? '' : 'flush'}"><div class="hd"><b class="h3">${tr('תעריפים')}</b><span class="sp"></span>${edit ? html`<sw-button variant="primary" size="sm" data-new-tariff @click=${() => this.openTariff(null)}>${tr('+ תעריף')}</sw-button>` : nothing}</div>
          ${!this.tariffs.length ? stateBox('empty', 'bolt', tr('אין תעריפים עדיין'), edit ? { label: tr('+ תעריף'), primary: true, run: () => this.openTariff(null) } : undefined)
            : this.phone
              ? html`<div class="list" data-tariffs>${this.tariffs.map((t) => html`<button type="button" class="li" data-tariff-row=${t.id} data-kind=${t.kind} ?disabled=${!edit} @click=${() => edit && this.openTariff(t)}><div class="grow"><div class="t1">${t.name}</div><div class="t2">${t.kind === 'tou' ? html`${touSummary(t)} · ` : nothing}${t.current?.price_mode === 'inc_vat' ? tr('הוזן כולל מע״מ') : tr('הוזן לפני מע״מ')} · ${tr('מ-')}${n(fmtDate(t.current?.effective_from ?? ''))}</div></div>${t.kind === 'tou' ? html`<span class="chip c-acc nodot">${tr('לפי שעות')}</span>` : html`<b class="num">${f4(t.current?.price ?? 0)} ₪</b>`}</button>`)}</div>`
              : html`<sw-table bare class="t" data-tariffs ?static-rows=${!edit} .columns=${this.tariffColumns() as unknown as TableColumn[]} .rows=${this.tariffs as unknown as Record<string, unknown>[]}
                  .rowAttrs=${(r: Record<string, unknown>) => ({ 'data-tariff-row': String(r.id), 'data-kind': String(r.kind) })}
                  @row-select=${edit ? (e: CustomEvent<{ row: Record<string, unknown> }>) => this.openTariff(e.detail.row as unknown as Tariff) : nothing}></sw-table>`}
        </div>
        <div class="col">
          <div class="card" data-card="vat"><div class="hd"><b class="h3">${tr('שיעור מע״מ')}</b><span class="sp"></span>${edit ? html`<sw-button size="sm" data-new-vat @click=${() => { this.vf = { rate: '', from: elecToday() }; this.vErr = {}; this.error = ''; this.vOpen = true; }}>${tr('+ שיעור חדש')}</sw-button>` : nothing}</div>
            ${cur ? html`<div class="row" style="align-items:baseline"><span style="font-size:var(--sw-fs-3xl);font-weight:700" data-vat-rate>${n(cur.rate_percent + '%')}</span><span class="mut">${tr('מ-')}${n(fmtDate(cur.effective_from))}</span></div>` : html`<div class="mut">${tr('לא הוגדר')}</div>`}
            ${vh.slice(1).map((v, i) => html`<div class="ver" style="margin-block-start:8px"><span class="num">${v.rate_percent}%</span><span>${tr('עד')} ${n(fmtDate(addDays(vh[i].effective_from, -1)))}</span></div>`)}</div>
          <div class="card" data-card="mode"><div class="hd"><b class="h3">${tr('ברירת מחדל להזנת מחיר')}</b></div><div class="list" role="radiogroup" aria-label=${tr('ברירת מחדל להזנת מחיר')}>
            ${(['ex_vat', 'inc_vat'] as PriceMode[]).map((m) => html`<label class="li ${mode === m ? 'sel' : ''}"><input type="radio" name="mode" data-default-mode=${m} .checked=${mode === m} ?disabled=${!edit} @change=${() => void this.setMode(m)} /><span class="ind"></span><div class="grow t1">${m === 'ex_vat' ? tr('לפני מע״מ') : tr('כולל מע״מ')}</div></label>`)}</div></div>
        </div>
      </div>
      <elec-dialog heading=${this.tEdit ? tr('עריכת תעריף') : tr('תעריף חדש')} ?open=${this.tOpen} ?wide=${this.tKind === 'tou'} data-dialog="tariff" @close=${() => (this.tOpen = false)}>
        <div class="form">
          <sw-field class="fld wide" label=${tr('שם התעריף')}><input id="tn" class="${this.tErr.name ? 'err' : ''}" aria-invalid=${this.tErr.name ? 'true' : 'false'} data-tariff-name .value=${this.tf.name} @input=${(e: Event) => this.setTf({ name: (e.target as HTMLInputElement).value })} />${this.tErr.name ? html`<div class="msg" role="alert" slot="message">${this.tErr.name}</div>` : nothing}</sw-field>
          ${this.tEdit ? nothing : html`<div class="fld wide"><span class="lbl">${tr('סוג התעריף')}</span><sw-segmented label=${tr('סוג התעריף')} value=${this.tKind} @change=${(e: CustomEvent<SegmentedChange>) => void this.setKind(e.detail.value as 'fixed' | 'tou')}
        .options=${[{ value: 'fixed', label: tr('מחיר קבוע'), attrs: { 'data-tariff-kind': 'fixed' } }, { value: 'tou', label: tr('לפי שעות (תעו״ז)'), attrs: { 'data-tariff-kind': 'tou' } }]}></sw-segmented></div>`}
          ${this.tKind === 'fixed' ? html`<sw-field class="fld" label=${tr('מחיר לקוט״ש')} unit="₪"><input id="tp" class="ltr ${this.tErr.price ? 'err' : ''}" aria-invalid=${this.tErr.price ? 'true' : 'false'} data-tariff-price inputmode="decimal" .value=${this.tf.price} @input=${(e: Event) => this.setTf({ price: (e.target as HTMLInputElement).value })} />${this.tErr.price ? html`<div class="msg" role="alert" slot="message">${this.tErr.price}</div>` : nothing}</sw-field>` : nothing}
          <div class="fld"><span class="lbl">${this.tKind === 'tou' ? tr('המחירים שהוזנו') : tr('המחיר שהוזן')}</span><sw-segmented label=${tr('סוג מחיר')} value=${this.tf.mode} @change=${(e: CustomEvent<SegmentedChange>) => this.setTf({ mode: e.detail.value as 'ex_vat' | 'inc_vat' })}
        .options=${[{ value: 'ex_vat', label: tr('לפני מע״מ'), attrs: { 'data-tariff-mode': 'ex_vat' } }, { value: 'inc_vat', label: tr('כולל מע״מ'), attrs: { 'data-tariff-mode': 'inc_vat' } }]}></sw-segmented></div>
          <sw-field class="fld" label=${tr('בתוקף מתאריך')}><input id="tf" type="date" lang=${dateInputLang()} class="ltr ${this.tErr.effective_from ? 'err' : ''}" aria-invalid=${this.tErr.effective_from ? 'true' : 'false'} data-tariff-from .value=${this.tf.from} @change=${(e: Event) => this.setTf({ from: (e.target as HTMLInputElement).value })} />${this.tErr.effective_from ? html`<div class="msg" role="alert" slot="message">${this.tErr.effective_from}</div>` : nothing}</sw-field>
        </div>
        ${this.tKind === 'fixed' && cur ? html`<div class="card soft" data-tariff-derived><dl class="kv"><dt>${tr('לפני מע״מ')}</dt><dd>${n(f4(d.ex) + ' ₪')}</dd><dt>${tr('מע״מ')} ${n(cur.rate_percent + '%')}</dt><dd>${n(f4(d.vat) + ' ₪')}</dd><dt>${tr('כולל מע״מ')}</dt><dd>${n(f4(d.inc) + ' ₪')}</dd></dl></div>` : nothing}
        ${this.tKind === 'tou' && this.tSource && !this.tEdit ? alertBox('info', this.tSource) : nothing}
        ${this.tKind === 'tou' && this.tDef ? html`<elec-tou-editor .definition=${this.tDef} .priceMode=${this.tf.mode} .vatRate=${cur ? Number(cur.rate_percent) / 100 : null} .errorPath=${this.tErrPath}
            @tou-change=${(e: CustomEvent<TouDefinition>) => { this.tDef = e.detail; this.tPlan = null; this.tErrPath = ''; }}></elec-tou-editor>` : nothing}
        ${this.tEdit && this.tEdit.versions.length ? html`<b class="h3">${tr('גרסאות')}</b><div class="list" data-tariff-versions>${this.tEdit.versions.map((v) => html`<div class="ver" data-version=${v.id} aria-current=${this.tVer?.id === v.id ? 'true' : 'false'}><span class="num">${v.definition ? tr('לפי שעות') : `${f4(v.price ?? 0)} ₪`}</span><span>${v.price_mode === 'inc_vat' ? tr('כולל מע״מ') : tr('לפני מע״מ')} · ${tr('מ-')}${n(fmtDate(v.effective_from))}</span>${energyAccess().manage ? html`<button type="button" class="btn ghost sm" data-version-edit=${v.id} aria-label=${tr('תיקון המחיר')} @click=${() => this.editVersion(v)}>${tr('תיקון')}</button>` : nothing}</div>`)}</div>` : nothing}
        ${this.tPlan ? alertBox('warn', this.planText(this.tPlan)) : nothing}
        ${this.error ? alertBox('err', this.error) : nothing}
        <sw-button variant="primary" slot="actions" data-save ?disabled=${this.busy} @click=${() => void this.saveTariff()}>${this.tPlan ? tr('אישור והחלפה') : this.tVer ? tr('שמירת תיקון') : tr('שמירה')}</sw-button>
        <sw-button slot="actions" @click=${() => (this.tOpen = false)}>${tr('ביטול')}</sw-button>
      </elec-dialog>
      <elec-dialog heading=${tr('שיעור מע״מ חדש')} ?open=${this.vOpen} data-dialog="vat" @close=${() => (this.vOpen = false)}>
        <div class="form">
          <sw-field class="fld" label=${tr('שיעור')} unit="%"><input id="vr" class="ltr ${this.vErr.rate_percent ? 'err' : ''}" aria-invalid=${this.vErr.rate_percent ? 'true' : 'false'} data-vat-input inputmode="decimal" .value=${this.vf.rate} @input=${(e: Event) => (this.vf = { ...this.vf, rate: (e.target as HTMLInputElement).value })} />${this.vErr.rate_percent ? html`<div class="msg" role="alert" slot="message">${this.vErr.rate_percent}</div>` : nothing}</sw-field>
          <sw-field class="fld" label=${tr('בתוקף מתאריך')}><input id="vf" type="date" lang=${dateInputLang()} class="ltr ${this.vErr.effective_from ? 'err' : ''}" aria-invalid=${this.vErr.effective_from ? 'true' : 'false'} data-vat-from .value=${this.vf.from} @change=${(e: Event) => (this.vf = { ...this.vf, from: (e.target as HTMLInputElement).value })} />${this.vErr.effective_from ? html`<div class="msg" role="alert" slot="message">${this.vErr.effective_from}</div>` : nothing}</sw-field>
        </div>
        ${this.error ? alertBox('err', this.error) : nothing}
        <sw-button variant="primary" slot="actions" data-save ?disabled=${this.busy} @click=${() => void this.saveVat()}>${tr('שמירה')}</sw-button>
        <sw-button slot="actions" @click=${() => (this.vOpen = false)}>${tr('ביטול')}</sw-button>
      </elec-dialog>
    </div>`;
  }
}

// ================================================================================================ business
function sample(b: BillingSettings['business'], terms: PaymentTerms, hasLogo: boolean): BillSnapshot {
  const today = elecToday();
  return {
    schema: 'arx.energy.bill_snapshot/1',
    // i18n-keep-start: the sample bill preview of the Hebrew bill document (invented sample data)
    doc: { title_he: 'חשבון צריכת חשמל ודרישת תשלום', subtitle_he: 'אינו חשבונית מס', is_tax_invoice: false },
    bill: { id: '', number: '2026-09-0001', revision: 1, replaces: null, state: 'issued', issue_date: today, due_date: terms.mode === 'net_days' ? addDays(today, terms.days) : `${today.slice(0, 7)}-${String(terms.day_of_month).padStart(2, '0')}`, expected_due_date: null, payment_terms: { mode: terms.mode, days: terms.days, day_of_month: terms.day_of_month } },
    period: { from: '2026-09-01', to: '2026-09-30', days: 30 },
    business: { ...b, logo: hasLogo ? { sha256: 'x', mime: 'image/png' } : null },
    customer: { id: 'c', customer_number: '0001', name: 'לקוח לדוגמה', address: 'רחוב הדוגמה 12, עיר לדוגמה', phone: '', email: '', tax_id: '' },
    account: { id: 'a', name: 'חשבון לדוגמה', tariff: { id: 't', name: 'תעריף' }, formula: { text: '[מונה]', sentence_he: 'מונה לדוגמה' } },
    meters: [{ meter_id: 'm', name: 'מונה לדוגמה', coefficient: '1', start: { at: '2026-09-01T00:00:00Z', reading_kwh: '1000.00', kind: 'reading' }, end: { at: '2026-09-30T23:59:00Z', reading_kwh: '1776.20', kind: 'reading' }, consumption_kwh: '776.20', contribution_kwh: '776.20' }],
    // i18n-keep-end
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
      this.st = elecForbidden(e) ? 'forbidden' : 'error';
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
    if (this.biz.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.biz.email)) e.email = tr('כתובת דוא״ל לא תקינה');
    if (!HEX.test(this.biz.accent_color)) e.accent_color = tr('צבע לא תקין');
    else if (lum(this.biz.accent_color) > 0.6) e.accent_color = tr('הצבע בהיר מדי להדפסה');
    if (this.terms.mode === 'net_days' && !(Number.isInteger(this.terms.days) && this.terms.days >= 0 && this.terms.days <= 120)) e.days = tr('מספר הימים חייב להיות בין 0 ל-120');
    if (this.terms.mode === 'day_of_month' && !(Number.isInteger(this.terms.day_of_month) && this.terms.day_of_month >= 1 && this.terms.day_of_month <= 31)) e.day_of_month = tr('היום בחודש חייב להיות בין 1 ל-31');
    if (!/^\d+$/.test(this.delay) || Number(this.delay) > 72) e.delay_hours = tr('ההשהיה חייבת להיות בין 0 ל-72 שעות');
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
      this.error = tr('הלוגו חייב להיות PNG או JPEG עד 1MB.');
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
    return html`<sw-field class="fld ${o.wide ? 'wide' : ''}" label=${label}>
      ${o.area
        ? html`<textarea id="b-${k}" name=${k} .value=${this.biz[k]} @input=${(e: Event) => (this.biz = { ...this.biz, [k]: (e.target as HTMLTextAreaElement).value })}></textarea>`
        : html`<input id="b-${k}" name=${k} class="${o.ltr ? 'ltr' : ''} ${err ? 'err' : ''}" aria-invalid=${err ? 'true' : 'false'} .value=${this.biz[k]} @input=${(e: Event) => { this.biz = { ...this.biz, [k]: (e.target as HTMLInputElement).value }; this.errs = { ...this.errs, [k]: '' }; }} />`}
      ${err ? html`<div class="msg" role="alert" slot="message" data-field-error=${k}>${err}</div>` : nothing}</sw-field>`;
  }

  render() {
    const perms = energyAccess();
    if (!perms.bills && !perms.manage) return html`<div class="page" data-elec="settings-business" data-state="forbidden">${stateBox('forbidden', 'lock', tr('אין הרשאה לפרטי העסק'))}</div>`;
    if (this.st === 'loading') return html`<div class="page" data-elec="settings-business" data-state="loading">${skeleton(4)}</div>`;
    if (this.st === 'forbidden') return html`<div class="page" data-elec="settings-business" data-state="forbidden">${stateBox('forbidden', 'lock', tr('אין הרשאה לפרטי העסק'))}</div>`;
    if (this.st === 'error' || !this.s) return html`<div class="page" data-elec="settings-business" data-state="error">${stateBox('error', 'warning', tr('לא ניתן לטעון את ההגדרות'), { label: tr('נסה שוב'), run: () => void this.load() })}</div>`;
    const edit = perms.manage;
    const s = this.s;
    const logoSrc = s.logo ? elec().logoUrl(s.logo.sha256) : '';
    const swatches = recommendedColors('accent', 'light', 8);
    const t = this.terms;
    return html`<div class="page" data-elec="settings-business" data-state="ready">
      <div class="cols side-l"><div class="card" style="min-inline-size:0"><fieldset style="border:0;margin:0;padding:0;min-inline-size:0" ?disabled=${!edit}><div class="form">
        <div class="fld wide"><span class="lbl">${tr('לוגו')}</span><div class="row">
          <div class="chip c-mut nodot" style="inline-size:96px;block-size:96px;padding:0;justify-content:center;border-radius:var(--sw-r-lg);overflow:hidden" data-logo>${logoSrc ? html`<img src=${logoSrc} alt=${tr('לוגו')} style="max-inline-size:100%;max-block-size:100%" />` : html`<span class="mut">${tr('אין לוגו')}</span>`}</div>
          <div><label class="btn" style="cursor:pointer">${s.logo ? tr('החלפה') : tr('העלאת לוגו')}<input type="file" accept="image/png,image/jpeg" data-logo-input style="position:absolute;inline-size:1px;block-size:1px;opacity:0" @change=${(e: Event) => void this.logo((e.target as HTMLInputElement).files?.[0])} /></label>
            ${s.logo ? html` <sw-button variant="ghost" data-logo-remove @click=${() => void this.removeLogo()}>${tr('הסרה')}</sw-button>` : nothing}<div class="mut" style="margin-block-start:6px">${tr('PNG או JPEG, עד 1MB')}</div></div></div></div>
        ${this.fld('name', tr('שם העסק'), { wide: true })}${this.fld('registration_no', tr('ח.פ. / ע.מ.'), { ltr: true })}${this.fld('phone', tr('טלפון'), { ltr: true })}${this.fld('address', tr('כתובת'), { wide: true })}${this.fld('email', tr('דוא״ל'), { ltr: true })}
        <div class="fld"><span class="lbl" id="acc">${tr('צבע המותג')}</span><div class="row" role="group" aria-labelledby="acc" data-accent>
          ${swatches.map((c) => html`<button type="button" class="tok swatch" data-swatch=${c} aria-label=${tr('צבע {c}', { c })} aria-pressed=${this.biz.accent_color.toLowerCase() === c} style="background:${c};border:2px solid ${this.biz.accent_color.toLowerCase() === c ? 'var(--sw-text)' : 'transparent'}" @click=${() => (this.biz = { ...this.biz, accent_color: c })}></button>`)}
          <input type="color" data-accent-color aria-label=${tr('בחירה חופשית של צבע')} .value=${HEX.test(this.biz.accent_color) ? this.biz.accent_color : '#2767ed'} @input=${(e: Event) => (this.biz = { ...this.biz, accent_color: (e.target as HTMLInputElement).value })} /></div>
          ${this.errs.accent_color ? html`<div class="msg" role="alert" data-field-error="accent_color">${this.errs.accent_color}</div>` : nothing}</div>
        ${this.fld('footer_note', tr('הערה קבועה בתחתית החיוב'), { wide: true, area: true })}
        <div class="fld wide"><span class="lbl">${tr('מספור חיובים')}</span><div class="row" data-numbering style="padding:8px 12px;border:1px solid var(--sw-border-strong);border-radius:var(--sw-r-sm)"><span class="num">${s.numbering.format}</span><span class="sp"></span><span class="mut">${tr('שנה-חודש-מספר לקוח, למשל')} ${n('2026-12-0001')}</span></div></div>
        <div class="fld wide"><span class="lbl" id="pt">${tr('תנאי תשלום')}</span><div class="row"><sw-segmented label=${tr('תנאי תשלום')} value=${t.mode} @change=${(e: CustomEvent<SegmentedChange>) => (this.terms = { ...t, mode: e.detail.value as 'net_days' | 'day_of_month' })}
        .options=${[{ value: 'net_days', label: tr('ימים מיום ההפקה'), attrs: { 'data-terms': 'net_days' } }, { value: 'day_of_month', label: tr('יום קבוע בחודש'), attrs: { 'data-terms': 'day_of_month' } }]}></sw-segmented>
          ${t.mode === 'net_days'
            ? html`<sw-field class="terms-n" style="inline-size:132px" unit=${tr('ימים')}><input class="ltr ${this.errs.days ? 'err' : ''}" data-days type="number" min="0" max="120" aria-label=${tr('ימים לתשלום')} aria-invalid=${this.errs.days ? 'true' : 'false'} .value=${String(t.days)} @input=${(e: Event) => (this.terms = { ...t, days: Number((e.target as HTMLInputElement).value) })} /></sw-field>`
            : html`<sw-field class="terms-n" style="inline-size:132px" unit=${tr('בחודש')}><input class="ltr ${this.errs.day_of_month ? 'err' : ''}" data-day-of-month type="number" min="1" max="31" aria-label=${tr('יום בחודש')} aria-invalid=${this.errs.day_of_month ? 'true' : 'false'} .value=${String(t.day_of_month)} @input=${(e: Event) => (this.terms = { ...t, day_of_month: Number((e.target as HTMLInputElement).value) })} /></sw-field>`}</div>
          ${this.errs.days || this.errs.day_of_month ? html`<div class="msg" role="alert" data-field-error="terms">${this.errs.days || this.errs.day_of_month}</div>` : nothing}</div>
        <sw-field class="fld wide delay" style="max-inline-size:340px" label=${tr('יצירת טיוטה אוטומטית')} unit=${tr('שעות אחרי סוף התקופה')}><input id="dl" class="ltr ${this.errs.delay_hours ? 'err' : ''}" aria-invalid=${this.errs.delay_hours ? 'true' : 'false'} data-delay type="number" min="0" max="72" .value=${this.delay} @input=${(e: Event) => { this.delay = (e.target as HTMLInputElement).value; this.errs = { ...this.errs, delay_hours: '' }; }} />${this.errs.delay_hours ? html`<div class="msg" role="alert" slot="message" data-field-error="delay_hours">${this.errs.delay_hours}</div>` : nothing}</sw-field>
      </div></fieldset>
      ${this.error ? alertBox('err', this.error) : nothing}${this.ok ? alertBox('ok', tr('ההגדרות נשמרו')) : nothing}
      ${edit ? html`<div class="row" style="margin-block-start:14px"><sw-button variant="primary" data-save ?disabled=${this.busy} @click=${() => void this.save()}>${tr('שמירה')}</sw-button></div>` : nothing}</div>
      <div class="card"><div class="hd"><b class="h3">${tr('תצוגה מקדימה')}</b></div><div style="overflow:hidden;max-block-size:320px;border-radius:var(--sw-r-sm)" data-preview><elec-bill-paper .snapshot=${sample(this.biz, t, !!s.logo)} .logo=${logoSrc} hash=""></elec-bill-paper></div></div></div>
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'elec-settings-prices': ElecSettingsPrices;
    'elec-settings-business': ElecSettingsBusiness;
  }
}
