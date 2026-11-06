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

// WXH-LEFTOVERS-2405: the owner contacts, the watchdog lines, the hand-over row and the Settings banner.
test('the watchdog codes have words in every column; an unknown code falls back to itself', () => {
  for (const code of ['overlap_overdue', 'needs_repair', 'verify_failed', 'generation_mismatch']) {
    for (const lang of ['he', 'en', 'ar', 'ru'] as const) expect(bktCode('wd_', code, lang), `${lang}.${code}`).not.toBe(code);
  }
  expect(bktCode('wd_', 'something_new', 'en')).toBe('something_new');
  expect(bkt('wd_generation_mismatch', { a: 2, b: 3 }, 'en')).toBe('The bridge reports key generation 3, Arx has generation 2. Re-pairing is recommended.');
  expect(bkt('ownerReach', { n: 2 }, 'en')).toBe('A bridge-key notice reaches 2 system administrators');
});

test('the card edits the owner contacts with a select (no free text) and shows each watchdog line once', () => {
  const src = readFileSync(new URL('../src/components/sw-bridge-key-card.ts', import.meta.url), 'utf8');
  expect(src).toContain('data-bridge-key-owners');
  expect(src).toContain('data-bridge-key-owner-add');
  expect(src).toContain('setOwnerContacts(');
  expect(src.match(/data-bridge-key-watchdog=/g)?.length).toBe(1);
  expect(src).not.toMatch(/<input|<textarea/);
  const api = readFileSync(new URL('../src/api/bridge-key.ts', import.meta.url), 'utf8');
  expect(api).toContain("'system/bridge-key/owner-contacts', { user_ids: userIds }");
  expect(api).toContain("get<NoticeBanner>('system/bridge-key/notice')");
});

test('the banner is local, read only, and drawn only in the Settings area', () => {
  const src = readFileSync(new URL('../src/components/sw-bridge-key-banner.ts', import.meta.url), 'utf8');
  expect(src).toContain('onRemote()');
  expect(src).toContain("can('system.configure')");
  expect(src).not.toMatch(/\b(post|put|del)\(/);
  expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB|material|secret/);
  const app = readFileSync(new URL('../src/shell/sw-app.ts', import.meta.url), 'utf8');
  const line = app.split('\n').find((l) => l.includes('<sw-bridge-key-banner>')) ?? '';
  expect(line).toContain("area !== 'system'");
  expect(app.match(/<sw-bridge-key-banner>/g)?.length).toBe(1);
});
