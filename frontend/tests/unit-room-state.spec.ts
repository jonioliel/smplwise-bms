import { test, expect } from '@playwright/test';
import { demoRooms } from '../src/fixtures/demo';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { LIT_TINT_OPACITY, MARKER_T_M, PRESENCE_RING_OPACITY, PRESENCE_RING_W_M, PRESENCE_TINT_OPACITY, buildScene, insetRing, r4, type SceneZone } from '../src/map/scene-builder';
import { clampThumb, cutawayIds } from '../src/map/scene-frame';
import { OPENING_NEAR, OPENING_NEAR_M, PRESENCE_STEPS, isLightEntity, isOpeningEntity, isPresenceEntity, layerSignature, parsePresenceFade, presenceFade, presenceStepMs, roomStates, temperatureText, type RoomStateInput, type StateEntity } from '../src/map/room-state';
import { PROBE_FALLBACK_MS, PROBE_MS, SETTINGS_WAIT_MS, withTimeout } from '../src/map/timing';

// CR-006 slice 1b: the room state model is pure - the same rooms, entities, openings and instant give the same layer -
// and the scene builder turns it into parts deterministically. Node only: no DOM, no three.
const NOW = Date.parse('2026-09-28T12:00:00Z');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const ent = (id: string, x: number, y: number, extra: Partial<StateEntity> = {}): StateEntity => ({ id, domain: id.split('.')[0], device_class: null, state: null, last_changed: null, attributes: null, x, y, level_id: null, layer_id: null, ...extra });
const ROOMS = [
  { id: 'a', level_id: null, polygon: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.5 }, { x: 0.1, y: 0.5 }] },
  { id: 'b', level_id: null, polygon: [{ x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.5 }, { x: 0.5, y: 0.5 }] },
  { id: 'empty', level_id: null, polygon: [{ x: 0.1, y: 0.6 }, { x: 0.5, y: 0.6 }, { x: 0.5, y: 0.9 }, { x: 0.1, y: 0.9 }] },
];
const OPENINGS: RoomStateInput['openings'] = [
  { id: 'door-ab', kind: 'door', x: 0.5, y: 0.3, level_id: null, entity_id: 'binary_sensor.door_ab' }, // on the wall between a and b
  { id: 'door-out', kind: 'door', x: 0.3, y: 0.1, level_id: null, entity_id: null }, // on a's north wall, no bound entity
  { id: 'win-b', kind: 'window', x: 0.9, y: 0.3, level_id: null, entity_id: null },
];
const base = (over: Partial<RoomStateInput> = {}): RoomStateInput => ({ rooms: ROOMS, entities: [], openings: OPENINGS, size: [1000, 1000], now: NOW, fade: 3, ...over });

test('lit: a light on, a switch on the lights layer, or a lamp object of the room; off, unknown and a switch elsewhere do not light it', () => {
  const on = roomStates(base({ entities: [ent('light.a', 0.3, 0.3, { state: 'on' })] }));
  expect(on.rooms.a.lit).toBe(true);
  expect(on.rooms.b.lit).toBe(false);
  expect(on.levels[''].lit).toBe(true);
  expect(roomStates(base({ entities: [ent('light.a', 0.3, 0.3, { state: 'off' })] })).rooms.a.lit).toBe(false);
  expect(roomStates(base({ entities: [ent('light.a', 0.3, 0.3, { state: null })] })).rooms.a.lit).toBe(false);
  expect(roomStates(base({ entities: [ent('switch.a', 0.3, 0.3, { state: 'on', layer_id: 'lights' })] })).rooms.a.lit).toBe(true);
  expect(roomStates(base({ entities: [ent('switch.a', 0.3, 0.3, { state: 'on', layer_id: 'sensors' })] })).rooms.a.lit).toBe(false);
  expect(roomStates(base({ lamps: [{ x: 0.7, y: 0.3, level_id: null, on: true }] })).rooms.b.lit).toBe(true);
  expect(roomStates(base({ lamps: [{ x: 0.7, y: 0.3, level_id: null, on: false }] })).rooms.b.lit).toBe(false);
  expect(isLightEntity({ domain: 'light', layer_id: null })).toBe(true);
  expect(isLightEntity({ domain: 'switch', layer_id: 'lights' })).toBe(true);
  expect(isLightEntity({ domain: 'switch', layer_id: 'doors' })).toBe(false);
});

