import { test, expect, type Locator, type Page } from '@playwright/test';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { buildScene, type SceneDescription } from '../src/map/scene-builder';
import { CUTAWAY_HEIGHT_M, ISO_DIR, cutawayIds, quantiseAzimuth } from '../src/map/scene-frame';

// CR-006 slice 1a, the 3D element in headless Chromium (SwiftShader) on the style guide's demo floor: the quality chips
// switch the realisation (level 2: hemisphere + shadow sun, standard materials, the contact occlusion, the cutaway;
// level 1: exactly the phase-4 scene), the choice persists per browser, the frame-budget probe falls back to level 1
// and says so, the isometric preset is a true isometric on an orthographic camera, the cutaway matches the pure
// function and holds the cut height, the thumbnail strip is bounded by the listed levels, and the visual snapshots per
// level and preset are pixel-deterministic and differ between the levels (the committed baselines under
// docs/evidence/T087/visual are unit-plan-3d-determinism.spec.ts's, slice 1c). The probe is disabled (minFps = 0)
// wherever level 2 must stay: SwiftShader has no frame budget to keep.

type Summary = { name: string; type: string; count: number; pos: number[]; shadow: boolean; material: string }[];
interface Probe {
  view: {
    camera: { position: { x: number; y: number; z: number }; isOrthographicCamera?: boolean; isPerspectiveCamera?: boolean; zoom: number };
    controls: { target: { x: number; y: number; z: number } };
    renderer: { shadowMap: { enabled: boolean }; toneMapping: number };
    scene: { traverse: (f: (o: Record<string, unknown>) => void) => void };
    placed: Map<string, { obj: { isInstancedMesh?: boolean; instanceMatrix: { array: ArrayLike<number> }; scale: { y: number } }; index: number }>;
    cutawayNow: () => string[];
    getQuality: () => number;
  };
  description: SceneDescription;
  minFps: number;
  levels: unknown[];
  activeLevel: string | null;
  thumbnailScene: SceneDescription | null;
  thumbnailCount: number;
  capture: () => string | null;
}

/** The mean luminance (0..255) of a PNG data URL's opaque pixels, decoded in the page. */
const luminance = (page: Page, url: string): Promise<number> =>
  page.evaluate(async (src) => {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('bad png')); img.src = src; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      n++;
    }
    return n ? sum / n : 0;
  }, url);

async function openDemo(page: Page): Promise<Locator> {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  return el;
}

/** The scene graph in a comparable form: every object's name, type, instance count, position, shadow flag and material. */
const summarise = (el: Locator): Promise<Summary> =>
  el.evaluate((n) => {
    const out: Summary = [];
    (n as unknown as Probe).view.scene.traverse((o) => {
      const mat = o.material as { type?: string } | undefined;
      const p = o.position as { x: number; y: number; z: number };
      out.push({ name: String(o.name ?? ''), type: String(o.type), count: Number(o.count ?? 0), pos: [p.x, p.y, p.z], shadow: !!o.castShadow, material: mat?.type ?? '' });
    });
    return out;
  });

const disableProbe = (el: Locator) => el.evaluate((n) => { (n as unknown as Probe).minFps = 0; });

