/** NN5-F2: the Frigate control client - the only UI code that asks Arx to WRITE to a Frigate recorder. Server: `routers/frigate_control.py`
 *   GET  frigate/{rid}/control/policy                      which write classes are on (system.configure or any control permission to read)
 *   PUT  frigate/{rid}/control/policy {classes}            switch classes on / off (system.configure)
 *   GET  frigate/{rid}/cameras/{cid}/control               the camera's switches + which groups the caller may change now
 *   PUT  frigate/{rid}/cameras/{cid}/control/{feature} {value, confirm}
 *   GET  frigate/{rid}/profiles                            names, active, the alarm-state mapping, can_switch
 *   PUT  frigate/{rid}/profile {profile, confirm}          PUT frigate/{rid}/profile-rules {rules}
 *   GET  frigate/{rid}/events/{id}/control                 {writable, retain, sub_label} (retain / sub_label only when writable)
 *   POST frigate/{rid}/events/{id}/retain {retain}      POST frigate/{rid}/events/{id}/sub-label {sub_label}
 *   GET  frigate/{rid}/changes                             the change log;  POST frigate/{rid}/changes/{id}/revert {confirm}
 * Recording switches and the profile need `confirm: true` on every call (the server refuses with `confirmation_required` otherwise); the
 * screens ask first. Everything else is pure helpers so the unit tests pin the wording and the grouping. */
import { apiUrl, get, patch, post, put } from './client';
import { he } from '../i18n/he';

export type WriteClass = 'analytics' | 'record' | 'profile' | 'review' | 'events' | 'ptz' | 'exports' | 'cases' | 'config';
export type SwitchGroup = 'analytics' | 'record';

export interface PolicyClass {
  class: WriteClass;
  enabled: boolean;
  per_action: boolean;
  permission: string;
  /** false = the code does not offer it yet (PTZ until it is released) */
  available: boolean;
  /** F2b: the actions of the class that ask for a confirmation (exports / cases: `delete`); absent on an F2 server */
  confirm_actions?: string[];
  /** FRGS: the class writes Frigate's configuration file (survives a restart); absent on an older server */
  persists?: boolean;
}
export interface ControlPolicy {
  recorder_id: string;
  classes: PolicyClass[];
  ptz_released: boolean;
}
export interface ControlSwitch {
  feature: string;
  class: SwitchGroup;
  /** null = Frigate does not report it */
  value: boolean | null;
}
export interface CameraControl {
  recorder_id: string;
  camera_id: string;
  features: ControlSwitch[];
  /** the groups THIS caller may change now: permission on the camera AND the class switched on */
  writable: { analytics: boolean; record: boolean; ptz: boolean };
}
export interface ProfilesView {
  recorder_id: string;
  names: string[];
  active: string | null;
  rules: Record<string, string>;
  alarm_states: string[];
  can_switch: boolean;
}
export interface SwitchResult {
  changed: boolean;
  verified: boolean;
  value: boolean;
  change_id: string | null;
}
export interface ChangeRow {
  id: string;
  recorder_id: string;
  camera_id: string | null;
  camera_key: string | null;
  class: WriteClass;
  kind: string;
  target: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  status: 'applied' | 'unverified' | 'reverted' | 'failed';
  error: string | null;
  reversible: boolean;
  reverts_id: string | null;
  actor: string | null;
  at: string;
}

const base = (rid: string) => `frigate/${encodeURIComponent(rid)}`;

export const getPolicy = (rid: string) => get<ControlPolicy>(`${base(rid)}/control/policy`);
export const putPolicy = (rid: string, classes: Partial<Record<WriteClass, boolean>>) => put<{ recorder_id: string; policy: Record<string, boolean> }>(`${base(rid)}/control/policy`, { classes });
export const getCameraControl = (rid: string, cameraId: string) => get<CameraControl>(`${base(rid)}/cameras/${encodeURIComponent(cameraId)}/control`);
export const setSwitch = (rid: string, cameraId: string, feature: string, value: boolean, confirm: boolean) =>
  put<SwitchResult>(`${base(rid)}/cameras/${encodeURIComponent(cameraId)}/control/${encodeURIComponent(feature)}`, { value, confirm });
