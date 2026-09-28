import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoRooms } from '../src/fixtures/demo';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { buildScene, type SceneDescription, type SceneInput, type SceneZone } from '../src/map/scene-builder';
import { roomStates, type RoomStateLayer, type StateEntity } from '../src/map/room-state';

// CR-006 slice 1c, design rule 4 (10.5) as tests: the same plan JSON + tokens + state snapshot + `now` bucket + preset +
// quality give (1) the same description (node: the builder is a pure function of its JSON input), (2) the same realised
// scene graph in three - object names, instance matrices, transforms, material tokens, shadow flags - after a full
// rebuild from an equal description, at both levels and every overview preset, and the same pixels; and (3) pixels
// that match the committed baselines under docs/evidence/T087/visual/ within a small tolerance, per (level, preset,
// project), on the sample floor of the style guide.
//
// Baselines: `SW_UPDATE_VISUAL=1 npx playwright test tests/unit-plan-3d-determinism.spec.ts --project=desktop --project=mobile`
// (from frontend/, after `npm run build`) rewrites the PNGs (the quiet sample floor and, as `-state`, the same floor
// with the state snapshot: tints, the red door frame, the chip and the pills), the element screenshots and
// renderer-<project>.json, which records the WebGL renderer that drew them. Pixels are renderer-specific (headless
// Chromium's SwiftShader against a real GPU): the comparison runs only when this run's renderer string equals the
// baseline's, and is skipped - saying so - otherwise; `SW_REQUIRE_VISUAL=1` turns that skip into a failure (a CI
// lane that must compare). Whatever the renderer, the determinism tests above always run.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'docs', 'evidence', 'T087', 'visual');
const UPDATE = process.env.SW_UPDATE_VISUAL === '1';
const REQUIRE = process.env.SW_REQUIRE_VISUAL === '1';
/** A pixel differs when any channel moves by more than this (0..255) - tight, since the same renderer draws the same
 * bytes (a wall token nudged by a few /255 or an exposure change must not pass); this share of the pixels may differ. */
const CHANNEL_TOLERANCE = 2;
const MAX_DIFF_RATIO = 0.002;
const SCENES = ['quiet', 'state'] as const;
const LEVELS = ['1', '2'] as const;
const PRESETS = ['iso', 'persp', 'top'] as const;
const NOW = Date.parse('2026-09-28T12:00:00Z');

type Probe = {
  view: { scene: { traverse: (f: (o: Record<string, unknown>) => void) => void }; buildCount: number; rendererInfo: () => { vendor: string; renderer: string } };
  description: SceneDescription;
  minFps: number;
  capture: () => string | null;
};
type Node = Record<string, unknown>;

const input = demoSceneInput('f0')!;
const rooms = demoRooms('f0');
const zones: SceneZone[] = rooms.map((r, i) => ({ id: `z${i}`, name: `חדר ${i}`, polygon: [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }], level_id: 'L0' }));
const ent = (id: string, x: number, y: number, extra: Partial<StateEntity> = {}): StateEntity => ({ id, domain: id.split('.')[0], device_class: null, state: null, last_changed: null, attributes: null, x, y, level_id: 'L0', layer_id: null, ...extra });
const c = (i: number) => ({ x: rooms[i].x + rooms[i].w / 2, y: rooms[i].y + rooms[i].h / 2 });
/** The state snapshot: room 0 lit at 21.5 degrees, motion in room 1 ninety seconds before NOW, door do0 open. */
const snapshot = () => ({
  rooms: zones.map((z) => ({ id: z.id, polygon: z.polygon, level_id: 'L0' })),
  entities: [ent('light.z0', c(0).x, c(0).y, { state: 'on' }), ent('sensor.t0', c(0).x + 0.01, c(0).y, { device_class: 'temperature', state: '21.5' }), ent('binary_sensor.m1', c(1).x, c(1).y, { device_class: 'motion', state: 'off', last_changed: new Date(NOW - 90_000).toISOString() }), ent('binary_sensor.d0', 0, 0, { device_class: 'door', state: 'on' })],
  openings: [{ id: 'do0', kind: 'door' as const, x: 0, y: 0, level_id: 'L0', entity_id: 'binary_sensor.d0' }],
  size: [input.width, input.height] as [number, number],
  now: NOW,
  fade: 3 as const,
});
/** The scene input from a fresh JSON copy of every plain part (the catalog lookup is a function and is shared). */
const freshInput = (level: string | null, layer: RoomStateLayer): SceneInput => ({ ...input, doc: JSON.parse(JSON.stringify(input.doc)), anchors: JSON.parse(JSON.stringify(input.anchors)), entityStates: { ...input.entityStates }, circuitStates: { ...input.circuitStates }, zones: JSON.parse(JSON.stringify(zones)), level, roomStates: JSON.parse(JSON.stringify(layer)) });
const live: RoomStateLayer = roomStates(snapshot());
const withStates = buildScene(freshInput(null, live));

