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
/** Above this many entity pills at the overview the element draws only the selected, hovered and alerting ones
 * (slice 1c; here rather than in the element so a node spec can read it without Lit's decorators). */
export const PILL_CAP = 60;
/** R3 G10: on a phone-wide stage (under PHONE_STAGE_PX CSS px) the realistic level caps the pills much lower - a 390 px
 * picture under sixty pills is a pill cloud, not a plan; the alerting ones (open, on, stale) stay, the rest count in "+N". */
export const PILL_CAP_PHONE = 8;
export const PHONE_STAGE_PX = 640;
/** The cutaway follows the camera azimuth in steps of this many degrees (a small orbit does not re-cut every frame). */
export const CUTAWAY_STEP_DEG = 10;
/** A wall is cut when its outward normal faces the camera at least this closely (cos 65 deg). */
const CUTAWAY_FACING = Math.cos((65 * Math.PI) / 180);
const CUT_KINDS: ReadonlySet<ScenePart['kind']> = new Set(['wall']);
/** The parts of an opening that follow the wall they sit in. */
export const OPENING_KINDS: ReadonlySet<ScenePart['kind']> = new Set(['lintel', 'sill', 'head', 'window', 'door', 'marker']);
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
 * azimuth then). The runs of a curved wall use their wall's own centre (`pivot`) instead of the extent's.
 */
