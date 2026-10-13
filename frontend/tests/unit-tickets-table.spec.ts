import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  activeExtraCount, ageText, applyView, ariaSort, bulkSummary, chooserOrder, COLUMN_KEYS, DEFAULT_COLUMNS, keepAfterBulk, layoutFromPrefs, moveColumn, nextIndex,
  NO_TABLE_FILTERS, normalizeColumns, pageState, parseSort, queryParams, rangeSelect, slaText, sortMark, sortText, spanText, stuckText, tableFilters, toggleColumn,
  toggleOne, togglePage, toggleSort, viewDoc,
} from '../src/tickets/table-model';
import { TABLE_TEXT_EN_KEYS, TABLE_TEXT_KEYS, tableTemplate, tbt } from '../src/tickets/table-text';
import { setTicketNames } from '../src/tickets/naming';
import type { BulkAnswer, TableRow } from '../src/api/tickets-table';

// CR-038 slice 6b (D24, section 13.6): the node-only checks of the board TABLE's pure logic (tickets/table-model.ts) and its text
// catalogue (tickets/table-text.ts) - columns, sort with Shift+click and aria-sort, the request parameters, saved views and the
// preference, selection ranges, keyboard moves, the age / SLA / stuck texts, the bulk summary, and the D33 rule for the new files.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-table.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const NOW = new Date('2026-10-13T10:00:00Z');
const H = 3_600_000;

test.afterEach(() => setTicketNames(null));

test('columns: defaults, normalisation, the required ones, toggle and move', () => {
  expect(COLUMN_KEYS).toEqual(['number', 'title', 'department', 'priority', 'status', 'assignee', 'place', 'device', 'created', 'activity', 'stuck', 'sla']);
  expect(normalizeColumns(undefined)).toEqual([...DEFAULT_COLUMNS]);
  expect(normalizeColumns([])).toEqual([...DEFAULT_COLUMNS]);
  expect(normalizeColumns(['sla', 'phone', 'sla', 'status'])).toEqual(['number', 'title', 'sla', 'status']);
  expect(normalizeColumns(['title', 'number'])).toEqual(['title', 'number']);
  expect(toggleColumn(['number', 'title', 'status'], 'status')).toEqual(['number', 'title']);
  expect(toggleColumn(['number', 'title'], 'sla')).toEqual(['number', 'title', 'sla']);
  expect(toggleColumn(['number', 'title'], 'title'), 'a required column never hides').toEqual(['number', 'title']);
  expect(moveColumn(['number', 'title', 'status'], 'status', -1)).toEqual(['number', 'status', 'title']);
  expect(moveColumn(['number', 'title'], 'number', -1), 'the edge stays').toEqual(['number', 'title']);
  const order = chooserOrder(['title', 'number', 'sla']);
  expect(order.slice(0, 3).map((c) => [c.key, c.shown])).toEqual([['title', true], ['number', true], ['sla', true]]);
  expect(order).toHaveLength(12);
  expect(order.find((c) => c.key === 'number')?.required).toBe(true);
});

test('sort: click flips the primary, another column replaces it, Shift+click adds a second key; aria-sort on the primary only', () => {
  expect(parseSort('')).toEqual([{ key: 'activity', dir: 'desc' }]);
  expect(parseSort('priority:asc,created:desc')).toEqual([{ key: 'priority', dir: 'asc' }, { key: 'created', dir: 'desc' }]);
  for (const bad of ['phone:asc', 'number:up', 'number:asc,number:desc', 'a:asc,b:asc,c:asc', 'number:asc,title:asc,status:asc']) expect(parseSort(bad)).toEqual([{ key: 'activity', dir: 'desc' }]);
  let s = toggleSort(parseSort(''), 'title');
  expect(s).toEqual([{ key: 'title', dir: 'asc' }]);
  s = toggleSort(s, 'title');
  expect(s).toEqual([{ key: 'title', dir: 'desc' }]);
  expect(toggleSort(s, 'created'), 'times start newest first').toEqual([{ key: 'created', dir: 'desc' }]);
  s = toggleSort([{ key: 'priority', dir: 'asc' }], 'activity', true);
  expect(s).toEqual([{ key: 'priority', dir: 'asc' }, { key: 'activity', dir: 'desc' }]);
  expect(toggleSort(s, 'activity', true)).toEqual([{ key: 'priority', dir: 'asc' }, { key: 'activity', dir: 'asc' }]);
  expect(toggleSort(s, 'number', true), 'a third key replaces the second').toEqual([{ key: 'priority', dir: 'asc' }, { key: 'number', dir: 'asc' }]);
  expect(sortText(s)).toBe('priority:asc,activity:desc');
  expect(ariaSort(s, 'priority')).toBe('ascending');
  expect(ariaSort(s, 'activity')).toBe('none');
  expect(ariaSort([{ key: 'sla', dir: 'desc' }], 'sla')).toBe('descending');
  expect(sortMark(s, 'activity')).toEqual({ dir: 'desc', order: 2 });
  expect(sortMark(s, 'title')).toBeNull();
});