export const getProfiles = (rid: string) => get<ProfilesView>(`${base(rid)}/profiles`);
export const setProfile = (rid: string, profile: string | null, confirm: boolean) => put<{ changed: boolean; active: string | null; verified: boolean }>(`${base(rid)}/profile`, { profile, confirm });
export const putProfileRules = (rid: string, rules: Record<string, string | null>) => put<{ rules: Record<string, string> }>(`${base(rid)}/profile-rules`, { rules });
export const retainEvent = (rid: string, eventId: string, retain: boolean) => post<{ changed: boolean; verified: boolean }>(`${base(rid)}/events/${encodeURIComponent(eventId)}/retain`, { retain });
export interface EventControl {
  recorder_id: string;
  event_id: string;
  /** may THIS caller change the event now: permission on its camera AND the events class switched on */
  writable: boolean;
  retain?: boolean;
  sub_label?: string | null;
}
export const getEventControl = (rid: string, eventId: string) => get<EventControl>(`${base(rid)}/events/${encodeURIComponent(eventId)}/control`);
export const setSubLabel = (rid: string, eventId: string, subLabel: string | null) => post<{ changed: boolean; sub_label: string | null; verified: boolean }>(`${base(rid)}/events/${encodeURIComponent(eventId)}/sub-label`, { sub_label: subLabel });
export const getChanges = (rid: string, limit = 30) => get<{ recorder_id: string; changes: ChangeRow[] }>(`${base(rid)}/changes?limit=${limit}`);
/** `supervised` (F2b): the first undo of a new kind is a first write of that kind; a system administrator says they are watching it. */
export const revertChange = (rid: string, id: string, confirm: boolean, supervised = false) =>
  post<{ reverted: boolean; verified: boolean }>(`${base(rid)}/changes/${encodeURIComponent(id)}/revert`, supervised ? { confirm, supervised } : { confirm });

// ---- F2b (routers/frigate_f2b.py, CR-029 section 11): the first supervised write, the automatic profile, exports, cases, manual events, the clip ----

/** The kinds whose first write toward a recorder must be supervised once (`frigate_first_write`). */
export type SupervisedKind = 'export_create' | 'export_rename' | 'export_delete' | 'case_create' | 'case_rename' | 'case_delete' | 'event_create' | 'event_end' | 'profile_auto' | 'clip_read' | 'config_zone' | 'config_settings';
export const SUPERVISED_KINDS: SupervisedKind[] = ['export_create', 'export_rename', 'export_delete', 'case_create', 'case_rename', 'case_delete', 'event_create', 'event_end', 'profile_auto', 'clip_read', 'config_zone', 'config_settings'];

export interface FirstWrites {
  recorder_id: string;
  /** which kinds already had their supervised first write */
  done: Partial<Record<SupervisedKind, boolean>>;
  /** the caller holds system.configure: may send `supervised: true` */
  can_supervise: boolean;
}
export const getFirstWrites = (rid: string) => get<FirstWrites>(`${base(rid)}/control/first-writes`);

/** The server refuses the first write of a kind without `supervised: true` from a system administrator. */
export const FIRST_WRITE_CODE = 'frigate_first_write_unsupervised';
export const isFirstWriteRefusal = (e: unknown): boolean => !!e && typeof e === 'object' && (e as { body?: { code?: string } }).body?.code === FIRST_WRITE_CODE;

export type AutoMode = 'off' | 'suggest' | 'apply';
export const AUTO_MODES: AutoMode[] = ['off', 'suggest', 'apply'];
export interface AutoSetting {
  recorder_id: string;
  mode: AutoMode;
  auto_apply_consent: boolean;
  consent_by: string | null;
  consent_at: string | null;
  profile_class_on: boolean;
  first_write_done: boolean;
  /** the four conditions hold: an alarm change will switch the profile by itself */
  will_apply: boolean;
}
export type AutoStatus = 'pending' | 'suggested' | 'applied' | 'unverified' | 'skipped' | 'failed' | 'expired' | 'dismissed' | 'superseded';
export interface AutoItem {
  id: string;
  alarm_state: string;
  /** the mapped profile; `none` switches the profile off */
  profile: string;
  mode: AutoMode;
  status: AutoStatus;
  /** why an `apply` mode did not switch: class_off | no_consent | first_write_unsupervised | already_active | by_user | mode_off ... */
  reason: string | null;
  change_id: string | null;
  at: string;
  processed_at: string | null;
}
export interface AutoView {
  recorder_id: string;
  setting: AutoSetting;
  items: AutoItem[];
  modes: AutoMode[];
}
export const getProfileAuto = (rid: string) => get<AutoView>(`${base(rid)}/profile-auto`);
export const putProfileAuto = (rid: string, body: { mode?: AutoMode; auto_apply_consent?: boolean }) => put<{ recorder_id: string; setting: AutoSetting }>(`${base(rid)}/profile-auto/setting`, body);
export const applyAutoSuggestion = (rid: string, id: string, supervised: boolean) =>
  post<{ id: string; status: AutoStatus; changed: boolean; verified: boolean }>(`${base(rid)}/profile-auto/${encodeURIComponent(id)}/apply`, { confirm: true, supervised });
