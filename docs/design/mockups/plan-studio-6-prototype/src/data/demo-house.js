/**
 * A two-floor house in the product's plan-geometry schema 2.0 (frontend/src/map/geometry.ts GeometryDoc), authored for
 * the Studio 6 prototype. SYNTHETIC: no real site, no private data - the repo's only real fixture (sample-v2.json) is
 * loaded next to it. Authored in metres and converted to the 0..1 plan space the schema uses; plan 1000 x 900 px at
 * 0.012 m/px = 12 x 10.8 m. Zones (rooms) and anchors (cameras, devices) come with the document the way the map bundle
 * carries them. Everything the prototype needs beyond schema 2.0 (materials, north, lamp colour, walk positions) is the
 * CR-029 S0 proposal (schema 2.1), carried here under `x_proto` so the 2.0 document stays valid as-is.
 */
const W_PX = 1000, H_PX = 900, SCALE = 0.012; // 12 m x 10.8 m
const PX = (m) => m / SCALE;
const N = (xm, ym) => [+(PX(xm) / W_PX).toFixed(6), +(PX(ym) / H_PX).toFixed(6)];
const FLOOR_H = 2.9;

function tOn(polyM, p) {
  // relative position of the nearest point of the polyline to p (metres)
  let best = { t: 0, d: Infinity };
  let cum = 0;
  let total = 0;
  for (let i = 0; i < polyM.length - 1; i++) total += Math.hypot(polyM[i + 1][0] - polyM[i][0], polyM[i + 1][1] - polyM[i][1]);
  for (let i = 0; i < polyM.length - 1; i++) {
    const [ax, ay] = polyM[i];
    const dx = polyM[i + 1][0] - ax, dy = polyM[i + 1][1] - ay;
    const l2 = dx * dx + dy * dy;
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2)) : 0;
    const d = Math.hypot(p[0] - (ax + u * dx), p[1] - (ay + u * dy));
    if (d < best.d) best = { t: (cum + u * Math.sqrt(l2)) / total, d };
    cum += Math.sqrt(l2);
  }
  return +best.t.toFixed(5);
}

const WALLS_M = [
  // ground floor
  { id: 'g-out', level: 'L0', kind: 'exterior', t: 0.3, pts: [[0.5, 0.5], [11.5, 0.5], [11.5, 10.3], [0.5, 10.3], [0.5, 0.5]] },
  { id: 'g-w1', level: 'L0', kind: 'interior', t: 0.12, pts: [[3.5, 0.5], [3.5, 10.3]] },
  { id: 'g-w2', level: 'L0', kind: 'interior', t: 0.12, pts: [[0.5, 3.5], [3.5, 3.5]] },
  { id: 'g-w3', level: 'L0', kind: 'railing', t: 0.05, h: 1.0, pts: [[2.0, 3.9], [2.0, 7.5]] },
  { id: 'g-w5', level: 'L0', kind: 'interior', t: 0.12, pts: [[3.5, 6.0], [11.5, 6.0]] },
  { id: 'g-w6', level: 'L0', kind: 'interior', t: 0.12, pts: [[7.5, 6.0], [7.5, 10.3]] },
  { id: 'g-w7', level: 'L0', kind: 'interior', t: 0.12, pts: [[0.5, 7.5], [3.5, 7.5]] },
  { id: 'g-w8', level: 'L0', kind: 'interior', t: 0.1, pts: [[2.0, 7.5], [2.0, 10.3]] },
  // upper floor (smaller footprint, terrace over the kitchen / office)
  { id: 'u-out', level: 'L1', kind: 'exterior', t: 0.3, pts: [[0.5, 0.5], [11.5, 0.5], [11.5, 7.5], [0.5, 7.5], [0.5, 0.5]] },
  { id: 'u-w1', level: 'L1', kind: 'interior', t: 0.12, pts: [[3.5, 0.5], [3.5, 7.5]] },
  { id: 'u-w2', level: 'L1', kind: 'interior', t: 0.12, pts: [[3.5, 4.0], [11.5, 4.0]] },
  { id: 'u-w3', level: 'L1', kind: 'interior', t: 0.12, pts: [[8.0, 0.5], [8.0, 4.0]] },
  { id: 'u-w4', level: 'L1', kind: 'interior', t: 0.12, pts: [[3.5, 5.2], [11.5, 5.2]] },
  { id: 'u-w5', level: 'L1', kind: 'interior', t: 0.12, pts: [[6.5, 5.2], [6.5, 7.5]] },
  { id: 'u-rail', level: 'L1', kind: 'railing', t: 0.05, h: 1.0, pts: [[2.0, 3.9], [2.0, 7.2], [0.5, 7.2]] },
];

