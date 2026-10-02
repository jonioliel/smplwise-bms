import { test, expect } from '@playwright/test';
import {
  CONFIRM, NO_FILTERS, actionIds, apiAction, applyFilters, chunks, confirmQuestion, countsLine, filtersActive, rangeIds, readOnly, resultLine, statusOf, suggestedIds,
  type ProtectedSwitchRow,
} from '../src/screens/protected-switches-logic';

// CR-019 S3: the pure logic of הגדרות › חשמל והתקנים › מתגים מוגנים (filters, status, Shift range, counts, what each action sends).
// Owner decision 2026-10-02: only an administrator's protection excludes a switch; the classifier's hit is a SUGGESTION.

function row(id: string, over: Partial<ProtectedSwitchRow> = {}): ProtectedSwitchRow {
  return {
    entity_id: `switch.${id}`, name: id, area_id: null, area_name: null, floor_id: null, floor_name: null, state: 'off', available: true,
    protected: false, suggested: false, source: null, category: null, category_label: null, rule: null, reviewed: null, included: true, reason: 'allowed', reason_label: null,
    alarm_managed: false, doors_layer: false, media_managed: false, marked_by: null, marked_at: null, reviewed_by: null, reviewed_at: null, ...over,
  };
}
/** A classifier suggestion: shown, NOT protected, still included. */
const suggestion = (id: string, category = 'water_heating', over: Partial<ProtectedSwitchRow> = {}) =>
  row(id, { suggested: true, source: 'auto', category, category_label: 'משאבות ודודים', rule: 'name:משאבה', reviewed: false, ...over });
const manual = (id: string, over: Partial<ProtectedSwitchRow> = {}) => row(id, { protected: true, source: 'manual', reviewed: true, included: false, reason: 'protected', ...over });

const ROWS = [
  suggestion('pump', 'water_heating', { name: 'משאבת בריכה', floor_id: 'g', floor_name: 'קרקע', area_id: 'yard', area_name: 'חצר' }),
  suggestion('router', 'network', { name: 'ראוטר', category_label: 'רשת', floor_id: 'g', floor_name: 'קרקע', area_id: 'tech', area_name: 'חדר תקשורת' }),
  manual('fridge', { name: 'מקרר משרד', floor_id: 'u', floor_name: 'קומה 1', area_id: 'kit', area_name: 'מטבחון' }),
  row('hall', { name: 'תאורת מסדרון', floor_id: 'u', floor_name: 'קומה 1', area_id: 'hall', area_name: 'מסדרון' }),
  row('bypass', { name: 'עקיפת חיישן', alarm_managed: true, reason: 'alarm_managed', included: false }),
  row('door', { name: 'פותח שער', doors_layer: true, reason: 'doors_layer', included: false }),
  row('tv', { name: 'מסך לובי', media_managed: true, reason: 'media_managed', included: false }),
];
const ids = (rs: ProtectedSwitchRow[]) => rs.map((r) => r.entity_id.replace('switch.', ''));

test.describe('protected switches: status and read-only rows', () => {
  test('the status of every kind of row', () => {
    expect(ROWS.map((r) => statusOf(r))).toEqual(['suggested', 'suggested', 'protected', 'unprotected', 'alarm', 'doors', 'media']);
  });
  test('alarm-managed, door-layer and multimedia rows are read-only; the rest are not', () => {
    expect(ROWS.map(readOnly)).toEqual([false, false, false, false, true, true, true]);
  });
  test('an approved suggestion is a plain protected row; a switch nobody judged is just unprotected', () => {
    expect(statusOf(suggestion('x', 'network', { suggested: false, protected: true, reviewed: true }))).toBe('protected');
    expect(statusOf(row('new'))).toBe('unprotected');
  });
});

test.describe('protected switches: filters and sorting', () => {
  test('status filters; "לא מוגנים" includes a suggestion (it is not protected)', () => {
    expect(ids(applyFilters(ROWS, { ...NO_FILTERS, status: 'protected' }))).toEqual(['fridge']);
    expect(ids(applyFilters(ROWS, { ...NO_FILTERS, status: 'suggested' })).sort()).toEqual(['pump', 'router']);
    expect(ids(applyFilters(ROWS, { ...NO_FILTERS, status: 'unprotected' })).sort()).toEqual(['bypass', 'door', 'hall', 'pump', 'router', 'tv']);
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
    expect(filtersActive({ ...NO_FILTERS, status: 'suggested' })).toBe(true);
  });
});

