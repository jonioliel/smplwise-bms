import { test, expect } from '@playwright/test';
import type { DoorGrantSubject, DoorMap, DoorMapLock, DoorPathInventory, DoorPathItem } from '../src/api/doors';
import {
  GRANT_ALSO, builtinAnswer, doorsText, filterInventory, filterSubjects, grantQuestion, guardTone, inventorySummary, itemMeta, lastRunText, mappingState, otherGrants, parsePlacement, parseRelay,
  peopleLine, placementOptions, placementValue, relayOptions, roleQuestion,
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
  // SEC-WXD L3: the granting questions name everything the door permission also allows; the removing ones stay short
  expect(grantQuestion('דנה', true)).toBe(`לתת לדנה הרשאה לפתוח דלתות? ${GRANT_ALSO}`);
  // 2.4.9 (owner decision 2026-10-13): calls and announcements ride access.call, so the door grant no longer names them
  expect(GRANT_ALSO).not.toContain('שיחות');
  expect(GRANT_ALSO).not.toContain('הכרזות');
  expect(GRANT_ALSO).toContain('יומן הכניסות');
  expect(grantQuestion('דנה', false)).toBe('להסיר מדנה את ההרשאה לפתוח דלתות?');
  expect(roleQuestion('משמרת', true)).toContain('משמרת');
  expect(roleQuestion('משמרת', true)).toContain(GRANT_ALSO);
  expect(roleQuestion('משמרת', false)).not.toContain(GRANT_ALSO);
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

// CR-033 D7: the read-only door-path inventory card ("פריטים שפותחים דלתות")

const ITEM: DoorPathItem = {
  kind: 'automation', kind_text: 'אוטומציה', key: 'automation:a1', name: 'פתיחה בבוקר', origin: 'arx_authored', origin_text: 'נוצר ב-Arx', state: 'enabled', autonomous: true,
  author: 'cara', created_by: 'cara', approver: 'ana', approved_at: '2026-10-10T06:00:00Z', approver_status: 'approved', approver_text: 'מאושר', last_run: null, door_steps: 1, lock_steps: 0,
  doors: ['כניסה ראשית · ממסר 1'], resolvable: true, unresolved: [], run_guard: 'refused_not_converted', run_guard_text: 'הרצה מ-Arx נחסמת', suggestion: 'arx_event_job',
  suggestion_text: 'משימת דלת של Arx (בהמשך)', disable_required: false, revision: 'r1',
};

const INV = (items: DoorPathItem[], present = true): DoorPathInventory => ({
  wiskey_present: present, generated_at: '2026-10-11T00:00:00Z', items,
  counts: { items: items.length, door_steps: items.reduce((n, i) => n + i.door_steps, 0), unresolvable: items.filter((i) => i.run_guard === 'refused_unresolvable').length, arx_authored: 0, external: 0,
    disable_required: items.filter((i) => i.disable_required).length },
});

test('inventory filters, summary and lines read in Hebrew and by name only', () => {
  const review: DoorPathItem = { ...ITEM, key: 'automation:a2', run_guard: 'refused_unresolvable', resolvable: false, doors: [], unresolved: ['היעד מחושב בזמן ריצה'], disable_required: true,
    approver: null, approver_status: 'none', approver_text: 'אין מאשר' };
  const plain: DoorPathItem = { ...ITEM, key: 'scene:s1', run_guard: 'unchanged', door_steps: 0, lock_steps: 1, doors: [] };
  const items = [ITEM, review, plain];
  expect(filterInventory(items, 'all')).toHaveLength(3);
  expect(filterInventory(items, 'blocked').map((i) => i.key)).toEqual(['automation:a1', 'automation:a2']);
  expect(filterInventory(items, 'disable').map((i) => i.key)).toEqual(['automation:a2']);
  expect(filterInventory(items, 'review').map((i) => i.key)).toEqual(['automation:a2']);
  expect(inventorySummary(INV(items))).toBe('3 פריטים · 2 שלבי פתיחה · 1 לבדיקה ידנית · 1 דורשים השבתה');
  expect(inventorySummary(INV([]))).toBe('אין פריטים שפותחים דלתות');
  expect(inventorySummary(INV([], false))).toBe('אין דלתות אינטרקום בהתקנה');
  expect(itemMeta(ITEM)).toBe('אוטומציה · נוצר ב-Arx · פעיל');
  expect(peopleLine(ITEM)).toBe('נכתב בידי cara · אושר בידי ana');
  expect(peopleLine(review)).toBe('נכתב בידי cara · אין מאשר');
  expect(lastRunText(ITEM, (s) => s)).toBe('לא הורץ');
  expect(lastRunText({ ...ITEM, last_run: { at: '2026-10-10T06:00:00Z', result: 'ok' } }, () => 'אתמול')).toBe('הרצה אחרונה: אתמול');
  expect(doorsText(ITEM)).toBe('כניסה ראשית · ממסר 1');
  expect(doorsText({ ...review, door_steps: 2 })).toBe('2 שלבי פתיחה');
  expect(doorsText(plain)).toBe('1 שלבי נעילה');
  expect([guardTone(ITEM), guardTone(review), guardTone(plain)]).toEqual(['unknown', 'stale', 'neutral']);
  expect(JSON.stringify(items.map((i) => [itemMeta(i), peopleLine(i), doorsText(i)]))).not.toMatch(/lock\.|script\.|01J/);
});
