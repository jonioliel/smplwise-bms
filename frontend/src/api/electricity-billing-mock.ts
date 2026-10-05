/**
 * CR-023: the MOCK twin of the electricity billing API (the client is ./electricity-billing.ts). The fixture is the approved
 * mockup's content (docs/design/mockups/electricity/app.js): the same twelve meters, four customers, two tariffs, five accounts and
 * the bills of July-September 2026, with invented names and numbers only. It answers in the WIRE shapes of
 * ELECTRICITY_BILLING_API.md / ELECTRICITY_BILL_SNAPSHOT.md. Used when no backend answers (static preview, design review) and by
 * the Playwright specs. Mutations work and live for the page's session; nothing touches a network, a timer or a device.
 *
 * The rules applied here (arithmetic of CR-023 §7, numbering §10, lifecycle §11, overlap, money hiding) imitate the server for demo
 * purposes only; the server is the authority.
 *
 * The meter LIST is not answered here: the meters have one client (./electricity-meters.ts, whose demo adapter answers from
 * src/electricity/fixtures.ts with the same ids m1..m12 and names); the table below only feeds the kWh arithmetic of accounts and bills.
 *
 * Specs steer it through localStorage key `sw.demo.electricity` (JSON, read on every call):
 *   { "persona": "full" | "view" | "bills_only", "empty": true, "fail": "accounts|bills|customers|settings",
 *     "pdf_failed": true, "pdf_error": "pdf_timeout|...", "create_error": "formula_negative|tariff_missing|vat_missing|period_overlap", "latency": 0 }
 * "today" is fixed at 2026-10-04 (the mockup's today).
 */
import { ApiError } from './client';
import { buildHistory, buildStatus, demoControl, ERROR_TEXT, PDF_RETRYABLE } from './electricity-billing';
import type {
  Account, AccountBody, AccountHistoryWire, AccountRow, AccountStatusWire, AutoMode, Bill, BillAction, BillEvent, BillHistory, BillList, BillPdf, BillSnapshot, BillState, BillSummary, BillsQuery, BillingSettings,
  CalendarDay, CalendarYear, Customer, ElecBackend, FormulaPreview, HistoryPeriodWire, HistoryPoint, PeriodChoice, PriceMode, SnapshotLine, SnapshotTou, Tariff, TariffVersionBody, TariffVersionPlan, VatRates, StatusMeterWire,
} from './electricity-billing';
import { astToTokens, coefficients, evaluate, meterIdsOf, sentence, type FormulaAst } from '../electricity/elec-formula';
import { addDays, baseNumber, daysInclusive, isIsoDate, periodContaining, r2 } from '../electricity/elec-format';
import { bandsUsed, cloneDef, dayTypeOf, hoursBySeasonBand, israelTemplate, seasonOf, toMin, weekGrid, type TouCheck, type TouDefinition } from '../electricity/elec-tou';

export const MOCK_TODAY = '2026-10-04';
/** wire decimals: plain digits, never grouped */
const dec = (x: number): string => x.toFixed(2);
const VAT = 0.18;

const err = (status: number, code: string, user_message: string, details: Record<string, unknown> = {}): ApiError => new ApiError(status, { code, user_message, retryable: false, correlation_id: '', details });

// ------------------------------------------------------------------------------------------------ fixture

interface MM {
  id: string;
  name: string;
  area: string;
  floor: string;
  reading: number;
  today: number;
  month: number;
  last: number;
  status: 'ok' | 'stale' | 'paused';
}
const mm = (id: string, name: string, area: string, floor: string, reading: number, today: number, month: number, last: number, status: MM['status'] = 'ok'): MM => ({ id, name, area, floor, reading, today, month, last, status });
const meters: MM[] = [
  mm('m1', 'לוח ראשי - בניין', 'חדר חשמל', 'קומת קרקע', 248912.4, 612.3, 2410.7, 18240.5),
  mm('m2', 'לוח סטודיו', 'סטודיו אורן', 'קומה 1', 13264.2, 24.6, 98.1, 685.48),
  mm('m3', 'תאורת לובי', 'לובי', 'קומת קרקע', 4553.9, 10.1, 41.2, 302.4),
  mm('m4', 'מזגן משותף - קומה 1', 'מסדרון קומה 1', 'קומה 1', 9112.8, 31.4, 140.7, 1104.2),
  mm('m5', 'לוח גל-טק', 'משרדי גל-טק', 'קומה 2', 31770.25, 48.2, 181.6, 1360.3),
  mm('m6', 'לוח מאפייה - פאזה 1', 'מאפיית השקד', 'קומת קרקע', 18402.11, 41.3, 152.4, 1150.1),
  mm('m7', 'לוח מאפייה - פאזה 2', 'מאפיית השקד', 'קומת קרקע', 17995.4, 39.8, 146.9, 1098.6),
  mm('m8', 'לוח מאפייה - פאזה 3', 'מאפיית השקד', 'קומת קרקע', 18120.07, 22.1, 129.5, 1121.4, 'stale'),
  mm('m9', 'מעלית', 'לובי', 'קומת קרקע', 6240.66, 7.2, 27.8, 210.3),
  mm('m10', 'חניון - תאורה', 'חניון', 'חניון', 3880.2, 0, 0, 96.0, 'paused'),
  mm('m11', 'עמדת טעינה 1', 'חניון', 'חניון', 2104.9, 12.8, 46.3, 344.1),
  mm('m12', 'משאבות מים', 'חדר חשמל', 'קומת קרקע', 1560.33, 2.9, 11.6, 88.2),
];
const meter = (id: string): MM => meters.find((m) => m.id === id) ?? meters[0];
const STALE_AT = '2026-10-03T18:40:00Z';


type MCust = Omit<Customer, 'accounts' | 'bills' | 'account_count'>;
const cust = (id: string, no: string, name: string, address: string, phone: string, email: string, tax_id: string): MCust => ({ id, customer_number: no, name, revision: 1, address, phone, email, tax_id, notes: '' });
let customers: MCust[] = [
  cust('c1', '0001', 'סטודיו אורן לעיצוב', 'רחוב הדוגמה 12, קומה 1, עיר לדוגמה', '050-0000001', 'studio@example.co.il', ''),
  cust('c2', '0002', 'גל-טק פתרונות בע״מ', 'רחוב הדוגמה 12, קומה 2, עיר לדוגמה', '050-0000002', 'office@example.co.il', '510000001'),
  cust('c3', '0003', 'מאפיית השקד', 'רחוב הדוגמה 12, קומת קרקע, עיר לדוגמה', '050-0000003', 'bakery@example.co.il', ''),
  cust('c4', '0004', 'ועד הבית - בניין הדוגמה', 'רחוב הדוגמה 12, עיר לדוגמה', '050-0000004', 'vaad@example.co.il', ''),
];

const tv = (id: string, from: string, price: string, mode: PriceMode): Tariff['versions'][number] => ({ id, effective_from: from, price, price_mode: mode });
let tariffs: Tariff[] = [
  { id: 't1', name: 'תעריף מסחרי', currency: 'ILS', kind: 'fixed', used_by: 0, versions: [tv('t1v3', '2026-07-01', '0.5430', 'ex_vat'), tv('t1v2', '2026-01-01', '0.5384', 'ex_vat'), tv('t1v1', '2025-07-01', '0.5291', 'ex_vat')], current: null },
  { id: 't2', name: 'שטחים משותפים', currency: 'ILS', kind: 'fixed', used_by: 0, versions: [tv('t2v2', '2026-07-01', '0.6402', 'inc_vat'), tv('t2v1', '2026-01-01', '0.6353', 'inc_vat')], current: null },
];
/** Mock only: price versions a sealed bill used, with the end (exclusive) of the last sealed period. */
const SEALED_THROUGH: Record<string, string> = { t1v2: '2026-07-01', t2v1: '2026-04-01' };
let vatItems =[{ id: 'v2', effective_from: '2025-01-01', rate_percent: '18' }, { id: 'v1', effective_from: '2013-06-02', rate_percent: '17' }];

const F = (m: string): FormulaAst => ({ m });
const K = (k: string, m: string): FormulaAst => ({ op: '*', args: [{ n: k }, { m }] });
const bin = (op: '+' | '-', a: FormulaAst, b: FormulaAst): FormulaAst => ({ op, args: [a, b] });
const chain = (op: '+' | '-', ...xs: FormulaAst[]): FormulaAst => xs.slice(1).reduce((acc, x) => bin(op, acc, x), xs[0]);

interface MA {
  id: string;
  name: string;
  customer_id: string;
  ast: FormulaAst;
  tariff_id: string;
  months: 1 | 2;
  anchor_day: number;
  anchor_month: number;
  first: string;
  auto: AutoMode;
  revision: number;
}
let accounts: MA[] = [
  { id: 'a1', name: 'סטודיו אורן - קומה 1', customer_id: 'c1', ast: bin('+', F('m2'), K('0.3', 'm3')), tariff_id: 't1', months: 1, anchor_day: 1, anchor_month: 1, first: '2026-07-01', auto: 'draft', revision: 1 },
  { id: 'a2', name: 'משרדי גל-טק - קומה 2', customer_id: 'c2', ast: bin('+', F('m5'), K('0.5', 'm4')), tariff_id: 't1', months: 1, anchor_day: 1, anchor_month: 1, first: '2026-07-01', auto: 'draft', revision: 1 },
  { id: 'a5', name: 'גל-טק - עמדת טעינה', customer_id: 'c2', ast: F('m11'), tariff_id: 't1', months: 1, anchor_day: 1, anchor_month: 1, first: '2026-07-01', auto: 'issue', revision: 1 },
  { id: 'a3', name: 'מאפיית השקד', customer_id: 'c3', ast: chain('+', F('m6'), F('m7'), F('m8')), tariff_id: 't1', months: 2, anchor_day: 1, anchor_month: 1, first: '2026-07-01', auto: 'draft', revision: 1 },
  { id: 'a4', name: 'שטחים משותפים', customer_id: 'c4', ast: chain('-', F('m1'), F('m2'), F('m5'), F('m6'), F('m7'), F('m8'), F('m11')), tariff_id: 't2', months: 1, anchor_day: 1, anchor_month: 1, first: '2026-07-01', auto: 'off', revision: 1 },
];

