/**
 * Plan Studio 6, slice S4 (CR-029 section 4): the eye-level walk controller - pure state and maths, no three, no DOM.
 * A 0.28 m body circle slides along the blocking capsules of its level (walk-world.ts: walls, windows, doors that are not
 * passable, tall objects, the sides of stairs); on a stair / ramp band only the band's sides count and the ground follows
 * the band; leaving a band at its far mouth switches the level (an event: the view fires `level-select`), a stair to
 * another floor stops at its cap and emits the "continue to the floor" event instead. Tap-to-walk is an A* on a 0.25 m
 * grid of the level (open doors are open cells: their gaps are not in the segment list), then string-pulled.
 *
 * Determinism (design rule 4): the same world, the same start and the same sequence of (dt, input) give the same poses -
 * a frame is cut into fixed sub-steps of at most SUB_DT, so the collision never tunnels through a wall at a low frame rate
 * and the result does not depend on the order of anything but the input. Heading is the map's bearing (clockwise from plan
 * up, the camera anchors' convention); forward is (sin h, -cos h) on the description's axes (x east, z south).
 */
import { bearingOf, type WalkBand, type WalkDoor, type WalkRamp, type WalkRoom, type WalkSeg, type WalkStart, type WalkWorld } from './walk-world';

export const BODY_R = 0.28;
export const WALK_SPEED = 1.4;
export const RUN_SPEED = 2.8;
export const TURN_DEG_S = 120;
export const AUTO_TURN_DEG_S = 220;
export const MAX_DT = 0.1;
export const SUB_DT = 1 / 60;
export const GRID_M = 0.25;
export const PITCH_LIMIT_DEG = 70;
export const EYE_RANGE: readonly [number, number] = [1.2, 2.0];
export const DEFAULT_EYE_M = 1.65;
/** The level switch window at a band's mouth (CR-029 section 4.3). */
export const MOUTH_M = 0.02;
/** How close to a stair-to-another-floor's cap the prompt appears. */
export const CROSS_PROMPT_M = 0.45;
/** The soft edge of the plan: the body stays this far inside the level's extent. */
export const EDGE_M = 0.3;
const MAX_ASTAR_CELLS = 400_000;

export interface WalkInput {
  /** -1..1: backward .. forward. */
  forward: number;
  /** -1..1: left .. right. */
  strafe: number;
  /** -1..1: turn left .. right (continuous, TURN_DEG_S at 1). */
  turn: number;
  run: boolean;
}
export const NO_INPUT: WalkInput = { forward: 0, strafe: 0, turn: 0, run: false };
export type WalkEvent =
  | { type: 'level'; level: string }
  | { type: 'cross-floor'; band: string; floor: { id: string; name: string | null } }
  | { type: 'blocked'; door: WalkDoor }
  | { type: 'edge' }
  | { type: 'room'; room: WalkRoom | null }
  | { type: 'arrived' };
export interface WalkPose {
  x: number;
  /** The eye's height in the scene (ground + eye). */
  y: number;
  z: number;
  heading_deg: number;
  pitch_deg: number;
  level: string;
  /** The ground under the eye and the band the body stands on (null = the level's floor). */
  ground: number;
  band: string | null;
}
interface Ground {
  y: number;
  band: WalkBand | null;
  ramp: number;
  along: number;
}

