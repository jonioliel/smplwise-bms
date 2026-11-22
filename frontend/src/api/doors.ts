/**
 * WisKey door administration (CR-033 wave 1): the "פתיחת דלתות" grant card (Settings › הרשאות), the station placement and
 * door map cards (Settings › הגדרת מערכת, next to the WisKey station cameras) and the trusted-path flag. Settings only:
 * operator screens show nothing new (the open button simply follows the server's answer).
 */
import { del, get, post, put } from './client';
import type * as Wire from './generated/wire-doors';

/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/doors.py), generated into
 * ./generated/wire-doors.ts: a field the server renames or drops is a compile error here (code review 07:F8 step 2). Narrowed on
 * purpose: the door-path inventory's and the conversion list's enumerations (`kind`, `origin`, `state`, `run_guard`, `suggestion`,
 * `category`, the actions) to the values the services fix; `unmapped_doors` stays optional (an older server). */

/** One user or group row of the grant card. `granted`: this card's door_opener binding exists; `other`: other bindings
 * that also let them open (read-only, "שיוך אחר"). */
export type DoorGrantSubject = Wire.DoorGrantSubject;

/** One role row: custom roles are switchable (`editable`), built-in roles read-only with their effective answer (`answer`: `yes` holds
 * it, `per_user` grant to people separately, `never` viewer / kiosk); a custom role carries `delegable` and `revision`. */
export type DoorGrantRole = Wire.DoorGrantRole;

/** UNLOCK-REASON-2370: `unmapped_doors` - intercom doors with no working door mapping (counts only; `with_suggestion` = a clear
 * one-to-one suggestion waits). */
export type DoorGrants = Omit<Wire.DoorGrants, 'unmapped_doors'> & Partial<Pick<Wire.DoorGrants, 'unmapped_doors'>>;

export const getDoorGrants = () => get<DoorGrants>('access/door-grants');
export const switchDoorSubject = (kind: 'user' | 'group', id: string, enabled: boolean) =>
  post<Wire.DoorSubjectSwitched>('access/door-grants/subjects', { subject_kind: kind, subject_id: id, enabled, confirmed: true });
export const switchDoorRole = (roleId: string, enabled: boolean, revision: number) =>
  put<Wire.DoorRoleSwitched>(`access/door-grants/roles/${encodeURIComponent(roleId)}`, { enabled, revision, confirmed: true });

/** One WisKey lock entity: `station_id` is the station the lock's own registry entry names, when the WisKey copy lists it. */
export type DoorMapLock = Wire.DoorMapLock;

export type DoorMap = Wire.DoorMap;

export const getDoorMap = () => get<DoorMap>('intercom/door-map');
export const setDoorMapping = (entityId: string, stationId: string, relay: number) =>
  put<Wire.DoorMappingSet>(`intercom/door-map/${encodeURIComponent(entityId)}`, { station_id: stationId, relay, confirmed: true });
export const clearDoorMapping = (entityId: string) => del(`intercom/door-map/${encodeURIComponent(entityId)}`);
export const applyDoorSuggestions = () => post<Wire.DoorSuggestionsApplied>('intercom/door-map/apply-suggestions', { confirmed: true });
export const placeStation = (stationId: string, place: { site_id?: string | null; building_id?: string | null }) =>
  put<Wire.DoorStationPlaced>(`intercom/stations/${encodeURIComponent(stationId)}/placement`, { ...place, confirmed: true });

/** `editor_block` (CR-033 D8): `blocked` (default) refuses new WisKey door steps in the editors, server side. `lock_jobs` (CR-033 D6):
 * scheduled jobs that lock a WisKey door (they will never work). `conversion` (WXD10, CR-033 6.4): whether the confirmed "disable and
 * list" actions may run at all; `off` by default. */
export type DoorSettings = Wire.DoorSettings;

export const getDoorSettings = () => get<DoorSettings>('doors/settings');
export const setEditorBlock = (editorBlock: DoorSettings['editor_block']) => put<DoorSettings>('doors/settings', { editor_block: editorBlock, confirmed: true });

