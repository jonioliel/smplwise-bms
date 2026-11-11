import { expect, test, type Page, type Route } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockHome } from './home-simple-mocks';
import { mockP3, P3_PERMS, type P3Opts } from './home-v3p3-mocks';

// HOME-V3-FOLLOWUP-A-2431 (owner answers 2026-11-11): the follow-up of the home interface v3 -
// 1. the recordings, the house log and the intercom are their own categories of the per-person list (on by default);
// 2. the administrator's visitor-invitation switch (installation settings; OFF at install; system administrator only);
// 4. "הצג חשבון" in the bill card opens the bill file itself (GET energy/bills/{id}/pdf), never on a wall panel.
// Mocked backend (tests/home-simple-mocks.ts + tests/home-v3p3-mocks.ts); nothing is sent anywhere. Screenshots: test-results/home-v3-fa/.

const SHOTS = 'test-results/home-v3-fa';
const SIZES = [{ id: 'desktop', width: 1280, height: 800 }, { id: 'tablet', width: 1024, height: 768 }, { id: 'phone', width: 390, height: 844 }];
const FORBIDDEN = ['Home Assistant', 'go2rtc', 'NVR', 'WebRTC', 'entity', 'ישות', 'PDF', 'undefined', 'NaN'];
const BASE = ['lights', 'climate', 'shades', 'doors', 'cameras', 'energy', 'alerts', 'scenes', 'security', 'media', 'announce', 'bills', 'water', 'systems', 'map'];
const PERMS = [...P3_PERMS, 'events.read', 'access.read', 'video.playback'];
const PDF = '%PDF-1.4\n% home bill\n%%EOF\n';

