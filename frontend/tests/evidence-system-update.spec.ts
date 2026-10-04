import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-021 S2 (self-update UI): the "עדכון זמין" marker of the user menu (only a holder of system.update sees it, and only a holder
// ever asks the server) and הגדרות › עדכונים (versions, last check, "בדוק אם יש עדכון", the interval, the release notes).
// Against a MOCKED backend (page.route on api/v1; npm run build first, the preview serves dist/) on the three projects
// (desktop, tablet, mobile). The server side (permission, rate limit, the fake infrastructure) is test_self_update.py.
// SW_SHOTS=1 writes evidence screenshots to docs/design/evidence/cr021-s2.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/cr021-s2');
const BASE_PERMS = ['video.live', 'video.playback', 'map.read', 'map.edit', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign'];
const ADMIN_PERMS = [...BASE_PERMS, 'system.update'];

interface UpdateMock {
  state: Record<string, unknown>;
  check: { status: number; body: Record<string, unknown>; headers?: Record<string, string> };
  stateCalls: number;
  checkCalls: number;
  intervals: number[];
}

const ENVELOPE = (code: string, user_message: string, details: Record<string, unknown> = {}) => ({ code, user_message, retryable: false, correlation_id: '', details });

function freshMock(): UpdateMock {
  return {
    state: { installed: '0.1.153', latest: '0.1.153', update_available: false, checked_at: '2026-10-02T08:00:00+00:00', check_result: 'current', interval_hours: 6, permitted: 'yes', notes: [], requires_platform_restart: false, run: null },
    check: { status: 200, body: { checked_at: '2026-10-02T09:00:00+00:00', check_result: 'current', installed: '0.1.153', latest: '0.1.153', update_available: false, refreshed: true } },
    stateCalls: 0,
    checkCalls: 0,
    intervals: [],
  };
}

async function mockBackend(page: Page, perms: string[], mock: UpdateMock) {
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'time.zone': 'Asia/Jerusalem' }, can_edit: true });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-02T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    if (p === 'system/update/state') {
      mock.stateCalls += 1;
      return json(perms.includes('system.update') ? mock.state : { update_available: false });
    }
    if (p === 'system/update/check' && req.method() === 'POST') {
      mock.checkCalls += 1;
      return json(mock.check.body, mock.check.status, mock.check.headers);
    }
    if (p === 'system/update/settings' && req.method() === 'PUT') {
      const body = req.postDataJSON() as { interval_hours: number };
      mock.intervals.push(body.interval_hours);
      mock.state = { ...mock.state, interval_hours: body.interval_hours };
      return json({ interval_hours: body.interval_hours });
    }
    return json(ENVELOPE('not_found', 'לא נמצא (בדיקה)'), 404);
  });
}

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(700);
}

const isPhone = () => test.info().project.name === 'mobile';

async function openMenu(page: Page) {
  await page.locator(isPhone() ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]').click();
  await expect(page.locator('sw-user-menu [data-user-menu]')).toBeVisible();
}

async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

const pageRoot = (page: Page) => page.locator('system-update [data-system-update]');
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

