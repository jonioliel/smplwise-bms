/**
 * SECFIX2-295 (owner 2026-10-21): the pure logic of the undecided-technicians panel and of the public-interface settings page
 * (unit-tested by tests/unit-security-public.spec.ts). No DOM, no network.
 */
import type { PendingRow } from '../api/access-grants';
import { spt, type SpLang } from '../i18n/security-public';

export const RETENTION_MIN = 7;
export const RETENTION_MAX = 365;
export const CAP_MAX = 100;

/** "waiting N days" / "since today". */
export function waitText(row: Pick<PendingRow, 'days'>, lang?: SpLang): string {
  return row.days <= 0 ? spt('pendToday', undefined, lang) : spt('pendDays', { n: row.days }, lang);
}

/** The auto-delete countdown; null days_left = retention off. */
export function leftText(row: Pick<PendingRow, 'days_left'>, lang?: SpLang): string {
  if (row.days_left === null || row.days_left === undefined) return spt('pendNoAuto', undefined, lang);
  return row.days_left <= 0 ? spt('pendLeftToday', undefined, lang) : spt('pendLeft', { n: row.days_left }, lang);
}

/** The tone of the countdown chip: err at 7 days or less, warn at 30 or less. */
export function leftTone(row: Pick<PendingRow, 'days_left'>): 'err' | 'warn' | 'off' {
  if (row.days_left === null || row.days_left === undefined) return 'off';
  return row.days_left <= 7 ? 'err' : row.days_left <= 30 ? 'warn' : 'off';
}

/** Closest to deletion first, then the longest waiting; retention off keeps the server's order (oldest first). */
export function sortPending(rows: readonly PendingRow[]): PendingRow[] {
  return [...rows].sort((a, b) => (a.days_left ?? Number.MAX_SAFE_INTEGER) - (b.days_left ?? Number.MAX_SAFE_INTEGER) || b.days - a.days);
}

/** The ticket reference text - only when the server sent one (it sends none while the tickets module is off). Never a link. */
export function ticketText(row: Pick<PendingRow, 'ticket_number'>, lang?: SpLang): string {
  return row.ticket_number === null || row.ticket_number === undefined ? '' : spt('pendTicket', { n: row.ticket_number }, lang);
}

function integer(raw: string): number | null {
  const t = raw.trim();
  return /^\d{1,4}$/.test(t) ? Number(t) : null;
}

/** The retention field: 0 (off) or 7-365 whole days, else null. */
export function parseRetention(raw: string): number | null {
  const n = integer(raw);
  return n !== null && (n === 0 || (n >= RETENTION_MIN && n <= RETENTION_MAX)) ? n : null;
}

/** The cap field: 0 (no cap) to 100, else null. */
export function parseCap(raw: string): number | null {
  const n = integer(raw);
  return n !== null && n <= CAP_MAX ? n : null;
}
