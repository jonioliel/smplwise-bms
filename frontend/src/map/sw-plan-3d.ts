import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-chip';
import { SceneView, type QualityLevel, type SceneHit, type ScenePreset } from './scene-three';
import { keepIsos, type SceneDescription, type ScenePart, type Vec3 } from './scene-builder';
import { WEBGL_UNAVAILABLE_HE } from './webgl';
import { productSettings } from '../api/prefs';
import type { LevelDots } from './room-state';
import { PROBE_FALLBACK_MS, PROBE_FIRST_FRAME_MS, PROBE_MS, PROBE_WARM_FRAMES, SETTINGS_WAIT_MS, withTimeout } from './timing';
import { PILL_CAP } from './scene-frame';
export { PROBE_FALLBACK_MS, PROBE_FIRST_FRAME_MS, PROBE_MS, PROBE_WARM_FRAMES, SETTINGS_WAIT_MS } from './timing';

const EXPORT_FAILED_HE = 'ייצוא glTF נכשל';
const FALLBACK_HE = 'עבר לרמה סכמטית — קצב הפריימים היה נמוך';
const TOAST_MS = 4000;
/** The per-browser quality choice (like sw.wall.cols: the viewer's own override of the installation default). */
export const QUALITY_KEY = 'sw.plan3d.quality';
/** A fallback holds for the session: the device does not get re-measured on every mount (a new explicit choice does). */
export const FALLBACK_KEY = 'sw.plan3d.fallback';
export const DEFAULT_MIN_FPS = 30;
export { PILL_CAP } from './scene-frame';
/** The pill's bottom edge sits this far above its point, so the object under it stays clickable from straight above. */
const PILL_GAP_PX = 6;

export interface PartSelectDetail {
  id: string | null;
  kind: string | null;
}
export interface PartHoverDetail {
  id: string;
  kind: string;
  label: string;
  x: number;
  y: number;
}
export interface LevelSelectDetail {
  id: string | null;
}
export interface StripLevel {
  id: string;
  name: string;
  elevation_m: number;
}

