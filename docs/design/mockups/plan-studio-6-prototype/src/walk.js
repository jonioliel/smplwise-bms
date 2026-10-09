/**
 * The eye-level walk-through (CR-029 §4): a pure 2D controller in metres - state (x, z, yaw, pitch, level), input ->
 * movement, a 0.28 m body circle sliding along the level's blocking segments (walls, windows, closed / locked / stale
 * doors, tall objects), doors passable only when open, a ground function that climbs stairs between levels and switches
 * the level at the far end, an A* on a 0.25 m grid for tap-to-walk, and saved viewpoints. No three.js in here except
 * Vector3 for the camera update; the product's S4 slice keeps the same shape (walk-controller.ts) with unit tests.
 */
export const BODY_R = 0.28;
export const WALK_SPEED = 1.4;
export const RUN_SPEED = 2.8;
const GRID = 0.25;

export class WalkController {
  constructor(scene) {
    this.scene = scene; // PlanScene (levels[id].segs / stairs / extent / elevation)
    this.x = 0; this.z = 0; this.yaw = 0; this.pitch = 0;
    this.level = Object.keys(scene.levels)[0];
    this.eye = 1.65;
    this.onStairs = null;
    this.path = null; // auto-walk waypoints
    this.input = { fwd: 0, strafe: 0, run: false, turn: 0 };
    this.onLevelChange = null;
    this.edge = false;
    this.lastMoveTime = 0;
  }

  placeAt(x, z, headingDeg, level) {
    this.x = x; this.z = z; this.yaw = (headingDeg * Math.PI) / 180; this.pitch = 0;
    if (level && level !== this.level) { this.level = level; this.onLevelChange && this.onLevelChange(level); }
    this.path = null;
    this.onStairs = null;
  }

  /** The ground height under (x, z) and the level it belongs to (a stair band interpolates between its ends). */
  ground(x, z, level) {
    const L = this.scene.levels[level];
    for (const s of L.stairs) {
      const px = x - s.a[0], pz = z - s.a[1];
      const along = px * s.dx + pz * s.dz;
      const across = Math.abs(-px * s.dz + pz * s.dx);
      if (across <= s.width / 2 && along >= -0.05 && along <= s.run + 0.05) {
        const f = Math.max(0, Math.min(1, along / s.run));
        return { y: s.elevFrom + (s.elevTo - s.elevFrom) * f, stair: s, along, f };
      }
    }
    return { y: L.elevation, stair: null };
  }

  /** The segments that stop the body on the current level, plus the stair sides. On a stair band only the band's own
   * sides count: the level's walls and railings (the railing around the stairwell on the upper level, the wall under
   * the flight on the lower one) belong to the floor plate, not to the flight. */
  segmentsFor(level, scope = 'all') {
    const L = this.scene.levels[level];
    const segs = scope === 'stairs' ? [] : L.segs.slice();
    for (const s of L.stairs) {
      const nx = -s.dz, nz = s.dx;
      for (const sign of [-1, 1]) {
        const ox = nx * sign * (s.width / 2), oz = nz * sign * (s.width / 2);
        segs.push({ a: [s.a[0] + ox - s.dx * 0.0, s.a[1] + oz], b: [s.b[0] + ox, s.b[1] + oz], w: 0, kind: 'stair-side', id: 'stair' });
      }
    }
    return segs;
  }

