// BREAKUI-297 (P6): worst-case people - the signed-in user (`GET /me`, shown in the side rail / user menu) and the users & permissions
// directory (`GET /identity/users`, `/access/roles`, `/access/groups`), shaped like src/api/access.ts. Invented people; data only.
import type { Dataset } from './devices';
import { EMAIL, EMOJI_ONLY, HE_LONG, MIXED, PERSON_HE_LONG, PERSON_LONG, PERSON_ONE, TWO_LATIN } from './strings';

const PEOPLE = [PERSON_HE_LONG, PERSON_ONE, PERSON_LONG, TWO_LATIN, EMOJI_ONLY, MIXED, 'משה כהן'] as const;

/** The signed-in user's display name per dataset (the rail shows initials and the name). */
export function meName(ds: Dataset): string {
  return ({ demo: 'יוני', worst: PERSON_HE_LONG, empty: '', one: PERSON_ONE, huge: PERSON_LONG, offline: EMOJI_ONLY } as Record<Dataset, string>)[ds];
}

const ROLE_IDS = ['viewer', 'operator', 'editor', 'site_admin', 'admin'];
const iso = (d: number) => new Date(Date.UTC(2026, 9, 27 - d, 8, 30)).toISOString();

function binding(i: number, j: number, uid: string, uname: string) {
  const role_id = ROLE_IDS[(i + j) % ROLE_IDS.length];
  return {
    id: `b-${i}-${j}`, subject_kind: 'user', subject_id: uid, subject_name: uname, role_id, role_name: role_id === 'site_admin' ? 'מנהל אתר עם הרשאות האצלה מורחבות' : role_id,
    scope_type: (['installation', 'site', 'building', 'floor', 'camera'] as const)[j % 5], scope_id: `s${j}`, scope_name: j % 2 ? HE_LONG : MIXED,
    effect: j === 3 ? 'deny' : 'allow', permission_revision: 7, assigned_by: 'admin', created_at: iso(30), expires_at: j === 1 ? iso(-400) : null, via_group: j === 2 ? 'g-1' : null,
  };
}

/** `GET /identity/users`. */
export function directory(ds: Dataset) {
  const n = ds === 'empty' ? 0 : ds === 'one' ? 1 : ds === 'huge' ? 500 : ds === 'demo' ? 4 : 24;
  const users = Array.from({ length: n }, (_, i) => {
    const id = `u-${i}`;
    const nm = ds === 'demo' ? ['יוני', 'משה כהן', 'דנה לוי', 'רון'][i] : PEOPLE[i % PEOPLE.length];
    const nb = ds === 'demo' ? 1 : ds === 'one' ? 1 : (i % 4) * 3; // 0, 3, 6, 9 role assignments
    return {
      id, name: nm, username: i % 3 === 0 ? EMAIL : i % 3 === 1 ? 'j' : `user_${i}_${'x'.repeat(i % 20)}`,
      is_admin: i % 5 === 0, active: ds === 'offline' ? false : i % 7 !== 6,
      source: (['both', 'ha_directory', 'vms'] as const)[i % 3],
      sync_status: ds === 'offline' ? 'unavailable' : (['verified', 'stale', 'removed', 'unknown'] as const)[i % 4],
      synced_at: ds === 'offline' ? null : iso(i % 3), first_seen_at: iso(400), last_seen_at: i % 6 === 5 ? null : iso(i % 40),
      groups: Array.from({ length: ds === 'demo' ? 1 : i % 9 }, (_, g) => ({ id: `g-${g}`, name: g % 2 ? HE_LONG : `צוות ${g + 1}` })),
      bindings: Array.from({ length: nb }, (_, j) => binding(i, j, id, nm)),
      is_self: i === 0, remote_access: i % 2 === 0, remote_access_basis: i % 2 === 0 ? 'flag' : null, remote_sessions: i % 4 === 0 ? 1284 : 0,
    };
  });
  return {
    users, directory: { paired: ds !== 'offline', last_directory_at: ds === 'offline' ? null : iso(0), users: n }, revision: 7, can_assign: true,
    assign_scopes: [{ type: 'installation', id: '*', name: 'כל המערכת' }, { type: 'site', id: 's1', name: HE_LONG }], assignable_roles: ROLE_IDS, remote_policy: 'flag',
  };
}

/** `GET /access/roles`. */
export function roles() {
  return {
    roles: ROLE_IDS.map((id) => ({ id, name: id === 'site_admin' ? 'מנהל אתר עם הרשאות האצלה מורחבות' : id, permissions: ['devices.read'], sensitive_included: [], sensitive_missing: [], system_role: id === 'admin', custom: false })),
    labels: { 'devices.read': 'צפייה בהתקנים' }, sensitive: [], can_manage_roles: true, delegated: false,
  };
}

/** `GET /access/groups`. */
export function groups(ds: Dataset) {
  const n = ds === 'empty' ? 0 : ds === 'one' ? 1 : ds === 'huge' ? 60 : 9;
  return {
    groups: Array.from({ length: n }, (_, g) => ({ id: `g-${g}`, name: g % 2 ? HE_LONG : `צוות ${g + 1}`, created_at: iso(90), revision: 1, members: Array.from({ length: g * 7 }, (_, m) => ({ id: `u-${m}`, name: PEOPLE[m % PEOPLE.length] })), bindings: [] })),
    can_manage: true, delegated: false,
  };
}
