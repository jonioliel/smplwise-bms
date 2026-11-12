import { test, expect, type Locator, type Page } from '@playwright/test';

// PLAN3D-FURNMERGE-2434 in Chromium on the style guide's 3D demo: the + / - zoom buttons (round-28 mockup: a group in the
// bar's other bottom corner, Hebrew labels, hidden on a phone / in the kiosk view), and the level-3 graph after the
// furniture merge (merged meshes carry the furniture; a click on a merged object still selects it).
interface Probe {
  view: {
    camera: { isOrthographicCamera?: boolean; zoom: number; position: { distanceTo: (v: unknown) => number } };
    controls: { target: unknown };
    realPending: number;
    realStats: Record<string, number> | null;
    scene: { traverse: (f: (o: Record<string, unknown>) => void) => void };
    pickAt: (x: number, y: number) => { id: string; kind: string; partId: string } | null;
    renderer: { domElement: HTMLCanvasElement };
    redrawNow: () => void;
  };
  minFps: number;
  setTimeHour: (h: number) => void;
}
/** The style guide's demo (a 720 px card: its bar fills the row, so no zoom group); `full` stretches it over the
 * viewport, the size of the map screen's stage. */
async function openDemo(page: Page, full = true): Promise<Locator> {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  await el.evaluate((n) => { (n as unknown as Probe).minFps = 0; });
  if (full) {
    await el.evaluate((n) => { const s = (n as HTMLElement).style; s.position = 'fixed'; s.inset = '0'; s.inlineSize = '100vw'; s.blockSize = '100vh'; s.zIndex = '1000'; });
    await page.waitForTimeout(400);
  }
  return el;
}
const zoomNow = (el: Locator) => el.evaluate((n) => { const v = (n as unknown as Probe).view; return v.camera.isOrthographicCamera ? v.camera.zoom : 1 / v.camera.position.distanceTo(v.controls.target); });

test('the zoom buttons: labelled, in the corner opposite the bar, closer and farther in iso and perspective', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'a phone pinches: the buttons are hidden there (own test below)');
  const el = await openDemo(page);
  const zoom = el.locator('[data-3d-zoom]');
  await expect(zoom).toBeVisible();
  await expect(zoom).toHaveAttribute('role', 'group');
  await expect(el.locator('[data-3d-zoom-in]')).toHaveAttribute('aria-label', 'התקרבות');
  await expect(el.locator('[data-3d-zoom-out]')).toHaveAttribute('aria-label', 'התרחקות');
  // the corner opposite the bar's start (RTL: the bar starts at the right, the zoom stands at the left), never over a chip
  const z = (await zoom.boundingBox())!;
  const host = (await el.boundingBox())!;
  const place = await el.getAttribute('data-zoom-room');
  expect(['row', 'above']).toContain(place);
  expect(z.x - host.x).toBeLessThan(40);
  expect(host.y + host.height - (z.y + z.height)).toBeLessThan(place === 'row' ? 40 : 140);
  for (const chip of await el.locator('[data-3d-bar] > *').all()) {
    const b = await chip.boundingBox();
    if (!b) continue;
    const overlap = !(b.x + b.width <= z.x || z.x + z.width <= b.x || b.y + b.height <= z.y || z.y + z.height <= b.y);
    expect(overlap).toBe(false);
  }
  for (const preset of ['iso', 'persp'] as const) {
    await el.locator(`[data-preset-${preset}]`).click();
    await page.waitForTimeout(300);
    const z0 = await zoomNow(el);
    await el.locator('[data-3d-zoom-in]').click();
    await expect.poll(() => zoomNow(el)).toBeGreaterThan(z0 * 1.3);
    const z1 = await zoomNow(el);
    await el.locator('[data-3d-zoom-out]').click();
    await el.locator('[data-3d-zoom-out]').click();
    await expect.poll(() => zoomNow(el)).toBeLessThan(z1 / 1.6);
    // a preset again: the preset's own framing
    await el.locator(`[data-preset-${preset}]`).click();
    await expect.poll(async () => Math.abs((await zoomNow(el)) / z0 - 1)).toBeLessThan(0.02);
  }
  // keyboard: a button is a real button (Enter zooms)
  await el.locator('[data-preset-iso]').click();
  const k0 = await zoomNow(el);
  await el.locator('[data-3d-zoom-in]').focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => zoomNow(el)).toBeGreaterThan(k0 * 1.3);
});

