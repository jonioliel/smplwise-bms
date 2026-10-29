import { test, expect } from '@playwright/test';
import { filledSpans, packPages, PAGE_ROWS } from '../src/tickets/overview-model';
import { ot, OVERVIEW_TEXT_EN_KEYS } from '../src/tickets/overview-text';
import { setTicketNames } from '../src/tickets/naming';

// OVERVIEWFIT-297: the overview's widget pages on a desktop (two rows of a three-column grid a page). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-overview-pages-297.spec.ts

test.beforeEach(() => setTicketNames(null));

test('pages of two rows, cut the way the grid places the widgets', () => {
  expect(PAGE_ROWS).toBe(2);
  // the default order with the comparison below the numbers: full | wide 1 | wide 1 | 1 1 1 | 1 wide | 1
  const spans = [3, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1];
  expect(packPages(spans, 3)).toEqual([[0, 1, 2], [3, 4, 5, 6, 7], [8, 9, 10]]);
  // without the comparison and without payments
  expect(packPages([2, 1, 2, 1, 1, 1, 1, 2, 1], 3)).toEqual([[0, 1, 2, 3], [4, 5, 6, 7, 8]]);
  // a wide widget that does not fit in what is left of a row starts the next row (the grid leaves the hole)
  expect(packPages([1, 1, 2, 1], 3)).toEqual([[0, 1, 2, 3]]);
  expect(packPages([1, 1, 2, 2, 2], 3)).toEqual([[0, 1, 2], [3, 4]]);
  // a span wider than the grid takes the row; a bad span reads as 1
  expect(packPages([5, 5, 5], 3)).toEqual([[0, 1], [2]]);
  expect(packPages([0, Number.NaN, -1, 1], 3)).toEqual([[0, 1, 2, 3]]);
  // nothing to show, one widget, a narrower grid
  expect(packPages([], 3)).toEqual([]);
  expect(packPages([2], 3)).toEqual([[0]]);
  expect(packPages([2, 1, 2, 1], 2)).toEqual([[0, 1], [2, 3]]);
});

test('a short row is closed by its last widget: no empty cell on a page', () => {
  // default order: the last row of the last page is 'daily' alone -> it takes the row
  expect(filledSpans([3, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1], 3)).toEqual([3, 2, 1, 2, 1, 1, 1, 1, 1, 2, 3]);
  // a wide widget that moves to the next row widens the one before it
  expect(filledSpans([1, 1, 2, 1], 3)).toEqual([1, 2, 2, 1]);
  expect(filledSpans([2, 2, 2], 3)).toEqual([3, 3, 3]);
  expect(filledSpans([], 3)).toEqual([]);
  expect(filledSpans([1, 1, 1], 3)).toEqual([1, 1, 1]);
});

test('the pager texts, Hebrew and English', () => {
  expect(ot('pageDot', { n: 2, of: 3, names: 'א, ב' })).toBe('עמוד 2 מתוך 3: א, ב');
  for (const k of ['pagesGroup', 'pagePrev', 'pageNext', 'pageOf', 'pageDot', 'pageAlert'] as const) expect(OVERVIEW_TEXT_EN_KEYS).toContain(k);
});