test('level 2: hemisphere and shadow sun, standard materials, occlusion; level 1 is the phase-4 scene; the choice persists per browser', async ({ page }) => {
  test.setTimeout(120_000);
  const el = await openDemo(page);
  await expect(el).toHaveAttribute('data-quality', '1'); // the demo has no installation setting: level 1
  const l1 = await summarise(el);
  expect(l1.some((o) => o.type === 'HemisphereLight')).toBe(false);
  expect(l1.some((o) => o.type === 'AmbientLight')).toBe(true);
  expect(l1.filter((o) => o.material).every((o) => o.material === 'MeshLambertMaterial' || o.material === 'SpriteMaterial' || o.material === 'LineBasicMaterial')).toBe(true);
  expect(l1.some((o) => o.name === 'ao')).toBe(false);
  await disableProbe(el);
  await el.locator('[data-quality-2]').click();
  await expect(el).toHaveAttribute('data-quality', '2');
  expect(await page.evaluate(() => localStorage.getItem('sw.plan3d.quality'))).toBe('2');
  const l2 = await summarise(el);
  expect(l2.filter((o) => o.type === 'HemisphereLight')).toHaveLength(1);
  expect(l2.some((o) => o.type === 'AmbientLight')).toBe(false);
  const sun = await el.evaluate((n) => {
    let s: { castShadow: boolean; mapSize: number; type: string } | null = null;
    (n as unknown as Probe).view.scene.traverse((o) => {
      if (o.type === 'DirectionalLight') s = { castShadow: !!o.castShadow, mapSize: ((o.shadow as { mapSize: { x: number } }).mapSize.x), type: String(o.type) };
    });
    return { sun: s, shadows: (n as unknown as Probe).view.renderer.shadowMap.enabled, tone: (n as unknown as Probe).view.renderer.toneMapping };
  });
  expect(sun.shadows).toBe(true);
  expect(sun.sun).toMatchObject({ castShadow: true, mapSize: 2048 });
  expect(sun.tone).not.toBe(0); // ACES (NoToneMapping is 0)
  const lit = l2.filter((o) => o.material && o.material !== 'SpriteMaterial' && o.material !== 'LineBasicMaterial' && o.name !== 'ao');
  expect(lit.length).toBeGreaterThan(5);
  expect(lit.every((o) => o.material === 'MeshStandardMaterial')).toBe(true);
  expect(l2.filter((o) => o.name.startsWith('wall:') || o.name.startsWith('box|map-structure')).every((o) => o.shadow)).toBe(true);
  const ao = l2.find((o) => o.name === 'ao');
  expect(ao, 'one instanced contact-occlusion plane').toBeTruthy();
  const d = buildScene(demoSceneInput('f0')!);
  expect(ao!.count).toBe(d.parts.filter((p) => (p.kind === 'wall' || p.kind === 'object' || p.kind === 'connector') && (p.shape === 'box' || p.shape === 'cylinder') && p.position[1] - p.size[1] / 2 <= 0.5).length);
  // the level-1 material never changes (level 1 stays exactly as it was): switching back gives the phase-4 graph again
  await el.locator('[data-quality-1]').click();
  await expect(el).toHaveAttribute('data-quality', '1');
  const back = await summarise(el);
  expect(back.filter((o) => o.name !== '')).toEqual(l1.filter((o) => o.name !== ''));
  // determinism at level 2: the same description gives the same graph after a round trip
  await el.locator('[data-quality-2]').click();
  await expect(el).toHaveAttribute('data-quality', '2');
  expect(await summarise(el)).toEqual(l2);
  // the choice is the browser's: a reload opens at level 2 (or has fallen back from it - the note says so; either proves
  // the stored choice was read, which is what persistence means here: SwiftShader may or may not keep 30 fps)
  await page.reload();
  const again = await openDemo(page);
  await expect.poll(async () => (await again.getAttribute('data-quality')) === '2' || (await again.locator('[data-3d-fallback]').count()) === 1, { timeout: 10000 }).toBe(true);
});

test('the frame-budget probe: level 2 under the minimum drops to level 1 with a note; choosing level 2 again measures afresh', async ({ page }) => {
  test.setTimeout(120_000);
  const el = await openDemo(page);
  await el.evaluate((n) => { (n as unknown as Probe).minFps = 100000; }); // no device keeps this: the fallback must happen
  await el.locator('[data-quality-2]').click(); // level 2 draws while the probe runs (too briefly to assert under a loaded software renderer)
  await expect(el.locator('[data-3d-fallback]')).toBeAttached({ timeout: 20000 });
  await expect(el).toHaveAttribute('data-quality', '1');
  expect(Number(await el.getAttribute('data-probe-fps'))).toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(() => sessionStorage.getItem('sw.plan3d.fallback'))).toBe('1');
  expect(await page.evaluate(() => localStorage.getItem('sw.plan3d.quality'))).toBe('2'); // the choice stays; the device does not
  await expect(el).not.toHaveAttribute('data-measure', ''); // the probe's continuous frames ended with it
  const summary = await summarise(el);
  expect(summary.some((o) => o.type === 'HemisphereLight')).toBe(false); // level 1 draws
  // the viewer insists: level 2 again, this time with the probe disabled, and the note goes
  await disableProbe(el);
  await el.locator('[data-quality-2]').click();
  await expect(el).toHaveAttribute('data-quality', '2');
  await expect(el.locator('[data-3d-fallback]')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('sw.plan3d.fallback'))).toBeNull();
});

