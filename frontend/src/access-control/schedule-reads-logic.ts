/**
 * WISKEY-SCHED-READS-2520: the pure part of the signed schedule inspections block (components/wk-schedule-reads.ts) - which tone and
 * which words a state gets, what a completed result is summarised as, and when a start / a status check may be offered. Checked by
 * tests/unit-schedule-reads-2520.spec.ts. Honest rules:
 *   - `unknown` is never shown as done or as "not sent": it says that only a status check can tell;
 *   - `accepted` / `running` are not completion;
 *   - a start is offered only while the server says the cycle is `supported` and the screen's copy is current;
 *   - the browser never re-sends a start: an unknown row offers a STATUS check only.
 */
import type { ScheduleRead, ScheduleReadsSupport } from '../api/schedule-reads';
import type { Tone } from './schedule-editor-logic';

export type ReadState = 'sending' | 'not_sent' | 'accepted' | 'running' | 'completed' | 'refused' | 'unknown';
export const READ_STATES: readonly ReadState[] = ['sending', 'not_sent', 'accepted', 'running', 'completed', 'refused', 'unknown'];
const STARTABLE = ['readiness', 'dependencies'] as const;
export const SHOWN = 5;

export function readState(state: string | null | undefined): ReadState {
  return (READ_STATES as readonly string[]).includes(state ?? '') ? (state as ReadState) : 'unknown';
}

export function readTone(state: string | null | undefined): Tone {
  switch (readState(state)) {
    case 'completed':
      return 'live';
    case 'accepted':
    case 'running':
    case 'sending':
      return 'neutral';
    case 'refused':
      return 'error';
    case 'not_sent':
      return 'offline';
    default:
      return 'unknown';
  }
}

type SupportState = 'supported' | 'unsupported' | 'unavailable' | 'loading' | 'failed';

/** The block's support line: `loading` before the first answer, `failed` when the list itself could not be read. */
export function supportState(support: ScheduleReadsSupport | null | undefined, failed = false): SupportState {
  if (failed) return 'failed';
  if (!support) return 'loading';
  return support.state === 'supported' || support.state === 'unsupported' ? support.state : 'unavailable';
}

export function canStart(support: ScheduleReadsSupport | null | undefined, live: boolean, busy: boolean, stationOnline: boolean | null): boolean {
  return supportState(support) === 'supported' && live && !busy && stationOnline === true;
}

/** A status check is offered for a row that is not final and not being sent (the server's `can_check`), and only while supported. */
export function canCheck(read: ScheduleRead, support: ScheduleReadsSupport | null | undefined, busy: boolean): boolean {
  return read.can_check === true && !read.final && supportState(support) === 'supported' && !busy;
}

export interface Summary {
  key: 'sumReadiness' | 'sumDependencies' | 'sumPlan' | 'sumDone' | 'sumNoData';
  vars: Record<string, string | number>;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** One line about a completed result (the projection is the server's closed one; anything missing reads as unknown). */
export function summaryOf(read: ScheduleRead): Summary | null {
  if (readState(read.state) !== 'completed') return null;
  const d = read.data as Record<string, unknown> | null;
  if (!d) return { key: 'sumNoData', vars: {} };
  if (read.action === 'readiness') {
    const checks = Array.isArray(d.checks) ? (d.checks as Record<string, unknown>[]) : [];
    const readable = checks.filter((c) => c && c.read_state === 'readable').length;
    return { key: 'sumReadiness', vars: { readable, total: checks.length } };
  }
  if (read.action === 'dependencies') {
    const users = (d.users ?? null) as Record<string, unknown> | null;
    const n = num(users?.read);
    return { key: 'sumDependencies', vars: { users: n === null ? '?' : n } };
  }
  if (read.plan_revision !== null && read.plan_revision !== undefined) return { key: 'sumPlan', vars: { revision: read.plan_revision } };
  return { key: 'sumDone', vars: {} };
}

/** The newest first, at most SHOWN (the block never scrolls); `more` is how many older rows are not shown. */
export function visibleReads(reads: ScheduleRead[] | null | undefined, shown = SHOWN): { rows: ScheduleRead[]; more: number } {
  const all = [...(reads ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  return { rows: all.slice(0, shown), more: Math.max(0, all.length - shown) };
}
