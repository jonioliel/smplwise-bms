/**
 * PlanScene - the three.js realisation of a plan document for the prototype. Axes as the product (scene-builder.ts):
 * x east = plan x, z south = plan y, y up, metres from the document's scale. Walls come from the ported buildStructure
 * (cut at their openings), floors and ceilings from the zones, stairs from the connector, furniture from a small
 * procedural catalog, lamps as emissive bodies + a pool of point lights, cameras with cones stopped by walls, and the
 * state layer (open-door frames, presence rings, lit tints on the lower levels). Doors and shutters animate toward the
 * entity state. Quality 3 = textured PBR + physical glass; 2 = flat standard; 1 = flat Lambert.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildStructure, blockingSegments, polygonCentroid, outlinePolyline, isOpenState, pointInPolygon } from './geometry.js';
import { radialTexture, stripTexture, discAlphaTexture } from './materials.js';
import { STYLES } from './style.js';

export const EYE_M = 1.65;
export const MAX_POOL_LIGHTS = 8;
const DOOR_OPEN_DEG = 85;
const ANIM_MS = 350;
const yawOf = (dx, dz) => -Math.atan2(dz, dx);
const lerp = (a, b, t) => a + (b - a) * t;

/** A single quad (two triangles) with UVs; p0..p3 are [x, y, z] in order around the quad, v runs p0/p1 -> p3/p2. */
function quad(p0, p1, p2, p3, uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
  const g = new THREE.BufferGeometry();
  const P = [p0, p1, p2, p0, p2, p3].flat();
  const U = [uvs[0], uvs[1], uvs[2], uvs[0], uvs[2], uvs[3]].flat();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.computeVertexNormals();
  return g;
}
/**
 * Contact-AO strips along a wall footprint (plan L3 c): on each outer edge of the outline a floor quad (0.22 m, dark at
 * the wall) and a wall quad (0.28 m high, dark at the floor). Edges shorter than `skip` (the ends of a wall part at an
 * opening) are left out. Cheap: one merged geometry + one gradient texture per level, every rung >= 2.
 */
function junctionStrips(outline, y, floorW = 0.22, wallH = 0.28, skip = 0.32) {
  const n = outline.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = outline[i], b = outline[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < skip) continue;
    let nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len;
    if (pointInPolygon((a[0] + b[0]) / 2 + nx * 0.02, (a[1] + b[1]) / 2 + nz * 0.02, outline)) { nx = -nx; nz = -nz; }
    const rep = len / 0.5;
    out.push(quad([a[0], y + 0.006, a[1]], [b[0], y + 0.006, b[1]], [b[0] + nx * floorW, y + 0.006, b[1] + nz * floorW], [a[0] + nx * floorW, y + 0.006, a[1] + nz * floorW], [[0, 0], [rep, 0], [rep, 1], [0, 1]]));
    const o = 0.004;
    out.push(quad([a[0] + nx * o, y, a[1] + nz * o], [b[0] + nx * o, y, b[1] + nz * o], [b[0] + nx * o, y + wallH, b[1] + nz * o], [a[0] + nx * o, y + wallH, a[1] + nz * o], [[0, 0], [rep, 0], [rep, 1], [0, 1]]));
  }
  return out;
}

/** Box-map UVs in metres / tile onto a non-indexed geometry whose positions are in world metres. */
export function boxUV(geometry, tileM, offset = [0, 0, 0]) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    n.copy(b).sub(a).cross(c.clone().sub(a));
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const p = [a, b, c][k];
      let u, v;
      if (ax >= ay && ax >= az) { u = p.z + offset[2]; v = p.y + offset[1]; }
      else if (ay >= az) { u = p.x + offset[0]; v = p.z + offset[2]; }
      else { u = p.x + offset[0]; v = p.y + offset[1]; }
      uv[(i + k) * 2] = u / tileM;
      uv[(i + k) * 2 + 1] = v / tileM;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** A shape from metre points [x, z] (shape y = -z so rotateX(-90deg) lands it on the XZ plane). */
