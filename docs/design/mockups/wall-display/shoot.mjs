// Playwright screenshots of the CR-030 wall display mockups (static files, file://, Chromium).
// Run from the repo root:  node docs/design/mockups/wall-display/shoot.mjs
// Writes screens/<key>.png and screens/manifest.js (read by index.html, offline).
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
// Playwright comes from frontend/node_modules of this checkout, or of the main checkout when this is a worktree.
const candidates = [path.join(repo, 'frontend', 'package.json'), path.join(process.env.SW_MAIN_CHECKOUT || 'C:/cloude/smplwisebms', 'frontend', 'package.json')];
const pw = candidates.find((p) => { try { createRequire(p).resolve('playwright'); return true; } catch { return false; } });
if (!pw) throw new Error('playwright not found; run npm ci in frontend/ or set SW_MAIN_CHECKOUT');
const { chromium } = createRequire(pw)('playwright');

const VP = { L: [1280, 800], P: [800, 1280], W: [1920, 1080], D: [1440, 900], M: [390, 844] };
const shots = [];
const add = (page, params, vp, skin, scheme, group, note) => shots.push({ page, params, vp, skin, scheme, group, note });

const WALL_STATES = ['base', 'rotating', 'info', 'alert', 'alert-stack', 'takeover', 'takeover-stack', 'resolved', 'frame', 'frame-info', 'dim', 'sleep', 'cam-stale', 'cam-lost', 'server-offline', 'server-clock', 'config-updated', 'identify', 'installer', 'sound-locked', 'no-cameras', 'revoked', 'paused', 'remote-refused', 'pairing-network'];
const PAIR_STEPS = ['start', 'code', 'claimed', 'approved', 'expired', 'denied', 'network'];
const SET_VIEWS = ['list', 'empty', 'error', 'add-code', 'add-bad', 'add-throttled', 'add-hint', 'add-form', 'drawer', 'drawer-alerts', 'drawer-frame', 'drawer-schedule', 'revoke', 'identify', 'saved'];

// 1. pairing on the tablet
for (const s of PAIR_STEPS) add('pair', `step=${s}`, 'L', 'classic', 'dark', 'pair', s);
add('pair', 'step=code', 'P', 'classic', 'dark', 'pair', 'code, portrait');
add('pair', 'step=code', 'L', 'bubble', 'dark', 'pair', 'code, bubble');
add('pair', 'step=code', 'L', 'classic', 'light', 'pair', 'code, light');
// 2. the display: every state at tablet landscape, classic dark
for (const s of WALL_STATES) add('wall', `state=${s}`, 'L', 'classic', 'dark', 'wall-states', s);
// 3. presets: the hero states at portrait and wall
for (const s of ['base', 'alert', 'takeover', 'frame', 'sleep', 'server-offline', 'cam-stale'])
  for (const vp of ['P', 'W']) add('wall', `state=${s}`, vp, 'classic', 'dark', 'wall-presets', `${s} @ ${vp}`);
add('wall', 'state=alert-stack', 'W', 'classic', 'dark', 'wall-presets', 'alert column with three items');
add('wall', 'state=takeover-stack', 'W', 'classic', 'dark', 'wall-presets', 'takeover with a stack');
add('wall', 'state=resolved', 'W', 'classic', 'dark', 'wall-presets', 'resolved in the column');
add('wall', 'state=base&cams=12', 'W', 'classic', 'dark', 'wall-presets', '12 cameras, 4x3');
add('wall', 'state=base&cams=1&preset=single', 'L', 'classic', 'dark', 'wall-presets', 'single camera preset');
add('wall', 'state=base&cams=6', 'L', 'classic', 'dark', 'wall-presets', '6 cameras, 3x2 on a tablet');
add('wall', 'state=base&cams=2', 'P', 'classic', 'dark', 'wall-presets', '2 cameras, portrait');
// 4. skins and schemes
for (const [skin, scheme] of [['bubble', 'dark'], ['classic', 'light'], ['bubble', 'light']])
  for (const s of ['base', 'alert', 'takeover', 'frame']) add('wall', `state=${s}`, 'L', skin, scheme, 'wall-skins', `${s} ${skin} ${scheme}`);
for (const s of ['base', 'alert']) for (const vp of ['P', 'W']) add('wall', `state=${s}`, vp, 'bubble', 'dark', 'wall-skins', `${s} bubble @ ${vp}`);
// 5. settings
for (const v of SET_VIEWS) add('settings', `view=${v}`, 'D', 'classic', 'light', 'settings', v);
for (const [skin, scheme] of [['bubble', 'light'], ['classic', 'dark'], ['bubble', 'dark']])
  for (const v of ['list', 'add-hint', 'drawer', 'drawer-alerts']) add('settings', `view=${v}`, 'D', skin, scheme, 'settings-skins', `${v} ${skin} ${scheme}`);
add('settings', 'view=list', 'M', 'classic', 'light', 'settings', 'list on a phone (cards)');
add('settings', 'view=drawer', 'M', 'classic', 'light', 'settings', 'drawer on a phone');
add('settings', 'view=add-code', 'M', 'classic', 'light', 'settings', 'code entry on a phone');

const outDir = path.join(here, 'screens');
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const manifest = [];
let i = 0;
for (const s of shots) {
  const [w, h] = VP[s.vp];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'he-IL', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const url = `${pathToFileURL(path.join(here, s.page + '.html')).href}?${s.params}&skin=${s.skin}&scheme=${s.scheme}&chrome=0`;
  await page.goto(url);
  await page.waitForTimeout(150);
  const key = `${String(++i).padStart(3, '0')}-${s.page}-${s.params.replace(/[^a-z0-9]+/gi, '_')}-${s.vp}-${s.skin}-${s.scheme}`;
  await page.screenshot({ path: path.join(outDir, key + '.png') });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  manifest.push({ key, ...s, w, h, errors, overflow });
  if (errors.length || overflow) console.log('!!', key, errors.join(' | '), overflow ? 'HORIZONTAL OVERFLOW' : '');
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'manifest.js'), 'window.WALL_SHOTS = ' + JSON.stringify(manifest, null, 1) + ';\n');
console.log(`${manifest.length} screenshots -> ${outDir}`);
