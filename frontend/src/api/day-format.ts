/**
 * THE date/time format of operator screens (DOCSUX-295 finding 18, extended by DATEFMT60-295 / board r060).
 * Hebrew product: "30.09.2026", "30.09.2026 14:05", "30.09", "14:05" - day and month always two digits, dots, a four-digit
 * year, 24-hour clock. The user's language setting only changes the separator (`lang: 'en'` -> "30/09/2026"); the digits
 * stay Latin. `timeZone` is the installation's IANA zone (omit for the browser zone). Pure functions, no DOM; '' for an
 * empty or invalid value. Built on Intl.formatToParts('en-US') so the output never depends on the browser's own locale.
 */
export type DateInput = string | number | Date | null | undefined;
export interface DateFmtOptions { timeZone?: string; lang?: string; seconds?: boolean }

const BARE_DAY = /^\d{4}-\d{2}-\d{2}$/;

function parse(v: DateInput): Date | null {
  if (v === null || v === undefined || v === '') return null;
  // a bare calendar day is a local day, not UTC midnight (so it never shows the day before in a zone west of UTC)
  const d = typeof v === 'string' && BARE_DAY.test(v) ? new Date(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10))) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const formatters = new Map<string, Intl.DateTimeFormat | null>();
function formatterFor(zone: string | undefined): Intl.DateTimeFormat | null {
  const key = zone ?? '';
  let f = formatters.get(key);
  if (f === undefined) {
    try {
      f = new Intl.DateTimeFormat('en-US', { ...(zone ? { timeZone: zone } : {}), hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      f = zone ? formatterFor(undefined) : null; // an unknown zone name falls back to the browser zone
    }
    formatters.set(key, f);
  }
  return f;
}

interface Parts { d: string; m: string; y: string; h: string; mi: string; s: string }
function partsOf(v: DateInput, zone?: string): Parts | null {
  const date = parse(v);
  if (!date) return null;
  if (typeof v === 'string' && BARE_DAY.test(v)) return { d: v.slice(8, 10), m: v.slice(5, 7), y: v.slice(0, 4), h: '00', mi: '00', s: '00' };
  const f = formatterFor(zone);
  if (!f) return null;
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(date)) if (p.type !== 'literal') o[p.type] = p.value;
  return { d: o.day, m: o.month, y: o.year, h: o.hour === '24' ? '00' : o.hour, mi: o.minute, s: o.second };
}

const sep = (o?: DateFmtOptions): string => (o?.lang === 'en' ? '/' : '.');

/** "30.09.2026" */
export function dayText(v: DateInput, o?: DateFmtOptions): string {
  const p = partsOf(v, o?.timeZone);
  return p ? [p.d, p.m, p.y].join(sep(o)) : '';
}

/** "30.09" (no year) */
export function dayMonthText(v: DateInput, o?: DateFmtOptions): string {
  const p = partsOf(v, o?.timeZone);
  return p ? [p.d, p.m].join(sep(o)) : '';
}

/** "14:05" ("14:05:09" with `seconds`) */
export function timeText(v: DateInput, o?: DateFmtOptions): string {
  const p = partsOf(v, o?.timeZone);
  return p ? `${p.h}:${p.mi}${o?.seconds ? `:${p.s}` : ''}` : '';
}

/** "30.09.2026 14:05" */
export function dayTimeText(v: DateInput, o?: DateFmtOptions): string {
  const d = dayText(v, o);
  return d ? `${d} ${timeText(v, o)}` : '';
}

/** "30.09 14:05" (no year) */
export function dayMonthTimeText(v: DateInput, o?: DateFmtOptions): string {
  const d = dayMonthText(v, o);
  return d ? `${d} ${timeText(v, o)}` : '';
}

/** BCP-47 tag for the `lang` attribute of a date, time or datetime-local input: the browser draws its own "dd/mm/yyyy" hint
 * in the language of the element, so the Hebrew product says he-IL (en-GB when the user's language is English). */
export function dateInputLangFor(lang?: string | null): string {
  return String(lang ?? '').toLowerCase().startsWith('en') ? 'en-GB' : 'he-IL';
}

/** The same, read from the page language (`<html lang>`), for use in templates: `<input type="date" lang=${dateInputLang()}>`. */
export function dateInputLang(): string {
  return dateInputLangFor(typeof document === 'undefined' ? '' : document.documentElement.lang);
}
