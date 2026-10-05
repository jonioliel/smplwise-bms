/** Number and date formatting of the electricity screens: Western digits, two decimals for kWh, local time of the browser. */
const nf = (min: number, max: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max });
const KWH = nf(2, 2);
const INT = nf(0, 0);
const ILS = nf(2, 2);

export const fmtKwh = (v: number | null | undefined): string => (v == null ? '-' : KWH.format(v));
export const fmtInt = (v: number | null | undefined): string => (v == null ? '-' : INT.format(v));
export const fmtIls = (v: number | null | undefined): string => (v == null ? '-' : `${ILS.format(v)} ₪`);

export function fmtMb(bytes: number): string {
  const mb = bytes / 1_048_576;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

const p2 = (n: number) => String(n).padStart(2, '0');
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
}
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

/** EL6: meter readings carry up to three decimals (Wh); kWh elsewhere on the screens carry two. */
const R3 = nf(0, 3);
export const fmtReading = (v: number | null | undefined): string => (v == null ? '-' : R3.format(v));
/** EL6: a signed kWh difference (the sign before the digits; render it in an LTR-isolated span inside RTL text). */
export const fmtSigned = (v: number): string => `${v > 0 ? '+' : v < 0 ? '\u2212' : ''}${R3.format(Math.abs(v))}`;
