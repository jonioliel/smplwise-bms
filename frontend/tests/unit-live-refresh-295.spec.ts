import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { LiveController, MAX_BACKOFF_MS, MIN_GAP_MS, NUDGE_GAP_MS, STAGGER_MS, type LiveEnv } from '../src/api/live-refresh';
import { HL_DEV_MARKED, HL_KEYS, HL_TABLES, hl } from '../src/i18n/home-live';

// HOMELIVE-295: the home screen's live refresh controller (api/live-refresh.ts) with a fake clock and fake page events.
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

/** A virtual clock + event source: `advance(ms)` fires the due timers in order; `resume()` / `online()` are the page events. */
function fakeEnv() {
  let now = 1_000_000;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const state = { visible: true, online: true };
  let onResume: () => void = () => undefined;
  let onOnline: () => void = () => undefined;
  let registered = 0;
  const env: LiveEnv = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
    visible: () => state.visible,
    online: () => state.online,
    onResume: (a, b) => {
      onResume = a;
      onOnline = b;
      registered++;
      return () => {
        registered--;
        onResume = onOnline = () => undefined;
      };
    },
    random: () => 0.5, // no jitter: (0.5 * 2 - 1) = 0
  };
  const advance = async (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      now = due[1].at;
      timers.delete(due[0]);
      due[1].fn();
      await Promise.resolve();
      await Promise.resolve();
    }
    now = end;
    await Promise.resolve();
    await Promise.resolve();
  };
  return { env, state, advance, resume: () => onResume(), online: () => onOnline(), pending: () => timers.size, listeners: () => registered };
}

function source(id: string, calls: string[], opts: { fail?: () => boolean; pollMs?: number | (() => number); enabled?: () => boolean } = {}) {
  return { id, pollMs: opts.pollMs ?? 30_000, enabled: opts.enabled, run: () => { calls.push(id); return opts.fail?.() ? false : true; } };
}

test('polls every period while visible, one at a time per source', async () => {
  const f = fakeEnv();
  const calls: string[] = [];
  const c = new LiveController(f.env).add(source('elevators', calls));
  c.start();
  await f.advance(29_000);
  expect(calls).toEqual([]);
  await f.advance(2_000);
  expect(calls).toEqual(['elevators']);
  await f.advance(60_000);
  expect(calls.length).toBe(3);
  c.stop();
});

test('nothing is requested while the page is hidden; the timers keep looking, so a resume without an event still heals', async () => {
  const f = fakeEnv();
  const calls: string[] = [];
  const c = new LiveController(f.env).add(source('tree', calls));
  c.start();
  f.state.visible = false;
  await f.advance(300_000);
  expect(calls).toEqual([]);
  f.state.visible = true; // the phone woke up, the event was lost
  await f.advance(31_000);
  expect(calls).toEqual(['tree']);
  c.stop();
});

test('visibility / focus / pageshow resume refreshes stale sources, staggered; a focus + visibility pair is one refresh', async () => {
  const f = fakeEnv();
  const calls: string[] = [];
  const c = new LiveController(f.env).add(source('tree', calls, { pollMs: 1_000_000 })).add(source('elevators', calls, { pollMs: 1_000_000 })).add(source('generators', calls, { pollMs: 1_000_000 }));
  c.start();
  f.state.visible = false;
  await f.advance(120_000); // asleep: nothing ran
  expect(calls).toEqual([]);
  f.state.visible = true;
  f.resume(); // visibilitychange
  f.resume(); // focus, same instant
  await f.advance(0);
  expect(calls).toEqual(['tree']); // the first source at once, the others staggered
  await f.advance(STAGGER_MS * 2 + 10);
  expect(calls).toEqual(['tree', 'elevators', 'generators']);
  // a second resume right after (focus flicker) does not request again
  f.resume();
  await f.advance(STAGGER_MS * 3);
  expect(calls.length).toBe(3);
  // after the minimum gap it does
  await f.advance(MIN_GAP_MS);
  f.resume();
  await f.advance(STAGGER_MS * 3);
  expect(calls.length).toBe(6);
  c.stop();
});

