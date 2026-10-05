/* Screenshots of every mockup state (Playwright Chromium, local files, no network).
   node docs/design/mockups/cast-to-screens/shoot.mjs [--quick]
   Playwright comes from SW_PLAYWRIGHT, a global `playwright`, or frontend/node_modules/playwright (also the main checkout's from a worktree). */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
function loadPw() {
  const cands = [process.env.SW_PLAYWRIGHT, 'playwright', path.resolve(here, '../../../../frontend/node_modules/playwright'), 'C:/cloude/smplwisebms/frontend/node_modules/playwright'].filter(Boolean);
  for (const c of cands) { try { return require(c); } catch { /* next */ } }
  throw new Error('playwright not found');
}
const { chromium } = loadPw();
const quick = process.argv.includes('--quick');
const out = path.join(here, 'shots'); mkdirSync(out, { recursive: true });

const PAGES = {
  '01-live-camera': ['idle', 'picker', 'busy', 'starting', 'playing', 'not_confirmed', 'timeout', 'codec', 'noperm', 'notargets', 'relay', 'remote'],
  '02-wall': ['idle', 'picker', 'select', 'mosaic', 'carousel', 'cpu', 'phase1'],
  '03-active-tray': ['tray', 'countdown', 'switch', 'limit', 'bulk', 'closed'],
  '04-errors': ['gallery'],
  '05-permissions': ['matrix', 'approve', 'audit'],
  '06-settings': ['desktop', 'filter', 'sort', 'tablet', 'form', 'mine', 'general'],
  '07-lab-test': ['prereq', 'origin', 'approve', 'run', 'evidence'],
  'index': [''],
};
const VPS = { 1440: [1440, 900], 1024: [1024, 1366], 390: [390, 844] };
/* full matrix for the two hero pages; the others at 1440 light/dark + 390 light (quick: 1440 light only) */
function combos(page) {
  if (quick) return [['1440', 'light', 'classic']];
  if (page === '01-live-camera' || page === '02-wall') return [['1440', 'light', 'classic'], ['1440', 'dark', 'classic'], ['1440', 'light', 'bubble'], ['1440', 'dark', 'bubble'], ['1024', 'light', 'classic'], ['390', 'light', 'classic'], ['390', 'dark', 'bubble']];
  if (page === '06-settings') return [['1440', 'light', 'classic'], ['1440', 'dark', 'classic'], ['1024', 'light', 'classic'], ['390', 'light', 'classic'], ['1440', 'light', 'bubble']];
  if (page === 'index') return [['1440', 'light', 'classic']];
  return [['1440', 'light', 'classic'], ['1440', 'dark', 'classic'], ['390', 'light', 'classic'], ['1440', 'light', 'bubble']];
}
const browser = await chromium.launch();
let n = 0; const errors = [];
for (const [page, states] of Object.entries(PAGES)) {
  for (const [vp, scheme, skin] of combos(page)) {
    const [w, h] = VPS[vp];
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => errors.push(`${page}: ${e.message}`));
    pg.on('console', (m) => { if (m.type() === 'error') errors.push(`${page}: ${m.text()}`); });
    for (const st of states) {
      const u = pathToFileURL(path.join(here, `${page}.html`)); u.searchParams.set('vp', 'fit'); u.searchParams.set('scheme', scheme); u.searchParams.set('skin', skin); u.searchParams.set('ann', '1'); u.searchParams.set('shot', '1'); if (st) u.searchParams.set('state', st);
      await pg.goto(u.toString()); await pg.waitForTimeout(700);
      const name = `${page}${st ? '-' + st : ''}-${vp}-${scheme}${skin === 'bubble' ? '-bubble' : ''}.png`;
      await pg.screenshot({ path: path.join(out, name), fullPage: page === 'index' || page === '04-errors' || page === '05-permissions' });
      n++;
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`${n} screenshots -> ${out}`);
if (errors.length) { console.log('page errors:'); for (const e of errors) console.log('  ' + e); process.exitCode = 1; } else console.log('page errors: 0');
