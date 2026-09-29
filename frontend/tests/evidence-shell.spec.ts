import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-013 (docs/changes/CR-013-SHELL.md): the app shell - the user avatar as the navigation's last item (side rail on a
// wide screen, bottom bar on the phone) with the user menu (התראות, סדר הלשוניות, מערכת, sign-out), no top bar on the
// phone, the security sections as a sticky row, a horizontally scrolling tab row, and a per-user tab order stored on
// the server. Two parts, both against the static preview (npm run build first):
//   1. the demo data (no backend);
//   2. a mocked backend (page.route on api/v1): users with and without permissions, open alerts, and GET/PUT /me/prefs
//      kept per user in the test - what the client does with them. The endpoint itself: backend tests/test_user_prefs.py.
//   SW_BASE_URL=http://127.0.0.1:4391/ npx playwright test tests/evidence-shell.spec.ts

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/CR013');
const TABS = ['ראשי', 'אבטחה', 'מפה', 'WisKey'];
const DEFAULT_ORDER = ['devices', 'security', 'explore', 'wiskey'];

function phone(info: { project: { name: string } }) {
  return info.project.name === 'mobile';
}

/** The navigation a user sees on this width: the bottom bar (phone) or the side rail. */
function navSel(info: { project: { name: string } }) {
  return phone(info) ? 'sw-app nav.bottom' : 'sw-app nav.rail';
}

function meButton(page: Page, info: { project: { name: string } }) {
  return page.locator(phone(info) ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]');
}

