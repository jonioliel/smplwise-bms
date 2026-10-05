/**
 * Drive the prototype in headless Chromium, check for console errors, measure every rung of the quality ladder with a
 * GPU-synchronised frame timer, take the screenshots in shots/ and the frame sequences for the GIFs.
 *
 *   SW_NODE_MODULES=<frontend/node_modules> [SW_GPU=1] [SW_URL=http://127.0.0.1:4190/index.html] node tools/capture.mjs smoke|measure|shots|all
 *
 * SW_GPU=1 runs the workstation's real GPU through ANGLE/D3D11 in headless mode (no window, no tab throttling);
 * without it Chromium uses SwiftShader (software), the renderer the product's own visual baselines use. The two give
 * different numbers and the json files say which one produced them - SwiftShader numbers are not GPU numbers.
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
const shots = path.join(root, 'shots');
mkdirSync(path.join(shots, 'frames'), { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
const url = process.env.SW_URL || pathToFileURL(path.join(root, 'index.html')).href;
console.log('open', url, GPU ? '(real GPU)' : '(SwiftShader)');
const tBoot = Date.now();
await page.goto(url);
await page.waitForFunction(() => window.studio6 && window.studio6.planScene && window.studio6.planScene.levels.L0, null, { timeout: 180000 });
const perf = { renderer: await page.evaluate(() => window.studio6.env.rendererName()), boot_ms: await page.evaluate(() => window.studio6.bootMs), page_ready_ms: Date.now() - tBoot, viewport: '1440x900', measured_at: new Date().toISOString(), url };
console.log('renderer:', perf.renderer, '| boot', perf.boot_ms, 'ms');

const app = (fn, ...args) => page.evaluate(fn, ...args);
const hud = async () => (await page.locator('#hud').innerText()).replace(/\n/g, ' | ');
const record = async (key) => { perf[key] = await hud(); console.log(`[${key}] ${perf[key]}`); };
const frame = async (name) => { await page.screenshot({ path: path.join(shots, name), timeout: 240000 }); console.log('shot', name); };
const settle = async (ms = 1200) => { await app(() => window.studio6.invalidate()); await page.waitForTimeout(ms); };
const setQ = (q, lite = false) => app(([q, l]) => window.studio6.setQuality(q, null, l), [q, lite]);
const hour = (h, weather) => app(([h, w]) => { document.getElementById('sun-slider').value = h * 60; window.studio6.env.setTime(w ? { hour: h, weather: w } : { hour: h }); window.studio6.updateSunCard(); }, [h, weather || null]);
const manual = () => app(() => { window.studio6.opts.autoLadder = false; window.studio6.probe = null; window.studio6.continuous = window.studio6.mode === 'walk'; });

/** True frame cost: N frames back to back, each followed by a 1x1 readPixels (forces the GPU to finish the frame). */
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
      a.env.renderer.shadowMap.needsUpdate = i % 4 === 0; // shadows redraw on every 4th frame (a state / sun change)
      a.env.renderer.info.reset();
      a.env.render(a.camera);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      times.push(performance.now() - t0);
    }
    times.sort((x, y) => x - y);
    return { median_ms: +times[Math.floor(n / 2)].toFixed(1), min_ms: +times[0].toFixed(1), max_ms: +times[n - 1].toFixed(1), fps_from_median: +(1000 / times[Math.floor(n / 2)]).toFixed(1), draw_calls: a.env.renderer.info.render.calls, triangles: a.env.renderer.info.render.triangles, size: `${a.canvas.width}x${a.canvas.height}`, dpr: a.env.dpr, quality: a.qualityLabel(), mode: a.mode };
  }, n);
  perf[`measure:${label}`] = r;
  console.log(`[measure ${label}]`, JSON.stringify(r));
  return r;
};
const finish = async (file) => {
  perf.console_errors = errors.slice(0, 30);
  perf.console_error_count = errors.length;
  writeFileSync(path.join(shots, file), JSON.stringify(perf, null, 2));
  console.log('wrote', file, '| console errors/warnings:', errors.length, errors.slice(0, 5));
  await browser.close();
};

