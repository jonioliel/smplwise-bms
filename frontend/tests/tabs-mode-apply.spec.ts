import { test, expect, type Page } from '@playwright/test';

// Owner bug 2026-10-02 (0.1.153): "I changed תצוגת לשוניות and nothing changed on the screens". Regression for the apply path against a
// mocked backend that behaves like the real one (settings PATCH, /me/prefs PUT with `stored`): every group, the precedence, a live change
// without a reload, and the settings card telling the truth (what is active per group and why; the phone-only note on a wide screen).
// Needs the Vite DEV server (imports /src/...):
//   $env:SW_API_PORT='59999'; npx vite --host 127.0.0.1 --port 5196   then
//   $env:SW_BASE_URL='http://127.0.0.1:5196/'; npx playwright test tabs-mode-apply --project=desktop --workers=1
const MODE_URL = '/src/shell/tabs-mode.ts';
const ADMIN = ['alarm.view', 'audit.read', 'devices.read', 'devices.control', 'entity.state.read', 'events.read', 'map.read', 'media.browse', 'media.control', 'media.read', 'rbac.assign', 'schedule.view', 'schedule.manage', 'sources.configure', 'system.configure', 'video.live', 'video.playback', 'access.read', 'automation.manage', 'script.run'];

type Server = { inst: { mode: string; groups: Record<string, string> }; own: { mode: string | null; groups: Record<string, string> | null } };

