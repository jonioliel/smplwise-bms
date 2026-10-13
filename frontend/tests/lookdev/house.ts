/**
 * Plan Studio 6 look-dev round 3 (docs/design/studio6/ROUND3_CRITIQUE.md): a SYNTHETIC two-floor building in the product's
 * plan-geometry schema 2.2 with the PRODUCT catalog's item ids (2026.10.1), so the pictures the critique judges are exactly
 * what the product draws - the kit models where mapped, the procedural families elsewhere, the materials the resolver picks.
 * Ground floor: a residential-like entrance, living room, kitchen, study, WC, utility room and stairs. Upper floor: a
 * gallery, a meeting room, an open office, a server room, a kitchenette and a bathroom. No real site, no private data.
 * Authored in metres, converted to the 0..1 plan space (plan 1000 x 900 px at 0.012 m/px = 12 x 10.8 m).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogLibrary } from '../../src/api/plan-catalog';
import { lookup3dOf, lookupMaterialsOf } from '../../src/api/plan-catalog';
import { buildPrimitives, type GeometryDoc, type GeomObject, type GeomOpening, type GeomWall, type Hinge, type Swing, type WallKind } from '../../src/map/geometry';
import { roomStates, type RoomStateLayer, type StateEntity, type StateOpening } from '../../src/map/room-state';
import type { SceneAnchor, SceneInput, SceneZone } from '../../src/map/scene-builder';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const W_PX = 1000;
const H_PX = 900;
const SCALE = 0.012;
const FLOOR_H = 2.9;
const PX = (m: number) => m / SCALE;
const N = (xm: number, ym: number): [number, number] => [+(PX(xm) / W_PX).toFixed(6), +(PX(ym) / H_PX).toFixed(6)];

function tOn(poly: [number, number][], p: [number, number]): number {
  let best = { t: 0, d: Infinity };
  let cum = 0;
  let total = 0;
  for (let i = 0; i < poly.length - 1; i++) total += Math.hypot(poly[i + 1][0] - poly[i][0], poly[i + 1][1] - poly[i][1]);
  for (let i = 0; i < poly.length - 1; i++) {
    const [ax, ay] = poly[i];
    const dx = poly[i + 1][0] - ax;
    const dy = poly[i + 1][1] - ay;
    const l2 = dx * dx + dy * dy;
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2)) : 0;
    const d = Math.hypot(p[0] - (ax + u * dx), p[1] - (ay + u * dy));
    if (d < best.d) best = { t: (cum + u * Math.sqrt(l2)) / total, d };
    cum += Math.sqrt(l2);
  }
  return +best.t.toFixed(5);
}

interface WallM { id: string; level: string; kind: WallKind; t: number; h?: number; pts: [number, number][] }
const WALLS: WallM[] = [
  { id: 'g-out', level: 'L0', kind: 'exterior', t: 0.3, pts: [[0.5, 0.5], [11.5, 0.5], [11.5, 10.3], [0.5, 10.3], [0.5, 0.5]] },
  { id: 'g-w1', level: 'L0', kind: 'interior', t: 0.12, pts: [[3.5, 0.5], [3.5, 10.3]] },
  { id: 'g-w2', level: 'L0', kind: 'interior', t: 0.12, pts: [[0.5, 3.5], [3.5, 3.5]] },
  { id: 'g-w3', level: 'L0', kind: 'railing', t: 0.05, h: 1.0, pts: [[2.0, 3.9], [2.0, 7.5]] },
  { id: 'g-w5', level: 'L0', kind: 'interior', t: 0.12, pts: [[3.5, 6.0], [11.5, 6.0]] },
  { id: 'g-w6', level: 'L0', kind: 'interior', t: 0.12, pts: [[7.5, 6.0], [7.5, 10.3]] },
  { id: 'g-w7', level: 'L0', kind: 'interior', t: 0.12, pts: [[0.5, 7.5], [3.5, 7.5]] },
  { id: 'g-w8', level: 'L0', kind: 'interior', t: 0.1, pts: [[2.0, 7.5], [2.0, 10.3]] },
  { id: 'u-out', level: 'L1', kind: 'exterior', t: 0.3, pts: [[0.5, 0.5], [11.5, 0.5], [11.5, 7.5], [0.5, 7.5], [0.5, 0.5]] },
  { id: 'u-w1', level: 'L1', kind: 'interior', t: 0.12, pts: [[3.5, 0.5], [3.5, 7.5]] },
  { id: 'u-w2', level: 'L1', kind: 'interior', t: 0.12, pts: [[3.5, 4.0], [11.5, 4.0]] },
  { id: 'u-w3', level: 'L1', kind: 'interior', t: 0.12, pts: [[8.0, 0.5], [8.0, 4.0]] },
  { id: 'u-w4', level: 'L1', kind: 'interior', t: 0.12, pts: [[3.5, 5.2], [11.5, 5.2]] },
  { id: 'u-w5', level: 'L1', kind: 'interior', t: 0.12, pts: [[6.5, 5.2], [6.5, 7.5]] },
  { id: 'u-w6', level: 'L1', kind: 'interior', t: 0.12, pts: [[9.0, 5.2], [9.0, 7.5]] },
  { id: 'u-rail', level: 'L1', kind: 'railing', t: 0.05, h: 1.0, pts: [[2.0, 3.9], [2.0, 7.2], [0.5, 7.2]] },
];

type OpeningM = [string, string, [number, number], 'door' | 'window' | 'passage', number, number, number, Swing?, Hinge?, (string | null)?, string?];
const OPENINGS: OpeningM[] = [
  ['front', 'g-out', [0.5, 2.2], 'door', 1.0, 2.1, 0, 'right', 'end', 'binary_sensor.front_door'],
  ['win-hall', 'g-out', [0.5, 1.2], 'window', 0.8, 1.2, 0.9],
  ['win-liv-n1', 'g-out', [5.5, 0.5], 'window', 1.4, 1.4, 0.9],
  ['win-liv-n2', 'g-out', [7.5, 0.5], 'window', 1.4, 1.4, 0.9],
  ['win-liv-n3', 'g-out', [9.5, 0.5], 'window', 1.4, 1.4, 0.9],
  ['win-liv-e', 'g-out', [11.5, 3.2], 'window', 2.6, 2.3, 0.1, 'none', 'start', 'cover.living_terrace'],
  ['win-kit-e', 'g-out', [11.5, 8.2], 'window', 1.2, 1.2, 1.0],
  ['win-kit-s', 'g-out', [9.5, 10.3], 'window', 1.4, 1.2, 1.0],
  ['win-off-s', 'g-out', [5.5, 10.3], 'window', 1.6, 1.4, 0.9, 'none', 'start', 'cover.office'],
  ['win-wc-w', 'g-out', [0.5, 9.0], 'window', 0.6, 0.6, 1.5, 'none', 'start', null, 'frosted'],
  ['d-hall-liv', 'g-w1', [3.5, 2.0], 'door', 1.6, 2.1, 0, 'double', 'start', 'binary_sensor.hall_living_door'],
  ['d-corr-liv', 'g-w1', [3.5, 4.8], 'door', 0.9, 2.1, 0, 'left', 'start', null],
  ['d-corr-off', 'g-w1', [3.5, 6.9], 'door', 0.9, 2.1, 0, 'right', 'end', 'binary_sensor.office_door'],
  ['p-hall-corr', 'g-w2', [2.7, 3.5], 'passage', 1.4, 2.1, 0],
  ['d-liv-off', 'g-w5', [5.5, 6.0], 'door', 0.9, 2.1, 0, 'right', 'start', null],
  ['d-liv-kit', 'g-w5', [9.5, 6.0], 'door', 1.8, 2.1, 0, 'sliding', 'start', 'binary_sensor.kitchen_door'],
  ['d-off-kit', 'g-w6', [7.5, 8.2], 'door', 0.8, 2.1, 0, 'left', 'end', null],
  ['d-wc', 'g-w7', [1.25, 7.5], 'door', 0.8, 2.1, 0, 'right', 'end', 'binary_sensor.wc_door'],
  ['d-util', 'g-w7', [2.75, 7.5], 'door', 0.8, 2.1, 0, 'left', 'start', null],
  ['uw-n1', 'u-out', [5.7, 0.5], 'window', 1.8, 1.4, 0.9],
  ['uw-n2', 'u-out', [9.7, 0.5], 'window', 1.8, 1.4, 0.9, 'none', 'start', 'cover.office_upper'],
  ['uw-e1', 'u-out', [11.5, 2.2], 'window', 1.2, 1.4, 0.9],
  ['uw-e2', 'u-out', [11.5, 6.3], 'window', 1.2, 1.4, 0.9],
  ['uw-s1', 'u-out', [5.0, 7.5], 'window', 0.8, 0.8, 1.5, 'none', 'start', null, 'frosted'],
  ['uw-s2', 'u-out', [7.7, 7.5], 'window', 1.6, 1.4, 0.9],
  ['uw-w1', 'u-out', [0.5, 1.8], 'window', 1.2, 1.4, 0.9],
  ['up-hall', 'u-w1', [3.5, 4.6], 'passage', 1.2, 2.1, 0],
  ['ud-meet', 'u-w2', [5.5, 4.0], 'door', 0.9, 2.1, 0, 'left', 'start', 'binary_sensor.meeting_door'],
  ['ud-office', 'u-w2', [9.5, 4.0], 'door', 0.9, 2.1, 0, 'right', 'end', null],
  ['ud-bath', 'u-w4', [4.6, 5.2], 'door', 0.8, 2.1, 0, 'right', 'start', 'binary_sensor.bath_door'],
  ['ud-server', 'u-w4', [7.7, 5.2], 'door', 0.9, 2.1, 0, 'left', 'end', 'binary_sensor.server_door'],
  ['ud-kitchenette', 'u-w4', [10.2, 5.2], 'door', 0.9, 2.1, 0, 'left', 'end', null],
];

interface RoomM { id: string; level: string; name: string; poly: [number, number][]; floor: string; temp?: number }
const ROOMS: RoomM[] = [
  { id: 'r-hall', level: 'L0', name: 'כניסה', poly: [[0.5, 0.5], [3.5, 0.5], [3.5, 3.5], [0.5, 3.5]], floor: 'tiles_grey', temp: 23.4 },
  { id: 'r-stair', level: 'L0', name: 'חדר מדרגות', poly: [[0.5, 3.5], [2.0, 3.5], [2.0, 7.5], [0.5, 7.5]], floor: 'tiles_grey' },
  { id: 'r-corr', level: 'L0', name: 'מסדרון', poly: [[2.0, 3.5], [3.5, 3.5], [3.5, 7.5], [2.0, 7.5]], floor: 'tiles_grey' },
  { id: 'r-living', level: 'L0', name: 'סלון', poly: [[3.5, 0.5], [11.5, 0.5], [11.5, 6.0], [3.5, 6.0]], floor: 'oak', temp: 24.2 },
  { id: 'r-kitchen', level: 'L0', name: 'מטבח', poly: [[7.5, 6.0], [11.5, 6.0], [11.5, 10.3], [7.5, 10.3]], floor: 'tiles_white', temp: 25.1 },
  { id: 'r-office', level: 'L0', name: 'חדר עבודה', poly: [[3.5, 6.0], [7.5, 6.0], [7.5, 10.3], [3.5, 10.3]], floor: 'oak', temp: 23.8 },
  { id: 'r-wc', level: 'L0', name: 'שירותים', poly: [[0.5, 7.5], [2.0, 7.5], [2.0, 10.3], [0.5, 10.3]], floor: 'tiles_white' },
  { id: 'r-util', level: 'L0', name: 'חדר שירות', poly: [[2.0, 7.5], [3.5, 7.5], [3.5, 10.3], [2.0, 10.3]], floor: 'concrete' },
  { id: 'r-gallery', level: 'L1', name: 'גלריה', poly: [[0.5, 0.5], [3.5, 0.5], [3.5, 7.5], [2.0, 7.5], [2.0, 3.9], [0.5, 3.9]], floor: 'oak' },
  { id: 'r-ucorr', level: 'L1', name: 'מסדרון עליון', poly: [[3.5, 4.0], [11.5, 4.0], [11.5, 5.2], [3.5, 5.2]], floor: 'tiles_grey' },
  { id: 'r-meeting', level: 'L1', name: 'חדר ישיבות', poly: [[3.5, 0.5], [8.0, 0.5], [8.0, 4.0], [3.5, 4.0]], floor: 'carpet', temp: 22.8 },
  { id: 'r-openoffice', level: 'L1', name: 'משרד פתוח', poly: [[8.0, 0.5], [11.5, 0.5], [11.5, 4.0], [8.0, 4.0]], floor: 'carpet', temp: 23.2 },
  { id: 'r-bath', level: 'L1', name: 'אמבטיה', poly: [[3.5, 5.2], [6.5, 5.2], [6.5, 7.5], [3.5, 7.5]], floor: 'tiles_white' },
  { id: 'r-server', level: 'L1', name: 'חדר שרתים', poly: [[6.5, 5.2], [9.0, 5.2], [9.0, 7.5], [6.5, 7.5]], floor: 'concrete', temp: 19.5 },
  { id: 'r-kitchenette', level: 'L1', name: 'מטבחון', poly: [[9.0, 5.2], [11.5, 5.2], [11.5, 7.5], [9.0, 7.5]], floor: 'tiles_grey' },
];

// id, item, level, centre (m), rotation, [w, d, h], z, entity (lamps: the light entity), material override
type ObjectM = [string, string, string, [number, number], number, [number, number, number], number, string?, string?, { kind: 'floor'; color_k: number; lumens: number }?];
const OBJECTS: ObjectM[] = [
  // living
  ['sofa', 'sofa.3', 'L0', [6.3, 3.9], 180, [2.3, 0.95, 0.85], 0],
  ['coffee', 'table.side', 'L0', [6.3, 2.6], 0, [1.1, 0.6, 0.42], 0],
  ['tvunit', 'cabinet.low', 'L0', [6.3, 0.95], 0, [1.8, 0.45, 0.55], 0],
  ['tv', 'tv.wall', 'L0', [6.3, 0.72], 0, [1.4, 0.08, 0.8], 0.9],
  ['dining', 'table.dining', 'L0', [9.6, 3.2], 0, [1.6, 0.9, 0.75], 0],
  ['dc1', 'chair.basic', 'L0', [9.1, 2.5], 0, [0.45, 0.45, 0.9], 0],
  ['dc2', 'chair.basic', 'L0', [10.1, 2.5], 0, [0.45, 0.45, 0.9], 0],
  ['dc3', 'chair.basic', 'L0', [9.1, 3.9], 180, [0.45, 0.45, 0.9], 0],
  ['dc4', 'chair.basic', 'L0', [10.1, 3.9], 180, [0.45, 0.45, 0.9], 0],
  ['armchair', 'armchair', 'L0', [4.4, 2.3], 90, [0.85, 0.85, 0.8], 0],
  ['plant1', 'bush', 'L0', [4.0, 5.5], 0, [0.55, 0.55, 1.1], 0],
  ['rug', 'mat.gym', 'L0', [6.3, 3.2], 0, [3.0, 2.2, 0.02], 0, undefined, 'fabric_rug'],
  ['lamp-liv-a', 'light.ceiling', 'L0', [6.3, 2.6], 0, [0.5, 0.5, 0.12], -0.3, 'light.living'],
  ['lamp-liv-b', 'light.ceiling', 'L0', [9.6, 3.2], 0, [0.5, 0.5, 0.12], -0.3, 'light.living'],
  ['lamp-floor', 'light.pole', 'L0', [4.1, 1.0], 0, [0.35, 0.35, 1.5], 0, 'light.living_floor', undefined, { kind: 'floor', color_k: 2700, lumens: 800 }],
  // hall / corridor / stairs
  ['console', 'cabinet.low', 'L0', [2.0, 0.85], 0, [1.2, 0.4, 0.8], 0],
  ['lamp-hall', 'light.ceiling', 'L0', [2.0, 2.0], 0, [0.4, 0.4, 0.1], -0.3, 'light.hall'],
  ['lamp-corr', 'light.ceiling', 'L0', [2.75, 5.5], 0, [0.3, 0.3, 0.1], -0.3, 'light.corridor'],
  ['lamp-stair', 'light.wall', 'L0', [0.62, 5.5], 90, [0.18, 0.1, 0.25], 2.0, 'light.stairs'],
  ['ext1', 'extinguisher.co2', 'L0', [3.3, 7.3], 0, [0.18, 0.18, 0.55], 0.9],
  // kitchen
  ['counter-a', 'kitchenette.counter', 'L0', [11.2, 8.0], 90, [3.6, 0.6, 0.9], 0],
  ['counter-b', 'kitchenette.counter', 'L0', [8.9, 9.95], 0, [1.8, 0.6, 0.9], 0],
  ['oven', 'oven.kitchen', 'L0', [10.1, 9.95], 0, [0.6, 0.6, 0.9], 0],
  ['fridge', 'fridge.domestic', 'L0', [7.95, 9.9], 0, [0.75, 0.7, 1.9], 0],
  ['island', 'kitchenette.counter', 'L0', [9.3, 7.6], 0, [1.6, 0.9, 0.92], 0],
  ['stool1', 'stool.bar', 'L0', [8.9, 7.0], 0, [0.4, 0.4, 0.75], 0],
  ['stool2', 'stool.bar', 'L0', [9.7, 7.0], 0, [0.4, 0.4, 0.75], 0],
  ['lamp-kit-a', 'light.pendant', 'L0', [8.9, 7.6], 0, [0.3, 0.3, 0.35], -1.0, 'light.kitchen'],
  ['lamp-kit-b', 'light.pendant', 'L0', [9.7, 7.6], 0, [0.3, 0.3, 0.35], -1.0, 'light.kitchen'],
  // study
  ['desk', 'table.desk', 'L0', [5.5, 9.4], 0, [1.6, 0.8, 0.75], 0],
  ['dchair', 'chair.office', 'L0', [5.5, 8.6], 180, [0.6, 0.6, 1.1], 0],
  ['books', 'shelf.unit', 'L0', [3.75, 8.0], 90, [1.8, 0.35, 2.1], 0],
  ['board', 'whiteboard', 'L0', [5.5, 10.1], 0, [1.8, 0.05, 1.2], 0.9],
  ['printer-unit', 'cabinet.low', 'L0', [7.0, 9.6], 90, [0.8, 0.45, 0.75], 0],
  ['printer', 'printer.office', 'L0', [7.0, 9.6], 90, [0.5, 0.45, 0.4], 0.75],
  ['lamp-off', 'light.ceiling', 'L0', [5.5, 8.0], 0, [0.4, 0.4, 0.1], -0.3, 'light.office'],
  // wc / utility
  ['toilet', 'toilet.standard', 'L0', [1.25, 9.9], 0, [0.4, 0.7, 0.8], 0],
  ['basin', 'sink.bathroom', 'L0', [0.8, 8.2], 90, [0.6, 0.45, 0.85], 0],
  ['washer', 'cabinet.files', 'L0', [3.1, 9.9], 0, [0.6, 0.6, 0.85], 0],
  ['boiler', 'object.generic', 'L0', [2.4, 9.9], 0, [0.5, 0.5, 1.2], 0],
  ['lamp-wc', 'light.ceiling', 'L0', [1.25, 8.9], 0, [0.25, 0.25, 0.1], -0.3, 'light.wc'],
  ['lamp-util', 'light.ceiling', 'L0', [2.75, 8.9], 0, [0.25, 0.25, 0.1], -0.3, 'light.utility'],
  // upper: gallery + corridor
  ['bench', 'bench.indoor', 'L1', [1.2, 1.0], 0, [1.8, 0.4, 0.45], 0],
  ['plant2', 'bush', 'L1', [3.0, 1.0], 0, [0.5, 0.5, 1.0], 0],
  ['lamp-gal', 'light.ceiling', 'L1', [2.0, 2.2], 0, [0.45, 0.45, 0.1], -0.3, 'light.gallery'],
  ['lamp-ucorr', 'light.ceiling', 'L1', [7.5, 4.6], 0, [0.3, 0.3, 0.1], -0.3, 'light.upper_corridor'],
  // meeting room
  ['mtable', 'table.meeting', 'L1', [5.75, 2.25], 0, [3.0, 1.2, 0.75], 0],
  ['mc1', 'chair.basic', 'L1', [4.8, 1.4], 0, [0.45, 0.45, 0.9], 0],
  ['mc2', 'chair.basic', 'L1', [5.75, 1.4], 0, [0.45, 0.45, 0.9], 0],
  ['mc3', 'chair.basic', 'L1', [6.7, 1.4], 0, [0.45, 0.45, 0.9], 0],
  ['mc4', 'chair.basic', 'L1', [4.8, 3.1], 180, [0.45, 0.45, 0.9], 0],
  ['mc5', 'chair.basic', 'L1', [5.75, 3.1], 180, [0.45, 0.45, 0.9], 0],
  ['mc6', 'chair.basic', 'L1', [6.7, 3.1], 180, [0.45, 0.45, 0.9], 0],
  ['mtv', 'tv.wall', 'L1', [3.62, 2.25], 90, [1.2, 0.1, 0.7], 1.5],
  ['mboard', 'whiteboard', 'L1', [5.75, 0.69], 0, [1.8, 0.05, 1.2], 0.9],
  ['lamp-meet-a', 'light.panel', 'L1', [4.9, 2.25], 0, [0.6, 0.6, 0.05], -0.05, 'light.meeting'],
  ['lamp-meet-b', 'light.panel', 'L1', [6.6, 2.25], 0, [0.6, 0.6, 0.05], -0.05, 'light.meeting'],
  // open office
  ['od1', 'table.desk', 'L1', [9.0, 1.3], 0, [1.4, 0.7, 0.75], 0],
  ['od2', 'table.desk', 'L1', [10.6, 1.3], 0, [1.4, 0.7, 0.75], 0],
  ['od3', 'table.desk', 'L1', [9.0, 3.0], 180, [1.4, 0.7, 0.75], 0],
  ['od4', 'table.desk', 'L1', [10.6, 3.0], 180, [1.4, 0.7, 0.75], 0],
  ['oc1', 'chair.office', 'L1', [9.0, 2.0], 0, [0.6, 0.6, 1.1], 0],
  ['oc2', 'chair.office', 'L1', [10.6, 2.0], 0, [0.6, 0.6, 1.1], 0],
  ['oc3', 'chair.office', 'L1', [9.0, 2.35], 180, [0.6, 0.6, 1.1], 0],
  ['oc4', 'chair.office', 'L1', [10.6, 2.35], 180, [0.6, 0.6, 1.1], 0],
  ['files', 'cabinet.files', 'L1', [8.35, 3.6], 0, [0.5, 0.6, 1.3], 0],
  ['lamp-oo-a', 'light.panel', 'L1', [9.0, 2.2], 0, [0.6, 0.6, 0.05], -0.05, 'light.office_upper'],
  ['lamp-oo-b', 'light.panel', 'L1', [10.6, 2.2], 0, [0.6, 0.6, 0.05], -0.05, 'light.office_upper'],
  // bathroom
  ['toilet2', 'toilet.standard', 'L1', [6.1, 6.9], 90, [0.4, 0.7, 0.8], 0],
  ['basin2', 'sink.bathroom', 'L1', [6.1, 5.6], 0, [0.6, 0.45, 0.85], 0],
  ['shower', 'shower.stall', 'L1', [4.0, 7.0], 0, [0.9, 0.9, 2.1], 0],
  ['lamp-bath', 'light.ceiling', 'L1', [5.0, 6.3], 0, [0.3, 0.3, 0.1], -0.3, 'light.bath'],
  // server room
  ['rack1', 'rack.server', 'L1', [7.2, 6.9], 0, [0.6, 1.0, 2.0], 0],
  ['rack2', 'rack.server', 'L1', [7.9, 6.9], 0, [0.6, 1.0, 2.0], 0],
  ['ups', 'ups.rack', 'L1', [8.6, 6.95], 0, [0.6, 0.8, 1.2], 0],
  ['panel', 'panel.electrical', 'L1', [6.68, 6.0], 90, [0.6, 0.2, 1.0], 1.0],
  ['lamp-srv', 'light.fluorescent', 'L1', [7.75, 6.3], 0, [1.2, 0.15, 0.08], -0.1, 'light.server'],
  // kitchenette
  ['kcounter', 'kitchenette.counter', 'L1', [10.6, 7.15], 0, [1.8, 0.6, 0.9], 0],
  ['kfridge', 'fridge.kitchen', 'L1', [9.5, 7.1], 0, [0.9, 0.75, 1.9], 0],
  ['cooler', 'water.cooler', 'L1', [11.2, 5.55], 0, [0.35, 0.35, 1.2], 0],
  ['ktable', 'table.round', 'L1', [10.0, 5.9], 0, [0.9, 0.9, 0.75], 0],
  ['kstool1', 'stool', 'L1', [9.4, 5.9], 0, [0.35, 0.35, 0.45], 0],
  ['kstool2', 'stool', 'L1', [10.6, 6.0], 0, [0.35, 0.35, 0.45], 0],
  ['lamp-kn', 'light.pendant', 'L1', [10.0, 5.9], 0, [0.3, 0.3, 0.35], -1.0, 'light.kitchenette'],
];

interface EntityM { id: string; domain: string; device_class: string | null; state: string; level: string; p: [number, number]; layer: string; name: string; attributes?: Record<string, unknown> }
const ENTITIES: EntityM[] = [
  { id: 'binary_sensor.front_door', domain: 'binary_sensor', device_class: 'door', state: 'off', level: 'L0', p: [0.5, 2.2], layer: 'doors', name: 'דלת כניסה' },
  { id: 'binary_sensor.hall_living_door', domain: 'binary_sensor', device_class: 'door', state: 'on', level: 'L0', p: [3.5, 2.0], layer: 'doors', name: 'דלת סלון' },
  { id: 'binary_sensor.office_door', domain: 'binary_sensor', device_class: 'door', state: 'off', level: 'L0', p: [3.5, 6.9], layer: 'doors', name: 'דלת חדר עבודה' },
  { id: 'binary_sensor.kitchen_door', domain: 'binary_sensor', device_class: 'door', state: 'on', level: 'L0', p: [9.5, 6.0], layer: 'doors', name: 'דלת הזזה למטבח' },
  { id: 'binary_sensor.wc_door', domain: 'binary_sensor', device_class: 'door', state: 'off', level: 'L0', p: [1.25, 7.5], layer: 'doors', name: 'דלת שירותים' },
  { id: 'binary_sensor.meeting_door', domain: 'binary_sensor', device_class: 'door', state: 'on', level: 'L1', p: [5.5, 4.0], layer: 'doors', name: 'דלת חדר ישיבות' },
  { id: 'binary_sensor.bath_door', domain: 'binary_sensor', device_class: 'door', state: 'off', level: 'L1', p: [4.6, 5.2], layer: 'doors', name: 'דלת אמבטיה' },
  { id: 'binary_sensor.server_door', domain: 'binary_sensor', device_class: 'door', state: 'off', level: 'L1', p: [7.7, 5.2], layer: 'doors', name: 'דלת חדר שרתים' },
  { id: 'binary_sensor.motion_living', domain: 'binary_sensor', device_class: 'motion', state: 'on', level: 'L0', p: [7.0, 4.8], layer: 'sensors', name: 'תנועה בסלון' },
  { id: 'binary_sensor.motion_office', domain: 'binary_sensor', device_class: 'motion', state: 'off', level: 'L0', p: [6.5, 7.0], layer: 'sensors', name: 'תנועה בחדר עבודה' },
  { id: 'binary_sensor.motion_upper', domain: 'binary_sensor', device_class: 'motion', state: 'off', level: 'L1', p: [7.5, 4.6], layer: 'sensors', name: 'תנועה למעלה' },
  { id: 'sensor.living_temp', domain: 'sensor', device_class: 'temperature', state: '24.2', level: 'L0', p: [5.0, 5.2], layer: 'sensors', name: 'טמפרטורה סלון', attributes: { unit_of_measurement: '°C' } },
  { id: 'sensor.server_temp', domain: 'sensor', device_class: 'temperature', state: '19.5', level: 'L1', p: [8.7, 5.6], layer: 'sensors', name: 'טמפרטורה חדר שרתים', attributes: { unit_of_measurement: '°C' } },
  { id: 'cover.living_terrace', domain: 'cover', device_class: 'shutter', state: 'open', level: 'L0', p: [11.5, 3.2], layer: 'sensors', name: 'תריס מרפסת' },
  { id: 'cover.office', domain: 'cover', device_class: 'shutter', state: 'closed', level: 'L0', p: [5.5, 10.3], layer: 'sensors', name: 'תריס חדר עבודה' },
  { id: 'cover.office_upper', domain: 'cover', device_class: 'shutter', state: 'closed', level: 'L1', p: [9.7, 0.5], layer: 'sensors', name: 'תריס משרד' },
];

/** The light entities (bound to the lamps' anchor_ref; the lit rooms follow them). */
export const LIGHTS: Record<string, 'on' | 'off'> = {
  'light.hall': 'off', 'light.stairs': 'on', 'light.corridor': 'off', 'light.living': 'on', 'light.living_floor': 'on', 'light.kitchen': 'on', 'light.office': 'off', 'light.wc': 'off', 'light.utility': 'off',
  'light.gallery': 'off', 'light.upper_corridor': 'on', 'light.meeting': 'on', 'light.office_upper': 'on', 'light.bath': 'off', 'light.server': 'on', 'light.kitchenette': 'off',
};

