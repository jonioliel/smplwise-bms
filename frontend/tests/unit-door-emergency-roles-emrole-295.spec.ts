import { expect, test } from '@playwright/test';
import { retryableOpenDoors } from '../src/door-windows/logic';
import { canManageGrants, defaultExpiryValue, expiryToUtc, grantProblem, localInputValue } from '../src/door-windows/grants-logic';
import type { EmergencyState, Incident } from '../src/api/door-windows';

/** EMROLE-295: who sees the retry action and the holders panel (pure logic; the server decides and checks everything again). */
const base = {
  id: 'i1', kind: 'open', kind_label: 'open', drill: false, state: 'in_effect_partial', scope_type: 'installation', scope_id: '*', scope_name: 'all',
  requested_at: '2026-10-24T20:00:00Z', released_at: null, reason: '', counts: { total: 2, ok: 1, failed: 0, unknown: 1 }, first_sent_ms: null, last_sent_ms: null,
  superseded_by: null,
  doors: [
    { door: 'st-1:1', label: 'Lobby · Main door', phase: 'apply', state: 'unknown', attempts: 1, code: 'running' },
    { door: 'st-2:1', label: 'Yard · Side door', phase: 'apply', state: 'acknowledged', attempts: 1, code: null },
  ],
} as unknown as Incident;

test('the retry action follows the capability the server states: an administrator and a role holder see it, anyone else does not', () => {
  // the server sets can_retry_open for a system administrator and for a holder of the emergency-open role (not expired, switch on); the screen only reads it
  expect(retryableOpenDoors({ ...base, can_retry_open: true }).map((d) => d.door)).toEqual(['st-1:1']);
  expect(retryableOpenDoors({ ...base, can_retry_open: false })).toEqual([]);
  expect(retryableOpenDoors({ ...base })).toEqual([]);
  // a holder gets nothing extra: still only an unknown apply door of a live, non-drill OPEN incident
  expect(retryableOpenDoors({ ...base, can_retry_open: true, kind: 'lock_secure' } as Incident)).toEqual([]);
  expect(retryableOpenDoors({ ...base, can_retry_open: true, drill: true })).toEqual([]);
  expect(retryableOpenDoors({ ...base, can_retry_open: true, state: 'released' } as Incident)).toEqual([]);
});

test('the holders panel is offered only when the state says the person may grant', () => {
  const st = (grant?: boolean) => ({ can: { lock: false, open: false, grant } }) as unknown as EmergencyState;
  expect(canManageGrants(st(true))).toBe(true);
  expect(canManageGrants(st(false))).toBe(false);
  expect(canManageGrants(st(undefined))).toBe(false);
  expect(canManageGrants(null)).toBe(false);
});

test('the typed expiry becomes a UTC instant, and the panel pre-fills the default', () => {
  const local = '2026-11-02T14:30';
  const iso = expiryToUtc(local);
  expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/);
  expect(new Date(iso as string).getTime()).toBe(new Date(local).getTime());
  expect(expiryToUtc('')).toBeNull();
  expect(expiryToUtc('2026-11-02')).toBeNull();
  const now = new Date(2026, 10, 2, 8, 0);
  expect(defaultExpiryValue(now, 24)).toBe(localInputValue(new Date(2026, 10, 3, 8, 0)));
  expect(defaultExpiryValue(now, 0)).toBe('');
});

test('the panel stops a missing person, a past expiry, a too long one for a security manager, and a missing expiry', () => {
  const now = new Date(2026, 10, 2, 8, 0);
  const manager = { can_no_expiry: false, max_hours: 48 };
  const admin = { can_no_expiry: true, max_hours: 48 };
  const at = (hours: number) => localInputValue(new Date(now.getTime() + hours * 3600_000));
  expect(grantProblem(manager, '', at(2), false, now)).toBe('person');
  expect(grantProblem(manager, 'u', at(2), false, now)).toBeNull();
  expect(grantProblem(manager, 'u', at(-2), false, now)).toBe('expiry_past');
  expect(grantProblem(manager, 'u', at(72), false, now)).toBe('expiry_too_long');
  expect(grantProblem(manager, 'u', '', false, now)).toBe('expiry_required');
  expect(grantProblem(manager, 'u', at(2), true, now)).toBe('expiry_required');
  expect(grantProblem(admin, 'u', '', true, now)).toBeNull();
  expect(grantProblem(admin, 'u', at(72), false, now)).toBeNull();
});

test('the emergency-open settings card sits in the general system settings behind system.configure and uses the same four words in every language', async () => {
  const { readFileSync } = await import('node:fs');
  const setup = readFileSync(new URL('../src/screens/system-setup.ts', import.meta.url), 'utf8');
  expect(setup).toMatch(/can\('system\.configure'\) \? html`[^`]*<sw-emergency-open-settings><\/sw-emergency-open-settings>/);
  const card = readFileSync(new URL('../src/screens/system-emergency-open.ts', import.meta.url), 'utf8');
  for (const key of ['doors.emergency.grant.default_hours', 'doors.emergency.grant.max_hours', 'doors.emergency.grant.by_security_manager', 'doors.emergency.retry_open.by_holders']) expect(card).toContain(key);
  const { DWT_TABLES } = await import('../src/i18n/door-windows');
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) for (const k of ['sGrants', 'sGrantDefault', 'sGrantMax', 'sGrantManager', 'sRetryHolders', 'sSave', 'saved'] as const) expect(DWT_TABLES[lang][k].length).toBeGreaterThan(0);
});
