/**
 * Procedural PBR material library (CR-029 §6 stand-in). Every texture is generated here at load time on a canvas -
 * colour, a height field turned into a tangent-space normal map by a Sobel filter, and a roughness map - so the
 * prototype ships no image assets and needs no licence rows beyond three.js (LICENSES.md). Tiling is in metres
 * (tile_m per material), as the CR requires: the UV generator (scene.js boxUV) divides world metres by tile_m.
 */
import * as THREE from 'three';

const SIZE = 256; // 512 looked a little crisper but cost ~1.5-3 s per material in JS; 256 keeps the boot under ~3 s

// deterministic value noise (seeded) so the textures are the same on every load
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function valueNoise(size, cells, seed) {
  const r = rng(seed);
  const grid = new Float32Array((cells + 1) * (cells + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const out = new Float32Array(size * size);
  const g = (x, y) => grid[((y % cells) + cells) % cells * (cells + 1) + (((x % cells) + cells) % cells)];
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells;
    const y0 = Math.floor(fy), ty = sm(fy - y0);
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const x0 = Math.floor(fx), tx = sm(fx - x0);
      const a = g(x0, y0), b = g(x0 + 1, y0), c = g(x0, y0 + 1), d = g(x0 + 1, y0 + 1);
      out[y * size + x] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
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

function makeTexture(data, srgb) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Height (0..1 Float32Array) -> tangent-space normal map RGBA bytes. */
function normalFromHeight(h, strength) {
  const out = new Uint8ClampedArray(SIZE * SIZE * 4);
  const at = (x, y) => h[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * SIZE + x) * 4;
      out[i] = (nx * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * 0.5 + 0.5) * 255;
      out[i + 2] = (nz * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  return out;
}
function rgbaFrom(fn) {
  const out = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    const [r, g, b] = fn(x, y, y * SIZE + x);
    out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
  }
  return out;
}
const mix = (a, b, t) => a + (b - a) * t;
const lerp3 = (c0, c1, t) => [mix(c0[0], c1[0], t), mix(c0[1], c1[1], t), mix(c0[2], c1[2], t)];

/** Recipes: each returns { color: rgba, height: Float32Array, rough: Float32Array }. */
const RECIPES = {
  oak(seed) {
    const grain = fbm(SIZE, seed, 5, 2);
    const planks = 6; // planks across the tile
    const plankW = SIZE / planks;
    const r = rng(seed + 11);
    const offsets = Array.from({ length: planks }, () => Math.floor(r() * SIZE));
    const tints = Array.from({ length: planks }, () => 0.85 + r() * 0.3);
    const color = rgbaFrom((x, y, i) => {
      const p = Math.floor(x / plankW);
      const yy = (y + offsets[p]) % SIZE;
      const g = grain[yy * SIZE + ((x * 3) % SIZE)];
      const stripe = 0.5 + 0.5 * Math.sin((x / plankW) * Math.PI * 14 + g * 9);
      const base = lerp3([176, 128, 82], [214, 172, 120], g * 0.7 + stripe * 0.3);
      const gap = (x % plankW) < 2 || (yy % (SIZE / 2)) < 2 ? 0.55 : 1;
      const t = tints[p] * gap;
      return [base[0] * t, base[1] * t, base[2] * t];
    });
    const height = new Float32Array(SIZE * SIZE);
    const rough = new Float32Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const p = Math.floor(x / plankW);
      const yy = (y + offsets[p]) % SIZE;
      const gap = (x % plankW) < 2 || (yy % (SIZE / 2)) < 2 ? 0 : 1;
      const i = y * SIZE + x;
      height[i] = 0.7 * gap + 0.3 * grain[i];
      rough[i] = 0.45 + 0.25 * grain[i];
    }
    return { color, height, rough };
  },
  tiles(seed, light) {
    const n = fbm(SIZE, seed, 3, 8);
    const tilesPer = 4;
    const tw = SIZE / tilesPer;
    const color = rgbaFrom((x, y, i) => {
      const gx = x % tw, gy = y % tw;
      const grout = gx < 3 || gy < 3;
      const tx = Math.floor(x / tw), ty = Math.floor(y / tw);
      const v = n[i] * 0.25 + ((tx * 7 + ty * 13) % 5) * 0.03;
      const base = light ? lerp3([222, 224, 226], [240, 241, 243], v * 1.5) : lerp3([150, 156, 164], [188, 192, 198], v * 1.5);
      return grout ? [base[0] * 0.72, base[1] * 0.72, base[2] * 0.72] : base;
    });
    const height = new Float32Array(SIZE * SIZE), rough = new Float32Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const grout = (x % tw) < 3 || (y % tw) < 3;
      height[i] = grout ? 0 : 1 - n[i] * 0.08;
      rough[i] = grout ? 0.95 : light ? 0.18 + n[i] * 0.1 : 0.3 + n[i] * 0.15;
    }
    return { color, height, rough };
  },
  plaster(seed, tint) {
    const n = fbm(SIZE, seed, 5, 6);
    const color = rgbaFrom((x, y, i) => lerp3(tint[0], tint[1], n[i]));
    const rough = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < rough.length; i++) rough[i] = 0.82 + n[i] * 0.15;
    return { color, height: n, rough };
  },
  concrete(seed) {
    const n = fbm(SIZE, seed, 6, 3);
    const spots = valueNoise(SIZE, 64, seed + 5);
    const color = rgbaFrom((x, y, i) => {
      const v = n[i] * 0.8 + (spots[i] > 0.93 ? -0.25 : 0);
      return lerp3([128, 130, 134], [168, 170, 174], v);
    });
    const rough = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < rough.length; i++) rough[i] = 0.7 + n[i] * 0.25;
    return { color, height: n, rough };
  },
  carpet(seed) {
    const n = fbm(SIZE, seed, 6, 16);
    const color = rgbaFrom((x, y, i) => lerp3([96, 110, 132], [128, 140, 160], n[i]));
    const rough = new Float32Array(SIZE * SIZE).fill(0.95);
    return { color, height: n, rough };
  },
  fabric(seed, tint) {
    const n = fbm(SIZE, seed, 5, 24);
    const color = rgbaFrom((x, y, i) => {
      const weave = 0.5 + 0.5 * Math.sin(x * 0.8) * Math.sin(y * 0.8);
      return lerp3(tint[0], tint[1], n[i] * 0.6 + weave * 0.4);
    });
    const rough = new Float32Array(SIZE * SIZE).fill(0.9);
    return { color, height: n, rough };
  },
  wood(seed, tint) {
    const n = fbm(SIZE, seed, 4, 2);
    const color = rgbaFrom((x, y, i) => {
      const ring = 0.5 + 0.5 * Math.sin(y * 0.12 + n[i] * 7);
      return lerp3(tint[0], tint[1], ring * 0.6 + n[i] * 0.4);
    });
    const rough = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < rough.length; i++) rough[i] = 0.4 + n[i] * 0.2;
    return { color, height: n, rough };
  },
  metal(seed) {
    const n = fbm(SIZE, seed, 4, 32);
    const color = rgbaFrom((x, y, i) => lerp3([150, 152, 156], [190, 192, 196], n[i]));
    const rough = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < rough.length; i++) rough[i] = 0.3 + n[i] * 0.2;
    return { color, height: n, rough };
  },
  asphalt(seed) {
    const n = fbm(SIZE, seed, 6, 12);
    const color = rgbaFrom((x, y, i) => lerp3([58, 60, 64], [92, 94, 98], n[i]));
    const rough = new Float32Array(SIZE * SIZE).fill(0.92);
    return { color, height: n, rough };
  },
  grass(seed) {
    const n = fbm(SIZE, seed, 6, 10);
    const color = rgbaFrom((x, y, i) => lerp3([74, 112, 52], [118, 156, 74], n[i]));
    const rough = new Float32Array(SIZE * SIZE).fill(0.95);
    return { color, height: n, rough };
  },
};

