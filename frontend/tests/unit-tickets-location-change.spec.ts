import { test, expect } from '@playwright/test';
import { OTHER, ticketEditLocationBody } from '../src/tickets/org-locations-model';
import { eventLine } from '../src/tickets/model';
import type { TicketEvent } from '../src/api/tickets';

// Owner 2026-10-19: a service request's location may change after creation (a new snapshot; the old one stays in the timeline).
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-location-change.spec.ts

const ev = (data: Record<string, unknown>): TicketEvent => ({ id: '1', at: '2026-10-19T10:00:00Z', kind: 'edited', actor: { kind: 'user', name: 'דנה', me: false },
  from: null, to: null, body: null, data, via: 'ui', external: false } as TicketEvent);

test('nothing is sent when the location was not touched', () => {
  expect(ticketEditLocationBody('loc1', '', 'loc1', '', true)).toEqual({});
  expect(ticketEditLocationBody(OTHER, 'חדר 3', OTHER, ' חדר 3 ', true)).toEqual({});
});

test('a new location is sent with the free text cleared, and never the navigation switch', () => {
  expect(ticketEditLocationBody('loc1', '', 'loc2', '', true)).toEqual({ location_id: 'loc2', place_text: '' });
  expect(ticketEditLocationBody('loc1', '', '', '', true)).toEqual({ location_id: null, place_text: '' });
  expect(ticketEditLocationBody('loc1', '', OTHER, ' מחסן ', true)).toEqual({ location_id: null, place_text: 'מחסן' });
});

test("a device's request never sends the free-text place", () => {
  expect(ticketEditLocationBody('', '', 'loc2', '', false)).toEqual({ location_id: 'loc2' });
  expect(ticketEditLocationBody('loc1', '', OTHER, 'x', false)).toEqual({ location_id: null });
});

test('the timeline row names the old and the new location', () => {
  const line = eventLine(ev({ fields: ['location_id'], location: { from: { id: 'a', text: 'מטה ראשי · הרצל 5, תל אביב', place_text: '' },
    to: { id: 'b', text: 'מחסן צפון · התעשייה 7, חיפה', place_text: '' } } }));
  expect(line.icon).toBe('edit');
  expect(line.text).toBe('המיקום שונה מ"מטה ראשי · הרצל 5, תל אביב" ל"מחסן צפון · התעשייה 7, חיפה"');
  const cleared = eventLine(ev({ fields: ['location_id', 'place_text'], location: { from: { id: null, text: '', place_text: 'חדר 3' }, to: { id: null, text: '', place_text: '' } } }));
  expect(cleared.text).toBe('המיקום שונה מ"חדר 3" ל"ללא מיקום"');
  expect(eventLine(ev({ fields: ['title'] })).text).toBe('עודכנו: כותרת');
});