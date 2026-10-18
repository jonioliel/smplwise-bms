import { test, expect } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import type { InstalmentDemandRow } from '../src/api/tickets-costs';
import { demandLines, dueText } from '../src/tickets/costs-demands-model';

// HARDEN271 (owner 2026-10-17, RFQPAY2 follow-up): the read-only instalment demands of a work order in its Costs tab.
const HERE = path.dirname(fileURLToPath(import.meta.url));

const row = (over: Partial<InstalmentDemandRow> = {}): InstalmentDemandRow => ({
  id: 'd0', index: 0, kind: 'advance', status: 'open', amount_minor: 125000, currency: 'ILS', due_date: '2026-11-03', created_at: '2026-10-17T08:00:00Z',
  paid_at: null, cancelled_at: null, ...over,
});

test.describe('instalment demands in the Costs tab', () => {
  test('nothing sent, an empty list or malformed rows: no line at all (never a guess)', () => {
    expect(demandLines(undefined, 'he')).toEqual([]);
    expect(demandLines(null, 'he')).toEqual([]);
    expect(demandLines([], 'he')).toEqual([]);
    expect(demandLines([row({ status: 'weird' as never }), row({ id: 7 as never }), row({ index: 1.5 })], 'he')).toEqual([]);
  });

  test('rows in instalment order with status, kind, amount and the due day', () => {
    const lines = demandLines([row({ id: 'd2', index: 2, kind: 'final', due_date: null }), row({ status: 'paid', paid_at: '2026-10-20T08:00:00Z' })], 'he');
    expect(lines.map((l) => [l.id, l.label, l.kind, l.status, l.statusText, l.due])).toEqual([
      ['d0', 'תשלום 1', 'מקדמה', 'paid', 'שולם', '03.11.2026'],
      ['d2', 'תשלום 3', 'תשלום סופי', 'open', 'ממתין לתשלום', 'בסיום העבודה'],
    ]);
    expect(lines[0].amount_minor).toBe(125000);
    expect(demandLines([row({ status: 'cancelled' })], 'en')[0]).toMatchObject({ label: 'Instalment 1', kind: 'Advance', statusText: 'Cancelled', due: '03.11.2026' });
    expect(dueText('not-a-date', 'en')).toBe('On completion');
  });

  test('budget: the lazy chunk keeps its own 3 KB cap (gzip) in the built add-on UI', () => {
    const dir = path.resolve(HERE, '../../smplwise_vms/www/assets');
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^costs-demands-.*\.js$/.test(f)) : [];
    test.skip(files.length === 0, 'smplwise_vms/www is not rebuilt with this change yet (npm run build:addon on the runner)');
    const n = files.reduce((sum, f) => sum + gzipSync(readFileSync(path.join(dir, f))).length, 0);
    expect(n).toBeLessThanOrEqual(3 * 1024);
  });

  test('the list is a lazy chunk: the Costs tab never imports it statically', () => {
    const tab = readFileSync(path.resolve(HERE, '../src/tickets/costs-tab.ts'), 'utf8');
    expect(tab).not.toMatch(/^import\s+['"]\.\/costs-demands['"]/m);
    expect(tab).not.toMatch(/^import\s[^;]*from\s+['"]\.\/costs-demands['"]/m);
    expect(tab).toContain("import('./costs-demands')");
  });
});