async function openDemo(page: Page): Promise<Locator> {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  await el.evaluate((n) => { (n as unknown as Probe).minFps = 0; });
  return el;
}
const setDescription = (el: Locator, d: SceneDescription) => el.evaluate((n, desc) => { (n as unknown as Probe).description = desc; }, d);
/** The scene graph in full: every object with its transform, instance matrices, material and shadow flags. */
const graph = (el: Locator): Promise<Node[]> =>
  el.evaluate((n) => {
    const out: Node[] = [];
    const num = (v: unknown): number[] => Array.from(v as ArrayLike<number>);
    (n as unknown as Probe).view.scene.traverse((o) => {
      const mat = o.material as { type?: string; color?: { getHex: () => number }; opacity?: number; transparent?: boolean; roughness?: number; metalness?: number; side?: number } | undefined;
      const p = o.position as { toArray: () => number[] };
      const q = o.quaternion as { toArray: () => number[] };
      const s = o.scale as { toArray: () => number[] };
      const im = o.instanceMatrix as { array: ArrayLike<number> } | undefined;
      const light = o as { intensity?: number; color?: { getHex: () => number }; distance?: number };
      out.push({
        name: String(o.name ?? ''), type: String(o.type), count: Number(o.count ?? 0), visible: o.visible !== false,
        position: p.toArray(), quaternion: q.toArray(), scale: s.toArray(), matrices: im ? num(im.array) : null,
        cast: !!o.castShadow, receive: !!o.receiveShadow,
        material: mat ? { type: mat.type, color: mat.color?.getHex(), opacity: mat.opacity, transparent: mat.transparent, roughness: mat.roughness, metalness: mat.metalness, side: mat.side } : null,
        light: light.intensity !== undefined ? { intensity: light.intensity, color: light.color?.getHex(), distance: light.distance } : null,
      });
    });
    return out;
  });
const capture = async (el: Locator): Promise<string> => (await el.evaluate((n) => (n as unknown as Probe).capture()))!;
const pngBytes = (dataUrl: string): Buffer => Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
const baselineFile = (level: string, preset: string, scene: (typeof SCENES)[number], project: string) => path.join(OUT, `plan-3d-l${level}-${preset}${scene === 'state' ? '-state' : ''}-${project}.png`);

