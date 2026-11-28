import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// FIX-SECURITY2-2570 (deep review 2.57 SA2-03): Settings > general > the installer branding and the brand colours. A failed first read of
// the stored values was silent and left an editable default form that saved over them (the installer profile: all four fields; the
// colours: both). Now the read error is shown with "try again", nothing is editable or savable until a read succeeded, and a save
// sends only what changed. Against a MOCKED backend (invented values, no secrets). A page spec (the built app or the Vite dev server):
//   SW_UNIT_PAGES=1 SW_BASE_URL=http://127.0.0.1:4173/ npx playwright test -c playwright.unit.config.ts tests/unit-brand-load-2570.spec.ts --workers=1
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (code: string, msg: string) => ({ code, user_message: msg, retryable: true, correlation_id: 'mock', details: {} });
const ADMIN = ['video.live', 'map.read', 'entity.state.read', 'devices.read', 'events.read', 'system.configure', 'rbac.assign', 'backup.manage'];
const ME = {
  user: { id: 'u-admin', username: 'admin', display_name: 'מנהלת', source: 'ingress' }, channel: 'local', remote: null, active: true, bindings: [],
  permissions_installation: ADMIN, permissions_any: ADMIN, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false,
  bootstrap_state: 'done', mode: 'full',
};
const STORED = { enabled: false, name: 'מתקין שמור בע"מ', contact: '03-5551234', accent: 'teal', logo: { light: null, dark: null }, logo_file: { light: null, dark: null }, files: { light: null, dark: null } };
const SETTINGS = { 'ui.design': 'a', 'time.zone': 'Asia/Jerusalem', 'ui.accent': 'purple', 'ui.toggle_on': 'orange' };
const HOME = '/?design=a&look=performance:full#/system/diagnostics';

interface Mock { failInstaller: boolean; failSettings: boolean; puts: unknown[]; patches: unknown[] }

async function mockApp(page: Page, m: Mock) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'brand/white-label' && method === 'GET') return m.failInstaller ? json(route, err('internal', 'שגיאת שרת (בדיקה)'), 500) : json(route, STORED);
    if (p === 'brand/white-label' && method === 'PUT') {
      const body = req.postDataJSON() as Record<string, unknown>;
      m.puts.push(body);
      return json(route, { ...STORED, ...body });
    }
    if (p === 'settings' && method === 'GET') return m.failSettings ? json(route, err('internal', 'שגיאת שרת (בדיקה)'), 500) : json(route, { settings: SETTINGS, can_edit: true, nvr_channels: 16, warnings: [] });
    if (p === 'settings' && method === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      m.patches.push(body);
      return json(route, { settings: { ...SETTINGS, ...body }, can_edit: true, nvr_channels: 16, warnings: [] });
    }
    if (p === 'me') return json(route, ME);
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'health') return json(route, { status: 'ok', version: 'test', mode: 'full' });
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-11-28T08:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });
    return json(route, err('not_found', 'לא נמצא (בדיקה)'), 404);
  });
}

