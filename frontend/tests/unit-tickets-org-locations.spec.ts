import { test, expect } from '@playwright/test';
import type { LocationsAnswer, OrgLocation } from '../src/api/tickets-locations';
import {
  OTHER, blankDraft, defaultPick, draftBody, fullText, locationBody, locationProblems, messageText, navAvailable, otherTooLong, pickPreview, pickerOptions,
  serverProblem,
} from '../src/tickets/org-locations-model';
import { LOC_TEXT_EN, LOC_TEXT_HE } from '../src/tickets/org-locations-text';
import { safeMapUrl } from '../src/public-ticket/rfq/rfq-state';

// CR-ORG-LOCATIONS: the pure rules of the location picker and of the Settings editor. Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-org-locations.spec.ts

const loc = (id: string, extra: Partial<OrgLocation> = {}): OrgLocation => ({
  id, name: `מיקום ${id}`, street: 'הרצל 5', city: 'תל אביב', details: 'קומה 3', is_default: false, sort_order: 0, has_coordinates: false, map_url: '', ...extra,
});
const answer = (locations: OrgLocation[], extra: Partial<LocationsAnswer> = {}): LocationsAnswer => ({ locations, default_id: null, department_defaults: {}, ...extra });

test('the default pick: the department default wins, then the organisation default, else no location', () => {
  const a = answer([loc('a'), loc('b'), loc('c')], { default_id: 'a', department_defaults: { d1: 'b', d2: 'gone' } });
  expect(defaultPick(a, 'd1')).toBe('b');
  expect(defaultPick(a, 'd2')).toBe('a'); // a department default that is not active any more is skipped
  expect(defaultPick(a, 'd3')).toBe('a');
  expect(defaultPick(answer([loc('a')]), 'd1')).toBe(''); // both defaults are optional
});

test('without locations (or while unavailable) the form keeps the free-text field', () => {
  expect(defaultPick(null, 'd1')).toBe(OTHER);
  expect(defaultPick(answer([]), 'd1')).toBe(OTHER);
  expect(pickerOptions(null)).toEqual([]);
});

test('the picker lists by order then name', () => {
  const opts = pickerOptions(answer([loc('z', { sort_order: 2, name: 'א' }), loc('y', { sort_order: 1, name: 'ת' }), loc('x', { sort_order: 1, name: 'ב' })]));
  expect(opts.map((o) => o.id)).toEqual(['x', 'y', 'z']);
});

test('the creation body: a reference, or "other" as the free-text place, or nothing', () => {
  expect(locationBody('a', 'ignored')).toEqual({ location_id: 'a' });
  expect(locationBody(OTHER, '  חדר שרתים ')).toEqual({ place_text: 'חדר שרתים' });
  expect(locationBody(OTHER, '   ')).toEqual({});
  expect(locationBody('', 'x')).toEqual({});
  expect(otherTooLong(OTHER, 'א'.repeat(201))).toBe(true);
  expect(otherTooLong('a', 'א'.repeat(201))).toBe(false);
});

test('the message text mirrors the server: name · street, city; details stay off the message; the map link only when on', () => {
  const l = loc('a', { has_coordinates: true, map_url: 'https://maps.google.com/?q=32.08530,34.78180' });
  expect(messageText(l)).toBe('מיקום a · הרצל 5, תל אביב');
  expect(fullText(l)).toBe('מיקום a · הרצל 5, תל אביב · קומה 3');
  const a = answer([l, loc('b')]);
  expect(pickPreview(a, 'a', '', false)).toBe('מיקום a · הרצל 5, תל אביב');
  expect(pickPreview(a, 'a', '', true)).toBe('מיקום a · הרצל 5, תל אביב · https://maps.google.com/?q=32.08530,34.78180');
  expect(pickPreview(a, 'b', '', true)).toBe('מיקום b · הרצל 5, תל אביב'); // no coordinates: nothing to add
  expect(pickPreview(a, OTHER, ' חדר ', true)).toBe('חדר');
  expect(navAvailable(a, 'a')).toBe(true);
  expect(navAvailable(a, 'b')).toBe(false);
  expect(navAvailable(a, OTHER)).toBe(false);
});