const CAMERAS = [
  { id: 'cam-hall', level: 'L0', p: [3.3, 0.7] as [number, number], rot: 215, fov: 95, r: 7, mount: 2.4, tilt: 22, label: 'מצלמה · כניסה', online: true },
  { id: 'cam-living', level: 'L0', p: [11.3, 5.8] as [number, number], rot: 318, fov: 100, r: 10, mount: 2.5, tilt: 20, label: 'מצלמה · סלון', online: true },
  { id: 'cam-upper', level: 'L1', p: [11.3, 4.3] as [number, number], rot: 265, fov: 90, r: 9, mount: 2.3, tilt: 18, label: 'מצלמה · מסדרון עליון', online: false },
];

export const WALK_POSITIONS = [
  { id: 'wp-front', name: 'דלת כניסה', level: 'L0', p: [1.1, 2.2] as [number, number], heading: 250, is_default: true },
  { id: 'wp-living', name: 'מרכז הסלון', level: 'L0', p: [7.2, 4.9] as [number, number], heading: 335 },
  { id: 'wp-kitchen', name: 'מטבח', level: 'L0', p: [8.3, 8.9] as [number, number], heading: 60 },
  { id: 'wp-office', name: 'חדר עבודה', level: 'L0', p: [4.6, 7.0] as [number, number], heading: 160 },
  { id: 'wp-meeting', name: 'חדר ישיבות', level: 'L1', p: [4.2, 3.6] as [number, number], heading: 35 },
  { id: 'wp-openoffice', name: 'משרד פתוח', level: 'L1', p: [8.4, 1.0] as [number, number], heading: 120 },
  { id: 'wp-gallery', name: 'גלריה', level: 'L1', p: [2.7, 2.0] as [number, number], heading: 180 },
];

