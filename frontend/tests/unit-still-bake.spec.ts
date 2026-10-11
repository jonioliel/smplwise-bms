import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoRooms } from '../src/fixtures/demo';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { buildScene, type SceneDescription, type ScenePart, type SceneZone } from '../src/map/scene-builder';
import { controlSceneInput } from '../src/map/skin-control';
import { BANDS, DEFAULT_BAKE_SETTING, VIEW_PRESETS, bandAt, bandScene, buildMask, convexHull, expectedSlots, isoCamera, isoProject, needsBake, recipeRank, slotName, stillDescription,
  stillPalette, sunElevationDeg, type BundleBakes, type StillRenderer } from '../src/map/still-bake';
import { LADDER, ladderNext, viewMode, type ViewInputs } from '../src/map/quality-ladder';
import { AO_REACH_M, bakeLightmap, hemisphere, lightmapPlan, lightmapUv, roomAt, roomBlendWeights, roomsOf } from '../src/map/lightmap-bake';
import { runBake, type BakeUpload } from '../src/map/bake-runner';

// Plan Studio 6, slice S3 (CR-029 sections 3.2-3.4 / 5.3 / 8; docs/changes/CR-029-ST7-S3-NOTES.md) in node: the slots agree with
// the backend, the time bands, the frozen style palettes, the still's description, the iso still camera and the masks
// (deterministic), the quality ladder and the view decision, the lightmap baker (AO near walls and under furniture, lamp light
// blocked by walls, determinism, the atlas plan and UVs, per-room blend weights where stale never lights), and the bake job with
// fake renderer / uploads (order, masks after the first picture, skip, no-WebGL leftovers, cancel, lease heartbeat, failures).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'services', 'plan_bakes.py');

const input = demoSceneInput('f0')!;
const zones: SceneZone[] = demoRooms('f0').map((r, i) => ({ id: `z${i}`, name: `חדר ${i}`, polygon: [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }], level_id: 'L0' }));
const base = { ...input, zones };
const off = (): SceneDescription => buildScene(controlSceneInput(base, 'all_off'));
const on = (): SceneDescription => buildScene(controlSceneInput(base, 'all_on'));

