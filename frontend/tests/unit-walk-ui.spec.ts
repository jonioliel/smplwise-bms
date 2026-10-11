import { test, expect } from '@playwright/test';
import type { SceneView } from '../src/map/scene-three';
import type { SwWalkHud, WalkHudField, WalkHudGoto, WalkHudRoute } from '../src/map/walk-hud';
import type { MinimapFrame } from '../src/map/walk-minimap';
import type { WalkSession } from '../src/map/walk-session';
import { EDGE_M, WalkController } from '../src/map/walk-controller';
import { minimapFrame } from '../src/map/walk-minimap';
import { WalkTouchUi, type WalkUiHost } from '../src/map/walk-touch-ui';
import type { TapHit } from '../src/map/walk-tap';
import { walkDoc, walkWorld } from './walk-fixtures';

// Plan Studio 6, slice S5-A: the glue between the session's gesture callbacks, the HUD, the minimap and the host element
// (walk-touch-ui.ts) in node, with a real controller and fakes for the view, the HUD and the session. What the browser spec
// proves end to end is proved here edge by edge: the last input, tap / stop / unreachable, the long press that selects only a
// device, the destination ring, the route state, the HUD's events and the minimap under a pointer.
//   npx playwright test tests/unit-walk-ui.spec.ts --project=desktop
const world = () => walkWorld(walkDoc(), { 'binary_sensor.d1': 'on' });

interface Rig {
  ui: WalkTouchUi;
  ctrl: WalkController;
  log: { touching: boolean[]; messages: [string, string][]; selected: TapHit[]; kicks: number; goTos: string[]; route: string[]; ring: ({ x: number; y: number } | null)[]; fov: number[] };
  hud: { routePlaying: boolean };
  setPick(hit: TapHit | null): void;
  setFloor(p: [number, number] | null): void;
  setFrame(f: MinimapFrame | null): void;
}

function rig(w = world()): Rig {
  const ctrl = new WalkController(w);
  ctrl.placeAt(3, 2.4, 'L0', 0);
  let pick: TapHit | null = null;
  let floor: [number, number] | null = null;
  let frame: MinimapFrame | null = null;
  const log: Rig['log'] = { touching: [], messages: [], selected: [], kicks: 0, goTos: [], route: [], ring: [], fov: [] };
  const hud = { routePlaying: false, setStick: () => undefined, setFade: () => undefined, setTarget: (p: { x: number; y: number } | null) => void log.ring.push(p) };
  const view = {
    pickAt: () => pick,
    floorPoint: () => floor,
    projectPoint: (p: [number, number, number]) => (p[0] > 0 ? { x: Math.round(p[0] * 10), y: Math.round(p[2] * 10) } : null),
    setWalkFov: (f: number) => void log.fov.push(f),
  };
  const walk = {
    ctrl,
    kick: () => void log.kicks++,
    goTo: (s: { id: string }) => {
      log.goTos.push(s.id);
      ctrl.place(s as never);
    },
    playRoute: () => (log.route.push('play'), true),
    cancelRoute: () => void log.route.push('stop'),
  };
  const host: WalkUiHost = {
    view: () => view as unknown as SceneView,
    walk: () => walk as unknown as WalkSession,
    hud: () => hud as unknown as SwWalkHud,
    world: () => w,
    minimap: () => frame,
    select: (hit) => void log.selected.push(hit),
    message: (text, tone) => void log.messages.push([text, tone]),
    touching: (on) => void log.touching.push(on),
  };
  return { ui: new WalkTouchUi(host), ctrl, log, hud, setPick: (h) => (pick = h), setFloor: (p) => (floor = p), setFrame: (f) => (frame = f) };
}
const hit = (kind: string, point: [number, number, number] = [6.3, 1, 2.4]): TapHit => ({ id: `${kind}-1`, kind, partId: `p-${kind}`, point });

test('the last input: a finger hides the crosshair, a key or the mouse brings it back, the same kind says nothing twice', () => {
  const r = rig();
  const hooks = r.ui.hooks();
  expect(r.ui.touch).toBe(false);
  hooks.onInput!('touch');
  hooks.onInput!('touch');
  expect(r.ui.touch).toBe(true);
  hooks.onInput!('key');
  expect(r.ui.touch).toBe(false);
  hooks.onInput!('mouse');
  hooks.onInput!('touch');
  expect(r.log.touching).toEqual([true, false, false, true]);
  r.ui.reset();
  expect(r.ui.touch).toBe(false);
  expect(r.log.touching.at(-1)).toBe(false);
});

