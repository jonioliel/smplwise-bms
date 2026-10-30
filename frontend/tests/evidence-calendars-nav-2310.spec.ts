import { test, expect, type Page } from '@playwright/test';
import { url } from './generator-mocks';
import { installCalendarsMock } from './calendars-mocks';

// CALENDARS-UI-2310: where "יומנים" lives (owner 2026-10-30 night: a setting - the side rail entry by default, a tab of the home area's top
// menu between מבט על and קברניט, or both; answer 25: a tenant with calendars only always gets its own button) and the page's own states,
// against a mocked backend (fake data only).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-calendars-nav-2310.spec.ts

const railEntry = (page: Page) => page.locator(test.info().project.name === 'mobile' ? 'sw-app nav.bottom a[data-nav="calendars"]' : 'sw-app nav.rail a[data-nav="calendars"]');
const homeTab = (page: Page) => page.locator('sw-app').locator('a[href="#/devices/calendars/cal"]').first();
const phone = () => test.info().project.name === 'mobile';

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(url(hash));
  await page.waitForSelector('sw-app calendars-page, sw-app devices-building', { timeout: 30_000 });
  await page.waitForTimeout(400);
}

test.describe('calendars placement and module states', () => {
  test('default placement: the rail entry right after ראשי, no home tab', async ({ page }) => {
    await installCalendarsMock(page);
    await open(page, '/devices/building');
    await expect(railEntry(page)).toBeVisible();
    const order = await page.locator(phone() ? 'sw-app nav.bottom a[data-nav]' : 'sw-app nav.rail a[data-nav]').evaluateAll((els) => els.map((e) => e.getAttribute('data-nav')));
    expect(order.indexOf('calendars')).toBe(order.indexOf('devices') + 1);
    await expect(homeTab(page)).toHaveCount(0);
    await railEntry(page).click();
    await expect(page).toHaveURL(/#\/calendars\/cal/);
    // a phone viewer without a managing right gets the resident flow instead of the view tabs
    await expect(page.locator(phone() ? 'sw-app calendars-page cal-resident' : 'sw-app calendars-page [data-cal-tab="cal"]')).toBeVisible();
  });

  test('home_tab: the tab of the home area, no rail entry', async ({ page }) => {
    await installCalendarsMock(page, { placement: 'home_tab' });
    await open(page, '/devices/building');
    await expect(railEntry(page)).toHaveCount(0);
    await expect(homeTab(page)).toBeVisible();
    await homeTab(page).click();
    await expect(page).toHaveURL(/#\/devices\/calendars\/cal/);
    if (!phone()) await expect(page.locator('sw-app calendars-page [data-cal-tab="cal"]')).toHaveAttribute('href', /#\/devices\/calendars\/cal/);
  });

  test('both: the rail entry and the home tab', async ({ page }) => {
    await installCalendarsMock(page, { placement: 'both' });
    await open(page, '/devices/building');
    await expect(railEntry(page)).toBeVisible();
    await expect(homeTab(page)).toBeVisible();
  });

  test('answer 25: a tenant with calendars only gets the rail entry even with home_tab', async ({ page }) => {
    await installCalendarsMock(page, { placement: 'home_tab', perms: ['calendar.view', 'calendar.book'] });
    await open(page, '/calendars/cal');
    await expect(railEntry(page)).toBeVisible();
  });

  test('module off: no entry anywhere; the address says so', async ({ page }) => {
    await installCalendarsMock(page, { enabled: false, can: { configure: true } });
    await open(page, '/calendars/cal');
    await expect(railEntry(page)).toHaveCount(0);
    await expect(page.locator('sw-app calendars-page [data-cal-state="off"]')).toBeVisible();
  });

  test('no calendar.view: the page is not available', async ({ page }) => {
    await installCalendarsMock(page, { can: { view: false, book: false } });
    await open(page, '/calendars/cal');
    await expect(page.locator('sw-app calendars-page [data-cal-state="forbidden"]')).toBeVisible();
  });
});

test.describe('calendars page states (demo)', () => {
  for (const [data, state] of [['error', 'error'], ['empty', 'empty'], ['slow', 'loading']] as const) {
    test(`data=${data} shows the ${state} state without a page scroll`, async ({ page }) => {
      await page.goto('about:blank');
      await page.goto(url(`/calendars/cal?data=${data}`));
      await expect(page.locator(`sw-app calendars-page [data-cal-state="${state}"]`)).toBeVisible({ timeout: 20_000 });
      const scroll = await page.evaluate(() => document.querySelector('sw-app')?.shadowRoot?.querySelector('main')?.scrollHeight ?? 0);
      const client = await page.evaluate(() => document.querySelector('sw-app')?.shadowRoot?.querySelector('main')?.clientHeight ?? 0);
      expect(scroll).toBeLessThanOrEqual(client + 1);
    });
  }
});
