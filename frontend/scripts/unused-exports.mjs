// CR-FE-GATES-2436 (review 07:F19, 06:DEAD-1 / EXPORT-1): the unused-export report.
// CR-FE-GATES-ENFORCE-2442: `--enforce` compares the two lists with the baseline (scripts/gates-baseline.json, `unusedExports`) and
// exits 1 when an export is on a list and NOT in the baseline - so the lists can only shrink. An entry of the baseline that is no
// longer on a list is printed as a note (prune it with `--update-baseline`); it does not fail. Without `--enforce` the script is the
// report it was: it prints counts and exits 0.
//
// The exported names of every module in src/ come from the TypeScript parser (export const / let / function / class / interface /
// type / enum, `export { a, b }`; `export default` and re-exports `export ... from` are not counted as declarations). A name counts as
// used when its identifier appears in any other file of src/, tests/ or scripts/ (word match, comments and strings included - so the
// report errs towards "used"). Two lists:
//   - unreferenced: the name appears nowhere outside its own file, and not again inside it either (dead code candidates);
//   - file-local: used inside its own file only (over-exported internals; un-exporting them changes nothing).
// Classes that register a custom element (@customElement / customElements.define) are reported apart: their module is loaded for the tag.
// Heuristic: a name built at run time (a dynamic key, a tag string) is not seen. Every item must be verified before any removal.
// Usage (from frontend/): node scripts/unused-exports.mjs [--list] [--json] [--enforce] [--update-baseline] [--baseline <file>] [--root <dir>]
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import ts from 'typescript';

const FRONTEND = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SCAN = ['src', 'tests', 'scripts'];
export const BASELINE_FILE = path.join(FRONTEND, 'scripts', 'gates-baseline.json');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    if (n.name === 'node_modules' || n.name === 'archive') continue;
    const p = path.join(dir, n.name);
    if (n.isDirectory()) walk(p, out);
    else if (/\.(ts|mjs|js)$/.test(n.name)) out.push(p);
  }
  return out;
}

const hasExport = (node) => (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0 && (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Default) === 0;

/** The exported declarations of one module: [{ name, kind, line, element }]. */
export function exportsOf(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const out = [];
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st) && hasExport(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) out.push({ name: d.name.text, kind: 'const', line: line(d) });
    } else if (ts.isFunctionDeclaration(st) && st.name && hasExport(st)) out.push({ name: st.name.text, kind: 'function', line: line(st) });
    else if (ts.isClassDeclaration(st) && st.name && hasExport(st)) {
      const decorated = (ts.getDecorators?.(st) ?? []).some((d) => /customElement/.test(d.getText(sf)));
      out.push({ name: st.name.text, kind: 'class', line: line(st), element: decorated || new RegExp(`customElements\\.define\\([^)]*\\b${st.name.text}\\b`).test(text) });
    } else if (ts.isInterfaceDeclaration(st) && hasExport(st)) out.push({ name: st.name.text, kind: 'type', line: line(st) });
    else if (ts.isTypeAliasDeclaration(st) && hasExport(st)) out.push({ name: st.name.text, kind: 'type', line: line(st) });
    else if (ts.isEnumDeclaration(st) && hasExport(st)) out.push({ name: st.name.text, kind: 'enum', line: line(st) });
    else if (ts.isExportDeclaration(st) && !st.moduleSpecifier && st.exportClause && ts.isNamedExports(st.exportClause)) {
      for (const e of st.exportClause.elements) out.push({ name: e.name.text, kind: 'const', line: line(e) });
    }
  }
  return out;
}

/** identifier -> number of occurrences, per file */
function tokens(text) {
  const m = new Map();
  for (const t of text.matchAll(/[A-Za-z_$][\w$]*/g)) m.set(t[0], (m.get(t[0]) ?? 0) + 1);
  return m;
}

export function report(root = FRONTEND) {
  const files = SCAN.flatMap((d) => walk(path.join(root, d)));
  const text = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));
  const tok = new Map([...text].map(([f, t]) => [f, tokens(t)]));
  const elsewhere = new Map(); // name -> number of files that mention it
  for (const m of tok.values()) for (const k of m.keys()) elsewhere.set(k, (elsewhere.get(k) ?? 0) + 1);
  const unreferenced = [];
  const fileLocal = [];
  const elements = [];
  let total = 0;
  for (const f of files) {
    const rel = path.relative(root, f).replace(/\\/g, '/');
    if (!rel.startsWith('src/') || !f.endsWith('.ts') || f.endsWith('.d.ts')) continue;
    const own = tok.get(f);
    for (const e of exportsOf(rel, text.get(f))) {
      total++;
      const filesWithName = elsewhere.get(e.name) ?? 0;
      if (filesWithName > 1) continue; // another file mentions the name
      const row = { file: rel, line: e.line, name: e.name, kind: e.kind };
      if (e.element) elements.push(row);
      else if ((own.get(e.name) ?? 0) <= 1) unreferenced.push(row);
      else fileLocal.push(row);
    }
  }
  const byKind = (rows) => rows.reduce((o, r) => ((o[r.kind] = (o[r.kind] ?? 0) + 1), o), {});
  return { exports: total, unreferenced, fileLocal, elements, unreferencedByKind: byKind(unreferenced), fileLocalByKind: byKind(fileLocal), mode: 'report-only' };
}

