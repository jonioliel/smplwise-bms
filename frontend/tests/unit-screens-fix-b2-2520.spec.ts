import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cancelBody } from '../src/home/home-p2-api';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

// SCREENS-FIX-B2-2520: follow-ups of SCREENS-FIX-B-2520 (the SCR-40 public-page rules live in unit-public-ticket.spec.ts).
//   npx playwright test -c playwright.unit.config.ts tests/unit-screens-fix-b2-2520.spec.ts

test('home withdraw: a pending request sends the revision /me/calendar gave it (the server compares it as a number)', () => {
  expect(cancelBody('pending', 3), 'the revision as the server sent it - a number').toEqual({ revision: 3 });
  expect(cancelBody('pending', 1)).toEqual({ revision: 1 });
  expect(cancelBody('pending', undefined), 'an older server without the revision: nothing (the server answers "stale", as before)').toEqual({});
  expect(cancelBody('pending', ''), 'an empty value is no revision').toEqual({});
  expect(cancelBody('confirmed', 2, '2026-12-03T18:00'), 'SCR-04 is unchanged').toEqual({ revision: 2, scope: 'occurrence', occurrence_start: '2026-12-03T18:00' });
});

test('home withdraw: the trash of a pending request with no booking row passes the pending item\'s revision', () => {
  const cal = readFileSync(path.join(SRC, 'home/home-calendar.ts'), 'utf8');
  const del = cal.slice(cal.indexOf('p2BookDel: (el) =>'), cal.indexOf('p2BookDelGo: (el) =>'));
  expect(del).toContain("cancelEvent(m?.event_id ?? id, m ? m.state : 'pending', m ? m.revision : p?.revision)");
  expect(cal).toContain('pending: PendingRequest[]');
  const api = readFileSync(path.join(SRC, 'home/home-p2-api.ts'), 'utf8');
  expect(api).toMatch(/export interface PendingRequest \{[^}]*revision\?: number/);
  // the generated wire type of the answer carries it (wire/calendar.py CalPending)
  const wire = readFileSync(path.join(SRC, 'api/generated/wire-calendar.ts'), 'utf8');
  const pending = wire.slice(wire.indexOf('export interface CalPending {'), wire.indexOf('}', wire.indexOf('export interface CalPending {')));
  expect(pending).toContain('revision: number;');
});
