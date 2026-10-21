/**
 * CR-WA-PACING-295: the pure logic of the shared send-budget card (Settings > messaging channel) - no DOM, runs in Node.
 */
import { PACING_CLASSES, type PacingAccount, type PacingClass, type PacingView } from '../api/messaging-pacing';

export const WAIT_RANGE: [number, number] = [1, 2880];

/** A duration in seconds as a short number plus unit: 45 s -> {n:45,u:'s'}, 540 -> {n:9,u:'m'}, 7300 -> {n:2,u:'h'}. */
export function span(seconds: number): { n: number; u: 's' | 'm' | 'h' } {
  const s = Math.max(0, Math.round(seconds));
  if (s < 90) return { n: s, u: 's' };
  if (s < 5400) return { n: Math.round(s / 60), u: 'm' };
  return { n: Math.round(s / 3600), u: 'h' };
}

/** A whole number in [lo, hi] from a field, or null. */
export function intValue(raw: string, lo: number, hi: number): number | null {
  if (!/^\d{1,4}$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n >= lo && n <= hi ? n : null;
}
export const MINUTE_RANGE: [number, number] = [1, 120];
export const BURST_RANGE: [number, number] = [1, 60];

/** A queue-limit field's value -> the minutes to send, or null when it is not a whole number in range. */
export function waitValue(raw: string): number | null {
  if (!/^\d{1,4}$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n >= WAIT_RANGE[0] && n <= WAIT_RANGE[1] ? n : null;
}

/** Which classes changed against the saved view (only those are sent). */
export function changedWaits(view: PacingView, edited: Partial<Record<PacingClass, number>>): Partial<Record<PacingClass, number>> {
  const out: Partial<Record<PacingClass, number>> = {};
  for (const k of PACING_CLASSES) if (edited[k] !== undefined && edited[k] !== view.max_wait_min[k]) out[k] = edited[k];
  return out;
}

/** The platform slowed this account down in the last 24 hours (a pair or the whole account), or is slowing it now. */
export function slowed(a: PacingAccount): boolean {
  return a.backoff !== null || a.pairs_in_backoff > 0 || a.counters_24h.backoff + a.counters_24h.pair_backoff > 0;
}

/** Tone of an account's row: bad = messages ended on the age limit, warn = the platform slowed it or a backoff is in force, ok otherwise. */
export function tone(a: PacingAccount): 'bad' | 'warn' | 'ok' {
  if (a.counters_24h.expired > 0) return 'bad';
  return slowed(a) ? 'warn' : 'ok';
}
