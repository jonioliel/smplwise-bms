/**
 * The three.js realisation of a scene description (T087, design 10.2-10.4, quality level 1: flat materials, an ambient
 * and a directional light, no shadows). One InstancedMesh per instance group (a unit box or a unit cylinder scaled per
 * instance), a Mesh per prism, a Sprite per label, a fixed pool of MAX_GLOW_LIGHTS point lights for the glows;
 * OrbitControls with touch; the presets top / isometric / from a camera; picking by ray (through translucent plates); a
 * line outline on the selected item; GLTFExporter (without the outline). Frames render on demand - a change, or damping
 * still moving - unless continuous mode is on. Above 3,000 parts the small objects hide when the camera is far. Colours come from the element's computed design
 * tokens - the description carries names only. This is the only module that imports the three bundle (the lazy chunk).
 */
import { AmbientLight, BoxGeometry, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight, DoubleSide, Euler, Float32BufferAttribute, GLTFExporter, Group, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshLambertMaterial, Object3D, OrbitControls, PerspectiveCamera, PointLight, Quaternion, Raycaster, SRGBColorSpace, Scene, ShapeUtils, Sprite, SpriteMaterial, Vector2, Vector3, WebGLRenderer } from './three-bundle';
import type { SceneDescription, ScenePart, Vec3 } from './scene-builder';

export type ScenePreset = 'top' | 'iso' | { camera: string };
export interface SceneHit {
  id: string;
  kind: string;
  partId: string;
}
export interface SceneViewOptions {
  mount: HTMLElement;
  color: (token: string) => string;
  onSelect: (hit: SceneHit | null) => void;
  onHover: (hit: SceneHit | null, x: number, y: number) => void;
  onFrame: (frames: number, fps: number) => void;
}

export const SMALL_PART_M = 0.6;
export const HIDE_SMALL_ABOVE_PARTS = 3000;
export const HIDE_SMALL_DISTANCE_M = 45;
/** Every point light is a term in every lit shader: past a handful the frame rate (and the uniform budget) suffers. */
export const MAX_GLOW_LIGHTS = 8;
/** One outline box per part of the selected item, up to this many (a long wall is a few boxes, a tribune a few rows). */
const MAX_OUTLINE_PARTS = 64;
const CLICK_SLOP_PX = 6;
const UPPER_PLATE_OPACITY = 0.35;
const LABEL_BG_ALPHA = 0.88;
const GLOW_INTENSITY = 8;
/** The orbit limit of the overview presets: never under the floor (a camera preset lifts it, a camera may look up). */
const ORBIT_MAX_POLAR = Math.PI / 2 - 0.02;
/** Glows are lights; cones are translucent illustrations - a click passes through both to what lies behind. */
const NOT_PICKABLE = new Set(['glow', 'cone']);

const rad = (d: number): number => (d * Math.PI) / 180;
const isSmall = (p: ScenePart): boolean => p.kind === 'object' && Math.max(p.size[0], p.size[1], p.size[2]) < SMALL_PART_M;

/** The twelve edges of the unit box as line segments (an outline without EdgesGeometry). */
function unitBoxEdges(): BufferGeometry {
  const c = [-0.5, 0.5];
  const pts: number[] = [];
  for (const a of c) for (const b of c) {
    pts.push(-0.5, a, b, 0.5, a, b); // along x
    pts.push(a, -0.5, b, a, 0.5, b); // along y
    pts.push(a, b, -0.5, a, b, 0.5); // along z
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pts, 3));
  return g;
}

/**
 * A vertical prism over a floor polygon (x, z relative to the part's origin), from y = 0 to y = h. Tolerates what the
 * builder can hand over: a closing duplicate, repeated points (a camera inside a wall gives zero-length fan edges), a
 * full-circle cone without its origin, a degenerate (zero-area) ring - that one yields null.
 */
