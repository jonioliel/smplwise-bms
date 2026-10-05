import { test, expect } from '@playwright/test';
import { alertView, frameActive, holdProgress, needsAttention, shuffleOrder, wakesDisplay, type AlertLike } from '../src/wall/wall-logic';

// CR-030 sections 5 and 6 (WDX): the alert ladder and the picture-frame precedence. Node only.
const a = (id: string, severity: AlertLike['severity'], last_at: string): AlertLike => ({ id, severity, last_at, count: 1 });
const T0 = 1_000_000;

test('critical is a takeover, newest first, and never times out', () => {
  const list = [a('c1', 'critical', '2026-10-05T10:00:00Z'), a('c2', 'critical', '2026-10-05T10:05:00Z')];
  const shown = new Map([['c1', T0], ['c2', T0]]);
  const v = alertView(list, shown, new Map(), T0 + 3_600_000, 120);
  expect(v.takeover.map((x) => x.id)).toEqual(['c2', 'c1']);
  expect(v.tile).toBeNull();
});

test('"seen" folds a critical into a chip for the timeout, then it comes back', () => {
  const list = [a('c1', 'critical', '2026-10-05T10:00:00Z')];
  const seen = new Map([['c1', T0 + 120_000]]);
  expect(alertView(list, new Map([['c1', T0]]), seen, T0 + 10_000, 120).chips.map((x) => x.id)).toEqual(['c1']);
  expect(alertView(list, new Map([['c1', T0]]), seen, T0 + 130_000, 120).takeover.map((x) => x.id)).toEqual(['c1']);
});

test('alert is a tile with a count of the rest, folds into a chip after the timeout', () => {
  const list = [a('x', 'alert', '2026-10-05T10:00:00Z'), a('y', 'alert', '2026-10-05T10:01:00Z'), a('z', 'alert', '2026-10-05T10:02:00Z')];
  const shown = new Map([['x', T0], ['y', T0], ['z', T0]]);
  const v = alertView(list, shown, new Map(), T0 + 1000, 120);
  expect(v.tile?.id).toBe('z');
  expect(v.more).toBe(2);
  expect(alertView(list, shown, new Map(), T0 + 1000, 120, 1).tile?.id).toBe('y');
  const late = alertView(list, shown, new Map(), T0 + 121_000, 120);
  expect(late.tile).toBeNull();
  expect(late.chips).toHaveLength(3);
});

test('info is a strip chip for 20 s only', () => {
  const list = [a('i', 'info', '2026-10-05T10:00:00Z')];
  const shown = new Map([['i', T0]]);
  expect(alertView(list, shown, new Map(), T0 + 19_000, 120).chips).toHaveLength(1);
  expect(alertView(list, shown, new Map(), T0 + 21_000, 120).chips).toHaveLength(0);
});

test('wake and attention follow the severity ladder', () => {
  expect(wakesDisplay([a('x', 'alert', '')], 'critical')).toBe(false);
  expect(wakesDisplay([a('x', 'critical', '')], 'critical')).toBe(true);
  expect(wakesDisplay([a('x', 'alert', '')], 'alert')).toBe(true);
  expect(needsAttention([a('i', 'info', '')])).toBe(false);
  expect(needsAttention([a('i', 'alert', '')])).toBe(true);
});

test('the frame shows after the idle time, and yields to touch, attention, sleep and an empty set', () => {
  const base = { enabled: true, photos: 5, idleMin: 10, lastActivityMs: T0, nowMs: T0 + 11 * 60_000, asleep: false, attention: false };
  expect(frameActive(base)).toBe(true);
  expect(frameActive({ ...base, nowMs: T0 + 9 * 60_000 })).toBe(false);
  expect(frameActive({ ...base, attention: true })).toBe(false);
  expect(frameActive({ ...base, asleep: true })).toBe(false);
  expect(frameActive({ ...base, photos: 0 })).toBe(false);
  expect(frameActive({ ...base, enabled: false })).toBe(false);
});

test('shuffle is a permutation and avoids repeating the last photo first', () => {
  const o = shuffleOrder(6, () => 0.3);
  expect([...o].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  expect(shuffleOrder(5, () => 0.99, 0)[0]).not.toBe(0);
  expect(shuffleOrder(1)).toEqual([0]);
});

test('press-and-hold needs 1.5 s', () => {
  expect(holdProgress(null, 5000)).toBe(0);
  expect(holdProgress(1000, 1750)).toBeCloseTo(0.5);
  expect(holdProgress(1000, 2600)).toBe(1);
});
