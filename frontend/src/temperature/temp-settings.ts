import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { describeError } from '../api/client';
import { getAlertSettings, getReportLinks, getReportRecipients, getSettings, putAlertSettings, putSettings, revokeAllReportLinks, revokeReportLink, type AlertChannel, type AlertKind,
  type AlertSettings, type Escalation, type ReportLink, type SettingsResponse } from '../api/temperature';
import { tempCss } from './styles';
import { tt, type TtKey } from '../i18n/temperature';
import { ticketsEnabled } from '../tickets/gate';
import { dateInputLang, dayTimeText } from '../api/day-format';

type Val = boolean | number | string | string[];
const GROUPS: { title: TtKey; keys: [string, TtKey][] }[] = [
  { title: 'rulesTitle', keys: [['warn_on_excursion', 'ruleWarnNow'], ['high_alarm', 'ruleHigh'], ['high_alarm_min', 'minutes'], ['low_alarm', 'ruleLow'], ['low_alarm_min', 'minutes'],
    ['door_alarm', 'ruleDoor'], ['door_alarm_min', 'minutes'], ['offline_warn', 'ruleOffline'], ['offline_min', 'minutes'], ['hysteresis', 'hysteresis']] },
  { title: 'quiet', keys: [['alerts_enabled', 'alertsEnabled'], ['quiet_enabled', 'quiet'], ['quiet_from', 'start'], ['quiet_to', 'to'], ['quiet_includes_alarms', 'quietAlarms'], ['mute_includes_alarms', 'muteAlarms']] },
  { title: 'defrost', keys: [['defrost_suppress', 'defrostSuppress'], ['exclude_defrost_stats', 'excludeStats'], ['defrost_hard_margin', 'hardMargin'], ['learn_days', 'learnDays'],
    ['learn_min_repeats', 'learnRepeats'], ['defrost_max_min', 'defrostMax']] },
  { title: 'groupClimate', keys: [['setpoint_tolerance', 'tolerance'], ['alert_when_off', 'alertWhenOff']] },
  // phase 3 (owner 2026-10-20: every capability a setting)
  { title: 'setPredict', keys: [['predict_enabled', 'predictEnabled'], ['predict_horizon_min', 'predictHorizon'], ['predict_warn', 'predictWarn'], ['predict_warn_min', 'predictWarnMin']] },
  { title: 'setMaint', keys: [['maintenance_includes_alarms', 'maintAlarms'], ['maintenance_max_min', 'maintMax'], ['escalation_enabled', 'escalationUnit']] },
  { title: 'setHealth', keys: [['health_warn', 'healthWarn'], ['battery_low_pct', 'batteryLow'], ['frozen_min', 'frozenMin'], ['signal_weak_dbm', 'signalWeak'],
    ['recovery_slow_min', 'recoverySlow'], ['recovery_alert', 'recoveryAlert'], ['compressor_on_w', 'compressorOnW'], ['duty_rise_pts', 'dutyRise'], ['duty_alert', 'dutyAlert']] },
  { title: 'setScreen', keys: [['grid_grouping', 'gridGrouping'], ['home_widget', 'homeWidgetSet'], ['ticket_department_id', 'ticketDeptSet'], ['ticket_attach_chart', 'ticketChartSet']] },
  // TEMPEXPLAIN093-295: every window and threshold of the rule-based "why did it warm?" explanation
  { title: 'setExplain', keys: [['explain_enabled', 'explainEnabled'], ['explain_lookback_min', 'explainLookback'], ['explain_door_lookback_min', 'explainDoorLookback'], ['explain_door_min_open_min', 'explainDoorMin'],
    ['explain_power_lookback_min', 'explainPowerLookback'], ['explain_compressor_off_min', 'explainCompOff'], ['explain_gap_min', 'explainGap'], ['explain_spike_max_min', 'explainSpikeMax'],
    ['explain_spike_jump', 'explainSpikeJump'], ['explain_neighbor_rise', 'explainNbRise'], ['explain_neighbor_scope', 'explainNbScope'], ['explain_min_score', 'explainMinScore']] },
  // TEMPLINK-295: the temporary report download link (off by default)
  { title: 'setLink', keys: [['report_link_enabled', 'linkEnabled'], ['report_link_hours', 'linkHours'], ['report_link_max_opens', 'linkMaxOpens'], ['report_link_per_hour', 'linkPerHour'],
    // TEMPREPORT-297: the WhatsApp summary carries the temporary link (off = 'none' by default)
    ['report_attachment', 'linkAttach']] },
  // WALINK-295: the link as a plain-text WhatsApp message (off by default); the recipients are chosen below it
  { title: 'setLinkWa', keys: [['report_link_wa_enabled', 'linkWaEnabled'], ['report_link_wa_window_h', 'linkWaWindow'], ['report_link_wa_text_he', 'linkWaTextHe'], ['report_link_wa_text_en', 'linkWaTextEn'],
    ['report_link_wa_recipients', 'linkWaRecipients']] },
  { title: 'retention', keys: [['retention_days', 'retention']] },
];
const KIND_LABEL: Record<AlertKind, TtKey> = { alarm: 'kindAlarm', warning: 'kindWarning', offline: 'kindOffline', health: 'kindHealth' };
const CHOICE_LABEL: Record<string, TtKey> = { area: 'grpArea', none: 'grpNone', 'explain_neighbor_scope:area': 'scopeArea', 'explain_neighbor_scope:all': 'scopeAll',
  'report_attachment:none': 'attNone', 'report_attachment:link': 'attLink' };
