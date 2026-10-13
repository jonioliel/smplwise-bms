import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { demoRooms } from '../src/fixtures/demo';
import type { GeomObject } from '../src/map/geometry';
import { buildScene, type SceneDescription, type SceneInput } from '../src/map/scene-builder';

/*
 * Plan Studio 6, slice S7 (CR-029 section 8 row S7, section 3.4 performance budget and fallback ladder, section 13.2 the
 * look-dev frame timer): the R178 gate and the lever table, plus the determinism and functional checks they rest on.
 * Task T089, acceptance AT177 / AT178. Runs on the style guide's demo floor in the static preview (no backend, no device).
 *
 * Two parts:
 *
 * 1. ALWAYS (functional and determinism; any renderer, SwiftShader included):
 *    - the 1,000-object floor: the same input gives the same description (node) and the same scene graph after a full
 *      rebuild at all three levels (1 schematic, 2 full, 3 realistic lite);
 *    - the default stays schematic without any choice (R178, second half), and `auto` with a realistic start falls
 *      realistic -> lite -> full -> schematic by the frame-budget probe, one rung per probe, and says so;
 *    - the texture budget: the library's decoded textures on the 1,000-object floor stay at or under 512 px and under
 *      the device class cap (48 MB phone / 128 MB elsewhere, CR-029 section 3.4); the over-budget swap to 256 px variants
 *      is NOT BUILT and is listed as a `fixme` so it shows in every report;
 *    - the lever table switches really change the scene as documented: textures (dial `textures`), normal maps
 *      (measurement harness: the product has no dial), lamp shadow (product: never; harness: the strongest pool lamp),
 *      DPR (dial `dpr_cap` on the realistic rung; the lite rung is pinned at 1), the rung (post passes, physical glass).
 *
 * 2. OPT-IN (the measurement): runs only when SW_PERF_GATE=1 AND the machine is quiet (1-minute load average per core
 *    <= SW_PERF_MAX_LOAD, default 0.30, where the platform has one; sampled CPU busy <= SW_PERF_MAX_BUSY %, default 25,
 *    everywhere - Windows has no load average) AND the WebGL renderer is a GPU (SwiftShader / llvmpipe skip unless
 *    SW_PERF_DRY_RUN=1, see below). Otherwise the tests are SKIPPED with the reason printed as a `PERF_GATE ...` line and kept
 *    as the skip annotation: numbers from the shared, busy runner say nothing about a phone.
 *    - R178 (mobile project only, 390 px): level 3 at the phone rung (realistic lite: textures, IBL, sun shadow, bloom,
 *      DPR 1) on the 1,000-object floor, the element filling the viewport, CPU throttled x SW_PERF_CPU_THROTTLE (default
 *      4, the CR-029 section 9 proxy); the GPU-synchronised frame timer (SceneView.benchFrames: back-to-back frames,
 *      each followed by a one-pixel readback - requestAnimationFrame is vsync-capped and cannot rank configurations),
 *      12 samples of 5 frames after a warm-up, the MEDIAN -> fps >= 30 at the isometric and the perspective presets.
 *    - the lever table (any project): the same timer per row - lite baseline, textures off, normal maps off, lamp
 *      shadow on, realistic at DPR cap 1 / 1.25 / 1.5 / 2, full and schematic for reference. Reported, never asserted.
 *    Both write a JSON record to SW_PERF_OUT (default <repo>/private-evidence/studio6-perf/, gitignored) and attach it.
 *    SW_PERF_DRY_RUN=1 (with SW_PERF_GATE=1) exercises the harness anywhere - busy machine, software renderer, fewer
 *    samples (SW_PERF_SAMPLES / SW_PERF_FRAMES) - and asserts nothing; its record says `dry_run: true` and is never
 *    evidence. The runbook is docs/design/studio6/PLAN_STUDIO_PHASE6_PERF_RUNBOOK.md.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OBJECTS = 1000;
const MB = 1024 * 1024;

type Node = Record<string, unknown>;
interface View {
  scene: { traverse: (f: (o: Node) => void) => void };
  renderer: { getPixelRatio: () => number; domElement: HTMLCanvasElement; info: { render: { calls: number; triangles: number } }; shadowMap: { needsUpdate: boolean } };
  buildCount: number;
  realPending: number;
  postPasses: string[];
  lastFrameInfo: { calls: number; triangles: number };
  getQuality: () => number;
  getRealSettings: () => { rung: string; textures: string };
  setRealSettings: (s: Record<string, unknown>) => void;
  benchFrames: (n: number) => number;
  rendererInfo: () => { vendor: string; renderer: string };
  redrawNow: () => void;
  glowPool: { castShadow: boolean; intensity: number; position: { set: (x: number, y: number, z: number) => void; toArray: () => number[] }; shadow: { mapSize: { set: (a: number, b: number) => void } } }[];
}
interface Probe {
  view: View;
  description: SceneDescription | null;
  minFps: number;
  viewDials: Record<string, unknown>;
  setTimeHour: (h: number) => void;
  setPreset?: (p: string) => void;
}

// ------------------------------------------------------------------------------------------------ the 1,000-object floor

/** Furniture mix of an office / hall floor (catalog 2026.10.1 ids; the kit models of plan3d-assets.ts where mapped, the
 * procedural families elsewhere), shares out of 100, in a fixed order: the floor is the same on every run. */
