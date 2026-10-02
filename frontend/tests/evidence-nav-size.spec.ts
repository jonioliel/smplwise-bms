import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// UI round 1b (owner 2026-09-30): the size of the navigation (side rail and phone bottom bar) is a setting -
// הגדרות › כללי › גודל הניווט: an installation default and a personal override (personal wins, "ברירת מחדל של המערכת"
// clears it), "יחסי" (four presets scaled together, the current one marked) or "חופשי" (icon, label / no labels, item height
// independently), a live mini rail and bottom bar, applied to the running shell without a reload.
//   1. the demo data (no backend: the personal value lives in this browser) - what each preset measures in the real shell;
//   2. a mocked backend - what is sent to PUT /me/prefs and PATCH /settings and which value wins.
// The value's validation is the backend's job: smplwise_vms/backend/tests/test_nav_size.py.
//   SW_BASE_URL=http://127.0.0.1:4391/ npx playwright test tests/evidence-nav-size.spec.ts --workers=1

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/UIR1-shell');

function phone(info: { project: { name: string } }) {
  return info.project.name === 'mobile';
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) });
}

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(500);
}

const CARD = 'sw-app system-nav-size';

/** The icon size the shell draws: the phone bar's icons are one px smaller than the rail's. */
const iconOf = (info: { project: { name: string } }, px: number) => (phone(info) ? px - 1 : px);

/** What the shell draws now: the rail / bottom bar, its first item, its icon and label, the avatar. */
async function measure(page: Page, info: { project: { name: string } }) {
  return page.locator('sw-app').evaluate((app, isPhone) => {
    const sr = app.shadowRoot!;
    const nav = sr.querySelector(isPhone ? 'nav.bottom' : 'nav.rail') as HTMLElement;
    const first = nav.querySelector('a[data-nav]') as HTMLElement;
    const icon = first.querySelector('sw-icon') as HTMLElement;
    const label = first.querySelector(isPhone ? '.lbl' : 'span') as HTMLElement;
    const av = nav.querySelector('sw-avatar') as HTMLElement;
    const r = (el: Element) => el.getBoundingClientRect();
    const items = Array.from(nav.querySelectorAll('a[data-nav], button.me'));
    return {
      nav: { w: Math.round(r(nav).width), h: Math.round(r(nav).height) },
      item: { w: Math.round(r(first).width), h: Math.round(r(first).height) },
      icon: Math.round(r(icon).width),
      labelPx: parseFloat(getComputedStyle(label).fontSize),
      labelShown: getComputedStyle(label).display !== 'none',
      avatar: Math.round(r(av).width),
      minTarget: Math.min(...items.map((e) => Math.min(r(e).width, r(e).height))),
      clipped: items.some((e) => Array.from(e.querySelectorAll('span, .lbl')).some((s) => (s as HTMLElement).scrollWidth > (s as HTMLElement).clientWidth + 1 && getComputedStyle(s).display !== 'none')) || nav.scrollWidth > nav.clientWidth + 1,
      railVar: getComputedStyle(app).getPropertyValue('--sw-rail-w').trim(),
    };
  }, phone(info));
}

