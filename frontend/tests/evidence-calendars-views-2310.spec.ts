import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { url } from './generator-mocks';

// CALENDARS-UI-2310 slice A: יומנים › יומן (month / week / day + the calendar switcher), חדרים לפי שעות (the rooms timeline) and the new /
// existing booking drawer in the three permission variants, in demo mode (src/calendars/demo.ts: invented data; data=worst is the break-ui
// worst case, data=empty no calendar), at desktop / tablet / phone, light and dark, Hebrew RTL. Every screen: no page scroll, no sideways
// overflow. Screenshots go to the owner's review folder (private, local).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-calendars-views-2310.spec.ts --workers=2

const SHOTS = process.env.SW_CAL_SHOTS || 'C:/cloude/smplwisebms/private/design-system-2026-10-27/round9/calendars-ui/shots';
const FIXED = new Date('2026-10-29T08:40:00Z'); // Thursday 29.10.2026, 10:40 in the installation's zone (the mock-up's "now")
const P = 'sw-app calendars-page';
const proj = () => test.info().project.name;
const phone = () => proj() === 'mobile';

async function open(page: Page, hash: string, scheme: 'light' | 'dark' = 'light') {
  await page.clock.setFixedTime(FIXED);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  await page.waitForSelector(`${P} [data-cal-body]`, { timeout: 30_000 });
}

async function noScroll(page: Page) {
  const m = await page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    return { sh: main?.scrollHeight ?? 0, ch: main?.clientHeight ?? 0, dw: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  expect(m.sh, 'the page scrolls').toBeLessThanOrEqual(m.ch + 1);
  expect(m.dw, 'sideways overflow').toBeLessThanOrEqual(1);
}

async function shot(page: Page, name: string, scheme: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(SHOTS, `${name}-${proj()}-${scheme}.png`) });
}