const MIX: { item: string; size: GeomObject['size']; z: number; share: number }[] = [
  { item: 'chair.basic', size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z: 0, share: 50 },
  { item: 'table.desk', size: { w_m: 1.2, d_m: 0.6, h_m: 0.75 }, z: 0, share: 14 },
  { item: 'cabinet.low', size: { w_m: 0.8, d_m: 0.45, h_m: 0.8 }, z: 0, share: 10 },
  { item: 'light.ceiling', size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z: -0.3, share: 8 },
  { item: 'table.dining', size: { w_m: 1.6, d_m: 0.9, h_m: 0.75 }, z: 0, share: 8 },
  { item: 'sofa.3', size: { w_m: 2.0, d_m: 0.9, h_m: 0.8 }, z: 0, share: 5 },
  { item: 'shelf.unit', size: { w_m: 0.9, d_m: 0.35, h_m: 1.8 }, z: 0, share: 5 },
];
const SLOTS = MIX.flatMap((m) => Array.from({ length: m.share }, () => m));

/** The demo floor f0 with exactly OBJECTS objects: its own lamps and chairs plus a deterministic grid per room, the
 * count per room by area. */
function thousandInput(realistic: boolean): SceneInput {
  const base = demoSceneInput('f0')!;
  const doc = JSON.parse(JSON.stringify(base.doc)) as SceneInput['doc'];
  const rooms = demoRooms('f0');
  const need = OBJECTS - doc.objects.length;
  const area = rooms.map((r) => r.w * r.h);
  const total = area.reduce((a, b) => a + b, 0);
  const counts = area.map((a) => Math.floor((need * a) / total));
  counts[area.indexOf(Math.max(...area))] += need - counts.reduce((a, b) => a + b, 0);
  // two windows (the demo floor has doors only): the glass the realistic rung draws physical, the lite rung standard
  for (const [id, wall, t] of [['pw0', 'dw3', 0.3], ['pw1', 'dw4', 0.3]] as const) {
    doc.openings.push({ id, wall_id: wall, t, kind: 'window', width_m: 1.4, height_m: 1.2, sill_m: 0.9, swing: 'left', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} });
  }
  let k = 0;
  rooms.forEach((r, i) => {
    const n = counts[i];
    const cols = Math.max(1, Math.ceil(Math.sqrt((n * r.w * 3) / (r.h * 2))));
    const rows = Math.max(1, Math.ceil(n / cols));
    for (let j = 0; j < n; j++) {
      const m = SLOTS[k % SLOTS.length];
      const c = j % cols;
      const rw = Math.floor(j / cols);
      doc.objects.push({
        id: `p${String(k).padStart(4, '0')}`, item_id: m.item, level_id: 'L0',
        position: [r.x + r.w * (0.06 + (0.88 * (c + 0.5)) / cols), r.y + r.h * (0.06 + (0.88 * (rw + 0.5)) / rows)],
        rotation_deg: (k % 4) * 90, size: m.size, z_m: m.z, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {},
      });
      k++;
    }
  });
  return { ...base, doc, realistic };
}

// ------------------------------------------------------------------------------------------------ page helpers

async function openDemo(page: Page): Promise<Locator> {
  await page.goto('/#/styleguide');
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  return el;
}

/** The scene graph in a comparable form (name, type, instance count, visibility, vertices, transform, instance
 * matrices, shadow flag, material, light intensity) - the realistic spec's summary, rounded to 1e-5. */
const graph = (el: Locator): Promise<Node[]> =>
  el.evaluate((n) => {
    const out: Record<string, unknown>[] = [];
    (n as unknown as { view: View }).view.scene.traverse((o) => {
      const mat = o.material as { type?: string; color?: { getHex: () => number }; opacity?: number; roughness?: number } | undefined;
      const im = o.instanceMatrix as { array: ArrayLike<number> } | undefined;
      const light = o as { intensity?: number };
      const g = (o.geometry as { attributes?: { position?: { count: number } } } | undefined)?.attributes?.position?.count ?? 0;
      const r = (v: number) => Math.round(v * 1e5) / 1e5;
      out.push({ name: String(o.name ?? ''), type: String(o.type), count: Number(o.count ?? 0), visible: o.visible !== false, vertices: g,
        position: (o.position as { toArray: () => number[] }).toArray().map(r), quaternion: (o.quaternion as { toArray: () => number[] }).toArray().map(r),
        matrices: im ? Array.from(im.array).map(r) : null, cast: !!o.castShadow,
        material: mat ? { type: mat.type, color: mat.color?.getHex(), opacity: mat.opacity, roughness: mat.roughness } : null,
        light: light.intensity !== undefined ? Math.round(light.intensity * 1e4) / 1e4 : null });
    });
    return out;
  });

/** The graph once it stopped moving: two reads 500 ms apart agree and no asset is pending (the kit models and the
 * texture files arrive after the first build and realise the description again). */
async function settledGraph(el: Locator, page: Page): Promise<Node[]> {
  let last = '';
  let out: Node[] = [];
  await expect.poll(async () => {
    if ((await el.evaluate((n) => (n as unknown as Probe).view.realPending)) !== 0) return false;
    out = await graph(el);
    const now = JSON.stringify(out);
    const same = now === last;
    last = now;
    if (!same) await page.waitForTimeout(500);
    return same;
  }, { timeout: 180_000, intervals: [100] }).toBe(true);
  return out;
}