test('the isometric preset is a true isometric on an orthographic camera; the perspective preset is the phase-4 view', async ({ page }) => {
  test.setTimeout(90_000);
  const el = await openDemo(page);
  await expect(el).toHaveAttribute('data-preset', 'iso');
  const iso = await el.evaluate((n) => {
    const v = (n as unknown as Probe).view;
    return { ortho: !!v.camera.isOrthographicCamera, pos: { ...v.camera.position }, target: { ...v.controls.target }, zoom: v.camera.zoom };
  });
  expect(iso.ortho).toBe(true);
  expect(iso.zoom).toBe(1);
  const dir = [iso.pos.x - iso.target.x, iso.pos.y - iso.target.y, iso.pos.z - iso.target.z];
  const len = Math.hypot(...dir);
  expect(dir[0] / len).toBeCloseTo(ISO_DIR[0], 6);
  expect(dir[1] / len).toBeCloseTo(ISO_DIR[1], 6);
  expect(dir[2] / len).toBeCloseTo(ISO_DIR[2], 6);
  const d = buildScene(demoSceneInput('f0')!);
  expect(iso.target.x).toBeCloseTo(d.size[0] / 2, 3); // the plate is the whole plan: its centre
  expect(iso.target.z).toBeCloseTo(d.size[1] / 2, 3);
  await el.locator('[data-preset-persp]').click();
  await expect(el).toHaveAttribute('data-preset', 'persp');
  const persp = await el.evaluate((n) => {
    const v = (n as unknown as Probe).view;
    return { persp: !!v.camera.isPerspectiveCamera, pos: { ...v.camera.position }, target: { ...v.controls.target } };
  });
  expect(persp.persp).toBe(true);
  const pd = [persp.pos.x - persp.target.x, persp.pos.y - persp.target.y, persp.pos.z - persp.target.z];
  expect((Math.asin(pd[1] / Math.hypot(...pd)) * 180) / Math.PI).toBeCloseTo(31, 0); // the 31 deg perspective of phase 4
  await el.locator('[data-preset-iso]').click();
  await expect(el).toHaveAttribute('data-preset', 'iso');
  expect(await el.evaluate((n) => !!(n as unknown as Probe).view.camera.isOrthographicCamera)).toBe(true);
  // a click still lands on the right part through the orthographic camera (the ceiling lamp of room 0: at 2.75 m in
  // the middle of its room, no 3 m wall hides it from the 35 deg isometric; the entity pills go first - on the phone
  // the lock's pill stands over the lamp, as the entity layers switched off would leave the scene)
  await el.evaluate((n) => { const e = n as unknown as { description: SceneDescription }; e.description = { ...e.description, parts: e.description.parts.filter((p) => p.kind !== 'entity') }; });
  const at = await el.evaluate((n) => {
    const e = n as unknown as Probe & { toScreen: (p: [number, number, number]) => { x: number; y: number } | null };
    const w = e.description.parts.find((p) => p.id === 'obj:dl0')!;
    return e.toScreen(w.position);
  });
  const box = (await el.boundingBox())!;
  await page.mouse.click(box.x + at!.x, box.y + at!.y);
  await expect(el).toHaveAttribute('data-selected', 'dl0');
});