const inHome = (page: Page) => page.locator('sw-home');
const ok = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function open(page: Page, route: string, o: P3Opts = {}, more?: (p: Page) => Promise<void>) {
  const mock = await mockP3(page, { perms: PERMS, ...o });
  if (more) await more(page); // registered after the mocks: Playwright asks the newest route first
  const pdf: string[] = [];
  await page.route('**/api/v1/energy/bills/*/pdf', (r) => { pdf.push(new URL(r.request().url()).pathname.replace(/^.*api\/v1\//, '')); return r.fulfill({ status: 200, contentType: 'application/pdf', body: PDF }); });
  await page.route('**/api/v1/intercom/calls?**', (r) => ok(r, { calls: [], next_cursor: null }));
  await page.goto('about:blank');
  await page.goto(`/#/home/${route}`);
  await page.locator('sw-home').waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await settle(page);
  await expect.poll(() => page.evaluate(() => (document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home') as unknown as { p3?: { loaded?: boolean } }).p3?.loaded === true)).toBe(true);
  await settle(page);
  return { mock, pdf };
}

/** Overflow of the page / shell / main area, small targets, the shown words and the direction (the phase specs' audit). */
async function audit(page: Page, min: number) {
  return page.evaluate((m) => {
    const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
    const doc = document.scrollingElement!;
    const out: string[] = [];
    if (doc.scrollHeight - doc.clientHeight > 1) out.push('document');
    for (const sel of ['.hs', '#main']) {
      const el = root.querySelector(sel) as HTMLElement | null;
      if (el && el.scrollHeight - el.clientHeight > 1) out.push(`${sel} ${el.scrollHeight}>${el.clientHeight}`);
    }
    const hs = root.querySelector('.hs') as HTMLElement;
    if (hs.scrollWidth - hs.clientWidth > 1) out.push('hs-x');
    const small: string[] = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('#main button, #main a[href]'))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (Math.min(r.width, r.height) < m - 0.5) small.push(`${el.tagName.toLowerCase()}.${el.className}[${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 16)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    const text = (root as unknown as { textContent: string }).textContent + ' ' + Array.from(root.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label')).join(' ');
    return { out, small, text, dir: getComputedStyle(hs).direction };
  }, min);
}

test.describe('HOME-V3-FOLLOWUP-A-2431 bill file', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sizes are set per test'));

  for (const size of SIZES) {
    test(`the bill screen with its "show bill" buttons fits without scrolling, RTL, targets, words - ${size.id}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await open(page, 'bills');
      await expect(inHome(page).locator('.bill-now [data-p3-bill-open]')).toHaveText('הצג חשבון אחרון');
      const a = await audit(page, size.id === 'phone' ? 44 : 48);
      expect(a.out, 'overflow').toEqual([]);
      expect(a.small, 'small targets').toEqual([]);
      expect(a.dir).toBe('rtl');
      for (const w of FORBIDDEN) expect(a.text.includes(w), `says "${w}"`).toBe(false);
      await page.screenshot({ path: `${SHOTS}/${size.id}-bills.png` });
    });
  }

  test('"show bill" opens the latest issued bill file, a row opens its own; nothing without a bill', async ({ page }) => {
    const { pdf } = await open(page, 'bills');
    // the periods arrive oldest first; the latest previous bill (b1) is the card's
    const [tab] = await Promise.all([page.waitForEvent('popup'), inHome(page).locator('.bill-now [data-p3-bill-open="b1"]').click()]);
    await expect.poll(() => pdf).toEqual(['energy/bills/b1/pdf']);
    await expect.poll(() => tab.url()).toMatch(/^blob:/);
    await tab.close();
    const row = inHome(page).locator('.blr [data-p3-bill-open="b2"]');
    await expect(row).toHaveAttribute('aria-label', /^הצג חשבון /);
    const [tab2] = await Promise.all([page.waitForEvent('popup'), row.click()]);
    await expect.poll(() => pdf).toEqual(['energy/bills/b1/pdf', 'energy/bills/b2/pdf']);
    await tab2.close();
    // a refused file closes the empty tab and says so in simple words
    await page.unroute('**/api/v1/energy/bills/*/pdf');
    await page.route('**/api/v1/energy/bills/*/pdf', (r) => ok(r, { code: 'home_module_off' }, 403));
    const [tab3] = await Promise.all([page.waitForEvent('popup'), inHome(page).locator('.bill-now [data-p3-bill-open]').click()]);
    await expect.poll(() => tab3.isClosed()).toBe(true);
    await expect(inHome(page).locator('.toasts .toast2').filter({ hasText: 'לא הצלחנו לפתוח את החשבון' })).toHaveCount(1);
  });

  test('two or three accounts: the first one opens with a choice, each with its own bill', async ({ page }) => {
    await open(page, 'bills', {}, (p) => p.route('**/api/v1/energy/accounts', (r) => ok(r, { items: [{ id: 'acc1', name: 'הבית', status: 'active' }, { id: 'acc2', name: 'יחידת הדיור', status: 'active' }] })));
    await expect(inHome(page).locator('.seg button')).toHaveCount(2);
    await expect(inHome(page).locator('.seg button[aria-pressed="true"]')).toHaveText('הבית');
    await expect(inHome(page).locator('.bill-now [data-p3-bill-open]')).toHaveCount(1);
  });

  test('no "show bill" on a wall panel', async ({ page }) => {
    await open(page, 'bills', { policy: { kiosk: true, home_only: true, may_switch: false, kiosk_area_id: 'living' } });
    await expect(inHome(page).locator('[data-p3-bill-open]')).toHaveCount(0);
  });
});

test.describe('HOME-V3-FOLLOWUP-A-2431 categories', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'one size is enough'));

  test('recordings, the house log and the intercom are on by default and each can be hidden on its own', async ({ page }) => {
    await open(page, 'more', { modules: [...BASE, 'recordings', 'log', 'intercom'] });
    for (const id of ['rec', 'events', 'intercom']) await expect(inHome(page).locator(`.hubt[data-mod="${id}"]`), id).toHaveCount(1);
    await page.screenshot({ path: `${SHOTS}/desktop-more.png` });
    await open(page, 'more', { modules: [...BASE, 'recordings'] });
    await expect(inHome(page).locator('.hubt[data-mod="rec"]')).toHaveCount(1);
    for (const id of ['events', 'intercom']) await expect(inHome(page).locator(`.hubt[data-mod="${id}"]`), id).toHaveCount(0);
    await open(page, 'more', { modules: [...BASE, 'log', 'intercom'] });
    await expect(inHome(page).locator('.hubt[data-mod="rec"]')).toHaveCount(0);
    await expect(inHome(page).locator('[data-home-rec]')).toHaveCount(0);
    // a hidden screen opened by its address says it is not switched on
    await open(page, 'events', { modules: [...BASE, 'recordings'] });
    await expect(inHome(page).locator('.empty h2')).toHaveText('המסך הזה לא זמין');
  });
});

test.describe('HOME-V3-FOLLOWUP-A-2431 administrator page', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one size is enough');
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  async function admin(page: Page, systemAdmin: boolean) {
    await mockHome(page, { perms: ['devices.read', 'rbac.assign', 'system.configure', 'identity.directory.read'], policy: { interface: 'full', default_interface: 'full', admin: true } });
    const users = [{ user_id: 'dev-noa', username: 'noa', display_name: 'נועה לביא', source: 'ingress', system_admin: systemAdmin, default_interface: 'full', may_switch: true, home_only: false, kiosk: false, kiosk_area_id: null, rooms: null, modules: ['lights', 'doors'], configured: true, admin: true, guests: false, can_invite: false }];
    const sent: { method: string; body: unknown }[] = [];
    let vis = { visitors: 'off', effective: false, external_grants: 'on' };
    await page.route('**/api/v1/home/policies', (r) => ok(r, { users, modules: [...BASE.slice(0, 9), 'presence', 'calendar', 'notices', 'tickets', 'schedules', ...BASE.slice(9), 'recordings', 'log', 'intercom'], seed: {}, kiosk_code_set: false }));
    await page.route('**/api/v1/home/settings', (r) => ok(r, { settings: { default_mode: 'full_all', kiosk_exit: 'code', wallpaper: 'none' }, values: {}, gallery: [] }));
    await page.route('**/api/v1/home/room-wallpapers', (r) => ok(r, { walls: {}, mode: 'none', gallery: [] }));
    await page.route('**/api/v1/access/visitors/settings', (r) => {
      sent.push({ method: r.request().method(), body: r.request().postDataJSON?.() ?? null });
      if (r.request().method() === 'PUT') vis = { ...vis, visitors: (r.request().postDataJSON() as { visitors: string }).visitors, effective: true };
      return ok(r, vis);
    });
    await page.route('**/api/v1/identity/users**', (r) => ok(r, { users: [], directory: { paired: false, users: 0, last_directory_at: null }, revision: 1, delegated: false }));
    await page.route('**/api/v1/access/roles**', (r) => ok(r, { roles: [] }));
    await page.route('**/api/v1/access/groups**', (r) => ok(r, { groups: [], can_manage: true }));
    await page.route('**/api/v1/sites?tree=true', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/#/system/access?tab=home');
    const el = page.locator('sw-home-admin');
    await expect(el.locator('[data-home-detail] h3')).toHaveText('נועה לביא', { timeout: 30_000 });
    return { el, sent };
  }

  test('the per-person list names the recordings, the house log and the intercom, and the doors alone', async ({ page }) => {
    const { el } = await admin(page, true);
    const detail = el.locator('[data-home-detail]');
    for (const w of ['הקלטות', 'יומן הבית', 'אינטרקום', 'מוזיקה ומסכים']) await expect(detail.locator('label.chk', { hasText: w }).first()).toBeVisible();
    await expect(detail.locator('label.chk', { hasText: 'דלתות ואינטרקום' })).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/admin-person.png` });
  });

  test('the visitor-invitation switch: off at install, a system administrator turns it on', async ({ page }) => {
    const { el, sent } = await admin(page, true);
    await el.locator('[data-home-subtabs] [role="tab"]', { hasText: 'הגדרות התקנה' }).click();
    const sw = el.locator('sw-toggle[data-home-visitors-switch]');
    await expect(el.locator('[data-home-visitors]')).toContainText('כבוי (ברירת המחדל בהתקנה)');
    await sw.click();
    await expect.poll(() => sent.filter((s) => s.method === 'PUT').map((s) => JSON.stringify(s.body))).toEqual(['{"visitors":"on"}']);
    await expect(el.locator('[data-home-visitors]')).toContainText('קוד האורח לא מוצג למזמין');
    await page.screenshot({ path: `${SHOTS}/admin-install.png` });
  });

  test('someone who is not a system administrator sees the switch locked and asks nothing', async ({ page }) => {
    const { el, sent } = await admin(page, false);
    await el.locator('[data-home-subtabs] [role="tab"]', { hasText: 'הגדרות התקנה' }).click();
    await expect(el.locator('[data-home-visitors]')).toContainText('רק מנהל מערכת');
    await expect(el.locator('sw-toggle[data-home-visitors-switch]')).toHaveAttribute('disabled', '');
    expect(sent).toEqual([]);
  });
});