type Level = '1' | '2' | '3-lite' | '3';
const CHIP: Record<Level, string> = { '1': '[data-quality-1]', '2': '[data-quality-2]', '3-lite': '[data-quality-3-lite]', '3': '[data-quality-3]' };

/** Draw `desc` at a level: the chip, then (the style guide answers `realistic-change` with its own demo description) wait
 * for the host's description of that level and hand over ours; level 3 at a fixed hour so the sun stands still. */
async function showAt(el: Locator, level: Level, desc: SceneDescription): Promise<void> {
  await el.evaluate((n) => { (n as unknown as Probe).minFps = 0; });
  await el.locator(CHIP[level]).click();
  const real = level.startsWith('3');
  await expect(el).toHaveAttribute('data-quality', real ? '3' : level);
  await expect.poll(() => el.evaluate((n) => !!(n as unknown as Probe).description?.real), { timeout: 30000 }).toBe(real);
  await el.evaluate((n, d) => { (n as unknown as Probe).description = d; }, desc);
  await expect(el).toHaveAttribute('data-parts', String(desc.parts.length));
  if (real) await el.evaluate((n) => (n as unknown as Probe).setTimeHour(13));
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 120_000 }).toBe(0);
}

/** Textures the materials of the scene hold now: per unique texture its source and decoded size; the unique materials
 * (materials are shared between meshes) with a colour map and with a normal map. */
const textures = (el: Locator) =>
  el.evaluate((n) => {
    const seen = new Map<string, { src: string; w: number; h: number; slot: string }>();
    const mats = new Set<string>();
    let normalMats = 0;
    let mapMats = 0;
    (n as unknown as { view: View }).view.scene.traverse((o) => {
      for (const m of ([] as unknown[]).concat(o.material ?? []) as Record<string, unknown>[]) {
        if (mats.has(String(m.uuid))) continue;
        mats.add(String(m.uuid));
        if (m.normalMap) normalMats++;
        if (m.map) mapMats++;
        for (const slot of ['map', 'normalMap', 'roughnessMap', 'aoMap']) {
          const t = m[slot] as { uuid: string; image?: { src?: string; currentSrc?: string; width?: number; height?: number; naturalWidth?: number; naturalHeight?: number } } | null | undefined;
          if (!t || seen.has(t.uuid)) continue;
          const img = t.image;
          seen.set(t.uuid, { src: String(img?.currentSrc || img?.src || ''), w: Number(img?.naturalWidth ?? img?.width ?? 0), h: Number(img?.naturalHeight ?? img?.height ?? 0), slot });
        }
      }
    });
    return { list: [...seen.values()], normalMats, mapMats };
  });

// ---- the measurement harness levers (the product has no dial for these two; CR-029 section 3.4 names them)

/** Normal maps off / back on, on every material of the scene (stashed in userData; a shader recompile each way). */
const harnessNormals = (el: Locator, on: boolean) =>
  el.evaluate((n, wantOn) => {
    let changed = 0;
    (n as unknown as { view: View }).view.scene.traverse((o) => {
      for (const m of ([] as unknown[]).concat(o.material ?? []) as Record<string, unknown>[]) {
        const ud = m.userData as Record<string, unknown>;
        if (!wantOn && m.normalMap) {
          ud.__harnessNormal = m.normalMap;
          m.normalMap = null;
          m.needsUpdate = true;
          changed++;
        } else if (wantOn && ud.__harnessNormal) {
          m.normalMap = ud.__harnessNormal;
          delete ud.__harnessNormal;
          m.needsUpdate = true;
          changed++;
        }
      }
    });
    (n as unknown as { view: View }).view.redrawNow();
    return changed;
  }, on);

/** The lamp shadow lever: the strongest light of the pool (or, with no lamp lit, the first one placed over the plan's
 * centre at 2.5 m) casts a 512 px cube shadow; off restores it. The product never lets a lamp cast (CR-029 3.4 phone row;
 * LOOK_SPEC: 2 x 6 cube passes, off by default). */
const harnessLampShadow = (el: Locator, on: boolean) =>
  el.evaluate((n, wantOn) => {
    const e = n as unknown as Probe & { __lampStash?: { i: number; intensity: number; pos: number[] } };
    const v = e.view;
    if (wantOn) {
      let i = 0;
      v.glowPool.forEach((l, k) => { if (l.intensity > v.glowPool[i].intensity) i = k; });
      const l = v.glowPool[i];
      e.__lampStash = { i, intensity: l.intensity, pos: l.position.toArray() };
      if (l.intensity <= 0) {
        const c = e.description!.centre;
        l.position.set(c[0], 2.5, c[2]);
        l.intensity = 8;
      }
      l.shadow.mapSize.set(512, 512);
      l.castShadow = true;
    } else if (e.__lampStash) {
      const s = e.__lampStash;
      const l = v.glowPool[s.i];
      l.castShadow = false;
      l.intensity = s.intensity;
      l.position.set(s.pos[0], s.pos[1], s.pos[2]);
      delete e.__lampStash;
    }
    v.renderer.shadowMap.needsUpdate = true;
    v.redrawNow();
    let casting = 0;
    v.scene.traverse((o) => { if (o.type === 'PointLight' && o.castShadow) casting++; });
    return casting;
  }, on);