test('a tap walks and rings the destination; a tap while walking stops it and clears the ring; no way says so', () => {
  const r = rig();
  r.setFloor([6.3, 2.4]);
  r.ui.tap(100, 100);
  expect(r.ctrl.path).toEqual([[6.3, 2.4]]);
  expect(r.log.kicks).toBe(1);
  expect(r.log.ring.at(-1)).toEqual({ x: 63, y: 24 }); // the ring is on the destination, projected by the view
  r.ui.tap(10, 10); // while walking: stop
  expect(r.ctrl.path).toBeNull();
  expect(r.log.ring.at(-1)).toBeNull();
  expect(r.log.kicks).toBe(1); // a stop starts nothing
  // no floor under the finger: nothing happens
  r.setFloor(null);
  r.ui.tap(10, 10);
  expect(r.ctrl.path).toBeNull();
  expect(r.log.messages).toEqual([]);
  // a way that does not exist: both doors of the middle wall closed
  const shutDoc = walkDoc({ openings: walkDoc().openings.map((o) => (o.id === 'd-free' ? { ...o, anchor_ref: { resource_type: 'ha_entity' as const, resource_id: 'binary_sensor.d2' } } : o)) });
  const closed = rig(walkWorld(shutDoc, { 'binary_sensor.d1': 'off', 'binary_sensor.d2': 'off' }));
  closed.setFloor([6.3, 2.4]);
  closed.ui.tap(1, 1);
  expect(closed.ctrl.path).toBeNull();
  expect(closed.log.messages).toEqual([['אין דרך פתוחה לשם', 'warn']]);
  expect(closed.log.kicks).toBe(0);
});

test('the ring follows the walk and goes away with it', () => {
  const r = rig();
  r.setFloor([6.3, 2.4]);
  r.ui.tap(1, 1);
  const n = r.log.ring.length;
  r.ui.updateTarget();
  expect(r.log.ring.length).toBe(n + 1); // placed again after every pose
  r.ctrl.cancelPath();
  r.ui.updateTarget();
  expect(r.log.ring.at(-1)).toBeNull();
  const after = r.log.ring.length;
  r.ui.updateTarget();
  expect(r.log.ring.length).toBe(after); // and said once
});

test('a long press picks only a device; a wall, the floor and nothing open nothing', () => {
  const r = rig();
  for (const kind of ['entity', 'camera', 'object', 'opening']) {
    r.setPick(hit(kind));
    r.ui.longPress(5, 5);
  }
  expect(r.log.selected.map((h) => h.kind)).toEqual(['entity', 'camera', 'object', 'opening']);
  for (const kind of ['wall', 'zone', 'connector']) {
    r.setPick(hit(kind));
    r.ui.longPress(5, 5);
  }
  r.setPick(null);
  r.ui.longPress(5, 5);
  expect(r.log.selected).toHaveLength(4);
  expect(r.ctrl.path).toBeNull(); // a long press never walks
});

test('the route state reaches the HUD and says which stop it is on', () => {
  const r = rig();
  r.ui.route({ playing: true });
  expect(r.hud.routePlaying).toBe(true);
  r.ui.route({ playing: true, index: 1, label: 'סלון' });
  expect(r.log.messages).toEqual([['סלון', 'info']]);
  r.ui.route({ playing: false });
  expect(r.hud.routePlaying).toBe(false);
  // the HUD's play button starts and stops it through the session
  r.ui.routeToggle(new CustomEvent<WalkHudRoute>('hud-route', { detail: { play: true } }));
  r.ui.routeToggle(new CustomEvent<WalkHudRoute>('hud-route', { detail: { play: false } }));
  expect(r.log.route).toEqual(['play', 'stop']);
});

