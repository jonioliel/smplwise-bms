import { test, expect } from '@playwright/test';
import type { AccountClaim, BulkPaidAnswer } from '../src/api/tickets-costs';
import { reportQs } from '../src/api/tickets-costs';
import {
  NO_FILTERS, accountQuery, accountSummary, bucketOf, bulkItems, bulkOutcome, csvCell, keepSelection, payable, periodValid, selectionByCurrency,
} from '../src/tickets/vendor-account-model';
import { TAB_PERMISSIONS, TICKETS_TABS, activeAreaTab } from '../src/shell/nav';

// TK258 "חשבון ספקים": the grouping and currency logic of the vendors account (tickets/vendor-account-model.ts) - per vendor and per
// currency, never a sum across currencies; what the bulk "mark as paid" takes and shows; the per-item answer; the query; the CSV guard.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-vendor-accounts.spec.ts

let n = 0;
function row(o: Partial<AccountClaim>): AccountClaim {
  n += 1;
  return {
    claim_id: `c${n}`, ticket_id: `t${n}`, number: 1000 + n, title: 'x', department_id: 'dept-maintenance', department: 'אחזקה', vendor_key: 'v-a', vendor: 'ספק א',
    status: 'approved', currency: 'ILS', amount_minor: 100, revision: 2, submitted_at: null, approved_at: null, paid_at: null, payment_date: null, payment_ref: null,
    period_at: '2026-10-01T08:00:00Z', can_mark_paid: true, ...o,
  };
}

const ROWS = [
  row({ vendor_key: 'v-a', vendor: 'ספק א', status: 'approved', amount_minor: 10_000 }),
  row({ vendor_key: 'v-a', vendor: 'ספק א', status: 'paid', amount_minor: 5_000, can_mark_paid: false }),
  row({ vendor_key: 'v-a', vendor: 'ספק א', status: 'submitted', amount_minor: 2_500, can_mark_paid: false }),
  row({ vendor_key: 'v-b', vendor: 'ספק ב', status: 'approved', amount_minor: 30_000 }),
  row({ vendor_key: 'v-a', vendor: 'ספק א', status: 'approved', amount_minor: 7_000, currency: 'USD' }),
  row({ vendor_key: 'v-c', vendor: 'ספק ג', status: 'paid', amount_minor: 1_000, currency: 'USD', can_mark_paid: false }),
];

test('the buckets: approved = to pay, paid, submitted = awaiting approval', () => {
  expect(bucketOf('approved')).toBe('due');
  expect(bucketOf('paid')).toBe('paid');
  expect(bucketOf('submitted')).toBe('open');
});

test('the summary has a block per currency and never adds amounts of two currencies', () => {
  const s = accountSummary(ROWS);
  expect(s.map((b) => b.currency)).toEqual(['ILS', 'USD']);
  const ils = s[0];
  expect(ils.total).toEqual({ due: 40_000, paid: 5_000, open: 2_500, claims: 4 });
  // most to pay first
  expect(ils.vendors.map((v) => v.key)).toEqual(['v-b', 'v-a']);
  expect(ils.vendors[1]).toMatchObject({ due: 10_000, paid: 5_000, open: 2_500, claims: 3, currency: 'ILS' });
  const usd = s[1];
  expect(usd.total).toEqual({ due: 7_000, paid: 1_000, open: 0, claims: 2 });
  // the same vendor has a line in each currency, each in its own currency
  expect(usd.vendors.find((v) => v.key === 'v-a')).toMatchObject({ due: 7_000, currency: 'USD' });
  expect(accountSummary([])).toEqual([]);
});

test('ties: more awaiting first, then by name', () => {
  const s = accountSummary([row({ vendor_key: 'z', vendor: 'ב', status: 'submitted', amount_minor: 5 }), row({ vendor_key: 'y', vendor: 'א', status: 'submitted', amount_minor: 5 }),
    row({ vendor_key: 'x', vendor: 'ג', status: 'submitted', amount_minor: 9 })]);
  expect(s[0].vendors.map((v) => v.key)).toEqual(['x', 'y', 'z']);
});

