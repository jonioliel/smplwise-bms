import { test, expect } from '@playwright/test';
import {
  areaIndicators, areaRowOf, AREA_ROW_DEFAULT, climateIndicator, degrees, effectiveRows, floorKinds, floorRowOf, FLOOR_ROW_DEFAULT, moveItem, personalDiff, personalRowOf, splitRow,
  type AreaRow,
} from '../src/api/area-row';
import type { ClimateSummary, DeviceArea, DeviceCounts } from '../src/api/devices';

// Release 0.1.149 (owner 2026-09-30, the big installation's home screen was crowded): what sits next to an area's name - the
// single A/C indicator, the zero-hiding rule, the order, the "+N" collapse, the floor header's list and the personal
// override. The same module the screen uses. Node only.

const ZERO: DeviceCounts = { entities: 10, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };
const ac = (over: Partial<ClimateSummary> = {}): ClimateSummary => ({ entity_id: 'climate.x', name: 'מזגן', area_name: 'סלון', hvac_mode: 'cool', hvac_action: 'cooling', current_temperature: 24.5, target_temperature: 22, unit: '°C', available: true, ...over });
const area = (over: Omit<Partial<DeviceArea>, 'counts'> & { counts?: Partial<DeviceCounts> } = {}): DeviceArea => {
  const { counts, ...rest } = over;
  return { area_id: 'a', name: 'סלון', icon: null, floor_id: 'f', has_camera: false, counts: { ...ZERO, ...counts }, ...rest } as DeviceArea;
};
const row = (over: Partial<AreaRow> = {}): AreaRow => ({ ...AREA_ROW_DEFAULT, ...over });

test('the defaults are a short list: the A/C, what is lit, what is playing; the room temperature and the rest are opt-in', () => {
  expect(AREA_ROW_DEFAULT).toEqual({ items: ['climate', 'lights', 'switches', 'media'], climate: 'temp', show_empty: false });
  expect(FLOOR_ROW_DEFAULT.items).toEqual(['lights', 'switches', 'covers', 'climate', 'media', 'locks', 'sensors']);
  expect(areaRowOf(undefined)).toEqual(AREA_ROW_DEFAULT);
  expect(areaRowOf({})).toEqual({ ...AREA_ROW_DEFAULT });
  expect(floorRowOf('nope')).toEqual(FLOOR_ROW_DEFAULT);
});

test('a stored value is read tolerantly: unknown and repeated ids are dropped, a bad choice falls back', () => {
  expect(areaRowOf({ items: ['media', 'teapot', 'media', 'climate'], climate: 'snow', show_empty: 'yes' })).toEqual({ items: ['media', 'climate'], climate: 'temp', show_empty: false });
  expect(areaRowOf({ items: [], climate: 'mode', show_empty: true })).toEqual({ items: [], climate: 'mode', show_empty: true });
  expect(floorRowOf({ items: ['cameras', 'temperature', 'lights'] }).items).toEqual(['cameras', 'lights']);
});

test('one A/C: an icon by its mode, the temperature next to it when asked; an unknown temperature is hidden, never a dash', () => {
  const a = area({ climate: [ac()], counts: { climate: 1, climate_active: 1 } });
  expect(climateIndicator(a, 'temp')).toMatchObject({ icon: 'snow', text: '24.5°', warm: true, dim: false });
  expect(climateIndicator(a, 'icon')).toMatchObject({ icon: 'snow', text: '' });
  expect(climateIndicator(a, 'mode')).toMatchObject({ icon: 'snow', text: 'קירור' });
  const heat = area({ climate: [ac({ hvac_mode: 'heat', hvac_action: 'heating' })], counts: { climate: 1, climate_active: 1 } });
  expect(climateIndicator(heat, 'mode')).toMatchObject({ icon: 'flame', text: 'חימום' });
  const fan = area({ climate: [ac({ hvac_mode: 'fan_only', hvac_action: 'fan' })], counts: { climate: 1, climate_active: 1 } });
  expect(climateIndicator(fan, 'icon')?.icon).toBe('fan');
  const unknown = area({ climate: [ac({ current_temperature: null })], counts: { climate: 1, climate_active: 1 } });
  expect(climateIndicator(unknown, 'temp')?.text).toBe('');
  expect(JSON.stringify(climateIndicator(unknown, 'temp'))).not.toContain('—');
});

