/**
 * Procedural PBR material library (CR-029 §6 stand-in, look-dev version). Every texture is generated at load time on a
 * canvas: a NEUTRAL detail colour map (luminance variation around mid-light grey, hue-free), a height field turned into a
 * tangent-space normal map (Sobel), and a roughness map. The colour of a material comes from the STYLE PALETTE
 * (style.js) multiplied in as `material.color`, so the same detail set serves both styles and a CC0 file set can replace
 * it by id without touching the palette. Tiling is in metres (tile_m) with REAL sizes: oak plank 0.2 x 1.2 m, grey
 * floor tile 0.6 m, white tile 0.3 m, plaster 2 m. Floors / walls are 512 px, small-scale sets 256 px.
 */
import * as THREE from 'three';
import { STYLES } from './style.js';

// deterministic value noise (seeded) so the textures are the same on every load
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function valueNoise(size, cells, seed) {
  const r = rng(seed);
  const grid = new Float32Array((cells + 1) * (cells + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const out = new Float32Array(size * size);
  const sm = (t) => t * t * (3 - 2 * t);
  const row = new Float32Array(cells + 1);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells;
    const y0 = Math.floor(fy), ty = sm(fy - y0);
    const y1 = (y0 + 1) % cells;
    for (let c = 0; c <= cells; c++) row[c] = grid[(y0 % cells) * (cells + 1) + (c % cells)] * (1 - ty) + grid[y1 * (cells + 1) + (c % cells)] * ty;
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const x0 = Math.floor(fx), tx = sm(fx - x0);
      out[y * size + x] = row[x0 % cells] * (1 - tx) + row[(x0 + 1) % cells] * tx;
    }
  }
  return out;
}
function fbm(size, seed, octaves = 4, base = 4) {
  const out = new Float32Array(size * size);
  let amp = 0.5, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise(size, base << o, seed + o * 97);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function makeTexture(data, size, srgb, aniso = 8) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = aniso;
  tex.needsUpdate = true;
  return tex;
}

/** Height (0..1 Float32Array) -> tangent-space normal map RGBA bytes. */
function normalFromHeight(h, size, strength) {
  const out = new Uint8ClampedArray(size * size * 4);
  const S = size;
  for (let y = 0; y < S; y++) {
    const ym = ((y - 1 + S) % S) * S, y0 = y * S, yp = ((y + 1) % S) * S;
    for (let x = 0; x < S; x++) {
      const xm = (x - 1 + S) % S, xp = (x + 1) % S;
      const dx = (h[ym + xp] + 2 * h[y0 + xp] + h[yp + xp]) - (h[ym + xm] + 2 * h[y0 + xm] + h[yp + xm]);
      const dy = (h[yp + xm] + 2 * h[yp + x] + h[yp + xp]) - (h[ym + xm] + 2 * h[ym + x] + h[ym + xp]);
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y0 + x) * 4;
      out[i] = (nx * 0.5 + 0.5) * 255; out[i + 1] = (ny * 0.5 + 0.5) * 255; out[i + 2] = (nz * 0.5 + 0.5) * 255; out[i + 3] = 255;
    }
  }
  return out;
}
/** Grey detail map from a 0..1 luminance array around `mid` (0..255), amplitude `amp`. */
function greyFrom(lum, size, mid = 200, amp = 40, tint = [1, 1, 1]) {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0, j = 0; i < lum.length; i++, j += 4) {
    const v = mid + (lum[i] - 0.5) * 2 * amp;
    out[j] = v * tint[0]; out[j + 1] = v * tint[1]; out[j + 2] = v * tint[2]; out[j + 3] = 255;
  }
  return out;
}
function greyRough(rough, size) {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0, j = 0; i < rough.length; i++, j += 4) { const v = Math.max(0, Math.min(1, rough[i])) * 255; out[j] = v; out[j + 1] = v; out[j + 2] = v; out[j + 3] = 255; }
  return out;
}

