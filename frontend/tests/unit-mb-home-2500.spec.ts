import { expect, test } from '@playwright/test';
import { ALL, alsoNote, byBuilding, floorBuilding, keepBuilding, nameOf, offLabel, offRooms, pickBuilding, roomsIn, servedBy, shows, type HBuilding } from '../src/home/home-buildings';

// MULTI-BUILDING-HOME-2500 (owner decisions 22.11, Q64-Q67): the pure rules of the home interface's building level. The server decides
// which buildings the rooms reach and cuts "כבה הכל" of a building on its side (tests/test_mb_home_2500.py); these are the display rules.

const A: HBuilding = { id: 'a', name: 'מגדל א', shared: false };
const B: HBuilding = { id: 'b', name: 'מגדל ב', shared: false };
const P: HBuilding = { id: 'p', name: 'חניון', shared: true };
const BS = [A, B, P];
const rooms = [
  { id: 'lobbyA', floor: 'g', bld: 'a' }, { id: 'flatA', floor: '1', bld: 'a' },
  { id: 'lobbyB', floor: 'g2', bld: 'b' }, { id: 'garage', floor: 'p1', bld: 'p' }, { id: 'nowhere', floor: 'x', bld: null },
];

test('Q65: the entry building - the panel / administrator building, then the device, then the first', () => {
  expect(pickBuilding([A], 'a', 'a', true)).toBe('');
  expect(pickBuilding(BS, 'b', 'a', false)).toBe('b');
  expect(pickBuilding(BS, null, 'p', false)).toBe('p');
  expect(pickBuilding(BS, 'gone', 'gone', false)).toBe('a');
  expect(pickBuilding(BS, null, ALL, false)).toBe('a');
  expect(pickBuilding(BS, null, ALL, true)).toBe(ALL);
  expect(keepBuilding('b', BS, false, null)).toBe('b');
  expect(keepBuilding(ALL, BS, false, 'b')).toBe('b');
  expect(keepBuilding('b', [A], false, null)).toBe('');
});

test('Q66: the rooms of a building, and the rooms its "כבה הכל" reaches', () => {
  expect(roomsIn(rooms, '').length).toBe(5);
  expect(roomsIn(rooms, ALL).length).toBe(5);
  expect(roomsIn(rooms, 'a').map((r) => r.id)).toEqual(['lobbyA', 'flatA', 'nowhere']);
  expect(offRooms(rooms, 'a').map((r) => r.id)).toEqual(['lobbyA', 'flatA']);
  expect(offRooms(rooms, 'b').map((r) => r.id)).toEqual(['lobbyB']);
  expect(offRooms(rooms, '').length).toBe(5);
  expect(offLabel(nameOf(BS, 'b'))).toBe('כבה הכל במגדל ב');
  expect(nameOf(BS, ALL)).toBe('');
});

test('Q67: an item serving two buildings shows in each with "גם ב..."', () => {
  const areaB = { lobbyA: 'a', lobbyB: 'b', garage: 'p' };
  const both = servedBy(['lobbyA', 'lobbyB'], areaB, BS);
  expect(both).toEqual(['a', 'b']);
  expect(shows(both, 'a') && shows(both, 'b')).toBe(true);
  expect(shows(both, 'p')).toBe(false);
  expect(alsoNote(both, 'a', BS)).toBe('גם במגדל ב');
  expect(alsoNote(both, 'b', BS)).toBe('גם במגדל א');
  expect(alsoNote(both, ALL, BS)).toBe('');
  // the shared building serves every building
  const shared = servedBy(['garage'], areaB, BS);
  expect(shared).toEqual(['a', 'b', 'p']);
  expect(alsoNote(shared, 'a', BS)).toBe('גם במגדל ב ובחניון');
  // one building: no note; an item with no placed area shows everywhere, without a note
  expect(alsoNote(servedBy(['lobbyA'], areaB, BS), 'a', BS)).toBe('');
  const none = servedBy(['unknown', null], areaB, BS);
  expect(none).toEqual([]);
  expect(shows(none, 'b')).toBe(true);
  expect(alsoNote(none, 'b', BS)).toBe('');
});

test('"כל הבניינים": the floor columns group by building, never interleaved', () => {
  const floors = [{ id: 'g2' }, { id: 'x' }, { id: 'g' }, { id: 'p1' }, { id: '1' }];
  expect(byBuilding(floors, rooms, BS).map((f) => f.id)).toEqual(['g', '1', 'g2', 'p1', 'x']);
  expect(floorBuilding('g2', rooms, BS)?.name).toBe('מגדל ב');
  expect(floorBuilding('x', rooms, BS)).toBeUndefined();
});
