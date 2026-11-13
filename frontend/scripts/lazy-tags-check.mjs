// PERF-HOME-DEVICES-2342: a static guard for the shell's lazy screen chunks (src/shell/lazy-screens.ts).
//
// The shell used to import every screen eagerly, so any module could render any custom element by tag without importing
// it. Once a screen module loads lazily, a tag it defines is only registered after its chunk arrived. This script builds the
// static import graph of src/ (eager edges = `import ... from` / `import '...'`; dynamic `import()` edges are NOT followed),
// takes the eager closure of src/main.ts, and for every custom element tag used in a template (`<tag-name`) checks that its
// defining module is loaded where the tag is used:
//   - a module in the eager closure may only use tags defined in the eager closure (or in a lazy group that is listed as
//     safe for it below - none today);
//   - a module that only a lazy group reaches may use tags of the eager closure or of its own group's closure.
// It also checks that every route tag of sw-app's renderRoute is either eager or in a lazy group (so no screen is lost).
// Exit 1 with a list of findings; `node scripts/lazy-tags-check.mjs` from frontend/.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'src');
const files = [];
(function walk(d) {
  for (const n of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, n.name);
    if (n.isDirectory()) walk(p);
    else if (/\.ts$/.test(n.name) && !/\.d\.ts$/.test(n.name)) files.push(p);
  }
})(ROOT);

