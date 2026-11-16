// CR-FE-GATES-2436 (review 07:F20, 07:F7, master plan D3 / T3): the entry-chunk budget. REPORT-ONLY - it prints and always exits 0;
// CR-FE-GATES-ENFORCE lowers the budget to the measured size plus a margin and makes "over budget" a failure.
//
// What it reads (a built folder; default ../smplwise_vms/www, the committed add-on build; `--dir dist` after `npm run build`):
//   - the entry chunk: the module script named by index.html; its raw bytes and its gzip bytes (level 9);
//   - the deny-list of the entry: from the entry's source map, every `*-mock` module and every dictionary module (src/i18n/**,
//     the `*text*.ts` modules) with its source bytes - code that only a demo or one label needs (07:F2, 07:F3). The base dictionary
//     (BASE_DICTIONARIES) is allowed;
//   - the debug maps of the whole build (07:F7): the number and bytes of `.map` files next to the JavaScript. Whether the add-on
//     keeps shipping them is owner decision O3; this only counts.
// Usage (from frontend/): node scripts/bundle-budget.mjs [--dir <build>] [--budget-gzip <bytes>] [--budget-raw <bytes>] [--json]
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { gzipSync } from 'node:zlib';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));

// The starting budget = the entry of the committed build of v2.43.4 (origin/main 665ec8f24, assets/index-BbQM-cPX.js), measured by
// this script on 2026-11-13. Report-only: an entry above it is printed as "over budget", nothing fails.
export const BUDGET = { gzip: 1_156_938, raw: 4_074_343 };
const BASE_DICTIONARIES = new Set(['src/i18n/he.ts', 'src/i18n/en.ts']);

function args(argv) {
  const o = { dir: path.join(HERE, '..', '..', 'smplwise_vms', 'www'), json: false, budgetGzip: BUDGET.gzip, budgetRaw: BUDGET.raw };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--dir') o.dir = path.resolve(argv[++i]);
    else if (a === '--budget-gzip') o.budgetGzip = Number(argv[++i]);
    else if (a === '--budget-raw') o.budgetRaw = Number(argv[++i]);
  }
  return o;
}

/** A source-map path (`../../../frontend/src/x.ts`, `../../node_modules/lit/x.js`) as a path inside frontend/. */
export function sourceKey(s) {
  const p = s.replace(/\\/g, '/');
  const f = p.lastIndexOf('frontend/');
  if (f >= 0) return p.slice(f + 'frontend/'.length);
  const m = /(?:^|\/)((?:src|node_modules)\/.*)$/.exec(p);
  return m ? m[1] : p;
}

export const isMock = (k) => k.startsWith('src/') && /(^|\/)[^/]*-mock\.ts$|(^|\/)mocks?\//.test(k);
export const isDictionary = (k) => k.startsWith('src/') && (/^src\/i18n\//.test(k) || /(^|\/|-)text(-[\w]+)?\.ts$/.test(k));

function walk(dir, out = []) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

export function measure(o) {
  const index = path.join(o.dir, 'index.html');
  if (!fs.existsSync(index)) return null;
  const html = fs.readFileSync(index, 'utf8');
  const src = /<script[^>]*type="module"[^>]*src="([^"]+)"/.exec(html)?.[1] ?? null;
  let entry = null;
  let denyList = { measured: false, mocks: [], dictionaries: [], allowedDictionaries: [] };
  if (src) {
    const file = src.replace(/^\.\//, '');
    const buf = fs.readFileSync(path.join(o.dir, file));
    entry = { file, raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length };
    const mapFile = path.join(o.dir, `${file}.map`);
    if (fs.existsSync(mapFile)) {
      const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
      const sources = (map.sources ?? []).map((s, i) => ({ source: sourceKey(s), bytes: Buffer.byteLength(map.sourcesContent?.[i] ?? '', 'utf8') }));
      const bySize = (a, b) => b.bytes - a.bytes || a.source.localeCompare(b.source);
      denyList = {
        measured: true,
        mocks: sources.filter((s) => isMock(s.source)).sort(bySize),
        dictionaries: sources.filter((s) => isDictionary(s.source) && !BASE_DICTIONARIES.has(s.source)).sort(bySize),
        allowedDictionaries: sources.filter((s) => BASE_DICTIONARIES.has(s.source)).map((s) => s.source).sort(),
      };
    }
  }
  const files = walk(o.dir);
  const size = (fs_) => fs_.reduce((n, f) => n + fs.statSync(f).size, 0);
  const maps = files.filter((f) => f.endsWith('.map'));
  const js = files.filter((f) => f.endsWith('.js'));
  const overGzip = entry ? entry.gzip - o.budgetGzip : 0;
  const overRaw = entry ? entry.raw - o.budgetRaw : 0;
  return {
    dir: o.dir,
    entry,
    budget: { gzip: o.budgetGzip, raw: o.budgetRaw, overGzip, overRaw, over: overGzip > 0 || overRaw > 0 },
    denyList,
    maps: { files: maps.length, bytes: size(maps), jsFiles: js.length, jsBytes: size(js) },
    mode: 'report-only',
  };
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const signed = (n) => (n > 0 ? `+${n}` : String(n));

function print(r) {
  const L = [];
  L.push(`bundle-budget (report-only, never fails) - ${r.dir}`);
  if (!r.entry) L.push('  entry: no module script in index.html');
  else {
    L.push(`  entry ${r.entry.file}: raw ${r.entry.raw} B (${kb(r.entry.raw)}), gzip ${r.entry.gzip} B (${kb(r.entry.gzip)})`);
    L.push(`  budget: gzip ${r.budget.gzip} (${signed(r.budget.overGzip)}), raw ${r.budget.raw} (${signed(r.budget.overRaw)}) -> ${r.budget.over ? 'OVER BUDGET (reported, not failed)' : 'within budget'}`);
  }
  if (!r.denyList.measured) L.push('  deny-list: not measured (no source map for the entry)');
  else {
    const sum = (xs) => xs.reduce((n, x) => n + x.bytes, 0);
    L.push(`  deny-list: ${r.denyList.mocks.length} mock modules (${kb(sum(r.denyList.mocks))} source), ${r.denyList.dictionaries.length} dictionary modules (${kb(sum(r.denyList.dictionaries))} source) in the entry`);
    for (const m of r.denyList.mocks) L.push(`    mock        ${m.source} ${kb(m.bytes)}`);
    for (const d of r.denyList.dictionaries.slice(0, 15)) L.push(`    dictionary  ${d.source} ${kb(d.bytes)}`);
    if (r.denyList.dictionaries.length > 15) L.push(`    ... ${r.denyList.dictionaries.length - 15} more dictionaries (--json lists all)`);
    if (r.denyList.allowedDictionaries.length) L.push(`    allowed     ${r.denyList.allowedDictionaries.join(', ')}`);
  }
  L.push(`  debug maps: ${r.maps.files} .map files, ${kb(r.maps.bytes)} against ${r.maps.jsFiles} .js files, ${kb(r.maps.jsBytes)} (owner decision O3)`);
  console.log(L.join('\n'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  const o = args(process.argv.slice(2));
  let r = null;
  try {
    r = measure(o);
  } catch (e) {
    console.error(`bundle-budget (report-only): could not measure ${o.dir}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!r) {
    if (o.json) console.log(JSON.stringify({ dir: o.dir, entry: null, mode: 'report-only', note: 'no build' }));
    else console.log(`bundle-budget (report-only): no build in ${o.dir} (run npm run build, then --dir dist)`);
  } else if (o.json) console.log(JSON.stringify(r, null, 2));
  else print(r);
  process.exit(0);
}
