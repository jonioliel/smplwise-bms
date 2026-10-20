import { test, expect } from '@playwright/test';
import { HEV_DEV_MARKED, HEV_KEYS, HEV_TABLES, hev } from '../src/i18n/ha-events';
import { SENSOR_TYPES, areaOptions, describeSensorEvent, placeLabel } from '../src/screens/ha-events-logic';

// NVRLESS-295: the pure half of the sensor events list. Fake data only; no browser.
const ev = (type: string, d: Record<string, unknown>) => ({ type: type as 'door', details: d });

test('i18n parity: English, Arabic and Russian carry every Hebrew key with the same placeholders, and no extra key', () => {
  expect(HEV_DEV_MARKED).toEqual(['ar', 'ru']);
  const he = HEV_TABLES.he as Record<string, string>;
  for (const lang of ['en', 'ar', 'ru'] as const) {
    const t = HEV_TABLES[lang] as Record<string, string>;
    expect(Object.keys(t).filter((k) => !HEV_KEYS.includes(k as never)), `${lang} extra`).toEqual([]);
    expect(HEV_KEYS.filter((k) => !(k in t)), `${lang} missing`).toEqual([]);
    for (const k of HEV_KEYS) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(ph(t[k]), `${lang}.${k}`).toBe(ph(he[k]));
      expect(t[k].trim(), `${lang}.${k}`).not.toBe('');
    }
  }
});

test('no operator wording names the home platform', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const)
    for (const k of HEV_KEYS) expect((HEV_TABLES[lang] as Record<string, string>)[k], `${lang}.${k}`).not.toMatch(/home ?assistant|\bHA\b|ingress|הום ?אסיסטנט/i);
});

test('hev: placeholders are filled and the document language picks the column', () => {
  expect(hev('summary', { n: 5, a: 2, s: 3 }, 'en')).toBe('5 events · 2 alerts · 3 sensors');
  expect(hev('summary', { n: 5, a: 2, s: 3 }, 'he')).toBe('5 אירועים · 2 התראות · 3 חיישנים');
  expect(hev('subtitle', { tz: 'Asia/Jerusalem' }, 'ru')).toContain('Asia/Jerusalem');
});

test('a transition is described in the operator words', () => {
  expect(describeSensorEvent(ev('door', { domain: 'binary_sensor', from: 'off', to: 'on' }), 'he')).toBe('נפתח');
  expect(describeSensorEvent(ev('door', { domain: 'binary_sensor', from: 'on', to: 'off' }), 'he')).toBe('נסגר');
  expect(describeSensorEvent(ev('door', { domain: 'lock', from: 'unlocked', to: 'locked' }), 'en')).toBe('Locked');
  expect(describeSensorEvent(ev('door', { domain: 'lock', from: 'locked', to: 'unlocked' }), 'en')).toBe('Unlocked');
  expect(describeSensorEvent(ev('motion', { domain: 'binary_sensor', from: 'off', to: 'on' }), 'en')).toBe('Motion detected');
  expect(describeSensorEvent(ev('motion', { domain: 'binary_sensor', from: 'on', to: 'off' }), 'en')).toBe('Motion ended');
  expect(describeSensorEvent(ev('door', { domain: 'binary_sensor', from: 'on', to: 'unavailable', availability: 'lost' }), 'en')).toBe('The sensor is unavailable');
  expect(describeSensorEvent(ev('door', { domain: 'binary_sensor', from: 'unavailable', to: 'off', availability: 'restored' }), 'en')).toBe('The sensor is back');
  expect(describeSensorEvent(ev('other', { domain: 'alarm_control_panel', from: 'disarmed', to: 'armed_home' }), 'en')).toBe('Alarm state: armed_home');
  expect(describeSensorEvent(ev('door', { domain: 'cover', from: 'weird', to: 'odd' }), 'en')).toBe('State: weird → odd'); // never a guess
});

test('area options: every floor with its rooms, as floor: / zone: values', () => {
  const places = [{ id: 's', name: 'אתר', buildings: [{ id: 'b', name: 'בניין', floors: [
    { id: 'f2', name: 'קומה 2', cameras: 0, sensors: 2, zones: [{ id: 'z1', name: 'לובי', kind: 'room', cameras: 0, sensors: 1 }] },
    { id: 'f3', name: 'קומה 3', cameras: 0, sensors: 0, zones: [] },
  ] }] }];
  expect(areaOptions(null)).toEqual([]);
  expect(areaOptions({ places }).map((o) => o.value)).toEqual(['floor:f2', 'zone:z1', 'floor:f3']);
  expect(areaOptions({ places })[1].label).toBe('בניין · קומה 2 › לובי');
});

test('place label: the room with its floor, the floor alone, nothing when not placed', () => {
  expect(placeLabel({ floor_id: 'f', floor_name: 'קומה 2', zone: 'לובי' })).toBe('לובי · קומה 2');
  expect(placeLabel({ floor_id: 'f', floor_name: 'קומה 2', zone: null })).toBe('קומה 2');
  expect(placeLabel(null)).toBe('');
  expect(placeLabel(undefined)).toBe('');
});

test('the type filter offers only what the sensors produce', () => {
  expect(SENSOR_TYPES.map((t) => t.value)).toEqual(['door', 'motion', 'other']);
});
