import { test, expect } from '@playwright/test';
import { planChangeKey } from '../src/map/plan-change-key';
import type { RoomState, RoomStateLayer } from '../src/map/room-state';

// Plan Studio 6, slice S5-B (CR-029 section 3.4, docs/changes/CR-029-ST7-S5B-NOTES.md) in node: the signature a kiosk wakes on.
// What a wall display visibly changes for counts (lit, presence, open openings, circuits, cameras, lock / alarm); what drifts
// without anything happening does not (the presence tint's fade and age, the temperatures); order never matters.

const room = (id: string, over: Partial<RoomState> = {}): RoomState => ({
  id, level_id: 'L0', lit: false, presence: false, presenceAge: null, presenceFade: 0, openings: [], temperature: null, temperatureSource: null, lock: null, alarm: null, ...over,
});
const layer = (rooms: RoomState[], openOpenings: string[] = []): RoomStateLayer => ({ rooms: Object.fromEntries(rooms.map((r) => [r.id, r])), openOpenings, levels: {} });
const key = (l: RoomStateLayer | null, circuits: Record<string, string | null> = {}, cameras: Record<string, string> = {}) => planChangeKey({ layer: l, circuits, cameras });

test('the same facts in any order give the same key', () => {
  const a = key(layer([room('b', { lit: true }), room('a', { presence: true })], ['o2', 'o1']), { c2: 'on', c1: 'off' }, { k2: 'online', k1: 'offline' });
  const b = key(layer([room('a', { presence: true }), room('b', { lit: true })], ['o1', 'o2']), { c1: 'off', c2: 'on' }, { k1: 'offline', k2: 'online' });
  expect(a).toBe(b);
  expect(key(null)).toBe(key(layer([])));
});

test('what a wall visibly changes for changes the key', () => {
  const base = key(layer([room('a'), room('b')]), { c1: 'off' }, { k1: 'online' });
  expect(key(layer([room('a', { lit: true }), room('b')]), { c1: 'off' }, { k1: 'online' })).not.toBe(base); // a room lit
  expect(key(layer([room('a', { presence: true }), room('b')]), { c1: 'off' }, { k1: 'online' })).not.toBe(base); // someone entered
  expect(key(layer([room('a'), room('b')], ['o1']), { c1: 'off' }, { k1: 'online' })).not.toBe(base); // a door opened
  expect(key(layer([room('a'), room('b')]), { c1: 'on' }, { k1: 'online' })).not.toBe(base); // a circuit switched
  expect(key(layer([room('a'), room('b')]), { c1: null }, { k1: 'online' })).not.toBe(base); // a switch went stale: unknown is a change
  expect(key(layer([room('a'), room('b')]), { c1: 'off' }, { k1: 'offline' })).not.toBe(base); // a camera dropped
  expect(key(layer([room('a', { lock: 'unlocked' }), room('b')]), { c1: 'off' }, { k1: 'online' })).not.toBe(base); // a lock
  expect(key(layer([room('a', { alarm: 'triggered' }), room('b')]), { c1: 'off' }, { k1: 'online' })).not.toBe(base); // the alarm
});

test('what only drifts does not: the presence fade steps, the age, the temperatures', () => {
  const a = key(layer([room('a', { presence: true, presenceFade: 1, presenceAge: null, temperature: 21.5 })]), {}, {});
  const b = key(layer([room('a', { presence: true, presenceFade: 1, presenceAge: null, temperature: 23 })]), {}, {});
  expect(a).toBe(b); // a temperature moved
  const fading1 = key(layer([room('a', { presence: false, presenceFade: 0.75, presenceAge: 40 })]));
  const fading2 = key(layer([room('a', { presence: false, presenceFade: 0.5, presenceAge: 100 })]));
  const gone = key(layer([room('a', { presence: false, presenceFade: 0, presenceAge: 900 })]));
  expect(fading1).toBe(fading2);
  expect(fading2).toBe(gone); // the tint fading out is not a device change: the sensor already went off
});
