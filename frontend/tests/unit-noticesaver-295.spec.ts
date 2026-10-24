import { test, expect } from '@playwright/test';
import { AMBIENT_SPOTS, DRIFT, logoLayoutOf, saverOf, str } from '../src/notice-tv/tv-logic';

// NOTICESAVER-295: the saver / logo-layout readers and the drift table (pure logic).
//   npx playwright test tests/unit-noticesaver-295.spec.ts --project=desktop

test('saver: unknown or missing reads as off', () => {
  expect(saverOf({})).toBe('off');
  expect(saverOf({ saver: 'wash' })).toBe('wash');
  expect(saverOf({ saver: 'nope' as never })).toBe('off');
});

test('logo layout: unknown or missing reads as a', () => {
  expect(logoLayoutOf({})).toBe('a');
  expect(logoLayoutOf({ logos: 'b' })).toBe('b');
  expect(logoLayoutOf({ logos: 'c' })).toBe('c');
  expect(logoLayoutOf({ logos: 'x' as never })).toBe('a');
});

test('drift stays within 12 px and the ambient spots inside the canvas', () => {
  expect(DRIFT.length).toBe(8);
  for (const [x, y] of DRIFT) expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThanOrEqual(12);
  for (const [x, y] of AMBIENT_SPOTS) expect(x >= 0 && x <= 70 && y >= 0 && y <= 70).toBe(true);
  expect(str('he', 'poweredBy')).toContain('SmplWise Arx');
});
