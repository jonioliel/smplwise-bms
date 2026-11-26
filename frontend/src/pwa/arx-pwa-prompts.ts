import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import { liftToTopLayer, liftedHostReset } from '../components/top-layer';
import { deepActive, focusIfLost } from '../components/modal-stack';
import { onMeEvent, onSession } from '../api/session';
import { applyUpdate, dismiss, noteServerBuild, onPwa, promptInstall, showInstall, showIosHint, showUpdate, startPwa, updateLater } from './register';
import { syncSubscription } from './push';
import { tr } from '../i18n/msg/misc';

/**
 * CR-008 P3: the PWA's small banners, fixed at the bottom of the screen above the phone navigation bar:
 * - "התקן את Arx" when Chromium (Android / desktop) offers to install the app;
 * - the iPhone / iPad guide (Share → Add to Home Screen), since Safari has no install prompt and iOS delivers
 *   notifications only to an app on the home screen;
 * - "a new version is available" when a new service worker is waiting (a reload applies it).
 * Never inside Home Assistant's frame (Ingress), where installing would install HA's page, not Arx.
 *
 * KIOSK polish (2026-10-11): the cards rise in (off under reduced motion), every button is a 44 px target on a touch screen,
 * the actions drop under the text on a narrow phone, and the connection pill at the top says when the network is gone
 * (`offline` / `online` window events: the browser's own knowledge, nothing is polled) and, for a moment, when it is back.
 */
@customElement('arx-pwa-prompts')
export class ArxPwaPrompts extends LitElement {
  @state() private tick = 0;
  @state() private offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  @state() private backOnline = false;
  private stops: (() => void)[] = [];
  private synced = false;
  private backTimer = 0;
  private readonly onOffline = () => {
    this.offline = true;
    this.backOnline = false;
    window.clearTimeout(this.backTimer);
  };
  private readonly onOnline = () => {
    if (!this.offline) return;
    this.offline = false;
    this.backOnline = true;
    window.clearTimeout(this.backTimer);
    this.backTimer = window.setTimeout(() => (this.backOnline = false), 3000);
  };

