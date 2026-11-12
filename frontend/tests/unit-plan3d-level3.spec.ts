import { test, expect } from '@playwright/test';
import type { InstancedMesh, Mesh, MeshStandardMaterial, Object3D } from '../src/map/three-bundle';
import { buildScene } from '../src/map/scene-builder';
import { CONTACT_GLSL, DEFAULT_REAL, RealMaterials, buildReal, contactBlob, type RealModels } from '../src/map/scene-real';
import { FLOOR_REFLECT, REFLECT_ON, SSR_FRAG, SSR_STEPS, alphaReflect, floorReflectivity, reflectAlpha } from '../src/map/floor-reflect';
import { FINISH_CERAMIC, FINISH_MARBLE, finishPixels, finishSurfacePixels } from '../src/map/floor-finish';
import { furnitureFamily } from '../src/map/scene-real-builder';
import { CHOICES, DEFAULT_VIEW, PERSONAL_DIALS } from '../src/api/plan-view';
import { PLAN_VIEW_CARD_DIALS, PLAN_VIEW_FLAGS, HINT_HE } from '../src/screens/plan-view-dials';
import type { ScenePart } from '../src/map/scene-builder';
import { SHADOW_PENUMBRA_M, shadowPenumbraTexels } from '../src/map/sun';
import { houseInput } from './lookdev/house';

// PLAN3D-LEVEL3-2435: the realistic level, round 3 - floor reflections (the alpha code, the reflectivity table, the dial), the
// generated floor surface (roughness / AO and the joints' normals), the soft contact shadows (shape, kept out of GTAO's pass)
// and the refined furniture families. Node only.

(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };

const noModels = { pending: 0, version: 1, template: () => null } as unknown as RealModels;
function build(level: string | null) {
  const desc = buildScene(houseInput({ level, walk: false, realistic: true }));
  const mats = new RealMaterials('/', () => {});
  mats.setSource('procedural');
  const settings = { ...DEFAULT_REAL, textures: 'procedural' as const, furniture: 'procedural' as const };
  return { built: buildReal({ desc, real: desc.real!, parts: desc.parts, settings, heavy: false, mats, models: noModels }), desc, mats };
}
const find = (root: Object3D, name: string): Mesh | undefined => {
  let out: Mesh | undefined;
  root.traverse((o) => { if (!out && o.name === name) out = o as Mesh; });
  return out;
};

test('the dial: floor reflections on by default, a personal flag, in the card with a hint', () => {
  expect(DEFAULT_VIEW.floor_reflections).toBe(true);
  expect(DEFAULT_REAL.reflections).toBe(true);
  expect(PERSONAL_DIALS).toContain('floor_reflections');
  expect(PLAN_VIEW_FLAGS).toContain('floor_reflections');
  expect(PLAN_VIEW_CARD_DIALS).toContain('floor_reflections');
  expect(HINT_HE.floor_reflections.length).toBeGreaterThan(10);
  expect((CHOICES as Record<string, unknown>).floor_reflections).toBeUndefined(); // a flag, not a choice
});

test('the reflectivity code: polished finishes most, tiles / wood a little, concrete and carpet not; alpha round trip', () => {
  expect(floorReflectivity(FINISH_MARBLE)).toBe(1);
  expect(floorReflectivity(FINISH_CERAMIC)).toBeGreaterThan(floorReflectivity('tiles_white'));
  expect(floorReflectivity('oak')).toBeGreaterThan(0);
  expect(floorReflectivity('oak')).toBeLessThan(0.5);
  for (const id of ['concrete', 'carpet', 'plaster_white', 'nope']) expect(floorReflectivity(id), id).toBe(0);
  for (const k of Object.values(FLOOR_REFLECT)) {
    const a = reflectAlpha(k);
    expect(a).toBeGreaterThanOrEqual(0.75);
    expect(a).toBeLessThan(1);
    // the code read back through an 8-bit or a half-float channel (1/255 steps) stays within 2 %
    expect(Math.abs(alphaReflect(Math.round(a * 255) / 255) - k)).toBeLessThan(0.02);
  }
  expect(alphaReflect(1)).toBe(0); // every other opaque pixel
  expect(alphaReflect(0)).toBe(0); // the empty background
  expect(alphaReflect(0.5)).toBe(0); // glass over the background
  expect(REFLECT_ON.value).toBe(0); // raised only by the post chain around its own render
  expect(SSR_FRAG).toContain(`#define SW_STEPS ${SSR_STEPS}`);
  expect(SSR_STEPS).toBeLessThanOrEqual(24); // the cost bound of the pass
});

