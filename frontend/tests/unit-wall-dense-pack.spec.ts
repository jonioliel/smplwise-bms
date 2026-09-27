import { test, expect } from '@playwright/test';
import { simulateDensePlacement, simulateDenseRows } from '../src/screens/wall-grid';

// T018 re-review: bestFit()'s tile-height budget for the all-cameras wall (T091's grid_col_span feature) needs
// the EXACT row count CSS Grid's `grid-auto-flow: dense` auto-placement will render for a list of column spans,
// not the ideal-packing estimate `Math.ceil(sum(spans)/cols)` - dense placement is a first-fit, row-major scan
// that can leave a 1-column fragment no later span exactly fills, forcing more real rows than that estimate
// predicts and overflowing the wall (the same class of bug T018 already fixed once, for letterboxing). Node only.
test.describe('simulateDenseRows: exact CSS Grid dense auto-placement row count', () => {
  test('spans [3,3,2] at 4 columns render 3 rows, not the ideal-packing 2', () => {
    // row0: span-3 fills cols 0-2, its own 1-column fragment (col 3) is never exactly filled by the
    // remaining spans (3, then 2) - each is forced onto a fresh row. Verified against real Chromium.
    expect(simulateDenseRows([3, 3, 2], 4)).toBe(3);
  });

  test('spans [3,3,2,2] at 4 columns also render 3 rows (the final span-2 backfills the last fragment)', () => {
    expect(simulateDenseRows([3, 3, 2, 2], 4)).toBe(3);
  });

  test('spans [3,2,1,1,1] at 4 columns render 2 rows (the span-1 tiles backfill both fragments)', () => {
    expect(simulateDenseRows([3, 2, 1, 1, 1], 4)).toBe(2);
  });

  test('a single span-4 tile at 4 columns always gets a row of its own', () => {
    expect(simulateDenseRows([4], 4)).toBe(1);
    // two more plain tiles cannot share that row (it is entirely full) - they start a second row.
    expect(simulateDenseRows([4, 1, 1], 4)).toBe(2);
  });

  test('every span 1 (T091 cameras with no explicit span) reduces to the plain ceil(n / cols) case', () => {
    expect(simulateDenseRows([1, 1, 1, 1, 1], 2)).toBe(Math.ceil(5 / 2));
    expect(simulateDenseRows([1, 1, 1, 1, 1, 1], 3)).toBe(Math.ceil(6 / 3));
    expect(simulateDenseRows(new Array(9).fill(1), 4)).toBe(Math.ceil(9 / 4));
  });

  test('a span larger than the column count is clamped, matching how the caller already clamps grid_col_span', () => {
    expect(simulateDenseRows([6], 4)).toBe(simulateDenseRows([4], 4));
  });
});

// T018 review of the 0.1.101 owner-report fix: dense placement does not keep the stored camera order on screen.
test.describe('simulateDensePlacement: where dense auto-placement puts each tile', () => {
  const ownerSpans = [1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1]; // the 11 lab cameras, span 2 on the 4th and 6th
  const readingOrder = (spans: number[], cols: number) =>
    simulateDensePlacement(spans, cols)
      .map((p, i) => ({ ...p, i }))
      .sort((a, b) => a.row - b.row || a.col - b.col)
      .map((p) => p.i);

  test('the owner layout at 4 columns: the 5th camera fills the end of row 1, ahead of the spanned 4th', () => {
    expect(simulateDensePlacement(ownerSpans, 4)[4]).toEqual({ row: 0, col: 3 });
    expect(readingOrder(ownerSpans, 4)).toEqual([0, 1, 2, 4, 3, 5, 6, 7, 8, 9, 10]);
  });

  test('the owner layout at 5 columns packs without any gap, so the on-screen order is the stored order', () => {
    expect(readingOrder(ownerSpans, 5)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('simulateDenseRows is exactly the row count of this placement', () => {
    for (const cols of [2, 3, 4, 5, 6]) {
      expect(simulateDenseRows(ownerSpans, cols)).toBe(Math.max(...simulateDensePlacement(ownerSpans, cols).map((p) => p.row)) + 1);
    }
  });
});