export function cutawayIds(desc: SceneDescription, azimuth: number, extent: Extent = sceneExtent(desc)): string[] {
  const cx = (extent.x0 + extent.x1) / 2;
  const cz = (extent.z0 + extent.z1) / 2;
  const tx = Math.cos(rad(azimuth));
  const tz = Math.sin(rad(azimuth));
  const walls: ScenePart[] = [];
  for (const p of desc.parts) {
    if (!CUT_KINDS.has(p.kind) || p.shape !== 'box') continue;
    // a curved wall's run is judged from its own wall's centre (pivot): a round room loses its near half as one room
    const ox = p.position[0] - (p.pivot ? p.pivot[0] : cx);
    const oz = p.position[2] - (p.pivot ? p.pivot[1] : cz);
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

/** The size a thumbnail is drawn at: the wanted size clamped to the canvas it is drawn into (a narrow canvas hosts a
 * smaller picture) - the frame is computed for the clamped aspect, never for the wanted one (review nit of slice 1a). */
export function clampThumb(width: number, height: number, canvasW: number, canvasH: number): { w: number; h: number } {
  return { w: Math.max(0, Math.min(width, Math.floor(canvasW))), h: Math.max(0, Math.min(height, Math.floor(canvasH))) };
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

// ---- PLAN3D-POLISH-2430: the live view's framing - the drawn building, not the plan sheet, fitted into the free part of the stage

/** What the live view frames: the parts that draw the building (structure, openings, furniture, rooms, cameras). The floor
 * plates are left out - the default level's plate is the whole plan sheet, so a plan drawn with wide white margins framed
 * its margins too and the building filled about half the stage. */
const CONTENT_KINDS: ReadonlySet<ScenePart['kind']> = new Set(['wall', 'lintel', 'sill', 'head', 'door', 'window', 'object', 'connector', 'camera', 'room', 'marker']);
/** The margin around the drawn building, metres (the plates' own pad is 0.5 m). */
export const CONTENT_PAD_M = 0.3;
/** The live presets' padding over the fitted box (the stage margin itself is in the insets, in pixels). */
export const LIVE_PAD = 1.03;

/** The extent of what the description draws (CONTENT_KINDS, padded by CONTENT_PAD_M), never past the plates' extent; the
 * plates' extent when nothing is drawn. The heights are the levels' (sceneExtent). */
export function contentExtent(desc: SceneDescription): Extent {
  const plates = sceneExtent(desc);
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  const take = (x: number, z: number) => {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  };
  for (const p of desc.parts) {
    if (!CONTENT_KINDS.has(p.kind)) continue;
    if (p.shape === 'prism') {
      for (const q of p.polygon ?? []) take(p.position[0] + q[0], p.position[2] + q[1]);
      continue;
    }
    if (p.shape !== 'box' && p.shape !== 'cylinder') continue;
    // a box turned by its yaw: the footprint's corners (a cylinder's footprint is its square)
    const t = rad(p.rotation[1]);
    const c = Math.abs(Math.cos(t));
    const s = Math.abs(Math.sin(t));
    const hx = (p.size[0] * c + p.size[2] * s) / 2;
    const hz = (p.size[0] * s + p.size[2] * c) / 2;
    take(p.position[0] - hx, p.position[2] - hz);
    take(p.position[0] + hx, p.position[2] + hz);
  }
  if (!Number.isFinite(x0)) return plates;
  const out: Extent = { x0: Math.max(plates.x0, x0 - CONTENT_PAD_M), z0: Math.max(plates.z0, z0 - CONTENT_PAD_M), x1: Math.min(plates.x1, x1 + CONTENT_PAD_M), z1: Math.min(plates.z1, z1 + CONTENT_PAD_M), y0: plates.y0, y1: plates.y1 };
  return out.x1 - out.x0 > 1e-3 && out.z1 - out.z0 > 1e-3 ? out : plates;
}

/** The stage's covered edges (the overlays the building should not sit under): pixels in, fractions of the stage out. */
export interface FrameInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export const NO_INSETS: FrameInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Pixel insets of a w x h stage as fractions, scaled down so the free part keeps at least 40 % of each side. */
export function insetFractions(px: FrameInsets, w: number, h: number): FrameInsets {
  if (!(w > 0 && h > 0)) return NO_INSETS;
  const side = (a: number, b: number, size: number): [number, number] => {
    let fa = Math.max(0, a) / size;
    let fb = Math.max(0, b) / size;
    if (fa + fb > 0.6) {
      const k = 0.6 / (fa + fb);
      fa *= k;
      fb *= k;
    }
    return [fa, fb];
  };
  const [left, right] = side(px.left, px.right, w);
  const [top, bottom] = side(px.top, px.bottom, h);
  return { top, right, bottom, left };
}

type V3 = [number, number, number];
const corners = (e: Extent): V3[] => {
  const out: V3[] = [];
  for (const x of [e.x0, e.x1]) for (const y of [e.y0, e.y1]) for (const z of [e.z0, e.z1]) out.push([x, y, z]);
  return out;
};

/** The isometric frame that fits an extent into the free part of the stage (`insets`, fractions), padded, at the stage's
 * aspect: the frustum is as small as the projected box allows and the target is moved so the box sits centred in the free
 * part. With no insets the target is the extent's centre, as in isoFrame (which the stills and the control images keep). */
export function isoFitFrame(e: Extent, aspect: number, insets: FrameInsets = NO_INSETS, pad = LIVE_PAD): IsoFrame {
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  const c: V3 = [(e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2, (e.z0 + e.z1) / 2];
  let r0 = Infinity;
  let r1 = -Infinity;
  let u0 = Infinity;
  let u1 = -Infinity;
  for (const p of corners(e)) {
    const v: V3 = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    const r = dot(v, ISO_RIGHT);
    const u = dot(v, ISO_UP);
    r0 = Math.min(r0, r);
    r1 = Math.max(r1, r);
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
  }
  const fw = Math.max(0.2, 1 - insets.left - insets.right);
  const fh = Math.max(0.2, 1 - insets.top - insets.bottom);
  const halfH = Math.max(((Math.max(u1 - u0, 2) / 2) * pad) / fh, ((Math.max(r1 - r0, 2) / 2) * pad) / (fw * a));
  const halfW = halfH * a;
  // the free part's centre in NDC; the target slides so the box's centre lands on it
  const nx = insets.left - insets.right;
  const ny = insets.bottom - insets.top;
  const sr = (r0 + r1) / 2 - nx * halfW;
  const su = (u0 + u1) / 2 - ny * halfH;
  const target: V3 = [c[0] + ISO_RIGHT[0] * sr + ISO_UP[0] * su, c[1] + ISO_RIGHT[1] * sr + ISO_UP[1] * su, c[2] + ISO_RIGHT[2] * sr + ISO_UP[2] * su];
  const diag = Math.hypot(e.x1 - e.x0, e.y1 - e.y0, e.z1 - e.z0);
  return { target, halfW, halfH, dist: Math.max(diag * 2, 20) };
}

/** A perspective camera that fits an extent into the free part of the stage: it looks along -`dir` (from target + dir * d), at
 * the nearest distance whose projection of the box's eight corners fits the free part, padded, then slides (camera and target
 * together) so the projected box sits centred in it. `dir` straight down is the top preset (screen up = -z, north). */
export function perspFit(e: Extent, dir: V3, fovDeg: number, aspect: number, insets: FrameInsets = NO_INSETS, pad = LIVE_PAD): { position: V3; target: V3 } {
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  const n = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const d0: V3 = [dir[0] / n, dir[1] / n, dir[2] / n];
  const f: V3 = [-d0[0], -d0[1], -d0[2]];
  // right = forward x world up; straight down: +x (three's lookAt from a hair south of the target gives the same)
  const rl = Math.hypot(f[2], f[0]);
  const R: V3 = rl < 1e-6 ? [1, 0, 0] : [-f[2] / rl, 0, f[0] / rl];
  const U: V3 = [R[1] * f[2] - R[2] * f[1], R[2] * f[0] - R[0] * f[2], R[0] * f[1] - R[1] * f[0]];
  const t = Math.tan(rad(fovDeg) / 2);
  const c: V3 = [(e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2, (e.z0 + e.z1) / 2];
  const pts = corners(e);
  const fw = Math.max(0.2, 1 - insets.left - insets.right);
  const fh = Math.max(0.2, 1 - insets.top - insets.bottom);
  const nx = insets.left - insets.right;
  const ny = insets.bottom - insets.top;
  // the corners' NDC from a camera at C (looking along f)
  const project = (C: V3) => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    let near = Infinity;
    for (const p of pts) {
      const v: V3 = [p[0] - C[0], p[1] - C[1], p[2] - C[2]];
      const z = dot(v, f);
      near = Math.min(near, z);
      const x = dot(v, R) / (Math.max(z, 1e-3) * t * a);
      const y = dot(v, U) / (Math.max(z, 1e-3) * t);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    return { near, x0, x1, y0, y1 };
  };
  // at distance d: slide the camera (twice: a slide changes the perspective a little) so the box sits centred in the free part
  const place = (d: number) => {
    const shift: V3 = [0, 0, 0];
    let pr = project([c[0] + d0[0] * d, c[1] + d0[1] * d, c[2] + d0[2] * d]);
    for (let k = 0; k < 3; k++) {
      const sx = ((pr.x0 + pr.x1) / 2 - nx) * d * t * a;
      const sy = ((pr.y0 + pr.y1) / 2 - ny) * d * t;
      for (let q = 0; q < 3; q++) shift[q] += R[q] * sx + U[q] * sy;
      pr = project([c[0] + d0[0] * d + shift[0], c[1] + d0[1] * d + shift[1], c[2] + d0[2] * d + shift[2]]);
    }
    const ok = pr.near > 0.5 && (pr.x1 - pr.x0) * pad <= 2 * fw && (pr.y1 - pr.y0) * pad <= 2 * fh;
    return { shift, ok };
  };
  const diag = Math.hypot(e.x1 - e.x0, e.y1 - e.y0, e.z1 - e.z0);
  let lo = 0.5;
  let hi = Math.max(10, diag * 20);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (place(mid).ok) hi = mid;
    else lo = mid;
  }
  const d = Math.max(hi, 4 / (2 * t)); // never closer than a 4 m box would sit (the old fit's floor)
  const { shift } = place(d);
  return { position: [c[0] + d0[0] * d + shift[0], c[1] + d0[1] * d + shift[1], c[2] + d0[2] * d + shift[2]], target: [c[0] + shift[0], c[1] + shift[1], c[2] + shift[2]] };
}

/** PLAN3D-POLISH-2430 (item 6): the glow pool belongs in the scene at the lit levels (2 and 3), and at the schematic level
 * only while a glow holds one of its lights. */
export const glowPoolWanted = (quality: number, anyLit: boolean): boolean => quality >= 2 || anyLit;
