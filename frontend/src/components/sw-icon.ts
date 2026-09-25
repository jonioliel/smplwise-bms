import { LitElement, html, css, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';

// Stroke-based 24×24 icon set. Icons never mirror in RTL except the explicit `flip` ones (chevrons).
const PATHS: Record<string, ReturnType<typeof svg>> = {
  live: svg`<circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4M3.5 3.5a12 12 0 0 0 0 17M20.5 3.5a12 12 0 0 1 0 17"/>`,
  explore: svg`<path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>`,
  investigate: svg`<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3M11 8v3l2 1.5"/>`,
  system: svg`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`,
  camera: svg`<path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H8l1.5-2h5L16 7h3.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.5"/>`,
  search: svg`<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>`,
  bell: svg`<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>`,
  user: svg`<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`,
  play: svg`<path d="M7 5v14l11-7z"/>`,
  expand: svg`<path d="M15 4h5v5M9 20H4v-5M20 4l-6 6M4 20l6-6"/>`,
  close: svg`<path d="M6 6l12 12M18 6 6 18"/>`,
  chevron: svg`<path d="m9 6 6 6-6 6"/>`,
  chevronBack: svg`<path d="m15 6-6 6 6 6"/>`,
  warning: svg`<path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17h.01"/>`,
  info: svg`<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>`,
  lock: svg`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`,
  unlock: svg`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>`,
  offline: svg`<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><path d="M12 19h.01"/><path d="M3 3l18 18"/>`,
  refresh: svg`<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>`,
  layers: svg`<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5M3 17.5l9 5 9-5"/>`,
  floor: svg`<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 3v18"/>`,
  plus: svg`<path d="M12 5v14M5 12h14"/>`,
  minus: svg`<path d="M5 12h14"/>`,
  fit: svg`<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`,
  door: svg`<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M14 12h.01"/>`,
  light: svg`<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.6 1.5 2.6h4c0-1 .7-2 1.5-2.6A6 6 0 0 0 12 3z"/>`,
  sensor: svg`<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>`,
  check: svg`<path d="m5 12 5 5 9-10"/>`,
  clock: svg`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  download: svg`<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>`,
  pin: svg`<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v6"/>`,
  more: svg`<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>`,
  building: svg`<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>`,
  map: svg`<path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20z"/>`,
  upload: svg`<path d="M12 16V5M7 10l5-5 5 5M4 20h16"/>`,
  list: svg`<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>`,
  history: svg`<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 8v4l3 2"/>`,
  target: svg`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>`,
  filter: svg`<path d="M4 5h16l-6 8v6l-4-2v-4z"/>`,
  users: svg`<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5A5 5 0 0 1 21.5 20"/>`,
  shield: svg`<path d="M12 3 4 6v6c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>`,
  storage: svg`<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>`,
  edit: svg`<path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z"/><path d="m13 7 4 4"/>`,
  pause: svg`<path d="M8 5v14M16 5v14"/>`,
  skip: svg`<path d="M5 5v14l8-7zM15 5h2v14h-2z"/>`,
  case: svg`<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>`,
  rule: svg`<path d="M4 6h10M4 12h16M4 18h7"/><circle cx="18" cy="6" r="2"/><circle cx="15" cy="18" r="2"/>`,
  link: svg`<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`,
  grid: svg`<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>`,
  dashboard: svg`<rect x="3" y="3" width="8" height="10" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="15" width="8" height="6" rx="1.5"/>`,
  home: svg`<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>`,
  star: svg`<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9L6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>`,
  aperture: svg`<circle cx="12" cy="12" r="9"/><path d="m14.3 4.5-5 8.6M20.7 9.5H10.8M18.4 17.5l-5-8.6M9.7 19.5l5-8.6M3.3 14.5h9.9M5.6 6.5l5 8.6"/>`,
  volume: svg`<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>`,
  mic: svg`<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>`,
  back10: svg`<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/><path d="M10.5 15.5V10l-1.5 1"/><rect x="13.5" y="10" width="3.5" height="5.5" rx="1.7"/>`,
  forward10: svg`<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/><path d="M10.5 15.5V10l-1.5 1"/><rect x="13.5" y="10" width="3.5" height="5.5" rx="1.7"/>`,
  chevronDown: svg`<path d="m6 9 6 6 6-6"/>`,
  stairs: svg`<path d="M3 20h4v-4h4v-4h4V8h5"/>`,
  bolt: svg`<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>`,
  wall: svg`<path d="M3 5h18v4H3zM3 15h18v4H3zM8 9v6M16 9v6"/>`,
  ruler: svg`<path d="M3 16 16 3l5 5L8 21z"/><path d="m7 12 2 2M10 9l2 2M13 6l2 2"/>`,
  scale: svg`<path d="M4 20h16M4 20V8M20 20V8M4 8l8-4 8 4M8 14h8"/>`,
  elevator: svg`<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M8 10l1.5-2 1.5 2M14.5 14l1.5 2 1.5-2"/>`,
  menu: svg`<path d="M4 7h16M4 12h16M4 17h16"/>`,
  calendar: svg`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>`,
  trash: svg`<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>`,
  eye: svg`<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,
  cpu: svg`<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>`,
  activity: svg`<path d="M3 12h4l3-8 4 16 3-8h4"/>`,
  image: svg`<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5-9 9"/>`,
  wifi: svg`<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><path d="M12 19h.01"/>`,
  signal: svg`<path d="M4 18v-3M9 18v-7M14 18V7M19 18V4"/>`,
  move: svg`<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>`,
  bookmark: svg`<path d="M6 3h12v18l-6-4-6 4z"/>`,
  route: svg`<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8 17c5-1 3-9 8-10"/>`,
  logout: svg`<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>`,
  sparkle: svg`<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/><path d="M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>`,
  cube: svg`<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>`,
};

export type IconName = keyof typeof PATHS;

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
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `;

  render() {
    this.style.setProperty('--sw-icon-size', `${this.size}px`);
    const directional = this.name === 'chevron' || this.name === 'chevronBack';
    return html`<svg viewBox="0 0 24 24" aria-hidden="true" ?data-dir=${directional}>${PATHS[this.name] ?? PATHS.info}</svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-icon': SwIcon;
  }
}