test('a resume while the source is still reading does not start a second read; a hidden resume does nothing', async () => {
  const f = fakeEnv();
  let release: () => void = () => undefined;
  let started = 0;
  const c = new LiveController(f.env).add({ id: 'slow', pollMs: 30_000, run: () => { started++; return new Promise<void>((r) => (release = r)); } });
  c.start();
  await f.advance(31_000);
  expect(started).toBe(1);
  await f.advance(MIN_GAP_MS + 1);
  f.resume();
  await f.advance(10);
  expect(started).toBe(1);
  release();
  await f.advance(10);
  c.stop();
  f.state.visible = false;
  c.start();
  f.resume();
  await f.advance(10);
  expect(started).toBe(1);
  c.stop();
});

test('a failure backs the source off (x2 per failure, capped); online and a manual refresh reset it; success clears failing()', async () => {
  const f = fakeEnv();
  const calls: string[] = [];
  let bad = true;
  const c = new LiveController(f.env).add(source('elevators', calls, { fail: () => bad }));
  c.start();
  await f.advance(30_001);
  expect(calls.length).toBe(1);
  expect(c.failing()).toBe(true);
  await f.advance(59_000); // the second period is 60 s now
  expect(calls.length).toBe(1);
  await f.advance(2_000);
  expect(calls.length).toBe(2);
  await f.advance(10 * 60_000);
  const n = calls.length;
  await f.advance(MAX_BACKOFF_MS + 1_000); // never longer than the cap between two reads
  expect(calls.length).toBeGreaterThan(n);
  bad = false;
  f.online(); // the network is back: retry now, failure streak reset
  await f.advance(10);
  expect(c.failing()).toBe(false);
  const before = calls.length;
  await f.advance(30_001); // back on the normal 30 s
  expect(calls.length).toBe(before + 1);
  c.stop();
});

test('offline: no requests; the online event retries at once', async () => {
  const f = fakeEnv();
  const calls: string[] = [];
  const c = new LiveController(f.env).add(source('tree', calls));
  c.start();
  f.state.online = false;
  await f.advance(120_000);
  expect(calls).toEqual([]);
  f.state.online = true;
  f.online();
  await f.advance(10);
  expect(calls).toEqual(['tree']);
  c.stop();
});

test('a disabled source is never requested and is picked up again when it becomes enabled', async () => {
  const f = fakeEnv();
  const calls: string[] = [];
  let on = false;
  const c = new LiveController(f.env).add(source('generators', calls, { enabled: () => on }));
  c.start();
  await f.advance(100_000);
  f.resume();
  await f.advance(10);
  expect(calls).toEqual([]);
  on = true;
  await f.advance(31_000);
  expect(calls).toEqual(['generators']);
  c.stop();
});

test('nudge: a push re-reads a source only when its data is older than the gap (a push storm stays bounded)', async () => {
  const f = fakeEnv();
  const calls: string[] = [];
  const c = new LiveController(f.env).add(source('elevators', calls));
  c.start();
  c.markRead('elevators', true);
  c.nudge('elevators');
  await f.advance(10);
  expect(calls).toEqual([]); // just read
  await f.advance(NUDGE_GAP_MS + 1);
  for (let i = 0; i < 50; i++) c.nudge('elevators'); // 50 pushes in one instant
  await f.advance(10);
  expect(calls).toEqual(['elevators']); // one read
  for (let i = 0; i < 50; i++) c.nudge('elevators');
  await f.advance(10);
  expect(calls.length).toBe(1);
  c.stop();
});