test.describe('protected switches: counts, range select and what an action sends', () => {
  test('the counts line carries the suggestions part only while something is suggested', () => {
    expect(countsLine(4, ROWS, { switches: 7, protected: 1, suggested: 2, unprotected: 6 })).toBe('4 מתוך 7 מתגים · 1 מוגנים · 2 מוצעים להגנה');
    expect(countsLine(1, [row('a')], { switches: 1, protected: 0, suggested: 0, unprotected: 1 })).toBe('1 מתוך 1 מתגים · 0 מוגנים');
  });
  test('the Shift range covers the rows between two clicks in the current order and skips read-only rows', () => {
    const list = [row('a'), row('b'), row('c', { alarm_managed: true }), row('d'), row('e')];
    expect(rangeIds(list, 'switch.a', 'switch.e')).toEqual(['switch.a', 'switch.b', 'switch.d', 'switch.e']);
    expect(rangeIds(list, 'switch.e', 'switch.b')).toEqual(['switch.b', 'switch.d', 'switch.e']);
    expect(rangeIds(list, null, 'switch.d')).toEqual(['switch.d']);
    expect(rangeIds(list, 'switch.gone', 'switch.d')).toEqual(['switch.d']);
  });
  test('protect sends every selectable row that is not protected (a suggestion included), unprotect only protected rows, dismiss only suggestions', () => {
    const all = new Set(ROWS.map((r) => r.entity_id));
    expect(actionIds('protect', ROWS, all).sort()).toEqual(['switch.hall', 'switch.pump', 'switch.router']);
    expect(actionIds('unprotect', ROWS, all)).toEqual(['switch.fridge']);
    expect(actionIds('dismiss', ROWS, all).sort()).toEqual(['switch.pump', 'switch.router']);
    expect(actionIds('protect', ROWS, new Set())).toEqual([]);
  });
  test('the strip protects every suggestion that a group action could reach', () => {
    expect(suggestedIds([...ROWS, suggestion('doorlayer', 'access', { doors_layer: true })]).sort()).toEqual(['switch.pump', 'switch.router']);
  });
  test('"דחה הצעה" is the server action unprotect; the strip\'s approve stays approve', () => {
    expect([apiAction('dismiss'), apiAction('approve'), apiAction('protect'), apiAction('unprotect')]).toEqual(['unprotect', 'approve', 'protect', 'unprotect']);
  });
  test('ids go to the server in chunks of at most 500', () => {
    const many = Array.from({ length: 1203 }, (_, i) => `switch.s${i}`);
    expect(chunks(many).map((c) => c.length)).toEqual([500, 500, 203]);
    expect(chunks([])).toEqual([]);
  });
});

test.describe('protected switches: wording', () => {
  test('removing protection names the consequence and is the danger variant; dismissing says the switch stays included', () => {
    expect(confirmQuestion('unprotect', 3)).toBe("3 מתגים ייכללו ב'כבה הכל' ובפעולות קבוצתיות. להמשיך?");
    expect(confirmQuestion('dismiss', 2)).toContain('ימשיכו להיכלל');
    expect(confirmQuestion('protect', 2)).toBe("להגן על 2 מתגים? הם לא ייכללו ב'כבה הכל' ובפעולות קבוצתיות.");
    expect(CONFIRM.unprotect.danger).toBe(true);
    expect([CONFIRM.protect.danger, CONFIRM.approve.danger, CONFIRM.dismiss.danger]).toEqual([false, false, false]);
  });
  test('result sentences', () => {
    expect(resultLine('protect', 2, 0)).toBe('הוגנו 2 מתגים');
    expect(resultLine('approve', 5, 0)).toBe('הוגנו 5 מתגים');
    expect(resultLine('unprotect', 1, 1)).toContain('הוסרה ההגנה מ־1 מתגים · 1 לא שונו');
    expect(resultLine('dismiss', 3, 0)).toBe('נדחתה ההצעה ל־3 מתגים');
  });
  test('no product names on the screen: the user-facing labels never say Home Assistant', () => {
    const text = JSON.stringify([CONFIRM, resultLine('protect', 1, 1), confirmQuestion('protect', 1)]);
    expect(text).not.toMatch(/Home Assistant|Ingress|\bHA\b/);
  });
});
