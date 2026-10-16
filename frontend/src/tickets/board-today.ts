/**
 * TKUI4 (release 2.6.0): the manager board's "today" row (mock-up v5, the schedules screen's "next runs today" row; owner decision: on the
 * manager board ONLY) and the load meter of a handler group. Both are read from what the board already holds - no new request: the visits
 * are the ETAs that fall on today, the next target is the nearest SLA cell of today, and "waiting for me" is the board's own count.
 * Pure: tests/unit-tickets-list.spec.ts.
 */
import type { BoardCounts, BoardItem } from '../api/tickets-board';
import { clip } from './status-sentence';
import { lt } from './list-text';

export interface TodayEntry {
  kind: 'visit' | 'sla' | 'waiting';
  /** "09:00" (local) for a timed entry */
  time: string;
  label: string;
  /** the quiet second part ("חדר ישיבות", "#1039 ריח במטבחון") */
  what: string;
  tone: 'info' | 'warn' | 'ok';
  /** the request an entry opens (visit / sla) */
  id: string;
}

export const MAX_VISITS = 2;
const FINAL = ['closed', 'cancelled'];

const pad = (n: number) => String(n).padStart(2, '0');
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** The facts of today, in the order the row reads them: visits (earliest first, at most two), the next target, what waits for the manager. */
export function todayEntries(items: readonly BoardItem[], counts: Pick<BoardCounts, 'waiting'>, now: Date): TodayEntry[] {
  const open = items.filter((x) => !FINAL.includes(x.status));
  const out: TodayEntry[] = [];

  const visits = open
    .filter((x) => x.eta_at && x.assignee)
    .map((x) => ({ x, at: new Date(x.eta_at as string) }))
    .filter(({ at }) => !Number.isNaN(at.getTime()) && sameDay(at, now) && at.getTime() >= now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_VISITS);
  for (const { x, at } of visits) out.push({ kind: 'visit', time: hhmm(at), label: `${lt('bdVisit')} · ${x.assignee?.name ?? ''}`, what: x.place_text || x.device_name, tone: 'info', id: x.id });

  const slas = open
    .filter((x) => x.sla_cell && !x.sla_cell.over)
    .map((x) => ({ x, at: new Date((x.sla_cell as { at: string }).at) }))
    .filter(({ at }) => !Number.isNaN(at.getTime()) && sameDay(at, now) && at.getTime() >= now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (slas.length) {
    const { x, at } = slas[0];
    out.push({ kind: 'sla', time: hhmm(at), label: lt('bdSla'), what: `#${x.number} ${clip(x.title, 28)}`, tone: 'warn', id: x.id });
  }

  if (counts.waiting > 0) out.push({ kind: 'waiting', time: '', label: lt(counts.waiting === 1 ? 'bdWaitingMineOne' : 'bdWaitingMine', { n: counts.waiting }), what: '', tone: 'ok', id: '' });
  return out;
}

export const LOAD_SEGMENTS = 4;

/** The little meter beside a handler group: filled segments by the number of requests in hand; the last segment turns "hot" at full load. */
export function loadMeter(count: number): { on: number; total: number; hot: boolean } {
  const on = Math.max(0, Math.min(LOAD_SEGMENTS, count));
  return { on, total: LOAD_SEGMENTS, hot: count >= LOAD_SEGMENTS };
}
