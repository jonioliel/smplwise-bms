import { test, expect } from '@playwright/test';
import type { BuildingPresenceSettings, BuildingSnapshot, PresenceCandidate } from '../src/api/building-presence';
import { cardView, chipView, clockText, zoneChip, zoneTone, filterSensors, pageSlice, groupByRoom, settingsProblem, toggledTags } from '../src/api/building-presence-logic';

// BUILDING-PRESENCE-2271: the chip is invisible without tagged sensors, green only while occupied, and never reads an unknown as empty.

const cfg: BuildingPresenceSettings = { enabled: true, hold_seconds: 60, empty_minutes: 10, retention_days: 30, home_display: 'chip', map_tint: true };
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

// PRESENCE-2280: display setting (card / chip / off), the home card, the plan-map chips, the retention range.
const room = (id: string, status: 'occupied' | 'clear' | 'unknown', since: string | null = null) => ({ area_id: id, name: `room ${id}`, status, sensors: 1, empty_since: since });

test('the chip yields to the card and to "off"', () => {
  expect(chipView(snap({ status: 'occupied', occupied_rooms: 2 })).show).toBe(true);
  expect(chipView(snap({ status: 'occupied', settings: { ...cfg, home_display: 'card' } })).show).toBe(false);
  expect(chipView(snap({ status: 'occupied', settings: { ...cfg, home_display: 'off' } })).show).toBe(false);
});

test('the card appears only for display = card, with a state word, a quiet line and the rooms', () => {
  const card = { ...cfg, home_display: 'card' as const };
  expect(cardView(snap({ status: 'occupied' })).show).toBe(false);
  expect(cardView(null).show).toBe(false);
  expect(cardView({ configured: false, settings: card }).show).toBe(false);
  const v = cardView(snap({ settings: card, status: 'occupied', occupied_rooms: 1, rooms: [room('a', 'occupied'), room('b', 'clear', '2026-10-28T09:05:00Z'), room('c', 'unknown')] }), 'UTC');
  expect(v).toMatchObject({ show: true, tone: 'ok', big: 'פעיל', sub: '1 מתוך 3 חדרים עם חיישן פעילים' });
  expect(v.rooms.map((r) => r.text)).toEqual(['פעיל', 'ריק מ־09:05', 'אין מידע']);
  expect(v.rooms.map((r) => r.tone)).toEqual(['ok', 'neutral', 'unknown']);
  expect(cardView(snap({ settings: card, status: 'clear', rooms: [room('a', 'clear')] })).big).toBe('ריק');
  expect(cardView(snap({ settings: card, status: 'unknown', rooms: [room('a', 'unknown')] })).tone).toBe('neutral');
});

test('plan-map chips: occupied, empty since, unknown; none when off, untracked or switched away', () => {
  const s = snap({ rooms: [room('a', 'occupied'), room('b', 'clear', '2026-10-28T09:05:00Z'), room('c', 'unknown')] });
  expect(zoneChip(s, 'a', 'UTC')).toBe('פעיל');
  expect(zoneChip(s, 'b', 'UTC')).toBe('ריק מ־09:05');
  expect(zoneChip(s, 'c', 'UTC')).toBe('אין מידע');
  expect(zoneChip(s, 'zzz')).toBeNull();
  expect(zoneChip(s, null)).toBeNull();
  expect(zoneChip(null, 'a')).toBeNull();
  expect(zoneChip({ configured: false, enabled: false, settings: cfg }, 'a')).toBeNull();
  expect(zoneChip({ ...s, settings: { ...cfg, map_tint: false } }, 'a')).toBeNull();
});

test('retention stays 0..365', () => {
  expect(settingsProblem({ ...cfg, retention_days: 0 })).toBeNull();
  expect(settingsProblem({ ...cfg, retention_days: 365 })).toBeNull();
  expect(settingsProblem({ ...cfg, retention_days: 366 })).toEqual({ field: 'retention_days' });
  expect(settingsProblem({ ...cfg, retention_days: 1.5 })).toEqual({ field: 'retention_days' });
});


test.describe('PRESENCE-2280 mockup alignment (tone, table filter, paging)', () => {
  const snap = (over: Record<string, unknown> = {}) => ({ configured: true, settings: { map_tint: true }, rooms: [
    { area_id: 'a', name: 'א', status: 'occupied', sensors: 1, empty_since: null }, { area_id: 'b', name: 'ב', status: 'clear', sensors: 1, empty_since: '2026-10-29T08:00:00Z' }, { area_id: 'c', name: 'ג', status: 'unknown', sensors: 1, empty_since: null },
  ], ...over }) as never;
  test('zoneTone follows the room status and is null without a room, a snapshot or when the map option is off', () => {
    expect(zoneTone(snap(), 'a')).toBe('occupied');
    expect(zoneTone(snap(), 'b')).toBe('clear');
    expect(zoneTone(snap(), 'c')).toBe('unknown');
    expect(zoneTone(snap(), 'zzz')).toBeNull();
    expect(zoneTone(snap(), null)).toBeNull();
    expect(zoneTone(null, 'a')).toBeNull();
    expect(zoneTone(snap({ settings: { map_tint: false } }), 'a')).toBeNull();
    expect(zoneTone(snap({ configured: false }), 'a')).toBeNull();
  });
  const cand = (id: string, tagged: boolean, area: string | null = null) => ({ entity_id: id, name: id, area_id: area, area_name: area, device_class: 'occupancy', tagged, state: 'on' }) as never;
  test('filterSensors keeps the tagged first and filters by tag; pageSlice clamps and always has one page', () => {
    const l = [cand('z', false, 'א'), cand('y', true, 'ב'), cand('x', true, 'א')];
    expect(filterSensors(l, 'all').map((c) => (c as { entity_id: string }).entity_id)).toEqual(['x', 'y', 'z']);
    expect(filterSensors(l, 'tagged')).toHaveLength(2);
    expect(filterSensors(l, 'untagged')).toHaveLength(1);
    const p = pageSlice([1, 2, 3, 4, 5], 9, 2);
    expect(p).toEqual({ items: [5], page: 3, pages: 3 });
    expect(pageSlice([], 1, 6)).toEqual({ items: [], page: 1, pages: 1 });
    expect(pageSlice([1, 2, 3], -4, 2).page).toBe(1);
  });
});
