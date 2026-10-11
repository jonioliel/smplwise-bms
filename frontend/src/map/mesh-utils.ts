/**
 * Plan Studio 6, slice S1: the geometry helpers of the realistic level as pure functions on plain arrays (no three - the
 * node tests run them, and the `three` chunk does not grow by a loader). Deterministic for equal input.
 *
 * - boxUv: box-mapped UVs in metres (CR-029 section 3.1: "a triplanar-free box mapping", deterministic): each triangle
 *   takes the two world axes across its dominant normal axis, divided by the material's tile size, so a texture never
 *   stretches with the plan scale and two walls side by side continue the same pattern.
 * - faceNormals / creaseNormals: flat or creased vertex normals of a triangle soup (LOOK_SPEC R2 G1: the kit models get
 *   normals creased at 35 deg - curved parts smooth, edges crisp).
 * - readGlb: a minimal glTF 2.0 binary reader for the furniture kit (triangles, POSITION / NORMAL / indices, node
 *   transforms, material names) instead of three's GLTFLoader, whose animation / skinning imports would land in the
 *   capped `three` chunk.
 */
export type Mat4 = number[]; // column-major, 16

/** UVs (metres / tile) for a non-indexed triangle list of world positions. */
export function boxUv(pos: ArrayLike<number>, tileM: number, offset: [number, number, number] = [0, 0, 0]): Float32Array {
  const n = pos.length / 3;
  const uv = new Float32Array(n * 2);
  const t = tileM > 0 ? tileM : 1;
  for (let i = 0; i + 2 < n; i += 3) {
    const a = i * 3;
    const ux = pos[a + 3] - pos[a], uy = pos[a + 4] - pos[a + 1], uz = pos[a + 5] - pos[a + 2];
    const vx = pos[a + 6] - pos[a], vy = pos[a + 7] - pos[a + 1], vz = pos[a + 8] - pos[a + 2];
    const nx = Math.abs(uy * vz - uz * vy), ny = Math.abs(uz * vx - ux * vz), nz = Math.abs(ux * vy - uy * vx);
    for (let k = 0; k < 3; k++) {
      const p = a + k * 3;
      const x = pos[p] + offset[0], y = pos[p + 1] + offset[1], z = pos[p + 2] + offset[2];
      let u: number, v: number;
      if (nx >= ny && nx >= nz) { u = z; v = y; } else if (ny >= nz) { u = x; v = z; } else { u = x; v = y; }
      uv[(i + k) * 2] = u / t;
      uv[(i + k) * 2 + 1] = v / t;
    }
  }
  return uv;
}

/** Expand an indexed attribute (itemSize components) into a triangle soup. */
export function deindex(attr: ArrayLike<number>, index: ArrayLike<number> | null, itemSize: number): Float32Array {
  if (!index) return Float32Array.from(attr);
  const out = new Float32Array(index.length * itemSize);
  for (let i = 0; i < index.length; i++) for (let c = 0; c < itemSize; c++) out[i * itemSize + c] = attr[index[i] * itemSize + c];
  return out;
}

