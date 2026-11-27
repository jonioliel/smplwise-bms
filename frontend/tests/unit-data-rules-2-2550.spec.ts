import { test, expect } from '@playwright/test';
import { buildStatus, type Account, type AccountStatusWire } from '../src/api/electricity-billing';

// DATA-RULES-2-2550 (2): the electricity account status carries the days between issued bills that no bill covers (`billing_gaps` on
// GET /energy/accounts/{aid}/status, `to` inclusive) into the status model the account page draws its warning from. An answer of an
// older server (no field) is "no gap" - never a crash. Node only, no browser. (The page itself: tests/pixel-data-rules-2-2550.spec.ts.)

const account: Account = {
  id: 'a1', name: 'לובי', customer: null,
  formula: { ast: { m: 'm1' }, text: 'm1', sentence_he: 'מונה 1', meter_ids: ['m1'] } as Account['formula'],
  tariff: { id: 't1', name: 'קבוע' },
  period_months: 1, period_anchor_day: 1, period_anchor_month: 1, first_period_start: '2026-01-01', timezone: 'Asia/Jerusalem', auto_mode: 'draft', status: 'active', revision: 1,
  next_period: { from: '2026-12-01', to: '2026-12-31' }, last_bill: null,
};
const wire = (over: Partial<AccountStatusWire> = {}): AccountStatusWire => ({
  period: { from: '2026-11-01', to: '2026-11-30' }, kwh_so_far: '190.00', notes: [],
  meters: [{ meter_id: 'm1', name: 'מונה 1', kwh: '190.00', last_report_at: '2026-11-19T08:00:00Z', reporting: true }],
  ...over,
});
const ctx = { today: '2026-11-19', customer: null };

test.describe('electricity account status: the billing gaps', () => {
  test('the gaps of the answer reach the status model, oldest first', () => {
    const gaps = [{ from: '2026-09-11', to: '2026-09-20' }, { from: '2026-10-05', to: '2026-10-06' }];
    expect(buildStatus(account, wire({ billing_gaps: gaps }), ctx).gaps).toEqual(gaps);
  });

  test('no gap, or an older server without the field: no warning', () => {
    expect(buildStatus(account, wire({ billing_gaps: [] }), ctx).gaps).toEqual([]);
    expect(buildStatus(account, wire(), ctx).gaps).toEqual([]);
  });
});
