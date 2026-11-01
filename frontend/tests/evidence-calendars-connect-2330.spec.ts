import { test, expect, type Page } from '@playwright/test';
import { url } from './generator-mocks';

// CALCONNECT-2330: the connect flow of הגדרות › חיבורי יומן end to end in demo mode (src/calendars/demo.ts: invented data, no network, no
// provider page is opened): Google from nothing (the owner's client, the consent link, the pasted loopback address), Microsoft's
// re-authorisation with a device code, an iCal subscription (a refused address, then a good one), binding a provider calendar to an Arx
// calendar, and the outgoing feeds (the address shown once). Every step: no page scroll, nothing wider than the window.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-calendars-connect-2330.spec.ts --workers=1
const CLOCK = new Date('2026-10-29T10:40:00+02:00');
const Y = 'sw-app system-calendar-sync';
const D = `${Y} cal-connect-dialog`;
const phone = () => test.info().project.name === 'mobile';

async function open(page: Page, hash: string, scheme: 'light' | 'dark' = 'light') {
  await page.clock.setFixedTime(CLOCK);
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  await expect(page.locator(`${Y} [data-sync-screen]`)).toBeVisible();
}

async function fits(page: Page) {
  await page.waitForTimeout(200);
  const m = await page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    return { sh: main?.scrollHeight ?? 0, ch: main?.clientHeight ?? 0, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  });
  expect(m.sh, 'page scroll').toBeLessThanOrEqual(m.ch + 1);
  expect(m.sw, 'sideways overflow').toBeLessThanOrEqual(m.cw + 1);
}

/** The phone shows one provider at a time: pick its tab first. */
async function card(page: Page, p: 'ical' | 'google' | 'microsoft') {
  if (phone()) await page.locator(`${Y} [data-provider-tab="${p}"]`).click();
  const c = page.locator(`${Y} [data-provider="${p}"]`);
  await expect(c).toBeVisible();
  return c;
}

