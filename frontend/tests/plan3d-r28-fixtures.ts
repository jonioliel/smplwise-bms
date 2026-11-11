// PLAN3D-R28-UI-2433: the floor the round 28 room pill / spread specs share (the node unit spec and the pixel spec build the same
// scene): the touch walk's two-level plan (walk-fixtures.ts) with its two rooms, a light, a presence sensor and a thermometer in the
// west room, a door sensor on the middle wall. Not a test: nothing here runs by itself.
import { buildScene, type SceneAnchor, type SceneDescription } from '../src/map/scene-builder';
import { summarizeRooms, type PillAnchor, type RoomSummary } from '../src/map/room-pills';
import type { RoomStateLayer } from '../src/map/room-state';
import { camera, walkDoc, walkInput, zones } from './walk-fixtures';

const ent = (id: string, resource: string, label: string, x: number, y: number, layer: string, state: string): SceneAnchor => ({
  id, resource_type: 'ha_entity', resource_id: resource, x, y, rotation: 0, fov: null, radius: null, polygon: null, level_id: 'L0', layer_id: layer, label, state, online: null, mount_height_m: null, tilt_deg: null,
});
export const R28_ANCHORS: SceneAnchor[] = [
  camera,
  ent('a-light', 'light.west', 'תאורת תקרה', 0.25, 0.3, 'lights', 'on'),
  ent('a-motion', 'binary_sensor.west_motion', 'תנועה', 0.3, 0.6, 'sensors', 'on'),
  ent('a-temp', 'sensor.west_temp', 'טמפרטורה', 0.2, 0.7, 'sensors', '24.2'),
  ent('a-door', 'binary_sensor.d1', 'דלת סלון', 0.49, 0.3, 'doors', 'on'),
];
const words: Record<string, string> = { 'light.west': 'דולק', 'binary_sensor.west_motion': 'תנועה', 'sensor.west_temp': '24.2°', 'binary_sensor.d1': 'פתוחה' };
const meta: Record<string, { domain: string; device_class: string | null }> = {
  'light.west': { domain: 'light', device_class: null },
  'binary_sensor.west_motion': { domain: 'binary_sensor', device_class: 'motion' },
  'sensor.west_temp': { domain: 'sensor', device_class: 'temperature' },
  'binary_sensor.d1': { domain: 'binary_sensor', device_class: 'door' },
};
export const R28_PILL_ANCHORS: PillAnchor[] = R28_ANCHORS.filter((a) => a.resource_type === 'ha_entity').map((a) => ({
  id: a.id, resource_id: a.resource_id, ...meta[a.resource_id], layer_id: a.layer_id, label: a.label, state: a.state, words: words[a.resource_id] ?? '', x: a.x, y: a.y, level_id: a.level_id,
}));
export const R28_LAYER: RoomStateLayer = {
  rooms: {
    'z-west': { id: 'z-west', level_id: 'L0', lit: true, presence: true, presenceAge: null, presenceFade: 1, openings: ['d-sensed'], temperature: 24.2, temperatureSource: 'sensor.west_temp', lock: null, alarm: null },
    'z-east': { id: 'z-east', level_id: 'L0', lit: false, presence: false, presenceAge: 2400, presenceFade: 0, openings: ['d-sensed'], temperature: null, temperatureSource: null, lock: null, alarm: null },
  },
  openOpenings: ['d-sensed'],
  levels: { L0: { presence: 1, open: true, lit: true } },
};
export const r28Rooms = (): RoomSummary[] => summarizeRooms(zones, R28_PILL_ANCHORS, R28_LAYER);
export const r28Desc = (level: string | null = null): SceneDescription =>
  buildScene({ ...walkInput(walkDoc(), Object.fromEntries(R28_ANCHORS.filter((a) => a.resource_type === 'ha_entity').map((a) => [a.resource_id, a.state])), R28_ANCHORS), level, roomStates: R28_LAYER });
