import { test, expect } from '@playwright/test';
import { AUTOMATIONS_VIEW_DEFAULT, INFO_STYLE_DEFAULT, PAGE_SIZE_DEFAULT, SCHEDULES_VIEW_DEFAULT, clampPage, fittedPageSize, pageCount, pageSizeKey, pageSizeMin, pageSlice, screenDisplayOf } from '../src/api/screen-display';
import { PL_KEYS, PL_TABLES, pl } from '../src/i18n/polish';

// POLISH-295 (owner approval 2026-10-25): the display choices of the polished control screens and the pages of the long lists.
//   npx playwright test -c playwright.unit.config.ts tests/unit-screen-display.spec.ts

test('the defaults are the approved ones: the thin bar, rows, 10 / 7 schedules and 12 / 7 automation rows, 6 / 1 automation cards a page (POLISH2-295)', () => {
  const d = screenDisplayOf(null);
  expect(d.infoStyle).toBe('auto'); // HOME-295 (owner answers round 2): cards in the cards view, the bar in tiles
  expect(INFO_STYLE_DEFAULT).toBe('auto');
  expect(d.schedulesView).toBe('rows');
  expect(SCHEDULES_VIEW_DEFAULT).toBe('rows');
  expect(d.automationsView).toBe('rows'); // POLISH2-295
  expect(AUTOMATIONS_VIEW_DEFAULT).toBe('rows');
  expect(d.pageSize).toEqual({ schedules: { wide: 10, phone: 7 }, automations: { wide: 12, phone: 7 }, automations_cards: { wide: 6, phone: 1 } });
  expect(pageSizeKey('automations_cards', true)).toBe('ui.page_size.automations_cards_phone');
  expect(pageSizeMin('automations_cards')).toBe(1);
  expect(pageSizeMin('automations')).toBe(3);
  expect(PAGE_SIZE_DEFAULT.schedules.wide).toBe(10);
  expect(pageSizeKey('automations', true)).toBe('ui.page_size.automations_phone');
  expect(pageSizeKey('schedules', false)).toBe('ui.page_size.schedules');
});

test('what the server sent is read tolerantly: a foreign or out-of-range value takes the default', () => {
  const d = screenDisplayOf({ 'home.info_style': 'cards', 'ui.schedules_view': 'week', 'ui.automations_view': 'cards', 'ui.page_size.schedules': 25, 'ui.page_size.schedules_phone': '5', 'ui.page_size.automations': 2, 'ui.page_size.automations_phone': 99, 'ui.page_size.automations_cards': 9, 'ui.page_size.automations_cards_phone': 1 });
  expect(d.infoStyle).toBe('cards');
  expect(d.schedulesView).toBe('week');
  expect(d.automationsView).toBe('cards');
  expect(d.pageSize.schedules).toEqual({ wide: 25, phone: 5 });
  expect(d.pageSize.automations).toEqual({ wide: 12, phone: 7 });
  expect(d.pageSize.automations_cards).toEqual({ wide: 9, phone: 1 }); // a single card a page is allowed for the cards only
  const bad = screenDisplayOf({ 'home.info_style': 'chips', 'ui.schedules_view': 'grid', 'ui.automations_view': 'table', 'ui.page_size.schedules': 'ten', 'ui.page_size.schedules_phone': 7.5, 'ui.page_size.automations_cards': 0, 'ui.page_size.automations_cards_phone': 51 });
  expect(bad.infoStyle).toBe('auto');
  expect(bad.schedulesView).toBe('rows');
  expect(bad.automationsView).toBe('rows');
  expect(bad.pageSize.schedules).toEqual({ wide: 10, phone: 7 });
  expect(bad.pageSize.automations_cards).toEqual({ wide: 6, phone: 1 });
});

test('pages: the count, the page clamped into range (a page that vanished falls back to the last), the slice', () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1);
  expect(pageCount(0, 10)).toBe(1);
  expect(pageCount(10, 10)).toBe(1);
  expect(pageCount(23, 10)).toBe(3);
  expect(clampPage(0, 23, 10)).toBe(1);
  expect(clampPage(7, 23, 10)).toBe(3);
  expect(clampPage(Number.NaN, 23, 10)).toBe(1);
  expect(pageSlice(items, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(pageSlice(items, 3, 10)).toEqual([21, 22, 23]);
  expect(pageSlice(items, 9, 10)).toEqual([21, 22, 23]); // after a filter shrank the list
  expect(pageSlice([], 1, 10)).toEqual([]);
});

test('NOSCROLL-295: the page size setting is the maximum; what fits the screen lowers it, never raises it', () => {
  expect(fittedPageSize(10, null)).toBe(10); // not measured yet
  expect(fittedPageSize(10, 6)).toBe(6); // 1366x768: six rows fit
  expect(fittedPageSize(10, 40)).toBe(10); // a tall window: the setting
  expect(fittedPageSize(7, 0)).toBe(1); // never an empty page
});

test('the words: Hebrew, English, Arabic and Russian carry every key; the holes are filled', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) for (const k of PL_KEYS) expect(PL_TABLES[lang][k], `${lang}.${k}`).toBeTruthy();
  expect(pl('pageOf', { n: 2, m: 5 }, 'he')).toBe('עמוד 2 מתוך 5');
  expect(pl('pageOf', { n: 2, m: 5 }, 'en')).toBe('Page 2 of 5');
});
