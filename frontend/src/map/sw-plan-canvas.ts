import { LitElement, html, css, svg, nothing, type SVGTemplateResult } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import '../components/sw-button';
import { t } from '../i18n/he';
import type { StateKind } from '../components/sw-badge';
import { applyAnchorPositions, buildPrimitives, circuitToken, isClosedOutline, objectHitCorners, objectHitOrder, type AnchorPosition, type CatalogLookup, type DoorPrim, type GeometryDoc, type LabelPrim, type ConnectorPrim, type ObjectPrim, type PassagePrim, type Primitive, type Pt, type WallPrim, type WindowPrim } from './geometry';
import { candidatesDoc, type CandidateSet, type CandState } from './candidates';
import { symbolOf } from './plan-symbols';
import { CoverageCache, hasWallsOnLevel } from './coverage';
import { defaultLevelId, translatePolygon } from './studio-ops';

export type MarkerKind = 'camera' | 'lock' | 'light' | 'binary_sensor';

export interface PlanMarker {
  id: string;
  kind: MarkerKind;
  label: string;
  x: number; // normalized 0..1 in plan space (origin top-left)
  y: number;
  rotation?: number; // degrees, cameras only
  fov?: number; // degrees, cameras only
  /** Manual coverage (R2): cone radius as a fraction of the plan width (undefined = the default illustration). */
  radius?: number;
  /** Manual coverage (R2): a free polygon in normalized plan space; drawn instead of the cone. */
  polygon?: { x: number; y: number }[];
  /** R4: where the name label sits relative to the pin (auto = below). */
  labelPos?: string;
  /** T087: the level the item belongs to (null / undefined = the document's default level); the clipped coverage uses
   * the walls of that level only. */
  level?: string | null;
  state: StateKind;
}

export interface MarkerSelectDetail {
  id: string | null;
  /** Marker centre in host (stage) pixels, for anchoring a popover. */
  sx?: number;
  sy?: number;
}

const MIN_SCALE = 0.2;
/** Screen pixels: the smallest side of an object's hit area (a 0.4 m chair zoomed out is a few pixels wide - 0.1.87). */
const OBJECT_HIT_MIN_PX = 24;
/** Screen pixels: a wall's pick band on a touch screen (the mouse keeps 12). */
const WALL_HIT_TOUCH_PX = 20;
const MAX_SCALE = 6;

// Pin fill per state. Live cameras are the product's blue pin (board 1); everything else keeps a
// distinct colour AND a distinct glyph (slash, dashed ring, lock) so states never rely on colour alone.
const PIN_FILL: Partial<Record<StateKind, string>> = {
  live: 'var(--sw-accent)',
  recorded: 'var(--sw-accent)',
  historic: 'var(--sw-accent)',
  offline: 'var(--sw-offline)',
  stale: 'var(--sw-stale)',
  unknown: 'var(--sw-unknown)',
  forbidden: 'var(--sw-forbidden)',
  error: 'var(--sw-danger)',
  neutral: 'var(--sw-surface)',
  partial: 'var(--sw-stale)',
};

const MARKER_ICON: Record<MarkerKind, SVGTemplateResult> = {
  camera: svg`<path d="M-7 -4.5A1.5 1.5 0 0 1 -5.5 -6H-2l1.5-2h5L6 -6h1.5A1.5 1.5 0 0 1 9 -4.5v9A1.5 1.5 0 0 1 7.5 6h-13A1.5 1.5 0 0 1 -7 4.5z" transform="translate(-1 0) scale(0.9)"/><circle cx="-1" cy="0" r="3"/>`,
  lock: svg`<rect x="-6" y="-2" width="12" height="9" rx="2"/><path d="M-3.5 -2v-3a3.5 3.5 0 0 1 7 0v3"/>`,
  light: svg`<path d="M-3 6h6M-2 8.5h4"/><path d="M0 -8a5 5 0 0 0-3 9c.7.5 1.2 1.3 1.2 2.2h3.6c0-.9.5-1.7 1.2-2.2A5 5 0 0 0 0 -8z"/>`,
  binary_sensor: svg`<circle cx="0" cy="0" r="2"/><path d="M-4.5 -4.5a6.4 6.4 0 0 0 0 9M4.5 -4.5a6.4 6.4 0 0 1 0 9"/>`,
};

/**
 * Plan viewport: pan, zoom (wheel, buttons, pinch), markers with constant screen size, camera FOV cones.
 * Geometry is never mirrored by RTL: the host forces `direction: ltr` and coordinates are plan-space.
 * Emits `marker-select` ({id, sx, sy}) and `view-change` (after pan/zoom) so a parent can anchor a
 * popover card to the selected pin.
 */
export interface PlanZone {
  id: string;
  name: string;
  kind?: string;
  /** CSS colour of the fill / outline / label ring. */
  color: string;
  /** Normalized (0-1) polygon, origin top-left. */
  polygon: { x: number; y: number }[];
  /** R4: where the name label sits relative to the polygon (auto = centroid). */
  labelPos?: string;
  /** Detection candidate not yet saved: dashed outline. */
  candidate?: boolean;
}

/** Area-weighted polygon centroid in the polygon's own units (vertex mean for degenerate rings). */
export function polygonCentroid(poly: { x: number; y: number }[]) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < 1e-12) {
    const n = poly.length || 1;
    return { x: poly.reduce((t, p) => t + p.x, 0) / n, y: poly.reduce((t, p) => t + p.y, 0) / n };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

const ptsAttr = (ps: Pt[]): string => ps.map((p) => `${p[0]},${p[1]}`).join(' ');
/** Same anchors by value: the maps hand a fresh positions object on every render, the primitives are rebuilt only when
 * an anchor actually moved. */
const sameAnchors = (a: Record<string, AnchorPosition>, b: Record<string, AnchorPosition>): boolean => {
  if (a === b) return true;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => {
    const p = a[k];
    const q = b[k];
    return !!q && p.x === q.x && p.y === q.y && p.rotation === q.rotation;
  });
};

/** A structure drag (Plan Studio): a wall corner (`index`), a whole wall (its body, once selected - hotfix 0.1.87), an
 * opening, a label, an object (moved, rotated, stretched or duplicated with Alt) or a connector corner; the pointer now
 * (x, y) and where the press started (sx, sy), in normalized plan space - so an item keeps its offset from the pointer
 * instead of jumping - and the Shift / Alt keys held now. */
export interface GeomDragDetail {
  kind: 'vertex' | 'wall' | 'opening' | 'label' | 'object' | 'object-rotate' | 'object-stretch' | 'object-duplicate' | 'connector-vertex';
  id: string;
  /** A wall corner, a stretch edge (0 front, 1 right, 2 back, 3 left) or a connector corner. */
  index: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  shift: boolean;
  alt: boolean;
}

/** What the pointer can grab in the structure: 'all' (the structure tool's select mode, and the editor's select tool for
 * a user with the structure permission - hotfix 0.1.87) walls (the selected one by its body too), openings, labels,
 * objects, connectors and the selected item's handles; 'objects' (the library, connectors and circuits tools) objects and
 * connectors only; 'items' (the structure tool's drawing modes) the existing openings and labels only; 'none' nothing. */
export type GeomDragMode = 'all' | 'items' | 'objects' | 'none';

/** A measured segment drawn over the plan (calibration, measuring): normalized end points and a label. */
export interface RulerOverlay {
  a: Pt;
  b: Pt;
  label: string;
  tone: 'accent' | 'muted';
}

@customElement('sw-plan-canvas')
export class SwPlanCanvas extends LitElement {
  @property({ type: Number }) planWidth = 1000;
  @property({ type: Number }) planHeight = 700;
  @property({ attribute: false }) plan: SVGTemplateResult | null = null;
  @property({ attribute: false }) markers: PlanMarker[] = [];
  @property() selectedId: string | null = null;
  /** Additional highlighted markers (multi-selection); no card is anchored to them. */
  @property({ attribute: false }) selectedIds: string[] = [];
  @property({ type: Boolean }) dimEntities = false;

  @property({ type: Boolean }) alwaysLabel = false;
  /** Raster background (published plan image); drawn under `plan` when set. */
  @property() imageUrl: string | null = null;
  /** Editor mode: markers can be dragged; emits `marker-move` {id, x, y} (normalized) on drop. The selected
   * camera shows a direction handle and two field-of-view handles; dragging them emits `marker-orient`
   * {id, rotation, fov}. Bearing convention (design contract §ו): 0° = up, clockwise. */
  @property({ type: Boolean }) editable = false;
  /** Placement mode: a click on the plan (not a drag) emits `plan-click` {x, y} (normalized). */
  @property({ type: Boolean }) placing = false;
  /** Radius of the coverage cone in plan pixels (an illustration, not measured coverage). */
  @property({ type: Number }) coneRadius = 140;
  /** Named rooms / areas (design M13) drawn under the markers; a click emits `zone-select` {id}. */
  @property({ attribute: false }) zones: PlanZone[] = [];
  @property() selectedZoneId: string | null = null;
  /** The selected corner of the selected zone (Delete removes it), drawn filled among its corner handles (0.1.87). */
  @property({ attribute: false }) selectedZoneVertex: number | null = null;
  /** Show zone names at their centroids. */
  @property({ type: Boolean }) zoneLabels = true;
  /** Vertices of a polygon being drawn in the editor (normalized); rendered as a dashed outline. */
  @property({ attribute: false }) draftPoints: { x: number; y: number }[] = [];
  /** Selection mode (T043): a primary-button drag on the plan draws a rectangle and emits `box-select` with the ids
   * of the markers inside it. Shift + drag, a second finger and the wheel still pan and zoom. */
  @property({ type: Boolean }) boxSelect = false;
  /** Plan Studio (T084): the structure document, drawn between the rooms and the pins on every map. */
  @property({ attribute: false }) geometry: GeometryDoc | null = null;
  /** Show one level only (null = all levels). */
  @property() structureLevel: string | null = null;
  /** Items with a validation error, drawn in red (editor). */
  @property({ attribute: false }) issueIds: string[] = [];
  @property() selectedGeomId: string | null = null;
  /** Items drawn selected besides selectedGeomId (the members of a selected group). */
  @property({ attribute: false }) highlightIds: string[] = [];
  /** T085: the library shapes (symbol, colour) the object layer draws with; without it every object is a plain box. */
  @property({ attribute: false }) catalog: CatalogLookup | null = null;
  /** T085: the live anchors of the floor ("<type>:<id>" -> position): a bound object draws on its anchor, not where the
   * document last saw it. */
  @property({ attribute: false }) anchorPositions: Record<string, AnchorPosition> = {};
  /** T085: circuit id -> the state of its switch ("on" glows every lamp of the circuit). */
  @property({ attribute: false }) circuitStates: Record<string, string | null> = {};
  /** T085: entity id -> state, for objects bound to an entity (a lamp that is the body of a light glows on its own). */
  @property({ attribute: false }) entityStates: Record<string, string | null> = {};
  /** T085: the layer switches of the live map. `hideStructure` hides walls, openings and labels while objects or
   * connectors still draw (the phase-1 "מבנה" switch keeps hiding the walls now that the document carries more). */
  @property({ type: Boolean }) hideStructure = false;
  @property({ type: Boolean }) hideObjects = false;
  @property({ type: Boolean }) hideConnectors = false;
  /** T087 (ruling R-P4-2): a camera cone is cut by the walls of its level when the document has any; off in the
   * candidates overlay of the editor is not needed - the editor keeps it on, so what is drawn is what viewers see. */
  @property({ type: Boolean }) clipCoverage = true;
  /** The blocking segments shared by every camera and each camera's polygon, keyed on the document identity (a new
   * document object is recomputed in the same render that receives it). */
  private coverage = new CoverageCache();
  private covPoints = new Map<string, { pts: Pt[]; points: string }>();
  private primCache: { doc: GeometryDoc; w: number; h: number; level: string | null; catalog: CatalogLookup | null; anchors: Record<string, AnchorPosition>; prims: Primitive[] } | null = null;
  /** Circuit id -> its whitelisted colour token, built once per document (the object layer looks it up per lamp). */
  private circuitCache: { doc: GeometryDoc; tokens: Map<string, string> } | null = null;
  /** Plan Studio editor: what can be picked and dragged. 'all' in the structure tool's select mode; 'items' in its drawing
   * modes, where a press on an existing opening or label drags (or, without moving, selects) it and every other press
   * still goes to the tool as a `plan-click`; 'none' on viewers and in the other tools. */
  @property() geomDrag: GeomDragMode = 'none';
  /** The selected corner of the selected wall (the arrow keys move it), drawn filled among the wall's corner handles. */
  @property({ attribute: false }) selectedVertex: number | null = null;
  /** Wall mode: the editor's corner snap radius in screen pixels. A press that close to a wall corner belongs to the
   * drawing tool even on an opening or a label (the corner snap wins over the item); 0 = off. */
  @property({ type: Number }) cornerSnapPx = 0;
  /** The wall being drawn (normalized points) and the snapped cursor the editor computed (rubber band, snap dot). */
  @property({ attribute: false }) wallDraft: Pt[] = [];
  @property({ attribute: false }) hoverPoint: Pt | null = null;
  @property({ attribute: false }) rulers: RulerOverlay[] = [];
  /** Plan Studio phase 3 (T086): detection candidates, drawn dashed in a layer of their own until accepted. */
  @property({ attribute: false }) candidates: CandidateSet | null = null;
  @property({ attribute: false }) candidateStates: Record<string, CandState> = {};
  @property() selectedCandidateId: string | null = null;
  /** Desktop: the end points of the selected candidate wall can be dragged before accepting. */
  @property({ type: Boolean }) candidateEditable = false;
  @state() private candHover: string | null = null;
  @state() private candDrag: { x: number; y: number } | null = null;
  private candCache: { set: CandidateSet; doc: GeometryDoc | null; w: number; h: number; prims: Primitive[] } | null = null;
  /** The pointer during a structure drag (a small dot where the item is being taken). */
  @state() private geomDragAt: { x: number; y: number } | null = null;
  /** A press on a structure item is in progress: the placing tool gets no hover until it ends. */
  private geomPress = false;
  /** A touch screen (any coarse pointer): the wall pick band is wider, and every structure item drags only once it is
   * selected, so panning a furnished plan with a finger never moves an item (0.1.87 fix round 1). */
  private readonly coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(any-pointer: coarse)').matches;
  private hoverFrame = 0;
  private hoverEvent: { x: number; y: number; shift: boolean; item: boolean } | null = null;
  @state() private box: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private boxStart: { x: number; y: number } | null = null;