test('the request: the base filters of the address plus the table own, empty values left out', () => {
  const f = tableFilters({ scope: 'department', status: 'handling', department: 'dept-1', q: ' מזגן ' }, { ...NO_TABLE_FILTERS, priority: ['urgent', 'high'], waiting: 'manager' });
  expect(queryParams(f, [{ key: 'sla', dir: 'asc' }], { limit: 50, cursor: 'abc', columns: ['number', 'title'] })).toEqual({
    scope: 'department', status: 'handling', department: 'dept-1', priority: 'urgent,high', waiting: 'manager', q: 'מזגן', sort: 'sla:asc', limit: '50', cursor: 'abc', columns: 'number,title',
  });
  expect(activeExtraCount(NO_TABLE_FILTERS)).toBe(0);
  expect(activeExtraCount({ ...NO_TABLE_FILTERS, priority: ['low'], assignee: 'none', created_from: '2026-10-01T00:00:00Z', created_to: '2026-10-02T00:00:00Z' })).toBe(3);
});

test('saved views: the document of the table now, and applying one back (base filters to the address, layout to the table)', () => {
  const layout = layoutFromPrefs({ columns: ['status', 'sla'], sort: 'sla:asc', density: 'compact', limit: 100 });
  expect(layout).toEqual({ columns: ['number', 'title', 'status', 'sla'], sort: [{ key: 'sla', dir: 'asc' }], density: 'compact', limit: 100 });
  expect(layoutFromPrefs({ limit: 30 }).limit, 'a page size outside 25/50/100/200 reads as the default').toBe(50);
  const doc = viewDoc({ scope: 'mine', status: 'open', department: 'd1', q: '' }, { ...NO_TABLE_FILTERS, priority: ['urgent'], stuck: 'any' }, layout);
  expect(doc).toEqual({ view: 'table', filters: { scope: 'mine', status: 'open', department: ['d1'], priority: ['urgent'], stuck: 'any' }, sort: 'sla:asc', columns: ['number', 'title', 'status', 'sla'], density: 'compact' });
  const back = applyView(doc, layoutFromPrefs(null));
  expect(back.base).toEqual({ status: 'open', department: 'd1', q: '' });
  expect(back.extra).toEqual({ ...NO_TABLE_FILTERS, priority: ['urgent'], stuck: 'any' });
  expect(back.layout).toEqual({ ...layout, limit: 50 });
  const odd = applyView({ view: 'table', filters: { priority: 'urgent,critical', waiting: 'x' }, sort: 'nope', columns: [], density: 'compact' }, layoutFromPrefs(null));
  expect(odd.extra.priority).toEqual(['urgent']);
  expect(odd.extra.waiting).toBe('');
  expect(odd.layout.sort).toEqual([{ key: 'activity', dir: 'desc' }]);
});

test('selection: one, a Shift range from the anchor (both directions), the page, and its state', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  expect([...toggleOne(new Set(), 'b')]).toEqual(['b']);
  expect([...toggleOne(new Set(['b']), 'b')]).toEqual([]);
  expect([...rangeSelect(ids, new Set(['a']), 'b', 'd')].sort()).toEqual(['a', 'b', 'c', 'd']);
  expect([...rangeSelect(ids, new Set(), 'e', 'c')].sort()).toEqual(['c', 'd', 'e']);
  expect([...rangeSelect(ids, new Set(), null, 'c')]).toEqual(['c']);
  expect([...togglePage(ids, new Set(['a']))]).toEqual(ids);
  expect([...togglePage(ids, new Set(ids))]).toEqual([]);
  expect(pageState(ids, new Set())).toBe('none');
  expect(pageState(ids, new Set(['a']))).toBe('some');
  expect(pageState(ids, new Set(ids))).toBe('all');
});

test('keyboard: the vertical moves (the same in RTL), clamped at the edges', () => {
  expect(nextIndex(-1, 'ArrowDown', 5)).toBe(0);
  expect(nextIndex(0, 'ArrowDown', 5)).toBe(1);
  expect(nextIndex(4, 'ArrowDown', 5)).toBe(4);
  expect(nextIndex(0, 'ArrowUp', 5)).toBe(0);
  expect(nextIndex(3, 'Home', 5)).toBe(0);
  expect(nextIndex(0, 'End', 5)).toBe(4);
  expect(nextIndex(0, 'PageDown', 30)).toBe(10);
  expect(nextIndex(2, 'ArrowLeft', 5), 'left / right never move the row').toBeNull();
  expect(nextIndex(0, 'ArrowDown', 0)).toBeNull();
});

