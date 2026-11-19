import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ERROR_TEXT, buildHistory, buildStatus, type Account, type AccountStatusWire, type BillSummary } from '../src/api/electricity-billing';
import { NOT_CAPTURED, NO_VALUE, customerName, f0or, f2or, ilsOr, readingText } from '../src/electricity/elec-format';
import { billAccounts, billForecast, billsWithTotal, fixedTariffPrice, waterView } from '../src/home/home-p3-logic';
import { sumOrNull } from '../src/water/billing-format';
import type * as Wire from '../src/api/generated/wire-consumption';

// CR-RESPONSE-MODELS-FOLLOWUP-2450: the frontend follows the server's real optional / null types (generated from its response models,
// src/api/generated/wire-consumption.ts). Every null / absent path renders a dash or "no data yet" - never NaN, undefined or a made-up 0.
// Node only, no browser.

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f: string) => readFileSync(path.join(here, '..', 'src', f), 'utf8');

const account = (over: Partial<Account> = {}): Account => ({
  id: 'a1', name: 'לובי', customer: { id: 'c1', customer_number: '1001', name: 'ועד הבית' },
  formula: { ast: { m: 'm1' }, text: 'm1', sentence_he: 'מונה 1', meter_ids: ['m1'] } as Account['formula'],
  tariff: { id: 't1', name: 'קבוע' },
  period_months: 1, period_anchor_day: 1, period_anchor_month: 1, first_period_start: '2026-01-01', timezone: 'Asia/Jerusalem', auto_mode: 'draft', status: 'active', revision: 1,
  next_period: { from: '2026-12-01', to: '2026-12-31' }, last_bill: null,
  ...over,
});
const wire = (over: Partial<AccountStatusWire> = {}): AccountStatusWire => ({
  period: { from: '2026-11-01', to: '2026-11-30' }, kwh_so_far: '190.00', notes: [],
  meters: [{ meter_id: 'm1', name: 'מונה 1', kwh: '190.00', last_report_at: '2026-11-19T08:00:00Z', reporting: true }],
  ...over,
});
const ctx = { today: '2026-11-19', customer: null };

test.describe('electricity account status (GET /energy/accounts/{aid}/status, EnergyAccountStatus)', () => {
  test('a period with kWh: the numbers as before', () => {
    const s = buildStatus(account(), wire(), ctx);
    expect(s.period).toEqual({ from: '2026-11-01', to: '2026-11-30', day: 19, days: 30 });
    expect(s.kwh).toBe(190);
    expect(s.avg_per_day).toBe(10);
    expect(s.forecast_kwh).toBe(300);
    expect(s.next?.number).toBe('2026-12-1001');
    expect(s.error).toBeUndefined();
  });

  test('period null (the cycle has no period yet): no day, no kWh, no forecast - all a dash', () => {
    const s = buildStatus(account(), wire({ period: null, kwh_so_far: null, meters: [] }), ctx);
    expect(s.period).toBeNull();
    expect(s.kwh).toBeNull();
    expect(s.forecast_kwh).toBeNull();
    expect(s.avg_per_day).toBeNull();
    expect([f2or(s.kwh), f0or(s.forecast_kwh), f2or(s.avg_per_day)]).toEqual([NO_VALUE, NO_VALUE, NO_VALUE]);
    expect(s.rows).toEqual([]);
  });

  test('error_code (the period could not be computed): kWh null and the reason in words', () => {
    const s = buildStatus(account(), wire({ kwh_so_far: null, meters: [], error_code: 'tariff_missing' }), ctx);
    expect(s.kwh).toBeNull();
    expect(s.forecast_kwh).toBeNull();
    expect(s.period?.days).toBe(30);
    expect(s.error).toBe(ERROR_TEXT.tariff_missing);
    const unknown = buildStatus(account(), wire({ kwh_so_far: null, meters: [], error_code: 'something_new' }), ctx);
    expect(unknown.error).toBeTruthy();
  });

  test('next_period null: no next bill (never a crash on .from)', () => {
    const s = buildStatus(account({ next_period: null }), wire(), ctx);
    expect(s.next).toBeNull();
  });

  test('customer null: the account still renders, its name is a dash, the expected number has no customer part', () => {
    const a = account({ customer: null });
    const s = buildStatus(a, wire(), ctx);
    expect(customerName(a)).toBe(NO_VALUE);
    expect(customerName(account())).toBe('ועד הבית');
    expect(s.next?.number).toBe('2026-12-');
  });

  test('the status meters carry no start / end readings on this server: the rows say "not recorded", never 0', () => {
    const s = buildStatus(account(), wire(), ctx);
    expect(s.rows[0].start).toBeNull();
    expect(s.rows[0].end).toBeNull();
    expect(readingText(s.rows[0].end)).toBe(NOT_CAPTURED);
    // the demo store sends them: shown as numbers
    const d = buildStatus(account(), wire({ meters: [{ ...wire().meters[0], start_reading_kwh: '1000.00', end_reading_kwh: '1190.00' }] }), ctx);
    expect([d.rows[0].start, d.rows[0].end]).toEqual([1000, 1190]);
    // and the phone list draws the end through readingText, not `end ?? 0`
    expect(src('electricity/elec-account-page.ts')).not.toContain('r.end ?? 0');
  });
});

