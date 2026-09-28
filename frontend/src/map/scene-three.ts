/**
 * The three.js realisation of a scene description (T087, design 10.2-10.4). Two quality levels (CR-006 slice 1a):
 * level 1 - flat Lambert materials, an ambient and a directional light, no shadows (exactly the phase-4 view, the
 * fallback); level 2 - a hemisphere sky and a shadow-casting sun (PCFSoftShadowMap, its camera fitted to the extent),
 * MeshStandardMaterial per token with a rough floor and a glossy translucent glass, a baked contact occlusion under
 * every wall and object (one instanced gradient plane - vertex AO cannot ride on shared unit geometry and a screen-space
 * pass would need the post-processing chain and a depth target on every frame), ACES tone mapping, and the cutaway:
 * walls on the camera's side facing it drop to CUTAWAY_HEIGHT_M, decided per quantised azimuth (scene-frame.cutawayIds -
 * deterministic for a camera state) and never from a camera preset. One InstancedMesh per instance group (a unit box or
 * a unit cylinder scaled per instance), a Mesh per prism, a Sprite per label, a fixed pool of MAX_GLOW_LIGHTS point
 * lights for the glows; OrbitControls with touch; the presets top / iso (a true isometric on an orthographic camera:
 * the building page's 30 deg axes) / persp (the 31 deg perspective of phase 4) / from a camera; picking by ray
 * (through translucent plates); a line outline on the selected item; GLTFExporter (without the outline); small
 * isometric thumbnails of one level from the same parts (the strip of the element). Frames render on demand - a
 * change, or damping still moving - unless continuous mode is on. Above 3,000 parts the small objects hide when the
 * camera is far. Colours come from the element's computed design tokens - the description carries names only. This is
 * the only module that imports the three bundle (the lazy chunk).
 */
import { ACESFilmicToneMapping, AmbientLight, BoxGeometry, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight, DoubleSide, Euler, Float32BufferAttribute, GLTFExporter, Group, HemisphereLight, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, NoToneMapping, Object3D, OrbitControls, OrthographicCamera, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PointLight, Quaternion, Raycaster, SRGBColorSpace, Scene, ShapeUtils, Sprite, SpriteMaterial, Vector2, Vector3, WebGLRenderer } from './three-bundle';
import type { SceneDescription, ScenePart, Vec3 } from './scene-builder';
import { CUTAWAY_HEIGHT_M, ISO_DIR, PERSP_DIR, azimuthDeg, clampThumb, cutBox, cutawayIds, isoFrame, levelExtent, quantiseAzimuth, sceneExtent, type Extent, type IsoFrame } from './scene-frame';

export type ScenePreset = 'top' | 'iso' | 'persp' | { camera: string };
export type QualityLevel = 1 | 2;
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
  quality?: QualityLevel;
}

export const SMALL_PART_M = 0.6;
export const HIDE_SMALL_ABOVE_PARTS = 3000;
export const HIDE_SMALL_DISTANCE_M = 45;
/** Every point light is a term in every lit shader: past a handful the frame rate (and the uniform budget) suffers. */
export const MAX_GLOW_LIGHTS = 8;
/** The shadow map of the level-2 sun (one map for the whole extent: a 20 m hall gets ~1 cm texels). */
export const SHADOW_MAP_PX = 2048;
/** The contact occlusion under a part reaches this far past its footprint. */
export const AO_SPREAD_M = 0.28;
/** One outline box per part of the selected item, up to this many (a long wall is a few boxes, a tribune a few rows). */
const MAX_OUTLINE_PARTS = 64;
const CLICK_SLOP_PX = 6;
const UPPER_PLATE_OPACITY = 0.35;
const LABEL_BG_ALPHA = 0.88;
const GLOW_INTENSITY = 8;
/** The orbit limit of the overview presets: never under the floor (a camera preset lifts it, a camera may look up). */
const ORBIT_MAX_POLAR = Math.PI / 2 - 0.02;
/** Glows are lights; cones and the state tints are translucent illustrations - a click passes through them to what
 * lies behind (a tint's room, an opening under its marker is the marker's own item). */
const NOT_PICKABLE = new Set(['glow', 'cone', 'tint']);
/** What throws a shadow at level 2 (glass and translucent illustrations do not: the shadow pass ignores opacity). */
const CASTERS = new Set(['wall', 'lintel', 'sill', 'head', 'door', 'object', 'connector', 'camera']);
const RECEIVERS = new Set(['floor', 'wall', 'object', 'connector', 'room', 'tint', 'lintel', 'sill', 'head']);
/** On a heavy floor (above HIDE_SMALL_ABOVE_PARTS parts) only the structure takes part in the shadows: the objects'
 * instance groups neither cast (a second draw of every instance) nor receive (the PCF taps on every fragment of
 * 3,000 chairs covering the view) - the floor under them still shows the structure's shadows. */
