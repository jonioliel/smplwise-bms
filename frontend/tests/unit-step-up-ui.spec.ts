import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// MFA-STEPUP-TRAIN-2490 slice 2: the step-up code dialog and the step-up settings, against a MOCKED wire contract of
// smplwise/routers/second_factor.py (auth/step-up, auth/step-up/verify) and PATCH settings with the central gate's 403 (invented
// users, no secrets). Covered: the dialog opens on the gate's 403, a wrong code keeps it open with the server's message, the right
// code records a proof and the save is re-sent exactly once, cancel sends nothing more and shows the refusal, the off switch saves
// security.step_up = off and then nothing is asked, the settings card shows the three settings and the caller's confirmation.
//   SW_UNIT_PAGES=1 SW_BASE_URL=http://127.0.0.1:4173/ npx playwright test -c playwright.unit.config.ts tests/unit-step-up-ui.spec.ts --workers=1
// SW_SHOTS_DIR=<dir> also writes the before/after screenshots of the compare page (desktop + phone, light + dark).

const PERMS = ['video.live', 'map.read', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign'];
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (code: string, msg: string, details: Record<string, unknown> = {}) => ({ code, user_message: msg, retryable: false, correlation_id: 'mock', details });
const GOOD = '246810';

interface Mock {
  settings: Record<string, unknown>;
  patches: Record<string, unknown>[];
  refused: number;
  verifies: { code: string; action?: string }[];
  until: string | null;
}

async function setup(page: Page, over: Record<string, unknown> = {}): Promise<Mock> {
  const st: Mock = {
    settings: { 'ui.design': 'a', 'security.second_factor_policy': 'optional', 'remote.policy': 'flag', 'security.step_up': 'on', 'security.step_up_minutes': 5, 'security.step_up_local': 'off', ...over },
    patches: [], refused: 0, verifies: [], until: null,
  };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me') return json(route, { user: { id: 'u-admin', username: 'admin', display_name: 'מנהל', source: 'ingress' }, channel: 'local', remote: null, active: true, bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל מערכת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'settings' && method === 'PATCH') {
      const on = st.settings['security.step_up'] !== 'off';
      if (on && !st.until) {
        st.refused += 1;
        return json(route, err('step_up_required', 'לפני שינוי הגדרות, משתמשים או הרשאות צריך לאשר שוב את הזהות.', { action: 'system.configure', methods: ['totp'], minutes: Number(st.settings['security.step_up_minutes'] ?? 5), verify_path: 'auth/step-up/verify' }), 403);
      }
      const body = req.postDataJSON() as Record<string, unknown>;
      st.patches.push(body);
      st.settings = { ...st.settings, ...body };
      return json(route, { settings: st.settings, can_edit: true });
    }
    if (p === 'settings') return json(route, { settings: st.settings, can_edit: true });
    if (p === 'auth/step-up' && method === 'GET') {
      const on = st.settings['security.step_up'] !== 'off';
      return json(route, { enabled: on, minutes: Number(st.settings['security.step_up_minutes'] ?? 5), local_channel: st.settings['security.step_up_local'] === 'on', applies: on, reason: on ? null : 'off', methods: ['totp'], valid_until: on ? st.until : null });
    }
    if (p === 'auth/step-up/verify' && method === 'POST') {
      const body = req.postDataJSON() as { code: string; action?: string };
      st.verifies.push({ code: body.code, action: body.action });
      if (body.code !== GOOD) return json(route, err('second_factor_invalid', 'קוד האימות אינו נכון. בדוק את הקוד באפליקציית האימות ונסה שוב.'), 400);
      st.until = '2026-11-24T10:05:00+00:00';
      return json(route, { method: 'totp', minutes: 5, valid_until: st.until });
    }
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-11-24T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });
    if (p === 'auth/sessions') return json(route, { scope: 'all', can_manage: true, channel: 'local', sessions: [] });
    return json(route, err('not_found', 'לא נמצא (בדיקה)'), 404);
  });
  return st;
}

async function openRemote(page: Page) {
  await page.goto('/?design=a#/system/diagnostics?tab=remote');
  await page.waitForSelector('sw-app system-diagnostics');
  const card = page.locator('system-diagnostics [data-step-up-settings]');
  await expect(card).toBeVisible();
  return card;
}

const dialog = (page: Page) => page.locator('sw-step-up-dialog');
const save = (page: Page) => page.locator('system-diagnostics [data-save-remote]');

async function changeTitleLikeSetting(page: Page) {
  // any setting of the tab: the minutes field (5 -> 10)
  const minutes = page.locator('system-diagnostics input[data-set-step-up="security.step_up_minutes"]');
  await minutes.fill('10');
  await minutes.dispatchEvent('change');
  await expect(save(page)).not.toHaveAttribute('disabled', '');
}

test('the settings card shows the switch, the minutes and the local switch with the stored values and the own confirmation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setup(page);
  const card = await openRemote(page);
  await expect(card.locator('sw-toggle[data-set-step-up="security.step_up"]')).toHaveAttribute('checked', '');
  await expect(card.locator('input[data-set-step-up="security.step_up_minutes"]')).toHaveValue('5');
  await expect(card.locator('sw-toggle[data-set-step-up="security.step_up_local"]')).not.toHaveAttribute('checked', '');
  await expect(card.locator('[data-step-up-mine="none"]')).toContainText('לא מאושר כרגע');
  expect(errors).toEqual([]);
});

