import { test, expect, type Locator, type Page } from '@playwright/test';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { buildScene, type SceneDescription, type SceneInput } from '../src/map/scene-builder';

// CR-029 S1 / S2 (section 8, ST7 build plan 5.2) in headless Chromium (SwiftShader) on the style guide's demo floor: the
// realistic level is additive (level 2 after a round trip is the same graph), the rungs carry their post chains in the
// lazy chunk, the realised level-3 graph is deterministic after a full rebuild, the time of day moves the sun and the
// same hour gives the same graph, a style switch re-tints without a rebuild, a door animation ends in the state a cold
// build draws, and a chosen rung is never lowered by the probe (owner 2026-10-10). The draw calls and triangles per rung
// are logged for the perf report (counts, not milliseconds: SwiftShader).
type Node = Record<string, unknown>;
interface Probe {
  view: {
    scene: { traverse: (f: (o: Node) => void) => void; environment: unknown };
    renderer: { toneMapping: number; localClippingEnabled: boolean; shadowMap: { enabled: boolean } };
    buildCount: number;
    realPending: number;
    postPasses: string[];
    lastFrameInfo: { calls: number; triangles: number };
    realStats: Record<string, number> | null;
    getRealSettings: () => { rung: string; style: string };
    setRealSettings: (s: Record<string, unknown>) => void;
    sunState: () => { elevation: number; azimuth: number; night: number } | null;
    redrawNow: () => void;
  };
  description: SceneDescription;
  minFps: number;
  setTimeHour: (h: number) => void;
  timeNow: () => void;
  site: { latitude: number; longitude: number; zone: string; source: string; known: boolean };
  setSite: (location: unknown) => void;
  capture: () => string | null;
}

async function openDemo(page: Page): Promise<Locator> {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  await el.evaluate((n) => { (n as unknown as Probe).minFps = 0; });
  return el;
}
/** Level 3 at a rung, with its assets (textures, models, post chunk) loaded and a fixed hour. */
async function realistic(el: Locator, page: Page, rung: 'lite' | 'realistic'): Promise<void> {
  await el.locator(rung === 'lite' ? '[data-quality-3-lite]' : '[data-quality-3]').click();
  await expect(el).toHaveAttribute('data-quality', '3');
  await expect(el).toHaveAttribute('data-rung', rung);
  await expect.poll(() => el.evaluate((n) => !!(n as unknown as Probe).description.real), { timeout: 20000 }).toBe(true);
  await el.evaluate((n) => (n as unknown as Probe).setTimeHour(13));
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 90000 }).toBe(0);
  await page.waitForTimeout(400);
}
const graph = (el: Locator): Promise<Node[]> =>
  el.evaluate((n) => {
    const out: Node[] = [];
    (n as unknown as Probe).view.scene.traverse((o) => {
      const mat = o.material as { type?: string; color?: { getHex: () => number }; opacity?: number; roughness?: number; emissiveIntensity?: number } | undefined;
      const im = o.instanceMatrix as { array: ArrayLike<number> } | undefined;
      const light = o as { intensity?: number };
      const g = (o.geometry as { attributes?: { position?: { count: number } } } | undefined)?.attributes?.position?.count ?? 0;
      out.push({ name: String(o.name ?? ''), type: String(o.type), count: Number(o.count ?? 0), visible: o.visible !== false, vertices: g,
        position: (o.position as { toArray: () => number[] }).toArray().map((v) => Math.round(v * 1e5) / 1e5), quaternion: (o.quaternion as { toArray: () => number[] }).toArray().map((v) => Math.round(v * 1e5) / 1e5),
        matrices: im ? Array.from(im.array).map((v) => Math.round(v * 1e5) / 1e5) : null, cast: !!o.castShadow,
        material: mat ? { type: mat.type, color: mat.color?.getHex(), opacity: mat.opacity, roughness: mat.roughness, emissive: mat.emissiveIntensity } : null,
        light: light.intensity !== undefined ? Math.round(light.intensity * 1e4) / 1e4 : null });
    });
    return out;
  });
const setDescription = (el: Locator, d: SceneDescription) => el.evaluate((n, desc) => { (n as unknown as Probe).description = desc; }, d);
const frameInfo = (el: Locator) => el.evaluate((n) => { const v = (n as unknown as Probe).view; v.redrawNow(); return { ...v.lastFrameInfo, stats: v.realStats, passes: v.postPasses }; });

