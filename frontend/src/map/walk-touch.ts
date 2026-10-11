/**
 * Plan Studio 6, slice S5-A (CR-029 section 4.2, touch row): the gesture machine of the touch walk - pure, no DOM, no timers, no
 * three. It is fed the pointer events of the fingers (id, client x / y, a millisecond timestamp) and answers with actions;
 * the walk session owns the real pointers and the real clock, so a scripted sequence of events gives the same actions every time
 * (unit-walk-touch.spec.ts).
 *
 * Who does what:
 * - one finger on the LEFT half of the view is the joystick: it floats (the origin is where the finger went down), it engages
 *   once the finger leaves the dead zone and stays engaged until it lifts (walk-stick.ts);
 * - one finger on the RIGHT half looks around (walk-look.ts), after it moved past the tap slop;
 * - a finger on each half does both at once (the two thumbs of a phone);
 * - two fingers on the SAME half, or less than PINCH_GAP_PX apart, are a pinch: the field of view (50-80 degrees), not a walk.
 *   A pinch can only start while neither finger has done anything yet; it ends when a finger lifts and the other one then rests
 *   until it lifts too (a stick or a look that starts in the middle of a gesture jumps);
 * - a finger that lifts quickly without moving is a TAP (tap-to-walk, or stop when the walk is under way); one that rests
 *   LONG_PRESS_MS without moving is a LONG PRESS (a device's popover). A finger that is not alone, or has moved, is neither;
 * - a third finger is ignored.
 *
 * Halves are physical (left / right of the view), never mirrored by RTL: map geometry and the walk do not flip.
 */
import { FOV_REF_DEG, clampFov, gap, lookDelta, pinchFov } from './walk-look';
import { STICK_REST, stickState, type StickState } from './walk-stick';

/** A finger resting this long without moving is a long press. */
export const LONG_PRESS_MS = 500;
/** A finger that moves more than this is a drag, not a tap or a long press. */
export const TAP_SLOP_PX = 10;
/** Two fingers that go down less than this apart start a pinch even on opposite halves. */
export const PINCH_GAP_PX = 110;
/** The field of view is reported when it changed by at least this much (degrees). */
const FOV_STEP = 0.05;

export interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface TouchPoint {
  id: number;
  /** Client coordinates. */
  x: number;
  y: number;
  /** Milliseconds (performance.now()). */
  t: number;
}

export type TouchAction =
  | { type: 'stick'; forward: number; strafe: number; run: boolean; origin: [number, number]; knob: [number, number] }
  | { type: 'stick-end' }
  | { type: 'look'; dHeading: number; dPitch: number }
  | { type: 'fov'; fov: number }
  | { type: 'tap'; x: number; y: number }
  | { type: 'long-press'; x: number; y: number };

type Role = 'stick' | 'look' | 'pinch' | 'rest';
interface Finger {
  id: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  /** The position the last look delta was measured from. */
  lx: number;
  ly: number;
  t0: number;
  role: Role;
  left: boolean;
  /** Still able to become a tap or a long press. */
  armed: boolean;
  engaged: boolean;
  lastStick: StickState;
}

export class TouchGestures {
  private fingers = new Map<number, Finger>();
  private pinch: { a: number; b: number; dist: number; fov: number } | null = null;
  private fovNow: number;

  constructor(private readonly bounds: () => Bounds, fov: number = FOV_REF_DEG) {
    this.fovNow = clampFov(fov);
  }

  /** The field of view the look sensitivity and the next pinch start from. */
  get fov(): number {
    return this.fovNow;
  }
  setFov(fov: number): void {
    this.fovNow = clampFov(fov);
  }

  /** How many fingers are down. */
  get count(): number {
    return this.fingers.size;
  }

  /** The stick, while its finger is down and engaged. */
  get stick(): { state: StickState; origin: [number, number] } | null {
    for (const f of this.fingers.values()) if (f.role === 'stick' && f.engaged) return { state: f.lastStick, origin: [f.x0, f.y0] };
    return null;
  }

  private isLeft(x: number): boolean {
    const b = this.bounds();
    return x - b.left < b.width / 2;
  }

  down(p: TouchPoint): TouchAction[] {
    if (this.fingers.has(p.id)) return [];
    const left = this.isLeft(p.x);
    const f: Finger = { id: p.id, x0: p.x, y0: p.y, x: p.x, y: p.y, lx: p.x, ly: p.y, t0: p.t, role: left ? 'stick' : 'look', left, armed: true, engaged: false, lastStick: STICK_REST };
    if (this.fingers.size === 0) {
      this.fingers.set(p.id, f);
      return [];
    }
    if (this.fingers.size >= 2) {
      f.role = 'rest';
      f.armed = false;
      this.fingers.set(p.id, f);
      return [];
    }
    const first = [...this.fingers.values()][0];
    const near = Math.hypot(first.x - p.x, first.y - p.y) <= PINCH_GAP_PX;
    // a pinch can only start while the first finger has done nothing yet (still a candidate: not engaged, not a drag)
    if ((first.left === left || near) && first.armed && first.role !== 'rest') {
      first.role = 'pinch';
      first.armed = false;
      f.role = 'pinch';
      f.armed = false;
      this.fingers.set(p.id, f);
      this.pinch = { a: first.id, b: f.id, dist: gap([first.x, first.y], [f.x, f.y]), fov: this.fovNow };
      return [];
    }
    first.armed = false; // not alone any more: no tap, no long press
    if (first.role !== 'rest' && first.left === left) {
      f.role = 'rest'; // the same half as a finger that is already busy
      f.armed = false;
    }
    this.fingers.set(p.id, f);
    return [];
  }

