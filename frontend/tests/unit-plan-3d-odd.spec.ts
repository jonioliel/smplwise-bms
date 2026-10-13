import { test, expect, type Locator, type Page } from '@playwright/test';
import { buildScene, type SceneDescription } from '../src/map/scene-builder';
import { houseInput, houseLabels } from './lookdev/house';

/*
 * Plan Studio 6, the five oddities the 2.4.10 integrator saw in the level-3 pictures (docs/release/2.4.10-INTEGRATION-NOTES.md,
 * "Studio 6 before / after"), asserted on the real element with the look-dev house (tests/lookdev/house.ts) in headless
 * Chromium. Counts, materials and DOM geometry, never pixels.
 *
 * 1 + 2: the camera cones (a prism from the floor to the camera's mount, a level-2 illustration kept at level 3) are cut by the
 *        section plane like the walls - they rose above the cut and showed as translucent "ghost" volumes past the walls in
 *        the orbit views and as white wisps over the wall tops. Each cone owns its material; the cut follows the dials, a
 *        camera preset and the walk (no cut), and levels 1-2 never clip.
 * 3:     two entity pills never cover one another (pill-layout.ts): on the phone's 390 px stage and on a desk.
 * 4:     the look-dev house hangs nothing over a window (unit-lookdev-house.spec.ts, node-only).
 * 5:     the glTF export control is a surfaced button like its neighbours (a ghost control over the picture was unreadable
 *        where the ground plate's shadow lay behind it) and the bar's controls never overlap at 1440 / 1024 / 390 px.
 */
interface Probe {
  view: {
    scene: { traverse: (f: (o: Record<string, unknown>) => void) => void };
    realPending: number;
    postPasses: string[];
    postClip: number[] | null;
    getRealSettings: () => { rung: string; style: string; sectionCut: boolean };
    setRealSettings: (s: Record<string, unknown>) => void;
  };
  description: SceneDescription | null;
  minFps: number;
  walkable: boolean;
  cameras: { id: string; label: string }[];
  levels: { id: string; name: string; elevation_m: number }[];
  activeLevel: string | null;
  labels: Record<string, string>;
  timeManual: { hour: number; ymd: [number, number, number] } | null;
  applySun: () => void;
  startWalk: (s: unknown) => void;
  stopWalk: (n: boolean) => void;
}

async function openDemo(page: Page): Promise<Locator> {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  await el.evaluate((n) => {
    const s = (n as HTMLElement).style;
    s.position = 'fixed';
    s.inset = '0';
    s.inlineSize = '100vw';
    s.blockSize = '100vh';
    s.zIndex = '1000';
    (n as unknown as Probe).minFps = 0;
  });
  return el;
}

async function showHouse(el: Locator, rung: 'lite' | 'realistic', level: string | null, hour = 13, walk = false): Promise<SceneDescription> {
  const desc = buildScene(houseInput({ level, walk, realistic: true }));
  await el.locator(rung === 'lite' ? '[data-quality-3-lite]' : '[data-quality-3]').click();
  await expect(el).toHaveAttribute('data-rung', rung);
  await expect.poll(() => el.evaluate((n) => !!(n as unknown as Probe).description?.real), { timeout: 30000 }).toBe(true);
  await el.evaluate((n, a) => {
    const e = n as unknown as Probe;
    e.walkable = true;
    e.cameras = [{ id: 'cam-hall', label: 'מצלמה · כניסה' }, { id: 'cam-living', label: 'מצלמה · סלון' }];
    e.levels =[{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 2.9 }];
    e.activeLevel = a.level;
    e.labels = a.labels;
    e.description = a.desc;
    e.timeManual = { hour: a.hour, ymd: [2026, 10, 13] };
    e.applySun();
  }, { desc, level, hour, labels: houseLabels() });
  await expect(el).toHaveAttribute('data-parts', String(desc.parts.length));
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 180_000 }).toBe(0);
  return desc;
}

/** The style guide hands its own demo (description, cameras) back to the element whenever it re-renders (a realistic-change
 * event, a level change): the house is handed again and waited for before a step that depends on it. */
