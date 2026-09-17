import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the historical map on real data (T030 / M16) against the running developer backend: opened
// from an event at its time, the floor shows recording coverage per camera at that instant, HA entities as
// unknown, events around the instant, a scrubbable day timeline, and an explicit way back to live.
// Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T030-history-live');

test.describe('historical map (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('event time on the map, coverage, events, timeline, back to live', async ({ page, request }, testInfo) => {
    const list = (await (await request.get('/api/v1/events?limit=300')).json()).events as { id: string; camera_id: string | null; occurred_at: string }[];
    let ev: (typeof list)[number] | null = null;
    let floorId = '';
    for (const e of list) {
      if (!e.camera_id) continue;
      const d = await (await request.get(`/api/v1/events/${e.id}`)).json();
      if (d.location?.has_plan) {
        ev = e;
        floorId = d.location.floor_id;
        break;
      }
    }
    expect(ev, 'an event of a camera placed on a plan').toBeTruthy();

    // from the event page: "המשך חקירה במפה" opens the historical map at the event time
    await open(page, `/investigate/events/${ev!.id}`);
    await page.locator('investigate-event-detail [data-history-map]').click();
    await expect(page).toHaveURL(/#\/investigate\/floors\/[a-z0-9-]+\?t=/);
    const hm = page.locator('investigate-history-map');
    await expect(hm.locator('[data-history-panel]')).toBeVisible({ timeout: 20000 });
    await expect(hm.locator('[data-history-camera]')).not.toContainText('לחץ על מצלמה');
    await expect(hm.locator('sw-plan-canvas g.marker.selected')).toHaveCount(1);
    await expect(hm.locator('[data-history-events] a').first()).toBeVisible({ timeout: 20000 });
    await expect(hm.locator('sw-timeline')).toBeVisible();
    // the selected camera's state at that instant is either covered (historic) or an honest unknown
    const cls = await hm.locator('sw-plan-canvas g.marker.selected').getAttribute('class');
    expect(cls).toMatch(/historic|unknown/);
    // entities never show a live value here
    // the local HA history grows with every day the backend runs: before it began the panel says unknown, inside it the entity is known
    await expect(hm.locator('[data-history-panel]')).toContainText(/לא ידוע בזמן זה|ידועות בזמן זה/);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `history-map-${testInfo.project.name}.png`), fullPage: true });

    // scrub: moving the cursor changes the shown time
    const before = await hm.locator('[data-history-time]').textContent();
    await hm.locator('sw-chip', { hasText: '-5 דק׳' }).click();
    await expect.poll(async () => hm.locator('[data-history-time]').textContent()).not.toBe(before);

    // explicit return to live
    await hm.locator('[data-back-live]').click();
    await expect(page).toHaveURL(new RegExp(`#/explore/floors/${floorId}`));
  });
});
