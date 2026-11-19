import { test } from '@playwright/test';
import { roomStates, type RoomStateInput, type StateEntity, type StateOpening } from '../src/map/room-state';
import { expectRecorded } from './cx-record';

// CR-FE-COMPLEXITY-2450: characterisation of roomStates (map/room-state.ts) before its split. One floor of rooms, sensors, openings and
// lamps on two levels goes through several instants, fades, plan sizes, calibrations and level foldings; the answers must equal the
// record taken from the unsplit function (tests/fixtures/cx/room-states.json). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-cx-room-states-2450.spec.ts --workers=1

const T0 = Date.parse('2026-11-19T10:00:00Z');
const ago = (s: number) => new Date(T0 - s * 1000).toISOString();
const sq = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const e = (id: string, x: number, y: number, o: Partial<StateEntity> = {}): StateEntity => {
  const domain = id.split('.')[0];
  return { id, domain, device_class: null, state: 'off', last_changed: null, x, y, level_id: 'L0', ...o };
};
const op = (id: string, x: number, y: number, o: Partial<StateOpening> = {}): StateOpening => ({ id, kind: 'door', x, y, level_id: 'L0', entity_id: null, ...o });

const ROOMS: RoomStateInput['rooms'] = [
  { id: 'r-salon', polygon: sq(0.1, 0.1, 0.5, 0.5), level_id: 'L0' },
  { id: 'r-kitchen', polygon: sq(0.5, 0.1, 0.9, 0.5), level_id: null },
  { id: 'r-bed', polygon: sq(0.1, 0.1, 0.5, 0.5), level_id: 'L1' },
  { id: 'r-line', polygon: [{ x: 0, y: 0 }, { x: 1, y: 1 }], level_id: 'L0' },
  { id: 'a-hall', polygon: sq(0.1, 0.5, 0.9, 0.9), level_id: 'L0' },
];
const ENTITIES: StateEntity[] = [
  e('binary_sensor.salon_motion', 0.2, 0.2, { device_class: 'motion', state: 'on' }),
  e('binary_sensor.salon_occupancy', 0.3, 0.2, { device_class: 'occupancy', state: 'off', last_changed: ago(90) }),
  e('binary_sensor.kitchen_presence', 0.6, 0.2, { state: 'off', last_changed: ago(30), level_id: null }),
  e('binary_sensor.kitchen_pir', 0.7, 0.2, { device_class: 'presence', state: 'off', last_changed: ago(1200), level_id: null }),
  e('binary_sensor.bed_motion', 0.2, 0.2, { device_class: 'motion', state: 'off', last_changed: 'not a date', level_id: 'L1' }),
  e('binary_sensor.bed_motion2', 0.25, 0.25, { device_class: 'motion', state: 'off', last_changed: new Date(T0 + 60_000).toISOString(), level_id: 'L1' }),
  e('binary_sensor.stray_motion', 0.95, 0.95, { device_class: 'motion', state: 'off', last_changed: ago(10) }),
  e('binary_sensor.unknown_motion', 0.3, 0.3, { device_class: 'motion', state: null }),
  e('light.salon', 0.4, 0.4, { state: 'on' }), e('switch.kitchen_lamp', 0.6, 0.3, { state: 'on', layer_id: 'lights', level_id: null }),
  e('switch.pump', 0.2, 0.6, { state: 'on' }),
  e('climate.salon', 0.2, 0.3, { state: 'cool', attributes: { current_temperature: 23.456 } }),
  e('climate.bad', 0.21, 0.31, { state: 'cool', attributes: { current_temperature: 'x' } }),
  e('sensor.kitchen_temp', 0.6, 0.4, { device_class: 'temperature', state: '21.04', level_id: null }),
  e('sensor.kitchen_temp2', 0.61, 0.41, { device_class: 'temperature', state: 'unavailable', level_id: null }),
  e('sensor.hall_temp', 0.3, 0.7, { device_class: 'temperature', state: '19' }),
  e('lock.front', 0.3, 0.8, { state: 'locked' }), e('lock.null', 0.31, 0.81, { state: null }),
  e('alarm_control_panel.home', 0.4, 0.8, { state: 'armed_away' }),
  e('binary_sensor.front_door', 0.5, 0.3, { device_class: 'door', state: 'on' }),
  e('binary_sensor.window_contact', 0.15, 0.5, { state: 'on' }),
  e('binary_sensor.window_far', 0.95, 0.05, { device_class: 'window', state: 'on' }),
  e('cover.garage', 0.88, 0.5, { device_class: 'garage', state: 'open' }), e('cover.blind', 0.85, 0.45, { state: 'open' }),
  e('lock.side', 0.5, 0.71, { state: 'open' }),
  e('binary_sensor.bed_door', 0.5, 0.2, { device_class: 'door', state: 'on', level_id: 'L1' }),
];
const OPENINGS: StateOpening[] = [
  op('o-front', 0.5, 0.3, { entity_id: 'binary_sensor.front_door' }), op('o-near', 0.5, 0.31), op('o-win', 0.15, 0.5, { kind: 'window' }),
  op('o-tie-b', 0.88, 0.52), op('o-tie-a', 0.88, 0.48), op('o-side', 0.5, 0.7, { entity_id: 'lock.side' }),
  op('o-closed', 0.52, 0.71, { entity_id: 'binary_sensor.closed' }), op('o-bed', 0.5, 0.2, { level_id: 'L1' }), op('o-dup', 0.9, 0.9, { entity_id: 'binary_sensor.front_door' }),
];
const LAMPS: RoomStateInput['lamps'] = [{ x: 0.2, y: 0.8, level_id: 'L0', on: true }, { x: 0.2, y: 0.2, level_id: 'L1', on: false }, { x: 0.3, y: 0.3, level_id: null, on: true }];

const VARIANTS: Array<[string, Partial<RoomStateInput>]> = [
  ['base', {}], ['fade-off', { fade: 'off' }], ['fade-1', { fade: 1 }], ['fade-0', { fade: 0 }], ['later', { now: T0 + 20 * 60_000 }],
  ['tall', { size: [800, 1600] }], ['no-size', { size: [0, 0] }], ['calibrated', { scaleMPerPx: 0.01 }], ['calibrated-small', { scaleMPerPx: 0.001, size: [500, 500] }],
  ['fold', { levelOf: (id) => id ?? 'L0' }], ['no-lamps', { lamps: undefined }], ['no-entities', { entities: [] }], ['no-openings', { openings: [] }],
  ['reversed', { rooms: [...ROOMS].reverse(), entities: [...ENTITIES].reverse(), openings: [...OPENINGS].reverse() }],
];

test('roomStates: every answer equals the record of the unsplit function', () => {
  const base: RoomStateInput = { rooms: ROOMS, entities: ENTITIES, openings: OPENINGS, lamps: LAMPS, size: [1000, 800], now: T0, fade: 10 };
  expectRecorded('room-states', VARIANTS.map(([v, o]) => ({ v, layer: roomStates({ ...base, ...o }) })));
});