/** Apply a DPR cap on the realistic rung. Since ST7DPR the cap reaches the canvas and the post chain at once (scene-three
 * setRealSettings -> applyPixelRatio); the S7 harness used to go lite -> realistic to make the renderer read it (PORT-NOTES P21). */
async function applyDprCap(el: Locator, page: Page, cap: number): Promise<void> {
  await el.evaluate((n, c) => { (n as unknown as Probe).view.setRealSettings({ dprCap: c }); }, cap);
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 120_000 }).toBe(0);
  await page.waitForTimeout(300);
}

// ------------------------------------------------------------------------------------------------ the frame timer

interface Bench {
  samples_ms: number[];
  median_ms: number;
  fps: number;
  calls: number;
  triangles: number;
  pixel_ratio: number;
  canvas_px: [number, number];
}
/** The GPU-synchronised frame timer of the look-dev prototype (CR-029 13.2): one warm-up block, then `samples` blocks of
 * `per` back-to-back frames, each frame closed by a one-pixel readback; the median block mean -> fps. */
const bench = (el: Locator, samples = SAMPLES, per = FRAMES): Promise<Bench> =>
  el.evaluate((n, [s, p]) => {
    const v = (n as unknown as { view: View }).view;
    v.benchFrames(p);
    const ms: number[] = [];
    for (let i = 0; i < s; i++) ms.push(v.benchFrames(p));
    const sorted = [...ms].sort((a, b) => a - b);
    const mid = sorted.length / 2;
    const median = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
    const info = v.getQuality() === 3 ? v.lastFrameInfo : v.renderer.info.render;
    const c = v.renderer.domElement;
    return { samples_ms: ms.map((x) => Math.round(x * 100) / 100), median_ms: Math.round(median * 100) / 100, fps: Math.round((1000 / median) * 10) / 10, calls: info.calls, triangles: info.triangles, pixel_ratio: v.renderer.getPixelRatio(), canvas_px: [c.width, c.height] as [number, number] };
  }, [samples, per] as const);

// ------------------------------------------------------------------------------------------------ the opt-in gate

interface MachineLoad {
  platform: string;
  cores: number;
  load1: number | null;
  load1_per_core: number | null;
  busy_pct: number;
  free_mem_gb: number;
}
interface Gate {
  ok: boolean;
  reason: string;
  before: MachineLoad | null;
  limits: { max_load_per_core: number; max_busy_pct: number };
}

const num = (v: string | undefined, d: number): number => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const LIMITS = { max_load_per_core: num(process.env.SW_PERF_MAX_LOAD, 0.3), max_busy_pct: num(process.env.SW_PERF_MAX_BUSY, 25) };
const THROTTLE = num(process.env.SW_PERF_CPU_THROTTLE, 4);
/** The timer's blocks and frames per block (12 x 5 by default; smaller only for a harness dry run, never for evidence). */
const SAMPLES = Math.max(1, Math.round(num(process.env.SW_PERF_SAMPLES, 12)));
const FRAMES = Math.max(1, Math.round(num(process.env.SW_PERF_FRAMES, 5)));
/** A harness dry run (SW_PERF_DRY_RUN=1): any renderer, any sample count, never asserted, the record says `dry_run`. */
const DRY = process.env.SW_PERF_DRY_RUN === '1';
/** The browser of the opt-in part runs on the machine's GPU (SW_PERF_GPU=0 keeps Playwright's default). The switches of the
 * look-dev prototype (CR-029 13.2, tools/capture.mjs): ANGLE on D3D11 on Windows; ANGLE on Vulkan elsewhere. */
const GPU = process.env.SW_PERF_GATE === '1' && process.env.SW_PERF_GPU !== '0';
const GPU_ARGS = process.env.SW_PERF_GPU_ARGS
  ? process.env.SW_PERF_GPU_ARGS.split(/\s+/).filter(Boolean)
  : [process.platform === 'win32' ? '--use-angle=d3d11' : '--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist'];

function cpuTimes(): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    const t = c.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
  }
  return { idle, total };
}

/** The machine's load now: the 1-minute load average (null where the platform has none: Windows) and the CPU busy share
 * sampled over `ms`. */
async function machineLoad(ms = 2000): Promise<MachineLoad> {
  const a = cpuTimes();
  await new Promise((res) => setTimeout(res, ms));
  const b = cpuTimes();
  const cores = os.cpus().length;
  const hasLoad = process.platform !== 'win32';
  const load1 = hasLoad ? os.loadavg()[0] : null;
  const busy = b.total > a.total ? 100 * (1 - (b.idle - a.idle) / (b.total - a.total)) : 0;
  return { platform: process.platform, cores, load1: load1 === null ? null : Math.round(load1 * 100) / 100, load1_per_core: load1 === null ? null : Math.round((load1 / cores) * 1000) / 1000, busy_pct: Math.round(busy * 10) / 10, free_mem_gb: Math.round((os.freemem() / 1024 ** 3) * 10) / 10 };
}

