import { expect, test, type Page, type Route } from '@playwright/test';
import { settle } from './helpers/settle';
import { pinToday } from './helpers/today-clock';
import { mockP2, type P2Opts } from './home-v3-p2-mocks';
import { mockHome } from './home-simple-mocks';

// HOME-NEXT-2500 (owner 22.11, Q72 = the recommendation) in the browser, mocked backend, on every size (desktop, tablet, phone): a wall
// panel is shared, so its notice board has no "קראתי" and a notice is "new" for 48 hours after it was published - whatever the panel's
// account has read. The installation setting changes the window (24 / 72 hours, a week) or brings "קראתי" back ("read"). A person's own
// screen keeps "new" = "not read by me". The administrator's "מסכי קיר" tab saves the setting.

const home = (page: Page) => page.locator('sw-home');
const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const H = 3600_000;

/** Three notices: read by the panel account 3 hours ago, unread but 50 hours old, unread 30 hours old (no buses, short bodies). */
function board(now: number) {
  const at = (hoursAgo: number) => new Date(now - hoursAgo * H).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const n = (id: string, title: string, hoursAgo: number, read: boolean) => ({ id, title, body: 'פרטים בלוח ההודעות של הבניין.', severity: 'info', pinned: false, read, starts_at: at(hoursAgo), ends_at: null, published_at: at(hoursAgo), when_text: null });
  return { notices: [n('fresh-read', 'החלפת נורות בלובי', 3, true), n('mid', 'ניקיון חניון', 30, false), n('old-unread', 'אסיפת דיירים', 50, false)] };
}

async function open(page: Page, o: P2Opts, route = 'notices') {
  const now = await pinToday(page);
  const mock = await mockP2(page, { features: { transit: { on: false } }, ...o });
  await page.route('**/api/v1/notices', (r) => json(r, board(now))); // registered after the mock layer, so it wins
  await page.goto('about:blank');
  await page.goto(`/#/home/${route}`);
  await home(page).waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await settle(page);
  return mock;
}

/** the wall block with the rest screen off, so a slow run never meets the rest screen; the rest of the block as the server sends it */
const wall = (o: Record<string, unknown> = {}) => ({ wall: { rest: false, ...o } });
const cards = (page: Page) => home(page).locator('[data-act="p2Notice"]');
const tab = (page: Page, v: 'new' | 'all') => home(page).locator(`[data-act="p2NtTab"][data-v="${v}"]`);
const reads = (calls: { path: string }[]) => calls.filter((c) => c.path.endsWith('/read')).length;

test.describe('HOME-NEXT-2500 notices on a shared wall panel', () => {
  test('48 hours by default: new by age, not by what the panel read; no "קראתי"', async ({ page }) => {
    const mock = await open(page, { kiosk: true, policy: wall() }); // a 2.48 server sends no notice_new_h: the default applies
    await expect(home(page).locator('.hs.v2')).toHaveAttribute('data-screen', 'notices');
    await expect(home(page).locator('main')).toContainText('2 הודעות חדשות');
    // the "new" tab: the one read 3 hours ago is still new, the unread one of 50 hours is not
    await expect(cards(page)).toHaveCount(2);
    await expect(cards(page).filter({ hasText: 'החלפת נורות בלובי' })).toHaveCount(1);
    await expect(cards(page).filter({ hasText: 'אסיפת דיירים' })).toHaveCount(0);
    await tab(page, 'all').click();
    await expect(cards(page)).toHaveCount(3);
    await expect(home(page).locator('.ncard.new')).toHaveCount(2);
    await expect(cards(page).filter({ hasText: 'אסיפת דיירים' }).locator('.newp')).toHaveCount(0);
    await cards(page).filter({ hasText: 'אסיפת דיירים' }).click();
    const sheet = home(page).locator('[data-sheet="notice"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[data-act="p2NoticeRead"]')).toHaveCount(0);
    await sheet.locator('.dlg-acts [data-act="close"]').click();
    await cards(page).filter({ hasText: 'ניקיון חניון' }).click();
    await expect(sheet.locator('[data-act="p2NoticeRead"]')).toHaveCount(0); // unread and new: still no "קראתי" on a shared screen
    expect(reads(mock.calls)).toBe(0);
  });

  test('the room screen chip counts by the same rule', async ({ page }) => {
    await open(page, { kiosk: true, policy: wall() }, 'r/living');
    const chip = home(page).locator('.chip3[data-cat="notices"]');
    await expect(chip).toHaveCount(1);
    await expect(chip).toContainText('2 הודעות חדשות');
  });

  test('the setting changes the window: 24 hours leaves one new notice, a week makes all three new', async ({ page }) => {
    await open(page, { kiosk: true, policy: wall({ notice_new_h: 24 }) });
    await expect(home(page).locator('main')).toContainText('הודעה חדשה אחת');
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page)).toContainText('החלפת נורות בלובי');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { kiosk: true, policy: wall({ notice_new_h: 168 }) });
    await expect(home(page).locator('main')).toContainText('3 הודעות חדשות');
    await expect(cards(page)).toHaveCount(3);
  });

  test('nothing new on the panel: the board says so, never "you read everything"', async ({ page }) => {
    await open(page, { kiosk: true, policy: wall({ notice_new_h: 1 }) });
    await expect(home(page).locator('main')).toContainText('אין הודעות חדשות');
    await expect(home(page).locator('main')).not.toContainText('קראת את כל ההודעות');
    await expect(cards(page)).toHaveCount(3); // with nothing new the board shows all
    await expect(home(page).locator('.ncard.new')).toHaveCount(0);
  });

  test('"read" brings the 2.48 behaviour back: new = unread, "קראתי" is sent', async ({ page }) => {
    const mock = await open(page, { kiosk: true, policy: wall({ notice_new_h: 0 }) });
    await expect(cards(page)).toHaveCount(2);
    await expect(cards(page).filter({ hasText: 'החלפת נורות בלובי' })).toHaveCount(0);
    await cards(page).filter({ hasText: 'אסיפת דיירים' }).click();
    await home(page).locator('[data-sheet="notice"] [data-act="p2NoticeRead"]').click();
    await expect.poll(() => reads(mock.calls)).toBe(1);
  });

  test('a person\'s own screen is unchanged: new = not read by me, with "קראתי"', async ({ page }) => {
    const mock = await open(page, { policy: wall({ notice_new_h: 168 }) }); // not a wall panel: the wall block is ignored
    await expect(cards(page)).toHaveCount(2);
    await expect(cards(page).filter({ hasText: 'אסיפת דיירים' })).toHaveCount(1);
    await expect(cards(page).filter({ hasText: 'החלפת נורות בלובי' })).toHaveCount(0);
    await cards(page).filter({ hasText: 'ניקיון חניון' }).click();
    await home(page).locator('[data-sheet="notice"] [data-act="p2NoticeRead"]').click();
    await expect.poll(() => reads(mock.calls)).toBe(1);
  });
});