/** The baseline key of a row: the module and the name (no line number - a moved declaration is the same declaration). */
export const keyOf = (row) => `${row.file}#${row.name}`;

/** The report against a baseline { unreferenced: [key], fileLocal: [key] }: what is new (fails) and what is gone (a note). */
export function compare(r, baseline) {
  const diff = (rows, keys) => {
    const base = new Set(keys ?? []);
    const now = new Set(rows.map(keyOf));
    return { added: rows.filter((x) => !base.has(keyOf(x))), gone: [...base].filter((k) => !now.has(k)).sort() };
  };
  const u = diff(r.unreferenced, baseline?.unreferenced);
  const f = diff(r.fileLocal, baseline?.fileLocal);
  return {
    baseline: { unreferenced: (baseline?.unreferenced ?? []).length, fileLocal: (baseline?.fileLocal ?? []).length },
    newUnreferenced: u.added,
    newFileLocal: f.added,
    goneUnreferenced: u.gone,
    goneFileLocal: f.gone,
    ok: u.added.length === 0 && f.added.length === 0,
  };
}

function readBaseline(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
  const enforce = argv.includes('--enforce');
  const update = argv.includes('--update-baseline');
  const baselineFile = opt('--baseline') ? path.resolve(opt('--baseline')) : BASELINE_FILE;
  let code = 0;
  try {
    const r = report(opt('--root') ? path.resolve(opt('--root')) : FRONTEND);
    r.mode = enforce ? 'enforce' : 'report-only';
    if (update) {
      const all = fs.existsSync(baselineFile) ? readBaseline(baselineFile) : {};
      all.unusedExports = { unreferenced: r.unreferenced.map(keyOf).sort(), fileLocal: r.fileLocal.map(keyOf).sort() };
      fs.writeFileSync(baselineFile, `${JSON.stringify(all, null, 2)}\n`);
    }
    const c = enforce || update ? compare(r, readBaseline(baselineFile).unusedExports) : null;
    if (c) r.baseline = c;
    if (enforce && !c.ok) code = 1;
    if (argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
    else {
      const kinds = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
      const L = [`unused-exports (${enforce ? 'ENFORCED against the baseline' : 'report-only, never fails'}) - src/ against src/, tests/, scripts/`];
      L.push(`  exported declarations: ${r.exports}`);
      L.push(`  unreferenced (no other file, no second use in its own file): ${r.unreferenced.length} (${kinds(r.unreferencedByKind)})`);
      L.push(`  file-local (used only inside their own file): ${r.fileLocal.length} (${kinds(r.fileLocalByKind)})`);
      L.push(`  custom-element classes named nowhere else (loaded for their tag, not counted): ${r.elements.length}`);
      if (c) {
        L.push(`  baseline: unreferenced ${c.baseline.unreferenced}, file-local ${c.baseline.fileLocal} (${path.relative(FRONTEND, baselineFile).split(path.sep).join('/')})`);
        for (const u of c.newUnreferenced) L.push(`    NEW unreferenced  ${u.kind.padEnd(8)} ${u.name}  (${u.file}:${u.line})`);
        for (const u of c.newFileLocal) L.push(`    NEW file-local    ${u.kind.padEnd(8)} ${u.name}  (${u.file}:${u.line})`);
        const gone = c.goneUnreferenced.length + c.goneFileLocal.length;
        if (gone) L.push(`  note: ${gone} baseline entries are no longer on a list - prune them: node scripts/unused-exports.mjs --update-baseline`);
        for (const k of [...c.goneUnreferenced, ...c.goneFileLocal]) L.push(`    gone  ${k}`);
        if (enforce) {
          L.push(c.ok
            ? '  -> OK: no export outside the baseline'
            : `  -> FAIL: ${c.newUnreferenced.length + c.newFileLocal.length} export(s) outside the baseline. Use the export, delete it, or drop the \`export\` keyword (file-local);`
              + ' an export built ahead of its caller is added to the baseline on purpose (--update-baseline, say why in the change note).');
        }
      } else {
        const list = argv.includes('--list') ? r.unreferenced : r.unreferenced.slice(0, 30);
        for (const u of list) L.push(`    ${u.kind.padEnd(8)} ${u.name}  (${u.file}:${u.line})`);
        if (list.length < r.unreferenced.length) L.push(`    ... ${r.unreferenced.length - list.length} more (--list)`);
        L.push('  (a heuristic: verify every item - a second grep over the whole repository - before removing anything)');
      }
      console.log(L.join('\n'));
    }
  } catch (e) {
    console.error(`unused-exports: ${e instanceof Error ? e.stack : String(e)}`);
    if (enforce) code = 2; // the check could not run: not a pass
  }
  process.exit(code);
}