test('the zoom buttons are hidden on a phone, in a narrow card and on the wall display', async ({ page }, info) => {
  const el = await openDemo(page);
  if (info.project.name === 'mobile') await expect(el.locator('[data-3d-zoom]')).toBeHidden();
  else {
    await expect(el.locator('[data-3d-zoom]')).toBeVisible();
    await el.evaluate((n) => (n as HTMLElement).setAttribute('kiosk', ''));
    await expect(el.locator('[data-3d-zoom]')).toBeHidden();
    await el.evaluate((n) => (n as HTMLElement).removeAttribute('kiosk'));
    await expect(el.locator('[data-3d-zoom]')).toBeVisible();
    // a narrow element (an event's card): none
    await el.evaluate((n) => { (n as HTMLElement).style.inlineSize = '600px'; });
    await expect(el.locator('[data-3d-zoom]')).toBeHidden();
  }
});

test('level 3 draws the furniture merged and a click on a merged object still selects it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough for the graph');
  test.setTimeout(180_000);
  const el = await openDemo(page);
  await el.locator('[data-quality-3-lite]').click();
  await expect(el).toHaveAttribute('data-quality', '3');
  await el.evaluate((n) => (n as unknown as Probe).setTimeHour(13));
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 90000 }).toBe(0);
  await el.locator('[data-preset-top]').click();
  await page.waitForTimeout(500);
  const stats = await el.evaluate((n) => (n as unknown as Probe).view.realStats);
  expect(stats?.furnitureMerged ?? 0).toBeGreaterThan(0);
  // every object id the merged meshes carry, projected to the screen at its triangles' centre, picks that object (or
  // something standing over it): at least one must resolve straight to itself
  const res = await el.evaluate((n) => {
    const v = (n as unknown as Probe).view as unknown as { scene: { traverse: (f: (o: any) => void) => void }; camera: any; renderer: { domElement: HTMLCanvasElement }; pickAt: Probe['view']['pickAt']; lookupOf?: unknown };
    const rect = v.renderer.domElement.getBoundingClientRect();
    const tried: string[] = [];
    let hits = 0;
    v.scene.traverse((o) => {
      if (!o.isMesh || !String(o.name).startsWith('merged|') || !o.userData.ranges) return;
      const ranges = o.userData.ranges as Uint32Array;
      const pos = o.geometry.getAttribute('position');
      const parts = ((v as any).lookup.get(o) ?? []) as { id: string; kind: string; userData: { id: string; kind: string } }[];
      parts.forEach((p, i) => {
        if (p.userData.kind !== 'object' || tried.length > 40) return;
        const t0 = ranges[i];
        const t1 = i + 1 < ranges.length ? ranges[i + 1] : pos.count / 3;
        let top = -Infinity;
        let at = [0, 0, 0];
        for (let t = t0; t < t1; t++) for (let k = 0; k < 3; k++) {
          const y = pos.getY(t * 3 + k);
          if (y > top) { top = y; at = [pos.getX(t * 3 + k), y, pos.getZ(t * 3 + k)]; }
        }
        const c = new (v.camera.position.constructor)(at[0], at[1] - 0.01, at[2]).project(v.camera);
        const x = rect.left + ((c.x + 1) / 2) * rect.width;
        const y = rect.top + ((1 - c.y) / 2) * rect.height;
        tried.push(p.userData.id);
        if (v.pickAt(x, y)?.id === p.userData.id) hits++;
      });
    });
    return { tried: tried.length, hits };
  });
  expect(res.tried).toBeGreaterThan(0);
  expect(res.hits).toBeGreaterThan(0);
});