test('the floor materials carry the reflectivity patch; walls and non-reflective floors do not', () => {
  const mats = new RealMaterials('/', () => {});
  mats.setSource('procedural');
  expect(mats.get(FINISH_MARBLE, 'floor').userData.swRefl).toBe(1);
  expect(mats.get('oak', 'floor').userData.swRefl).toBe(floorReflectivity('oak'));
  expect(mats.get('concrete', 'floor').userData.swRefl).toBeUndefined();
  expect(mats.get(FINISH_MARBLE, 'std').userData.swRefl).toBeUndefined(); // only the floor variant
  expect(mats.get('plaster_white', 'std').userData.swRefl).toBeUndefined();
  // the program key separates the patched floors
  const m = mats.get(FINISH_CERAMIC, 'floor') as MeshStandardMaterial;
  expect(m.customProgramCacheKey()).toContain('swrefl1');
  mats.dispose();
});

test('the generated surface: polished body, matte joints, joint normals only, deterministic', () => {
  for (const id of [FINISH_MARBLE, FINISH_CERAMIC]) {
    const a = finishSurfacePixels(id);
    const b = finishSurfacePixels(id);
    expect(Buffer.from(a.rough).equals(Buffer.from(b.rough))).toBe(true);
    expect(Buffer.from(a.normal).equals(Buffer.from(b.normal))).toBe(true);
    const size = Math.sqrt(a.rough.length / 4);
    expect(size).toBe(Math.sqrt(finishPixels(id).length / 4));
    const half = size / 2;
    const at = (x: number, y: number) => (y * size + x) * 4;
    // a joint texel (on the slab edge) is matte and a little occluded; a texel in the middle of the slab is polished
    expect(a.rough[at(0, 7) + 1] / 255).toBeGreaterThan(0.7);
    expect(a.rough[at(0, 7)]).toBeLessThan(255);
    const mid = a.rough[at(half / 2, half / 2) + 1] / 255;
    expect(mid).toBeGreaterThan(0.05);
    expect(mid).toBeLessThan(0.45);
    // the normal map is flat away from the joints and tilts on the bevel
    const flat = at(half / 2, half / 2);
    expect([a.normal[flat], a.normal[flat + 1]]).toEqual([128, 128]);
    const jw = 1;
    const bevel = at(jw, half / 2);
    expect(Math.abs(a.normal[bevel] - 128)).toBeGreaterThan(20);
    for (let i = 3; i < a.normal.length; i += 4) if (a.normal[i] !== 255 || a.rough[i] !== 255) throw new Error(`${id}: alpha at ${i}`);
  }
});