const OPENINGS_M = [
  // id, wall, point on wall (m), kind, width, height, sill, swing, hinge, entity
  ['front', 'g-out', [0.5, 2.2], 'door', 1.0, 2.1, 0, 'right', 'end', 'binary_sensor.front_door'],
  ['win-hall', 'g-out', [0.5, 1.2], 'window', 0.8, 1.2, 0.9],
  ['win-liv-n1', 'g-out', [5.5, 0.5], 'window', 1.4, 1.4, 0.9],
  ['win-liv-n2', 'g-out', [7.5, 0.5], 'window', 1.4, 1.4, 0.9],
  ['win-liv-n3', 'g-out', [9.5, 0.5], 'window', 1.4, 1.4, 0.9],
  ['win-liv-e', 'g-out', [11.5, 3.2], 'window', 2.6, 2.3, 0.1, 'none', 'start', null, 'cover.living_terrace'],
  ['win-kit-e', 'g-out', [11.5, 8.2], 'window', 1.2, 1.2, 1.0],
  ['win-kit-s', 'g-out', [9.5, 10.3], 'window', 1.4, 1.2, 1.0],
  ['win-off-s', 'g-out', [5.5, 10.3], 'window', 1.6, 1.4, 0.9, 'none', 'start', null, 'cover.office'],
  ['win-wc-w', 'g-out', [0.5, 9.0], 'window', 0.6, 0.6, 1.5],
  ['d-hall-liv', 'g-w1', [3.5, 2.0], 'door', 1.6, 2.1, 0, 'double', 'start', 'binary_sensor.hall_living_door'],
  ['d-corr-liv', 'g-w1', [3.5, 4.8], 'door', 0.9, 2.1, 0, 'left', 'start', null],
  ['d-corr-off', 'g-w1', [3.5, 6.9], 'door', 0.9, 2.1, 0, 'right', 'end', 'binary_sensor.office_door'],
  ['p-hall-corr', 'g-w2', [2.7, 3.5], 'passage', 1.4, 2.1, 0],
  ['d-liv-off', 'g-w5', [5.5, 6.0], 'door', 0.9, 2.1, 0, 'right', 'start', null],
  ['d-liv-kit', 'g-w5', [9.5, 6.0], 'door', 1.8, 2.1, 0, 'sliding', 'start', 'binary_sensor.kitchen_door'],
  ['d-off-kit', 'g-w6', [7.5, 8.2], 'door', 0.8, 2.1, 0, 'left', 'end', null],
  ['d-wc', 'g-w7', [1.25, 7.5], 'door', 0.8, 2.1, 0, 'right', 'end', 'binary_sensor.wc_door'],
  ['d-util', 'g-w7', [2.75, 7.5], 'door', 0.8, 2.1, 0, 'left', 'start', null],
  // upper
  ['uw-n1', 'u-out', [5.7, 0.5], 'window', 1.4, 1.4, 0.9, 'none', 'start', null, 'cover.bedroom1'],
  ['uw-n2', 'u-out', [9.7, 0.5], 'window', 1.4, 1.4, 0.9, 'none', 'start', null, 'cover.bedroom2'],
  ['uw-e1', 'u-out', [11.5, 2.2], 'window', 1.2, 1.4, 0.9],
  ['uw-e2', 'u-out', [11.5, 6.3], 'window', 1.2, 1.4, 0.9],
  ['uw-s1', 'u-out', [5.0, 7.5], 'window', 0.8, 0.8, 1.5],
  ['uw-s2', 'u-out', [9.0, 7.5], 'window', 1.6, 1.4, 0.9, 'none', 'start', null, 'cover.bedroom3'],
  ['uw-w1', 'u-out', [0.5, 1.8], 'window', 1.2, 1.4, 0.9],
  ['up-hall', 'u-w1', [3.5, 4.6], 'passage', 1.2, 2.1, 0],
  ['ud-bed1', 'u-w2', [5.5, 4.0], 'door', 0.9, 2.1, 0, 'left', 'start', 'binary_sensor.bedroom1_door'],
  ['ud-bed2', 'u-w2', [9.5, 4.0], 'door', 0.9, 2.1, 0, 'right', 'end', null],
  ['ud-bath', 'u-w4', [4.6, 5.2], 'door', 0.8, 2.1, 0, 'right', 'start', 'binary_sensor.bath_door'],
  ['ud-bed3', 'u-w4', [8.8, 5.2], 'door', 0.9, 2.1, 0, 'left', 'end', null],
];

