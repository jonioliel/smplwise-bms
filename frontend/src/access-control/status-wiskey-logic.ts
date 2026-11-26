/**
 * WISKEY-STATUS-UI-2520 (row R2 of docs/changes/WISKEY-RESYNC-2520.md): the pure logic of the segment "מערכת האינטרקום" of the Settings
 * page "בקרת כניסה" - WisKey's `system/status_v1` (master ids D1-D5) and `jobs/status_v1` (B3) as words, tones and rows, with no DOM and
 * no Hebrew: every function answers with a KEY of i18n/access-status.ts or with plain data, so the node unit test
 * (tests/unit-access-wiskey-status-2520.spec.ts) runs it without a browser.
 *
 * What the segment never does with a value (the contract's own rules, kept on the screen):
 *  - unknown stays unknown: a missing / malformed count is "unknown", never 0; an enumeration value the page has no word for is shown
 *    AS the code (a Settings page keeps the technical truth); a missing instant is a dash, never "now";
 *  - a job family WisKey did not report is "missing" (its owner is not loaded) - never a family with zero jobs; there is no job total
 *    across the families (they overlap by design) and `running` is retained state, not a live worker;
 *  - writes are never shown as "open": `writes_enabled` is null = every command is admitted on its own; the legacy schedule writer is off;
 *  - a sync result never proves an effect (`effect_proven: false`); a request id is WisKey's in-memory id, not a log;
 *  - a read WisKey does not offer, refuses or answered outside its contract is said as such - no older read is used instead, nothing is
 *    retried behind the operator's back, and no earlier copy is shown as if it were current.
 */
import type { StateKind } from '../components/sw-badge';
import type { PanelState } from '../components/sw-state-panel';
import type { WkFailure, WkFamily, WkJob, WkJobs, WkRead, WkStation, WkSystem } from '../api/wiskey-system-status';

// ---------------------------------------------------------------- small closed readers (the projection is typed as an open object)

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
/** A count: a non-negative whole number, else null (unknown) - never a zero made up for a missing value. */
export const count = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : []);
const UNKNOWN = 'unknown';
const word = (v: unknown): string => str(v) ?? UNKNOWN;

// ---------------------------------------------------------------- the read's own state

export const FAMILIES = ['checkpoint', 'schedules', 'maintenance', 'templates'] as const;

export interface ReadPanel {
  /** The kind the page marks the panel with (`data-wk-state`). */
  kind: 'unsupported' | 'refused' | 'unavailable' | 'connecting' | 'not_configured' | 'not_installed' | 'busy' | 'mismatch' | 'jobs_unavailable' | 'error';
  panel: PanelState;
  heading: string;
  hint: string | null;
  /** WisKey's own code, shown as a technical line under the hint (never as a sentence). */
  code: string | null;
  retry: boolean;
}

const UNSUPPORTED_HINT: Record<string, string> = {
  not_listed: 'wkUnsupportedNotListed',
  wiskey_unknown_command: 'wkUnsupportedNotListed',
  no_copy: 'wkUnsupportedNoCopy',
  commands_unknown: 'wkUnsupportedCommandsUnknown',
  api_incompatible: 'wkUnsupportedApi',
};

/** A read that is not `ready`, reduced to the one panel it shows. `which` names the read (the refusal of the jobs read has its own
 * sentence: WisKey allows it to its owner only). Null for a ready read. */