test('the cutaway at level 2 matches the pure function for the preset azimuth, holds the cut height, and is empty at level 1 and from a camera', async ({ page }) => {
  test.setTimeout(90_000);
  const el = await openDemo(page);
  expect(await el.evaluate((n) => (n as unknown as Probe).view.cutawayNow())).toEqual([]); // level 1: never
  await disableProbe(el);
  await el.locator('[data-quality-2]').click();
  await expect(el).toHaveAttribute('data-quality', '2');
  const d = buildScene(demoSceneInput('f0')!);
  const expected = cutawayIds(d, quantiseAzimuth(45)); // the isometric preset looks from the +x +z corner (its bin centre is 45)
  expect(expected.length).toBeGreaterThan(0);
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.cutawayNow())).toEqual(expected);
  const heights = await el.evaluate((n, ids) => {
    const v = (n as unknown as Probe).view;
    return ids.map((id) => {
      const pl = v.placed.get(id)!;
      if (pl.obj.isInstancedMesh) {
        const a = pl.obj.instanceMatrix.array;
        const o = pl.index * 16;
        // the scale y of a YXZ box with no pitch is the length of the matrix's second column
        return Math.hypot(a[o + 4], a[o + 5], a[o + 6]);
      }
      return pl.obj.scale.y;
    });
  }, expected.filter((id) => id.startsWith('wall:')));
  for (const h of heights) expect(h).toBeCloseTo(CUTAWAY_HEIGHT_M, 4);
  // an opening part above the cut (a lintel at 2.1 m) is hidden on every axis and parked under the floor - no thin
  // bar floats over the wall, no shadow, no click
  const hidden = await el.evaluate((n, ids) => {
    const v = (n as unknown as Probe).view;
    return ids.map((id) => {
      const pl = v.placed.get(id)!;
      const a = pl.obj.instanceMatrix.array;
      const o = pl.index * 16;
      return { sx: Math.hypot(a[o], a[o + 1], a[o + 2]), sy: Math.hypot(a[o + 4], a[o + 5], a[o + 6]), sz: Math.hypot(a[o + 8], a[o + 9], a[o + 10]), y: a[o + 13] };
    });
  }, expected.filter((id) => id.startsWith('lintel:')));
  expect(hidden.length).toBeGreaterThan(0);
  for (const h of hidden) {
    expect(h.sx).toBeLessThan(1e-3);
    expect(h.sy).toBeLessThan(1e-3);
    expect(h.sz).toBeLessThan(1e-3);
    expect(h.y).toBeLessThan(0);
  }
  const caps = (await summarise(el)).find((o) => o.name === 'caps');
  expect(caps, 'the dark section caps on the cut walls').toBeTruthy();
  expect(caps!.count).toBe(expected.filter((id) => id.startsWith('wall:')).length);
  expect(caps!.material).toBe('MeshStandardMaterial');
  // the selection outline of a cut wall is the kept box, not the full wall
  const cutWall = expected.find((id) => id.startsWith('wall:'))!;
  const outline = await el.evaluate((n, id) => {
    const e = n as unknown as Probe & { selectedId: string | null; view: { outline: { children: { scale: { y: number } }[] } | null } };
    e.selectedId = e.description.parts.find((p) => p.id === id)!.userData.id;
    return new Promise<number[]>((res) => setTimeout(() => res(e.view.outline!.children.map((c) => c.scale.y)), 50));
  }, cutWall);
  expect(outline.length).toBeGreaterThan(0);
  expect(Math.min(...outline)).toBeLessThan(CUTAWAY_HEIGHT_M * 1.06 + 0.06); // at least the cut segment is outlined short
  await el.evaluate((n) => { (n as unknown as { selectedId: string | null }).selectedId = null; });
  // applying twice gives the same set (a second frame with the same camera changes nothing)
  await el.locator('[data-preset-iso]').click();
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.cutawayNow())).toEqual(expected);
  // from a camera body nothing is cut; back at the top preset (straight above) nothing either
  await el.locator('[data-preset-camera]').selectOption('cam-1');
  await expect(el).toHaveAttribute('data-preset', 'camera');
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.cutawayNow())).toEqual([]);
  await el.locator('[data-preset-top]').click();
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.cutawayNow())).toEqual([]);
  await el.locator('[data-preset-persp]').click();
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.cutawayNow())).toEqual(expected); // the same azimuth as the iso preset
  await el.locator('[data-quality-1]').click();
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.cutawayNow())).toEqual([]);
});

