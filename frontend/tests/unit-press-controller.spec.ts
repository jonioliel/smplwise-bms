import { test, expect } from '@playwright/test';
import type { ReactiveControllerHost } from 'lit';
import { LONG_PRESS_MS, MOVE_SLOP_PX, PressController, exceedsSlop, type PressStart } from '../src/components/press-controller';
import { LONG_PRESS_MS as DEVICE_MS, MOVE_SLOP_PX as DEVICE_SLOP, exceedsSlop as deviceSlop } from '../src/components/device-activity-press';
import { ElevatorHistoryPress } from '../src/elevators/history-press';

// CR-MAP-NUM-PRESS-2440 (code review 08:F15): one long-press controller (components/press-controller.ts); the device
// activity press and the elevator history press are thin configurations of it. Node only: a fake host records the
// listeners, the events are plain objects.

type Listener = (e: unknown) => void;

class FakeHost {
  listeners: { type: string; fn: Listener; capture: boolean }[] = [];
  controllers: unknown[] = [];
  addController(c: unknown) {
    this.controllers.push(c);
  }
  addEventListener(type: string, fn: Listener, capture = false) {
    this.listeners.push({ type, fn, capture });
  }
  removeEventListener(type: string, fn: Listener, capture = false) {
    this.listeners = this.listeners.filter((l) => !(l.type === type && l.fn === fn && l.capture === capture));
  }
  fire(type: string, e: Record<string, unknown>) {
    const ev = { prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...e };
    for (const l of this.listeners.filter((x) => x.type === type)) l.fn(ev);
    return ev;
  }
}

interface Hit {
  el: HTMLElement;
  id: string;
}

class Probe extends PressController<Hit> {
  log: string[] = [];
  item: Hit | null = { el: { tag: 'card' } as unknown as HTMLElement, id: 'a' };
  menuItem: Hit | null | undefined = undefined; // undefined = the same as the press item
  protected findPress() {
    return this.item;
  }
  protected findMenu() {
    return this.menuItem === undefined ? this.item : this.menuItem;
  }
  protected longPress(s: PressStart<Hit>) {
    this.log.push(`long:${s.id}:${s.x},${s.y}:${s.type}`);
  }
  protected contextMenu(_e: MouseEvent, hit: Hit) {
    this.log.push(`menu:${hit.id}`);
  }
  protected keyDown(e: KeyboardEvent) {
    this.log.push(`key:${e.key}`);
  }
  protected pressStarted(hit: Hit) {
    this.log.push(`start:${hit.id}`);
  }
  protected pressEnded(completed: boolean) {
    this.log.push(`end:${completed}`);
  }
}

const g = globalThis as unknown as Record<string, unknown>;
let vibrations = 0;
let saved: Record<'window' | 'navigator', PropertyDescriptor | undefined>;
test.beforeEach(() => {
  saved = { window: Object.getOwnPropertyDescriptor(globalThis, 'window'), navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  vibrations = 0;
  Object.defineProperty(globalThis, 'window', { value: { setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms), clearTimeout: (id: number) => clearTimeout(id) }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { vibrate: () => { vibrations++; return true; } }, configurable: true, writable: true });
});
test.afterEach(() => {
  for (const k of ['window', 'navigator'] as const) {
    const d = saved[k];
    if (d) Object.defineProperty(globalThis, k, d);
    else delete g[k];
  }
});

const mk = () => {
  const host = new FakeHost();
  const c = new Probe(host as unknown as ReactiveControllerHost & HTMLElement);
  c.hostConnected();
  return { host, c };
};
const down = (over: Record<string, unknown> = {}) => ({ pointerType: 'touch', button: 0, isPrimary: true, clientX: 100, clientY: 50, ...over });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('the constants and the slop rule are one definition, re-exported by the device press', () => {
  expect(LONG_PRESS_MS).toBe(500);
  expect(MOVE_SLOP_PX).toBe(8);
  expect(DEVICE_MS).toBe(LONG_PRESS_MS);
  expect(DEVICE_SLOP).toBe(MOVE_SLOP_PX);
  expect(deviceSlop).toBe(exceedsSlop);
  expect(exceedsSlop(8, 0)).toBe(false);
  expect(exceedsSlop(6, 6)).toBe(true);
});

test('the listener set: seven listeners, the pointer / click / menu ones in the capture phase, all removed on disconnect', () => {
  const { host, c } = mk();
  expect(host.controllers).toEqual([c]);
  expect(host.listeners.map((l) => `${l.type}:${l.capture}`)).toEqual(['pointerdown:true', 'pointermove:true', 'pointerup:true', 'pointercancel:true', 'click:true', 'contextmenu:true', 'keydown:false']);
  c.hostDisconnected();
  expect(host.listeners).toEqual([]);
});

