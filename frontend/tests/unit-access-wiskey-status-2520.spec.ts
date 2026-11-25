import { test, expect } from '@playwright/test';
import {
  APPROVAL_ACTIONS,
  APPROVAL_STATES,
  CONNECTIONS,
  FAILURE_REASONS,
  FAMILIES,
  JOB_KINDS,
  JOB_STATES,
  PROFILES,
  REASON_CODES,
  RESULT_STATES,
  SYNC_STATES,
  TEMPLATE_STATES,
  connectionKind,
  count,
  failureCodes,
  familyRows,
  jobKind,
  jobsView,
  readPanel,
  reasonWord,
  requestLine,
  shortId,
  syncKind,
  systemView,
  tiles,
  wordOf,
} from '../src/access-control/status-wiskey-logic';
import { st, type StKey } from '../src/i18n/access-status';
import { en } from '../src/i18n/lang/en/i18n/access-status';

// WISKEY-STATUS-UI-2520 (row R2 of docs/changes/WISKEY-RESYNC-2520.md): the pure logic of the segment "מערכת האינטרקום" - WisKey's
// system/status_v1 and jobs/status_v1 as the server's closed projection (services/wiskey_system_status.py) hands them over. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-access-wiskey-status-2520.spec.ts

/** The server's projection of WisKey's synthetic valid example (tests/fixtures/wiskey_rc19/system-status-v1.result.valid.json), as
 * project_system() returns it: no station, no job family. */
