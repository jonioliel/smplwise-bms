import { html, svg, type TemplateResult } from 'lit';

/** The 1.8 px stroke icons the section and the board use (the product's icon style). A state is never shown by colour alone: each chip pairs one of these with a word. */
const P: Record<string, ReturnType<typeof svg>> = {
  light: svg`<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.6 1.5 2.6h4c0-1 .7-2 1.5-2.6A6 6 0 0 0 12 3z"/>`,
  therm: svg`<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>`,
  flame: svg`<path d="M12 3c.8 3.4 5 5.6 5 10a5 5 0 0 1-10 0c0-2 .9-3.2 2.1-4.2.1 1.4.7 2.2 1.6 2.6C10.2 8.6 10.7 5.6 12 3z"/>`,
  snow: svg`<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="m9.5 4.8 2.5 2.2 2.5-2.2M9.5 19.2l2.5-2.2 2.5 2.2"/>`,
  bell: svg`<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>`,
  offline: svg`<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><path d="M12 19h.01"/><path d="M3 3l18 18"/>`,
  stairs: svg`<path d="M3 20h5v-5h5v-5h5V5h3"/>`,
  lift: svg`<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="m9 9 3-3 3 3M9 15l3 3 3-3"/>`,
  person: svg`<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>`,
  cam: svg`<rect x="3" y="7" width="13" height="10" rx="2"/><path d="m16 11 5-3v8l-5-3z"/>`,
  door: svg`<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M14 12h.01"/>`,
  wrench: svg`<path d="M14.5 5.5a4 4 0 0 0-5 5L4 16v4h4l5.5-5.5a4 4 0 0 0 5-5L16 12l-4-4z"/>`,
  section: svg`<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M5 8h14M5 13h14M5 18h14"/>`,
  close: svg`<path d="M6 6l12 12M18 6 6 18"/>`,
  chev: svg`<path d="m6 9 6 6 6-6"/>`,
  check: svg`<path d="m5 12 5 5 9-10"/>`,
  map: svg`<path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20z"/>`,
  synoptic: svg`<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 9v12"/>`,
  tv: svg`<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8.5 21h7M12 17v4"/>`,
};

export function xi(name: string, cls = ''): TemplateResult {
  return html`<svg class="xi ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? ''}</svg>`;
}
