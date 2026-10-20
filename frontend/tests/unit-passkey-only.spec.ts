import { test, expect } from '@playwright/test';
import { PO_DEV_MARKED, PO_KEYS, PO_TABLES, po } from '../src/i18n/passkey-only';

// usr2-passkeys-only-mode: the words of the per-user "passkeys only" sign-in mode. Pure functions, no browser:
//   npx playwright test -c playwright.unit.config.ts tests/unit-passkey-only.spec.ts

test('every key exists in he, en, ar and ru; ar and ru are dev-marked; no home-platform branding', () => {
  expect(PO_DEV_MARKED).toEqual(['ar', 'ru']);
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    const missing = PO_KEYS.filter((k) => !PO_TABLES[lang][k]);
    expect([lang, missing]).toEqual([lang, []]);
  }
  for (const k of PO_KEYS) expect([k, /Home Assistant|\bHA\b|Ingress|Хоум|هوم/.test(PO_TABLES.he[k] ?? '')]).toEqual([k, false]);
});

test('clean operator text: short labels, no paragraphs', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of PO_KEYS) expect([lang, k, (PO_TABLES[lang][k] ?? '').length < 80]).toEqual([lang, k, true]);
  }
});

test('po() follows the requested language and falls back to Hebrew', () => {
  expect(po('onlyEnable', 'en')).toBe('Turn on');
  expect(po('onlyEnable', 'ru')).toBe('Включить');
  expect(po('onlyEnable', 'ar')).toBe('تفعيل');
  expect(po('onlyEnable', 'he')).toBe('הפעלה');
});
