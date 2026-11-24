import { expect, test } from '@playwright/test';
import { BF_ALL, alsoNote, buildingParam, filterKeys, keepBuilding, pickChosen, shows, type BuildingFilterMeta } from '../src/components/building-filter-logic';
import { audienceBuildings, buildingState, toggleBuilding, type AudienceFloor } from '../src/notices/building-audience';

// MULTI-BUILDING-NEXT-2500 (owner 22.11, Q67 / Q69 "then the filtering"): the display rules of the lists' building filter and the notice
// editor's building shortcut. The server decides which buildings an item serves and narrows on its side (tests/test_mb_next_2500.py).

const META: BuildingFilterMeta = {
  buildings: [{ id: 'a', name: 'מגדל א', is_shared: false }, { id: 'b', name: 'מגדל ב', is_shared: false }, { id: 'p', name: 'חניון', is_shared: true }],
  building: null,
};

test('the list opens on the device choice when this list offers it, else the whole site', () => {
  expect(pickChosen(META, 'b')).toBe('b');
  expect(pickChosen(META, 'gone')).toBe(BF_ALL);
  expect(pickChosen(META, '')).toBe(BF_ALL);
  expect(pickChosen(null, 'b')).toBe(BF_ALL);
  expect(pickChosen({ buildings: [META.buildings[0]], building: null }, 'a')).toBe(BF_ALL);
});

test('an item shows under its buildings; one in no building everywhere; everything under the whole site', () => {
  expect(shows(['a'], 'a')).toBe(true);
  expect(shows(['a'], 'b')).toBe(false);
  expect(shows([], 'b')).toBe(true);
  expect(shows(undefined, 'b')).toBe(true);
  expect(shows(['a'], '')).toBe(true);
  const items = [{ id: 1, buildings: ['a'] }, { id: 2, buildings: ['a', 'b', 'p'] }, { id: 3, buildings: [] }, { id: 4 }];
  expect(keepBuilding(items, 'b').map((i) => i.id)).toEqual([2, 3, 4]);
  expect(keepBuilding(items, '').map((i) => i.id)).toEqual([1, 2, 3, 4]);
});

test('Q67: "גם ב..." names the other buildings an item serves, only under a chosen building that is one of them', () => {
  expect(alsoNote(['a', 'b', 'p'], 'a', META)).toBe('גם במגדל ב ובחניון');
  expect(alsoNote(['a', 'b'], 'b', META)).toBe('גם במגדל א');
  expect(alsoNote(['a'], 'a', META)).toBe('');
  expect(alsoNote(['a', 'b'], '', META)).toBe('');
  expect(alsoNote([], 'a', META)).toBe('');
  expect(alsoNote(['b'], 'a', META)).toBe('');
});

test('the keys are the whole site then the buildings in the server order; the parameter only when chosen', () => {
  expect(filterKeys(META).map((k) => k.value)).toEqual(['', 'a', 'b', 'p']);
  expect(filterKeys(META)[0].label).toBe('כל האתר');
  expect(buildingParam('a')).toEqual({ building: 'a' });
  expect(buildingParam('')).toEqual({});
});

test('the notice audience shortcut picks or clears every floor of one building and leaves the others', () => {
  const floors: AudienceFloor[] = [
    { id: 'a0', name: 'קרקע', building: 'מגדל א' }, { id: 'a1', name: '1', building: 'מגדל א' }, { id: 'b0', name: 'קרקע', building: 'מגדל ב' },
  ];
  expect(audienceBuildings(floors)).toEqual(['מגדל א', 'מגדל ב']);
  expect(audienceBuildings(floors.slice(0, 2))).toEqual(['מגדל א']);
  expect(buildingState(floors, [], 'מגדל א')).toBe('none');
  expect(buildingState(floors, ['a0'], 'מגדל א')).toBe('some');
  expect(buildingState(floors, ['a0', 'a1'], 'מגדל א')).toBe('all');
  expect(toggleBuilding(floors, ['b0', 'a0'], 'מגדל א')).toEqual(['b0', 'a0', 'a1']);
  expect(toggleBuilding(floors, ['b0', 'a0', 'a1'], 'מגדל א')).toEqual(['b0']);
  expect(toggleBuilding(floors, [], 'nowhere')).toEqual([]);
});