test('the bulk action takes approved rows the caller may mark; the confirmation sums per currency', () => {
  expect(ROWS.filter(payable).map((r) => r.amount_minor)).toEqual([10_000, 30_000, 7_000]);
  expect(payable(row({ status: 'approved', can_mark_paid: false }))).toBe(false);
  expect(payable(row({ status: 'approved', ticket_id: null }))).toBe(false);
  const all = new Set(ROWS.map((r) => r.claim_id));
  expect(selectionByCurrency(ROWS, all)).toEqual([{ currency: 'ILS', count: 2, minor: 40_000 }, { currency: 'USD', count: 1, minor: 7_000 }]);
  const items = bulkItems(ROWS, all);
  expect(items).toHaveLength(3);
  expect(items[0]).toEqual({ ticket_id: ROWS[0].ticket_id, claim_id: ROWS[0].claim_id, revision: 2 });
  // a reload keeps only what is still payable
  const fresh = ROWS.map((r) => (r.claim_id === ROWS[0].claim_id ? { ...r, status: 'paid' as const } : r));
  expect([...keepSelection(fresh, all)]).toEqual([ROWS[3].claim_id, ROWS[4].claim_id]);
});

test('the per-item answer: already_paid counts as done, the rest is listed', () => {
  const a: BulkPaidAnswer = {
    results: [
      { ticket_id: 't1', claim_id: 'c1', number: 1001, result: 'paid' }, { ticket_id: 't2', claim_id: 'c2', number: 1002, result: 'already_paid' },
      { ticket_id: 't3', claim_id: 'c3', number: 1003, result: 'stale' }, { ticket_id: 't4', claim_id: 'c4', result: 'not_found' },
    ],
    paid: 1, already_paid: 1, failed: 2,
  };
  expect(bulkOutcome(a)).toEqual({ done: 2, failed: [{ claim_id: 'c3', number: 1003, result: 'stale' }, { claim_id: 'c4', number: null, result: 'not_found' }] });
});

test('the filters become the claims / export query; a reversed period is refused', () => {
  expect(accountQuery(NO_FILTERS)).toEqual({});
  const q = accountQuery({ from: '2026-10-01', to: '2026-10-31', vendor: 'v-a', department: 'dept-maintenance', currency: 'USD', bucket: 'due' });
  expect(q).toEqual({ from: '2026-10-01', to: '2026-10-31', vendor: 'v-a', department: 'dept-maintenance', currency: 'USD', status: ['approved'] });
  expect(reportQs(q)).toBe('?from=2026-10-01&to=2026-10-31&status=approved&currency=USD&vendor=v-a&department=dept-maintenance');
  expect(reportQs({ group_by: 'vendor', ...q }, { rows: 'claim' })).toContain('group_by=vendor');
  expect(reportQs({})).toBe('');
  expect(periodValid({ from: '2026-10-05', to: '2026-10-01' })).toBe(false);
  expect(periodValid({ from: '2026-10-01', to: '' })).toBe(true);
});

test('the CSV cell guard neutralises formula starters', () => {
  for (const bad of ['=SUM(A1)', '+1', '-1+2', '@cmd', '\tx', '\rx', '＝1']) expect(csvCell(bad).startsWith(`"'`)).toBe(true);
  expect(csvCell('ספק "א"')).toBe('"ספק ""א"""');
  expect(csvCell(12)).toBe('12');
  expect(csvCell(null)).toBe('""');
});

test('the tab: sixth entry of the area, tickets.costs.view, active on #/tickets/accounts', () => {
  expect(TICKETS_TABS.at(-1)?.id).toBe('accounts');
  expect(TICKETS_TABS.at(-1)?.label).toBe('חשבון ספקים');
  expect(TAB_PERMISSIONS['#/tickets/accounts']).toEqual(['tickets.costs.view']);
  expect(activeAreaTab({ path: '/tickets/accounts', mode: 'tickets', segments: ['tickets', 'accounts'], params: new URLSearchParams() } as never)).toBe('accounts');
});
