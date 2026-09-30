import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Owner 2026-09-30: the phone UX guards are OPTIONS (הגדרות › כללי › אפשרויות נייד, setting `ui.mobile`, installation-wide):
// each one hides one kind of management on a phone (< 768 px) and the hidden screens show one clean state ("עריכת מבנה
// וקומות זמינה במחשב בלבד" / "הפעולה הזו זמינה במחשב בלבד") with a way back. Defaults while the setting is absent: the
// structure guard and the control-images button on, everything else off. A UX guard, NOT a security boundary.
// Against a MOCKED backend (page.route on api/v1; npm run build first, the preview serves dist/). The demo-data half of this
// feature (sites / floors screens, the user menu, the resize crossing) is tests/evidence-mobile-structure.spec.ts.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/UIR2-mobile');
const PHONE = { width: 390, height: 780 };
const DESKTOP = { width: 1280, height: 800 };
const GUARD = 'עריכת מבנה וקומות זמינה במחשב בלבד';
const DESKTOP_ONLY = 'הפעולה הזו זמינה במחשב בלבד';
const ALL_PERMS = ['video.live', 'video.playback', 'video.export', 'map.read', 'map.edit', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign'];
const OFF = { hide_structure: false, hide_layout_editor: false, hide_wall_arrange: false, hide_settings_writes: false, hide_permissions: false, hide_control_images: false };
const DEFAULTS = { hide_structure: true, hide_layout_editor: false, hide_wall_arrange: false, hide_settings_writes: false, hide_permissions: false, hide_control_images: true };

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(900);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

async function mockBackend(page: Page, mobile: Record<string, boolean> | null) {
  const state = { mobile, patches: [] as Record<string, unknown>[] };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: ALL_PERMS, permissions_any: ALL_PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    if (p === 'settings' && req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      state.patches.push(body);
      if (body['ui.mobile']) state.mobile = { ...DEFAULTS, ...(body['ui.mobile'] as Record<string, boolean>) };
    }
    if (p === 'settings') {
      const settings: Record<string, unknown> = { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false' };
      if (state.mobile) settings['ui.mobile'] = state.mobile;
      return json({ settings, can_edit: true });
    }
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
  return state;
}

test.describe('phone options (ui.mobile)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
  });

  test('defaults while the setting is absent: the plan editor is refused, the permissions screen is not', async ({ page }) => {
    await mockBackend(page, null);
    await open(page, '/explore/floors/f1/edit');
    await expect(page.locator('sw-app [data-desktop-only="structure"]')).toContainText(GUARD);
    await open(page, '/system/access');
    await expect(page.locator('sw-app [data-desktop-only]')).toHaveCount(0);
    await expect(page.locator('sw-app system-access')).toHaveCount(1);
  });

  test('each option refuses its own screens with a clean state and a way back - at phone width only', async ({ page }) => {
    const cases = [
      { option: 'hide_structure', route: '/explore/floors/f1/edit', text: GUARD, kind: 'structure' },
      { option: 'hide_structure', route: '/explore/floors/f1/import', text: GUARD, kind: 'structure' },
      { option: 'hide_permissions', route: '/system/access', text: DESKTOP_ONLY, kind: 'permissions' },
      { option: 'hide_settings_writes', route: '/system/schedules', text: DESKTOP_ONLY, kind: 'settings_writes' },
      { option: 'hide_settings_writes', route: '/system/entities', text: DESKTOP_ONLY, kind: 'settings_writes' },
      { option: 'hide_settings_writes', route: '/system/security/manage', text: DESKTOP_ONLY, kind: 'settings_writes' },
    ];
    for (const c of cases) {
      await mockBackend(page, { ...OFF, [c.option]: true });
      await open(page, c.route);
      const guard = page.locator(`sw-app [data-desktop-only="${c.kind}"]`);
      await expect(guard, `${c.route} with ${c.option}`).toContainText(c.text);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      await guard.locator('[data-desktop-only-back]').click();
      await expect.poll(() => page.evaluate(() => location.hash)).not.toBe(`#${c.route}`);
      await page.unroute('**/api/v1/**');
    }
    await mockBackend(page, { ...OFF, hide_permissions: true, hide_settings_writes: true });
    await open(page, '/system/access');
    await shot(page, 'mobile-options-guard-permissions');
    // an option that is on changes nothing on a wide screen
    await page.setViewportSize(DESKTOP);
    await open(page, '/system/access');
    await expect(page.locator('sw-app [data-desktop-only]')).toHaveCount(0);
    await expect(page.locator('sw-app system-access')).toHaveCount(1);
    // ... and the option off leaves the phone's route alone
    await page.unroute('**/api/v1/**');
    await mockBackend(page, { ...OFF, hide_permissions: true });
    await page.setViewportSize(PHONE);
    await open(page, '/system/schedules');
    await expect(page.locator('sw-app [data-desktop-only]')).toHaveCount(0);
  });

  test('the settings card lists the six options, shows the defaults, and saves the whole object', async ({ page }) => {
    const mock = await mockBackend(page, null);
    await open(page, '/system/diagnostics');
    const card = page.locator('system-diagnostics system-mobile-options [data-mobile-options]');
    await expect(card).toBeVisible({ timeout: 15000 });
    const labels = ['הסתרת ניהול אתרים, מבנים וקומות בנייד', 'הסתרת כפתור תמונות בקרה בנייד', 'הסתרת עורך פריסת האזור בנייד', 'הסתרת סידור קיר המצלמות בנייד', 'הסתרת מסכי הגדרות שיוצרים או מוחקים בנייד', 'הסתרת ניהול הרשאות ותפקידים בנייד'];
    await expect(card.locator('[data-mobile-option] .lbl')).toHaveText(labels);
    const on = async (k: string) => (await card.locator(`[data-mobile-toggle="${k}"]`).getAttribute('checked')) !== null;
    expect([await on('structure'), await on('control_images'), await on('layout_editor'), await on('wall_arrange'), await on('settings_writes'), await on('permissions')]).toEqual([true, true, false, false, false, false]);
    await expect(card.locator('[data-mobile-save] button')).toBeDisabled();
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'mobile-options-card');
    await card.locator('[data-mobile-toggle="wall_arrange"]').click();
    await card.locator('[data-mobile-toggle="structure"]').click();
    await card.locator('[data-mobile-save]').click();
    await expect(card.locator('[data-mobile-message]')).toHaveText('האפשרויות נשמרו');
    expect(mock.patches).toEqual([{ 'ui.mobile': { hide_structure: false, hide_layout_editor: false, hide_wall_arrange: true, hide_settings_writes: false, hide_permissions: false, hide_control_images: true } }]);
    // saving applies at once, without a reload: the plan editor now opens on this phone
    await page.evaluate(() => (location.hash = '#/explore/floors/f1/edit'));
    await expect(page.locator('sw-app [data-desktop-only]')).toHaveCount(0);
    await expect(page.locator('sw-app explore-plan-editor')).toHaveCount(1);
  });
});