const HEAVY_CASTERS = new Set(['wall', 'lintel', 'sill', 'head', 'door', 'connector']);
/** What gets a contact occlusion at level 2: the structure and the objects standing on their floor. */
const AO_KINDS = new Set(['wall', 'object', 'connector']);
const AO_MAX_BASE_M = 0.5;
/** The sun of level 2 from the -x (a little -z) side: the shadows on the floor run toward +x, which the isometric
 * camera (at +x +z) sees as toward the viewer and to the right; the faces it sees are lit by the sky. */
const SUN_DIR: Vec3 = (() => {
  const n = Math.hypot(-0.6, 1.1, -0.25);
  return [-0.6 / n, 1.1 / n, -0.25 / n];
})();
/** Level 2 draws the structure (walls, lintels, sills, heads) in this token instead of map-structure: the 2D's dark
 * ink is a line colour, a lit wall needs a light albedo; the dark ink returns on the section caps of the cut walls. */
const WALL_TOKEN_3D = 'map-wall-3d';
const STRUCTURE_TOKEN = 'map-structure';
const CAP_HEIGHT_M = 0.025;
/** Level 2's light: a bright hemisphere (a white sky over a cool ground) and a warm sun, exposed for ACES so a
 * mid-grey wall reads mid-grey - the tokens' colours are the albedo, the picture must not sink into shadow. */
const HEMI_SKY = 0xffffff;
const HEMI_GROUND = 0xe6ebf2;
const HEMI_INTENSITY = 2.1;
const SUN_COLOR = 0xfff3dc;
const SUN_INTENSITY = 3.0;
const EXPOSURE = 1.12;
const THUMB_W = 160;
const THUMB_H = 100;

const rad = (d: number): number => (d * Math.PI) / 180;
const isSmall = (p: ScenePart): boolean => p.kind === 'object' && Math.max(p.size[0], p.size[1], p.size[2]) < SMALL_PART_M;
type Role = 'std' | 'floor' | 'glass';
const roleOf = (p: ScenePart): Role => (p.kind === 'floor' ? 'floor' : p.color === 'map-glass' ? 'glass' : 'std');
type Placed = { obj: InstancedMesh | Mesh; index: number; part: ScenePart };

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

/** The contact-occlusion texture: black, opaque-ish in the middle, fading to the edge along a rounded-box falloff (an
 * instance stretched over a long wall keeps a soft band at its ends and a tight one along its faces). */
function occlusionTexture(): CanvasTexture {
  const n = 64;
  const canvas = document.createElement('canvas');
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = Math.abs((x + 0.5) / n - 0.5) * 2;
      const v = Math.abs((y + 0.5) / n - 0.5) * 2;
      const d = Math.max(u, v);
      const t = Math.min(1, Math.max(0, (d - 0.5) / 0.5));
      const a = (1 - t * t * (3 - 2 * t)) * 0.42;
      const i = (y * n + x) * 4;
      img.data[i + 3] = Math.round(a * 255);
    }
    ctx.putImageData(img, 0, 0);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
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

/** What one realisation of a part list holds (the main root tracks picking and the cutaway; a thumbnail does not). */
interface Realised {
  root: Group;
  lookup: Map<Object3D, ScenePart[]>;
  small: Object3D[];
  placed: Map<string, Placed>;
  glows: ScenePart[];
  ao: InstancedMesh | null;
}

export class SceneView {
  readonly scene = new Scene();
  readonly persp = new PerspectiveCamera(50, 1, 0.05, 2000);
  readonly ortho = new OrthographicCamera(-1, 1, 1, -1, 0.05, 4000);
  readonly renderer: WebGLRenderer;
  readonly controls: OrbitControls;
  private active: PerspectiveCamera | OrthographicCamera = this.persp;
  private readonly root = new Group();
  private readonly unitBox = new BoxGeometry(1, 1, 1);
  private readonly unitCylinder = new CylinderGeometry(0.5, 0.5, 1, 24);
  private readonly unitPlane = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly boxEdges = unitBoxEdges();
  private readonly materials = new Map<string, { token: string; material: MeshLambertMaterial | MeshStandardMaterial }>();
  private readonly outlineMaterial: LineBasicMaterial;
  private aoMaterial: MeshBasicMaterial | null = null;
  private readonly raycaster = new Raycaster();
  /** A fixed pool of point lights for the glows: a lamp switching on moves a light and sets its intensity, it never
   * changes the number of lights (which would recompile every lit shader). */
  private readonly glowPool: PointLight[] = [];
  private readonly lights = new Group();
  private sun: DirectionalLight | null = null;
  /** Every pickable object → the parts it carries (index = instanceId for an InstancedMesh, [0] otherwise). */
  private lookup = new Map<Object3D, ScenePart[]>();
  private placed = new Map<string, Placed>();
  private smallGroups: Object3D[] = [];
  private outline: Group | null = null;
  private desc: SceneDescription | null = null;
  private extent: Extent | null = null;
  private selectedId: string | null = null;
  private preset: ScenePreset = 'iso';
  private orthoFrame: IsoFrame | null = null;
  /** The azimuth the cutaway was last applied for (null = nothing cut). */
  private cutAzimuth: number | null = null;
  private cutNow = new Set<string>();
  /** The dark section caps on the cut walls (level 2): one instanced box, rebuilt with the cut set. */
  private caps: InstancedMesh | null = null;
  private quality: QualityLevel;
  private framed = false;
  private hideSmall = false;
  /** The description is heavy (above HIDE_SMALL_ABOVE_PARTS parts): the objects cast no shadows. */
  private heavy = false;
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
    this.quality = opts.quality ?? 1;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.outlineMaterial = new LineBasicMaterial({ color: new Color(opts.color('accent')), depthTest: false, transparent: true });
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    opts.mount.appendChild(canvas);
    this.controls = new OrbitControls(this.persp, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = ORBIT_MAX_POLAR;
    this.controls.addEventListener('change', this.invalidate);
    this.scene.add(this.lights);
    this.applyQuality();
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
    canvas.addEventListener('pointercancel', this.onCancel);
    canvas.addEventListener('webglcontextrestored', this.invalidate); // three restores its state; one frame redraws it
    this.resize();
  }

