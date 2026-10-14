import { svg, type TemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

/** CR-038 slice 9: the cost screens' own pictograms (the tickets/icons.ts style; a separate file so slice 9 never edits slice 1's set). */
const ICONS = {
  coins: '<ellipse cx="9" cy="7" rx="6" ry="2.5"/><path d="M3 7v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7"/><path d="M9 16.5c-3.3 0-6-1.1-6-2.5"/><ellipse cx="15" cy="15" rx="6" ry="2.5"/><path d="M9 15v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>',
  pages: '<rect x="7" y="3" width="12" height="15" rx="1.5"/><path d="M5 7v12a2 2 0 0 0 2 2h9"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  zoomIn: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3M8 11h6"/>',
  prev: '<path d="m9 6 6 6-6 6"/>',
  next: '<path d="m15 6-6 6 6 6"/>',
  paid: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="m8 12 3 3 5-6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z"/><path d="m13 7 4 4"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  warning: '<path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17h.01"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  attach: '<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7"/>',
} as const;

export type CostIconName = keyof typeof ICONS;

/** An inline icon; its size is the `font-size` of the place it sits in. The paths are static markup of this file, never user data. */
export function cIcon(name: CostIconName, cls = ''): TemplateResult {
  return svg`<svg class=${cls ? `ic ${cls}` : 'ic'} viewBox="0 0 24 24" aria-hidden="true">${unsafeSVG(ICONS[name])}</svg>`;
}
