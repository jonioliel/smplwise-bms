import { expect, test, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockHome } from './home-simple-mocks';

// HOME-SIMPLE-2421: the owner's decisions of 2026-11-10 on top of the 2.42.0 home interface - the doors' unlock reason (lab finding),
// the installation settings (choice at the first sign-in, a wall panel without an exit, the room wallpaper) and the administrator's
// switch classification. Mocked backend (tests/home-simple-mocks.ts); nothing is sent anywhere.

const inHome = (page: Page) => page.locator('sw-home');

async function open(page: Page, route: string, extra: Parameters<typeof mockHome>[1] = {}) {
  const mock = await mockHome(page, extra);
  await page.goto(`/#/home/${route}`);
  await page.locator('sw-home').waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2, .hs.bare .welcome'))).toBe(true);
  await settle(page);
  return mock;
}

/** No scrolling on the home element: the page, the shell and the main area. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
    const out: string[] = [];
    const doc = document.scrollingElement!;
    if (doc.scrollHeight - doc.clientHeight > 1) out.push('document');
    for (const sel of ['.hs', '#main']) {
      const el = root.querySelector(sel) as HTMLElement | null;
      if (el && el.scrollHeight - el.clientHeight > 1) out.push(sel);
    }
    return out;
  });
}

test.describe('HOME-SIMPLE-2421 home interface', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one size is enough for the behaviour');
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('a door the door rule does not let this person open shows the reason instead of "open"', async ({ page }) => {
    await open(page, 'doors', { lockReasons: { 'lock.front': 'door_not_mapped' } });
    const front = inHome(page).locator('.drow', { hasText: 'דלת הכניסה' });
    await expect(front.locator('[data-act="doorAsk"]')).toHaveCount(0);
    await expect(front.locator('[data-door-reason="door_not_mapped"]')).toHaveText('הדלת עדיין לא משויכת לעמדה');
    // the gate's rule says ok: its open control stays
    await expect(inHome(page).locator('.drow', { hasText: 'שער החניה' }).locator('[data-act="doorAsk"]')).toHaveCount(1);
  });

  test('a door without the permission says so', async ({ page }) => {
    await open(page, 'doors', { lockReasons: { 'lock.front': 'no_permission', 'lock.gate': 'no_permission' } });
    await expect(inHome(page).locator('[data-act="doorAsk"]')).toHaveCount(0);
    await expect(inHome(page).locator('[data-door-reason="no_permission"]').first()).toHaveText('אין הרשאה לפתוח');
  });

  test('"choose at the first sign-in" opens the choice screen and saves the choice', async ({ page }) => {
    const m = await open(page, '', { policy: { choose: true, interface: 'home', default_interface: 'full' }, layout: { welcomed: false } });
    await expect(inHome(page).locator('.welcome h1')).toContainText('איך נוח לך לראות את הבית');
    await inHome(page).locator('[data-act="welcomePick"][data-v="home"]').click();
    await inHome(page).locator('[data-act="welcomeGo"]').click();
    await expect.poll(() => m.calls.filter((c) => c.path === 'me/interface').map((c) => JSON.stringify(c.body))).toContain('{"interface":"home"}');
  });

  test('a wall panel set to "no exit" ignores the long press on the clock', async ({ page }) => {
    let exits = 0;
    await mockHome(page, { policy: { kiosk: true, home_only: true, may_switch: false, kiosk_area_id: 'living', kiosk_exit: 'none' } });
    await page.route('**/api/v1/home/kiosk/exit', (r) => { exits++; return r.fulfill({ status: 403, contentType: 'application/json', body: '{"code":"kiosk_no_exit"}' }); });
    await page.goto('/#/home/rooms');
    await expect(inHome(page).locator('.tb-room h1')).toHaveText('סלון');
    await expect(inHome(page).locator('.st-me')).toBeHidden();
    await settle(page);
    const box = await inHome(page).locator('.hs-now').boundingBox();
    await page.mouse.move(box!.x + 10, box!.y + 10);
    await page.mouse.down();
    await page.waitForTimeout(1400); // longer than the 1.2 s hold that opens the keypad in the "exit with code" mode
    await page.mouse.up();
    await expect(inHome(page).locator('[data-act="kioskGo"]')).toHaveCount(0);
    expect(exits).toBe(0);
  });

  test('the room wallpaper: a gallery choice sits behind the room screen with no scrolling; the settings tab saves the choice', async ({ page }) => {
    const m = await open(page, 'r/living', { policy: { wallpaper: 'gallery' }, layout: { welcomed: true, wallpapers: { living: 'g:dusk' } } });
    const hs = inHome(page).locator('.hs.v2');
    await expect(hs).toHaveClass(/walled/);
    await expect(hs).toHaveAttribute('data-wall', 'g:dusk');
    expect(await overflow(page)).toEqual([]);
    await page.goto('/#/home/settings/wall');
    await settle(page);
    await expect(inHome(page).locator('.wall-opt')).toHaveCount(9);
    await expect(inHome(page).locator('[data-wall-upload]')).toHaveCount(0); // gallery only: no personal picture
    expect(await overflow(page)).toEqual([]);
    await inHome(page).locator('[data-wall-opt="g:tide"]').click();
    await expect.poll(() => m.calls.filter((c) => c.path === 'home/prefs').map((c) => JSON.stringify(c.body))).toContain(JSON.stringify({ layout: { wallpapers: { living: 'g:tide' } } }));
  });

  test('no wallpaper by default: no settings tab, a clean room screen', async ({ page }) => {
    await open(page, 'r/living', { layout: { welcomed: true, wallpapers: { living: 'g:dusk' } } });
    await expect(inHome(page).locator('.hs.v2')).not.toHaveClass(/walled/);
    await page.goto('/#/home/settings/favs');
    await settle(page);
    await expect(inHome(page).locator('[data-act="setTab"][data-v="wall"]')).toHaveCount(0);
  });

  test('gallery + personal picture offers the upload; the picture is served by the home route', async ({ page }) => {
    await open(page, 'settings/wall', { policy: { wallpaper: 'gallery_image' }, layout: { welcomed: true, wallpapers: { living: 'img' } } });
    await expect(inHome(page).locator('[data-wall-upload]')).toHaveCount(1);
    await expect(inHome(page).locator('[data-act="wallDel"]')).toHaveCount(0); // "home" is the current room, it has no picture
  });
});