const ROOMS_M = [
  { id: 'r-hall', level: 'L0', name: 'כניסה', poly: [[0.5, 0.5], [3.5, 0.5], [3.5, 3.5], [0.5, 3.5]], floor: 'tiles_grey', light: 'light.hall', temp: 23.4 },
  { id: 'r-stair', level: 'L0', name: 'חדר מדרגות', poly: [[0.5, 3.5], [2.0, 3.5], [2.0, 7.5], [0.5, 7.5]], floor: 'tiles_grey', light: 'light.stairs', temp: 23.0 },
  { id: 'r-corr', level: 'L0', name: 'מסדרון', poly: [[2.0, 3.5], [3.5, 3.5], [3.5, 7.5], [2.0, 7.5]], floor: 'tiles_grey', light: 'light.corridor', temp: 23.1 },
  { id: 'r-living', level: 'L0', name: 'סלון', poly: [[3.5, 0.5], [11.5, 0.5], [11.5, 6.0], [3.5, 6.0]], floor: 'oak', light: 'light.living', temp: 24.2, presence: 'binary_sensor.motion_living' },
  { id: 'r-kitchen', level: 'L0', name: 'מטבח', poly: [[7.5, 6.0], [11.5, 6.0], [11.5, 10.3], [7.5, 10.3]], floor: 'tiles_white', light: 'light.kitchen', temp: 25.1 },
  { id: 'r-office', level: 'L0', name: 'חדר עבודה', poly: [[3.5, 6.0], [7.5, 6.0], [7.5, 10.3], [3.5, 10.3]], floor: 'oak', light: 'light.office', temp: 23.8, presence: 'binary_sensor.motion_office' },
  { id: 'r-wc', level: 'L0', name: 'שירותים', poly: [[0.5, 7.5], [2.0, 7.5], [2.0, 10.3], [0.5, 10.3]], floor: 'tiles_white', light: 'light.wc', temp: 22.5 },
  { id: 'r-util', level: 'L0', name: 'חדר שירות', poly: [[2.0, 7.5], [3.5, 7.5], [3.5, 10.3], [2.0, 10.3]], floor: 'concrete', light: 'light.utility', temp: 22.0 },
  { id: 'r-uhall', level: 'L1', name: 'גלריה', poly: [[0.5, 0.5], [3.5, 0.5], [3.5, 7.5], [2.0, 7.5], [2.0, 3.9], [0.5, 3.9]], floor: 'oak', light: 'light.gallery', temp: 23.6 },
  { id: 'r-ucorr', level: 'L1', name: 'מסדרון עליון', poly: [[3.5, 4.0], [11.5, 4.0], [11.5, 5.2], [3.5, 5.2]], floor: 'oak', light: 'light.upper_corridor', temp: 23.5, presence: 'binary_sensor.motion_upper' },
  { id: 'r-bed1', level: 'L1', name: 'חדר שינה הורים', poly: [[3.5, 0.5], [8.0, 0.5], [8.0, 4.0], [3.5, 4.0]], floor: 'carpet', light: 'light.bedroom1', temp: 22.8 },
  { id: 'r-bed2', level: 'L1', name: 'חדר ילדים', poly: [[8.0, 0.5], [11.5, 0.5], [11.5, 4.0], [8.0, 4.0]], floor: 'carpet', light: 'light.bedroom2', temp: 23.2 },
  { id: 'r-bath', level: 'L1', name: 'אמבטיה', poly: [[3.5, 5.2], [6.5, 5.2], [6.5, 7.5], [3.5, 7.5]], floor: 'tiles_white', light: 'light.bath', temp: 24.5 },
  { id: 'r-bed3', level: 'L1', name: 'חדר אורחים', poly: [[6.5, 5.2], [11.5, 5.2], [11.5, 7.5], [6.5, 7.5]], floor: 'carpet', light: 'light.bedroom3', temp: 22.9 },
];

