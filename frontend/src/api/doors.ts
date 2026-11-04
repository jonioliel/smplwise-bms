/**
 * WisKey door administration (CR-033 wave 1): the "פתיחת דלתות" grant card (Settings › הרשאות), the station placement and
 * door map cards (Settings › הגדרת מערכת, next to the WisKey station cameras) and the trusted-path flag. Settings only:
 * operator screens show nothing new (the open button simply follows the server's answer).
 */
import { del, get, post, put } from './client';

/** One user or group row of the grant card. `granted`: this card's door_opener binding exists; `other`: other bindings
 * that also let them open (read-only, "שיוך אחר"). */
export interface DoorGrantSubject {
  kind: 'user' | 'group';
  id: string;
  name: string;
  active: boolean;
  granted: boolean;
  other: { binding_id: string; role_name: string; scope_name: string }[];
}

/** One role row: custom roles are switchable (`editable`), built-in roles read-only with their effective answer. */
export interface DoorGrantRole {
  id: string;
  name: string;
  custom: boolean;
  includes: boolean;
  editable: boolean;
  /** built-in only: `yes` (holds it), `per_user` (grant to people separately), `never` (viewer / kiosk) */
  answer?: 'yes' | 'per_user' | 'never';
  delegable?: boolean;
  revision?: number;
}

export interface DoorGrants {
  users: DoorGrantSubject[];
  groups: DoorGrantSubject[];
  roles: DoorGrantRole[];
  can_manage_roles: boolean;
  can_manage_subjects: boolean;
  delegated: boolean;
  /** UNLOCK-REASON-2370: intercom doors with no working door mapping (counts only; `with_suggestion` = a clear one-to-one suggestion waits). */
  unmapped_doors?: { count: number; with_suggestion: number };
}

export const getDoorGrants = () => get<DoorGrants>('access/door-grants');
export const switchDoorSubject = (kind: 'user' | 'group', id: string, enabled: boolean) =>
  post<{ granted: boolean }>('access/door-grants/subjects', { subject_kind: kind, subject_id: id, enabled, confirmed: true });
export const switchDoorRole = (roleId: string, enabled: boolean, revision: number) =>
  put<{ includes: boolean; revision: number }>(`access/door-grants/roles/${encodeURIComponent(roleId)}`, { enabled, revision, confirmed: true });

export interface DoorMapStation {
  id: string;
  name: string;
  online: boolean;
  relays: { physical_index: number; name: string | null }[];
  placement: { site_id: string | null; building_id: string | null } | null;
}

export interface DoorMapLock {
  entity_id: string;
  name: string;
  removed: boolean;
  disabled: boolean;
  /** the station the lock's own registry entry names, when the WisKey copy lists it */
  station_id: string | null;
  mapping: { station_id: string; station_name: string | null; relay: number; source: 'wiskey_explicit' | 'single_relay' | 'manual'; mapped_at: string; valid: boolean; problem: string | null } | null;
  suggestion: { station_id: string; relay: number } | null;
}

export interface DoorMap {
  state: string;
  has_copy: boolean;
  stations: DoorMapStation[];
  locks: DoorMapLock[];
  sites: { id: string; name: string }[];
  buildings: { id: string; site_id: string; name: string }[];
}

export const getDoorMap = () => get<DoorMap>('intercom/door-map');
export const setDoorMapping = (entityId: string, stationId: string, relay: number) =>
  put<unknown>(`intercom/door-map/${encodeURIComponent(entityId)}`, { station_id: stationId, relay, confirmed: true });
export const clearDoorMapping = (entityId: string) => del(`intercom/door-map/${encodeURIComponent(entityId)}`);
export const applyDoorSuggestions = () => post<{ applied: string[] }>('intercom/door-map/apply-suggestions', { confirmed: true });
export const placeStation = (stationId: string, place: { site_id?: string | null; building_id?: string | null }) =>
  put<{ placement: DoorMapStation['placement']; scope_name: string }>(`intercom/stations/${encodeURIComponent(stationId)}/placement`, { ...place, confirmed: true });

export interface DoorLockJob {
  schedule_id: string;
  name: string;
  locks: string[];
  note: string;
}

export interface DoorSettings {
  trusted_path: 'off' | 'on';
  trusted_path_available: boolean;
  /** CR-033 D8: `blocked` (default) refuses new WisKey door steps in the editors, server side. */
  editor_block: 'blocked' | 'allowed';
  editor_allowed_available: boolean;
  /** CR-033 D6: scheduled jobs that lock a WisKey door (they will never work). */
  lock_jobs: DoorLockJob[];
  /** WXD10 (CR-033 6.4): whether the confirmed "disable and list" actions may run at all; `off` by default. */
  conversion: 'off' | 'on';
}

export const getDoorSettings = () => get<DoorSettings>('doors/settings');
export const setEditorBlock = (editorBlock: DoorSettings['editor_block']) => put<DoorSettings>('doors/settings', { editor_block: editorBlock, confirmed: true });

