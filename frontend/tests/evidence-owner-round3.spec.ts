import { test, expect } from '@playwright/test';

// Evidence for the owner's test-round batch 3 (0.1.63) against the running developer backend: the floor map's side
// list jumps to a camera, and the pick bar offers one chip per room that holds cameras. Runs only with SW_LIVE=1.

interface MapAnchor { id: string; resource_type: string; resource_id: string; position: { x: number; y: number }; camera?: { name: string } | null }
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

test.describe('owner round 3 (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('side list jumps to a camera and opens its card; room chips pick a room by name', async ({ page, request }) => {
    test.setTimeout(120000);
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors)).filter((f: { has_plan: boolean }) => f.has_plan);
    const floor = floors[0];
    expect(floor, 'a floor with a plan').toBeTruthy();
    const map0 = await (await request.get(`/api/v1/floors/${floor.id}/map`)).json();
    const zones = (map0.zones ?? []) as MapZone[];
    const placed0 = new Set((map0.anchors as MapAnchor[]).filter((a) => a.resource_type === 'camera').map((a) => a.resource_id));
    // the dev floor holds one camera: place one more inside the first room so a room chip exists
    const spare = ((await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean }[]).find((c) => c.enabled && !placed0.has(c.id));
    const zone0 = zones.find((z) => z.polygon.length >= 3);
    const created: string[] = [];
    if (spare && zone0) {
      const c = { x: zone0.polygon.reduce((t, q) => t + q.x, 0) / zone0.polygon.length, y: zone0.polygon.reduce((t, q) => t + q.y, 0) / zone0.polygon.length };
      const spot = inside(c, zone0.polygon) ? c : zone0.polygon[0];
      const r = await request.post(`/api/v1/floors/${floor.id}/anchors`, { data: { resource_type: 'camera', resource_id: spare.id, x: spot.x, y: spot.y, rotation_degrees: 0, field_of_view_degrees: 60 } });
      expect(r.status()).toBe(201);
      created.push((await r.json()).id as string);
    }
    try {
      const map = await (await request.get(`/api/v1/floors/${floor.id}/map`)).json();
      const cams = (map.anchors as MapAnchor[]).filter((a) => a.resource_type === 'camera');
      await page.goto(`/?design=a#/explore/floors/${floor.id}`);
      const viewer = page.locator('explore-floor-map');
      await expect(viewer.locator('[data-sidelist-toggle]')).toBeVisible({ timeout: 30000 });
      await page.waitForTimeout(1500);
      // the side list: every placed camera is listed; a click zooms to it and opens its card
      if (!(await viewer.locator('[data-sidelist]').isVisible())) await viewer.locator('[data-sidelist-toggle]').click();
      const list = viewer.locator('[data-sidelist]');
      await expect(list).toBeVisible();
      await expect(list.locator('[data-side-camera]')).toHaveCount(cams.length);
      const target = cams[cams.length - 1];
      await list.locator(`[data-side-camera="${target.resource_id}"]`).click();
      await expect(viewer.locator('sw-popover, sw-drawer')).toHaveCount(1, { timeout: 10000 });
      await expect(viewer.locator(`sw-plan-canvas g.marker[data-id="${target.id}"]`)).toHaveClass(/selected/);
      // the state survives a reload (kept per browser)
      await page.reload();
      await expect(viewer.locator('[data-sidelist]')).toBeVisible({ timeout: 30000 });
      await viewer.locator('[data-sidelist-toggle]').click();
      await expect(viewer.locator('[data-sidelist]')).toHaveCount(0);

      // room chips in the pick bar
      await viewer.locator('[data-multi-toggle]').click();
      const bar = viewer.locator('[data-pickbar]');
      const rooms = zones.map((z) => ({ z, n: cams.filter((a) => inside(a.position, z.polygon)).length })).filter((r) => r.n > 0);
      await expect(bar.locator('[data-room-chip]')).toHaveCount(rooms.length);
      if (rooms.length) {
        const r0 = rooms[0];
        await expect(bar.locator(`[data-room-chip="${r0.z.id}"]`)).toContainText(`(${r0.n})`);
        await bar.locator(`[data-room-chip="${r0.z.id}"]`).click();
        await expect(bar.locator('sw-chip[selected][icon="camera"]')).toHaveCount(r0.n);
        await expect(bar.locator(`[data-room-chip="${r0.z.id}"]`)).toHaveAttribute('selected', '');
        await bar.locator(`[data-room-chip="${r0.z.id}"]`).click();
        await expect(bar.locator('sw-chip[selected][icon="camera"]')).toHaveCount(0);
      }
      // "קיר חי" is the first action in the bar
      const first = bar.locator('sw-button').first();
      await expect(first).toContainText('קיר חי');
    } finally {
      for (const id of created) await request.delete(`/api/v1/map-anchors/${id}`);
    }
  });
});
