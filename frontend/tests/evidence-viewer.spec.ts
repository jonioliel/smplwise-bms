import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the floor map viewer per M05/M06/M07 (design SW A) against the running developer backend:
// floor chip and zoom controls on the map, the layers panel with counts whose toggles only change what is
// drawn, the camera card with live video, status, location and "צפייה מלאה" / "הקלטות", and Escape closing
// the card with focus back on the pin. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T007-viewer-live');

test.describe('floor map viewer (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1800);
  }

  test('layers panel, camera card, escape', async ({ page, request }, testInfo) => {
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    const floor = floors.find((f: { has_plan: boolean }) => f.has_plan);
    expect(floor).toBeTruthy();
    const map = await (await request.get(`/api/v1/floors/${floor.id}/map`)).json();
    const cameraAnchor = map.anchors.find((a: { resource_type: string }) => a.resource_type === 'camera');
    expect(cameraAnchor, 'a camera must be placed on the plan').toBeTruthy();

    await open(page, `/explore/floors/${floor.id}`);
    const viewer = page.locator('explore-floor-map');
    const canvas = viewer.locator('sw-plan-canvas');
    await expect(canvas).toBeVisible();
    await expect(viewer.locator('[data-floorchip]')).toBeVisible();
    await expect(viewer.locator('.sub', { hasText: 'ישויות HA' })).toBeVisible();
    // zoom controls sit at the bottom-left of the map, the legend at the bottom-right (M05)
    const ctl = (await canvas.locator('.controls').boundingBox())!;
    const cbox = (await canvas.boundingBox())!;
    expect(ctl.x - cbox.x).toBeLessThan(40);
    expect(cbox.y + cbox.height - (ctl.y + ctl.height)).toBeLessThan(40);
    const legend = (await viewer.locator('.legend').boundingBox())!;
    expect(cbox.x + cbox.width - (legend.x + legend.width)).toBeLessThan(40);
    await page.screenshot({ path: path.join(OUT, `viewer-${testInfo.project.name}.png`) });

    // 1) layers panel: counts, and a toggle changes only what is drawn
    const markersBefore = await canvas.locator('g.marker').count();
    expect(markersBefore).toBeGreaterThanOrEqual(1);
    await viewer.getByRole('button', { name: 'שכבות' }).click();
    const panel = viewer.locator('[data-layers-panel]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.prow')).toHaveCount(8); // cameras, doors, lights, sensors, zones and, since 0.1.82, the structure layer; objects and connectors (T085)
    await expect(panel).toContainText('ממוקמות');
    await expect(panel).toContainText('מבנה');
    await page.screenshot({ path: path.join(OUT, `viewer-layers-${testInfo.project.name}.png`) });
    await panel.locator('sw-toggle[data-layer="cameras"]').click();
    await expect(canvas.locator('g.marker')).toHaveCount(markersBefore - map.anchors.filter((a: { resource_type: string }) => a.resource_type === 'camera').length);
    await panel.locator('sw-toggle[data-layer="cameras"]').click();
    await expect(canvas.locator('g.marker')).toHaveCount(markersBefore);
    await page.keyboard.press('Escape'); // closes the panel
    await expect(panel).toHaveCount(0);

    // 2) camera card (M06): live tile, status, location, actions
    await canvas.locator(`g.marker[data-id="${cameraAnchor.id}"]`).click();
    const card = viewer.locator('sw-popover, sw-drawer').first();
    await expect(card).toBeVisible();
    await expect(card.locator('[data-where]')).toBeVisible();
    await expect(card.getByRole('button', { name: 'צפייה מלאה' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'הקלטות' })).toBeVisible();
    const tile = card.locator('sw-camera-tile');
    await expect(tile).toBeVisible();
    const live = await tile.getAttribute('data-live');
    if (live === '1') await expect(tile.locator('sw-live-player')).toHaveCount(1);
    await page.waitForTimeout(2500); // let the stream connect for the picture
    await page.screenshot({ path: path.join(OUT, `viewer-camera-${testInfo.project.name}.png`) });

    // 3) Escape closes the card and returns keyboard focus to the pin
    await page.keyboard.press('Escape');
    await expect(viewer.locator('sw-popover, sw-drawer')).toHaveCount(0);
    const focused = await canvas.evaluate((el) => (el.shadowRoot?.activeElement as Element | null)?.getAttribute('data-id'));
    expect(focused).toBe(cameraAnchor.id);
  });
});