test('presence: 1 while on; after the motion the fade steps down over the window and reaches 0 at its end; off = no fade; unknown = nothing', () => {
  expect(presenceFade('on', null, NOW, 3)).toBe(1);
  expect(presenceFade('on', iso(10 * 60_000), NOW, 'off')).toBe(1);
  expect(presenceFade('off', iso(0), NOW, 3)).toBe(1); // the first step after the motion: the full tint
  expect(presenceFade('off', iso(90_000), NOW, 3)).toBe(0.5); // half the window
  expect(presenceFade('off', iso(179_000), NOW, 3)).toBe(1 / PRESENCE_STEPS); // the last step
  expect(presenceFade('off', iso(180_000), NOW, 3)).toBe(0); // the window's end
  expect(presenceFade('off', iso(10 * 60_000), NOW, 3)).toBe(0);
  expect(presenceFade('off', iso(30_000), NOW, 'off')).toBe(0);
  expect(presenceFade('off', null, NOW, 3)).toBe(0);
  expect(presenceFade(null, iso(30_000), NOW, 3)).toBe(0);
  expect(presenceFade('unavailable', iso(30_000), NOW, 3)).toBe(0);
  expect(presenceFade('off', iso(-60_000), NOW, 3)).toBe(1); // a clock ahead of ours: counts as now
  // quantised: every instant inside one step gives the same value (the scene is rebuilt per step, not per render)
  expect(presenceFade('off', iso(1_000), NOW, 3)).toBe(presenceFade('off', iso(14_000), NOW, 3));
  expect(presenceStepMs(3)).toBe(15_000);
  expect(presenceStepMs('off')).toBe(0);
  // in the model: presence, the age and the fade of the room's sensor; a second sensor still on keeps the room present
  const layer = roomStates(base({ entities: [ent('binary_sensor.motion_a', 0.2, 0.2, { device_class: 'motion', state: 'off', last_changed: iso(60_000) })] }));
  expect(layer.rooms.a).toMatchObject({ presence: false, presenceAge: 60, presenceFade: 2 / 3 });
  expect(layer.levels['']).toMatchObject({ presence: 2 / 3, open: false, lit: false });
  const on = roomStates(base({ entities: [ent('binary_sensor.motion_a', 0.2, 0.2, { device_class: 'motion', state: 'off', last_changed: iso(60_000) }), ent('binary_sensor.motion_a2', 0.4, 0.4, { device_class: 'occupancy', state: 'on' })] }));
  expect(on.rooms.a).toMatchObject({ presence: true, presenceAge: null, presenceFade: 1 });
  expect(isPresenceEntity({ domain: 'binary_sensor', device_class: null, id: 'binary_sensor.hall_motion' })).toBe(true);
  expect(isPresenceEntity({ domain: 'binary_sensor', device_class: 'door', id: 'binary_sensor.motion_door' })).toBe(false);
  expect(isPresenceEntity({ domain: 'sensor', device_class: 'motion', id: 'sensor.x' })).toBe(false);
});

