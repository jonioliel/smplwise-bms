// Layout safety sweep for the bubble taste mockup (Playwright, Chromium, the static files - no server).
//
//   node docs/design/mockups/bubble-taste/layout-check.mjs [--quick] [--json out.json]
//
// Sweeps every board x width (320 360 390 480 600 768 800 820 1024 1280 1440) x density (wide regular compact row)
// x surface (fill gradient glass) x theme (light dark), plus transparency (88 72 58) x theme at the default style, and the
// boards' pop-ups in each combination. Fails (exit 1) on:
//   escape     an element or a text run crossing the box of the bubble / card that contains it
//   overflow   horizontal overflow of the page, the device, the main column or a pop-up body
//   floating   a floating / absolutely positioned element intersecting interactive content outside itself
//              (checked with the main column scrolled to the top and to the bottom)
//   clipped    text cut by an overflow box without an ellipsis
//   target     an interactive element smaller than 44 x 44 px in touch layouts (<= 1100 px wide) or 32 x 32 px on desktop
// Playwright is resolved from: SW_PLAYWRIGHT (path to the package), plain `playwright`, or <repo>/frontend/node_modules/playwright
// (when this file lives in a worktree, also the main checkout's frontend).
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
function loadPlaywright() {
  const tries = [process.env.SW_PLAYWRIGHT, 'playwright', path.resolve(here, '../../../../frontend/node_modules/playwright')];
  const wt = here.match(/^(.*)[\\/]\.claude[\\/]worktrees[\\/][^\\/]+[\\/]/); // a worktree: also try the main checkout
  if (wt) tries.push(path.join(wt[1], 'frontend/node_modules/playwright'));
  for (const t of tries.filter(Boolean)) { try { return require(t); } catch { /* next */ } }
  throw new Error('Playwright not found; set SW_PLAYWRIGHT to the playwright package directory');
}
const { chromium } = loadPlaywright();

const QUICK = process.argv.includes('--quick');
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const WIDTHS = QUICK ? [320, 390, 800, 1440] : [320, 360, 390, 480, 600, 768, 800, 820, 1024, 1280, 1440];
const DENSITIES = ['wide', 'regular', 'compact', 'row'];
const SURFACES = ['fill', 'gradient', 'glass'];
const THEMES = ['light', 'dark'];
const GLASS = ['bubble', 'glass', 'max'];
const BOARDS = { home: ['area', 'confirm'], area: ['light', 'climate', 'cover'], media: ['group', 'player'] };
const PAGE_STATES = { home: [null, 'list'], area: [null, 'list'], media: [null, 'list', 'vol'] };

