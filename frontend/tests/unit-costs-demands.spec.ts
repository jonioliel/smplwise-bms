import { test, expect } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import type { InstalmentDemandRow } from '../src/api/tickets-costs';
import { demandLines, dueText, payPlan, demandsText } from '../src/tickets/costs-demands-model';

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

  test('budget: the lazy chunk keeps its own 5 KB cap (gzip) in the built add-on UI', () => {
    const dir = path.resolve(HERE, '../../smplwise_vms/www/assets');
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^costs-demands-.*\.js$/.test(f)) : [];
    test.skip(files.length === 0, 'smplwise_vms/www is not rebuilt with this change yet (npm run build:addon on the runner)');
    const n = files.reduce((sum, f) => sum + gzipSync(readFileSync(path.join(dir, f))).length, 0);
    expect(n).toBeLessThanOrEqual(5 * 1024); // COSTINST: 3 KB -> 5 KB (timing words, the mark-paid action)
  });

  test('the list is a lazy chunk: the Costs tab never imports it statically', () => {
    const tab = readFileSync(path.resolve(HERE, '../src/tickets/costs-tab.ts'), 'utf8');
    expect(tab).not.toMatch(/^import\s+['"]\.\/costs-demands['"]/m);
    expect(tab).not.toMatch(/^import\s[^;]*from\s+['"]\.\/costs-demands['"]/m);
    expect(tab).toContain("import('./costs-demands')");
  });

  test('COSTINST: instalments with no demand yet are listed, with their timing (paid / late / soon / not due)', () => {
    const lines = demandLines([
      row({ id: 'a:1', index: 1, status: 'none', timing: 'soon', created_at: null }),
      row({ id: 'a:0', index: 0, status: 'none', timing: 'late', due_date: '2026-10-01', created_at: null }),
      row({ id: 'd2', index: 2, status: 'paid', timing: 'paid', paid_at: '2026-10-20T08:00:00Z' }),
      row({ id: 'a:3', index: 3, status: 'cancelled', timing: 'later' }),
    ], 'he');
    expect(lines.map((l) => [l.index, l.status, l.statusText, l.timing, l.timingText])).toEqual([
      [0, 'none', 'טרם נדרש', 'late', 'באיחור'], [1, 'none', 'טרם נדרש', 'soon', 'בקרוב'], [2, 'paid', 'שולם', 'paid', 'שולם'],
      [3, 'cancelled', 'בוטל', 'later', 'טרם הגיע המועד'],
    ]);
    expect(demandLines([row({ status: 'none', timing: 'late' })], 'en')[0]).toMatchObject({ statusText: 'Not demanded yet', timingText: 'Late' });
    // an older server (no timing field): never a guess about dates - "not due yet"
    expect(demandLines([row()], 'en')[0].timing).toBe('later');
    expect(demandLines([row({ status: 'paid', timing: undefined })], 'en')[0].timing).toBe('paid');
  });

  test('COSTINST: mark paid only where the server said can_pay (never widened) and the plan makes the demand first when there is none', () => {
    const ids = { award_id: 'aw1', rfq_id: 'rq1' };
    const l = (over: Partial<InstalmentDemandRow>) => demandLines([row({ ...ids, ...over })], 'he')[0];
    expect(l({}).canPay).toBe(false); // no flag
    expect(l({ can_pay: false }).canPay).toBe(false);
    expect(l({ can_pay: true, award_id: null }).canPay).toBe(false); // nothing to call
    expect(l({ can_pay: true, status: 'paid' }).canPay).toBe(false);
    expect(payPlan(l({}))).toEqual([]);
    expect(payPlan(l({ can_pay: true, status: 'open' }))).toEqual(['paid']);
    expect(payPlan(l({ can_pay: true, status: 'none' }))).toEqual(['create', 'paid']);
    expect(payPlan(l({ can_pay: true, status: 'cancelled' }))).toEqual(['create', 'paid']);
    expect(payPlan(l({ can_pay: true, status: 'paid' }))).toEqual([]);
  });

  test('COSTINST: Hebrew and English words exist for every key, and the tab reloads after a payment', () => {
    for (const key of ['title', 'none', 'late', 'soon', 'later', 'markPaid', 'confirm', 'yes', 'no', 'failed'] as const) {
      expect(demandsText('he', key)).not.toBe('');
      expect(demandsText('en', key)).not.toBe('');
    }
    const tab = readFileSync(path.resolve(HERE, '../src/tickets/costs-tab.ts'), 'utf8');
    expect(tab).toMatch(/<ticket-costs-demands[^>]*@cost-reload=/);
  });

  test('COSTINST: without tickets.costs.view the rows have dates and status but no amount and no action', () => {
    const l = demandLines([row({ amount_minor: null, currency: null, can_pay: true, award_id: 'aw1', rfq_id: 'rq1', timing: 'late' })], 'he')[0];
    expect(l).toMatchObject({ amount_minor: null, currency: null, canPay: false, timing: 'late', due: '03.11.2026' });
    expect(payPlan(l)).toEqual([]);
    const el = readFileSync(path.resolve(HERE, '../src/tickets/costs-demands.ts'), 'utf8');
    expect(el).toContain('l.amount_minor === null');
  });
});