export const dismissAutoSuggestion = (rid: string, id: string) => post<{ id: string; status: 'dismissed' }>(`${base(rid)}/profile-auto/${encodeURIComponent(id)}/dismiss`, undefined);

/** One of Frigate's exports as Arx shows it (file paths and thumbnails never leave the server). */
export interface FrigateExport {
  id: string;
  /** Frigate's camera name */
  camera: string | null;
  /** Arx's camera id (the list is filtered to the cameras the caller may export) */
  camera_id: string;
  name: string;
  /** epoch seconds of the export, when Frigate reports it */
  date: number | null;
  in_progress: boolean;
  case_id: string | null;
  /** Arx created it: rename and delete are offered (anything else is refused by the server) */
  arx_created: boolean;
}
export interface FrigateCase {
  id: string;
  name: string;
  description: string;
  created_at: number | null;
  arx_created: boolean;
}
export const getExports = (rid: string) => get<{ recorder_id: string; exports: FrigateExport[]; enabled: boolean }>(`${base(rid)}/exports`);
export const createExport = (rid: string, body: { camera_id: string; start: number; end: number; name: string; supervised?: boolean }) =>
  post<{ created: boolean; export_id: string | null; verified: boolean; change_id: string | null }>(`${base(rid)}/exports`, body);
export const renameExport = (rid: string, id: string, name: string, supervised = false) =>
  patch<{ changed: boolean; export_id: string; name: string; verified: boolean }>(`${base(rid)}/exports/${encodeURIComponent(id)}`, supervised ? { name, supervised } : { name });
export const deleteExport = (rid: string, id: string, supervised = false) =>
  post<{ deleted: boolean; export_id: string; verified: boolean }>(`${base(rid)}/exports/${encodeURIComponent(id)}/delete`, { confirm: true, ...(supervised ? { supervised } : {}) });
export const getCases = (rid: string) => get<{ recorder_id: string; cases: FrigateCase[]; enabled: boolean }>(`${base(rid)}/cases`);
export const createCase = (rid: string, body: { name: string; description?: string | null; supervised?: boolean }) =>
  post<{ created: boolean; case_id: string | null; verified: boolean; change_id: string | null }>(`${base(rid)}/cases`, body);
export const renameCase = (rid: string, id: string, name: string, supervised = false) =>
  patch<{ changed: boolean; case_id: string; name: string; verified: boolean }>(`${base(rid)}/cases/${encodeURIComponent(id)}`, supervised ? { name, supervised } : { name });
export const deleteCase = (rid: string, id: string, supervised = false) =>
  post<{ deleted: boolean; case_id: string; verified: boolean }>(`${base(rid)}/cases/${encodeURIComponent(id)}/delete`, { confirm: true, ...(supervised ? { supervised } : {}) });

/** A manual event: a label; a duration of 1..600 s, or null = open until it is ended. */
export const createManualEvent = (rid: string, cameraId: string, body: { label: string; duration_s: number | null; sub_label?: string | null; supervised?: boolean }) =>
  post<{ created: boolean; event_id: string | null; open: boolean; verified: boolean; change_id: string | null }>(`${base(rid)}/cameras/${encodeURIComponent(cameraId)}/events/manual`, body);
export const endManualEvent = (rid: string, eventId: string, supervised = false) =>
  post<{ ended: boolean; event_id: string; verified: boolean }>(`${base(rid)}/events/${encodeURIComponent(eventId)}/end`, supervised ? { supervised } : {});

/** The longest manual event (seconds) and the longest clip window / export range the server accepts. */
export const EVENT_MAX_S = 600;
export const CLIP_MAX_S = 3600;
export const EXPORT_MAX_S = 7200;

