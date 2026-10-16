import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addDays, dayBounds, dayHours, dayKeyOf, eventsOf, eventsOfItem, groupByDay, inWeek, isDayKey, nearestEventWeek, partsOf, segmentsOf, stepWeek, timeText, todayKey, toneOf, unscheduledCount,
  weekCount, weekKeys, weekStart, weekdayOf, zonedMs, type CalEvent, type CalItem,
} from '../src/tickets/calendar-model';
import { CAL_TEXT_EN_KEYS, CAL_TEXT_KEYS, calName, calTemplate } from '../src/tickets/calendar-text';
import { LIST_MODES, visibleModes } from '../src/tickets/list-view-switch';
import { listTemplate } from '../src/tickets/list-text';

// TKCAL: the date maths and the events of the weekly calendar - the week (Sunday first), the clock changes of Asia/Jerusalem (2026: spring
// forward Fri 27.3 at 02:00, fall back Sun 25.10 at 02:00), items that span days, the tones. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-calendar.spec.ts
const TZ = 'Asia/Jerusalem';
const Z = (iso: string) => Date.parse(iso);

function item(o: Partial<CalItem> & { id?: string } = {}): CalItem {
  return { id: 'a'.repeat(16), number: 1041, title: 'x', status: 'in_progress', eta_at: null, sla: null, ...o };
}

test('week: Sunday first; Friday and Saturday belong to the week that started on Sunday; year boundary', () => {
  expect(weekdayOf('2026-10-11')).toBe(0); // a Sunday
  expect(weekStart('2026-10-11')).toBe('2026-10-11');
  expect(weekStart('2026-10-16')).toBe('2026-10-11'); // Friday
  expect(weekStart('2026-10-17')).toBe('2026-10-11'); // Saturday
  expect(weekStart('2026-10-18')).toBe('2026-10-18');
  expect(weekStart('2026-01-01')).toBe('2025-12-28'); // Thursday across the year boundary
  expect(weekKeys('2026-10-11')).toEqual(['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']);
  expect(stepWeek('2026-10-11', 1)).toBe('2026-10-18');
  expect(stepWeek('2026-10-11', -2)).toBe('2026-09-27');
  expect(inWeek('2026-10-17', '2026-10-11')).toBe(true);
  expect(inWeek('2026-10-18', '2026-10-11')).toBe(false);
});

test('day keys: arithmetic is calendar arithmetic (month ends, leap day), never clock arithmetic', () => {
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  expect(addDays('2026-03-27', 1)).toBe('2026-03-28'); // the 23 hour day
  expect(addDays('2026-10-25', 1)).toBe('2026-10-26'); // the 25 hour day
  expect(isDayKey('2026-02-29')).toBe(false);
  expect(isDayKey('2026-10-16')).toBe(true);
  expect(isDayKey('16/10/2026')).toBe(false);
});

test('zone: the day of an instant follows the IANA zone and the date, not a fixed offset (IDT +3 in summer, IST +2 in winter)', () => {
  expect(partsOf(Z('2026-10-13T10:42:00Z'), TZ)).toMatchObject({ y: 2026, m: 10, d: 13, h: 13, min: 42 });
  expect(timeText(Z('2026-10-13T10:42:00Z'), TZ)).toBe('13:42');
  expect(timeText(Z('2026-12-01T10:42:00Z'), TZ)).toBe('12:42');
  // 21:00Z is already tomorrow in summer (+3), 21:30Z in winter (+2) is also tomorrow, 21:30Z - 1h is not
  expect(dayKeyOf(Z('2026-07-10T20:59:59Z'), TZ)).toBe('2026-07-10');
  expect(dayKeyOf(Z('2026-07-10T21:00:00Z'), TZ)).toBe('2026-07-11');
  expect(dayKeyOf(Z('2026-12-10T21:59:59Z'), TZ)).toBe('2026-12-10');
  expect(dayKeyOf(Z('2026-12-10T22:00:00Z'), TZ)).toBe('2026-12-11');
  expect(dayKeyOf(NaN, TZ)).toBe('');
  expect(todayKey(new Date('2026-10-16T21:30:00Z'), TZ)).toBe('2026-10-17');
});

test('DST: the spring-forward day has 23 hours, the fall-back day 25, any other day 24', () => {
  expect(dayHours('2026-03-27', TZ)).toBe(23);
  expect(dayHours('2026-03-26', TZ)).toBe(24);
  expect(dayHours('2026-03-28', TZ)).toBe(24);
  expect(dayHours('2026-10-25', TZ)).toBe(25);
  expect(dayHours('2026-10-24', TZ)).toBe(24);
  expect(dayHours('2026-10-16', TZ)).toBe(24);
  const spring = dayBounds('2026-03-27', TZ);
  expect(new Date(spring.start).toISOString()).toBe('2026-03-26T22:00:00.000Z'); // 00:00 at +2
  expect(new Date(spring.end).toISOString()).toBe('2026-03-27T21:00:00.000Z'); // 00:00 at +3
  const fall = dayBounds('2026-10-25', TZ);
  expect(new Date(fall.start).toISOString()).toBe('2026-10-24T21:00:00.000Z'); // 00:00 at +3
  expect(new Date(fall.end).toISOString()).toBe('2026-10-25T22:00:00.000Z'); // 00:00 at +2
});

