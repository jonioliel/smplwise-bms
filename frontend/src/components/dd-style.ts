/**
 * The dropdown style ids, as plain data (no Lit, no decorators): `shell/tabs-mode.ts` (and through it `shell/nav.ts`, which the unit
 * specs import under Playwright's own transpiler) must not pull the `sw-dropdown` component in just to read the list of ids.
 * `sw-dropdown.ts` re-exports both names, so existing imports keep working.
 */
export type DdStyle = 'auto' | 'pill' | 'field' | 'underline' | 'text' | 'prefix' | 'tonal' | 'capsule';
export const DD_STYLE_IDS: readonly DdStyle[] = ['auto', 'pill', 'field', 'underline', 'text', 'prefix', 'tonal', 'capsule'];

/** The SIZE of a dropdown (Unreleased, owner request 2026-10-04): `md` is the reference size (and today's size for the other styles). */
export type DdSize = 'sm' | 'md' | 'lg';
export const DD_SIZE_IDS: readonly DdSize[] = ['sm', 'md', 'lg'];
export const DD_SIZE_DEFAULT: DdSize = 'md';

/** Unreleased (owner decisions 2026-10-04, capsule style only): the ring thickness in px and the width of the open panel. Backend twin: services/dd_style.py. */
export type DdRing = '1' | '1.5' | '2' | '3';
export const DD_RING_IDS: readonly DdRing[] = ['1', '1.5', '2', '3'];
export const DD_RING_DEFAULT: DdRing = '2';
export type DdPanel = 'button' | '240' | '300';
export const DD_PANEL_IDS: readonly DdPanel[] = ['button', '240', '300'];
export const DD_PANEL_DEFAULT: DdPanel = '240';
/** 2.0.2 (owner feedback 2026-10-05): from how many options a MULTI-SELECT list (the camera comparison pickers) carries a search field.
 * `always` | `4` (default) | `8` (the single-choice lists' fixed rule) | `never`. One global value (installation `ui.dd_search`, personal
 * /me/prefs), carried to `sw-dropdown` as `data-dd-search` on <html>. Backend twin: services/dd_style.py. */
export type DdSearch = 'always' | '4' | '8' | 'never';
export const DD_SEARCH_IDS: readonly DdSearch[] = ['always', '4', '8', 'never'];
export const DD_SEARCH_DEFAULT: DdSearch = '4';
/** The smallest option count that gets a search field for the dial (`always` = 1: every list; `never` = Infinity). An unknown value = the default. */
export function ddSearchMin(search: string | null | undefined): number {
  switch (search) {
    case 'always':
      return 1;
    case 'never':
      return Number.POSITIVE_INFINITY;
    case '8':
      return 8;
    default:
      return 4;
  }
}

/** 2.0.2 (owner feedback 2026-10-05): how the camera comparison picker is shown - `dropdown` (the multi-select list, default; the phone keeps
 * its bottom sheet) or `chips` (a button per camera, the 2.0.0 look). One global value (installation `ui.dd_picker`, personal /me/prefs). */
export type DdPicker = 'dropdown' | 'chips';
export const DD_PICKER_IDS: readonly DdPicker[] = ['dropdown', 'chips'];
export const DD_PICKER_DEFAULT: DdPicker = 'dropdown';

/** The panel's minimum width in px at the given size dial (`button` = no floor: as wide as the button). The base is the `md` width; sm / lg scale it. */
export function ddPanelFloor(panel: DdPanel, size: DdSize): number {
  if (panel === 'button') return 0;
  return Math.round(Number(panel) * ({ sm: 200, md: 240, lg: 280 } as Record<DdSize, number>)[size] / 240);
}
