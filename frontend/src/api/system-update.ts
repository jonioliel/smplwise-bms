/** CR-021 S2: the self-update state, the manual check and the check interval (backend: routers/system_update.py). */
import { ApiError, get, put, api } from './client';
import type { RestartReason, RunRef } from './system-update-runs';

export const INTERVAL_CHOICES = [0, 1, 3, 6, 12, 24] as const;

export type CheckResult = 'current' | 'update_available' | 'refresh_failed_read_ok' | 'not_permitted' | 'unreachable' | 'error' | string;

/** One release-notes entry (S1 returns an empty list; the notes arrive with a later slice). */
export interface UpdateNote {
  version: string;
  he?: string;
  en?: string;
  platform_restart?: boolean;
}

/** What a caller without `system.update` gets: `{ update_available: false }` and nothing else. */
export interface UpdateState {
  update_available: boolean;
  installed?: string;
  latest?: string | null;
  checked_at?: string | null;
  check_result?: CheckResult | null;
  interval_hours?: number;
  permitted?: 'unknown' | 'yes' | 'no';
  notes?: UpdateNote[];
  requires_platform_restart?: boolean;
  /** CR-021 S3: why (bridge / wiskey / release), holders only. */
  platform_restart_reasons?: RestartReason[];
  /** CR-021 S3: the open (not finished) update or platform-restart run, if any. */
  run?: RunRef | null;
}

export interface CheckOut {
  checked_at: string | null;
  check_result: CheckResult;
  installed: string;
  latest: string | null;
  update_available: boolean;
  refreshed: boolean;
}

export const getUpdateState = () => get<UpdateState>('system/update/state');
export const checkForUpdate = () => api<CheckOut>('system/update/check', { method: 'POST', body: JSON.stringify({}) });
export const setUpdateInterval = (interval_hours: number) => put<{ interval_hours: number }>('system/update/settings', { interval_hours });

export type CheckFailure = { kind: 'rate_limited'; wait: number | null } | { kind: 'not_permitted' } | { kind: 'unreachable' } | { kind: 'error'; message: string };

/** Sorts a failed check into the states the page words in Hebrew (the server's own text is a fallback only). */
export function classifyCheckError(err: unknown): CheckFailure {
  if (err instanceof ApiError) {
    if (err.status === 429 || err.code === 'rate_limited') {
      const w = Number((err.body.details ?? {})['retry_after_s']);
      return { kind: 'rate_limited', wait: Number.isFinite(w) && w > 0 ? w : null };
    }
    if (err.code === 'platform_not_permitted') return { kind: 'not_permitted' };
    if (err.code === 'infrastructure_unreachable') return { kind: 'unreachable' };
    return { kind: 'error', message: err.body.user_message || '' };
  }
  return { kind: 'error', message: '' };
}

/** The last check, in words: "עודכן / יש עדכון / לא ניתן לבדוק / אין הרשאה" (CR-021 section 4). */
export function resultLabel(result: CheckResult | null | undefined, available: boolean): string {
  if (!result) return '';
  switch (result) {
    case 'current':
    case 'available':
    case 'update_available':
    case 'refresh_failed_read_ok':
      return available ? 'יש עדכון' : 'עודכן';
    case 'not_permitted':
      return 'אין הרשאה';
    default:
      return 'לא ניתן לבדוק';
  }
}

export function intervalLabel(h: number): string {
  return h === 0 ? 'כבוי' : h === 1 ? 'כל שעה' : `כל ${h} שעות`;
}