async function mock(page: Page, srv: Server) {
  await page.route('**/api/v1/**', (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: ADMIN, permissions_any: ADMIN, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    const prefs = () => {
      const stored: string[] = [];
      if (srv.own.mode) stored.push('ui.tabs_mode');
      if (srv.own.groups && Object.keys(srv.own.groups).length) stored.push('ui.tabs_mode_groups');
      return { prefs: { 'nav.order': ['devices', 'security', 'explore', 'multimedia', 'wiskey'], 'ui.tabs_mode': srv.own.mode, 'ui.tabs_mode_groups': srv.own.groups }, stored, updated_at: null };
    };
    if (p === 'me/prefs' && req.method() === 'PUT') {
      const b = req.postDataJSON() as Record<string, unknown>;
      if ('ui.tabs_mode' in b) srv.own.mode = b['ui.tabs_mode'] as string | null;
      if ('ui.tabs_mode_groups' in b) srv.own.groups = b['ui.tabs_mode_groups'] as Record<string, string> | null;
      return json(prefs());
    }
    if (p === 'me/prefs') return json(prefs());
    if (p === 'settings' && req.method() === 'PATCH') {
      const b = req.postDataJSON() as Record<string, unknown>;
      if ('ui.tabs_mode' in b) srv.inst.mode = b['ui.tabs_mode'] as string;
      if ('ui.tabs_mode_groups' in b) srv.inst.groups = b['ui.tabs_mode_groups'] as Record<string, string>;
    }
    if (p === 'settings') return json({ settings: { 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.tabs': {}, 'multimedia.enabled': 'true', 'schedules.enabled': 'true', 'automations.enabled': 'true', 'ui.tabs_mode': srv.inst.mode, 'ui.tabs_mode_groups': srv.inst.groups }, can_edit: true });
    if (p === 'multimedia/status') return json({ enabled: true, counts: { screens: 1, players: 2, groups: 1 } }); // the multimedia row draws its second tab once a player is reported
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

const fresh = (): Server => ({ inst: { mode: 'tabs', groups: {} }, own: { mode: null, groups: null } });

async function open(page: Page, hash: string, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('about:blank');
  await page.goto(`./?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1500); // the shell's loads of the settings and of /me/prefs
}

/** sw-dropdown elements in the shell's chrome (not the settings card's own preview). */
const chromeDropdowns = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const walk = (root: ParentNode, inCard: boolean) => {
      root.querySelectorAll('*').forEach((e) => {
        const card = inCard || e.tagName === 'SYSTEM-TABS-MODE';
        if (e.tagName === 'SW-DROPDOWN' && !card) out.push(e.parentElement?.getAttribute('group-label') ?? e.getAttribute('data-pair-chip') ?? 'dd');
        if (e.shadowRoot) walk(e.shadowRoot, card);
      });
    };
    walk(document, false);
    return out.length;
  });

const GROUP_ROUTES: Record<string, string> = { area: '/devices/areas', security: '/live', settings: '/system/diagnostics', multimedia: '/multimedia/screens' };

test.describe('every group follows the installation default on a phone, and nothing changes on a wide screen', () => {
  for (const [group, hash] of Object.entries(GROUP_ROUTES)) {
    test(`group ${group}: default dropdown -> the real row is a dropdown (phone, after a reload); tabs; wide screen unchanged`, async ({ page }) => {
      const srv = fresh();
      srv.inst.groups = { [group]: 'dropdown' };
      await mock(page, srv);
      await open(page, hash, 390);
      expect(await chromeDropdowns(page)).toBeGreaterThan(0);
      await page.reload();
      await page.waitForSelector('sw-app');
      await page.waitForTimeout(1500);
      expect(await chromeDropdowns(page)).toBeGreaterThan(0);
      await open(page, hash, 1280);
      expect(await chromeDropdowns(page)).toBe(0);
      srv.inst.groups = {};
      await open(page, hash, 390);
      expect(await chromeDropdowns(page)).toBe(0);
    });
  }

  test('group home (the areas chip row): default dropdown replaces the chips', async ({ page }) => {
    const srv = fresh();
    await mock(page, srv);
    await open(page, '/devices/building', 390);
    await page.evaluate(async (url) => (await import(/* @vite-ignore */ url)).setInstallationTabsMode({ 'ui.tabs_mode': 'tabs', 'ui.tabs_mode_groups': { home: 'dropdown' } }), MODE_URL);
    const mode = await page.evaluate(async (url) => (await import(/* @vite-ignore */ url)).tabModeOf('home', true), MODE_URL);
    expect(mode).toBe('dropdown');
    await page.evaluate(async (url) => (await import(/* @vite-ignore */ url)).setInstallationTabsMode({ 'ui.tabs_mode': 'tabs', 'ui.tabs_mode_groups': {} }), MODE_URL);
    expect(await page.evaluate(async (url) => (await import(/* @vite-ignore */ url)).tabModeOf('home', true), MODE_URL)).toBe('tabs');
  });
});

test.describe('precedence and live change', () => {
  test('a saved personal value beats a changed default, a personal group beats a personal global; the card names the source', async ({ page }) => {
    const srv = fresh();
    srv.own = { mode: 'tabs', groups: { security: 'tabs' } }; // an earlier experiment, still stored
    await mock(page, srv);
    await open(page, '/system/diagnostics?tab=tabs', 390);
    const card = page.locator('system-tabs-mode');
    await card.locator('[data-tabs-mode-installation] input[data-mode=dropdown]').check();
    await expect.poll(() => srv.inst.mode).toBe('dropdown');
    // the personal values still win: the card says so, and the real rows did not change
    await expect(card.locator('[data-effective-group=security]')).toHaveAttribute('data-source', 'own-group');
    await expect(card.locator('[data-effective-group=area]')).toHaveAttribute('data-source', 'own');
    await expect(card.locator('[data-effective-group=area]')).toHaveAttribute('data-mode', 'tabs');
    expect(await chromeDropdowns(page)).toBe(0);
    // dropping the personal choices: the default reaches every group at once, without a reload
    await card.locator('[data-own-reset]').click();
    await expect.poll(() => srv.own.mode).toBe(null);
    for (const g of ['home', 'area', 'multimedia', 'security', 'settings']) {
      await expect(card.locator(`[data-effective-group=${g}]`)).toHaveAttribute('data-mode', 'dropdown');
      await expect(card.locator(`[data-effective-group=${g}]`)).toHaveAttribute('data-source', 'installation');
    }
    await expect.poll(() => chromeDropdowns(page)).toBeGreaterThan(0); // the settings tab row of this very screen
    await expect(card.locator('[data-own-reset]')).toHaveCount(0);
  });

  test('a change in the card reaches the other screens of the same session (no reload)', async ({ page }) => {
    const srv = fresh();
    await mock(page, srv);
    await open(page, '/system/diagnostics?tab=tabs', 390);
    await page.locator('system-tabs-mode [data-tabs-mode-installation] input[data-mode=dropdown]').check();
    await expect.poll(() => srv.inst.mode).toBe('dropdown');
    await page.evaluate(() => (location.hash = '#/live'));
    await page.waitForTimeout(800);
    expect(await chromeDropdowns(page)).toBeGreaterThan(0);
    await page.evaluate(async (url) => (await import(/* @vite-ignore */ url)).saveOwnTabsMode('tabs', {}), MODE_URL);
    await expect.poll(() => chromeDropdowns(page)).toBe(0); // the personal choice wins at once
  });

  test('the resolver: personal group > personal global > default group > default global > tabs; a wide screen is tabs', async ({ page }) => {
    await mock(page, fresh());
    await open(page, '/devices/building', 390);
    const rows = await page.evaluate(async (url) => {
      const m = await import(/* @vite-ignore */ url);
      const at = (g: string) => [m.tabModeOf(g, true), m.tabModeOf(g, false)];
      const out: Record<string, unknown> = {};
      m.setInstallationTabsMode({ 'ui.tabs_mode': 'hybrid', 'ui.tabs_mode_groups': { settings: 'dropdown' } });
      await m.saveOwnTabsMode(null, {});
      out.install = [at('area'), at('settings')];
      await m.saveOwnTabsMode('tabs', {});
      out.ownGlobal = [at('area'), at('settings')];
      await m.saveOwnTabsMode('tabs', { settings: 'hybrid' });
      out.ownGroup = [at('area'), at('settings')];
      return out;
    }, MODE_URL);
    expect(rows.install).toEqual([['hybrid', 'tabs'], ['dropdown', 'tabs']]);
    expect(rows.ownGlobal).toEqual([['tabs', 'tabs'], ['tabs', 'tabs']]);
    expect(rows.ownGroup).toEqual([['tabs', 'tabs'], ['hybrid', 'tabs']]);
  });
});

test.describe('the settings card tells the truth', () => {
  test('on a wide screen it says the mode applies on the phone; on a phone it does not; every group is listed with its mode', async ({ page }) => {
    const srv = fresh();
    srv.inst = { mode: 'dropdown', groups: {} };
    await mock(page, srv);
    await open(page, '/system/diagnostics?tab=tabs', 1280);
    const card = page.locator('system-tabs-mode');
    await expect(card.locator('[data-tabs-mode-wide]')).toBeVisible();
    await expect(card.locator('[data-effective-group]')).toHaveCount(5);
    await expect(card.locator('[data-effective-group=security]')).toHaveAttribute('data-mode', 'dropdown');
    await page.setViewportSize({ width: 390, height: 844 }); // live: the note leaves when the screen becomes a phone
    await expect(card.locator('[data-tabs-mode-wide]')).toHaveCount(0);
  });

  test('the personal "reset" button clears both keys on the server', async ({ page }) => {
    const srv = fresh();
    srv.own = { mode: 'hybrid', groups: { area: 'dropdown' } };
    await mock(page, srv);
    await open(page, '/system/diagnostics?tab=tabs', 390);
    await page.locator('system-tabs-mode [data-own-reset]').click();
    await expect.poll(() => [srv.own.mode, srv.own.groups]).toEqual([null, null]);
  });
});
