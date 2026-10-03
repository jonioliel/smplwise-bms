import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-013 (docs/changes/CR-013-SHELL.md): the app shell - the user avatar as the navigation's last item (side rail on a
// wide screen, bottom bar on the phone) with the user menu (התראות, סדר הלשוניות, מערכת, sign-out), the security
// sections as a sticky row, a horizontally scrolling tab row, and a per-user tab order stored on the server.
// UI round 1 (docs/evidence/UIR1-shell): no top bar on any width - a search button and the system-status dot float in the
// content's corner, the security sections are a segmented control at the head of the page, the navigation is ~20% smaller,
// and "עריכת המסך הראשי" joins the user menu for who may edit the home layout. Two parts, both against the static preview (npm run build first):
//   1. the demo data (no backend);
//   2. a mocked backend (page.route on api/v1): users with and without permissions, open alerts, and GET/PUT /me/prefs
//      kept per user in the test - what the client does with them. The endpoint itself: backend tests/test_user_prefs.py.
//   SW_BASE_URL=http://127.0.0.1:4391/ npx playwright test tests/evidence-shell.spec.ts

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/UIR1-shell');
const TABS = ['ראשי', 'אבטחה', 'מפה', 'מולטימדיה', 'WisKey']; // the static demo shows every area (CR-015 added מולטימדיה)
const DEFAULT_ORDER = ['devices', 'security', 'explore', 'multimedia', 'wiskey']; // the stored order: every tab, hidden ones included
/** What a user WITHOUT media.read sees: the same order without the multimedia entry (CR-015). */
const VISIBLE_ORDER = DEFAULT_ORDER.filter((t) => t !== 'multimedia');

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

/** The tab-order dialog: the avatar, then "החשבון שלי" (the menu's second level), then "סדר הלשוניות". */
async function openOrder(page: Page, info: { project: { name: string } }) {
  await meButton(page, info).click();
  await page.locator('sw-app sw-user-menu [data-menu-account]').click();
  await page.locator('sw-app sw-user-menu [data-menu-nav-order]').click();
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) });
}

