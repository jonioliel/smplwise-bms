/**
 * USR1 (docs/design/USR1_HA_USERS_FROM_ARX.md): the ONLY module of the frontend that talks to `/api/v1/ha-users`
 * (smplwise_vms/backend/smplwise/routers/ha_users.py) - home-system users created from Arx. Needs `users.ha_manage`; every write
 * also needs the actor to be a home-system administrator (`actor_ha_admin`). The password is sent once in the create call and
 * never kept by this module or the screen after the call. Without a backend (static preview, design review) the in-memory demo
 * store below answers (fake names only).
 */
import { get, post } from './client';
import { isApi } from './session';
import type * as Wire from './generated/wire-ha-users';
import { tr } from '../i18n/msg/api-system';

type ManagedState = 'active' | 'inactive' | 'needs_repair';
export type AccessState = 'unknown' | 'ok' | 'not_authorised' | 'unavailable' | 'not_configured' | 'failed';
export type Transport = Wire.HaUserList['transport'];

/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/ha_users.py, generated into
 * ./generated/wire-ha-users.ts): a renamed or dropped field is a compile error here (code review 07:F8 step 2). Narrowed on purpose:
 * a listed user is never `creating` / `deleted` and always has its home-system id (the list holds only the three live states), and the
 * access state is one of the probe's known results. */
export type ManagedUser = Omit<Wire.HaUserRow, 'ha_user_id' | 'state'> & { ha_user_id: string; state: ManagedState };

export type HaUsersView = Omit<Wire.HaUserList, 'users' | 'access'> & {
  users: ManagedUser[];
  access: { state: AccessState; checked_at: string | null };
};

interface CreateRequest {
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
    { ha_user_id: 'demo-1', username: 'dana', display_name: 'דנה לוי', role_id: 'viewer', role_name: tr('צופה'), scope_type: 'installation', scope_id: '*', scope_name: tr('כל ההתקנה'),
      state: 'active', repair: null, person: true, created_at: '2026-10-16T08:00:00Z', created_by_name: 'מנהל', is_self: false },
    { ha_user_id: 'demo-2', username: 'yossi', display_name: 'יוסי כהן', role_id: 'operator', role_name: tr('מפעיל'), scope_type: 'installation', scope_id: '*', scope_name: tr('כל ההתקנה'),
      state: 'inactive', repair: null, person: true, created_at: '2026-10-15T08:00:00Z', created_by_name: 'מנהל', is_self: false },
  ],
  can_manage: true,
  actor_ha_admin: true,
  transport: 'supervisor',
  access: { state: 'ok', checked_at: '2026-10-16T08:00:00Z' },
  roles: [{ id: 'viewer', name: tr('צופה') }, { id: 'operator', name: tr('מפעיל') }, { id: 'editor', name: tr('עורך מפות ותצוגות') }],
  scopes: [{ type: 'installation', id: '*', name: tr('כל ההתקנה') }],
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
      scope_type: body.scope_type, scope_id: body.scope_id, scope_name: tr('כל ההתקנה'), state: 'active', repair: null, person: body.create_person,
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
  async remove(id: string, confirmUsername: string): Promise<Wire.HaUserDeleted> {
    if (isApi()) return post<Wire.HaUserDeleted>(`/ha-users/${encodeURIComponent(id)}/delete`, { confirm_username: confirmUsername });
    demo.users = demo.users.filter((x) => x.ha_user_id !== id);
    return { deleted: id, already_gone: false };
  },
};
