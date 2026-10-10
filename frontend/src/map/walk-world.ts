/**
 * Plan Studio 6, slice S4 (CR-029 section 4): the walk world - what the eye-level walk-through collides with, climbs and
 * starts from, built from the same SceneInput the 3D description is built from. Pure and deterministic (no three, no
 * DOM; the same input gives the same JSON - unit-walk-controller.spec.ts, unit-plan-3d-determinism.spec.ts), every
 * length in metres on the description's axes (x east = plan x, z south = plan y), rounded to 0.1 mm like the parts.
 *
 * - Walls: every wall part of every level (buildPrimitives cuts them at their openings, a curved wall is its sampled
 *   path) blocks the body as a capsule of half its thickness - low walls and railings too (they stop the body, not the
 *   view); a wall whose base is above any eye (a soffit, base >= HEAD_CLEAR_M) or whose top is under the floor does not.
 * - Openings (section 4.3, owner 2026-10-09 Q4): a passage never blocks; a window always does; a door blocks unless its
 *   walk state is passable - open (its entity reports open), unlocked (its entity is a lock that is unlocked) or unsensed
 *   (no entity: walkable, the owner's answer). Closed, locked and STALE (no current state: unknown is not open) block.
 * - Objects block by their footprint when they stand at least OBJECT_BLOCK_H_M tall from the floor, unless the catalog
 *   marks the item walkable (stairs, a tribune, a mat, a parking space) - or, with no flag, the item is circulation.
 * - Bands (stairs, ramps, tribunes): the connector's flights and landings with the ground height along them; their sides
 *   (and the outline of each landing, minus the edges a flight meets) block from the level and on the band. A stair to
 *   another floor ends in a cap at its far mouth: a floor switch is a document load, not a walk (the controller emits it).
 * - Starts (section 4.4): the saved walk positions in order, the first exterior door facing inward, every room's centre
 *   facing its longest wall, every camera at its mount height and tilt; `defaultStart` follows the CR's preference order.
 */
import { buildPrimitives, effectiveScale, floorHeight, objectCorners, stairPlan, stairRise, type GeomConnector, type GeomLevel, type GeomOpening, type Pt } from './geometry';
import { defaultLevelId, levelOrDefault } from './studio-ops';
import { isOpenState } from './coverage';
import { anchor3d } from './anchor-3d';
import type { SceneAnchor, SceneInput } from './scene-builder';

export const WALK_WORLD_VERSION = 'walk-1' as const;
/** A wall whose base is at least this high above its level never meets the body (above the tallest eye, 2.0 m). */
export const HEAD_CLEAR_M = 2.0;
/** Objects this tall or taller block by their footprint (CR-029 section 4.3: a counter does, a mat does not). */
export const OBJECT_BLOCK_H_M = 0.9;
/** An object whose base is this high is above the body (a ceiling lamp, a shelf on the wall, a projector). */
export const OBJECT_BLOCK_BASE_M = 1.0;
/** The pad around a level's walls the walk is clamped to (the soft "קצה התוכנית" edge, section 4.3). */
export const EXTENT_PAD_M = 0.5;
/** How far inside an exterior door the door start stands. */
export const DOOR_START_IN_M = 0.8;

