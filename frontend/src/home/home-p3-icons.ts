// HOME-V3-P3-2432: the icons phase 3 adds to the home interface's own set, drawn for Arx in the round-27 mockup (24 grid, 1.75 stroke),
// copied as is. Static SVG markup only, rendered through unsafeSVG; any other name falls back to the base set (home-icons.ts).
import { html, type TemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { hasIcon, hi } from './home-icons';

const P3: Record<string, string> = {
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8.5 20.5h7"/>',
  horn: '<path d="M4 10v4h3l7 4V6l-7 4z"/><path d="M17.5 9.5a4 4 0 0 1 0 5"/><path d="M19.8 7a7.5 7.5 0 0 1 0 10"/>',
  bill: '<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8.5h6"/><path d="M9 12.5h6"/>',
  gen: '<rect x="3.5" y="7" width="17" height="11" rx="2.5"/><path d="M7 18v2.5"/><path d="M17 18v2.5"/><path d="m12.8 9.5-2.6 3.4h3.6l-2.6 3.4"/>',
  lift: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M12 3.5v17"/><path d="m8 10 1.5-2 1.5 2"/><path d="m13 14 1.5 2 1.5-2"/>',
  prev: '<path d="M18 6v12l-9-6z"/><path d="M6 6v12"/>',
  next: '<path d="M6 6v12l9-6z"/><path d="M18 6v12"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M8.5 5.5v13"/><path d="M15.5 5.5v13"/>',
  vol: '<path d="M4 10v4h3l5 4V6l-5 4z"/><path d="M16 9a4.5 4.5 0 0 1 0 6"/>',
  grid: '<circle cx="6" cy="6" r="1.8"/><circle cx="12" cy="6" r="1.8"/><circle cx="18" cy="6" r="1.8"/><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/><circle cx="6" cy="18" r="1.8"/><circle cx="12" cy="18" r="1.8"/><circle cx="18" cy="18" r="1.8"/>',
};

/** An icon of phase 3, else the base set's. */
export function hi3(name: string, cls = ''): TemplateResult {
  if (!(name in P3) && hasIcon(name)) return hi(name, cls);
  return html`<svg class=${'hi' + (cls ? ' ' + cls : '')} viewBox="0 0 24 24" aria-hidden="true">${unsafeSVG(P3[name] ?? '')}</svg>`;
}
