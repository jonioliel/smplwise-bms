import { test, expect } from '@playwright/test';
import { STICK_DEAD_PX, STICK_RADIUS_PX, STICK_REST, STICK_RUN_PX, STICK_SNAP_DEG, stickState } from '../src/map/walk-stick';
import { FOV_MAX_DEG, FOV_MIN_DEG, FOV_REF_DEG, LOOK_EASE_MS, LookEase, TOUCH_LOOK_DEG_PER_PX, clampFov, lookDelta, pinchFov } from '../src/map/walk-look';

// Plan Studio 6, slice S5-A (CR-029 section 4.2, touch row): the joystick maths and the look maths of the touch walk in node -
// the dead zone, the linear ramp to the ring, the run zone, the axis snap, the knob's clamp; the sensitivity by field of view,
// the 120 ms ease (95 percent in the settle time, frame-rate independent, no overshoot) and the pinch's field of view
// (50-80 degrees, on the tangent of the half angle). No browser: run with
//   npx playwright test tests/unit-walk-stick.spec.ts --project=desktop
const near = (a: number, b: number, tol = 1e-6): void => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThanOrEqual(tol);

test('the stick: the dead zone, the ramp to the ring, saturation', () => {
  expect(stickState(0, 0)).toEqual({ ...STICK_REST });
  // a resting thumb (inside the dead zone) walks nowhere and is not engaged
  for (const [dx, dy] of [[3, 0], [0, -STICK_DEAD_PX], [-STICK_DEAD_PX, 0], [5, 5]] as const) {
    const s = stickState(dx, dy);
    expect(s.engaged, `${dx},${dy}`).toBe(false);
    expect([s.forward, s.strafe, s.run]).toEqual([0, 0, false]);
  }
  // just past the dead zone the stick engages at (almost) zero speed and the speed grows linearly to the ring
  const edge = stickState(0, -(STICK_DEAD_PX + 0.001));
  expect(edge.engaged).toBe(true);
  near(edge.forward, 0, 1e-3);
  const half = stickState(0, -(STICK_DEAD_PX + (STICK_RADIUS_PX - STICK_DEAD_PX) / 2));
  near(half.forward, 0.5, 1e-6);
  const full = stickState(0, -STICK_RADIUS_PX);
  near(full.forward, 1);
  // beyond the ring the speed stays at one and the knob stays on the ring
  const far = stickState(0, -STICK_RADIUS_PX * 1.5);
  near(far.forward, 1);
  near(Math.hypot(far.knob[0], far.knob[1]), STICK_RADIUS_PX, 1e-3);
  // monotonic: a longer drag in the same direction never walks slower
  let prev = -1;
  for (let len = 0; len <= 120; len += 2) {
    const m = stickState(len * 0.6, -len * 0.8).forward ** 2 + stickState(len * 0.6, -len * 0.8).strafe ** 2;
    expect(m).toBeGreaterThanOrEqual(prev - 1e-12);
    prev = m;
  }
});

test('the stick: forward is up, strafe is right, backward is down; the knob follows the thumb', () => {
  const up = stickState(0, -40);
  expect(up.forward).toBeGreaterThan(0.5);
  expect(up.strafe).toBe(0);
  const down = stickState(0, 40);
  expect(down.forward).toBeLessThan(-0.5);
  const right = stickState(40, 0);
  expect(right.strafe).toBeGreaterThan(0.5);
  expect(right.forward).toBe(0);
  const left = stickState(-40, 0);
  expect(left.strafe).toBeLessThan(-0.5);
  const diag = stickState(40, -40);
  expect(diag.forward).toBeGreaterThan(0.3);
  expect(diag.strafe).toBeGreaterThan(0.3);
  near(Math.hypot(diag.forward, diag.strafe), Math.min(1, (Math.hypot(40, 40) - STICK_DEAD_PX) / (STICK_RADIUS_PX - STICK_DEAD_PX)), 1e-5);
  expect(stickState(20, -30).knob).toEqual([20, -30]); // inside the ring the knob is the thumb
  expect(stickState(Number.NaN, 5)).toEqual(STICK_REST);
});

test('the stick: the run zone is past the ring and the axes snap', () => {
  expect(stickState(0, -(STICK_RUN_PX - 1)).run).toBe(false);
  expect(stickState(0, -STICK_RUN_PX).run).toBe(true);
  expect(stickState(STICK_RUN_PX, 0).run).toBe(true);
  // a thumb that drifts a few degrees off straight up still walks straight (no crab step)
  const drift = (deg: number) => stickState(Math.sin((deg * Math.PI) / 180) * 50, -Math.cos((deg * Math.PI) / 180) * 50);
  expect(drift(STICK_SNAP_DEG - 1).strafe).toBe(0);
  expect(drift(STICK_SNAP_DEG + 1).strafe).toBeGreaterThan(0);
  // and straight sideways within the same band
  const side = (deg: number) => stickState(Math.cos((deg * Math.PI) / 180) * 50, -Math.sin((deg * Math.PI) / 180) * 50);
  expect(side(STICK_SNAP_DEG - 1).forward).toBe(0);
  expect(side(STICK_SNAP_DEG + 1).forward).toBeGreaterThan(0);
  // the snapped forward speed is the stick's whole speed at that deflection (50 px: 87.5 percent of the range), not a component of it
  near(drift(5).forward, (50 - STICK_DEAD_PX) / (STICK_RADIUS_PX - STICK_DEAD_PX), 1e-5);
});

