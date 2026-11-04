import { apiUrl, ApiError, get, post } from './client';
import type { DisplayZone } from './intercom';

/**
 * WISKEY-OPS-VIEWS-2400 (integration plan T11): the client of Settings › תפעול האינטרקום (routers/access_control_ops.py). Every call is one
 * fixed view - the browser never names an intercom command. Views need `access.read` at the installation; the exports and the job cancel
 * need `access.admin.read` there (the server checks every call; `can` in the overview only decides what is offered).
 *
 *   GET  access-control/operations/overview                  KPI summary + stations, the views this intercom offers, what the caller may do
 *   GET  access-control/operations/operations                operations (sync, bulk, CSV) with progress
 *   GET  access-control/operations/investigations            the timeline (entries, changes, sync); person fields as far as the caller may see
 *   GET  access-control/operations/jobs                      the bulk / CSV jobs with their failed rows
 *   GET  access-control/operations/jobs/<id>/errors.csv      a job's failed rows as a file (administrator, audited)
 *   POST access-control/operations/jobs/<id>/cancel          cancel a job (administrator; envelope, confirmed, revision)
 *   GET  access-control/operations/capacity?days=            capacity per station + Arx's stored trend
 *   GET  access-control/operations/events-report             the entry log's aggregate report
 *   GET  access-control/operations/exports/fleet-inventory.csv, exports/audit.csv   (administrator, audited, formula-safe)
 */

export type OpsView = 'summary' | 'operations' | 'investigations' | 'jobs' | 'job_errors' | 'capacity' | 'inventory' | 'audit_export' | 'events_report' | 'cancel';

export interface OpsStation {
  id: string;
  name: string;
  online: boolean;
  loaded: boolean;
  sync_state: string;
  last_error: string | null;
  pending_users: number | null;
  managed_users: number | null;
  unmanaged_users: number | null;
  users: number | null;
  cards: number | null;
  max_users: number | null;
  max_cards: number | null;
  peak_use_percent: number | null;
  last_seen: string | null;
  reconciled_at: string | null;
}

export interface OpsKpis {
  stations: number;
  online: number;
  offline: number;
  pending_users: number;
  sync_problems: number;
  near_capacity: number;
}

export interface OpsCan {
  admin: boolean;
  export: boolean;
  cancel: boolean;
  names: boolean;
  employee_numbers: boolean;
  actors: boolean;
}

export type SummaryPart =
  | { state: 'ready'; data: { kpis: OpsKpis; stations: OpsStation[]; zone: DisplayZone }; fetched_at: string | null }
  | { state: 'error'; code: string; message: string; details?: Record<string, unknown> };

export interface OpsOverview {
  summary: SummaryPart;
  views: Partial<Record<OpsView, boolean | null>>;
  can: OpsCan;
}

export interface Read<T> {
  data: T;
  fetched_at: string | null;
}

export interface PageInfo {
  total: number;
  offset: number;
  limit: number | null;
  next_offset: number | null;
  previous_offset: number | null;
  snapshot: string;
  stale: boolean;
}

export interface OperationRow {
  id: string;
  kind: 'sync' | 'bulk' | 'csv' | 'unknown';
  action: string;
  state: 'pending' | 'failed' | 'verified' | 'settled' | 'saved' | 'unknown';
  created_at: string | null;
  updated_at: string | null;
  changed: number | null;
  user_ids: string[];
  station_ids: string[];
  progress: { total: number; pending: number; failed: number; verified: number; settled: number };
  errors: string[];
}

export interface OperationsPage extends PageInfo {
  records: OperationRow[];
  summary: Record<'pending' | 'failed' | 'verified' | 'settled' | 'saved', number>;
}

export interface TimelineRow {
  id: string;
  source: 'access' | 'change' | 'sync' | 'unknown';
  time: string | null;
  time_source: string;
  station_ids: string[];
  action: string;
  status: string;
  evidence: string;
  user_id: string | null;
  person_name: string | null;
  employee_no: string | null;
  actor: string | null;
  door: number | null;
  identity_basis: string | null;
  fields: string[];
}

export interface TimelinePage extends PageInfo {
  records: TimelineRow[];
  summary: Record<'access' | 'change' | 'sync', number>;
  actors: Record<string, string | null>;
  access_available: boolean;
  access_storage_failed: boolean;
  retention_days: number;
  fields_hidden: string[];
}

export interface JobRow {
  id: string;
  kind: 'csv' | 'bulk' | 'unknown';
  state: 'paused' | 'running' | 'completed' | 'completed_with_errors' | 'cancelled' | 'unknown';
  revision: number | null;
  created_at: string | null;
  updated_at: string | null;
  total: number;
  saved: number;
  failed: number;
  pending: number;
  approval: { state: string; action: string | null } | null;
  errors: { row: number | null; code: string }[];
  cancellable: boolean;
}

export interface JobsReply extends Read<{ records: JobRow[]; pending_reviews: number; dual_approval: boolean }> {
  can_cancel: boolean;
}