test('level 3 is additive and carries its rungs: lite and realistic post chains, Neutral tone mapping, the cut, the counts per rung', async ({ page }) => {
  test.setTimeout(300_000);
  const el = await openDemo(page);
  await el.locator('[data-quality-2]').click();
  await expect(el).toHaveAttribute('data-quality', '2');
  await page.waitForTimeout(300);
  const l2 = await graph(el);
  await realistic(el, page, 'lite');
  const lite = await el.evaluate((n) => { const v = (n as unknown as Probe).view; return { tone: v.renderer.toneMapping, clip: v.renderer.localClippingEnabled, env: !!v.scene.environment }; });
  expect(lite.tone).toBe(7); // NeutralToneMapping
  expect(lite.clip).toBe(true);
  expect(lite.env).toBe(true);
  const names = (await graph(el)).map((o) => String(o.name));
  for (const want of ['sky', 'ground', 'horizon', 'ao-strips', 'ao-blobs', 'caps|L0']) expect(names, want).toContain(want);
  expect(names.some((n) => n.startsWith('merged|L0|plaster_white'))).toBe(true);
  expect(names.some((n) => n.startsWith('door:do0|leaf'))).toBe(true);
  for (const preset of ['iso', 'persp', 'top'] as const) {
    await el.locator(`[data-preset-${preset}]`).click();
    await page.waitForTimeout(300);
    const f = await frameInfo(el);
    console.log(`perf lite ${preset}: ${f.calls} draw calls, ${f.triangles} triangles, passes ${f.passes.join(' > ')}, ${JSON.stringify(f.stats)}`);
    expect(f.passes).toEqual(['render-msaa2', 'bloom', 'output']);
    expect(f.calls).toBeLessThanOrEqual(150); // LOOK_SPEC section 11 rule 1: <= 150 draws on the lite rung
  }
  await realistic(el, page, 'realistic');
  for (const preset of ['iso', 'persp'] as const) {
    await el.locator(`[data-preset-${preset}]`).click();
    await page.waitForTimeout(300);
    const f = await frameInfo(el);
    console.log(`perf realistic ${preset}: ${f.calls} draw calls, ${f.triangles} triangles, passes ${f.passes.join(' > ')}`);
    expect(f.passes).toEqual(['render-msaa2', 'gtao', 'bloom', 'output']);
  }
  // back at level 2: exactly the graph of before (the realistic level leaves nothing behind)
  await el.locator('[data-preset-iso]').click();
  await el.locator('[data-quality-2]').click();
  await expect(el).toHaveAttribute('data-quality', '2');
  await expect.poll(() => el.evaluate((n) => !(n as unknown as Probe).description.real), { timeout: 20000 }).toBe(true);
  await page.waitForTimeout(300);
  const back = await graph(el);
  expect(back.filter((o) => o.name !== '')).toEqual(l2.filter((o) => o.name !== ''));
  const r2 = await el.evaluate((n) => { const v = (n as unknown as Probe).view; return { tone: v.renderer.toneMapping, clip: v.renderer.localClippingEnabled }; });
  expect(r2.clip).toBe(false);
  expect(r2.tone).toBe(4); // ACES again
});

test('the level-3 graph is deterministic after a full rebuild from an equal description; the same pixels twice', async ({ page }) => {
  test.setTimeout(300_000);
  const el = await openDemo(page);
  await realistic(el, page, 'lite');
  const desc = await el.evaluate((n) => (n as unknown as Probe).description);
  const a = await graph(el);
  const pixels = await el.evaluate((n) => (n as unknown as Probe).capture());
  const builds = await el.evaluate((n) => (n as unknown as Probe).view.buildCount);
  // QUARANTINE-295: the rebuild runs synchronously inside the element's update (scene-three setDescription counts it first), and the
  // level-3 graph plus its first SwiftShader frame keep the page's main thread busy for seconds on a loaded machine - a polled read
  // of buildCount waited behind that work (one read took 6.7 s, past the poll's 5 s) although the count had already moved. Read it
  // when the update the new description started has completed: no clock in the way.
  const rebuilt = await el.evaluate(async (n, d) => {
    const e = n as unknown as Probe & { updateComplete: Promise<boolean> };
    e.description = d;
    await e.updateComplete;
    return e.view.buildCount;
  }, JSON.parse(JSON.stringify(desc)) as SceneDescription);
  expect(rebuilt).toBeGreaterThan(builds);
  await page.waitForTimeout(600);
  const b = await graph(el);
  expect(b.length).toBe(a.length);
  expect(b).toEqual(a);
  expect(await el.evaluate((n) => (n as unknown as Probe).capture())).toBe(pixels);
});

