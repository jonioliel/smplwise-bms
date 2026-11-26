import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// CLIENT-RESILIENCE-2540 on the built app with a MOCKED backend (invented users, no secrets):
//  - review FC-06: the server names its version in the hello of /me/ws; another version than this bundle's shows the quiet update card
//    ("גרסה חדשה של Arx זמינה" + "רענון") - nothing reloads by itself; the same version, or no version, shows nothing.
//  - review SCR-23 (step-up ON in the mock; it ships OFF): the step-up dialog names the refused action, says it will close, closes by
//    itself after 90 s (the request is not re-sent) and on a route change.
//   npx playwright test tests/evidence-client-resilience-2540.spec.ts --project=desktop
// SW_SHOTS_DIR=<dir> also writes the compare page's pictures (desktop + phone, light + dark); they run on an older build too.

const OWN_BUILD = /^version:\s*"?([^"\s]+)"?/m.exec(fs.readFileSync(new URL('../../smplwise_vms/config.yaml', import.meta.url), 'utf8'))?.[1] ?? '';
const PERMS = ['video.live', 'map.read', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign'];
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (code: string, msg: string, details: Record<string, unknown> = {}) => ({ code, user_message: msg, retryable: false, correlation_id: 'mock', details });
const GOOD = '246810';

interface Mock {
  patches: Record<string, unknown>[];
  refused: number;
  verifies: number;
}

async function setup(page: Page, opts: { build?: string | null; action?: string } = {}): Promise<Mock> {
  const st: Mock = { patches: [], refused: 0, verifies: 0 };
  let until: string | null = null;
  const settings: Record<string, unknown> = { 'ui.design': 'a', 'security.second_factor_policy': 'optional', 'remote.policy': 'flag', 'security.step_up': 'on', 'security.step_up_minutes': 5, 'security.step_up_local': 'off' };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, (ws) => {
    const payload: Record<string, unknown> = { permissions_fingerprint: 'fp', permission_revision: 1, active: true };
    if (opts.build !== undefined && opts.build !== null) payload.build = opts.build;
    ws.send(JSON.stringify({ version: 1, type: 'hello', sequence: 1, subscription_id: 'u-admin', occurred_at: '2026-11-26T08:00:00Z', payload }));
  });
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me') return json(route, { user: { id: 'u-admin', username: 'admin', display_name: 'מנהל', source: 'ingress' }, channel: 'local', remote: null, active: true, bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל מערכת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'settings' && method === 'PATCH') {
      if (!until) {
        st.refused += 1;
        return json(route, err('step_up_required', 'לפני נטרול אזעקה, עקיפת חיישן או פתיחת דלת צריך לאשר שוב את הזהות.', { action: opts.action ?? 'door.open', methods: ['totp'], minutes: 5, verify_path: 'auth/step-up/verify' }), 403);
      }
      const body = req.postDataJSON() as Record<string, unknown>;
      st.patches.push(body);
      Object.assign(settings, body);
      return json(route, { settings, can_edit: true });
    }
    if (p === 'settings') return json(route, { settings, can_edit: true });
    if (p === 'auth/step-up' && method === 'GET') return json(route, { enabled: true, minutes: 5, local_channel: false, applies: true, reason: null, methods: ['totp'], valid_until: until });
    if (p === 'auth/step-up/verify' && method === 'POST') {
      st.verifies += 1;
      until = '2026-11-26T08:05:00+00:00';
      return json(route, { method: 'totp', minutes: 5, valid_until: until });
    }
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-11-26T08:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });
    if (p === 'auth/sessions') return json(route, { scope: 'all', can_manage: true, channel: 'local', sessions: [] });
    return json(route, err('not_found', 'לא נמצא (בדיקה)'), 404);
  });
  return st;
}

const REMOTE_TAB = '/?design=a#/system/diagnostics?tab=remote';
const dialog = (page: Page) => page.locator('sw-step-up-dialog');
const updateCard = (page: Page) => page.locator('arx-pwa-prompts [data-pwa-update]');

async function openAndSave(page: Page) {
  await page.goto(REMOTE_TAB);
  await page.waitForSelector('sw-app system-diagnostics');
  await page.locator('system-diagnostics select[data-set-remote="remote.policy"]').selectOption('any_role');
  await page.locator('system-diagnostics [data-save-remote]').click();
  await expect(dialog(page).locator('[data-step-up-code]')).toBeVisible();
}

