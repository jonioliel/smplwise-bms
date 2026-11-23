import { test, type Page, type Route } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockP2 } from './home-v3-p2-mocks';
import { mockHome } from './home-simple-mocks';
import { alarmPanels } from './home-wall-night-mocks';

// HOME-WALL-NIGHT-2500: before / after captures of a wall panel (not a gate). Runs only with SW_SHOTS=1 and writes
// <SW_SHOTS_DIR>/<SW_SHOTS_PHASE>-<size>-<state>.png (default: private/planning/home_wall_night_2500_compare_2026-11-23/, phase "after").
// The same file runs against the build before the change (phase "before": no rest screen, no night mode, no takeover exists) and after it.
// The page's clock is installed at noon or at 23:30 of the current day, and moved forward to pass the 2-minute rest time.

const OUT = process.env.SW_SHOTS_DIR || '../private/planning/home_wall_night_2500_compare_2026-11-23';
const PHASE = process.env.SW_SHOTS_PHASE || 'after';
const SIZES: [string, number, number][] = [['wall', 1280, 800], ['tablet', 1024, 768]];
const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

function today(h: number, m: number): number {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

async function open(page: Page, at: number) {
  await page.clock.install({ time: at });
  const mock = await mockP2(page, { kiosk: true, now: at });
  await page.goto('/#/home/r/living');
  await page.locator('sw-home').waitFor();
  await page.locator('sw-home').locator('.hs.v2').waitFor();
  await page.waitForTimeout(800);
  await settle(page);
  return mock;
}

async function shot(page: Page, size: string, state: string) {
  await settle(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${PHASE}-${size}-${state}.png` });
}

test.describe('HOME-WALL-NIGHT-2500 captures', () => {
  test.skip(!process.env.SW_SHOTS, 'evidence only');
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop'); });
  test.setTimeout(240_000);

  test('settings tab', async ({ page }) => {
    test.skip(PHASE === 'before', 'the tab is new');
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockHome(page, { perms: ['devices.read', 'rbac.assign', 'system.configure', 'identity.directory.read'], policy: { interface: 'full', default_interface: 'full', admin: true } });
    const settings = { default_mode: 'full_all', kiosk_exit: 'code', wallpaper: 'none', wall_rest: 'on', wall_rest_after: '2', wall_night: 'on', wall_night_start: '23:00', wall_night_end: '06:00', wall_night_dim: 'medium', wall_takeover: 'alarm_urgent' };
    await page.route('**/api/v1/home/policies', (r) => json(r, { users: [], modules: ['lights'], seed: {}, kiosk_code_set: true }));
    await page.route('**/api/v1/home/settings', (r) => json(r, { settings, values: {}, gallery: [] }));
    await page.route('**/api/v1/identity/users**', (r) => json(r, { users: [], directory: { paired: false, users: 0, last_directory_at: null }, revision: 1, delegated: false }));
    await page.route('**/api/v1/access/roles**', (r) => json(r, { roles: [] }));
    await page.route('**/api/v1/access/groups**', (r) => json(r, { groups: [], can_manage: true }));
    await page.route('**/api/v1/sites?tree=true', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/#/system/access?tab=home');
    const admin = page.locator('sw-home-admin');
    await admin.locator('[data-home-subtabs] [role="tab"]', { hasText: 'מסכי קיר' }).click();
    await admin.locator('[data-home-wall-settings]').waitFor();
    await shot(page, 'settings', 'd1440');
  });

  for (const [size, w, h] of SIZES) {
    test(`day ${size}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page, today(12, 0));
      await shot(page, size, 'day-awake');
      await page.clock.fastForward(130_000);
      await shot(page, size, 'day-rest');
    });
    test(`night ${size}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page, today(23, 30));
      await shot(page, size, 'night-awake');
      await page.clock.fastForward(130_000);
      await shot(page, size, 'night-rest');
    });
    test(`takeover ${size}`, async ({ page }) => {
      test.skip(PHASE === 'before', 'no takeover before the change');
      await page.setViewportSize({ width: w, height: h });
      const at = today(23, 30);
      await page.clock.install({ time: at });
      await mockP2(page, { kiosk: true, now: at });
      // an urgent notice published ten minutes ago (the board's severity "critical")
      await page.route('**/api/v1/notices', (r) => json(r, { notices: [{ id: 'u1', title: 'הפסקת חשמל דחופה בבניין', body: 'בעוד 30 דקות תהיה הפסקת חשמל בכל הבניין לצורך תיקון תקלה בלוח הראשי. המעליות יעצרו בקומת הקרקע.', severity: 'critical', pinned: true, read: false, starts_at: new Date(at - 600_000).toISOString(), ends_at: null, published_at: new Date(at - 600_000).toISOString(), when_text: null }] }));
      await page.goto('/#/home/r/living');
      await page.locator('sw-home').waitFor();
      await page.locator('sw-home').locator('.hs.v2').waitFor();
      await page.waitForTimeout(800);
      await page.clock.fastForward(130_000);
      await page.waitForTimeout(800);
      await shot(page, size, 'takeover-notice');
    });
    test(`alarm ${size}`, async ({ page }) => {
      test.skip(PHASE === 'before', 'no takeover before the change');
      await page.setViewportSize({ width: w, height: h });
      const at = today(23, 30);
      await page.clock.install({ time: at });
      await mockP2(page, { kiosk: true, now: at, perms: ['alarm.view'] });
      await page.route('**/api/v1/alarm/panels', (r) => json(r, alarmPanels('triggered', at)));
      await page.goto('/#/home/r/living');
      await page.locator('sw-home').waitFor();
      await page.locator('sw-home').locator('.hs.v2').waitFor();
      await page.waitForTimeout(800);
      await page.clock.fastForward(130_000);
      await page.waitForTimeout(800);
      await shot(page, size, 'takeover-alarm');
    });
  }
});