test('a wrong code keeps the dialog open with the message; the right code saves, the save is sent once more and only once', async ({ page }) => {
  const mock = await setup(page);
  await openRemote(page);
  await changeTitleLikeSetting(page);
  await save(page).click();
  const d = dialog(page);
  await expect(d.locator('[data-step-up-code]')).toBeVisible();
  await expect(d.locator('[data-step-up-window]')).toContainText('5');
  expect(mock.refused).toBe(1);

  await d.locator('[data-step-up-code]').fill('111111');
  await d.locator('[data-step-up-confirm]').click();
  await expect(d.locator('[data-step-up-error]')).toContainText('קוד האימות אינו נכון');
  await expect(d.locator('[data-step-up-code]')).toHaveValue('');
  expect(mock.patches).toEqual([]);

  await d.locator('[data-step-up-code]').fill(GOOD);
  await d.locator('[data-step-up-code]').press('Enter');
  await expect(d).toHaveCount(0);
  await expect.poll(() => mock.patches).toEqual([{ 'security.step_up_minutes': 10 }]);
  expect(mock.refused).toBe(1);
  expect(mock.verifies).toEqual([{ code: '111111', action: 'system.configure' }, { code: GOOD, action: 'system.configure' }]);
  await expect(page.locator('system-diagnostics .foot .ok')).toBeVisible();
  await expect(page.locator('system-diagnostics [data-step-up-mine="valid"]')).toBeVisible();
});

test('cancel sends nothing more and the save row shows the refusal; the change stays to try again', async ({ page }) => {
  const mock = await setup(page);
  await openRemote(page);
  await changeTitleLikeSetting(page);
  await save(page).click();
  const d = dialog(page);
  await expect(d.locator('[data-step-up-cancel]')).toBeVisible();
  await d.locator('[data-step-up-cancel]').click();
  await expect(d).toHaveCount(0);
  await expect(page.locator('system-diagnostics .foot .err')).toContainText('לאשר שוב את הזהות');
  expect(mock.patches).toEqual([]);
  expect(mock.verifies).toEqual([]);
  expect(mock.refused).toBe(1);
  await expect(save(page)).not.toHaveAttribute('disabled', '');
});

test('the off switch: switching step-up off is itself confirmed once, after that nothing is asked', async ({ page }) => {
  const mock = await setup(page);
  const card = await openRemote(page);
  await card.locator('sw-toggle[data-set-step-up="security.step_up"]').click();
  await expect(card.locator('input[data-set-step-up="security.step_up_minutes"]')).toBeDisabled();
  await save(page).click();
  await dialog(page).locator('[data-step-up-code]').fill(GOOD);
  await dialog(page).locator('[data-step-up-confirm]').click();
  await expect.poll(() => mock.patches).toEqual([{ 'security.step_up': 'off' }]);
  // off: the next change goes straight through, no dialog
  mock.until = null;
  await card.locator('sw-toggle[data-set-step-up="security.step_up"]').click();
  await save(page).click();
  await expect.poll(() => mock.patches.length).toBe(2);
  await expect(dialog(page)).toHaveCount(0);
  expect(mock.refused).toBe(1);
});

test('with step-up off on the server no dialog ever opens; the dependent fields are disabled', async ({ page }) => {
  const mock = await setup(page, { 'security.step_up': 'off' });
  const card = await openRemote(page);
  await expect(card.locator('[data-step-up-mine="off"]')).toBeVisible();
  await expect(card.locator('input[data-set-step-up="security.step_up_minutes"]')).toBeDisabled();
  await expect(card.locator('sw-toggle[data-set-step-up="security.step_up_local"]')).toHaveAttribute('disabled', '');
  await page.locator('system-diagnostics select[data-set-remote="remote.policy"]').selectOption('any_role');
  await save(page).click();
  await expect.poll(() => mock.patches).toEqual([{ 'remote.policy': 'any_role' }]);
  await expect(dialog(page)).toHaveCount(0);
  expect(mock.refused).toBe(0);
});

// ---------------------------------------------------------------- compare-page screenshots (SW_SHOTS_DIR only)

const SHOTS = process.env.SW_SHOTS_DIR || '';
for (const scheme of ['light', 'dark'] as const) {
  for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
    test(`shots: ${vp.name} ${scheme}`, async ({ page }) => {
      test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await setup(page);
      await page.goto('/?design=a#/system/diagnostics?tab=remote');
      await page.waitForSelector('sw-app system-diagnostics');
      if (scheme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      const base = path.join(SHOTS, `${vp.name}-${scheme}`);
      const policy = page.locator('system-diagnostics [data-second-factor-policy-row]');
      await expect(policy).toBeVisible();
      const card = page.locator('system-diagnostics [data-step-up-settings]');
      const hasCard = (await card.count()) > 0;
      await (hasCard ? card : policy).scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${base}-settings.png` });
      if (!hasCard) return; // the "before" build: no card, no dialog
      await card.locator('input[data-set-step-up="security.step_up_minutes"]').fill('10');
      await card.locator('input[data-set-step-up="security.step_up_minutes"]').dispatchEvent('change');
      await save(page).click();
      await expect(dialog(page).locator('[data-step-up-code]')).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${base}-dialog.png` });
      await dialog(page).locator('[data-step-up-code]').fill('111111');
      await dialog(page).locator('[data-step-up-confirm]').click();
      await expect(dialog(page).locator('[data-step-up-error]')).toBeVisible();
      await page.screenshot({ path: `${base}-dialog-error.png` });
    });
  }
}
