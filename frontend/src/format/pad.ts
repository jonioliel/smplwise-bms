/**
 * CR-FORMAT-2440 (review finding 08:F10): zero-padding, once. `pad`, `p`, `p2`, `two` were re-typed in 20+ modules.
 * Pure; no DOM, no imports (the public claim page's bundle takes it too).
 */

/** `7` -> `'07'`, `12` -> `'12'`, `123` -> `'123'` (never truncates). */
export const pad2 = (n: number | string): string => String(n).padStart(2, '0');

/** `(2026, 3, 7)` -> `'2026-03-07'`: a calendar day key from its numbers (the year is written as it is, month and day two digits). */
export const dayKey = (y: number, m: number, d: number): string => `${y}-${pad2(m)}-${pad2(d)}`;

/** `(9, 5)` -> `'09:05'`. */
export const hhmm = (h: number, min: number): string => `${pad2(h)}:${pad2(min)}`;
