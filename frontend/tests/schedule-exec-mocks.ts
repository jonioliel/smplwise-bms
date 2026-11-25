import type { Page, Route } from '@playwright/test';

// WISKEY-A2-EXEC-2530: the mocked backend of the read-only "status in WisKey" block (routers/access_control_schedule_execution.py),
// layered over tests/schedule-writes-mocks.ts (register it AFTER installSchedWritesMock: routes registered later win). Invented data only.
// It RECORDS every request, keeps the switch and the reads statefully, and answers a status check from `next` (job id -> the read that
// WisKey's answer gives). There is no route here that approves, runs, previews or cancels anything - the real backend has none either.

export interface ExecMock {
  enabled: boolean;
  canConfigure: boolean;
  support: { state: string; reason: string | null; contract: string };
  /** The reads already known (memory of the server). */
  jobs: any[];
  /** job id -> the read the next status check answers (default: waiting for the owner). */
  next: Record<string, any>;
  // recorded
  calls: { method: string; path: string; body: any }[];
}

const CONTRACT = 'wiskey-schedule-execution.v1';
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export function newExecMock(over: Partial<ExecMock> = {}): ExecMock {
  return {
    enabled: false,
    canConfigure: true,
    support: { state: 'supported', reason: null, contract: CONTRACT },
    jobs: [],
    next: {},
    calls: [],
    ...over,
  };
}

/** One read as the server answers it (services/wiskey_schedule_execution._view). */
export function execRead(jobId: string, phase: string, over: Record<string, any> = {}): any {
  return {
    job_id: jobId,
    phase,
    code: null,
    job_status: null,
    job_revision: 3,
    station_id: 'entry-a',
    deployment_status: null,
    steps_total: 0,
    steps_verified: 0,
    reviews: { pending: 0, approved: 0, rejected: 0 },
    reviews_read: true,
    physical_result: 'unproven',
    read_at: '2026-09-27T10:29:00Z',
    final: phase === 'executed' || phase === 'cancelled',
    ...over,
  };
}

export async function installExecMock(page: Page, m: ExecMock): Promise<void> {
  const view = () => ({
    enabled: m.enabled,
    can_configure: m.canConfigure,
    support: m.enabled ? clone(m.support) : { state: 'off', reason: null, contract: CONTRACT },
    jobs: m.enabled ? clone(m.jobs) : [],
  });
  await page.route('**/api/v1/access-control/schedules/execution**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\/access-control\//, '');
    const method = req.method();
    const body = method === 'GET' ? null : (req.postDataJSON() as any);
    m.calls.push({ method, path: p, body: clone(body) });
    if (method === 'GET' && p === 'schedules/execution') return json(route, view());
    if (method === 'PUT' && p === 'schedules/execution/settings') {
      if (!m.canConfigure) return json(route, { code: 'forbidden', user_message: 'רק מנהל מערכת יכול לשנות הגדרה זו.', retryable: false, correlation_id: 'mock', details: {} }, 403);
      m.enabled = body?.enabled === true;
      if (!m.enabled) m.jobs = [];
      return json(route, view());
    }
    const id = /^schedules\/execution\/([^/]+)\/status$/.exec(p)?.[1];
    if (method === 'POST' && id) {
      if (!m.enabled) return json(route, { code: 'feature_disabled', user_message: 'הצגת מצב הביצוע כבויה בהגדרות. לא נשלח דבר.', retryable: false, correlation_id: 'mock', details: { outcome: 'not_sent' } }, 409);
      const prior = m.jobs.find((j) => j.job_id === id) ?? null;
      if (prior?.final) return json(route, { support: clone(m.support), job: clone(prior), status_read: { outcome: 'not_needed', code: 'final' } });
      if (m.support.state !== 'supported') return json(route, { support: clone(m.support), job: prior, status_read: { outcome: 'not_sent', code: m.support.reason } });
      const read = clone(m.next[id] ?? execRead(id, 'waiting_owner', { code: 'schedule_writes_unverified', job_status: 'blocked' }));
      m.jobs = [read, ...m.jobs.filter((j) => j.job_id !== id)];
      return json(route, { support: clone(m.support), job: clone(read), status_read: { outcome: 'ok', code: null } });
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
}