export function prismGeometry(polygon: [number, number][], h: number): BufferGeometry | null {
  const ring: [number, number][] = [];
  for (const q of polygon) {
    const last = ring[ring.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 1e-6) ring.push(q);
  }
  while (ring.length > 1 && Math.hypot(ring[0][0] - ring[ring.length - 1][0], ring[0][1] - ring[ring.length - 1][1]) <= 1e-6) ring.pop();
  if (ring.length < 3 || !(h > 0)) return null;
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  if (Math.abs(area) < 1e-8) return null;
  const tris = ShapeUtils.triangulateShape(ring.map(([x, z]) => new Vector2(x, z)), []);
  const pos: number[] = [];
  for (const [i, j, k] of tris) {
    const [a, b, c] = [ring[i], ring[j], ring[k]];
    if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) < 1e-10) continue; // a zero-area sliver
    pos.push(a[0], h, a[1], b[0], h, b[1], c[0], h, c[1]); // the top cap
    pos.push(a[0], 0, a[1], c[0], 0, c[1], b[0], 0, b[1]); // the bottom cap, reversed
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    pos.push(a[0], 0, a[1], b[0], 0, b[1], b[0], h, b[1], a[0], 0, a[1], b[0], h, b[1], a[0], h, a[1]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export class SceneView {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(50, 1, 0.05, 2000);
  readonly renderer: WebGLRenderer;
  readonly controls: OrbitControls;
  private readonly root = new Group();
  private readonly unitBox = new BoxGeometry(1, 1, 1);
  private readonly unitCylinder = new CylinderGeometry(0.5, 0.5, 1, 24);
  private readonly boxEdges = unitBoxEdges();
  private readonly materials = new Map<string, { token: string; material: MeshLambertMaterial }>();
  private readonly outlineMaterial: LineBasicMaterial;
  private readonly raycaster = new Raycaster();
  /** A fixed pool of point lights for the glows: a lamp switching on moves a light and sets its intensity, it never
   * changes the number of lights (which would recompile every lit shader). */
  private readonly glowPool: PointLight[] = [];
  /** Every pickable object → the parts it carries (index = instanceId for an InstancedMesh, [0] otherwise). */
  private lookup = new Map<Object3D, ScenePart[]>();
  private smallGroups: Object3D[] = [];
  private outline: Group | null = null;
  private desc: SceneDescription | null = null;
  private framed = false;
  private hideSmall = false;
  private disposed = false;
  private continuous = false;
  private raf = 0;
  private frames = 0;
  private fps = 0;
  private windowStart = 0;
  private windowFrames = 0;
  private lastReport = 0;
  private pressed: { x: number; y: number; id: number } | null = null;
  private lastHover: string | null = null;

  constructor(private readonly opts: SceneViewOptions) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.outlineMaterial = new LineBasicMaterial({ color: new Color(opts.color('accent')), depthTest: false, transparent: true });
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    opts.mount.appendChild(canvas);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = ORBIT_MAX_POLAR;
    this.controls.addEventListener('change', this.invalidate);
    this.scene.add(new AmbientLight(0xffffff, 1.6));
    const sun = new DirectionalLight(0xffffff, 1.4);
    sun.position.set(1, 2, 1.2);
    this.scene.add(sun);
    for (let i = 0; i < MAX_GLOW_LIGHTS; i++) {
      const light = new PointLight(0xffffff, 0, 1, 2);
      this.glowPool.push(light);
      this.scene.add(light);
    }
    this.scene.add(this.root);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerleave', this.onLeave);
    this.resize();
  }

  // ---- building

  private material(token: string, opacity: number, doubleSided = false): MeshLambertMaterial {
    const key = `${token}|${opacity}|${doubleSided ? 2 : 1}`;
    let entry = this.materials.get(key);
    if (!entry) {
      // a double-sided translucent surface draws in one pass (three would draw it twice, back then front)
      entry = { token, material: new MeshLambertMaterial({ color: new Color(this.opts.color(token)), transparent: opacity < 1, opacity, depthWrite: opacity >= 1, ...(doubleSided ? { side: DoubleSide, forceSinglePass: true } : {}) }) };
      this.materials.set(key, entry);
    }
    return entry.material;
  }

  /** Read the tokens again (a theme switch between two descriptions recolours the cached materials). */
  private recolour(): void {
    for (const { token, material } of this.materials.values()) material.color.set(this.opts.color(token));
    this.outlineMaterial.color.set(this.opts.color('accent'));
  }

  private transform(o: Object3D, p: ScenePart): void {
    o.position.set(p.position[0], p.position[1], p.position[2]);
    o.quaternion.setFromEuler(new Euler(rad(p.rotation[0]), rad(p.rotation[1]), rad(p.rotation[2]), 'YXZ'));
  }

  /** With several levels shown the plate of every level above the lowest is translucent, so a lower level stays visible
   * through the (full-size) default plate; the screen may still pass one level at a time. */
  private plateOpacity(p: ScenePart): number {
    const levels = this.desc?.levels ?? [];
    if (p.kind !== 'floor' || levels.length < 2) return p.opacity;
    const lowest = Math.min(...levels.map((l) => l.elevation_m));
    const mine = levels.find((l) => l.id === p.level_id);
    return mine && mine.elevation_m > lowest ? Math.min(p.opacity, UPPER_PLATE_OPACITY) : p.opacity;
  }

  private label(p: ScenePart): Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.globalAlpha = LABEL_BG_ALPHA;
      ctx.fillStyle = this.opts.color('surface');
      ctx.beginPath();
      ctx.roundRect(8, 16, 496, 96, 48);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.opts.color(p.color);
      ctx.font = 'bold 44px Heebo, "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl';
      ctx.fillText(p.text ?? '', 256, 66, 480);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: true }));
    sprite.position.set(p.position[0], p.position[1], p.position[2]);
    sprite.scale.set(Math.max(p.size[0], 0.5), Math.max(p.size[1], 0.2), 1);
    return sprite;
  }

  private single(p: ScenePart): Object3D | null {
    if (p.shape === 'box' || p.shape === 'cylinder') {
      const mesh = new Mesh(p.shape === 'cylinder' ? this.unitCylinder : this.unitBox, this.material(p.color, this.plateOpacity(p)));
      this.transform(mesh, p);
      mesh.scale.set(Math.max(p.size[0], 1e-3), Math.max(p.size[1], 1e-3), Math.max(p.size[2], 1e-3));
      return mesh;
    }
    if (p.shape === 'prism') {
      const geometry = prismGeometry(p.polygon ?? [], p.size[1]);
      if (!geometry) return null;
      const mesh = new Mesh(geometry, this.material(p.color, p.opacity, true));
      mesh.position.set(p.position[0], p.position[1], p.position[2]);
      return mesh;
    }
    if (p.shape === 'sprite') return this.label(p);
    return null; // lights come from the pool (setDescription)
  }

  private clear(): void {
    this.setSelected(null);
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      if (child instanceof InstancedMesh) child.dispose();
      else if (child instanceof Mesh && child.geometry !== this.unitBox && child.geometry !== this.unitCylinder) child.geometry.dispose();
      if (child instanceof Sprite) {
        child.material.map?.dispose();
        child.material.dispose();
      }
    }
    for (const light of this.glowPool) light.intensity = 0;
    this.lookup.clear();
    this.smallGroups = [];
  }

  setDescription(desc: SceneDescription): void {
    this.clear();
    this.recolour();
    this.desc = desc;
    const groups = new Map<string, ScenePart[]>();
    const singles: ScenePart[] = [];
    for (const p of desc.parts) {
      if (p.group && (p.shape === 'box' || p.shape === 'cylinder')) {
        const bucket = groups.get(p.group);
        if (bucket) bucket.push(p);
        else groups.set(p.group, [p]);
      } else singles.push(p);
    }
    const m = new Matrix4();
    const q = new Quaternion();
    const pos = new Vector3();
    const scl = new Vector3();
    const e = new Euler();
    for (const [key, parts] of groups) {
      // the key is shape|colour|opacity; read them from the parts, never by splitting (a token could hold a bar)
      const first = parts[0];
      const mesh = new InstancedMesh(first.shape === 'cylinder' ? this.unitCylinder : this.unitBox, this.material(first.color, first.opacity), parts.length);
      parts.forEach((p, i) => {
        q.setFromEuler(e.set(rad(p.rotation[0]), rad(p.rotation[1]), rad(p.rotation[2]), 'YXZ'));
        pos.set(p.position[0], p.position[1], p.position[2]);
        scl.set(Math.max(p.size[0], 1e-3), Math.max(p.size[1], 1e-3), Math.max(p.size[2], 1e-3));
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.name = key;
      this.lookup.set(mesh, parts);
      this.root.add(mesh);
      if (parts.every(isSmall)) this.smallGroups.push(mesh);
    }
    let glows = 0;
    for (const p of singles) {
      if (p.shape === 'light') {
        const light = this.glowPool[glows++];
        if (!light) continue; // past the pool: the lamp keeps its glow colour, without a light of its own
        light.color.set(this.opts.color(p.color));
        light.intensity = GLOW_INTENSITY;
        light.distance = Math.max(p.size[0], 1);
        light.position.set(p.position[0], p.position[1], p.position[2]);
        continue;
      }
      const o = this.single(p);
      if (!o) continue;
      o.name = p.id;
      if (!NOT_PICKABLE.has(p.kind)) this.lookup.set(o, [p]);
      this.root.add(o);
      if (isSmall(p)) this.smallGroups.push(o);
    }
    this.hideSmall = desc.parts.length > HIDE_SMALL_ABOVE_PARTS;
    if (!this.hideSmall) for (const g of this.smallGroups) g.visible = true;
    if (!this.framed) this.framed = this.setPreset('iso');
    this.invalidate();
  }

  // ---- selection and presets

  /** Outline every part that stands for the source item (a wall is one box per straight segment). */
  setSelected(sourceId: string | null): void {
    if (this.outline) {
      this.root.remove(this.outline);
      this.outline = null;
      this.invalidate();
    }
    if (!sourceId || !this.desc) return;
    const parts = this.desc.parts.filter((p) => p.userData.id === sourceId && p.kind !== 'cone' && p.kind !== 'floor' && (p.shape === 'box' || p.shape === 'cylinder' || p.shape === 'prism' || p.shape === 'sprite')).slice(0, MAX_OUTLINE_PARTS);
    if (!parts.length) return;
    const group = new Group();
    for (const part of parts) {
      const line = new LineSegments(this.boxEdges, this.outlineMaterial);
      if (part.shape === 'prism') {
        const poly = part.polygon ?? [];
        if (!poly.length) continue;
        const xs = poly.map((q) => q[0]);
        const zs = poly.map((q) => q[1]);
        const w = Math.max(...xs) - Math.min(...xs);
        const d = Math.max(...zs) - Math.min(...zs);
        line.position.set(part.position[0] + (Math.max(...xs) + Math.min(...xs)) / 2, part.position[1] + part.size[1] / 2, part.position[2] + (Math.max(...zs) + Math.min(...zs)) / 2);
        line.scale.set(w * 1.04 + 0.05, part.size[1] * 1.04 + 0.05, d * 1.04 + 0.05);
      } else {
        this.transform(line, part);
        line.scale.set(part.size[0] * 1.06 + 0.05, part.size[1] * 1.06 + 0.05, (part.shape === 'sprite' ? 0.1 : part.size[2]) * 1.06 + 0.05);
      }
      line.renderOrder = 10;
      group.add(line);
    }
    this.outline = group;
    this.root.add(group);
    this.invalidate();
  }

  /** Move the camera to a preset; false (and nothing moves) when there is no description or no such camera part. */
  setPreset(preset: ScenePreset): boolean {
    const d = this.desc;
    if (!d) return false;
    const [W, D] = d.size;
    const cx = W / 2;
    const cz = D / 2;
    // the distance at which a w x h rectangle facing the camera fills the view (the aspect of the mount counts)
    const fit = (w: number, h: number): number => Math.max(h, w / (this.camera.aspect || 1), 4) / (2 * Math.tan(rad(this.camera.fov / 2)));
    const top = Math.max(0, ...d.levels.map((l) => l.elevation_m + l.ceiling_height_m));
    if (preset === 'top') {
      this.controls.maxPolarAngle = ORBIT_MAX_POLAR;
      this.camera.position.set(cx, top + fit(W, D) * 1.2, cz + 0.001);
      this.controls.target.set(cx, 0, cz);
    } else if (preset === 'iso') {
      this.controls.maxPolarAngle = ORBIT_MAX_POLAR;
      const diag = Math.hypot(W, D);
      const dist = fit(diag, diag * 0.62) * 1.45;
      const dir = new Vector3(1, 0.85, 1).normalize();
      this.camera.position.set(cx + dir.x * dist, dir.y * dist, cz + dir.z * dist);
      this.controls.target.set(cx, 0, cz);
    } else {
      const body = d.parts.find((p) => p.id === preset.camera && p.kind === 'camera');
      if (!body) return false;
      // the body's own forward: -z turned by the part's Euler (YXZ) - the description carries [-tilt, -bearing, 0], so a
      // positive tilt looks down and bearing 0 looks north (ruling R-P4-T4-1); no separate sign rule here
      const f = new Vector3(0, 0, -1).applyEuler(new Euler(rad(body.rotation[0]), rad(body.rotation[1]), rad(body.rotation[2]), 'YXZ'));
      // a camera may look up (a negative tilt): the orbit limit that keeps the user above the floor must not clamp it
      this.controls.maxPolarAngle = Math.PI;
      this.camera.position.set(body.position[0], body.position[1], body.position[2]);
      this.controls.target.set(body.position[0] + f.x * 6, body.position[1] + f.y * 6, body.position[2] + f.z * 6);
    }
    this.controls.update();
    this.invalidate();
    return true;
  }

  /** Host pixels of a scene point (null behind the camera). */
  projectPoint(p: Vec3): { x: number; y: number } | null {
    this.camera.updateMatrixWorld();
    const v = new Vector3(p[0], p[1], p[2]).project(this.camera);
    if (v.z > 1) return null;
    const w = this.opts.mount.clientWidth;
    const h = this.opts.mount.clientHeight;
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
  }

  // ---- picking

  private pick(clientX: number, clientY: number): SceneHit | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.raycaster.setFromCamera(new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    const targets = [...this.lookup.keys()].filter((o) => o.visible); // the raycaster does not skip hidden objects
    for (const hit of this.raycaster.intersectObjects(targets, false)) {
      const parts = this.lookup.get(hit.object);
      if (!parts) continue;
      const part = parts[hit.instanceId ?? 0];
      if (!part) continue;
      if (part.kind === 'floor') {
        if (this.plateOpacity(part) < 1) continue; // a translucent upper plate: the click goes on to the level below
        return null; // an opaque plate: an empty click
      }
      return { id: part.userData.id, kind: part.userData.kind, partId: part.id };
    }
    return null;
  }

  private onDown = (e: PointerEvent) => {
    if (!e.isPrimary) return; // a second finger pinches, it never starts a click
    this.pressed = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };

  private onUp = (e: PointerEvent) => {
    const p = this.pressed;
    if (!p || e.pointerId !== p.id) return;
    this.pressed = null;
    if (e.button !== 0 || Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_SLOP_PX) return; // a drag orbits, it never selects
    this.opts.onSelect(this.pick(e.clientX, e.clientY));
  };

  private onMove = (e: PointerEvent) => {
    if (this.pressed || e.pointerType === 'touch' || !e.isPrimary) return;
    const hit = this.pick(e.clientX, e.clientY);
    const key = hit ? hit.partId : null;
    if (key === this.lastHover) return; // the same part, or still nothing: no event
    this.lastHover = key;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.opts.onHover(hit, e.clientX - rect.left, e.clientY - rect.top);
  };

  private onLeave = () => {
    if (this.lastHover === null) return; // the null hover goes out once
    this.lastHover = null;
    this.opts.onHover(null, 0, 0);
  };

  // ---- frames: on demand (a change schedules one frame; damping keeps scheduling until it settles), or continuous

  /** Schedule one frame (several calls before it runs collapse into one). */
  invalidate = (): void => {
    if (this.disposed || this.raf) return;
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Render every frame (the fps measurement of the live spec) or only on change (the default). */
  setContinuous(on: boolean): void {
    this.continuous = on;
    this.windowStart = 0;
    this.windowFrames = 0;
    this.invalidate();
  }

  resize(): void {
    const w = this.opts.mount.clientWidth || 1;
    const h = this.opts.mount.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  private frame = () => {
    this.raf = 0;
    if (this.disposed) return;
    const moving = this.controls.update(); // true while damping still moves the camera
    if (this.hideSmall) {
      const show = this.camera.position.distanceTo(this.controls.target) < HIDE_SMALL_DISTANCE_M;
      for (const g of this.smallGroups) g.visible = show;
    }
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    const now = performance.now();
    if (!this.windowStart) this.windowStart = now;
    this.windowFrames++;
    if (now - this.windowStart >= 1000) {
      this.fps = Math.round((this.windowFrames * 1000) / (now - this.windowStart));
      this.windowStart = now;
      this.windowFrames = 0;
    }
    const more = moving || this.continuous;
    // the counters go out at most once a second while frames run, and once more when they stop
    if (!more || now - this.lastReport >= 1000) {
      this.lastReport = now;
      this.opts.onFrame(this.frames, this.fps);
    }
    if (more) this.invalidate();
    else {
      this.windowStart = 0; // the next burst measures afresh
      this.windowFrames = 0;
    }
  };

  /** The glTF of the scene as drawn, without the selection outline (exported from a copy of the root). */
  async exportGltf(): Promise<Record<string, unknown>> {
    const copy = new Group();
    for (const child of this.root.children) if (child !== this.outline) copy.add(child.clone());
    const out = await new GLTFExporter().parseAsync(copy, { binary: false, onlyVisible: false });
    return out as Record<string, unknown>;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onDown);
    canvas.removeEventListener('pointerup', this.onUp);
    canvas.removeEventListener('pointermove', this.onMove);
    canvas.removeEventListener('pointerleave', this.onLeave);
    this.controls.removeEventListener('change', this.invalidate);
    this.controls.dispose();
    this.clear();
    for (const { material } of this.materials.values()) material.dispose();
    for (const light of this.glowPool) light.dispose();
    this.outlineMaterial.dispose();
    this.boxEdges.dispose();
    this.unitBox.dispose();
    this.unitCylinder.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }
}
