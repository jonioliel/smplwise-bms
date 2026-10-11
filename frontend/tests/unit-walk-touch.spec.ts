import { test, expect } from '@playwright/test';
import { LONG_PRESS_MS, PINCH_GAP_PX, TAP_SLOP_PX, TouchGestures, type Bounds, type TouchAction, type TouchPoint } from '../src/map/walk-touch';
import { FOV_MAX_DEG, FOV_MIN_DEG, LookEase, lookDelta } from '../src/map/walk-look';
import { STICK_DEAD_PX } from '../src/map/walk-stick';
import { NO_INPUT, WalkController } from '../src/map/walk-controller';
import { walkWorld, walkDoc } from './walk-fixtures';

// Plan Studio 6, slice S5-A (CR-029 section 4.2, touch row): the gesture machine of the touch walk in node, fed scripted
// finger events with a scripted clock. 400 x 800 view: the left half (x < 200) is the joystick, the right half looks.
//   npx playwright test tests/unit-walk-touch.spec.ts --project=desktop
const B: Bounds = { left: 0, top: 0, width: 400, height: 800 };
const P = (id: number, x: number, y: number, t: number): TouchPoint => ({ id, x, y, t });
const mk = (fov?: number): TouchGestures => new TouchGestures(() => B, fov);
const types = (a: TouchAction[]): string[] => a.map((x) => x.type);

test('the joystick floats: dead zone, engage, follow, run, back to the middle, release', () => {
  const g = mk();
  expect(g.down(P(1, 100, 600, 0))).toEqual([]);
  expect(g.move(P(1, 103, 598, 16))).toEqual([]); // inside the dead zone: a resting thumb
  const a = g.move(P(1, 100, 580, 32));
  expect(a).toHaveLength(1);
  expect(a[0]).toMatchObject({ type: 'stick', strafe: 0, run: false, origin: [100, 600], knob: [0, -20] });
  expect((a[0] as { forward: number }).forward).toBeCloseTo((20 - STICK_DEAD_PX) / 48, 5);
  expect(g.stick?.origin).toEqual([100, 600]);
  const b = g.move(P(1, 100, 540, 48));
  expect(b[0]).toMatchObject({ forward: 1, run: false, knob: [0, -56] });
  expect(g.move(P(1, 100, 540, 50))).toEqual([]); // the same place again: nothing new
  const c = g.move(P(1, 100, 510, 64));
  expect(c[0]).toMatchObject({ forward: 1, run: true });
  const back = g.move(P(1, 100, 600, 80)); // dragged back to the origin: standing still, the ring stays
  expect(back[0]).toMatchObject({ type: 'stick', forward: 0, strafe: 0, run: false, knob: [0, 0] });
  expect(g.stick).not.toBeNull();
  expect(g.up(P(1, 100, 600, 96))).toEqual([{ type: 'stick-end' }]); // no tap after a stick
  expect(g.stick).toBeNull();
  expect(g.count).toBe(0);
});

