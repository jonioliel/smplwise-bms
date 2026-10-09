/**
 * Lever costs on the lite + realistic rungs, same process, back to back (the only fair comparison on a loaded box):
 * anti-aliasing variants (MSAA x4 / x2 / SMAA / none), GTAO on/off, contact decals on/off, and the full orbit / walk
 * numbers. Writes shots/levers-<tag>.json.
 *   SW_NODE_MODULES=... SW_GPU=1 SW_URL=... node tools/levers.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const nm = process.env.SW_NODE_MODULES || path.resolve(root, '../../../../frontend/node_modules');
const require = createRequire(path.join(nm, 'x.js'));
const { chromium } = require('playwright');
const GPU = process.env.SW_GPU === '1';
const tag = GPU ? 'gpu' : 'swiftshader';
const browser = await chromium.launch({ headless: true, args: GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' })).newPage();
await page.goto(process.env.SW_URL || pathToFileURL(path.join(root, 'index.html')).href);
await page.waitForFunction(() => window.studio6 && window.studio6.planScene && window.studio6.planScene.levels.L0, null, { timeout: 180000 });
await page.waitForTimeout(GPU ? 4500 : 9000);
// CC0 file textures load lazily: wait until every requested set has arrived (or 30 s), then let the frame settle
await page.waitForFunction(() => { const l = window.studio6.lib; return !l.loader || [...l.cache.keys()].every((id) => !l.cache.get(id).file || l.loaded.has(id) || (l.failed && l.failed.has(id))); }, null, { timeout: 30000 }).catch(() => console.log('texture wait timed out'));
await page.waitForTimeout(800);
const app = (fn, ...args) => page.evaluate(fn, ...args);
const settle = async (ms = 1200) => { await app(() => window.studio6.invalidate()); await page.waitForTimeout(ms); };
const R = { renderer: await app(() => window.studio6.env.rendererName()), measured_at: new Date().toISOString() };
const measure = async (label, n = 16) => {
  const r = await app((n) => {
    const a = window.studio6; const gl = a.env.renderer.getContext(); const px = new Uint8Array(4);
    a.env.renderer.shadowMap.needsUpdate = true; a.env.render(a.camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t = [];
    for (let i = 0; i < n; i++) { const t0 = performance.now(); a.env.renderer.shadowMap.needsUpdate = i % 4 === 0; a.env.renderer.info.reset(); a.env.render(a.camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); t.push(performance.now() - t0); }
    t.sort((x, y) => x - y);
    return { median_ms: +t[Math.floor(n / 2)].toFixed(1), min_ms: +t[0].toFixed(1), fps: +(1000 / t[Math.floor(n / 2)]).toFixed(1), draws: a.env.renderer.info.render.calls, tris: a.env.renderer.info.render.triangles, size: `${a.canvas.width}x${a.canvas.height}` };
  }, n);
  R[label] = r; console.log(label.padEnd(36), JSON.stringify(r)); return r;
};
const post = (p) => app((p) => { Object.assign(window.studio6.env.post, p); window.studio6.env.buildComposer(window.studio6.camera); }, p);
await app(() => { const a = window.studio6; a.opts.autoLadder = false; a.probe = null; a.continuous = false; a.settings.motion = false; document.documentElement.dataset.theme = ''; a.setStyle('light'); a.setQuality(3, null, true); a.setLevelMode('L0'); a.fitCamera('iso'); a.env.setTime({ hour: 15.5, weather: 'clear' }); });
await settle(1500);
for (const [label, p] of [['lite-orbit-msaa2', { samples: 2, aa: 'msaa' }], ['lite-orbit-msaa4', { samples: 4, aa: 'msaa' }], ['lite-orbit-smaa', { samples: 0, aa: 'smaa' }], ['lite-orbit-noaa', { samples: 0, aa: 'none' }], ['lite-orbit-noaa-nobloom', { samples: 0, aa: 'none', bloom: false }]]) { await post(p); await settle(800); await measure(label); }
await post({ samples: null, aa: 'msaa', bloom: true });
// decals off (contact AO) on lite orbit
await app(() => { window.studio6.planScene.root.traverse((o) => { if (o.userData && o.userData.kind === 'ao') o.visible = false; }); }); await settle(600); await measure('lite-orbit-msaa2-no-decals');
await app(() => { window.studio6.planScene.root.traverse((o) => { if (o.userData && o.userData.kind === 'ao') o.visible = true; }); });
// ground disc off
await app(() => { window.studio6.planScene.ground.group.visible = false; }); await settle(600); await measure('lite-orbit-msaa2-no-ground');
await app(() => { window.studio6.planScene.ground.group.visible = true; });
// cut off (full walls)
await app(() => { window.studio6.planScene.setCut(null); }); await settle(600); await measure('lite-orbit-msaa2-no-cut');
await app(() => { window.studio6.applyCut(); });
// walk lite variants
await app(() => { window.studio6.enterWalk(); window.studio6.gotoPosition(window.studio6.savedPositions[1], true); }); await settle(1500);
for (const [label, p] of [['lite-walk-msaa2', { samples: 2, aa: 'msaa' }], ['lite-walk-msaa4', { samples: 4, aa: 'msaa' }], ['lite-walk-smaa', { samples: 0, aa: 'smaa' }], ['lite-walk-noaa', { samples: 0, aa: 'none' }]]) { await post(p); await settle(800); await measure(label); }
await post({ samples: null, aa: 'msaa' });
// realistic rung variants (walk)
await app(() => window.studio6.setQuality(3, null, false)); await settle(1500);
for (const [label, p] of [['real-walk-msaa4-gtao', { samples: 4, aa: 'msaa', ao: true }], ['real-walk-msaa2-gtao', { samples: 2, aa: 'msaa', ao: true }], ['real-walk-msaa4-noao', { samples: 4, aa: 'msaa', ao: false }], ['real-walk-smaa-gtao', { samples: 0, aa: 'smaa', ao: true }]]) { await post(p); await settle(800); await measure(label); }
await post({ samples: null, aa: 'msaa', ao: true });
await app(() => window.studio6.exitWalk());
// q2 reference at the same size (no composer)
await app(() => window.studio6.setQuality(2)); await settle(1200); await measure('full-orbit-q2');
await app(() => { window.studio6.enterWalk(); window.studio6.gotoPosition(window.studio6.savedPositions[1], true); }); await settle(1200); await measure('full-walk-q2');
await app(() => window.studio6.exitWalk());
writeFileSync(path.join(root, 'shots', `levers-${tag}.json`), JSON.stringify(R, null, 2));
await browser.close();
