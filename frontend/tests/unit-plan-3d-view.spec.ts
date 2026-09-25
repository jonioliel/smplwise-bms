import { test, expect, type Locator, type Page } from '@playwright/test';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { buildScene, type SceneDescription } from '../src/map/scene-builder';

// Plan Studio phase 4 (T087 task 5 review R1): real assertions on the three realisation behind <sw-plan-3d>, read from
// the element's (private) SceneView at runtime in headless Chromium - the camera after each preset, a pick inside an
// instance group, draw calls against the scene graph, the export Blob, the context released on removal, on-demand
// frames against continuous mode, and a click through a translucent upper plate. The style guide hosts the element.

type V3 = { x: number; y: number; z: number };
interface ViewProbe {
  camera: { position: V3 };
  controls: { target: V3 };
  frames: number;
}
type Probe = { view: ViewProbe; description: SceneDescription };

async function openDemo(page: Page): Promise<Locator> {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  return el;
}

/** Wait until the view has stopped rendering (on demand: no change, damping settled). */
async function settled(el: Locator): Promise<number> {
  let last = -1;
  await expect
    .poll(async () => {
      const now = await el.evaluate((n) => (n as unknown as Probe).view.frames);
      const same = now === last;
      last = now;
      return same;
    }, { intervals: [400, 400, 400, 400, 400, 400, 400, 400, 400, 400] })
    .toBe(true);
  return last;
}

async function clickPart(page: Page, el: Locator, partId: string): Promise<void> {
  const at = await el.evaluate((n, id) => {
    const e = n as unknown as { description: SceneDescription; toScreen: (p: [number, number, number]) => { x: number; y: number } | null };
    return e.toScreen(e.description.parts.find((p) => p.id === id)!.position);
  }, partId);
  expect(at, `${partId} projects into the view`).toBeTruthy();
  const box = (await el.boundingBox())!;
  await page.mouse.click(box.x + at!.x, box.y + at!.y);
}

test('the demo scene: counts by kind, instance groups and draw calls match the description', async ({ page }) => {
  test.setTimeout(90_000);
  const el = await openDemo(page);
  const expected = buildScene(demoSceneInput('f0')!);
  const counts = (d: SceneDescription): Record<string, number> => d.parts.reduce<Record<string, number>>((a, p) => ({ ...a, [p.kind]: (a[p.kind] ?? 0) + 1 }), {});
  // 8 rooms: 8 closed walls cut by 8 doors (4 straight boxes each, the cut side in two), 8 lintels, 8 leaves; 8 lamps + 6 chairs;
  // the demo cameras of f0 with their cones; the entities as sprites, the lobby light on (a glow)
  expect(counts(expected)).toEqual({ floor: 1, wall: 40, lintel: 8, door: 8, object: 14, camera: 6, cone: 6, entity: 4, glow: 1 });
  const seen = await el.evaluate((n) => {
    const e = n as unknown as { description: SceneDescription; view: { scene: { traverse: (f: (o: Record<string, unknown>) => void) => void }; renderer: { info: { render: { calls: number } } } } };
    let instanced = 0;
    let instances = 0;
    let singles = 0;
    let sprites = 0;
    let lit = 0;
    e.view.scene.traverse((o) => {
      if (o.isInstancedMesh) {
        instanced++;
        instances += o.count as number;
      } else if (o.isMesh || o.isLine) singles++;
      if (o.isSprite) {
        singles++;
        sprites++;
      }
      if (o.isPointLight && (o.intensity as number) > 0) lit++;
    });
    return { parts: e.description.parts.length, instanced, instances, singles, sprites, lit, calls: e.view.renderer.info.render.calls };
  });
  expect(seen.parts).toBe(expected.parts.length);
  expect(seen.instanced).toBe(expected.stats.groups);
  expect(seen.instances).toBe(expected.stats.instanced);
  expect(seen.sprites).toBe(counts(expected).entity);
  expect(seen.lit).toBe(1);
  expect(seen.calls).toBeGreaterThan(0);
  expect(seen.calls).toBeLessThanOrEqual(seen.instanced + seen.singles); // one call per instance group, never per part
});

