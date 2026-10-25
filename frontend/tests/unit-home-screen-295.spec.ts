import { test, expect } from '@playwright/test';
import {
  areaQuick, CHOICE_DEFAULTS, climateQuick, defaultQuick, demoScreenOverrides, effectiveScreen, floorCardsMax, floorCardsSplit, HOME_SCREEN_DEFAULT, homeAlerts, homeScreenOf,
  homeScreenPatch, isTabletLandscape, personalScreenOf, rowQuickMax, screenFormBody, showRoomTemp, summaryKindsShown, tileQuickMax,
} from '../src/api/home-screen';
import { infoStyleFor, INFO_STYLE_DEFAULT, screenDisplayOf } from '../src/api/screen-display';
import { HS_KEYS, HS_TABLES, hs } from '../src/i18n/home-screen';
import type { DeviceArea, DeviceCounts, DeviceFloor } from '../src/api/devices';

// HOME-295 (owner answers on the home mockup round 2): the display options of the new home screen and their logic.
//   npx playwright test -c playwright.unit.config.ts tests/unit-home-screen-295.spec.ts

const ZERO: DeviceCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };
const counts = (c: Partial<DeviceCounts>): DeviceCounts => ({ ...ZERO, ...c });
const area = (id: string, c: Partial<DeviceCounts>, extra: Partial<DeviceArea> = {}): DeviceArea => ({ area_id: id, name: id, icon: null, floor_id: 'g', has_camera: false, counts: counts(c), ...extra });

test('the defaults are the owner\'s answers', () => {
  expect(HOME_SCREEN_DEFAULT).toEqual({ summary_tiles: null, area_quick: {}, summary_chooser: 'admin', row_actions: 'quick', tile_blinds: 'pct', tile_climate: 'both', phone_area: 'sheet', floor_off: 'menu', many_floors: 'more', building_off_tablet: 'hide' });
  expect(CHOICE_DEFAULTS.floor_off).toBe('menu');
  expect(INFO_STYLE_DEFAULT).toBe('auto');
  expect(screenDisplayOf(null).infoStyle).toBe('auto');
});

test('what the server sent is read tolerantly', () => {
  const o = homeScreenOf({ summary_tiles: ['locks', 'x', 'locks', 'lights'], area_quick: { a: ['covers', 'fans'], '': ['lights'], b: 'x' }, floor_off: 'buttons', many_floors: 'neon' });
  expect(o.summary_tiles).toEqual(['locks', 'lights']);
  expect(o.area_quick).toEqual({ a: ['covers'] });
  expect(o.floor_off).toBe('buttons');
  expect(o.many_floors).toBe('more');
  expect(homeScreenOf('{bad json')).toEqual(HOME_SCREEN_DEFAULT);
  expect(homeScreenOf(JSON.stringify({ tile_climate: 'room' })).tile_climate).toBe('room');
});

test('the info row: auto follows the view', () => {
  expect(infoStyleFor('auto', 'cards')).toBe('cards');
  expect(infoStyleFor('auto', 'tiles')).toBe('bar');
  expect(infoStyleFor('auto', 'plan')).toBe('bar');
  expect(infoStyleFor('bar', 'cards')).toBe('bar');
  expect(infoStyleFor('cards', 'tiles')).toBe('cards');
});

test('the summary tiles: every kind the site has by default, else the chosen ones in their order; a user only while users may choose', () => {
  const c = counts({ lights: 3, locks: 1, sensors: 4, alarm: 'armed_home' });
  expect(summaryKindsShown(HOME_SCREEN_DEFAULT, c)).toEqual(['lights', 'locks', 'sensors', 'alarm']);
  expect(summaryKindsShown({ ...HOME_SCREEN_DEFAULT, summary_tiles: ['alarm', 'lights', 'climate'] }, c)).toEqual(['alarm', 'lights']);
  const mine = personalScreenOf({ summary_tiles: ['locks'], phone_area: 'full' });
  expect(effectiveScreen(HOME_SCREEN_DEFAULT, mine).summary_tiles).toBeNull(); // admin chooses
  expect(effectiveScreen({ ...HOME_SCREEN_DEFAULT, summary_chooser: 'user' }, mine).summary_tiles).toEqual(['locks']);
  expect(effectiveScreen(HOME_SCREEN_DEFAULT, mine).phone_area).toBe('full');
  expect(personalScreenOf({ phone_area: 'half', summary_tiles: 'x' })).toEqual({});
});

test('the quick actions: the area\'s own choice, else what it has (lights > climate > covers > switches, three); the row shows two', () => {
  const a = area('living', { lights: 4, climate: 1, covers: 2, switches: 1 });
  expect(defaultQuick(a.counts)).toEqual(['lights', 'climate', 'covers']);
  expect(areaQuick(HOME_SCREEN_DEFAULT, a, 2)).toEqual(['lights', 'climate']);
  const o = { ...HOME_SCREEN_DEFAULT, area_quick: { living: ['switches', 'covers', 'climate'] as ('switches' | 'covers' | 'climate')[], kitchen: [] } };
  expect(areaQuick(o, a)).toEqual(['switches', 'covers', 'climate']);
  expect(areaQuick(o, area('kitchen', { lights: 2 }))).toEqual([]);
  expect(areaQuick(o, area('x', { switches: 1 }), 4)).toEqual(['switches']);
  // a kind the area lost is never offered
  expect(areaQuick({ ...HOME_SCREEN_DEFAULT, area_quick: { y: ['covers', 'lights'] } }, area('y', { lights: 1 }))).toEqual(['lights']);
  expect(tileQuickMax(390)).toBe(2);
  expect(tileQuickMax(1366)).toBe(4);
  expect(rowQuickMax(820)).toBe(1);
  expect(rowQuickMax(1180)).toBe(2);
});

