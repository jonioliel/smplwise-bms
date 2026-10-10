/**
 * Real-model furniture path (owner Q10: real models AND the procedural catalog, switchable in settings).
 *
 * A manifest maps catalog item ids to glTF files under assets/models/ (CC0 only; every file has a LICENSES.md row).
 * The loader is lazy (one fetch per model id, cached), the mesh is instanced per (item id, palette slot) and scaled to
 * the object's authored size, and the material slots are REPLACED by the style palette (the kit's own textures are not
 * used, so both styles keep their palette). Any item without a model falls back to the procedural catalog per item -
 * that is why `place()` returns false. Levels 1-2 always draw the procedural boxes (CR-029 §6.3).
 *
 * No model file is in the repository yet (the download list awaits the owner): the manifest below is the proposed
 * mapping onto the Kenney furniture kit; the loader path is exercised with an in-code test model (a bevelled block)
 * so the switch, the scaling, the palette slot replacement and the fallback are verified without any download.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

/** Per-slot surface response for the kit (G1): the palette gives the colour, this gives the material its feel. */
const SLOT_ROUGHNESS = { carpet: 0.9, carpetWhite: 0.85, wood: 0.55, woodDark: 0.55, metal: 0.35, metalLight: 0.3, metalMedium: 0.35, metalDark: 0.4, plant: 0.8, lamp: 0.6, glass: 0.1, _defaultMat: 0.6 };
const CREASE = (35 * Math.PI) / 180;

/**
 * item id -> { file, slots: { <glTF material name>: <palette id> } }. The Kenney Furniture Kit 2.0 (CC0, downloaded
 * 2026-10-09 with the owner's approval, LICENSES.md) names its material slots wood / woodDark / metal / metalLight /
 * metalMedium / metalDark / carpet / carpetWhite / plant / lamp / glass / _defaultMat (tools/inspect-glb.mjs); the
 * palette id per slot below is what gives both styles their colour. Every file is 72-992 triangles, 6.6-64 KB.
 */
export const MODEL_MANIFEST = {
  'sofa.3seat': { file: 'assets/models/loungeSofa.glb', slots: { carpet: 'fabric_accent', wood: 'wood_dark' } },
  'chair.basic': { file: 'assets/models/chair.glb', slots: { wood: 'wood_dark' } },
  'chair.office': { file: 'assets/models/chairDesk.glb', slots: { carpet: 'leather', metalMedium: 'metal_dark' } },
  'table.dining': { file: 'assets/models/table.glb', slots: { wood: 'oak' } },
  'table.coffee': { file: 'assets/models/tableCoffee.glb', slots: { wood: 'wood_dark' } },
  'table.desk': { file: 'assets/models/desk.glb', slots: { wood: 'wood_light', metal: 'metal_dark' } },
  'cabinet.tv': { file: 'assets/models/cabinetTelevision.glb', slots: { wood: 'wood_dark' } },
  'cabinet.bookcase': { file: 'assets/models/bookcaseOpen.glb', slots: { wood: 'wood_dark' } },
  'cabinet.wardrobe': { file: 'assets/models/cabinetBed.glb', slots: { wood: 'wood_light', metal: 'metal_light' } },
  'cabinet.low': { file: 'assets/models/cabinetBedDrawer.glb', slots: { wood: 'wood_light', metal: 'metal_light', _defaultMat: 'wood_dark' } },
  'bed.double': { file: 'assets/models/bedDouble.glb', slots: { wood: 'wood_light', metal: 'metal_light', carpetWhite: 'linen', carpet: 'fabric_grey' } },
  'bed.single': { file: 'assets/models/bedSingle.glb', slots: { wood: 'wood_light', metal: 'metal_light', carpetWhite: 'linen', carpet: 'fabric_grey' } },
  'kitchen.fridge': { file: 'assets/models/kitchenFridgeLarge.glb', slots: { metalLight: 'metal_light', metalMedium: 'metal_dark' } },
  // kitchen.counter: NOT mapped - a single cabinet module stretched to a 3-4 m run reads wrong; the port tiles modules (LOOK_SPEC §13), the prototype keeps the procedural run
  // kitchen.island: NOT mapped (round 2, G10) - one kitchen language per room, the procedural island matches the counters
  'plant.pot': { file: 'assets/models/plantSmall1.glb', slots: { wood: 'concrete', plant: 'grass' } },
  'sanitary.wc': { file: 'assets/models/toilet.glb', slots: { carpetWhite: 'tiles_white', metalLight: 'metal_light', metalDark: 'metal_dark', _defaultMat: 'tiles_white' } },
  'sanitary.basin': { file: 'assets/models/bathroomSink.glb', slots: { carpetWhite: 'tiles_white', metalLight: 'metal_light', _defaultMat: 'tiles_white' } },
  'sanitary.tub': { file: 'assets/models/bathtub.glb', slots: { carpetWhite: 'tiles_white', metalLight: 'metal_light', metalDark: 'metal_dark' } },
  'appliance.washer': { file: 'assets/models/washerDryerStacked.glb', slots: { metalMedium: 'metal_light', metalLight: 'metal_light', metalDark: 'metal_dark', metal: 'metal_dark', glass: 'metal_dark', _defaultMat: 'metal_light' } },
  // light.*: NOT mapped - lamps are devices (bulb, glow sprite, pool light) and stay procedural
};

export class ModelLibrary {
  constructor(lib, opts = {}) {
    this.lib = lib; // MaterialLibrary (palette tints)
    this.loader = new GLTFLoader();
    this.cache = new Map(); // item id -> { scene (template), bbox } | null (failed / absent)
    this.pending = new Map();
    this.onLoaded = opts.onLoaded || null; // rebuild hook
    this.testModel = !!opts.testModel; // serve the in-code block for every id (verifies the path without files)
    this.manifest = MODEL_MANIFEST;
  }

