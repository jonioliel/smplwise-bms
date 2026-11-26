import { test, expect } from '@playwright/test';
import { alarmsUnknown, areaIndicators, AREA_ROW_DEFAULT, lockUnknown, type AreaRow } from '../src/api/area-row';
import { alarmKnown, alarmRank, alarmWarm, mergeAlarm, type DeviceArea, type DeviceCounts } from '../src/api/devices';
import { sumCounts } from '../src/api/home-site';

// AREA-HONEST-COUNT-2540 (deep review SCR-10 / SCR-09, the FULL interface): the area row never shows a lock whose state is not known
// as "not locked" - it has its own grey "לא ידוע" indicator - and the alarm summary of several panels / buildings is the most urgent
// KNOWN state (the server's rule, services/devices.py ALARM_RANKS). Node only, the modules the screen uses.

const ZERO: DeviceCounts = { entities: 10, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };
const area = (counts: Partial<DeviceCounts>): DeviceArea => ({ area_id: 'a', name: 'כניסה', icon: null, floor_id: 'f', has_camera: false, counts: { ...ZERO, ...counts } }) as DeviceArea;
const row = (over: Partial<AreaRow> = {}): AreaRow => ({ ...AREA_ROW_DEFAULT, items: ['locks', 'alarm'], ...over });
const look = (a: DeviceArea, r = row()) => areaIndicators(a, r).map((i) => [i.id, i.icon, i.text, i.warm, i.dim, i.unknown === true]);

test('an offline lock is not "not locked": the unlocked indicator counts only known open locks', () => {
  // one locked, one offline: nothing is open - no warm unlock indicator, a grey "1 לא ידוע" instead
  expect(look(area({ locks: 2, locks_locked: 1, locks_unknown: 1 }))).toEqual([['locks', 'lock', '1 לא ידוע', false, true, true]]);
  // one open, one offline: both, apart
  expect(look(area({ locks: 2, locks_locked: 0, locks_unknown: 1 }))).toEqual([
    ['locks', 'unlock', '0/2', true, false, false],
    ['locks', 'lock', '1 לא ידוע', false, true, true],
  ]);
  // the only lock is offline: "לא ידוע" alone
  expect(look(area({ locks: 1, locks_locked: 0, locks_unknown: 1 }))).toEqual([['locks', 'lock', 'לא ידוע', false, true, true]]);
  const t = areaIndicators(area({ locks: 3, locks_locked: 1, locks_unknown: 2 }), row())[0];
  expect(t.title).toBe('מנעולים במצב לא ידוע: 2 מתוך 3');
});

test('the unknown lock indicator shows even when locks are "only when active"; the idle locked one keeps its rule', () => {
  expect(row().only_active).toContain('locks');
  // show_empty with locks not "only when active": the idle "1/2" plus the grey unknown
  expect(look(area({ locks: 2, locks_locked: 1, locks_unknown: 1 }), row({ show_empty: true, only_active: [] }))).toEqual([
    ['locks', 'lock', '1/2', false, false, false],
    ['locks', 'lock', '1 לא ידוע', false, true, true],
  ]);
  // every lock unknown: no idle "0/1" beside "לא ידוע"
  expect(look(area({ locks: 1, locks_locked: 0, locks_unknown: 1 }), row({ show_empty: true, only_active: [] }))).toEqual([['locks', 'lock', 'לא ידוע', false, true, true]]);
});

test('an older server (no locks_unknown) keeps today\'s row; a bad count is clamped', () => {
  expect(look(area({ locks: 2, locks_locked: 1 }))).toEqual([['locks', 'unlock', '1/2', true, false, false]]);
  expect(lockUnknown({ ...ZERO, locks: 1, locks_unknown: 5 })).toBe(1);
  expect(lockUnknown({ ...ZERO, locks: 1, locks_unknown: -1 })).toBe(0);
  expect(alarmsUnknown({ ...ZERO })).toBe(0);
});

test('the alarm indicator: an unknown / unavailable summary is grey and never warm; a known one beside unreadable panels says so', () => {
  expect(look(area({ alarm: 'unavailable', alarms_unknown: 1 }))).toEqual([['alarm', 'shield', 'לא זמינה', false, true, true]]);
  expect(look(area({ alarm: 'unknown', alarms_unknown: 1 }))).toEqual([['alarm', 'shield', 'לא ידוע', false, true, true]]);
  expect(look(area({ alarm: 'armed_away' }))).toEqual([['alarm', 'shield', 'דרוכה (חוץ)', true, false, false]]);
  expect(look(area({ alarm: 'disarmed', alarms_unknown: 1 }))).toEqual([['alarm', 'shield', 'מנוטרלת', false, false, false]]);
  expect(areaIndicators(area({ alarm: 'disarmed', alarms_unknown: 1 }), row())[0].title).toBe('אזעקה · לוח אחד במצב לא ידוע');
  expect(areaIndicators(area({ alarm: 'armed_home', alarms_unknown: 2 }), row())[0].title).toBe('אזעקה · 2 לוחות במצב לא ידוע');
  expect(areaIndicators(area({ alarm: 'armed_home' }), row())[0].title).toBe('אזעקה');
});

test('the alarm rule: the most urgent known state wins; unknown / unavailable only when nothing is known', () => {
  const merge = (...s: (string | null)[]) => s.reduce<string | null>((acc, x) => mergeAlarm(acc, x), null);
  expect(merge('unavailable', 'armed_away')).toBe('armed_away');
  expect(merge('armed_away', 'unavailable')).toBe('armed_away');
  expect(merge('disarmed', 'unavailable')).toBe('disarmed');
  expect(merge('unknown', 'triggered')).toBe('triggered');
  expect(merge('armed_home', 'pending')).toBe('pending');
  expect(merge('disarmed', 'arming', 'armed_night')).toBe('armed_night');
  expect(merge('armed_home', 'armed_away')).toBe('armed_home');
  expect(merge('unavailable', 'unknown')).toBe('unknown');
  expect(merge('unavailable', null)).toBe('unavailable');
  expect(merge(null, null)).toBeNull();
  expect([alarmRank(null), alarmRank('armed_custom')]).toEqual([1, 5]);
  expect([alarmKnown('unknown'), alarmKnown('unavailable'), alarmKnown('disarmed'), alarmKnown(null)]).toEqual([false, false, true, false]);
  expect([alarmWarm('unknown'), alarmWarm('disarmed'), alarmWarm('armed_home'), alarmWarm('triggered')]).toEqual([false, false, true, true]);
});

test('several buildings: an unreadable building no longer hides an armed one; the unknown counts add up when present', () => {
  const s = sumCounts([{ ...ZERO, alarm: 'unavailable', alarms_unknown: 1, locks: 1, locks_unknown: 1 }, { ...ZERO, alarm: 'armed_away', locks: 2, locks_locked: 2 }]);
  expect(s.alarm).toBe('armed_away');
  expect([s.locks, s.locks_locked, s.locks_unknown, s.alarms_unknown]).toEqual([3, 2, 1, 1]);
  // an older server: no unknown fields in, none out
  const old = sumCounts([{ ...ZERO, alarm: 'disarmed' }, { ...ZERO, alarm: 'triggered' }]);
  expect(old.alarm).toBe('triggered');
  expect('locks_unknown' in old).toBe(false);
});