export function houseDoc(): GeometryDoc {
  const walls: GeomWall[] = WALLS.map((w) => ({
    id: w.id, level_id: w.level, polyline: w.pts.map((p) => N(p[0], p[1])), thickness_m: w.t, height_m: w.h ?? null, base_z_m: 0, kind: w.kind,
    confidence: 1, source: 'manual', locked: false, external_ids: {},
  }));
  const wallsM = new Map(WALLS.map((w) => [w.id, w.pts]));
  const openings: GeomOpening[] = OPENINGS.map(([id, wall, p, kind, width, height, sill, swing, hinge, entity, tint]) => ({
    id, wall_id: wall, t: tOn(wallsM.get(wall)!, p), kind, width_m: width, height_m: height, sill_m: sill, swing: swing ?? 'none', hinge: hinge ?? 'start',
    anchor_ref: entity ? { resource_type: 'ha_entity', resource_id: entity } : null, confidence: 1, source: 'manual', external_ids: {},
    ...(tint ? { tint: tint as 'frosted' } : {}),
  }));
  const objects: GeomObject[] = OBJECTS.map(([id, item, level, c, rot, size, z, entity, material, light]) => ({
    id, item_id: item, level_id: level, position: N(c[0], c[1]), rotation_deg: rot, size: { w_m: size[0], d_m: size[1], h_m: size[2] }, z_m: z, params: {}, label: null,
    anchor_ref: entity ? { resource_type: 'ha_entity', resource_id: entity } : null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {},
    ...(material ? { material_id: material } : {}),
    ...(light ? { light } : {}),
  }));
  return {
    schema_version: '2.2',
    plan_version_id: 'lookdev-house-r3',
    floor_id: 'lookdev-house',
    source: { sha256: '0'.repeat(64), file_name: 'lookdev-house.pdf', mime: 'application/pdf', page: 1 },
    dimensions: { width_px: W_PX, height_px: H_PX, scale_m_per_px: SCALE, calibration: { status: 'measured', method: 'two_point', pairs: [{ a: N(0.5, 0.5), b: N(11.5, 0.5), metres: 11 }], residual_pct: 0, reason: null } },
    transform: { rotation: 0, crop: null },
    levels: [
      { id: 'L0', name: 'קרקע', elevation_m: 0, ceiling_height_m: 2.8, is_default: true },
      { id: 'L1', name: 'קומה 1', elevation_m: FLOOR_H, ceiling_height_m: 2.6, is_default: false },
    ],
    walls, openings,
    rooms: ROOMS.map((r) => ({ id: r.id, level_id: r.level, ceiling_height_m: null, tags: [], floor_material_id: r.floor })),
    objects,
    circuits: [],
    connectors: [{ id: 'stairs-main', kind: 'stairs', level_from: 'L0', level_to: 'L1', floor_ids: [], polyline: [N(1.25, 7.2), N(1.25, 3.9)], width_m: 1.0, label: null, object_id: null, source: 'manual', external_ids: {}, shape: 'straight', turn: 'none', flights: [{ steps: 16 }], landing_depth_m: null }],
    labels: [], groups: [], uncertain_regions: [], uncertainty: { overall: 0, notes: [] },
    meta: { generator: 'lookdev-r3', tokens_version: 'map-1', detector_version: null },
    floor_height_m: FLOOR_H,
    north_deg: 12,
    walk_positions: WALK_POSITIONS.map((w) => ({ id: w.id, name: w.name, level_id: w.level, x: N(w.p[0], w.p[1])[0], y: N(w.p[0], w.p[1])[1], heading_deg: w.heading, is_default: !!w.is_default })),
  } as GeometryDoc;
}

