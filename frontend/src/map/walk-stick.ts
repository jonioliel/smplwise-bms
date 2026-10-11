/**
 * Plan Studio 6, slice S5-A (CR-029 section 4.2, touch row): the virtual joystick of the eye-level walk - pure maths, no DOM,
 * no three. The stick FLOATS: it appears under the thumb, so the origin is where the finger went down and everything here is
 * measured from it (dx right, dy down, in css pixels). The gesture machine (walk-touch.ts) feeds it; the walk session turns the
 * result into a WalkInput; the HUD draws the base ring at the origin and the knob at `knob`.
 *
 * - Inside the dead zone nothing moves (a resting thumb never walks) and the stick is not "engaged" yet (a short touch there is
 *   a tap, not the start of a walk).
 * - From the dead zone's edge to STICK_RADIUS_PX the speed grows linearly from 0 to the walking speed (1.4 m/s).
 * - Beyond STICK_RUN_PX the stick runs (the keyboard's Shift, 2.8 m/s): dragging past the ring is the touch spelling of Shift.
 * - Near the vertical / horizontal axes the stick snaps to the pure axis (a thumb never drags in a perfect line, and a walk that
 *   drifts sideways in "crab" steps is the usual complaint about a joystick): STICK_SNAP_DEG either side of an axis.
 *
 * The directions are the controller's: forward is up on the screen (dy < 0), strafe is right (dx > 0). Map geometry and video
 * are never mirrored by RTL, and neither is this.
 */

/** Full deflection: a drag of this length (past the dead zone's edge it is the whole range) is the walking speed. */
export const STICK_RADIUS_PX = 56;
/** Inside this nothing moves and the stick is not engaged. */
export const STICK_DEAD_PX = 8;
/** Past this distance from the origin the stick runs. */
export const STICK_RUN_PX = 84;
/** Either side of an axis within which the stick snaps to the pure axis. */
export const STICK_SNAP_DEG = 10;

export interface StickState {
  /** -1..1: backward .. forward (the WalkInput.forward). */
  forward: number;
  /** -1..1: left .. right (the WalkInput.strafe). */
  strafe: number;
  /** The drag is past STICK_RUN_PX. */
  run: boolean;
  /** Past the dead zone: the stick is a stick now (and the HUD draws it). */
  engaged: boolean;
  /** The knob's offset from the origin, clamped to the ring (what the HUD draws). */
  knob: [number, number];
}

export const STICK_REST: StickState = { forward: 0, strafe: 0, run: false, engaged: false, knob: [0, 0] };

export interface StickOptions {
  radius?: number;
  dead?: number;
  runAt?: number;
  snapDeg?: number;
}

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6 + 0;

/** The stick for a finger `dx`, `dy` pixels from where it went down. Pure: the same drag gives the same state. */
export function stickState(dx: number, dy: number, o: StickOptions = {}): StickState {
  const radius = o.radius ?? STICK_RADIUS_PX;
  const dead = Math.min(o.dead ?? STICK_DEAD_PX, radius - 1e-6);
  const runAt = o.runAt ?? STICK_RUN_PX;
  const snap = o.snapDeg ?? STICK_SNAP_DEG;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return STICK_REST;
  const len = Math.hypot(dx, dy);
  const k = len > radius ? radius / len : 1;
  const knob: [number, number] = [r6(dx * k), r6(dy * k)];
  if (len <= dead) return { ...STICK_REST, knob };
  const m = Math.min(1, (len - dead) / (radius - dead));
  let fx = -dy / len; // forward is up the screen
  let sx = dx / len;
  // the angle off the vertical axis, 0 = straight up or down, 90 = straight sideways
  const off = (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;
  if (off < snap) {
    sx = 0;
    fx = Math.sign(fx);
  } else if (off > 90 - snap) {
    fx = 0;
    sx = Math.sign(sx);
  }
  return { forward: r6(fx * m), strafe: r6(sx * m), run: len >= runAt, engaged: true, knob };
}
