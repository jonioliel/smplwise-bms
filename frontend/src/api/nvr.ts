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
/** A1: manual recording started from the VMS (the NVR keeps no readable state; the VMS stops it on time). */
export interface ManualRecording { id: string; camera_id: string; track_id: number; started_at: string; stop_at: string; stopped_at: string | null; stop_reason: string | null; remaining_s: number }
export interface RecordStatus { camera_id: string; active: ManualRecording | null; can_write: boolean; max_minutes: number; track_id: number | null }
export const recordStatus = (cameraId: string) => get<RecordStatus>(`cameras/${cameraId}/record`);
export const recordStart = (cameraId: string, minutes: number) => post<ManualRecording>(`cameras/${cameraId}/record/start`, { minutes });
export const recordStop = (cameraId: string) => post<ManualRecording>(`cameras/${cameraId}/record/stop`);

/** B2: the camera's motion grid / sensitivity / enabled flag written to the NVR as one reversible change. */
export const setMotion = (cameraId: string, body: { cells?: boolean[][]; sensitivity?: number; enabled?: boolean }) => put<NvrChange>(`cameras/${cameraId}/motion`, body);

// ---- 0.1.71: system (clock / NTP, disks, alarm outputs, reboot), connection, OSD ----
export interface NvrTime { mode: string | null; local_time: string | null; time_zone: string | null; windows_zone: string | null; drift_s: number | null; ntp: { host: string | null; port: number; interval_min: number } | null }
export interface NvrSmart { temperature_c: number | null; power_on_days: number | null; self_eval: string | null; all_eval: string | null; test_percent: number; test_status: string | null; test_type: string | null }
export interface NvrDisk { id: number; name: string; type: string; status: string; capacity_mb: number; free_mb: number; property: string; smart: NvrSmart | null }
export interface NvrOutput { id: number; name: string; use_type: string; enabled: boolean; io_type: string; pulse_ms: number | null; default_state: string; pulse_supported: boolean }
export interface NvrSystem { time: NvrTime | null; disks: NvrDisk[]; outputs: NvrOutput[]; errors: Record<string, string>; can: Record<'time' | 'storage' | 'alarm' | 'reboot' | 'osd' | 'connection', boolean> }
export const nvrSystem = () => get<NvrSystem>('nvr/system');
export const setNvrTime = (body: { sync_now?: boolean; mode?: 'NTP' | 'manual' }) => put<NvrChange>('nvr/time', body);
export const setNvrNtp = (body: { host: string; port?: number; interval_min?: number | null }) => put<NvrChange>('nvr/ntp', body);
export const pulseNvrOutput = (id: number) => post<NvrChange>(`nvr/outputs/${id}/pulse`);
export const startSmartTest = (hddId: number, kind: 'short' | 'extended' = 'short') => post<NvrChange>(`nvr/storage/${hddId}/smart-test`, { kind });
export const rebootNvr = (confirm: string) => post<NvrChange>('nvr/reboot', { confirm });
export interface NvrConnection { host: string | null; http_port: number; rtsp_port: number; user: string | null; has_password: boolean; in_addon: boolean }
export const nvrConnection = () => get<NvrConnection>('nvr/connection');
export const setNvrConnection = (body: { host: string; http_port: number; rtsp_port: number; user: string; password?: string }) =>
  put<NvrConnection & { saved: 'supervisor' | 'file'; device: { model: string; firmware: string }; restarting: boolean }>('nvr/connection', body);
export interface OsdStatus {
  camera_id: string; channel: number; vms_name: string; nvr_name: string | null; can_write: boolean; date_styles: string[];
  screen: { width: number; height: number };
  channel_name: { enabled: boolean; x: number; y: number } | null;
  datetime: { enabled: boolean; x: number; y: number; date_style: string | null; time_style: string | null; display_week: boolean } | null;
}
export const osdStatus = (cameraId: string) => get<OsdStatus>(`cameras/${cameraId}/osd`);
export const setOsd = (cameraId: string, body: { name_enabled?: boolean; datetime_enabled?: boolean; date_style?: string; time_style?: string; display_week?: boolean }) => put<NvrChange>(`cameras/${cameraId}/osd`, body);
export const writeChannelName = (cameraId: string, name?: string) => post<NvrChange & { name: string }>(`cameras/${cameraId}/osd/name`, name ? { name } : {});
