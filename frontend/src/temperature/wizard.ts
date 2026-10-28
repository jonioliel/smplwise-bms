import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { describeError } from '../api/client';
import { createUnit, deleteUnit, listCandidates, listManaged, updateUnit, type Candidate, type ManageResponse, type UnitKind } from '../api/temperature';
import { listGroups, listUsers, type AccessGroup, type DirectoryUser } from '../api/access';
import { KIND_KEY, bodyOf, deg, draftOf, fmt1, friendlyName, newDraft, problemOf, ruleOf, setRule, type Draft } from './model';
import { gauge } from './charts';
import { tempCss } from './styles';
import { tt, type TtKey } from '../i18n/temperature';
import { dateInputLang } from '../api/day-format';

const ROLE_KEYS: [string, string][] = [['viewer', 'צופים'], ['operator', 'מפעילים'], ['site_admin', 'מנהלי אתר'], ['system_admin', 'מנהלי מערכת']];
type Defaults = Record<string, boolean | number | string>;

/**
 * CR-INFRA-TEMPERATURE 2.9.1: the add / edit wizard of a unit (managers, from page edit mode or the detail's "עריכה"). Four steps, as in the
 * owner-approved mockup:
 *   1 · sensors - name, area, kind; the temperature source from temperature SENSORS and CLIMATE entities (air conditioners / HVAC controllers
 *       / thermostats; owner 2026-10-19), grouped and searchable with their live values; an optional door sensor with "invert";
 *   2 · band and rules - low / high (templates), or for a climate unit "follow the setpoint" with a tolerance; the alert rules (door > X, above
 *       for Z, below for Z, sensor silent for N, warning from the first moment) - each shows the installation default and may be changed here;
 *   3 · alerts and windows - who receives (the installation's routing or a list of the unit's own), quiet hours (warnings only), the defrost
 *       window: learn automatically (default; owner 2026-10-19: optional), a fixed window, or none;
 *   4 · summary - the preview gauge and every choice; save.
 * Friendly names everywhere; the technical id is shown small to the manager (owner decision 7).
 */
@customElement('temp-wizard')
export class TempWizard extends LitElement {
  @property() unitId: string | null = null;
  @state() private step = 1;
  @state() private d: Draft = newDraft();
  @state() private meta: ManageResponse | null = null;
  @state() private temps: Candidate[] = [];
  @state() private doors: Candidate[] = [];
  /** phase 3 (idea 6): smart plugs / power meters for the compressor duty cycle (read only) */
  @state() private powers: Candidate[] = [];
  @state() private qp = '';
  @state() private users: DirectoryUser[] = [];
  @state() private groups: AccessGroup[] = [];
  @state() private qt = '';
  @state() private qd = '';
  @state() private qu = '';
  @state() private err = '';
  @state() private busy = false;

