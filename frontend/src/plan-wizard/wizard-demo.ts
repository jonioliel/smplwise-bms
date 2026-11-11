/**
 * PLAN3D-R28-WIZARD-2433: the wizard's demo data (no backend): the round 28 mockup's sample house - a 1000 x 900 px sheet at
 * 1.2 cm per pixel, nine walls, nineteen openings, eight closed rooms - as the detector would return it, with the mockup's
 * confidences (map3d/app/arx.js CONF), and the devices of the demo floor. Demo mode only; never sent anywhere.
 */
import type { DetectResult } from '../api/geometry';
import type { GeometryDoc, GeomOpening, GeomWall, OpeningKind, Pt, Swing, WallKind } from '../map/geometry';
import type { PlaceEntity } from './wizard-model';

export const DEMO_W = 1000;
export const DEMO_H = 900;
export const DEMO_SCALE = 0.012;

const n = (p: [number, number]): Pt => [Math.round((p[0] / DEMO_W) * 1e5) / 1e5, Math.round((p[1] / DEMO_H) * 1e5) / 1e5];

const WALLS: [string, WallKind, number, [number, number][]][] = [
  ['g-out', 'exterior', 0.3, [[42, 42], [958, 42], [958, 858], [42, 858], [42, 42]]],
  ['g-w1', 'interior', 0.12, [[292, 42], [292, 858]]],
  ['g-w2', 'interior', 0.12, [[42, 292], [292, 292]]],
  ['g-w3', 'railing', 0.05, [[167, 325], [167, 625]]],
  ['g-w5', 'interior', 0.12, [[292, 500], [958, 500]]],
  ['g-w6', 'interior', 0.12, [[625, 500], [625, 858]]],
  ['g-w7', 'interior', 0.12, [[42, 625], [292, 625]]],
  ['g-w8', 'interior', 0.1, [[167, 625], [167, 858]]],
];
const OPENINGS: [string, string, number, OpeningKind, number, Swing, 'start' | 'end'][] = [
  ['front', 'g-out', 0.95913, 'door', 1, 'right', 'end'], ['win-hall', 'g-out', 0.98317, 'window', 0.8, 'none', 'start'],
  ['win-liv-n1', 'g-out', 0.12019, 'window', 1.4, 'none', 'start'], ['win-liv-n2', 'g-out', 0.16827, 'window', 1.4, 'none', 'start'],
  ['win-liv-n3', 'g-out', 0.21635, 'window', 1.4, 'none', 'start'], ['win-liv-e', 'g-out', 0.32933, 'window', 2.6, 'none', 'start'],
  ['win-kit-e', 'g-out', 0.44952, 'window', 1.2, 'none', 'start'], ['win-kit-s', 'g-out', 0.54808, 'window', 1.4, 'none', 'start'],
  ['win-off-s', 'g-out', 0.64423, 'window', 1.6, 'none', 'start'], ['win-wc-w', 'g-out', 0.79567, 'window', 0.6, 'none', 'start'],
  ['d-hall-liv', 'g-w1', 0.15306, 'door', 1.6, 'double', 'start'], ['d-corr-liv', 'g-w1', 0.43878, 'door', 0.9, 'left', 'start'],
  ['d-corr-off', 'g-w1', 0.65306, 'door', 0.9, 'right', 'end'], ['p-hall-corr', 'g-w2', 0.73333, 'passage', 1.4, 'none', 'start'],
  ['d-liv-off', 'g-w5', 0.25, 'door', 0.9, 'right', 'start'], ['d-liv-kit', 'g-w5', 0.75, 'passage', 1.8, 'none', 'start'],
  ['d-off-kit', 'g-w6', 0.51163, 'door', 0.8, 'left', 'end'], ['d-wc', 'g-w7', 0.25, 'door', 0.8, 'right', 'end'],
  ['d-util', 'g-w7', 0.75, 'door', 0.8, 'left', 'start'],
];
/** The detector's confidence for the items it was unsure of (the mockup's); every other wall 0.96, door 0.92, window 0.9. */
const CONF: Record<string, number> = { 'g-w3': 0.48, 'g-w8': 0.71, 'd-liv-kit': 0.45, 'win-wc-w': 0.6, 'win-hall': 0.6, 'd-off-kit': 0.62, 'p-hall-corr': 0.45, 'win-kit-e': 0.75 };

