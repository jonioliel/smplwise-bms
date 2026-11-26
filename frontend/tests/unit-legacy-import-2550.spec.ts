import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupedItems, pageRows, writeCount, type LegacyItem } from '../src/api/legacy-migration';
import { en as COMPONENTS_EN } from '../src/i18n/lang/en/i18n/msg/components';
import { en as API_SYSTEM_EN } from '../src/i18n/lang/en/i18n/msg/api-system';
import { CONFIRM_WORDS } from '../src/i18n/confirm-words';

// LEGACY-IMPORT-UI-2550: the logic of the legacy import card (api/legacy-migration.ts) - the report rows grouped by area in the server's
// order, paged with a heading row opening every group on every page - and its words: every text of the card has its English, no
// home-system branding, the backup kind auto-pre-legacy-import has a label in both languages.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const item = (id: string, action = 'info'): LegacyItem => ({ id, area: id.split('.')[0], action, code: 'x', note: 'n' });

test('groupedItems: groups by area in the order of first appearance, the server order inside a group', () => {
  const rows = groupedItems([item('cameras.ch1'), item('connection.host'), item('cameras.ch2'), item('options.a'), item('connection.user')]);
  expect(rows.map((r) => r.id)).toEqual(['cameras.ch1', 'cameras.ch2', 'connection.host', 'connection.user', 'options.a']);
});

test('pageRows: a heading opens every group on every page (repeated where a group continues), the page is clamped', () => {
  const items = [...Array.from({ length: 6 }, (_, i) => item(`cameras.ch${i + 1}`)), item('connection.host'), item('connection.user'), item('time.offset')];
  const p1 = pageRows(items, 1, 4);
  expect(p1.pages).toBe(3);
  expect(p1.rows.map((r) => (r.kind === 'head' ? `#${r.area}:${r.count}` : r.id))).toEqual(['#cameras:6', 'cameras.ch1', 'cameras.ch2', 'cameras.ch3', 'cameras.ch4']);
  const p2 = pageRows(items, 2, 4);
  expect(p2.rows.map((r) => (r.kind === 'head' ? `#${r.area}` : r.id))).toEqual(['#cameras', 'cameras.ch5', 'cameras.ch6', '#connection', 'connection.host', 'connection.user']);
  const p9 = pageRows(items, 9, 4);
  expect(p9.page).toBe(3);
  expect(p9.rows.map((r) => (r.kind === 'head' ? `#${r.area}` : r.id))).toEqual(['#time', 'time.offset']);
  expect(pageRows([], 1, 8)).toEqual({ rows: [], pages: 1, page: 1 });
  // heading ids never collide with item ids (the table's row key)
  const ids = p2.rows.map((r) => r.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('writeCount: only create and update are writes', () => {
  expect(writeCount({ summary: { create: 1, update: 2, same: 5, keep: 1, skip: 3, manual: 2, info: 4 } })).toBe(3);
  expect(writeCount({ summary: { create: 0, update: 0, same: 5, keep: 1, skip: 3, manual: 2, info: 4 } })).toBe(0);
});

test('every text of the card has its English with the same {placeholders}, and no home-system branding', () => {
  const src = readFileSync(path.join(HERE, '..', 'src', 'components', 'sw-legacy-import.ts'), 'utf8');
  const keys = [...new Set([...src.matchAll(/\btr\('([^']*)'/g)].map((m) => m[1]))];
  expect(keys.length).toBeGreaterThan(40);
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
  const en = COMPONENTS_EN as Record<string, string>;
  for (const k of keys) {
    expect(en[k], k).toBeTruthy();
    expect(ph(en[k]), k).toBe(ph(k));
    for (const text of [k, en[k]]) expect(text, k).not.toMatch(/Home Assistant|\bHA\b|Ingress|Supervisor/i);
  }
});

test('the backup kind auto-pre-legacy-import has a label in Hebrew and English', () => {
  const src = readFileSync(path.join(HERE, '..', 'src', 'api', 'backup.ts'), 'utf8');
  const m = src.match(/'auto-pre-legacy-import': tr\('([^']+)'\)/);
  expect(m?.[1]).toBe('אוטומטי · לפני ייבוא מהמערכת הישנה');
  expect((API_SYSTEM_EN as Record<string, string>)[m![1]]).toBe('Automatic · before the legacy import');
});

test('the confirm word the card asks for is the server table word', () => {
  expect(CONFIRM_WORDS.legacy_import_apply).toEqual({ he: 'ייבוא מהמערכת הישנה', en: 'import legacy' });
});
