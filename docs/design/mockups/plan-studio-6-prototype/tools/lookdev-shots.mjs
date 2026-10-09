/**
 * ST7 look-dev evidence: the §2.1 screen list in both styles at 1440 / 820 / 390, the scripted walk checks, the
 * horizontal-overflow check per width, the walk + time-of-day GIF frames, and the per-rung measurement.
 *   SW_NODE_MODULES=<frontend/node_modules> SW_GPU=1 SW_URL=http://127.0.0.1:4190/index.html node tools/lookdev-shots.mjs [shots|measure|all]
 * Output: shots/lookdev/<style>/<name>.png, shots/lookdev/frames/, shots/lookdev-<tag>.json
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const nm = process.env.SW_NODE_MODULES || path.resolve(root, '../../../../frontend/node_modules');
const require = createRequire(path.join(nm, 'x.js'));
const { chromium } = require('playwright');
const mode = process.argv[2] || 'all';
const GPU = process.env.SW_GPU === '1';
const tag = GPU ? 'gpu' : 'swiftshader';
const out = path.join(root, 'shots', 'lookdev');
for (const d of ['light', 'dark', 'frames']) mkdirSync(path.join(out, d), { recursive: true });

const browser = await chromium.launch({ headless: true, args: GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
const url = process.env.SW_URL || pathToFileURL(path.join(root, 'index.html')).href;
const tBoot = Date.now();
await page.goto(url);
await page.waitForFunction(() => window.studio6 && window.studio6.planScene && window.studio6.planScene.levels.L0, null, { timeout: 180000 });
const R = { renderer: await page.evaluate(() => window.studio6.env.rendererName()), boot_ms: await page.evaluate(() => window.studio6.bootMs), texture_gen_ms: await page.evaluate(() => Math.round(window.studio6.lib.genMs)), page_ready_ms: Date.now() - tBoot, measured_at: new Date().toISOString(), url, note: 'same-session relative numbers; the workstation runs other sessions - compare only against shots/perf-gpu.json measured the same day' };
console.log('renderer:', R.renderer, '| boot', R.boot_ms, 'ms | textures', R.texture_gen_ms, 'ms');
await page.waitForTimeout(GPU ? 4500 : 9000);
// CC0 file textures load lazily: wait until every requested set has arrived (or 30 s), then let the frame settle
await page.waitForFunction(() => { const l = window.studio6.lib; return !l.loader || [...l.cache.keys()].every((id) => !l.cache.get(id).file || l.loaded.has(id) || (l.failed && l.failed.has(id))); }, null, { timeout: 30000 }).catch(() => console.log('texture wait timed out'));
await page.waitForTimeout(800);
R.probe_note = await page.locator('#note').innerText().catch(() => '');

const app = (fn, ...args) => page.evaluate(fn, ...args);
const settle = async (ms = 1400) => { await app(() => window.studio6.invalidate()); await page.waitForTimeout(ms); };
const setQ = (q, lite = false) => app(([q, l]) => window.studio6.setQuality(q, null, l), [q, lite]);
const hour = (h, weather) => app(([h, w]) => { document.getElementById('sun-slider').value = h * 60; window.studio6.env.setTime(w ? { hour: h, weather: w } : { hour: h }); window.studio6.updateSunCard(); }, [h, weather || null]);
const manual = () => app(() => { window.studio6.opts.autoLadder = false; window.studio6.probe = null; window.studio6.continuous = window.studio6.mode === 'walk'; window.studio6.settings.motion = false; });
const style = (s) => app((s) => { document.documentElement.dataset.theme = s === 'dark' ? 'dark' : ''; window.studio6.setStyle(s); }, s);
const size = async (w, h) => { await page.setViewportSize({ width: w, height: h }); await app((touch) => { window.studio6.touch = touch; document.getElementById('stage').classList.toggle('touch', touch); window.studio6.resize(); }, w < 900); await page.waitForTimeout(300); };
const overflow = async (label) => { const r = await app(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, bw: document.body.scrollWidth })); R[`overflow:${label}`] = { ...r, ok: r.sw <= r.iw && r.bw <= r.iw }; };
const lights = (pred, v) => app(([p, v]) => { window.studio6.setMany((k) => new RegExp(p).test(k), v); window.studio6.syncPanel(); }, [pred, v]);
const measure = async (label, n = 12) => {
  const r = await app((n) => {
    const a = window.studio6;
    const gl = a.env.renderer.getContext();
    const px = new Uint8Array(4);
    a.env.renderer.shadowMap.needsUpdate = true;
    a.env.render(a.camera);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const times = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      a.env.renderer.shadowMap.needsUpdate = i % 4 === 0;
      a.env.renderer.info.reset();
      a.env.render(a.camera);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      times.push(performance.now() - t0);
    }
    times.sort((x, y) => x - y);
    return { median_ms: +times[Math.floor(n / 2)].toFixed(1), min_ms: +times[0].toFixed(1), max_ms: +times[n - 1].toFixed(1), fps_from_median: +(1000 / times[Math.floor(n / 2)]).toFixed(1), draw_calls: a.env.renderer.info.render.calls, triangles: a.env.renderer.info.render.triangles, size: `${a.canvas.width}x${a.canvas.height}`, dpr: a.env.dpr, quality: a.qualityLabel(), mode: a.mode, style: a.style.id };
  }, n);
  R[`measure:${label}`] = r;
  console.log(`[measure ${label}]`, JSON.stringify(r));
  return r;
};

await manual();
if (mode === 'measure' || mode === 'all') {
  await style('light');
  await app(() => { window.studio6.setLevelMode('L0'); window.studio6.fitCamera('iso'); }); await hour(15.5, 'clear');
  for (const [q, lite] of [[3, false], [3, true], [2, false], [1, false]]) { await setQ(q, lite); await settle(1500); await measure(`orbit-iso-L0-q${q}${lite ? '-lite' : ''}`); }
  await app(() => { window.studio6.setLevelMode('all'); window.studio6.fitCamera('persp'); }); await setQ(3); await settle(1500); await measure('orbit-persp-both-q3');
  await app(() => { window.studio6.setLevelMode('L0'); window.studio6.enterWalk(); }); await settle(1500); await measure('walk-q3');
  await setQ(3, true); await settle(1500); await measure('walk-q3-lite');
  await setQ(2); await settle(1500); await measure('walk-q2');
  await app(() => window.studio6.exitWalk());
  await style('dark'); await setQ(3, true); await app(() => { window.studio6.setLevelMode('L0'); window.studio6.fitCamera('iso'); }); await settle(1500); await measure('dark-orbit-iso-L0-q3-lite');
  await style('light');
  await size(390, 844); await setQ(3, true); await app(() => window.studio6.enterWalk()); await settle(2000); await measure('phone-390-walk-q3-lite');
  await setQ(2); await settle(1500); await measure('phone-390-walk-q2');
  await app(() => window.studio6.exitWalk());
  await size(1440, 900);
  if (mode === 'measure') { R.console_errors = errors; writeFileSync(path.join(root, 'shots', `lookdev-perf-${tag}.json`), JSON.stringify(R, null, 2)); await browser.close(); process.exit(0); }
}

const frame = async (st, name) => { await page.screenshot({ path: path.join(out, st, `${name}.png`), timeout: 240000 }); console.log('shot', st, name); };
for (const st of ['light', 'dark']) {
  await style(st);
  await manual();
  await size(1440, 900); await overflow(`1440-${st}`);
  await app(() => { window.studio6.setLevelMode('L0'); window.studio6.fitCamera('iso'); });
  await setQ(3); await hour(15.5, 'clear'); await lights('^light\\.', 'off'); await lights('^light\\.(living|kitchen)$', 'on'); await settle(2500); await frame(st, '01-iso-day');
  await hour(18.1); await settle(1800); await frame(st, '02-iso-sunset');
  await hour(22.5); await lights('^light\\.', 'on'); await lights('^light\\.(wc|utility)$', 'off'); await settle(1800); await frame(st, '03-iso-night-lamps');
  await hour(12.5, 'overcast'); await app(() => { window.studio6.setLevelMode('all'); window.studio6.fitCamera('persp'); }); await settle(1800); await frame(st, '04-persp-both-floors-overcast');
  await hour(15.5, 'clear'); await app(() => { window.studio6.setLevelMode('L1'); window.studio6.fitCamera('iso'); }); await settle(1800); await frame(st, '05-iso-upper-floor');
  await app(() => { window.studio6.setLevelMode('L0'); window.studio6.fitCamera('top'); }); await settle(1500); await frame(st, '05b-top');
  await app(() => { window.studio6.fitCamera('iso'); window.studio6.setMany((k) => k.startsWith('binary_sensor.') && k.endsWith('_door'), 'on'); window.studio6.setEntity('binary_sensor.motion_living', 'on'); window.studio6.coverPositions['cover.living_terrace'] = 40; window.studio6.setEntity('cover.living_terrace', 'open'); window.studio6.setEntity('lock.front_door', 'unlocked'); });
  await settle(1800); await frame(st, '06-device-states-doors-open-presence');
  await app(() => { document.getElementById('labels').classList.add('temps'); }); await settle(400); await frame(st, '06b-temperatures-on'); await app(() => { document.getElementById('labels').classList.remove('temps'); });
  await setQ(3, true); await settle(1500); await frame(st, '07-quality-realistic-lite');
  await setQ(2); await settle(1500); await frame(st, '08-quality-full');
  await setQ(1); await settle(1500); await frame(st, '09-quality-schematic');
  await setQ(3); await app(() => { window.studio6.setMany((k) => k.startsWith('binary_sensor.') && k.endsWith('_door'), 'off'); window.studio6.setEntity('binary_sensor.hall_living_door', 'on'); window.studio6.setEntity('binary_sensor.kitchen_door', 'on'); window.studio6.setEntity('lock.front_door', 'locked'); }); await lights('^light\\.', 'off'); await lights('^light\\.(living|living_floor|kitchen|hall)$', 'on'); await hour(16); await settle(1500);
  // walk
  await app(() => window.studio6.enterWalk()); await settle(1800); await frame(st, '10-walk-entrance-door');
  await app(() => { window.studio6.gotoPosition(window.studio6.savedPositions[1], true); window.studio6.walk.yaw = 2.6; window.studio6.walk.pitch = -0.05; }); await settle(1500); await frame(st, '11-walk-living-room');
  await app(() => { window.studio6.walk.yaw = 0.35; }); await settle(1200); await frame(st, '11b-walk-living-tv');
  await page.mouse.click(720, 450); await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW'); await settle(800); await frame(st, '12-walk-after-keys');
  await app(() => { const w = window.studio6.walk; const p = w.pathTo(9.0, 8.8); window.__path = p ? p.length : -1; });
  await page.waitForTimeout(7000); await settle(800);
  R[`walk:${st}:tap_to_walk_waypoints`] = await app(() => window.__path);
  R[`walk:${st}:walk_pos_after_tap`] = await app(() => [+window.studio6.walk.x.toFixed(2), +window.studio6.walk.z.toFixed(2), window.studio6.walk.level]);
  await frame(st, '13-walk-kitchen-after-tap-to-walk');
  await app(() => { window.studio6.walk.placeAt(2.75, 6.9, 270, 'L0'); window.studio6.walk.path = null; });
  const before = await app(() => [+window.studio6.walk.x.toFixed(2), +window.studio6.walk.z.toFixed(2)]);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW');
  R[`walk:${st}:blocked_by_closed_door`] = { before, after: await app(() => [+window.studio6.walk.x.toFixed(2), +window.studio6.walk.z.toFixed(2)]), door_x: 3.5 };
  await settle(600); await frame(st, '14-walk-blocked-closed-door');
  await app(() => { window.studio6.walk.placeAt(1.25, 7.0, 0, 'L0'); window.studio6.walk.path = null; });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1400); await page.keyboard.up('KeyW'); await settle(600);
  R[`walk:${st}:on_stairs`] = await app(() => [+window.studio6.walk.x.toFixed(2), +window.studio6.walk.z.toFixed(2), +window.studio6.walk.eyeY().toFixed(2), window.studio6.walk.level, !!window.studio6.walk.onStairs]);
  await frame(st, '15-walk-on-stairs');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(4500); await page.keyboard.up('KeyW'); await settle(800);
  R[`walk:${st}:after_stairs`] = await app(() => [+window.studio6.walk.x.toFixed(2), +window.studio6.walk.z.toFixed(2), +window.studio6.walk.eyeY().toFixed(2), window.studio6.walk.level]);
  await frame(st, '16-walk-upper-floor-after-stairs');
  await app(() => window.studio6.standAtCamera(window.studio6.planScene.cameras[1])); await settle(1200); await frame(st, '17-walk-stand-at-camera');
  await app(() => { window.studio6.walk.placeAt(9.6, 2.0, 180, 'L0'); window.studio6.walk.eyeTarget = 1.2; window.studio6.walk.eye = 1.2; }); await settle(1200); await frame(st, '17b-walk-eye-1.2m');
  await app(() => { window.studio6.walk.eyeTarget = 1.65; window.studio6.walk.eye = 1.65; });
  await app(() => window.studio6.exitWalk()); await settle(800);
  // stills / wall display
  await app(async () => { const b = document.querySelector('#panel-quality .btn.primary'); const bar = document.querySelector('#panel-quality .progress i'); await window.studio6.bakeCurrent(b, bar); });
  await page.waitForTimeout(500);
  await setQ(0); await settle(1500); await frame(st, '18-stills-kiosk-day');
  await hour(22); await app(() => { window.studio6.setEntity('light.living', 'off'); window.studio6.setEntity('light.office', 'on'); window.studio6.showStills(); }); await settle(1000); await frame(st, '19-stills-kiosk-night-masks');
  await size(1280, 800); await app(() => window.studio6.showStills()); await settle(800); await frame(st, '19b-stills-kiosk-1280x800');
  await size(820, 1180); await app(() => window.studio6.showStills()); await settle(800); await overflow(`820-${st}`); await frame(st, '19c-stills-kiosk-820');
  await app(() => { window.studio6.exitStills(true); }); await setQ(3, true); await app(() => { window.studio6.setLevelMode('L0'); window.studio6.fitCamera('iso'); }); await hour(15.5, 'clear'); await settle(1500); await frame(st, '20-tablet-820-iso');
  // phone
  await size(390, 844); await overflow(`390-${st}`);
  await setQ(3, true); await app(() => { window.studio6.setLevelMode('L0'); window.studio6.fitCamera('iso'); }); await settle(1800); await frame(st, '22-mobile-iso');
  await app(() => document.getElementById('aside').classList.add('open')); await page.waitForTimeout(500); await frame(st, '22b-mobile-sheet-open'); await app(() => document.getElementById('aside').classList.remove('open'));
  await app(() => window.studio6.enterWalk()); await settle(2000); await frame(st, '21-mobile-walk-joystick');
  await page.mouse.move(70, 644); await page.mouse.down(); await page.mouse.move(70, 610, { steps: 5 }); await page.waitForTimeout(300); await frame(st, '21b-mobile-walk-joystick-held'); await page.mouse.up();
  await app(() => window.studio6.exitWalk());
  await size(1440, 900);
  await app(() => { window.studio6.setLevelMode('L0'); window.studio6.fitCamera('iso'); }); await setQ(3); await hour(15.5, 'clear'); await settle(1500);
  R[`style:${st}:hud`] = await page.locator('#hud').innerText();
}
// GIF frames (light style): time of day + a walk
await style('light'); await manual(); await setQ(3);
await app(() => { window.studio6.setLevelMode('L0'); window.studio6.fitCamera('iso'); });
await hour(6); await lights('^light\\.', 'off'); await settle(1500);
for (let i = 0; i < 16; i++) {
  const h = 6 + i;
  await hour(h); if (h >= 18) await lights('^light\\.', 'on'); await settle(900);
  await page.screenshot({ path: path.join(out, 'frames', `tod-${String(i).padStart(2, '0')}.png`), timeout: 240000 });
}
await hour(16); await lights('^light\\.', 'off'); await lights('^light\\.(living|living_floor|kitchen)$', 'on');
await app(() => { window.studio6.enterWalk(); window.studio6.gotoPosition(window.studio6.savedPositions[1], true); window.studio6.walk.yaw = 2.2; }); await settle(1200);
for (let i = 0; i < 24; i++) {
  if (i === 0) await page.keyboard.down('KeyW');
  if (i === 10) { await page.keyboard.up('KeyW'); await page.keyboard.down('KeyE'); }
  if (i === 16) { await page.keyboard.up('KeyE'); await page.keyboard.down('KeyW'); }
  await page.waitForTimeout(220); await settle(300);
  await page.screenshot({ path: path.join(out, 'frames', `walk-${String(i).padStart(2, '0')}.png`), timeout: 240000 });
}
await page.keyboard.up('KeyW'); await app(() => window.studio6.exitWalk());
R.console_errors = errors.slice(0, 30);
R.console_error_count = errors.length;
writeFileSync(path.join(root, 'shots', `lookdev-${tag}.json`), JSON.stringify(R, null, 2));
console.log('wrote', `lookdev-${tag}.json`, '| console errors:', errors.length, errors.slice(0, 5));
await browser.close();
