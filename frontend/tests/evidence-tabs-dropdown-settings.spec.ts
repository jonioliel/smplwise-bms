import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 0.1.153 (companion of evidence-tabs-dropdown.spec.ts): the home area navigation (devices-area-nav; since the HOME polish of 2026-10-10
// two pickers instead of the phone's chip row), the Settings card
// "תצוגת לשוניות" in demo mode and against a mocked backend (the keys the installation default and the personal choice send).
// Needs the Vite DEV server (imports /src/...):
//   $env:SW_API_PORT='59999'; npx vite --host 127.0.0.1 --port 5196   then
//   $env:SW_BASE_URL='http://127.0.0.1:5196/'; npx playwright test evidence-tabs-dropdown-settings --project=desktop --workers=1
const SHOTS = process.env.SW_SHOTS ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/tabs-dropdown');
const MODE_URL = '/src/shell/tabs-mode.ts';

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function stage(page: Page, width = 390) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('./?design=a#/devices/building');
  await page.waitForFunction(() => !!customElements.get('sw-dropdown') && !!customElements.get('sw-tabs'));
  await page.waitForTimeout(1200); // the shell's own load of the mode (loadTabsMode) must be over before a test sets one
  await page.evaluate(() => {
    document.querySelectorAll('#stage').forEach((e) => e.remove());
    const st = document.createElement('div');
    st.id = 'stage';
    st.style.cssText = 'position:fixed;inset:0;z-index:10;background:var(--sw-bg,#fff);padding:24px 16px;display:flex;flex-direction:column;gap:20px;align-items:stretch';
    document.body.appendChild(st);
  });
}

async function setMode(page: Page, mode: string | null, groups: Record<string, string> = {}) {
  await page.evaluate(
    async ([url, m, g]) => {
      const mod = await import(/* @vite-ignore */ url as string);
      await mod.saveOwnTabsMode(m, g);
    },
    [MODE_URL, mode, groups] as const,
  );
}