async function navTabs(page: Page, info: { project: { name: string } }): Promise<string[]> {
  return page.locator(`${navSel(info)} a[data-nav]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-nav') ?? ''));
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) });
}

async function open(page: Page, hash = '') {
  await page.goto('about:blank');
  await page.goto(`/?design=a${hash ? `#${hash}` : ''}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------------------------------------------------
test.describe('CR-013 shell on the demo data', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('cr013-keep')) localStorage.removeItem('sw.nav.order');
      } catch {
        /* storage unavailable */
      }
    });
  });

  test('bar order and names, the avatar last, no "מערכת" tab; the bare address lands on ראשי', async ({ page }, info) => {
    await open(page);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building');
    await expect(page.locator('sw-app devices-building')).toHaveCount(1);
    const nav = page.locator(navSel(info));
    await expect(nav).toBeVisible();
    await expect(nav.locator('a[data-nav]')).toHaveText(TABS);
    expect(await navTabs(page, info)).toEqual(DEFAULT_ORDER);
    await expect(nav.locator('a[data-nav="devices"]')).toHaveClass(/active/);
    await expect(nav.locator('a[data-nav="devices"]')).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('a[href^="#/system"]')).toHaveCount(0);
    // the avatar is the last item of the same bar
    const last = await nav.evaluate((el) => {
      const kids = Array.from(el.children).filter((c) => (c as HTMLElement).offsetParent !== null || getComputedStyle(c).display !== 'none');
      return (kids[kids.length - 1] as HTMLElement).className;
    });
    expect(last).toContain('me');
    // no bell anywhere; on the phone no top bar at all
    await expect(page.locator('sw-app sw-button.bell')).toHaveCount(0);
    if (phone(info)) {
      await expect(page.locator('sw-app header.topbar')).toBeHidden();
      await shot(page, 'shell-phone-home');
    } else {
      await expect(page.locator('sw-app header.topbar')).toBeVisible();
      await expect(page.locator('sw-app header.topbar sw-avatar')).toHaveCount(0);
      if (info.project.name === 'desktop') await shot(page, 'shell-desktop-rail');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('old deep links still open their screens (no redirect to ראשי)', async ({ page }) => {
    for (const [hash, tag] of [
      ['/explore/floors/f0', 'explore-floor-map'],
      ['/live/wall', 'live-wall'],
      ['/investigate/events', 'investigate-events'],
      ['/security/alarm', 'security-alarm'],
      ['/system/diagnostics', 'system-diagnostics'],
      ['/system/notifications', 'arx-notifications-settings'],
      ['/wiskey/overview', 'wiskey-overview'],
      ['/devices/building', 'devices-building'],
    ] as const) {
      await open(page, hash);
      await expect(page.locator(`sw-app ${tag}`), hash).toHaveCount(1);
      expect(await page.evaluate(() => location.hash), hash).toBe(`#${hash}`);
    }
  });

  test('the user menu: header, התראות first, סדר הלשוניות, מערכת; Escape closes it', async ({ page }, info) => {
    await open(page, '/devices/building');
    const me = meButton(page, info);
    await expect(me).toBeVisible();
    await expect(me).toHaveAttribute('aria-expanded', 'false');
    await me.click();
    const menu = page.locator('sw-app sw-user-menu [data-user-menu]');
    await expect(menu).toBeVisible();
    await expect(me).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.locator('[data-user-name]')).toHaveText('יוני');
    const items = menu.locator('ul a, ul button, ul summary');
    await expect(items.first()).toHaveAttribute('data-menu-alerts', '');
    await expect(menu.locator('[data-menu-nav-order]')).toBeVisible();
    await expect(menu.locator('[data-menu-settings]')).toHaveAttribute('href', '#/system/diagnostics');
    await expect(menu.locator('[data-menu-screens]')).toBeVisible();
    // the demo pill moved from the top bar into the menu's header on the phone
    if (phone(info)) await expect(menu.locator('[data-user-menu-pills]')).toBeVisible();
    else await expect(menu.locator('[data-user-menu-pills]')).toBeHidden();
    await page.waitForTimeout(300); // the sheet's slide-in
    await shot(page, phone(info) ? 'shell-phone-user-menu' : `shell-${info.project.name}-user-menu`);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(me).toHaveAttribute('aria-expanded', 'false');
    // מערכת from the menu opens the settings; the menu closes on navigation
    await me.click();
    await menu.locator('[data-menu-settings]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/system/diagnostics');
    await expect(menu).toBeHidden();
  });

  test('phone: the security sections as a sticky row and the tab row scrolls without clipping', async ({ page }, info) => {
    test.skip(!phone(info), 'the phone layout (390 px)');
    await open(page, '/live');
    const row = page.locator('sw-app nav[data-security-row]');
    await expect(row).toBeVisible();
    await expect(row.locator('a')).toHaveText(['לייב', 'חקירה', 'אזעקה']);
    await expect(row.locator('a[data-section="live"]')).toHaveAttribute('aria-current', 'page');
    for (const a of await row.locator('a').all()) expect((await a.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const tabs = page.locator('sw-app .subnav sw-tabs');
    await expect(tabs.locator('a')).toHaveText(['תמונת מצב', 'כל המצלמות', 'תצוגות שמורות', 'בריאות מצלמות']);
    // wider than the phone: it scrolls, and the hidden side fades
    expect(await tabs.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await expect(tabs).toHaveAttribute('data-fade', /left|both/);
    await shot(page, 'shell-phone-security');
    // the last tab scrolls fully into view
    const last = tabs.locator('a').last();
    await last.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const box = (await tabs.boundingBox())!;
    const lb = (await last.boundingBox())!;
    expect(lb.x).toBeGreaterThanOrEqual(box.x - 0.5);
    expect(lb.x + lb.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
    // the active tab is revealed on its own when it sits at the far end
    await open(page, '/system/devices');
    const on = page.locator('sw-app .subnav sw-tabs a.on');
    await expect(on).toHaveText('בריאות מצלמות');
    await page.waitForTimeout(200);
    const tb = (await page.locator('sw-app .subnav sw-tabs').boundingBox())!;
    const ob = (await on.boundingBox())!;
    expect(ob.x).toBeGreaterThanOrEqual(tb.x - 0.5);
    expect(ob.x + ob.width).toBeLessThanOrEqual(tb.x + tb.width + 0.5);
    // the row stays at the top while the content scrolls
    await open(page, '/live');
    await page.locator('sw-app main').evaluate((m) => m.scrollTo(0, 600));
    await page.waitForTimeout(200);
    expect((await page.locator('sw-app nav[data-security-row]').boundingBox())!.y).toBeLessThan(20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('tab order (this browser in the demo): by buttons, save, reload keeps it, reset', async ({ page }, info) => {
    await open(page, '/devices/building');
    await page.evaluate(() => sessionStorage.setItem('cr013-keep', '1'));
    await meButton(page, info).click();
    await page.locator('sw-app sw-user-menu [data-menu-nav-order]').click();
    const dlg = page.locator('sw-app sw-nav-order');
    await expect(dlg.locator('li[data-tab]')).toHaveCount(4);
    await expect(dlg.locator('li[data-tab] .name')).toHaveText(TABS);
    await page.waitForTimeout(250);
    if (phone(info)) await shot(page, 'shell-phone-tab-order');
    // WisKey to the top with the ▲ buttons, then אבטחה down one
    for (let i = 0; i < 3; i++) await dlg.locator('li[data-tab="wiskey"] [data-move="up"]').click();
    await dlg.locator('li[data-tab="security"] [data-move="down"]').click();
    await expect(dlg.locator('li[data-tab] .name')).toHaveText(['WisKey', 'ראשי', 'מפה', 'אבטחה']);
    await expect(dlg.locator('[data-nav-order-announce]')).toContainText('אבטחה הועבר למקום 4');
    await dlg.locator('[data-nav-order-save]').click();
    await expect(dlg.locator('sw-dialog')).toBeHidden();
    expect(await navTabs(page, info)).toEqual(['wiskey', 'devices', 'explore', 'security']);
    await page.reload();
    await page.waitForTimeout(500);
    expect(await navTabs(page, info)).toEqual(['wiskey', 'devices', 'explore', 'security']);
    // keyboard on the handle
    await meButton(page, info).click();
    await page.locator('sw-app sw-user-menu [data-menu-nav-order]').click();
    await dlg.locator('li[data-tab="explore"] .handle').focus();
    await page.keyboard.press('Home');
    await expect(dlg.locator('li[data-tab] .name')).toHaveText(['מפה', 'WisKey', 'ראשי', 'אבטחה']);
    await dlg.locator('[data-nav-order-reset]').click();
    await expect(dlg.locator('sw-dialog')).toBeHidden();
    expect(await navTabs(page, info)).toEqual(DEFAULT_ORDER);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// A mocked backend: who the user is, what they may do, their open alerts, and their stored preferences.

const ALL = ['video.live', 'video.playback', 'video.export', 'map.read', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'cases.manage', 'rules.manage', 'system.configure', 'sources.configure', 'rbac.assign', 'audit.read'];

interface MockUser {
  id: string;
  name: string;
  role: string;
  perms: string[];
}

const ADMIN: MockUser = { id: 'u-admin', name: 'יוני אוליאל', role: 'מנהל מערכת', perms: ALL };
const VIEWER: MockUser = { id: 'u-viewer', name: 'דנה כהן', role: 'צופה', perms: ['video.live', 'map.read', 'entity.state.read', 'devices.read', 'alarm.view', 'events.read'] };
const NO_ALERTS_VIEWER: MockUser = { id: 'u-guard', name: 'רון לוי', role: 'שומר', perms: ['video.live', 'devices.read'] };

class Mock {
  user: MockUser = ADMIN;
  alerts = 0;
  prefs = new Map<string, string[]>();
  puts: { user: string; body: Record<string, unknown> }[] = [];

  normalize(v: unknown): string[] {
    const seen: string[] = [];
    if (Array.isArray(v)) for (const x of v) if (DEFAULT_ORDER.includes(x) && !seen.includes(x)) seen.push(x);
    return [...seen, ...DEFAULT_ORDER.filter((t) => !seen.includes(t))];
  }

  prefsBody() {
    const stored = this.prefs.get(this.user.id);
    return { prefs: { 'nav.order': stored ?? DEFAULT_ORDER }, stored: stored ? ['nav.order'] : [], updated_at: stored ? '2026-09-30T00:00:00Z' : null };
  }

  async handle(route: Route) {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const u = this.user;
    if (p === 'me') {
      return json({
        channel: 'local', remote: null,
        user: { id: u.id, username: u.id, display_name: u.name, source: 'ingress' },
        active: true, bindings: [{ id: 'b1', role_id: 'r', role_name: u.role, scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: u.perms, permissions_any: u.perms, has_access: true, permission_revision: 1,
        permissions_fingerprint: `fp-${u.id}`, permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs' && req.method() === 'GET') return json(this.prefsBody());
    if (p === 'me/prefs' && req.method() === 'PUT') {
      const body = req.postDataJSON() as Record<string, unknown>;
      this.puts.push({ user: u.id, body });
      if (body['nav.order'] === null) this.prefs.delete(u.id);
      else if ('nav.order' in body) this.prefs.set(u.id, this.normalize(body['nav.order']));
      return json(this.prefsBody());
    }
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false' }, can_edit: u.perms.includes('system.configure') });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) {
      if (!u.perms.includes('events.read')) return json({ code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: '', details: {} }, 403);
      const alerts = Array.from({ length: this.alerts }, (_, i) => ({ id: `a${i}`, rule_id: 'r1', rule_name: 'אדם בלילה', event_id: `e${i}`, camera_id: null, entity_id: null, message: `התראה ${i + 1}`, reasons: [], fired_at: '2026-09-30T00:00:00Z', occurred_at: '2026-09-30T00:00:00Z', acked_at: null, acked_by_username: null }));
      return json({ alerts, unacked: this.alerts });
    }
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  }
}

test.describe('CR-013 shell with a (mocked) backend', () => {
  let mock: Mock;

  test.beforeEach(async ({ page }) => {
    mock = new Mock();
    await page.route('**/api/v1/**', (r) => mock.handle(r));
  });

  test('the bare address lands on ראשי; settings shown only with a settings permission; WisKey only with access.read', async ({ page }, info) => {
    await open(page);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building');
    expect(await navTabs(page, info)).toEqual(DEFAULT_ORDER);
    await meButton(page, info).click();
    const menu = page.locator('sw-app sw-user-menu [data-user-menu]');
    await expect(menu.locator('[data-user-name]')).toHaveText('יוני אוליאל');
    await expect(menu.locator('[data-user-role]')).toHaveText('מנהל מערכת');
    await expect(menu.locator('[data-menu-settings]')).toHaveCount(1);
    // a viewer: no settings item (their own notification preferences stay), no WisKey tab
    mock.user = VIEWER;
    await open(page);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building');
    expect(await navTabs(page, info)).toEqual(['devices', 'security', 'explore']);
    await meButton(page, info).click();
    await expect(menu.locator('[data-user-name]')).toHaveText('דנה כהן');
    await expect(menu.locator('[data-menu-settings]')).toHaveCount(0);
    await expect(menu.locator('[data-menu-notify-prefs]')).toHaveAttribute('href', '#/system/notifications');
    // a start screen the user does not see falls back to their first tab
    mock.user = { ...NO_ALERTS_VIEWER, perms: ['video.live'] };
    await open(page);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/live');
  });

  test('the red dot: open alerts put a dot and the count on the avatar; none without', async ({ page }, info) => {
    mock.alerts = 3;
    await open(page, '/devices/building');
    const me = meButton(page, info);
    await expect(me.locator('[data-alert-dot]')).toHaveCount(1);
    await expect(me).toHaveAttribute('aria-label', /3 התראות פתוחות/);
    await me.click();
    const menu = page.locator('sw-app sw-user-menu [data-user-menu]');
    await expect(menu.locator('[data-menu-alerts] [data-alert-count]')).toHaveText('3');
    await page.waitForTimeout(300);
    if (phone(info)) await shot(page, 'shell-phone-user-menu-alerts');
    else if (info.project.name === 'desktop') await shot(page, 'shell-desktop-user-menu-alerts');
    await menu.locator('[data-menu-alerts]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/investigate/rules?tab=alerts');
    // no open alerts: no dot, "0" in the menu
    mock.alerts = 0;
    await open(page, '/devices/building');
    await expect(meButton(page, info).locator('[data-alert-dot]')).toHaveCount(0);
    await expect(meButton(page, info)).not.toHaveAttribute('aria-label', /התראות פתוחות/);
    // a user who may not read alerts: no dot and no התראות item
    mock.user = NO_ALERTS_VIEWER;
    mock.alerts = 5;
    await open(page, '/devices/building');
    await expect(meButton(page, info).locator('[data-alert-dot]')).toHaveCount(0);
    await meButton(page, info).click();
    await expect(menu.locator('[data-menu-alerts]')).toHaveCount(0);
  });

  test('tab order per user on the server: drag, save, reload (server wins), a second user unaffected, reset', async ({ page }, info) => {
    await open(page, '/devices/building');
    await meButton(page, info).click();
    await page.locator('sw-app sw-user-menu [data-menu-nav-order]').click();
    const dlg = page.locator('sw-app sw-nav-order');
    await expect(dlg.locator('li[data-tab]')).toHaveCount(4);
    // drag מפה by its handle above ראשי
    const handle = dlg.locator('li[data-tab="explore"] .handle');
    const target = (await dlg.locator('li[data-tab="devices"]').boundingBox())!;
    const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    for (let y = hb.y + hb.height / 2; y > target.y + 4; y -= 12) await page.mouse.move(hb.x + hb.width / 2, y);
    await page.mouse.move(hb.x + hb.width / 2, target.y + 4);
    await page.mouse.up();
    await expect(dlg.locator('li[data-tab] .name')).toHaveText(['מפה', 'ראשי', 'אבטחה', 'WisKey']);
    await dlg.locator('[data-nav-order-save]').click();
    await expect.poll(() => mock.puts.length).toBe(1);
    expect(mock.puts[0]).toEqual({ user: 'u-admin', body: { 'nav.order': ['explore', 'devices', 'security', 'wiskey'] } });
    expect(await navTabs(page, info)).toEqual(['explore', 'devices', 'security', 'wiskey']);
    // another device: no local copy - the server's order applies
    await page.evaluate(() => localStorage.removeItem('sw.nav.order'));
    await open(page, '/devices/building');
    await expect.poll(() => navTabs(page, info)).toEqual(['explore', 'devices', 'security', 'wiskey']);
    // the server wins over a stale local copy
    mock.prefs.set('u-admin', ['wiskey', 'explore', 'devices', 'security']);
    await open(page, '/devices/building');
    await expect.poll(() => navTabs(page, info)).toEqual(['wiskey', 'explore', 'devices', 'security']);
    // a second user on the same browser: the default, not the first user's order
    mock.user = { ...ADMIN, id: 'u-second', name: 'מיכל' };
    await open(page, '/devices/building');
    await expect.poll(() => navTabs(page, info)).toEqual(DEFAULT_ORDER);
    // the first user resets
    mock.user = ADMIN;
    await open(page, '/devices/building');
    await expect.poll(() => navTabs(page, info)).toEqual(['wiskey', 'explore', 'devices', 'security']);
    await meButton(page, info).click();
    await page.locator('sw-app sw-user-menu [data-menu-nav-order]').click();
    await dlg.locator('[data-nav-order-reset]').click();
    await expect.poll(() => mock.puts.at(-1)).toEqual({ user: 'u-admin', body: { 'nav.order': null } });
    expect(await navTabs(page, info)).toEqual(DEFAULT_ORDER);
    expect(mock.prefs.has('u-second')).toBe(false);
  });

  test('a hidden tab keeps its place in the stored order', async ({ page }, info) => {
    mock.user = VIEWER; // no WisKey
    mock.prefs.set('u-viewer', ['wiskey', 'explore', 'devices', 'security']);
    await open(page, '/devices/building');
    await expect.poll(() => navTabs(page, info)).toEqual(['explore', 'devices', 'security']);
    await meButton(page, info).click();
    await page.locator('sw-app sw-user-menu [data-menu-nav-order]').click();
    const dlg = page.locator('sw-app sw-nav-order');
    await expect(dlg.locator('li[data-tab]')).toHaveCount(3);
    await dlg.locator('li[data-tab="security"] [data-move="up"]').click();
    await dlg.locator('[data-nav-order-save]').click();
    await expect.poll(() => mock.puts.at(-1)?.body).toEqual({ 'nav.order': ['wiskey', 'explore', 'security', 'devices'] });
  });
});