test('a held press fires once after the threshold, vibrates, and the click that follows is swallowed once', async () => {
  const { host, c } = mk();
  host.fire('pointerdown', down());
  expect(c.log).toEqual(['start:a']);
  await wait(LONG_PRESS_MS - 200);
  expect(c.log).toEqual(['start:a']); // not yet
  host.fire('pointermove', { clientX: 104, clientY: 53 }); // inside the slop
  await wait(350);
  expect(c.log).toEqual(['start:a', 'end:true', 'long:a:100,50:touch']);
  expect(vibrations).toBe(1);
  host.fire('pointerup', {});
  expect(c.log.length).toBe(3); // the press is over: the release ends nothing
  const first = host.fire('click', {});
  expect([first.prevented, first.stopped]).toEqual([true, true]);
  const second = host.fire('click', {});
  expect([second.prevented, second.stopped]).toEqual([false, false]);
});

test('movement past the slop, a release, a pointercancel and a disconnect each cancel the press', async () => {
  for (const end of ['move', 'pointerup', 'pointercancel', 'disconnect']) {
    const { host, c } = mk();
    host.fire('pointerdown', down());
    if (end === 'move') host.fire('pointermove', { clientX: 100, clientY: 59 });
    else if (end === 'disconnect') c.hostDisconnected();
    else host.fire(end, {});
    expect(c.log, end).toEqual(['start:a', 'end:false']);
    await wait(LONG_PRESS_MS + 100);
    expect(c.log, end).toEqual(['start:a', 'end:false']); // the timer is gone
    if (end !== 'disconnect') expect(host.fire('click', {}).prevented, end).toBe(false); // a normal tap is untouched
  }
  expect(vibrations).toBe(0);
});

test('a press never starts on a secondary mouse button, a non-primary pointer or where the subclass finds no item', async () => {
  const { host, c } = mk();
  host.fire('pointerdown', down({ pointerType: 'mouse', button: 2 }));
  host.fire('pointerdown', down({ isPrimary: false }));
  c.item = null;
  host.fire('pointerdown', down());
  await wait(LONG_PRESS_MS + 100);
  expect(c.log).toEqual([]);
});

test('the context menu: suppressed after a touch or pen press, handed to the subclass for a mouse or the keyboard', () => {
  const { host, c } = mk();
  // nothing under the pointer: the browser's menu is left alone
  c.menuItem = null;
  expect(host.fire('contextmenu', {}).prevented).toBe(false);
  c.menuItem = undefined;
  for (const type of ['touch', 'pen']) {
    host.fire('pointerdown', down({ pointerType: type }));
    const e = host.fire('contextmenu', {});
    expect(e.prevented).toBe(true);
    expect(c.log.filter((l) => l.startsWith('menu'))).toEqual([]);
    host.fire('pointerup', {});
  }
  c.log = [];
  host.fire('pointerdown', down({ pointerType: 'mouse', button: 2 })); // the right button: no press, but the pointer type is noted
  const e = host.fire('contextmenu', {});
  expect(e.prevented).toBe(true);
  expect(c.log).toEqual(['menu:a']);
  host.fire('keydown', { key: 'F10' });
  expect(c.log).toEqual(['menu:a', 'key:F10']);
});

test('the elevator press is a configuration of the shared controller: long press, right click and the keys open the history', async () => {
  const host = new FakeHost();
  const opened: string[] = [];
  const press = new ElevatorHistoryPress(host as unknown as ReactiveControllerHost & HTMLElement, (id) => opened.push(id));
  expect(press).toBeInstanceOf(PressController);
  press.hostConnected();
  const card = { tagName: 'DIV', getAttribute: (n: string) => (n === 'data-elevator' ? 'e7' : null) };
  const button = { tagName: 'BUTTON', getAttribute: () => null };
  const onCard = { composedPath: () => [{ tagName: 'SPAN', getAttribute: () => null }, card] };
  const onButton = { composedPath: () => [button, card] };
  host.fire('pointerdown', { ...down(), ...onButton }); // a button inside the card keeps its own gesture
  await wait(LONG_PRESS_MS + 100);
  expect(opened).toEqual([]);
  host.fire('pointerdown', { ...down(), ...onCard });
  await wait(LONG_PRESS_MS + 100);
  expect(opened).toEqual(['e7']);
  expect(host.fire('click', onCard).prevented).toBe(true);
  host.fire('pointerdown', { ...down({ pointerType: 'mouse', button: 2 }), ...onCard });
  host.fire('contextmenu', onCard);
  expect(opened).toEqual(['e7', 'e7']);
  for (const k of [{ key: 'Enter', altKey: true }, { key: 'ContextMenu' }, { key: 'F10', shiftKey: true }]) expect(host.fire('keydown', { ...k, ...onCard }).prevented).toBe(true);
  expect(opened.length).toBe(5);
  expect(host.fire('keydown', { key: 'Enter', ...onCard }).prevented).toBe(false); // a plain Enter is the card's own
  expect(opened.length).toBe(5);
});
