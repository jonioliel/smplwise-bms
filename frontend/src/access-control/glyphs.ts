/**
 * CR-036 S8 / S10: the few glyphs the access-control screens need that `sw-icon` does not have yet (a printer, a table, a
 * card). Drawn the way `sw-icon` draws them (24 x 24, stroke = currentColor, no fill) and rendered inline, so the shared icon
 * set - a file every slice of the WisKey screens touches - stays untouched; they can move into it when the slices are merged.
 */
import { html, svg, type TemplateResult } from 'lit';

const PATHS = {
  print: svg`<path d="M7 9V4h10v5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2"/><rect x="7" y="14" width="10" height="6" rx="1"/>`,
  table: svg`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M3 15h18M9 5v14"/>`,
  card: svg`<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10.5h18M7 15h3"/>`,
  window: svg`<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>`,
} as const;

export type GlyphName = keyof typeof PATHS;

export function glyph(name: GlyphName, size = 16): TemplateResult {
  return html`<svg viewBox="0 0 24 24" width=${size} height=${size} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`;
}