export function readPanel(read: Pick<WkRead, 'state' | 'reason' | 'wiskey_code'> | null | undefined, which: 'system' | 'jobs'): ReadPanel | null {
  if (!read) return null;
  const code = str(read.wiskey_code);
  const reason = str(read.reason);
  switch (read.state) {
    case 'ready':
      return null;
    case 'unsupported':
      return { kind: 'unsupported', panel: 'empty', heading: 'wkUnsupported', hint: (reason && UNSUPPORTED_HINT[reason]) || 'wkUnsupportedNotListed', code, retry: false };
    case 'forbidden':
      return { kind: 'refused', panel: 'forbidden', heading: 'wkRefused', hint: which === 'jobs' ? 'wkRefusedJobsHint' : 'wkRefusedSystemHint', code, retry: false };
    case 'busy':
      return { kind: 'busy', panel: 'stale', heading: 'sRate', hint: 'sRateHint', code, retry: true };
    case 'unavailable':
      if (reason === 'connecting') return { kind: 'connecting', panel: 'loading', heading: 'sConnecting', hint: null, code, retry: true };
      if (reason === 'ha_not_configured') return { kind: 'not_configured', panel: 'stale', heading: 'sNotConfigured', hint: null, code, retry: false };
      if (reason === 'not_installed') return { kind: 'not_installed', panel: 'empty', heading: 'sNotInstalled', hint: null, code, retry: false };
      return { kind: 'unavailable', panel: 'error', heading: 'sUnavailable', hint: 'wkUnavailableHint', code, retry: true };
    default:
      if (reason === 'contract_mismatch') return { kind: 'mismatch', panel: 'error', heading: 'wkMismatch', hint: 'wkMismatchHint', code, retry: true };
      if (code === 'jobs_unavailable' || reason === 'jobs_unavailable') return { kind: 'jobs_unavailable', panel: 'empty', heading: 'wkJobsUnavailable', hint: 'wkJobsUnavailableHint', code: 'jobs_unavailable', retry: true };
      return { kind: 'error', panel: 'error', heading: 'sError', hint: null, code: code ?? reason, retry: true };
  }
}

// ---------------------------------------------------------------- system/status_v1 as a view

function failureOf(v: unknown): WkFailure | null {
  if (!isObj(v)) return null;
  return {
    at: str(v.at),
    channel: word(v.channel),
    http_status_code: count(v.http_status_code),
    isapi_status_code: count(v.isapi_status_code),
    sub_status: str(v.sub_status),
    reason: word(v.reason),
  };
}

function stationOf(v: unknown): WkStation | null {
  if (!isObj(v) || !str(v.station_id)) return null;
  const sync = isObj(v.sync) ? v.sync : {};
  const req = isObj(sync.request) ? sync.request : null;
  const last = req && isObj(req.last_result) ? req.last_result : null;
  const intent = isObj(sync.last_intent) ? sync.last_intent : null;
  return {
    station_id: v.station_id as string,
    loaded: bool(v.loaded),
    connection: word(v.connection),
    last_authenticated_at: str(v.last_authenticated_at),
    last_failure: failureOf(v.last_failure),
    firmware: str(v.firmware),
    sync: {
      state: word(sync.state),
      last_reconciled_at: str(sync.last_reconciled_at),
      request: req
        ? {
            scope: word(req.scope),
            pending_request_id: str(req.pending_request_id),
            active_request_id: str(req.active_request_id),
            last_result: last ? { request_id: str(last.request_id), state: word(last.state), observed_at: str(last.observed_at), code: str(last.code), effect_proven: false } : null,
          }
        : null,
      last_intent: intent ? { operation_id: str(intent.operation_id), state: word(intent.state), updated_at: str(intent.updated_at), verified_at: str(intent.verified_at) } : null,
    },
  };
}

/** The projection of a ready `system/status_v1` read as the page's typed view; null when the payload is not an object. Every value the
 * server did not give stays null / `unknown` (the server already refused a document that broke a pinned guarantee). */
export function systemView(data: unknown): WkSystem | null {
  if (!isObj(data)) return null;
  const integration = isObj(data.integration) ? data.integration : {};
  const writes = isObj(data.writes) ? data.writes : {};
  const jobs = isObj(data.jobs) ? data.jobs : {};
  const templates = isObj(data.templates) ? data.templates : {};
  const schedules = isObj(data.schedules) ? data.schedules : {};
  const families: WkFamily[] = (Array.isArray(jobs.families) ? jobs.families : [])
    .filter(isObj)
    .filter((f) => typeof f.family === 'string')
    .map((f) => ({ family: f.family as string, waiting: count(f.waiting), running: count(f.running), failed_last_24h: count(f.failed_last_24h) }));
  return {
    generated_at: str(data.generated_at),
    observation_scope: word(data.observation_scope),
    integration: { version: str(integration.version), api_contract: count(integration.api_contract), profile: word(integration.profile) },
    stations: (Array.isArray(data.stations) ? data.stations : []).map(stationOf).filter((s): s is WkStation => s !== null),
    writes: {
      writes_enabled: null,
      reason_codes: strs(writes.reason_codes),
      legacy_schedule_writes_enabled: false,
      legacy_schedule_reason: str(writes.legacy_schedule_reason),
      reviewed_schedule_contract: str(writes.reviewed_schedule_contract),
      reviewed_schedule_reason: str(writes.reviewed_schedule_reason),
    },
    jobs: {
      families,
      families_absent: strs(jobs.families_absent),
      scope: str(jobs.scope),
      running_scope: str(jobs.running_scope),
      failed_window: str(jobs.failed_window),
      history_complete: false,
      reason_codes: strs(jobs.reason_codes),
    },
    templates: {
      installation_state: word(templates.installation_state),
      configured_accounts: count(templates.configured_accounts),
      configured_templates: count(templates.configured_templates),
      reason_codes: strs(templates.reason_codes),
      send_admission: str(templates.send_admission),
    },
    schedules: { legacy_writes_enabled: false, reviewed_execution_contract: str(schedules.reviewed_execution_contract), physical_acceptance: word(schedules.physical_acceptance) },
    physical_result: word(data.physical_result),
  };
}

