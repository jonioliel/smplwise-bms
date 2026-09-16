import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for multi-camera selection from the floor map (T043) against the running developer backend:
// the selection mode picks cameras on the plan, "קיר חי" opens the live wall with exactly those cameras,
// "ניגון מסונכרן" opens playback with the first as lead and the others as the synchronized group.
// Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T043-multiselect-live');

test.describe('multi-camera selection (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('pick on the map, open wall and synchronized playback', async ({ page, request }, testInfo) => {
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    const floor = floors.find((f: { has_plan: boolean }) => f.has_plan);
    expect(floor).toBeTruthy();
    const map = await (await request.get(`/api/v1/floors/${floor.id}/map`)).json();
    const cams = map.anchors.filter((a: { resource_type: string }) => a.resource_type === 'camera');
    expect(cams.length, 'cameras placed on the plan').toBeGreaterThan(0);

    await open(page, `/explore/floors/${floor.id}`);
    const viewer = page.locator('explore-floor-map');
    await viewer.locator('[data-multi-toggle]').click();
    const bar = viewer.locator('[data-pickbar]');
    await expect(bar).toBeVisible();
    await expect(bar.locator('[data-pick-wall]')).toHaveAttribute('disabled', '');
    // a click on a camera pin adds it; "בחר הכל" takes every camera of the floor
    await viewer.locator(`sw-plan-canvas g.marker[data-id="${cams[0].id}"]`).click();
    await expect(bar.locator('sw-chip[selected]')).toHaveCount(1);
    await expect(viewer.locator('sw-plan-canvas g.marker.selected')).toHaveCount(1);
    await bar.locator('[data-pick-all]').click();
    await expect(bar.locator('sw-chip[selected]')).toHaveCount(cams.length);
    await expect(viewer.locator('sw-popover, sw-drawer')).toHaveCount(0); // no card opens while picking
    await page.screenshot({ path: path.join(OUT, `pick-${testInfo.project.name}.png`) });

    // live wall with exactly the picked cameras
    await bar.locator('[data-pick-wall]').click();
    await expect(page).toHaveURL(/#\/live\/wall\?cameras=/);
    const wall = page.locator('live-wall');
    await expect(wall.locator('sw-camera-tile')).toHaveCount(cams.length, { timeout: 15000 });
    await expect(wall.locator('[data-wall-picked]')).toContainText('שנבחרו');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, `wall-${testInfo.project.name}.png`) });

    // synchronized playback: lead + extras
    await open(page, `/explore/floors/${floor.id}`);
    await viewer.locator('[data-multi-toggle]').click();
    await viewer.locator('[data-pick-all]').click();
    await viewer.locator('[data-pick-sync]').click();
    await expect(page).toHaveURL(/#\/investigate\/playback\?camera=/);
    const pb = page.locator('investigate-playback');
    await expect(pb).toBeVisible();
    const qs = new URLSearchParams((new URL(page.url()).hash.split('?')[1] ?? '')); // the route lives in the hash
    expect(qs.get('camera')).toBe(cams[0].resource_id);
    if (cams.length > 1) {
      expect(qs.get('extra')).toContain(cams[1].resource_id);
      await expect(pb.locator('sw-chip[selected]')).toHaveCount(Math.min(3, cams.length - 1));
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `sync-${testInfo.project.name}.png`), fullPage: true });
  });
});
