/**
 * K88: the alignment stage of an own floor image - the plan's outline (its rooms and walls) with the picture drawn
 * over it at the current corners; the four corner handles drag (a corner at a time), the picture body drags whole,
 * arrow keys nudge the focused handle (1 plan pixel; Shift 10). Emits `corners-change` with the new corners on every
 * change (the host saves on "שמור יישור"). Pure presentation: no API calls.
 */
import { LitElement, css, html, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { affineAttr, affineFromCorners, applyAffine, cornerResidual, moveCorner, shiftCorners, type Corners } from './floor-image';

const HANDLE_NAMES = ['פינה שמאלית-עליונה', 'פינה ימנית-עליונה', 'פינה ימנית-תחתונה', 'פינה שמאלית-תחתונה'];

@customElement('sw-floor-image-align')
export class SwFloorImageAlign extends LitElement {
  @property({ type: Number }) planWidth = 1000;
  @property({ type: Number }) planHeight = 700;
  /** The plan picture behind everything (faint), when the viewer wants it. */
  @property() planUrl: string | null = null;
  @property({ type: Boolean }) showPlan = true;
  @property() imageUrl: string | null = null;
  @property({ attribute: false }) corners: Corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
  @property({ type: Number }) opacity = 0.7;
  /** Room outlines (normalised polygons) and wall segments (normalised [[x0,y0],[x1,y1]]). */
  @property({ attribute: false }) rooms: { id: string; polygon: { x: number; y: number }[] }[] = [];
  @property({ attribute: false }) walls: [[number, number], [number, number]][] = [];
  @property({ type: Boolean }) disabled = false;
  @state() private drag: { kind: 'corner' | 'body'; index: number; startX: number; startY: number; start: Corners } | null = null;

  static styles = css`
    :host {
      display: block;
      position: relative;
      inline-size: 100%;
      aspect-ratio: var(--ar, 3 / 2);
      max-block-size: 60vh;
      background: var(--sw-map-bg);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      overflow: hidden;
      touch-action: none;
      direction: ltr;
    }
    svg {
      display: block;
      inline-size: 100%;
      block-size: 100%;
    }
    .room {
      fill: var(--sw-map-room-fill);
      fill-opacity: 0.35;
      stroke: var(--sw-map-structure);
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
    }
    .wall {
      stroke: var(--sw-map-structure);
      stroke-width: 3;
      vector-effect: non-scaling-stroke;
      stroke-linecap: round;
    }
    .frame {
      fill: none;
      stroke: var(--sw-accent);
      stroke-width: 1.5;
      stroke-dasharray: 6 4;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .body {
      fill: transparent;
      cursor: move;
    }
    .handle {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      cursor: grab;
    }
    .handle:focus-visible {
      outline: none;
      stroke: var(--sw-text);
      stroke-width: 3;
    }
    :host([disabled]) .handle,
    :host([disabled]) .body {
      cursor: default;
    }
    .res {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-end: 6px;
      font-size: 11px;
      color: var(--sw-text-3);
      background: color-mix(in srgb, var(--sw-surface) 85%, transparent);
      padding: 2px 6px;
      border-radius: 4px;
      direction: rtl;
    }
  `;

  protected willUpdate(): void {
    this.style.setProperty('--ar', `${this.planWidth} / ${this.planHeight}`);
  }

  private toPlan(e: PointerEvent): { x: number; y: number } {
    const r = this.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * this.planWidth, y: ((e.clientY - r.top) / r.height) * this.planHeight };
  }

  private down(e: PointerEvent, kind: 'corner' | 'body', index: number) {
    if (this.disabled || e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = this.toPlan(e);
    this.drag = { kind, index, startX: p.x, startY: p.y, start: this.corners.map((c) => [c[0], c[1]] as [number, number]) };
  }

  private move(e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    const p = this.toPlan(e);
    const dx = (p.x - d.startX) / this.planWidth, dy = (p.y - d.startY) / this.planHeight;
    const next = d.kind === 'body' ? shiftCorners(d.start, dx, dy) : moveCorner(d.start, d.index, { x: d.start[d.index][0] + dx, y: d.start[d.index][1] + dy });
    this.emit(next);
  }

  private up() {
    this.drag = null;
  }

  private key(e: KeyboardEvent, index: number) {
    if (this.disabled) return;
    const step = (e.shiftKey ? 10 : 1);
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    const c = this.corners[index];
    this.emit(moveCorner(this.corners, index, { x: c[0] + dx / this.planWidth, y: c[1] + dy / this.planHeight }));
  }

  private emit(next: Corners) {
    this.corners = next;
    this.dispatchEvent(new CustomEvent('corners-change', { detail: { corners: next }, bubbles: true, composed: true }));
  }

  render() {
    const w = this.planWidth, h = this.planHeight;
    const t = affineFromCorners(this.corners, w, h);
    const pts = this.corners.map((c) => `${(c[0] * w).toFixed(1)},${(c[1] * h).toFixed(1)}`).join(' ');
    const handleR = Math.max(w, h) * 0.012;
    const residual = cornerResidual(this.corners, w, h);
    return html`<svg viewBox=${`0 0 ${w} ${h}`} role="application" aria-label="יישור תמונת הקומה" @pointermove=${this.move} @pointerup=${this.up} @pointercancel=${this.up}>
      ${this.planUrl && this.showPlan ? svg`<image href=${this.planUrl} x="0" y="0" width=${w} height=${h} preserveAspectRatio="none" opacity="0.35" />` : nothing}
      ${this.imageUrl ? svg`<image data-align-image href=${this.imageUrl} x="0" y="0" width=${w} height=${h} preserveAspectRatio="none" opacity=${this.opacity} transform=${affineAttr(t)} />` : nothing}
      ${this.rooms.map((r) => svg`<polygon class="room" points=${r.polygon.map((p) => `${(p.x * w).toFixed(1)},${(p.y * h).toFixed(1)}`).join(' ')} />`)}
      ${this.walls.map((s) => svg`<line class="wall" x1=${(s[0][0] * w).toFixed(1)} y1=${(s[0][1] * h).toFixed(1)} x2=${(s[1][0] * w).toFixed(1)} y2=${(s[1][1] * h).toFixed(1)} />`)}
      <polygon class="frame" points=${pts} />
      <polygon class="body" data-align-body points=${pts} @pointerdown=${(e: PointerEvent) => this.down(e, 'body', -1)} />
      ${this.corners.map((c, i) => {
        const at = applyAffine(t, i === 0 ? { x: 0, y: 0 } : i === 1 ? { x: w, y: 0 } : i === 2 ? { x: w, y: h } : { x: 0, y: h });
        void at;
        return svg`<circle class="handle" data-align-handle=${i} tabindex=${this.disabled ? -1 : 0} role="slider" aria-label=${HANDLE_NAMES[i]} aria-valuetext=${`${Math.round(c[0] * 100)}%, ${Math.round(c[1] * 100)}%`}
          cx=${(c[0] * w).toFixed(1)} cy=${(c[1] * h).toFixed(1)} r=${handleR.toFixed(1)} @pointerdown=${(e: PointerEvent) => this.down(e, 'corner', i)} @keydown=${(e: KeyboardEvent) => this.key(e, i)} />`;
      })}
    </svg>
    ${residual > 0.002 ? html`<div class="res" data-align-residual>סטייה ${(residual * 100).toFixed(1)}% - תמונה בפרספקטיבה; היישור מקורב</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-floor-image-align': SwFloorImageAlign;
  }
}