test.describe('calendars views (slice A)', () => {
  test.describe.configure({ timeout: 120_000 });
  for (const scheme of ['light', 'dark'] as const) {
    test(`month view and the switcher (${scheme})`, async ({ page }) => {
      await open(page, '/calendars/cal?view=month&date=2026-10-29', scheme);
      const v = page.locator(`${P} cal-view-calendar`);
      await expect(v.locator('[data-cal-title]')).toHaveText('אוקטובר 2026');
      await expect(v.locator('.mcell')).toHaveCount(42);
      await expect(v.locator('.mcell.today')).toHaveCount(1);
      if (phone()) {
        await expect(v.locator('[data-cal-agenda]')).toBeVisible();
        await expect(v.locator('[data-cal-switcher]')).toHaveCount(0);
        await v.locator('[data-cal-switcher-open]').click();
        await expect(v.locator('[data-cal-switcher].overlay')).toBeVisible();
        await shot(page, 'cal-switcher', scheme);
        await v.locator('[data-cal-switcher-close]').click();
      } else if (proj() === 'tablet') {
        // owner answer 23A (default): the switcher hides on the tablet and opens on tap
        await expect(v.locator('[data-cal-switcher]')).toHaveCount(0);
        await v.locator('[data-cal-switcher-open]').click();
        await expect(v.locator('[data-cal-switcher].overlay')).toBeVisible();
        await v.locator('[data-cal-switcher-close]').click();
      } else {
        await expect(v.locator('[data-cal-switcher] [data-cal-toggle]')).toHaveCount(14);
        await expect(v.locator('[data-cal-switcher] .lock').first()).toBeVisible();
      }
      await noScroll(page);
      await shot(page, 'cal-month', scheme);
    });

    test(`week view: hour band, now line, the sync conflict side by side (${scheme})`, async ({ page }) => {
      await open(page, '/calendars/cal?view=week&date=2026-10-29', scheme);
      const v = page.locator(`${P} cal-view-calendar`);
      await expect(v.locator('[data-cal-week] .col')).toHaveCount(phone() ? 3 : 7);
      await expect(v.locator('.now')).toHaveCount(1);
      if (!phone()) await expect(v.locator('.ev[data-flag="conflict"]')).toHaveCount(2); // 26.10: "ראיון" and "שיחת לקוח", both kept
      await noScroll(page);
      await shot(page, 'cal-week', scheme);
    });

    test(`day view: a column per calendar, paged (${scheme})`, async ({ page }) => {
      await open(page, '/calendars/cal?view=day&date=2026-10-29', scheme);
      const v = page.locator(`${P} cal-view-calendar`);
      await expect(v.locator('[data-cal-title]')).toContainText('חמישי');
      await expect(v.locator('[data-cal-week] .col')).toHaveCount(phone() ? 2 : proj() === 'tablet' ? 4 : 6);
      await expect(v.locator('[data-cal-pager]')).toBeVisible();
      await noScroll(page);
      await shot(page, 'cal-day', scheme);
    });

    test(`rooms timeline: rows, axis, now, closed hours, legend, find a free room (${scheme})`, async ({ page }) => {
      await open(page, '/calendars/rooms?date=2026-10-29', scheme);
      const v = page.locator(`${P} cal-view-rooms`);
      await expect(v.locator('[data-cal-room]').first()).toBeVisible();
      await expect(v.locator('.tl-now').first()).toBeVisible();
      await expect(v.locator('.tl-nowlab')).toHaveText('10:40');
      // the kitchen (maintenance over a displaced booking) is on the first page of rooms at the wider widths; the phone pages fewer rooms
      if (!phone()) await expect(v.locator('.ev[data-mark="displaced"]').first()).toBeAttached();
      else await expect(v.locator('.ev[data-mark="maint"]').first()).toBeAttached();
      if (!phone()) await expect(v.locator('[data-cal-legend]')).toBeVisible();
      await noScroll(page);
      await shot(page, 'rooms', scheme);
      await v.locator('[data-cal-find]').click();
      await expect(v.locator('[data-cal-free]')).toHaveCount(1);
      await shot(page, 'rooms-free', scheme);
      await v.locator('[data-cal-free]').click();
      await expect(page.locator(`${P} cal-event-drawer [data-cal-drawer="new"]`)).toBeVisible();
    });
  }

  for (const role of ['operator', 'site_admin', 'cal_manager'] as const) {
    test(`new booking drawer as ${role}`, async ({ page }) => {
      test.skip(phone() && role === 'operator', 'on the phone a viewer who manages nothing gets the resident flow (evidence-calendars-settings-2310)');
      await open(page, `/calendars/rooms?date=2026-10-29&role=${role}`);
      await page.locator(`${P} [data-cal-new]`).click();
      const d = page.locator(`${P} cal-event-drawer`);
      await expect(d.locator('[data-cal-drawer="new"]')).toBeVisible();
      await expect(d.locator('[data-cal-roleline]')).toBeVisible();
      if (role === 'operator') {
        await expect(d.locator('[data-cal-behalf-locked]')).toBeVisible();
        await expect(d.locator('[data-cal-field="behalf"]')).toHaveCount(0);
      } else {
        await d.locator('[data-cal-field="behalf"]').selectOption('class');
        await d.locator('[data-cal-field="behalf-label"]').fill('חוג קרמיקה');
        if (role === 'site_admin') await expect(d.locator('[data-cal-field="guest-name"]')).toBeVisible();
      }
      await d.locator('[data-cal-field="title"]').fill('ישיבת בדיקה');
      await d.locator('[data-cal-field="repeat"]').selectOption('weekly');
      await expect(d.locator('[data-cal-repeat-summary]')).toContainText('מועדים');
      await expect(d.locator('[data-cal-avail]')).toBeVisible();
      await noScroll(page);
      await shot(page, `drawer-${role}`, 'light');
      await d.locator('[data-cal-submit]').click();
      await expect(page.locator(`${P} [data-cal-toast]`)).toBeVisible();
      await expect(d).toHaveCount(0);
    });
  }

  test('an existing entry opens read-only with cancel', async ({ page }) => {
    await open(page, '/calendars/rooms?date=2026-10-29');
    await page.locator(`${P} cal-view-rooms [data-cal-entry]`).first().click();
    const d = page.locator(`${P} cal-event-drawer [data-cal-drawer="event"]`);
    await expect(d).toBeVisible();
    await expect(d.locator('dl')).toContainText('מצב');
    await shot(page, 'drawer-event', 'light');
    await d.locator('[data-cal-cancel-event]').click();
    await d.locator('[data-cal-cancel-event]').click();
    await expect(page.locator(`${P} [data-cal-toast]`)).toBeVisible();
  });

  test('missing title is refused in place', async ({ page }) => {
    await open(page, '/calendars/cal?view=week&date=2026-10-29');
    await page.locator(`${P} [data-cal-new]`).click();
    const d = page.locator(`${P} cal-event-drawer`);
    await d.locator('[data-cal-submit]').click();
    await expect(d.locator('[data-cal-error]')).toHaveText('חסרה כותרת.');
  });

  for (const view of ['month', 'week', 'day', 'rooms'] as const) {
    test(`worst-case data: ${view}`, async ({ page }) => {
      await open(page, view === 'rooms' ? '/calendars/rooms?data=worst&date=2026-10-29' : `/calendars/cal?data=worst&view=${view}&date=2026-10-29`);
      await page.waitForTimeout(400);
      await noScroll(page);
      // a long name never widens its row
      const over = await page.evaluate(() => {
        const host = document.querySelector('sw-app')?.shadowRoot?.querySelector('calendars-page')?.shadowRoot;
        const v = host?.querySelector('cal-view-calendar, cal-view-rooms')?.shadowRoot;
        return [...(v?.querySelectorAll('.panel') ?? [])].some((p) => p.scrollWidth > p.clientWidth + 1);
      });
      expect(over).toBe(false);
      await shot(page, `worst-${view}`, 'light');
    });
  }

  test('no calendar: the empty state', async ({ page }) => {
    await open(page, '/calendars/rooms?data=empty');
    await expect(page.locator(`${P} [data-cal-state="empty"]`)).toBeVisible();
    await noScroll(page);
  });
});