test('the presets place the camera: top above the middle of the plan, a camera preset at the body looking down', async ({ page }) => {
  test.setTimeout(90_000);
  const el = await openDemo(page);
  await el.locator('[data-preset-top]').click();
  await expect(el).toHaveAttribute('data-preset', 'top');
  const top = await el.evaluate((n) => {
    const e = n as unknown as Probe;
    return { pos: { ...e.view.camera.position }, size: e.description.size, ceilings: e.description.levels.map((l) => l.elevation_m + l.ceiling_height_m) };
  });
  expect(top.pos.x).toBeCloseTo(top.size[0] / 2, 2);
  expect(top.pos.z).toBeCloseTo(top.size[1] / 2, 2);
  expect(top.pos.y).toBeGreaterThan(Math.max(...top.ceilings));
  await el.locator('[data-preset-camera]').selectOption('cam-1');
  await expect(el).toHaveAttribute('data-preset', 'camera');
  const cam = await el.evaluate((n) => {
    const e = n as unknown as Probe;
    return { pos: { ...e.view.camera.position }, target: { ...e.view.controls.target }, body: e.description.parts.find((p) => p.id === 'cam:cam-1')!.position };
  });
  expect(cam.pos.x).toBeCloseTo(cam.body[0], 3);
  expect(cam.pos.y).toBeCloseTo(cam.body[1], 3);
  expect(cam.pos.z).toBeCloseTo(cam.body[2], 3);
  expect(cam.target.y).toBeLessThan(cam.pos.y); // the default tilt looks down (R-P4-T4-1)
  // an unknown camera leaves the view and the attribute as they were (M-1)
  await el.evaluate((n) => { (n as unknown as { preset: unknown }).preset = { camera: 'cam:nope' }; });
  await expect(el).toHaveAttribute('data-preset', 'camera');
  const after = await el.evaluate((n) => ({ ...(n as unknown as Probe).view.camera.position }));
  expect(after.x).toBeCloseTo(cam.pos.x, 6);
});

test('a chair inside a shared instance group is picked by its own id; the export leaves the outline out', async ({ page }) => {
  test.setTimeout(90_000);
  const el = await openDemo(page);
  await el.locator('[data-preset-top]').click();
  const group = await el.evaluate((n) => {
    const d = (n as unknown as Probe).description;
    const g = d.parts.find((p) => p.id === 'obj:dc4')!.group;
    return new Set(d.parts.filter((p) => p.group === g).map((p) => p.userData.id)).size;
  });
  expect(group).toBeGreaterThan(1); // dc4 shares its InstancedMesh with other ids
  await clickPart(page, el, 'obj:dc4');
  await expect(el).toHaveAttribute('data-selected', 'dc4');
  await expect(page.locator('styleguide-screen [data-3d-demo-selected]')).toHaveText('dc4');
  // the download: stub the object URL and the anchor click, keep the Blob
  await page.evaluate(() => {
    const w = window as unknown as { __gltf: { blob: Blob | null; name: string } };
    w.__gltf = { blob: null, name: '' };
    URL.createObjectURL = (b: Blob | MediaSource) => { w.__gltf.blob = b as Blob; return 'blob:stub'; };
    URL.revokeObjectURL = () => undefined;
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) { w.__gltf.name = this.download; };
  });
  await el.locator('[data-export-gltf]').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __gltf: { name: string } }).__gltf.name)).toBe('demo-floor.gltf');
  const out = await page.evaluate(async () => {
    const b = (window as unknown as { __gltf: { blob: Blob } }).__gltf.blob;
    const json = JSON.parse(await b.text()) as { asset: { generator: string }; nodes: { name?: string }[] };
    return { type: b.type, generator: json.asset.generator, nodes: json.nodes.length };
  });
  const drawn = await el.evaluate((n) => {
    const v = (n as unknown as { view: { root: { children: unknown[] }; outline: unknown } }).view;
    return { children: v.root.children.length, outline: v.outline !== null };
  });
  expect(out.type).toBe('model/gltf+json');
  expect(out.generator).toContain('GLTFExporter');
  expect(drawn.outline).toBe(true); // dc4 is still selected and outlined on screen
  expect(out.nodes).toBe(1 + drawn.children - 1); // the exported group and every child but the outline
});

