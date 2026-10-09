import { LitElement, html, css, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { toRelative, type ConfigZone, type Pt } from '../api/frigate-control';
import { fx } from '../i18n/frigate-text';

/**
 * FRGS: the zone stage - the camera's still with its Frigate zones drawn over it, and the polygon being edited. Purely presentational:
 * it never talks to the server. The stage is ALWAYS left-to-right and never mirrored (video and map geometry are not mirrored by RTL):
 * a point is (x right, y down) in 0..1 of the frame, exactly what Frigate stores.
 *
 * Editing (`editing`): a tap / click on the image adds a point at the end, a handle is dragged with a pointer (mouse, touch, pen), and a
 * focused handle moves with the arrow keys (Shift = larger steps) and is removed with Delete / Backspace. Events: `zone-points` {points}
 * on every change, `zone-pick` {name} when a zone is chosen by tapping it while not editing. Tokens only.
 */
@customElement('frigate-zone-editor')
export class FrigateZoneEditor extends LitElement {
  /** the still's address (null = no image: the frame is drawn empty) */
  @property() src: string | null = null;
  /** width / height of the detect frame (16 / 9 when Frigate does not say) */
  @property({ type: Number }) aspect = 16 / 9;
  @property({ attribute: false }) zones: ConfigZone[] = [];
  /** the zone being edited (drawn as the draft instead of its stored shape); '' = a new zone */
  @property() selected: string | null = null;
  @property({ attribute: false }) points: Pt[] = [];
  @property({ type: Boolean }) editing = false;
  @state() private broken = false;
  private drag: { index: number; id: number } | null = null;

  static styles = css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .stage {
      position: relative;
      inline-size: 100%;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-surface-3);
      border: 1px solid var(--sw-border);
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    .stage.editing {
      cursor: crosshair;
    }
    img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: fill;
      display: block;
      pointer-events: none;
    }
    .noframe {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    svg {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
    }
    .zone {
      fill: color-mix(in srgb, var(--sw-accent) 18%, transparent);
      stroke: var(--sw-accent);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      cursor: pointer;
    }
    .zone.dim {
      fill: color-mix(in srgb, var(--sw-text-3) 10%, transparent);
      stroke: color-mix(in srgb, var(--sw-text) 55%, transparent);
      cursor: default;
    }
    .draft {
      fill: color-mix(in srgb, var(--sw-warning, var(--sw-stale-text)) 22%, transparent);
      stroke: var(--sw-warning, var(--sw-stale-text));
      stroke-width: 2.5;
      stroke-dasharray: 6 4;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .name {
      position: absolute;
      transform: translate(-50%, -50%);
      padding: 1px 6px;
      border-radius: var(--sw-r-pill);
      background: color-mix(in srgb, var(--sw-surface) 85%, transparent);
      color: var(--sw-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      pointer-events: none;
      white-space: nowrap;
      direction: ltr;
    }
    .h {
      position: absolute;
      inline-size: 32px;
      block-size: 32px;
      margin: -16px 0 0 -16px;
      padding: 0;
      border: 0;
      background: transparent;
      display: grid;
      place-items: center;
      cursor: grab;
      touch-action: none;
    }
    .h::before {
      content: '';
      inline-size: 14px;
      block-size: 14px;
      border-radius: 50%;
      background: var(--sw-surface);
      border: 2px solid var(--sw-warning, var(--sw-stale-text));
      box-shadow: var(--sw-shadow-1);
    }
    .h.first::before {
      background: var(--sw-warning, var(--sw-stale-text));
    }
    .h:focus-visible {
      outline: none;
    }
    .h:focus-visible::before {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .h:active {
      cursor: grabbing;
    }
  `;

  private rect() {
    return (this.renderRoot.querySelector('.stage') as HTMLElement).getBoundingClientRect();
  }

  private emit(points: Pt[]) {
    this.dispatchEvent(new CustomEvent('zone-points', { detail: { points }, bubbles: true, composed: true }));
  }

  private onStageClick(e: MouseEvent) {
    if (!this.editing || (e.target as HTMLElement).closest('.h') || this.points.length >= 40) return;
    this.emit([...this.points, toRelative(e.clientX, e.clientY, this.rect())]);
  }

  private onDown(i: number, e: PointerEvent) {
    if (!this.editing) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.drag = { index: i, id: e.pointerId };
  }

  private onMove(e: PointerEvent) {
    if (!this.drag || this.drag.id !== e.pointerId) return;
    const next = this.points.slice();
    next[this.drag.index] = toRelative(e.clientX, e.clientY, this.rect());
    this.emit(next);
  }

  private onUp(e: PointerEvent) {
    if (this.drag?.id === e.pointerId) this.drag = null;
  }

  private onKey(i: number, e: KeyboardEvent) {
    if (!this.editing) return;
    const step = e.shiftKey ? 0.02 : 0.005;
    const d: Record<string, Pt> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (d[e.key]) {
      e.preventDefault();
      const [x, y] = this.points[i];
      const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;
      const next = this.points.slice();
      next[i] = [c(x + d[e.key][0]), c(y + d[e.key][1])];
      this.emit(next);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.emit(this.points.filter((_, k) => k !== i));
    }
  }

  private pick(name: string, e: Event) {
    if (this.editing) return;
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('zone-pick', { detail: { name }, bubbles: true, composed: true }));
  }

  private centroid(pts: readonly Pt[]): Pt {
    const n = pts.length || 1;
    return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
  }

  render() {
    const t = fx().control.settings.config;
    const w = 1000;
    const h = Math.round(1000 / (this.aspect > 0 ? this.aspect : 16 / 9));
    const poly = (pts: readonly Pt[]) => pts.map(([x, y]) => `${(x * w).toFixed(1)},${(y * h).toFixed(1)}`).join(' ');
    const shown = this.zones.filter((z) => z.points && z.name !== this.selected);
    return html`<div class=${`stage ${this.editing ? 'editing' : ''}`} dir="ltr" style=${`aspect-ratio: ${w} / ${h}`} data-zone-stage
        @click=${(e: MouseEvent) => this.onStageClick(e)} @pointermove=${(e: PointerEvent) => this.onMove(e)} @pointerup=${(e: PointerEvent) => this.onUp(e)} @pointercancel=${(e: PointerEvent) => this.onUp(e)}>
      ${this.src && !this.broken ? html`<img src=${this.src} alt="" draggable="false" @error=${() => (this.broken = true)} />` : html`<div class="noframe" data-zone-noframe>${t.noFrame}</div>`}
      <svg viewBox=${`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        ${shown.map((z) => svg`<polygon class=${`zone ${this.editing ? 'dim' : ''}`} points=${poly(z.points!)} data-zone-shape=${z.name} @click=${(e: Event) => this.pick(z.name, e)}></polygon>`)}
        ${this.selected !== null && this.points.length >= 2 ? svg`<polygon class="draft" points=${poly(this.points)} data-zone-draft></polygon>` : nothing}
      </svg>
      ${shown.map((z) => {
        const [cx, cy] = this.centroid(z.points!);
        return html`<span class="name" style=${`left:${cx * 100}%;top:${cy * 100}%`}>${z.name}</span>`;
      })}
      ${this.selected !== null
        ? this.points.map(([x, y], i) => html`<button type="button" class=${`h ${i === 0 ? 'first' : ''}`} style=${`left:${x * 100}%;top:${y * 100}%`} aria-label=${`${t.points} ${i + 1}`}
            data-zone-handle=${i} ?disabled=${!this.editing} @pointerdown=${(e: PointerEvent) => this.onDown(i, e)} @keydown=${(e: KeyboardEvent) => this.onKey(i, e)}></button>`)
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-zone-editor': FrigateZoneEditor;
  }
}