test.describe('the home area pickers (devices-area-nav) and the tabs-mode / size dials', () => {
  async function mountNav(page: Page, n: number) {
    await page.evaluate(
      async (count) => {
        if (!customElements.get('devices-area-nav')) await import(/* @vite-ignore */ ['/src', 'screens', 'devices-area-nav.ts'].join('/'));
        const el = document.createElement('devices-area-nav') as HTMLElement & { areaId: string; areaName: string; floorName: string; areas: unknown };
        el.id = 'nav';
        el.areaId = 'a1';
        el.areaName = 'אזור 1';
        el.floorName = 'קומה 1';
        el.areas = Array.from({ length: count as number }, (_, i) => ({ area_id: `a${i + 1}`, name: `אזור ${i + 1}`, counts: { entities: i + 2 } }));
        document.querySelector('#stage')!.appendChild(el);
      },
      n,
    );
    await page.waitForTimeout(300);
  }
  // HOME polish (owner 2026-10-10, docs/design/HOME_POLISH.md "The area header: two pickers"): the floor and the area are two pickers in the
  // breadcrumb row on EVERY width and in EVERY tabs mode - the tabs-mode dial no longer switches this screen between a chip row and a chip in
  // the shell's pair row (both are gone; the area picker's list is the floor's areas with counts). What still applies to the home group is
  // the dropdown SIZE dial: it sizes the two pickers (36 / 44 / 52 px; never under 44 on a phone).
  const state = (page: Page) =>
    page.locator('#nav').evaluate((el) => ({
      floor: !!el.shadowRoot!.querySelector('[data-crumb=floor]'),
      area: !!el.shadowRoot!.querySelector('[data-crumb=area]'),
      chips: el.shadowRoot!.querySelectorAll('sw-chip').length,
      inShell: !!el.shadowRoot!.querySelector('[data-areas-in-shell]') || !!document.querySelector('sw-app')!.shadowRoot!.querySelector('[data-pair-chip]'),
    }));
  const PICKERS = { floor: true, area: true, chips: 0, inShell: false };
  /** Opens the area picker and returns its list (name + count per option, the marked one), then closes it again with Escape. */
  async function areaList(page: Page) {
    await page.locator('#nav').evaluate((el) => el.shadowRoot!.querySelector<HTMLElement>('[data-crumb=area]')!.click());
    await page.waitForTimeout(150);
    const list = await page.locator('#nav').evaluate((el) =>
      [...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-nav-menu=area] [data-nav-option]')].map((o) => ({ id: o.dataset.navOption, name: o.querySelector('span:not(.n)')!.textContent!.trim(), count: o.querySelector('.n')!.textContent!.trim(), current: o.getAttribute('aria-checked') === 'true' })),
    );
    await page.locator('#nav').evaluate((el) => el.shadowRoot!.querySelector<HTMLElement>('[data-crumb=area]')!.click()); // the picker toggles its list shut
    return list;
  }
  const pickHeight = (page: Page, which: 'floor' | 'area') => page.locator('#nav').evaluate((el, w) => el.shadowRoot!.querySelector(`[data-crumb=${w}]`)!.getBoundingClientRect().height, which);
  async function setSize(page: Page, groups: Record<string, string>) {
    await page.evaluate(async ([url, g]) => (await import(/* @vite-ignore */ url as string)).saveOwnDdSize(null, g), [MODE_URL, groups] as const);
  }

  test('every tabs mode (tabs, dropdown, hybrid at 5 and 3 areas, a group override): the floor and the area pickers, the areas with counts in the area list; the size dial sizes the pickers', async ({ page }) => {
    await stage(page);
    await setMode(page, 'tabs', {});
    await mountNav(page, 5);
    expect(await state(page)).toEqual(PICKERS);
    await shot(page, 'home-areas-tabs-390-light');
    const five = await areaList(page);
    expect(five.map((o) => o.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    expect(five[0]).toEqual({ id: 'a1', name: 'אזור 1', count: '2', current: true }); // the name and its device count; the current area is marked
    expect(five[4]).toEqual({ id: 'a5', name: 'אזור 5', count: '6', current: false });
    for (const mode of ['dropdown', 'hybrid'] as const) {
      await setMode(page, mode, {});
      await expect.poll(() => state(page)).toEqual(PICKERS); // never a chip row, never a chip in the shell
      expect((await areaList(page)).length).toBe(5);
    }
    await page.locator('#nav').evaluate((el) => ((el as unknown as { areas: unknown[] }).areas = (el as unknown as { areas: unknown[] }).areas.slice(0, 3)));
    await expect.poll(() => state(page)).toEqual(PICKERS); // hybrid with 3 areas: still the picker (no chips come back)
    expect((await areaList(page)).map((o) => o.id)).toEqual(['a1', 'a2', 'a3']);
    await setMode(page, 'tabs', { home: 'dropdown' });
    await expect.poll(() => state(page)).toEqual(PICKERS); // a group override changes nothing here either
    // the dial that still applies: the home group's dropdown size (a phone never goes under 44 px)
    await setSize(page, { home: 'lg' });
    await expect(page.locator('#nav')).toHaveAttribute('data-dd-size', 'lg');
    for (const w of ['floor', 'area'] as const) expect(await pickHeight(page, w)).toBeGreaterThanOrEqual(52);
    await setSize(page, { home: 'sm' });
    await expect(page.locator('#nav')).toHaveAttribute('data-dd-size', 'sm');
    for (const w of ['floor', 'area'] as const) expect(await pickHeight(page, w)).toBeGreaterThanOrEqual(44);
    await setSize(page, { security: 'lg' }); // another group's size does not touch the home pickers
    await expect(page.locator('#nav')).toHaveAttribute('data-dd-size', 'md');
  });

  test('a screen wider than the phone: both pickers in every tabs mode, side by side on one row (the area never dropped nor moved to the shell); the size dial applies', async ({ page }) => {
    await stage(page, 1000);
    await setMode(page, 'dropdown', {});
    await mountNav(page, 5);
    const row = () =>
      page.locator('#nav').evaluate((el) => {
        const f = el.shadowRoot!.querySelector('[data-crumb=floor]')!.getBoundingClientRect();
        const a = el.shadowRoot!.querySelector('[data-crumb=area]')!.getBoundingClientRect();
        return { sameRow: Math.abs(f.top - a.top) < 4, areaLeftOfFloor: a.right <= f.left + 1 };
      });
    for (const mode of ['dropdown', 'hybrid', 'tabs'] as const) {
      await setMode(page, mode, {});
      await expect.poll(() => state(page)).toEqual(PICKERS);
      expect(await row()).toEqual({ sameRow: true, areaLeftOfFloor: true }); // RTL: the floor first, the area beside it
      expect((await areaList(page)).length).toBe(5);
    }
    expect(await pickHeight(page, 'floor')).toBeGreaterThanOrEqual(44); // the reference size
    await setSize(page, { home: 'lg' });
    await expect(page.locator('#nav')).toHaveAttribute('data-dd-size', 'lg');
    const lg = await pickHeight(page, 'floor');
    expect(lg).toBeGreaterThanOrEqual(52);
    await setSize(page, { home: 'sm' });
    await expect(page.locator('#nav')).toHaveAttribute('data-dd-size', 'sm');
    expect(await pickHeight(page, 'floor')).toBeLessThan(lg); // smaller than the large one (36 px is the floor of the field, the text may need a little more)
  });
});

test.describe('הגדרות › כללי › לשוניות › תצוגת לשוניות (demo mode)', () => {
  async function openCard(page: Page) {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('about:blank');
    await page.goto('./?design=a#/system/diagnostics?tab=tabs');
    await page.waitForSelector('sw-app');
    await page.waitForSelector('system-tabs-mode');
    await page.waitForTimeout(600);
  }
  const card = (page: Page) => page.locator('system-tabs-mode');
  const effective = (page: Page) => page.evaluate(async (url) => (await import(/* @vite-ignore */ url as string)).tabModeOf('security', true), MODE_URL);

  test('personal choice: follows the installation by default; radios and per-group selects drive the shell; the preview follows live', async ({ page }) => {
    await openCard(page);
    await expect(card(page).locator('[data-tabs-mode-own] input[data-mode-follow]')).toBeChecked();
    await expect(card(page).locator('[data-tabs-mode-own] label').first()).toContainText('לפי ההתקנה (כרגע: כמוסות ופסים)');
    await expect(card(page).locator('[data-tabs-mode-preview]')).toHaveAttribute('data-tabs-mode-preview', 'tabs');
    expect(await card(page).locator('sw-tabs[data-preview="6"] sw-dropdown').count()).toBe(0);
    await shot(page, 'settings-card-390-light');
    await card(page).locator('[data-tabs-mode-own] input[data-mode=dropdown]').check();
    await expect(card(page).locator('[data-tabs-mode-preview]')).toHaveAttribute('data-tabs-mode-preview', 'dropdown');
    await expect(card(page).locator('sw-tabs[data-preview="3"] sw-dropdown')).toHaveCount(1);
    expect(await effective(page)).toBe('dropdown');
    // the preview shows the pair: two chips on one row
    const ys = await card(page).locator('[data-preview=pair] sw-tabs').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(ys.length).toBe(2);
    expect(Math.abs(ys[0] - ys[1])).toBeLessThan(2);
    await shot(page, 'settings-card-pair-390-light');
    await card(page).locator('[data-tabs-mode-own] input[data-mode=hybrid]').check();
    await expect(card(page).locator('sw-tabs[data-preview="3"] sw-dropdown')).toHaveCount(0); // 3 items: the bar
    await expect(card(page).locator('sw-tabs[data-preview="6"] sw-dropdown')).toHaveCount(1); // 6 items: the dropdown
    await shot(page, 'settings-card-hybrid-390-light');
    await card(page).locator('select[data-group="own:security"]').selectOption('tabs'); // a group override on top of the global value
    expect(await effective(page)).toBe('tabs');
    await card(page).locator('[data-tabs-mode-own] input[data-mode-follow]').check(); // back to following the installation
    await card(page).locator('select[data-group="own:security"]').selectOption('');
    expect(await effective(page)).toBe('tabs');
    // the installation's controls are read-only without a backend / the permission
    await expect(card(page).locator('[data-tabs-mode-installation] input[data-mode=hybrid]')).toBeDisabled();
  });
});

// API mode (mocked backend): the installation default and the personal choice reach the server with the right keys.
test.describe('the card against a mocked backend', () => {
  const ADMIN = ['system.configure', 'devices.read', 'map.read', 'events.read', 'access.read', 'alarm.view', 'video.live', 'video.playback', 'sources.configure', 'rbac.assign', 'audit.read'];

  test('installation PATCH /settings and personal PUT /me/prefs carry ui.tabs_mode and the per-group object', async ({ page }) => {
    const patches: Record<string, unknown>[] = [];
    const puts: Record<string, unknown>[] = [];
    const st = { mode: 'tabs', groups: {} as Record<string, string> };
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
      if (p === 'me/prefs' && req.method() === 'PUT') {
        puts.push(req.postDataJSON() as Record<string, unknown>);
        return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
      }
      if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'], 'ui.tabs_mode': null, 'ui.tabs_mode_groups': null }, stored: [], updated_at: null });
      if (p === 'settings' && req.method() === 'PATCH') {
        const b = req.postDataJSON() as Record<string, unknown>;
        patches.push(b);
        if ('ui.tabs_mode' in b) st.mode = b['ui.tabs_mode'] as string;
        if ('ui.tabs_mode_groups' in b) st.groups = b['ui.tabs_mode_groups'] as Record<string, string>;
      }
      if (p === 'settings') return json({ settings: { 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.tabs': {}, 'ui.tabs_mode': st.mode, 'ui.tabs_mode_groups': st.groups }, can_edit: true });
      if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
      if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
      return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./?design=a#/system/diagnostics?tab=tabs');
    await page.waitForSelector('system-tabs-mode');
    await page.waitForTimeout(800);
    const card = page.locator('system-tabs-mode');
    await card.locator('[data-tabs-mode-installation] input[data-mode=hybrid]').check();
    await expect.poll(() => patches.length).toBe(1);
    expect(patches[0]).toEqual({ 'ui.tabs_mode': 'hybrid', 'ui.tabs_mode_groups': {} });
    await card.locator('select[data-group="inst:multimedia"]').selectOption('dropdown');
    await expect.poll(() => patches.length).toBe(2);
    expect(patches[1]).toEqual({ 'ui.tabs_mode': 'hybrid', 'ui.tabs_mode_groups': { multimedia: 'dropdown' } });
    await expect(card.locator('[data-tabs-mode-own] label').first()).toContainText('לפי ההתקנה (כרגע: משולב)');
    await shot(page, 'settings-card-api-390-light');
    await card.locator('[data-tabs-mode-own] input[data-mode=dropdown]').check();
    await expect.poll(() => puts.length).toBe(1);
    expect(puts[0]).toEqual({ 'ui.tabs_mode': 'dropdown', 'ui.tabs_mode_groups': null });
    await card.locator('[data-tabs-mode-own] input[data-mode-follow]').check();
    await expect.poll(() => puts.length).toBe(2);
    expect(puts[1]).toEqual({ 'ui.tabs_mode': null, 'ui.tabs_mode_groups': null });
  });
});
