import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../src/calendars/model';
import * as B from '../src/calendars/booking-logic';
import type { Occurrence } from '../src/api/calendars';

// DST-TIMELINE-2540 (TIME-CORRECT-2540 open question 1, owner rule: unanswered = recommendation a): the rooms timeline ("rooms by hours")
// and the resident's time bar are drawn on a wall-clock hour axis. They placed an entry (and a tap) at midnight + elapsed minutes, so on
// the 23-hour and the 25-hour day of Asia/Jerusalem every entry after the change sat one hour off its hour label, although the stored
// time was right. The unit config pins TZ=Asia/Jerusalem (playwright.unit.config.ts).
// Namespace imports on purpose: run against the base (no new helpers) every case fails on its own instead of the file not loading.
//   npx playwright test -c playwright.unit.config.ts tests/unit-dst-timeline-2540.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');
const m = M as unknown as Record<string, (...a: unknown[]) => unknown>;

// 2026: Friday 27.03 (02:00 -> 03:00) and Sunday 25.10 (02:00 -> 01:00); 2027: Friday 26.03 and Sunday 31.10
const DAYS = {
  spring2026: new Date(2026, 2, 27), autumn2026: new Date(2026, 9, 25), spring2027: new Date(2027, 2, 26), autumn2027: new Date(2027, 9, 31),
};
const PLAIN = new Date(2026, 2, 26);
const at = (day: Date, h: number, min = 0) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min);
const occ = (start: Date, end: Date, id = 'e'): Occurrence => ({ occurrence_id: id, event_id: id, calendar_id: 'r', room_calendar_ids: ['r'], start: start.toISOString(), end: end.toISOString(),
  title: 'x', on_behalf_label: null, organizer: null, recurring: false, state: 'confirmed', kind: 'booking' } as unknown as Occurrence);
const hours = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3_600_000;
const near = (a: number, b: number) => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThan(1e-9);

test('premise: the pinned zone has a 23-hour and a 25-hour day in 2026 and in 2027', () => {
  expect(hours(DAYS.spring2026, new Date(2026, 2, 28))).toBe(23);
  expect(hours(DAYS.autumn2026, new Date(2026, 9, 26))).toBe(25);
  expect(hours(DAYS.spring2027, new Date(2027, 2, 27))).toBe(23);
  expect(hours(DAYS.autumn2027, new Date(2027, 10, 1))).toBe(25);
  expect(hours(PLAIN, new Date(2026, 2, 27))).toBe(24);
});

test('rooms timeline (desktop 07-23): a 10:00-11:00 entry sits under the 10:00 label on every DST day', () => {
  // the 10:00 label of a 07-23 axis is at 3/16 of the axis, the entry is 1/16 wide
  for (const [name, day] of [...Object.entries(DAYS), ['plain', PLAIN] as const]) {
    const sp = M.span(occ(at(day, 10), at(day, 11)), day, 7, 23);
    expect(sp, name).not.toBeNull();
    near((sp as { start: number }).start, (3 / 16) * 100);
    near((sp as { width: number }).width, (1 / 16) * 100);
  }
});

test('resident bar / phone window: entries after the change hour are placed by the clock (00-06 and 03-09 windows)', () => {
  for (const day of [DAYS.spring2026, DAYS.spring2027]) {
    // 04:00-05:00 on the spring day: 4/6 of a 00-06 window (elapsed time put it at 3/6)
    near((M.span(occ(at(day, 4), at(day, 5)), day, 0, 6) as { start: number }).start, (4 / 6) * 100);
    // 01:00-04:00 crosses the jump: drawn 01:00 -> 04:00 by the clock (3 hours wide on the axis, 2 hours lived)
    const x = M.span(occ(at(day, 1), at(day, 4)), day, 0, 6) as { start: number; width: number };
    near(x.start, (1 / 6) * 100);
    near(x.width, (3 / 6) * 100);
  }
  for (const day of [DAYS.autumn2026, DAYS.autumn2027]) {
    near((M.span(occ(at(day, 4), at(day, 5)), day, 3, 9) as { start: number }).start, (1 / 6) * 100);
    // the evening: 21:00-23:00 ends at the edge of a 07-23 axis (elapsed time pushed it one hour later, cut at 23:00)
    const ev = M.span(occ(at(day, 21), at(day, 23)), day, 7, 23) as { start: number; width: number };
    near(ev.start, (14 / 16) * 100);
    near(ev.width, (2 / 16) * 100);
  }
});

