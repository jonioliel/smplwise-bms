#!/usr/bin/env node
// Bubble skin palettes: schema + WCAG 2.x contrast validator. Node >= 18, no dependencies.
//
//   node docs/design/palettes/validate_palettes.mjs                     # validate palettes.json, summary + failures, exit 1 on any failure
//   node docs/design/palettes/validate_palettes.mjs --all               # print every checked pair
//   node docs/design/palettes/validate_palettes.mjs --fix-suggest       # for every failing token: the nearest passing value (OKLCH lightness only)
//   node docs/design/palettes/validate_palettes.mjs --file my.json      # validate a custom palette file (a single palette object or a palettes file)
//   node docs/design/palettes/validate_palettes.mjs --palette sunset    # one palette only
//   node docs/design/palettes/validate_palettes.mjs --json report.json  # machine-readable report
//   node docs/design/palettes/validate_palettes.mjs --emit-preview      # (re)write preview-data.js for index.html
//
// Method (README "Contrast method"): sRGB relative luminance and the WCAG ratio (L1 + 0.05) / (L2 + 0.05). Translucent
// colours are alpha-composited (source-over, sRGB) onto what is behind them before measuring. Backdrop blur only averages
// the wallpaper, so the worst case is a large uniform area of the lightest or of the darkest wallpaper stop; both are used.
// Text needs 4.5:1, non-text (state dots, icons, rings, toggles, slider position) needs 3:1.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

// ---------- colour maths ----------
export function parse(v) {
  if (typeof v !== 'string') throw new Error(`not a colour: ${JSON.stringify(v)}`);
  v = v.trim();
  let m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(m[2] ? parseInt(m[2], 16) / 255 : 1);
  m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  throw new Error(`unsupported colour "${v}" (use #rrggbb, #rrggbbaa, rgb() or rgba())`);
}
export const over = (fg, bg) => { const a = fg[3]; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(1); };
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const enc = (x) => { x = Math.max(0, Math.min(1, x)); return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055); };
export function toOklch(c) {
  const [r, g, b] = c.slice(0, 3).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}
export function fromOklch(L, C, H) {
  const raw = (c) => { const a = c * Math.cos((H * Math.PI) / 180), b = c * Math.sin((H * Math.PI) / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]; };
  let c = C, v = raw(c);
  while (c > 0 && !v.every((x) => x >= -1e-4 && x <= 1.0001)) { c = Math.max(0, c - 0.002); v = raw(c); }
  return v.map(enc).map(Math.round).concat(1);
}
export const toHex = (c) => '#' + c.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');

// ---------- schema ----------
const HEX = /^#[0-9a-f]{6}$/i;
export const SCHEMA = {
  // path: 'hex' | 'color' (hex or rgba) | 'number' | 'hex[]' | 'pairs'
  bg: 'hex', surface: 'hex', surface2: 'hex', surfaceElevated: 'hex', text: 'hex', textMuted: 'hex', border: 'color',
  accent: 'hex', accentContrast: 'hex', accentText: 'hex',
  'glass.tint': 'hex', 'glass.opacity.min': 'number', 'glass.opacity.default': 'number', 'glass.opacity.max': 'number',
  'glass.layer': 'color', 'glass.overlay': 'color', 'glass.blurPx': 'number',
  'state.on': 'hex', 'state.off': 'hex', 'state.unavailable': 'hex', 'state.success': 'hex', 'state.warning': 'hex', 'state.danger': 'hex',
  'state.successText': 'hex', 'state.warningText': 'hex', 'state.dangerText': 'hex',
  'entity.light': 'hex', 'entity.climate': 'hex', 'entity.cover': 'hex', 'entity.media': 'hex', 'entity.security': 'hex', 'entity.camera': 'hex', 'entity.icon': 'hex',
  'gradient.pairs': 'pairs', 'gradient.text': 'hex',
  'slider.fill': 'hex', 'slider.fillCool': 'hex', 'slider.onFill': 'hex', 'slider.edge': 'hex', 'slider.track': 'hex',
  'wallpaper.stops': 'hex[]', 'wallpaper.angle': 'number',
};
export const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const set = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((x, k) => x[k], o)[last] = v; };