test('openings: a bound sensor opens its opening; an unbound one claims the nearest opening within reach; a lock reports open; the room lists the openings on its boundary', () => {
  const bound = roomStates(base({ entities: [ent('binary_sensor.door_ab', 0.02, 0.98, { device_class: 'door', state: 'on' })] })); // far from the door: the binding wins
  expect(bound.openOpenings).toEqual(['door-ab']);
  expect(bound.rooms.a.openings).toEqual(['door-ab']); // the door sits on both rooms' boundary
  expect(bound.rooms.b.openings).toEqual(['door-ab']);
  expect(bound.rooms.empty.openings).toEqual([]);
  expect(bound.levels[''].open).toBe(true);
  const near = roomStates(base({ entities: [ent('binary_sensor.north', 0.3, 0.1 + OPENING_NEAR / 2, { device_class: 'opening', state: 'on' })] }));
  expect(near.openOpenings).toEqual(['door-out']);
  const far = roomStates(base({ entities: [ent('binary_sensor.north', 0.3, 0.1 + OPENING_NEAR * 2, { device_class: 'opening', state: 'on' })] }));
  expect(far.openOpenings).toEqual([]);
  expect(roomStates(base({ entities: [ent('lock.b', 0.9, 0.3, { state: 'open' })] })).openOpenings).toEqual(['win-b']);
  expect(roomStates(base({ entities: [ent('lock.b', 0.9, 0.3, { state: 'unlocked' })] })).openOpenings).toEqual([]); // unlocked is not open (coverage.ts OPEN_STATES)
  expect(roomStates(base({ entities: [ent('binary_sensor.door_ab', 0.3, 0.3, { device_class: 'door', state: 'off' })] })).openOpenings).toEqual([]);
  expect(isOpeningEntity({ domain: 'binary_sensor', device_class: null, id: 'binary_sensor.front_door' })).toBe(true);
  expect(isOpeningEntity({ domain: 'cover', device_class: 'garage_door', id: 'cover.g' })).toBe(true);
  expect(isOpeningEntity({ domain: 'cover', device_class: 'shade', id: 'cover.s' })).toBe(false);
  // a level mismatch never claims: the sensor on another level sees no opening
  expect(roomStates(base({ entities: [ent('binary_sensor.north', 0.3, 0.105, { device_class: 'opening', state: 'on', level_id: 'L1' })] })).openOpenings).toEqual([]);
});

test('an unbound window sensor next to a neighbouring door with its own closed sensor never opens the door; the reach is 0.75 m once calibrated', () => {
  // a door at (0.5, 0.3) with a bound sensor reporting closed, a window at (0.5, 0.318) without one; the window's sensor
  // sits 0.005 from the door and 0.013 from its window
  const openings: RoomStateInput['openings'] = [
    { id: 'door', kind: 'door', x: 0.5, y: 0.3, level_id: null, entity_id: 'binary_sensor.door' },
    { id: 'window', kind: 'window', x: 0.5, y: 0.318, level_id: null, entity_id: null },
  ];
  const sensors = [ent('binary_sensor.door', 0.5, 0.3, { device_class: 'door', state: 'off' }), ent('binary_sensor.win', 0.5, 0.305, { device_class: 'window', state: 'on' })];
  // uncalibrated: 2 % of the width reaches the window (0.013) - the door, bound to its own sensor, is never claimed
  expect(roomStates(base({ openings, entities: sensors, size: [1000, 1000] })).openOpenings).toEqual(['window']);
  // calibrated at 1 cm / px on a 1,000 px plan (10 m wide): 0.75 m = 0.075 of the width reaches the window too
  expect(roomStates(base({ openings, entities: sensors, size: [1000, 1000], scaleMPerPx: 0.01 })).openOpenings).toEqual(['window']);
  // calibrated at 10 cm / px (a 100 m site plan): 0.75 m is 0.0075 of the width - the window 1.3 m away is out of reach
  expect(roomStates(base({ openings, entities: sensors, size: [1000, 1000], scaleMPerPx: 0.1 })).openOpenings).toEqual([]);
  expect(OPENING_NEAR_M / (0.1 * 1000)).toBeLessThan(OPENING_NEAR);
  // the door's own sensor still opens it
  expect(roomStates(base({ openings, entities: [ent('binary_sensor.door', 0.9, 0.9, { device_class: 'door', state: 'on' })] })).openOpenings).toEqual(['door']);
});

test('the layer signature carries every drawn value and never the presence age', () => {
  const at = (msAgo: number) => roomStates(base({ entities: [ent('binary_sensor.motion_a', 0.2, 0.2, { device_class: 'motion', state: 'off', last_changed: iso(msAgo) })] }));
  expect(at(1_000).rooms.a.presenceAge).not.toBe(at(5_000).rooms.a.presenceAge);
  expect(layerSignature(at(1_000))).toBe(layerSignature(at(5_000))); // the same fade step
  expect(layerSignature(at(1_000))).not.toBe(layerSignature(at(40_000))); // another step
  expect(layerSignature(at(1_000))).not.toBe(layerSignature(roomStates(base({ entities: [ent('light.a', 0.3, 0.3, { state: 'on' })] }))));
  expect(layerSignature(null)).toBe('');
});