test('the repeated autumn hour: both passes of 01:30 sit at 01:30, and an entry across the two passes keeps its length', () => {
  for (const day of [DAYS.autumn2026, DAYS.autumn2027]) {
    const first = at(day, 1, 30); // JS resolves a repeated clock time to its first pass
    const second = new Date(first.getTime() + 3_600_000);
    expect(M.hm(second)).toBe('01:30');
    near(m.wallMinute(first, day) as number, 90);
    near(m.wallMinute(second, day) as number, 90);
    near((M.span(occ(second, new Date(second.getTime() + 30 * 60000)), day, 0, 6) as { start: number }).start, (1.5 / 6) * 100);
    // 01:40 (first pass) -> 01:10 (second pass) = 30 minutes lived: drawn from 01:40, 30 minutes wide (never dropped as "ends before it starts")
    const a = at(day, 1, 40);
    const r = M.span(occ(a, new Date(a.getTime() + 30 * 60000)), day, 0, 6) as { start: number; width: number };
    expect(r).not.toBeNull();
    near(r.start, (100 / 60 / 6) * 100);
    near(r.width, (0.5 / 6) * 100);
    // two entries at the same clock place an hour apart get two lanes on the rooms track (the clock range of the day)
    const e1 = occ(first, new Date(first.getTime() + 20 * 60000), 'a');
    const e2 = occ(second, new Date(second.getTime() + 20 * 60000), 'b');
    expect((B.trackLanes as unknown as (...x: unknown[]) => number[])([e1, e2], (o: Occurrence) => m.wallRange(o, day))).toEqual([0, 1]);
  }
  // without the clock range (other callers) the lanes stay by time, as before
  expect(B.trackLanes([occ(at(PLAIN, 9), at(PLAIN, 10)), occ(at(PLAIN, 10), at(PLAIN, 11))])).toEqual([0, 0]);
});

