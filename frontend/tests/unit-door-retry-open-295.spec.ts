import { expect, test } from '@playwright/test';
import { retryableOpenDoors } from '../src/door-windows/logic';
import type { Incident } from '../src/api/door-windows';

/** WKOPENUNK-295: which doors offer the explicit new OPEN attempt (pure logic; the server decides and checks the typed name). */
const base = {
  id: 'i1', kind: 'open', kind_label: 'open', drill: false, state: 'in_effect_partial', scope_type: 'installation', scope_id: '*', scope_name: 'all',
  requested_at: '2026-10-24T20:00:00Z', released_at: null, reason: '', counts: { total: 3, ok: 1, failed: 1, unknown: 1 }, first_sent_ms: null, last_sent_ms: null,
  superseded_by: null, can_retry_open: true,
  doors: [
    { door: 'st-1:1', label: 'Lobby · Main door', phase: 'apply', state: 'unknown', attempts: 1, code: 'running' },
    { door: 'st-2:1', label: 'Yard · Side door', phase: 'apply', state: 'acknowledged', attempts: 1, code: null },
    { door: 'st-3:2', label: 'Store · Dock 2', phase: 'apply', state: 'refused', attempts: 1, code: 'denied' },
    { door: 'st-1:1', label: 'Lobby · Main door', phase: 'release', state: 'unknown', attempts: 1, code: null },
  ],
} as unknown as Incident;

test('only an apply-phase unknown door of a live OPEN incident, for an administrator', () => {
  const r = retryableOpenDoors(base);
  expect(r).toEqual([{ door: 'st-1:1', stationId: 'st-1', relay: 1, label: 'Lobby · Main door', name: 'Main door' }]);
});

test('never for a drill, a lock, a released incident, or a person who is not an administrator', () => {
  expect(retryableOpenDoors({ ...base, drill: true })).toEqual([]);
  expect(retryableOpenDoors({ ...base, kind: 'lock_secure' } as Incident)).toEqual([]);
  expect(retryableOpenDoors({ ...base, state: 'released' } as Incident)).toEqual([]);
  expect(retryableOpenDoors({ ...base, can_retry_open: false })).toEqual([]);
  expect(retryableOpenDoors({ ...base, can_retry_open: undefined })).toEqual([]);
  expect(retryableOpenDoors(null)).toEqual([]);
});

test('a station id that holds a colon still splits at the last one', () => {
  const inc = { ...base, doors: [{ door: 'a:b:3', label: 'X · Gate', phase: 'apply', state: 'unknown', attempts: 1, code: null }] } as unknown as Incident;
  expect(retryableOpenDoors(inc)).toEqual([{ door: 'a:b:3', stationId: 'a:b', relay: 3, label: 'X · Gate', name: 'Gate' }]);
});
