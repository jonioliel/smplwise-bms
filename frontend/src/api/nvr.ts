/** Owner-approved NVR writes (0.1.64): "Notify Surveillance Center" per channel and the change log with rollback.
 * Reading needs system.configure; writing needs the sensitive permission `nvr.config.events` (custom role). */
import { get, path, post, put } from './client';

interface NotifyType { supported: boolean; center: boolean | null }
interface NotifyChannel {
  camera_id: string;
  channel: number;
  name: string;
  motion: NotifyType;
  smart: Record<string, NotifyType>;
  smart_supported: number;
  smart_center: number;
}
export interface NotifyStatus { channels: NotifyChannel[]; permission: string; can_write: boolean; labels: Record<string, string> }
interface NotifyResult { results: { channel: number; type: string; status: string; reason?: string; change_id?: string }[]; applied: number; unchanged: number; skipped: number; failed: number }
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
export const rollbackNvrChange = (id: string) => post<NvrChange>(path`nvr/changes/${id}/rollback`);
/** A1: manual recording started from the VMS (the NVR keeps no readable state; the VMS stops it on time). */
interface ManualRecording { id: string; camera_id: string; track_id: number; started_at: string; stop_at: string; stopped_at: string | null; stop_reason: string | null; remaining_s: number }
export interface RecordStatus { camera_id: string; active: ManualRecording | null; can_write: boolean; max_minutes: number; track_id: number | null }
export const recordStatus = (cameraId: string) => get<RecordStatus>(path`cameras/${cameraId}/record`);
export const recordStart = (cameraId: string, minutes: number) => post<ManualRecording>(path`cameras/${cameraId}/record/start`, { minutes });
export const recordStop = (cameraId: string) => post<ManualRecording>(path`cameras/${cameraId}/record/stop`);

/** B2: the camera's motion grid / sensitivity / enabled flag written to the NVR as one reversible change. */
export const setMotion = (cameraId: string, body: { cells?: boolean[][]; sensitivity?: number; enabled?: boolean }) => put<NvrChange>(path`cameras/${cameraId}/motion`, body);

// ---- 0.1.71: system (clock / NTP, disks, alarm outputs, reboot), connection, OSD ----
interface NvrTime { mode: string | null; local_time: string | null; time_zone: string | null; windows_zone: string | null; drift_s: number | null; ntp: { host: string | null; port: number; interval_min: number } | null }
interface NvrSmart { temperature_c: number | null; power_on_days: number | null; self_eval: string | null; all_eval: string | null; test_percent: number; test_status: string | null; test_type: string | null }
interface NvrDisk { id: number; name: string; type: string; status: string; capacity_mb: number; free_mb: number; property: string; smart: NvrSmart | null }
interface NvrOutput { id: number; name: string; use_type: string; enabled: boolean; io_type: string; pulse_ms: number | null; default_state: string; pulse_supported: boolean }
export interface NvrSystem { time: NvrTime | null; disks: NvrDisk[]; outputs: NvrOutput[]; errors: Record<string, string>; can: Record<'time' | 'storage' | 'alarm' | 'reboot' | 'osd' | 'connection', boolean>; writes_enabled?: boolean;
  /** TKFRIGLIVE: false for a recorder that is not Hikvision (no request reached it; `reason: not_supported_for_recorder`). */
  supported?: boolean; reason?: string; vendor?: string | null }
