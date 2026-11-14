/**
 * PLAN3D-REALISM-2432: the room glow of the realistic level - the three.js realisation of room-glow.ts's plan.
 *
 * Per room at most five meshes, all unlit MeshBasicMaterial (no light, no shader variant, no shadow caster):
 *   lit-floor  additive warm pools (one radial gradient per pool, UVs per pool over the room's floor triangles)
 *   lit-wall   additive warm wash up the walls (a vertical gradient x the per-vertex strength of the nearest pool)
 *   pres-fill  a faint cool fill of the floor (normal blending)
 *   pres-edge  the cool inner-edge band on the floor (normal blending)
 *   pres-wall  a low cool wash up the walls (additive, the lit-wall geometry shared)
 * Opacities = the style's look x the night factor x the room's lit / presence weight, eased over FADE_MS when a weight
 * changes (a lamp switched, presence faded in or out) and set at once without motion or on the first build. The walls'
 * layers are clipped by the section plane like the walls. Gradients are generated (canvas), deterministic.
 *
 * PLAN3D-R32-ANSWERS-2438 (owner round 32, Q-MAP-16..18): the state marks (room-glow.ts markLayers) - per room up to three more unlit
 * meshes in the state's colour: mark-bar (a flat ribbon on the wall tops, at the section cut; never clipped, it sits on the cut),
 * mark-line (a crisp line along the walls on the floor) and, for an alarm, alarm-band (the soft red band) or, with the floor tint
 * setting, alarm-fill. An alarm pulses slowly (tick keeps drawing while one pulses) unless motion is off, the setting says steady or
 * the device asks for reduced motion.
 */
import { AddEquation, AdditiveBlending, BufferAttribute, CustomBlending, DstColorFactor, OneFactor, ZeroFactor, BufferGeometry, CanvasTexture, ClampToEdgeWrapping, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, NormalBlending, ShapeUtils, Vector2, type Plane } from './three-bundle';
import { DEFAULT_MARKS, alarmPulse, barHeight, glowLook, markLayers, markState, washSegments, type GlowLook, type GlowRoom, type MarkPrefs, type MarkState } from './room-glow';
import { kelvinRgb } from './sun';
import { LOOK_STYLES, type StyleId } from './look-style';

export const FADE_MS = 450;
const FLOOR_LIFT_M = 0.014;

