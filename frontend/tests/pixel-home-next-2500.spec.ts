import { expect, test, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import { settle } from './helpers/settle';
import { mockP2 } from './home-v3-p2-mocks';
import { mockHome } from './home-simple-mocks';

// HOME-NEXT-2500 pixel baselines: the views this branch changes - the wall panel's notice board (new by age, no "קראתי") and its notice
// sheet without "קראתי", light and dark, and the administrator's "מסכי קיר" tab with the new "how long a notice is new" row - desktop
// 1440 and phone 390, mocked backend, fixed clock. Baselines are per OS: the Linux ones are generated on the runner with
// `--update-snapshots`; on an OS without a baseline the check is skipped, not failed.
//   npx playwright test tests/pixel-home-next-2500.spec.ts --project=desktop --project=mobile -u --workers=1

const NOW = new Date('2026-11-24T12:00:00+02:00').getTime();
const H = 3600_000;
const home = (page: Page) => page.locator('sw-home');
const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

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
  await home(page).waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await expect(home(page)).toHaveAttribute('data-hs-scheme', scheme);
  await settle(page);
}

const fileOf = (info: { project: { name: string } }, name: string) => `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, target: ReturnType<Page['locator']>, name: string) {
  const file = fileOf(info, name);
  await settle(page);
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(target).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled', caret: 'hide', timeout: 15_000 });
}

test.describe('pixel-stable: home next (wall notice board, wall settings)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`wall notice board, all ${scheme}`, async ({ page }, info) => {
      await openWall(page, 'notices', scheme);
      await home(page).locator('[data-act="p2NtTab"][data-v="all"]').click();
      await expect(home(page).locator('[data-act="p2Notice"]')).toHaveCount(3);
      await compare(page, info, home(page).locator('main'), `home-next-wall-board-${scheme}`);
    });

    test(`wall notice sheet without "read" ${scheme}`, async ({ page }, info) => {
      await openWall(page, 'notices', scheme);
      await home(page).locator('[data-act="p2Notice"]').first().click();
      const sheet = home(page).locator('[data-sheet="notice"]');
      await expect(sheet).toBeVisible();
      await compare(page, info, sheet, `home-next-wall-sheet-${scheme}`);
    });
  }

  test('wall settings tab', async ({ page }, info) => {
    await page.clock.setFixedTime(NOW);
    await mockHome(page, { now: NOW, perms: ['devices.read', 'rbac.assign', 'system.configure', 'identity.directory.read'], policy: { interface: 'full', default_interface: 'full', admin: true } });
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
    await expect(admin.locator('[data-wall-notice-new]')).toBeVisible();
    await compare(page, info, admin.locator('[data-home-wall-settings]'), 'home-next-wall-settings');
  });
});
