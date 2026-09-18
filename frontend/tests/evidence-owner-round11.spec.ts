import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for 0.1.74 (owner round 3) against the running developer backend: the system administrator writes to the
// NVR without a custom role, a new custom role is assigned to its creator, "מבנה" button on a site, floor quick
// buttons, jump without zoom, wall column override, coverage sliders. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'owner-round-live');

test.describe('owner round 11: round-3 notes (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1800);
  }

  test('admin holds the NVR permissions; a new role is assigned to its creator', async ({ page, request }) => {
    const sys = await (await request.get('/api/v1/nvr/system')).json();
    expect(sys.can).toEqual({ time: true, storage: true, alarm: true, reboot: true, osd: true, connection: true });
    expect((await (await request.get('/api/v1/nvr/notify')).json()).can_write).toBe(true);
    await open(page, '/system/setup');
    await expect(page.locator('system-setup [data-nvr-sync-clock]')).toBeVisible({ timeout: 40000 });
    await expect(page.locator('system-setup [data-nvr-reboot]')).toBeVisible();
    // custom role: created with "assign to me" → a binding for the creator exists
    const name = `תפקיד בדיקה ${Date.now() % 100000}`;
    await open(page, '/system/access');
    const screen = page.locator('system-access');
    await screen.locator('sw-tabs').getByText('תפקידים').first().click();
    await screen.locator('[data-role-new]').click();
    await screen.locator('[data-role-name]').fill(name);
    await screen.locator('[data-role-perm="map.read"]').check();
    await expect(screen.locator('[data-role-assign-me]')).toBeChecked();
    await screen.locator('[data-role-save]').click();
    await expect(screen).toContainText('שויך אליך', { timeout: 15000 });
    const roles = (await (await request.get('/api/v1/access/roles')).json()).roles as { id: string; name: string }[];
    const role = roles.find((r) => r.name === name)!;
    expect(role).toBeTruthy();
    const me = await (await request.get('/api/v1/me')).json();
    const mine = (me.bindings as { id: string; role_id: string }[]).find((b) => b.role_id === role.id);
    try {
      expect(mine, 'the creator holds the new role').toBeTruthy();
    } finally {
      if (mine) await request.delete(`/api/v1/access/bindings/${mine.id}`);
      await request.delete(`/api/v1/access/roles/${role.id}`);
    }
  });

  test('sites: a visible "building" button; map: floor buttons and jump without zoom', async ({ page, request }, testInfo) => {
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const site = tree.sites[0];
    await open(page, '/explore/sites');
    const sites = page.locator('explore-sites');
    await expect(sites.locator(`[data-add-building="${site.id}"]`)).toBeVisible({ timeout: 30000 });
    await sites.locator(`[data-add-building="${site.id}"]`).click();
    await expect(sites.locator('[data-form-name]')).toBeVisible();
    await sites.locator('sw-button', { hasText: 'ביטול' }).first().click();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors)) as { id: string; has_plan: boolean }[];
    const start = floors.find((f) => f.has_plan)!;
    await open(page, `/explore/floors/${start.id}`);
    const viewer = page.locator('explore-floor-map');
    await expect(viewer.locator('[data-floor-buttons] button')).toHaveCount(floors.length, { timeout: 30000 });
    await expect(viewer.locator(`[data-floor-button="${start.id}"]`)).toHaveClass(/on/);
    await page.screenshot({ path: path.join(OUT, `floor-buttons-${testInfo.project.name}.png`) });
    // jump without zoom (default): the scale stays, the pin is centred
    await expect(viewer.locator('[data-floorchip]')).toBeVisible();
    await page.waitForTimeout(800);
    if (!(await viewer.locator('[data-sidelist]').isVisible())) await viewer.locator('[data-sidelist-toggle]').click();
    await expect(viewer.locator('[data-jump-zoom]')).not.toBeChecked();
    const canvas = viewer.locator('sw-plan-canvas');
    const scale0 = await canvas.evaluate((el) => (el as unknown as { scale: number }).scale);
    await viewer.locator('[data-side-camera]').first().click();
    await page.waitForTimeout(600);
    expect(await canvas.evaluate((el) => (el as unknown as { scale: number }).scale)).toBeCloseTo(scale0, 5);
    await page.waitForTimeout(1000);
    await viewer.locator('[data-jump-zoom]').check();
    await viewer.locator('[data-side-camera]').first().click();
    await page.waitForTimeout(600);
    expect(await canvas.evaluate((el) => (el as unknown as { scale: number }).scale)).toBeGreaterThan(scale0);
    await viewer.locator('[data-jump-zoom]').uncheck();
    const other = floors.find((f) => f.id !== start.id);
    if (other) {
      await viewer.locator(`[data-floor-button="${other.id}"]`).click();
      await expect.poll(() => page.evaluate(() => location.hash)).toContain(other.id);
    }
  });

  test('wall: the viewer chooses the columns; editor: coverage width and distance sliders', async ({ page, request }) => {
    const cams = ((await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean }[]).filter((c) => c.enabled);
    await page.setViewportSize({ width: 1600, height: 800 });
    await open(page, `/live/wall?cameras=${cams.slice(0, 2).map((c) => c.id).join(',')}`);
    const wall = page.locator('live-wall');
    await expect(wall.locator('sw-camera-tile')).toHaveCount(2, { timeout: 30000 });
    await wall.locator('[data-wall-cols-set="1"]').click();
    await expect(wall.locator('[data-wall-cols]')).toHaveAttribute('data-wall-cols', '1');
    await wall.locator('[data-wall-cols-set="0"]').click();
    await expect(wall.locator('[data-wall-cols]')).toHaveAttribute('data-wall-cols', '2');
    // coverage sliders in the editor
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    const floor = floors.find((f: { has_plan: boolean }) => f.has_plan);
    const map = await (await request.get(`/api/v1/floors/${floor.id}/map?draft=true`)).json();
    const anchor = map.anchors.find((a: { resource_type: string; field_of_view_degrees: number | null }) => a.resource_type === 'camera' && a.field_of_view_degrees);
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, `/explore/floors/${floor.id}/edit`);
    const editor = page.locator('explore-plan-editor');
    const canvas = editor.locator('sw-plan-canvas');
    const box = (await canvas.boundingBox())!;
    const centre = await canvas.evaluate((el, id) => {
      const c = el as unknown as { markers: { id: string; x: number; y: number }[]; toScreen: (x: number, y: number) => { x: number; y: number } };
      const m = c.markers.find((x) => x.id === id)!;
      return c.toScreen(m.x, m.y);
    }, anchor.id);
    await page.mouse.click(box.x + centre.x, box.y + centre.y);
    await expect(editor.locator('[data-coverage-width] input')).toBeVisible({ timeout: 15000 });
    await editor.locator('[data-coverage-distance] input').evaluate((el) => { (el as HTMLInputElement).value = '40'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    const radius = await editor.evaluate((el, id) => (el as unknown as { anchors: { id: string; coverage_radius?: number | null }[] }).anchors.find((a) => a.id === id)!.coverage_radius, anchor.id);
    expect(radius).toBeCloseTo(0.4, 3); // not saved: the editor is left without saving
  });
});
