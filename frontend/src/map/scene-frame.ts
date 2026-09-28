/**
 * Camera framing and cutaway maths of the 3D view (CR-006 slice 1a), without three: the extent of a description, the
 * true isometric frame (the building page's 30 deg axes - scene-builder.ISO_THUMB - as a camera: azimuth 45 deg from
 * the +x +z corner, elevation atan(1 / sqrt 2) = 35.26 deg, one scale for every axis), the perspective direction of
 * quality level 1, and the deterministic set of walls the cutaway lowers for a camera azimuth. Pure functions: the
 * same description and the same camera state always give the same answer (design rule 4), pinned by
 * unit-plan-3d-frame.spec.ts in node.
 */
import type { SceneDescription, ScenePart } from './scene-builder';

export interface Extent {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y0: number;
  y1: number;
}
export interface IsoFrame {
  /** The point the camera looks at (the centre of the extent). */
  target: [number, number, number];
  /** Half the width and height of the orthographic frustum after the aspect fit and the padding. */
  halfW: number;
  halfH: number;
  /** The camera's distance from the target along ISO_DIR (far enough for the whole extent, never inside it). */
  dist: number;
}

const SQ2 = Math.SQRT2;
const SQ3 = Math.sqrt(3);
const SQ6 = Math.sqrt(6);
/** The camera sits at target + ISO_DIR * dist: the +x +z corner, high enough for equal foreshortening of x, y and z. */
export const ISO_DIR: [number, number, number] = [1 / SQ3, 1 / SQ3, 1 / SQ3];
/** The view of quality level 1's "iso" preset before CR-006 (a 31 deg perspective), kept as the perspective preset. */
export const PERSP_DIR: [number, number, number] = (() => {
  const n = Math.hypot(1, 0.85, 1);
  return [1 / n, 0.85 / n, 1 / n];
})();
/** Screen right and screen up of the isometric camera (unit vectors in scene space). */
export const ISO_RIGHT: [number, number, number] = [1 / SQ2, 0, -1 / SQ2];
export const ISO_UP: [number, number, number] = [-1 / SQ6, 2 / SQ6, -1 / SQ6];
export const ISO_PAD = 1.08;
/** The height a cutaway wall keeps above its level's floor. */
export const CUTAWAY_HEIGHT_M = 0.7;
/** The cutaway follows the camera azimuth in steps of this many degrees (a small orbit does not re-cut every frame). */
export const CUTAWAY_STEP_DEG = 10;
/** A wall is cut when its outward normal faces the camera at least this closely (cos 65 deg). */
const CUTAWAY_FACING = Math.cos((65 * Math.PI) / 180);
const CUT_KINDS: ReadonlySet<ScenePart['kind']> = new Set(['wall']);
/** The parts of an opening that follow the wall they sit in. */
export const OPENING_KINDS: ReadonlySet<ScenePart['kind']> = new Set(['lintel', 'sill', 'head', 'window', 'door']);
/** How far off a wall's footprint an opening part may sit and still belong to it (an open leaf swings out ~0.9 m). */
const OPENING_REACH_M = 1.0;

const rad = (d: number): number => (d * Math.PI) / 180;
const dot = (a: [number, number, number], b: [number, number, number]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The extent of a description: the floor plates (every shown level) with the levels' heights; the plan size when the
 * structure layer is off (no plates). */
export function sceneExtent(desc: SceneDescription): Extent {
  const plates = desc.parts.filter((p) => p.kind === 'floor' && p.shape === 'box');
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const p of plates) {
    x0 = Math.min(x0, p.position[0] - p.size[0] / 2);
    x1 = Math.max(x1, p.position[0] + p.size[0] / 2);
    z0 = Math.min(z0, p.position[2] - p.size[2] / 2);
    z1 = Math.max(z1, p.position[2] + p.size[2] / 2);
  }
  if (!Number.isFinite(x0)) [x0, z0, x1, z1] = [0, 0, desc.size[0], desc.size[1]];
  const levels = desc.levels.length ? desc.levels : [{ id: '', elevation_m: 0, ceiling_height_m: 2.8 }];
  const y0 = Math.min(...levels.map((l) => l.elevation_m));
  const y1 = Math.max(...levels.map((l) => l.elevation_m + l.ceiling_height_m));
  return { x0, z0, x1, z1, y0, y1 };
}

/** The extent of one level of a description (its plate, else the bounds of its parts, else the plan). */
export function levelExtent(desc: SceneDescription, levelId: string): Extent {
  const lv = desc.levels.find((l) => l.id === levelId);
  const mine = desc.parts.filter((p) => p.level_id === levelId);
  const plate = mine.find((p) => p.kind === 'floor' && p.shape === 'box');
  const e0 = lv ? lv.elevation_m : 0;
  const e1 = lv ? lv.elevation_m + lv.ceiling_height_m : e0 + 2.8;
  if (plate) return { x0: plate.position[0] - plate.size[0] / 2, x1: plate.position[0] + plate.size[0] / 2, z0: plate.position[2] - plate.size[2] / 2, z1: plate.position[2] + plate.size[2] / 2, y0: e0, y1: e1 };
  if (!mine.length) return { x0: 0, z0: 0, x1: desc.size[0], z1: desc.size[1], y0: e0, y1: e1 };
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const p of mine) {
    const r = Math.hypot(p.size[0], p.size[2]) / 2;
    x0 = Math.min(x0, p.position[0] - r);
    x1 = Math.max(x1, p.position[0] + r);
    z0 = Math.min(z0, p.position[2] - r);
    z1 = Math.max(z1, p.position[2] + r);
  }
  return { x0, z0, x1, z1, y0: e0, y1: e1 };
}