  collide(x, z, level, scope = 'all') {
    const segs = this.segmentsFor(level, scope);
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      for (const s of segs) {
        const r = BODY_R + (s.w || 0) / 2;
        const ex = s.b[0] - s.a[0], ez = s.b[1] - s.a[1];
        const l2 = ex * ex + ez * ez;
        const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - s.a[0]) * ex + (z - s.a[1]) * ez) / l2)) : 0;
        const cx = s.a[0] + u * ex, cz = s.a[1] + u * ez;
        let dx = x - cx, dz = z - cz;
        const d = Math.hypot(dx, dz);
        if (d < r) {
          if (d < 1e-6) { dx = -ez; dz = ex; const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n; }
          else { dx /= d; dz /= d; }
          x = cx + dx * (r + 0.001);
          z = cz + dz * (r + 0.001);
          pushed = true;
        }
      }
      if (!pushed) break;
    }
    return [x, z];
  }

  /** Advance by dt seconds with the current input; returns true when the camera moved. */
  step(dt) {
    const inp = this.input;
    let moved = false;
    if (inp.turn) { this.yaw += inp.turn * dt * 2.2; moved = true; }
    let fwd = inp.fwd, strafe = inp.strafe;
    if (this.path && this.path.length) {
      const [tx, tz] = this.path[0];
      const dx = tx - this.x, dz = tz - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) { this.path.shift(); if (!this.path.length) this.path = null; }
      else {
        const targetYaw = Math.atan2(-dx, -dz); // yaw 0 looks toward −z
        let dy = targetYaw - this.yaw;
        while (dy > Math.PI) dy -= 2 * Math.PI;
        while (dy < -Math.PI) dy += 2 * Math.PI;
        this.yaw += Math.sign(dy) * Math.min(Math.abs(dy), dt * 3.5);
        fwd = Math.abs(dy) < 0.6 ? 1 : 0.2;
        strafe = 0;
      }
    }
    if (fwd || strafe) {
      const speed = inp.run ? RUN_SPEED : WALK_SPEED;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      // forward is −z rotated by yaw about y: (−sin(yaw)·?); with yaw 0 → (0, −1)
      const fx = -sin, fz = -cos;
      const rx = cos, rz = -sin;
      let nx = this.x + (fx * fwd + rx * strafe) * speed * dt;
      let nz = this.z + (fz * fwd + rz * strafe) * speed * dt;
      const onBand = this.ground(this.x, this.z, this.level).stair && this.ground(nx, nz, this.level).stair;
      [nx, nz] = this.collide(nx, nz, this.level, onBand ? 'stairs' : 'all');
      const L = this.scene.levels[this.level];
      if (L.extent) {
        const ex = L.extent;
        const cx = Math.max(ex.minX + 0.3, Math.min(ex.maxX - 0.3, nx));
        const cz = Math.max(ex.minZ + 0.3, Math.min(ex.maxZ - 0.3, nz));
        this.edge = cx !== nx || cz !== nz;
        nx = cx; nz = cz;
      }
      if (Math.abs(nx - this.x) > 1e-5 || Math.abs(nz - this.z) > 1e-5) moved = true;
      const g0 = this.ground(this.x, this.z, this.level);
      this.x = nx; this.z = nz;
      // level switch at the stair's far end - judged from the band we were on BEFORE the step, so a long step at a low
      // frame rate (dt up to 0.1 s = 0.28 m when running) cannot jump over the 7 cm switch window at the top / bottom
      const g = this.ground(this.x, this.z, this.level);
      const band = g.stair || g0.stair;
      if (band) {
        const s = band;
        const along = (this.x - s.a[0]) * s.dx + (this.z - s.a[1]) * s.dz;
        this.onStairs = g.stair;
        if (along > s.run - 0.02 && this.level === s.from) this.switchLevel(s.to);
        else if (along < 0.02 && this.level === s.to) this.switchLevel(s.from);
      } else this.onStairs = null;
    }
    return moved;
  }

  switchLevel(id) {
    if (!this.scene.levels[id] || id === this.level) return;
    this.level = id;
    this.onLevelChange && this.onLevelChange(id);
  }

  eyeY() {
    return this.ground(this.x, this.z, this.level).y + this.eye;
  }

  applyTo(camera) {
    camera.position.set(this.x, this.eyeY(), this.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(this.pitch, this.yaw, 0);
  }

  look(dyaw, dpitch) {
    this.yaw -= dyaw;
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - dpitch));
  }

  /** A* on a GRID over the level's extent; open doors are open cells (the segments already omit them). */
  pathTo(tx, tz) {
    const L = this.scene.levels[this.level];
    if (!L.extent) return null;
    const ex = L.extent;
    const cols = Math.ceil((ex.maxX - ex.minX) / GRID), rows = Math.ceil((ex.maxZ - ex.minZ) / GRID);
    const segs = this.segmentsFor(this.level);
    const blocked = new Uint8Array(cols * rows);
    const r = BODY_R * 0.85;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = ex.minX + (i + 0.5) * GRID, z = ex.minZ + (j + 0.5) * GRID;
      for (const s of segs) {
        const rr = r + (s.w || 0) / 2;
        const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1];
        const l2 = dx * dx + dz * dz;
        const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / l2)) : 0;
        if (Math.hypot(x - (s.a[0] + u * dx), z - (s.a[1] + u * dz)) < rr) { blocked[j * cols + i] = 1; break; }
      }
    }
    const cell = (x, z) => [Math.max(0, Math.min(cols - 1, Math.floor((x - ex.minX) / GRID))), Math.max(0, Math.min(rows - 1, Math.floor((z - ex.minZ) / GRID)))];
    const [si, sj] = cell(this.x, this.z);
    let [ti, tj] = cell(tx, tz);
    if (blocked[tj * cols + ti]) {
      // nearest free cell
      let best = null;
      for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
        const i = ti + di, j = tj + dj;
        if (i < 0 || j < 0 || i >= cols || j >= rows || blocked[j * cols + i]) continue;
        const d = di * di + dj * dj;
        if (!best || d < best.d) best = { i, j, d };
      }
      if (!best) return null;
      ti = best.i; tj = best.j;
    }
    const open = new Map();
    const g = new Float32Array(cols * rows).fill(Infinity);
    const from = new Int32Array(cols * rows).fill(-1);
    const h = (i, j) => Math.hypot(i - ti, j - tj);
    const start = sj * cols + si, goal = tj * cols + ti;
    g[start] = 0;
    open.set(start, h(si, sj));
    const closed = new Uint8Array(cols * rows);
    let guard = 0;
    while (open.size && guard++ < 50000) {
      let cur = -1, best = Infinity;
      for (const [k, f] of open) if (f < best) { best = f; cur = k; }
      open.delete(cur);
      if (cur === goal) break;
      closed[cur] = 1;
      const ci = cur % cols, cj = Math.floor(cur / cols);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const nk = nj * cols + ni;
        if (blocked[nk] || closed[nk]) continue;
        if (di && dj && (blocked[cj * cols + ni] || blocked[nj * cols + ci])) continue; // no corner cutting
        const ng = g[cur] + Math.hypot(di, dj);
        if (ng < g[nk]) { g[nk] = ng; from[nk] = cur; open.set(nk, ng + h(ni, nj)); }
      }
    }
    if (from[goal] < 0 && goal !== start) return null;
    const pts = [];
    let k = goal;
    while (k >= 0 && k !== start) { pts.push([ex.minX + ((k % cols) + 0.5) * GRID, ex.minZ + (Math.floor(k / cols) + 0.5) * GRID]); k = from[k]; }
    pts.reverse();
    pts.push([tx, tz]);
    // string-pull: drop waypoints that a straight line reaches
    const out = [];
    let cur = [this.x, this.z];
    let idx = 0;
    while (idx < pts.length) {
      let far = idx;
      for (let j = pts.length - 1; j > idx; j--) if (this.lineFree(cur, pts[j], segs)) { far = j; break; }
      out.push(pts[far]);
      cur = pts[far];
      idx = far + 1;
    }
    this.path = out;
    return out;
  }

  lineFree(a, b, segs) {
    const d = [b[0] - a[0], b[1] - a[1]];
    const len = Math.hypot(d[0], d[1]);
    if (len < 1e-6) return true;
    const n = Math.max(2, Math.ceil(len / 0.1));
    for (let i = 0; i <= n; i++) {
      const x = a[0] + (d[0] * i) / n, z = a[1] + (d[1] * i) / n;
      for (const s of segs) {
        const rr = BODY_R * 0.8 + (s.w || 0) / 2;
        const ex = s.b[0] - s.a[0], ez = s.b[1] - s.a[1];
        const l2 = ex * ex + ez * ez;
        const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - s.a[0]) * ex + (z - s.a[1]) * ez) / l2)) : 0;
        if (Math.hypot(x - (s.a[0] + u * ex), z - (s.a[1] + u * ez)) < rr) return false;
      }
    }
    return true;
  }
}