const HIST: [string, number][] = [['2025-08', 695], ['2025-09', 671.8], ['2025-10', 702], ['2025-11', 688], ['2025-12', 731], ['2026-01', 805], ['2026-02', 842], ['2026-03', 790], ['2026-04', 655], ['2026-05', 610], ['2026-06', 690], ['2026-07', 845], ['2026-08', 812.4], ['2026-09', 776.2]];
/** Per account: how many previous periods exist (full, partial and "no data" cases), the scale, the same period last year (null = the account did not exist then), a missing / partial point. */
const SHAPE: Record<string, { factor: number; keep: number; ly: boolean; missing?: number; partial?: number }> = {
  a1: { factor: 1, keep: 12, ly: true },
  a2: { factor: 2.6, keep: 12, ly: true, missing: 5, partial: 1 },
  a5: { factor: 0.5, keep: 4, ly: false },
  a3: { factor: 8.4, keep: 3, ly: true },
  a4: { factor: 1, keep: 0, ly: false },
};
const monthEnd = (ym: string): string => `${ym}-${String(new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`;

/** The comparison series (CR-023 round 3). Never invented: a missing period has `kwh: null`; an account without history has none. */
function historyFor(accountId: string, current: { from: string; to: string; kwh: number } | null): BillHistory {
  const s = SHAPE[accountId] ?? { factor: 1, keep: 0, ly: false };
  const before = current ? HIST.filter(([ym]) => monthEnd(ym) < current.from) : HIST;
  const rows = s.keep ? before.slice(Math.max(0, before.length - s.keep)) : [];
  const previous: HistoryPoint[] = rows.map(([ym, v], i) => {
    const base = { from: `${ym}-01`, to: monthEnd(ym) };
    if (s.missing === i) return { ...base, kwh: null, status: 'missing', source: null };
    return { ...base, kwh: dec(v * s.factor), status: s.partial === i ? 'partial' : 'measured', source: i >= rows.length - 3 ? 'bill' : 'readings' };
  });
  let ly: HistoryPoint | null = null;
  if (s.ly && current) {
    const ym = `${Number(current.to.slice(0, 4)) - 1}-${current.to.slice(5, 7)}`;
    const h = HIST.find(([k]) => k === ym);
    if (h) ly = { from: `${ym}-01`, to: monthEnd(ym), kwh: dec(h[1] * s.factor), status: 'measured', source: 'readings' };
  }
  return { current: current ? { from: current.from, to: current.to, kwh: dec(current.kwh) } : null, previous, same_period_last_year: ly };
}

/** The account's ended regular periods, newest first (index 0 = the latest ended period), at most `n`. */
function endedPeriods(months: 1 | 2, day: number, month: number, n: number): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  let to = addDays(periodContaining(MOCK_TODAY, months, day, month).from, -1);
  for (let i = 0; i < n; i++) {
    const p = periodContaining(to, months, day, month);
    out.push({ from: p.from, to });
    to = addDays(p.from, -1);
  }
  return out;
}

/**
 * GET /energy/accounts/{aid}/history?past=N, imitated: the ENDED periods oldest first. kWh from an issued bill of exactly that period when there is
 * one (source bill), else from the readings (source readings: the fixture's monthly totals x the account's scale, as many periods back as SHAPE
 * keeps, with its missing / partial point), else null (missing: never invented). The periods start at the account's first period or at its
 * oldest readings, whichever is older. `comparison` is snapshot.history's shape for the latest ended period (independent of N).
 */
export function mockHistoryWire(accountId: string, past: number): AccountHistoryWire {
  const a = getAccWire(accountId);
  const s = SHAPE[a.id] ?? { factor: 1, keep: 0, ly: false };
  const anchorMonth = a.months === 2 ? a.anchor_month : 1;
  const all = endedPeriods(a.months, a.anchor_day, anchorMonth, 48).map((p, j) => ({ ...p, j }));
  const readings = (p: { from: string; to: string; j: number }): { kwh: string | null; status: HistoryPeriodWire['status'] } | null => {
    if (!s.keep || p.j > s.keep) return null;
    const i = s.keep - p.j; // index of the previous periods, oldest first (SHAPE's missing / partial)
    if (p.j > 0 && s.missing === i) return { kwh: null, status: 'missing' };
    let sum = 0;
    for (let ym = p.from.slice(0, 7); ym <= p.to.slice(0, 7); ym = addDays(`${ym}-28`, 7).slice(0, 7)) {
      const h = HIST.find(([k]) => k === ym);
      if (!h) return null;
      sum += h[1];
    }
    return { kwh: dec(sum * s.factor), status: p.j > 0 && s.partial === i ? 'partial' : 'measured' };
  };
  const wire = (p: { from: string; to: string; j: number }): HistoryPeriodWire => {
    const b = bills.find((x) => x.account_id === a.id && x.state !== 'draft' && x.state !== 'void' && x.period.from === p.from && x.period.to === p.to);
    if (b) return { from: p.from, to: p.to, kwh: b.kwh, status: 'measured', source: 'bill', bill: summary(b) };
    const r = readings(p);
    if (r && r.kwh !== null) return { from: p.from, to: p.to, kwh: r.kwh, status: r.status, source: 'readings', bill: null };
    return { from: p.from, to: p.to, kwh: null, status: 'missing', source: null, bill: null };
  };
  const ofAccount = all.filter((p) => p.to >= a.first || (s.keep > 0 && p.j <= s.keep)).map(wire);
  const periods = ofAccount.slice(0, Math.max(1, Math.min(24, past))).reverse();
  const latest = ofAccount[0];
  const point = (p: HistoryPeriodWire): HistoryPoint => ({ from: p.from, to: p.to, kwh: p.kwh, status: p.status, source: p.source });
  let ly: HistoryPoint | null = null;
  if (latest) {
    const from = `${Number(latest.from.slice(0, 4)) - 1}${latest.from.slice(4)}`;
    const hit = ofAccount.find((p) => p.from === from && p.kwh !== null);
    if (hit) ly = point(hit);
  }
  return {
    periods,
    comparison: {
      current: latest && latest.kwh !== null ? { from: latest.from, to: latest.to, kwh: latest.kwh } : null,
      previous: ofAccount.slice(1, 13).reverse().map(point),
      same_period_last_year: ly,
    },
  };
}

// ------------------------------------------------------------------------------------------------ arithmetic (CR-023 §7)

const tariff = (id: string): Tariff => {
  const t = tariffs.find((x) => x.id === id) ?? tariffs[0];
  return { ...t, current: t.versions[0] ?? null, used_by: accounts.filter((a) => a.tariff_id === t.id).length };
};
const vatRate = (): number => Number(vatItems[0].rate_percent) / 100 || VAT;
const exPrice = (v: { price: string | null; price_mode: PriceMode }): number => (v.price_mode === 'ex_vat' ? Number(v.price) : Number(v.price) / (1 + vatRate()));
function charge(t: Tariff, kwh: number): { amount: number; vat: number; total: number } {
  const v = t.versions[0];
  if (v.price_mode === 'ex_vat') {
    const amount = r2(kwh * Number(v.price));
    const vat = r2(amount * vatRate());
    return { amount, vat, total: r2(amount + vat) };
  }
  const total = r2(kwh * Number(v.price));
  const amount = r2(total / (1 + vatRate()));
  return { amount, vat: r2(total - amount), total };
}

// ------------------------------------------------------------------------------------------------ EL5: time-of-use (demo arithmetic)

