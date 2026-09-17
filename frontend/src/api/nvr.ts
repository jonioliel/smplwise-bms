/** Owner-approved NVR writes (0.1.64): "Notify Surveillance Center" per channel and the change log with rollback.
 * Reading needs system.configure; writing needs the sensitive permission `nvr.config.events` (custom role). */
import { get, post, put } from './client';

export interface NotifyType { supported: boolean; center: boolean | null }
export interface NotifyChannel {
  camera_id: string;
  channel: number;
  name: string;
  motion: NotifyType;
  smart: Record<string, NotifyType>;
  smart_supported: number;
  smart_center: number;
}
export interface NotifyStatus { channels: NotifyChannel[]; permission: string; can_write: boolean; labels: Record<string, string> }
export interface NotifyResult { results: { channel: number; type: string; status: string; reason?: string; change_id?: string }[]; applied: number; unchanged: number; skipped: number; failed: number }
export interface NvrChange {
  id: string;
  kind: string;
  permission: string;
  target: string;
  path: string;
  status: 'applied' | 'unchanged' | 'rolled_back' | 'failed';
  error: string | null;
  rollback_of: string | null;
  note: string;
  actor_username: string | null;
  created_at: string;
  has_before: boolean;
  has_after: boolean;
}

export const notifyStatus = () => get<NotifyStatus>('nvr/notify');
export const setNotify = (body: { channels?: number[] | null; smart?: boolean; enabled?: boolean }) => put<NotifyResult>('nvr/notify', body);
export const listNvrChanges = (limit = 20) => get<{ changes: NvrChange[] }>(`nvr/changes?limit=${limit}`);
export const rollbackNvrChange = (id: string) => post<NvrChange>(`nvr/changes/${id}/rollback`);
