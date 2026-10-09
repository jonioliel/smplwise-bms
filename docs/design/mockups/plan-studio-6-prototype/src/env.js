/**
 * Renderer, sky, sun, image-based lighting and the post chain per quality level (look-dev version).
 *  - realistic (3): LDR sky dome -> PMREM environment (IBL), sun DirectionalLight with a 2048 PCF shadow map fitted to
 *    the plan, a small hemisphere fill, AgX tone mapping, MSAA x4 render target, GTAO (top rung only) + UnrealBloom
 *    (threshold above the sunlit-plaster level, so only emitters glow) + Output.
 *  - realistic lite: the same without GTAO, MSAA x4 kept (cheap on a GPU), DPR 1.
 *  - full (2): hemisphere + sun shadows (1024), no textures, no post (renderer MSAA).
 *  - schematic (1): Lambert, ambient + directional, no shadows, no post.
 * Everything that depends on the visual style (style.js) reads `this.style`: exposure, sun / sky scale, env intensity,
 * bloom numbers, backdrop gradient.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { sunPosition, lightRecipe, toHex, toCss } from './sun.js';
import { STYLES } from './style.js';

const lerp = (a, b, t) => a + (b - a) * t;

export class Environment {
  constructor(canvas, opts = {}) {
    // alpha canvas: the sky behind the building is the stage's CSS gradient (style backdrop colours by sun elevation);
    // the LDR dome is what windows and the walk see and what the IBL is prefiltered from
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true, alpha: true, premultipliedAlpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // r186 removed PCFSoftShadowMap; PCF + radius is the soft edge now
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.toneMapping = THREE.NeutralToneMapping; // plan L3(a): Khronos PBR Neutral - no hue shift, keeps saturation up to the roll-off (AgX was tried first: too flat, drained the oak)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true; // the section cut (plan L6) clips wall materials with one world plane
    this.dpr = Math.min(opts.maxDpr ?? 2, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.dpr);
    this.scene = new THREE.Scene();
    this.style = STYLES.light;
    const domeG = new THREE.SphereGeometry(400, 48, 24);
    const colors = new Float32Array(domeG.attributes.position.count * 3);
    domeG.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.dome = new THREE.Mesh(domeG, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, toneMapped: false, fog: false, depthWrite: false }));
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    this.dome.userData = { kind: 'sky' };
    this.scene.add(this.dome);
    this.domeScene = new THREE.Scene();
    this.domeScene.add(new THREE.Mesh(domeG, this.dome.material));
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 5;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.5);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0);
    this.scene.add(this.ambient);
    this.moon = new THREE.DirectionalLight(0xbfd0ff, 0);
    this.scene.add(this.moon);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem.compileCubemapShader();
    this.envTarget = null;
    this.quality = 3;
    this.composer = null;
    this.time = { hour: 15.5, day: 278, latitude: 32.08, north: 0, weather: 'clear' };
    this.recipe = lightRecipe(40, 'clear');
    this.fitted = null;
    this.post = { ao: true, bloom: true, lite: false, msaa: true };
    this.size = { w: 1, h: 1 };
    this.interior = false;
    this.interiorFill = 1; // per-room daylight factor while walking (plan L3 b / P5): 0..1, eased by the app
    this.isWebGL2 = this.renderer.capabilities.isWebGL2;
  }

  rendererName() {
    const gl = this.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  }

  setStyle(style) {
    this.style = style;
    this.applyTime();
  }

  setSize(w, h) {
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setSize(w, h);
      if (this.gtao) this.gtao.setSize(w, h);
    }
  }

  /** Fit the sun's shadow camera to the plan's extent (metres), with room for the ground-disc shadow. */
  fitShadows(extent, elevationTop) {
    this.fitted = { extent, top: elevationTop };
    const sc = this.sun.shadow.camera;
    const w = extent.maxX - extent.minX, d = extent.maxZ - extent.minZ;
    const r = Math.hypot(w, d) / 2 + 4;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r;
    sc.near = 0.5; sc.far = r * 4 + 20;
    sc.updateProjectionMatrix();
    this.centre = new THREE.Vector3((extent.minX + extent.maxX) / 2, elevationTop / 2, (extent.minZ + extent.maxZ) / 2);
    this.sun.target.position.copy(this.centre);
    this.moon.target = this.sun.target;
    this.applyTime();
  }

  setQuality(q, camera) {
    this.quality = q;
    this.renderer.shadowMap.enabled = q >= 2;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.needsUpdate = true;
    this.sun.castShadow = q >= 2;
    this.sun.shadow.radius = q >= 3 ? 5 : 1;
    this.sun.shadow.blurSamples = 12;
    this.sun.shadow.mapSize.set(q >= 3 ? 2048 : 1024, q >= 3 ? 2048 : 1024);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.scene.environment = q >= 3 ? (this.envTarget && this.envTarget.texture) : null;
    this.scene.background = null;
    this.renderer.toneMapping = q >= 2 ? THREE.NeutralToneMapping : THREE.NoToneMapping;
    this.buildComposer(camera);
    this.applyTime();
  }

  buildComposer(camera) {
    if (this.composer) { this.composer.dispose && this.composer.dispose(); this.composer = null; this.gtao = null; this.bloom = null; this.smaa = null; }
    if (this.quality < 3) return;
    const { w, h } = this.size;
    // plan L8: MSAA on the composer's own target (WebGL2): x4 on the top rung, x2 on lite (post.samples overrides for
    // the lever measurement); SMAA pass as the fallback where samples are unsupported or when post.aa === 'smaa'
    const samples = this.post.samples != null ? this.post.samples : this.post.lite ? 2 : 4;
    const msaa = this.post.msaa && this.isWebGL2 && samples > 0 && this.post.aa !== 'smaa';
    const target = new THREE.WebGLRenderTarget(Math.round(w * this.dpr), Math.round(h * this.dpr), { type: THREE.HalfFloatType, samples: msaa ? samples : 0 });
    const composer = new EffectComposer(this.renderer, target);
    composer.setPixelRatio(this.dpr);
    composer.setSize(w, h);
    const rp = new RenderPass(this.scene, camera);
    rp.clearAlpha = 0;
    composer.addPass(rp);
    if (this.post.ao && !this.post.lite) {
      const gtao = new GTAOPass(this.scene, camera, w, h);
      gtao.output = GTAOPass.OUTPUT.Default;
      // plan L3(d): radius ~0.6 m, low intensity - contact darkening, not a dirty frame
      gtao.updateGtaoMaterial({ radius: this.style.post.aoRadius, distanceExponent: 1, thickness: 1, distanceFallOff: 1, scale: 0.9, samples: 8 });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 6 });
      gtao.blendIntensity = this.style.post.aoIntensity;
      composer.addPass(gtao);
      this.gtao = gtao;
    }
    if (this.post.bloom) {
      const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.2, this.style.post.bloomRadius, 2.0);
      composer.addPass(bloom);
      this.bloom = bloom;
    }
    composer.addPass(new OutputPass());
    if (!msaa && this.post.aa !== 'none') { const smaa = new SMAAPass(); composer.addPass(smaa); this.smaa = smaa; }
    this.composer = composer;
    this.camera = camera;
    this.applyPost();
  }

  setCamera(camera) {
    this.camera = camera;
    if (this.composer) {
      for (const p of this.composer.passes) if ('camera' in p) p.camera = camera;
      if (this.gtao) this.gtao.camera = camera;
    }
  }

  /** Time of day / weather -> sun, sky, hemisphere, exposure, IBL. */
  setTime(partial) {
    Object.assign(this.time, partial);
    this.applyTime();
  }
  /** The backdrop gradient stops [top, horizon, bottom] as CSS colours: style colours mixed 50 % with the sun recipe. */
  backdropColors() {
    const r = this.recipe, S = this.style.rig, B = this.style.backdrop;
    const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
    const mix = (a, b) => toCss([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
    const top = hex(r.night > 0.5 ? B.topNight : B.topDay), hor = hex(r.night > 0.5 ? B.horizonNight : B.horizonDay);
    return [mix(top, r.skyTop.map((v) => v * S.skyScale)), mix(hor, r.skyHorizon.map((v) => v * S.skyScale)), toCss(r.hemiGround.map((v) => v * B.groundTint * 0.9 + 0.08))];
  }
  /** Only the fill-dependent numbers (walk: per-room daylight) - no PMREM regeneration, cheap enough per frame. */
  applyFill() {
    const S = this.style.rig, r = this.recipe, ibl = this.quality >= 3;
    const inside = this.interior ? lerp(S.interiorFill[0], S.interiorFill[1], this.interiorFill) * 0.7 : 1;
    this.hemi.intensity = (this.quality >= 2 ? r.hemiIntensity * (ibl ? S.hemiScale : 1) * (ibl ? 1 : S.skyScale) : 1.2) * inside;
    if (ibl) this.scene.environmentIntensity = lerp(S.envNight, S.envDay, r.day) * inside;
  }
  applyPost() {
    const r = this.recipe, st = this.style.post;
    if (this.bloom) {
      this.bloom.threshold = lerp(st.bloomThresholdDay, st.bloomThresholdNight, r.night);
      this.bloom.strength = lerp(st.bloomStrengthDay, st.bloomStrengthNight, r.night);
      this.bloom.radius = st.bloomRadius;
    }
  }
  applyTime() {
    const t = this.time, S = this.style.rig;
    const sp = sunPosition(t.hour, t.day, t.latitude, t.north);
    const r = lightRecipe(sp.elevation, t.weather);
    this.recipe = r;
    this.sunInfo = sp;
    const dir = new THREE.Vector3(sp.dir[0], Math.max(sp.dir[1], -0.2), sp.dir[2]).normalize();
    const c = this.centre || new THREE.Vector3();
    const dist = this.fitted ? Math.hypot(this.fitted.extent.maxX - this.fitted.extent.minX, this.fitted.extent.maxZ - this.fitted.extent.minZ) : 20;
    this.sun.position.copy(c).addScaledVector(dir, dist * 1.5);
    const ibl = this.quality >= 3;
    // interior factor (the walk): without global illumination the sky's diffuse reaches every indoor wall unoccluded,
    // so indoors the fill is lowered - scaled per room by its window area (plan L3 b, P5)
    const inside = this.interior ? lerp(S.interiorFill[0], S.interiorFill[1], this.interiorFill) * 0.7 : 1;
    this.sun.intensity = this.quality >= 2 ? r.sunIntensity * (ibl ? 0.55 : 1) * S.sunScale : 1.1;
    this.sun.color.setHex(toHex(r.sunColor));
    this.sun.visible = sp.elevation > -3 || this.quality < 2;
    this.moon.intensity = r.moon * S.moonScale;
    this.moon.position.copy(c).add(new THREE.Vector3(-dist, dist * 0.9, dist * 0.4));
    this.hemi.color.setHex(toHex(r.hemiSky));
    this.hemi.groundColor.setHex(toHex(r.hemiGround));
    this.hemi.intensity = (this.quality >= 2 ? r.hemiIntensity * (ibl ? S.hemiScale : 1) * (ibl ? 1 : S.skyScale) : 1.2) * inside;
    this.ambient.intensity = this.quality >= 2 ? 0 : 0.9;
    this.renderer.toneMappingExposure = r.exposure * lerp(S.exposureDay, S.exposureNight, r.night) * (ibl ? 1.0 : 1.1) * (this.interior ? 1.05 : 1);
    this.renderer.shadowMap.needsUpdate = true;
    this.applyPost();
    if (this.backdrop) {
      const [topC, horC, botC] = this.backdropColors();
      this.backdrop.style.background = `linear-gradient(180deg, ${topC} 0%, ${horC} 62%, ${botC} 100%)`;
    }
    this.paintDome(r, dir);
    if (this.quality >= 3) {
      if (this.envTarget) this.envTarget.dispose();
      this.envTarget = this.pmrem.fromScene(this.domeScene, 0, 1, 1000);
      this.scene.environment = this.envTarget.texture;
      this.scene.environmentIntensity = lerp(S.envNight, S.envDay, r.day) * inside;
    }
    if (this.onTime) this.onTime(sp, r);
  }

  paintDome(r, sunDir) {
    const g = this.dome.geometry;
    const pos = g.attributes.position, col = g.attributes.color;
    const v = new THREE.Vector3();
    const S = this.style.rig.skyScale;
    const ground = r.hemiGround.map((x) => (x * 0.9 + 0.1) * this.style.backdrop.groundTint);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const t = v.y; // -1 .. 1
      let c;
      if (t < 0) c = ground;
      else { const k = Math.pow(t, 0.55); c = [(r.skyHorizon[0] + (r.skyTop[0] - r.skyHorizon[0]) * k) * S, (r.skyHorizon[1] + (r.skyTop[1] - r.skyHorizon[1]) * k) * S, (r.skyHorizon[2] + (r.skyTop[2] - r.skyHorizon[2]) * k) * S]; }
      const d = Math.max(0, v.dot(sunDir));
      const disc = sunDir.y > -0.05 ? Math.pow(d, 400) * 0.9 + Math.pow(d, 12) * 0.18 * r.day : 0;
      col.setXYZ(i, Math.min(1, c[0] + disc * r.sunColor[0]), Math.min(1, c[1] + disc * r.sunColor[1]), Math.min(1, c[2] + disc * r.sunColor[2]));
    }
    col.needsUpdate = true;
    this.dome.visible = this.quality >= 2;
  }

  render(camera) {
    if (this.composer && this.quality >= 3) {
      if (this.camera !== camera) this.setCamera(camera);
      this.composer.render();
    } else this.renderer.render(this.scene, camera);
  }
}
