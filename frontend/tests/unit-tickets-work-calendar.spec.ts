import { test, expect } from '@playwright/test';
import {
  calendarOf, calendarPatch, calendarProblem, DEFAULT_CALENDAR, holidaysText, isIsoDate, parseHolidays, sameCalendar, toggleDay, WEEK_ORDER,
} from '../src/tickets/work-calendar-model';
import { WORK_CALENDAR_TEXT_EN_KEYS, WORK_CALENDAR_TEXT_KEYS, workCalendarTemplate } from '../src/tickets/work-calendar-text';

// SLACAL (2.9.1): the working-hours calendar card's pure logic. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-work-calendar.spec.ts

test('the default is OFF (around the clock), Sunday to Thursday 08:00-17:00', () => {
  expect(calendarOf(undefined)).toEqual(DEFAULT_CALENDAR);
  expect(DEFAULT_CALENDAR.enabled).toBe(false);
  expect(DEFAULT_CALENDAR.weekdays).toEqual([0, 1, 2, 3, 6]);
  expect([...WEEK_ORDER].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(WEEK_ORDER[0]).toBe(6);
});

test('a stored document reads back; a bad value reads as its default', () => {
  const c = calendarOf({ enabled: true, weekdays: [3, 1, 1], start: '07:30', end: '15:00', holidays: ['2026-10-21', '2026-09-20', 'nope', '2026-02-30'], departments: { d1: { enabled: false } } });
  expect(c).toEqual({ enabled: true, weekdays: [1, 3], start: '07:30', end: '15:00', holidays: ['2026-09-20', '2026-10-21'], departments: { d1: { enabled: false } } });
  expect(calendarOf({ enabled: 'yes', weekdays: [], start: '17:00', end: '08:00' })).toMatchObject({ enabled: false, weekdays: [0, 1, 2, 3, 6], start: '08:00', end: '17:00' });
  expect(calendarOf({ weekdays: [9] }).weekdays).toEqual([0, 1, 2, 3, 6]);
  for (const bad of [null, 5, 'x', []]) expect(calendarOf(bad)).toEqual(DEFAULT_CALENDAR);
});

test('validation: only an enabled calendar is judged', () => {
  const on = { ...DEFAULT_CALENDAR, enabled: true };
  expect(calendarProblem(on)).toBeNull();
  expect(calendarProblem({ ...on, weekdays: [] })).toBe('weekdays');
  expect(calendarProblem({ ...on, start: '17:00', end: '08:00' })).toBe('order');
  expect(calendarProblem({ ...on, start: '09:00', end: '09:00' })).toBe('order');
  expect(calendarProblem({ ...on, start: '9:00' })).toBe('time');
  expect(calendarProblem({ ...on, end: '24:00' })).toBe('time');
  expect(calendarProblem({ ...on, holidays: Array.from({ length: 401 }, (_, i) => `2026-${String((i % 12) + 1).padStart(2, '0')}-01`) })).toBe('holidays_many');
  expect(calendarProblem({ ...DEFAULT_CALENDAR, weekdays: [], start: '18:00', end: '09:00' })).toBeNull();
});

test('weekday toggling keeps the list sorted without repeats', () => {
  expect(toggleDay([0, 1], 6)).toEqual([0, 1, 6]);
  expect(toggleDay([0, 1, 6], 1)).toEqual([0, 6]);
  expect(toggleDay([], 4)).toEqual([4]);
});

test('real dates only', () => {
  expect(['2026-10-21', '2024-02-29'].every(isIsoDate)).toBe(true);
  for (const bad of ['2026-02-29', '2026-13-01', '2026-10-32', '21.10.2026', '', '2026-1-1']) expect(isIsoDate(bad), bad).toBe(false);
});

test('holidays typed as ISO, 21.10.2026 or 21/10/2026, one per line or comma separated', () => {
  const r = parseHolidays('2026-10-21\n22.10.2026, 1/11/2026;2026-10-21\n  \n31.2.2026 hello');
  expect(r.dates).toEqual(['2026-10-21', '2026-10-22', '2026-11-01']);
  expect(r.bad).toEqual(['31.2.2026', 'hello']);
  expect(parseHolidays('')).toEqual({ dates: [], bad: [] });
  expect(parseHolidays(holidaysText(['2026-09-20', '2026-10-21'])).dates).toEqual(['2026-09-20', '2026-10-21']);
});

test('the saved body is the whole document, sorted, with the department overrides untouched', () => {
  const draft = { enabled: true, weekdays: [6, 0, 3], start: '08:00', end: '16:00', holidays: ['2026-10-21', '2026-09-20'], departments: { d1: { start: '09:00', end: '13:00' } } };
  expect(calendarPatch(draft)).toEqual({ enabled: true, weekdays: [0, 3, 6], start: '08:00', end: '16:00', holidays: ['2026-09-20', '2026-10-21'], departments: { d1: { start: '09:00', end: '13:00' } } });
  expect(sameCalendar(draft, { ...draft, weekdays: [0, 3, 6], holidays: ['2026-09-20', '2026-10-21'] })).toBe(true);
  expect(sameCalendar(draft, { ...draft, end: '17:00' })).toBe(false);
});

test('the texts exist in both languages and never write the default module name', () => {
  expect(WORK_CALENDAR_TEXT_EN_KEYS).toEqual(WORK_CALENDAR_TEXT_KEYS);
  for (const k of WORK_CALENDAR_TEXT_KEYS) {
    expect(workCalendarTemplate(k, 'he'), k).toBeTruthy();
    expect(workCalendarTemplate(k, 'en'), k).toBeTruthy();
    expect(workCalendarTemplate(k, 'he'), k).not.toContain('פניות');
  }
  expect(workCalendarTemplate('cardSub', 'he')).toContain('{tickets}');
});
