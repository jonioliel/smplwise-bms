import { test, expect } from '@playwright/test';
import { MP_KEYS, MP_TABLES, mp } from '../src/i18n/messaging-pacing';
import { changedWaits, slowed, span, tone, waitValue } from '../src/messaging/pacing-model';
import { messagingPacingApi, resetDemoMessagingPacing, type PacingAccount, type PacingView } from '../src/api/messaging-pacing';

// CR-WA-PACING-295: the pure logic, the words and the demo backend of the shared send-budget card. Runs in Node (no page):
//   npx playwright test -c playwright.unit.config.ts tests/unit-messaging-pacing.spec.ts

const account = (over: Partial<PacingAccount> = {}): PacingAccount => ({
  account_key: 'entry:A', sends_1h: 0, sends_24h: 0, wiskey_1h: 0, wiskey_24h: 0, waiting: 0, waiting_by_class: {}, oldest_wait_s: null,
  counters_24h: { sent: 0, deferred: 0, backoff: 0, pair_backoff: 0, expired: 0 }, backoff: null, pairs_in_backoff: 0, ...over,
});

test('every key exists in all four languages and no table has strays', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    expect(Object.keys(MP_TABLES[lang]).sort(), lang).toEqual([...MP_KEYS].sort());
    for (const k of MP_KEYS) expect(MP_TABLES[lang][k].trim().length, `${lang}.${k}`).toBeGreaterThan(0);
  }
  // placeholders are the same in every language
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
  for (const k of MP_KEYS) for (const lang of ['en', 'ar', 'ru'] as const) expect(ph(MP_TABLES[lang][k]), `${lang}.${k}`).toBe(ph(MP_TABLES.he[k]));
});

test('no text names the tickets module or offers a ticket action', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) for (const k of MP_KEYS) expect(MP_TABLES[lang][k]).not.toMatch(/ticket|בקשת שירות|طلب خدمة|заяв/i);
});

test('placeholders are filled', () => {
  expect(mp('budget', { n: 3, b: 2 }, 'en')).toBe('3 a minute · burst 2');
  expect(mp('backoffUntil', { time: '10:15' }, 'ru')).toContain('10:15');
});

test('span picks a readable unit', () => {
  expect(span(45)).toEqual({ n: 45, u: 's' });
  expect(span(540)).toEqual({ n: 9, u: 'm' });
  expect(span(7300)).toEqual({ n: 2, u: 'h' });
  expect(span(-5)).toEqual({ n: 0, u: 's' });
});

test('queue limits: whole numbers 1..2880 only', () => {
  expect(waitValue('5')).toBe(5);
  expect(waitValue(' 2880 ')).toBe(2880);
  for (const bad of ['', '0', '2881', '1.5', '-3', 'abc', '12345']) expect(waitValue(bad), bad).toBeNull();
});

test('only changed limits are sent', () => {
  const view = { max_wait_min: { alert: 60, code: 5, ticket: 360, reminder: 720 } } as PacingView;
  expect(changedWaits(view, { code: 5, ticket: 90 })).toEqual({ ticket: 90 });
  expect(changedWaits(view, {})).toEqual({});
});

test('tone: ended messages are bad, slow-downs warn', () => {
  expect(tone(account())).toBe('ok');
  expect(tone(account({ counters_24h: { sent: 1, deferred: 0, backoff: 1, pair_backoff: 0, expired: 0 } }))).toBe('warn');
  expect(slowed(account({ pairs_in_backoff: 1 }))).toBe(true);
  expect(tone(account({ backoff: { level: 1, until: '2026-10-21T10:00:00Z' } }))).toBe('warn');
  expect(tone(account({ counters_24h: { sent: 0, deferred: 1, backoff: 0, pair_backoff: 0, expired: 2 } }))).toBe('bad');
});

test('the demo backend starts conservative and follows a save', async () => {
  resetDemoMessagingPacing();
  const api = messagingPacingApi();
  const v = await api.view();
  expect(v.mode).toBe('conservative');
  expect(v.applies).toBe(true);
  const off = await api.save({ mode: 'off' });
  expect(off.applies).toBe(false);
  expect(off.budget).toBeNull();
  const std = await api.save({ mode: 'standard', max_wait_min: { ticket: 90 } });
  expect(std.budget?.per_minute).toBe(6);
  expect(std.max_wait_min.ticket).toBe(90);
  expect(std.max_wait_min.code).toBe(5);
  resetDemoMessagingPacing();
});
