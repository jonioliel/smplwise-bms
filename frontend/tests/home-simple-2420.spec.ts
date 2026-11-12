import { expect, test, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockHome, type HomeDataset } from './home-simple-mocks';

// HOME-SIMPLE-2420: the home interface at the three sizes the owner checks (tablet 1280x800, phone 390x844, desktop 1440x900):
// no control screen scrolls, touch targets of at least 56 px on the tablet (44 on the phone), right-to-left, and no platform or
// internal word on any screen. Mocked backend (tests/home-simple-mocks.ts); screenshots under docs/changes/evidence/HOME-SIMPLE-2420/.

const SIZES = [{ id: 'tablet', width: 1280, height: 800 }, { id: 'phone', width: 390, height: 844 }, { id: 'desktop', width: 1440, height: 900 }];
const SCREENS = ['r/home', 'r/living', 'rooms', 'lights', 'climate', 'shades', 'doors', 'cameras', 'energy', 'alerts', 'scenes', 'active', 'security', 'settings/favs', 'settings/rooms', 'settings/scenes', 'settings/themes', 'settings/view'];
const FORBIDDEN = ['Home Assistant', 'go2rtc', 'NVR', 'WebRTC', 'entity', 'ישות'];
const SHOTS = 'test-results/home-simple-2420'; // the side-by-side comparisons with the mockup are kept in docs/changes/evidence/HOME-SIMPLE-2420/compare

async function open(page: Page, route: string, ds: HomeDataset = 'demo', extra: Parameters<typeof mockHome>[1] = {}) {
  const mock = await mockHome(page, { ds, ...extra });
  await page.goto(`/#/home/${route}`);
  await page.locator('sw-home').waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2, .hs.bare .welcome'))).toBe(true);
  await settle(page);
  return mock;
}

