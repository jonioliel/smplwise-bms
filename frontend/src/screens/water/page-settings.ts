import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../../components/sw-icon';
import '../../components/sw-state-panel';
import '../../electricity/elec-ui'; // elec-dialog (the electricity confirmation dialog)
import { ApiError, describeError } from '../../api/client';
import { DEFAULT_RULES, DEFAULT_SNOOZE, readableAlerts, water, type AlertsConfig, type LeakRules } from '../../api/water';
import { waterBilling, type PriceMode, type SharedSettings, type SnoozeSettings, type Tariff, type TariffVersion } from '../../api/water-billing';
import { navigate } from '../../router';
import { onWaterAccess, waterAccess, type WaterAccess } from '../../water/access';
import { waterCss } from '../../water/styles';
import { fmtIls, priceIncVat, snoozeLabel, snoozeProblem, toMinutes } from '../../water/billing-format';
import { durationWords } from '../../water/ui';
import { fmtDate } from '../../electricity/format';
import { INFRA_SETTINGS_HREF } from '../../shell/nav';
import { wt } from '../../water/i18n';
import { SkinController } from '../../design/skin';
import { bubbleChrome } from '../../styles/bubble-chrome';
import { dateInputLang } from '../../api/day-format';

type Section = 'prices' | 'alerts';
const MAX_CHOICES = [1440, 10080, 43200];
const PRICE = /^\d{1,6}(\.\d{1,4})?$/;
const skeletonCard = (n = 5) => html`<div class="card" aria-busy="true">${Array.from({ length: n }, () => html`<div class="row" style="padding:10px 0"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div></div>`)}</div>`;

interface VersionForm {
  tariffId: string | null;
  name: string;
  from: string;
  water: string;
  sewage: string;
  mode: PriceMode;
}

/**
 * תשתיות › מים › הגדרות (CR-WATER78 section 16, owner correction 24.10): water-specific settings only. "תעריפי מים וביוב": the tariffs with
 * their versions (בתוקף מ-, מים למ״ק, ביוב למ״ק, כולל מע״מ; a version used by an issued bill is locked and read-only), a new tariff and a new
 * version (water.manage), and the card "משותף עם החשמל" (the VAT in force, a link to the shared electricity billing settings - NO water copy
 * of VAT, business details, numbering, terms or retention). "התראות והשהיה": the offered snooze durations (add / remove), the default of the
 * main button and the maximum, saved with PUT /alerts (system.configure); the leak rules shown read-only.
 */
