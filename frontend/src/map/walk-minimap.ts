/**
 * Plan Studio 6, slice S4 (CR-029 section 4.4): the walk's minimap - a small top-down canvas of the current level with the
 * walls, the doors by their walk state, the stairs, the auto-walk path and the heading cone; a tap teleports (an operator
 * convenience, not an edit). The frame maths are pure (minimapFrame, node-tested); drawMinimap paints with the colours the
 * element reads from the theme's tokens, so no colour is hard-coded here. Map geometry is never mirrored by RTL.
 */
import type { WalkWorld } from './walk-world';
import type { WalkPose } from './walk-controller';

export interface MinimapColors {
  bg: string;
  wall: string;
  low: string;
  window: string;
  doorOpen: string;
  doorClosed: string;
  object: string;
  stair: string;
  room: string;
  path: string;
  me: string;
  meRing: string;
}
export interface MinimapFrame {
  size: number;
  k: number;
  toPx(x: number, z: number): [number, number];
  toM(px: number, py: number): [number, number];
}

const PAD = 6;

/** The square frame of a level's extent in a `size` px canvas (uniform scale, centred). */
export function minimapFrame(ext: { minX: number; minZ: number; maxX: number; maxZ: number }, size: number): MinimapFrame {
  const w = Math.max(1e-3, ext.maxX - ext.minX);
  const d = Math.max(1e-3, ext.maxZ - ext.minZ);
  const inner = size - 2 * PAD;
  const k = inner / Math.max(w, d);
  const ox = PAD + (inner - w * k) / 2;
  const oz = PAD + (inner - d * k) / 2;
  return {
    size,
    k,
    toPx: (x, z) => [ox + (x - ext.minX) * k, oz + (z - ext.minZ) * k],
    toM: (px, py) => [ext.minX + (px - ox) / k, ext.minZ + (py - oz) / k],
  };
}

/** Paint the minimap of the pose's level into a 2D context of `size` css px (the caller scales for the DPR). */
export function drawMinimap(ctx: CanvasRenderingContext2D, world: WalkWorld, pose: WalkPose, path: [number, number][] | null, size: number, c: MinimapColors): MinimapFrame | null {
  const L = world.levels.find((l) => l.id === pose.level);
  ctx.clearRect(0, 0, size, size);
  if (!L) return null;
  const f = minimapFrame(L.extent, size);
  ctx.fillStyle = c.bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, 10);
  ctx.fill();
  for (const r of world.rooms) {
    if (r.level !== L.id) continue;
    ctx.beginPath();
    r.poly.forEach(([x, z], i) => {
      const [px, py] = f.toPx(x, z);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = c.room;
    ctx.fill();
  }
  const line = (a: [number, number], b: [number, number], color: string, width: number): void => {
    const [ax, ay] = f.toPx(a[0], a[1]);
    const [bx, by] = f.toPx(b[0], b[1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  for (const s of L.segs) {
    if (s.kind === 'door') continue; // drawn below with every door
    line(s.a, s.b, s.kind === 'window' ? c.window : s.kind === 'object' ? c.object : s.kind === 'low' ? c.low : c.wall, s.kind === 'object' ? 1 : Math.max(1.5, s.r * 2 * f.k));
  }
  for (const d of world.doors) if (d.level === L.id) line(d.a, d.b, d.passable ? c.doorOpen : c.doorClosed, 2.5);
  for (const b of world.bands) {
    if (b.from !== L.id && b.to !== L.id) continue;
    for (const s of b.sides) line(s.a, s.b, c.stair, 1);
    for (const rp of b.ramps) {
      const len = Math.hypot(rp.b[0] - rp.a[0], rp.b[1] - rp.a[1]) || 1;
      const n: [number, number] = [-(rp.b[1] - rp.a[1]) / len, (rp.b[0] - rp.a[0]) / len];
      const steps = Math.max(2, Math.round(len / 0.3));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const cx = rp.a[0] + (rp.b[0] - rp.a[0]) * t;
        const cz = rp.a[1] + (rp.b[1] - rp.a[1]) * t;
        line([cx + (n[0] * rp.width) / 2, cz + (n[1] * rp.width) / 2], [cx - (n[0] * rp.width) / 2, cz - (n[1] * rp.width) / 2], c.stair, 0.75);
      }
    }
  }
  if (path && path.length) {
    ctx.setLineDash([3, 3]);
    let prev: [number, number] = [pose.x, pose.z];
    for (const p of path) {
      line(prev, p, c.path, 2);
      prev = p;
    }
    ctx.setLineDash([]);
  }
  const [px, py] = f.toPx(pose.x, pose.z);
  const a = ((pose.heading_deg - 90) * Math.PI) / 180; // canvas angle of the bearing (0 = up, clockwise)
  ctx.fillStyle = c.meRing;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.arc(px, py, 22, a - 0.5, a + 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = c.me;
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();
  return f;
}
