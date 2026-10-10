import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import { onSession } from '../api/session';
import { applyUpdate, dismiss, onPwa, promptInstall, pwa, showInstall, showIosHint, startPwa } from './register';
import { syncSubscription } from './push';

/**
 * CR-008 P3: the PWA's small banners, fixed at the bottom of the screen above the phone navigation bar:
 * - "התקן את Arx" when Chromium (Android / desktop) offers to install the app;
 * - the iPhone / iPad guide (Share → Add to Home Screen), since Safari has no install prompt and iOS delivers
 *   notifications only to an app on the home screen;
 * - "a new version is available" when a new service worker is waiting (a reload applies it).
 * Never inside Home Assistant's frame (Ingress), where installing would install HA's page, not Arx.
 */
@customElement('arx-pwa-prompts')
export class ArxPwaPrompts extends LitElement {
  @state() private tick = 0;
  private stops: (() => void)[] = [];
  private synced = false;

  static styles = css`
    :host {
      position: fixed;
      inset-inline: 0;
      inset-block-end: calc(16px + env(safe-area-inset-bottom, 0px));
      z-index: 60;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
      padding-inline: 12px;
    }
    @media (max-width: 767px) {
      :host {
        inset-block-end: calc(76px + env(safe-area-inset-bottom, 0px));
      }
    }
    .card {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 12px;
      inline-size: min(520px, 100%);
      box-sizing: border-box;
      background: var(--sw-surface);
      color: var(--sw-text);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3, 0 10px 30px rgba(15, 23, 42, 0.16));
      padding: 12px 14px;
      font-size: var(--sw-fs-sm);
    }
    .card img {
      inline-size: 40px;
      block-size: 40px;
      border-radius: var(--sw-r-md);
      flex-shrink: 0;
    }
    .text {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .text b {
      font-weight: var(--sw-fw-semibold);
    }
    .text span {
      color: var(--sw-text-2);
      line-height: 1.45;
    }
    .actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }
    .x {
      border: 0;
      background: transparent;
      color: var(--sw-text-3);
      cursor: pointer;
      padding: 4px;
      border-radius: var(--sw-r-xs);
      display: inline-flex;
    }
    .share {
      display: inline-block;
      vertical-align: -3px;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.stops.push(onPwa(() => this.tick++));
    this.stops.push(
      onSession((s) => {
        if (s.mode === 'api' && !this.synced) {
          this.synced = true;
          void syncSubscription();
        }
      }),
    );
    void startPwa();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stops.forEach((s) => s());
    this.stops = [];
  }

  private async install() {
    await promptInstall();
  }

  private icon() {
    return html`<img src="./icons/arx-192.png" alt="" />`;
  }

  render() {
    void this.tick;
    const cards = [];
    if (pwa.updateReady) {
      cards.push(html`<div class="card" role="status" data-pwa-update>
        <sw-icon name="refresh" size=${22}></sw-icon>
        <div class="text"><b>גרסה חדשה של Arx זמינה</b><span>רעננו כדי לעבור אליה; מה שפתוח יישמר בכתובת.</span></div>
        <div class="actions"><sw-button size="sm" variant="primary" @click=${() => applyUpdate()}>רענון</sw-button></div>
      </div>`);
    }
    if (showInstall()) {
      cards.push(html`<div class="card" role="dialog" aria-label="התקן את Arx" data-pwa-install>
        ${this.icon()}
        <div class="text"><b>התקן את Arx</b><span>אפליקציה במסך הבית או בשולחן העבודה: פתיחה מהירה, מסך מלא והתראות.</span></div>
        <div class="actions">
          <sw-button size="sm" variant="primary" data-pwa-install-go @click=${() => this.install()}>התקנה</sw-button>
          <sw-button size="sm" variant="ghost" data-pwa-install-later @click=${() => dismiss('install')}>לא עכשיו</sw-button>
        </div>
      </div>`);
    } else if (showIosHint()) {
      cards.push(html`<div class="card" role="dialog" aria-label="התקנת Arx באייפון" data-pwa-ios>
        ${this.icon()}
        <div class="text"><b>התקן את Arx באייפון</b><span>ב־Safari הקישו על <svg class="share" width="16" height="16" viewBox="0 0 24 24" aria-label="שיתוף" role="img"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg> שיתוף ואז "הוספה למסך הבית". התראות באייפון מגיעות רק לאפליקציה שהותקנה כך.</span></div>
        <button class="x" type="button" aria-label="סגירה" data-pwa-ios-close @click=${() => dismiss('ios')}><sw-icon name="close" size=${16}></sw-icon></button>
      </div>`);
    }
    return cards.length ? cards : nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'arx-pwa-prompts': ArxPwaPrompts;
  }
}
