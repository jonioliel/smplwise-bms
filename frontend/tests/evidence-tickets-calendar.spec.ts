import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url, type TicketsMock, type TicketsMockOptions } from './tickets-mocks';

// TKCAL evidence: the weekly calendar ('יומן שבועי') of the request list from the REAL build against the mock layer (fake data). The mock
// clock is Tue 13.10.2026 (the browser clock is fixed to it, the zone is Asia/Jerusalem). Covers: the Sunday-first week in RTL, the events
// (visit time and SLA targets) with the status sentence and the running clock, the tones from the existing states, "today" and week
// navigation (buttons, keyboard), a click opening the request drawer, the filters shared with the list (department, scope, handler),
// the loading / empty / error states, the phone's day list (strip, arrows, swipe) with 44 px targets. Screenshots in
// docs/design/evidence/tickets-calendar/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-calendar.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-calendar');
const L = 'sw-app tickets-list';
const C = `${L} tickets-calendar`;
const NOW = '2026-10-13T10:42:00Z';
const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 768;

test.use({ timezoneId: 'Asia/Jerusalem', locale: 'he-IL' });

async function goCal(page: Page, o: TicketsMockOptions = {}, scheme: 'light' | 'dark' = 'light', skin = 'classic', hash = '/tickets/mine'): Promise<TicketsMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const mock = await installTicketsMock(page, { schedule: true, ...o });
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript(() => { try { sessionStorage.setItem('sw.tickets.list.calendar', '1'); } catch { /* about:blank has no storage */ } });
  await page.goto('about:blank');
  await page.goto(url(hash, skin, scheme));
  return mock;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`) });
}

test.describe('tickets weekly calendar evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the switch offers the calendar; picking it shows the week, picking cards returns', async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installTicketsMock(page, { schedule: true });
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto('about:blank');
    await page.goto(url('/tickets/mine'));
    await page.waitForSelector(`${L} ticket-card`);
    const btn = page.locator(`${L} [data-view-switch] [data-view="calendar"]`);
    await expect(btn).toHaveAttribute('aria-label', 'יומן שבועי');
    await btn.click();
    await page.waitForSelector(`${C} [data-cal]`);
    await expect(btn).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator(`${L} ticket-card`)).toHaveCount(0);
    await page.locator(`${L} [data-view-switch] [data-view="cards"]`).click();
    await page.waitForSelector(`${L} ticket-card`);
    await expect(page.locator(C)).toHaveCount(0);
  });

  test('the week: Sunday first in RTL, the events of the mock, today marked, the sentence and the clock on every event', async ({ page }) => {
    test.skip(isPhone(page), 'the week grid is the wide layout');
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await goCal(page, {}, scheme, skin);
        await page.waitForSelector(`${C} [data-cal-week]`);
        await shot(page, 'week', scheme, skin);
      }
    await goCal(page);
    await page.waitForSelector(`${C} [data-cal-week]`);
    const days = page.locator(`${C} [data-cal-day]`);
    await expect(days).toHaveCount(7);
    await expect(days.first()).toHaveAttribute('data-cal-day', '2026-10-11');
    await expect(days.last()).toHaveAttribute('data-cal-day', '2026-10-17');
    const first = await days.first().boundingBox();
    const last = await days.last().boundingBox();
    expect(first!.x, 'RTL: Sunday is the rightmost column').toBeGreaterThan(last!.x);
    await expect(page.locator(`${C} [data-cal-range]`)).toHaveText('11–17 אוקטובר');
    await expect(page.locator(`${C} [data-cal-count]`)).toHaveText('10 אירועים בשבוע');
    await expect(page.locator(`${C} [data-cal-day="2026-10-13"]`)).toHaveClass(/today/);
    await expect(page.locator(`${C} [data-cal-day="2026-10-13"]`)).toHaveAttribute('aria-current', 'date');
    await expect(page.locator(`${C} [data-cal-unscheduled]`)).toContainText('ללא מועד');
    const ev = page.locator(`${C} [data-cal-event]`);
    expect(await ev.count()).toBe(10);
    for (let i = 0; i < 10; i++) {
      await expect(ev.nth(i).locator('[data-cal-sentence]'), `event ${i}: the status sentence`).not.toHaveText('');
      await expect(ev.nth(i).locator('ticket-elapsed'), `event ${i}: the running clock`).toHaveCount(1);
      await expect(ev.nth(i).locator('time')).toHaveText(/^\d\d:\d\d$/);
    }
    // the visit of 1042 is Wed 14.10 16:42 local (the mock's ETA, now + 27 h = 13:42 UTC; Asia/Jerusalem is UTC+3 until 25.10)
    const wed = page.locator(`${C} [data-cal-day="2026-10-14"] [data-cal-event="visit"]`);
    await expect(wed).toHaveCount(1);
    await expect(wed.locator('time')).toHaveText('16:42');
    // tones come from the existing states: visits info, a crossed target bad, a target under 24 h warn
    await expect(page.locator(`${C} [data-cal-event="visit"]`).first()).toHaveAttribute('data-cal-tone', 'info');
    await expect(page.locator(`${C} [data-cal-day="2026-10-13"] [data-cal-event="resolve"]`)).toHaveAttribute('data-cal-tone', 'bad');
    await expect(page.locator(`${C} [data-cal-day="2026-10-13"] [data-cal-event="ack"]`)).toHaveAttribute('data-cal-tone', 'warn');
    expect(await page.locator(`${C} [data-cal-tone="quiet"]`).count()).toBeGreaterThan(0);
    await expect(page.locator(`${C} [data-cal-legend] li`)).toHaveCount(4);
  });

  test('navigation: next / previous week, the today jump, the keyboard; an empty week offers the nearest one', async ({ page }) => {
    test.skip(isPhone(page), 'the week grid is the wide layout');
    await goCal(page);
    await page.waitForSelector(`${C} [data-cal-week]`);
    await page.locator(`${C} [data-cal-next]`).click();
    await expect(page.locator(`${C} [data-cal-range]`)).toHaveText('18–24 אוקטובר');
    await expect(page.locator(`${C} [data-cal-state="empty"]`)).toBeVisible();
    await expect(page.locator(`${C} [data-cal-count]`)).toHaveText('אין אירועים בשבוע זה');
    await expect(page.locator(`${C} [data-cal-nearest]`)).toHaveCount(0); // nothing later: nothing offered
    await shot(page, 'week-empty');
    await page.locator(`${C} [data-cal-today]`).click();
    await expect(page.locator(`${C} [data-cal-range]`)).toHaveText('11–17 אוקטובר');
    await page.locator(`${C} [data-cal-prev]`).click();
    await expect(page.locator(`${C} [data-cal-range]`)).toHaveText('4–10 אוקטובר');
    await expect(page.locator(`${C} [data-cal-nearest]`)).toBeVisible(); // the earlier week is empty, the events are ahead
    await page.locator(`${C} [data-cal-nearest]`).click();
    await expect(page.locator(`${C} [data-cal-range]`)).toHaveText('11–17 אוקטובר');
    // keyboard: in RTL ArrowLeft is "next", ArrowRight "previous", Home is today
    await page.locator(`${C} [data-cal-next]`).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator(`${C} [data-cal-range]`)).toHaveText('18–24 אוקטובר');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator(`${C} [data-cal-range]`)).toHaveText('4–10 אוקטובר');
    await page.keyboard.press('Home');
    await expect(page.locator(`${C} [data-cal-range]`)).toHaveText('11–17 אוקטובר');
    // every control is reachable by Tab and shows a focus ring
    await page.locator(`${C} [data-cal-prev]`).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator(`${C} [data-cal-next]`)).toBeFocused();
  });

  test('an event is a link: Enter and a click open the request drawer; the calendar stays', async ({ page }) => {
    test.skip(isPhone(page), 'desktop');
    await goCal(page);
    await page.waitForSelector(`${C} [data-cal-week]`);
    const ev = page.locator(`${C} [data-cal-day="2026-10-14"] [data-cal-event="visit"]`);
    await ev.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/[?&]t=0000000000000a01/);
    await expect(page.locator('sw-app tickets-list ticket-detail[mode="drawer"] [data-ticket-detail]')).toBeVisible(); // (the host has no box)
    await expect(ev).toHaveAttribute('aria-current', 'true');
    await expect(page.locator(`${C} [data-cal]`)).toBeVisible();
    await shot(page, 'drawer-open');
  });

  test('the filters of the list apply: department chip, scope, state and the card filters (handler) narrow the calendar', async ({ page }) => {
    test.skip(isPhone(page), 'desktop');
    await goCal(page);
    await page.waitForSelector(`${C} [data-cal-week]`);
    const all = await page.locator(`${C} [data-cal-event]`).count();
    await page.locator(`${L} [data-dept="dept-cleaning"]`).click();
    await expect(page.locator(`${C} [data-cal-event]`)).not.toHaveCount(all);
    const cleaning = await page.locator(`${C} [data-cal-event]`).count();
    expect(cleaning).toBeLessThan(all);
    await page.locator(`${L} [data-dept=""]`).click();
    await expect(page.locator(`${C} [data-cal-event]`)).toHaveCount(all);
    // the filter row is offered in the calendar mode and narrows by handler
    await page.locator(`${L} [data-filter-toggle]`).click();
    await page.locator(`${L} [data-f-handler]`).selectOption({ index: 2 });
    expect(await page.locator(`${C} [data-cal-event]`).count()).toBeLessThan(all);
    await page.locator(`${L} [data-f-clear]`).click();
    await expect(page.locator(`${C} [data-cal-event]`)).toHaveCount(all);
    // the scope segment keeps the mode
    await page.locator(`${L} [data-scope-seg] [data-scope="department"]`).click();
    await expect(page).toHaveURL(/#\/tickets\/department/);
    await page.waitForSelector(`${C} [data-cal-week]`);
    await expect(page.locator(`${L} [data-view-switch] [data-view="calendar"]`)).toHaveAttribute('aria-checked', 'true');
  });

  test('states: loading shows the skeleton, an empty list and a failed list keep their messages', async ({ page }) => {
    await goCal(page);
    await page.waitForSelector(`${C} [data-cal-week], ${C} [data-cal-day]`);
    // loading: the list answer is held back for a moment
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installTicketsMock(page, { schedule: true });
    await page.route('**/api/v1/tickets?*', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.fallback();
    });
    await page.goto('about:blank');
    await page.goto(url('/tickets/mine'));
    await page.waitForSelector(`${L} [data-cal-loading]`);
    await expect(page.locator(`${L} [data-cal-loading]`)).toHaveAttribute('aria-busy', 'true');
    await shot(page, 'loading');
    await page.waitForSelector(`${C} [data-cal]`);
    await goCal(page, { empty: true });
    await page.waitForSelector(`${L} [data-tickets-state="empty"]`);
    await shot(page, 'empty-list');
    await goCal(page, { failList: true });
    await page.waitForSelector(`${L} [data-tickets-state="error"]`);
    await expect(page.locator(`${L} [data-retry]`)).toBeVisible();
    await shot(page, 'error');
  });

  test('the phone: one day at a time - the day strip, arrows, the today jump, a sideways swipe; 44 px targets', async ({ page }) => {
    test.skip(!isPhone(page), 'phone only');
    await goCal(page);
    await page.waitForSelector(`${C} [data-cal-strip]`);
    await expect(page.locator(`${C} [data-cal]`)).toHaveAttribute('data-cal-mode', 'day');
    await expect(page.locator(`${C} [data-cal-pick]`)).toHaveCount(7);
    await expect(page.locator(`${C} [data-cal-pick="2026-10-13"]`)).toHaveAttribute('aria-pressed', 'true'); // today
    await expect(page.locator(`${C} [data-cal-day="2026-10-13"] [data-cal-event]`)).toHaveCount(4);
    await shot(page, 'day');
    for (const sel of [`${C} [data-cal-prev]`, `${C} [data-cal-next]`, `${C} [data-cal-today]`, `${C} [data-cal-pick="2026-10-11"]`, `${C} [data-cal-event]`]) {
      const box = await page.locator(sel).first().boundingBox();
      expect(box?.height ?? 0, sel).toBeGreaterThanOrEqual(43.5);
      expect(box?.width ?? 0, sel).toBeGreaterThanOrEqual(43.5);
    }
    await page.locator(`${C} [data-cal-next]`).click();
    await expect(page.locator(`${C} [data-cal-pick="2026-10-14"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${C} [data-cal-day="2026-10-14"] [data-cal-event]`)).toHaveCount(2);
    // a swipe: dragging the content to the right is "next" in a right-to-left page
    const swipe = (dx: number) => page.locator(`${C} .daybox`).evaluate((el, d) => {
      const mk = (type: string, x: number) => new TouchEvent(type, { bubbles: true, composed: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 })], changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 })] });
      el.dispatchEvent(mk('touchstart', 150));
      el.dispatchEvent(mk('touchend', 150 + d));
    }, dx);
    await swipe(90);
    await expect(page.locator(`${C} [data-cal-pick="2026-10-15"]`)).toHaveAttribute('aria-pressed', 'true');
    await swipe(-90);
    await swipe(-90);
    await expect(page.locator(`${C} [data-cal-pick="2026-10-13"]`)).toHaveAttribute('aria-pressed', 'true');
    await swipe(20); // too short: nothing
    await expect(page.locator(`${C} [data-cal-pick="2026-10-13"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.locator(`${C} [data-cal-pick="2026-10-12"]`).click();
    await expect(page.locator(`${C} [data-cal-day="2026-10-12"] [data-cal-day-empty]`)).toBeVisible();
    await page.locator(`${C} [data-cal-today]`).click();
    await expect(page.locator(`${C} [data-cal-pick="2026-10-13"]`)).toHaveAttribute('aria-pressed', 'true');
    for (const scheme of ['light', 'dark'] as const) {
      await goCal(page, {}, scheme, 'domus');
      await page.waitForSelector(`${C} [data-cal-strip]`);
      await shot(page, 'day', scheme, 'domus');
    }
  });
});