export type DoorWalkState = 'open' | 'unlocked' | 'unsensed' | 'closed' | 'locked' | 'stale';
export type SegKind = 'wall' | 'low' | 'window' | 'door' | 'object' | 'band' | 'cap';
export interface WalkSeg {
  a: [number, number];
  b: [number, number];
  /** Half the thickness (a capsule of this radius around ab). */
  r: number;
  kind: SegKind;
  /** The wall / opening / object / connector id. */
  id: string;
}
export interface WalkDoor {
  id: string;
  level: string;
  /** The gap's ends. */
  a: [number, number];
  b: [number, number];
  state: DoorWalkState;
  passable: boolean;
  entity: string | null;
}
/** One straight run of a band: the ground rises from y0 at a to y1 at b, `width` across. */
export interface WalkRamp {
  a: [number, number];
  b: [number, number];
  width: number;
  y0: number;
  y1: number;
}
export interface WalkBand {
  id: string;
  kind: string;
  /** The level the band leaves from (its first ramp's start) and the level it reaches (null: another floor). */
  from: string;
  to: string | null;
  /** A stair to another floor: the floor id and its name (the "המשך לקומה…" prompt). */
  farFloor: { id: string; name: string | null } | null;
  ramps: WalkRamp[];
  landings: { poly: [number, number][]; y: number }[];
  /** The blocking sides of the band (stair sides, landing edges, the far cap of a stair to another floor). */
  sides: WalkSeg[];
}
export interface WalkLevel {
  id: string;
  name: string;
  elevation_m: number;
  ceiling_height_m: number;
  extent: { minX: number; minZ: number; maxX: number; maxZ: number };
  segs: WalkSeg[];
}
export interface WalkRoom {
  id: string;
  name: string;
  level: string;
  poly: [number, number][];
  centre: [number, number];
}
export type StartKind = 'saved' | 'door' | 'room' | 'camera' | 'centre';
export interface WalkStart {
  id: string;
  kind: StartKind;
  label: string;
  level: string;
  x: number;
  z: number;
  /** Clockwise from plan up (the map's bearing convention). */
  heading_deg: number;
  pitch_deg: number;
  /** A camera's mount height: the eye stands there until the first move (section 4.4 "stand at camera"). */
  eye_m: number | null;
}
export interface WalkWorld {
  version: typeof WALK_WORLD_VERSION;
  scale: number;
  estimated: boolean;
  levels: WalkLevel[];
  bands: WalkBand[];
  doors: WalkDoor[];
  rooms: WalkRoom[];
  starts: WalkStart[];
  defaultStart: string | null;
}
/** What the walk world reads from the catalog: the role and the walkable flag (catalog 2026.10.1). */
export interface WalkCatalogItem {
  role: string;
  walkable?: boolean;
}
export type WalkCatalogLookup = (itemId: string) => WalkCatalogItem | undefined;

export const r4 = (v: number): number => Math.floor(v * 1e4 + 0.5) / 1e4 + 0;
const p4 = (p: readonly [number, number]): [number, number] => [r4(p[0]), r4(p[1])];
const byId = <T extends { id: string }>(a: T, b: T): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const LOCKED = new Set(['locked', 'locking', 'jammed']);
const UNLOCKED = new Set(['unlocked', 'unlocking', 'open', 'opening']);
const STALE = new Set(['unavailable', 'unknown']);

/** The walk state of a door from its bound entity's live state (`states` holds the anchored entities; an id it does not
 * hold is unknown, so stale). Ruling of section 4.3: unknown is never open. */
export function doorWalkState(o: Pick<GeomOpening, 'kind' | 'anchor_ref'>, states: Record<string, string | null>): DoorWalkState {
  const ref = o.anchor_ref;
  if (!ref || ref.resource_type !== 'ha_entity' || !ref.resource_id) return 'unsensed';
  const id = ref.resource_id;
  const s = Object.prototype.hasOwnProperty.call(states, id) ? states[id] : null;
  if (s === null || s === undefined || STALE.has(s)) return 'stale';
  if (id.startsWith('lock.')) return LOCKED.has(s) ? 'locked' : UNLOCKED.has(s) ? 'unlocked' : 'stale';
  return isOpenState(s) ? 'open' : 'closed';
}
export const isPassable = (s: DoorWalkState): boolean => s === 'open' || s === 'unlocked' || s === 'unsensed';
export const DOOR_STATE_HE: Record<DoorWalkState, string> = { open: 'פתוחה', unlocked: 'לא נעולה', unsensed: 'ללא חיישן', closed: 'סגורה', locked: 'נעולה', stale: 'מצב לא ידוע' };

