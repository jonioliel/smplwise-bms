/**
 * Plan Studio 6, slice S5-A (CR-029 sections 4.1 and 4.2, touch row): the maths of looking around with a finger - pure, no DOM,
 * no three. Three small things:
 *
 * - lookDelta: a drag of (dx, dy) css pixels is a turn of (dHeading, dPitch) degrees. The view is dragged like a world you grab:
 *   a finger moving right turns the view left (the heading falls), a finger moving down looks up. The degrees per pixel scale
 *   with the field of view (a narrower view, after a pinch, turns slower), so a drag moves the picture about the same distance
 *   at any zoom; at the reference view of 70 degrees it is the S4 sensitivity.
 * - LookEase: "a 120 ms ease on turns from touch" (section 4.1). The drag's turn is not applied at once: it is queued and eaten
 *   by a frame-rate independent exponential ease, 95 percent of it within LOOK_EASE_MS. Deterministic: the same queue and the
 *   same sequence of frame times give the same turns, however the frames are cut.
 * - pinchFov: two fingers moving apart zoom in (a narrower field of view), together zoom out; the field of view stays inside
 *   FOV_MIN..FOV_MAX (section 4.2: 50-80 degrees). The change is on the tangent of the half angle, which is what a picture
 *   scales with, so a pinch that doubles the finger distance doubles the picture.
 */

/** The degrees a touch drag turns the view per pixel at the reference field of view (the S4 value). */
export const TOUCH_LOOK_DEG_PER_PX = 0.3;
/** The field of view at which TOUCH_LOOK_DEG_PER_PX applies (the touch default of the walk). */
export const FOV_REF_DEG = 70;
export const FOV_MIN_DEG = 50;
export const FOV_MAX_DEG = 80;
/** 95 percent of a queued turn is applied within this long. */
export const LOOK_EASE_MS = 120;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const r3 = (v: number): number => Math.round(v * 1e3) / 1e3 + 0;

export const clampFov = (fov: number): number => r3(clamp(Number.isFinite(fov) ? fov : FOV_REF_DEG, FOV_MIN_DEG, FOV_MAX_DEG));

/** The turn of a drag of (dx, dy) pixels at `fovDeg`: [dHeading, dPitch] in degrees (positive heading = clockwise). */
export function lookDelta(dx: number, dy: number, fovDeg: number = FOV_REF_DEG, degPerPx: number = TOUCH_LOOK_DEG_PER_PX): [number, number] {
  const k = degPerPx * (clampFov(fovDeg) / FOV_REF_DEG);
  return [r3(-dx * k), r3(dy * k)];
}

/** The field of view after a pinch that started at `startFov` with the fingers `startDist` apart and now has them `dist` apart. */
export function pinchFov(startFov: number, startDist: number, dist: number): number {
  if (!(startDist > 1e-6) || !(dist > 1e-6)) return clampFov(startFov);
  const half = Math.tan(((clampFov(startFov) / 2) * Math.PI) / 180);
  return clampFov((2 * Math.atan((half * startDist) / dist) * 180) / Math.PI);
}

/** The distance between two points. */
export const gap = (a: readonly [number, number], b: readonly [number, number]): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** A queued turn eaten by an exponential ease (see the module note). */
export class LookEase {
  private h = 0;
  private p = 0;
  private readonly tau: number;

  constructor(settleMs: number = LOOK_EASE_MS) {
    // 1 - exp(-3) = 0.95: the whole queue is 95 percent applied after settleMs
    this.tau = Math.max(1e-3, settleMs / 3000);
  }

  /** Queue a turn (degrees). */
  add(dHeading: number, dPitch: number): void {
    this.h += dHeading;
    this.p += dPitch;
  }

  /** Whether any of the queue is left (the frame loop runs while it is). */
  get pending(): boolean {
    return Math.abs(this.h) > 1e-4 || Math.abs(this.p) > 1e-4;
  }

  /** The turn for a frame of `dt` seconds: [dHeading, dPitch]. The rest of a tiny queue is applied whole. */
  step(dt: number): [number, number] {
    if (!this.pending) {
      this.h = 0;
      this.p = 0;
      return [0, 0];
    }
    const f = dt > 0 ? 1 - Math.exp(-dt / this.tau) : 0;
    let dh = this.h * f;
    let dp = this.p * f;
    if (Math.abs(this.h - dh) <= 1e-4) dh = this.h;
    if (Math.abs(this.p - dp) <= 1e-4) dp = this.p;
    this.h -= dh;
    this.p -= dp;
    return [dh, dp];
  }

  /** Apply what is queued at once (the motion setting off, a teleport): returns it and empties the queue. */
  flush(): [number, number] {
    const out: [number, number] = [this.h, this.p];
    this.h = 0;
    this.p = 0;
    return out;
  }

  clear(): void {
    this.h = 0;
    this.p = 0;
  }
}
