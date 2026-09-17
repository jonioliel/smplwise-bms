import { test, expect } from '@playwright/test';

// Evidence for the owner's test-round batch 1 (0.1.61) against the running developer backend:
// the wall remembers its tile count and opens with the owner's default, the kiosk carries a layout picker that writes
// cols/rows into the URL, the AI search tab can be hidden from the settings, and the event centre offers "ack all".
// Runs only with SW_LIVE=1.

test.describe('owner round 1 (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('wall count: browser choice survives a reload, owner default applies to a fresh browser', async ({ page, browser, request }) => {
    test.setTimeout(120000);
    const before = (await (await request.get('/api/v1/settings')).json()).settings as Record<string, string>;
    try {
      await page.goto('/?design=a#/live/wall');
      const wall = page.locator('live-wall');
      await expect(wall.locator('.layouts button.on')).toHaveCount(1, { timeout: 20000 });
      await wall.locator('.layouts button', { hasText: /^9$/ }).click();
      await expect(wall.locator('.layouts button.on')).toHaveText('9');
      await page.reload();
      await expect(wall.locator('.layouts button.on')).toHaveText('9', { timeout: 20000 });
      // the owner's default (16) applies where no browser choice exists
      const r = await request.patch('/api/v1/settings', { data: { 'ui.wall_count': 16 } });
      expect(r.status(), 'settings patch').toBe(200);
      const ctx = await browser.newContext();
      const fresh = await ctx.newPage();
      await fresh.goto('/?design=a#/live/wall');
      await expect(fresh.locator('live-wall .layouts button.on')).toHaveText('16', { timeout: 20000 });
      await ctx.close();
    } finally {
      await request.patch('/api/v1/settings', { data: { 'ui.wall_count': Number(before['ui.wall_count'] ?? 4) } });
    }
  });

  test('kiosk: the layout picker writes cols/rows into the URL and the grid follows', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/?design=a#/kiosk/all');
    const kiosk = page.locator('kiosk-wall');
    const pick = kiosk.locator('[data-kiosk-layout]');
    await expect(pick).toBeVisible({ timeout: 30000 });
    await pick.selectOption('4x3');
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 10000 }).toMatch(/cols=4/);
    expect(await page.evaluate(() => location.hash)).toMatch(/rows=3/);
    await expect.poll(() => kiosk.locator('.grid').evaluate((el) => getComputedStyle(el).getPropertyValue('--cols').trim()), { timeout: 20000 }).toBe('4');
    const cams = (await (await page.request.get('/api/v1/cameras')).json()).cameras as { enabled: boolean }[];
    const enabled = cams.filter((c) => c.enabled).length;
    // 4 x 3 = 12 per page: one page when the installation has 12 cameras or fewer (then no page counter is shown)
    await expect(kiosk.locator('[data-kiosk-tile]')).toHaveCount(Math.min(12, enabled), { timeout: 20000 });
    if (enabled > 12) await expect(kiosk.locator('[data-kiosk-page]')).toContainText('עמוד 1/');
    // the choice is remembered for this browser: a plain kiosk URL opens with it
    await page.goto('/?design=a#/kiosk/all');
    await expect.poll(() => kiosk.locator('.grid').evaluate((el) => getComputedStyle(el).getPropertyValue('--cols').trim()), { timeout: 20000 }).toBe('4');
  });

  test('settings: hiding the AI search removes its tab from the investigate navigation', async ({ page, request }) => {
    test.setTimeout(120000);
    const before = (await (await request.get('/api/v1/settings')).json()).settings as Record<string, string>;
    try {
      await request.patch('/api/v1/settings', { data: { 'ui.hide_search': 'true' } });
      await page.goto('/?design=a#/investigate/events');
      await page.waitForSelector('sw-app');
      await expect(page.locator('sw-app a[href="#/investigate/cases"]').first()).toBeVisible({ timeout: 20000 });
      await expect(page.locator('sw-app a[href="#/investigate/search"]')).toHaveCount(0);
      await request.patch('/api/v1/settings', { data: { 'ui.hide_search': 'false' } });
      await page.reload();
      await expect(page.locator('sw-app a[href="#/investigate/search"]').first()).toBeVisible({ timeout: 20000 });
    } finally {
      await request.patch('/api/v1/settings', { data: { 'ui.hide_search': before['ui.hide_search'] === 'true' ? 'true' : 'false' } });
    }
  });

  test('event centre: "ack all" acknowledges every unreviewed event of the shown day', async ({ page, request }) => {
    test.setTimeout(120000);
    // a day of its own so the dev database's other days stay untouched: two synthetic events are not available
    // through the API, so the check runs on whatever day the list shows, then verifies the count through the API
    await page.goto('/?design=a#/investigate/events');
    const screen = page.locator('investigate-events');
    const btn = screen.locator('[data-ack-all]');
    await expect(btn).toBeVisible({ timeout: 30000 });
    const text = (await btn.textContent()) ?? '';
    const n = Number((text.match(/\((\d+)\)/) ?? [])[1] ?? 0);
    if (n === 0) {
      await expect(btn).toBeDisabled();
      test.info().annotations.push({ type: 'note', description: 'no unreviewed events on the shown day - only the disabled state is verified' });
      return;
    }
    await btn.click();
    await expect(btn).toContainText('(0)', { timeout: 60000 });
    const date = await screen.locator('input[type="date"]').first().inputValue().catch(() => '');
    if (date) {
      const after = await (await request.get(`/api/v1/events?date=${date}&unacked=true&limit=1`)).json();
      expect((after.events as unknown[]).length).toBe(0);
    }
  });
});