/** Whether the measurement may run: opted in and quiet; the reason either way. */
async function perfGate(): Promise<Gate> {
  if (process.env.SW_PERF_GATE !== '1') return { ok: false, reason: 'PERF_GATE SKIPPED: not opted in (set SW_PERF_GATE=1 in a quiet window; see PLAN_STUDIO_PHASE6_PERF_RUNBOOK.md)', before: null, limits: LIMITS };
  const l = await machineLoad();
  const why: string[] = [];
  if (l.load1_per_core !== null && l.load1_per_core > LIMITS.max_load_per_core) why.push(`1-minute load ${l.load1} on ${l.cores} cores = ${l.load1_per_core} per core > ${LIMITS.max_load_per_core}`);
  if (l.busy_pct > LIMITS.max_busy_pct) why.push(`CPU busy ${l.busy_pct} % > ${LIMITS.max_busy_pct} %`);
  if (DRY) return { ok: true, reason: `PERF_GATE DRY RUN (not evidence): ${why.length ? why.join('; ') : 'machine quiet'}`, before: l, limits: LIMITS };
  if (why.length) return { ok: false, reason: `PERF_GATE SKIPPED: machine busy (${why.join('; ')}) - numbers would be meaningless; rerun in a quiet window`, before: l, limits: LIMITS };
  return { ok: true, reason: `PERF_GATE RUN: load ${l.load1 ?? 'n/a'} (${l.load1_per_core ?? 'n/a'} per core, limit ${LIMITS.max_load_per_core}), CPU busy ${l.busy_pct} % (limit ${LIMITS.max_busy_pct} %), ${l.cores} cores, ${l.free_mem_gb} GB free`, before: l, limits: LIMITS };
}

const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i;

function commit(): string | null {
  try {
    return execSync('git rev-parse HEAD', { cwd: HERE, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return process.env.SW_COMMIT ?? null;
  }
}

/** One JSON record per run under SW_PERF_OUT (default private-evidence/studio6-perf, gitignored), attached as well. No
 * host name, address or serial: platform, CPU model, cores, memory and the WebGL renderer string only. */
async function writeRecord(testInfo: TestInfo, kind: string, record: Record<string, unknown>): Promise<string> {
  const dir = process.env.SW_PERF_OUT || path.resolve(HERE, '..', '..', 'private-evidence', 'studio6-perf');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `${kind}-${testInfo.project.name}-${stamp}.json`);
  const body = JSON.stringify(record, null, 2);
  fs.writeFileSync(file, body + '\n', 'utf8');
  await testInfo.attach(`${kind}.json`, { body, contentType: 'application/json' });
  return file;
}

/** The element over the whole viewport (a phone's 3D stage is the screen), CPU throttled, the floor at the phone rung. */
async function measurementStage(page: Page, el: Locator): Promise<void> {
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
  await page.waitForTimeout(500); // the ResizeObserver resizes the renderer and the post chain
  if (THROTTLE > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  }
}

async function environment(page: Page, el: Locator, testInfo: TestInfo, gate: Gate) {
  const gl = await el.evaluate((n) => (n as unknown as Probe).view.rendererInfo());
  const vp = page.viewportSize();
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  return {
    date: new Date().toISOString(), commit: commit(), project: testInfo.project.name, viewport: vp, device_pixel_ratio: dpr,
    cpu_throttle: THROTTLE, platform: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0]?.model ?? null, cores: os.cpus().length,
    total_mem_gb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10, webgl: gl, browser: testInfo.project.use.channel ?? 'chromium (bundled)', browser_args: GPU ? GPU_ARGS : [],
    dry_run: DRY, evidence_grade: !DRY && SAMPLES === 12 && FRAMES === 5, load_before: gate.before, limits: gate.limits, method: `SceneView.benchFrames: back-to-back frames, one-pixel readback each (GPU-synchronised); 1 warm-up block, ${SAMPLES} blocks x ${FRAMES} frames, median block mean`,
  };
}

// ================================================================================================ 1. always

