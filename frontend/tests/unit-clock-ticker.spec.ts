import { test, expect } from '@playwright/test';

// CLOCK-293: the shared wall-clock ticker (src/api/clock-ticker.ts), Node only. A hand-made fake of the timer, the wall clock and the
// page events stands in for the browser, so the spec can put the clock to sleep, jump it, hide the tab and count the live timers.

type Handler = () => void;
interface Fake {
  now: number;
  timers: Map<number, { at: number; fn: Handler }>;
  listeners: Map<string, Set<Handler>>;
  visibility: 'visible' | 'hidden';
  seq: number;
}

const fake: Fake = { now: 0, timers: new Map(), listeners: new Map(), visibility: 'visible', seq: 0 };
const g = globalThis as unknown as Record<string, unknown>;

function install() {
  fake.now = Date.UTC(2026, 9, 20, 13, 44, 20, 0); // 16:44:20 in Asia/Jerusalem (UTC+3)
  fake.timers.clear();
  fake.listeners.clear();
  fake.visibility = 'visible';
  const addL = (type: string, fn: Handler) => {
    if (!fake.listeners.has(type)) fake.listeners.set(type, new Set());
    fake.listeners.get(type)!.add(fn);
  };
  const delL = (type: string, fn: Handler) => void fake.listeners.get(type)?.delete(fn);
  g.window = {
    setTimeout: (fn: Handler, ms: number) => {
      const id = ++fake.seq;
      fake.timers.set(id, { at: fake.now + ms, fn });
      return id;
    },
    clearTimeout: (id: number) => void fake.timers.delete(id),
    addEventListener: addL,
    removeEventListener: delL,
  };
  g.document = {
    get visibilityState() {
      return fake.visibility;
    },
    addEventListener: addL,
    removeEventListener: delL,
  };
  Date.now = () => fake.now;
}

