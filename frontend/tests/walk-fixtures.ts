// Plan Studio 6, slice S5-A: the plan the touch-walk specs share (the node unit specs and the browser spec build the same world).
// The plan of unit-walk-controller.spec.ts, trimmed to what the path finding and the touch walk need: a 10 m x 8 m floor
// (0.01 m/px on a 1000 x 800 canvas), exterior walls at 1 m from the corner, a middle wall at x = 5 m with two doors (the
// sensed one at z = 2.4 m, the unsensed one at z = 5.6 m), a passage in the east half's partition, a window in the north wall, a
// tall cabinet, a gym mat, one more level with a stair. Not a test: nothing here runs by itself.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GeometryDoc, GeomOpening, GeomWall } from '../src/map/geometry';
import type { SceneAnchor, SceneInput } from '../src/map/scene-builder';
import { buildWalkWorld, type WalkCatalogLookup, type WalkWorld } from '../src/map/walk-world';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
export const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'fixtures', 'plan_geometry', 'sample-v2.json'), 'utf8')) as GeometryDoc;
const catalogFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json'), 'utf8')) as { items: { id: string; role: string; walkable?: boolean }[] };
const items = new Map(catalogFile.items.map((i) => [i.id, i]));
export const catalog: WalkCatalogLookup = (id) => items.get(id);

export const wall = (id: string, a: [number, number], b: [number, number], extra: Partial<GeomWall> = {}): GeomWall => ({ id, level_id: 'L0', polyline: [a, b], thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, ...extra });
export const opening = (id: string, wallId: string, t: number, kind: GeomOpening['kind'], entity: string | null = null): GeomOpening => ({ id, wall_id: wallId, t, kind, width_m: 1.0, height_m: 2.1, sill_m: kind === 'window' ? 0.9 : 0, swing: kind === 'door' ? 'right' : 'none', hinge: 'start',
  anchor_ref: entity ? { resource_type: 'ha_entity', resource_id: entity } : null, confidence: 1, source: 'manual' });

export function walkDoc(over: Partial<GeometryDoc> = {}): GeometryDoc {
  return {
    ...base,
    levels: [
      { id: 'L0', name: 'קרקע', elevation_m: 0, ceiling_height_m: 2.8, is_default: true },
      { id: 'L1', name: 'עליון', elevation_m: 3, ceiling_height_m: 2.8, is_default: false },
    ],
    walls: [
      wall('w-n', [0.1, 0.1], [0.9, 0.1], { kind: 'exterior' }),
      wall('w-e', [0.9, 0.1], [0.9, 0.9], { kind: 'exterior' }),
      wall('w-s', [0.9, 0.9], [0.1, 0.9], { kind: 'exterior' }),
      wall('w-w', [0.1, 0.9], [0.1, 0.1], { kind: 'exterior' }),
      wall('w-mid', [0.5, 0.1], [0.5, 0.9]),
      wall('w-mid2', [0.5, 0.5], [0.9, 0.5]),
      wall('u-n', [0.3, 0.6], [0.9, 0.6], { level_id: 'L1' }),
      wall('u-e', [0.9, 0.6], [0.9, 0.9], { level_id: 'L1' }),
      wall('u-s', [0.9, 0.9], [0.3, 0.9], { level_id: 'L1' }),
    ],
    openings: [
      opening('d-sensed', 'w-mid', 0.25, 'door', 'binary_sensor.d1'), // z = 0.8 + 0.25 x 6.4 = 2.4 m
      opening('d-free', 'w-mid', 0.75, 'door'), // z = 5.6 m, no sensor
      opening('win', 'w-n', 0.25, 'window'), // x = 1 + 0.25 x 8 = 3 m
      opening('pass', 'w-mid2', 0.5, 'passage'), // x = 7 m
      opening('d-ext', 'w-w', 0.5, 'door'), // the west exterior wall, z = 4.8 m
    ],
    objects: [
      { id: 'cab', item_id: 'cabinet.tall', level_id: 'L0', position: [0.75, 0.3], rotation_deg: 0, size: { w_m: 1.0, d_m: 0.6, h_m: 1.8 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false },
      { id: 'mat', item_id: 'mat.gym', level_id: 'L0', position: [0.3, 0.3], rotation_deg: 0, size: { w_m: 1.0, d_m: 1.0, h_m: 1.0 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false },
    ],
    connectors: [{ id: 'st', kind: 'stairs', level_from: 'L0', level_to: 'L1', floor_ids: [], polyline: [[0.2, 0.8], [0.45, 0.8]], width_m: 1.0, label: null, object_id: null, source: 'manual' }],
    circuits: [],
    groups: [],
    labels: [],
    rooms: [],
    ...over,
  };
}

export const zones = [
  { id: 'z-west', name: 'מערב', polygon: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }, { x: 0.1, y: 0.9 }], level_id: 'L0' },
  { id: 'z-east', name: 'מזרח', polygon: [{ x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.5 }, { x: 0.5, y: 0.5 }], level_id: 'L0' },
];
export const camera: SceneAnchor = { id: 'c1', resource_type: 'camera', resource_id: 'cam1', x: 0.85, y: 0.15, rotation: 225, fov: 90, radius: null, polygon: null, level_id: 'L0', layer_id: 'cameras', label: 'מצלמה', state: null, online: true, mount_height_m: 2.6, tilt_deg: 20 };

export const walkInput = (d: GeometryDoc, states: Record<string, string | null> = { 'binary_sensor.d1': 'off' }, anchors: SceneAnchor[] = [camera]): SceneInput => ({ doc: d, width: 1000, height: 800, anchors, entityStates: states, circuitStates: {}, zones });
export const walkWorld = (d: GeometryDoc, states?: Record<string, string | null>): WalkWorld => buildWalkWorld(walkInput(d, states), catalog);