/** The minimap: a 2D canvas of the level - walls, closed / open doors, the player's heading cone, the auto-walk path. */
export function drawMinimap(canvas, scene, walk, opts = {}) {
  const ctx = canvas.getContext('2d');
  const L = scene.levels[walk.level];
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  if (!L || !L.extent) return;
  const ex = L.extent;
  const w = ex.maxX - ex.minX, d = ex.maxZ - ex.minZ;
  const k = (size - 12) / Math.max(w, d);
  const X = (x) => 6 + (x - ex.minX) * k + ((size - 12) - w * k) / 2;
  const Z = (z) => 6 + (z - ex.minZ) * k + ((size - 12) - d * k) / 2;
  ctx.fillStyle = opts.bg || 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, 10);
  ctx.fill();
  for (const z of L.zones) {
    ctx.beginPath();
    z.polyM.forEach(([x, zz], i) => (i ? ctx.lineTo(X(x), Z(zz)) : ctx.moveTo(X(x), Z(zz))));
    ctx.closePath();
    const lit = z.x_proto && z.x_proto.light && scene.plan.entities[z.x_proto.light] === 'on';
    ctx.fillStyle = lit ? 'rgba(255,200,87,0.35)' : 'rgba(39,103,237,0.06)';
    ctx.fill();
  }
  ctx.lineWidth = 2;
  for (const s of L.segs) {
    ctx.strokeStyle = s.kind === 'window' ? '#7fb2ff' : s.kind === 'door' || s.kind === 'door-locked' ? '#ef4444' : s.kind === 'object' ? 'rgba(90,100,120,0.35)' : s.kind === 'railing' || s.kind === 'low' ? '#9aa3b5' : '#56617a';
    ctx.lineWidth = s.kind === 'object' ? 1 : s.kind === 'exterior' ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(X(s.a[0]), Z(s.a[1]));
    ctx.lineTo(X(s.b[0]), Z(s.b[1]));
    ctx.stroke();
  }
  for (const s of L.stairs) {
    ctx.strokeStyle = '#6b7f99';
    ctx.lineWidth = 1;
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const cx = s.a[0] + s.dx * s.run * t, cz = s.a[1] + s.dz * s.run * t;
      ctx.beginPath();
      ctx.moveTo(X(cx - s.dz * s.width / 2), Z(cz + s.dx * s.width / 2));
      ctx.lineTo(X(cx + s.dz * s.width / 2), Z(cz - s.dx * s.width / 2));
      ctx.stroke();
    }
  }
  if (walk.path) {
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(X(walk.x), Z(walk.z));
    for (const [px, pz] of walk.path) ctx.lineTo(X(px), Z(pz));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // heading cone
  const px = X(walk.x), pz = Z(walk.z);
  const a = Math.atan2(-Math.sin(walk.yaw), -Math.cos(walk.yaw)); // direction in plan (x, z)
  ctx.fillStyle = 'rgba(39,103,237,0.25)';
  ctx.beginPath();
  ctx.moveTo(px, pz);
  ctx.arc(px, pz, 22, a - 0.5, a + 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2767ed';
  ctx.beginPath();
  ctx.arc(px, pz, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return { X, Z, k, ex, invert: (cx, cz) => [ex.minX + (cx - 6 - ((size - 12) - w * k) / 2) / k, ex.minZ + (cz - 6 - ((size - 12) - d * k) / 2) / k] };
}