test('an A/C that is off is dimmed; one that is unavailable is dimmed and says so; no A/C means no indicator', () => {
  const off = area({ climate: [ac({ hvac_mode: 'off', hvac_action: 'off' })], counts: { climate: 1 } });
  expect(climateIndicator(off, 'temp')).toMatchObject({ icon: 'snow', dim: true, warm: false, text: '24.5°' });
  expect(climateIndicator(off, 'mode')?.text).toBe('');
  const gone = area({ climate: [ac({ available: false, hvac_mode: null, current_temperature: null })], counts: { climate: 1 } });
  expect(climateIndicator(gone, 'temp')).toMatchObject({ dim: true, text: '' });
  expect(climateIndicator(gone, 'temp')?.title).toContain('לא זמין');
  expect(climateIndicator(area(), 'temp')).toBeNull();
});

test('several A/C in one area are ONE indicator: the dominant mode, the mean of the working ones, and how many work', () => {
  const a = area({ climate: [ac({ current_temperature: 24 }), ac({ current_temperature: 26 }), ac({ hvac_mode: 'off', current_temperature: 30 })], counts: { climate: 3, climate_active: 2 } });
  const i = climateIndicator(a, 'temp')!;
  expect(i).toMatchObject({ icon: 'snow', text: '25° (2)', warm: true });
  expect(i.title).toContain('2 מתוך 3');
  expect(climateIndicator(a, 'icon')?.text).toBe('(2)');
  // mixed modes: the commoner one picks the icon
  const mixed = area({ climate: [ac({ hvac_mode: 'heat', hvac_action: 'heating' }), ac(), ac()], counts: { climate: 3, climate_active: 3 } });
  expect(climateIndicator(mixed, 'icon')?.icon).toBe('snow');
  // a single flat value, never a list of units
  expect(areaIndicators(a, row({ items: ['climate'] }))).toHaveLength(1);
});

test('fans and humidifiers without a climate unit still give an indicator from the counts', () => {
  const a = area({ counts: { climate: 2, climate_active: 1 } });
  expect(climateIndicator(a, 'temp')).toMatchObject({ icon: 'fan', warm: true, dim: false });
});

test('counters: a zero is hidden unless show_empty, a kind the area has none of never shows, the order is the list\'s', () => {
  const a = area({ counts: { lights: 6, lights_on: 3, switches: 4, switches_on: 0, media: 3, media_on: 2, covers: 2, covers_open: 0 } });
  const ids = (r: AreaRow) => areaIndicators(a, r).map((i) => i.id);
  expect(ids(row())).toEqual(['lights', 'media']); // switches: zero; no A/C
  expect(ids(row({ show_empty: true }))).toEqual(['lights', 'switches', 'media']); // locks / openings / covers are not in the default list
  expect(ids(row({ items: ['media', 'lights', 'covers'], show_empty: true }))).toEqual(['media', 'lights', 'covers']);
  expect(ids(row({ items: [] }))).toEqual([]);
  expect(areaIndicators(a, row())[0]).toMatchObject({ icon: 'light', text: '3', warm: true });
  expect(areaIndicators(a, row())[0].title).toBe('תאורה דולקת: 3 מתוך 6');
});

test('room temperature, open doors, locks and the alarm are items of their own, each hidden when there is nothing to say', () => {
  const all = row({ items: ['temperature', 'openings', 'locks', 'alarm'] });
  expect(areaIndicators(area(), all)).toEqual([]); // nothing known: nothing shown, even the temperature is not a dash
  const a = area({ temperature: 23.46, open_count: 2, counts: { locks: 2, locks_locked: 1, alarm: 'armed_away', sensors: 3 } });
  const got = areaIndicators(a, all);
  expect(got.map((i) => [i.id, i.text, i.warm])).toEqual([['temperature', '23.5°', false], ['openings', '2', true], ['locks', '1/2', true], ['alarm', 'דרוכה (חוץ)', true]]);
});

