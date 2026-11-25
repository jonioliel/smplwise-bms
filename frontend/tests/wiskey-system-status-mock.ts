import type { Page, Route } from '@playwright/test';

// WISKEY-STATUS-UI-2520: the two reads of the segment "מערכת האינטרקום" (GET /api/v1/access-control/status/system and /status/jobs, row
// R1's routers/access_control_system_status.py) for the page specs, on top of tests/access-control-mocks.ts (installed first: a route
// added later is matched first, so this one answers these two paths and the access mock everything else). The bodies are the server's
// closed projection (services/wiskey_system_status.py project_system / project_jobs) of a WisKey rc19-shaped document; the clock of the
// access mock is Sunday 2026-09-27 13:30 in Jerusalem (10:30Z).

export type WkMode =
  | 'ready'
  | 'unsupported' // the lab's rc10: the command is not listed - nothing was sent
  | 'refused' // WisKey refused Arx's identity (`unauthorized`)
  | 'mismatch' // WisKey answered outside its contract: refused whole
  | 'unavailable'
  | 'busy'
  | 'jobs_unavailable'
  | 'empty' // ready, but nothing reported (WisKey's own synthetic example: no station, no family, no job)
  | 'http403'; // Arx refused the caller (a station-scoped administrator)

export interface WkMock {
  system: WkMode;
  jobs: WkMode;
  /** Every request of the two paths, in order: `system` / `jobs`, with its method. */
  calls: Array<{ read: string; method: string }>;
}

export const SYSTEM_READY = {
  generated_at: '2026-09-27T10:29:40Z',
  observation_scope: 'cached_software_only_no_device_reads',
  integration: { version: '2.0.1-rc.19', api_contract: 1, profile: 'manual-existing' },
  stations: [
    {
      station_id: 'entry-a',
      loaded: true,
      connection: 'connected',
      last_authenticated_at: '2026-09-27T10:25:00Z',
      last_failure: null,
      firmware: 'V2.2.62 build 240611',
      sync: { state: 'synced', last_reconciled_at: '2026-09-27T10:25:00Z', request: { scope: 'current_attached_runtime_only', pending_request_id: null, active_request_id: null, last_result: { request_id: 'r-17', state: 'synced', observed_at: '2026-09-27T10:25:00Z', code: null, effect_proven: false } }, last_intent: null },
    },
    {
      station_id: 'entry-b',
      loaded: true,
      connection: 'auth_failed',
      last_authenticated_at: '2026-09-26T19:02:00Z',
      last_failure: { at: '2026-09-27T09:10:00Z', channel: 'request', http_status_code: 401, isapi_status_code: 4, sub_status: 'userlocked', reason: 'account_locked' },
      firmware: null,
      sync: { state: 'pending', last_reconciled_at: null, request: { scope: 'current_attached_runtime_only', pending_request_id: 'r-18', active_request_id: null, last_result: null }, last_intent: null },
    },
    {
      station_id: 'entry-c',
      loaded: false,
      connection: 'unknown',
      last_authenticated_at: null,
      last_failure: null,
      firmware: null,
      sync: { state: 'unknown', last_reconciled_at: null, request: null, last_intent: null },
    },
  ],
  writes: {
    writes_enabled: null,
    reason_codes: ['per_command_authorization_and_business_admission'],
    legacy_schedule_writes_enabled: false,
    legacy_schedule_reason: 'schedule_writes_unverified',
    reviewed_schedule_contract: 'wiskey-schedule-execution.v1',
    reviewed_schedule_reason: 'original_ownership_fresh_source_and_review_required',
  },
  jobs: {
    families: [
      { family: 'checkpoint', waiting: 1, running: 0, failed_last_24h: 2 },
      { family: 'maintenance', waiting: 0, running: 1, failed_last_24h: null },
    ],
    families_absent: ['schedules', 'templates'],
    scope: 'original_retained_jobs_per_family',
    running_scope: 'retained_state_or_writing_intent_not_process_liveness',
    failed_window: 'last_recorded_failure_state_updated_in_previous_24h',
    history_complete: false,
    reason_codes: ['retention_can_remove_completed_jobs'],
  },
  templates: { installation_state: 'unavailable', configured_accounts: null, configured_templates: null, reason_codes: ['template_installation_unavailable'], send_admission: 'original_per_operation_guards' },
  schedules: { legacy_writes_enabled: false, reviewed_execution_contract: 'wiskey-schedule-execution.v1', physical_acceptance: 'not_measured' },
  physical_result: 'not_measured',
};

