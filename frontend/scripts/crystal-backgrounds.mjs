// CRY (2026-10-10): the two original background artworks of the Crystal skin, drawn in code (no photographs, no third-party or
// generated images). "Pearl atrium" (day): a pale sky, a sun bloom, tall glass panes with bright edges, soft light rays and a
// reflective floor. "Indigo skyline" (night): a deep sky with a moon and stars, two soft aurora bands, a skyline silhouette with a
// few lit windows, and its reflection in still water. Both keep the central band calm and the luminance in the range the glass
// panels need (day bright, night dark), so text on the canvas keeps its contrast under the skin's veil.
//
//   node scripts/crystal-backgrounds.mjs            writes src/design/backgrounds/crystal-{day,night}.svg (the sources)
//   node scripts/crystal-backgrounds.mjs --render   also renders them with the bundled Chromium to <out>/crystal-{day,night}.png
//                                                   (2560 x 1440); scripts/export_backgrounds.py turns the PNGs into the WebP files
//                                                   the product ships (public/backgrounds/), each under 250 KB.
// Deterministic: a seeded generator places the stars, windows and bokeh, so a re-run reproduces the same files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../src/design/backgrounds');
const W = 2560;
const H = 1440;

/** A small seeded generator (mulberry32) so every run draws the same picture. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n, d = 1) => Number(n.toFixed(d));

function day() {
  const r = rng(20261010);
  const panes = [];
  // tall glass panes along the left third, slightly skewed, each a little brighter at its top edge
  const xs = [60, 300, 520, 760, 980, 1180];
  xs.forEach((x, i) => {
    const w = 170 + (i % 3) * 40;
    const top = 120 + (i % 2) * 60;
    const skew = 70;
    const a = 0.34 + (i % 2) * 0.1;
    panes.push(`<polygon points="${x},${top} ${x + w},${top - 40} ${x + w - skew},${H + 40} ${x - skew},${H + 40}" fill="url(#pane)" opacity="${a}"/>`);
    panes.push(`<line x1="${x}" y1="${top}" x2="${x - skew}" y2="${H + 40}" stroke="#ffffff" stroke-opacity="0.85" stroke-width="3"/>`);
  });
  const bokeh = [];
  for (let i = 0; i < 14; i++) {
    const cx = f(1500 + r() * 1000);
    const cy = f(80 + r() * 620);
    const rad = f(40 + r() * 110);
    bokeh.push(`<circle cx="${cx}" cy="${cy}" r="${rad}" fill="#ffffff" opacity="${f(0.14 + r() * 0.2, 2)}" filter="url(#soft)"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>Crystal day - pearl atrium (SmplWise Arx, original artwork drawn in code)</title>
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#c4dcf6"/><stop offset="0.42" stop-color="#e3eefa"/><stop offset="0.66" stop-color="#f3f6fb"/><stop offset="1" stop-color="#d9e3f1"/>
  </linearGradient>
  <radialGradient id="sun" cx="0.82" cy="0.10" r="0.42">
    <stop offset="0" stop-color="#fff1cc" stop-opacity="1"/><stop offset="0.35" stop-color="#ffe9c2" stop-opacity="0.55"/><stop offset="1" stop-color="#fff1d6" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="prism" cx="0.08" cy="0.95" r="0.55">
    <stop offset="0" stop-color="#9fd3ff" stop-opacity="0.6"/><stop offset="0.5" stop-color="#c9bfff" stop-opacity="0.3"/><stop offset="1" stop-color="#d8d2ff" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="pane" x1="0" y1="0" x2="0.3" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity="1"/><stop offset="0.5" stop-color="#a9d2ff" stop-opacity="0.55"/><stop offset="1" stop-color="#8fbaf0" stop-opacity="0.35"/>
  </linearGradient>
  <linearGradient id="ray" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.0"/><stop offset="0.55" stop-color="#ffffff" stop-opacity="0.4"/><stop offset="1" stop-color="#c7d6ea" stop-opacity="0.75"/>
  </linearGradient>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
  <filter id="wide" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="60"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<rect width="${W}" height="${H}" fill="url(#prism)"/>
<rect width="${W}" height="${H}" fill="url(#sun)"/>
<!-- light rays from the upper right -->
<g filter="url(#wide)" opacity="0.9">
  <polygon points="2560,0 2200,0 600,1440 1100,1440" fill="url(#ray)"/>
  <polygon points="2560,260 2560,60 1400,1440 1750,1440" fill="url(#ray)"/>
  <polygon points="2000,0 1780,0 100,1440 420,1440" fill="url(#ray)" opacity="0.6"/>
</g>
<!-- glass panes -->
<g>${panes.join('')}</g>
<!-- the reflective floor -->
<rect x="0" y="${H * 0.62}" width="${W}" height="${H * 0.38}" fill="url(#floor)"/>
<line x1="0" y1="${H * 0.62}" x2="${W}" y2="${H * 0.62}" stroke="#ffffff" stroke-opacity="0.7" stroke-width="2"/>
<!-- bokeh -->
<g>${bokeh.join('')}</g>
</svg>
`;
}

function night() {
  const r = rng(20261011);
  const stars = [];
  for (let i = 0; i < 90; i++) {
    const cx = f(r() * W);
    const cy = f(r() * H * 0.52);
    const rad = f(0.8 + r() * 1.6);
    stars.push(`<circle cx="${cx}" cy="${cy}" r="${rad}" fill="#ffffff" opacity="${f(0.25 + r() * 0.55, 2)}"/>`);
  }
  // the skyline: towers of varied width and height along the bottom, flat and rounded tops; their mirror image below the water line
  const water = H * 0.80;
  const towers = [];
  let x = -40;
  const heights = [];
  while (x < W + 40) {
    const w = f(60 + r() * 150);
    const h = f(120 + r() * 420);
    const top = water - h;
    heights.push({ x, w, top, h });
    towers.push(`<rect x="${x}" y="${top}" width="${w}" height="${h + 10}" rx="${r() > 0.6 ? 10 : 2}" fill="#070c18"/>`);
    x += w + f(6 + r() * 30);
  }
  const windows = [];
  for (const t of heights) {
    const n = Math.floor(r() * 5);
    for (let i = 0; i < n; i++) {
      const wx = f(t.x + 12 + r() * (t.w - 24));
      const wy = f(t.top + 18 + r() * (t.h - 40));
      const warm = r() > 0.4;
      windows.push(`<rect x="${wx}" y="${wy}" width="5" height="7" fill="${warm ? '#ffd79a' : '#9ec4ff'}" opacity="${f(0.25 + r() * 0.3, 2)}"/>`);
    }
  }
  const streaks = [];
  for (let i = 0; i < 18; i++) {
    const sx = f(r() * W);
    const sw = f(3 + r() * 10);
    streaks.push(`<rect x="${sx}" y="${water}" width="${sw}" height="${f(60 + r() * 220)}" fill="${r() > 0.5 ? '#9ec4ff' : '#ffd79a'}" opacity="${f(0.06 + r() * 0.1, 2)}" filter="url(#soft)"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>Crystal night - indigo skyline (SmplWise Arx, original artwork drawn in code)</title>
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0a1024"/><stop offset="0.45" stop-color="#0f1a38"/><stop offset="0.8" stop-color="#0c1428"/><stop offset="1" stop-color="#060912"/>
  </linearGradient>
  <radialGradient id="moon" cx="0.78" cy="0.14" r="0.30">
    <stop offset="0" stop-color="#c9d9ff" stop-opacity="0.42"/><stop offset="0.4" stop-color="#9fb8ff" stop-opacity="0.12"/><stop offset="1" stop-color="#9fb8ff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glow" cx="0.1" cy="1" r="0.6">
    <stop offset="0" stop-color="#3b6cff" stop-opacity="0.28"/><stop offset="1" stop-color="#3b6cff" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="aurora" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#2fd4c4" stop-opacity="0"/><stop offset="0.5" stop-color="#2fd4c4" stop-opacity="0.22"/><stop offset="1" stop-color="#7c5cf0" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="aurora2" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#7c5cf0" stop-opacity="0"/><stop offset="0.5" stop-color="#7c5cf0" stop-opacity="0.18"/><stop offset="1" stop-color="#2fd4c4" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#101a34" stop-opacity="0.9"/><stop offset="1" stop-color="#05070e" stop-opacity="1"/>
  </linearGradient>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
  <filter id="wide" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="70"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<!-- aurora bands -->
<g filter="url(#wide)">
  <path d="M0,520 C600,380 1200,640 1800,440 S2400,380 2560,460 L2560,700 C2000,760 1300,560 700,720 S200,740 0,680 Z" fill="url(#aurora)"/>
  <path d="M0,300 C700,180 1300,420 1900,260 S2400,220 2560,300 L2560,420 C2000,480 1400,300 800,440 S200,460 0,420 Z" fill="url(#aurora2)"/>
</g>
<!-- stars and the moon -->
<g>${stars.join('')}</g>
<rect width="${W}" height="${H}" fill="url(#moon)"/>
<circle cx="${W * 0.78}" cy="${H * 0.14}" r="58" fill="#e9eefc" opacity="0.92"/>
<circle cx="${W * 0.78 - 16}" cy="${H * 0.14 - 6}" r="50" fill="#0f1a38" opacity="0.55"/>
<!-- the skyline -->
<g>${towers.join('')}</g>
<g>${windows.join('')}</g>
<!-- still water: the skyline mirrored and faded, with light streaks -->
<rect x="0" y="${water}" width="${W}" height="${H - water}" fill="url(#water)"/>
<g opacity="0.35" transform="translate(0,${2 * water}) scale(1,-1)">
  <g filter="url(#soft)">${towers.join('')}</g>
</g>
<g>${streaks.join('')}</g>
<line x1="0" y1="${water}" x2="${W}" y2="${water}" stroke="#9ec4ff" stroke-opacity="0.25" stroke-width="1.5"/>
</svg>
`;
}

fs.mkdirSync(SRC, { recursive: true });
const files = { 'crystal-day.svg': day(), 'crystal-night.svg': night() };
for (const [name, svg] of Object.entries(files)) {
  fs.writeFileSync(path.join(SRC, name), svg, 'utf8');
  console.log(`${name}: ${Buffer.byteLength(svg)} bytes`);
}

if (process.argv.includes('--render')) {
  const outIndex = process.argv.indexOf('--out');
  const out = outIndex > 0 ? path.resolve(process.argv[outIndex + 1]) : SRC;
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  for (const name of Object.keys(files)) {
    await page.setContent(`<!doctype html><html><body style="margin:0;background:#000">${files[name].replace(/^<svg /, '<svg style="display:block" ')}</body></html>`);
    const png = path.join(out, name.replace('.svg', '.png'));
    await page.screenshot({ path: png, type: 'png', fullPage: false });
    console.log(`rendered ${png}`);
  }
  await browser.close();
}
