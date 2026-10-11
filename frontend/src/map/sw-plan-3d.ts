import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-chip';
import { SceneView, renderControlImage, WALK_ENTRY_MS, type QualityLevel, type SceneHit, type ScenePreset } from './scene-three';
import { CONTROL_BACKDROP, CONTROL_H, CONTROL_W, controlColor } from './skin-control';
import { keepIsos, type SceneDescription, type ScenePart, type Vec3 } from './scene-builder';
import { WEBGL_UNAVAILABLE_HE } from './webgl';
import { productSettings } from '../api/prefs';
import type { LevelDots } from './room-state';
import { PROBE_FALLBACK_MS, PROBE_FIRST_FRAME_MS, PROBE_MS, PROBE_WARM_FRAMES, SETTINGS_WAIT_MS, withTimeout } from './timing';
import { PILL_CAP } from './scene-frame';
import { WalkSession } from './walk-session';
import { drawMinimap, type MinimapFrame } from './walk-minimap';
import { DOOR_STATE_HE, type WalkStart, type WalkWorld } from './walk-world';
import type { WalkEvent } from './walk-controller';
import { DEFAULT_VIEW, planViewPrefs, type PlanViewDials } from '../api/plan-view';
import { RUNG_HE, asMode, autoStart, drawnRung, levelRung, probeVerdict, probes, rungLevel, RUNGS, nextDown, type QualityMode, type Rung } from './quality-ladder';
import { styleFor } from './look-style';
import { DEFAULT_SITE, TIME_BAND_HE, hourLabel, siteInstant, siteLocal, timeBand } from './sun';
export { PROBE_FALLBACK_MS, PROBE_FIRST_FRAME_MS, PROBE_MS, PROBE_WARM_FRAMES, SETTINGS_WAIT_MS } from './timing';

const EXPORT_FAILED_HE = 'ייצוא glTF נכשל';
const FALLBACK_HE = 'עבר לרמה סכמטית — קצב הפריימים היה נמוך';
/** The automatic ladder lowered the rung (only in the `auto` mode). */
const fallbackHe = (r: Rung): string => (r === 'schematic' ? FALLBACK_HE : `עבר ל${RUNG_HE[r]} — קצב הפריימים היה נמוך`);
/** CR-029 S1: the host builds the description with the realistic part (it listens to `realistic-change`). */
export interface RealisticChangeDetail {
  on: boolean;
}
/** The site clock ticks the sun once a minute in the `clock` time source. */
const CLOCK_TICK_MS = 60_000;
const TOAST_MS = 4000;
/** The per-browser quality choice (like sw.wall.cols: the viewer's own override of the installation default). */
export const QUALITY_KEY = 'sw.plan3d.quality';
/** A fallback holds for the session: the device does not get re-measured on every mount (a new explicit choice does). */
export const FALLBACK_KEY = 'sw.plan3d.fallback';
/** K88: the viewer's night-mode choice for this browser. */
export const NIGHT_KEY = 'sw.plan3d.night';
/** The walk guard's session flag (CR-029 section 3.4): separate from the auto mode's fallback (coordinator 2026-10-11). */
export const WALK_GUARD_KEY = 'sw.plan3d.walkguard';
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
/** CR-029 S4: the walk asks the host for a description with the walk world (`on`), or tells it the walk ended. */
export interface WalkChangeDetail {
  on: boolean;
}
/** CR-029 S4: a stair to another floor was walked to its top - "continue to that floor" (a document load, not a walk). */
export interface FloorRequestDetail {
  floorId: string;
}
/** LOOK_SPEC section 9: the walk's field of view - desktop, touch, portrait. */
export const WALK_FOV = { desktop: 62, touch: 70, portrait: 76 } as const;
/** The crosshair turns to a device within this distance (LOOK_SPEC section 9). */
export const WALK_ACT_M = 3.5;
const WALK_TOAST_MS = 2600;
const START_KIND_HE: Record<string, string> = { saved: 'עמדות שמורות', door: 'כניסה', room: 'חדרים', camera: 'מצלמות', centre: 'מרכז' };

