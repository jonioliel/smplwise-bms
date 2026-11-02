import { test, expect } from '@playwright/test';
import { controlBuilding, floorScreenBuilding, shownBuildings, siteModel, SITE_LEVEL } from '../src/api/home-site';
import { bulkBody, previewQuery } from '../src/api/device-bulk';
import { actionBody } from '../src/api/ha';
import { BUILDING_REACH_CHOICES, BUILDING_REACH_TEXT } from '../src/api/mapping';
import { itemsQuery, type DeviceCounts, type DeviceTree } from '../src/api/devices';
import { demoSite } from '../src/screens/home-site-demo';

// BUILDING-SCOPE-CONTROL-2351: which building "הצג ושלוט" names to the server, and that with no building (multi-building off, one
// building, or the site level) every request is byte-for-byte today's.
//   npx playwright test -c playwright.unit.config.ts tests/unit-building-scope-control-2351.spec.ts

const ZERO: DeviceCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };
const BASE: DeviceTree = { floors: [], unassigned: { area_id: 'unassigned', name: 'ללא שיוך', counts: ZERO }, building: ZERO, building_climate: [], scoped: false, sync: { connected: true, last_snapshot_at: null, last_event_at: null, last_registry_at: null, last_error: null, reconnects: 0, sequence: 0, entities: 0, started_at: null, ha_version: null } };

test('multi-building off (no site model) and the site level name no building; inside a shown building its id', () => {
  // the home builds no site model while the switch is off (devices-building site() is null): no building, ever
  expect(controlBuilding(null, SITE_LEVEL)).toBe('');
  expect(controlBuilding(null, 'b1')).toBe('');
  const d = demoSite('', BASE);
  const m = siteModel(d.buildings, d.tree, d.links, d.siteName)!;
  const site = { shown: shownBuildings(m, false) };
  // "כל האתר": the whole site, as before (the panel's group control is held there instead)
  expect(controlBuilding(site, SITE_LEVEL)).toBe('');
  for (const b of m.buildings) expect(controlBuilding(site, b.id)).toBe(b.id);
  // the shared building is a building like any other; hidden by "הסתר משותף" it is not a level to act in
  const shared = m.buildings.find((b) => b.shared)!;
  expect(controlBuilding(site, shared.id)).toBe(shared.id);
  expect(controlBuilding({ shown: shownBuildings(m, true) }, shared.id)).toBe('');
  expect(controlBuilding(site, 'gone')).toBe('');
});

test('the floor screens name their building only with the switch on and two or more buildings', () => {
  expect(floorScreenBuilding(false, 4, 'b1')).toBe('');
  expect(floorScreenBuilding(true, 1, 'b1')).toBe('');
  expect(floorScreenBuilding(true, 0, 'b1')).toBe('');
  expect(floorScreenBuilding(true, 2, null)).toBe('');
  expect(floorScreenBuilding(true, 2, 'b1')).toBe('b1');
});

test('without a building the list and bulk requests are exactly today\'s', () => {
  expect(itemsQuery('lights')).toBe('kind=lights&scope=building');
  expect(itemsQuery('lights', 'floor', 'ground', 'all')).toBe('kind=lights&scope=floor&id=ground&switches=all');
  expect(itemsQuery('covers', 'area', 'lobby', 'typed', '')).toBe('kind=covers&scope=area&id=lobby');
  expect(previewQuery('area', 'lobby', 'lights_off')).toBe('scope=area&id=lobby&kind=lights_off');
  expect(previewQuery('building', '*', 'all_off', undefined, ['light.a'], 'typed', '')).toBe('scope=building&id=*&kind=all_off&only=light.a');
  const body = bulkBody('floor', 'ground', 'lights_off', 'abc', undefined, undefined, undefined, undefined);
  expect('building' in body).toBe(false);
  expect(Object.keys(body).sort()).toEqual(['client_request_id', 'confirmed', 'expires_at', 'id', 'kind', 'preview_digest', 'scope']);
  expect('building' in bulkBody('floor', 'ground', 'lights_off', 'abc', undefined, undefined, undefined, '')).toBe(false);
});

test('with a building every request carries it', () => {
  expect(itemsQuery('lights', 'building', '', 'typed', 'b1')).toBe('kind=lights&scope=building&building=b1');
  expect(new URLSearchParams(previewQuery('floor', 'ground', 'lights_off', undefined, undefined, undefined, 'b1')).get('building')).toBe('b1');
  expect(bulkBody('area', 'lobby', 'all_off', 'abc', undefined, ['light.a'], undefined, 'b1')).toMatchObject({ scope: 'area', id: 'lobby', building: 'b1', only: ['light.a'], confirmed: true });
});

test('a single control: the body as before without a building, the building added only when named', () => {
  // the shape the server's closed entity-action schema took before this change, key for key and value for value
  const today = { allowed_action_id: 'light.turn_off', arguments: {}, expected_state_version: null, confirmation_grant: null, client_request_id: 'r1', expires_at: '2099-01-01T00:00:00Z' };
  expect(actionBody('light.turn_off', {}, false, 'r1', '2099-01-01T00:00:00Z')).toEqual(today);
  expect(JSON.stringify(actionBody('light.turn_off', {}, false, 'r1', '2099-01-01T00:00:00Z', ''))).toBe(JSON.stringify(today));
  expect(actionBody('lock.unlock', {}, true, 'r2', '2099-01-01T00:00:00Z', 'b1')).toEqual({ ...today, allowed_action_id: 'lock.unlock', confirmation_grant: 'confirmed', client_request_id: 'r2', building: 'b1' });
});

test('round 14: "הרשאת בניין לפי" offers the server’s two values, the owner’s default first, in the owner’s words', () => {
  expect(BUILDING_REACH_CHOICES).toEqual(['map_and_mapping', 'map']);
  expect(BUILDING_REACH_TEXT).toEqual({ map_and_mapping: 'מפה + מיפוי אזורים', map: 'מיקום במפה' });
});