/** The isometric frame of an extent for a viewport aspect: the eight corners projected on ISO_RIGHT / ISO_UP give the
 * frustum, padded by ISO_PAD and widened (never cropped) to the aspect; the target is the extent's centre (a box
 * projects symmetrically about its centre). The ratio halfW : halfH of a flat square is sqrt 3 : 1 - the building
 * page's ISO_THUMB.half : ISO_THUMB.rise. */
export function isoFrame(e: Extent, aspect: number, pad = ISO_PAD): IsoFrame {
  const cx = (e.x0 + e.x1) / 2;
  const cy = (e.y0 + e.y1) / 2;
  const cz = (e.z0 + e.z1) / 2;
  let r0 = Infinity;
  let r1 = -Infinity;
  let u0 = Infinity;
  let u1 = -Infinity;
  for (const x of [e.x0, e.x1]) for (const y of [e.y0, e.y1]) for (const z of [e.z0, e.z1]) {
    const v: [number, number, number] = [x - cx, y - cy, z - cz];
    const r = dot(v, ISO_RIGHT);
    const u = dot(v, ISO_UP);
    r0 = Math.min(r0, r);
    r1 = Math.max(r1, r);
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
  }
  let halfW = Math.max((r1 - r0) / 2, 1) * pad;
  let halfH = Math.max((u1 - u0) / 2, 1) * pad;
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  if (halfW / halfH < a) halfW = halfH * a;
  else halfH = halfW / a;
  const diag = Math.hypot(e.x1 - e.x0, e.y1 - e.y0, e.z1 - e.z0);
  return { target: [cx, cy, cz], halfW, halfH, dist: Math.max(diag * 2, 20) };
}

/** The camera azimuth in degrees (0 = +x, 90 = +z) of a camera at (x, z) looking at the centre, folded to [0, 360). */
export function azimuthDeg(camX: number, camZ: number, cx: number, cz: number): number {
  const a = (Math.atan2(camZ - cz, camX - cx) * 180) / Math.PI;
  return ((a % 360) + 360) % 360;
}

/** The azimuth's bin centre in steps of CUTAWAY_STEP_DEG: bins are [0, 10) -> 5, [40, 50) -> 45, ... so the overview
 * presets (azimuth 45 deg) sit in the middle of a bin and float noise around them never flips the cut. */
export function quantiseAzimuth(deg: number, step = CUTAWAY_STEP_DEG): number {
  const d = ((deg % 360) + 360) % 360;
  return (Math.floor(d / step) * step + step / 2) % 360;
}

/** Whether the point (x, z) lies within `reach` metres of a box part's footprint (the box turned by its yaw). */
export function withinFootprint(p: ScenePart, x: number, z: number, reach = 0): boolean {
  const t = rad(p.rotation[1]);
  const ox = x - p.position[0];
  const oz = z - p.position[2];
  const lx = ox * Math.cos(t) - oz * Math.sin(t);
  const lz = ox * Math.sin(t) + oz * Math.cos(t);
  return Math.abs(lx) <= p.size[0] / 2 + reach && Math.abs(lz) <= p.size[2] / 2 + reach;
}

/**
 * The parts the cutaway lowers for a camera azimuth (quantised by the caller): a wall on the camera's side of the
 * extent centre whose outward normal (away from the centre) faces the camera within CUTAWAY_FACING, plus the opening
 * parts sitting in such a wall. Sorted ids - the same description and azimuth give the same list (design rule 4). A
 * wall through the centre (offset ~0) is never cut, nor is anything seen from a camera preset (the caller passes no
 * azimuth then).
 */
export function cutawayIds(desc: SceneDescription, azimuth: number, extent: Extent = sceneExtent(desc)): string[] {
  const cx = (extent.x0 + extent.x1) / 2;
  const cz = (extent.z0 + extent.z1) / 2;
  const tx = Math.cos(rad(azimuth));
  const tz = Math.sin(rad(azimuth));
  const walls: ScenePart[] = [];
  for (const p of desc.parts) {
    if (!CUT_KINDS.has(p.kind) || p.shape !== 'box') continue;
    const ox = p.position[0] - cx;
    const oz = p.position[2] - cz;
    const off = Math.hypot(ox, oz);
    if (off < 1e-6) continue;
    if (ox * tx + oz * tz <= 0) continue; // the far half
    const t = rad(p.rotation[1]);
    // the box lies along (cos t, -sin t); its normals are +-(sin t, cos t); take the one pointing away from the centre
    let nx = Math.sin(t);
    let nz = Math.cos(t);
    if (nx * ox + nz * oz < 0) {
      nx = -nx;
      nz = -nz;
    }
    if (nx * tx + nz * tz < CUTAWAY_FACING) continue;
    walls.push(p);
  }
  const ids = new Set<string>(walls.map((w) => w.id));
  for (const p of desc.parts) {
    if (!OPENING_KINDS.has(p.kind)) continue;
    if (walls.some((w) => w.level_id === p.level_id && withinFootprint(w, p.position[0], p.position[2], OPENING_REACH_M))) ids.add(p.id);
  }
  return [...ids].sort();
}

/** The box a cut part keeps: from its base up to the cut height above its level's floor (null = hidden entirely - the
 * part starts above the cut; the original when nothing is cut off). */
export function cutBox(p: ScenePart, levelElevation: number, cutHeight = CUTAWAY_HEIGHT_M): { y: number; h: number } | null {
  const h = p.size[1];
  const base = p.position[1] - h / 2;
  const top = levelElevation + cutHeight;
  if (base >= top - 1e-6) return null;
  if (base + h <= top + 1e-6) return { y: p.position[1], h };
  const kept = top - base;
  return { y: base + kept / 2, h: kept };
}
