import { test, expect } from '@playwright/test';
import { cancelBody, occurrenceKey } from '../src/home/home-p2-api';
import { occurrenceKey as calOccurrenceKey } from '../src/calendars/booking-logic';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

// SCREENS-FIX-B-2520: the pure rules behind the high findings of the deep screens review (docs/review/DEEP-REVIEW-2520-FRONTEND-SCREENS.md).
//   npx playwright test -c playwright.unit.config.ts tests/unit-screens-fix-b-2520.spec.ts

test('SCR-04: home "my bookings" - one date of a series sends its local key; only an explicit series choice sends none', () => {
  // the server's occurrence key is the LOCAL start in the calendar's zone (services/calendar/events.py `_scope`), never the UTC instant
  expect(occurrenceKey({ recurring: true, local_start: '2026-12-03T18:00' })).toBe('2026-12-03T18:00');
  expect(occurrenceKey({ recurring: true, local_start: '2026-12-03T16:00:00Z' }), 'a UTC instant is no key').toBeNull();
  expect(occurrenceKey({ recurring: true }), 'a date without a key cannot be cancelled alone').toBeNull();
  expect(occurrenceKey({ recurring: false, local_start: '2026-12-03T18:00' }), 'a single booking is itself').toBeNull();
  expect(cancelBody('confirmed', 'r3', '2026-12-03T18:00')).toEqual({ revision: 'r3', scope: 'occurrence', occurrence_start: '2026-12-03T18:00' });
  expect(cancelBody('confirmed', 'r3', null), 'the whole series (chosen): no scope, the server default').toEqual({ revision: 'r3' });
  expect(cancelBody('pending', 'r3', '2026-12-03T18:00'), 'a withdrawal is the whole request').toEqual({ revision: 'r3' });
});

test('SCR-03: the resident "only this date" names the date by its local key, never the UTC instant', () => {
  expect(calOccurrenceKey({ recurring: true, local_start: '2026-12-03T18:00' })).toBe('2026-12-03T18:00');
  expect(calOccurrenceKey({ recurring: true, local_start: undefined })).toBeNull();
  expect(calOccurrenceKey({ recurring: false, local_start: '2026-12-03T18:00' })).toBeNull();
  const res = readFileSync(path.join(SRC, 'calendars/resident.ts'), 'utf8');
  const cancel = res.slice(res.indexOf('private async cancel(o: Occurrence)'), res.indexOf('private displacedSheet('));
  expect(cancel).not.toMatch(/'occurrence' \? o\.start/); // the 422 of SCR-03
  expect(cancel).toContain('occurrenceKey(o)');
});

test('SCR-02: recorded playback follows the playing position into the next local day - across midnight and across a DST change', async () => {
  const { dayToFollow, stampDate, standingInstant } = await import('../src/screens/playback-day');
  const TZ = 'Asia/Jerusalem';
  // an ordinary night (UTC+2): 23:59:59 is still the picked day, 00:00:01 is the next one
  expect(dayToFollow('2026-01-14', new Date('2026-01-14T21:59:59Z'), TZ)).toBeNull();
  expect(dayToFollow('2026-01-14', new Date('2026-01-14T22:00:01Z'), TZ)).toBe('2026-01-15');
  // the night into the spring change (Friday 27.03.2026 02:00 -> 03:00): midnight is still UTC+2
  expect(dayToFollow('2026-03-26', new Date('2026-03-26T21:59:59Z'), TZ)).toBeNull();
  expect(dayToFollow('2026-03-26', new Date('2026-03-26T22:00:01Z'), TZ)).toBe('2026-03-27');
  // the night into the autumn change (Sunday 25.10.2026 02:00 -> 01:00): midnight is UTC+3, not UTC+2
  expect(dayToFollow('2026-10-24', new Date('2026-10-24T20:59:59Z'), TZ)).toBeNull();
  expect(dayToFollow('2026-10-24', new Date('2026-10-24T21:00:01Z'), TZ)).toBe('2026-10-25');
  // the day after the spring change (UTC+3): the stamp, the bookmark and the export stand on the playing instant, never 24 h off
  const playing = new Date('2026-03-27T21:00:30Z'); // 00:00:30 on 28.03 local
  expect(dayToFollow('2026-03-27', playing, TZ)).toBe('2026-03-28');
  expect(stampDate(playing, '2026-03-27', 0.5, TZ), 'the stamp never shows yesterday with today\'s time').toBe('2026-03-28');
  expect(standingInstant(playing, '2026-03-27', 0.5, TZ).toISOString()).toBe(playing.toISOString()); // not 24 h earlier
  // without a position the picked day + cursor stands, in the zone (the DST day itself: 12:00 local is UTC+3)
  expect(standingInstant(null, '2026-03-27', 720, TZ).toISOString()).toBe('2026-03-27T09:00:00.000Z');
  expect(stampDate(null, '2026-03-27', 720, TZ)).toBe('2026-03-27');
  expect(dayToFollow('2026-03-27', null, TZ)).toBeNull();
  expect(dayToFollow('2026-03-27', new Date(NaN), TZ)).toBeNull();
  // the screen wires it: every place the position moves follows the day; the stamp and "add to case" read the position
  const scr = readFileSync(path.join(SRC, 'screens/investigate-playback.ts'), 'utf8');
  const body = (from: string, to: string) => scr.slice(scr.indexOf(from), scr.indexOf(to, scr.indexOf(from)));
  expect(body('private tick() {', '// ---- T042')).toContain('this.followDay(now)');
  expect(body('private tickGroup() {', 'const drifts')).toContain('this.followDay(now)');
  expect(body('private async startAt(', 'this.paused = false;')).toContain('this.followDay(this.position)');
  expect(scr).not.toContain('<span class="stamp">${this.date}');
  expect(scr).not.toContain('clipAround(instantInZone(this.date, this.cursor, this.tz))');
});
