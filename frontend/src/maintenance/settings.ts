import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-toggle';
import '../components/sw-state-panel';
import { describeError, get, patch } from '../api/client';
import { can, isApi } from '../api/session';
import { TASK_KINDS, maintApi, type TaskKind } from '../api/maintenance';
import { mt, type MtKey } from '../i18n/maintenance';
import { refreshMaintenance } from './access';
import { maintCss } from './styles';

const LEAD_KEY = (k: TaskKind) => `maintenance.lead_days.${k}`;
const BUILT_IN: Record<TaskKind, string> = { certificate: '30', preventive: '7', round: '0', vendor_document: '30' };
const REMINDERS = 'maintenance.reminders_enabled';
const ROUND_VIEW = 'maintenance.round_phone_view';
const CLOSE_MODE = 'maintenance.close_request_mode';
const CHECK_MIN = 'maintenance.reminder_check_minutes';
const LOG_KEEP = 'maintenance.reminder_log_keep_days';
const MISSING_INS = 'maintenance.vendor_missing_insurance_mark';
const INS_WARN = 'maintenance.vendor_insurance_warn_days';
const FILE_MAX = 'maintenance.file_max_per_task';
/** the built-in value of every setting added by MAINT215B (the server's DEFAULTS) */
const EXTRA: Record<string, string> = { [REMINDERS]: 'false', [ROUND_VIEW]: 'step', [CLOSE_MODE]: 'ask', [CHECK_MIN]: '15', [LOG_KEEP]: '365', [MISSING_INS]: 'true', [INS_WARN]: '30', [FILE_MAX]: '10' };
const NUM_RANGE: Record<string, [number, number, MtKey]> = { [CHECK_MIN]: [1, 1440, 'setBadMinutes'], [LOG_KEEP]: [7, 3650, 'setBadKeep'], [INS_WARN]: [0, 365, 'setBadLead'], [FILE_MAX]: [1, 50, 'setBadFiles'] };
const URL_RE = /^(https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?(\/[A-Za-z0-9._~/%-]*)?)?$/;

/**
 * הגדרות › תשתיות › תחזוקה ובקרה (CR-MAINT215 slice 2; the owner's standing rule 24.10: every threshold and default is editable in
 * Settings): the module switch (audited by the server), the reminder lead a NEW task gets per kind (q13) and the address printed on a QR
 * sticker (q16; empty = the remote address). system.configure only - the server checks it on the PATCH. The notification category
 * "תחזוקה ובקרה" (q20) lives in Settings › Notifications; the three permissions are granted to any role in Users and permissions (q14).
 */
@customElement('maint-settings')
export class MaintSettings extends LitElement {
  @state() private values: Record<string, string> | null = null;
  @state() private draft: Record<string, string> = {};
  @state() private error = '';
  @state() private ok = '';
  @state() private busy = false;
  /** the address stickers carry now (null = not known, e.g. the module is off) */
  @state() private effective: string | null = null;