test.describe('slots and settings agree with the backend', () => {
  test('the default setting and the slot names / order', () => {
    const py = fs.readFileSync(BACKEND, 'utf8');
    const m = /SETTING_DEFAULT: dict\[str, Any\] = (\{[\s\S]*?\n\})/.exec(py);
    expect(m).toBeTruthy();
    const json = m![1].replace(/'/g, '"').replace(/True/g, 'true').replace(/False/g, 'false').replace(/,\s*\}/g, '}');
    const { presets, ...writable } = DEFAULT_BAKE_SETTING; // presets is derived from bake_views on both sides
    expect(JSON.parse(json)).toEqual(writable);
    expect(presets).toEqual(VIEW_PRESETS[DEFAULT_BAKE_SETTING.bake_views]);
    expect(/VIEW_PRESETS: dict\[str, list\[str\]\] = \{"iso": \["iso"\], "iso_top": \["iso", "top"\]\}/.test(py)).toBe(true);
    expect(DEFAULT_BAKE_SETTING.bake_trigger).toBe('manual'); // owner 2026-10-11: manual by default
    expect(expectedSlots(['L0'], { ...DEFAULT_BAKE_SETTING, presets: VIEW_PRESETS.iso_top }).filter((x) => x.kind === 'mask').map(slotName)).toEqual(['mask/L0/iso', 'mask/L0/top']);
    const names = expectedSlots(['L0'], DEFAULT_BAKE_SETTING).map(slotName);
    expect(names.length).toBe(14);
    expect(names.slice(0, 3)).toEqual(['mask/L0/iso', 'still/L0/iso/light/day/off', 'still/L0/iso/light/day/on']);
    expect(names[13]).toBe('lightmap/L0');
    expect(new Set(names).size).toBe(names.length);
  });
});

test.describe('time bands', () => {
  test('sun elevation against reference values (about 1 degree) and the band limits', () => {
    // solar noon at 34.8 E is about 09:41 UTC: elevation = 90 - |lat - declination|
    expect(sunElevationDeg(new Date('2026-06-21T09:41:00Z'), 32, 34.8)).toBeGreaterThan(80.4);
    expect(sunElevationDeg(new Date('2026-06-21T09:41:00Z'), 32, 34.8)).toBeLessThan(82.4);
    expect(Math.abs(sunElevationDeg(new Date('2026-03-20T09:47:00Z'), 32, 34.8) - 58)).toBeLessThan(1.2);
    expect(Math.abs(sunElevationDeg(new Date('2026-12-21T09:38:00Z'), 32, 34.8) - 34.6)).toBeLessThan(1.2);
    expect(bandAt(new Date('2026-06-21T09:00:00Z'))).toBe('day');
    expect(bandAt(new Date('2026-06-21T01:00:00Z'))).toBe('night');
    // around sunset in Tel Aviv on 21 June (about 16:50 UTC): the minutes either side are 'sunset'
    expect(bandAt(new Date('2026-06-21T16:50:00Z'))).toBe('sunset');
    expect(BANDS.map((b) => bandScene(b).night)).toEqual([false, false, true]);
  });
});

test.describe('palettes and the still description', () => {
  test('each style is a frozen palette from the token table', () => {
    const light = stillPalette('light');
    const dark = stillPalette('dark');
    expect(Object.isFrozen(light) && Object.isFrozen(dark)).toBe(true);
    expect(light['map-wall-3d']).toBe('#d7dde6');
    expect(dark['map-wall-3d']).toBe('#2b3547');
    expect(stillPalette('light')).toBe(light); // cached: the same object every time
  });

  test('one level, no sprites / cameras / entities, glows and lit plates only in the on variant', () => {
    const d0 = stillDescription(off(), 'L0', 'off');
    const d1 = stillDescription(on(), 'L0', 'on');
    expect(d0.parts.every((p) => p.level_id === 'L0' && p.shape !== 'sprite' && !['camera', 'cone', 'entity', 'marker', 'chip', 'label'].includes(p.kind))).toBe(true);
    expect(d0.parts.some((p) => p.kind === 'glow')).toBe(false);
    expect(d1.parts.filter((p) => p.kind === 'glow').length).toBe(on().parts.filter((p) => p.kind === 'glow' && p.level_id === 'L0').length); // every glow of the level survives
    expect(d1.parts.some((p) => p.kind === 'tint' && p.id.endsWith('#lit'))).toBe(true);
    expect(JSON.stringify(stillDescription(off(), 'L0', 'off'))).toBe(JSON.stringify(d0)); // deterministic
  });
});

test.describe('iso still camera and masks', () => {
  test('the projection maps the extent inside the picture and the masks are deterministic', () => {
    const d = stillDescription(off(), 'L0', 'off');
    const cam = isoCamera(d, 1600, 1000);
    const pr = isoProject(cam);
    const t = cam.frame!.target;
    const centre = pr([t[0], t[1], t[2]])!;
    expect(centre[0]).toBeCloseTo(800, 6);
    expect(centre[1]).toBeCloseTo(500, 6);
    const live = buildScene(base);
    const a = buildMask(off(), 'L0', cam, pr, live);
    const b = buildMask(off(), 'L0', isoCamera(stillDescription(off(), 'L0', 'off'), 1600, 1000), isoProject(cam), live);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.version).toBe(1);
    expect(a.rooms.map((r) => r.id)).toEqual(zones.map((z) => z.id).sort());
    for (const r of a.rooms) {
      expect(r.floor.length).toBeGreaterThanOrEqual(3);
      for (const [x, y] of [...r.floor, ...r.top, r.centre]) {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(1600);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(1000);
      }
      // the lifted outline sits higher on the picture (smaller y) than the floor outline
      expect(Math.min(...r.top.map((p) => p[1]))).toBeLessThan(Math.min(...r.floor.map((p) => p[1])));
    }
    expect(a.doors.map((x) => x.id)).toEqual(input.doc.openings.map((o) => o.id).sort());
    expect(a.doors.every((x) => x.points.length >= 3 && x.points.length <= 16)).toBe(true);
    expect(a.cameras.length).toBe(live.parts.filter((p) => p.kind === 'camera' && p.level_id === 'L0').length);
    // the backend's mask rules: the size and ids travel
    expect(JSON.stringify(a).length).toBeLessThan(256 * 1024);
  });

  test('convex hull', () => {
    expect(convexHull([[0, 0], [2, 0], [1, 1], [2, 2], [0, 2], [1, 0.5]])).toEqual([[0, 0], [2, 0], [2, 2], [0, 2]]);
  });
});

