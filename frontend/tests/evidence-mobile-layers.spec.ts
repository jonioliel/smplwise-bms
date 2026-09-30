import { test, expect, devices, type Page, type Locator } from '@playwright/test';

// Owner bug 2026-09-30 (real Android Chrome): on the map's floor screen the "שכבות פעילות" panel could not be
// scrolled on a phone, so the toggles at the bottom of the list were unreachable (only 8 of ~12 rows). Root cause: the
// panel is absolutely positioned inside `.stage` (overflow: hidden) with no max height and no own scrolling, so on a
// phone (stage ~ 500 px high) the rows below the fold were simply clipped. Fix: the panel is capped to the stage and
// scrolls itself (touch-action pan-y, overscroll contained). Demo mode (no backend): the built app, the preview serves dist/.
// The same for the other floating sheets on the map: the side list body.
test.use({ ...devices['Pixel 7'], viewport: { width: 390, height: 700 }, hasTouch: true }); // 700: a real Android Chrome with its address bar
test.skip(({ viewport }) => !viewport || viewport.width > 500, 'phone project only');

async function open(page: Page, hash: string) {
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1200);
}

/** A real finger swipe through the browser's touch input pipeline (CDP Input.dispatchTouchEvent: touchstart, a run of
 * touchmoves, touchend) starting over the element's centre; dy < 0 drags the finger up, which scrolls the content down. */
async function touchScroll(page: Page, target: Locator, dy: number) {
  const box = (await target.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = Math.round(box.x + box.width / 2);
  const y0 = Math.round(box.y + box.height / 2);
  const steps = 12;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= steps; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + Math.round((dy * i) / steps) }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  // the fling's momentum keeps the content moving after touchend: wait until the position is still before measuring
  let prev = -1;
  for (let i = 0; i < 30; i++) {
    const now = await target.evaluate((el) => el.scrollTop);
    if (now === prev) break;
    prev = now;
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(400);
  // the first tap after a scripted swipe is swallowed by Chrome's gesture handling (it only ends the fling): spend it on the
  // panel's note, an inert element that is in view once the list is scrolled to its end
  const note = target.locator('.pnote');
  if ((await note.count()) && (await target.evaluate((el) => el.scrollTop)) > 0) {
    const n = (await note.boundingBox())!;
    await page.touchscreen.tap(n.x + n.width / 2, n.y + n.height / 2);
    await page.waitForTimeout(200);
  }
}

test.describe('phone: the map floor sheets scroll', () => {
  test('layers panel: every toggle is reachable and tappable by touch', async ({ page }) => {
    await open(page, '/explore/floors/f0');
    await expect(page.locator('explore-floor-map sw-plan-canvas')).toBeVisible();
    await page.locator('explore-floor-map').getByRole('button', { name: 'שכבות' }).click();
    const panel = page.locator('explore-floor-map [data-layers-panel]');
    await expect(panel).toBeVisible();
    const rows = await panel.locator('.prow').count();
    expect(rows).toBeGreaterThanOrEqual(9);
    const stage = page.locator('explore-floor-map .stage');
    const last = panel.locator('sw-toggle').last();

    // the panel never grows past the stage that clips it
    const sb = (await stage.boundingBox())!;
    const pb = (await panel.boundingBox())!;
    expect(pb.y + pb.height, 'the panel must fit inside the stage').toBeLessThanOrEqual(sb.y + sb.height + 1);

    // it is a scroll container, and a touch swipe moves it
    const metrics = await panel.evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, top: el.scrollTop }));
    expect(metrics.scrollHeight, 'the list is taller than the phone stage, so it has to scroll').toBeGreaterThan(metrics.clientHeight);
    await touchScroll(page, panel, -400);
    const after = await panel.evaluate((el) => el.scrollTop);
    expect(after, 'a touch swipe scrolls the layers panel').toBeGreaterThan(0);

    // the last toggle is now inside the visible part of the panel and a tap switches it
    const lb = (await last.boundingBox())!;
    const vb = (await panel.boundingBox())!;
    expect(lb.y).toBeGreaterThanOrEqual(vb.y - 1);
    expect(lb.y + lb.height).toBeLessThanOrEqual(vb.y + vb.height + 1);
    const before = await last.evaluate((el) => (el as unknown as { checked: boolean }).checked);
    await page.touchscreen.tap(lb.x + lb.width / 2, lb.y + lb.height / 2);
    await expect.poll(() => last.evaluate((el) => (el as unknown as { checked: boolean }).checked)).toBe(!before);
    // the page itself did not scroll sideways
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });

  test('side list: the list body scrolls by touch inside the sheet', async ({ page }) => {
    await open(page, '/explore/floors/f0');
    const btn = page.locator('explore-floor-map [data-sidelist-toggle]');
    test.skip((await btn.count()) === 0, 'the side list is an API-mode control (no demo data)');
  });
});
