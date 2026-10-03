import { test, expect } from '@playwright/test';
import {
  PERF_CACHE_KEY, PERF_THRESHOLDS, capsVerdict, decide, frameVerdict, median, readCached, runProbe, signature, writeCached,
  type Caps, type ProbeEnv,
} from '../src/design/performance';

// The performance tier (owner pre-approval 2026-10-02): how `auto` decides. Node only; the timings are mocked.

const STRONG: Caps = { cores: 16, memoryGb: 8, reducedMotion: false, reducedTransparency: false, dpr: 1 };
const memoryStore = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

test('the thresholds are the documented ones', () => {
  expect(PERF_THRESHOLDS).toMatchObject({ maxCores: 4, maxMemoryGb: 2, medianFrameMs: 24, probeMs: 700 });
});

test('weak-signal check: cores <= 4, memory <= 2 GB, reduced motion, reduced transparency; a strong device or unknown values are not weak', () => {
  expect(capsVerdict(STRONG)).toBeNull();
  expect(capsVerdict({ ...STRONG, cores: 4 })).toBe('cores');
  expect(capsVerdict({ ...STRONG, cores: 5 })).toBeNull();
  expect(capsVerdict({ ...STRONG, cores: 2 })).toBe('cores');
  expect(capsVerdict({ ...STRONG, memoryGb: 2 })).toBe('memory');
  expect(capsVerdict({ ...STRONG, memoryGb: 4 })).toBeNull();
  expect(capsVerdict({ ...STRONG, memoryGb: 0.5 })).toBe('memory');
  expect(capsVerdict({ ...STRONG, reducedMotion: true })).toBe('reduced-motion');
  expect(capsVerdict({ ...STRONG, reducedTransparency: true })).toBe('reduced-transparency');
  // a browser that does not report the number (Safari, Firefox: no deviceMemory) is not penalised
  expect(capsVerdict({ ...STRONG, cores: null, memoryGb: null })).toBeNull();
  expect(capsVerdict({ ...STRONG, cores: 0 })).toBeNull();
});

test('median and the frame verdict: median > 24 ms => lite, the warm-up frames do not count, too few frames is no verdict', () => {
  expect(median([])).toBe(0);
  expect(median([5, 1, 3])).toBe(3);
  expect(median([1, 2, 3, 4])).toBe(2.5);
  const warm = [90, 80, 70]; // layer creation hiccups
  const smooth = Array.from({ length: 40 }, () => 16.7);
  const slow = Array.from({ length: 40 }, () => 33.3);
  expect(frameVerdict([...warm, ...smooth])).toBe('full');
  expect(frameVerdict([...warm, ...slow])).toBe('lite');
  // exactly at the threshold is still full; just above is lite
  expect(frameVerdict([...warm, ...Array.from({ length: 20 }, () => 24)])).toBe('full');
  expect(frameVerdict([...warm, ...Array.from({ length: 20 }, () => 24.5)])).toBe('lite');
  // a few long frames among smooth ones do not make a weak device (the median decides, not the mean)
  expect(frameVerdict([...warm, ...smooth, 120, 130, 140])).toBe('full');
  // too few frames after the warm-up
  expect(frameVerdict([...warm, ...Array.from({ length: PERF_THRESHOLDS.minFrames - 1 }, () => 40)])).toBeNull();
  expect(frameVerdict([])).toBeNull();
});

test('decide: a weak capability is lite with no probe; a cached verdict is used with no probe; nothing known starts full and asks for the probe', () => {
  expect(decide({ ...STRONG, cores: 2 }, 'full')).toEqual({ tier: 'lite', probe: false, reason: 'cores' }); // a weak signal beats a stale cache
  expect(decide(STRONG, 'lite')).toEqual({ tier: 'lite', probe: false, reason: 'cache' });
  expect(decide(STRONG, 'full')).toEqual({ tier: 'full', probe: false, reason: 'cache' });
  expect(decide(STRONG, null)).toEqual({ tier: 'full', probe: true, reason: 'default' });
});

