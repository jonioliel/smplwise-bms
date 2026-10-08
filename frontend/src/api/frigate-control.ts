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

export type WriteClass = 'analytics' | 'record' | 'profile' | 'review' | 'events' | 'ptz' | 'exports' | 'cases';
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
export type SupervisedKind = 'export_create' | 'export_rename' | 'export_delete' | 'case_create' | 'case_rename' | 'case_delete' | 'event_create' | 'event_end' | 'profile_auto' | 'clip_read';
export const SUPERVISED_KINDS: SupervisedKind[] = ['export_create', 'export_rename', 'export_delete', 'case_create', 'case_rename', 'case_delete', 'event_create', 'event_end', 'profile_auto', 'clip_read'];

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
  const order: WriteClass[] = ['analytics', 'record', 'profile', 'review', 'events', 'exports', 'cases', 'ptz'];
  return order.map((k) => p.classes.find((c) => c.class === k)).filter((c): c is PolicyClass => !!c && (c.class !== 'ptz' || c.available));
}

export const anyWriteOn = (p: ControlPolicy | null): boolean => !!p && p.classes.some((c) => c.enabled);
