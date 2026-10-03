// Playwright evidence for the CR-023 electricity mockup gallery. Serves docs/design on a local port, walks the screens through
// the gallery's own URL hash, saves PNGs next to this script and fails on page errors or horizontal overflow of the frame.
// Run from the repository root of a checkout that has frontend/node_modules (the test runner):
//   node docs/evidence/electricity-mockup/shots.mjs [name-filter]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const WT = process.env.ARX_WT || fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '');
const { chromium } = createRequire(`${WT}/frontend/package.json`)('playwright');
const ROOT = `${WT}/docs/design`;
const OUT = `${WT}/docs/evidence/electricity-mockup`;
const PORT = Number(process.env.PORT || 4573);
const only = process.argv[2] || '';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', TYPES[path.extname(p)] || 'application/octet-stream'); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch();
const errors = [];
let n = 0;
const W = { desktop: 1440, tablet: 820, phone: 390 };

async function shot(s, { d = 'desktop', t = 'light', k = 'classic', p = 'full', name } = {}) {
  n += 1;
  const file = name || `${String(n).padStart(3, '0')}-${s}-${W[d]}-${t}${k === 'classic' ? '' : '-' + k}${p === 'view' ? '-viewonly' : ''}`;
  if (only && !file.includes(only)) return;
  const ctx = await browser.newContext({ viewport: { width: W[d] + 80, height: 1000 }, deviceScaleFactor: 1, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${file}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${file}: console ${m.text()}`); });
  await page.goto(`http://127.0.0.1:${PORT}/mockups/electricity/index.html#s=${s}&d=${d}&t=${t}&k=${k}&p=${p}`);
  await page.waitForSelector(s === 'matrix' ? '.matrix' : '#frame .app');
  await page.evaluate(() => { document.getElementById('bar').style.display = 'none'; const c = document.getElementById('cap'); if (c) c.style.display = 'none'; return document.fonts.ready; });
  await page.waitForTimeout(150);
  if (s !== 'matrix') {
    const ov = await page.evaluate(() => {
      const f = document.getElementById('frame').getBoundingClientRect(); const bad = [];
      const scrollable = (el) => { for (let q = el.parentElement; q && q.id !== 'frame'; q = q.parentElement) { const o = getComputedStyle(q).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
      for (const el of document.querySelectorAll('#frame *')) { const r = el.getBoundingClientRect(); if (r.width > 0 && (r.left < f.left - 1 || r.right > f.right + 1) && !scrollable(el)) bad.push(el.tagName.toLowerCase() + '.' + String(el.className.baseVal ?? el.className).split(' ').slice(0, 2).join('.')); }
      return bad.slice(0, 4);
    });
    if (ov.length) errors.push(`${file}: horizontal overflow: ${ov.join(', ')}`);
    await page.locator('#frame').screenshot({ path: path.join(OUT, `${file}.png`) });
  } else {
    await page.screenshot({ path: path.join(OUT, `${file}.png`), fullPage: true });
  }
  console.log('saved', file);
  await ctx.close();
}

const ALL = await (async () => { const ctx = await browser.newContext(); const pg = await ctx.newPage(); await pg.goto(`http://127.0.0.1:${PORT}/mockups/electricity/index.html`); const ids = await pg.evaluate(() => window.SCREENS.map((x) => x[1])); await ctx.close(); return ids; })();
const MAIN = ['meters', 'account', 'w2', 'bill', 'bills', 'set-tariffs'];

for (const s of ALL) await shot(s);                                   // every screen, desktop light classic
for (const s of ALL) await shot(s, { d: 'phone' });                    // every screen, phone light classic
for (const s of ['meters', 'accounts', 'account', 'w1', 'w2', 'bill', 'bills', 'set-tariffs', 'set-retention']) await shot(s, { d: 'tablet' });
for (const s of [...MAIN, 'meter-kw', 'w1-kw', 'w2-neg', 'dlg-issue']) await shot(s, { t: 'dark' });
for (const s of ['meters', 'account', 'w2', 'bill', 'bills', 'w1-kw']) await shot(s, { d: 'phone', t: 'dark' });
for (const k of ['domus', 'tesla', 'bubble']) for (const t of ['light', 'dark']) for (const s of ['meters', 'account', 'w2', 'bill']) await shot(s, { k, t });
for (const k of ['domus', 'tesla', 'bubble']) await shot('meters', { k, d: 'phone' });
await shot('meters', { p: 'view' }); await shot('account', { p: 'view' }); await shot('account', { p: 'view', d: 'phone' }); await shot('bills', { p: 'view' });
await shot('matrix', { name: 'matrix-meters' });

await browser.close(); server.close();
if (errors.length) { console.error('ERRORS\n' + errors.join('\n')); process.exit(1); }
console.log(`done, ${n} views`);
