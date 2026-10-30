import { test, expect } from '@playwright/test';
import type { Occurrence } from '../src/api/calendars';
import { addDays, markOf, monthGrid, onDay, pageOf, placeDay, rowsThatFit, slotGrid, span, startOfDay, timelineWindow, whenText } from '../src/calendars/model';
import { visibleCals } from '../src/calendars/ctx';

// CALENDARS-UI-2310: the pure logic of the calendars screens. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-calendars-ui-2310.spec.ts

const DAY = new Date(2026, 9, 29); // Thursday 29.10.2026 (local)
const iso = (h: number, m = 0, d = DAY) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString();
const occ = (id: string, s: string, e: string, extra: Partial<Occurrence> = {}): Occurrence => ({
  occurrence_id: id, event_id: id, calendar_id: 'c', room_calendar_ids: [], start: s, end: e, title: id, state: 'confirmed', kind: 'booking', on_behalf_label: null, organizer: null, recurring: false, ...extra,
});

test('the month grid starts on the Sunday before the 1st and has 42 days', () => {
  const g = monthGrid(DAY);
  expect(g).toHaveLength(42);
  expect(g[0].day.getDay()).toBe(0);
  expect(g[0].day.getDate()).toBe(27); // Sun 27.09.2026
  expect(g.filter((c) => c.inMonth)).toHaveLength(31);
});

test('entries of a day are those that touch it, ordered by start', () => {
  const list = [occ('b', iso(10), iso(11)), occ('a', iso(8), iso(9)), occ('x', iso(8, 0, addDays(DAY, 1)), iso(9, 0, addDays(DAY, 1)))];
  expect(onDay(list, DAY).map((o) => o.event_id)).toEqual(['a', 'b']);
});

test('overlapping entries of a day share lanes; separate clusters start again at one lane', () => {
  const list = [occ('a', iso(10), iso(11)), occ('b', iso(10, 30), iso(11, 30)), occ('c', iso(14), iso(15))];
  const p = placeDay(list, DAY, 7, 22);
  const by = Object.fromEntries(p.map((x) => [x.o.event_id, x]));
  expect(by.a.lanes).toBe(2);
  expect(by.b.lane).toBe(1);
  expect(by.c.lanes).toBe(1);
  expect(by.a.top).toBeCloseTo((3 / 15) * 100, 5);
});

test('the rooms timeline: a 16-hour desktop window, a 6-hour phone window around now; spans clip to the window', () => {
  expect(timelineWindow(false, new Date(2026, 9, 29, 10, 40))).toEqual({ from: 7, to: 23 });
  expect(timelineWindow(true, new Date(2026, 9, 29, 10, 40))).toEqual({ from: 9, to: 15 });
  expect(timelineWindow(true, new Date(2026, 9, 29, 23, 40))).toEqual({ from: 18, to: 24 });
  const s = span(occ('a', iso(6), iso(9)), DAY, 7, 23);
  expect(s?.start).toBe(0);
  expect(s?.width).toBeCloseTo((120 / 960) * 100, 5);
  expect(span(occ('a', iso(5), iso(6)), DAY, 7, 23)).toBeNull();
});

test('paging instead of a page scroll', () => {
  expect(rowsThatFit(500, 64)).toBe(7);
  expect(rowsThatFit(10, 64)).toBe(1);
  const p = pageOf([1, 2, 3, 4, 5], 9, 2);
  expect(p).toEqual({ items: [5], page: 3, pages: 3 });
});

test('kind marks: holiday, displaced, maintenance, pending, imported, busy, confirmed', () => {
  expect(markOf({ state: 'confirmed', kind: 'holiday', title: 'x' })).toBe('holiday');
  expect(markOf({ state: 'displaced', kind: 'booking', title: 'x' })).toBe('displaced');
  expect(markOf({ state: 'confirmed', kind: 'maintenance', title: 'x' })).toBe('maint');
  expect(markOf({ state: 'pending', kind: 'booking', title: 'x' })).toBe('pending');
  expect(markOf({ state: 'confirmed', kind: 'external', title: 'x' })).toBe('external');
  expect(markOf({ state: 'confirmed', kind: 'booking', title: null })).toBe('busy');
  expect(markOf({ state: 'confirmed', kind: 'booking', title: 'x' })).toBe('ok');
});

test('the resident start grid: free / held by a confirmed entry / pending requests counted (answer 13A); past starts left out', () => {
  const entries = [occ('held', iso(10), iso(11)), occ('p1', iso(12), iso(13), { state: 'pending' }), occ('p2', iso(12), iso(12, 30), { state: 'pending' })];
  const g = slotGrid(entries, DAY, [{ from: '09:00', to: '14:00' }], 60, 30, new Date(2026, 9, 29, 9, 10));
  const at = (h: number, m = 0) => g.find((s) => s.start.getHours() === h && s.start.getMinutes() === m);
  expect(at(9)).toBeUndefined(); // already started
  expect(at(9, 30)?.free).toBe(false); // runs into 10:00
  expect(at(11)?.free).toBe(true);
  expect(at(12)?.pending).toBe(2);
  expect(at(13)?.start.getHours()).toBe(13);
  expect(at(13, 30)).toBeUndefined(); // 60 minutes do not fit before 14:00
});

test('whenText names today, tomorrow and other days', () => {
  const now = new Date(2026, 9, 29, 10, 40);
  expect(whenText(iso(17), iso(21), now)).toBe('היום · 17:00–21:00');
  expect(whenText(iso(9, 0, addDays(DAY, 1)), iso(10, 0, addDays(DAY, 1)), now)).toBe('מחר · 09:00–10:00');
  expect(whenText(iso(16, 0, addDays(DAY, 5)), iso(17, 30, addDays(DAY, 5)), now)).toBe('ג׳ 03.11 · 16:00–17:30');
  expect(startOfDay(now).getHours()).toBe(0);
});

test('the floor chip keeps calendars without a floor; the search matches the name', () => {
  const cal = (id: string, floor_id: string | null) => ({ id, name: `יומן ${id}`, floor_id }) as never;
  const cals = [cal('a', 'f1'), cal('b', 'f0'), cal('c', null)];
  expect(visibleCals({ cals, floor: 'f1', q: '' }).map((c) => c.id)).toEqual(['a', 'c']);
  expect(visibleCals({ cals, floor: '', q: 'b' }).map((c) => c.id)).toEqual(['b']);
});
