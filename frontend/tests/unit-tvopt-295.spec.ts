import { test, expect } from '@playwright/test';
import { TV_FACTORY, effectiveTv, weatherDaysOf, gridPlan, gridPlanExtra, headerOf, tvDefaultsOf, nightLogoMode, nightLogoOf, othersMax, spaceExtra, spaceGrow, spaceOf, updatedOf } from '../src/notice-tv/tv-logic';

// TVOPT-295: the readers of the four TV screen choices and the rules behind them (pure logic).
//   npx playwright test tests/unit-tvopt-295.spec.ts --project=desktop

test('readers: a missing or unknown value reads as the screen as before', () => {
  expect([headerOf({}), updatedOf({}), spaceOf({}), nightLogoOf({})]).toEqual(['c', 'place', 'bigger', 'auto']); // TVNOTICE2-297: the "updated" line defaults to the preview wording
  expect(headerOf({ header: 'z' as never })).toBe('c');
  expect(updatedOf({ updated: 'never' as never })).toBe('place');
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

test('installation defaults: checked on read, the factory values are the screen as before', () => {
  expect(TV_FACTORY).toEqual({ header: 'c', updated: 'place', space: 'bigger', night_logo: 'auto', weather_days: 0, idle_logo: 'sw' });
  expect(tvDefaultsOf(undefined)).toEqual(TV_FACTORY);
  expect(tvDefaultsOf({ header: 'b', updated: 'x', space: 'more', night_logo: null, weather_days: 4 })).toEqual({ header: 'b', updated: 'place', space: 'more', night_logo: 'auto', weather_days: 4, idle_logo: 'sw' });
  expect(tvDefaultsOf({ weather_days: 9 }).weather_days).toBe(0);
});

test("a board's own value wins over the installation default; absent or null follows it", () => {
  const dflt = { header: 'a', updated: 'time', space: 'mix', night_logo: 'plate', weather_days: 4, idle_logo: 'both' } as const;
  expect(effectiveTv({}, dflt)).toEqual(dflt);
  expect(effectiveTv({ header: 'c', updated: null, night_logo: 'invert', weather_days: 0 }, dflt)).toEqual({ header: 'c', updated: 'time', space: 'mix', night_logo: 'invert', weather_days: 0, idle_logo: 'both' }); // an own 0 wins
  expect(effectiveTv({ weather_days: null }, dflt).weather_days).toBe(4);
});
test('weather_days: 0..5, anything else reads as 0 (as before)', () => {
  expect([0, 1, 2, 5].map((n) => weatherDaysOf({ weather_days: n }))).toEqual([0, 1, 2, 5]);
  expect([6, -1, 2.5, null, undefined].map((n) => weatherDaysOf({ weather_days: n as number }))).toEqual([0, 0, 0, 0, 0]);
  expect(weatherDaysOf({ weather_days: '3' as never })).toBe(0);
});
