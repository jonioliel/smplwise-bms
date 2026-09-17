import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the rest of T043 (0.1.56) against the running developer backend: a room click picks the cameras
// placed inside it, a rectangle dragged over the plan picks every camera under it, the pick bar splits the
// selection by availability, and the selection is saved as a view that the saved-views screen lists.
// Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T043-multiselect-live');

interface MapAnchor { id: string; resource_type: string; resource_id: string; position: { x: number; y: number }; camera?: { status: string; can_view_live?: boolean } | null }
interface MapZone { id: string; name: string; polygon: { x: number; y: number }[] }

function inside(p: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

test.describe('rectangle / room selection and save as a view (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('room click, rectangle drag, availability split, save as view', async ({ page, request }, testInfo) => {
    test.setTimeout(120000);
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors)).filter((f: { has_plan: boolean }) => f.has_plan);
    expect(floors.length, 'a floor with a plan').toBeGreaterThan(0);
    // the floor with the most cameras placed on its plan (the first one of the dev database holds a single camera)
    const maps = await Promise.all(floors.map(async (f: { id: string }) => ({ floor: f, map: await (await request.get(`/api/v1/floors/${f.id}/map`)).json() })));
    const best = maps.sort((a, b) => b.map.anchors.filter((x: MapAnchor) => x.resource_type === 'camera').length - a.map.anchors.filter((x: MapAnchor) => x.resource_type === 'camera').length)[0];
    const floor = best.floor;
    const zones = (best.map.zones ?? []) as MapZone[];
    // the dev database keeps a single camera on the plan: place three spare cameras for the test (one at a room's
    // centre so the room click has something to pick) and remove them at the end
    const placed0 = new Set((best.map.anchors as MapAnchor[]).filter((a) => a.resource_type === 'camera').map((a) => a.resource_id));
    const cameras = ((await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean }[]).filter((c) => c.enabled && !placed0.has(c.id)).slice(0, 3);
    const spots = [{ x: 0.22, y: 0.3 }, { x: 0.78, y: 0.72 }, { x: 0.5, y: 0.5 }];
    const zone0 = zones.find((z) => z.polygon.length >= 3);
    if (zone0) {
      const c = { x: zone0.polygon.reduce((t, q) => t + q.x, 0) / zone0.polygon.length, y: zone0.polygon.reduce((t, q) => t + q.y, 0) / zone0.polygon.length };
      if (inside(c, zone0.polygon)) spots[2] = c;
    }
    const created: string[] = [];
    for (const [i, c] of cameras.entries()) {
      const r = await request.post(`/api/v1/floors/${floor.id}/anchors`, { data: { resource_type: 'camera', resource_id: c.id, x: spots[i].x, y: spots[i].y, rotation_degrees: 90, field_of_view_degrees: 70 } });
      expect(r.status(), 'spare camera placed').toBe(201);
      created.push((await r.json()).id as string);
    }
    try {
      await run(page, request, testInfo, floor.id, zones);
    } finally {
      for (const id of created) await request.delete(`/api/v1/map-anchors/${id}`);
    }
  });

  async function run(page: Page, request: Parameters<Parameters<typeof test>[2]>[0]['request'], testInfo: { project: { name: string } }, floorId: string, zones: MapZone[]) {
    const map = await (await request.get(`/api/v1/floors/${floorId}/map`)).json();
    const cams = (map.anchors as MapAnchor[]).filter((a) => a.resource_type === 'camera');
    expect(cams.length, 'cameras placed on the plan').toBeGreaterThan(1);
    const floor = { id: floorId };

    await open(page, `/explore/floors/${floor.id}`);
    const viewer = page.locator('explore-floor-map');
    await viewer.locator('[data-multi-toggle]').click();
    const bar = viewer.locator('[data-pickbar]');
    await expect(bar).toBeVisible();
    await expect(bar.locator('[data-pick-save]')).toHaveAttribute('disabled', '');
    await expect(bar.locator('[data-pick-hint]')).toContainText('גרור מלבן');

    // a room with cameras inside it: one click picks them all, a second click drops them again
    const room = zones.map((z) => ({ z, cams: cams.filter((a) => inside(a.position, z.polygon)) })).find((r) => r.cams.length > 0);
    if (room) {
      const g = viewer.locator(`sw-plan-canvas g.zone[data-zone="${room.z.id}"]`);
      await g.dispatchEvent('click');
      await expect(bar.locator('sw-chip[selected]')).toHaveCount(room.cams.length);
      await expect(bar.locator('[data-pick-hint]')).toContainText(`נבחרו ${room.cams.length}`);
      await g.dispatchEvent('click');
      await expect(bar.locator('sw-chip[selected]')).toHaveCount(0);
    } else {
      test.info().annotations.push({ type: 'note', description: 'no zone with cameras inside it on this floor - room pick not exercised' });
    }

    // a rectangle over the whole plan picks every camera on it; the drag starts at the top-left corner, the one
    // corner free of overlays (floor chip and legend sit on the right in RTL, the zoom controls bottom-left)
    const canvas = viewer.locator('sw-plan-canvas');
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + 8, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await expect(canvas.locator('rect[data-box]')).toBeVisible();
    await page.mouse.move(box.x + box.width - 8, box.y + box.height - 8, { steps: 6 });
    await page.screenshot({ path: path.join(OUT, `box-drag-${testInfo.project.name}.png`) });
    await page.mouse.up();
    await expect(canvas.locator('rect[data-box]')).toHaveCount(0);
    await expect(bar.locator('sw-chip[selected]')).toHaveCount(cams.length);
    await expect(viewer.locator('sw-plan-canvas g.marker.selected')).toHaveCount(cams.length);

    // availability split: online / offline / without live permission, as counted from the map bundle
    const denied = cams.filter((a) => a.camera?.can_view_live === false).length;
    const online = cams.filter((a) => a.camera?.can_view_live !== false && a.camera?.status === 'online').length;
    const offline = cams.length - online - denied;
    const hint = bar.locator('[data-pick-hint]');
    await expect(hint).toContainText(`נבחרו ${cams.length} · ${online} זמינות`);
    if (offline) await expect(hint).toContainText(`${offline} לא מקוונות`);
    if (denied) await expect(hint).toContainText(`${denied} ללא הרשאה`);
    await expect(bar.locator('sw-chip[data-pick-chip="online"]')).toHaveCount(online);
    await page.screenshot({ path: path.join(OUT, `box-picked-${testInfo.project.name}.png`) });

    // save the selection as a view
    await bar.locator('[data-pick-save]').click();
    const dlg = viewer.locator('[data-save-view-dialog]');
    await expect(dlg.locator('[data-save-view-name]')).toBeVisible(); // the sw-dialog host itself has no box of its own
    const name = `T043 מלבן ${Date.now()}`;
    await dlg.locator('[data-save-view-name]').fill(name);
    await dlg.locator('[data-save-view-cols]').selectOption('3');
    await page.screenshot({ path: path.join(OUT, `save-dialog-${testInfo.project.name}.png`) });
    await dlg.locator('[data-save-view-submit]').click();
    await expect(bar.locator('[data-view-saved]')).toContainText('נשמרה', { timeout: 15000 });
    await expect(dlg).toHaveCount(0);
    const expected = Math.min(16, cams.length - denied);
    await expect(bar.locator('[data-view-saved]')).toContainText(`${expected} מצלמות`);
    const views = (await (await request.get('/api/v1/views')).json()).views as { id: string; name: string; cameras: string[]; cols: number; rows: number }[];
    const v = views.find((x) => x.name === name);
    expect(v, 'the view exists on the server').toBeTruthy();
    expect(v!.cameras.length).toBe(expected);
    expect(v!.cols).toBe(3);
    await page.screenshot({ path: path.join(OUT, `saved-${testInfo.project.name}.png`) });

    // the note links to the saved-views screen, which lists the new view
    await bar.locator('[data-view-saved-open]').click();
    await expect(page).toHaveURL(/#\/live\/views/);
    await expect(page.locator('live-views')).toContainText(name, { timeout: 15000 });

    // clean up
    const del = await request.delete(`/api/v1/views/${v!.id}`);
    expect([200, 204]).toContain(del.status());
  }
});
