/**
 * Users from Home Assistant, VMS groups, role bindings, effective-permission preview and the RBAC audit
 * trail (chapters 8/40). Identity is Home Assistant's; assignments live only inside SMPLWISE.
 */
import { del, get, patch, post, put } from './client';

export interface AccessBinding {
  id: string;
  subject_kind: 'user' | 'group';
  subject_id: string;
  subject_name: string;
  role_id: string;
  role_name: string;
  scope_type: 'installation' | 'site' | 'building' | 'floor' | 'camera';
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
}

export interface ScopeRef {
  /** T055: 'camera' = a single camera (the picker lists only cameras wholly inside the caller's reach). */
  type: 'installation' | 'site' | 'building' | 'floor' | 'camera';
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

export interface AccessGroup {
  id: string;
  name: string;
  created_at: string;
  /** T082 revision guard: sent back on rename / membership / the group's bindings; a stale one is a 409. */
  revision: number;
  updated_at?: string | null;
  is_member?: boolean;
  members: { id: string; name: string }[];
  bindings: AccessBinding[];
}

export interface GroupsResponse {
  groups: AccessGroup[];
  /** rbac.roles.manage: create, rename, delete. */
  can_manage: boolean;
  delegated: boolean;
}

/** Who a group change touches, computed by the server before saving (T082). */
export interface GroupImpact {
  group_id: string;
  op: 'bind' | 'unbind' | 'members';
  revision: number;
  scopes: { scope_type: string; scope_id: string; scope_name: string }[];
  users: { id: string; name: string; change: 'member' | 'added' | 'removed'; added: string[]; removed: string[] }[];
  labels: Record<string, string>;
}

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
export const listBindings = () => get<{ bindings: AccessBinding[]; revision: number }>('access/bindings');
export const createBinding = (body: { subject_kind: 'user' | 'group'; subject_id: string; role_id: string; scope_type: string; scope_id: string; effect?: 'allow' | 'deny'; expires_at?: string | null }) =>
  post<AccessBinding & { revision: number }>('access/bindings', body);
export const revokeBinding = (id: string) => del(`access/bindings/${id}`);
export const listGroups = () => get<GroupsResponse>('access/groups');
export const createGroup = (name: string) => post<AccessGroup>('access/groups', { name });
export const renameGroup = (id: string, name: string, revision: number) => patch<AccessGroup>(`access/groups/${id}`, { name, revision });
export const deleteGroup = (id: string, revision?: number) => del(`access/groups/${id}${revision ? `?revision=${revision}` : ''}`);
export const setGroupMembers = (id: string, userIds: string[], revision: number) => put<AccessGroup>(`access/groups/${id}/members`, { user_ids: userIds, revision });
export const bindGroup = (id: string, body: { role_id: string; scope_type: string; scope_id: string; effect?: 'allow' | 'deny'; revision: number }) =>
  post<{ binding_id: string; revision: number; group: AccessGroup }>(`access/groups/${id}/bindings`, body);
export const unbindGroup = (id: string, bindingId: string, revision: number) => del(`access/groups/${id}/bindings/${bindingId}?revision=${revision}`);
export const groupImpact = (id: string, body: { op: 'bind' | 'unbind' | 'members'; role_id?: string; scope_type?: string; scope_id?: string; effect?: 'allow' | 'deny'; binding_id?: string; user_ids?: string[] }) =>
  post<GroupImpact>(`access/groups/${id}/impact`, body);
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
  verified: 'מסונכרן',
  stale: 'סנכרון מיושן',
  removed: 'מושבת / נמחק ב־HA',
  unavailable: 'לא בספריית HA',
  unknown: 'טרם סונכרן',
  dev: 'משתמש פיתוח',
};

export const ACTION_LABEL: Record<string, string> = {
  'rbac.bind': 'שיוך תפקיד',
  'rbac.unbind': 'ביטול שיוך',
  'rbac.group_create': 'יצירת קבוצה',
  'rbac.group_members': 'שינוי חברי קבוצה',
  'rbac.group_delete': 'מחיקת קבוצה',
  'rbac.group_rename': 'שינוי שם קבוצה',
  'rbac.bind_bulk': 'שיוך מרובה',
  'rbac.delegation.update': 'עדכון רשימת ההאצלה',
  'rbac.role.create': 'יצירת תפקיד',
  'rbac.role.update': 'עדכון תפקיד',
  'rbac.role.delete': 'מחיקת תפקיד',
  'rbac.bootstrap_admin': 'מנהל ראשון (bootstrap)',
  'identity.user_disabled': 'משתמש הושבת (HA)',
  'identity.user_enabled': 'משתמש הופעל (HA)',
  'identity.sync': 'סנכרון ספרייה',
};

export function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
}

export const createRole = (body: CustomRoleBody) => post<RoleInfo>('access/roles', body);
export const updateRole = (id: string, body: CustomRoleBody & { revision: number }) => patch<RoleInfo & { impact: RoleImpact }>(`access/roles/${id}`, body);
export const deleteRole = (id: string) => del(`access/roles/${id}`);
export const previewRole = (body: { role_id?: string | null; permissions: string[]; sensitive: string[] }) => post<RoleImpact>('access/roles/preview', body);
export const getDelegation = () => get<{ delegable_roles: string[]; default: string[]; rules: string[]; blocked: Record<string, string>; revision: number }>('access/delegation');
export const setDelegation = (roles: string[]) => put<{ delegable_roles: string[]; revision: number }>('access/delegation', { delegable_roles: roles });