// the probe runs 2.5 s on load; wait for its verdict (a fallback IS the ladder working - recorded in the json)
await page.waitForTimeout(GPU ? 4500 : 9000);
await record('after-load-probe');
perf.probe_note = await page.locator('#note').innerText().catch(() => '');
console.log('probe:', perf.probe_note);

if (mode === 'smoke') { await finish(`smoke-${tag}.json`); process.exit(errors.filter((e) => e.startsWith('pageerror')).length ? 1 : 0); }

if (mode === 'measure' || mode === 'all') {
  await manual();
  for (const [q, lite] of [[3, false], [3, true], [2, false], [1, false]]) { await setQ(q, lite); await settle(1500); await measure(`orbit-iso-L0-q${q}${lite ? '-lite' : ''}`); }
  await app(() => { window.studio6.setLevelMode('all'); window.studio6.fitCamera('persp'); }); await setQ(3); await settle(1500); await measure('orbit-persp-both-q3');
  await app(() => { window.studio6.setLevelMode('L0'); window.studio6.enterWalk(); }); await settle(1500); await measure('walk-q3');
  await setQ(3, true); await settle(1500); await measure('walk-q3-lite');
  await setQ(2); await settle(1500); await measure('walk-q2');
  await app(() => window.studio6.exitWalk());
  await page.setViewportSize({ width: 390, height: 844 });
  await app(() => { window.studio6.touch = true; window.studio6.resize(); }); await setQ(3, true); await app(() => window.studio6.enterWalk()); await settle(2000); await measure('phone-390-walk-q3-lite');
  await setQ(2); await settle(1500); await measure('phone-390-walk-q2');
  await app(() => window.studio6.exitWalk());
  await page.setViewportSize({ width: 1440, height: 900 });
  await app(() => { window.studio6.touch = false; document.getElementById('stage').classList.remove('touch'); window.studio6.resize(); });
  if (mode === 'measure') { await finish(`perf-${tag}.json`); process.exit(0); }
  writeFileSync(path.join(shots, `perf-${tag}.json`), JSON.stringify(perf, null, 2));
}

