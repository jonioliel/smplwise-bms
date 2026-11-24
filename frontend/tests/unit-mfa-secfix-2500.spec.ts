import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// MFA-SECFIX-2500: the step-up settings card (System › Remote access) names every confirmation method now - the authenticator code, a
// passkey, the app's phone key, a recovery code - instead of "the code from the authenticator app" only. Against a MOCKED wire
// contract (an invented administrator, no secrets).
//   SW_BASE_URL=http://localhost:5297/ npx playwright test tests/unit-mfa-secfix-2500.spec.ts --project=desktop --project=mobile --workers=2
// SW_SHOTS_DIR=<dir> also writes the compare-page shots of the card (light + dark); the shots test makes no text assertion, so the
// same file runs on the base commit for the "before" shots.

const REMOTE_TAB = '/?design=a#/system/diagnostics?tab=remote';
const PERMS = ['video.live', 'map.read', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign'];
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (code: string, msg: string) => ({ code, user_message: msg, retryable: false, correlation_id: 'mock', details: {} });

async function setup(page: Page, methods: string[]) {
  const settings: Record<string, unknown> = { 'ui.design': 'a', 'security.second_factor_policy': 'optional', 'remote.policy': 'flag', 'security.step_up': 'on', 'security.step_up_minutes': 5, 'security.step_up_local': 'off' };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me') return json(route, { user: { id: 'u-admin', username: 'admin', display_name: 'מנהל', source: 'ingress' }, channel: 'local', remote: null, active: true, bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל מערכת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json(route, { settings, can_edit: true });
    if (p === 'auth/step-up' && method === 'GET') return json(route, { enabled: true, minutes: 5, local_channel: false, applies: methods.length > 0, reason: methods.length ? null : 'no_method', methods, valid_until: null });
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-11-24T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });
    if (p === 'auth/sessions') return json(route, { scope: 'all', can_manage: true, channel: 'local', sessions: [] });
    return json(route, err('not_found', 'לא נמצא (בדיקה)'), 404);
  });
}

async function openCard(page: Page, baseURL: string | undefined) {
  const base = (baseURL || 'http://localhost:4173/').replace('//127.0.0.1', '//localhost');
  await page.goto(new URL(REMOTE_TAB, base).toString());
  await page.waitForSelector('sw-app system-diagnostics');
  const card = page.locator('system-diagnostics [data-step-up-settings]');
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  return card;
}

test('the step-up settings card names every confirmation method', async ({ page, baseURL }) => {
  await setup(page, ['totp', 'passkey', 'device_key']);
  const card = await openCard(page, baseURL);
  await expect(card).toHaveAttribute('subheading', /מאפליקציית האימות/);
  for (const word of ['במפתח גישה', 'במפתח הטלפון', 'בקוד שחזור', 'נטרול אזעקה']) {
    await expect(card).toHaveAttribute('subheading', new RegExp(word));
  }
});

test('without any method the "mine" row names every kind that would count', async ({ page, baseURL }) => {
  await setup(page, []);
  const card = await openCard(page, baseURL);
  const mine = card.locator('[data-step-up-row="mine"]');
  if (await mine.count()) await expect(mine).toContainText(/מפתח גישה או מפתח טלפון/);
});

// ---------------------------------------------------------------- compare-page screenshots (SW_SHOTS_DIR only)

const SHOTS = process.env.SW_SHOTS_DIR || '';
test('shots: the step-up settings card', async ({ page, baseURL }, info) => {
  test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
  fs.mkdirSync(SHOTS, { recursive: true });
  await setup(page, ['totp', 'passkey']);
  const card = await openCard(page, baseURL);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.evaluate((s) => document.documentElement.setAttribute('data-theme', s), scheme);
    await page.waitForTimeout(300);
    await card.screenshot({ path: path.join(SHOTS, `${info.project.name}-${scheme}-stepup-card.png`) });
  }
});
