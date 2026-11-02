import { test, expect } from '@playwright/test';
import { configOf, defaultConfig, resolveWidgets, NO_DATA, WIDGET_IDS, WIDGET_NAME, WIDGETS_OFF_BY_DEFAULT } from '../src/api/home-config';
import { levelMark, miniBuilding, miniFloorLabel, miniModel, tintOf, MINI_CAP, MINI_SITE_LEVEL } from '../src/xsection/xs-mini-model';
import { XS_DEFAULT } from '../src/xsection/xs-model';
import type { DeviceArea, DeviceCounts, DeviceFloor, DeviceTree } from '../src/api/devices';
import type { Floor } from '../src/api/types';

// XS-MINI-WIDGET-2351 (owner follow-up): the mini building cross-section in the home widgets row. The model is the cross-section's own
// (signalsOf / xsMetrics / emptyColumns / tempState / floorLightsTarget), so these specs pin what the widget adds: the registration (appended,
// off by default, absent without the devices or a building with floors), the building choice (multi-building), the lights tint, the cap per
// size, the hide-empty rule, the alarm / doors markers and the accessible names.
//   npx playwright test -c playwright.unit.config.ts tests/unit-xs-mini-widget-2351.spec.ts --workers=1

const ZERO: DeviceCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };
const area = (id: string, haFloor: string, counts: Partial<DeviceCounts>, extra: Partial<DeviceArea> = {}): DeviceArea => ({ area_id: id, name: id, icon: null, floor_id: haFloor, counts: { ...ZERO, ...counts }, has_camera: false, temperature: null, open_count: 0, ...extra });
const haFloor = (id: string, level: number, areas: DeviceArea[]): DeviceFloor => ({ floor_id: id, name: `Level ${level}`, level, icon: null, areas, counts: ZERO, climate: [] }) as DeviceFloor;
const tree = (floors: DeviceFloor[]): DeviceTree => ({ floors, unassigned: { area_id: 'unassigned', name: '', counts: ZERO }, building: ZERO, building_climate: [], scoped: false, sync: { connected: true } as DeviceTree['sync'] });
const floor = (id: string, level: number, name = `קומה ${level}`): Floor => ({ id, name, level, building_id: 'b1', sort_order: 0, ha_area_id: null, has_plan: true, published_version_id: null, plan_width_px: null, plan_height_px: null, draft_version_id: null, anchor_count: 0, camera_count: 0, updated_at: '' });
const OPTS = { syn_hide_empty: XS_DEFAULT.syn_hide_empty, temp_threshold: XS_DEFAULT.temp_threshold, syn_switches: XS_DEFAULT.syn_switches, fire_ui: false };

test.describe('registration', () => {
  test('appended last, named, off by default (fresh and older configs), a stored "on" kept', () => {
    expect(WIDGET_IDS[WIDGET_IDS.length - 1]).toBe('xsection');
    expect(WIDGET_NAME.xsection).toBe('חתך בניין');
    expect(WIDGETS_OFF_BY_DEFAULT).toEqual(['xsection']);
    const d = defaultConfig();
    expect(d.order[d.order.length - 1]).toBe('xsection');
    expect(d.xsection).toEqual({ on: false, sizes: { a: 'm', b: 's', c: 'm' }, label: '', phone_on: null, phone_size: null });
    expect(configOf({ order: ['clock'] }).xsection.on).toBe(false); // an older server / stored config without the key
    expect(configOf({ xsection: { on: true, label: 'החתך' } }).xsection).toMatchObject({ on: true, label: 'החתך' });
  });

  test('absent without availability (no ghost); offered: a ghost while off in the editor, drawn when on', () => {
    const d = defaultConfig();
    const ids = (opts: Parameters<typeof resolveWidgets>[3]) => resolveWidgets(d, 'a', NO_DATA, opts).filter((i) => i.id === 'xsection');
    expect(ids({ editing: true })).toEqual([]);
    expect(ids({ editing: true, xsectionAvailable: false })).toEqual([]);
    expect(ids({ xsectionAvailable: true })).toEqual([]); // off by default: nothing on the home screen
    expect(ids({ editing: true, xsectionAvailable: true })).toEqual([{ id: 'xsection', avail: 'off', size: 'm', title: 'חתך בניין' }]);
    const on = { ...d, xsection: { ...d.xsection, on: true, label: 'הבניין' } };
    expect(resolveWidgets(on, 'b', NO_DATA, { xsectionAvailable: true }).filter((i) => i.id === 'xsection')).toEqual([{ id: 'xsection', avail: 'ok', size: 's', title: 'הבניין' }]);
    // the phone's own switch
    const phoneOff = { ...on, xsection: { ...on.xsection, phone_on: false } };
    expect(resolveWidgets(phoneOff, 'a', NO_DATA, { xsectionAvailable: true, phone: true }).some((i) => i.id === 'xsection')).toBe(false);
  });
});

