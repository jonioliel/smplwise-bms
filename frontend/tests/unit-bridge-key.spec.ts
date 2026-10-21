import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { doorsPaused, type BridgeKeyStatus } from '../src/api/bridge-key';
import { BKT_DEV_MARKED, BKT_KEYS, BKT_TABLES, bkt, bktCode } from '../src/i18n/bridge-key';

// CR-WISKEY-HMAC-ROTATION-295: the "Bridge key" card - every column has every key with the same placeholders, Arabic and Russian
// stay dev-marked, no home-system branding, and the card never asks for, shows or stores key material.

test('every column has every key with the same placeholders', () => {
  for (const lang of ['en', 'ar', 'ru'] as const) {
    for (const k of BKT_KEYS) {
      const v = BKT_TABLES[lang][k];
      expect(v, `${lang}.${k}`).toBeTruthy();
      expect((v ?? '').match(/\{\w+\}/g) ?? [], `${lang}.${k}`).toEqual(BKT_TABLES.he[k]?.match(/\{\w+\}/g) ?? []);
    }
  }
  expect([...BKT_DEV_MARKED]).toEqual(['ar', 'ru']);
  expect(bkt('reminderDays', { n: 90 }, 'en')).toBe('Every 90 days');
  expect(bktCode('bl_', 'rotation_not_permitted', 'en')).toBe('Needs the owner’s activation permit');
  expect(bktCode('st_', 'something_new', 'en')).toBe('something_new');
});

test('no home-system branding in any column', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const v of Object.values(BKT_TABLES[lang])) {
      expect(v ?? '').not.toMatch(/Home Assistant|\bHA\b|Ingress|Companion/i);
    }
  }
});

test('the card has no field for key material and keeps nothing in browser storage', () => {
  const src = readFileSync(new URL('../src/components/sw-bridge-key-card.ts', import.meta.url), 'utf8');
  expect(src).not.toMatch(/<input/);
  expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  expect(src).not.toMatch(/material|secret|value_enc/);
  const api = readFileSync(new URL('../src/api/bridge-key.ts', import.meta.url), 'utf8');
  expect(api).toContain("{ mode, confirm: true }");
  expect(api).not.toMatch(/material|value_enc/);
});

// F3B K-01: one plain line while remote door opening is paused by the rotation; no hint paragraph, no home-system name.
const base = { enabled: true, rotation: null, last: null } as Pick<BridgeKeyStatus, 'enabled' | 'rotation' | 'last' | 'door_commands_paused'>;
const rot = (state: string) => ({ state }) as unknown as BridgeKeyStatus['rotation'];

test('doors paused: the server flag wins, otherwise the same rule as the server', () => {
  expect(doorsPaused(base)).toBe(false);
  expect(doorsPaused({ ...base, rotation: rot('switching') })).toBe(true);
  expect(doorsPaused({ ...base, rotation: rot('prepared') })).toBe(true);
  expect(doorsPaused({ ...base, last: rot('needs_repair') })).toBe(true);
  expect(doorsPaused({ ...base, last: rot('verified') })).toBe(false);
  expect(doorsPaused({ ...base, last: rot('rolled_back') })).toBe(false);
  expect(doorsPaused({ ...base, enabled: false, rotation: rot('switching'), last: rot('needs_repair') })).toBe(false);
  expect(doorsPaused({ ...base, door_commands_paused: true })).toBe(true);
  expect(doorsPaused({ ...base, rotation: rot('switching'), door_commands_paused: false })).toBe(false);
});

test('the doors-paused line exists in all four languages and the card shows it in one note', () => {
  expect(bkt('doorsPaused', undefined, 'en')).toBe('Doors paused during key rotation');
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) expect((BKT_TABLES[lang].doorsPaused ?? '').length, lang).toBeGreaterThan(8);
  const src = readFileSync(new URL('../src/components/sw-bridge-key-card.ts', import.meta.url), 'utf8');
  expect(src.match(/data-bridge-key-doors-paused/g)?.length).toBe(1);
  expect(src).toContain("bkt('doorsPaused')");
});