const src = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));
function resolve(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base, base + '.ts', path.join(base, 'index.ts'), base.replace(/\.js$/, '.ts')]) if (src.has(c)) return c;
  return null;
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const eagerEdges = new Map();
const lazyEdges = new Map();
const defines = new Map(); // tag -> file
const uses = new Map(); // file -> Set(tag)
for (const [f, raw] of src) {
  const s = strip(raw);
  const e = new Set();
  for (const m of s.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    if (/^\s*(?:import|export)\s+type\s/.test(m[0].trim())) continue; // type-only: erased
    const r = resolve(f, m[1]);
    if (r) e.add(r);
  }
  // import.meta.glob('<pattern>', { eager: true }) is a static import of every match (Vite inlines it into this chunk)
  for (const m of s.matchAll(/import\.meta\.glob\(\s*['"]([^'"]+)['"]\s*,\s*\{[^}]*eager:\s*true/g)) {
    const pat = m[1].replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\{([^}]*)\}/g, (_x, alt) => `(${alt.split(',').join('|')})`).replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
    const re = new RegExp(`^${pat}$`);
    for (const g of src.keys()) {
      let r = path.relative(path.dirname(f), g).replace(/\\/g, '/');
      if (!r.startsWith('.')) r = `./${r}`;
      if (re.test(r)) e.add(g);
    }
  }
  eagerEdges.set(f, e);
  const l = new Set();
  for (const m of s.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const r = resolve(f, m[1]);
    if (r) l.add(r);
  }
  lazyEdges.set(f, l);
  for (const m of s.matchAll(/@customElement\(\s*['"]([a-z][a-z0-9]*-[a-z0-9-]+)['"]\s*\)/g)) defines.set(m[1], f);
  for (const m of s.matchAll(/customElements\.define\(\s*['"]([a-z][a-z0-9]*-[a-z0-9-]+)['"]/g)) defines.set(m[1], f);
  const u = new Set();
  const code = strip(raw); // a tag named in a comment is not a use
  for (const m of code.matchAll(/<([a-z][a-z0-9]*-[a-z0-9-]+)[\s>/]/g)) u.add(m[1]);
  for (const m of code.matchAll(/createElement\(\s*['"]([a-z][a-z0-9]*-[a-z0-9-]+)['"]/g)) u.add(m[1]);
  // a tag named in data and rendered through unsafeStatic / customElements.get (system-infra's sections, the infra pages)
  for (const m of raw.matchAll(/\btag:\s*['"]([a-z][a-z0-9]*-[a-z0-9-]+)['"]/g)) u.add(m[1]);
  uses.set(f, u);
}
function closure(roots) {
  const seen = new Set();
  const stack = [...roots];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const n of eagerEdges.get(f) ?? []) stack.push(n);
  }
  return seen;
}
const main = path.join(ROOT, 'main.ts');
const eager = closure([main]);
// lazy groups: every dynamic import() target reachable from the eager closure (and, transitively, from lazy groups)
const groups = new Map(); // root -> closure
const queue = [...eager].flatMap((f) => [...(lazyEdges.get(f) ?? [])]);
while (queue.length) {
  const r = queue.pop();
  if (groups.has(r)) continue;
  const c = closure([r]);
  groups.set(r, c);
  for (const f of c) for (const n of lazyEdges.get(f) ?? []) queue.push(n);
}
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');
const findings = [];
const definedIn = (tag, set) => set.has(defines.get(tag));
// the shell's route loader (src/shell/lazy-screens.ts): tag -> the module whose chunk defines it. A module that calls
// loadPendingScreens(this.renderRoot, ...) (sw-app) may render these tags directly: it starts their chunks after each render.
const LOADER = path.join(ROOT, 'shell', 'lazy-screens.ts');
const routeMap = new Map();
for (const m of (src.get(LOADER) ?? '').matchAll(/'([a-z][a-z0-9]*-[a-z0-9-]+)':\s*\(\)\s*=>\s*import\('([^']+)'\)/g)) routeMap.set(m[1], resolve(LOADER, m[2]));
for (const [tag, mod] of routeMap) {
  if (!mod) findings.push(`lazy-screens: <${tag}> points at a module that does not exist`);
  else if (!groups.get(mod)?.has(defines.get(tag))) findings.push(`lazy-screens: <${tag}> is not defined by ${rel(mod)} or anything it imports`);
  else if (eager.has(mod)) findings.push(`lazy-screens: ${rel(mod)} (<${tag}>) is still imported eagerly - it stays in the entry chunk`);
}
// CR-SHELL-LAZY-2436 (review 07:F4 a-c, 07:F24, 08:F02): on-demand modules that must never be in the eager closure of main.ts again
// (an eager import anywhere would pull them - and what they import - back into the entry chunk).
const NOT_IN_ENTRY = [
  'screens/schedule-editor.ts', // the device popup's schedule editor (components/device-activity)
  'tickets/ticket-create.ts', // the device popup's new-ticket form
  'components/sw-second-factor.ts', // the user menu's second factor section, with its QR library
  'arx/boot.ts', // the remote start-up (main.ts, only on the remote channel)
  'arx/arx-login.ts',
  'arx/arx-welcome.ts',
  'tickets/rfq-text.ts', // the RFQ dictionary (the shell reads its two words from tickets/nav-text.ts)
  'xsection/sw-xsection.ts', // the building cross-section (xsection/sw-floor-home-link loads it when its dialog opens)
];
for (const m of NOT_IN_ENTRY) {
  const f = path.join(ROOT, ...m.split('/'));
  if (!src.has(f)) findings.push(`NOT_IN_ENTRY: ${m} does not exist`);
  else if (eager.has(f)) findings.push(`NOT_IN_ENTRY: ${m} is imported eagerly - it is back in the entry chunk`);
}
const routeRenderers =new Set([...src].filter(([, raw]) => /loadPendingScreens\(this\.renderRoot/.test(raw)).map(([f]) => f));
for (const f of eager) {
  for (const tag of uses.get(f) ?? []) {
    if (!defines.has(tag)) continue; // a tag defined nowhere in src (third party, a demo string): not this check's business
    if (!definedIn(tag, eager)) {
      // allowed when this very module triggers the defining chunk itself (the sw-app route loader, a `void import()` beside the tag)
      const own = [...(lazyEdges.get(f) ?? [])].some((r) => groups.get(r)?.has(defines.get(tag))) || (routeRenderers.has(f) && routeMap.has(tag));
      if (!own) findings.push(`eager ${rel(f)} uses <${tag}> defined lazily in ${rel(defines.get(tag))}`);
    }
  }
}
for (const [root, c] of groups) {
  for (const f of c) {
    if (eager.has(f)) continue;
    for (const tag of uses.get(f) ?? []) {
      if (!defines.has(tag)) continue;
      if (definedIn(tag, eager) || definedIn(tag, c)) continue;
      const own = [...(lazyEdges.get(f) ?? [])].some((r) => groups.get(r)?.has(defines.get(tag)));
      if (!own) findings.push(`lazy ${rel(f)} (group ${rel(root)}) uses <${tag}> defined in ${rel(defines.get(tag))}, outside its group`);
    }
  }
}
const uniq = [...new Set(findings)].sort();
const stat = { files: files.length, eager: eager.size, groups: groups.size, tags: defines.size, routeScreens: routeMap.size, notInEntry: NOT_IN_ENTRY.length };
if (process.argv.includes('--stats')) console.log(JSON.stringify(stat));
if (uniq.length) {
  console.error(uniq.join('\n'));
  console.error(`\n${uniq.length} finding(s)`, JSON.stringify(stat));
  process.exit(1);
}
console.log('lazy-tags-check: OK', JSON.stringify(stat));