export interface CapacityValues {
  count: number | null;
  limit: number | null;
  used_percent: number | null;
  remaining: number | null;
  growth_per_day: number | null;
  days_to_limit: number | null;
  alert: 'unknown' | 'stale' | 'at_limit' | 'near_limit' | 'growth_to_limit' | 'observed';
}

export interface CapacityRow {
  station_id: string;
  name: string;
  sampled_at: string | null;
  fresh: boolean;
  sample_count: number;
  span_days: number;
  users: CapacityValues;
  cards: CapacityValues;
}

export interface TrendPoint {
  at: string;
  users: number | null;
  cards: number | null;
  max_users: number | null;
  max_cards: number | null;
}

export interface CapacityReply extends Read<{ records: CapacityRow[]; forecast_is_estimate: boolean }> {
  trend: { days: number; series: Record<string, TrendPoint[]>; stored_now: number };
}

export interface ReportCounts {
  records: number;
  authentication: number;
  granted: number;
  denied: number;
  unknown: number;
  other: number;
  recovered: number;
}

export interface EventsReport {
  generated_at: string | null;
  day_timezone: 'station' | 'UTC';
  oldest: string | null;
  newest: string | null;
  totals: ReportCounts;
  methods: Record<'card' | 'pin' | 'unknown', number>;
  anomalies: Record<'access_denied' | 'attempt_limit' | 'unlock_exception' | 'door_not_closed', number>;
  anomaly_by_station: { station_id: string; total: number; counts: Record<string, number> }[];
  by_station: ({ station_id: string } & ReportCounts)[];
  by_day: ({ day: string } & ReportCounts)[];
  retention_days: number | null;
  storage_failed: boolean;
}

const qs = (o: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

const BASE = 'access-control/operations';

export const getOpsOverview = () => get<OpsOverview>(`${BASE}/overview`);

export interface OperationsFilter {
  kind?: string;
  state?: string;
  station_id?: string;
  query?: string;
  offset?: number;
  limit?: number;
  snapshot?: string;
}
export const getOperations = (f: OperationsFilter = {}) => get<Read<OperationsPage>>(`${BASE}/operations${qs({ ...f })}`);

export interface TimelineFilter {
  source?: string;
  station_id?: string;
  query?: string;
  start?: string;
  end?: string;
  offset?: number;
  limit?: number;
  snapshot?: string;
}
export const getInvestigations = (f: TimelineFilter = {}) => get<Read<TimelinePage>>(`${BASE}/investigations${qs({ ...f })}`);

export const getJobs = () => get<JobsReply>(`${BASE}/jobs`);
export const getCapacity = (days: number) => get<CapacityReply>(`${BASE}/capacity${qs({ days })}`);
export const getEventsReport = (f: { station_id?: string; start?: string; end?: string } = {}) => get<Read<EventsReport>>(`${BASE}/events-report${qs({ ...f })}`);

export interface CancelResult {
  status: 'completed';
  command_id: string;
  at: string | null;
  job: JobRow;
}

/** Cancel one job. `revision` is the job's revision as listed (the intercom compares it); `nowMs` the server-aligned clock. */
export function cancelJob(jobId: string, revision: number, nowMs: number = Date.now()): Promise<CancelResult> {
  const expires = new Date(nowMs + 30_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return post<CancelResult>(`${BASE}/jobs/${encodeURIComponent(jobId)}/cancel`, {
    client_request_id: crypto.randomUUID().replace(/-/g, ''),
    expires_at: expires,
    confirmed: true,
    revision,
  });
}

export interface FileResult {
  blob: Blob;
  rows: number | null;
  filename: string;
}

async function fileOf(path: string, fallback: string): Promise<FileResult> {
  const res = await fetch(apiUrl(path), { credentials: 'same-origin' });
  if (!res.ok) {
    let body: Partial<ApiError['body']> = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      body = {};
    }
    throw new ApiError(res.status, {
      code: body.code ?? `http_${res.status}`,
      user_message: body.user_message ?? '',
      retryable: body.retryable ?? false,
      correlation_id: body.correlation_id ?? '',
      details: body.details ?? {},
    });
  }
  const rows = res.headers.get('X-Export-Rows');
  const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1];
  return { blob: await res.blob(), rows: rows === null ? null : Number(rows), filename: name || fallback };
}

export const exportFleetInventory = () => fileOf(`${BASE}/exports/fleet-inventory.csv`, 'intercom-fleet-inventory.csv');
export const exportChangeLog = (f: { station_id?: string; action?: string; start?: string; end?: string } = {}) =>
  fileOf(`${BASE}/exports/audit.csv${qs({ ...f })}`, 'intercom-change-log.csv');
export const exportJobErrors = (jobId: string) => fileOf(`${BASE}/jobs/${encodeURIComponent(jobId)}/errors.csv`, 'intercom-job-errors.csv');

/** Hand a file to the browser's download (an object URL, revoked right after). */
export function saveFile(f: FileResult): void {
  const url = URL.createObjectURL(f.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = f.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
