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
/** The panel's minimum width in px at the given size dial (`button` = no floor: as wide as the button). The base is the `md` width; sm / lg scale it. */
export function ddPanelFloor(panel: DdPanel, size: DdSize): number {
  if (panel === 'button') return 0;
  return Math.round(Number(panel) * ({ sm: 200, md: 240, lg: 280 } as Record<DdSize, number>)[size] / 240);
}
