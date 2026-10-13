import { svg, type TemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

/** CR-038 slice 6b: the pictograms the board table adds to tickets/icons.ts (the same 24 x 24 stroke style, `<svg class="ic">`). */
const ICONS = {
  cards: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  table: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  kanban: '<rect x="3.5" y="4" width="4.5" height="14" rx="1.5"/><rect x="9.75" y="4" width="4.5" height="9" rx="1.5"/><rect x="16" y="4" width="4.5" height="11" rx="1.5"/>',
  columns: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15M14.5 4.5v15"/>',
  density: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
  sort: '<path d="M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4"/>',
  filter: '<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
  bookmark: '<path d="M6 3.5h12V21l-6-4-6 4z"/>',
} as const;

export type TableIconName = keyof typeof ICONS;

export function tbIcon(name: TableIconName, cls = ''): TemplateResult {
  return svg`<svg class=${cls ? `ic ${cls}` : 'ic'} viewBox="0 0 24 24" aria-hidden="true">${unsafeSVG(ICONS[name])}</svg>`;
}
