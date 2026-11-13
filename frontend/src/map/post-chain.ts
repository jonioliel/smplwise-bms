/**
 * The post chain of the realistic level (LOOK_SPEC section 4), loaded lazily with its own vendor chunk (three-post.ts):
 *
 * | rung      | chain                                                                 |
 * |-----------|-----------------------------------------------------------------------|
 * | realistic | RenderPass (MSAA x2, HalfFloat) -> GTAO (r 0.6 m, 6 samples) -> SSR (floors) -> UnrealBloom -> Output |
 * | lite      | RenderPass (MSAA x2) -> UnrealBloom -> Output                         |
 * | WebGL1    | + SMAA after Output (where `samples` is unsupported)                  |
 *
 * Levels 1-2 never load it. The bloom numbers follow the style and the night factor (look-style.bloomFor); the GTAO
 * blend is the style's. Thumbnails never go through it (a composer resize re-allocates GTAO's targets).
 *
 * PLAN3D-REALISM2-2433: the output pass also carries the colour grade (color-grade.ts: lift / gamma / gain + saturation after
 * the tone mapping and the sRGB transfer - no extra pass), and once the baked AO volume shades the materials (ao-shading.ts)
 * the GTAO pass steps down (`setBakedAo`: 4 samples instead of 6, BAKED_AO_GTAO_SCALE of the style's blend) - the bake carries
 * the contact and the corners, GTAO keeps the small detail.
 */
import { HalfFloatType, Matrix4, ShaderMaterial, Vector2, Vector3, WebGLRenderTarget, type Camera, type Object3D, type Plane, type Scene, type Texture, type WebGLRenderer } from './three-bundle';
import { EffectComposer, FullScreenQuad, GTAOPass, OutputPass, Pass, RenderPass, SMAAPass, UnrealBloomPass } from './three-post';
import { REFLECT_ON, SSR_FRAG, SSR_LOOK, SSR_VERT } from './floor-reflect';
import { LOOK_STYLES, bloomFor, type StyleId } from './look-style';
import { GRADE_GLSL, gradeFor } from './color-grade';

/** The GTAO blend share and samples while the baked AO volume is on (PLAN3D-REALISM2-2433). */
export const BAKED_AO_GTAO_SCALE = 0.6;
export const BAKED_AO_GTAO_SAMPLES = 4;
const GTAO_SAMPLES = 6;

/** PLAN3D-REALISM2-2433 S4: append the colour grade to an output pass's shader (its uniforms live on the pass). */
export function gradeOutput(pass: OutputPass): void {
  const u = pass.uniforms as Record<string, { value: unknown }>;
  u.swLift = { value: new Vector3(0, 0, 0) };
  u.swGamma = { value: new Vector3(1, 1, 1) };
  u.swGain = { value: new Vector3(1, 1, 1) };
  u.swSat = { value: 1 };
  const m = pass.material;
  const fs = m.fragmentShader;
  const end = fs.lastIndexOf('}');
  const pars = 'varying vec2 vUv;\nuniform vec3 swLift;\nuniform vec3 swGamma;\nuniform vec3 swGain;\nuniform float swSat;';
  m.fragmentShader = `${fs.slice(0, end).replace('varying vec2 vUv;', pars)}${GRADE_GLSL}\n}`;
  m.needsUpdate = true;
}

export type PostRung = 'realistic' | 'lite';

/** ST7-odd: hides (or shows again) the meshes marked `userData.skipAO` - the backdrop: sky dome, horizon band, ground plate
 * and its contact shade - around the GTAO pass, so its normal / depth render sees them as background (depth 1, which the
 * AO shader leaves alone). The ground seen just over a cut wall's top lies metres behind it and took an occlusion halo
 * against the wall top once the walls were cut in that pass. The beauty pass before and the bloom after see the scene
 * whole; no buffer is swapped. */
class SkipAoPass extends Pass {
  /** PLAN3D-LEVEL3-2435: what the hiding pass hid, shown again by its pair - a decal hidden by the view (another level, the
   * walk) stays hidden (the pass used to show every marked mesh). */
  readonly hidden: Object3D[] = [];
  constructor(private readonly scene: Scene, private readonly pair: SkipAoPass | null) {
    super();
    this.needsSwap = false;
  }

  render(): void {
    if (this.pair) {
      for (const o of this.pair.hidden) o.visible = true;
      this.pair.hidden.length = 0;
      return;
    }
    this.scene.traverse((o) => {
      if (o.userData.skipAO && o.visible) {
        o.visible = false;
        this.hidden.push(o);
      }
    });
  }
}

