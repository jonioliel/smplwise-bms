import { LitElement, html, css, nothing, render, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-camera-tile';
import '../components/sw-live-player';
import '../components/sw-icon';
import '../components/sw-button';
import './devices-camera-picker';
import type { IconName } from '../components/sw-icon';
import { ApiError, apiUrl } from '../api/client';
import { effectiveTransport, productSettings } from '../api/prefs';
import { snapshotUrl, type ProductSettings } from '../api/media';
import { snapshotRefreshMs } from '../api/live-budget';
import { playerPlan } from '../api/video-policy';
import { navigate } from '../router';
import { bidi } from '../i18n/bidi';
import { CARD_QUALITY_LABEL, HA_LIVE_CHANGED, cardBudget, cardProfile, isCameraSource, liveCapOf, resolveCameraSource, sameSource, stillUrl, wallProfileOf, type CameraResolved, type CameraSource, type CardQuality } from '../api/camera-card';

/** A standalone camera shown live whose stream failed shows its picture for this long, then tries the stream again. */
const HA_LIVE_RETRY_MS = 60_000;

/** `camera-open`: the card was pressed (`detail.source`, `detail.cameraId` - absent for a picture-only card). Cancelable: the
 * default action opens the single-camera view (#/live/cameras/<id>). */
export interface CameraOpenDetail {
  source: CameraSource;
  cameraId: string | null;
}
/** `camera-expand`: the enlarge button was pressed. Cancelable: the default action opens the card's own larger view (the main
 * stream in a dialog; the card lets go of its own stream meanwhile). */
export type CameraExpandDetail = CameraOpenDetail;

/**
 * What the layout editor's card library needs to offer a camera card (owner 2026-09-30). The library owns the "add card"
 * picker; this module owns the card: its element, its per-card camera picker and the rules below. `defaultSize` and
 * `minSize` are layout grid units (12 columns, rows of 8 px - screens/devices-layout.ts); `toLayoutItem` returns the item
 * the area layout stores under `layoutKey()` (backend: routers/device_layouts.py, `camera:<slug>` keys, layout `v: 2`).
 */
export interface CameraCardDefinition {
  type: 'camera';
  label: string;
  description: string;
  icon: IconName;
  element: 'devices-camera-card';
  /** The per-card camera picker: `<devices-camera-picker .value=${source} @camera-picked=${...}>` (detail: {source, name}). */
  pickerElement: 'devices-camera-picker';
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  /** What may be picked, in words for the library's help text. */
  eligible: string;
  /** The permission the card is about (checked per camera on the server; the library does not need to). */
  permission: 'video.live';
  /** The layout key of a new card: unique among `existing` keys. */
  layoutKey: (existing: readonly string[]) => string;
  isLayoutKey: (key: string) => boolean;
  /** The layout item of a new card at column x, row y (a `v: 2` layout only). */
  toLayoutItem: (source: CameraSource, at: { x: number; y: number }, title?: string | null) => CameraLayoutItem;
  /** The source a stored item carries, or null when it has none / a malformed one. */
  sourceOf: (item: { camera?: unknown } | null | undefined) => CameraSource | null;
}

/** The layout item of a camera card: the generic item (screens/devices-layout.ts LayoutItem) plus its source. */
export interface CameraLayoutItem {
  x: number;
  y: number;
  w: number;
  h: number;
  text: 'sm' | 'md' | 'lg';
  bg: null;
  border: null;
  title: string | null;
  icon: null;
  hidden: false;
  hidden_entities: [];
  camera: CameraSource;
  /** The stream quality (absent = auto; older layouts have none). */
  profile?: CardQuality;
}

const KEY_PREFIX = 'camera:';

export function cameraCardDefinition(): CameraCardDefinition {
  return {
    type: 'camera',
    label: 'מצלמה',
    description: 'שידור חי של מצלמה: ערוץ של ה־NVR או מצלמה של המערכת. בלחיצה נפתחת תצוגת המצלמה.',
    icon: 'camera',
    element: 'devices-camera-card',
    pickerElement: 'devices-camera-picker',
    defaultSize: { w: 6, h: 34 },
    minSize: { w: 3, h: 16 },
    eligible: 'ערוצי NVR שהמשתמש רשאי לצפות בהם, ומצלמות נוספות של המערכת (מוצגות כתמונה בלבד)',
    permission: 'video.live',
    layoutKey: (existing) => {
      let n = existing.filter((k) => k.startsWith(KEY_PREFIX)).length + 1;
      while (existing.includes(`${KEY_PREFIX}c${n}`)) n++;
      return `${KEY_PREFIX}c${n}`;
    },
    isLayoutKey: (key) => /^camera:[A-Za-z0-9_-]{1,32}$/.test(key),
    toLayoutItem: (source, at, title = null) => {
      const size = cameraCardDefinition().defaultSize;
      return { x: at.x, y: at.y, w: size.w, h: size.h, text: 'md', bg: null, border: null, title: title?.trim() || null, icon: null, hidden: false, hidden_entities: [], camera: source };
    },
    sourceOf: (item) => (item && isCameraSource(item.camera) ? item.camera : null),
  };
}

let seq = 0;

/**
 * The camera card of the area screens: one camera - an NVR channel or a Home Assistant camera - as a live picture.
 *
 *   <devices-camera-card .source=${{ kind: 'nvr', recorder_id: 'nvr-1', channel: 3 }} .title=${'כניסה'} size="m"></devices-camera-card>
 *
 * The video is the existing live player through the existing relay (sub profile by default - the installation's wall
 * profile of this channel -, main for size "l" and in the enlarged view; WebRTC or MSE as הגדרות › וידאו ומדיה says). The
 * card holds a stream only while it is in view and the tab is visible; the cards of a screen share the installation's live
 * budget (api/camera-card.ts CardLiveBudget) and the rest show their snapshot. What it shows is decided by the server for
 * this caller (`GET /devices/camera-card/resolve`): live, a picture only (a Home Assistant camera that is not an NVR
 * channel), no permission, gone, or switched off.
 *
 * Events (bubbling, composed, cancelable): `camera-open` (the card was pressed) and `camera-expand` (the enlarge button);
 * `camera-state` (detail: the resolved state) after every resolve.
 */
@customElement('devices-camera-card')
export class DevicesCameraCard extends LitElement {
  @property({ attribute: false }) source: CameraSource | null = null;
  /** The card's own title (the layout's), else the camera's name. */
  @property() title = '';
  /** `l` plays the main stream; `s` / `m` the installation's wall profile. */
  @property() size: 's' | 'm' | 'l' = 'm';
  /** Fill the parent's height (a card placed on the layout grid) instead of a 16:9 box. */
  @property({ type: Boolean, reflect: true }) fill = false;
  /** The card's own stream quality (layout item `profile`): auto = the rule of `cardProfile`; sub / main at any size. The
   * transport is the installation's (media.transport_default) either way, with the player's own fallback. */
  @property() quality: CardQuality = 'auto';
  /** Layout edit mode: a small badge names the chosen quality (nothing new on the card otherwise). */
  @property({ type: Boolean }) showQuality = false;

  @state() private played = '';
  @state() private resolved: CameraResolved | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private settings: ProductSettings | null = null;
  @state() private granted = false;
  @state() private expanded = false;
  @state() private posterBust = Date.now();
  @state() private snapBust = Date.now();
  /** When the stream of a standalone camera shown live last failed (0 = it has not): its picture stands in meanwhile. */
  @state() private haFailedAt = 0;

  private budgetId = `cc-${++seq}`;
  private io: IntersectionObserver | undefined;
  private inView = false;
  private snapTimer = 0;
  private token = 0;

  static styles = css`
    :host {
      display: block;
      position: relative;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      min-inline-size: 0;
      overflow: hidden;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-3);
      isolation: isolate;
    }
    :host([fill]) {
      aspect-ratio: auto;
      block-size: 100%;
      min-block-size: 120px;
    }
    sw-camera-tile,
    img.still {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      aspect-ratio: auto;
      border-radius: 0;
      box-shadow: none;
      object-fit: cover;
    }
    .hit {
      position: absolute;
      inset: 0;
      z-index: 2;
      border: 0;
      padding: 0;
      background: transparent;
      cursor: pointer;
    }
    .hit:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .expand {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      z-index: 3;
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border: 0;
      border-radius: 8px;
      background: rgba(17, 24, 39, 0.55);
      color: #fff;
      cursor: pointer;
      opacity: 0;
      transition: opacity var(--sw-t-fast) var(--sw-ease);
    }
    :host(:hover) .expand,
    .expand:focus-visible {
      opacity: 1;
    }
    @media (hover: none) {
      .expand {
        opacity: 0.85;
      }
    }
    .msg {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px;
      text-align: center;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      background: var(--sw-surface-3);
    }
    .msg sw-icon {
      color: var(--sw-text-3);
    }
    .msg .name {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    .msg .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .msg[data-camera-state='loading'] {
      background: linear-gradient(100deg, var(--sw-surface-3) 30%, var(--sw-surface-2) 50%, var(--sw-surface-3) 70%) 0 0 / 200% 100%;
      animation: shimmer 1.6s linear infinite;
    }
    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .msg[data-camera-state='loading'] {
        animation: none;
      }
    }
    .badge {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      z-index: 1;
      font-size: 9.5px;
      background: rgba(17, 24, 39, 0.55);
      color: #fff;
      border-radius: 4px;
      padding: 1px 6px;
    }
    .qbadge {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
      z-index: 3;
      font-size: 9.5px;
      background: rgba(17, 24, 39, 0.55);
      color: #fff;
      border-radius: 4px;
      padding: 1px 6px;
      pointer-events: none;
    }
    .label {
      position: absolute;
      inset-inline-start: 10px;
      inset-block-end: 8px;
      z-index: 1;
      max-inline-size: calc(100% - 20px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #fff;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0) 30%, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.45) 100%);
      pointer-events: none;
    }
  `;

  // ------------------------------------------------------------------------------------------ lifecycle

  connectedCallback() {
    super.connectedCallback();
    cardBudget.register(this.budgetId, this.onSlot);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener(HA_LIVE_CHANGED, this.onLiveChanged);
    this.snapTimer = window.setInterval(() => this.tick(), 1000);
    this.lastSnap = Date.now();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener(HA_LIVE_CHANGED, this.onLiveChanged);
    window.clearInterval(this.snapTimer);
    this.io?.disconnect();
    this.io = undefined;
    if (this.bigHost) this.closeBig();
    cardBudget.unregister(this.budgetId);
    this.token++; // a resolve still in flight is not wanted any more
  }

  firstUpdated() {
    this.observe();
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('source') && !sameSource(changed.get('source') as CameraSource | null | undefined, this.source)) void this.resolve();
  }

  private onSlot = (live: boolean) => {
    this.granted = live;
  };

  private onVisibility = () => this.report();

  /** A standalone camera was switched to / from live video (the picker): a card that shows such a camera resolves again. */
  private onLiveChanged = (e: Event) => {
    const d = (e as CustomEvent<{ entityId?: string }>).detail;
    if (this.source?.kind === 'ha' && (!d?.entityId || d.entityId === this.source.entity_id)) void this.resolve();
  };

  /** The nearest scrolling ancestor (through shadow roots): the observer's margin only widens a scroller that IS the root. */
  private scrollRoot(): Element | null {
    let el: Node | null = this;
    while (el) {
      const parent: Node | null = (el as Element).parentElement ?? ((el.getRootNode() as ShadowRoot).host ?? null);
      if (!parent || !(parent instanceof Element)) return null;
      const oy = getComputedStyle(parent).overflowY;
      if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') return parent;
      el = parent;
    }
    return null;
  }

  private observe() {
    if (typeof IntersectionObserver === 'undefined') {
      this.inView = true; // very old webviews: in view as far as anyone can tell
      this.report();
      return;
    }
    const margin = Math.round(this.getBoundingClientRect().height) || 180;
    this.io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) this.inView = e.isIntersecting;
        this.report();
      },
      { root: this.scrollRoot(), rootMargin: `${margin}px 0px ${margin}px 0px` },
    );
    this.io.observe(this);
  }

  /** In view (with a card of margin) and the tab visible: this card asks for a stream; otherwise it lets go after the grace. */
  private report() {
    // only a card that can play asks: an offline channel, a picture-only camera or a refused one never holds a slot
    cardBudget.setVisible(this.budgetId, this.inView && !document.hidden && !this.expanded && this.canStream);
  }

  /** The card's source is a live NVR channel that is online (what `renderLive` streams). */
  private get canStream(): boolean {
    const r = this.resolved;
    if (r?.state === 'ha_live') return !!r.live_path && r.status !== 'offline' && !this.haFailedAt;
    return !!r && r.state === 'live' && !!r.camera_id && r.status !== 'offline' && r.status !== 'unknown';
  }

  private lastSnap = 0;

  /** The picture-only cards (and the snapshots of the cards without a stream) refresh every max(10 s, snapshots.max_age_s),
   * only while in view and the tab is visible - the wall's rule (api/live-budget.ts). */
  private tick() {
    if (this.haFailedAt && Date.now() - this.haFailedAt >= HA_LIVE_RETRY_MS) {
      this.haFailedAt = 0; // the stream is tried again (the server re-reads the camera's source when it saw the last one fail)
      this.report();
    }
    const every = snapshotRefreshMs(Number(this.settings?.['snapshots.max_age_s'] ?? 60));
    if (Date.now() - this.lastSnap < every) return;
    this.lastSnap = Date.now();
    if (document.hidden || !this.inView) return;
    if (this.resolved?.state === 'still_only' || ((this.resolved?.state === 'live' || this.resolved?.state === 'ha_live') && !this.streaming)) this.snapBust = Date.now();
  }

  // ------------------------------------------------------------------------------------------ resolve

  private async resolve() {
    const source = this.source;
    const token = ++this.token;
    this.resolved = null;
    this.haFailedAt = 0;
    this.report();
    this.error = '';
    if (!source || !isCameraSource(source)) {
      this.phase = 'ready';
      this.resolved = { state: 'missing' };
      return;
    }
    this.phase = 'loading';
    try {
      const [r, settings] = await Promise.all([resolveCameraSource(source), productSettings().catch(() => null)]);
      if (token !== this.token) return;
      this.settings = settings;
      cardBudget.setCap(liveCapOf(settings));
      this.resolved = r;
      this.posterBust = Date.now();
      this.snapBust = Date.now();
      this.phase = 'ready';
      this.report();
      this.dispatchEvent(new CustomEvent('camera-state', { detail: { state: r.state, source }, bubbles: true, composed: true }));
    } catch (err) {
      if (token !== this.token) return;
      if (err instanceof ApiError && err.status === 403) {
        this.resolved = { state: 'forbidden' };
        this.phase = 'ready';
        return;
      }
      this.error = err instanceof ApiError ? err.message : 'שגיאת רשת';
      this.phase = 'error';
    }
  }

  // ------------------------------------------------------------------------------------------ actions

  private get cameraId(): string | null {
    return this.resolved?.state === 'live' && this.resolved.camera_id ? this.resolved.camera_id : null;
  }

  private detail(): CameraOpenDetail | null {
    return this.source ? { source: this.source, cameraId: this.cameraId } : null;
  }

  private open() {
    const detail = this.detail();
    if (!detail) return;
    const ev = new CustomEvent<CameraOpenDetail>('camera-open', { detail, bubbles: true, composed: true, cancelable: true });
    if (this.dispatchEvent(ev) && detail.cameraId) navigate(`/live/cameras/${detail.cameraId}`);
  }

  private expand(e: Event) {
    e.stopPropagation();
    const detail = this.detail();
    if (!detail) return;
    const ev = new CustomEvent<CameraExpandDetail>('camera-expand', { detail, bubbles: true, composed: true, cancelable: true });
    if (this.dispatchEvent(ev)) this.openBig();
  }

  private onPlayerStatus(e: Event) {
    const d = (e as CustomEvent<{ code?: string; status?: string; profile?: string; transport?: string }>).detail;
    if (d?.code === 'remote_live_cap') cardBudget.refuse(this.budgetId);
    // what really plays (profile:transport) after the player's own fallbacks - for the page's checks, nothing on the card
    this.played = d?.status === 'playing' && d.profile && d.transport ? `${d.profile}:${d.transport}` : '';
    if (d?.code === 'remote_live_cap') return;
    if (this.resolved?.state === 'ha_live') {
      if (d?.status === 'error' && !this.haFailedAt) {
        this.haFailedAt = Date.now(); // the picture stands in; the stream is tried again after HA_LIVE_RETRY_MS
        this.report();
      } else if (d?.status === 'playing') this.haFailedAt = 0;
    }
  }

  // ------------------------------------------------------------------------------------------ render

  private get displayName(): string {
    return this.title || this.resolved?.name || '';
  }

  /** A stream is actually wanted for this card: live, online, and it holds a slot of the budget. */
  private get streaming(): boolean {
    const r = this.resolved;
    if (r?.state === 'ha_live') return this.canStream && this.granted && !this.expanded;
    return !!r && r.state === 'live' && r.status !== 'offline' && r.status !== 'unknown' && !!r.camera_id && this.granted && !this.expanded;
  }

  private message(state: string, icon: IconName, text: string, hint = '') {
    const name = this.title;
    return html`<div class="msg" data-camera-state=${state} role=${state === 'loading' ? 'status' : 'group'}>
      <sw-icon name=${icon} size=${22}></sw-icon>
      <span>${text}</span>
      ${name ? html`<span class="name">${bidi(name)}</span>` : nothing}
      ${hint ? html`<span class="hint">${hint}</span>` : nothing}
    </div>`;
  }

  render() {
    if (this.phase === 'loading') return this.message('loading', 'camera', 'טוען מצלמה…');
    if (this.phase === 'error') {
      return html`<div class="msg" data-camera-state="error">
        <sw-icon name="warning" size=${22}></sw-icon>
        <span>לא ניתן לטעון את המצלמה</span>
        <span class="hint">${this.error}</span>
        <sw-button variant="ghost" data-camera-retry @click=${() => void this.resolve()}>נסה שוב</sw-button>
      </div>`;
    }
    const r = this.resolved;
    if (!r) return nothing;
    switch (r.state) {
      case 'forbidden':
        return this.message('forbidden', 'lock', 'אין הרשאת צפייה במצלמה הזו');
      case 'missing':
        return this.message('missing', 'offline', 'המצלמה לא נמצאה', 'ייתכן שהוסרה מהמערכת');
      case 'disabled':
        return this.message('disabled', 'offline', 'המצלמה מושבתת');
      case 'still_only':
        return this.renderStill(r);
      case 'ha_live':
        return this.renderHaLive(r);
      default:
        return this.renderLive(r);
    }
  }

  private renderStill(r: CameraResolved) {
    const entity = r.entity_id ?? '';
    const name = this.displayName;
    return html`<div data-camera-state="still_only" style="display:contents">
      ${r.status === 'offline'
        ? this.message('offline', 'offline', 'המצלמה מנותקת')
        : html`<img class="still" data-camera-still src=${stillUrl(entity, this.snapBust)} alt=${name} />
          <div class="shade"></div>
          <span class="badge" data-camera-badge>תמונה בלבד</span>
          ${name ? html`<span class="label">${bidi(name)}</span>` : nothing}
          <button type="button" class="hit" data-camera-hit aria-label=${`תמונה של ${name || 'המצלמה'}`} @click=${() => this.open()}></button>
          <button type="button" class="expand" data-camera-expand aria-label="הגדל" @click=${(e: Event) => this.expand(e)}><sw-icon name="expand" size=${14}></sw-icon></button>`}
    </div>`;
  }

  /** A standalone Home Assistant camera the owner chose to show live: the same tile and player as an NVR channel, on the relay
   * path the server named (`live_path`). Not streaming (no slot in the budget, out of view, or the stream failed): its picture,
   * refreshed like a picture-only card. There is no camera page to open: the press only raises `camera-open`. */
  private renderHaLive(r: CameraResolved) {
    const entity = r.entity_id ?? '';
    if (r.status === 'offline') return this.message('offline', 'offline', 'המצלמה מנותקת');
    const live = this.streaming;
    const transport = effectiveTransport(this.settings);
    return html`<div data-camera-state=${live ? 'live' : 'snapshot'} data-camera-source="ha-live" data-camera-entity=${entity} style="display:contents">
      <sw-camera-tile
        name=${bidi(this.displayName)}
        state="live"
        ?live=${live}
        ?snapshotOnly=${!live}
        livePath=${r.live_path ?? ''}
        transport=${transport}
        fit="cover"
        ?compact=${this.size === 's'}
        poster=${stillUrl(entity, live ? this.posterBust : this.snapBust)}
        @player-status=${(e: Event) => this.onPlayerStatus(e)}
      ></sw-camera-tile>
      <button type="button" class="hit" data-camera-hit aria-label=${`פתח את ${this.displayName || 'המצלמה'}`} @click=${() => this.open()}></button>
      <button type="button" class="expand" data-camera-expand aria-label="הגדל" @click=${(e: Event) => this.expand(e)}><sw-icon name="expand" size=${14}></sw-icon></button>
    </div>`;
  }

  private renderLive(r: CameraResolved) {
    const id = r.camera_id ?? '';
    const state = r.status === 'online' ? 'live' : r.status === 'offline' ? 'offline' : 'unknown';
    const streamable = r.status !== 'offline' && r.status !== 'unknown';
    const live = this.streaming;
    const profile = cardProfile(this.size, wallProfileOf(this.settings), this.quality);
    const transport = effectiveTransport(this.settings);
    const poster = r.status === 'offline' ? '' : snapshotUrl(id, streamable && !live ? this.snapBust : this.posterBust);
    return html`<div data-camera-state=${live ? 'live' : streamable ? 'snapshot' : state} data-camera-id=${id} data-profile=${profile} data-quality=${this.quality} data-played=${live ? this.played : ''} style="display:contents">
      ${this.showQuality ? html`<span class="qbadge" data-camera-quality-badge>איכות: ${CARD_QUALITY_LABEL[this.quality]}</span>` : nothing}
      <sw-camera-tile
        name=${bidi(this.displayName)}
        state=${state}
        ?live=${live}
        ?snapshotOnly=${streamable && !live}
        cameraId=${id}
        profile=${profile}
        transport=${transport}
        fit="cover"
        ?compact=${this.size === 's'}
        .encoding=${r.encoding ?? null}
        poster=${poster}
        @player-status=${(e: Event) => this.onPlayerStatus(e)}
      ></sw-camera-tile>
      <button type="button" class="hit" data-camera-hit aria-label=${`פתח את ${this.displayName || 'המצלמה'}`} @click=${() => this.open()}></button>
      ${streamable ? html`<button type="button" class="expand" data-camera-expand aria-label="הגדל" @click=${(e: Event) => this.expand(e)}><sw-icon name="expand" size=${14}></sw-icon></button>` : nothing}
    </div>`;
  }

  // ------------------------------------------------------------------------------------------ the enlarged view

  private bigHost: HTMLDivElement | null = null;

  /** The enlarged view: the main stream (or the picture, larger) in a lightbox on the page itself - not inside the card: a
   * card in the glass style is a containing block for fixed children and clips them. Closing returns the card to its slot. */
  private openBig() {
    const r = this.resolved;
    if (!r || this.bigHost) return;
    const host = document.createElement('div');
    host.setAttribute('data-camera-big', '');
    const root = host.attachShadow({ mode: 'open' });
    document.body.append(host);
    this.bigHost = host;
    this.expanded = true;
    cardBudget.drop(this.budgetId); // one stream, not two: the card's own lets go while the big view plays
    const plan = r.state === 'live' ? playerPlan('main', r.encoding ?? null, effectiveTransport(this.settings)) : { plan: '', preferred: '' as const, gop: '' };
    const name = this.displayName || 'מצלמה';
    render(
      html`<style>
          .back { position: fixed; inset: 0; z-index: var(--sw-z-modal, 1000); background: var(--sw-overlay, rgba(0, 0, 0, 0.6)); display: grid; place-items: center; padding: 16px; }
          .box { inline-size: min(92vw, 1100px); display: flex; flex-direction: column; gap: 8px; }
          .bar { display: flex; align-items: center; justify-content: space-between; color: #fff; font: 600 15px/1.2 system-ui, sans-serif; }
          button { border: 0; border-radius: 8px; background: rgba(255, 255, 255, 0.18); color: #fff; font: inherit; padding: 6px 12px; cursor: pointer; }
          .view { position: relative; aspect-ratio: 16 / 9; background: #000; border-radius: 10px; overflow: hidden; }
          .view > * { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; object-fit: contain; }
        </style>
        <div class="back" @click=${(e: Event) => e.target === e.currentTarget && this.closeBig()}>
          <div class="box" role="dialog" aria-modal="true" aria-label=${name}>
            <div class="bar"><span>${name}</span><button type="button" data-camera-big-close @click=${() => this.closeBig()}>סגור</button></div>
            <div class="view">
              ${r.state === 'live' && r.camera_id
                ? html`<sw-live-player .cameraId=${r.camera_id} .profile=${'main'} .mode=${effectiveTransport(this.settings)} .plan=${plan.plan} .preferred=${plan.preferred} .gop=${plan.gop} .poster=${snapshotUrl(r.camera_id, this.snapBust)}></sw-live-player>`
                : r.state === 'ha_live' && r.live_path && !this.haFailedAt
                  ? html`<sw-live-player .livePath=${r.live_path} .mode=${effectiveTransport(this.settings)} .poster=${stillUrl(r.entity_id ?? '', this.snapBust)}></sw-live-player>`
                  : html`<img src=${apiUrl(`devices/camera-card/still?entity_id=${encodeURIComponent(r.entity_id ?? '')}&t=${this.snapBust}`)} alt=${name} />`}
            </div>
          </div>
        </div>`,
      root,
    );
    window.addEventListener('keydown', this.onBigKey);
    root.querySelector<HTMLElement>('[data-camera-big-close]')?.focus();
  }

  private onBigKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.closeBig();
  };

  private closeBig() {
    window.removeEventListener('keydown', this.onBigKey);
    if (this.bigHost) {
      render(nothing, this.bigHost.shadowRoot!);
      this.bigHost.remove();
      this.bigHost = null;
    }
    this.expanded = false;
    this.report();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-camera-card': DevicesCameraCard;
  }
}
