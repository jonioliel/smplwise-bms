import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { ICON_PATHS, iconSvg } from './icon-paths';

// CR-ICONS-PALETTE-2440 (review findings 08:F08, 07:F22): the path table of this icon set and the one inline-icon wrapper are
// exported for the feature registries. They live in ./icon-paths.ts (no custom element in that module) and are re-exported here.
export { ICON_PATHS, iconSvg };

export type IconName = keyof typeof ICON_PATHS;

@customElement('sw-icon')
export class SwIcon extends LitElement {
  @property() name: IconName = 'info';
  @property({ type: Number }) size = 20;
  @property({ type: Boolean, reflect: true }) flip = false;

  static styles = css`
    :host {
      display: inline-flex;
      inline-size: var(--sw-icon-size, 20px);
      block-size: var(--sw-icon-size, 20px);
      color: inherit;
      vertical-align: middle;
      flex-shrink: 0;
    }
    :host([flip]) svg {
      transform: scaleX(-1);
    }
    :host-context([dir='rtl']) svg[data-dir] {
      transform: scaleX(-1);
    }
    svg {
      inline-size: 100%;
      block-size: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: var(--sw-icon-stroke, 1.8); /* HOMEFABLE-297: a host may set a lighter or heavier stroke (the home's quiet counter icons) */
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `;

  render() {
    this.style.setProperty('--sw-icon-size', `${this.size}px`);
    const directional = this.name === 'chevron' || this.name === 'chevronBack';
    return html`<svg viewBox="0 0 24 24" aria-hidden="true" ?data-dir=${directional}>${unsafeSVG(ICON_PATHS[this.name] ?? ICON_PATHS.info)}</svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-icon': SwIcon;
  }
}
