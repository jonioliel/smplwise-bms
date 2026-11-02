import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  litPercent, normalizeXs, phoneBoardColumns, phoneGridTemplate, signalsOf, synBoardColumns, totalsOf, unassignedLights, xsFromParams,
  PHONE_COL_PX, XS_DEFAULT, XS_SYN_PHONE_VIEW, type FloorSignal, type XsOptions,
} from '../src/xsection/xs-model';
import { xt } from '../src/i18n/xsection';
import type { DeviceArea, DeviceCounts, DeviceFloor, DeviceTree } from '../src/api/devices';
import type { Floor } from '../src/api/types';

// SYNOPTIC-MOBILE-2342 (owner round 13, answer 1A + note): the phone synoptic map in three layouts behind "תצוגת המפה הסינופטית בטלפון"
// (ui.xs syn_phone_view: table - default / cards / section), the overlap of 2.33.0 fixed at its root (fixed phone columns instead of
// minmax(0, auto) around a lights strip that does not shrink), and the head chip "11/17 דולקות" checked against the rows. Node only.

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const src = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');

const sig = (id: string, extra: Partial<FloorSignal> = {}): FloorSignal => ({
  id, name: id, level: 0, cams: 2, shared: 0, items: 0, plan: true,
  temp: null, target: null, lit: 1, lights: 4, people: null, doorsOpen: 0, alerts: null, nodata: false, ...extra,
});
const opts = (o: Partial<XsOptions> = {}): XsOptions => normalizeXs({ ...XS_DEFAULT, ...o });
/** The owner's building as the mock-up drew it: lights, cameras and open-door sensors; no temperature, no alert source. */
const MATNAS = [sig('g', { lit: 1, lights: 1, cams: 4 }), sig('m1', { level: -1, lit: 2, lights: 10, cams: 1, shared: 2 }), sig('m2', { level: -2, lit: 1, lights: 6, cams: 3 })];

test('the option: table by default, the three layouts, anything else reads as the table; the demo may override it from the route', () => {
  expect(XS_SYN_PHONE_VIEW).toEqual(['table', 'cards', 'section']);
  expect(XS_DEFAULT.syn_phone_view).toBe('table');
  expect(normalizeXs({}).syn_phone_view).toBe('table');
  for (const v of XS_SYN_PHONE_VIEW) expect(normalizeXs({ syn_phone_view: v }).syn_phone_view).toBe(v);
  expect(normalizeXs({ syn_phone_view: 'tiles' }).syn_phone_view).toBe('table');
  expect(normalizeXs({ syn_phone_view: 2 }).syn_phone_view).toBe('table');
  expect(xsFromParams(XS_DEFAULT, new URLSearchParams('xs_syn_phone_view=section')).syn_phone_view).toBe('section');
});

test('phone columns: the columns with a source first (lighting, cameras, open doors for the owner), hide-empty respected', () => {
  const { cols } = synBoardColumns(opts(), false, false, MATNAS);
  expect(cols).toEqual(['light', 'cameras', 'doors']);
  for (const w of [320, 390, 430]) expect(phoneBoardColumns(cols, MATNAS, w)).toEqual({ cols: ['light', 'cameras', 'doors'], dashed: [] });
});

test('phone columns with hide-empty OFF: the empty columns come dashed after the live ones, never under 360 px, five at most', () => {
  const { cols } = synBoardColumns(opts({ syn_hide_empty: false }), false, false, MATNAS);
  expect(cols).toEqual(['light', 'temp', 'cameras', 'doors', 'alerts']);
  // the old rule (phoneColumns) took light / temp / alerts by rank and dropped the cameras and doors that HAVE data
  expect(phoneBoardColumns(cols, MATNAS, 390)).toEqual({ cols: ['light', 'cameras', 'doors', 'temp', 'alerts'], dashed: ['temp', 'alerts'] });
  expect(phoneBoardColumns(cols, MATNAS, 360).dashed).toEqual(['temp', 'alerts']);
  expect(phoneBoardColumns(cols, MATNAS, 359)).toEqual({ cols: ['light', 'cameras', 'doors'], dashed: [] });
  expect(phoneBoardColumns(cols, MATNAS, 320).cols).toEqual(['light', 'cameras', 'doors']);
});

test('phone columns: a temperature source takes a place by rank (lighting, temperature, alerts, doors, presence, cameras); fire stays', () => {
  const warm = MATNAS.map((f) => ({ ...f, temp: 22.5, target: 23 }));
  const { cols } = synBoardColumns(opts(), false, false, warm);
  expect(phoneBoardColumns(cols, warm, 390).cols).toEqual(['light', 'temp', 'doors']);
  const withFire = synBoardColumns(opts({ fire_ui: true, fire_column: 'dashed' }), false, false, warm).cols;
  expect(phoneBoardColumns(withFire, warm, 390).cols).toEqual(['light', 'temp', 'doors', 'fire']);
});

