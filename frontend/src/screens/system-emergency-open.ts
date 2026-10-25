import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import { describeError } from '../api/client';
import { getEmergencySettings, putEmergencySettings, type EmergencySettings } from '../api/door-windows';
import { dwt, type DwtKey } from '../i18n/door-windows';
import { settingsStyles } from '../styles/settings';

const HOURS = [
  ['doors.emergency.grant.default_hours', 'sGrantDefault', 0] as const,
  ['doors.emergency.grant.max_hours', 'sGrantMax', 1] as const,
];
const SWITCHES = [
  ['doors.emergency.grant.by_security_manager', 'sGrantManager'] as const,
  ['doors.emergency.retry_open.by_holders', 'sRetryHolders'] as const,
];
const KEYS: string[] = [...HOURS.map((h) => h[0]), ...SWITCHES.map((s) => s[0])];

/**
 * EMROLE-295 (owner option B, 2026-10-25): the emergency-open role's settings in the general system settings, next to the door cards - the default expiry,
 * the longest expiry a security manager may give, who may give the role, and whether its holders may retry an unconfirmed door. The same call and the same
 * permission as the door-windows drawer (`PUT /doors/emergency/settings`, `system.configure`); the server validates and audits every change. Words are the
 * door-windows words (four languages). The card draws nothing for a reader the server refuses.
 */
@customElement('sw-emergency-open-settings')
export class SwEmergencyOpenSettings extends LitElement {
  static styles = [
    settingsStyles,
    css`
      :host { display: block; }
      .f { display: flex; align-items: center; justify-content: space-between; gap: var(--sw-s-3); flex-wrap: wrap; padding: var(--sw-s-2) 0; border-block-end: 1px solid var(--sw-border); }
      .f input { inline-size: 7em; box-sizing: border-box; min-block-size: 44px; font: inherit; color: var(--sw-text); background: var(--sw-surface);
        border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); padding: var(--sw-s-1) var(--sw-s-2); }
      .f input:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 1px; }
      .bar { display: flex; gap: var(--sw-s-2); align-items: center; padding-block-start: var(--sw-s-2); }
      .err { color: var(--sw-danger-text, var(--sw-text)); font-size: var(--sw-fs-sm); }
    `,
  ];

  @state() private saved: Record<string, string> | null = null;
  @state() private edit: Record<string, string> = {};
  @state() private busy = false;
  @state() private error = '';
  @state() private done = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const s = (await getEmergencySettings()).settings as EmergencySettings;
      const cur = Object.fromEntries(KEYS.map((k) => [k, String((s as unknown as Record<string, unknown>)[k] ?? '')]));
      this.saved = cur;
      this.edit = { ...cur };
    } catch {
      this.saved = null; // not allowed (or no backend): the card is simply absent
    }
  }

  private async save(): Promise<void> {
    if (!this.saved) return;
    const changes = Object.fromEntries(Object.entries(this.edit).filter(([k, v]) => this.saved![k] !== v));
    if (!Object.keys(changes).length) return;
    this.busy = true;
    this.error = '';
    this.done = false;
    try {
      await putEmergencySettings(changes);
      await this.load();
      this.done = true;
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    if (!this.saved) return nothing;
    const dirty = KEYS.some((k) => this.edit[k] !== this.saved![k]);
    const valid = HOURS.every(([k, , min]) => /^\d+$/.test(this.edit[k] ?? '') && Number(this.edit[k]) >= min && Number(this.edit[k]) <= 8760)
      && Number(this.edit[HOURS[0][0]]) <= Number(this.edit[HOURS[1][0]]);
    return html`<sw-card heading=${dwt('sGrants')} data-emergency-open-settings>
      ${HOURS.map(([k, label]) => html`<div class="f"><label for=${k}>${dwt(label as DwtKey)}</label>
        <input id=${k} type="text" inputmode="numeric" data-eo-setting=${k} .value=${live(this.edit[k] ?? '')}
          @input=${(e: Event) => { this.edit = { ...this.edit, [k]: (e.target as HTMLInputElement).value.trim() }; this.done = false; }}></div>`)}
      ${SWITCHES.map(([k, label]) => html`<div class="f"><span>${dwt(label as DwtKey)}</span>
        <sw-toggle label=${dwt(label as DwtKey)} labelHidden data-eo-switch=${k} .checked=${live(this.edit[k] === 'on')}
          @change=${(e: CustomEvent<{ checked: boolean }>) => { this.edit = { ...this.edit, [k]: e.detail.checked ? 'on' : 'off' }; this.done = false; }}></sw-toggle></div>`)}
      <div class="bar"><sw-button variant="primary" data-eo-save ?disabled=${this.busy || !dirty || !valid} @click=${() => void this.save()}>${dwt('sSave')}</sw-button>
        ${this.done ? html`<span>${dwt('saved')}</span>` : nothing}${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}</div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-emergency-open-settings': SwEmergencyOpenSettings;
  }
}
