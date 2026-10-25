import { test, expect } from '@playwright/test';
import { gridPlan, gridPlanExtra, headerOf, nightLogoMode, nightLogoOf, othersMax, spaceExtra, spaceGrow, spaceOf, updatedOf } from '../src/notice-tv/tv-logic';

// TVOPT-295: the readers of the four TV screen choices and the rules behind them (pure logic).
//   npx playwright test tests/unit-tvopt-295.spec.ts --project=desktop

test('readers: a missing or unknown value reads as the screen as before', () => {
  expect([headerOf({}), updatedOf({}), spaceOf({}), nightLogoOf({})]).toEqual(['c', 'full', 'bigger', 'auto']);
  expect(headerOf({ header: 'z' as never })).toBe('c');
  expect(updatedOf({ updated: 'never' as never })).toBe('full');
  expect(spaceOf({ space: 2 as never })).toBe('bigger');
  expect(nightLogoOf({ night_logo: 'white' as never })).toBe('auto');
  expect([headerOf({ header: 'a' }), headerOf({ header: 'b' }), updatedOf({ updated: 'issues' }), spaceOf({ space: 'mix' }), nightLogoOf({ night_logo: 'invert' })]).toEqual(['a', 'b', 'issues', 'mix', 'invert']);
});

test('the freed height only exists under a one-row header', () => {
  expect(spaceGrow('c', 'bigger')).toBe(1);
  expect(spaceGrow('a', 'bigger')).toBeCloseTo(1.16);
  expect(spaceGrow('b', 'mix')).toBeCloseTo(1.08);
  expect(spaceGrow('a', 'more')).toBe(1);
  expect([spaceExtra('c', 'more'), spaceExtra('a', 'more'), spaceExtra('b', 'mix'), spaceExtra('a', 'bigger')]).toEqual([false, true, true, false]);
  expect([othersMax(false), othersMax(true)]).toEqual([3, 4]);
});

test('the extra row of "all together" adds one row of the same columns', () => {
  expect(gridPlanExtra(12, true, false, false)).toEqual(gridPlan(12, true, false));
  expect(gridPlanExtra(12, true, false, true)).toEqual({ per: 9, cols: 3, rows: 3, pages: 2 });
  expect(gridPlanExtra(7, true, false, true)).toEqual({ per: 7, cols: 3, rows: 3, pages: 1 });
  expect(gridPlanExtra(9, false, true, true)).toEqual({ per: 5, cols: 1, rows: 5, pages: 2 });
  expect(gridPlanExtra(2, true, false, true)).toEqual({ per: 2, cols: 2, rows: 1, pages: 1 });
});

test('the night logo mode: auto follows the system, plate is always the plate, invert only when possible', () => {
  expect(nightLogoMode('auto', 'file', true, false)).toBe('file');
  expect(nightLogoMode('auto', 'invert', false, false)).toBe('invert');
  expect(nightLogoMode('plate', 'invert', true, true)).toBe('plate');
  expect(nightLogoMode('invert', 'plate', true, false)).toBe('file'); // the dark file wins
  expect(nightLogoMode('invert', 'plate', false, true)).toBe('invert'); // a transparent light file inverts cleanly
  expect(nightLogoMode('invert', 'plate', false, false)).toBe('plate'); // an opaque one would turn into a dark box
});
