import { test, expect } from '@playwright/test';
import {
  actionStations,
  adoptBlock,
  duplicateSummary,
  mergeStationUsers,
  pinWorthChecking,
  resultTone,
  typedMatches,
  visibleRows,
} from '../src/access-control/station-people-logic';
import { STATION_PEOPLE_STRINGS, st, stDynamic } from '../src/i18n/station-people';
import type { StationUser } from '../src/api/station-people';

// WISKEY-PEOPLE-COMPLETE-2390: the pure part of the "people on stations only" view (one row per user number across stations, the
// stations an action goes to, the typed confirmation, how a per-station result reads) and its Hebrew words. Node only; synthetic data.

const user = (employee_no: string, display_name: string, extra: Partial<StationUser> = {}): StationUser => ({
  employee_no, display_name, first_seen_at: '2026-11-01T08:00:00Z', last_seen_at: '2026-11-03T08:00:00Z', ignored: false, ignored_at: null,
  ignored_in_wiskey: false, adoptable: true, import_error: null, pin: false, cards: 0, biometric: null, ...extra,
});
const gate = { id: 'gate', name: 'שער ראשי' };
const lobby = { id: 'lobby', name: 'לובי' };

test('one row per user number across stations, the earliest first-seen, credentials combined', () => {
  const rows = mergeStationUsers([
    { station: gate, people: [user('2001', 'יוסי', { pin: true, cards: 1, first_seen_at: '2026-11-02T00:00:00Z' }), user('2003', '')] },
    { station: lobby, people: [user('2001', 'יוסי כהן', { cards: 2, first_seen_at: '2026-10-30T00:00:00Z' }), user('2002', 'אבי')] },
  ]);
  expect(rows.map((r) => r.employee_no)).toEqual(['2002', '2001', '2003']); // by name (Hebrew order), unnamed last
  const yossi = rows.find((r) => r.employee_no === '2001')!;
  expect(yossi.stations.map((s) => s.station_id)).toEqual(['gate', 'lobby']);
  expect(yossi.names).toEqual(['יוסי', 'יוסי כהן']);
  expect(yossi.first_seen_at).toBe('2026-10-30T00:00:00Z');
  expect([yossi.pin, yossi.cards, yossi.biometric]).toEqual([true, 3, null]);
});

test('credential presence stays null when no station shows it', () => {
  const rows = mergeStationUsers([
    { station: gate, people: [user('5', 'x', { pin: null, cards: null, biometric: null })] },
    { station: lobby, people: [user('5', 'x', { pin: null, cards: null, biometric: null })] },
  ]);
  expect([rows[0].pin, rows[0].cards, rows[0].biometric]).toEqual([null, null, null]);
});

test('a station that could not be read adds nothing (never an empty answer)', () => {
  expect(mergeStationUsers([{ station: gate, people: null }])).toEqual([]);
});

test('ignored rows hide until asked; the search matches a name or a number', () => {
  const rows = mergeStationUsers([{ station: gate, people: [user('1', 'דנה'), user('2', 'רון', { ignored: true }), user('33', '')] }]);
  expect(visibleRows(rows, false).map((r) => r.employee_no)).toEqual(['1', '33']);
  expect(visibleRows(rows, true).map((r) => r.employee_no)).toEqual(['1', '2', '33']);
  expect(visibleRows(rows, true, 'רו').map((r) => r.employee_no)).toEqual(['2']);
  expect(visibleRows(rows, true, '33').map((r) => r.employee_no)).toEqual(['33']);
});

test('a row is ignored only when every station of it is', () => {
  const rows = mergeStationUsers([{ station: gate, people: [user('7', 'a', { ignored: true })] }, { station: lobby, people: [user('7', 'a')] }]);
  expect(rows[0].ignored).toBe(false);
  expect(actionStations(rows[0], 'ignore').map((s) => s.station_id)).toEqual(['lobby']);
  expect(actionStations(rows[0], 'unignore').map((s) => s.station_id)).toEqual(['gate']);
});

test('adopt goes to the stations where the user can be taken over as is; delete to all of them', () => {
  const rows = mergeStationUsers([
    { station: gate, people: [user('9', 'n', { adoptable: false, import_error: 'unsupported_credentials', biometric: true })] },
    { station: lobby, people: [user('9', 'n')] },
  ]);
  expect(actionStations(rows[0], 'adopt').map((s) => s.station_id)).toEqual(['lobby']);
  expect(actionStations(rows[0], 'delete').map((s) => s.station_id)).toEqual(['gate', 'lobby']);
  expect(adoptBlock(rows[0])).toBe('');
  const blocked = mergeStationUsers([{ station: gate, people: [user('9', 'n', { adoptable: false, import_error: 'unsupported_credentials' })] }])[0];
  expect(adoptBlock(blocked)).toBe('unsupported_credentials');
  expect(stDynamic(`imp_${adoptBlock(blocked)}`, 'imp_unknown')).toBe(st('imp_unsupported_credentials'));
  expect(stDynamic('imp_never_heard_of', 'imp_unknown')).toBe(st('imp_unknown'));
});

test('the typed confirmation is the exact user number', () => {
  expect(typedMatches(' 2003 ', '2003')).toBe(true);
  expect(typedMatches('2003', '20030')).toBe(false);
  expect(typedMatches('', '2003')).toBe(false);
  expect(typedMatches('2OO3', '2003')).toBe(false);
});

test('a per-station result reads honestly: all, part, none, or not known', () => {
  const r = (outcome: 'ok' | 'refused' | 'unknown' | 'not_sent') => ({ station_id: 's', outcome, code: null, message: null });
  expect(resultTone([r('ok'), r('ok')])).toBe('ok');
  expect(resultTone([r('ok'), r('refused')])).toBe('partial');
  expect(resultTone([r('refused'), r('not_sent')])).toBe('failed');
  expect(resultTone([r('ok'), r('unknown'), r('not_sent')])).toBe('unknown');
  expect(resultTone([])).toBe('failed');
});

test('duplicate groups count the people they name once', () => {
  const sum = duplicateSummary([
    { code: 'duplicate_display_name', field_id: '', label: '', people: [{ id: 'a', display_name: 'x' }, { id: 'b', display_name: 'x' }], more: 0 },
    { code: 'duplicate_phone', field_id: '', label: '', people: [{ id: 'a', display_name: 'x' }, { id: 'c', display_name: 'y' }], more: 0 },
  ]);
  expect(sum.groups).toHaveLength(2);
  expect(sum.people).toBe(3);
  expect(duplicateSummary(null)).toEqual({ groups: [], people: 0 });
});

test('a PIN check is spent only on a plausible PIN', () => {
  expect(pinWorthChecking('1234')).toBe(true);
  expect(pinWorthChecking('123')).toBe(false);
  expect(pinWorthChecking('12a4')).toBe(false);
  expect(pinWorthChecking(undefined)).toBe(false);
  expect(pinWorthChecking(null)).toBe(false);
});

test('the words: Hebrew, no platform name, no internal code, placeholders filled', () => {
  for (const [key, text] of Object.entries(STATION_PEOPLE_STRINGS)) {
    expect(text, key).toMatch(/[֐-׿]/);
    expect(text, key).not.toMatch(/WisKey|Home Assistant|Ingress|\bHA\b|CR-\d|access\.[a-z]|T9|2390/);
  }
  expect(st('count', { n: 4 })).toBe('4 משתמשים');
  expect(st('delete_type', { n: '2003' })).toContain('2003');
});
