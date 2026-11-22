/**
 * Users from Home Assistant, VMS groups, role bindings, effective-permission preview and the RBAC audit
 * trail (chapters 8/40). Identity is Home Assistant's; assignments live only inside SMPLWISE.
 */
import { del, get, patch, path, post, put, query } from './client';
import { ltrIsolate } from '../i18n/bidi';
import { dayTimeText } from './day-format';
import { tr } from '../i18n/msg/api-devices';
import type * as GroupWire from './generated/wire-access-groups';
import type * as AuditWire from './generated/wire-access-audit';
import type * as BindingWire from './generated/wire-access-bindings';
import type * as RoleWire from './generated/wire-access-custom-roles';
import type * as DirWire from './generated/wire-access-directory';
import type * as RolesWire from './generated/wire-access-roles';

/* The directory, role catalogue, binding, preview and audit shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/
 * access_directory.py, access_roles.py, access_bindings.py, access_audit.py, generated into ./generated/; code review 07:F8 step 2).
 * Narrowed on purpose: a binding's `scope_type` is one of the CHECK constraint's six (the server types it as a string). */
export type ScopeRef = DirWire.AssignScope;

export type AccessBinding = Omit<GroupWire.AccessGroupBinding, 'scope_type'> & { scope_type: ScopeRef['type'] };

/** One person of the directory. `source` 'local' = an Arx-only identity (USR2); a delegated administrator gets the directory details
 * blanked. CR-008: `remote_access_basis` = what admits the user remotely (their own flag, the administrator default, or 'local' for an
 * Arx-only identity); null when nothing does. */
export type DirectoryUser = Omit<DirWire.DirectoryUser, 'bindings'> & { bindings: AccessBinding[] };

/** T082: `delegated` = a delegated administrator (only what they may assign, inside their own scopes). CR-008 P2: `remote_policy`
 * (absent for a delegated administrator) `flag` = turning a user's remote flag off ends their remote sign-ins at once. */
export type DirectoryResponse = Omit<DirWire.Directory, 'users' | 'remote_policy'> & { users: DirectoryUser[]; remote_policy?: 'flag' | 'any_role' };

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

/** The role catalogue (`roles`: built-in roles, then the live custom roles; each fits RoleInfo). */
export type RolesResponse = RolesWire.RoleCatalogue;

/* The custom-role answers are the backend's response models (smplwise_vms/backend/smplwise/wire/access_custom_roles.py, generated into
 * ./generated/wire-access-custom-roles.ts; code review 07:F8 step 2). RoleInfo stays hand-written: the role LIST (built-in and custom
 * roles together) is routers/access.py's, not modelled yet; a created / updated custom role (RoleWire.CustomRole) fits it. */
/** Who a role change touches, computed before saving (T082); the preview adds the permission labels. */
export type RoleImpact = RoleWire.CustomRoleImpact & Partial<Pick<RoleWire.CustomRolePreview, 'labels'>>;
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

/** Effective permissions of a user at a scope; `limited_to_own`: a delegated administrator sees at most what they hold there. */
export type PreviewResponse = Omit<AuditWire.AccessPreview, 'bindings'> & { bindings: AccessBinding[] };

export type AuditRow = AuditWire.AuditRow;

export const listUsers = () => get<DirectoryResponse>('identity/users');
/** CR-008: turn a user's remote access (SmplWise Arx) on or off - system administrators; turning it off ends the user's
 * remote sessions at once. */
export const setRemoteAccess = (userId: string, enabled: boolean) =>
  put<{ user_id: string; remote_access: boolean; sessions_ended: number }>(`access/users/${encodeURIComponent(userId)}/remote-access`, { enabled });
export const syncDirectory = () => post<DirWire.DirectorySync>('identity/sync');
export const listRoles = () => get<RolesResponse>('access/roles');
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by T076-T080 (users, groups and roles).
export const listBindings = () => get<Omit<BindingWire.BindingList, 'bindings'> & { bindings: AccessBinding[] }>('access/bindings');
export const createBinding = (body: { subject_kind: 'user' | 'group'; subject_id: string; role_id: string; scope_type: string; scope_id: string; effect?: 'allow' | 'deny'; expires_at?: string | null }) =>
  post<AccessBinding & Pick<BindingWire.BindingCreated, 'revision'>>('access/bindings', body);
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
  return get<AuditWire.AuditPage>(`audit${qs ? `?${qs}` : ''}`);
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

export const createRole = (body: CustomRoleBody) => post<RoleWire.CustomRole>('access/roles', body);
export const updateRole = (id: string, body: CustomRoleBody & { revision: number }) => patch<RoleWire.CustomRoleUpdated>(path`access/roles/${id}`, body);
export const deleteRole = (id: string) => del(path`access/roles/${id}`);
export const previewRole = (body: { role_id?: string | null; permissions: string[]; sensitive: string[] }) => post<RoleWire.CustomRolePreview>('access/roles/preview', body);
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by T082 (delegated permissions).
export const getDelegation = () => get<RoleWire.DelegationState>('access/delegation');
export const setDelegation = (roles: string[]) => put<RoleWire.DelegationSaved>('access/delegation', { delegable_roles: roles });
