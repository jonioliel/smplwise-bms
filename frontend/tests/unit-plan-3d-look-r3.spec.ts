import { test, expect, type Locator, type Page } from '@playwright/test';
import { buildScene, type SceneDescription } from '../src/map/scene-builder';
import { houseInput } from './lookdev/house';

/*
 * Plan Studio 6 look-dev round 3 (docs/design/studio6/ROUND3_CRITIQUE.md): the regressions behind the ten gaps, asserted on
 * the realised level-3 graph in headless Chromium (SwiftShader) with the synthetic two-floor building of tests/lookdev/house.ts
 * handed to the style guide's element. Counts and geometry, never pixels (the Linux pixel baselines are separate).
 *
 * - G1: the merged structure's normals are unit vectors on the world axes (the round-2 port skewed them by the part's position).
 * - G3: the ground disc of the realistic rung faces up (a zero-height box faced down).
 * - G2: at level 3 the lit plate is not drawn, the presence plate and ring are thinned, the open-door frame is an emitter in the
 *   style's colour and follows a style switch.
 * - G4: every room has a ceiling plate facing down at its ceiling height (the walk sees a ceiling; the cut removes it).
 * - G10: on a phone-wide stage the realistic level caps the entity pills at eight and says how many it hid.
 */
interface Probe {
  view: {
    scene: { traverse: (f: (o: Record<string, unknown>) => void) => void };
    realPending: number;
    getRealSettings: () => { rung: string; style: string };
    setRealSettings: (s: Record<string, unknown>) => void;
  };
  description: SceneDescription | null;
  minFps: number;
  themeForce: 'light' | 'dark' | null;
  activeLevel: string | null;
  setTimeHour: (h: number) => void;
}

async function openDemo(page: Page): Promise<Locator> {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  await el.evaluate((n) => { (n as unknown as Probe).minFps = 0; });
  return el;
}

async function showHouse(el: Locator, rung: 'lite' | 'realistic', level: string | null): Promise<SceneDescription> {
  const desc = buildScene(houseInput({ level, walk: false, realistic: true }));
  await el.locator(rung === 'lite' ? '[data-quality-3-lite]' : '[data-quality-3]').click();
  await expect(el).toHaveAttribute('data-rung', rung);
  await expect.poll(() => el.evaluate((n) => !!(n as unknown as Probe).description?.real), { timeout: 30000 }).toBe(true);
  await el.evaluate((n, a) => { const e = n as unknown as Probe; e.activeLevel = a.level; e.description = a.desc; e.setTimeHour(13); }, { desc, level });
  await expect(el).toHaveAttribute('data-parts', String(desc.parts.length));
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 180_000 }).toBe(0);
  return desc;
}

/** The unique rounded normals of a mesh's geometry and its vertex ys. */
const normalsOf = (el: Locator, name: string) =>
  el.evaluate((n, nm) => {
    const out: { normals: string[]; ys: number[]; unit: boolean } = { normals: [], ys: [], unit: true };
    (n as unknown as Probe).view.scene.traverse((o) => {
      if (String(o.name) !== nm) return;
      const g = o.geometry as { getAttribute: (k: string) => { count: number; getX: (i: number) => number; getY: (i: number) => number; getZ: (i: number) => number } };
      const nr = g.getAttribute('normal');
      const ps = g.getAttribute('position');
      const seen = new Set<string>();
      for (let i = 0; i < nr.count; i++) {
        const x = nr.getX(i), y = nr.getY(i), z = nr.getZ(i);
        if (Math.abs(Math.hypot(x, y, z) - 1) > 1e-3) out.unit = false;
        seen.add([x, y, z].map((v) => Math.round(v * 100) / 100).join(','));
        if (i % 50 === 0) out.ys.push(Math.round(ps.getY(i) * 1000) / 1000);
      }
      out.normals = [...seen].sort();
    });
    return out;
  }, name);

const materialsOf = (el: Locator, prefix: string) =>
  el.evaluate((n, pre) => {
    const out: { name: string; opacity: number; color: string; emissive: string; emissiveIntensity: number }[] = [];
    (n as unknown as Probe).view.scene.traverse((o) => {
      if (!String(o.name).startsWith(pre)) return;
      const m = o.material as { opacity: number; color: { getHexString: () => string }; emissive?: { getHexString: () => string }; emissiveIntensity?: number };
      out.push({ name: String(o.name), opacity: m.opacity, color: m.color.getHexString(), emissive: m.emissive?.getHexString() ?? '', emissiveIntensity: m.emissiveIntensity ?? 0 });
    });
    return out.sort((a, b) => (a.name < b.name ? -1 : 1));
  }, prefix);