// objects: id, item, level, centre (m), rotation, size {w,d,h}, z, label, entity (lamps)
const OBJECTS_M = [
  // living
  ['sofa', 'sofa.3seat', 'L0', [6.3, 3.9], 180, [2.3, 0.95, 0.85], 0, 'ספה'],
  ['coffee', 'table.coffee', 'L0', [6.3, 2.6], 0, [1.1, 0.6, 0.42], 0, null],
  ['tv', 'cabinet.tv', 'L0', [6.3, 0.95], 0, [1.8, 0.45, 0.55], 0, 'מזנון טלוויזיה'],
  ['tvscreen', 'screen.tv', 'L0', [6.3, 0.78], 0, [1.4, 0.06, 0.8], 0.9, null, 'media_player.living_tv'],
  ['dining', 'table.dining', 'L0', [9.6, 3.2], 0, [1.6, 0.9, 0.75], 0, 'שולחן אוכל'],
  ['dc1', 'chair.basic', 'L0', [9.1, 2.5], 0, [0.45, 0.45, 0.9], 0, null],
  ['dc2', 'chair.basic', 'L0', [10.1, 2.5], 0, [0.45, 0.45, 0.9], 0, null],
  ['dc3', 'chair.basic', 'L0', [9.1, 3.9], 180, [0.45, 0.45, 0.9], 0, null],
  ['dc4', 'chair.basic', 'L0', [10.1, 3.9], 180, [0.45, 0.45, 0.9], 0, null],
  ['plant1', 'plant.pot', 'L0', [4.0, 5.5], 0, [0.5, 0.5, 1.4], 0, null],
  ['rug', 'mat.rug', 'L0', [6.3, 3.2], 0, [3.0, 2.2, 0.02], 0, null],
  ['lamp-liv-a', 'light.ceiling', 'L0', [6.3, 2.6], 0, [0.5, 0.5, 0.12], 2.68, null, 'light.living'],
  ['lamp-liv-b', 'light.ceiling', 'L0', [9.6, 3.2], 0, [0.5, 0.5, 0.12], 2.68, null, 'light.living'],
  ['lamp-floor', 'light.floor', 'L0', [4.1, 1.0], 0, [0.35, 0.35, 1.5], 0, null, 'light.living_floor'],
  // hall / corridor / stairs
  ['console', 'cabinet.low', 'L0', [2.0, 0.85], 0, [1.2, 0.4, 0.8], 0, 'שידה'],
  ['lamp-hall', 'light.ceiling', 'L0', [2.0, 2.0], 0, [0.4, 0.4, 0.1], 2.7, null, 'light.hall'],
  ['lamp-corr', 'light.ceiling', 'L0', [2.75, 5.5], 0, [0.3, 0.3, 0.1], 2.7, null, 'light.corridor'],
  ['lamp-stair', 'light.wall', 'L0', [0.62, 5.5], 90, [0.18, 0.1, 0.25], 2.0, null, 'light.stairs'],
  // kitchen
  ['counter-a', 'kitchen.counter', 'L0', [11.2, 8.0], 0, [0.6, 3.6, 0.9], 0, 'משטח עבודה'],
  ['counter-b', 'kitchen.counter', 'L0', [9.4, 9.95], 0, [3.0, 0.6, 0.9], 0, null],
  ['fridge', 'kitchen.fridge', 'L0', [7.95, 9.9], 0, [0.75, 0.7, 1.9], 0, 'מקרר'],
  ['island', 'kitchen.island', 'L0', [9.3, 7.6], 0, [1.6, 0.9, 0.92], 0, 'אי'],
  ['lamp-kit', 'light.pendant', 'L0', [9.3, 7.6], 0, [0.3, 0.3, 0.35], 2.0, null, 'light.kitchen'],
  // office
  ['desk', 'table.desk', 'L0', [5.5, 9.4], 0, [1.6, 0.8, 0.75], 0, 'שולחן עבודה'],
  ['dchair', 'chair.office', 'L0', [5.5, 8.6], 180, [0.6, 0.6, 1.1], 0, null],
  ['books', 'cabinet.bookcase', 'L0', [3.75, 8.0], 90, [1.8, 0.35, 2.1], 0, 'ספרייה'],
  ['lamp-off', 'light.ceiling', 'L0', [5.5, 8.0], 0, [0.4, 0.4, 0.1], 2.7, null, 'light.office'],
  // wc / utility
  ['toilet', 'sanitary.wc', 'L0', [1.25, 9.9], 0, [0.4, 0.65, 0.45], 0, null],
  ['basin', 'sanitary.basin', 'L0', [0.75, 8.2], 0, [0.45, 0.4, 0.85], 0, null],
  ['washer', 'appliance.washer', 'L0', [3.1, 9.9], 0, [0.6, 0.6, 0.85], 0, 'מכונת כביסה'],
  ['boiler', 'appliance.boiler', 'L0', [2.4, 9.9], 0, [0.5, 0.5, 1.2], 0, null],
  ['lamp-wc', 'light.ceiling', 'L0', [1.25, 8.9], 0, [0.25, 0.25, 0.1], 2.7, null, 'light.wc'],
  ['lamp-util', 'light.ceiling', 'L0', [2.75, 8.9], 0, [0.25, 0.25, 0.1], 2.7, null, 'light.utility'],
  ['ext1', 'extinguisher.co2', 'L0', [3.3, 7.3], 0, [0.18, 0.18, 0.55], 0.9, 'מטף'],
  // upper floor
  ['bed1', 'bed.double', 'L1', [5.75, 1.6], 0, [1.8, 2.1, 0.55], 0, 'מיטה זוגית'],
  ['ward1', 'cabinet.wardrobe', 'L1', [3.9, 2.8], 90, [2.0, 0.6, 2.3], 0, 'ארון'],
  ['lamp-bed1', 'light.ceiling', 'L1', [5.75, 2.3], 0, [0.4, 0.4, 0.1], 2.5, null, 'light.bedroom1'],
  ['bed2', 'bed.single', 'L1', [10.7, 1.6], 0, [1.0, 2.0, 0.5], 0, 'מיטה'],
  ['desk2', 'table.desk', 'L1', [8.9, 1.0], 0, [1.2, 0.6, 0.75], 0, null],
  ['lamp-bed2', 'light.ceiling', 'L1', [9.75, 2.3], 0, [0.4, 0.4, 0.1], 2.5, null, 'light.bedroom2'],
  ['bed3', 'bed.double', 'L1', [9.0, 6.4], 180, [1.6, 2.0, 0.55], 0, null],
  ['lamp-bed3', 'light.ceiling', 'L1', [9.0, 6.3], 0, [0.4, 0.4, 0.1], 2.5, null, 'light.bedroom3'],
  ['tub', 'sanitary.tub', 'L1', [4.4, 7.0], 0, [1.7, 0.75, 0.55], 0, 'אמבטיה'],
  ['basin2', 'sanitary.basin', 'L1', [6.1, 5.6], 0, [0.5, 0.4, 0.85], 0, null],
  ['toilet2', 'sanitary.wc', 'L1', [6.1, 6.9], 90, [0.4, 0.65, 0.45], 0, null],
  ['lamp-bath', 'light.ceiling', 'L1', [5.0, 6.3], 0, [0.3, 0.3, 0.1], 2.5, null, 'light.bath'],
  ['lamp-uhall', 'light.ceiling', 'L1', [2.0, 2.2], 0, [0.45, 0.45, 0.1], 2.5, null, 'light.gallery'],
  ['lamp-ucorr', 'light.ceiling', 'L1', [7.5, 4.6], 0, [0.3, 0.3, 0.1], 2.5, null, 'light.upper_corridor'],
  ['plant2', 'plant.pot', 'L1', [3.0, 1.0], 0, [0.45, 0.45, 1.1], 0, null],
  ['bench', 'cabinet.low', 'L1', [1.2, 1.0], 0, [1.2, 0.4, 0.5], 0, null],
];

