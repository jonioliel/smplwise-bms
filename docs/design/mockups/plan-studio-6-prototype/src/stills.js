/**
 * Stills + per-room SVG masks (CR-029 §3.2 / §3.3, approach B1): the live view renders a fixed preset at a fixed size
 * for day / night x lights-off / lights-on, and the room polygons are projected with the SAME camera matrix into SVG
 * clip paths. The kiosk layer then shows the base picture and reveals the lights-on picture per lit room through its
 * mask, draws open-door markers and presence outlines from the same projection - the owner's reference technique,
 * generated from the geometry instead of hand-drawn. Zero WebGL frames while it is shown.
 */
import * as THREE from 'three';

export class StillsBaker {
  constructor(env, planScene) {
    this.env = env;
    this.scene = planScene;
    this.sets = {}; // level -> { day: { off, on }, night: { off, on }, masks: [{ zone, points }], doors: [...], w, h, camera }
  }

  /** Render one still through the full chain (post included) into a data URL at (w, h). */
  snapshot(camera, w, h) {
    const env = this.env;
    const prev = env.size;
    env.setSize(w, h);
    if (camera.isPerspectiveCamera) camera.aspect = w / h;
    camera.updateProjectionMatrix();
    env.render(camera);
    const url = this.compose(env.renderer.domElement, w, h);
    env.setSize(prev.w, prev.h);
    return url;
  }

  /** The canvas is alpha (the CSS gradient is the sky): paint the same sky under the pixels before encoding. */
  compose(source, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, h);
    const [top, hor, bottom] = this.env.backdropColors();
    g.addColorStop(0, top); g.addColorStop(0.62, hor); g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.9);
  }

  /** A cheap thumbnail: a plain render (no post chain, no resize of the composer) into an offscreen target. */
  thumbnail(camera, w, h) {
    const env = this.env;
    const r = env.renderer;
    if (!this._rt || this._rt.width !== w || this._rt.height !== h) { if (this._rt) this._rt.dispose(); this._rt = new THREE.WebGLRenderTarget(w, h, { samples: 0 }); }
    const prevTarget = r.getRenderTarget();
    r.setRenderTarget(this._rt);
    r.render(env.scene, camera);
    const px = new Uint8Array(w * h * 4);
    r.readRenderTargetPixels(this._rt, 0, 0, w, h, px);
    r.setRenderTarget(prevTarget);
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext('2d');
    const img = tctx.createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4); // flip
    tctx.putImageData(img, 0, 0);
    return this.compose(tmp, w, h);
  }

  project(camera, v, w, h) {
    const p = v.clone().project(camera);
    return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h];
  }

  /** Bake a level: 4 pictures + masks. `applyState(variant)` sets time + lamp states on the live scene before each render. */
  async bake(levelId, camera, w, h, applyState, markers) {
    const L = this.scene.levels[levelId];
    const set = { w, h, pics: {}, masks: [], doors: [], cams: [] };
    for (const variant of ['day_off', 'day_on', 'night_off', 'night_on']) {
      applyState(variant);
      await new Promise((r) => requestAnimationFrame(r));
      set.pics[variant] = this.snapshot(camera, w, h);
    }
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    for (const z of L.zones) {
      const pts = z.polyM.map(([x, zz]) => this.project(camera, new THREE.Vector3(x, L.elevation + 0.02, zz), w, h));
      // a wall-height prism mask reads better than the floor polygon alone: union of the floor polygon and its lifted twin
      const top = z.polyM.map(([x, zz]) => this.project(camera, new THREE.Vector3(x, L.elevation + L.ceiling * 0.55, zz), w, h));
      set.masks.push({ zone: z.id, name: z.name, light: z.x_proto && z.x_proto.light, presence: z.x_proto && z.x_proto.presence, temp: z.x_proto && z.x_proto.temp, floor: pts, top, centre: this.project(camera, new THREE.Vector3(...centroid3(z.polyM, L.elevation + 1.2)), w, h) });
    }
    for (const m of markers || []) {
      const pts = m.points.map((v) => this.project(camera, v, w, h));
      set.doors.push({ entity: m.entity, points: pts });
    }
    for (const c of this.scene.cameras.filter((c) => c.level === levelId)) {
      set.cams.push({ id: c.id, label: c.label, p: this.project(camera, new THREE.Vector3(c.pos[0], L.elevation + c.mount, c.pos[1]), w, h) });
    }
    this.sets[levelId] = set;
    return set;
  }
}