@customElement('water-settings-page')
export class WaterSettingsPage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) segments: string[] = [];
  @property({ attribute: false }) params: URLSearchParams = new URLSearchParams();
  @state() private access: WaterAccess = waterAccess();
  @state() private tariffs: Tariff[] | null = null;
  @state() private tariffsErr = false;
  @state() private shared: SharedSettings | null = null;
  @state() private cfg: AlertsConfig | null = null;
  @state() private cfgLoaded = false;
  @state() private snooze: SnoozeSettings = DEFAULT_SNOOZE;
  @state() private addN = '30';
  @state() private addU: 'min' | 'hour' | 'day' = 'min';
  @state() private snoozeErr = '';
  @state() private notice = '';
  @state() private vf: VersionForm | null = null;
  @state() private vErr = '';
  @state() private busy = false;
  @state() private error = '';
  private stop?: () => void;

  static styles = [waterCss, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onWaterAccess((a) => (this.access = a));
    void this.loadPrices();
    void this.loadAlerts();
  }
  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  private get section(): Section {
    const s = this.params.get('set');
    if (s === 'alerts') return 'alerts';
    if (s === 'prices') return 'prices';
    return this.access.manage || this.access.bills ? 'prices' : 'alerts';
  }

  private async loadPrices() {
    if (!this.access.manage && !this.access.bills) return;
    try {
      const [t, s] = await Promise.all([waterBilling.listTariffs(), waterBilling.sharedSettings().catch(() => null)]);
      this.tariffs = t.items;
      this.shared = s;
      this.tariffsErr = false;
    } catch {
      this.tariffsErr = true;
      this.tariffs = [];
    }
  }

  private async loadAlerts() {
    const c = await readableAlerts(true);
    this.cfg = c;
    this.snooze = c ? { ...c.snooze, durations: [...c.snooze.durations] } : { ...DEFAULT_SNOOZE, durations: [...DEFAULT_SNOOZE.durations] };
    this.cfgLoaded = true;
  }

  private flash(t: string) {
    this.notice = t;
    window.setTimeout(() => (this.notice = ''), 4000);
  }

  // ---------------------------------------------------------------- tariffs
  private openVersion(t: Tariff | null) {
    const cur = t?.current;
    this.vErr = '';
    this.vf = { tariffId: t?.id ?? null, name: '', from: new Date().toISOString().slice(0, 10), water: cur?.water_price ?? '', sewage: cur?.sewage_price ?? '0', mode: cur?.price_mode ?? this.shared?.default_price_mode ?? 'ex_vat' };
  }

  private async saveVersion() {
    const f = this.vf;
    if (!f || this.busy) return;
    if (!f.tariffId && !f.name.trim()) return void (this.vErr = wt('errName'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.from)) return void (this.vErr = wt('errDate'));
    if (!PRICE.test(f.water.trim()) || Number(f.water) <= 0 || !PRICE.test(f.sewage.trim() || '0')) return void (this.vErr = wt('errPrice'));
    this.busy = true;
    this.vErr = '';
    try {
      const body = { effective_from: f.from, water_price: f.water.trim(), sewage_price: f.sewage.trim() || '0', price_mode: f.mode };
      if (f.tariffId) await waterBilling.addVersion(f.tariffId, body);
      else await waterBilling.createTariff({ name: f.name.trim(), ...body });
      this.vf = null;
      this.flash(wt('saved'));
      await this.loadPrices();
    } catch (e) {
      this.vErr = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async deleteVersion(t: Tariff, v: TariffVersion) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await waterBilling.deleteVersion(t.id, v.id);
      await this.loadPrices();
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private sharedLink(): string {
    const l = this.shared?.edit_link ?? '';
    // the shared billing settings live under Settings › תשתיות; a link the shell does not route falls back to that tab
    return l.startsWith('#/system/') ? l : INFRA_SETTINGS_HREF;
  }

  private renderPrices() {
    if (!this.access.manage && !this.access.bills) return html`<sw-state-panel state="forbidden" compact></sw-state-panel>`;
    if (this.tariffs === null) return skeletonCard();
    const vat = this.shared?.vat.current?.rate_percent ?? null;
    const manage = this.access.manage;
    const left = this.tariffsErr
      ? html`<sw-state-panel state="error" heading=${wt('loadTariffsError')} actionLabel=${wt('retry')} @action=${() => void this.loadPrices()}></sw-state-panel>`
      : html`${this.tariffs.length ? nothing : html`<sw-state-panel icon="drop" state="empty" compact heading=${wt('noTariffs')}></sw-state-panel>`}
        ${this.tariffs.map((t) => html`<div class="card flush" data-tariff=${t.id}>
          <div class="hd" style="padding:14px 16px 0"><b>${t.name}</b><span class="sp"></span><span class="mut">${wt('usedBy', { n: t.used_by })}</span>
            ${manage ? html`<button class="btn sm" type="button" data-new-version @click=${() => this.openVersion(t)}>${wt('newVersion')}</button>` : nothing}</div>
          <div class="scrollx"><table class="t"><thead><tr><th>${wt('colFrom')}</th><th class="n">${wt('colWaterM3')}</th><th class="n">${wt('colSewageM3')}</th><th class="n">${wt('colIncVat')}</th><th></th></tr></thead>
            <tbody>${t.versions.map((v) => {
              const inc = v.price_inc_vat ?? priceIncVat(v.water_price, v.sewage_price, v.price_mode, t.vat_rate_percent ?? vat);
              return html`<tr data-version=${v.id}><td class="num" style="text-align:start">${fmtDate(v.effective_from)} ${t.current?.id === v.id ? html`<span class="chip c-ok nodot">${wt('current')}</span>` : nothing}${v.locked ? html` <span class="chip c-mut nodot" data-locked>${wt('locked')}</span>` : nothing}</td>
                <td class="n"><span class="num">${fmtIls(v.water_price)}</span></td><td class="n"><span class="num">${fmtIls(v.sewage_price)}</span></td><td class="n"><span class="num">${inc === null ? '-' : fmtIls(inc)}</span></td>
                <td class="n">${manage && !v.locked && t.versions.length > 1 ? html`<button class="btn ghost sm icononly" type="button" aria-label=${wt('delVersion')} title=${wt('delVersion')} ?disabled=${this.busy} @click=${() => void this.deleteVersion(t, v)}><sw-icon name="trash" size="13"></sw-icon></button>` : nothing}</td></tr>`;
            })}</tbody></table></div></div>`)}
        ${manage ? html`<button class="btn" type="button" style="align-self:flex-start" data-new-tariff @click=${() => this.openVersion(null)}><sw-icon name="plus" size="13"></sw-icon>${wt('newTariff')}</button>` : nothing}`;
    const right = html`<div class="card" data-card="shared"><div class="hd"><b>${wt('sharedTitle')}</b></div>
      <div class="mut" style="margin-block-end:10px">${wt('sharedNote')}</div>
      <dl class="kv"><dt>${wt('vatInForce')}</dt><dd class="num" data-vat>${vat === null ? '-' : `${vat}%`}</dd></dl>
      <a class="btn sm" style="margin-block-start:10px;align-self:flex-start" href=${this.sharedLink()} data-shared-link>${wt('toShared')}</a></div>`;
    return html`<div class="cols side"><div class="col">${left}${this.error ? html`<div class="alert err" role="alert">${this.error}</div>` : nothing}</div><div class="col">${right}</div></div>`;
  }

  private renderVersionDialog() {
    const f = this.vf;
    if (!f) return nothing;
    const set = (k: keyof VersionForm, v: string) => (this.vf = { ...f, [k]: v } as VersionForm);
    return html`<elec-dialog open heading=${f.tariffId ? wt('newVersion') : wt('newTariff')} data-dialog="version" @close=${() => (this.vf = null)}>
      <div class="formgrid">
        ${f.tariffId ? nothing : html`<div class="fld wide"><label for="wtn">${wt('tariffName')}</label><input id="wtn" data-tariff-name .value=${f.name} @input=${(e: Event) => set('name', (e.target as HTMLInputElement).value)} /></div>`}
        <div class="fld"><label for="wtf">${wt('colFrom')}</label><input id="wtf" type="date" lang=${dateInputLang()} class="ltr" .value=${f.from} @change=${(e: Event) => set('from', (e.target as HTMLInputElement).value)} /></div>
        <div class="fld"><span class="lbl">${wt('priceMode')}</span><div class="seg" role="group" aria-label=${wt('priceMode')}>
          <button type="button" aria-pressed=${f.mode === 'ex_vat' ? 'true' : 'false'} @click=${() => set('mode', 'ex_vat')}>${wt('modeEx')}</button>
          <button type="button" aria-pressed=${f.mode === 'inc_vat' ? 'true' : 'false'} @click=${() => set('mode', 'inc_vat')}>${wt('modeInc')}</button></div></div>
        <div class="fld"><label for="wtw">${wt('colWaterM3')}</label><input id="wtw" class="ltr" inputmode="decimal" data-water-price .value=${f.water} @input=${(e: Event) => set('water', (e.target as HTMLInputElement).value)} /></div>
        <div class="fld"><label for="wts">${wt('colSewageM3')}</label><input id="wts" class="ltr" inputmode="decimal" data-sewage-price .value=${f.sewage} @input=${(e: Event) => set('sewage', (e.target as HTMLInputElement).value)} /></div>
      </div>
      ${this.vErr ? html`<div class="alert err" role="alert">${this.vErr}</div>` : nothing}
      <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy} @click=${() => void this.saveVersion()}>${wt('save')}</button>
      <button slot="actions" type="button" class="btn" @click=${() => (this.vf = null)}>${wt('cancel')}</button>
    </elec-dialog>`;
  }

  // ---------------------------------------------------------------- the snooze
  private setSnooze(s: SnoozeSettings) {
    this.snooze = s;
    this.snoozeErr = snoozeProblem(s) ?? '';
  }

  private addDuration() {
    const v = toMinutes(Number(this.addN), this.addU);
    if (!Number.isFinite(v) || v <= 0 || this.snooze.durations.includes(v)) return;
    this.setSnooze({ ...this.snooze, durations: [...this.snooze.durations, v].sort((a, b) => a - b) });
  }

  private removeDuration(m: number) {
    const s = this.snooze;
    if (s.durations.length < 2) return void (this.snoozeErr = wt('keepOne'));
    const durations = s.durations.filter((x) => x !== m);
    this.setSnooze({ ...s, durations, default: durations.includes(s.default) ? s.default : durations[0] });
  }

  private async saveSnooze() {
    const p = snoozeProblem(this.snooze);
    if (p) return void (this.snoozeErr = p);
    if (this.busy) return;
    this.busy = true;
    this.snoozeErr = '';
    try {
      const r = await water.saveSnooze(this.snooze, this.cfg?.row_version);
      this.cfg = this.cfg ? { ...this.cfg, snooze: r.snooze, row_version: r.row_version } : r;
      await readableAlerts(true);
      this.flash(wt('saved'));
    } catch (e) {
      this.snoozeErr = e instanceof ApiError && e.code === 'revision_conflict' ? wt('conflict') : describeError(e);
      if (e instanceof ApiError && e.code === 'revision_conflict') await this.loadAlerts();
    } finally {
      this.busy = false;
    }
  }

  private renderAlerts() {
    if (!this.cfgLoaded) return skeletonCard();
    const edit = this.access.configure && (this.cfg?.can_edit ?? true);
    const s = this.snooze;
    const r: LeakRules = this.cfg?.rules ?? DEFAULT_RULES;
    const maxes = [...new Set([...MAX_CHOICES, s.max])].sort((a, b) => a - b);
    const changed = JSON.stringify(s) !== JSON.stringify(this.cfg?.snooze ?? DEFAULT_SNOOZE);
    return html`<div class="cols side"><div class="col"><div class="card" data-card="snooze"><div class="hd"><b>${wt('snoozeCard')}</b></div>
        <div class="fld"><span class="lbl">${wt('snoozeDurations')}</span><div class="chips-ed" data-sn-chips>
          ${s.durations.map((m) => html`<span class="chip nodot" data-duration=${m}>${snoozeLabel(m)}${edit ? html`<button type="button" aria-label=${wt('removeDuration', { d: snoozeLabel(m) })} data-sn-del=${m} @click=${() => this.removeDuration(m)}><sw-icon name="close" size="13"></sw-icon></button>` : nothing}</span>`)}
          ${edit ? html`<span class="row" style="gap:6px;flex-wrap:nowrap"><input type="number" min="1" aria-label=${wt('snoozeAddValue')} style="inline-size:76px" data-sn-n .value=${this.addN} @input=${(e: Event) => (this.addN = (e.target as HTMLInputElement).value)} />
            <select aria-label=${wt('snoozeUnit')} style="inline-size:96px" data-sn-u @change=${(e: Event) => (this.addU = (e.target as HTMLSelectElement).value as 'min' | 'hour' | 'day')}>
              <option value="min" ?selected=${this.addU === 'min'}>${wt('uMin')}</option><option value="hour" ?selected=${this.addU === 'hour'}>${wt('uHour')}</option><option value="day" ?selected=${this.addU === 'day'}>${wt('uDay')}</option></select>
            <button class="btn sm" type="button" data-sn-add @click=${() => this.addDuration()}>${wt('add')}</button></span>` : nothing}</div></div>
        <div class="formgrid" style="margin-block-start:12px">
          <div class="fld"><label for="sn-def">${wt('snoozeDefault')}</label><select id="sn-def" data-sn-def ?disabled=${!edit} @change=${(e: Event) => this.setSnooze({ ...s, default: Number((e.target as HTMLSelectElement).value) })}>${s.durations.map((m) => html`<option value=${m} ?selected=${m === s.default}>${snoozeLabel(m)}</option>`)}</select></div>
          <div class="fld"><label for="sn-max">${wt('snoozeMax')}</label><select id="sn-max" data-sn-max ?disabled=${!edit} @change=${(e: Event) => this.setSnooze({ ...s, max: Number((e.target as HTMLSelectElement).value) })}>${maxes.map((m) => html`<option value=${m} ?selected=${m === s.max}>${snoozeLabel(m)}</option>`)}</select></div>
        </div>
        ${this.snoozeErr ? html`<div class="msg" role="alert" data-sn-error>${this.snoozeErr}</div>` : nothing}
        ${edit ? html`<div class="row" style="margin-block-start:12px"><button type="button" class="btn pri" data-sn-save ?disabled=${this.busy || !changed || !!snoozeProblem(s)} @click=${() => void this.saveSnooze()}>${wt('save')}</button></div>` : html`<div class="mut" style="margin-block-start:10px">${wt('noConfigure')}</div>`}
      </div></div>
      <div class="col"><div class="card" data-card="rules"><div class="hd"><b>${wt('rulesCard')}</b></div><dl class="kv">
        <dt>${wt('rWindow')}</dt><dd class="num">${r.night_from}-${r.night_to}</dd><dt>${wt('rThreshold')}</dt><dd>${r.night_min_lph} ${wt('lph')}</dd><dt>${wt('rDuration')}</dt><dd>${durationWords(r.night_min_intervals * 15)}</dd></dl>
        <div class="mut" style="margin-block-start:8px">${wt('rulesReadonly')}</div></div></div></div>`;
  }

  render() {
    if (!this.access.manage && !this.access.configure) return html`<sw-state-panel state="forbidden" data-water="settings" data-state="forbidden"></sw-state-panel>`;
    const sec = this.section;
    const go = (s: Section) => navigate('/infra/water/settings', { set: s });
    return html`<div class="page" data-water="settings" data-state="ready" data-section=${sec}>
      <div class="seg sect-nav" role="group" aria-label=${wt('sections')} data-set-nav>
        ${this.access.manage || this.access.bills ? html`<button type="button" data-set="prices" aria-pressed=${sec === 'prices' ? 'true' : 'false'} @click=${() => go('prices')}>${wt('sTariffs')}</button>` : nothing}
        <button type="button" data-set="alerts" aria-pressed=${sec === 'alerts' ? 'true' : 'false'} @click=${() => go('alerts')}>${wt('sAlerts')}</button></div>
      ${this.notice ? html`<div class="notice" role="status" data-notice>${this.notice}</div>` : nothing}
      ${sec === 'prices' ? this.renderPrices() : this.renderAlerts()}
      ${this.renderVersionDialog()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'water-settings-page': WaterSettingsPage;
  }
}
