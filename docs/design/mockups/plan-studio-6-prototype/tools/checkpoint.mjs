/**
 * The owner-checkpoint frames (ST7 plan, ~hour 8): iso day, iso night with lamps, living-room walk - in BOTH styles.
 *   SW_NODE_MODULES=<frontend/node_modules> SW_GPU=1 SW_URL=http://127.0.0.1:4190/index.html node tools/checkpoint.mjs [outDir] [tag]
 * Default outDir: docs/design/studio6/checkpoint/ ; files <tag><style>-<frame>.png at 1440x900.
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
const GPU = process.env.SW_GPU === '1';
const out = path.resolve(process.argv[2] || path.join(root, '../../studio6/checkpoint'));
const tag = process.argv[3] || '';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true, args: GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
const url = process.env.SW_URL || pathToFileURL(path.join(root, 'index.html')).href;
await page.goto(url);
await page.waitForFunction(() => window.studio6 && window.studio6.planScene && window.studio6.planScene.levels.L0, null, { timeout: 180000 });
await page.waitForTimeout(GPU ? 4500 : 9000);
// CC0 file textures load lazily: wait until every requested set has arrived (or 30 s), then let the frame settle
await page.waitForFunction(() => { const l = window.studio6.lib; return !l.loader || [...l.cache.keys()].every((id) => !l.cache.get(id).file || l.loaded.has(id) || (l.failed && l.failed.has(id))); }, null, { timeout: 30000 }).catch(() => console.log('texture wait timed out'));
await page.waitForTimeout(800);
const app = (fn, ...args) => page.evaluate(fn, ...args);
const settle = async (ms = 1500) => { await app(() => window.studio6.invalidate()); await page.waitForTimeout(ms); };
const hour = (h) => app((h) => { document.getElementById('sun-slider').value = h * 60; window.studio6.env.setTime({ hour: h, weather: 'clear' }); window.studio6.updateSunCard(); }, h);
const shot = async (name) => { await page.screenshot({ path: path.join(out, name), timeout: 240000 }); console.log('shot', name); };
await app(() => { window.studio6.opts.autoLadder = false; window.studio6.probe = null; window.studio6.continuous = false; });
const report = {};
for (const style of ['light', 'dark']) {
  await app((s) => { document.documentElement.dataset.theme = s === 'dark' ? 'dark' : ''; window.studio6.setStyle(s); }, style);
  await app(() => { if (window.studio6.mode === 'walk') window.studio6.exitWalk(); window.studio6.setQuality(3, null, false); window.studio6.setLevelMode('L0'); window.studio6.fitCamera('iso'); window.studio6.setMany((k) => k.startsWith('light.'), 'off'); window.studio6.setEntity('light.living', 'on'); window.studio6.setEntity('light.kitchen', 'on'); });
  await hour(15.5); await settle(2500); await shot(`${tag}${style}-1-iso-day.png`);
  await hour(22.5); await app(() => { window.studio6.setMany((k) => k.startsWith('light.'), 'on'); window.studio6.setEntity('light.wc', 'off'); window.studio6.setEntity('light.utility', 'off'); window.studio6.syncPanel(); }); await settle(2500); await shot(`${tag}${style}-2-iso-night-lamps.png`);
  await hour(16.0); await app(() => { window.studio6.setMany((k) => k.startsWith('light.'), 'off'); window.studio6.setEntity('light.living', 'on'); window.studio6.setEntity('light.living_floor', 'on'); window.studio6.enterWalk(); window.studio6.gotoPosition(window.studio6.savedPositions[1], true); window.studio6.walk.yaw = 0.35; window.studio6.walk.pitch = -0.04; });
  await settle(2500); await shot(`${tag}${style}-3-walk-living.png`);
  report[style] = await page.locator('#hud').innerText();
  await app(() => window.studio6.exitWalk());
}
report.errors = errors;
writeFileSync(path.join(out, `${tag}checkpoint.json`), JSON.stringify(report, null, 2));
console.log('errors:', errors.length, errors.slice(0, 5));
await browser.close();
