/**
 * Pure grid-layout maths for the all-cameras wall (T091's grid_col_span, T018's bestFit()/fitTile() sizing)
 * - no DOM and no Lit, so it runs in node (tests/unit-wall-grid.spec.ts). Kept out of live-wall.ts itself only
 * so it can be imported without pulling in Lit/custom-element registration.
 */

/** Where CSS Grid's default (`grid-auto-flow: row`, sparse) auto-placement puts each tile of the wall: its row
 * and its starting column (column 0 = the inline-start edge - the RIGHT edge in this RTL UI), one entry per input
 * span, in the same order.
 *
 * Owner decision 2026-09-27: the wall shows the cameras in EXACTLY their saved order, even when that leaves a
 * gap at the end of a row. That is plain row auto-placement: every tile of this wall spans columns only (never a
 * row), so the placement cursor only ever moves forward - a tile goes right after the previous one if its span
 * still fits in the current row, otherwise it starts the next row, and a gap left at a row end is never filled
 * by a later tile. (The wall used `grid-auto-flow: dense` before; dense placement restarts every search from the
 * first row and pulls a later, narrower tile into such a gap, which put cameras on screen out of their saved
 * order - e.g. the owner's 11 cameras with span 2 on the 4th and 6th at 4 columns showed the 5th ahead of the
 * 4th.) A span wider than the column count is clamped to it, as the wall itself clamps grid_col_span.
 *
 * Reading this placement row by row, then column by column, is therefore always the input order. */
export function simulateStrictPlacement(spans: number[], cols: number): { row: number; col: number }[] {
  const placement: { row: number; col: number }[] = [];
  let row = 0;
  let used = 0; // columns already taken in the current row
  for (const raw of spans) {
    const s = Math.min(Math.max(1, raw), cols);
    if (used + s > cols) {
      row += 1;
      used = 0;
    }
    placement.push({ row, col: used });
    used += s;
  }
  return placement;
}

/** The EXACT number of rows the wall renders for these column spans at `cols` columns (strict saved-order
 * placement - see simulateStrictPlacement()). The tile-height budget in live-wall.ts's fitTile() must use the row
 * count the browser really renders: an ideal-packing estimate (`Math.ceil(sum(spans)/cols)`) ignores the gaps at
 * row ends and undercounts - e.g. spans [3,3,3,3] at 4 columns render 4 rows, not 3 - which sizes the tiles too
 * big and overflows the screen (T018 re-review). */
export function simulateStrictRows(spans: number[], cols: number): number {
  const placement = simulateStrictPlacement(spans, cols);
  return placement.length ? placement[placement.length - 1].row + 1 : 0;
}
