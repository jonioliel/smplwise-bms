import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-button';
import { callNative, nativeCan, readDeviceStatus, type DeviceStatus } from '../arx/native-app';
import { deviceRows } from '../arx/native-device-view';
import { t } from '../i18n/he';

/**
 * החשבון שלי › המכשיר שלי (MOBILE214): what the native app says about this phone. The card waits for the app's
 * `deviceStatus()` and shows its fields as they come; buttons for the app's settings screens appear only when the app
 * offers them. Mounted while its section of the user menu is open.
 */
@customElement('sw-native-device-card')
export class SwNativeDeviceCard extends LitElement {
  @state() private status: DeviceStatus | null = null;
  @state() private loading = true;

  static styles = css`
    :host { display: block; }
    .row { display: flex; justify-content: space-between; gap: var(--sw-space-3, 12px); padding: 6px 0; font-size: var(--sw-text-sm, 13px); }
    .row .lbl { color: var(--sw-text-3); }
    .row bdi { text-align: end; }
    .muted { color: var(--sw-text-3); font-size: var(--sw-text-sm, 13px); }
    .actions { display: flex; gap: var(--sw-space-2, 8px); flex-wrap: wrap; margin-top: var(--sw-space-2, 8px); }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    this.loading = true;
    this.status = await readDeviceStatus();
    this.loading = false;
  }

  render() {
    if (this.loading) return html`<div class="muted" data-device-loading>${t('nativeDevice.loading')}</div>`;
    if (!this.status) return nothing;
    return html`
      <div data-native-device>
        ${deviceRows(this.status).map((r) => html`<div class="row" data-device-row=${r.key}><span class="lbl">${r.label}</span><bdi>${r.value}</bdi></div>`)}
        <div class="actions">
          ${nativeCan('openLocationSettings')
            ? html`<sw-button size="sm" data-device-open-location @click=${() => callNative('openLocationSettings')}>${t('nativeDevice.openLocation')}</sw-button>`
            : nothing}
          ${nativeCan('openSensorSettings')
            ? html`<sw-button size="sm" data-device-open-sensors @click=${() => callNative('openSensorSettings')}>${t('nativeDevice.openSensors')}</sw-button>`
            : nothing}
        </div>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-native-device-card': SwNativeDeviceCard;
  }
}
