import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-toggle';
import '../components/sw-dialog';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { ApiError } from '../api/client';
import { listEntities, type HaEntity } from '../api/ha';
import {
  fieldErrors, getDelivery, getSettings, isOff, isSetupIncomplete, putDelivery, putSettings, RUNS_MODES, SECTION_IDS, SWITCH_KEYS,
  type DeliveryAnswer, type DeliveryEdit, type DoorPair, type RunsMode, type SectionId, type SettingsAnswer, type SwitchKey,
} from '../api/insights';
import { refreshInsightsVisibility } from '../insights/access';
import { BOUNDS, fieldHint, fromForm, hasField, numErrors, toForm, type NumKey, type SettingsForm } from '../insights/model';
import { insightCss } from '../insights/styles';
import { ix, type IxKey } from '../i18n/insights';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const SWITCH_LABEL: Record<SwitchKey, IxKey> = { 'insights.doors.enabled': 'swDoors', 'insights.waste.enabled': 'swWaste', 'reports.building.enabled': 'swReport' };
const DOOR_CLASSES = ['door', 'window', 'opening', 'garage_door'];
const REX_DOMAINS = ['binary_sensor', 'button', 'input_button', 'event'];
const WASTE_DOMAINS = ['light', 'climate', 'fan', 'switch'];
const NUM_ORDER: { k: NumKey; label: IxKey }[] = [
  { k: 'min_open_s', label: 'fMinOpen' }, { k: 'before_s', label: 'fBefore' }, { k: 'after_s', label: 'fAfter' },
  { k: 'empty_after_min', label: 'fEmptyAfter' }, { k: 'min_waste_min', label: 'fMinWaste' }, { k: 'night_min_min', label: 'fNightMin' },
  { k: 'energy_factor', label: 'fFactor' }, { k: 'energy_min_kwh', label: 'fMinKwh' }, { k: 'baseline_weeks', label: 'fWeeks' }, { k: 'baseline_min_coverage', label: 'fCoverage' },
  { k: 'min_run_s', label: 'fMinRun' },
];

const label = (e: HaEntity | undefined): string => (e ? [e.name || e.original_name || ix('device'), e.area_name].filter(Boolean).join(' · ') : '-');

/**
 * הגדרות › תשתיות › תובנות ודוחות (CR-INSIGHT215): the three switches (each off until the owner turns it on), the door pairs (explicit: a door
 * sensor with its lock and exit inputs), every threshold of the algorithms with the server's bounds, the default sections of the report, who sees
 * the generator's run counts in it, and the scheduled monthly delivery (off until it is set up AND switched on by a system administrator).
 * The whole document is validated by the server; a 422 names the field and the input shows its range. insights.manage; a switch also needs
 * system.configure.
 */
