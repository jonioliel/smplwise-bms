import { test, expect } from '@playwright/test';
import { COUNT_ALL, countChoiceId, countLadder, effectiveCount, parseCountId, parseStoredCount, storeCount } from '../src/screens/wall-count';

// LV1: the wall's camera-count ladder. Node only - pure functions (src/screens/wall-count.ts).
test('the ladder stops below the total; the total itself is "all"', () => {
  expect(countLadder(0)).toEqual([]);
  expect(countLadder(1)).toEqual([]);
  expect(countLadder(2)).toEqual([1]);
  expect(countLadder(24)).toEqual([1, 2, 4, 6, 8, 9, 12, 16, 20]);
  expect(countLadder(32)).toEqual([1, 2, 4, 6, 8, 9, 12, 16, 20, 25]);
  expect(countLadder(33)).toEqual([1, 2, 4, 6, 8, 9, 12, 16, 20, 25, 32]);
  expect(countLadder(150).at(-1)).toBe(100);
});

test('the chosen option: a step below the total, otherwise "all"', () => {
  expect(countChoiceId(6, 24)).toBe('6');
  expect(countChoiceId(24, 24)).toBe('all');
  expect(countChoiceId(32, 24)).toBe('all');
  expect(countChoiceId(COUNT_ALL, 24)).toBe('all');
  expect(countChoiceId(9, 5)).toBe('all');
  expect(countChoiceId(4, 0)).toBe('all');
});

test('tiles to render: the choice capped by what exists, at least one', () => {
  expect(effectiveCount(6, 24)).toBe(6);
  expect(effectiveCount(32, 24)).toBe(24);
  expect(effectiveCount(COUNT_ALL, 24)).toBe(24);
  expect(effectiveCount(COUNT_ALL, 0)).toBe(1);
  expect(effectiveCount(4, 0)).toBe(1);
});

test('persistence: "all" and the steps round-trip, junk is ignored', () => {
  expect(storeCount(COUNT_ALL)).toBe('all');
  expect(storeCount(12)).toBe('12');
  expect(parseStoredCount('all')).toBe(COUNT_ALL);
  expect(parseStoredCount('12')).toBe(12);
  expect(parseStoredCount('32')).toBe(32); // older saves keep working
  expect(parseStoredCount('7')).toBe(0);
  expect(parseStoredCount(null)).toBe(0);
  expect(parseStoredCount('abc')).toBe(0);
  expect(parseCountId('all')).toBe(COUNT_ALL);
  expect(parseCountId('9')).toBe(9);
});