/* ------------------------------------------------------------------ the in-page checker */
function inPageCheck(ctx) {
  const out = [];
  const dev = document.getElementById('device');
  const touch = dev.clientWidth <= 1100;
  const MIN = touch ? 44 : 32;
  const BUBBLE = '.pill, .status, .cover, .kv > div, .np-hero, .seg, .tree-row, .floor-head, .sheet, .bigslider, .sub, .btn, .chip, .stack, .dock, .fab, .tbl td, .floorbar button, .flt button, .dd-menu, .thermo-big, .empty-np, .sep, .ring';
  const SKIP = '.art-glow, .np-hero .bg, .mk-bar, .mk-bar *, .sr'; // .sr = visually hidden text for screen readers
  const DECOR = '.lay, .bl'; // clipped label layers of the slider pills (clip-path by design)
  const INTER = 'button, a[href], [role="slider"], [role="button"], [role="switch"], [role="option"], input, select, [tabindex="0"]';
  const desc = (el) => {
    const c = [...el.classList].slice(0, 3).join('.');
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `${el.tagName.toLowerCase()}${c ? '.' + c : ''}${t ? ` "${t}"` : ''}`;
  };
  const csC = new Map(); const cs = (el) => { let s = csC.get(el); if (!s) { s = getComputedStyle(el); csC.set(el, s); } return s; };
  const hidC = new Map();
  const hidden = (el) => { if (!el || el === document.body) return false; if (hidC.has(el)) return hidC.get(el); const s = cs(el); const h = s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || hidden(el.parentElement); hidC.set(el, h); return h; };
  const scrolls = (s) => /(auto|scroll)/.test(s.overflowX + s.overflowY);
  const clips = (s) => s.overflowX !== 'visible' || s.overflowY !== 'visible';
  const R = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  const inter = (a, b) => ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) });
  const empty = (a) => a.r - a.l < 1 || a.b - a.t < 1;
  function visRect(el) { // the part of el that is not clipped by overflow ancestors (within the device)
    let v = R(el.getBoundingClientRect());
    for (let e = el.parentElement; e && e !== dev.parentElement; e = e.parentElement) if (clips(cs(e))) v = inter(v, R(e.getBoundingClientRect()));
    return v;
  }
  const inert = (el) => !!el.closest('[inert]');
  const add = (cls, el, detail) => out.push({ cls, el: desc(el), detail, ...ctx });

  // overflow
  const ov = (el, name) => { if (el && !hidden(el) && el.scrollWidth > el.clientWidth + 1) add('overflow', el, `${name} scrollWidth ${el.scrollWidth} > ${el.clientWidth}`); };
  if (document.documentElement.scrollWidth > innerWidth + 1) add('overflow', document.documentElement, `page ${document.documentElement.scrollWidth} > ${innerWidth}`);
  ov(dev, 'device'); ov(document.getElementById('main'), 'main');
  document.querySelectorAll('.sheet.open .sheet-body').forEach((b) => ov(b, 'sheet-body'));

  const sheetOpen = !!document.querySelector('.sheet.open');
  const scope = sheetOpen ? document.querySelector('.sheet.open') : dev;

  // escape: elements and text runs must stay inside their bubble
  for (const b of scope.querySelectorAll(BUBBLE)) {
    if (hidden(b) || b.closest(SKIP) || inert(b)) continue;
    const br = R(b.getBoundingClientRect()); if (empty(br)) continue;
    if (empty(visRect(b))) continue;
    for (const d of b.querySelectorAll('*')) {
      if (d.matches(SKIP) || d.closest(DECOR) || hidden(d)) continue;
      let between = false; for (let e = d.parentElement; e && e !== b; e = e.parentElement) if (scrolls(cs(e))) { between = true; break; }
      if (between) continue;
      const r = R(d.getBoundingClientRect()); if (empty(r)) continue;
      if (r.l < br.l - 1.5 || r.r > br.r + 1.5 || r.t < br.t - 1.5 || r.b > br.b + 1.5) {
        add('escape', d, `outside ${desc(b)} by ${Math.round(Math.max(br.l - r.l, r.r - br.r, br.t - r.t, r.b - br.b))}px`);
      }
    }
  }
  // clipped text (and text escaping a non-clipping bubble)
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (!el || el.closest(SKIP) || el.closest(DECOR) || el.closest('svg, script, style') || hidden(el) || inert(el)) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const tr = R(range.getBoundingClientRect()); if (empty(tr)) continue;
    let cornerDone = false;
    for (let e = el; e && e !== dev; e = e.parentElement) {
      const s = cs(e);
      if (scrolls(s)) break; // scrolled text is fine
      const er = R(e.getBoundingClientRect());
      const outX = tr.l < er.l - 1.5 || tr.r > er.r + 1.5;
      if (clips(s) && outX) {
        const ell = cs(el).textOverflow === 'ellipsis' || s.textOverflow === 'ellipsis';
        if (!ell) add('clipped', el, `text cut by ${desc(e)}`);
        break;
      }
      if (e.matches(BUBBLE) && outX) { add('escape', el, `text outside ${desc(e)}`); break; }
      if (e.matches(BUBBLE) && !cornerDone) { cornerDone = true; // text inside the box but in a rounded corner is cut by the curve
        const rad = Math.min(parseFloat(s.borderTopLeftRadius) || 0, (er.b - er.t) / 2, (er.r - er.l) / 2);
        if (rad > 4) {
          const pts = [[tr.l + 1, tr.t + 3], [tr.r - 1, tr.t + 3], [tr.l + 1, tr.b - 3], [tr.r - 1, tr.b - 3]];
          const cut = pts.some(([x, y]) => {
            const cx = x < er.l + rad ? er.l + rad : x > er.r - rad ? er.r - rad : null;
            const cy = y < er.t + rad ? er.t + rad : y > er.b - rad ? er.b - rad : null;
            return cx !== null && cy !== null && Math.hypot(x - cx, y - cy) > rad + 1;
          });
          if (cut) add('clipped', el, `text in the rounded corner of ${desc(e)}`);
        }
      }
    }
  }
  // touch targets
  for (const el of scope.querySelectorAll(INTER)) {
    if (el.getAttribute('tabindex') === '-1' || hidden(el) || inert(el) || el.closest(SKIP) || el.disabled) continue;
    if (empty(visRect(el))) continue;
    const r = el.getBoundingClientRect();
    if (r.width < MIN - 0.5 || r.height < MIN - 0.5) add('target', el, `${Math.round(r.width)}x${Math.round(r.height)} < ${MIN}`);
  }
  // floating elements over interactive content (outside modal layers, which cover the page by design)
  if (!sheetOpen) {
    const floats = [...dev.querySelectorAll('*')].filter((e) => { const s = cs(e); return (s.position === 'absolute' || s.position === 'fixed' || s.position === 'sticky') && !e.matches(DECOR) && !e.closest(DECOR) && !e.matches('.scrim, .sheet, .toast, .dd-menu, .art-glow, .np-hero .bg') && !hidden(e); });
    const targets = [...dev.querySelectorAll(INTER)].filter((t) => !hidden(t) && t.getAttribute('tabindex') !== '-1');
    for (const f of floats) {
      const fr = visRect(f); if (empty(fr)) continue;
      for (const t of targets) {
        if (f.contains(t) || t.contains(f)) continue;
        // only content painted in the same scroll context matters: skip targets that are an ancestor bubble of f
        const ir = inter(fr, visRect(t));
        if (!empty(ir) && (ir.r - ir.l) * (ir.b - ir.t) > 4) add('floating', f, `covers ${desc(t)}`);
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ driver */
const results = [];
const t0 = Date.now();
const browser = await chromium.launch();
const ctxB = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
const page = await ctxB.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const height = (w) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
let runs = 0;

async function setCombo(o) {
  await page.evaluate((o) => {
    if (Sheet.isOpen()) Sheet.close();
    if (typeof closeSceneMenu === 'function') closeSceneMenu();
    VOL_OPEN.clear();
    Object.assign(STATE, o.state); applyScheme();
    Mock.refresh();
    document.getElementById('main').scrollTop = 0;
  }, o);
  await settle();
}
async function check(ctx) {
  runs++;
  const top = await page.evaluate(inPageCheck, ctx);
  results.push(...top);
  // the main column scrolled to the bottom: floating elements may now sit over the last content
  const bottom = await page.evaluate((ctx) => { const m = document.getElementById('main'); m.scrollTop = m.scrollHeight; return ctx; }, ctx);
  await settle();
  results.push(...(await page.evaluate(inPageCheck, { ...bottom, scroll: 'bottom' })).filter((r) => r.cls === 'floating'));
  await page.evaluate(() => { document.getElementById('main').scrollTop = 0; });
}

for (const board of Object.keys(BOARDS)) {
  const url = pathToFileURL(path.join(here, `${board}.html`)).href + '?shot=1&vp=fit&scheme=light';
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url); await settle();
  const combos = [];
  for (const theme of THEMES) for (const density of DENSITIES) for (const surface of SURFACES) combos.push({ theme, density, surface, glass: 'glass' });
  for (const theme of THEMES) for (const glass of GLASS) if (glass !== 'glass') combos.push({ theme, density: 'regular', surface: 'fill', glass });
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: height(w) }); await settle();
    for (const c of combos) {
      for (const ps of PAGE_STATES[board]) {
        const state = { scheme: c.theme, density: c.density, surface: c.surface, glass: c.glass, view: ps === 'list' ? 'list' : 'cards' };
        await setCombo({ state });
        if (ps === 'vol') { await page.evaluate(() => { Mock.openers.vol(); }); await settle(); }
        await check({ board, w, ...c, state: ps || 'page' });
      }
      for (const op of BOARDS[board]) {
        await setCombo({ state: { scheme: c.theme, density: c.density, surface: c.surface, glass: c.glass, view: 'cards' } });
        await page.evaluate((op) => Mock.openers[op](), op); await settle();
        runs++;
        results.push(...(await page.evaluate(inPageCheck, { board, w, ...c, state: 'popup:' + op })));
      }
    }
  }
}
await browser.close();