  @state() private scale = 1;
  @state() private tx = 0;
  @state() private ty = 0;
  @state() private hoverId: string | null = null;
  @state() private dragging: { id: string; x: number; y: number } | null = null;
  @state() private orienting: { id: string; rotation: number; fov: number } | null = null;
  /** Live preview while the range handle (cone radius) or a polygon vertex is dragged (R2). */
  @state() private shaping: { id: string; radius?: number; polygon?: { x: number; y: number }[] } | null = null;
  @state() private zoneDraft: { id: string; polygon: { x: number; y: number }[] } | null = null;
  /** A zone edit that was sent and not answered yet (0.1.87 fix round 1): the edited polygon stays drawn - no jump back
   * to the old shape - and the zone takes no new press, so a second quick drag cannot go out on a stale revision. It ends
   * when the zones property brings a changed polygon for the zone (or drops it), or after 5 s (a refused save). */
  private zonePending: { id: string; before: { x: number; y: number }[]; timer: number } | null = null;
  private lastVertexPress: { id: string; index: number; at: number } | null = null;
  @query('.viewport') private viewport!: HTMLDivElement;

  private pointers = new Map<number, { x: number; y: number }>();
  private lastPan: { x: number; y: number } | null = null;
  private lastPinchDist = 0;
  private dragMoved = false;
  private resizeObserver?: ResizeObserver;
  private fitted = false;
  /** A plan larger than the viewport may zoom out below MIN_SCALE, down to the size that fits it (2.10). */
  private minScale = MIN_SCALE;

