import { LitElement, html, css, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface IsoRoom {
  x: number; // normalized 0..1
  y: number;
  w: number;
  h: number;
}

/**
 * Isometric floor thumbnail (board 1 screen 3): the floor slab drawn in isometric projection with its
 * room outlines; the selected floor is tinted blue. Floors without a plan get a dashed empty slab.
 */
@customElement('sw-floor-iso')
export class SwFloorIso extends LitElement {
  @property({ attribute: false }) rooms: IsoRoom[] = [];
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
    :host([selected]) .side {
      fill: #9db9ff;
    }
    :host([selected]) .top {
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

  private iso(u: number, v: number) {
    return { x: 60 + (u - v) * 58, y: 6 + (u + v) * 26 };
  }

  private poly(pts: { x: number; y: number }[]) {
    return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  render() {
    this.style.setProperty('--w', `${this.width}px`);
    const slab = [this.iso(0, 0), this.iso(1, 0), this.iso(1, 1), this.iso(0, 1)];
    const d = 7;
    const right = [this.iso(1, 0), this.iso(1, 1), { x: this.iso(1, 1).x, y: this.iso(1, 1).y + d }, { x: this.iso(1, 0).x, y: this.iso(1, 0).y + d }];
    const left = [this.iso(0, 1), this.iso(1, 1), { x: this.iso(1, 1).x, y: this.iso(1, 1).y + d }, { x: this.iso(0, 1).x, y: this.iso(0, 1).y + d }];
    return html`<svg viewBox="0 0 120 72" aria-hidden="true">
      ${svg`<polygon class="side" points=${this.poly(right)} /><polygon class="side" points=${this.poly(left)} />`}
      ${svg`<polygon class="top" points=${this.poly(slab)} />`}
      ${this.empty
        ? ''
        : this.rooms.map((r) => svg`<polygon class="room" points=${this.poly([this.iso(r.x, r.y), this.iso(r.x + r.w, r.y), this.iso(r.x + r.w, r.y + r.h), this.iso(r.x, r.y + r.h)])} />`)}
    </svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-floor-iso': SwFloorIso;
  }
}
