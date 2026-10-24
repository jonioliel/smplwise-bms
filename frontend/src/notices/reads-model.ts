import type { ReadsAnswer } from '../api/notices';

/** NOTICEPAGE-295: the pure shape of the "מי קרא" sheet (no DOM). */
export type ReadsSeg = 'read' | 'unread';

export interface ReadsRow { name: string; place: string; at: string }

export interface ReadsView {
  read: number;
  unread: number;
  total: number;
  /** 0-100, whole percent of the recipients that read (0 with no recipients) */
  pct: number;
  /** the names are on (the answer carries the lists) */
  named: boolean;
  rows: Record<ReadsSeg, ReadsRow[]>;
}

const two = (x: number) => ('0' + x).slice(-2);

/** "24.10 08:41" in the browser's local time; an unreadable value stays empty. */
export function readAtText(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${two(d.getDate())}.${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** The pure shape of the sheet: counts, the percentage and both lists (read: newest first; unread: by name). */
export function readsView(a: ReadsAnswer): ReadsView {
  const named = Array.isArray(a.users) && Array.isArray(a.unread);
  const read = named ? a.users!.length : a.read;
  const total = named ? a.users!.length + a.unread!.length : a.audience;
  const byName = (x: ReadsRow, y: ReadsRow) => x.name.localeCompare(y.name, 'he');
  const readRows = (a.users ?? []).map((u) => ({ name: u.name, place: u.place ?? '', at: u.read_at }));
  readRows.sort((x, y) => Date.parse(y.at) - Date.parse(x.at) || byName(x, y));
  const unreadRows = (a.unread ?? []).map((u) => ({ name: u.name, place: u.place ?? '', at: '' })).sort(byName);
  return { read, unread: Math.max(0, total - read), total, pct: total > 0 ? Math.round((read * 100) / total) : 0, named, rows: { read: readRows, unread: unreadRows } };
}
