import { test, expect } from '@playwright/test';
import {
  changeLine, parseSetting, polygonArea, polygonError, sameSetting, toRelative, zoneNameError,
  type ChangeRow, type ConfigField, type Pt,
} from '../src/api/frigate-control';
import { he } from '../src/i18n/he';
import { frigateEn } from '../src/i18n/frigate-en';

// FRGS: the pure logic of the zone editor and the schema-driven settings (CR-029 section 13) - the same rules the server applies
// (routers/frigate_config.py, test_frigate_config.py), so a refused value is caught before the call. Node only, no server.

const SQUARE: Pt[] = [[0.2, 0.2], [0.6, 0.2], [0.6, 0.7], [0.2, 0.7]];

test('zone names: lower-case latin, digits, underscore; not the camera key; not taken', () => {
  expect(zoneNameError('driveway_2', 'cam_front', [])).toBeNull();
  expect(zoneNameError('Driveway', 'cam_front', [])).toBe('pattern');
  expect(zoneNameError('', 'cam_front', [])).toBe('pattern');
  expect(zoneNameError('שער', 'cam_front', [])).toBe('pattern');
  expect(zoneNameError('a'.repeat(41), 'cam_front', [])).toBe('pattern');
  expect(zoneNameError('cam_front', 'cam_front', [])).toBe('camera');
  expect(zoneNameError('porch', 'cam_front', ['porch'])).toBe('taken');
});

test('polygons: 3..40 points inside the frame, no repeat, a real area', () => {
  expect(polygonError(SQUARE)).toBeNull();
  expect(polygonArea(SQUARE)).toBeCloseTo(0.2, 6);
  expect(polygonError(SQUARE.slice(0, 2))).toBe('few');
  expect(polygonError(Array.from({ length: 41 }, (_, i) => [i / 100, (i * i) / 2000] as Pt))).toBe('many');
  expect(polygonError([[0.1, 0.1], [1.2, 0.1], [0.5, 0.5]])).toBe('outside');
  expect(polygonError([[0.1, 0.1], [0.5, 0.1], [0.1, 0.1]])).toBe('repeat');
  expect(polygonError([[0.1, 0.1], [0.2, 0.2], [0.3, 0.3]])).toBe('flat');
});

test('a pointer maps to a relative point, left stays left (the stage is never mirrored), clamped to the frame', () => {
  const rect = { left: 100, top: 50, width: 400, height: 200 };
  expect(toRelative(100, 50, rect)).toEqual([0, 0]);
  expect(toRelative(200, 100, rect)).toEqual([0.25, 0.25]);
  expect(toRelative(600, 300, rect)).toEqual([1, 1]);
  expect(toRelative(0, 0, rect)).toEqual([0, 0]);
  expect(toRelative(233.3333, 50, rect)[0]).toBe(0.3333);
});

const INT: ConfigField = { key: 'motion.threshold', section: 'motion', type: 'int', min: 1, max: 255, default: 30 };
const NUM: ConfigField = { key: 'motion.lightning_threshold', section: 'motion', type: 'number', min: 0.3, max: 1, step: 0.05, default: 0.8 };
const LAB: ConfigField = { key: 'objects.track', section: 'objects', type: 'labels', default: ['person'] };

test('settings values: empty = default (null), integers and ranges as the server checks them', () => {
  expect(parseSetting(INT, '')).toEqual({ value: null });
  expect(parseSetting(INT, ' 45 ')).toEqual({ value: 45 });
  expect(parseSetting(INT, '4.5')).toEqual({ error: 'range' });
  expect(parseSetting(INT, '0')).toEqual({ error: 'range' });
  expect(parseSetting(INT, '256')).toEqual({ error: 'range' });
  expect(parseSetting(INT, 'abc')).toEqual({ error: 'range' });
  expect(parseSetting(NUM, '0.55')).toEqual({ value: 0.55 });
  expect(parseSetting(NUM, '0.2')).toEqual({ error: 'range' });
});

test('an unset value equals its default; labels compare as sets', () => {
  expect(sameSetting(INT, null, 30)).toBe(true);
  expect(sameSetting(INT, 30, null)).toBe(true);
  expect(sameSetting(INT, 45, null)).toBe(false);
  expect(sameSetting(LAB, ['car', 'person'], ['person', 'car'])).toBe(true);
  expect(sameSetting(LAB, null, ['person'])).toBe(true);
  expect(sameSetting(LAB, ['person'], ['person', 'dog'])).toBe(false);
});

const row = (over: Partial<ChangeRow>): ChangeRow => ({ id: 'c', recorder_id: 'nvr-2', camera_id: 'fg-front', camera_key: 'cam_front', class: 'config', kind: 'config_zone', target: 'porch',
  before: null, after: { points: [] }, status: 'applied', error: null, reversible: true, reverts_id: null, actor: null, at: '2026-10-08T08:00:00Z', ...over });

test('change-log lines name the zone or the settings section', () => {
  expect(changeLine(row({}))).toBe('אזור: porch');
  expect(changeLine(row({ after: null }))).toBe('אזור (נמחק): porch');
  expect(changeLine(row({ kind: 'config_settings', target: 'motion' }))).toBe('הגדרות מצלמה: תנועה');
  expect(changeLine(row({ kind: 'config_settings', target: 'unknown' }))).toBe('הגדרות מצלמה: unknown');
});

test('every setting and label of the schema has a Hebrew and an English name', () => {
  const keys = ['detect.fps', 'motion.threshold', 'motion.contour_area', 'motion.lightning_threshold', 'objects.track', 'snapshots.retain.default', 'record.alerts.retain.days', 'record.detections.retain.days', 'review.alerts.labels'];
  for (const k of keys) {
    expect((he.frigate.control.settings.config.fields as Record<string, string>)[k]).toBeTruthy();
    expect((frigateEn.control.settings.config.fields as Record<string, string>)[k]).toBeTruthy();
  }
  expect(Object.keys(he.frigate.control.settings.config.sections)).toEqual(['detect', 'motion', 'objects', 'snapshots', 'record', 'review']);
  expect(Object.keys(frigateEn.control.settings.config.labels)).toEqual(Object.keys(he.frigate.control.settings.config.labels));
});
