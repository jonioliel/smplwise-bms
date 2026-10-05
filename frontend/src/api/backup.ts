/**
 * Project backups (T026 / T036): zip files with the project tables and plan files, written before every
 * version upgrade, daily, on request or uploaded; restored in one transaction. Never secrets, never video.
 */
import { apiUrl, del, get, patch, post, upload } from './client';

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
  /** CR-022 review F1: file entries of the backup that were not restored (outside the plan-file allow-list). */
  files_skipped?: number;
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

/**
 * CR-023: the electricity setting `energy.include_history_in_backup` (default off - the readings file can be hundreds of MB).
 * Off: the meter and billing tables, bill PDFs, logos and daily totals are in every backup; on: the full readings file too.
 * Read through `GET /energy/settings` (energy.view); changed with backup.manage. `null` = not readable for this caller (or no
 * electricity module) - the switch is not shown.
 */
export interface MeterBackupSetting {
  on: boolean;
  editable: boolean;
  /** The size of the readings file now (bytes), when the server says. */
  bytes: number | null;
}
const METER_KEY = 'energy.include_history_in_backup';
type EnergySettingsWire = { values?: Record<string, unknown>; editable?: Record<string, boolean>; storage?: { energy_db_bytes?: number } };
function meterSetting(w: EnergySettingsWire): MeterBackupSetting | null {
  if (!w?.values || !(METER_KEY in w.values)) return null;
  return { on: w.values[METER_KEY] === true, editable: !!w.editable?.[METER_KEY], bytes: typeof w.storage?.energy_db_bytes === 'number' ? w.storage.energy_db_bytes : null };
}
export async function getMeterBackup(): Promise<MeterBackupSetting | null> {
  try {
    return meterSetting(await get<EnergySettingsWire>('energy/settings'));
  } catch {
    return null; // no energy.view, or a backend without the electricity module: no switch
  }
}
export async function setMeterBackup(on: boolean): Promise<MeterBackupSetting | null> {
  return meterSetting(await patch<EnergySettingsWire>('energy/settings', { [METER_KEY]: on }));
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