export function houseZones(): SceneZone[] {
  return ROOMS.map((r) => ({ id: r.id, name: r.name, level_id: r.level, polygon: r.poly.map((p) => ({ x: N(p[0], p[1])[0], y: N(p[0], p[1])[1] })) }));
}

export function houseLabels(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of ROOMS) out[r.id] = r.name;
  for (const e of ENTITIES) out[e.id] = e.name;
  for (const c of CAMERAS) out[c.id] = c.label;
  return out;
}

let catalog: CatalogLibrary | null = null;
export function houseCatalog(): CatalogLibrary {
  catalog ??= JSON.parse(fs.readFileSync(path.resolve(HERE, '..', '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json'), 'utf8')) as CatalogLibrary;
  return catalog;
}

export function houseEntityStates(): Record<string, string | null> {
  const out: Record<string, string | null> = { ...LIGHTS };
  for (const e of ENTITIES) out[e.id] = e.state;
  return out;
}

/** The room state layer of the building at `now` (lit rooms by their lamps' entities, open doors, presence, temperature). */
export function houseRoomStates(now: number): RoomStateLayer {
  const doc = houseDoc();
  const lib = houseCatalog();
  const cat = lookup3dOf(lib);
  const lookup = (id: string) => { const c = cat(id); return c ? { shape: c.shape, icon: 'box', color_token: c.color_token } : undefined; };
  const walls = new Map(doc.walls.map((w) => [w.id, w]));
  const byId = new Map(doc.openings.map((o) => [o.id, o]));
  const openings: StateOpening[] = [];
  const lamps: { x: number; y: number; level_id: string | null; on: boolean }[] = [];
  const states = houseEntityStates();
  for (const p of buildPrimitives(doc, W_PX, H_PX, null, lookup)) {
    if (p.kind === 'door' || p.kind === 'window' || p.kind === 'passage') {
      const o = byId.get(p.id);
      const w = o ? walls.get(o.wall_id) : undefined;
      if (!o || !w) continue;
      openings.push({ id: o.id, kind: p.kind, x: (p.gap[0][0] + p.gap[1][0]) / 2 / W_PX, y: (p.gap[0][1] + p.gap[1][1]) / 2 / H_PX, level_id: w.level_id, entity_id: o.anchor_ref?.resource_type === 'ha_entity' ? o.anchor_ref.resource_id : null });
    } else if (p.kind === 'object' && (p.color === 'light' || p.circuit_id !== null)) {
      const ent = p.anchor?.startsWith('ha_entity:') ? p.anchor.slice('ha_entity:'.length) : null;
      lamps.push({ x: p.cx / W_PX, y: p.cy / H_PX, level_id: p.level_id, on: ent !== null && states[ent] === 'on' });
    }
  }
  const entities: StateEntity[] = ENTITIES.map((e) => ({ id: e.id, domain: e.domain, device_class: e.device_class, state: e.state, last_changed: new Date(now - 60_000).toISOString(), attributes: e.attributes ?? null, x: N(e.p[0], e.p[1])[0], y: N(e.p[0], e.p[1])[1], level_id: e.level, layer_id: e.layer }));
  return roomStates({ rooms: ROOMS.map((r) => ({ id: r.id, polygon: r.poly.map((p) => ({ x: N(p[0], p[1])[0], y: N(p[0], p[1])[1] })), level_id: r.level })), entities, openings, lamps, size: [W_PX, H_PX], scaleMPerPx: SCALE, now, fade: 10, levelOf: (id) => id ?? 'L0' });
}

