/**
 * The geometry contract of the HUD over the floor map's plan and 3D canvas (owner 2026-10-13: the pictures of the opaque panels,
 * docs/design/evidence/hud-opaque/, showed three layout collisions that translucency had been hiding). Pure: no Lit, no DOM - a node spec
 * (tests/unit-hud-layout.spec.ts) pins every rule, and the browser twin (tests/evidence-hud-layout-live.spec.ts) reads the real rectangles.
 *
 * The collisions, and what stops them. Everything below is measured from the stage (the map's box), in px:
 *   1. THE CORNER. The floor map's circuit buttons and the 3D element's time pill (the realistic level), its picker and the walk's minimap all
 *      stood top / inline-end 12 px, in two different shadow roots that knew nothing of each other. The corner is now a stack: the 3D element
 *      says what it keeps there (`hud-corner`: the time pill, the minimap, or nothing - sw-plan-3d.ts) and the circuit buttons start below it
 *      (HUD_PILL_ROW, or under the minimap). The picker is a menu: it opens over the stack, above everything (its z-index).
 *   2. THE DOCKED PANELS. The side list and the layers list are docked at the inline-end edge. While one is open the corner's blocks (circuit
 *      buttons, time pill, picker, minimap) start past it (`--hud-end`, set on the stage; hudEnd() is the rule), the level bar is centred in what
 *      is left, and the side list stops above the zoom buttons' row (HUD_BELOW_LIST). On a phone the list is a bottom sheet: the zoom buttons
 *      stand above it (`--hud-bottom`).
 *   3. THE LEVEL BAR. It was centred with `inset-inline-start: 50%` + `translateX(-50%)`: in RTL that pushed it half its own width off the
 *      canvas's left edge. It is centred with two logical insets and auto margins now (direction-free). One row between the floor chip and the
 *      corner when it fits (needsSecondRow() decides, from measured widths), else a row of its own under them, and the blocks of the two
 *      columns start under it.
 * All sizes here mirror CSS elsewhere (the minimap's 160 / 112 px in sw-plan-3d.ts, the side list's width in explore-floor-map.ts); the node
 * spec reads those sources and fails when a number drifts.
 */

/** The gap every HUD panel keeps from the stage's edge. */
export const HUD_EDGE = 12;
/** The gap between two HUD panels. */
export const HUD_GAP = 8;

/** The top of the block under the time pill: its 12 px inset + the pill's 37 px + a gap (the hint pill and the picker already used 56 / 52). */
export const HUD_PILL_ROW = 56;
/** The widest the time pill gets (the clock and its "now" button, ~135 px measured) plus slack: the lane it needs beside the level bar. */
export const HUD_PILL_MAX = 160;
/** The walk's minimap (sw-plan-3d.ts `.minimap`): 160 px, 112 px up to 640 px of viewport. */
export const HUD_MINIMAP = 160;
export const HUD_MINIMAP_PHONE = 112;
/** The viewport width up to which the phone sizes apply (the CSS `max-width` of the same rules). */
export const HUD_PHONE_MAX = 640;
/** The viewport width up to which the side list is a bottom sheet (the floor map's `narrow`). */
export const HUD_SHEET_MAX = 767;

/** The side list: 236 px + its hairline (explore-floor-map.ts `.sidelist`). */
export const HUD_LIST_W = 238;
/** The layers list: 272 px + 2 x 14 px padding + its hairline (`.panel`). */
export const HUD_PANEL_W = 302;
/** Where the corner's blocks start while the side list / the layers list is open: the edge inset + the panel + a gap + the hairline slack. */
export const HUD_END_LIST = HUD_EDGE + HUD_LIST_W + HUD_GAP + 2;
export const HUD_END_PANEL = HUD_EDGE + HUD_PANEL_W + HUD_GAP + 2;

/** How far above the stage's bottom a docked list stops: the zoom buttons (90 px with a mouse, 120 px at the touch size) + their 12 px edge + a gap.
 * The 3D view's rows and the walk bar are shorter than that, so nothing of the bottom edge stands under the list. */
export const HUD_BELOW_LIST = 140;
/** The phone's side list is a bottom sheet of this share of the stage (38 %, 78 % pulled up): the zoom buttons stand above it. */
export const HUD_SHEET = 38;
export const HUD_SHEET_TALL = 78;

/** What the 3D element keeps in the corner (its `hud-corner` event): the time pill, the walk's minimap, or nothing. */
export type HudCorner = 'pill' | 'minimap' | null;

/** Where the blocks under the corner start (the circuit buttons): below the pill row, or below the minimap; the edge inset when the corner is empty. */
export function cornerBottom(corner: HudCorner, phone: boolean): number {
  if (corner === 'pill') return HUD_PILL_ROW;
  if (corner === 'minimap') return HUD_EDGE + (phone ? HUD_MINIMAP_PHONE : HUD_MINIMAP) + HUD_GAP;
  return HUD_EDGE;
}

/** The inline-end inset of the free band: what a docked panel takes. The side list docks from 768 px of viewport (a bottom sheet below); the layers
 * list is a popover that docks over the corner from 641 px (up to 640 px it covers the whole corner and the circuit buttons give way). */
export function hudEnd(s: { sideList: boolean; panel: boolean; viewport: number }): number {
  let end = HUD_EDGE;
  if (s.sideList && s.viewport > HUD_SHEET_MAX) end = Math.max(end, HUD_END_LIST);
  if (s.panel && s.viewport > HUD_PHONE_MAX) end = Math.max(end, HUD_END_PANEL);
  return end;
}

/** The bottom inset of the zoom buttons and the scale readout while the phone's side list is a bottom sheet over the plan (null = their own edge). */
export function hudBottom(s: { sideList: boolean; viewport: number; tall: boolean }): string | null {
  if (!s.sideList || s.viewport > HUD_SHEET_MAX) return null;
  return `calc(${s.tall ? HUD_SHEET_TALL : HUD_SHEET}% + ${HUD_EDGE}px)`;
}

/** The width of what stands in the level bar's row at the corner side: the walk's minimap, the time pill, else - nothing above them - the circuit
 * buttons themselves (their own measured width; 0 = none). */
export function endItemWidth(corner: HudCorner, circuitsWidth: number): number {
  if (corner === 'minimap') return HUD_MINIMAP;
  if (corner === 'pill') return HUD_PILL_MAX;
  return circuitsWidth;
}

/** Whether the level bar drops to a row of its own. The bar is centred in the free band (between the edge inset and `end`), so the room it needs
 * is its own width plus, on each side, the wider of the two things beside it in row 1 (the floor chip on the start side, the corner's item on the
 * end side) and a gap. All widths are measured by the caller; `bar` is the bar's single-line width. */
export function needsSecondRow(s: { stage: number; end: number; bar: number; chip: number; endItem: number }): boolean {
  if (s.bar <= 0) return false;
  const band = s.stage - HUD_EDGE - s.end;
  const side = Math.max(s.chip, s.endItem) + HUD_GAP;
  return s.bar + 2 * side > band;
}
