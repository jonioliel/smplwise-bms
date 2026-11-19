/**
 * Users from Home Assistant, VMS groups, role bindings, effective-permission preview and the RBAC audit
 * trail (chapters 8/40). Identity is Home Assistant's; assignments live only inside SMPLWISE.
 */
import { del, get, patch, path, post, put, query } from './client';
import { ltrIsolate } from '../i18n/bidi';
import { dayTimeText } from './day-format';
import { tr } from '../i18n/msg/api-devices';
import type * as GroupWire from './generated/wire-access-groups';

export interface AccessBinding {
  id: string;
  subject_kind: 'user' | 'group';
  subject_id: string;
  subject_name: string;
  role_id: string;
  role_name: string;
  scope_type: 'installation' | 'site' | 'building' | 'floor' | 'camera' | 'access_control_station';
  scope_id: string;
  scope_name: string;
  effect: 'allow' | 'deny';
  permission_revision: number;
  assigned_by: string | null;
  created_at: string;
  expires_at: string | null;
  via_group: string | null;
}

export interface DirectoryUser {
  id: string;
  name: string;
  username: string;
  is_admin: boolean;
  active: boolean;
  source: 'both' | 'ha_directory' | 'vms';
  sync_status: 'verified' | 'stale' | 'removed' | 'unavailable' | 'unknown' | 'dev';
  synced_at: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  groups: { id: string; name: string }[];
  bindings: AccessBinding[];
  is_self: boolean;
  /** CR-008: the per-user remote-access flag (SmplWise Arx, remote.policy = flag). */
  remote_access?: boolean;
  /** CR-008 amendment: what admits the user remotely - their own flag, or the administrator default (the installation setting
   * remote.admins_default, not the user's switch); null when nothing does. `remote_admin_default`: the default would admit them
   * without the flag. */
  remote_access_basis?: 'flag' | 'admin_default' | null;
  remote_admin_default?: boolean;
  /** CR-008 P2: the last remote sign-in (ISO time) and how many remote sign-ins are active now. */
  remote_last_sign_in?: string | null;
  remote_sessions?: number;
}

export interface ScopeRef {
  /** T055: 'camera' = a single camera (the picker lists only cameras wholly inside the caller's reach). */
  /** CR-033 D2: 'access_control_station' = one WisKey station (listed by name in the same scope picker). */
  type: 'installation' | 'site' | 'building' | 'floor' | 'camera' | 'access_control_station';
  id: string;
  name: string;
}

export interface DirectoryResponse {
  users: DirectoryUser[];
  directory: { paired: boolean; last_directory_at: string | null; users: number };
  revision: number;
  can_assign: boolean;
  /** T082: a delegated administrator (site admin) - only what they may assign, inside their own scopes. */
  delegated?: boolean;
  /** Every scope node where the caller holds rbac.assign (the scope picker). */
  assign_scopes?: ScopeRef[];
  /** Role ids the caller may hand out (all for a system administrator, the allow-list for a delegated one). */
  assignable_roles?: string[];
  /** CR-008 P2: `flag` = turning a user's remote flag off ends their remote sign-ins at once. */
  remote_policy?: 'flag' | 'any_role';
}

export interface RoleInfo {
  id: string;
  name: string;
  permissions: string[];
  sensitive_included: string[];
  sensitive_missing: string[];
  system_role: boolean;
  /** Custom roles (T082): editable, never a system permission, sensitive grants listed explicitly. */
  custom?: boolean;
  description?: string;
  revision?: number | null;
  delegable?: boolean;
  /** Why the role can never be on the delegation allow-list (system_role / assign_role / sensitive_custom_role). */
  delegation_block?: string | null;
  created_by_username?: string | null;
  updated_by_username?: string | null;
}

export interface RolesResponse {
  roles: RoleInfo[];
  labels: Record<string, string>;
  sensitive: string[];
  system_permissions?: string[];
  /** WXPERM: legacy permission name -> the permission it stands for (a role listing the old name holds the new one). */
  legacy_permissions?: Record<string, string>;
  delegable_roles?: string[];
  can_manage_roles?: boolean;
  delegated?: boolean;
}

/** Who a role change touches, computed before saving (T082). */
export interface RoleImpact {
  role_id: string | null;
  added: string[];
  removed: string[];
  bindings: number;
  users: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  scopes: string[];
  labels?: Record<string, string>;
}
export interface CustomRoleBody {
  name: string;
  description: string;
  permissions: string[];
  sensitive: string[];
  delegable: boolean;
}

/* The group shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/access_groups.py, generated into
 * ./generated/wire-access-groups.ts; code review 07:F8 step 2). `revision` (T082 revision guard) is sent back on rename / membership /
 * the group's bindings; a stale one is a 409. Narrowed on purpose: a binding keeps the access module's own AccessBinding (its scope
 * types are the CHECK constraint's six). */
export type AccessGroup = Omit<GroupWire.AccessGroup, 'bindings'> & { bindings: AccessBinding[] };

type GroupsResponse = Omit<GroupWire.AccessGroupList, 'groups'> & { groups: AccessGroup[] };

/** Who a group change touches, computed by the server before saving (T082). */
export type GroupImpact = GroupWire.AccessGroupImpact;

export interface PreviewResponse {
  user_id: string;
  scope_type: string;
  scope_id: string;
  scope_name: string;
  active: boolean;
  allowed: string[];
  denied: string[];
  labels: Record<string, string>;
  bindings: AccessBinding[];
  revision: number;
}

export interface AuditRow {
  id?: string;
  at: string;
  actor_username: string | null;
  action: string;
  decision: string;
  resource_type: string | null;
  resource_id: string | null;
  reason: string | null;
  permission_revision?: string | number | null;
  details: Record<string, unknown>;
}

