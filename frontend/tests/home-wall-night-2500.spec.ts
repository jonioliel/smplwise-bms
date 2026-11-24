import { expect, test, type Page, type Route } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockP2, type P2Opts } from './home-v3-p2-mocks';
import { mockHome } from './home-simple-mocks';
import { alarmPanels } from './home-wall-night-mocks';

// HOME-WALL-NIGHT-2500 (owner 22.11, Q70 / Q71 / Q73 / Q74): the wall panel in the browser, mocked backend (home-v3-p2-mocks.ts), the
// page's clock installed and moved forward. The rest screen comes after 2 minutes without a touch and its first touch only wakes (the
// light under the finger is not switched); at night the screen is only dimmed (a layer, lighter while in use); the alarm and an urgent
// notice take the screen over and wake it; a door call comes first; a person who is not a wall panel never sees any of it; the
// administrator's "מסכי קיר" tab saves the settings. No layer scrolls.

const home = (page: Page) => page.locator('sw-home');
const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

function today(h: number, m: number): number {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

async function open(page: Page, time: number, o: P2Opts = {}, routes?: () => Promise<unknown>) {
  await page.clock.install({ time });
  const mock = await mockP2(page, { kiosk: true, now: time, ...o });
  await routes?.(); // registered after the mock layer, so they win
  await page.goto('/#/home/r/living');
  await home(page).waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await settle(page);
  // the shell may draw the screen once more after the session settles (a new <sw-home>, a new rest count): let it, before the clock moves
  await page.waitForTimeout(1500);
  return mock;
}

const dim = (page: Page) => page.evaluate(() => {
  const el = document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('[data-wall-dim]') as HTMLElement | null;
  return el ? Number(el.style.opacity) : null;
});

const actions = (calls: { path: string }[]) => calls.filter((c) => c.path.startsWith('ha/entities/')).length;

test.describe('HOME-WALL-NIGHT-2500 wall panel', () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop'); });

  test('the rest screen comes after 2 minutes, shows the day at a glance, does not scroll, and its first touch only wakes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const mock = await open(page, today(12, 0));
    const lamp = home(page).locator('[data-act="light"]').first();
    const box = (await lamp.boundingBox())!;
    // the page clock also runs on its own while the test works, so the boundary is checked with slack here (the exact second is
    // unit-home-wall-night-2500.spec.ts's, on a fake clock that only moves when told)
    await page.clock.fastForward(105_000);
    await expect(home(page).locator('[data-wall-rest]')).toHaveCount(0);
    await page.clock.fastForward(16_000);
    const rest = home(page).locator('[data-wall-rest]');
    await expect(rest).toBeVisible();
    await expect(rest.locator('.wr-time')).toHaveText(/^12:0[2-3]$/);
    await expect(rest.locator('.wr-wx')).toContainText('22°');
    await expect(rest.locator('[data-wr="doors"]')).toContainText('כל הדלתות נעולות');
    await expect(rest.locator('[data-wr="today"]')).toBeVisible();
    expect(await rest.evaluate((el) => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await dim(page)).toBe(0); // by day nothing is dimmed
    const before = actions(mock.calls);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); // the finger lands where a light is
    await expect(rest).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(actions(mock.calls)).toBe(before); // woken, nothing switched
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); // the second touch is a normal touch
    await expect.poll(() => actions(mock.calls)).toBe(before + 1);
  });

  test('night 23:00-06:00: dimmed only - lighter while in use, the chosen dim at rest; a touch keeps it lighter', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await open(page, today(23, 30));
    expect(await dim(page)).toBe(0.27);
    await page.clock.fastForward(121_000);
    await expect(home(page).locator('[data-wall-rest]')).toHaveAttribute('data-night', 'on');
    expect(await dim(page)).toBe(0.68);
    await home(page).locator('[data-wall-rest]').click();
    await expect(home(page).locator('[data-wall-rest]')).toHaveCount(0);
    expect(await dim(page)).toBe(0.27);
  });

  test('the settings reach the panel: rest off + strong dim (night: a dark layer that only wakes), custom hours', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const wall = { rest: false, rest_after_min: 1, night: true, night_start: '22:00', night_end: '07:00', night_dim: 'strong', takeover: 'alarm_urgent' };
    const mock = await open(page, today(22, 15), { policy: { wall } });
    await page.clock.fastForward(61_000);
    await expect(home(page).locator('[data-wall-rest]')).toHaveCount(0);
    const catcher = home(page).locator('.wcatch[data-wall-catch]');
    await expect(catcher).toBeVisible();
    expect(await dim(page)).toBe(0.82);
    const before = actions(mock.calls);
    await catcher.click();
    await expect(catcher).toHaveCount(0);
    expect(actions(mock.calls)).toBe(before);
    expect(await dim(page)).toBe(0.33);
  });

  test('a sounding alarm takes the screen over and wakes it at night (no dim); "הבנתי" gives the screen back', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const at = today(23, 30);
    let state = 'armed_night';
    await open(page, at, { perms: ['alarm.view'] }, () => page.route('**/api/v1/alarm/panels', (r) => json(r, alarmPanels(state, at))));
    await page.clock.fastForward(121_000);
    await expect(home(page).locator('[data-wall-rest]')).toBeVisible();
    await expect(home(page).locator('[data-wr="alarm"]')).toContainText('דרוכה: לילה');
    state = 'triggered';
    await page.clock.fastForward(61_000); // the minute poll (a pushed state change does the same at once)
    const t = home(page).locator('[data-wall-takeover="alarm"]');
    await expect(t).toBeVisible();
    await expect(t).toContainText('האזעקה פועלת');
    await expect(t).toContainText('דלת המרפסת');
    await expect(home(page).locator('[data-wall-rest]')).toHaveCount(0);
    expect(await dim(page)).toBe(0);
    expect(await t.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
    await t.locator('[data-wall-ack]').click();
    await expect(t).toHaveCount(0);
    await page.clock.fastForward(121_000);
    await expect(home(page).locator('[data-wall-rest]')).toBeVisible();
  });

  test('an urgent notice takes the screen once per panel; "alarm only" and "door call only" leave it on the board', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const at = today(12, 0);
    const urgent = { notices: [{ id: 'u1', title: 'הפסקת חשמל דחופה', body: 'בעוד 30 דקות.', severity: 'critical', pinned: true, read: false, starts_at: new Date(at - 600_000).toISOString(), ends_at: null, published_at: new Date(at - 600_000).toISOString(), when_text: null }] };
    await page.clock.install({ time: at });
    await mockP2(page, { kiosk: true, now: at });
    await page.route('**/api/v1/notices', (r) => json(r, urgent));
    await page.goto('/#/home/r/living');
    const t = home(page).locator('[data-wall-takeover="notice"]');
    await expect(t).toBeVisible();
    await expect(t).toContainText('הפסקת חשמל דחופה');
    await t.locator('[data-wall-open]').click();
    await expect(t).toHaveCount(0);
    await expect(page).toHaveURL(/#\/home\/notices$/);
    await page.reload();
    await home(page).waitFor();
    await page.waitForTimeout(1500);
    await expect(t).toHaveCount(0); // seen on this panel

    for (const takeover of ['alarm', 'call_only']) {
      await page.evaluate(() => localStorage.removeItem('arx-wall-seen'));
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mockP2(page, { kiosk: true, now: at, policy: { wall: { rest: true, rest_after_min: 2, night: true, night_start: '23:00', night_end: '06:00', night_dim: 'medium', takeover } } });
      await page.route('**/api/v1/notices', (r) => json(r, urgent));
      await page.goto('/#/home/r/home');
      await page.goto('/#/home/r/living');
      await home(page).waitFor();
      await page.waitForTimeout(1500);
      await expect(t).toHaveCount(0);
    }
  });

  test('a door call comes first: it wakes the rest screen and no takeover is drawn over it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const at = today(23, 30);
    const mock = await open(page, at, { perms: ['alarm.view', 'access.call', 'access.doors.open'] }, () => page.route('**/api/v1/alarm/panels', (r) => json(r, alarmPanels('armed_night', at))));
    await page.clock.fastForward(121_000);
    await expect(home(page).locator('[data-wall-rest]')).toBeVisible();
    mock.ring(true);
    await page.route('**/api/v1/alarm/panels', (r) => json(r, alarmPanels('triggered', at)));
    await page.clock.fastForward(61_000);
    await expect(home(page).locator('[data-incoming-call]')).toBeVisible();
    await expect(home(page).locator('[data-wall-rest]')).toHaveCount(0);
    await expect(home(page).locator('[data-wall-takeover]')).toHaveCount(0);
    expect(await dim(page)).toBe(0);
    mock.ring(false);
    await page.clock.fastForward(5_000);
    await expect(home(page).locator('[data-incoming-call]')).toHaveCount(0);
    await expect(home(page).locator('[data-wall-takeover="alarm"]')).toBeVisible({ timeout: 10_000 }); // after the call, the alarm
  });

  test('a person who is not a wall panel never gets a rest screen or a night layer', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, today(23, 30), { kiosk: false });
    await page.clock.fastForward(5 * 60_000);
    await expect(home(page).locator('[data-wall-rest]')).toHaveCount(0);
    await expect(home(page).locator('[data-wall-dim]')).toHaveCount(0);
  });
});