test('the editor refuses a missing / long / duplicate name, links, a missing address and half coordinates', () => {
  const others = [{ id: 'x', name: 'Main Office' }];
  const ok = { ...blankDraft(), name: 'מחסן', street: 'האומן 12' };
  expect(locationProblems(ok, others, null)).toEqual({});
  expect(locationProblems({ ...ok, name: ' ' }, others, null).name).toBe('required');
  expect(locationProblems({ ...ok, name: 'א'.repeat(41) }, others, null).name).toBe('too_long');
  expect(locationProblems({ ...ok, name: 'main office' }, others, null).name).toBe('duplicate');
  expect(locationProblems({ ...ok, name: 'main office' }, others, 'x').name).toBeUndefined(); // its own name
  expect(locationProblems({ ...ok, details: 'ראו https://evil.example.test' }, others, null).details).toBe('url');
  expect(locationProblems({ ...ok, details: 'evil.example/x' }, others, null).details).toBe('url');
  expect(locationProblems({ ...ok, street: '', city: '' }, others, null).street).toBe('address');
  expect(locationProblems({ ...ok, lat: '32.1' }, others, null).coords).toBe('coords');
  expect(locationProblems({ ...ok, lat: '91', lng: '34' }, others, null).coords).toBe('coords');
  expect(locationProblems({ ...ok, lat: 'abc', lng: '34' }, others, null).coords).toBe('coords');
  expect(locationProblems({ ...ok, lat: '32.1', lng: '34.8' }, others, null)).toEqual({});
  expect(locationProblems({ ...ok, active: false, is_default: true }, others, null).default).toBe('inactive_default');
  // markup and SQL are plain text here (the server keeps them literal; Lit and the DOM render them as text)
  expect(locationProblems({ ...ok, details: '<img src=x onerror=alert(1)>' }, others, null)).toEqual({});
  expect(locationProblems({ ...ok, name: "x'); DROP TABLE t;--" }, others, null)).toEqual({});
});

test('the editor body trims, parses the coordinates and never sends an inactive default', () => {
  const b = draftBody({ ...blankDraft(), name: ' מחסן ', street: ' האומן 12 ', lat: ' 32.5 ', lng: '34.9', sort_order: 'x', active: false, is_default: true }, 3);
  expect(b).toEqual({ name: 'מחסן', street: 'האומן 12', city: '', details: '', lat: 32.5, lng: 34.9, sort_order: 0, active: false, is_default: false, revision: 3 });
  expect(draftBody({ ...blankDraft(), name: 'a', city: 'b' }).lat).toBeNull();
});

test('server codes map to the editor vocabulary', () => {
  expect(serverProblem('location_name_taken')).toBe('duplicate');
  expect(serverProblem('url_not_allowed')).toBe('url');
  expect(serverProblem('pair')).toBe('coords');
  expect(serverProblem('whatever')).toBeNull();
});

test('the vendor page follows only the short maps link the server builds', () => {
  expect(safeMapUrl('https://maps.google.com/?q=32.08530,34.78180')).toBe('https://maps.google.com/?q=32.08530,34.78180');
  expect(safeMapUrl('https://maps.google.com/?q=-33.86880,-151.20930')).toBe('https://maps.google.com/?q=-33.86880,-151.20930');
  for (const bad of ['javascript:alert(1)', 'https://evil.example.test/?q=1.00000,2.00000', 'https://maps.google.com/?q=x', 'https://maps.google.com.evil.test/?q=1.00000,2.00000', '', null, undefined]) {
    expect(safeMapUrl(bad as string)).toBe('');
  }
});

test('every Hebrew string has an English one and no internal task code is shown', () => {
  expect(Object.keys(LOC_TEXT_EN).sort()).toEqual(Object.keys(LOC_TEXT_HE).sort());
  for (const s of Object.values(LOC_TEXT_HE)) expect(s).not.toMatch(/CR-|ORG-?LOC|TK[A-Z0-9]{2,}/);
});
