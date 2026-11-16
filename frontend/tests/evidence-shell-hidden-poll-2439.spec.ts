import { test, expect, type Page } from '@playwright/test';
import { installBubbleMock } from './bubble-mocks';
import { BV1_PERMS } from './bv1-mocks';

// CR-SHELL-TIMERS-2439 (review 07:F14): the shell's 60 s system-status poll (GET /health/summary, with the alert counts) no longer requests
// in a hidden tab; it reads once when the page comes back and then keeps its 60 s period. The mock layer answers; nothing real is called.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-shell-hidden-poll-2439.spec.ts --project=desktop
const NOW = '2026-11-14T09:00:00Z';

const hide = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
const show = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('pageshow'));
  });

test('no system-status request leaves while the page is hidden; one on return; then every 60 s again', async ({ page }) => {
  let reads = 0;
  await installBubbleMock(page, { perms: [...BV1_PERMS, 'devices.read'] });
  await page.route('**/api/v1/health/summary', (route) => {
    reads++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', items: [] }) });
  });
  await page.clock.install({ time: new Date(NOW) });
  await page.goto('about:blank');
  await page.goto('/?design=a&skin=classic#/devices/building');
  await expect(page.locator('sw-app')).toHaveCount(1);
  await expect.poll(() => reads, { timeout: 15_000 }).toBeGreaterThanOrEqual(1); // the first read at session start

  // visible: the poll runs every 60 s
  const start = reads;
  await page.clock.runFor(61_000);
  await expect.poll(() => reads).toBe(start + 1);

  // hidden: ten minutes, not one request
  await hide(page);
  const hidden = reads;
  await page.clock.runFor(10 * 60_000);
  await page.waitForTimeout(300);
  expect(reads).toBe(hidden);

  // back: one read (visibilitychange + focus + pageshow together are one), then the 60 s period again
  await show(page);
  await page.clock.runFor(1_000);
  await expect.poll(() => reads).toBe(hidden + 1);
  await page.clock.runFor(30_000);
  expect(reads).toBe(hidden + 1);
  await page.clock.runFor(31_000);
  await expect.poll(() => reads).toBe(hidden + 2);
});