/** The generated Israeli special days the server computes for 2026-2027 (energy_calendar.israel_special_days), copied for the demo. */
const GENERATED_DAYS: [string, 'holiday' | 'holiday_eve', string][] = [
  ['2026-04-01', 'holiday_eve', 'ערב פסח'], ['2026-04-02', 'holiday', 'פסח'], ['2026-04-07', 'holiday_eve', 'ערב שביעי של פסח'], ['2026-04-08', 'holiday', 'שביעי של פסח'],
  ['2026-04-21', 'holiday_eve', 'יום הזיכרון (ערב יום העצמאות)'], ['2026-04-22', 'holiday', 'יום העצמאות'], ['2026-05-21', 'holiday_eve', 'ערב שבועות'], ['2026-05-22', 'holiday', 'שבועות'],
  ['2026-09-11', 'holiday_eve', 'ערב ראש השנה'], ['2026-09-12', 'holiday', 'ראש השנה'], ['2026-09-13', 'holiday', 'ראש השנה (יום שני)'], ['2026-09-20', 'holiday_eve', 'ערב יום כיפור'],
  ['2026-09-21', 'holiday', 'יום כיפור'], ['2026-09-25', 'holiday_eve', 'ערב סוכות'], ['2026-09-26', 'holiday', 'סוכות'], ['2026-10-02', 'holiday_eve', 'הושענא רבה'],
  ['2026-10-03', 'holiday', 'שמיני עצרת ושמחת תורה'], ['2027-04-21', 'holiday_eve', 'ערב פסח'], ['2027-04-22', 'holiday', 'פסח'], ['2027-04-27', 'holiday_eve', 'ערב שביעי של פסח'],
  ['2027-04-28', 'holiday', 'שביעי של פסח'], ['2027-05-11', 'holiday_eve', 'יום הזיכרון (ערב יום העצמאות)'], ['2027-05-12', 'holiday', 'יום העצמאות'], ['2027-06-10', 'holiday_eve', 'ערב שבועות'],
  ['2027-06-11', 'holiday', 'שבועות'], ['2027-10-01', 'holiday_eve', 'ערב ראש השנה'], ['2027-10-02', 'holiday', 'ראש השנה'], ['2027-10-03', 'holiday', 'ראש השנה (יום שני)'],
  ['2027-10-10', 'holiday_eve', 'ערב יום כיפור'], ['2027-10-11', 'holiday', 'יום כיפור'], ['2027-10-15', 'holiday_eve', 'ערב סוכות'], ['2027-10-16', 'holiday', 'סוכות'],
  ['2027-10-22', 'holiday_eve', 'הושענא רבה'], ['2027-10-23', 'holiday', 'שמיני עצרת ושמחת תורה'],
];
const KIND_HE: Record<CalendarDay['kind'], string> = { holiday: 'חג', holiday_eve: 'ערב חג', regular: 'יום רגיל' };
let calendar: { revision: number; generator: 'israel' | 'none'; overrides: Record<string, { kind: CalendarDay['kind']; name_he: string }> } = { revision: 0, generator: 'israel', overrides: {} };
function calendarEntry(iso: string): CalendarDay | null {
  const o = calendar.overrides[iso];
  const g = calendar.generator === 'israel' ? GENERATED_DAYS.find((x) => x[0] === iso) : undefined;
  const gen = g ? { date: g[0], kind: g[1], kind_he: KIND_HE[g[1]], name_he: g[2], source: 'generated' } : null;
  if (o) return { date: iso, kind: o.kind, kind_he: KIND_HE[o.kind], name_he: o.name_he, source: 'manual', generated: gen };
  return g ? { date: g[0], kind: g[1], kind_he: KIND_HE[g[1]], name_he: g[2], source: 'generated', generated: null } : null;
}
const specialOf = (iso: string): 'holiday' | 'holiday_eve' | null => {
  const e = calendarEntry(iso);
  return e && e.kind !== 'regular' ? e.kind : null;
};
function calendarYear(year: number, extra: Partial<CalendarYear> = {}): CalendarYear {
  const dates = new Set<string>([...GENERATED_DAYS.map((x) => x[0]), ...Object.keys(calendar.overrides)].filter((d) => d.startsWith(`${year}-`)));
  const days = [...dates].sort().map((d) => calendarEntry(d)).filter((x): x is CalendarDay => x !== null);
  return { year, revision: calendar.revision, generator: calendar.generator, days, note_he: 'רשימת החגים מחושבת לפי הלוח העברי. יש לאשר אותה מול חשבון חשמל אמיתי.', ...extra };
}

/** Demo pricing of a time-of-use bill: the period's kWh split by the clock hours of every season and band (a flat load), each line priced
 * with its band price under the version's mode, the totals the sums of the rounded lines (the server measures the real split). */
function touBill(t: Tariff, from: string, to: string, kwh: number): { lines: SnapshotLine[]; tou: SnapshotTou } {
  const v = t.versions[0];
  const d = v.definition as TouDefinition;
  const hours = hoursBySeasonBand(d, from, to, specialOf);
  const all = [...hours.values()].reduce((s, x) => s + x, 0) || 1;
  const rate = vatRate();
  const lines: SnapshotLine[] = [];
  for (const s of d.seasons)
    for (const b of d.bands) {
      const h = hours.get(`${s.id}|${b.id}`);
      if (!h) continue;
      const k = r2((kwh * h) / all);
      const price = Number(d.prices[s.id]?.[b.id] ?? 0);
      let amount: number;
      let vat: number;
      let total: number;
      if (v.price_mode === 'ex_vat') {
        amount = r2(k * price);
        vat = r2(amount * rate);
        total = r2(amount + vat);
      } else {
        total = r2(k * price);
        amount = r2(total / (1 + rate));
        vat = r2(total - amount);
      }
      lines.push({ from, to, kwh: dec(k), price_entered: price.toFixed(4), price_mode: v.price_mode, unit_price_ex_vat: (v.price_mode === 'ex_vat' ? price : price / (1 + rate)).toFixed(4), amount_ex_vat: dec(amount), vat_rate_percent: String(rate * 100), vat_amount: dec(vat), total: dec(total), season: { id: s.id, name_he: s.name_he }, band: { id: b.id, name_he: b.name_he }, hours: dec(h) });
    }
  const byBand = d.bands.map((b) => {
    const mine = lines.filter((l) => l.band?.id === b.id);
    const sum = (k: 'kwh' | 'amount_ex_vat' | 'total' | 'hours') => dec(mine.reduce((acc, l) => acc + Number(l[k] ?? 0), 0));
    return { band: { id: b.id, name_he: b.name_he }, kwh: sum('kwh'), amount_ex_vat: sum('amount_ex_vat'), total: sum('total'), hours: sum('hours') };
  }).filter((x) => Number(x.hours) > 0);
  const grid = weekGrid(d);
  const daily: SnapshotTou['daily'] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const season = seasonOf(d, day);
    const dtype = dayTypeOf(d, day, specialOf(day));
    const per = new Map<string, number>();
    for (const c of grid[season]?.[dtype] ?? []) per.set(c.band, (per.get(c.band) ?? 0) + (toMin(c.to) - toMin(c.from)) / 60);
    const e = calendarEntry(day);
    daily.push({ date: day, season, day_type: dtype, kwh: dec((kwh * 24) / all), bands: d.bands.filter((b) => per.has(b.id)).map((b) => ({ band: b.id, kwh: dec((kwh * (per.get(b.id) ?? 0)) / all) })), special: e && e.kind !== 'regular' ? { kind: e.kind, name_he: e.name_he } : null });
  }
  const names = { seasons: Object.fromEntries(d.seasons.map((s) => [s.id, s.name_he])), day_types: Object.fromEntries(d.day_types.map((x) => [x.id, x.name_he])), bands: Object.fromEntries(d.bands.map((b) => [b.id, b.name_he])) };
  const years = [...new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))])];
  const special = years.flatMap((y) => calendarYear(y).days).filter((x) => x.date >= from && x.date <= to).map((x) => ({ date: x.date, kind: x.kind, kind_he: x.kind_he, name_he: x.name_he, source: x.source }));
  return { lines, tou: { engine: 'arx.energy.tou/1', names, versions: [{ tariff_version_id: v.id, effective_from: v.effective_from, price_mode: v.price_mode, definition: d, definition_sha256: v.definition_sha256 ?? '' }], special_days: special, by_band: byBand, daily } };
}
/** The amount of `kwh` in a period of an account (fixed or time-of-use). */
function amountOf(a: MA, from: string, to: string, kwh: number): string {
  const t = tariff(a.tariff_id);
  if (t.kind === 'tou') return dec(touBill(t, from, to, kwh).lines.reduce((s, l) => s + Number(l.total), 0));
  return dec(charge(t, kwh).total);
}
/** A light imitation of the server's check (the server is the authority): every price a season can use, ranges on quarter hours. */
function mockCheck(d: TouDefinition): TouCheck {
  const errors: TouCheck['errors'] = [];
  for (const s of d.seasons)
    for (const [did, ranges] of Object.entries(d.schedule[s.id] ?? {}))
      ranges.forEach((r, j) => {
        for (const x of [r[0], r[1]]) if (!(toMin(x) % 15 === 0)) errors.push({ code: 'time_quarter', path: `schedule.${s.id}.${did}[${j}]`, message: 'השעות חייבות להיות ברבעי שעה (00, 15, 30, 45), כמו נתוני המונים.' });
        if (r[0] === r[1]) errors.push({ code: 'empty_range', path: `schedule.${s.id}.${did}[${j}]`, message: 'שעת ההתחלה שווה לשעת הסיום.' });
      });
  for (const s of d.seasons)
    for (const b of bandsUsed(d, s.id)) {
      const p = d.prices[s.id]?.[b];
      if (p === null || p === undefined || p === '' || !/^\d+(\.\d{1,4})?$/.test(String(p))) {
        errors.push({ code: p === null || p === undefined ? 'price_missing' : 'price', path: `prices.${s.id}.${b}`, message: `חסר מחיר ל${d.bands.find((x) => x.id === b)?.name_he ?? b} ב${s.name_he}.` });
      }
    }
  const ok = errors.length === 0;
  const sha = ok ? `demo${JSON.stringify(d).length.toString(16).padStart(60, '0')}` : null;
  return { ok, errors: errors.slice(0, 1), definition: ok ? cloneDef(d) : null, definition_sha256: sha, grid: weekGrid(d) };
}

/** kWh of one meter in a period: the fixture's last-period value for the whole of September, the month-to-date value for 1-4 October, a daily average otherwise. */
function meterKwh(m: MM, from: string, to: string): number {
  if (from === '2026-09-01' && to === '2026-09-30') return m.last;
  if (from === '2026-10-01' && to === MOCK_TODAY) return m.month;
  return r2((m.last / 30) * daysInclusive(from, to));
}
const periodKwh = (a: MA, from: string, to: string): number => r2(evaluate(a.ast, (id) => meterKwh(meter(id), from, to)));
const nameOf = (id: string): string => meter(id).name;
const textOf = (ast: FormulaAst): string => astToTokens(ast).map((t) => (t.t === 'm' ? `[${nameOf(t.id)}]` : t.t === 'n' ? t.v + (t.pct ? '%' : '') : t.v)).join(' ').replace(/\( /g, '(').replace(/ \)/g, ')');
const sentenceOf = (ast: FormulaAst): string => sentence(astToTokens(ast), nameOf);

// ------------------------------------------------------------------------------------------------ settings, bills