test('the overlap root cause: every phone number column has a fixed width, the name alone shrinks (no minmax(0, auto) on the phone)', () => {
  expect(phoneGridTemplate(['light', 'cameras', 'doors'])).toBe('minmax(0, 1fr) 56px 42px 34px');
  for (const [c, px] of Object.entries(PHONE_COL_PX)) expect(px, c).toBeGreaterThanOrEqual(32);
  // "10/10" at the md tier (14 px, tabular) needs ~38 px: the lights column holds it with room for the bar under it
  expect(PHONE_COL_PX.light).toBeGreaterThanOrEqual(52);
  // 5 columns at 360 px: 16 px gutters, the card and row paddings, 6 px gaps - the name keeps at least ~50 px
  const fixed = (['light', 'cameras', 'doors', 'temp', 'alerts'] as const).reduce((n, c) => n + PHONE_COL_PX[c], 0);
  expect(360 - 2 * 16 - 2 * 12 - 2 * 10 - 5 * 6 - fixed).toBeGreaterThanOrEqual(48);
  const css = src('screens/devices-synoptic.ts');
  expect(css).not.toMatch(/grid-template-columns:[^;]*minmax\(0, auto\)/);
  expect(css).toMatch(/\.sgrid \{ grid-template-columns: minmax\(0, 1fr\) repeat\(var\(--pcols, 3\), 64px\)/);
});

test('the small bar under "2/10": the share of lights on, bounded, 0 without lights', () => {
  expect(litPercent({ lit: 2, lights: 10 })).toBe(20);
  expect(litPercent({ lit: 1, lights: 1 })).toBe(100);
  expect(litPercent({ lit: 0, lights: 6 })).toBe(0);
  expect(litPercent({ lit: null, lights: null })).toBe(0);
  expect(litPercent({ lit: 12, lights: 10 })).toBe(100);
});

/* ---- the head chip against the rows (the owner's "11/17 דולקות" while the rows seemed to read 4/17) ---- */

const ZERO: DeviceCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };
const area = (id: string, floor: string | null, lights: number, on: number, extra: Partial<DeviceArea> = {}): DeviceArea => ({ area_id: id, name: id, icon: null, floor_id: floor, counts: { ...ZERO, lights, lights_on: on }, has_camera: false, temperature: null, open_count: 0, ...extra });
const haFloor = (id: string, level: number | null, areas: DeviceArea[]): DeviceFloor => ({ floor_id: id, name: id, level, icon: null, areas, counts: ZERO, climate: [] });
const cat = (id: string, name: string, level: number, i = 0): Floor => ({ id, name, level, building_id: 'b', sort_order: i, ha_area_id: null, has_plan: true, published_version_id: null, plan_width_px: null, plan_height_px: null, draft_version_id: null, anchor_count: 0, camera_count: 0, updated_at: '' });
const FLOORS = [cat('c0', 'קרקע', 0), cat('c1', 'קומה -1', -1), cat('c2', 'קומה -2', -2)];

function ownerTree(): DeviceTree {
  const lobby = area('lobby', 'ground', 1, 1);
  return {
    floors: [
      haFloor('ground', 0, [lobby]),
      haFloor('p1', -1, [area('store', 'p1', 4, 2), area('machines', 'p1', 6, 4)]),
      haFloor('p2', -2, [area('parking', 'p2', 6, 4), lobby]), // the same area listed twice by the platform: counted once
      haFloor('none', null, [area('garden', null, 3, 2), area('placed', null, 2, 1, { map: { floor_id: 'c0' } as DeviceArea['map'] })]),
    ],
    unassigned: { area_id: 'unassigned', name: 'x', counts: { ...ZERO, lights: 2, lights_on: 2 } },
    building: ZERO, building_climate: [], scoped: false, sync: { connected: true } as DeviceTree['sync'],
  };
}

test('the head chip is the sum of the rows - no double count, nothing from outside the floors', () => {
  const tree = ownerTree();
  const sigs = signalsOf(FLOORS, tree, null);
  const t = totalsOf(sigs, 2);
  const rows = sigs.map((s) => [s.id, s.lit, s.lights]);
  expect(rows).toEqual([['c0', 2, 3], ['c1', 6, 10], ['c2', 4, 6]]); // c0 = the lobby once + the area placed on its map
  expect({ lit: t.lit, lights: t.lights }).toEqual({ lit: sigs.reduce((n, s) => n + (s.lit ?? 0), 0), lights: sigs.reduce((n, s) => n + (s.lights ?? 0), 0) });
  expect({ lit: t.lit, lights: t.lights }).toEqual({ lit: 12, lights: 19 });
});

