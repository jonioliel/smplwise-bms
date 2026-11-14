/**
 * PLAN3D-R28-UI-2433 (round 28 mockup, app/room.html): when the room card opens beside the 3D view, the room moves to the middle
 * of the space the card leaves and comes closer; closing the card puts the camera back where it was. The camera moves along the
 * orbit controls (target and position together), so the person can orbit from there as usual; the presets still reframe the whole
 * floor. Pure maths (focusPose) plus a short eased move (FocusMover) - nothing in the renderer changes.
 */
import type { Vec3 } from './scene-builder';

/** The stage edges a panel covers (CSS px): the room is centred in what is left. */
export interface FocusInset {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
/** A camera pose as the orbit controls keep it: where the camera is, what it looks at, the orthographic zoom. */
export interface CameraPose {
  position: Vec3;
  target: Vec3;
  zoom: number;
}
export interface FocusFrame {
  /** The camera's right and up unit vectors (world). */
  right: Vec3;
  up: Vec3;
  /** Orthographic: the frustum half height at zoom 1 (world). Perspective: null. */
  orthoHalfH: number | null;
  /** Perspective: the vertical field of view (degrees). */
  fov: number;
  stageW: number;
  stageH: number;
}
/** The room's larger side fills this share of the free space's shorter side. */
export const FOCUS_FILL = 0.62;
export const FOCUS_MS = 420;
const MAX_ZOOM = 6;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);

/** The pose that shows `point` (a room of `extent` metres) in the middle of the stage less `inset`, from the current pose:
 * the same viewing direction, closer (the perspective distance or the orthographic zoom), panned so the point sits at the
 * free space's centre. */
export function focusPose(from: CameraPose, point: Vec3, extent: number, inset: FocusInset, f: FocusFrame): CameraPose {
  const freeW = Math.max(40, f.stageW - inset.left - inset.right);
  const freeH = Math.max(40, f.stageH - inset.top - inset.bottom);
  // the free space's centre relative to the stage centre, in px (x right, y down)
  const offX = inset.left + freeW / 2 - f.stageW / 2;
  const offY = inset.top + freeH / 2 - f.stageH / 2;
  const want = Math.max(1, extent) / FOCUS_FILL; // world size the free space's shorter side should show
  const shortPx = Math.min(freeW, freeH);
  const dir = sub(from.position, from.target);
  let zoom = from.zoom;
  let dist = len(dir);
  let worldPerPx: number;
  if (f.orthoHalfH !== null) {
    // the frustum at zoom 1 shows 2 * halfH vertically over stageH px; zoom divides it
    zoom = Math.min(MAX_ZOOM, Math.max(from.zoom, (2 * f.orthoHalfH * shortPx) / (f.stageH * want)));
    worldPerPx = (2 * f.orthoHalfH) / zoom / f.stageH;
  } else {
    const t = Math.tan(((f.fov / 2) * Math.PI) / 180);
    dist = Math.max(2, Math.min(dist, (want * f.stageH) / (shortPx * 2 * t)));
    worldPerPx = (2 * dist * t) / f.stageH;
  }
  // the target sits off the point so that the point lands offX right / offY down of the middle
  const shift = add(mul(f.right, -offX * worldPerPx), mul(f.up, offY * worldPerPx));
  const target = add(point, shift);
  const d = len(dir) > 0 ? mul(dir, dist / len(dir)) : dir;
  return { position: add(target, d), target, zoom };
}

const ease = (t: number): number => 1 - Math.pow(1 - t, 3);
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Moves a pose to another over FOCUS_MS (ease-out), or at once with the motion setting off / reduced motion. */
export class FocusMover {
  private raf = 0;
  constructor(private readonly apply: (p: CameraPose) => void) {}

  move(from: CameraPose, to: CameraPose, motion: boolean): void {
    cancelAnimationFrame(this.raf);
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!motion || reduce) {
      this.apply(to);
      return;
    }
    const t0 = performance.now();
    const step = (now: number): void => {
      const k = ease(Math.min(1, (now - t0) / FOCUS_MS));
      this.apply({ position: lerp(from.position, to.position, k), target: lerp(from.target, to.target, k), zoom: from.zoom + (to.zoom - from.zoom) * k });
      if (k < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}
