// CR-FE-GATES-2436 (review 07:F20, 07:F7, master plan D3 / T3): the entry-chunk budget.
// CR-FE-GATES-ENFORCE-2442: the budget is the measured entry of the build plus a stated margin (scripts/gates-baseline.json,
// `bundle`), and `--enforce` makes it a failure: exit 1 when the entry is over the budget (gzip or raw), when a `*-mock` module is
// back in the entry (the baseline is 0), or when there is no build to measure. Without `--enforce` the script is the report it was:
// it prints and exits 0. The dictionary list and the debug maps stay a report in both modes.
//
// What it reads (a built folder; default ../smplwise_vms/www, the committed add-on build; `--dir dist` after `npm run build`):
//   - the entry chunk: the module script named by index.html; its raw bytes and its gzip bytes (level 9);
//   - the deny-list of the entry: from the entry's source map, every `*-mock` module and every dictionary module (src/i18n/**,
//     the `*text*.ts` modules) with its source bytes - code that only a demo or one label needs (07:F2, 07:F3). The base dictionary
//     (BASE_DICTIONARIES) is allowed;
//   - the debug maps of the whole build (07:F7): the number and bytes of `.map` files next to the JavaScript. Whether the add-on
//     keeps shipping them is owner decision O3; this only counts.
// Usage (from frontend/): node scripts/bundle-budget.mjs [--dir <build>] [--budget-gzip <bytes>] [--budget-raw <bytes>] [--json] [--enforce]
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { gzipSync } from 'node:zlib';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));

// The budget = the measured entry + the margin, both written in scripts/gates-baseline.json (`bundle.measured`, `bundle.marginPct`,
// `bundle.budget`). Raising it is a deliberate edit of that file, with the reason in the change note of the branch that needs it;
// after a real reduction, lower it again (measure with `--dir dist`, add the margin).
const BASELINE = JSON.parse(fs.readFileSync(path.join(HERE, 'gates-baseline.json'), 'utf8')).bundle;
export const BUDGET = { gzip: BASELINE.budget.gzip, raw: BASELINE.budget.raw };
/** How many `*-mock` modules the entry may carry (0 since CR-MOCKS-LAZY). */
export const MOCKS_IN_ENTRY = BASELINE.mocksInEntry ?? 0;
const BASE_DICTIONARIES = new Set(['src/i18n/he.ts', 'src/i18n/en.ts']);

function args(argv) {
  const o = { dir: path.join(HERE, '..', '..', 'smplwise_vms', 'www'), json: false, enforce: false, budgetGzip: BUDGET.gzip, budgetRaw: BUDGET.raw };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--enforce') o.enforce = true;
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
    mode: o.enforce ? 'enforce' : 'report-only',
  };
}

/** What `--enforce` fails on: [reason]. An empty list is a pass. */
export function failures(r) {
  if (!r || !r.entry) return ['no entry chunk to measure (no build, or index.html names no module script)'];
  const f = [];
  if (r.budget.overGzip > 0) f.push(`entry gzip ${r.entry.gzip} B is ${r.budget.overGzip} B over the budget ${r.budget.gzip} B`);
  if (r.budget.overRaw > 0) f.push(`entry raw ${r.entry.raw} B is ${r.budget.overRaw} B over the budget ${r.budget.raw} B`);
  if (r.denyList.measured && r.denyList.mocks.length > MOCKS_IN_ENTRY) {
    f.push(`${r.denyList.mocks.length} mock module(s) in the entry (allowed ${MOCKS_IN_ENTRY}): ${r.denyList.mocks.map((m) => m.source).join(', ')}`);
  }
  return f;
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const signed = (n) => (n > 0 ? `+${n}` : String(n));

function print(r) {
  const L = [];
  const enforce = r.mode === 'enforce';
  L.push(`bundle-budget (${enforce ? 'ENFORCED' : 'report-only, never fails'}) - ${r.dir}`);
  if (!r.entry) L.push('  entry: no module script in index.html');
  else {
    L.push(`  entry ${r.entry.file}: raw ${r.entry.raw} B (${kb(r.entry.raw)}), gzip ${r.entry.gzip} B (${kb(r.entry.gzip)})`);
    L.push(`  budget: gzip ${r.budget.gzip} (${signed(r.budget.overGzip)}), raw ${r.budget.raw} (${signed(r.budget.overRaw)}) -> ${r.budget.over ? `OVER BUDGET (${enforce ? 'fails' : 'reported, not failed'})` : 'within budget'}`);
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
  if (enforce) {
    const f = failures(r);
    for (const x of f) L.push(`  FAIL: ${x}`);
    L.push(f.length
      ? '  -> FAIL. Load the new code on demand (a dynamic import, the lazy tag registry) instead of from the entry; a budget change is an edit of scripts/gates-baseline.json with its reason.'
      : '  -> OK');
  }
  console.log(L.join('\n'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  const o = args(process.argv.slice(2));
  let r = null;
  try {
    r = measure(o);
  } catch (e) {
    console.error(`bundle-budget: could not measure ${o.dir}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!r) {
    if (o.json) console.log(JSON.stringify({ dir: o.dir, entry: null, mode: o.enforce ? 'enforce' : 'report-only', note: 'no build' }));
    else console.log(`bundle-budget (${o.enforce ? 'ENFORCED' : 'report-only'}): no build in ${o.dir} (run npm run build, then --dir dist)${o.enforce ? ' -> FAIL' : ''}`);
  } else if (o.json) console.log(JSON.stringify({ ...r, failures: failures(r) }, null, 2));
  else print(r);
  process.exit(o.enforce && failures(r).length ? 1 : 0);
}
