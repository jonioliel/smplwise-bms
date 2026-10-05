import { test, expect } from '@playwright/test';
import { DD_PICKER_DEFAULT, DD_PICKER_IDS, DD_SEARCH_DEFAULT, DD_SEARCH_IDS, ddSearchMin } from '../src/components/dd-style';
import { toggleCapped, limitNotice } from '../src/components/multi-select';

// 2.0.2 (owner feedback 2026-10-05): the two global dials of the camera comparison pickers, as plain data - from how many cameras a
// multi-select list searches (`ui.dd_search`: always | 4 | 8 | never, default 4) and how the picker is drawn (`ui.dd_picker`:
// dropdown | chips, default dropdown). No browser page; runs in every project.

test.describe('camera picker dials (pure)', () => {
  test('the closed lists and their defaults match the backend twin (services/dd_style.py)', () => {
    expect(DD_SEARCH_IDS).toEqual(['always', '4', '8', 'never']);
    expect(DD_SEARCH_DEFAULT).toBe('4');
    expect(DD_PICKER_IDS).toEqual(['dropdown', 'chips']);
    expect(DD_PICKER_DEFAULT).toBe('dropdown');
  });

  test('ddSearchMin: the smallest option count that gets a search field; an unknown or missing value is the default (4)', () => {
    expect(ddSearchMin('always')).toBe(1);
    expect(ddSearchMin('4')).toBe(4);
    expect(ddSearchMin('8')).toBe(8);
    expect(ddSearchMin('never')).toBe(Number.POSITIVE_INFINITY);
    expect(ddSearchMin(null)).toBe(4);
    expect(ddSearchMin(undefined)).toBe(4);
    expect(ddSearchMin('')).toBe(4);
    expect(ddSearchMin('6')).toBe(4);
    // what the dropdown asks: n options >= the minimum
    for (const [dial, n, expected] of [['always', 1, true], ['4', 3, false], ['4', 4, true], ['8', 7, false], ['8', 8, true], ['never', 50, false]] as const) {
      expect(n >= ddSearchMin(dial), `${dial} at ${n}`).toBe(expected);
    }
  });

  test('the chips mode shares the dropdown\'s limit logic: the limit disables the rest instead of swapping the oldest out', () => {
    // the recordings screen: 3 extras next to the lead; the synchronized set: 4
    expect(toggleCapped(['c2', 'c3', 'c4'], 'c5', 3)).toEqual({ ids: ['c2', 'c3', 'c4'], refused: true });
    expect(toggleCapped(['c2', 'c3', 'c4'], 'c3', 3)).toEqual({ ids: ['c2', 'c4'], refused: false });
    expect(limitNotice(3, 1)).toBe('אפשר לבחור עד 4');
    expect(limitNotice(4)).toBe('אפשר לבחור עד 4');
  });
});
