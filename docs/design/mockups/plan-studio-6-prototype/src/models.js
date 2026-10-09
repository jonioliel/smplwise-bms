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
  'kitchen.island': { file: 'assets/models/kitchenCabinet.glb', slots: { wood: 'wood_light', woodDark: 'concrete', metal: 'metal_light' } },
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
    const q = 3;
    const clone = t.scene.clone(true);
    const size = new THREE.Vector3();
    t.bbox.getSize(size);
    const { w_m: w, d_m: d, h_m: h } = o.size;
    const s = new THREE.Vector3(size.x > 1e-6 ? w / size.x : 1, size.y > 1e-6 ? h / size.y : 1, size.z > 1e-6 ? d / size.z : 1);
    const uniform = Math.min(s.x, s.y, s.z);
    // keep proportions when the kit model is close to the authored size; stretch only within 15 %
    const sx = Math.min(s.x, uniform * 1.15), sy = Math.min(s.y, uniform * 1.15), sz = Math.min(s.z, uniform * 1.15);
    const ctr = new THREE.Vector3();
    t.bbox.getCenter(ctr);
    clone.traverse((m) => {
      if (!m.isMesh) return;
      const slot = m.material && m.material.name;
      const pid = (t.row.slots && t.row.slots[slot]) || 'wood_light';
      m.material = this.lib.get(pid, q);
      m.castShadow = true; m.receiveShadow = true;
      m.userData = { kind: 'model', item: itemId };
    });
    const holder = new THREE.Group();
    holder.add(clone);
    clone.position.set(-ctr.x * sx, -t.bbox.min.y * sy, -ctr.z * sz);
    clone.scale.set(sx, sy, sz);
    holder.position.set(x, y, z);
    holder.rotation.y = yaw;
    holder.userData = { kind: 'model', item: itemId, test: !!t.test };
    group.add(holder);
    return true;
  }
}
