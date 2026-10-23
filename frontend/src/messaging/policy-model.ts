/**
 * WAPACE-295: the pure logic of the WhatsApp policy card (allow-list and self-messages window) - no DOM, runs in Node.
 */
import type { PolicyEntry } from '../api/messaging-policy';

export const PAGE_SIZE = 5;

/** The digits of a typed number (spaces, dashes, brackets and a leading + removed), or null when it is not 8-15 digits. */
export function phoneDigits(raw: string): string | null {
  const d = raw.trim().replace(/^\+/, '').replace(/[\s\-().]/g, '');
  return /^\d{8,15}$/.test(d) ? d : null;
}

/** A whole number of minutes in [lo, hi] from a field, or null. */
export function minutesValue(raw: string, range: [number, number]): number | null {
  if (!/^\d{1,3}$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n >= range[0] && n <= range[1] ? n : null;
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/** The entries of one page (0-based, clamped), so a long list never needs a scrollbar. */
export function pageOf(entries: PolicyEntry[], page: number): { items: PolicyEntry[]; page: number; pages: number } {
  const pages = pageCount(entries.length);
  const p = Math.min(Math.max(0, page), pages - 1);
  return { items: entries.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE), page: p, pages };
}

/** Enforcement on with nobody listed would stop every WhatsApp message: the card says so. */
export function blocksEverything(enforce: boolean, entries: number): boolean {
  return enforce && entries === 0;
}