export function schemaErrors(pal) {
  const errs = [];
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(pal.id ?? '')) errs.push('id: lower-case kebab id required');
  if (!pal.name?.he || !pal.name?.en) errs.push('name.he and name.en required');
  for (const sc of ['light', 'dark']) {
    const s = pal.schemes?.[sc];
    if (!s) { errs.push(`schemes.${sc} missing`); continue; }
    for (const [p, t] of Object.entries(SCHEMA)) {
      const v = get(s, p), at = `schemes.${sc}.${p}`;
      if (v === undefined) { errs.push(`${at} missing`); continue; }
      if (t === 'hex' && !HEX.test(v)) errs.push(`${at} must be #rrggbb`);
      if (t === 'color') { try { parse(v); } catch (e) { errs.push(`${at}: ${e.message}`); } }
      if (t === 'number' && typeof v !== 'number') errs.push(`${at} must be a number`);
      if (t === 'hex[]' && (!Array.isArray(v) || v.length < 2 || v.length > 5 || !v.every((x) => HEX.test(x)))) errs.push(`${at} must be 2-5 #rrggbb stops`);
      if (t === 'pairs' && (!Array.isArray(v) || v.length < 2 || v.length > 8 || !v.every((pr) => Array.isArray(pr) && pr.length === 2 && pr.every((x) => HEX.test(x))))) errs.push(`${at} must be 2-8 [#start, #end] pairs`);
    }
    const o = s.glass?.opacity;
    if (o && !(o.min > 0 && o.min <= o.default && o.default <= o.max && o.max <= 1)) errs.push(`schemes.${sc}.glass.opacity: need 0 < min <= default <= max <= 1`);
    // closed set: no unknown keys
    const known = new Set(Object.keys(SCHEMA));
    const walk = (x, pre) => { for (const [k, v] of Object.entries(x)) { const p = pre ? `${pre}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v) && ![...known].some((kk) => kk === p)) walk(v, p);
      else if (!known.has(p)) errs.push(`schemes.${sc}.${p}: unknown token (closed set)`); } };
    walk(s, '');
  }
  return errs;
}

// ---------- checks ----------
const TEXT = 4.5, UI = 3;
export function checkScheme(s) {
  const C = (p) => parse(get(s, p));
  const rows = [];
  const add = (group, what, fgPath, fg, bgName, bg, min, alt) => {
    const r = ratio(fg, bg);
    rows.push({ group, what, fg: fgPath, bg: bgName, fgHex: toHex(fg), bgHex: toHex(bg), ratio: +r.toFixed(2), min, ok: r >= min || !!alt?.ok, alt: alt?.note });
  };
  const opaque = { bg: C('bg'), surface: C('surface'), surface2: C('surface2'), surfaceElevated: C('surfaceElevated') };

  // 1. text on opaque surfaces
  for (const t of ['text', 'textMuted']) for (const [n, b] of Object.entries(opaque)) add('text', `${t} on ${n}`, t, C(t), n, b, TEXT);

  // 2. translucent glass over the lightest and the darkest wallpaper stop at the minimum opacity
  const stops = s.wallpaper.stops.map(parse);
  const byLum = [...stops].sort((a, b) => lum(b) - lum(a));
  const extremes = { 'lightest stop': byLum[0], 'darkest stop': byLum[byLum.length - 1] };
  const a = s.glass.opacity.min, tint = C('glass.tint');
  const glass = {};
  for (const [wn, w] of Object.entries(extremes)) {
    glass[`glass card @${Math.round(a * 100)}% / ${wn}`] = over([...tint.slice(0, 3), a], w);
    const sheet = over([...tint.slice(0, 3), a], over(C('glass.overlay'), w));
    glass[`pop-up sheet @${Math.round(a * 100)}% / dimmed ${wn}`] = sheet;
    glass[`pill layer in sheet / dimmed ${wn}`] = over(C('glass.layer'), sheet);
  }
  for (const t of ['text', 'textMuted']) for (const [n, b] of Object.entries(glass)) add('glass', `${t} on ${n}`, t, C(t), n, b, TEXT);
  for (const [n, b] of Object.entries(glass)) if (!n.startsWith('pill')) add('glass', `accentText on ${n}`, 'accentText', C('accentText'), n, b, TEXT);
  // page text straight on the wallpaper (headings outside cards)
  stops.forEach((w, i) => add('wallpaper', `text on wallpaper stop ${i + 1}`, 'text', C('text'), `wallpaper.stops[${i}]`, w, TEXT));

  // 3. accent
  add('accent', 'accentContrast on accent', 'accentContrast', C('accentContrast'), 'accent', C('accent'), TEXT);
  for (const n of ['bg', 'surface', 'surfaceElevated']) add('accent', `accentText on ${n}`, 'accentText', C('accentText'), n, opaque[n], TEXT);
  for (const n of ['bg', 'surface']) add('accent', `accent (toggle, focus) vs ${n}`, 'accent', C('accent'), n, opaque[n], UI);

  // 4. states (non-text) vs every surface incl. the worst glass, state text tones on surfaces
  const worstGlass = (fg) => Object.entries(glass).reduce((w, [n, b]) => { const r = ratio(fg, b); return r < w.r ? { r, n, b } : w; }, { r: 99 });
  for (const st of ['on', 'off', 'unavailable', 'success', 'warning', 'danger']) {
    const p = `state.${st}`, fg = C(p);
    for (const n of ['bg', 'surface', 'surfaceElevated']) add('state', `${st} vs ${n}`, p, fg, n, opaque[n], UI);
    const w = worstGlass(fg); add('state', `${st} vs ${w.n}`, p, fg, w.n, w.b, UI);
  }
  for (const st of ['successText', 'warningText', 'dangerText']) for (const n of ['surface', 'surfaceElevated']) add('state', `${st} on ${n}`, `state.${st}`, C(`state.${st}`), n, opaque[n], TEXT);

  // 5. entity accents (rings) vs surfaces, icon on the ring
  for (const e of ['light', 'climate', 'cover', 'media', 'security', 'camera']) {
    const p = `entity.${e}`;
    for (const n of ['bg', 'surface']) add('entity', `${e} ring vs ${n}`, p, C(p), n, opaque[n], UI);
    add('entity', `icon on ${e} ring`, 'entity.icon', C('entity.icon'), p, C(p), UI);
  }

  // 6. gradient surface: text on both ends of every pair
  s.gradient.pairs.forEach((pr, i) => pr.forEach((c, j) => add('gradient', `gradient text on pair ${i + 1} ${j ? 'end' : 'start'}`, 'gradient.text', C('gradient.text'), `gradient.pairs[${i}][${j}]`, parse(c), TEXT)));

  // 7. slider fill: label on the fill, and the position indication (fill vs track, or the edge mark vs both)
  for (const f of ['fill', 'fillCool']) {
    add('slider', `onFill on ${f}`, 'slider.onFill', C('slider.onFill'), `slider.${f}`, C(`slider.${f}`), TEXT);
    const direct = ratio(C(`slider.${f}`), C('slider.track'));
    const eF = ratio(C('slider.edge'), C(`slider.${f}`)), eT = ratio(C('slider.edge'), C('slider.track'));
    const edgeOk = eF >= UI && eT >= UI;
    add('slider', `${f} vs track (position)`, `slider.${f}`, C(`slider.${f}`), 'slider.track', C('slider.track'), UI,
      { ok: edgeOk, note: `edge mark: ${eF.toFixed(2)} vs fill, ${eT.toFixed(2)} vs track${edgeOk ? ' (passes via edge)' : ''}` });
    if (direct < UI) { add('slider', `edge vs ${f}`, 'slider.edge', C('slider.edge'), `slider.${f}`, C(`slider.${f}`), UI); add('slider', `edge vs track (${f})`, 'slider.edge', C('slider.edge'), 'slider.track', C('slider.track'), UI); }
  }
  return rows;
}

// ---------- MD1 material dials (2026-10-03): text on a state-washed tile ----------
// The tint dial washes a tile whose state carries a tone with that tone (a 135deg wash from `share` % at the corner to transparent).
// The app caps the share per palette x scheme (design/contrast.ts, `--sw-m-wash-cap`) so text and muted text keep 4.5:1 at the
// wash's strongest point over `surface` and `surfaceElevated`; design/palette.ts `materialWashRows` is the same function. The rows
// are reported at the CAPPED soft (28 %) and strong (50 %) shares, so they pass by construction: the cap itself is the finding
// (a palette whose cap is under 28 % cannot show even the soft wash in full). Not part of checkScheme: the 1,900-pair count stays.
export const MATERIAL_WASH_TONES = ['slider.fill', 'accent', 'state.success', 'state.warning', 'state.danger', 'entity.climate'];
export const MATERIAL_WASH = { soft: 28, strong: 50, max: 62 };
export function materialWashCap(s) {
  const C = (p) => parse(get(s, p));
  const bases = [C('surface'), C('surfaceElevated')], texts = [C('text'), C('textMuted')], tones = MATERIAL_WASH_TONES.map(C);
  const reads = (share) => bases.every((b) => tones.every((tn) => texts.every((t) => ratio(t, over([...tn.slice(0, 3), share / 100], b)) >= TEXT)));
  let cap = 0;
  for (let share = 2; share <= MATERIAL_WASH.max; share += 2) { if (reads(share)) cap = share; else break; }
  return cap;
}
export function materialWashRows(s) {
  const C = (p) => parse(get(s, p));
  const cap = materialWashCap(s);
  const rows = [];
  for (const [name, want] of [['soft', MATERIAL_WASH.soft], ['strong', MATERIAL_WASH.strong]]) {
    const share = Math.min(want, cap);
    for (const p of MATERIAL_WASH_TONES) {
      const tn = C(p);
      for (const base of ['surface', 'surfaceElevated']) {
        const b = over([...tn.slice(0, 3), share / 100], C(base));
        for (const t of ['text', 'textMuted']) {
          const r = ratio(C(t), b);
          rows.push({ group: 'material', what: `${t} on ${p} wash ${name} ${share}% (cap ${cap}%) over ${base}`, fg: t, bg: `material.${name}.${p}.${base}`, fgHex: toHex(C(t)), bgHex: toHex(b), ratio: +r.toFixed(2), min: TEXT, ok: r >= TEXT });
        }
      }
    }
  }
  return rows;
}

// nearest passing value for a token: walk OKLCH lightness up and down (hue and chroma kept), first value passing every
// check in which the token is the foreground.
export function suggest(s, path) {
  const base = toOklch(parse(get(s, path)));
  const passes = (hex) => { const c = structuredClone(s); set(c, path, hex); return checkScheme(c).filter((r) => r.fg === path).every((r) => r.ok); };
  for (let d = 0.005; d <= 1; d += 0.005) for (const sign of [-1, 1]) {
    const L = base[0] + sign * d; if (L < 0 || L > 1) continue;
    const hex = toHex(fromOklch(L, base[1], base[2]));
    if (passes(hex)) return { value: hex, dL: +(sign * d).toFixed(3) };
  }
  return null;
}

// ---------- run ----------
function load() {
  const f = resolve(opt('--file') ?? join(HERE, 'palettes.json'));
  const j = JSON.parse(readFileSync(f, 'utf8'));
  return { file: f, doc: j, palettes: Array.isArray(j.palettes) ? j.palettes : [j] };
}
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { file, doc, palettes } = load();
  const only = opt('--palette');
  const report = [];
  let total = 0, failed = 0, schemaBad = 0;
  for (const pal of palettes.filter((p) => !only || p.id === only)) {
    const errs = schemaErrors(pal);
    if (errs.length) { schemaBad++; console.log(`\n${pal.id ?? '?'}: SCHEMA ERRORS\n  ` + errs.join('\n  ')); continue; }
    for (const sc of ['light', 'dark']) {
      const rows = checkScheme(pal.schemes[sc]);
      const bad = rows.filter((r) => !r.ok);
      total += rows.length; failed += bad.length;
      const low = rows.filter((r) => r.min === TEXT).sort((x, y) => x.ratio - y.ratio)[0];
      const lowUi = rows.filter((r) => r.min === UI && !(r.alt && r.ok && r.ratio < UI)).sort((x, y) => x.ratio - y.ratio)[0];
      report.push({ palette: pal.id, scheme: sc, checked: rows.length, failed: bad.length, lowestText: low, lowestUi: lowUi, rows });
    }
  }
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\nFile: ${file}\n`);
  console.log(`${pad('palette', 16)}${pad('scheme', 7)}${pad('pairs', 6)}${pad('failed', 7)}${pad('lowest text (4.5)', 66)}lowest non-text (3.0)`);
  for (const r of report) console.log(`${pad(r.palette, 16)}${pad(r.scheme, 7)}${pad(r.checked, 6)}${pad(r.failed, 7)}${pad(`${r.lowestText.ratio} ${r.lowestText.what}`, 66)}${r.lowestUi.ratio} ${r.lowestUi.what}`);
  const bad = report.flatMap((r) => r.rows.filter((x) => !x.ok).map((x) => ({ ...x, palette: r.palette, scheme: r.scheme })));
  if (bad.length || flag('--all')) {
    console.log(`\n${flag('--all') ? 'All pairs' : 'Failures'}:\n${pad('palette', 16)}${pad('scheme', 7)}${pad('fg token', 22)}${pad('fg', 9)}${pad('bg', 9)}${pad('ratio', 7)}${pad('min', 5)}${pad('result', 7)}pair`);
    for (const r of report) for (const x of r.rows) if (flag('--all') || !x.ok)
      console.log(`${pad(r.palette, 16)}${pad(r.scheme, 7)}${pad(x.fg, 22)}${pad(x.fgHex, 9)}${pad(x.bgHex, 9)}${pad(x.ratio.toFixed(2), 7)}${pad(x.min, 5)}${pad(x.ok ? 'pass' : 'FAIL', 7)}${x.what}${x.alt ? ` [${x.alt}]` : ''}`);
  }
  if (flag('--fix-suggest') && bad.length) {
    console.log('\nSuggestions (nearest OKLCH lightness that passes every check of the token; hue and chroma kept):');
    const seen = new Set();
    for (const x of bad) {
      const k = `${x.palette}/${x.scheme}/${x.fg}`; if (seen.has(k)) continue; seen.add(k);
      const pal = palettes.find((p) => p.id === x.palette); const s = pal.schemes[x.scheme];
      const sg = suggest(s, x.fg);
      console.log(`  ${pad(x.palette, 16)}${pad(x.scheme, 7)}${pad(x.fg, 22)}${get(s, x.fg)} -> ${sg ? `${sg.value} (dL ${sg.dL > 0 ? '+' : ''}${sg.dL})` : 'no lightness passes; change the background or the hue'}`);
    }
  }
  // MD1 material dials: the wash cap per palette x scheme (informational; the app enforces it at runtime)
  console.log(`\nMaterial wash cap (tint dial; text 4.5:1 on every tone over surface / surfaceElevated; soft asks 28 %, strong 50 %):`);
  console.log(`${pad('palette', 16)}${pad('light cap', 10)}${pad('dark cap', 10)}lowest text on the capped wash (light / dark)`);
  for (const pal of palettes.filter((p) => !only || p.id === only)) {
    if (schemaErrors(pal).length) continue;
    const caps = ['light', 'dark'].map((sc) => materialWashCap(pal.schemes[sc]));
    const lows = ['light', 'dark'].map((sc) => materialWashRows(pal.schemes[sc]).sort((x, y) => x.ratio - y.ratio)[0]);
    console.log(`${pad(pal.id, 16)}${pad(caps[0] + '%', 10)}${pad(caps[1] + '%', 10)}${lows[0].ratio} ${lows[0].what} / ${lows[1].ratio} ${lows[1].what}`);
  }
  console.log(`\n${report.length / 2 || 0} palettes x 2 schemes: ${total} pairs checked, ${failed} failed${schemaBad ? `, ${schemaBad} palettes with schema errors` : ''}.`);
  if (opt('--json')) writeFileSync(opt('--json'), JSON.stringify(report, null, 2));
  if (flag('--emit-preview')) {
    const slim = report.map((r) => ({ palette: r.palette, scheme: r.scheme, checked: r.checked, failed: r.failed,
      rows: r.rows.map(({ group, what, fgHex, bgHex, ratio: q, min, ok, alt }) => ({ group, what, fg: fgHex, bg: bgHex, ratio: q, min, ok, alt })) }));
    writeFileSync(join(HERE, 'preview-data.js'), `// Generated by validate_palettes.mjs --emit-preview. Do not edit; edit palettes.json and re-run.\nwindow.SW_PALETTES = ${JSON.stringify(doc)};\nwindow.SW_CONTRAST = ${JSON.stringify(slim)};\n`);
    console.log('wrote preview-data.js');
  }
  process.exit(failed || schemaBad ? 1 : 0);
}