/** A download name without whitespace or path characters (Hebrew letters stay): "plan-3d-אולם 3D" -> "plan-3d-אולם-3D". */
function safeFileName(name: string): string {
  return name.replace(/[\s/\\:*?"<>|]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '') || 'plan-3d';
}

/** Where the walk resumes on a floor reached by a stair from `fromFloor` (CR-029 section 4.3): just off the mouth of the
 * twin stair that leads back there, facing away from it; null = the floor has no such twin (its default start then). */
export function twinStart(world: WalkWorld, fromFloor: string): WalkStart | null {
  const band = world.bands.find((b) => b.farFloor?.id === fromFloor);
  const ramp = band?.ramps[0];
  if (!band || !ramp) return null;
  const len = Math.hypot(ramp.b[0] - ramp.a[0], ramp.b[1] - ramp.a[1]) || 1;
  const ux = (ramp.b[0] - ramp.a[0]) / len;
  const uz = (ramp.b[1] - ramp.a[1]) / len;
  const heading = ((Math.atan2(-ux, uz) * 180) / Math.PI + 360) % 360; // the bearing of (-ux, -uz): away from the stair
  return { id: `twin:${band.id}`, kind: 'centre', label: '', level: band.from, x: ramp.a[0] - ux * 0.6, z: ramp.a[1] - uz * 0.6, heading_deg: heading, pitch_deg: 0, eye_m: null };
}

/** A token colour with an alpha for the minimap's fills (#rgb / #rrggbb; any other form is used as it is). */
export function withAlpha(color: string, a: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
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
/** How a mode is stored per browser: the level digits for schematic / full (the stored values of before), names otherwise. */
const storedMode = (m: QualityMode): string => (m === 'schematic' ? '1' : m === 'full' ? '2' : m);

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
  /** What the framing belongs to - the floor the screen shows (T087 tuning, 0.1.89 list). A change re-applies the preset
   * with the next description, so a floor switched while in 3D is framed on its own extent instead of keeping the previous
   * floor's camera; a live state push keeps the key and never moves the camera. Unset: framed once per mount. */
  @property() frameKey: string | null = null;
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
  /** CR-029 S4: the host can build a description with the walk world (it listens to `walk-change`): the "סיור" button shows. */
  @property({ type: Boolean }) walkable = false;
  /** The walk: off, asked of the host (waiting for a description with `walk`), or on. */
  @state() private walkState: 'off' | 'requested' | 'on' = 'off';
  /** The walk's numbers for the walk bar (x, z, heading, level), refreshed at most ~8 times a second. */
  @state() private walkShown: { x: number; z: number; heading: number; level: string } | null = null;
  /** The device under the crosshair within WALK_ACT_M (the hint "<name> · Enter"). */
  @state() private walkAim: SceneHit | null = null;
  /** A short walk message (a closed door, the edge of the plan, the room entered) and its tone. */
  @state() private walkNote: { text: string; tone: 'info' | 'warn' } | null = null;
  /** A stair to another floor reached its top: the "continue to the floor" prompt. */
  @state() private crossFloor: { id: string; name: string | null } | null = null;
  /** The person's look dials (eye height, mouse mode, motion; api/plan-view.ts) - the defaults until they load. */
  private viewDials: PlanViewDials = { ...DEFAULT_VIEW };
  private walk: WalkSession | null = null;
  private walkNoteTimer = 0;
  private walkShownAt = 0;
  private walkAimAt = 0;
  private minimapFrame: MinimapFrame | null = null;
  /** The floor the walk came from (a stair's "continue to the floor"): the walk resumes at the twin stair of the new floor. */
  private walkArrivedFrom: string | null = null;
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
  /** The viewer's stored mode for this browser (null = the person's / installation's `plan.view.quality` dial). A chosen
   * rung sticks: the probe never lowers it (owner 2026-10-10), it only offers the hint. */
  @state() private chosen: QualityMode | null = asMode(readStore('local', QUALITY_KEY));
  /** The installation's mode (plan.quality: auto | 2 | 1). */
  @state() private installMode: QualityMode | null = null;
  /** The `auto` mode's session fallback: the rung the probe lowered it to (null = none). */
  @state() private fallbackRung: Rung | null = asMode(readStore('session', FALLBACK_KEY)) as Rung | null;
  /** A chosen rung is slow on this device: the one-tap "switch to simpler" hint (never an automatic change). */
  @state() private perfHint: Rung | null = null;
  /** The walk guard's session flag (plan.view walk_guard): the rung the walk draws at after it ran under 24 fps. */
  @state() private walkDrop: Rung | null = asMode(readStore('session', WALK_GUARD_KEY)) as Rung | null;
  /** The person's look dials arrived (the mode default, the style, the furniture, ...). */
  @state() private dialsReady = false;
  /** CR-029 S2: the time of day - the site clock, or the slider (hour of the local day, 0..24) on a local date. */
  @state() private timeManual: { hour: number; ymd: [number, number, number] } | null = null;
  @state() private timeOpen = false;
  @state() private sunShown: { hour: number; band: string; elevation: number } | null = null;
  private site = { latitude: DEFAULT_SITE.latitude as number, longitude: DEFAULT_SITE.longitude as number, zone: 'Asia/Jerusalem', known: false };
  private clockTimer = 0;
  private themeObserver?: MutationObserver;
  /** K88 3D round 2: night mode (dark sky, a moon instead of the sun, the lit rooms glow) - the viewer's choice, stored. */
  @state() private night = readStore('local', NIGHT_KEY) === '1';
  private toastTimer = 0;
  @query('.stage') private stage!: HTMLDivElement;
  private view: SceneView | null = null;
  private ro?: ResizeObserver;
  private barRo?: ResizeObserver;
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
    /* K88 night mode: a night sky whatever the theme (the dark theme's own sky tokens are its night) */
    :host([data-night]) {
      background: linear-gradient(180deg, #060b18 0%, #152442 100%);
    }
    :host([data-night]) .bar,
    :host([data-night]) .strip {
      background: color-mix(in srgb, #0f1729 80%, transparent);
      color: #dfe7f5;
    }
    /* CR-029 S1 / S2, level 3: the sky behind the canvas follows the sun and the style (the element sets the stops), the
       canvas carries the style's grade and the vignette (LOOK_SPEC section 1, G2) */
    :host([data-quality='3']) {
      background: linear-gradient(180deg, var(--sky-top, #cfdff2) 0%, var(--sky-hor, #eef3f9) 62%, var(--sky-bot, #d4d8dd) 100%);
    }
    :host([data-quality='3']) .stage canvas {
      filter: contrast(1.06) saturate(1.05);
    }
    :host([data-quality='3'][data-style='dark']) .stage canvas {
      filter: contrast(1.08);
    }
    .vignette {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: radial-gradient(ellipse at center, transparent 45%, rgba(20, 24, 32, 0.32) 100%);
    }
    :host([data-style='dark']) .vignette {
      background: radial-gradient(ellipse at center, transparent 45%, rgba(0, 0, 0, 0.4) 100%);
    }
    .timepill {
      position: absolute;
      inset-block-start: 12px;
      inset-inline-end: 12px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--sw-surface) 78%, transparent);
      border: 1px solid color-mix(in srgb, var(--sw-surface) 60%, transparent);
      backdrop-filter: blur(14px);
      box-shadow: 0 8px 24px rgba(17, 24, 39, 0.1);
      direction: rtl;
    }
    .timepill button {
      font: inherit;
      border: 0;
      background: transparent;
      color: var(--sw-text);
      border-radius: 999px;
      padding: 4px 10px;
      cursor: pointer;
    }
    .timepill .tp .hh {
      font-size: 14px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      direction: ltr;
      display: inline-block;
    }
    .timepill .now {
      font-size: var(--sw-fs-xs);
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .timepop {
      position: absolute;
      inset-block-start: 52px;
      inset-inline-end: 12px;
      z-index: var(--sw-z-map-ui);
      display: grid;
      gap: 6px;
      inline-size: min(280px, calc(100% - 24px));
      padding: 10px 12px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--sw-surface) 86%, transparent);
      border: 1px solid var(--sw-border);
      backdrop-filter: blur(14px);
      box-shadow: 0 8px 24px rgba(17, 24, 39, 0.1);
      direction: rtl;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .timepop input[type='range'] {
      inline-size: 100%;
      direction: ltr;
    }
    .timepop .row {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }
    .timepop input[type='date'] {
      font: inherit;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      padding: 2px 6px;
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    .timepop .muted {
      color: var(--sw-text-3);
    }
    .pill.hint {
      inset-block-start: 56px;
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .pill.hint .x {
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
      font: inherit;
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
      inset-block-end: max(52px, calc(20px + var(--bar-h, 0px)));
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
    /* CR-029 S4, the walk: a crosshair, the minimap in the top start corner, one floating walk bar, short notes */
    .cross {
      position: absolute;
      left: 50%;
      top: 50%;
      inline-size: 12px;
      block-size: 12px;
      margin: -6px 0 0 -6px;
      border: 2px solid color-mix(in srgb, var(--sw-surface) 85%, transparent);
      border-radius: 50%;
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--sw-text) 35%, transparent);
      pointer-events: none;
      transition: transform 120ms ease;
    }
    .cross[data-aim] {
      transform: scale(1.5);
      border-color: var(--sw-map-lit);
    }
    .aim {
      position: absolute;
      left: 50%;
      top: calc(50% + 18px);
      transform: translateX(-50%);
      pointer-events: none;
    }
    .minimap {
      position: absolute;
      inset-block-start: 12px;
      inset-inline-start: 12px;
      inline-size: 160px;
      block-size: 160px;
      border-radius: 10px;
      box-shadow: var(--sw-shadow-1);
      cursor: pointer;
      z-index: var(--sw-z-map-ui);
    }
    .walkbar {
      position: absolute;
      inset-block-end: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: var(--sw-z-map-ui);
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--sw-surface) 82%, transparent);
      border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-1);
      backdrop-filter: blur(14px);
      direction: rtl;
      max-inline-size: calc(100% - 24px);
      overflow-x: auto;
    }
    .walkbar label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .walkbar input {
      inline-size: 58px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      padding: 3px 6px;
      background: var(--sw-surface);
      color: var(--sw-text);
      direction: ltr;
    }
    .walkbar select {
      font: inherit;
      font-size: var(--sw-fs-xs);
      border: 1px solid var(--sw-border-strong);
      border-radius: 999px;
      padding: 4px 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
      max-inline-size: 170px;
    }
    .pill {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      z-index: var(--sw-z-map-ui);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 4px 12px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-1);
      direction: rtl;
      white-space: nowrap;
    }
    .pill.walknote {
      inset-block-end: 64px;
    }
    .pill.walknote[data-tone='warn'] {
      color: var(--sw-danger);
    }
    .pill.cross-floor {
      inset-block-start: 12px;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    :host([data-walk]) .bar,
    :host([data-walk]) .strip {
      display: none;
    }
    @media (max-width: 640px) {
      .walkbar .num {
        display: none;
      }
      .minimap {
        inline-size: 112px;
        block-size: 112px;
      }
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
        inset-block-end: max(44px, calc(12px + var(--bar-h, 0px)));
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
    this.watchBar();
    this.init();
  }

  /** The bar wraps and grows on a phone (touch-sized controls): the thumbnail strip stands on top of it, so the bar's real
   * height goes to the strip as --bar-h (the strip never sits under a wrapped bar row). */
  private watchBar(): void {
    const bar = this.renderRoot.querySelector<HTMLElement>('.bar');
    if (!bar || typeof ResizeObserver === 'undefined') return;
    this.barRo?.disconnect();
    this.barRo = new ResizeObserver(() => {
      const h = Math.ceil(bar.getBoundingClientRect().height);
      if (h > 0) this.style.setProperty('--bar-h', `${h}px`);
    });
    this.barRo.observe(bar);
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && !this.view) this.init(); // moved in the DOM: the canvas was disposed on the way out
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.clearInterval(this.clockTimer);
    this.themeObserver?.disconnect();
    this.themeObserver = undefined;
    this.realisticNotified = null;
    this.ro?.disconnect();
    this.barRo?.disconnect();
    cancelAnimationFrame(this.thumbPass);
    this.thumbPass = 0;
    this.endProbe(false);
    this.probed = false;
    this.probePending = false;
    this.stopWalk(false);
    window.clearTimeout(this.walkNoteTimer);
    this.view?.dispose();
    this.view = null;
    this.applied = null;
    this.thumbs.clear();
    this.thumbsFor = null;
    window.clearTimeout(this.toastTimer);
  }

  /** The mode in force: this browser's choice, else the person's / installation's dial (auto or a fixed rung). */
  get mode(): QualityMode {
    // this browser / the person's choice <- the plan.view dial when fixed <- the installation's plan.quality mode (auto / 2 / 1,
    // pilot/PLANMODE-sticky-quality) <- auto
    const dial = this.dialsReady && this.viewDials.quality !== 'auto' ? this.viewDials.quality : null;
    const host = this.qualityDefault !== null ? levelRung(this.qualityDefault) : null;
    return this.chosen ?? dial ?? host ?? this.installMode ?? 'auto';
  }

  /** Where `auto` starts: realistic when the person's default view is realistic, else the installation's plan.quality. */
  private get autoStartRung(): Rung {
    // auto = full, dropping on a sustained low rate (the hotfix's rule); realistic when the person's default view is realistic
    return autoStart(this.viewDials.default_view, 2);
  }

  /** The rung that draws (quality-ladder.drawnRung): a chosen rung as it is; `auto` from its start, or its fallback. */
  get rung(): Rung {
    const r = drawnRung(this.mode, this.autoStartRung, this.fallbackRung);
    // the walk's own guard (dial walk_guard, a session flag apart from the auto fallback): lower only while walking
    const w = this.walkDrop;
    return this.walkState === 'on' && w && RUNGS.indexOf(w) > RUNGS.indexOf(r) ? w : r;
  }

  /** The level that draws (1 schematic, 2 full, 3 realistic / lite). */
  get quality(): QualityLevel {
    return rungLevel(this.rung);
  }

  /** The `auto` mode fell back this session (the note says so). */
  private get fallback(): boolean {
    return this.mode === 'auto' && this.fallbackRung !== null && this.rung === this.fallbackRung;
  }

  private init(): void {
    // the installation default when neither the viewer nor the host chose: one build at the right level, no rebuild
    // when the settings land (the cached settings answer at once; a first fetch takes the round trip)
    if (!this.settingsAsked) {
      this.settingsAsked = true;
      // the installation's level, the site (latitude / longitude / zone for the sun, CR-029 S2) and the person's look
      // dials, read once before the first build; unavailable or not answered within SETTINGS_WAIT_MS: the defaults
      const settings = withTimeout(productSettings().then((s) => s as unknown as Record<string, unknown>), SETTINGS_WAIT_MS, {} as Record<string, unknown>).catch(() => ({}) as Record<string, unknown>);
      const dials = withTimeout(planViewPrefs().then((p) => p.effective), SETTINGS_WAIT_MS, { ...DEFAULT_VIEW }).catch(() => ({ ...DEFAULT_VIEW }));
      void Promise.all([settings, dials])
        .then(([s, d]) => {
          // the installation's mode; a settings answer without the key (the static demo) = schematic (the hotfix's rule)
          this.installMode = asMode(s['plan.quality']) ?? 'schematic';
          const lat = Number(s['site.latitude']);
          const lon = Number(s['site.longitude']);
          const known = s['site.latitude'] !== null && s['site.latitude'] !== undefined && Number.isFinite(lat) && Number.isFinite(lon);
          this.site = { latitude: known ? lat : DEFAULT_SITE.latitude, longitude: known ? lon : DEFAULT_SITE.longitude, zone: typeof s['time.zone'] === 'string' && s['time.zone'] ? (s['time.zone'] as string) : 'Asia/Jerusalem', known };
          this.viewDials = d;
          this.dialsReady = true;
        })
        .finally(() => { if (this.isConnected && !this.view) this.init(); });
      return;
    }
    try {
      this.view = new SceneView({
        mount: this.stage,
        color: (token) => getComputedStyle(this).getPropertyValue(`--sw-${token}`).trim() || '#888888',
        onSelect: (hit, x, y) => this.onViewSelect(hit, x, y),
        onHover: (hit, x, y) => this.setHover(hit, x, y),
        onFrame: (frames, fps) => {
          this.setAttribute('data-frames', String(frames));
          this.setAttribute('data-fps', String(fps));
          this.onProbeFrame(frames);
        },
        onDraw: () => this.layoutOverlays(),
        onAsset: () => this.setAttribute('data-real-pending', String(this.view?.realPending ?? 0)),
        quality: this.quality,
        night: this.night,
        real: this.realSettings(),
      });
      this.toggleAttribute('data-night', this.night);
    } catch (err) {
      console.warn('sw-plan-3d: WebGL failed to start', err);
      this.error = WEBGL_UNAVAILABLE_HE;
      return;
    }
    this.view.setContinuous(this.continuous);
    this.view.setRealSettings({ dprCap: this.viewDials.dpr_cap, motion: this.viewDials.motion });
    this.applySun();
    this.startClock();
    this.watchTheme();
    this.notifyRealistic();
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
    if (!(changed.has('description') || changed.has('activeLevel') || changed.has('selectedId') || (changed as Map<string, unknown>).has('hover') || (changed as Map<string, unknown>).has('walkState'))) return;
    const parts = this.description?.parts ?? [];
    const chips = parts.filter((p) => p.kind === 'chip');
    let pills = parts.filter((p) => p.kind === 'entity' && (!this.activeLevel || p.level_id === this.activeLevel));
    this.hiddenPills = 0;
    if (this.walkState === 'on') {
      // the walk shows no pill cloud at eye level (CR-029 section 4.6): only the selected and the hovered entity
      pills = pills.filter((p) => p.userData.id === this.selectedId || p.userData.id === this.hover?.id);
    } else if (pills.length > PILL_CAP) {
      const keep = pills.filter((p) => p.userData.id === this.selectedId || p.userData.id === this.hover?.id || p.color !== 'text-3');
      this.hiddenPills = pills.length - keep.length;
      pills = keep;
    }
    this.overlays = [...chips, ...pills];
    this.overlayById = new Map(this.overlays.map((p) => [p.id, p]));
  }

  protected updated(changed: PropertyValues<this>): void {
    if (!this.view) return;
    const reframe = changed.has('frameKey') && changed.get('frameKey') !== undefined;
    if (reframe) this.presetApplied = false;
    // the walk went on to another floor (a stair's "continue"): it resumes there at the twin stair, once the new world arrives
    if (reframe && this.walkState === 'on') this.walkArrivedFrom = String(changed.get('frameKey') ?? '');
    if (changed.has('description') && this.description) this.apply(this.description);
    if (changed.has('description')) this.syncWalk();
    if (reframe && !this.presetApplied && this.applied) this.frame(); // the key changed without a new description object
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
    if (!this.presetApplied) this.frame();
    this.view?.setSelected(this.selectedId);
    if (probes(this.rung) && !this.probed) this.startProbe(); // once per mount: a live state push is not a new device
  }

  /** The realistic level's dials for the view (the rung, the style by the theme, the content, the cut). */
  private realSettings() {
    return { rung: this.rung === 'realistic' ? ('realistic' as const) : ('lite' as const), style: styleFor(this.viewDials.style, this.uiTheme()), furniture: this.viewDials.furniture, textures: this.viewDials.textures, sectionCut: this.viewDials.section_cut };
  }

  private uiTheme(): 'light' | 'dark' {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  /** The UI theme changed: the `auto` style follows it (a re-tint, no rebuild). */
  private watchTheme(): void {
    if (this.themeObserver || typeof MutationObserver === 'undefined') return;
    this.themeObserver = new MutationObserver(() => {
      this.view?.setRealSettings({ style: this.realSettings().style });
      this.applySun();
      this.requestUpdate();
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  private realisticNotified: boolean | null = null;
  /** Tell the host whether the description should carry the realistic part (level 3 draws). */
  private notifyRealistic(): void {
    const on = this.quality === 3;
    if (on === this.realisticNotified) return;
    this.realisticNotified = on;
    this.dispatchEvent(new CustomEvent<RealisticChangeDetail>('realistic-change', { detail: { on }, bubbles: true, composed: true }));
  }

  /** The view follows the drawn rung; a rung above schematic starts the probe, schematic ends it. */
  private applyQuality(): void {
    const q = this.quality;
    const r = this.rung;
    this.setAttribute('data-quality', String(q));
    this.setAttribute('data-rung', r);
    this.setAttribute('data-quality-mode', this.mode);
    if (!this.view) return;
    const realRung = r === 'realistic' ? 'realistic' : 'lite';
    const same = this.view.getQuality() === q && (q !== 3 || this.view.getRealSettings().rung === realRung);
    this.view.setRealSettings({ rung: realRung });
    if (same) return;
    this.view.setQuality(q);
    this.thumbs.clear(); // the strip follows the materials of the level
    this.probed = false;
    this.notifyRealistic();
    this.applySun();
    if (probes(r) && this.applied) this.startProbe();
    else this.endProbe(false);
    this.requestUpdate();
  }

  // ---- the time of day (CR-029 S2): the site clock, or the slider; the sun follows

  /** The instant the sun is drawn for: the site clock now, or the slider's local hour on its local date. */
  private sunInstant(): number {
    const t = this.timeManual;
    if (!t) return Date.now();
    return siteInstant(t.ymd[0], t.ymd[1], t.ymd[2], t.hour, this.site.zone);
  }

  private applySun(): void {
    const view = this.view;
    if (!view) return;
    const utcMs = this.sunInstant();
    view.setSun({ utcMs, latitude: this.site.latitude, longitude: this.site.longitude });
    const st = view.sunState();
    if (this.quality === 3 && st) {
      const l = siteLocal(utcMs, this.site.zone);
      this.sunShown = { hour: l.hour + l.minute / 60, band: timeBand(st.elevation), elevation: Math.round(st.elevation) };
      const [top, hor, bot] = view.skyBackdrop();
      this.style.setProperty('--sky-top', top);
      this.style.setProperty('--sky-hor', hor);
      this.style.setProperty('--sky-bot', bot);
      this.setAttribute('data-sun-elevation', String(Math.round(st.elevation)));
      this.setAttribute('data-style', view.getRealSettings().style);
    } else this.sunShown = null;
  }

  private startClock(): void {
    window.clearInterval(this.clockTimer);
    if (this.viewDials.time_source === 'manual' && !this.timeManual) this.setTimeHour(siteLocal(Date.now(), this.site.zone).hour);
    this.clockTimer = window.setInterval(() => { if (!this.timeManual && this.quality === 3) this.applySun(); }, CLOCK_TICK_MS);
  }

  /** The slider: a local hour (0..24) on the shown date (today by the site clock unless a date was picked). */
  setTimeHour(hour: number): void {
    const today = siteLocal(Date.now(), this.site.zone);
    const ymd = this.timeManual?.ymd ?? ([today.year, today.month, today.day] as [number, number, number]);
    this.timeManual = { hour: Math.max(0, Math.min(24, hour)), ymd };
    this.applySun();
  }

  private setTimeDate(v: string): void {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return;
    const hour = this.timeManual?.hour ?? this.sunShown?.hour ?? 12;
    this.timeManual = { hour, ymd: [Number(m[1]), Number(m[2]), Number(m[3])] };
    this.applySun();
  }

  /** "עכשיו": back to the site clock. */
  timeNow(): void {
    this.timeManual = null;
    this.applySun();
  }

  /** K88: night mode on / off for this browser (stored); the strip's thumbnails follow. */
  setNight(on: boolean): void {
    if (on === this.night) return;
    this.night = on;
    writeStore('local', NIGHT_KEY, on ? '1' : null);
    this.toggleAttribute('data-night', on);
    this.view?.setNight(on);
    this.thumbs.clear();
    this.requestUpdate();
  }

  get isNight(): boolean {
    return this.night;
  }

  /** The viewer's choice for this browser (the chips; legacy levels 1 / 2 = schematic / full). */
  setQuality(q: QualityLevel): void {
    this.setMode(levelRung(q));
  }

  /** The viewer's mode for this browser (a chip, or the hint's one tap): stored; a new choice clears the session's
   * fallback and the hint and measures afresh. A chosen rung is never lowered automatically (owner 2026-10-10). */
  setMode(m: QualityMode): void {
    this.chosen = m;
    writeStore('local', QUALITY_KEY, storedMode(m));
    this.fallbackRung = null;
    this.perfHint = null;
    this.walkDrop = null;
    writeStore('session', FALLBACK_KEY, null);
    writeStore('session', WALK_GUARD_KEY, null);
    this.probed = false;
  }

  /** The probe's result: `auto` lowers one rung for the session; a chosen rung only offers the hint. */
  private verdict(fps: number): void {
    const v = probeVerdict(this.mode, this.rung, fps, this.minFps);
    if (v.fallback) {
      this.fallbackRung = v.fallback;
      writeStore('session', FALLBACK_KEY, storedMode(v.fallback));
    } else if (v.hint) this.perfHint = v.hint;
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
    this.verdict(fps);
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
      this.verdict(fps);
    }
  }

  private onVisibility = (): void => {
    if (document.hidden) {
      if (this.probe) {
        this.endProbe(false);
        this.probePending = true;
      }
    } else if (this.probePending && probes(this.rung) && this.view) this.startProbe();
  };

  /** Frame the current description with the screen's preset; a camera preset whose camera is not in this description
   * (another floor's camera) frames the isometric overview instead of leaving the previous floor's view. */
  private frame(): void {
    this.presetApplied = true;
    if (this.view?.setPreset(this.preset)) this.setAttribute('data-preset', typeof this.preset === 'string' ? this.preset : 'camera');
    else if (this.view?.setPreset('iso')) this.setAttribute('data-preset', 'iso');
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

  // ---- the eye-level walk (CR-029 S4): a WalkSession drives the eye; the description carries the walk world

  /** "סיור": walk now when the description already carries the walk world, else ask the host for one (`walk-change`). */
  requestWalk(): void {
    if (this.walkState !== 'off' || !this.view) return;
    this.walkState = 'requested';
    if (this.description?.walk) this.startWalk();
    else this.dispatchEvent(new CustomEvent<WalkChangeDetail>('walk-change', { detail: { on: true }, bubbles: true, composed: true }));
  }

  /** A new description: the walk starts when its world arrived, follows a new world (a door opened, a level filter), and
   * ends when the host stopped sending one. */
  private syncWalk(): void {
    const world = this.description?.walk;
    if (this.walkState === 'requested' && world) this.startWalk();
    else if (this.walkState === 'on') {
      if (!world) this.stopWalk(true);
      else if (this.walkArrivedFrom !== null && world !== this.walk?.ctrl.world) {
        const from = this.walkArrivedFrom;
        this.walkArrivedFrom = null;
        this.startWalk(twinStart(world, from) ?? undefined);
      } else this.walk?.setWorld(world);
    }
  }

  get walking(): boolean {
    return this.walkState === 'on';
  }

  /** The walk's controller (tests drive it: a scripted walk in the browser must equal the node model). */
  get walkController(): WalkSession['ctrl'] | null {
    return this.walk?.ctrl ?? null;
  }

  private walkFov(): number {
    const portrait = this.clientHeight > this.clientWidth * 1.15;
    if (portrait) return WALK_FOV.portrait;
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    return touch ? WALK_FOV.touch : WALK_FOV.desktop;
  }

  /** Start the walk at `start` (default: the world's default start). */
  startWalk(start?: WalkStart): void {
    const world = this.description?.walk;
    const view = this.view;
    if (!world || !view) {
      this.walkState = 'off';
      return;
    }
    this.walk?.dispose();
    const first = start ?? world.starts.find((s) => s.id === world.defaultStart) ?? world.starts[0] ?? null;
    this.walk = new WalkSession(world, {
      canvas: view.renderer.domElement,
      onPose: () => this.onWalkPose(),
      onEvents: (e) => this.onWalkEvents(e),
      onExit: () => this.stopWalk(true),
      onAct: () => this.walkAct(),
      onLowFps: () => this.onWalkLowFps(),
    }, { eye_m: this.viewDials.eye_m, mouseMode: this.viewDials.mouse_mode, start: first });
    view.enterWalk(this.walkCameraPose(), this.walkFov(), this.viewDials.motion ? WALK_ENTRY_MS : 0);
    this.endProbe(false); // the walk keeps its own frame floor (section 3.4)
    this.walkState = 'on';
    this.crossFloor = null;
    this.setAttribute('data-walk', '');
    this.setAttribute('data-walk-level', this.walk.ctrl.level);
    void this.updateComplete.then(() => this.onWalkPose(true));
  }

  /** Leave the walk (Esc, the exit button, a host that stopped sending the world); `notify` tells the host. */
  stopWalk(notify: boolean): void {
    if (this.walkState === 'off') return;
    this.walk?.dispose();
    this.walk = null;
    this.view?.exitWalk();
    this.walkState = 'off';
    this.walkShown = null;
    this.walkAim = null;
    this.crossFloor = null;
    this.minimapFrame = null;
    this.removeAttribute('data-walk');
    this.removeAttribute('data-walk-pos');
    this.removeAttribute('data-walk-level');
    if (notify) this.dispatchEvent(new CustomEvent<WalkChangeDetail>('walk-change', { detail: { on: false }, bubbles: true, composed: true }));
  }

  private walkCameraPose(): { x: number; y: number; z: number; heading_deg: number; pitch_deg: number } {
    const p = this.walk!.ctrl.pose();
    return { x: p.x, y: p.y, z: p.z, heading_deg: p.heading_deg, pitch_deg: p.pitch_deg };
  }

  private onWalkPose(force = false): void {
    const w = this.walk;
    const view = this.view;
    if (!w || !view) return;
    const p = w.ctrl.pose();
    view.setWalkPose(p);
    this.drawWalkMinimap();
    this.setAttribute('data-walk-pos', `${p.x.toFixed(2)},${p.z.toFixed(2)},${p.heading_deg.toFixed(1)}`);
    const now = performance.now();
    if (force || now - this.walkShownAt > 120) {
      this.walkShownAt = now;
      this.walkShown = { x: p.x, z: p.z, heading: Math.round(p.heading_deg), level: p.level };
    }
    if (force || now - this.walkAimAt > 150) {
      this.walkAimAt = now;
      requestAnimationFrame(() => {
        if (!this.walk || !this.view) return;
        const hit = this.view.pickCentre(WALK_ACT_M);
        const aim = hit && ['entity', 'camera', 'object', 'opening'].includes(hit.kind) ? hit : null;
        if (aim?.partId !== this.walkAim?.partId) this.walkAim = aim;
      });
    }
  }

  private onWalkEvents(events: WalkEvent[]): void {
    for (const e of events) {
      if (e.type === 'level') {
        this.setAttribute('data-walk-level', e.level);
        // the 2D, the strip and the chips follow the level only when a level is shown on its own (all levels: they agree)
        if (this.activeLevel !== null && this.activeLevel !== e.level) this.dispatchEvent(new CustomEvent<LevelSelectDetail>('level-select', { detail: { id: e.level }, bubbles: true, composed: true }));
      } else if (e.type === 'cross-floor') this.crossFloor = e.floor;
      else if (e.type === 'blocked') this.walkMessage(`הדלת ${DOOR_STATE_HE[e.door.state]}`, 'warn');
      else if (e.type === 'edge') this.walkMessage('קצה התוכנית', 'info');
      else if (e.type === 'room') {
        // LOOK_SPEC section 3: the room's daylight factor drives the walk's interior fill (level 3)
        this.view?.setInterior(e.room ? this.description?.real?.rooms[e.room.id]?.daylight ?? null : null);
        if (e.room?.name) this.walkMessage(e.room.name, 'info');
      }
    }
  }

  private walkMessage(text: string, tone: 'info' | 'warn'): void {
    this.walkNote = { text, tone };
    window.clearTimeout(this.walkNoteTimer);
    this.walkNoteTimer = window.setTimeout(() => (this.walkNote = null), WALK_TOAST_MS);
  }

  /** Enter: the device under the crosshair opens its card (the existing action path; the walk adds none). */
  private walkAct(): void {
    const hit = this.view?.pickCentre(WALK_ACT_M) ?? null;
    if (hit) this.emitSelect(hit);
  }

  /** The walk ran under its floor (24 fps, section 3.4): in `auto` one rung down in place, for the session (never to
   * stills: a still cannot be walked); a chosen rung stays and the hint offers the simpler one. */
  private onWalkLowFps(): void {
    const down = nextDown(this.rung);
    if (!down) return;
    if (this.viewDials.walk_guard) {
      this.walkDrop = down;
      writeStore('session', WALK_GUARD_KEY, storedMode(down));
      this.walkMessage(`הסיור עבר ל${RUNG_HE[down]} — קצב הפריימים היה נמוך`, 'info');
    } else this.perfHint = down;
  }
  /** A click on the view: in the walk a device opens its card and the floor is a walk there (tap-to-walk); in pointer lock
   * the click acts on the crosshair. Outside the walk: the existing selection. */
  private onViewSelect(hit: SceneHit | null, x?: number, y?: number): void {
    const w = this.walk;
    if (this.walkState !== 'on' || !w) {
      this.emitSelect(hit);
      return;
    }
    if (w.pointerLocked) {
      const aim = this.view?.pickCentre(WALK_ACT_M) ?? null;
      if (aim) this.emitSelect(aim);
      return;
    }
    if (hit && hit.kind !== 'zone') {
      this.emitSelect(hit);
      return;
    }
    if (x === undefined || y === undefined) return;
    const pt = this.view?.floorPoint(x, y, w.ctrl.pose().ground);
    if (pt && !w.walkTo(pt[0], pt[1])) this.walkMessage('אין דרך פתוחה לשם', 'warn');
  }

  private drawWalkMinimap(): void {
    const cv = this.renderRoot.querySelector<HTMLCanvasElement>('canvas.minimap');
    const w = this.walk;
    const world = this.description?.walk;
    if (!cv || !w || !world) return;
    const size = cv.clientWidth || 160;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(size * dpr)) {
      cv.width = Math.round(size * dpr);
      cv.height = Math.round(size * dpr);
    }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(this);
    const tok = (t: string, fallback: string): string => css.getPropertyValue(`--sw-${t}`).trim() || fallback;
    const accent = tok('accent', '#2767ed');
    this.minimapFrame = drawMinimap(ctx, world, w.ctrl.pose(), w.ctrl.path, size, {
      bg: tok('surface', '#ffffff'), wall: tok('map-structure', '#56617a'), low: tok('map-wall', '#9aa3b5'), window: tok('map-glass', '#7fb2ff'),
      doorOpen: tok('live', '#22c55e'), doorClosed: tok('danger', '#ef4444'), object: tok('text-3', '#9aa3b5'), stair: tok('text-2', '#6b7f99'),
      room: withAlpha(accent, 0.07), path: tok('live', '#22c55e'), me: accent, meRing: withAlpha(accent, 0.25),
    });
  }

  private onMinimapClick(e: MouseEvent): void {
    const f = this.minimapFrame;
    const w = this.walk;
    if (!f || !w) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const [x, z] = f.toM(e.clientX - rect.left, e.clientY - rect.top);
    w.goTo({ id: 'minimap', kind: 'centre', label: '', level: w.ctrl.level, x, z, heading_deg: w.ctrl.heading, pitch_deg: w.ctrl.pitch, eye_m: null });
  }

  /** The numeric walk fields (x, y in metres on the plan's axes, the heading in degrees): a keyboard alternative to every move. */
  private onWalkField(key: 'x' | 'z' | 'heading', e: Event): void {
    const w = this.walk;
    const v = Number((e.target as HTMLInputElement).value);
    if (!w || !Number.isFinite(v)) return;
    const c = w.ctrl;
    w.goTo({ id: 'field', kind: 'centre', label: '', level: c.level, x: key === 'x' ? v : c.x, z: key === 'z' ? v : c.z, heading_deg: key === 'heading' ? v : c.heading, pitch_deg: c.pitch, eye_m: null });
  }

  private onWalkStart(e: Event): void {
    const sel = e.target as HTMLSelectElement;
    const s = this.description?.walk?.starts.find((q) => q.id === sel.value);
    sel.value = '';
    if (s) this.walk?.goTo(s);
  }

  private renderWalk() {
    if (this.walkState !== 'on' || !this.walk) return nothing;
    const starts = this.description?.walk?.starts ?? [];
    const kinds = ['saved', 'door', 'room', 'camera', 'centre'].filter((k) => starts.some((s) => s.kind === k));
    const s = this.walkShown;
    return html`
      <canvas class="minimap" data-walk-minimap role="img" aria-label="מפה קטנה של המפלס; לחיצה מעבירה לנקודה" @click=${(e: MouseEvent) => this.onMinimapClick(e)}></canvas>
      <span class="cross" ?data-aim=${!!this.walkAim} aria-hidden="true"></span>
      ${this.walkAim ? html`<span class="pill aim" data-walk-aim>${this.labelOf(this.walkAim)} · Enter</span>` : nothing}
      ${this.walkNote ? html`<span class="pill walknote" role="status" data-tone=${this.walkNote.tone} data-walk-note>${this.walkNote.text}</span>` : nothing}
      ${this.crossFloor
        ? html`<span class="pill cross-floor" role="status" data-walk-cross=${this.crossFloor.id}>המדרגות ממשיכות ל${this.crossFloor.name ?? 'קומה אחרת'}
            <sw-button size="sm" variant="ghost" data-walk-cross-go @click=${() => this.dispatchEvent(new CustomEvent<FloorRequestDetail>('floor-request', { detail: { floorId: this.crossFloor!.id }, bubbles: true, composed: true }))}>המשך לקומה</sw-button></span>`
        : nothing}
      <div class="walkbar" role="group" aria-label="סיור בגובה עין" data-walk-bar>
        <sw-button size="sm" variant="ghost" data-walk-exit @click=${() => this.stopWalk(true)}>יציאה</sw-button>
        <select data-walk-start aria-label="עמוד ב…" @change=${(e: Event) => this.onWalkStart(e)}>
          <option value="">עמוד ב…</option>
          ${kinds.map((k) => html`<optgroup label=${START_KIND_HE[k]}>${starts.filter((q) => q.kind === k).map((q) => html`<option value=${q.id}>${q.label || START_KIND_HE[k]}</option>`)}</optgroup>`)}
        </select>
        ${s
          ? html`<label class="num">x <input type="number" step="0.1" inputmode="decimal" data-walk-x aria-label="x במטרים" .value=${s.x.toFixed(2)} @change=${(e: Event) => this.onWalkField('x', e)} /></label>
              <label class="num">y <input type="number" step="0.1" inputmode="decimal" data-walk-y aria-label="y במטרים" .value=${s.z.toFixed(2)} @change=${(e: Event) => this.onWalkField('z', e)} /></label>
              <label class="num">כיוון <input type="number" step="5" inputmode="numeric" data-walk-heading aria-label="כיוון במעלות" .value=${String(s.heading)} @change=${(e: Event) => this.onWalkField('heading', e)} /></label>`
          : nothing}
      </div>`;
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

  /** The control image of a floor skin (CR-006 2a): `desc` is a control description (skin-control.controlDescription)
   * drawn at level 2, isometric, CONTROL_W x CONTROL_H at pixel ratio 1 by a separate off-screen view in the one fixed
   * CONTROL_PALETTE (never the viewer's design tokens) - the view on screen, its camera and its quality are untouched.
   * PNG data URL, or null. */
  captureControl(desc: SceneDescription): string | null {
    return renderControlImage(desc, controlColor, CONTROL_W, CONTROL_H, CONTROL_BACKDROP);
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

  /** The time pill (LOOK_SPEC section 7): the band's glyph and the site's local time, "עכשיו" while the slider is in
   * use, a click opens the slider and the date. */
  private renderTime() {
    const s = this.sunShown;
    if (!s || this.walkState === 'on') return nothing;
    const glyph = s.band === 'day' ? '☀' : s.band === 'night' ? '☾' : '◐';
    const today = siteLocal(Date.now(), this.site.zone);
    const ymd = this.timeManual?.ymd ?? [today.year, today.month, today.day];
    const date = `${ymd[0]}-${String(ymd[1]).padStart(2, '0')}-${String(ymd[2]).padStart(2, '0')}`;
    return html`<div class="timepill" role="group" aria-label="שעה ביום" data-3d-time data-band=${s.band}>
        <button type="button" class="tp" aria-expanded=${this.timeOpen ? 'true' : 'false'} data-3d-time-toggle @click=${() => (this.timeOpen = !this.timeOpen)}><span aria-hidden="true">${glyph}</span> <span class="hh" data-3d-time-label>${hourLabel(s.hour)}</span></button>
        ${this.timeManual ? html`<button type="button" class="now" data-3d-time-now @click=${() => this.timeNow()}>עכשיו</button>` : nothing}
      </div>
      ${this.timeOpen
        ? html`<div class="timepop" data-3d-time-pop>
            <input type="range" min="0" max="24" step="0.25" aria-label="שעה ביום" data-3d-time-slider .value=${String(s.hour)} @input=${(e: Event) => this.setTimeHour(Number((e.target as HTMLInputElement).value))} />
            <div class="row"><input type="date" aria-label="תאריך" data-3d-time-date .value=${date} @change=${(e: Event) => this.setTimeDate((e.target as HTMLInputElement).value)} /><span>${TIME_BAND_HE[s.band as keyof typeof TIME_BAND_HE]} · שמש ${s.elevation}°</span></div>
            ${this.site.known ? nothing : html`<div class="muted" data-3d-site-default>מיקום האתר לא הוגדר: מרכז הארץ</div>`}
          </div>`
        : nothing}`;
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
      ${this.renderWalk()}
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
        <sw-chip data-quality-auto title="אוטומטי: מתחיל ברמת ברירת המחדל ויורד רמה כשהמכשיר איטי" ?selected=${this.mode === 'auto'} @click=${() => this.setMode('auto')}>אוטומטי</sw-chip>
        <sw-chip data-quality-1 title="רמה סכמטית: חומרים שטוחים, בלי צללים" ?selected=${this.mode !== 'auto' && q === 1} @click=${() => this.setQuality(1)}>סכמטי</sw-chip>
        <sw-chip data-quality-2 title="רמה מלאה: צללים רכים, חומרים, חיתוך קירות" ?selected=${this.mode !== 'auto' && q === 2} @click=${() => this.setQuality(2)}>מלא</sw-chip>
        <sw-chip data-quality-3-lite title="ריאליסטי קל: חומרים אמיתיים, שמש ושמיים, בלי האפקטים הכבדים" ?selected=${this.mode === 'lite'} @click=${() => this.setMode('lite')}>ריאליסטי קל</sw-chip>
        <sw-chip data-quality-3 title="ריאליסטי: חומרים אמיתיים, שמש לפי שעה, הצללה עדינה וזכוכית" ?selected=${this.mode === 'realistic'} @click=${() => this.setMode('realistic')}>ריאליסטי</sw-chip>
        ${q < 3 ? html`<sw-chip data-night-toggle title="מצב לילה: שמיים כהים, אור ירח, החדרים הדלוקים זוהרים" ?selected=${this.night} aria-pressed=${this.night} @click=${() => this.setNight(!this.night)}>לילה</sw-chip>` : nothing}
        ${this.walkable
          ? html`<sw-chip data-walk-btn title="סיור בגובה עין: W A S D או החצים להליכה, Shift לריצה, גרירה להסתכלות, לחיצה על הרצפה להליכה לשם, Esc ליציאה" ?selected=${this.walkState !== 'off'} @click=${() => this.requestWalk()}>${this.walkState === 'requested' ? 'טוען סיור…' : 'סיור'}</sw-chip>`
          : nothing}
        <sw-button size="sm" variant="ghost" icon="download" data-export-gltf ?disabled=${!this.ready || this.exporting} @click=${() => this.download()}>${this.exporting ? 'מייצא…' : 'ייצוא glTF'}</sw-button>
      </div>
      ${this.description?.estimated ? html`<div class="note" data-3d-estimated>≈ מידות משוערות (התוכנית לא כוילה)</div>` : nothing}
      ${this.fallback ? html`<div class="note fb" role="status" data-3d-fallback>${fallbackHe(this.rung)}</div>` : nothing}
      ${this.perfHint
        ? html`<div class="pill hint" role="status" data-3d-low-fps=${this.perfHint}>התצוגה איטית במכשיר הזה
            <sw-button size="sm" variant="ghost" data-3d-low-fps-switch @click=${() => this.setMode(this.perfHint!)}>מעבר ל${RUNG_HE[this.perfHint]}</sw-button>
            <button type="button" class="x" aria-label="סגירה" data-3d-low-fps-close @click=${() => (this.perfHint = null)}>×</button></div>`
        : nothing}
      ${q === 3 ? this.renderTime() : nothing}
      ${q === 3 ? html`<div class="vignette" aria-hidden="true"></div>` : nothing}
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