test.describe('HOME-WALL-NIGHT-2500 settings tab', () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop'); });

  test('ממשק ביתי › מסכי קיר: rest, minutes, night hours, dim and takeover are saved', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockHome(page, { perms: ['devices.read', 'rbac.assign', 'system.configure', 'identity.directory.read'], policy: { interface: 'full', default_interface: 'full', admin: true } });
    const ok = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    const sent: { path: string; body: unknown }[] = [];
    let settings: Record<string, string> = { default_mode: 'full_all', kiosk_exit: 'code', wallpaper: 'none', wall_rest: 'on', wall_rest_after: '2', wall_night: 'on', wall_night_start: '23:00', wall_night_end: '06:00', wall_night_dim: 'medium', wall_takeover: 'alarm_urgent' };
    await page.route('**/api/v1/home/policies', (r) => r.fulfill(ok({ users: [], modules: ['lights'], seed: {}, kiosk_code_set: true })));
    await page.route('**/api/v1/home/settings', (r) => {
      if (r.request().method() === 'PUT') { const b = r.request().postDataJSON() as Record<string, string>; sent.push({ path: 'home/settings', body: b }); settings = { ...settings, ...b }; return r.fulfill(ok({ settings })); }
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
    const pane = admin.locator('[data-home-wall-settings]');
    await expect(pane).toBeVisible();
    await pane.locator('[data-wall-rest-after] [data-rest-after="5"]').click();
    await pane.locator('[data-install-time="wall_night_start"]').fill('22:30');
    await pane.locator('[data-install-time="wall_night_start"]').dispatchEvent('change');
    await pane.locator('[data-install="wall_night_dim:strong"]').check();
    await pane.locator('[data-install="wall_takeover:alarm"]').check();
    await pane.locator('[data-wall-rest-toggle]').click();
    await expect.poll(() => sent.map((s) => JSON.stringify(s.body))).toEqual(['{"wall_rest_after":"5"}', '{"wall_night_start":"22:30"}', '{"wall_night_dim":"strong"}', '{"wall_takeover":"alarm"}', '{"wall_rest":"off"}']);
    await expect(admin.locator('.msg.ok')).toContainText('מסכי הקיר');
  });
});