test.describe('the quality ladder and the view decision', () => {
  test('one rung down; stills only with a bake; the walk never leaves to a picture', () => {
    expect(LADDER).toEqual(['realistic', 'lite', 'full', 'schematic', 'stills', '2d']);
    expect(ladderNext('realistic', true)).toBe('lite');
    expect(ladderNext('schematic', true)).toBe('stills');
    expect(ladderNext('schematic', false)).toBe('2d');
    expect(ladderNext('schematic', true, true)).toBe('schematic');
    expect(ladderNext('stills', true)).toBe('2d');
  });

  test('what a host shows', () => {
    const base: ViewInputs = { webgl: true, wallDisplay: false, wallMode: 'live', idle: false, exhausted: false, hasStills: true, want3d: true };
    expect(viewMode(base)).toBe('live');
    expect(viewMode({ ...base, want3d: false })).toBe('2d');
    expect(viewMode({ ...base, wallDisplay: true })).toBe('live'); // the wall display stays live by default
    expect(viewMode({ ...base, wallDisplay: true, wallMode: 'stills' })).toBe('stills');
    expect(viewMode({ ...base, wallDisplay: true, wallMode: 'stills', hasStills: false })).toBe('live'); // no bake: never a blank wall
    expect(viewMode({ ...base, wallDisplay: true, idle: true })).toBe('stills');
    expect(viewMode({ ...base, wallMode: 'stills' })).toBe('live'); // the dial is for wall displays only
    expect(viewMode({ ...base, webgl: false })).toBe('stills');
    expect(viewMode({ ...base, webgl: false, hasStills: false })).toBe('2d');
    expect(viewMode({ ...base, exhausted: true })).toBe('stills');
  });
});

test.describe('bake status', () => {
  const bundle = (over: Partial<BundleBakes> = {}): BundleBakes => ({ bake_key: 'k', complete: true, stale_count: 0, recipes: ['still-q2.1', 'mask-1', 'lightmap-1'],
    levels: { L0: { stills: { 'iso/light/day/off': { url: 'u', width: 1600, height: 1000, recipe: 'still-q2.1' } }, masks: {}, lightmap: null } }, ...over });
  test('none / stale / incomplete / older recipe / current', () => {
    expect(needsBake(null, 'still-q2.1')).toBe('none');
    expect(needsBake(bundle({ levels: {}, stale_count: 3 }), 'still-q2.1')).toBe('stale');
    expect(needsBake(bundle({ complete: false }), 'still-q2.1')).toBe('incomplete');
    expect(needsBake(bundle(), 'still-q2.1')).toBeNull();
    expect(needsBake(bundle(), 'still-q3.1')).toBe('older_recipe');
    expect(recipeRank('still-q3.2')).toEqual([3, 2]);
    expect(recipeRank('mask-1')).toEqual([0, 0]);
  });
});

// ---- the lightmap ---------------------------------------------------------------------------------------------------------

const part = (id: string, kind: ScenePart['kind'], position: [number, number, number], size: [number, number, number], extra: Partial<ScenePart> = {}): ScenePart => ({
  id, kind, shape: 'box', position, size, rotation: [0, 0, 0], color: 'map-wall-3d', opacity: 1, group: null, level_id: 'L0', userData: { id, kind }, ...extra,
});
/** A 6 x 4 m room: a floor plate, a wall along x = 3 (2.8 m high), a 0.75 m table at (1.5, 2), a lamp at (4.5, 2.6, 2). */
function room(): SceneDescription {
  const parts: ScenePart[] = [
    part('plate', 'floor', [3, -0.05, 2], [6, 0.1, 4], { color: 'map-room-fill' }),
    part('wall', 'wall', [3, 1.4, 2], [0.2, 2.8, 4]),
    part('table', 'object', [1.5, 0.725, 2], [1.2, 0.05, 0.8]),
    part('glow', 'glow', [4.5, 2.6, 2], [6, 0, 0], { shape: 'light', color: 'map-glow' }),
  ];
  return { version: 'scene-1', units: 'm', estimated: false, scale_m_per_px: 0.01, size: [600, 400], centre: [3, 0, 2], levels: [{ id: 'L0', elevation_m: 0, ceiling_height_m: 2.8 }], parts, groups: {},
    stats: { parts: parts.length, instanced: 0, groups: 0, walls: 1, objects: 1, cameras: 0, entities: 0 } };
}
const texel = (r: { width: number; rgba: Uint8ClampedArray; meta: { texel_m: number; surfaces: { world: number[] }[] } }, x: number, z: number, ch: 0 | 1) => {
  const s = r.meta.surfaces[0];
  const c = Math.floor((x - s.world[0]) / r.meta.texel_m);
  const row = Math.floor((z - s.world[1]) / r.meta.texel_m);
  return r.rgba[(row * r.width + c) * 4 + ch];
};