test.describe('HOME-NEXT-2500 settings tab', () => {
  test('ממשק ביתי › מסכי קיר: how long a notice is new is saved, and "read" explains itself', async ({ page }) => {
    await mockHome(page, { perms: ['devices.read', 'rbac.assign', 'system.configure', 'identity.directory.read'], policy: { interface: 'full', default_interface: 'full', admin: true } });
    const ok = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    const sent: unknown[] = [];
    let settings: Record<string, string> = { default_mode: 'full_all', kiosk_exit: 'code', wallpaper: 'none', wall_rest: 'on', wall_rest_after: '2', wall_night: 'on', wall_night_start: '23:00', wall_night_end: '06:00', wall_night_dim: 'medium', wall_takeover: 'alarm_urgent', wall_notice_new: '48' };
    await page.route('**/api/v1/home/policies', (r) => r.fulfill(ok({ users: [], modules: ['lights'], seed: {}, kiosk_code_set: true })));
    await page.route('**/api/v1/home/settings', (r) => {
      if (r.request().method() === 'PUT') { const b = r.request().postDataJSON() as Record<string, string>; sent.push(b); settings = { ...settings, ...b }; return r.fulfill(ok({ settings })); }
      return r.fulfill(ok({ settings, values: {}, gallery: [] }));
    });
    await page.route('**/api/v1/identity/users**', (r) => r.fulfill(ok({ users: [], directory: { paired: false, users: 0, last_directory_at: null }, revision: 1, delegated: false })));
    await page.route('**/api/v1/access/roles**', (r) => r.fulfill(ok({ roles: [] })));
    await page.route('**/api/v1/access/groups**', (r) => r.fulfill(ok({ groups: [], can_manage: true })));
    await page.route('**/api/v1/sites?tree=true', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/#/system/access?tab=home');
    const admin = page.locator('sw-home-admin');
    await admin.waitFor();
    await admin.locator('[data-home-subtabs] [role="tab"]', { hasText: 'מסכי קיר' }).click();
    const row = admin.locator('[data-wall-notice-new]');
    await expect(row).toBeVisible();
    await expect(row).toContainText('אין בו «קראתי»');
    await row.locator('[data-notice-new="72"]').click();
    await row.locator('[data-notice-new="read"]').click();
    await expect.poll(() => sent.map((s) => JSON.stringify(s))).toEqual(['{"wall_notice_new":"72"}', '{"wall_notice_new":"read"}']);
    await expect(row).toContainText('כמו קודם');
    await expect(admin.locator('.msg.ok')).toContainText('מסכי הקיר');
    // the tab still fits the screen it is shown on: nothing in the pane scrolls sideways
    expect(await admin.locator('[data-home-wall-settings]').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  });
});
