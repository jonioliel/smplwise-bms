/**
 * `sw-plan-stills` - the pre-rendered view of a floor level (CR-029 S3, approach B1; the owner's reference technique, generated):
 * the base picture of the level in the style and time band, the lights-on picture revealed through the mask of every lit room,
 * the open doors, presence and cameras drawn as SVG from the same projection. Zero WebGL, zero animation frames: a state push
 * re-renders a few SVG nodes. Used by the weak-device rung of the quality ladder, the wall display set to stills, and any
 * surface without WebGL (quality-ladder.ts viewMode). Only `lit === true` lights a room and only a listed open opening opens a
 * door - a stale or unknown state never does (the state layer's rule, room-state.ts).
 */
import { LitElement, css, html, nothing, svg, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { bandAt, convexHull, stillKey, type BundleBakes, type MaskDoc, type StillBand, type StillPreset, type StillStyle } from './still-bake';

/** A kiosk shows the same still for hours: with `autoBand` the band (day / sunset / night) is re-read from the clock this often. */
const BAND_TICK_MS = 60_000;

export interface StillsRoomState {
  lit?: boolean | null;
  presence?: boolean | null;
}
const EMPTY_HE = 'אין תמונות מוכנות למפלס זה';
const LOAD_FAILED_HE = 'טעינת התמונה המוכנה נכשלה';

const maskCache = new Map<string, Promise<MaskDoc | null>>();
function loadMask(url: string): Promise<MaskDoc | null> {
  let hit = maskCache.get(url);
  if (!hit) {
    hit = fetch(url, { credentials: 'same-origin' })
      .then((r) => (r.ok ? (r.json() as Promise<MaskDoc>) : null))
      .catch(() => null);
    maskCache.set(url, hit);
    if (maskCache.size > 32) maskCache.delete(maskCache.keys().next().value as string);
  }
  return hit;
}

const pts = (p: [number, number][]): string => p.map(([x, y]) => `${x},${y}`).join(' ');

@customElement('sw-plan-stills')
export class SwPlanStills extends LitElement {
  @property({ attribute: false }) bakes: BundleBakes | null = null;
  @property() level: string | null = null;
  @property() preset: StillPreset = 'iso';
  @property() styleId: StillStyle = 'light';
  @property() band: StillBand = 'day';
  /** CR-029 S5-B: follow the time of day by itself - the band is read from the clock when the view connects and once a minute
   * after, so a wall that idles on its still all evening changes from the day picture to the sunset and night ones (an idle
   * kiosk gets no host re-render to do it). `site` is the installation's position, the shape sun.ts and the host's site state use (default: the S3 fallback). */
  @property({ type: Boolean }) autoBand = false;
  @property({ attribute: false }) site: { latitude: number; longitude: number } | null = null;
  /** Room id -> state (room-state.ts RoomStateLayer.rooms). */
  @property({ attribute: false }) rooms: Record<string, StillsRoomState> = {};
  /** Ids of the openings that are open now (room-state.ts openOpenings). */
  @property({ attribute: false }) openOpenings: string[] = [];
  @property({ type: Boolean }) showCameras = true;
  @state() private mask: MaskDoc | null = null;
  @state() private failed = false;
  private maskUrl: string | null = null;

  static styles = css`
    :host { display: block; position: relative; width: 100%; height: 100%; min-height: 200px; background: var(--sw-map-sky, #dbe7f8); overflow: hidden; }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .presence { fill: var(--sw-map-presence, #2767ed); fill-opacity: 0.22; stroke: var(--sw-map-presence, #2767ed); stroke-width: 2; stroke-opacity: 0.7; }
    .door { fill: var(--sw-danger, #ef4444); fill-opacity: 0.35; stroke: var(--sw-danger, #ef4444); stroke-width: 2; }
    .cam { fill: var(--sw-accent, #2767ed); stroke: #fff; stroke-width: 2; }
    .empty { position: absolute; inset: 0; display: grid; place-items: center; color: var(--sw-text-2, #5b6a85); font: 500 13px/1.4 var(--sw-font, system-ui); }
  `;

  private bandTimer = 0;

  connectedCallback(): void {
    super.connectedCallback();
    this.watchBand();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.bandTimer);
    this.bandTimer = 0;
  }

  private watchBand(): void {
    window.clearInterval(this.bandTimer);
    this.bandTimer = 0;
    if (!this.autoBand || !this.isConnected) return;
    this.readBand();
    this.bandTimer = window.setInterval(() => this.readBand(), BAND_TICK_MS);
  }

  private readBand(): void {
    const next = bandAt(new Date(), this.site?.latitude, this.site?.longitude);
    if (next !== this.band) this.band = next;
  }

  private levelSet() {
    return this.level ? this.bakes?.levels[this.level] ?? null : null;
  }

  private picture(variant: 'off' | 'on') {
    const set = this.levelSet();
    if (!set) return null;
    return set.stills[stillKey(this.preset, this.styleId, this.band, variant)]
      // a band or style that was not baked falls back to the nearest one baked (never to nothing while a picture exists)
      ?? set.stills[stillKey(this.preset, this.styleId, 'day', variant)]
      ?? Object.entries(set.stills).find(([k]) => k.startsWith(`${this.preset}/`) && k.endsWith(`/${variant}`))?.[1]
      ?? null;
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('autoBand') || changed.has('site')) this.watchBand();
    if (changed.has('bakes') || changed.has('level') || changed.has('preset')) {
      const url = this.levelSet()?.masks[this.preset]?.url ?? null;
      if (url !== this.maskUrl) {
        this.maskUrl = url;
        this.mask = null;
        if (url) void loadMask(url).then((m) => { if (this.maskUrl === url) this.mask = m; });
      }
    }
  }

  render() {
    const base = this.picture('off');
    if (!base) return html`<div class="empty" data-stills-empty>${EMPTY_HE}</div>`;
    if (this.failed) return html`<div class="empty" data-stills-failed>${LOAD_FAILED_HE}</div>`;
    const on = this.picture('on');
    const m = this.mask && this.mask.width === base.width && this.mask.height === base.height ? this.mask : null;
    const lit = m ? m.rooms.filter((r) => this.rooms[r.id]?.lit === true) : [];
    const present = m ? m.rooms.filter((r) => this.rooms[r.id]?.presence === true && this.rooms[r.id]?.lit !== true) : [];
    const open = new Set(this.openOpenings);
    const doors = m ? m.doors.filter((d) => open.has(d.id)) : [];
    return html`<svg viewBox="0 0 ${base.width} ${base.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="תמונה מוכנה של המפלס" data-stills
        data-band=${this.band} data-style=${this.styleId} data-lit=${lit.length}>
      <defs>${lit.map((r) => svg`<clipPath id=${`lit-${r.id}`}><polygon points=${pts(convexHull([...r.floor, ...r.top]))}></polygon></clipPath>`)}</defs>
      ${svg`<image href=${base.url} width=${base.width} height=${base.height} preserveAspectRatio="none" @error=${() => { this.failed = true; }}></image>`}
      ${on ? lit.map((r) => svg`<image href=${on.url} width=${base.width} height=${base.height} preserveAspectRatio="none" clip-path=${`url(#lit-${r.id})`} data-lit-room=${r.id}></image>`) : nothing}
      ${present.map((r) => svg`<polygon class="presence" points=${pts(r.floor)} data-presence=${r.id}></polygon>`)}
      ${doors.map((d) => svg`<polygon class="door" points=${pts(d.points)} data-open-door=${d.id}></polygon>`)}
      ${this.showCameras && m ? m.cameras.map((c) => svg`<circle class="cam" cx=${c.p[0]} cy=${c.p[1]} r="7" data-still-camera=${c.id}></circle>`) : nothing}
    </svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-plan-stills': SwPlanStills;
  }
}
