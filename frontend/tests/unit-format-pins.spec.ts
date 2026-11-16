import { test, expect } from '@playwright/test';
import { formatBytes as exportsBytes } from '../src/api/exports';
import { formatBytes as claimBytes } from '../src/public-ticket/claim/claim-model';
import { formatBytes as costBytes, todayIso } from '../src/tickets/cost-model';
import { formatBytes as rfqBytes } from '../src/tickets/rfq-files-model';
import { addDays as eventsAddDays } from '../src/access-control/events-logic';
import { daysBetween, hoursText } from '../src/access-external/model';
import { codeDue, daySpan, rangeDates } from '../src/access-external/request-model';
import { addDays as elecAddDays, daysInclusive as elecDaysInclusive, periodContaining } from '../src/electricity/elec-format';
import { addDays as calAddDays, keyOf, timeText, weekStart } from '../src/tickets/calendar-model';
import { BYTE_UNITS_HE, formatByteSize, type BytesOptions } from '../src/format/bytes';
import { addDays, addDaysByParts, addDaysIso, daysDiff, daysInclusive, dayKeyParts, dayKeyToUtc, utcToDayKey } from '../src/format/day-key';
import { dayKey, hhmm, pad2 } from '../src/format/pad';

// CR-FORMAT-2440 (review finding 08:F10): the formatting helpers that were re-typed per module now live in src/format/. The plan's
// contract is "each call site keeps its current output", so this spec PINS the output of every replaced variant:
//   LEGACY.*   the old body of each variant, copied verbatim from the module as it was before the swap;
//   the module export of today (where the variant is exported) - equal to LEGACY before the swap (which proves the copies are true)
//               and after it (which proves the swap changed nothing);
//   src/format/* with the options each call site passes - equal to LEGACY by table.
// It was written and run green BEFORE the modules were touched (see docs/changes/CR-FORMAT-2440.md).
//   npx playwright test -c playwright.unit.config.ts tests/unit-format-pins.spec.ts

const KIB = 1024;
const MIB = 1024 * 1024;
const GIB = 1024 * 1024 * 1024;

// ---------------------------------------------------------------- the old bodies, verbatim