/** Geometry of the home element's shadow root: overflow of the page and of every scroll container, small targets, words. */
async function audit(page: Page, minTarget: number) {
  return page.evaluate((min) => {
    const host = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!;
    const root = host.shadowRoot!;
    const doc = document.scrollingElement!;
    const overflow: string[] = [];
    if (doc.scrollHeight - doc.clientHeight > 1) overflow.push(`document ${doc.scrollHeight}>${doc.clientHeight}`);
    const main = root.querySelector('#main') as HTMLElement | null;
    if (main && main.scrollHeight - main.clientHeight > 1) overflow.push(`main ${main.scrollHeight}>${main.clientHeight}`);
    const hs = root.querySelector('.hs') as HTMLElement | null;
    if (hs && hs.scrollHeight - hs.clientHeight > 1) overflow.push(`hs ${hs.scrollHeight}>${hs.clientHeight}`);
    if (hs && hs.scrollWidth - hs.clientWidth > 1) overflow.push(`hs-x ${hs.scrollWidth}>${hs.clientWidth}`);
    const small: string[] = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('.hs button, .hs a[href], .hs input[type=range]'))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
      if (el.closest('.cover') || el.classList.contains('cover')) continue; // a whole-tile link: the tile is the target
      // a segmented button / status pill widens its hit area with an absolutely placed ::after (the mockup's rule): count it
      const after = getComputedStyle(el, '::after');
      const grow = after.content !== 'none' && after.position === 'absolute' ? Math.max(0, -parseFloat(after.top || '0')) + Math.max(0, -parseFloat(after.bottom || '0')) : 0;
      if (Math.min(r.width, r.height + grow) < min - 0.5) small.push(`${el.tagName.toLowerCase()}.${el.className}[${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    const text = (root as unknown as { textContent: string }).textContent ?? '';
    const labels = Array.from(root.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label')).join(' ');
    return { overflow, small, text: text + ' ' + labels, dir: getComputedStyle(hs ?? host).direction, scrollTop: main?.scrollTop ?? 0 };
  }, minTarget);
}

test.describe('HOME-SIMPLE-2420 home interface', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sizes are set per test'));

  for (const size of SIZES) {
    test(`every screen fits without scrolling, RTL, targets, words - ${size.id}`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: size.width, height: size.height });
      const problems: string[] = [];
      for (const s of SCREENS) {
        await open(page, s);
        const a = await audit(page, size.id === 'phone' ? 44 : 56);
        if (a.overflow.length) problems.push(`${s}: overflow ${a.overflow.join(', ')}`);
        if (size.id === 'tablet' && a.small.length) problems.push(`${s}: small ${a.small.slice(0, 4).join('; ')}`);
        if (a.dir !== 'rtl') problems.push(`${s}: direction ${a.dir}`);
        if (a.scrollTop !== 0) problems.push(`${s}: scrollTop ${a.scrollTop}`);
        for (const w of FORBIDDEN) if (a.text.includes(w)) problems.push(`${s}: says "${w}"`);
        await page.screenshot({ path: `${SHOTS}/${size.id}-${s.replace(/\//g, '_')}.png` });
      }
      expect(problems).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------- behaviour (the existing control paths, the locks)

const inHome = (page: Page) => page.locator('sw-home');
const actionsOf = (m: { calls: { method: string; path: string; body: unknown }[] }) => m.calls.filter((c) => c.path.startsWith('ha/entities/')).map((c) => `${c.path.split('/')[2]} ${(c.body as { allowed_action_id: string }).allowed_action_id}${(c.body as { confirmation_grant?: string }).confirmation_grant ? ' confirmed' : ''}`);

test.describe('HOME-SIMPLE-2420 behaviour', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one size is enough for the behaviour');
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('a light toggles through the device action route; a light switch sends on/off', async ({ page }) => {
    const m = await open(page, 'lights');
    await inHome(page).locator('button.lamp[data-l="light.l_main"]').click();
    await expect.poll(() => actionsOf(m)).toContain('light.l_main light.turn_off');
    await inHome(page).locator('.lcard', { hasText: 'פס תאורה במדפים' }).locator('button.hsw').click();
    await expect.poll(() => actionsOf(m)).toContain('switch.l_shelf switch.turn_on');
  });

  test('room off turns off lights and climate, never a non-light switch; the toast says what stayed on', async ({ page }) => {
    const m = await open(page, 'r/kitchen');
    await inHome(page).locator('.nowbar .nb-off').click();
    await expect.poll(() => m.calls.some((c) => c.path === 'devices/actions')).toBe(true);
    const bulk = m.calls.filter((c) => c.path === 'devices/actions').map((c) => c.body as { kind: string; scope: string; id: string });
    expect(bulk).toEqual([expect.objectContaining({ kind: 'lights_off', scope: 'area', id: 'kitchen' })]);
    expect(actionsOf(m).filter((a) => a.startsWith('switch.k_'))).toEqual([]);
    await expect(inHome(page).locator('.toast2')).toContainText('מפסקים שאינם אור נשארו דולקים');
  });

  test('a guarded switch asks before it turns off', async ({ page }) => {
    const m = await open(page, 'lights');
    await inHome(page).locator('[data-act="lightsTab"][data-v="loads"]').click();
    await inHome(page).locator('.lcard', { hasText: 'מקרר' }).locator('button.hsw').click();
    await expect(inHome(page).locator('.sheet.dialog')).toContainText('לכבות את מקרר?');
    expect(actionsOf(m)).toEqual([]);
    await inHome(page).locator('[data-act="guardOff"]').click();
    await expect.poll(() => actionsOf(m)).toContain('switch.k_fridge switch.turn_off');
  });

  test('a door opens only after the confirmation, with the explicit grant the server asks for', async ({ page }) => {
    const m = await open(page, 'doors');
    await inHome(page).locator('.drow', { hasText: 'דלת הכניסה' }).locator('[data-act="doorAsk"]').click();
    await expect(inHome(page).locator('.sheet.dialog')).toContainText('לפתוח את דלת הכניסה?');
    expect(actionsOf(m)).toEqual([]);
    await inHome(page).locator('[data-act="doorOpen"]').click();
    await expect.poll(() => actionsOf(m)).toEqual(['lock.front lock.unlock confirmed']);
  });

  test('a shutter moves on the second tap (the movement confirmation), stop at once', async ({ page }) => {
    const m = await open(page, 'shades');
    const card = inHome(page).locator('.lcard', { hasText: 'וילון חלון גדול' });
    await card.locator('[data-v="stop"]').click();
    await expect.poll(() => actionsOf(m)).toEqual(['cover.l_win cover.stop_cover']);
    await card.locator('[data-v="close"]').click();
    await expect(card).toContainText('לחצו שוב לאישור');
    expect(actionsOf(m)).toHaveLength(1);
    await card.locator('[data-v="close"]').click();
    await expect.poll(() => actionsOf(m)).toContain('cover.l_win cover.close_cover confirmed');
  });

  test('a favourite and a theme are saved as the person own choice', async ({ page }) => {
    const m = await open(page, 'lights');
    await inHome(page).locator('.lcard', { hasText: 'מנורת פינה' }).locator('[data-act="star"]').click();
    await expect.poll(() => m.calls.filter((c) => c.path === 'home/prefs').length).toBeGreaterThan(0);
    await page.evaluate(() => { location.hash = '#/home/settings/themes'; });
    await inHome(page).locator('[data-act="hs"][data-v="ocean"]').click();
    await expect(inHome(page)).toHaveAttribute('data-hs-theme', 'ocean');
    await expect.poll(() => m.calls.some((c) => JSON.stringify(c.body).includes('"theme":"ocean"'))).toBe(true);
  });

  test('the alarm arms with one confirmation through the alarm route', async ({ page }) => {
    const m = await open(page, 'security');
    await inHome(page).locator('[data-act="almArm"][data-v="arm_away"]').click(); // HOME-V3-P1-2430: the alarm screen follows mockup v3
    await inHome(page).locator('[data-act="askYes"]').click();
    await expect.poll(() => m.calls.filter((c) => c.path === 'alarm/actions').map((c) => JSON.stringify(c.body))).toContainEqual(expect.stringContaining('"action":"arm_away","confirmed":true'));
  });

  test('a home-only person is kept in the home interface', async ({ page }) => {
    await mockHome(page, { policy: { home_only: true, may_switch: false } });
    await page.goto('/#/devices/building');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/home');
    await inHome(page).locator('.st-me').click();
    await expect(inHome(page).locator('.face-choice button[data-v="full"]')).toBeDisabled();
    await expect(inHome(page).locator('.lock-note')).toContainText('הממשק נקבע על ידי מנהל הבית');
  });

  test('a wall panel is locked to its room without the personal menu; the exit code opens it', async ({ page }) => {
    await mockHome(page, { policy: { kiosk: true, home_only: true, may_switch: false, kiosk_area_id: 'living' } });
    let exits = 0;
    await page.route('**/api/v1/home/kiosk/exit', (r) => { exits++; return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
    await page.goto('/#/home/rooms');
    await expect(inHome(page).locator('.tb-room h1')).toHaveText('סלון');
    await expect(inHome(page).locator('a.tb-room')).toHaveCount(0);
    await expect(inHome(page).locator('.st-me')).toBeHidden();
    const clock = inHome(page).locator('.hs-now');
    await settle(page);
    const box = await clock.boundingBox();
    await page.mouse.move(box!.x + 10, box!.y + 10);
    await page.mouse.down();
    await page.waitForTimeout(1400);
    await page.mouse.up();
    for (const k of ['1', '2', '3', '4']) await inHome(page).locator(`[data-act="kioskKey"][data-k="${k}"]`).click();
    await inHome(page).locator('[data-act="kioskGo"]').click();
    await expect.poll(() => exits).toBe(1);
    await expect(inHome(page).locator('a.tb-room')).toHaveCount(1);
  });

  test('the full interface offers the switch to the home interface in the personal menu', async ({ page }) => {
    const m = await mockHome(page, { policy: { interface: 'full', default_interface: 'full' } });
    await page.goto('/#/devices/building');
    await page.locator('sw-app').evaluate((el) => { (el as unknown as { menuOpen: boolean }).menuOpen = true; });
    await page.locator('sw-user-menu [data-menu-home-interface]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/home');
    await expect.poll(() => m.calls.some((c) => c.path === 'me/interface' && JSON.stringify(c.body) === '{"interface":"home"}')).toBe(true);
  });
});

// ---------------------------------------------------------------- slice 7: the call sheet, the waiting pill, the active scene, the cost, the talk

test.describe('HOME-SIMPLE-2420 slice 7', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sizes are set per test'));

  for (const size of SIZES) {
    test(`the incoming call sheet fills the screen without scrolling - ${size.id}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await open(page, 'r/home', 'demo', { ringing: true });
      const sheet = inHome(page).locator('sw-home-call section.call');
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText('מישהו ב');
      await expect(sheet.locator('[data-call-answer]')).toContainText('ענה ודבר');
      await expect(sheet.locator('[data-call-door]')).toContainText('פתח דלת');
      await expect(sheet.locator('[data-call-ignore]')).toContainText('התעלם');
      await expect(sheet.locator('sw-camera-tile')).toHaveCount(1);
      await settle(page);
      const g = await page.evaluate(() => {
        const call = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!.querySelector('sw-home-call')!.shadowRoot!;
        const sec = call.querySelector('section.call') as HTMLElement;
        const r = sec.getBoundingClientRect();
        const doc = document.scrollingElement!;
        const small = Array.from(call.querySelectorAll('button')).map((b) => b.getBoundingClientRect()).filter((x) => x.height && x.height < 56).length;
        return { over: doc.scrollHeight - doc.clientHeight, top: doc.scrollTop, inside: sec.scrollHeight - sec.clientHeight, w: r.width, h: r.height, small };
      });
      expect(g.over).toBeLessThanOrEqual(1);
      expect(g.top).toBe(0);
      expect(g.inside).toBeLessThanOrEqual(1);
      if (size.id === 'tablet') expect(g.small).toBe(0);
      await page.screenshot({ path: `${SHOTS}/${size.id}-call.png` });
    });
  }

  test('open the door from the call: a confirmation, then the existing release route with its confirmation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const m = await open(page, 'r/home', 'demo', { ringing: true });
    const sheet = inHome(page).locator('sw-home-call section.call');
    await sheet.locator('[data-call-door]').click();
    await expect(sheet).toContainText('לפתוח את דלת הכניסה?');
    expect(m.calls.filter((c) => c.path === 'intercom/release')).toEqual([]);
    await sheet.locator('[data-call-door-yes]').click();
    await expect.poll(() => m.calls.filter((c) => c.path === 'intercom/release').map((c) => (c.body as { confirmed: boolean; lock: number }))).toEqual([expect.objectContaining({ confirmed: true, lock: 0 })]);
  });

  test('ignore leaves "מחכים בדלת" in the strip; a tap shows the call again', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => sessionStorage.removeItem('sw.calls.hidden'));
    await open(page, 'r/home', 'demo', { ringing: true });
    await inHome(page).locator('sw-home-call [data-call-ignore]').click();
    await expect(inHome(page).locator('sw-home-call section.call')).toHaveCount(0);
    const pill = inHome(page).locator('.st-pill.call');
    await expect(pill).toContainText('מחכים בדלת');
    await pill.click();
    await expect(inHome(page).locator('sw-home-call section.call')).toBeVisible();
  });

  test('the scene just run is shown as on, with its toast', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => sessionStorage.removeItem('home.lastScene'));
    await open(page, 'r/home');
    const evening = inHome(page).locator('.wg-btn.scene[data-scene="evening"]');
    await expect(evening).toHaveAttribute('aria-pressed', 'false');
    await evening.click();
    await expect(evening).toHaveAttribute('aria-pressed', 'true');
    await expect(inHome(page).locator('.toast2')).toContainText('סצנת ערב הופעלה');
  });

  test('the cost estimate shows only with the tariff read permission', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockHome(page);
    await page.goto('/#/home/energy');
    await expect(inHome(page).locator('.hs-head')).toContainText('קוט״ש');
    await expect(inHome(page).locator('[data-energy-cost]')).toHaveCount(0);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mockHome(page, { perms: ['devices.read', 'devices.control', 'energy.view', 'energy.bills'] });
    await page.goto('about:blank');
    await page.goto('/#/home/energy');
    await expect(inHome(page).locator('[data-energy-cost]')).toContainText('₪');
  });

  test('"דבר עם הכניסה" opens the existing talk control of the entrance', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, 'doors');
    await inHome(page).locator('[data-act="talk"]').click();
    await expect(inHome(page).locator('section.call')).toContainText('מדברים עם דלת הכניסה');
    await expect(inHome(page).locator('section.call wk-talk-button')).toHaveCount(1);
    await settle(page);
    const top = await page.evaluate(() => document.scrollingElement!.scrollTop);
    expect(top).toBe(0);
  });
});

test.describe('HOME-SIMPLE-2420 administrator page', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'one size'));

  test('user management > ממשק ביתי sets a person home only (rbac.assign)', async ({ page }) => {
    await mockHome(page, { perms: ['devices.read', 'rbac.assign', 'identity.directory.read'], policy: { interface: 'full', default_interface: 'full', admin: true } });
    const users = [
      { user_id: 'dev-noa', username: 'noa', display_name: 'נועה לביא', source: 'ingress', system_admin: false, default_interface: 'home', may_switch: true, home_only: false, kiosk: false, kiosk_area_id: null, rooms: null, modules: null, configured: false, admin: false },
      { user_id: 'dev-jon', username: 'jon', display_name: 'יונתן לביא', source: 'ingress', system_admin: true, default_interface: 'full', may_switch: true, home_only: false, kiosk: false, kiosk_area_id: null, rooms: null, modules: null, configured: true, admin: true },
    ];
    const puts: { url: string; body: unknown }[] = [];
    await page.route('**/api/v1/home/policies', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ users, modules: ['lights', 'climate', 'shades', 'doors', 'cameras', 'energy', 'alerts', 'scenes', 'security'], seed: {}, kiosk_code_set: false }) }));
    await page.route('**/api/v1/home/policies/*', (r) => { puts.push({ url: r.request().url(), body: r.request().postDataJSON() }); return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
    await page.route('**/api/v1/identity/users**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ users: [], directory: { paired: false, users: 0, last_directory_at: null }, revision: 1, delegated: false }) }));
    await page.route('**/api/v1/access/roles**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ roles: [] }) }));
    await page.route('**/api/v1/access/groups**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ groups: [], can_manage: true }) }));
    await page.route('**/api/v1/sites?tree=true', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/#/system/access?tab=home');
    const admin = page.locator('sw-home-admin');
    await expect(admin.locator('[data-home-detail] h3')).toHaveText('נועה לביא');
    await admin.locator('sw-toggle[label="ממשק ביתי בלבד"]').click();
    await expect.poll(() => puts.map((p) => JSON.stringify(p.body))).toContain('{"home_only":true}');
    expect(puts[0].url).toContain('home/policies/dev-noa');
    await admin.locator('[data-home-user="dev-jon"]').click();
    await expect(admin.locator('sw-toggle[label="ממשק ביתי בלבד"]')).toHaveAttribute('disabled', '');
  });
});
