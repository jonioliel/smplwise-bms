import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { url } from './generator-mocks';
import { appReady } from './helpers/app-ready';
import { settle } from './helpers/settle';
import { mockP2 } from './home-v3-p2-mocks';
import { pinToday } from './helpers/today-clock';

// TIME-CORRECT-2540: what a person reads about a booking is the truth.
//  - SCR-38: the booking drawer opened on one date of a weekly entry asks WHAT to cancel (only this date / the whole series) and sends that
//    date alone by default; a cancel of the whole series says so on the button.
//  - SCR-36: the resident's "my bookings" that could not be read says so, with a retry - never "you have no bookings".
//  - SCR-34: home › shared rooms › my bookings: a booking maintenance displaced reads "displaced", not "approved".
// Demo mode for the calendars (src/calendars/demo.ts, invented data), the home mocks for the home screen. SW_TC_SHOTS=<folder> also keeps
// the screenshots of the compare page (private, local).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-time-correct-2540.spec.ts --workers=2

const CLOCK = new Date('2026-10-29T10:40:00+02:00'); // Thursday 29.10.2026 10:40 (the demo's "now")
const P = 'sw-app calendars-page';
const R = 'sw-app calendars-page cal-resident';
const proj = () => test.info().project.name;
const SHOTS = process.env.SW_TC_SHOTS || '';

async function shot(page: Page, name: string, scheme = 'light') {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await settle(page);
  await page.screenshot({ path: path.join(SHOTS, `${name}-${proj()}-${scheme}.png`), animations: 'disabled' });
}

async function openCal(page: Page, hash: string, scheme: 'light' | 'dark' = 'light') {
  await page.clock.setFixedTime(CLOCK);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  await appReady(page);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`SCR-38: the drawer of one date of a weekly entry - "only this date" first, the series only when chosen (${scheme})`, async ({ page }) => {
    test.skip(proj() !== 'desktop', 'the rooms timeline shows the evening on the desktop window');
    await openCal(page, '/calendars/rooms?date=2026-10-29', scheme);
    await page.locator(`${P} cal-view-rooms [data-cal-entry][title^="זומבה"]`).first().click();
    const d = page.locator(`${P} cal-event-drawer`);
    const cancel = d.locator('[data-cal-cancel-event]');
    await expect(cancel).toBeVisible();
    await cancel.click(); // the first press asks
    const scope = d.locator('[data-cal-cancel-scope]');
    await expect(scope).toBeVisible();
    await expect(scope.locator('[data-scope="occurrence"]')).toHaveAttribute('aria-checked', 'true');
    await expect(scope.locator('[data-scope="occurrence"]')).toContainText('ה׳ 29.10');
    await expect(cancel).toContainText('ביטול המועד');
    await shot(page, 'drawer-cancel-scope', scheme);
    await scope.locator('[data-scope="series"]').click();
    await expect(cancel, 'the whole series is said on the button').toContainText('ביטול הסדרה');
    await expect(d.locator('[data-cal-cancel-note]')).toContainText('הביטול חל על כל הסדרה.');
    await scope.locator('[data-scope="occurrence"]').click();
    await cancel.click();
    await expect(page.locator(`${P} [data-cal-toast]`)).toContainText('המועד ה׳ 29.10 בוטל');
  });
}

test('SCR-38: a single booking keeps its one-step confirm (no scope choice)', async ({ page }) => {
  test.skip(proj() !== 'desktop', 'desktop timeline');
  await openCal(page, '/calendars/rooms?date=2026-10-29');
  await page.locator(`${P} cal-view-rooms [data-cal-entry][title^="עבודה שקטה"]`).first().click();
  const d = page.locator(`${P} cal-event-drawer`);
  await d.locator('[data-cal-cancel-event]').click();
  await expect(d.locator('[data-cal-cancel-scope]')).toHaveCount(0);
  await expect(d.locator('[data-cal-cancel-event]')).toContainText('כן, לבטל');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`SCR-36: "my bookings" that could not be read says so, with a retry (${scheme})`, async ({ page }) => {
    test.skip(proj() !== 'mobile', 'the resident flow is the phone layout');
    await openCal(page, '/calendars/cal?role=resident', scheme);
    await page.locator(`${R} [data-res-tab="mine"]`).click();
    await expect(page.locator(`${R} [data-res-booking]`).first()).toBeVisible();
    // from now on every demo read fails (the demo reads its data mode on every call; replaceState: no route change)
    await page.evaluate(() => history.replaceState(history.state, '', location.href.replace('role=resident', 'role=resident&data=error')));
    await page.locator(`${R} [data-res-past]`).click();
    const err = page.locator(`${R} [data-res-state="mine-error"]`);
    await expect(err).toBeVisible();
    await expect(err).toContainText('לא הצלחנו לטעון את ההזמנות שלך');
    await expect(page.locator(`${R} [data-res-state="mine-empty"]`), 'never "no bookings" for a read that failed').toHaveCount(0);
    await shot(page, 'resident-mine-error', scheme);
    // the server answers again: the retry reads the list
    await page.evaluate(() => history.replaceState(history.state, '', location.href.replace('&data=error', '')));
    await err.getByRole('button', { name: 'לנסות שוב' }).click();
    await expect(err).toHaveCount(0);
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`SCR-34: home - a displaced room booking reads "displaced", not "approved" (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const now = await pinToday(page);
    await mockP2(page, { now });
    const at = (min: number) => new Date(now + min * 60_000).toISOString();
    const row = (id: string, state: string, from: number) => ({ occurrence_id: id, event_id: id, calendar_id: 'room-club', room_calendar_ids: ['room-club'], start: at(from), end: at(from + 120),
      state, kind: 'booking', title: 'הזמנה', organizer: { id: 'x', name: 'נועה' }, revision: 1, all_day: false });
    await page.route('**/api/v1/me/calendar?**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ occurrences: [row('b1', 'displaced', 26 * 60), row('b2', 'confirmed', 50 * 60)], pending: [] }) }));
    await page.goto('/#/home/calendar/book');
    const home = page.locator('sw-home');
    await home.waitFor();
    const states = home.locator('[data-bk-state]');
    await expect(states).toHaveCount(2);
    await expect(home.locator('[data-bk-state="displaced"]')).toContainText('נדחקה בגלל תחזוקה');
    await expect(home.locator('[data-bk-state="displaced"]')).toHaveAttribute('data-tone', 'danger');
    await expect(home.locator('[data-bk-state="confirmed"]')).toContainText('מאושר');
    await shot(page, 'home-my-bookings', scheme);
  });
}