/** A download name without whitespace or path characters (Hebrew letters stay): "plan-3d-אולם 3D" -> "plan-3d-אולם-3D". */
function safeFileName(name: string): string {
  return name.replace(/[\s/\\:*?"<>|]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '') || 'plan-3d';
}

const KIND_HE: Record<string, string> = { wall: 'קיר', opening: 'פתח', object: 'עצם', connector: 'מחבר', camera: 'מצלמה', entity: 'ישות', zone: 'חדר', label: 'תווית', level: 'מפלס' };

const readStore = (store: 'local' | 'session', key: string): string | null => {
  try {
    return (store === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
};
const writeStore = (store: 'local' | 'session', key: string, value: string | null): void => {
  try {
    const s = store === 'local' ? localStorage : sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    /* private mode: the choice lives for this page only */
  }
};
const asLevel = (v: unknown): QualityLevel | null => (v === 2 || v === '2' ? 2 : v === 1 || v === '1' ? 1 : null);

/**
 * The schematic 3D view of a floor (T087, design 10.3; CR-006 slice 1a): a SceneView on a canvas, the presets (top /
 * isometric / perspective / from a camera), the quality level (the installation default `plan.quality`, overridden per
 * browser in localStorage, with the automatic fallback to level 1 when the first seconds of level 2 miss the frame
 * budget), the level thumbnail strip (small isometric renders from the same scene, cached per level and bounded by the
 * listed levels like the building page's cache), the export, the hover label and the data attributes the tests read.
 * The screen builds the description (scene-builder) and owns the selection and the level filter: `selectedId` comes in
 * as a source id, `part-select` goes out with one; `activeLevel` comes in, `level-select` goes out. This module is
 * loaded through a dynamic import: importing it is what fetches the three chunk.
 */
@customElement('sw-plan-3d')
export class SwPlan3d extends LitElement {
  @property({ attribute: false }) description: SceneDescription | null = null;
  @property() selectedId: string | null = null;
  @property({ attribute: false }) preset: ScenePreset = 'iso';
  @property({ attribute: false }) cameras: { id: string; label: string }[] = [];
  @property({ attribute: false }) labels: Record<string, string> = {};
  @property() exportName = 'plan-3d';
  /** The levels of the strip (every level of the floor, whatever the filter) and the one the screen shows (null = all). */
  @property({ attribute: false }) levels: StripLevel[] = [];
  @property() activeLevel: string | null = null;
  /** The description the thumbnails draw from: every level of the floor (the screen's filtered one when it shows all). */
  @property({ attribute: false }) thumbnailScene: SceneDescription | null = null;
  /** The state dots of the strip (CR-006 1b, room-state.ts): per level, the presence fade, an open opening, a lit room -
   * drawn over the cached thumbnail, never into it (a state push redraws no thumbnail). */
  @property({ attribute: false }) levelDots: Record<string, LevelDots> = {};
  /** The installation default when the viewer has not chosen (the host may pass it; else the element asks the settings). */
  @property({ attribute: false }) qualityDefault: QualityLevel | null = null;
  /** Level 2 falls back to level 1 under this rate during the probe window; 0 disables the probe (tests, measurements). */
  @property({ type: Number }) minFps = DEFAULT_MIN_FPS;
  /** Render every frame instead of on demand - only for measuring the frame rate (the live spec, Task 10). */
  @property({ type: Boolean, reflect: true, attribute: 'data-measure' }) continuous = false;
  @state() private hover: PartHoverDetail | null = null;
  /** The DOM labels of the description - the temperature chips (1b) and the entity pills (1c): laid out on the
   * projected points after every drawn frame, readable at any zoom, RTL, in the theme's tokens, hidden behind the
   * camera (three draws no sprite for them). Derived in willUpdate from the description, never a second update. */
  private overlays: ScenePart[] = [];
  private overlayById = new Map<string, ScenePart>();
  /** Pills left out by the cap (the "+N" hint). */
  private hiddenPills = 0;
  @state() private ready = false;
  @state() private exporting = false;
  /** WebGL could not start: the whole stage says so. */
  @state() private error = '';
  /** An export failed: a toast that clears itself; the view stays. */
  @state() private toast = '';
  /** The viewer's stored choice (null = the installation default applies). */
  @state() private chosen: QualityLevel | null = asLevel(readStore('local', QUALITY_KEY));
  /** The installation default read from the settings (null until answered; level 1 meanwhile). */
  @state() private installDefault: QualityLevel | null = null;
  /** Level 2 missed the frame budget on this device: level 1 draws and the note says so. */
  @state() private fallback = readStore('session', FALLBACK_KEY) === '1';
  private toastTimer = 0;
  @query('.stage') private stage!: HTMLDivElement;
  private view: SceneView | null = null;
  private ro?: ResizeObserver;
  /** The preset is applied once with the first description (the screen's choice), then only when the property changes:
   * a live state push replaces the description and must not snap the camera back. */
  private presetApplied = false;
  /** The description object last handed to the view (the first mount must not build it twice). */
  private applied: SceneDescription | null = null;
  /** The probe of level 2: the first counter report after it started and the deadline. */
  private probe: { until: number; t0: number; f0: number; start: number } | null = null;
  private probeTimer = 0;
  /** The probe ran (or is running) for this mount / level switch: a live state push never starts it again. */
  private probed = false;
  /** A probe asked for while the tab was hidden (the browser stops frames there: ~0 fps says nothing): runs on return. */
  private probePending = false;
  /** The thumbnails by level id, for the description they were drawn from (bounded by the listed levels). */
  private thumbs = new Map<string, string>();
  private thumbsFor: SceneDescription | null = null;
  private thumbsQuality: QualityLevel | null = null;
  /** The thumbnail pass scheduled for the levels the strip lists without a picture (drawn outside render(), then the
   * main frame is redrawn at once: the pass borrows the canvas corner). */
  private thumbPass = 0;
  private settingsAsked = false;

  static styles = css`
    :host {
      display: block;
      position: relative;
      inline-size: 100%;
      block-size: 100%;
      min-block-size: 240px;
      background: var(--sw-map-bg);
      direction: ltr;
      overflow: hidden;
      border-radius: inherit;
    }
    /* level 2: the sky-gradient backdrop behind the transparent canvas (the two map-sky tokens of the theme) */
    :host([data-quality='2']) {
      background: linear-gradient(180deg, var(--sw-map-sky) 0%, var(--sw-map-sky-horizon) 100%);
    }
    .stage {
      position: absolute;
      inset: 0;
    }
    .stage canvas {
      inline-size: 100% !important;
      block-size: 100% !important;
    }
    .bar {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      max-inline-size: calc(100% - 24px);
      direction: rtl;
    }
    .bar select {
      font: inherit;
      font-size: var(--sw-fs-xs);
      border: 1px solid var(--sw-border-strong);
      border-radius: 999px;
      padding: 4px 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
      max-inline-size: 160px;
    }
    .bar .sep {
      inline-size: 1px;
      block-size: 18px;
      background: var(--sw-border-strong);
    }
    /* the strip stands on the bar's side (inline-start of the RTL bar = the right edge), above it, growing upward:
       the host's floor buttons and level chips own the top edge, the note the other bottom corner */
    .strip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 52px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-block-size: calc(100% - 120px);
      overflow: auto;
      direction: rtl;
    }
    .strip button {
      display: grid;
      gap: 2px;
      padding: 4px;
      inline-size: 96px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
      text-align: center;
    }
    .strip button img {
      display: block;
      inline-size: 88px;
      block-size: 55px;
      object-fit: contain;
      border-radius: 4px;
      background: var(--sw-surface-3);
    }
    .strip button[aria-pressed='true'] {
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
      box-shadow: 0 0 0 1px var(--sw-accent);
    }
    .strip button span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .strip button .pic {
      position: relative;
    }
    /* the state dots (CR-006 1b): presence blue with the fade's opacity, an open opening red, a lit room warm - over the
       thumbnail's top-right corner (the strip is RTL: the inline start), never drawn into the cached picture */
    .strip button .dots {
      position: absolute;
      inset-block-start: 3px;
      inset-inline-start: 3px;
      display: flex;
      gap: 3px;
      pointer-events: none;
    }
    .strip button .dots i {
      display: block;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      box-shadow: 0 0 0 1.5px var(--sw-surface);
    }
    .strip button .dots i[data-dot='presence'] {
      background: var(--sw-map-presence);
      opacity: var(--fade, 1);
    }
    .strip button .dots i[data-dot='open'] {
      background: var(--sw-danger);
    }
    .strip button .dots i[data-dot='lit'] {
      background: var(--sw-map-lit);
    }
    .overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .chip,
    .lbl {
      position: absolute;
      left: 0;
      top: 0;
      transform: translate(-50%, -50%);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 1px 7px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      color: var(--sw-map-temp);
      box-shadow: var(--sw-shadow-1);
      direction: rtl;
      white-space: nowrap;
      display: none;
    }
    /* an entity pill: its state token as the colour (stale / live / text-3), a click selects the entity as its
       sprite used to; the selected one carries the accent ring the 3D outline gives a box */
    .lbl {
      color: var(--lbl, var(--sw-text));
      pointer-events: auto;
      cursor: pointer;
    }
    .lbl[aria-pressed='true'] {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 1px var(--sw-accent);
    }
    /* the "+N" hint of the pill cap: the top start corner (the strip and the bar own the bottom) */
    .more {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 1px 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      direction: rtl;
      white-space: nowrap;
    }
    .tip {
      position: absolute;
      z-index: var(--sw-z-map-ui);
      pointer-events: none;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      padding: 3px 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-1);
      direction: rtl;
      white-space: nowrap;
      transform: translate(-50%, -140%);
    }
    .note {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 2px 8px;
      direction: rtl;
    }
    .note.fb {
      inset-block-end: 40px;
    }
    .spinner {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      background: var(--sw-surface);
    }
    .toast {
      position: absolute;
      inset-block-start: 12px;
      left: 50%; /* physical: centred whatever the direction */
      transform: translateX(-50%);
      z-index: var(--sw-z-map-ui);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 4px 12px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
      box-shadow: var(--sw-shadow-1);
      direction: rtl;
    }
    .err {
      color: var(--sw-danger);
    }
    @media (max-width: 640px) {
      .bar {
        inset-inline-start: 8px;
        inset-block-end: 8px;
        gap: 4px;
      }
      .note:not(.fb) {
        display: none;
      }
      .note.fb {
        inset-block-end: auto;
        inset-block-start: 8px;
        inset-inline-end: 8px;
      }
      /* the phone: a row of small thumbnails above the bar instead of a column up the side */
      .strip {
        inset-inline-start: 8px;
        inset-block-end: 44px;
        flex-direction: row;
        max-inline-size: calc(100% - 16px);
        max-block-size: none;
        gap: 4px;
      }
      .strip button {
        inline-size: 64px;
        padding: 3px;
      }
      .strip button img {
        inline-size: 56px;
        block-size: 35px;
      }
    }
  `;

  protected firstUpdated(): void {
    this.init();
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && !this.view) this.init(); // moved in the DOM: the canvas was disposed on the way out
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.ro?.disconnect();
    cancelAnimationFrame(this.thumbPass);
    this.thumbPass = 0;
    this.endProbe(false);
    this.probed = false;
    this.probePending = false;
    this.view?.dispose();
    this.view = null;
    this.applied = null;
    this.thumbs.clear();
    this.thumbsFor = null;
    window.clearTimeout(this.toastTimer);
  }

  /** The level that draws: the viewer's choice, else the installation default, else 1 - and 1 after a fallback. */
  get quality(): QualityLevel {
    if (this.fallback) return 1;
    return this.chosen ?? this.qualityDefault ?? this.installDefault ?? 1;
  }

  private init(): void {
    // the installation default when neither the viewer nor the host chose: one build at the right level, no rebuild
    // when the settings land (the cached settings answer at once; a first fetch takes the round trip)
    if (this.chosen === null && this.qualityDefault === null && this.installDefault === null && !this.settingsAsked) {
      this.settingsAsked = true;
      // settings unavailable, or not answered within SETTINGS_WAIT_MS: level 1 until the viewer chooses
      void withTimeout(productSettings().then((s) => asLevel(s['plan.quality']) ?? 1), SETTINGS_WAIT_MS, 1 as QualityLevel)
        .then((q) => { this.installDefault = q; })
        .finally(() => { if (this.isConnected && !this.view) this.init(); });
      return;
    }
    try {
      this.view = new SceneView({
        mount: this.stage,
        color: (token) => getComputedStyle(this).getPropertyValue(`--sw-${token}`).trim() || '#888888',
        onSelect: (hit) => this.emitSelect(hit),
        onHover: (hit, x, y) => this.setHover(hit, x, y),
        onFrame: (frames, fps) => {
          this.setAttribute('data-frames', String(frames));
          this.setAttribute('data-fps', String(fps));
          this.onProbeFrame(frames);
        },
        onDraw: () => this.layoutOverlays(),
        quality: this.quality,
      });
    } catch (err) {
      console.warn('sw-plan-3d: WebGL failed to start', err);
      this.error = WEBGL_UNAVAILABLE_HE;
      return;
    }
    this.view.setContinuous(this.continuous);
    this.ro = new ResizeObserver(() => this.view?.resize());
    this.ro.observe(this);
    this.presetApplied = false;
    this.setAttribute('data-quality', String(this.quality));
    if (this.description) this.apply(this.description);
    this.ready = true;
    this.setAttribute('data-ready', '');
    this.setAttribute('data-selected', this.selectedId ?? '');
  }

  /** The DOM labels follow the description in the same update that renders it (no second Lit update per description).
   * Pills: only those on the shown level when a level filter is set (a lower level's pills would show through the
   * upper floor); above PILL_CAP of them at the overview only the selected, the hovered and the alerting ones (a state
   * token other than text-3: open, on, stale), the rest counted in a "+N" hint - hundreds of pills would be hundreds
   * of elements repositioned every frame. */
  protected willUpdate(changed: PropertyValues<this>): void {
    if (!(changed.has('description') || changed.has('activeLevel') || changed.has('selectedId') || (changed as Map<string, unknown>).has('hover'))) return;
    const parts = this.description?.parts ?? [];
    const chips = parts.filter((p) => p.kind === 'chip');
    let pills = parts.filter((p) => p.kind === 'entity' && (!this.activeLevel || p.level_id === this.activeLevel));
    this.hiddenPills = 0;
    if (pills.length > PILL_CAP) {
      const keep = pills.filter((p) => p.userData.id === this.selectedId || p.userData.id === this.hover?.id || p.color !== 'text-3');
      this.hiddenPills = pills.length - keep.length;
      pills = keep;
    }
    this.overlays = [...chips, ...pills];
    this.overlayById = new Map(this.overlays.map((p) => [p.id, p]));
  }

  protected updated(changed: PropertyValues<this>): void {
    if (!this.view) return;
    if (changed.has('description') && this.description) this.apply(this.description);
    if (changed.has('selectedId') || changed.has('description')) {
      this.view.setSelected(this.selectedId);
      this.setAttribute('data-selected', this.selectedId ?? '');
    }
    if (changed.has('preset') && changed.get('preset') !== undefined) this.applyPreset(this.preset);
    // the first update lists every initial property, `continuous` included: it must not stop a probe init() just
    // started (the probe restores the property's value when it ends)
    if (changed.has('continuous') && !this.probe) this.view.setContinuous(this.continuous);
    this.applyQuality(); // the choice, the installation default or a fallback changed: a no-op when the view already draws the level
    this.layoutOverlays(); // the label elements may be new (a state push): place them at once
  }

  /** Place every DOM label at its part's projected point (hidden behind the camera), matched by the part id it carries
   * (never by DOM order: Lit may reuse elements across a description change). Imperative: it runs per drawn frame while
   * the camera moves, without a Lit render. */
  private layoutOverlays(): void {
    const view = this.view;
    if (!view || !this.overlays.length) return;
    const els = this.renderRoot.querySelectorAll<HTMLElement>('[data-3d-part]');
    els.forEach((el) => {
      const p = this.overlayById.get(el.getAttribute('data-3d-part') ?? '');
      const at = p ? view.projectPoint(p.position) : null;
      if (!p || !at) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      // a chip is centred on its point (the room's centroid); a pill stands on its point, bottom edge a gap above it
      el.style.transform = p.kind === 'chip' ? `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px) translate(-50%, -50%)` : `translate(${Math.round(at.x)}px, ${Math.round(at.y) - PILL_GAP_PX}px) translate(-50%, -100%)`;
    });
  }

  private apply(desc: SceneDescription): void {
    if (desc === this.applied) return;
    this.applied = desc;
    this.view?.setDescription(desc);
    this.setAttribute('data-parts', String(desc.parts.length));
    this.toggleAttribute('data-estimated', desc.estimated);
    if (!this.presetApplied) {
      this.applyPreset(this.preset);
      this.presetApplied = true;
    }
    this.view?.setSelected(this.selectedId);
    if (this.quality === 2 && !this.probed) this.startProbe(); // once per mount: a live state push is not a new device
  }

  /** The view follows the effective level; a switch to level 2 starts the probe, a switch away ends it. */
  private applyQuality(): void {
    const q = this.quality;
    this.setAttribute('data-quality', String(q));
    if (!this.view || this.view.getQuality() === q) return;
    this.view.setQuality(q);
    this.thumbs.clear(); // the strip follows the materials of the level
    this.probed = false;
    if (q === 2 && this.applied) this.startProbe();
    else this.endProbe(false);
    this.requestUpdate();
  }

  /** The viewer's choice for this browser (the chips): stored; level 2 clears a fallback and measures again. */
  setQuality(q: QualityLevel): void {
    this.chosen = q;
    writeStore('local', QUALITY_KEY, String(q));
    if (q === 2 && this.fallback) {
      this.fallback = false;
      writeStore('session', FALLBACK_KEY, null);
    }
  }

  // ---- the frame budget probe: continuous frames for PROBE_MS, then the rate decides

  private startProbe(): void {
    this.endProbe(false);
    this.probed = true;
    if (!this.view || this.minFps <= 0) return;
    if (document.hidden) {
      this.probePending = true; // a background tab draws no frames: measure when it comes back
      return;
    }
    this.probePending = false;
    this.probe = { until: 0, t0: 0, f0: 0, start: Number(this.getAttribute('data-frames') ?? 0) };
    this.view.setContinuous(true);
    this.probeTimer = window.setTimeout(() => this.endProbe(true), PROBE_FIRST_FRAME_MS);
  }

  private onProbeFrame(frames: number): void {
    const p = this.probe;
    if (!p) return;
    if (document.hidden) {
      this.endProbe(false); // the tab went to the background mid-probe: nothing measured, again on return
      this.probePending = true;
      return;
    }
    const now = performance.now();
    if (!p.t0) {
      if (frames - p.start < PROBE_WARM_FRAMES) return; // still warming up: the first-frame timer keeps watch
      p.t0 = now;
      p.f0 = frames;
      p.until = now + PROBE_MS;
      window.clearTimeout(this.probeTimer);
      this.probeTimer = window.setTimeout(() => this.endProbe(true), PROBE_FALLBACK_MS);
      return;
    }
    if (now < p.until) return;
    const fps = ((frames - p.f0) * 1000) / (now - p.t0);
    this.setAttribute('data-probe-fps', String(Math.round(fps)));
    this.endProbe(false);
    if (fps < this.minFps) this.fallBack();
  }

  /** Stop measuring; `decide` reads the counters one last time (the timer's path when no report landed in time). */
  private endProbe(decide: boolean): void {
    window.clearTimeout(this.probeTimer);
    this.probeTimer = 0;
    const p = this.probe;
    this.probe = null;
    this.view?.setContinuous(this.continuous);
    if (decide && p && document.hidden) {
      this.probePending = true; // the timer fired in a background tab: no verdict
      return;
    }
    if (decide && p) {
      // the timer's path: no report landed in time - the rate over what did draw (nothing at all: 0)
      const frames = Number(this.getAttribute('data-frames') ?? 0);
      const fps = p.t0 ? ((frames - p.f0) * 1000) / Math.max(1, performance.now() - p.t0) : 0;
      this.setAttribute('data-probe-fps', String(Math.round(fps)));
      if (fps < this.minFps) this.fallBack();
    }
  }

  private onVisibility = (): void => {
    if (document.hidden) {
      if (this.probe) {
        this.endProbe(false);
        this.probePending = true;
      }
    } else if (this.probePending && this.quality === 2 && this.view) this.startProbe();
  };

  private fallBack(): void {
    this.fallback = true;
    writeStore('session', FALLBACK_KEY, '1');
  }

  /** data-preset follows only a preset that took effect (an unknown camera id leaves the view and the attribute). */
  private applyPreset(p: ScenePreset): void {
    if (this.view?.setPreset(p)) this.setAttribute('data-preset', typeof p === 'string' ? p : 'camera');
  }

  private pickPreset(p: ScenePreset): void {
    this.preset = p;
    this.applyPreset(p);
  }

  private labelOf(hit: SceneHit): string {
    return this.labels[hit.id] ?? KIND_HE[hit.kind] ?? hit.id;
  }

  private emitSelect(hit: SceneHit | null): void {
    this.dispatchEvent(new CustomEvent<PartSelectDetail>('part-select', { detail: { id: hit?.id ?? null, kind: hit?.kind ?? null }, bubbles: true, composed: true }));
  }

  private setHover(hit: SceneHit | null, x: number, y: number): void {
    this.hover = hit ? { id: hit.id, kind: hit.kind, label: this.labelOf(hit), x, y } : null;
    this.dispatchEvent(new CustomEvent<PartHoverDetail | null>('part-hover', { detail: this.hover, bubbles: true, composed: true }));
  }

  private pickLevel(id: string): void {
    const next = this.activeLevel === id ? null : id; // the shown level again: every level
    this.dispatchEvent(new CustomEvent<LevelSelectDetail>('level-select', { detail: { id: next }, bubbles: true, composed: true }));
  }

  // ---- the thumbnail strip: one small isometric per listed level, cached for the description it came from

  /** The thumbnail of a level from the cache ('' until the pass drew it); a new description or quality empties the
   * cache. render() only reads here - drawing happens in the scheduled pass (review nit of slice 1a). */
  private thumbFor(id: string): string {
    const src = this.thumbnailScene;
    if (!src || !this.view) return '';
    if (this.thumbsFor !== src || this.thumbsQuality !== this.quality) {
      this.thumbs.clear();
      this.thumbsFor = src;
      this.thumbsQuality = this.quality;
    }
    const have = this.thumbs.get(id);
    if (have === undefined) this.scheduleThumbs();
    return have ?? '';
  }

  /** One animation frame: draw every listed level without a picture, then redraw the main frame at once (the pass used
   * the canvas corner) and re-render the strip. A failed thumbnail is not cached: the next pass tries again. */
  private scheduleThumbs(): void {
    if (this.thumbPass) return;
    this.thumbPass = requestAnimationFrame(() => {
      this.thumbPass = 0;
      const src = this.thumbnailScene;
      const view = this.view;
      if (!src || !view || this.thumbsFor !== src) return;
      let drew = false;
      for (const l of this.levels) {
        if (this.thumbs.has(l.id)) continue;
        const url = view.renderThumbnail(src, l.id);
        if (url) {
          this.thumbs.set(l.id, url);
          drew = true;
        }
      }
      if (drew) view.redrawNow();
      this.setAttribute('data-3d-thumbs', String(this.thumbs.size));
      if (drew) this.requestUpdate();
    });
  }

  /** How many thumbnails the cache holds (tests: bounded by the listed levels). */
  get thumbnailCount(): number {
    return this.thumbs.size;
  }

  /** Host pixels of a scene point (tests click through it). */
  toScreen(p: Vec3): { x: number; y: number } | null {
    return this.view?.projectPoint(p) ?? null;
  }

  /** The view as a PNG data URL (the visual snapshots; phase 2's control image starts here). */
  capture(): string | null {
    return this.view?.capture() ?? null;
  }

  async exportGltf(): Promise<Record<string, unknown>> {
    if (!this.view) throw new Error('3D view not ready');
    return this.view.exportGltf();
  }

  /** The existing download pattern (explore-plan-editor.exportJson): a Blob, an anchor with a download name, a click. */
  async download(): Promise<void> {
    if (this.exporting) return;
    this.exporting = true;
    try {
      const json = await this.exportGltf();
      const url = URL.createObjectURL(new Blob([JSON.stringify(json)], { type: 'model/gltf+json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFileName(this.exportName)}.gltf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.warn('sw-plan-3d: glTF export failed', err);
      this.showToast(EXPORT_FAILED_HE);
    } finally {
      this.exporting = false;
    }
  }

  private showToast(text: string): void {
    this.toast = text;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = ''), TOAST_MS);
  }

  private renderStrip() {
    if (this.levels.length < 2 || !this.thumbnailScene || !this.ready) return nothing;
    const listed = [...this.levels].sort((a, b) => b.elevation_m - a.elevation_m || (a.id < b.id ? -1 : 1));
    this.thumbs = keepIsos(this.thumbs, listed.map((l) => l.id));
    return html`<div class="strip" role="group" aria-label="מפלסים" data-3d-strip>
      ${listed.map((l) => {
        const d = this.levelDots[l.id];
        return html`<button type="button" data-3d-thumb=${l.id} aria-pressed=${this.activeLevel === l.id ? 'true' : 'false'} title=${`${l.name} · ${l.elevation_m >= 0 ? '+' : '−'}${Math.abs(l.elevation_m).toFixed(1)} מ׳`} @click=${() => this.pickLevel(l.id)}>
          <span class="pic"><img alt="" src=${this.thumbFor(l.id)} />${d && (d.presence > 0 || d.open || d.lit)
            ? html`<span class="dots" data-3d-dots=${l.id}>${d.presence > 0 ? html`<i data-dot="presence" title="תנועה" style=${`--fade:${Math.max(0.35, d.presence).toFixed(2)}`}></i>` : nothing}${d.open ? html`<i data-dot="open" title="פתח פתוח"></i>` : nothing}${d.lit ? html`<i data-dot="lit" title="תאורה דולקת"></i>` : nothing}</span>`
            : nothing}</span><span>${l.name}</span>
        </button>`;
      })}
    </div>`;
  }

  render() {
    const preset = typeof this.preset === 'string' ? this.preset : 'camera';
    const cameraId = typeof this.preset === 'string' ? '' : this.preset.camera.replace(/^cam:/, '');
    const q = this.quality;
    return html`
      <div class="stage"></div>
      ${!this.ready && !this.error ? html`<div class="spinner" data-3d-spinner>טוען תלת-ממד…</div>` : nothing}
      ${this.error ? html`<div class="spinner err" data-3d-error>${this.error}</div>` : nothing}
      ${this.overlays.length
        ? html`<div class="overlay">${this.overlays.map((p) => p.kind === 'chip'
            ? html`<span class="chip" aria-hidden="true" data-3d-chip=${p.userData.id} data-3d-chip-part=${p.id} data-3d-part=${p.id}>${p.text ?? ''}</span>`
            : html`<button type="button" class="lbl" tabindex="-1" data-3d-label=${p.userData.id} data-3d-part=${p.id} aria-pressed=${this.selectedId === p.userData.id ? 'true' : 'false'} style=${`--lbl: var(--sw-${p.color})`} @click=${() => this.emitSelect({ id: p.userData.id, kind: p.userData.kind, partId: p.id })}>${p.text ?? ''}</button>`)}${this.hiddenPills
            ? html`<span class="more" data-3d-more=${this.hiddenPills} title="ישויות ללא מצב מיוחד מוסתרות במבט הכללי; בחירה ברשימה או במפלס מציגה אותן">+${this.hiddenPills} ישויות</span>`
            : nothing}</div>`
        : nothing}
      ${this.renderStrip()}
      <div class="bar" role="group" aria-label="תצוגות מוכנות" data-3d-bar>
        <sw-chip data-preset-top ?selected=${preset === 'top'} @click=${() => this.pickPreset('top')}>מלמעלה</sw-chip>
        <sw-chip data-preset-iso ?selected=${preset === 'iso'} @click=${() => this.pickPreset('iso')}>איזומטרי</sw-chip>
        <sw-chip data-preset-persp ?selected=${preset === 'persp'} @click=${() => this.pickPreset('persp')}>פרספקטיבה</sw-chip>
        ${this.cameras.length
          ? html`<select data-preset-camera aria-label="מבט מהמצלמה" .value=${cameraId} @change=${(e: Event) => this.onCameraChange(e)}>
              <option value="">מבט מהמצלמה…</option>
              ${this.cameras.map((c) => html`<option value=${c.id} ?selected=${c.id === cameraId}>${c.label}</option>`)}
            </select>`
          : nothing}
        <span class="sep" aria-hidden="true"></span>
        <sw-chip data-quality-1 title="רמה סכמטית: חומרים שטוחים, בלי צללים" ?selected=${q === 1} @click=${() => this.setQuality(1)}>סכמטי</sw-chip>
        <sw-chip data-quality-2 title="רמה מלאה: צללים רכים, חומרים, חיתוך קירות" ?selected=${q === 2} @click=${() => this.setQuality(2)}>מלא</sw-chip>
        <sw-button size="sm" variant="ghost" icon="download" data-export-gltf ?disabled=${!this.ready || this.exporting} @click=${() => this.download()}>${this.exporting ? 'מייצא…' : 'ייצוא glTF'}</sw-button>
      </div>
      ${this.description?.estimated ? html`<div class="note" data-3d-estimated>≈ מידות משוערות (התוכנית לא כוילה)</div>` : nothing}
      ${this.fallback ? html`<div class="note fb" role="status" data-3d-fallback>${FALLBACK_HE}</div>` : nothing}
      ${this.toast ? html`<div class="toast" role="status" data-3d-toast>${this.toast}</div>` : nothing}
      ${this.hover ? html`<div class="tip" data-3d-tip data-3d-tip-kind=${this.hover.kind} style=${`left:${this.hover.x}px;top:${this.hover.y}px`}>${this.hover.label}</div>` : nothing}
    `;
  }

  private onCameraChange(e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    if (v) this.pickPreset({ camera: `cam:${v}` });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-plan-3d': SwPlan3d;
  }
}