test('age, SLA and stuck texts', () => {
  expect(spanText(30_000)).toBe('עכשיו');
  expect(spanText(40 * 60_000)).toBe('40 דק׳');
  expect(spanText(3 * H)).toBe('3 ש׳');
  expect(spanText(30 * H)).toBe('יום');
  expect(spanText(-50 * H)).toBe('2 ימים');
  expect(ageText({ created_at: '2026-10-11T10:00:00Z', closed_at: null }, NOW)).toBe('2 ימים');
  expect(ageText({ created_at: '2026-10-13T07:00:00Z', closed_at: '2026-10-13T09:00:00Z' }, NOW), 'a closed ticket stops ageing').toBe('2 ש׳');
  expect(slaText({ kind: 'ack', due_at: '2026-10-13T13:00:00Z', overdue: false }, NOW)).toEqual({ text: 'בעוד 3 ש׳', tone: '' });
  expect(slaText({ kind: 'ack', due_at: '2026-10-13T10:30:00Z', overdue: false }, NOW)).toEqual({ text: 'בעוד 30 דק׳', tone: 'warn' });
  expect(slaText({ kind: 'resolve', due_at: '2026-10-11T10:00:00Z', overdue: true }, NOW)).toEqual({ text: 'חריגה 2 ימים', tone: 'bad' });
  expect(slaText(null, NOW)).toEqual({ text: '', tone: '' });
  expect(stuckText({ kind: 'stuck', level: 1, since: '2026-10-13T06:00:00Z', reminders: 1 }, NOW)).toBe('אין עדכון · 4 ש׳');
  expect(stuckText({ kind: 'unassigned', level: 2, since: null, reminders: 0 }, NOW)).toBe('ללא מטפל');
  expect(stuckText(null, NOW)).toBe('');
});

test('bulk: "done on 12 of 14" with the other results, and what stays selected', () => {
  const a: BulkAnswer = {
    action: 'close', total: 5, done: 2, counts: { ok: 2, stale: 2, forbidden: 1 },
    results: [{ id: 'a', result: 'ok' }, { id: 'b', result: 'stale' }, { id: 'c', result: 'stale' }, { id: 'd', result: 'forbidden' }, { id: 'e', result: 'ok' }],
  };
  expect(bulkSummary(a)).toEqual({ head: 'בוצע ב־2 מתוך 5', rest: '2 השתנו בינתיים · 1 אין הרשאה', tone: 'bad' });
  expect(bulkSummary({ ...a, done: 5, counts: { ok: 5 } })).toEqual({ head: 'בוצע ב־5 מתוך 5', rest: '', tone: 'ok' });
  expect([...keepAfterBulk(a, ['a', 'b', 'd', 'e'])].sort()).toEqual(['b', 'd']);
});

test('the catalogue: complete in English, D33 tokens render the configured name with agreement', () => {
  const en = new Set(TABLE_TEXT_EN_KEYS);
  expect(TABLE_TEXT_KEYS.filter((k) => !en.has(k))).toEqual([]);
  for (const k of TABLE_TEXT_KEYS) {
    for (const lang of ['he', 'en'] as const) {
      const s = tableTemplate(k, lang);
      expect(s, `${lang}.${k}`).not.toMatch(/קריא(ה|ות|ת)|\bTickets?\b/);
      expect(s.trim(), `${lang}.${k}`).not.toBe('');
    }
  }
  expect(tbt('count', { n: 12 })).toBe('12 קריאות');
  setTicketNames({ he: { one: 'אירוע', many: 'אירועים', gender: 'm' } });
  expect(tbt('count', { n: 3 })).toBe('3 אירועים');
  expect(tbt('fStuck')).toBe('תקועים');
  expect(tbt('bulkCloseTitle', { n: 2 })).toBe('סגירת 2 אירועים');
});

test('the D33 lint covers the slice-6b files (no default name in a string)', () => {
  const files = ['tickets/table-model.ts', 'tickets/table-text.ts', 'tickets/table-toolbar.ts', 'tickets/table-bulk.ts', 'tickets/table-switch.ts', 'tickets/table-styles.ts',
    'tickets/table-icons.ts', 'screens/tickets-table.ts', 'api/tickets-table.ts'];
  const bad: string[] = [];
  for (const f of files) {
    const code = readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'));
    code.forEach((line, i) => {
      if (/קריא(ה|ות|ת)/.test(line) || /(['"`])(?:(?!\1).)*\bTickets?\b(?:(?!\1).)*\1/.test(line)) bad.push(`${f}:${i + 1}`);
    });
  }
  expect(bad).toEqual([]);
});

test('every menu of the table is opaque: no popover without the menu surface', () => {
  const css = readFileSync(path.join(SRC, 'tickets/table-styles.ts'), 'utf8');
  for (const sel of ['.anchor > .pop', 'td.cellmenu > .pop']) {
    const block = css.slice(css.indexOf(`${sel} {`), css.indexOf('}', css.indexOf(`${sel} {`)));
    expect(block, sel).toContain('background: var(--sw-menu-surface)');
  }
  const row = { kind: 'stuck', level: 0, since: null, reminders: 0 } as TableRow['stuck'];
  expect(stuckText(row, NOW)).toBe('אין עדכון');
});
