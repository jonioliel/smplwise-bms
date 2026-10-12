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
 */
import { HalfFloatType, Vector2, WebGLRenderTarget, type Camera, type Scene, type WebGLRenderer } from './three-bundle';
import { EffectComposer, GTAOPass, OutputPass, RenderPass, SMAAPass, UnrealBloomPass } from './three-post';
import { LOOK_STYLES, bloomFor, type StyleId } from './look-style';

export type PostRung = 'realistic' | 'lite';

export class PostChain {
  readonly composer: EffectComposer;
  private readonly render: RenderPass;
  private readonly gtao: GTAOPass | null;
  private readonly bloom: UnrealBloomPass;
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
      gtao.updateGtaoMaterial({ radius: s.post.aoRadius, distanceExponent: 1, thickness: 1, distanceFallOff: 1, scale: 0.9, samples: 6 });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 6 });
      gtao.blendIntensity = s.post.aoBlend;
      this.composer.addPass(gtao);
      this.passes.push('gtao');
      this.gtao = gtao;
    } else this.gtao = null;
    this.bloom = new UnrealBloomPass(new Vector2(width, height), s.post.bloomStrengthDay, s.post.bloomRadius, s.post.bloomThresholdDay);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.passes.push('bloom', 'output');
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

  /** The style and the night factor set the bloom and the AO blend. */
  setLook(style: StyleId, night: number): void {
    const b = bloomFor(LOOK_STYLES[style], night);
    this.bloom.threshold = b.threshold;
    this.bloom.strength = b.strength;
    this.bloom.radius = b.radius;
    if (this.gtao) this.gtao.blendIntensity = LOOK_STYLES[style].post.aoBlend;
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
