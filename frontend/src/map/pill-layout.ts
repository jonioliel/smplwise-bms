/**
 * Plan Studio 6 (ST7-odd, 2.4.10 oddity 3): the entity pills of the 3D view stand on their projected points, and two
 * points close together on the screen (a phone's 390 px stage, an iso view where the kitchen door and the terrace
 * shutter project a few pixels apart) put one pill under the other - the lower one was clipped. This resolves the
 * overlaps in screen space, per frame, without touching the scene: the pills are taken from the lowest on the screen
 * upward (in an overhead view the lower one is the nearer one and keeps its place), and a pill that would overlap an
 * already placed pill is raised to sit just above it, as a stack. Pure maths, deterministic (ties by id), O(n^2) on at
 * most the pill cap (60 on a desk, 8 on a phone), so it runs per drawn frame while the camera moves.
 */
export interface PillBox {
  id: string;
  /** The anchor point in stage pixels: the pill is centred on x and its bottom edge sits at y. */
  x: number;
  y: number;
  w: number;
  h: number;
}

const EPS = 1e-6;

/** The vertical shift (stage pixels, zero or negative = raised) of every pill so that none overlaps another, as a map
 * by id. `gap` is the clear space kept between two stacked pills. A pill whose size is unknown (w or h 0) is not moved
 * and blocks nothing. */
export function resolvePillOverlaps(pills: readonly PillBox[], gap = 2): Map<string, number> {
  const out = new Map<string, number>();
  const order = pills.filter((p) => p.w > 0 && p.h > 0).slice().sort((a, b) => b.y - a.y || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const placed: { l: number; r: number; t: number; b: number }[] = [];
  for (const p of order) {
    const l = p.x - p.w / 2;
    const r = p.x + p.w / 2;
    let b = p.y;
    // raise until the pill clears every placed pill it overlaps (each pass can only move it up, so it ends)
    for (let guard = 0; guard <= placed.length; guard++) {
      const hit = placed.find((q) => l < q.r - EPS && r > q.l + EPS && b - p.h < q.b + gap - EPS && b > q.t - gap + EPS);
      if (!hit) break;
      b = hit.t - gap;
    }
    placed.push({ l, r, t: b - p.h, b });
    out.set(p.id, Math.round((b - p.y) * 100) / 100);
  }
  for (const p of pills) if (!out.has(p.id)) out.set(p.id, 0);
  return out;
}
