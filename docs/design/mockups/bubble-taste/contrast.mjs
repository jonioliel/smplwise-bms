// WCAG 2.x contrast check for the bubble taste tokens, including text on TRANSLUCENT surfaces.
// usage: node docs/design/mockups/bubble-taste/contrast.mjs   (prints a Markdown table; exit 0 always - failures are reported, not hidden)
// Translucent surfaces are composited over the worst plausible content behind them (blur averages, so the worst case is a
// large uniform area of that colour). color-mix(in oklab, ...) is reproduced in OKLab.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('./bubble-skin.css', import.meta.url)), 'utf8');
function block(sel) {
  const i = css.indexOf(sel); const s = css.indexOf('{', i); const e = css.indexOf('\n}', s);
  const out = {};
  for (const m of css.slice(s + 1, e).matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const T = { light: block(":root[data-theme='light'] {"), dark: block(":root[data-theme='dark'] {") };

const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((x) => x + x).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
function parse(v) { // -> [r,g,b,a]
  v = v.trim();
  if (v.startsWith('#')) return [...hex(v), 1];
  const m = v.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
  throw new Error('colour? ' + v);
}
const over = (fg, bg) => { const a = fg[3]; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(1); };
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// OKLab mix (color-mix(in oklab, a p, b))
const toLab = (c) => { const [r, g, b] = c.map((x, i) => (i < 3 ? lin(x) : x));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]; };
const fromLab = ([L_, a, b]) => { const l = (L_ + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L_ - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L_ - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const enc = (x) => { x = Math.max(0, Math.min(1, x)); return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055); };
  return [enc(r), enc(g), enc(bb), 1]; };
const mix = (a, p, b) => { const A = toLab(a), B = toLab(b); return fromLab(A.map((x, i) => x * p + B[i] * (1 - p))); };

const rows = [];
let fails = 0;
function check(scheme, what, fg, bg, min = 4.5) {
  const r = ratio(fg, bg); const ok = r >= min; if (!ok) fails++;
  rows.push({ scheme, what, r: r.toFixed(2), min, ok });
}
for (const s of ['light', 'dark']) {
  const t = (n) => parse(T[s][n]);
  const bg = t('--sw-bg'), surf = t('--sw-surface'), surf2 = t('--sw-surface-2');
  // 1. opaque pairs
  for (const tx of ['--sw-text', '--sw-text-2', '--sw-text-3']) for (const [bn, b] of [['bg', bg], ['surface', surf], ['surface-2', surf2]]) check(s, `${tx.slice(5)} on ${bn}`, t(tx), b);
  check(s, 'white on accent (rail, chips, buttons)', [255, 255, 255, 1], t('--sw-accent'));
  check(s, 'accent-text on surface', t('--sw-accent-text'), surf);
  check(s, 'accent-text on accent-soft tag', t('--sw-accent-text'), over(t('--sw-accent-soft'), surf));
  check(s, 'on-lit on lit fill (lights, media pill)', t('--sw-on-lit'), t('--sw-lit'));
  check(s, 'on-lit on lit-cool fill', t('--sw-on-lit'), t('--sw-lit-cool'));
  check(s, 'text on lit-soft tag', t('--sw-text'), over(t('--sw-lit-soft'), surf));
  check(s, 'cool pill text (#08202c)', [8, 32, 44, 1], t('--sw-cool'));
  check(s, 'heat pill text (#2a0e02)', [42, 14, 2, 1], t('--sw-heat'));
  check(s, 'white on weather pill (hue-4)', [255, 255, 255, 1], t('--sw-hue-4'));
  for (const st of ['success', 'warning', 'danger']) check(s, `${st}-text on surface`, t(`--sw-${st}-text`), surf);
  check(s, 'danger-text on danger-soft button (sheet layer)', t('--sw-danger-text'), over(t('--sw-danger-soft'), surf));
  // 2. translucent pop-up sheet over the dimmed live page, at the three transparency positions
  const rgb = T[s]['--sw-sheet-rgb'].split(',').map(Number);
  const behind = { 'page bg': bg, 'lit fill': t('--sw-lit'), accent: t('--sw-accent'), 'hue-2 ring': t('--sw-hue-2'), white: [255, 255, 255, 1], 'near black': [20, 20, 28, 1] };
  for (const alpha of [0.88, 0.72, 0.58]) {
    let worst = { r: 99 };
    let worst2 = { r: 99 }, worstL = { r: 99 };
    for (const [bn, b] of Object.entries(behind)) {
      const dimmed = over(t('--sw-overlay'), b);
      const sheet = over([...rgb, alpha], dimmed);
      const layer = over(t('--sw-layer'), sheet);
      const r1 = ratio(t('--sw-text'), sheet), r2 = ratio(t('--sw-text-2'), sheet), r3 = ratio(t('--sw-text'), layer);
      if (r1 < worst.r) worst = { r: r1, bn }; if (r2 < worst2.r) worst2 = { r: r2, bn }; if (r3 < worstL.r) worstL = { r: r3, bn };
    }
    const push = (what, w) => { const ok = w.r >= 4.5; if (!ok) fails++; rows.push({ scheme: s, what: `${what} (sheet ${Math.round(alpha * 100)}%, worst behind: ${w.bn})`, r: w.r.toFixed(2), min: 4.5, ok }); };
    push('text on sheet', worst); push('text-2 on sheet', worst2); push('text on pill layer in sheet', worstL);
  }
  // 3. gradient surface: text on both ends of every hue wash (color-mix in oklab over the surface)
  const mixA = s === 'dark' ? 0.52 : 0.40, mixB = s === 'dark' ? 0.30 : 0.26;
  let gw = { r: 99 };
  for (let h = 1; h <= 8; h++) {
    const a = mix(t(`--sw-hue-${h}`), mixA, surf), b = mix(t(`--sw-hue-${h}`), mixB, surf);
    for (const [end, c] of [['start', a], ['end', b]]) { const r = ratio(t('--sw-text'), c); if (r < gw.r) gw = { r, h, end }; }
  }
  { const ok = gw.r >= 4.5; if (!ok) fails++; rows.push({ scheme: s, what: `text on gradient pill, worst of 8 hues (hue-${gw.h}, ${gw.end})`, r: gw.r.toFixed(2), min: 4.5, ok }); }
  let lw = { r: 99 };
  const overTx = t('--sw-on-lit');
  for (let h = 1; h <= 8; h++) {
    const fillC = mix(t(`--sw-hue-${h}`), 0.7, [255, 255, 255, 1]);
    const r = ratio(overTx, fillC); if (r < lw.r) lw = { r, h };
  }
  { const ok = lw.r >= 4.5; if (!ok) fails++; rows.push({ scheme: s, what: `label on gradient light fill, worst of 8 hues (hue-${lw.h})`, r: lw.r.toFixed(2), min: 4.5, ok }); }
  // 4. glass surface: pill = sheet colour at 42% over the brightest bloom of the glass canvas
  const blooms = { bg, 'violet bloom': over([120, 110, 255, 0.45], bg), 'coral bloom': over([255, 120, 90, 0.38], bg), 'teal bloom': over([60, 200, 190, 0.25], bg) };
  let gl = { r: 99 };
  for (const [bn, b] of Object.entries(blooms)) { const c = over([...rgb, 0.42], b); for (const tx of ['--sw-text', '--sw-text-2']) { const r = ratio(t(tx), c); if (r < gl.r) gl = { r, bn, tx }; } }
  { const ok = gl.r >= 4.5; if (!ok) fails++; rows.push({ scheme: s, what: `${gl.tx.slice(5)} on glass pill (42%, worst: ${gl.bn})`, r: gl.r.toFixed(2), min: 4.5, ok }); }
}
console.log('| Scheme | Pair | Ratio | Min | Result |\n|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.scheme} | ${r.what} | ${r.r} | ${r.min} | ${r.ok ? 'pass' : '**FAIL**'} |`);
console.log(`\n${rows.length} pairs, ${fails} below the minimum.`);