test.describe('calendar connect flow (CALCONNECT-2330)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`Google from nothing: client, consent, pasted address ${scheme}`, async ({ page }) => {
      await open(page, '/system/calendar-sync?data=empty', scheme);
      const g = await card(page, 'google');
      await g.locator('[data-connect]').click();
      await expect(page.locator(`${D} [data-connect-step="client"]`)).toBeVisible();
      await fits(page);
      const save = page.locator(`${D} [data-connect-save]`);
      await page.locator(`${D} [data-client-id]`).fill('not-a-client');
      await expect(page.locator(`${D} [data-client-hint]`)).toBeVisible();
      await expect(save).toBeDisabled();
      await page.locator(`${D} [data-client-id]`).fill('1234567890-democlient.apps.googleusercontent.com');
      await expect(save).toBeDisabled(); // Google needs its client secret too
      await page.locator(`${D} [data-client-secret]`).fill('demo-secret');
      await save.click();
      await expect(page.locator(`${D} [data-connect-step="paste"]`)).toBeVisible();
      await expect(page.locator(`${D} [data-open-consent]`)).toHaveAttribute('target', '_blank');
      await expect(page.locator(`${D} [data-open-consent]`)).toHaveAttribute('rel', /noopener/);
      const finish = page.locator(`${D} [data-connect-finish]`);
      await page.locator(`${D} [data-paste]`).fill('https://evil.example/?state=x&code=y');
      await expect(finish).toBeDisabled();
      await page.locator(`${D} [data-paste]`).fill('http://127.0.0.1:8749/?state=demo&code=4/demo&scope=x');
      await fits(page);
      await finish.click();
      await expect(page.locator(`${Y} [data-sync-toast]`)).toContainText('Google חובר');
      await expect(page.locator(`${Y} [data-provider="google"]`)).toHaveAttribute('data-conn-state', 'ok');
      await expect(page.locator(`${Y} [data-provider="google"] [data-bind]`)).toBeVisible();
      await fits(page);
    });
  }

  test('Microsoft re-authorisation with a device code', async ({ page }) => {
    await open(page, '/system/calendar-sync');
    const ms = await card(page, 'microsoft');
    await ms.locator('[data-reauth]').click();
    await expect(page.locator(`${D} [data-connect-step="device"]`)).toBeVisible();
    await expect(page.locator(`${D} [data-user-code]`)).toHaveText('DEMO1234');
    await fits(page);
    await expect(page.locator(`${Y} [data-sync-toast]`)).toContainText('Microsoft חובר', { timeout: 10_000 });
    await expect(page.locator(`${Y} [data-provider="microsoft"]`)).toHaveAttribute('data-conn-state', 'ok');
  });

  test('iCal subscription: a refused address, then a good one', async ({ page }) => {
    await open(page, '/system/calendar-sync?data=empty');
    const ical = await card(page, 'ical');
    await ical.locator('[data-connect]').click();
    await expect(page.locator(`${D} [data-connect-step="feed"]`)).toBeVisible();
    await page.locator(`${D} [data-feed-url]`).fill('http://192.0.2.10/cal.ics');
    await page.locator(`${D} [data-connect-save]`).click();
    await expect(page.locator(`${D} [data-connect-error]`)).toContainText('https');
    await page.locator(`${D} [data-feed-url]`).fill('webcal://calendar.example.org/holidays/basic.ics');
    await page.locator(`${D} [data-connect-save]`).click();
    await expect(page.locator(`${Y} [data-sync-toast]`)).toContainText('iCal');
    await expect(page.locator(`${Y} [data-provider="ical"]`)).toHaveAttribute('data-conn-state', 'ok');
    await fits(page);
  });

  test('binding a provider calendar to an Arx calendar', async ({ page }) => {
    await open(page, '/system/calendar-sync');
    const g = await card(page, 'google');
    await g.locator('[data-bind]').click();
    await expect(page.locator(`${D} [data-bind-dialog]`)).toBeVisible();
    await expect(page.locator(`${D} [data-bind-ext] option`)).toHaveCount(3);
    await page.locator(`${D} [data-bind-ext]`).selectOption('rooms');
    await page.locator(`${D} [data-bind-cal]`).selectOption('brosh');
    await page.locator(`${D} [data-dir="two_way"]`).click();
    await expect(page.locator(`${D} [data-two-way-note]`)).toBeVisible();
    await page.locator(`${D} [data-bind-ext]`).selectOption('holidays');
    await expect(page.locator(`${D} [data-bind-readonly]`)).toBeVisible();
    await expect(page.locator(`${D} [data-bind-save]`)).toBeDisabled();
    await page.locator(`${D} [data-bind-ext]`).selectOption('rooms');
    await fits(page);
    await page.locator(`${D} [data-bind-save]`).click();
    await expect(page.locator(`${Y} [data-sync-toast]`)).toContainText('השיוך נשמר');
  });

  test('outgoing feeds: the address is shown once', async ({ page }) => {
    test.skip(phone(), 'feeds are managed on the tablet and the desktop');
    await open(page, '/system/calendar-sync');
    if (test.info().project.name === 'desktop') await page.locator(`${Y} [data-provider="ical"] [data-feeds]`).click();
    else { // the narrower card keeps its short row; "חיבור חדש" offers the feeds
      await page.locator(`${Y} [data-sync-new]`).click();
      await page.locator(`${Y} [data-new-feeds]`).click();
    }
    await expect(page.locator(`${D} [data-feeds-dialog]`)).toBeVisible();
    await expect(page.locator(`${D} [data-feed]`)).toHaveCount(1);
    await page.locator(`${D} [data-feed-cal="brosh"]`).check();
    await page.locator(`${D} [data-feed-detail="titles"]`).click();
    await page.locator(`${D} [data-feed-create]`).click();
    await expect(page.locator(`${D} [data-feed-url-once]`)).toContainText('/api/v1/calendar/feed/');
    await expect(page.locator(`${D} [data-feed]`)).toHaveCount(2);
    await page.locator(`${D} [data-feed] [data-feed-revoke]`).first().click();
    await expect(page.locator(`${D} [data-feed]`)).toHaveCount(1);
    await fits(page);
  });
});