/** The share of differing pixels between two PNG data URLs (decoded in the page), or the size mismatch. */
const compare = (page: Page, actual: string, baseline: string) =>
  page.evaluate(async ([a, b, tol]) => {
    const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('bad png')); img.src = src; });
    const [ia, ib] = await Promise.all([load(a as string), load(b as string)]);
    if (ia.naturalWidth !== ib.naturalWidth || ia.naturalHeight !== ib.naturalHeight) return { size: [ia.naturalWidth, ia.naturalHeight, ib.naturalWidth, ib.naturalHeight], ratio: 1, differing: -1, total: 0, diff: '' };
    const draw = (img: HTMLImageElement) => { const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight; const ctx = cv.getContext('2d')!; ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, cv.width, cv.height); };
    const da = draw(ia);
    const db = draw(ib);
    const out = new ImageData(da.width, da.height);
    let differing = 0;
    for (let i = 0; i < da.data.length; i += 4) {
      const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]), Math.abs(da.data[i + 3] - db.data[i + 3]));
      const off = d > (tol as number);
      if (off) differing++;
      out.data[i] = off ? 255 : da.data[i] >> 2;
      out.data[i + 1] = off ? 0 : da.data[i + 1] >> 2;
      out.data[i + 2] = off ? 0 : da.data[i + 2] >> 2;
      out.data[i + 3] = 255;
    }
    const cv = document.createElement('canvas');
    cv.width = da.width;
    cv.height = da.height;
    cv.getContext('2d')!.putImageData(out, 0, 0);
    const total = da.data.length / 4;
    return { size: null, ratio: differing / total, differing, total, diff: differing ? cv.toDataURL('image/png') : '' };
  }, [actual, baseline, CHANNEL_TOLERANCE] as const);

test('the builder is a pure function: the same plan JSON, state snapshot and now bucket give the same description, per level', () => {
  const layerA = roomStates(snapshot());
  const layerB = roomStates(snapshot());
  expect(JSON.stringify(layerB)).toBe(JSON.stringify(layerA));
  for (const level of [null, 'L0']) {
    const a = buildScene(freshInput(level, layerA));
    const b = buildScene(freshInput(level, layerB));
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(a.parts.length).toBeGreaterThan(20);
    expect(a.parts.some((p) => p.kind === 'tint')).toBe(true);
    expect(a.parts.some((p) => p.kind === 'chip')).toBe(true);
    expect(a.parts.some((p) => p.id.startsWith('open:'))).toBe(true);
  }
  expect(JSON.stringify(buildScene(freshInput(null, layerA)))).toBe(JSON.stringify(withStates));
});

test('the realised scene graph is identical after a full rebuild from an equal description - names, instance matrices, materials, shadows - and so are the pixels, at both levels and every overview preset', async ({ page }) => {
  test.setTimeout(240_000);
  const el = await openDemo(page);
  const clone = JSON.parse(JSON.stringify(withStates)) as SceneDescription;
  for (const level of LEVELS) {
    await el.locator(`[data-quality-${level}]`).click();
    await expect(el).toHaveAttribute('data-quality', level);
    for (const preset of PRESETS) {
      await el.locator(`[data-preset-${preset}]`).click();
      await expect(el).toHaveAttribute('data-preset', preset);
      await setDescription(el, withStates);
      await expect(el).toHaveAttribute('data-parts', String(withStates.parts.length));
      const builds = await el.evaluate((n) => (n as unknown as Probe).view.buildCount);
      await page.waitForTimeout(150);
      const a = await graph(el);
      const pixelsA = await capture(el);
      await setDescription(el, clone); // an equal description, a different object: a full realisation (no tint shortcut)
      await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.buildCount)).toBe(builds + 1);
      await page.waitForTimeout(150);
      const b = await graph(el);
      expect(b.length, `${preset} at level ${level}: the object count`).toBe(a.length);
      expect(b, `${preset} at level ${level}: the scene graph`).toEqual(a);
      expect(a.filter((o) => o.matrices).length).toBeGreaterThan(3);
      expect(await capture(el), `${preset} at level ${level}: the pixels after the rebuild`).toBe(pixelsA);
      await setDescription(el, withStates); // back to the first object for the next preset (the same graph again)
      await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.buildCount)).toBe(builds + 2);
    }
  }
});

