import { test, expect, type Page } from '@playwright/test';

// CLOCK-293: the home clock widget must keep time. Demo data (no backend: run the preview / dev server with SW_API_PORT pointing at a port
// nothing listens on), Playwright's fake clock (page.clock) for the time. The bug: the widget re-armed its own 10 s timer after EVERY render,
// so on a live installation - where the data is replaced all the time - the timer never fired and the clock stayed at the load time.

const HOME = '/?design=a&home_info=cards#/devices/building'; // POLISH-295: the cards (the product default is the thin header bar)
const W = 'devices-building home-widgets';

/** Load the page on the fake clock (a cold dev server can take longer than any fixed pause time), then put the wall clock at `startAt` and
 * freeze it there; the widget is told by the same resume event a real tab gets when it is shown again. */
async function boot(page: Page, startAt: string) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.devices.layout', 'tiles');
      localStorage.removeItem('sw.tiles.override');
    } catch {
      /* storage unavailable */
    }
  });
  await page.clock.install({ time: new Date(new Date(startAt).getTime() - 60_000) });
  await page.goto('about:blank');
  await page.goto(HOME);
  await page.waitForSelector(`${W} [data-home-time]`);
  await page.clock.setSystemTime(new Date(startAt));
  await page.clock.pauseAt(new Date(new Date(startAt).getTime() + 1_000));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
}

/** What a live installation does all the time: the same data arrives again as a new object, which re-renders the widgets. */
const refresh = (page: Page) =>
  page.locator(W).evaluate((el) => {
    const w = el as unknown as { data: unknown; config: unknown };
    w.data = { ...(w.data as object) };
    w.config = { ...(w.config as object) };
  });

test.describe('home clock widget', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough: the logic does not depend on it');
  });

  test('it advances every minute', async ({ page }) => {
    await boot(page, '2026-10-20T13:44:20Z'); // 16:44 in Asia/Jerusalem
    const t = page.locator(`${W} [data-home-time]`);
    await expect(t).toHaveText('16:44');
    await page.clock.runFor(60_000);
    await expect(t).toHaveText('16:45');
    await page.clock.runFor(10 * 60_000);
    await expect(t).toHaveText('16:55');
  });

  test('it keeps advancing while the data is refreshed more often than the clock ticks (the owner bug)', async ({ page }) => {
    await boot(page, '2026-10-20T13:44:20Z');
    const t = page.locator(`${W} [data-home-time]`);
    await expect(t).toHaveText('16:44');
    for (let i = 0; i < 36; i++) {
      await refresh(page); // every 5 s: well inside the old 10 s re-arm window
      await page.clock.runFor(5_000);
    }
    await expect(t).toHaveText('16:47'); // 13:44:20 + 180 s
  });

  test('it catches up at once after the machine slept or the tab was hidden (no timer ran meanwhile)', async ({ page }) => {
    await boot(page, '2026-10-20T13:44:20Z');
    const t = page.locator(`${W} [data-home-time]`);
    await expect(t).toHaveText('16:44');
    await page.clock.setSystemTime(new Date('2026-10-20T16:09:30Z')); // the wall clock moved, the paused timers did not run
    await expect(t).toHaveText('16:44'); // nothing has told the widget yet
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(t).toHaveText('19:09');
  });

  test('it crosses midnight: the date and the Hebrew date roll over', async ({ page }) => {
    await boot(page, '2026-10-20T20:58:20Z'); // 23:58:20 on 20.10 in Asia/Jerusalem
    // no date sensor: the widget computes the Hebrew date itself, which is what changes at midnight
    await page.locator(W).evaluate((el) => {
      const w = el as unknown as { config: { calendar: Record<string, unknown> } };
      w.config = { ...w.config, calendar: { ...w.config.calendar, date: '' } } as never;
    });
    const t = page.locator(`${W} [data-home-time]`);
    const d1 = page.locator(`${W} .d1`);
    const heb = page.locator(`${W} [data-home-hebrew-date]`);
    await expect(t).toHaveText('23:58');
    await expect(d1).toContainText('20.10');
    const before = await heb.textContent();
    expect(before).toMatch(/\S/);
    await page.clock.runFor(2 * 60_000);
    await expect(t).toHaveText('00:00');
    await expect(d1).toContainText('21.10');
    await expect(d1).not.toContainText('20.10');
    await expect(heb).not.toHaveText(before!);
  });

  test('leaving the screen stops the clock: later ticks run nothing and throw nothing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page, '2026-10-20T13:44:20Z');
    await page.evaluate(() => (location.hash = '#/system/settings'));
    await expect(page.locator(W)).toHaveCount(0);
    await page.clock.runFor(5 * 60_000);
    expect(errors).toEqual([]);
  });
});
