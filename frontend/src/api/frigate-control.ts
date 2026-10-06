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
import { get, post, put } from './client';
import { he } from '../i18n/he';

export type WriteClass = 'analytics' | 'record' | 'profile' | 'review' | 'events' | 'ptz';
export type SwitchGroup = 'analytics' | 'record';

export interface PolicyClass {
  class: WriteClass;
  enabled: boolean;
  per_action: boolean;
  permission: string;
  /** false = the code does not offer it yet (PTZ until it is released) */
  available: boolean;
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
export const revertChange = (rid: string, id: string, confirm: boolean) => post<{ reverted: boolean; verified: boolean }>(`${base(rid)}/changes/${encodeURIComponent(id)}/revert`, { confirm });

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
  return c.target;
}

export const alarmText = (s: string): string => (he.frigate.control.alarm as Record<string, string>)[s] ?? s;

/** Classes in the order the settings list them; PTZ only when the code releases it. */
export function visibleClasses(p: ControlPolicy): PolicyClass[] {
  const order: WriteClass[] = ['analytics', 'record', 'profile', 'review', 'events', 'ptz'];
  return order.map((k) => p.classes.find((c) => c.class === k)).filter((c): c is PolicyClass => !!c && (c.class !== 'ptz' || c.available));
}

export const anyWriteOn = (p: ControlPolicy | null): boolean => !!p && p.classes.some((c) => c.enabled);