test('DST: instants around the changes land on the right local day and time', () => {
  // fall back: 01:30 happens twice; the day stays 25.10 until 22:00Z
  expect(dayKeyOf(Z('2026-10-24T22:30:00Z'), TZ)).toBe('2026-10-25'); // 01:30 IDT
  expect(timeText(Z('2026-10-24T22:30:00Z'), TZ)).toBe('01:30');
  expect(timeText(Z('2026-10-24T23:30:00Z'), TZ)).toBe('01:30'); // the second 01:30, IST
  expect(dayKeyOf(Z('2026-10-25T21:59:59Z'), TZ)).toBe('2026-10-25');
  expect(dayKeyOf(Z('2026-10-25T22:00:00Z'), TZ)).toBe('2026-10-26');
  // spring forward: 01:59 +2 is followed by 03:00 +3
  expect(timeText(Z('2026-03-26T23:59:00Z'), TZ)).toBe('01:59');
  expect(timeText(Z('2026-03-27T00:00:00Z'), TZ)).toBe('03:00');
  // a wall-clock time converts back to its instant (before and after a change)
  expect(new Date(zonedMs('2026-10-26', 9, 0, TZ)).toISOString()).toBe('2026-10-26T07:00:00.000Z'); // +2
  expect(new Date(zonedMs('2026-10-24', 9, 0, TZ)).toISOString()).toBe('2026-10-24T06:00:00.000Z'); // +3
  expect(new Date(zonedMs('2026-03-28', 9, 0, TZ)).toISOString()).toBe('2026-03-28T06:00:00.000Z'); // +3
  expect(new Date(zonedMs('2026-03-26', 9, 0, TZ)).toISOString()).toBe('2026-03-26T07:00:00.000Z'); // +2
});

test('the week that starts on the 25 hour day groups events by local day (the clock change does not move any)', () => {
  const keys = weekKeys('2026-10-25');
  expect(keys[0]).toBe('2026-10-25');
  const ev = (id: string, iso: string): CalEvent => ({ id, kind: 'visit', ticket: item({ id }), startMs: Z(iso), endMs: null });
  const events = [
    ev('before', '2026-10-24T20:59:00Z'), // Sat 24.10 23:59
    ev('first', '2026-10-24T21:00:00Z'), // Sun 25.10 00:00
    ev('late', '2026-10-25T21:59:00Z'), // Sun 25.10 23:59 (+2)
    ev('mon', '2026-10-25T22:00:00Z'), // Mon 26.10 00:00
    ev('sat', '2026-10-31T21:30:00Z'), // Sat 31.10 23:30
    ev('after', '2026-10-31T22:00:00Z'), // Sun 1.11 00:00
  ];
  const by = groupByDay(events, keys, TZ);
  expect(by['2026-10-25'].map((s) => s.event.id)).toEqual(['first', 'late']);
  expect(by['2026-10-26'].map((s) => s.event.id)).toEqual(['mon']);
  expect(by['2026-10-31'].map((s) => s.event.id)).toEqual(['sat']);
  expect(weekCount(by)).toBe(4);
});

test('events: a visit while the request is not final; the targets while it is not done; nothing for a final one', () => {
  const sla = { ack_due_at: '2026-10-13T11:00:00Z', stuck_due_at: null, resolve_due_at: '2026-10-14T09:00:00Z' };
  const open = eventsOfItem(item({ eta_at: '2026-10-14T06:00:00Z', sla }));
  expect(open.map((e) => e.kind)).toEqual(['visit', 'ack', 'resolve']);
  expect(eventsOfItem(item({ status: 'done', eta_at: '2026-10-14T06:00:00Z', sla })).map((e) => e.kind)).toEqual(['visit']);
  expect(eventsOfItem(item({ status: 'closed', eta_at: '2026-10-14T06:00:00Z', sla }))).toEqual([]);
  expect(eventsOfItem(item({ status: 'cancelled', sla }))).toEqual([]);
  expect(eventsOfItem(item({ eta_at: 'not a date', sla: null }))).toEqual([]);
  expect(eventsOfItem(item({ sla: null, eta_at: null }))).toEqual([]);
  const two = eventsOf([item({ id: 'b'.repeat(16), eta_at: '2026-10-15T06:00:00Z' }), item({ id: 'a'.repeat(16), eta_at: '2026-10-14T06:00:00Z' })]);
  expect(two.map((e) => e.ticket.id[0])).toEqual(['a', 'b']); // time order
  expect(new Set(open.map((e) => e.id)).size).toBe(3); // one id per event
});

test('unscheduled: open requests with no time at all are counted, final ones are not', () => {
  expect(unscheduledCount([item(), item({ eta_at: '2026-10-14T06:00:00Z' }), item({ status: 'closed' }), item({ status: 'new' })])).toBe(2);
});

