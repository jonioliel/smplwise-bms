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
 * WKR5ADOPT-295 (W-006), default off:
 *   PUT  wiskey-csv/settings      the switch (system administrator)
 *   POST jobs/{id}/wiskey-preview the SAME file again: WisKey's verified preview (a read; nothing is written)
 *   POST jobs/{id}/wiskey-confirm the typed row count (system administrator): fresh preview, compare, start
 *   GET  jobs/{id}/wiskey-result  the started operation's completion read (never a replay)
 */
import { ApiError, api, apiUrl, get, post, put } from './client';

const BASE = 'access-control/bulk-people';

export interface BulkSettings {
  enabled: 'off' | 'on';
  go_live_permitted: boolean;
  limits: { max_file_bytes: number; max_rows: number; max_edit_people: number; batch: number; export_rows: number; job_hours: number };
  columns: string[];
  /** WKR5ADOPT-295: the WisKey-verified preview of a people CSV (default off; the server names what blocks it). */
  wiskey_csv?: WiskeyCsvStatus;
  system_admin?: boolean;
  may_import?: boolean;
  may_export?: boolean;
}

export interface WiskeyCsvStatus {
  enabled: 'off' | 'on';
  available: boolean;
  /** switch_off | bulk_people_off | binding_not_configured | direct_not_installed | direct_not_selected */
  blockers: string[];
  mode: string;
  fields: string[];
}

/** WisKey's verified preview as the screen gets it: lines and operations only - never a cell value, a token, a stamp or the start. */
export interface VerifiedPreview {
  preview_digest: string;
  expires_at: string;
  writes: number;
  creates: number;
  updates: number;
  skipped: number;
  errors: number;
  rows: { source_line: number; op: 'create' | 'update' }[];
}

export type CsvOperationState = 'not_started' | 'running' | 'finished' | 'cancelled' | 'unknown';

export interface CsvOperation {
  state: CsvOperationState;
  saved?: number | null;
  code?: string;
  /** always false: an unknown outcome is never replayed */
  replay_available: false;
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

export const setWiskeyCsvEnabled = (enabled: 'off' | 'on') => put<WiskeyCsvStatus>(`${BASE}/wiskey-csv/settings`, { enabled });

export function verifyImport(id: string, file: Blob): Promise<{ job: BulkJob; preview: VerifiedPreview }> {
  return api(`${BASE}/jobs/${encodeURIComponent(id)}/wiskey-preview`, { method: 'POST', body: file, headers: { 'Content-Type': 'text/csv' } });
}

export const confirmVerified = (id: string, previewDigest: string, typed: string) =>
  post<{ job: BulkJob; operation: CsvOperation }>(`${BASE}/jobs/${encodeURIComponent(id)}/wiskey-confirm`, { preview_digest: previewDigest, confirm: typed });

export const verifiedResult = (id: string) => get<{ operation: CsvOperation }>(`${BASE}/jobs/${encodeURIComponent(id)}/wiskey-result`);
