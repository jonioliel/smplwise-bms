import { test, expect } from '@playwright/test';

// Plan Studio phase 4 (T087): the 3D element in a browser without a backend. The style guide loads it on demand (the three
// chunk is fetched only then), it renders the demo floor, the presets change the view, a click on a wall is echoed as the
// selection, hovering shows a label and the export answers a glTF. Headless Chromium draws WebGL through SwiftShader;
// frame rates are measured in real Chrome by the live spec (Task 10), never asserted here.
test('the 3D element: lazy chunk, parts, presets, selection echo, hover, export', async ({ page }) => {
  test.setTimeout(90_000);
  const chunkRequests: string[] = [];
  page.on('request', (r) => {
    if (/\/assets\/three-[\w-]+\.js$/.test(r.url())) chunkRequests.push(r.url());
  });
  await page.goto('/#/styleguide');
  await expect(page.locator('styleguide-screen [data-3d-demo-load]')).toBeVisible({ timeout: 20000 });
  expect(chunkRequests, 'three is not fetched before the first click').toHaveLength(0);
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  expect(chunkRequests).toHaveLength(1);
  expect(Number(await el.getAttribute('data-parts'))).toBeGreaterThan(20);
  await expect(el).toHaveAttribute('data-preset', 'iso');
  await el.locator('[data-preset-top]').click();
  await expect(el).toHaveAttribute('data-preset', 'top');
  await el.locator('[data-preset-camera]').selectOption('cam-1');
  await expect(el).toHaveAttribute('data-preset', 'camera');
  await el.locator('[data-preset-top]').click();
  await expect(el).toHaveAttribute('data-preset', 'top');
  await expect.poll(async () => Number(await el.getAttribute('data-frames'))).toBeGreaterThan(0); // it rendered (on demand since the task 5 review R1: no frame count to wait for)
  // a click on a wall: the element projects the part's centre, the click lands there, the selection is echoed
  const wall = await el.evaluate((node) => {
    const e = node as unknown as { description: { parts: { id: string; kind: string; position: [number, number, number]; userData: { id: string } }[] }; toScreen: (p: [number, number, number]) => { x: number; y: number } | null };
    const w = e.description.parts.find((p) => p.kind === 'wall')!;
    return { id: w.userData.id, at: e.toScreen(w.position) };
  });
  expect(wall.at).toBeTruthy();
  const box = (await el.boundingBox())!;
  await page.mouse.click(box.x + wall.at!.x, box.y + wall.at!.y);
  await expect(el).toHaveAttribute('data-selected', wall.id);
  await expect(page.locator('styleguide-screen [data-3d-demo-selected]')).toHaveText(wall.id);
  await page.mouse.move(box.x + wall.at!.x + 2, box.y + wall.at!.y + 2);
  await expect(el.locator('[data-3d-tip]')).toBeAttached();
  await expect(el.locator('[data-3d-tip]')).toContainText('קיר');
  // a click on the empty floor clears the selection. Deviation from task-5-brief.md's draft ([0.6, 0, 0.6]): the demo
  // room 0 starts at 40 px = 0.667 m with 0.15 m walls, so that point lies under the wall's corner and the ray hits
  // the wall; [1.2, 0, 4.4] is bare floor inside room 0 (clear of the chairs, the lamp and the walls from the top preset)
  const floorAt = await el.evaluate((node) => (node as unknown as { toScreen: (p: [number, number, number]) => { x: number; y: number } | null }).toScreen([1.2, 0, 4.4]));
  await page.mouse.click(box.x + floorAt!.x, box.y + floorAt!.y);
  await expect(el).toHaveAttribute('data-selected', '');
  // the export is a glTF JSON with nodes
  const gltf = await el.evaluate(async (node) => {
    const g = await (node as unknown as { exportGltf: () => Promise<{ asset: { generator: string }; nodes: unknown[] }> }).exportGltf();
    return { generator: g.asset.generator, nodes: g.nodes.length };
  });
  expect(gltf.generator).toContain('GLTFExporter');
  expect(gltf.nodes).toBeGreaterThan(5);
});