  /** Is a template ready for the id? Kicks off the fetch the first time; the caller falls back until it arrives. */
  template(itemId) {
    if (this.cache.has(itemId)) return this.cache.get(itemId);
    const row = this.manifest[itemId];
    if (!row) { this.cache.set(itemId, null); return null; }
    if (this.testModel) { const t = this.makeTestModel(itemId); this.cache.set(itemId, t); return t; }
    if (!this.pending.has(itemId)) {
      const p = new Promise((resolve) => {
        this.loader.load(row.file, (gltf) => {
          const scene = gltf.scene;
          // G1: smooth the curved parts of the low-poly kit, keep edges sharper than 35 deg crisp
          scene.traverse((m) => { if (m.isMesh) { const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry; m.geometry = toCreasedNormals(g, CREASE); } });
          scene.updateMatrixWorld(true);
          const bbox = new THREE.Box3().setFromObject(scene);
          this.cache.set(itemId, { scene, bbox, row });
          resolve(true);
          this.onLoaded && this.onLoaded(itemId);
        }, undefined, () => { this.cache.set(itemId, null); resolve(false); });
      });
      this.pending.set(itemId, p);
    }
    return undefined; // not yet
  }

  /** An in-code stand-in: a bevelled block with two "material slots" - exercises scaling + slot replacement. */
  makeTestModel(itemId) {
    const row = this.manifest[itemId];
    const g = new THREE.Group();
    const slots = Object.keys(row.slots);
    const body = new THREE.Mesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.08), new THREE.MeshStandardMaterial({ name: slots[0] }));
    body.position.y = 0.5;
    g.add(body);
    if (slots[1]) { const top = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.12, 0.9, 2, 0.04), new THREE.MeshStandardMaterial({ name: slots[1] })); top.position.y = 1.0; g.add(top); }
    g.updateMatrixWorld(true);
    return { scene: g, bbox: new THREE.Box3().setFromObject(g), row, test: true };
  }

  /**
   * Place a model for a plan object; returns false when no model is available (procedural fallback).
   * The template is cloned, scaled so its bbox matches the object's authored (w, d, h), the material slots are swapped
   * for the palette materials, and the clone is added to the level group with the object's yaw.
   */
  place(itemId, o, x, y, z, yaw, group, L, plan) {
    const t = this.template(itemId);
    if (!t) return false;
    const size = new THREE.Vector3();
    t.bbox.getSize(size);
    const { w_m: w, d_m: d, h_m: h } = o.size;
    // proportion-preserving scale (G1): uniform by the smallest ratio, then at most 15 % stretch per axis toward the authored box
    const s = new THREE.Vector3(size.x > 1e-6 ? w / size.x : 1, size.y > 1e-6 ? h / size.y : 1, size.z > 1e-6 ? d / size.z : 1);
    const uniform = Math.min(s.x, s.y, s.z);
    const sx = Math.min(s.x, uniform * 1.15), sy = Math.min(s.y, uniform * 1.15), sz = Math.min(s.z, uniform * 1.15);
    const ctr = new THREE.Vector3();
    t.bbox.getCenter(ctr);
    // world matrix of the object: translate(x, y, z) * rotateY(yaw) * scale * translate(-centre.x, -min.y, -centre.z)
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(sx, sy, sz));
    m.multiply(new THREE.Matrix4().makeTranslation(-ctr.x, -t.bbox.min.y, -ctr.z));
    // luminance jitter per object (G1): repeats of one item never share the exact tone
    const jitter = 1 + ((Math.sin((x * 12.9898 + z * 78.233) * 43758.5453) % 1) * 0.1 - 0.05);
    this.pending = this.pending || new Map();
    const key = `${L.id}|${itemId}`;
    if (!this.pending.has(key)) this.pending.set(key, { itemId, group, L, list: [] });
    this.pending.get(key).list.push({ matrix: m, jitter, o });
    return true;
  }

  /**
   * After a level's objects are collected: one InstancedMesh per (item id, kit mesh) with the palette material of its
   * slot (G8 - draw calls), per-instance colour = the jitter; placed meshes are not pickable devices (furniture only).
   */
  flush(levelId) {
    if (!this.pending) return;
    for (const [key, p] of [...this.pending]) {
      if (!key.startsWith(`${levelId}|`)) continue;
      this.pending.delete(key);
      const t = this.template(p.itemId);
      if (!t) continue;
      const meshes = [];
      t.scene.traverse((m) => { if (m.isMesh) meshes.push(m); });
      for (const src of meshes) {
        const slot = src.material && src.material.name;
        const pid = (t.row.slots && t.row.slots[slot]) || 'wood_light';
        const mat = this.lib.get(pid, 3, { roughness: SLOT_ROUGHNESS[slot] ?? 0.6 });
        const im = new THREE.InstancedMesh(src.geometry, mat, p.list.length);
        const local = src.matrixWorld.clone();
        const tmp = new THREE.Matrix4();
        p.list.forEach((inst, i) => { tmp.multiplyMatrices(inst.matrix, local); im.setMatrixAt(i, tmp); im.setColorAt(i, new THREE.Color(inst.jitter, inst.jitter, inst.jitter)); });
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.castShadow = true; im.receiveShadow = true;
        im.userData = { kind: 'model', item: p.itemId, test: !!t.test, count: p.list.length };
        p.group.add(im);
      }
    }
  }
}