/* ------------------------------------------------------------------ report */
const byCls = {};
const uniq = new Map();
for (const r of results) {
  byCls[r.cls] = (byCls[r.cls] || 0) + 1;
  const k = `${r.cls}|${r.board}|${r.state}|${r.el}|${r.detail}`;
  if (!uniq.has(k)) uniq.set(k, { ...r, widths: new Set(), n: 0 });
  const u = uniq.get(k); u.widths.add(r.w); u.n++;
}
console.log(`layout-check: ${runs} checks (${WIDTHS.length} widths), ${((Date.now() - t0) / 1000).toFixed(0)} s, page errors: ${errors.length}`);
for (const cls of ['escape', 'overflow', 'floating', 'clipped', 'target']) console.log(`  ${cls.padEnd(9)} ${byCls[cls] || 0}`);
const list = [...uniq.values()].sort((a, b) => b.n - a.n);
for (const u of list.slice(0, 60)) console.log(`  [${u.cls}] ${u.board} ${u.state} ${u.el} - ${u.detail} (x${u.n}; widths ${[...u.widths].sort((a, b) => a - b).join(',')})`);
if (list.length > 60) console.log(`  ... ${list.length - 60} more distinct findings`);
if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 10));
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ byCls, findings: list.map((u) => ({ ...u, widths: [...u.widths] })) }, null, 1));
process.exit(results.length || errors.length ? 1 : 0);