  move(p: TouchPoint): TouchAction[] {
    const f = this.fingers.get(p.id);
    if (!f) return [];
    f.x = p.x;
    f.y = p.y;
    const out: TouchAction[] = [];
    const slop = Math.hypot(f.x - f.x0, f.y - f.y0) > TAP_SLOP_PX;
    if (f.role === 'stick') {
      const st = stickState(f.x - f.x0, f.y - f.y0);
      if (st.engaged) {
        f.engaged = true;
        f.armed = false;
        if (st.forward !== f.lastStick.forward || st.strafe !== f.lastStick.strafe || st.run !== f.lastStick.run || st.knob[0] !== f.lastStick.knob[0] || st.knob[1] !== f.lastStick.knob[1] || !f.lastStick.engaged) {
          f.lastStick = st;
          out.push({ type: 'stick', forward: st.forward, strafe: st.strafe, run: st.run, origin: [f.x0, f.y0], knob: st.knob });
        }
      } else if (f.engaged) {
        // dragged back into the dead zone: still a stick (the ring stays), standing still
        f.lastStick = { ...st, engaged: true };
        out.push({ type: 'stick', forward: 0, strafe: 0, run: false, origin: [f.x0, f.y0], knob: st.knob });
      } else if (slop) f.armed = false;
    } else if (f.role === 'look') {
      if (slop) f.armed = false;
      if (!f.armed) {
        const [dh, dp] = lookDelta(f.x - f.lx, f.y - f.ly, this.fovNow);
        f.lx = f.x;
        f.ly = f.y;
        if (dh || dp) out.push({ type: 'look', dHeading: dh, dPitch: dp });
      }
    } else if (f.role === 'pinch' && this.pinch) {
      const a = this.fingers.get(this.pinch.a);
      const b = this.fingers.get(this.pinch.b);
      if (a && b) {
        const fov = pinchFov(this.pinch.fov, this.pinch.dist, gap([a.x, a.y], [b.x, b.y]));
        if (Math.abs(fov - this.fovNow) >= FOV_STEP) {
          this.fovNow = fov;
          out.push({ type: 'fov', fov });
        }
      }
    }
    return out;
  }

  up(p: TouchPoint): TouchAction[] {
    const f = this.fingers.get(p.id);
    if (!f) return [];
    f.x = p.x;
    f.y = p.y;
    this.fingers.delete(p.id);
    const out: TouchAction[] = [];
    if (f.role === 'stick' && f.engaged) out.push({ type: 'stick-end' });
    else if ((f.role === 'stick' || f.role === 'look') && f.armed && p.t - f.t0 < LONG_PRESS_MS && Math.hypot(f.x - f.x0, f.y - f.y0) <= TAP_SLOP_PX) out.push({ type: 'tap', x: f.x, y: f.y });
    if (f.role === 'pinch') this.endPinch();
    return out;
  }

  /** The browser took the finger (a system gesture, the page lost the pointer): the same as lifting it, minus the tap. */
  cancel(p: TouchPoint): TouchAction[] {
    const f = this.fingers.get(p.id);
    if (!f) return [];
    f.armed = false;
    return this.up(p);
  }

  /** The window blurred or the view went away: end everything that is under way. */
  reset(): TouchAction[] {
    const out: TouchAction[] = [];
    for (const f of this.fingers.values()) if (f.role === 'stick' && f.engaged) out.push({ type: 'stick-end' });
    this.fingers.clear();
    this.pinch = null;
    return out;
  }

  private endPinch(): void {
    this.pinch = null;
    for (const f of this.fingers.values()) {
      if (f.role === 'pinch') {
        f.role = 'rest'; // the finger that stays down rests until it lifts
        f.armed = false;
      }
    }
  }

  /** When the next long press is due (a lone finger that has not moved), or null. */
  nextDeadline(): number | null {
    const f = this.candidate();
    return f ? f.t0 + LONG_PRESS_MS : null;
  }

  private candidate(): Finger | null {
    if (this.fingers.size !== 1) return null;
    const f = [...this.fingers.values()][0];
    return f.armed && (f.role === 'stick' || f.role === 'look') ? f : null;
  }

  /** The clock moved on to `now`: fires the long press that fell due. */
  tick(now: number): TouchAction[] {
    const f = this.candidate();
    if (!f || now - f.t0 < LONG_PRESS_MS) return [];
    f.armed = false; // fired once; lifting it later is not a tap
    return [{ type: 'long-press', x: f.x, y: f.y }];
  }
}
