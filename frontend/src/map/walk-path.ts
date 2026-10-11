/**
 * Plan Studio 6, slices S4 / S5-A (CR-029 sections 4.2 and 8): tap-to-walk's path finding - pure, no DOM, no three. An A* on a
 * GRID_M (0.25 m) grid of ONE level of the walk world, then string-pulled to the few waypoints a straight walk needs.
 *
 * What blocks is exactly what blocks the body (walk-world.ts): the level's wall capsules, windows, the objects' footprints, the
 * sides of the stairs of that level - and the doors that are not passable. A passable door (open, unlocked, or no sensor) is not
 * in the segment list at all, so its gap is open cells: the path goes through it and never through a closed, locked or stale
 * one. A window never opens.
 *
 * The blocked grid is the expensive part (every capsule is rasterised into the cells of its bounding box), so it is built once
 * per (world, level) and kept for as long as that world object lives: a tap is then a search, not a rebuild. The element hands
 * the controller a NEW world object whenever a door or the level filter changed the description, which is exactly when the grid
 * must be built again (the cache is keyed on the world object's identity, never on its content).
 *
 * Moved here verbatim from walk-controller.ts (S4) with the cache added; the controller keeps the same public methods.
 */
import type { WalkSeg, WalkWorld } from './walk-world';

export const GRID_M = 0.25;
export const MAX_ASTAR_CELLS = 400_000;
/** The body is rasterised a little slimmer than its collision circle, so a door gap stays a way through. */
export const PATH_BODY_FACTOR = 0.85;
/** The string-pull keeps this share of the body clear along a straight leg. */
export const LEG_BODY_FACTOR = 0.8;
/** A blocked target takes the nearest free cell within this many cells (1 m). */
const SNAP_CELLS = 4;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const r4 = (v: number): number => Math.round(v * 1e4) / 1e4 + 0;

/** Whether (x, z) is inside the polygon (even-odd). */
export function pointInPoly(x: number, z: number, poly: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** The distance from p to the segment ab and the closest point on it. */
export function closestOnSeg(px: number, pz: number, s: WalkSeg): { d: number; cx: number; cz: number } {
  const ex = s.b[0] - s.a[0];
  const ez = s.b[1] - s.a[1];
  const l2 = ex * ex + ez * ez;
  const u = l2 > 0 ? clamp(((px - s.a[0]) * ex + (pz - s.a[1]) * ez) / l2, 0, 1) : 0;
  const cx = s.a[0] + u * ex;
  const cz = s.a[1] + u * ez;
  return { d: Math.hypot(px - cx, pz - cz), cx, cz };
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

/** The capsules that block a body standing on a level's floor: the level's own segments and the sides of its bands. */
export function levelSegments(world: WalkWorld, levelId: string): WalkSeg[] {
  const sides = world.bands.filter((b) => b.from === levelId || b.to === levelId).flatMap((b) => b.sides);
  return [...(world.levels.find((l) => l.id === levelId)?.segs ?? []), ...sides];
}

export interface WalkGrid {
  level: string;
  minX: number;
  minZ: number;
  cols: number;
  rows: number;
  /** 1 = a cell the body's centre may not be in. */
  blocked: Uint8Array;
  segs: WalkSeg[];
}

/** Rasterise the blocking capsules of a level (null = the level is unknown or too large for the grid). */
export function buildGrid(world: WalkWorld, levelId: string, bodyR: number): WalkGrid | null {
  const L = world.levels.find((l) => l.id === levelId);
  if (!L) return null;
  const ex = L.extent;
  const cols = Math.max(1, Math.ceil((ex.maxX - ex.minX) / GRID_M));
  const rows = Math.max(1, Math.ceil((ex.maxZ - ex.minZ) / GRID_M));
  if (cols * rows > MAX_ASTAR_CELLS) return null;
  const segs = levelSegments(world, levelId);
  const blocked = new Uint8Array(cols * rows);
  const rad = bodyR * PATH_BODY_FACTOR;
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
      if (closestOnSeg(ex.minX + (i + 0.5) * GRID_M, ex.minZ + (j + 0.5) * GRID_M, s).d < rr) blocked[k] = 1;
    }
  }
  // an object's footprint is four edge segments of radius 0: the cells well inside it are solid too (a capsule only blocks its
  // own edge, so the middle of a deep cabinet would be a free island a tap could snap to and never reach)
  const quads = new Map<string, WalkSeg[]>();
  for (const s of segs) if (s.kind === 'object') (quads.get(s.id) ?? quads.set(s.id, []).get(s.id)!).push(s);
  for (const q of quads.values()) {
    if (q.length < 3) continue;
    const poly = q.map((s) => s.a);
    const xs = poly.map((p) => p[0]);
    const zs = poly.map((p) => p[1]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - ex.minX) / GRID_M));
    const i1 = Math.min(cols - 1, Math.floor((Math.max(...xs) - ex.minX) / GRID_M));
    const j0 = Math.max(0, Math.floor((Math.min(...zs) - ex.minZ) / GRID_M));
    const j1 = Math.min(rows - 1, Math.floor((Math.max(...zs) - ex.minZ) / GRID_M));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (pointInPoly(ex.minX + (i + 0.5) * GRID_M, ex.minZ + (j + 0.5) * GRID_M, poly)) blocked[j * cols + i] = 1;
  }
  return { level: levelId, minX: ex.minX, minZ: ex.minZ, cols, rows, blocked, segs };
}

