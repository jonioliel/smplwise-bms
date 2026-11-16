import type { TemplateResult } from 'lit';
import { ICON_PATHS, iconSvg } from '../components/icon-paths';

/**
 * CR-ICONS-PALETTE-2440 (review finding 08:F08, D15): ONE file for the pictograms of the tickets module. There were five - this one and
 * cost-icons.ts, list-icons.ts, rfq-icons.ts, table-icons.ts - each with its own copy of the `<svg class="ic">` wrapper. The five
 * tables stay five (they are NOT one map: `download`, `bell`, `filter`, `up`, `down`, `coin`, `hand`, `file`, `table`, `columns` are a
 * different glyph in different tables, and every screen keeps the glyph it had), the wrapper is one (`iconSvg`, components/icon-paths.ts),
 * and a glyph that is path-for-path a glyph of the app's icon set comes from its path table (`ICON_PATHS`) instead of being re-typed.
 * The four other files re-export their old names from here for now.
 * 24 x 24 strokes, `<svg class="ic">`, sized by the font-size of the place it sits in. Static markup of this file, never user data.
 */

/** CR-038: the pictograms of the tickets screens (24 x 24 strokes, the automations icon style: `<svg class="ic">`, sized by font-size). */
export const TICKET_ICONS = {
  plus: ICON_PATHS.plus,
  edit: ICON_PATHS.edit,
  check: ICON_PATHS.check,
  user: ICON_PATHS.user,
  users: ICON_PATHS.users,
  refresh: ICON_PATHS.refresh,
  note: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h5"/>',
  clock: ICON_PATHS.clock,
  image: ICON_PATHS.image,
  trash: ICON_PATHS.trash,
  copy: ICON_PATHS.copy,
  lock: ICON_PATHS.lock,
  x: ICON_PATHS.close,
  dots: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  search: ICON_PATHS.search,
  expand: ICON_PATHS.expand,
  shrink: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  back: ICON_PATHS.chevron,
  camera: ICON_PATHS.camera,
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  ticket: ICON_PATHS.ticket,
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  warning: ICON_PATHS.warning,
  eye: ICON_PATHS.eye,
  link: ICON_PATHS.link,
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  // slice 6 (the board)
  chevronDown: ICON_PATHS.chevronDown,
  filter: '<path d="M4 5h16l-6 7.5V19l-4 1v-7.5z"/>',
  tree: '<path d="M4 5h6M4 12h4M10 12h10M4 19h4M10 19h10M7 5v14"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  // MGRDASH (the manager overview)
  truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  offline: ICON_PATHS.offline,
} as const;

/** CR-038 slice 9: the cost screens' own pictograms (the tickets/icons.ts style; a separate file so slice 9 never edits slice 1's set). */
export const COST_ICONS = {
  coins: '<ellipse cx="9" cy="7" rx="6" ry="2.5"/><path d="M3 7v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7"/><path d="M9 16.5c-3.3 0-6-1.1-6-2.5"/><ellipse cx="15" cy="15" rx="6" ry="2.5"/><path d="M9 15v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>',
  pages: '<rect x="7" y="3" width="12" height="15" rx="1.5"/><path d="M5 7v12a2 2 0 0 0 2 2h9"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  zoomIn: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3M8 11h6"/>',
  prev: ICON_PATHS.chevron,
  next: ICON_PATHS.chevronBack,
  paid: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="m8 12 3 3 5-6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  plus: ICON_PATHS.plus,
  x: ICON_PATHS.close,
  check: ICON_PATHS.check,
  edit: ICON_PATHS.edit,
  refresh: ICON_PATHS.refresh,
  warning: ICON_PATHS.warning,
  lock: ICON_PATHS.lock,
  attach: '<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7"/>',
} as const;

