import { test, expect } from '@playwright/test';
import { FpsWatch, QUALITY_MODES, QUALITY_MODE_LABEL, levelFor, lowFpsAction, modeFromWire, modeToWire, recoverFps, resolveMode } from '../src/map/quality-mode';

// Owner bug 2026-10-10 ("מלא" jumped back to "סכמטי" after half a minute): the pure rules of the 3D view mode
// (src/map/quality-mode.ts) - a manual choice is never downgraded, only `auto` drops after a SUSTAINED low frame rate, with
// hysteresis; the personal choice wins over the installation default. No browser page.

test('the wire values: auto / 2 / 1 and back; anything else is not set', () => {
  expect(modeFromWire('auto')).toBe('auto');
  expect(modeFromWire('2')).toBe('full');
  expect(modeFromWire(2)).toBe('full');
  expect(modeFromWire('1')).toBe('schematic');
  expect(modeFromWire(1)).toBe('schematic');
  expect(modeFromWire('full')).toBe('full');
  for (const bad of [null, undefined, '', '3', 'AUTO', 0, true, {}]) expect(modeFromWire(bad)).toBeNull();
  for (const m of QUALITY_MODES) expect(modeFromWire(modeToWire(m))).toBe(m);
  expect(QUALITY_MODES.map((m) => QUALITY_MODE_LABEL[m])).toEqual(['אוטומטי', 'מלא', 'סכמטי']);
});

test('the personal choice wins over the installation default, which wins over auto', () => {
  expect(resolveMode('full', 'schematic')).toBe('full');
  expect(resolveMode(null, 'schematic')).toBe('schematic');
  expect(resolveMode(undefined, null)).toBe('auto');
  expect(resolveMode('auto', 'full')).toBe('auto');
});

test('a manual choice is never downgraded: only auto honours a fallback', () => {
  expect(levelFor('full', true)).toBe(2); // the owner's bug: a chosen full mode with a fallback on record still draws full
  expect(levelFor('full', false)).toBe(2);
  expect(levelFor('schematic', false)).toBe(1);
  expect(levelFor('auto', false)).toBe(2);
  expect(levelFor('auto', true)).toBe(1);
  expect(lowFpsAction('auto')).toBe('downgrade');
  expect(lowFpsAction('full')).toBe('hint');
  expect(lowFpsAction('schematic')).toBe('none');
});

test('auto drops only after a sustained low rate: one slow interval is not a verdict', () => {
  const w = new FpsWatch(30, recoverFps(30), 2500);
  expect(recoverFps(30)).toBe(36);
  expect(w.sample(12, 0, 1000)).toBe(false); // low for 1 s
  expect(w.sample(14, 1000, 2000)).toBe(false); // low for 2 s
  expect(w.sample(10, 2000, 3000)).toBe(true); // low for 3 s >= 2.5 s: sustained
  // a single dip between good intervals never adds up
  const d = new FpsWatch(30, 36, 2500);
  expect(d.sample(5, 0, 1000)).toBe(false);
  expect(d.sample(55, 1000, 2000)).toBe(false); // a good second clears the streak
  expect(d.inStreak).toBe(false);
  expect(d.sample(5, 2000, 3000)).toBe(false);
  expect(d.sample(5, 3000, 4000)).toBe(false); // the streak restarted at 2000: 2 s only
  expect(d.sample(5, 4000, 5000)).toBe(true);
});

test('hysteresis: a rate between the low and the recover edge neither starts nor clears a streak', () => {
  const w = new FpsWatch(30, 36, 2500);
  expect(w.sample(33, 0, 1000)).toBe(false); // in the band: no streak starts
  expect(w.inStreak).toBe(false);
  expect(w.sample(20, 1000, 2000)).toBe(false); // the streak starts at 1000
  expect(w.sample(33, 2000, 3000)).toBe(false); // in the band: the streak holds (2 s so far)
  expect(w.inStreak).toBe(true);
  expect(w.sample(33, 3000, 4000)).toBe(true); // still not recovered: 3 s since the streak started
  w.reset();
  expect(w.inStreak).toBe(false);
  expect(w.sample(36, 0, 5000)).toBe(false); // at the recover edge: clear, never low
});

test('nothing drawn at all over the whole wait is sustained by itself (the first-frame timer path)', () => {
  const w = new FpsWatch(30, 36, 2500);
  expect(w.sample(0, 0, 10000)).toBe(true);
});
