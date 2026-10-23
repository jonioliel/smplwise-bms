import { test, expect } from '@playwright/test';
import { accountChip, fmtIls, fmtM3, fmtVolume, linesByComponent, priceIncVat, snoozeLabel, snoozeProblem, snoozeUntil, toMinutes } from '../src/water/billing-format';
import type { BillLine } from '../src/api/water-billing';

// CR-WATER78 slice 3 (section 16): the water billing screens' pure helpers - node only, no browser, no network.

test('m3 has three decimals, litres under one m3, money in shekels', () => {
  expect(fmtM3('36')).toBe('36.000');
  expect(fmtM3(null)).toBe('-');
  expect(fmtVolume('0.250')).toEqual({ value: '250', unit: 'ליטר' });
  expect(fmtVolume('1.5')).toEqual({ value: '1.500', unit: 'מ״ק' });
  expect(fmtIls('649.95')).toBe('649.95 ₪');
  expect(fmtIls(undefined)).toBe('');
});

test('account chip: paused wins, then a stale meter, else active', () => {
  expect(accountChip({ status: 'paused', stale_meters: [{ meter_id: 'a', name: 'x' }] }).label).toBe('מושהה');
  expect(accountChip({ status: 'active', stale_meters: [{ meter_id: 'a', name: 'x' }] })).toEqual({ label: 'מונה לא מדווח', cls: 'c-warn' });
  expect(accountChip({ status: 'active', stale_meters: [] }).cls).toBe('c-ok');
});

test('snooze labels and end times as the mockup shows them', () => {
  expect([15, 60, 240, 1440, 4320].map(snoozeLabel)).toEqual(['15 ד׳', 'שעה', '4 שעות', 'יממה', '3 ימים']);
  const now = new Date('2026-11-10T06:45:00Z'); // 08:45 in Israel (winter time; no DST change in the next 3 days)
  expect(snoozeUntil(now, 60)).toBe('09:45');
  expect(snoozeUntil(now, 1440)).toBe('מחר 08:45');
  expect(snoozeUntil(now, 3 * 1440)).toBe('3 ימים, 08:45');
  expect(toMinutes(4, 'hour')).toBe(240);
  expect(toMinutes(1, 'day')).toBe(1440);
});

test('snooze settings checks mirror the server', () => {
  expect(snoozeProblem({ durations: [15, 60, 240, 1440], default: 60, max: 10080 })).toBeNull();
  expect(snoozeProblem({ durations: [15, 60], default: 45, max: 10080 })).toContain('ברירת המחדל');
  expect(snoozeProblem({ durations: [15, 20000], default: 15, max: 10080 })).toContain('מהמקסימום');
  expect(snoozeProblem({ durations: [], default: 15, max: 10080 })).not.toBeNull();
});

test('bill lines split into water and sewage; price including VAT', () => {
  const line = (component: 'water' | 'sewage'): BillLine => ({ component, label_he: '', from: '2026-09-01', to: '2026-09-30', m3: '36.000', price_entered: '10.2', price_mode: 'ex_vat',
    unit_price_ex_vat: '10.2', amount_ex_vat: '367.20', vat_rate_percent: '18', vat_amount: '66.10', total: '433.30' });
  const s = linesByComponent([line('water'), line('sewage'), line('water')]);
  expect([s.water.length, s.sewage.length]).toEqual([2, 1]);
  expect(priceIncVat('10.20', '5.10', 'ex_vat', '18')).toBe(18.05);
  expect(priceIncVat('10.20', '0', 'inc_vat', null)).toBe(10.2);
  expect(priceIncVat('10.20', '5.10', 'ex_vat', null)).toBeNull();
});
