import { test, expect } from '@playwright/test';
import {
  KIND_HE, KIND_ORDER, NO_TYPE_FILTERS, applyTypeFilters, bulkTargets, chunks, confirmQuestion, rangeIds, resultLine, typeFiltersActive, type DeviceTypeRow,
} from '../src/screens/device-types-logic';
import { ACTIVITY_KINDS } from '../src/api/device-activity';

// DEVTYPE (owner 2026-10-09): the pure logic of הגדרות › חשמל והתקנים › סוגי התקנים - filters, what a group change sends, the wording.

const SWITCH_KINDS = ['switch', 'outlet', 'light', 'fan', 'heater', 'water_heater', 'valve'] as const;
function row(id: string, over: Partial<DeviceTypeRow> = {}): DeviceTypeRow {
  return {
    entity_id: `switch.${id}`, name: id, domain: 'switch', device_class: null, area_id: null, area_name: null, floor_id: null, floor_name: null, state: 'off', available: true,
    kind: 'switch', auto: 'switch', set: null, options: [...SWITCH_KINDS], set_by: null, set_at: null, ...over,
  };
}
const ROWS = [
  row('boiler', { name: 'דוד שמש', kind: 'water_heater', auto: 'water_heater', floor_id: 'g', floor_name: 'קרקע', area_id: 'roof', area_name: 'גג' }),
  row('tap', { name: 'ברז גינה', kind: 'valve', auto: 'valve', floor_id: 'g', floor_name: 'קרקע', area_id: 'yard', area_name: 'חצר' }),
  row('heater', { name: 'Relay 3', kind: 'water_heater', auto: 'switch', set: 'water_heater', set_by: 'admin', set_at: '2026-10-09T08:00:00Z', floor_id: 'u', floor_name: 'קומה 1', area_id: 'bath', area_name: 'אמבטיה' }),
  row('sign', { name: 'Sign' }),
  { ...row('helper', { name: 'Pump helper' }), entity_id: 'input_boolean.helper', domain: 'input_boolean', options: SWITCH_KINDS.filter((k) => k !== 'outlet') },
];
const ids = (rs: DeviceTypeRow[]) => rs.map((r) => r.entity_id.split('.')[1]);

test('every type has a Hebrew name and is one of the activity kinds the window knows', () => {
  expect([...KIND_ORDER].sort()).toEqual([...SWITCH_KINDS].sort());
  for (const k of KIND_ORDER) {
    expect(KIND_HE[k]).toBeTruthy();
    expect(ACTIVITY_KINDS).toContain(k);
  }
});

test('filters: type now, source (automatic / fixed), floor, area and the search over name, place and id', () => {
  expect(ids(applyTypeFilters(ROWS, NO_TYPE_FILTERS))).toEqual(['boiler', 'tap', 'heater', 'sign', 'helper']);
  expect(ids(applyTypeFilters(ROWS, { ...NO_TYPE_FILTERS, kind: 'water_heater' }))).toEqual(['boiler', 'heater']);
  expect(ids(applyTypeFilters(ROWS, { ...NO_TYPE_FILTERS, source: 'manual' }))).toEqual(['heater']);
  expect(ids(applyTypeFilters(ROWS, { ...NO_TYPE_FILTERS, source: 'auto' }))).toEqual(['boiler', 'tap', 'sign', 'helper']);
  expect(ids(applyTypeFilters(ROWS, { ...NO_TYPE_FILTERS, floor: 'g' }))).toEqual(['boiler', 'tap']);
  expect(ids(applyTypeFilters(ROWS, { ...NO_TYPE_FILTERS, floor: 'g', area: 'yard' }))).toEqual(['tap']);
  expect(ids(applyTypeFilters(ROWS, { ...NO_TYPE_FILTERS, q: 'חצר' }))).toEqual(['tap']);
  expect(ids(applyTypeFilters(ROWS, { ...NO_TYPE_FILTERS, q: 'INPUT_BOOLEAN' }))).toEqual(['helper']);
  expect(ids(applyTypeFilters(ROWS, { ...NO_TYPE_FILTERS, q: 'דוד' }))).toEqual(['boiler']);
  expect(typeFiltersActive(NO_TYPE_FILTERS)).toBe(false);
  expect(typeFiltersActive({ ...NO_TYPE_FILTERS, q: '  ' })).toBe(false);
  expect(typeFiltersActive({ ...NO_TYPE_FILTERS, source: 'manual' })).toBe(true);
});

test('a group change sends only the rows that would change; a helper cannot be an outlet; automatic reaches the fixed rows', () => {
  const all = new Set(ROWS.map((r) => r.entity_id));
  expect(bulkTargets(ROWS, all, 'outlet')).toEqual({ ids: ['switch.boiler', 'switch.tap', 'switch.heater', 'switch.sign'], skipped: 1 });
  expect(bulkTargets(ROWS, all, 'water_heater').ids).toEqual(['switch.boiler', 'switch.tap', 'switch.sign', 'input_boolean.helper']);
  expect(bulkTargets(ROWS, all, 'auto')).toEqual({ ids: ['switch.heater'], skipped: 0 });
  expect(bulkTargets(ROWS, new Set(), 'valve')).toEqual({ ids: [], skipped: 0 });
});

test('Shift range, chunks of 500 and the wording', () => {
  expect(rangeIds(ROWS, 'switch.tap', 'switch.sign')).toEqual(['switch.tap', 'switch.heater', 'switch.sign']);
  expect(rangeIds(ROWS, null, 'switch.sign')).toEqual(['switch.sign']);
  expect(chunks(Array.from({ length: 1001 }, (_, i) => i)).map((c) => c.length)).toEqual([500, 500, 1]);
  expect(confirmQuestion('valve', 3)).toContain('ברז / השקיה');
  expect(confirmQuestion('auto', 2)).toContain('אוטומטי');
  expect(resultLine('water_heater', 4, 0)).toBe('נקבע הסוג "דוד מים" ל־4 התקנים.');
  expect(resultLine('auto', 2, 1)).toBe('2 התקנים חזרו לסוג אוטומטי. 1 לא שונו.');
});
