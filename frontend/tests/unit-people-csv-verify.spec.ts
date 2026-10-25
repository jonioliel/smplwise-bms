import { test, expect } from '@playwright/test';
import { blockerKey, canConfirm, expiryText, pageCount, pageOf, resultWords, shouldPoll, verifyMode, PAGE_SIZE, POLL_MAX } from '../src/access-control/people-csv-verify-logic';
import { BT_KEYS, BT_TABLES, bt } from '../src/i18n/bulk-people';
import type { BulkSettings, CsvOperation, VerifiedPreview } from '../src/api/bulk-people';

// WKR5ADOPT-295 (W-006): the pure logic of WisKey's verified people CSV preview in the bulk people dialog. Runs in Node (no page):
//   npx playwright test tests/unit-people-csv-verify.spec.ts --project=desktop

const status = (over: Partial<NonNullable<BulkSettings['wiskey_csv']>> = {}): NonNullable<BulkSettings['wiskey_csv']> => ({
  enabled: 'on', available: true, blockers: [], mode: 'create', fields: ['employee_no', 'display_name'], ...over,
});
const preview = (over: Partial<VerifiedPreview> = {}): VerifiedPreview => ({
  preview_digest: 'd'.repeat(64), expires_at: new Date(Date.now() + 60_000).toISOString(), writes: 3, creates: 3, updates: 0, skipped: 1, errors: 0,
  rows: [{ source_line: 2, op: 'create' }, { source_line: 3, op: 'create' }, { source_line: 4, op: 'create' }], ...over,
});
const op = (over: Partial<CsvOperation> = {}): CsvOperation => ({ state: 'running', replay_available: false, ...over });

test('the verified flow is off unless the switch is on, and blocked until the server says it is available', () => {
  expect(verifyMode(null)).toBe('off');
  expect(verifyMode({ wiskey_csv: undefined, may_import: true })).toBe('off');
  expect(verifyMode({ wiskey_csv: status({ enabled: 'off' }), may_import: true })).toBe('off');
  expect(verifyMode({ wiskey_csv: status({ available: false, blockers: ['binding_not_configured'] }), may_import: true })).toBe('blocked');
  expect(verifyMode({ wiskey_csv: status(), may_import: false })).toBe('blocked');
  expect(verifyMode({ wiskey_csv: status(), may_import: true })).toBe('ready');
});

test('every blocker code has a word and an unknown one falls back', () => {
  for (const c of ['switch_off', 'bulk_people_off', 'binding_not_configured', 'direct_not_installed', 'direct_not_selected']) {
    expect(BT_KEYS).toContain(blockerKey(c));
  }
  expect(blockerKey('something_new')).toBe('v_blocker_direct_not_selected');
});

test('long lists page instead of scrolling', () => {
  const rows = Array.from({ length: PAGE_SIZE * 2 + 3 }, (_, i) => i);
  expect(pageCount(0)).toBe(1);
  expect(pageCount(rows.length)).toBe(3);
  expect(pageOf(rows, 0)).toHaveLength(PAGE_SIZE);
  expect(pageOf(rows, 2)).toEqual([16, 17, 18]);
  expect(pageOf(rows, 99)).toEqual([16, 17, 18]);
  expect(pageOf(rows, -4)).toHaveLength(PAGE_SIZE);
});

test('the confirm needs rows, the exact typed count and a preview still in date', () => {
  const now = Date.now();
  expect(canConfirm(preview(), '3', now)).toBe(true);
  expect(canConfirm(preview(), ' 3 ', now)).toBe(true);
  expect(canConfirm(preview(), '2', now)).toBe(false);
  expect(canConfirm(preview(), '', now)).toBe(false);
  expect(canConfirm(preview({ writes: 0, rows: [] }), '0', now)).toBe(false);
  expect(canConfirm(preview({ expires_at: new Date(now - 1).toISOString() }), '3', now)).toBe(false);
  expect(canConfirm(preview({ expires_at: 'not a time' }), '3', now)).toBe(false);
});

test('an unknown outcome is never shown as success and is never polled', () => {
  expect(resultWords(op({ state: 'finished', saved: 3 }))).toEqual({ key: 'v_result_finished', n: 3 });
  expect(resultWords(op({ state: 'finished', saved: null }))).toEqual({ key: 'v_result_done' });
  expect(resultWords(op({ state: 'unknown' })).key).toBe('v_result_unknown');
  expect(resultWords(op({ state: 'running' })).key).toBe('v_result_running');
  expect(shouldPoll(op({ state: 'running' }), 0)).toBe(true);
  expect(shouldPoll(op({ state: 'running' }), POLL_MAX)).toBe(false);
  expect(shouldPoll(op({ state: 'unknown' }), 0)).toBe(false);
  expect(shouldPoll(op({ state: 'finished' }), 0)).toBe(false);
  expect(shouldPoll(null, 0)).toBe(false);
});

test('the expiry text keeps an unparseable value as it is', () => {
  expect(expiryText('garbage')).toBe('garbage');
  expect(expiryText('2026-10-25T12:34:00Z', 'en')).toMatch(/\d/);
});

test('the new words exist in all four languages, are filled, and name no platform', () => {
  const keys = BT_KEYS.filter((k) => k.startsWith('v_'));
  expect(keys.length).toBeGreaterThanOrEqual(25);
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of keys) {
      expect(BT_TABLES[lang][k].trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      expect(BT_TABLES[lang][k]).not.toMatch(/Home Assistant|\bHA\b|Ingress|WisKey/);
    }
  }
  expect(bt('v_result_finished', { n: 4 }, 'en')).toBe('4 written');
  expect(bt('v_page', { a: 1, b: 3 }, 'he')).toContain('3');
  expect(bt('v_will_write', { n: 5 }, 'ar')).toContain('5');
  expect(bt('v_expires', { t: '12:00' }, 'ru')).toContain('12:00');
});
