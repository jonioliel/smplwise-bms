import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Latest, readPages, stillOn } from '../src/tickets/late-answer';
import { RFQ_TEXT_EN_KEYS, RFQ_TEXT_KEYS } from '../src/tickets/rfq-text';

// FIX-TICKETS2-2570 (TK2-02 / TK2-03 / TK2-04): a late answer never overwrites what the viewer looks at now.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-late-answer-2570.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');

test('Latest: only the newest read is current (a refresh that lands after "load more" is dropped)', () => {
  const l = new Latest();
  const a = l.begin();
  const b = l.begin();
  expect(l.current(a)).toBe(false);
  expect(l.current(b)).toBe(true);
});

test('stillOn: an answer asked for ticket A / department A is dropped once B is on screen', () => {
  expect(stillOn('A', 'A')).toBe(true);
  expect(stillOn('A', 'B')).toBe(false);
});

const book = (n: number) => async (cursor: string | null) => {
  const from = cursor ? Number(cursor) : 0;
  return { items: Array.from({ length: 2 }, (_, i) => `r${from + i}`), next_cursor: from + 2 < n ? String(from + 2) : null };
};

test('readPages: a quiet refresh re-reads as many pages as were loaded (TK2-02), and stops when the list ends', async () => {
  const got = await readPages(book(10), 3);
  expect(got?.items).toEqual(['r0', 'r1', 'r2', 'r3', 'r4', 'r5']);
  expect(got?.next).toBe('6');
  expect(got?.pages).toBe(3);
  const short = await readPages(book(3), 5);
  expect(short?.items.length).toBe(4);
  expect(short?.next).toBeNull();
  expect(short?.pages).toBe(2);
  expect((await readPages(book(10), 0))?.pages).toBe(1);
});

test('readPages: a stale read returns nothing', async () => {
  const l = new Latest();
  const t = l.begin();
  const slow = readPages(book(10), 3, () => l.current(t));
  l.begin();
  expect(await slow).toBeNull();
});

test('the screens use the guards (the wiring of TK2-02 / 03 / 04)', () => {
  const rfqs = read('screens/tickets-rfqs.ts');
  expect(rfqs).toContain('readPages(fetchPage, quiet ? this.pagesLoaded : 1');
  expect(rfqs).toContain('data-rfq-loaded-only');
  const det = read('tickets/ticket-detail.ts');
  expect(det).toContain('stillOn(asked, this.ticketId)');
  expect(det).toContain('stillOn(t.id, this.ticketId)');
  expect(det).toContain('stillOn(id, this.ticketId)');
  const ov = read('screens/tickets-overview.ts');
  expect((ov.match(/live\(\)/g) ?? []).length).toBeGreaterThanOrEqual(6);
});

test('the new RFQ text exists in Hebrew and English', () => {
  expect(RFQ_TEXT_KEYS).toContain('loadedOnly');
  expect(RFQ_TEXT_EN_KEYS).toContain('loadedOnly');
});