/** The truth the demo sheet is drawn from (the sliding kitchen door is what the detector mistook for a passage). */
export function demoTruthDoc(): GeometryDoc {
  const doc = demoBaseDoc();
  const walls = WALLS.map(([id, kind, t, pts]): GeomWall => ({ id, level_id: 'L0', polyline: pts.map(n), thickness_m: t, height_m: null, base_z_m: 0, kind, confidence: 1, source: 'manual', locked: false, external_ids: {} }));
  const openings = OPENINGS.map(([id, wall, t, kind, w, swing, hinge]): GeomOpening => (id === 'd-liv-kit'
    ? { id, wall_id: wall, t, kind: 'door', width_m: w, height_m: 2.1, sill_m: 0, swing: 'sliding', hinge, anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} }
    : { id, wall_id: wall, t, kind, width_m: w, height_m: kind === 'window' ? 1.2 : 2.1, sill_m: kind === 'window' ? 0.9 : 0, swing, hinge, anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} }));
  return { ...doc, walls, openings };
}

export function demoBaseDoc(): GeometryDoc {
  return {
    schema_version: '2.0', plan_version_id: 'demo-wizard', floor_id: 'f0', source: { sha256: '', file_name: 'תוכנית-קרקע.png', mime: 'image/png', page: 1 },
    dimensions: { width_px: DEMO_W, height_px: DEMO_H, scale_m_per_px: DEMO_SCALE, calibration: { status: 'estimated', method: 'door_width', pairs: [], residual_pct: null, reason: 'לפי רוחב 9 דלתות' } },
    transform: { rotation: 0, crop: null },
    levels: [{ id: 'L0', name: 'קרקע', elevation_m: 0, ceiling_height_m: 2.8, is_default: true }],
    walls: [], openings: [], rooms: [], objects: [], circuits: [], connectors: [], labels: [], groups: [], uncertain_regions: [], uncertainty: { overall: 0, notes: [] },
    meta: { generator: 'demo', tokens_version: 'map-1', detector_version: null },
  };
}

export function demoDetect(): DetectResult {
  const truth = demoTruthDoc();
  const walls = truth.walls.map((w): GeomWall => ({ ...w, id: `auto-${w.id}`, source: 'auto', confidence: CONF[w.id] ?? 0.96, hollow: false }));
  const openings = OPENINGS.map(([id, wall, t, kind, w, swing, hinge]): GeomOpening => ({
    id: `auto-${id}`, wall_id: `auto-${wall}`, t, kind, width_m: w, height_m: kind === 'window' ? 1.2 : 2.1, sill_m: kind === 'window' ? 0.9 : 0, swing, hinge,
    anchor_ref: null, confidence: CONF[id] ?? (kind === 'window' ? 0.9 : 0.92), source: 'auto', external_ids: {},
  }));
  const pixels: DetectResult['pixels'] = {};
  for (const w of walls) pixels[w.id] = { thickness_px: w.thickness_m / DEMO_SCALE };
  for (const o of openings) pixels[o.id] = { width_px: o.width_m / DEMO_SCALE };
  return {
    walls, openings, objects: [], detector: { name: 'plan_detect', version: 'demo', params: {} },
    calibration_hint: { scale_m_per_px: DEMO_SCALE, status: 'estimated', method: 'door_width', reason: 'לפי רוחב 9 דלתות', doors: 9 },
    pixels, scale: { m_per_px: DEMO_SCALE, status: 'estimated_walls' }, stats: {}, version_id: 'demo-wizard', level_id: 'L0', existing_auto: { walls: 0, openings: 0 },
  };
}