  static styles = css`
    :host {
      display: block;
      position: relative;
      direction: ltr;
      inline-size: 100%;
      block-size: 100%;
      min-block-size: 320px;
      background: var(--sw-map-bg);
      overflow: hidden;
      touch-action: none;
      user-select: none;
      border-radius: inherit;
    }
    .viewport {
      position: absolute;
      inset: 0;
      cursor: grab;
    }
    .viewport.dragging {
      cursor: grabbing;
    }
    .viewport.boxing {
      cursor: crosshair;
    }
    rect.box {
      fill: color-mix(in srgb, var(--sw-accent) 14%, transparent);
      stroke: var(--sw-accent);
      stroke-width: 1.5;
      stroke-dasharray: 6 4;
      pointer-events: none;
    }
    .viewport.placing {
      cursor: crosshair;
    }
    .handle {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
      stroke-width: 1.6;
      cursor: grab;
    }
    .handle:active {
      cursor: grabbing;
    }
    .handle.mid {
      fill: var(--sw-accent);
      stroke: var(--sw-surface);
      opacity: 0.8;
      cursor: copy;
    }
    .handle.range {
      fill: var(--sw-accent);
      stroke: #fff;
      cursor: ns-resize;
    }
    .handle-line {
      stroke: var(--sw-accent);
      stroke-width: 1;
      stroke-dasharray: 3 3;
      opacity: 0.7;
      pointer-events: none;
    }
    svg {
      inline-size: 100%;
      block-size: 100%;
      display: block;
    }
    .marker {
      cursor: pointer;
      outline: none;
    }
    .marker.editable {
      cursor: grab;
    }
    .marker.editable:active {
      cursor: grabbing;
    }
    .marker .halo {
      fill: var(--sw-accent);
      opacity: 0;
      pointer-events: none; /* an invisible halo must never steal clicks from a neighbouring pin */
      transition: opacity var(--sw-t-fast) var(--sw-ease);
    }
    .marker.selected .halo,
    .marker:focus-visible .halo,
    .marker:hover .halo {
      opacity: 0.18;
    }
    .marker .pin {
      stroke: #fff;
      stroke-width: 2.5;
      filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.28));
    }
    .marker.neutral .pin {
      stroke: var(--sw-border-strong);
      stroke-width: 1.5;
    }
    .marker .icon {
      fill: none;
      stroke: #fff;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .marker.neutral .icon {
      stroke: var(--sw-text);
    }
    .marker.stale .pin,
    .marker.partial .pin,
    .marker.unknown .pin {
      stroke-dasharray: 3 2;
    }
    .marker.dimmed {
      opacity: 0.55;
    }
    .marker .lbl-bg {
      fill: var(--sw-surface);
      filter: drop-shadow(0 1px 3px rgba(15, 23, 42, 0.18));
      pointer-events: none;
    }
    .marker .lbl {
      pointer-events: none;
      font-family: var(--sw-font);
      font-size: 11px;
      font-weight: 600;
      fill: var(--sw-text);
      text-anchor: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    .zone {
      cursor: pointer;
      outline: none;
    }
    .zone polygon {
      fill: var(--zc);
      fill-opacity: 0.1;
      stroke: var(--zc);
      stroke-opacity: 0.7;
      stroke-linejoin: round;
      transition: fill-opacity var(--sw-t-fast) var(--sw-ease);
    }
    .zone:hover polygon,
    .zone:focus-visible polygon,
    .zone.selected polygon {
      fill-opacity: 0.22;
      stroke-opacity: 1;
    }
    .zone.candidate polygon {
      stroke-dasharray: 6 4;
      fill-opacity: 0.14;
    }
    .zone .zl-bg {
      fill: rgba(255, 255, 255, 0.92);
      stroke: var(--zc);
      stroke-opacity: 0.55;
      stroke-width: 1;
      pointer-events: none;
    }
    .zone .zl {
      pointer-events: none;
      font-family: var(--sw-font);
      font-size: 11.5px;
      font-weight: 600;
      fill: var(--sw-text);
      text-anchor: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    .vtx {
      fill: var(--sw-surface);
      stroke: var(--zc);
      cursor: grab;
    }
    .vtx:active {
      cursor: grabbing;
    }
    .vtx.on {
      fill: var(--zc);
    }
    .zone.selected.movable polygon {
      cursor: move; /* the selected zone moves as a whole by its body (0.1.87) */
    }
    .vmid {
      fill: var(--zc);
      fill-opacity: 0.55;
      stroke: var(--sw-surface);
      cursor: copy;
    }
    .draft polyline,
    .draft polygon {
      fill: var(--sw-accent);
      fill-opacity: 0.12;
      stroke: var(--sw-accent);
      stroke-dasharray: 5 4;
      stroke-linejoin: round;
    }
    .draft polyline {
      fill: none;
    }
    .draft circle {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
    }
    .structure {
      pointer-events: none;
    }
    .structure .wall {
      fill: none;
      stroke: var(--sw-map-structure);
      stroke-linecap: butt;
      stroke-linejoin: miter;
    }
    .structure .leaf,
    .structure .arc {
      fill: none;
      stroke: var(--sw-accent);
    }
    .structure .glass {
      stroke: var(--sw-map-glass);
    }
    .structure .gapline {
      stroke: var(--sw-map-structure);
    }
    .structure .glabel {
      fill: var(--sw-map-label);
      font-weight: 600;
      text-anchor: middle;
      dominant-baseline: middle;
    }
    /* Selection, then validation issues: same specificity, so an item that is both shows the issue red. */
    .structure .sel .wall {
      stroke: var(--sw-accent);
    }
    .structure .opening.sel {
      filter: drop-shadow(0 0 2px var(--sw-accent));
    }
    .structure .opening.sel .leaf,
    .structure .opening.sel .arc,
    .structure .opening.sel .glass,
    .structure .opening.sel .gapline {
      stroke: var(--sw-accent-hover);
    }
    .structure .glabel.sel {
      fill: var(--sw-accent);
    }
    .structure .issue .wall,
    .structure .opening.issue .leaf,
    .structure .opening.issue .arc,
    .structure .opening.issue .glass,
    .structure .opening.issue .gapline {
      stroke: var(--sw-danger);
    }
    .structure .glabel.issue {
      fill: var(--sw-danger);
    }
    /* T085: connectors (a wide translucent band along the polyline, an arrow, the level delta) and objects (a tinted
       footprint in the item's colour, a symbol, an optional label); a lamp glows while its circuit's switch is on. */
    .structure .conn .cbody {
      fill: none;
      stroke: var(--sw-map-structure);
      stroke-opacity: 0.22;
      stroke-linecap: butt;
    }
    .structure .conn .carrow {
      fill: none;
      stroke: var(--sw-map-structure);
    }
    .carrowhead {
      fill: var(--sw-map-structure);
    }
    .structure .conn .clabel,
    .structure .obj .olabel {
      fill: var(--sw-map-label);
      font-family: var(--sw-font);
      font-weight: 600;
      text-anchor: middle;
      dominant-baseline: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    .structure .obj .fp {
      fill: var(--oc);
      fill-opacity: 0.18;
      stroke: var(--oc);
    }
    .structure .obj .step {
      stroke: var(--oc);
    }
    .structure .obj .sym {
      fill: none;
      stroke: var(--oc);
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .structure .obj[data-circuit] .fp {
      stroke: var(--kc, var(--oc));
      stroke-width: calc(2px * var(--inv, 1));
    }
    .structure .obj.glow .fp {
      fill: var(--sw-map-glow);
      fill-opacity: 0.6;
      stroke: var(--sw-map-glow);
      filter: drop-shadow(0 0 calc(6px * var(--inv, 1)) var(--sw-map-glow));
    }
    .structure .obj.sel .fp {
      stroke: var(--sw-accent);
      stroke-width: calc(2px * var(--inv, 1));
    }
    .structure .obj.issue .fp {
      stroke: var(--sw-danger);
    }
    .structure .conn.sel .cbody,
    .structure .conn.sel .carrow {
      stroke: var(--sw-accent);
    }
    .structure .conn.issue .cbody {
      stroke: var(--sw-danger);
    }
    .geom-hits .hit {
      fill: transparent;
      stroke: transparent;
      pointer-events: stroke;
      cursor: pointer;
    }
    .geom-hits circle.hit {
      pointer-events: all;
      cursor: grab;
    }
    .geom-hits line.hit {
      cursor: grab; /* an opening slides along its wall, whatever the wall's direction */
    }
    .geom-hits .ohit {
      pointer-events: all;
      cursor: move;
    }
    .geom-hits path.hit {
      pointer-events: stroke;
    }
    .geom-hits .hit.whit {
      cursor: move; /* the selected wall moves as a whole by its body (0.1.87) */
    }
    .candidates {
      pointer-events: none;
    }
    .candidates .cwall {
      fill: none;
      stroke: var(--sw-map-candidate);
      stroke-linecap: butt;
      stroke-dasharray: 8 5;
      opacity: 0.85;
    }
    .candidates .cleaf,
    .candidates .carc,
    .candidates .cglass,
    .candidates .cgap {
      fill: none;
      stroke: var(--sw-map-candidate);
      stroke-dasharray: 5 4;
    }
    .candidates .cand.rejected {
      opacity: 0.28;
    }
    .candidates .cand.sel .cwall {
      opacity: 1;
      stroke-dasharray: none;
    }
    .candidates .cand.sel .cleaf,
    .candidates .cand.sel .carc,
    .candidates .cand.sel .cglass,
    .candidates .cand.sel .cgap {
      stroke-dasharray: none;
    }
    .cand-score rect {
      fill: var(--sw-surface);
      stroke: var(--sw-map-candidate);
    }
    .cand-score text {
      fill: var(--sw-text);
      font-family: var(--sw-font);
      font-weight: 600;
      text-anchor: middle;
      dominant-baseline: middle;
    }
    .cand-hits .hit {
      fill: transparent;
      stroke: transparent;
      pointer-events: stroke;
      cursor: pointer;
    }
    .cand-hits .cvtx {
      fill: var(--sw-surface);
      stroke: var(--sw-map-candidate);
      pointer-events: all;
      cursor: grab;
    }
    .gvtx {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
      cursor: grab;
    }
    .gvtx.on {
      fill: var(--sw-accent);
    }
    .gdrag {
      fill: var(--sw-accent);
      fill-opacity: 0.35;
      stroke: var(--sw-accent);
      pointer-events: none;
    }
    .wdraft polyline {
      fill: none;
      stroke: var(--sw-accent);
    }
    .wdraft circle {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
    }
    .wdraft circle.snap {
      fill: var(--sw-accent);
    }
    .ruler line {
      stroke: var(--sw-accent);
    }
    .ruler.muted line {
      stroke: var(--sw-text-2);
    }
    .ruler circle {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
    }
    .ruler rect {
      fill: var(--sw-surface);
      stroke: var(--sw-border);
    }
    .ruler text {
      fill: var(--sw-text);
      font-family: var(--sw-font);
      font-weight: 600;
      text-anchor: middle;
      dominant-baseline: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    .fov {
      fill: var(--sw-fov);
      stroke: var(--sw-accent);
      stroke-opacity: 0.25;
      stroke-width: 1;
    }
    .fov.off {
      fill: rgba(154, 163, 181, 0.14);
      stroke: var(--sw-offline);
    }
    .controls {
      position: absolute;
      left: var(--sw-s-3);
      bottom: var(--sw-s-3);
      display: flex;
      flex-direction: column;
      gap: 2px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 10px;
      box-shadow: var(--sw-shadow-2);
      padding: 3px;
      z-index: var(--sw-z-map-ui);
    }
    .scale {
      position: absolute;
      left: 56px;
      bottom: var(--sw-s-3);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 2px 8px;
      z-index: var(--sw-z-map-ui);
      font-family: var(--sw-font-mono);
      box-shadow: var(--sw-shadow-1);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.fitted) this.fit();
    });
    this.resizeObserver.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.hoverFrame);
    this.hoverFrame = 0; // a reconnected canvas must not wait for a frame that was cancelled
    this.clearZonePending();
  }

  protected willUpdate(changed: Map<string, unknown>) {
    const pend = this.zonePending;
    if (pend && changed.has('zones')) {
      const z = this.zones.find((x) => x.id === pend.id);
      if (!z || (z.polygon !== pend.before && JSON.stringify(z.polygon) !== JSON.stringify(pend.before))) this.clearZonePending();
    }
  }

  private emitZoneEdit(z: PlanZone, polygon: { x: number; y: number }[]) {
    if (this.zonePending) window.clearTimeout(this.zonePending.timer);
    this.zoneDraft = { id: z.id, polygon };
    this.zonePending = { id: z.id, before: z.polygon, timer: window.setTimeout(() => this.clearZonePending(), 5000) };
    this.dispatchEvent(new CustomEvent('zone-edit', { detail: { id: z.id, polygon }, bubbles: true, composed: true }));
  }

  private clearZonePending() {
    const pend = this.zonePending;
    if (!pend) return;
    window.clearTimeout(pend.timer);
    if (this.zoneDraft?.id === pend.id) this.zoneDraft = null;
    this.zonePending = null;
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('planWidth') || changed.has('planHeight')) {
      this.fitted = false;
      this.fit();
    }
    if (changed.has('scale') || changed.has('tx') || changed.has('ty')) {
      this.dispatchEvent(new CustomEvent('view-change', { bubbles: true, composed: true }));
    }
  }

  /** Current zoom factor (plan pixels → host pixels). */
  get zoom() {
    return this.scale;
  }

  /** Keyboard focus back on a marker (M06: Escape closes the card and returns focus to the pin). */
  focusMarker(id: string) {
    const el = this.renderRoot.querySelector<SVGGElement>(`g.marker[data-id="${CSS.escape(id)}"]`);
    el?.focus();
    return Boolean(el);
  }

  /** Host-pixel position of a normalized plan point (for popovers anchored to pins). */
  toScreen(nx: number, ny: number) {
    return { x: this.tx + nx * this.planWidth * this.scale, y: this.ty + ny * this.planHeight * this.scale };
  }

  /** Fit the whole plan into the viewport with a small margin. */
  fit() {
    const w = this.clientWidth;
    const h = this.clientHeight;
    if (!w || !h || !this.planWidth || !this.planHeight) return;
    const margin = 24;
    const s = Math.min((w - margin * 2) / this.planWidth, (h - margin * 2) / this.planHeight);
    this.minScale = Math.min(MIN_SCALE, s);
    this.scale = Math.max(this.minScale, Math.min(MAX_SCALE, s));
    this.tx = (w - this.planWidth * this.scale) / 2;
    this.ty = (h - this.planHeight * this.scale) / 2;
    this.fitted = true;
  }

  /** Centre a normalized point in the viewport without changing the zoom (owner round 3: jump without zoom). */
  centerOn(nx: number, ny: number) {
    const w = this.clientWidth;
    const h = this.clientHeight;
    if (!w || !h) return;
    this.tx = w / 2 - nx * this.planWidth * this.scale;
    this.ty = h / 2 - ny * this.planHeight * this.scale;
    this.fitted = true;
  }

  /** Zoom so that a normalized box fills the viewport (with a margin, capped so small rooms stay readable). */
  zoomToBox(x0: number, y0: number, x1: number, y1: number, margin = 48, relCap = 0) {
    const w = this.clientWidth;
    const h = this.clientHeight;
    if (!w || !h || !this.planWidth || !this.planHeight) return;
    const bw = Math.max(1e-6, x1 - x0) * this.planWidth;
    const bh = Math.max(1e-6, y1 - y0) * this.planHeight;
    // relCap > 0: never more than relCap × the whole-plan fit (a jump to a pin stays readable, not a microscope)
    const fitS = Math.min((w - 48) / this.planWidth, (h - 48) / this.planHeight);
    const cap = relCap > 0 ? Math.min(2.5, Math.max(fitS * relCap, fitS)) : 2.5;
    const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min((w - margin * 2) / bw, (h - margin * 2) / bh, cap)));
    this.scale = s;
    this.tx = w / 2 - ((x0 + x1) / 2) * this.planWidth * s;
    this.ty = h / 2 - ((y0 + y1) / 2) * this.planHeight * s;
    this.fitted = true;
  }

  zoomBy(factor: number, cx?: number, cy?: number) {
    const w = this.clientWidth;
    const h = this.clientHeight;
    const px = cx ?? w / 2;
    const py = cy ?? h / 2;
    const next = Math.max(this.minScale, Math.min(MAX_SCALE, this.scale * factor));
    const ratio = next / this.scale;
    this.tx = px - (px - this.tx) * ratio;
    this.ty = py - (py - this.ty) * ratio;
    this.scale = next;
    this.fitted = true;
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = this.getBoundingClientRect();
    this.zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
  };

  /** Host pixel → normalized plan coordinates (clamped to the plan). */
  toPlan(px: number, py: number) {
    return {
      x: Math.min(1, Math.max(0, (px - this.tx) / this.scale / this.planWidth)),
      y: Math.min(1, Math.max(0, (py - this.ty) / this.scale / this.planHeight)),
    };
  }

  private onMarkerPointerDown = (m: PlanMarker, e: PointerEvent) => {
    // while placing / drawing the press belongs to the plan, as on a zone: a library item goes onto an anchor's spot (T085)
    if (!this.editable || e.button !== 0 || this.placing) return;
    e.stopPropagation();
    e.preventDefault();
    this.dragging = { id: m.id, x: m.x, y: m.y };
    this.viewport.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const rect = this.getBoundingClientRect();
      const p = this.toPlan(ev.clientX - rect.left, ev.clientY - rect.top);
      this.dragging = { id: m.id, x: p.x, y: p.y };
    };
    const up = (ev: PointerEvent) => {
      this.viewport.removeEventListener('pointermove', move);
      this.viewport.removeEventListener('pointerup', up);
      this.viewport.removeEventListener('pointercancel', up);
      const rect = this.getBoundingClientRect();
      const p = this.toPlan(ev.clientX - rect.left, ev.clientY - rect.top);
      const moved = Math.abs(p.x - m.x) > 0.0005 || Math.abs(p.y - m.y) > 0.0005;
      this.dragging = null;
      // pointer capture delivers the trailing click to the viewport: swallow it so the pin stays selected
      // (a plain press selects; without this the background click deselected it right away - R2 evidence)
      if (moved) this.dispatchEvent(new CustomEvent('marker-move', { detail: { id: m.id, x: p.x, y: p.y }, bubbles: true, composed: true }));
      else this.select(m, ev);
      this.dragMoved = true;
      setTimeout(() => (this.dragMoved = false), 0);
    };
    this.viewport.addEventListener('pointermove', move);
    this.viewport.addEventListener('pointerup', up);
    this.viewport.addEventListener('pointercancel', up);
  };

  private onPointerDown = (e: PointerEvent) => {
    // Capture only once a drag really starts (see onPointerMove); capturing here would redirect the
    // resulting `click` to the viewport and markers would never receive it.
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.dragMoved = false;
    if (this.pointers.size === 1) {
      if (this.boxSelect && e.button === 0 && !e.shiftKey && !this.editable && !this.placing) {
        const rect = this.getBoundingClientRect();
        this.boxStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        this.lastPan = null;
        return;
      }
      this.lastPan = { x: e.clientX, y: e.clientY };
      this.viewport.classList.add('dragging');
    } else if (this.pointers.size === 2) {
      this.lastPinchDist = this.pinchDistance();
      this.lastPan = null;
      this.boxStart = null;
      this.box = null;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.placing && !this.geomPress && e.pointerType !== 'touch') this.queueHover(e);
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const dist = this.pinchDistance();
      if (this.lastPinchDist > 0) {
        const [a, b] = [...this.pointers.values()];
        const rect = this.getBoundingClientRect();
        this.zoomBy(dist / this.lastPinchDist, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
      }
      this.lastPinchDist = dist;
      this.dragMoved = true;
      return;
    }
    if (this.boxStart) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (!this.dragMoved && Math.abs(x - this.boxStart.x) + Math.abs(y - this.boxStart.y) > 3) {
        this.dragMoved = true;
        if (!this.viewport.hasPointerCapture(e.pointerId)) this.viewport.setPointerCapture(e.pointerId);
      }
      if (this.dragMoved) this.box = { x0: Math.min(this.boxStart.x, x), y0: Math.min(this.boxStart.y, y), x1: Math.max(this.boxStart.x, x), y1: Math.max(this.boxStart.y, y) };
      return;
    }
    if (this.lastPan) {
      const dx = e.clientX - this.lastPan.x;
      const dy = e.clientY - this.lastPan.y;
      if (!this.dragMoved && Math.abs(dx) + Math.abs(dy) > 2) {
        this.dragMoved = true;
        if (!this.viewport.hasPointerCapture(e.pointerId)) this.viewport.setPointerCapture(e.pointerId);
      }
      this.tx += dx;
      this.ty += dy;
      this.lastPan = { x: e.clientX, y: e.clientY };
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.boxStart && this.pointers.size === 0) {
      const b = this.box;
      this.boxStart = null;
      this.box = null;
      if (b && b.x1 - b.x0 >= 4 && b.y1 - b.y0 >= 4) {
        const ids = this.markers.filter((m) => { const p = this.toScreen(m.x, m.y); return p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1; }).map((m) => m.id);
        this.dispatchEvent(new CustomEvent<{ ids: string[] }>('box-select', { detail: { ids }, bubbles: true, composed: true }));
      }
      // dragMoved stays set so the click that follows the drag does not clear the selection
    }
    if (this.pointers.size === 0) {
      this.lastPan = null;
      this.viewport.classList.remove('dragging');
    } else if (this.pointers.size === 1) {
      const [p] = [...this.pointers.values()];
      this.lastPan = { x: p.x, y: p.y };
    }
  };

  private pinchDistance() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private select(m: PlanMarker, e: Event) {
    if (this.dragMoved) return;
    e.stopPropagation();
    const p = this.toScreen(m.x, m.y);
    const detail: MarkerSelectDetail = { id: m.id, sx: p.x, sy: p.y };
    this.dispatchEvent(new CustomEvent<MarkerSelectDetail>('marker-select', { detail, bubbles: true, composed: true }));
  }

  private selectZone(z: PlanZone, e: Event) {
    if (this.dragMoved || this.placing) return; // while placing / drawing the click belongs to the plan
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('zone-select', { detail: { id: z.id }, bubbles: true, composed: true }));
  }

  /** Drag a corner of the selected zone (or, with `insert`, a new corner created at an edge midpoint). */
  private onVertexPointerDown(z: PlanZone, index: number, e: PointerEvent, insert = false) {
    if (!this.editable || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    if (this.zonePending?.id === z.id) return; // the last edit of this zone is still being saved
    if (!insert) {
      // a second press on the same corner within 450 ms removes it (the dblclick event itself lands on the
      // viewport because of pointer capture)
      const last = this.lastVertexPress;
      const now = performance.now();
      if (last && last.id === z.id && last.index === index && now - last.at < 450) {
        this.lastVertexPress = null;
        this.removeVertex(z, index, e);
        return;
      }
      this.lastVertexPress = { id: z.id, index, at: now };
    }
    const rect0 = this.getBoundingClientRect();
    let poly = z.polygon.map((p) => ({ x: p.x, y: p.y }));
    let idx = index;
    if (insert) {
      const a = poly[index];
      const b = poly[(index + 1) % poly.length];
      poly.splice(index + 1, 0, { x: +((a.x + b.x) / 2).toFixed(4), y: +((a.y + b.y) / 2).toFixed(4) });
      idx = index + 1;
    }
    this.zoneDraft = { id: z.id, polygon: poly };
    this.viewport.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const p = this.toPlan(ev.clientX - rect0.left, ev.clientY - rect0.top);
      poly = poly.map((q, i) => (i === idx ? { x: +p.x.toFixed(4), y: +p.y.toFixed(4) } : q));
      this.zoneDraft = { id: z.id, polygon: poly };
    };
    const up = () => {
      this.viewport.removeEventListener('pointermove', move);
      this.viewport.removeEventListener('pointerup', up);
      this.viewport.removeEventListener('pointercancel', up);
      const changed = insert || poly.some((q, i) => q.x !== z.polygon[i].x || q.y !== z.polygon[i].y);
      this.zoneDraft = null;
      this.dragMoved = true; // swallow the trailing click so the zone stays selected
      setTimeout(() => (this.dragMoved = false), 0);
      if (changed) this.emitZoneEdit(z, poly);
      else if (!insert) this.dispatchEvent(new CustomEvent('zone-vertex-select', { detail: { id: z.id, index }, bubbles: true, composed: true })); // a press without a move selects the corner (Delete removes it)
    };
    this.viewport.addEventListener('pointermove', move);
    this.viewport.addEventListener('pointerup', up);
    this.viewport.addEventListener('pointercancel', up);
  }

  /** Hotfix 0.1.87: a press on the selected zone's body and a drag move the whole polygon (a live `zoneDraft` while the
   * pointer moves, one `zone-edit` on release - the same save path as a corner edit). A press without a move keeps the
   * zone selected. */
  private onZoneBodyPointerDown(z: PlanZone, e: PointerEvent) {
    if (!this.editable || e.button !== 0 || this.placing || z.candidate || this.selectedZoneId !== z.id || this.pointers.size > 0) return;
    e.stopPropagation(); // the press is the zone's: no pan
    e.preventDefault();
    if (this.zonePending?.id === z.id) return; // the last edit of this zone is still being saved
    this.releaseFieldFocus();
    const rect0 = this.getBoundingClientRect();
    const start = this.toPlan(e.clientX - rect0.left, e.clientY - rect0.top);
    let poly = z.polygon;
    let moved = false;
    this.viewport.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const p = this.toPlan(ev.clientX - rect0.left, ev.clientY - rect0.top);
      if (!moved && Math.hypot((p.x - start.x) * this.planWidth, (p.y - start.y) * this.planHeight) * this.scale < 3) return;
      moved = true;
      poly = translatePolygon(z.polygon, p.x - start.x, p.y - start.y);
      this.zoneDraft = { id: z.id, polygon: poly };
    };
    const end = () => {
      this.viewport.removeEventListener('pointermove', move);
      this.viewport.removeEventListener('pointerup', up);
      this.viewport.removeEventListener('pointercancel', cancel);
      this.zoneDraft = null;
      this.dragMoved = true; // swallow the trailing click so the zone stays selected
      setTimeout(() => (this.dragMoved = false), 0);
    };
    const up = () => {
      end();
      if (moved && poly.some((q, i) => q.x !== z.polygon[i].x || q.y !== z.polygon[i].y)) this.emitZoneEdit(z, poly);
    };
    const cancel = () => end(); // an interrupted gesture changes nothing
    this.viewport.addEventListener('pointermove', move);
    this.viewport.addEventListener('pointerup', up);
    this.viewport.addEventListener('pointercancel', cancel);
  }

  private removeVertex(z: PlanZone, index: number, e: Event) {
    e.stopPropagation();
    if (!this.editable || z.polygon.length <= 3) return;
    this.emitZoneEdit(z, z.polygon.filter((_, i) => i !== index));
  }

  private renderZoneHandles(z: PlanZone, poly: { x: number; y: number }[]) {
    const inv = 1 / this.scale;
    const W = this.planWidth;
    const H = this.planHeight;
    return svg`<g class="zone-handles">
      ${poly.map((p, i) => {
        const q = poly[(i + 1) % poly.length];
        return svg`<circle class="vmid" cx=${(((p.x + q.x) / 2) * W).toFixed(1)} cy=${(((p.y + q.y) / 2) * H).toFixed(1)} r=${(4 * inv).toFixed(2)} stroke-width=${(1.2 * inv).toFixed(2)} role="button" aria-label="הוסף פינה"
          @pointerdown=${(e: PointerEvent) => this.onVertexPointerDown(z, i, e, true)} @click=${(e: Event) => e.stopPropagation()} />`;
      })}
      ${poly.map((p, i) => svg`<circle class="vtx ${i === this.selectedZoneVertex ? 'on' : ''}" data-vertex=${i} cx=${(p.x * W).toFixed(1)} cy=${(p.y * H).toFixed(1)} r=${(6 * inv).toFixed(2)} stroke-width=${(1.6 * inv).toFixed(2)} role="slider" aria-label=${`פינה ${i + 1}`}
          @pointerdown=${(e: PointerEvent) => this.onVertexPointerDown(z, i, e)} @click=${(e: Event) => e.stopPropagation()} />`)}
    </g>`;
  }

  private renderZone(z: PlanZone) {
    if (z.polygon.length < 3) return nothing;
    const inv = 1 / this.scale;
    const live = this.zoneDraft?.id === z.id ? this.zoneDraft.polygon : z.polygon;
    const pts = live.map((p) => `${(p.x * this.planWidth).toFixed(1)},${(p.y * this.planHeight).toFixed(1)}`).join(' ');
    const c = polygonCentroid(live);
    const selected = this.selectedZoneId === z.id;
    const lw = Math.max(36, z.name.length * 7 + 18);
    const xs = live.map((p) => p.x);
    const ys = live.map((p) => p.y);
    const screenW = (Math.max(...xs) - Math.min(...xs)) * this.planWidth * this.scale;
    const screenH = (Math.max(...ys) - Math.min(...ys)) * this.planHeight * this.scale;
    const labelFits = selected || z.candidate || (screenW >= lw + 12 && screenH >= 30);
    const movable = this.editable && selected && !z.candidate && !this.placing;
    return svg`
      <g class="zone ${selected ? 'selected' : ''} ${z.candidate ? 'candidate' : ''} ${movable ? 'movable' : ''}" style="--zc:${z.color}" role="button" tabindex="0" aria-label=${z.name} aria-pressed=${selected}
         data-zone=${z.id}
         @click=${(e: Event) => this.selectZone(z, e)} @keydown=${(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && this.selectZone(z, e)}>
        <polygon data-zone-body points=${pts} stroke-width=${((selected ? 2.2 : 1.4) * inv).toFixed(2)} @pointerdown=${(e: PointerEvent) => this.onZoneBodyPointerDown(z, e)} />
        ${this.zoneLabels && z.name && labelFits
          ? svg`<g transform="translate(${this.zoneLabelPoint(z, live, c).x.toFixed(1)} ${this.zoneLabelPoint(z, live, c).y.toFixed(1)}) scale(${inv})">
              <rect class="zl-bg" x=${-lw / 2} y="-10" width=${lw} height="20" rx="10" />
              <text class="zl" y="3.5">${z.name}</text>
            </g>`
          : nothing}
        ${this.editable && selected && !z.candidate ? this.renderZoneHandles(z, live) : nothing}
      </g>`;
  }

  /** R4: the label anchor for a zone - the centroid, or just outside the polygon's bounding box on the chosen side. */
  private zoneLabelPoint(z: PlanZone, pts: { x: number; y: number }[], c: { x: number; y: number }) {
    const inv = 1 / this.scale;
    const xs = pts.map((p) => p.x * this.planWidth);
    const ys = pts.map((p) => p.y * this.planHeight);
    const lw = Math.max(36, z.name.length * 7 + 18) * inv;
    switch (z.labelPos) {
      case 'top': return { x: c.x * this.planWidth, y: Math.min(...ys) - 14 * inv };
      case 'bottom': return { x: c.x * this.planWidth, y: Math.max(...ys) + 14 * inv };
      case 'left': return { x: Math.min(...xs) - lw / 2 - 6 * inv, y: c.y * this.planHeight };
      case 'right': return { x: Math.max(...xs) + lw / 2 + 6 * inv, y: c.y * this.planHeight };
      default: return { x: c.x * this.planWidth, y: c.y * this.planHeight };
    }
  }

  /** R4: the label offset for a marker (screen pixels, before the inverse scale). */
  private static labelOffset(pos: string | undefined, r: number, labelWidth: number): { x: number; y: number } {
    switch (pos) {
      case 'top': return { x: 0, y: -(r + 14) };
      case 'left': return { x: -(r + 8 + labelWidth / 2), y: 0 };
      case 'right': return { x: r + 8 + labelWidth / 2, y: 0 };
      default: return { x: 0, y: r + 14 };
    }
  }

  private renderDraft() {
    const pts = this.draftPoints;
    if (!pts.length) return nothing;
    const inv = 1 / this.scale;
    const P = pts.map((p) => ({ x: p.x * this.planWidth, y: p.y * this.planHeight }));
    const str = P.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return svg`<g class="draft" pointer-events="none">
      ${P.length >= 3 ? svg`<polygon points=${str} stroke-width=${(1.5 * inv).toFixed(2)} />` : svg`<polyline points=${str} stroke-width=${(1.5 * inv).toFixed(2)} />`}
      ${P.map((p, i) => svg`<circle cx=${p.x.toFixed(1)} cy=${p.y.toFixed(1)} r=${((i === 0 ? 5.5 : 3.5) * inv).toFixed(2)} stroke-width=${(1.5 * inv).toFixed(2)} />`)}
    </g>`;
  }

  private onBackgroundClick = (e: MouseEvent) => {
    if (this.dragMoved) return;
    if (this.placing) {
      const rect = this.getBoundingClientRect();
      const p = this.toPlan(e.clientX - rect.left, e.clientY - rect.top);
      this.dispatchEvent(new CustomEvent('plan-click', { detail: { x: +p.x.toFixed(4), y: +p.y.toFixed(4), shift: e.shiftKey }, bubbles: true, composed: true }));
      return;
    }
    this.dispatchEvent(new CustomEvent<MarkerSelectDetail>('marker-select', { detail: { id: null }, bubbles: true, composed: true }));
  };

  /** Bearing (0° up, clockwise) from a marker centre to a host-pixel point. */
  private bearingTo(m: PlanMarker, px: number, py: number) {
    const c = this.toScreen(m.x, m.y);
    const deg = (Math.atan2(py - c.y, px - c.x) * 180) / Math.PI + 90;
    return ((deg % 360) + 360) % 360;
  }

  private onHandlePointerDown = (m: PlanMarker, kind: 'dir' | 'left' | 'right', e: PointerEvent) => {
    if (!this.editable || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const rect0 = this.getBoundingClientRect();
    const startRotation = m.rotation ?? 0;
    const startFov = m.fov ?? 90;
    // the edge that is not being dragged stays where it is
    const fixedEdge = kind === 'left' ? startRotation + startFov / 2 : startRotation - startFov / 2;
    this.orienting = { id: m.id, rotation: startRotation, fov: startFov };
    this.viewport.setPointerCapture(e.pointerId);
    const compute = (ev: PointerEvent) => {
      const b = this.bearingTo(m, ev.clientX - rect0.left, ev.clientY - rect0.top);
      if (kind === 'dir') return { rotation: Math.round(b), fov: startFov };
      // angular distance from the fixed edge, measured the short way around
      let span = kind === 'left' ? fixedEdge - b : b - fixedEdge;
      span = ((span % 360) + 360) % 360;
      const fov = Math.max(10, Math.min(180, Math.round(span)));
      const rotation = kind === 'left' ? fixedEdge - fov / 2 : fixedEdge + fov / 2;
      return { rotation: Math.round(((rotation % 360) + 360) % 360), fov };
    };
    const move = (ev: PointerEvent) => {
      this.orienting = { id: m.id, ...compute(ev) };
    };
    const up = (ev: PointerEvent) => {
      this.viewport.removeEventListener('pointermove', move);
      this.viewport.removeEventListener('pointerup', up);
      this.viewport.removeEventListener('pointercancel', up);
      const o = compute(ev);
      this.orienting = null;
      this.dragMoved = true; // the click that follows must not deselect
      setTimeout(() => (this.dragMoved = false), 0);
      if (o.rotation !== startRotation || o.fov !== startFov) this.dispatchEvent(new CustomEvent('marker-orient', { detail: { id: m.id, ...o }, bubbles: true, composed: true }));
    };
    this.viewport.addEventListener('pointermove', move);
    this.viewport.addEventListener('pointerup', up);
    this.viewport.addEventListener('pointercancel', up);
  };

  /** Cone radius in plan pixels for a marker (its own fraction of the plan width, else the default illustration). */
  private radiusOf(m: PlanMarker) {
    const live = this.shaping?.id === m.id && this.shaping.radius !== undefined ? this.shaping.radius : m.radius;
    return live ? Math.max(12, live * this.planWidth) : this.coneRadius;
  }

  /** Drag the cone's range handle: the radius follows the pointer's distance from the pin; emits `marker-coverage` {id, radius}. */
  private onRangePointerDown = (m: PlanMarker, e: PointerEvent) => {
    if (!this.editable || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const rect0 = this.getBoundingClientRect();
    const start = m.radius ?? this.coneRadius / this.planWidth;
    this.shaping = { id: m.id, radius: start };
    this.viewport.setPointerCapture(e.pointerId);
    const compute = (ev: PointerEvent) => {
      const c = this.toScreen(m.x, m.y);
      const d = Math.hypot(ev.clientX - rect0.left - c.x, ev.clientY - rect0.top - c.y) / this.scale;
      return +Math.max(0.02, Math.min(1, d / this.planWidth)).toFixed(4);
    };
    const move = (ev: PointerEvent) => (this.shaping = { id: m.id, radius: compute(ev) });
    const up = (ev: PointerEvent) => {
      this.viewport.removeEventListener('pointermove', move);
      this.viewport.removeEventListener('pointerup', up);
      this.viewport.removeEventListener('pointercancel', up);
      const radius = compute(ev);
      this.shaping = null;
      this.dragMoved = true;
      setTimeout(() => (this.dragMoved = false), 0);
      if (radius !== start) this.dispatchEvent(new CustomEvent('marker-coverage', { detail: { id: m.id, radius }, bubbles: true, composed: true }));
    };
    this.viewport.addEventListener('pointermove', move);
    this.viewport.addEventListener('pointerup', up);
    this.viewport.addEventListener('pointercancel', up);
  };

  /** Drag a vertex of the coverage polygon (normalized plan space); emits `marker-coverage` {id, polygon}. */
  private onCoverageVertexDown = (m: PlanMarker, index: number, e: PointerEvent) => {
    if (!this.editable || e.button !== 0 || !m.polygon) return;
    e.stopPropagation();
    e.preventDefault();
    // a second press on the same vertex within 450 ms removes it (pointer capture keeps dblclick from reaching the circle)
    const now = Date.now();
    if (this.lastVertexPress && this.lastVertexPress.id === m.id && this.lastVertexPress.index === index && now - this.lastVertexPress.at < 450) {
      this.lastVertexPress = null;
      this.editPolygon(m, { remove: index });
      return;
    }
    this.lastVertexPress = { id: m.id, index, at: now };
    const rect0 = this.getBoundingClientRect();
    const base = m.polygon.map((p) => ({ ...p }));
    this.shaping = { id: m.id, polygon: base };
    this.viewport.setPointerCapture(e.pointerId);
    let moved = false;
    const compute = (ev: PointerEvent) => {
      const p = this.toPlan(ev.clientX - rect0.left, ev.clientY - rect0.top);
      const pts = base.map((q) => ({ ...q }));
      pts[index] = { x: +Math.max(0, Math.min(1, p.x)).toFixed(4), y: +Math.max(0, Math.min(1, p.y)).toFixed(4) };
      return pts;
    };
    const move = (ev: PointerEvent) => {
      moved = true;
      this.shaping = { id: m.id, polygon: compute(ev) };
    };
    const up = (ev: PointerEvent) => {
      this.viewport.removeEventListener('pointermove', move);
      this.viewport.removeEventListener('pointerup', up);
      this.viewport.removeEventListener('pointercancel', up);
      const polygon = compute(ev);
      this.shaping = null;
      this.dragMoved = true;
      setTimeout(() => (this.dragMoved = false), 0);
      if (moved) this.dispatchEvent(new CustomEvent('marker-coverage', { detail: { id: m.id, polygon }, bubbles: true, composed: true }));
    };
    this.viewport.addEventListener('pointermove', move);
    this.viewport.addEventListener('pointerup', up);
    this.viewport.addEventListener('pointercancel', up);
  };

  /** A midpoint handle adds a vertex there; a double click on a vertex removes it (never below 3). */
  private editPolygon(m: PlanMarker, action: { insertAfter: number } | { remove: number }) {
    if (!m.polygon) return;
    let pts = m.polygon.map((p) => ({ ...p }));
    if ('remove' in action) {
      if (pts.length <= 3) return;
      pts = pts.filter((_, i) => i !== action.remove);
    } else {
      const a = pts[action.insertAfter];
      const b = pts[(action.insertAfter + 1) % pts.length];
      if (pts.length >= 40) return;
      pts.splice(action.insertAfter + 1, 0, { x: +((a.x + b.x) / 2).toFixed(4), y: +((a.y + b.y) / 2).toFixed(4) });
    }
    this.dispatchEvent(new CustomEvent('marker-coverage', { detail: { id: m.id, polygon: pts }, bubbles: true, composed: true }));
  }

  /** The polygon relative to the marker's own translate (plan pixels). */
  private polygonPath(m: PlanMarker) {
    const pts = this.shaping?.id === m.id && this.shaping.polygon ? this.shaping.polygon : m.polygon;
    if (!pts || pts.length < 3) return null;
    return pts.map((p) => `${((p.x - m.x) * this.planWidth).toFixed(1)},${((p.y - m.y) * this.planHeight).toFixed(1)}`).join(' ');
  }

  /** The camera's coverage cut by the walls of its level, as a points attribute relative to the marker's translate;
   * null when clipping is off, there is no structure on that level or the marker has a manual polygon (which wins).
   * Cached by CoverageCache on the document identity, the pose, the radius, the level and the open doors. */
  private clippedCoverage(m: PlanMarker, live: { x: number; y: number }, rotation: number, fov: number): string | null {
    const doc = this.geometry;
    if (!this.clipCoverage || !doc || m.polygon) return null;
    const level = m.level ?? defaultLevelId(doc);
    if (!hasWallsOnLevel(doc, level)) return null;
    const pts = this.coverage.polygon(m.id, { x: live.x, y: live.y, rotation, fov, radiusPx: this.radiusOf(m), level }, doc, this.planWidth, this.planHeight, this.entityStates, this.catalog ?? undefined);
    const hit = this.covPoints.get(m.id);
    if (hit && hit.pts === pts) return hit.points;
    const points = pts.map((p) => `${((p[0] - live.x) * this.planWidth).toFixed(2)},${((p[1] - live.y) * this.planHeight).toFixed(2)}`).join(' ');
    this.covPoints.set(m.id, { pts, points });
    return points;
  }

  private renderPolygonHandles(m: PlanMarker) {
    const pts = this.shaping?.id === m.id && this.shaping.polygon ? this.shaping.polygon : m.polygon;
    if (!pts) return nothing;
    const inv = 1 / this.scale;
    const rel = (p: { x: number; y: number }) => ({ x: (p.x - m.x) * this.planWidth, y: (p.y - m.y) * this.planHeight });
    return svg`
      ${pts.map((p, i) => {
        const q = rel(p);
        const n = rel(pts[(i + 1) % pts.length]);
        return svg`
          <circle class="handle mid" cx=${((q.x + n.x) / 2).toFixed(1)} cy=${((q.y + n.y) / 2).toFixed(1)} r=${(4.5 * inv).toFixed(1)} data-cov-mid=${i} role="button" aria-label="הוסף נקודה"
            @pointerdown=${(e: PointerEvent) => { e.stopPropagation(); e.preventDefault(); }} @click=${(e: Event) => { e.stopPropagation(); this.editPolygon(m, { insertAfter: i }); }} />
          <circle class="handle" cx=${q.x.toFixed(1)} cy=${q.y.toFixed(1)} r=${(6.5 * inv).toFixed(1)} data-cov-vertex=${i} role="slider" aria-label="נקודת כיסוי"
            @pointerdown=${(e: PointerEvent) => this.onCoverageVertexDown(m, i, e)} @dblclick=${(e: Event) => { e.stopPropagation(); this.editPolygon(m, { remove: i }); }} />`;
      })}
    `;
  }

  private renderHandles(m: PlanMarker, rotation: number, fov: number) {
    const r = this.radiusOf(m);
    const inv = 1 / this.scale;
    const pt = (bearing: number, radius: number) => ({ x: Math.cos(SwPlanCanvas.rad(bearing)) * radius, y: Math.sin(SwPlanCanvas.rad(bearing)) * radius });
    const left = pt(rotation - fov / 2, r);
    const right = pt(rotation + fov / 2, r);
    const dir = pt(rotation, r * 0.72);
    const hs = 7 * inv;
    return svg`
      <line class="handle-line" x1="0" y1="0" x2=${dir.x.toFixed(1)} y2=${dir.y.toFixed(1)} />
      <rect class="handle" x=${(left.x - hs).toFixed(1)} y=${(left.y - hs).toFixed(1)} width=${(hs * 2).toFixed(1)} height=${(hs * 2).toFixed(1)} rx=${(1.5 * inv).toFixed(1)} role="slider" aria-label="קצה שדה ראייה" @pointerdown=${(e: PointerEvent) => this.onHandlePointerDown(m, 'left', e)} @click=${(e: Event) => e.stopPropagation()} />
      <rect class="handle" x=${(right.x - hs).toFixed(1)} y=${(right.y - hs).toFixed(1)} width=${(hs * 2).toFixed(1)} height=${(hs * 2).toFixed(1)} rx=${(1.5 * inv).toFixed(1)} role="slider" aria-label="קצה שדה ראייה" @pointerdown=${(e: PointerEvent) => this.onHandlePointerDown(m, 'right', e)} @click=${(e: Event) => e.stopPropagation()} />
      <circle class="handle" cx=${dir.x.toFixed(1)} cy=${dir.y.toFixed(1)} r=${(8 * inv).toFixed(1)} role="slider" aria-label="כיוון מבט" @pointerdown=${(e: PointerEvent) => this.onHandlePointerDown(m, 'dir', e)} @click=${(e: Event) => e.stopPropagation()} />
      <circle class="handle range" cx=${pt(rotation, r).x.toFixed(1)} cy=${pt(rotation, r).y.toFixed(1)} r=${(6.5 * inv).toFixed(1)} role="slider" aria-label="טווח כיסוי" data-cov-range @pointerdown=${(e: PointerEvent) => this.onRangePointerDown(m, e)} />
    `;
  }

  /** Unit-circle angle (radians) of a bearing where 0° points up and degrees grow clockwise. */
  private static rad(bearing: number) {
    return ((bearing - 90) * Math.PI) / 180;
  }

  private fovPath(rotation: number, fov: number, radius: number) {
    const start = SwPlanCanvas.rad(rotation - fov / 2);
    const end = SwPlanCanvas.rad(rotation + fov / 2);
    const x1 = Math.cos(start) * radius;
    const y1 = Math.sin(start) * radius;
    const x2 = Math.cos(end) * radius;
    const y2 = Math.sin(end) * radius;
    return `M0 0 L${x1.toFixed(1)} ${y1.toFixed(1)} A${radius} ${radius} 0 ${fov > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
  }

  private renderMarker(m: PlanMarker) {
    const live = this.dragging?.id === m.id ? this.dragging : m;
    const orient = this.orienting?.id === m.id ? this.orienting : null;
    const rotation = orient ? orient.rotation : m.rotation ?? 0;
    const fov = orient ? orient.fov : m.fov;
    const px = live.x * this.planWidth;
    const py = live.y * this.planHeight;
    const inv = 1 / this.scale;
    const isCamera = m.kind === 'camera';
    const fill = PIN_FILL[m.state] ?? PIN_FILL.neutral;
    const selected = this.selectedId === m.id || this.selectedIds.includes(m.id);
    // Boards show bare pins; the name appears on hover / selection (labels never intercept clicks).
    const showLabel = this.alwaysLabel || selected || this.hoverId === m.id;
    const labelWidth = Math.max(44, m.label.length * 6.5 + 16);
    const dimmed = this.dimEntities && !isCamera;
    const r = isCamera ? 13 : 11;
    return svg`
      <g class="marker ${m.state} ${selected ? 'selected' : ''} ${dimmed ? 'dimmed' : ''} ${this.editable ? 'editable' : ''}"
         transform="translate(${px} ${py})" data-id=${m.id}
         tabindex="0" role="button" aria-label=${m.label} aria-pressed=${selected}
         @mouseenter=${() => (this.hoverId = m.id)} @mouseleave=${() => (this.hoverId = null)}
         @pointerdown=${(e: PointerEvent) => this.onMarkerPointerDown(m, e)}
         @click=${(e: Event) => (this.placing ? undefined : this.editable ? e.stopPropagation() : this.select(m, e))}
         @keydown=${(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && this.select(m, e)}>
        ${isCamera && fov && m.state !== 'forbidden'
          ? (() => { const poly = this.polygonPath(m); if (poly) return svg`<polygon class="fov ${m.state === 'offline' ? 'off' : ''}" data-cov-polygon points=${poly} />`;
            const clipped = this.clippedCoverage(m, live, rotation, fov);
            return clipped
              ? svg`<polygon class="fov ${m.state === 'offline' ? 'off' : ''}" data-cov-clipped points=${clipped} />`
              : svg`<path class="fov ${m.state === 'offline' ? 'off' : ''}" d=${this.fovPath(rotation, fov, this.radiusOf(m))} />`; })()
          : nothing}
        ${isCamera && fov && this.editable && selected && !this.dragging ? (this.polygonPath(m) ? this.renderPolygonHandles(m) : this.renderHandles(m, rotation, fov)) : nothing}
        <g transform="scale(${inv})">
          <circle class="halo" r=${r + 9} />
          <circle class="pin" r=${r} fill=${fill} />
          <g class="icon" transform="scale(${isCamera ? 0.85 : 0.75})">${MARKER_ICON[m.kind]}</g>
          ${m.state === 'offline' ? svg`<line x1="-9" y1="-9" x2="9" y2="9" stroke="#fff" stroke-width="2.5" />` : nothing}
          ${m.state === 'forbidden' ? svg`<g transform="translate(8 -8)"><circle r="6.5" fill="#fff" /><g fill="none" stroke="var(--sw-forbidden)" stroke-width="1.5" transform="scale(0.45)"><rect x="-6" y="-2" width="12" height="9" rx="2"/><path d="M-3.5 -2v-3a3.5 3.5 0 0 1 7 0v3"/></g></g>` : nothing}
          ${showLabel
            ? svg`<g transform="translate(${SwPlanCanvas.labelOffset(m.labelPos, r, labelWidth).x.toFixed(1)} ${SwPlanCanvas.labelOffset(m.labelPos, r, labelWidth).y.toFixed(1)})" data-label-pos=${m.labelPos ?? 'auto'}>
                <rect class="lbl-bg" x=${-labelWidth / 2} y="-10" width=${labelWidth} height="20" rx="6" />
                <text class="lbl" y="3.5">${m.label}</text>
              </g>`
            : nothing}
        </g>
      </g>
    `;
  }

  /** Primitives of the shown document, recomputed only when the document, the plan size, the level, the library or an
   * anchor position changes. */
  private primitives(doc: GeometryDoc): Primitive[] {
    const c = this.primCache;
    if (c && c.doc === doc && c.w === this.planWidth && c.h === this.planHeight && c.level === this.structureLevel && c.catalog === this.catalog && sameAnchors(c.anchors, this.anchorPositions)) return c.prims;
    const shown = Object.keys(this.anchorPositions).length ? applyAnchorPositions(doc, this.anchorPositions) : doc;
    const prims = buildPrimitives(shown, this.planWidth, this.planHeight, this.structureLevel, this.catalog ?? undefined);
    this.primCache = { doc, w: this.planWidth, h: this.planHeight, level: this.structureLevel, catalog: this.catalog, anchors: this.anchorPositions, prims };
    return prims;
  }

  private circuitTokens(): Map<string, string> {
    const doc = this.geometry;
    if (!doc) return new Map();
    if (this.circuitCache?.doc !== doc) {
      const tokens = new Map<string, string>();
      for (const k of doc.circuits) {
        const ok = circuitToken(k.color_token); // a document string never reaches the inline style unchecked
        if (ok) tokens.set(k.id, ok);
      }
      this.circuitCache = { doc, tokens };
    }
    return this.circuitCache.tokens;
  }

  private renderStructure() {
    const doc = this.geometry;
    if (!doc) return nothing;
    const inv = 1 / this.scale;
    const issues = new Set(this.issueIds);
    const marked = new Set(this.highlightIds);
    const shown = this.primitives(doc).filter((p) => (p.kind === 'object' ? !this.hideObjects : p.kind === 'connector' ? !this.hideConnectors : !this.hideStructure));
    // --inv: the CSS rules keep their outline and glow widths constant on screen, like the attribute widths below
    return svg`<g class="structure" data-structure style=${`--inv: ${inv}`}>${shown.map((p) => this.renderPrimitive(p, inv, issues, marked))}</g>`;
  }

  private renderPrimitive(p: Primitive, inv: number, issues: Set<string>, marked: Set<string> = new Set()) {
    const cls = `${p.id === this.selectedGeomId || marked.has(p.id) ? 'sel' : ''} ${issues.has(p.id) ? 'issue' : ''}`;
    switch (p.kind) {
      case 'wall':
        return svg`<g class="wall-g ${cls}" data-wall=${p.id}><polyline class="wall" points=${ptsAttr(p.points)} stroke-width=${p.width} /></g>`;
      case 'door':
        return svg`<g class="opening ${cls}" data-opening=${p.id} data-kind="door">
          ${p.leaves.map(([a, b]) => svg`<line class="leaf" x1=${a[0]} y1=${a[1]} x2=${b[0]} y2=${b[1]} stroke-width=${1.6 * inv} />`)}
          ${p.arcs.map((a) => svg`<path class="arc" d=${`M ${a.from[0]} ${a.from[1]} A ${a.r} ${a.r} 0 0 ${a.sweep} ${a.to[0]} ${a.to[1]}`} stroke-width=${1.1 * inv} stroke-dasharray=${`${4 * inv} ${3 * inv}`} />`)}
        </g>`;
      case 'window':
        return svg`<g class="opening ${cls}" data-opening=${p.id} data-kind="window">${p.lines.map(([a, b]) => svg`<line class="glass" x1=${a[0]} y1=${a[1]} x2=${b[0]} y2=${b[1]} stroke-width=${1.6 * inv} />`)}</g>`;
      case 'passage':
        return svg`<g class="opening ${cls}" data-opening=${p.id} data-kind="passage"><line class="gapline" x1=${p.gap[0][0]} y1=${p.gap[0][1]} x2=${p.gap[1][0]} y2=${p.gap[1][1]} stroke-width=${inv} stroke-dasharray=${`${2 * inv} ${3 * inv}`} /></g>`;
      case 'connector':
        return svg`<g class="conn ${cls}" data-connector=${p.id} data-kind=${p.ckind}>
          <path class="cbody" d=${`M ${p.points.map((q) => `${q[0]} ${q[1]}`).join(' L ')}`} stroke-width=${p.width} />
          <path class="carrow" d=${`M ${p.arrow.from[0]} ${p.arrow.from[1]} L ${p.arrow.to[0]} ${p.arrow.to[1]}`} stroke-width=${2 * inv} marker-end="url(#sw-arrow)" />
          <text class="clabel" x=${p.lx} y=${p.ly} font-size=${12 * inv}>${p.label}</text>
        </g>`;
      case 'object': {
        const entityId = p.anchor?.startsWith('ha_entity:') ? p.anchor.slice('ha_entity:'.length) : null; // only an entity anchor has a state
        const on = (p.circuit_id !== null && this.circuitStates[p.circuit_id] === 'on') || (entityId !== null && this.entityStates[entityId] === 'on');
        const token = p.circuit_id !== null ? this.circuitTokens().get(p.circuit_id) : undefined;
        const sym = Math.min(3, Math.max(0.35, (Math.min(p.w, p.h) * 0.6) / 24));
        return svg`<g class="obj ${cls} ${on ? 'glow' : ''}" data-object=${p.id} data-item=${p.item_id} data-shape=${p.shape} data-circuit=${p.circuit_id ?? nothing} ?data-glow=${on}
             style=${`--oc: var(--sw-obj-${p.color});${token ? ` --kc: var(--sw-${token});` : ''}`}>
          ${p.shape === 'cylinder'
            ? svg`<ellipse class="fp" cx=${p.cx} cy=${p.cy} rx=${p.w / 2} ry=${p.h / 2} transform=${`rotate(${p.rotation} ${p.cx} ${p.cy})`} stroke-width=${1.2 * inv} />`
            : svg`<polygon class="fp" points=${ptsAttr(p.corners)} stroke-width=${1.2 * inv} />`}
          ${p.steps.map(([a, b]) => svg`<line class="step" x1=${a[0]} y1=${a[1]} x2=${b[0]} y2=${b[1]} stroke-width=${inv} />`)}
          <g class="sym" transform=${`translate(${p.cx} ${p.cy}) rotate(${p.rotation}) scale(${sym}) translate(-12 -12)`} stroke-width=${1.6 / sym}>${symbolOf(p.icon)}</g>
          ${p.label && this.scale >= 0.6 ? svg`<text class="olabel" x=${p.cx} y=${p.cy + p.h / 2 + 12 * inv} font-size=${11 * inv}>${p.label}</text>` : nothing}
        </g>`;
      }
      case 'label':
        return svg`<text class="glabel ${cls}" data-label=${p.id} x=${p.x} y=${p.y} font-size=${p.size}>${p.text}</text>`;
    }
  }

  /** Placing tools get the cursor position once per frame; the editor snaps it and hands it back as hoverPoint. `item`:
   * the cursor is on an existing opening or label, where a press takes that item instead of placing a new one. */
  private queueHover(e: PointerEvent) {
    const rect = this.getBoundingClientRect();
    const p = this.toPlan(e.clientX - rect.left, e.clientY - rect.top);
    const under = e.composedPath()[0];
    const item = under instanceof Element && !!under.closest('[data-hit-opening], [data-hit-label]') && !this.nearCorner(e.clientX, e.clientY);
    this.hoverEvent = { x: p.x, y: p.y, shift: e.shiftKey, item };
    if (this.hoverFrame) return;
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = 0;
      const h = this.hoverEvent;
      if (h) this.dispatchEvent(new CustomEvent('plan-hover', { detail: h, bubbles: true, composed: true }));
    });
  }

  private pickGeom(id: string, e: Event) {
    e.stopPropagation();
    if (this.dragMoved) return;
    this.dispatchEvent(new CustomEvent('geom-select', { detail: { id, kind: 'wall' }, bubbles: true, composed: true }));
  }

  private pickConnector(id: string, e: Event) {
    e.stopPropagation();
    if (this.dragMoved) return;
    this.dispatchEvent(new CustomEvent('geom-select', { detail: { id, kind: 'connector' }, bubbles: true, composed: true }));
  }

  /** The selected object's handles: a rotate knob past its front edge and a stretch square on each edge midpoint. */
  private renderObjectHandles(p: ObjectPrim, inv: number) {
    const mid = (i: number): Pt => [(p.corners[i][0] + p.corners[(i + 1) % 4][0]) / 2, (p.corners[i][1] + p.corners[(i + 1) % 4][1]) / 2];
    const front = mid(0);
    const dx = front[0] - p.cx;
    const dy = front[1] - p.cy;
    const n = Math.hypot(dx, dy) || 1;
    const knob: Pt = [front[0] + (dx / n) * 18 * inv, front[1] + (dy / n) * 18 * inv];
    const hs = 5 * inv;
    return svg`<g class="ohandles">
      <line class="handle-line" x1=${front[0]} y1=${front[1]} x2=${knob[0]} y2=${knob[1]} />
      ${[0, 1, 2, 3].map((i) => { const m = mid(i); return svg`<rect class="handle" data-object-stretch=${i} x=${m[0] - hs} y=${m[1] - hs} width=${hs * 2} height=${hs * 2} rx=${1.5 * inv} role="slider" aria-label="מתיחה"
          @pointerdown=${(e: PointerEvent) => this.onGeomDragStart('object-stretch', p.id, i, e)} @click=${(e: Event) => e.stopPropagation()} />`; })}
      <circle class="handle" data-object-rotate cx=${knob[0]} cy=${knob[1]} r=${7 * inv} role="slider" aria-label="סיבוב" @pointerdown=${(e: PointerEvent) => this.onGeomDragStart('object-rotate', p.id, 0, e)} @click=${(e: Event) => e.stopPropagation()} />
    </g>`;
  }

  /** Wall mode (`cornerSnapPx`): the pointer is within the corner snap radius of a wall corner, where a press starts or
   * continues a wall instead of taking an opening or a label that lies under it. */
  private nearCorner(clientX: number, clientY: number): boolean {
    const doc = this.geometry;
    const r = this.cornerSnapPx;
    if (!doc || !(r > 0)) return false;
    const rect = this.getBoundingClientRect();
    const p = this.toPlan(clientX - rect.left, clientY - rect.top);
    return doc.walls.some((w) => w.polyline.some((v) => Math.hypot((v[0] - p.x) * this.planWidth, (v[1] - p.y) * this.planHeight) * this.scale <= r));
  }

  /** A press on an item cancels the browser's default action (preventDefault), which would have moved the focus: a form
   * field that still holds it gives it up here (its change, if any, is committed as on any blur), so the arrow keys
   * reach the item instead of stepping the field. Walks the shadow roots down to the element that really has focus. */
  private releaseFieldFocus() {
    let el: Element | null = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) el.blur();
  }

  /** Touch (0.1.87 fix round 1): an item that is not selected takes no press - a finger drag over it pans the plan -
   * and a tap selects it. */
  private touchPick(id: string, kind: 'object' | 'opening' | 'label', e: Event) {
    e.stopPropagation();
    if (this.dragMoved) return;
    this.dispatchEvent(new CustomEvent('geom-select', { detail: { id, kind }, bubbles: true, composed: true }));
  }

  /** On a touch screen only the selected item drags. */
  private touchLocked(id: string): boolean {
    return this.coarse && id !== this.selectedGeomId;
  }

  /** The click after a press on an opening or a label stays with the item, unless the press was left to the drawing tool. */
  private itemClick = (e: MouseEvent) => {
    if (!this.nearCorner(e.clientX, e.clientY)) e.stopPropagation();
  };

  /** Drag a corner of the selected wall, an opening along its wall, or a label. While the pointer moves, `geom-drag-move`
   * carries its position (the editor shows the item there; nothing is saved); the drop is one `geom-drag`, an interrupted
   * gesture a `geom-drag-cancel`. A press without movement selects the item (a corner: that corner of its wall). */
  private onGeomDragStart(kind: GeomDragDetail['kind'], id: string, index: number, e: PointerEvent) {
    const objectKind = kind.startsWith('object') || kind === 'connector-vertex';
    if (e.button !== 0 || this.geomDrag === 'none' || ((kind === 'vertex' || kind === 'wall') && this.geomDrag !== 'all') || (objectKind && this.geomDrag === 'items') || (!objectKind && this.geomDrag === 'objects')) return;
    if (kind !== 'vertex' && this.nearCorner(e.clientX, e.clientY)) return; // wall mode: the press draws from that corner
    e.stopPropagation(); // the press is the item's: no pan, and in a drawing mode no new point / opening either
    e.preventDefault();
    this.releaseFieldFocus();
    const rect0 = this.getBoundingClientRect();
    const start = this.toPlan(e.clientX - rect0.left, e.clientY - rect0.top);
    let moved = false;
    let last = start;
    let mods = { shift: e.shiftKey, alt: e.altKey };
    const detail = (p: { x: number; y: number }): GeomDragDetail => ({ kind, id, index, x: +p.x.toFixed(5), y: +p.y.toFixed(5), sx: +start.x.toFixed(5), sy: +start.y.toFixed(5), ...mods });
    const emit = (type: string, d: object) => this.dispatchEvent(new CustomEvent(type, { detail: d, bubbles: true, composed: true }));
    this.geomPress = true;
    this.viewport.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      mods = { shift: ev.shiftKey, alt: ev.altKey };
      const p = this.toPlan(ev.clientX - rect0.left, ev.clientY - rect0.top);
      if (!moved && Math.hypot((p.x - start.x) * this.planWidth, (p.y - start.y) * this.planHeight) * this.scale < 3) return;
      moved = true;
      last = p;
      this.geomDragAt = { x: p.x, y: p.y };
      emit('geom-drag-move', detail(p));
    };
    const end = () => {
      this.viewport.removeEventListener('pointermove', move);
      this.viewport.removeEventListener('pointerup', up);
      this.viewport.removeEventListener('pointercancel', cancel);
      this.geomDragAt = null;
      this.geomPress = false;
      this.dragMoved = true; // pointer capture sends the trailing click to the viewport: swallow it
      setTimeout(() => (this.dragMoved = false), 0);
    };
    const up = () => {
      end();
      if (moved) emit('geom-drag', detail(last));
      else emit('geom-select', kind === 'vertex' ? { id, kind: 'wall', vertex: index } : { id, kind: kind.startsWith('object') ? 'object' : kind === 'connector-vertex' ? 'connector' : kind });
    };
    const cancel = () => {
      end();
      if (moved) emit('geom-drag-cancel', detail(last)); // an interrupted gesture changes nothing
    };
    this.viewport.addEventListener('pointermove', move);
    this.viewport.addEventListener('pointerup', up);
    this.viewport.addEventListener('pointercancel', cancel);
  }

  /** Invisible wide strokes to pick an item, and the selected wall's corner handles (the closing corner of an outline is
   * one handle, index 0). 'all': wall parts, openings, labels and corners. 'items' (a drawing mode, `placing` is set):
   * openings and labels only, so a press on a bare wall or on the plan still reaches the tool. Openings and labels are
   * drawn after every wall part, so their targets sit above the walls': a press on an existing door takes that door.
   * An opening's target is 28 screen px thick, or the wall's drawn thickness when that is more: it covers the band in
   * which a placing click finds the wall (the editor also refuses a second opening inside an existing one's span).
   * Hotfix 0.1.87: the selected wall's body starts a whole-wall move (an unselected wall is only selected by a press, so
   * a first press never moves anything), and an object narrower than 24 screen px on either side gets a hit area of at
   * least 24 x 24 px around its centre; the stacking order still follows the drawn footprints (objectHitOrder), so a big
   * object never covers a small one inside it. Object hits sit above the unselected walls (a lamp against a wall keeps
   * its whole hit area) and below the selected wall's body. On a touch screen an item that is not selected takes no
   * press, only a tap (fix round 1). Markers stay above all of them. */
  private renderGeomHits() {
    const doc = this.geometry;
    const mode = this.geomDrag;
    if (!doc || mode === 'none') return nothing;
    const inv = 1 / this.scale;
    const W = this.planWidth;
    const H = this.planHeight;
    const prims = this.primitives(doc);
    const walls = mode === 'all' ? prims.filter((p): p is WallPrim => p.kind === 'wall') : [];
    const openings = mode === 'objects' ? [] : prims.filter((p): p is DoorPrim | WindowPrim | PassagePrim => p.kind === 'door' || p.kind === 'window' || p.kind === 'passage');
    const labels = mode === 'objects' ? [] : prims.filter((p): p is LabelPrim => p.kind === 'label');
    const wallPx = new Map<string, number>();
    for (const p of prims) if (p.kind === 'wall') wallPx.set(p.id, Math.max(wallPx.get(p.id) ?? 0, p.width));
    const hostOf = new Map(doc.openings.map((o) => [o.id, o.wall_id]));
    const selWall = mode === 'all' ? doc.walls.find((w) => w.id === this.selectedGeomId) : undefined;
    const wallHitPx = this.coarse ? WALL_HIT_TOUCH_PX : 12; // a finger needs a wider band than a mouse (0.1.87)
    const drag = this.geomDragAt;
    const objectsOn = mode === 'all' || mode === 'objects';
    const objects = objectsOn ? prims.filter((p): p is ObjectPrim => p.kind === 'object' && !this.hideObjects) : [];
    const connectors = objectsOn ? prims.filter((p): p is ConnectorPrim => p.kind === 'connector' && !this.hideConnectors) : [];
    const selObject = objectsOn && !drag ? objects.find((p) => p.id === this.selectedGeomId) : undefined;
    const selConnector = objectsOn ? doc.connectors.find((c) => c.id === this.selectedGeomId) : undefined;
    return svg`<g class="geom-hits">
      ${connectors.map((p) => svg`<path class="hit" data-hit-connector=${p.id} d=${`M ${p.points.map((q) => `${q[0]} ${q[1]}`).join(' L ')}`} stroke-width=${Math.max(p.width, 12 * inv)} @click=${(e: Event) => this.pickConnector(p.id, e)} />`)}
      ${walls.filter((p) => p.id !== this.selectedGeomId).map((p) => svg`<polyline class="hit" data-hit-wall=${p.id} points=${ptsAttr(p.points)} stroke-width=${Math.max(p.width, wallHitPx * inv)} @click=${(e: Event) => this.pickGeom(p.id, e)} />`)}
      ${objectHitOrder(objects, this.selectedGeomId).map((p) => svg`<polygon class="hit ohit" data-hit-object=${p.id} points=${ptsAttr(objectHitCorners(p, OBJECT_HIT_MIN_PX * inv))}
          @pointerdown=${(e: PointerEvent) => (this.touchLocked(p.id) ? undefined : this.onGeomDragStart(e.altKey ? 'object-duplicate' : 'object', p.id, 0, e))}
          @click=${(e: Event) => (this.touchLocked(p.id) ? this.touchPick(p.id, 'object', e) : e.stopPropagation())} />`)}
      ${selConnector && !selConnector.object_id ? selConnector.polyline.map((v, i) => svg`<circle class="gvtx" data-connector-vertex=${i} cx=${v[0] * W} cy=${v[1] * H} r=${6 * inv} stroke-width=${1.6 * inv} aria-label=${`פינת מחבר ${i + 1}`}
          @pointerdown=${(e: PointerEvent) => this.onGeomDragStart('connector-vertex', selConnector.id, i, e)} @click=${(e: Event) => e.stopPropagation()} />`) : nothing}
      ${selObject ? this.renderObjectHandles(selObject, inv) : nothing}
      ${walls.filter((p) => p.id === this.selectedGeomId).map((p) => svg`<polyline class="hit whit" data-hit-wall=${p.id} data-wall-body points=${ptsAttr(p.points)} stroke-width=${Math.max(p.width, wallHitPx * inv)}
          @pointerdown=${(e: PointerEvent) => this.onGeomDragStart('wall', p.id, 0, e)} @click=${(e: Event) => e.stopPropagation()} />`)}
      ${openings.map((p) => svg`<line class="hit" data-hit-opening=${p.id} x1=${p.gap[0][0]} y1=${p.gap[0][1]} x2=${p.gap[1][0]} y2=${p.gap[1][1]} stroke-width=${Math.max(28 * inv, wallPx.get(hostOf.get(p.id) ?? '') ?? 0)}
          @pointerdown=${(e: PointerEvent) => (this.touchLocked(p.id) ? undefined : this.onGeomDragStart('opening', p.id, 0, e))} @click=${(e: MouseEvent) => (this.touchLocked(p.id) ? this.touchPick(p.id, 'opening', e) : this.itemClick(e))} />`)}
      ${labels.map((p) => svg`<circle class="hit" data-hit-label=${p.id} cx=${p.x} cy=${p.y} r=${Math.max(p.size, 10 * inv)}
          @pointerdown=${(e: PointerEvent) => (this.touchLocked(p.id) ? undefined : this.onGeomDragStart('label', p.id, 0, e))} @click=${(e: MouseEvent) => (this.touchLocked(p.id) ? this.touchPick(p.id, 'label', e) : this.itemClick(e))} />`)}
      ${selWall ? (isClosedOutline(selWall.polyline) ? selWall.polyline.slice(0, -1) : selWall.polyline).map((v, i) => svg`<circle class="gvtx ${i === this.selectedVertex ? 'on' : ''}" data-wall-vertex=${i} cx=${v[0] * W} cy=${v[1] * H} r=${6 * inv} stroke-width=${1.6 * inv} aria-label=${`פינת קיר ${i + 1}`}
          @pointerdown=${(e: PointerEvent) => this.onGeomDragStart('vertex', selWall.id, i, e)} @click=${(e: Event) => e.stopPropagation()} />`) : nothing}
      ${drag ? svg`<circle class="gdrag" cx=${drag.x * W} cy=${drag.y * H} r=${5 * inv} stroke-width=${1.5 * inv} />` : nothing}
    </g>`;
  }

  /** Primitives of the candidate set on the shown document's dimensions; recomputed when the set, the document size or
   * the level changes (the level filter is not applied: candidates belong to the level the detect tool asked for). */
  private candidatePrims(set: CandidateSet): Primitive[] {
    const doc = this.geometry;
    if (!doc) return [];
    const c = this.candCache;
    if (c && c.set === set && c.doc === doc && c.w === this.planWidth && c.h === this.planHeight) return c.prims;
    const prims = buildPrimitives(candidatesDoc(doc, set), this.planWidth, this.planHeight);
    this.candCache = { set, doc, w: this.planWidth, h: this.planHeight, prims };
    return prims;
  }

  private candConfidence(set: CandidateSet, id: string): number {
    return set.walls.find((w) => w.id === id)?.confidence ?? set.openings.find((o) => o.id === id)?.confidence ?? 0;
  }

  /** Where the score pill sits: the middle of a wall's first part, the gap centre of an opening. Candidate primitives
   * are only ever wall / door / window / passage (candidatesDoc clears every other collection); the other Primitive
   * kinds are handled only so this stays exhaustive against the shared union type. */
  private candAnchor(prims: Primitive[], id: string): Pt | null {
    const p = prims.find((x) => x.id === id);
    if (!p) return null;
    if (p.kind === 'wall') {
      const a = p.points[0];
      const b = p.points[p.points.length - 1];
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
    if (p.kind === 'door' || p.kind === 'window' || p.kind === 'passage') return [(p.gap[0][0] + p.gap[1][0]) / 2, (p.gap[0][1] + p.gap[1][1]) / 2];
    return null;
  }

  private renderCandidates() {
    const set = this.candidates;
    if (!set) return nothing;
    const prims = this.candidatePrims(set);
    const inv = 1 / this.scale;
    const cls = (id: string) => `cand ${this.candidateStates[id] ?? 'accepted'} ${id === this.selectedCandidateId ? 'sel' : ''}`;
    const attrs = (id: string) => ({ state: this.candidateStates[id] ?? 'accepted', score: this.candConfidence(set, id).toFixed(2) });
    const shown = this.candHover ?? this.selectedCandidateId;
    const at = shown ? this.candAnchor(prims, shown) : null;
    const label = shown ? `ביטחון ${this.candConfidence(set, shown).toFixed(2)}` : '';
    const tw = (label.length * 7 + 16) * inv;
    return svg`<g class="candidates" data-candidates>
      ${prims.map((p) => {
        const a = attrs(p.id);
        switch (p.kind) {
          case 'wall':
            return svg`<g class=${cls(p.id)} data-candidate=${p.id} data-kind="wall" data-state=${a.state} data-score=${a.score}><polyline class="cwall" points=${ptsAttr(p.points)} stroke-width=${p.width} /></g>`;
          case 'door':
            return svg`<g class=${cls(p.id)} data-candidate=${p.id} data-kind="door" data-state=${a.state} data-score=${a.score}>
              ${p.leaves.map(([x, y]) => svg`<line class="cleaf" x1=${x[0]} y1=${x[1]} x2=${y[0]} y2=${y[1]} stroke-width=${1.6 * inv} />`)}
              ${p.arcs.map((arc) => svg`<path class="carc" d=${`M ${arc.from[0]} ${arc.from[1]} A ${arc.r} ${arc.r} 0 0 ${arc.sweep} ${arc.to[0]} ${arc.to[1]}`} stroke-width=${1.1 * inv} />`)}
            </g>`;
          case 'window':
            return svg`<g class=${cls(p.id)} data-candidate=${p.id} data-kind="window" data-state=${a.state} data-score=${a.score}>${p.lines.map(([x, y]) => svg`<line class="cglass" x1=${x[0]} y1=${x[1]} x2=${y[0]} y2=${y[1]} stroke-width=${1.6 * inv} />`)}</g>`;
          case 'passage':
            return svg`<g class=${cls(p.id)} data-candidate=${p.id} data-kind="passage" data-state=${a.state} data-score=${a.score}><line class="cgap" x1=${p.gap[0][0]} y1=${p.gap[0][1]} x2=${p.gap[1][0]} y2=${p.gap[1][1]} stroke-width=${inv} /></g>`;
          default:
            return nothing;
        }
      })}
      ${at ? svg`<g class="cand-score" data-cand-score data-cand-score-for=${shown ?? ''}><rect x=${at[0] - tw / 2} y=${at[1] - 22 * inv} width=${tw} height=${20 * inv} rx=${10 * inv} stroke-width=${inv} /><text x=${at[0]} y=${at[1] - 12 * inv} font-size=${12 * inv}>${label}</text></g>` : nothing}
    </g>`;
  }

  private pickCandidate(id: string, e: Event) {
    e.stopPropagation();
    if (this.dragMoved) return;
    this.dispatchEvent(new CustomEvent('candidate-select', { detail: { id }, bubbles: true, composed: true }));
  }

  private onCandDragStart(id: string, index: number, e: PointerEvent) {
    if (!this.candidateEditable || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    this.releaseFieldFocus(); // the prevented press would leave a panel field focused: Delete and the keys must reach the candidate
    const rect0 = this.getBoundingClientRect();
    const start = this.toPlan(e.clientX - rect0.left, e.clientY - rect0.top);
    let moved = false;
    let last = start;
    this.viewport.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const p = this.toPlan(ev.clientX - rect0.left, ev.clientY - rect0.top);
      if (!moved && Math.hypot((p.x - start.x) * this.planWidth, (p.y - start.y) * this.planHeight) * this.scale < 3) return;
      moved = true;
      last = p;
      this.candDrag = { x: p.x, y: p.y };
    };
    const end = () => {
      this.viewport.removeEventListener('pointermove', move);
      this.viewport.removeEventListener('pointerup', up);
      this.viewport.removeEventListener('pointercancel', cancel);
      this.candDrag = null;
      this.dragMoved = true;
      setTimeout(() => (this.dragMoved = false), 0);
    };
    const up = () => {
      end();
      if (moved) this.dispatchEvent(new CustomEvent('candidate-drag', { detail: { id, index, x: +last.x.toFixed(5), y: +last.y.toFixed(5) }, bubbles: true, composed: true }));
    };
    const cancel = () => end();
    this.viewport.addEventListener('pointermove', move);
    this.viewport.addEventListener('pointerup', up);
    this.viewport.addEventListener('pointercancel', cancel);
  }

  /** Wide invisible strokes over the candidates (a click toggles, hovering shows the score) and, on desktop, the end
   * handles of the selected candidate wall. Above the structure hits, below the markers. */
  private renderCandidateHits() {
    const set = this.candidates;
    if (!set) return nothing;
    const prims = this.candidatePrims(set);
    const inv = 1 / this.scale;
    const W = this.planWidth;
    const H = this.planHeight;
    const sel = set.walls.find((w) => w.id === this.selectedCandidateId);
    const drag = this.candDrag;
    return svg`<g class="cand-hits">
      ${prims.map((p) => {
        const over = () => (this.candHover = p.id);
        const out = () => (this.candHover = null);
        if (p.kind === 'wall') return svg`<polyline class="hit" data-cand-hit=${p.id} points=${ptsAttr(p.points)} stroke-width=${Math.max(p.width, 12 * inv)} @click=${(e: Event) => this.pickCandidate(p.id, e)} @pointerenter=${over} @pointerleave=${out} />`;
        if (p.kind === 'door' || p.kind === 'window' || p.kind === 'passage') return svg`<line class="hit" data-cand-hit=${p.id} x1=${p.gap[0][0]} y1=${p.gap[0][1]} x2=${p.gap[1][0]} y2=${p.gap[1][1]} stroke-width=${14 * inv} @click=${(e: Event) => this.pickCandidate(p.id, e)} @pointerenter=${over} @pointerleave=${out} />`;
        return nothing;
      })}
      ${sel && this.candidateEditable ? sel.polyline.map((v, i) => svg`<circle class="cvtx" data-cand-vertex=${i} cx=${v[0] * W} cy=${v[1] * H} r=${6 * inv} stroke-width=${1.6 * inv} aria-label=${`קצה מועמד ${i + 1}`}
          @pointerdown=${(e: PointerEvent) => this.onCandDragStart(sel.id, i, e)} @click=${(e: Event) => e.stopPropagation()} />`) : nothing}
      ${drag ? svg`<circle class="gdrag" cx=${drag.x * W} cy=${drag.y * H} r=${5 * inv} stroke-width=${1.5 * inv} />` : nothing}
    </g>`;
  }

  /** The wall being drawn, the rubber band to the snapped cursor, and the snap dot. */
  private renderWallDraft() {
    const pts = this.wallDraft;
    const h = this.hoverPoint;
    if (!pts.length && !h) return nothing;
    const inv = 1 / this.scale;
    const W = this.planWidth;
    const H = this.planHeight;
    const line = [...pts, ...(h && pts.length ? [h] : [])].map((p) => `${p[0] * W},${p[1] * H}`).join(' ');
    return svg`<g class="wdraft" pointer-events="none">
      ${pts.length ? svg`<polyline points=${line} stroke-width=${2 * inv} stroke-dasharray=${`${6 * inv} ${4 * inv}`} />` : nothing}
      ${pts.map((p) => svg`<circle cx=${p[0] * W} cy=${p[1] * H} r=${3.5 * inv} stroke-width=${1.5 * inv} />`)}
      ${h ? svg`<circle class="snap" data-hover-point cx=${h[0] * W} cy=${h[1] * H} r=${4.5 * inv} stroke-width=${1.5 * inv} />` : nothing}
    </g>`;
  }

  private renderRulers() {
    if (!this.rulers.length) return nothing;
    const inv = 1 / this.scale;
    const W = this.planWidth;
    const H = this.planHeight;
    return svg`<g class="rulers" pointer-events="none">
      ${this.rulers.map((r) => {
        const ax = r.a[0] * W;
        const ay = r.a[1] * H;
        const bx = r.b[0] * W;
        const by = r.b[1] * H;
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        const tw = (r.label.length * 7 + 14) * inv;
        return svg`<g class="ruler ${r.tone}" data-ruler>
          <line x1=${ax} y1=${ay} x2=${bx} y2=${by} stroke-width=${2 * inv} stroke-dasharray=${r.tone === 'muted' ? `${4 * inv} ${3 * inv}` : nothing} />
          <circle cx=${ax} cy=${ay} r=${3.5 * inv} stroke-width=${1.5 * inv} />
          <circle cx=${bx} cy=${by} r=${3.5 * inv} stroke-width=${1.5 * inv} />
          ${r.label
            ? svg`<rect x=${mx - tw / 2} y=${my - 11 * inv} width=${tw} height=${22 * inv} rx=${11 * inv} stroke-width=${inv} /><text x=${mx} y=${my} font-size=${12 * inv}>${r.label}</text>`
            : nothing}
        </g>`;
      })}
    </g>`;
  }

  render() {
    return html`
      <div class="viewport ${this.placing ? 'placing' : ''} ${this.boxSelect ? 'boxing' : ''}" @wheel=${this.onWheel} @pointerdown=${this.onPointerDown} @pointermove=${this.onPointerMove}
           @pointerup=${this.onPointerUp} @pointercancel=${this.onPointerUp} @click=${this.onBackgroundClick}>
        <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="תוכנית קומה">
          <defs><marker id="sw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path class="carrowhead" d="M0 0L10 5L0 10z" /></marker></defs>
          <g transform="translate(${this.tx} ${this.ty}) scale(${this.scale})">
            ${this.imageUrl ? svg`<image href=${this.imageUrl} x="0" y="0" width=${this.planWidth} height=${this.planHeight} preserveAspectRatio="none" />` : nothing}
            ${this.plan ?? nothing}
            ${this.zones.map((z) => this.renderZone(z))}
            ${this.renderStructure()}
            ${this.renderGeomHits()}
            ${this.renderCandidates()}
            ${this.renderCandidateHits()}
            ${this.markers.map((m) => this.renderMarker(m))}
            ${this.renderDraft()}
            ${this.renderWallDraft()}
            ${this.renderRulers()}
          </g>
          ${this.box ? svg`<rect class="box" data-box x=${this.box.x0.toFixed(1)} y=${this.box.y0.toFixed(1)} width=${(this.box.x1 - this.box.x0).toFixed(1)} height=${(this.box.y1 - this.box.y0).toFixed(1)} />` : nothing}
        </svg>
      </div>
      <div class="controls" role="group" aria-label="זום">
        <sw-button variant="ghost" size="sm" iconOnly icon="plus" label=${t('floor.zoomIn')} @click=${() => this.zoomBy(1.25)}></sw-button>
        <sw-button variant="ghost" size="sm" iconOnly icon="minus" label=${t('floor.zoomOut')} @click=${() => this.zoomBy(0.8)}></sw-button>
        <sw-button variant="ghost" size="sm" iconOnly icon="fit" label=${t('floor.fit')} @click=${() => { this.fitted = false; this.fit(); }}></sw-button>
      </div>
      <div class="scale" aria-live="polite">${Math.round(this.scale * 100)}%</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-plan-canvas': SwPlanCanvas;
  }
}
