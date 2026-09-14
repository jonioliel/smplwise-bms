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

const MIN_SCALE = 0.2;
const MAX_SCALE = 6;

const STATE_COLOR: Partial<Record<StateKind, string>> = {
  live: 'var(--sw-live)',
  recorded: 'var(--sw-recorded)',
  historic: 'var(--sw-recorded)',
  offline: 'var(--sw-offline)',
  stale: 'var(--sw-stale)',
  unknown: 'var(--sw-unknown)',
  forbidden: 'var(--sw-forbidden)',
  error: 'var(--sw-danger)',
  neutral: 'var(--sw-text-2)',
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
 */
@customElement('sw-plan-canvas')
export class SwPlanCanvas extends LitElement {
  @property({ type: Number }) planWidth = 1000;
  @property({ type: Number }) planHeight = 700;
  @property({ attribute: false }) plan: SVGTemplateResult | null = null;
  @property({ attribute: false }) markers: PlanMarker[] = [];
  @property() selectedId: string | null = null;
  @property({ type: Boolean }) dimEntities = false;

  @state() private scale = 1;
  @state() private tx = 0;
  @state() private ty = 0;
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
    .marker:focus-visible .ring {
      stroke-width: 4;
    }
    .marker .ring {
      fill: var(--sw-surface);
      stroke-width: 3;
      filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.25));
    }
    .marker.selected .ring {
      stroke-width: 5;
    }
    .marker .icon {
      fill: none;
      stroke: var(--sw-text);
      stroke-width: 1.7;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .marker.dimmed {
      opacity: 0.55;
    }
    .marker.offline .icon,
    .marker.forbidden .icon {
      stroke: var(--sw-text-3);
    }
    .marker .lbl-bg {
      fill: var(--sw-surface);
      stroke: var(--sw-border);
    }
    .marker .lbl {
      font-family: var(--sw-font);
      font-size: 12px;
      font-weight: 600;
      fill: var(--sw-text);
      text-anchor: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    .fov {
      fill: var(--sw-fov);
      stroke: var(--sw-accent);
      stroke-opacity: 0.35;
      stroke-width: 1;
    }
    .controls {
      position: absolute;
      right: var(--sw-s-3);
      bottom: var(--sw-s-3);
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      box-shadow: var(--sw-shadow-1);
      padding: 2px;
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

  private select(id: string, e: Event) {
    if (this.dragMoved) return;
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('marker-select', { detail: { id }, bubbles: true, composed: true }));
  }

  private onBackgroundClick = () => {
    if (this.dragMoved) return;
    this.dispatchEvent(new CustomEvent('marker-select', { detail: { id: null }, bubbles: true, composed: true }));
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
    const px = m.x * this.planWidth;
    const py = m.y * this.planHeight;
    const inv = 1 / this.scale;
    const color = STATE_COLOR[m.state] ?? STATE_COLOR.neutral;
    const isCamera = m.kind === 'camera';
    const showLabel = this.scale > 0.3 || this.selectedId === m.id;
    const labelWidth = Math.max(48, m.label.length * 7 + 16);
    const dimmed = this.dimEntities && !isCamera;
    return svg`
      <g class="marker ${m.state} ${this.selectedId === m.id ? 'selected' : ''} ${dimmed ? 'dimmed' : ''}"
         transform="translate(${px} ${py})"
         tabindex="0" role="button" aria-label=${m.label} aria-pressed=${this.selectedId === m.id}
         @click=${(e: Event) => this.select(m.id, e)}
         @keydown=${(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && this.select(m.id, e)}>
        ${isCamera && m.fov && m.state !== 'forbidden'
          ? svg`<path class="fov" d=${this.fovPath(m.rotation ?? 0, m.fov, 110)} />`
          : nothing}
        <g transform="scale(${inv})">
          <circle class="ring" r="16" stroke=${color} />
          <g class="icon">${MARKER_ICON[m.kind]}</g>
          ${m.state === 'offline' ? svg`<line x1="-11" y1="-11" x2="11" y2="11" stroke=${color} stroke-width="2.5" />` : nothing}
          ${showLabel
            ? svg`<g transform="translate(0 30)">
                <rect class="lbl-bg" x=${-labelWidth / 2} y="-11" width=${labelWidth} height="22" rx="11" />
                <text class="lbl" y="4">${m.label}</text>
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
