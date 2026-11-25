/**
 * WISKEY-A2-EXEC-2530: the pure part of the read-only "status in WisKey" block (components/wk-schedule-exec.ts) - which tone a phase
 * gets, when a status check may be offered, which rows are shown (no inner scrolling), and whether the deploy warning may be softened.
 * Checked by tests/unit-schedule-execution-2530.spec.ts. Honest rules:
 *   - nothing here ever offers to approve, run or cancel: the owner does that in WisKey's own screen;
 *   - `unknown` is never shown as done; a legacy job (no deployment record) is never `executed` (the server's rule);
 *   - the deploy warning is softened only after a status read showed a job `executed` while the switch is on.
 */
import type { ScheduleExecutionJob, ScheduleExecutionSupport, ScheduleExecutionView } from '../api/schedule-execution';
import type { Tone } from './schedule-editor-logic';

export type ExecPhase =
  | 'waiting_owner'
  | 'review_pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'attention'
  | 'executed'
  | 'failed'
  | 'cancelled'
  | 'not_found'
  | 'unknown'
  | 'not_read';
export const EXEC_PHASES: readonly ExecPhase[] = [
  'waiting_owner',
  'review_pending',
  'approved',
  'rejected',
  'executing',
  'attention',
  'executed',
  'failed',
  'cancelled',
  'not_found',
  'unknown',
  'not_read',
];
export const SHOWN = 5;

export function execPhase(job: ScheduleExecutionJob | null | undefined): ExecPhase {
  if (!job) return 'not_read';
  return (EXEC_PHASES as readonly string[]).includes(job.phase) ? (job.phase as ExecPhase) : 'unknown';
}

export function execTone(phase: ExecPhase): Tone {
  switch (phase) {
    case 'executed':
      return 'live';
    case 'waiting_owner':
    case 'review_pending':
    case 'attention':
      return 'stale';
    case 'rejected':
    case 'failed':
      return 'error';
    case 'cancelled':
    case 'not_found':
      return 'offline';
    case 'approved':
    case 'executing':
    case 'not_read':
      return 'neutral';
    default:
      return 'unknown';
  }
}

export type ExecSupportState = 'supported' | 'unsupported' | 'unavailable' | 'off' | 'loading' | 'failed';

export function execSupport(support: ScheduleExecutionSupport | null | undefined, failed = false): ExecSupportState {
  if (failed) return 'failed';
  if (!support) return 'loading';
  if (support.state === 'supported' || support.state === 'unsupported' || support.state === 'off') return support.state;
  return 'unavailable';
}

/** A status check: only while on and supported, for a job that is not final (executed / cancelled are never read again). */
export function canCheckExec(job: ScheduleExecutionJob | null | undefined, view: ScheduleExecutionView | null | undefined, busy: boolean): boolean {
  if (!view?.enabled || execSupport(view.support) !== 'supported' || busy) return false;
  return !job?.final;
}

/** The rows shown: the jobs of the screen's operations answer (newest first as the screen has them), at most SHOWN. */
export function visibleJobs<T extends { id: string }>(jobs: readonly T[]): { rows: T[]; more: number } {
  const rows = jobs.slice(0, SHOWN);
  return { rows, more: Math.max(0, jobs.length - rows.length) };
}

/** True when the switch is on and a status read showed at least one job executed (WisKey's own read-back). */
export function anyExecuted(view: ScheduleExecutionView | null | undefined): boolean {
  return !!view?.enabled && (view.jobs ?? []).some((j) => j.phase === 'executed');
}
