import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { DEFAULT_BOUNDS, incidentSettings, saveIncidentSettings, type IncidentSettingKey, type IncidentSettings, type SettingBound } from '../api/incidents';
import { it } from '../i18n/incidents';
import { refreshIncidents, startIncidents } from './store';

type IntKey = Extract<IncidentSettingKey, 'incident.merge_window_s' | 'incident.max_live' | 'incident.max_live_phone' | 'incident.snapshot_refresh_s' | 'incident.refresh_s' | 'incident.hidden_stop_s' | 'incident.door_window_s' | 'incident.near_radius_pct' | 'incidents.retention_days'>;
type BoolKey = Extract<IncidentSettingKey, 'incident.enabled' | 'incident.auto_open.alarm' | 'incident.header_clock'>;
/** Shown in minutes, stored in seconds. */
const MINUTE_KEYS = new Set<IntKey>(['incident.merge_window_s', 'incident.door_window_s']);

/**
 * CR-LIVEEVENT100: every option of the live event mode, in one card - the module switch, the automatic opening from the burglary alarm,
 * the merge window, the live budget (desktop / phone), the refresh and stop timers, the door window, the "nearby" radius, the red dot,
 * the header clock and the retention; the recipients are the notification policy (a link). Editable by system.configure only (the server
 * checks it again); everyone else sees the values read-only. Used by הגדרות › אבטחה › מצב אירוע חי and by the page's settings sheet.
 */
@customElement('incident-settings-form')
export class IncidentSettingsForm extends LitElement {
  /** The sheet form (inside the page): a close button in the head and a compact layout. */
  @property({ type: Boolean, reflect: true }) sheet = false;
  @state() private values: IncidentSettings | null = null;
  @state() private draft: Partial<IncidentSettings> = {};
  @state() private bounds: Record<IncidentSettingKey, SettingBound> = DEFAULT_BOUNDS;
  @state() private canEdit = false;
  @state() private error = '';
  @state() private saving = false;
  @state() private invalid = new Set<IncidentSettingKey>();

