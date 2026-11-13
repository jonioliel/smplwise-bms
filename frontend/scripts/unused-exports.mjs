// CR-FE-GATES-2436 (review 07:F19, 06:DEAD-1 / EXPORT-1): the unused-export report. REPORT-ONLY - it prints counts and always exits 0;
// the removals themselves are done later in small verified batches by the owners of each module (cleanup branches), and
// CR-FE-GATES-ENFORCE fails the gate on a NEW unused export only.
//
// The exported names of every module in src/ come from the TypeScript parser (export const / let / function / class / interface /
// type / enum, `export { a, b }`; `export default` and re-exports `export ... from` are not counted as declarations). A name counts as
// used when its identifier appears in any other file of src/, tests/ or scripts/ (word match, comments and strings included - so the
// report errs towards "used"). Two lists:
//   - unreferenced: the name appears nowhere outside its own file, and not again inside it either (dead code candidates);
//   - file-local: used inside its own file only (over-exported internals; un-exporting them changes nothing).
// Classes that register a custom element (@customElement / customElements.define) are reported apart: their module is loaded for the tag.
// Heuristic: a name built at run time (a dynamic key, a tag string) is not seen. Every item must be verified before any removal.
// Usage (from frontend/): node scripts/unused-exports.mjs [--list] [--json]
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import ts from 'typescript';

const FRONTEND = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SCAN = ['src', 'tests', 'scripts'];

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

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  try {
    const r = report();
    if (argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
    else {
      const kinds = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
      const L = ['unused-exports (report-only, never fails) - src/ against src/, tests/, scripts/'];
      L.push(`  exported declarations: ${r.exports}`);
      L.push(`  unreferenced (no other file, no second use in its own file): ${r.unreferenced.length} (${kinds(r.unreferencedByKind)})`);
      L.push(`  file-local (used only inside their own file): ${r.fileLocal.length} (${kinds(r.fileLocalByKind)})`);
      L.push(`  custom-element classes named nowhere else (loaded for their tag, not counted): ${r.elements.length}`);
      const list = argv.includes('--list') ? r.unreferenced : r.unreferenced.slice(0, 30);
      for (const u of list) L.push(`    ${u.kind.padEnd(8)} ${u.name}  (${u.file}:${u.line})`);
      if (list.length < r.unreferenced.length) L.push(`    ... ${r.unreferenced.length - list.length} more (--list)`);
      L.push('  (a heuristic: verify every item - a second grep over the whole repository - before removing anything)');
      console.log(L.join('\n'));
    }
  } catch (e) {
    console.error(`unused-exports (report-only): ${e instanceof Error ? e.stack : String(e)}`);
  }
  process.exit(0);
}