@customElement('insights-settings')
export class InsightsSettings extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private ans: SettingsAnswer | null = null;
  @state() private form: SettingsForm | null = null;
  @state() private sections: Set<SectionId> = new Set(SECTION_IDS);
  @state() private phase: 'loading' | 'ready' | 'error' | 'forbidden' = 'loading';
  @state() private bad: string[] = [];
  @state() private note: { tone: 'ok' | 'bad'; text: string } | null = null;
  @state() private busy = false;
  @state() private entities: HaEntity[] | null = null;
  @state() private entitiesError = false;
  @state() private editing: { index: number; pair: DoorPair } | null = null;
  @state() private runsMode: RunsMode = 'report_readers';
  @state() private del: DeliveryAnswer | null = null;
  @state() private delEdit: DeliveryEdit = {};
  @state() private delBusy = false;
  @state() private delBad: string[] = [];
  @state() private delNote: { tone: 'ok' | 'bad'; text: string } | null = null;

  static styles = [insightCss, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    this.phase = 'loading';
    try {
      this.ans = await getSettings();
      this.form = toForm(this.ans.settings);
      this.sections = new Set(this.ans.settings.report.sections);
      this.runsMode = this.ans.settings.report.generator_runs;
      this.phase = 'ready';
      void this.loadEntities();
      void this.loadDelivery();
    } catch (e) {
      this.phase = e instanceof ApiError && (e.status === 403 || e.status === 404) ? 'forbidden' : 'error';
    }
  }

  /** The delivery card exists only while the report is switched on (a switched-off part answers the uniform 404). */
  private async loadDelivery() {
    try {
      this.del = await getDelivery();
      this.delEdit = {};
    } catch (e) {
      this.del = null;
      if (!isOff(e)) this.delNote = { tone: 'bad', text: ix('errorTitle') };
    }
  }

  private async loadEntities() {
    try {
      const parts = await Promise.all(['binary_sensor', 'lock', 'button', 'input_button', 'event'].map((domain) => listEntities({ domain, limit: 1000 })));
      this.entities = parts.flatMap((p) => p.entities);
    } catch {
      this.entitiesError = true;
    }
  }

  private byId(id: string | null): HaEntity | undefined {
    return id ? this.entities?.find((e) => e.entity_id === id) : undefined;
  }

  private async save(extra: { switches?: Partial<Record<SwitchKey, boolean>> } = {}) {
    if (!this.ans || !this.form || this.busy) return;
    this.busy = true;
    this.note = null;
    this.bad = [];
    try {
      const doc = fromForm(this.form, this.ans.settings);
      doc.report = { sections: SECTION_IDS.filter((s) => this.sections.has(s)), generator_runs: this.runsMode };
      this.ans = await putSettings({ settings: doc, ...extra });
      this.form = toForm(this.ans.settings);
      this.runsMode = this.ans.settings.report.generator_runs;
      this.note = { tone: 'ok', text: ix('saved') };
      void refreshInsightsVisibility();
    } catch (e) {
      this.bad = fieldErrors(e);
      this.note = { tone: 'bad', text: ix('saveFailed') };
    } finally {
      this.busy = false;
    }
  }

  private async flip(key: SwitchKey, on: boolean) {
    if (!this.ans) return;
    this.busy = true;
    try {
      this.ans = await putSettings({ switches: { [key]: on } });
      void refreshInsightsVisibility();
      if (key === 'reports.building.enabled') void this.loadDelivery();
    } catch {
      this.note = { tone: 'bad', text: ix('saveFailed') };
    } finally {
      this.busy = false;
    }
  }

  private setNum(k: NumKey, v: string) {
    if (this.form) this.form = { ...this.form, nums: { ...this.form.nums, [k]: v } };
  }
  private toggleIn(list: string[], v: string): string[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  private switchesCard() {
    const a = this.ans!;
    return html`<div class="card" data-switches>${SWITCH_KEYS.map(
      (k) => html`<div class="sw"><span class="title">${ix(SWITCH_LABEL[k])}</span>
        <sw-toggle data-switch=${k} .checked=${a.switches[k]} ?disabled=${!a.can_switch || this.busy} label=${ix(SWITCH_LABEL[k])} labelHidden
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.flip(k, e.detail.checked)}></sw-toggle></div>`,
    )}${a.can_switch ? nothing : html`<div class="sw"><span class="muted">${ix('switchNeedsAdmin')}</span></div>`}</div>`;
  }

  private pairsCard() {
    const f = this.form!;
    const err = hasField(this.bad, 'doors.pairs');
    return html`<div class="card" data-pairs><div class="ch-h"><h2>${ix('pairsTitle')}</h2>
        <button class="btn" data-pair-new @click=${() => (this.editing = { index: -1, pair: { sensor_entity_id: '', lock_entity_id: null, rex_entity_ids: [], invert: false } })}><sw-icon name="plus"></sw-icon>${ix('newPair')}</button></div>
      ${err ? html`<div class="pad ferr">${ix('fieldInvalid')}</div>` : nothing}
      ${f.pairs.length ? html`<div class="tw"><table><thead><tr><th>${ix('pairDoor')}</th><th>${ix('pairLock')}</th><th class="hide-m">${ix('pairRex')}</th><th></th></tr></thead>
        <tbody class="click">${f.pairs.map((p, i) => html`<tr class="hit" data-pair-row @click=${() => (this.editing = { index: i, pair: { ...p, rex_entity_ids: [...p.rex_entity_ids] } })}>
          <td class="title">${label(this.byId(p.sensor_entity_id))}</td><td>${p.lock_entity_id ? label(this.byId(p.lock_entity_id)) : html`<span class="muted">-</span>`}</td>
          <td class="hide-m">${p.rex_entity_ids.length ? p.rex_entity_ids.map((r) => label(this.byId(r))).join(', ') : html`<span class="muted">-</span>`}</td>
          <td class="n"><button class="btn icon" data-pair-remove aria-label=${ix('pairRemove')} @click=${(e: Event) => { e.stopPropagation(); this.form = { ...f, pairs: f.pairs.filter((_, j) => j !== i) }; }}>×</button></td></tr>`)}</tbody></table></div>` : nothing}</div>`;
  }

  private thresholds() {
    const f = this.form!;
    const errs = numErrors(this.bad);
    const nightBad = hasField(this.bad, 'waste.night_from') || hasField(this.bad, 'waste.night_to');
    return html`<div class="card" data-thresholds><div class="ch-h"><h2>${ix('thresholds')}</h2></div><div class="fields">
      ${NUM_ORDER.map(({ k, label: l }) => html`<label>${ix(l)}<input class="inp ${errs.has(k) ? 'err' : ''}" data-field=${k} inputmode="decimal" .value=${f.nums[k]} aria-invalid=${errs.has(k)}
        @input=${(e: Event) => this.setNum(k, (e.target as HTMLInputElement).value)} />${errs.has(k) ? html`<span class="ferr" data-field-error=${k}>${fieldHint(k)}</span>` : nothing}</label>`)}
      <label>${ix('fNight')}<span class="row" style="gap:6px"><input class="inp ${nightBad ? 'err' : ''}" type="time" data-field="night_from" .value=${f.nightFrom} @input=${(e: Event) => (this.form = { ...f, nightFrom: (e.target as HTMLInputElement).value })} />
        <span class="muted">-</span><input class="inp ${nightBad ? 'err' : ''}" type="time" data-field="night_to" .value=${f.nightTo} @input=${(e: Event) => (this.form = { ...f, nightTo: (e.target as HTMLInputElement).value })} /></span>
        ${nightBad ? html`<span class="ferr" data-field-error="night">${ix('fieldInvalid')}</span>` : nothing}</label>
      <label>${ix('fDomains')}<span class="checks">${WASTE_DOMAINS.map((d) => html`<label><input type="checkbox" data-domain=${d} .checked=${f.domains.includes(d)} @change=${() => (this.form = { ...f, domains: this.toggleIn(f.domains, d) })} />${ix(`dom_${d}` as IxKey)}</label>`)}</span>
        ${hasField(this.bad, 'waste.domains') ? html`<span class="ferr">${ix('fieldInvalid')}</span>` : nothing}</label></div></div>`;
  }

  private sectionsCard() {
    return html`<div class="card" data-default-sections><div class="ch-h"><h2>${ix('sectionsGroup')}</h2></div><div class="pad"><span class="checks">${SECTION_IDS.map(
      (s) => html`<label><input type="checkbox" data-section=${s} .checked=${this.sections.has(s)} @change=${() => { const n = new Set(this.sections); if (n.has(s)) n.delete(s); else n.add(s); if (n.size) this.sections = n; this.requestUpdate(); }} />${ix(`sec_${s}` as IxKey)}</label>`,
    )}</span>
      <label class="formrow" style="margin-block-start:12px">${ix('runsModeTitle')}<select class="inp" data-runs-mode @change=${(e: Event) => (this.runsMode = (e.target as HTMLSelectElement).value as RunsMode)}>
        ${RUNS_MODES.map((m) => html`<option value=${m} ?selected=${m === this.runsMode}>${ix(`runs_${m}` as IxKey)}</option>`)}</select>
        ${hasField(this.bad, 'report.generator_runs') ? html`<span class="ferr">${ix('fieldInvalid')}</span>` : nothing}</label></div></div>`;
  }

  private pairDialog() {
    const ed = this.editing;
    if (!ed) return nothing;
    const ents = this.entities ?? [];
    const doors = ents.filter((e) => e.domain === 'binary_sensor' && (e.device_class === null || DOOR_CLASSES.includes(e.device_class)));
    const locks = ents.filter((e) => e.domain === 'lock');
    const rex = ents.filter((e) => REX_DOMAINS.includes(e.domain) && e.entity_id !== ed.pair.sensor_entity_id);
    const set = (patch: Partial<DoorPair>) => (this.editing = { ...ed, pair: { ...ed.pair, ...patch } });
    const ok = !!ed.pair.sensor_entity_id;
    return html`<sw-dialog open heading=${ix('pairEdit')} @close=${() => (this.editing = null)}>
      ${this.entitiesError ? html`<div class="banner bad">${ix('pairsLoadError')}</div>` : nothing}
      <div class="formrow">${ix('pairDoor')}<select class="inp" data-pair-door @change=${(e: Event) => set({ sensor_entity_id: (e.target as HTMLSelectElement).value })}>
        <option value="" ?selected=${!ed.pair.sensor_entity_id}></option>${doors.map((d) => html`<option value=${d.entity_id} ?selected=${d.entity_id === ed.pair.sensor_entity_id}>${label(d)}</option>`)}</select></div>
      <div class="formrow">${ix('pairLock')}<select class="inp" data-pair-lock @change=${(e: Event) => set({ lock_entity_id: (e.target as HTMLSelectElement).value || null })}>
        <option value="" ?selected=${!ed.pair.lock_entity_id}>${ix('pairNoLock')}</option>${locks.map((d) => html`<option value=${d.entity_id} ?selected=${d.entity_id === ed.pair.lock_entity_id}>${label(d)}</option>`)}</select></div>
      <div class="formrow">${ix('pairRex')}<div class="checks" style="max-block-size:180px;overflow:auto">${rex.map((d) => html`<label><input type="checkbox" data-pair-rex .checked=${ed.pair.rex_entity_ids.includes(d.entity_id)}
        ?disabled=${!ed.pair.rex_entity_ids.includes(d.entity_id) && ed.pair.rex_entity_ids.length >= 4}
        @change=${() => set({ rex_entity_ids: this.toggleIn(ed.pair.rex_entity_ids, d.entity_id) })} />${label(d)}</label>`)}</div></div>
      <label class="checks"><span><input type="checkbox" data-pair-invert .checked=${ed.pair.invert} @change=${(e: Event) => set({ invert: (e.target as HTMLInputElement).checked })} /> ${ix('pairInvert')}</span></label>
      <div slot="footer" class="row"><button class="btn pri" data-pair-ok ?disabled=${!ok} @click=${() => {
        const f = this.form!;
        const pairs = ed.index < 0 ? [...f.pairs, ed.pair] : f.pairs.map((p, i) => (i === ed.index ? ed.pair : p));
        this.form = { ...f, pairs };
        this.editing = null;
      }}>${ix('pairAdd')}</button><button class="btn" @click=${() => (this.editing = null)}>${ix('close')}</button></div></sw-dialog>`;
  }

  // ---------------------------------------------------------------- the scheduled monthly delivery

  private dv<K extends keyof DeliveryEdit>(k: K): NonNullable<DeliveryEdit[K]> {
    return (this.delEdit[k] ?? this.del!.config[k]) as NonNullable<DeliveryEdit[K]>;
  }
  private setDel(patch: DeliveryEdit) {
    this.delEdit = { ...this.delEdit, ...patch };
    this.delNote = null;
  }

  private async saveDelivery(enabled?: boolean) {
    if (!this.del || this.delBusy) return;
    this.delBusy = true;
    this.delNote = null;
    this.delBad = [];
    try {
      this.del = await putDelivery({ config: this.delEdit, ...(enabled === undefined ? {} : { enabled }) });
      this.delEdit = {};
      this.delNote = { tone: 'ok', text: ix(enabled === true ? 'deliveryTurnedOn' : enabled === false ? 'deliveryTurnedOff' : 'deliverySaved') };
    } catch (e) {
      this.delBad = fieldErrors(e);
      this.delNote = { tone: 'bad', text: ix(isSetupIncomplete(e) ? 'deliverySetupMissing' : 'deliveryFailed') };
    } finally {
      this.delBusy = false;
    }
  }

  private problemText(p: string): string {
    return p === 'no_channel' || p === 'email_not_configured' || p === 'no_recipients' || p === 'report_off' ? ix(`problem_${p}` as IxKey) : p;
  }

  private deliveryCard() {
    const d = this.del;
    if (!d) return nothing;
    const dirty = Object.keys(this.delEdit).length > 0;
    const on = d.config.enabled;
    const wa = this.dv('whatsapp');
    const last = d.last ? ix('deliveryLast', { month: d.last.month, sent: d.last.counts.sent ?? 0 }) : ix('deliveryLastNone');
    return html`<div class="card" data-delivery><div class="ch-h"><h2>${ix('deliveryTitle')}</h2>
        <span class="sw" style="padding:0"><span class="muted" data-delivery-state>${on ? ix('deliveryOn', { day: d.config.dom, time: d.config.at }) : ix('deliveryOff')}</span>
          <sw-toggle data-delivery-switch .checked=${on} ?disabled=${!d.can_enable || this.delBusy || dirty || (!on && d.problems.length > 0)} label=${ix('deliveryEnable')} labelHidden
            @change=${(e: CustomEvent<{ checked: boolean }>) => void this.saveDelivery(e.detail.checked)}></sw-toggle></span></div>
      <div class="pad muted">${ix('deliveryMonthly')}</div>
      ${this.delNote ? html`<div class="banner ${this.delNote.tone}" data-delivery-note style="margin:0 14px 10px">${this.delNote.text}${this.delNote.tone === 'bad' && this.delBad.length ? ` ${this.delBad.map((p) => this.problemText(p)).join(' · ')}` : ''}</div>` : nothing}
      ${!on && d.problems.length ? html`<div class="pad ferr" data-delivery-problems>${ix('deliverySetupMissing')} ${d.problems.map((p) => this.problemText(p)).join(' · ')}</div>` : nothing}
      ${!d.can_enable && !on ? html`<div class="pad muted">${ix('deliveryNeedsAdmin')}</div>` : nothing}
      <div class="fields">
        <label>${ix('deliveryDom')}<select class="inp" data-delivery-dom @change=${(e: Event) => this.setDel({ dom: Number((e.target as HTMLSelectElement).value) })}>
          ${Array.from({ length: 28 }, (_, i) => i + 1).map((n) => html`<option value=${n} ?selected=${n === this.dv('dom')}>${n}</option>`)}</select></label>
        <label>${ix('deliveryAt')}<input class="inp" type="time" data-delivery-at .value=${this.dv('at')} @input=${(e: Event) => this.setDel({ at: (e.target as HTMLInputElement).value })} /></label>
        <label>${ix('deliveryLang')}<select class="inp" data-delivery-lang @change=${(e: Event) => this.setDel({ lang: (e.target as HTMLSelectElement).value as 'he' | 'en' })}>
          <option value="he" ?selected=${this.dv('lang') === 'he'}>עברית</option><option value="en" ?selected=${this.dv('lang') === 'en'}>English</option></select></label>
        <label>${ix('deliveryChannels')}<span class="checks">
          <label><input type="checkbox" data-delivery-email .checked=${this.dv('email')} @change=${(e: Event) => this.setDel({ email: (e.target as HTMLInputElement).checked })} />${ix('chEmail')}</label>
          <label><input type="checkbox" data-delivery-whatsapp .checked=${wa} @change=${(e: Event) => this.setDel({ whatsapp: (e.target as HTMLInputElement).checked })} />${ix('chWhatsapp')}</label></span>
          ${this.dv('email') ? html`<span class="muted">${ix('deliveryEmailHint')}</span>` : nothing}</label>
      </div>
      ${wa ? html`<div class="pad" data-delivery-recipients><div class="muted" style="margin-block-end:6px">${ix('deliveryRecipients')}</div>
        <div class="checks" style="max-block-size:150px;overflow:auto">${d.recipients.map((u) => {
          const picked = this.dv('users').includes(u.id);
          return html`<label><input type="checkbox" data-delivery-user=${u.id} .checked=${picked} ?disabled=${u.reach === 'no_permission' && !picked}
            @change=${() => this.setDel({ users: this.toggleIn(this.dv('users'), u.id) })} />${u.name} <span class="muted">· ${ix(`reach_${u.reach}` as IxKey)}</span></label>`;
        })}</div></div>` : nothing}
      <div class="pad row" style="justify-content:space-between"><span class="muted" data-delivery-last>${last}</span>
        <button class="btn pri" data-delivery-save ?disabled=${!dirty || this.delBusy} @click=${() => void this.saveDelivery()}>${ix('deliverySave')}</button></div></div>`;
  }

  render() {
    if (this.phase === 'loading') return html`<div class="card" aria-busy="true" data-state="loading"><div class="rs"><div class="skel" style="block-size:120px"></div></div></div>`;
    if (this.phase === 'forbidden') return html`<sw-state-panel state="forbidden" data-state="forbidden"></sw-state-panel>`;
    if (this.phase === 'error' || !this.ans || !this.form) return html`<div class="card"><div class="blank" data-state="error"><sw-icon name="warning"></sw-icon><b>${ix('errorTitle')}</b><button class="btn pri" @click=${() => void this.load()}>${ix('retry')}</button></div></div>`;
    return html`<div class="head"><h1>${ix('setTitle')}</h1><button class="btn pri" data-save ?disabled=${this.busy} @click=${() => void this.save()}>${ix('save')}</button></div>
      ${this.note ? html`<div class="banner ${this.note.tone}" data-note style="margin-block-end:14px">${this.note.text}</div>` : nothing}
      <div class="set">${this.switchesCard()}${this.pairsCard()}${this.thresholds()}${this.sectionsCard()}${this.deliveryCard()}
        <div class="card"><div class="ch-h"><h2>${ix('protectedTitle')}</h2><a class="btn" href="#/system?tab=devices">${ix('protectedOpen')}</a></div></div></div>
      ${this.pairDialog()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'insights-settings': InsightsSettings;
  }
}

export { BOUNDS };