/** Move the wall clock by `ms`, firing every timer that falls due, in order (a timer fires at its own time). */
function advance(ms: number) {
  const end = fake.now + ms;
  for (;;) {
    const due = [...fake.timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    fake.timers.delete(due[0]);
    fake.now = Math.max(fake.now, due[1].at);
    due[1].fn();
  }
  fake.now = end;
}

/** The machine slept: the wall clock moved on by `ms` but no timer ran meanwhile (they are all late when it wakes). */
function sleep(ms: number) {
  fake.now += ms;
}

function emit(type: string) {
  fake.listeners.get(type)?.forEach((f) => f());
}

const realNow = Date.now;
test.afterEach(() => {
  Date.now = realNow;
  delete g.window;
  delete g.document;
});

const load = () => import('../src/api/clock-ticker');

test('a minute subscriber is told once per minute, on the minute, never in between', async () => {
  install();
  const { subscribeClock } = await load();
  const seen: number[] = [];
  const off = subscribeClock((n) => seen.push(n.getTime()));
  advance(30_000); // 16:44:50
  expect(seen).toEqual([]);
  advance(10_100); // 16:45:00 (+ the wake-up slack)
  expect(seen).toHaveLength(1);
  expect(new Date(seen[0]).getUTCSeconds()).toBeLessThan(2);
  expect(new Date(seen[0]).getUTCMinutes()).toBe(45);
  advance(5 * 60_000);
  expect(seen).toHaveLength(6);
  off();
});

test('a seconds subscriber is told each second; adding it does not make the minute subscriber chatty', async () => {
  install();
  const { subscribeClock } = await load();
  const minutes: number[] = [];
  const secs: number[] = [];
  const offM = subscribeClock((n) => minutes.push(n.getTime()));
  const offS = subscribeClock((n) => secs.push(n.getTime()), { seconds: true });
  advance(40_100); // to 16:45:00
  expect(secs).toHaveLength(40);
  expect(minutes).toHaveLength(1); // 16:45:00 only
  offS();
  advance(60_000);
  expect(secs).toHaveLength(40);
  expect(minutes).toHaveLength(2);
  offM();
});

test('the last unsubscribe stops the timer and removes every page listener; unsubscribing twice is harmless', async () => {
  install();
  const { subscribeClock, clockSubscribers } = await load();
  const a = subscribeClock(() => undefined);
  const b = subscribeClock(() => undefined);
  expect(clockSubscribers()).toBe(2);
  expect(fake.timers.size).toBe(1); // one timer for the whole page, however many subscribers
  expect([...fake.listeners.values()].reduce((n, s) => n + s.size, 0)).toBeGreaterThan(0);
  a();
  a();
  expect(clockSubscribers()).toBe(1);
  expect(fake.timers.size).toBe(1);
  b();
  expect(clockSubscribers()).toBe(0);
  expect(fake.timers.size).toBe(0);
  expect([...fake.listeners.values()].reduce((n, s) => n + s.size, 0)).toBe(0);
});

test('a system sleep: the next wake-up heals the clock within the wake-up cap, and a drift forces a notification', async () => {
  install();
  const { subscribeClock } = await load();
  const seen: Date[] = [];
  const off = subscribeClock((n) => seen.push(n));
  sleep(3 * 3600_000 + 17_000); // the laptop slept for three hours; the timers did not run
  advance(15_100); // the first timer that was armed before the sleep fires late
  expect(seen.length).toBeGreaterThanOrEqual(1);
  const last = seen[seen.length - 1];
  expect(Math.abs(last.getTime() - fake.now)).toBeLessThan(16_000); // it carries the real time, not the time before the sleep
  expect(last.getTime()).toBeGreaterThan(Date.UTC(2026, 9, 20, 16, 44, 0));
  off();
});

test('a tab that was hidden and is shown again, a focus and a pageshow each notify at once', async () => {
  install();
  const { subscribeClock } = await load();
  const seen: Date[] = [];
  const off = subscribeClock((n) => seen.push(n));
  fake.visibility = 'hidden';
  sleep(7 * 60_000); // a background tab: the timers are throttled to nothing
  emit('visibilitychange'); // hidden: ignored
  expect(seen).toHaveLength(0);
  fake.visibility = 'visible';
  emit('visibilitychange');
  expect(seen).toHaveLength(1);
  expect(seen[0].getTime()).toBe(fake.now);
  emit('focus');
  emit('pageshow');
  expect(seen).toHaveLength(3);
  off();
});

test('a listener that throws does not stop the others or the clock', async () => {
  install();
  const { subscribeClock } = await load();
  const seen: number[] = [];
  const a = subscribeClock(() => {
    throw new Error('boom');
  });
  const b = subscribeClock((n) => seen.push(n.getTime()));
  advance(2 * 60_000);
  expect(seen).toHaveLength(2);
  a();
  b();
});

test('the home subscription changes precision in place and stops cleanly', async () => {
  install();
  const { createClockSubscription, clockSubscribers } = await load();
  const seen: number[] = [];
  const c = createClockSubscription((n) => seen.push(n.getTime()));
  c.setSeconds(false);
  c.setSeconds(false); // idempotent: still one subscriber
  expect(clockSubscribers()).toBe(1);
  advance(60_000);
  expect(seen).toHaveLength(1);
  c.setSeconds(true);
  expect(clockSubscribers()).toBe(1);
  advance(5_100);
  expect(seen).toHaveLength(6);
  c.stop();
  expect(clockSubscribers()).toBe(0);
  expect(fake.timers.size).toBe(0);
});

test('midnight in the installation zone: the tick after 23:59 carries a date that is the next day there', async () => {
  install();
  fake.now = Date.UTC(2026, 9, 20, 20, 59, 30, 0); // 23:59:30 Asia/Jerusalem (UTC+3), 20.10
  const { subscribeClock } = await load();
  const seen: Date[] = [];
  const off = subscribeClock((n) => seen.push(n));
  advance(31_000);
  expect(seen).toHaveLength(1);
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
  expect(day(seen[0])).toBe('2026-10-21');
  off();
});