/** PLAN3D-LEVEL3-2435: the screen-space floor reflection (floor-reflect.ts) - one full-screen pass over the frame after the AO,
 * reading the GTAO pass's depth and normal targets; every pixel that is not a reflective floor is copied as it is. */
class SsrPass extends Pass {
  private readonly material: ShaderMaterial;
  private readonly quad: FullScreenQuad;
  constructor(private readonly gtao: GTAOPass, public camera: Camera, style: StyleId) {
    super();
    const look = SSR_LOOK[style];
    this.material = new ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null }, tNormal: { value: null }, uProj: { value: new Matrix4() }, uInvProj: { value: new Matrix4() },
        uCamWorld: { value: new Matrix4() }, uStrength: { value: look.strength }, uMaxDist: { value: look.maxDist }, uThickness: { value: 0.35 }, uTexel: { value: new Vector2(1 / 1024, 1 / 1024) },
      },
      vertexShader: SSR_VERT,
      fragmentShader: SSR_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  setStyle(style: StyleId): void {
    const look = SSR_LOOK[style];
    this.material.uniforms.uStrength.value = look.strength;
    this.material.uniforms.uMaxDist.value = look.maxDist;
  }

  render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void {
    const u = this.material.uniforms;
    const g = this.gtao as unknown as { depthTexture: Texture; normalTexture: Texture };
    u.tDiffuse.value = readBuffer.texture;
    (u.uTexel.value as Vector2).set(1 / Math.max(1, readBuffer.width), 1 / Math.max(1, readBuffer.height));
    u.tDepth.value = g.depthTexture;
    u.tNormal.value = g.normalTexture;
    (u.uProj.value as Matrix4).copy(this.camera.projectionMatrix);
    (u.uInvProj.value as Matrix4).copy(this.camera.projectionMatrixInverse);
    (u.uCamWorld.value as Matrix4).copy(this.camera.matrixWorld);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose(): void {
    this.material.dispose();
    this.quad.dispose();
  }
}