test.describe('FC-06: an open page learns that the add-on was updated', () => {
  test('another version in the server hello shows the quiet update card; nothing reloads by itself', async ({ page }) => {
    expect(OWN_BUILD).toMatch(/^\d+\.\d+\.\d+/);
    await setup(page, { build: '9.99.0' });
    await page.goto('/?design=a#/system/diagnostics');
    await page.waitForSelector('sw-app system-diagnostics');
    await page.evaluate(() => ((window as unknown as { __sameDocument: boolean }).__sameDocument = true));
    await expect(updateCard(page)).toBeVisible();
    await expect(updateCard(page)).toContainText('גרסה חדשה של Arx זמינה');
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument === true)).toBe(true);
  });

  test('"אחר כך" hides the card until the next new version (kept per browser); the next version shows it again', async ({ page, context }) => {
    await setup(page, { build: '9.99.0' });
    await page.goto('/?design=a#/system/diagnostics');
    await page.waitForSelector('sw-app system-diagnostics');
    await expect(updateCard(page)).toBeVisible();
    await expect(updateCard(page).locator('[data-pwa-update-later]')).toHaveText('אחר כך');
    await updateCard(page).locator('[data-pwa-update-later]').click();
    await expect(updateCard(page)).toHaveCount(0);
    expect(await page.evaluate(() => window.localStorage.getItem('arx.pwa.update.later'))).toBe('9.99.0');
    await page.reload(); // the same new version: still put off
    await page.waitForSelector('sw-app system-diagnostics');
    await page.waitForTimeout(1500);
    await expect(updateCard(page)).toHaveCount(0);
    const next = await context.newPage(); // the same browser, the server on a newer version again
    await setup(next, { build: '9.100.0' });
    await next.goto('/?design=a#/system/diagnostics');
    await next.waitForSelector('sw-app system-diagnostics');
    await expect(updateCard(next)).toBeVisible();
  });

  test('"אחר כך" with no usable storage still hides the card on this page', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new Error('blocked');
      };
    });
    await setup(page, { build: '9.99.0' });
    await page.goto('/?design=a#/system/diagnostics');
    await page.waitForSelector('sw-app system-diagnostics');
    await updateCard(page).locator('[data-pwa-update-later]').click();
    await expect(updateCard(page)).toHaveCount(0);
  });

  for (const build of ['same', null] as const) {
    test(`${build === 'same' ? 'the same version' : 'a hello without a version (an older server)'}: no card`, async ({ page }) => {
      await setup(page, { build: build === 'same' ? OWN_BUILD : null });
      await page.goto('/?design=a#/system/diagnostics');
      await page.waitForSelector('sw-app system-diagnostics');
      await page.waitForTimeout(1500);
      await expect(updateCard(page)).toHaveCount(0);
    });
  }
});

test.describe('SCR-23: the step-up dialog names the action and does not live for ever', () => {
  test('a refused door opening: the dialog names it and says it will close; the right code re-sends once', async ({ page }) => {
    const mock = await setup(page, { action: 'door.open' });
    await openAndSave(page);
    await expect(dialog(page).locator('[data-step-up-action]')).toContainText('פתיחת דלת');
    await expect(dialog(page).locator('[data-step-up-text]')).toContainText('הזן את הקוד הנוכחי');
    await expect(dialog(page).locator('[data-step-up-text]')).not.toContainText('הגדרות');
    await expect(dialog(page).locator('[data-step-up-expiry]')).toContainText('90');
    await dialog(page).locator('[data-step-up-code]').fill(GOOD);
    await dialog(page).locator('[data-step-up-confirm]').click();
    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(() => mock.patches.length).toBe(1);
  });

  test('a settings refusal is named as a settings change', async ({ page }) => {
    await setup(page, { action: 'system.configure' });
    await openAndSave(page);
    await expect(dialog(page).locator('[data-step-up-action]')).toContainText('שינוי הגדרות');
  });

  test('left alone, the dialog closes by itself after 90 s and the refused request is never sent', async ({ page }) => {
    await page.clock.install();
    const mock = await setup(page, { action: 'door.open' });
    await openAndSave(page);
    await page.clock.fastForward(85_000);
    await expect(dialog(page).locator('[data-step-up-code]')).toBeVisible(); // still open just before
    await page.clock.fastForward(6_000);
    await expect(dialog(page)).toHaveCount(0);
    expect(mock.refused).toBe(1);
    expect(mock.verifies).toBe(0);
    expect(mock.patches).toEqual([]);
    await expect(page.locator('system-diagnostics .foot .err')).toContainText('לאשר שוב את הזהות');
  });

  test('another screen opened: the dialog closes and nothing is sent', async ({ page }) => {
    const mock = await setup(page, { action: 'door.open' });
    await openAndSave(page);
    await page.evaluate(() => (window.location.hash = '#/system/diagnostics?tab=health'));
    await expect(dialog(page)).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(mock.patches).toEqual([]);
    expect(mock.verifies).toBe(0);
  });
});

// ---------------------------------------------------------------- compare-page pictures (SW_SHOTS_DIR only; an older build too)

const SHOTS = process.env.SW_SHOTS_DIR || '';
for (const scheme of ['light', 'dark'] as const) {
  for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
    test(`shots: ${vp.name} ${scheme}`, async ({ page }) => {
      test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await setup(page, { build: '9.99.0', action: 'door.open' });
      await page.goto(REMOTE_TAB);
      await page.waitForSelector('sw-app system-diagnostics');
      if (scheme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(SHOTS, `update-${vp.name}-${scheme}.png`) });
    });
    test(`shots: step-up ${vp.name} ${scheme}`, async ({ page }) => {
      test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await setup(page, { build: OWN_BUILD, action: 'door.open' }); // no update card over the save button
      await page.goto(REMOTE_TAB);
      await page.waitForSelector('sw-app system-diagnostics');
      if (scheme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.locator('system-diagnostics select[data-set-remote="remote.policy"]').selectOption('any_role');
      await page.locator('system-diagnostics [data-save-remote]').click();
      await expect(dialog(page).locator('[data-step-up-code]')).toBeVisible();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(SHOTS, `stepup-${vp.name}-${scheme}.png`) });
    });
  }
}
