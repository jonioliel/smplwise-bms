import { test, expect } from '@playwright/test';

// T087 task 6 review R1, the demo floor map without a backend: the 2D never builds the 3D scene (the toggle reads a cheap
// existence test), the 2D canvas stays the same element under the 3D so its pan and zoom survive a round trip, the toggle
// reports the view that is on screen, and a held key 3 does not flip the view back and forth.
type Host = HTMLElement & { sceneMemo: unknown; sceneTimer: number };
type Canvas = HTMLElement & { zoom: number; zoomBy: (f: number) => void; tx: number; ty: number; __mark?: string };

test('the demo floor map: no 3D scene in 2D, the canvas and its zoom survive a 3D round trip, a held 3 is ignored', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/#/explore/floors/f0');
  const host = page.locator('explore-floor-map');
  const canvas = host.locator('sw-plan-canvas');
  await expect(canvas).toBeAttached({ timeout: 20000 });
  const toggle = host.locator('[data-view-3d]');
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('title', 'מקש 3');
  // the 2D render path never touched the scene builder
  await page.waitForTimeout(300);
  expect(await host.evaluate((n) => ({ memo: (n as Host).sceneMemo, timer: (n as Host).sceneTimer }))).toEqual({ memo: null, timer: 0 });
  // zoom the 2D and mark the element
  const before = await canvas.evaluate((n) => {
    const c = n as Canvas;
    c.zoomBy(1.6);
    c.__mark = 'same';
    return { zoom: c.zoom, tx: c.tx, ty: c.ty };
  });
  await toggle.click();
  const el = host.locator('sw-plan-3d[data-floor-3d]');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle).toContainText('2D');
  await expect(canvas).toBeHidden(); // mounted, not shown
  expect(await host.evaluate((n) => (n as Host).sceneMemo !== null)).toBe(true);
  // a held key: the first press goes back to 2D, the repeats do nothing
  await page.keyboard.down('3');
  await page.keyboard.down('3');
  await page.keyboard.down('3');
  await page.keyboard.up('3');
  await expect(el).toHaveCount(0);
  await expect(canvas).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toContainText('3D');
  const after = await canvas.evaluate((n) => {
    const c = n as Canvas;
    return { mark: c.__mark ?? null, zoom: c.zoom, tx: c.tx, ty: c.ty };
  });
  expect(after).toEqual({ mark: 'same', ...before });
});
