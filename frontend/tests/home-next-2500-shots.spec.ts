import { test, type Page, type Route } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockP2 } from './home-v3-p2-mocks';
import { mockHome } from './home-simple-mocks';

// HOME-NEXT-2500: before / after captures for the owner's compare page (not a gate). Runs only with SW_SHOTS=1 and writes
// <SW_SHOTS_DIR>/<SW_SHOTS_PHASE>-<size>-<scheme>-<state>.png. The same file runs against the build before the change (phase "before":
// the wall panel's board counts what its account read and offers "קראתי") and after it. Desktop 1440x900 and phone 390x844.

const OUT = process.env.SW_SHOTS_DIR || '../private/planning/home_next_compare_2026-11-24';
const PHASE = process.env.SW_SHOTS_PHASE || 'after';
const SIZES: [string, number, number][] = [['desktop', 1440, 900], ['phone', 390, 844]];
const NOW = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime(); })();
const H = 3600_000;
const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

function board() {
  const at = (hoursAgo: number) => new Date(NOW - hoursAgo * H).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const n = (id: string, title: string, body: string, hoursAgo: number, read: boolean, severity = 'info') => ({ id, title, body, severity, pinned: severity !== 'info', read, starts_at: at(hoursAgo), ends_at: null, published_at: at(hoursAgo), when_text: null });
  return { notices: [
    n('a', 'החלפת נורות בלובי', 'ביום שלישי יוחלפו הנורות בלובי ובחדר המדרגות. ייתכן שהתאורה תכבה לכמה דקות.', 3, true),
    n('b', 'הפסקת מים ביום חמישי', 'ביום חמישי בין 09:00 ל-13:00 תהיה הפסקת מים בכל הבניין בגלל החלפת משאבה.', 30, false, 'important'),
    n('c', 'אסיפת דיירים', 'אסיפת הדיירים השנתית תתקיים בלובי ביום ראשון בשעה 20:00.', 50, false),
  ] };
}

async function openWall(page: Page, route: string, scheme: 'light' | 'dark') {
  await page.clock.setFixedTime(NOW);
  await mockP2(page, { now: NOW, kiosk: true, features: { transit: { on: false } }, policy: { wall: { rest: false, night: false } } });
  await page.route('**/api/v1/notices', (r) => json(r, board()));
  const layout = { welcomed: true, theme: scheme === 'dark' ? 'midnight' : 'classic', scheme };
  await page.route('**/api/v1/home/prefs', (r) => (r.request().method() === 'GET'
    ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ favourites: {}, layout, seed: {} }) }) : r.fallback()));
  await page.goto('about:blank');
  await page.goto(`/#/home/${route}`);
  await page.locator('sw-home').waitFor();
  await page.locator('sw-home').locator('.hs.v2').waitFor();
  await page.waitForTimeout(1200);
  await settle(page);
}

async function shot(page: Page, name: string) {
  await settle(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${PHASE}-${name}.png` });
}

test.describe('HOME-NEXT-2500 captures', () => {
  test.skip(process.env.SW_SHOTS !== '1', 'captures only with SW_SHOTS=1');
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'sizes are set per capture'); });

  for (const [size, w, h] of SIZES) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${size} ${scheme}: wall room, board, sheet`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await openWall(page, 'r/living', scheme);
        await shot(page, `${size}-${scheme}-room`);
        await page.goto('/#/home/notices');
        await page.waitForTimeout(800);
        await settle(page);
        await shot(page, `${size}-${scheme}-board-new`);
        await page.locator('sw-home').locator('[data-act="p2NtTab"][data-v="all"]').click();
        await shot(page, `${size}-${scheme}-board-all`);
        await page.locator('sw-home').locator('[data-act="p2Notice"]', { hasText: 'הפסקת מים' }).click();
        await shot(page, `${size}-${scheme}-sheet`);
      });
    }

    test(`${size}: settings tab`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await mockHome(page, { perms: ['devices.read', 'rbac.assign', 'system.configure', 'identity.directory.read'], policy: { interface: 'full', default_interface: 'full', admin: true } });
      const ok = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      const settings = { default_mode: 'full_all', kiosk_exit: 'code', wallpaper: 'none', wall_rest: 'on', wall_rest_after: '2', wall_night: 'on', wall_night_start: '23:00', wall_night_end: '06:00', wall_night_dim: 'medium', wall_takeover: 'alarm_urgent', wall_notice_new: '48' };
      await page.route('**/api/v1/home/policies', (r) => r.fulfill(ok({ users: [], modules: ['lights'], seed: {}, kiosk_code_set: true })));
      await page.route('**/api/v1/home/settings', (r) => r.fulfill(ok({ settings, values: {}, gallery: [] })));
      await page.route('**/api/v1/identity/users**', (r) => r.fulfill(ok({ users: [], directory: { paired: false, users: 0, last_directory_at: null }, revision: 1, delegated: false })));
      await page.route('**/api/v1/access/roles**', (r) => r.fulfill(ok({ roles: [] })));
      await page.route('**/api/v1/access/groups**', (r) => r.fulfill(ok({ groups: [], can_manage: true })));
      await page.route('**/api/v1/sites?tree=true', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto('/#/system/access?tab=home');
      const admin = page.locator('sw-home-admin');
      await admin.waitFor();
      await admin.locator('[data-home-subtabs] [role="tab"]', { hasText: 'מסכי קיר' }).click();
      await admin.locator('[data-home-wall-settings]').waitFor();
      await page.waitForTimeout(600);
      await shot(page, `${size}-settings`);
      if (w < 600) {
        await admin.locator('[data-home-wall-settings] section').last().scrollIntoViewIfNeeded();
        await shot(page, `${size}-settings-end`);
      }
    });
  }
});