export class PostChain {
  readonly composer: EffectComposer;
  private readonly render: RenderPass;
  private readonly gtao: GTAOPass | null;
  private readonly ssr: SsrPass | null;
  private readonly bloom: UnrealBloomPass;
  private readonly output: OutputPass;
  private style: StyleId;
  private bakedAo = false;
  readonly msaa: boolean;
  /** The pass names in order (constructor names do not survive the minifier). */
  readonly passes: string[] = [];
  /** The pixel ratio the targets are sized for: the canvas's when the chain was made, or what `setPixelRatio` was last told. */
  private pixelRatio: number;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera, readonly rung: PostRung, width: number, height: number, style: StyleId) {
    const dpr = renderer.getPixelRatio();
    this.pixelRatio = dpr;
    this.msaa = renderer.capabilities.isWebGL2;
    const target = new WebGLRenderTarget(Math.max(1, Math.round(width * dpr)), Math.max(1, Math.round(height * dpr)), { type: HalfFloatType, samples: this.msaa ? 2 : 0 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(width, height);
    this.render = new RenderPass(scene, camera);
    this.render.clearAlpha = 0;
    this.composer.addPass(this.render);
    this.passes.push(this.msaa ? 'render-msaa2' : 'render');
    const s = LOOK_STYLES[style];
    if (rung === 'realistic') {
      const gtao = new GTAOPass(scene, camera, width, height);
      gtao.output = GTAOPass.OUTPUT.Default;
      gtao.updateGtaoMaterial({ radius: s.post.aoRadius, distanceExponent: 1, thickness: 1, distanceFallOff: 1, scale: 0.9, samples: GTAO_SAMPLES });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 6 });
      gtao.blendIntensity = s.post.aoBlend;
      const hide = new SkipAoPass(scene, null);
      this.composer.addPass(hide);
      this.composer.addPass(gtao);
      this.composer.addPass(new SkipAoPass(scene, hide));
      this.passes.push('gtao');
      this.gtao = gtao;
      // PLAN3D-LEVEL3-2435: the floor reflections read GTAO's depth / normals (floor-reflect.ts); realistic rung only
      this.ssr = new SsrPass(gtao, camera, style);
      this.composer.addPass(this.ssr);
      this.passes.push('ssr');
    } else {
      this.gtao = null;
      this.ssr = null;
    }
    this.bloom = new UnrealBloomPass(new Vector2(width, height), s.post.bloomStrengthDay, s.post.bloomRadius, s.post.bloomThresholdDay);
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    gradeOutput(this.output);
    this.composer.addPass(this.output);
    this.passes.push('bloom', 'output');
    this.style = style;
    this.setGrade(style, 0);
    if (!this.msaa) {
      this.composer.addPass(new SMAAPass());
      this.passes.push('smaa');
    }
  }

  setCamera(camera: Camera): void {
    this.render.camera = camera;
    if (this.gtao) this.gtao.camera = camera;
    if (this.ssr) this.ssr.camera = camera;
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.gtao?.setSize(width, height);
  }

  /** The canvas changed its pixel ratio while the chain lives (the DPR cap dial moved while the realistic rung draws, or a level
   * change brought the chain back at another ratio): the composer's two targets and every pass are resized for it in place - no
   * pass is rebuilt and no frame is drawn without the chain. The same ratio again changes nothing (the targets keep their state). */
  setPixelRatio(ratio: number): void {
    if (ratio === this.pixelRatio) return;
    this.pixelRatio = ratio;
    this.composer.setPixelRatio(ratio);
  }

  /** The style and the night factor set the bloom, the AO blend and the colour grade. */
  setLook(style: StyleId, night: number): void {
    this.style = style;
    const b = bloomFor(LOOK_STYLES[style], night);
    this.bloom.threshold = b.threshold;
    this.bloom.strength = b.strength;
    this.bloom.radius = b.radius;
    if (this.gtao) this.gtao.blendIntensity = LOOK_STYLES[style].post.aoBlend * (this.bakedAo ? BAKED_AO_GTAO_SCALE : 1);
    this.setGrade(style, night);
    this.ssr?.setStyle(style);
  }

  private setGrade(style: StyleId, night: number): void {
    const g = gradeFor(style, night);
    const u = this.output.uniforms as Record<string, { value: Vector3 | number }>;
    (u.swLift.value as Vector3).set(...g.lift);
    (u.swGamma.value as Vector3).set(...g.gamma);
    (u.swGain.value as Vector3).set(...g.gain);
    u.swSat.value = g.saturation;
  }

  /** PLAN3D-REALISM2-2433: the baked AO volume shades the materials (true) or not: GTAO steps down / back. */
  setBakedAo(on: boolean): void {
    if (on === this.bakedAo) return;
    this.bakedAo = on;
    if (!this.gtao) return;
    this.gtao.updateGtaoMaterial({ samples: on ? BAKED_AO_GTAO_SAMPLES : GTAO_SAMPLES });
    this.gtao.blendIntensity = LOOK_STYLES[this.style].post.aoBlend * (on ? BAKED_AO_GTAO_SCALE : 1);
  }

  /** The grade uniforms now (tests). */
  get grade(): { lift: number[]; gamma: number[]; gain: number[]; saturation: number } {
    const u = this.output.uniforms as Record<string, { value: Vector3 | number }>;
    const v = (k: string) => (u[k].value as Vector3).toArray();
    return { lift: v('swLift'), gamma: v('swGamma'), gain: v('swGain'), saturation: u.swSat.value as number };
  }

  /** The GTAO state (tests, the perf report). */
  get gtaoState(): { samples: number; blend: number } | null {
    if (!this.gtao) return null;
    return { samples: this.bakedAo ? BAKED_AO_GTAO_SAMPLES : GTAO_SAMPLES, blend: Math.round(this.gtao.blendIntensity * 1000) / 1000 };
  }

  /** The section planes of the cut (null: nothing cut) on the GTAO normal / depth pass. ST7-odd: the pass renders the scene
   * with its own MeshNormalMaterial, which knew nothing of the cut, so the occlusion of the full-height walls (their top
   * corners, the camera body's corner) was composited over the sky above the cut walls as faint grey "wisps". */
  setClip(planes: Plane[] | null): void {
    if (this.gtao) this.gtao.normalMaterial.clippingPlanes = planes;
  }

  /** The planes the normal pass clips with (tests). */
  get clip(): Plane[] | null {
    return this.gtao?.normalMaterial.clippingPlanes ?? null;
  }

  /** PLAN3D-LEVEL3-2435: the floor reflections on / off (the `floor_reflections` dial; realistic rung only). */
  setReflections(on: boolean): void {
    if (this.ssr) this.ssr.enabled = on;
  }

  /** The floor reflections drawn now (tests, the perf report). */
  get reflections(): boolean {
    return !!this.ssr?.enabled;
  }

  draw(): void {
    // the floors write their reflectivity code into the beauty alpha only while the SSR pass is there to read it back
    REFLECT_ON.value = this.ssr?.enabled ? 1 : 0;
    try {
      this.composer.render();
    } finally {
      REFLECT_ON.value = 0;
    }
  }

  dispose(): void {
    this.gtao?.dispose();
    this.ssr?.dispose();
    this.bloom.dispose();
    this.composer.dispose();
  }
}