/** The library manifest: id -> recipe + tile size in metres + normal strength. Mirrors the CR's §6.2 id list. */
export const LIBRARY = {
  plaster_white: { recipe: () => RECIPES.plaster(31, [[226, 223, 216], [242, 240, 236]]), tile_m: 2.0, normal: 0.5, roughness: 1 },
  plaster_exterior: { recipe: () => RECIPES.plaster(47, [[200, 194, 182], [222, 217, 208]]), tile_m: 2.0, normal: 1.0, roughness: 1 },
  plaster_ceiling: { recipe: () => RECIPES.plaster(53, [[236, 236, 234], [248, 248, 246]]), tile_m: 2.0, normal: 0.3, roughness: 1 },
  concrete: { recipe: () => RECIPES.concrete(61), tile_m: 2.5, normal: 1.5, roughness: 1 },
  tiles_white: { recipe: () => RECIPES.tiles(71, true), tile_m: 1.2, normal: 2.2, roughness: 1 },
  tiles_grey: { recipe: () => RECIPES.tiles(79, false), tile_m: 1.6, normal: 2.2, roughness: 1 },
  oak: { recipe: () => RECIPES.oak(83), tile_m: 1.5, normal: 2.0, roughness: 1 },
  carpet: { recipe: () => RECIPES.carpet(89), tile_m: 1.0, normal: 1.0, roughness: 1 },
  fabric_grey: { recipe: () => RECIPES.fabric(97, [[112, 118, 128], [150, 156, 166]]), tile_m: 0.6, normal: 1.0, roughness: 1 },
  fabric_blue: { recipe: () => RECIPES.fabric(101, [[54, 82, 128], [84, 116, 168]]), tile_m: 0.6, normal: 1.0, roughness: 1 },
  linen: { recipe: () => RECIPES.fabric(103, [[214, 210, 200], [238, 236, 230]]), tile_m: 0.8, normal: 0.8, roughness: 1 },
  wood_light: { recipe: () => RECIPES.wood(107, [[196, 160, 118], [226, 196, 156]]), tile_m: 1.0, normal: 1.0, roughness: 1 },
  wood_dark: { recipe: () => RECIPES.wood(109, [[92, 64, 44], [128, 94, 66]]), tile_m: 1.0, normal: 1.0, roughness: 1 },
  door_wood: { recipe: () => RECIPES.wood(113, [[150, 108, 72], [186, 142, 100]]), tile_m: 1.0, normal: 1.2, roughness: 1 },
  metal_dark: { recipe: () => RECIPES.metal(127), tile_m: 0.5, normal: 0.6, roughness: 1, metalness: 0.9, color: 0x3a3f46 },
  metal_light: { recipe: () => RECIPES.metal(131), tile_m: 0.5, normal: 0.6, roughness: 1, metalness: 0.85 },
  asphalt: { recipe: () => RECIPES.asphalt(137), tile_m: 3.0, normal: 1.5, roughness: 1 },
  grass: { recipe: () => RECIPES.grass(139), tile_m: 2.0, normal: 1.0, roughness: 1 },
};

