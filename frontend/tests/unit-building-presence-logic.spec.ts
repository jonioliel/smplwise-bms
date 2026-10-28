import { test, expect } from '@playwright/test';
import type { BuildingSnapshot, PresenceCandidate } from '../src/api/building-presence';
import { chipView, clockText, groupByRoom, settingsProblem, toggledTags } from '../src/api/building-presence-logic';

// BUILDING-PRESENCE-2271: the chip is invisible without tagged sensors, green only while occupied, and never reads an unknown as empty.

const cfg = { hold_seconds: 60, empty_minutes: 10 };
const snap = (o: Partial<BuildingSnapshot>): BuildingSnapshot => ({ configured: true, settings: cfg, ...o });
const cand = (id: string, area: string | null, tagged = false): PresenceCandidate => ({ entity_id: id, name: id, area_id: area, area_name: area, device_class: 'occupancy', tagged, state: 'off' });

test('nothing configured, nothing shown', () => {
  expect(chipView(null).show).toBe(false);
  expect(chipView(undefined).show).toBe(false);
  expect(chipView({ configured: false, settings: cfg }).show).toBe(false);
});

test('occupied is the only green state and counts rooms, not people', () => {
  expect(chipView(snap({ status: 'occupied', occupied_rooms: 3 }))).toEqual({ show: true, tone: 'ok', text: 'פעיל · 3 חדרים' });
  expect(chipView(snap({ status: 'occupied', occupied_rooms: 1 })).text).toBe('פעיל · חדר אחד');
  expect(chipView(snap({ status: 'occupied', occupied_rooms: 0 })).text).toBe('פעיל');
});

test('empty shows since when and stays neutral', () => {
  const v = chipView(snap({ status: 'clear', empty_since: '2026-10-28T11:20:00Z' }), 'UTC');
  expect(v.tone).toBe('neutral');
  expect(v.text).toBe('ריק מ־11:20');
  expect(chipView(snap({ status: 'clear', empty_since: null })).text).toBe('ריק');
});

test('unknown is never shown as empty', () => {
  expect(chipView(snap({ status: 'unknown' }))).toEqual({ show: true, tone: 'neutral', text: 'אין מידע' });
  expect(chipView(snap({}))).toEqual({ show: true, tone: 'neutral', text: 'אין מידע' });
});

test('clock text survives garbage', () => {
  expect(clockText(null)).toBe('');
  expect(clockText('nope')).toBe('');
  expect(clockText('2026-10-28T09:05:00Z', 'UTC')).toBe('09:05');
});

test('settings stay inside the server ranges', () => {
  expect(settingsProblem({ hold_seconds: 60, empty_minutes: 10 })).toBeNull();
  expect(settingsProblem({ hold_seconds: 0, empty_minutes: 1 })).toBeNull();
  expect(settingsProblem({ hold_seconds: 3600, empty_minutes: 1440 })).toBeNull();
  expect(settingsProblem({ hold_seconds: -1, empty_minutes: 10 })).toEqual({ field: 'hold_seconds' });
  expect(settingsProblem({ hold_seconds: 3601, empty_minutes: 10 })).toEqual({ field: 'hold_seconds' });
  expect(settingsProblem({ hold_seconds: 60, empty_minutes: 0 })).toEqual({ field: 'empty_minutes' });
  expect(settingsProblem({ hold_seconds: 60, empty_minutes: 1.5 })).toEqual({ field: 'empty_minutes' });
  expect(settingsProblem({ hold_seconds: Number.NaN, empty_minutes: 10 })).toEqual({ field: 'hold_seconds' });
});

test('toggling a tag returns the whole sorted set and ignores unknown ids', () => {
  const list = [cand('binary_sensor.b', 'מסדרון', true), cand('binary_sensor.a', 'לובי'), cand('binary_sensor.c', null)];
  expect(toggledTags(list, 'binary_sensor.a', true)).toEqual(['binary_sensor.a', 'binary_sensor.b']);
  expect(toggledTags(list, 'binary_sensor.b', false)).toEqual([]);
  expect(toggledTags(list, 'binary_sensor.zzz', true)).toEqual(['binary_sensor.b']);
});

test('rooms are grouped alphabetically with the unplaced last', () => {
  const g = groupByRoom([cand('binary_sensor.x', null), cand('binary_sensor.b', 'מסדרון'), cand('binary_sensor.a', 'לובי'), cand('binary_sensor.a2', 'לובי')]);
  expect(g.map((x) => x.room)).toEqual(['לובי', 'מסדרון', 'ללא חדר']);
  expect(g[0].items).toHaveLength(2);
});
