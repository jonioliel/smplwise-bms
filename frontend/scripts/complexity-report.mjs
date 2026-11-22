// CR-FE-COMPLEXITY-2450 (review 08:F22, 06:STRUCT-1 steps 2-3): the cyclomatic complexity report of src/.
// ESLint's own `complexity` rule (each if / case / loop / && / || / ?? / ?: / optional chain / default parameter adds one), run with the
// TypeScript parser and no other rule, so it needs no type information and takes seconds. It reports; it does not fail (no gate yet).
// Usage (from frontend/): node scripts/complexity-report.mjs [--min 25] [--top 60] [--json] [path-or-glob ...]   (default: src/**/*.ts)
import path from 'node:path';
import url from 'node:url';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';

const FRONTEND = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

function args(argv) {
  const o = { min: 25, top: 60, json: false, files: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--min') o.min = Number(argv[++i]);
    else if (a === '--top') o.top = Number(argv[++i]);
    else if (a === '--json') o.json = true;
    else o.files.push(a);
  }
  if (!o.files.length) o.files.push('src/**/*.ts');
  return o;
}

/** Every function at or above `min`, worst first: [{ complexity, file, line, name }]. */
export async function complexityOf(files, min) {
  const eslint = new ESLint({
    cwd: FRONTEND,
    overrideConfigFile: true,
    overrideConfig: [{ files: ['**/*.ts'], languageOptions: { parser: tseslint.parser }, rules: { complexity: ['warn', min] } }],
  });
  const rows = [];
  for (const r of await eslint.lintFiles(files)) {
    for (const m of r.messages) {
      if (m.ruleId !== 'complexity') continue;
      const n = Number(/complexity of (\d+)/.exec(m.message)?.[1] ?? 0);
      rows.push({ complexity: n, file: path.relative(FRONTEND, r.filePath).split(path.sep).join('/'), line: m.line, name: m.message.replace(/ has a complexity.*/, '') });
    }
  }
  return rows.sort((a, b) => b.complexity - a.complexity || a.file.localeCompare(b.file) || a.line - b.line);
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  const o = args(process.argv.slice(2));
  const rows = await complexityOf(o.files, o.min);
  if (o.json) console.log(JSON.stringify(rows, null, 1));
  else {
    console.log(`${rows.length} functions at complexity >= ${o.min}`);
    for (const r of rows.slice(0, o.top)) console.log(`${String(r.complexity).padStart(4)}  ${r.file}:${r.line}  ${r.name}`);
  }
}