function polyCentroid(poly: [number, number][]): [number, number] {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p[0] * q[1] - q[0] * p[1];
    a += f;
    cx += (p[0] + q[0]) * f;
    cz += (p[1] + q[1]) * f;
  }
  if (Math.abs(a) < 1e-12) {
    const n = poly.length || 1;
    return [poly.reduce((t, p) => t + p[0], 0) / n, poly.reduce((t, p) => t + p[1], 0) / n];
  }
  return [cx / (3 * a), cz / (3 * a)];
}
const polyArea = (poly: [number, number][]): number => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) a += poly[i][0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * poly[i][1];
  return Math.abs(a) / 2;
};
/** The map bearing (clockwise from plan up) of the direction (dx, dz). */
export const bearingOf = (dx: number, dz: number): number => {
  const b = (Math.atan2(dx, -dz) * 180) / Math.PI;
  return r4(((b % 360) + 360) % 360);
};

class WorldBuilder {
  readonly scale: number;
  readonly estimated: boolean;
  readonly levels: GeomLevel[];
  readonly levelMap: Map<string, GeomLevel>;
  constructor(readonly input: SceneInput, readonly catalog: WalkCatalogLookup | null) {
    const s = effectiveScale(input.doc);
    this.scale = s.scale;
    this.estimated = s.estimated;
    const doc = input.doc;
    this.levels = doc.levels.length ? [...doc.levels].sort(byId) : [{ id: defaultLevelId(doc), name: '', elevation_m: 0, ceiling_height_m: 2.8, is_default: true }];
    this.levelMap = new Map(this.levels.map((l) => [l.id, l]));
  }
  m(px: number): number {
    return px * this.scale;
  }
  pt(p: Pt): [number, number] {
    return [r4(this.m(p[0])), r4(this.m(p[1]))];
  }
  /** A normalized point in metres. */
  norm(x: number, y: number): [number, number] {
    return [r4(this.m(x * this.input.width)), r4(this.m(y * this.input.height))];
  }
  levelOf(id: string | null | undefined): GeomLevel {
    const lid = levelOrDefault(this.input.doc, id);
    return this.levelMap.get(lid) ?? this.levels.find((l) => l.is_default) ?? this.levels[0];
  }

  wallsAndDoors(level: GeomLevel, doors: WalkDoor[]): WalkSeg[] {
    const { doc, width, height, entityStates } = this.input;
    const segs: WalkSeg[] = [];
    const walls = new Map(doc.walls.map((w) => [w.id, w]));
    const openings = new Map(doc.openings.map((o) => [o.id, o]));
    const prims = buildPrimitives({ ...doc, objects: [], labels: [], connectors: [] }, width, height, level.id);
    const halfOf = (wallId: string | undefined): number => {
      const w = wallId ? walls.get(wallId) : undefined;
      return r4((w?.thickness_m ?? 0.2) / 2);
    };
    for (const p of prims) {
      if (p.kind === 'wall') {
        const w = walls.get(p.id);
        if (!w) continue;
        const base = w.base_z_m || 0;
        const h = isNum(w.height_m) && w.height_m > 0 ? w.height_m : level.ceiling_height_m - base;
        if (base >= HEAD_CLEAR_M || base + h <= 0.05) continue; // a soffit above every eye, or a wall under the floor
        const kind: SegKind = w.kind === 'low' || w.kind === 'railing' || h < 1.1 ? 'low' : 'wall';
        const r = r4(this.m(p.width) / 2);
        for (let i = 1; i < p.points.length; i++) segs.push({ a: this.pt(p.points[i - 1]), b: this.pt(p.points[i]), r, kind, id: w.id });
      } else if (p.kind === 'window') {
        const o = openings.get(p.id);
        segs.push({ a: this.pt(p.gap[0]), b: this.pt(p.gap[1]), r: halfOf(o?.wall_id), kind: 'window', id: p.id });
      } else if (p.kind === 'door') {
        const o = openings.get(p.id);
        if (!o) continue;
        const state = doorWalkState(o, entityStates);
        const passable = isPassable(state);
        const a = this.pt(p.gap[0]);
        const b = this.pt(p.gap[1]);
        doors.push({ id: o.id, level: level.id, a, b, state, passable, entity: o.anchor_ref?.resource_type === 'ha_entity' ? o.anchor_ref.resource_id : null });
        if (!passable) segs.push({ a, b, r: halfOf(o.wall_id), kind: 'door', id: o.id });
      }
    }
    return segs;
  }

