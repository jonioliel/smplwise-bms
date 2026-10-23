import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dayText, dayMonthText, timeText, dayTimeText, dayMonthTimeText, dateInputLangFor } from '../src/api/day-format';

// DATEFMT60-295 (board r060): one date/time format module - dd.mm.yyyy, 24-hour, the installation's zone - and a Hebrew lang on date inputs.
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const at = '2026-10-14T21:05:09Z'; // 00:05:09 on 15.10 in Jerusalem (UTC+3), 21:05:09 on 14.10 in UTC

test('the installation time zone decides the day and the clock', () => {
  expect(dayTimeText(at, { timeZone: 'Asia/Jerusalem' })).toBe('15.10.2026 00:05');
  expect(dayTimeText(at, { timeZone: 'UTC' })).toBe('14.10.2026 21:05');
  expect(timeText(at, { timeZone: 'America/New_York' })).toBe('17:05');
  expect(dayMonthText(at, { timeZone: 'Asia/Jerusalem' })).toBe('15.10');
});

test('midnight is 00, never 24; seconds on request', () => {
  expect(timeText('2026-10-14T21:00:00Z', { timeZone: 'Asia/Jerusalem' })).toBe('00:00');
  expect(timeText(at, { timeZone: 'UTC', seconds: true })).toBe('21:05:09');
  expect(dayMonthTimeText(at, { timeZone: 'UTC' })).toBe('14.10 21:05');
});

test('the user language only changes the separator', () => {
  expect(dayText('2026-09-30', { lang: 'en' })).toBe('30/09/2026');
  expect(dayText('2026-09-30', { lang: 'he' })).toBe('30.09.2026');
  expect(dayMonthText(at, { timeZone: 'UTC', lang: 'en' })).toBe('14/10');
});

test('DST: the wall clock follows the zone on the requested date', () => {
  expect(timeText('2026-07-01T12:00:00Z', { timeZone: 'Asia/Jerusalem' })).toBe('15:00');
  expect(timeText('2026-01-01T12:00:00Z', { timeZone: 'Asia/Jerusalem' })).toBe('14:00');
});

test('an unknown zone name falls back to the browser zone instead of throwing', () => {
  expect(dayText(at, { timeZone: 'Not/AZone' })).toMatch(/^\d{2}\.\d{2}\.2026$/);
});

test('empty and invalid values give an empty string', () => {
  for (const v of [null, undefined, '', 'nope']) {
    expect(timeText(v as string | null | undefined)).toBe('');
    expect(dayMonthTimeText(v as string | null | undefined)).toBe('');
    expect(dayTimeText(v as string | null | undefined, { timeZone: 'UTC' })).toBe('');
  }
});

test('date inputs get a Hebrew lang (English only when the page language is English)', () => {
  expect(dateInputLangFor('he')).toBe('he-IL');
  expect(dateInputLangFor('')).toBe('he-IL');
  expect(dateInputLangFor(undefined)).toBe('he-IL');
  expect(dateInputLangFor('en')).toBe('en-GB');
  expect(dateInputLangFor('en-US')).toBe('en-GB');
});

test('every lit date/time input outside the public pages carries lang=dateInputLang()', () => {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir)) {
      const p = path.join(dir, e);
      if (e.endsWith('.ts')) out.push(p);
      else if (!e.includes('.')) walk(p, out);
    }
    return out;
  };
  const bad: string[] = [];
  for (const f of walk(SRC)) {
    if (f.includes(`${path.sep}public-ticket${path.sep}`) || f.endsWith('day-format.ts')) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/<input\b[^>]*\btype="(?:date|time|datetime-local)"[^>]*>/g)) if (!m[0].includes('lang=${dateInputLang()}')) bad.push(`${path.relative(SRC, f)}: ${m[0].slice(0, 80)}`);
  }
  expect(bad).toEqual([]);
});
