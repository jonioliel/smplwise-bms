import { test, expect, type Page } from '@playwright/test';

// 2.0.2 (owner feedback 2026-10-05): the Settings card "בחירת מצלמות להשוואה" - how the camera comparison picker is drawn
// (`ui.dd_picker`: dropdown | chips) and from how many cameras a multi-select list searches (`ui.dd_search`: always | 4 | 8 | never).
// Each a global value with two owners: the installation's default (admins, PATCH /settings) and the user's own (PUT /me/prefs, null =
// follow). Covers both levels and every option, the `data-dd-search` attribute the dropdown reads, persistence across a reload, a
// non-admin and a refused save. One project only (desktop): the widths are set inside the tests. Mock layer, no backend.
//   npx playwright test tests/dropdown-picker-choice.spec.ts --project=desktop
const ADMIN = ['alarm.view', 'audit.read', 'devices.read', 'devices.control', 'entity.state.read', 'events.read', 'map.read', 'media.browse', 'media.control', 'media.read', 'rbac.assign', 'schedule.view', 'schedule.manage', 'sources.configure', 'system.configure', 'video.live', 'video.playback', 'access.read', 'automation.manage', 'script.run'];

type Server = { inst: Record<string, string>; own: Record<string, string | null>; patches: Record<string, unknown>[]; puts: Record<string, unknown>[]; canEdit: boolean; refuse: boolean };
const KEYS = ['ui.dd_picker', 'ui.dd_search'] as const;
const fresh = (): Server => ({ inst: { 'ui.dd_picker': 'dropdown', 'ui.dd_search': '4' }, own: { 'ui.dd_picker': null, 'ui.dd_search': null }, patches: [], puts: [], canEdit: true, refuse: false });