  /** The camera in use: the perspective one, or the orthographic one of the isometric preset. */
  get camera(): PerspectiveCamera | OrthographicCamera {
    return this.active;
  }

  getQuality(): QualityLevel {
    return this.quality;
  }

  // ---- quality: lights, renderer state, materials (a switch rebuilds the parts from the kept description)

  /** Switch the quality level: the lights and the renderer change, the cached materials are dropped and the same
   * description is realised again - the camera, the preset and the selection stay. */
  setQuality(q: QualityLevel): void {
    if (q === this.quality) return;
    this.quality = q;
    this.applyQuality();
    for (const { material } of this.materials.values()) material.dispose();
    this.materials.clear();
    if (this.desc) {
      const d = this.desc;
      const sel = this.selectedId;
      this.setDescription(d);
      this.setSelected(sel);
    }
    this.invalidate();
  }

  private applyQuality(): void {
    for (const child of [...this.lights.children]) {
      this.lights.remove(child);
      if (child instanceof DirectionalLight) child.dispose();
      else if (child instanceof AmbientLight || child instanceof HemisphereLight) child.dispose();
    }
    this.sun = null;
    this.cutAzimuth = null;
    this.cutNow.clear();
    if (this.quality === 2) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.toneMapping = ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = EXPOSURE;
      this.lights.add(new HemisphereLight(HEMI_SKY, HEMI_GROUND, HEMI_INTENSITY));
      const sun = new DirectionalLight(SUN_COLOR, SUN_INTENSITY);
      sun.castShadow = true;
      sun.shadow.mapSize.set(SHADOW_MAP_PX, SHADOW_MAP_PX);
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.03;
      this.lights.add(sun);
      this.lights.add(sun.target);
      this.sun = sun;
      this.fitSun();
    } else {
      this.renderer.shadowMap.enabled = false;
      this.renderer.toneMapping = NoToneMapping;
      this.renderer.toneMappingExposure = 1;
      this.lights.add(new AmbientLight(0xffffff, 1.6));
      const sun = new DirectionalLight(0xffffff, 1.4);
      sun.position.set(1, 2, 1.2);
      this.lights.add(sun);
    }
  }

  /** The sun and its shadow camera around the extent: an orthographic box that holds the whole floor from the sun's
   * side (a fixed direction: the shadows are part of the deterministic look, not of the camera). */
  private fitSun(): void {
    const sun = this.sun;
    const e = this.extent;
    if (!sun || !e) return;
    const cx = (e.x0 + e.x1) / 2;
    const cy = (e.y0 + e.y1) / 2;
    const cz = (e.z0 + e.z1) / 2;
    const r = Math.max(Math.hypot(e.x1 - e.x0, e.y1 - e.y0, e.z1 - e.z0) / 2, 2) * 1.05;
    sun.position.set(cx + SUN_DIR[0] * r * 2, cy + SUN_DIR[1] * r * 2, cz + SUN_DIR[2] * r * 2);
    sun.target.position.set(cx, cy, cz);
    sun.target.updateMatrixWorld();
    const cam = sun.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 0.1;
    cam.far = r * 4;
    cam.updateProjectionMatrix();
    sun.shadow.needsUpdate = true;
  }

  // ---- building

  private material(token: string, opacity: number, doubleSided = false, role: Role = 'std'): MeshLambertMaterial | MeshStandardMaterial {
    const key = `${token}|${opacity}|${doubleSided ? 2 : 1}|${this.quality === 2 ? role : 'l1'}`;
    let entry = this.materials.get(key);
    if (!entry) {
      // a double-sided translucent surface draws in one pass (three would draw it twice, back then front)
      const sides = doubleSided ? { side: DoubleSide, forceSinglePass: true } : {};
      const tok = this.quality === 2 && token === STRUCTURE_TOKEN && role === 'std' ? WALL_TOKEN_3D : token;
      const color = new Color(this.opts.color(tok));
      let material: MeshLambertMaterial | MeshStandardMaterial;
      if (this.quality === 2 && role === 'glass') {
        material = new MeshStandardMaterial({ color, roughness: 0.12, metalness: 0.25, transparent: true, opacity: Math.max(opacity, 0.35), depthWrite: false, side: DoubleSide, forceSinglePass: true });
      } else if (this.quality === 2) {
        material = new MeshStandardMaterial({ color, roughness: role === 'floor' ? 1 : 0.88, metalness: 0, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, ...sides });
      } else {
        material = new MeshLambertMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, ...sides });
      }
      entry = { token: tok, material };
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
  private plateOpacity(p: ScenePart, desc: SceneDescription | null = this.desc): number {
    const levels = desc?.levels ?? [];
    if (p.kind !== 'floor' || levels.length < 2) return p.opacity;
    const lowest = Math.min(...levels.map((l) => l.elevation_m));
    const mine = levels.find((l) => l.id === p.level_id);
    return mine && mine.elevation_m > lowest ? Math.min(p.opacity, UPPER_PLATE_OPACITY) : p.opacity;
  }

  private shadows(o: Mesh | InstancedMesh, p: ScenePart): void {
    if (this.quality !== 2) return;
    o.castShadow = (this.heavy ? HEAVY_CASTERS : CASTERS).has(p.kind) && p.color !== 'map-glass';
    o.receiveShadow = RECEIVERS.has(p.kind) && !(this.heavy && p.kind === 'object');
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

  private single(p: ScenePart, desc: SceneDescription): Object3D | null {
    if (p.shape === 'box' || p.shape === 'cylinder') {
      const mesh = new Mesh(p.shape === 'cylinder' ? this.unitCylinder : this.unitBox, this.material(p.color, this.plateOpacity(p, desc), false, roleOf(p)));
      this.transform(mesh, p);
      mesh.scale.set(Math.max(p.size[0], 1e-3), Math.max(p.size[1], 1e-3), Math.max(p.size[2], 1e-3));
      this.shadows(mesh, p);
      return mesh;
    }
    if (p.shape === 'prism') {
      const geometry = prismGeometry(p.polygon ?? [], p.size[1]);
      if (!geometry) return null;
      const mesh = new Mesh(geometry, this.material(p.color, p.opacity, true, roleOf(p)));
      mesh.position.set(p.position[0], p.position[1], p.position[2]);
      this.shadows(mesh, p);
      return mesh;
    }
    if (p.shape === 'sprite') return this.label(p);
    return null; // lights come from the pool (setDescription)
  }

  /** The contact occlusion of level 2: one instanced plane under every wall, object and connector box standing on its
   * level's floor, a little wider than the footprint. Skipped when nothing qualifies. */
  private occlusion(parts: ScenePart[], desc: SceneDescription): InstancedMesh | null {
    if (this.quality !== 2) return null;
    const elevation = new Map(desc.levels.map((l) => [l.id, l.elevation_m]));
    const lowest = desc.levels.length ? Math.min(...desc.levels.map((l) => l.elevation_m)) : 0;
    const under = parts.filter((p) => AO_KINDS.has(p.kind) && (p.shape === 'box' || p.shape === 'cylinder') && p.position[1] - p.size[1] / 2 <= (elevation.get(p.level_id ?? '') ?? lowest) + AO_MAX_BASE_M);
    if (!under.length) return null;
    if (!this.aoMaterial) this.aoMaterial = new MeshBasicMaterial({ map: occlusionTexture(), color: 0x000000, transparent: true, depthWrite: false });
    const mesh = new InstancedMesh(this.unitPlane, this.aoMaterial, under.length);
    const m = new Matrix4();
    const q = new Quaternion();
    const e = new Euler();
    const pos = new Vector3();
    const scl = new Vector3();
    under.forEach((p, i) => {
      q.setFromEuler(e.set(0, rad(p.rotation[1]), 0, 'YXZ'));
      pos.set(p.position[0], p.position[1] - p.size[1] / 2 + 0.012, p.position[2]);
      scl.set(p.size[0] + 2 * AO_SPREAD_M, 1, p.size[2] + 2 * AO_SPREAD_M);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.name = 'ao';
    mesh.renderOrder = 1;
    return mesh;
  }

  /** Realise a list of parts into a group: the instance groups, the singles, the sprites, the occlusion. The same parts
   * in the same order give the same objects in the same order (design rule 4). */
  private realise(parts: ScenePart[], desc: SceneDescription): Realised {
    const out: Realised = { root: new Group(), lookup: new Map(), small: [], placed: new Map(), glows: [], ao: null };
    const groups = new Map<string, ScenePart[]>();
    const singles: ScenePart[] = [];
    for (const p of parts) {
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
    for (const [key, group] of groups) {
      // the key is shape|colour|opacity; read them from the parts, never by splitting (a token could hold a bar)
      const first = group[0];
      const mesh = new InstancedMesh(first.shape === 'cylinder' ? this.unitCylinder : this.unitBox, this.material(first.color, first.opacity, false, roleOf(first)), group.length);
      group.forEach((p, i) => {
        q.setFromEuler(e.set(rad(p.rotation[0]), rad(p.rotation[1]), rad(p.rotation[2]), 'YXZ'));
        pos.set(p.position[0], p.position[1], p.position[2]);
        scl.set(Math.max(p.size[0], 1e-3), Math.max(p.size[1], 1e-3), Math.max(p.size[2], 1e-3));
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i, m);
        out.placed.set(p.id, { obj: mesh, index: i, part: p });
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.name = key;
      this.shadows(mesh, first);
      out.lookup.set(mesh, group);
      out.root.add(mesh);
      if (group.every(isSmall)) out.small.push(mesh);
    }
    for (const p of singles) {
      if (p.shape === 'light') {
        out.glows.push(p);
        continue;
      }
      const o = this.single(p, desc);
      if (!o) continue;
      o.name = p.id;
      if (!NOT_PICKABLE.has(p.kind)) out.lookup.set(o, [p]);
      if (o instanceof Mesh && (p.shape === 'box' || p.shape === 'cylinder')) out.placed.set(p.id, { obj: o, index: 0, part: p });
      out.root.add(o);
      if (isSmall(p)) out.small.push(o);
    }
    out.ao = this.occlusion(parts, desc);
    if (out.ao) out.root.add(out.ao);
    return out;
  }

  private disposeGroup(group: Group): void {
    for (const child of [...group.children]) {
      group.remove(child);
      if (child instanceof InstancedMesh) child.dispose();
      else if (child instanceof Mesh && child.geometry !== this.unitBox && child.geometry !== this.unitCylinder) child.geometry.dispose();
      if (child instanceof Sprite) {
        child.material.map?.dispose();
        child.material.dispose();
      }
    }
  }

  private clear(): void {
    this.setSelected(null);
    this.disposeGroup(this.root);
    for (const light of this.glowPool) light.intensity = 0;
    this.lookup.clear();
    this.placed.clear();
    this.smallGroups = [];
    this.cutAzimuth = null;
    this.cutNow.clear();
    this.caps = null; // disposed with the root's children
  }

  setDescription(desc: SceneDescription): void {
    this.clear();
    this.recolour();
    this.desc = desc;
    this.extent = sceneExtent(desc);
    this.heavy = desc.parts.length > HIDE_SMALL_ABOVE_PARTS;
    const built = this.realise(desc.parts, desc);
    for (const child of [...built.root.children]) this.root.add(child);
    this.lookup = built.lookup;
    this.placed = built.placed;
    this.smallGroups = built.small;
    let glows = 0;
    for (const p of built.glows) {
      const light = this.glowPool[glows++];
      if (!light) continue; // past the pool: the lamp keeps its glow colour, without a light of its own
      light.color.set(this.opts.color(p.color));
      light.intensity = GLOW_INTENSITY;
      light.distance = Math.max(p.size[0], 1);
      light.position.set(p.position[0], p.position[1], p.position[2]);
    }
    this.hideSmall = desc.parts.length > HIDE_SMALL_ABOVE_PARTS;
    if (!this.hideSmall) for (const g of this.smallGroups) g.visible = true;
    this.fitSun();
    if (!this.framed) this.framed = this.setPreset('iso');
    this.updateCutaway();
    this.invalidate();
  }

  // ---- selection and presets

  /** Outline every part that stands for the source item (a wall is one box per straight segment). */
  setSelected(sourceId: string | null): void {
    this.selectedId = sourceId;
    if (this.outline) {
      this.root.remove(this.outline);
      this.outline = null;
      this.invalidate();
    }
    if (!sourceId || !this.desc) return;
    const parts = this.desc.parts.filter((p) => p.userData.id === sourceId && p.kind !== 'cone' && p.kind !== 'floor' && p.kind !== 'tint' && (p.shape === 'box' || p.shape === 'cylinder' || p.shape === 'prism' || p.shape === 'sprite')).slice(0, MAX_OUTLINE_PARTS);
    if (!parts.length) return;
    const group = new Group();
    const elevation = new Map(this.desc.levels.map((l) => [l.id, l.elevation_m]));
    for (const part of parts) {
      const line = new LineSegments(this.boxEdges, this.outlineMaterial);
      // a cut part is outlined as drawn: the kept box, or nothing at all when the cut hides it
      const cut = this.cutNow.has(part.id) ? cutBox(part, elevation.get(part.level_id ?? '') ?? 0, CUTAWAY_HEIGHT_M) : { y: part.position[1], h: part.size[1] };
      if (!cut) continue;
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
        line.position.y = cut.y;
        line.scale.set(part.size[0] * 1.06 + 0.05, cut.h * 1.06 + 0.05, (part.shape === 'sprite' ? 0.1 : part.size[2]) * 1.06 + 0.05);
      }
      line.renderOrder = 10;
      group.add(line);
    }
    this.outline = group;
    this.root.add(group);
    this.invalidate();
  }

  /** Put a camera in charge of the controls (the orthographic one for the isometric preset). */
  private useCamera(cam: PerspectiveCamera | OrthographicCamera): void {
    if (cam === this.active) return;
    this.active = cam;
    this.controls.object = cam;
  }

  /** The orthographic frustum from the stored isometric frame, widened to the current aspect (a resize keeps the fit). */
  private applyOrthoFrame(): void {
    const f = this.orthoFrame;
    if (!f) return;
    const aspect = this.persp.aspect || 1;
    let halfW = f.halfW;
    let halfH = f.halfH;
    if (halfW / halfH < aspect) halfW = halfH * aspect;
    else halfH = halfW / aspect;
    this.ortho.left = -halfW;
    this.ortho.right = halfW;
    this.ortho.top = halfH;
    this.ortho.bottom = -halfH;
    this.ortho.updateProjectionMatrix();
  }

  /** Move the camera to a preset; false (and nothing moves) when there is no description or no such camera part. The
   * overview presets frame the published extent of the shown levels (the floor plates), not the whole plan. */
  setPreset(preset: ScenePreset): boolean {
    const d = this.desc;
    const e = this.extent;
    if (!d || !e) return false;
    const cx = (e.x0 + e.x1) / 2;
    const cz = (e.z0 + e.z1) / 2;
    const W = e.x1 - e.x0;
    const D = e.z1 - e.z0;
    // the distance at which a w x h rectangle facing the camera fills the view (the aspect of the mount counts)
    const fit = (w: number, h: number): number => Math.max(h, w / (this.persp.aspect || 1), 4) / (2 * Math.tan(rad(this.persp.fov / 2)));
    const top = Math.max(0, ...d.levels.map((l) => l.elevation_m + l.ceiling_height_m));
    if (preset === 'top') {
      this.useCamera(this.persp);
      this.controls.maxPolarAngle = ORBIT_MAX_POLAR;
      this.persp.position.set(cx, top + fit(W, D) * 1.2, cz + 0.001);
      this.controls.target.set(cx, 0, cz);
    } else if (preset === 'iso') {
      this.useCamera(this.ortho);
      this.controls.maxPolarAngle = ORBIT_MAX_POLAR;
      const f = isoFrame(e, this.persp.aspect || 1);
      this.orthoFrame = f;
      this.ortho.zoom = 1;
      this.applyOrthoFrame();
      this.ortho.position.set(f.target[0] + ISO_DIR[0] * f.dist, f.target[1] + ISO_DIR[1] * f.dist, f.target[2] + ISO_DIR[2] * f.dist);
      this.controls.target.set(f.target[0], f.target[1], f.target[2]);
    } else if (preset === 'persp') {
      this.useCamera(this.persp);
      this.controls.maxPolarAngle = ORBIT_MAX_POLAR;
      const diag = Math.hypot(W, D);
      const dist = fit(diag, diag * 0.62) * 1.45;
      this.persp.position.set(cx + PERSP_DIR[0] * dist, PERSP_DIR[1] * dist, cz + PERSP_DIR[2] * dist);
      this.controls.target.set(cx, 0, cz);
    } else {
      const body = d.parts.find((p) => p.id === preset.camera && p.kind === 'camera');
      if (!body) return false;
      this.useCamera(this.persp);
      // the body's own forward: -z turned by the part's Euler (YXZ) - the description carries [-tilt, -bearing, 0], so a
      // positive tilt looks down and bearing 0 looks north (ruling R-P4-T4-1); no separate sign rule here
      const f = new Vector3(0, 0, -1).applyEuler(new Euler(rad(body.rotation[0]), rad(body.rotation[1]), rad(body.rotation[2]), 'YXZ'));
      // a camera may look up (a negative tilt): the orbit limit that keeps the user above the floor must not clamp it
      this.controls.maxPolarAngle = Math.PI;
      this.persp.position.set(body.position[0], body.position[1], body.position[2]);
      this.controls.target.set(body.position[0] + f.x * 6, body.position[1] + f.y * 6, body.position[2] + f.z * 6);
    }
    this.preset = preset;
    this.controls.update();
    this.updateCutaway();
    this.invalidate();
    return true;
  }

  /** Host pixels of a scene point (null behind the camera). */
  projectPoint(p: Vec3): { x: number; y: number } | null {
    this.active.updateMatrixWorld();
    const v = new Vector3(p[0], p[1], p[2]).project(this.active);
    if (v.z > 1) return null;
    const w = this.opts.mount.clientWidth;
    const h = this.opts.mount.clientHeight;
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
  }

  // ---- the cutaway (level 2): walls between the camera and the interior keep CUTAWAY_HEIGHT_M

  /** The azimuth the cutaway should follow now: the quantised camera azimuth from an overview above the ceilings, or
   * null (nothing cut) at level 1, from a camera preset, or from a camera that dropped below the top of the scene. */
  private wantedCutAzimuth(): number | null {
    const e = this.extent;
    if (this.quality !== 2 || !e || typeof this.preset !== 'string') return null;
    const cam = this.active.position;
    if (cam.y <= e.y1) return null;
    const cx = (e.x0 + e.x1) / 2;
    const cz = (e.z0 + e.z1) / 2;
    const off = Math.hypot(cam.x - cx, cam.z - cz);
    if (off < 0.5) return null; // straight above: no side faces the camera
    return quantiseAzimuth(azimuthDeg(cam.x, cam.z, cx, cz));
  }

  /** Write a part's box: the kept box of a cut, its own box again, or - hidden (h = 0) - a point parked at `y` (one
   * metre under its level's floor), so it neither draws, nor shadows, nor takes a click. */
  private writeBox(pl: Placed, y: number, h: number): void {
    const p = pl.part;
    const q = new Quaternion().setFromEuler(new Euler(rad(p.rotation[0]), rad(p.rotation[1]), rad(p.rotation[2]), 'YXZ'));
    const hidden = h <= 0;
    const pos = new Vector3(p.position[0], y, p.position[2]);
    const scl = hidden ? new Vector3(1e-4, 1e-4, 1e-4) : new Vector3(Math.max(p.size[0], 1e-3), Math.max(h, 1e-3), Math.max(p.size[2], 1e-3));
    if (pl.obj instanceof InstancedMesh) {
      pl.obj.setMatrixAt(pl.index, new Matrix4().compose(pos, q, scl));
      pl.obj.instanceMatrix.needsUpdate = true;
    } else {
      pl.obj.position.copy(pos);
      pl.obj.scale.copy(scl);
    }
  }

  /** Apply the cutaway for the camera's azimuth when it changed since the last application: the parts that leave the
   * set get their original box back, the parts that enter it are clipped (or hidden, scaled to nothing). */
  private updateCutaway(): void {
    const az = this.wantedCutAzimuth();
    if (az === this.cutAzimuth) return;
    this.cutAzimuth = az;
    const d = this.desc;
    if (!d || !this.extent) return;
    const next = new Set(az === null ? [] : cutawayIds(d, az, this.extent));
    const elevation = new Map(d.levels.map((l) => [l.id, l.elevation_m]));
    for (const id of this.cutNow) {
      if (next.has(id)) continue;
      const pl = this.placed.get(id);
      if (pl) this.writeBox(pl, pl.part.position[1], pl.part.size[1]);
    }
    for (const id of next) {
      if (this.cutNow.has(id)) continue;
      const pl = this.placed.get(id);
      if (!pl) continue;
      const box = cutBox(pl.part, elevation.get(pl.part.level_id ?? '') ?? 0, CUTAWAY_HEIGHT_M);
      if (box) this.writeBox(pl, box.y, box.h);
      else this.writeBox(pl, (elevation.get(pl.part.level_id ?? '') ?? 0) - 1, 0);
    }
    this.cutNow = next;
    this.rebuildCaps(elevation);
    if (this.sun) this.sun.shadow.needsUpdate = true;
    if (this.selectedId) this.setSelected(this.selectedId); // the outline follows the cut
  }

  /** The section caps: a thin dark box (map-structure) on top of every cut wall - the architectural convention that a
   * cut face reads as ink. One instanced box; none when nothing is cut. */
  private rebuildCaps(elevation: Map<string, number>): void {
    if (this.caps) {
      this.root.remove(this.caps);
      this.caps.dispose();
      this.caps = null;
    }
    const walls = [...this.cutNow].sort().map((id) => this.placed.get(id)).filter((pl): pl is Placed => !!pl && pl.part.kind === 'wall');
    if (!walls.length || this.quality !== 2) return;
    const mesh = new InstancedMesh(this.unitBox, this.material(STRUCTURE_TOKEN, 1, false, 'floor'), walls.length);
    const m = new Matrix4();
    const q = new Quaternion();
    const e = new Euler();
    walls.forEach((pl, i) => {
      const p = pl.part;
      const top = (elevation.get(p.level_id ?? '') ?? 0) + CUTAWAY_HEIGHT_M;
      q.setFromEuler(e.set(rad(p.rotation[0]), rad(p.rotation[1]), rad(p.rotation[2]), 'YXZ'));
      m.compose(new Vector3(p.position[0], top + CAP_HEIGHT_M / 2 - 0.004, p.position[2]), q, new Vector3(p.size[0] + 0.004, CAP_HEIGHT_M, p.size[2] + 0.004));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.name = 'caps';
    mesh.castShadow = true;
    this.caps = mesh;
    this.root.add(mesh);
  }

  /** The ids the cutaway holds now (tests). */
  cutawayNow(): string[] {
    return [...this.cutNow].sort();
  }

  // ---- picking

  private pick(clientX: number, clientY: number): SceneHit | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.raycaster.setFromCamera(new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), this.active);
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

  /** The browser took the pointer (a scroll, a system gesture): no click follows. */
  private onCancel = (e: PointerEvent) => {
    if (this.pressed?.id === e.pointerId) this.pressed = null;
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
    this.persp.aspect = w / h;
    this.persp.updateProjectionMatrix();
    this.applyOrthoFrame();
    this.invalidate();
  }

  private frame = () => {
    this.raf = 0;
    if (this.disposed) return;
    const moving = this.controls.update(); // true while damping still moves the camera
    if (this.hideSmall) {
      const show = this.active === this.ortho ? this.ortho.top / (this.ortho.zoom || 1) < HIDE_SMALL_DISTANCE_M / 2 : this.persp.position.distanceTo(this.controls.target) < HIDE_SMALL_DISTANCE_M;
      for (const g of this.smallGroups) g.visible = show;
    }
    this.updateCutaway();
    this.renderer.render(this.scene, this.active);
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

  /** Draw the main frame now instead of at the next animation frame (after a thumbnail pass used the canvas corner:
   * the picture on screen is whole again before the browser paints). A pending frame is folded into this one. */
  redrawNow(): void {
    if (this.disposed) return;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.frame();
  }

  /** The view as drawn now, as a PNG data URL (a frame is rendered first, so the buffer is current). */
  capture(): string {
    this.controls.update();
    this.updateCutaway();
    this.renderer.render(this.scene, this.active);
    return this.renderer.domElement.toDataURL('image/png');
  }

  /**
   * A small isometric picture of one level of a description (the thumbnail strip): the level's parts realised again
   * from the same list into a scratch scene with plain lights, framed by levelExtent on the isometric camera, drawn
   * into a render target and read back. Deterministic for a description, a level and the quality; null without a
   * level or when the readback failed.
   */
  renderThumbnail(desc: SceneDescription, levelId: string, width = THUMB_W, height = THUMB_H): string | null {
    const parts = desc.parts.filter((p) => p.level_id === levelId && p.kind !== 'cone' && p.shape !== 'sprite' && p.shape !== 'light');
    if (!desc.levels.some((l) => l.id === levelId)) return null;
    const one: SceneDescription = { ...desc, levels: desc.levels.filter((l) => l.id === levelId), parts };
    const built = this.realise(parts, one);
    const scene = new Scene();
    scene.add(built.root);
    if (this.quality === 2) {
      scene.add(new HemisphereLight(HEMI_SKY, HEMI_GROUND, HEMI_INTENSITY));
      const sun = new DirectionalLight(SUN_COLOR, SUN_INTENSITY);
      sun.position.set(SUN_DIR[0] * 50, SUN_DIR[1] * 50, SUN_DIR[2] * 50);
      scene.add(sun);
    } else {
      scene.add(new AmbientLight(0xffffff, 1.6));
      const sun = new DirectionalLight(0xffffff, 1.4);
      sun.position.set(1, 2, 1.2);
      scene.add(sun);
    }
    // Drawn into the bottom-left corner of the main canvas (a scissored viewport) and copied out: three applies the
    // output colour space and the tone mapping only when it draws to the canvas - a render target reads back linear
    // and comes out far darker than the view. The element redraws the main frame right after its thumbnail pass
    // (redrawNow), before the browser paints, so the corner never shows. A narrow canvas hosts a smaller picture: the
    // frame is fitted to the clamped size, so the level is never squashed.
    const canvasEl = this.renderer.domElement;
    const ratio = this.renderer.getPixelRatio();
    const { w, h } = clampThumb(width, height, canvasEl.width / ratio, canvasEl.height / ratio);
    if (w < 8 || h < 8) {
      this.disposeGroup(built.root);
      return null; // the canvas is too small to host it
    }
    const f = isoFrame(levelExtent(desc, levelId), w / h);
    const cam = new OrthographicCamera(-f.halfW, f.halfW, f.halfH, -f.halfH, 0.05, 4000);
    cam.position.set(f.target[0] + ISO_DIR[0] * f.dist, f.target[1] + ISO_DIR[1] * f.dist, f.target[2] + ISO_DIR[2] * f.dist);
    cam.lookAt(f.target[0], f.target[1], f.target[2]);
    cam.updateProjectionMatrix();
    let url: string | null = null;
    const shadows = this.renderer.shadowMap.enabled;
    try {
      this.renderer.shadowMap.enabled = false; // the sun here has no shadow camera; the strip is a silhouette
      this.renderer.setScissorTest(true);
      this.renderer.setScissor(0, 0, w, h);
      this.renderer.setViewport(0, 0, w, h);
      this.renderer.render(scene, cam);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // the viewport's origin is the canvas's bottom-left; as an image the canvas is upright
        ctx.drawImage(canvasEl, 0, canvasEl.height - h * ratio, w * ratio, h * ratio, 0, 0, w, h);
        url = canvas.toDataURL('image/png');
      }
    } catch (err) {
      console.warn('sw-plan-3d: thumbnail failed', err);
    } finally {
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, canvasEl.width / ratio, canvasEl.height / ratio);
      this.renderer.shadowMap.enabled = shadows;
      this.disposeGroup(built.root);
      this.invalidate(); // the main view draws its next frame from a clean state
    }
    return url;
  }

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
    canvas.removeEventListener('pointercancel', this.onCancel);
    canvas.removeEventListener('webglcontextrestored', this.invalidate);
    this.controls.removeEventListener('change', this.invalidate);
    this.controls.dispose();
    this.clear();
    for (const { material } of this.materials.values()) material.dispose();
    for (const light of this.glowPool) light.dispose();
    if (this.aoMaterial) {
      this.aoMaterial.map?.dispose();
      this.aoMaterial.dispose();
    }
    this.outlineMaterial.dispose();
    this.boxEdges.dispose();
    this.unitBox.dispose();
    this.unitCylinder.dispose();
    this.unitPlane.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }
}
