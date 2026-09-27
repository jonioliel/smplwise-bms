import { test, expect } from '@playwright/test';
import { simulateStrictPlacement, simulateStrictRows } from '../src/screens/wall-grid';

// The all-cameras wall's grid placement (T091 grid_col_span, T018 sizing). Owner decision 2026-09-27: cameras
// are shown in exactly their saved order - CSS Grid's default row auto-placement, NOT `grid-auto-flow: dense` -
// even when a row then ends in a gap. The tile-height budget needs the exact row count of that placement, and
// the on-screen order must be the saved order. Node only (pure functions in src/screens/wall-grid.ts).

/** Reading order of a placement: row by row, then by column (column 0 is the right edge in this RTL UI). */
const readingOrder = (spans: number[], cols: number) =>
  simulateStrictPlacement(spans, cols)
    .map((p, i) => ({ ...p, i }))
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((p) => p.i);

test.describe('strict (saved-order) placement of the camera wall', () => {
  // the 11 lab cameras, span 2 on the 4th and the 6th (index 3 and 5)
  const ownerSpans = [1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1];

  test('the owner layout at 4 columns: 4 rows, cameras exactly in saved order, gaps left at two row ends', () => {
    // worked out by hand:
    //   row 0: #0 #1 #2 [gap]         - #3 (span 2) does not fit in the 1 column left
    //   row 1: #3 #3 #4 [gap]         - #5 (span 2) does not fit in the 1 column left
    //   row 2: #5 #5 #6 #7
    //   row 3: #8 #9 #10
    expect(simulateStrictPlacement(ownerSpans, 4)).toEqual([
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
      { row: 1, col: 0 }, { row: 1, col: 2 },
      { row: 2, col: 0 }, { row: 2, col: 2 }, { row: 2, col: 3 },
      { row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 },
    ]);
    expect(simulateStrictRows(ownerSpans, 4)).toBe(4);
    expect(readingOrder(ownerSpans, 4)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // (dense placement, used before this decision, also needed 4 rows here but showed #4 ahead of #3:
    // 0,1,2,4,3,5,... - the reorder the owner rejected)
  });

  test('the owner layout at 5 columns packs without a gap: 3 rows, saved order', () => {
    //   row 0: #0 #1 #2 #3 #3 / row 1: #4 #5 #5 #6 #7 / row 2: #8 #9 #10
    expect(simulateStrictRows(ownerSpans, 5)).toBe(3);
    expect(readingOrder(ownerSpans, 5)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('a wide tile ends a row early and a later narrow tile does NOT backfill the gap it left', () => {
    // spans [1,1,3,1,1] at 4 columns:
    //   row 0: #0 #1 [gap gap]  - #2 (span 3) needs 3 columns, only 2 are left
    //   row 1: #2 #2 #2 #3      - #3 goes right after #2, NOT back into row 0's gap
    //   row 2: #4
    const p = simulateStrictPlacement([1, 1, 3, 1, 1], 4);
    expect(p[2]).toEqual({ row: 1, col: 0 });
    expect(p[3]).toEqual({ row: 1, col: 3 });
    expect(p[4]).toEqual({ row: 2, col: 0 });
    expect(simulateStrictRows([1, 1, 3, 1, 1], 4)).toBe(3); // dense placement packed this into 2 rows
    expect(simulateStrictRows([1, 1, 3], 4)).toBe(2);
  });

  test('the former dense-packing cases: strict needs the same or MORE rows, never fewer', () => {
    // [spans, cols, rows dense placement rendered, strict rows] - the dense figures of the first three were
    // measured in Chromium in the T018 re-review, [1,1,3,1,1] is from the former dense model (simulateDenseRows),
    // [3,3,3,3] was the former live overflow test (4 distinct row tops)
    const cases: [number[], number, number, number][] = [
      [[3, 3, 2], 4, 3, 3], // every row end is a 1-column gap nothing could fill anyway: same
      [[3, 3, 2, 2], 4, 3, 3], // same
      [[3, 2, 1, 1, 1], 4, 2, 3], // dense backfilled the span-1 tiles next to the span-3; strict cannot: 3 rows
      [[1, 1, 3, 1, 1], 4, 2, 3], // dense pulled #3 and #4 into row 0; strict keeps them after #2
      [[3, 3, 3, 3], 4, 4, 4], // the four-span-3 live overflow case: 4 rows either way
    ];
    for (const [spans, cols, dense, strict] of cases) {
      expect(simulateStrictRows(spans, cols), `${spans} at ${cols}`).toBe(strict);
      expect(strict).toBeGreaterThanOrEqual(dense);
    }
  });

  test('a single span-4 tile at 4 columns gets a row of its own, the next tiles start a new row', () => {
    expect(simulateStrictRows([4], 4)).toBe(1);
    expect(simulateStrictRows([4, 1, 1], 4)).toBe(2);
    expect(simulateStrictRows([1, 4, 1], 4)).toBe(3); // #1 cannot share a row with anything
  });

  test('every span 1 reduces to the plain ceil(n / cols) case', () => {
    expect(simulateStrictRows([1, 1, 1, 1, 1], 2)).toBe(Math.ceil(5 / 2));
    expect(simulateStrictRows([1, 1, 1, 1, 1, 1], 3)).toBe(Math.ceil(6 / 3));
    expect(simulateStrictRows(new Array(9).fill(1), 4)).toBe(Math.ceil(9 / 4));
    expect(simulateStrictRows([], 4)).toBe(0);
  });

  test('a span larger than the column count is clamped, matching how the wall clamps grid_col_span', () => {
    expect(simulateStrictRows([6], 4)).toBe(simulateStrictRows([4], 4));
    expect(simulateStrictPlacement([1, 6, 1], 4)).toEqual([{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }]);
  });

  test('reading order is always the input order, for any spans and column count', () => {
    const spans = [2, 1, 3, 1, 1, 4, 2, 2, 1, 3, 1];
    for (const cols of [1, 2, 3, 4, 5, 6]) expect(readingOrder(spans, cols)).toEqual(spans.map((_, i) => i));
  });
});