  static styles = [tempCss, css`
    :host { position: fixed; inset: 0; z-index: var(--sw-z-modal); display: grid; place-items: center; padding: 16px; box-sizing: border-box; }
    .ovl { position: absolute; inset: 0; background: var(--sw-overlay); }
    .sheet {
      position: relative; inline-size: min(780px, 100%); max-block-size: calc(100dvh - 32px); display: flex; flex-direction: column; background: var(--sw-bg);
      border-radius: var(--sw-r-2xl); box-shadow: var(--sw-shadow-3); overflow: hidden;
    }
    /* R5-MEDIA-ENERGY-297 (emil: modals 200-400 ms, ease-out, never from scale(0)): the sheet lands in 300 ms from 0.96 with a fade */
    .ovl { opacity: 1; transition: opacity var(--sw-t-slow) var(--sw-ease); }
    .sheet { opacity: 1; transform: scale(1); transition: opacity 300ms var(--sw-ease-out), transform 300ms cubic-bezier(0.23, 1, 0.32, 1); }
    @starting-style { .ovl { opacity: 0; } .sheet { opacity: 0; transform: scale(0.96); } }
    .wh { display: flex; align-items: center; gap: 10px; padding: 16px 20px 8px; }
    /* R5-MEDIA-ENERGY-297: the wizard's title is a title; the step bar is a real bar; a rule row is a well, not an outlined box */
    .wh h2 { margin: 0; flex: 1; font-size: var(--sw-fs-2xl); font-weight: 800; letter-spacing: -0.02em; color: var(--sw-heading); }
    .icb { inline-size: 36px; block-size: 36px; padding: 0; justify-content: center; }
    .steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 0 20px 10px; }
    .steps button { border: 0; background: transparent; font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text-2); text-align: start; padding: 0; cursor: pointer; display: grid; gap: 6px; }
    .steps i { display: block; block-size: 6px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); transition: background-color var(--sw-t-med) var(--sw-ease); }
    .steps button[aria-current='step'] { color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); }
    .steps button[aria-current='step'] i, .steps button[data-done] i { background: var(--sw-accent); }
    .wb { flex: 1; overflow: auto; padding: 8px 20px 16px; display: grid; gap: 14px; align-content: start; }
    .wf { display: flex; gap: 8px; align-items: center; padding: 12px 20px; border-block-start: 1px solid var(--sw-border); background: var(--sw-surface); }
    .wf .sp { flex: 1; }
    .f2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field { display: grid; gap: 6px; min-inline-size: 0; }
    .field > label, .lbl { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .in {
      min-block-size: var(--sw-ctl-h-md); border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text);
      padding: 0 12px; font: inherit; box-sizing: border-box; inline-size: 100%;
    }
    .in:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }
    .in.n { inline-size: 76px; text-align: center; min-block-size: 32px; padding: 0 6px; }
    .slist { border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); max-block-size: 230px; overflow: auto; background: var(--sw-surface); }
    .grp { padding: 6px 12px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); background: var(--sw-surface-2); position: sticky; inset-block-start: 0; }
    .sopt {
      display: flex; align-items: center; gap: 10px; inline-size: 100%; border: 0; border-block-end: 1px solid var(--sw-border); background: transparent; padding: 8px 12px;
      font: inherit; color: inherit; text-align: start; cursor: pointer;
    }
    .sopt[aria-selected='true'] { background: var(--sw-accent-soft); }
    .sopt .tx { flex: 1; min-inline-size: 0; display: grid; }
    .sopt .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sopt .lv { font-variant-numeric: tabular-nums; color: var(--sw-text-2); white-space: nowrap; direction: ltr; }
    .sw { display: inline-flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); cursor: pointer; }
    .sw input { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    .rule { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 0; border-radius: var(--sw-r-md); background: var(--sw-surface-2); flex-wrap: wrap; }
    .rule .txt { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1; font-size: var(--sw-fs-sm); }
    .rule[data-off] .txt { opacity: 0.55; }
    .tpl { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .gprev { display: flex; gap: 16px; align-items: center; }
    .seg { display: inline-flex; background: var(--sw-surface-2); border-radius: var(--sw-r-pill); padding: 3px; gap: 2px; flex-wrap: wrap; }
    .seg button { border: 0; background: transparent; border-radius: var(--sw-r-pill); padding: 5px 12px; font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text-2); cursor: pointer; }
    .seg button[aria-pressed='true'] { background: var(--sw-surface); color: var(--sw-text); box-shadow: var(--sw-shadow-1); font-weight: var(--sw-fw-semibold); }
    .opts { display: flex; flex-wrap: wrap; gap: 6px 16px; }
    .opts.scroll { max-block-size: 160px; overflow: auto; }
    .summ { display: grid; gap: 4px; font-size: var(--sw-fs-sm); flex: 1; }
    .summ > div { display: flex; justify-content: space-between; gap: 10px; border-block-end: 1px solid var(--sw-border); padding-block: 5px; }
    .summ span { color: var(--sw-text-2); }
    .banner { display: flex; gap: 10px; align-items: center; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--sw-accent-soft); color: var(--sw-accent-text); font-size: var(--sw-fs-sm); }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .def { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    details.more { border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); padding: 10px 12px; background: var(--sw-surface); }
    details.more > summary { cursor: pointer; list-style-position: inside; }
    @media (max-width: 600px) {
      :host { padding: 0; }
      .sheet { inline-size: 100%; max-block-size: 100dvh; block-size: 100dvh; border-radius: 0; }
      .f2 { grid-template-columns: 1fr; }
      .steps button { font-size: var(--sw-fs-xs); }
      .gprev { flex-direction: column; }
    }
  `];

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
    void this.load();
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.onKey);
    super.disconnectedCallback();
  }

  private async load() {
    try {
      const [meta, temps, doors] = await Promise.all([listManaged(), listCandidates('temp'), listCandidates('door')]);
      this.meta = meta;
      this.temps = temps.items;
      this.doors = doors.items;
      void listCandidates('power').then((r) => (this.powers = r.items)).catch(() => (this.powers = [])); // an older server: no power sensors
      const m = this.unitId ? meta.units.find((u) => u.id === this.unitId) : null;
      if (m) this.d = draftOf(m);
    } catch (e) {
      this.err = describeError(e);
    }
    void listUsers().then((r) => (this.users = r.users.filter((u) => u.active))).catch(() => undefined);
    void listGroups().then((r) => (this.groups = r.groups)).catch(() => undefined);
  }

  private close() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private get defaults(): Defaults {
    return this.meta?.defaults ?? {};
  }

  private get isClimate(): boolean {
    return this.d.temp_entity_id.startsWith('climate.');
  }

  private patch(p: Partial<Draft>) {
    this.d = { ...this.d, ...p };
  }

  private rule<T extends boolean | number | string>(key: string): T {
    return ruleOf<T>(this.d, this.defaults, key);
  }

  private setRule(key: string, v: boolean | number | string) {
    this.d = setRule(this.d, this.defaults, key, v);
  }

  private num(e: Event): number {
    return Number((e.target as HTMLInputElement).value);
  }

  private go(n: number) {
    if (n > this.step) {
      for (let s = this.step; s < n; s++) {
        const p = problemOf(this.d, s);
        if (p) {
          this.err = tt(p);
          this.step = s;
          return;
        }
      }
    }
    this.err = '';
    this.step = n;
  }

  private async save() {
    const p = problemOf(this.d, 0);
    if (p) {
      this.err = tt(p);
      return;
    }
    this.busy = true;
    this.err = '';
    try {
      if (this.d.id) await updateUnit(this.d.id, bodyOf(this.d));
      else await createUnit(bodyOf(this.d));
      this.dispatchEvent(new CustomEvent('saved', { detail: tt('saved') }));
    } catch (e) {
      this.err = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async removeUnit() {
    if (!this.d.id || !window.confirm(tt('removeConfirm', { name: this.d.name }))) return;
    this.busy = true;
    try {
      await deleteUnit(this.d.id);
      this.dispatchEvent(new CustomEvent('removed', { detail: tt('saved') }));
    } catch (e) {
      this.err = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private pickTemp(c: Candidate) {
    const climate = c.group === 'climate';
    const p: Partial<Draft> = { temp_entity_id: c.entity_id };
    if (!this.d.name.trim()) p.name = friendlyName(c.name, '');
    if (climate && !this.d.id) {
      p.band_mode = 'setpoint';
      p.kind = 'room';
      p.defrost_mode = 'none';
      if (c.setpoint !== null) {
        p.low = Math.round(c.setpoint - 2);
        p.high = Math.round(c.setpoint + 2);
      }
    }
    this.patch(p);
  }

  private sensorList(kind: 'temp' | 'door') {
    const q = (kind === 'temp' ? this.qt : this.qd).trim().toLowerCase();
    const list = (kind === 'temp' ? this.temps : this.doors).filter((c) => !q || c.name.toLowerCase().includes(q) || c.entity_id.includes(q) || (c.area_name ?? '').toLowerCase().includes(q));
    const cur = kind === 'temp' ? this.d.temp_entity_id : this.d.door_entity_id;
    const opt = (c: Candidate) => html`<button type="button" class="sopt" role="option" aria-selected=${String(cur === c.entity_id)} data-cand=${c.entity_id}
        @click=${() => (kind === 'temp' ? this.pickTemp(c) : this.patch({ door_entity_id: c.entity_id }))}>
      <sw-icon name=${kind === 'door' ? 'door' : c.group === 'climate' ? 'fan' : 'thermometer'} size="16"></sw-icon>
      <span class="tx"><span class="nm">${friendlyName(c.name, c.area_name ?? '')}${c.area_name ? html` <span class="def">· ${c.area_name}</span>` : nothing}</span></span>
      <span class="lv">${kind === 'door' ? (c.state === 'on' ? tt('doorOpenWord') : c.state === 'off' ? tt('doorClosedWord') : '') : c.value === null ? tt('disconnected') : `${fmt1(c.value)}°${c.setpoint !== null ? ` → ${fmt1(c.setpoint)}°` : ''}`}</span></button>`;
    if (kind === 'door') {
      return html`<div class="slist" role="listbox" aria-label=${tt('doorSensor')} data-door-list>
        <button type="button" class="sopt" role="option" aria-selected=${String(!this.d.door_entity_id)} data-cand="" @click=${() => this.patch({ door_entity_id: null, door_invert: false })}>
          <sw-icon name="close" size="16"></sw-icon><span class="tx"><span class="nm">${tt('noDoorSensor')}</span></span></button>
        ${list.map(opt)}</div>`;
    }
    const sensors = list.filter((c) => c.group === 'sensor');
    const climate = list.filter((c) => c.group === 'climate');
    return html`<div class="slist" role="listbox" aria-label=${tt('tempSensor')} data-temp-list>
      ${sensors.length ? html`<div class="grp" data-grp="sensor">${tt('groupSensors')}</div>${sensors.map(opt)}` : nothing}
      ${climate.length ? html`<div class="grp" data-grp="climate">${tt('groupClimate')}</div>${climate.map(opt)}` : nothing}
      ${!list.length ? html`<p class="hint" style="padding:10px">${tt('noSensors')}</p>` : nothing}</div>`;
  }

  private step1() {
    const door = this.doors.find((c) => c.entity_id === this.d.door_entity_id);
    const now = door?.state ? ((door.state === 'on') !== this.d.door_invert ? tt('doorOpenWord') : tt('doorClosedWord')) : '';
    return html`<div class="f2">
        <div class="field"><label for="w-name">${tt('name')}</label><input id="w-name" class="in" .value=${this.d.name} placeholder=${tt('namePh')} maxlength="60"
          @input=${(e: Event) => this.patch({ name: (e.target as HTMLInputElement).value })} data-w-name /></div>
        <div class="field"><label for="w-area">${tt('area')}</label><select id="w-area" class="in" @change=${(e: Event) => this.patch({ area_id: (e.target as HTMLSelectElement).value || null })} data-w-area>
          <option value="" ?selected=${!this.d.area_id}>${tt('noArea')}</option>
          ${(this.meta?.areas ?? []).map((a) => html`<option value=${a.area_id} ?selected=${this.d.area_id === a.area_id}>${a.name}${a.floor_name ? ` · ${a.floor_name}` : ''}</option>`)}</select></div>
      </div>
      <div class="field"><label for="w-kind">${tt('kind')}</label><select id="w-kind" class="in" @change=${(e: Event) => this.patch({ kind: (e.target as HTMLSelectElement).value as UnitKind })} data-w-kind>
        ${(this.meta?.kinds ?? []).map((k) => html`<option value=${k} ?selected=${this.d.kind === k}>${tt(KIND_KEY[k])}</option>`)}</select></div>
      <div class="field"><span class="lbl">${tt('tempSensor')} <span class="chip" data-tone="err">${tt('required')}</span></span>
        <input class="in" type="search" placeholder=${tt('searchTemp')} .value=${this.qt} @input=${(e: Event) => { this.qt = (e.target as HTMLInputElement).value; }} aria-label=${tt('searchTemp')} />
        ${this.sensorList('temp')}<span class="hint">${tt('tempHint')}${this.isClimate ? html` · ${tt('climateHint')}` : nothing}</span></div>
      <div class="field"><span class="lbl">${tt('doorSensor')} <span class="chip">${tt('optional')}</span></span>
        <input class="in" type="search" placeholder=${tt('searchDoor')} .value=${this.qd} @input=${(e: Event) => { this.qd = (e.target as HTMLInputElement).value; }} aria-label=${tt('searchDoor')} />
        ${this.sensorList('door')}
        ${this.d.door_entity_id ? html`<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center"><label class="sw"><input type="checkbox" .checked=${this.d.door_invert}
            @change=${(e: Event) => this.patch({ door_invert: (e.target as HTMLInputElement).checked })} data-w-invert /><span>${tt('invert')}</span></label>${now ? html`<span class="hint">${tt('doorNow', { s: now })}</span>` : nothing}</div>` : nothing}</div>
      ${this.powers.length || this.d.power_entity_id ? this.powerField() : nothing}`;
  }

  /** Phase 3 (idea 6): the optional power sensor of the unit - read only; the compressor's share of running time. */
  private powerField() {
    const q = this.qp.trim().toLowerCase();
    const list = this.powers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.entity_id.includes(q) || (c.area_name ?? '').toLowerCase().includes(q));
    const cur = this.d.power_entity_id;
    return html`<div class="field" data-w-power><span class="lbl">${tt('powerSensor')} <span class="chip">${tt('optional')}</span></span>
      <input class="in" type="search" placeholder=${tt('searchPower')} .value=${this.qp} @input=${(e: Event) => { this.qp = (e.target as HTMLInputElement).value; }} aria-label=${tt('searchPower')} />
      <div class="slist" role="listbox" aria-label=${tt('powerSensor')} data-power-list>
        <button type="button" class="sopt" role="option" aria-selected=${String(!cur)} data-cand="" @click=${() => this.patch({ power_entity_id: null })}>
          <sw-icon name="close" size="16"></sw-icon><span class="tx"><span class="nm">${tt('noPowerSensor')}</span></span></button>
        ${list.map((c) => html`<button type="button" class="sopt" role="option" aria-selected=${String(cur === c.entity_id)} data-cand=${c.entity_id} @click=${() => this.patch({ power_entity_id: c.entity_id })}>
          <sw-icon name="power" size="16"></sw-icon><span class="tx"><span class="nm">${friendlyName(c.name, c.area_name ?? '')}${c.area_name ? html` <span class="def">· ${c.area_name}</span>` : nothing}</span></span>
          <span class="lv">${c.watts === null || c.watts === undefined ? tt('disconnected') : `${Math.round(c.watts)} W`}</span></button>`)}</div>
      <span class="hint">${tt('powerHint')}</span>
      ${cur ? html`<label class="sw">${tt('compressorOnW')}<input class="in n" type="number" step="1" min="0.5" max="5000" .value=${String(this.rule<number>('compressor_on_w'))}
        @change=${(e: Event) => this.setRule('compressor_on_w', Math.max(0.5, this.num(e)))} data-w-onw /></label>` : nothing}</div>`;
  }

  /** Phase 3: a switch row of a rule, with "default: x" when this unit overrides it. */
  private check(key: string, label: TtKey) {
    return html`<label class="sw" data-w-rule=${key}><input type="checkbox" .checked=${this.rule<boolean>(key)} @change=${(e: Event) => this.setRule(key, (e.target as HTMLInputElement).checked)} />${tt(label)}
      ${key in this.d.rules ? html`<span class="def">${tt('fromDefault', { v: String(this.defaults[key]) })}</span>` : nothing}</label>`;
  }

  private numRule(key: string, label: TtKey, min: number, max: number, step = 1) {
    return html`<label class="sw" data-w-rule=${key}>${tt(label)}<input class="in n" type="number" min=${min} max=${max} step=${step} .value=${String(this.rule<number>(key))}
      @change=${(e: Event) => this.setRule(key, Math.max(min, Math.min(max, step === 1 ? Math.round(this.num(e)) : this.num(e))))} />
      ${key in this.d.rules ? html`<span class="def">${tt('fromDefault', { v: String(this.defaults[key]) })}</span>` : nothing}</label>`;
  }

  /** Phase 3 (owner 2026-10-20: every capability a setting): the forecast, maintenance, escalation, sensor health and cooling-fault rules. */
  private phase3Rules() {
    const d = this.d;
    return html`<details class="field more" data-w-phase3><summary class="lbl">${tt('phase3Title')}</summary><div style="display:grid;gap:8px;padding-block-start:8px">
      ${this.check('predict_enabled', 'predictEnabled')}
      ${this.rule<boolean>('predict_enabled') ? html`${this.numRule('predict_horizon_min', 'predictHorizon', 5, 240)}${this.check('predict_warn', 'predictWarn')}${this.rule<boolean>('predict_warn') ? this.numRule('predict_warn_min', 'predictWarnMin', 5, 240) : nothing}` : nothing}
      ${this.check('escalation_enabled', 'escalationUnit')}
      ${this.check('maintenance_includes_alarms', 'maintAlarms')}
      ${this.numRule('maintenance_max_min', 'maintMax', 15, 1440)}
      ${this.check('health_warn', 'healthWarn')}
      ${this.numRule('battery_low_pct', 'batteryLow', 5, 60)}
      ${this.numRule('frozen_min', 'frozenMin', 0, 2880)}
      ${d.door_entity_id ? html`${this.check('recovery_alert', 'recoveryAlert')}${this.numRule('recovery_slow_min', 'recoverySlow', 5, 240)}` : nothing}
      ${d.power_entity_id ? html`${this.check('duty_alert', 'dutyAlert')}${this.numRule('duty_rise_pts', 'dutyRise', 5, 80)}` : nothing}
    </div></details>`;
  }

  private ruleRow(onKey: string, minKey: string, lead: TtKey, chip: 'alarm' | 'warn', icon: string, extra?: unknown) {
    const on = this.rule<boolean>(onKey);
    const def = this.defaults[minKey];
    return html`<div class="rule" ?data-off=${!on} data-rule=${onKey}><label class="sw"><input type="checkbox" .checked=${on} aria-label=${tt(lead)} @change=${(e: Event) => this.setRule(onKey, (e.target as HTMLInputElement).checked)} /></label>
      <div class="txt"><sw-icon name=${icon} size="16"></sw-icon>${tt(lead)}<input class="in n" type="number" min="0" max="1440" .value=${String(this.rule<number>(minKey))} aria-label=${tt('minutes')}
        @change=${(e: Event) => this.setRule(minKey, Math.max(0, Math.round(this.num(e))))} data-rule-min=${minKey} />${tt('minutes')}
        <span class="chip" data-tone=${chip === 'alarm' ? 'err' : 'warn'}>${tt(chip === 'alarm' ? 'chipAlarm' : 'chipWarn')}</span>${extra ?? nothing}
        ${minKey in this.d.rules ? html`<span class="def">${tt('fromDefault', { v: String(def) })}</span>` : nothing}</div></div>`;
  }

  private step2() {
    const d = this.d;
    const tpl = this.meta?.templates ?? {};
    const preview = { low: d.low, high: d.high, value: null, value_last: null };
    return html`<div class="gprev">${gauge(preview, 'ok', null, 120)}
        <div style="flex:1;display:grid;gap:10px">
          ${this.isClimate ? html`<div class="field"><span class="lbl">${tt('bandMode')}</span><span class="seg" role="group">
            <button type="button" aria-pressed=${String(d.band_mode === 'fixed')} data-band="fixed" @click=${() => this.patch({ band_mode: 'fixed' })}>${tt('bandFixed')}</button>
            <button type="button" aria-pressed=${String(d.band_mode === 'setpoint')} data-band="setpoint" @click=${() => this.patch({ band_mode: 'setpoint' })}>${tt('bandSetpoint')}</button></span>
            ${d.band_mode === 'setpoint' ? html`<label class="sw">${tt('tolerance')}<input class="in n" type="number" step="0.5" min="0.1" max="20" .value=${String(this.rule<number>('setpoint_tolerance'))}
                @change=${(e: Event) => this.setRule('setpoint_tolerance', this.num(e))} data-w-tol /></label><span class="hint">${tt('bandSetpointHint', { v: `±${this.rule<number>('setpoint_tolerance')}°` })}</span>` : nothing}</div>` : nothing}
          <div class="f2">
            <div class="field"><label for="w-low">${tt('low')}</label><input id="w-low" class="in" type="number" step="0.5" .value=${String(d.low)} @change=${(e: Event) => this.patch({ low: this.num(e) })} data-w-low /></div>
            <div class="field"><label for="w-high">${tt('high')}</label><input id="w-high" class="in" type="number" step="0.5" .value=${String(d.high)} @change=${(e: Event) => this.patch({ high: this.num(e) })} data-w-high /></div>
          </div>
          <div class="tpl"><span class="hint">${tt('templates')}</span>${Object.entries(tpl).map(([k, v]) => html`<button type="button" class="btn sm ghost" data-tpl=${k}
            @click=${() => this.patch({ low: v[0], high: v[1], kind: k as UnitKind })}>${tt(KIND_KEY[k as UnitKind])} ${deg(v[0])}–${deg(v[1])}</button>`)}</div>
        </div></div>
      <div class="field"><span class="lbl">${tt('rulesTitle')}</span><div style="display:grid;gap:8px">
        ${d.door_entity_id ? this.ruleRow('door_alarm', 'door_alarm_min', 'ruleDoor', 'alarm', 'doorOpen') : nothing}
        ${this.ruleRow('high_alarm', 'high_alarm_min', 'ruleHigh', 'alarm', 'arrowUp', html`<span class="hint">· ${tt('ruleWarnNow')}</span>`)}
        ${this.ruleRow('low_alarm', 'low_alarm_min', 'ruleLow', 'alarm', 'snow')}
        ${this.ruleRow('offline_warn', 'offline_min', 'ruleOffline', 'warn', 'offline')}
        <label class="sw"><input type="checkbox" .checked=${this.rule<boolean>('warn_on_excursion')} @change=${(e: Event) => this.setRule('warn_on_excursion', (e.target as HTMLInputElement).checked)} data-w-warnnow /><span>${tt('ruleWarnNow')}</span></label>
        ${this.isClimate ? html`<label class="sw"><input type="checkbox" .checked=${this.rule<boolean>('alert_when_off')} @change=${(e: Event) => this.setRule('alert_when_off', (e.target as HTMLInputElement).checked)} data-w-whenoff /><span>${tt('alertWhenOff')}</span></label><span class="hint">${tt('offHint')}</span>` : nothing}
      </div></div>`;
  }

  private step3() {
    const d = this.d;
    const toggle = (list: string[], v: string, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));
    const uq = this.qu.trim().toLowerCase();
    const users = this.users.filter((u) => !uq || u.name.toLowerCase().includes(uq) || u.username.toLowerCase().includes(uq)).slice(0, 80);
    const hard = this.rule<number>('defrost_hard_margin');
    return html`<div class="field"><span class="lbl">${tt('who')}</span>
        <span class="seg" role="group"><button type="button" aria-pressed=${String(!d.ownRecipients)} data-who="default" @click=${() => this.patch({ ownRecipients: false })}>${tt('whoDefault')}</button>
          <button type="button" aria-pressed=${String(d.ownRecipients)} data-who="own" @click=${() => this.patch({ ownRecipients: true })}>${tt('whoOwn')}</button></span>
        ${d.ownRecipients ? html`<div style="display:grid;gap:8px">
          <span class="hint">${tt('roles')}</span><div class="opts">${ROLE_KEYS.map(([id, label]) => html`<label class="sw"><input type="checkbox" .checked=${d.recipients.roles.includes(id)}
            @change=${(e: Event) => this.patch({ recipients: { ...d.recipients, roles: toggle(d.recipients.roles, id, (e.target as HTMLInputElement).checked) } })} />${label}</label>`)}</div>
          ${this.users.length ? html`<span class="hint">${tt('users')}</span><input class="in" type="search" .value=${this.qu} @input=${(e: Event) => { this.qu = (e.target as HTMLInputElement).value; }} aria-label=${tt('users')} />
            <div class="opts scroll">${users.map((u) => html`<label class="sw"><input type="checkbox" .checked=${d.recipients.users.includes(u.id)}
              @change=${(e: Event) => this.patch({ recipients: { ...d.recipients, users: toggle(d.recipients.users, u.id, (e.target as HTMLInputElement).checked) } })} />${u.name || u.username}</label>`)}</div>` : nothing}
          ${this.groups.length ? html`<span class="hint">${tt('groups')}</span><div class="opts">${this.groups.map((g) => html`<label class="sw"><input type="checkbox" .checked=${d.recipients.groups.includes(g.id)}
              @change=${(e: Event) => this.patch({ recipients: { ...d.recipients, groups: toggle(d.recipients.groups, g.id, (e.target as HTMLInputElement).checked) } })} />${g.name}</label>`)}</div>` : nothing}
        </div>` : nothing}</div>
      <div class="field"><span class="lbl">${tt('quiet')}</span><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label class="sw"><input type="checkbox" .checked=${this.rule<boolean>('quiet_enabled')} @change=${(e: Event) => this.setRule('quiet_enabled', (e.target as HTMLInputElement).checked)} data-w-quiet /></label>
        <input class="in" style="inline-size:auto" type="time" lang=${dateInputLang()} .value=${this.rule<string>('quiet_from')} ?disabled=${!this.rule<boolean>('quiet_enabled')} @change=${(e: Event) => this.setRule('quiet_from', (e.target as HTMLInputElement).value)} aria-label=${tt('start')} />
        <span>${tt('to')}</span>
        <input class="in" style="inline-size:auto" type="time" lang=${dateInputLang()} .value=${this.rule<string>('quiet_to')} ?disabled=${!this.rule<boolean>('quiet_enabled')} @change=${(e: Event) => this.setRule('quiet_to', (e.target as HTMLInputElement).value)} aria-label=${tt('to')} /></div></div>
      <div class="field" data-w-holds><label class="sw"><input type="checkbox" .checked=${this.rule<boolean>('alerts_enabled')} @change=${(e: Event) => this.setRule('alerts_enabled', (e.target as HTMLInputElement).checked)} data-w-alerts />${tt('alertsEnabled')}</label>
        <label class="sw"><input type="checkbox" .checked=${this.rule<boolean>('quiet_includes_alarms')} @change=${(e: Event) => this.setRule('quiet_includes_alarms', (e.target as HTMLInputElement).checked)} />${tt('quietAlarms')}</label>
        <label class="sw"><input type="checkbox" .checked=${this.rule<boolean>('mute_includes_alarms')} @change=${(e: Event) => this.setRule('mute_includes_alarms', (e.target as HTMLInputElement).checked)} />${tt('muteAlarms')}</label>
        <span class="hint">${tt('alarmsNever')}</span></div>
      ${this.phase3Rules()}
      <div class="field"><span class="lbl">${tt('defrost')}</span>
        <span class="seg" role="group" data-w-defrost>${(['learn', 'fixed', 'none'] as const).map((m) => html`<button type="button" aria-pressed=${String(d.defrost_mode === m)} data-mode=${m}
          @click=${() => this.patch({ defrost_mode: m, defrost_windows: m === 'fixed' && !d.defrost_windows.length ? [{ start: '03:00', minutes: 30 }] : d.defrost_windows })}>${tt(m === 'learn' ? 'modeLearn' : m === 'fixed' ? 'modeFixed' : 'modeNone')}</button>`)}</span>
        <span class="hint">${tt(d.defrost_mode === 'learn' ? 'defrostLearnHint' : d.defrost_mode === 'fixed' ? 'defrostFixedHint' : 'defrostNoneHint')}</span>
        ${d.defrost_mode === 'fixed' ? html`<div style="display:grid;gap:6px">${d.defrost_windows.map((w, i) => html`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap" data-w-window=${i}>
            <input class="in" style="inline-size:auto" type="time" lang=${dateInputLang()} .value=${w.start} aria-label=${tt('start')} @change=${(e: Event) => this.patch({ defrost_windows: d.defrost_windows.map((x, j) => (j === i ? { ...x, start: (e.target as HTMLInputElement).value } : x)) })} />
            <span>${tt('duration')}</span><input class="in n" type="number" min="5" max="180" .value=${String(w.minutes)} aria-label=${tt('duration')}
              @change=${(e: Event) => this.patch({ defrost_windows: d.defrost_windows.map((x, j) => (j === i ? { ...x, minutes: Math.max(5, Math.min(180, Math.round(this.num(e)))) } : x)) })} />
            <button type="button" class="btn sm ghost" aria-label=${tt('removeWindow')} @click=${() => this.patch({ defrost_windows: d.defrost_windows.filter((_x, j) => j !== i) })}><sw-icon name="close" size="14"></sw-icon></button></div>`)}
          ${d.defrost_windows.length < 6 ? html`<button type="button" class="btn sm" style="justify-self:start" @click=${() => this.patch({ defrost_windows: [...d.defrost_windows, { start: '15:00', minutes: 30 }] })}><sw-icon name="plus" size="14"></sw-icon>${tt('addWindow')}</button>` : nothing}</div>` : nothing}
        ${d.defrost_mode !== 'none' ? html`<label class="sw"><input type="checkbox" .checked=${this.rule<boolean>('exclude_defrost_stats')} @change=${(e: Event) => this.setRule('exclude_defrost_stats', (e.target as HTMLInputElement).checked)} data-w-exclude /><span>${tt('excludeStats')}</span></label>
          <label class="sw">${tt('hardMargin')}<input class="in n" type="number" step="0.5" min="0" max="50" .value=${String(hard)} @change=${(e: Event) => this.setRule('defrost_hard_margin', this.num(e))} data-w-hard /></label>
          <span class="hint">${tt('hardMax', { v: deg((d.band_mode === 'setpoint' && this.isClimate ? d.high : d.high) + hard) })}</span>` : nothing}</div>`;
  }

  private step4() {
    const d = this.d;
    const temp = this.temps.find((c) => c.entity_id === d.temp_entity_id);
    const door = this.doors.find((c) => c.entity_id === d.door_entity_id);
    const preview = { low: d.low, high: d.high, value: temp?.value ?? null, value_last: null };
    const defrost = d.defrost_mode === 'learn' ? tt('modeLearn') : d.defrost_mode === 'none' ? tt('modeNone') : d.defrost_windows.map((w) => `${w.start} · ${w.minutes}′`).join(', ');
    return html`<div class="gprev">${gauge(preview, 'ok', null, 130)}<div class="summ" data-w-summary>
        <div><span>${tt('name')}</span><b>${d.name || '—'}</b></div>
        <div><span>${tt('tempSensor')}</span><b>${friendlyName(temp?.name, d.name)}</b></div>
        <div><span>${tt('doorSensor')}</span><b>${door ? friendlyName(door.name, d.name) : tt('none')}${door && d.door_invert ? ' ⇄' : ''}</b></div>
        ${d.power_entity_id ? html`<div><span>${tt('powerSensor')}</span><b>${this.powers.find((c) => c.entity_id === d.power_entity_id)?.name ?? d.name}</b></div>` : nothing}
        <div><span>${tt('bandMode')}</span><b dir="ltr">${this.isClimate && d.band_mode === 'setpoint' ? `${tt('bandSetpoint')} ±${this.rule<number>('setpoint_tolerance')}°` : `${deg(d.low)} – ${deg(d.high)}`}</b></div>
        <div><span>${tt('rulesTitle')}</span><b>${[this.rule<boolean>('high_alarm') ? `↑ ${this.rule<number>('high_alarm_min')}′` : '', this.rule<boolean>('low_alarm') ? `↓ ${this.rule<number>('low_alarm_min')}′` : '', d.door_entity_id && this.rule<boolean>('door_alarm') ? `${tt('kDoor')} ${this.rule<number>('door_alarm_min')}′` : ''].filter(Boolean).join(' · ')}</b></div>
        <div><span>${tt('who')}</span><b>${d.ownRecipients ? tt('whoOwn') : tt('whoDefault')}</b></div>
        <div><span>${tt('defrost')}</span><b>${defrost}</b></div>
        ${d.id ? html`<div><span>${tt('enabled')}</span><b><label class="sw"><input type="checkbox" .checked=${d.enabled} @change=${(e: Event) => this.patch({ enabled: (e.target as HTMLInputElement).checked })} data-w-enabled /></label></b></div>` : nothing}
      </div></div>
      <div class="banner"><sw-icon name="check" size="16"></sw-icon><span>${tt('summaryBanner')}</span></div>`;
  }

  render() {
    const labels: TtKey[] = ['step1', 'step2', 'step3', 'step4'];
    return html`<div class="ovl" @click=${() => this.close()}></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="w-title" data-temp-wizard>
        <div class="wh"><h2 id="w-title">${this.unitId ? tt('wizEdit') : tt('wizNew')}</h2>
          <button type="button" class="btn icb" aria-label=${tt('close')} @click=${() => this.close()}><sw-icon name="close" size="16"></sw-icon></button></div>
        <div class="steps">${labels.map((k, i) => html`<button type="button" aria-current=${this.step === i + 1 ? 'step' : 'false'} ?data-done=${this.step > i + 1} data-step=${i + 1}
          @click=${() => this.go(i + 1)}><i></i>${i + 1} · ${tt(k)}</button>`)}</div>
        <div class="wb" data-w-step=${this.step}>
          ${!this.meta && !this.err ? html`<div class="skl" style="block-size:200px"></div>` : this.step === 1 ? this.step1() : this.step === 2 ? this.step2() : this.step === 3 ? this.step3() : this.step4()}
        </div>
        <div class="wf">
          ${this.step > 1 ? html`<button type="button" class="btn" @click=${() => this.go(this.step - 1)} data-w-prev><sw-icon name="chevron" size="16"></sw-icon>${tt('prev')}</button>` : nothing}
          ${this.d.id && this.step === 4 ? html`<button type="button" class="btn ghost" ?disabled=${this.busy} @click=${() => this.removeUnit()} data-w-remove><sw-icon name="trash" size="16"></sw-icon>${tt('remove')}</button>` : nothing}
          <span class="sp"></span>${this.err ? html`<span class="err" role="alert" data-w-err>${this.err}</span>` : nothing}
          <button type="button" class="btn ghost" @click=${() => this.close()}>${tt('cancel')}</button>
          ${this.step < 4
            ? html`<button type="button" class="btn pri" @click=${() => this.go(this.step + 1)} data-w-next>${tt('next')}<sw-icon name="chevronBack" size="16"></sw-icon></button>`
            : html`<button type="button" class="btn pri" ?disabled=${this.busy} @click=${() => this.save()} data-w-save><sw-icon name="check" size="16"></sw-icon>${this.d.id ? tt('save') : tt('create')}</button>`}
        </div>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'temp-wizard': TempWizard;
  }
}