async function setRange(page: Page, sel: string, value: number) {
  await page.locator(`${CARD} ${sel}`).evaluate((el, v) => {
    const i = el as HTMLInputElement;
    i.value = String(v);
    i.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

// what each preset stands for (shell/nav-size.ts PRESET_DIMS; the desktop rail is item width + 14 wide)
const PRESETS = {
  s: { icon: 18, label: 10, item: 46, rail: 66, avatar: 24, bar: 44 },
  m: { icon: 20, label: 10.5, item: 52, rail: 70, avatar: 28, bar: 50 },
  l: { icon: 25, label: 12, item: 64, rail: 82, avatar: 34, bar: 62 },
  xl: { icon: 30, label: 13.5, item: 76, rail: 94, avatar: 40, bar: 74 },
} as const;

test.describe('navigation size on the demo data', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('navsize-keep')) localStorage.removeItem('sw.nav.size');
      } catch {
        /* storage unavailable */
      }
    });
  });

  test('the presets scale rail width, icon, label, item and avatar together; the current one is marked; no reload', async ({ page }, info) => {
    await open(page, '/system/diagnostics');
    await expect(page.locator(CARD)).toBeVisible();
    await page.evaluate(() => ((window as unknown as { __noReload: number }).__noReload = 1));
    // the default is "גדול" (owner decision 2026-09-30, home redesign), marked as the current size
    await expect(page.locator(`${CARD} [data-nav-mode="rel"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${CARD} [data-nav-preset="l"] [data-nav-current]`)).toHaveCount(1);
    await expect(page.locator(`${CARD} [data-nav-preset]`)).toHaveText([/קטן/, /בינוני/, /גדול/, /גדול מאוד/]);
    const base = await measure(page, info);
    expect(base.icon).toBe(iconOf(info, PRESETS.l.icon));
    for (const p of ['s', 'l', 'xl', 'm'] as const) {
      const want = PRESETS[p];
      await page.locator(`${CARD} [data-nav-preset="${p}"]`).click();
      // the preview follows the choice before anything is saved
      await expect(page.locator(`${CARD} [data-nav-preview]`)).toHaveAttribute('data-icon', String(want.icon));
      await page.locator(`${CARD} [data-nav-save]`).click();
      await expect(page.locator(`${CARD} [data-nav-preset="${p}"] [data-nav-current]`)).toHaveCount(1);
      await expect(page.locator(`${CARD} [data-nav-current]`)).toHaveCount(1);
      const m = await measure(page, info);
      expect(m.icon, `${p} icon`).toBe(iconOf(info, want.icon));
      expect(m.labelPx, `${p} label`).toBeCloseTo(phone(info) ? Math.max(9, want.label - 0.5) : want.label, 1);
      expect(m.clipped, `${p} clipped`).toBe(false);
      if (phone(info)) {
        expect(m.nav.h, `${p} bar (never below its preset height; a small preset may grow to fit its content)`).toBeGreaterThanOrEqual(want.bar);
        expect(m.nav.h, `${p} bar`).toBeLessThanOrEqual(want.bar + 6);
        expect(m.minTarget, `${p} tap target`).toBeGreaterThanOrEqual(44);
        expect(m.avatar).toBe(Math.max(18, Math.round(want.avatar * 0.8)));
      } else {
        expect(m.item.h, `${p} item`).toBe(want.item);
        expect(m.item.w, `${p} item width`).toBeGreaterThanOrEqual(want.rail - 14);
        expect(m.nav.w, `${p} rail = item + padding + border`).toBe(m.item.w + 15);
        expect(m.avatar, `${p} avatar`).toBe(want.avatar);
        expect(parseFloat(m.railVar), 'the user menu / banner offset follows the rail').toBe(m.nav.w);
      }
      if (p === 's' || p === 'xl') await shot(page, `nav-size-${p}-${phone(info) ? 'phone' : 'desktop'}-settings`);
    }
    expect(await page.evaluate(() => (window as unknown as { __noReload?: number }).__noReload)).toBe(1); // no reload
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('the size survives a reload and reaches every screen (home, security, map)', async ({ page }, info) => {
    await open(page, '/system/diagnostics');
    await page.evaluate(() => sessionStorage.setItem('navsize-keep', '1'));
    await page.locator(`${CARD} [data-nav-preset="xl"]`).click();
    await page.locator(`${CARD} [data-nav-save]`).click();
    for (const hash of ['/devices/building', '/live', '/explore/floors/f0']) {
      await open(page, hash);
      expect((await measure(page, info)).icon, hash).toBe(iconOf(info, PRESETS.xl.icon));
    }
    await shot(page, `nav-size-xl-${phone(info) ? 'phone' : 'desktop'}-home`);
    await open(page, '/devices/building');
    // the user menu opens beside the (wider) rail, not under it
    if (!phone(info)) {
      await page.locator('sw-app [data-profile-menu]').click();
      const rail = (await page.locator('sw-app nav.rail').boundingBox())!;
      const panel = (await page.locator('sw-app sw-user-menu [data-user-menu]').boundingBox())!;
      expect(panel.x + panel.width).toBeLessThanOrEqual(rail.x + 1);
      await page.keyboard.press('Escape');
    }
  });

  test('חופשי: icon, label and item on their own without a proportion lock; labels off; nothing clipped', async ({ page }, info) => {
    await open(page, '/system/diagnostics');
    await page.locator(`${CARD} [data-nav-mode="free"]`).click();
    await expect(page.locator(`${CARD} [data-nav-free]`)).toBeVisible();
    // it starts from the size in use
    await expect(page.locator(`${CARD} [data-free-icon]`)).toHaveValue(String(PRESETS.l.icon)); // the large preset is the default now
    await setRange(page, '[data-free-icon]', 34);
    await setRange(page, '[data-free-label]', 9);
    await setRange(page, '[data-free-item]', 60);
    const pv = page.locator(`${CARD} [data-nav-preview]`);
    await expect(pv).toHaveAttribute('data-icon', '34');
    await expect(pv).toHaveAttribute('data-label', '9');
    await expect(pv).toHaveAttribute('data-item', '60');
    await page.locator(`${CARD} [data-nav-save]`).click();
    let m = await measure(page, info);
    expect(m.icon).toBe(iconOf(info, 34)); // a big icon with a small label and a mid item: independent
    if (phone(info)) {
      expect(m.labelPx).toBeCloseTo(9, 1);
      expect(m.minTarget).toBeGreaterThanOrEqual(44);
    } else {
      expect(m.labelPx).toBeCloseTo(9, 1);
      expect(m.item.h).toBeGreaterThanOrEqual(60);
      expect(m.item.h).toBeLessThan(PRESETS.xl.item); // not the xl preset's proportions
    }
    expect(m.clipped).toBe(false);
    // labels off: no label text, the links keep their names, the rail gets narrower
    const withLabels = m.nav.w;
    await page.locator(`${CARD} [data-free-labels]`).uncheck();
    await expect(page.locator(`${CARD} [data-free-label]`)).toHaveCount(0);
    await expect(pv).toHaveAttribute('data-label', '0');
    await page.locator(`${CARD} [data-nav-save]`).click();
    m = await measure(page, info);
    expect(m.labelShown).toBe(false);
    await expect(page.locator(phone(info) ? 'sw-app nav.bottom a[data-nav="security"]' : 'sw-app nav.rail a[data-nav="security"]')).toHaveAttribute('aria-label', 'אבטחה');
    if (!phone(info)) expect(m.nav.w).toBeLessThanOrEqual(withLabels);
    // the widest label sets the rail width: a big label size grows the rail, the label stays whole
    await page.locator(`${CARD} [data-free-labels]`).check();
    // the phone bar shares 390 px between the area tabs (one more since the multimedia entry) and the account: its labels are
    // ellipsized by design, so the "label stays whole" check uses the largest size that fits there ("מולטימדיה" is the widest label)
    await setRange(page, '[data-free-label]', phone(info) ? 12 : 16);
    await setRange(page, '[data-free-icon]', 14);
    await setRange(page, '[data-free-item]', 36);
    await page.locator(`${CARD} [data-nav-save]`).click();
    m = await measure(page, info);
    expect(m.clipped).toBe(false);
    if (phone(info)) expect(m.minTarget).toBeGreaterThanOrEqual(44); // the phone keeps 44 px whatever is chosen
    else expect(m.nav.w).toBeGreaterThanOrEqual(60);
    // the extremes
    await setRange(page, '[data-free-icon]', 40);
    await setRange(page, '[data-free-item]', 96);
    await page.locator(`${CARD} [data-nav-save]`).click();
    m = await measure(page, info);
    expect(m.icon).toBe(iconOf(info, 40));
    expect(m.clipped).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('"ברירת מחדל של המערכת" clears the personal size', async ({ page }, info) => {
    await open(page, '/system/diagnostics');
    await expect(page.locator(`${CARD} [data-nav-reset]`)).toHaveAttribute('disabled', '');
    await page.locator(`${CARD} [data-nav-preset="xl"]`).click();
    await page.locator(`${CARD} [data-nav-save]`).click();
    expect((await measure(page, info)).icon).toBe(iconOf(info, PRESETS.xl.icon));
    await page.locator(`${CARD} [data-nav-reset]`).click();
    expect((await measure(page, info)).icon).toBe(iconOf(info, PRESETS.l.icon)); // the system default is the large preset
    await expect(page.locator(`${CARD} [data-nav-preset="l"] [data-nav-current]`)).toHaveCount(1);
    await expect(page.locator(`${CARD} [data-nav-reset]`)).toHaveAttribute('disabled', '');
    expect(await page.evaluate(() => localStorage.getItem('sw.nav.size'))).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// A mocked backend: what the client sends, and that the personal value wins over the installation's.

const ALL = ['video.live', 'map.read', 'entity.state.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure'];
const XL = { mode: 'rel', preset: 'xl' };
const FREE = { mode: 'free', icon: 26, label: 12, item: 60 };
const M = { mode: 'rel', preset: 'm' };

class Mock {
  admin = true;
  installation: Record<string, unknown> = M;
  own: Record<string, unknown> | null = null;
  puts: Record<string, unknown>[] = [];
  patches: Record<string, unknown>[] = [];

  async handle(route: Route) {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const perms = this.admin ? ALL : ALL.filter((x) => x !== 'system.configure');
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u1', username: 'u1', display_name: 'יוני אוליאל', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs' && req.method() === 'GET') {
      return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'], 'ui.nav_size': this.own ?? M }, stored: this.own ? ['ui.nav_size'] : [], updated_at: null });
    }
    if (p === 'me/prefs' && req.method() === 'PUT') {
      const body = req.postDataJSON() as Record<string, unknown>;
      this.puts.push(body);
      if ('ui.nav_size' in body) this.own = body['ui.nav_size'] as Record<string, unknown> | null;
      return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'], 'ui.nav_size': this.own ?? M }, stored: this.own ? ['ui.nav_size'] : [], updated_at: null });
    }
    if (p === 'settings' && req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      this.patches.push(body);
      if ('ui.nav_size' in body) this.installation = body['ui.nav_size'] as Record<string, unknown>;
    }
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.nav_size': this.installation, 'media.transport_default': 'mse', 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'snapshots.max_age_s': 60 }, can_edit: this.admin });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  }
}

test.describe('navigation size with a (mocked) backend', () => {
  let mock: Mock;

  test.beforeEach(async ({ page }) => {
    mock = new Mock();
    await page.route('**/api/v1/**', (r) => mock.handle(r));
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('sw.nav.size');
      } catch {
        /* storage unavailable */
      }
    });
  });

  test('the installation default applies to everyone; the personal value wins; clearing it returns to the default', async ({ page }, info) => {
    await open(page, '/system/diagnostics');
    await expect(page.locator(`${CARD} [data-nav-target]`)).toHaveText(['שלי', 'ברירת מחדל של המערכת']);
    // an administrator sets the installation default: PATCH /settings, applied at once
    await page.locator(`${CARD} [data-nav-target="installation"]`).click();
    await page.locator(`${CARD} [data-nav-preset="xl"]`).click();
    await page.locator(`${CARD} [data-nav-save]`).click();
    await expect.poll(() => mock.patches.length).toBe(1);
    expect(mock.patches[0]).toEqual({ 'ui.nav_size': XL });
    expect(mock.puts).toHaveLength(0);
    await expect.poll(async () => (await measure(page, info)).icon).toBe(iconOf(info, PRESETS.xl.icon)); // the PATCH was seen; its response is applied a moment later
    // a reload: the installation's value again, from the server
    await open(page, '/devices/building');
    await expect.poll(async () => (await measure(page, info)).icon).toBe(iconOf(info, PRESETS.xl.icon));
    // the personal override: PUT /me/prefs, wins over the installation's
    await open(page, '/system/diagnostics');
    await page.locator(`${CARD} [data-nav-mode="free"]`).click();
    await setRange(page, '[data-free-icon]', 26);
    await setRange(page, '[data-free-label]', 12);
    await setRange(page, '[data-free-item]', 60);
    await page.locator(`${CARD} [data-nav-save]`).click();
    await expect.poll(() => mock.puts.length).toBe(1);
    expect(mock.puts[0]).toEqual({ 'ui.nav_size': FREE });
    await expect.poll(async () => (await measure(page, info)).icon).toBe(iconOf(info, 26));
    await open(page, '/devices/building');
    await expect.poll(async () => (await measure(page, info)).icon).toBe(iconOf(info, 26)); // server copy, personal wins
    // "ברירת מחדל של המערכת": null to the server, the installation's size (xl) applies again
    await open(page, '/system/diagnostics');
    await page.locator(`${CARD} [data-nav-reset]`).click();
    await expect.poll(() => mock.puts.length).toBe(2);
    expect(mock.puts[1]).toEqual({ 'ui.nav_size': null });
    await expect.poll(async () => (await measure(page, info)).icon).toBe(iconOf(info, PRESETS.xl.icon));
    if (info.project.name === 'desktop') await shot(page, 'nav-size-settings-backend');
  });

  test('a user who may not configure the system sees only the personal choice', async ({ page }) => {
    mock.admin = false;
    await open(page, '/system/diagnostics');
    await expect(page.locator(CARD)).toBeVisible();
    await expect(page.locator(`${CARD} [data-nav-target]`)).toHaveCount(0);
    await page.locator(`${CARD} [data-nav-preset="l"]`).click();
    await page.locator(`${CARD} [data-nav-save]`).click();
    await expect.poll(() => mock.puts.length).toBe(1);
    expect(mock.patches).toHaveLength(0);
  });
});
