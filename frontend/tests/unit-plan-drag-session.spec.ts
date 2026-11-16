import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dragSession, type DragTarget } from '../src/map/drag-session';

// CR-PLAN-CANVAS-DRAG-2440 (code review 08:F14, lead decision L10): one pointer-drag session helper (map/drag-session.ts)
// for the plan canvas. A release commits, a `pointercancel` cancels - never commits -, the three listeners are removed
// before either handler runs and exactly one of the two runs once. Node only: the target is a plain listener table.

type Fn = (e: PointerEvent) => void;

class Target implements DragTarget {
  table: { type: string; fn: Fn }[] = [];
  addEventListener(type: string, fn: Fn) {
    this.table.push({ type, fn });
  }
  removeEventListener(type: string, fn: Fn) {
    this.table = this.table.filter((l) => !(l.type === type && l.fn === fn));
  }
  fire(type: string, at = 0) {
    for (const l of [...this.table].filter((x) => x.type === type)) l.fn({ type, clientX: at, clientY: at } as PointerEvent);
  }
  get types() {
    return this.table.map((l) => l.type).sort();
  }
}

const session = () => {
  const target = new Target();
  const log: string[] = [];
  const stop = dragSession(target, {
    move: (e) => log.push(`move:${e.clientX}:${target.table.length}`),
    commit: (e) => log.push(`commit:${e.clientX}:${target.table.length}`),
    cancel: (e) => log.push(`cancel:${e.clientX}:${target.table.length}`),
  });
  return { target, log, stop };
};

test('a session listens for move, release and cancel; a release commits once and removes the listeners first', () => {
  const { target, log } = session();
  expect(target.types).toEqual(['pointercancel', 'pointermove', 'pointerup']);
  target.fire('pointermove', 5);
  target.fire('pointermove', 9);
  target.fire('pointerup', 12);
  expect(log).toEqual(['move:5:3', 'move:9:3', 'commit:12:0']); // :0 - no listener is left when the handler runs
  expect(target.table).toEqual([]);
});

test('a pointercancel mid-drag cancels and never commits', () => {
  const { target, log } = session();
  target.fire('pointermove', 5);
  target.fire('pointercancel', 0); // the cancel event carries no pointer position
  expect(log).toEqual(['move:5:3', 'cancel:0:0']);
  expect(target.table).toEqual([]);
  // nothing of the gesture is left to fire
  target.fire('pointermove', 7);
  target.fire('pointerup', 7);
  target.fire('pointercancel', 7);
  expect(log).toEqual(['move:5:3', 'cancel:0:0']);
});

test('exactly one ending: a handler that is called again after the end does nothing', () => {
  const target = new Target();
  const log: string[] = [];
  const kept: Record<string, Fn> = {};
  const spy: DragTarget = {
    addEventListener: (type, fn) => {
      kept[type] = fn;
      target.addEventListener(type, fn);
    },
    removeEventListener: (type, fn) => target.removeEventListener(type, fn),
  };
  dragSession(spy, { move: () => log.push('move'), commit: () => log.push('commit'), cancel: () => log.push('cancel') });
  const e = {} as PointerEvent;
  kept.pointerup(e);
  kept.pointercancel(e); // a late cancel of the same gesture (both were already queued)
  kept.pointerup(e);
  kept.pointermove(e);
  expect(log).toEqual(['commit']);
});

test('the returned function ends a session early without a commit or a cancel', () => {
  const { target, log, stop } = session();
  target.fire('pointermove', 1);
  stop();
  expect(target.table).toEqual([]);
  target.fire('pointerup', 2);
  stop(); // twice is harmless
  expect(log).toEqual(['move:1:3']);
});

test('two sessions on one target are independent', () => {
  const target = new Target();
  const log: string[] = [];
  dragSession(target, { move: () => log.push('a:move'), commit: () => log.push('a:commit'), cancel: () => log.push('a:cancel') });
  target.fire('pointercancel');
  dragSession(target, { move: () => log.push('b:move'), commit: () => log.push('b:commit'), cancel: () => log.push('b:cancel') });
  target.fire('pointermove');
  target.fire('pointerup');
  expect(log).toEqual(['a:cancel', 'b:move', 'b:commit']);
});

test('the plan canvas: every drag goes through the session, and no tool commits on a cancel', () => {
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'map', 'sw-plan-canvas.ts'), 'utf8');
  // no hand-written pointer listener is left on the viewport (the template's own @pointer... handlers are not these)
  expect(src).not.toMatch(/\.(add|remove)EventListener\('pointer(move|up|cancel)'/);
  const calls = [...src.matchAll(/dragSession\(this\.viewport, \{ move, commit: (\w+), cancel(?:: (\w+))? \}\);/g)];
  expect(calls.length).toBe(9); // pin, zone corner, zone body, camera handle, range, coverage corner, geometry, candidate, door ghost
  for (const c of calls) expect(c[2] ?? 'cancel', c[0]).not.toBe(c[1]); // the cancel handler is never the commit handler
  // each cancel handler dispatches nothing but the geometry drag's own `geom-drag-cancel`
  const cancels = [...src.matchAll(/const cancel = \(\) => (\{[\s\S]*?\n {4}\};|[^\n]*;)/g)].map((m) => m[1]);
  expect(cancels.length).toBe(9);
  for (const body of cancels) {
    expect(body).not.toMatch(/marker-move|marker-orient|marker-coverage|zone-edit|emitZoneEdit|candidate-drag|ghost-handle|send\(/);
    if (/emit\(/.test(body)) expect(body).toContain("'geom-drag-cancel'");
  }
  // the "ignore the click that follows a drag" pair is one method
  expect(src.match(/setTimeout\(\(\) => \(this\.dragMoved = false\), 0\)/g)?.length).toBe(1);
});
