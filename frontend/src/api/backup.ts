/**
 * Project backups (T026 / T036): zip files with the project tables and plan files, written before every
 * version upgrade, daily, on request or uploaded; restored in one transaction. Never secrets, never video.
 */
import { apiUrl, del, get, post, upload } from './client';

export type BackupKind = 'manual' | 'upload' | 'auto-pre-upgrade' | 'auto-daily' | string;

export interface BackupEntry {
  name: string;
  bytes: number;
  created_at: string;
  kind: BackupKind;
  note: string;
  app_version: string | null;
  schema_version: number | null;
  tables: Record<string, number>;
  files: number;
  valid: boolean;
}

export interface RestoreResult {
  name: string;
  mode: 'replace' | 'merge';
  scope: 'project' | 'project+access';
  tables: Record<string, number>;
  files: number;
  app_version: string | null;
  created_at: string | null;
}

export const KIND_LABEL: Record<string, string> = {
  manual: 'ידני',
  upload: 'הועלה',
  'auto-pre-upgrade': 'אוטומטי · לפני עדכון',
  'auto-daily': 'אוטומטי · יומי',
};

export const TABLE_LABEL: Record<string, string> = {
  sites: 'אתרים',
  buildings: 'מבנים',
  floors: 'קומות',
  plan_assets: 'קבצי תוכנית',
  plan_versions: 'גרסאות תוכנית',
  map_anchors: 'עוגנים',
  cameras: 'מצלמות',
  spatial_zones: 'אזורים',
  settings: 'הגדרות',
  users: 'משתמשים',
  bindings: 'הרשאות',
  groups: 'קבוצות',
};

export const listBackups = () => get<{ backups: BackupEntry[]; policy: Record<string, number>; bytes: number; schema_version: number }>('backups');
export const createBackup = (body: { note?: string; include_audit?: boolean; include_events?: boolean } = {}) => post<BackupEntry>('backups', body);
export const deleteBackup = (name: string) => del(`backups/${encodeURIComponent(name)}`);
export const restoreBackup = (name: string, body: { mode: 'replace' | 'merge'; scope: 'project' | 'project+access'; confirm: string }) =>
  post<RestoreResult>(`backups/${encodeURIComponent(name)}/restore`, body);
export const backupDownloadUrl = (name: string) => apiUrl(`backups/${encodeURIComponent(name)}/download`);
export function uploadBackup(file: File) {
  const form = new FormData();
  form.append('file', file, file.name);
  return upload<BackupEntry>('backups/upload', form);
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
