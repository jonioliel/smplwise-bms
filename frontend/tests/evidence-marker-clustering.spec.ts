import { test, expect } from '@playwright/test';

// M037: a generated 300-camera site on the demo floor map (no backend). Far out the pins merge into counted clusters
// with the worst status colour; a click and the Enter key expand a cluster by zooming to its members; the selected pin is
// never swallowed; a small site (below the threshold) draws plain pins with no cluster. Screenshots light and dark.
type Canvas = HTMLElement & { markers: unknown[]; selectedId: string | null; updateComplete: Promise<boolean>; fit(): void; zoom: number; clusterThreshold: number };
const STATES = ['live', 'live', 'live', 'live', 'live', 'live', 'live', 'recorded', 'offline', 'stale'] as const;
const camera300 = Array.from({ length: 300 }, (_, i) => ({
  id: `cam${i}`, kind: 'camera', label: `מצלמה ${i + 1}`,
  x: 0.04 + ((i * 37) % 100) / 104, y: 0.05 + ((i * 53) % 100) / 108,
  rotation: (i * 29) % 360, fov: 70, state: STATES[i % STATES.length],
}));

async function setup(page: import('@playwright/test').Page, markers: unknown[]) {
  await page.goto('/#/explore/floors/f0');
  const canvas = page.locator('explore-floor-map sw-plan-canvas');
  await expect(canvas).toBeVisible({ timeout: 20000 });
  await canvas.evaluate(async (n, ms) => {
    const cv = n as Canvas;
    cv.markers = ms;
    cv.fit();
    await cv.updateComplete;
  }, markers);
  return canvas;
}

test('300 cameras: clusters with counts and the worst colour, click and keyboard expand, selection kept', async ({ page }, info) => {
  const canvas = await setup(page, camera300);
  const clusters = canvas.locator('g.marker.cluster');
  await expect(clusters.first()).toBeVisible();
  const total = await clusters.evaluateAll((els) => els.reduce((t, e) => t + Number(e.getAttribute('data-count')), 0));
  const singles = await canvas.locator('g.marker:not(.cluster)').count();
  expect(total + singles).toBe(300);
  expect(await clusters.count()).toBeLessThan(300);
  // the worst status shows on a cluster that holds an offline camera
  expect(await canvas.locator('g.marker.cluster.offline').count()).toBeGreaterThan(0);
  await expect(clusters.first()).toHaveAttribute('role', 'button');
  await expect(clusters.first()).toHaveAttribute('tabindex', '0');
  await page.screenshot({ path: info.outputPath('clusters-light.png') });

  // click expands: fewer members per cluster / the zoom grows
  const z0 = await canvas.evaluate((n) => (n as Canvas).zoom);
  const big = canvas.locator('g.marker.cluster').first();
  const n0 = Number(await big.getAttribute('data-count'));
  await big.click({ force: true });
  await expect.poll(() => canvas.evaluate((n) => (n as Canvas).zoom)).toBeGreaterThan(z0);
  const maxAfter = await canvas.locator('g.marker.cluster').evaluateAll((els) => Math.max(0, ...els.map((e) => Number(e.getAttribute('data-count')))));
  expect(maxAfter).toBeLessThan(Math.max(n0, 2) + 1);
  await page.screenshot({ path: info.outputPath('clusters-expanded.png') });

  // keyboard: Enter on a focused cluster zooms in as well
  await canvas.evaluate(async (n) => { const cv = n as Canvas; cv.fit(); await cv.updateComplete; });
  await expect(canvas.locator('g.marker.cluster').first()).toBeVisible();
  const z1 = await canvas.evaluate((n) => (n as Canvas).zoom);
  await canvas.locator('g.marker.cluster').first().focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => canvas.evaluate((n) => (n as Canvas).zoom)).toBeGreaterThan(z1);

  // the selected pin stays individual even where its neighbours cluster
  await canvas.evaluate(async (n) => { const cv = n as Canvas; cv.fit(); cv.selectedId = 'cam10'; await cv.updateComplete; });
  await expect(canvas.locator('g.marker[data-id="cam10"]')).toHaveCount(1);
  await expect(canvas.locator('g.marker[data-id="cam10"]')).toHaveClass(/selected/);

  // fully zoomed in every camera is an individual pin again
  await canvas.evaluate(async (n) => { const cv = n as Canvas; cv.selectedId = null; cv.clusterThreshold = 0; await cv.updateComplete; });
  await expect(canvas.locator('g.marker.cluster')).toHaveCount(0);
  await expect(canvas.locator('g.marker')).toHaveCount(300);
});

test('dark scheme and the RTL page: clusters stay legible, the plan is not mirrored', async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const canvas = await setup(page, camera300);
  await expect(canvas.locator('g.marker.cluster').first()).toBeVisible();
  expect(await canvas.evaluate((n) => getComputedStyle(n).direction)).toBe('ltr');
  await page.screenshot({ path: info.outputPath('clusters-dark.png') });
});

test('a small site draws plain pins, no cluster', async ({ page }, info) => {
  const canvas = await setup(page, camera300.slice(0, 40));
  await expect(canvas.locator('g.marker')).toHaveCount(40);
  await expect(canvas.locator('g.marker.cluster')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('small-site.png') });
});
