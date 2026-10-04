/** CR-024 (multi-NVR): the installation's recorders - list, add, rename / reorder / time zone / enable / disable, remove (the
 * cameras stay, disabled and hidden; history kept), each recorder's connection and a read-only health check. Management needs
 * `system.configure`; the list is readable by whoever may read the NVR configuration. Local channel only (never remote).
 * Every change waits for a restart (`restart_required`, `pending_restart`). The password is write-only. */
import { api, get, patch, post, put } from './client';
import type { ConnectionBody, NvrConnection, SaveResult, TestResult } from './nvr-connection';

export const PRIMARY_RECORDER = 'nvr-1';

export type RecorderState = 'online' | 'error' | 'unknown' | 'pending_restart' | 'disabled' | 'removed' | 'not_configured' | 'unreadable' | 'refused';

export interface Recorder {
  id: string;
  primary: boolean;
  name: string;
  vendor: string;
  vendor_label: string;
  enabled: boolean;
  removed: boolean;
  removed_at: string | null;
  sort_order: number;
  time_zone: string | null;
  model: string | null;
  firmware: string | null;
  last_seen_at: string | null;
  cameras: number;
  cameras_enabled: number;
  status: { state: RecorderState; error: string | null; events_connected: boolean; discovery_last_ok: string | null };
  pending_restart: boolean;
  capabilities: Record<string, unknown>;
  /** system.configure holders only; never a password. */
  connection?: Pick<NvrConnection, 'vendor' | 'host' | 'http_port' | 'rtsp_port' | 'username' | 'has_password' | 'state' | 'revision' | 'updated_at' | 'vendor_locked'>;
}

export interface RecorderList {
  recorders: Recorder[];
  count: number;
  can_manage: boolean;
  restart: 'addon' | 'manual';
  pending_restart: boolean;
}

export const enc = encodeURIComponent;

export const listRecorders = (includeRemoved = false) => get<RecorderList>(`recorders${includeRemoved ? '?include_removed=true' : ''}`);
export const addRecorder = (body: ConnectionBody & { name: string; save_untested?: boolean; confirm_text?: string }) =>
  post<{ saved: true; restart_required: true; recorder_id: string; untested: boolean; device: SaveResult['device']; recorder: Recorder }>('recorders', body);
export const updateRecorder = (id: string, body: { name?: string; enabled?: boolean; sort_order?: number; time_zone?: string }) =>
  patch<{ saved: true; restart_required: boolean; recorder: Recorder }>(`recorders/${enc(id)}`, body);
type Removed = { removed: true; restart_required: true; recorder_id: string; revision: number; cameras_disabled: number };
/** `DELETE` with a body (the typed word and the connection's revision). */
export const removeRecorder = (id: string, confirm_text: string, if_revision: number): Promise<Removed> =>
  api<Removed>(`recorders/${enc(id)}`, { method: 'DELETE', body: JSON.stringify({ confirm_text, if_revision }) });
export const recorderConnection = (id: string) => get<NvrConnection>(`recorders/${enc(id)}/connection`);
export const testRecorderConnection = (id: string, body: ConnectionBody & { use_stored_password?: boolean }) =>
  post<TestResult>(`recorders/${enc(id)}/connection/test`, body);
export const saveRecorderConnection = (id: string, body: ConnectionBody & { save_untested?: boolean; confirm_text?: string; if_revision: number }) =>
  put<SaveResult>(`recorders/${enc(id)}/connection`, body);
export const recorderHealth = (id: string) => get<{ recorder_id: string; online: boolean; model: string | null; firmware: string | null; error: string | null }>(`recorders/${enc(id)}/health`);

/** Operator wording of a recorder's state (one short word or phrase; no infrastructure names). */
export const STATE_TEXT: Record<RecorderState, string> = {
  online: 'מחובר',
  error: 'לא מגיב',
  unknown: 'ממתין לבדיקה',
  pending_restart: 'ממתין להפעלה מחדש',
  disabled: 'מושבת',
  removed: 'הוסר',
  not_configured: 'לא מוגדר',
  unreadable: 'יש להזין סיסמה מחדש',
  refused: 'כתובת לא מותרת',
};

/** A camera's name in a picker: with two or more recorders the recorder is named too (unless the name already carries it,
 * as a duplicate name across recorders does). */
export function cameraLabel(c: { name: string; recorder_name?: string | null }): string {
  return c.recorder_name && !c.name.includes(c.recorder_name) ? `${c.name} · ${c.recorder_name}` : c.name;
}

/** Synchronized playback is offered only within one recorder (CR-024 section 3): a camera of another recorder than the ones
 * already picked cannot join. */
export function sameRecorder(picked: string[], cams: { id: string; recorder_id: string }[], id: string): boolean {
  const first = cams.find((c) => c.id === picked[0]);
  const cam = cams.find((c) => c.id === id);
  return !first || !cam || first.recorder_id === cam.recorder_id;
}

/** The recorders a camera list names (`GET /cameras` → `recorders`): a filter is shown only when there are two or more. */
export interface RecorderRef {
  id: string;
  name: string;
}