// ------------------------------------------------------------------ screenshots
await manual();
await app(() => { window.studio6.setLevelMode('L0'); window.studio6.fitCamera('iso'); });
await setQ(3); await hour(15.5, 'clear'); await settle(2500);
await record('realistic-iso'); await frame('01-realistic-iso-afternoon.png');
await hour(18.1); await settle(2000); await frame('02-realistic-iso-sunset.png');
await hour(22.5); await app(() => { window.studio6.setMany((k) => k.startsWith('light.'), 'on'); window.studio6.syncPanel(); }); await settle(2000);
await record('realistic-night-all-lamps'); await frame('03-realistic-iso-night-lamps.png');
await hour(12.5, 'overcast'); await app(() => { window.studio6.setLevelMode('all'); window.studio6.fitCamera('persp'); }); await settle(2000); await frame('04-realistic-persp-both-floors-overcast.png');
await hour(15.5, 'clear'); await app(() => { window.studio6.setLevelMode('L1'); window.studio6.fitCamera('iso'); }); await settle(2000); await frame('05-realistic-iso-upper-floor.png');
await app(() => { window.studio6.setLevelMode('L0'); window.studio6.fitCamera('iso'); window.studio6.setMany((k) => k.startsWith('binary_sensor.') && k.endsWith('_door'), 'on'); window.studio6.setEntity('binary_sensor.motion_living', 'on'); window.studio6.coverPositions['cover.living_terrace'] = 40; window.studio6.setEntity('cover.living_terrace', 'open'); });
await settle(2000); await frame('06-device-states-doors-open-presence.png');
await setQ(3, true); await settle(1500); await record('realistic-lite'); await frame('07-quality-realistic-lite.png');
await setQ(2); await settle(1500); await record('full-level2'); await frame('08-quality-full.png');
await setQ(1); await settle(1500); await record('schematic-level1'); await frame('09-quality-schematic.png');
await setQ(3); await app(() => { window.studio6.setMany((k) => k.startsWith('binary_sensor.') && k.endsWith('_door'), 'off'); window.studio6.setEntity('binary_sensor.hall_living_door', 'on'); window.studio6.setEntity('binary_sensor.kitchen_door', 'on'); }); await settle(2000);
// walk-through
await app(() => window.studio6.enterWalk()); await settle(1500); await record('walk-entrance'); await frame('10-walk-entrance-door.png');
await app(() => window.studio6.gotoPosition(window.studio6.savedPositions[1], true)); await settle(1500); await frame('11-walk-living-room.png');
await page.mouse.click(720, 450); await page.keyboard.down('KeyW'); await page.waitForTimeout(1800); await page.keyboard.up('KeyW'); await settle(800);
await record('walk-after-keys'); await frame('12-walk-after-keys.png');
await app(() => { const w = window.studio6.walk; const p = w.pathTo(9.0, 8.8); window.__path = p ? p.length : -1; });
await page.waitForTimeout(7000); await settle(800);
perf.tap_to_walk_waypoints = await app(() => window.__path);
perf.walk_pos_after_tap = await app(() => [+window.studio6.walk.x.toFixed(2), +window.studio6.walk.z.toFixed(2), window.studio6.walk.level]);
await frame('13-walk-kitchen-after-tap-to-walk.png');
await app(() => { window.studio6.walk.placeAt(2.75, 6.9, 270, 'L0'); window.studio6.walk.path = null; });
const before = await app(() => [+window.studio6.walk.x.toFixed(2), +window.studio6.walk.z.toFixed(2)]);
await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW');
perf.blocked_by_closed_door = { before, after: await app(() => [+window.studio6.walk.x.toFixed(2), +window.studio6.walk.z.toFixed(2)]), door_x: 3.5 };
await settle(600); await frame('14-walk-blocked-closed-door.png');
await app(() => { window.studio6.walk.placeAt(1.25, 7.0, 0, 'L0'); window.studio6.walk.path = null; });
await page.keyboard.down('KeyW'); await page.waitForTimeout(1400); await page.keyboard.up('KeyW'); await settle(600);
perf.on_stairs = await app(() => [+window.studio6.walk.x.toFixed(2), +window.studio6.walk.z.toFixed(2), +window.studio6.walk.eyeY().toFixed(2), window.studio6.walk.level, !!window.studio6.walk.onStairs]);
await frame('15-walk-on-stairs.png');
await page.keyboard.down('KeyW'); await page.waitForTimeout(4500); await page.keyboard.up('KeyW'); await settle(800);
perf.after_stairs = await app(() => [+window.studio6.walk.x.toFixed(2), +window.studio6.walk.z.toFixed(2), +window.studio6.walk.eyeY().toFixed(2), window.studio6.walk.level]);
// and down again: the stairwell railing of the upper floor must not stop the descent
await app(() => { window.studio6.walk.placeAt(1.25, 3.0, 180, 'L1'); window.studio6.walk.path = null; });
await page.keyboard.down('KeyW'); await page.waitForTimeout(4500); await page.keyboard.up('KeyW'); await settle(600);
perf.after_stairs_down = await app(() => [+window.studio6.walk.x.toFixed(2), +window.studio6.walk.z.toFixed(2), +window.studio6.walk.eyeY().toFixed(2), window.studio6.walk.level]);
await frame('16-walk-upper-floor-after-stairs.png');
await app(() => window.studio6.standAtCamera(window.studio6.planScene.cameras[1])); await settle(1200); await frame('17-walk-stand-at-camera.png');
await app(() => window.studio6.exitWalk()); await settle(1000);
// stills bake + kiosk
await app(async () => { const b = document.querySelector('#panel-quality .btn.primary'); const bar = document.querySelector('#panel-quality .progress i'); await window.studio6.bakeCurrent(b, bar); });
await page.waitForTimeout(500);
await setQ(0); await settle(1500); await record('stills-kiosk'); await frame('18-stills-kiosk-day.png');
await hour(22); await app(() => { window.studio6.setEntity('light.living', 'off'); window.studio6.setEntity('light.office', 'on'); window.studio6.showStills(); }); await settle(1000); await frame('19-stills-kiosk-night-masks.png');
perf.stills = await app(() => Object.values(window.studio6.bakes).map((s) => ({ masks: s.masks.length, pics: Object.keys(s.pics).length, w: s.w, h: s.h, doors: s.doors.length })));
// fixture plan
await app(() => { window.studio6.exitStills(true); const s = document.getElementById('plan-select'); s.value = 'fixture-sample-v2'; s.dispatchEvent(new Event('change')); });
await page.waitForTimeout(3000); await manual(); await setQ(3); await app(() => { window.studio6.setLevelMode('all'); window.studio6.fitCamera('persp'); }); await hour(15.5, 'clear'); await settle(2500); await frame('20-fixture-sample-v2.png');
// mobile
await page.setViewportSize({ width: 390, height: 844 });
await app(() => { const s = document.getElementById('plan-select'); s.value = 'demo-house'; s.dispatchEvent(new Event('change')); });
await page.waitForTimeout(3000); await manual();
await app(() => { window.studio6.touch = true; document.getElementById('stage').classList.add('touch'); window.studio6.resize(); }); await setQ(3, true); await app(() => window.studio6.enterWalk()); await settle(2500);
await record('mobile-walk'); await frame('21-mobile-walk-joystick.png');
await app(() => window.studio6.exitWalk()); await settle(2000); await frame('22-mobile-iso.png');
await page.setViewportSize({ width: 1440, height: 900 });
await app(() => { window.studio6.touch = false; document.getElementById('stage').classList.remove('touch'); window.studio6.resize(); });
// dark theme
await app(() => { document.documentElement.dataset.theme = 'dark'; window.studio6.setLevelMode('L0'); window.studio6.fitCamera('iso'); }); await setQ(3); await hour(19.5); await settle(2500); await frame('23-dark-theme-evening.png');
await app(() => { document.documentElement.dataset.theme = ''; });

