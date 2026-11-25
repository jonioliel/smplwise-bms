import { test, expect } from '@playwright/test';
import { READ_STATES, SHOWN, canCheck, canStart, readState, readTone, summaryOf, supportState, visibleReads } from '../src/access-control/schedule-reads-logic';
import type { ScheduleRead, ScheduleReadsSupport } from '../src/api/schedule-reads';

// WISKEY-SCHED-READS-2520: the pure rules of the signed schedule reads block (src/access-control/schedule-reads-logic.ts).
const SUPPORTED: ScheduleReadsSupport = { state: 'supported', reason: null, contract: 'wiskey-schedule-reads.v1' };
const UNSUPPORTED: ScheduleReadsSupport = { state: 'unsupported', reason: 'not_listed', contract: 'wiskey-schedule-reads.v1' };

function read(over: Partial<ScheduleRead> = {}): ScheduleRead {
  return {
    request_id: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b',
    action: 'readiness',
    subject: 'entry-a',
    revision: null,
    state: 'accepted',
    start_outcome: 'ok',
    wiskey_code: null,
    plan_revision: null,
    data: null,
    created_at: '2026-11-25T08:00:00Z',
    updated_at: '2026-11-25T08:00:00Z',
    status_at: null,
    status_reads: 0,
    final: false,
    can_check: true,
    ...over,
  };
}

test('every state has a tone; unknown is never done and never "not sent"', () => {
  expect(READ_STATES).toEqual(['sending', 'not_sent', 'accepted', 'running', 'completed', 'refused', 'unknown']);
  expect(readTone('completed')).toBe('live');
  expect(readTone('accepted')).toBe('neutral');
  expect(readTone('running')).toBe('neutral');
  expect(readTone('refused')).toBe('error');
  expect(readTone('not_sent')).toBe('offline');
  expect(readTone('unknown')).toBe('unknown');
  expect(readState('something-new')).toBe('unknown');
  expect(readState(null)).toBe('unknown');
});

test('the support line: supported / unsupported as said, anything else unavailable, loading and failed kept apart', () => {
  expect(supportState(SUPPORTED)).toBe('supported');
  expect(supportState(UNSUPPORTED)).toBe('unsupported');
  expect(supportState({ ...SUPPORTED, state: 'unavailable' })).toBe('unavailable');
  expect(supportState({ ...SUPPORTED, state: 'maybe' })).toBe('unavailable');
  expect(supportState(null)).toBe('loading');
  expect(supportState(SUPPORTED, true)).toBe('failed');
});

test('a start is offered only when supported, current, idle and the station is online', () => {
  expect(canStart(SUPPORTED, true, false, true)).toBe(true);
  expect(canStart(UNSUPPORTED, true, false, true)).toBe(false);
  expect(canStart(SUPPORTED, false, false, true)).toBe(false);
  expect(canStart(SUPPORTED, true, true, true)).toBe(false);
  expect(canStart(SUPPORTED, true, false, false)).toBe(false);
  expect(canStart(SUPPORTED, true, false, null)).toBe(false);
});

test('a status check is offered for open rows only (accepted / running / unknown), never for final ones, and only while supported', () => {
  expect(canCheck(read(), SUPPORTED, false)).toBe(true);
  expect(canCheck(read({ state: 'unknown', start_outcome: 'unknown' }), SUPPORTED, false)).toBe(true);
  expect(canCheck(read({ state: 'completed', final: true, can_check: false }), SUPPORTED, false)).toBe(false);
  expect(canCheck(read({ state: 'not_sent', final: true, can_check: false }), SUPPORTED, false)).toBe(false);
  expect(canCheck(read({ state: 'sending', can_check: false }), SUPPORTED, false)).toBe(false);
  expect(canCheck(read(), UNSUPPORTED, false)).toBe(false);
  expect(canCheck(read(), SUPPORTED, true)).toBe(false);
});

test('a completed result is summarised from the closed projection; missing values stay unknown', () => {
  expect(summaryOf(read())).toBeNull();
  expect(summaryOf(read({ state: 'completed', data: null }))).toEqual({ key: 'sumNoData', vars: {} });
  expect(summaryOf(read({ state: 'completed', data: { checks: [{ read_state: 'readable' }, { read_state: 'failed' }] } }))).toEqual({
    key: 'sumReadiness',
    vars: { readable: 1, total: 2 },
  });
  expect(summaryOf(read({ state: 'completed', action: 'dependencies', data: { users: { read: 12 } } }))).toEqual({ key: 'sumDependencies', vars: { users: 12 } });
  expect(summaryOf(read({ state: 'completed', action: 'dependencies', data: { users: null } }))).toEqual({ key: 'sumDependencies', vars: { users: '?' } });
  expect(summaryOf(read({ state: 'completed', action: 'plan_recheck', plan_revision: 7, data: { id: 'x' } }))).toEqual({ key: 'sumPlan', vars: { revision: 7 } });
  expect(summaryOf(read({ state: 'completed', action: 'assess', data: { complete: true } }))).toEqual({ key: 'sumDone', vars: {} });
});

test('at most five rows, newest first, the rest counted (the block never scrolls)', () => {
  const many = Array.from({ length: 8 }, (_, i) => read({ request_id: `id-${i}`, created_at: `2026-11-25T08:0${i}:00Z` }));
  const { rows, more } = visibleReads(many);
  expect(SHOWN).toBe(5);
  expect(rows.map((r) => r.request_id)).toEqual(['id-7', 'id-6', 'id-5', 'id-4', 'id-3']);
  expect(more).toBe(3);
  expect(visibleReads(null)).toEqual({ rows: [], more: 0 });
});