/** One saved item of the read-only door-path inventory (CR-033 D7, "פריטים שפותחים דלתות"). Names only: no entity or
 * station id ever reaches the screen. The `*_text` fields are the server's Hebrew. */
export interface DoorPathItem {
  kind: 'automation' | 'script' | 'scene' | 'schedule' | 'launcher';
  kind_text: string;
  key: string;
  name: string;
  origin: 'arx_authored' | 'arx_edited_externally' | 'external' | 'unknown';
  origin_text: string;
  state: 'enabled' | 'disabled' | 'ready' | 'gone' | 'unknown';
  autonomous: boolean;
  author: string | null;
  created_by: string | null;
  approver: string | null;
  approved_at: string | null;
  approver_status: 'approved' | 'none' | 'inactive' | 'no_permission';
  approver_text: string;
  last_run: { at: string; result: string | null } | null;
  door_steps: number;
  lock_steps: number;
  doors: string[];
  resolvable: boolean;
  unresolved: string[];
  run_guard: 'refused_not_converted' | 'refused_unresolvable' | 'unchanged';
  run_guard_text: string;
  suggestion: 'door_button' | 'hold_open_program' | 'arx_event_job' | 'manual_review' | 'remove_lock_step' | 'external_untouched';
  suggestion_text: string;
  disable_required: boolean;
  revision: string | null;
}

export interface DoorPathInventory {
  wiskey_present: boolean;
  generated_at: string;
  counts: { items: number; door_steps: number; unresolvable: number; arx_authored: number; external: number; disable_required: number };
  items: DoorPathItem[];
}

/** Read-only: nothing is converted, disabled or sent by this request. */
export const getDoorPathInventory = () => get<DoorPathInventory>('intercom/door-path-inventory');

// ---------------------------------------------------------------- disable and list (WXD10A / WXD10B, CR-033 6.4)

export type DoorConversionAction = 'disable' | 'convert_event_job' | 'hand_over_program';
export type DoorConversionCategory = 'event_automation' | 'schedule' | 'script' | 'scene' | 'launcher' | 'unknown';

/** One action for one item: offered now, or the reason it is not (`reason_text` is the server's Hebrew; never show `reason`). */
export interface DoorConversionOffer {
  available: boolean;
  reason: string | null;
  reason_text: string;
  /** convert_event_job: the doors the draft Arx door job will hold and how many Home Assistant steps leave the automation. */
  doors?: string[];
  removed_steps?: number;
  /** hand_over_program: the draft weekly door window (days 0 = Sunday .. 6). */
  program?: { name: string; days: number[]; days_text: string; periods: { start: string; end: string }[]; doors: string[] } | null;
}

export interface DoorConversionRecord {
  id: string;
  item_key: string;
  kind: 'automation' | 'schedule';
  name: string;
  action: 'disabled' | 'converted' | 'handed_over';
  state: 'done' | 'undone';
  door_job_id: string | null;
  program_rule_id: string | null;
  doors: number;
  done_by: string;
  done_at: string;
  undone_by: string | null;
  undone_at: string | null;
}

export interface DoorConversionItem {
  key: string;
  kind: DoorPathItem['kind'];
  name: string;
  category: DoorConversionCategory;
  category_text: string;
  origin: DoorPathItem['origin'];
  origin_text: string;
  state: DoorPathItem['state'];
  autonomous: boolean;
  revision: string | null;
  door_steps: number;
  doors: string[];
  resolvable: boolean;
  unresolved: string[];
  disable_required: boolean;
  approver_text: string;
  run_guard_text: string;
  actions: Record<DoorConversionAction, DoorConversionOffer>;
  offered: DoorConversionAction[];
  record: DoorConversionRecord | null;
}

export interface DoorConversionList {
  switch: 'off' | 'on';
  /** `no_wiskey`: no WisKey door at all; `nothing_found`: no saved item opens one (the 2026-11-04 lab result); `items`. */
  state: 'no_wiskey' | 'nothing_found' | 'items';
  state_text: string;
  wiskey_present: boolean;
  generated_at: string;
  counts: { items: number; disable: number; convert_event_job: number; hand_over_program: number; list_only: number; disable_required: number; handled: number };
  items: DoorConversionItem[];
  records: DoorConversionRecord[];
}

/** Read-only. */
export const getDoorConversion = () => get<DoorConversionList>('intercom/door-path-conversion');
/** One confirmed action on one listed item; `revision` is the item's revision as listed (a changed item is refused). */
export const runDoorConversion = (key: string, action: DoorConversionAction, revision: string | null) =>
  post<{ record: DoorConversionRecord; changed: boolean }>('intercom/door-path-conversion/actions', { key, action, revision, confirmed: true });
export const undoDoorConversion = (recordId: string) =>
  post<{ record: DoorConversionRecord; re_enabled: boolean; ha_steps_restored: boolean | null }>(`intercom/door-path-conversion/records/${encodeURIComponent(recordId)}/undo`, { confirmed: true });
export const setDoorConversionSwitch = (value: DoorSettings['conversion']) => put<DoorSettings>('doors/settings', { conversion: value, confirmed: true });