async function holdHouse(el: Locator, desc: SceneDescription): Promise<void> {
  await el.evaluate((n, a) => {
    const e = n as unknown as Probe;
    e.cameras = [{ id: 'cam-hall', label: 'מצלמה · כניסה' }, { id: 'cam-living', label: 'מצלמה · סלון' }];
    e.description = a.desc;
  }, { desc });
  await expect(el).toHaveAttribute('data-parts', String(desc.parts.length));
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 180_000 }).toBe(0);
}

/** The cone meshes of the graph: their clipping planes (constants) and whether two cones share one material. */
const cones = (el: Locator) =>
  el.evaluate((n) => {
    const out: { name: string; planes: number[] | null; mat: number }[] = [];
    const mats: unknown[] = [];
    (n as unknown as Probe).view.scene.traverse((o) => {
      const name = String(o.name ?? '');
      if (!name.endsWith('#cone')) return;
      const m = o.material as { clippingPlanes: { constant: number }[] | null };
      let i = mats.indexOf(m);
      if (i < 0) i = mats.push(m) - 1;
      out.push({ name, planes: m.clippingPlanes ? m.clippingPlanes.map((p) => Math.round(p.constant * 1000) / 1000) : null, mat: i });
    });
    return out.sort((a, b) => (a.name < b.name ? -1 : 1));
  });

test('1+2: at level 3 the camera cones are cut by the section plane, like the walls; a camera preset, the walk and the dial lift it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop project');
  test.setTimeout(300_000);
  const el = await openDemo(page);
  const desc = await showHouse(el, 'lite', 'L0');
  expect(desc.parts.filter((p) => p.kind === 'cone').map((p) => p.id)).toEqual(['cam:cam-hall#cone', 'cam:cam-living#cone']);
  await el.locator('[data-preset-iso]').click();
  await expect(el).toHaveAttribute('data-preset', 'iso');
  // the cut of LOOK_SPEC section 5: 0.6 x the ceiling of the top shown level (the ground floor: 2.8 m) = 1.68 m
  let c = await cones(el);
  expect(c.map((x) => x.name)).toEqual(['cam:cam-hall#cone', 'cam:cam-living#cone']);
  expect(c.map((x) => x.planes)).toEqual([[1.68], [1.68]]);
  expect(new Set(c.map((x) => x.mat)).size).toBe(2); // each cone owns its material (the shared accent material is not clipped)
  // the dial off: nothing cut, the cones included
  await el.evaluate((n) => (n as unknown as Probe).view.setRealSettings({ sectionCut: false }));
  c = await cones(el);
  expect(c.map((x) => x.planes)).toEqual([null, null]);
  await el.evaluate((n) => (n as unknown as Probe).view.setRealSettings({ sectionCut: true }));
  expect((await cones(el)).map((x) => x.planes)).toEqual([[1.68], [1.68]]);
  // a camera preset never cuts
  await holdHouse(el, desc);
  await el.locator('[data-preset-camera]').selectOption('cam-hall');
  await expect(el).toHaveAttribute('data-preset', 'camera');
  expect((await cones(el)).map((x) => x.planes)).toEqual([null, null]);
  await el.locator('[data-preset-top]').click();
  await expect(el).toHaveAttribute('data-preset', 'top');
  expect((await cones(el)).map((x) => x.planes)).toEqual([[1.68], [1.68]]);
  // the realistic rung's GTAO normal / depth pass is cut with the walls too (the "wisps": the occlusion of the full-height
  // walls composited over the sky), and lifted with them
  await el.locator('[data-quality-3]').click();
  await expect(el).toHaveAttribute('data-rung', 'realistic');
  await holdHouse(el, desc);
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.postPasses), { timeout: 60000 }).toContain('gtao');
  await expect.poll(() => el.evaluate((n) => JSON.stringify((n as unknown as Probe).view.postClip)), { timeout: 120_000 }).toBe('[1.68]');
  await el.evaluate((n) => (n as unknown as Probe).view.setRealSettings({ sectionCut: false }));
  await expect.poll(() => el.evaluate((n) => JSON.stringify((n as unknown as Probe).view.postClip)), { timeout: 120_000 }).toBe('null');
  await el.evaluate((n) => (n as unknown as Probe).view.setRealSettings({ sectionCut: true }));
  await expect.poll(() => el.evaluate((n) => JSON.stringify((n as unknown as Probe).view.postClip)), { timeout: 120_000 }).toBe('[1.68]');
  await el.locator('[data-quality-3-lite]').click();
  await expect(el).toHaveAttribute('data-rung', 'lite');
  // levels 1-2 never clip (their pictures do not move)
  await el.locator('[data-quality-2]').click();
  await expect(el).toHaveAttribute('data-quality', '2');
  await holdHouse(el, buildScene(houseInput({ level: 'L0', walk: false, realistic: false })));
  c = await cones(el);
  expect(c.length).toBe(2);
  expect(c.every((x) => !x.planes || x.planes.length === 0)).toBe(true);
});

