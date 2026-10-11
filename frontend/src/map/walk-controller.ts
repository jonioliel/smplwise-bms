/**
 * Plan Studio 6, slice S4 (CR-029 section 4): the eye-level walk controller - pure state and maths, no three, no DOM.
 * A 0.28 m body circle slides along the blocking capsules of its level (walk-world.ts: walls, windows, doors that are not
 * passable, tall objects, the sides of stairs); on a stair / ramp band only the band's sides count and the ground follows
 * the band; leaving a band at its far mouth switches the level (an event: the view fires `level-select`), a stair to
 * another floor stops at its cap and emits the "continue to the floor" event instead. Tap-to-walk is an A* on a 0.25 m
 * grid of the level (walk-path.ts: open doors are open cells, their gaps are not in the segment list), then string-pulled;
 * the auto-walk is cancelled when a new world blocks one of its legs (a door that closed) and when the body stops making
 * progress (S5-A: a tap on a phone has no key to take over with).
 *
 * Determinism (design rule 4): the same world, the same start and the same sequence of (dt, input) give the same poses -
 * a frame is cut into fixed sub-steps of at most SUB_DT, so the collision never tunnels through a wall at a low frame rate
 * and the result does not depend on the order of anything but the input. Heading is the map's bearing (clockwise from plan
 * up, the camera anchors' convention); forward is (sin h, -cos h) on the description's axes (x east, z south).
 */
import { bearingOf, type WalkBand, type WalkDoor, type WalkRamp, type WalkRoom, type WalkSeg, type WalkStart, type WalkWorld } from './walk-world';
import { closestOnSeg as closest, findPath, levelSegments, lineFree as lineFreeOn, pointInPoly as inPoly } from './walk-path';

export { GRID_M } from './walk-path';
export const BODY_R = 0.28;
export const WALK_SPEED = 1.4;
export const RUN_SPEED = 2.8;
export const TURN_DEG_S = 120;
export const AUTO_TURN_DEG_S = 220;
export const MAX_DT = 0.1;
export const SUB_DT = 1 / 60;
export const PITCH_LIMIT_DEG = 70;
export const EYE_RANGE: readonly [number, number] = [1.2, 2.0];
export const DEFAULT_EYE_M = 1.65;
/** The level switch window at a band's mouth (CR-029 section 4.3). */
export const MOUTH_M = 0.02;
/** How close to a stair-to-another-floor's cap the prompt appears. */
export const CROSS_PROMPT_M = 0.45;
/** The soft edge of the plan: the body stays this far inside the level's extent. */
export const EDGE_M = 0.3;
/** An auto-walk whose body moved less than STUCK_MOVE_M within STUCK_S seconds is cancelled (a closed door in the way, a wall). */
export const STUCK_S = 1.2;
export const STUCK_MOVE_M = 0.1;

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
  | { type: 'arrived' }
  /** The auto-walk was cancelled because no open way is left (a new world closed a leg, or the body stopped making progress). */
  | { type: 'path-blocked' };
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
  /** The simulated seconds walked so far, and where / when the auto-walk last made progress (the stuck test). */
  private clock = 0;
  private progress: { x: number; z: number; at: number } | null = null;

  constructor(world: WalkWorld, opts: { eye_m?: number } = {}) {
    this.setEyeHeight(opts.eye_m ?? DEFAULT_EYE_M, true);
    this.setWorld(world);
    const start = world.starts.find((s) => s.id === world.defaultStart) ?? world.starts[0];
    if (start) this.place(start);
    else this.level = world.levels[0]?.id ?? '';
  }

  /** A new world for the same floor (a door opened, a level filter changed the description): the pose stays. An auto-walk
   * whose remaining legs the new world blocks (a door that closed meanwhile) is cancelled: `path-blocked`. */
  setWorld(world: WalkWorld): WalkEvent[] {
    this.world = world;
    this.levels = new Map(world.levels.map((l) => [l.id, l]));
    this.doors = new Map(world.doors.map((d) => [d.id, d]));
    if (this.level && !this.levels.has(this.level)) this.level = world.levels[0]?.id ?? '';
    if (this.path?.length) {
      const segs = levelSegments(world, this.level);
      let from: [number, number] = [this.x, this.z];
      for (const w of this.path) {
        if (!lineFreeOn(from, w, segs, BODY_R)) {
          this.cancelPath();
          return [{ type: 'path-blocked' }];
        }
        from = w;
      }
    }
    return [];
  }

  /** Stop the auto-walk where the body stands (a tap while walking, a key, a stick). */
  cancelPath(): void {
    this.path = null;
    this.progress = null;
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
    this.cancelPath();
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
    this.clock += dt;
    if (input.turn) this.heading = wrap360(this.heading + clamp(input.turn, -1, 1) * TURN_DEG_S * dt);
    let fwd = clamp(input.forward, -1, 1);
    let strafe = clamp(input.strafe, -1, 1);
    let run = input.run;
    if (fwd || strafe) this.cancelPath(); // a key (or the stick) takes over from the auto-walk
    else if (this.path && this.path.length) {
      const [tx, tz] = this.path[0];
      const d = Math.hypot(tx - this.x, tz - this.z);
      if (d < 0.15) {
        this.path.shift();
        if (!this.path.length) {
          this.cancelPath();
          events.push({ type: 'arrived' });
        }
        return;
      }
      // stuck: the body did not move STUCK_MOVE_M in STUCK_S seconds (a door that closed in the way, a wall) - give up
      const pr = this.progress;
      if (!pr || Math.hypot(this.x - pr.x, this.z - pr.z) >= STUCK_MOVE_M) this.progress = { x: this.x, z: this.z, at: this.clock };
      else if (this.clock - pr.at > STUCK_S) {
        this.cancelPath();
        events.push({ type: 'path-blocked' });
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
    return lineFreeOn(a, b, segs, BODY_R);
  }

  /** Tap-to-walk: an A* path on a GRID_M grid of the current level to (tx, tz), string-pulled (walk-path.ts); the path is set
   * and returned (null = unreachable, or the level too large for the grid - the walk then stays as it was). A blocked target
   * takes the nearest free cell. */
  pathTo(tx: number, tz: number): [number, number][] | null {
    const out = findPath(this.world, this.level, [this.x, this.z], [tx, tz], BODY_R);
    if (!out) return null;
    this.path = out;
    this.progress = null;
    return out;
  }
}
