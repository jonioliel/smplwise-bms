import { test, expect } from '@playwright/test';
import { moveAmong, type WidgetId } from '../src/api/home-config';
import { pl } from '../src/i18n/polish';

// HOMEINFO-295: the names of the two info styles, and a move among the cards the thin-bar style draws (the bar's four widgets are not
// drawn as cards, so a place counts the drawn ones only).
//   npx playwright test -c playwright.unit.config.ts tests/unit-homeinfo-295.spec.ts

test('the info style choice reads "thin row / widgets" in Hebrew and English', () => {
  expect(pl('infoBar', {}, 'he')).toBe('שורה דקה');
  expect(pl('infoCards', {}, 'he')).toBe('ווידג׳טים');
  expect(pl('infoBar', {}, 'en')).toBe('Thin row');
  expect(pl('infoCards', {}, 'en')).toBe('Widgets');
});

test('a move among the drawn cards lands next to its drawn neighbour in the full order', () => {
  const order: WidgetId[] = ['clock', 'weather', 'quick', 'shabbat', 'agenda', 'launcher'];
  const drawn: WidgetId[] = ['quick', 'agenda', 'launcher'];
  expect(moveAmong(order, drawn, 'quick', 1)).toEqual(['clock', 'weather', 'shabbat', 'agenda', 'quick', 'launcher']);
  expect(moveAmong(order, drawn, 'launcher', 0)).toEqual(['clock', 'weather', 'launcher', 'quick', 'shabbat', 'agenda']);
  expect(moveAmong(order, drawn, 'quick', 0)).toEqual(order);
});
