import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { IsoScene } from '../map/scene-builder';

export interface IsoRoom {
  x: number; // normalized 0..1
  y: number;
  w: number;
  h: number;
}

/**
 * Isometric floor thumbnail (board 1 screen 3): the floor slab drawn in isometric projection with its room outlines;
 * the selected floor is tinted blue. Floors without a plan get a dashed empty slab. With `iso` (T087) the thumbnail is
 * the true isometric of the published structure - the faces of scene-builder.isoProjection, far to near - and the
 * host reflects `data-iso="real"`; without it `data-iso="demo"` and the room rectangles draw as before.
 */
@customElement('sw-floor-iso')
export class SwFloorIso extends LitElement {
  @property({ attribute: false }) rooms: IsoRoom[] = [];
  @property({ attribute: false }) iso: IsoScene | null = null;
  @property({ type: Boolean, reflect: true }) selected = false;
  @property({ type: Boolean, reflect: true }) empty = false;
  @property({ type: Number }) width = 132;

  static styles = css`
    :host {
      display: inline-block;
      inline-size: var(--w, 132px);
      flex-shrink: 0;
    }
    svg {
      display: block;
      inline-size: 100%;
      block-size: auto;
      overflow: visible;
    }
    /* the true isometric keeps the thumbnail box of the demo drawing and fits its faces inside it */
    svg.real {
      aspect-ratio: 120 / 72;
    }
    .side {
      fill: #cfd7e3;
    }
    .top {
      fill: #ffffff;
      stroke: #b7c3d4;
      stroke-width: 1.2;
      stroke-linejoin: round;
    }
    .room {
      fill: none;
      stroke: #b7c3d4;
      stroke-width: 1;
      stroke-linejoin: round;
    }
    /* the true isometric: a token colour per face, sides darkened, the plate as the slab top */
    polygon.plate {
      fill: #ffffff;
      stroke: #b7c3d4;
      stroke-width: 1;
      stroke-linejoin: round;
    }
    polygon.f-side {
      fill: color-mix(in srgb, var(--fc, #aab7cc) 72%, #1f2937 28%);
      stroke: none;
    }
    polygon.f-top {
      fill: var(--fc, #aab7cc);
      stroke: none;
    }
    :host([selected]) .side {
      fill: #9db9ff;
    }
    :host([selected]) .top,
    :host([selected]) polygon.plate {
      fill: #dbe6ff;
      stroke: var(--sw-accent);
    }
    :host([selected]) .room {
      stroke: var(--sw-accent);
    }
    :host([empty]) .top {
      fill: #f6f8fb;
      stroke-dasharray: 3 3;
    }
  `;

  private iso2(u: number, v: number) {
    return { x: 60 + (u - v) * 58, y: 6 + (u + v) * 26 };
  }

  private poly(pts: { x: number; y: number }[]) {
    return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  /** The demo box (0 0 120 72) grown to every face: tall walls rise above it and a lower level sinks below it. */
  private isoBox(iso: IsoScene): string {
    let [x0, y0, x1, y1] = [0, 0, 120, 72];
    for (const f of iso.faces)
      for (const [x, y] of f.points) {
        x0 = Math.min(x0, x - 1);
        y0 = Math.min(y0, y - 1);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
      }
    return `${x0} ${y0} ${x1 - x0} ${y1 - y0}`;
  }

  protected updated(): void {
    this.setAttribute('data-iso', this.iso ? 'real' : 'demo');
  }

  render() {
    this.style.setProperty('--w', `${this.width}px`);
    if (this.iso) {
      return html`<svg class="real" viewBox=${this.isoBox(this.iso)} aria-hidden="true">
        ${this.iso.faces.map((f) => svg`<polygon class=${f.face === 'plate' ? 'plate' : f.face === 'side' ? 'side f-side' : 'top f-top'} style=${`--fc: var(--sw-${f.color}); opacity: ${f.opacity}`} points=${f.points.map((p) => `${p[0]},${p[1]}`).join(' ')} />`)}
      </svg>`;
    }
    const slab = [this.iso2(0, 0), this.iso2(1, 0), this.iso2(1, 1), this.iso2(0, 1)];
    const d = 7;
    const right = [this.iso2(1, 0), this.iso2(1, 1), { x: this.iso2(1, 1).x, y: this.iso2(1, 1).y + d }, { x: this.iso2(1, 0).x, y: this.iso2(1, 0).y + d }];
    const left = [this.iso2(0, 1), this.iso2(1, 1), { x: this.iso2(1, 1).x, y: this.iso2(1, 1).y + d }, { x: this.iso2(0, 1).x, y: this.iso2(0, 1).y + d }];
    return html`<svg viewBox="0 0 120 72" aria-hidden="true">
      ${svg`<polygon class="side" points=${this.poly(right)} /><polygon class="side" points=${this.poly(left)} />`}
      ${svg`<polygon class="top" points=${this.poly(slab)} />`}
      ${this.empty
        ? nothing
        : this.rooms.map((r) => svg`<polygon class="room" points=${this.poly([this.iso2(r.x, r.y), this.iso2(r.x + r.w, r.y), this.iso2(r.x + r.w, r.y + r.h), this.iso2(r.x, r.y + r.h)])} />`)}
    </svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-floor-iso': SwFloorIso;
  }
}