/** The address of the clip Arx streams for a camera window (GET only, `video.playback`; `supervised` for the first read of a recorder). */
export const clipUrl = (rid: string, cameraId: string, start: number, end: number, supervised = false): string =>
  apiUrl(`${base(rid)}/cameras/${encodeURIComponent(cameraId)}/clip.mp4?start=${start}&end=${end}${supervised ? '&supervised=true' : ''}`);
export const eventClipUrl = (rid: string, eventId: string, supervised = false): string => apiUrl(`${base(rid)}/events/${encodeURIComponent(eventId)}/clip.mp4${supervised ? '?supervised=true' : ''}`);

/** The open manual events Arx created, read from the change log: an `event_create` row that is still reversible (the undo ends it). */
export function openManualEvents(changes: readonly ChangeRow[]): { id: string; camera_id: string | null; label: string; sub_label: string | null; at: string; actor: string | null; status: ChangeRow['status'] }[] {
  const ended = new Set(changes.filter((c) => c.kind === 'event_end' && c.status !== 'failed').map((c) => c.target));
  return changes
    .filter((c) => c.kind === 'event_create' && c.reversible && (c.status === 'applied' || c.status === 'unverified') && !ended.has(c.target))
    .map((c) => {
      const a = (c.after ?? {}) as { label?: string; sub_label?: string | null };
      return { id: c.target, camera_id: c.camera_id, label: a.label ?? c.target, sub_label: a.sub_label ?? null, at: c.at, actor: c.actor, status: c.status };
    });
}

/** The time range of an export form: seconds, both present, start before end, at most EXPORT_MAX_S, not in the future (one minute of slack). */
export function exportRangeError(start: number | null, end: number | null, nowS: number = Date.now() / 1000): 'missing' | 'order' | 'long' | 'future' | null {
  if (start == null || end == null || !Number.isFinite(start) || !Number.isFinite(end)) return 'missing';
  if (end <= start) return 'order';
  if (end - start > EXPORT_MAX_S) return 'long';
  if (end > nowS + 60) return 'future';
  return null;
}

/** A typed confirmation matches when the person typed the object's name (trimmed, case kept). */
export const typedMatches = (typed: string, name: string): boolean => typed.trim() !== '' && typed.trim() === name.trim();

/** The recorders whose vendor is Frigate (ids only), read once per page load: the camera drawer asks it to know whether a camera is one of them. */
let frigateIds: Promise<Set<string>> | null = null;
export function frigateRecorderIds(): Promise<Set<string>> {
  frigateIds ??= get<{ recorders: { id: string }[] }>('frigate/recorders').then((r) => new Set(r.recorders.map((x) => x.id))).catch(() => new Set<string>());
  return frigateIds;
}
export function resetFrigateRecorderIds(): void {
  frigateIds = null;
}

// ---- pure helpers ----

/** The switches in screen order (what the operator sees). `ptz_autotracker` and `birdseye` are the least used: last. */
export const SWITCH_ORDER: Record<SwitchGroup, string[]> = {
  analytics: ['detect', 'motion', 'audio', 'review_alerts', 'review_detections', 'notifications', 'improve_contrast', 'birdseye', 'ptz_autotracker'],
  record: ['enabled', 'recordings', 'snapshots'],
};

export const featureText = (f: string): string => (he.frigate.control.feature as Record<string, string>)[f] ?? f;

/** The switches of one group that Frigate reports, in screen order. A switch Frigate does not report (null) is not drawn. */
export function groupSwitches(c: CameraControl, group: SwitchGroup): ControlSwitch[] {
  const by = new Map(c.features.filter((f) => f.class === group && f.value !== null).map((f) => [f.feature, f]));
  return SWITCH_ORDER[group].map((k) => by.get(k)).filter((x): x is ControlSwitch => !!x);
}

/** Does the person need to confirm this change? Every recording-affecting switch does; so does the profile (the server enforces both). */
export const needsConfirm = (group: SwitchGroup): boolean => group === 'record';

