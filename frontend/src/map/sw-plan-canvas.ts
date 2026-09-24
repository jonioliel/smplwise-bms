import { LitElement, html, css, svg, nothing, type SVGTemplateResult } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import '../components/sw-button';
import { t } from '../i18n/he';
import type { StateKind } from '../components/sw-badge';
import { buildPrimitives, isClosedOutline, type GeometryDoc, type Primitive, type Pt } from './geometry';

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
  state: StateKind;
}

export interface MarkerSelectDetail {
  id: string | null;
  /** Marker centre in host (stage) pixels, for anchoring a popover. */
  sx?: number;
  sy?: number;
}

const MIN_SCALE = 0.2;
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
  private primCache: { doc: GeometryDoc; w: number; h: number; level: string | null; prims: Primitive[] } | null = null;
  /** Plan Studio editor: walls, openings and labels can be picked and dragged (the structure tool's select mode). */
  @property({ type: Boolean }) geomEditable = false;
  /** The wall being drawn (normalized points) and the snapped cursor the editor computed (rubber band, snap dot). */
  @property({ attribute: false }) wallDraft: Pt[] = [];
  @property({ attribute: false }) hoverPoint: Pt | null = null;
  @property({ attribute: false }) rulers: RulerOverlay[] = [];
  @state() private geomDrag: { x: number; y: number } | null = null;
  private hoverFrame = 0;
  private hoverEvent: { x: number; y: number; shift: boolean } | null = null;
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
      cursor: ew-resize;
    }
    .gvtx {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
      cursor: grab;
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
      stroke-dasharray: 4 3;
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
    if (!this.editable || e.button !== 0) return;
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
    if (this.placing && e.pointerType !== 'touch') this.queueHover(e);
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
      if (changed) this.dispatchEvent(new CustomEvent('zone-edit', { detail: { id: z.id, polygon: poly }, bubbles: true, composed: true }));
    };
    this.viewport.addEventListener('pointermove', move);
    this.viewport.addEventListener('pointerup', up);
    this.viewport.addEventListener('pointercancel', up);
  }

  private removeVertex(z: PlanZone, index: number, e: Event) {
    e.stopPropagation();
    if (!this.editable || z.polygon.length <= 3) return;
    const polygon = z.polygon.filter((_, i) => i !== index);
    this.dispatchEvent(new CustomEvent('zone-edit', { detail: { id: z.id, polygon }, bubbles: true, composed: true }));
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
      ${poly.map((p, i) => svg`<circle class="vtx" data-vertex=${i} cx=${(p.x * W).toFixed(1)} cy=${(p.y * H).toFixed(1)} r=${(6 * inv).toFixed(2)} stroke-width=${(1.6 * inv).toFixed(2)} role="slider" aria-label=${`פינה ${i + 1}`}
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
    return svg`
      <g class="zone ${selected ? 'selected' : ''} ${z.candidate ? 'candidate' : ''}" style="--zc:${z.color}" role="button" tabindex="0" aria-label=${z.name} aria-pressed=${selected}
         data-zone=${z.id}
         @click=${(e: Event) => this.selectZone(z, e)} @keydown=${(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && this.selectZone(z, e)}>
        <polygon points=${pts} stroke-width=${((selected ? 2.2 : 1.4) * inv).toFixed(2)} />
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
         @click=${(e: Event) => (this.editable ? e.stopPropagation() : this.select(m, e))}
         @keydown=${(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && this.select(m, e)}>
        ${isCamera && fov && m.state !== 'forbidden'
          ? (() => { const poly = this.polygonPath(m); return poly
            ? svg`<polygon class="fov ${m.state === 'offline' ? 'off' : ''}" data-cov-polygon points=${poly} />`
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

  /** Primitives of the shown document, recomputed only when the document, the plan size or the level changes. */
  private primitives(doc: GeometryDoc): Primitive[] {
    const c = this.primCache;
    if (c && c.doc === doc && c.w === this.planWidth && c.h === this.planHeight && c.level === this.structureLevel) return c.prims;
    const prims = buildPrimitives(doc, this.planWidth, this.planHeight, this.structureLevel);
    this.primCache = { doc, w: this.planWidth, h: this.planHeight, level: this.structureLevel, prims };
    return prims;
  }

  private renderStructure() {
    const doc = this.geometry;
    if (!doc) return nothing;
    const inv = 1 / this.scale;
    const issues = new Set(this.issueIds);
    return svg`<g class="structure" data-structure>${this.primitives(doc).map((p) => this.renderPrimitive(p, inv, issues))}</g>`;
  }

  private renderPrimitive(p: Primitive, inv: number, issues: Set<string>) {
    const cls = `${p.id === this.selectedGeomId ? 'sel' : ''} ${issues.has(p.id) ? 'issue' : ''}`;
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
      case 'label':
        return svg`<text class="glabel ${cls}" data-label=${p.id} x=${p.x} y=${p.y} font-size=${p.size}>${p.text}</text>`;
    }
  }

  /** Placing tools get the cursor position once per frame; the editor snaps it and hands it back as hoverPoint. */
  private queueHover(e: PointerEvent) {
    const rect = this.getBoundingClientRect();
    const p = this.toPlan(e.clientX - rect.left, e.clientY - rect.top);
    this.hoverEvent = { x: p.x, y: p.y, shift: e.shiftKey };
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

  /** Drag a corner of the selected wall, an opening along its wall, or a label; a press without movement selects. */
  private onGeomDragStart(kind: 'vertex' | 'opening' | 'label', id: string, index: number, e: PointerEvent) {
    if (!this.geomEditable || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
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
      this.geomDrag = { x: p.x, y: p.y };
    };
    const end = () => {
      this.viewport.removeEventListener('pointermove', move);
      this.viewport.removeEventListener('pointerup', up);
      this.viewport.removeEventListener('pointercancel', cancel);
      this.geomDrag = null;
      this.dragMoved = true; // pointer capture sends the trailing click to the viewport: swallow it
      setTimeout(() => (this.dragMoved = false), 0);
    };
    const up = () => {
      end();
      if (moved) this.dispatchEvent(new CustomEvent('geom-drag', { detail: { kind, id, index, x: +last.x.toFixed(5), y: +last.y.toFixed(5) }, bubbles: true, composed: true }));
      else if (kind !== 'vertex') this.dispatchEvent(new CustomEvent('geom-select', { detail: { id, kind }, bubbles: true, composed: true }));
    };
    const cancel = () => end(); // an interrupted gesture changes nothing
    this.viewport.addEventListener('pointermove', move);
    this.viewport.addEventListener('pointerup', up);
    this.viewport.addEventListener('pointercancel', cancel);
  }

  /** Invisible wide strokes to pick a wall part, an opening or a label, and the selected wall's corner handles (the
   * closing corner of an outline is one handle, index 0). Hidden while a placing tool is active, so clicks reach the
   * plan. Markers stay above them. */
  private renderGeomHits() {
    const doc = this.geometry;
    if (!doc || !this.geomEditable || this.placing) return nothing;
    const inv = 1 / this.scale;
    const W = this.planWidth;
    const H = this.planHeight;
    const selWall = doc.walls.find((w) => w.id === this.selectedGeomId);
    const drag = this.geomDrag;
    return svg`<g class="geom-hits">
      ${this.primitives(doc).map((p) => {
        if (p.kind === 'wall') return svg`<polyline class="hit" data-hit-wall=${p.id} points=${ptsAttr(p.points)} stroke-width=${Math.max(p.width, 12 * inv)} @click=${(e: Event) => this.pickGeom(p.id, e)} />`;
        if (p.kind === 'label') return svg`<circle class="hit" data-hit-label=${p.id} cx=${p.x} cy=${p.y} r=${Math.max(p.size, 10 * inv)} @pointerdown=${(e: PointerEvent) => this.onGeomDragStart('label', p.id, 0, e)} @click=${(e: Event) => e.stopPropagation()} />`;
        return svg`<line class="hit" data-hit-opening=${p.id} x1=${p.gap[0][0]} y1=${p.gap[0][1]} x2=${p.gap[1][0]} y2=${p.gap[1][1]} stroke-width=${14 * inv} @pointerdown=${(e: PointerEvent) => this.onGeomDragStart('opening', p.id, 0, e)} @click=${(e: Event) => e.stopPropagation()} />`;
      })}
      ${selWall ? (isClosedOutline(selWall.polyline) ? selWall.polyline.slice(0, -1) : selWall.polyline).map((v, i) => svg`<circle class="gvtx" data-wall-vertex=${i} cx=${v[0] * W} cy=${v[1] * H} r=${6 * inv} stroke-width=${1.6 * inv} role="slider" aria-label=${`פינת קיר ${i + 1}`}
          @pointerdown=${(e: PointerEvent) => this.onGeomDragStart('vertex', selWall.id, i, e)} @click=${(e: Event) => e.stopPropagation()} />`) : nothing}
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
          <line x1=${ax} y1=${ay} x2=${bx} y2=${by} stroke-width=${2 * inv} />
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
          <g transform="translate(${this.tx} ${this.ty}) scale(${this.scale})">
            ${this.imageUrl ? svg`<image href=${this.imageUrl} x="0" y="0" width=${this.planWidth} height=${this.planHeight} preserveAspectRatio="none" />` : nothing}
            ${this.plan ?? nothing}
            ${this.zones.map((z) => this.renderZone(z))}
            ${this.renderStructure()}
            ${this.renderGeomHits()}
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