async function mock(page: Page, srv: Server) {
  await page.route('**/api/v1/**', (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = srv.canEdit ? ADMIN : ADMIN.filter((x) => x !== 'system.configure');
      return json({
        channel: 'local', remote: null, user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    const prefs = () => ({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'multimedia', 'wiskey'], ...srv.own }, stored: KEYS.filter((k) => srv.own[k]), updated_at: null });
    if (p === 'me/prefs' && req.method() === 'PUT') {
      const b = req.postDataJSON() as Record<string, unknown>;
      srv.puts.push(b);
      if (srv.refuse) return json({ code: 'validation', user_message: 'ערך לא תקין (בדיקה)', retryable: false, correlation_id: '', details: {} }, 422);
      for (const k of KEYS) if (k in b) srv.own[k] = b[k] as string | null;
      return json(prefs());
    }
    if (p === 'me/prefs') return json(prefs());
    if (p === 'settings' && req.method() === 'PATCH') {
      const b = req.postDataJSON() as Record<string, unknown>;
      srv.patches.push(b);
      for (const k of KEYS) if (k in b) srv.inst[k] = b[k] as string;
    }
    if (p === 'settings') return json({ settings: { 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.tabs': {}, 'multimedia.enabled': 'true', 'schedules.enabled': 'true', 'automations.enabled': 'true', 'ui.tabs_mode': 'tabs', 'ui.tabs_mode_groups': {}, 'ui.dd_style': 'auto', 'ui.dd_style_groups': {}, 'ui.dd_phone': 'sheet', ...srv.inst }, can_edit: srv.canEdit });
    if (p === 'multimedia/status') return json({ enabled: true, counts: { screens: 1, players: 2, groups: 1 } });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

const htmlSearch = (page: Page) => page.evaluate(() => document.documentElement.getAttribute('data-dd-search'));

async function openCard(page: Page, srv: Server, width = 1280) {
  await mock(page, srv);
  await page.setViewportSize({ width, height: 900 });
  await page.goto('./?design=a#/system/diagnostics?tab=tabs');
  await page.waitForSelector('system-tabs-mode');
  await page.waitForTimeout(1200);
  return page.locator('[data-dd-picker-card]');
}

test.describe('the camera picker card in the Settings screen', () => {
  test('both levels: the defaults are the dropdown and search from 4; the installation default and the personal choice save and apply at once', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one project');
    const srv = fresh();
    const card = await openCard(page, srv);
    await expect(card).toBeVisible();
    await expect(card.locator('[data-dd-picker="inst:dropdown"]')).toBeChecked();
    await expect(card.locator('[data-dd-search="inst:4"]')).toBeChecked();
    await expect(card.locator('[data-dd-picker="own:follow"]')).toBeChecked();
    await expect(card.locator('[data-dd-search="own:follow"]')).toBeChecked();
    await expect(card.locator('[data-dd-picker-effective]')).toContainText('תפריט נפתח, חיפוש מ־4 מצלמות');
    expect(await htmlSearch(page)).toBe('4');
    // the installation defaults (an administrator): one key per change
    await card.locator('[data-dd-picker="inst:chips"]').check();
    await expect.poll(() => srv.patches.length).toBe(1);
    expect(srv.patches[0]).toEqual({ 'ui.dd_picker': 'chips' });
    await expect(card.locator('[data-dd-picker-effective]')).toContainText('כפתורים');
    await card.locator('[data-dd-search="inst:never"]').check();
    await expect.poll(() => srv.patches.length).toBe(2);
    expect(srv.patches[1]).toEqual({ 'ui.dd_search': 'never' });
    expect(await htmlSearch(page)).toBe('never');
    await expect(card.locator('[data-dd-picker-effective]')).toContainText('חיפוש אף פעם');
    expect(srv.puts).toHaveLength(0);
    // the personal choice wins over the installation's
    await card.locator('[data-dd-picker="own:dropdown"]').check();
    await expect.poll(() => srv.own['ui.dd_picker']).toBe('dropdown');
    expect(srv.puts[0]).toEqual({ 'ui.dd_picker': 'dropdown' });
    await expect(card.locator('[data-dd-picker-effective]')).toContainText('תפריט נפתח');
    await card.locator('[data-dd-search="own:always"]').check();
    await expect.poll(() => srv.own['ui.dd_search']).toBe('always');
    expect(await htmlSearch(page)).toBe('always');
    await card.locator('[data-dd-search="own:8"]').check();
    await expect.poll(() => srv.own['ui.dd_search']).toBe('8');
    expect(await htmlSearch(page)).toBe('8');
    // back to "follow the installation"
    await card.locator('[data-dd-search="own:follow"]').check();
    await expect.poll(() => srv.own['ui.dd_search']).toBeNull();
    expect(srv.puts[srv.puts.length - 1]).toEqual({ 'ui.dd_search': null });
    expect(await htmlSearch(page)).toBe('never');
    expect(srv.patches).toHaveLength(2); // the installation was only touched by the two administrator choices
  });

  test('persistence: a reload keeps the installation defaults and the personal choices', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one project');
    const srv = fresh();
    srv.inst = { 'ui.dd_picker': 'chips', 'ui.dd_search': '8' };
    srv.own = { 'ui.dd_picker': 'dropdown', 'ui.dd_search': 'never' };
    const card = await openCard(page, srv);
    await expect(card.locator('[data-dd-picker="inst:chips"]')).toBeChecked();
    await expect(card.locator('[data-dd-search="inst:8"]')).toBeChecked();
    await expect(card.locator('[data-dd-picker="own:dropdown"]')).toBeChecked();
    await expect(card.locator('[data-dd-search="own:never"]')).toBeChecked();
    expect(await htmlSearch(page)).toBe('never');
    await page.reload();
    await page.waitForSelector('system-tabs-mode');
    await page.waitForTimeout(1200);
    await expect(page.locator('[data-dd-picker="own:dropdown"]')).toBeChecked();
    await expect(page.locator('[data-dd-search="own:never"]')).toBeChecked();
    expect(await htmlSearch(page)).toBe('never');
    // a user who follows the installation gets the installation's values
    srv.own = { 'ui.dd_picker': null, 'ui.dd_search': null };
    await page.reload();
    await page.waitForSelector('system-tabs-mode');
    await page.waitForTimeout(1200);
    await expect(page.locator('[data-dd-picker="own:follow"]')).toBeChecked();
    await expect(page.locator('[data-dd-search="own:follow"]')).toBeChecked();
    await expect(page.locator('[data-dd-picker-effective]')).toContainText('כפתורים, חיפוש מ־8 מצלמות');
    expect(await htmlSearch(page)).toBe('8');
  });

  test('a user without the system permission can only change the personal choice; a refused save is reverted', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one project');
    const srv = fresh();
    srv.canEdit = false;
    const card = await openCard(page, srv);
    await expect(card.locator('[data-dd-picker="inst:chips"]')).toBeDisabled();
    await expect(card.locator('[data-dd-search="inst:8"]')).toBeDisabled();
    await expect(card.locator('[data-dd-picker="own:chips"]')).toBeEnabled();
    srv.refuse = true;
    await card.locator('[data-dd-picker="own:chips"]').click(); // not check(): the optimistic choice is reverted when the server refuses
    await expect.poll(() => srv.puts.length).toBe(1);
    await expect(card.locator('[role=alert]')).toBeVisible();
    await expect(card.locator('[data-dd-picker="own:follow"]')).toBeChecked();
    await expect(card.locator('[data-dd-picker-effective]')).toContainText('תפריט נפתח');
  });

  test('on a phone width: nothing overflows, labels are plain (no platform names), no paragraphs', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one project');
    const card = await openCard(page, fresh(), 390);
    await expect(card).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const text = (await card.innerText()).toLowerCase();
    expect(text).not.toContain('home assistant');
    expect(text).not.toContain('ingress');
    await expect(card.locator('.muted')).toHaveCount(0);
    await expect(card.locator('input[type=radio]')).toHaveCount(2 + 4 + 1 + 2 + 1 + 4); // inst: 2 + 4; own: follow + 2, follow + 4
  });
});
