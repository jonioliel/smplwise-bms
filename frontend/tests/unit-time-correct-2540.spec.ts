import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atMinute, hm, slotGrid } from '../src/calendars/model';
import { instantAt, hintFor } from '../src/calendars/grid-logic';
import { drawerDetail, firstFree } from '../src/calendars/booking-logic';
import { fmtDate, fmtDateTime } from '../src/electricity/elec-format';
import { bookingLook } from '../src/home/home-p2-api';
import { noteDateHeader, noteServerTime, resetServerClock, serverNow, serverOffset } from '../src/api/server-clock';
import type { Calendar, Occurrence } from '../src/api/calendars';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');

// TIME-CORRECT-2540: time, day and booking truth (review findings SCR-13, SCR-20, SCR-34, SCR-36, SCR-37, SCR-38).
// The unit config pins TZ=Asia/Jerusalem (playwright.unit.config.ts): the two DST-change days of 2026 there are
// Friday 27.03 (02:00 -> 03:00, a 23-hour day) and Sunday 25.10 (02:00 -> 01:00, a 25-hour day).
//   npx playwright test -c playwright.unit.config.ts tests/unit-time-correct-2540.spec.ts

const SPRING = new Date(2026, 2, 27); // local midnight
const AUTUMN = new Date(2026, 9, 25);
const PLAIN = new Date(2026, 2, 26);

test('the pinned zone really has the two DST days (the premise of every DST case below)', () => {
  expect((new Date(2026, 2, 28).getTime() - SPRING.getTime()) / 3_600_000).toBe(23);
  expect((new Date(2026, 9, 26).getTime() - AUTUMN.getTime()) / 3_600_000).toBe(25);
  expect((new Date(2026, 2, 27).getTime() - PLAIN.getTime()) / 3_600_000).toBe(24);
});

test('SCR-37: a minute of the day is built by the wall clock - 10:00 is 10:00 on both DST days', () => {
  for (const day of [SPRING, AUTUMN, PLAIN]) {
    expect(hm(atMinute(day, 600)), day.toDateString()).toBe('10:00');
    expect(hm(instantAt(day, 600)), `grid selection ${day.toDateString()}`).toBe('10:00');
    expect(hm(instantAt(day, 23 * 60 + 45))).toBe('23:45');
    // 1440 = the next midnight (an entry that ends at the end of the day)
    const end = instantAt(day, 1440);
    expect([end.getDate(), end.getHours(), end.getMinutes()]).toEqual([day.getDate() + 1, 0, 0]);
  }
  // the stored instants: 10:00 local is 08:00Z in winter (spring day: still +02 before 02:00, +03 after) and 07:00Z in summer
  expect(instantAt(SPRING, 600).toISOString()).toBe('2026-03-27T07:00:00.000Z');
  expect(instantAt(AUTUMN, 600).toISOString()).toBe('2026-10-25T08:00:00.000Z');
});

test('SCR-37: the resident slot grid and "find a free room" start at the room\'s open hour on the DST days', () => {
  const before = new Date(2026, 0, 1);
  for (const day of [SPRING, AUTUMN]) {
    const grid = slotGrid([], day, [{ from: '08:00', to: '12:00' }], 60, 60, before);
    expect(grid.map((s) => hm(s.start)), day.toDateString()).toEqual(['08:00', '09:00', '10:00', '11:00']);
    // a confirmed 10:00-11:00 entry (stored by the wall clock) takes exactly the 10:00 start
    const e10: Occurrence = { occurrence_id: 'o', event_id: 'e', calendar_id: 'r', room_calendar_ids: ['r'], start: atMinute(day, 600).toISOString(), end: atMinute(day, 660).toISOString(),
      title: null, on_behalf_label: null, organizer: null, recurring: false, state: 'confirmed', kind: 'booking' } as unknown as Occurrence;
    const g2 = slotGrid([e10], day, [{ from: '08:00', to: '12:00' }], 60, 60, before);
    expect(g2.filter((s) => !s.free).map((s) => hm(s.start))).toEqual(['10:00']);
    const f = firstFree([{ calendar_id: 'r', open: [{ from: '09:00', to: '12:00' }], entries: [e10] } as never], day, before, 60);
    expect(f && [hm(f.start), hm(f.end)]).toEqual(['09:00', '10:00']);
  }
});

test('SCR-37: the grid hint reads an entry ending at midnight as the END of the 23-hour day (not 00:00)', () => {
  const cal = { id: 'r', name: 'חדר', type: 'room', my_role: 'book', approval_mode: 'none', conflict_policy: 'exclusive', slot_step_min: 15, min_minutes: 0, max_minutes: 0,
    open_hours: { weekdays: [1, 2, 3, 4, 5, 6, 7], start: '08:00', end: '22:00' }, owner: { name: 'x' } } as unknown as Calendar;
  const s = { editors_bypass_approval: true, pending_holds_slot: false, contested_requests: 'queue', maintenance_overlap: 'first_holds' } as never;
  const late = hintFor({ cal, start: instantAt(SPRING, 21 * 60), end: instantAt(SPRING, 1440) }, [], s, new Date(2026, 0, 1));
  expect(late.level, 'until midnight is past the 22:00 closing').toBe('bad');
  expect(late.reason).toContain('22:00');
  const fits = hintFor({ cal, start: instantAt(SPRING, 20 * 60), end: instantAt(SPRING, 22 * 60) }, [], s, new Date(2026, 0, 1));
  expect(fits.level, JSON.stringify(fits)).toBe('ok');
});

