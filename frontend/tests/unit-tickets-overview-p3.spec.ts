import { test, expect } from '@playwright/test';
import {
  APPROVALS_SHOWN, approvalsTotal, dailyTotals, daysOfPeriod, foldedOf, periodOfDays, rfqStageOf, shortDay, signed, sortDepartments, PHONE_FOLDED,
} from '../src/tickets/overview-model';
import { ot, overviewTemplate } from '../src/tickets/overview-text';
import { setTicketNames } from '../src/tickets/naming';
import type { DashDepartment, DashboardResponse } from '../src/api/tickets-dashboard';

// MGRDASH phase 3: the pure rules behind the cards of the summary route (5 how much was handled, 6 opened vs closed, 7 waiting for my
// approval, 8 requests for quotation, 11 the department comparison). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-overview-p3.spec.ts

test.beforeEach(() => setTicketNames(null));

const group = (count: number) => ({ count, items: [] });

test('the period of "how much was handled" is the handler cards\' remembered period, both ways', () => {
  expect([1, 7, 30].map((d) => periodOfDays(d as 1 | 7 | 30))).toEqual(['today', '7d', '30d']);
  expect((['today', '7d', '30d'] as const).map(daysOfPeriod)).toEqual([1, 7, 30]);
});

test('waiting for my approval counts the three groups and is null without an answer (never an amount)', () => {
  const a: DashboardResponse['approvals'] = { quotes: group(2), claims: group(1), second: group(3) } as unknown as DashboardResponse['approvals'];
  expect(approvalsTotal(a)).toBe(6);
  expect(approvalsTotal(null)).toBeNull();
  expect(APPROVALS_SHOWN).toBe(5);
});

test('the request state in words follows the server stage', () => {
  expect(rfqStageOf({ stage: 'second', state: 'awarded', quoted: 3, invited: 3 })).toEqual({ text: 'rq_second', tone: 'info' });
  expect(rfqStageOf({ stage: 'decide', state: 'due_passed', quoted: 1, invited: 3 })).toEqual({ text: 'rq_due', tone: 'warn' });
  expect(rfqStageOf({ stage: 'decide', state: 'collecting', quoted: 3, invited: 4 })).toEqual({ text: 'rq_decide', tone: 'warn' });
  expect(rfqStageOf({ stage: 'questions', state: 'collecting', quoted: 3, invited: 4 })).toEqual({ text: 'rq_received', tone: 'info' });
  expect(rfqStageOf({ stage: 'collecting', state: 'sent', quoted: 0, invited: 3 })).toEqual({ text: 'rq_collecting', tone: '' });
  expect(ot('rq_decide', { quoted: 3, invited: 4 })).toBe('3 מתוך 4 הצעות התקבלו - לבחור');
  expect(ot('rq_collecting', { quoted: 0, invited: 3 })).toBe('אוספת הצעות · 0 מתוך 3');
});

test('opened vs closed: totals, the net with its sign, the bar scale and the short day', () => {
  const days = [{ date: '2026-10-06', opened: 4, closed: 3 }, { date: '2026-10-07', opened: 0, closed: 0 }, { date: '2026-10-08', opened: 5, closed: 8 }];
  expect(dailyTotals(days)).toEqual({ opened: 9, closed: 11, net: -2, max: 8 });
  expect(dailyTotals([{ date: '2026-10-06', opened: 0, closed: 0 }]).max).toBe(1);
  expect([signed(6), signed(-2), signed(0)]).toEqual(['+6', '-2', '0']);
  expect(shortDay('2026-10-07')).toBe('7.10');
  expect(ot('dyNet', { n: signed(6) })).toBe('+6 בשבועיים');
});

test('the department comparison of the summary sorts the worst first', () => {
  const d = (id: string, stuck: number, overdue: number, open: number): DashDepartment => ({ id, name: id, open, stuck, overdue, waiting: 0, done_7d: 0, busy_handlers: 0 });
  expect(sortDepartments([d('a', 0, 0, 9), d('b', 2, 1, 3), d('c', 0, 0, 12), d('d', 3, 0, 1)]).map((x) => x.id)).toEqual(['b', 'd', 'c', 'a']);
});

test('on a phone the cards 5, 6 and 11 start folded (the new cards 7 and 8 do not)', () => {
  expect(PHONE_FOLDED).toEqual(['throughput', 'daily', 'departments']);
  expect([...foldedOf(null, true)].sort()).toEqual(['daily', 'departments', 'throughput']);
  expect(foldedOf('["approvals","rfqs"]', true).has('rfqs')).toBe(true);
});

test('the phase-3 texts follow the module name (quotes "on a request") and write no default name', () => {
  for (const k of ['thTitle', 'thDone', 'dyTitle', 'apTitle', 'apQuotes', 'rqTitle', 'rqQuestion', 'cmpDecide', 'cmpDone7'] as const) {
    for (const lang of ['he', 'en'] as const) expect(overviewTemplate(k, lang), `${lang}.${k}`).not.toMatch(/קריא(ה|ות|ת)|\bTickets?\b/);
  }
  expect(ot('apQuotes')).toBe('הצעות מחיר לבקשת שירות');
  setTicketNames({ he: { one: 'דיווח', many: 'דיווחים', gender: 'm' } });
  expect(ot('apQuotes')).toBe('הצעות מחיר לדיווח');
  expect(ot('cmpDecide')).toBe('מחכים להחלטה');
  setTicketNames(undefined);
});
