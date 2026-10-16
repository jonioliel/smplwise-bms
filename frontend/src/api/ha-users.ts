/**
 * USR1 (docs/design/USR1_HA_USERS_FROM_ARX.md): the ONLY module of the frontend that talks to `/api/v1/ha-users`
 * (smplwise_vms/backend/smplwise/routers/ha_users.py) - home-system users created from Arx. Needs `users.ha_manage`; every write
 * also needs the actor to be a home-system administrator (`actor_ha_admin`). The password is sent once in the create call and
 * never kept by this module or the screen after the call. Without a backend (static preview, design review) the in-memory demo
 * store below answers (fake names only).
 */
import { get, post } from './client';
import { isApi } from './session';

export type ManagedState = 'active' | 'inactive' | 'needs_repair';
export type AccessState = 'unknown' | 'ok' | 'not_authorised' | 'unavailable' | 'not_configured' | 'failed';
export type Transport = 'supervisor' | 'token' | 'none';

export interface ManagedUser {
  ha_user_id: string;
  username: string;
  display_name: string;
  role_id: string;
  role_name: string;
  scope_type: string;
  scope_id: string;
  scope_name: string;
  state: ManagedState;
  repair: string | null;
  person: boolean;
  created_at: string;
  created_by_name: string | null;
  is_self: boolean;
}

export interface HaUsersView {
  users: ManagedUser[];
  can_manage: boolean;
  actor_ha_admin: boolean;
  transport: Transport;
  access: { state: AccessState; checked_at: string | null };
  roles: { id: string; name: string }[];
  scopes: { type: string; id: string; name: string }[];
  password: { min_length: number; max_length: number };
  limit: number;
}

export interface CreateRequest {
  display_name: string;
  username: string;
  password: string;
  role_id: string;
  scope_type: string;
  scope_id: string;
  create_person: boolean;
  request_key: string;
}

// ---------------------------------------------------------------- demo store (no backend)

const demo: HaUsersView = {
  users: [
    { ha_user_id: 'demo-1', username: 'dana', display_name: 'דנה לוי', role_id: 'viewer', role_name: 'צופה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה',
      state: 'active', repair: null, person: true, created_at: '2026-10-16T08:00:00Z', created_by_name: 'מנהל', is_self: false },
    { ha_user_id: 'demo-2', username: 'yossi', display_name: 'יוסי כהן', role_id: 'operator', role_name: 'מפעיל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה',
      state: 'inactive', repair: null, person: true, created_at: '2026-10-15T08:00:00Z', created_by_name: 'מנהל', is_self: false },
  ],
  can_manage: true,
  actor_ha_admin: true,
  transport: 'supervisor',
  access: { state: 'ok', checked_at: '2026-10-16T08:00:00Z' },
  roles: [{ id: 'viewer', name: 'צופה' }, { id: 'operator', name: 'מפעיל' }, { id: 'editor', name: 'עורך מפות ותצוגות' }],
  scopes: [{ type: 'installation', id: '*', name: 'כל ההתקנה' }],
  password: { min_length: 10, max_length: 128 },
  limit: 50,
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const haUsersApi = {
  async view(): Promise<HaUsersView> {
    return isApi() ? get<HaUsersView>('/ha-users') : clone(demo);
  },
  async check(): Promise<{ access: HaUsersView['access']; transport: Transport }> {
    return isApi() ? post<{ access: HaUsersView['access']; transport: Transport }>('/ha-users/check', {}) : { access: clone(demo.access), transport: demo.transport };
  },
  async create(body: CreateRequest): Promise<{ user: ManagedUser; replayed: boolean }> {
    if (isApi()) return post<{ user: ManagedUser; replayed: boolean }>('/ha-users', body);
    const role = demo.roles.find((r) => r.id === body.role_id);
    const user: ManagedUser = { ha_user_id: `demo-${Date.now()}`, username: body.username, display_name: body.display_name, role_id: body.role_id, role_name: role?.name ?? body.role_id,
      scope_type: body.scope_type, scope_id: body.scope_id, scope_name: 'כל ההתקנה', state: 'active', repair: null, person: body.create_person,
      created_at: new Date().toISOString(), created_by_name: 'מנהל', is_self: false };
    demo.users.push(user);
    return { user: clone(user), replayed: false };
  },
  async setActive(id: string, active: boolean): Promise<{ user: ManagedUser }> {
    if (isApi()) return post<{ user: ManagedUser }>(`/ha-users/${encodeURIComponent(id)}/${active ? 'activate' : 'deactivate'}`, { confirm: true });
    const u = demo.users.find((x) => x.ha_user_id === id);
    if (u) u.state = active ? 'active' : 'inactive';
    return { user: clone(u as ManagedUser) };
  },
  async remove(id: string, confirmUsername: string): Promise<{ deleted: string; already_gone: boolean }> {
    if (isApi()) return post<{ deleted: string; already_gone: boolean }>(`/ha-users/${encodeURIComponent(id)}/delete`, { confirm_username: confirmUsername });
    demo.users = demo.users.filter((x) => x.ha_user_id !== id);
    return { deleted: id, already_gone: false };
  },
};