/** The scene input of the building: one level or all, with or without the walk world, with the realistic part. */
export function houseInput(opts: { level: string | null; walk: boolean; realistic: boolean; now?: number }): SceneInput {
  const doc = houseDoc();
  const lib = houseCatalog();
  const anchors: SceneAnchor[] = [
    ...CAMERAS.map((c): SceneAnchor => ({ id: c.id, resource_type: 'camera', resource_id: c.id, x: N(c.p[0], c.p[1])[0], y: N(c.p[0], c.p[1])[1], rotation: c.rot, fov: c.fov, radius: c.r / 12, polygon: null, level_id: c.level, layer_id: 'cameras', label: c.label, state: null, online: c.online, mount_height_m: c.mount, tilt_deg: c.tilt })),
    ...ENTITIES.map((e): SceneAnchor => ({ id: e.id, resource_type: 'ha_entity', resource_id: e.id, x: N(e.p[0], e.p[1])[0], y: N(e.p[0], e.p[1])[1], rotation: 0, fov: null, radius: null, polygon: null, level_id: e.level, layer_id: e.layer, label: e.name, state: e.state, online: null, mount_height_m: null, tilt_deg: null })),
  ];
  const now = opts.now ?? Date.UTC(2026, 9, 13, 10, 0, 0);
  return {
    doc, width: W_PX, height: H_PX, anchors, entityStates: houseEntityStates(), circuitStates: {}, catalog: lookup3dOf(lib), materialsCatalog: lookupMaterialsOf(lib),
    zones: houseZones(), level: opts.level, roomStates: houseRoomStates(now), walk: opts.walk, realistic: opts.realistic,
  };
}