/** The mockup's eight rooms (metres on the sheet) as the room detection returns them: normalized polygons. */
const ROOMS_M: [string, [number, number][]][] = [
  ['כניסה', [[0.5, 0.5], [3.5, 0.5], [3.5, 3.5], [0.5, 3.5]]], ['חדר מדרגות', [[0.5, 3.5], [2, 3.5], [2, 7.5], [0.5, 7.5]]],
  ['מסדרון', [[2, 3.5], [3.5, 3.5], [3.5, 7.5], [2, 7.5]]], ['סלון', [[3.5, 0.5], [11.5, 0.5], [11.5, 6], [3.5, 6]]],
  ['מטבח', [[7.5, 6], [11.5, 6], [11.5, 10.3], [7.5, 10.3]]], ['חדר עבודה', [[3.5, 6], [7.5, 6], [7.5, 10.3], [3.5, 10.3]]],
  ['', [[0.5, 7.5], [2, 7.5], [2, 10.3], [0.5, 10.3]]], ['', [[2, 7.5], [3.5, 7.5], [3.5, 10.3], [2, 10.3]]],
];
export function demoRooms(): { polygon: { x: number; y: number }[]; name: string }[] {
  return ROOMS_M.map(([name, poly]) => ({ name, polygon: poly.map(([x, y]) => ({ x: Math.round((x / DEMO_SCALE / DEMO_W) * 1e5) / 1e5, y: Math.round((y / DEMO_SCALE / DEMO_H) * 1e5) / 1e5 })) }));
}

/** The areas of the demo installation a room can stand for. */
export const DEMO_AREAS: { area_id: string; name: string }[] = [
  { area_id: 'hall', name: 'כניסה' }, { area_id: 'living', name: 'סלון' }, { area_id: 'kitchen', name: 'מטבח' }, { area_id: 'office', name: 'חדר עבודה' },
  { area_id: 'corridor', name: 'מסדרון' }, { area_id: 'wc', name: 'שירותים' }, { area_id: 'terrace', name: 'מרפסת' },
];

/** The demo floor's devices that are not on any map yet (two have no area: they are placed by hand). */
export const DEMO_ENTITIES: PlaceEntity[] = [
  { entity_id: 'lock.front', name: 'דלת כניסה', domain: 'lock', device_class: null, area_id: 'hall' },
  { entity_id: 'binary_sensor.kitchen_door', name: 'דלת הזזה למטבח', domain: 'binary_sensor', device_class: 'door', area_id: 'kitchen' },
  { entity_id: 'binary_sensor.office_door', name: 'דלת חדר עבודה', domain: 'binary_sensor', device_class: 'door', area_id: 'office' },
  { entity_id: 'binary_sensor.motion_living', name: 'תנועה בסלון', domain: 'binary_sensor', device_class: 'motion', area_id: 'living' },
  { entity_id: 'binary_sensor.motion_office', name: 'תנועה בחדר עבודה', domain: 'binary_sensor', device_class: 'motion', area_id: 'office' },
  { entity_id: 'cover.living_terrace', name: 'תריס מרפסת', domain: 'cover', device_class: 'shutter', area_id: 'living' },
  { entity_id: 'cover.office', name: 'תריס חדר עבודה', domain: 'cover', device_class: 'shutter', area_id: 'office' },
  { entity_id: 'sensor.living_temp', name: 'טמפרטורה סלון', domain: 'sensor', device_class: 'temperature', area_id: 'living' },
  { entity_id: 'light.living', name: 'תאורת סלון', domain: 'light', device_class: null, area_id: 'living' },
  { entity_id: 'light.kitchen', name: 'תאורת מטבח', domain: 'light', device_class: null, area_id: 'kitchen' },
  { entity_id: 'light.hall', name: 'תאורת כניסה', domain: 'light', device_class: null, area_id: 'hall' },
  { entity_id: 'light.office', name: 'תאורת חדר עבודה', domain: 'light', device_class: null, area_id: 'office' },
  { entity_id: 'light.floor_lamp', name: 'מנורת רצפה סלון', domain: 'light', device_class: null, area_id: null },
  { entity_id: 'binary_sensor.smoke_corridor', name: 'גלאי עשן מסדרון', domain: 'binary_sensor', device_class: 'smoke', area_id: null },
];