const ANCHORS_M = [
  // cameras: id, level, position (m), rotation (bearing deg, 0 = up on plan, clockwise), fov, radius (m), mount, tilt, label
  { id: 'cam-hall', level: 'L0', p: [3.3, 0.7], rot: 215, fov: 95, r: 7, mount: 2.4, tilt: 22, label: 'מצלמה · כניסה', online: true },
  { id: 'cam-living', level: 'L0', p: [11.3, 5.8], rot: 318, fov: 100, r: 10, mount: 2.5, tilt: 20, label: 'מצלמה · סלון', online: true },
  { id: 'cam-upper', level: 'L1', p: [11.3, 4.3], rot: 265, fov: 90, r: 9, mount: 2.3, tilt: 18, label: 'מצלמה · מסדרון עליון', online: false },
];

const WALK_POSITIONS_M = [
  { id: 'wp-front', name: 'דלת כניסה', level: 'L0', p: [1.3, 2.2], heading: 90, is_default: true },
  { id: 'wp-living', name: 'מרכז הסלון', level: 'L0', p: [7.0, 3.3], heading: 0 },
  { id: 'wp-kitchen', name: 'מטבח', level: 'L0', p: [9.0, 8.8], heading: 300 },
  { id: 'wp-gallery', name: 'גלריה', level: 'L1', p: [2.7, 2.0], heading: 180 },
];

