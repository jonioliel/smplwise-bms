/**
 * Plan Studio 6 prototype - the application: plans, cameras and presets, the quality ladder with the frame-rate probe,
 * the time-of-day / weather card, the device-state panel, the walk-through (keyboard, mouse, touch joystick, tap-to-walk,
 * minimap, saved viewpoints, pointer lock opt-in), the stills bake + kiosk idle mode, the live HUD. Hebrew RTL chrome
 * in the product's tokens. PROTOTYPE ONLY - nothing here is product code.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { MaterialLibrary } from './materials.js';
import { PlanScene, EYE_M } from './scene.js';
import { Environment } from './env.js';
import { WalkController, drawMinimap } from './walk.js';
import { StillsBaker, renderStills } from './stills.js';
import { hourLabel, dateLabel } from './sun.js';
import { pointInPolygon, polygonCentroid } from './geometry.js';
import { DEMO_HOUSE } from './data/demo-house.js';
import { FIXTURE_SAMPLE_V2 } from './data/fixture-sample-v2.generated.js';
import { STYLES, defaultStyleFor } from './style.js';
import { ModelLibrary } from './models.js';

const QUALITY_HE = { 3: 'ריאליסטי', 2: 'מלא', 1: 'סכמטי', 0: 'תמונות מוכנות' };
const LITE_HE = 'ריאליסטי קל';
/** The ladder's rungs in order: [quality, lite]. "realistic lite" = level 3 without the floor reflector, without physical
 * glass, GTAO at fewer samples and DPR 1 - the CR §8 S7 lever table as a rung of its own. */
const RUNGS = [[3, false], [3, true], [2, false], [1, false], [0, false]];
const WEATHER = [['clear', 'בהיר'], ['hazy', 'אובך'], ['overcast', 'מעונן']];
const MIN_FPS = 30;
const PROBE_MS = 2500;
const IDLE_DEFAULT_S = 30;
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

const FIXTURE_PLAN = {
  id: 'fixture-sample-v2',
  title: 'sample-v2.json (קובץ הבדיקה של הריפו)',
  doc: FIXTURE_SAMPLE_V2,
  zones: [],
  anchors: [],
  entities: { 'light.store': 'on', 'switch.hall_a': 'on', 'lock.store': 'locked' },
  coverPositions: {},
  entityNames: { 'light.store': 'תאורת מחסן', 'lock.store': 'מנעול מחסן' },
  doorLocks: {},
};
const PLANS = [DEMO_HOUSE, FIXTURE_PLAN];

class App {
  constructor(opts = {}) {
    this.stage = $('stage');
    this.canvas = $('gl');
    this.env = new Environment(this.canvas, { maxDpr: 2 });
    this.env.backdrop = this.stage;
    // visual style (owner Q12: both; per-browser choice, default follows the UI theme)
    this.styleChoice = (() => { try { return localStorage.getItem('studio6.style') || 'auto'; } catch { return 'auto'; } })();
    this.style = this.resolveStyle();
    this.env.style = this.style;
    this.lib = new MaterialLibrary(this.style);
    this.planScene = new PlanScene(this.lib);
    this.hudOn = /[?&]hud/.test(location.search); // plan L9: no debug HUD on an operator screen; developer toggle
    this.planScene._reflector = { Reflector };
    this.env.scene.add(this.planScene.root);
    // real-model furniture path (owner Q10): lazy glTF by item id, palette slots, per-item fallback; ?testmodels serves
    // the in-code stand-in for every manifest id so the path is verified before any file is downloaded
    this.planScene.models = new ModelLibrary(this.lib, { onLoaded: () => { this.rebuild(); this.makeThumbs(); }, testModel: /[?&]testmodels/.test(location.search) });
    this.baker = new StillsBaker(this.env, this.planScene);
    this.quality = 3;
    this.lite = false;
    this.mode = 'orbit';
    this.levelMode = null;
    this.preset = 'iso';
    // reflections (a planar Reflector = a second full scene pass incl. the glass transmission pass) measured +116 ms per
    // frame on an Intel UHD 630 - off by default, a toggle in the quality panel; lamp shadows likewise (2 x 6 passes)
    this.opts = { reflections: false, ao: true, bloom: true, lampShadows: false, autoLadder: true, dprCap: 1.25, idleS: IDLE_DEFAULT_S, pointerLock: false };
    // the settings the product port must expose (owner answers Q3 / Q5 / Q7 / Q9 / Q10 / Q11); per browser here
    this.settings = Object.assign({ eyeHeight: EYE_M, mouseMode: 'drag', furnitureMode: 'procedural', defaultView: 'schematic', wallDisplay: 'live', timeSource: 'clock', showTemps: false, sectionCut: true, motion: true }, (() => { try { return JSON.parse(localStorage.getItem('studio6.settings') || '{}'); } catch { return {}; } })());
    this.tween = null;
    this.planScene.furnitureMode = this.settings.furnitureMode;
    this.fps = { ema: 0, ms: 0, frames: 0, last: performance.now(), window: [] };
    this.needsFrame = true;
    this.continuous = false;
    this.lastInput = performance.now();
    this.touch = false;
    this.hover = null;
    this.raycaster = new THREE.Raycaster();
    this.walk = null;
    this.savedPositions = [];
    this.probe = null;
    this.fallbackNote = null;
    this.bakes = {};
    this.thumbs = {};
    this.presenceTimers = {};
    this.setupCameras();
    this.bindUI();
    if (!opts.defer) this.boot();
  }
  boot() {
    this.loadPlan(PLANS[0]);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame((t) => this.frame(t));
  }
  resolveStyle() { return this.styleChoice === 'auto' ? defaultStyleFor(document.documentElement.dataset.theme) : (STYLES[this.styleChoice] || STYLES.light); }
  /** Switch the visual style live: palette re-tint, light rig, post numbers, caps - no geometry rebuild. */
  setStyle(choice) {
    this.styleChoice = choice;
    try { localStorage.setItem('studio6.style', choice); } catch { /* ignore */ }
    this.style = this.resolveStyle();
    this.planScene.setStyle(this.style);
    this.env.setStyle(this.style);
    this.env.buildComposer(this.camera);
    this.planScene.setNight(this.env.recipe.night);
    this.applyCut();
    document.documentElement.dataset.style = this.style.id;
    this.renderStyleChip && this.renderStyleChip();
    this.makeThumbs();
    this.invalidate();
  }
  /** The section cut (plan L6): orbit views cut the top visible level at style.cut.fraction of its ceiling; the walk never cuts. */
  applyCut() {
    if (this.mode !== 'orbit' || this.quality < 2 || !this.plan || !this.settings.sectionCut) { this.planScene.setCut(null); return; }
    const ids = this.plan.doc.levels.map((l) => l.id);
    const top = this.levelMode === 'all' || !this.levelMode ? ids[ids.length - 1] : this.levelMode;
    const L = this.planScene.levels[top];
    if (!L) { this.planScene.setCut(null); return; }
    this.planScene.setCut(L.elevation + L.ceiling * this.style.cut.fraction, top);
    this.shadowDirty = true;
  }