/** Recipes: each returns { lum: Float32Array 0..1 (detail), height, rough, mid, amp, tint? }. All hue-free. */
const RECIPES = {
  /** planks: `across` planks per tile, staggered by half a tile; a 1.5 px gap line. */
  planks(S, seed, across = 6, grainAmp = 0.35) {
    const grain = fbm(S, seed, 5, 2);
    const plankW = S / across;
    const r = rng(seed + 11);
    const offsets = Array.from({ length: across }, () => Math.floor(r() * S));
    const tints = Array.from({ length: across }, () => 0.88 + r() * 0.24);
    const lum = new Float32Array(S * S), height = new Float32Array(S * S), rough = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = Math.floor(x / plankW);
      const yy = (y + offsets[p]) % S;
      const g = grain[yy * S + ((x * 3) % S)];
      const stripe = 0.5 + 0.5 * Math.sin((x / plankW) * Math.PI * 9 + g * 11);
      const gap = (x % plankW) < 1.5 || (yy % S) < 1.5;
      const i = y * S + x;
      lum[i] = gap ? 0.2 : Math.min(1, (0.5 + (g - 0.5) * grainAmp + (stripe - 0.5) * 0.12) * tints[p]);
      height[i] = gap ? 0 : 0.75 + 0.25 * g;
      rough[i] = gap ? 0.9 : 0.42 + 0.2 * g;
    }
    return { lum, height, rough, mid: 196, amp: 46, tint: [1, 0.98, 0.95] };
  },
  tiles(S, seed, per = 2, groutPx = 3, glossy = false) {
    const n = fbm(S, seed, 3, 8);
    const tw = S / per;
    const lum = new Float32Array(S * S), height = new Float32Array(S * S), rough = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const grout = (x % tw) < groutPx || (y % tw) < groutPx;
      const tx = Math.floor(x / tw), ty = Math.floor(y / tw);
      const v = 0.5 + (n[i] - 0.5) * 0.5 + (((tx * 7 + ty * 13) % 5) - 2) * 0.025;
      lum[i] = grout ? 0.32 : v;
      height[i] = grout ? 0 : 1 - n[i] * 0.06;
      rough[i] = grout ? 0.95 : glossy ? 0.18 + n[i] * 0.1 : 0.4 + n[i] * 0.15;
    }
    return { lum, height, rough, mid: 206, amp: 22 };
  },
  plaster(S, seed, amp = 0.12) {
    const n = fbm(S, seed, 5, 6);
    const rough = new Float32Array(S * S);
    for (let i = 0; i < rough.length; i++) rough[i] = 0.82 + n[i] * 0.15;
    const lum = new Float32Array(S * S);
    for (let i = 0; i < lum.length; i++) lum[i] = 0.5 + (n[i] - 0.5) * amp * 2;
    return { lum, height: n, rough, mid: 214, amp: 14 };
  },
  concrete(S, seed) {
    const n = fbm(S, seed, 6, 3);
    const spots = valueNoise(S, 64, seed + 5);
    const lum = new Float32Array(S * S), rough = new Float32Array(S * S);
    for (let i = 0; i < lum.length; i++) { lum[i] = 0.5 + (n[i] - 0.5) * 0.7 + (spots[i] > 0.94 ? -0.2 : 0); rough[i] = 0.7 + n[i] * 0.25; }
    return { lum, height: n, rough, mid: 200, amp: 30 };
  },
  fabric(S, seed, weaveF = 0.8, amp = 0.5) {
    const n = fbm(S, seed, 5, 24);
    const lum = new Float32Array(S * S), height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const weave = 0.5 + 0.5 * Math.sin(x * weaveF) * Math.sin(y * weaveF);
      lum[i] = 0.5 + ((n[i] - 0.5) * 0.6 + (weave - 0.5) * 0.4) * amp;
      height[i] = n[i] * 0.6 + weave * 0.4;
    }
    const rough = new Float32Array(S * S).fill(0.92);
    return { lum, height, rough, mid: 200, amp: 26 };
  },
  wood(S, seed, ringF = 0.12) {
    const n = fbm(S, seed, 4, 2);
    const lum = new Float32Array(S * S), rough = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const ring = 0.5 + 0.5 * Math.sin(y * ringF + n[i] * 7);
      lum[i] = 0.5 + (ring - 0.5) * 0.5 + (n[i] - 0.5) * 0.4;
      rough[i] = 0.38 + n[i] * 0.2;
    }
    return { lum, height: n, rough, mid: 200, amp: 28, tint: [1, 0.98, 0.95] };
  },
  metal(S, seed) {
    // brushed: fine noise stretched along u (streaks), low amplitude - not a hammered surface
    const n = fbm(S, seed, 3, 4);
    const lum = new Float32Array(S * S), rough = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x; const streak = n[((y * 7) % S) * S + (x % S)]; lum[i] = 0.5 + (streak - 0.5) * 0.5; rough[i] = 0.3 + streak * 0.15; }
    return { lum, height: lum, rough, mid: 215, amp: 10 };
  },
  leather(S, seed) {
    const n = fbm(S, seed, 6, 20);
    const lum = new Float32Array(S * S), rough = new Float32Array(S * S);
    for (let i = 0; i < lum.length; i++) { lum[i] = n[i]; rough[i] = 0.45 + n[i] * 0.3; }
    return { lum, height: n, rough, mid: 205, amp: 22 };
  },
  grass(S, seed) {
    const n = fbm(S, seed, 6, 10);
    const rough = new Float32Array(S * S).fill(0.95);
    return { lum: n, height: n, rough, mid: 205, amp: 40 };
  },
};

