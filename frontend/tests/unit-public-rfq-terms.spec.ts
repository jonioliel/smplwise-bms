import { test, expect } from '@playwright/test';
import type { ApiFailure, RfqQuote } from '../src/public-ticket/api';
import { invalidKey, newPay, newPayItem, payFromQuote, payProblems, payWire, parsePay, percentBp, rfqFailure } from '../src/public-ticket/rfq/rfq-state';
import { arrivalWire } from '../src/public-ticket/rfq/rfq-page-terms';
import { RFQ_TEXT } from '../src/public-ticket/rfq/rfq-text';

// CR-RFQ-PAYMENT-SCHEDULE (RFQ contract section 19): the vendor page's proposed payment schedule and the arrival confirmation - pure
// logic (node only). The wire carries decimal strings and plain dates only (never a figure the page computed); the page's checks name
// the server's fields; the refusals of the arrival route read as one "not now"; every language has the new words.
//   npx playwright test -c playwright.unit.config.ts tests/unit-public-rfq-terms.spec.ts

const fail = (status: number, code: string, extra: Partial<ApiFailure> = {}): ApiFailure => ({ status, code, retryAfter: 0, attemptsLeft: null, offline: false, ...extra });

test('the schedule wire: percent or amount as typed (normalised), dates as plain days, the final rule - never an amount for the final', () => {
  const p = newPay();
  p.items[0].value = '30';
  p.items[0].date = '2026-11-02';
  const prog = newPayItem('progress');
  prog.mode = 'amount';
  prog.value = '1500,5';
  prog.date = '2026-11-09';
  p.items.push(prog);
  expect(payWire(p)).toEqual({ items: [
    { kind: 'advance', percent: '30', due: 'date', date: '2026-11-02' },
    { kind: 'progress', amount: '1500.5', due: 'date', date: '2026-11-09' },
    { kind: 'final', due: 'completion' },
  ] });
  p.due = 'after_completion';
  p.days = '45';
  expect(payWire(p).items.at(-1)).toEqual({ kind: 'final', due: 'after_completion', days: 45 });
  p.due = 'date';
  p.date = '2026-12-01';
  expect(payWire(p).items.at(-1)).toEqual({ kind: 'final', due: 'date', date: '2026-12-01' });
  expect(JSON.stringify(payWire(p))).not.toMatch(/_minor|total/);
});

test('the page checks name the server fields: shares, dates in order and not past, the sum of percents, the final date and days', () => {
  expect(percentBp('33.33')).toBe(3333);
  expect(percentBp('100')).toBe(10000);
  for (const bad of ['0', '101', '1.234', 'abc', '']) expect(percentBp(bad)).toBeNull();
  const p = newPay();
  expect(payProblems(p, '2026-11-01')).toEqual([{ field: 'payment.items.0.percent', code: 'format' }, { field: 'payment.items.0.date', code: 'range' }]);
  p.items[0].value = '60';
  p.items[0].date = '2026-11-05';
  const prog = newPayItem('progress');
  prog.value = '50';
  prog.date = '2026-11-04';
  p.items.push(prog);
  expect(payProblems(p, '2026-11-01')).toEqual([{ field: 'payment.items.1.date', code: 'order' }, { field: 'payment.items', code: 'exceeds_total' }]);
  prog.date = '2026-11-06';
  prog.value = '40';
  p.due = 'date';
  p.date = '2026-11-05';
  expect(payProblems(p, '2026-11-01')).toEqual([{ field: 'payment.items.2.date', code: 'range' }]);
  p.due = 'after_completion';
  p.days = '181';
  expect(payProblems(p, '2026-11-01')).toEqual([{ field: 'payment.items.2.days', code: 'range' }]);
  p.days = '30';
  expect(payProblems(p, '2026-11-01')).toEqual([]);
  expect(payProblems(p, '2026-11-07')[0]).toEqual({ field: 'payment.items.0.date', code: 'range' }); // a date in the past
});

test('"update" brings back his proposal; a kept schedule survives a reload; a tampered one is none', () => {
  const q = { payment: { items: [
    { kind: 'advance', due: 'date', date: '2026-11-02', days: null, percent: '30', amount_minor: null },
    { kind: 'progress', due: 'date', date: '2026-11-09', days: null, percent: null, amount_minor: 150050 },
    { kind: 'final', due: 'after_completion', date: null, days: 30, percent: null, amount_minor: null },
  ] } } as unknown as RfqQuote;
  const p = payFromQuote(q)!;
  expect(p.items.map((i) => [i.kind, i.mode, i.value, i.date])).toEqual([['advance', 'percent', '30', '2026-11-02'], ['progress', 'amount', '1500.50', '2026-11-09']]);
  expect([p.due, p.days]).toEqual(['after_completion', '30']);
  expect(payFromQuote({ payment: null } as unknown as RfqQuote)).toBeNull();
  expect(parsePay(JSON.parse(JSON.stringify(p)))).toEqual(p);
  for (const bad of [null, 'x', { items: 'x', due: 'completion' }, { items: [], due: 'later' }]) expect(parsePay(bad)).toBeNull();
  expect(parsePay({ items: [{ kind: 'final', value: '1' }, { kind: 'progress', mode: 'iban', value: '5', date: '2026-11-02' }], due: 'completion' })!.items)
    .toEqual([expect.objectContaining({ kind: 'progress', mode: 'percent', value: '5' })]);
});

test('the arrival body: the acknowledgement always, dates only for "propose" (the start of the day in the building zone)', () => {
  expect(arrivalWire('confirm', { ack: true, open: false, from: '2026-11-03', to: '' }, 'Asia/Jerusalem')).toEqual({ action: 'confirm', acknowledge_schedule: true });
  expect(arrivalWire('propose', { ack: true, open: true, from: '2026-11-03', to: '2026-11-04' }, 'Asia/Jerusalem')).toEqual({
    action: 'propose', acknowledge_schedule: true, work_from: '2026-11-02T22:00:00Z', work_to: '2026-11-03T22:00:00Z' });
});

test('the arrival refusals read as one "not now" and reload; schedule / acknowledgement 422s have their own words', () => {
  for (const code of ['arrival_closed', 'arrival_date_missing']) expect(rfqFailure(fail(409, code))).toMatchObject({ message: 'r_e_arrival_closed', reload: true });
  expect(invalidKey('invalid', [{ field: 'payment.items.1.date', code: 'range' }])).toBe('r_e_pay');
  expect(invalidKey('invalid', [{ field: 'payment', code: 'disabled' }])).toBe('r_e_pay');
  expect(invalidKey('invalid', [{ field: 'acknowledge_schedule', code: 'required' }])).toBe('r_e_ack');
});

test('every language carries the new words; the Hebrew never uses the retired cost word', () => {
  const keys = Object.keys(RFQ_TEXT.he).filter((k) => /^(pay|terms|r_e_(arrival|ack|pay))/.test(k));
  expect(keys.length).toBeGreaterThanOrEqual(29);
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) for (const k of keys) expect((RFQ_TEXT[lang] as Record<string, string>)[k], `${lang}.${k}`).toBeTruthy();
  for (const k of keys) expect((RFQ_TEXT.he as Record<string, string>)[k]).not.toMatch(/הצעת עלות|RFQ/);
});
