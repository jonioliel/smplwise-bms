import { test, expect } from '@playwright/test';
import { buildScene, entityMeta, entityStateWords, type SceneAnchor, type SceneInput } from '../src/map/scene-builder';
import { stateLabel } from '../src/api/ha';
import { autoStart, drawnRung, gpuClass, probeVerdict, type GpuFacts } from '../src/map/quality-ladder';
import { ISO_RIGHT, ISO_UP, contentExtent, glowPoolWanted, insetFractions, isoFitFrame, isoFrame, perspFit, sceneExtent, type Extent } from '../src/map/scene-frame';
import { demoSceneInput } from '../src/fixtures/demo-3d';

// PLAN3D-POLISH-2430, the node half: the pill words (item 1), the glow pool rule (item 6), the `auto` start by GPU class (item 8) and
// the live framing maths (item 2). The browser half is evidence-plan3d-polish-2430.spec.ts.

const anchor = (id: string, resource_id: string, extra: Partial<SceneAnchor> = {}): SceneAnchor => ({
  id, resource_type: 'ha_entity', resource_id, x: 0.5, y: 0.5, rotation: 0, fov: null, radius: null, polygon: null, level_id: null, layer_id: 'sensors', label: id, state: null, online: null, mount_height_m: null, tilt_deg: null, ...extra,
});

test.describe('item 1: the 3D pills say what the rest of the UI says', () => {
  test('entityStateWords is api/ha stateLabel with the device class and the unit', () => {
    const door = { domain: 'binary_sensor', device_class: 'door', unit: null };
    expect(entityStateWords('binary_sensor.front', 'on', door)).toBe('פתוחה');
    expect(entityStateWords('binary_sensor.front', 'off', door)).toBe('סגורה');
    expect(entityStateWords('binary_sensor.w', 'on', { domain: 'binary_sensor', device_class: 'window', unit: null })).toBe('פתוח');
    expect(entityStateWords('binary_sensor.m', 'on', { domain: 'binary_sensor', device_class: 'motion', unit: null })).toBe('תנועה');
    expect(entityStateWords('sensor.t', '22.5', { domain: 'sensor', device_class: 'temperature', unit: '°C' })).toBe('22.5 °C');
    expect(entityStateWords('sensor.p', '41', { domain: 'sensor', device_class: 'power', unit: 'W' })).toBe('41 W');
    expect(entityStateWords('light.l', 'on', { domain: 'light', device_class: null, unit: null, attributes: { brightness: 128 } })).toBe('דולק · 50%');
    expect(entityStateWords('lock.f', 'unlocked', null)).toBe('פתוח'); // the domain from the id: the words of the device cards
    expect(entityStateWords('binary_sensor.x', 'on', null)).toBe('פעיל'); // no device class known: never "דולק" for a sensor
    expect(entityStateWords('sensor.t', null, { domain: 'sensor', device_class: 'temperature', unit: '°C' })).toBe(''); // stale: the colour says it
    expect(entityStateWords('sensor.t', 'unavailable', null)).toBe('לא זמין');
    // the same function as every other screen
    for (const [state, meta] of [['on', { domain: 'binary_sensor', device_class: 'door', unit: null }], ['19.25', { domain: 'sensor', device_class: 'temperature', unit: '°C' }]] as const)
      expect(entityStateWords('x.y', state, meta)).toBe(stateLabel({ domain: meta.domain, state, unit: meta.unit, device_class: meta.device_class, attributes: {} }));
  });

  test('the scene carries them on the entity pills', () => {
    const base = demoSceneInput('f0')!;
    const input: SceneInput = {
      ...base,
      anchors: [
        anchor('door', 'binary_sensor.door', { layer_id: 'doors', entity_meta: { domain: 'binary_sensor', device_class: 'door', unit: null } }),
        anchor('temp', 'sensor.temp', { x: 0.3, entity_meta: { domain: 'sensor', device_class: 'temperature', unit: '°C' } }),
        anchor('bare', 'binary_sensor.bare', { x: 0.7 }),
      ],
      entityStates: { 'binary_sensor.door': 'on', 'sensor.temp': '21.4', 'binary_sensor.bare': 'on' },
    };
    const desc = buildScene(input);
    const text = (id: string) => desc.parts.find((p) => p.id === `ent:${id}`)?.text;
    expect(text('door')).toBe('door · פתוחה');
    expect(text('temp')).toBe('temp · 21.4 °C');
    expect(text('bare')).toBe('bare · פעיל');
  });

  test('entityMeta keeps only what the words read', () => {
    expect(entityMeta({ domain: 'light', device_class: null, unit: null, attributes: { brightness: 200, friendly_name: 'x', rgb: [1, 2, 3] } })).toEqual({ domain: 'light', device_class: null, unit: null, attributes: { brightness: 200 } });
    expect(entityMeta({ domain: 'light', device_class: null, unit: null, attributes: { brightness: 200 } }, false)).toEqual({ domain: 'light', device_class: null, unit: null });
    expect(entityMeta(null)).toBeNull();
  });
});