/**
 * The library manifest: id -> recipe + tile size in metres + normal strength + resolution. Mirrors the CR §6.2 ids; the
 * tile sizes are REAL (plan L4): a tile that reads as a 0.6 m floor tile repeats every 1.2 m with 2 tiles per side.
 */
export const LIBRARY = {
  plaster_white: { size: 512, recipe: (S) => RECIPES.plaster(S, 31, 0.1), tile_m: 2.0, normal: 0.35, roughness: 1 },
  plaster_exterior: { size: 512, recipe: (S) => RECIPES.plaster(S, 47, 0.16), tile_m: 2.0, normal: 0.9, roughness: 1 },
  plaster_ceiling: { size: 256, recipe: (S) => RECIPES.plaster(S, 53, 0.03), tile_m: 3.0, normal: 0.04, roughness: 1 }, // plain matte ceiling (plan L4)
  concrete: { size: 512, recipe: (S) => RECIPES.concrete(S, 61), tile_m: 2.5, normal: 1.2, roughness: 1 },
  tiles_white: { size: 512, recipe: (S) => RECIPES.tiles(S, 71, 4, 3, true), tile_m: 1.2, normal: 1.8, roughness: 1 },   // 0.3 m tiles
  tiles_grey: { size: 512, recipe: (S) => RECIPES.tiles(S, 79, 2, 3, false), tile_m: 1.2, normal: 1.8, roughness: 1 },   // 0.6 m tiles
  oak: { size: 512, recipe: (S) => RECIPES.planks(S, 83, 6, 0.35), tile_m: 1.2, normal: 1.6, roughness: 1 },             // 0.2 x 1.2 m planks
  carpet: { size: 256, recipe: (S) => RECIPES.fabric(S, 89, 1.3, 0.35), tile_m: 0.5, normal: 0.8, roughness: 1 },
  fabric_grey: { size: 256, recipe: (S) => RECIPES.fabric(S, 97, 0.8, 0.5), tile_m: 0.6, normal: 0.9, roughness: 1 },
  fabric_accent: { size: 256, recipe: (S) => RECIPES.fabric(S, 101, 0.8, 0.5), tile_m: 0.6, normal: 0.9, roughness: 1 },
  fabric_rug: { size: 256, recipe: (S) => RECIPES.fabric(S, 102, 1.6, 0.4), tile_m: 0.8, normal: 1.0, roughness: 1 },
  linen: { size: 256, recipe: (S) => RECIPES.fabric(S, 103, 1.1, 0.3), tile_m: 0.8, normal: 0.6, roughness: 1 },
  leather: { size: 256, recipe: (S) => RECIPES.leather(S, 105), tile_m: 0.6, normal: 0.8, roughness: 1 },
  wood_light: { size: 256, recipe: (S) => RECIPES.wood(S, 107, 0.12), tile_m: 1.0, normal: 0.7, roughness: 1 },
  wood_dark: { size: 256, recipe: (S) => RECIPES.wood(S, 109, 0.1), tile_m: 1.0, normal: 0.7, roughness: 1 },
  door_wood: { size: 256, recipe: (S) => RECIPES.wood(S, 113, 0.14), tile_m: 1.0, normal: 0.9, roughness: 1 },
  metal_dark: { size: 256, recipe: (S) => RECIPES.metal(S, 127), tile_m: 0.5, normal: 0.12, roughness: 1, metalness: 0.85 },
  metal_light: { size: 256, recipe: (S) => RECIPES.metal(S, 131), tile_m: 0.5, normal: 0.12, roughness: 1, metalness: 0.8 },
  asphalt: { size: 256, recipe: (S) => RECIPES.concrete(S, 137), tile_m: 3.0, normal: 1.2, roughness: 1 },
  grass: { size: 256, recipe: (S) => RECIPES.grass(S, 139), tile_m: 2.0, normal: 0.8, roughness: 1 },
};

