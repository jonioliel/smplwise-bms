import { test, expect } from '@playwright/test';
import { isAwake, pageCameras, pixelShift, reconnectDelayMs, resolveLayout, serverHealth, tileHealth, wallScale } from '../src/wall/wall-logic';

// CR-030 section 4: presets, pages, burn-in, offline ladders and the schedule. Node only.
const base = { layout: 'auto' as const, grid: 'auto' as const, viewportW: 1280, viewportH: 800, showMap: false, rotateS: 0 };

test('landscape presets by camera count: 1, 2, 4 and 6 cells', () => {
  expect(resolveLayout({ ...base, cameras: 1 })).toMatchObject({ preset: 'single', cols: 1, rows: 1, pages: 1 });
  expect(resolveLayout({ ...base, cameras: 2 })).toMatchObject({ preset: 'tablet-landscape', cols: 2, rows: 1 });
  expect(resolveLayout({ ...base, cameras: 4 })).toMatchObject({ cols: 2, rows: 2, perPage: 4 });
  expect(resolveLayout({ ...base, cameras: 6 })).toMatchObject({ cols: 3, rows: 2, perPage: 6, pages: 1 });
});

test('portrait: a single column, two cells (three on a tall tablet), the map band only on portrait', () => {
  const p = { ...base, viewportW: 800, viewportH: 1280 };
  expect(resolveLayout({ ...p, cameras: 4 })).toMatchObject({ preset: 'tablet-portrait', cols: 1, rows: 2, pages: 2 });
  expect(resolveLayout({ ...p, viewportW: 1200, viewportH: 1920, cameras: 3 })).toMatchObject({ rows: 3, pages: 1 });
  expect(resolveLayout({ ...p, cameras: 2, showMap: true }).map).toBe(true);
  expect(resolveLayout({ ...base, cameras: 4, showMap: true }).map).toBe(false);
});

test('rotating the mount re-chooses the layout; more cameras than cells page, never above 6 streams', () => {
  expect(resolveLayout({ ...base, viewportW: 800, viewportH: 1280, cameras: 3 }).preset).toBe('tablet-portrait');
  expect(resolveLayout({ ...base, viewportW: 1280, viewportH: 800, cameras: 3 }).preset).toBe('tablet-landscape');
  const many = resolveLayout({ ...base, cameras: 12 });
  expect(many.perPage).toBeLessThanOrEqual(6);
  expect(many).toMatchObject({ pages: 2, rotateS: 30 });
  expect(resolveLayout({ ...base, cameras: 12, rotateS: 60 }).rotateS).toBe(60);
  expect(resolveLayout({ ...base, cameras: 4, rotateS: 60 }).rotateS).toBe(0);
  expect(resolveLayout({ ...base, cameras: 12, grid: { cols: 3, rows: 3 } }).perPage).toBe(6);
});

test('pinned layouts and single', () => {
  expect(resolveLayout({ ...base, cameras: 5, layout: 'single' })).toMatchObject({ preset: 'single', perPage: 1, pages: 5 });
  expect(resolveLayout({ ...base, cameras: 4, layout: 'tablet-portrait' }).preset).toBe('tablet-portrait');
});

test('scale follows the physical short side, clamped 1..1.4', () => {
  expect(wallScale(800, 1280)).toBe(1);
  expect(wallScale(1200, 1920)).toBe(1.4);
  expect(wallScale(600, 1024)).toBe(1);
  expect(wallScale(1000, 1400)).toBeCloseTo(1.25);
});

test('pages and the hourly shuffle', () => {
  const c = ['a', 'b', 'c', 'd', 'e'];
  expect(pageCameras(c, 0, 2)).toEqual(['a', 'b']);
  expect(pageCameras(c, 2, 2)).toEqual(['e']);
  expect(pageCameras(c, 0, 2, 1)).toEqual(['b', 'c']);
  expect(pageCameras(c, 0, 2, 6)).toEqual(['b', 'c']);
  expect(pageCameras([], 0, 2)).toEqual([]);
});

test('pixel shift: nine positions, one a minute, within +-2 px, off when disabled', () => {
  const seen = new Set<string>();
  for (let m = 0; m < 9; m++) {
    const [x, y] = pixelShift(m * 60000, true);
    expect(Math.abs(x)).toBeLessThanOrEqual(2);
    expect(Math.abs(y)).toBeLessThanOrEqual(2);
    seen.add(`${x},${y}`);
  }
  expect(seen.size).toBe(9);
  expect(pixelShift(123456, false)).toEqual([0, 0]);
});

test('a stalled camera: live under one GOP, stale after, lost after 60 s; never shown as live', () => {
  expect(tileHealth(1000, 5000)).toBe('live');
  expect(tileHealth(1000, 12000)).toBe('stale');
  expect(tileHealth(1000, 1000 + 67_000)).toBe('stale');
  expect(tileHealth(1000, 1000 + 69_000)).toBe('lost');
  expect(tileHealth(null, 5000)).toBe('stale');
});

test('the server ladder: ok, banner after ~15 s, the clock state after 2 minutes; reconnect 5 s then 15 s', () => {
  expect(serverHealth(null, 1e6)).toBe('ok');
  expect(serverHealth(1e6, 1e6 + 10_000)).toBe('ok');
  expect(serverHealth(1e6, 1e6 + 20_000)).toBe('banner');
  expect(serverHealth(1e6, 1e6 + 121_000)).toBe('clock');
  expect(reconnectDelayMs(60_000)).toBe(5000);
  expect(reconnectDelayMs(5 * 60_000)).toBe(15_000);
});

test('schedule windows in the installation zone, across the Israeli DST changes', () => {
  const w = [{ days: [0, 1, 2, 3, 4], from: '07:00', to: '20:00' }, { days: [5], from: '07:00', to: '14:00' }];
  expect(isAwake([], 'Asia/Jerusalem', new Date())).toBe(true);
  // Sunday 2026-10-04 10:00 Jerusalem (UTC+3, summer time still on): awake
  expect(isAwake(w, 'Asia/Jerusalem', new Date('2026-10-04T07:00:00Z'))).toBe(true);
  // Sunday 22:00 Jerusalem: asleep
  expect(isAwake(w, 'Asia/Jerusalem', new Date('2026-10-04T19:00:00Z'))).toBe(false);
  // Friday 2026-10-09 15:00 Jerusalem: asleep, 13:00 awake
  expect(isAwake(w, 'Asia/Jerusalem', new Date('2026-10-09T12:00:00Z'))).toBe(false);
  expect(isAwake(w, 'Asia/Jerusalem', new Date('2026-10-09T10:00:00Z'))).toBe(true);
  // after the 2026-10-25 change back to winter time (UTC+2): Monday 2026-10-26 06:30 UTC = 08:30 local, awake; 04:30 UTC = 06:30 local, asleep
  expect(isAwake(w, 'Asia/Jerusalem', new Date('2026-10-26T06:30:00Z'))).toBe(true);
  expect(isAwake(w, 'Asia/Jerusalem', new Date('2026-10-26T04:30:00Z'))).toBe(false);
  // 2026-03-27 (the change to summer time): Friday 06:30 UTC = 09:30 local (UTC+3), awake
  expect(isAwake(w, 'Asia/Jerusalem', new Date('2026-03-27T06:30:00Z'))).toBe(true);
});