const VALID_EMPTY = {
  generated_at: '2026-11-14T00:00:00Z',
  observation_scope: 'cached_software_only_no_device_reads',
  integration: { version: '2.0.1-rc.synthetic', api_contract: 1, profile: 'manual-existing' },
  stations: [],
  writes: {
    writes_enabled: null,
    reason_codes: ['per_command_authorization_and_business_admission'],
    legacy_schedule_writes_enabled: false,
    legacy_schedule_reason: 'schedule_writes_unverified',
    reviewed_schedule_contract: 'wiskey-schedule-execution.v1',
    reviewed_schedule_reason: 'original_ownership_fresh_source_and_review_required',
  },
  jobs: {
    families: [],
    families_absent: ['checkpoint', 'schedules', 'maintenance', 'templates'],
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

const station = (id: string, over: Record<string, unknown> = {}) => ({
  station_id: id,
  loaded: true,
  connection: 'connected',
  last_authenticated_at: '2026-11-14T00:00:00Z',
  last_failure: null,
  firmware: 'V2.2.62',
  sync: { state: 'synced', last_reconciled_at: '2026-11-14T00:00:00Z', request: null, last_intent: null },
  ...over,
});

test('readPanel: a ready read has no panel; every other state is said as itself, never as data', () => {
  expect(readPanel({ state: 'ready', reason: null, wiskey_code: null }, 'system')).toBeNull();
  expect(readPanel(null, 'system')).toBeNull();
  // the lab's rc10 does not list the command: "not offered", nothing was sent, nothing to retry
  const rc10 = readPanel({ state: 'unsupported', reason: 'not_listed', wiskey_code: null }, 'system')!;
  expect(rc10).toMatchObject({ kind: 'unsupported', panel: 'empty', heading: 'wkUnsupported', hint: 'wkUnsupportedNotListed', retry: false });
  expect(readPanel({ state: 'unsupported', reason: 'wiskey_unknown_command', wiskey_code: 'unknown_command' }, 'jobs')).toMatchObject({ hint: 'wkUnsupportedNotListed', code: 'unknown_command' });
  expect(readPanel({ state: 'unsupported', reason: 'no_copy', wiskey_code: null }, 'system')!.hint).toBe('wkUnsupportedNoCopy');
  expect(readPanel({ state: 'unsupported', reason: 'commands_unknown', wiskey_code: null }, 'system')!.hint).toBe('wkUnsupportedCommandsUnknown');
  expect(readPanel({ state: 'unsupported', reason: 'api_incompatible', wiskey_code: null }, 'system')!.hint).toBe('wkUnsupportedApi');
  // WisKey's refusal of Arx's identity is a refusal (its own sentence per read), with WisKey's code, and no retry offered
  const refusedJobs = readPanel({ state: 'forbidden', reason: 'wiskey_refused', wiskey_code: 'unauthorized' }, 'jobs')!;
  expect(refusedJobs).toMatchObject({ kind: 'refused', panel: 'forbidden', heading: 'wkRefused', hint: 'wkRefusedJobsHint', code: 'unauthorized', retry: false });
  expect(readPanel({ state: 'forbidden', reason: 'wiskey_refused', wiskey_code: 'unauthorized' }, 'system')!.hint).toBe('wkRefusedSystemHint');
  expect(readPanel({ state: 'busy', reason: 'rate_limited', wiskey_code: 'rate_limited' }, 'system')).toMatchObject({ kind: 'busy', heading: 'sRate', retry: true });
  expect(readPanel({ state: 'unavailable', reason: 'connecting', wiskey_code: null }, 'system')!.kind).toBe('connecting');
  expect(readPanel({ state: 'unavailable', reason: 'ha_not_configured', wiskey_code: null }, 'system')!.kind).toBe('not_configured');
  expect(readPanel({ state: 'unavailable', reason: 'not_installed', wiskey_code: null }, 'system')!.kind).toBe('not_installed');
  expect(readPanel({ state: 'unavailable', reason: 'ha_unavailable', wiskey_code: null }, 'system')).toMatchObject({ kind: 'unavailable', hint: 'wkUnavailableHint' });
  expect(readPanel({ state: 'error', reason: 'contract_mismatch', wiskey_code: null }, 'system')).toMatchObject({ kind: 'mismatch', heading: 'wkMismatch' });
  expect(readPanel({ state: 'error', reason: 'jobs_unavailable', wiskey_code: 'jobs_unavailable' }, 'jobs')).toMatchObject({ kind: 'jobs_unavailable', panel: 'empty' });
  // any other WisKey code: a generic error that shows the code itself
  expect(readPanel({ state: 'error', reason: 'other', wiskey_code: 'invalid_response' }, 'system')).toMatchObject({ kind: 'error', code: 'invalid_response' });
  // an unexpected state is never taken for ready
  expect(readPanel({ state: 'surprise', reason: null, wiskey_code: null }, 'system')!.kind).toBe('error');
});

test('systemView keeps unknown as unknown: null counts stay null, a missing value is never zero, false or "connected"', () => {
  const v = systemView(VALID_EMPTY)!;
  expect(v.integration).toEqual({ version: '2.0.1-rc.synthetic', api_contract: 1, profile: 'manual-existing' });
  expect(v.templates.configured_accounts).toBeNull();
  expect(v.templates.configured_templates).toBeNull();
  expect(v.writes.writes_enabled).toBeNull();
  expect(v.writes.legacy_schedule_writes_enabled).toBe(false);
  expect(v.physical_result).toBe('not_measured');
  // a document with almost nothing in it: everything unknown, nothing invented
  const bare = systemView({ stations: [{ station_id: 'a' }, { nope: 1 }, 'x'], jobs: { families: [{ family: 'checkpoint', waiting: -1, running: 1.5, failed_last_24h: '3' }] } })!;
  expect(bare.integration).toEqual({ version: null, api_contract: null, profile: 'unknown' });
  expect(bare.stations).toHaveLength(1);
  expect(bare.stations[0]).toMatchObject({ loaded: null, connection: 'unknown', last_authenticated_at: null, last_failure: null, firmware: null });
  expect(bare.stations[0].sync).toEqual({ state: 'unknown', last_reconciled_at: null, request: null, last_intent: null });
  expect(bare.jobs.families).toEqual([{ family: 'checkpoint', waiting: null, running: null, failed_last_24h: null }]);
  expect(bare.templates).toMatchObject({ installation_state: 'unknown', configured_accounts: null, configured_templates: null });
  expect(systemView(null)).toBeNull();
  expect(systemView([])).toBeNull();
  expect(count(0)).toBe(0);
  expect(count(null)).toBeNull();
  expect(count(true)).toBeNull();
});

test('job families: every family of the contract has a row; one WisKey did not report is missing (never zero); no total exists', () => {
  // the synthetic example reports no family: all four are missing, none is a zero
  const empty = familyRows(systemView(VALID_EMPTY)!);
  expect(empty.map((f) => f.family)).toEqual([...FAMILIES]);
  expect(empty.every((f) => f.present === false)).toBe(true);
  // two reported, with a zero (a real zero stays a zero) and a null (unknown, not zero); a family the contract does not name is not shown
  const v = systemView({
    ...VALID_EMPTY,
    jobs: {
      ...VALID_EMPTY.jobs,
      families: [
        { family: 'maintenance', waiting: 0, running: 2, failed_last_24h: null },
        { family: 'checkpoint', waiting: 3, running: 0, failed_last_24h: 1 },
        { family: 'mystery', waiting: 9, running: 9, failed_last_24h: 9 },
      ],
      families_absent: ['schedules', 'templates'],
    },
  })!;
  const rows = familyRows(v);
  expect(rows).toEqual([
    { family: 'checkpoint', present: true, waiting: 3, running: 0, failed: 1 },
    { family: 'schedules', present: false },
    { family: 'maintenance', present: true, waiting: 0, running: 2, failed: null },
    { family: 'templates', present: false },
  ]);
  // a family missing from the families list is missing even when `families_absent` does not say so
  const noList = familyRows(systemView({ ...VALID_EMPTY, jobs: { ...VALID_EMPTY.jobs, families: [], families_absent: [] } })!);
  expect(noList.every((f) => !f.present)).toBe(true);
});

test('the tiles: stations connected of the stations WisKey reported, an unstated connection counted as unknown (never connected)', () => {
  const v = systemView({ ...VALID_EMPTY, stations: [station('a'), station('b', { connection: 'auth_failed' }), station('c', { connection: 'weird' }), station('d', { connection: null })] })!;
  expect(tiles(v)).toEqual({ version: '2.0.1-rc.synthetic', apiContract: 1, profile: 'manual-existing', connected: 1, total: 4, unknown: 2 });
});

test('badges: green only for connected / synced / completed; anything unstated is unknown; cancelled and interrupted are not a proof', () => {
  expect(connectionKind('connected')).toBe('live');
  expect(connectionKind('connecting')).toBe('stale');
  expect(connectionKind('auth_failed')).toBe('error');
  expect(connectionKind('offline')).toBe('offline');
  expect(connectionKind('unknown')).toBe('unknown');
  expect(connectionKind('online')).toBe('unknown');
  expect(syncKind('synced')).toBe('live');
  expect(syncKind('unavailable')).toBe('offline');
  expect(syncKind('conflict')).toBe('error');
  expect(syncKind('cancelled')).toBe('neutral');
  expect(syncKind('interrupted')).toBe('neutral');
  expect(syncKind('done')).toBe('unknown');
  expect(jobKind('completed')).toBe('live');
  expect(jobKind('completed_with_errors')).toBe('error');
  expect(jobKind('finished')).toBe('unknown');
});

test('words: a known value has a key, an unknown one stays its code, a missing one (or WisKey\'s own "unknown") is the unknown word', () => {
  expect(wordOf('wkConn_', 'auth_failed', CONNECTIONS)).toEqual({ key: 'wkConn_auth_failed' });
  expect(wordOf('wkProfile_', 'manual-existing', PROFILES)).toEqual({ key: 'wkProfile_manual_existing' });
  expect(wordOf('wkConn_', 'sleeping', CONNECTIONS)).toEqual({ code: 'sleeping' });
  expect(wordOf('wkConn_', null, CONNECTIONS)).toEqual({ key: 'wkConn_unknown' });
  expect(wordOf('wkConn_', 'unknown', CONNECTIONS)).toEqual({ key: 'wkConn_unknown' });
  expect(reasonWord('schedule_writes_unverified')).toEqual({ key: 'wkReason_schedule_writes_unverified' });
  expect(reasonWord('something_new')).toEqual({ code: 'something_new' });
  expect(reasonWord(null)).toBeNull();
});

test('a sync request: the running one first, then the waiting one, then the last result - which never proves an effect', () => {
  const req = (r: Record<string, unknown>) => systemView({ ...VALID_EMPTY, stations: [station('a', { sync: { state: 'pending', request: { scope: 'current_attached_runtime_only', ...r } } })] })!.stations[0];
  expect(requestLine(systemView({ ...VALID_EMPTY, stations: [station('a')] })!.stations[0])).toEqual({ kind: 'none' });
  expect(requestLine(req({ pending_request_id: 'p1', active_request_id: 'a1' }))).toEqual({ kind: 'active' });
  expect(requestLine(req({ pending_request_id: 'p1' }))).toEqual({ kind: 'pending' });
  const s = req({ last_result: { request_id: 'r1', state: 'interrupted', observed_at: '2026-11-14T00:00:00Z', code: 'detached', effect_proven: false } });
  expect(requestLine(s)).toEqual({ kind: 'result', state: 'interrupted', at: '2026-11-14T00:00:00Z', code: 'detached' });
  expect(s.sync.request!.last_result!.effect_proven).toBe(false);
  // a projection that somehow said true is still read as not proven (the server refuses such a document; the page never shows it as proven)
  const lying = req({ last_result: { request_id: 'r1', state: 'synced', effect_proven: true } });
  expect(lying.sync.request!.last_result!.effect_proven).toBe(false);
});

test('a last failure: WisKey\'s reason as a word and its HTTP / ISAPI / sub-status codes as written', () => {
  const v = systemView({
    ...VALID_EMPTY,
    stations: [station('a', { connection: 'auth_failed', last_failure: { at: '2026-11-14T00:00:00Z', channel: 'request', http_status_code: 401, isapi_status_code: 4, sub_status: 'userlocked', reason: 'account_locked' } })],
  })!;
  const f = v.stations[0].last_failure!;
  expect(f.reason).toBe('account_locked');
  expect(failureCodes(f)).toBe('HTTP 401 · ISAPI 4 · userlocked');
  expect(failureCodes({ ...f, http_status_code: null, isapi_status_code: null, sub_status: null })).toBe('');
});

test('jobs/status_v1: every retained job, counts unknown when WisKey did not give them, malformed rows dropped, no total', () => {
  expect(jobsView({ records: [], scope: 'all_retained_checkpoint_jobs', history_complete: false, notification: 'x' })!.records).toEqual([]);
  const v = jobsView({
    records: [
      { id: 'a'.repeat(32), kind: 'csv', state: 'completed_with_errors', revision: 3, created_at: '2026-11-13T10:00:00Z', updated_at: '2026-11-13T10:05:00Z', approval: { state: 'pending', action: 'retry_failed', expires_at: null }, total: 10, saved: 8, failed: 2, pending: 0, errors: [{ row: 4, code: 'pin_conflict' }, { row: 0, code: 'bad' }, 'x'], errors_truncated: true },
      { id: 'b'.repeat(32), kind: 'bulk', state: 'running' },
      { kind: 'csv' },
    ],
  })!;
  expect(v.records).toHaveLength(2);
  expect(v.records[0]).toMatchObject({ kind: 'csv', state: 'completed_with_errors', saved: 8, failed: 2, pending: 0, total: 10, errors_truncated: true });
  expect(v.records[0].errors).toEqual([{ row: 4, code: 'pin_conflict' }]);
  expect(v.records[0].approval).toEqual({ state: 'pending', action: 'retry_failed', expires_at: null });
  expect(v.records[1]).toMatchObject({ saved: null, failed: null, pending: null, total: null, approval: null, errors: [] });
  expect(v.history_complete).toBe(false);
  expect(jobsView({})).toBeNull();
  expect(jobsView(null)).toBeNull();
  expect(shortId('0123456789abcdef0123456789abcdef')).toBe('01234567');
});

test('every word the segment can show exists in Hebrew and in English', () => {
  const keys = new Set<string>(['segWiskey', 'wkUnknown', 'wkCode', 'wkReadAt', 'wkScopeNote', 'wkRequestNote', 'wkFamiliesNote', 'wkFamilyMissing', 'wkTplNote', 'wkJobsNote', 'wkRows', 'wkNotProven', 'wkReqPending', 'wkReqActive']);
  const add = (prefix: string, values: readonly string[]) => {
    for (const v of [...values, 'unknown']) keys.add(`${prefix}${v.replace(/-/g, '_')}`);
  };
  add('wkConn_', CONNECTIONS);
  add('wkSync_', SYNC_STATES);
  add('wkSync_', RESULT_STATES);
  add('wkFail_', FAILURE_REASONS);
  add('wkProfile_', PROFILES);
  add('wkJobKind_', JOB_KINDS);
  add('wkJob_', JOB_STATES);
  add('wkAppr_', APPROVAL_STATES);
  add('wkApprAct_', APPROVAL_ACTIONS);
  add('wkTpl_', TEMPLATE_STATES);
  for (const c of REASON_CODES) keys.add(`wkReason_${c}`);
  for (const f of FAMILIES) keys.add(`wkFamily_${f}`);
  const states: Array<[string, string | null, string | null]> = [
    ['unsupported', 'not_listed', null],
    ['unsupported', 'no_copy', null],
    ['unsupported', 'commands_unknown', null],
    ['unsupported', 'api_incompatible', null],
    ['forbidden', 'wiskey_refused', 'unauthorized'],
    ['busy', 'busy', 'busy'],
    ['unavailable', 'connecting', null],
    ['unavailable', 'ha_not_configured', null],
    ['unavailable', 'not_installed', null],
    ['unavailable', 'idle', null],
    ['error', 'contract_mismatch', null],
    ['error', 'jobs_unavailable', 'jobs_unavailable'],
    ['error', 'other', 'x'],
  ];
  for (const which of ['system', 'jobs'] as const) {
    for (const [state, reason, code] of states) {
      const p = readPanel({ state, reason, wiskey_code: code }, which)!;
      keys.add(p.heading);
      if (p.hint) keys.add(p.hint);
    }
  }
  const missingHe = [...keys].filter((k) => typeof st(k as StKey) !== 'string' || !st(k as StKey));
  const missingEn = [...keys].filter((k) => !(k in en));
  expect(missingHe).toEqual([]);
  expect(missingEn).toEqual([]);
});
