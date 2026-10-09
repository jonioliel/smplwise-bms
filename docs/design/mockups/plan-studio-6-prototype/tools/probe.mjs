/**
 * Developer probe: boots the page headless and runs one JS expression against window.studio6 (debugging aid).
 *   SW_NODE_MODULES=... SW_GPU=1 SW_URL=... node tools/probe.mjs "<js expression returning JSON-able>"
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const nm = process.env.SW_NODE_MODULES || path.resolve(root, '../../../../frontend/node_modules');
const require = createRequire(path.join(nm, 'x.js'));
const { chromium } = require('playwright');
const GPU = process.env.SW_GPU === '1';
const browser = await chromium.launch({ headless: true, args: GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(process.env.SW_URL || pathToFileURL(path.join(root, 'index.html')).href);
await page.waitForFunction(() => window.studio6 && window.studio6.planScene && window.studio6.planScene.levels.L0, null, { timeout: 180000 });
await page.waitForTimeout(1500);
const r = await page.evaluate(process.argv[2] || 'Object.keys(window.studio6.planScene.levels)');
console.log(JSON.stringify(r, null, 1));
if (process.env.SW_SHOT) {
  await page.evaluate(() => window.studio6.invalidate()); await page.waitForTimeout(2500);
  const clip = process.env.SW_CLIP ? (([x, y, width, height]) => ({ x, y, width, height }))(process.env.SW_CLIP.split(',').map(Number)) : undefined;
  await page.screenshot({ path: process.env.SW_SHOT, clip, timeout: 240000 }); console.log('shot', process.env.SW_SHOT);
}
if (errors.length) console.log('errors', errors);
await browser.close();