test.describe('HOME-SIMPLE-2421 administrator page', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one size is enough');
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  async function adminPage(page: Page) {
    await mockHome(page, { perms: ['devices.read', 'rbac.assign', 'system.configure', 'identity.directory.read'], policy: { interface: 'full', default_interface: 'full', admin: true } });
    const users = [{ user_id: 'dev-noa', username: 'noa', display_name: 'נועה לביא', source: 'ingress', system_admin: false, default_interface: 'full', may_switch: true, home_only: false, kiosk: false, kiosk_area_id: null, rooms: null, modules: null, configured: false, admin: false }];
    const sent: { path: string; body: unknown }[] = [];
    let settings = { default_mode: 'full_all', kiosk_exit: 'code', wallpaper: 'none' };
    const switches = [
      { entity_id: 'switch.boiler', name: 'דוד שמש', area_id: 'bath', area_name: 'חדר רחצה', floor_name: null, state: 'on', available: true, class: 'not_light', suggest: 'protected', suggest_reason: 'דוד מים', locked: null },
      { entity_id: 'switch.strip', name: 'פס תאורה', area_id: 'living', area_name: 'סלון', floor_name: null, state: 'off', available: true, class: 'not_light', suggest: 'light', suggest_reason: 'השם כולל מילה של תאורה', locked: null },
      { entity_id: 'switch.pump', name: 'משאבה', area_id: 'garden', area_name: 'גינה', floor_name: null, state: 'off', available: true, class: 'not_light', suggest: null, suggest_reason: null, locked: null },
    ];
    const ok = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    await page.route('**/api/v1/home/policies', (r) => r.fulfill(ok({ users, modules: ['lights'], seed: {}, kiosk_code_set: false })));
    await page.route('**/api/v1/home/settings', (r) => {
      if (r.request().method() === 'PUT') { const b = r.request().postDataJSON(); sent.push({ path: 'home/settings', body: b }); settings = { ...settings, ...b }; }
      return r.fulfill(ok({ settings, values: {}, gallery: [] }));
    });
    await page.route('**/api/v1/home/switches', (r) => {
      if (r.request().method() === 'POST') { sent.push({ path: 'home/switches', body: r.request().postDataJSON() }); return r.fulfill(ok({ results: [], changed: 1, refused: 0 })); }
      return r.fulfill(ok({ switches, summary: {} }));
    });
    await page.route('**/api/v1/identity/users**', (r) => r.fulfill(ok({ users: [], directory: { paired: false, users: 0, last_directory_at: null }, revision: 1, delegated: false })));
    await page.route('**/api/v1/access/roles**', (r) => r.fulfill(ok({ roles: [] })));
    await page.route('**/api/v1/access/groups**', (r) => r.fulfill(ok({ groups: [], can_manage: true })));
    await page.route('**/api/v1/sites?tree=true', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/#/system/access?tab=home');
    const admin = page.locator('sw-home-admin');
    await expect(admin.locator('[data-home-detail] h3')).toHaveText('נועה לביא');
    return { admin, sent };
  }

  test('installation settings: the default of new people, the wall panel exit and the wallpaper are saved', async ({ page }) => {
    const { admin, sent } = await adminPage(page);
    await admin.locator('[data-home-subtabs] [role="tab"]', { hasText: 'הגדרות התקנה' }).click();
    await expect(admin.locator('[data-install="default_mode:full_all"]')).toBeChecked();
    await admin.locator('[data-install="default_mode:choose"]').check();
    await admin.locator('[data-install="kiosk_exit:none"]').check();
    await admin.locator('[data-install="wallpaper:gallery_image"]').check();
    await expect.poll(() => sent.filter((s) => s.path === 'home/settings').map((s) => JSON.stringify(s.body))).toEqual(['{"default_mode":"choose"}', '{"kiosk_exit":"none"}', '{"wallpaper":"gallery_image"}']);
  });

  test('switch classification: filter the suggestions, select all, approve; mark many as protected', async ({ page }) => {
    const { admin, sent } = await adminPage(page);
    await admin.locator('[data-home-subtabs] [role="tab"]', { hasText: 'סיווג מפסקים' }).click();
    await expect(admin.locator('[data-sw-row]')).toHaveCount(3);
    await admin.locator('[data-sw-filter] [role="tab"]', { hasText: 'הצעות' }).click();
    await expect(admin.locator('[data-sw-row]')).toHaveCount(2);
    await admin.locator('[data-sw-all]').check();
    await expect(admin.locator('[data-sw-bulk]')).toContainText('2 מסומנים');
    await admin.locator('[data-sw-approve]').click();
    await expect.poll(() => sent.filter((s) => s.path === 'home/switches').map((s) => JSON.stringify(s.body))).toEqual([
      '{"entity_ids":["switch.strip"],"mark":"light"}', '{"entity_ids":["switch.boiler"],"mark":"protected"}',
    ]);
    await admin.locator('[data-sw-filter] [role="tab"]', { hasText: 'הכל' }).click();
    await admin.locator('[data-sw-row="switch.pump"] input').check();
    await admin.locator('[data-sw-row="switch.boiler"] input').check();
    await admin.locator('[data-sw-mark="protected"]').click();
    await expect.poll(() => sent.filter((s) => s.path === 'home/switches').length).toBe(3);
    expect(JSON.parse(JSON.stringify(sent[2].body))).toEqual({ entity_ids: ['switch.pump', 'switch.boiler'], mark: 'protected' });
  });
});