test('a quick touch is a tap (on either half), a held one is a long press (once), a moved one is neither', () => {
  const g = mk();
  g.down(P(1, 100, 500, 0));
  expect(g.up(P(1, 101, 502, 120))).toEqual([{ type: 'tap', x: 101, y: 502 }]);
  g.down(P(2, 300, 400, 1000));
  expect(g.up(P(2, 300, 400, 1000 + LONG_PRESS_MS - 1))).toEqual([{ type: 'tap', x: 300, y: 400 }]);
  // held
  const h = mk();
  h.down(P(1, 300, 400, 0));
  expect(h.nextDeadline()).toBe(LONG_PRESS_MS);
  expect(h.tick(LONG_PRESS_MS - 1)).toEqual([]);
  expect(h.tick(LONG_PRESS_MS)).toEqual([{ type: 'long-press', x: 300, y: 400 }]);
  expect(h.tick(LONG_PRESS_MS + 100)).toEqual([]); // once
  expect(h.nextDeadline()).toBeNull();
  expect(h.up(P(1, 300, 400, 900))).toEqual([]); // and lifting it is not a tap
  // a slow release with the timer never asked (the session was busy): neither a tap nor a long press
  const s = mk();
  s.down(P(1, 300, 400, 0));
  expect(s.up(P(1, 300, 400, LONG_PRESS_MS + 50))).toEqual([]);
  // a finger that slides past the slop is a drag: no long press, no tap
  const m = mk();
  m.down(P(1, 300, 400, 0));
  m.move(P(1, 300 + TAP_SLOP_PX + 2, 400, 100));
  expect(m.nextDeadline()).toBeNull();
  expect(m.tick(2000)).toEqual([]);
  expect(types(m.up(P(1, 320, 400, 2100)))).toEqual([]);
  // a finger that wobbles inside the slop is still a tap
  const w = mk();
  w.down(P(1, 300, 400, 0));
  w.move(P(1, 303, 396, 40));
  expect(w.up(P(1, 303, 396, 90))).toEqual([{ type: 'tap', x: 303, y: 396 }]);
});

test('the look: nothing inside the slop, then the drag in degrees at the current field of view', () => {
  const g = mk();
  g.down(P(1, 300, 400, 0));
  expect(g.move(P(1, 305, 400, 16))).toEqual([]);
  const a = g.move(P(1, 330, 400, 32)); // 30 px from the start, the slop included
  expect(a).toEqual([{ type: 'look', dHeading: lookDelta(30, 0, 70)[0], dPitch: 0 }]);
  const b = g.move(P(1, 340, 410, 48));
  expect(b).toEqual([{ type: 'look', dHeading: lookDelta(10, 10, 70)[0], dPitch: lookDelta(10, 10, 70)[1] }]);
  expect(g.up(P(1, 340, 410, 64))).toEqual([]);
  // the same drag at a narrower field of view turns less
  const n = mk(50);
  n.down(P(1, 300, 400, 0));
  const c = n.move(P(1, 330, 400, 16))[0] as { dHeading: number };
  expect(c.dHeading).toBeCloseTo((lookDelta(30, 0, 70)[0] * 50) / 70, 2);
});

test('two thumbs: a finger on each half is a stick AND a look at once', () => {
  const g = mk();
  g.down(P(1, 80, 650, 0));
  g.down(P(2, 320, 600, 10));
  const s = g.move(P(1, 80, 600, 20));
  expect(types(s)).toEqual(['stick']);
  const l = g.move(P(2, 360, 600, 30));
  expect(types(l)).toEqual(['look']);
  expect(g.count).toBe(2);
  expect(g.up(P(1, 80, 600, 40))).toEqual([{ type: 'stick-end' }]);
  // the look finger carries on alone
  expect(types(g.move(P(2, 380, 600, 50)))).toEqual(['look']);
  expect(g.up(P(2, 380, 600, 60))).toEqual([]);
});

