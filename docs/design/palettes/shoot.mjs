// Screenshots of index.html for every palette x scheme at 390 and 1440 (Playwright Chromium, static file, no server).
//   node docs/design/palettes/shoot.mjs            # -> docs/design/palettes/screens/<id>-<scheme>-<width>.png
// Playwright: SW_PLAYWRIGHT, a global `playwright`, or <repo>/frontend/node_modules/playwright (also the main checkout's
// when this file lives in a worktree). Exit 1 on any console error.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
function loadPlaywright() {
  const tries = [process.env.SW_PLAYWRIGHT, 'playwright', path.resolve(here, '../../../frontend/node_modules/playwright')];
  const wt = here.match(/^(.*)[\\/]\.claude[\\/]worktrees[\\/][^\\/]+[\\/]/);
  if (wt) tries.push(path.join(wt[1], 'frontend/node_modules/playwright'));
  for (const t of tries.filter(Boolean)) { try { return require(t); } catch { /* next */ } }
  throw new Error('Playwright not found; set SW_PLAYWRIGHT to the playwright package directory');
}
const { chromium } = loadPlaywright();
const data = fs.readFileSync(path.join(here, 'preview-data.js'), 'utf8');
const ids = [...JSON.parse(data.match(/window\.SW_PALETTES = (.*);\n/)[1]).palettes].map((p) => p.id);
const out = path.join(here, 'screens'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];
let n = 0;
for (const w of [390, 1440]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${w}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${w}: ${e.message}`));
  for (const id of ids) for (const scheme of ['light', 'dark']) {
    const url = pathToFileURL(path.join(here, 'index.html')).href + `?p=${id}&scheme=${scheme}&op=min`;
    await page.goto(url); await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(out, `${id}-${scheme}-${w}.png`), fullPage: true }); n++;
  }
  await ctx.close();
}
await browser.close();
console.log(`${n} screenshots in ${out}; console errors/warnings: ${errors.length}`);
for (const e of errors) console.log('  ' + e);
process.exit(errors.length ? 1 : 0);