// The prism realisation takes what the builder can hand over (T087 review facts): a cone ring with many consecutive
// origin points (a camera inside a wall), a full circle without its origin, a concave ring, a closing duplicate, and a
// degenerate ring (null). Node only - no WebGL is needed to build a BufferGeometry.
test('prismGeometry tolerates repeated origins, full circles, concave and degenerate rings', async () => {
  const { prismGeometry } = await import('../src/map/scene-three');
  type G = ReturnType<typeof prismGeometry>;
  const triangles = (g: G): number => (g ? g.getAttribute('position').count / 3 : 0);
  const finite = (g: G): boolean => !!g && Array.from(g.getAttribute('position').array as ArrayLike<number>).every(Number.isFinite) && Array.from(g.getAttribute('normal').array as ArrayLike<number>).every(Number.isFinite);
  // n distinct ring points: (n - 2) cap triangles top and bottom, two per side
  const expected = (n: number): number => 2 * (n - 2) + 2 * n;
  const wedge = prismGeometry([[0, 0], [0, 0], [0, 0], [1, -2], [0, -2.2], [-1, -2], [0, 0], [0, 0]], 2.5);
  expect(finite(wedge)).toBe(true);
  expect(triangles(wedge)).toBe(expected(4));
  const circle: [number, number][] = Array.from({ length: 48 }, (_, k) => [2 * Math.cos((k * Math.PI) / 24), 2 * Math.sin((k * Math.PI) / 24)]);
  const full = prismGeometry(circle, 2.5);
  expect(finite(full)).toBe(true);
  expect(triangles(full)).toBe(expected(48));
  const concave = prismGeometry([[0, 0], [4, 0], [4, 4], [2, 1], [0, 4], [0, 0]], 1);
  expect(finite(concave)).toBe(true);
  expect(triangles(concave)).toBe(expected(5));
  expect(prismGeometry([[0, 0], [0, 0], [0, 0]], 2)).toBeNull(); // a camera deep inside a wall: nothing to draw
  expect(prismGeometry([[0, 0], [1, 0], [2, 0]], 2)).toBeNull(); // collinear, zero area
  expect(prismGeometry([[0, 0], [1, 0], [0, 1]], 0)).toBeNull(); // no height
});

// T087 task 6: the floor map in demo mode hosts the 3D - the toggle, the key 3, the layers of the 2D and a camera card from a 3D click.
test('the demo floor map: the toggle loads the chunk once, the key 3 switches, layers and a camera card work in 3D', async ({ page }) => {
  test.setTimeout(90_000);
  const chunkRequests: string[] = [];
  page.on('request', (r) => {
    if (/\/assets\/three-[\w-]+\.js$/.test(r.url())) chunkRequests.push(r.url());
  });
  await page.goto('/#/explore/floors/f0');
  const host = page.locator('explore-floor-map');
  await expect(host.locator('sw-plan-canvas')).toBeAttached({ timeout: 20000 });
  const toggle = host.locator('[data-view-3d]');
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(chunkRequests).toHaveLength(0);
  await toggle.click();
  const el = host.locator('sw-plan-3d[data-floor-3d]');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(chunkRequests).toHaveLength(1);
  const all = Number(await el.getAttribute('data-parts'));
  expect(all).toBeGreaterThan(20);
  // the layers of the 2D apply: objects off removes the chairs and lamps
  await host.locator('.layers button[aria-label="עצמים"]').click();
  await expect.poll(async () => Number(await el.getAttribute('data-parts'))).toBeLessThan(all);
  await host.locator('.layers button[aria-label="עצמים"]').click();
  await expect.poll(async () => Number(await el.getAttribute('data-parts'))).toBe(all);
  // a click on a camera opens its card (a drawer: the 3D has no pin to anchor a popover to)
  const cam = await el.evaluate((node) => {
    const e = node as unknown as { description: { parts: { id: string; position: [number, number, number]; userData: { id: string } }[] }; toScreen: (p: [number, number, number]) => { x: number; y: number } | null };
    const c = e.description.parts.find((p) => p.id === 'cam:cam-2')!;
    return { id: c.userData.id, at: e.toScreen(c.position) };
  });
  await el.locator('[data-preset-top]').click();
  const camTop = await el.evaluate((node, id) => {
    const e = node as unknown as { description: { parts: { id: string; position: [number, number, number] }[] }; toScreen: (p: [number, number, number]) => { x: number; y: number } | null };
    return e.toScreen(e.description.parts.find((p) => p.id === id)!.position);
  }, 'cam:cam-2');
  const box = (await el.boundingBox())!;
  await page.mouse.click(box.x + camTop!.x, box.y + camTop!.y);
  await expect(el).toHaveAttribute('data-selected', cam.id);
  await expect(host.locator('sw-drawer[open]')).toBeAttached();
  await page.keyboard.press('Escape');
  await expect(host.locator('sw-drawer[open]')).toHaveCount(0);
  await expect(el).toHaveAttribute('data-selected', '');
  // the key 3 goes back to 2D and forth again without a second fetch of the chunk
  await page.keyboard.press('3');
  await expect(host.locator('sw-plan-canvas')).toBeAttached();
  await expect(host.locator('sw-plan-3d')).toHaveCount(0);
  await page.keyboard.press('3');
  await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-ready', '', { timeout: 15000 });
  expect(chunkRequests).toHaveLength(1);
  // a 3 typed into a field (the floor select of the tool row) is not a toggle: the 3D stays
  await host.locator('.tools sw-field select').focus();
  await page.keyboard.press('3');
  await page.waitForTimeout(300);
  await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveCount(1);
});
