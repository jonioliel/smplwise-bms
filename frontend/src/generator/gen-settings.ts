import { LitElement, html, css, nothing } from 'lit';
import '../components/sw-button';
import { customElement, property, state } from 'lit/decorators.js';
import { toggled } from '../components/sw-toggle';
import '../components/sw-tabs';
import '../components/sw-field';
import '../components/sw-dropdown';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-segmented';
import './gen-routing';
import type { TabItem } from '../components/sw-tabs';
import type { SegmentOption, SegmentedChange } from '../components/sw-segmented';
import type { DropdownChange, DropdownItem } from '../components/sw-dropdown';
import type { RouteState } from '../router';
import { navigate } from '../router';
import {
  addDevice, deviceCandidates, getDevice, getRoles, getSettings, listDevices, putRoles, putSettings, runDetect, updateDevice,
  type DeviceCandidate, type DevicesResponse, type GenDevice, type GenSettings, type RoleItem,
} from '../api/generator';
import { describeError } from '../api/client';
import { t } from '../i18n/he';
import { GEN_SETTINGS, genServerWord } from './gen-text';
import { elecCss } from '../electricity/styles';
import { SkinController } from '../design/skin';
import { genCss } from './gen-styles';
import { fill, fmtDateTime } from './gen-logic';
import { generatorAccess } from './access';
import { glt, type GltKey } from '../i18n/generator-log';
import { tr } from '../i18n/msg/misc';

/** GEN-UNITS-FIELD-2490: the settings texts of the ACTIVE language (English where it has the key, else Hebrew), read at render time
 * (GEN-UNITS-FIELD-2520: the shared reader in gen-text.ts, also used by the alert routing screen). */
const S = GEN_SETTINGS;
/** GEN-UNITS-FIELD-2490: the unit of a value sits inside the field's frame (sw-field unit), not in its label - as electricity and water do. */
const TH_UNIT = (): Record<string, string> => ({ oil_min_bar: S.units.bar, coolant_max_c: S.units.c, fuel_low_pct: S.units.pct, fuel_empty_pct: S.units.pct, overload_pct: S.units.pct, v_min: S.units.v, v_max: S.units.v, hz_min: S.units.hz, hz_max: S.units.hz, battery_min_12v: S.units.v, battery_min_24v: S.units.v, service_warn_h: S.units.hAhead, service_every_h: S.units.h });
const RET_UNIT = (): Record<string, string> => ({ alert_retention_days: S.units.days, history_retention_days: S.units.days, stale_after_s: S.units.s });
const LOG_UNIT = (): Record<string, string> => ({ min_run_s: S.units.s, mains_lookback_s: S.units.s, test_min_minutes: S.units.min, test_max_minutes: S.units.min, test_interval_days: S.units.days, no_data_close_min: S.units.min, refill_min_pct: S.units.pct, refill_settle_min: S.units.min, drop_min_pct: S.units.pct, fuel_window_h: S.units.h, retention_days: S.units.days });
/** DATA-RULES-2-2550: the starter battery's system choice - 'auto' = the server's detection (null on the wire, the default). */
type BatChoice = 'auto' | '12' | '24';
const batChoiceOf = (v: number | null | undefined): BatChoice => (v === 12 ? '12' : v === 24 ? '24' : 'auto');
// GENLOG092-295: 'log' = the run log's switch and every threshold / window of it
const SUBS =['routing', 'mapping', 'thresholds', 'retention', 'log', 'permissions'] as const;
type Sub = (typeof SUBS)[number];

/**
 * הגדרות › תשתיות › גנרטור (CR-031 GEN1, `generator.manage`): the generator picker (any number, searchable), the detection card with the "N of M values / alert types"
 * counts, a manual device pick, and the sections ניתוב התראות (`gen-routing`, starts empty), מיפוי חיישנים (correct a wrong role -> sensor assignment),
 * ספי התראה, שמירת נתונים and הרשאות. Everything here is an Arx setting: nothing is sent to the controller.
 */
