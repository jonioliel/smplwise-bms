import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HaUsersView, ManagedUser } from '../src/api/ha-users';
import { HA_USERS_TEXT_KEYS, ht } from '../src/i18n/ha-users';
import { USERNAME_RE, accessKey, canCreate, draftProblems, emptyDraft, newRequestKey, passwordRule, repairKey, rowActions, stateKey } from '../src/screens/ha-users-logic';

// USR1 (docs/design/USR1_HA_USERS_FROM_ARX.md): the pure rules of Settings › משתמשי מערכת הבית - no browser page.
//   npx playwright test -c playwright.unit.config.ts tests/unit-ha-users.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

const user = (over: Partial<ManagedUser> = {}): ManagedUser => ({
  ha_user_id: 'u1', username: 'dana', display_name: 'Dana Levi', role_id: 'viewer', role_name: 'צופה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה',
  state: 'active', repair: null, person: true, created_at: '2026-10-16T08:00:00Z', created_by_name: 'מנהל', is_self: false, ...over,
});
const view = (over: Partial<HaUsersView> = {}): HaUsersView => ({
  users: [], can_manage: true, actor_ha_admin: true, transport: 'supervisor', access: { state: 'ok', checked_at: null }, roles: [{ id: 'viewer', name: 'צופה' }],
  scopes: [{ type: 'installation', id: '*', name: 'כל ההתקנה' }], password: { min_length: 10, max_length: 128 }, limit: 50, ...over,
});

test('password rules mirror the server (the common-password list stays on the server)', () => {
  expect(passwordRule('short1!', 'dana', 'Dana Levi')).toBe('too_short');
  expect(passwordRule('a'.repeat(129), 'dana', 'Dana Levi')).toBe('too_long');
  expect(passwordRule('ababababab', 'dana', 'Dana Levi')).toBe('repetitive');
  expect(passwordRule('abcdefghijk', 'dana', 'Dana Levi')).toBe('sequence');
  expect(passwordRule('0123456789', 'dana', 'Dana Levi')).toBe('sequence');
  expect(passwordRule('my-dana-pass-77', 'dana', 'Dana Levi')).toBe('contains_username');
  expect(passwordRule('LeviFamily-2026', 'dana', 'Dana Levi')).toBe('contains_name');
  expect(passwordRule('Rk7#vNq2-Lp9zW', 'dana', 'Dana Levi')).toBeNull();
});

test('the draft needs a name, a valid username, a good password typed twice and a role', () => {
  const d = emptyDraft();
  expect(Object.keys(draftProblems(d)).sort()).toEqual(['display_name', 'password', 'username']);
  const ok = { ...d, display_name: 'Dana Levi', username: 'dana', password: 'Rk7#vNq2-Lp9zW', password2: 'Rk7#vNq2-Lp9zW' };
  expect(draftProblems(ok)).toEqual({});
  expect(draftProblems({ ...ok, password2: 'other' })).toEqual({ password2: 'e_mismatch' });
  expect(draftProblems({ ...ok, username: 'Dana' }).username).toBe('e_username');
  expect(draftProblems({ ...ok, role_id: '' }).role_id).toBe('e_role');
  expect(USERNAME_RE.test('dana.levi-2')).toBe(true);
  expect(USERNAME_RE.test('da')).toBe(false);
  expect(USERNAME_RE.test('דנה')).toBe(false);
});

test('row actions: deactivate is offered for an active user, activate for an inactive one, nothing for oneself or a non-admin actor', () => {
  expect(rowActions(user(), view(), 'ok')).toEqual({ deactivate: true, activate: false, remove: true });
  expect(rowActions(user({ state: 'inactive' }), view(), 'ok')).toEqual({ deactivate: false, activate: true, remove: true });
  expect(rowActions(user({ state: 'needs_repair', repair: 'binding_failed' }), view(), 'ok')).toEqual({ deactivate: false, activate: false, remove: true });
  expect(rowActions(user({ is_self: true }), view(), 'ok')).toEqual({ deactivate: false, activate: false, remove: false });
  expect(rowActions(user(), view({ actor_ha_admin: false }), 'ok')).toEqual({ deactivate: false, activate: false, remove: false });
  expect(rowActions(user(), view(), 'not_authorised').remove).toBe(false);
});

test('create is offered only to a home-system administrator, under the limit, with a usable connection', () => {
  expect(canCreate(view())).toBe(true);
  expect(canCreate(view({ actor_ha_admin: false }))).toBe(false);
  expect(canCreate(view({ transport: 'none' }))).toBe(false);
  expect(canCreate(view({ access: { state: 'not_authorised', checked_at: null } }))).toBe(false);
  expect(canCreate(view({ limit: 1, users: [user()] }))).toBe(false);
});

test('every state, repair and access word exists in Hebrew', () => {
  for (const s of ['active', 'inactive', 'needs_repair'] as const) expect(HA_USERS_TEXT_KEYS).toContain(stateKey(user({ state: s })));
  for (const r of ['person_missing', 'compensation_failed', 'binding_failed', 'cleanup_failed', 'missing_in_ha']) expect(HA_USERS_TEXT_KEYS).toContain(repairKey(user({ repair: r })));
  for (const a of ['unknown', 'ok', 'not_authorised', 'unavailable', 'not_configured', 'failed'] as const) expect(HA_USERS_TEXT_KEYS).toContain(accessKey(a));
  for (const k of ['too_short', 'too_long', 'repetitive', 'common', 'sequence', 'contains_username', 'contains_name']) expect(HA_USERS_TEXT_KEYS).toContain(`pw_${k}`);
  expect(ht('count', { n: 3, max: 50 })).toBe('3 מתוך 50');
});

test('the not-authorised text tells the owner what to do; no platform product name on the screen', () => {
  // USR1-263: the token is saved in Settings > Connections > Secrets, never in the add-on options
  expect(ht('acc_not_authorised_fix')).toContain('הגדרות › חיבורים › סודות');
  expect(ht('acc_not_authorised_fix')).not.toMatch(/ha_users_token|התוסף/);
  for (const k of HA_USERS_TEXT_KEYS) {
    const text = ht(k);
    expect(text, k).not.toMatch(/Home Assistant|\bHA\b|Supervisor|Ingress/);
  }
  const screen = readFileSync(path.join(SRC, 'screens/system-ha-users.ts'), 'utf8');
  expect(screen).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);  // tokens only
});

test('request keys are fresh and fit the server pattern', () => {
  const a = newRequestKey();
  expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  expect(newRequestKey()).not.toBe(a);
});
