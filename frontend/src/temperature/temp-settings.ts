import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { describeError } from '../api/client';
import { getAlertSettings, getSettings, putAlertSettings, putSettings, type AlertChannel, type AlertKind, type AlertSettings, type SettingsResponse } from '../api/temperature';
import { tempCss } from './styles';
import { tt, type TtKey } from '../i18n/temperature';

type Val = boolean | number | string;
const GROUPS: { title: TtKey; keys: [string, TtKey][] }[] = [
  { title: 'rulesTitle', keys: [['warn_on_excursion', 'ruleWarnNow'], ['high_alarm', 'ruleHigh'], ['high_alarm_min', 'minutes'], ['low_alarm', 'ruleLow'], ['low_alarm_min', 'minutes'],
    ['door_alarm', 'ruleDoor'], ['door_alarm_min', 'minutes'], ['offline_warn', 'ruleOffline'], ['offline_min', 'minutes'], ['hysteresis', 'hysteresis']] },
  { title: 'quiet', keys: [['alerts_enabled', 'alertsEnabled'], ['quiet_enabled', 'quiet'], ['quiet_from', 'start'], ['quiet_to', 'to'], ['quiet_includes_alarms', 'quietAlarms'], ['mute_includes_alarms', 'muteAlarms']] },
  { title: 'defrost', keys: [['defrost_suppress', 'defrostSuppress'], ['exclude_defrost_stats', 'excludeStats'], ['defrost_hard_margin', 'hardMargin'], ['learn_days', 'learnDays'],
    ['learn_min_repeats', 'learnRepeats'], ['defrost_max_min', 'defrostMax']] },
  { title: 'groupClimate', keys: [['setpoint_tolerance', 'tolerance'], ['alert_when_off', 'alertWhenOff']] },
  { title: 'retention', keys: [['retention_days', 'retention']] },
];
const KIND_LABEL: Record<AlertKind, TtKey> = { alarm: 'kindAlarm', warning: 'kindWarning', offline: 'kindOffline' };
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
      this.alerts = await getAlertSettings();
    } catch {
      this.alerts = null;
    }
  }

  private async save() {
    if (!this.s) return;
    this.busy = true;
    this.err = '';
    this.ok = '';
    const changed: Record<string, Val> = {};
    for (const [k, v] of Object.entries(this.draft)) if (v !== this.s.code_defaults[k]) changed[k] = v;
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
    if (spec.type === 'hhmm') return html`<input type="time" .value=${String(v)} data-set=${key} @change=${(e: Event) => { this.draft = { ...this.draft, [key]: (e.target as HTMLInputElement).value }; }} />`;
    return html`<input type="number" .value=${String(v)} min=${spec.min ?? ''} max=${spec.max ?? ''} step=${spec.type === 'float' ? '0.1' : '1'} data-set=${key}
      @change=${(e: Event) => { const n = Number((e.target as HTMLInputElement).value); this.draft = { ...this.draft, [key]: spec.type === 'int' ? Math.round(n) : n }; }} />`;
  }

  render() {
    if (!this.s) return this.err ? html`<p class="err">${this.err}</p>` : html`<div class="skl" style="block-size:120px"></div>`;
    const a = this.alerts;
    return html`<div class="panel" data-temp-settings><h3>${tt('setTitle')}</h3><p class="hint">${tt('setIntro')}</p>
        ${GROUPS.map((g) => html`<h4>${tt(g.title)}</h4><div class="grid">${g.keys.map(([k, label]) => html`<div class="row"><span>${tt(label)}${label === 'minutes' ? ` (${k.replace(/_/g, ' ')})` : ''}</span>${this.input(k)}</div>`)}</div>`)}
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
        })}</div></div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'temp-settings': TempSettings;
  }
}
