/** CR-024 (multi-NVR): the installation's recorders - list, add, rename / reorder / time zone / enable / disable, remove (the
 * cameras stay, disabled and hidden; history kept), each recorder's connection and a read-only health check. Management needs
 * `system.configure`; the list is readable by whoever may read the NVR configuration. Local channel only (never remote).
 * Every change waits for a restart (`restart_required`, `pending_restart`). The password is write-only. */
import { api, get, patch, post, put } from './client';
import type { ConnectionBody, NvrConnection } from './nvr-connection';
import type * as Wire from './generated/wire-recorders';
import { tr } from '../i18n/msg/api-video';

export const PRIMARY_RECORDER = 'nvr-1';

/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/recorders.py), generated into
 * ./generated/wire-recorders.ts: a field the server renames or drops is a compile error here (code review 07:F8 step 2). The connection
 * routes answer routers/nvr_connection.py's view / save / test - the same shapes as `/nvr/connection` (./nvr-connection.ts types those for
 * the installation-level route; the recorder routes are typed with the generated ones, and the shared form checks they still fit).
 * Kept optional on purpose: `primary_has_history` (absent on an older server). Narrowed on purpose: the connection's `extra` (the
 * vendor's stored options, scalars - the form's own type), `saved` / `restart_required: true` (a save that did not happen is an error, not an
 * answer; every save waits for a restart). */
type RecorderState = Wire.RecorderStatus['state'];
type RecorderConnection = Omit<Wire.RecorderConnection, 'extra'> & Pick<NvrConnection, 'extra'>;
type RecorderConnectionSaved = Omit<Wire.RecorderConnectionSaved, 'extra' | 'saved' | 'restart_required'> & Pick<NvrConnection, 'extra'> & { saved: true; restart_required: true };

export type Recorder = Wire.Recorder;

export type RecorderList = Omit<Wire.RecorderList, 'primary_has_history'> & {
  /** No recorder left and history under the first id: a new recorder gets a new id (the card shows the add form). */
  primary_has_history?: boolean;
};

export const enc = encodeURIComponent;

export const listRecorders = (includeRemoved = false) => get<RecorderList>(`recorders${includeRemoved ? '?include_removed=true' : ''}`);
export const addRecorder = (body: ConnectionBody & { name: string; save_untested?: boolean; confirm_text?: string }) =>
  post<Wire.RecorderAdded>('recorders', body);
export const updateRecorder = (id: string, body: { name?: string; enabled?: boolean; sort_order?: number; time_zone?: string }) =>
  patch<Wire.RecorderUpdated>(`recorders/${enc(id)}`, body);
type Removed = Wire.RecorderRemoved;
/** `DELETE` with a body (the typed word and the connection's revision). */
export const removeRecorder = (id: string, confirm_text: string, if_revision: number): Promise<Removed> =>
  api<Removed>(`recorders/${enc(id)}`, { method: 'DELETE', body: JSON.stringify({ confirm_text, if_revision }) });
export const recorderConnection = (id: string) => get<RecorderConnection>(`recorders/${enc(id)}/connection`);
export const testRecorderConnection = (id: string, body: ConnectionBody & { use_stored_password?: boolean }) =>
  post<Wire.RecorderProbe>(`recorders/${enc(id)}/connection/test`, body);
export const saveRecorderConnection = (id: string, body: ConnectionBody & { save_untested?: boolean; confirm_text?: string; if_revision: number }) =>
  put<RecorderConnectionSaved>(`recorders/${enc(id)}/connection`, body);
/** NVR-H264-BULK-2341: the per-recorder switch "אפשר שינויי הגדרות ב־NVR". Reading needs `system.configure`; changing it needs
 * `system.configure` AND `nvr.configure` (`can_change`). Turning it on needs `confirm: true` (the dialog); turning it off never does.
 * Applies at once (no restart); every change is audited. Local channel only. `supported` false: the vendor has no encoding writes through
 * Arx (Frigate, "no NVR") - the switch is not shown; `explicit` false = never switched (the vendor `default` applies). */
export type RecorderWrites = Wire.RecorderWrites;
export const recorderWrites = (id: string) => get<RecorderWrites>(`recorders/${enc(id)}/writes`);
export const setRecorderWrites = (id: string, enabled: boolean, confirm = false) =>
  patch<RecorderWrites>(`recorders/${enc(id)}/writes`, enabled ? { enabled, confirm } : { enabled });
export const recorderHealth = (id: string) => get<Wire.RecorderHealth>(`recorders/${enc(id)}/health`);

/** Operator wording of a recorder's state (one short word or phrase; no infrastructure names). */
export const STATE_TEXT: Record<RecorderState, string> = {
  online: tr('מחובר'),
  error: tr('לא מגיב'),
  unknown: tr('ממתין לבדיקה'),
  pending_restart: tr('ממתין להפעלה מחדש'),
  disabled: tr('מושבת'),
  removed: tr('הוסר'),
  not_configured: tr('לא מוגדר'),
  unreadable: tr('יש להזין סיסמה מחדש'),
  refused: tr('כתובת לא מותרת'),
};

/** A camera's name in a picker: with two or more recorders the recorder is named too (unless the name already carries it,
 * as a duplicate name across recorders does). */
export function cameraLabel(c: { name: string; recorder_name?: string | null }): string {
  return c.recorder_name && !c.name.includes(c.recorder_name) ? `${c.name} · ${c.recorder_name}` : c.name;
}

/** Synchronized playback is offered only within one recorder (CR-024 section 3): a camera of another recorder than the ones
 * already picked cannot join. */
export function sameRecorder(picked: string[], cams: { id: string; recorder_id: string }[], id: string, crossAllowed = false): boolean {
  if (crossAllowed) return true; // the experimental setting playback.cross_recorder_sync is on
  const first = cams.find((c) => c.id === picked[0]);
  const cam = cams.find((c) => c.id === id);
  return !first || !cam || first.recorder_id === cam.recorder_id;
}

