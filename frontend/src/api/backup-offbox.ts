/**
 * DATASTORE-295 phase 2: the off-box copies of the project backups (routers/backup_offbox.py) and the restore drill
 * (routers/backup.py `backups/drill`). Credentials are WRITE-ONLY: the server answers only which fields are set (`secrets`).
 * A target is an S3-compatible bucket (Cloudflare R2, AWS, B2, MinIO ...) or an SFTP server with a pinned host key.
 */
import { del, get, patch, post, put } from './client';

export type OffboxKind = 's3' | 'sftp' | 'local';

export interface OffboxRetention {
  keep_last: number;
  keep_daily: number;
  keep_weekly: number;
  keep_monthly: number;
}

export interface OffboxRun {
  id: number;
  action: 'push' | 'test' | 'drill' | 'dry_run';
  trigger: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean;
  error: string | null;
  object: string | null;
  key_id: string | null;
  sealed_bytes: number | null;
  verified: boolean;
  deleted_count: number;
}

export interface OffboxTarget {
  id: string;
  name: string;
  kind: OffboxKind;
  enabled: boolean;
  config: Record<string, string | number | boolean>;
  secrets: Record<string, boolean>;
  retention: OffboxRetention;
  revision: number;
  updated_at: string;
  last: { push: OffboxRun | null; test: OffboxRun | null; drill: OffboxRun | null };
}

export interface OffboxKeyInfo {
  id: string;
  created_at: string | null;
  source: string | null;
  exported: boolean;
  exported_at: string | null;
  active: boolean;
}

export interface OffboxStatus {
  targets: OffboxTarget[];
  key: { active: string | null; keys: OffboxKeyInfo[]; error?: string };
  running: boolean;
  transports: Record<OffboxKind, boolean>;
}

export interface OffboxTargetIn {
  name: string;
  kind: OffboxKind;
  enabled: boolean;
  config: Record<string, string | number | boolean>;
  /** field -> new value; omit a field to keep it; '' clears it. */
  secrets: Record<string, string>;
  retention: OffboxRetention;
}

export interface OffboxCheckResult {
  ok: boolean;
  steps?: string[];
  error: string | null;
  objects?: number;
}

export interface DrillSummary {
  result: 'PASS' | 'FAIL';
  trigger: string;
  started_at: string;
  finished_at: string | null;
  archive: string | null;
  source: 'local' | 'offbox';
  target_id: string | null;
  total_ms: number | null;
  failed: string[];
}

export interface DrillResult {
  result: 'PASS' | 'FAIL';
  finished_at: string;
  checks: { name: string; ok: boolean; severity: string }[];
  source?: { kind: 'local' | 'offbox'; target_id?: string };
}

export interface DrillStatus {
  running: boolean;
  last: DrillResult | null;
  last_offbox: DrillResult | null;
  history: DrillSummary[];
  schedule: { monthly: boolean; next_due_at: string | null; due_now: boolean };
}

/** Which fields each kind holds in `config` (non-secret) and which are credentials (write-only). */
export const CONFIG_FIELDS: Record<'s3' | 'sftp', readonly string[]> = {
  s3: ['endpoint', 'bucket', 'region', 'prefix', 'path_style'],
  sftp: ['host', 'port', 'username', 'remote_dir', 'host_key'],
};
export const SECRET_FIELDS: Record<'s3' | 'sftp', readonly string[]> = { s3: ['access_key', 'secret_key'], sftp: ['key'] };

export const DEFAULT_RETENTION = (): OffboxRetention => ({ keep_last: 3, keep_daily: 7, keep_weekly: 4, keep_monthly: 6 });

/** A new target form's starting values (Cloudflare R2 shape: region `auto`, path-style). */
export function blankTarget(kind: 's3' | 'sftp'): OffboxTargetIn {
  return kind === 's3'
    ? { name: '', kind, enabled: true, config: { endpoint: 'https://', bucket: '', region: 'auto', prefix: 'arx-backups', path_style: true }, secrets: {}, retention: DEFAULT_RETENTION() }
    : { name: '', kind, enabled: true, config: { host: '', port: 22, username: '', remote_dir: '/', host_key: '' }, secrets: {}, retention: DEFAULT_RETENTION() };
}