test('the pinch: two fingers close together or on one half change the field of view, never walk', () => {
  const g = mk(70);
  g.down(P(1, 150, 400, 0));
  expect(g.down(P(2, 250, 400, 10))).toEqual([]); // opposite halves but 100 px apart (< PINCH_GAP_PX): a pinch
  expect(100).toBeLessThan(PINCH_GAP_PX);
  const out = g.move(P(2, 350, 400, 20)); // twice as far apart: zoom in, clamped to the narrowest
  expect(out).toEqual([{ type: 'fov', fov: FOV_MIN_DEG }]);
  expect(g.fov).toBe(FOV_MIN_DEG);
  expect(g.move(P(2, 350, 400, 25))).toEqual([]); // no change, no action
  const back = g.move(P(2, 250, 400, 30)); // back to the start distance
  expect(back).toEqual([{ type: 'fov', fov: 70 }]);
  const wide = g.move(P(2, 190, 400, 40)); // closer than at the start: wider, up to the widest
  expect(wide[0]).toMatchObject({ type: 'fov' });
  expect((wide[0] as { fov: number }).fov).toBeGreaterThan(70);
  expect((wide[0] as { fov: number }).fov).toBeLessThanOrEqual(FOV_MAX_DEG);
  // one finger lifting ends the pinch; the other rests until it lifts (no stick, no look, no tap)
  expect(g.up(P(1, 150, 400, 50))).toEqual([]);
  expect(g.move(P(2, 190, 300, 60))).toEqual([]);
  expect(g.up(P(2, 190, 300, 70))).toEqual([]);
  // two fingers far apart on the same half (a tablet) pinch too
  const t = mk(70);
  t.down(P(1, 20, 100, 0));
  t.down(P(2, 180, 700, 5));
  expect(t.move(P(2, 180, 800, 10))[0]).toMatchObject({ type: 'fov' });
  // the next look uses the new field of view
  const k = mk(70);
  k.down(P(1, 150, 400, 0));
  k.down(P(2, 250, 400, 5));
  k.move(P(2, 350, 400, 10));
  k.up(P(1, 150, 400, 15));
  k.up(P(2, 350, 400, 20));
  k.down(P(3, 300, 500, 100));
  const d = k.move(P(3, 330, 500, 110))[0] as { dHeading: number };
  expect(d.dHeading).toBeCloseTo((lookDelta(30, 0, 70)[0] * FOV_MIN_DEG) / 70, 2);
});

test('a pinch cannot start under a finger that is already busy, and a third finger is ignored', () => {
  const g = mk();
  g.down(P(1, 100, 600, 0));
  g.move(P(1, 100, 560, 10)); // the stick is engaged
  expect(g.down(P(2, 150, 560, 20))).toEqual([]); // same half and near, but the stick is busy: this finger rests
  expect(g.move(P(2, 190, 560, 30))).toEqual([]);
  expect(types(g.move(P(1, 100, 540, 40)))).toEqual(['stick']); // the stick still works
  g.down(P(3, 300, 300, 50)); // a third finger
  expect(g.move(P(3, 360, 300, 60))).toEqual([]);
  expect(g.up(P(3, 360, 300, 70))).toEqual([]);
  expect(g.up(P(2, 190, 560, 80))).toEqual([]);
  expect(g.up(P(1, 100, 540, 90))).toEqual([{ type: 'stick-end' }]);
  // a second finger landing makes the first one no tap and no long press (the thumb is for something else)
  const h = mk();
  h.down(P(1, 300, 400, 0));
  h.down(P(2, 80, 600, 10));
  expect(h.nextDeadline()).toBeNull();
  expect(h.up(P(1, 300, 400, 50))).toEqual([]);
});

test('cancel and reset end a stick without a tap; unknown fingers are ignored', () => {
  const g = mk();
  g.down(P(1, 100, 600, 0));
  g.move(P(1, 100, 540, 10));
  expect(g.cancel(P(1, 100, 540, 20))).toEqual([{ type: 'stick-end' }]);
  expect(g.count).toBe(0);
  g.down(P(2, 100, 600, 100));
  expect(g.cancel(P(2, 100, 600, 110))).toEqual([]); // a cancelled quick touch is not a tap
  g.down(P(3, 100, 600, 200));
  g.move(P(3, 100, 520, 210));
  expect(g.reset()).toEqual([{ type: 'stick-end' }]);
  expect(g.count).toBe(0);
  expect(g.up(P(9, 1, 1, 1))).toEqual([]);
  expect(g.move(P(9, 1, 1, 1))).toEqual([]);
  expect(g.cancel(P(9, 1, 1, 1))).toEqual([]);
});

test('the halves are physical: an offset view splits at its own middle', () => {
  const shifted: Bounds = { left: 100, top: 50, width: 400, height: 800 };
  const g = new TouchGestures(() => shifted);
  g.down(P(1, 290, 600, 0)); // client x 290 is local 190: the left half
  expect(types(g.move(P(1, 290, 540, 10)))).toEqual(['stick']);
  const h = new TouchGestures(() => shifted);
  h.down(P(1, 310, 600, 0)); // local 210: the right half
  expect(types(h.move(P(1, 340, 600, 10)))).toEqual(['look']);
});

