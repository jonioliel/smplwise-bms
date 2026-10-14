import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  costFieldValue, decimalToMinor, hoursToQuarters, lineTotal, minorToDecimal, previewTotals, quantityToMilli, sectionsByCurrency, vatModeFor, vatOf, blankLine,
} from '../src/tickets/cost-model';
import { COST_TEXT_EN_KEYS, COST_TEXT_KEYS } from '../src/tickets/cost-text';

// CR-038 slice 9 (11A.4, D31 / D32): the manager side's display arithmetic mirrors the server's (services/tickets/money.py) - integers in
// minor units, per-line half-up rounding, VAT excluded / included / none - and the cost text catalogue is complete and never writes the
// module's old default noun (owner rename 14.10).
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-costs.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

test('decimal strings become minor units and back, never through a float', () => {
  expect(decimalToMinor('12.5')).toBe(1250);
  expect(decimalToMinor('0.05')).toBe(5);
  expect(decimalToMinor('1.234')).toBeNull();
  expect(decimalToMinor('-1')).toBeNull();
  expect(minorToDecimal(138709)).toBe('1387.09');
  expect(hoursToQuarters('1.75')).toBe(7);
  expect(hoursToQuarters('0.1')).toBeNull();
  expect(quantityToMilli('0.5')).toBe(500);
});

test('the same vectors as the server', () => {
  const labor = { ...blankLine('labor'), hours: '1.25', rate: '33.33' };
  expect(lineTotal(labor)).toBe(4166);
  const tiny = { ...blankLine('parts'), description: 'x', quantity: '0.5', unit_price: '0.05' };
  expect(lineTotal(tiny)).toBe(3);
  const lines = [
    { ...blankLine('labor'), hours: '2', rate: '150' },
    { ...blankLine('parts'), description: 'מדחס', quantity: '1', unit_price: '800' },
    { ...blankLine('travel'), amount: '50' },
    { ...blankLine('other'), description: 'פינוי', amount: '25.50' },
  ];
  const t = previewTotals(lines, 'excluded', 1800);
  expect(t && [t.subtotal, t.vat, t.total, t.net]).toEqual([117550, 21159, 138709, 117550]);
  expect(vatOf(100, 'included', 1800)).toEqual({ vat: 15, total: 100, net: 85 });
  expect(vatOf(12345, 'none', 1800)).toEqual({ vat: 0, total: 12345, net: 12345 });
  expect(vatModeFor(true, true, false)).toBe('none');
  expect(vatModeFor(false, true, false)).toBe('included');
});

test('the report is grouped per currency and never sums across currencies', () => {
  const groups = [
    { key: 'a', label: 'א', currency: 'ILS', approved_minor: 100, pending_minor: 0, claims: 1, tickets: 1, labor_minor: 0, parts_minor: 0, travel_minor: 0, other_minor: 100 },
    { key: 'b', label: 'ב', currency: 'USD', approved_minor: 0, pending_minor: 50, claims: 1, tickets: 1, labor_minor: 0, parts_minor: 0, travel_minor: 0, other_minor: 50 },
  ];
  const totals = [{ currency: 'ILS', approved_minor: 100, pending_minor: 0, claims: 1, tickets: 1 }, { currency: 'USD', approved_minor: 0, pending_minor: 50, claims: 1, tickets: 1 }];
  const sections = sectionsByCurrency(groups as never, totals as never);
  expect(sections.map((s) => s.currency)).toEqual(['ILS', 'USD']);
  expect(sections.every((s) => s.rows.every((r) => r.currency === s.currency))).toBe(true);
});

test('the text catalogue is complete and keeps the owner rename (no old default noun)', () => {
  expect(COST_TEXT_KEYS.length).toBeGreaterThan(50);
  expect(COST_TEXT_EN_KEYS.every((k) => COST_TEXT_KEYS.includes(k))).toBe(true);
  for (const f of ['tickets/cost-text.ts', 'tickets/ticket-cost-card.ts', 'tickets/cost-model.ts', 'tickets/settings-costs.ts', 'public-ticket/claim/claim-text.ts', 'public-ticket/claim/claim-step.ts']) {
    const src = readFileSync(path.join(SRC, f), 'utf8');
    expect(/קריא(ה|ות|ת)/.test(src), f).toBe(false);
  }
});

test('the settings drafts follow the server ranges and travel as minor units / basis points', () => {
  expect(costFieldValue('vat', '18')).toBe(1800);
  expect(costFieldValue('vat', '17.5')).toBe(1750);
  expect(costFieldValue('vat', '51')).toBeNull();
  expect(costFieldValue('window', '14')).toBe(14);
  expect(costFieldValue('window', '0')).toBeNull();
  expect(costFieldValue('window', '91')).toBeNull();
  expect(costFieldValue('max', '1000000')).toBe(100000000);
  expect(costFieldValue('max', '0.5')).toBeNull();
  expect(costFieldValue('flag', '0')).toBe(0);
  expect(costFieldValue('retention', '729')).toBeNull();
  expect(costFieldValue('retention', '2555')).toBe(2555);
  expect(costFieldValue('retention', 'abc')).toBeNull();
});