test('temperature: the climate current_temperature wins over a temperature sensor, the lowest id among equals; lock and alarm states are carried', () => {
  const both = roomStates(base({ entities: [ent('sensor.t_a', 0.2, 0.2, { device_class: 'temperature', state: '19.4' }), ent('climate.a', 0.3, 0.3, { state: 'heat', attributes: { current_temperature: 21.54 } })] }));
  expect(both.rooms.a).toMatchObject({ temperature: 21.5, temperatureSource: 'climate.a' });
  const sensors = roomStates(base({ entities: [ent('sensor.t_b', 0.2, 0.2, { device_class: 'temperature', state: '19.4' }), ent('sensor.t_a', 0.3, 0.3, { device_class: 'temperature', state: '18' })] }));
  expect(sensors.rooms.a).toMatchObject({ temperature: 18, temperatureSource: 'sensor.t_a' });
  expect(roomStates(base({ entities: [ent('sensor.t_a', 0.2, 0.2, { device_class: 'temperature', state: 'unknown' })] })).rooms.a.temperature).toBeNull();
  expect(roomStates(base({ entities: [ent('sensor.h', 0.2, 0.2, { device_class: 'humidity', state: '55' })] })).rooms.a.temperature).toBeNull();
  const misc = roomStates(base({ entities: [ent('lock.a', 0.2, 0.2, { state: 'locked' }), ent('alarm_control_panel.a', 0.3, 0.3, { state: 'armed_away' })] }));
  expect(misc.rooms.a).toMatchObject({ lock: 'locked', alarm: 'armed_away' });
  expect(temperatureText(21.54)).toBe('21.5°');
  expect(temperatureText(22)).toBe('22°');
  expect(temperatureText(-3.04)).toBe('-3°');
});

test('an entity in no room counts for its level only; a room with no entities is quiet; a level id folds through levelOf', () => {
  const layer = roomStates(base({ entities: [ent('binary_sensor.corridor', 0.95, 0.95, { device_class: 'motion', state: 'on' }), ent('light.nowhere', 0.05, 0.95, { state: 'on' })] }));
  expect(layer.rooms.a).toMatchObject({ lit: false, presence: false, presenceAge: null, presenceFade: 0, openings: [], temperature: null, lock: null, alarm: null });
  expect(layer.rooms.empty.lit).toBe(false);
  expect(layer.levels['']).toMatchObject({ presence: 1, lit: false, open: false });
  const folded = roomStates(base({ rooms: [{ ...ROOMS[0], level_id: 'L0' }], entities: [ent('light.a', 0.3, 0.3, { state: 'on', level_id: null })], levelOf: (id) => id ?? 'L0' }));
  expect(folded.rooms.a.lit).toBe(true);
  expect(Object.keys(folded.levels)).toEqual(['L0']);
  expect(parsePresenceFade('off')).toBe('off');
  expect(parsePresenceFade('10')).toBe(10);
  expect(parsePresenceFade(undefined)).toBe(3);
  expect(parsePresenceFade('0')).toBe(3);
});

test('deterministic: the same input twice is the same layer; the order of entities and rooms does not matter', () => {
  const entities = [ent('light.a', 0.3, 0.3, { state: 'on' }), ent('binary_sensor.motion_b', 0.7, 0.3, { device_class: 'motion', state: 'off', last_changed: iso(20_000) }), ent('binary_sensor.door_ab', 0.5, 0.31, { device_class: 'door', state: 'on' })];
  const a = roomStates(base({ entities }));
  const b = roomStates(base({ entities: [...entities].reverse(), rooms: [...ROOMS].reverse() }));
  expect(JSON.stringify(a)).toBe(JSON.stringify(roomStates(base({ entities }))));
  expect(a).toEqual(b);
});

