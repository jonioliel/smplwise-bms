import { test, expect } from '@playwright/test';
import {
  CONFIRM, NO_FILTERS, actionIds, applyFilters, chunks, confirmQuestion, countsLine, filtersActive, pendingIds, rangeIds, readOnly, resultLine, statusOf,
  type ProtectedSwitchRow,
} from '../src/screens/protected-switches-logic';

// CR-019 S3: the pure logic of הגדרות › חשמל והתקנים › מתגים מוגנים (filters, status, Shift range, counts, what each action sends).

function row(id: string, over: Partial<ProtectedSwitchRow> = {}): ProtectedSwitchRow {
  return {
    entity_id: `switch.${id}`, name: id, area_id: null, area_name: null, floor_id: null, floor_name: null, state: 'off', available: true,
    protected: false, source: null, category: null, category_label: null, rule: null, reviewed: null, included: true, reason: 'allowed', reason_label: null,
    alarm_managed: false, doors_layer: false, media_managed: false, marked_by: null, marked_at: null, reviewed_by: null, reviewed_at: null, ...over,
  };
}
const auto = (id: string, category = 'water_heating', over: Partial<ProtectedSwitchRow> = {}) =>
  row(id, { protected: true, source: 'auto', category, category_label: 'משאבות ודודים', rule: 'name:משאבה', reviewed: false, included: false, reason: 'protected', ...over });
const manual = (id: string, over: Partial<ProtectedSwitchRow> = {}) => row(id, { protected: true, source: 'manual', reviewed: true, included: false, reason: 'protected', ...over });

const ROWS = [
  auto('pump', 'water_heating', { name: 'משאבת בריכה', floor_id: 'g', floor_name: 'קרקע', area_id: 'yard', area_name: 'חצר' }),
  auto('router', 'network', { name: 'ראוטר', category_label: 'רשת', floor_id: 'g', floor_name: 'קרקע', area_id: 'tech', area_name: 'חדר תקשורת' }),
  manual('fridge', { name: 'מקרר משרד', floor_id: 'u', floor_name: 'קומה 1', area_id: 'kit', area_name: 'מטבחון' }),
  row('hall', { name: 'תאורת מסדרון', floor_id: 'u', floor_name: 'קומה 1', area_id: 'hall', area_name: 'מסדרון' }),
  row('bypass', { name: 'עקיפת חיישן', alarm_managed: true, reason: 'alarm_managed', included: false }),
  row('door', { name: 'פותח שער', doors_layer: true, reason: 'doors_layer', included: false }),
  row('tv', { name: 'מסך לובי', media_managed: true, reason: 'media_managed', included: false }),
];
const ids = (rs: ProtectedSwitchRow[]) => rs.map((r) => r.entity_id.replace('switch.', ''));

test.describe('protected switches: status and read-only rows', () => {
  test('the status of every kind of row', () => {
    expect(ROWS.map((r) => statusOf(r))).toEqual(['pending', 'pending', 'protected', 'unprotected', 'alarm', 'doors', 'media']);
  });
  test('alarm-managed, door-layer and multimedia rows are read-only; the rest are not', () => {
    expect(ROWS.map(readOnly)).toEqual([false, false, false, false, true, true, true]);
  });
  test('a switch the classifier has not judged yet is its own status, still counted as unprotected by the filter', () => {
    const r = row('new', { reason: 'unclassified', included: false });
    expect(statusOf(r)).toBe('unclassified');
    expect(applyFilters([r], { ...NO_FILTERS, status: 'unprotected' })).toHaveLength(1);
  });
  test('an auto row that was reviewed is a plain protected row', () => {
    expect(statusOf(auto('x', 'network', { reviewed: true }))).toBe('protected');
  });
});