/** Flat token colours for the schematic / full levels (no textures): the product's map tokens. */
export const FLAT = {
  plaster_white: 0xd7dde6, plaster_exterior: 0xc9d1dc, plaster_ceiling: 0xf2f4f7, concrete: 0xb4b9c2, tiles_white: 0xe9edf2, tiles_grey: 0xc6ccd5, oak: 0xd4b58a, carpet: 0x8d9bb3,
  fabric_grey: 0x9aa7b8, fabric_blue: 0x5577aa, linen: 0xe8e4dc, wood_light: 0xcfae84, wood_dark: 0x7a5a42, door_wood: 0xa8865e, metal_dark: 0x4b5567, metal_light: 0xb5bcc8, asphalt: 0x5a5d63, grass: 0x6f9c56,
};

export class MaterialLibrary {
  constructor() {
    this.cache = new Map(); // id -> { map, normalMap, roughnessMap }
    this.materials = new Map(); // key -> material
    this.bytes = 0;
  }
  textures(id) {
    let t = this.cache.get(id);
    if (t) return t;
    const spec = LIBRARY[id] || LIBRARY.plaster_white;
    const { color, height, rough } = spec.recipe();
    const map = makeTexture(color, true);
    const normalMap = makeTexture(normalFromHeight(height, spec.normal), false);
    const roughBytes = rgbaFrom((x, y, i) => {
      const v = Math.max(0, Math.min(1, rough[i])) * 255;
      return [v, v, v];
    });
    const roughnessMap = makeTexture(roughBytes, false);
    t = { map, normalMap, roughnessMap, tile_m: spec.tile_m, spec };
    this.bytes += SIZE * SIZE * 4 * 3 * 1.33; // with mipmaps
    this.cache.set(id, t);
    return t;
  }
  /** A material for the quality level: 3 = textured PBR, 2 = flat standard, 1 = flat Lambert. */
  get(id, level, opts = {}) {
    const key = `${id}|${level}|${opts.side || 0}|${opts.emissive || ''}`;
    let m = this.materials.get(key);
    if (m) return m;
    const flat = FLAT[id] ?? 0xcccccc;
    const spec = LIBRARY[id] || {};
    if (level >= 3) {
      const t = this.textures(id);
      m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, metalness: spec.metalness ?? 0, color: spec.color ?? 0xffffff, envMapIntensity: 0.6 });
      if (spec.metalness) { m.color.setHex(spec.color ?? 0xffffff); m.metalnessMap = null; }
    } else if (level === 2) {
      m = new THREE.MeshStandardMaterial({ color: flat, roughness: 0.85, metalness: spec.metalness ? 0.6 : 0 });
    } else {
      m = new THREE.MeshLambertMaterial({ color: flat });
    }
    if (opts.side) m.side = opts.side;
    this.materials.set(key, m);
    return m;
  }
  tileM(id) {
    return (LIBRARY[id] || LIBRARY.plaster_white).tile_m;
  }
  dispose() {
    for (const t of this.cache.values()) { t.map.dispose(); t.normalMap.dispose(); t.roughnessMap.dispose(); }
    for (const m of this.materials.values()) m.dispose();
    this.cache.clear(); this.materials.clear(); this.bytes = 0;
  }
}