// GIF frame sequences
if (mode === 'all') {
  await hour(6); await app(() => { window.studio6.setMany((k) => k.startsWith('light.'), 'off'); }); await settle(1500);
  for (let i = 0; i < 16; i++) {
    const h = 6 + i;
    await hour(h); if (h >= 18) await app(() => window.studio6.setMany((k) => k.startsWith('light.'), 'on')); await settle(900);
    await page.screenshot({ path: path.join(shots, 'frames', `tod-${String(i).padStart(2, '0')}.png`), timeout: 240000 });
  }
  await hour(16); await app(() => window.studio6.enterWalk()); await settle(1200);
  for (let i = 0; i < 24; i++) {
    if (i === 0) await page.keyboard.down('KeyW');
    if (i === 10) { await page.keyboard.up('KeyW'); await page.keyboard.down('KeyE'); }
    if (i === 16) { await page.keyboard.up('KeyE'); await page.keyboard.down('KeyW'); }
    await page.waitForTimeout(220); await settle(300);
    await page.screenshot({ path: path.join(shots, 'frames', `walk-${String(i).padStart(2, '0')}.png`), timeout: 240000 });
  }
  await page.keyboard.up('KeyW'); await app(() => window.studio6.exitWalk());
}
await finish(`shots-${tag}.json`);