test('rendered pixels per level and preset match the committed baselines within tolerance (on the renderer that drew them; regen with SW_UPDATE_VISUAL=1)', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const project = testInfo.project.name;
  const el = await openDemo(page);
  const current = await el.evaluate((n) => (n as unknown as Probe).view.rendererInfo());
  const rendererFile = path.join(OUT, `renderer-${project}.json`);
  if (UPDATE) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(rendererFile, `${JSON.stringify({ ...current, viewport: page.viewportSize(), tolerance: { channel: CHANNEL_TOLERANCE, maxDiffRatio: MAX_DIFF_RATIO } }, null, 2)}\n`);
  } else {
    expect(fs.existsSync(rendererFile), `no baseline for the ${project} project: regenerate with SW_UPDATE_VISUAL=1`).toBe(true);
    const made = JSON.parse(fs.readFileSync(rendererFile, 'utf8')) as { renderer: string; vendor: string };
    const mismatch = `the baselines were drawn by "${made.renderer}", this run draws with "${current.renderer}": pixels are renderer-specific`;
    if (REQUIRE) expect(current.renderer, `${mismatch} (SW_REQUIRE_VISUAL=1: a mismatch fails)`).toBe(made.renderer);
    test.skip(made.renderer !== current.renderer, `${mismatch}, the comparison is skipped (the determinism tests still ran; SW_REQUIRE_VISUAL=1 fails instead)`);
  }
  console.log(`visual baselines ${project}: renderer "${current.renderer}" (${current.vendor}), ${UPDATE ? 'writing' : 'comparing'}`);
  const quiet = await el.evaluate((n) => (n as unknown as Probe).description);
  for (const level of LEVELS) {
    await el.locator(`[data-quality-${level}]`).click();
    await expect(el).toHaveAttribute('data-quality', level);
    for (const preset of PRESETS) {
      await el.locator(`[data-preset-${preset}]`).click();
      await expect(el).toHaveAttribute('data-preset', preset);
      for (const scene of SCENES) {
        await setDescription(el, scene === 'state' ? withStates : quiet);
        await expect(el).toHaveAttribute('data-parts', String((scene === 'state' ? withStates : quiet).parts.length));
        await page.waitForTimeout(300); // the presets set the camera directly; this is for the outline pass and the damping
        const actual = await capture(el);
        expect(actual.startsWith('data:image/png;base64,')).toBe(true);
        const file = baselineFile(level, preset, scene, project);
        const tag = `${preset} at level ${level} (${scene})`;
        if (UPDATE) {
          fs.writeFileSync(file, pngBytes(actual));
          continue;
        }
        expect(fs.existsSync(file), `missing baseline ${file}: regenerate with SW_UPDATE_VISUAL=1`).toBe(true);
        const baseline = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
        const r = await compare(page, actual, baseline);
        if (r.size || r.ratio > MAX_DIFF_RATIO) {
          // the actual picture and the difference next to the report, for the eye
          fs.writeFileSync(testInfo.outputPath(path.basename(file).replace(/\.png$/, '-actual.png')), pngBytes(actual));
          if (r.diff) fs.writeFileSync(testInfo.outputPath(path.basename(file).replace(/\.png$/, '-diff.png')), pngBytes(r.diff));
        }
        expect(r.size, `${tag}: the baseline has another size (actual w,h, baseline w,h)`).toBeNull();
        console.log(`visual ${project} l${level} ${preset} ${scene}: ${r.differing} of ${r.total} pixels differ (${(r.ratio * 100).toFixed(3)} %)`);
        expect(r.ratio, `${tag}: ${r.differing} of ${r.total} pixels differ from ${path.basename(file)}`).toBeLessThanOrEqual(MAX_DIFF_RATIO);
      }
    }
    if (UPDATE) {
      await el.locator('[data-preset-iso]').click();
      await setDescription(el, withStates);
      await page.waitForTimeout(300);
      await el.screenshot({ path: path.join(OUT, `plan-3d-element-l${level}-${project}.png`) });
    }
  }
});