function doc() {
  const walls = WALLS_M.map((w) => ({
    id: w.id, level_id: w.level, polyline: w.pts.map((p) => N(p[0], p[1])), thickness_m: w.t, height_m: w.h ?? null, base_z_m: 0, kind: w.kind,
    confidence: 1, source: 'manual', locked: false, external_ids: {},
  }));
  const wallsM = new Map(WALLS_M.map((w) => [w.id, w.pts]));
  const openings = OPENINGS_M.map(([id, wall, p, kind, width, height, sill, swing, hinge, entity, cover]) => ({
    id, wall_id: wall, t: tOn(wallsM.get(wall), p), kind, width_m: width, height_m: height, sill_m: sill, swing: swing || 'none', hinge: hinge || 'start',
    anchor_ref: entity ? { resource_type: 'ha_entity', resource_id: entity } : null, confidence: 1, source: 'manual', external_ids: {},
    ...(cover ? { x_proto: { cover_entity: cover, glazing: id === 'uw-s1' || id === 'win-wc-w' ? 'frosted' : 'clear' } } : {}),
  }));
  const objects = OBJECTS_M.map(([id, item, level, c, rot, size, z, label, entity]) => ({
    id, item_id: item, level_id: level, position: N(c[0], c[1]), rotation_deg: rot, size: { w_m: size[0], d_m: size[1], h_m: size[2] }, z_m: z, params: {}, label: label ?? null,
    anchor_ref: entity ? { resource_type: 'ha_entity', resource_id: entity } : null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {},
  }));
  const rooms = ROOMS_M.map((r) => ({ id: r.id, level_id: r.level, ceiling_height_m: null, tags: [], x_proto: { floor_material: r.floor } }));
  return {
    schema_version: '2.0',
    plan_version_id: 'proto-house-v1',
    floor_id: 'proto-house',
    source: { sha256: '0'.repeat(64), file_name: 'proto-house.pdf', mime: 'application/pdf', page: 1 },
    dimensions: { width_px: W_PX, height_px: H_PX, scale_m_per_px: SCALE, calibration: { status: 'measured', method: 'two_point', pairs: [{ a: N(0.5, 0.5), b: N(11.5, 0.5), metres: 11 }], residual_pct: 0, reason: null } },
    transform: { rotation: 0, crop: null },
    levels: [
      { id: 'L0', name: 'קרקע', elevation_m: 0, ceiling_height_m: 2.8, is_default: true, external_ids: {} },
      { id: 'L1', name: 'קומה 1', elevation_m: FLOOR_H, ceiling_height_m: 2.6, is_default: false, external_ids: {} },
    ],
    walls, openings, rooms, objects,
    circuits: [
      { id: 'k-living', name: 'סלון', switch_entity_id: 'light.living', member_ids: ['lamp-liv-a', 'lamp-liv-b'], color_token: 'circuit-1', power_w: 48 },
    ],
    connectors: [
      { id: 'stairs-main', kind: 'stairs', level_from: 'L0', level_to: 'L1', floor_ids: [], polyline: [N(1.25, 7.2), N(1.25, 3.9)], width_m: 1.0, label: null, object_id: null, source: 'manual', external_ids: {}, shape: 'straight', turn: 'none', flights: [{ steps: 16 }], landing_depth_m: null },
    ],
    labels: [],
    groups: [],
    uncertain_regions: [],
    uncertainty: { overall: 0, notes: [] },
    meta: { generator: 'studio6-prototype', tokens_version: 'map-1', detector_version: null },
    floor_height_m: FLOOR_H,
    x_proto: {
      north_deg: 12,
      latitude: 32.08,
      longitude: 34.78,
      walk_positions: WALK_POSITIONS_M.map((w) => ({ id: w.id, name: w.name, level_id: w.level, x: N(w.p[0], w.p[1])[0], y: N(w.p[0], w.p[1])[1], heading_deg: w.heading, is_default: !!w.is_default })),
    },
  };
}