/** Bars of the shell itself (a direct child <header> of <sw-app>'s shadow root), not the pages' own headers. */
function shellHeaders(page: Page): Promise<number> {
  return page.locator('sw-app').evaluate((el) => Array.from(el.shadowRoot!.children).filter((c) => c.tagName === 'HEADER').length);
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
    // no bell anywhere; no top bar on any width: the content starts at the very top
    await expect(page.locator('sw-app sw-button.bell')).toHaveCount(0);
    expect(await shellHeaders(page)).toBe(0);
    expect((await page.locator('sw-app main').boundingBox())!.y).toBe(0);
    if (phone(info)) await shot(page, 'shell-phone-home');
    else if (info.project.name === 'desktop') await shot(page, 'shell-desktop-rail');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('no top bar: the search is a corner button (Ctrl+K too) and an area page has one navigation only', async ({ page }, info) => {
    await open(page, '/devices/areas/none');
    expect(await shellHeaders(page)).toBe(0);
    // exactly one navigation is visible (the rail, or the bottom bar on the phone), nothing above the content
    const navs = await page.locator('sw-app nav[aria-label="ניווט ראשי"]').evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== 'none').length);
    expect(navs).toBe(1);
    expect((await page.locator('sw-app main').boundingBox())!.y).toBe(0);
    // a small icon button in the top left corner (RTL), no field until it is opened
    const btn = page.locator('sw-app [data-search-open]');
    await expect(btn).toBeVisible();
    await expect(page.locator('sw-app .search input')).toHaveCount(0);
    const b = (await btn.boundingBox())!;
    expect(b.x).toBeLessThan(110);
    expect(b.y).toBeLessThan(30);
    expect(b.width).toBeLessThanOrEqual(32);
    if (phone(info)) {
      // still a 44 px tap target: the hit area reaches 22 px around the centre
      const hit = await page.evaluate(([x, y]) => (document.querySelector('sw-app')!.shadowRoot!.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-search-open]') !== null, [b.x + b.width / 2 - 21, b.y + b.height / 2]);
      expect(hit).toBe(true);
    }
    await btn.click();
    const input = page.locator('sw-app [data-search-panel] .search input');
    await expect(input).toBeFocused();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await input.fill('חדר');
    await expect(page.locator('sw-app [data-search-panel] .results')).toBeVisible();
    if (info.project.name === 'desktop') await shot(page, 'shell-desktop-search-open');
    await page.keyboard.press('Escape');
    await expect(page.locator('sw-app [data-search-panel]')).toHaveCount(0);
    await expect(btn).toBeFocused();
    // the shortcut opens the same popover, the field focused
    await page.keyboard.press('Control+k');
    await expect(input).toBeFocused();
    await page.mouse.click(5, 400); // outside: closes
    await expect(page.locator('sw-app [data-search-panel]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('a screen\'s edit mode is an item of the user menu, not a button in the page (shell/screen-edit.ts)', async ({ page }, info) => {
    await open(page, '/explore/floors/f0');
    await expect(page.locator('sw-app explore-floor-map')).toHaveCount(1);
    // no edit-mode button in the page any more
    await expect(page.locator('sw-app explore-floor-map sw-button', { hasText: 'עריכת תוכנית' })).toHaveCount(0);
    const menu = page.locator('sw-app sw-user-menu [data-user-menu]');
    const item = menu.locator('[data-menu-screen-edit="floor-map-edit"]');
    if (phone(info)) {
      // owner decision 2026-09-30: no structure management on a phone - "עריכת המפה" is not offered (evidence-mobile-structure.spec.ts)
      await page.waitForTimeout(1500); // the map has registered its edit mode by now (it just does not pass the phone check)
      await meButton(page, info).click();
      await expect(menu).toBeVisible();
      await expect(menu.locator('[data-menu-screen-edit]')).toHaveCount(0);
      return;
    }
    await expect.poll(async () => {
      await meButton(page, info).click();
      const n = await item.count();
      if (!n) await page.keyboard.press('Escape');
      return n;
    }, { timeout: 15000 }).toBe(1); // the map registers it once its floor has loaded
    await expect(item).toHaveText('עריכת המפה');
    await expect(menu.locator('ul[data-menu-level="main"] > li')).toHaveText(['התראות', 'עריכת המפה', 'מערכת', 'החשבון שלי']); // right after the alerts, before the system
    if (phone(info)) await page.waitForTimeout(300);
    await page.mouse.move(1, 1);
    await page.waitForTimeout(300);
    await shot(page, phone(info) ? 'shell-phone-screen-edit-item' : 'shell-desktop-screen-edit-item');
    await item.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/explore/floors/f0/edit');
    await expect(menu).toBeHidden();
    // Back returns to the map (the menu's own history entry is gone), and the item goes with the screen
    await page.goBack();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/explore/floors/f0');
    await page.goto('/?design=a#/devices/building');
    await page.waitForTimeout(500);
    await meButton(page, info).click();
    await expect(menu.locator('[data-menu-screen-edit]')).toHaveCount(0);
  });

  // 0.1.148 (owner 2026-09-30): the "l" preset is the navigation's default (shell/nav-size.ts NAV_DEFAULT): item 64 x 68, bar 62 px.
  test('the navigation is compact: a rail sized by the large preset, a 62 px bottom bar with 44 px targets', async ({ page }, info) => {
    await open(page, '/devices/building');
    if (phone(info)) {
      const bar = (await page.locator('sw-app nav.bottom').boundingBox())!;
      expect(bar.height).toBeLessThanOrEqual(66);
      for (const el of await page.locator('sw-app nav.bottom > a, sw-app nav.bottom > button').all()) {
        const r = (await el.boundingBox())!;
        expect(r.height).toBeGreaterThanOrEqual(44);
        expect(r.width).toBeGreaterThanOrEqual(44);
      }
    } else {
      const rail = (await page.locator('sw-app nav.rail').boundingBox())!;
      expect(rail.width).toBeLessThanOrEqual(86);
      for (const el of await page.locator('sw-app nav.rail > a[data-nav]').all()) {
        const r = (await el.boundingBox())!;
        expect(r.width).toBeLessThanOrEqual(70);
        expect(r.height).toBeLessThanOrEqual(66);
        expect(r.height).toBeGreaterThanOrEqual(44);
      }
      const av = (await page.locator('sw-app nav.rail sw-avatar').boundingBox())!;
      expect(av.width).toBeLessThanOrEqual(36);
    }
  });

  test('desktop: the security sections sit at the head of the page and switch the section', async ({ page }, info) => {
    test.skip(phone(info), 'the phone has the sticky row (next test)');
    await open(page, '/live');
    const sec = page.locator('sw-app main nav[data-security-sections]');
    await expect(sec).toBeVisible();
    await expect(sec.locator('a')).toHaveText(['לייב', 'חקירה', 'אזעקה']); // the alarm section is last by default (back in the area 2026-09-30)
    await expect(sec.locator('a[data-section="live"]')).toHaveAttribute('aria-current', 'page');
    expect(await shellHeaders(page)).toBe(0);
    // it shares the row with the page's tab row, on the right (RTL start), clear of the corner
    const sb = (await sec.boundingBox())!;
    expect(sb.y).toBeGreaterThan(0);
    expect(sb.x).toBeGreaterThan(500);
    if (info.project.name === 'desktop') await shot(page, 'shell-desktop-security');
    await sec.locator('a[data-section="investigate"]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#\/investigate\//);
    await expect(page.locator('sw-app main nav[data-security-sections] a[data-section="investigate"]')).toHaveAttribute('aria-current', 'page');
  });

  test('old deep links still open their screens (no redirect to ראשי)', async ({ page }) => {
    for (const [hash, tag] of [
      ['/explore/floors/f0', 'explore-floor-map'],
      ['/live/wall', 'live-wall'],
      ['/investigate/events', 'investigate-events'],
      ['/security/alarm', 'security-alarm'],
      ['/system/security/alarm', 'security-alarm'], // the same screen as a page of הגדרות › אבטחה
      ['/system/diagnostics', 'system-diagnostics'],
      ['/system/notifications', 'system-notifications'], // CR-018: the administrator's sections (the device registration inside it, or alone for everyone else)
      ['/wiskey/overview', 'wiskey-overview'],
      ['/devices/building', 'devices-building'],
    ] as const) {
      await open(page, hash);
      await expect(page.locator(`sw-app ${tag}`), hash).toHaveCount(1);
      expect(await page.evaluate(() => location.hash), hash).toBe(`#${hash}`);
    }
  });

  test('the user menu: התראות · מערכת · החשבון שלי, a second level, no subtitles; Escape closes it', async ({ page }, info) => {
    await open(page, '/devices/building');
    const me = meButton(page, info);
    await expect(me).toBeVisible();
    await expect(me).toHaveAttribute('aria-expanded', 'false');
    await expect(me).not.toHaveClass(/active/);
    await me.click();
    await page.mouse.move(1, 1); // no hover artefact in the evidence
    const menu = page.locator('sw-app sw-user-menu [data-user-menu]');
    await expect(menu).toBeVisible();
    await expect(me).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.locator('[data-user-name]')).toHaveText('יוני');
    // first level: exactly התראות · מערכת · החשבון שלי, one line each, no count chip without open alerts
    // 0.1.148: the cards | tiles view choice sits in the user menu ("תצוגה"), between the alerts and the system
    await expect(menu.locator('ul[data-menu-level="main"] > li')).toHaveText([/^\s*התראות\s*$/, /^\s*תצוגה\s*כרטיסים\s*אריחים\s*$/, /^\s*מערכת\s*$/, /^\s*החשבון שלי\s*$/]);
    await expect(menu.locator('[data-alert-count]')).toHaveCount(0);
    await expect(menu.locator('small')).toHaveCount(0);
    await expect(menu.locator('[data-menu-settings]')).toHaveAttribute('href', '#/system/diagnostics');
    await expect(page.locator('sw-app sw-user-menu [data-menu-screens]')).toHaveCount(0);
    // the demo pill moved from the top bar into the menu's header on the phone; one status pill on the page
    if (phone(info)) await expect(menu.locator('[data-user-menu-pills]')).toBeVisible();
    else await expect(menu.locator('[data-user-menu-pills]')).toBeHidden();
    await page.waitForTimeout(300); // the sheet's slide-in
    await shot(page, phone(info) ? 'shell-phone-user-menu' : `shell-${info.project.name}-user-menu`);
    // second level in the same panel
    await menu.locator('[data-menu-account]').click();
    await expect(menu.locator('ul[data-menu-level="account"] > li')).toHaveText(['סדר הלשוניות', 'הגדרות התראות']);
    await expect(menu.locator('[data-menu-notify-prefs]')).toHaveAttribute('href', '#/system/notifications');
    await page.keyboard.press('Escape'); // back to the first level
    await expect(menu.locator('[data-menu-account]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(me).toHaveAttribute('aria-expanded', 'false');
    // מערכת from the menu opens the settings; the menu closes on navigation; the avatar is the active item there
    await me.click();
    await menu.locator('[data-menu-settings]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/system/diagnostics');
    await expect(menu).toBeHidden();
    await expect(me).toHaveClass(/active/);
    await expect(me).toHaveAttribute('aria-current', 'page');
    await expect(page.locator(`${navSel(info)} a[aria-current="page"]`)).toHaveCount(0);
    // "כל המסכים" is a system tab now (system.configure; everything in the demo)
    await expect(page.locator('sw-app .subnav sw-tabs a[href="#/screens"]')).toHaveCount(1);
  });

  test('Back closes the phone sheet and the tab-order dialog, not the screen', async ({ page }, info) => {
    await open(page, '/live/wall');
    await page.goto('/?design=a#/devices/building');
    await page.waitForTimeout(400);
    const menu = page.locator('sw-app sw-user-menu [data-user-menu]');
    if (phone(info)) {
      await meButton(page, info).click();
      await expect(menu).toBeVisible();
      await page.goBack();
      await expect(menu).toBeHidden();
      expect(await page.evaluate(() => location.hash)).toBe('#/devices/building');
      await expect(page.locator('sw-app devices-building')).toHaveCount(1);
    }
    await openOrder(page, info);
    const dlg = page.locator('sw-app sw-nav-order li[data-tab]').first();
    await expect(dlg).toBeVisible();
    await page.goBack();
    await expect(dlg).toBeHidden();
    expect(await page.evaluate(() => location.hash)).toBe('#/devices/building');
    await expect(page.locator('sw-app devices-building')).toHaveCount(1);
    // closed with ✕, the entry goes too: Back then leaves the screen as usual
    await openOrder(page, info);
    await expect(dlg).toBeVisible();
    await page.locator('sw-app sw-nav-order sw-dialog sw-button[label="סגור"]').click();
    await expect(dlg).toBeHidden();
    await page.waitForTimeout(200);
    await page.goBack();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/live/wall');
  });

  test('the kiosk and the Lovelace card view show no bars, no avatar and no user menu', async ({ page }) => {
    for (const hash of ['/kiosk/all', '/live/wall?embed=1']) {
      await open(page, hash);
      await expect(page.locator('sw-app nav.rail, sw-app nav.bottom, sw-app [data-float]'), hash).toHaveCount(0);
      await expect(page.locator('sw-app sw-user-menu, sw-app [data-nav-me], sw-app [data-profile-menu]'), hash).toHaveCount(0);
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('sw-app')!).paddingTop), hash).toBe('0px');
      await page.evaluate(() => sessionStorage.clear());
    }
  });

  test('phone: the security sections as a sticky row and the tab row scrolls without clipping', async ({ page }, info) => {
    test.skip(!phone(info), 'the phone layout (390 px)');
    await open(page, '/live');
    const row = page.locator('sw-app nav[data-security-row]');
    await expect(row).toBeVisible();
    await expect(row.locator('a')).toHaveText(['לייב', 'חקירה', 'אזעקה']);
    await expect(row.locator('a[data-section="live"]')).toHaveAttribute('aria-current', 'page');
    for (const a of await row.locator('a').all()) expect((await a.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('sw-app .subnav sw-tabs a')).toHaveText(['תמונת מצב', 'כל המצלמות', 'תצוגות שמורות']);
    // the investigation's row is the long one (camera health is its last tab since 2026-09-30)
    await open(page, '/investigate/events');
    const tabs = page.locator('sw-app .subnav sw-tabs');
    // the second level: the compact underline variant (0.1.148), still 44 px targets
    await expect(tabs).toHaveAttribute('data-variant', 'underline-compact');
    for (const a of await tabs.locator('a').all()) expect((await a.boundingBox())!.height).toBeGreaterThanOrEqual(44);
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
    // 1 px: the investigation row (ten tabs) ends a sub-pixel outside the box after the snap; a clipped word would be far more
    expect(lb.x).toBeGreaterThanOrEqual(box.x - 1);
    expect(lb.x + lb.width).toBeLessThanOrEqual(box.x + box.width + 1);
    // the active tab is revealed on its own when it sits at the far end
    await open(page, '/investigate/health');
    const on = page.locator('sw-app .subnav sw-tabs a.on');
    await expect(on).toHaveText('בריאות מצלמות');
    await page.waitForTimeout(200);
    const tb = (await page.locator('sw-app .subnav sw-tabs').boundingBox())!;
    const ob = (await on.boundingBox())!;
    expect(ob.x).toBeGreaterThanOrEqual(tb.x - 1); // sub-pixel: the scroll extent is rounded to whole pixels
    expect(ob.x + ob.width).toBeLessThanOrEqual(tb.x + tb.width + 1);
    // only the section row stays at the top while the content scrolls; the tab row scrolls away with it
    await open(page, '/live');
    const sticky = (await page.locator('sw-app nav[data-security-row]').boundingBox())!;
    expect(sticky.height).toBeLessThanOrEqual(50);
    await page.locator('sw-app main').evaluate((m) => m.scrollTo(0, 600));
    await page.waitForTimeout(200);
    expect((await page.locator('sw-app nav[data-security-row]').boundingBox())!.y).toBeLessThan(20);
    expect((await page.locator('sw-app .subnav sw-tabs').boundingBox())!.y).toBeLessThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('tab order (this browser in the demo): by buttons, save, reload keeps it, reset', async ({ page }, info) => {
    await open(page, '/devices/building');
    await page.evaluate(() => sessionStorage.setItem('cr013-keep', '1'));
    await openOrder(page, info);
    const dlg = page.locator('sw-app sw-nav-order');
    await expect(dlg.locator('li[data-tab]')).toHaveCount(5);
    await expect(dlg.locator('li[data-tab] .name')).toHaveText(TABS);
    await page.waitForTimeout(250);
    if (phone(info)) await shot(page, 'shell-phone-tab-order');
    // WisKey to the top with the ▲ buttons, then אבטחה down one
    for (let i = 0; i < 4; i++) await dlg.locator('li[data-tab="wiskey"] [data-move="up"]').click();
    await dlg.locator('li[data-tab="security"] [data-move="down"]').click();
    await expect(dlg.locator('li[data-tab] .name')).toHaveText(['WisKey', 'ראשי', 'מפה', 'אבטחה', 'מולטימדיה']);
    await expect(dlg.locator('[data-nav-order-announce]')).toContainText('אבטחה הועבר למקום 4');
    await dlg.locator('[data-nav-order-save]').click();
    await expect(dlg.locator('sw-dialog')).toBeHidden();
    expect(await navTabs(page, info)).toEqual(['wiskey', 'devices', 'explore', 'security', 'multimedia']);
    await page.reload();
    await page.waitForTimeout(500);
    expect(await navTabs(page, info)).toEqual(['wiskey', 'devices', 'explore', 'security', 'multimedia']);
    // keyboard on the handle
    await openOrder(page, info);
    await dlg.locator('li[data-tab="explore"] .handle').focus();
    await expect(dlg.locator('li[data-tab="explore"] .handle')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(dlg.locator('li[data-tab] .name')).toHaveText(['מפה', 'WisKey', 'ראשי', 'אבטחה', 'מולטימדיה']);
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
  rulesRequests = 0;

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
    if (p === 'rules') {
      this.rulesRequests += 1;
      if (!u.perms.includes('rules.manage')) return json({ code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: '', details: {} }, 403);
      return json({ rules: [], types: [], sources: [], action_kinds: ['notify'], days: [] });
    }
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    if (p === 'cameras') return json({ cameras: [], recorder: null, can_sync: false });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  }
}

test.describe('CR-013 shell with a (mocked) backend', () => {
  let mock: Mock;

  test.beforeEach(async ({ page }) => {
    mock = new Mock();
    await page.route('**/api/v1/**', (r) => mock.handle(r));
  });

  test('the status dot and the failure banner lead to הגדרות › בריאות only for who may open it', async ({ page }) => {
    await page.route('**/api/v1/health/summary', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', items: [{ id: 'nvr', status: 'error', label: 'מקליט לא זמין' }], checked_at: '2026-09-30T10:00:00Z' }) }),
    );
    // an administrator: the dot is a button that opens the health tab, and the banner has its link
    await open(page, '/devices/building');
    await expect(page.locator('sw-app button[data-sys-pill]')).toHaveCount(1);
    await expect(page.locator('sw-app [data-sys-banner] a')).toHaveCount(1);
    // a viewer without system.configure: the same dot, not a button - and no link in the banner
    mock.user = VIEWER;
    await open(page, '/devices/building');
    await expect(page.locator('sw-app [data-sys-pill]')).toHaveCount(1);
    await expect(page.locator('sw-app button[data-sys-pill]')).toHaveCount(0);
    await expect(page.locator('sw-app [data-sys-pill][data-sys-static]')).toHaveAttribute('aria-label', /מצב המערכת: תקלה/);
    await expect(page.locator('sw-app [data-sys-banner]')).toBeVisible();
    await expect(page.locator('sw-app [data-sys-banner] a')).toHaveCount(0);
    await page.locator('sw-app [data-sys-pill]').click({ force: true });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => location.hash)).not.toContain('diagnostics');
  });

  test('the bare address lands on ראשי; settings shown only with a settings permission; WisKey only with access.read', async ({ page }, info) => {
    await open(page);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building');
    expect(await navTabs(page, info)).toEqual(VISIBLE_ORDER);
    await meButton(page, info).click();
    const menu = page.locator('sw-app sw-user-menu [data-user-menu]');
    await expect(menu.locator('[data-user-name]')).toHaveText('יוני אוליאל');
    await expect(menu.locator('[data-user-role]')).toHaveText('מנהל מערכת');
    await expect(menu.locator('[data-menu-settings]')).toHaveCount(1);
    // a viewer without the alarm: no settings item (their own notification preferences stay), no WisKey tab
    mock.user = { ...VIEWER, perms: VIEWER.perms.filter((p) => p !== 'alarm.view') };
    await open(page);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building');
    expect(await navTabs(page, info)).toEqual(['devices', 'security', 'explore']);
    await meButton(page, info).click();
    await expect(menu.locator('[data-user-name]')).toHaveText('דנה כהן');
    await expect(menu.locator('[data-menu-settings]')).toHaveCount(0);
    await menu.locator('[data-menu-account]').click();
    await expect(menu.locator('[data-menu-notify-prefs]')).toHaveAttribute('href', '#/system/notifications');
    // a viewer who holds alarm.view: the alarm lives in הגדרות › אבטחה (2026-09-30), so the menu offers "מערכת" opening there
    mock.user = VIEWER;
    await open(page);
    await meButton(page, info).click();
    await expect(menu.locator('[data-menu-settings]')).toHaveAttribute('href', '#/system/security');
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
    await page.mouse.move(1, 1);
    const menu = page.locator('sw-app sw-user-menu [data-user-menu]');
    await expect(menu.locator('[data-menu-alerts] [data-alert-count]')).toHaveText('3');
    // one status indicator on the page, the corner dot (every width); the phone sheet keeps no copy of it
    await expect(page.locator('sw-app [data-sys-pill]')).toHaveCount(1);
    await expect(page.locator('sw-app [data-menu-sys-pill]')).toHaveCount(0);
    await page.waitForTimeout(300);
    if (phone(info)) await shot(page, 'shell-phone-user-menu-alerts');
    else if (info.project.name === 'desktop') await shot(page, 'shell-desktop-user-menu-alerts');
    await menu.locator('[data-menu-alerts]').click();
    // CR-018: the bell opens the notification center (it no longer navigates); this backend mock has no notifications API, so the center says so
    await expect(page.locator('sw-app notify-center')).toHaveAttribute('open', '');
    await expect(page.locator('sw-app notify-center [data-center-state="error"]')).toBeVisible();
    expect(await page.evaluate(() => location.hash)).toBe('#/devices/building');
    await page.keyboard.press('Escape');
    // the rule-alert inbox stays where it was: the alerts tab of the rules (the rule alerts also arrive in the center as the source "התראות מחוקים")
    await open(page, '/investigate/rules?tab=alerts');
    const rules = page.locator('sw-app investigate-rules');
    await expect(rules.locator('sw-tabs button[aria-pressed="true"]')).toContainText('התראות');
    await expect(rules.locator('[data-alert-row]')).toHaveCount(3);
    await expect(rules.locator('[data-alert-ack]')).toHaveCount(0); // the admin mock holds no events.ack
    // a single open alert reads in the singular
    mock.alerts = 1;
    await open(page, '/devices/building');
    await expect(meButton(page, info)).toHaveAttribute('aria-label', /התראה פתוחה אחת/);
    // no open alerts: no dot, no chip in the menu
    mock.alerts = 0;
    await open(page, '/devices/building');
    await expect(meButton(page, info).locator('[data-alert-dot]')).toHaveCount(0);
    await expect(meButton(page, info)).not.toHaveAttribute('aria-label', /התראות פתוחות|התראה פתוחה/);
    await meButton(page, info).click();
    await expect(menu.locator('[data-menu-alerts]')).toBeVisible();
    await expect(menu.locator('[data-alert-count]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    // a user who may not read alerts: no dot and no התראות item
    mock.user = NO_ALERTS_VIEWER;
    mock.alerts = 5;
    await open(page, '/devices/building');
    await expect(meButton(page, info).locator('[data-alert-dot]')).toHaveCount(0);
    await meButton(page, info).click();
    await expect(menu.locator('[data-menu-alerts]')).toHaveCount(0);
  });

  test('the system status is a small dot: its state is the accessible name; a failure raises the banner', async ({ page }, info) => {
    await page.route('**/api/v1/health/summary', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', items: [{ id: 'nvr', status: 'error', label: 'מקליט לא זמין' }], checked_at: '2026-09-30T00:00:00Z', version: 'test' }) }),
    );
    await open(page, '/devices/building');
    const dot = page.locator('sw-app [data-sys-pill]');
    await expect(dot).toHaveCount(1);
    await expect(dot).toHaveAttribute('data-status', 'error');
    await expect(dot).toHaveAttribute('aria-label', /מצב המערכת: תקלה/);
    expect(((await dot.textContent()) ?? '').trim()).toBe('');
    expect((await dot.boundingBox())!.width).toBeLessThanOrEqual(32);
    await expect(page.locator('sw-app [data-sys-banner]')).toBeVisible();
    // the banner keeps the top edge and the corner drops below it
    const bb = (await page.locator('sw-app [data-sys-banner]').boundingBox())!;
    const fb = (await page.locator('sw-app [data-float]').boundingBox())!;
    expect(fb.y).toBeGreaterThanOrEqual(bb.y + bb.height);
    if (info.project.name === 'desktop') await shot(page, 'shell-desktop-status-error');
    await dot.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/system/diagnostics?tab=health');
  });

  test('"עריכת המסך הראשי": only on the home screen, only for who may edit the home layout; it opens the home with edit=1', async ({ page }, info) => {
    const menu = page.locator('sw-app sw-user-menu [data-user-menu]');
    // owner 2026-09-30: the item is the home screen's own - never on the map, the wall, an area or the schedules
    for (const away of ['/explore/floors/f0', '/live/wall', '/devices/areas/none', '/devices/schedules']) {
      await open(page, away);
      await meButton(page, info).click();
      await expect(menu.locator('ul[data-menu-level="main"]')).toBeVisible();
      await expect(menu.locator('[data-menu-edit-home]'), away).toHaveCount(0);
      await page.keyboard.press('Escape');
    }
    // the home, plain and with a query (the panel deep link): the item is there
    await open(page, '/devices/building?domain=lights');
    await meButton(page, info).click();
    await expect(menu.locator('[data-menu-edit-home]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await open(page, '/devices/building');
    await meButton(page, info).click();
    await expect(menu.locator('ul[data-menu-level="main"] > li').filter({ hasText: 'עריכת המסך הראשי' })).toHaveCount(1);
    const item = menu.locator('[data-menu-edit-home]');
    await expect(item).toHaveAttribute('href', '#/devices/building?edit=1');
    if (phone(info)) await page.waitForTimeout(300);
    await item.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building?edit=1');
    await expect(menu).toBeHidden();
    // no system.configure (the home's edit button needs it): no item
    mock.user = VIEWER;
    await open(page, '/devices/building');
    await meButton(page, info).click();
    await expect(menu.locator('[data-menu-edit-home]')).toHaveCount(0);
    // the viewer holds alarm.view: הגדרות › אבטחה › אזעקה is theirs, so the user menu offers "מערכת" (2026-09-30)
    await expect(menu.locator('ul[data-menu-level="main"] > li')).toHaveText([/התראות/, /תצוגה/, /מערכת/, /החשבון שלי/]);
  });

  test('a user without rules.manage: the alerts inbox only - no rules request, no rules tab, no "חוק חדש"', async ({ page }) => {
    mock.user = { ...VIEWER, perms: [...VIEWER.perms, 'events.ack'] };
    mock.alerts = 2;
    await open(page, '/investigate/rules?tab=alerts');
    const rules = page.locator('sw-app investigate-rules');
    await expect(rules.locator('[data-alert-row]')).toHaveCount(2);
    await expect(rules.locator('sw-tabs button')).toHaveText([/התראות/]);
    await expect(rules.locator('[data-rule-new]')).toHaveCount(0);
    await expect(rules.locator('[data-alert-ack]')).toHaveCount(2); // events.ack: the acknowledge button
    expect(mock.rulesRequests).toBe(0);
    // the plain rules address too
    await open(page, '/investigate/rules');
    await expect(rules.locator('[data-alert-row]')).toHaveCount(2);
    expect(mock.rulesRequests).toBe(0);
  });

  test('tab order per user on the server: drag, save, reload (server wins), a second user unaffected, reset', async ({ page }, info) => {
    await open(page, '/devices/building');
    await openOrder(page, info);
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
    expect(mock.puts[0]).toEqual({ user: 'u-admin', body: { 'nav.order': ['explore', 'devices', 'security', 'multimedia', 'wiskey'] } });
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
    await expect.poll(() => navTabs(page, info)).toEqual(VISIBLE_ORDER);
    // the first user resets
    mock.user = ADMIN;
    await open(page, '/devices/building');
    await expect.poll(() => navTabs(page, info)).toEqual(['wiskey', 'explore', 'devices', 'security']);
    await openOrder(page, info);
    await dlg.locator('[data-nav-order-reset]').click();
    await expect.poll(() => mock.puts.at(-1)).toEqual({ user: 'u-admin', body: { 'nav.order': null } });
    expect(await navTabs(page, info)).toEqual(VISIBLE_ORDER);
    expect(mock.prefs.has('u-second')).toBe(false);
  });

  test('a hidden tab keeps its place in the stored order', async ({ page }, info) => {
    mock.user = VIEWER; // no WisKey
    mock.prefs.set('u-viewer', ['wiskey', 'explore', 'devices', 'security']);
    await open(page, '/devices/building');
    await expect.poll(() => navTabs(page, info)).toEqual(['explore', 'devices', 'security']);
    await openOrder(page, info);
    const dlg = page.locator('sw-app sw-nav-order');
    await expect(dlg.locator('li[data-tab]')).toHaveCount(3);
    await dlg.locator('li[data-tab="security"] [data-move="up"]').click();
    await dlg.locator('[data-nav-order-save]').click();
    await expect.poll(() => mock.puts.at(-1)?.body).toEqual({ 'nav.order': ['wiskey', 'explore', 'security', 'devices', 'multimedia'] });
  });
});