test('frames render on demand and stop when the scene is static; continuous mode keeps them going', async ({ page }) => {
  test.setTimeout(90_000);
  const el = await openDemo(page);
  const f1 = await settled(el);
  await page.waitForTimeout(1200);
  expect(await el.evaluate((n) => (n as unknown as Probe).view.frames)).toBe(f1);
  await expect(el).toHaveAttribute('data-frames', String(f1)); // the last count went out when the frames stopped
  await el.evaluate((n) => { (n as unknown as { continuous: boolean }).continuous = true; });
  await expect(el).toHaveAttribute('data-measure', '');
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.frames)).toBeGreaterThan(f1 + 20);
  await expect.poll(async () => Number(await el.getAttribute('data-fps'))).toBeGreaterThan(0);
  await el.evaluate((n) => { (n as unknown as { continuous: boolean }).continuous = false; });
  const f2 = await settled(el);
  await page.waitForTimeout(800);
  expect(await el.evaluate((n) => (n as unknown as Probe).view.frames)).toBe(f2);
  // a preset change is one short burst, then quiet again
  await el.locator('[data-preset-top]').click();
  const f3 = await settled(el);
  expect(f3).toBeGreaterThan(f2);
});

test('a click goes through a translucent upper plate to the level below; the lower plate is an empty click', async ({ page }) => {
  test.setTimeout(90_000);
  const el = await openDemo(page);
  const input = demoSceneInput('f0')!;
  input.doc.levels.push({ id: 'L1', name: 'קומה 1', elevation_m: 3, ceiling_height_m: 3, is_default: false });
  input.doc.walls.push({ id: 'up', level_id: 'L1', polyline: [[0.02, 0.02], [0.98, 0.02], [0.98, 0.98], [0.02, 0.98], [0.02, 0.02]], thickness_m: 0.15, height_m: null, base_z_m: 0, kind: 'exterior', confidence: 1, source: 'manual', locked: false, external_ids: {} });
  const two = buildScene(input);
  expect(two.levels.map((l) => l.id)).toEqual(['L0', 'L1']);
  await el.evaluate((n, d) => { (n as unknown as { description: unknown }).description = d; }, JSON.parse(JSON.stringify(two)));
  await expect(el).toHaveAttribute('data-parts', String(two.parts.length));
  await el.locator('[data-preset-top]').click();
  const plates = await el.evaluate((n) => {
    const v = (n as unknown as { view: { root: { children: { name: string; material?: { opacity: number } }[] } } }).view;
    return Object.fromEntries(v.root.children.filter((c) => c.name.startsWith('floor:')).map((c) => [c.name, c.material?.opacity ?? -1]));
  });
  expect(plates['floor:L0']).toBe(1);
  expect(plates['floor:L1']).toBeLessThan(1);
  const wall = two.parts.find((p) => p.kind === 'wall' && p.level_id === 'L0')!;
  await clickPart(page, el, wall.id);
  await expect(el).toHaveAttribute('data-selected', wall.userData.id);
  const floorAt = await el.evaluate((n) => (n as unknown as { toScreen: (p: [number, number, number]) => { x: number; y: number } | null }).toScreen([1.2, 0, 4.4]));
  const box = (await el.boundingBox())!;
  await page.mouse.click(box.x + floorAt!.x, box.y + floorAt!.y);
  await expect(el).toHaveAttribute('data-selected', '');
});

test('removing the element releases its WebGL context', async ({ page }) => {
  test.setTimeout(90_000);
  const el = await openDemo(page);
  const lost = await el.evaluate((n) => {
    const r = (n as unknown as { view: { renderer: { getContext: () => WebGLRenderingContext } } }).view.renderer;
    const before = r.getContext().isContextLost();
    n.remove();
    return { before, after: r.getContext().isContextLost() };
  });
  expect(lost).toEqual({ before: false, after: true });
});
