import { test, expect } from '@playwright/test';
import type { RfqAwardTerms } from '../src/api/tickets-rfq';
import { arrivalKey, dueWords, payFromProposal, payProblems, payWire, proposalLines, scheduleExact } from '../src/tickets/rfq-terms-model';
import { RFQ_TEXT_HE, RFQ_TEXT_EN_KEYS } from '../src/tickets/rfq-text';
import { refusalKey, eventLine } from '../src/tickets/rfq-model';

// CR-RFQ-PAYMENT-SCHEDULE (RFQ contract section 19): the managers' award-dialog editor of the vendor's proposed schedule and the terms
// card - pure logic (node only).
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-rfq-terms.spec.ts

const PROPOSAL = { items: [
  { kind: 'advance' as const, due: 'date', date: '2026-11-02', days: null, percent: '30', amount_minor: null },
  { kind: 'progress' as const, due: 'date', date: '2026-11-09', days: null, percent: null, amount_minor: 150000 },
  { kind: 'final' as const, due: 'after_completion', date: null, days: 30, percent: null, amount_minor: null },
] };

const terms = (over: Partial<RfqAwardTerms['arrival']> = {}, amounts: (number | null)[] = [30000, 70000], total: number | null = 100000): RfqAwardTerms => ({
  schedule: { currency: 'ILS', total_minor: total, rounding: 'floor_final', source: 'vendor', items: [
    { index: 0, kind: 'advance', amount_minor: amounts[0], percent_bp: 3000, due: 'date', date: '2026-11-02', days: null },
    { index: 1, kind: 'final', amount_minor: amounts[1], percent_bp: null, due: 'completion', date: null, days: null }] },
  proposal: null, revision: 3, can: { decide_arrival: false },
  arrival: { state: 'awaiting', planned_from: null, planned_to: null, proposed_from: null, proposed_to: null, rejected_at: null, confirmed_at: null,
    confirmed_by: null, acknowledged_at: null, requested_at: null, reminders: 0, ...over },
});

test('the editor starts from the vendor\'s proposal (or one final payment on completion) and sends decimal strings and plain dates', () => {
  const p = payFromProposal(PROPOSAL);
  expect(p.items).toEqual([{ kind: 'advance', mode: 'percent', value: '30', date: '2026-11-02' }, { kind: 'progress', mode: 'amount', value: '1500', date: '2026-11-09' }]);
  expect([p.due, p.days]).toEqual(['after_completion', '30']);
  expect(payWire(p)).toEqual({ items: [
    { kind: 'advance', percent: '30', due: 'date', date: '2026-11-02' }, { kind: 'progress', amount: '1500', due: 'date', date: '2026-11-09' },
    { kind: 'final', due: 'after_completion', days: 30 }] });
  expect(payFromProposal(null)).toEqual({ items: [], due: 'completion', date: '', days: '30' });
  expect(payWire(payFromProposal(null))).toEqual({ items: [{ kind: 'final', due: 'completion' }] });
});

test('the dialog refuses what the server would: bad shares, past or unordered dates, percents above 100, the final rule', () => {
  const p = payFromProposal(PROPOSAL);
  expect(payProblems(p, '2026-11-01')).toEqual([]);
  expect(payProblems(p, '2026-11-05')).toEqual(['items.0.date']);
  p.items[1].date = '2026-11-01';
  expect(payProblems(p, '2026-11-01')).toEqual(['items.1.date']);
  p.items[1] = { kind: 'progress', mode: 'percent', value: '80', date: '2026-11-09' };
  expect(payProblems(p, '2026-11-01')).toEqual(['items.sum']);
  p.items[1].value = '1.234';
  expect(payProblems(p, '2026-11-01')).toEqual(['items.1.value']);
  p.items[1].value = '10';
  p.due = 'date';
  p.date = '2026-11-03';
  expect(payProblems(p, '2026-11-01')).toEqual(['final.date']);
  p.due = 'after_completion';
  p.days = '200';
  expect(payProblems(p, '2026-11-01')).toEqual(['final.days']);
});

test('words: the proposal row, the due rules, the arrival chip, the exact sum', () => {
  const kinds = { advance: 'מקדמה', progress: 'תשלום ביניים', final: 'תשלום סופי' };
  expect(proposalLines(PROPOSAL, (m) => `₪${m / 100}`, { done: 'בסיום', after: '{n} ימים אחרי', kinds })).toEqual([
    'מקדמה 30% · 02.11.2026', 'תשלום ביניים ₪1500 · 09.11.2026', 'תשלום סופי · 30 ימים אחרי']);
  expect(dueWords({ due: 'completion', date: null, days: null }, { done: 'D', after: 'A{n}' })).toBe('D');
  expect(arrivalKey(terms())).toBe('trm_not_asked');
  expect(arrivalKey(terms({ requested_at: '2026-10-17T10:00:00Z' }))).toBe('trm_waiting');
  expect(arrivalKey(terms({ rejected_at: '2026-10-17T10:00:00Z' }))).toBe('trm_rejected');
  expect(arrivalKey(terms({ state: 'proposed' }))).toBe('trm_proposed');
  expect(arrivalKey(terms({ state: 'confirmed' }))).toBe('trm_confirmed');
  expect(scheduleExact(terms())).toBe(true);
  expect(scheduleExact(terms({}, [30000, 69999]))).toBe(false);
  expect(scheduleExact(terms({}, [null, null], null))).toBe(true); // no tickets.costs.view: nothing to compare
});

test('the new texts, refusals and timeline kinds exist in Hebrew and English; no amount word leaks into the vendor-side words', () => {
  for (const k of ['trmSection', 'trm_confirmed', 'trm_proposed', 'trm_rejected', 'trm_waiting', 'trm_not_asked', 'pyRow', 'pyEdit', 'stRfqCard', 'stScheduleArrival',
    'ev_arrival_confirmed', 'ev_terms_set', 'err_terms_not_found', 'err_arrival_not_proposed'] as const) {
    expect(RFQ_TEXT_HE[k], k).toBeTruthy();
    expect(RFQ_TEXT_EN_KEYS, k).toContain(k);
  }
  expect(refusalKey('arrival_not_proposed')).toBe('err_arrival_not_proposed');
  for (const kind of ['terms_set', 'arrival_requested', 'arrival_reminder', 'arrival_proposed', 'arrival_confirmed', 'arrival_rejected']) {
    expect(eventLine({ id: 1, kind, at: '', vendor_id: null, actor: { kind: 'user', name: 'x' }, data: {} } as never, () => 'v', () => '').key).toBe(`ev_${kind}`);
  }
});