test('the axis: the skipped spring hour has no label, the repeated autumn hour is labelled once and marked', () => {
  for (const day of [DAYS.spring2026, DAYS.spring2027]) {
    const ax = m.axisHours(day, 0, 6) as { h: number; kind: string }[];
    expect(ax.map((x) => x.h)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(ax.filter((x) => x.kind !== 'plain')).toEqual([{ k: 2, h: 2, kind: 'missing' }]);
    expect(m.missingBands(day, 0, 6)).toEqual([{ h: 2, start: (2 / 6) * 100, width: (1 / 6) * 100 }]);
    expect(m.missingBands(day, 7, 23)).toEqual([]);
  }
  for (const day of [DAYS.autumn2026, DAYS.autumn2027]) {
    const ax = m.axisHours(day, 0, 6) as { h: number; kind: string }[];
    expect(ax.filter((x) => x.kind !== 'plain')).toEqual([{ k: 1, h: 1, kind: 'repeated' }]);
    expect(ax.filter((x) => x.h === 1)).toHaveLength(1); // one place on the axis, not two
    expect(m.missingBands(day, 0, 6)).toEqual([]);
  }
  for (const d of [PLAIN, new Date(2026, 5, 15), new Date(2026, 11, 1)]) expect((m.axisHours(d, 0, 24) as { kind: string }[]).every((x) => x.kind === 'plain')).toBe(true);
});

test('a tap is turned into a time by the clock: rooms (half hour) and the resident bar (quarter hour, centred)', () => {
  for (const day of [...Object.values(DAYS), PLAIN]) {
    // rooms desktop 07-23: a tap at 3.25/16 of the track = 10:15 -> the 10:00 half hour
    expect(M.hm(m.roomsTapStart(day, { from: 7, to: 23 }, 3.25 / 16) as Date), day.toDateString()).toBe('10:00');
    // resident 08-14, one hour: a tap at 2.5/6 = 10:30 centres the hour -> 10:00
    expect(M.hm(m.barStart(day, { from: 8, to: 14 }, 2.5 / 6, 60) as Date)).toBe('10:00');
    const s = m.barStart(day, { from: 8, to: 14 }, 2.5 / 6, 60) as Date;
    expect(s.getDate()).toBe(day.getDate());
  }
  // a tap inside the skipped spring hour starts at the change (03:00), never an hour later
  for (const day of [DAYS.spring2026, DAYS.spring2027]) {
    expect(M.hm(m.roomsTapStart(day, { from: 0, to: 6 }, 2.6 / 6) as Date)).toBe('03:00');
    expect(M.hm(m.wallInstant(day, 150) as Date)).toBe('03:00');
    expect(M.hm(m.wallInstant(day, 200) as Date)).toBe('03:20');
  }
  // the repeated autumn hour: a tap at 01:30 is the first pass (the earlier instant)
  const a = m.roomsTapStart(DAYS.autumn2026, { from: 0, to: 6 }, 1.5 / 6) as Date;
  expect(a.toISOString()).toBe('2026-10-24T22:30:00.000Z');
});

test('the resident start grid and "find a free room" never offer a start inside the skipped hour (no second "03:30")', () => {
  const before = new Date(2026, 0, 1);
  const grid = M.slotGrid([], DAYS.spring2026, [{ from: '01:00', to: '05:00' }], 30, 30, before);
  expect(grid.map((s) => M.hm(s.start))).toEqual(['01:00', '01:30', '03:00', '03:30', '04:00', '04:30']);
  const g27 = M.slotGrid([], DAYS.spring2027, [{ from: '01:30', to: '03:30' }], 30, 30, before);
  expect(g27.map((s) => M.hm(s.start))).toEqual(['01:30', '03:00']);
  // the autumn grid shows the repeated hour once (its first pass), as the axis does
  const ga = M.slotGrid([], DAYS.autumn2026, [{ from: '00:30', to: '02:30' }], 30, 30, before);
  expect(ga.map((s) => M.hm(s.start))).toEqual(['00:30', '01:00', '01:30', '02:00']);
  // "find a free room" at 01:50 of the spring day: an open window 02:00-04:00, 60 minutes -> 03:00-04:00, the first real start
  // (was 03:00-03:00: the 02:00 start was built as 03:00 and its end as 03:00 too)
  const f = B.firstFree([{ calendar_id: 'r', open: [{ from: '02:00', to: '04:00' }], entries: [] } as never], DAYS.spring2026, at(DAYS.spring2026, 1, 50), 60, 5);
  expect(f && [M.hm(f.start), M.hm(f.end)]).toEqual(['03:00', '04:00']);
});

test('the screens use the clock helpers (no midnight + elapsed minutes left in the two timelines)', () => {
  const rooms = read('calendars/view-rooms.ts');
  const res = read('calendars/resident.ts');
  for (const [name, src] of [['view-rooms', rooms], ['resident', res]] as const) {
    expect(src, name).not.toMatch(/startOfDay\(this\.day\)\.getTime\(\)\s*\+/);
    expect(src, name).toContain('axisHours(this.day');
    expect(src, name).toContain('missingBands(this.day');
  }
  expect(rooms).toContain('roomsTapStart(this.day');
  expect(rooms).toContain('wallRange(o, this.day)');
  expect(res).toContain('barStart(this.day');
});
