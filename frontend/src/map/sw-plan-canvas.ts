import { LitElement, html, css, svg, nothing, type SVGTemplateResult } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import '../components/sw-button';
import { t } from '../i18n/he';
import type { StateKind } from '../components/sw-badge';

export type MarkerKind = 'camera' | 'lock' | 'light' | 'binary_sensor';

export interface PlanMarker {
  id: string;
  kind: MarkerKind;
  label: string;
  x: number; // normalized 0..1 in plan space (origin top-left)
  y: number;
  rotation?: number; // degrees, cameras only
  fov?: number; // degrees, cameras only
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
@customElement('sw-plan-canvas')
export class SwPlanCanvas extends LitElement {
  @property({ type: Number }) planWidth = 1000;
  @property({ type: Number }) planHeight = 700;
  @property({ attribute: false }) plan: SVGTemplateResult | null = null;
  @property({ attribute: false }) markers: PlanMarker[] = [];
  @property() selectedId: string | null = null;
  @property({ type: Boolean }) dimEntities = false;

  @property({ type: Boolean }) alwaysLabel = false;
  /** Raster background (published plan image); drawn under `plan` when set. */
  @property() imageUrl: string | null = null;
  /** Editor mode: markers can be dragged; emits `marker-move` {id, x, y} (normalized) on drop. */
  @property({ type: Boolean }) editable = false;

  @state() private scale = 1;
  @state() private tx = 0;
  @state() private ty = 0;
  @state() private hoverId: string | null = null;
  @state() private dragging: { id: string; x: number; y: number } | null = null;
  @query('.viewport') private viewport!: HTMLDivElement;

  private pointers = new Map<number, { x: number; y: number }>();
  private lastPan: { x: number; y: number } | null = null;
  private lastPinchDist = 0;
  private dragMoved = false;
  private resizeObserver?: ResizeObserver;
  private fitted = false;

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
      right: var(--sw-s-3);
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
      left: var(--sw-s-3);
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
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
    this.tx = (w - this.planWidth * this.scale) / 2;
    this.ty = (h - this.planHeight * this.scale) / 2;
    this.fitted = true;
  }

  zoomBy(factor: number, cx?: number, cy?: number) {
    const w = this.clientWidth;
    const h = this.clientHeight;
    const px = cx ?? w / 2;
    const py = cy ?? h / 2;
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.scale * factor));
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
      if (moved) this.dispatchEvent(new CustomEvent('marker-move', { detail: { id: m.id, x: p.x, y: p.y }, bubbles: true, composed: true }));
      else this.select(m, ev);
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
      this.lastPan = { x: e.clientX, y: e.clientY };
      this.viewport.classList.add('dragging');
    } else if (this.pointers.size === 2) {
      this.lastPinchDist = this.pinchDistance();
      this.lastPan = null;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
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

  private onBackgroundClick = () => {
    if (this.dragMoved) return;
    this.dispatchEvent(new CustomEvent<MarkerSelectDetail>('marker-select', { detail: { id: null }, bubbles: true, composed: true }));
  };

  private fovPath(rotation: number, fov: number, radius: number) {
    const start = ((rotation - fov / 2) * Math.PI) / 180;
    const end = ((rotation + fov / 2) * Math.PI) / 180;
    const x1 = Math.cos(start) * radius;
    const y1 = Math.sin(start) * radius;
    const x2 = Math.cos(end) * radius;
    const y2 = Math.sin(end) * radius;
    return `M0 0 L${x1.toFixed(1)} ${y1.toFixed(1)} A${radius} ${radius} 0 ${fov > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
  }

  private renderMarker(m: PlanMarker) {
    const live = this.dragging?.id === m.id ? this.dragging : m;
    const px = live.x * this.planWidth;
    const py = live.y * this.planHeight;
    const inv = 1 / this.scale;
    const isCamera = m.kind === 'camera';
    const fill = PIN_FILL[m.state] ?? PIN_FILL.neutral;
    const selected = this.selectedId === m.id;
    // Boards show bare pins; the name appears on hover / selection (labels never intercept clicks).
    const showLabel = this.alwaysLabel || selected || this.hoverId === m.id;
    const labelWidth = Math.max(44, m.label.length * 6.5 + 16);
    const dimmed = this.dimEntities && !isCamera;
    const r = isCamera ? 13 : 11;
    return svg`
      <g class="marker ${m.state} ${selected ? 'selected' : ''} ${dimmed ? 'dimmed' : ''} ${this.editable ? 'editable' : ''}"
         transform="translate(${px} ${py})"
         tabindex="0" role="button" aria-label=${m.label} aria-pressed=${selected}
         @mouseenter=${() => (this.hoverId = m.id)} @mouseleave=${() => (this.hoverId = null)}
         @pointerdown=${(e: PointerEvent) => this.onMarkerPointerDown(m, e)}
         @click=${(e: Event) => (this.editable ? e.stopPropagation() : this.select(m, e))}
         @keydown=${(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && this.select(m, e)}>
        ${isCamera && m.fov && m.state !== 'forbidden'
          ? svg`<path class="fov ${m.state === 'offline' ? 'off' : ''}" d=${this.fovPath(m.rotation ?? 0, m.fov, 140)} />`
          : nothing}
        <g transform="scale(${inv})">
          <circle class="halo" r=${r + 9} />
          <circle class="pin" r=${r} fill=${fill} />
          <g class="icon" transform="scale(${isCamera ? 0.85 : 0.75})">${MARKER_ICON[m.kind]}</g>
          ${m.state === 'offline' ? svg`<line x1="-9" y1="-9" x2="9" y2="9" stroke="#fff" stroke-width="2.5" />` : nothing}
          ${m.state === 'forbidden' ? svg`<g transform="translate(8 -8)"><circle r="6.5" fill="#fff" /><g fill="none" stroke="var(--sw-forbidden)" stroke-width="1.5" transform="scale(0.45)"><rect x="-6" y="-2" width="12" height="9" rx="2"/><path d="M-3.5 -2v-3a3.5 3.5 0 0 1 7 0v3"/></g></g>` : nothing}
          ${showLabel
            ? svg`<g transform="translate(0 ${r + 14})">
                <rect class="lbl-bg" x=${-labelWidth / 2} y="-10" width=${labelWidth} height="20" rx="6" />
                <text class="lbl" y="3.5">${m.label}</text>
              </g>`
            : nothing}
        </g>
      </g>
    `;
  }

  render() {
    return html`
      <div class="viewport" @wheel=${this.onWheel} @pointerdown=${this.onPointerDown} @pointermove=${this.onPointerMove}
           @pointerup=${this.onPointerUp} @pointercancel=${this.onPointerUp} @click=${this.onBackgroundClick}>
        <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="תוכנית קומה">
          <g transform="translate(${this.tx} ${this.ty}) scale(${this.scale})">
            ${this.imageUrl ? svg`<image href=${this.imageUrl} x="0" y="0" width=${this.planWidth} height=${this.planHeight} preserveAspectRatio="none" />` : nothing}
            ${this.plan ?? nothing}
            ${this.markers.map((m) => this.renderMarker(m))}
          </g>
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
