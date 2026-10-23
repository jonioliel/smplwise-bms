/** CR-EMERG104: the pure part of the emergency readiness screens (no DOM, no fetch) - the unit spec calls these directly. */
import type { ItemStatus } from '../api/emergency';
import { em } from '../i18n/emergency';

export type Filter = 'all' | 'red' | 'amber' | 'unknown' | 'not_applicable';

/** The age of a fact in words; null stays empty. */
export function ageText(s: number | null | undefined, lang: 'he' | 'en' = 'he'): string {
  if (s === null || s === undefined || s < 0) return '';
  if (s < 3600) return em('ageMin', { n: Math.max(1, Math.round(s / 60)) }, lang);
  if (s < 172800) return em('ageHour', { n: Math.round(s / 3600) }, lang);
  return em('ageDay', { n: Math.round(s / 86400) }, lang);
}

export function matches(f: Filter, status: ItemStatus): boolean {
  return f === 'all' || status === f;
}

/** A draft number text -> a number inside [lo, hi], else null. */
export function parseThreshold(text: string, lo: number, hi: number): number | null {
  const t = text.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const v = Number(t);
  return v >= lo && v <= hi ? v : null;
}