/** The confirmation text for one switch change: only turning recording OFF carries the warning. */
export function confirmCopy(group: SwitchGroup, feature: string, to: boolean): { title: string; text: string } {
  const c = he.frigate.control;
  if (group === 'record' && !to) return { title: feature === 'recordings' ? c.confirmTitleOff : `${featureText(feature)}: ${c.confirmTitleOffShort}`, text: c.confirmRecordOff };
  return { title: `${featureText(feature)}: ${c.confirmTitleOn}`, text: '' };
}

/** The change-log line: "כבוי · זיהוי אובייקטים" / "פרופיל: Away". */
export function changeLine(c: ChangeRow): string {
  const t = he.frigate.control;
  if (c.kind === 'feature') return `${featureText(c.target)}: ${(c.after as { value?: boolean } | null)?.value ? he.frigate.summary.on : he.frigate.summary.off}`;
  if (c.kind === 'profile') return `${t.profile}: ${(c.after as { profile?: string | null } | null)?.profile || t.noProfile}`;
  if (c.kind === 'event_retain') return `${t.retain}: ${(c.after as { retain?: boolean } | null)?.retain ? he.frigate.summary.on : he.frigate.summary.off}`;
  if (c.kind === 'event_sub_label') return `${(c.after as { sub_label?: string | null } | null)?.sub_label ?? ''}`;
  // FRGS: "אזור: driveway" / "הגדרות מצלמה: תנועה"
  if (c.kind === 'config_settings') return `${t.settings.kinds.config_settings}: ${(t.settings.config.sections as Record<string, string>)[c.target] ?? c.target}`;
  if (c.kind === 'config_zone') return `${t.settings.kinds.config_zone}${c.after === null ? ` (${t.settings.config.removed})` : ''}: ${c.target}`;
  // F2b kinds: "ייצוא נוצר: <name>" / "תיק שונה: <name>" / "אירוע ידני: <label>"
  const k = t.settings.kinds as Record<string, string>;
  if (k[c.kind]) {
    const after = (c.after ?? {}) as { name?: string; label?: string };
    const before = (c.before ?? {}) as { name?: string };
    const name = after.name ?? after.label ?? before.name ?? c.target;
    return `${k[c.kind]}: ${name}`;
  }
  return c.target;
}

export const alarmText = (s: string): string => (he.frigate.control.alarm as Record<string, string>)[s] ?? s;

/** Classes in the order the settings list them; PTZ only when the code releases it. */
export function visibleClasses(p: ControlPolicy): PolicyClass[] {
  const order: WriteClass[] = ['analytics', 'record', 'profile', 'review', 'events', 'exports', 'cases', 'config', 'ptz'];
  return order.map((k) => p.classes.find((c) => c.class === k)).filter((c): c is PolicyClass => !!c && (c.class !== 'ptz' || c.available));
}

export const anyWriteOn = (p: ControlPolicy | null): boolean => !!p && p.classes.some((c) => c.enabled);

// ---- FRGS (routers/frigate_config.py, CR-029 section 13): the config schema, zones and the curated camera settings ----

export type ConfigFieldType = 'int' | 'number' | 'labels' | 'polygon';
export interface ConfigField {
  key: string;
  type: ConfigFieldType;
  section?: string;
  min?: number;
  max?: number;
  step?: number;
  default?: number | string[] | null;
  unit?: string;
  min_points?: number;
  max_points?: number;
}
export interface ConfigSchema {
  recorder_id: string;
  version: string;
  sections: string[];
  settings: ConfigField[];
  zone: { fields: ConfigField[]; name_pattern: string; max_zones: number };
  labels: string[];
  persists: boolean;
  /** only with `verify=true`: our fields the instance's own schema does not know */
  frigate_check: { checked: boolean; missing: string[] } | null;
}
/** A point in relative frame coordinates: x right, y down, 0..1 (never mirrored by RTL). */
export type Pt = [number, number];
export interface ConfigZone {
  name: string;
  /** null = Frigate keeps it in a shape Arx does not edit (shown read-only) */
  points: Pt[] | null;
  editable: boolean;
  objects: string[];
  inertia: number | null;
  loitering_time: number | null;
}
export type SettingValue = number | string[] | null;
export interface CameraConfigView {
  recorder_id: string;
  camera_id: string;
  camera_key: string;
  frame: { width: number | null; height: number | null };
  zones: ConfigZone[];
  settings: Record<string, SettingValue>;
  /** THIS caller may change it now: system.configure on the camera AND the `config` class on */
  writable: boolean;
  first_write_done: { config_zone: boolean; config_settings: boolean };
  can_supervise: boolean;
}
export interface ZoneBody {
  points: Pt[];
  objects: string[];
  inertia: number | null;
  loitering_time: number | null;
}
const camBase = (rid: string, cid: string) => `${base(rid)}/cameras/${encodeURIComponent(cid)}/config`;
export const getConfigSchema = (rid: string) => get<ConfigSchema>(`${base(rid)}/config/schema`);
export const getCameraConfig = (rid: string, cid: string) => get<CameraConfigView>(camBase(rid, cid));
export const putZone = (rid: string, cid: string, name: string, body: ZoneBody, supervised = false) =>
  put<{ changed: boolean; verified: boolean; zone: ConfigZone; change_id: string | null }>(`${camBase(rid, cid)}/zones/${encodeURIComponent(name)}`, { ...body, confirm: true, ...(supervised ? { supervised } : {}) });
