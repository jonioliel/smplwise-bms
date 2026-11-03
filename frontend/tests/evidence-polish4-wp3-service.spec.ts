import { test, expect, type Page } from '@playwright/test';
import { installTicketsMock, url } from './tickets-mocks';
import { installS4Mock } from './tickets-s4-mocks';
import { settle } from './helpers/settle';

// POLISH ROUND 4, WP3 (service area): the ticket full screen waits on a skeleton and fails into the shared panel with "try again" (D3);
// the handlers page stands on the request list's toolbar (D4): the departments behind the "סינון" panel with an active chip, the keys
// 44 px on a phone, one row for the search / filter / new. The REAL build against the mock layer (fake data).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-polish4-wp3-service.spec.ts --project=desktop --project=mobile --workers=1
const NAME = { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' };
const D = 'sw-app tickets-detail';
const H = 'sw-app tickets-handlers';
const ID = '0000000000000a01';

interface Control { failing: boolean }

async function open(page: Page, hash: string, o: { slow?: number; fail?: boolean } = {}, scheme: 'light' | 'dark' = 'light'): Promise<Control> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installTicketsMock(page, { persona: 'admin', name: NAME });
  await installS4Mock(page, {});
  const ctl: Control = { failing: !!o.fail };
  // registered last, so it answers the module read first; every other call falls through to the mock layer
  await page.route('**/api/v1/tickets/module*', async (route) => {
    if (o.slow) await new Promise((r) => setTimeout(r, o.slow));
    if (ctl.failing) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'internal', user_message: 'שגיאה בשרת', retryable: true, correlation_id: 'mock', details: {} }) });
    }
    return route.fallback();
  });
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  return ctl;
}

test.describe('WP3 service: ticket full screen states (D3)', () => {
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(120_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the module answers late: a skeleton of the page, then the ticket', async ({ page }) => {
    await open(page, `/tickets/${ID}`, { slow: 1800 });
    const sk = page.locator(`${D} [data-tickets-state="loading"]`);
    await expect(sk).toBeVisible();
    await expect(sk).toHaveAttribute('aria-busy', 'true');
    expect(await sk.locator('sw-skeleton').count()).toBeGreaterThanOrEqual(4);
    await expect(page.locator(`${D} ticket-detail [data-ticket-page]`)).toBeVisible({ timeout: 15_000 });
    await expect(sk).toHaveCount(0);
  });

  test('the module fails: the shared panel with "try again", and the retry repeats the read', async ({ page }) => {
    const ctl = await open(page, `/tickets/${ID}`, { fail: true });
    const panel = page.locator(`${D} sw-state-panel[data-tickets-state="error"]`);
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel.locator('sw-button')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'no sideways scroll').toBeLessThanOrEqual(1);
    ctl.failing = false;
    await panel.locator('sw-button').click();
    await expect(page.locator(`${D} ticket-detail [data-ticket-page]`)).toBeVisible({ timeout: 15_000 });
    await expect(panel).toHaveCount(0);
  });
});

test.describe('WP3 service: handlers on the list toolbar (D4)', () => {
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(120_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`the department filter is the list's panel, with its active chip (${scheme})`, async ({ page }, info) => {
      await open(page, '/tickets/handlers', {}, scheme);
      await page.waitForSelector(`${H} tickets-handlers-members [data-member="user:u-ronit"]`);
      const vw = page.viewportSize()!.width;
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'no sideways scroll').toBeLessThanOrEqual(1);
      // the departments are not a row of chips any more: they wait behind the filter key
      await expect(page.locator(`${H} [data-handlers-dept]`)).toHaveCount(0);
      const toggle = page.locator(`${H} [data-filter-toggle]`);
      await toggle.click();
      const panel = page.locator(`${H} [data-filter-panel]`);
      await expect(panel).toBeVisible();
      // the panel may open with a transition: measure it at rest
      await settle(page);
      const pb = (await panel.boundingBox())!;
      expect(pb.x, 'the panel stays inside the screen').toBeGreaterThanOrEqual(-1);
      expect(pb.x + pb.width, 'the panel stays inside the screen').toBeLessThanOrEqual(vw + 1);
      await page.locator(`${H} [data-handlers-dept="dept-cleaning"]`).click();
      await expect(page.locator(`${H} [data-active-chip="department"]`)).toBeVisible();
      await expect(page.locator(`${H} tickets-handlers-members [data-member="user:u-ronit"]`)).toHaveCount(0);
      // Escape closes the panel and returns the focus to the key; the chip stays and removes the filter
      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
      await page.locator(`${H} [data-active-chip="department"]`).click();
      await expect(page.locator(`${H} [data-active-chip]`)).toHaveCount(0);
      await expect(page.locator(`${H} tickets-handlers-members [data-member="user:u-ronit"]`)).toBeVisible();
      if (info.project.name === 'mobile') {
        // one row of 44 px keys: the search, the filter and the "new" plus; the segments on the row above (measured at rest)
        await settle(page);
        const search = (await page.locator(`${H} .search`).boundingBox())!;
        const filter = (await toggle.boundingBox())!;
        const add = (await page.locator(`${H} [data-handlers-new]`).boundingBox())!;
        expect(Math.abs(search.y - filter.y), 'search and filter share a row').toBeLessThanOrEqual(4);
        expect(Math.abs(search.y - add.y), 'search and new share a row').toBeLessThanOrEqual(4);
        for (const [name, b] of [['search', search], ['filter', filter], ['new', add]] as const) expect(b.height, name).toBeGreaterThanOrEqual(43.5);
        expect(add.width, 'new').toBeGreaterThanOrEqual(43.5);
        expect(add.x + add.width, 'new stays on screen').toBeLessThanOrEqual(vw + 1);
        expect(add.x, 'new stays on screen').toBeGreaterThanOrEqual(-1);
      }
    });
  }
});
