import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the owner's round-2 notes (0.1.68) against the running developer backend: kiosk picker + exit,
// the wall's best-fit grid and kiosk button, playback without a page scroll, event hover on the whole row,
// the start-screen setting. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'owner-round-live');

test.describe('owner round 5: round-2 notes (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('kiosk picker readable, exit link, wall kiosk button', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?design=a#/kiosk/all');
    const kiosk = page.locator('kiosk-wall');
    await expect(kiosk.locator('[data-kiosk-layout]')).toBeVisible({ timeout: 30000 });
    await expect(kiosk.locator('[data-kiosk-exit]')).toBeVisible();
    const colors = await kiosk.locator('[data-kiosk-layout]').evaluate((s) => {
      const opt = (s as HTMLSelectElement).options[0];
      return { select: getComputedStyle(s).color, option: getComputedStyle(opt).color, optionBg: getComputedStyle(opt).backgroundColor };
    });
    expect(colors.select).toBe('rgb(255, 255, 255)');
    expect(colors.option).not.toBe('rgb(255, 255, 255)'); // the dropdown entries are dark on white
    await page.screenshot({ path: path.join(OUT, `kiosk-picker-${testInfo.project.name}.png`) });
    await kiosk.locator('[data-kiosk-exit]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/live/wall');
    const wall = page.locator('live-wall');
    await expect(wall.locator('[data-open-kiosk]')).toBeVisible({ timeout: 30000 });
    await expect(wall.locator('[data-open-kiosk]')).toHaveAttribute('target', '_blank');
  });

  test('wall best fit: picked cameras fill the screen as a rectangle', async ({ page, request }, testInfo) => {
    const cams = ((await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean }[]).filter((c) => c.enabled);
    expect(cams.length).toBeGreaterThanOrEqual(2);
    const ids = cams.slice(0, 2).map((c) => c.id);
    // a tall, narrow window: two cameras stack in one column; a wide one: side by side
    await page.setViewportSize({ width: 900, height: 1100 });
    await page.goto(`/?design=a#/live/wall?cameras=${ids.join(',')}`);
    const wall = page.locator('live-wall');
    await expect(wall.locator('sw-camera-tile')).toHaveCount(2, { timeout: 30000 });
    await expect(wall.locator('[data-wall-cols]')).toHaveAttribute('data-wall-cols', '1');
    await page.setViewportSize({ width: 1600, height: 800 });
    await expect(wall.locator('[data-wall-cols]')).toHaveAttribute('data-wall-cols', '2');
    const boxes = await wall.locator('sw-camera-tile').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
    for (const b of boxes) expect(b.bottom).toBeLessThanOrEqual(800 + 1); // nothing below the fold
    await page.screenshot({ path: path.join(OUT, `wall-fit-${testInfo.project.name}.png`) });
    // the count buttons do not claim a layout while the map's pick is shown; clicking one returns to the full wall
    await expect(wall.locator('.layouts button.on')).toHaveCount(0);
  });

  test('playback: no page scroll, the timeline is the last block', async ({ page, request }) => {
    const cams = ((await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean }[]).filter((c) => c.enabled);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?design=a#/investigate/playback?camera=${cams[0].id}`);
    const pb = page.locator('investigate-playback');
    await expect(pb.locator('sw-timeline')).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
      return main ? { scrollH: main.scrollHeight, clientH: main.clientHeight } : null;
    });
    expect(m, 'main element').toBeTruthy();
    expect(m!.scrollH).toBeLessThanOrEqual(m!.clientH + 2);
    const order = await pb.evaluate((el) => Array.from(el.shadowRoot!.querySelectorAll('.compare, .filters, .stage, .tlwrap')).map((x) => x.className.split(' ')[0]));
    expect(order.indexOf('tlwrap')).toBe(order.length - 1);
  });

  test('events: hovering the row (not only the thumbnail) shows the strip', async ({ page, request }) => {
    const ev = (await (await request.get('/api/v1/events?limit=500')).json()).events as { id: string; camera_id: string | null }[];
    await page.goto('/?design=a#/investigate/events');
    const screen = page.locator('investigate-events');
    await expect(screen.locator('sw-table tbody tr').first()).toBeVisible({ timeout: 30000 });
    // a rendered row whose event has a camera (the list shows one day; the API list may reach further back)
    const shown = await screen.locator('sw-table tbody tr').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')));
    const withCam = ev.find((e) => e.camera_id && shown.includes(e.id));
    test.skip(!withCam, 'no camera event on the events screen today');
    const row = screen.locator(`sw-table tbody tr[data-row-id="${withCam!.id}"]`);
    await expect(row).toBeVisible();
    const box = (await row.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2); // the text part of the row
    await expect(screen.locator('[data-row-preview]')).toBeVisible({ timeout: 5000 });
    await page.mouse.move(10, 10);
    await expect(screen.locator('[data-row-preview]')).toHaveCount(0);
  });

  test('start screen setting: the bare address lands on the chosen screen', async ({ page, request }) => {
    const before = (await (await request.get('/api/v1/settings')).json()).settings as Record<string, string>;
    try {
      expect((await request.patch('/api/v1/settings', { data: { 'ui.start_route': 'events' } })).status()).toBe(200);
      await page.goto('/?design=a');
      await expect.poll(() => page.evaluate(() => location.hash), { timeout: 30000 }).toBe('#/investigate/events');
      // an explicit route is left alone
      await page.goto('/?design=a#/live/wall');
      await page.waitForTimeout(2500);
      expect(await page.evaluate(() => location.hash)).toBe('#/live/wall');
      // hide the map: the area disappears from the rail and the default landing moves to the wall
      expect((await request.patch('/api/v1/settings', { data: { 'ui.start_route': 'explore', 'ui.hide_map': 'true' } })).status()).toBe(200);
      await page.goto('/?design=a');
      await expect.poll(() => page.evaluate(() => location.hash), { timeout: 30000 }).toBe('#/live/wall');
      await expect(page.locator('sw-app nav.rail a[href="#/explore/sites"]')).toHaveCount(0);
    } finally {
      await request.patch('/api/v1/settings', { data: { 'ui.start_route': before['ui.start_route'] ?? 'explore', 'ui.hide_map': before['ui.hide_map'] ?? 'false' } });
    }
  });
});
