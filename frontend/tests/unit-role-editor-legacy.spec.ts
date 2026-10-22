import { test, expect } from '@playwright/test';
import { customRoleSensitive, legacyFiltered } from '../src/screens/system-access-logic';

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

// SMALLFIXB-295: "select all" of the sensitive grants must not submit a permission that is sensitive AND system
// (bridge.key.rotate): the route refuses it with 422 system_permission_not_allowed.
const SYSTEM = ['system.configure', 'bridge.key.rotate', 'users.ha_manage'];

test('a sensitive system permission is never offered to a custom role', () => {
  const all = customRoleSensitive([...SENSITIVE, 'bridge.key.rotate'], SYSTEM);
  expect(all).not.toContain('bridge.key.rotate');
  expect(all).toEqual(SENSITIVE);
});

test('select-all of the legacy-filtered list submits no system permission', () => {
  const offered = customRoleSensitive(legacyFiltered([...SENSITIVE, 'bridge.key.rotate', 'users.ha_manage'], LEGACY, new Set()), SYSTEM);
  expect(offered.filter((p) => SYSTEM.includes(p))).toEqual([]);
  expect(offered).toContain('door.unlock');
});

test('an older backend without system_permissions lists everything', () => {
  expect(customRoleSensitive(SENSITIVE, undefined)).toEqual(SENSITIVE);
});
