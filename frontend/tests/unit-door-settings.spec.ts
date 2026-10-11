import { test, expect } from '@playwright/test';
import type { DoorGrantSubject, DoorMap, DoorMapLock } from '../src/api/doors';
import {
  builtinAnswer, filterSubjects, grantQuestion, mappingState, otherGrants, parsePlacement, parseRelay, placementOptions, placementValue, relayOptions, roleQuestion,
} from '../src/screens/system-doors-logic';

// CR-033 wave 1: the pure helpers behind the "פתיחת דלתות" grant card and the station placement / door map cards. Node only;
// synthetic names and ids (no lab data).

const MAP: DoorMap = {
  state: 'ready',
  has_copy: true,
  stations: [
    { id: 'ST-A', name: 'כניסה ראשית', online: true, relays: [{ physical_index: 1, name: null }], placement: null },
    { id: 'ST-C', name: 'רציף', online: true, relays: [{ physical_index: 1, name: 'שער' }, { physical_index: 2, name: null }], placement: { site_id: 's1', building_id: 'b1' } },
  ],
  locks: [],
  sites: [{ id: 's1', name: 'אתר' }],
  buildings: [{ id: 'b1', site_id: 's1', name: 'מבנה א' }],
};

const lock = (over: Partial<DoorMapLock>): DoorMapLock => ({ entity_id: 'lock.x', name: 'x', removed: false, disabled: false, station_id: null, mapping: null, suggestion: null, ...over });

test('built-in roles are read-only answers; questions name the subject', () => {
  expect(builtinAnswer({ id: 'viewer', name: 'צופה', custom: false, includes: false, editable: false, answer: 'never' })).toBe('לעולם לא');
  expect(builtinAnswer({ id: 'site_admin', name: 'מנהל', custom: false, includes: true, editable: false, answer: 'yes' })).toBe('כן');
  expect(builtinAnswer({ id: 'operator', name: 'מפעיל', custom: false, includes: false, editable: false, answer: 'per_user' })).toBe('לא - אפשר לתת למשתמשים בנפרד');
  expect(grantQuestion('דנה', true)).toBe('לתת לדנה הרשאה לפתוח דלתות?');
  expect(grantQuestion('דנה', false)).toContain('להסיר');
  expect(roleQuestion('משמרת', true)).toContain('משמרת');
});

test('other grants are listed by role and scope names, and the search filters by name', () => {
  const s: DoorGrantSubject = { kind: 'user', id: 'u1', name: 'דנה', active: true, granted: false, other: [{ binding_id: 'b', role_name: 'פותח דלתות', scope_name: 'עמדה · רציף' }] };
  expect(otherGrants(s)).toBe('שיוך אחר: פותח דלתות · עמדה · רציף');
  expect(otherGrants({ ...s, other: [] })).toBe('');
  const g: DoorGrantSubject = { ...s, kind: 'group', id: 'g', name: 'שומרים', other: [] };
  expect(filterSubjects([s, g], 'שומ').map((x) => x.id)).toEqual(['g']);
  expect(filterSubjects([s, g], '  ')).toHaveLength(2);
});

test('placement values round-trip and list the installation, sites and buildings', () => {
  expect(placementValue(null)).toBe('');
  expect(placementValue({ site_id: 's1', building_id: 'b1' })).toBe('building:b1');
  expect(placementValue({ site_id: 's1', building_id: null })).toBe('site:s1');
  expect(parsePlacement('building:b1')).toEqual({ site_id: null, building_id: 'b1' });
  expect(parsePlacement('site:s1')).toEqual({ site_id: 's1', building_id: null });
  expect(parsePlacement('')).toEqual({ site_id: null, building_id: null });
  expect(placementOptions(MAP).map((o) => o.value)).toEqual(['', 'site:s1', 'building:b1']);
});

test('relay options: the lock\'s own station when its registry names one, every station otherwise; values parse back', () => {
  expect(relayOptions(MAP, lock({ station_id: 'ST-C' })).map((o) => o.value)).toEqual(['ST-C#1', 'ST-C#2']);
  expect(relayOptions(MAP, lock({})).map((o) => o.label)).toEqual(['כניסה ראשית · ממסר 1', 'רציף · שער', 'רציף · ממסר 2']);
  expect(parseRelay('ST-C#2')).toEqual({ station_id: 'ST-C', relay: 2 });
  expect(parseRelay('id#with#hash#1')).toEqual({ station_id: 'id#with#hash', relay: 1 });
  expect(parseRelay('')).toBeNull();
  expect(parseRelay('ST#0')).toBeNull();
});

test('mapping state: mapped, invalid, suggested, unmapped', () => {
  const mapping = { station_id: 'ST-A', station_name: 'כניסה ראשית', relay: 1, source: 'single_relay' as const, mapped_at: '2026-10-10T00:00:00Z', valid: true, problem: null };
  expect(mappingState(lock({ mapping }))).toEqual({ tone: 'live', text: 'משויך' });
  expect(mappingState(lock({ mapping: { ...mapping, source: 'manual' } })).text).toBe('משויך ידנית');
  expect(mappingState(lock({ mapping: { ...mapping, valid: false, problem: 'relay_gone' } })).tone).toBe('stale');
  expect(mappingState(lock({ suggestion: { station_id: 'ST-A', relay: 1 } })).text).toBe('הצעה לשיוך מוכנה');
  expect(mappingState(lock({})).text).toContain('לא משויך');
});
