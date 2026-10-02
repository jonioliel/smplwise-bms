import { css, html, svg, type TemplateResult } from 'lit';

/** CR-017 S4: the icon set of the editors (the approved mockup's, docs/design/mockups/automations/index.html): stroke icons on a 24 box. */
const P: Record<string, ReturnType<typeof svg>> = {
  close: svg`<path d="M6 6l12 12M18 6 6 18"/>`, check: svg`<path d="m5 12 5 5 9-10"/>`, plus: svg`<path d="M12 5v14M5 12h14"/>`, minus: svg`<path d="M5 12h14"/>`,
  chevron: svg`<path d="m9 6 6 6-6 6"/>`, chevronBack: svg`<path d="m15 6-6 6 6 6"/>`, chevronDown: svg`<path d="m6 9 6 6 6-6"/>`, search: svg`<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>`,
  edit: svg`<path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z"/><path d="m13 7 4 4"/>`,
  grip: svg`<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3.2"/>`, warning: svg`<path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17h.01"/>`,
  info: svg`<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>`, users: svg`<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2A5 5 0 0 1 21.5 19"/>`,
  bell: svg`<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>`, light: svg`<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.6 1.5 2.6h4c0-1 .7-2 1.5-2.6A6 6 0 0 0 12 3z"/>`,
  thermo: svg`<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z"/>`, drop: svg`<path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3z"/>`,
  sensor: svg`<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>`,
  motion: svg`<circle cx="13" cy="4.5" r="1.8"/><path d="m7 21 3-7-2.5-2.5L5 13"/><path d="m10 14 3 2 2 5"/><path d="M8.5 9.5 11 8l3 1 3 3.5"/><path d="M14 9v3"/>`,
  play: svg`<path d="M7 5v14l11-7z"/>`, stop: svg`<rect x="6" y="6" width="12" height="12" rx="2"/>`, power: svg`<path d="M12 3v9"/><path d="M6.4 6.6a8 8 0 1 0 11.2 0"/>`,
  bolt: svg`<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>`, clock: svg`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`, calendar: svg`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>`,
  sun: svg`<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>`,
  sunset: svg`<path d="M17 16a5 5 0 0 0-10 0"/><path d="M12 7V3M3 16h2M19 16h2M5.6 9.6l1.4 1.4M18.4 9.6 17 11M3 20h18"/>`,
  repeat: svg`<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>`,
  branch: svg`<circle cx="6" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="9" r="2.2"/><path d="M6 7.2v9.6M18 11.2c0 3.5-3.5 4.3-6 4.6-2.2.3-4.4 1-5.4 2.2"/>`,
  question: svg`<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7V14M12 17h.01"/>`,
  timer: svg`<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6M12 2v3"/>`, lock: svg`<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/>`,
  alarm: svg`<path d="M12 3 4 6v6c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V6z"/><path d="M12 9v4M12 16h.01"/>`, gate: svg`<path d="M3 20V8l9-4 9 4v12"/><path d="M7 20v-8M12 20v-8M17 20v-8M3 12h18"/>`,
  siren: svg`<path d="M6 20V12a6 6 0 0 1 12 0v8"/><path d="M4 20h16M12 3v2M5 6l1.5 1.5M19 6l-1.5 1.5"/>`, tv: svg`<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>`,
  scene: svg`<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/>`,
  script: svg`<path d="M8 3h9a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a2 2 0 0 1-2-2v-3h4z"/><path d="M8 3a2 2 0 0 0-2 2v11"/><path d="M11 8h5M11 12h5"/>`,
  code: svg`<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16"/>`, blocks: svg`<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><path d="M17 13v8M13 17h8"/>`,
  template: svg`<path d="M7 8c-2 0-2 1.5-2 3s0 3-2 3c2 0 2 1.5 2 3s0 3 2 3"/><path d="M17 8c2 0 2 1.5 2 3s0 3 2 3c-2 0-2 1.5-2 3s0 3-2 3"/><path d="M11 10h.01M13 10h.01"/>`,
  button: svg`<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="3"/>`, history: svg`<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>`,
  trash: svg`<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>`, copy: svg`<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>`,
  flask: svg`<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>`, layers: svg`<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5M3 17.5l9 5 9-5"/>`,
  door: svg`<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M14 12h.01"/>`,
  home: svg`<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>`, list: svg`<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>`, wind: svg`<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7a2 2 0 1 1-2 2"/>`,
  blind: svg`<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M3 13h18M12 13v8"/>`, slash: svg`<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>`, shuffle: svg`<path d="M3 7h3l4 5-4 5H3M15 7h6v6M21 7l-7 7M15 17h6v-6"/>`,
  arrowUp: svg`<path d="M12 19V5M6 11l6-6 6 6"/>`, arrowDown: svg`<path d="M12 5v14M6 13l6 6 6-6"/>`, eye: svg`<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,
  star: svg`<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>`, camera: svg`<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>`,
  refresh: svg`<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>`, hand: svg`<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.9-2.6L4 14.5a1.5 1.5 0 0 1 2.4-1.8L9 15"/>`,
};

/** An inline icon of the editors' set (`name` unknown = the info icon). The size is the font size of its container unless given. */
export function icon(name: string, size = 0): TemplateResult {
  return html`<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style=${size ? `font-size:${size}px` : ''}>${P[name] ?? P.info}</svg>`;
}
/** The CSS every component that draws `icon()` needs. */
export const iconStyles = css`
  .ic {
    inline-size: 1em;
    block-size: 1em;
    flex: none;
  }
`;