test('the thumbnail strip: one isometric per listed level, cached and bounded by the list, a click selects the level', async ({ page }) => {
  test.setTimeout(90_000);
  const el = await openDemo(page);
  await expect(el.locator('[data-3d-strip]')).toHaveCount(0); // the demo floor has one level: no strip
  const set = (levels: { id: string; name: string; elevation_m: number }[]) =>
    el.evaluate((n, lv) => {
      const e = n as unknown as Probe;
      const base = e.description;
      e.thumbnailScene = { ...base, levels: [...base.levels, ...lv.filter((l) => l.id !== 'L0').map((l) => ({ id: l.id, elevation_m: l.elevation_m, ceiling_height_m: 2.8 }))] };
      e.levels = lv;
    }, levels);
  await set([{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'ראשונה', elevation_m: 3.2 }, { id: 'L2', name: 'שנייה', elevation_m: 6.4 }]);
  const thumbs = el.locator('[data-3d-thumb]');
  await expect(thumbs).toHaveCount(3);
  await expect(thumbs.first()).toHaveAttribute('data-3d-thumb', 'L2'); // highest first, like the level chips
  const srcs = await thumbs.locator('img').evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src));
  expect(srcs.every((s) => s.startsWith('data:image/png;base64,'))).toBe(true);
  expect(srcs[2].length).toBeGreaterThan(srcs[0].length); // L0 holds the demo rooms; L2 is an empty plate-less level
  expect(await el.evaluate((n) => (n as unknown as Probe).thumbnailCount)).toBe(3);
  // the thumbnail is drawn through the canvas, so the output colour space and the tone mapping apply: its mean
  // luminance is within a tolerance of the main view's for the same preset (a render target reads back linear and
  // came out near-black - the review's finding), at both levels
  for (const level of ['1', '2'] as const) {
    await disableProbe(el);
    await el.locator(`[data-quality-${level}]`).click();
    await expect(el).toHaveAttribute('data-quality', level);
    await el.locator('[data-preset-iso]').click();
    await expect.poll(async () => (await thumbs.nth(2).locator('img').getAttribute('src'))?.length ?? 0).toBeGreaterThan(200);
    const thumb = await luminance(page, (await thumbs.nth(2).locator('img').getAttribute('src'))!);
    const main = await luminance(page, (await el.evaluate((n) => (n as unknown as Probe).capture()))!);
    console.log(`thumbnail luminance level ${level}: thumb=${thumb.toFixed(1)} main=${main.toFixed(1)}`);
    expect(thumb).toBeGreaterThan(60); // not near-black
    expect(thumb / main).toBeGreaterThan(0.7);
    expect(thumb / main).toBeLessThan(1.4);
  }
  await el.locator('[data-quality-1]').click();
  await expect(el).toHaveAttribute('data-quality', '1');
  // the same level again from an equal description draws the same picture (deterministic)
  await el.evaluate((n) => { const e = n as unknown as Probe; e.thumbnailScene = { ...e.thumbnailScene! }; });
  await expect.poll(() => thumbs.nth(2).locator('img').getAttribute('src')).toBe(srcs[2]);
  // fewer levels listed: the cache shrinks to them (keepIsos, the building page's bound)
  await set([{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'ראשונה', elevation_m: 3.2 }]);
  await expect(thumbs).toHaveCount(2);
  // set() hands over a new thumbnail description, so the cache empties at once and refills in the next animation frame
  // (scheduleThumbs): poll for it - a single read right after the buttons appear raced that frame (0 on the mobile project)
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).thumbnailCount)).toBe(2);
  // a click reports the level; the active one reads as pressed; clicking it again asks for every level
  const picked: (string | null)[] = [];
  await page.exposeFunction('__picked', (id: string | null) => picked.push(id));
  await el.evaluate((n) => n.addEventListener('level-select', (e) => (window as unknown as { __picked: (id: string | null) => void }).__picked((e as CustomEvent<{ id: string | null }>).detail.id)));
  await thumbs.nth(1).click();
  await expect.poll(() => picked).toEqual(['L0']);
  await el.evaluate((n) => { (n as unknown as Probe).activeLevel = 'L0'; });
  await expect(thumbs.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(thumbs.nth(0)).toHaveAttribute('aria-pressed', 'false');
  await thumbs.nth(1).click();
  await expect.poll(() => picked).toEqual(['L0', null]);
});

test('visual snapshots per level and preset: pixel-deterministic, and the levels differ', async ({ page }) => {
  test.setTimeout(180_000);
  const el = await openDemo(page);
  await disableProbe(el);
  const shots: Record<string, string> = {};
  for (const level of ['1', '2'] as const) {
    await el.locator(`[data-quality-${level}]`).click();
    await expect(el).toHaveAttribute('data-quality', level);
    for (const preset of ['iso', 'persp', 'top'] as const) {
      await el.locator(`[data-preset-${preset}]`).click();
      await expect(el).toHaveAttribute('data-preset', preset);
      await page.waitForTimeout(300); // the damping settles (the presets set the camera directly; this is for the outline pass)
      const first = (await el.evaluate((n) => (n as unknown as Probe).capture()))!;
      const second = (await el.evaluate((n) => (n as unknown as Probe).capture()))!;
      expect(first.startsWith('data:image/png;base64,')).toBe(true);
      expect(second, `${preset} at level ${level} draws the same pixels twice`).toBe(first);
      shots[`${level}-${preset}`] = first;
    }
    await el.locator('[data-preset-iso]').click();
  }
  for (const preset of ['iso', 'persp', 'top']) expect(shots[`1-${preset}`], `${preset}: level 2 looks different from level 1`).not.toBe(shots[`2-${preset}`]);
  expect(shots['2-iso']).not.toBe(shots['2-persp']);
  expect(shots['2-iso']).not.toBe(shots['2-top']);
  // the controls follow the element: the bar sits at the bottom start, the strip (when shown) at the top start
  const bar = (await el.locator('[data-3d-bar]').boundingBox())!;
  const box = (await el.boundingBox())!;
  expect(bar.y + bar.height).toBeLessThanOrEqual(box.y + box.height);
  expect(bar.x).toBeGreaterThanOrEqual(box.x);
  await expect(el.locator('[data-quality-2]')).toBeVisible();
  await expect(el.locator('[data-preset-persp]')).toBeVisible();
});