test('SCR-38: the drawer opened on one date of a weekly entry carries that date\'s local key; a single entry carries none', () => {
  expect(drawerDetail({ event_id: 'e1', recurring: true, local_start: '2026-12-03T18:00', start: '2026-12-03T16:00:00Z' }))
    .toEqual({ eventId: 'e1', occurrenceKey: '2026-12-03T18:00', occurrenceStart: '2026-12-03T16:00:00Z' });
  expect(drawerDetail({ event_id: 'e2', recurring: false, local_start: '2026-12-03T18:00', start: '2026-12-03T16:00:00Z' })).toEqual({ eventId: 'e2' });
  expect(drawerDetail({ event_id: 'e3', recurring: true, local_start: '2026-12-03T16:00:00Z', start: '2026-12-03T16:00:00Z' }), 'a UTC instant is no key').toEqual({ eventId: 'e3' });
  // the drawer sends the key only for "only this date", and names the series otherwise (never a silent series cancel)
  const d = read('calendars/event-drawer.ts');
  expect(d).toContain('await api.cancelEvent(ev.id, ev.revision, occ?.key)');
  expect(d).toContain("tr('ביטול הסדרה')");
  expect(d).toContain("tr('ביטול המועד')");
  expect(d).toContain('data-cal-cancel-scope');
  for (const f of ['calendars/view-calendar.ts', 'calendars/view-rooms.ts']) expect(read(f), f).not.toMatch(/newEvent, \{ eventId(: [a-z.]+_id)? \}/);
});

test('SCR-34: "my bookings" on the home screen - a displaced booking is not "approved"', () => {
  expect(bookingLook('confirmed')).toEqual({ look: 'confirmed', tone: 'ok' });
  expect(bookingLook('pending')).toEqual({ look: 'pending', tone: 'warn' });
  expect(bookingLook('displaced')).toEqual({ look: 'displaced', tone: 'danger' });
  expect(bookingLook('done')).toEqual({ look: 'done', tone: 'neutral' });
  expect(bookingLook('rejected').look, 'any other state is unknown, never approved').toBe('unknown');
  expect(bookingLook(undefined).look).toBe('unknown');
  const cal = read('home/home-calendar.ts');
  expect(cal).toContain('${bookState(m.state)}');
  expect(cal).not.toContain("m.state === 'pending' ? tr('מחכה לאישור') : tr('מאושר')");
});

test('SCR-36: a failed "my bookings" read keeps its own error with a retry, never "you have no bookings"', () => {
  const r = read('calendars/resident.ts');
  const load = r.slice(r.indexOf('private async loadMine()'), r.indexOf('private cal(id: string)'));
  expect(load).toContain('this.mineError = describeError(e);');
  expect(load).not.toContain('this.mine = [];');
  expect(r).toContain('data-res-state="mine-error"');
});

test('SCR-20: an electricity bill instant is printed on the account\'s clock, a local text stays as written', () => {
  // the closing reading taken 01:30 local on 01.12 (23:30Z on 30.11) - the bill printed "30.11 23:30"
  expect(fmtDateTime('2026-11-30T23:30:00Z', 'Asia/Jerusalem')).toBe('01.12.2026 01:30');
  expect(fmtDateTime('2026-11-30T23:30:00Z'), 'no zone from the server: the installation\'s (the browser\'s)').toBe('01.12.2026 01:30');
  expect(fmtDateTime('2026-07-15T21:15:00.123Z', 'Asia/Jerusalem'), 'summer time').toBe('16.07.2026 00:15');
  expect(fmtDateTime('2026-11-30T23:30:00+00:00', 'UTC')).toBe('30.11.2026 23:30');
  expect(fmtDateTime('2026-10-02T09:12'), 'a local time without a zone').toBe('02.10.2026 09:12');
  expect(fmtDateTime('2026-09-30')).toBe('30.09.2026');
  expect(fmtDate('2026-11-30T23:30:00Z', 'Asia/Jerusalem'), 'the day of an instant').toBe('01.12.2026');
  expect(fmtDate('2026-09-30'), 'a bare day is never shifted').toBe('30.09.2026');
  expect(fmtDate('')).toBe('');
  expect(read('electricity/elec-bill-paper.ts')).toContain('fmtDateTime(m.end.at, s.period.timezone)');
  expect(read('electricity/elec-bill-page.ts')).toContain('fmtDateTime(e.at, s.period.timezone)');
});

test('SCR-13: commands are stamped on the server\'s time line - learned from any answer, exactly where the body says it', () => {
  resetServerClock();
  const dev = Date.now();
  expect(Math.abs(serverNow() - dev)).toBeLessThan(1000);
  // a Date header 60 s ahead (a slow tablet): the offset follows, to the second
  const ahead = new Date(Math.floor((dev + 60_000) / 1000) * 1000).toUTCString();
  noteDateHeader(ahead, dev, dev);
  expect(serverOffset().source).toBe('header');
  expect(Math.abs(serverOffset().ms - 60_000)).toBeLessThan(1600);
  // an exact `server_time_ms` wins and is not replaced by a later header
  noteServerTime(dev - 30_000, dev - 100, dev + 100);
  expect(serverOffset()).toEqual({ ms: -30_000, source: 'body' });
  noteDateHeader(ahead, dev, dev);
  expect(serverOffset().ms).toBe(-30_000);
  // nothing usable teaches nothing (a mock's server_time_ms: 0, an unparsable header)
  noteServerTime(0, dev, dev);
  noteDateHeader('not a date', dev, dev);
  expect(serverOffset().ms).toBe(-30_000);
  resetServerClock();
  // the banner and every API answer feed it; the stations screen's commands use the same clock
  expect(read('api/intercom-calls.ts')).toMatch(/getActiveCalls[\s\S]*noteServerTime\(r\.server_time_ms/);
  expect(read('api/client.ts')).toContain("noteDateHeader(r.headers.get('date')");
  expect(read('api/intercom.ts')).toContain("import { noteServerTime, serverNow } from './server-clock';");
});