  // ------------------------------------------------------------------ cameras
  setupCameras() {
    this.persp = new THREE.PerspectiveCamera(42, 1, 0.05, 300);
    this.ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, -100, 300);
    this.walkCam = new THREE.PerspectiveCamera(62, 1, 0.05, 200);
    this.camera = this.ortho;
    this.controls = null;
  }
  makeControls(camera) {
    if (this.controls) this.controls.dispose();
    const c = new OrbitControls(camera, this.canvas);
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.maxPolarAngle = Math.PI / 2 - 0.03;
    c.minDistance = 2;
    c.maxDistance = 120;
    c.addEventListener('change', () => this.invalidate(false));
    c.addEventListener('start', () => this.userInput());
    this.controls = c;
  }
  saveSettings() { try { localStorage.setItem('studio6.settings', JSON.stringify(this.settings)); } catch { /* ignore */ } }
  /** Eased camera move (plan L11): same camera type -> 500 ms tween of position / target / ortho zoom; type change -> cross-fade. */
  fitCamera(preset, animate = this.settings.motion && !!this.plan && this.mode === 'orbit') {
    const before = this.camera && this.controls ? { cam: this.camera, pos: this.camera.position.clone(), target: this.controls.target.clone(), half: this.ortho.top } : null;
    this.fitCameraNow(preset);
    if (!animate || !before) return;
    if (before.cam !== this.camera) { this.flash(0.6); return; }
    const to = { pos: this.camera.position.clone(), target: this.controls.target.clone(), half: this.ortho.top };
    const cam = this.camera, ctl = this.controls, aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    this.tween = { t0: performance.now(), ms: 520, step: (k) => {
      cam.position.lerpVectors(before.pos, to.pos, k);
      ctl.target.lerpVectors(before.target, to.target, k);
      if (cam === this.ortho) { const h = before.half + (to.half - before.half) * k; cam.left = -h * aspect; cam.right = h * aspect; cam.top = h; cam.bottom = -h; cam.updateProjectionMatrix(); }
      ctl.update();
    } };
    ctl.enabled = false;
  }
  /** A quick dark flash for cuts the tween cannot bridge (camera type change, floor change). */
  flash(max = 0.5) {
    if (!this.settings.motion) return;
    const f = $('fade');
    f.style.transition = 'opacity .12s';
    f.style.opacity = String(max);
    setTimeout(() => { f.style.transition = 'opacity .28s cubic-bezier(.2,.7,.2,1)'; f.style.opacity = '0'; }, 130);
  }
  fitCameraNow(preset) {
    this.preset = preset;
    const ext = this.visibleExtent();
    const cx = (ext.minX + ext.maxX) / 2, cz = (ext.minZ + ext.maxZ) / 2;
    const w = ext.maxX - ext.minX, d = ext.maxZ - ext.minZ, h = ext.top;
    const radius = Math.hypot(w, d, h) / 2;
    const target = new THREE.Vector3(cx, ext.base + h * 0.35, cz);
    let cam;
    if (preset === 'persp') {
      cam = this.persp;
      const dist = radius / Math.tan((cam.fov * Math.PI) / 360) * 1.15;
      cam.position.set(cx + dist * 0.62, target.y + dist * 0.55, cz + dist * 0.62);
    } else if (preset === 'top') {
      cam = this.ortho;
      cam.position.set(cx, target.y + 60, cz + 0.001);
    } else {
      cam = this.ortho;
      const dist = 60;
      cam.position.set(cx + dist * 0.577, target.y + dist * 0.577, cz + dist * 0.577);
    }
    if (cam === this.ortho) {
      const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
      const half = radius * 1.08;
      cam.left = -half * aspect; cam.right = half * aspect; cam.top = half; cam.bottom = -half;
      cam.zoom = 1;
      cam.updateProjectionMatrix();
    }
    cam.lookAt(target);
    this.camera = cam;
    this.makeControls(cam);
    this.controls.target.copy(target);
    this.controls.update();
    this.env.setCamera(cam);
    this.invalidate();
  }
  visibleExtent() {
    const levels = Object.values(this.planScene.levels).filter((L) => L.group.visible && L.extent);
    const all = levels.length ? levels : Object.values(this.planScene.levels).filter((L) => L.extent);
    const ext = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, base: Infinity, top: 0 };
    for (const L of all) {
      ext.minX = Math.min(ext.minX, L.extent.minX); ext.maxX = Math.max(ext.maxX, L.extent.maxX);
      ext.minZ = Math.min(ext.minZ, L.extent.minZ); ext.maxZ = Math.max(ext.maxZ, L.extent.maxZ);
      ext.base = Math.min(ext.base, L.elevation); ext.top = Math.max(ext.top, L.elevation + L.ceiling);
    }
    if (!Number.isFinite(ext.minX)) return { minX: 0, maxX: 10, minZ: 0, maxZ: 10, base: 0, top: 3 };
    return ext;
  }
  resize() {
    const r = this.stage.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    this.env.dpr = Math.min(this.quality === 3 && this.lite ? 1 : this.opts.dprCap, window.devicePixelRatio || 1);
    this.env.renderer.setPixelRatio(this.env.dpr);
    this.env.setSize(w, h);
    for (const cam of [this.persp, this.walkCam]) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (this.ortho) {
      const half = this.ortho.top;
      this.ortho.left = -half * (w / h); this.ortho.right = half * (w / h);
      this.ortho.updateProjectionMatrix();
    }
    this.invalidate();
  }

  // ------------------------------------------------------------------ plans
  loadPlan(plan) {
    this.plan = plan;
    this.entities = { ...plan.entities };
    this.coverPositions = { ...(plan.coverPositions || {}) };
    plan.entities = this.entities;
    plan.coverPositions = this.coverPositions;
    $('crumb-floor').textContent = plan.title;
    const xp = plan.doc.x_proto || {};
    this.env.setTime({ north: xp.north_deg || 0, latitude: xp.latitude || 32.0 });
    this.savedPositions = (xp.walk_positions || []).map((p) => ({ ...p }));
    this.bakes = {};
    this.rebuild();
    const def = plan.doc.levels.find((l) => l.is_default) || plan.doc.levels[0];
    this.setLevelMode(def.id);
    this.fitCamera('iso');
    this.buildStatesPanel();
    this.buildWalkPanel();
    this.buildQualityPanel();
    this.buildStrip();
    this.makeThumbs();
    this.startProbe();
  }
  qualityLabel() { return this.quality === 3 && this.lite ? LITE_HE : QUALITY_HE[this.quality]; }
  rebuild() {
    if (this.quality === 0) return;
    const lite = this.quality === 3 && this.lite;
    this.planScene.maxLights = this.quality >= 3 ? 8 : 6;
    this.planScene.lite = lite;
    this.planScene.build(this.plan, this.quality, { reflections: this.opts.reflections && this.quality >= 3 && !lite && !this.touch, lampShadows: this.opts.lampShadows && this.quality >= 3 && !lite && !this.touch });
    const ext = this.visibleExtent();
    this.env.post.lite = lite;
    this.env.fitShadows(ext, ext.top);
    this.env.setQuality(this.quality, this.camera || this.ortho);
    this.resize();
    if (this.walk) this.walk.scene = this.planScene;
    this.planScene.showLevel(this.levelMode || 'all', this.mode === 'walk');
    this.planScene.setNight(this.env.recipe.night);
    this.applyCut();
    this.invalidate();
  }
  setLevelMode(mode) {
    this.levelMode = mode;
    this.planScene.showLevel(mode, this.mode === 'walk');
    this.applyCut();
    this.buildStrip();
    this.invalidate();
    if (this.mode === 'orbit') { const ext = this.visibleExtent(); this.env.fitShadows(ext, ext.top); }
    if (this.mode === 'stills') this.showStills();
  }

  // ------------------------------------------------------------------ quality ladder
  setQuality(q, reason, lite = false) {
    if (q === this.quality && lite === this.lite) return;
    const prev = this.quality, prevLite = this.lite;
    this.quality = q;
    this.lite = q === 3 && lite;
    if (q === 0) {
      if (!this.bakes[this.currentLevelId()]) { this.quality = prev; this.lite = prevLite; this.toast('אין תמונות מוכנות לקומה — הכן תמונות תחילה'); return; }
      this.lastLiveQuality = prev; this.lastLiveLite = prevLite;
      this.enterStills();
    } else {
      if (this.mode === 'stills') this.exitStills(false);
      this.rebuild();
      this.makeThumbs();
    }
    this.renderBar();
    this.renderLadder();
    if (reason) this.setNote(reason);
    if (q > 0) this.startProbe();
  }
  startProbe() {
    if (!this.opts.autoLadder || this.quality === 0) return;
    this.probe = { start: null, frames: 0, warm: 0 };
    this.continuous = true;
    this.invalidate();
  }
  probeFrame(now) {
    const p = this.probe;
    if (!p) return;
    if (p.warm < 3) { p.warm++; return; }
    if (p.start === null) { p.start = now; p.frames = 0; return; }
    p.frames++;
    const elapsed = now - p.start;
    if (elapsed >= PROBE_MS) {
      const fps = (p.frames * 1000) / elapsed;
      this.probe = null;
      this.continuous = this.mode === 'walk';
      this.lastProbe = { fps: Math.round(fps), quality: this.quality, label: this.qualityLabel() };
      const idx = RUNGS.findIndex(([q, l]) => q === this.quality && l === this.lite);
      const next = RUNGS[idx + 1];
      if (fps < MIN_FPS && next && (next[0] > 0 || this.bakes[this.currentLevelId()])) {
        const label = this.qualityLabel();
        const nextLabel = next[0] === 3 && next[1] ? LITE_HE : QUALITY_HE[next[0]];
        this.fallbackNote = `${label} נמדד ${Math.round(fps)} fps (מתחת ל־${MIN_FPS}) — ירדנו ל"${nextLabel}" להמשך ההפעלה`;
        this.setQuality(next[0], this.fallbackNote, next[1]);
        this.stage.dataset.fallback = String(idx + 1);
      } else this.setNote(`${this.qualityLabel()} · נמדד ${Math.round(fps)} fps ב־${PROBE_MS / 1000} ש׳ — נשאר`);
      this.renderLadder();
    }
  }
  /** A short bottom toast (clean operator screens: short confirmations, nothing permanent over the scene). */
  setNote(text, danger = false, holdMs = 6000) {
    const n = $('note');
    n.hidden = !text;
    n.textContent = text || '';
    n.classList.toggle('danger', danger);
    clearTimeout(this._noteT);
    if (text && !danger && holdMs > 0) this._noteT = setTimeout(() => { n.hidden = true; }, holdMs);
  }
  toast(text) { this.setNote(text, false, 3500); }
  toOrbit(preset) {
    if (this.mode === 'walk') { this.orbitState = { ...(this.orbitState || {}), preset }; this.exitWalk(); return; }
    if (this.mode === 'stills') this.exitStills(true);
    this.fitCamera(preset);
    this.renderBar();
  }

  // ------------------------------------------------------------------ UI
  bindUI() {
    const sel = $('plan-select');
    for (const p of PLANS) { const o = el('option', '', p.title); o.value = p.id; sel.appendChild(o); }
    sel.addEventListener('change', () => { if (this.mode === 'walk') this.exitWalk(); if (this.mode === 'stills') this.exitStills(false); this.loadPlan(PLANS.find((p) => p.id === sel.value)); });
    $('theme-toggle').addEventListener('click', () => { const d = document.documentElement; d.dataset.theme = d.dataset.theme === 'dark' ? '' : 'dark'; if (this.styleChoice === 'auto') this.setStyle('auto'); });
    // style chip: auto (follows the theme) / light architectural / dark digital twin
    const styleSel = $('style-select');
    if (styleSel) {
      for (const [v, t] of [['auto', 'סגנון: לפי ערכת נושא'], ['light', `סגנון: ${STYLES.light.name}`], ['dark', `סגנון: ${STYLES.dark.name}`]]) { const o = el('option', '', t); o.value = v; styleSel.appendChild(o); }
      styleSel.value = this.styleChoice;
      styleSel.addEventListener('change', () => this.setStyle(styleSel.value));
      this.renderStyleChip = () => { styleSel.value = this.styleChoice; };
    }
    document.documentElement.dataset.style = this.style.id;
    const hud = $('hud');
    hud.classList.toggle('on', this.hudOn);
    const slider = $('sun-slider');
    slider.addEventListener('input', () => { this.env.setTime({ hour: slider.value / 60 }); this.updateSunCard(); this.invalidate(); this.userInput(); });
    $('sun-now').addEventListener('click', () => { const d = new Date(); slider.value = d.getHours() * 60 + d.getMinutes(); const start = new Date(d.getFullYear(), 0, 0); this.env.setTime({ hour: slider.value / 60, day: Math.floor((d - start) / 86400000) }); this.updateSunCard(); this.invalidate(); });
    const wx = $('weather');
    for (const [id, he] of WEATHER) { const c = el('button', 'chip', he); c.dataset.w = id; c.addEventListener('click', () => { this.env.setTime({ weather: id }); this.updateSunCard(); this.invalidate(); }); wx.appendChild(c); }
    for (const [he, hour] of [['צהריים', 12.5], ['שקיעה', 18.2], ['לילה', 22.5]]) { const c = el('button', 'chip', he); c.addEventListener('click', () => { slider.value = hour * 60; this.env.setTime({ hour }); this.updateSunCard(); this.invalidate(); }); wx.appendChild(c); }
    this.env.onTime = () => { this.updateSunCard(); if (this.planScene) this.planScene.setNight(this.env.recipe.night); };
    this.env.setTime({ hour: slider.value / 60, day: 278 });
    document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('sel', x === b));
      document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('sel', p.dataset.panel === b.dataset.tab));
    }));
    $('mobile-toggle').addEventListener('click', () => $('aside').classList.toggle('open'));
    $('sheet-handle').addEventListener('click', () => $('aside').classList.remove('open'));
    $('sun-row').addEventListener('click', (e) => { if (e.target.id === 'sun-now') return; $('sun-card').classList.toggle('open'); });
    $('labels').classList.toggle('temps', !!this.settings.showTemps);
    // phone walk: three floating buttons - exit, next saved position, panel (plan L10)
    const fabs = $('fabs');
    const fab = (txt, title, fn, cls = '') => { const b = el('button', 'fab ' + cls, txt); b.title = title; b.addEventListener('click', fn); fabs.insertBefore(b, fabs.firstChild); return b; };
    this.fabExit = fab('✕', 'יציאה מהסיור', () => this.exitWalk(), 'walk-only');
    this.fabPos = fab('⤼', 'העמדה השמורה הבאה', () => { if (!this.savedPositions.length) return; this.posIdx = ((this.posIdx ?? -1) + 1) % this.savedPositions.length; this.gotoPosition(this.savedPositions[this.posIdx]); }, 'walk-only');
    $('kiosk-exit').addEventListener('click', (e) => { e.preventDefault(); this.exitStills(true); });
    this.renderBar();
    this.bindStageInput();
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { this.touch = true; this.stage.classList.add('touch'); } });
  }
  updateSunCard() {
    const t = this.env.time, sp = this.env.sunInfo;
    $('sun-time').textContent = hourLabel(t.hour);
    const w = WEATHER.find((x) => x[0] === t.weather);
    const dir = sp ? (sp.azimuth < 90 ? 'מזרח' : sp.azimuth < 180 ? 'דרום־מזרח' : sp.azimuth < 270 ? 'דרום־מערב' : 'מערב') : '';
    $('sun-info').textContent = sp ? `${sp.elevation > 0 ? `שמש מ${dir} · גובה ${sp.elevation.toFixed(0)}°` : 'לילה · השמש מתחת לאופק'} · ${dateLabel(t.day)} · צפון התוכנית ${t.north}° · ${w ? w[1] : ''}` : '';
    document.querySelectorAll('#weather .chip[data-w]').forEach((c) => c.classList.toggle('sel', c.dataset.w === t.weather));
  }
  /** The floating view bar (plan L9): three views, the walk, one quality dropdown - nothing else over the scene. */
  renderBar() {
    const bar = $('bar');
    bar.innerHTML = '';
    if (!this.plan) return;
    const chip = (text, sel, fn, title) => { const c = el('button', 'chip' + (sel ? ' sel' : ''), text); if (title) c.title = title; c.addEventListener('click', fn); bar.appendChild(c); return c; };
    chip('מלמעלה', this.preset === 'top' && this.mode === 'orbit', () => this.toOrbit('top'));
    chip('איזומטרי', this.preset === 'iso' && this.mode === 'orbit', () => this.toOrbit('iso'));
    chip('פרספקטיבה', this.preset === 'persp' && this.mode === 'orbit', () => this.toOrbit('persp'));
    bar.appendChild(el('span', 'sep'));
    chip('סיור', this.mode === 'walk', () => (this.mode === 'walk' ? this.exitWalk() : this.enterWalk()), 'סיור בגובה עין');
    bar.appendChild(el('span', 'sep'));
    const q = document.createElement('select');
    q.className = 'chip';
    q.setAttribute('aria-label', 'איכות');
    for (const [qq, lite] of RUNGS) { const o = el('option', '', qq === 3 && lite ? LITE_HE : QUALITY_HE[qq]); o.value = `${qq}|${lite ? 1 : 0}`; if (qq === 0 && !this.bakes[this.currentLevelId()]) o.disabled = true; if (this.quality === qq && this.lite === lite) o.selected = true; q.appendChild(o); }
    q.addEventListener('change', () => { const [qq, l] = q.value.split('|'); this.setQuality(+qq, null, l === '1'); });
    bar.appendChild(q);
  }
  buildStrip() {
    const strip = $('strip');
    strip.innerHTML = '';
    const levels = this.plan.doc.levels.slice().reverse();
    const mk = (id, name) => {
      const b = el('button', this.levelMode === id ? 'sel' : '');
      const pic = el('span', 'pic');
      if (this.thumbs[id]) { const img = document.createElement('img'); img.src = this.thumbs[id]; pic.appendChild(img); }
      const dots = el('span', 'dots');
      const L = this.planScene.levels[id];
      if (L) {
        const lit = L.zones.some((z) => z.x_proto && this.entities[z.x_proto.light] === 'on');
        const pres = L.zones.some((z) => z.x_proto && z.x_proto.presence && this.entities[z.x_proto.presence] === 'on');
        const open = this.planScene.markers.some((m) => m.group.parent === L.group && m.group.visible);
        if (lit) { const i = el('i'); i.style.background = 'var(--sw-map-lit)'; dots.appendChild(i); }
        if (pres) { const i = el('i'); i.style.background = 'var(--sw-map-presence)'; dots.appendChild(i); }
        if (open) { const i = el('i'); i.style.background = 'var(--sw-danger)'; dots.appendChild(i); }
      }
      pic.appendChild(dots);
      b.appendChild(pic);
      b.appendChild(document.createTextNode(name));
      b.addEventListener('click', () => { if (this.mode === 'walk' || this.levelMode === id) return; this.flash(0.45); this.setLevelMode(id); this.fitCamera(this.preset); });
      strip.appendChild(b);
    };
    for (const l of levels) mk(l.id, l.name);
    mk('all', 'כל הקומות');
  }
  async makeThumbs() {
    if (this.quality === 0) return;
    const prevMode = this.levelMode;
    for (const l of this.plan.doc.levels) {
      this.planScene.showLevel(l.id, false);
      const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, -100, 300);
      const ext = this.visibleExtent();
      const cx = (ext.minX + ext.maxX) / 2, cz = (ext.minZ + ext.maxZ) / 2;
      const radius = Math.hypot(ext.maxX - ext.minX, ext.maxZ - ext.minZ) / 2 * 1.05;
      cam.left = -radius * 1.6; cam.right = radius * 1.6; cam.top = radius; cam.bottom = -radius;
      cam.position.set(cx + 40, ext.base + 40, cz + 40);
      cam.lookAt(cx, ext.base + 1, cz);
      cam.updateProjectionMatrix();
      this.planScene.update(0.016, cam.position, { nightFactor: this.env.recipe.night, lampShadows: false });
      this.thumbs[l.id] = this.baker.thumbnail(cam, 208, 112);
    }
    this.planScene.showLevel(prevMode, this.mode === 'walk');
    this.buildStrip();
    this.invalidate();
  }
  currentLevelId() {
    if (this.mode === 'walk' && this.walk) return this.walk.level;
    return this.levelMode === 'all' || !this.levelMode ? this.plan.doc.levels[0].id : this.levelMode;
  }

  // ---- states panel
  buildStatesPanel() {
    const host = $('panel-states');
    host.innerHTML = '';
    const names = this.plan.entityNames || {};
    const sw = (entity, cls, onVals = ['on'], offVal = 'off', onVal = 'on') => {
      const b = el('button', 'sw ' + (cls || ''));
      const sync = () => b.classList.toggle('on', onVals.includes(this.entities[entity]));
      sync();
      b.addEventListener('click', () => { this.setEntity(entity, onVals.includes(this.entities[entity]) ? offVal : onVal); sync(); });
      b.dataset.entity = entity;
      this._syncs = this._syncs || [];
      this._syncs.push(sync);
      return b;
    };
    const scenes = el('div', 'pcard');
    scenes.appendChild(el('h3', '', 'תרחישים'));
    const row = el('div', 'actions');
    row.style.display = 'flex'; row.style.gap = '6px'; row.style.flexWrap = 'wrap';
    const scene = (text, fn) => { const b = el('button', 'btn sm', text); b.addEventListener('click', () => { fn(); this.syncPanel(); }); row.appendChild(b); };
    scene('הכול כבוי', () => this.setMany((k) => k.startsWith('light.'), 'off'));
    scene('ערב בבית', () => { this.setMany((k) => k.startsWith('light.'), 'on'); $('sun-slider').value = 19 * 60; this.env.setTime({ hour: 19 }); this.updateSunCard(); });
    scene('לילה', () => { this.setMany((k) => k.startsWith('light.'), 'off'); this.setEntity('light.hall', 'on'); this.setEntity('light.upper_corridor', 'on'); $('sun-slider').value = 23 * 60; this.env.setTime({ hour: 23 }); this.updateSunCard(); });
    scene('פתח הכול', () => this.setMany((k) => k.startsWith('binary_sensor.') && k.endsWith('_door'), 'on'));
    scene('סגור הכול', () => this.setMany((k) => k.startsWith('binary_sensor.') && k.endsWith('_door'), 'off'));
    scenes.appendChild(row);
    host.appendChild(scenes);
    // the floors / areas tree (owner rule: survives every design): one collapsible card per floor, rooms inside
    this.treeCollapsed = this.treeCollapsed || {};
    for (const lv of this.plan.doc.levels) {
      const card = el('div', 'pcard tree' + (this.treeCollapsed[lv.id] ? ' collapsed' : ''));
      const h = el('h3');
      h.appendChild(el('span', 'tw', '▼'));
      h.appendChild(document.createTextNode(lv.name));
      h.appendChild(el('span', 'muted', `מפלס ${lv.elevation_m.toFixed(1)} מ׳`));
      h.addEventListener('click', () => { this.treeCollapsed[lv.id] = !this.treeCollapsed[lv.id]; card.classList.toggle('collapsed', this.treeCollapsed[lv.id]); });
      card.appendChild(h);
      const body = el('div', 'body');
      card.appendChild(body);
      const zones = this.plan.zones.filter((z) => z.level_id === lv.id);
      if (!zones.length) body.appendChild(el('div', 'help', 'אין חדרים מוגדרים בקובץ זה — המצבים מתוך הישויות בלבד.'));
      for (const z of zones) {
        const r = el('div', 'room');
        const n = el('div', 'name', z.name);
        if (z.x_proto && typeof z.x_proto.temp === 'number') n.appendChild(el('span', 't', `${z.x_proto.temp.toFixed(1)}°`));
        n.style.cursor = 'pointer';
        n.title = 'עמוד בחדר';
        n.addEventListener('click', () => { const L = this.planScene.levels[lv.id]; const zz = L && L.zones.find((x) => x.id === z.id); if (zz) this.standInRoom(L, zz); });
        r.appendChild(n);
        const xp = z.x_proto || {};
        if (xp.light) { const d = el('div', 'dev'); d.appendChild(el('span', 'lbl2', names[xp.light] || xp.light)); d.appendChild(sw(xp.light)); r.appendChild(d); }
        for (const l of this.planScene.lamps.filter((l) => l.level === lv.id && l.entity !== xp.light && this.lampInZone(l, z))) { const d = el('div', 'dev'); d.appendChild(el('span', 'lbl2', names[l.entity] || l.entity)); d.appendChild(sw(l.entity)); r.appendChild(d); }
        if (xp.presence) { const d = el('div', 'dev'); d.appendChild(el('span', 'lbl2', names[xp.presence] || xp.presence)); const b = el('button', 'btn sm', 'דמה תנועה'); b.addEventListener('click', () => this.pulsePresence(xp.presence)); d.appendChild(b); d.appendChild(sw(xp.presence, '')); r.appendChild(d); }
        body.appendChild(r);
      }
      host.appendChild(card);
    }
    const doors = el('div', 'pcard');
    doors.appendChild(el('h3', '', 'דלתות ומנעולים'));
    for (const o of this.plan.doc.openings.filter((o) => o.kind === 'door' && o.anchor_ref)) {
      const ent = o.anchor_ref.resource_id;
      const d = el('div', 'dev');
      d.appendChild(el('span', 'lbl2', names[ent] || ent));
      if (ent.startsWith('lock.')) d.appendChild(sw(ent, 'danger', ['locked'], 'unlocked', 'locked'));
      else d.appendChild(sw(ent, 'danger', ['on', 'open'], 'off', 'on'));
      doors.appendChild(d);
      const lock = this.plan.doorLocks && this.plan.doorLocks[o.id];
      if (lock) { const d2 = el('div', 'dev'); d2.appendChild(el('span', 'lbl2', names[lock] || lock)); d2.appendChild(sw(lock, 'danger', ['locked'], 'unlocked', 'locked')); doors.appendChild(d2); }
    }
    host.appendChild(doors);
    const covers = Object.keys(this.entities).filter((k) => k.startsWith('cover.'));
    if (covers.length) {
      const cc = el('div', 'pcard');
      cc.appendChild(el('h3', '', 'תריסים'));
      for (const c of covers) {
        const d = el('div', 'dev');
        d.appendChild(el('span', 'lbl2', names[c] || c));
        const rg = document.createElement('input');
        rg.type = 'range'; rg.min = 0; rg.max = 100; rg.className = 'pos'; rg.value = this.coverPositions[c] ?? (this.entities[c] === 'open' ? 100 : 0);
        rg.addEventListener('input', () => { this.coverPositions[c] = +rg.value; this.setEntity(c, +rg.value > 0 ? 'open' : 'closed'); });
        d.appendChild(rg);
        cc.appendChild(d);
      }
      host.appendChild(cc);
    }
    const media = Object.keys(this.entities).filter((k) => k.startsWith('media_player.'));
    if (media.length) {
      const mc = el('div', 'pcard');
      mc.appendChild(el('h3', '', 'מדיה'));
      for (const m of media) { const d = el('div', 'dev'); d.appendChild(el('span', 'lbl2', names[m] || m)); d.appendChild(sw(m, '', ['playing', 'on'], 'off', 'playing')); mc.appendChild(d); }
      host.appendChild(mc);
    }
  }
  lampInZone(l, z) {
    const poly = z.polygon.map((p) => this.planScene.toM([p.x, p.y]));
    return pointInPolygon(l.pos.x, l.pos.z, poly);
  }
  syncPanel() { for (const s of this._syncs || []) s(); this.buildStrip(); }
  setMany(pred, value) { for (const k of Object.keys(this.entities)) if (pred(k)) this.entities[k] = value; this.applyStates(); }
  setEntity(entity, value) { this.entities[entity] = value; this.applyStates(); this.syncPanel(); }
  applyStates() {
    this.planScene.setStates(this.entities, this.coverPositions);
    this.invalidate();
    if (this.mode === 'stills') this.showStills();
    if (this.walk) this.walk.path = null;
  }
  pulsePresence(entity) {
    this.setEntity(entity, 'on');
    clearTimeout(this.presenceTimers[entity]);
    this.presenceTimers[entity] = setTimeout(() => this.setEntity(entity, 'off'), 12000);
  }

  // ---- walk panel
  buildWalkPanel() {
    const host = $('panel-walk');
    host.innerHTML = '';
    const c1 = el('div', 'pcard');
    c1.appendChild(el('h3', '', 'סיור בגובה עין'));
    const start = el('button', 'btn primary', this.mode === 'walk' ? 'יציאה מהסיור' : 'התחל סיור');
    start.addEventListener('click', () => (this.mode === 'walk' ? this.exitWalk() : this.enterWalk()));
    c1.appendChild(start);
    const tg = el('div', 'toggles');
    tg.style.marginTop = '8px';
    const eye = document.createElement('input');
    eye.type = 'range'; eye.min = 1.2; eye.max = 2.0; eye.step = 0.05; eye.value = this.settings.eyeHeight; eye.className = 'pos';
    const eyeL = el('span', '', `גובה עין ${(+eye.value).toFixed(2)} מ׳`);
    eye.addEventListener('input', () => { eyeL.textContent = `גובה עין ${(+eye.value).toFixed(2)} מ׳`; this.settings.eyeHeight = +eye.value; this.saveSettings(); if (this.walk) { this.walk.eyeTarget = +eye.value; this.invalidate(); } });
    tg.appendChild(eyeL); tg.appendChild(eye);
    const mm = document.createElement('select');
    mm.className = 'inline';
    for (const [v, t] of [['drag', 'גרירה'], ['lock', 'נעילת סמן'], ['auto', 'אוטומטי']]) { const o = el('option', '', t); o.value = v; if (v === this.settings.mouseMode) o.selected = true; mm.appendChild(o); }
    mm.addEventListener('change', () => { this.settings.mouseMode = mm.value; this.saveSettings(); if (document.pointerLockElement) document.exitPointerLock(); });
    tg.appendChild(el('span', '', 'מבט בעכבר')); tg.appendChild(mm);
    c1.appendChild(tg);
    host.appendChild(c1);
    const c2 = el('div', 'pcard');
    c2.appendChild(el('h3', '', 'עמדות שמורות'));
    const list = el('div', 'list');
    this.savedPositions.forEach((p, i) => {
      const b = el('button', '', `${p.name} · ${this.levelName(p.level_id)}`);
      b.appendChild(el('span', 'k', String(i + 1)));
      b.addEventListener('click', () => this.gotoPosition(p));
      list.appendChild(b);
    });
    c2.appendChild(list);
    host.appendChild(c2);
    const c3 = el('div', 'pcard');
    c3.appendChild(el('h3', '', 'עמוד ב…'));
    const l3 = el('div', 'list');
    for (const c of this.planScene.cameras) { const b = el('button', '', `📷 ${c.label}`); b.addEventListener('click', () => this.standAtCamera(c)); l3.appendChild(b); }
    for (const L of Object.values(this.planScene.levels)) for (const z of L.zones) { const b = el('button', '', `${z.name} · ${L.name}`); b.addEventListener('click', () => this.standInRoom(L, z)); l3.appendChild(b); }
    c3.appendChild(l3);
    host.appendChild(c3);
  }
  levelName(id) { const l = this.plan.doc.levels.find((x) => x.id === id); return l ? l.name : id; }

  // ---- quality panel
  buildQualityPanel() {
    const host = $('panel-quality');
    host.innerHTML = '';
    // ---- the settings list the product port must expose (owner answers; clean operator screens: management here only)
    const s0 = el('div', 'pcard');
    s0.appendChild(el('h3', '', 'תצוגה'));
    const st = el('div', 'toggles');
    const sel = (key, label, options, fn) => { const s = document.createElement('select'); s.className = 'inline'; for (const [v, t] of options) { const o = el('option', '', t); o.value = v; if (String(v) === String(this.settings[key])) o.selected = true; s.appendChild(o); } s.addEventListener('change', () => { this.settings[key] = s.value; this.saveSettings(); fn && fn(s.value); }); st.appendChild(el('span', '', label)); st.appendChild(s); return s; };
    const tog = (key, label, fn) => { const b = el('button', 'sw' + (this.settings[key] ? ' on' : '')); b.addEventListener('click', () => { this.settings[key] = !this.settings[key]; b.classList.toggle('on', this.settings[key]); this.saveSettings(); fn && fn(this.settings[key]); }); st.appendChild(el('span', '', label)); st.appendChild(b); };
    sel('defaultView', 'תצוגה בכניסה (לכולם: סכמטי)', [['schematic', 'סכמטי'], ['realistic', 'ריאליסטי']]);
    sel('wallDisplay', 'תצוגת קיר', [['live', 'תלת־ממד חי'], ['stills', 'תמונה מוכנה']]);
    sel('furnitureMode', 'ריהוט', [['procedural', 'מובנה (פרוצדורלי)'], ['models', 'מודלים (כשקיימים)']], (v) => { this.planScene.furnitureMode = v; this.rebuild(); this.makeThumbs(); });
    sel('timeSource', 'שעה ביום', [['clock', 'שעון האתר'], ['manual', 'ידני (המחוון)']], (v) => { if (v === 'clock') $('sun-now').click(); });
    tog('sectionCut', 'חתך קומה במבטי המעוף', () => this.applyCut());
    tog('showTemps', 'טמפרטורה על כל חדר', (v) => $('labels').classList.toggle('temps', v));
    tog('motion', 'מעברים מונפשים');
    s0.appendChild(st);
    host.appendChild(s0);
    const c1 = el('div', 'pcard tree collapsed');
    const h1 = el('h3'); h1.appendChild(el('span', 'tw', '▼')); h1.appendChild(document.createTextNode('איכות וביצועים'));
    h1.addEventListener('click', () => c1.classList.toggle('collapsed'));
    c1.appendChild(h1);
    const b1 = el('div', 'body');
    c1.appendChild(b1);
    this.ladderEl = el('div', 'ladder');
    b1.appendChild(this.ladderEl);
    b1.appendChild(el('div', 'help', `נמדד ${PROBE_MS / 1000} שניות אחרי 3 פריימים; מתחת ל־${MIN_FPS} fps יורדים שלב ונשארים שם להמשך ההפעלה. בחירה ידנית מודדת מחדש.`));
    const tg = el('div', 'toggles');
    const opt = (key, label, fn) => { const b = el('button', 'sw' + (this.opts[key] ? ' on' : '')); b.addEventListener('click', () => { this.opts[key] = !this.opts[key]; b.classList.toggle('on', this.opts[key]); (fn || (() => this.rebuild()))(); }); tg.appendChild(el('span', '', label)); tg.appendChild(b); };
    opt('autoLadder', 'ירידה אוטומטית ברמה', () => {});
    opt('reflections', 'השתקפות רצפה (ריאליסטי · יקר)');
    opt('ao', 'חסימת סביבה GTAO (ריאליסטי)', () => { this.env.post.ao = this.opts.ao; this.env.buildComposer(this.camera); this.invalidate(); });
    opt('bloom', 'זוהר מנורות (bloom)', () => { this.env.post.bloom = this.opts.bloom; this.env.buildComposer(this.camera); this.invalidate(); });
    opt('lampShadows', 'צללים ממנורות (2 הקרובות)');
    const hudB = el('button', 'sw' + (this.hudOn ? ' on' : ''));
    hudB.addEventListener('click', () => { this.hudOn = !this.hudOn; hudB.classList.toggle('on', this.hudOn); $('hud').classList.toggle('on', this.hudOn); });
    tg.appendChild(el('span', '', 'נתוני ביצועים על המסך (למפתחים)')); tg.appendChild(hudB);
    b1.appendChild(tg);
    const dprRow = el('div', 'toggles');
    const dpr = document.createElement('select');
    dpr.className = 'inline';
    for (const v of [1, 1.25, 1.5, 2]) { const o = el('option', '', `עד ${v}×`); o.value = v; if (v === this.opts.dprCap) o.selected = true; dpr.appendChild(o); }
    dpr.addEventListener('change', () => { this.opts.dprCap = +dpr.value; this.resize(); });
    dprRow.appendChild(el('span', '', 'יחס פיקסלים')); dprRow.appendChild(dpr);
    b1.appendChild(dprRow);
    host.appendChild(c1);
    const c2 = el('div', 'pcard');
    c2.appendChild(el('h3', '', 'תמונות מוכנות לתצוגת קיר'));
    const bake = el('button', 'btn primary', 'הכן תמונות לקומה הנוכחית');
    const prog = el('div', 'progress'); const bar = el('i'); prog.appendChild(bar);
    bake.addEventListener('click', () => this.bakeCurrent(bake, bar));
    c2.appendChild(bake); c2.appendChild(prog);
    const bakeAll = el('button', 'btn sm', 'הכן לכל הקומות');
    bakeAll.style.marginTop = '6px';
    bakeAll.addEventListener('click', async () => { for (const l of this.plan.doc.levels) { this.setLevelMode(l.id); await this.bakeCurrent(bake, bar); } });
    c2.appendChild(bakeAll);
    const idle = el('div', 'toggles');
    idle.style.marginTop = '8px';
    const idleSel = document.createElement('select');
    idleSel.className = 'inline';
    for (const [v, t] of [[0, 'כבוי'], [10, '10 ש׳'], [30, '30 ש׳'], [120, '2 דק׳'], [600, '10 דק׳']]) { const o = el('option', '', t); o.value = v; if (v === this.opts.idleS) o.selected = true; idleSel.appendChild(o); }
    idleSel.addEventListener('change', () => { this.opts.idleS = +idleSel.value; });
    idle.appendChild(el('span', '', 'מעבר לתמונה אחרי חוסר פעילות')); idle.appendChild(idleSel);
    c2.appendChild(idle);
    const show = el('button', 'btn sm', 'הצג תמונות מוכנות עכשיו');
    show.style.marginTop = '6px';
    show.addEventListener('click', () => this.setQuality(0));
    c2.appendChild(show);
    host.appendChild(c2);
    this.renderLadder();
  }
  renderLadder() {
    if (!this.ladderEl) return;
    this.ladderEl.innerHTML = '';
    const rungs = [...RUNGS.map(([q, l]) => [q, l, q === 3 && l ? LITE_HE : QUALITY_HE[q]]), [-1, false, '2D']];
    rungs.forEach(([q, l, t], i) => {
      const s = el('span', q === this.quality && l === this.lite ? 'on' : '', t);
      if (q >= 0) s.addEventListener('click', () => this.setQuality(q, null, l));
      if (q === -1) s.style.cursor = 'default';
      if (this.stage.dataset.fallback && i < +this.stage.dataset.fallback) s.classList.add('down');
      this.ladderEl.appendChild(s);
      if (i < rungs.length - 1) this.ladderEl.appendChild(el('span', '', '←'));
    });
    if (this.lastProbe) this.ladderEl.appendChild(el('div', 'help', `מדידה אחרונה: ${this.lastProbe.fps} fps ברמה "${this.lastProbe.label}"`));
  }

  // ------------------------------------------------------------------ stills / kiosk
  async bakeCurrent(btn, bar) {
    if (this.quality === 0) this.exitStills(false);
    const level = this.currentLevelId();
    const prevLevel = this.levelMode, prevMode = this.mode;
    if (this.mode === 'walk') this.exitWalk();
    this.setLevelMode(level);
    btn.disabled = true;
    const savedEntities = { ...this.entities }, savedHour = this.env.time.hour;
    const cam = new THREE.PerspectiveCamera(38, 1.6, 0.1, 300);
    const ext = this.visibleExtent();
    const cx = (ext.minX + ext.maxX) / 2, cz = (ext.minZ + ext.maxZ) / 2;
    const radius = Math.hypot(ext.maxX - ext.minX, ext.maxZ - ext.minZ, ext.top) / 2;
    const dist = (radius / Math.tan((cam.fov * Math.PI) / 360)) * 1.1;
    cam.position.set(cx + dist * 0.6, ext.base + dist * 0.6, cz + dist * 0.6);
    cam.lookAt(cx, ext.base + 1, cz);
    const markers = this.planScene.markers.filter((m) => m.group.parent === this.planScene.levels[level].group).map((m) => {
      const pts = [];
      m.group.children.forEach((c) => { c.geometry.computeBoundingBox(); const b = c.geometry.boundingBox; pts.push(new THREE.Vector3(b.min.x, b.min.y, b.min.z), new THREE.Vector3(b.max.x, b.max.y, b.max.z), new THREE.Vector3(b.min.x, b.max.y, b.max.z), new THREE.Vector3(b.max.x, b.min.y, b.min.z), new THREE.Vector3(b.min.x, b.max.y, b.min.z), new THREE.Vector3(b.max.x, b.max.y, b.min.z), new THREE.Vector3(b.min.x, b.min.y, b.max.z), new THREE.Vector3(b.max.x, b.min.y, b.max.z)); });
      return { entity: m.entity, points: pts };
    });
    let step = 0;
    const apply = (variant) => {
      const night = variant.startsWith('night');
      const on = variant.endsWith('_on');
      this.env.setTime({ hour: night ? 22.5 : 14 });
      for (const k of Object.keys(this.entities)) if (k.startsWith('light.')) this.entities[k] = on ? 'on' : 'off';
      for (const m of this.planScene.markers) m.group.visible = false;
      for (const p of this.planScene.presence) p.mesh.visible = false;
      this.planScene.setStates(this.entities, this.coverPositions, true);
      for (const m of this.planScene.markers) m.group.visible = false;
      for (const p of this.planScene.presence) p.mesh.visible = false;
      this.planScene.update(1, cam.position, { nightFactor: night ? 1 : 0, lampShadows: false });
      this.planScene.update(1, cam.position, { nightFactor: night ? 1 : 0, lampShadows: false });
      bar.style.width = `${(++step / 4) * 100}%`;
    };
    const set = await this.baker.bake(level, cam, 1280, 800, apply, markers);
    this.bakes[level] = set;
    Object.assign(this.entities, savedEntities);
    this.env.setTime({ hour: savedHour });
    this.planScene.setStates(this.entities, this.coverPositions, true);
    this.thumbs[level] = set.pics.day_on;
    bar.style.width = '0';
    btn.disabled = false;
    this.renderBar();
    this.buildStrip();
    this.toast(`הוכנו 4 תמונות + ${set.masks.length} מסכות לקומה "${this.levelName(level)}"`);
    if (prevLevel !== level) this.setLevelMode(prevLevel);
    void prevMode;
    this.invalidate();
  }
  enterStills() {
    this.mode = 'stills';
    this.stage.classList.add('stills');
    this.continuous = false;
    this.showStills();
    this.renderBar();
  }
  showStills() {
    const set = this.bakes[this.currentLevelId()];
    renderStills($('stills'), set, { night: this.env.recipe.night > 0.5 || this.env.sunInfo.elevation < 0, entities: this.entities });
    $('labels').innerHTML = '';
  }
  exitStills(toLive) {
    this.stage.classList.remove('stills');
    this.mode = 'orbit';
    if (toLive && this.quality === 0) { this.quality = this.lastLiveQuality || 2; this.lite = !!this.lastLiveLite; this.rebuild(); this.renderBar(); this.renderLadder(); }
    this.invalidate();
  }

  // ------------------------------------------------------------------ walk
  enterWalk() {
    if (this.mode === 'stills') this.exitStills(true);
    this.mode = 'walk';
    this.stage.classList.add('walk');
    this.orbitState = { camera: this.camera, preset: this.preset, levelMode: this.levelMode };
    if (!this.walk) { this.walk = new WalkController(this.planScene); this.walk.onLevelChange = (id) => this.onWalkLevel(id); }
    this.walk.scene = this.planScene;
    this.walk.eye = this.settings.eyeHeight;
    this.walk.eyeTarget = this.settings.eyeHeight;
    const fromCam = this.camera && this.camera !== this.walkCam ? { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone() } : null;
    const def = this.savedPositions.find((p) => p.is_default) || this.savedPositions[0];
    if (def) this.gotoPosition(def, true);
    else {
      const L = this.planScene.levels[this.currentLevelId()];
      const z = L.zones[0];
      const c = z ? polygonCentroid(z.polyM) : [(L.extent.minX + L.extent.maxX) / 2, (L.extent.minZ + L.extent.maxZ) / 2];
      this.walk.placeAt(c[0], c[1], 0, L.id);
    }
    // FOV per device (plan P5): 62 on a desktop, 70 on a touch device, 76 in portrait (the room must still read)
    const portrait = this.canvas.clientHeight > this.canvas.clientWidth;
    this.walkCam.fov = portrait ? 76 : this.touch ? 70 : 62;
    this.walkCam.near = 0.06;
    this.walkCam.updateProjectionMatrix();
    this.camera = this.walkCam;
    // fly-down into the eye position (plan L11): 650 ms from the orbit camera's pose to the walk pose
    if (fromCam && this.settings.motion) {
      this.walkCam.position.set(this.walk.x, this.walk.eyeY(), this.walk.z);
      this.walkCam.rotation.order = 'YXZ';
      this.walkCam.rotation.set(this.walk.pitch, this.walk.yaw, 0);
      const toPos = this.walkCam.position.clone(), toQuat = this.walkCam.quaternion.clone();
      const cam = this.walkCam;
      this.tween = { t0: performance.now(), ms: 650, pose: true, step: (k) => { cam.position.lerpVectors(fromCam.pos, toPos, k); cam.quaternion.slerpQuaternions(fromCam.quat, toQuat, k); } };
    }
    if (this.controls) this.controls.enabled = false;
    this.planScene.showLevel('all', true);
    this.planScene.setCut(null);
    this.env.setCamera(this.walkCam);
    this.env.interior = true;
    this.env.interiorFill = 0.6;
    this.env.applyTime();
    this.continuous = true;
    this.renderBar();
    this.buildWalkPanel();
    this.updateWalkBar();
    this.invalidate();
    this.canvas.focus && this.canvas.focus();
  }
  exitWalk() {
    if (document.pointerLockElement) document.exitPointerLock();
    this.mode = 'orbit';
    this.stage.classList.remove('walk');
    const st = this.orbitState || {};
    this.levelMode = st.levelMode || this.plan.doc.levels[0].id;
    this.planScene.showLevel(this.levelMode, false);
    this.buildStrip();
    this.fitCamera(st.preset || 'iso');
    this.env.interior = false;
    this.env.interiorFill = 1;
    this.env.applyTime();
    this.applyCut();
    this.continuous = false;
    this.renderBar();
    this.buildWalkPanel();
    this.invalidate();
  }
  onWalkLevel(id) {
    this.levelMode = id;
    this.buildStrip();
    this.toast(`${this.levelName(id)}`);
    $('mm-level').textContent = this.levelName(id);
  }
  gotoPosition(p, silent) {
    const [x, z] = this.planScene.toM([p.x, p.y]);
    if (this.mode !== 'walk') this.enterWalk();
    this.teleport(() => { this.walk.placeAt(x, z, p.heading_deg || 0, p.level_id); this.planScene.showLevel('all', true); }, silent);
    $('mm-level').textContent = this.levelName(this.walk.level);
  }
  teleport(fn, silent) {
    const f = $('fade');
    if (silent) { fn(); this.invalidate(); return; }
    f.style.opacity = '1';
    setTimeout(() => { fn(); this.invalidate(); setTimeout(() => (f.style.opacity = '0'), 60); }, 160);
  }
  standAtCamera(c) {
    if (this.mode !== 'walk') this.enterWalk();
    this.teleport(() => {
      const L = this.planScene.levels[c.level];
      this.walk.placeAt(c.pos[0] + c.fwd[0] * 0.35, c.pos[1] + c.fwd[1] * 0.35, (Math.atan2(-c.fwd[0], -c.fwd[1]) * 180) / Math.PI, c.level);
      this.walk.yaw = Math.atan2(-c.fwd[0], -c.fwd[1]);
      this.walk.pitch = (-c.tilt * Math.PI) / 180;
      this.walk.eyeOverride = L.elevation + c.mount;
    });
    this.toast(`עומד ב${c.label} — גובה ${c.mount.toFixed(1)} מ׳, ההליכה הראשונה מחזירה לגובה העין`);
  }
  standInRoom(L, z) {
    if (this.mode !== 'walk') this.enterWalk();
    const [cx, cz] = polygonCentroid(z.polyM);
    // face the longest wall of the room
    let best = 0, len = 0;
    for (let i = 0; i < z.polyM.length; i++) { const a = z.polyM[i], b = z.polyM[(i + 1) % z.polyM.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > len) { len = l; best = Math.atan2(-((a[0] + b[0]) / 2 - cx), -((a[1] + b[1]) / 2 - cz)); } }
    this.teleport(() => this.walk.placeAt(cx, cz, (best * 180) / Math.PI, L.id));
  }
  updateWalkBar() {
    if (!this.walk) return;
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#walkbar')) return;
    $('wx').value = this.walk.x.toFixed(2);
    $('wz').value = this.walk.z.toFixed(2);
    $('wh').value = Math.round((((this.walk.yaw * 180) / Math.PI) % 360 + 360) % 360);
    const L = this.planScene.levels[this.walk.level];
    const room = L.zones.find((z) => pointInPolygon(this.walk.x, this.walk.z, z.polyM));
    $('roomname').textContent = `${room ? room.name + ' · ' : ''}${L.name}${this.walk.onStairs ? ' · מדרגות' : ''}${this.walk.edge ? ' · קצה התוכנית' : ''}`;
    $('mm-level').textContent = L.name;
  }
  requestPointerLock(quiet = false) {
    if (this.mode !== 'walk') this.enterWalk();
    const p = this.canvas.requestPointerLock && this.canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => { if (!quiet) this.toast('נעילת סמן לא זמינה כאן — נשארים בגרירה'); });
    setTimeout(() => { if (!document.pointerLockElement && !quiet) this.toast('נעילת סמן לא זמינה כאן — נשארים בגרירה'); }, 300);
  }

  // ------------------------------------------------------------------ stage input (orbit picking, walk controls, touch)
  bindStageInput() {
    const c = this.canvas;
    c.tabIndex = 0;
    const keys = new Set();
    const applyKeys = () => {
      if (!this.walk || this.mode !== 'walk') return;
      const i = this.walk.input;
      i.fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      i.strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      i.turn = (keys.has('KeyQ') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyE') || keys.has('ArrowRight') ? 1 : 0);
      i.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
      if (i.fwd || i.strafe) this.walk.path = null;
    };
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
      this.userInput();
      if (e.code === 'Escape') { if (this.mode === 'walk') this.exitWalk(); return; }
      if (e.code === 'Digit3' && this.mode !== 'walk') return;
      if (this.mode !== 'walk') return;
      if (/^Digit[1-9]$/.test(e.code)) { const p = this.savedPositions[+e.code.slice(5) - 1]; if (p) this.gotoPosition(p); return; }
      if (e.code === 'Enter') { this.actOnCrosshair(); return; }
      keys.add(e.code);
      applyKeys();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { keys.delete(e.code); applyKeys(); });
    window.addEventListener('blur', () => { keys.clear(); applyKeys(); });
    // pointer: drag to look in walk, click to pick / walk-to
    let down = null;
    c.addEventListener('pointerdown', (e) => {
      this.userInput();
      if (this.mode === 'stills') return;
      down = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId, t: performance.now(), touch: e.pointerType === 'touch' };
      if (this.mode === 'walk' && !(e.pointerType === 'touch' && this.joyActive)) c.setPointerCapture(e.pointerId);
      // mouse-look mode (owner Q5): drag by default; 'lock' asks for pointer lock on the first click in the walk
      if (this.mode === 'walk' && e.pointerType === 'mouse' && this.settings.mouseMode !== 'drag' && !document.pointerLockElement) this.requestPointerLock(this.settings.mouseMode === 'auto');
    });
    c.addEventListener('pointermove', (e) => {
      if (this.mode === 'walk' && document.pointerLockElement === c) { this.walk.look(e.movementX * 0.0025, e.movementY * 0.0025); this.invalidate(); return; }
      if (!down || down.id !== e.pointerId) { if (this.mode !== 'walk') this.hoverAt(e); return; }
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 6) down.moved = true;
      if (this.mode === 'walk' && down.moved) {
        const k = down.touch ? 0.004 : 0.0028;
        this.walk.look(dx * k, dy * k);
        down.x = e.clientX; down.y = e.clientY;
        this.invalidate();
      }
    });
    const up = (e) => {
      if (!down || down.id !== e.pointerId) return;
      const d = down; down = null;
      if (this.mode === 'stills') return;
      if (!d.moved) this.clickAt(e, d.touch, performance.now() - d.t > 500);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', () => (down = null));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', () => this.userInput(), { passive: true });
    // virtual joystick
    const joy = $('joystick'), knob = $('knob');
    let jId = null, jc = null;
    joy.addEventListener('pointerdown', (e) => { jId = e.pointerId; const r = joy.getBoundingClientRect(); jc = [r.left + r.width / 2, r.top + r.height / 2]; joy.setPointerCapture(e.pointerId); this.joyActive = true; this.userInput(); });
    joy.addEventListener('pointermove', (e) => {
      if (e.pointerId !== jId || !this.walk) return;
      let dx = e.clientX - jc[0], dy = e.clientY - jc[1];
      const d = Math.hypot(dx, dy), max = 40;
      if (d > max) { dx *= max / d; dy *= max / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dead = 8;
      const nx = Math.abs(dx) < dead ? 0 : dx / max, ny = Math.abs(dy) < dead ? 0 : dy / max;
      this.walk.input.fwd = -ny; this.walk.input.strafe = nx; this.walk.path = null;
      this.invalidate();
    });
    const joyEnd = (e) => { if (e.pointerId !== jId) return; jId = null; this.joyActive = false; knob.style.transform = ''; if (this.walk) { this.walk.input.fwd = 0; this.walk.input.strafe = 0; } };
    joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
    // minimap teleport
    $('minimap').querySelector('canvas').addEventListener('click', (e) => {
      if (!this.walk || !this.mmMap) return;
      const r = e.currentTarget.getBoundingClientRect();
      const [x, z] = this.mmMap.invert(((e.clientX - r.left) / r.width) * 336, ((e.clientY - r.top) / r.height) * 336);
      this.teleport(() => { this.walk.placeAt(x, z, (this.walk.yaw * 180) / Math.PI, this.walk.level); });
    });
    // walk bar numeric fields
    const applyFields = () => { if (!this.walk) return; this.walk.placeAt(+$('wx').value, +$('wz').value, +$('wh').value, this.walk.level); this.invalidate(); };
    for (const id of ['wx', 'wz', 'wh']) $(id).addEventListener('change', applyFields);
    $('walk-save').addEventListener('click', () => {
      if (!this.walk) return;
      const L = this.planScene.levels[this.walk.level];
      const room = L.zones.find((z) => pointInPolygon(this.walk.x, this.walk.z, z.polyM));
      const name = prompt('שם העמדה', room ? room.name : `עמדה ${this.savedPositions.length + 1}`);
      if (!name) return;
      const n = [this.walk.x / (this.planScene.W * this.planScene.scale), this.walk.z / (this.planScene.H * this.planScene.scale)];
      this.savedPositions.push({ id: `wp-${Date.now()}`, name, level_id: this.walk.level, x: n[0], y: n[1], heading_deg: Math.round((this.walk.yaw * 180) / Math.PI), is_default: false });
      try { localStorage.setItem(`studio6.positions.${this.plan.id}`, JSON.stringify(this.savedPositions)); } catch { /* ignore */ }
      this.buildWalkPanel();
      this.toast(`נשמרה העמדה "${name}"`);
    });
    $('walk-exit').addEventListener('click', () => this.exitWalk());
    document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement === c) this.toast('נעילת סמן פעילה — Esc לשחרור'); });
    window.addEventListener('pointerdown', () => this.userInput(), true);
  }
  userInput() { this.lastInput = performance.now(); if (this.mode === 'stills' && this.quality === 0 && this.kioskAuto) { this.kioskAuto = false; this.exitStills(true); } }
  ndc(e) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  }
  hoverAt(e) {
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const hit = this.planScene.pick(this.raycaster);
    const key = hit ? hit.entity || hit.id : null;
    if (key !== this.hover) { this.hover = key; this.canvas.style.cursor = hit ? 'pointer' : ''; this.invalidate(); }
  }
  clickAt(e, touch, long) {
    this.raycaster.setFromCamera(this.mode === 'walk' && !touch && document.pointerLockElement ? new THREE.Vector2(0, 0) : this.ndc(e), this.camera);
    const hit = this.planScene.pick(this.raycaster);
    if (hit && (this.mode !== 'walk' || long || !touch || hit.distance < 3)) { this.showPopover(hit, e); return; }
    this.hidePopover();
    if (this.mode === 'walk') {
      // tap / click on the floor → walk there
      const floors = [];
      this.planScene.root.traverse((o) => { if (o.userData && (o.userData.kind === 'floor' || o.userData.kind === 'static') && o.visible) floors.push(o); });
      const hits = this.raycaster.intersectObjects(floors, false);
      const h = hits.find((x) => x.object.userData.kind === 'floor' && x.face && x.face.normal.y > 0.5) || hits[0];
      if (h && h.object.userData.kind === 'floor') {
        if (h.object.userData.level !== this.walk.level) { this.toast('הנקודה בקומה אחרת — השתמש במדרגות'); return; }
        const path = this.walk.pathTo(h.point.x, h.point.z);
        if (!path) this.toast('אין מסלול פתוח לנקודה (דלת סגורה?)');
        this.invalidate();
      }
    }
  }
  actOnCrosshair() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.walkCam);
    const hit = this.planScene.pick(this.raycaster);
    if (hit && hit.distance < 3.5) this.showPopover(hit, { clientX: this.canvas.clientWidth / 2 + this.stage.getBoundingClientRect().left, clientY: this.canvas.clientHeight / 2 + this.stage.getBoundingClientRect().top });
  }
  /** Crosshair + action hint (plan P5): the crosshair grows over a device within 3.5 m and names it (short, no paragraph). */
  updateAim() {
    if (this.mode !== 'walk' || this.touch) { if (this.aimKey) { this.aimKey = null; this.stage.classList.remove('aim'); } return; }
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.walkCam);
    const hit = this.planScene.pick(this.raycaster);
    const key = hit && hit.distance < 3.5 ? (hit.entity || hit.id) : null;
    if (key === this.aimKey) return;
    this.aimKey = key;
    this.stage.classList.toggle('aim', !!key);
    if (key) { const names = this.plan.entityNames || {}; $('aimhint').textContent = `${hit.label || names[hit.entity] || hit.entity || hit.id} · Enter`; }
  }
  showPopover(hit, e) {
    this.hidePopover();
    const p = el('div', 'popover');
    const r = this.stage.getBoundingClientRect();
    p.style.left = `${Math.min(r.width - 230, Math.max(8, e.clientX - r.left - 100))}px`;
    p.style.top = `${Math.min(r.height - 140, Math.max(8, e.clientY - r.top + 14))}px`;
    const names = this.plan.entityNames || {};
    const st = hit.entity ? this.entities[hit.entity] : null;
    const HE = { on: 'דולק', off: 'כבוי', open: 'פתוח', closed: 'סגור', locked: 'נעול', unlocked: 'לא נעול', playing: 'מנגן', unavailable: 'לא זמין', undefined: 'לא ידוע', null: 'לא ידוע' };
    p.appendChild(el('h4', '', hit.label || names[hit.entity] || hit.entity || hit.id));
    const acts = el('div', 'actions');
    if (hit.kind === 'camera') {
      p.appendChild(el('div', 'state', hit.online === false ? 'לא מקוון · מצב ישן' : 'מקוון'));
      const b = el('button', 'btn sm', 'עמוד במצלמה'); b.addEventListener('click', () => { this.hidePopover(); this.standAtCamera(this.planScene.cameras.find((c) => c.id === hit.id)); }); acts.appendChild(b);
    } else if (hit.domain === 'light') {
      p.appendChild(el('div', 'state', st === 'on' ? 'דולק' : 'כבוי'));
      const b = el('button', 'btn sm primary', st === 'on' ? 'כבה' : 'הדלק'); b.addEventListener('click', () => { this.setEntity(hit.entity, st === 'on' ? 'off' : 'on'); this.hidePopover(); }); acts.appendChild(b);
    } else if (hit.domain === 'door') {
      const real = hit.entity && !hit.entity.startsWith('door:');
      p.appendChild(el('div', 'state', real ? (st === 'on' || st === 'open' ? 'פתוחה' : 'סגורה') + (hit.lock ? ` · ${HE[this.entities[hit.lock]]}` : '') : 'ללא חיישן — עבירה בסיור'));
      if (real) { const b = el('button', 'btn sm primary', st === 'on' || st === 'open' ? 'סגור (דמה חיישן)' : 'פתח (דמה חיישן)'); b.addEventListener('click', () => { this.setEntity(hit.entity, st === 'on' || st === 'open' ? 'off' : 'on'); this.hidePopover(); }); acts.appendChild(b); }
      if (hit.lock) { const l = el('button', 'btn sm', this.entities[hit.lock] === 'locked' ? 'שחרר נעילה' : 'נעל'); l.addEventListener('click', () => { this.setEntity(hit.lock, this.entities[hit.lock] === 'locked' ? 'unlocked' : 'locked'); this.hidePopover(); }); acts.appendChild(l); }
    } else if (hit.kind === 'lock') {
      p.appendChild(el('div', 'state', HE[st]));
      const l = el('button', 'btn sm primary', st === 'locked' ? 'שחרר נעילה' : 'נעל'); l.addEventListener('click', () => { this.setEntity(hit.entity, st === 'locked' ? 'unlocked' : 'locked'); this.hidePopover(); }); acts.appendChild(l);
    } else if (hit.domain === 'cover') {
      const pos = this.coverPositions[hit.entity] ?? (st === 'open' ? 100 : 0);
      p.appendChild(el('div', 'state', `${pos}% פתוח`));
      for (const v of [0, 50, 100]) { const b = el('button', 'btn sm', `${v}%`); b.addEventListener('click', () => { this.coverPositions[hit.entity] = v; this.setEntity(hit.entity, v > 0 ? 'open' : 'closed'); this.buildStatesPanel(); this.hidePopover(); }); acts.appendChild(b); }
    } else if (hit.domain === 'media_player') {
      p.appendChild(el('div', 'state', HE[st]));
      const b = el('button', 'btn sm primary', st === 'playing' ? 'כבה' : 'הפעל'); b.addEventListener('click', () => { this.setEntity(hit.entity, st === 'playing' ? 'off' : 'playing'); this.hidePopover(); }); acts.appendChild(b);
    }
    const x = el('button', 'btn sm', 'סגור'); x.addEventListener('click', () => this.hidePopover()); acts.appendChild(x);
    p.appendChild(acts);
    this.stage.appendChild(p);
    this.popover = p;
  }
  hidePopover() { if (this.popover) { this.popover.remove(); this.popover = null; } }

  // ------------------------------------------------------------------ labels
  layoutLabels() {
    const host = $('labels');
    if (this.mode === 'stills') { host.innerHTML = ''; return; }
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const cam = this.camera;
    cam.updateMatrixWorld();
    const v = new THREE.Vector3();
    const frag = document.createDocumentFragment();
    const camPos = cam.position;
    const walk = this.mode === 'walk';
    for (const l of this.planScene.labels) {
      const L = this.planScene.levels[l.level];
      if (!L || !L.group.visible) continue;
      if (walk && l.kind === 'room') continue;
      if (!walk && l.kind === 'device' && (!this.hover || this.hover !== l.entity)) continue;
      if (walk && l.kind === 'device' && l.pos.distanceTo(camPos) > 4) continue;
      if (walk && l.kind === 'camera' && l.pos.distanceTo(camPos) > 9) continue;
      if (walk && l.kind === 'temp' && l.pos.distanceTo(camPos) > 7) continue;
      if (this.levelMode === 'all' && !walk && l.kind === 'temp' && l.level !== this.plan.doc.levels[this.plan.doc.levels.length - 1].id) continue;
      v.copy(l.pos);
      if (l.offset && !walk) v.x += l.offset;
      v.project(cam);
      if (v.z > 1 || v.z < -1) continue;
      const x = ((v.x + 1) / 2) * w, y = ((1 - v.y) / 2) * h;
      if (x < -40 || x > w + 40 || y < -20 || y > h + 20) continue;
      const d = el('div', `lbl ${l.kind}`);
      if (l.kind === 'device') {
        const st = this.entities[l.entity];
        const names = this.plan.entityNames || {};
        d.textContent = `${names[l.entity] || l.entity} · ${st === 'on' ? (l.entity.startsWith('light.') ? 'דולק' : 'פתוח') : st === 'off' ? (l.entity.startsWith('light.') ? 'כבוי' : 'סגור') : st || '—'}`;
        if (st === 'on' && l.entity.startsWith('light.')) d.classList.add('on');
        if (st === 'on' && l.entity.startsWith('binary_sensor.')) d.classList.add('open');
      } else d.textContent = l.text;
      if (l.kind === 'camera' && l.online === false) d.classList.add('off');
      d.style.left = `${x}px`; d.style.top = `${y}px`;
      frag.appendChild(d);
    }
    host.innerHTML = '';
    host.appendChild(frag);
  }

  // ------------------------------------------------------------------ frame loop + HUD
  /** Ask for a frame; `shadows` false = only the camera moved (the shadow maps stay as they are). */
  invalidate(shadows = true) { this.needsFrame = true; if (shadows) this.shadowDirty = true; }
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.1, (now - (this.lastT || now)) / 1000);
    this.lastT = now;
    // kiosk idle
    if (this.opts.idleS > 0 && this.mode === 'orbit' && this.bakes[this.currentLevelId()] && now - this.lastInput > this.opts.idleS * 1000) {
      this.lastLiveQuality = this.quality; this.kioskAuto = true; this.quality = 0; this.enterStills(); this.renderBar(); this.renderLadder(); this.setNote('קיוסק: חוסר פעילות — עברנו לתמונה המוכנה, 0 פריימים');
    }
    if (this.mode === 'stills') { this.updateHud(now, false); return; }
    let moving = false;
    // camera tweens (plan L11): eased 0..1, the camera pose is owned by the tween while it runs
    if (this.tween) {
      const k0 = Math.min(1, (now - this.tween.t0) / this.tween.ms);
      const k = k0 < 0.5 ? 2 * k0 * k0 : 1 - Math.pow(-2 * k0 + 2, 2) / 2;
      this.tween.step(k);
      moving = true;
      if (k0 >= 1) { const t = this.tween; this.tween = null; if (!t.pose && this.controls && this.mode === 'orbit') this.controls.enabled = true; }
    }
    if (this.mode === 'walk' && this.walk) {
      if (this.walk.step(dt)) { moving = true; this.walk.eyeOverride = null; }
      // eye-height easing (plan P5): the slider moves the target, the eye follows over ~0.4 s
      if (this.walk.eyeTarget != null && Math.abs(this.walk.eyeTarget - this.walk.eye) > 0.001) { this.walk.eye += (this.walk.eyeTarget - this.walk.eye) * Math.min(1, dt * 6); moving = true; }
      // interior exposure adaptation (plan P5): the fill follows the room's daylight factor, eased over ~0.6 s
      const Lw = this.planScene.levels[this.walk.level];
      const zone = Lw && Lw.zones.find((z) => pointInPolygon(this.walk.x, this.walk.z, z.polyM));
      const want = zone && typeof zone.daylight === 'number' ? 0.25 + zone.daylight * 0.75 : 0.6;
      if (Math.abs(want - this.env.interiorFill) > 0.004) { this.env.interiorFill += (want - this.env.interiorFill) * Math.min(1, dt * 3); this.env.applyFill(); moving = true; }
      if (!(this.tween && this.tween.pose)) {
        const y = this.walk.eyeOverride != null ? this.walk.eyeOverride : this.walk.eyeY();
        this.walkCam.position.set(this.walk.x, y, this.walk.z);
        this.walkCam.rotation.order = 'YXZ';
        this.walkCam.rotation.set(this.walk.pitch, this.walk.yaw, 0);
      }
      this.updateWalkBar();
      this.updateAim();
      this.mmMap = drawMinimap($('minimap').querySelector('canvas'), this.planScene, this.walk, { bg: document.documentElement.dataset.theme === 'dark' ? 'rgba(21,28,44,.92)' : 'rgba(255,255,255,.92)' });
    } else if (this.controls && !this.tween) {
      if (this.controls.update()) moving = true;
    }
    const anim = this.planScene.update(dt, this.camera.position, { nightFactor: this.env.recipe.night, lampShadows: this.opts.lampShadows && this.quality >= 3 });
    if (anim) { moving = true; this.shadowDirty = true; }
    const draw = this.needsFrame || moving || this.continuous || this.probe;
    if (draw) {
      this.needsFrame = false;
      if (this.shadowDirty || this.probe) { this.env.renderer.shadowMap.needsUpdate = true; this.shadowDirty = false; }
      this.env.renderer.info.autoReset = false;
      this.env.renderer.info.reset();
      const t0 = performance.now();
      this.env.render(this.camera);
      this.fps.ms = this.fps.ms * 0.85 + (performance.now() - t0) * 0.15;
      this.layoutLabels();
      this.fps.window.push(now);
      this.probeFrame(now);
    }
    this.updateHud(now, draw);
  }
  updateHud(now, drew) {
    const win = this.fps.window;
    while (win.length && win[0] < now - 1000) win.shift();
    if (now - this.fps.last < 250) return;
    this.fps.last = now;
    const info = this.env.renderer.info;
    const mem = performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB heap` : 'heap n/a';
    const gpu = this.gpuName || (this.gpuName = this.env.rendererName());
    const sw = /swiftshader|llvmpipe|software/i.test(gpu);
    const fpsTxt = this.mode === 'stills' ? '0 fps (still, no WebGL frames)' : win.length ? `${win.length} fps · ${this.fps.ms.toFixed(1)} ms/frame (CPU submit)` : 'idle (0 fps — on-demand)';
    $('hud').innerHTML = `<b>${fpsTxt}</b><br>draw ${info.render.calls} · tris ${(info.render.triangles / 1000).toFixed(0)}k · tex ${info.memory.textures} · geo ${info.memory.geometries}<br>${mem} · ${this.canvas.width}×${this.canvas.height} @${this.env.dpr.toFixed(2)}×<br>${this.mode} · ${this.qualityLabel()}${this.probe ? ' · measuring…' : ''}<br><span class="${sw ? 'warn' : ''}">${sw ? '⚠ software renderer: ' : 'GPU: '}${gpu.length > 60 ? gpu.slice(0, 60) + '…' : gpu}</span>`;
    void drew;
  }
}

// start after the page has painted its chrome (the first build compiles shaders and generates the textures)
window.Studio6App = App;
window.STUDIO6_PLANS = PLANS;
if (!/noboot/.test(location.search)) window.addEventListener('load', () => setTimeout(() => { const t0 = performance.now(); window.studio6 = new App(); window.studio6.bootMs = Math.round(performance.now() - t0); }, 30));
