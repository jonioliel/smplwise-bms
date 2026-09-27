import { test, expect } from '@playwright/test';
import { simulateDenseRows } from '../src/screens/wall-grid';

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