test.describe('the building', () => {
  const b = (id: string, n: number, shared = false) => ({ id, is_shared: shared, floors: Array.from({ length: n }, (_, i) => floor(`${id}f${i}`, i)) });
  test('one-building home: the first non-shared building with floors', () => {
    expect(miniBuilding([b('empty', 0), b('shared', 2, true), b('main', 3)])?.id).toBe('main');
    expect(miniBuilding([b('shared', 2, true)])?.id).toBe('shared');
    expect(miniBuilding([b('empty', 0)])).toBeNull();
    expect(miniBuilding([])).toBeNull();
  });
  test('multi-building: the level\'s building; the site level and a building without floors fall back to the first', () => {
    const all = [b('a', 2), b('b', 4), b('c', 0), b('s', 1, true)];
    expect(miniBuilding(all, 'b')?.id).toBe('b');
    expect(miniBuilding(all, 's')?.id).toBe('s');
    expect(miniBuilding(all, MINI_SITE_LEVEL)?.id).toBe('a');
    expect(miniBuilding(all, 'c')?.id).toBe('a');
    expect(miniBuilding(all, 'gone')?.id).toBe('a');
  });
});

test.describe('the model', () => {
  const floors = [floor('f2', 2), floor('f1', 1), floor('f0', 0, 'קרקע'), floor('fm1', -1, 'חניון')];
  const t = tree([
    haFloor('h2', 2, [area('a2', 'h2', { lights: 4, lights_on: 4 }, { temperature: 29, open_count: 2, climate: [{ entity_id: 'climate.x', available: true, target_temperature: 24 }] as DeviceArea['climate'] })]),
    haFloor('h1', 1, [area('a1', 'h1', { lights: 6, lights_on: 1, alarm: 'triggered' })]),
    haFloor('h0', 0, [area('a0', 'h0', { lights: 3, lights_on: 0 })]),
  ]);
  const building = { id: 'b1', name: 'בניין א', floors };

  test('floors top first, the lights tint, the markers, the ground line, the totals', () => {
    const m = miniModel({ building, tree: t, opts: OPTS, size: 'm' });
    expect(m.buildingName).toBe('בניין א');
    expect(m.floors.map((f) => f.id)).toEqual(['f2', 'f1', 'f0', 'fm1']);
    expect(m.floors.map((f) => f.mark)).toEqual(['2', '1', 'ק', '‎-1']);
    const [f2, f1, f0, fm1] = m.floors;
    expect([f2.tint, f1.tint, f0.tint, fm1.tint]).toEqual([3, 1, 0, 0]);
    expect(f2).toMatchObject({ temp: 'hot', doorsOpen: 2, alarm: false, lightsTarget: true, nodata: false });
    expect(f1).toMatchObject({ alarm: true, lit: 1, lights: 6 });
    expect(fm1).toMatchObject({ nodata: true, lit: null, lightsTarget: false }); // no home-system floor at level -1: no data, no popup
    expect(m.hasBelow).toBe(true);
    expect(m.show).toEqual({ light: true, temp: true, doors: true });
    expect(m.totals).toEqual({ lit: 5, lights: 13, litKnown: true, alarms: 1, doorsOpen: 2 });
    expect(m.more).toBe(0);
  });

  test('hide-empty: a metric with no source on the building is not drawn; the option off keeps it', () => {
    const dark = tree([haFloor('h0', 0, [area('a0', 'h0', { switches: 2 })])]);
    const m = miniModel({ building: { id: 'b', name: 'b', floors: [floor('f0', 0)] }, tree: dark, opts: OPTS, size: 'm' });
    expect(m.show).toEqual({ light: false, temp: false, doors: true }); // the area reports open_count 0: a source that says zero keeps its column
    const kept = miniModel({ building: { id: 'b', name: 'b', floors: [floor('f0', 0)] }, tree: dark, opts: { ...OPTS, syn_hide_empty: false }, size: 'm' });
    expect(kept.show).toEqual({ light: true, temp: true, doors: true });
  });

  test('the cap per size: the top floors and "+N"', () => {
    const many = Array.from({ length: 20 }, (_, i) => floor(`x${i}`, 19 - i));
    for (const size of ['s', 'm', 'l'] as const) {
      const m = miniModel({ building: { id: 'b', name: 'b', floors: many }, tree: null, opts: OPTS, size });
      expect(m.floors.length).toBe(MINI_CAP[size] - 1);
      expect(m.more).toBe(20 - (MINI_CAP[size] - 1));
      expect(m.floors[0].level).toBe(19);
    }
    const fits = miniModel({ building: { id: 'b', name: 'b', floors: many.slice(0, MINI_CAP.s) }, tree: null, opts: OPTS, size: 's' });
    expect(fits.more).toBe(0);
    expect(fits.floors.length).toBe(MINI_CAP.s);
  });

  test('no tree (not read / disconnected): every floor says "no data", nothing is invented', () => {
    const m = miniModel({ building, tree: null, opts: OPTS, size: 'l' });
    expect(m.floors.every((f) => f.nodata && f.tint === 0 && f.lit === null && !f.lightsTarget)).toBe(true);
    expect(m.totals.litKnown).toBe(false);
  });

  test('the fire marker only with the fire UI option on (demo source)', () => {
    const fire = { f1: { state: 'alarm' } };
    expect(miniModel({ building, tree: t, opts: OPTS, size: 'm', fire }).floors.some((f) => f.fire)).toBe(false);
    const on = miniModel({ building, tree: t, opts: { ...OPTS, fire_ui: true }, size: 'm', fire });
    expect(on.floors.find((f) => f.id === 'f1')?.fire).toBe(true);
  });

  test('accessible names say only what is drawn', () => {
    const m = miniModel({ building, tree: t, opts: OPTS, size: 'm' });
    expect(miniFloorLabel(m.floors[0], m.show)).toBe('קומה 2, 4 מתוך 4 אורות דולקים, חם, 2 דלתות פתוחות');
    expect(miniFloorLabel(m.floors[1], m.show)).toBe('קומה 1, 1 מתוך 6 אורות דולקים, אזעקה');
    expect(miniFloorLabel(m.floors[3], m.show)).toBe('חניון, אין מידע מהקומה');
    expect(miniFloorLabel(m.floors[0], { light: false, temp: false, doors: false })).toBe('קומה 2');
  });

  test('tint steps and level marks', () => {
    expect([tintOf({ lit: 0, lights: 5 }), tintOf({ lit: 1, lights: 3 }), tintOf({ lit: 3, lights: 5 }), tintOf({ lit: 3, lights: 3 }), tintOf({ lit: null, lights: null })]).toEqual([0, 1, 2, 3, 0]);
    expect([levelMark(0), levelMark(12), levelMark(-2)]).toEqual(['ק', '12', '‎-2']);
  });
});
