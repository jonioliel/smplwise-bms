/** Health report (T033): one check per subsystem with its own status, detail and numbers. */
import { apiBlob, get } from './client';
import { dispositionName, saveBlob } from './download';
import { tr } from '../i18n/msg/api-core';
import { tr as trTime } from '../i18n/msg/time'; // CR-I18N-UNITS-2442: the short durations

/** off: not part of this installation (NVR-less mode) - neutral, never lowers the overall status. */
export type CheckStatus = 'ok' | 'warn' | 'error' | 'off';

interface HealthCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  meta: Record<string, unknown>;
}

/** NN1: is this a supported installation (an NVR without a media server is not), and if not why, in operator wording from the server. */
export interface InstallationBlock {
  supported: boolean;
  reason: string | null;
  message: string | null;
  action: string | null;
}

export interface HealthReport {
  installation?: InstallationBlock;
  status: CheckStatus;
  version: string;
  uptime_s: number;
  checked_at: string;
  probe_ttl_s: number;
  checks: HealthCheck[];
  mode?: 'full' | 'ha_only';
}

export const STATUS_LABEL: Record<CheckStatus, string> = { ok: tr('תקין'), warn: tr('לתשומת לב'), error: tr('שגיאה'), off: tr('לא מוגדר') };
export const STATUS_KIND: Record<CheckStatus, 'live' | 'stale' | 'offline' | 'neutral'> = { ok: 'live', warn: 'stale', error: 'offline', off: 'neutral' };

export const healthReport = (fresh = false) => get<HealthReport>(`health/report${fresh ? '?fresh=1' : ''}`);

/** CR-FE-LOGEXPORT-TARIFF-EN-2440 (T033): the windows (minutes) and levels the log export offers; the server allows 1-1440 minutes. */
export const LOG_EXPORT_MINUTES = [15, 60, 180, 360, 720, 1440] as const;
export type LogExportMinutes = (typeof LOG_EXPORT_MINUTES)[number];
export const LOG_EXPORT_LEVELS = ['INFO', 'WARNING', 'ERROR'] as const;
export type LogExportLevel = (typeof LOG_EXPORT_LEVELS)[number];

/**
 * T033: `POST /health/logs/export` (system.configure only) - the redacted log file, saved by the browser. Called only after the
 * administrator confirmed (`consent: true`); the health checks are included. Resolves with the saved file's name.
 */
export async function exportLogs(minutes: LogExportMinutes, minLevel: LogExportLevel): Promise<string> {
  const { blob, headers } = await apiBlob('health/logs/export', {
    method: 'POST',
    body: JSON.stringify({ consent: true, minutes, min_level: minLevel, include_health: true }),
  });
  const name = dispositionName(headers.get('Content-Disposition'), 'arx-logs.json');
  saveBlob(blob, name);
  return name;
}

/** Cheap status for the top bar (every signed-in user): cached job states only, never a device probe. */
export interface HealthSummary {
  status: CheckStatus;
  items: { id: string; status: CheckStatus; label: string }[];
  checked_at: string;
  version: string;
}
export const healthSummary = () => get<HealthSummary>('health/summary');

export function fmtUptime(s: number): string {
  if (s < 3600) return trTime('{n} דק׳', { n: Math.floor(s / 60) });
  if (s < 86400) return trTime('{h} שע׳ {m} דק׳', { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) });
  return trTime('{d} ימים {h} שע׳', { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600) });
}
