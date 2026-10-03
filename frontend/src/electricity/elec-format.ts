/** CR-023: number, money and date formatting shared by the electricity screens and the mock store (pure, no DOM). Dates travel as ISO `YYYY-MM-DD`; money as text decimals. */

export const r2 = (x: number): number => Math.round(x * 100 + 1e-9) / 100;
const nf = (min: number, max: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max });
const NF2 = nf(2, 2);
const NF4 = nf(4, 4);
const NF0 = nf(0, 0);
export const f2 = (x: number | string): string => NF2.format(Number(x));
export const f4 = (x: number | string): string => NF4.format(Number(x));
export const f0 = (x: number | string): string => NF0.format(Number(x));
/** `497.35 ₪` */
export const ils = (x: number | string): string => `${f2(x)} ₪`;
/** 30 -> "30%", 0.3 -> "30%" is not guessed: the caller passes percent. */
export const pct = (x: number): string => `${Number.isInteger(x) ? x : x.toFixed(1)}%`;

/** `2026-09-30` -> `30.09.2026` */
export function fmtDate(iso: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}
/** `2026-10-02T09:12` -> `02.10.2026 09:12` */
export function fmtDateTime(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : fmtDate(iso);
}
export const fmtRange = (from: string, to: string): string => `${fmtDate(from)} - ${fmtDate(to)}`;

const MONTHS_FULL = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const MONTHS_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
/** `2026-09-30` -> `ספטמבר 2026` */
export const monthName = (iso: string): string => `${MONTHS_FULL[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
/** `2026-09-30` -> `ספט׳ 26` */
export const monthShort = (iso: string): string => `${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;
export const MONTH_NAMES = MONTHS_FULL;

const DAY = 86_400_000;
const toUtc = (iso: string): number => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const fromUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number): string => fromUtc(toUtc(iso) + n * DAY);
/** inclusive day count of from..to */
export const daysInclusive = (from: string, to: string): number => Math.round((toUtc(to) - toUtc(from)) / DAY) + 1;
export const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const isIsoDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export const cmpDate = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The period of a monthly / two-monthly cycle that contains `on`, given the anchor day (1-28) and, for two months, the month that opens a cycle. */
export function periodContaining(on: string, months: 1 | 2, anchorDay: number, anchorMonth: number): { from: string; to: string } {
  const y = Number(on.slice(0, 4));
  const m = Number(on.slice(5, 7));
  const d = Number(on.slice(8, 10));
  // month index of the cycle start
  let idx = y * 12 + (m - 1);
  if (d < anchorDay) idx -= 1;
  if (months === 2) {
    const off = (((idx - (anchorMonth - 1)) % 2) + 2) % 2;
    idx -= off;
  }
  const sy = Math.floor(idx / 12);
  const sm = (idx % 12) + 1;
  const from = `${sy}-${String(sm).padStart(2, '0')}-${String(anchorDay).padStart(2, '0')}`;
  const nextIdx = idx + months;
  const ny = Math.floor(nextIdx / 12);
  const nm = (nextIdx % 12) + 1;
  const nextStart = `${ny}-${String(nm).padStart(2, '0')}-${String(anchorDay).padStart(2, '0')}`;
  return { from, to: addDays(nextStart, -1) };
}

/** The next `n` periods starting at `firstStart` (a partial first period ends at `firstEnd` when given, else at the next anchor). */
export function nextPeriods(firstStart: string, months: 1 | 2, anchorDay: number, anchorMonth: number, firstEnd: string, n: number): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  let from = firstStart;
  for (let i = 0; i < n; i++) {
    const p = periodContaining(from, months, anchorDay, anchorMonth);
    const to = i === 0 && firstEnd && firstEnd >= from ? firstEnd : p.to;
    out.push({ from, to });
    from = addDays(to, 1);
  }
  return out;
}

/** The bill number the CR-023 §10 rules give: `YYYY-MM-CCCC[L]` (month of the period's last day). */
export const billNumber = (to: string, customerNo: string, letter: string, revision = 1): string => `${to.slice(0, 7)}-${customerNo}${letter}${revision > 1 ? `-${revision}` : ''}`;

export const HEBREW_DAYS_UNIT = (n: number): string => (n === 1 ? 'יום' : 'ימים');
