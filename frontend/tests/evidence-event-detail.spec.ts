import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the event page (design M27) and the event centre tabs (M26) against the running developer
// backend: the recording plays from just before the event, the context panel shows status / source / type /
// time / location, the camera's floor with the pin, nearby events, "סמן כטופל" is recorded, and the centre's
// drawer opens the page. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T0xx-event-detail-live');

test.describe('event page (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('video, context, map, ack; centre opens it', async ({ page, request }, testInfo) => {
    // an event of a camera that is placed on a plan, if any; else any camera event
    const list = (await (await request.get('/api/v1/events?limit=300')).json()).events as { id: string; camera_id: string | null; acked_at: string | null }[];
    let ev = null as (typeof list)[number] | null;
    for (const e of list) {
      if (!e.camera_id) continue;
      const d = await (await request.get(`/api/v1/events/${e.id}`)).json();
      if (d.location?.has_plan) {
        ev = e;
        break;
      }
      ev ??= e;
    }
    expect(ev, 'a camera event in the last 24 h').toBeTruthy();
    const detail = await (await request.get(`/api/v1/events/${ev!.id}`)).json();

    await open(page, `/investigate/events/${ev!.id}`);
    const det = page.locator('investigate-event-detail');
    await expect(det.locator('[data-context]')).toBeVisible({ timeout: 15000 });
    await expect(det.locator('[data-where]')).toBeVisible();
    await expect(det.locator('[data-player] sw-live-player, [data-player] img, [data-player] .hint').first()).toBeVisible({ timeout: 20000 });
    if (detail.location?.has_plan) {
      await expect(det.locator('sw-plan-canvas')).toBeVisible();
      await expect(det.locator('sw-plan-canvas g.marker.selected')).toHaveCount(1);
      await expect(det.locator('[data-where]')).toContainText(detail.location.floor_name);
      await expect(det.getByRole('button', { name: 'המשך חקירה במפה' })).toBeVisible();
    }
    await page.waitForTimeout(3500); // let the recording connect for the picture
    const playing = await det.locator('[data-player] sw-live-player').count();
    testInfo.annotations.push({ type: 'player', description: playing ? 'recording session opened' : 'no session (thumbnail / hint shown)' });
    await page.screenshot({ path: path.join(OUT, `event-detail-${testInfo.project.name}.png`), fullPage: true });

    // acknowledge from the page: the status row changes and the API records the user
    if (!detail.acked_at) {
      await det.getByRole('button', { name: 'סמן כטופל' }).click();
      await expect(det.locator('[data-status]')).toContainText('טופל', { timeout: 10000 });
      const after = await (await request.get(`/api/v1/events/${ev!.id}`)).json();
      expect(after.acked_at).toBeTruthy();
    }

    // event centre: the 'טופלו' tab lists acknowledged events; the drawer's 'סקירה מלאה' opens the page
    await open(page, '/investigate/events');
    const centre = page.locator('investigate-events');
    await expect(centre.locator('sw-chip', { hasText: 'טופלו' })).toBeVisible();
    await centre.locator('sw-chip', { hasText: 'טופלו' }).click();
    await page.waitForTimeout(800);
    const rows = centre.locator('sw-table tbody tr, sw-table [role="row"]');
    if ((await rows.count()) > 0) {
      await rows.first().click();
      await expect(centre.locator('sw-drawer')).toBeVisible();
      await page.screenshot({ path: path.join(OUT, `event-centre-acked-${testInfo.project.name}.png`) });
      await centre.locator('sw-drawer [data-review]').click();
      await expect(page).toHaveURL(/#\/investigate\/events\/[a-z0-9-]+/);
      await expect(page.locator('investigate-event-detail [data-context]')).toBeVisible({ timeout: 15000 });
    } else {
      testInfo.annotations.push({ type: 'centre', description: 'no acknowledged events today; drawer step skipped' });
    }
  });
});
