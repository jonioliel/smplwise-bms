import { test, expect } from '@playwright/test';
import type { RelayMapStation } from '../src/api/wiskey-relay-map';
import {
  OFF, approvedLine, canApprove, draftOf, mapDiff, parseChoice, relayChoices, rowsBody, stationStatus, typedWordNeeded,
} from '../src/screens/wiskey-relay-map-logic';

// WISKEY-RELAYMAP-2310: the pure helpers of the "מיפוי ממסרים" card (api relay -> physical relay per WisKey station). Node only;
// synthetic names and ids (no lab data).

const st = (over: Partial<RelayMapStation> = {}): RelayMapStation => ({
  id: 'ST-A',
  name: 'כניסה ראשית',
  in_copy: true,
  online: true,
  relays: [{ physical_index: 1, name: 'שער' }, { physical_index: 2, name: null }],
  revision: 0,
  approved_by: null,
  approved_at: null,
  rows: [
    { api_relay: 1, physical_relay: null, active: false, row_revision: null, updated_at: null },
    { api_relay: 2, physical_relay: null, active: false, row_revision: null, updated_at: null },
  ],
  automated_relays: [],
  ...over,
});

const mapped = (a: number | null, b: number | null) =>
  st({
    revision: 3,
    approved_by: 'דנה',
    approved_at: '2026-10-31T08:00:00Z',
    rows: [
      { api_relay: 1, physical_relay: a, active: a !== null, row_revision: 1, updated_at: '2026-10-31T08:00:00Z' },
      { api_relay: 2, physical_relay: b, active: b !== null, row_revision: 1, updated_at: '2026-10-31T08:00:00Z' },
    ],
  });

test('the choices are "disabled" and the station physical relays, by name', () => {
  expect(relayChoices(st())).toEqual([
    { value: OFF, label: 'מושבת' },
    { value: '1', label: 'ממסר פיזי 1 · שער' },
    { value: '2', label: 'ממסר פיזי 2' },
  ]);
  expect(parseChoice(OFF)).toBeNull();
  expect(parseChoice('2')).toBe(2);
  expect(parseChoice('x')).toBeNull();
});

test('the draft starts from the saved rows and the body names every api relay', () => {
  expect(draftOf(st())).toEqual({ 1: null, 2: null });
  expect(draftOf(mapped(2, 1))).toEqual({ 1: 2, 2: 1 });
  expect(rowsBody({ 1: 2, 2: null })).toEqual([{ api_relay: 1, physical_relay: 2 }, { api_relay: 2, physical_relay: null }]);
});

test('the diff names the changed doors, the automated ones and a duplicate physical relay', () => {
  const s = { ...mapped(1, 2), automated_relays: [2] };
  expect(mapDiff(s, { 1: 1, 2: 2 })).toEqual({ changed: false, affected: [], automated: [], duplicate: [] });
  expect(mapDiff(s, { 1: 2, 2: 1 })).toEqual({ changed: true, affected: [1, 2], automated: [2], duplicate: [] });
  expect(mapDiff(s, { 1: 1, 2: null })).toEqual({ changed: true, affected: [2], automated: [2], duplicate: [] });
  expect(mapDiff(s, { 1: 2, 2: 2 }).duplicate).toEqual([2]);
});

test('approve needs edit rights, a change and no duplicate; the typed word only for an automated door', () => {
  const s = { ...mapped(1, null), automated_relays: [2] };
  expect(canApprove(s, { 1: 1, 2: null }, true)).toBe(false); // nothing changed
  expect(canApprove(s, { 1: 1, 2: 2 }, false)).toBe(false); // read-only
  expect(canApprove(s, { 1: 1, 2: 1 }, true)).toBe(false); // duplicate
  expect(canApprove(s, { 1: 1, 2: 2 }, true)).toBe(true);
  expect(canApprove({ ...s, in_copy: false }, { 1: 1, 2: 2 }, true)).toBe(false); // the station is not in the WisKey copy
  expect(typedWordNeeded(s, { 1: 1, 2: 2 })).toBe(true);
  expect(typedWordNeeded(s, { 1: null, 2: null })).toBe(false);
});

test('the station status reads "not approved", "partial" or "approved" with its revision', () => {
  expect(stationStatus(st())).toEqual({ tone: 'unknown', text: 'לא אושר - חירום ואוטומציות דרך WisKey ייחסמו' });
  expect(stationStatus(mapped(1, null))).toEqual({ tone: 'stale', text: 'חלקי · מהדורה 3 · ממסר פיזי 2 לא ממופה' });
  expect(stationStatus(mapped(2, 1))).toEqual({ tone: 'live', text: 'מאושר · מהדורה 3' });
  expect(stationStatus({ ...mapped(2, 1), in_copy: false }).tone).toBe('stale');
});

test('the approval line names who and when', () => {
  expect(approvedLine(st(), (iso) => iso)).toBe('טרם אושר');
  expect(approvedLine(mapped(1, 2), (iso) => `@${iso}`)).toBe('אושר בידי דנה · @2026-10-31T08:00:00Z');
});