test.describe('user menu marker (CR-021 S2)', () => {
  test('a system administrator sees "עדכון זמין" when an update exists, and it opens the updates page', async ({ page }) => {
    const mock = freshMock();
    mock.state = { ...mock.state, latest: '0.1.154', update_available: true, check_result: 'available' };
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/devices/building');
    await openMenu(page);
    const row = page.locator('sw-user-menu [data-menu-update]');
    await expect(row).toBeVisible();
    await expect(row).toContainText('עדכון זמין');
    expect(mock.stateCalls).toBeGreaterThan(0);
    await shot(page, 'menu-marker');
    await row.click();
    await expect(page).toHaveURL(/#\/system\/update/);
    await expect(pageRoot(page)).toBeVisible({ timeout: 15000 });
    await expect(page.locator('sw-user-menu [data-user-menu]')).toBeHidden();
  });

  test('no marker for an administrator while the system is current', async ({ page }) => {
    const mock = freshMock();
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/devices/building');
    await openMenu(page);
    await expect(page.locator('sw-user-menu [data-menu-settings]')).toBeVisible();
    await expect(page.locator('sw-user-menu [data-menu-update]')).toHaveCount(0);
  });

  test('a user without system.update sees nothing, never asks the server, and gets no updates tab', async ({ page }) => {
    const mock = freshMock();
    mock.state = { ...mock.state, latest: '0.1.154', update_available: true };
    await mockBackend(page, BASE_PERMS, mock);
    await open(page, '/devices/building');
    await openMenu(page);
    await expect(page.locator('sw-user-menu [data-menu-settings]')).toBeVisible();
    await expect(page.locator('sw-user-menu [data-menu-update]')).toHaveCount(0);
    expect(mock.stateCalls).toBe(0);
    await page.keyboard.press('Escape');
    await open(page, '/system/diagnostics');
    await expect(page.locator('sw-app a[href="#/system/update"]')).toHaveCount(0);
  });
});

test.describe('settings page (CR-021 S2)', () => {
  test('the administrator has an "עדכונים" tab among the settings tabs', async ({ page }) => {
    await mockBackend(page, ADMIN_PERMS, freshMock());
    await open(page, '/system/diagnostics');
    await expect(page.locator('sw-app a[href="#/system/update"]').first()).toBeAttached({ timeout: 15000 });
  });

  test('current: both versions, the last check with its result, and no release notes', async ({ page }) => {
    const mock = freshMock();
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    const root = pageRoot(page);
    await expect(root).toBeVisible({ timeout: 15000 });
    await expect(root.locator('[data-update-installed]')).toHaveText('0.1.153');
    await expect(root.locator('[data-update-latest]')).toHaveText('0.1.153');
    await expect(root.locator('[data-update-last]')).toContainText('עודכן');
    await expect(root.locator('[data-update-status="current"]')).toBeVisible();
    await expect(root.locator('[data-update-notes]')).toHaveCount(0);
    await expect(root.locator('[data-update-check]')).toContainText('בדוק אם יש עדכון');
    await expect(root.locator('[data-update-interval-option="6"]')).toHaveAttribute('aria-pressed', 'true');
    await noOverflow(page);
    await shot(page, 'page-current');
  });

  test('never checked: a plain "not checked yet" and no latest version', async ({ page }) => {
    const mock = freshMock();
    mock.state = { ...mock.state, latest: null, checked_at: null, check_result: null };
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    const root = pageRoot(page);
    await expect(root).toBeVisible({ timeout: 15000 });
    await expect(root.locator('[data-update-status="never"]')).toHaveText('טרם בוצעה בדיקה');
    await expect(root.locator('[data-update-last]')).toHaveText('טרם בוצעה בדיקה');
    await expect(root.locator('[data-update-latest]')).toHaveText('—');
    await noOverflow(page);
    await shot(page, 'page-never');
  });

  test('available: the new version, the empty release-notes list says there are no details, and the apply button (S3)', async ({ page }) => {
    const mock = freshMock();
    mock.state = { ...mock.state, latest: '0.1.154', update_available: true, check_result: 'available' };
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    const root = pageRoot(page);
    await expect(root.locator('[data-update-latest]')).toHaveText('0.1.154');
    await expect(root.locator('[data-update-status="available"]')).toContainText('יש גרסה חדשה');
    await expect(root.locator('[data-update-last]')).toContainText('יש עדכון');
    await expect(root.locator('[data-update-notes-empty]')).toHaveText('אין פירוט זמין');
    await expect(root.locator('[data-update-apply]')).toBeVisible();
    await noOverflow(page);
    await shot(page, 'page-available');
  });

  test('available with notes: each version with its Hebrew and English text', async ({ page }) => {
    const mock = freshMock();
    mock.state = { ...mock.state, latest: '0.1.154', update_available: true, check_result: 'available', notes: [{ version: '0.1.154', he: 'נוסף מסך עדכונים', en: 'Added the updates screen' }] };
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    const note = pageRoot(page).locator('[data-update-note]');
    await expect(note).toHaveCount(1);
    await expect(note).toContainText('0.1.154');
    await expect(note).toContainText('נוסף מסך עדכונים');
    await expect(note).toContainText('Added the updates screen');
    await noOverflow(page);
  });

  test('a manual check updates the page and the menu marker without a reload', async ({ page }) => {
    const mock = freshMock();
    mock.check.body = { checked_at: '2026-10-02T09:00:00+00:00', check_result: 'available', installed: '0.1.153', latest: '0.1.154', update_available: true, refreshed: true };
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    const root = pageRoot(page);
    await expect(root.locator('[data-update-status="current"]')).toBeVisible({ timeout: 15000 });
    await root.locator('[data-update-check]').click();
    await expect(root.locator('[data-update-latest]')).toHaveText('0.1.154');
    await expect(root.locator('[data-update-status="available"]')).toBeVisible();
    expect(mock.checkCalls).toBe(1);
    await expect(root.locator('[data-update-degraded]')).toHaveCount(0);
    mock.state = { ...mock.state, latest: '0.1.154', update_available: true };
    await openMenu(page);
    await expect(page.locator('sw-user-menu [data-menu-update]')).toBeVisible();
  });

  test('429: a short wait message with the seconds, the page stays as it was', async ({ page }) => {
    const mock = freshMock();
    mock.check = { status: 429, headers: { 'Retry-After': '17' }, body: ENVELOPE('rate_limited', 'הבדיקה בוצעה זה עתה. נסו שוב בעוד רגע.', { retry_after_s: 17 }) };
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    const root = pageRoot(page);
    await expect(root.locator('[data-update-installed]')).toBeVisible({ timeout: 15000 });
    await root.locator('[data-update-check]').click();
    const msg = root.locator('[data-update-failure="rate_limited"]');
    await expect(msg).toContainText('נסו שוב בעוד 17 שניות');
    await expect(root.locator('[data-update-check]')).toBeEnabled();
    await expect(root.locator('[data-update-latest]')).toHaveText('0.1.153');
    await noOverflow(page);
    await shot(page, 'page-429');
  });

  test('503 platform_not_permitted: a Hebrew explanation that the platform permission is missing', async ({ page }) => {
    const mock = freshMock();
    mock.check = { status: 503, body: ENVELOPE('platform_not_permitted', 'ל-Arx אין הרשאה לבדוק עדכונים בתשתית המערכת.', { required_role: 'manager' }) };
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    const root = pageRoot(page);
    await expect(root.locator('[data-update-installed]')).toBeVisible({ timeout: 15000 });
    await root.locator('[data-update-check]').click();
    const msg = root.locator('[data-update-failure="not_permitted"]');
    await expect(msg).toContainText('חסרה הרשאה בתשתית המערכת');
    await noOverflow(page);
    await shot(page, 'page-503-not-permitted');
  });

  test('503 unreachable and a plain 502 are worded without the infrastructure answer', async ({ page }) => {
    const mock = freshMock();
    mock.check = { status: 503, body: ENVELOPE('infrastructure_unreachable', 'תשתית המערכת אינה זמינה.') };
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    const root = pageRoot(page);
    await expect(root.locator('[data-update-installed]')).toBeVisible({ timeout: 15000 });
    await root.locator('[data-update-check]').click();
    await expect(root.locator('[data-update-failure="unreachable"]')).toContainText('אינה זמינה');
    mock.check = { status: 502, body: ENVELOPE('infrastructure_error', 'תשתית המערכת החזירה שגיאה.', { upstream_status: 500 }) };
    await root.locator('[data-update-check]').click();
    await expect(root.locator('[data-update-failure="error"]')).toContainText('שגיאה');
  });

  test('degrade: refresh refused but the read worked - the result is shown with a short note', async ({ page }) => {
    const mock = freshMock();
    mock.check.body = { checked_at: '2026-10-02T09:00:00+00:00', check_result: 'refresh_failed_read_ok', installed: '0.1.153', latest: '0.1.153', update_available: false, refreshed: false };
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    const root = pageRoot(page);
    await expect(root.locator('[data-update-installed]')).toBeVisible({ timeout: 15000 });
    await root.locator('[data-update-check]').click();
    await expect(root.locator('[data-update-degraded]')).toContainText('לא רועננה');
    await expect(root.locator('[data-update-status="current"]')).toBeVisible();
    await expect(root.locator('[data-update-failure]')).toHaveCount(0);
    await noOverflow(page);
    await shot(page, 'page-degrade');
  });

  test('the interval: six choices, the stored one marked, a choice is saved with PUT', async ({ page }) => {
    const mock = freshMock();
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    const root = pageRoot(page);
    await expect(root.locator('[data-update-interval-option]')).toHaveCount(6, { timeout: 15000 });
    await expect(root.locator('[data-update-interval-option]')).toContainText(['כבוי', 'כל שעה', 'כל 3 שעות', 'כל 6 שעות', 'כל 12 שעות', 'כל 24 שעות']);
    await root.locator('[data-update-interval-option="12"]').click();
    await expect(root.locator('[data-update-interval-option="12"]')).toHaveAttribute('aria-pressed', 'true');
    await root.locator('[data-update-interval-option="0"]').click();
    await expect(root.locator('[data-update-interval-option="0"]')).toHaveAttribute('aria-pressed', 'true');
    expect(mock.intervals).toEqual([12, 0]);
  });

  test('layout guard: no horizontal overflow, touch targets of 44 px on touch layouts, no platform wording', async ({ page }) => {
    const mock = freshMock();
    mock.state = { ...mock.state, latest: '0.1.154', update_available: true, check_result: 'available' };
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/system/update');
    const root = pageRoot(page);
    await expect(root.locator('[data-update-installed]')).toBeVisible({ timeout: 15000 });
    await noOverflow(page);
    const widths = await root.evaluate((el) => {
      const host = el.getBoundingClientRect();
      const out: string[] = [];
      for (const c of Array.from(el.querySelectorAll('*'))) {
        const r = c.getBoundingClientRect();
        if (r.width > 0 && (r.right > host.right + 1 || r.left < host.left - 1)) out.push(`${c.tagName.toLowerCase()} ${Math.round(r.left)}-${Math.round(r.right)} vs ${Math.round(host.left)}-${Math.round(host.right)}`);
      }
      return out;
    });
    expect(widths).toEqual([]);
    if (isPhone()) {
      const heights = await root.locator('[data-update-interval-option]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
    }
    const text = await root.evaluate((el) => el.textContent ?? '');
    expect(text).not.toMatch(/Home Assistant|Supervisor|Ingress|\bHA\b/i);
    await shot(page, 'page-layout');
  });

  test('the menu row has no platform wording either', async ({ page }) => {
    const mock = freshMock();
    mock.state = { ...mock.state, latest: '0.1.154', update_available: true };
    await mockBackend(page, ADMIN_PERMS, mock);
    await open(page, '/devices/building');
    await openMenu(page);
    const text = (await page.locator('sw-user-menu [data-menu-update]').textContent()) ?? '';
    expect(text).not.toMatch(/Home Assistant|Supervisor|Ingress|\bHA\b/i);
  });
});