function shapeFrom(ptsM) {
  const s = new THREE.Shape();
  ptsM.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  return s;
}
function extrudeXZ(ptsM, depth, yBase) {
  const g = new THREE.ExtrudeGeometry(shapeFrom(ptsM), { depth, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, yBase, 0);
  return g;
}
function boxAt(w, h, d, cx, cy, cz, yaw = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (yaw) g.rotateY(yaw);
  g.translate(cx, cy, cz);
  return g;
}
function cylAt(r, h, cx, cy, cz, seg = 16, rTop = r) {
  const g = new THREE.CylinderGeometry(rTop, r, h, seg);
  g.translate(cx, cy, cz);
  return g;
}
const insetRect = (poly, d) => {
  const [cx, cz] = polygonCentroid(poly);
  return poly.map(([x, z]) => [x + Math.sign(cx - x) * d, z + Math.sign(cz - z) * d]);
};

export class PlanScene {
  constructor(lib) {
    this.lib = lib;
    this.root = new THREE.Group();
    this.root.name = 'plan';
    this.levels = {}; // id -> { group, elevation, ceiling, segs, zones, floorY, ceilings[] , extent }
    this.doors = []; // animated
    this.shutters = [];
    this.lamps = []; // { entity, mesh(bulb), light anchor pos, glow }
    this.devices = []; // pickable meshes with userData.entity
    this.markers = []; // open-opening frames: { entity, group }
    this.presence = []; // { entity, mesh }
    this.tints = [];
    this.pool = [];
    this.labels = []; // { kind: 'room'|'temp'|'camera', pos: Vector3, text, level }
    this.quality = 3;
    this.reflectors = [];
    this.cameras = [];
    this.mirror = null;
    this.style = lib.style || STYLES.light;
    this.cutY = null;
    this.clipMaterials = new Set();
    this.styled = []; // materials re-coloured on a style change: { material, key, prop }
    this.furnitureMode = 'procedural'; // 'procedural' | 'models' (owner Q10; models fall back per item when absent)
  }

  dispose() {
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.root.clear();
    this.levels = {}; this.doors = []; this.shutters = []; this.lamps = []; this.devices = []; this.markers = []; this.presence = []; this.tints = []; this.labels = []; this.cameras = [];
    this.clipMaterials.clear(); this.styled = []; this.screens = []; this.lockPlates = []; this.ground = null;
    for (const l of this.pool) l.parent && l.parent.remove(l);
    this.pool = [];
  }

  /** Apply a style (style.js) without rebuilding: palette tints, state colours, strip / blob opacity, cap colours. */
  setStyle(style) {
    this.style = style;
    this.lib.setStyle(style);
    const P = style.palette;
    for (const s of this.styled) {
      const hex = P[s.key];
      if (hex === undefined) continue;
      if (s.prop === 'color') s.material.color.setHex(hex);
      else if (s.prop === 'emissive') { s.material.color.setHex(hex); s.material.emissive.setHex(hex); }
      else if (s.prop === 'opacity') s.material.opacity = style.post[s.key];
    }
    for (const L of Object.values(this.levels)) {
      if (L.capEdges) L.capEdges.visible = !!style.cut.edge && L.capMesh.visible;
    }
    if (this.ground) { this.ground.disc.material.color.setHex(style.ground.disc); this.ground.shadow.material.opacity = style.ground.contact; }
  }
  /** Night blend of the ground disc (called by the app on every time change). */
  setNight(night) {
    if (!this.ground) return;
    this.ground.disc.material.color.setHex(this.style.ground.disc).lerp(new THREE.Color(this.style.ground.discNight), night);
  }
  styledMaterial(material, key, prop = 'color') { this.styled.push({ material, key, prop }); return material; }

  /**
   * The section cut (plan L6, dollhouse): one world plane clips every wall / object material above `y`; the wall
   * footprints get a dark cap (poché) at the cut. `null` = no cut (walk, full walls). Only the named level shows caps.
   */
  setCut(y, levelId) {
    this.cutY = y;
    this.cutLevel = levelId;
    const planes = y == null ? null : [new THREE.Plane(new THREE.Vector3(0, -1, 0), y)];
    for (const m of this.clipMaterials) { m.clippingPlanes = planes; m.clipShadows = !!planes; m.needsUpdate = m.needsUpdate || false; }
    for (const L of Object.values(this.levels)) {
      const on = y != null && L.id === levelId;
      if (L.capMesh) { L.capMesh.visible = on; L.capMesh.position.y = y == null ? 0 : y; }
      if (L.capEdges) { L.capEdges.visible = on && !!this.style.cut.edge; L.capEdges.position.y = y == null ? 0 : y; }
    }
  }

  /** Build everything for a plan bundle { doc, zones, anchors, entities, coverPositions } at a quality level. */
  build(plan, quality, opts = {}) {
    this.dispose();
    this.plan = plan;
    this.quality = quality;
    this.reflections = !!opts.reflections;
    const doc = plan.doc;
    const W = doc.dimensions.width_px, H = doc.dimensions.height_px;
    const { scale } = buildStructure(doc, W, H, null);
    this.scale = scale;
    this.W = W; this.H = H;
    const M = (p) => [p[0] * W * scale, p[1] * H * scale];
    this.toM = M;
    const q = quality;
    const lib = this.lib;
    const mat = (id, side) => lib.get(id, q, { side });
    const levelOf = new Map(doc.levels.map((l) => [l.id, l]));
    const entities = plan.entities;

    for (const lv of doc.levels) {
      const group = new THREE.Group();
      group.name = `level:${lv.id}`;
      this.root.add(group);
      const elev = lv.elevation_m;
      const ceilH = lv.ceiling_height_m;
      const zones = plan.zones.filter((z) => z.level_id === lv.id).map((z) => ({ ...z, polyM: z.polygon.map((p) => M([p.x, p.y])) }));
      if (!zones.length) {
        // no rooms (the repo fixture): one plate around the level's walls, as the product's floor plate (LEVEL_PAD_M)
        const pts = doc.walls.filter((w) => w.level_id === lv.id).flatMap((w) => w.polyline.map(M));
        if (pts.length) {
          const pad = 0.5;
          const minX = Math.min(...pts.map((p) => p[0])) - pad, maxX = Math.max(...pts.map((p) => p[0])) + pad;
          const minZ = Math.min(...pts.map((p) => p[1])) - pad, maxZ = Math.max(...pts.map((p) => p[1])) + pad;
          zones.push({ id: `plate-${lv.id}`, name: lv.name, level_id: lv.id, polyM: [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]], x_proto: { floor_material: 'concrete' }, synthetic: true });
        }
      }
      const L = { id: lv.id, name: lv.name, group, elevation: elev, ceiling: ceilH, zones, ceilings: [], extent: null, statics: [], segs: [], stairs: [], objectsBlocking: [], strips: [], blobs: [], caps: [], capLines: [] };
      this.levels[lv.id] = L;
      const merged = new Map(); // material id -> geometries
      const push = (id, g) => { (merged.get(id) || merged.set(id, []).get(id)).push(g); };

      // ---- walls
      const { walls, openings } = buildStructure(doc, W, H, lv.id);
      for (const part of walls) {
        const w = part.wall;
        const h = w.height_m ?? ceilH;
        const ptsM = part.points.map((p) => [p[0] * scale, p[1] * scale]);
        const outline = outlinePolyline(ptsM, (part.width * scale) / 2);
        if (outline.length < 3) continue;
        const g = extrudeXZ(outline, h - (w.base_z_m || 0), elev + (w.base_z_m || 0));
        const id = w.kind === 'railing' ? 'metal_dark' : w.kind === 'exterior' ? 'plaster_exterior' : 'plaster_white';
        push(id, boxUV(g, lib.tileM(id)));
        if (w.kind !== 'railing' && !(w.base_z_m > 0)) {
          // contact AO at the wall-floor junction (plan L3 c) and the section cap at the cut (plan L6)
          L.strips.push(...junctionStrips(outline, elev));
          if (h >= ceilH * 0.5) {
            const cap = new THREE.ShapeGeometry(shapeFrom(outline));
            cap.rotateX(-Math.PI / 2);
            L.caps.push(cap);
            for (let i = 0; i < outline.length; i++) { const a = outline[i], b = outline[(i + 1) % outline.length]; L.capLines.push(a[0], 0, a[1], b[0], 0, b[1]); }
          }
          // skirting board (plan P3): 0.08 x 0.012 m along the footprint, both sides, interior walls only
          if (q >= 3 && w.kind === 'interior') {
            const sk = extrudeXZ(outlinePolyline(ptsM, (part.width * scale) / 2 + 0.012), 0.08, elev);
            push('plaster_ceiling', boxUV(sk, 2));
          }
        }
      }
      const ext = zones.length ? zones.flatMap((z) => z.polyM) : walls.flatMap((p) => p.points.map((pt) => [pt[0] * scale, pt[1] * scale]));
      if (ext.length) L.extent = { minX: Math.min(...ext.map((p) => p[0])), maxX: Math.max(...ext.map((p) => p[0])), minZ: Math.min(...ext.map((p) => p[1])), maxZ: Math.max(...ext.map((p) => p[1])) };
      // daylight per room (plan L3 b / P5): glazed area over floor area, read by the walk's exposure adaptation
      for (const z of zones) {
        let glass = 0;
        for (const op of openings) {
          if (op.opening.kind !== 'window') continue;
          const c = [op.c[0] * scale, op.c[1] * scale], nrm = [-op.d[1], op.d[0]];
          if (pointInPolygon(c[0] + nrm[0] * 0.3, c[1] + nrm[1] * 0.3, z.polyM) || pointInPolygon(c[0] - nrm[0] * 0.3, c[1] - nrm[1] * 0.3, z.polyM)) glass += op.opening.width_m * op.opening.height_m;
        }
        let area = 0;
        for (let i = 0; i < z.polyM.length; i++) { const a = z.polyM[i], b = z.polyM[(i + 1) % z.polyM.length]; area += a[0] * b[1] - b[0] * a[1]; }
        z.daylight = Math.min(1, glass / Math.max(1, Math.abs(area) / 2) * 5);
      }

      // ---- openings
      for (const op of openings) {
        const o = op.opening;
        const c = [op.c[0] * scale, op.c[1] * scale];
        const d = op.d; // unit direction in plan (x, z)
        const n = [-d[1], d[0]];
        const wm = o.width_m, t = op.wpx * scale;
        const hwall = op.wall.height_m ?? ceilH;
        const yaw = yawOf(d[0], d[1]);
        const topY = elev + o.sill_m + o.height_m;
        if (hwall - (o.sill_m + o.height_m) > 0.01) push(op.wall.kind === 'exterior' ? 'plaster_exterior' : 'plaster_white', boxUV(boxAt(wm, hwall - (o.sill_m + o.height_m), t, c[0], (topY + elev + hwall) / 2, c[1], yaw), 2));
        if (o.kind === 'window') {
          if (o.sill_m > 0.01) push(op.wall.kind === 'exterior' ? 'plaster_exterior' : 'plaster_white', boxUV(boxAt(wm, o.sill_m, t, c[0], elev + o.sill_m / 2, c[1], yaw), 2));
          // frame: jambs + head + sill in light metal
          const fr = 0.06;
          push('metal_light', boxAt(fr, o.height_m, t * 0.9, c[0] - d[0] * (wm / 2 - fr / 2), elev + o.sill_m + o.height_m / 2, c[1] - d[1] * (wm / 2 - fr / 2), yaw));
          push('metal_light', boxAt(fr, o.height_m, t * 0.9, c[0] + d[0] * (wm / 2 - fr / 2), elev + o.sill_m + o.height_m / 2, c[1] + d[1] * (wm / 2 - fr / 2), yaw));
          push('metal_light', boxAt(wm, fr, t * 0.9, c[0], topY - fr / 2, c[1], yaw));
          // sill proud of the wall on both faces (plan P3), a mullion on wide windows, a transom bar on tall ones
          push('metal_light', boxAt(wm + 0.1, fr, t + 0.08, c[0], elev + o.sill_m + fr / 2, c[1], yaw));
          if (q >= 3) {
            push('tiles_white', boxAt(wm + 0.14, 0.03, t + 0.12, c[0], elev + o.sill_m - 0.015, c[1], yaw));
            if (wm > 1.0) push('metal_light', boxAt(0.04, o.height_m - fr * 2, t * 0.6, c[0], elev + o.sill_m + o.height_m / 2, c[1], yaw));
            if (wm > 2.0) { push('metal_light', boxAt(0.04, o.height_m - fr * 2, t * 0.6, c[0] - d[0] * (wm / 3), elev + o.sill_m + o.height_m / 2, c[1] - d[1] * (wm / 3), yaw)); push('metal_light', boxAt(0.04, o.height_m - fr * 2, t * 0.6, c[0] + d[0] * (wm / 3), elev + o.sill_m + o.height_m / 2, c[1] + d[1] * (wm / 3), yaw)); }
            if (o.height_m > 1.6) push('metal_light', boxAt(wm - fr * 2, 0.04, t * 0.6, c[0], elev + o.sill_m + o.height_m * 0.68, c[1], yaw));
          }
          const frosted = o.x_proto && o.x_proto.glazing === 'frosted';
          const glass = new THREE.Mesh(boxAt(wm - fr * 2, o.height_m - fr * 2, 0.02, 0, 0, 0), this.glassMaterial(frosted));
          glass.position.set(c[0], elev + o.sill_m + o.height_m / 2, c[1]);
          glass.rotation.y = yaw;
          glass.userData = { kind: 'glass' };
          group.add(glass);
          const cover = o.x_proto && o.x_proto.cover_entity;
          if (cover) {
            // a roller shutter on the exterior side (+n of the wall), sliding down from the head
            const sideSign = L.extent ? (c[0] + n[0] * 0.5 < L.extent.minX + 0.01 || c[0] + n[0] * 0.5 > L.extent.maxX - 0.01 || c[1] + n[1] * 0.5 < L.extent.minZ + 0.01 || c[1] + n[1] * 0.5 > L.extent.maxZ - 0.01 ? 1 : -1) : 1;
            const box = new THREE.Mesh(new THREE.BoxGeometry(wm + 0.1, 0.22, 0.18), mat('metal_light'));
            box.position.set(c[0] + n[0] * sideSign * (t / 2 + 0.09), topY + 0.11, c[1] + n[1] * sideSign * (t / 2 + 0.09));
            box.rotation.y = yaw;
            box.castShadow = true;
            group.add(box);
            const slat = new THREE.Mesh(new THREE.BoxGeometry(wm + 0.04, 1, 0.04), this.shutterMaterial());
            slat.geometry.translate(0, -0.5, 0); // hangs from its top
            slat.position.set(c[0] + n[0] * sideSign * (t / 2 + 0.06), topY, c[1] + n[1] * sideSign * (t / 2 + 0.06));
            slat.rotation.y = yaw;
            slat.castShadow = true;
            slat.userData = { kind: 'device', entity: cover, label: plan.entityNames[cover] || cover, domain: 'cover' };
            group.add(slat);
            this.devices.push(slat);
            this.shutters.push({ entity: cover, mesh: slat, height: o.height_m, current: 1 });
            this.labels.push({ kind: 'device', entity: cover, pos: new THREE.Vector3(c[0] + n[0] * sideSign * 0.3, topY + 0.3, c[1] + n[1] * sideSign * 0.3), level: lv.id });
          }
        } else if (o.kind === 'door') {
          const fr = 0.05;
          const frameMat = 'wood_dark';
          push(frameMat, boxAt(fr, o.height_m, t + 0.02, c[0] - d[0] * (wm / 2 - fr / 2), elev + o.height_m / 2, c[1] - d[1] * (wm / 2 - fr / 2), yaw));
          push(frameMat, boxAt(fr, o.height_m, t + 0.02, c[0] + d[0] * (wm / 2 - fr / 2), elev + o.height_m / 2, c[1] + d[1] * (wm / 2 - fr / 2), yaw));
          push(frameMat, boxAt(wm, fr, t + 0.02, c[0], topY - fr / 2, c[1], yaw));
          if (q >= 3) {
            // casing (architrave) proud of the wall on both faces: 7 cm wide, 12 mm deep (plan P3)
            const cw = 0.07, cd = t + 0.024;
            push(frameMat, boxAt(cw, o.height_m + cw, cd, c[0] - d[0] * (wm / 2 + cw / 2), elev + (o.height_m + cw) / 2, c[1] - d[1] * (wm / 2 + cw / 2), yaw));
            push(frameMat, boxAt(cw, o.height_m + cw, cd, c[0] + d[0] * (wm / 2 + cw / 2), elev + (o.height_m + cw) / 2, c[1] + d[1] * (wm / 2 + cw / 2), yaw));
            push(frameMat, boxAt(wm + cw * 2, cw, cd, c[0], topY + cw / 2, c[1], yaw));
          }
          const entity = o.anchor_ref && o.anchor_ref.resource_type === 'ha_entity' ? o.anchor_ref.resource_id : null;
          const lockEntity = plan.doorLocks && plan.doorLocks[o.id];
          const leafH = o.height_m - fr - 0.01, leafT = 0.045;
          const swing = o.swing || 'right';
          const nl = [d[1], -d[0]], nr = [-d[1], d[0]];
          const leaves = [];
          const mkLeaf = (hingeM, along, width, openDir, kind) => {
            const grp = new THREE.Group();
            grp.position.set(hingeM[0], elev, hingeM[1]);
            const closedYaw = yawOf(along[0], along[1]);
            grp.rotation.y = closedYaw;
            const glassLeaf = o.id === 'd-liv-kit';
            const leafW = width - 0.02;
            const leaf = new THREE.Mesh(q >= 3 ? new RoundedBoxGeometry(leafW, leafH, leafT, 2, 0.006) : new THREE.BoxGeometry(leafW, leafH, leafT), glassLeaf ? this.glassMaterial(false, true) : mat('door_wood'));
            leaf.geometry.translate(width / 2, leafH / 2, 0);
            leaf.castShadow = true;
            leaf.receiveShadow = true;
            if (q >= 3 && !glassLeaf) boxUV(leaf.geometry, 1.0);
            leaf.userData = { kind: 'device', entity: entity || `door:${o.id}`, label: entity ? plan.entityNames[entity] || entity : 'דלת ללא חיישן', domain: 'door', openingId: o.id, lock: lockEntity || null };
            grp.add(leaf);
            if (q >= 3) {
              if (glassLeaf) {
                // sliding glass leaf: a slim dark frame around the pane
                const fm = mat('metal_dark');
                for (const [bw, bh, bx, by] of [[0.04, leafH, 0.02, leafH / 2], [0.04, leafH, leafW - 0.02, leafH / 2], [leafW, 0.04, leafW / 2, 0.02], [leafW, 0.04, leafW / 2, leafH - 0.02]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, leafT + 0.01), fm); b.position.set(bx + 0.01, by, 0); grp.add(b); }
              } else {
                // two raised panels on each face (plan L1): 5 mm proud, 1 cm radius
                const pm = mat('door_wood');
                const pw = leafW - 0.22, ph1 = leafH * 0.52, ph2 = leafH * 0.28;
                for (const s of [-1, 1]) for (const [py, ph] of [[0.14 + ph2 / 2, ph2], [0.14 + ph2 + 0.12 + ph1 / 2, ph1]]) {
                  const p = new THREE.Mesh(new RoundedBoxGeometry(pw, ph, 0.012, 2, 0.005), pm);
                  p.position.set(width / 2 + 0.01, py, s * (leafT / 2 + 0.003));
                  p.castShadow = true;
                  grp.add(p);
                }
              }
            }
            // lever handle + rose on both faces
            for (const s of [-1, 1]) {
              const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 14), mat('metal_light'));
              rose.rotation.x = Math.PI / 2;
              rose.position.set(width - 0.12, 1.02, s * (leafT / 2 + 0.006));
              grp.add(rose);
              const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.12, 10), mat('metal_light'));
              lever.rotation.z = Math.PI / 2;
              lever.position.set(width - 0.17, 1.02, s * (leafT / 2 + 0.04));
              grp.add(lever);
              const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 10), mat('metal_light'));
              stem.rotation.x = Math.PI / 2;
              stem.position.set(width - 0.12, 1.02, s * (leafT / 2 + 0.025));
              grp.add(stem);
            }
            if (lockEntity) {
              const plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.06), this.lockMaterial());
              plate.position.set(width - 0.15, 1.12, 0);
              plate.userData = { kind: 'lock', entity: lockEntity };
              grp.add(plate);
              this.devices.push(plate);
              this.lockPlates = this.lockPlates || [];
              this.lockPlates.push({ entity: lockEntity, mesh: plate });
            }
            group.add(grp);
            this.devices.push(leaf);
            let openYaw = closedYaw;
            if (kind === 'swing') {
              openYaw = yawOf(openDir[0], openDir[1]);
              // shortest turn
              let dlt = openYaw - closedYaw;
              while (dlt > Math.PI) dlt -= 2 * Math.PI;
              while (dlt < -Math.PI) dlt += 2 * Math.PI;
              openYaw = closedYaw + Math.sign(dlt) * (DOOR_OPEN_DEG * Math.PI) / 180;
            }
            leaves.push({ grp, closedYaw, openYaw, kind, slide: kind === 'slide' ? [along[0] * -(width * 0.92), along[1] * -(width * 0.92)] : null, base: [hingeM[0], hingeM[1]] });
          };
          const g0 = [op.g0[0] * scale, op.g0[1] * scale], g1 = [op.g1[0] * scale, op.g1[1] * scale];
          const side = (o.hinge || 'start') === 'start' ? nl : nr;
          if (swing === 'sliding') {
            const hinge = (o.hinge || 'start') === 'start' ? g0 : g1;
            const along = hinge === g0 ? d : [-d[0], -d[1]];
            mkLeaf([hinge[0] + nl[0] * 0.0, hinge[1] + nl[1] * 0.0], along, wm, null, 'slide');
          } else if (swing === 'double') {
            mkLeaf(g0, d, wm / 2, side, 'swing');
            mkLeaf(g1, [-d[0], -d[1]], wm / 2, side, 'swing');
          } else if (swing === 'none') {
            // no leaf
          } else {
            const nn = swing === 'left' ? nl : nr;
            const hinge = (o.hinge || 'start') === 'start' ? g0 : g1;
            const along = hinge === g0 ? d : [-d[0], -d[1]];
            mkLeaf(hinge, along, wm, nn, 'swing');
          }
          this.doors.push({ id: o.id, entity, lock: lockEntity || null, leaves, t: 0, open: false });
          // the open-opening frame marker (state layer): jambs + head, danger token, a little wider than the wall
          if (entity) {
            const mg = new THREE.Group();
            const mm = this.markerMaterial();
            const MT = 0.06, MO = 0.04;
            for (const s of [-1, 1]) {
              const j = new THREE.Mesh(boxAt(MT, o.height_m + MT, t + MO * 2, c[0] + d[0] * s * (wm / 2 + MT / 2), elev + (o.height_m + MT) / 2, c[1] + d[1] * s * (wm / 2 + MT / 2), yaw), mm);
              mg.add(j);
            }
            mg.add(new THREE.Mesh(boxAt(wm + MT * 2, MT, t + MO * 2, c[0], topY + MT / 2, c[1], yaw), mm));
            mg.visible = false;
            group.add(mg);
            this.markers.push({ entity, group: mg });
            this.labels.push({ kind: 'device', entity, pos: new THREE.Vector3(c[0], topY + 0.25, c[1]), level: lv.id });
          }
        } else if (o.kind === 'passage') {
          // nothing but the lintel (already pushed)
        }
      }

      // ---- floors, ceilings, state plates per zone
      for (const z of zones) {
        const fid = (z.x_proto && z.x_proto.floor_material) || 'concrete';
        const slab = extrudeXZ(z.polyM, 0.25, elev - 0.25);
        const floorMat = mat(fid);
        const fm = this.reflections && q >= 3 ? this.transparentClone(floorMat) : floorMat;
        const floor = new THREE.Mesh(boxUV(slab, lib.tileM(fid)), fm);
        floor.receiveShadow = true;
        floor.castShadow = q >= 2;
        floor.userData = { kind: 'floor', zone: z.id, level: lv.id };
        group.add(floor);
        L.statics.push(floor);
        const ceilG = new THREE.ShapeGeometry(shapeFrom(z.polyM));
        ceilG.rotateX(-Math.PI / 2);
        ceilG.translate(0, elev + ceilH, 0);
        const ceil = new THREE.Mesh(boxUV(ceilG, lib.tileM('plaster_ceiling')), mat('plaster_ceiling', THREE.DoubleSide));
        ceil.castShadow = true;
        ceil.receiveShadow = true;
        ceil.userData = { kind: 'ceiling' };
        group.add(ceil);
        L.ceilings.push(ceil);
        // state plates: lit tint (lower levels only), presence ring, room label + temperature chip
        const [cx, cz] = polygonCentroid(z.polyM);
        const light = z.x_proto && z.x_proto.light;
        if (light && q < 3) {
          const tg = new THREE.ShapeGeometry(shapeFrom(insetRect(z.polyM, 0.08)));
          tg.rotateX(-Math.PI / 2);
          tg.translate(0, elev + 0.014, 0);
          const tint = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.4, depthWrite: false }));
          tint.visible = false;
          group.add(tint);
          this.tints.push({ entity: light, mesh: tint, zone: z.id });
        }
        const presence = z.x_proto && z.x_proto.presence;
        if (presence) {
          const outer = insetRect(z.polyM, 0.1), inner = insetRect(z.polyM, 0.4);
          const shape = shapeFrom(outer);
          const hole = new THREE.Path();
          inner.forEach(([x, zz], i) => (i ? hole.lineTo(x, -zz) : hole.moveTo(x, -zz)));
          hole.closePath();
          shape.holes.push(hole);
          const rg = new THREE.ShapeGeometry(shape);
          rg.rotateX(-Math.PI / 2);
          rg.translate(0, elev + 0.026, 0);
          const ring = new THREE.Mesh(rg, this.styledMaterial(new THREE.MeshBasicMaterial({ color: this.style.palette.presence, transparent: true, opacity: 0.45, depthWrite: false }), 'presence'));
          ring.visible = false;
          group.add(ring);
          this.presence.push({ entity: presence, mesh: ring, zone: z.id, fade: 1 });
        }
        this.labels.push({ kind: 'room', text: z.name, pos: new THREE.Vector3(cx, elev + 0.05, cz), level: lv.id, zone: z.id });
        if (z.x_proto && typeof z.x_proto.temp === 'number') this.labels.push({ kind: 'temp', text: `${z.x_proto.temp.toFixed(1)}°`, pos: new THREE.Vector3(cx, elev + 1.5, cz), level: lv.id, zone: z.id, offset: 0.55 });
      }

      // ---- objects
      for (const o of doc.objects.filter((x) => x.level_id === lv.id)) {
        const [x, z] = M(o.position);
        const yaw = (-(o.rotation_deg || 0) * Math.PI) / 180;
        const base = elev + (o.z_m || 0);
        this.buildObject(o, x, base, z, yaw, group, push, L, plan);
      }

      // ---- stairs (connectors leaving this level)
      for (const cn of doc.connectors.filter((x) => x.level_from === lv.id && x.kind === 'stairs' && x.polyline.length >= 2)) {
        const to = levelOf.get(cn.level_to);
        if (!to) continue;
        const a = M(cn.polyline[0]), b = M(cn.polyline[cn.polyline.length - 1]);
        const run = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const steps = (cn.flights && cn.flights[0] && cn.flights[0].steps) || Math.max(2, Math.round(run / 0.28));
        const rise = to.elevation_m - elev;
        const dx = (b[0] - a[0]) / run, dz = (b[1] - a[1]) / run;
        const yaw = yawOf(dx, dz);
        const going = run / steps, riser = rise / steps;
        for (let i = 0; i < steps; i++) {
          const s = (i + 0.5) * going;
          const top = elev + (i + 1) * riser;
          const h = Math.max(0.02, (i + 1) * riser);
          push('oak', boxUV(boxAt(going + 0.01, h, cn.width_m, a[0] + dx * s, top - h / 2, a[1] + dz * s, yaw), 1.0));
        }
        // stringers
        push('wood_dark', boxAt(run, 0.08, 0.05, (a[0] + b[0]) / 2 + 0, elev + rise / 2 - 0.04, (a[1] + b[1]) / 2, yaw));
        L.stairs.push({ a, b, run, width: cn.width_m, from: lv.id, to: cn.level_to, elevFrom: elev, elevTo: to.elevation_m, dx, dz });
        // the stair arrives on the other level: register the band there too (walking down)
      }

      // ---- cameras (anchors) and cones
      const segsPx = blockingSegments(doc, W, H, lv.id, entities);
      for (const a of plan.anchors.filter((x) => x.level_id === lv.id && x.resource_type === 'camera')) {
        const [x, z] = M([a.x, a.y]);
        const mount = a.mount_height_m ?? 2.4;
        const bearing = ((a.rotation || 0) * Math.PI) / 180; // 0 = up (−z), clockwise
        const fwd = [Math.sin(bearing), -Math.cos(bearing)];
        const body = new THREE.Group();
        body.position.set(x, elev + mount, z);
        body.rotation.y = -bearing + Math.PI / 2;
        const cam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.12), mat('metal_dark'));
        cam.position.x = 0.1;
        cam.rotation.z = (-(a.tilt_deg || 0) * Math.PI) / 180;
        body.add(cam);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 12), this.lensMaterial(a.online));
        lens.rotation.z = Math.PI / 2;
        lens.position.set(0.23, -0.03, 0);
        body.add(lens);
        const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), mat('metal_dark'));
        body.add(bracket);
        body.userData = { kind: 'camera', id: a.id, label: a.label, online: a.online };
        cam.userData = body.userData; lens.userData = body.userData;
        group.add(body);
        this.devices.push(cam, lens);
        // coverage polygon in plan px, stopped by the level's segments
        const radiusPx = (a.radius ?? 0.5) * W;
        const poly = coverage([a.x * W, a.y * H], a.rotation || 0, a.fov || 90, radiusPx, segsPx);
        const polyM = poly.map((p) => [p[0] * scale, p[1] * scale]);
        if (polyM.length >= 3) {
          const cg = new THREE.ShapeGeometry(shapeFrom(polyM));
          cg.rotateX(-Math.PI / 2);
          cg.translate(0, elev + 0.03, 0);
          const coneMat = a.online === false ? new THREE.MeshBasicMaterial({ color: 0x9aa3b5, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }) : this.styledMaterial(new THREE.MeshBasicMaterial({ color: this.style.palette.cone, transparent: true, opacity: 0.11, depthWrite: false, side: THREE.DoubleSide }), 'cone');
          const cone = new THREE.Mesh(cg, coneMat);
          cone.userData = { kind: 'cone', noClip: true };
          group.add(cone);
          const vol = new THREE.Mesh(extrudeXZ(polyM, mount - 0.2, elev + 0.05), this.styledMaterial(new THREE.MeshBasicMaterial({ color: this.style.palette.cone, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }), 'cone'));
          vol.visible = false;
          vol.userData = { kind: 'cone-volume', noClip: true };
          group.add(vol);
          this.cameras.push({ id: a.id, cone, vol, body, fwd, pos: [x, z], mount, tilt: a.tilt_deg || 0, label: a.label, level: lv.id });
        }
        this.labels.push({ kind: 'camera', text: a.label, pos: new THREE.Vector3(x, elev + mount + 0.2, z), level: lv.id, online: a.online });
      }

      // ---- merge statics per material
      for (const [id, geos] of merged) {
        const list = geos.map((x) => (x.index ? x.toNonIndexed() : x));
        const g = mergeGeometries(list, false);
        const material = mat(id);
        const mesh = new THREE.Mesh(g, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { kind: 'static', material: id, level: lv.id };
        group.add(mesh);
        L.statics.push(mesh);
      }
      // ---- contact AO strips + blob shadows (rungs >= 2), section caps (any rung; shown only in cut views)
      if (q >= 2) {
        if (L.strips.length) {
          const sm = this.styledMaterial(new THREE.MeshBasicMaterial({ map: stripTexture(), color: 0x000000, transparent: true, opacity: this.style.post.junctionAlpha, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 'junctionAlpha', 'opacity');
          const m = new THREE.Mesh(mergeGeometries(L.strips, false), sm);
          m.userData = { kind: 'ao', noClip: true }; m.renderOrder = 1;
          group.add(m);
        }
        if (L.blobs.length) {
          const bm = this.styledMaterial(new THREE.MeshBasicMaterial({ map: radialTexture(), color: 0x000000, transparent: true, opacity: this.style.post.contactAlpha, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 'contactAlpha', 'opacity');
          const m = new THREE.Mesh(mergeGeometries(L.blobs, false), bm);
          m.userData = { kind: 'ao', noClip: true }; m.renderOrder = 1;
          group.add(m);
        }
      }
      if (L.caps.length) {
        const cm = this.styledMaterial(new THREE.MeshBasicMaterial({ color: this.style.palette.section_cap, toneMapped: false }), 'section_cap');
        L.capMesh = new THREE.Mesh(mergeGeometries(L.caps.map((x) => (x.index ? x.toNonIndexed() : x)), false), cm);
        L.capMesh.visible = false;
        L.capMesh.userData = { kind: 'cap', noClip: true };
        L.capMesh.renderOrder = 2;
        group.add(L.capMesh);
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.Float32BufferAttribute(L.capLines, 3));
        L.capEdges = new THREE.LineSegments(lg, this.styledMaterial(new THREE.LineBasicMaterial({ color: this.style.palette.section_edge, toneMapped: false, transparent: true, opacity: 0.9 }), 'section_edge'));
        L.capEdges.visible = false;
        L.capEdges.userData = { kind: 'cap', noClip: true };
        L.capEdges.renderOrder = 3;
        group.add(L.capEdges);
      }
      // collision segments in metres (walls + closed doors + windows) - recomputed when doors change
      L.segsPx = null;
    }
    // ---- the ground disc with the building's contact shadow (plan L12), under the lowest level
    {
      const Ls = Object.values(this.levels).filter((L) => L.extent);
      if (Ls.length) {
        const low = Ls.reduce((a, b) => (a.elevation < b.elevation ? a : b));
        const e = low.extent, w = e.maxX - e.minX, d = e.maxZ - e.minZ;
        const cx = (e.minX + e.maxX) / 2, cz = (e.minZ + e.maxZ) / 2;
        const gr = new THREE.Group();
        gr.userData = { kind: 'ground', noClip: true };
        // the lit + shadowed disc measured ~19 ms on the iGPU at 1140x852 (levers-gpu.json): the top rung keeps the
        // building's sun shadow on the ground, lite / full draw an unlit disc with the contact blob only
        const shadowed = q >= 3 && !this.lite;
        const discMat = shadowed ? new THREE.MeshStandardMaterial({ color: this.style.ground.disc, roughness: 1, metalness: 0, transparent: true, alphaMap: discAlphaTexture(), depthWrite: false }) : new THREE.MeshBasicMaterial({ color: this.style.ground.disc, transparent: true, alphaMap: discAlphaTexture(), depthWrite: false });
        const disc = new THREE.Mesh(new THREE.CircleGeometry(Math.max(w, d) * 3.2, 72), this.styledMaterial(discMat, 'ground_disc'));
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(cx, low.elevation - 0.25, cz);
        disc.receiveShadow = shadowed;
        disc.userData = { kind: 'ground', noClip: true };
        gr.add(disc);
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(w + 3, d + 3), new THREE.MeshBasicMaterial({ map: radialTexture(), color: 0x000000, transparent: true, opacity: this.style.ground.contact, depthWrite: false }));
        sh.rotation.x = -Math.PI / 2;
        sh.position.set(cx, low.elevation - 0.245, cz);
        sh.userData = { kind: 'ground', noClip: true };
        gr.add(sh);
        this.ground = { group: gr, disc, shadow: sh };
        this.root.add(gr);
      }
    }
    // every material that the section cut may clip (walls, furniture, doors, glass) - not the AO decals, caps, ground, sprites
    this.root.traverse((o) => { if (o.material && !(o.userData && o.userData.noClip) && !o.isSprite && !o.isLine) this.clipMaterials.add(o.material); });
    if (this.cutY != null) this.setCut(this.cutY, this.cutLevel);

    // register stair bands on their arrival levels
    const departures = Object.values(this.levels).flatMap((L) => L.stairs.filter((s) => !s.arrival));
    for (const s of departures) {
      const target = this.levels[s.to];
      if (target) target.stairs.push({ ...s, arrival: true });
    }

    // the fixed light pool (see update): count and shadow flags decided once per build
    const poolN = Math.min(MAX_POOL_LIGHTS, this.maxLights ?? MAX_POOL_LIGHTS, Math.max(1, this.lamps.length));
    for (let i = 0; i < poolN; i++) {
      const pl = new THREE.PointLight(0xffffff, 0, 9, 2);
      pl.castShadow = !!opts.lampShadows && i < 2;
      pl.shadow.mapSize.set(512, 512);
      pl.shadow.bias = -0.002;
      pl.position.set(0, -100, 0);
      this.root.add(pl);
      this.pool.push(pl);
    }
    // the floor reflector under the lowest level (realistic only)
    if (this.reflections && quality >= 3) this.addReflectors();
    this.setStates(plan.entities, plan.coverPositions, true);
    this.updateLevelCollision();
    return this.root;
  }

  addReflectors() {
    const { Reflector } = this._reflector || {};
    if (!Reflector) return;
    for (const L of Object.values(this.levels)) {
      if (!L.extent) continue;
      const w = L.extent.maxX - L.extent.minX, d = L.extent.maxZ - L.extent.minZ;
      const r = new Reflector(new THREE.PlaneGeometry(w, d), { clipBias: 0.003, textureWidth: 1024, textureHeight: 1024, color: 0x889099 });
      r.rotation.x = -Math.PI / 2;
      r.position.set((L.extent.minX + L.extent.maxX) / 2, L.elevation - 0.004, (L.extent.minZ + L.extent.maxZ) / 2);
      r.userData = { kind: 'reflector' };
      L.group.add(r);
      this.reflectors.push(r);
    }
  }

  transparentClone(m) {
    const c = m.clone();
    c.transparent = true;
    c.opacity = 0.9;
    return c;
  }

  glassMaterial(frosted, sliding) {
    const q = this.quality;
    if (q >= 3 && !this.lite) {
      return new THREE.MeshPhysicalMaterial({ color: 0xe8f0f8, metalness: 0, roughness: frosted ? 0.55 : 0.05, transmission: frosted ? 0.7 : 0.92, thickness: 0.05, ior: 1.5, transparent: true, opacity: 1, side: THREE.DoubleSide, envMapIntensity: 1.2, clearcoat: 0.6 });
    }
    // cheap glass for the lite / full rungs (plan L5): env-map reflection + low opacity, the dome and the ground show through
    return new THREE.MeshStandardMaterial({ color: 0xdfe9f3, transparent: true, opacity: frosted ? 0.62 : 0.16, roughness: frosted ? 0.5 : 0.05, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 1.4, depthWrite: false });
  }
  shutterMaterial() {
    if (!this._shutter) this._shutter = this.styledMaterial(new THREE.MeshStandardMaterial({ color: this.style.palette.shutter, roughness: 0.6, metalness: 0.3 }), 'shutter');
    return this._shutter;
  }
  markerMaterial() {
    if (!this._marker) this._marker = this.styledMaterial(new THREE.MeshStandardMaterial({ color: this.style.palette.open_door, emissive: this.style.palette.open_door, emissiveIntensity: 0.9, roughness: 0.8 }), 'open_door', 'emissive');
    return this._marker;
  }
  lockMaterial() {
    return new THREE.MeshStandardMaterial({ color: this.style.palette.lock_ok, emissive: this.style.palette.lock_ok, emissiveIntensity: 0.6, roughness: 0.5, metalness: 0.4 });
  }
  lensMaterial(online) {
    const c = this.style.palette.cone;
    return online === false ? new THREE.MeshStandardMaterial({ color: 0x9aa3b5, roughness: 0.2 }) : this.styledMaterial(new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.2 }), 'cone', 'emissive');
  }
  bulbMaterial(kelvin = 3000) {
    const c = kelvinToRGB(kelvin);
    return new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: new THREE.Color(c[0], c[1], c[2]), emissiveIntensity: 0, roughness: 0.4 });
  }

  /**
   * Procedural furniture by item family (plan L1 / P3): rounded / chamfered parts (RoundedBoxGeometry, 2 segments,
   * 1-6 cm radii), separate cushions, tapered legs, seams and handles, shades. Static parts go through `push` (merged
   * per material); device parts stay meshes. Levels 1-2 keep plain boxes (the product's baselines never move), level 3
   * gets the detail; `HEAVY_CONFIG`-style venues would fall back to boxes above a part threshold (not needed here).
   * When `furnitureMode === 'models'` and a glTF for the item id is registered (models.js), the model is used instead
   * and this catalog is the per-item fallback.
   */
  buildObject(o, x, y, z, yaw, group, push, L, plan) {
    const q = this.quality;
    const lib = this.lib;
    const mat = (id) => lib.get(id, q);
    const { w_m: w, d_m: d, h_m: h } = o.size;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const world = (ox, oz) => [x + ox * cs + oz * sn, z - ox * sn + oz * cs];
    const detail = q >= 3;
    /** box (levels 1-2) / rounded box (level 3) at a local offset */
    const B = (mid, bw, bh, bd, ox, oy, oz, r = 0.02, seg = 2) => {
      const [wx, wz] = world(ox, oz);
      const rr = Math.min(r, bw / 2 - 0.001, bh / 2 - 0.001, bd / 2 - 0.001);
      // triangle budget (plan §2.2): one bevel segment on parts under 12 cm (seams, handles, shelves), two on bodies
      const sg = Math.min(bw, bh, bd) < 0.12 ? 1 : seg;
      const g = detail && rr > 0.003 ? new RoundedBoxGeometry(bw, bh, bd, sg, rr) : new THREE.BoxGeometry(bw, bh, bd);
      if (yaw) g.rotateY(yaw);
      g.translate(wx, y + oy, wz);
      push(mid, detail ? boxUV(g, lib.tileM(mid)) : g);
    };
    /** cylinder, optionally tapered (rTop) */
    const C = (mid, r, ch, ox, oy, oz, seg = 16, rTop = r) => {
      const [wx, wz] = world(ox, oz);
      const g = cylAt(r, ch, wx, y + oy, wz, seg, rTop);
      push(mid, detail ? boxUV(g, lib.tileM(mid)) : g);
    };
    /** four tapered legs inside the footprint */
    const legs = (mid, bw, bd, lh, inset = 0.06, r = 0.022, taper = 0.7) => { for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(mid, r, lh, sx * (bw / 2 - inset), lh / 2, sz * (bd / 2 - inset), 10, r * taper); };
    const item = o.item_id;
    const family = item.split('.')[0];
    const entity = o.anchor_ref && o.anchor_ref.resource_type === 'ha_entity' ? o.anchor_ref.resource_id : null;
    const blocks = h >= 0.9 && family !== 'mat' && family !== 'light';
    if (blocks) L.objectsBlocking.push({ x, z, w, d, yaw });
    // contact blob shadow under everything that stands on the floor (plan L3 c): one quad per object, merged per level
    if (family !== 'light' && family !== 'mat' && family !== 'screen' && (o.z_m || 0) < 0.05) {
      const bw = w * 1.3 + 0.1, bd = d * 1.3 + 0.1;
      const P = (ox, oz) => { const [wx, wz] = world(ox, oz); return [wx, y + 0.009, wz]; };
      L.blobs.push(quad(P(-bw / 2, -bd / 2), P(bw / 2, -bd / 2), P(bw / 2, bd / 2), P(-bw / 2, bd / 2)));
    }
    if (this.furnitureMode === 'models' && this.models && this.models.place(item, o, x, y, z, yaw, group, L, plan)) return;
    switch (family) {
      case 'sofa': {
        const seats = w > 1.9 ? 3 : 2;
        const legH = 0.08;
        legs('wood_dark', w - 0.1, d - 0.1, legH, 0.04, 0.02, 0.8);
        B('fabric_accent', w, 0.34, d - 0.04, 0, legH + 0.17, 0.02, 0.045);
        B('fabric_accent', w, h - 0.42, 0.2, 0, 0.42 + (h - 0.42) / 2, -d / 2 + 0.1, 0.05);
        B('fabric_accent', 0.2, 0.3, d, -w / 2 + 0.1, 0.42 + 0.15, 0, 0.06);
        B('fabric_accent', 0.2, 0.3, d, w / 2 - 0.1, 0.42 + 0.15, 0, 0.06);
        const cw = (w - 0.4) / seats - 0.02;
        for (let i = 0; i < seats; i++) {
          const ox = -(w - 0.4) / 2 + cw / 2 + 0.01 + i * (cw + 0.02);
          B('fabric_grey', cw, 0.14, d - 0.34, ox, legH + 0.34 + 0.07, 0.07, 0.05);
          B('fabric_grey', cw - 0.02, 0.36, 0.14, ox, legH + 0.34 + 0.14 + 0.18, -d / 2 + 0.27, 0.05);
        }
        break;
      }
      case 'chair': {
        const seatH = 0.45;
        if (item.includes('office')) {
          C('metal_dark', 0.03, seatH - 0.08, 0, (seatH - 0.08) / 2 + 0.04, 0, 12);
          for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; B('metal_dark', 0.3, 0.03, 0.04, Math.cos(a) * 0.15, 0.03, Math.sin(a) * 0.15, 0.01); }
          B('leather', w, 0.08, d, 0, seatH, 0, 0.03);
          B('leather', w * 0.9, h - seatH - 0.05, 0.08, 0, seatH + (h - seatH) / 2 + 0.03, -d / 2 + 0.06, 0.03);
        } else {
          legs('wood_dark', w, d, seatH, 0.035, 0.018, 0.75);
          B('wood_dark', w, 0.035, d, 0, seatH, 0, 0.012);
          B('fabric_grey', w - 0.04, 0.05, d - 0.04, 0, seatH + 0.04, 0, 0.018);
          B('wood_dark', w * 0.92, h - seatH, 0.03, 0, seatH + (h - seatH) / 2, -d / 2 + 0.02, 0.012);
          C('wood_dark', 0.014, h - seatH - 0.04, -w / 2 + 0.035, seatH + (h - seatH) / 2, -d / 2 + 0.02, 8);
          C('wood_dark', 0.014, h - seatH - 0.04, w / 2 - 0.035, seatH + (h - seatH) / 2, -d / 2 + 0.02, 8);
        }
        break;
      }
      case 'table': {
        const top = item.includes('coffee') ? 'wood_dark' : item.includes('desk') ? 'wood_light' : 'oak';
        B(top, w, 0.035, d, 0, h - 0.0175, 0, 0.012);
        if (item.includes('coffee')) legs('metal_dark', w, d, h - 0.035, 0.05, 0.016, 0.8);
        else if (item.includes('desk')) { B('wood_light', 0.03, h - 0.035, d - 0.1, -w / 2 + 0.03, (h - 0.035) / 2, 0, 0.008); B('wood_light', 0.03, h - 0.035, d - 0.1, w / 2 - 0.03, (h - 0.035) / 2, 0, 0.008); B('wood_light', w - 0.1, 0.4, 0.02, 0, h - 0.25, -d / 2 + 0.06, 0.006); }
        else legs('wood_dark', w, d, h - 0.035, 0.07, 0.03, 0.7);
        if (item.includes('desk')) { B('metal_dark', 0.52, 0.32, 0.018, 0.15, h + 0.3, -d / 2 + 0.16, 0.006); B('metal_dark', 0.16, 0.12, 0.14, 0.15, h + 0.06, -d / 2 + 0.16, 0.008); B('metal_light', 0.42, 0.012, 0.14, 0.1, h + 0.006, 0.08, 0.004); }
        break;
      }
      case 'cabinet': {
        const mid = item.includes('bookcase') ? 'wood_dark' : item.includes('tv') ? 'wood_dark' : 'wood_light';
        if (item.includes('bookcase')) {
          B(mid, 0.025, h, d, -w / 2 + 0.0125, h / 2, 0, 0.004); B(mid, 0.025, h, d, w / 2 - 0.0125, h / 2, 0, 0.004);
          B(mid, w, 0.025, d, 0, h - 0.0125, 0, 0.004); B(mid, w, 0.03, 0.02, 0, h / 2, -d / 2 + 0.01, 0.004);
          for (let i = 0; i <= 4; i++) B(mid, w - 0.05, 0.02, d - 0.02, 0, (h / 5) * i + 0.01, 0.01, 0.004);
          // a few books as muted blocks
          for (let i = 1; i < 5; i++) for (let k = 0; k < 3; k++) B(k % 2 ? 'linen' : 'fabric_rug', (w - 0.1) / 3.4, (h / 5) * 0.62, d * 0.6, -(w - 0.1) / 2 + ((w - 0.1) / 3) * (k + 0.5), (h / 5) * i + 0.02 + (h / 5) * 0.31, 0.02, 0.006);
        } else {
          B(mid, w, h - 0.06, d, 0, (h - 0.06) / 2 + 0.06, 0, 0.012);
          B('wood_dark', w - 0.08, 0.06, d - 0.06, 0, 0.03, -0.02, 0.006);
          const doors = Math.max(1, Math.round(w / 0.5));
          for (let i = 1; i < doors; i++) B('wood_dark', 0.006, h - 0.1, 0.008, -w / 2 + (w / doors) * i, (h - 0.06) / 2 + 0.06, d / 2, 0.002);
          if (item.includes('wardrobe')) { for (const sx of [-1, 1]) B('metal_light', 0.012, 0.22, 0.012, sx * 0.04, h * 0.5, d / 2 + 0.012, 0.005); }
          else for (let i = 0; i < doors; i++) B('metal_light', Math.min(0.14, w / doors - 0.1), 0.012, 0.012, -w / 2 + (w / doors) * (i + 0.5), h - 0.12, d / 2 + 0.012, 0.005);
        }
        break;
      }
      case 'screen': {
        const g = detail ? new RoundedBoxGeometry(w, h, d, 2, 0.008) : boxAt(w, h, d, 0, 0, 0);
        const m = new THREE.Mesh(g, this.styledMaterial(new THREE.MeshStandardMaterial({ color: this.style.palette.screen_off, emissive: 0xffffff, emissiveMap: screenTexture(), emissiveIntensity: 0, roughness: 0.2, metalness: 0.3 }), 'screen_off'));
        m.position.set(x, y + h / 2, z);
        m.rotation.y = yaw;
        m.userData = { kind: 'device', entity, label: plan.entityNames[entity] || 'טלוויזיה', domain: 'media_player' };
        m.castShadow = true;
        group.add(m);
        this.devices.push(m);
        this.screens = this.screens || [];
        this.screens.push({ entity, mesh: m });
        break;
      }
      case 'bed': {
        B('wood_light', w, 0.2, d, 0, 0.1, 0, 0.02);
        B('linen', w - 0.06, 0.2, d - 0.1, 0, 0.3, 0.03, 0.06);
        B('fabric_grey', w - 0.02, 0.08, d * 0.62, 0, 0.44, d * 0.17, 0.04);
        B('fabric_grey', w - 0.02, 0.05, 0.3, 0, 0.47, d * 0.17 - d * 0.31 + 0.15, 0.025);
        B('linen', Math.min(0.6, w / 2 - 0.12), 0.11, 0.42, w > 1.2 ? -w / 4 : 0, 0.455, -d / 2 + 0.32, 0.05);
        if (w > 1.2) B('linen', Math.min(0.6, w / 2 - 0.12), 0.11, 0.42, w / 4, 0.455, -d / 2 + 0.32, 0.05);
        B('wood_dark', w, h + 0.45, 0.05, 0, (h + 0.45) / 2, -d / 2 + 0.025, 0.02);
        legs('wood_dark', w - 0.08, d - 0.08, 0.1, 0.02, 0.03, 0.9);
        break;
      }
      case 'kitchen': {
        if (item.includes('fridge')) { B('metal_light', w, h, d, 0, h / 2, 0, 0.03); B('metal_dark', 0.006, h - 0.5, 0.006, 0, h * 0.55, d / 2, 0.002); B('metal_dark', 0.02, 0.5, 0.02, w / 2 - 0.08, h * 0.6, d / 2 + 0.015, 0.008); }
        else {
          B('wood_light', w, h - 0.14, d, 0, (h - 0.14) / 2 + 0.1, 0, 0.01);
          B('wood_dark', w - 0.06, 0.1, d - 0.06, 0, 0.05, -0.01, 0.006);
          B('concrete', w + 0.03, 0.04, d + 0.03, 0, h - 0.02, 0, 0.01);
          const n = Math.max(1, Math.round(Math.max(w, d) / 0.6));
          const along = w >= d;
          for (let i = 1; i < n; i++) B('wood_dark', along ? 0.006 : w + 0.001, h - 0.3, along ? d + 0.001 : 0.006, along ? -w / 2 + (w / n) * i : 0, (h - 0.14) / 2 + 0.1, along ? 0 : -d / 2 + (d / n) * i, 0.002);
          for (let i = 0; i < n; i++) B('metal_light', along ? 0.12 : 0.012, 0.012, along ? 0.012 : 0.12, along ? -w / 2 + (w / n) * (i + 0.5) : (w / 2 + 0.012) * (o.rotation_deg ? 1 : -1), h - 0.1, along ? d / 2 + 0.012 : -d / 2 + (d / n) * (i + 0.5), 0.005);
          if (item.includes('counter') && w < d) B('metal_light', 0.44, 0.012, 0.38, 0, h + 0.006, 0, 0.004);
          if (item.includes('island')) B('metal_dark', 0.5, 0.008, 0.4, w / 4, h + 0.004, 0, 0.003);
        }
        break;
      }
      case 'plant': {
        C('concrete', w / 2, 0.36, 0, 0.18, 0, 18, w / 2.3);
        C('wood_dark', w / 2 - 0.03, 0.02, 0, 0.36, 0, 18);
        const r = w * 0.55;
        for (const [ox, oy, oz, k] of [[0, h - r * 0.9, 0, 1], [r * 0.5, h - r * 1.3, r * 0.2, 0.7], [-r * 0.45, h - r * 1.25, -r * 0.3, 0.75], [r * 0.1, h - r * 1.6, -r * 0.5, 0.6], [-r * 0.2, h - r * 1.5, r * 0.5, 0.65]]) {
          const g = new THREE.SphereGeometry(r * k, 12, 9);
          const [wx, wz] = world(ox, oz);
          g.translate(wx, y + oy, wz);
          push('grass', g);
        }
        break;
      }
      case 'mat': B('fabric_rug', w, 0.016, d, 0, 0.008, 0, 0.006); break;
      case 'sanitary': {
        if (item.includes('wc')) { C('tiles_white', 0.19, 0.38, 0, 0.19, 0.08, 18, 0.16); B('tiles_white', 0.4, 0.06, 0.5, 0, 0.42, 0.04, 0.03); B('tiles_white', 0.38, 0.4, 0.17, 0, 0.62, -d / 2 + 0.085, 0.025); }
        else if (item.includes('tub')) { B('tiles_white', w, h, d, 0, h / 2, 0, 0.06); B('linen', w - 0.18, 0.04, d - 0.18, 0, h - 0.06, 0, 0.012); B('metal_light', 0.02, 0.2, 0.02, w / 2 - 0.2, h + 0.1, 0, 0.008); }
        else { B('tiles_white', w, 0.14, d, 0, h - 0.07, 0, 0.04); B('tiles_white', 0.22, h - 0.14, 0.2, 0, (h - 0.14) / 2, 0, 0.03); B('metal_light', 0.012, 0.16, 0.012, 0, h + 0.08, -d / 2 + 0.06, 0.005); }
        break;
      }
      case 'appliance': {
        if (item.includes('boiler')) { C('metal_light', w / 2, h, 0, h / 2, 0, 18); C('metal_dark', w / 2 - 0.03, 0.02, 0, h, 0, 18); }
        else { B('metal_light', w, h, d, 0, h / 2, 0, 0.025); C('metal_dark', 0.2, 0.02, 0, h * 0.5, d / 2 + 0.01, 24); B('metal_dark', w - 0.1, 0.1, 0.01, 0, h - 0.09, d / 2 + 0.005, 0.004); }
        break;
      }
      case 'extinguisher': {
        const g = cylAt(0.08, h, x, y + h / 2, z, 12);
        push('metal_dark', g);
        const red = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, h * 0.8, 12), new THREE.MeshStandardMaterial({ color: 0xc8443c, roughness: 0.4, metalness: 0.3 }));
        red.position.set(x, y + h / 2, z);
        group.add(red);
        break;
      }
      case 'light': {
        const kelvin = item.includes('pendant') ? 2700 : item.includes('floor') ? 2700 : 3200;
        const bulb = this.bulbMaterial(kelvin);
        let bulbMesh, lightPos, shade = null;
        if (item.includes('ceiling')) {
          const disc = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 - 0.02, w / 2 * 0.88, 0.07, 24), bulb);
          disc.position.set(x, y + 0.035, z);
          bulbMesh = disc;
          lightPos = new THREE.Vector3(x, y - 0.12, z);
          const rim = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 + 0.01, w / 2 + 0.01, 0.03, 24), mat('metal_light'));
          rim.position.set(x, y + 0.085, z);
          group.add(rim);
        } else if (item.includes('pendant')) {
          const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.7, 6), mat('metal_dark'));
          cord.position.set(x, y + h + 0.35, z);
          group.add(cord);
          const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16), mat('metal_dark'));
          rose.position.set(x, y + h + 0.69, z);
          group.add(rose);
          shade = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2 * 0.45, h, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a3f46, emissive: new THREE.Color(...kelvinToRGB(kelvin)), emissiveIntensity: 0, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }));
          shade.position.set(x, y + h / 2, z);
          group.add(shade);
          const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), bulb);
          b.position.set(x, y + 0.1, z);
          bulbMesh = b;
          lightPos = new THREE.Vector3(x, y, z);
        } else if (item.includes('floor')) {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h - 0.3, 10), mat('metal_dark'));
          pole.position.set(x, y + (h - 0.3) / 2, z);
          group.add(pole);
          const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.02, 20), mat('metal_dark'));
          base.position.set(x, y + 0.01, z);
          group.add(base);
          const sh = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2 * 0.82, 0.32, 24, 1, true), bulb);
          sh.position.set(x, y + h - 0.16, z);
          bulbMesh = sh;
          lightPos = new THREE.Vector3(x, y + h - 0.12, z);
        } else {
          const sc = new THREE.Mesh(detail ? new RoundedBoxGeometry(w, h, d, 2, 0.02) : new THREE.BoxGeometry(w, h, d), bulb);
          sc.position.set(x, y + h / 2, z);
          sc.rotation.y = yaw;
          bulbMesh = sc;
          lightPos = new THREE.Vector3(x, y + h / 2, z);
        }
        bulbMesh.userData = { kind: 'device', entity, label: plan.entityNames[entity] || entity, domain: 'light' };
        group.add(bulbMesh);
        this.devices.push(bulbMesh);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(...kelvinToRGB(kelvin)), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.scale.set(1.1, 1.1, 1);
        glow.position.copy(lightPos);
        glow.userData = { noClip: true };
        group.add(glow);
        this.lamps.push({ entity, bulb: bulbMesh, pos: lightPos, glow, kelvin, level: L.id, light: null, on: false, kind: item, shade });
        this.labels.push({ kind: 'device', entity, pos: lightPos.clone(), level: L.id });
        break;
      }
      default:
        B('concrete', w, h, d, 0, h / 2, 0, 0.01);
    }
  }

  /** The walk's collision segments per level in metres, recomputed from the entity states (doors). */
  updateLevelCollision() {
    const doc = this.plan.doc;
    for (const L of Object.values(this.levels)) {
      const segs = blockingSegments(doc, this.W, this.H, L.id, this.plan.entities).map((s) => ({ a: [s.a[0] * this.scale, s.a[1] * this.scale], b: [s.b[0] * this.scale, s.b[1] * this.scale], w: (s.w || 0) * this.scale, kind: s.kind, id: s.id }));
      // locked doors are closed to the walk
      for (const dr of this.doors) if (dr.lock && this.plan.entities[dr.lock] === 'locked') {
        const op = doc.openings.find((o) => o.id === dr.id);
        if (op && !segs.some((s) => s.id === op.id)) {
          const st = buildStructure(doc, this.W, this.H, L.id).openings.find((o) => o.opening.id === op.id);
          if (st) segs.push({ a: [st.g0[0] * this.scale, st.g0[1] * this.scale], b: [st.g1[0] * this.scale, st.g1[1] * this.scale], w: st.wpx * this.scale, kind: 'door-locked', id: op.id });
        }
      }
      for (const ob of L.objectsBlocking) {
        const c = Math.cos(ob.yaw), s = Math.sin(ob.yaw);
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [ob.x + (sx * ob.w / 2) * c + (sz * ob.d / 2) * s, ob.z - (sx * ob.w / 2) * s + (sz * ob.d / 2) * c]);
        for (let i = 0; i < 4; i++) segs.push({ a: corners[i], b: corners[(i + 1) % 4], w: 0, kind: 'object', id: 'obj' });
      }
      L.segs = segs;
    }
  }

  /** Push the entity states into the scene: door targets, shutters, lamps, markers, presence, screens, locks. */
  setStates(entities, coverPositions, immediate = false) {
    this.plan.entities = entities;
    this.plan.coverPositions = coverPositions || this.plan.coverPositions || {};
    for (const dr of this.doors) {
      const open = dr.entity ? isOpenState(entities[dr.entity]) : false;
      dr.open = open;
      if (immediate) dr.t = open ? 1 : 0;
    }
    for (const sh of this.shutters) {
      const pos = this.plan.coverPositions[sh.entity];
      const st = entities[sh.entity];
      sh.target = typeof pos === 'number' ? pos / 100 : st === 'open' ? 1 : 0;
      if (immediate) sh.current = sh.target;
    }
    for (const lp of this.lamps) lp.on = entities[lp.entity] === 'on';
    for (const m of this.markers) m.group.visible = isOpenState(entities[m.entity]);
    for (const p of this.presence) p.mesh.visible = entities[p.entity] === 'on';
    for (const t of this.tints) t.mesh.visible = entities[t.entity] === 'on';
    for (const s of this.screens || []) s.mesh.material.emissiveIntensity = entities[s.entity] === 'playing' || entities[s.entity] === 'on' ? 0.9 : 0;
    for (const lk of this.lockPlates || []) { const locked = entities[lk.entity] === 'locked'; const hx = locked ? this.style.palette.open_door : this.style.palette.lock_ok; lk.mesh.material.color.setHex(hx); lk.mesh.material.emissive.setHex(hx); }
    this.updateLevelCollision();
  }

  /** Per-frame: door / shutter animation and the lamp light pool (nearest MAX_POOL_LIGHTS lit lamps get real lights). */
  update(dt, cameraPos, opts = {}) {
    let moving = false;
    const k = Math.min(1, dt / (ANIM_MS / 1000));
    for (const dr of this.doors) {
      const target = dr.open ? 1 : 0;
      if (Math.abs(dr.t - target) > 1e-3) { dr.t += Math.sign(target - dr.t) * k; dr.t = Math.max(0, Math.min(1, dr.t)); moving = true; }
      const e = dr.t < 0.5 ? 2 * dr.t * dr.t : 1 - Math.pow(-2 * dr.t + 2, 2) / 2;
      for (const lf of dr.leaves) {
        if (lf.kind === 'swing') lf.grp.rotation.y = lf.closedYaw + (lf.openYaw - lf.closedYaw) * e;
        else lf.grp.position.set(lf.base[0] + lf.slide[0] * e, lf.grp.position.y, lf.base[1] + lf.slide[1] * e);
      }
    }
    for (const sh of this.shutters) {
      if (Math.abs(sh.current - sh.target) > 1e-3) { sh.current += Math.sign(sh.target - sh.current) * k * 0.6; sh.current = Math.max(0, Math.min(1, sh.current)); moving = true; }
      const drop = sh.height * (1 - sh.current);
      sh.mesh.scale.y = Math.max(0.001, drop);
      sh.mesh.visible = drop > 0.01;
    }
    // lamps (plan L7): plausible emissive levels per style, a small glow, shades with an inner glow; the glow sprite is
    // hidden when the lamp sits above the section cut (the room's pool light stays, which is the state cue)
    const night = opts.nightFactor ?? 0;
    const R = this.style.rig;
    const lit = this.lamps.filter((l) => l.on && this.levels[l.level].group.visible);
    for (const l of this.lamps) {
      const target = l.on ? (this.quality >= 3 ? lerp(R.lampEmissiveDay, R.lampEmissiveNight, night) : 1.4) : 0;
      l.bulb.material.emissiveIntensity += (target - l.bulb.material.emissiveIntensity) * Math.min(1, dt * 8);
      if (l.shade) l.shade.material.emissiveIntensity = l.bulb.material.emissiveIntensity * 0.22;
      const above = this.cutY != null && l.pos.y > this.cutY;
      const gt = l.on && !above ? 0.16 + night * 0.26 : 0;
      l.glow.material.opacity += (gt - l.glow.material.opacity) * Math.min(1, dt * 8);
      if (Math.abs(target - l.bulb.material.emissiveIntensity) > 0.01) moving = true;
    }
    lit.sort((a, b) => a.pos.distanceToSquared(cameraPos) - b.pos.distanceToSquared(cameraPos));
    const want = lit.slice(0, this.pool.length);
    // the pool is a FIXED set of lights created at build time: three.js recompiles every material when the number of
    // lights (or of shadow-casting lights) changes, so the count never moves - only positions, colours, intensities
    for (let i = 0; i < this.pool.length; i++) {
      const pl = this.pool[i];
      const l = want[i];
      if (!l) { pl.intensity = 0; continue; }
      pl.position.copy(l.pos);
      const c = kelvinToRGB(l.kelvin + R.lampKelvinOffset);
      pl.color.setRGB(c[0], c[1], c[2]);
      const base = l.kind.includes('floor') ? 6 : l.kind.includes('wall') ? 5 : 11; // candela-ish (decay 2)
      pl.intensity = base * lerp(R.lampPoolDay, R.lampPoolNight, night);
    }
    return moving;
  }

  showLevel(mode, walk = false) {
    const ids = Object.keys(this.levels);
    for (const id of ids) {
      const L = this.levels[id];
      const vis = mode === 'all' || mode === id;
      L.group.visible = vis;
      const ceilingsOn = walk || (mode === 'all' && id !== ids[ids.length - 1]) ? true : false;
      for (const c of L.ceilings) c.visible = ceilingsOn && !(mode === 'all' && !walk && id === ids[ids.length - 1]);
      // in "all" the lower level's ceiling is hidden (the upper slab covers it) unless walking
      if (mode === 'all' && !walk) for (const c of L.ceilings) c.visible = false;
    }
    for (const c of this.cameras) { c.vol.visible = walk; c.cone.visible = !walk; }
  }

  /** The device under a ray, if any. */
  pick(raycaster) {
    const hits = raycaster.intersectObjects(this.devices, false);
    for (const h of hits) {
      const u = h.object.userData;
      if (u && (u.kind === 'device' || u.kind === 'camera' || u.kind === 'lock')) return { ...u, point: h.point, distance: h.distance };
    }
    return null;
  }
}

