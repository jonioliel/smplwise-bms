import { test, expect } from '@playwright/test';
import { legacyFiltered } from '../src/screens/system-access-logic';

// WXPERM (owner decision 2026-10-13): the custom-role editor offers a legacy permission name only to a role that already holds
// it (so it can be removed); a new grant uses the new name. Node only; synthetic permission lists.

const SENSITIVE = ['door.unlock', 'access.doors.open', 'access.release', 'access.call', 'access.people.manage', 'access.people.message'];
const LEGACY = { 'access.release': 'access.doors.open' };

test('a new role is never offered the legacy name', () => {
  expect(legacyFiltered(SENSITIVE, LEGACY, new Set())).toEqual(['door.unlock', 'access.doors.open', 'access.call', 'access.people.manage', 'access.people.message']);
});

test('a role that already holds the legacy name still sees it, in place', () => {
  expect(legacyFiltered(SENSITIVE, LEGACY, new Set(['access.release', 'access.read']))).toEqual(SENSITIVE);
});

test('an older backend without the legacy map lists everything', () => {
  expect(legacyFiltered(SENSITIVE, undefined, new Set())).toEqual(SENSITIVE);
});

test('the permissions of the owner rule stay separate entries', () => {
  const shown = legacyFiltered(SENSITIVE, LEGACY, new Set());
  expect(shown).toContain('access.people.manage');
  expect(shown).toContain('access.people.message');
  expect(shown).toContain('access.call');
});
