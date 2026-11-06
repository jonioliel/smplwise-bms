import { test, expect } from '@playwright/test';
import { PREVIEW_GET_MAX, previewBody, previewQuery, previewViaPost } from '../src/api/device-bulk';

// T097 integration-review L8: a bulk preview whose query would be too long for HA Ingress's request line (a narrowed tiles
// panel's `only`, up to 500 ids) goes as POST with the same fields; every shorter preview stays the GET it always was.
//   npx playwright test -c playwright.unit.config.ts tests/unit-t097-lows.spec.ts

test('a short preview stays a GET; a long only list switches to the POST body', () => {
  const short = previewQuery('floor', 'ground', 'lights_off', undefined, ['light.a', 'light.b']);
  expect(previewViaPost(short)).toBe(false);
  const many = Array.from({ length: 500 }, (_, i) => `light.${'x'.repeat(40)}_${i}`);
  const long = previewQuery('building', '*', 'lights_off', undefined, many);
  expect(long.length).toBeGreaterThan(PREVIEW_GET_MAX);
  expect(previewViaPost(long)).toBe(true);
  // well under the ~8 KiB request line, leaving room for the Ingress path prefix
  expect(PREVIEW_GET_MAX).toBeLessThanOrEqual(4096);
});

test('the POST body carries exactly the fields the query would', () => {
  expect(previewBody('area', 'lobby', 'lights_off')).toEqual({ scope: 'area', id: 'lobby', kind: 'lights_off' });
  expect(previewBody('building', '*', 'covers_position', 40, ['cover.a'], 'typed', '')).toEqual({ scope: 'building', id: '*', kind: 'covers_position', position: 40, only: ['cover.a'] });
  expect(previewBody('floor', 'f1', 'lights_on', undefined, [], 'all', 'b1')).toEqual({ scope: 'floor', id: 'f1', kind: 'lights_on', only: [], switches: 'all', building: 'b1' });
});