test('item 6: the glow pool is in the scene where it lights something', () => {
  expect(glowPoolWanted(1, false)).toBe(false); // an unlit schematic floor: no point lights in its shaders
  expect(glowPoolWanted(1, true)).toBe(true); // a schematic lamp that glows keeps its light
  expect(glowPoolWanted(2, false)).toBe(true);
  expect(glowPoolWanted(3, false)).toBe(true);
});

test.describe('item 8: auto starts at realistic lite on a capable GPU', () => {
  const facts = (renderer: string, extra: Partial<GpuFacts> = {}): GpuFacts => ({ renderer, webgl2: true, maxTexture: 16384, cores: 8, memoryGb: 8, ...extra });
  test('gpuClass', () => {
    expect(gpuClass(facts('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002503) Direct3D11 vs_5_0 ps_5_0, D3D11)'))).toBe('capable');
    expect(gpuClass(facts('ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)'))).toBe('capable');
    expect(gpuClass(facts('Apple M2'))).toBe('capable');
    expect(gpuClass(facts('Apple GPU'))).toBe('capable');
    expect(gpuClass(facts('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'))).toBe('capable');
    expect(gpuClass(facts('Adreno (TM) 730'))).toBe('capable');
    expect(gpuClass(facts('Mali-G78 MC24'))).toBe('capable');
    // weak: software renderers, old families, small devices
    expect(gpuClass(facts('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)'))).toBe('weak');
    expect(gpuClass(facts('llvmpipe (LLVM 15.0.7, 256 bits)'))).toBe('weak');
    expect(gpuClass(facts('Microsoft Basic Render Driver'))).toBe('weak');
    expect(gpuClass(facts('Mali-T860'))).toBe('weak');
    expect(gpuClass(facts('Adreno (TM) 506'))).toBe('weak');
    expect(gpuClass(facts('ANGLE (Intel, Intel(R) HD Graphics 4000 Direct3D11 vs_5_0 ps_5_0, D3D11)'))).toBe('weak');
    expect(gpuClass(facts('NVIDIA GeForce RTX 3060', { webgl2: false }))).toBe('weak');
    expect(gpuClass(facts('NVIDIA GeForce RTX 3060', { maxTexture: 2048 }))).toBe('weak');
    expect(gpuClass(facts('Apple GPU', { cores: 2 }))).toBe('weak');
    expect(gpuClass(facts('Apple GPU', { memoryGb: 2 }))).toBe('weak');
    // unknown: masked or unlisted
    expect(gpuClass(facts(''))).toBe('unknown');
    expect(gpuClass(facts('WebKit WebGL'))).toBe('unknown');
    expect(gpuClass(facts('NVIDIA GeForce RTX 3060', { cores: null, memoryGb: null }))).toBe('capable'); // a browser that does not say: no penalty
  });
  test('autoStart / drawnRung: the new start; a chosen rung and the probe as before', () => {
    expect(autoStart('schematic', 2, 'capable')).toBe('lite');
    expect(autoStart('schematic', 2, 'weak')).toBe('full'); // the start of before
    expect(autoStart('schematic', 2, 'unknown')).toBe('full');
    expect(autoStart('schematic', 2)).toBe('full');
    expect(autoStart('schematic', null, 'weak')).toBe('schematic');
    expect(autoStart('realistic', 2, 'weak')).toBe('realistic'); // the person's default view still wins
    expect(drawnRung('auto', autoStart('schematic', 2, 'capable'), null)).toBe('lite');
    expect(drawnRung('full', autoStart('schematic', 2, 'capable'), null)).toBe('full'); // a rung the person chose stays
    expect(drawnRung('schematic', 'lite', null)).toBe('schematic');
    // the probe still steps a slow capable device down: lite -> full -> schematic, one rung per probe
    expect(probeVerdict('auto', 'lite', 12)).toEqual({ fallback: 'full', hint: null });
    expect(drawnRung('auto', 'lite', 'full')).toBe('full');
    expect(probeVerdict('auto', 'full', 12)).toEqual({ fallback: 'schematic', hint: null });
  });
});

