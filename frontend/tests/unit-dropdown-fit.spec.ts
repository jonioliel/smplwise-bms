import { test, expect } from '@playwright/test';
import { fitFloor, fitNextSize, FIT_MIN_PX } from '../src/components/fit-text';

// DROPDOWNFIT-295: the pure part of the label fit (src/components/fit-text.ts). Node only.
test('the floor is 72 percent of the base, never below 11 px, never above the base', () => {
  expect(fitFloor(16)).toBe(11.5);
  expect(fitFloor(14)).toBe(11);
  expect(fitFloor(18)).toBe(13);
  expect(fitFloor(12)).toBe(11);
  expect(fitFloor(10)).toBe(10); // a base already under the floor stays as it is
  for (const b of [10, 11, 12, 14, 16, 18, 24]) {
    expect(fitFloor(b)).toBeLessThanOrEqual(b);
    expect(fitFloor(b)).toBeGreaterThanOrEqual(Math.min(b, FIT_MIN_PX));
  }
});

test('the size steps down by half a pixel and stops exactly at the floor', () => {
  expect(fitNextSize(16, 11.5)).toBe(15.5);
  expect(fitNextSize(12, 11.5)).toBe(11.5);
  expect(fitNextSize(11.5, 11.5)).toBeNull();
  let px: number | null = 16;
  let steps = 0;
  while (px !== null) {
    const n = fitNextSize(px, 11.5);
    if (n === null) break;
    px = n;
    steps++;
  }
  expect(px).toBe(11.5);
  expect(steps).toBe(9);
});
