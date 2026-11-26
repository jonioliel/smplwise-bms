import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { url } from './generator-mocks';
import { appReady } from './helpers/app-ready';
import { settle } from './helpers/settle';
import { mockP2 } from './home-v3-p2-mocks';
import { pinToday } from './helpers/today-clock';

// TIME-CORRECT-2540: the three states whose look is new - the drawer's "what to cancel" step of a weekly date (SCR-38), the resident's
// "my bookings could not be loaded" (SCR-36), home › my bookings with a displaced one (SCR-34). Light and dark, the element only.
// Titles carry "pixel-stable" (the gate's pixel lane). Linux baselines are generated on the runner with --update-snapshots, looked at,
// then committed; on an OS without a baseline the check is skipped instead of failing on a missing file.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/pixel-time-correct-2540.spec.ts --project=desktop --project=mobile -u

const CLOCK = new Date('2026-10-29T10:40:00+02:00');
const P = 'sw-app calendars-page';
const R = 'sw-app calendars-page cal-resident';
const proj = () => test.info().project.name;
const noBaseline = (name: string) => {
  const info = test.info();
  return !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));
};

async function openCal(page: Page, hash: string, scheme: 'light' | 'dark') {
  await page.clock.setFixedTime(CLOCK);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  await appReady(page);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`pixel-stable: drawer cancel step of a weekly date (${scheme})`, async ({ page }) => {
    test.skip(proj() !== 'desktop', 'the desktop rooms timeline');
    const name = `tc-drawer-cancel-${scheme}.png`;
    test.skip(noBaseline(name), 'no baseline for this OS');
    await openCal(page, '/calendars/rooms?date=2026-10-29', scheme);
    await page.locator(`${P} cal-view-rooms [data-cal-entry][title^="זומבה"]`).first().click();
    const d = page.locator(`${P} cal-event-drawer`);
    await d.locator('[data-cal-cancel-event]').click();
    await expect(d.locator('[data-cal-cancel-scope]')).toBeVisible();
    await settle(page);
    await expect(d.locator('[data-cal-cancel-note]')).toHaveScreenshot(name, { animations: 'disabled', maxDiffPixelRatio: 0.01 });
  });

  test(`pixel-stable: resident my bookings, failed read (${scheme})`, async ({ page }) => {
    test.skip(proj() !== 'mobile', 'the resident flow is the phone layout');
    const name = `tc-resident-mine-error-${scheme}.png`;
    test.skip(noBaseline(name), 'no baseline for this OS');
    await openCal(page, '/calendars/cal?role=resident', scheme);
    await page.locator(`${R} [data-res-tab="mine"]`).click();
    await page.locator(`${R} [data-res-booking]`).first().waitFor();
    await page.evaluate(() => history.replaceState(history.state, '', location.href.replace('role=resident', 'role=resident&data=error')));
    await page.locator(`${R} [data-res-past]`).click();
    await expect(page.locator(`${R} [data-res-state="mine-error"]`)).toBeVisible();
    await settle(page);
    await expect(page.locator(`${R} [data-res-view="mine"]`)).toHaveScreenshot(name, { animations: 'disabled', maxDiffPixelRatio: 0.01 });
  });

  test(`pixel-stable: home my bookings with a displaced one (${scheme})`, async ({ page }) => {
    const name = `tc-home-my-bookings-${scheme}.png`;
    test.skip(noBaseline(name), 'no baseline for this OS');
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    const now = await pinToday(page);
    await mockP2(page, { now });
    const at = (min: number) => new Date(now + min * 60_000).toISOString();
    const row = (id: string, state: string, from: number) => ({ occurrence_id: id, event_id: id, calendar_id: 'room-club', room_calendar_ids: ['room-club'], start: at(from), end: at(from + 120),
      state, kind: 'booking', title: 'הזמנה', organizer: { id: 'x', name: 'נועה' }, revision: 1, all_day: false });
    await page.route('**/api/v1/me/calendar?**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ occurrences: [row('b1', 'displaced', 26 * 60), row('b2', 'confirmed', 3 * 60)], pending: [] }) }));
    await page.goto('/#/home/calendar/book');
    const home = page.locator('sw-home');
    await expect(home.locator('[data-bk-state]')).toHaveCount(2);
    await settle(page);
    await expect(home.locator('section.pane').filter({ has: page.locator('[data-bk-state]') })).toHaveScreenshot(name, { animations: 'disabled', maxDiffPixelRatio: 0.01 });
  });
}
