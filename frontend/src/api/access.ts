/**
 * Users from Home Assistant, VMS groups, role bindings, effective-permission preview and the RBAC audit
 * trail (chapters 8/40). Identity is Home Assistant's; assignments live only inside SMPLWISE.
 */
import { del, get, post, put } from './client';

export interface AccessBinding {
  id: string;
  subject_kind: 'user' | 'group';
  subject_id: string;
  subject_name: string;
  role_id: string;
  role_name: string;
  scope_type: 'installation' | 'site' | 'building' | 'floor';
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
}

export interface DirectoryResponse {
  users: DirectoryUser[];
  directory: { paired: boolean; last_directory_at: string | null; users: number };
  revision: number;
  can_assign: boolean;
}

export interface RoleInfo {
  id: string;
  name: string;
  permissions: string[];
  sensitive_included: string[];
  sensitive_missing: string[];
  system_role: boolean;
}

export interface RolesResponse {
  roles: RoleInfo[];
  labels: Record<string, string>;
  sensitive: string[];
}

export interface AccessGroup {
  id: string;
  name: string;
  created_at: string;
  members: { id: string; name: string }[];
  bindings: AccessBinding[];
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
export const syncDirectory = () => post<{ requested: boolean; note?: string; result?: unknown }>('identity/sync');
export const listRoles = () => get<RolesResponse>('access/roles');
export const listBindings = () => get<{ bindings: AccessBinding[]; revision: number }>('access/bindings');
export const createBinding = (body: { subject_kind: 'user' | 'group'; subject_id: string; role_id: string; scope_type: string; scope_id: string; effect?: 'allow' | 'deny'; expires_at?: string | null }) =>
  post<AccessBinding & { revision: number }>('access/bindings', body);
export const revokeBinding = (id: string) => del(`access/bindings/${id}`);
export const listGroups = () => get<{ groups: AccessGroup[] }>('access/groups');
export const createGroup = (name: string) => post<AccessGroup>('access/groups', { name });
export const deleteGroup = (id: string) => del(`access/groups/${id}`);
export const setGroupMembers = (id: string, userIds: string[]) => put<AccessGroup>(`access/groups/${id}/members`, { user_ids: userIds });
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
