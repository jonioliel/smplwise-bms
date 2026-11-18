#!/usr/bin/env node
/**
 * I18N-EN-SWITCH-2438 (owner round 32, Q-SYS-8): the missing-keys report of the main app, per module. Report only: it never
 * edits a source file.
 *
 * Part 1 - catalogues. Every text catalogue registers its tables with `registerCatalogue` (frontend/src/i18n/core.ts). This
 * script bundles every file that registers one (esbuild, from frontend/node_modules), runs the bundle in Node and, for each
 * catalogue, compares the target language (default English) with the Hebrew source:
 *   missing    - a Hebrew key with no entry in the target table (the screen falls back to the Hebrew)
 *   identical  - an entry equal to the Hebrew text while the Hebrew text has Hebrew letters
 *   hebrew     - an entry that differs from the Hebrew but still carries Hebrew letters
 *   gap        - keys whose text, as the target-language screen shows it, carries Hebrew letters (missing + identical + hebrew,
 *                minus Hebrew entries without Hebrew letters such as "WhatsApp")
 * Part 1b - source-text tables (frontend/src/i18n/msg.ts): the Hebrew text is the key. The keys are the plain literals passed
 * to `tr(...)` in the files that import the module's table (`src/i18n/msg/<module>.ts`); a key the table lacks is missing.
 * Part 2 - hard-coded text. Hebrew string and template literals in source files that register no catalogue (they ignore the
 * language), per module: the folder under src/, and for src/screens/ the file-name prefix (live-, system-, wiskey- ...). Comments
 * are skipped. Demo data (`*-mock*`, `fixtures/`) and the public pages (`public-ticket/`, which carry their own four languages)
 * are listed apart.
 *
 * Usage (from the repository root):
 *   node scripts/i18n_missing_keys.mjs                 # print the summary
 *   node scripts/i18n_missing_keys.mjs --write         # also write docs/i18n/MISSING_KEYS_EN.md and .json
 *   node scripts/i18n_missing_keys.mjs --lang ar       # another language (report only; ar / ru are not offered in the switch)
 *   node scripts/i18n_missing_keys.mjs --json          # the JSON on stdout
 */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRONTEND = join(ROOT, 'frontend');
const SRC = join(FRONTEND, 'src');
const args = process.argv.slice(2);
const LANG = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'en';
const WRITE = args.includes('--write');
const JSON_OUT = args.includes('--json');

const HEB = /[֐-׿]/;
const LETTER = /[A-Za-z֐-׿؀-ۿЀ-ӿ]/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}
const rel = (p) => relative(SRC, p).split(sep).join('/');

