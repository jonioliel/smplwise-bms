import { test, expect } from '@playwright/test';
import { ADJACENT_LABEL, NEARBY_RADIUS, parsePicks, serializePicks, suggestAdjacent, zoneAt, zonesTouch } from '../src/map/adjacent-cameras';

// Suggested adjacent cameras for the map's multi-camera selection (T043 / M043): ranked same room → a room that shares
// a wall → within reach, closest first, one entry per camera, never a picked camera; the picks= parameter round-trips.
// Runs in node: no page, no backend.
const SQ = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const ZONES = [
  { id: 'lobby', name: 'לובי', polygon: SQ(0.1, 0.1, 0.5, 0.5) },
  { id: 'hall', name: 'מסדרון', polygon: SQ(0.5, 0.1, 0.8, 0.5) },
  { id: 'store', name: 'מחסן', polygon: SQ(0.75, 0.75, 0.95, 0.95) },
  { id: 'wing', name: 'אגף', polygon: SQ(0.05, 0.05, 0.6, 0.6) }, // contains the lobby: the smaller room wins
];
const CAMS = [
  { id: 'a-lobby', position: { x: 0.2, y: 0.3 } },
  { id: 'a-lobby2', position: { x: 0.4, y: 0.4 } },
  { id: 'a-hall', position: { x: 0.65, y: 0.3 } },
  { id: 'a-store', position: { x: 0.85, y: 0.85 } },
  { id: 'a-near', position: { x: 0.02, y: 0.35 } }, // outside every room (the wing starts at 0.05), 0.187 from the lobby camera
  { id: 'a-far', position: { x: 0.02, y: 0.98 } },
];

test('the smallest room containing a point wins; rooms sharing a wall touch', () => {
  expect(zoneAt({ x: 0.2, y: 0.3 }, ZONES)?.id).toBe('lobby');
  expect(zoneAt({ x: 0.55, y: 0.55 }, ZONES)?.id).toBe('wing');
  expect(zoneAt({ x: 0.02, y: 0.02 }, ZONES)).toBeNull();
  expect(zonesTouch(ZONES[0].polygon, ZONES[1].polygon)).toBe(true);
  expect(zonesTouch(ZONES[0].polygon, ZONES[2].polygon)).toBe(false);
  expect(zonesTouch(ZONES[0].polygon, SQ(0.505, 0.2, 0.7, 0.4)), 'a 5 mm gap on a normalized plan is still a shared wall').toBe(true);
});

test('suggestions are ranked same room, adjacent room, nearby - closest first, never a picked camera', () => {
  const s = suggestAdjacent(['a-lobby'], CAMS, ZONES);
  expect(s.map((x) => [x.id, x.relation])).toEqual([
    ['a-lobby2', 'same_zone'],
    ['a-hall', 'adjacent_zone'],
    ['a-near', 'nearby'],
  ]);
  expect(s[0].zoneName).toBe('לובי');
  expect(s[1].zoneName).toBe('מסדרון');
  expect(s[2].zoneId).toBeNull();
  expect(s.every((x) => x.from === 'a-lobby')).toBe(true);
  expect(s.find((x) => x.id === 'a-store'), 'a far room without a shared wall is not suggested').toBeUndefined();
  expect(ADJACENT_LABEL[s[0].relation]).toBe('אותו חדר');
});

test('with several picks a camera keeps its best relation and the nearby radius is the fifth of the plan', () => {
  const s = suggestAdjacent(['a-lobby', 'a-hall'], CAMS, ZONES);
  expect(s.map((x) => x.id)).toEqual(['a-lobby2', 'a-near']); // the hall is picked now; the lobby twin is "same room" through the lobby pick
  expect(s[0].from).toBe('a-lobby');
  expect(NEARBY_RADIUS).toBe(0.2);
  expect(suggestAdjacent(['a-far'], CAMS, ZONES)).toEqual([]);
  expect(suggestAdjacent([], CAMS, ZONES)).toEqual([]);
  expect(suggestAdjacent(['a-near'], CAMS, ZONES).map((x) => x.id)).toEqual(['a-lobby']); // outside every room: distance only
  expect(suggestAdjacent(['a-near'], CAMS, ZONES, 0.05)).toEqual([]);
});

test('picks= round-trips in pick order and drops unknown or repeated ids', () => {
  expect(serializePicks(['b', 'a'])).toBe('b,a');
  expect(parsePicks('b,a,zzz,a, b', new Set(['a', 'b']))).toEqual(['b', 'a']);
  expect(parsePicks('', new Set(['a']))).toEqual([]);
  expect(parsePicks(null, new Set(['a']))).toEqual([]);
});
