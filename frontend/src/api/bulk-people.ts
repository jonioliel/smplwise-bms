/**
 * CR-BULKPEOPLE-295: the typed calls of bulk edit and CSV import / export of access-control people (routers/bulk_people.py).
 * The server decides every permission and every row; nothing here grants anything. No PIN, card or photo ever travels in a file.
 *   GET  settings                 the switch, the go-live permit flag, the limits, what this caller may do
 *   GET  template.csv / export.csv the header row / the people the caller may see (one export a minute)
 *   POST jobs (text/csv)          upload -> the validation report (nothing sent)
 *   POST jobs/edit                bulk edit of selected people
 *   POST jobs/{id}/dry-run        the diff at the caller's level (never writes)
 *   POST jobs/{id}/confirm        a system administrator, bound to the plan digest and the typed row count
 *   POST jobs/{id}/apply          the next bounded batch (refused while the owner's go-live permit is not in the build)
 *   POST jobs/{id}/cancel         stop the job and purge its row data
 */
import { ApiError, api, apiUrl, get, post, put } from './client';

const BASE = 'access-control/bulk-people';

export interface BulkSettings {
  enabled: 'off' | 'on';
  go_live_permitted: boolean;
  limits: { max_file_bytes: number; max_rows: number; max_edit_people: number; batch: number; export_rows: number; job_hours: number };
  columns: string[];
  system_admin?: boolean;
  may_import?: boolean;
  may_export?: boolean;
}

export interface ReportEntry {
  row: number;
  status: 'ok' | 'skip' | 'error';
  codes: string[];
  fields: string[];
}

export interface PlanEntry {
  row: number;
  op: 'create' | 'update';
  person_id: string | null;
  revision: number | null;
  fields: string[];
}

export type Outcome = 'ok' | 'failed' | 'unknown' | 'not_sent';

export interface RowResult {
  row: number;
  outcome: Outcome;
  code: string | null;
  person_id: string | null;
}

export type JobState = 'staged' | 'previewed' | 'confirmed' | 'applying' | 'paused' | 'done' | 'cancelled' | 'expired';

export interface BulkJob {
  id: string;
  kind: 'import' | 'edit';
  state: JobState;
  row_count: number;
  created_at: string;
  expires_at: string;
  report: ReportEntry[];
  counts: { ok: number; skip: number; error: number };
  plan: PlanEntry[] | null;
  plan_digest: string | null;
  previewed_at: string | null;
  writes: number | null;
  confirmed: boolean;
  results: RowResult[];
  outcomes: Partial<Record<Outcome, number>>;
  progress: { done: number; total: number };
  go_live_permitted: boolean;
  /** apply only: call again */
  more?: boolean;
  /** apply only: the access-control system could not be reached - resume later */
  stalled?: boolean;
}

export interface DiffField {
  field: string;
  before: unknown;
  after: unknown;
}

export interface DryRunRow {
  row: number;
  op: 'create' | 'update';
  person_id: string | null;
  status: 'write' | 'unchanged' | 'error';
  codes: string[];
  fields: string[];
  name?: string | null;
  diff?: DiffField[];
}

export interface BulkEdit {
  person_ids: string[];
  valid_from?: string;
  valid_until?: string;
  active?: boolean;
  doors_add?: Record<string, number[]>;
  doors_remove?: string[];
  groups_add?: string[];
  groups_remove?: string[];
}

/** A fresh key per deliberate upload / edit (the server answers the same job for the same key and content). */
export function idempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const bulkSettings = () => get<BulkSettings>(`${BASE}/settings`);
export const setBulkEnabled = (enabled: 'off' | 'on') => put<BulkSettings>(`${BASE}/settings`, { enabled });

export function stageImport(file: Blob, key: string): Promise<{ job: BulkJob; replayed: boolean }> {
  return api(`${BASE}/jobs`, { method: 'POST', body: file, headers: { 'Content-Type': 'text/csv', 'Idempotency-Key': key } });
}

export function stageEdit(edit: BulkEdit, key: string): Promise<{ job: BulkJob; replayed: boolean }> {
  return api(`${BASE}/jobs/edit`, { method: 'POST', body: JSON.stringify(edit), headers: { 'Idempotency-Key': key } });
}

export const getJob = (id: string) => get<{ job: BulkJob }>(`${BASE}/jobs/${encodeURIComponent(id)}`);
export const dryRun = (id: string) => post<{ job: BulkJob; rows: DryRunRow[] }>(`${BASE}/jobs/${encodeURIComponent(id)}/dry-run`);
export const confirmJob = (id: string, planDigest: string, typed: string) =>
  post<{ job: BulkJob }>(`${BASE}/jobs/${encodeURIComponent(id)}/confirm`, { plan_digest: planDigest, confirm: typed });
export const applyBatch = (id: string) => post<{ job: BulkJob }>(`${BASE}/jobs/${encodeURIComponent(id)}/apply`);
export const cancelJob = (id: string) => post<{ job: BulkJob }>(`${BASE}/jobs/${encodeURIComponent(id)}/cancel`);

async function fileOf(path: string): Promise<{ blob: Blob; rows: number | null }> {
  const res = await fetch(apiUrl(path), { credentials: 'same-origin' });
  if (!res.ok) {
    let body: Partial<ApiError['body']> = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      body = {};
    }
    throw new ApiError(res.status, { code: body.code ?? `http_${res.status}`, user_message: body.user_message ?? '', retryable: body.retryable ?? false,
      correlation_id: body.correlation_id ?? '', details: body.details ?? {} });
  }
  const rows = res.headers.get('X-Export-Rows');
  return { blob: await res.blob(), rows: rows === null ? null : Number(rows) };
}

export const exportPeopleCsv = () => fileOf(`${BASE}/export.csv`);
export const templateCsv = () => fileOf(`${BASE}/template.csv`);