test.describe('protected switches: filters and sorting', () => {
  test('status filters', () => {
    expect(ids(applyFilters(ROWS, { ...NO_FILTERS, status: 'pending' })).sort()).toEqual(['pump', 'router']);
    expect(ids(applyFilters(ROWS, { ...NO_FILTERS, status: 'unprotected' })).sort()).toEqual(['bypass', 'door', 'hall', 'tv']);
    expect(ids(applyFilters(ROWS, { ...NO_FILTERS, status: 'protected' })).sort()).toEqual(['fridge', 'pump', 'router']);
  });
  test('category, floor and area narrow the list together; the search reads name, place and id', () => {
    expect(ids(applyFilters(ROWS, { ...NO_FILTERS, category: 'network' }))).toEqual(['router']);
    expect(ids(applyFilters(ROWS, { ...NO_FILTERS, floor: 'u' })).sort()).toEqual(['fridge', 'hall']);
    expect(ids(applyFilters(ROWS, { ...NO_FILTERS, floor: 'u', area: 'kit' }))).toEqual(['fridge']);
    expect(ids(applyFilters(ROWS, { ...NO_FILTERS, q: 'חצר' }))).toEqual(['pump']);
    expect(ids(applyFilters(ROWS, { ...NO_FILTERS, q: 'SWITCH.BYP' }))).toEqual(['bypass']);
    expect(ids(applyFilters(ROWS, { ...NO_FILTERS, q: 'nothing like it' }))).toEqual([]);
  });
  test('sort by place puts rows without a place last', () => {
    const out = ids(applyFilters(ROWS, { ...NO_FILTERS, sort: 'area' }));
    expect(out.slice(0, 4).sort()).toEqual(['fridge', 'hall', 'pump', 'router']);
    expect(out.slice(4).sort()).toEqual(['bypass', 'door', 'tv']);
  });
  test('filtersActive ignores the sort', () => {
    expect(filtersActive(NO_FILTERS)).toBe(false);
    expect(filtersActive({ ...NO_FILTERS, sort: 'area' })).toBe(false);
    expect(filtersActive({ ...NO_FILTERS, q: ' ' })).toBe(false);
    expect(filtersActive({ ...NO_FILTERS, status: 'pending' })).toBe(true);
  });
});

test.describe('protected switches: counts, range select and what an action sends', () => {
  test('the counts line carries the pending part only while something waits', () => {
    expect(countsLine(4, ROWS, { switches: 7, protected: 3, auto_unreviewed: 2, unprotected: 4 })).toBe('4 מתוך 7 מתגים · 3 מוגנים · 2 ממתינים לבדיקה');
    expect(countsLine(1, [row('a')], { switches: 1, protected: 0, auto_unreviewed: 0, unprotected: 1 })).toBe('1 מתוך 1 מתגים · 0 מוגנים');
  });
  test('the Shift range covers the rows between two clicks in the current order and skips read-only rows', () => {
    const list = [row('a'), row('b'), row('c', { alarm_managed: true }), row('d'), row('e')];
    expect(rangeIds(list, 'switch.a', 'switch.e')).toEqual(['switch.a', 'switch.b', 'switch.d', 'switch.e']);
    expect(rangeIds(list, 'switch.e', 'switch.b')).toEqual(['switch.b', 'switch.d', 'switch.e']);
    expect(rangeIds(list, null, 'switch.d')).toEqual(['switch.d']);
    expect(rangeIds(list, 'switch.gone', 'switch.d')).toEqual(['switch.d']);
  });
  test('protect sends only unprotected selectable rows, unprotect only protected ones, approve only rows waiting for review', () => {
    const all = new Set(ROWS.map((r) => r.entity_id));
    expect(ids(ROWS.filter((r) => actionIds('protect', ROWS, all).includes(r.entity_id)))).toEqual(['hall']);
    expect(actionIds('unprotect', ROWS, all).sort()).toEqual(['switch.fridge', 'switch.pump', 'switch.router']);
    expect(actionIds('approve', ROWS, all).sort()).toEqual(['switch.pump', 'switch.router']);
    expect(actionIds('protect', ROWS, new Set())).toEqual([]);
  });
  test('approve-all takes every pending row, whatever the filters', () => {
    expect(pendingIds(ROWS).sort()).toEqual(['switch.pump', 'switch.router']);
  });
  test('ids go to the server in chunks of at most 500', () => {
    const many = Array.from({ length: 1203 }, (_, i) => `switch.s${i}`);
    expect(chunks(many).map((c) => c.length)).toEqual([500, 500, 203]);
    expect(chunks([])).toEqual([]);
  });
});

test.describe('protected switches: wording', () => {
  test('removing protection names the consequence and is the danger variant', () => {
    expect(confirmQuestion('unprotect', 3)).toBe("3 מתגים ייכללו ב'כבה הכל' ובפעולות קבוצתיות. להמשיך?");
    expect(CONFIRM.unprotect.danger).toBe(true);
    expect(CONFIRM.protect.danger).toBe(false);
    expect(CONFIRM.approve.danger).toBe(false);
  });
  test('result sentences', () => {
    expect(resultLine('protect', 2, 0)).toBe('הוגנו 2 מתגים');
    expect(resultLine('unprotect', 1, 1)).toContain('הוסרה ההגנה מ־1 מתגים · 1 לא שונו');
    expect(resultLine('approve', 5, 0)).toBe('אושרו 5 מתגים');
  });
  test('no product names on the screen: the user-facing labels never say Home Assistant', () => {
    const text = JSON.stringify([CONFIRM, resultLine('protect', 1, 1), confirmQuestion('protect', 1)]);
    expect(text).not.toMatch(/Home Assistant|Ingress|\bHA\b/);
  });
});