/** Coverage polygon in plan px: rays from the origin across the fov, stopped by the segments. */
export function coverage(origin, rotationDeg, fovDeg, radiusPx, segs) {
  const pts = [origin];
  const steps = Math.max(24, Math.round(fovDeg / 2));
  for (let i = 0; i <= steps; i++) {
    const bearing = rotationDeg - fovDeg / 2 + (fovDeg * i) / steps;
    const rad = ((bearing - 90) * Math.PI) / 180;
    const d = [Math.cos(rad), Math.sin(rad)];
    let best = radiusPx;
    for (const s of segs) {
      const t = raySegment(origin, d, s.a, s.b);
      if (t !== null && t > 0.5 && t < best) best = t;
    }
    pts.push([origin[0] + d[0] * best, origin[1] + d[1] * best]);
  }
  return pts;
}
export function raySegment(o, d, a, b) {
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const den = d[0] * ey - d[1] * ex;
  if (Math.abs(den) < 1e-12) return null;
  const wx = a[0] - o[0], wy = a[1] - o[1];
  const t = (wx * ey - wy * ex) / den;
  const u = (wx * d[1] - wy * d[0]) / den;
  if (t < 0 || u < -1e-9 || u > 1 + 1e-9) return null;
  return t;
}

export function kelvinToRGB(k) {
  const t = k / 100;
  let r, g, b;
  r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v) => Math.max(0, Math.min(255, v)) / 255;
  return [c(r), c(g), c(b)];
}

/** A muted "picture" for a playing screen: soft gradient bands, no logo, no photo (generated, no files). */
let _screen = null;
export function screenTexture() {
  if (_screen) return _screen;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 144;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 144);
  g.addColorStop(0, '#2b3f5e'); g.addColorStop(0.45, '#6d8fb3'); g.addColorStop(0.7, '#c9b08a'); g.addColorStop(1, '#3a2f3a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 144);
  const r = ctx.createRadialGradient(150, 60, 10, 150, 60, 150);
  r.addColorStop(0, 'rgba(255,245,225,0.55)'); r.addColorStop(1, 'rgba(255,245,225,0)');
  ctx.fillStyle = r; ctx.fillRect(0, 0, 256, 144);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, 256, 14); ctx.fillRect(0, 130, 256, 14);
  _screen = new THREE.CanvasTexture(c);
  _screen.colorSpace = THREE.SRGBColorSpace;
  return _screen;
}

let _glow = null;
export function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _glow = new THREE.CanvasTexture(c);
  _glow.colorSpace = THREE.SRGBColorSpace;
  return _glow;
}
