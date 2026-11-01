import { test, expect } from '@playwright/test';
import { isDimmable } from '../src/api/devices';
import { areaLights, normalizeXs, signalsOf, XS_DEFAULT } from '../src/xsection/xs-model';
import type { DeviceArea, DeviceCounts, DeviceFloor, DeviceTree } from '../src/api/devices';
import type { Floor } from '../src/api/types';

// SWITCH-LIGHT-DIMMER-2331 (owner 2026-11-01): a relay switch typed as a light kept a dimmer slider on its card; the slider is drawn only
// for a light that really takes a brightness (one gate: isDimmable). The synoptic option "מפסקים בעמודת התאורה" counts every switch.

test('the slider gate: only a light.* the server calls dimmable', () => {
  expect(isDimmable({ domain: 'light', dimmable: true })).toBe(true);
  expect(isDimmable({ domain: 'light', dimmable: false, color_mode: 'brightness' })).toBe(false); // the server's verdict wins
  expect(isDimmable({ domain: 'light', dimmable: false })).toBe(false); // an on/off-only light (a relay shown as a light)
  for (const domain of ['switch', 'input_boolean', 'fan', 'cover']) {
    expect(isDimmable({ domain, dimmable: true, color_mode: 'brightness' })).toBe(false); // never a switch typed as a light
    expect(isDimmable({ domain })).toBe(false);
  }
});

test('a row from an older server or the demo: dimmable unless its colour mode says onoff', () => {
  expect(isDimmable({ domain: 'light' })).toBe(true);
  expect(isDimmable({ domain: 'light', color_mode: 'color_temp' })).toBe(true);
  expect(isDimmable({ domain: 'light', color_mode: 'onoff' })).toBe(false);
});

const ZERO: DeviceCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };
const area = (id: string, counts: Partial<DeviceCounts>): DeviceArea => ({ area_id: id, name: id, icon: null, floor_id: 'g', counts: { ...ZERO, ...counts }, has_camera: false, temperature: null, open_count: 0 });
const tree = (areas: DeviceArea[]): DeviceTree => ({ floors: [{ floor_id: 'g', name: 'G', level: 0, icon: null, areas, counts: ZERO, climate: [] } as DeviceFloor], unassigned: { area_id: 'unassigned', name: 'x', counts: ZERO }, building: ZERO, building_climate: [], scoped: false, sync: { connected: true } as DeviceTree['sync'] });
const floor: Floor = { id: 'c0', name: 'קרקע', level: 0, building_id: 'b', sort_order: 0, ha_area_id: null, has_plan: true, published_version_id: null, plan_width_px: null, plan_height_px: null, draft_version_id: null, anchor_count: 0, camera_count: 0, updated_at: '' };

test('the lights column: typed switches by default (server counts), every switch with "all", never a helper', () => {
  // parking: 2 relays typed as lights (one on) are already in lights/lights_on; 3 other switch.* (2 on); 1 input_boolean in switches only
  const parking = area('parking', { lights: 2, lights_on: 1, switches: 4, switches_on: 3, switch_entities: 3, switch_entities_on: 2 });
  expect(areaLights(parking)).toEqual({ lights: 2, lit: 1 });
  expect(areaLights(parking, { switches: 'typed' })).toEqual({ lights: 2, lit: 1 });
  expect(areaLights(parking, { switches: 'all' })).toEqual({ lights: 5, lit: 3 });
  expect(areaLights(area('old', { lights: 1, lights_on: 1 }), { switches: 'all' })).toEqual({ lights: 1, lit: 1 }); // an older server: no field
  const [typed] = signalsOf([floor], tree([parking]), null);
  expect(typed).toMatchObject({ lights: 2, lit: 1 });
  const [all] = signalsOf([floor], tree([parking]), null, {}, { switches: 'all' });
  expect(all).toMatchObject({ lights: 5, lit: 3 });
  // a floor wired only through plain switches gets a lights column with "all"
  const [only] = signalsOf([floor], tree([area('p2', { switches: 2, switches_on: 1, switch_entities: 2, switch_entities_on: 1 })]), null, {}, { switches: 'all' });
  expect(only).toMatchObject({ lights: 2, lit: 1, nodata: false });
  const [none] = signalsOf([floor], tree([area('p2', { switches: 2, switches_on: 1, switch_entities: 2, switch_entities_on: 1 })]), null);
  expect(none).toMatchObject({ lights: null, lit: null });
});

test('the option: typed by default, all kept, anything else reads as the default', () => {
  expect(XS_DEFAULT.syn_switches).toBe('typed');
  expect(normalizeXs({}).syn_switches).toBe('typed');
  expect(normalizeXs({ syn_switches: 'all' }).syn_switches).toBe('all');
  expect(normalizeXs({ syn_switches: 'some' }).syn_switches).toBe('typed');
});