test('lights on no floor are counted apart ("ללא קומה"): the no-floor bucket areas nothing moves, and devices without an area', () => {
  const tree = ownerTree();
  const sigs = signalsOf(FLOORS, tree, null);
  // garden (3 lights, 2 on) + the devices without an area (2 / 2); "placed" sits on c0's map and is in its row, not here
  expect(unassignedLights(tree, sigs)).toEqual({ lit: 4, lights: 5 });
  // a per-area row that moves the garden onto a floor takes it out of the no-floor count; a row to "none" leaves it there
  expect(unassignedLights(tree, signalsOf(FLOORS, tree, null, { links: { floors: [], areas: [{ area_id: 'garden', floor_id: 'c1' }] } }), { links: { floors: [], areas: [{ area_id: 'garden', floor_id: 'c1' }] } })).toEqual({ lit: 2, lights: 2 });
  expect(unassignedLights(tree, sigs, { links: { floors: [], areas: [{ area_id: 'garden', floor_id: null }] } })).toEqual({ lit: 4, lights: 5 });
  // the chip never includes them: its total is the rows' total whatever lies outside the floors
  expect(totalsOf(sigs, 2).lights).toBe(19);
  // nothing outside the floors: null (the info sheet says nothing)
  const clean = { ...tree, floors: tree.floors.filter((f) => f.floor_id !== 'none'), unassigned: { ...tree.unassigned, counts: ZERO } };
  expect(unassignedLights(clean, signalsOf(FLOORS, clean, null))).toBeNull();
  expect(unassignedLights(null, [])).toBeNull();
});

test('the "all switches" option counts the switches on no floor as well', () => {
  const tree = ownerTree();
  tree.unassigned.counts = { ...ZERO, switch_entities: 3, switch_entities_on: 1 };
  const sigs = signalsOf(FLOORS, tree, null, {}, { switches: 'all' });
  expect(unassignedLights(tree, sigs, {}, { switches: 'all' })).toEqual({ lit: 3, lights: 6 });
  expect(unassignedLights(tree, sigs, {}, { switches: 'typed' })).toEqual({ lit: 2, lights: 3 });
});

test('words: the option, its three layouts and the phone board read in Hebrew (and English), no platform name', () => {
  expect(xt('optSynPhoneView', undefined, 'he')).toBe('תצוגת המפה הסינופטית בטלפון');
  expect([xt('optSynPhoneTable', undefined, 'he'), xt('optSynPhoneCards', undefined, 'he'), xt('optSynPhoneSection', undefined, 'he')]).toEqual(['טבלה קומפקטית', 'כרטיסי קומה', 'חתך בניין']);
  expect(xt('synSite', { name: 'מתנ"ס', n: 3 }, 'he')).toBe('מתנ"ס · 3 קומות');
  expect(xt('synInfoNoFloor', undefined, 'he')).toBe('ללא קומה');
  for (const k of ['optSynPhoneView', 'optSynPhoneTable', 'optSynPhoneCards', 'optSynPhoneSection', 'synSite', 'synInfo', 'synInfoNoFloorVal', 'synOpenFloor', 'synLightsAria'] as const) {
    expect(xt(k, undefined, 'en'), k).not.toBe(xt(k, undefined, 'he'));
    expect(xt(k, undefined, 'he')).not.toMatch(/home assistant/i);
  }
});

test('the settings card lists the option with its three layouts, the table first (the default)', () => {
  const card = src('screens/system-xs-options.ts');
  expect(card).toMatch(/key: 'syn_phone_view', kind: 'enum', label: 'optSynPhoneView', options: \[\['table', 'optSynPhoneTable'\], \['cards', 'optSynPhoneCards'\], \['section', 'optSynPhoneSection'\]\]/);
});

/** Every `:hover` line outside an `@media (hover: hover) and (pointer: fine)` block (the convention of unit-polish-classic-domus-297). */
function ungatedHovers(css: string): number[] {
  const out: number[] = [];
  let gate = 0;
  css.split('\n').forEach((l, i) => {
    if (/@media \(hover: hover\) and \(pointer: fine\)/.test(l)) {
      gate = (l.match(/\{/g)?.length ?? 0) - (l.match(/\}/g)?.length ?? 0);
      return;
    }
    if (gate > 0) {
      gate += (l.match(/\{/g)?.length ?? 0) - (l.match(/\}/g)?.length ?? 0);
      return;
    }
    if (/:hover/.test(l) && !/^\s*(\/\/|\/\*|\*)/.test(l)) out.push(i + 1);
  });
  return out;
}

test('the board and its phone sheet hover only under a pointer that hovers; pressables are not selectable and do not flash', () => {
  expect(ungatedHovers(src('screens/devices-synoptic.ts'))).toEqual([]);
  const phone = src('screens/devices-synoptic-phone-css.ts');
  expect(ungatedHovers(phone)).toEqual([]);
  expect(phone).toMatch(/touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent/);
  expect(phone).toMatch(/overscroll-behavior: contain/);
  expect(phone).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
});