export const DEMO_HOUSE = {
  id: 'demo-house',
  title: 'בית דו־קומתי (דמו)',
  doc: doc(),
  zones: ROOMS_M.map((r) => ({ id: r.id, name: r.name, level_id: r.level, polygon: r.poly.map((p) => ({ x: N(p[0], p[1])[0], y: N(p[0], p[1])[1] })), x_proto: { floor_material: r.floor, light: r.light, temp: r.temp, presence: r.presence || null } })),
  anchors: ANCHORS_M.map((a) => ({ id: a.id, resource_type: 'camera', resource_id: a.id, x: N(a.p[0], a.p[1])[0], y: N(a.p[0], a.p[1])[1], rotation: a.rot, fov: a.fov, radius: a.r / 12, polygon: null, level_id: a.level, layer_id: 'cameras', label: a.label, state: null, online: a.online, mount_height_m: a.mount, tilt_deg: a.tilt })),
  entities: {
    'light.hall': 'off', 'light.stairs': 'off', 'light.corridor': 'off', 'light.living': 'on', 'light.living_floor': 'on', 'light.kitchen': 'on', 'light.office': 'off', 'light.wc': 'off', 'light.utility': 'off',
    'light.gallery': 'off', 'light.upper_corridor': 'off', 'light.bedroom1': 'off', 'light.bedroom2': 'on', 'light.bedroom3': 'off', 'light.bath': 'off',
    'binary_sensor.front_door': 'off', 'binary_sensor.hall_living_door': 'on', 'binary_sensor.office_door': 'off', 'binary_sensor.kitchen_door': 'on', 'binary_sensor.wc_door': 'off', 'binary_sensor.bedroom1_door': 'off', 'binary_sensor.bath_door': 'off',
    'lock.front_door': 'locked',
    'cover.living_terrace': 'open', 'cover.office': 'closed', 'cover.bedroom1': 'open', 'cover.bedroom2': 'open', 'cover.bedroom3': 'closed',
    'binary_sensor.motion_living': 'on', 'binary_sensor.motion_office': 'off', 'binary_sensor.motion_upper': 'off',
    'media_player.living_tv': 'playing',
  },
  coverPositions: { 'cover.living_terrace': 100, 'cover.office': 0, 'cover.bedroom1': 100, 'cover.bedroom2': 70, 'cover.bedroom3': 0 },
  entityNames: {
    'light.hall': 'תאורת כניסה', 'light.stairs': 'תאורת מדרגות', 'light.corridor': 'תאורת מסדרון', 'light.living': 'תאורת סלון', 'light.living_floor': 'מנורת רצפה', 'light.kitchen': 'תאורת מטבח', 'light.office': 'תאורת חדר עבודה', 'light.wc': 'תאורת שירותים', 'light.utility': 'תאורת חדר שירות',
    'light.gallery': 'תאורת גלריה', 'light.upper_corridor': 'תאורת מסדרון עליון', 'light.bedroom1': 'תאורת חדר הורים', 'light.bedroom2': 'תאורת חדר ילדים', 'light.bedroom3': 'תאורת חדר אורחים', 'light.bath': 'תאורת אמבטיה',
    'binary_sensor.front_door': 'דלת כניסה', 'binary_sensor.hall_living_door': 'דלת סלון', 'binary_sensor.office_door': 'דלת חדר עבודה', 'binary_sensor.kitchen_door': 'דלת הזזה למטבח', 'binary_sensor.wc_door': 'דלת שירותים', 'binary_sensor.bedroom1_door': 'דלת חדר הורים', 'binary_sensor.bath_door': 'דלת אמבטיה',
    'lock.front_door': 'מנעול כניסה',
    'cover.living_terrace': 'תריס מרפסת', 'cover.office': 'תריס חדר עבודה', 'cover.bedroom1': 'תריס חדר הורים', 'cover.bedroom2': 'תריס חדר ילדים', 'cover.bedroom3': 'תריס חדר אורחים',
    'binary_sensor.motion_living': 'תנועה בסלון', 'binary_sensor.motion_office': 'תנועה בחדר עבודה', 'binary_sensor.motion_upper': 'תנועה למעלה',
    'media_player.living_tv': 'טלוויזיה',
  },
  doorLocks: { front: 'lock.front_door' },
};
