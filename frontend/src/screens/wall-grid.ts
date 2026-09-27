/**
 * Pure grid-layout maths for the all-cameras wall (T091's grid_col_span, T018's bestFit()/fitTile() sizing)
 * - no DOM and no Lit, so it runs in node (tests/unit-wall-dense-pack.spec.ts). Kept out of live-wall.ts
 * itself only so it can be imported without pulling in Lit/custom-element registration.
 */

/** T018 re-review: the EXACT number of rows CSS Grid's `grid-auto-flow: dense` auto-placement renders for a
 * list of column-only spans (this codebase never sets a row span - only `grid-column: span N`), so this is a
 * complete model of the placement CSS actually does, not an approximation of it.
 *
 * Why an exact simulation and not `Math.ceil(sum(spans)/cols)`: that ideal-packing estimate assumes spans can
 * always be repacked perfectly, but dense auto-placement is a first-fit, row-major scan - it can leave a
 * 1-column fragment that no later item's span exactly fills, forcing MORE real rows than the ideal estimate
 * predicts. Verified against real Chromium: spans [3,3,2] at 4 columns render 3 rows (this function returns 3),
 * not the 2 `Math.ceil(8/4)` would predict; also verified for [3,3,2,2]->3 and [3,2,1,1,1]->2. Feeding the wrong
 * (too-low) row count into the tile-height budget undersizes the height budget for what the browser actually
 * renders and overflows the screen - the same class of bug this feature has already been fixed for once
 * (letterboxing) and once before that (row-count overflow); this closes the row-count gap exactly rather than
 * with another approximation.
 *
 * Bounded and cheap: at most ~32 cameras (this product's documented wall-size cap) times `cols` (<=6) columns
 * of inner scan, called at most once per candidate column count `bestFit()` tries. */
export function simulateDenseRows(spans: number[], cols: number): number {
  return simulateDensePlacement(spans, cols).reduce((max, p) => Math.max(max, p.row + 1), 0);
}

/** Where CSS Grid's `grid-auto-flow: dense` auto-placement puts each tile: its row and its starting column
 * (column 0 = the inline-start edge - the RIGHT edge in this RTL UI), one entry per input span, same order.
 *
 * This is also what makes the wall's ON-SCREEN order differ from the stored camera order: dense placement
 * restarts every search from the first row, so a later, narrower tile can land in a gap an earlier spanned tile
 * could not fill (the owner's 11 cameras, span 2 on the 4th and 6th, at 4 columns: the 5th camera closes the
 * first row, ahead of the 4th). Reading this placement row by row, column by column gives the real on-screen
 * order (tests/evidence-owner-round11.spec.ts compares it with the rendered positions). */
export function simulateDensePlacement(spans: number[], cols: number): { row: number; col: number }[] {
  const occupied: boolean[][] = [];
  const ensureRow = (r: number) => {
    while (occupied.length <= r) occupied.push(new Array(cols).fill(false));
  };
  const placement: { row: number; col: number }[] = [];
  for (const raw of spans) {
    const s = Math.min(Math.max(1, raw), cols);
    let placed = false;
    for (let r = 0; !placed; r++) {
      ensureRow(r);
      for (let c = 0; c + s <= cols; c++) {
        let fits = true;
        for (let k = 0; k < s; k++) {
          if (occupied[r][c + k]) {
            fits = false;
            break;
          }
        }
        if (fits) {
          for (let k = 0; k < s; k++) occupied[r][c + k] = true;
          placement.push({ row: r, col: c });
          placed = true;
          break;
        }
      }
    }
  }
  return placement;
}
