// A11Y-AUDIT-2490: the accessibility sweep's report. A REPORT step, not a gate (like scripts/complexity-report.mjs): it always exits 0.
// It reads the rows tests/a11y-sweep-2490.spec.ts appended to test-results/a11y-sweep/<project>.jsonl (one row per route x project x
// scheme, critical / serious axe-core findings plus the phone's 44 px touch-target probe) and groups them by rule and by module.
// The module of a finding is the source folder of the innermost custom element that draws it (src/<folder>/..., from the tag's
// `@customElement('<tag>')`), so a fix can be planned folder by folder.
// Usage (from frontend/):
//   node scripts/a11y-report.mjs [--json] [--out <file.json>]      summarise the rows of the last sweep
//   node scripts/a11y-report.mjs --run [playwright args ...]        run the sweep first (SW_A11Y_SWEEP=1, desktop + mobile, --workers=1),
//                                                                  then summarise; the sweep's own exit code is ignored
// `npm run report:a11y` is `--run`. SW_BASE_URL / SW_A11Y_ROUTES pass through to the spec.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { spawnSync } from 'node:child_process';

const FRONTEND = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const DIR = path.join(FRONTEND, 'test-results', 'a11y-sweep');

function args(argv) {
  const o = { run: false, json: false, out: path.join(DIR, 'report.json'), rest: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run') o.run = true;
    else if (a === '--json') o.json = true;
    else if (a === '--out') o.out = path.resolve(argv[++i]);
    else o.rest.push(a);
  }
  return o;
}

/** tag -> src-relative file, from every `@customElement('<tag>')` / `customElements.define('<tag>'` under src/. */
export function tagFiles(root = path.join(FRONTEND, 'src')) {
  const map = new Map();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts')) {
        const text = fs.readFileSync(p, 'utf8');
        for (const m of text.matchAll(/(?:@customElement\(|customElements\.define\()\s*'([a-z0-9-]+)'/g)) map.set(m[1], path.relative(FRONTEND, p).split(path.sep).join('/'));
      }
    }
  };
  walk(root);
  return map;
}

/** The module of a source file: src/<folder> (src/components/sw-table.ts -> components/sw-table, as the shared components are owned one by one). */
export function moduleOf(file) {
  if (!file) return 'shell/document';
  const parts = file.replace(/^src\//, '').replace(/\.ts$/, '').split('/');
  return parts[0] === 'components' ? `components/${parts[1]}` : parts[0];
}

export function readRows(dir = DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
}

export function summarise(rows, tags) {
  const byRule = new Map();
  const byModule = new Map();
  const errors = [];
  const routes = new Set();
  for (const r of rows) {
    routes.add(r.route);
    if (r.error) {
      errors.push({ route: r.route, project: r.project, error: r.error });
      continue;
    }
    for (const v of r.violations ?? []) {
      const where = `${r.project}/${r.scheme} ${r.route}`;
      const rule = byRule.get(v.rule) ?? { rule: v.rule, impact: v.impact, help: v.help, nodes: 0, pages: new Set(), modules: new Set() };
      rule.nodes += v.count;
      rule.pages.add(where);
      for (const ex of v.examples) {
        const file = tags.get(ex.host);
        const mod = moduleOf(file);
        rule.modules.add(mod);
        const m = byModule.get(mod) ?? { module: mod, rules: new Map(), files: new Set() };
        if (file) m.files.add(file);
        const mr = m.rules.get(v.rule) ?? { rule: v.rule, impact: v.impact, nodes: 0, pages: new Set(), hosts: new Set(), example: ex };
        mr.nodes += 1;
        mr.pages.add(where);
        mr.hosts.add(ex.host);
        m.rules.set(v.rule, mr);
        byModule.set(mod, m);
      }
      byRule.set(v.rule, rule);
    }
  }
  const order = (a, b) => (a.impact === b.impact ? b.nodes - a.nodes : a.impact === 'critical' ? -1 : 1);
  return {
    rows: rows.length,
    routes: routes.size,
    errors,
    rules: [...byRule.values()].map((r) => ({ ...r, pages: r.pages.size, modules: [...r.modules].sort() })).sort(order),
    modules: [...byModule.values()]
      .map((m) => ({ module: m.module, files: [...m.files].sort(), rules: [...m.rules.values()].map((r) => ({ ...r, pages: [...r.pages].sort(), hosts: [...r.hosts].sort() })).sort(order) }))
      .sort((a, b) => b.rules.reduce((s, r) => s + r.nodes, 0) - a.rules.reduce((s, r) => s + r.nodes, 0)),
  };
}

function print(s) {
  console.log(`a11y sweep: ${s.rows} rows over ${s.routes} routes, ${s.errors.length} load errors (critical / serious only)`);
  console.log('\nBy rule:');
  for (const r of s.rules) console.log(`  ${r.impact.padEnd(8)} ${r.rule.padEnd(32)} ${String(r.nodes).padStart(5)} nodes on ${String(r.pages).padStart(3)} page views  [${r.modules.join(', ')}]`);
  console.log('\nBy module:');
  for (const m of s.modules) {
    console.log(`  ${m.module}`);
    for (const r of m.rules) console.log(`    ${r.rule.padEnd(32)} ${String(r.nodes).padStart(4)} examples, ${r.pages.length} page views, in ${r.hosts.join(' ')}`);
  }
  for (const e of s.errors) console.log(`  load error ${e.project} ${e.route}: ${e.error}`);
}

function main() {
  const o = args(process.argv.slice(2));
  if (o.run) {
    fs.rmSync(DIR, { recursive: true, force: true });
    const cli = path.join(FRONTEND, 'node_modules', '@playwright', 'test', 'cli.js');
    const pw = spawnSync(process.execPath, [cli, 'test', 'tests/a11y-sweep-2490.spec.ts', '--project=desktop', '--project=mobile', '--workers=1', '--reporter=line', ...o.rest], {
      cwd: FRONTEND,
      stdio: 'inherit',
      env: { ...process.env, SW_A11Y_SWEEP: '1' },
    });
    console.log(`(sweep exit ${pw.status}; a report step, ignored)`);
  }
  const s = summarise(readRows(), tagFiles());
  fs.mkdirSync(path.dirname(o.out), { recursive: true });
  fs.writeFileSync(o.out, JSON.stringify(s, null, 2));
  if (o.json) console.log(JSON.stringify(s, null, 2));
  else print(s);
  console.log(`\nreport: ${path.relative(FRONTEND, o.out)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) main();