test('the contact shadow: a rounded footprint with a margin by height; out of GTAO; one plate per floor-standing object', () => {
  const rug = contactBlob([3, 0.02, 2.2], false);
  const sofa = contactBlob([2.3, 0.85, 0.95], false);
  const stool = contactBlob([0.4, 0.75, 0.4], true);
  expect([rug.hx, rug.hz]).toEqual([1.5, 1.1]);
  expect(rug.margin).toBeLessThan(0.05);
  expect(sofa.margin).toBeGreaterThan(0.12);
  expect(sofa.margin).toBeLessThanOrEqual(0.16);
  expect(stool.corner).toBe(0.2); // a disc
  expect(sofa.corner).toBeLessThanOrEqual(0.04);
  expect(CONTACT_GLSL).toContain('swContact');
  const { built } = build('L0');
  const blobs = find(built.root, 'ao-blobs') as unknown as InstancedMesh;
  const strips = find(built.root, 'ao-strips');
  expect(blobs).toBeTruthy();
  expect(blobs.userData.skipAO).toBe(true); // ST7-odd / PLAN3D-LEVEL3-2435: a decal never draws into the AO's normal pass
  expect(strips?.userData.skipAO).toBe(true);
  // a single upward plate per instance (the zero-height box drew a downward face over the upward one in the normal pass)
  const pos = blobs.geometry.getAttribute('position');
  expect(pos.count).toBe(4);
  const n = blobs.geometry.getAttribute('normal');
  for (let i = 0; i < n.count; i++) expect(n.getY(i)).toBeCloseTo(1, 5);
  const box = blobs.geometry.getAttribute('aBox');
  expect(box.count).toBe(blobs.count);
  expect(box.itemSize).toBe(4);
});

function familyParts(item: string, size: [number, number, number]): { id: string; material: string; size: number[] }[] {
  const out: { id: string; material: string; size: number[] }[] = [];
  const p = { id: 'obj:t', kind: 'object', shape: 'box', position: [0, size[2] / 2, 0], size: [size[0], size[2], size[1]], rotation: [0, 0, 0], level_id: 'L0', userData: { id: 't', kind: 'object' } } as unknown as ScenePart;
  furnitureFamily(item, p, 'fabric_grey', (q) => out.push({ id: q.id, material: q.material, size: q.size }));
  return out;
}

test('the refined families: sofa with gapped cushions and two scatter cushions, a dining table with an apron, two pillows on a wide bed', () => {
  const sofa = familyParts('sofa.3', [2.3, 0.9, 0.85]);
  expect(sofa.filter((p) => p.id.includes('~cushion')).length).toBe(3);
  expect(sofa.filter((p) => p.id.includes('~backcushion')).length).toBe(3);
  expect(sofa.filter((p) => p.id.includes('~pillow')).map((p) => p.material)).toEqual(['linen', 'linen']);
  expect(sofa.length).toBeLessThanOrEqual(16); // a bounded part count (merged per material anyway)
  const arm = familyParts('armchair', [0.85, 0.85, 0.8]);
  expect(arm.some((p) => p.id.includes('~pillow'))).toBe(false); // too narrow for scatter cushions
  const table = familyParts('table.dining', [1.8, 0.9, 0.75]);
  expect(table.filter((p) => p.id.includes('~apron')).length).toBe(4);
  expect(familyParts('table.side', [0.5, 0.5, 0.55]).some((p) => p.id.includes('~apron'))).toBe(false);
  const bed = familyParts('bed.hospital', [1.6, 2.0, 0.6]);
  expect(bed.filter((p) => p.id.includes('~pillow')).length).toBe(2);
  expect(familyParts('bed.exam', [0.7, 1.9, 0.7]).filter((p) => p.id.includes('~pillow')).length).toBe(1);
});

test('the realistic sun penumbra: about 7 cm wherever the shadow map allows, within 2 .. the style cap', () => {
  // the look-dev house: a ~12 m box on a 2048 map (1.2 cm texels) -> ~6 texels; a 60 m hall -> the floor of 2; a tiny room -> the cap
  const house = shadowPenumbraTexels(11.9, 2048, 8);
  expect(house * ((2 * 11.9) / 2048)).toBeCloseTo(SHADOW_PENUMBRA_M, 2);
  expect(shadowPenumbraTexels(60, 2048, 8)).toBe(2);
  expect(shadowPenumbraTexels(3, 2048, 8)).toBe(8);
  expect(shadowPenumbraTexels(11.9, 1024, 8)).toBeLessThan(house);
});