/** The request body: trimmed strings, the port as a number, only the secrets the administrator typed (never empty = keep). */
export function toRequest(form: OffboxTargetIn, clear: readonly string[] = []): OffboxTargetIn {
  const config: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(form.config)) config[k] = typeof v === 'string' ? v.trim() : v;
  if ('port' in config) config.port = Number(config.port) || 22;
  const secrets: Record<string, string> = {};
  for (const [k, v] of Object.entries(form.secrets)) if (v) secrets[k] = k === 'key' ? v : v.trim();
  for (const k of clear) secrets[k] = '';
  return { ...form, name: form.name.trim(), config, secrets };
}

export const offboxStatus = () => get<OffboxStatus>('backups/offbox');
export const createTarget = (body: OffboxTargetIn) => post<OffboxTarget>('backups/offbox/targets', body);
export const updateTarget = (id: string, body: OffboxTargetIn) => put<OffboxTarget>(`backups/offbox/targets/${encodeURIComponent(id)}`, body);
export const setTargetEnabled = (id: string, enabled: boolean) => patch<OffboxTarget>(`backups/offbox/targets/${encodeURIComponent(id)}`, { enabled });
export const deleteTarget = (id: string) => del(`backups/offbox/targets/${encodeURIComponent(id)}`);
export const checkTarget = (id: string) => post<OffboxCheckResult>(`backups/offbox/targets/${encodeURIComponent(id)}/test`);
export const pushTarget = (id: string, dry_run = false) =>
  post<{ started: boolean; dry_run: boolean; result?: { ok: boolean; error: string | null; plan?: { upload: { name: string }; delete: string[] } } }>(
    `backups/offbox/targets/${encodeURIComponent(id)}/push`, { dry_run });
export const exportKey = () => post<{ key_id: string; key: string }>('backups/offbox/key/export', { confirm: 'EXPORT' });
export const rotateKey = () => post<OffboxStatus['key']>('backups/offbox/key/rotate', { confirm: 'ROTATE' });
export const importKey = (key: string) => post<OffboxStatus['key']>('backups/offbox/key/import', { key: key.trim() });

export const drillStatus = () => get<DrillStatus>('backups/drill');
export const runDrill = (target_id?: string) => post<{ started: boolean }>('backups/drill', target_id ? { target_id } : {});
export const setDrillMonthly = (monthly: boolean) => put<DrillStatus>('backups/drill/schedule', { monthly });

// ---- OFFBOX-RESTORE-2300: restore the installation FROM an encrypted off-box copy (two steps: prepare, then confirm)

export interface OffboxCopy {
  name: string;
  bytes: number;
  /** The archive time stamp from the object name (ISO, UTC), or null. */
  stamp: string | null;
}

export interface OffboxPrepared {
  id: string;
  object: string;
  key_id: string;
  sealed_sha256: string;
  plain_sha256: string;
  plain_bytes: number;
  app_version: string | null;
  schema_version: number;
  kind: string | null;
  archive_created_at: string | null;
  tables: Record<string, number>;
  files: number;
  sensitive: 'encrypted' | 'omitted' | 'legacy' | null;
  warnings: string[];
  expires_in_s: number;
}

export interface OffboxRestored {
  object: string;
  safety_archive: { name: string; bytes: number; created_at: string };
  tables: Record<string, number>;
  files: number;
}

export const listCopies = (targetId: string) => get<{ target_id: string; copies: OffboxCopy[] }>(`backups/offbox/targets/${encodeURIComponent(targetId)}/copies`);
export const prepareRestore = (target_id: string, object: string) => post<OffboxPrepared>('backups/offbox/restore/prepare', { target_id, object });
export const discardRestore = (stageId: string) => del(`backups/offbox/restore/${encodeURIComponent(stageId)}`);
/** The destructive step: the typed word is part of the request and the server refuses anything else. */
export const restoreFromCopy = (body: { stage_id: string; confirm: string; scope: 'project' | 'project+access'; backup_password?: string; skip_sensitive?: boolean }) =>
  post<OffboxRestored>('backups/offbox/restore', { mode: 'replace', ...body });

/** The restore button works only with the typed word and no request in flight. */
export function restoreReady(typed: string, busy: boolean): boolean {
  return typed === 'RESTORE' && !busy;
}
