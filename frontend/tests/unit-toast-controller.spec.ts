import { test, expect } from '@playwright/test';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { ToastController, TOAST_DEFAULT_MS, type ToastTimers } from '../src/components/toast-controller';

// CR-UI-CONTROLLERS-2440 (07:F12): the shared flash-message timer. Node only: a fake host and a fake clock.
//   npx playwright test -c playwright.unit.config.ts tests/unit-toast-controller.spec.ts

function fakeHost() {
  const controllers: ReactiveController[] = [];
  let updates = 0;
  const host = {
    addController: (c: ReactiveController) => void controllers.push(c),
    removeController() {},
    requestUpdate: () => void (updates += 1),
    updateComplete: Promise.resolve(true),
  } as unknown as ReactiveControllerHost;
  return { host, controllers, updates: () => updates };
}

/** A clock that only moves when the test says so. */
function fakeClock() {
  let now = 0;
  let seq = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const timers: ToastTimers = {
    setTimeout: (fn, ms) => {
      seq += 1;
      pending.set(seq, { at: now + ms, fn });
      return seq;
    },
    clearTimeout: (h) => void pending.delete(h as number),
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, t] of [...pending].sort((a, b) => a[1].at - b[1].at)) {
      if (t.at <= now && pending.has(id)) {
        pending.delete(id);
        t.fn();
      }
    }
  };
  return { timers, advance, pending: () => pending.size };
}

test('registers itself with the host and starts empty', () => {
  const h = fakeHost();
  const toast = new ToastController(h.host);
  expect(h.controllers).toEqual([toast]);
  expect(toast.text).toBe('');
  expect(toast.tone).toBe('');
  expect(toast.visible).toBe(false);
  expect(h.updates()).toBe(0);
});

test('show: the message and its tone are on show, the host is asked to update, and it expires after the default time', () => {
  const h = fakeHost();
  const clock = fakeClock();
  const toast = new ToastController(h.host, { timers: clock.timers });
  toast.show('נשמר', { tone: 'ok' });
  expect([toast.text, toast.tone, toast.visible]).toEqual(['נשמר', 'ok', true]);
  expect(h.updates()).toBe(1);
  clock.advance(TOAST_DEFAULT_MS - 1);
  expect(toast.text).toBe('נשמר');
  clock.advance(1);
  expect([toast.text, toast.tone, toast.visible]).toEqual(['', '', false]);
  expect(h.updates()).toBe(2);
  expect(clock.pending()).toBe(0);
});

test('replace: a second message gets its FULL time - the first timer never cuts it short (the door-windows fault)', () => {
  const h = fakeHost();
  const clock = fakeClock();
  const toast = new ToastController(h.host, { ms: 2500, timers: clock.timers });
  toast.show('ראשונה');
  clock.advance(2000);
  toast.show('שנייה');
  expect(clock.pending()).toBe(1); // one timer, not two
  clock.advance(600); // 2600 ms after the first: its timer would have fired here
  expect(toast.text).toBe('שנייה');
  clock.advance(1899);
  expect(toast.text).toBe('שנייה');
  clock.advance(1);
  expect(toast.text).toBe('');
});

test('replace with the SAME text restarts the clock too (the compare-the-text copies cut it short)', () => {
  const h = fakeHost();
  const clock = fakeClock();
  const toast = new ToastController(h.host, { ms: 1000, timers: clock.timers });
  toast.show('נשמר');
  clock.advance(900);
  toast.show('נשמר');
  expect(h.updates()).toBe(1); // nothing changed on screen: no extra update
  clock.advance(900);
  expect(toast.text).toBe('נשמר');
  clock.advance(100);
  expect(toast.text).toBe('');
});

test('durations: per call, per controller, and 0 / Infinity keep the message until it is cleared or replaced', () => {
  const h = fakeHost();
  const clock = fakeClock();
  const toast = new ToastController<'ok' | 'err'>(h.host, { ms: 2600, tone: 'ok', timers: clock.timers });
  toast.show('א');
  expect(toast.tone).toBe('ok'); // the controller's default tone
  clock.advance(2599);
  expect(toast.text).toBe('א');
  clock.advance(1);
  expect(toast.text).toBe('');

  toast.show('ב', { ms: 400, tone: 'err' });
  expect(toast.tone).toBe('err');
  clock.advance(400);
  expect(toast.text).toBe('');

  toast.show('ג', { ms: 0 });
  expect(clock.pending()).toBe(0);
  clock.advance(1_000_000);
  expect(toast.text).toBe('ג');
  toast.show('ד', { ms: Infinity });
  expect(clock.pending()).toBe(0);
  clock.advance(1_000_000);
  expect(toast.text).toBe('ד');
  toast.clear();
  expect(toast.text).toBe('');
});

test("clear and show('') drop the message and stop the timer", () => {
  const h = fakeHost();
  const clock = fakeClock();
  const toast = new ToastController(h.host, { timers: clock.timers });
  toast.show('א');
  toast.clear();
  expect([toast.text, clock.pending()]).toEqual(['', 0]);
  const before = h.updates();
  toast.clear(); // already empty: no update
  expect(h.updates()).toBe(before);
  toast.show('ב');
  toast.show('');
  expect([toast.text, toast.tone, clock.pending()]).toEqual(['', '', 0]);
});

test('disconnect: the timer is stopped, the message is gone, and no update is asked of the host that left', () => {
  const h = fakeHost();
  const clock = fakeClock();
  const toast = new ToastController(h.host, { timers: clock.timers });
  toast.show('נשמר', { tone: 'ok' });
  const before = h.updates();
  toast.hostDisconnected();
  expect(clock.pending()).toBe(0);
  expect([toast.text, toast.tone]).toEqual(['', '']);
  expect(h.updates()).toBe(before);
  clock.advance(10_000); // nothing left to fire
  expect(h.updates()).toBe(before);
  // the host comes back: the controller works again
  toast.show('שוב');
  expect(toast.text).toBe('שוב');
  clock.advance(TOAST_DEFAULT_MS);
  expect(toast.text).toBe('');
});

test('onChange hears every change once, the disconnect included', () => {
  const h = fakeHost();
  const clock = fakeClock();
  const seen: string[] = [];
  const toast = new ToastController(h.host, { timers: clock.timers, onChange: (text, tone) => seen.push(`${text}|${tone}`) });
  toast.show('א', { tone: 'ok' });
  toast.show('א', { tone: 'ok' });
  toast.show('ב');
  clock.advance(TOAST_DEFAULT_MS);
  toast.show('ג');
  toast.hostDisconnected();
  toast.hostDisconnected();
  expect(seen).toEqual(['א|ok', 'ב|', '|', 'ג|', '|']);
});

test('the real clock: without a fake, the message expires on its own', async () => {
  const h = fakeHost();
  const toast = new ToastController(h.host, { ms: 30 });
  toast.show('נשמר');
  expect(toast.text).toBe('נשמר');
  await new Promise((r) => setTimeout(r, 120));
  expect(toast.text).toBe('');
});