// ---------------------------------------------------------------- the tiles

interface WkTiles {
  version: string | null;
  apiContract: number | null;
  profile: string;
  /** Stations WisKey reports `connected`, of the stations it reports; `unknown` = stations whose connection it did not state. */
  connected: number;
  total: number;
  unknown: number;
}

export function tiles(v: WkSystem): WkTiles {
  return {
    version: v.integration.version,
    apiContract: v.integration.api_contract,
    profile: v.integration.profile,
    connected: v.stations.filter((s) => s.connection === 'connected').length,
    total: v.stations.length,
    unknown: v.stations.filter((s) => !(CONNECTIONS as readonly string[]).includes(s.connection)).length,
  };
}

// ---------------------------------------------------------------- closed-set words: a known value has a key, any other is its code

export const PROFILES = ['manual-existing', 'managed'] as const;
export const CONNECTIONS = ['connected', 'connecting', 'auth_failed', 'offline'] as const;
export const SYNC_STATES = ['synced', 'pending', 'syncing', 'offline', 'conflict', 'error', 'delete_pending', 'unavailable'] as const;
export const RESULT_STATES = ['synced', 'pending', 'syncing', 'offline', 'conflict', 'error', 'delete_pending', 'cancelled', 'interrupted', 'cancelled_before_run'] as const;
export const FAILURE_REASONS = ['authentication_failed', 'authorization_denied', 'account_locked', 'timeout', 'connection_failed', 'device_rejected', 'source_changed'] as const;
export const JOB_KINDS = ['csv', 'bulk'] as const;
export const JOB_STATES = ['paused', 'running', 'completed', 'completed_with_errors', 'cancelled'] as const;
export const APPROVAL_STATES = ['pending', 'approved', 'rejected'] as const;
export const APPROVAL_ACTIONS = ['resume', 'retry_failed'] as const;
/** The reason codes WisKey's contract names, with a sentence each; any other code is shown as the code. */
export const REASON_CODES = [
  'per_command_authorization_and_business_admission',
  'schedule_writes_unverified',
  'original_ownership_fresh_source_and_review_required',
  'retention_can_remove_completed_jobs',
  'template_installation_unavailable',
  'original_per_operation_guards',
] as const;
export const TEMPLATE_STATES = ['unavailable', 'installed', 'not_installed'] as const;

/** A word of a closed set: `{key}` when the page has a sentence for it, `{code}` (the value itself, shown as technical text) when not,
 * `{key: <prefix>unknown}` for a missing value or WisKey's own `unknown`. */
export type Word = { key: string } | { code: string };

export function wordOf(prefix: string, value: string | null | undefined, allowed: readonly string[]): Word {
  if (!value || value === UNKNOWN) return { key: `${prefix}unknown` };
  if (allowed.includes(value)) return { key: `${prefix}${value.replace(/-/g, '_')}` };
  return { code: value };
}

/** A reason code as a sentence key, or the code itself. */
export const reasonWord = (code: string | null | undefined): Word | null => (code ? ((REASON_CODES as readonly string[]).includes(code) ? { key: `wkReason_${code}` } : { code }) : null);

// ---------------------------------------------------------------- badges

/** A station's connection as a badge kind: green only for `connected`; anything WisKey did not state is unknown, never ok. */
export function connectionKind(c: string): StateKind {
  switch (c) {
    case 'connected':
      return 'live';
    case 'connecting':
      return 'stale';
    case 'auth_failed':
      return 'error';
    case 'offline':
      return 'offline';
    default:
      return 'unknown';
  }
}

