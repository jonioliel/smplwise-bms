import { expect, test } from '@playwright/test';
import { BF_ALL, keepBuilding, type BuildingFilterMeta } from '../src/components/building-filter-logic';
import { ALL } from '../src/home/home-buildings';
import { HomeListFilter, homeListChoice } from '../src/home/home-list-building';

// MULTI-BUILDING-FILTER-2520 (2.52, T119 MB-HOME-IFACE step 7): the building filter of the home interface's notice board and shared rooms.
// The server decides which buildings an item serves and when a filter exists (tests/test_mb_filter_2520.py); these are the home's rules.

const META: BuildingFilterMeta = {
  buildings: [{ id: 'a', name: 'מגדל א', is_shared: false }, { id: 'b', name: 'מגדל ב', is_shared: false }, { id: 'p', name: 'חניון', is_shared: true }],
  building: null,
};

test('a home list opens on the home building, "all buildings" on all, else the device choice, else every building', () => {
  expect(homeListChoice(META, 'b', false, 'a')).toBe('b');
  expect(homeListChoice(META, ALL, false, 'a')).toBe(BF_ALL);
  expect(homeListChoice(META, '', false, 'a')).toBe('a');
  expect(homeListChoice(META, '', false, 'gone')).toBe(BF_ALL);
  expect(homeListChoice(META, 'x', false, 'p')).toBe('p'); // the home's building is not among this list's buildings
  expect(homeListChoice(null, 'a', false, 'a')).toBe(BF_ALL);
  expect(homeListChoice({ buildings: [META.buildings[0]], building: null }, 'a', false, 'a')).toBe(BF_ALL);
});

test('a locked wall panel follows its own building only, never another choice of the device', () => {
  expect(homeListChoice(META, 'a', true, 'b')).toBe('a');
  expect(homeListChoice(META, '', true, 'b')).toBe(BF_ALL);
  expect(homeListChoice(META, 'x', true, 'b')).toBe(BF_ALL);
  const f = new HomeListFilter();
  f.set(META);
  f.choose('a', 'b');
  expect(f.value('a', true, 'b')).toBe('a');
  expect(f.drawn(true)).toBe(false);
});

test('no answer, or one building = no control and the list of before', () => {
  const f = new HomeListFilter();
  expect(f.drawn(false)).toBe(false);
  expect(f.value('a', false, 'a')).toBe(BF_ALL);
  expect(f.keys('כל הבניינים')).toEqual([]);
  f.set({ buildings: [META.buildings[0]], building: null });
  expect(f.drawn(false)).toBe(false);
  f.set(undefined);
  expect(f.meta).toBeNull();
  const items = [{ id: 1, buildings: ['a'] }, { id: 2 }];
  expect(keepBuilding(items, f.value('a', false, '')).map((i) => i.id)).toEqual([1, 2]);
});

test('a choice made in the list holds while the home stays on its building, and yields when the home building changes', () => {
  const f = new HomeListFilter();
  f.set(META);
  expect(f.drawn(false)).toBe(true);
  expect(f.value('a', false, '')).toBe('a');
  f.choose('a', BF_ALL);
  expect(f.value('a', false, '')).toBe(BF_ALL);
  f.choose('a', 'p');
  expect(f.value('a', false, '')).toBe('p');
  expect(f.value('b', false, '')).toBe('b'); // the home moved to another building: the list follows it
  f.set({ buildings: META.buildings.slice(0, 2), building: null });
  expect(f.value('a', false, '')).toBe('a'); // the chosen building is no longer offered
});

test('the keys say the home\'s "all buildings" first, then the buildings in the server\'s order (the shared one last)', () => {
  const f = new HomeListFilter();
  f.set(META);
  expect(f.keys('כל הבניינים')).toEqual([['', 'כל הבניינים'], ['a', 'מגדל א'], ['b', 'מגדל ב'], ['p', 'חניון']]);
});

test('the chosen building keeps its own items, the shared building\'s and the items of no building', () => {
  const notices = [{ id: 'a', buildings: ['a'] }, { id: 'ab', buildings: ['a', 'b'] }, { id: 'p', buildings: ['a', 'b', 'p'] }, { id: 'all', buildings: [] }];
  expect(keepBuilding(notices, 'b').map((n) => n.id)).toEqual(['ab', 'p', 'all']);
  expect(keepBuilding(notices, BF_ALL).map((n) => n.id)).toEqual(['a', 'ab', 'p', 'all']);
});
