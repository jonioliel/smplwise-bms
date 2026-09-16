import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for review windows (design M26) against the running developer backend: the "חלונות" view groups
// the day's adjacent events per camera, a window row opens a drawer with its raw events, "סקירה מלאה" opens
// the event page and the choice of view is remembered. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T0xx-event-detail-live');

test.describe('event windows (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('windows view, drawer with raw events, full review', async ({ page, request }, testInfo) => {
    const api = await (await request.get('/api/v1/events/windows?gap=180')).json();
    expect(api.windows.length, 'windows in the last 24 h').toBeGreaterThan(0);
    expect(api.events_total).toBeGreaterThanOrEqual(api.windows.length);
    const merged = api.windows.find((w: { count: number }) => w.count > 1);

    await open(page, '/investigate/events');
    const centre = page.locator('investigate-events');
    await expect(centre.locator('sw-table')).toBeVisible({ timeout: 15000 });
    await centre.locator('sw-chip[data-mode-windows]').click();
    await expect(centre.locator('sw-table')).toBeVisible({ timeout: 15000 });
    const rows = centre.locator('sw-table tbody tr');
    await expect.poll(async () => rows.count(), { timeout: 15000 }).toBeGreaterThan(0);
    await expect(centre).toContainText('חלון אירוע');
    await page.screenshot({ path: path.join(OUT, `event-windows-${testInfo.project.name}.png`) });

    // a window with several events shows ×N and its drawer lists the raw events
    if (merged) {
      const row = centre.locator('sw-table tbody tr', { hasText: `×${merged.count}` }).first();
      await expect(row).toBeVisible();
      await row.click();
    } else {
      await rows.first().click();
    }
    const drawer = centre.locator('sw-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('[data-window-events] .wrow').first()).toBeVisible();
    if (merged) expect(await drawer.locator('[data-window-events] .wrow').count()).toBeGreaterThan(1);
    await page.screenshot({ path: path.join(OUT, `event-window-drawer-${testInfo.project.name}.png`) });

    // full review opens the event page of the window's first event
    await drawer.locator('[data-review-window]').click();
    await expect(page).toHaveURL(/#\/investigate\/events\/[a-z0-9-]+/);
    await expect(page.locator('investigate-event-detail [data-context]')).toBeVisible({ timeout: 15000 });

    // the view choice is remembered
    await open(page, '/investigate/events');
    await expect(page.locator('investigate-events sw-chip[data-mode-windows]')).toHaveAttribute('selected', '');
    await page.locator('investigate-events sw-chip', { hasText: 'אירועים' }).first().click();
    await expect(page.locator('investigate-events sw-table img.thumb, investigate-events sw-table tbody tr').first()).toBeVisible({ timeout: 15000 });
  });
});
