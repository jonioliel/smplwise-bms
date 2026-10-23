import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PT_DEV_MARKED, PT_KEYS, PT_TABLES, pt, ptCode } from '../src/i18n/partners';

// PARTNERAPI113-295: the "Partner interface" card - Hebrew and English complete with the same placeholders, no home-system branding,
// no scope / event for doors or device control, and the card never keeps a token or a secret in browser storage.

test('Hebrew and English have every key with the same placeholders', () => {
  for (const k of PT_KEYS) {
    const v = PT_TABLES.en[k];
    expect(v, `en.${k}`).toBeTruthy();
    expect((v ?? '').match(/\{\w+\}/g) ?? [], k).toEqual(PT_TABLES.he[k]?.match(/\{\w+\}/g) ?? []);
  }
  expect([...PT_DEV_MARKED]).toEqual(['ar', 'ru']);
  expect(pt('url', { ports: '9443 / 9453' }, 'en')).toBe('Target address (https, port 9443 / 9453)');
  expect(ptCode('sc_', 'tickets.read', 'he')).toBe('קריאת קריאות שירות');
  expect(ptCode('ev_', 'something.new', 'en')).toBe('something.new');
  expect(pt('title', undefined, 'ar')).toBe(pt('title', undefined, 'he'));
});

test('no home-system branding and no door or device-control wording in any column', () => {
  for (const lang of ['he', 'en'] as const) {
    for (const v of Object.values(PT_TABLES[lang])) {
      expect(v ?? '').not.toMatch(/Home Assistant|\bHA\b|Ingress|Companion/i);
    }
  }
  const keys = PT_KEYS.join(' ');
  expect(keys).not.toMatch(/sc_(door|access|alarm|devices|scene|script)/);
});

test('the card keeps nothing in browser storage and shows a secret only in the one-time box', () => {
  const src = readFileSync(new URL('../src/components/sw-partner-api-card.ts', import.meta.url), 'utf8');
  expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  expect(src).toContain('data-partner-once');
  expect(src.match(/showOnce\(/g)?.length).toBeGreaterThanOrEqual(4);
  const api = readFileSync(new URL('../src/api/partners.ts', import.meta.url), 'utf8');
  expect(api).not.toMatch(/token_hash|secret_enc|url_enc/);
});
