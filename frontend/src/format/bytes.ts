/**
 * CR-FORMAT-2440 (review finding 08:F10): a byte size as text, once. Four modules carried their own `formatBytes`, each with a
 * slightly different output ("KB" vs "ק״ב", bytes shown or not, "0 KB" allowed or not, one or two decimals). The differences are
 * real product choices of each screen, so they are OPTIONS here and every call site keeps its exact output; the arithmetic lives once.
 * Pure; no DOM, no imports (the public claim page's bundle takes it too).
 */

export interface ByteUnits {
  b: string;
  kb: string;
  mb: string;
  gb: string;
}

export const BYTE_UNITS_EN: ByteUnits = { b: 'B', kb: 'KB', mb: 'MB', gb: 'GB' };
/** Hebrew abbreviations (with the gershayim, U+05F4). */
export const BYTE_UNITS_HE: ByteUnits = { b: 'B', kb: 'ק״ב', mb: 'מ״ב', gb: 'ג״ב' };

/**
 * How the megabyte figure is written:
 *  - `'fixed1'`  `(n / MiB).toFixed(1)`                          "1.4", "12.0"
 *  - `'round1'`  `(Math.round(n / MiB * 10) / 10).toFixed(1)`    the same digits, rounded half-up on the decimal value
 *  - `'short'`   under 10: one decimal without a trailing ".0" ("1.2", "3"); from 10: a whole number ("12")
 */
export type MbStyle = 'fixed1' | 'round1' | 'short';

export interface BytesOptions {
  /** Unit labels. Default English ("B", "KB", "MB", "GB"). */
  units?: ByteUnits;
  /** Under 1024 show the bytes themselves ("312 B") instead of kilobytes. Default false. */
  showBytes?: boolean;
  /** The smallest kilobyte figure: 1 = a tiny file is "1 KB", never "0 KB". Default: none (plain rounding). */
  minKb?: number;
  /** The megabyte figure. Default `'fixed1'`. */
  mb?: MbStyle;
  /** From 1 GiB write gigabytes with two decimals ("1.25 GB"). Default false (megabytes all the way up). */
  gb?: boolean;
  /** What a non-finite or negative number gives. Default: not checked (the number is formatted as it is). */
  invalid?: string;
}

const KIB = 1024;
const MIB = 1024 * 1024;
const GIB = 1024 * 1024 * 1024;

function mbFigure(n: number, style: MbStyle): string {
  const v = n / MIB;
  if (style === 'round1') return (Math.round(v * 10) / 10).toFixed(1);
  if (style === 'short') return v < 10 ? v.toFixed(1).replace(/\.0$/, '') : String(Math.round(v));
  return v.toFixed(1);
}

/** A byte count as "312 KB" / "1.4 MB" / "1.25 GB", in the shape the options ask for. */
export function formatByteSize(n: number, options: BytesOptions = {}): string {
  const units = options.units ?? BYTE_UNITS_EN;
  if (options.invalid !== undefined && (!Number.isFinite(n) || n < 0)) return options.invalid;
  if (options.showBytes && n < KIB) return `${n} ${units.b}`;
  if (n < MIB) {
    const kb = Math.round(n / KIB);
    return `${options.minKb === undefined ? kb : Math.max(options.minKb, kb)} ${units.kb}`;
  }
  if (options.gb && !(n < GIB)) return `${(n / GIB).toFixed(2)} ${units.gb}`;
  return `${mbFigure(n, options.mb ?? 'fixed1')} ${units.mb}`;
}