const cache = new WeakMap<WalkWorld, Map<string, WalkGrid | null>>();
let builds = 0;

/** The level's grid, built once per world object (see the module note). */
export function gridFor(world: WalkWorld, levelId: string, bodyR: number): WalkGrid | null {
  let per = cache.get(world);
  if (!per) {
    per = new Map();
    cache.set(world, per);
  }
  const key = `${levelId}|${bodyR}`;
  if (per.has(key)) return per.get(key) ?? null;
  const g = buildGrid(world, levelId, bodyR);
  builds++;
  per.set(key, g);
  return g;
}

/** How many grids were built since the module loaded (tests: a second tap in the same world builds none). */
export function gridBuilds(): number {
  return builds;
}

/** Whether a straight walk from a to b keeps the body (slightly slimmer) clear of every segment. */
export function lineFree(a: readonly [number, number], b: readonly [number, number], segs: readonly WalkSeg[], bodyR: number): boolean {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 1e-6) return true;
  const n = Math.max(2, Math.ceil(len / 0.1));
  for (let i = 0; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n;
    const z = a[1] + ((b[1] - a[1]) * i) / n;
    for (const s of segs) if (closestOnSeg(x, z, s).d < bodyR * LEG_BODY_FACTOR + s.r) return false;
  }
  return true;
}

/**
 * The path from `from` to `to` on a level (metres, the description's axes), string-pulled: the waypoints after `from`, the last
 * being the target (or, for a target inside something solid, the nearest free cell's centre). null = no open way (a closed door
 * in the only way, a window, a wall), or the level is too large for the grid. Deterministic: ties break on the cell index.
 */
export function findPath(world: WalkWorld, levelId: string, from: readonly [number, number], to: readonly [number, number], bodyR: number): [number, number][] | null {
  const grid = gridFor(world, levelId, bodyR);
  if (!grid) return null;
  const { cols, rows, minX, minZ, blocked } = grid;
  const cell = (x: number, z: number): [number, number] => [clamp(Math.floor((x - minX) / GRID_M), 0, cols - 1), clamp(Math.floor((z - minZ) / GRID_M), 0, rows - 1)];
  const [si, sj] = cell(from[0], from[1]);
  let [ti, tj] = cell(to[0], to[1]);
  let goalX = to[0];
  let goalZ = to[1];
  if (blocked[tj * cols + ti]) {
    let best: { i: number; j: number; d: number } | null = null;
    for (let dj = -SNAP_CELLS; dj <= SNAP_CELLS; dj++) for (let di = -SNAP_CELLS; di <= SNAP_CELLS; di++) {
      const i = ti + di;
      const j = tj + dj;
      if (i < 0 || j < 0 || i >= cols || j >= rows || blocked[j * cols + i]) continue;
      const d = di * di + dj * dj;
      if (!best || d < best.d) best = { i, j, d };
    }
    if (!best) return null;
    ti = best.i;
    tj = best.j;
    goalX = minX + (ti + 0.5) * GRID_M;
    goalZ = minZ + (tj + 0.5) * GRID_M;
  }
  const start = sj * cols + si;
  const goal = tj * cols + ti;
  const g = new Float64Array(cols * rows).fill(Infinity);
  const prev = new Int32Array(cols * rows).fill(-1);
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
        prev[nk] = cur;
        open.push(ng + h(ni, nj), nk);
      }
    }
  }
  if (goal !== start && prev[goal] < 0) return null;
  const pts: [number, number][] = [];
  for (let k = goal; k >= 0 && k !== start; k = prev[k]) pts.push([minX + ((k % cols) + 0.5) * GRID_M, minZ + (Math.floor(k / cols) + 0.5) * GRID_M]);
  pts.reverse();
  pts.push([goalX, goalZ]);
  // string-pull: from where we stand, jump to the farthest waypoint a straight walk reaches
  const out: [number, number][] = [];
  let cur: [number, number] = [from[0], from[1]];
  let idx = 0;
  while (idx < pts.length) {
    let far = idx;
    for (let j = pts.length - 1; j > idx; j--) {
      if (lineFree(cur, pts[j], grid.segs, bodyR)) {
        far = j;
        break;
      }
    }
    out.push([r4(pts[far][0]), r4(pts[far][1])]);
    cur = pts[far];
    idx = far + 1;
  }
  return out;
}