test('the scene builder: a lit room adds its warm prism, presence its blue prism weighted by the fade, an open door its red frame, a temperature its chip - none without the layer; the description is the same twice', () => {
  const input = demoSceneInput('f0')!;
  const rooms = demoRooms('f0');
  const zones: SceneZone[] = rooms.map((r, i) => ({ id: `z${i}`, name: `חדר ${i}`, polygon: [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }], level_id: 'L0' }));
  const layer = roomStates({
    rooms: zones.map((z) => ({ id: z.id, polygon: z.polygon, level_id: 'L0' })),
    entities: [
      ent('light.z0', rooms[0].x + rooms[0].w / 2, rooms[0].y + rooms[0].h / 2, { state: 'on', level_id: 'L0' }),
      ent('sensor.t0', rooms[0].x + rooms[0].w / 3, rooms[0].y + rooms[0].h / 3, { device_class: 'temperature', state: '21.5', level_id: 'L0' }),
      ent('binary_sensor.m1', rooms[1].x + rooms[1].w / 2, rooms[1].y + rooms[1].h / 2, { device_class: 'motion', state: 'off', last_changed: iso(90_000), level_id: 'L0' }),
      ent('binary_sensor.d0', 0, 0, { device_class: 'door', state: 'on', level_id: 'L0' }),
    ],
    openings: [{ id: 'do0', kind: 'door', x: 0, y: 0, level_id: 'L0', entity_id: 'binary_sensor.d0' }],
    size: [input.width, input.height],
    now: NOW,
    fade: 3,
  });
  expect(layer.rooms.z0.lit).toBe(true);
  expect(layer.rooms.z1.presenceFade).toBe(0.5);
  // the inset ring: a keyhole polygon of the outline and its inset, one band wide
  const ring = insetRing([[0, 0], [4, 0], [4, 3], [0, 3]], 0.5);
  expect(ring).toEqual([[0, 0], [4, 0], [4, 3], [0, 3], [0, 0], [0.5, 0.5], [0.5, 2.5], [3.5, 2.5], [3.5, 0.5], [0.5, 0.5]]);
  expect(insetRing([[0, 0], [4, 0], [4, 3], [0, 3]].reverse() as [number, number][], 0.5).map((p) => p.join())).toContain('3.5,2.5'); // the other winding insets inward too
  expect(insetRing([[0, 0], [1, 1]], 0.5)).toEqual([]);
  // slice 1c: the band is ~0.3 m, and a room narrower than twice the band anywhere gets no ring - a corridor 0.5 m
  // wide, an L whose arm is 0.4 m wide (the wide part alone would take the band), a room exactly 2 w wide (the inset
  // edge has no length); the same L with a 1 m arm keeps its ring
  expect(PRESENCE_RING_W_M).toBe(0.3);
  expect(insetRing([[0, 0], [6, 0], [6, 0.5], [0, 0.5]], PRESENCE_RING_W_M)).toEqual([]);
  const narrowArm: [number, number][] = [[0, 0], [4, 0], [4, 4], [3.6, 4], [3.6, 1], [0, 1]];
  expect(insetRing(narrowArm, PRESENCE_RING_W_M)).toEqual([]);
  expect(insetRing([[0, 0], [4, 0], [4, 0.6], [0, 0.6]], PRESENCE_RING_W_M)).toEqual([]);
  const wideArm: [number, number][] = [[0, 0], [4, 0], [4, 4], [3, 4], [3, 1], [0, 1]];
  expect(insetRing(wideArm, PRESENCE_RING_W_M).length).toBe(wideArm.length * 2 + 2);
  expect(layer.openOpenings).toEqual(['do0']);
  const plain = buildScene({ ...input, zones });
  const withStates = buildScene({ ...input, zones, roomStates: layer });
  const part = (id: string) => withStates.parts.find((p) => p.id === id);
  expect(part('room:z0#lit')).toMatchObject({ kind: 'tint', shape: 'prism', color: 'map-lit', opacity: LIT_TINT_OPACITY, level_id: 'L0', userData: { id: 'z0', kind: 'zone' } });
  expect(part('room:z0#lit')!.polygon).toEqual(part('room:z0')!.polygon);
  expect(part('room:z1#lit')).toBeUndefined();
  expect(part('room:z1#presence')).toMatchObject({ kind: 'tint', color: 'map-presence', opacity: PRESENCE_TINT_OPACITY * 0.5 }); // not lit: the full plate
  expect(part('room:z1#presence-ring')).toMatchObject({ kind: 'tint', color: 'map-presence', opacity: PRESENCE_RING_OPACITY * 0.5 });
  expect(part('room:z1#presence-ring')!.polygon).toEqual(insetRing(part('room:z1')!.polygon!, PRESENCE_RING_W_M).map(([x, z]) => [r4(x), r4(z)])); // the builder's 0.1 mm rounding
  expect(part('room:z0#presence')).toBeUndefined();
  expect(part('room:z0#temp')).toMatchObject({ kind: 'chip', shape: 'sprite', text: '21.5°', color: 'map-temp' });
  // a lit room with presence: the warm plate and the ring, never the blue plate
  const both = buildScene({ ...input, zones, roomStates: { ...layer, rooms: { ...layer.rooms, z1: { ...layer.rooms.z1, lit: true } } } });
  expect(both.parts.some((p) => p.id === 'room:z1#lit')).toBe(true);
  expect(both.parts.some((p) => p.id === 'room:z1#presence-ring')).toBe(true);
  expect(both.parts.some((p) => p.id === 'room:z1#presence')).toBe(false);
  expect(part('room:z1#temp')).toBeUndefined();
  const frame = withStates.parts.filter((p) => p.id.startsWith('open:do0#'));
  expect(frame.map((p) => p.id)).toEqual(['open:do0#head', 'open:do0#j0', 'open:do0#j1']); // a door: no sill bar
  expect(frame.every((p) => p.kind === 'marker' && p.color === 'danger' && p.group === 'box|danger|1' && p.userData.id === 'do0')).toBe(true);
  expect(part('open:do0#j0')!.size[0]).toBe(MARKER_T_M);
  expect(part('open:do0#j0')!.size[1]).toBe(2.1); // the door's height
  expect(part('open:do0#head')!.rotation).toEqual(part('lintel:do0')!.rotation); // the frame follows the wall's yaw
  expect(withStates.parts.some((p) => p.id.startsWith('open:do1#'))).toBe(false);
  // without the layer: not one state part; with it: the structure is untouched (the same parts plus the state parts)
  expect(plain.parts.some((p) => p.kind === 'tint' || p.kind === 'marker' || p.id.endsWith('#temp'))).toBe(false);
  const stateIds = new Set(withStates.parts.filter((p) => p.kind === 'tint' || p.kind === 'marker' || p.id.endsWith('#temp')).map((p) => p.id));
  expect(withStates.parts.filter((p) => !stateIds.has(p.id))).toEqual(plain.parts);
  expect(JSON.stringify(buildScene({ ...input, zones, roomStates: layer }))).toBe(JSON.stringify(withStates));
  // the markers follow a cut wall like the door leaf (scene-frame OPENING_KINDS)
  for (const az of [45, 135, 225, 315]) {
    const cut = cutawayIds(withStates, az);
    expect(cut.some((id) => id.startsWith('open:do0#')), `azimuth ${az}`).toBe(cut.includes('door:do0'));
  }
});

test('the carried 1a nits: the thumbnail size clamps to the canvas, the fallback timer is the window plus 1.5 s, the settings wait resolves to its fallback in time', async () => {
  expect(clampThumb(160, 100, 1200, 800)).toEqual({ w: 160, h: 100 });
  expect(clampThumb(160, 100, 120.7, 800)).toEqual({ w: 120, h: 100 });
  expect(clampThumb(160, 100, 1200, 60)).toEqual({ w: 160, h: 60 });
  expect(clampThumb(160, 100, 0, 0)).toEqual({ w: 0, h: 0 });
  expect(PROBE_FALLBACK_MS).toBe(PROBE_MS + 1500);
  expect(SETTINGS_WAIT_MS).toBe(3000);
  const t0 = Date.now();
  expect(await withTimeout(new Promise<number>(() => undefined), 40, 7)).toBe(7);
  expect(Date.now() - t0).toBeLessThan(1000);
  expect(await withTimeout(Promise.resolve(3), 40, 7)).toBe(3);
  expect(await withTimeout(Promise.reject(new Error('x')), 40, 7)).toBe(7);
});