test("the HUD's places and numeric fields move the walk", () => {
  const r = rig();
  r.ui.goto(new CustomEvent<WalkHudGoto>('hud-goto', { detail: { id: 'door:d-ext' } }));
  expect(r.log.goTos).toEqual(['door:d-ext']);
  const door = r.ctrl.world.starts.find((s) => s.id === 'door:d-ext')!;
  expect(Math.hypot(r.ctrl.x - door.x, r.ctrl.z - door.z)).toBeLessThan(0.05);
  r.ui.goto(new CustomEvent<WalkHudGoto>('hud-goto', { detail: { id: 'nope' } }));
  expect(r.log.goTos).toHaveLength(1);
  // a field changes one number and keeps the others
  const [x, z] = [r.ctrl.x, r.ctrl.z];
  r.ui.field(new CustomEvent<WalkHudField>('hud-field', { detail: { key: 'heading', value: 135 } }));
  expect(r.ctrl.heading).toBe(135);
  expect([r.ctrl.x, r.ctrl.z]).toEqual([x, z]);
  r.ui.field(new CustomEvent<WalkHudField>('hud-field', { detail: { key: 'x', value: 6 } }));
  expect(r.ctrl.x).toBeCloseTo(6, 1);
  expect(r.ctrl.heading).toBe(135);
});

/** A pointer event with just what the glue reads. */
function pe(over: Partial<{ pointerType: string; button: number; pointerId: number; clientX: number; clientY: number }> = {}): PointerEvent {
  const box = { left: 100, top: 50, width: 160, height: 160 };
  return { pointerType: 'touch', button: 0, pointerId: 1, clientX: 180, clientY: 130, preventDefault: () => undefined, currentTarget: { setPointerCapture: () => undefined, getBoundingClientRect: () => box }, ...over } as unknown as PointerEvent;
}

test('the minimap: a touch teleports, a drag follows its own pointer, the point is held inside the extent, a right button is ignored', () => {
  const r = rig();
  const lv = r.ctrl.world.levels[0];
  const f = minimapFrame(lv.extent, 160);
  r.setFrame(f);
  // the middle of the map: where the minimap maps to
  r.ui.minimapDown(pe({ clientX: 100 + 80, clientY: 50 + 80 }));
  const [mx, mz] = f.toM(80, 80);
  expect(r.ctrl.x).toBeCloseTo(mx, 0);
  expect(r.ctrl.z).toBeCloseTo(mz, 0);
  expect(r.log.touching).toEqual([true]); // a finger on the minimap is a finger
  // a drag by the same pointer follows; another pointer's moves do not
  r.ui.minimapMove(pe({ clientX: 100 + 120, clientY: 50 + 80 }));
  const xs = r.ctrl.x;
  expect(xs).toBeGreaterThan(mx + 0.5);
  r.ui.minimapMove(pe({ pointerId: 9, clientX: 100 + 20, clientY: 50 + 80 }));
  expect(r.ctrl.x).toBe(xs);
  r.ui.minimapUp(pe());
  r.ui.minimapMove(pe({ clientX: 100 + 20, clientY: 50 + 80 }));
  expect(r.ctrl.x).toBe(xs); // lifted: a late move does nothing
  // the far corner of the canvas (outside the plan) is held inside the level's extent
  r.ui.minimapDown(pe({ clientX: 100 + 160, clientY: 50 + 160 }));
  // (held at EDGE_M inside the extent, then pushed out of the corner's wall by the placement: still inside the extent, near its edge)
  expect(r.ctrl.x).toBeLessThanOrEqual(lv.extent.maxX);
  expect(r.ctrl.z).toBeLessThanOrEqual(lv.extent.maxZ);
  expect(r.ctrl.x).toBeGreaterThan(lv.extent.maxX - 3 * EDGE_M);
  expect(r.ctrl.z).toBeGreaterThan(lv.extent.maxZ - 3 * EDGE_M);
  r.ui.minimapUp(pe());
  // a mouse's right button does nothing; no frame, no walk: nothing breaks
  const before = [r.ctrl.x, r.ctrl.z];
  r.ui.minimapDown(pe({ pointerType: 'mouse', button: 2, clientX: 100 + 10, clientY: 50 + 10 }));
  expect([r.ctrl.x, r.ctrl.z]).toEqual(before);
  r.setFrame(null);
  r.ui.minimapDown(pe({ clientX: 100 + 10, clientY: 50 + 10 }));
  expect([r.ctrl.x, r.ctrl.z]).toEqual(before);
});
