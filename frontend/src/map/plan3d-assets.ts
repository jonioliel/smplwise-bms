/**
 * Plan Studio 6, slice S1 (CR-029 section 6, LOOK_SPEC section 13): where the realistic level finds its CC0 files. The
 * files live under `public/plan3d/` (served next to index.html, relative URLs - the Ingress rule) with their licence and
 * provenance in `public/plan3d/MANIFEST.json` (scripts/plan3d_manifest.py; unit-plan3d-assets.spec.ts checks the files
 * against it). Pure: names and URLs only, no three, no fetch.
 *
 * Textures: per material id a hue-free colour detail map (`textures/<id>/color.webp`), per source set a NormalGL map and
 * a packed AO (R) + roughness (G) map (`textures/sets/<Set>/{normal,rough_ao}.jpg`). The set of an id is the library's
 * `set` field (materials.json). `plaster_ceiling` has no set: a plain matte ceiling (LOOK_SPEC section 2, L4).
 *
 * Models: the Kenney Furniture Kit 2.0 files the owner approved (2026-10-09), mapped onto the PRODUCT catalog's item ids
 * (the prototype's ids such as `sofa.3seat` do not exist in the catalog: recorded in CR-029-ST7-PORT-NOTES.md). The kit's
 * material slot names map to library ids, so both styles keep their palette; lamps and screens stay procedural.
 */
import { MATERIALS } from './material-resolve';

export const PLAN3D_BASE = 'plan3d/';

/** Material ids whose colour detail map is another id's (the same source set, no own file). */
const COLOR_FROM: Record<string, string> = { door_metal: 'metal_light' };

export interface TextureUrls {
  color: string;
  normal: string;
  roughAo: string;
}

/** The three texture files of a material id, or null when the id has no file set (procedural / plain). */
export function textureUrls(materialId: string, base = PLAN3D_BASE): TextureUrls | null {
  const def = MATERIALS.find((m) => m.id === materialId);
  if (!def || !def.set) return null;
  const colorId = COLOR_FROM[def.id] ?? def.id;
  return { color: `${base}textures/${colorId}/color.webp`, normal: `${base}textures/sets/${def.set}/normal.jpg`, roughAo: `${base}textures/sets/${def.set}/rough_ao.jpg` };
}

export interface ModelEntry {
  /** The file under plan3d/models/ (without the folder). */
  file: string;
  /** Kit material slot -> library material id (unlisted slots take `fallback`). */
  slots: Record<string, string>;
  fallback: string;
  /** Tile the module along the object's width every `tile_m` metres (kitchen runs; LOOK_SPEC section 13 rule). */
  tile_m?: number;
}

/** Per-slot surface response (LOOK_SPEC R2 G1): the palette gives the colour, this the feel. */
export const SLOT_ROUGHNESS: Record<string, number> = { carpet: 0.9, carpetWhite: 0.85, wood: 0.55, woodDark: 0.55, metal: 0.35, metalLight: 0.3, metalMedium: 0.35, metalDark: 0.4, plant: 0.8, lamp: 0.6, glass: 0.1, _defaultMat: 0.6 };

const SOFA: ModelEntry = { file: 'loungeSofa.glb', slots: { carpet: 'fabric_accent', wood: 'wood_dark' }, fallback: 'fabric_accent' };
const CHAIR: ModelEntry = { file: 'chair.glb', slots: { wood: 'wood_dark' }, fallback: 'wood_dark' };
const FRIDGE: ModelEntry = { file: 'kitchenFridgeLarge.glb', slots: { metalLight: 'metal_light', metalMedium: 'metal_dark' }, fallback: 'metal_light' };

/** Product catalog item id -> kit model (LOOK_SPEC section 13.2, re-keyed onto the catalog 2026.10.1 ids). */
export const MODEL_MAP: Readonly<Record<string, ModelEntry>> = {
  'sofa.2': SOFA,
  'sofa.3': SOFA,
  'chair.basic': CHAIR,
  'chair.folding': CHAIR,
  'chair.office': { file: 'chairDesk.glb', slots: { carpet: 'leather', metalMedium: 'metal_dark' }, fallback: 'metal_dark' },
  'table.dining': { file: 'table.glb', slots: { wood: 'oak' }, fallback: 'oak' },
  'table.desk': { file: 'desk.glb', slots: { wood: 'wood_light', metal: 'metal_dark' }, fallback: 'wood_light' },
  'cabinet.low': { file: 'cabinetBedDrawer.glb', slots: { wood: 'wood_light', metal: 'metal_light', _defaultMat: 'wood_dark' }, fallback: 'wood_light' },
  'shelf.unit': { file: 'bookcaseOpen.glb', slots: { wood: 'wood_dark' }, fallback: 'wood_dark' },
  'fridge.domestic': FRIDGE,
  'fridge.kitchen': FRIDGE,
  'toilet.standard': { file: 'toilet.glb', slots: { carpetWhite: 'tiles_white', metalLight: 'metal_light', metalDark: 'metal_dark', _defaultMat: 'tiles_white' }, fallback: 'tiles_white' },
  'sink.bathroom': { file: 'bathroomSink.glb', slots: { carpetWhite: 'tiles_white', metalLight: 'metal_light', _defaultMat: 'tiles_white' }, fallback: 'tiles_white' },
  bathtub: { file: 'bathtub.glb', slots: { carpetWhite: 'tiles_white', metalLight: 'metal_light', metalDark: 'metal_dark' }, fallback: 'tiles_white' },
  // LOOK_SPEC section 13 rule: a kitchen run is NOT one stretched module - the module repeats every 0.6 m along the run
  'kitchenette.counter': { file: 'kitchenCabinet.glb', slots: { wood: 'wood_light', metal: 'metal_light', metalLight: 'metal_light', _defaultMat: 'concrete' }, fallback: 'wood_light', tile_m: 0.6 },
};

/** Every model file the product ships (the approved list less the unmapped floor lamp; some files wait for catalog items). */
export const MODEL_FILES: readonly string[] = ['bathroomSink.glb', 'bathtub.glb', 'bedDouble.glb', 'bedSingle.glb', 'bookcaseOpen.glb', 'cabinetBed.glb', 'cabinetBedDrawer.glb', 'cabinetTelevision.glb', 'chair.glb', 'chairDesk.glb', 'desk.glb', 'kitchenCabinet.glb', 'kitchenFridgeLarge.glb', 'loungeSofa.glb', 'plantSmall1.glb', 'table.glb', 'tableCoffee.glb', 'toilet.glb', 'washerDryerStacked.glb'];

export const modelUrl = (file: string, base = PLAN3D_BASE): string => `${base}models/${file}`;
