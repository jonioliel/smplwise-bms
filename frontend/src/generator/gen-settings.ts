import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-tabs';
import '../components/sw-dropdown';
import '../components/sw-icon';
import '../components/sw-state-panel';
import './gen-routing';
import type { TabItem } from '../components/sw-tabs';
import type { DropdownChange, DropdownItem } from '../components/sw-dropdown';
import type { RouteState } from '../router';
import { navigate } from '../router';
import {
  addDevice, deviceCandidates, getDevice, getRoles, getSettings, listDevices, putRoles, putSettings, runDetect, updateDevice,
  type DeviceCandidate, type DevicesResponse, type GenDevice, type GenSettings, type RoleItem,
} from '../api/generator';
import { describeError } from '../api/client';
import { he } from '../i18n/he';
import { elecCss } from '../electricity/styles';
import { SkinController } from '../design/skin';
import { genCss } from './gen-styles';
import { fill, fmtDateTime } from './gen-logic';
import { generatorAccess } from './access';

const S = he.generator.settings;
const SUBS = ['routing', 'mapping', 'thresholds', 'retention', 'permissions'] as const;
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
  @state() private retEdits: Record<string, string> = {};
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
        <div class="row"><button class="btn" ?disabled=${this.busy} @click=${() => this.rescan()} data-rescan><sw-icon name="refresh" size="16"></sw-icon> ${S.rescan}</button><button class="btn" @click=${() => this.openPick()} data-manual>${S.manualPick}</button></div></div></div>`;
    }
    const c = d.capabilities;
    return html`<div class="card" data-detection=${d.core_met ? 'ok' : 'partial'}><div class="det"><div class="ic ${d.core_met ? '' : 'err'}"><sw-icon name=${d.core_met ? 'check' : 'warning'} size="22"></sw-icon></div>
      <div><b>${d.name} · ${d.core_met ? S.detectionOk : S.detectionPartial}</b><small>${fill(S.detectionCounts, { n: c.values, total: c.values_total, m: c.alert_types, mt: c.alert_types_total })}${l.last_detect_at ? ` · ${fill(S.lastCheck, { t: fmtDateTime(l.last_detect_at) })}` : ''}</small></div>
      <div class="row"><button class="btn sm" ?disabled=${this.busy} @click=${() => this.rescan()} data-rescan><sw-icon name="refresh" size="16"></sw-icon> ${S.rescan}</button><button class="btn sm" @click=${() => this.openPick()} data-manual>${S.manualPick}</button></div></div>
      <div class="form" style="margin-block-start:12px">
        <div class="fld"><label for="gname">${S.name}</label><input id="gname" .value=${this.nameEdit} maxlength="80" @input=${(e: Event) => (this.nameEdit = (e.target as HTMLInputElement).value)} /></div>
        <div class="fld"><label for="gkw">${S.rated}</label><input id="gkw" type="number" min="0" .value=${this.ratedEdit} @input=${(e: Event) => (this.ratedEdit = (e.target as HTMLInputElement).value)} /></div>
        <div class="fld"><label for="gkva">${S.ratedKva}</label><input id="gkva" type="number" min="0" .value=${this.ratedKvaEdit} @input=${(e: Event) => (this.ratedKvaEdit = (e.target as HTMLInputElement).value)} /></div>
        <div class="fld"><label>&nbsp;</label><button class="btn pri" ?disabled=${this.busy || !this.nameEdit.trim()} @click=${() => this.saveMeta()} data-save-meta>${S.save}</button></div></div></div>`;
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
      <div class="list" style="flex-direction:column;margin-block-start:8px;max-block-size:300px;overflow:auto">${this.cands.length ? this.cands.map((c) => html`<div class="li"><div class="grow"><div class="t1">${c.name}</div><div class="t2">${fill(S.manualRoles, { n: c.mapped_roles })}</div></div>
        <button class="btn sm" ?disabled=${c.registered || this.busy} @click=${() => this.run(async () => { const g = await addDevice(c.ha_device_id); this.picking = false; await this.load(); this.go(this.sub(), g.id); })}>${c.registered ? S.manualRegistered : S.manualAdd}</button></div>`) : html`<div class="mut">${S.manualNone}</div>`}</div></div>`;
  }

  private mapping() {
    const edits = this.roleEdits;
    const dirty = Object.keys(edits).length;
    return html`<div class="col" data-section="mapping"><div class="mut">${S.mapIntro}</div>
      <div class="card flush">${this.roles.map((r) => {
        const cur = r.role in edits ? edits[r.role] : r.entity_id;
        const opts = [...(r.candidates ?? [])];
        if (r.entity_id && !opts.some((o) => o.entity_id === r.entity_id)) opts.unshift({ entity_id: r.entity_id, name: r.entity_name ?? r.entity_id, unit: r.unit, score: 0 });
        return html`<div class="map-row" data-role=${r.role}><div><span class="b">${r.label}</span> ${r.core ? html`<span class="chip c-acc nodot">${S.mapCore}</span>` : nothing}${r.disabled_in_source && !r.mapped ? html`<div class="mut">${S.mapDisabled}</div>` : nothing}</div>
          <select aria-label=${r.label} .value=${cur ?? ''} @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; const orig = r.entity_id ?? ''; const next = { ...this.roleEdits }; if (v === orig) delete next[r.role]; else next[r.role] = v === '' ? null : v; this.roleEdits = next; }}>
            <option value="" ?selected=${!cur}>${r.mapped ? S.mapClear : S.mapNone}</option>${opts.map((o) => html`<option value=${o.entity_id} ?selected=${o.entity_id === cur}>${o.name}${o.unit ? ` (${o.unit})` : ''}</option>`)}</select>
          <span class="chip c-${r.mapped ? (r.mapped_by === 'manual' ? 'acc' : 'ok') : 'mut'} nodot">${r.mapped ? (r.mapped_by === 'manual' ? S.mapManual : S.mapAuto) : S.mapNone}</span></div>`;
      })}</div>
      <div class="row"><button class="btn pri" ?disabled=${this.busy || !dirty} @click=${() => this.run(async () => { this.device = await putRoles(this.device!.id, this.roleEdits); this.roleEdits = {}; await this.loadRoles(); })} data-save-mapping>${S.save}</button></div></div>`;
  }

  private thresholds() {
    const s = this.settings!;
    const eff = this.device?.thresholds ?? s.thresholds;
    const keys = Object.keys(s.threshold_defaults);
    const val = (k: string) => (k in this.thEdits ? this.thEdits[k] : String(eff[k] ?? s.threshold_defaults[k]));
    return html`<div class="col" data-section="thresholds"><div class="mut">${S.thIntro}</div>
      <div class="th-grid">${keys.map((k) => { const lim = s.threshold_limits[k] ?? [0, 1e6]; return html`<div class="fld"><label for=${`th-${k}`}>${(S.th as Record<string, string>)[k] ?? k}</label>
        <input id=${`th-${k}`} type="number" step="any" min=${lim[0]} max=${lim[1]} .value=${val(k)} @input=${(e: Event) => (this.thEdits = { ...this.thEdits, [k]: (e.target as HTMLInputElement).value })} />
        <span class="mut">${fill(S.thDefault, { n: s.threshold_defaults[k] })}</span></div>`; })}</div>
      <div class="row"><button class="btn pri" ?disabled=${this.busy || !Object.keys(this.thEdits).length || !this.device} @click=${() => this.run(async () => {
        const body: Record<string, number> = {};
        for (const k of keys) { const v = Number(val(k)); if (Number.isFinite(v) && v !== s.threshold_defaults[k]) body[k] = v; }
        this.device = await updateDevice(this.device!.id, { thresholds: body });
        this.thEdits = {};
      })} data-save-thresholds>${S.save}</button></div></div>`;
  }

  private retention() {
    const s = this.settings!;
    const rows: [string, string, number][] = [['alert_retention_days', S.retAlerts, s.alert_retention_days], ['history_retention_days', S.retHistory, s.history_retention_days], ['stale_after_s', S.retStale, s.stale_after_s]];
    return html`<div class="col" data-section="retention"><div class="mut">${fill(S.retInfo, { a: s.alert_retention_days, h: s.history_retention_days })}</div>
      <div class="th-grid">${rows.map(([k, label, cur]) => { const lim = s.limits[k] ?? [0, 1e6]; return html`<div class="fld"><label for=${`rt-${k}`}>${label}</label><input id=${`rt-${k}`} type="number" min=${lim[0]} max=${lim[1]} .value=${k in this.retEdits ? this.retEdits[k] : String(cur)} @input=${(e: Event) => (this.retEdits = { ...this.retEdits, [k]: (e.target as HTMLInputElement).value })} /></div>`; })}</div>
      <div class="row"><button class="btn pri" ?disabled=${this.busy || !Object.keys(this.retEdits).length} @click=${() => this.run(async () => {
        const body: Record<string, number> = {};
        for (const [k, v] of Object.entries(this.retEdits)) body[k] = Number(v);
        this.settings = await putSettings(body);
        this.retEdits = {};
      })} data-save-retention>${S.save}</button></div></div>`;
  }

  render() {
    if (!generatorAccess().manage) return html`<sw-state-panel state="forbidden" data-state="forbidden"></sw-state-panel>`;
    if (this.phase === 'loading') return html`<div class="skl" style="block-size:120px" data-state="loading"></div>`;
    if (this.phase === 'error' || !this.list || !this.settings) return html`<sw-state-panel state="error" heading=${he.generator.loadError} hint=${this.error} data-state="error"></sw-state-panel>`;
    const sub = this.sub();
    const items: TabItem[] = SUBS.map((x) => ({ id: x, label: S.subs[x], href: `#/system/infra/generator/${x}${this.device ? `?device=${encodeURIComponent(this.device.id)}` : ''}` }));
    const ds = this.list.devices;
    const dd: DropdownItem[] = ds.map((x) => ({ id: x.id, label: x.name, ...(x.core_met ? {} : { alert: 'warn' as const }) }));
    const pick = ds.length > 1 ? html`<div class="gpick" data-picker><span class="mut">${he.generator.pickerLabel}</span><sw-dropdown .items=${dd} .value=${this.device?.id ?? ''} label=${he.generator.pickerLabel} @change=${(e: CustomEvent<DropdownChange>) => this.go(sub, e.detail.id)}></sw-dropdown><span class="mut">${ds.length}</span></div>` : nothing;
    let body;
    if (!this.device) body = nothing;
    else if (sub === 'routing') body = html`<gen-routing .device=${this.device}></gen-routing>`;
    else if (sub === 'mapping') body = this.mapping();
    else if (sub === 'thresholds') body = this.thresholds();
    else if (sub === 'retention') body = this.retention();
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
