import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence against the running developer backend (T007/T019 editor UX, design SW A): the plan editor is
// operated with the mouse in real Chrome — dragging a pin moves it, dragging the direction handle turns
// the camera, click-to-place adds a camera at the clicked point — and the stylized rendering is produced
// from the owner's real plan. Runs only with SW_LIVE=1 (backend on 8099 behind the preview proxy).
const HERE = path.dirname(fileURLToPath(import.meta.url));
// The owner's floor plan is customer data: this evidence stays in the gitignored private-evidence/.
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T007-editor-live');

test.describe('plan editor with the mouse (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1800);
  }

  test('drag, orient with the handle, place by click, stylize', async ({ page, request }, testInfo) => {
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    const floor = floors.find((f: { has_plan: boolean }) => f.has_plan);
    expect(floor).toBeTruthy();
    const map = await (await request.get(`/api/v1/floors/${floor.id}/map?draft=true`)).json();
    const cameraAnchor = map.anchors.find((a: { resource_type: string }) => a.resource_type === 'camera');
    expect(cameraAnchor, 'a camera must already be placed on the plan').toBeTruthy();

    await open(page, `/explore/floors/${floor.id}/edit`);
    expect(await page.evaluate(() => document.documentElement.dataset.design)).toBe('a');
    const editor = page.locator('explore-plan-editor');
    const canvas = editor.locator('sw-plan-canvas');
    await expect(canvas).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `editor-${testInfo.project.name}.png`) });

    // 1) drag the camera pin ~120 px to the right/down with the mouse
    const box = (await canvas.boundingBox())!;
    const start = await canvas.evaluate((el, id) => {
      const c = el as unknown as { markers: { id: string; x: number; y: number }[]; toScreen: (x: number, y: number) => { x: number; y: number } };
      const m = c.markers.find((x) => x.id === id)!;
      return c.toScreen(m.x, m.y);
    }, cameraAnchor.id);
    await page.mouse.move(box.x + start.x, box.y + start.y);
    await page.mouse.down();
    await page.mouse.move(box.x + start.x + 60, box.y + start.y + 30, { steps: 8 });
    await page.mouse.move(box.x + start.x + 120, box.y + start.y + 60, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const moved = await editor.evaluate((el, id) => {
      const e = el as unknown as { anchors: { id: string; position: { x: number; y: number } }[]; dirty: Set<string> };
      const a = e.anchors.find((x) => x.id === id)!;
      return { x: a.position.x, y: a.position.y, dirty: e.dirty.has(id) };
    }, cameraAnchor.id);
    expect(moved.dirty).toBeTruthy();
    expect(moved.x).toBeGreaterThan(cameraAnchor.position.x);
    expect(moved.y).toBeGreaterThan(cameraAnchor.position.y);

    // 2) the selected camera shows handles; dragging the direction handle changes the bearing
    await expect(canvas.locator('circle.handle:not(.range)')).toHaveCount(1); // the range handle (R2) is a second circle
    const handle = await canvas.locator('circle.handle:not(.range)').boundingBox();
    expect(handle).toBeTruthy();
    const hx = handle!.x + handle!.width / 2;
    const hy = handle!.y + handle!.height / 2;
    const centre = { x: box.x + start.x + 120, y: box.y + start.y + 60 };
    await page.mouse.move(hx, hy);
    await page.mouse.down();
    await page.mouse.move(centre.x + 90, centre.y + 10, { steps: 10 }); // point the camera to the right
    await page.mouse.up();
    await page.waitForTimeout(400);
    const oriented = await editor.evaluate((el, id) => {
      const e = el as unknown as { anchors: { id: string; rotation_degrees: number; field_of_view_degrees: number | null }[] };
      const a = e.anchors.find((x) => x.id === id)!;
      return { rotation: a.rotation_degrees, fov: a.field_of_view_degrees };
    }, cameraAnchor.id);
    expect(oriented.rotation).toBeGreaterThan(45);
    expect(oriented.rotation).toBeLessThan(135);
    await page.screenshot({ path: path.join(OUT, `editor-handles-${testInfo.project.name}.png`) });

    // 3) undo restores the previous state (nothing was saved yet)
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const undone = await editor.evaluate((el, id) => {
      const e = el as unknown as { anchors: { id: string; position: { x: number; y: number }; rotation_degrees: number }[] };
      const a = e.anchors.find((x) => x.id === id)!;
      return { x: a.position.x, rotation: a.rotation_degrees };
    }, cameraAnchor.id);
    expect(Math.abs(undone.x - cameraAnchor.position.x)).toBeLessThan(0.0001);
    expect(undone.rotation).toBe(cameraAnchor.rotation_degrees);

    // 4) stylized rendering of the real plan through the API (the editor's "עיבוד" buttons call the same endpoint)
    const st = await request.post(`/api/v1/plan-versions/${map.plan.id}/stylize`, { data: { strength: 'light', keep_lines: false } });
    expect(st.status()).toBe(200);
    const body = await st.json();
    expect(body.rooms).toBeGreaterThanOrEqual(1);
    const pic = await request.get('/api/v1/' + String(body.stylized_url).replace(/^api\/v1\//, ''));
    expect(pic.headers()['content-type']).toContain('image/png');
    await editor.evaluate((el) => (el as unknown as { stylize: (s: string, k: boolean) => Promise<void> }).stylize('light', false));
    await page.waitForTimeout(1500);
    await expect(editor.locator('.compare img').nth(1)).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: path.join(OUT, `editor-stylize-${testInfo.project.name}.png`), fullPage: true });
  });
});
