import { test, expect } from '@playwright/test';
import { attention, codesText, editRequest, EMPTY_EDIT, precheckFile, previewCounts, shouldContinue, stepOf, valueText } from '../src/access-control/bulk-people-logic';
import { BT_KEYS, BT_TABLES, bt } from '../src/i18n/bulk-people';
import type { BulkJob, DryRunRow } from '../src/api/bulk-people';

// CR-BULKPEOPLE-295: the pure logic of the bulk people dialog and its words. Runs in Node (no page):
//   npx playwright test tests/unit-bulk-people.spec.ts --project=desktop

const job = (over: Partial<BulkJob> = {}): BulkJob => ({
  id: 'j1', kind: 'import', state: 'staged', row_count: 2, created_at: '', expires_at: '', report: [], counts: { ok: 2, skip: 0, error: 0 },
  plan: null, plan_digest: null, previewed_at: null, writes: null, confirmed: false, results: [], outcomes: {}, progress: { done: 0, total: 0 },
  go_live_permitted: false, ...over,
});

test('every key exists in all four languages and no text names the home platform', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    expect(Object.keys(BT_TABLES[lang]).sort()).toEqual([...BT_KEYS].sort());
    for (const k of BT_KEYS) {
      expect(BT_TABLES[lang][k].trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      expect(BT_TABLES[lang][k]).not.toMatch(/Home Assistant|\bHA\b|Ingress/);
    }
  }
  expect(bt('confirm_text', { n: 7 }, 'he')).toContain('7');
  expect(bt('applying', { done: 3, total: 9 }, 'en')).toBe('3 of 9 written');
});

test('the step of a job', () => {
  expect(stepOf(job())).toBe('report');
  expect(stepOf(job({ state: 'previewed' }))).toBe('preview');
  expect(stepOf(job({ state: 'confirmed' }))).toBe('apply');
  expect(stepOf(job({ state: 'paused' }))).toBe('apply');
  expect(stepOf(job({ state: 'done' }))).toBe('done');
  expect(stepOf(job({ state: 'expired' }))).toBe('closed');
});

test('preview counts and the apply loop', () => {
  const rows: DryRunRow[] = [
    { row: 1, op: 'create', person_id: null, status: 'write', codes: [], fields: [] },
    { row: 2, op: 'update', person_id: 'u1', status: 'write', codes: [], fields: [] },
    { row: 3, op: 'update', person_id: 'u2', status: 'unchanged', codes: [], fields: [] },
    { row: 4, op: 'update', person_id: 'u3', status: 'error', codes: ['scope'], fields: [] },
  ];
  expect(previewCounts(rows)).toEqual({ create: 1, update: 1, unchanged: 1, error: 1 });
  expect(shouldContinue(job({ state: 'paused', more: true }))).toBe(true);
  expect(shouldContinue(job({ state: 'paused', more: true, stalled: true }))).toBe(false);
  expect(shouldContinue(job({ state: 'done', more: false }))).toBe(false);
  expect(attention([{ row: 1, outcome: 'ok', code: null, person_id: 'a' }, { row: 2, outcome: 'unknown', code: 't', person_id: 'b' },
    { row: 3, outcome: 'failed', code: 'scope', person_id: 'c' }]).map((r) => r.row)).toEqual([2, 3]);
});

test('codes and values as text', () => {
  expect(codesText({ codes: ['formula_like'], fields: ['display_name'] }, 'en')).toBe('Name: Looks like a formula');
  expect(codesText({ codes: ['some_new_code'], fields: [] }, 'en')).toBe('Error');
  expect(valueText({ 'entry-a': [1, 2] })).toBe('entry-a: 1+2');
  expect(valueText(null)).toBe('—');
  expect(valueText(false)).toBe('✗');
});

test('the bulk edit request', () => {
  expect(editRequest(['u1'], EMPTY_EDIT)).toBeNull();
  expect(editRequest([], { ...EMPTY_EDIT, active: 'off' })).toBeNull();
  expect(editRequest(['u1', 'u1'], { ...EMPTY_EDIT, active: 'off' })).toEqual({ person_ids: ['u1'], active: false });
  expect(editRequest(['u1'], { ...EMPTY_EDIT, validFrom: '2026-11-01' })).toBeNull();
  expect(editRequest(['u1'], { ...EMPTY_EDIT, validFrom: '2026-12-01', validUntil: '2026-11-01' })).toBeNull();
  expect(editRequest(['u1'], { ...EMPTY_EDIT, doorsAdd: { a: [1] }, doorsRemove: ['a'] })).toBeNull();
  expect(editRequest(['u1'], { ...EMPTY_EDIT, doorsAdd: { a: [1], b: [] }, groupsRemove: ['g'] })).toEqual({ person_ids: ['u1'], doors_add: { a: [1] }, groups_remove: ['g'] });
});

test('a file the server would refuse is caught before the upload', () => {
  expect(precheckFile('people.csv', 10, 'person_id,display_name', 100)).toBeNull();
  expect(precheckFile('people.csv', 101, 'person_id', 100)).toBe('too_large');
  expect(precheckFile('people.xlsx', 10, 'person_id', 100)).toBe('not_csv');
  expect(precheckFile('people.csv', 10, 'person_id,PIN', 100)).toBe('secret_column');
  expect(precheckFile('people.csv', 10, 'מזהה,קוד', 100)).toBe('secret_column');
});