test.describe('the lightmap baker', () => {
  test('the hemisphere set is fixed, unit and upward', () => {
    const a = hemisphere(64);
    expect(JSON.stringify(a)).toBe(JSON.stringify(hemisphere(64)));
    for (const v of a) {
      expect(Math.hypot(...v)).toBeCloseTo(1, 9);
      expect(v[1]).toBeGreaterThan(0);
    }
  });

  test('AO darkens near the wall and under the table; the lamp lights its side only; same bytes every time', async () => {
    const d = room();
    const plan = lightmapPlan(d, 'L0');
    expect(plan.cols).toBe(60);
    expect(plan.rows).toBe(40);
    expect([plan.width, plan.height]).toEqual([64, 64]);
    const r = await bakeLightmap(d, 'L0', { samples: 32 });
    const open = texel(r, 5.6, 0.4, 0);
    const byWall = texel(r, 3.2, 2, 0);
    const under = texel(r, 1.5, 2, 0);
    expect(open).toBeGreaterThan(235);
    expect(byWall).toBeLessThan(open - 30);
    expect(under).toBeLessThan(open - 60);
    const lampSide = texel(r, 4.5, 2, 1);
    const behindWall = texel(r, 2.5, 2, 1);
    expect(lampSide).toBeGreaterThan(30);
    expect(behindWall).toBe(0);
    const again = await bakeLightmap(room(), 'L0', { samples: 32 });
    expect(Buffer.from(again.rgba).equals(Buffer.from(r.rgba))).toBe(true);
    expect(r.meta.surfaces[0].uv).toEqual([0, 0, 60 / 64, 40 / 64]);
    expect(r.meta.channels).toEqual({ ao: 'r', lamps: 'g' });
    expect(AO_REACH_M).toBe(2.5);
  });

  test('a large venue grows the texel so the atlas side stays capped', () => {
    const d = room();
    d.parts[0] = part('plate', 'floor', [100, -0.05, 60], [200, 0.1, 120]);
    const plan = lightmapPlan(d, 'L0');
    expect(plan.width).toBeLessThanOrEqual(512);
    expect(plan.texel).toBeGreaterThanOrEqual(200 / 512);
  });

  test('UVs, rooms and blend weights (stale / unknown never lights)', () => {
    const s = { kind: 'floor' as const, level_id: 'L0', uv: [0, 0, 0.5, 0.25] as [number, number, number, number], world: [0, 0, 10, 5] as [number, number, number, number], y: 0 };
    expect(lightmapUv(s, 5, 2.5)).toEqual([0.25, 0.125]);
    expect(lightmapUv(s, 11, 2)).toBeNull();
    const rooms = [{ id: 'a', polygon: [[0, 0], [2, 0], [2, 2], [0, 2]] as [number, number][] }];
    expect(roomAt(rooms, 1, 1)).toBe('a');
    expect(roomAt(rooms, 3, 1)).toBeNull();
    expect(roomBlendWeights({ b: { lit: true }, a: { lit: null }, c: { lit: false } })).toEqual({ a: 0, b: 1, c: 0 });
    const demoRoomsOf = roomsOf(on(), 'L0');
    expect(demoRoomsOf.map((r) => r.id)).toEqual(zones.map((z) => z.id).sort());
  });
});

// ---- the bake job ---------------------------------------------------------------------------------------------------------

class FakeRenderer implements StillRenderer {
  readonly recipe = 'still-q2.1';
  readonly quality = 2;
  calls: string[] = [];
  disposed = 0;
  failOn: string | null = null;
  async render(describe: (v: 'off' | 'on') => SceneDescription, req: { levelId: string; preset: string; style: string; band: string; variant: 'off' | 'on'; width: number; height: number }) {
    const key = `${req.levelId}/${req.preset}/${req.style}/${req.band}/${req.variant}`;
    if (this.failOn === key) throw new Error('WebGL lost');
    describe(req.variant);
    this.calls.push(key);
    return { blob: new Blob([key], { type: 'image/webp' }), project: isoProject(isoCamera(stillDescription(describe('off'), req.levelId, 'off'), req.width, req.height)), renderer: 'fake', ms: 1 };
  }
  dispose() {
    this.disposed++;
  }
}

