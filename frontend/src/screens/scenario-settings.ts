import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import './scenario-recipients';
import { ApiError } from '../api/client';
import { getScenarioSettings, saveScenarioSettings, scenarioChoices, type ScenarioChoices, type TimeWindow } from '../api/scenarios';
import { sct, type SctKey } from '../i18n/scenarios';
import { settingsStyles } from '../styles/settings';
import { dateInputLang } from '../api/day-format';

type Settings = Record<string, unknown>;

const BOOLS: [string, SctKey][] = [
  ['scenarios.enabled', 'setEnabled'], ['scenarios.kill_switch', 'setKill'], ['scenarios.actions.notify', 'setActNotify'],
  ['scenarios.actions.create_ticket', 'setActTicket'], ['scenarios.actions.set_flag', 'setActFlag'], ['scenarios.degraded_notice', 'setDegraded'],
];
const NUMS: [string, SctKey, number, number][] = [
  ['scenarios.max_fires_per_day', 'setMaxFires', 1, 1000], ['scenarios.max_tickets_per_day', 'setMaxTickets', 0, 200],
  ['scenarios.max_actions_per_hour', 'setMaxHour', 10, 5000], ['scenarios.max_rules', 'setMaxRules', 1, 500], ['scenarios.tick_s', 'setTick', 10, 300],
  ['scenarios.test_per_min', 'setTestPerMin', 1, 120], ['scenarios.runs_keep_days', 'setKeep', 7, 365],
];

/**
 * XSCENARIO109-295 `<scenario-settings>`: Settings › Automations › "תרחישים חוצי מודולים" (scenario.admin). Every threshold, window, cap and recipient of
 * the scenarios is here (the owner's standing rule); the module switch and every action switch start OFF. Renders nothing for a caller without the
 * permission (the server answers 403) or without a backend.
 */
@customElement('scenario-settings')
export class ScenarioSettings extends LitElement {
  @state() private saved: Settings | null = null;
  @state() private draft: Settings = {};
  @state() private unavailable = false;
  @state() private msg = '';
  @state() private err = '';
  @state() private busy = false;
  @state() private choices: ScenarioChoices | null = null;

  static styles = [settingsStyles, css`
    :host { display: block; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; }
    label { display: grid; gap: 4px; font-size: var(--sw-fs-sm, 13px); }
    input, select { font: inherit; padding: 4px 8px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border); background: var(--sw-surface); color: inherit; }
    .row { display: flex; align-items: center; gap: 10px; justify-content: space-between; }
    .days { display: inline-flex; gap: 2px; }
    .days button { min-inline-size: 28px; border-radius: var(--sw-r-xs); border: 1px solid var(--sw-border); background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .days button[aria-pressed='true'] { background: var(--sw-accent-soft); }
    .bar { display: flex; gap: 8px; align-items: center; justify-content: flex-end; margin-block-start: 10px; }
    .err { color: var(--sw-danger); } .ok { color: var(--sw-success); }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      const r = await getScenarioSettings();
      this.saved = r.settings;
      this.draft = { ...r.settings };
      void scenarioChoices().then((c) => (this.choices = c)).catch(() => undefined);
    } catch {
      this.unavailable = true; // no permission or no backend: the card is not shown
    }
  }

  private set(k: string, v: unknown) {
    this.draft = { ...this.draft, [k]: v };
    this.msg = '';
    this.err = '';
  }

  private changes(): Settings {
    const out: Settings = {};
    for (const [k, v] of Object.entries(this.draft)) if (JSON.stringify(v) !== JSON.stringify(this.saved?.[k])) out[k] = v;
    return out;
  }

  private async save() {
    const ch = this.changes();
    if (!Object.keys(ch).length) return;
    this.busy = true;
    try {
      const r = await saveScenarioSettings(ch);
      this.saved = r.settings;
      this.draft = { ...r.settings };
      this.msg = sct('setSaved');
    } catch (e) {
      this.err = e instanceof ApiError ? `${sct('setInvalid')}: ${String((e.body.details as { key?: string })?.key ?? '')}` : String(e);
    } finally {
      this.busy = false;
    }
  }

  private windowRow(): TemplateResult {
    const w = (this.draft['scenarios.work_window'] as TimeWindow | undefined) ?? { days: [6, 0, 1, 2, 3], from: '08:00', to: '17:00' };
    const names = sct('dayNames').split(',');
    const toggle = (d: number) => {
      const days = w.days.includes(d) ? w.days.filter((x) => x !== d) : [...w.days, d].sort();
      if (days.length) this.set('scenarios.work_window', { ...w, days });
    };
    return html`<label>${sct('setWindow')}<span class="row"><span class="days">${[6, 0, 1, 2, 3, 4, 5].map((d) => html`<button type="button" aria-pressed=${String(w.days.includes(d))} @click=${() => toggle(d)}>${names[d]}</button>`)}</span>
      <input type="time" lang=${dateInputLang()} .value=${w.from} @change=${(e: Event) => this.set('scenarios.work_window', { ...w, from: (e.target as HTMLInputElement).value })} />
      <input type="time" lang=${dateInputLang()} .value=${w.to} @change=${(e: Event) => this.set('scenarios.work_window', { ...w, to: (e.target as HTMLInputElement).value })} /></span></label>`;
  }

  render() {
    if (this.unavailable || !this.saved) return nothing;
    const rec = (this.draft['scenarios.default_recipients'] as { users: string[]; roles: string[] } | undefined) ?? { users: [], roles: [] };
    const dirty = Object.keys(this.changes()).length > 0;
    return html`<sw-card heading=${sct('setTitle')} data-scenario-settings>
      <div class="grid">
        ${BOOLS.map(([k, label]) => html`<div class="row"><span>${sct(label)}</span><sw-toggle data-key=${k} .checked=${this.draft[k] === true} @change=${(e: Event) => this.set(k, (e as CustomEvent<{ checked: boolean }>).detail.checked)}></sw-toggle></div>`)}
        ${NUMS.map(([k, label, lo, hi]) => html`<label>${sct(label)}<input type="number" data-key=${k} min=${lo} max=${hi} .value=${String(this.draft[k] ?? '')} @change=${(e: Event) => this.set(k, Number((e.target as HTMLInputElement).value))} /></label>`)}
        <label>${sct('setAfterSource')}<select data-key="scenarios.after_hours_source" @change=${(e: Event) => this.set('scenarios.after_hours_source', (e.target as HTMLSelectElement).value)}>
          <option value="window" ?selected=${this.draft['scenarios.after_hours_source'] !== 'calendar'}>${sct('setAfterWindow')}</option>
          <option value="calendar" ?selected=${this.draft['scenarios.after_hours_source'] === 'calendar'}>${sct('setAfterCalendar')}</option></select></label>
        ${this.windowRow()}
        <label>${sct('setRecipients')}<scenario-recipients data-key="scenarios.default_recipients" .choices=${this.choices} .value=${rec}
          @change=${(e: CustomEvent<{ value: { users: string[]; roles: string[] } }>) => this.set('scenarios.default_recipients', e.detail.value)}></scenario-recipients></label>
      </div>
      <div class="bar">${this.err ? html`<span class="err" role="alert">${this.err}</span>` : this.msg ? html`<span class="ok" role="status">${this.msg}</span>` : nothing}
        <sw-button variant="primary" icon="check" data-scenario-settings-save ?disabled=${!dirty || this.busy} @click=${() => void this.save()}>${sct('setSave')}</sw-button></div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'scenario-settings': ScenarioSettings;
  }
}
