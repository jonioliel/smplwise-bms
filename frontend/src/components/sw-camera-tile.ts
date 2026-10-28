import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';
import './sw-badge';
import './sw-scene';
import './sw-live-player';
import type { StateKind } from './sw-badge';
import type { SceneKind } from './sw-scene';
import type { CameraEncoding } from '../api/types';
import { encodeGop, playerPlan } from '../api/video-policy';
import { stillDue, stillIntervalMs, withBust } from '../api/frigate';
import { he } from '../i18n/he';

export type { SceneKind } from './sw-scene';

/**
 * Camera tile as drawn on the boards: only a picture with the camera name and a green dot overlaid at
 * the bottom-start corner, a small state pill at the top when the state is not plain "live". Until a
 * stream is attached (T017) the picture is an illustrated scene tagged "דמו"; it never pretends to be a
 * real frame. Offline / forbidden / unknown tiles show a grey card with an icon and the reason.
 */
@customElement('sw-camera-tile')
export class SwCameraTile extends LitElement {
  @property() name = '';
  @property() meta = '';
  @property({ reflect: true }) state: StateKind = 'unknown';
  @property({ reflect: true }) scene: SceneKind = 'lobby';
  @property({ type: Boolean, reflect: true }) selected = false;
  @property({ type: Boolean, reflect: true }) compact = false;
  @property({ type: Boolean, reflect: true }) dark = false;
  @property({ type: Boolean, reflect: true }) noDemo = false;
  @property() stamp = '';
  /** Real picture: snapshot URL (poster) and/or a live stream through the relay. */
  @property() poster = '';
  /** The wall holds no stream for this tile (over the cap, or out of view): a refreshed snapshot with the hint that a tap opens live. */
  @property({ type: Boolean, reflect: true }) snapshotOnly = false;
  @property() cameraId = '';
  /** A live relay path the server named for a source that is not a catalogue camera (sw-live-player `livePath`). */
  @property() livePath = '';
  @property({ type: Boolean }) live = false;
  @property() profile: 'sub' | 'main' = 'sub';
  @property() transport: 'auto' | 'webrtc' | 'mse' = 'auto';
  /** Passed through to sw-live-player's `fit` (contain | cover | fill) - see there. */
  @property() fit: 'contain' | 'cover' | 'fill' = 'contain';
  /** CR-008 D7: the camera's stream encodings (a remote plan skips WebRTC for a stream the NVR says cannot play there). */
  @property({ attribute: false }) encoding: CameraEncoding | null = null;
  /** The profile is the installation's default, not the viewer's choice: the player may fall back to the other profile
   * when this one proves undecodable (sw-live-player `autoProfile`, LAN / Ingress only). */
  @property({ type: Boolean }) autoProfile = false;
  /** NN5-F1B: seconds between refreshes of a camera that has no live stream (a Frigate recorder in F1): the tile re-reads its `poster`
   * itself, never faster than 5 s, never while the tab is hidden or the tile is out of view, and says so ("תמונה מתעדכנת"). 0 = off. */
  @property({ type: Number }) stillRefresh = 0;
  @state() private stillBust = 0;
  private stillAt = 0;
  private stillInView = true;
  private stillTimer = 0;
  private stillObs: IntersectionObserver | null = null;

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('stillRefresh')) {
      this.stopStill();
      if (this.stillRefresh > 0) this.startStill();
    }
  }

  private startStill() {
    this.stillAt = Date.now();
    this.stillBust = this.stillAt;
    if (typeof IntersectionObserver !== 'undefined') {
      this.stillObs = new IntersectionObserver((es) => {
        this.stillInView = es.some((e) => e.isIntersecting);
        this.stillTick();
      });
      this.stillObs.observe(this);
    }
    this.stillTimer = window.setInterval(this.stillTick, 1000);
  }

  private stopStill() {
    window.clearInterval(this.stillTimer);
    this.stillTimer = 0;
    this.stillObs?.disconnect();
    this.stillObs = null;
  }

  private stillTick = () => {
    if (this.stillRefresh <= 0) return;
    const now = Date.now();
    if (stillDue({ hidden: document.hidden, inView: this.stillInView, lastAt: this.stillAt, now, intervalMs: stillIntervalMs(this.stillRefresh) })) {
      this.stillAt = now;
      this.stillBust = now;
    }
  };

  static styles = css`
    :host {
      display: block;
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-surface-3);
      cursor: pointer;
      min-inline-size: 0;
      box-shadow: var(--sw-shadow-1);
      transition: box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
      isolation: isolate;
      outline: none;
    }
    /* R5-LIVE-297 (mobile-native, emil press): the lift follows a hovering pointer only (a tapped tile kept it on a phone), and a
       tile answers the pointer-down at once - it sinks a step, the shadow drops */
    @media (hover: hover) and (pointer: fine) {
      :host(:hover) {
        box-shadow: var(--sw-shadow-2);
        transform: translateY(var(--sw-hover-lift));
      }
    }
    :host {
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    }
    :host(:active) {
      transform: scale(var(--sw-press-scale, 0.985));
      box-shadow: none;
      transition-duration: var(--sw-t-press);
    }
    :host(:focus-visible) {
      box-shadow: 0 0 0 var(--sw-focus-w) var(--sw-focus), var(--sw-shadow-2);
    }
    :host([selected]) {
      box-shadow: 0 0 0 2px var(--sw-accent), var(--sw-shadow-2);
    }
    /* an offline / forbidden / unknown tile is a quiet card with a dashed edge: the absence of a picture reads as a state, not a loading gap */
    :host([state='offline']),
    :host([state='forbidden']),
    :host([state='unknown']) {
      box-shadow: inset 0 0 0 1px var(--sw-border-strong);
    }
    /* R5-LIVE-297 (status as a filled field): a camera that is down is a filled offline field - the panel in the offline tint, a
       solid ring with the icon, the name 15 px bold over a "disconnected" line - not a white card with a dashed edge that read as
       a picture still loading; forbidden takes the danger tint */
    :host([state='offline']:not([dark])) .off,
    :host([state='unknown']:not([dark])) .off {
      background: color-mix(in srgb, var(--sw-offline) 22%, var(--sw-surface-3));
    }
    :host([dark][state='offline']) .off,
    :host([dark][state='unknown']) .off {
      background: color-mix(in srgb, var(--sw-offline) 16%, var(--sw-video-bg));
    }
    :host([state='forbidden']:not([dark])) .off {
      background: color-mix(in srgb, var(--sw-danger) 12%, var(--sw-surface-3));
    }
    :host([state='offline']:not([dark])) .off .ring,
    :host([state='unknown']:not([dark])) .off .ring,
    :host([state='forbidden']:not([dark])) .off .ring {
      border: 0;
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
    }
    :host([state='offline']) .off .ring sw-icon,
    :host([state='unknown']) .off .ring sw-icon {
      color: var(--sw-offline-text);
    }
    :host(:not([compact])) .off .label {
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
    }
    :host(:not([compact])) .off {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    :host([state='offline']) .off sw-icon,
    :host([state='unknown']) .off sw-icon {
      color: var(--sw-offline);
    }
    :host([state='forbidden']) .off sw-icon {
      color: var(--sw-forbidden);
    }
    sw-scene,
    sw-live-player,
    img.poster {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.12) 0%, rgba(0, 0, 0, 0) 30%, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.45) 100%);
      pointer-events: none;
    }
    .off {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface-3);
      text-align: center;
      padding: 8px;
    }
    .off .ring {
      inline-size: 44px;
      block-size: 44px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      border: 1px dashed var(--sw-border-strong);
      background: var(--sw-surface-2);
    }
    :host([compact]) .off .ring {
      inline-size: 34px;
      block-size: 34px;
    }
    :host([dark]) .off .ring {
      border-color: var(--sw-video-line);
      background: var(--sw-video-hover);
    }
    :host([dark]) .off {
      background: var(--sw-video-bg);
      color: var(--sw-on-video-2);
    }
    .off sw-icon {
      color: var(--sw-text-3);
    }
    .demo {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      font-size: var(--sw-fs-2xs);
      letter-spacing: 0.04em;
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      border-radius: var(--sw-r-2xs);
      padding: 1px 6px;
    }
    .pill {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
    }
    .label {
      position: absolute;
      inset-inline-start: 10px;
      inset-block-end: 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--sw-on-video);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
      max-inline-size: calc(100% - 20px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* R5-LIVE-297: the camera's name is the tile's title - 14 px bold on the picture */
    :host(:not([compact])) .label {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
    }
    :host([compact]) .label {
      font-size: var(--sw-fs-xs);
      inset-inline-start: 8px;
      inset-block-end: 6px;
    }
    .label .dot {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-live);
      box-shadow: 0 0 0 1.5px var(--sw-on-video-2);
      flex-shrink: 0;
    }
    /* the live dot breathes while the picture is live (the same rhythm as sw-badge); still under reduced motion */
    :host([state='live']) .label .dot {
      animation: breathe 2.4s ease-in-out infinite;
    }
    @keyframes breathe {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.45;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host([state='live']) .label .dot {
        animation: none;
      }
      :host(:hover) {
        transform: none;
      }
    }
    :host([state='stale']) .label .dot {
      background: var(--sw-stale);
      animation: none;
    }
    :host([state='recorded']) .label .dot,
    :host([state='historic']) .label .dot {
      background: var(--sw-accent);
    }
    .off .label {
      position: static;
      color: var(--sw-text);
      text-shadow: none;
      font-weight: var(--sw-fw-semibold);
    }
    :host([dark]) .off .label {
      color: var(--sw-on-video);
    }
    .off .label .dot {
      background: var(--sw-offline);
      box-shadow: none;
    }
    :host([state='forbidden']) .off .label .dot {
      background: var(--sw-danger);
    }
    .stamp {
      position: absolute;
      inset-inline-end: 10px;
      inset-block-end: 8px;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-2xs);
      color: var(--sw-on-video);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      direction: ltr;
    }
    :host([compact]) .stamp {
      display: none;
    }
    .meta {
      position: absolute;
      inset-inline-end: 10px;
      inset-block-end: 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-on-video-2);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
  `;

  private offMessage() {
    return this.state === 'forbidden' ? 'אין הרשאת צפייה' : this.state === 'offline' ? 'המצלמה מנותקת' : 'מצב לא ידוע';
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this.stillTick);
    // a tile is a control (it opens the camera): reachable from the keyboard, Enter / Space press it like a click
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
    this.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('visibilitychange', this.stillTick);
    this.removeEventListener('keydown', this.onKey);
    this.stopStill();
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.target !== this || e.defaultPrevented) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.click();
    }
  };

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('name')) this.setAttribute('aria-label', this.name || 'מצלמה');
  }

  render() {
    const off = this.state === 'offline' || this.state === 'forbidden' || this.state === 'unknown';
    if (off) {
      return html`<div class="off">
        <span class="ring" aria-hidden="true"><sw-icon name=${this.state === 'forbidden' ? 'lock' : 'offline'} size=${this.compact ? 16 : 20}></sw-icon></span>
        <span>${this.offMessage()}</span>
        ${this.name ? html`<span class="label"><span class="dot"></span>${this.name}</span>` : nothing}
      </div>`;
    }
    const real = this.live && (this.cameraId || this.livePath) ? 'live' : this.poster ? 'poster' : 'scene';
    // CR-008 D7: on the remote channel the tile keeps its own profile (the wall's) but plays it by the remote policy
    const plan = real === 'live' ? playerPlan(this.profile, this.encoding, this.transport) : { plan: '', preferred: '' as const, gop: '' };
    return html`
      ${real === 'live'
        ? html`<sw-live-player .cameraId=${this.cameraId} .livePath=${this.livePath} .profile=${this.profile} .mode=${this.transport} .plan=${plan.plan} .preferred=${plan.preferred} .gop=${plan.gop || encodeGop(this.encoding)} .autoProfile=${this.autoProfile} .poster=${this.poster} .fit=${this.fit} compact></sw-live-player>`
        : real === 'poster'
          ? html`<img class="poster" src=${this.stillRefresh > 0 ? withBust(this.poster, this.stillBust) : this.poster} alt="" loading="lazy" />`
          : html`<sw-scene kind=${this.scene}></sw-scene>`}
      <div class="shade"></div>
      ${real === 'scene' && !this.noDemo ? html`<span class="demo">דמו</span>` : real === 'poster' ? html`<span class="demo" data-snapshot-label data-still=${this.stillRefresh > 0 ? 'refreshing' : nothing}>${this.stillRefresh > 0 ? (this.compact ? he.frigate.live.stillLabel : `${he.frigate.live.stillLabelEvery} ${Math.round(stillIntervalMs(this.stillRefresh) / 1000)} ${he.frigate.live.seconds}`) : this.snapshotOnly ? 'תמונה · לחץ לצפייה חיה' : 'צילום'}</span>` : nothing}
      ${this.state === 'stale' || this.state === 'recorded' || this.state === 'historic' ? html`<sw-badge class="pill" onImage kind=${this.state}></sw-badge>` : nothing}
      ${this.name ? html`<span class="label"><span class="dot"></span>${this.name}</span>` : nothing}
      ${this.stamp ? html`<span class="stamp">${this.stamp}</span>` : this.meta && !this.compact ? html`<span class="meta">${this.meta}</span>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-camera-tile': SwCameraTile;
  }
}
