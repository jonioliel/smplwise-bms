import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the phone layout (T034, design M41 / M45) against the running developer backend at 390 px:
// the event centre is a card list with summary tiles and no sideways scrolling, a tap opens the bottom
// sheet, the floor map opens a camera card as a bottom sheet, the event page and the historical map stack.
// Runs only with SW_LIVE=1 and the "mobile" Playwright project.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T034-mobile-live');

test.describe('phone layout (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');
  test.skip(({ viewport }) => !viewport || viewport.width > 500, 'phone project only');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  async function noSidewaysScroll(page: Page) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(0);
  }

  test('events list, floor map sheet, event page, history map', async ({ page, request }, testInfo) => {
    // event centre: tiles + card rows
    await open(page, '/investigate/events');
    const centre = page.locator('investigate-events');
    await expect(centre.locator('[data-kpis]')).toBeVisible();
    await expect(centre.locator('sw-table tbody tr').first()).toBeVisible({ timeout: 15000 });
    const display = await centre.locator('sw-table tbody tr').first().evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe('grid');
    await noSidewaysScroll(page);
    await page.screenshot({ path: path.join(OUT, `events-${testInfo.project.name}.png`), fullPage: true });
    await centre.locator('sw-table tbody tr').first().click();
    const sheet = centre.locator('sw-drawer .panel');
    await expect(sheet).toBeVisible();
    const box = (await sheet.boundingBox())!;
    const vh = page.viewportSize()!.height;
    expect(box.y + box.height).toBeGreaterThan(vh - 4); // anchored to the bottom edge
    await page.screenshot({ path: path.join(OUT, `event-sheet-${testInfo.project.name}.png`) });

    // floor map: camera pin opens a bottom sheet
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    const floor = floors.find((f: { has_plan: boolean }) => f.has_plan);
    expect(floor).toBeTruthy();
    const map = await (await request.get(`/api/v1/floors/${floor.id}/map`)).json();
    const cam = map.anchors.find((a: { resource_type: string }) => a.resource_type === 'camera');
    await open(page, `/explore/floors/${floor.id}`);
    const viewer = page.locator('explore-floor-map');
    await expect(viewer.locator('sw-plan-canvas')).toBeVisible();
    await noSidewaysScroll(page);
    if (cam) {
      // centre the pin first: on a phone the whole plan is small and a pin near the edge can sit under the zoom controls
      await viewer.locator('sw-plan-canvas').evaluate((el, p) => (el as unknown as { zoomToBox: (a: number, b: number, c: number, d: number) => void }).zoomToBox(p.x - 0.12, p.y - 0.12, p.x + 0.12, p.y + 0.12), cam.position);
      await page.waitForTimeout(300);
      await viewer.locator(`sw-plan-canvas g.marker[data-id="${cam.id}"]`).click();
      await expect(viewer.locator('sw-drawer .panel')).toBeVisible();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, `floor-sheet-${testInfo.project.name}.png`) });
    }

    // event page stacks; historical map stacks
    const events = (await (await request.get('/api/v1/events?limit=50')).json()).events as { id: string; camera_id: string | null }[];
    const ev = events.find((e) => e.camera_id);
    if (ev) {
      await open(page, `/investigate/events/${ev.id}`);
      await expect(page.locator('investigate-event-detail [data-context]')).toBeVisible({ timeout: 15000 });
      await noSidewaysScroll(page);
      await page.screenshot({ path: path.join(OUT, `event-page-${testInfo.project.name}.png`), fullPage: true });
    }
    await open(page, `/investigate/floors/${floor.id}`);
    await expect(page.locator('investigate-history-map [data-history-panel]')).toBeVisible({ timeout: 20000 });
    await noSidewaysScroll(page);
    await page.screenshot({ path: path.join(OUT, `history-${testInfo.project.name}.png`), fullPage: true });
  });
});
