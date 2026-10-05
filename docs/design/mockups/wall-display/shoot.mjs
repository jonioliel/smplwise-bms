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

const VP = { L: [1280, 800], P: [800, 1280], T: [1920, 1200], D: [1440, 900], M: [390, 844] };
const shots = [];
const add = (page, params, vp, skin, scheme, group, note) => shots.push({ page, params, vp, skin, scheme, group, note });

const WALL_STATES = ['base', 'rotating', 'info', 'alert', 'alert-stack', 'takeover', 'takeover-stack', 'resolved', 'frame', 'frame-info', 'dim', 'sleep', 'cam-stale', 'cam-lost', 'server-offline', 'server-clock', 'config-updated', 'installer', 'sound-locked', 'no-cameras', 'access-removed', 'remote-refused', 'no-connection'];
const LOGIN_STEPS = ['form', 'error', 'detect', 'removed'];
const SET_VIEWS = ['list', 'empty', 'error', 'add', 'add-form', 'drawer', 'drawer-alerts', 'drawer-frame', 'drawer-schedule', 'remove', 'saved'];

// 1. the normal login on a tablet, and what the same user sees on a phone / desktop (detection)
for (const s of LOGIN_STEPS) add('login', `step=${s}`, 'L', 'classic', 'dark', 'login', `login: ${s}`);
add('login', 'step=form', 'P', 'classic', 'dark', 'login', 'login, portrait');
add('login', 'step=form', 'L', 'bubble', 'dark', 'login', 'login, bubble');
add('app', 'cls=phone', 'M', 'classic', 'light', 'login', 'same user on a phone: the normal application');
add('app', 'cls=desktop', 'D', 'classic', 'light', 'login', 'same user on a desktop: the normal application');
add('detect', 'view=1', 'D', 'classic', 'light', 'login', 'detection rule, three results, the check table');
// 2. the display: every state at tablet landscape, classic dark
for (const s of WALL_STATES) add('wall', `state=${s}`, 'L', 'classic', 'dark', 'wall-states', s);
add('wall', 'state=alert&ack=on', 'L', 'classic', 'dark', 'wall-states', 'alert tile with acknowledge enabled (press and hold)');
// 3. presets: portrait, large tablet landscape, single, 6 cameras
for (const s of ['base', 'alert', 'takeover', 'frame', 'sleep', 'server-offline', 'cam-stale']) add('wall', `state=${s}`, 'P', 'classic', 'dark', 'wall-presets', `${s} @ portrait`);
for (const s of ['base', 'alert', 'takeover']) add('wall', `state=${s}&cams=6`, 'T', 'classic', 'dark', 'wall-presets', `${s} @ large tablet 1920x1200`);
add('wall', 'state=base&cams=1&preset=single', 'L', 'classic', 'dark', 'wall-presets', 'single camera preset');
add('wall', 'state=base&cams=6', 'L', 'classic', 'dark', 'wall-presets', '6 cameras, 3x2 on a tablet');
add('wall', 'state=base&cams=2', 'P', 'classic', 'dark', 'wall-presets', '2 cameras, portrait');
// 4. skins and schemes
for (const [skin, scheme] of [['bubble', 'dark'], ['classic', 'light'], ['bubble', 'light']])
  for (const s of ['base', 'alert', 'takeover', 'frame']) add('wall', `state=${s}`, 'L', skin, scheme, 'wall-skins', `${s} ${skin} ${scheme}`);
for (const s of ['base', 'alert']) add('wall', `state=${s}`, 'P', 'bubble', 'dark', 'wall-skins', `${s} bubble @ portrait`);
// 5. settings
for (const v of SET_VIEWS) add('settings', `view=${v}`, 'D', 'classic', 'light', 'settings', v);
for (const [skin, scheme] of [['bubble', 'light'], ['classic', 'dark'], ['bubble', 'dark']])
  for (const v of ['list', 'add-form', 'drawer', 'drawer-alerts']) add('settings', `view=${v}`, 'D', skin, scheme, 'settings-skins', `${v} ${skin} ${scheme}`);
add('settings', 'view=list', 'M', 'classic', 'light', 'settings', 'list on a phone (cards)');
add('settings', 'view=drawer', 'M', 'classic', 'light', 'settings', 'drawer on a phone');
add('settings', 'view=add-form', 'M', 'classic', 'light', 'settings', 'add dialog on a phone');

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