test('locks: only an unlocked one is news unless show_empty; open doors show a zero only with show_empty and only where sensors exist', () => {
  const locked = area({ counts: { locks: 2, locks_locked: 2, sensors: 1 } });
  expect(areaIndicators(locked, row({ items: ['locks', 'openings'] }))).toEqual([]);
  const shown = areaIndicators(locked, row({ items: ['locks', 'openings'], show_empty: true }));
  expect(shown.map((i) => [i.id, i.icon, i.text, i.warm])).toEqual([['locks', 'lock', '2/2', false], ['openings', 'door', '0', false]]);
  expect(areaIndicators(area({ counts: { sensors: 0 } }), row({ items: ['openings'], show_empty: true }))).toEqual([]);
});

test('the row collapses what does not fit into "+N": three on a phone, the rest counted', () => {
  const l = ['a', 'b', 'c', 'd', 'e'];
  expect(splitRow(l, 3)).toEqual({ shown: ['a', 'b', 'c'], hidden: ['d', 'e'] });
  expect(splitRow(l.slice(0, 3), 3)).toEqual({ shown: ['a', 'b', 'c'], hidden: [] });
  expect(splitRow([], 3)).toEqual({ shown: [], hidden: [] });
});

test('the floor header keeps the floor row\'s order, drops kinds the floor has none of, and the sensors follow devices.show_sensors', () => {
  const c = { ...ZERO, lights: 68, switches: 5, climate: 9, media: 7, locks: 1, sensors: 5, cameras: 2 };
  expect(floorKinds(c, FLOOR_ROW_DEFAULT.items, true)).toEqual(['lights', 'switches', 'climate', 'media', 'locks', 'sensors']);
  expect(floorKinds(c, FLOOR_ROW_DEFAULT.items, false)).toEqual(['lights', 'switches', 'climate', 'media', 'locks']);
  expect(floorKinds(c, ['climate', 'lights', 'covers'], true)).toEqual(['climate', 'lights']);
  expect(floorKinds(c, [], true)).toEqual([]);
});

test('the personal override lays over the installation key by key and stores only what differs', () => {
  const base = AREA_ROW_DEFAULT;
  expect(effectiveRows(base, FLOOR_ROW_DEFAULT, null)).toEqual({ area: base, floor: FLOOR_ROW_DEFAULT });
  expect(effectiveRows(base, FLOOR_ROW_DEFAULT, { climate: 'icon', floor_items: ['lights'] })).toEqual({ area: { ...base, climate: 'icon' }, floor: { items: ['lights'] } });
  expect(effectiveRows(base, FLOOR_ROW_DEFAULT, { items: [] }).area.items).toEqual([]); // an explicit empty list is a choice
  expect(personalDiff(base, FLOOR_ROW_DEFAULT, base, FLOOR_ROW_DEFAULT)).toBeNull(); // nothing differs: follow the installation
  expect(personalDiff({ ...base, climate: 'mode', items: ['lights'] }, FLOOR_ROW_DEFAULT, base, FLOOR_ROW_DEFAULT)).toEqual({ items: ['lights'], climate: 'mode' });
  expect(personalRowOf({ items: ['lights', 'x'], climate: 'nope', show_empty: true, floor_items: ['sensors'] })).toEqual({ items: ['lights'], show_empty: true, floor_items: ['sensors'] });
  expect(personalRowOf(null)).toEqual({});
});

test('small helpers: degrees and moving an item', () => {
  expect(degrees(24)).toBe('24°');
  expect(degrees(24.54)).toBe('24.5°');
  expect(moveItem(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
  expect(moveItem(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
  expect(moveItem(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
});
