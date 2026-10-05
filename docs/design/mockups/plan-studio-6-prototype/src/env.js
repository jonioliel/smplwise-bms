/**
 * Renderer, sky, sun, image-based lighting and the post chain per quality level.
 *  - realistic (3): Sky shader (three addon) -> PMREM environment (IBL), sun DirectionalLight with a 2048 PCF-soft
 *    shadow map fitted to the plan, hemisphere fill, ACES, GTAO (ambient occlusion) + UnrealBloom (lamp glow) + Output.
 *  - full (2): hemisphere + sun shadows (1024), no textures, no post.
 *  - schematic (1): Lambert, ambient + directional, no shadows, no post.
 */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { sunPosition, lightRecipe, toHex, toCss } from './sun.js';

export class Environment {
  constructor(canvas, opts = {}) {
    // alpha canvas: the sky is the stage's CSS gradient (recipe colours by sun elevation, the product's --sw-map-sky
    // tokens), not a rendered Sky mesh - the Sky shader's HDR output made the bloom pass haze the whole frame and
    // costs a full-screen pass; the shader still feeds the PMREM environment map for the image-based lighting
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true, alpha: true, premultipliedAlpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // r186 removed PCFSoftShadowMap; PCF + radius is the soft edge now
    // shadow maps are redrawn only when something that casts or lights changed (sun, doors, states, level) - a camera
    // move never re-renders 1 + 2x6 shadow passes (the kiosk's "no frame when nothing changes" rule, applied to shadows)
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.dpr = Math.min(opts.maxDpr ?? 2, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.dpr);
    this.scene = new THREE.Scene();
    this.skyScene = new THREE.Scene();
    this.sky = new Sky();
    this.sky.scale.setScalar(2000);
    this.skyScene.add(this.sky);
    this.skyVisible = new Sky();
    this.skyVisible.scale.setScalar(2000);
    this.skyVisible.visible = false; // kept for an optional "sun disc" toggle; off: the gradient dome is the sky
    this.scene.add(this.skyVisible);
    // a cheap LDR sky dome (one draw, vertex colours, no lighting): what the windows and the walk see; the same
    // recipe colours as the CSS backdrop behind the alpha canvas, and a soft sun disc painted into the vertex colours
    const domeG = new THREE.SphereGeometry(400, 48, 24);
    const colors = new Float32Array(domeG.attributes.position.count * 3);
    domeG.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.dome = new THREE.Mesh(domeG, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, toneMapped: false, fog: false, depthWrite: false }));
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    this.dome.userData = { kind: 'sky' };
    this.scene.add(this.dome);
    // the environment map (IBL) is prefiltered from the SAME LDR dome, so the indirect sky light is bounded (<= 1)
    // and predictable; the Sky shader stays available for an HDR variant but is not the default any more
    this.domeScene = new THREE.Scene();
    this.domeScene.add(new THREE.Mesh(domeG, this.dome.material));
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 6;
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
    this.post = { ao: true, bloom: true };
    this.size = { w: 1, h: 1 };
  }

  rendererName() {
    const gl = this.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  }

  setSize(w, h) {
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setSize(w, h);
      if (this.gtao) this.gtao.setSize(w, h);
    }
  }

  /** Fit the sun's shadow camera to the plan's extent (metres). */
  fitShadows(extent, elevationTop) {
    this.fitted = { extent, top: elevationTop };
    const sc = this.sun.shadow.camera;
    const w = extent.maxX - extent.minX, d = extent.maxZ - extent.minZ;
    const r = Math.hypot(w, d) / 2 + 2;
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
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // VSM is not supported for point lights (lamp shadows)
    this.renderer.shadowMap.needsUpdate = true;
    this.sun.castShadow = q >= 2;
    this.sun.shadow.radius = q >= 3 ? 6 : 1;
    this.sun.shadow.blurSamples = 12;
    this.sun.shadow.mapSize.set(q >= 3 ? 2048 : 1024, q >= 3 ? 2048 : 1024);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.scene.environment = q >= 3 ? (this.envTarget && this.envTarget.texture) : null;
    this.scene.background = null;
    this.renderer.toneMapping = q >= 2 ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.buildComposer(camera);
    this.applyTime();
  }

  buildComposer(camera) {
    if (this.composer) { this.composer.dispose && this.composer.dispose(); this.composer = null; this.gtao = null; this.bloom = null; }
    if (this.quality < 3) return;
    const { w, h } = this.size;
    const composer = new EffectComposer(this.renderer);
    composer.setPixelRatio(this.dpr);
    composer.setSize(w, h);
    const rp = new RenderPass(this.scene, camera);
    rp.clearAlpha = 0;
    composer.addPass(rp);
    // GTAO + its denoise cost ~30 ms at 1076x828 on an Intel UHD 630 (measured, tools/capture.mjs levers): the
    // "realistic lite" rung keeps the textures, the IBL, the shadows and the lamp bloom and drops the AO
    if (this.post.ao && !this.post.lite) {
      const gtao = new GTAOPass(this.scene, camera, w, h);
      gtao.output = GTAOPass.OUTPUT.Default;
      gtao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1, thickness: 1, distanceFallOff: 1, scale: 1.1, samples: 8 });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 6 });
      gtao.blendIntensity = 0.8;
      composer.addPass(gtao);
      this.gtao = gtao;
    }
    if (this.post.bloom) {
      const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.25 + 0.45 * (this.recipe ? this.recipe.night : 0), 0.5, 2.4);
      composer.addPass(bloom);
      this.bloom = bloom;
    }
    composer.addPass(new OutputPass());
    this.composer = composer;
    this.camera = camera;
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
  applyTime() {
    const t = this.time;
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
    // so indoors the fill is lowered - the CR's S3 lightmap is the real answer
    const inside = this.interior ? 0.55 : 1;
    this.sun.intensity = this.quality >= 2 ? r.sunIntensity * (ibl ? 0.5 : 1) : 1.1;
    this.sun.color.setHex(toHex(r.sunColor));
    this.sun.visible = sp.elevation > -3 || this.quality < 2;
    this.moon.intensity = r.moon * 0.5;
    this.moon.position.copy(c).add(new THREE.Vector3(-dist, dist * 0.9, dist * 0.4));
    this.hemi.color.setHex(toHex(r.hemiSky));
    this.hemi.groundColor.setHex(toHex(r.hemiGround));
    // with image-based lighting the sky's diffuse comes from the environment map; the hemisphere only fills a little
    this.hemi.intensity = (this.quality >= 2 ? r.hemiIntensity * (ibl ? 0.25 : 1) : 1.2) * inside;
    this.ambient.intensity = this.quality >= 2 ? 0 : 0.9;
    this.renderer.toneMappingExposure = r.exposure * (ibl ? 0.8 : 1) * (this.interior ? 0.9 : 1);
    this.renderer.shadowMap.needsUpdate = true;
    // the bloom works on the HDR buffer: only emitters (lamps, screens, markers) and sun glints cross the threshold;
    // stronger at night, when the glow is the picture (NeonPlan / the owner's reference)
    // sunlit white plaster reaches ~2 in the HDR buffer; the emitters (bulbs 2.2-3.8, screens, markers) sit above it
    if (this.bloom) { this.bloom.threshold = 2.4; this.bloom.strength = 0.25 + 0.45 * r.night; this.bloom.radius = 0.5; }
    // sky shader
    for (const sky of [this.sky, this.skyVisible]) {
      const u = sky.material.uniforms;
      u.turbidity.value = r.turbidity;
      u.rayleigh.value = r.rayleigh;
      u.mieCoefficient.value = r.mie;
      u.mieDirectionalG.value = 0.8;
      u.sunPosition.value.copy(dir);
    }
    if (this.backdrop) this.backdrop.style.background = `linear-gradient(180deg, ${toCss(r.skyTop)} 0%, ${toCss(r.skyHorizon)} 70%, ${toCss(r.hemiGround.map((v) => v * 0.9 + 0.1))} 100%)`;
    this.paintDome(r, dir);
    if (this.quality >= 3) {
      if (this.envTarget) this.envTarget.dispose();
      this.envTarget = this.pmrem.fromScene(this.domeScene, 0, 1, 1000);
      this.scene.environment = this.envTarget.texture;
      this.scene.environmentIntensity = (0.25 + r.day * 0.65) * inside;
    }
    if (this.onTime) this.onTime(sp, r);
  }

  paintDome(r, sunDir) {
    const g = this.dome.geometry;
    const pos = g.attributes.position, col = g.attributes.color;
    const v = new THREE.Vector3();
    const ground = r.hemiGround.map((x) => x * 0.9 + 0.1);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const t = v.y; // -1 .. 1
      let c;
      if (t < 0) c = ground;
      else { const k = Math.pow(t, 0.55); c = [r.skyHorizon[0] + (r.skyTop[0] - r.skyHorizon[0]) * k, r.skyHorizon[1] + (r.skyTop[1] - r.skyHorizon[1]) * k, r.skyHorizon[2] + (r.skyTop[2] - r.skyHorizon[2]) * k]; }
      // sun disc + halo (only above the horizon)
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