export const listUsers = () => get<DirectoryResponse>('identity/users');
/** CR-008: turn a user's remote access (SmplWise Arx) on or off - system administrators; turning it off ends the user's
 * remote sessions at once. */
export const setRemoteAccess = (userId: string, enabled: boolean) =>
  put<{ user_id: string; remote_access: boolean; sessions_ended: number }>(`access/users/${encodeURIComponent(userId)}/remote-access`, { enabled });
export const syncDirectory = () => post<{ requested: boolean; note?: string; result?: unknown }>('identity/sync');
export const listRoles = () => get<RolesResponse>('access/roles');
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by T076-T080 (users, groups and roles).
export const listBindings = () => get<{ bindings: AccessBinding[]; revision: number }>('access/bindings');
export const createBinding = (body: { subject_kind: 'user' | 'group'; subject_id: string; role_id: string; scope_type: string; scope_id: string; effect?: 'allow' | 'deny'; expires_at?: string | null }) =>
  post<AccessBinding & { revision: number }>('access/bindings', body);
export const revokeBinding = (id: string) => del(path`access/bindings/${id}`);
export const listGroups = () => get<GroupsResponse>('access/groups');
export const createGroup = (name: string) => post<AccessGroup>('access/groups', { name });
export const renameGroup = (id: string, name: string, revision: number) => patch<AccessGroup>(path`access/groups/${id}`, { name, revision });
export const deleteGroup = (id: string, revision?: number) => del(path`access/groups/${id}` + query({ revision: revision || undefined }));
export const setGroupMembers = (id: string, userIds: string[], revision: number) => put<AccessGroup>(path`access/groups/${id}/members`, { user_ids: userIds, revision });
export const bindGroup = (id: string, body: { role_id: string; scope_type: string; scope_id: string; effect?: 'allow' | 'deny'; revision: number }) =>
  post<Omit<GroupWire.AccessGroupBound, 'group'> & { group: AccessGroup }>(path`access/groups/${id}/bindings`, body);
export const unbindGroup = (id: string, bindingId: string, revision: number) => del(path`access/groups/${id}/bindings/${bindingId}` + query({ revision }));
export const groupImpact = (id: string, body: { op: 'bind' | 'unbind' | 'members'; role_id?: string; scope_type?: string; scope_id?: string; effect?: 'allow' | 'deny'; binding_id?: string; user_ids?: string[] }) =>
  post<GroupImpact>(path`access/groups/${id}/impact`, body);
export const previewAccess = (body: { user_id: string; scope_type?: string; scope_id?: string }) => post<PreviewResponse>('access/preview', body);
export const listAudit = (opts: { prefix?: string; actor?: string; resourceId?: string; limit?: number } = {}) => {
  const q = new URLSearchParams();
  if (opts.prefix) q.set('prefix', opts.prefix);
  if (opts.actor) q.set('actor', opts.actor);
  if (opts.resourceId) q.set('resource_id', opts.resourceId);
  if (opts.limit) q.set('limit', String(opts.limit));
  const qs = q.toString();
  return get<{ rows: AuditRow[] }>(`audit${qs ? `?${qs}` : ''}`);
};

export const SYNC_LABEL: Record<DirectoryUser['sync_status'], string> = {
  verified: tr('מסונכרן'),
  stale: tr('סנכרון מיושן'),
  removed: tr('מושבת / נמחק ב־HA'),
  unavailable: tr('לא בספריית HA'),
  unknown: tr('טרם סונכרן'),
  dev: tr('משתמש פיתוח'),
};

export const ACTION_LABEL: Record<string, string> = {
  'rbac.bind': tr('שיוך תפקיד'),
  'rbac.unbind': tr('ביטול שיוך'),
  'rbac.group_create': tr('יצירת קבוצה'),
  'rbac.group_members': tr('שינוי חברי קבוצה'),
  'rbac.group_delete': tr('מחיקת קבוצה'),
  'rbac.group_rename': tr('שינוי שם קבוצה'),
  'rbac.bind_bulk': tr('שיוך מרובה'),
  'rbac.delegation.update': tr('עדכון רשימת ההאצלה'),
  'rbac.role.create': tr('יצירת תפקיד'),
  'rbac.role.update': tr('עדכון תפקיד'),
  'rbac.role.delete': tr('מחיקת תפקיד'),
  'rbac.bootstrap_admin': tr('מנהל ראשון (bootstrap)'),
  'identity.user_disabled': tr('משתמש הושבת (HA)'),
  'identity.user_enabled': tr('משתמש הופעל (HA)'),
  'identity.sync': tr('סנכרון ספרייה'),
};

export function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return ltrIsolate(dayTimeText(d));
}

export const createRole = (body: CustomRoleBody) => post<RoleInfo>('access/roles', body);
export const updateRole = (id: string, body: CustomRoleBody & { revision: number }) => patch<RoleInfo & { impact: RoleImpact }>(path`access/roles/${id}`, body);
export const deleteRole = (id: string) => del(path`access/roles/${id}`);
export const previewRole = (body: { role_id?: string | null; permissions: string[]; sensitive: string[] }) => post<RoleImpact>('access/roles/preview', body);
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by T082 (delegated permissions).
export const getDelegation = () => get<{ delegable_roles: string[]; default: string[]; rules: string[]; blocked: Record<string, string>; revision: number }>('access/delegation');
export const setDelegation = (roles: string[]) => put<{ delegable_roles: string[]; revision: number }>('access/delegation', { delegable_roles: roles });