/** A station's sync state (or a sync result) as a badge kind. `cancelled` / `interrupted` are NOT a proof that nothing happened: neutral. */
export function syncKind(s: string): StateKind {
  switch (s) {
    case 'synced':
      return 'live';
    case 'pending':
    case 'delete_pending':
      return 'stale';
    case 'syncing':
      return 'recorded';
    case 'conflict':
    case 'error':
      return 'error';
    case 'offline':
    case 'unavailable':
      return 'offline';
    case 'cancelled':
    case 'interrupted':
    case 'cancelled_before_run':
      return 'neutral';
    default:
      return 'unknown';
  }
}

export function jobKind(s: string): StateKind {
  switch (s) {
    case 'completed':
      return 'live';
    case 'running':
      return 'recorded';
    case 'paused':
      return 'stale';
    case 'completed_with_errors':
      return 'error';
    case 'cancelled':
      return 'neutral';
    default:
      return 'unknown';
  }
}

// ---------------------------------------------------------------- one station's lines

/** What a station's sync request shows: the result WisKey last observed (never a proof of effect), else a pending / running request. */
type RequestLine = { kind: 'none' } | { kind: 'pending' } | { kind: 'active' } | { kind: 'result'; state: string; at: string | null; code: string | null };

export function requestLine(s: WkStation): RequestLine {
  const r = s.sync.request;
  if (!r) return { kind: 'none' };
  if (r.active_request_id) return { kind: 'active' };
  if (r.pending_request_id) return { kind: 'pending' };
  if (r.last_result) return { kind: 'result', state: r.last_result.state, at: r.last_result.observed_at, code: r.last_result.code };
  return { kind: 'none' };
}

/** The technical part of a last failure: `HTTP 401 · ISAPI 4 · userlocked` (each only when WisKey sent it). */
export function failureCodes(f: WkFailure): string {
  return [f.http_status_code !== null ? `HTTP ${f.http_status_code}` : '', f.isapi_status_code !== null ? `ISAPI ${f.isapi_status_code}` : '', f.sub_status ?? '']
    .filter(Boolean)
    .join(' · ');
}

// ---------------------------------------------------------------- job families: every family a row, a missing one said as missing

export type FamilyRow = { family: string; present: true; waiting: number | null; running: number | null; failed: number | null } | { family: string; present: false };

/** One row per family of the contract, in its order: the reported counts (null = unknown, never 0), or `present: false` when WisKey
 * did not report the family (its owner is not loaded) - also when the server's `families_absent` list itself is missing. A family the
 * contract does not name is not shown. No total is computed. */
export function familyRows(v: WkSystem): FamilyRow[] {
  const by = new Map(v.jobs.families.map((f) => [f.family, f] as const));
  return FAMILIES.map((family) => {
    const f = by.get(family);
    return f ? { family, present: true as const, waiting: f.waiting, running: f.running, failed: f.failed_last_24h } : { family, present: false as const };
  });
}

// ---------------------------------------------------------------- jobs/status_v1

export function jobsView(data: unknown): WkJobs | null {
  if (!isObj(data) || !Array.isArray(data.records)) return null;
  const records: WkJob[] = data.records.filter(isObj).flatMap((j) => {
    const id = str(j.id);
    if (!id) return [];
    const approval = isObj(j.approval) ? { state: word(j.approval.state), action: word(j.approval.action), expires_at: str(j.approval.expires_at) } : null;
    // a row number is 1-based (the server's own bound): anything else is not a row the page can name
    const errors = (Array.isArray(j.errors) ? j.errors : []).filter(isObj).flatMap((e) => {
      const row = count(e.row);
      return row !== null && row >= 1 ? [{ row, code: str(e.code) }] : [];
    });
    return [
      {
        id,
        kind: word(j.kind),
        state: word(j.state),
        revision: count(j.revision),
        created_at: str(j.created_at),
        updated_at: str(j.updated_at),
        approval,
        total: count(j.total),
        saved: count(j.saved),
        failed: count(j.failed),
        pending: count(j.pending),
        errors,
        errors_truncated: j.errors_truncated === true,
      },
    ];
  });
  return { records, scope: word(data.scope), history_complete: false, notification: word(data.notification) };
}

/** A job id as the page shows it: the first eight characters (the full id stays in the row's title). */
export const shortId = (id: string): string => id.slice(0, 8);
