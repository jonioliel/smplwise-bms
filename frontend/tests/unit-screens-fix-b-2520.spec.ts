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