test('the look: a drag turns the view like a grabbed world, scaled by the field of view', () => {
  const [dh, dp] = lookDelta(100, 0);
  near(dh, -100 * TOUCH_LOOK_DEG_PER_PX, 1e-3); // a finger right turns the view left (the heading falls)
  expect(dp).toBe(0);
  expect(lookDelta(0, 50)[1]).toBeGreaterThan(0); // a finger down looks up
  expect(lookDelta(0, -50)[1]).toBeLessThan(0);
  // a narrower view turns slower, a wider one faster, in proportion
  near(lookDelta(100, 0, 50)[0] / lookDelta(100, 0, 70)[0], 50 / 70, 1e-3);
  near(lookDelta(100, 0, 80)[0] / lookDelta(100, 0, 70)[0], 80 / 70, 1e-3);
  // out-of-range fields of view are clamped, not extrapolated
  expect(lookDelta(100, 0, 10)).toEqual(lookDelta(100, 0, FOV_MIN_DEG));
  expect(lookDelta(100, 0, 170)).toEqual(lookDelta(100, 0, FOV_MAX_DEG));
});

test('the look ease: 95 percent in the settle time, frame-rate independent, never past the target', () => {
  const run = (frames: number[]): number => {
    const e = new LookEase();
    e.add(30, -6);
    let sum = 0;
    for (const dt of frames) sum += e.step(dt)[0];
    return sum;
  };
  // 120 ms at 60 fps
  const at60 = run(Array.from({ length: 7 }, () => 1 / 60)); // 7 frames = 116.7 ms
  expect(at60).toBeGreaterThan(30 * 0.94);
  expect(at60).toBeLessThan(30);
  // the same elapsed time in coarser frames gives the same total (an exponential ease is exact in any cut)
  near(run(Array.from({ length: 7 }, () => 1 / 60)), run([0.05, 0.05, 0.0166666667]), 1e-3);
  near(run([LOOK_EASE_MS / 1000]), 30 * (1 - Math.exp(-3)), 1e-6);
  // monotonic and never beyond the target, then done
  const e = new LookEase();
  e.add(-20, 4);
  let total = 0;
  let prevAbs = Infinity;
  for (let i = 0; i < 100 && e.pending; i++) {
    const [dh] = e.step(1 / 60);
    expect(dh).toBeLessThanOrEqual(0);
    if (prevAbs > 1e-3) expect(Math.abs(dh)).toBeLessThanOrEqual(prevAbs + 1e-9); // the steps shrink (the last crumb is applied whole)
    prevAbs = Math.abs(dh);
    total += dh;
    expect(total).toBeGreaterThanOrEqual(-20 - 1e-9);
  }
  expect(e.pending).toBe(false);
  near(total, -20, 1e-3);
  // new input joins the queue; flush applies it whole
  const f = new LookEase();
  f.add(10, 2);
  f.step(1 / 60);
  f.add(5, 1);
  const [rh, rp] = f.flush();
  expect(rh).toBeGreaterThan(5);
  expect(rp).toBeGreaterThan(0);
  expect(f.pending).toBe(false);
  expect(f.step(1 / 60)).toEqual([0, 0]);
});

test('the pinch: apart zooms in, together zooms out, always inside 50-80 degrees', () => {
  expect(pinchFov(70, 100, 100)).toBe(70);
  expect(pinchFov(70, 100, 130)).toBeLessThan(70); // fingers apart: a narrower view
  expect(pinchFov(70, 100, 80)).toBeGreaterThan(70); // together: a wider one
  expect(pinchFov(70, 100, 1000)).toBe(FOV_MIN_DEG);
  expect(pinchFov(70, 100, 20)).toBe(FOV_MAX_DEG);
  // on the tangent of the half angle: doubling the distance halves it
  const half = (f: number): number => Math.tan((f * Math.PI) / 360);
  near(half(pinchFov(76, 100, 120)), half(76) / 1.2, 2e-3);
  // degenerate input keeps the field of view
  expect(pinchFov(66, 0, 50)).toBe(66);
  expect(pinchFov(66, 50, 0)).toBe(66);
  expect(clampFov(Number.NaN)).toBe(FOV_REF_DEG);
  // reversible: spread then pinch back lands where it began (inside the range)
  const there = pinchFov(70, 100, 110);
  near(pinchFov(there, 110, 100), 70, 0.01);
});
