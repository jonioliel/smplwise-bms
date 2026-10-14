/**
 * CR-038 slice 4 (spec 10.7, review C12): every time on the handler page is the BUILDING's time - the installation's IANA zone
 * (`time_zone` from the API) - whatever zone the phone is in. Instants travel as UTC ISO text (`...Z`). No library: the zone's
 * offset at an instant comes from Intl.DateTimeFormat, and a wall-clock time in the zone is turned into an instant with two
 * passes (correct across a DST change).
 */
import type { Lang } from './strings';

const LOCALES: Record<Lang, string> = { he: 'he-IL', en: 'en-GB', ar: 'ar-u-nu-latn', ru: 'ru-RU' };

interface Parts { y: number; m: number; d: number; h: number; mi: number }

export function zonedParts(ms: number, zone: string): Parts {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(new Date(ms))) if (part.type !== 'literal') p[part.type] = Number(part.value);
  return { y: p.year, m: p.month, d: p.day, h: p.hour === 24 ? 0 : p.hour, mi: p.minute };
}

function offsetMs(ms: number, zone: string): number {
  const p = zonedParts(ms, zone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
  return asUtc - Math.floor(ms / 60000) * 60000;
}

/** The instant of a wall-clock time in `zone`. */
export function instantOf(y: number, m: number, d: number, h: number, mi: number, zone: string): number {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - offsetMs(guess, zone);
  return guess - offsetMs(first, zone);
}

export function isoOf(ms: number): string {
  return new Date(Math.floor(ms / 60000) * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function parseIso(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

export type EtaChoice = 'today' | 'tomorrow' | 'two_days';

/** The ETA of a chip: today at 17:00 (or the next full hour when that has passed, at most 23:00); tomorrow / in two days at 12:00. */
export function etaFor(choice: EtaChoice, nowMs: number, zone: string): string {
  const p = zonedParts(nowMs, zone);
  if (choice === 'today') {
    let h = 17;
    if (p.h >= 16) h = Math.min(23, p.h + 1 + (p.mi > 0 ? 1 : 0));
    let at = instantOf(p.y, p.m, p.d, h, 0, zone);
    if (at < nowMs + 30 * 60000) at = Math.ceil((nowMs + 3600000) / 300000) * 300000; // late evening: an hour from now
    return isoOf(at);
  }
  const days = choice === 'tomorrow' ? 1 : 2;
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  return isoOf(instantOf(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), 12, 0, zone));
}

/** `YYYY-MM-DDTHH:MM` (a datetime-local value) read in `zone` -> UTC ISO; null for a malformed value. */
export function localInputToIso(value: string, zone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  return isoOf(instantOf(+m[1], +m[2], +m[3], +m[4], +m[5], zone));
}

export function isoToLocalInput(iso: string | null | undefined, zone: string): string {
  const t = parseIso(iso);
  if (t === null) return '';
  const p = zonedParts(t, zone);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${p.y}-${two(p.m)}-${two(p.d)}T${two(p.h)}:${two(p.mi)}`;
}

/** A short date-and-time in the building's zone, in the page's language. */
export function formatWhen(iso: string | null | undefined, zone: string, lang: Lang): string {
  const t = parseIso(iso);
  if (t === null) return '';
  try {
    return new Intl.DateTimeFormat(LOCALES[lang], { timeZone: zone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t));
  } catch {
    return new Date(t).toISOString().slice(0, 16).replace('T', ' ');
  }
}

export function formatDate(iso: string | null | undefined, zone: string, lang: Lang): string {
  const t = parseIso(iso);
  if (t === null) return '';
  try {
    return new Intl.DateTimeFormat(LOCALES[lang], { timeZone: zone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(t));
  } catch {
    return new Date(t).toISOString().slice(0, 10);
  }
}

/** The zone's name to show next to times - only when the phone's own zone differs (spec 10.7). */
export function zoneNote(zone: string): string | null {
  try {
    const own = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!own || own === zone) return null;
    const now = Date.now();
    return offsetMs(now, zone) === offsetMs(now, own) ? null : zone;
  } catch {
    return null;
  }
}

export function locale(lang: Lang): string {
  return LOCALES[lang];
}
