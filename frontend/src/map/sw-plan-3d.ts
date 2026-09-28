import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-chip';
import { SceneView, type QualityLevel, type SceneHit, type ScenePreset } from './scene-three';
import { keepIsos, type SceneDescription, type Vec3 } from './scene-builder';
import { WEBGL_UNAVAILABLE_HE } from './webgl';
import { productSettings } from '../api/prefs';

const EXPORT_FAILED_HE = 'ייצוא glTF נכשל';
const FALLBACK_HE = 'עבר לרמה סכמטית — קצב הפריימים היה נמוך';
const TOAST_MS = 4000;
/** The per-browser quality choice (like sw.wall.cols: the viewer's own override of the installation default). */
export const QUALITY_KEY = 'sw.plan3d.quality';
/** A fallback holds for the session: the device does not get re-measured on every mount (a new explicit choice does). */
export const FALLBACK_KEY = 'sw.plan3d.fallback';
/** Level 2 is measured over this window from its first reported frame (continuous frames); under `minFps` it falls
 * back. The first frame itself is not timed: shader compilation and the shadow map build are one-off costs. */
export const PROBE_MS = 2500;
/** No frame reported this long after level 2 started: the device cannot draw it at all - fall back. */
export const PROBE_FIRST_FRAME_MS = 10000;
/** The window opens only after this many frames drew at level 2: the first ones compile the shaders and build the
 * shadow map (seconds on a software renderer), which is a one-off cost, not the device's rate. */
export const PROBE_WARM_FRAMES = 3;
export const DEFAULT_MIN_FPS = 30;

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
  /** The installation default when the viewer has not chosen (the host may pass it; else the element asks the settings). */
  @property({ attribute: false }) qualityDefault: QualityLevel | null = null;
  /** Level 2 falls back to level 1 under this rate during the probe window; 0 disables the probe (tests, measurements). */
  @property({ type: Number }) minFps = DEFAULT_MIN_FPS;
  /** Render every frame instead of on demand - only for measuring the frame rate (the live spec, Task 10). */
  @property({ type: Boolean, reflect: true, attribute: 'data-measure' }) continuous = false;
  @state() private hover: PartHoverDetail | null = null;
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
      void productSettings()
        .then((s) => { this.installDefault = asLevel(s['plan.quality']) ?? 1; })
        .catch(() => { this.installDefault = 1; }) // settings unavailable: level 1 until the viewer chooses
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
      this.probeTimer = window.setTimeout(() => this.endProbe(true), PROBE_MS + 600);
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

  /** The thumbnail of a level: drawn once per description and quality, kept while the level stays listed. */
  private thumbFor(id: string): string {
    const src = this.thumbnailScene;
    if (!src || !this.view) return '';
    if (this.thumbsFor !== src || this.thumbsQuality !== this.quality) {
      this.thumbs.clear();
      this.thumbsFor = src;
      this.thumbsQuality = this.quality;
    }
    const have = this.thumbs.get(id);
    if (have !== undefined) return have;
    const url = this.view.renderThumbnail(src, id) ?? '';
    this.thumbs.set(id, url);
    return url;
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
      ${listed.map((l) => html`<button type="button" data-3d-thumb=${l.id} aria-pressed=${this.activeLevel === l.id ? 'true' : 'false'} title=${`${l.name} · ${l.elevation_m >= 0 ? '+' : '−'}${Math.abs(l.elevation_m).toFixed(1)} מ׳`} @click=${() => this.pickLevel(l.id)}>
          <img alt="" src=${this.thumbFor(l.id)} /><span>${l.name}</span>
        </button>`)}
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
