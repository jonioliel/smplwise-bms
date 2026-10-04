/** Health report (T033): one check per subsystem with its own status, detail and numbers. */
import { get } from './client';

/** off: not part of this installation (NVR-less mode) - neutral, never lowers the overall status. */
export type CheckStatus = 'ok' | 'warn' | 'error' | 'off';

export interface HealthCheck {
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

export const STATUS_LABEL: Record<CheckStatus, string> = { ok: 'תקין', warn: 'לתשומת לב', error: 'שגיאה', off: 'לא מוגדר' };
export const STATUS_KIND: Record<CheckStatus, 'live' | 'stale' | 'offline' | 'neutral'> = { ok: 'live', warn: 'stale', error: 'offline', off: 'neutral' };

export const healthReport = (fresh = false) => get<HealthReport>(`health/report${fresh ? '?fresh=1' : ''}`);

/** Cheap status for the top bar (every signed-in user): cached job states only, never a device probe. */
export interface HealthSummary {
  status: CheckStatus;
  items: { id: string; status: CheckStatus; label: string }[];
  checked_at: string;
  version: string;
}
export const healthSummary = () => get<HealthSummary>('health/summary');

export function fmtUptime(s: number): string {
  if (s < 3600) return `${Math.floor(s / 60)} דק׳`;
  if (s < 86400) return `${Math.floor(s / 3600)} שע׳ ${Math.floor((s % 3600) / 60)} דק׳`;
  return `${Math.floor(s / 86400)} ימים ${Math.floor((s % 86400) / 3600)} שע׳`;
}