const CH_LABEL: Record<AlertChannel, TtKey> = { push: 'chPush', app: 'chApp', email: 'chEmail', whatsapp: 'chWhatsapp' };

/**
 * הגדרות › תשתיות › טמפרטורות (CR-INFRA-TEMPERATURE 2.9.1): the installation DEFAULTS of every rule (owner decisions 2 and 3: each one a
 * setting, overridable per unit in its wizard) and the alert routing - per kind (alarm / warning / sensor silent) on / off, the roles that
 * receive it and the extra channels (the inbox always). Defaults: infra.temperature.manage; routing: readable by the manager, changed with
 * system.configure (read-only otherwise).
 */
@customElement('temp-settings')
export class TempSettings extends LitElement {
  @state() private s: SettingsResponse | null = null;
  @state() private draft: Record<string, Val> = {};
  @state() private alerts: AlertSettings | null = null;
  /** WALINK-295: the users offered as link recipients */
  @state() private users: { id: string; name: string }[] = [];
  /** TEMPREPORT-297: the live report links (null = the caller may not list them) */
  @state() private links: ReportLink[] | null = null;
  /** phase 3 (idea 4): the escalation chain being edited (saved as a whole) */
  @state() private esc: Escalation | null = null;
  @state() private err = '';
  @state() private ok = '';
  @state() private busy = false;

