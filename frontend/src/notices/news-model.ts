/**
 * NOTICERSS-295: the pure rules of the news-sources editor (הגדרות › לוח הודעות › מקורות חדשות): the draft rows, their validation (the same
 * limits the server enforces: https only, a name of 1-40 characters on EVERY source, no repeated address, at most 12), reordering, and what
 * the board editor shows for a feed it stored. No DOM, no network.
 */
import type { NewsSource } from '../api/notices';

export const NAME_MAX = 40;
export const SOURCES_MAX = 12;
export const LOGO_ACCEPT = 'image/png,image/jpeg';
export const LOGO_MAX_BYTES = 300_000;

/** One editable row: `id` is '' for a source that was never saved. */
export interface Row {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  has_logo: boolean;
  logo_url: string;
  custom: boolean;
}

export type RowError = 'name' | 'url' | 'dup' | '';

export function rowsOf(list: NewsSource[]): Row[] {
  return list.map((s) => ({ id: s.id, name: s.name, url: s.url, enabled: s.enabled !== false, has_logo: !!s.has_logo, logo_url: s.logo_url || '', custom: !!s.custom }));
}

export function emptyRow(): Row {
  return { id: '', name: '', url: 'https://', enabled: true, has_logo: false, logo_url: '', custom: false };
}

/** The same address rule the server applies before it fetches: https, no credentials, no spaces, no private literal host, at most 400 characters. */
export function urlOk(raw: string): boolean {
  const u = raw.trim();
  if (!u || u.length > 400 || /[\s\\]/.test(u)) return false;
  let p: URL;
  try {
    p = new URL(u);
  } catch {
    return false;
  }
  if (p.protocol !== 'https:' || p.username || p.password || (p.port && p.port !== '443')) return false;
  const h = p.hostname.toLowerCase();
  if (!h.includes('.') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.localhost') || h.endsWith('.internal')) return false;
  if (/^[0-9.]+$/.test(h)) return !/^(0|10|127)\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(h);
  return !h.startsWith('[');
}

/** The first problem of each row ('' = fine); a repeated address is flagged on its second row. */
export function validate(rows: Row[]): RowError[] {
  const seen = new Set<string>();
  return rows.map((r) => {
    const name = r.name.trim();
    if (!name || name.length > NAME_MAX) return 'name';
    if (!urlOk(r.url)) return 'url';
    const key = r.url.trim();
    if (seen.has(key)) return 'dup';
    seen.add(key);
    return '';
  });
}

export function canSave(rows: Row[]): boolean {
  return rows.length <= SOURCES_MAX && validate(rows).every((e) => e === '');
}

export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const out = list.slice();
  out.splice(to, 0, out.splice(from, 1)[0]);
  return out;
}

export function payload(rows: Row[]): { id?: string; name: string; url: string; enabled: boolean }[] {
  return rows.map((r) => ({ ...(r.id ? { id: r.id } : {}), name: r.name.trim(), url: r.url.trim(), enabled: r.enabled }));
}

export function isDirty(rows: Row[], saved: Row[]): boolean {
  return JSON.stringify(payload(rows)) !== JSON.stringify(payload(saved)) || rows.some((r) => r.custom) /* an unadopted raw URL is saved by saving */;
}

/** What the board editor shows for a feed it stored: the list's current name and logo when the feed is in the list (by id, then by address). */
export function feedView(feed: { id?: string; name: string; url: string }, list: NewsSource[]): { name: string; logo: string; known: boolean } {
  const s = list.find((x) => (feed.id && x.id === feed.id) || x.url === feed.url);
  return s ? { name: s.name, logo: s.logo_url || '', known: !s.custom } : { name: feed.name, logo: '', known: false };
}

/** A name to show in a narrow place: cut at `max` characters with an ellipsis (the TV cuts by CSS; this is for the editor's compact chips). */
export function shortName(name: string, max = 24): string {
  const t = name.trim();
  return t.length <= max ? t : t.slice(0, max - 1) + '…';
}