function centroid3(poly, y) {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i], [x1, z1] = poly[(i + 1) % poly.length];
    const f = x0 * z1 - x1 * z0;
    a += f; cx += (x0 + x1) * f; cz += (z0 + z1) * f;
  }
  if (Math.abs(a) < 1e-9) return [poly[0][0], y, poly[0][1]];
  return [cx / (3 * a), y, cz / (3 * a)];
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Compose the kiosk layer into `host` (an element with position relative): base image, masked lights-on, markers. */
export function renderStills(host, set, state) {
  host.innerHTML = '';
  if (!set) { host.innerHTML = '<div class="stills-empty">אין תמונות מוכנות לקומה זו — לחץ "הכן תמונות" בלשונית האיכות</div>'; return; }
  const night = state.night;
  const base = set.pics[night ? 'night_off' : 'day_off'];
  const on = set.pics[night ? 'night_on' : 'day_on'];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${set.w} ${set.h}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.classList.add('stills-svg');
  const defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);
  const img = (href) => { const e = document.createElementNS(SVG_NS, 'image'); e.setAttribute('href', href); e.setAttribute('width', set.w); e.setAttribute('height', set.h); e.setAttribute('preserveAspectRatio', 'none'); return e; };
  svg.appendChild(img(base));
  const polyPts = (pts) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const hull = (m) => convexHull([...m.floor, ...m.top]);
  for (const m of set.masks) {
    const lit = m.light && state.entities[m.light] === 'on';
    if (!lit) continue;
    const clip = document.createElementNS(SVG_NS, 'clipPath');
    clip.setAttribute('id', `mask-${m.zone}`);
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', polyPts(hull(m)));
    clip.appendChild(poly);
    defs.appendChild(clip);
    const litImg = img(on);
    litImg.setAttribute('clip-path', `url(#mask-${m.zone})`);
    litImg.classList.add('stills-lit');
    svg.appendChild(litImg);
  }
  for (const m of set.masks) {
    const present = m.presence && state.entities[m.presence] === 'on';
    if (present) {
      const poly = document.createElementNS(SVG_NS, 'polygon');
      poly.setAttribute('points', polyPts(m.floor));
      poly.setAttribute('class', 'stills-presence');
      svg.appendChild(poly);
    }
  }
  for (const d of set.doors) {
    if (state.entities[d.entity] !== 'on' && state.entities[d.entity] !== 'open') continue;
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', polyPts(convexHull(d.points)));
    poly.setAttribute('class', 'stills-door');
    svg.appendChild(poly);
  }
  for (const c of set.cams) {
    const g = document.createElementNS(SVG_NS, 'circle');
    g.setAttribute('cx', c.p[0]); g.setAttribute('cy', c.p[1]); g.setAttribute('r', 6);
    g.setAttribute('class', 'stills-cam');
    svg.appendChild(g);
  }
  host.appendChild(svg);
  // temperature chips as DOM over the svg (the product's DOM-label rule)
  const chips = document.createElement('div');
  chips.className = 'stills-chips';
  for (const m of set.masks) {
    if (typeof m.temp !== 'number') continue;
    const c = document.createElement('span');
    c.className = 'chipT';
    c.textContent = `${m.temp.toFixed(1)}°`;
    c.style.left = `${(m.centre[0] / set.w) * 100}%`;
    c.style.top = `${(m.centre[1] / set.h) * 100}%`;
    chips.appendChild(c);
  }
  host.appendChild(chips);
  // the svg uses 'meet' so chips must map to the letterboxed image: size the chip layer like the svg content box
  requestAnimationFrame(() => {
    const r = host.getBoundingClientRect();
    const s = Math.min(r.width / set.w, r.height / set.h);
    const cw = set.w * s, ch = set.h * s;
    chips.style.width = `${cw}px`; chips.style.height = `${ch}px`;
    chips.style.left = `${(r.width - cw) / 2}px`; chips.style.top = `${(r.height - ch) / 2}px`;
  });
}

export function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}