/** TKUI4: the few pictograms the v5 list adds to tickets/icons.ts (24 x 24 strokes, sized by the font-size of the place they sit in). */
export const LIST_ICONS = {
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-1.9-.4-2.5-1.2M12 6.5V8m0 8v1.5"/>',
  hand: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-.5V4.5a1.5 1.5 0 0 1 3 0V11m0-.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.6-2.2L4 14.5a1.6 1.6 0 0 1 2.4-2L8 14"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  sliders: '<path d="M5 6h9M18 6h1M5 12h3M12 12h7M5 18h11M20 18h-1"/><circle cx="16" cy="6" r="1.8"/><circle cx="10" cy="12" r="1.8"/><circle cx="18" cy="18" r="1.8"/>',
  cardsView: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  tableView: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M3.5 14.5h17M10 5v14"/>',
  boardView: '<rect x="3.5" y="4" width="4.5" height="14" rx="1.5"/><rect x="9.75" y="4" width="4.5" height="9" rx="1.5"/><rect x="16" y="4" width="4.5" height="11" rx="1.5"/>',
} as const;

/** TKRFQ2: the few pictograms the RFQ screens need beyond tickets/icons.ts (same 24 x 24 stroke style, `<svg class="ic">`). A separate
 * file so the shared icon set of the module is not edited by this slice. */
export const RFQ_ICONS = {
  columns: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v12"/>',
  cal: ICON_PATHS.calendar,
  history: '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5M12 8v4l3 2"/>',
  file: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
  bolt: ICON_PATHS.bolt,
  hand: '<path d="M6 12V7a2 2 0 0 1 4 0v4M10 11V5a2 2 0 0 1 4 0v6M14 11V7a2 2 0 0 1 4 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-4a2 2 0 0 1 3.4-2L8 13"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
  // RFQATT: the request's files
  clip: '<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  sheet: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 14h7M9 17h7M12 11v6"/>',
} as const;

/** CR-038 slice 6b: the pictograms the board table adds to tickets/icons.ts (the same 24 x 24 stroke style, `<svg class="ic">`). */
export const TABLE_ICONS = {
  cards: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  table: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  kanban: '<rect x="3.5" y="4" width="4.5" height="14" rx="1.5"/><rect x="9.75" y="4" width="4.5" height="9" rx="1.5"/><rect x="16" y="4" width="4.5" height="11" rx="1.5"/>',
  columns: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15M14.5 4.5v15"/>',
  density: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
  chevron: ICON_PATHS.chevronDown,
  up: '<path d="m6 15 6-6 6 6"/>',
  down: ICON_PATHS.chevronDown,
  arrowUp: ICON_PATHS.arrowUp,
  arrowDown: ICON_PATHS.arrowDown,
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
  sort: '<path d="M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4"/>',
  filter: '<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
  bookmark: '<path d="M6 3.5h12V21l-6-4-6 4z"/>',
} as const;

export type TicketIconName = keyof typeof TICKET_ICONS;
export type CostIconName = keyof typeof COST_ICONS;
export type ListIconName = keyof typeof LIST_ICONS;
export type RfqIconName = keyof typeof RFQ_ICONS;
export type TableIconName = keyof typeof TABLE_ICONS;

const icon = (inner: string, cls: string): TemplateResult => iconSvg(inner, cls ? `ic ${cls}` : 'ic');

/** An inline icon; its size is the `font-size` of the place it sits in. The paths are static markup of this file, never user data. */
export const tIcon = (name: TicketIconName, cls = ''): TemplateResult => icon(TICKET_ICONS[name], cls);
/** The cost screens' set. */
export const cIcon = (name: CostIconName, cls = ''): TemplateResult => icon(COST_ICONS[name], cls);
/** The v5 list's set. */
export const listIcon = (name: ListIconName, cls = ''): TemplateResult => icon(LIST_ICONS[name], cls);
/** The RFQ screens' set. */
export const rIcon = (name: RfqIconName, cls = ''): TemplateResult => icon(RFQ_ICONS[name], cls);
/** The board table's set. */
export const tbIcon = (name: TableIconName, cls = ''): TemplateResult => icon(TABLE_ICONS[name], cls);
