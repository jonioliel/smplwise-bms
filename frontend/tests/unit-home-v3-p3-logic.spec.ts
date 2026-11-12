import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { billForecast, isP3Screen, mediaLook, nowLine, P3_MODULE_LABEL, P3_MODULES, periodName, planBoxes, plural, progressOf, vsLast, vsUsual, weekBars } from '../src/home/home-p3-logic';

// HOME-V3-P3-2432: the pure rules of the home interface's phase 3 (src/home/home-p3-logic.ts) and source checks: no platform or
// internal word, the emergency announcement never called, the house systems never write.

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f: string) => readFileSync(path.join(here, '..', 'src', 'home', f), 'utf8');
const P3_FILES = ['home-p3.ts', 'home-p3-logic.ts', 'home-p3-media.ts', 'home-p3-announce.ts', 'home-p3-bills.ts', 'home-p3-water.ts', 'home-p3-systems.ts', 'home-p3-map.ts'];

test('the six categories match the server list and each has a Hebrew label', () => {
  expect([...P3_MODULES]).toEqual(['media', 'announce', 'bills', 'water', 'systems', 'map']);
  for (const m of P3_MODULES) expect(P3_MODULE_LABEL[m]).toMatch(/[֐-׿]/);
  const py = readFileSync(path.join(here, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'services', 'home_interface.py'), 'utf8');
  expect(py).toContain('MODULES_P3 = ("media", "announce", "bills", "water", "systems", "map")');
  expect(isP3Screen('media') && isP3Screen('map') && !isP3Screen('announce') && !isP3Screen('lights')).toBe(true);
});

test('media words', () => {
  expect(mediaLook('screen')).toBe('tv');
  expect(mediaLook('speaker')).toBe('music');
  expect(nowLine({ title: 'ערב רגוע', artist: 'רשימה', label: '' })).toEqual({ title: 'ערב רגוע', by: 'רשימה' });
  expect(nowLine({ title: null, channel: 'ערוץ 11', label: 'טלוויזיה' }).title).toBe('ערוץ 11');
  expect(nowLine(null)).toEqual({ title: '', by: '' });
  expect(progressOf({ position_s: 50, duration_s: 200 })).toBe(0.25);
  expect(progressOf({ position_s: 50, duration_s: null })).toBeNull();
  expect(plural(1, 'מכשיר אחד מנגן', 'מכשירים מנגנים')).toBe('מכשיר אחד מנגן');
  expect(plural(3, 'מכשיר אחד מנגן', 'מכשירים מנגנים')).toBe('3 מכשירים מנגנים');
});

test('bill estimate: a straight line from the days so far, nothing in the first two days', () => {
  const f = billForecast(200, '2026-11-01', '2026-11-30', new Date(2026, 10, 10));
  expect(f).toEqual({ day: 10, of: 30, forecast: 600 });
  expect(billForecast(20, '2026-11-01', '2026-11-30', new Date(2026, 10, 2))!.forecast).toBeNull();
  expect(billForecast(20, null, '2026-11-30')).toBeNull();
  expect(vsLast(600, 598)).toBe('כמו בחשבון הקודם');
  expect(vsLast(600, 500)).toBe('100 ₪ יותר מהחשבון הקודם');
  expect(periodName('2026-10-01', '2026-10-31')).toContain('אוקטובר');
  expect(periodName('2026-09-15', '2026-10-14')).toBe('15.9 - 14.10');
});

test('water week: seven days ending today, today against the usual day', () => {
  const today = new Date(2026, 10, 11, 12);
  const series = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ start: new Date(2026, 10, 5 + i).toISOString(), litres: i === 6 ? 480 : 400 }));
  const bars = weekBars(series, today);
  expect(bars).toHaveLength(7);
  expect(bars[6]).toEqual(['היום', 480]);
  expect(vsUsual(bars)).toBe(20);
  expect(weekBars([], today).every((b) => b[1] === null)).toBe(true);
});

test('the schematic plan covers the field once, the heaviest room is the largest', () => {
  const rooms = [{ id: 'a', weight: 8 }, { id: 'b', weight: 3 }, { id: 'c', weight: 2 }, { id: 'd', weight: 1 }, { id: 'e', weight: 0 }];
  const boxes = planBoxes(rooms);
  expect(boxes.map((b) => b.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  const area = boxes.reduce((s, b) => s + b.w * b.h, 0);
  expect(Math.round(area)).toBe(10000);
  const big = boxes.reduce((m, b) => (b.w * b.h > m.w * m.h ? b : m));
  expect(big.id).toBe('a');
  for (const x of boxes) for (const y of boxes) {
    if (x === y) continue;
    const overlap = Math.min(x.x + x.w, y.x + y.w) - Math.max(x.x, y.x) > 0.01 && Math.min(x.y + x.h, y.y + y.h) - Math.max(x.y, y.y) > 0.01;
    expect(overlap, `${x.id}/${y.id}`).toBe(false);
  }
  expect(planBoxes([{ id: 'x', weight: 1 }])).toEqual([{ id: 'x', x: 0, y: 0, w: 100, h: 100 }]);
  expect(planBoxes([])).toEqual([]);
});

test('phase 3 sources: no platform word, no emergency announcement, the house systems read only', () => {
  for (const f of P3_FILES) {
    const s = src(f).split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/**')).join('\n');
    for (const w of ['Home Assistant', 'go2rtc', 'NVR', 'Music Assistant', 'Sonos', 'ישות']) expect(s, `${f}: ${w}`).not.toContain(w);
  }
  for (const f of P3_FILES) expect(src(f), f).not.toMatch(/announcements\/emergency['"`]/);
  const sys = src('home-p3-systems.ts');
  expect(sys).not.toMatch(/\b(post|put|del|api)\(/);
  expect(src('home-p3-map.ts')).not.toMatch(/\b(post|put|del)\(/);
  expect(src('home-p3-map.ts')).not.toMatch(/from '\.\.\/map\//);
});
