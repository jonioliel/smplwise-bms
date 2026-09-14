import { LitElement, html, css, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/** Isometric floor-stack glyph (board 1 screen 3): the highlighted slab is the floor in question. */
@customElement('sw-floor-glyph')
export class SwFloorGlyph extends LitElement {
  @property({ type: Number }) levels = 3;
  @property({ type: Number }) active = 0;
  @property({ type: Number }) size = 44;
  @property({ type: Boolean, reflect: true }) selected = false;

  static styles = css`
    :host {
      display: inline-grid;
      place-items: center;
      inline-size: var(--sz, 44px);
      block-size: var(--sz, 44px);
      border-radius: 10px;
      background: var(--sw-accent-soft);
      flex-shrink: 0;
    }
    :host([selected]) {
      background: var(--sw-accent);
    }
    svg {
      inline-size: 70%;
      block-size: 70%;
      overflow: visible;
    }
    .slab {
      fill: #fff;
      stroke: var(--sw-accent);
      stroke-width: 1.4;
      stroke-linejoin: round;
    }
    .slab.on {
      fill: var(--sw-accent);
    }
    :host([selected]) .slab {
      fill: rgba(255, 255, 255, 0.35);
      stroke: #fff;
    }
    :host([selected]) .slab.on {
      fill: #fff;
    }
  `;

  render() {
    this.style.setProperty('--sz', `${this.size}px`);
    const n = Math.max(1, this.levels);
    const step = 18 / Math.max(1, n - 1 || 1);
    const slabs = [];
    for (let i = n - 1; i >= 0; i--) {
      const y = 4 + i * (n === 1 ? 0 : step);
      slabs.push(svg`<path class="slab ${i === this.active ? 'on' : ''}" d="M12 ${y} L22 ${y + 5} L12 ${y + 10} L2 ${y + 5} Z" />`);
    }
    return html`<svg viewBox="0 0 24 32">${slabs}</svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-floor-glyph': SwFloorGlyph;
  }
}
