/**
 * DATASTORE-295 phase 2: the off-box copies of the project backups (routers/backup_offbox.py) and the restore drill
 * (routers/backup.py `backups/drill`). Credentials are WRITE-ONLY: the server answers only which fields are set (`secrets`).
 * A target is an S3-compatible bucket (Cloudflare R2, AWS, B2, MinIO ...) or an SFTP server with a pinned host key.
 */
import { del, get, patch, post, put } from './client';

export type OffboxKind = 's3' | 'sftp' | 'local' | 'gdrive';
/** The kinds an administrator adds from the screen (a `local` folder is configured elsewhere). */
export type FormKind = 's3' | 'sftp' | 'gdrive';

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
  /** GDRIVEBK-2310, `gdrive` targets only: whether a Google account is connected / a consent is waiting. Never a token. */
  gdrive?: { connected: boolean; pending: boolean; connected_at: string | null };
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
export const CONFIG_FIELDS: Record<FormKind, readonly string[]> = {
  s3: ['endpoint', 'bucket', 'region', 'prefix', 'path_style'],
  sftp: ['host', 'port', 'username', 'remote_dir', 'host_key'],
  gdrive: ['client_id', 'folder_name', 'prune_mode', 'chunk_mib', 'quota_margin_pct', 'min_free_mib'],
};
/** Write-only credentials the administrator types. The Google refresh token is NOT one: it comes only from "connect". */
export const SECRET_FIELDS: Record<FormKind, readonly string[]> = { s3: ['access_key', 'secret_key'], sftp: ['key'], gdrive: ['client_secret'] };

/** The numeric fields of a Google Drive target (sent as numbers). */
export const GDRIVE_NUMBERS: Record<string, { min: number; max: number; fallback: number }> = {
  chunk_mib: { min: 1, max: 64, fallback: 8 },
  quota_margin_pct: { min: 0, max: 100, fallback: 10 },
  min_free_mib: { min: 0, max: 1_000_000, fallback: 100 },
};

export const DEFAULT_RETENTION = (): OffboxRetention => ({ keep_last: 3, keep_daily: 7, keep_weekly: 4, keep_monthly: 6 });

/** A new target form's starting values (Cloudflare R2 shape: region `auto`, path-style). A Google Drive target starts OFF: it can be
 *  switched on only after an account is connected. */
export function blankTarget(kind: FormKind): OffboxTargetIn {
  if (kind === 'gdrive') {
    return { name: 'Google Drive', kind, enabled: false, config: { client_id: '', folder_name: 'SmplWise Arx backups', prune_mode: 'delete', chunk_mib: 8,
      quota_margin_pct: 10, min_free_mib: 100 }, secrets: {}, retention: DEFAULT_RETENTION() };
  }
  return kind === 's3'
    ? { name: '', kind, enabled: true, config: { endpoint: 'https://', bucket: '', region: 'auto', prefix: 'arx-backups', path_style: true }, secrets: {}, retention: DEFAULT_RETENTION() }
    : { name: '', kind, enabled: true, config: { host: '', port: 22, username: '', remote_dir: '/', host_key: '' }, secrets: {}, retention: DEFAULT_RETENTION() };
}

/** The request body: trimmed strings, the port as a number, only the secrets the administrator typed (never empty = keep). */
export function toRequest(form: OffboxTargetIn, clear: readonly string[] = []): OffboxTargetIn {
  const config: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(form.config)) config[k] = typeof v === 'string' ? v.trim() : v;
  if ('port' in config) config.port = Number(config.port) || 22;
  if (form.kind === 'gdrive') {
    for (const [k, r] of Object.entries(GDRIVE_NUMBERS)) {
      if (!(k in config)) continue;
      const n = Math.round(Number(config[k]));
      config[k] = Number.isFinite(n) && String(config[k]).trim() !== '' ? Math.max(r.min, Math.min(r.max, n)) : r.fallback;
    }
  }
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
// ---- GDRIVEBK-2310: connect a Google Drive target (the device flow: a short code approved at google.com/device)

export interface GdriveCode {
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}
export type GdrivePollState = 'none' | 'pending' | 'slow_down' | 'denied' | 'expired' | 'connected';

export const gdriveConnect = (id: string) => post<GdriveCode>(`backups/offbox/targets/${encodeURIComponent(id)}/gdrive/connect`);
export const gdrivePoll = (id: string) => post<{ state: GdrivePollState; interval?: number }>(`backups/offbox/targets/${encodeURIComponent(id)}/gdrive/poll`);
export const gdriveDisconnect = (id: string) =>
  post<{ had_token: boolean; revoked: boolean | null; target: OffboxTarget }>(`backups/offbox/targets/${encodeURIComponent(id)}/gdrive/disconnect`);

/** The next poll in ms: the server's interval (1-60 s), never faster than 2 s. */
export function pollDelayMs(interval: number | undefined): number {
  const s = Number.isFinite(interval) ? Math.max(2, Math.min(60, Number(interval))) : 5;
  return s * 1000;
}

/** Whether the poll loop goes on after this answer. */
export function pollContinues(state: GdrivePollState): boolean {
  return state === 'pending' || state === 'slow_down';
}

/** Google's device page only - a link from anywhere else is never shown as a link. */
export function isGoogleDeviceUrl(url: string): boolean {
  return /^https:\/\/(www\.)?google\.com\/device$/.test(url);
}

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
export const restoreFromCopy = (body: { stage_id: string; confirm: string; scope: RestoreScope; backup_password?: string; skip_sensitive?: boolean;
  safety_backup_password?: string }) =>
  post<OffboxRestored>('backups/offbox/restore', { mode: 'replace', ...body });

// ---- owner decisions 2026-10-30: the restore defaults are settings, each with a default

export type RestoreScope = 'project' | 'project+access';

/** `backup.offbox_restore_scope`: the initial choice of the restore-from-copy dialog. Default (and any unknown value): project + access. */
export function scopeFromSetting(v: unknown): RestoreScope {
  return v === 'project' ? 'project' : 'project+access';
}

/** `backup.safety_before_local_restore`: a local restore writes the safety backup first. Default (and any unknown value): on. */
export function localSafetyOn(v: unknown): boolean {
  return v !== 'off';
}

/** The safety backup's password travels only when typed, in its own field (never mixed with the copy's backup password). */
export function safetyBody(pw: string): { safety_backup_password?: string } {
  return pw ? { safety_backup_password: pw } : {};
}

/** The restore button works only with the typed word and no request in flight. */
export function restoreReady(typed: string, busy: boolean): boolean {
  return typed === 'RESTORE' && !busy;
}