/** One saved item of the read-only door-path inventory (CR-033 D7, "פריטים שפותחים דלתות"). Names only: no entity or
 * station id ever reaches the screen. The `*_text` fields are the server's Hebrew. */
export interface DoorPathItem extends Omit<Wire.DoorPathItem, 'kind' | 'origin' | 'state' | 'approver_status' | 'run_guard' | 'suggestion'> {
  kind: 'automation' | 'script' | 'scene' | 'schedule' | 'launcher';
  origin: 'arx_authored' | 'arx_edited_externally' | 'external' | 'unknown';
  state: 'enabled' | 'disabled' | 'ready' | 'gone' | 'unknown';
  approver_status: 'approved' | 'none' | 'inactive' | 'no_permission';
  run_guard: 'refused_not_converted' | 'refused_unresolvable' | 'unchanged';
  suggestion: 'door_button' | 'hold_open_program' | 'arx_event_job' | 'manual_review' | 'remove_lock_step' | 'external_untouched';
}

export type DoorPathInventory = Omit<Wire.DoorPathInventory, 'items'> & { items: DoorPathItem[] };

/** Read-only: nothing is converted, disabled or sent by this request. */
export const getDoorPathInventory = () => get<DoorPathInventory>('intercom/door-path-inventory');

// ---------------------------------------------------------------- disable and list (WXD10A / WXD10B, CR-033 6.4)

export type DoorConversionAction = 'disable' | 'convert_event_job' | 'hand_over_program';
type DoorConversionCategory = 'event_automation' | 'schedule' | 'script' | 'scene' | 'launcher' | 'unknown';

/** One action for one item: offered now, or the reason it is not (`reason_text` is the server's Hebrew; never show `reason`).
 * convert_event_job: `doors` the draft Arx door job will hold and `removed_steps` leaving the automation; hand_over_program: `program`,
 * the draft weekly door window (days 0 = Sunday .. 6). */
export type DoorConversionOffer = Wire.DoorConversionOffer;

export type DoorConversionRecord = Omit<Wire.DoorConversionRecord, 'kind'> & { kind: 'automation' | 'schedule' };

export interface DoorConversionItem extends Omit<Wire.DoorConversionItem, 'kind' | 'category' | 'origin' | 'state' | 'actions' | 'offered' | 'record'> {
  kind: DoorPathItem['kind'];
  category: DoorConversionCategory;
  origin: DoorPathItem['origin'];
  state: DoorPathItem['state'];
  actions: Record<DoorConversionAction, DoorConversionOffer>;
  offered: DoorConversionAction[];
  record: DoorConversionRecord | null;
}

/** `state`: `no_wiskey` no WisKey door at all; `nothing_found` no saved item opens one (the 2026-11-04 lab result); `items`. */
export type DoorConversionList = Omit<Wire.DoorConversionList, 'items' | 'records'> & { items: DoorConversionItem[]; records: DoorConversionRecord[] };

/** Read-only. */
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by WXD10A/WXD10B (door-path conversion; the backend feature has no screen yet).
export const getDoorConversion = () => get<DoorConversionList>('intercom/door-path-conversion');
/** One confirmed action on one listed item; `revision` is the item's revision as listed (a changed item is refused). */
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by WXD10A/WXD10B (door-path conversion).
export const runDoorConversion = (key: string, action: DoorConversionAction, revision: string | null) =>
  post<Omit<Wire.DoorConversionDone, 'record'> & { record: DoorConversionRecord }>('intercom/door-path-conversion/actions', { key, action, revision, confirmed: true });
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by WXD10A/WXD10B (door-path conversion).
export const undoDoorConversion = (recordId: string) =>
  post<Omit<Wire.DoorConversionUndone, 'record'> & { record: DoorConversionRecord }>(`intercom/door-path-conversion/records/${encodeURIComponent(recordId)}/undo`, { confirmed: true });
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by WXD10A/WXD10B (door-path conversion).
export const setDoorConversionSwitch = (value: DoorSettings['conversion']) => put<DoorSettings>('doors/settings', { conversion: value, confirmed: true });
