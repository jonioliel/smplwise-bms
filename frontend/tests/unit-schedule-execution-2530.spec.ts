import { test, expect } from '@playwright/test';
import { EXEC_PHASES, SHOWN, anyExecuted, canCheckExec, execPhase, execSupport, execTone, visibleJobs } from '../src/access-control/schedule-execution-logic';
import type { ScheduleExecutionJob, ScheduleExecutionView } from '../src/api/schedule-execution';

// WISKEY-A2-EXEC-2530: the pure rules of the read-only "status in WisKey" block (src/access-control/schedule-execution-logic.ts).
const CONTRACT = 'wiskey-schedule-execution.v1';

function job(over: Partial<ScheduleExecutionJob> = {}): ScheduleExecutionJob {
  return {
    job_id: 'job-a2',
    phase: 'waiting_owner',
    code: 'schedule_writes_unverified',
    job_status: 'blocked',
    job_revision: 3,
    station_id: 'entry-a',
    deployment_status: null,
    steps_total: 0,
    steps_verified: 0,
    reviews: { pending: 0, approved: 0, rejected: 0 },
    reviews_read: true,
    reviews_unread: false,
    physical_result: 'unproven',
    read_at: '2026-11-25T08:00:00Z',
    final: false,
    ...over,
  };
}

function view(over: Partial<ScheduleExecutionView> = {}): ScheduleExecutionView {
  return { enabled: true, can_configure: true, support: { state: 'supported', reason: null, contract: CONTRACT }, jobs: [], ...over };
}

test('every phase has a tone; unknown and unread are never shown as done', () => {
  for (const p of EXEC_PHASES) expect(['live', 'stale', 'error', 'offline', 'unknown', 'neutral']).toContain(execTone(p));
  expect(execTone('executed')).toBe('live');
  expect(execTone('unknown')).toBe('unknown');
  expect(execTone('not_read')).not.toBe('live');
  expect(execPhase(null)).toBe('not_read');
  expect(execPhase(job({ phase: 'something_new' }))).toBe('unknown');
  expect(execPhase(job({ phase: 'approved' }))).toBe('approved');
});

test('the support line', () => {
  expect(execSupport(null)).toBe('loading');
  expect(execSupport(null, true)).toBe('failed');
  expect(execSupport({ state: 'off', reason: null, contract: CONTRACT })).toBe('off');
  expect(execSupport({ state: 'unsupported', reason: 'not_listed', contract: CONTRACT })).toBe('unsupported');
  expect(execSupport({ state: 'weird', reason: null, contract: CONTRACT })).toBe('unavailable');
});

test('a status check only while on and supported, never for a final read, never while busy', () => {
  expect(canCheckExec(null, view(), false)).toBe(true);
  expect(canCheckExec(job(), view(), false)).toBe(true);
  expect(canCheckExec(job({ phase: 'executed', final: true }), view(), false)).toBe(false);
  expect(canCheckExec(job(), view(), true)).toBe(false);
  expect(canCheckExec(job(), view({ enabled: false }), false)).toBe(false);
  expect(canCheckExec(job(), view({ support: { state: 'unsupported', reason: 'not_listed', contract: CONTRACT } }), false)).toBe(false);
  expect(canCheckExec(job(), null, false)).toBe(false);
});

test('at most five rows, the rest counted (the block never scrolls)', () => {
  const list = Array.from({ length: 8 }, (_v, i) => ({ id: `job-${i}` }));
  const { rows, more } = visibleJobs(list);
  expect(rows.map((r) => r.id)).toEqual(['job-0', 'job-1', 'job-2', 'job-3', 'job-4']);
  expect(more).toBe(3);
  expect(SHOWN).toBe(5);
  expect(visibleJobs([]).more).toBe(0);
});

test('the deploy warning is softened only after a read showed a job executed, and only while the switch is on', () => {
  expect(anyExecuted(null)).toBe(false);
  expect(anyExecuted(view({ jobs: [job()] }))).toBe(false);
  expect(anyExecuted(view({ jobs: [job({ phase: 'approved' })] }))).toBe(false);
  expect(anyExecuted(view({ jobs: [job({ phase: 'executing' })] }))).toBe(false);
  expect(anyExecuted(view({ jobs: [job({ phase: 'executed', final: true })] }))).toBe(true);
  expect(anyExecuted(view({ enabled: false, jobs: [job({ phase: 'executed', final: true })] }))).toBe(false);
});
