import { test, expect } from '@playwright/test';
import { filterPeople, placeProblems, zoneOccupancy, PEOPLE_DEFAULTS, type PeopleFloor, type PersonInside, type PresenceBeacon, type PresenceSite, type PresenceWifiSite } from '../src/api/presence';
import { agoLabel, occupancyZones, pickFloor } from '../src/screens/explore-presence-logic';
import { peopleProblems, placesBody, problemsOf } from '../src/screens/system-presence-places-logic';
import { PT_KEYS, PT_TABLES, pt } from '../src/i18n/presence';

// WHOIN034-295 (board r034 / r035): the pure parts of "מי במבנה" and of the place editors.

const person = (over: Partial<PersonInside>): PersonInside => ({
  user_id: 'u', name: 'דנה', source: 'beacon', at: '2026-10-23T10:00:00Z', site_id: 's', site_name: 'המשרד', floor_id: 'f2', floor_name: 'קומה 2', zone_id: null, zone_name: '', ...over,
});
const floor = (id: string, count: number, zones: PeopleFloor['zones'] = []): PeopleFloor => ({ floor_id: id, name: id, level: 0, building: 'א', count, zones });
const SITE: PresenceSite = { id: 'site_main', name: 'המשרד', lat: 32, lon: 34.8, radius_m: 150 };
const UUID = 'f7826da6-4fa2-4e98-8024-bc5b71e0893e';

test('the list filters by floor (all / one / site only) and by a search over name, area, floor and site', () => {
  const list = [person({ user_id: 'a', name: 'דנה', zone_name: 'לובי' }), person({ user_id: 'b', name: 'יוסי', floor_id: 'f3', floor_name: 'קומה 3' }), person({ user_id: 'c', name: 'רות', floor_id: null, floor_name: '', source: 'geofence' })];
  expect(filterPeople(list, '', '').map((p) => p.user_id)).toEqual(['a', 'b', 'c']);
  expect(filterPeople(list, 'f3', '').map((p) => p.user_id)).toEqual(['b']);
  expect(filterPeople(list, '-', '').map((p) => p.user_id)).toEqual(['c']);
  expect(filterPeople(list, '', 'לובי').map((p) => p.user_id)).toEqual(['a']);
  expect(filterPeople(list, '', '  קומה 3 ').map((p) => p.user_id)).toEqual(['b']);
  expect(filterPeople(list, '', 'המשרד')).toHaveLength(3);
});

test('the map opens on the floor asked for, else the busiest, else nothing', () => {
  const floors = [floor('f1', 0), floor('f2', 4), floor('f3', 1)];
  expect(pickFloor(floors, 'f3')).toBe('f3');
  expect(pickFloor(floors, 'gone')).toBe('f2');
  expect(pickFloor(floors, null)).toBe('f2');
  expect(pickFloor([], 'f1')).toBeNull();
});

test('areas on the plan carry their count and the accent only when occupied', () => {
  const f = floor('f2', 3, [{ zone_id: 'z1', name: 'לובי', count: 2 }]);
  expect([...zoneOccupancy(f)]).toEqual([['z1', 2]]);
  const zones = occupancyZones({ zones: [
    { id: 'z1', floor_id: 'f2', plan_version_id: null, name: 'לובי', kind: 'room', polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], color: '#888', source: 'manual', searchable: true, revision: 1, created_at: '', updated_at: '' },
    { id: 'z2', floor_id: 'f2', plan_version_id: null, name: 'מטבח', kind: 'room', polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], color: '#888', source: 'manual', searchable: true, revision: 1, created_at: '', updated_at: '' },
  ] }, f);
  expect(zones.map((z) => [z.name, z.color])).toEqual([['לובי · 2', 'var(--sw-accent)'], ['מטבח', 'var(--sw-border-strong, var(--sw-border))']]);
  expect(occupancyZones(null, f)).toEqual([]);
});

test('freshness reads now / minutes / hours', () => {
  const now = Date.parse('2026-10-23T10:00:00Z');
  expect(agoLabel('2026-10-23T09:59:50Z', now)).toBe(pt('agoNow'));
  expect(agoLabel('2026-10-23T09:55:00Z', now)).toBe(pt('agoMin', { n: 5 }));
  expect(agoLabel('2026-10-23T07:00:00Z', now)).toBe(pt('agoHour', { n: 3 }));
});

test('the editors flag what the server would refuse, per item', () => {
  const beacon: PresenceBeacon = { id: 'b1', name: '', uuid: 'nope', major: null, minor: null, site_id: 'gone', floor_id: null, zone_id: 'z1' };
  const wifi: PresenceWifiSite = { id: 'w1', name: '', site_id: 'site_main', floor_id: null, ssid_hash_salt: '', ssid_hashes: [], add_ssids: ['  '] };
  const all = placeProblems([{ ...SITE, lat: 95, radius_m: 10 }], [beacon], [wifi]);
  expect(problemsOf(all, 'site', 'site_main').sort()).toEqual(['coords', 'radius']);
  expect(problemsOf(all, 'beacon', 'b1').sort()).toEqual(['site', 'uuid', 'zone']);
  expect(problemsOf(all, 'wifi', 'w1')).toEqual(['ssid']);
  expect(placeProblems([SITE], [{ ...beacon, uuid: UUID.toUpperCase(), site_id: 'site_main', zone_id: null }], [{ ...wifi, add_ssids: ['Office'] }])).toEqual([]);
});

test('one save sends the three lists whole; the network names are trimmed and sent only when typed', () => {
  const body = placesBody(
    [{ ...SITE, name: ' המשרד ', radius_m: 150.4 }],
    [{ id: 'b1', name: 'לובי', uuid: ` ${UUID.toUpperCase()} `, major: 1, minor: null, site_id: 'site_main', floor_id: 'f2', zone_id: '' as unknown as null }],
    [{ id: 'w1', name: 'קומה 3', site_id: 'site_main', floor_id: '' as unknown as null, ssid_hash_salt: 'abcdefgh', ssid_hashes: ['h'.repeat(64)], add_ssids: [' Office ', '', 'Guest'] },
     { id: 'w2', name: 'x', site_id: 'site_main', floor_id: null, ssid_hash_salt: 'abcdefgh', ssid_hashes: ['h'.repeat(64)], add_ssids: [] }],
  );
  expect(body.sites).toEqual([{ id: 'site_main', name: 'המשרד', lat: 32, lon: 34.8, radius_m: 150 }]);
  expect(body.beacons[0]).toMatchObject({ uuid: UUID, zone_id: null, floor_id: 'f2', minor: null });
  expect(body.wifi_sites[0]).toMatchObject({ add_ssids: ['Office', 'Guest'], floor_id: null });
  expect('add_ssids' in body.wifi_sites[1]).toBe(false);
});

test('every threshold is range-checked like the server', () => {
  expect(peopleProblems(PEOPLE_DEFAULTS)).toEqual([]);
  expect(peopleProblems({ ...PEOPLE_DEFAULTS, stale_minutes: 2, refresh_seconds: 301, beacon_max_age_minutes: 1.5 }).sort()).toEqual(['beacon_max_age_minutes', 'refresh_seconds', 'stale_minutes']);
});

test('the words: every English key exists in Hebrew and the placeholders match', () => {
  const he = PT_TABLES.he as Record<string, string>;
  for (const [k, v] of Object.entries(PT_TABLES.en)) {
    expect(PT_KEYS, k).toContain(k);
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    expect(ph(v as string), k).toBe(ph(he[k]));
  }
  for (const k of PT_KEYS) expect(/home assistant|\bHA\b|ingress/i.test(he[k]), k).toBe(false);
});
