import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScene, type SceneDescription } from '../src/map/scene-builder';
import { houseInput, houseLabels } from './lookdev/house';

/*
 * Plan Studio 6 look-dev harness (round 3, docs/design/studio6/ROUND3_CRITIQUE.md). OPT-IN: SW_LOOKDEV=1. It draws the
 * synthetic two-floor building of tests/lookdev/house.ts through the real element (sw-plan-3d on the style guide page of
 * the static preview) at level 3 - both styles, both rungs, orbit presets and eye-level walks, several hours of the day,
 * desktop and phone - and writes one PNG per frame to SW_LOOKDEV_OUT (default private-evidence/studio6-lookdev/<tag>/,
 * gitignored; SW_LOOKDEV_TAG names the run, e.g. before / after). It asserts nothing about pixels: the pictures are
 * looked at by a person. The browser runs on the machine's GPU (the perf spec's ANGLE switches; SW_LOOKDEV_GPU=0 keeps
 * SwiftShader, where a realistic frame takes seconds).
 */

const ON = process.env.SW_LOOKDEV === '1';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.env.SW_LOOKDEV_TAG ?? 'run';
const OUT = process.env.SW_LOOKDEV_OUT ?? path.resolve(HERE, '..', '..', 'private-evidence', 'studio6-lookdev', TAG);
const GPU = ON && process.env.SW_LOOKDEV_GPU !== '0';
const GPU_ARGS = [process.platform === 'win32' ? '--use-angle=d3d11' : '--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist'];
const ONLY = (process.env.SW_LOOKDEV_ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const DATE: [number, number, number] = [2026, 10, 13];

if (GPU) test.use({ launchOptions: { args: GPU_ARGS } });
test.skip(!ON, 'look-dev harness: opt in with SW_LOOKDEV=1');

type Style = 'light' | 'dark';
type Rung = 'realistic' | 'lite';
interface Shot {
  name: string;
  style: Style;
  rung: Rung;
  level: string | null;
  hour: number;
  view: 'iso' | 'top' | 'persp' | { walk: string };
}

const WALK = (id: string) => ({ walk: `pos:${id}` });
const SHOTS_DESKTOP: Shot[] = [];
for (const style of ['light', 'dark'] as Style[]) {
  SHOTS_DESKTOP.push(
    { name: `${style}-iso-L0-day-real`, style, rung: 'realistic', level: 'L0', hour: 13, view: 'iso' },
    { name: `${style}-iso-L0-golden-real`, style, rung: 'realistic', level: 'L0', hour: 17.6, view: 'iso' },
    { name: `${style}-iso-L0-night-real`, style, rung: 'realistic', level: 'L0', hour: 21, view: 'iso' },
    { name: `${style}-iso-L1-day-real`, style, rung: 'realistic', level: 'L1', hour: 10, view: 'iso' },
    { name: `${style}-persp-all-day-real`, style, rung: 'realistic', level: null, hour: 15, view: 'persp' },
    { name: `${style}-top-L0-day-lite`, style, rung: 'lite', level: 'L0', hour: 13, view: 'top' },
    { name: `${style}-iso-L0-day-lite`, style, rung: 'lite', level: 'L0', hour: 13, view: 'iso' },
    { name: `${style}-iso-L0-night-lite`, style, rung: 'lite', level: 'L0', hour: 21, view: 'iso' },
    { name: `${style}-walk-living-day-real`, style, rung: 'realistic', level: 'L0', hour: 13, view: WALK('wp-living') },
    { name: `${style}-walk-living-night-real`, style, rung: 'realistic', level: 'L0', hour: 21, view: WALK('wp-living') },
    { name: `${style}-walk-kitchen-golden-real`, style, rung: 'realistic', level: 'L0', hour: 17.6, view: WALK('wp-kitchen') },
    { name: `${style}-walk-office-day-lite`, style, rung: 'lite', level: 'L0', hour: 11, view: WALK('wp-office') },
    { name: `${style}-walk-meeting-day-real`, style, rung: 'realistic', level: 'L1', hour: 14, view: WALK('wp-meeting') },
    { name: `${style}-walk-openoffice-night-lite`, style, rung: 'lite', level: 'L1', hour: 20, view: WALK('wp-openoffice') },
  );
}
const SHOTS_MOBILE: Shot[] = [];
for (const style of ['light', 'dark'] as Style[]) {
  SHOTS_MOBILE.push(
    { name: `${style}-m-iso-L0-day-lite`, style, rung: 'lite', level: 'L0', hour: 13, view: 'iso' },
    { name: `${style}-m-iso-L0-night-lite`, style, rung: 'lite', level: 'L0', hour: 21, view: 'iso' },
    { name: `${style}-m-walk-living-day-lite`, style, rung: 'lite', level: 'L0', hour: 13, view: WALK('wp-living') },
    { name: `${style}-m-walk-kitchen-night-lite`, style, rung: 'lite', level: 'L0', hour: 21, view: WALK('wp-kitchen') },
  );
}

interface Probe {
  view: { realPending: number; rendererInfo: () => { vendor: string; renderer: string }; lastFrameInfo: { calls: number; triangles: number }; getRealSettings: () => unknown };
  description: SceneDescription | null;
  minFps: number;
  walkable: boolean;
  themeForce: Style | null;
  levels: { id: string; name: string; elevation_m: number }[];
  activeLevel: string | null;
  labels: Record<string, string>;
  timeManual: { hour: number; ymd: [number, number, number] } | null;
  applySun: () => void;
  startWalk: (s: unknown) => void;
  stopWalk: (n: boolean) => void;
  capture: () => string;
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
    s.border = '0';
    s.borderRadius = '0';
  });
  await page.waitForTimeout(500);
  return el;
}