test('items spanning days: a window is cut per local day; midnight is exclusive; a point is one segment', () => {
  const win = (from: string, to: string): CalEvent => ({ id: 'w', kind: 'visit', ticket: item(), startMs: Z(from), endMs: Z(to) });
  // Fri 23.10 22:00 IDT -> Mon 26.10 02:00 IST (crosses the fall-back night)
  const s = segmentsOf(win('2026-10-23T19:00:00Z', '2026-10-26T00:00:00Z'), TZ);
  expect(s.map((x) => x.day)).toEqual(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26']);
  expect(s.map((x) => [x.startsHere, x.endsHere])).toEqual([[true, false], [false, false], [false, false], [false, true]]);
  expect(s[0].fromMs).toBe(Z('2026-10-23T19:00:00Z'));
  expect(s[0].toMs).toBe(Z('2026-10-23T21:00:00Z')); // midnight of the 24th
  expect((s[2].toMs - s[2].fromMs) / 3_600_000).toBe(25); // the whole fall-back day
  expect(s[3].toMs).toBe(Z('2026-10-26T00:00:00Z'));
  // ends exactly at midnight: does not touch the next day
  expect(segmentsOf(win('2026-10-14T18:00:00Z', '2026-10-14T21:00:00Z'), TZ).map((x) => x.day)).toEqual(['2026-10-14']);
  // one minute past midnight does
  expect(segmentsOf(win('2026-10-14T18:00:00Z', '2026-10-14T21:01:00Z'), TZ).map((x) => x.day)).toEqual(['2026-10-14', '2026-10-15']);
  // a window that spans the week boundary shows in both weeks
  const by = groupByDay([win('2026-10-17T10:00:00Z', '2026-10-18T10:00:00Z')], weekKeys('2026-10-11'), TZ);
  expect(by['2026-10-17']).toHaveLength(1);
  expect(weekCount(by)).toBe(1);
  expect(groupByDay([win('2026-10-17T10:00:00Z', '2026-10-18T10:00:00Z')], weekKeys('2026-10-18'), TZ)['2026-10-18']).toHaveLength(1);
  // a reversed window is a point
  expect(segmentsOf(win('2026-10-14T10:00:00Z', '2026-10-13T10:00:00Z'), TZ)).toHaveLength(1);
  expect(segmentsOf({ ...win('2026-10-14T10:00:00Z', '2026-10-14T10:00:00Z'), endMs: null }, TZ)).toHaveLength(1);
});

test('tone: a visit is info; a target is quiet while far, warn under 24 h, bad once crossed', () => {
  const now = new Date('2026-10-13T10:00:00Z');
  const t = (kind: CalEvent['kind'], iso: string): CalEvent => ({ id: kind, kind, ticket: item(), startMs: Z(iso), endMs: null });
  expect(toneOf(t('visit', '2026-10-12T10:00:00Z'), now)).toBe('info');
  expect(toneOf(t('resolve', '2026-10-13T09:59:59Z'), now)).toBe('bad');
  expect(toneOf(t('resolve', '2026-10-13T10:00:01Z'), now)).toBe('warn');
  expect(toneOf(t('ack', '2026-10-14T09:59:59Z'), now)).toBe('warn');
  expect(toneOf(t('stuck', '2026-10-14T10:00:00Z'), now)).toBe('quiet');
});

test('the nearest week with events: from the shown week on, nothing guessed', () => {
  const events = eventsOf([item({ eta_at: '2026-10-29T06:00:00Z' })]);
  expect(nearestEventWeek(events, '2026-10-11', TZ)).toBe('2026-10-25');
  expect(nearestEventWeek(events, '2026-11-01', TZ)).toBeNull();
});

test('the registry has the calendar as the fourth mode, for everyone; its words exist in both languages', () => {
  expect(visibleModes(false).map((m) => m.id)).toEqual(['cards', 'table', 'calendar']);
  expect(visibleModes(true).map((m) => m.id)).toEqual(['cards', 'table', 'board', 'calendar']);
  const cal = LIST_MODES.find((m) => m.id === 'calendar');
  expect(cal?.managerOnly).toBe(false);
  expect(listTemplate('lsView_calendar', 'he')).toBe('יומן שבועי');
  expect(listTemplate('lsView_calendar', 'en')).toBe('Weekly calendar');
});

test('text: every English key exists in Hebrew; Hebrew weekday and month names are complete; no retired module word', () => {
  for (const k of CAL_TEXT_EN_KEYS) expect(CAL_TEXT_KEYS).toContain(k);
  for (const k of CAL_TEXT_KEYS) expect(calTemplate(k, 'he').length, k).toBeGreaterThan(0);
  expect([0, 1, 2, 3, 4, 5, 6].map((i) => calName('days', i, 'he'))).toEqual(['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']);
  expect(calName('daysShort', 0, 'he')).toBe('א׳');
  expect([...Array(12).keys()].every((i) => calName('months', i, 'he') && calName('months', i, 'en'))).toBe(true);
  const src = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/tickets/calendar-text.ts'), 'utf8');
  expect(src).not.toMatch(/Home Assistant|\bHA\b|Ingress/);
});
