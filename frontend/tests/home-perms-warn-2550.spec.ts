import { expect, test, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import { settle } from './helpers/settle';
import { mockHome } from './home-simple-mocks';

// HOME-PERMS-WARN-2550 (LOWS-BACKEND-2550 finding D-11, question 3 = a): the administrator's home-interface page (הגדרות › גישה › ממשק
// ביתי › משתמשים) warns, read-only, when a person's electricity bill / electricity / water category is on and the person's permission
// reads that data for the whole site (`site_wide` on GET /home/policies), on a site with more than one billing customer
// (`shared_scope.customers`; unknown = shown). Mocked backend (the shapes of wire/home_interface.py), nothing is sent anywhere.
// Pixel baselines (desktop 1440 + phone 390, light + dark) of the warning in the person card; the Linux ones are generated on the
// runner with `--update-snapshots`; on an OS without a baseline the check is skipped, not failed.
//   npx playwright test tests/home-perms-warn-2550.spec.ts --project=desktop --project=mobile --workers=2
// The English texts: tests/unit-i18n-home.spec.ts (every tr() text has its English with the same placeholders).
// SW_SHOTS=1 (+ SW_SHOTS_DIR) also writes the before / after captures of the compare page (the same file runs against the base build).

const ok = (r: Route, body: unknown) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const ALL = ['lights', 'climate', 'shades', 'doors', 'cameras', 'energy', 'alerts', 'scenes', 'security', 'presence', 'calendar', 'notices', 'tickets', 'schedules',
  'media', 'announce', 'bills', 'water', 'systems', 'map', 'recordings', 'log', 'intercom'];
type Scope = { customers: number | null; bill_accounts: number | null; energy_meters: number | null; water_meters: number | null } | undefined;
interface Opts { siteWide?: string[]; modules?: string[] | null; scope?: Scope; systemAdmin?: boolean; scheme?: 'light' | 'dark' }

function person(o: Opts) {
  return { user_id: 'dev-yuval', username: 'yuval', display_name: 'יובל לביא', source: 'ingress', system_admin: !!o.systemAdmin, default_interface: 'home', may_switch: false,
    home_only: !o.systemAdmin, kiosk: false, kiosk_area_id: null, rooms: null, modules: o.modules === undefined ? null : o.modules, configured: true, admin: false, guests: false, can_invite: false,
    ...(o.siteWide ? { site_wide: o.siteWide } : {}) };
}

async function adminPage(page: Page, o: Opts = {}) {
  await mockHome(page, { perms: ['devices.read', 'rbac.assign', 'system.configure', 'identity.directory.read'], policy: { interface: 'full', default_interface: 'full', admin: true } });
  const writes: string[] = [];
  page.on('request', (rq) => { if (rq.url().includes('/api/v1/') && !['GET', 'HEAD'].includes(rq.method())) writes.push(`${rq.method()} ${rq.url()}`); });
  const body: Record<string, unknown> = { users: [person(o)], modules: ALL, seed: {}, kiosk_code_set: true };
  if (o.scope !== undefined) body.shared_scope = o.scope;
  await page.route('**/api/v1/home/policies', (r) => ok(r, body));
  await page.route('**/api/v1/home/settings', (r) => ok(r, { settings: { default_mode: 'full_all', kiosk_exit: 'code', wallpaper: 'none' }, values: {}, gallery: [] }));
  await page.route('**/api/v1/identity/users**', (r) => ok(r, { users: [], directory: { paired: false, users: 0, last_directory_at: null }, revision: 1, delegated: false }));
  await page.route('**/api/v1/access/roles**', (r) => ok(r, { roles: [] }));
  await page.route('**/api/v1/access/groups**', (r) => ok(r, { groups: [], can_manage: true }));
  await page.route('**/api/v1/sites?tree=true', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(o.scheme ? `/?scheme=${o.scheme}#/system/access?tab=home` : '/#/system/access?tab=home');
  const el = page.locator('sw-home-admin');
  await expect(el.locator('[data-home-detail] h3')).toHaveText('יובל לביא', { timeout: 30_000 });
  return { el, detail: el.locator('[data-home-detail]'), writes };
}

const SITE: Scope = { customers: 4, bill_accounts: 6, energy_meters: 14, water_meters: 5 };

test.describe('HOME-PERMS-WARN-2550 site-wide data warning', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'one size is enough for the behaviour'); });

  test('bills, electricity and water on with site-wide reads: one warning naming the exact scope, and nothing is written', async ({ page }) => {
    const { detail, writes } = await adminPage(page, { siteWide: ['bills', 'energy', 'water'], scope: SITE });
    const warn = detail.locator('[data-home-site-wide]');
    await expect(warn).toBeVisible();
    await expect(warn).toHaveAttribute('role', 'note');
    await expect(warn.locator('b')).toHaveText('יובל לביא יראה בממשק הביתי נתונים של כל האתר');
    const lines = warn.locator('li');
    await expect(lines).toHaveCount(3);
    await expect(lines.nth(0)).toHaveText('חשבון חשמל: החשבונות והסכומים של כל הלקוחות באתר (לקוחות: 4, חשבונות פעילים: 6), לא רק של הבית שלו.');
    await expect(lines.nth(1)).toHaveText('חשמל: הצריכה של כל מוני החשמל באתר (מונים: 14).');
    await expect(lines.nth(2)).toContainText('מים: הצריכה של כל מוני המים באתר (מונים: 5).');
    await expect(warn).toContainText('עדיין אין קישור בין אדם ללקוח החשבון או למונה שלו');
    // the warning sits under the categories it is about, inside the person's card
    const cols = await detail.locator('.cols').boundingBox();
    const box = await warn.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(cols!.y + cols!.height - 1);
    expect(writes).toEqual([]);
  });

  test('a single-customer site shows no warning (all accounts are that household\'s)', async ({ page }) => {
    const { detail } = await adminPage(page, { siteWide: ['bills', 'energy', 'water'], scope: { ...SITE!, customers: 1 } });
    await expect(detail.locator('label.chk', { hasText: 'חשבון חשמל' })).toBeVisible();
    await expect(detail.locator('[data-home-site-wide]')).toHaveCount(0);
  });

  test('only the categories that are on and read site-wide are listed', async ({ page }) => {
    const { detail } = await adminPage(page, { siteWide: ['energy', 'water'], modules: ALL.filter((m) => m !== 'water'), scope: SITE });
    const lines = detail.locator('[data-home-site-wide] li');
    await expect(lines).toHaveCount(1);
    await expect(lines.first()).toHaveText('חשמל: הצריכה של כל מוני החשמל באתר (מונים: 14).');
  });

  test('hiding the category removes its line live (the checkbox saves as before)', async ({ page }) => {
    const { el, detail } = await adminPage(page, { siteWide: ['bills'], scope: SITE });
    await expect(detail.locator('[data-home-site-wide] li')).toHaveCount(1);
    // the save reloads the policies; the mock answers the new list
    let saved: unknown = null;
    await page.route('**/api/v1/home/policies/dev-yuval', (r) => { saved = r.request().postDataJSON(); return ok(r, {}); });
    await page.unroute('**/api/v1/home/policies');
    await page.route('**/api/v1/home/policies', (r) => ok(r, { users: [person({ siteWide: ['bills'], modules: ALL.filter((m) => m !== 'bills') })], modules: ALL, seed: {}, kiosk_code_set: true, shared_scope: SITE }));
    await detail.locator('label.chk', { hasText: 'חשבון חשמל' }).locator('input').uncheck();
    await expect.poll(() => saved).toEqual({ modules: ALL.filter((m) => m !== 'bills') });
    await expect(el.locator('[data-home-detail] [data-home-site-wide]')).toHaveCount(0);
  });

  test('unknown counts: the lines are shown without numbers', async ({ page }) => {
    const { detail } = await adminPage(page, { siteWide: ['bills', 'water'], scope: { customers: null, bill_accounts: null, energy_meters: null, water_meters: null } });
    const lines = detail.locator('[data-home-site-wide] li');
    await expect(lines).toHaveCount(2);
    await expect(lines.nth(0)).toHaveText('חשבון חשמל: החשבונות והסכומים של כל הלקוחות באתר, לא רק של הבית שלו.');
    await expect(lines.nth(1)).toHaveText('מים: הצריכה של כל מוני המים באתר. הרשאת מים לפי קומה מגבילה אותו לקומות שלו.');
  });

  test('no warning without site-wide reads, for a system administrator, or from an older server', async ({ page }) => {
    let { detail } = await adminPage(page, { siteWide: [], scope: SITE });
    await expect(detail.locator('[data-home-site-wide]')).toHaveCount(0);
    ({ detail } = await adminPage(page, { siteWide: ['bills', 'energy', 'water'], scope: SITE, systemAdmin: true }));
    await expect(detail.locator('[data-home-site-wide]')).toHaveCount(0);
    ({ detail } = await adminPage(page, { scope: undefined })); // no site_wide and no shared_scope: an answer from before this row
    await expect(detail.locator('[data-home-site-wide]')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------- pixel baselines

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

test.describe('pixel-stable: home administration, the site-wide warning', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => { test.skip(info.project.name === 'tablet', 'desktop and phone only'); });

  for (const scheme of ['light', 'dark'] as const) {
    test(`person card with the warning ${scheme}`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      const { detail } = await adminPage(page, { siteWide: ['bills', 'energy', 'water'], scope: SITE, scheme });
      const warn = detail.locator('[data-home-site-wide]');
      await expect(warn).toBeVisible();
      const file = `home-perms-warn-${scheme}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
      // the person's card is taller than the viewport (23 categories): the baseline is the warning itself, scrolled into view (a tall
      // element capture was not stable on the runner, RELEASE-2510-TRAIN); the captures of the compare page show it in its card
      const target = warn;
      await target.scrollIntoViewIfNeeded();
      await settle(page);
      if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
      else await expect(target).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled', caret: 'hide', timeout: 15_000 });
    });
  }
});

// ---------------------------------------------------------------- compare-page captures (SW_SHOTS=1; the same file runs on the base build)

test.describe('HOME-PERMS-WARN-2550 captures', () => {
  test.skip(!process.env.SW_SHOTS, 'evidence only');
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'sizes are set per test'); });
  const OUT = process.env.SW_SHOTS_DIR || 'test-results/home-perms-warn-2550';
  for (const scheme of ['light', 'dark'] as const) {
    // desktop: a viewport tall enough for the whole person card (the shell scrolls inside, so a taller-than-viewport element capture comes
    // out cut); phone: the viewport with the categories' end and the warning scrolled into view
    for (const [size, w, h] of [['d1440', 1440, 2200], ['p390', 390, 844]] as const) {
      test(`capture ${size} ${scheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await page.setViewportSize({ width: w, height: h });
        const { detail } = await adminPage(page, { siteWide: ['bills', 'energy', 'water'], scope: SITE, scheme });
        await settle(page);
        await page.waitForTimeout(300);
        if (size === 'p390') {
          const warn = detail.locator('[data-home-site-wide]');
          const anchor = (await warn.count()) ? warn : detail.locator('label.chk').last();
          await anchor.evaluate((e) => e.scrollIntoView({ block: 'end' }));
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${OUT}/admin-person-${size}-${scheme}.png` });
          return;
        }
        await detail.screenshot({ path: `${OUT}/admin-person-${size}-${scheme}.png` });
      });
    }
  }
});
