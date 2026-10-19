import { test, expect } from '@playwright/test';
import { payWhen, paymentOverdueRows, paymentsTotal, serverPaymentDates } from '../src/tickets/overview-model';
import { ot, overviewTemplate, OVERVIEW_TEXT_EN_KEYS, OVERVIEW_TEXT_KEYS } from '../src/tickets/overview-text';
import { setTicketNames } from '../src/tickets/naming';
import type { PayInstalment, PaymentsResponse } from '../src/api/tickets-dashboard';

// MGRDASH phase 4: the pure rules behind the payments card and the payment rows of cards 9 and 10. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-overview-p4.spec.ts

test.beforeEach(() => setTicketNames(null));

const inst = (days: number, due: string, extra: Partial<PayInstalment> = {}): PayInstalment => ({
  id: `a1:${days}`, kind: 'instalment', award_id: 'a1', index: 0, instalment_kind: 'advance', rfq: { id: 'r1', number: 7, ref: 'RFQ-07', title: 'מזגן' },
  department_id: 'd1', vendor: 'קירור בע"מ', due_date: due, days, demand: 'none', moved: false, amount_minor: 30000, currency: 'ILS', ...extra,
});

test('the payments number counts the three groups (counts only) and is 0 without an answer', () => {
  const p = { overdue: { count: 2, items: [] }, upcoming: { count: 3, tomorrow: 1, items: [] }, claims: { count: 1, items: [] } } as unknown as PaymentsResponse;
  expect(paymentsTotal(p)).toBe(6);
  expect(paymentsTotal(null)).toBe(0);
});

test('when an instalment is due, in words', () => {
  expect(payWhen(-3)).toEqual({ key: 'pyLateDays', n: 3 });
  expect(payWhen(-1)).toEqual({ key: 'pyLateDay', n: 1 });
  expect(payWhen(0).key).toBe('pyDueToday');
  expect(payWhen(1).key).toBe('pyDueTomorrow');
  expect(payWhen(9)).toEqual({ key: 'pyDueIn', n: 9 });
  expect(ot('pyLateDays', { n: 3 })).toBe('באיחור של 3 ימים');
  expect(ot('pyDueIn', { n: 9 })).toBe('בעוד 9 ימים');
});

test('an instalment past its day becomes a row of "overdue" that opens the request, red after two days', () => {
  const now = new Date(2026, 9, 19, 10, 0);
  const rows = paymentOverdueRows([inst(-1, '2026-10-18'), inst(-4, '2026-10-15')], now);
  expect(rows.map((r) => [r.kind, r.rfq, r.ref, r.tone])).toEqual([['pay', true, 'RFQ-07', 'warn'], ['pay', true, 'RFQ-07', 'bad']]);
  expect(rows[0].late).toBe(10 * 3_600_000); // from the end of the due day
  expect(rows[1].who).toBe('קירור בע"מ');
});

test('the next two weeks take the payment dates from the server', () => {
  expect(serverPaymentDates([inst(3, '2026-10-22')])).toEqual([{ rfqId: 'r1', ref: 'RFQ-07', title: 'מזגן', vendor: 'קירור בע"מ', date: '2026-10-22' }]);
});

test('the phase-4 texts exist in both languages and name no module', () => {
  const keys = OVERVIEW_TEXT_KEYS.filter((k) => k.startsWith('py') || k === 'odPay');
  expect(keys.length).toBeGreaterThan(15);
  for (const k of keys) {
    expect(OVERVIEW_TEXT_EN_KEYS, k).toContain(k);
    for (const lang of ['he', 'en'] as const) expect(overviewTemplate(k, lang), `${lang}.${k}`).not.toMatch(/קריא(ה|ות|ת)|\bTickets?\b/);
  }
  expect(ot('pyTitle')).toBe('תשלומים');
});