  static styles = [liftedHostReset, css`
    :host {
      position: fixed;
      inset-inline: 0;
      inset-block-end: calc(16px + env(safe-area-inset-bottom, 0px));
      z-index: var(--sw-z-toast);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
      padding-inline: max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-left, 0px));
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
      background: var(--sw-surface-solid);
      color: var(--sw-text);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-xl);
      box-shadow: var(--sw-shadow-3);
      padding: 12px 14px;
      font-size: var(--sw-fs-sm);
      animation: card-rise var(--sw-t-sheet) var(--sw-ease-dialog) both;
    }
    .card img {
      inline-size: 44px;
      block-size: 44px;
      border-radius: var(--sw-r-md);
      flex-shrink: 0;
    }
    .card > sw-icon {
      flex-shrink: 0;
      color: var(--sw-accent-text);
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
      font-size: var(--sw-fs-md);
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
      padding: 0;
      inline-size: 36px;
      block-size: 36px;
      border-radius: var(--sw-r-pill);
      display: inline-grid;
      place-items: center;
      flex-shrink: 0;
      margin-inline-end: -6px;
    }
    .x:hover {
      background: var(--sw-hover-wash);
    }
    .x:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .share {
      display: inline-block;
      vertical-align: -3px;
    }
    /* a touch screen: 44 px targets, and on a narrow phone the actions drop under the text so neither is squeezed */
    @media (pointer: coarse) {
      .x {
        inline-size: 44px;
        block-size: 44px;
      }
    }
    @media (max-width: 479px) {
      .card {
        flex-wrap: wrap;
      }
      .card .actions {
        flex: 1 0 100%;
        justify-content: flex-end;
      }
      .card .actions sw-button {
        flex: 1;
      }
    }
    /* the connection pill: at the top, under the status bar, out of the way of the content and the bars */
    .net {
      pointer-events: none;
      position: fixed;
      inset-block-start: calc(10px + env(safe-area-inset-top, 0px));
      inset-inline-start: 50%;
      transform: translateX(50%);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 36px;
      padding: 0 14px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-toast-bg);
      color: var(--sw-toast-text);
      box-shadow: var(--sw-shadow-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      white-space: nowrap;
      animation: net-drop var(--sw-t-sheet) var(--sw-ease-dialog) both;
    }
    .net i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-stale);
    }
    .net[data-net='online'] i {
      background: var(--sw-live);
    }
    /* OVERLAY-FADE-2520: the prompt card and the connection pill arrive by transform only - their texts are at full contrast from the
       first frame (the fill mode stays: a delayed start keeps the start transform, never an invisible card) */
    @keyframes card-rise {
      from {
        transform: translateY(12px);
      }
    }
    @keyframes net-drop {
      from {
        transform: translate(50%, -8px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .card,
      .net {
        animation: none;
      }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    this.stops.push(onPwa(() => this.tick++));
    // CLIENT-RESILIENCE-2540 (FC-06): the server's version in the hello of every /me/ws connection; another one than this bundle's
    // shows the update card below (also without a service worker: a plain-http local address, the HA frame)
    this.stops.push(
      onMeEvent((env) => {
        if (env.type === 'hello') noteServerBuild((env.payload as { build?: unknown } | undefined)?.build);
      }),
    );
    this.stops.push(
      onSession((s) => {
        if (s.mode === 'api' && !this.synced) {
          this.synced = true;
          void syncSubscription();
        }
      }),
    );
    window.addEventListener('offline', this.onOffline);
    window.addEventListener('online', this.onOnline);
    window.addEventListener('focusin', this.onFocus, true);
    void startPwa();
    // DIALOG-TOPLAYER-2381: the offline pill and the update card stay above an open sw-dialog (it is in the top layer)
    liftToTopLayer(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stops.forEach((s) => s());
    this.stops = [];
    window.removeEventListener('offline', this.onOffline);
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('focusin', this.onFocus, true);
    window.clearTimeout(this.backTimer);
  }

  /** A11Y-NEW-2550: the last control of the page that had the focus (outside these cards). A card put away by keyboard ("אחר כך",
   * "לא עכשיו", ✕) gives the focus back there instead of letting it fall to the page body. */
  private lastOutside: HTMLElement | null = null;
  private readonly onFocus = () => {
    const a = deepActive();
    if (a && a !== document.body && !this.shadowRoot?.contains(a)) this.lastOutside = a;
  };

  private putAway(done: () => void) {
    const back = this.lastOutside;
    done();
    void this.updateComplete.then(() => focusIfLost(back));
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
    if (this.offline) cards.push(html`<span class="net" role="status" data-net="offline"><i></i>${tr('אין חיבור · מוצגים נתונים אחרונים')}</span>`);
    else if (this.backOnline) cards.push(html`<span class="net" role="status" data-net="online"><i></i>${tr('החיבור חזר')}</span>`);
    if (showUpdate()) {
      // CLIENT-RESILIENCE-2540 (owner answer Q4 = a): "אחר כך" hides the card until the next new version
      cards.push(html`<div class="card" role="status" data-pwa-update>
        <sw-icon name="refresh" size=${22}></sw-icon>
        <div class="text"><b>${tr('גרסה חדשה של Arx זמינה')}</b><span>${tr('רעננו כדי לעבור אליה; מה שפתוח יישמר בכתובת.')}</span></div>
        <div class="actions">
          <sw-button size="lg" variant="primary" data-pwa-update-go @click=${() => applyUpdate()}>${tr('רענון')}</sw-button>
          <sw-button size="lg" variant="ghost" data-pwa-update-later @click=${() => this.putAway(updateLater)}>${tr('אחר כך')}</sw-button>
        </div>
      </div>`);
    }
    if (showInstall()) {
      cards.push(html`<div class="card" role="dialog" aria-label=${tr('התקן את Arx')} data-pwa-install>
        ${this.icon()}
        <div class="text"><b>${tr('התקן את Arx')}</b><span>${tr('אפליקציה במסך הבית או בשולחן העבודה: פתיחה מהירה, מסך מלא והתראות.')}</span></div>
        <div class="actions">
          <sw-button size="lg" variant="primary" data-pwa-install-go @click=${() => this.install()}>${tr('התקנה')}</sw-button>
          <sw-button size="lg" variant="ghost" data-pwa-install-later @click=${() => this.putAway(() => dismiss('install'))}>${tr('לא עכשיו')}</sw-button>
        </div>
      </div>`);
    } else if (showIosHint()) {
      cards.push(html`<div class="card" role="dialog" aria-label=${tr('התקנת Arx באייפון')} data-pwa-ios>
        ${this.icon()}
        <div class="text"><b>${tr('התקן את Arx באייפון')}</b><span>${tr('ב־Safari הקישו על')} <svg class="share" width="16" height="16" viewBox="0 0 24 24" aria-label=${tr('שיתוף')} role="img"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg> ${tr('שיתוף ואז "הוספה למסך הבית". התראות באייפון מגיעות רק לאפליקציה שהותקנה כך.')}</span></div>
        <button class="x" type="button" aria-label=${tr('סגירה')} data-pwa-ios-close @click=${() => this.putAway(() => dismiss('ios'))}><sw-icon name="close" size=${18}></sw-icon></button>
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