test('the sun stands at the resolved site (owner 2026-10-11): the fallback says so, the home location or an override moves the sun', async ({ page }) => {
  test.setTimeout(300_000);
  const el = await openDemo(page);
  await realistic(el, page, 'lite');
  // the demo has no server: the fallback location, and the time pill says so
  expect(await el.evaluate((n) => (n as unknown as Probe).site)).toEqual({ latitude: 32, longitude: 34.8, zone: 'Asia/Jerusalem', source: 'default', known: false });
  await el.locator('[data-3d-time-toggle]').click();
  await expect(el.locator('[data-3d-site-default]')).toBeVisible();
  const at = (loc: unknown) => el.evaluate((n, l) => { const e = n as unknown as Probe; e.setSite(l); e.setTimeHour(13); return { sun: e.view.sunState()!, site: e.site }; }, loc);
  // the home's location (source ha): a northern site, the 13:00 sun in the south; no "not known" note
  const home = await at({ latitude: 31.78, longitude: 35.23, elevation_m: 754, time_zone: 'Asia/Jerusalem', source: 'ha', mode: 'home', home: null });
  expect(home.site.source).toBe('ha');
  expect(home.sun.azimuth > 90 && home.sun.azimuth < 270, `azimuth ${home.sun.azimuth}`).toBe(true);
  await expect(el.locator('[data-3d-site-default]')).toHaveCount(0);
  // an override far south, in its own zone: 13:00 there puts the sun in the north
  const south = await at({ latitude: -33.87, longitude: 151.21, elevation_m: null, time_zone: 'Australia/Sydney', source: 'manual', mode: 'manual', home: null });
  expect(south.site).toMatchObject({ source: 'manual', zone: 'Australia/Sydney' });
  expect(south.sun.azimuth < 90 || south.sun.azimuth > 270, `azimuth ${south.sun.azimuth}`).toBe(true);
  await expect(el.locator('[data-3d-time-label]')).toHaveText('13:00');
  // unreadable: the fallback again, with its note
  const back = await at({ latitude: 'x', source: 'ha' });
  expect(back.site.source).toBe('default');
  await expect(el.locator('[data-3d-site-default]')).toBeVisible();
});

test('the time of day moves the sun deterministically; the style re-tints without a rebuild; a chosen rung is never lowered', async ({ page }) => {
  test.setTimeout(300_000);
  const el = await openDemo(page);
  await realistic(el, page, 'lite');
  const sun = (h: number) => el.evaluate((n, hour) => { const e = n as unknown as Probe; e.setTimeHour(hour); return e.view.sunState(); }, h);
  const noon = await sun(13);
  const night = await sun(2);
  expect(noon!.elevation).toBeGreaterThan(10);
  expect(night!.elevation).toBeLessThan(-10);
  expect(night!.night).toBe(1);
  await expect(el.locator('[data-3d-time-label]')).toHaveText('02:00');
  await sun(13);
  const g1 = await graph(el);
  await sun(13);
  expect(await graph(el)).toEqual(g1); // the same hour, the same graph
  await el.locator('[data-3d-time-now]').click(); // back to the site clock
  await expect(el.locator('[data-3d-time-now]')).toHaveCount(0);
  // the style: a re-tint and a re-light, no rebuild
  const builds = await el.evaluate((n) => (n as unknown as Probe).view.buildCount);
  await el.evaluate((n) => (n as unknown as Probe).view.setRealSettings({ style: 'dark' }));
  expect(await el.evaluate((n) => (n as unknown as Probe).view.buildCount)).toBe(builds);
  expect(await el.evaluate((n) => (n as unknown as Probe).view.getRealSettings().style)).toBe('dark');
  // owner 2026-10-10: a chosen rung stays when the device is slow, the hint offers the simpler one
  await el.evaluate((n) => { (n as unknown as Probe).minFps = 100000; });
  await el.locator('[data-quality-3]').click();
  await expect(el.locator('[data-3d-low-fps]')).toBeAttached({ timeout: 60000 });
  await expect(el).toHaveAttribute('data-quality', '3');
  await expect(el).toHaveAttribute('data-rung', 'realistic');
  await expect(el.locator('[data-3d-low-fps]')).toHaveAttribute('data-3d-low-fps', 'lite');
});

test('a door opening animates and ends exactly where a cold build of the same description draws it', async ({ page }) => {
  test.setTimeout(300_000);
  const el = await openDemo(page);
  await realistic(el, page, 'lite');
  const base = demoSceneInput('f0')!;
  const withDoor = (state: string): SceneDescription => {
    const input: SceneInput = { ...base, doc: JSON.parse(JSON.stringify(base.doc)), entityStates: { ...base.entityStates, 'binary_sensor.d0': state }, realistic: true };
    input.doc.openings[0].anchor_ref = { resource_type: 'ha_entity', resource_id: 'binary_sensor.d0' };
    return buildScene(input);
  };
  await setDescription(el, withDoor('off'));
  await page.waitForTimeout(400);
  await setDescription(el, withDoor('on')); // the leaf swings over 350 ms
  await page.waitForTimeout(900);
  const animated = (await graph(el)).filter((o) => String(o.name).startsWith('door:do0'));
  await setDescription(el, withDoor('on')); // an equal description, a new object: a cold rebuild, nothing to animate from
  await page.waitForTimeout(300);
  const cold = (await graph(el)).filter((o) => String(o.name).startsWith('door:do0'));
  expect(animated.length).toBeGreaterThan(0);
  expect(animated).toEqual(cold);
});