function faceNormalAt(pos: ArrayLike<number>, tri: number): [number, number, number] {
  const a = tri * 9;
  const ux = pos[a + 3] - pos[a], uy = pos[a + 4] - pos[a + 1], uz = pos[a + 5] - pos[a + 2];
  const vx = pos[a + 6] - pos[a], vy = pos[a + 7] - pos[a + 1], vz = pos[a + 8] - pos[a + 2];
  const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/** Flat normals of a triangle soup. */
export function faceNormals(pos: ArrayLike<number>): Float32Array {
  const tris = Math.floor(pos.length / 9);
  const out = new Float32Array(tris * 9);
  for (let t = 0; t < tris; t++) {
    const n = faceNormalAt(pos, t);
    for (let k = 0; k < 3; k++) out.set(n, t * 9 + k * 3);
  }
  return out;
}

/** Creased normals of a triangle soup: each corner averages the normals of the faces sharing its position whose normal
 * is within `creaseRad` of its own face's. */
export function creaseNormals(pos: ArrayLike<number>, creaseRad: number): Float32Array {
  const tris = Math.floor(pos.length / 9);
  const fn = Array.from({ length: tris }, (_, t) => faceNormalAt(pos, t));
  const key = (i: number) => `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`;
  const shared = new Map<string, number[]>();
  for (let v = 0; v < tris * 3; v++) {
    const k = key(v);
    const list = shared.get(k);
    if (list) list.push(Math.floor(v / 3));
    else shared.set(k, [Math.floor(v / 3)]);
  }
  const cos = Math.cos(creaseRad);
  const out = new Float32Array(tris * 9);
  for (let v = 0; v < tris * 3; v++) {
    const own = fn[Math.floor(v / 3)];
    let x = 0, y = 0, z = 0;
    for (const t of shared.get(key(v)) ?? []) {
      const n = fn[t];
      if (n[0] * own[0] + n[1] * own[1] + n[2] * own[2] >= cos) { x += n[0]; y += n[1]; z += n[2]; }
    }
    const l = Math.hypot(x, y, z) || 1;
    out[v * 3] = x / l;
    out[v * 3 + 1] = y / l;
    out[v * 3 + 2] = z / l;
  }
  return out;
}

export const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function mul(a: Mat4, b: Mat4): Mat4 {
  const o = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
/** T * R(quaternion) * S, column-major. */
export function compose(t: number[], q: number[], s: number[]): Mat4 {
  const [x, y, z, w] = q;
  const [sx, sy, sz] = s;
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    t[0], t[1], t[2], 1,
  ];
}
export function applyPoint(m: Mat4, x: number, y: number, z: number): [number, number, number] {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

export interface GlbPrimitive {
  /** Triangle soup in model space (node transforms applied). */
  positions: Float32Array;
  /** The material's name (the kit's slot: wood, metal, carpet, ...); '' without one. */
  material: string;
}
export interface GlbModel {
  primitives: GlbPrimitive[];
  min: [number, number, number];
  max: [number, number, number];
}

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** A minimal GLB reader (see the module note). Throws on anything it cannot read; the caller falls back per item. */
export function readGlb(buf: ArrayBuffer): GlbModel {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  let off = 12;
  let json: Record<string, unknown> | null = null;
  let bin: DataView | null = null;
  while (off + 8 <= buf.byteLength) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len))) as Record<string, unknown>;
    else if (type === 0x004e4942) bin = new DataView(buf, off + 8, len);
    off += 8 + len;
  }
  if (!json || !bin) throw new Error('GLB without JSON or BIN');
  const g = json as { accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string }[]; bufferViews: { byteOffset?: number; byteStride?: number }[]; meshes: { primitives: { attributes: Record<string, number>; indices?: number; material?: number; mode?: number }[] }[]; materials?: { name?: string }[]; nodes: { mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[]; scenes?: { nodes: number[] }[]; scene?: number };
  const data = bin;
  const read = (i: number): number[] => {
    const a = g.accessors[i];
    const view = g.bufferViews[a.bufferView];
    const comps = COMPONENTS[a.type] ?? 1;
    const size = a.componentType === 5126 || a.componentType === 5125 ? 4 : a.componentType === 5123 || a.componentType === 5122 ? 2 : 1;
    const stride = view.byteStride || comps * size;
    const base = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const out: number[] = [];
    for (let e = 0; e < a.count; e++) for (let c = 0; c < comps; c++) {
      const p = base + e * stride + c * size;
      out.push(a.componentType === 5126 ? data.getFloat32(p, true) : a.componentType === 5125 ? data.getUint32(p, true) : a.componentType === 5123 ? data.getUint16(p, true) : a.componentType === 5122 ? data.getInt16(p, true) : data.getUint8(p));
    }
    return out;
  };
  const prims: GlbPrimitive[] = [];
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const visit = (ni: number, parent: Mat4): void => {
    const n = g.nodes[ni];
    const local = n.matrix && n.matrix.length === 16 ? n.matrix : compose(n.translation ?? [0, 0, 0], n.rotation ?? [0, 0, 0, 1], n.scale ?? [1, 1, 1]);
    const m = mul(parent, local);
    if (n.mesh !== undefined) {
      for (const p of g.meshes[n.mesh].primitives) {
        if ((p.mode ?? 4) !== 4 || p.attributes.POSITION === undefined) continue;
        const raw = read(p.attributes.POSITION);
        const idx = p.indices !== undefined ? read(p.indices) : null;
        const soup = deindex(raw, idx, 3);
        for (let i = 0; i < soup.length; i += 3) {
          const q = applyPoint(m, soup[i], soup[i + 1], soup[i + 2]);
          soup[i] = q[0]; soup[i + 1] = q[1]; soup[i + 2] = q[2];
          for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], q[k]); max[k] = Math.max(max[k], q[k]); }
        }
        prims.push({ positions: soup, material: (p.material !== undefined ? g.materials?.[p.material]?.name : '') ?? '' });
      }
    }
    for (const c of n.children ?? []) visit(c, m);
  };
  const scene = g.scenes?.[g.scene ?? 0]?.nodes ?? g.nodes.map((_, i) => i);
  for (const ni of scene) visit(ni, IDENTITY);
  if (!prims.length) throw new Error('GLB without triangles');
  return { primitives: prims, min, max };
}

/** The placement of a model in an authored box (LOOK_SPEC section 13.2): uniform by the smallest ratio, then at most 15 %
 * stretch per axis toward the box; the model's footprint centre on the box centre, its bottom on the floor. */
export function fitModel(min: [number, number, number], max: [number, number, number], w: number, h: number, d: number): { scale: [number, number, number]; offset: [number, number, number] } {
  const sx = max[0] - min[0] > 1e-6 ? w / (max[0] - min[0]) : 1;
  const sy = max[1] - min[1] > 1e-6 ? h / (max[1] - min[1]) : 1;
  const sz = max[2] - min[2] > 1e-6 ? d / (max[2] - min[2]) : 1;
  const u = Math.min(sx, sy, sz);
  const scale: [number, number, number] = [Math.min(sx, u * 1.15), Math.min(sy, u * 1.15), Math.min(sz, u * 1.15)];
  return { scale, offset: [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2] };
}

/** A deterministic luminance jitter of +-5 % per instance (LOOK_SPEC R2 G1), from its position. */
export function jitter(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return 1 + ((s - Math.floor(s)) * 0.1 - 0.05);
}