test('the cache: per device class, fresh for 30 days, validated; a bad value is ignored', () => {
  const store = memoryStore();
  const now = Date.UTC(2026, 9, 2);
  expect(readCached(STRONG, now, store)).toBeNull();
  writeCached(STRONG, 'lite', now, store);
  expect(readCached(STRONG, now + 86_400_000, store)).toBe('lite');
  expect(readCached(STRONG, now + 29 * 86_400_000, store)).toBe('lite');
  expect(readCached(STRONG, now + 31 * 86_400_000, store)).toBeNull(); // stale: measure again
  expect(readCached({ ...STRONG, cores: 8 }, now, store)).toBeNull(); // another device class (a synced profile on another machine)
  expect(readCached({ ...STRONG, dpr: 2 }, now, store)).toBeNull();
  expect(signature(STRONG)).toBe('16/8/1');
  store.setItem(PERF_CACHE_KEY, '{"tier":"turbo","sig":"16/8/1","at":1}');
  expect(readCached(STRONG, now, store)).toBeNull();
  store.setItem(PERF_CACHE_KEY, 'not json');
  expect(readCached(STRONG, now, store)).toBeNull();
  // storage that throws, or none at all, never breaks the decision
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
  expect(readCached(STRONG, now, broken)).toBeNull();
  expect(() => writeCached(STRONG, 'full', now, broken)).not.toThrow();
  expect(readCached(STRONG, now, null)).toBeNull();
});

/** A fake rAF clock: every frame advances by `frame(i)` ms; frames are delivered synchronously from a queue (no real timers). */
function fakeEnv(frame: (i: number) => number, opts: { hiddenAfter?: number } = {}): ProbeEnv & { mounted: number; unmounted: number; frames: number } {
  let t = 1000;
  let i = 0;
  let pending: ((t: number) => void) | null = null;
  const env = {
    mounted: 0,
    unmounted: 0,
    frames: 0,
    raf(cb: (t: number) => void) {
      pending = cb;
      queueMicrotask(() => {
        const run = pending;
        pending = null;
        if (!run) return;
        t += frame(i++);
        env.frames++;
        run(t);
      });
      return i + 1;
    },
    cancel() {
      pending = null;
    },
    hidden: () => opts.hiddenAfter !== undefined && i >= opts.hiddenAfter,
    mount() {
      env.mounted++;
      return () => void env.unmounted++;
    },
  };
  return env;
}

test('probe: 60 fps over ~700 ms => full; 30 fps => lite; the layer is mounted for the probe and removed after', async () => {
  const fast = fakeEnv(() => 16.7);
  expect(await runProbe(fast)).toBe('full');
  expect([fast.mounted, fast.unmounted]).toEqual([1, 1]);
  expect(fast.frames).toBeGreaterThan(30);
  expect(fast.frames).toBeLessThan(60); // ~700 ms of 16.7 ms frames, not a runaway loop

  const slow = fakeEnv(() => 33.3);
  expect(await runProbe(slow)).toBe('lite');
  expect([slow.mounted, slow.unmounted]).toEqual([1, 1]);

  // a device that starts slow (warm-up) and settles at 60 fps is full
  const warm = fakeEnv((i) => (i < 3 ? 80 : 16.7));
  expect(await runProbe(warm)).toBe('full');
});

test('probe: a hidden tab gives no verdict (nothing is cached) and still cleans up', async () => {
  const env = fakeEnv(() => 16.7, { hiddenAfter: 5 });
  expect(await runProbe(env)).toBeNull();
  expect([env.mounted, env.unmounted]).toEqual([1, 1]);
});

test('probe: too short a run (a throttled page that delivers a few frames) gives no verdict', async () => {
  const env = fakeEnv(() => 400); // 2 frames cover 700 ms
  expect(await runProbe(env)).toBeNull();
});