// ---------------------------------------------------------------- part 1: the registered catalogues
const files = walk(SRC);
// a catalogue file calls registerCatalogue(...) itself, or msgCatalogue(...) (a source-text table, i18n/msg/*.ts)
const registering = files.filter(
  (p) => /\b(registerCatalogue|msgCatalogue)\(/.test(readFileSync(p, 'utf8')) && !p.endsWith(join('i18n', 'core.ts')) && !p.endsWith(join('i18n', 'msg.ts')),
);

async function loadCatalogues() {
  const require = createRequire(join(FRONTEND, 'package.json'));
  const esbuild = require('esbuild');
  const entry = [
    ...registering.map((p) => `import ${JSON.stringify('./' + rel(p).replace(/\.ts$/, ''))};`),
    `export { registeredCatalogues } from './i18n/core';`,
  ].join('\n');
  const dir = join(tmpdir(), `i18n-report-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  const outfile = join(dir, 'bundle.mjs');
  await esbuild.build({
    stdin: { contents: entry, resolveDir: SRC, sourcefile: 'i18n-report-entry.ts', loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'error',
    external: ['lit', 'lit/*', 'three', 'three/*'],
  });
  try {
    const mod = await import(pathToFileURL(outfile).href);
    return mod.registeredCatalogues();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function flatten(table, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(table ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (v && typeof v === 'object') flatten(v, key, out);
  }
  return out;
}

function catalogueRow(cat) {
  const he = flatten(cat.tables.he);
  const target = cat.tables[LANG] ? flatten(cat.tables[LANG]) : null;
  const row = { name: cat.name, keys: 0, missing: 0, identical: 0, hebrew: 0, gap: 0, hasTable: !!target, devMarked: cat.devMarked.includes(LANG), gapKeys: [] };
  for (const [key, heText] of Object.entries(he)) {
    row.keys++;
    const v = target ? target[key] : undefined;
    const heHasHeb = HEB.test(heText);
    if (v === undefined) row.missing++;
    else if (v === heText && heHasHeb) row.identical++;
    else if (HEB.test(v)) row.hebrew++;
    const shown = v ?? heText;
    if (HEB.test(shown)) {
      row.gap++;
      row.gapKeys.push(key);
    }
  }
  return row;
}

// ---------------------------------------------------------------- part 1b: source-text tables
// CR-I18N-COMBINED-B-2442: a file that reads two tables imports the second under an alias (`import { tr as trTime } from '../i18n/msg/time'`);
// each call is counted for the table its own translator reads.
const TR_CALL = /\b(\w+)\(\s*(['"`])((?:\\.|(?!\2)[^\\])*?)\2/g;
function unescape(s) {
  return s.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
}
function msgRows(catalogues) {
  const tables = new Map(catalogues.filter((c) => c.name.startsWith('msg/')).map((c) => [c.name, flatten(c.tables[LANG] ?? {})]));
  const used = new Map([...tables.keys()].map((k) => [k, new Set()]));
  for (const p of files) {
    const src = readFileSync(p, 'utf8');
    const imp = [...src.matchAll(/(?:import\s*\{([^}]*)\}\s*)?from\s+['"][./]*(?:i18n\/)?msg\/([\w-]+)['"]/g)]
      .map((m) => ({ name: `msg/${m[2]}`, local: /\btr\s+as\s+(\w+)/.exec(m[1] ?? '')?.[1] ?? 'tr' }))
      .filter((i) => used.has(i.name));
    if (!imp.length || rel(p).startsWith('i18n/msg/')) continue;
    for (const m of src.matchAll(TR_CALL)) {
      if (m[2] === '`' && m[3].includes('${')) continue;
      for (const i of imp) if (i.local === m[1]) used.get(i.name).add(unescape(m[3]));
    }
  }
  return [...tables.entries()].map(([name, en]) => {
    const keys = [...used.get(name)];
    const missing = keys.filter((k) => en[k] === undefined);
    const hebrew = keys.filter((k) => en[k] !== undefined && HEB.test(en[k]));
    const unused = Object.keys(en).filter((k) => !used.get(name).has(k));
    return { name, keys: keys.length, missing: missing.length, identical: 0, hebrew: hebrew.length, gap: missing.length + hebrew.length, hasTable: true, devMarked: false, gapKeys: [...missing, ...hebrew], unused: unused.length };
  });
}

// ---------------------------------------------------------------- part 2: hard-coded Hebrew outside the catalogues
/** Hebrew-bearing literal segments of a TS source: '...', "...", `...` text parts (comments skipped). */
function hebrewLiterals(src) {
  const found = [];
  let i = 0;
  const n = src.length;
  const tplStack = []; // brace depth per open template `${`
  let braceDepth = 0;
  const push = (s, start) => {
    if (!HEB.test(s)) return;
    if (start !== undefined && /\btr\(\s*$/.test(src.slice(Math.max(0, start - 12), start))) return; // a source-text key: part 1b
    found.push(s.trim().slice(0, 80));
  };
  const readTemplateText = () => {
    // at the char after ` or after the closing } of a ${}: read text until ` or ${
    let s = '';
    while (i < n) {
      const c = src[i];
      if (c === '\\') {
        s += src.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === '`') {
        i++;
        push(s);
        return;
      }
      if (c === '$' && src[i + 1] === '{') {
        i += 2;
        push(s);
        tplStack.push(braceDepth);
        braceDepth++;
        return;
      }
      s += c;
      i++;
    }
    push(s);
  };
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i);
      i = e < 0 ? n : e;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      i = e < 0 ? n : e + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      let s = '';
      while (j < n && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\') {
          s += src.slice(j, j + 2);
          j += 2;
          continue;
        }
        s += src[j++];
      }
      push(s, i);
      i = j + 1;
      continue;
    }
    if (c === '`') {
      const start = i;
      i++;
      const before = found.length;
      readTemplateText();
      if (found.length > before && /\btr\(\s*$/.test(src.slice(Math.max(0, start - 12), start))) found.length = before;
      continue;
    }
    if (c === '{') {
      braceDepth++;
      i++;
      continue;
    }
    if (c === '}') {
      braceDepth--;
      i++;
      if (tplStack.length && tplStack[tplStack.length - 1] === braceDepth) {
        tplStack.pop();
        readTemplateText();
      }
      continue;
    }
    i++;
  }
  return found;
}

function moduleOf(r) {
  const parts = r.split('/');
  if (parts.length === 1) return '(src root)';
  if (parts[0] === 'screens') {
    const base = parts[parts.length - 1].replace(/\.ts$/, '');
    if (parts.length > 2) return `screens/${parts[1]}`;
    return `screens/${base.split('-')[0]}-*`;
  }
  return parts[0];
}

function kindOf(r) {
  if (/(^|\/)fixtures\//.test(r) || /-mock/.test(r) || /(^|\/)mock/.test(r)) return 'demo';
  if (r.startsWith('public-ticket/')) return 'public';
  return 'app';
}

function literalRows() {
  const registeringSet = new Set(registering.map(rel));
  const byModule = new Map();
  for (const p of files) {
    const r = rel(p);
    // CR-I18N-LAZY-LANG-2443: i18n/lang/** are the language packs (their Hebrew is the msg tables' keys), read through the catalogues above
    if (registeringSet.has(r) || r === 'i18n/core.ts' || r === 'i18n/en.ts' || r === 'i18n/frigate-en.ts' || r.startsWith('i18n/lang/')) continue;
    const lits = hebrewLiterals(readFileSync(p, 'utf8'));
    if (!lits.length) continue;
    const kind = kindOf(r);
    const key = kind === 'app' ? moduleOf(r) : kind === 'demo' ? '(demo data)' : '(public pages, own languages)';
    const row = byModule.get(key) ?? { module: key, kind, files: 0, literals: 0, fileList: [] };
    row.files++;
    row.literals += lits.length;
    row.fileList.push({ file: r, literals: lits.length });
    byModule.set(key, row);
  }
  return [...byModule.values()].sort((a, b) => (a.kind === b.kind ? b.literals - a.literals : a.kind === 'app' ? -1 : 1));
}

// ---------------------------------------------------------------- report
const registered = await loadCatalogues();
const cats = [...registered.filter((c) => !c.name.startsWith('msg/')).map(catalogueRow), ...msgRows(registered)].sort((a, b) => b.gap - a.gap || a.name.localeCompare(b.name));
const lits = literalRows();
const sum = (rows, f) => rows.reduce((a, r) => a + r[f], 0);
const totals = {
  lang: LANG,
  catalogues: cats.length,
  keys: sum(cats, 'keys'),
  missing: sum(cats, 'missing'),
  identical: sum(cats, 'identical'),
  hebrew: sum(cats, 'hebrew'),
  gap: sum(cats, 'gap'),
  hardcodedModules: lits.filter((r) => r.kind === 'app').length,
  hardcodedLiterals: sum(lits.filter((r) => r.kind === 'app'), 'literals'),
  hardcodedFiles: sum(lits.filter((r) => r.kind === 'app'), 'files'),
};

if (JSON_OUT) {
  process.stdout.write(JSON.stringify({ totals, catalogues: cats, hardcoded: lits }, null, 2) + '\n');
} else {
  console.log(`language: ${LANG}`);
  console.log(`catalogues: ${totals.catalogues}, keys: ${totals.keys}, missing: ${totals.missing}, identical: ${totals.identical}, hebrew: ${totals.hebrew}, gap: ${totals.gap}`);
  console.log(`hard-coded Hebrew (app): ${totals.hardcodedLiterals} literals in ${totals.hardcodedFiles} files, ${totals.hardcodedModules} modules`);
}

if (WRITE) {
  const outDir = join(ROOT, 'docs', 'i18n');
  mkdirSync(outDir, { recursive: true });
  const L = LANG.toUpperCase();
  const md = [];
  md.push(`# Missing ${L} interface text - report`);
  md.push('');
  md.push(`Generated by \`node scripts/i18n_missing_keys.mjs --write${LANG === 'en' ? '' : ` --lang ${LANG}`}\`. Do not edit by hand.`);
  md.push('');
  md.push('## Totals');
  md.push('');
  md.push('| measure | count |');
  md.push('| --- | ---: |');
  md.push(`| catalogues | ${totals.catalogues} |`);
  md.push(`| Hebrew keys in catalogues | ${totals.keys} |`);
  md.push(`| missing in ${LANG} | ${totals.missing} |`);
  md.push(`| identical to the Hebrew | ${totals.identical} |`);
  md.push(`| ${LANG} text with Hebrew letters | ${totals.hebrew} |`);
  md.push(`| **gap: keys that show Hebrew in the ${LANG} interface** | **${totals.gap}** |`);
  md.push(`| hard-coded Hebrew literals outside catalogues (app) | ${totals.hardcodedLiterals} in ${totals.hardcodedFiles} files |`);
  md.push('');
  md.push('## Catalogues (per module)');
  md.push('');
  md.push(`| catalogue | keys | missing | identical | hebrew | gap | note |`);
  md.push('| --- | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const r of cats) {
    const note = [!r.hasTable ? `no ${LANG} table` : '', r.devMarked ? 'dev-marked' : ''].filter(Boolean).join(', ');
    md.push(`| ${r.name} | ${r.keys} | ${r.missing} | ${r.identical} | ${r.hebrew} | ${r.gap} | ${note} |`);
  }
  md.push('');
  md.push('## Hard-coded Hebrew outside catalogues (per module)');
  md.push('');
  md.push('These texts ignore the interface language. Moving them into a catalogue is the per-module work of Q-SYS-8.');
  md.push('');
  md.push('| module | files | literals |');
  md.push('| --- | ---: | ---: |');
  for (const r of lits) md.push(`| ${r.module} | ${r.files} | ${r.literals} |`);
  md.push('');
  writeFileSync(join(outDir, `MISSING_KEYS_${L}.md`), md.join('\n'), 'utf8');
  writeFileSync(join(outDir, `MISSING_KEYS_${L}.json`), JSON.stringify({ totals, catalogues: cats, hardcoded: lits }, null, 1) + '\n', 'utf8');
  console.log(`wrote docs/i18n/MISSING_KEYS_${L}.md and .json`);
}