  objectSegs(level: GeomLevel): WalkSeg[] {
    const { doc, width, height } = this.input;
    const out: WalkSeg[] = [];
    for (const o of [...doc.objects].sort(byId)) {
      if (this.levelOf(o.level_id).id !== level.id || !o.size) continue;
      const item = this.catalog?.(o.item_id);
      const walkable = item?.walkable ?? item?.role === 'circulation';
      if (walkable) continue;
      const z = isNum(o.z_m) ? o.z_m : 0;
      if (z < 0 || z >= OBJECT_BLOCK_BASE_M || !(o.size.h_m >= OBJECT_BLOCK_H_M)) continue; // a ceiling item (z from the ceiling), a raised one, a low one
      const c = objectCorners(o, width, height, this.scale).map((q) => this.pt(q));
      for (let i = 0; i < 4; i++) out.push({ a: c[i], b: c[(i + 1) % 4], r: 0, kind: 'object', id: o.id });
    }
    return out;
  }

  extent(level: GeomLevel, segs: WalkSeg[]): WalkLevel['extent'] {
    const W = r4(this.m(this.input.width));
    const D = r4(this.m(this.input.height));
    const pts = segs.filter((s) => s.kind !== 'object').flatMap((s) => [s.a, s.b]);
    for (const z of this.input.zones ?? []) if (this.levelOf(z.level_id).id === level.id) for (const q of z.polygon) pts.push(this.norm(q.x, q.y));
    if (!pts.length) return { minX: 0, minZ: 0, maxX: W, maxZ: D };
    return {
      minX: r4(Math.max(0, Math.min(...pts.map((p) => p[0])) - EXTENT_PAD_M)), minZ: r4(Math.max(0, Math.min(...pts.map((p) => p[1])) - EXTENT_PAD_M)),
      maxX: r4(Math.min(W, Math.max(...pts.map((p) => p[0])) + EXTENT_PAD_M)), maxZ: r4(Math.min(D, Math.max(...pts.map((p) => p[1])) + EXTENT_PAD_M)),
    };
  }

  /** One band per walkable connector: its ramps (flights / polyline runs) with the ground height and its blocking sides. */
  band(c: GeomConnector): WalkBand | null {
    if (c.kind === 'elevator' || c.kind === 'ladder' || c.polyline.length < 2) return null;
    const { doc, width, height } = this.input;
    const from = this.levelOf(c.level_from);
    const cross = !!c.floor_ids?.length;
    const to = !cross && c.level_to ? this.levelMap.get(c.level_to) ?? null : null;
    if (!cross && !to) return null;
    const rise = stairRise(this.levelMap, c, floorHeight(doc));
    const e0 = from.elevation_m;
    const plan = stairPlan(c, width, height, this.scale);
    const ramps: WalkRamp[] = [];
    const landings: WalkBand['landings'] = [];
    if (plan && plan.flights.length) {
      const total = plan.flights.reduce((n, f) => n + f.steps, 0) || 1;
      let done = 0;
      plan.flights.forEach((f, i) => {
        const y0 = e0 + (rise * done) / total;
        done += f.steps;
        const y1 = e0 + (rise * done) / total;
        ramps.push({ a: this.pt(f.from), b: this.pt(f.to), width: r4(c.width_m), y0: r4(y0), y1: r4(y1) });
        const landing = plan.landings[i];
        if (landing && i < plan.flights.length - 1) landings.push({ poly: landing.map((q) => this.pt(q)), y: r4(y1) });
      });
    } else {
      const pts = c.polyline.map((q) => this.norm(q[0], q[1]));
      const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
      const L = lens.reduce((t, v) => t + v, 0);
      if (L < 1e-3) return null;
      let s = 0;
      pts.slice(1).forEach((q, i) => {
        const y0 = e0 + (rise * s) / L;
        s += lens[i];
        if (lens[i] > 1e-4) ramps.push({ a: pts[i], b: q, width: r4(c.width_m), y0: r4(y0), y1: r4(e0 + (rise * s) / L) });
      });
    }
    if (!ramps.length) return null;
    const sides: WalkSeg[] = [];
    for (const rp of ramps) {
      const L = Math.hypot(rp.b[0] - rp.a[0], rp.b[1] - rp.a[1]) || 1;
      const n: [number, number] = [-(rp.b[1] - rp.a[1]) / L, (rp.b[0] - rp.a[0]) / L];
      for (const sgn of [-1, 1]) {
        const o: [number, number] = [n[0] * sgn * (rp.width / 2), n[1] * sgn * (rp.width / 2)];
        sides.push({ a: p4([rp.a[0] + o[0], rp.a[1] + o[1]]), b: p4([rp.b[0] + o[0], rp.b[1] + o[1]]), r: 0, kind: 'band', id: c.id });
      }
    }
    // a landing's edges block except where a flight meets it (the edge's midpoint at a ramp's mouth)
    const mouths = ramps.flatMap((rp) => [rp.a, rp.b]);
    for (const l of landings) {
      for (let i = 0; i < l.poly.length; i++) {
        const a = l.poly[i];
        const b = l.poly[(i + 1) % l.poly.length];
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (mouths.some((q) => Math.hypot(q[0] - mid[0], q[1] - mid[1]) < 0.05 + c.width_m * 0.05)) continue;
        sides.push({ a, b, r: 0, kind: 'band', id: c.id });
      }
    }
    let farFloor: WalkBand['farFloor'] = null;
    if (cross) {
      const last = ramps[ramps.length - 1];
      const L = Math.hypot(last.b[0] - last.a[0], last.b[1] - last.a[1]) || 1;
      const n: [number, number] = [-(last.b[1] - last.a[1]) / L, (last.b[0] - last.a[0]) / L];
      const h = last.width / 2;
      sides.push({ a: p4([last.b[0] + n[0] * h, last.b[1] + n[1] * h]), b: p4([last.b[0] - n[0] * h, last.b[1] - n[1] * h]), r: 0, kind: 'cap', id: c.id });
      farFloor = { id: c.far?.floor_id ?? c.floor_ids[0], name: c.far?.floor_name ?? null };
    }
    return { id: c.id, kind: c.kind, from: from.id, to: to ? to.id : null, farFloor, ramps, landings, sides };
  }