test.describe('functional and determinism (always)', () => {
  test('the 1,000-object floor: the same input gives the same description and the same scene graph at levels 1, 2 and 3', async ({ page }) => {
    test.setTimeout(600_000);
    // node: the description is a pure function of the input, with and without the realistic part
    const d2 = buildScene(thousandInput(false));
    const d3 = buildScene(thousandInput(true));
    expect(thousandInput(false).doc.objects).toHaveLength(OBJECTS);
    expect(d2.parts.filter((p) => p.kind === 'object').length, 'every object is drawn').toBeGreaterThanOrEqual(OBJECTS);
    expect(JSON.stringify(buildScene(thousandInput(false)))).toBe(JSON.stringify(d2));
    expect(JSON.stringify(buildScene(thousandInput(true)))).toBe(JSON.stringify(d3));
    expect(d3.real, 'the realistic part is carried').toBeTruthy();
    console.log(`S7 floor: ${OBJECTS} objects -> ${d2.parts.length} parts (levels 1-2), ${d3.parts.length} parts + real (level 3)`);
    const el = await openDemo(page);
    for (const level of ['1', '2', '3-lite'] as const) {
      const desc = level === '3-lite' ? d3 : d2;
      await showAt(el, level, desc);
      const a = await settledGraph(el, page);
      const builds = await el.evaluate((n) => (n as unknown as Probe).view.buildCount);
      await el.evaluate((n, d) => { (n as unknown as Probe).description = d; }, JSON.parse(JSON.stringify(desc)) as SceneDescription); // an equal description, a new object
      await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.buildCount), { timeout: 120_000 }).toBeGreaterThan(builds);
      const b = await settledGraph(el, page);
      console.log(`S7 level ${level}: ${a.length} scene nodes, equal after a full rebuild: ${JSON.stringify(a) === JSON.stringify(b)}`);
      expect(b.length, `level ${level}: node count`).toBe(a.length);
      expect(b, `level ${level}: the same graph after a full rebuild`).toEqual(a);
    }
  });

  test('the default stays schematic; auto with a realistic start falls realistic -> lite -> full -> schematic by the probe and says so', async ({ page }) => {
    test.setTimeout(300_000);
    const el = await openDemo(page);
    // R178, second half: nothing chosen anywhere -> schematic (the demo has no installation setting)
    await expect(el).toHaveAttribute('data-quality-mode', 'schematic');
    await expect(el).toHaveAttribute('data-rung', 'schematic');
    await expect(el).toHaveAttribute('data-quality', '1');
    await el.evaluate((n) => {
      const w = window as unknown as { __rungs: string[] };
      w.__rungs = [];
      new MutationObserver(() => w.__rungs.push(String((n as HTMLElement).getAttribute('data-rung')))).observe(n, { attributes: true, attributeFilter: ['data-rung'] });
      const e = (n as unknown as Probe);
      e.viewDials = { ...e.viewDials, default_view: 'realistic' }; // the person's default view is realistic: auto starts at the top rung
      e.minFps = 100000; // no device keeps this: every probe misses
    });
    await el.locator('[data-quality-auto]').click();
    await expect(el).toHaveAttribute('data-quality-mode', 'auto');
    await expect(el).toHaveAttribute('data-rung', 'schematic', { timeout: 240_000 });
    await expect(el).toHaveAttribute('data-quality', '1');
    await expect(el.locator('[data-3d-fallback]')).toBeAttached();
    const seen = await page.evaluate(() => (window as unknown as { __rungs: string[] }).__rungs);
    // every Lit update re-states the attribute: collapse repeats, start at the auto click's first rung
    const runs = seen.filter((r, i) => i === 0 || r !== seen[i - 1]);
    const steps = runs.slice(Math.max(0, runs.indexOf('realistic')));
    console.log(`S7 ladder: ${steps.join(' -> ')}`);
    expect(steps).toEqual(['realistic', 'lite', 'full', 'schematic']);
    expect(await page.evaluate(() => sessionStorage.getItem('sw.plan3d.fallback'))).toBe('1');
    expect(await page.evaluate(() => localStorage.getItem('sw.plan3d.quality'))).toBe('auto'); // the choice stays; the device does not
  });

  test('the texture budget: the library textures of the 1,000-object floor are <= 512 px and under the device class cap', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const el = await openDemo(page);
    await showAt(el, '3-lite', buildScene(thousandInput(true)));
    await settledGraph(el, page);
    const t = await textures(el);
    const lib = t.list.filter((x) => x.src.includes('plan3d/textures/'));
    expect(lib.length, 'the files textures are in use (dial textures = files)').toBeGreaterThan(0);
    for (const x of lib) {
      expect(x.w, x.src).toBeLessThanOrEqual(512);
      expect(x.h, x.src).toBeLessThanOrEqual(512);
    }
    // decoded RGBA with the mip chain (x 4/3): the bytes the GPU holds for them
    const bytes = lib.reduce((s, x) => s + x.w * x.h * 4 * (4 / 3), 0);
    const cap = (testInfo.project.name === 'mobile' ? 48 : 128) * MB;
    console.log(`S7 textures: ${lib.length} library textures, ${(bytes / MB).toFixed(1)} MB decoded (cap ${cap / MB} MB on ${testInfo.project.name}); ${t.mapMats} materials with a colour map, ${t.normalMats} with a normal map`);
    testInfo.annotations.push({ type: 'texture-budget', description: `${lib.length} textures, ${(bytes / MB).toFixed(1)} MB of ${cap / MB} MB` });
    expect(bytes).toBeLessThanOrEqual(cap);
  });

  test('the texture cap: over the budget the material library serves its 256 px variants (CR-029 3.4)', async () => {
    test.fixme(true, 'NOT BUILT: RealMaterials (scene-real.ts) counts no decoded bytes and frontend/public/plan3d/ ships only the 512 px set (no 256 px variants) - S7 notes; the budget itself is asserted by the test above');
  });

  test('the lever table switches really change the scene: textures, normal maps, lamp shadow, DPR, rung', async ({ page }) => {
    test.setTimeout(600_000);
    const el = await openDemo(page);
    const d3 = buildScene(thousandInput(true));
    await showAt(el, '3-lite', d3);
    await settledGraph(el, page);
    // textures: the dial (files <-> procedural) realises the description again without maps
    const on = await textures(el);
    expect(on.mapMats).toBeGreaterThan(0);
    expect(on.normalMats).toBeGreaterThan(0);
    const builds = await el.evaluate((n) => (n as unknown as Probe).view.buildCount);
    await el.evaluate((n) => (n as unknown as Probe).view.setRealSettings({ textures: 'procedural' }));
    await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.buildCount), { timeout: 120_000 }).toBeGreaterThan(builds);
    await settledGraph(el, page);
    const off = await textures(el);
    expect(off.list.filter((x) => x.src.includes('plan3d/textures/'))).toHaveLength(0);
    expect(off.normalMats).toBe(0);
    await el.evaluate((n) => (n as unknown as Probe).view.setRealSettings({ textures: 'files' }));
    await settledGraph(el, page);
    expect((await textures(el)).normalMats).toBe(on.normalMats);
    // normal maps (harness): off strips every normal map, on gives back exactly the same set
    expect(await harnessNormals(el, false)).toBe(on.normalMats);
    expect((await textures(el)).normalMats).toBe(0);
    expect((await textures(el)).mapMats).toBe(on.mapMats); // colour maps stay
    expect(await harnessNormals(el, true)).toBe(on.normalMats);
    expect((await textures(el)).normalMats).toBe(on.normalMats);
    // lamp shadow: the product never lets a pool lamp cast; the harness lever makes exactly one cast, and back to none
    const castingNow = () => el.evaluate((n) => { let c = 0; (n as unknown as Probe).view.scene.traverse((o) => { if (o.type === 'PointLight' && o.castShadow) c++; }); return c; });
    expect(await castingNow()).toBe(0);
    expect(await harnessLampShadow(el, true)).toBe(1);
    expect(Number.isFinite(await el.evaluate((n) => (n as unknown as Probe).view.benchFrames(1)))).toBe(true); // it draws with the cube shadow
    expect(await harnessLampShadow(el, false)).toBe(0);
    // DPR: the realistic rung draws at min(base, cap); the lite rung is pinned at 1 whatever the cap (checked last)
    const base = await page.evaluate(() => Math.min(2, window.devicePixelRatio || 1));
    // the rung: lite = MSAA + bloom, standard glass; realistic = + GTAO, physical (transmission) glass
    const physical = () => el.evaluate((n) => { let c = 0; (n as unknown as Probe).view.scene.traverse((o) => { const m = o.material as { type?: string } | undefined; if (m?.type === 'MeshPhysicalMaterial') c++; }); return c; });
    expect(await el.evaluate((n) => (n as unknown as Probe).view.renderer.getPixelRatio())).toBe(1);
    expect(await el.evaluate((n) => (n as unknown as Probe).view.postPasses)).toEqual(['render-msaa2', 'bloom', 'output']);
    expect(await physical()).toBe(0);
    await el.locator(CHIP['3']).click();
    await expect(el).toHaveAttribute('data-rung', 'realistic');
    await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 120_000 }).toBe(0);
    await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.postPasses), { timeout: 60_000 }).toEqual(['render-msaa2', 'gtao', 'bloom', 'output']);
    const glass = await physical();
    console.log(`S7 levers: realistic rung, ${glass} objects with physical glass`);
    expect(glass).toBeGreaterThan(0);
    for (const cap of [1.5, 1]) {
      await applyDprCap(el, page, cap);
      const ratio = await el.evaluate((n) => (n as unknown as Probe).view.renderer.getPixelRatio());
      const css = await el.evaluate((n) => (n as HTMLElement).getBoundingClientRect().width);
      const px = await el.evaluate((n) => (n as unknown as Probe).view.renderer.domElement.width);
      console.log(`S7 levers: DPR cap ${cap} -> pixel ratio ${ratio} (base ${base}), canvas ${px} px for ${Math.round(css)} css px`);
      expect(ratio).toBe(Math.min(base, cap));
    }
    // a cap changed while the realistic rung already draws is applied at once (ST7DPR; it used to wait for the next rung or
    // level change - PORT-NOTES P21; meaningful where the base ratio is above 1: the mobile project)
    await el.evaluate((n) => (n as unknown as Probe).view.setRealSettings({ dprCap: 2 }));
    expect(await el.evaluate((n) => (n as unknown as Probe).view.renderer.getPixelRatio())).toBe(Math.min(base, 2));
    // back on the lite rung: DPR 1 although the cap is 2
    await el.locator(CHIP['3-lite']).click();
    await expect(el).toHaveAttribute('data-rung', 'lite');
    await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.renderer.getPixelRatio())).toBe(1);
  });
});

