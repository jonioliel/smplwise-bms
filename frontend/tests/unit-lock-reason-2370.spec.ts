import { test, expect } from '@playwright/test';
import {
  DOOR_MAP_HREF, GENERIC_DENIED, deniedNote, dimmedActionTitle, doorPermissionNote, mapCardGrantNote, unlockReasonText, unmappedDoorsNotice, type UnlockReason,
} from '../src/screens/lock-reason';

// UNLOCK-REASON-2370: the Hebrew sentence per reason the server's `unlock_reason` returns, and the door-map link - offered only to a holder of
// system.configure. Node only; synthetic data (no lab names, ids or addresses).

const CODES: Exclude<UnlockReason, 'ok'>[] = ['no_permission', 'door_not_mapped', 'alarm_managed', 'not_placed', 'wall_profile', 'no_control'];

test('every reason has its own sentence, and none of them is the old "needs a separate permission" line', () => {
  const seen = new Set<string>();
  for (const code of CODES) {
    const t = unlockReasonText(code, false);
    expect(t, code).not.toBeNull();
    expect(t!.text).not.toContain('הרשאה נפרדת');
    expect(t!.title.length).toBeGreaterThan(10);
    seen.add(t!.text);
  }
  expect(seen.size).toBe(CODES.length);
});

test('the sentences the owner asked for', () => {
  expect(unlockReasonText('door_not_mapped', false)!.text).toBe('הדלת לא משויכת לתחנה');
  expect(unlockReasonText('no_permission', false)!.text).toBe('אין לך הרשאת פתיחה לדלת זו');
  expect(unlockReasonText('alarm_managed', false)!.text).toBe('המנעול מנוהל ממסך האזעקה');
  expect(unlockReasonText('not_placed', false)!.text).toBe('ההרשאה שלך לפי קומה - המנעול לא ממוקם על מפת הקומה');
});

test('"ok", an empty reason and a code this build does not know give no note', () => {
  expect(unlockReasonText('ok', true)).toBeNull();
  expect(unlockReasonText(undefined, true)).toBeNull();
  expect(unlockReasonText(null, true)).toBeNull();
  expect(unlockReasonText('some_future_reason', true)).toBeNull();
});

test('the door-map link exists only for the unmapped reason and only for a system administrator', () => {
  expect(unlockReasonText('door_not_mapped', true)!.link).toEqual({ href: DOOR_MAP_HREF, label: 'לשיוך דלתות' });
  expect(unlockReasonText('door_not_mapped', false)!.link).toBeNull();
  for (const code of CODES.filter((c) => c !== 'door_not_mapped')) expect(unlockReasonText(code, true)!.link, code).toBeNull();
  expect(DOOR_MAP_HREF).toBe('#/system/setup');
});

test('the panel falls back to the generic sentence only when an older server sends no reason', () => {
  expect(deniedNote({ can_unlock: false }, true)).toBe(GENERIC_DENIED);
  expect(deniedNote({ can_unlock: false, unlock_reason: 'door_not_mapped' }, true).text).toBe('הדלת לא משויכת לתחנה');
  expect(deniedNote({ can_unlock: false, unlock_reason: 'no_permission' }, true).link).toBeNull();
});

test('the map card names the reason of the open action; other dimmed actions keep the generic note', () => {
  const unlock = { id: 'lock.unlock', granted: false, reason: 'door_not_mapped' };
  expect(mapCardGrantNote([unlock], true)!.text).toBe('הדלת לא משויכת לתחנה');
  expect(mapCardGrantNote([unlock], true)!.link!.href).toBe(DOOR_MAP_HREF);
  expect(mapCardGrantNote([unlock], false)!.link).toBeNull();
  expect(mapCardGrantNote([{ id: 'lock.unlock', granted: true, reason: 'ok' }], true)).toBeNull();
  expect(mapCardGrantNote(undefined, true)).toBeNull();
  const generic = mapCardGrantNote([{ id: 'siren.turn_on', granted: false }], true)!;
  expect(generic.text).toContain('הרשאה נפרדת');
  expect(generic.link).toBeNull();
  const both = mapCardGrantNote([unlock, { id: 'siren.turn_on', granted: false }], false)!;
  expect(both.text).toContain('הדלת לא משויכת לתחנה');
  expect(both.text).toContain('הרשאה נפרדת');
});

test('the dimmed open button explains itself; other dimmed buttons keep the permission name', () => {
  expect(dimmedActionTitle({ id: 'lock.unlock', grant: 'door.unlock', reason: 'not_placed' }, false)).toBe('ההרשאה שלך לפי קומה - המנעול לא ממוקם על מפת הקומה');
  expect(dimmedActionTitle({ id: 'lock.unlock', grant: 'door.unlock' }, false)).toBe('נדרשת הרשאה נפרדת: door.unlock');
  expect(dimmedActionTitle({ id: 'alarm_control_panel.disarm', grant: 'alarm.disarm', reason: 'door_not_mapped' }, false)).toBe('נדרשת הרשאה נפרדת: alarm.disarm');
});

test('the effective-permissions note appears for a door permission and links only for an administrator', () => {
  expect(doorPermissionNote(['map.read', 'devices.read'], true)).toBeNull();
  for (const p of ['door.unlock', 'access.doors.open', 'access.release']) {
    const n = doorPermissionNote(['map.read', p], false)!;
    expect(n.text).toContain('שיוך');
    expect(n.link).toBeNull();
    expect(doorPermissionNote([p], true)!.link!.href).toBe(DOOR_MAP_HREF);
  }
});

test('the door-permissions tab notice counts the doors and stays silent when none waits', () => {
  expect(unmappedDoorsNotice(undefined, true)).toBeNull();
  expect(unmappedDoorsNotice({ count: 0, with_suggestion: 0 }, true)).toBeNull();
  expect(unmappedDoorsNotice({ count: 1, with_suggestion: 1 }, false)!.text).toContain('דלת אינטרקום אחת');
  const many = unmappedDoorsNotice({ count: 10, with_suggestion: 10 }, true)!;
  expect(many.text).toContain('10 דלתות');
  expect(many.link!.href).toBe(DOOR_MAP_HREF);
  expect(unmappedDoorsNotice({ count: 10, with_suggestion: 10 }, false)!.link).toBeNull();
});