const descriptions = new Map<string, SceneDescription>();
function describe(level: string | null, walk: boolean): SceneDescription {
  const key = `${level ?? 'all'}|${walk ? 'w' : 'o'}`;
  let d = descriptions.get(key);
  if (!d) descriptions.set(key, (d = buildScene(houseInput({ level, walk, realistic: true }))));
  return d;
}

async function settled(el: Locator, page: Page): Promise<void> {
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 180_000 }).toBe(0);
  await page.waitForTimeout(400);
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 180_000 }).toBe(0);
}

async function shoot(page: Page, el: Locator, s: Shot): Promise<void> {
  const walk = typeof s.view !== 'string';
  const desc = describe(s.level, walk);
  await page.evaluate((style) => document.documentElement.setAttribute('data-theme', style), s.style);
  await el.evaluate((n, a) => {
    const e = n as unknown as Probe;
    e.minFps = 0;
    e.themeForce = a.style;
    e.walkable = true;
    e.levels = [{ id: 'L0', name: 'קרקע', elevation_m: 0 }, { id: 'L1', name: 'קומה 1', elevation_m: 2.9 }];
    e.activeLevel = a.level;
    e.labels = a.labels;
  }, { style: s.style, level: s.level, labels: houseLabels() });
  await el.locator(s.rung === 'realistic' ? '[data-quality-3]' : '[data-quality-3-lite]').click();
  await expect(el).toHaveAttribute('data-rung', s.rung);
  await el.evaluate((n, d) => { (n as unknown as Probe).description = d; }, desc);
  await expect(el).toHaveAttribute('data-parts', String(desc.parts.length));
  await el.evaluate((n, a) => {
    const e = n as unknown as Probe;
    e.timeManual = { hour: a.hour, ymd: a.date };
    e.applySun();
  }, { hour: s.hour, date: DATE });
  await settled(el, page);
  // a look-dev experiment: SW_LOOKDEV_PATCH holds a JavaScript body run with `n` = the element (never in a committed run)
  if (process.env.SW_LOOKDEV_PATCH) {
    await el.evaluate(new Function('n', process.env.SW_LOOKDEV_PATCH!) as (n: Element) => void);
    await settled(el, page);
  }
  if (typeof s.view === 'string') {
    await el.locator(`[data-preset-${s.view}]`).click();
    await expect(el).toHaveAttribute('data-preset', s.view);
    await page.waitForTimeout(900);
    await el.evaluate((n) => { const e = n as unknown as Probe; let last = e.capture(); for (let i = 0; i < 40; i++) { const next = e.capture(); if (next === last) break; last = next; } });
  } else {
    const id = s.view.walk;
    const start = desc.walk?.starts.find((x) => x.id === id);
    expect(start, `walk start ${id}`).toBeTruthy();
    await el.evaluate((n, st) => (n as unknown as Probe).startWalk(st), start);
    await expect(el).toHaveAttribute('data-walk', '');
    await settled(el, page);
    await page.waitForTimeout(1500);
  }
  const info = await el.evaluate((n) => { const e = n as unknown as Probe; return { gl: e.view.rendererInfo().renderer, ...e.view.lastFrameInfo, style: n.getAttribute('data-style'), real: JSON.stringify(e.view.getRealSettings()), tints: (e.description?.parts ?? []).filter((p) => p.kind === 'tint').length }; });
  fs.mkdirSync(OUT, { recursive: true });
  await el.screenshot({ path: path.join(OUT, `${s.name}.png`) });
  fs.appendFileSync(path.join(OUT, 'frames.txt'), `${s.name}\t${info.calls} draws\t${info.triangles} tris\tstyle=${info.style}\t${info.real}\ttints=${info.tints}\t${info.gl}\n`);
  if (process.env.SW_LOOKDEV_DEBUG === '1') {
    const dbg = await el.evaluate((n) => {
      const v = (n as unknown as { view: { scene: { traverse: (f: (o: Record<string, unknown>) => void) => void; environment: unknown; environmentIntensity: number }; renderer: { toneMappingExposure: number; toneMapping: number } } }).view;
      const out: Record<string, unknown> = { env: !!v.scene.environment, envI: v.scene.environmentIntensity, exposure: v.renderer.toneMappingExposure, tm: v.renderer.toneMapping, lights: [] as unknown[], mats: [] as unknown[] };
      // the canvas pixels at the top-left corner and the bottom centre (alpha tells whether the CSS backdrop shows through)
      const gl = (v.renderer as unknown as { domElement: HTMLCanvasElement }).domElement;
      const c2 = document.createElement('canvas');
      c2.width = gl.width;
      c2.height = gl.height;
      const ctx = c2.getContext('2d')!;
      ctx.drawImage(gl, 0, 0);
      out.corner = Array.from(ctx.getImageData(8, 8, 1, 1).data);
      out.bottom = Array.from(ctx.getImageData(Math.floor(gl.width / 2), gl.height - 8, 1, 1).data);
      out.patch = (window as unknown as { __dbg?: unknown }).__dbg ?? null;
      v.scene.traverse((o) => {
        const name = String(o.name ?? '');
        const t = String(o.type);
        if (t.endsWith('Light')) (out.lights as unknown[]).push({ t, i: (o as { intensity: number }).intensity, c: (o as { color: { getHexString: () => string } }).color?.getHexString(), vis: o.visible });
        if (name.startsWith('merged|') || name.startsWith('inst|')) {
          const m = o.material as { color: { getHexString: () => string }; map: unknown; normalMap: unknown; aoMap: unknown; roughness: number; metalness: number; envMapIntensity: number; type: string; clippingPlanes: unknown; opacity: number; transparent: boolean };
          (out.mats as unknown[]).push({ name, type: m.type, color: m.color?.getHexString(), map: !!m.map, nrm: !!m.normalMap, ao: !!m.aoMap, rough: m.roughness, metal: m.metalness, envI: m.envMapIntensity, clip: !!m.clippingPlanes, op: m.opacity, tr: m.transparent, vis: o.visible });
        }
      });
      return out;
    });
    fs.writeFileSync(path.join(OUT, `${s.name}.debug.json`), JSON.stringify(dbg, null, 1));
  }
  if (walk) {
    await el.evaluate((n) => (n as unknown as Probe).stopWalk(false));
    await expect(el).not.toHaveAttribute('data-walk', '');
  }
}

test.describe('Studio 6 look-dev pictures', () => {
  test('desktop matrix', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop project');
    test.setTimeout(3_600_000);
    const el = await openDemo(page);
    for (const s of SHOTS_DESKTOP) if (!ONLY.length || ONLY.some((o) => s.name.includes(o))) await shoot(page, el, s);
  });
  test('phone matrix', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'mobile project');
    test.setTimeout(3_600_000);
    const el = await openDemo(page);
    for (const s of SHOTS_MOBILE) if (!ONLY.length || ONLY.some((o) => s.name.includes(o))) await shoot(page, el, s);
  });
});
