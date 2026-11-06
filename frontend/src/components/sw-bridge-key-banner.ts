import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-icon';
import { getNoticeBanner } from '../api/bridge-key';
import { can, isApi, onRemote } from '../api/session';
import { bkt } from '../i18n/bridge-key';

/**
 * WXH-LEFTOVERS-2405 (CR-034 section 7): while no owner contact is chosen, an OPEN bridge-key security notice keeps one line on every
 * Settings screen until a system administrator acknowledges it in the notification center. The server decides (`GET
 * /system/bridge-key/notice`, system administrator only, local sessions only); the line renders nothing otherwise, and nothing on a 403 /
 * 404 / error. Read once when the Settings area opens.
 */
@customElement('sw-bridge-key-banner')
export class SwBridgeKeyBanner extends LitElement {
  @state() private show = false;

  connectedCallback(): void {
    super.connectedCallback();
    if (!isApi() || onRemote() || !can('system.configure')) return;
    void getNoticeBanner()
      .then((b) => (this.show = b?.show === true))
      .catch(() => (this.show = false));
  }

  render() {
    if (!this.show) return nothing;
    return html`<div class="bar" role="alert" data-bridge-key-banner><sw-icon name="warning" size=${16}></sw-icon><span>${bkt('bannerText')}</span>
      <a href="#/system/notifications">${bkt('bannerOpen')}</a><a href="#/system/setup">${bkt('bannerContacts')}</a></div>`;
  }

  static styles = css`
    :host {
      display: block;
    }
    .bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 12px;
      margin: 12px 24px 0;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-danger-soft, var(--sw-warning-soft));
      color: var(--sw-danger-text, var(--sw-warning-text));
      font-size: var(--sw-fs-sm);
    }
    .bar span {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    a {
      color: inherit;
      font-weight: var(--sw-fw-medium);
    }
    @media (min-width: 768px) {
      .bar {
        padding-inline-end: calc(86px + var(--sw-corner-extra, 0px));
      }
    }
    @media (max-width: 767px) {
      .bar {
        margin: 8px 12px 0;
        padding-inline-end: 92px;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-bridge-key-banner': SwBridgeKeyBanner;
  }
}