function deps(over: Partial<Parameters<typeof runBake>[0]> = {}) {
  const uploads: BakeUpload[] = [];
  const d: Parameters<typeof runBake>[0] = {
    bakeKey: 'k'.repeat(64), levels: ['L0'], setting: { ...DEFAULT_BAKE_SETTING, styles: ['light'], bands: ['day', 'night'], size: '1280x800' },
    describe: (v) => (v === 'on' ? on() : off()), live: buildScene(base), renderer: new FakeRenderer(),
    upload: async (u) => { uploads.push(u); }, encodePng: async (w, h) => new Blob([`png ${w}x${h}`], { type: 'image/png' }), yieldNow: async () => undefined,
    lightmap: { samples: 8, maxSide: 64 }, ...over,
  };
  return { d, uploads };
}

test.describe('the bake job', () => {
  test('every slot in order, the mask right after the first picture, then the lightmap', async () => {
    const { d, uploads } = deps();
    const progress: number[] = [];
    const out = await runBake({ ...d, onProgress: (n) => progress.push(n) });
    expect(out.failed).toEqual([]);
    expect(out.left).toEqual([]);
    expect(uploads.map((u) => slotName(u.slot))).toEqual(['still/L0/iso/light/day/off', 'mask/L0/iso', 'still/L0/iso/light/day/on', 'still/L0/iso/light/night/off', 'still/L0/iso/light/night/on', 'lightmap/L0']);
    expect(progress).toEqual([1, 2, 3, 4, 5, 6]);
    const mask = JSON.parse(await uploads[1].file.text());
    expect([mask.width, mask.height, mask.preset]).toEqual([1280, 800, 'iso']);
    expect(uploads[1].recipe).toBe('mask-1');
    expect(uploads[0].meta).toEqual({ renderer: 'fake', ms: 1, quality: 2 });
    expect(uploads[5].recipe).toBe('lightmap-1');
    expect((uploads[5].meta as { surfaces: unknown[] }).surfaces.length).toBe(1);
    expect((d.renderer as FakeRenderer).disposed).toBe(1);
  });

  test('skip, only, no WebGL, a failed picture, cancel and the lease heartbeat', async () => {
    let r = deps();
    let out = await runBake({ ...r.d, skip: new Set(['still/L0/iso/light/day/off']), only: new Set(['still/L0/iso/light/day/off', 'still/L0/iso/light/day/on', 'mask/L0/iso']) });
    expect(out.skipped).toEqual(['still/L0/iso/light/day/off']);
    // the first picture was skipped (already current): the iso mask needs no picture and goes at once
    expect(r.uploads.map((u) => slotName(u.slot))).toEqual(['mask/L0/iso', 'still/L0/iso/light/day/on']);

    r = deps({ renderer: null });
    out = await runBake(r.d);
    expect(out.left).toEqual(['still/L0/iso/light/day/off', 'still/L0/iso/light/day/on', 'still/L0/iso/light/night/off', 'still/L0/iso/light/night/on']);
    expect(r.uploads.map((u) => slotName(u.slot))).toEqual(['mask/L0/iso', 'lightmap/L0']); // iso masks are pure; the lightmap needs no WebGL

    const fr = new FakeRenderer();
    fr.failOn = 'L0/iso/light/night/off';
    r = deps({ renderer: fr });
    out = await runBake(r.d);
    expect(out.failed).toEqual([{ slot: 'still/L0/iso/light/night/off', error: 'WebGL lost' }]);
    expect(r.uploads.length).toBe(5);

    let n = 0;
    r = deps();
    out = await runBake({ ...r.d, cancelled: () => ++n > 3 });
    expect(out.cancelled).toBe(true);
    expect(r.uploads.length).toBeLessThan(6);

    let t = 0;
    let beats = 0;
    r = deps();
    await runBake({ ...r.d, now: () => (t += 100_000), heartbeat: async () => { beats++; }, heartbeatMs: 240_000 });
    expect(beats).toBeGreaterThan(0);
  });
});