let poolTex: CanvasTexture | null = null;
let washTex: CanvasTexture | null = null;
let edgeTex: CanvasTexture | null = null;
function canvas(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) paint(ctx);
  const t = new CanvasTexture(c);
  t.wrapS = ClampToEdgeWrapping;
  t.wrapT = ClampToEdgeWrapping;
  return t;
}
/** A soft round pool: white, alpha a smooth bell reaching 0 at the rim. */
function poolTexture(): CanvasTexture {
  poolTex ??= canvas(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      g.addColorStop(t, `rgba(255,255,255,${Math.exp(-3.2 * t * t) * (1 - t * t)})`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  return poolTex;
}
/** The wash up a wall: v = 0 at the floor, 1 at the wash height; brightest a quarter up, gone at the top. */
function washTexture(): CanvasTexture {
  if (!washTex) {
    washTex = canvas(4, 64, (ctx) => {
      const g = ctx.createLinearGradient(0, 64, 0, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.75)');
      g.addColorStop(0.22, 'rgba(255,255,255,1)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.4)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 64);
    });
  }
  return washTex;
}
/** The presence band: opaque at the wall (v = 0), gone at the inner edge (v = 1). */
function edgeTexture(): CanvasTexture {
  if (!edgeTex) {
    edgeTex = canvas(4, 64, (ctx) => {
      const g = ctx.createLinearGradient(0, 64, 0, 0);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 64);
    });
  }
  return edgeTex;
}

function triangles(poly: [number, number][]): [number, number][][] {
  const tris = ShapeUtils.triangulateShape(poly.map(([x, z]) => new Vector2(x, z)), []);
  return tris.map(([i, j, k]) => [poly[i], poly[j], poly[k]]);
}

/** The floor pools: the room's triangles once per pool, UVs mapping the pool's square onto the radial gradient. */
function floorGeometry(room: GlowRoom, withPools: boolean): BufferGeometry {
  const tris = triangles(room.polygon);
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const y = room.y + FLOOR_LIFT_M;
  const pools = withPools ? room.pools : [{ x: 0, z: 0, r: 1e9, w: 1 }];
  for (const p of pools) {
    for (const t of tris) {
      // seen from above, counter-clockwise in (x, z) faces -y in three's right-handed frame: emit a, c, b (face up)
      for (const q of [t[0], t[2], t[1]]) {
        pos.push(q[0], y, q[1]);
        uv.push(withPools ? (q[0] - p.x) / (2 * p.r) + 0.5 : 0.5, withPools ? (q[1] - p.z) / (2 * p.r) + 0.5 : 0.5);
        col.push(Math.min(1, p.w), Math.min(1, p.w), Math.min(1, p.w));
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeBoundingSphere();
  return g;
}

/** The wall wash: one vertical quad per segment along the inset outline, v up, the strength per vertex. */
function wallGeometry(room: GlowRoom): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const y0 = room.y + 0.01;
  const y1 = room.y + room.wash;
  for (const s of washSegments(room)) {
    const A = [s.a[0], y0, s.a[1]], B = [s.b[0], y0, s.b[1]], C = [s.b[0], y1, s.b[1]], D = [s.a[0], y1, s.a[1]];
    pos.push(...A, ...B, ...C, ...A, ...C, ...D);
    uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    for (const k of [s.sa, s.sb, s.sb, s.sa, s.sb, s.sa]) col.push(k, k, k);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeBoundingSphere();
  return g;
}

/** The presence band between the outline and the band's inner outline (same vertex count: inset by the miter). */
function bandGeometry(room: GlowRoom): BufferGeometry | null {
  const a = room.polygon;
  const b = room.band;
  if (b.length !== a.length) return null;
  const pos: number[] = [];
  const uv: number[] = [];
  const y = room.y + FLOOR_LIFT_M + 0.002;
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    const len = Math.hypot(a[j][0] - a[i][0], a[j][1] - a[i][1]);
    // counter-clockwise outline: the band quad a_i, a_j, b_j, b_i faces up when emitted a_i, b_j, a_j / a_i, b_i, b_j
    pos.push(a[i][0], y, a[i][1], b[j][0], y, b[j][1], a[j][0], y, a[j][1], a[i][0], y, a[i][1], b[i][0], y, b[i][1], b[j][0], y, b[j][1]);
    uv.push(0, 0, len, 1, len, 0, 0, 0, 0, 1, len, 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.computeBoundingSphere();
  return g;
}

/** PLAN3D-R32-ANSWERS-2438: a flat ribbon between an outline and its inner outline (same vertex count), at y = `y`, facing up. */
function ribbonGeometry(outer: [number, number][], inner: [number, number][], y: number): BufferGeometry | null {
  if (outer.length < 3 || inner.length !== outer.length) return null;
  const pos: number[] = [];
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    const a = outer, b = inner;
    pos.push(a[i][0], y, a[i][1], b[j][0], y, b[j][1], a[j][0], y, a[j][1], a[i][0], y, a[i][1], b[i][0], y, b[i][1], b[j][0], y, b[j][1]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeBoundingSphere();
  return g;
}

/** The marks' colours: alarm = the style's open-door red, presence = the style's blue, a light on = amber. */
const AMBER: Record<StyleId, number> = { light: 0xf0a030, dark: 0xffb547 };
function markColour(state: MarkState, style: StyleId): number {
  const st = LOOK_STYLES[style].states;
  return state === 'alarm' ? st.open_door : state === 'presence' ? st.presence : AMBER[style];
}
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Entry {
  room: GlowRoom;
  cur: { lit: number; presence: number };
  from: { lit: number; presence: number };
  to: { lit: number; presence: number };
  t0: number;
  /** PLAN3D-R32-ANSWERS-2438: the state the marks show (decided by the target, else where it fades from) and their layers. */
  mark: MarkState | null;
  layers: { bar: boolean; line: boolean; floor: boolean };
  meshes: { litFloor?: Mesh; litWall?: Mesh; presFill?: Mesh; presEdge?: Mesh; presWall?: Mesh; markBar?: Mesh; markLine?: Mesh; alarmBand?: Mesh; alarmFill?: Mesh };
}

const mat = (opts: ConstructorParameters<typeof MeshBasicMaterial>[0]) => new MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: DoubleSide, ...opts });

export class RoomGlow {
  readonly root = new Group();
  private readonly entries = new Map<string, Entry>();
  private look: GlowLook;
  private style: StyleId;
  private clip: Plane[] | null = null;
  private readonly marks: MarkPrefs;
  private night: number;
  private pulse = 1;

  constructor(rooms: GlowRoom[], style: StyleId, night: number, prev: Map<string, { room: GlowRoom; lit: number; presence: number }> | null = null, now = 0, marks: MarkPrefs = DEFAULT_MARKS) {
    this.root.name = 'room-glow';
    this.style = style;
    this.night = night;
    this.marks = marks;
    this.look = glowLook(style, night);
    const seen = new Set<string>();
    for (const room of rooms) {
      seen.add(room.zone);
      const was = prev?.get(room.zone);
      // with a previous graph a room new to it was dark and empty there: it fades in from 0
      const from = was ? { lit: was.lit, presence: was.presence } : prev ? { lit: 0, presence: 0 } : { lit: room.lit, presence: room.presence };
      this.add(room, from, { lit: room.lit, presence: room.presence }, now);
    }
    // a room that went dark / empty since the previous graph fades out from where it was
    if (prev) for (const [zone, was] of [...prev].sort((a, b) => (a[0] < b[0] ? -1 : 1))) if (!seen.has(zone) && (was.lit > 0.001 || was.presence > 0.001)) this.add({ ...was.room, alarm: 0 }, { lit: was.lit, presence: was.presence }, { lit: 0, presence: 0 }, now);
    this.apply();
  }

  private add(room: GlowRoom, from: Entry['from'], to: Entry['to'], now: number): void {
    const mark = markState({ alarm: room.alarm, presence: to.presence, lit: to.lit }) ?? markState({ presence: from.presence, lit: from.lit });
    const layers = markLayers(mark, this.marks);
    const e: Entry = { room, cur: { ...from }, from: { ...from }, to: { ...to }, t0: now, mark, layers, meshes: {} };
    const warm = new Color(...kelvinRgb(room.color_k));
    const cool = new Color(LOOK_STYLES[this.style].states.presence);
    const needLit = from.lit > 0 || to.lit > 0;
    // the presence layers are the floor tint: the bar-only setting draws no colour on the floor (Q-MAP-16 c)
    const needPres = (from.presence > 0 || to.presence > 0) && this.marks.marks !== 'bar';
    const put = (m: Mesh, name: string, order: number) => {
      m.name = `glow:${room.zone}#${name}`;
      m.renderOrder = order;
      m.userData = { ownMaterial: true, skipAO: true, glow: name, zone: room.zone, level: room.level_id };
      m.frustumCulled = true;
      this.root.add(m);
      return m;
    };
    let wall: BufferGeometry | null = null;
    if (needLit || needPres) wall = wallGeometry(room);
    if (needLit) {
      // the floor pool MULTIPLIES what is drawn (dst x (1 + light)): an additive pool lifted the floor toward a milky pink
      // and washed out the wood; light that scales the albedo keeps the material's colour and grain
      e.meshes.litFloor = put(new Mesh(floorGeometry(room, true), mat({ map: poolTexture(), color: warm, vertexColors: true, blending: CustomBlending, blendEquation: AddEquation, blendSrc: DstColorFactor, blendDst: OneFactor, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor, premultipliedAlpha: true })), 'lit-floor', 3);
      e.meshes.litWall = put(new Mesh(wall!, mat({ map: washTexture(), color: warm, vertexColors: true, blending: AdditiveBlending })), 'lit-wall', 3);
    }
    if (needPres) {
      e.meshes.presFill = put(new Mesh(floorGeometry(room, false), mat({ color: cool, blending: NormalBlending })), 'pres-fill', 2);
      const band = bandGeometry(room);
      if (band) e.meshes.presEdge = put(new Mesh(band, mat({ map: edgeTexture(), color: cool, blending: NormalBlending })), 'pres-edge', 2);
      const pw = put(new Mesh(wall!, mat({ map: washTexture(), color: cool, blending: AdditiveBlending })), 'pres-wall', 3);
      e.meshes.presWall = pw;
      if (needLit) pw.userData.sharedGeometry = true; // the lit wash owns the geometry when both exist
    }
    // PLAN3D-R32-ANSWERS-2438: the state marks, in the state's colour; drawn over the glow, exempt from tone mapping (a signal colour)
    if (mark) {
      const colour = markColour(mark, this.style);
      const sig = (o: ConstructorParameters<typeof MeshBasicMaterial>[0]) => mat({ color: colour, toneMapped: false, blending: NormalBlending, ...o });
      if (layers.bar) {
        const g = ribbonGeometry(room.outline, room.barInner, 0);
        if (g) {
          const m = put(new Mesh(g, sig({})), 'mark-bar', 5);
          m.position.y = barHeight(room, null, null) + 0.006;
          e.meshes.markBar = m;
        }
      }
      if (layers.line) {
        const g = ribbonGeometry(room.polygon, room.lineInner, room.y + FLOOR_LIFT_M + 0.004);
        if (g) e.meshes.markLine = put(new Mesh(g, sig({})), 'mark-line', 4);
      }
      if (mark === 'alarm' && layers.floor) {
        if (this.marks.marks === 'floor') e.meshes.alarmFill = put(new Mesh(floorGeometry(room, false), sig({})), 'alarm-fill', 2);
        const band = bandGeometry(room);
        if (band) e.meshes.alarmBand = put(new Mesh(band, sig({ map: edgeTexture() })), 'alarm-band', 3);
      }
    }
    this.entries.set(room.zone, e);
  }

  /** PLAN3D-R32-ANSWERS-2438: where the section cut stands (null: nothing cut) - the wall-top bars of its level sit on it. */
  setCut(y: number | null, level: string | null): void {
    for (const e of this.entries.values()) if (e.meshes.markBar) e.meshes.markBar.position.y = barHeight(e.room, y, level) + 0.006;
  }

  /** True while an alarm room pulses (the view keeps drawing frames for it). */
  private pulsing(motion: boolean): boolean {
    if (!motion || this.marks.alarm !== 'pulse' || reducedMotion()) return false;
    for (const e of this.entries.values()) if (e.mark === 'alarm') return true;
    return false;
  }

  /** The opacities from the look and every room's current weights. */
  private apply(): void {
    const L = this.look;
    for (const e of this.entries.values()) {
      const set = (m: Mesh | undefined, v: number) => {
        if (!m) return;
        const mm = m.material as MeshBasicMaterial;
        mm.opacity = v;
        m.visible = v > 0.002;
      };
      set(e.meshes.litFloor, L.floor * e.cur.lit);
      set(e.meshes.litWall, L.wall * e.cur.lit);
      // a lit room shows presence by the edge and the wash only (the warm floor stays clean)
      set(e.meshes.presFill, L.presFloor * e.cur.presence * (1 - e.cur.lit));
      set(e.meshes.presEdge, L.presEdge * e.cur.presence);
      set(e.meshes.presWall, L.presWall * e.cur.presence);
      // PLAN3D-R32-ANSWERS-2438: the marks - the alarm at full strength (times the pulse), presence by its fade, a light on by its
      // fade and weaker at night (the lit room itself shows it then); the mockup's strengths
      const w = e.mark === 'alarm' ? this.pulse : e.mark === 'presence' ? e.cur.presence : e.mark === 'light' ? e.cur.lit * (1 - 0.5 * Math.max(0, Math.min(1, this.night))) : 0;
      set(e.meshes.markBar, (e.mark === 'light' ? 0.85 : 0.95) * w);
      set(e.meshes.markLine, (e.mark === 'light' ? 0.6 : 0.85) * w);
      set(e.meshes.alarmBand, 0.5 * w);
      set(e.meshes.alarmFill, 0.22 * w);
    }
  }

  /** The style or the time moved (applyTime): the look's strengths and the presence colour. */
  setLook(style: StyleId, night: number): void {
    this.look = glowLook(style, night);
    this.night = night;
    if (style !== this.style) {
      this.style = style;
      const cool = LOOK_STYLES[style].states.presence;
      for (const e of this.entries.values()) {
        for (const m of [e.meshes.presFill, e.meshes.presEdge, e.meshes.presWall]) (m?.material as MeshBasicMaterial | undefined)?.color.setHex(cool);
        if (e.mark) for (const m of [e.meshes.markBar, e.meshes.markLine, e.meshes.alarmBand, e.meshes.alarmFill]) (m?.material as MeshBasicMaterial | undefined)?.color.setHex(markColour(e.mark, style));
      }
    }
    this.apply();
  }

  /** The section planes on the wall layers (the floor layers lie under every cut). */
  setClip(planes: Plane[] | null): void {
    this.clip = planes;
    for (const e of this.entries.values()) for (const m of [e.meshes.litWall, e.meshes.presWall]) if (m) (m.material as MeshBasicMaterial).clippingPlanes = planes;
  }

  get clipPlanes(): Plane[] | null {
    return this.clip;
  }

  /** A presence fade step (the description changed only in its tints' opacity): the new weights, at once - the steps
   * themselves are the fade. */
  updateWeights(rooms: GlowRoom[]): void {
    for (const r of rooms) {
      const e = this.entries.get(r.zone);
      if (!e) continue;
      e.to = { lit: r.lit, presence: r.presence };
      e.cur = { ...e.to };
      e.from = { ...e.to };
    }
    this.apply();
  }

  /** One step of the fades (ease-in-out); true while any runs. `motion` false ends them at once. */
  tick(now: number, motion = true): boolean {
    const pulsing = this.pulsing(motion);
    this.pulse = alarmPulse(now, pulsing);
    let running = pulsing;
    for (const e of this.entries.values()) {
      if (e.cur.lit === e.to.lit && e.cur.presence === e.to.presence) continue;
      const t = motion ? Math.min(1, Math.max(0, (now - e.t0) / FADE_MS)) : 1;
      const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      e.cur = { lit: e.from.lit + (e.to.lit - e.from.lit) * k, presence: e.from.presence + (e.to.presence - e.from.presence) * k };
      if (t < 1) running = true;
      else e.cur = { ...e.to };
    }
    this.apply();
    return running;
  }

  /** The current weights per room (carried into the next graph so a change fades from where it is). */
  state(): Map<string, { room: GlowRoom; lit: number; presence: number }> {
    return new Map([...this.entries].map(([z, e]) => [z, { room: e.room, lit: e.cur.lit, presence: e.cur.presence }]));
  }

  /** Counters (tests, perf report). */
  stats(): { rooms: number; meshes: number; visible: number } {
    let meshes = 0, visible = 0;
    this.root.traverse((o) => {
      if ((o as Mesh).isMesh) {
        meshes++;
        if (o.visible) visible++;
      }
    });
    return { rooms: this.entries.size, meshes, visible };
  }

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      if (!m.userData.sharedGeometry) m.geometry.dispose();
      (m.material as MeshBasicMaterial).dispose();
    });
    this.root.clear();
    this.entries.clear();
  }
}
