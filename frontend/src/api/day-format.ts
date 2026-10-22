/**
 * One date format for operator screens (DOCSUX-295, UX audit 2026-10-20 finding 18): "30.09.2026" and "30.09.2026 14:05" - day and
 * month always two digits, dots, a four-digit year, 24-hour clock, the browser's zone. This is the format the electricity screens already
 * used (electricity/elec-format.ts); the screens that called toLocaleDateString('he-IL') showed "30.9.2026" next to "14.10.2026", and a
 * payment date was shown as raw ISO. Pure functions, no DOM; '' for an empty or invalid value.
 */
const p2 = (n: number): string => String(n).padStart(2, '0');

function parse(v: string | number | Date | null | undefined): Date | null {
  if (v === null || v === undefined || v === '') return null;
  // a bare calendar day is a local day, not UTC midnight (so it never shows the day before in a zone west of UTC)
  const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10))) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "30.09.2026" */
export function dayText(v: string | number | Date | null | undefined): string {
  const d = parse(v);
  return d ? `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}` : '';
}

/** "30.09.2026 14:05" */
export function dayTimeText(v: string | number | Date | null | undefined): string {
  const d = parse(v);
  return d ? `${dayText(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}` : '';
}