  static styles = css`
    :host { display: block; }
    .hd { display: flex; align-items: center; gap: 8px; margin-block-end: 6px; }
    .hd h2 { margin: 0; font-size: var(--sw-fs-xl); color: var(--sw-heading); }
    .hd .sp { flex: 1; }
    .card { background: var(--sw-surface-solid, var(--sw-surface)); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); padding: 12px 18px 14px; box-shadow: var(--sw-shadow-1); max-inline-size: 760px; }
    :host([sheet]) .card { border: 0; box-shadow: none; padding: 0; max-inline-size: none; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr); }
    @media (min-width: 900px) { :host(:not([sheet])) .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 28px; } }
    .srow { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-block-start: 1px solid var(--sw-border); min-inline-size: 0; }
    .tx { flex: 1; min-inline-size: 0; }
    .tx b { display: block; font-size: var(--sw-fs-base); color: var(--sw-heading); font-weight: var(--sw-fw-semibold); }
    .tx span { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .sw { position: relative; inline-size: 40px; block-size: 24px; border-radius: 999px; background: var(--sw-border-strong); border: 0; cursor: pointer; flex: none; padding: 0; }
    .sw::after { content: ''; position: absolute; inset-block-start: 3px; inset-inline-start: 3px; inline-size: 18px; block-size: 18px; border-radius: 50%; background: #fff; transition: inset-inline-start var(--sw-t-fast) var(--sw-ease); box-shadow: var(--sw-shadow-1); }
    .sw[aria-checked='true'] { background: var(--sw-accent); }
    .sw[aria-checked='true']::after { inset-inline-start: 19px; }
    .sw:disabled { opacity: var(--sw-disabled-opacity); cursor: default; }
    .seg { display: inline-flex; padding: 2px; background: var(--sw-surface-3); border-radius: var(--sw-r-sm); flex: none; }
    .seg button { font: inherit; font-size: var(--sw-fs-sm); border: 0; background: transparent; color: var(--sw-text-2); border-radius: var(--sw-r-xs); padding: 4px 10px; min-block-size: 26px; cursor: pointer; white-space: nowrap; }
    .seg button[aria-pressed='true'] { background: var(--sw-surface); color: var(--sw-heading); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1); }
    .seg button:disabled { cursor: default; }
    input[type='number'] { font: inherit; font-size: var(--sw-fs-sm); background: var(--sw-surface); color: var(--sw-text); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); padding: 3px 6px; min-block-size: 28px; inline-size: 64px; }
    input[aria-invalid='true'] { border-color: var(--sw-danger); }
    .unit { color: var(--sw-text-3); font-size: var(--sw-fs-xs); white-space: nowrap; }
    a { color: var(--sw-accent-text); font-size: var(--sw-fs-sm); white-space: nowrap; }
    .foot { display: flex; gap: 8px; justify-content: flex-end; align-items: center; padding-block-start: 8px; border-block-start: 1px solid var(--sw-border); }
    .foot .msg { flex: 1; font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
    .foot .err { color: var(--sw-danger-text); }
    @media (max-width: 767px) and (pointer: coarse) { .sw { min-block-size: 24px; } input[type='number'] { min-block-size: 36px; } .seg button { min-block-size: 36px; } }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      const r = await incidentSettings();
      this.values = r.settings;
      this.bounds = { ...DEFAULT_BOUNDS, ...(r.bounds ?? {}) };
      this.canEdit = r.can_edit;
      this.draft = {};
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private v<K extends IncidentSettingKey>(k: K): IncidentSettings[K] {
    return (k in this.draft ? this.draft[k] : this.values?.[k]) as IncidentSettings[K];
  }

  private set<K extends IncidentSettingKey>(k: K, value: IncidentSettings[K]) {
    this.draft = { ...this.draft, [k]: value };
  }

  private setInt(k: IntKey, raw: string) {
    const b = this.bounds[k];
    const n = Number(raw);
    const val = MINUTE_KEYS.has(k) ? Math.round(n * 60) : Math.round(n);
    const ok = raw.trim() !== '' && Number.isFinite(n) && b.kind === 'int' && val >= b.min && val <= b.max;
    const inv = new Set(this.invalid);
    if (ok) {
      inv.delete(k);
      this.set(k, val);
    } else inv.add(k);
    this.invalid = inv;
  }

  private async save() {
    if (!this.values || this.invalid.size || !Object.keys(this.draft).length) return;
    this.saving = true;
    try {
      const r = await saveIncidentSettings(this.draft);
      this.values = r.settings;
      this.draft = {};
      this.error = '';
      startIncidents(r.settings['incident.enabled']);
      void refreshIncidents();
      this.dispatchEvent(new CustomEvent('saved', { detail: r.settings, bubbles: true, composed: true }));
    } catch (err) {
      this.error = describeError(err) || it('sError');
    } finally {
      this.saving = false;
    }
  }

  private cancel() {
    this.draft = {};
    this.invalid = new Set();
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private toggle(k: BoolKey, label: string) {
    const on = !!this.v(k);
    return html`<button class="sw" role="switch" type="button" aria-checked=${on ? 'true' : 'false'} aria-label=${label} data-setting=${k} ?disabled=${!this.canEdit}
      @click=${() => this.set(k, !on)}></button>`;
  }

  private num(k: IntKey, label: string) {
    const b = this.bounds[k];
    const raw = Number(this.v(k));
    const shown = MINUTE_KEYS.has(k) ? raw / 60 : raw;
    const min = b.kind === 'int' ? (MINUTE_KEYS.has(k) ? b.min / 60 : b.min) : 0;
    const max = b.kind === 'int' ? (MINUTE_KEYS.has(k) ? b.max / 60 : b.max) : 0;
    return html`<input type="number" inputmode="numeric" min=${min} max=${max} step="1" .value=${String(shown)} aria-label=${label} data-setting=${k}
      aria-invalid=${this.invalid.has(k) ? 'true' : 'false'} ?disabled=${!this.canEdit} @input=${(e: Event) => this.setInt(k, (e.target as HTMLInputElement).value)} />`;
  }

  private row(title: string, hint: string, control: unknown) {
    return html`<div class="srow"><div class="tx"><b>${title}</b><span>${hint}</span></div>${control}</div>`;
  }

  render() {
    if (this.error && !this.values) return html`<sw-state-panel state="error" heading=${it('sError')} hint=${this.error} actionLabel=${it('retry')} @action=${() => void this.load()}></sw-state-panel>`;
    if (!this.values) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const dot = this.v('incident.red_dot');
    const dirty = Object.keys(this.draft).length > 0;
    return html`<div class="card" data-incident-settings>
      ${this.sheet ? html`<div class="hd"><h2>${it('sTitle')}</h2><span class="sp"></span><sw-button size="sm" variant="ghost" data-settings-close @click=${() => this.cancel()}>${it('sClose')}</sw-button></div>` : nothing}
      <div class="grid">
        ${this.row(it('sEnabled'), it('sEnabledHint'), this.toggle('incident.enabled', it('sEnabled')))}
        ${this.row(it('sAuto'), it('sAutoHint'), this.toggle('incident.auto_open.alarm', it('sAuto')))}
        ${this.row(it('sMerge'), it('sMergeHint'), html`${this.num('incident.merge_window_s', it('sMerge'))}<span class="unit">${it('sMinutes', { n: '' }).trim()}</span>`)}
        ${this.row(it('sLive'), it('sLiveHint'), html`<span class="unit">${it('sDesktop')}</span>${this.num('incident.max_live', it('sDesktop'))}<span class="unit">${it('sPhone')}</span>${this.num('incident.max_live_phone', it('sPhone'))}`)}
        ${this.row(it('sSnap'), it('sTimesHint'), this.num('incident.snapshot_refresh_s', it('sSnap')))}
        ${this.row(it('sRefresh'), it('sTimesHint'), this.num('incident.refresh_s', it('sRefresh')))}
        ${this.row(it('sHidden'), it('sTimesHint'), this.num('incident.hidden_stop_s', it('sHidden')))}
        ${this.row(it('sDoorWindow'), it('sDoorWindowHint'), this.num('incident.door_window_s', it('sDoorWindow')))}
        ${this.row(it('sRadius'), it('sRadiusHint'), this.num('incident.near_radius_pct', it('sRadius')))}
        ${this.row(it('sDot'), it('sDotHint'), html`<div class="seg" role="group" aria-label=${it('sDot')} data-setting="incident.red_dot">
            <button type="button" data-dot="active" aria-pressed=${dot === 'active' ? 'true' : 'false'} ?disabled=${!this.canEdit} @click=${() => this.set('incident.red_dot', 'active')}>${it('sDotActive')}</button>
            <button type="button" data-dot="off" aria-pressed=${dot === 'off' ? 'true' : 'false'} ?disabled=${!this.canEdit} @click=${() => this.set('incident.red_dot', 'off')}>${it('sDotOff')}</button></div>`)}
        ${this.row(it('sClock'), it('sClockHint'), this.toggle('incident.header_clock', it('sClock')))}
        ${this.row(it('sRetention'), it('sRetentionHint'), this.num('incidents.retention_days', it('sRetention')))}
        ${this.row(it('sRecipients'), it('sRecipientsHint'), html`<a href="#/system/notifications" data-recipients-link>${it('sRecipientsLink')}</a>`)}
      </div>
      <div class="foot">
        <span class="msg ${this.error ? 'err' : ''}">${this.error || (this.canEdit ? '' : it('sReadOnly'))}</span>
        ${this.sheet ? html`<sw-button data-settings-cancel @click=${() => this.cancel()}>${it('sCancel')}</sw-button>` : nothing}
        ${this.canEdit ? html`<sw-button variant="primary" data-settings-save ?disabled=${!dirty || this.invalid.size > 0 || this.saving} @click=${() => void this.save()}>${it('sSave')}</sw-button>` : nothing}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'incident-settings-form': IncidentSettingsForm;
  }
}