// ================================================================================================ 2. opt-in measurement

// Playwright's headless Chromium draws WebGL with SwiftShader unless told otherwise (measured on the workstation: "ANGLE
// (Google, Vulkan 1.3.0 (SwiftShader Device ...))"). The look-dev prototype's GPU switches, opted in with the gate (a
// launch option is per worker: file level, so with SW_PERF_GATE=1 the functional part above runs on the GPU as well).
if (GPU) test.use({ launchOptions: { args: GPU_ARGS } });

test.describe('R178 gate and the lever table - opt-in (SW_PERF_GATE=1 on a quiet machine with a GPU)', () => {
  let gate: Gate = { ok: false, reason: 'PERF_GATE SKIPPED: not evaluated', before: null, limits: LIMITS };
  test.beforeAll(async () => {
    gate = await perfGate();
    console.log(gate.reason);
  });

  /** Skips with the reason in the report when the measurement must not run here; returns the renderer when it may. */
  async function mayMeasure(el: Locator, testInfo: TestInfo): Promise<void> {
    const gl = await el.evaluate((n) => (n as unknown as Probe).view.rendererInfo());
    if (SOFTWARE_GL.test(`${gl.vendor} ${gl.renderer}`) && !DRY) {
      const reason = `PERF_GATE SKIPPED: software WebGL (${gl.renderer}) - a CPU rasteriser says nothing about a phone GPU; GPU launch args ${GPU ? GPU_ARGS.join(' ') : 'off (SW_PERF_GPU=0)'} did not reach a GPU here (SW_PERF_GPU_ARGS overrides; SW_PERF_DRY_RUN=1 runs the harness anyway, without asserting)`;
      console.log(reason);
      testInfo.annotations.push({ type: 'perf-gate', description: reason });
      test.skip(true, reason);
    }
  }

  test('R178: level 3 (realistic lite) on 1,000 objects at 390 px keeps >= 30 fps (median, GPU-synchronised)', async ({ page }, testInfo) => {
    test.setTimeout(900_000);
    test.skip(!gate.ok, gate.reason);
    test.skip(testInfo.project.name !== 'mobile', 'PERF_GATE SKIPPED: R178 is the 390 px gate - run it with --project=mobile');
    const el = await openDemo(page);
    await mayMeasure(el, testInfo);
    const d3 = buildScene(thousandInput(true));
    await showAt(el, '3-lite', d3);
    await settledGraph(el, page);
    await measurementStage(page, el);
    const rows: Record<string, Bench> = {};
    for (const preset of ['iso', 'persp'] as const) {
      await el.locator(`[data-preset-${preset}]`).click();
      await expect(el).toHaveAttribute('data-preset', preset);
      await page.waitForTimeout(600);
      rows[preset] = await bench(el);
      console.log(`PERF R178 ${preset}: median ${rows[preset].median_ms} ms = ${rows[preset].fps} fps, ${rows[preset].calls} draws, ${rows[preset].triangles} triangles, pixel ratio ${rows[preset].pixel_ratio}, canvas ${rows[preset].canvas_px.join('x')}`);
    }
    const after = await machineLoad(1000);
    const record = { kind: 'R178', gate: 'level 3 realistic lite, 1,000 objects, 390 px, >= 30 fps median', objects: OBJECTS, parts: d3.parts.length, ...(await environment(page, el, testInfo, gate)), load_after: after, rows, pass: Object.values(rows).every((r) => r.fps >= 30) };
    const file = await writeRecord(testInfo, 'r178', record);
    console.log(`PERF R178 record: ${file}`);
    if (DRY) console.log('PERF R178 DRY RUN: the harness ran; nothing asserted, the record is not evidence');
    else for (const [preset, r] of Object.entries(rows)) expect(r.fps, `R178 at the ${preset} preset`).toBeGreaterThanOrEqual(30);
  });

  test('the lever table: frame cost per lever on the 1,000-object floor (reported, not asserted)', async ({ page }, testInfo) => {
    test.setTimeout(1_800_000);
    test.skip(!gate.ok, gate.reason);
    const el = await openDemo(page);
    await mayMeasure(el, testInfo);
    const d2 = buildScene(thousandInput(false));
    const d3 = buildScene(thousandInput(true));
    await showAt(el, '3-lite', d3);
    await settledGraph(el, page);
    await measurementStage(page, el);
    const rows: { lever: string; how: string; bench: Bench }[] = [];
    const row = async (lever: string, how: string) => {
      await page.waitForTimeout(400);
      const b = await bench(el);
      rows.push({ lever, how, bench: b });
      console.log(`PERF lever ${lever}: median ${b.median_ms} ms = ${b.fps} fps, ${b.calls} draws, pixel ratio ${b.pixel_ratio}`);
    };
    await row('L3 lite baseline', 'product: textures files, normal maps on, no lamp shadow, DPR 1, sun shadow 1024');
    await el.evaluate((n) => (n as unknown as Probe).view.setRealSettings({ textures: 'procedural' }));
    await settledGraph(el, page);
    await row('L3 lite, textures off', 'product dial textures = procedural');
    await el.evaluate((n) => (n as unknown as Probe).view.setRealSettings({ textures: 'files' }));
    await settledGraph(el, page);
    await harnessNormals(el, false);
    await row('L3 lite, normal maps off', 'harness: normalMap removed from every material');
    await harnessNormals(el, true);
    await harnessLampShadow(el, true);
    await row('L3 lite, lamp shadow on', 'harness: the strongest pool lamp casts a 512 px cube shadow (cached, as the product draws on demand)');
    await harnessLampShadow(el, false);
    await el.locator(CHIP['3']).click();
    await expect(el).toHaveAttribute('data-rung', 'realistic');
    await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 120_000 }).toBe(0);
    for (const cap of [1, 1.25, 1.5, 2]) {
      await applyDprCap(el, page, cap);
      await row(`L3 realistic, DPR cap ${cap}`, 'product dial dpr_cap (GTAO + physical glass + bloom, sun shadow 2048)');
    }
    await showAt(el, '2', d2);
    await settledGraph(el, page);
    await row('L2 full (reference)', 'product level 2');
    await showAt(el, '1', d2);
    await settledGraph(el, page);
    await row('L1 schematic (reference)', 'product level 1');
    const after = await machineLoad(1000);
    const record = { kind: 'levers', objects: OBJECTS, ...(await environment(page, el, testInfo, gate)), load_after: after, rows };
    const file = await writeRecord(testInfo, 'levers', record);
    console.log(`PERF lever record: ${file}`);
    for (const r of rows) expect(Number.isFinite(r.bench.median_ms)).toBe(true);
  });
});