test.describe('bill totals (EnergyBillSummary.total is absent without energy.bills)', () => {
  test('ilsOr / f2or: absent, null and empty are a dash; a value keeps two places', () => {
    expect(ilsOr(undefined)).toBe(NO_VALUE);
    expect(ilsOr(null)).toBe(NO_VALUE);
    expect(ilsOr('')).toBe(NO_VALUE);
    expect(ilsOr('497.35')).toBe('497.35 ₪');
    expect(f2or('0')).toBe('0.00');
    expect(f0or(0)).toBe('0');
  });

  test('a history period whose bill has no total has no amount (never NaN)', () => {
    const bill = { id: 'b1', state: 'issued', number: '2026-10-1001' } as BillSummary;
    const h = buildHistory({ periods: [{ from: '2026-10-01', to: '2026-10-31', kwh: '200.00', status: 'measured', source: 'bill', bill }], comparison: { result_kwh: null, negative: false } as never });
    expect(h.rows[0].amount).toBeUndefined();
  });

  test('the bills table and the issue dialog draw the total through ilsOr', () => {
    expect(src('electricity/elec-bills-table.ts')).not.toContain('f2(b.total)');
    expect(src('electricity/elec-bill-page.ts')).not.toContain('f2(b.total)');
  });
});

test.describe('home: the electricity and water reads on the generated types', () => {
  const acc = (id: string, status: 'active' | 'paused') => ({ id, name: id, status }) as Wire.EnergyAccount;
  const per = (state: Wire.EnergyBillSummary['state'] | null, total?: string) =>
    ({ from: '2026-10-01', to: '2026-10-31', bill: state ? ({ id: 'b', state, ...(total !== undefined ? { total } : {}) } as Wire.EnergyBillSummary) : null }) as Pick<Wire.EnergyAccountPeriod, 'bill'>;

  test('the bill screen offers the accounts that are not paused', () => {
    expect(billAccounts({ items: [acc('a', 'active'), acc('b', 'paused')] }).map((a) => a.id)).toEqual(['a']);
    expect(billAccounts({ items: [] })).toEqual([]);
  });

  test('previous bills: a bill without a total (no money permission), a draft, a void bill and no bill are left out', () => {
    const list = [per('paid', '320.10'), per('issued'), per('draft', '10'), per('void', '5'), per(null)];
    expect(billsWithTotal(list)).toEqual([list[0]]);
  });

  test('the status period null: no forecast (the screen shows the amount so far only)', () => {
    expect(billForecast(100, null, null)).toBeNull();
    expect(billForecast(null, '2026-11-01', '2026-11-30', new Date(2026, 10, 19))?.forecast).toBeNull();
  });

  test('the price per kWh: none without a fixed tariff, a current version, or a price', () => {
    const t = (kind: 'fixed' | 'tou', current: { price: string | null } | null) => ({ kind, current }) as Wire.EnergyTariff;
    expect(fixedTariffPrice({ items: [] })).toBeNull();
    expect(fixedTariffPrice({ items: [t('fixed', null)] })).toBeNull();
    expect(fixedTariffPrice({ items: [t('fixed', { price: null })] })).toBeNull();
    expect(fixedTariffPrice({ items: [t('tou', { price: null }), t('fixed', { price: '0' })] })).toBeNull();
    expect(fixedTariffPrice({ items: [t('tou', { price: null }), t('fixed', { price: '0.6402' })] })).toBe(0.6402);
  });

  test('water: no meter with a reading -> today / month null ("no data yet"), retired meters left out, a failed series -> null', () => {
    const m = (status: Wire.WaterMeter['status'], today_l: number | null, month_l: number | null) => ({ status, today_l, month_l });
    const none = waterView({ items: [m('active', null, null), m('paused', null, null)] }, { open_leaks: 0 }, {});
    expect(none).toEqual({ today: null, month: null, leaks: 0, week: null, meters: 2 });
    const some = waterView({ items: [m('active', 120, null), m('active', null, 3000), m('retired', 999, 999)] }, { open_leaks: 1 }, { series: [{ start: '2026-11-19T00:00:00', end: '2026-11-20T00:00:00', litres: null }] });
    expect(some.today).toBe(120);
    expect(some.month).toBe(3000);
    expect(some.leaks).toBe(1);
    expect(some.meters).toBe(2);
    expect(some.week?.[0].litres).toBeNull();
  });

  test('no electricity / water read in src/home types its answer by hand', () => {
    let reads = 0;
    for (const f of ['home/home-p3.ts', 'home/sw-home.ts']) {
      for (const m of src(f).matchAll(/get<(.+?)>\(\s*[`'"](?:energy|infra\/water)\//g)) {
        reads++;
        expect(m[1], `${f}: ${m[0]}`).toMatch(/^(Wire\.)?(Energy|Water)\w+$/);
      }
    }
    expect(reads).toBe(8); // accounts, status, periods; water status, meters, summary, consumption; tariffs
  });
});

test.describe('water accounts tiles', () => {
  test('sumOrNull: nothing with a value is null (a dash), values add up, null / absent are skipped', () => {
    expect(sumOrNull([])).toBeNull();
    expect(sumOrNull([null, undefined, ''])).toBeNull();
    expect(sumOrNull(['1.500', null, '2.250', undefined])).toBe(3.75);
    expect(sumOrNull(['0'])).toBe(0);
  });
});