const LEGACY = {
  /** api/exports.ts:65 */
  exportsBytes(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  },
  /** public-ticket/claim/claim-model.ts:292 */
  claimBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(Math.round((bytes / (1024 * 1024)) * 10) / 10).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  },
  /** tickets/cost-model.ts:92 */
  costBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },
  /** tickets/rfq-files-model.ts:75 */
  rfqBytes(n: number, lang: 'he' | 'en' = 'he'): string {
    const kb = lang === 'en' ? 'KB' : 'ק״ב';
    const mb = lang === 'en' ? 'MB' : 'מ״ב';
    if (!Number.isFinite(n) || n < 0) return '';
    if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} ${kb}`;
    const v = n / (1024 * 1024);
    return `${v < 10 ? v.toFixed(1).replace(/\.0$/, '') : Math.round(v)} ${mb}`;
  },
  /** access-control/events-logic.ts:69 */
  eventsAddDays(date: string, days: number): string {
    return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  },
  /** access-external/model.ts:216 and access-external/request-model.ts:114 (the same body twice) */
  externalAddDays(date: string, n: number): string {
    const t = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) + n * 86400_000;
    return new Date(t).toISOString().slice(0, 10);
  },
  /** access-external/model.ts:221 (`daysBetween`) and request-model.ts:120 (`daySpan`), the same body twice */
  externalDays(from: string, until: string): number {
    return Math.round((Date.UTC(+until.slice(0, 4), +until.slice(5, 7) - 1, +until.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86400_000) + 1;
  },
  /** electricity/elec-format.ts:51-56 */
  elecAddDays(iso: string, n: number): string {
    const toUtc = (k: string): number => Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
    return new Date(toUtc(iso) + n * 86_400_000).toISOString().slice(0, 10);
  },
  elecDaysInclusive(from: string, to: string): number {
    const toUtc = (k: string): number => Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
    return Math.round((toUtc(to) - toUtc(from)) / 86_400_000) + 1;
  },
  /** tickets/calendar-model.ts:38-39, 60 */
  calKeyOf(y: number, m: number, d: number): string {
    const p2 = (n: number) => String(n).padStart(2, '0');
    return `${y}-${p2(m)}-${p2(d)}`;
  },
  calAddDays(key: string, n: number): string {
    const [y, m, d] = [+key.slice(0, 4), +key.slice(5, 7), +key.slice(8, 10)];
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return LEGACY.calKeyOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  },
  /** tickets/cost-model.ts:99 */
  todayIso(now: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  },
};

// ---------------------------------------------------------------- the options each call site passes (must equal the modules')

const SITE: Record<'exports' | 'claim' | 'cost' | 'rfqHe' | 'rfqEn', BytesOptions> = {
  exports: { gb: true },
  claim: { minKb: 1, mb: 'round1' },
  cost: { showBytes: true },
  rfqHe: { units: BYTE_UNITS_HE, minKb: 1, mb: 'short', invalid: '' },
  rfqEn: { minKb: 1, mb: 'short', invalid: '' },
};

/** The value, or the name of what it threw (so "both throw RangeError" compares equal). */
function outcome<T>(fn: () => T): T | string {
  try {
    return fn();
  } catch (e) {
    return `throws ${(e as Error).name}`;
  }
}

/** A fixed pseudo-random sweep (no Math.random: the table is the same on every run). */
function sweep(count: number, max: number): number[] {
  const out: number[] = [];
  let x = 0x2f6e2b1;
  for (let i = 0; i < count; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    out.push(Math.floor((x / 0x1_0000_0000) ** 3 * max)); // cubed: most values small, some huge
  }
  return out;
}

const BYTE_EDGES = [
  0, 1, 2, 511, 512, 513, 1023, 1024, 1025, 1535, 1536, 1537, 2047, 2048, 10_000, 100_000, 500_000, 999_999, 1_000_000,
  MIB - 513, MIB - 512, MIB - 1, MIB, MIB + 1, Math.round(1.04 * MIB), Math.round(1.05 * MIB), Math.round(1.06 * MIB), Math.round(1.25 * MIB), Math.round(1.45 * MIB),
  Math.round(1.5 * MIB), Math.round(1.55 * MIB), Math.round(1.95 * MIB), 2 * MIB, Math.round(2.05 * MIB), 3 * MIB, Math.round(9.94 * MIB), Math.round(9.95 * MIB), Math.round(9.96 * MIB),
  10 * MIB - 1, 10 * MIB, 10 * MIB + 1, Math.round(10.4 * MIB), Math.round(10.5 * MIB), Math.round(10.6 * MIB), 25 * MIB, Math.round(99.95 * MIB), 100 * MIB, 512 * MIB, 1000 * MIB,
  GIB - 1, GIB, GIB + 1, Math.round(1.005 * GIB), Math.round(1.25 * GIB), Math.round(1.5 * GIB), 5 * GIB, 100 * GIB, 0.5, 1.5, 1023.5, -1, -512, -2000, -5 * MIB, Infinity, -Infinity,
];
const BYTES = [...BYTE_EDGES, ...sweep(400, 4 * GIB), ...sweep(150, 64 * KIB)];

test('formatBytes x4: today\'s module output equals the old body, over the whole table', () => {
  for (const n of BYTES) {
    expect(exportsBytes(n), `exports ${n}`).toBe(LEGACY.exportsBytes(n));
    expect(claimBytes(n), `claim ${n}`).toBe(LEGACY.claimBytes(n));
    expect(costBytes(n), `cost ${n}`).toBe(LEGACY.costBytes(n));
    expect(rfqBytes(n), `rfq he ${n}`).toBe(LEGACY.rfqBytes(n));
    expect(rfqBytes(n, 'he'), `rfq he ${n}`).toBe(LEGACY.rfqBytes(n, 'he'));
    expect(rfqBytes(n, 'en'), `rfq en ${n}`).toBe(LEGACY.rfqBytes(n, 'en'));
  }
  expect(exportsBytes(null)).toBe('—');
  expect(exportsBytes(undefined)).toBe('—');
  // not a number: three of the four keep their old answer exactly
  expect(exportsBytes(NaN)).toBe(LEGACY.exportsBytes(NaN));
  expect(costBytes(NaN)).toBe(LEGACY.costBytes(NaN));
  expect(rfqBytes(NaN)).toBe(LEGACY.rfqBytes(NaN));
});

test('formatByteSize with each site\'s options equals the old body, over the whole table', () => {
  for (const n of BYTES) {
    expect(formatByteSize(n, SITE.exports), `exports ${n}`).toBe(LEGACY.exportsBytes(n));
    expect(formatByteSize(n, SITE.claim), `claim ${n}`).toBe(LEGACY.claimBytes(n));
    expect(formatByteSize(n, SITE.cost), `cost ${n}`).toBe(LEGACY.costBytes(n));
    expect(formatByteSize(n, SITE.rfqHe), `rfq he ${n}`).toBe(LEGACY.rfqBytes(n, 'he'));
    expect(formatByteSize(n, SITE.rfqEn), `rfq en ${n}`).toBe(LEGACY.rfqBytes(n, 'en'));
  }
  expect(formatByteSize(NaN, SITE.exports)).toBe(LEGACY.exportsBytes(NaN)); // 'NaN GB'
  expect(formatByteSize(NaN, SITE.cost)).toBe(LEGACY.costBytes(NaN)); // 'NaN MB'
  expect(formatByteSize(NaN, SITE.rfqHe)).toBe(''); // the only variant that checked
  // THE ONE KNOWN DIFFERENCE, on an input no caller can produce (a File's size is always a number): the claim page wrote 'NaN KB'
  expect(LEGACY.claimBytes(NaN)).toBe('NaN KB');
  expect(formatByteSize(NaN, SITE.claim)).toBe('NaN MB');
});

test('formatBytes: the pinned strings (what the operator reads today)', () => {
  const row = (n: number) => [exportsBytes(n), claimBytes(n), costBytes(n), rfqBytes(n), rfqBytes(n, 'en')];
  expect(row(0)).toEqual(['0 KB', '1 KB', '0 B', '1 ק״ב', '1 KB']);
  expect(row(300)).toEqual(['0 KB', '1 KB', '300 B', '1 ק״ב', '1 KB']);
  expect(row(1023)).toEqual(['1 KB', '1 KB', '1023 B', '1 ק״ב', '1 KB']);
  expect(row(320_000)).toEqual(['313 KB', '313 KB', '313 KB', '313 ק״ב', '313 KB']);
  expect(row(MIB - 1)).toEqual(['1024 KB', '1024 KB', '1024 KB', '1024 ק״ב', '1024 KB']);
  expect(row(MIB)).toEqual(['1.0 MB', '1.0 MB', '1.0 MB', '1 מ״ב', '1 MB']);
  expect(row(Math.round(1.25 * MIB))).toEqual(['1.3 MB', '1.3 MB', '1.3 MB', '1.3 מ״ב', '1.3 MB']);
  expect(row(3 * MIB)).toEqual(['3.0 MB', '3.0 MB', '3.0 MB', '3 מ״ב', '3 MB']);
  expect(row(Math.round(12.4 * MIB))).toEqual(['12.4 MB', '12.4 MB', '12.4 MB', '12 מ״ב', '12 MB']);
  expect(row(GIB)).toEqual(['1.00 GB', '1024.0 MB', '1024.0 MB', '1024 מ״ב', '1024 MB']);
  expect(row(Math.round(2.5 * GIB))).toEqual(['2.50 GB', '2560.0 MB', '2560.0 MB', '2560 מ״ב', '2560 MB']);
  expect(row(-1)).toEqual(['0 KB', '1 KB', '-1 B', '', '']);
  expect(exportsBytes(-1)).toBe('0 KB'); // Math.round(-1 / 1024) is -0, written "0"
  expect(exportsBytes(-2000)).toBe('-2 KB');
});

test('formatByteSize: the defaults and each option on its own', () => {
  expect(formatByteSize(0)).toBe('0 KB');
  expect(formatByteSize(1500)).toBe('1 KB');
  expect(formatByteSize(5 * MIB)).toBe('5.0 MB');
  expect(formatByteSize(2 * GIB)).toBe('2048.0 MB');
  expect(formatByteSize(2 * GIB, { gb: true })).toBe('2.00 GB');
  expect(formatByteSize(100, { showBytes: true })).toBe('100 B');
  expect(formatByteSize(100, { minKb: 1 })).toBe('1 KB');
  expect(formatByteSize(5 * MIB, { mb: 'short' })).toBe('5 MB');
  expect(formatByteSize(5 * MIB, { mb: 'round1' })).toBe('5.0 MB');
  expect(formatByteSize(-1, { invalid: '?' })).toBe('?');
  expect(formatByteSize(2 * GIB, { gb: true, units: BYTE_UNITS_HE })).toBe('2.00 ג״ב');
});

// ---------------------------------------------------------------- day keys

const DAYS = [
  '2026-01-01', '2026-01-31', '2026-02-28', '2026-03-01', '2024-02-28', '2024-02-29', '2024-03-01', '2026-03-26', '2026-03-27', '2026-03-28', // the Israeli clock change
  '2026-10-24', '2026-10-25', '2026-06-15', '2026-11-16', '2026-12-31', '1999-12-31', '2000-01-01', '2000-02-29', '1970-01-01', '1969-12-31', '2100-02-28', '0100-01-01', '9999-01-01',
];
const STEPS = [-4000, -800, -366, -365, -64, -31, -30, -29, -28, -8, -7, -6, -2, -1, 0, 1, 2, 6, 7, 8, 28, 29, 30, 31, 64, 365, 366, 800, 4000];
const BAD_KEYS = ['', 'abc', '2026', '2026-02', '2026-3-7', '2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31', '2026-06-15T10:00:00Z', ' 2026-06-15', '20260615'];

test('addDays x5: today\'s module output equals the old body (well-formed keys)', () => {
  for (const d of DAYS) {
    for (const n of STEPS) {
      expect(eventsAddDays(d, n), `events ${d} ${n}`).toBe(LEGACY.eventsAddDays(d, n));
      expect(elecAddDays(d, n), `electricity ${d} ${n}`).toBe(LEGACY.elecAddDays(d, n));
      expect(calAddDays(d, n), `calendar ${d} ${n}`).toBe(LEGACY.calAddDays(d, n));
    }
  }
});

test('addDays x5: the shared helpers equal the old bodies (well-formed keys), and the five agree with each other', () => {
  for (const d of DAYS) {
    for (const n of STEPS) {
      const want = LEGACY.externalAddDays(d, n);
      expect(addDays(d, n), `external ${d} ${n}`).toBe(want);
      expect(addDays(d, n), `electricity ${d} ${n}`).toBe(LEGACY.elecAddDays(d, n));
      expect(addDaysIso(d, n), `events ${d} ${n}`).toBe(LEGACY.eventsAddDays(d, n));
      expect(addDaysByParts(d, n), `calendar ${d} ${n}`).toBe(LEGACY.calAddDays(d, n));
      expect(LEGACY.eventsAddDays(d, n), `events = external ${d} ${n}`).toBe(want);
      // the calendar writes the year as a plain number: the same text for the years 1000-9999 (outside them "89-01-18" vs "0089-01-18")
      if (/^[1-9]\d{3}-/.test(want)) expect(LEGACY.calAddDays(d, n), `calendar = external ${d} ${n}`).toBe(want);
    }
  }
});

test('addDays on a malformed key: every variant keeps its own old answer (value or error)', () => {
  for (const d of BAD_KEYS) {
    for (const n of [-1, 0, 1, 40]) {
      expect(outcome(() => addDays(d, n)), `external "${d}" ${n}`).toBe(outcome(() => LEGACY.externalAddDays(d, n)));
      expect(outcome(() => addDays(d, n)), `electricity "${d}" ${n}`).toBe(outcome(() => LEGACY.elecAddDays(d, n)));
      expect(outcome(() => addDaysIso(d, n)), `events "${d}" ${n}`).toBe(outcome(() => LEGACY.eventsAddDays(d, n)));
      expect(outcome(() => addDaysByParts(d, n)), `calendar "${d}" ${n}`).toBe(outcome(() => LEGACY.calAddDays(d, n)));
      expect(outcome(() => eventsAddDays(d, n)), `events module "${d}" ${n}`).toBe(outcome(() => LEGACY.eventsAddDays(d, n)));
      expect(outcome(() => elecAddDays(d, n)), `electricity module "${d}" ${n}`).toBe(outcome(() => LEGACY.elecAddDays(d, n)));
      expect(outcome(() => calAddDays(d, n)), `calendar module "${d}" ${n}`).toBe(outcome(() => LEGACY.calAddDays(d, n)));
    }
  }
});

test('addDays: the pinned strings', () => {
  expect(addDays('2026-03-27', 1)).toBe('2026-03-28');
  expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(addDays('2026-11-16', -6)).toBe('2026-11-10');
  expect(addDays('2026-02-30', 0)).toBe('2026-03-02'); // an impossible day rolls over, as before
  expect(addDaysByParts('2026-02-30', 0)).toBe('2026-03-02');
  expect([addDays('0100-01-01', -4000), addDaysByParts('0100-01-01', -4000)]).toEqual(['0089-01-18', '89-01-18']); // why the calendar keeps its own form
  expect(outcome(() => addDaysIso('abc', 1))).toBe('throws RangeError');
  expect(utcToDayKey(dayKeyToUtc('2026-06-15'))).toBe('2026-06-15');
  expect(dayKeyParts('2026-06-15')).toEqual([2026, 6, 15]);
});

test('inclusive day counts x3: modules, old bodies and the shared helper agree', () => {
  for (const a of [...DAYS, ...BAD_KEYS]) {
    for (const b of [...DAYS, ...BAD_KEYS]) {
      const want = LEGACY.externalDays(a, b);
      expect(daysBetween(a, b), `daysBetween ${a} ${b}`).toBe(want);
      expect(daySpan(a, b), `daySpan ${a} ${b}`).toBe(want);
      expect(daysInclusive(a, b), `shared ${a} ${b}`).toBe(want);
      expect(elecDaysInclusive(a, b), `electricity ${a} ${b}`).toBe(LEGACY.elecDaysInclusive(a, b));
      expect(daysInclusive(a, b), `shared = electricity ${a} ${b}`).toBe(LEGACY.elecDaysInclusive(a, b));
    }
  }
  expect(daysInclusive('2026-11-16', '2026-11-16')).toBe(1);
  expect(daysInclusive('2026-11-16', '2026-11-22')).toBe(7);
  expect(daysInclusive('2026-03-26', '2026-03-28')).toBe(3); // across the clock change
  expect(daysInclusive('2026-11-16', '2026-11-15')).toBe(0);
  expect(daysDiff('2026-11-16', '2026-11-22')).toBe(6);
});

// ---------------------------------------------------------------- what the callers of the private copies return

test('the callers of the private copies: pinned results', () => {
  // access-external/request-model.ts (private addDays, daySpan)
  expect(rangeDates('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  expect(rangeDates('2026-03-26', '2026-03-28')).toEqual(['2026-03-26', '2026-03-27', '2026-03-28']);
  expect(rangeDates('2026-01-01', '2026-01-31')).toHaveLength(31);
  expect(rangeDates('2026-01-01', '2026-02-01')).toEqual([]); // 32 days: over the limit
  expect(rangeDates('2026-01-02', '2026-01-01')).toEqual([]);
  expect(codeDue('2026-11-20', '2026-11-16', 18, 600)).toBe('19.11 18:00');
  expect(codeDue('2026-11-20', '2026-11-16', 7, 600)).toBe('19.11 07:00');
  expect(codeDue('2026-03-01', '2026-02-20', 9, 0)).toBe('28.02 09:00');
  expect(codeDue('2026-11-17', '2026-11-16', 18, 18 * 60)).toBeNull();
  expect(codeDue('2026-11-17', '2026-11-16', 18, 18 * 60 - 1)).toBe('16.11 18:00');
  // access-external/model.ts (the hour:minute of a grant without periods)
  expect(hoursText({ timing: null, valid_from: '2026-11-16T06:05:00Z', valid_until: '2026-11-16T15:30:00Z' } as never, 'Asia/Jerusalem')).toBe('08:05-17:30');
  expect(hoursText({ timing: null, valid_from: '2026-07-01T21:00:00Z', valid_until: '2026-07-02T06:09:00Z' } as never, 'Asia/Jerusalem')).toBe('00:00-09:09');
  // electricity/elec-format.ts (padStart inline + addDays)
  expect(periodContaining('2026-09-30', 1, 1, 1)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  expect(periodContaining('2026-09-04', 1, 5, 1)).toEqual({ from: '2026-08-05', to: '2026-09-04' });
  expect(periodContaining('2026-01-03', 1, 15, 1)).toEqual({ from: '2025-12-15', to: '2026-01-14' });
  expect(periodContaining('2026-02-10', 2, 1, 1)).toEqual({ from: '2026-01-01', to: '2026-02-28' });
  expect(periodContaining('2024-02-10', 2, 1, 1)).toEqual({ from: '2024-01-01', to: '2024-02-29' });
  expect(periodContaining('2026-12-20', 2, 10, 2)).toEqual({ from: '2026-12-10', to: '2027-02-09' });
  // tickets/calendar-model.ts (p2, keyOf, addDays)
  expect(weekStart('2026-11-16')).toBe('2026-11-15');
  expect(weekStart('2026-03-01')).toBe('2026-03-01');
  expect(weekStart('2026-01-02')).toBe('2025-12-28');
  expect(timeText(Date.UTC(2026, 10, 16, 7, 5), 'Asia/Jerusalem')).toBe('09:05');
  expect(timeText(Date.UTC(2026, 6, 1, 21, 0), 'Asia/Jerusalem')).toBe('00:00');
  expect(timeText(Date.UTC(2026, 10, 16, 21, 59), 'UTC')).toBe('21:59');
});

// ---------------------------------------------------------------- padding

test('pad2 / dayKey / hhmm equal every replaced copy', () => {
  const p = (n: number) => String(n).padStart(2, '0');
  for (const n of [0, 1, 5, 9, 10, 11, 23, 59, 60, 99, 100, 2026, -1, -12, 1.5]) expect(pad2(n), String(n)).toBe(p(n));
  expect(pad2('7')).toBe('07');
  for (const [y, m, d] of [[2026, 1, 5], [2026, 11, 16], [2026, 12, 31], [999, 3, 7], [12345, 10, 1], [0, 0, 0]]) {
    expect(dayKey(y, m, d)).toBe(LEGACY.calKeyOf(y, m, d));
    expect(keyOf(y, m, d)).toBe(LEGACY.calKeyOf(y, m, d));
  }
  expect(dayKey(2026, 3, 7)).toBe('2026-03-07');
  expect(hhmm(9, 5)).toBe('09:05');
  expect(hhmm(23, 59)).toBe('23:59');
  for (const now of [new Date(2026, 0, 5, 12), new Date(2026, 10, 16, 0, 0, 1), new Date(2026, 11, 31, 23, 59, 59), new Date(2024, 1, 29, 8)]) {
    expect(todayIso(now)).toBe(LEGACY.todayIso(now));
  }
  expect(todayIso(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
});