/** A long deterministic script of fingers: two thumbs wandering, pauses, taps, one pinch. */
function script(): { fn: 'down' | 'move' | 'up' | 'tick'; p: TouchPoint }[] {
  const out: { fn: 'down' | 'move' | 'up' | 'tick'; p: TouchPoint }[] = [];
  let t = 0;
  const e = (fn: 'down' | 'move' | 'up' | 'tick', id: number, x: number, y: number, after = 16): void => {
    t += after;
    out.push({ fn, p: P(id, Math.round(x), Math.round(y), t) });
  };
  e('down', 1, 90, 650);
  e('down', 2, 310, 500);
  for (let i = 0; i < 60; i++) {
    e('move', 1, 90 + 30 * Math.sin(i / 7), 650 - 5 * i + 20 * Math.cos(i / 5));
    e('move', 2, 310 + 25 * Math.cos(i / 9), 500 + 12 * Math.sin(i / 4));
  }
  e('up', 1, 90, 400);
  e('up', 2, 310, 500);
  e('down', 3, 150, 300);
  e('down', 4, 240, 300);
  for (let i = 1; i <= 10; i++) e('move', 4, 240 + 9 * i, 300 - 3 * i);
  e('up', 3, 150, 300);
  e('up', 4, 330, 270);
  e('down', 5, 120, 200);
  e('up', 5, 121, 200);
  e('down', 6, 300, 200);
  e('tick', 6, 300, 200, LONG_PRESS_MS + 16);
  e('up', 6, 300, 200);
  return out;
}

test('a scripted sequence of fingers gives the same actions every time, and the same walk', () => {
  const run = (): { actions: TouchAction[]; poses: unknown[] } => {
    const g = mk();
    const ctrl = new WalkController(walkWorld(walkDoc(), { 'binary_sensor.d1': 'on' }));
    ctrl.placeAt(3.5, 5, 'L0', 0); // the west room, clear of the stair (z 5.9 .. 6.9)
    const ease = new LookEase();
    let stick: { forward: number; strafe: number; run: boolean } | null = null;
    const actions: TouchAction[] = [];
    const poses: unknown[] = [];
    let last = 0;
    for (const { fn, p } of script()) {
      const dt = Math.min(0.1, (p.t - last) / 1000);
      last = p.t;
      const a = fn === 'tick' ? g.tick(p.t) : g[fn](p);
      for (const x of a) {
        actions.push(x);
        if (x.type === 'stick') stick = { forward: x.forward, strafe: x.strafe, run: x.run };
        else if (x.type === 'stick-end') stick = null;
        else if (x.type === 'look') ease.add(x.dHeading, x.dPitch);
      }
      const [dh, dp] = ease.step(dt);
      ctrl.look(dh, dp);
      ctrl.step(dt, stick ? { ...NO_INPUT, forward: stick.forward, strafe: stick.strafe, run: stick.run } : NO_INPUT);
      poses.push(ctrl.pose());
    }
    return { actions, poses };
  };
  const a = run();
  const b = run();
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  // the script really did something: a stick, looks, a pinch, a tap and a long press
  const seen = new Set(types(a.actions));
  for (const t of ['stick', 'stick-end', 'look', 'fov', 'tap', 'long-press']) expect(seen.has(t), t).toBe(true);
  // and the walk moved: the thumb wandered with the stick engaged, so the body covered some ground
  let walked = 0;
  for (let i = 1; i < a.poses.length; i++) {
    const p = a.poses[i - 1] as { x: number; z: number };
    const q = a.poses[i] as { x: number; z: number };
    walked += Math.hypot(q.x - p.x, q.z - p.z);
  }
  expect(walked).toBeGreaterThan(1);
});
