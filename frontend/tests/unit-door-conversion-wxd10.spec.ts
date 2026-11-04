import { test, expect } from '@playwright/test';
import type { DoorConversionItem, DoorConversionList, DoorConversionOffer } from '../src/api/doors';
import { CONVERSION_ACTION_TEXT, conversionQuestion, conversionSummary, recordLine } from '../src/screens/system-doors-logic';

// WXD10A / WXD10B: the pure helpers of the "disable and list" list. Node only; synthetic names (no lab data).

const NO: DoorConversionOffer = { available: false, reason: 'kind', reason_text: 'פעולה זו אינה מתאימה לסוג הפריט' };
const COUNTS = { items: 0, disable: 0, convert_event_job: 0, hand_over_program: 0, list_only: 0, disable_required: 0, handled: 0 };
const EMPTY: DoorConversionList = {
  switch: 'off', state: 'nothing_found', state_text: 'לא נמצאו פריטים שפותחים דלת. אין מה להשבית או להסב.', wiskey_present: true,
  generated_at: '2026-11-04T08:00:00Z', counts: COUNTS, items: [], records: [],
};
const ITEM: DoorConversionItem = {
  key: 'automation:a1', kind: 'automation', name: 'פעמון פותח', category: 'event_automation', category_text: 'אוטומציה שמופעלת מאירוע',
  origin: 'arx_authored', origin_text: 'נוצר ב-Arx', state: 'enabled', autonomous: true, revision: 'r1', door_steps: 1, doors: ['כניסה · ממסר 1'],
  resolvable: true, unresolved: [], disable_required: false, approver_text: 'מאושר', run_guard_text: '',
  actions: {
    disable: { available: true, reason: null, reason_text: '' },
    convert_event_job: { available: true, reason: null, reason_text: '', removed_steps: 2, doors: ['כניסה · ממסר 1'] },
    hand_over_program: NO,
  },
  offered: ['disable', 'convert_event_job'], record: null,
};

test('nothing found is said plainly and offers nothing', () => {
  expect(conversionSummary(EMPTY)).toBe(EMPTY.state_text);
  expect(conversionSummary({ ...EMPTY, state: 'no_wiskey', state_text: '' })).toBe('אין דלתות אינטרקום בהתקנה');
});

test('the summary counts what may be done and says when the actions are off', () => {
  const list: DoorConversionList = { ...EMPTY, state: 'items', counts: { ...COUNTS, items: 3, disable: 2, convert_event_job: 1, handled: 1 }, items: [ITEM] };
  expect(conversionSummary(list)).toBe('3 פריטים · 2 ניתנים להשבתה · 1 ניתנים להסבה · 1 טופלו · הפעולות כבויות בהגדרות');
  expect(conversionSummary({ ...list, switch: 'on' })).not.toContain('כבויות');
});

test('each action asks one confirmation that names the item and says it is reversible or a draft', () => {
  expect(conversionQuestion(ITEM, 'disable')).toContain('אפשר לבטל');
  expect(conversionQuestion(ITEM, 'convert_event_job')).toContain('2 שלבי פתיחה');
  expect(conversionQuestion(ITEM, 'convert_event_job')).toContain('כטיוטה');
  const sched: DoorConversionItem = {
    ...ITEM, key: 'schedule:s1', kind: 'schedule', category: 'schedule', name: 'שער בבוקר',
    actions: { ...ITEM.actions, hand_over_program: { available: true, reason: null, reason_text: '', program: { name: 'שער בבוקר', days: [0, 1], days_text: "א' ב'", periods: [{ start: '07:00', end: '09:00' }], doors: ['כניסה · ממסר 1'] } } },
  };
  expect(conversionQuestion(sched, 'hand_over_program')).toBe("להשבית את התזמון \"שער בבוקר\" וליצור חלון פתיחה קבוע (א' ב' 07:00-09:00)? החלון נוצר כטיוטה ולא נשלח למערכת האינטרקום עד שיופעל.");
  for (const text of Object.values(CONVERSION_ACTION_TEXT)) expect(text).not.toMatch(/[a-z_]{4,}/);
});

test('a register row reads in one line', () => {
  expect(recordLine({ id: 'dpc_1', item_key: 'automation:a1', kind: 'automation', name: 'פעמון פותח', action: 'converted', state: 'undone', door_job_id: 'da_1',
    program_rule_id: null, doors: 1, done_by: 'joni', done_at: '2026-11-04T08:00:00Z', undone_by: 'joni', undone_at: '2026-11-04T09:00:00Z' }))
    .toBe('פעמון פותח · הוסב למשימת דלת · joni · בוטל');
});