  static styles = [tempCss, css`
    :host { display: grid; gap: 14px; }
    h3 { margin: 0 0 4px; font-size: var(--sw-fs-lg); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px 16px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 0; border-block-end: 1px solid var(--sw-border); font-size: var(--sw-fs-sm); }
    .row input[type='number'] { inline-size: 84px; }
    .row input { min-block-size: 30px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); padding: 0 8px; font: inherit; }
    .row input[type='checkbox'] { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    .row select { min-block-size: 30px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); padding: 0 8px; font: inherit; }
    .row input.idin { inline-size: 140px; direction: ltr; }
    .row input.txtin { inline-size: 100%; min-inline-size: 0; }
    .row.wide { grid-column: 1 / -1; flex-wrap: wrap; }
    .step { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: var(--sw-fs-sm); }
    .step input[type='number'] { inline-size: 70px; min-block-size: 30px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); padding: 0 8px; font: inherit; }
    h4 { margin: 10px 0 4px; }
    .kind { border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); padding: 10px 12px; display: grid; gap: 8px; }
    .kind[data-on='false'] .body { opacity: 0.55; }
    .opts { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: var(--sw-fs-sm); }
    .sw { display: inline-flex; gap: 8px; align-items: center; }
    .sw input { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    .bar { display: flex; gap: 10px; align-items: center; }
    .err { color: var(--sw-danger-text); }
    .okm { color: var(--sw-success-text); }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.s = await getSettings();
      this.draft = { ...this.s.rules };
    } catch (e) {
      this.err = describeError(e);
    }
    try {
      this.users = (await getReportRecipients()).users.map((u) => ({ id: u.id, name: u.name }));
    } catch {
      this.users = [];
    }
    await this.loadLinks();
    try {
      this.alerts = await getAlertSettings();
      this.esc = this.alerts.escalation ? structuredClone(this.alerts.escalation) : null;
    } catch {
      this.alerts = null;
    }
  }

  private async loadLinks() {
    try {
      this.links = (await getReportLinks()).links.filter((l) => l.state === 'live');
    } catch {
      this.links = null;
    }
  }

  private async revokeLinks(id?: string) {
    this.err = '';
    this.ok = '';
    try {
      if (id) await revokeReportLink(id);
      else await revokeAllReportLinks();
      this.ok = tt('repLinkRevoked');
    } catch (e) {
      this.err = describeError(e);
    }
    await this.loadLinks();
  }

  /** TEMPREPORT-297: the live links (who it went to, until when, downloads) with revoke per link and for all of them. */
  private linksBlock() {
    const ls = this.links;
    if (!ls) return nothing;
    return html`<div class="row wide" data-temp-links><span>${tt('linkLive', { n: ls.length })}</span>
      ${ls.length ? html`<button type="button" class="btn sm" data-links-revoke-all @click=${() => this.revokeLinks()}>${tt('linkRevokeAll')}</button>` : nothing}</div>
      ${ls.map((l) => html`<div class="row wide" data-link=${l.id}><span>${l.recipient ?? l.filename} · ${tt('repLinkUntil', { t: dayTimeText(new Date(l.expires_at)) })} ·
        ${tt('linkOpens', { n: l.opens, m: l.max_opens })}</span>
        <button type="button" class="btn sm ghost" data-link-revoke @click=${() => this.revokeLinks(l.id)}>${tt('repLinkRevoke')}</button></div>`)}`;
  }

  private async saveEscalation() {
    if (!this.alerts || !this.esc) return;
    this.err = '';
    this.ok = '';
    try {
      this.alerts = await putAlertSettings({ escalation: this.esc, row_version: this.alerts.row_version });
      this.esc = this.alerts.escalation ? structuredClone(this.alerts.escalation) : null;
      this.ok = tt('saved');
    } catch (e) {
      this.err = describeError(e);
    }
  }

  /** Idea 4: the chain - on / off, its channels, and per step "after N minutes" + the roles of that tier. */
  private escalationEditor(a: AlertSettings) {
    const e = this.esc;
    if (!e) return nothing;
    const ro = !a.can_edit;
    const max = a.steps_max ?? 4;
    const setStep = (i: number, patch: Partial<Escalation['steps'][number]>) => { this.esc = { ...e, steps: e.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }; };
    return html`<div class="kind" data-on=${String(e.enabled)} data-temp-escalation>
      <label class="sw"><input type="checkbox" .checked=${e.enabled} ?disabled=${ro} @change=${(ev: Event) => { this.esc = { ...e, enabled: (ev.target as HTMLInputElement).checked }; }} /><b>${tt('escTitle')}</b></label>
      <p class="hint" style="margin:0">${tt('escIntro')}</p>
      <div class="body" style="display:grid;gap:8px">
        ${e.steps.map((s, i) => html`<div class="step" data-esc-step=${i}><span>${tt('escStep', { n: i + 1 })}</span>
          <input type="number" min="1" max="1440" .value=${String(s.after_min)} ?disabled=${ro} aria-label=${tt('minutes')}
            @change=${(ev: Event) => setStep(i, { after_min: Math.max(1, Math.min(1440, Math.round(Number((ev.target as HTMLInputElement).value)))) })} /><span>${tt('minutes')}</span>
          <span class="opts">${a.roles.map((r) => html`<label class="sw"><input type="checkbox" .checked=${s.recipients.roles.includes(r.id)} ?disabled=${ro}
            @change=${(ev: Event) => setStep(i, { recipients: { ...s.recipients, roles: (ev.target as HTMLInputElement).checked ? [...s.recipients.roles, r.id] : s.recipients.roles.filter((x) => x !== r.id) } })} />${r.label}</label>`)}</span>
          ${ro ? nothing : html`<button type="button" class="btn sm ghost" aria-label=${tt('escRemove')} @click=${() => { this.esc = { ...e, steps: e.steps.filter((_x, j) => j !== i) }; }}><sw-icon name="close" size="14"></sw-icon></button>`}</div>`)}
        <div class="opts">${a.channels.map((c) => html`<label class="sw"><input type="checkbox" .checked=${e.channels.includes(c)} ?disabled=${ro}
          @change=${(ev: Event) => { this.esc = { ...e, channels: (ev.target as HTMLInputElement).checked ? [...e.channels, c] : e.channels.filter((x) => x !== c) }; }} />${tt(CH_LABEL[c])}</label>`)}</div>
        ${ro ? nothing : html`<div class="bar">${e.steps.length < max ? html`<button type="button" class="btn sm" data-esc-add @click=${() => {
          const last = e.steps[e.steps.length - 1]?.after_min ?? 0;
          this.esc = { ...e, steps: [...e.steps, { after_min: Math.min(1440, last + 30), recipients: { roles: ['system_admin'], users: [], groups: [] } }] };
        }}><sw-icon name="plus" size="14"></sw-icon>${tt('escAdd')}</button>` : nothing}
          <button type="button" class="btn pri sm" data-esc-save @click=${() => this.saveEscalation()}>${tt('escSave')}</button></div>`}
      </div></div>`;
  }

  private async save() {
    if (!this.s) return;
    this.busy = true;
    this.err = '';
    this.ok = '';
    const changed: Record<string, Val> = {};
    for (const [k, v] of Object.entries(this.draft)) if (JSON.stringify(v) !== JSON.stringify(this.s.code_defaults[k])) changed[k] = v;
    try {
      this.s = await putSettings(changed, this.s.row_version);
      this.draft = { ...this.s.rules };
      this.ok = tt('saved');
    } catch (e) {
      this.err = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async saveAlert(kind: AlertKind, patch: Record<string, unknown>) {
    if (!this.alerts) return;
    try {
      this.alerts = await putAlertSettings({ kinds: { [kind]: patch }, row_version: this.alerts.row_version });
    } catch (e) {
      this.err = describeError(e);
    }
  }

  private input(key: string) {
    const spec = this.s?.rule_specs[key];
    const v = this.draft[key];
    if (!spec) return nothing;
    if (spec.type === 'bool') return html`<input type="checkbox" .checked=${Boolean(v)} data-set=${key} @change=${(e: Event) => { this.draft = { ...this.draft, [key]: (e.target as HTMLInputElement).checked }; }} />`;
    if (spec.type === 'hhmm') return html`<input type="time" lang=${dateInputLang()} .value=${String(v)} data-set=${key} @change=${(e: Event) => { this.draft = { ...this.draft, [key]: (e.target as HTMLInputElement).value }; }} />`;
    if (spec.type === 'choice') {
      return html`<select data-set=${key} @change=${(e: Event) => { this.draft = { ...this.draft, [key]: (e.target as HTMLSelectElement).value }; }}>
        ${(spec.choices ?? []).map((c) => html`<option value=${c} ?selected=${v === c}>${(CHOICE_LABEL[`${key}:${c}`] ?? CHOICE_LABEL[c]) ? tt(CHOICE_LABEL[`${key}:${c}`] ?? CHOICE_LABEL[c]) : c}</option>`)}</select>`;
    }
    if (spec.type === 'text') {
      return html`<input type="text" maxlength=${spec.max ?? 300} class="txtin" .value=${String(v ?? '')} data-set=${key} @change=${(e: Event) => { this.draft = { ...this.draft, [key]: (e.target as HTMLInputElement).value.trim() }; }} />`;
    }
    if (spec.type === 'ids') {
      const chosen = Array.isArray(v) ? v : [];
      const set = (id: string, on: boolean) => { this.draft = { ...this.draft, [key]: on ? [...chosen, id] : chosen.filter((x) => x !== id) }; };
      return html`<span class="opts" data-set=${key}>${this.users.map((u) => html`<label class="sw"><input type="checkbox" .checked=${chosen.includes(u.id)} data-pick=${u.id}
        @change=${(e: Event) => set(u.id, (e.target as HTMLInputElement).checked)} />${u.name}</label>`)}</span>`;
    }
    if (spec.type === 'id') {
      return html`<input type="text" maxlength="64" class="idin" .value=${String(v ?? '')} data-set=${key} @change=${(e: Event) => { this.draft = { ...this.draft, [key]: (e.target as HTMLInputElement).value.trim() }; }} />`;
    }
    return html`<input type="number" .value=${String(v)} min=${spec.min ?? ''} max=${spec.max ?? ''} step=${spec.type === 'float' ? '0.1' : '1'} data-set=${key}
      @change=${(e: Event) => { const n = Number((e.target as HTMLInputElement).value); this.draft = { ...this.draft, [key]: spec.type === 'int' ? Math.round(n) : n }; }} />`;
  }

  render() {
    if (!this.s) return this.err ? html`<p class="err">${this.err}</p>` : html`<div class="skl" style="block-size:120px"></div>`;
    const a = this.alerts;
    return html`<div class="panel" data-temp-settings><h3>${tt('setTitle')}</h3><p class="hint">${tt('setIntro')}</p>
        ${GROUPS.map((g) => html`<h4>${tt(g.title)}</h4><div class="grid">${g.keys.filter(([k]) => ticketsEnabled() || !k.startsWith('ticket_')).map(([k, label]) => html`<div class=${k === 'report_link_wa_recipients' || k.startsWith('report_link_wa_text') ? 'row wide' : 'row'}><span>${tt(label)}${label === 'minutes' ? ` (${k.replace(/_/g, ' ')})` : ''}</span>${this.input(k)}</div>`)}${g.title === 'setLink' ? this.linksBlock() : nothing}</div>`)}
        <div class="bar" style="margin-top:12px"><button type="button" class="btn pri" ?disabled=${this.busy} data-temp-settings-save @click=${() => this.save()}>${tt('save')}</button>
          ${this.err ? html`<span class="err" role="alert">${this.err}</span>` : nothing}${this.ok ? html`<span class="okm" role="status">${this.ok}</span>` : nothing}</div></div>
      ${a ? html`<div class="panel" data-temp-alerts><h3>${tt('alertsTitle')}</h3><p class="hint">${tt('alertsIntro')}${a.can_edit ? '' : ` · ${tt('readOnly')}`}</p>
        <div style="display:grid;gap:10px">${a.kinds_order.map((k) => {
          const s = a.kinds[k];
          return html`<div class="kind" data-on=${String(s.enabled)} data-kind=${k}>
            <label class="sw"><input type="checkbox" .checked=${s.enabled} ?disabled=${!a.can_edit} @change=${(e: Event) => this.saveAlert(k, { enabled: (e.target as HTMLInputElement).checked })} /><b>${tt(KIND_LABEL[k])}</b></label>
            <div class="body"><div class="opts">${a.roles.map((r) => html`<label class="sw"><input type="checkbox" .checked=${s.recipients.roles.includes(r.id)} ?disabled=${!a.can_edit}
              @change=${(e: Event) => this.saveAlert(k, { recipients: { ...s.recipients, roles: (e.target as HTMLInputElement).checked ? [...s.recipients.roles, r.id] : s.recipients.roles.filter((x) => x !== r.id) } })} />${r.label}</label>`)}</div>
            <div class="opts">${a.channels.map((c) => html`<label class="sw"><input type="checkbox" .checked=${s.channels.includes(c)} ?disabled=${!a.can_edit}
              @change=${(e: Event) => this.saveAlert(k, { channels: (e.target as HTMLInputElement).checked ? [...s.channels, c] : s.channels.filter((x) => x !== c) })} />${tt(CH_LABEL[c])}</label>`)}</div></div></div>`;
        })}${this.escalationEditor(a)}</div></div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'temp-settings': TempSettings;
  }
}
