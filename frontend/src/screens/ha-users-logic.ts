/**
 * USR1: the pure rules of Settings › משתמשי מערכת הבית (src/screens/system-ha-users.ts) - form checks, row actions, words.
 * The server decides (routers/ha_users.py, services/ha_user_admin.password_problem); these checks only spare a round trip. The
 * common-password denylist stays on the server.
 */
import type { AccessState, HaUsersView, ManagedUser } from '../api/ha-users';
import type { HaUsersTextKey } from '../i18n/ha-users';

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const RUNS = ['0123456789', '9876543210', 'abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba', 'qwertyuiopasdfghjklzxcvbnm'];

export type PasswordRule = 'too_short' | 'too_long' | 'repetitive' | 'sequence' | 'contains_username' | 'contains_name';

export function passwordRule(password: string, username: string, displayName: string, min = 10, max = 128): PasswordRule | null {
  if (password.length < min) return 'too_short';
  if (password.length > max) return 'too_long';
  const low = password.toLowerCase();
  if (new Set(low).size <= 2) return 'repetitive';
  if (RUNS.some((run) => run.includes(low) || (run + run).includes(low))) return 'sequence';
  if (username.length >= 3 && low.includes(username.toLowerCase())) return 'contains_username';
  if (displayName.toLowerCase().split(/\s+/).some((w) => w.length >= 3 && low.includes(w))) return 'contains_name';
  return null;
}

export interface Draft {
  display_name: string;
  username: string;
  password: string;
  password2: string;
  role_id: string;
  scope: string; // `${type}:${id}`
  create_person: boolean;
}

export const emptyDraft = (roleId = 'viewer'): Draft => ({ display_name: '', username: '', password: '', password2: '', role_id: roleId, scope: 'installation:*', create_person: true });

/** Field -> text key of the first problem, empty when the draft may be sent. */
export function draftProblems(d: Draft, min = 10, max = 128): Partial<Record<'display_name' | 'username' | 'password' | 'password2' | 'role_id', HaUsersTextKey>> {
  const out: Partial<Record<'display_name' | 'username' | 'password' | 'password2' | 'role_id', HaUsersTextKey>> = {};
  if (!d.display_name.trim()) out.display_name = 'e_name';
  if (!USERNAME_RE.test(d.username)) out.username = 'e_username';
  const rule = passwordRule(d.password, d.username, d.display_name, min, max);
  if (rule) out.password = `pw_${rule}` as HaUsersTextKey;
  else if (d.password !== d.password2) out.password2 = 'e_mismatch';
  if (!d.role_id) out.role_id = 'e_role';
  return out;
}

export interface RowActions {
  deactivate: boolean;
  activate: boolean;
  remove: boolean;
}

/** What a row offers: nothing for oneself or while the actor is not a home-system administrator; a row needing repair offers delete only. */
export function rowActions(u: ManagedUser, view: Pick<HaUsersView, 'actor_ha_admin'>, access: AccessState): RowActions {
  const can = view.actor_ha_admin && !u.is_self && access !== 'not_authorised' && access !== 'not_configured';
  return {
    deactivate: can && u.state === 'active',
    activate: can && u.state === 'inactive',
    remove: can,
  };
}

export function stateKey(u: ManagedUser): HaUsersTextKey {
  return `st_${u.state}` as HaUsersTextKey;
}

export function repairKey(u: ManagedUser): HaUsersTextKey | null {
  return u.repair ? (`repair_${u.repair}` as HaUsersTextKey) : null;
}

export function accessKey(state: AccessState): HaUsersTextKey {
  return `acc_${state}` as HaUsersTextKey;
}

export function canCreate(view: HaUsersView): boolean {
  return view.actor_ha_admin && view.users.length < view.limit && view.access.state !== 'not_authorised' && view.access.state !== 'not_configured' && view.transport !== 'none';
}

/** A fresh idempotency key per opened dialog: a double click or a retry after a timeout never creates two users. */
export function newRequestKey(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