const wrap180 = (d: number): number => {
  let x = ((d + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
};
const wrap360 = (d: number): number => ((d % 360) + 360) % 360;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const r4 = (v: number): number => Math.round(v * 1e4) / 1e4 + 0;

/** The distance from p to the segment ab and the closest point on it. */
function closest(px: number, pz: number, s: WalkSeg): { d: number; cx: number; cz: number } {
  const ex = s.b[0] - s.a[0];
  const ez = s.b[1] - s.a[1];
  const l2 = ex * ex + ez * ez;
  const u = l2 > 0 ? clamp(((px - s.a[0]) * ex + (pz - s.a[1]) * ez) / l2, 0, 1) : 0;
  const cx = s.a[0] + u * ex;
  const cz = s.a[1] + u * ez;
  return { d: Math.hypot(px - cx, pz - cz), cx, cz };
}

function inPoly(x: number, z: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** A small binary heap of [f, cell] (ties by cell index: deterministic). */
class Heap {
  private f: number[] = [];
  private k: number[] = [];
  get size(): number {
    return this.k.length;
  }
  private less(i: number, j: number): boolean {
    return this.f[i] < this.f[j] || (this.f[i] === this.f[j] && this.k[i] < this.k[j]);
  }
  private swap(i: number, j: number): void {
    [this.f[i], this.f[j]] = [this.f[j], this.f[i]];
    [this.k[i], this.k[j]] = [this.k[j], this.k[i]];
  }
  push(f: number, k: number): void {
    this.f.push(f);
    this.k.push(k);
    let i = this.k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.k[0];
    const lf = this.f.pop()!;
    const lk = this.k.pop()!;
    if (this.k.length) {
      this.f[0] = lf;
      this.k[0] = lk;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.k.length && this.less(l, m)) m = l;
        if (r < this.k.length && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
}

export class WalkController {
  world!: WalkWorld;
  x = 0;
  z = 0;
  heading = 0;
  pitch = 0;
  level = '';
  /** The eye above the ground now (eased toward eyeTarget) and the setting. */
  eye = DEFAULT_EYE_M;
  eyeTarget = DEFAULT_EYE_M;
  /** A camera's mount height held until the first move (section 4.4). */
  private eyeHold: number | null = null;
  /** The auto-walk waypoints (tap-to-walk). */
  path: [number, number][] | null = null;
  private levels = new Map<string, WalkWorld['levels'][number]>();
  private doors = new Map<string, WalkDoor>();
  private room: string | null | undefined = undefined;
  private crossShown: string | null = null;
  private edge = false;
  private blockedDoor: string | null = null;

  constructor(world: WalkWorld, opts: { eye_m?: number } = {}) {
    this.setEyeHeight(opts.eye_m ?? DEFAULT_EYE_M, true);
    this.setWorld(world);
    const start = world.starts.find((s) => s.id === world.defaultStart) ?? world.starts[0];
    if (start) this.place(start);
    else this.level = world.levels[0]?.id ?? '';
  }

  /** A new world for the same floor (a door opened, a level filter changed the description): the pose stays. */
  setWorld(world: WalkWorld): void {
    this.world = world;
    this.levels = new Map(world.levels.map((l) => [l.id, l]));
    this.doors = new Map(world.doors.map((d) => [d.id, d]));
    if (this.level && !this.levels.has(this.level)) this.level = world.levels[0]?.id ?? '';
  }

  setEyeHeight(m: number, now = false): void {
    this.eyeTarget = clamp(Number.isFinite(m) ? m : DEFAULT_EYE_M, EYE_RANGE[0], EYE_RANGE[1]);
    if (now) this.eye = this.eyeTarget;
  }

  /** Stand at a start point (a saved position, a door, a room, a camera); the body is pushed out of any wall it lands in. */
  place(s: WalkStart): WalkEvent[] {
    const events: WalkEvent[] = [];
    if (s.level !== this.level && this.levels.has(s.level)) events.push({ type: 'level', level: s.level });
    this.level = this.levels.has(s.level) ? s.level : this.level || this.world.levels[0]?.id || '';
    this.heading = wrap360(s.heading_deg);
    this.pitch = clamp(s.pitch_deg, -PITCH_LIMIT_DEG, PITCH_LIMIT_DEG);
    this.path = null;
    this.crossShown = null;
    this.eyeHold = s.eye_m;
    if (s.eye_m !== null) this.eye = s.eye_m; // a teleport (with the view's fade): the eye is at the camera at once
    this.x = s.x;
    this.z = s.z;
    if (s.kind !== 'camera') {
      const [x, z] = this.collide(s.x, s.z, this.segmentsFor(this.level, !!this.ground(s.x, s.z, this.level).band)).p;
      this.x = x;
      this.z = z;
    }
    this.noteRoom(events);
    return events;
  }

  /** Teleport to metres (x, z) on a level, heading kept unless given (the numeric walk fields, the minimap). */
  placeAt(x: number, z: number, level = this.level, heading: number = this.heading): WalkEvent[] {
    return this.place({ id: 'at', kind: 'centre', label: '', level, x, z, heading_deg: heading, pitch_deg: this.pitch, eye_m: null });
  }

  look(dHeadingDeg: number, dPitchDeg: number): void {
    this.heading = wrap360(this.heading + dHeadingDeg);
    this.pitch = clamp(this.pitch + dPitchDeg, -PITCH_LIMIT_DEG, PITCH_LIMIT_DEG);
  }

  /** The ground under (x, z) seen from `level`: a band touching the level (its ramp interpolated, its landing flat), else the floor. */
  ground(x: number, z: number, level: string): Ground {
    const L = this.levels.get(level);
    for (const b of this.world.bands) {
      if (b.from !== level && b.to !== level) continue;
      for (let i = 0; i < b.ramps.length; i++) {
        const rp = b.ramps[i];
        const dx = rp.b[0] - rp.a[0];
        const dz = rp.b[1] - rp.a[1];
        const len = Math.hypot(dx, dz);
        if (len < 1e-6) continue;
        const ux = dx / len;
        const uz = dz / len;
        const px = x - rp.a[0];
        const pz = z - rp.a[1];
        const along = px * ux + pz * uz;
        const across = Math.abs(-px * uz + pz * ux);
        if (across <= rp.width / 2 && along >= -0.05 && along <= len + 0.05) {
          const f = clamp(along / len, 0, 1);
          return { y: rp.y0 + (rp.y1 - rp.y0) * f, band: b, ramp: i, along };
        }
      }
      for (const l of b.landings) if (inPoly(x, z, l.poly)) return { y: l.y, band: b, ramp: -1, along: 0 };
    }
    return { y: L?.elevation_m ?? 0, band: null, ramp: -1, along: 0 };
  }

  /** The capsules that stop the body: on a band only the sides of the bands of the level; else the level's own and the band sides. */
  segmentsFor(level: string, onBand: boolean): WalkSeg[] {
    const sides = this.world.bands.filter((b) => b.from === level || b.to === level).flatMap((b) => b.sides);
    if (onBand) return sides;
    return [...(this.levels.get(level)?.segs ?? []), ...sides];
  }

  /** Push (x, z) out of every capsule (three passes for a corner); `hit` = the first segment that pushed. */
  collide(x: number, z: number, segs: WalkSeg[]): { p: [number, number]; hit: WalkSeg | null } {
    let hit: WalkSeg | null = null;
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      for (const s of segs) {
        const r = BODY_R + s.r;
        const c = closest(x, z, s);
        if (c.d >= r) continue;
        let nx: number;
        let nz: number;
        if (c.d < 1e-9) {
          const ex = s.b[0] - s.a[0];
          const ez = s.b[1] - s.a[1];
          const n = Math.hypot(ex, ez) || 1;
          nx = -ez / n;
          nz = ex / n;
        } else {
          nx = (x - c.cx) / c.d;
          nz = (z - c.cz) / c.d;
        }
        x = c.cx + nx * (r + 1e-4);
        z = c.cz + nz * (r + 1e-4);
        pushed = true;
        hit ??= s;
      }
      if (!pushed) break;
    }
    return { p: [x, z], hit };
  }

  /** Advance by `dt` seconds with `input` (the auto-walk path, when set, drives instead of forward / strafe). */
  step(dt: number, input: WalkInput = NO_INPUT): WalkEvent[] {
    const events: WalkEvent[] = [];
    const total = clamp(Number.isFinite(dt) ? dt : 0, 0, MAX_DT);
    const n = Math.max(1, Math.ceil(total / SUB_DT - 1e-9));
    for (let i = 0; i < n; i++) this.sub(total / n, input, events);
    // the eye: a camera's mount height until the first move, then eased to the setting (LOOK_SPEC 8: dt x 6)
    const want = this.eyeHold ?? this.eyeTarget;
    this.eye += (want - this.eye) * Math.min(1, total * 6);
    if (Math.abs(want - this.eye) < 1e-4) this.eye = want;
    return events;
  }

  private sub(dt: number, input: WalkInput, events: WalkEvent[]): void {
    if (input.turn) this.heading = wrap360(this.heading + clamp(input.turn, -1, 1) * TURN_DEG_S * dt);
    let fwd = clamp(input.forward, -1, 1);
    let strafe = clamp(input.strafe, -1, 1);
    let run = input.run;
    if (fwd || strafe) this.path = null; // a key takes over from the auto-walk
    else if (this.path && this.path.length) {
      const [tx, tz] = this.path[0];
      const d = Math.hypot(tx - this.x, tz - this.z);
      if (d < 0.15) {
        this.path.shift();
        if (!this.path.length) {
          this.path = null;
          events.push({ type: 'arrived' });
        }
        return;
      }
      const diff = wrap180(bearingOf(tx - this.x, tz - this.z) - this.heading);
      this.heading = wrap360(this.heading + Math.sign(diff) * Math.min(Math.abs(diff), AUTO_TURN_DEG_S * dt));
      fwd = Math.abs(diff) < 35 ? 1 : 0.2;
      strafe = 0;
      run = false;
    }
    if (!fwd && !strafe) return;
    const h = (this.heading * Math.PI) / 180;
    const speed = run ? RUN_SPEED : WALK_SPEED;
    const mag = Math.min(1, Math.hypot(fwd, strafe));
    const len = Math.hypot(fwd, strafe) || 1;
    const fx = Math.sin(h);
    const fz = -Math.cos(h);
    const rx = Math.cos(h);
    const rz = Math.sin(h);
    let nx = this.x + ((fx * fwd + rx * strafe) / len) * mag * speed * dt;
    let nz = this.z + ((fz * fwd + rz * strafe) / len) * mag * speed * dt;
    const g0 = this.ground(this.x, this.z, this.level);
    const onBand = !!g0.band && !!this.ground(nx, nz, this.level).band;
    const res = this.collide(nx, nz, this.segmentsFor(this.level, onBand));
    [nx, nz] = res.p;
    if (res.hit && res.hit.kind === 'door') {
      if (this.blockedDoor !== res.hit.id) {
        const door = this.doors.get(res.hit.id);
        if (door) events.push({ type: 'blocked', door });
      }
      this.blockedDoor = res.hit.id;
    } else this.blockedDoor = null;
    const L = this.levels.get(this.level);
    // on a band its sides hold the body; the level's extent may not reach the band's far end (a stair arriving from
    // outside the upper level's walls), so it does not clamp there
    if (L && !this.ground(nx, nz, this.level).band) {
      const e = L.extent;
      const cx = clamp(nx, e.minX + EDGE_M, Math.max(e.minX + EDGE_M, e.maxX - EDGE_M));
      const cz = clamp(nz, e.minZ + EDGE_M, Math.max(e.minZ + EDGE_M, e.maxZ - EDGE_M));
      const edge = cx !== nx || cz !== nz;
      if (edge && !this.edge) events.push({ type: 'edge' });
      this.edge = edge;
      nx = cx;
      nz = cz;
    }
    if (Math.abs(nx - this.x) > 1e-7 || Math.abs(nz - this.z) > 1e-7) this.eyeHold = null; // the first step leaves the camera's mount height
    this.x = nx;
    this.z = nz;
    // the level switch at a band's mouth, judged from the band stood on BEFORE the step as well as after it, so a long step
    // at a low frame rate cannot jump over the switch window
    const g = this.ground(this.x, this.z, this.level);
    const band = g.band ?? g0.band;
    if (band) {
      const lastIdx = band.ramps.length - 1;
      // the mouths are judged only on their own ramp (the flights of a U run side by side: a point on the first flight
      // projects near the end of the second)
      const onRamp = (i: number): boolean => (g.band === band && g.ramp === i) || (g0.band === band && g0.ramp === i);
      const last = band.ramps[lastIdx];
      const lastLen = Math.hypot(last.b[0] - last.a[0], last.b[1] - last.a[1]);
      const alongLast = onRamp(lastIdx) ? this.alongOf(last) : -Infinity;
      const alongFirst = onRamp(0) ? this.alongOf(band.ramps[0]) : Infinity;
      if (band.to && this.level === band.from && alongLast > lastLen - MOUTH_M) this.switchLevel(band.to, events);
      else if (band.to && this.level === band.to && alongFirst < MOUTH_M) this.switchLevel(band.from, events);
      if (band.farFloor && alongLast > lastLen - CROSS_PROMPT_M && this.crossShown !== band.id) {
        this.crossShown = band.id;
        events.push({ type: 'cross-floor', band: band.id, floor: band.farFloor });
      } else if (band.farFloor && alongLast <= lastLen - CROSS_PROMPT_M - 0.3) this.crossShown = null;
    }
    this.noteRoom(events);
  }

  private alongOf(rp: WalkRamp): number {
    const dx = rp.b[0] - rp.a[0];
    const dz = rp.b[1] - rp.a[1];
    const len = Math.hypot(dx, dz) || 1;
    return ((this.x - rp.a[0]) * dx + (this.z - rp.a[1]) * dz) / len;
  }

  private switchLevel(id: string, events: WalkEvent[]): void {
    if (id === this.level || !this.levels.has(id)) return;
    this.level = id;
    events.push({ type: 'level', level: id });
  }

  private noteRoom(events: WalkEvent[]): void {
    const r = this.world.rooms.find((q) => q.level === this.level && inPoly(this.x, this.z, q.poly)) ?? null;
    const id = r?.id ?? null;
    if (id !== this.room) {
      if (this.room !== undefined) events.push({ type: 'room', room: r });
      this.room = id;
    }
  }

  /** The pose the view draws (rounded to 0.1 mm / 0.001 deg so a JSON comparison is stable). */
  pose(): WalkPose {
    const g = this.ground(this.x, this.z, this.level);
    return { x: r4(this.x), y: r4(g.y + this.eye), z: r4(this.z), heading_deg: Math.round(this.heading * 1000) / 1000 + 0, pitch_deg: Math.round(this.pitch * 1000) / 1000 + 0, level: this.level, ground: r4(g.y), band: g.band?.id ?? null };
  }

  /** Whether a straight walk from a to b keeps the body (slightly slimmer) clear of every segment. */
  lineFree(a: [number, number], b: [number, number], segs: WalkSeg[]): boolean {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) return true;
    const n = Math.max(2, Math.ceil(len / 0.1));
    for (let i = 0; i <= n; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / n;
      const z = a[1] + ((b[1] - a[1]) * i) / n;
      for (const s of segs) if (closest(x, z, s).d < BODY_R * 0.8 + s.r) return false;
    }
    return true;
  }

  /** Tap-to-walk: an A* path on a GRID_M grid of the current level to (tx, tz), string-pulled; the path is set and
   * returned (null = unreachable, or the level too large for the grid). A blocked target takes the nearest free cell. */
  pathTo(tx: number, tz: number): [number, number][] | null {
    const L = this.levels.get(this.level);
    if (!L) return null;
    const ex = L.extent;
    const cols = Math.max(1, Math.ceil((ex.maxX - ex.minX) / GRID_M));
    const rows = Math.max(1, Math.ceil((ex.maxZ - ex.minZ) / GRID_M));
    if (cols * rows > MAX_ASTAR_CELLS) return null;
    const segs = this.segmentsFor(this.level, false);
    const blocked = new Uint8Array(cols * rows);
    const rad = BODY_R * 0.85;
    // rasterise each capsule into the cells of its bounding box only (never cells x segments)
    for (const s of segs) {
      const rr = rad + s.r;
      const i0 = Math.max(0, Math.floor((Math.min(s.a[0], s.b[0]) - rr - ex.minX) / GRID_M));
      const i1 = Math.min(cols - 1, Math.floor((Math.max(s.a[0], s.b[0]) + rr - ex.minX) / GRID_M));
      const j0 = Math.max(0, Math.floor((Math.min(s.a[1], s.b[1]) - rr - ex.minZ) / GRID_M));
      const j1 = Math.min(rows - 1, Math.floor((Math.max(s.a[1], s.b[1]) + rr - ex.minZ) / GRID_M));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = j * cols + i;
        if (blocked[k]) continue;
        if (closest(ex.minX + (i + 0.5) * GRID_M, ex.minZ + (j + 0.5) * GRID_M, s).d < rr) blocked[k] = 1;
      }
    }
    const cell = (x: number, z: number): [number, number] => [clamp(Math.floor((x - ex.minX) / GRID_M), 0, cols - 1), clamp(Math.floor((z - ex.minZ) / GRID_M), 0, rows - 1)];
    const [si, sj] = cell(this.x, this.z);
    let [ti, tj] = cell(tx, tz);
    let goalX = tx;
    let goalZ = tz;
    if (blocked[tj * cols + ti]) {
      let best: { i: number; j: number; d: number } | null = null;
      for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) {
        const i = ti + di;
        const j = tj + dj;
        if (i < 0 || j < 0 || i >= cols || j >= rows || blocked[j * cols + i]) continue;
        const d = di * di + dj * dj;
        if (!best || d < best.d) best = { i, j, d };
      }
      if (!best) return null;
      ti = best.i;
      tj = best.j;
      goalX = ex.minX + (ti + 0.5) * GRID_M;
      goalZ = ex.minZ + (tj + 0.5) * GRID_M;
    }
    const start = sj * cols + si;
    const goal = tj * cols + ti;
    const g = new Float64Array(cols * rows).fill(Infinity);
    const from = new Int32Array(cols * rows).fill(-1);
    const closed = new Uint8Array(cols * rows);
    const h = (i: number, j: number): number => Math.hypot(i - ti, j - tj);
    const open = new Heap();
    g[start] = 0;
    open.push(h(si, sj), start);
    const steps: [number, number, number][] = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (open.size) {
      const cur = open.pop();
      if (closed[cur]) continue;
      if (cur === goal) break;
      closed[cur] = 1;
      const ci = cur % cols;
      const cj = (cur - ci) / cols;
      for (const [di, dj, cost] of steps) {
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const nk = nj * cols + ni;
        if (blocked[nk] || closed[nk]) continue;
        if (di && dj && (blocked[cj * cols + ni] || blocked[nj * cols + ci])) continue; // no corner cutting
        const ng = g[cur] + cost;
        if (ng < g[nk] - 1e-12) {
          g[nk] = ng;
          from[nk] = cur;
          open.push(ng + h(ni, nj), nk);
        }
      }
    }
    if (goal !== start && from[goal] < 0) return null;
    const pts: [number, number][] = [];
    for (let k = goal; k >= 0 && k !== start; k = from[k]) pts.push([ex.minX + ((k % cols) + 0.5) * GRID_M, ex.minZ + (Math.floor(k / cols) + 0.5) * GRID_M]);
    pts.reverse();
    pts.push([goalX, goalZ]);
    // string-pull: from where we stand, jump to the farthest waypoint a straight walk reaches
    const out: [number, number][] = [];
    let cur: [number, number] = [this.x, this.z];
    let idx = 0;
    while (idx < pts.length) {
      let far = idx;
      for (let j = pts.length - 1; j > idx; j--) {
        if (this.lineFree(cur, pts[j], segs)) {
          far = j;
          break;
        }
      }
      out.push([r4(pts[far][0]), r4(pts[far][1])]);
      cur = pts[far];
      idx = far + 1;
    }
    this.path = out;
    return out;
  }
}