export const nvrSystem = () => get<NvrSystem>('nvr/system');
export const setNvrTime = (body: { sync_now?: boolean; mode?: 'NTP' | 'manual' }) => put<NvrChange>('nvr/time', body);
export const setNvrNtp = (body: { host: string; port?: number; interval_min?: number | null }) => put<NvrChange>('nvr/ntp', body);
export const pulseNvrOutput = (id: number) => post<NvrChange>(path`nvr/outputs/${id}/pulse`);
export const startSmartTest = (hddId: number, kind: 'short' | 'extended' = 'short') => post<NvrChange>(path`nvr/storage/${hddId}/smart-test`, { kind });
export const rebootNvr = (confirm: string) => post<NvrChange>('nvr/reboot', { confirm });
/** CR-024 (multi-NVR): the system actions of one recorder (`?recorder_id=`; the first recorder when omitted - the routes' default). */
export function nvrSystemApi(recorderId?: string) {
  const q = recorderId && recorderId !== 'nvr-1' ? `?recorder_id=${encodeURIComponent(recorderId)}` : '';
  return {
    nvrSystem: () => get<NvrSystem>(`nvr/system${q}`),
    setNvrTime: (body: { sync_now?: boolean; mode?: 'NTP' | 'manual' }) => put<NvrChange>(`nvr/time${q}`, body),
    setNvrNtp: (body: { host: string; port?: number; interval_min?: number | null }) => put<NvrChange>(`nvr/ntp${q}`, body),
    pulseNvrOutput: (id: number) => post<NvrChange>(path`nvr/outputs/${id}/pulse` + q),
    startSmartTest: (hddId: number, kind: 'short' | 'extended' = 'short') => post<NvrChange>(path`nvr/storage/${hddId}/smart-test` + q, { kind }),
    rebootNvr: (confirm: string) => post<NvrChange>(`nvr/reboot${q}`, { confirm }),
  };
}
// the NVR connection (vendor, host, ports, user, write-only password) moved to ./nvr-connection.ts (CR-022)
export interface OsdStatus {
  camera_id: string; channel: number; vms_name: string; nvr_name: string | null; can_write: boolean; date_styles: string[];
  screen: { width: number; height: number };
  channel_name: { enabled: boolean; x: number; y: number } | null;
  datetime: { enabled: boolean; x: number; y: number; date_style: string | null; time_style: string | null; display_week: boolean } | null;
}
export const osdStatus = (cameraId: string) => get<OsdStatus>(path`cameras/${cameraId}/osd`);
export const setOsd = (cameraId: string, body: { name_enabled?: boolean; datetime_enabled?: boolean; date_style?: string; time_style?: string; display_week?: boolean }) => put<NvrChange>(path`cameras/${cameraId}/osd`, body);
// ---- 0.1.72: schedules (B5, C1) and smart rules (B4) ----
export interface WeekRange { begin: string; end: string; mode?: string }
export type ArmingKind = 'motion' | 'line' | 'field';
export interface CameraSchedules {
  camera_id: string; channel: number; track_id: number;
  arming: Partial<Record<ArmingKind, WeekRange[][]>>;
  record: { enabled: boolean; schedule_enabled: boolean | null; default_mode: string | null; pre_record_s: number | null; post_record_s: number | null; days: WeekRange[][] } | null;
  unsupported: Record<string, string>;
  can: { events: boolean; schedule: boolean };
  modes: string[];
}
export const cameraSchedules = (cameraId: string) => get<CameraSchedules>(path`cameras/${cameraId}/schedules`);
export const setArming = (cameraId: string, kind: ArmingKind, days: WeekRange[][]) => put<NvrChange>(path`cameras/${cameraId}/schedules/${kind}`, { days });
export const setRecordSchedule = (cameraId: string, body: { days?: WeekRange[][]; enabled?: boolean; schedule_enabled?: boolean }) => put<NvrChange>(path`cameras/${cameraId}/record-schedule`, body);
interface SmartLine { id: number; enabled: boolean; sensitivity: number; direction: string; points: number[][]; human: boolean; vehicle: boolean }
interface SmartRegion { id: number; sensitivity: number; points: number[][]; human: boolean; vehicle: boolean }
export interface CameraSmart { camera_id: string; channel: number; can_write: boolean; line: { enabled: boolean; lines: SmartLine[] } | null; field: { enabled: boolean; regions: SmartRegion[] } | null }
export const cameraSmart = (cameraId: string) => get<CameraSmart>(path`cameras/${cameraId}/smart`);
export const setSmart = (cameraId: string, body: { line?: { enabled?: boolean; lines?: Partial<SmartLine>[] }; field?: { enabled?: boolean; regions?: Partial<SmartRegion>[] } }) => put<Record<string, NvrChange & { enable_refused?: boolean }>>(path`cameras/${cameraId}/smart`, body);
export const writeChannelName = (cameraId: string, name?: string) => post<NvrChange & { name: string }>(path`cameras/${cameraId}/osd/name`, name ? { name } : {});

// ---- CAMERA-REBOOT-2407: reboot ONE camera through its NVR channel (sensitive permission, NVR-writes switch, confirmation) ----
/** Why the action is not available now: the recorder type has none / the permission is missing / NVR changes are off / it just ran. */
type CameraRebootReason = 'not_supported' | 'no_permission' | 'writes_off' | 'cooldown';
export interface CameraRebootState {
  camera_id: string; supported: boolean; permitted: boolean; writes_enabled: boolean; can_reboot: boolean;
  reason: CameraRebootReason | null; cooldown_s: number; recorder_id: string;
}
export const cameraRebootState = (cameraId: string) => get<CameraRebootState>(`cameras/${encodeURIComponent(cameraId)}/reboot`);
export const rebootCamera = (cameraId: string) => post<NvrChange & { camera_id: string; cooldown_s: number }>(`cameras/${encodeURIComponent(cameraId)}/reboot`, { confirm: true });