test('G1 / G4: the merged walls carry axis-aligned unit normals; every room has a ceiling plate facing down at its height', async ({ page }) => {
  test.setTimeout(300_000);
  const el = await openDemo(page);
  const desc = await showHouse(el, 'lite', 'L0');
  const walls = await normalsOf(el, 'merged|L0|plaster_white|std');
  expect(walls.unit).toBe(true);
  // interior walls run along x and z: their long faces look along +-z and +-x, their tops up; nothing in between
  for (const want of ['1,0,0', '-1,0,0', '0,0,1', '0,0,-1', '0,1,0']) expect(walls.normals, want).toContain(want);
  expect(walls.normals.every((s) => s.split(',').filter((v) => v !== '0').length === 1), `only axis normals: ${walls.normals.join(' ')}`).toBe(true);
  // the ceilings: one per room of the level, at the level's ceiling height, drawn in the ceiling bucket with -y normals
  const ceilings = desc.real!.ceilings!.filter((c) => c.level_id === 'L0');
  expect(ceilings.length).toBe(desc.real!.floors.filter((f) => f.level_id === 'L0').length);
  for (const c of ceilings) expect(c.y).toBeCloseTo(2.8, 4);
  const ceil = await normalsOf(el, 'merged|L0|plaster_ceiling|std');
  expect(ceil.normals).toContain('0,-1,0');
  expect(ceil.ys.some((y) => Math.abs(y - 2.794) < 0.01), 'vertices at the ceiling height').toBe(true);
});

test('G2 / G3: no lit plate at level 3, thinned presence plates, an emissive open-door frame in the style colour; the ground disc faces up', async ({ page }) => {
  test.setTimeout(300_000);
  const el = await openDemo(page);
  const desc = await showHouse(el, 'realistic', 'L0');
  const litIds = desc.parts.filter((p) => p.kind === 'tint' && p.id.endsWith('#lit')).map((p) => p.id);
  expect(litIds.length).toBeGreaterThan(0);
  const tints = await materialsOf(el, 'room:');
  expect(tints.filter((t) => t.name.endsWith('#lit'))).toEqual([]);
  const plate = desc.parts.find((p) => p.id === 'room:r-living#presence-ring')!;
  const drawn = tints.find((t) => t.name === 'room:r-living#presence-ring')!;
  expect(drawn.opacity).toBeCloseTo(Math.round(plate.opacity * 0.45 * 1e4) / 1e4, 4);
  expect(drawn.color).toBe('2767ed'); // the light style's presence colour
  const office = tints.find((t) => t.name === 'room:r-office#presence')!;
  const officePart = desc.parts.find((p) => p.id === 'room:r-office#presence')!;
  expect(office.opacity, `office plate ${JSON.stringify(tints)}`).toBeCloseTo(Math.round(officePart.opacity * 0.35 * 1e4) / 1e4, 4);
  // the open-door frames are instanced per (shape, token, opacity): the group's mesh carries the token in its name
  const frames = await materialsOf(el, 'box|danger|');
  expect(frames.length).toBeGreaterThan(0);
  for (const f of frames) {
    expect(f.color).toBe('e4463c');
    expect(f.emissive).toBe('e4463c');
    expect(f.emissiveIntensity).toBeCloseTo(0.9, 4);
  }
  // a style switch re-tints the state materials without a rebuild
  await el.evaluate((n) => { (n as unknown as Probe).themeForce = 'dark'; });
  // (a realistic frame takes seconds on SwiftShader at 390 px: the element's update lands when the frame is done)
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.getRealSettings().style), { timeout: 90_000 }).toBe('dark');
  await expect.poll(async () => (await materialsOf(el, 'box|danger|'))[0]?.color, { timeout: 60_000 }).toBe('ff6b62');
  expect((await materialsOf(el, 'room:')).find((t) => t.name === 'room:r-living#presence-ring')!.color).toBe('38bdf8');
  const disc = await normalsOf(el, 'ground');
  expect(disc.normals).toEqual(['0,1,0']);
});

test('G10: a phone-wide stage caps the realistic level at eight pills and counts the rest', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'the phone rule');
  test.setTimeout(300_000);
  const el = await openDemo(page);
  await el.evaluate((n) => { const s = (n as HTMLElement).style; s.position = 'fixed'; s.inset = '0'; s.inlineSize = '100vw'; s.blockSize = '100vh'; s.zIndex = '1000'; });
  const desc = await showHouse(el, 'lite', 'L0');
  const pills = desc.parts.filter((p) => p.kind === 'entity' && p.level_id === 'L0');
  expect(pills.length).toBeGreaterThan(8);
  const alerting = pills.filter((p) => p.color !== 'text-3').length;
  await expect(el.locator('[data-3d-more]')).toHaveAttribute('data-3d-more', String(pills.length - alerting));
  await expect(el.locator('[data-3d-label]')).toHaveCount(alerting);
});
