/**
 * TV-FIT-2380 - the Hebrew date without the browser's Hebrew calendar. Some TV browsers (older Tizen / webOS builds, "small ICU" builds)
 * have no Hebrew calendar: `Intl.DateTimeFormat('he-IL-u-ca-hebrew')` then throws, falls back to the Gregorian calendar, or prints
 * Latin month names, and the board used to leave the line out. This module computes the date itself (the arithmetic Hebrew calendar,
 * Dershowitz & Reingold, "Calendrical Calculations") and prints it the way Chromium's ICU does ("12 בחשוון 5787"), so the line reads
 * the same on every screen. The browser's own formatter is still used when it really is the Hebrew calendar.
 */

const EPOCH = -1373427; // R.D. of 1 Tishrei AM 1

const leap = (y: number): boolean => (7 * y + 1) % 19 < 7;
const lastMonth = (y: number): number => (leap(y) ? 13 : 12);

function elapsedDays(y: number): number {
  const months = Math.floor((235 * y - 234) / 19);
  const parts = 12084 + 13753 * months;
  const days = 29 * months + Math.floor(parts / 25920);
  return (3 * (days + 1)) % 7 < 3 ? days + 1 : days;
}

function yearCorrection(y: number): number {
  const ny0 = elapsedDays(y - 1);
  const ny1 = elapsedDays(y);
  const ny2 = elapsedDays(y + 1);
  if (ny2 - ny1 === 356) return 2;
  if (ny1 - ny0 === 382) return 1;
  return 0;
}

const newYear = (y: number): number => EPOCH + elapsedDays(y) + yearCorrection(y);
const yearDays = (y: number): number => newYear(y + 1) - newYear(y);

function monthDays(m: number, y: number): number {
  const n = yearDays(y);
  if ([2, 4, 6, 10, 13].includes(m)) return 29;
  if (m === 12 && !leap(y)) return 29;
  if (m === 8 && n % 10 !== 5) return 29; // Heshvan is long only in a 355 / 385-day year
  if (m === 9 && n % 10 === 3) return 29; // Kislev is short in a 353 / 383-day year
  return 30;
}

/** R.D. of (year, month, day); months are numbered from Nisan = 1, Tishrei = 7, Adar (II) = 12 (13). */
function fixedFromHebrew(y: number, m: number, d: number): number {
  let f = newYear(y) + d - 1;
  if (m < 7) {
    for (let k = 7; k <= lastMonth(y); k++) f += monthDays(k, y);
    for (let k = 1; k < m; k++) f += monthDays(k, y);
  } else {
    for (let k = 7; k < m; k++) f += monthDays(k, y);
  }
  return f;
}

/** R.D. of a proleptic Gregorian date. */
export function fixedFromGregorian(y: number, m: number, d: number): number {
  const p = y - 1;
  const gl = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return 365 * p + Math.floor(p / 4) - Math.floor(p / 100) + Math.floor(p / 400) + Math.floor((367 * m - 362) / 12) + (m <= 2 ? 0 : gl ? -1 : -2) + d;
}

/** The Hebrew date of a Gregorian day: year (AM), month (Nisan = 1 .. Adar II = 13), day. */
export function hebrewFromGregorian(gy: number, gm: number, gd: number): { y: number; m: number; d: number } {
  const f = fixedFromGregorian(gy, gm, gd);
  let y = Math.floor((f - EPOCH) / (35975351 / 98496));
  while (newYear(y + 1) <= f) y++;
  while (newYear(y) > f) y--;
  let m = f < fixedFromHebrew(y, 1, 1) ? 7 : 1;
  while (f > fixedFromHebrew(y, m, monthDays(m, y))) m++;
  return { y, m, d: f - fixedFromHebrew(y, m, 1) + 1 };
}

// the month names as Chromium's ICU prints them in Hebrew (the leap year's Adar I / Adar II with a geresh)
const MONTHS = ['', 'ניסן', 'אייר', 'סיוון', 'תמוז', 'אב', 'אלול', 'תשרי', 'חשוון', 'כסלו', 'טבת', 'שבט'];

export function hebrewMonthName(m: number, y: number): string {
  if (m === 12) return leap(y) ? 'אדר א׳' : 'אדר';
  if (m === 13) return 'אדר ב׳';
  return MONTHS[m] ?? '';
}

/** "12 בחשוון 5787" for a Gregorian day (the browser's format: the day, the month with the prefix ב, the year in digits). */
export function hebrewDateText(gy: number, gm: number, gd: number): string {
  const h = hebrewFromGregorian(gy, gm, gd);
  return h.d + ' ב' + hebrewMonthName(h.m, h.y) + ' ' + h.y;
}

/** The calendar day of an instant in a time zone (the Gregorian calendar, which every browser has); null when even that fails. */
export function dayIn(tz: string, at: Date): { y: number; m: number; d: number } | null {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(at);
    const v = (t: string): number => Number(p.find((x) => x.type === t)?.value);
    const y = v('year');
    const m = v('month');
    const d = v('day');
    if (y && m && d) return { y, m, d };
  } catch {
    /* an unknown zone: the screen's own day below */
  }
  return Number.isFinite(at.getTime()) ? { y: at.getFullYear(), m: at.getMonth() + 1, d: at.getDate() } : null;
}

/** Does this browser format the Hebrew calendar in Hebrew? (calendar resolved to hebrew and the output carries Hebrew letters) */
export function nativeHebrewOk(fmt: { resolvedOptions(): { calendar?: string }; format(d: Date): string } | null, sample: Date): boolean {
  if (!fmt) return false;
  try {
    return fmt.resolvedOptions().calendar === 'hebrew' && /[א-ת]{2}/.test(fmt.format(sample));
  } catch {
    return false;
  }
}

/** The Hebrew date line of an instant in a zone: the browser's own Hebrew calendar when it has one, else the computed date. */
export function hebrewDate(tz: string, at: Date, make: (tz: string) => Intl.DateTimeFormat | null = nativeFormatter): string {
  const f = make(tz);
  if (nativeHebrewOk(f, at)) {
    try {
      return (f as Intl.DateTimeFormat).format(at);
    } catch {
      /* fall through to the computed date */
    }
  }
  const g = dayIn(tz, at);
  return g ? hebrewDateText(g.y, g.m, g.d) : '';
}

function nativeFormatter(tz: string): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });
  } catch {
    return null;
  }
}
