/**
 * The post chain of the realistic level (LOOK_SPEC section 4), loaded lazily with its own vendor chunk (three-post.ts):
 *
 * | rung      | chain                                                                 |
 * |-----------|-----------------------------------------------------------------------|
 * | realistic | RenderPass (MSAA x2, HalfFloat) -> GTAO (r 0.6 m, 6 samples) -> UnrealBloom -> Output |
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
import { HalfFloatType, Vector2, Vector3, WebGLRenderTarget, type Camera, type Plane, type Scene, type WebGLRenderer } from './three-bundle';
import { EffectComposer, GTAOPass, OutputPass, Pass, RenderPass, SMAAPass, UnrealBloomPass } from './three-post';
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
  constructor(private readonly scene: Scene, private readonly hide: boolean) {
    super();
    this.needsSwap = false;
  }

  render(): void {
    this.scene.traverse((o) => {
      if (o.userData.skipAO) o.visible = !this.hide;
    });
  }
}

export class PostChain {
  readonly composer: EffectComposer;
  private readonly render: RenderPass;
  private readonly gtao: GTAOPass | null;
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
      this.composer.addPass(new SkipAoPass(scene, true));
      this.composer.addPass(gtao);
      this.composer.addPass(new SkipAoPass(scene, false));
      this.passes.push('gtao');
      this.gtao = gtao;
    } else this.gtao = null;
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

  draw(): void {
    this.composer.render();
  }

  dispose(): void {
    this.gtao?.dispose();
    this.bloom.dispose();
    this.composer.dispose();
  }
}
