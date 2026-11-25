import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { enterAnswer, type EnterTarget } from '../src/components/confirm-dialog-keys';

// FE-SAFETY-FIX-2520 (deep review 2520 frontend core). Node only (playwright.unit.config.ts):
//   FC-04 - Enter in the confirmation dialog confirms ONLY on the confirm button (the rule, and a source guard that the dialog uses it);
//           the typed-confirmation reset fields submit only when valid and not already running.
//   FC-02 - the remote sign-out ends this browser's push subscription first (source guard: before the refresh token and the session).
//   npx playwright test -c playwright.unit.config.ts tests/unit-fe-safety-fix-2520.spec.ts

const src = (rel: string) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');

test('FC-04: Enter confirms only on the confirm button', () => {
  expect(enterAnswer('confirm')).toBe('confirm');
  const never: EnterTarget[] = ['cancel', 'close', 'other', 'none'];
  for (const on of never) expect(enterAnswer(on), on).not.toBe('confirm');
});

test('FC-04: Enter on cancel or on the close button (X) answers no; inside the box it stays with the element; outside it is swallowed', () => {
  expect(enterAnswer('cancel')).toBe('cancel');
  expect(enterAnswer('close')).toBe('cancel');
  expect(enterAnswer('other')).toBe('pass');
  expect(enterAnswer('none')).toBe('ignore');
});

test('FC-04: the dialog decides Enter through the rule - the old "anything but cancel confirms" is gone', () => {
  const s = src('components/confirm-dialog.ts');
  expect(s).toContain("from './confirm-dialog-keys'");
  expect(s).toMatch(/enterAnswer\(this\.enterTarget\(\)\)/);
  expect(s).not.toMatch(/this\.answer\(\s*!\s*onCancel\s*\)/);
  expect(s).not.toMatch(/onCancel/);
  // the close button of sw-dialog is recognised as a "no", not as "not cancel"
  expect(s).toContain('[data-dialog-close]');
  expect(src('components/sw-dialog.ts')).toContain('data-dialog-close');
});

test('FC-04: a typed-confirmation reset submits only when valid and not already running (Enter in the field)', () => {
  for (const rel of ['components/sw-user-factors.ts', 'components/sw-second-factor.ts']) {
    const s = src(rel);
    expect(s, rel).toMatch(/private async reset\(\)[^{]*\{\s*if \(!this\.ready\(\) \|\| this\.busy\) return;/);
  }
  expect(src('screens/system-local-users.ts')).toMatch(/private async removePasskey\([^)]*\)[^{]*\{\s*const arm = this\.pkArm;\s*if \(!arm \|\| !this\.pkReady\(\) \|\| this\.busy\) return;/);
  // the WisKey-managed typed field confirms on Enter only while its phrase matches (unchanged, kept honest here)
  expect(src('screens/system-security-wiskey-managed.ts')).toMatch(/if \(e\.key === 'Enter' && ok\) void this\.confirm\(\);/);
});

test('FC-02: the remote sign-out ends this browser push subscription before the refresh token and the session', () => {
  const s = src('arx/auth.ts');
  const body = s.slice(s.indexOf('export async function logout('));
  const drop = body.indexOf('dropOnSignOut()');
  const revoke = body.indexOf('await revoke(t.refresh_token)');
  const session = body.indexOf("fetch('api/v1/auth/session', { method: 'DELETE'");
  expect(drop).toBeGreaterThan(0);
  expect(drop).toBeLessThan(revoke);
  expect(revoke).toBeLessThan(session);
  // loaded on demand and never allowed to fail the sign-out
  expect(body).toMatch(/await import\('\.\.\/pwa\/push-signout'\)\.then\(\(m\) => m\.dropOnSignOut\(\)\)\.catch\(\(\) => false\)/);
});

test('FC-02: dropOnSignOut deletes the server row then the browser subscription, bounded, with plain fetch, in a small module', () => {
  const s = src('pwa/push-signout.ts');
  const fn = s.slice(s.indexOf('export async function dropOnSignOut('));
  expect(fn).toContain("fetch(apiUrl('push/subscriptions'), { credentials: 'same-origin' })");
  expect(fn).toMatch(/method: 'DELETE'/);
  expect(fn).toContain('sub.unsubscribe()');
  expect(fn).toContain('Promise.race');
  expect(fn).not.toMatch(/\bdel\(|\bget\(/); // not api/client: a 401 must not start the refresh-and-reload path
  // the module stays small: no push settings, no PWA registration, no shell
  const imports = s.match(/^import .*$/gm) ?? [];
  expect(imports).toEqual(["import { apiUrl } from '../api/client';"]);
  // push.ts keeps exporting the same hash helper
  expect(src('pwa/push.ts')).toContain("import { endpointHash } from './push-signout';");
});