test.describe('item 2: the live framing', () => {
  const e: Extent = { x0: 2, x1: 22, z0: 3, z1: 17, y0: 0, y1: 6 };
  const proj = (f: ReturnType<typeof isoFitFrame>, p: [number, number, number]) => {
    const v = [p[0] - f.target[0], p[1] - f.target[1], p[2] - f.target[2]];
    return [(v[0] * ISO_RIGHT[0] + v[1] * ISO_RIGHT[1] + v[2] * ISO_RIGHT[2]) / f.halfW, (v[0] * ISO_UP[0] + v[1] * ISO_UP[1] + v[2] * ISO_UP[2]) / f.halfH];
  };
  const cornersOf = (x: Extent): [number, number, number][] => [x.x0, x.x1].flatMap((a) => [x.y0, x.y1].flatMap((b) => [x.z0, x.z1].map((c): [number, number, number] => [a, b, c])));

  test('isoFitFrame: no insets = isoFrame at the same pad; the box touches the frame on its limiting axis', () => {
    const a = isoFrame(e, 1.8, 1.03);
    const b = isoFitFrame(e, 1.8, undefined, 1.03);
    expect(b.halfH).toBeCloseTo(a.halfH, 9);
    expect(b.halfW).toBeCloseTo(a.halfW, 9);
    b.target.forEach((v, i) => expect(v).toBeCloseTo(a.target[i], 9));
    const pts = cornersOf(e).map((p) => proj(b, p));
    const ys = pts.map((p) => p[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(2 / 1.03, 6); // height-limited at 1.8: fills the height less the pad
  });

  test('isoFitFrame with insets: the box sits centred in the free part and inside it', () => {
    const ins = insetFractions({ top: 60, right: 16, bottom: 80, left: 16 }, 1300, 720);
    const f = isoFitFrame(e, 1300 / 720, ins);
    const pts = cornersOf(e).map((p) => proj(f, p));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    // NDC of the free part
    const fx0 = -1 + 2 * ins.left;
    const fx1 = 1 - 2 * ins.right;
    const fy0 = -1 + 2 * ins.bottom;
    const fy1 = 1 - 2 * ins.top;
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(fx0 - 1e-9);
    expect(Math.max(...xs)).toBeLessThanOrEqual(fx1 + 1e-9);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(fy0 - 1e-9);
    expect(Math.max(...ys)).toBeLessThanOrEqual(fy1 + 1e-9);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo((fy0 + fy1) / 2, 6);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo((fx0 + fx1) / 2, 6);
  });

  test('perspFit: every corner in the free part, the larger span close to it (iso direction and straight down)', () => {
    const ins = insetFractions({ top: 60, right: 16, bottom: 80, left: 16 }, 1300, 720);
    for (const dir of [[0.62, 0.53, 0.62], [0, 1, 0]] as [number, number, number][]) {
      const aspect = 1300 / 720;
      const p = perspFit(e, dir, 50, aspect, ins);
      // project with the same basis
      const f = [p.target[0] - p.position[0], p.target[1] - p.position[1], p.target[2] - p.position[2]];
      const fl = Math.hypot(f[0], f[1], f[2]);
      const F = f.map((v) => v / fl);
      const rl = Math.hypot(F[2], F[0]);
      const R = rl < 1e-6 ? [1, 0, 0] : [-F[2] / rl, 0, F[0] / rl];
      const U = [R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0]];
      const t = Math.tan((25 * Math.PI) / 180);
      const ndc = cornersOf(e).map((c) => {
        const v = [c[0] - p.position[0], c[1] - p.position[1], c[2] - p.position[2]];
        const z = v[0] * F[0] + v[1] * F[1] + v[2] * F[2];
        return [(v[0] * R[0] + v[1] * R[1] + v[2] * R[2]) / (z * t * aspect), (v[0] * U[0] + v[1] * U[1] + v[2] * U[2]) / (z * t)];
      });
      const xs = ndc.map((q) => q[0]);
      const ys = ndc.map((q) => q[1]);
      const slack = 0.03;
      expect(Math.min(...xs), `${dir}`).toBeGreaterThanOrEqual(-1 + 2 * ins.left - slack);
      expect(Math.max(...xs), `${dir}`).toBeLessThanOrEqual(1 - 2 * ins.right + slack);
      expect(Math.min(...ys), `${dir}`).toBeGreaterThanOrEqual(-1 + 2 * ins.bottom - slack);
      expect(Math.max(...ys), `${dir}`).toBeLessThanOrEqual(1 - 2 * ins.top + slack);
      const fill = Math.max((Math.max(...xs) - Math.min(...xs)) / (2 - 2 * ins.left - 2 * ins.right), (Math.max(...ys) - Math.min(...ys)) / (2 - 2 * ins.top - 2 * ins.bottom));
      expect(fill, `${dir}`).toBeGreaterThan(0.9);
    }
  });

  test('contentExtent: the drawn building, not the plan sheet', () => {
    const base = demoSceneInput('f0')!;
    // a plan sheet with wide empty margins: one walled room in its middle (the default level's plate is the whole sheet)
    const wall = { ...base.doc.walls[0], id: 'w-mid', polyline: [[0.35, 0.35], [0.65, 0.35], [0.65, 0.65], [0.35, 0.65], [0.35, 0.35]] as [number, number][] };
    const desc = buildScene({ ...base, anchors: [], doc: { ...base.doc, walls: [wall], openings: [], objects: [] } });
    const sheet = sceneExtent(desc);
    const content = contentExtent(desc);
    expect(content.x1 - content.x0).toBeLessThan((sheet.x1 - sheet.x0) * 0.75);
    expect(content.z1 - content.z0).toBeLessThan((sheet.z1 - sheet.z0) * 0.75);
    expect(content.x0).toBeGreaterThanOrEqual(sheet.x0);
    expect(content.x1).toBeLessThanOrEqual(sheet.x1);
    const walls = desc.parts.filter((p) => p.kind === 'wall');
    for (const w of walls) {
      expect(w.position[0]).toBeGreaterThan(content.x0);
      expect(w.position[0]).toBeLessThan(content.x1);
    }
  });

  test('insetFractions keeps at least 40 % of each side free', () => {
    const f = insetFractions({ top: 400, right: 0, bottom: 400, left: 10 }, 1000, 500);
    expect(f.top + f.bottom).toBeCloseTo(0.6, 9);
    expect(f.left).toBeCloseTo(0.01, 9);
  });
});