/** The visible pills' rectangles in stage pixels. */
const pillRects = (el: Locator) =>
  el.evaluate((n) => {
    const host = n.getBoundingClientRect();
    return [...(n.shadowRoot as ShadowRoot).querySelectorAll<HTMLElement>('[data-3d-label]')]
      .filter((e) => e.style.display !== 'none')
      .map((e) => { const r = e.getBoundingClientRect(); return { id: e.getAttribute('data-3d-label') ?? '', l: r.left - host.left, t: r.top - host.top, r: r.right - host.left, b: r.bottom - host.top }; });
  });
const overlaps = (a: { l: number; t: number; r: number; b: number }, b: { l: number; t: number; r: number; b: number }) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

for (const project of ['mobile', 'desktop'] as const) {
  test(`3: no two entity pills cover one another (${project})`, async ({ page }, info) => {
    test.skip(info.project.name !== project, `${project} project`);
    test.setTimeout(300_000);
    const el = await openDemo(page);
    await showHouse(el, 'lite', 'L0', 21);
    await el.locator('[data-preset-iso]').click();
    await expect(el).toHaveAttribute('data-preset', 'iso');
    await page.waitForTimeout(1200);
    const rects = await pillRects(el);
    // the phone keeps the four alerting pills under its cap (R3 G8); a desk shows every ground-floor entity (ten)
    expect(rects.length).toBe(project === 'mobile' ? 4 : 10);
    const pairs: string[] = [];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (overlaps(rects[i], rects[j])) pairs.push(`${rects[i].id} / ${rects[j].id}`);
    expect(pairs).toEqual([]);
    if (project === 'mobile') {
      // the pair the integrator saw: the kitchen door and the terrace shutter, both alerting, both kept by the cap
      expect(rects.map((r) => r.id)).toEqual(expect.arrayContaining(['binary_sensor.kitchen_door', 'cover.living_terrace']));
    }
  });
}

/** The bar's controls (chips, the camera select, the export button) as rectangles. */
const barRects = (el: Locator) =>
  el.evaluate((n) => {
    const bar = (n.shadowRoot as ShadowRoot).querySelector('.bar')!;
    return [...bar.children].filter((c) => c.tagName !== 'SPAN').map((c) => { const r = c.getBoundingClientRect(); return { id: [...c.attributes].map((a) => a.name).find((a) => a.startsWith('data-')) ?? c.tagName, l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  });

for (const project of ['desktop', 'tablet', 'mobile'] as const) {
  test(`5: the bar's controls never overlap and the export control has a surface (${project})`, async ({ page }, info) => {
    test.skip(info.project.name !== project, `${project} project`);
    test.setTimeout(300_000);
    const el = await openDemo(page);
    await showHouse(el, 'lite', 'L0');
    await el.locator('[data-preset-iso]').click();
    await expect(el).toHaveAttribute('data-preset', 'iso');
    const rects = await barRects(el);
    expect(rects.map((r) => r.id)).toEqual(expect.arrayContaining(['data-walk-btn', 'data-export-gltf', 'data-quality-3']));
    const pairs: string[] = [];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (overlaps(rects[i], rects[j])) pairs.push(`${rects[i].id} / ${rects[j].id}`);
    expect(pairs).toEqual([]);
    const btn = el.locator('[data-export-gltf]');
    await expect(btn).not.toHaveAttribute('variant', 'ghost');
    const style = await btn.locator('button').evaluate((b) => { const s = getComputedStyle(b); return { bg: s.backgroundColor, border: s.borderTopColor }; });
    expect(style.bg).not.toMatch(/rgba\(\d+, \d+, \d+, 0\)|transparent/);
    expect(style.border).not.toMatch(/rgba\(\d+, \d+, \d+, 0\)|transparent/);
  });
}
