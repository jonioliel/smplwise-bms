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
}

export const getDoorSettings = () => get<DoorSettings>('doors/settings');
export const setEditorBlock = (editorBlock: DoorSettings['editor_block']) => put<DoorSettings>('doors/settings', { editor_block: editorBlock, confirmed: true });