@customElement('gen-settings')
export class GenSettings_ extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) route: RouteState | null = null;
  @state() private list: DevicesResponse | null = null;
  @state() private device: GenDevice | null = null;
  @state() private settings: GenSettings | null = null;
  @state() private roles: RoleItem[] = [];
  @state() private roleEdits: Record<string, string | null> = {};
  @state() private thEdits: Record<string, string> = {};
  /** DATA-RULES-2-2550: the battery system the administrator picked and has not saved yet (null = unchanged). */
  @state() private batEdit: BatChoice | null = null;
  @state() private retEdits: Record<string, string> = {};
  @state() private logEdits: Record<string, string | boolean> = {};
  @state() private nameEdit = '';
  @state() private ratedEdit = '';
  @state() private ratedKvaEdit = '';
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private busy = false;
  @state() private msg = '';
  @state() private fail = '';
  @state() private picking = false;
  @state() private cands: DeviceCandidate[] = [];
  @state() private candQ = '';

  static styles = [elecCss, genCss, css`
    :host { display: flex; flex-direction: column; gap: 14px; }
    .strip { align-self: flex-start; max-inline-size: 100%; }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }
  protected updated(c: Map<string, unknown>) {
    if (c.has('route')) {
      const id = this.deviceId();
      if (id && id !== this.device?.id) void this.loadDevice(id);
      if (this.sub() === 'mapping' && this.device) void this.loadRoles();
    }
  }

  private sub(): Sub {
    const s = this.route?.segments[3];
    return (SUBS as readonly string[]).includes(s ?? '') ? (s as Sub) : 'routing';
  }
  private deviceId(): string {
    const ds = this.list?.devices ?? [];
    const asked = this.route?.params.get('device') ?? '';
    return ds.some((d) => d.id === asked) ? asked : ds[0]?.id ?? '';
  }

  private async load() {
    try {
      const [l, s] = await Promise.all([listDevices(), getSettings()]);
      this.list = l;
      this.settings = s;
      this.phase = 'ready';
      const id = this.deviceId();
      if (id) await this.loadDevice(id);
    } catch (e) {
      this.error = describeError(e);
      this.phase = 'error';
    }
  }
  private async loadDevice(id: string) {
    try {
      const d = await getDevice(id);
      this.device = d;
      this.nameEdit = d.name;
      this.ratedEdit = d.rated_kw ? String(d.rated_kw) : '';
      this.ratedKvaEdit = d.rated_kva ? String(d.rated_kva) : '';
      this.thEdits = {};
      this.batEdit = null;
      this.roleEdits = {};
      if (this.sub() === 'mapping') await this.loadRoles();
    } catch (e) {
      this.fail = describeError(e);
    }
  }
  private async loadRoles() {
    if (!this.device) return;
    try {
      this.roles = (await getRoles(this.device.id)).items;
    } catch (e) {
      this.fail = describeError(e);
    }
  }
  private go(sub: Sub, device = this.device?.id) {
    navigate(`/system/infra/generator/${sub}`, device ? { device } : undefined);
  }
  private async run(fn: () => Promise<unknown>, ok: string = S.save) {
    this.busy = true;
    this.fail = '';
    this.msg = '';
    try {
      await fn();
      this.msg = ok === S.save ? S.saved : ok;
    } catch (e) {
      this.fail = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private detection() {
    const d = this.device;
    const l = this.list!;
    if (!d) {
      return html`<div class="card" data-detection="none"><div class="det"><div class="ic err"><sw-icon name="close" size="22"></sw-icon></div><div><b>${S.detectionNone}</b><small>${S.detectionNoneBody}${l.last_detect_at ? ` ${fill(S.lastCheck, { t: fmtDateTime(l.last_detect_at) })}` : ''}</small></div>
        <div class="row"><sw-button icon="refresh" ?disabled=${this.busy} @click=${() => this.rescan()} data-rescan>${S.rescan}</sw-button><sw-button @click=${() => this.openPick()} data-manual>${S.manualPick}</sw-button></div></div></div>`;
    }
    const c = d.capabilities;
    return html`<div class="card" data-detection=${d.core_met ? 'ok' : 'partial'}><div class="det"><div class="ic ${d.core_met ? '' : 'err'}"><sw-icon name=${d.core_met ? 'check' : 'warning'} size="22"></sw-icon></div>
      <div><b>${d.name} · ${d.core_met ? S.detectionOk : S.detectionPartial}</b><small>${fill(S.detectionCounts, { n: c.values, total: c.values_total, m: c.alert_types, mt: c.alert_types_total })}${l.last_detect_at ? ` · ${fill(S.lastCheck, { t: fmtDateTime(l.last_detect_at) })}` : ''}</small></div>
      <div class="row"><sw-button size="sm" icon="refresh" ?disabled=${this.busy} @click=${() => this.rescan()} data-rescan>${S.rescan}</sw-button><sw-button size="sm" @click=${() => this.openPick()} data-manual>${S.manualPick}</sw-button></div></div>
      <div class="form" style="margin-block-start:12px">
        <div class="fld"><label for="gname">${S.name}</label><input id="gname" .value=${this.nameEdit} maxlength="80" @input=${(e: Event) => (this.nameEdit = (e.target as HTMLInputElement).value)} /></div>
        <sw-field class="fld" label=${S.rated} unit=${S.units.kw}><input id="gkw" class="ltr" type="number" min="0" .value=${this.ratedEdit} @input=${(e: Event) => (this.ratedEdit = (e.target as HTMLInputElement).value)} /></sw-field>
        <sw-field class="fld" label=${S.ratedKva} unit=${S.units.kva}><input id="gkva" class="ltr" type="number" min="0" .value=${this.ratedKvaEdit} @input=${(e: Event) => (this.ratedKvaEdit = (e.target as HTMLInputElement).value)} /></sw-field>
        <div class="fld"><label>&nbsp;</label><sw-button variant="primary" ?disabled=${this.busy || !this.nameEdit.trim()} @click=${() => this.saveMeta()} data-save-meta>${S.save}</sw-button></div></div></div>`;
  }
  private async rescan() {
    await this.run(async () => {
      await runDetect();
      await this.load();
    }, S.rescan);
  }
  private async saveMeta() {
    const d = this.device!;
    const kw = this.ratedEdit ? Number(this.ratedEdit) : null;
    const kva = this.ratedKvaEdit ? Number(this.ratedKvaEdit) : null;
    await this.run(async () => {
      this.device = await updateDevice(d.id, { name: this.nameEdit.trim(), rated_kw: kw, rated_kva: kva, revision: d.revision });
      this.list = await listDevices();
    });
  }
  private async openPick() {
    this.picking = !this.picking;
    if (this.picking) await this.searchCands();
  }
  private async searchCands() {
    try {
      this.cands = (await deviceCandidates(this.candQ)).items;
    } catch (e) {
      this.fail = describeError(e);
    }
  }
  private picker() {
    if (!this.picking) return nothing;
    return html`<div class="card" data-manual-list><div class="hd"><span class="h3">${S.manualPick}</span></div>
      <input type="search" placeholder=${S.manualSearch} .value=${this.candQ} @input=${(e: Event) => { this.candQ = (e.target as HTMLInputElement).value; void this.searchCands(); }} />
      <div class="list picklist">${this.cands.length ? this.cands.map((c) => html`<div class="li"><div class="grow"><div class="t1">${c.name}</div><div class="t2">${fill(S.manualRoles, { n: c.mapped_roles })}</div></div>
        <sw-button size="sm" ?disabled=${c.registered || this.busy} @click=${() => this.run(async () => { const g = await addDevice(c.ha_device_id); this.picking = false; await this.load(); this.go(this.sub(), g.id); })}>${c.registered ? S.manualRegistered : S.manualAdd}</sw-button></div>`) : html`<div class="mut">${S.manualNone}</div>`}</div></div>`;
  }

  private mapping() {
    const edits = this.roleEdits;
    const dirty = Object.keys(edits).length;
    return html`<div class="col" data-section="mapping"><div class="mut">${S.mapIntro}</div>
      <div class="card flush">${this.roles.map((r) => {
        const cur = r.role in edits ? edits[r.role] : r.entity_id;
        const opts = [...(r.candidates ?? [])];
        if (r.entity_id && !opts.some((o) => o.entity_id === r.entity_id)) opts.unshift({ entity_id: r.entity_id, name: r.entity_name ?? r.entity_id, unit: r.unit, score: 0 });
        const label = genServerWord(r.label, r.label_en); // GEN-SENSOR-NAMES-EN-2520: the sensor's name in the page language
        return html`<div class="map-row" data-role=${r.role}><div><span class="b" data-role-label>${label}</span> ${r.core ? html`<span class="chip c-acc nodot">${S.mapCore}</span>` : nothing}${r.disabled_in_source && !r.mapped ? html`<div class="mut">${S.mapDisabled}</div>` : nothing}</div>
          <select aria-label=${label} .value=${cur ?? ''} @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; const orig = r.entity_id ?? ''; const next = { ...this.roleEdits }; if (v === orig) delete next[r.role]; else next[r.role] = v === '' ? null : v; this.roleEdits = next; }}>
            <option value="" ?selected=${!cur}>${r.mapped ? S.mapClear : S.mapNone}</option>${opts.map((o) => html`<option value=${o.entity_id} ?selected=${o.entity_id === cur}>${o.name}${o.unit ? ` (${o.unit})` : ''}</option>`)}</select>
          <span class="chip c-${r.mapped ? (r.mapped_by === 'manual' ? 'acc' : 'ok') : 'mut'} nodot">${r.mapped ? (r.mapped_by === 'manual' ? S.mapManual : S.mapAuto) : S.mapNone}</span></div>`;
      })}</div>
      <div class="row"><sw-button variant="primary" ?disabled=${this.busy || !dirty} @click=${() => this.run(async () => { this.device = await putRoles(this.device!.id, this.roleEdits); this.roleEdits = {}; await this.loadRoles(); })} data-save-mapping>${S.save}</sw-button></div></div>`;
  }

  private thresholds() {
    const s = this.settings!;
    const eff = this.device?.thresholds ?? s.thresholds;
    const keys = Object.keys(s.threshold_defaults);
    const val = (k: string) => (k in this.thEdits ? this.thEdits[k] : String(eff[k] ?? s.threshold_defaults[k]));
    return html`<div class="col" data-section="thresholds"><div class="mut">${S.thIntro}</div>
      ${this.batterySystem()}
      <div class="th-grid">${keys.map((k) => { const lim = s.threshold_limits[k] ?? [0, 1e6]; return html`<sw-field class="fld" label=${(S.th as Record<string, string>)[k] ?? k} unit=${TH_UNIT()[k] ?? ''}>
        <input id=${`th-${k}`} class="ltr" type="number" step="any" min=${lim[0]} max=${lim[1]} .value=${val(k)} @input=${(e: Event) => (this.thEdits = { ...this.thEdits, [k]: (e.target as HTMLInputElement).value })} />
        <span class="mut" slot="message">${fill(S.thDefault, { n: s.threshold_defaults[k] })}</span></sw-field>`; })}</div>
      <div class="row"><sw-button variant="primary" ?disabled=${this.busy || (!Object.keys(this.thEdits).length && this.batEdit === null) || !this.device} @click=${() => this.run(async () => {
        const body: Parameters<typeof updateDevice>[1] = {};
        if (Object.keys(this.thEdits).length) {
          const th: Record<string, number> = {};
          for (const k of keys) { const v = Number(val(k)); if (Number.isFinite(v) && v !== s.threshold_defaults[k]) th[k] = v; }
          body.thresholds = th;
        }
        if (this.batEdit !== null) body.battery_nominal_v = this.batEdit === 'auto' ? null : this.batEdit === '24' ? 24 : 12;
        this.device = await updateDevice(this.device!.id, body);
        this.thEdits = {};
        this.batEdit = null;
      })} data-save-thresholds>${S.save}</sw-button></div></div>`;
  }

  /** DATA-RULES-2-2550 (DATA-RULES-2540 open question 2): the starter battery's system - automatic (the server's detection, the default and
   * today's behaviour), 12 V or 24 V. Saved with the thresholds (PUT /generator/devices/{id} `battery_nominal_v`, generator.manage, audited). */
  private batterySystem() {
    const d = this.device;
    const saved = batChoiceOf(d?.battery_nominal_v);
    const cur = this.batEdit ?? saved;
    const opts: SegmentOption<BatChoice>[] = [
      { value: 'auto', label: S.batAuto, attrs: { 'data-bat': 'auto' } },
      { value: '12', label: `12 ${S.units.v}`, attrs: { 'data-bat': '12' } },
      { value: '24', label: `24 ${S.units.v}`, attrs: { 'data-bat': '24' } },
    ];
    const known = d?.battery_system_v ?? null;
    const hint = cur === 'auto' ? `${S.batHintAuto}${saved === 'auto' && known ? ` ${fill(S.batDetected, { v: known })}` : ''}` : fill(S.batHintFixed, { v: cur });
    return html`<div class="fld" data-battery-system=${cur}><span class="lbl">${S.batSystem}</span>
      <sw-segmented radio style="align-self:flex-start" label=${S.batSystem} .options=${opts} value=${cur} ?disabled=${this.busy || !d}
        @change=${(e: CustomEvent<SegmentedChange>) => (this.batEdit = e.detail.value === saved ? null : (e.detail.value as BatChoice))}></sw-segmented>
      <span class="mut" data-battery-hint>${hint}</span></div>`;
  }

  private retention() {
    const s = this.settings!;
    const rows: [string, string, number][] = [['alert_retention_days', S.retAlerts, s.alert_retention_days], ['history_retention_days', S.retHistory, s.history_retention_days], ['stale_after_s', S.retStale, s.stale_after_s]];
    return html`<div class="col" data-section="retention"><div class="mut">${fill(S.retInfo, { a: s.alert_retention_days, h: s.history_retention_days })}</div>
      <div class="th-grid">${rows.map(([k, label, cur]) => { const lim = s.limits[k] ?? [0, 1e6]; return html`<sw-field class="fld" label=${label} unit=${RET_UNIT()[k] ?? ''}><input id=${`rt-${k}`} class="ltr" type="number" min=${lim[0]} max=${lim[1]} .value=${k in this.retEdits ? this.retEdits[k] : String(cur)} @input=${(e: Event) => (this.retEdits = { ...this.retEdits, [k]: (e.target as HTMLInputElement).value })} /></sw-field>`; })}</div>
      <div class="row"><sw-button variant="primary" ?disabled=${this.busy || !Object.keys(this.retEdits).length} @click=${() => this.run(async () => {
        const body: Record<string, number> = {};
        for (const [k, v] of Object.entries(this.retEdits)) body[k] = Number(v);
        this.settings = await putSettings(body);
        this.retEdits = {};
      })} data-save-retention>${S.save}</sw-button></div></div>`;
  }

  /** GENLOG092-295: the run log - its page switch (default off) and every threshold and window (installation-wide, not per generator). */
  private logSection() {
    const s = this.settings!;
    const specs = s.log_specs ?? {};
    const cur = s.log ?? {};
    const val = (k: string) => (k in this.logEdits ? this.logEdits[k] : cur[k] ?? specs[k]?.default);
    const enabled = 'log_enabled' in this.logEdits ? Boolean(this.logEdits.log_enabled) : Boolean(s.log_enabled);
    return html`<div class="col" data-section="log"><div class="mut">${glt('setIntro')}</div>
      <label class="row" style="gap:8px"><sw-toggle size="sm" labelHidden in-label label=${glt('setEnabled')} .checked=${enabled} data-log-enabled @change=${(e: Event) => (this.logEdits = { ...this.logEdits, log_enabled: toggled(e) })}></sw-toggle><b>${glt('setEnabled')}</b></label>
      <div class="th-grid">${Object.entries(specs).map(([k, sp]) => sp.type === 'bool'
        ? html`<div class="fld"><label class="row" style="gap:8px"><sw-toggle size="sm" labelHidden in-label label=${glt(`set_${k}` as GltKey)} .checked=${Boolean(val(k))} data-log-set=${k} @change=${(e: Event) => (this.logEdits = { ...this.logEdits, [k]: toggled(e) })}></sw-toggle>${glt(`set_${k}` as GltKey)}</label></div>`
        : html`<sw-field class="fld" label=${glt(`set_${k}` as GltKey)} unit=${LOG_UNIT()[k] ?? ''}>
          <input id=${`lg-${k}`} class="ltr" type="number" step=${sp.type === 'float' ? '0.5' : '1'} min=${sp.min ?? ''} max=${sp.max ?? ''} .value=${String(val(k) ?? '')} data-log-set=${k}
            @input=${(e: Event) => (this.logEdits = { ...this.logEdits, [k]: (e.target as HTMLInputElement).value })} />
          <span class="mut" slot="message">${fill(S.thDefault, { n: String(sp.default) })}</span></sw-field>`)}</div>
      <div class="row"><sw-button variant="primary" ?disabled=${this.busy || !Object.keys(this.logEdits).length} data-save-log @click=${() => this.run(async () => {
        const log: Record<string, number | boolean> = {};
        for (const [k, v] of Object.entries(this.logEdits)) {
          if (k === 'log_enabled') continue;
          log[k] = typeof v === 'boolean' ? v : Number(v);
        }
        this.settings = await putSettings({ ...('log_enabled' in this.logEdits ? { log_enabled: Boolean(this.logEdits.log_enabled) } : {}), ...(Object.keys(log).length ? { log } : {}) });
        this.logEdits = {};
      })}>${S.save}</sw-button></div></div>`;
  }

  render() {
    if (!generatorAccess().manage) return html`<sw-state-panel state="forbidden" heading=${tr('אין הרשאה להגדרות הגנרטור')} data-state="forbidden"></sw-state-panel>`;
    if (this.phase === 'loading') return html`<div class="skl" style="block-size:120px" data-state="loading"></div>`;
    if (this.phase === 'error' || !this.list || !this.settings) return html`<sw-state-panel state="error" heading=${t('generator.loadError')} hint=${this.error} actionLabel=${tr('נסו שוב')} data-state="error" @action=${() => { this.phase = 'loading'; void this.load(); }}></sw-state-panel>`;
    const sub = this.sub();
    const items: TabItem[] = SUBS.map((x) => ({ id: x, label: x === 'log' ? glt('setSub') : S.subs[x], href: `#/system/infra/generator/${x}${this.device ? `?device=${encodeURIComponent(this.device.id)}` : ''}` }));
    const ds = this.list.devices;
    const dd: DropdownItem[] = ds.map((x) => ({ id: x.id, label: x.name, ...(x.core_met ? {} : { alert: 'warn' as const }) }));
    const pick = ds.length > 1 ? html`<div class="gpick" data-picker><span class="mut">${t('generator.pickerLabel')}</span><sw-dropdown .items=${dd} .value=${this.device?.id ?? ''} label=${t('generator.pickerLabel')} @change=${(e: CustomEvent<DropdownChange>) => this.go(sub, e.detail.id)}></sw-dropdown><span class="mut">${ds.length}</span></div>` : nothing;
    let body;
    if (!this.device) body = nothing;
    else if (sub === 'routing') body = html`<gen-routing .device=${this.device}></gen-routing>`;
    else if (sub === 'mapping') body = this.mapping();
    else if (sub === 'thresholds') body = this.thresholds();
    else if (sub === 'retention') body = this.retention();
    else if (sub === 'log') body = this.logSection();
    else body = html`<div class="card" data-section="permissions"><div class="row"><span>${S.permsBody}</span><div class="sp"></div><a class="btn" href="#/system/access">${S.permsLink}</a></div></div>`;
    return html`<div class="row"><span class="h2">${S.title}</span><div class="sp"></div>${this.device ? html`<sw-tabs class="strip" segmented .items=${items} .active=${sub} data-gen-subs></sw-tabs>` : nothing}</div>
      ${pick}${this.detection()}${this.picker()}
      ${this.msg ? html`<div class="mut" role="status" data-saved>${this.msg}</div>` : nothing}${this.fail ? html`<div class="alert err" role="alert"><span class="x">!</span><div>${this.fail}</div></div>` : nothing}
      ${body}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gen-settings': GenSettings_;
  }
}