export const SYSTEM_EMPTY = {
  ...SYSTEM_READY,
  integration: { version: '2.0.1-rc.19', api_contract: 1, profile: 'manual-existing' },
  stations: [],
  jobs: { ...SYSTEM_READY.jobs, families: [], families_absent: ['checkpoint', 'schedules', 'maintenance', 'templates'] },
};

export const JOBS_READY = {
  records: [
    {
      id: '3f2a9c1e5b7d4a60b1c2d3e4f5a6b7c8',
      kind: 'csv',
      state: 'completed_with_errors',
      revision: 4,
      created_at: '2026-09-27T08:00:00Z',
      updated_at: '2026-09-27T08:04:00Z',
      approval: { state: 'pending', action: 'retry_failed', expires_at: '2026-09-28T08:04:00Z' },
      total: 40,
      saved: 38,
      failed: 2,
      pending: 0,
      errors: [
        { row: 7, code: 'pin_conflict' },
        { row: 19, code: 'card_in_use' },
      ],
      errors_truncated: false,
    },
    { id: '9d8c7b6a5f4e3d2c1b0a99887766554a', kind: 'bulk', state: 'running', revision: 1, created_at: '2026-09-27T10:20:00Z', updated_at: '2026-09-27T10:28:00Z', approval: null, total: null, saved: 12, failed: 0, pending: null, errors: [], errors_truncated: false },
  ],
  scope: 'all_retained_checkpoint_jobs',
  history_complete: false,
  notification: 'original_data_free_refresh_requires_authorized_read',
};

const read = (state: string, reason: string | null, code: string | null, data: unknown = null) => ({ state, reason, wiskey_code: code, fetched_at: state === 'ready' ? '2026-09-27T10:29:40Z' : null, data });

function body(which: 'system' | 'jobs', mode: WkMode) {
  switch (mode) {
    case 'ready':
      return read('ready', null, null, which === 'system' ? SYSTEM_READY : JOBS_READY);
    case 'empty':
      return read('ready', null, null, which === 'system' ? SYSTEM_EMPTY : { ...JOBS_READY, records: [] });
    case 'unsupported':
      return read('unsupported', 'not_listed', null);
    case 'refused':
      return read('forbidden', 'wiskey_refused', 'unauthorized');
    case 'mismatch':
      return read('error', 'contract_mismatch', null);
    case 'unavailable':
      return read('unavailable', 'ha_unavailable', null);
    case 'busy':
      return read('busy', 'rate_limited', 'rate_limited');
    case 'jobs_unavailable':
      return read('error', 'jobs_unavailable', 'jobs_unavailable');
    default:
      return null;
  }
}

/** Answers the two reads; call AFTER installAccessMock. */
export async function installWiskeyStatusMock(page: Page, opts: Partial<Pick<WkMock, 'system' | 'jobs'>> = {}): Promise<WkMock> {
  const st: WkMock = { system: opts.system ?? 'ready', jobs: opts.jobs ?? 'ready', calls: [] };
  await page.route(/\/api\/v1\/access-control\/status\/(system|jobs)(\?.*)?$/, async (route: Route) => {
    const which = /status\/(system|jobs)/.exec(route.request().url())![1] as 'system' | 'jobs';
    st.calls.push({ read: which, method: route.request().method() });
    const mode = st[which];
    if (mode === 'http403') {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: 'mock', details: { permission: 'access.admin.read', target_type: 'installation', target_id: '*', reason: 'station_scoped' } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body(which, mode)) });
  });
  return st;
}