test.describe('FIX-SECURITY2-2570 SA2-03: branding cards after a failed read', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'mobile' || info.project.name === 'tablet', 'behaviour, not layout: one viewport');
  });

  test('installer branding: the failed read is shown, nothing is editable or savable; after "try again" only the changed field is sent', async ({ page }) => {
    const m: Mock = { failInstaller: true, failSettings: false, puts: [], patches: [] };
    await mockApp(page, m);
    await page.goto(HOME);
    const card = page.locator('sw-app system-brand-installer');
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.locator('[data-wl-load-error]')).toBeVisible();
    await expect(card.locator('[data-wl-load-error]')).toContainText('מיתוג המתקין השמור לא נטען');
    await expect(card.locator('[data-wl-name]')).toBeDisabled();
    await expect(card.locator('[data-wl-contact]')).toBeDisabled();
    await expect(card.locator('[data-wl-accent] [data-accent="orange"]')).toBeDisabled();
    await expect(card.locator('[data-wl-save]')).toHaveAttribute('disabled', '');
    await expect(card.locator('[data-wl-readonly]')).toHaveCount(0); // a failed read is not "view only"
    m.failInstaller = false;
    await card.locator('[data-wl-retry]').click();
    await expect(card.locator('[data-wl-load-error]')).toHaveCount(0);
    await expect(card.locator('[data-wl-name]')).toBeEnabled();
    await expect(card.locator('[data-wl-name]')).toHaveValue(STORED.name);
    await card.locator('[data-wl-contact]').fill('03-7654321');
    await card.locator('[data-wl-save]').click();
    await expect.poll(() => m.puts).toEqual([{ contact: '03-7654321' }]); // never the whole (possibly default) form
  });

  test('brand colours: the failed read is shown, no swatch or save works; after "try again" only the changed colour is sent', async ({ page }) => {
    const m: Mock = { failInstaller: false, failSettings: false, puts: [], patches: [] };
    await mockApp(page, m);
    await page.goto('/?design=a&look=performance:full#/live/cameras');
    await page.waitForSelector('sw-app');
    m.failSettings = true; // the shell has read its settings; the card's own read fails
    await page.evaluate(() => { window.location.hash = '#/system/diagnostics'; });
    const card = page.locator('sw-app system-brand-colors');
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.locator('[data-brand-load-error]')).toBeVisible();
    await expect(card.locator('[data-brand-load-error]')).toContainText('צבעי המותג השמורים לא נטענו');
    await expect(card.locator('[data-brand-row="accent"] [data-brand-option="teal"]')).toBeDisabled();
    await expect(card.locator('[data-brand-row="toggle"] [data-brand-option="teal"]')).toBeDisabled();
    await expect(card.locator('[data-brand-save]')).toHaveAttribute('disabled', '');
    m.failSettings = false;
    await card.locator('[data-brand-retry]').click();
    await expect(card.locator('[data-brand-load-error]')).toHaveCount(0);
    await expect(card.locator('[data-brand-row="accent"] [data-brand-option="purple"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(card.locator('[data-brand-row="toggle"] [data-brand-option="orange"]')).toHaveAttribute('aria-pressed', 'true');
    await card.locator('[data-brand-row="accent"] [data-brand-option="teal"]').click();
    await card.locator('[data-brand-save]').click();
    await expect.poll(() => m.patches).toEqual([{ 'ui.accent': 'teal' }]); // the stored switch colour is never rewritten
  });
});

// The compare-page pictures (both cards after a failed read; on the base build they show the silent, editable default form):
//   SW_SHOTS_DIR=<dir> SW_UNIT_PAGES=1 SW_BASE_URL=... npx playwright test -c playwright.unit.config.ts tests/unit-brand-load-2570.spec.ts -g shots
const SHOTS = process.env.SW_SHOTS_DIR || '';
for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  test(`shots: the branding cards after a failed read, ${vp.name}`, async ({ page }) => {
    test.skip(!SHOTS, 'compare-page pictures only (SW_SHOTS_DIR)');
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const m: Mock = { failInstaller: true, failSettings: false, puts: [], patches: [] };
    await mockApp(page, m);
    await page.goto('/?design=a&look=performance:full#/live/cameras');
    await page.waitForSelector('sw-app');
    m.failSettings = true;
    await page.evaluate(() => { window.location.hash = '#/system/diagnostics'; });
    const cards = { installer: page.locator('sw-app system-brand-installer'), colors: page.locator('sw-app system-brand-colors') };
    await expect(cards.installer).toBeVisible({ timeout: 20_000 });
    await expect(cards.colors).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(800);
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.waitForTimeout(300);
      for (const [name, el] of Object.entries(cards)) {
        await el.scrollIntoViewIfNeeded();
        await el.screenshot({ path: path.join(SHOTS, `sa2-03-${name}-${vp.name}-${scheme}.png`) });
      }
    }
  });
}