/** Flat token colours for the schematic / full levels = the style palette (levels 1-2 draw the palette flat). */
/** Material ids that have a CC0 file set under assets/textures/ (tools/process-textures.mjs; LICENSES.md). */
export const FILE_SETS = { plaster_white: 'Plaster001', /* plaster_ceiling stays procedural: a near-flat WebP shows block artefacts on a plain matte ceiling */ plaster_exterior: 'Plaster003', concrete: 'Concrete034', brick_painted: 'Bricks059', tiles_white: 'Tiles074', oak: 'WoodFloor051', tiles_grey: 'Tiles101', carpet: 'Carpet013', asphalt: 'Asphalt012', grass: 'Grass004', wood_light: 'Wood049', wood_dark: 'Wood049', door_wood: 'Wood049', metal_dark: 'Metal032', metal_light: 'Metal032', fabric_grey: 'Fabric030', fabric_accent: 'Fabric030', fabric_rug: 'Fabric030', linen: 'Fabric024', leather: 'Leather011', floor_sport: 'WoodFloor040' };

export class MaterialLibrary {
  constructor(style = STYLES.light) {
    this.cache = new Map(); // id -> { map, normalMap, roughnessMap }
    this.materials = new Map(); // key -> material
    this.bytes = 0;
    this.genMs = 0;
    this.style = style;
  }
  palette(id) { return this.style.palette[id] ?? this.style.palette.plaster_white; }
  /**
   * The CC0 file set for an id (assets/textures/<id>/, processed by tools/process-textures.mjs from the ambientCG 1K
   * sets, LICENSES.md): hue-free colour detail (WebP), NormalGL (PNG), AO in R + roughness in G (one PNG), 512 px.
   * Loaded lazily; the procedural set is the per-id fallback when a file fails. Source is a setting ('files' |
   * 'procedural').
   */
  fileTextures(id, spec) {
    const base = this.base || 'assets/textures/', setDir = `${base}sets/${FILE_SETS[id]}/`, dir = `${base}${id}/`;
    if (!this.loader) { this.loader = new THREE.TextureLoader(); this.loaded = new Set(); this.failed = new Set(); }
    const mk = (file, srgb) => { const t = this.loader.load(file, () => { this.loaded.add(id); this.onLoaded && this.onLoaded(id); }, undefined, () => { this.failed.add(id); this.cache.delete(id); this.onLoaded && this.onLoaded(id); }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; return t; };
    const roughnessMap = mk(setDir + 'rough_ao.jpg', false);
    this.bytes += 512 * 512 * 4 * 3 * 1.33;
    return { map: mk(dir + 'color.webp', true), normalMap: mk(setDir + 'normal.jpg', false), roughnessMap, aoMap: roughnessMap, tile_m: spec.tile_m, spec, file: true };
  }
  textures(id) {
    let t = this.cache.get(id);
    if (t) return t;
    const t0 = performance.now();
    const spec = LIBRARY[id] || LIBRARY.plaster_white;
    if ((this.textureSource || 'files') === 'files' && FILE_SETS[id] && !(this.failed && this.failed.has(id))) { t = this.fileTextures(id, spec); this.cache.set(id, t); return t; }
    const S = spec.size;
    const r = spec.recipe(S);
    const map = makeTexture(greyFrom(r.lum, S, r.mid, r.amp, r.tint), S, true);
    const normalMap = makeTexture(normalFromHeight(r.height, S, spec.normal), S, false);
    const roughnessMap = makeTexture(greyRough(r.rough, S), S, false, 2);
    t = { map, normalMap, roughnessMap, tile_m: spec.tile_m, spec };
    this.bytes += S * S * 4 * 3 * 1.33;
    this.genMs += performance.now() - t0;
    this.cache.set(id, t);
    return t;
  }
  /** A material for the quality level: 3 = textured PBR tinted by the palette, 2 = flat standard, 1 = flat Lambert. */
  get(id, level, opts = {}) {
    const key = `${id}|${level}|${opts.side || 0}`;
    let m = this.materials.get(key);
    if (m) return m;
    const spec = LIBRARY[id] || {};
    const tint = this.palette(id);
    if (level >= 3) {
      const t = this.textures(id);
      m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, metalness: spec.metalness ?? 0, color: tint, envMapIntensity: spec.metalness ? 1.0 : 0.7 });
      if (t.aoMap) { m.aoMap = t.aoMap; m.aoMap.channel = 0; m.aoMapIntensity = 0.6; }
      if (t.file) m.normalScale.set(spec.normal, spec.normal);
    } else if (level === 2) {
      m = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.85, metalness: spec.metalness ? 0.6 : 0 });
    } else {
      m = new THREE.MeshLambertMaterial({ color: tint });
    }
    m.userData.materialId = id;
    if (opts.side) m.side = opts.side;
    this.materials.set(key, m);
    return m;
  }
  /** Re-tint every cached material from a new style palette (no rebuild, no texture regeneration). */
  setStyle(style) {
    this.style = style;
    for (const m of this.materials.values()) {
      const id = m.userData.materialId;
      if (id) m.color.setHex(this.palette(id));
    }
  }
  tileM(id) { return (LIBRARY[id] || LIBRARY.plaster_white).tile_m; }
  dispose() {
    for (const t of this.cache.values()) { t.map.dispose(); t.normalMap.dispose(); t.roughnessMap.dispose(); }
    for (const m of this.materials.values()) m.dispose();
    this.cache.clear(); this.materials.clear(); this.bytes = 0;
  }
}

/** Shared small gradient textures (contact blob, junction strip, lamp glow): generated once, no files. */
let _radial = null, _strip = null;
export function radialTexture() {
  if (_radial) return _radial;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.45, 'rgba(0,0,0,0.75)'); g.addColorStop(0.8, 'rgba(0,0,0,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  _radial = new THREE.CanvasTexture(c);
  return _radial;
}
/** Luminance disc for the ground's alphaMap: opaque centre, transparent rim (the backdrop shows through at the horizon). */
let _disc = null;
export function discAlphaTexture() {
  if (_disc) return _disc;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, '#fff'); g.addColorStop(0.55, '#fff'); g.addColorStop(1, '#000');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  _disc = new THREE.CanvasTexture(c);
  return _disc;
}
/** A 1-D gradient along V: opaque black at v=0 (the wall), transparent at v=1. */
export function stripTexture() {
  if (_strip) return _strip;
  const c = document.createElement('canvas');
  c.width = 4; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.35, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 64);
  _strip = new THREE.CanvasTexture(c);
  _strip.wrapS = THREE.RepeatWrapping;
  _strip.wrapT = THREE.ClampToEdgeWrapping;
  return _strip;
}