  static styles = [maintCss, css`
    .card { display: grid; gap: 12px; }
    .grid4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
    .switch { display: flex; align-items: center; gap: 12px; justify-content: space-between; }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private allowed(): boolean {
    return !isApi() || can('system.configure');
  }

  private async load() {
    try {
      const r = await get<{ settings: Record<string, unknown> }>('settings');
      const v: Record<string, string> = { 'maintenance.enabled': String(r.settings['maintenance.enabled'] ?? 'false'), 'maintenance.tag_base_url': String(r.settings['maintenance.tag_base_url'] ?? '') };
      for (const k of TASK_KINDS) v[LEAD_KEY(k)] = String(r.settings[LEAD_KEY(k)] ?? BUILT_IN[k]);
      for (const [k, d] of Object.entries(EXTRA)) v[k] = String(r.settings[k] ?? d);
      this.values = v;
      this.draft = { ...v };
      void this.loadEffective();
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private async loadEffective() {
    try {
      this.effective = (await maintApi.options()).defaults.tag_effective_url ?? '';
    } catch {
      this.effective = null; // the module is off, or the person may not manage it: the hint is simply not shown
    }
  }

  private problems(): Record<string, MtKey> {
    const p: Record<string, MtKey> = {};
    for (const k of TASK_KINDS) {
      const v = this.draft[LEAD_KEY(k)] ?? '';
      if (!/^\d{1,3}$/.test(v) || Number(v) > 365) p[LEAD_KEY(k)] = 'setBadLead';
    }
    if (!URL_RE.test(this.draft['maintenance.tag_base_url'] ?? '')) p['maintenance.tag_base_url'] = 'setBadUrl';
    for (const [k, [lo, hi, msg]] of Object.entries(NUM_RANGE)) {
      const v = this.draft[k] ?? '';
      if (!/^\d{1,4}$/.test(v) || Number(v) < lo || Number(v) > hi) p[k] = msg;
    }
    return p;
  }

  private async save(changes: Record<string, string>) {
    this.busy = true;
    this.error = '';
    this.ok = '';
    try {
      await patch('settings', changes);
      this.values = { ...this.values, ...changes };
      this.ok = mt('setSaved');
      if ('maintenance.enabled' in changes || 'maintenance.round_phone_view' in changes) void refreshMaintenance();
      if ('maintenance.tag_base_url' in changes || 'maintenance.enabled' in changes) void this.loadEffective();
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private saveDefaults() {
    if (Object.keys(this.problems()).length) return;
    const changes: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.draft)) {
      if (k === 'maintenance.enabled' || k === REMINDERS || k === MISSING_INS || this.values?.[k] === v) continue; // the switches are saved the moment they are flipped
      changes[k] = k.startsWith('maintenance.lead_days.') || k in NUM_RANGE ? String(Number(v)) : v.trim();
    }
    if (Object.keys(changes).length) void this.save(changes);
  }

  render() {
    if (!this.allowed()) return html`<sw-state-panel state="forbidden" hint=${mt('setForbidden')} data-state="forbidden"></sw-state-panel>`;
    const v = this.values;
    if (!v) return this.error ? html`<sw-state-panel state="error" heading=${this.error} data-state="error"></sw-state-panel>` : html`<div class="skl" aria-busy="true" aria-label=${mt('loading')}></div>`;
    const p = this.problems();
    const on = v['maintenance.enabled'] === 'true';
    const num = (k: string, id: string, unit: MtKey) => html`<div class="fld"><label for=${id}>${mt(({ [CHECK_MIN]: 'setCheckMinutes', [LOG_KEEP]: 'setLogKeep', [INS_WARN]: 'setInsWarn', [FILE_MAX]: 'setFileMax' } as Record<string, MtKey>)[k])}</label>
      <input id=${id} class="inp num" inputmode="numeric" maxlength="4" .value=${this.draft[k] ?? ''} aria-invalid=${String(!!p[k])} data-maint-setting=${k}
        @input=${(e: Event) => { this.draft = { ...this.draft, [k]: (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '') }; }}>
      ${p[k] ? html`<span class="err">${mt(p[k])}</span>` : html`<span class="mut">${mt(unit)}</span>`}</div>`;
    return html`<div class="panel card" data-maint-settings>
        <div class="switch"><div><h4>${mt('setModule')}</h4><div class="hint">${mt('setModuleHint')}</div></div>
          <sw-toggle label=${mt('setModule')} labelHidden .checked=${on} ?disabled=${this.busy} data-maint-enabled
            @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ 'maintenance.enabled': String(e.detail.checked) })}></sw-toggle></div>
      </div>
      <div class="panel card">
        <div><h4>${mt('setLeads')}</h4><div class="hint">${mt('setLeadsHint')}</div></div>
        <div class="grid4">${TASK_KINDS.map((k) => html`<div class="fld"><label for=${`ld-${k}`}>${mt(`setLead_${k}` as MtKey)}</label>
          <input id=${`ld-${k}`} class="inp num" inputmode="numeric" maxlength="3" .value=${this.draft[LEAD_KEY(k)] ?? ''} aria-invalid=${String(!!p[LEAD_KEY(k)])} data-maint-lead=${k}
            @input=${(e: Event) => { this.draft = { ...this.draft, [LEAD_KEY(k)]: (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '') }; }}>
          ${p[LEAD_KEY(k)] ? html`<span class="err">${mt(p[LEAD_KEY(k)])}</span>` : html`<span class="mut">${mt('daysUnit')}</span>`}</div>`)}</div>
        <div class="fld"><label for="tag-url">${mt('setTagUrl')}</label><input id="tag-url" class="inp ltr" dir="ltr" inputmode="url" placeholder="https://" .value=${this.draft['maintenance.tag_base_url'] ?? ''}
          aria-invalid=${String(!!p['maintenance.tag_base_url'])} data-maint-tag-url-setting @input=${(e: Event) => { this.draft = { ...this.draft, 'maintenance.tag_base_url': (e.target as HTMLInputElement).value }; }}>
          <span class=${p['maintenance.tag_base_url'] ? 'err' : 'mut'}>${p['maintenance.tag_base_url'] ? mt('setBadUrl') : mt('setTagUrlHint')}</span></div>
        ${this.effective === null ? nothing : html`<p class="hint" data-maint-tag-effective>${this.effective ? mt('setTagUrlEffective', { u: this.effective }) : mt('setTagUrlNone')}</p>`}
        <div class="foot"><span class="sp"></span><button type="button" class="btn pri" ?disabled=${this.busy || Object.keys(p).length > 0} data-maint-settings-save @click=${() => this.saveDefaults()}>${mt('setSave')}</button></div>
        ${this.error ? html`<div class="alert err" role="alert">${this.error}</div>` : nothing}
        ${this.ok ? html`<div class="chip" data-look="ok" role="status">${this.ok}</div>` : nothing}
      </div>
      <div class="panel card" data-maint-behaviour>
        <div class="switch"><div><h4>${mt('setReminders')}</h4><div class="hint">${mt('setRemindersHint')}</div></div>
          <sw-toggle label=${mt('setReminders')} labelHidden .checked=${v[REMINDERS] === 'true'} ?disabled=${this.busy} data-maint-reminders
            @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ [REMINDERS]: String(e.detail.checked) })}></sw-toggle></div>
        <div class="grid4">
          ${num(CHECK_MIN, 'chk-min', 'setMinutes')}${num(LOG_KEEP, 'log-keep', 'daysUnit')}
          <div class="fld"><label for="rv">${mt('setRoundView')}</label><select id="rv" class="inp" data-maint-setting=${ROUND_VIEW} .value=${this.draft[ROUND_VIEW] ?? 'step'}
            @change=${(e: Event) => { this.draft = { ...this.draft, [ROUND_VIEW]: (e.target as HTMLSelectElement).value }; }}>
            <option value="step" ?selected=${this.draft[ROUND_VIEW] !== 'list'}>${mt('viewStep')}</option><option value="list" ?selected=${this.draft[ROUND_VIEW] === 'list'}>${mt('viewList')}</option></select><span class="mut">${mt('setRoundViewHint')}</span></div>
          <div class="fld"><label for="cm">${mt('setCloseMode')}</label><select id="cm" class="inp" data-maint-setting=${CLOSE_MODE} .value=${this.draft[CLOSE_MODE] ?? 'ask'}
            @change=${(e: Event) => { this.draft = { ...this.draft, [CLOSE_MODE]: (e.target as HTMLSelectElement).value }; }}>
            ${(['ask', 'auto', 'off'] as const).map((m) => html`<option value=${m} ?selected=${(this.draft[CLOSE_MODE] ?? 'ask') === m}>${mt(`setCloseMode_${m}` as MtKey)}</option>`)}</select></div>
          ${num(FILE_MAX, 'file-max', 'fileAdd')}
        </div>
        <div><h4>${mt('setInsurance')}</h4>
          <div class="switch"><span>${mt('setMissingIns')}</span><sw-toggle label=${mt('setMissingIns')} labelHidden .checked=${v[MISSING_INS] === 'true'} ?disabled=${this.busy} data-maint-missing-ins
            @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ [MISSING_INS]: String(e.detail.checked) })}></sw-toggle></div>
          <div class="grid4">${num(INS_WARN, 'ins-warn', 'daysUnit')}</div><div class="hint">${mt('insHint')}</div></div>
        <div class="foot"><span class="sp"></span><button type="button" class="btn pri" ?disabled=${this.busy || Object.keys(p).length > 0} data-maint-behaviour-save @click=${() => this.saveDefaults()}>${mt('setSave')}</button></div>
      </div>
      <div class="panel"><div class="hint"><sw-icon name="bell" size="14"></sw-icon> ${mt('setNotify')}</div><div class="hint"><sw-icon name="users" size="14"></sw-icon> ${mt('setPerms')}</div></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'maint-settings': MaintSettings;
  }
}