  rooms(): WalkRoom[] {
    const out: WalkRoom[] = [];
    for (const z of [...(this.input.zones ?? [])].sort(byId)) {
      if (z.polygon.length < 3) continue;
      const poly = z.polygon.map((q) => this.norm(q.x, q.y));
      out.push({ id: z.id, name: z.name, level: this.levelOf(z.level_id).id, poly, centre: p4(polyCentroid(poly)) });
    }
    return out;
  }

  starts(levels: WalkLevel[], doors: WalkDoor[], rooms: WalkRoom[]): { starts: WalkStart[]; defaultStart: string | null } {
    const { doc } = this.input;
    const starts: WalkStart[] = [];
    const saved = doc.walk_positions ?? [];
    for (const p of saved) {
      const [x, z] = this.norm(p.x, p.y);
      starts.push({ id: `pos:${p.id}`, kind: 'saved', label: p.name, level: this.levelOf(p.level_id).id, x, z, heading_deg: r4(p.heading_deg), pitch_deg: 0, eye_m: null });
    }
    const walls = new Map(doc.walls.map((w) => [w.id, w]));
    const openingWall = new Map(doc.openings.map((o) => [o.id, o.wall_id]));
    const levelById = new Map(levels.map((l) => [l.id, l]));
    let doorStart: string | null = null;
    for (const d of [...doors].sort(byId)) {
      const w = walls.get(openingWall.get(d.id) ?? '');
      if (w?.kind !== 'exterior') continue;
      const lv = levelById.get(d.level);
      if (!lv) continue;
      const mid: [number, number] = [(d.a[0] + d.b[0]) / 2, (d.a[1] + d.b[1]) / 2];
      const L = Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]) || 1;
      let n: [number, number] = [-(d.b[1] - d.a[1]) / L, (d.b[0] - d.a[0]) / L];
      // inward: toward the middle of the level's rooms (else of its extent)
      const own = rooms.filter((r) => r.level === lv.id);
      const ref: [number, number] = own.length ? [own.reduce((t, r) => t + r.centre[0], 0) / own.length, own.reduce((t, r) => t + r.centre[1], 0) / own.length] : [(lv.extent.minX + lv.extent.maxX) / 2, (lv.extent.minZ + lv.extent.maxZ) / 2];
      if ((ref[0] - mid[0]) * n[0] + (ref[1] - mid[1]) * n[1] < 0) n = [-n[0], -n[1]];
      const id = `door:${d.id}`;
      starts.push({ id, kind: 'door', label: 'דלת כניסה', level: d.level, x: r4(mid[0] + n[0] * DOOR_START_IN_M), z: r4(mid[1] + n[1] * DOOR_START_IN_M), heading_deg: bearingOf(n[0], n[1]), pitch_deg: 0, eye_m: null });
      doorStart ??= id;
    }
    let largest: { id: string; area: number } | null = null;
    const defaultLevel = this.levelOf(null).id;
    for (const r of rooms) {
      // facing the longest wall: the bearing from the centre to the midpoint of the longest edge
      let best = -1;
      let mid: [number, number] = r.centre;
      for (let i = 0; i < r.poly.length; i++) {
        const a = r.poly[i];
        const b = r.poly[(i + 1) % r.poly.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len > best + 1e-9) {
          best = len;
          mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        }
      }
      const id = `room:${r.id}`;
      starts.push({ id, kind: 'room', label: r.name || 'חדר', level: r.level, x: r.centre[0], z: r.centre[1], heading_deg: bearingOf(mid[0] - r.centre[0], mid[1] - r.centre[1]), pitch_deg: 0, eye_m: null });
      const area = polyArea(r.poly);
      if (r.level === defaultLevel && (!largest || area > largest.area + 1e-9)) largest = { id, area };
    }
    for (const a of [...this.input.anchors].filter((x: SceneAnchor) => x.resource_type === 'camera').sort(byId)) {
      const { mount_height_m: mount, tilt_deg: tilt } = anchor3d(a);
      const [x, z] = this.norm(a.x, a.y);
      starts.push({ id: `cam:${a.id}`, kind: 'camera', label: a.label, level: this.levelOf(a.level_id).id, x, z, heading_deg: r4(((a.rotation % 360) + 360) % 360), pitch_deg: r4(-tilt), eye_m: r4(mount) });
    }
    const lv0 = levelById.get(defaultLevel) ?? levels[0];
    if (lv0) starts.push({ id: 'centre', kind: 'centre', label: 'מרכז התוכנית', level: lv0.id, x: r4((lv0.extent.minX + lv0.extent.maxX) / 2), z: r4((lv0.extent.minZ + lv0.extent.maxZ) / 2), heading_deg: 0, pitch_deg: 0, eye_m: null });
    const savedDefault = saved.find((p) => p.is_default) ?? saved[0];
    const defaultStart = savedDefault ? `pos:${savedDefault.id}` : doorStart ?? largest?.id ?? (lv0 ? 'centre' : null);
    return { starts, defaultStart };
  }
}

/** The walk world of a floor (see the module note). `catalog` answers role / walkable per item id (null = nothing is walkable
 * by catalog; circulation still is when the lookup has no flag). The level filter of the input is ignored: the walk needs
 * every level (a stair leads to the next one). */
export function buildWalkWorld(input: SceneInput, catalog: WalkCatalogLookup | null = null): WalkWorld {
  const b = new WorldBuilder(input, catalog);
  const doors: WalkDoor[] = [];
  const levels: WalkLevel[] = b.levels.map((lv) => {
    const segs = [...b.wallsAndDoors(lv, doors), ...b.objectSegs(lv)];
    return { id: lv.id, name: lv.name ?? '', elevation_m: r4(lv.elevation_m), ceiling_height_m: r4(lv.ceiling_height_m), extent: b.extent(lv, segs), segs };
  });
  const bands = [...input.doc.connectors].sort(byId).map((c) => b.band(c)).filter((x): x is WalkBand => !!x);
  const rooms = b.rooms();
  doors.sort(byId);
  const { starts, defaultStart } = b.starts(levels, doors, rooms);
  return { version: WALK_WORLD_VERSION, scale: b.scale, estimated: b.estimated, levels, bands, doors, rooms, starts, defaultStart };
}
