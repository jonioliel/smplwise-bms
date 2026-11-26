/**
 * WISKEY-STATUS-UI-2520 (row R2 of docs/changes/WISKEY-RESYNC-2520.md): the two typed reads of the segment "מערכת האינטרקום" of the
 * Settings page "בקרת כניסה" - WisKey's numbered status reads, served by routers/access_control_system_status.py (row R1):
 *   GET access-control/status/system   WisKey `system/status_v1` (cached software state only - no device is read)
 *   GET access-control/status/jobs     WisKey `jobs/status_v1` (every retained checkpoint job; WisKey allows its OWNER only)
 * Permission: `access.admin.read` unrestricted at the installation (a station-scoped administrator gets a 403 and is never asked).
 * Every answer is `{state, reason, wiskey_code, fetched_at, data}` with HTTP 200 also when WisKey does not offer the read
 * (`unsupported`: nothing was sent), refuses Arx's service identity (`forbidden`), is not connected (`unavailable`), is busy (`busy`) or
 * answered outside its contract (`error`, `contract_mismatch`); `data` is null unless `state` is `ready`. The browser never names a
 * WisKey command and nothing here writes.
 *
 * The shapes below are the closed projections of services/wiskey_system_status.py. The generated wire type types `data` as an open
 * object, so the page reads it through access-control/status-wiskey-logic.ts, which keeps a missing or malformed value as unknown.
 */
import { get } from './client';
import type { AccessControlSystemStatusRead } from './generated/wire-access-control-system-status';

/** One WisKey status read as the server answers it. */
export type WkRead = AccessControlSystemStatusRead;

export interface WkFailure {
  at: string | null;
  channel: string;
  http_status_code: number | null;
  isapi_status_code: number | null;
  sub_status: string | null;
  reason: string;
}

interface WkLastResult {
  request_id: string | null;
  state: string;
  observed_at: string | null;
  code: string | null;
  effect_proven: false;
}

export interface WkStation {
  station_id: string;
  loaded: boolean | null;
  connection: string;
  last_authenticated_at: string | null;
  last_failure: WkFailure | null;
  firmware: string | null;
  sync: {
    state: string;
    last_reconciled_at: string | null;
    request: { scope: string; pending_request_id: string | null; active_request_id: string | null; last_result: WkLastResult | null } | null;
    last_intent: { operation_id: string | null; state: string; updated_at: string | null; verified_at: string | null } | null;
  };
}

export interface WkFamily {
  family: string;
  waiting: number | null;
  running: number | null;
  failed_last_24h: number | null;
}

export interface WkSystem {
  generated_at: string | null;
  observation_scope: string;
  integration: { version: string | null; api_contract: number | null; profile: string };
  stations: WkStation[];
  writes: {
    writes_enabled: null;
    reason_codes: string[];
    legacy_schedule_writes_enabled: false;
    legacy_schedule_reason: string | null;
    reviewed_schedule_contract: string | null;
    reviewed_schedule_reason: string | null;
  };
  jobs: {
    families: WkFamily[];
    families_absent: string[];
    scope: string | null;
    running_scope: string | null;
    failed_window: string | null;
    history_complete: false;
    reason_codes: string[];
  };
  templates: {
    installation_state: string;
    configured_accounts: number | null;
    configured_templates: number | null;
    reason_codes: string[];
    send_admission: string | null;
  };
  schedules: { legacy_writes_enabled: false; reviewed_execution_contract: string | null; physical_acceptance: string };
  physical_result: string;
}

export interface WkJob {
  id: string;
  kind: string;
  state: string;
  revision: number | null;
  created_at: string | null;
  updated_at: string | null;
  approval: { state: string; action: string; expires_at: string | null } | null;
  total: number | null;
  saved: number | null;
  failed: number | null;
  pending: number | null;
  errors: Array<{ row: number; code: string | null }>;
  errors_truncated: boolean;
}

export interface WkJobs {
  records: WkJob[];
  scope: string;
  history_complete: false;
  notification: string;
}

export const getWkSystemStatus = () => get<WkRead>('access-control/status/system');
export const getWkJobsStatus = () => get<WkRead>('access-control/status/jobs');