export const deleteZone = (rid: string, cid: string, name: string, supervised = false) =>
  post<{ deleted: boolean; verified: boolean; change_id: string | null }>(`${camBase(rid, cid)}/zones/${encodeURIComponent(name)}/delete`, { confirm: true, ...(supervised ? { supervised } : {}) });
export const putSettings = (rid: string, cid: string, section: string, values: Record<string, SettingValue>, supervised = false) =>
  put<{ changed: boolean; verified: boolean; settings: Record<string, SettingValue>; change_id: string | null }>(`${camBase(rid, cid)}/settings/${encodeURIComponent(section)}`, { values, confirm: true, ...(supervised ? { supervised } : {}) });
/** The Frigate still of a camera (the existing read route; `h` is clamped by the server). */
export const frigateStillUrl = (rid: string, cid: string, h = 720): string => apiUrl(`${base(rid)}/cameras/${encodeURIComponent(cid)}/snapshot?h=${h}`);

/** A zone name Frigate accepts: lower-case latin letters, digits and underscore, 1..40, and not the camera's own key. */
export function zoneNameError(name: string, cameraKey: string, existing: readonly string[]): 'pattern' | 'camera' | 'taken' | null {
  if (!/^[a-z0-9_]{1,40}$/.test(name)) return 'pattern';
  if (name === cameraKey) return 'camera';
  if (existing.includes(name)) return 'taken';
  return null;
}

/** The area of a polygon (relative units); ~0 = a line, which the server refuses. */
export function polygonArea(pts: readonly Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** The polygon the editor may save: 3..40 points inside the frame, no repeated point, a real area (the server's rules). */
export function polygonError(pts: readonly Pt[]): 'few' | 'many' | 'outside' | 'repeat' | 'flat' | null {
  if (pts.length < 3) return 'few';
  if (pts.length > 40) return 'many';
  if (pts.some(([x, y]) => !(x >= 0 && x <= 1 && y >= 0 && y <= 1))) return 'outside';
  if (new Set(pts.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`)).size !== pts.length) return 'repeat';
  if (polygonArea(pts) < 1e-4) return 'flat';
  return null;
}

/** A pointer position over the stage -> a relative point (clamped, 4 decimals). The stage is LTR and never mirrored. */
export function toRelative(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): Pt {
  const r = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;
  return [r((clientX - rect.left) / rect.width), r((clientY - rect.top) / rect.height)];
}

/** One settings value from an input: '' = back to Frigate's default (null); not a number or out of range = 'range'. */
export function parseSetting(field: ConfigField, raw: string): { value: SettingValue } | { error: 'range' } {
  const v = raw.trim();
  if (v === '') return { value: null };
  const n = Number(v);
  if (!Number.isFinite(n)) return { error: 'range' };
  if (field.type === 'int' && !Number.isInteger(n)) return { error: 'range' };
  if ((field.min != null && n < field.min) || (field.max != null && n > field.max)) return { error: 'range' };
  return { value: n };
}

/** Do two values of one setting mean the same state? null (unset) equals the documented default (the server's rule). */
export function sameSetting(field: ConfigField, a: SettingValue | undefined, b: SettingValue | undefined): boolean {
  const d = (field.default ?? null) as SettingValue;
  const x = a ?? d;
  const y = b ?? d;
  if (Array.isArray(x) && Array.isArray(y)) return [...x].sort().join(',') === [...y].sort().join(',');
  return x === y;
}