test('refreshAll (the refresh button) reads every source now, resets backoff, and can skip one; ageOf / lastOkAt feed the stale dot', async () => {
  const f = fakeEnv();
  const calls: string[] = [];
  const c = new LiveController(f.env).add(source('tree', calls)).add(source('elevators', calls));
  c.start();
  expect(c.ageOf('tree')).toBe(Number.POSITIVE_INFINITY);
  expect(c.lastOkAt()).toBe(0);
  c.refreshAll(['tree']);
  await f.advance(STAGGER_MS + 10);
  expect(calls).toEqual(['elevators']);
  expect(c.ageOf('elevators')).toBeLessThan(1000);
  expect(c.lastOkAt()).toBeGreaterThan(0);
  await f.advance(100_000);
  expect(c.ageOf('elevators')).toBeLessThan(40_000); // it kept polling by itself
  c.stop();
});

test('a push-driven period function is re-read at every arm (the tree tightens when the socket is down)', async () => {
  const f = fakeEnv();
  const calls: string[] = [];
  let live = true;
  const c = new LiveController(f.env).add(source('tree', calls, { pollMs: () => (live ? 300_000 : 60_000) }));
  c.start();
  await f.advance(301_000);
  expect(calls.length).toBe(1);
  live = false;
  await f.advance(301_000); // the armed 300 s timer fires, then it is 60 s from there
  expect(calls.length).toBe(2);
  await f.advance(121_000);
  expect(calls.length).toBe(4);
  c.stop();
});

test('stop() removes the listeners and every timer; nothing runs afterwards', async () => {
  const f = fakeEnv();
  const calls: string[] = [];
  const c = new LiveController(f.env).add(source('tree', calls)).add(source('elevators', calls));
  c.start();
  expect(f.listeners()).toBe(1);
  c.refreshAll();
  c.stop();
  expect(f.listeners()).toBe(0);
  await f.advance(600_000);
  expect(calls.length).toBeLessThanOrEqual(1); // only the immediate one of the refresh
  c.nudge('tree');
  await f.advance(10);
  expect(calls.length).toBeLessThanOrEqual(1);
});

test('the home screen uses the controller instead of bare intervals, keeps the failure panels, and the socket revives on resume', () => {
  const b = src('screens/devices-building.ts');
  expect(b).toContain("new LiveController()");
  expect(b).not.toContain('this.elevatorsTimer');
  expect(b).not.toContain('this.tempTimer');
  expect(b).not.toContain('this.generatorsTimer');
  expect(b).toContain("setWidgetFailed('elevators'"); // UXREST2-295 panels are still driven by the same reads
  expect(b).toContain("setWidgetFailed('temperature'");
  expect(b).toContain("setWidgetFailed('generators'");
  expect(b).toContain('data-home-stale');
  const ha = src('api/ha.ts');
  expect(ha).toContain("document.addEventListener('visibilitychange', onResume)");
  expect(ha).toContain("window.addEventListener('online', onOnline)");
  expect(ha).toContain('SILENT_MS');
});

test('the stale words exist in every column; ar / ru stay dev-marked', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) for (const k of HL_KEYS) expect(HL_TABLES[lang][k], `${lang}.${k}`).toBeTruthy();
  expect([...HL_DEV_MARKED]).toEqual(['ar', 'ru']);
  expect(hl('stale', 'he')).toContain('מעודכנים');
  expect(hl('updated', 'en')).toBe('Updated');
  expect(src('i18n/home-live.ts')).not.toMatch(/Home Assistant|\bHA\b/);
});

test('a silent source (nothing known to exist) backs off but never makes failing() true', async () => {
  const f = fakeEnv();
  const calls: string[] = [];
  let known = false;
  const c = new LiveController(f.env).add({ ...source('temperature', calls, { fail: () => true }), silent: () => !known });
  c.start();
  await f.advance(31_000);
  expect(calls.length).toBe(1);
  expect(c.failing()).toBe(false);
  known = true; // data was on screen: now a failure matters
  expect(c.failing()).toBe(true);
  c.stop();
});