test('the climate button: off, the target, or "on" (room only); the header temperature by the climate display', () => {
  const unit = (mode: string, target: number | null) => ({ entity_id: 'climate.a', name: 'a', area_name: 'a', hvac_mode: mode, hvac_action: mode === 'heat' ? 'heating' : 'cooling', current_temperature: 25, target_temperature: target, unit: '°C', available: true });
  const on = area('a', { climate: 1, climate_active: 1 }, { climate: [unit('cool', 22)], temperature: 25.5 });
  expect(climateQuick(on, 'both')).toMatchObject({ on: true, heat: false, target: 22, label: 'target' });
  expect(climateQuick(on, 'room').label).toBe('on');
  expect(climateQuick(area('h', { climate: 1, climate_active: 1 }, { climate: [unit('heat', 23)] }), 'both')).toMatchObject({ heat: true, label: 'target' });
  expect(climateQuick(area('o', { climate: 1 }, { climate: [unit('off', null)] }), 'both').label).toBe('off');
  expect(showRoomTemp(on, 'both')).toBe(true);
  expect(showRoomTemp(on, 'target')).toBe(false);
  expect(showRoomTemp(area('k', { lights: 1 }, { temperature: 23 }), 'target')).toBe(true); // no air conditioning: the room temperature stays
  expect(showRoomTemp(area('k', { lights: 1 }, { temperature: null }), 'both')).toBe(false);
});

test('more floors: four in a row on a desktop, three on a landscape tablet; a selected floor alone', () => {
  const fl = (id: string) => ({ floor_id: id });
  const six = ['a', 'b', 'c', 'd', 'e', 'f'].map(fl);
  expect(floorCardsSplit(six, 'all', 4).shown.map((f) => f.floor_id)).toEqual(['a', 'b', 'c', 'd']);
  expect(floorCardsSplit(six, 'all', 4).more.map((f) => f.floor_id)).toEqual(['e', 'f']);
  expect(floorCardsSplit(six, 'e', 4)).toEqual({ shown: [fl('e')], more: [] });
  expect(floorCardsSplit(six, 'gone', 3).shown).toHaveLength(3);
  expect(floorCardsMax(1366)).toBe(4);
  expect(floorCardsMax(1180)).toBe(3);
  expect(isTabletLandscape(1180, 820)).toBe(true);
  expect(isTabletLandscape(1366, 768)).toBe(false);
  expect(isTabletLandscape(820, 1180)).toBe(false);
});

test('the alerts: one per triggered place, the most specific first, at most three', () => {
  const f = (id: string, areas: DeviceArea[], alarm: string | null = null): DeviceFloor => ({ floor_id: id, name: id, level: 0, icon: null, areas, counts: counts({ alarm }), climate: [] });
  const t = { floors: [f('g', [area('a1', { alarm: 'triggered' }), area('a2', {})], 'triggered'), f('f1', [area('b1', {})], 'triggered'), f('f2', [area('c1', { alarm: 'triggered' }), area('c2', { alarm: 'triggered' }), area('c3', { alarm: 'triggered' })])], building: counts({ alarm: 'triggered' }) };
  const list = homeAlerts(t);
  expect(list.map((x) => `${x.scope}:${x.id}`)).toEqual(['area:a1', 'area:c1', 'area:c2']);
  expect(homeAlerts({ floors: [], building: counts({ alarm: 'triggered' }) })).toEqual([{ kind: 'alarm', scope: 'building', id: '*', name: '' }]);
  expect(homeAlerts({ floors: [f('g', [area('a', {})])], building: counts({ alarm: 'armed_away' }) })).toEqual([]);
});

test('the save body carries only what changed; the demo address chooses', () => {
  const base = { screen: HOME_SCREEN_DEFAULT, info: 'auto' as const, view: 'cards' as const };
  expect(screenFormBody(base, base)).toEqual({});
  const next = { screen: { ...HOME_SCREEN_DEFAULT, floor_off: 'buttons' as const, area_quick: { a: ['lights' as const] } }, info: 'bar' as const, view: 'tiles' as const };
  expect(screenFormBody(base, next)).toEqual({ 'home.screen': { floor_off: 'buttons', area_quick: { a: ['lights'] } }, 'home.info_style': 'bar', 'devices.default_view': 'tiles' });
  expect(homeScreenPatch(HOME_SCREEN_DEFAULT, { ...HOME_SCREEN_DEFAULT, summary_tiles: ['lights'] })).toEqual({ summary_tiles: ['lights'] });
  const demo = homeScreenOf(demoScreenOverrides('?hs_floor_off=buttons&hs_tiles=locks,lights&hs_quick=living:covers,lights;kitchen:'));
  expect(demo.floor_off).toBe('buttons');
  expect(demo.summary_tiles).toEqual(['locks', 'lights']);
  expect(demo.area_quick).toEqual({ living: ['covers', 'lights'], kitchen: [] });
});

test('every word has Hebrew and English; holes are filled', () => {
  for (const k of HS_KEYS) {
    expect(HS_TABLES.he[k], k).toBeTruthy();
    expect(HS_TABLES.en[k], k).toBeTruthy();
  }
  expect(hs('moreFloors', { n: 2 }, 'he')).toBe('עוד 2 קומות');
  expect(hs('moreFloors', { n: 2 }, 'ar')).toBe('עוד 2 קומות'); // not translated yet: Hebrew
});
