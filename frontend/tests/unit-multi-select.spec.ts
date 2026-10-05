import { test, expect } from '@playwright/test';
import { extraFromParam, limitNotice, pickedCount, pickedSummary, toggleCapped } from '../src/components/multi-select';

// 2.0.1 (owner request 2026-10-05): the pure selection logic of the multi-select dropdown (sw-dropdown `multiple`) and of the
// recordings screen's comparison set - no browser page. Runs in every project; the logic has no viewport.

test.describe('multi-select (pure)', () => {
  test('toggleCapped: picks join the end, un-picks keep the order, the pick past the limit is refused and nothing changes', () => {
    expect(toggleCapped([], 'a', 3)).toEqual({ ids: ['a'], refused: false });
    expect(toggleCapped(['a'], 'b', 3)).toEqual({ ids: ['a', 'b'], refused: false });
    expect(toggleCapped(['a', 'b', 'c'], 'd', 3)).toEqual({ ids: ['a', 'b', 'c'], refused: true });
    // a picked one is always un-pickable, even at the limit; the others stay in place
    expect(toggleCapped(['a', 'b', 'c'], 'b', 3)).toEqual({ ids: ['a', 'c'], refused: false });
    // after the un-pick there is room again
    expect(toggleCapped(['a', 'c'], 'd', 3)).toEqual({ ids: ['a', 'c', 'd'], refused: false });
    // the 2.0.0 chips swapped the oldest out (slice(-3)); that is gone: the oldest pick stays
    expect(toggleCapped(['a', 'b', 'c'], 'd', 3).ids[0]).toBe('a');
    // no limit
    expect(toggleCapped(['a', 'b', 'c'], 'd', 0)).toEqual({ ids: ['a', 'b', 'c', 'd'], refused: false });
    // an empty id is a no-op; the input array is never mutated
    const input = ['a'];
    expect(toggleCapped(input, '', 3)).toEqual({ ids: ['a'], refused: false });
    toggleCapped(input, 'b', 3);
    expect(input).toEqual(['a']);
  });

  test('pickedCount / limitNotice: the lead camera is counted through the base ("עד 4" = 3 extras + the lead)', () => {
    expect(pickedCount(0, 3, 1)).toBe('1 מתוך 4');
    expect(pickedCount(2, 3, 1)).toBe('3 מתוך 4');
    expect(pickedCount(3, 3, 1)).toBe('4 מתוך 4');
    expect(pickedCount(2, 4)).toBe('2 מתוך 4');
    expect(pickedCount(5, 0)).toBe('5');
    expect(limitNotice(3, 1)).toBe('אפשר לבחור עד 4');
    expect(limitNotice(4)).toBe('אפשר לבחור עד 4');
  });

  test('pickedSummary: the names in pick order, the placeholder when nothing is picked', () => {
    expect(pickedSummary(['חניה', 'כניסה'], 'השוואה (עד 4)')).toBe('חניה, כניסה');
    expect(pickedSummary([], 'השוואה (עד 4)')).toBe('השוואה (עד 4)');
  });

  test('extraFromParam: the route parameter semantics of 2.0.0 - known ids, the lead dropped, no repeats, at most three', () => {
    const known = ['c1', 'c2', 'c3', 'c4', 'c5'];
    expect(extraFromParam('c2,c3', 'c1', known)).toEqual(['c2', 'c3']);
    expect(extraFromParam('c1,c2', 'c1', known)).toEqual(['c2']); // the lead is not an extra
    expect(extraFromParam('c2,zz,,c3', 'c1', known)).toEqual(['c2', 'c3']); // unknown and empty ids are skipped
    expect(extraFromParam('c2,c2,c3', 'c1', known)).toEqual(['c2', 'c3']); // no repeats
    expect(extraFromParam('c2,c3,c4,c5', 'c1', known)).toEqual(['c2', 'c3', 'c4']); // the first three
    expect(extraFromParam('', 'c1', known)).toEqual([]);
    expect(extraFromParam('c2,c3,c4,c5', 'c1', known, 4)).toEqual(['c2', 'c3', 'c4', 'c5']);
  });
});