let settings: BillingSettings = {
  revision: 1,
  default_price_mode: 'ex_vat',
  payment_terms: { mode: 'net_days', days: 14, day_of_month: 15 },
  business: { name: 'נכסי הדוגמה בע״מ', registration_no: '510000000', address: 'רחוב הדוגמה 12, עיר לדוגמה', phone: '03-0000000', email: 'billing@example.co.il', accent_color: '#2767ed', footer_note: 'התשלום בהעברה בנקאית לפי פרטי ההסכם.' },
  numbering: { customer_digits: 4, format: 'YYYY-MM-NNNN' },
  auto: { delay_hours: 6 },
  logo: null,
  pdf_engine: { configured: 'auto', active: 'weasyprint', checked: `${MOCK_TODAY}T06:00:00Z`, detail: null, last_render_engine: 'weasyprint', slow_fallbacks: 0, crash_fallbacks: 0, fallback_after_s: 20 },
};
let logoDataUrl = '';

function dueDate(issue: string): string {
  const p = settings.payment_terms;
  if (p.mode === 'net_days') return addDays(issue, p.days);
  const y = Number(issue.slice(0, 4));
  const m = Number(issue.slice(5, 7));
  const d = Number(issue.slice(8, 10));
  const idx = d < p.day_of_month ? y * 12 + (m - 1) : y * 12 + m;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}-${String(p.day_of_month).padStart(2, '0')}`;
}

const custOf = (id: string): MCust => customers.find((c) => c.id === id) ?? customers[0];
const accOf = (id: string): MA => accounts.find((a) => a.id === id) as MA;
const ref = (c: MCust) => ({ id: c.id, customer_number: c.customer_number, name: c.name });

interface StoredBill extends Bill {
  _events: { at: string; text: string }[];
}
let bills: StoredBill[] = [];
let billSeq = 100;

function buildSnapshot(a: MA, from: string, to: string, number: string | null, state: string, issue: string | null, replaces: { bill_id: string; number: string } | null, revision: number, kwhOverride?: number): BillSnapshot {
  const t = tariff(a.tariff_id);
  const c = custOf(a.customer_id);
  const kwh = kwhOverride ?? periodKwh(a, from, to);
  const tb = t.kind === 'tou' ? touBill(t, from, to, kwh) : null;
  const sumOf = (k: 'amount_ex_vat' | 'vat_amount' | 'total'): number => r2((tb?.lines ?? []).reduce((s, l) => s + Number(l[k]), 0));
  const ch = tb ? { amount: sumOf('amount_ex_vat'), vat: sumOf('vat_amount'), total: sumOf('total') } : charge(t, kwh);
  const coef = coefficients(a.ast);
  const ids = meterIdsOf(a.ast);
  const notes: BillSnapshot['notes'] = [];
  const mlines = ids.map((id) => {
    const m = meter(id);
    const use = kwhOverride !== undefined ? r2(meterKwh(m, from, to)) : meterKwh(m, from, to);
    const end = r2(m.reading - (to === MOCK_TODAY ? 0 : m.month));
    const k = coef[id] ?? 1;
    const stale = m.status === 'stale';
    if (stale) notes.push({ code: 'meter_not_reporting', text_he: `${m.name} לא מדווח מאז 03.10.2026 18:40. הצריכה שלאחר מכן תחויב בחיוב הבא.` });
    return {
      meter_id: id, name: m.name, coefficient: String(k),
      start: { at: `${from}T00:00:00Z`, reading_kwh: dec(r2(end - use)), kind: 'reading' },
      end: { at: stale ? STALE_AT : `${to}T23:59:00Z`, reading_kwh: dec(end), kind: stale ? 'last_report' : 'reading' },
      consumption_kwh: dec(use), contribution_kwh: dec(use * k), reported_to_end: !stale, last_report_at: stale ? STALE_AT : null,
    };
  });
  if (mlines.some((x) => !x.reported_to_end)) notes.push({ code: 'carried_in', text_he: 'לוח מאפייה - פאזה 3 לא דיווח בין 28.09 18:40 ל-29.09 07:10. הצריכה בפער נספרה לפי הקריאה הבאה.' });
  const unit = tb ? 0 : exPrice(t.versions[0]);
  return {
    schema: 'arx.energy.bill_snapshot/1',
    doc: { title_he: 'חשבון צריכת חשמל ודרישת תשלום', subtitle_he: 'אינו חשבונית מס', is_tax_invoice: false },
    bill: {
      id: '', number, revision, replaces, state, issue_date: issue, due_date: issue ? dueDate(issue) : null, expected_due_date: dueDate(issue ?? MOCK_TODAY),
      payment_terms: { mode: settings.payment_terms.mode, days: settings.payment_terms.days, day_of_month: settings.payment_terms.day_of_month },
    },
    period: { from, to, days: daysInclusive(from, to) },
    business: { ...settings.business, logo: settings.logo ? { sha256: settings.logo.sha256, mime: settings.logo.mime } : null },
    customer: { id: c.id, customer_number: c.customer_number, name: c.name, address: c.address ?? '', phone: c.phone ?? '', email: c.email ?? '', tax_id: c.tax_id ?? '' },
    account: { id: a.id, name: a.name, tariff: { id: t.id, name: t.name, kind: t.kind }, formula: { text: textOf(a.ast), sentence_he: sentenceOf(a.ast) } },
    meters: mlines,
    lines: tb ? tb.lines : [{ from, to, kwh: dec(kwh), price_entered: t.versions[0].price ?? '0', price_mode: t.versions[0].price_mode, unit_price_ex_vat: unit.toFixed(4), amount_ex_vat: dec(ch.amount), vat_rate_percent: String(vatRate() * 100), vat_amount: dec(ch.vat), total: dec(ch.total) }],
    ...(tb ? { tou: tb.tou } : {}),
    totals: {
      currency: 'ILS', kwh: tb ? dec(tb.lines.reduce((s, l) => s + Number(l.kwh), 0)) : dec(kwh), amount_ex_vat: dec(ch.amount), vat_amount: dec(ch.vat), total: dec(ch.total), vat_breakdown: [{ rate_percent: String(vatRate() * 100), base: dec(ch.amount), vat: dec(ch.vat) }],
      price_mode_note_he: t.versions[0].price_mode === 'inc_vat' ? 'המחיר נקבע כולל מע״מ' : null,
    },
    notes,
    history: historyFor(a.id, { from, to, kwh }),
    meta: { software_version: '0.1.157', computed_at: `${MOCK_TODAY}T09:30:00Z` },
  };
}

const ACTIONS: Record<BillState, BillAction[]> = {
  draft: ['recalculate', 'delete', 'issue', 'pdf'],
  issued: ['sent', 'paid', 'correct', 'void', 'pdf'],
  sent: ['paid', 'correct', 'void', 'pdf'],
  paid: ['correct', 'pdf'],
  void: ['pdf'],
};

function numberBase(to: string, customerNo: string): string {
  return `${to.slice(0, 7)}-${customerNo}`;
}
/** `YYYY-MM-CCCC[/S][-R]`: the running suffix when another bill already took the base. */
function nextNumber(to: string, customerNo: string, revisionOf: string | null, revision: number): string {
  if (revisionOf) return `${baseNumber(revisionOf)}-${revision}`;
  const base = numberBase(to, customerNo);
  const taken = bills.filter((b) => b.number && (b.number === base || b.number.startsWith(`${base}/`) || b.number.startsWith(`${base}-`))).length;
  return taken ? `${base}/${taken + 1}` : base;
}

function pushBill(o: { a: string; from: string; to: string; kwh: number; state: BillState; issued: string | null; number: string | null; revision?: number; replaces?: StoredBill | null; reason?: string; events?: StoredBill['_events']; origin?: 'manual' | 'auto' }): StoredBill {
  const a = accOf(o.a);
  const c = custOf(a.customer_id);
  const id = `b${++billSeq}`;
  const rep = o.replaces ? { bill_id: o.replaces.id, number: o.replaces.number as string } : null;
  const snap = buildSnapshot(a, o.from, o.to, o.number, o.state === 'draft' ? 'draft' : 'issued', o.issued, rep, o.revision ?? 1, o.kwh);
  snap.bill.id = id;
  const total = snap.totals.total;
  const b: StoredBill = {
    id, account_id: a.id, account_name: a.name, customer: ref(c), number: o.number, revision: o.revision ?? 1, state: o.state, origin: o.origin ?? 'manual', period: { from: o.from, to: o.to },
    issue_date: o.issued, due_date: o.issued ? dueDate(o.issued) : null, kwh: dec(o.kwh), total, replaces_bill_id: rep?.bill_id ?? null, replaced_by_bill_id: null, row_version: 1,
    snapshot: snap, snapshot_sha256: o.state === 'draft' ? null : 'a3f9c21e0b7d4455aa10c3d1e9f8b2c7', sent: null, paid: null, void: null, actions: ACTIONS[o.state], _events: o.events ?? [],
  };
  // sent / paid carry a DATE (YYYY-MM-DD), not a datetime
  if (o.state === 'sent' || o.state === 'paid') b.sent = { at: o.issued as string, how: 'email', note: '' };
  if (o.state === 'paid') b.paid = { at: addDays(o.issued as string, 3), reference: '' };
  if (o.state === 'void') b.void = { at: `${addDays(o.issued as string, 2)}T11:30:00Z`, reason: o.reason ?? '' };
  bills.push(b);
  return b;
}

/** Demo control `tou: true` (EL5): the shared-areas account a4 bills on a time-of-use tariff, so its bills show band lines. Off by default,
 * so every other spec sees the original fixture. */
function seedTou(): void {
  if (!demoControl().tou) return;
  if (!tariffs.some((t) => t.id === 't9')) {
    const d = israelTemplate();
    d.prices = { summer: { offpeak: '0.4823', peak: '1.6895' }, winter: { offpeak: '0.4512', peak: '1.2047' }, transition: { offpeak: '0.4630', peak: '0.8934' } };
    tariffs = [...tariffs, { id: 't9', name: 'תעו״ז ביתי', currency: 'ILS', kind: 'tou', used_by: 0, current: null, versions: [{ id: 't9v1', effective_from: '2026-01-01', price: null, price_mode: 'ex_vat', definition: d, definition_sha256: 'demo-t9v1' }] }];
  }
  accOf('a4').tariff_id = 't9';
}

function seedBills(): void {
  seedTou();
  bills = [];
  billSeq = 100;
  const k = (a: string, f: string, t: string) => periodKwh(accOf(a), f, t);
  const ev = (...t: [string, string][]) => t.map(([at, text]) => ({ at, text }));
  pushBill({ a: 'a4', from: '2026-09-01', to: '2026-09-30', kwh: k('a4', '2026-09-01', '2026-09-30'), state: 'draft', issued: null, number: null, origin: 'auto', events: ev(['2026-10-01T06:00', 'טיוטה נוצרה אוטומטית']) });
  pushBill({ a: 'a1', from: '2026-09-01', to: '2026-09-30', kwh: k('a1', '2026-09-01', '2026-09-30'), state: 'sent', issued: '2026-10-02', number: '2026-09-0001', events: ev(['2026-10-02T09:12', 'הונפק'], ['2026-10-02T10:00', 'סומן כנשלח בדוא״ל']) });
  pushBill({ a: 'a2', from: '2026-09-01', to: '2026-09-30', kwh: k('a2', '2026-09-01', '2026-09-30'), state: 'paid', issued: '2026-10-02', number: '2026-09-0002', events: ev(['2026-10-02T09:12', 'הונפק'], ['2026-10-05T10:40', 'סומן כשולם']) });
  pushBill({ a: 'a5', from: '2026-09-01', to: '2026-09-30', kwh: k('a5', '2026-09-01', '2026-09-30'), state: 'issued', issued: '2026-10-02', number: '2026-09-0002/2', events: ev(['2026-10-02T09:12', 'הונפק']) });
  const old = pushBill({ a: 'a1', from: '2026-08-01', to: '2026-08-31', kwh: 1812.4, state: 'void', issued: '2026-09-02', number: '2026-08-0001', reason: 'קריאת סוף תקופה שגויה, הוחלף ב-2026-08-0001-2', events: ev(['2026-09-02T09:12', 'הונפק'], ['2026-09-04T11:30', 'בוטל: קריאת סוף תקופה שגויה'], ['2026-09-06T08:05', 'הוחלף ב-2026-08-0001-2']) });
  const rev = pushBill({ a: 'a1', from: '2026-08-01', to: '2026-08-31', kwh: 812.4, state: 'paid', issued: '2026-09-06', number: '2026-08-0001-2', revision: 2, replaces: old, events: ev(['2026-09-06T08:05', 'הונפק, מחליף את 2026-08-0001'], ['2026-09-09T10:40', 'סומן כשולם']) });
  old.replaced_by_bill_id = rev.id;
  pushBill({ a: 'a2', from: '2026-08-01', to: '2026-08-31', kwh: 2004.1, state: 'paid', issued: '2026-09-02', number: '2026-08-0002', events: ev(['2026-09-02T09:12', 'הונפק']) });
  pushBill({ a: 'a5', from: '2026-08-01', to: '2026-08-31', kwh: 401.7, state: 'paid', issued: '2026-09-02', number: '2026-08-0002/2', events: ev(['2026-09-02T09:12', 'הונפק']) });
  pushBill({ a: 'a3', from: '2026-07-01', to: '2026-08-31', kwh: 6880.5, state: 'paid', issued: '2026-09-02', number: '2026-08-0003', events: ev(['2026-09-02T09:12', 'הונפק']) });
  pushBill({ a: 'a4', from: '2026-08-01', to: '2026-08-31', kwh: 13104.9, state: 'paid', issued: '2026-09-02', number: '2026-08-0004', events: ev(['2026-09-02T09:12', 'הונפק']) });
  pushBill({ a: 'a1', from: '2026-07-01', to: '2026-07-31', kwh: 845.0, state: 'paid', issued: '2026-08-03', number: '2026-07-0001', events: ev(['2026-08-03T09:12', 'הונפק']) });
  pushBill({ a: 'a2', from: '2026-07-01', to: '2026-07-31', kwh: 2120.8, state: 'paid', issued: '2026-08-03', number: '2026-07-0002', events: ev(['2026-08-03T09:12', 'הונפק']) });
}
seedBills();

// ------------------------------------------------------------------------------------------------ helpers

async function tick(): Promise<void> {
  const l = demoControl().latency;
  if (l) await new Promise((r) => setTimeout(r, l));
  else await Promise.resolve();
}
const persona = () => demoControl().persona ?? 'full';
const moneyAllowed = () => persona() !== 'view';
const guardMoney = (): void => {
  if (!moneyAllowed()) throw err(403, 'forbidden', 'אין הרשאה לחיובים.');
};
const guardManage = (): void => {
  if (persona() !== 'full') throw err(403, 'forbidden', 'אין הרשאה לניהול.');
};
const failIf = (kind: string): void => {
  if (demoControl().fail === kind) throw err(500, 'internal', 'לא ניתן לטעון את הנתונים.');
};
const fullCust = (c: MCust, deep = false): Customer => {
  const accs = accounts.filter((a) => a.customer_id === c.id);
  const out: Customer = { ...c, account_count: accs.length };
  if (!moneyAllowed()) {
    delete out.address;
    delete out.phone;
    delete out.email;
    delete out.tax_id;
    delete out.notes;
  }
  if (deep) {
    out.accounts = accs.map((a) => ({ id: a.id, name: a.name, status: 'active' }));
    if (moneyAllowed()) out.bills = bills.filter((b) => b.customer.id === c.id).slice(0, 24).map(summary);
  }
  return out;
};
const summary = (b: StoredBill): BillSummary => {
  const { snapshot: _s, snapshot_sha256: _h, sent: _a, paid: _b, void: _c, actions: _d, _events: _e, ...rest } = b;
  void [_s, _h, _a, _b, _c, _d, _e];
  return moneyAllowed() ? rest : { ...rest, total: '' };
};
const lastBill = (accountId: string): StoredBill | null => bills.filter((b) => b.account_id === accountId && b.state !== 'void').sort((x, y) => (x.period.to < y.period.to ? 1 : -1))[0] ?? null;

function wireAccount(a: MA): Account {
  const c = custOf(a.customer_id);
  const last = lastBill(a.id);
  const from = addDays(last ? last.period.to : addDays(a.first, -1), 1);
  const p = periodContaining(from, a.months, a.anchor_day, a.anchor_month);
  const t = tariff(a.tariff_id);
  return {
    id: a.id, name: a.name, customer: ref(c),
    formula: { ast: a.ast, text: textOf(a.ast), sentence_he: sentenceOf(a.ast), meter_ids: meterIdsOf(a.ast) },
    tariff: moneyAllowed() ? { id: t.id, name: t.name, kind: t.kind, price: t.kind === 'tou' ? null : t.versions[0].price, price_mode: t.versions[0].price_mode } : { id: t.id, name: t.name, kind: t.kind },
    period_months: a.months, period_anchor_day: a.anchor_day, period_anchor_month: a.anchor_month, first_period_start: a.first, timezone: 'Asia/Jerusalem', auto_mode: a.auto, status: 'active', revision: a.revision,
    next_period: { from, to: p.to }, last_bill: last && moneyAllowed() ? summary(last) : null,
  };
}
const getAccWire = (id: string): MA => {
  const a = accounts.find((x) => x.id === id);
  if (!a) throw err(404, 'not_found', 'החשבון לא נמצא.');
  return a;
};
const getBillRaw = (id: string): StoredBill => {
  const b = bills.find((x) => x.id === id);
  if (!b) throw err(404, 'not_found', 'החיוב לא נמצא.');
  return b;
};
/** bills whose PDF was produced on request in this session (stored), and the last failed attempt per bill */
const pdfStored = new Set<string>();
const pdfFailedAt = new Map<string, { code: string; at: string }>();
function pdfOf(b: StoredBill): BillPdf {
  const ctl = demoControl();
  if (ctl.pdf_error === 'pdf_unavailable') return { state: 'unavailable', error_code: null, failed_at: null, engine: null };
  const last = pdfFailedAt.get(b.id);
  if (last) return { state: 'failed', error_code: last.code, failed_at: last.at, engine: 'weasyprint' };
  if (b.state !== 'draft' && ctl.pdf_failed && !pdfStored.has(b.id)) return { state: 'failed', error_code: 'pdf_render_failed', failed_at: `${MOCK_TODAY}T09:31:00Z`, engine: 'weasyprint' };
  return b.state === 'draft' ? { state: 'ready', error_code: null, failed_at: null, engine: null } : { state: 'stored', error_code: null, failed_at: null, engine: 'weasyprint' };
}
const full = (b: StoredBill): Bill => {
  const { _events: _e, ...rest } = b;
  void _e;
  return { ...rest, actions: ACTIONS[b.state], total: b.total, pdf: pdfOf(b) };
};
const log = (b: StoredBill, text: string): void => {
  b._events.push({ at: `${MOCK_TODAY}T09:30`, text });
  b.row_version += 1;
};
/** `row_version` given and not the bill's: someone changed the bill meanwhile */
const staleVersion = (b: StoredBill, v: number | undefined): void => {
  if (v !== undefined && v !== b.row_version) throw err(409, 'revision_conflict', 'החיוב השתנה בינתיים. רעננו ונסו שוב.');
};
const overlaps = (accountId: string, from: string, to: string): StoredBill | undefined =>
  bills.find((b) => b.account_id === accountId && b.state !== 'void' && b.state !== 'draft' && !(to < b.period.from || from > b.period.to));

function validateCustomer(c: { name: string; email?: string; customer_number?: string }, selfId: string | null): void {
  if (!c.name.trim()) throw err(422, 'validation', 'צריך לכתוב שם ללקוח.', { fields: { name: 'צריך לכתוב שם ללקוח' } });
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) throw err(422, 'validation', 'כתובת דוא״ל לא תקינה', { fields: { email: 'כתובת דוא״ל לא תקינה' } });
  if (c.customer_number && customers.some((x) => x.customer_number === c.customer_number && x.id !== selfId)) throw err(409, 'customer_number_taken', 'מספר הלקוח כבר בשימוש.');
}

// ------------------------------------------------------------------------------------------------ the backend

const statusWire = (a: MA): AccountStatusWire => {
  const per = periodContaining(MOCK_TODAY, a.months, a.anchor_day, a.anchor_month);
  const ids = meterIdsOf(a.ast);
  const kwh = periodKwh(a, per.from, MOCK_TODAY);
  const w: AccountStatusWire = {
    period: { from: per.from, to: per.to },
    kwh_so_far: dec(kwh),
    meters: ids.map((id): StatusMeterWire => {
      const m = meter(id);
      const use = meterKwh(m, per.from, MOCK_TODAY);
      return { meter_id: id, name: m.name, kwh: dec(use), last_report_at: m.status === 'stale' ? STALE_AT : `${MOCK_TODAY}T21:49:00Z`, reporting: m.status !== 'stale', start_reading_kwh: dec(r2(m.reading - use)), end_reading_kwh: dec(m.reading) };
    }),
    notes: [],
  };
  if (moneyAllowed()) w.amount_so_far = amountOf(a, per.from, MOCK_TODAY, kwh);
  return w;
};

export const mockBackend: ElecBackend = {
  async lastPeriodKwh(ids) {
    await tick();
    return Object.fromEntries(meters.filter((m) => ids.includes(m.id)).map((m) => [m.id, m.last]));
  },
  async listAccounts() {
    await tick();
    failIf('accounts');
    if (demoControl().empty) return [];
    return accounts.map((a): AccountRow => {
      const w = statusWire(a);
      const row: AccountRow = { account: wireAccount(a), kwh: Number(w.kwh_so_far), stale: w.meters.some((m) => !m.reporting) };
      if (w.amount_so_far !== undefined) row.amount = w.amount_so_far;
      return row;
    });
  },
  async getAccount(id) {
    await tick();
    return wireAccount(getAccWire(id));
  },
  async accountStatus(id) {
    await tick();
    failIf('accounts');
    const a = getAccWire(id);
    const money = moneyAllowed();
    return buildStatus(wireAccount(a), statusWire(a), {
      today: MOCK_TODAY, customer: fullCust(custOf(a.customer_id)), tariffs: money ? tariffs.map((t) => tariff(t.id)) : undefined, vat: money ? await mockBackend.getVat() : null,
    });
  },
  async accountHistory(id, past) {
    await tick();
    failIf('history');
    return buildHistory(mockHistoryWire(id, past));
  },
  async createAccount(body: AccountBody, afterSave) {
    await tick();
    guardManage();
    if (!body.name.trim()) throw err(422, 'validation', 'צריך לתת שם לחשבון.', { fields: { name: 'צריך לתת שם לחשבון' } });
    if (!customers.some((x) => x.id === body.customer_id)) throw err(422, 'validation', 'צריך לבחור לקוח.', { fields: { customer_id: 'צריך לבחור לקוח' } });
    const a: MA = {
      id: `a${accounts.length + 10}`, name: body.name.trim(), customer_id: body.customer_id, ast: body.formula.ast, tariff_id: body.tariff_id, months: body.period_months, anchor_day: body.period_anchor_day,
      anchor_month: body.period_anchor_month, first: body.first_period_start, auto: body.auto_mode, revision: 1,
    };
    accounts = [...accounts, a];
    let bill: BillSummary | null = null;
    let billError = '';
    if (afterSave === 'draft') {
      try {
        bill = summary(getBillRaw((await mockBackend.createBill(a.id, { kind: 'last' })).id));
      } catch (e) {
        billError = e instanceof ApiError ? e.body.user_message : 'לא ניתן ליצור טיוטה';
      }
    }
    return { account: wireAccount(a), bill, billError };
  },
  async updateAccount(id, revision, body) {
    await tick();
    guardManage();
    const a = getAccWire(id);
    if (a.revision !== revision) throw err(409, 'revision_conflict', 'החשבון השתנה בינתיים. רעננו ונסו שוב.');
    if (body.name !== undefined) a.name = body.name;
    if (body.formula) a.ast = body.formula.ast;
    if (body.tariff_id) a.tariff_id = body.tariff_id;
    if (body.auto_mode) a.auto = body.auto_mode;
    a.revision += 1;
    return wireAccount(a);
  },
  async checkFormula(ast): Promise<FormulaPreview> {
    await tick();
    const ids = meterIdsOf(ast);
    const rows = ids.map((id) => ({ meter_id: id, name: nameOf(id), kwh: meter(id).last }));
    const result = r2(evaluate(ast, (id) => meter(id).last));
    const base = { period_from: '2026-09-01', period_to: '2026-09-30', rows, result_kwh: result, warnings: [] as string[] };
    if (result < 0) return { ...base, ok: false, errors: [`התוצאה שלילית בתקופה האחרונה (${dec(result)} קוט״ש). בדקו את הסימנים בנוסחה.`], negative: true };
    return { ...base, ok: true, errors: [], negative: false };
  },
  async nextCustomerNumber() {
    await tick();
    return String(Math.max(...customers.map((c) => Number(c.customer_number))) + 1).padStart(4, '0');
  },
  async listCustomers(q) {
    await tick();
    failIf('customers');
    if (demoControl().empty) return [];
    const s = (q ?? '').trim();
    return customers.filter((c) => !s || c.name.includes(s) || c.customer_number.includes(s)).map((c) => fullCust(c, true));
  },
  async getCustomer(id) {
    await tick();
    const c = customers.find((x) => x.id === id);
    if (!c) throw err(404, 'not_found', 'הלקוח לא נמצא.');
    return fullCust(c, true);
  },
  async createCustomer(body) {
    await tick();
    guardManage();
    validateCustomer(body, null);
    const number = body.customer_number || String(Math.max(...customers.map((c) => Number(c.customer_number))) + 1).padStart(4, '0');
    const c = cust(`c${customers.length + 10}`, number, body.name.trim(), body.address, body.phone, body.email, body.tax_id);
    c.notes = body.notes;
    customers = [...customers, c];
    return fullCust(c, true);
  },
  async updateCustomer(id, revision, body) {
    await tick();
    guardManage();
    const c = customers.find((x) => x.id === id);
    if (!c) throw err(404, 'not_found', 'הלקוח לא נמצא.');
    if (c.revision !== revision) throw err(409, 'revision_conflict', 'הלקוח השתנה בינתיים. רעננו ונסו שוב.');
    validateCustomer({ ...c, ...body }, id);
    Object.assign(c, body);
    c.revision += 1;
    return fullCust(c, true);
  },
  async deleteCustomer(id) {
    await tick();
    guardManage();
    if (accounts.some((a) => a.customer_id === id)) throw err(409, 'customer_has_accounts', 'ללקוח יש חשבונות פעילים. אי אפשר למחוק אותו.');
    customers = customers.filter((c) => c.id !== id);
  },
  async listTariffs() {
    await tick();
    guardMoney();
    return tariffs.map((t) => tariff(t.id));
  },
  async createTariff(b) {
    await tick();
    guardManage();
    checkTariff(b);
    const t: Tariff = { id: `t${tariffs.length + 1}`, name: b.name.trim(), currency: 'ILS', kind: b.definition ? 'tou' : 'fixed', used_by: 0, current: null, versions: [newVersion(b)] };
    tariffs = [...tariffs, t];
    return tariff(t.id);
  },
  async addTariffVersion(id, b) {
    await tick();
    guardManage();
    checkTariff(b);
    const t = tariffs.find((x) => x.id === id);
    if (!t) throw err(404, 'not_found', 'התעריף לא נמצא.');
    kindMatches(t, b);
    if (t.versions.some((v) => v.effective_from === b.effective_from)) throw err(409, 'version_exists', 'כבר קיימת גרסה עם תאריך התחלה זהה.');
    t.name = b.name.trim();
    t.versions = [newVersion(b), ...t.versions].sort((x, y) => (x.effective_from < y.effective_from ? 1 : -1));
    return tariff(id);
  },
  async correctTariffVersion(id, b, o) {
    await tick();
    guardManage();
    checkTariff(b);
    const t = tariffs.find((x) => x.id === id);
    if (!t) throw err(404, 'not_found', 'התעריף לא נמצא.');
    kindMatches(t, b);
    const target = o.replaceId ? t.versions.find((v) => v.id === o.replaceId) : t.versions.find((v) => v.effective_from === b.effective_from);
    if (o.replaceId && !target) throw err(404, 'not_found', 'גרסת המחיר לא נמצאה.');
    if (!target) {
      if (o.confirm) t.name = b.name.trim();
      t.versions = [newVersion(b), ...t.versions].sort((x, y) => (x.effective_from < y.effective_from ? 1 : -1));
      return { applied: true, plan: null };
    }
    if (o.base && (o.base.price !== target.price || o.base.price_mode !== target.price_mode || o.base.effective_from !== target.effective_from || (o.base.definition_sha256 ?? null) !== (target.definition_sha256 ?? null))) throw err(409, 'revision_conflict', 'המחיר שונה בינתיים. יש לרענן ולנסות שוב.');
    const sameValue = b.definition ? JSON.stringify(b.definition) === JSON.stringify(target.definition) : Number(b.price) === Number(target.price);
    if (sameValue && b.price_mode === target.price_mode && b.effective_from === target.effective_from) throw err(409, 'nothing_changed', 'לא בוצע שינוי במחיר.');
    if (t.versions.some((v) => v !== target && v.effective_from === b.effective_from)) throw err(409, 'version_exists', 'כבר קיים מחיר מהתאריך הזה. יש לערוך אותו במקום.');
    const sealedThrough = SEALED_THROUGH[target.id];
    const applyFrom = sealedThrough && sealedThrough > b.effective_from ? sealedThrough : b.effective_from;
    if (sealedThrough && t.versions.some((v) => v !== target && v.effective_from >= applyFrom && v.effective_from <= applyFrom)) {
      throw err(409, 'tariff_period_sealed', 'החשבונות שכבר הופקו נשענים על המחיר הזה ולא ניתן לתקן אותו. הוסיפו מחיר חדש מתאריך מאוחר יותר.');
    }
    const plan: TariffVersionPlan = {
      kind: sealedThrough ? 'later_only' : 'in_place',
      applies_from: applyFrom,
      old: { effective_from: target.effective_from, price: target.price, price_mode: target.price_mode },
      new: { effective_from: applyFrom, price: b.definition ? null : b.price, price_mode: b.price_mode },
      message_he: sealedThrough ? `החשבונות שכבר הופקו לא ישתנו. המחיר המתוקן יחול מ-${applyFrom.split('-').reverse().join('.')}.` : 'המחיר יוחלף. טיוטות, תחזית וחיובים עתידיים יחושבו במחיר החדש.',
    };
    if (!o.confirm) return { applied: false, plan };
    t.name = b.name.trim();
    if (plan.kind === 'in_place') Object.assign(target, { ...newVersion(b), id: target.id });
    else t.versions.push({ ...newVersion(b), effective_from: applyFrom });
    t.versions.sort((x, y) => (x.effective_from < y.effective_from ? 1 : -1));
    return { applied: true, plan };
  },
  async touTemplates() {
    await tick();
    guardMoney();
    return [{ id: 'israel_household', name_he: 'תעו״ז ביתי (ישראל)', source_he: 'מבנה תעו״ז ביתי לפי מקורות משניים: קיץ יוני-ספטמבר, חורף דצמבר-פברואר, מעבר בשאר החודשים. המחירים ריקים: יש להזין אותם מחשבון אמיתי. המבנה לא אומת מול נוסח הרשות.', definition: israelTemplate() }];
  },
  async checkTou(d) {
    await tick();
    guardMoney();
    return mockCheck(d);
  },
  async getCalendar(year) {
    await tick();
    return calendarYear(year);
  },
  async setCalendarDay(date, kind, name_he, revision) {
    await tick();
    guardManage();
    if (revision !== calendar.revision) throw err(409, 'revision_conflict', 'הימים המיוחדים שונו בינתיים. יש לרענן ולנסות שוב.');
    calendar = { ...calendar, revision: calendar.revision + 1, overrides: { ...calendar.overrides, [date]: { kind, name_he: name_he.trim() } } };
    return calendarYear(Number(date.slice(0, 4)), { drafts_to_recalculate: 0 });
  },
  async removeCalendarDay(date, revision) {
    await tick();
    guardManage();
    if (revision !== calendar.revision) throw err(409, 'revision_conflict', 'הימים המיוחדים שונו בינתיים. יש לרענן ולנסות שוב.');
    if (!calendar.overrides[date]) throw err(404, 'not_found', 'אין הגדרה ידנית לתאריך הזה.');
    const { [date]: _gone, ...rest } = calendar.overrides;
    void _gone;
    calendar = { ...calendar, revision: calendar.revision + 1, overrides: rest };
    return calendarYear(Number(date.slice(0, 4)), { drafts_to_recalculate: 0 });
  },
  async setCalendarGenerator(generator, revision, year) {
    await tick();
    guardManage();
    if (revision !== calendar.revision) throw err(409, 'revision_conflict', 'הימים המיוחדים שונו בינתיים. יש לרענן ולנסות שוב.');
    calendar = { ...calendar, revision: calendar.revision + 1, generator };
    return calendarYear(year);
  },
  async getVat(): Promise<VatRates> {
    await tick();
    return { items: vatItems.map((v) => ({ ...v })), current: { ...vatItems[0] } };
  },
  async addVat(rate, from) {
    await tick();
    guardManage();
    const r = Number(rate);
    if (!(r >= 0 && r <= 50)) throw err(422, 'validation', 'שיעור המע״מ חייב להיות בין 0 ל-50.', { fields: { rate_percent: 'שיעור המע״מ חייב להיות בין 0 ל-50' } });
    if (!isIsoDate(from)) throw err(422, 'validation', 'תאריך התחלה לא תקין.', { fields: { effective_from: 'תאריך התחלה לא תקין' } });
    if (vatItems.some((v) => v.effective_from === from)) throw err(409, 'version_exists', 'כבר קיים שיעור עם תאריך התחלה זהה.');
    vatItems = [{ id: `v${Date.now() % 100000}`, effective_from: from, rate_percent: String(r) }, ...vatItems].sort((x, y) => (x.effective_from < y.effective_from ? 1 : -1));
    return mockBackend.getVat();
  },
  async listBills(q: BillsQuery = {}): Promise<BillList> {
    await tick();
    guardMoney();
    failIf('bills');
    if (demoControl().empty) return { items: [], total: 0, counts: { draft: 0, issued: 0, sent: 0, paid: 0, void: 0 } };
    const s = (q.q ?? '').trim();
    const base = bills.filter((b) => (!q.account_id || b.account_id === q.account_id) && (!q.customer_id || b.customer.id === q.customer_id)
      && (!q.from || b.period.to >= q.from) && (!q.to || b.period.to <= q.to) && (!s || (b.number ?? '').includes(s) || b.customer.name.includes(s) || b.account_name.includes(s)));
    const counts = { draft: 0, issued: 0, sent: 0, paid: 0, void: 0 } as Record<BillState, number>;
    for (const b of base) counts[b.state] += 1;
    const items = base.filter((b) => !q.state || b.state === q.state).sort((x, y) => (x.period.to < y.period.to ? 1 : x.period.to > y.period.to ? -1 : x.id < y.id ? 1 : -1));
    return { items: items.map(summary), total: items.length, counts };
  },
  async getBill(id) {
    await tick();
    guardMoney();
    return full(getBillRaw(id));
  },
  async billEvents(id) {
    await tick();
    guardMoney();
    const b = getBillRaw(id);
    return b._events.map((e): BillEvent => ({ ...e }));
  },
  async createBill(accountId, choice: PeriodChoice) {
    await tick();
    guardMoney();
    const a = getAccWire(accountId);
    const per = periodContaining(MOCK_TODAY, a.months, a.anchor_day, a.anchor_month);
    let from: string;
    let to: string;
    if (choice.kind === 'last') {
      to = addDays(per.from, -1);
      from = periodContaining(to, a.months, a.anchor_day, a.anchor_month).from;
    } else {
      from = choice.from;
      to = choice.to;
    }
    const code = demoControl().create_error;
    if (code === 'formula_negative') throw err(422, 'formula_negative', 'התוצאה שלילית בתקופה הזו. בדקו את הסימנים בנוסחה או את המונים.', { kwh: '-12.40' });
    if (code === 'tariff_missing') throw err(422, 'tariff_missing', 'אין מחיר בתוקף בתאריך הזה. הגדירו מחיר בהגדרות.');
    if (code === 'vat_missing') throw err(422, 'vat_missing', 'אין שיעור מע״מ בתוקף בתאריך הזה. הגדירו שיעור בהגדרות.');
    if (!isIsoDate(from) || !isIsoDate(to) || to < from) throw err(422, 'period_invalid', 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה.');
    if (to > MOCK_TODAY) throw err(422, 'period_invalid', 'אי אפשר להפיק חיוב לתקופה שעוד לא הסתיימה.');
    const o = overlaps(accountId, from, to);
    if (o || code === 'period_overlap') throw err(409, 'period_overlap', `כבר קיים חיוב ${o?.number ?? '2026-09-0001'} לתקופה הזו. אפשר לתקן אותו במקום ליצור חדש.`, { number: o?.number ?? '2026-09-0001', bill_id: o?.id ?? 'b102' });
    const dup = bills.find((b) => b.account_id === accountId && b.state === 'draft' && b.period.from === from && b.period.to === to);
    if (dup) throw err(409, 'draft_exists', 'כבר קיימת טיוטה לתקופה הזו.', { bill_id: dup.id });
    const b = pushBill({ a: accountId, from, to, kwh: periodKwh(a, from, to), state: 'draft', issued: null, number: null, events: [{ at: `${MOCK_TODAY}T09:30`, text: 'טיוטה נוצרה' }] });
    bills = [b, ...bills.filter((x) => x !== b)];
    return full(b);
  },
  async recalcBill(s) {
    await tick();
    guardMoney();
    const b = getBillRaw(s.id);
    if (b.state !== 'draft') throw err(409, 'bill_not_draft', 'אפשר לחשב מחדש רק טיוטה.');
    b.snapshot = { ...buildSnapshot(accOf(b.account_id), b.period.from, b.period.to, null, 'draft', null, null, b.revision), bill: { ...b.snapshot.bill } };
    log(b, 'חושב מחדש');
    return full(b);
  },
  async deleteDraft(s) {
    await tick();
    guardMoney();
    const b = getBillRaw(s.id);
    if (b.state !== 'draft') throw err(409, 'bill_not_draft', 'אפשר למחוק רק טיוטה.');
    bills = bills.filter((x) => x.id !== s.id);
  },
  async issueBill(s) {
    await tick();
    guardMoney();
    const b = getBillRaw(s.id);
    if (b.state !== 'draft') throw err(409, 'bill_not_draft', 'אפשר להנפיק רק טיוטה.');
    const a = accOf(b.account_id);
    const orig = b.replaces_bill_id ? bills.find((x) => x.id === b.replaces_bill_id) ?? null : null;
    const no = nextNumber(b.period.to, custOf(a.customer_id).customer_number, orig?.number ?? null, b.revision);
    b.number = no;
    b.state = 'issued';
    b.issue_date = MOCK_TODAY;
    b.due_date = dueDate(MOCK_TODAY);
    b.snapshot = { ...b.snapshot, bill: { ...b.snapshot.bill, number: no, state: 'issued', issue_date: MOCK_TODAY, due_date: dueDate(MOCK_TODAY) } };
    b.snapshot_sha256 = 'a3f9c21e0b7d4455aa10c3d1e9f8b2c7';
    log(b, orig ? `הונפק, מחליף את ${orig.number}` : 'הונפק');
    if (orig && orig.state !== 'void') {
      orig.state = 'void';
      orig.replaced_by_bill_id = b.id;
      orig.void = { at: `${MOCK_TODAY}T09:30:00Z`, reason: `הוחלף ב-${no}` };
      log(orig, `הוחלף ב-${no}`);
    }
    return full(b);
  },
  async markSent(id, body) {
    await tick();
    guardMoney();
    const b = getBillRaw(id);
    if (b.state !== 'issued') throw err(409, 'bill_state', 'אפשר לסמן כנשלח רק חיוב שהונפק.', { state: b.state });
    staleVersion(b, body.row_version);
    const at = body.at ?? MOCK_TODAY;
    if (!isIsoDate(at)) throw err(422, 'validation', 'תאריך לא תקין.', { fields: { at: 'תאריך לא תקין' } });
    b.state = 'sent';
    b.sent = { at, how: body.how, note: body.note ?? '' };
    log(b, `סומן כנשלח ${{ email: 'בדוא״ל', hand: 'במסירה ידנית', other: 'באופן אחר' }[body.how]}`);
    return full(b);
  },
  async markPaid(id, body) {
    await tick();
    guardMoney();
    const b = getBillRaw(id);
    if (b.state !== 'issued' && b.state !== 'sent') throw err(409, 'bill_state', 'אפשר לסמן כשולם רק חיוב שהונפק או נשלח.', { state: b.state });
    staleVersion(b, body.row_version);
    const at = body.at ?? MOCK_TODAY;
    if (!isIsoDate(at)) throw err(422, 'validation', 'תאריך לא תקין.', { fields: { at: 'תאריך לא תקין' } });
    const reference = body.reference ?? '';
    b.state = 'paid';
    b.paid = { at, reference };
    log(b, reference ? `סומן כשולם, אסמכתה ${reference}` : 'סומן כשולם');
    return full(b);
  },
  async correctBill(id) {
    await tick();
    guardMoney();
    const b = getBillRaw(id);
    if (b.state === 'draft' || b.state === 'void') throw err(409, 'bill_state', 'אפשר לתקן רק חיוב שהונפק.', { state: b.state });
    const exists = bills.find((x) => x.replaces_bill_id === b.id && x.state === 'draft');
    if (exists) throw err(409, 'bill_state', 'כבר קיימת טיוטה מתוקנת לחיוב הזה.', { bill_id: exists.id });
    const n = pushBill({ a: b.account_id, from: b.period.from, to: b.period.to, kwh: periodKwh(accOf(b.account_id), b.period.from, b.period.to), state: 'draft', issued: null, number: null, revision: b.revision + 1, replaces: b, events: [{ at: `${MOCK_TODAY}T09:30`, text: `טיוטה מתוקנת של ${b.number}` }] });
    n.snapshot.history = b.snapshot.history;
    bills = [n, ...bills.filter((x) => x !== n)];
    return full(n);
  },
  async voidBill(id, reason) {
    await tick();
    guardMoney();
    if (!reason.trim()) throw err(422, 'reason_required', 'צריך לכתוב סיבה.');
    const b = getBillRaw(id);
    if (b.state !== 'issued' && b.state !== 'sent') throw err(409, 'bill_state', 'אפשר לבטל רק חיוב שהונפק או נשלח.', { state: b.state });
    b.state = 'void';
    b.void = { at: `${MOCK_TODAY}T09:30:00Z`, reason: reason.trim() };
    log(b, `בוטל: ${reason.trim()}`);
    return full(b);
  },
  async fetchPdf(id) {
    await tick();
    guardMoney();
    const b = getBillRaw(id);
    const code = demoControl().pdf_error;
    if (code) {
      // the server answers 503 for render_failed / timeout / unavailable, 422 for page_limit / too_large; a failed render of an issued bill is remembered
      const status = ['pdf_page_limit', 'pdf_too_large', 'pdf_no_lines', 'pdf_invalid_snapshot'].includes(code) ? 422 : 503;
      if (b.state !== 'draft' && code !== 'pdf_unavailable') pdfFailedAt.set(id, { code, at: `${MOCK_TODAY}T09:32:00Z` });
      throw new ApiError(status, { code, user_message: ERROR_TEXT[code] ?? '', retryable: PDF_RETRYABLE.includes(code), correlation_id: '', details: {} });
    }
    // pdf_failed: the last attempt failed (pdf.state = failed); "create the PDF again" renders and stores it
    pdfFailedAt.delete(id);
    if (b.state !== 'draft') pdfStored.add(id);
    return new Blob(['%PDF-1.4\n%mock\n'], { type: 'application/pdf' });
  },
  async getSettings() {
    await tick();
    failIf('settings');
    if (!moneyAllowed()) throw err(403, 'forbidden', 'אין הרשאה.');
    return JSON.parse(JSON.stringify(settings)) as BillingSettings;
  },
  async saveSettings(revision, b) {
    await tick();
    guardManage();
    if (settings.revision !== revision) throw err(409, 'revision_conflict', 'ההגדרות השתנו בינתיים. רעננו ונסו שוב.');
    if (b.payment_terms) {
      const p = b.payment_terms;
      if (p.mode === 'net_days' && !(p.days >= 0 && p.days <= 120)) throw err(422, 'validation', 'מספר הימים חייב להיות בין 0 ל-120.', { fields: { days: 'מספר הימים חייב להיות בין 0 ל-120' } });
      if (p.mode === 'day_of_month' && !(p.day_of_month >= 1 && p.day_of_month <= 31)) throw err(422, 'validation', 'היום בחודש חייב להיות בין 1 ל-31.', { fields: { day_of_month: 'היום בחודש חייב להיות בין 1 ל-31' } });
    }
    if (b.auto && !(b.auto.delay_hours >= 0 && b.auto.delay_hours <= 72)) throw err(422, 'validation', 'ההשהיה חייבת להיות בין 0 ל-72 שעות.', { fields: { delay_hours: 'ההשהיה חייבת להיות בין 0 ל-72 שעות' } });
    if (b.business && !/^#[0-9a-fA-F]{6}$/.test(b.business.accent_color)) throw err(422, 'validation', 'צבע לא תקין.', { fields: { accent_color: 'צבע לא תקין' } });
    settings = { ...settings, ...b, business: { ...settings.business, ...(b.business ?? {}) }, revision: settings.revision + 1 };
    return JSON.parse(JSON.stringify(settings)) as BillingSettings;
  },
  async uploadLogo(file) {
    await tick();
    guardManage();
    if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > 1024 * 1024) throw err(422, 'logo_invalid', 'הלוגו חייב להיות PNG או JPEG עד 1MB.');
    logoDataUrl = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsDataURL(file);
    });
    settings = { ...settings, logo: { sha256: 'logo' + String(Date.now() % 100000).padStart(8, '0'), mime: file.type, width: 400, height: 120 }, revision: settings.revision + 1 };
  },
  async removeLogo() {
    await tick();
    guardManage();
    logoDataUrl = '';
    settings = { ...settings, logo: null, revision: settings.revision + 1 };
  },
  logoUrl: () => logoDataUrl,
};

function checkTariff(b: TariffVersionBody): void {
  if (!b.name.trim()) throw err(422, 'validation', 'צריך לתת שם לתעריף.', { fields: { name: 'צריך לתת שם לתעריף' } });
  if (b.definition) {
    const c = mockCheck(b.definition);
    if (!c.ok) throw err(422, 'tariff_definition_invalid', c.errors[0].message, { errors: c.errors, fields: [`definition.${c.errors[0].path}`] });
  } else if (!(Number(b.price) > 0)) throw err(422, 'validation', 'המחיר חייב להיות מספר גדול מאפס.', { fields: { price: 'המחיר חייב להיות מספר גדול מאפס' } });
  if (!isIsoDate(b.effective_from)) throw err(422, 'validation', 'תאריך התחלה לא תקין.', { fields: { effective_from: 'תאריך התחלה לא תקין' } });
}
/** A version from a body: a time-of-use definition (price null) or the flat price. */
function newVersion(b: TariffVersionBody): Tariff['versions'][number] {
  const id = `tv${Date.now() % 100000}`;
  if (!b.definition) return { id, effective_from: b.effective_from, price: b.price, price_mode: b.price_mode };
  const c = mockCheck(b.definition);
  return { id, effective_from: b.effective_from, price: null, price_mode: b.price_mode, definition: cloneDef(b.definition), definition_sha256: c.definition_sha256 ?? '' };
}
function kindMatches(t: Tariff, b: TariffVersionBody): void {
  if ((t.kind === 'tou') !== !!b.definition) throw err(422, 'validation', t.kind === 'tou' ? 'בתעריף לפי שעות המחירים נקבעים לכל עונה ופס.' : 'תעריף במחיר קבוע אינו מקבל הגדרת שעות.');
}

/** Specs: bring the store back to the fixture (a page reload does it too). */
export function resetElectricityMock(): void {
  calendar = { revision: 0, generator: 'israel', overrides: {} };
  seedBills();
}
export type { PriceMode };
