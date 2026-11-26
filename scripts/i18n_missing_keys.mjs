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
 *   placeholder - (I18N-EN-2490) an entry whose `{name}` placeholders differ from the Hebrew (a value would be lost or shown raw);
 *                the tickets module's term tokens ({ticket}, {the_tickets}, {module} ..., filled by tickets/naming.ts in every
 *                language) do not count
 *   script     - (I18N-ARRU-2550, --lang ar / ru only) an entry in the other language's letters (Cyrillic in an Arabic text, Arabic
 *                in a Russian one): a word pasted into the wrong table
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
 *   node scripts/i18n_missing_keys.mjs --ratchet       # (I18N-EN-2490) lower docs/i18n/EN_RATCHET.json to today's counts; it never
 *                                                      # raises a count unless --allow-raise is given too (read by the unit spec
 *                                                      # frontend/tests/unit-i18n-en-ratchet-2490.spec.ts)
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
const RATCHET = args.includes('--ratchet');
const ALLOW_RAISE = args.includes('--allow-raise');

const HEB = /[֐-׿]/;
// the tickets module's term tokens (tickets/naming.ts TOKEN): filled in every language, so the English may word them differently
const TERM_TOKENS = new Set(['the_tickets', 'the_ticket', 'tickets', 'ticket', 'module']);
const placeholders = (s) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((n) => !TERM_TOKENS.has(n)))].sort().join(',');
const LETTER = /[A-Za-z֐-׿؀-ۿЀ-ӿ]/;
// I18N-ARRU-2550: the letters that never belong in the target language's text (frontend/tests/unit-i18n-arru-completeness-2550.spec.ts)
const FOREIGN = { ar: /[Ѐ-ӿ]/, ru: /[؀-ۿ]/ }[LANG] ?? null;

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
  const row = { name: cat.name, keys: 0, missing: 0, identical: 0, hebrew: 0, gap: 0, placeholder: 0, hasTable: !!target, devMarked: cat.devMarked.includes(LANG), gapKeys: [], missingKeys: [], placeholderKeys: [], scriptKeys: [] };
  for (const [key, heText] of Object.entries(he)) {
    row.keys++;
    const v = target ? target[key] : undefined;
    const heHasHeb = HEB.test(heText);
    if (v === undefined) {
      row.missing++;
      row.missingKeys.push(key);
    }
    else if (v === heText && heHasHeb) row.identical++;
    else if (HEB.test(v)) row.hebrew++;
    if (v !== undefined && placeholders(v) !== placeholders(heText)) {
      row.placeholder++;
      row.placeholderKeys.push(key);
    }
    if (v !== undefined && FOREIGN && FOREIGN.test(v)) row.scriptKeys.push(key);
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
  // I18N-ARRU-2550: a source-text table without a table of LANG (every one has English; none has Arabic / Russian) says so
  const withTable = new Set(catalogues.filter((c) => c.name.startsWith('msg/') && c.tables[LANG]).map((c) => c.name));
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
    // every entry of the table, used or not (a key read through a variable is not seen by the scan above)
    const placeholderKeys = Object.keys(en).filter((k) => placeholders(en[k]) !== placeholders(k));
    return { name, keys: keys.length, missing: missing.length, identical: 0, hebrew: hebrew.length, gap: missing.length + hebrew.length, placeholder: placeholderKeys.length, hasTable: withTable.has(name), devMarked: false, scriptKeys: [], gapKeys: [...missing, ...hebrew], missingKeys: missing, placeholderKeys, unused: unused.length, unusedKeys: unused };
  });
}

// ---------------------------------------------------------------- part 2: hard-coded Hebrew outside the catalogues
/** The local names a source reads source-text tables under: `tr`, plus the aliases of `import { tr as trTime } from '../i18n/msg/time'`
 * (I18N-EN-2490: a key passed to an aliased translator is a catalogue key of part 1b, not a hard-coded text). */
function translatorCall(src) {
  const names = new Set(['tr']);
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s+['"][./]*(?:i18n\/)?msg\/[\w-]+['"]/g)) for (const a of m[1].matchAll(/\btr\s+as\s+(\w+)/g)) names.add(a[1]);
  return new RegExp(`\\b(?:${[...names].join('|')})\\(\\s*$`);
}

/** Hebrew-bearing literal segments of a TS source: '...', "...", `...` text parts (comments skipped). */
/**
 * I18N-REST-2520: the lines whose Hebrew is kept on purpose, each with its reason in the comment that marks it:
 *   `// i18n-keep: <reason>` (or `/* i18n-keep: <reason> *\/`) - the literals of that line; a comment alone on its line also covers
 *   the next line;
 *   `// i18n-keep-start: <reason>` ... `// i18n-keep-end` - every line between them (a table of matcher words, a four-language table).
 * What may be kept: text compared or matched (keywords, matcher words, confirmation words), the Hebrew side of a table that has its
 * own English beside it, stored identifiers, and the language's own name. The report counts the kept literals apart (`kept`).
 */
export function keptLines(src) {
  const lines = src.split('\n');
  const kept = new Set();
  let open = false;
  lines.forEach((line, idx) => {
    const no = idx + 1;
    if (/i18n-keep-start\b/.test(line)) open = true;
    if (open || /i18n-keep\b(?!-)/.test(line)) kept.add(no);
    if (/i18n-keep\b(?!-)/.test(line) && /^\s*(\/\/|\/\*)/.test(line)) kept.add(no + 1);
    if (/i18n-keep-end\b/.test(line)) open = false;
  });
  return kept;
}

function hebrewLiterals(src, keptOut = []) {
  const found = [];
  let i = 0;
  const n = src.length;
  const tplStack = []; // brace depth per open template `${`
  let braceDepth = 0;
  const trCall = translatorCall(src);
  const kept = keptLines(src);
  const lineAt = (pos) => {
    let line = 1;
    for (let k = src.indexOf('\n'); k >= 0 && k < pos; k = src.indexOf('\n', k + 1)) line++;
    return line;
  };
  const push = (raw, start) => {
    // I18N-REST-2520: a CSS comment inside a template (css`` blocks) is not text
    const s = HEB.test(raw) && raw.includes('/*') ? raw.replace(/\/\*[\s\S]*?\*\//g, '') : raw;
    if (!HEB.test(s)) return;
    if (start !== undefined && trCall.test(src.slice(Math.max(0, start - 24), start))) return; // a source-text key: part 1b
    // kept: the line where the text starts, or the line of its first Hebrew letter, carries an `i18n-keep` mark
    if (start !== undefined && kept.size && (kept.has(lineAt(start)) || kept.has(lineAt(start + Math.max(0, raw.search(HEB)))))) {
      keptOut.push(s.trim().slice(0, 80));
      return;
    }
    found.push(s.trim().slice(0, 80));
  };
  const readTemplateText = () => {
    // at the char after ` or after the closing } of a ${}: read text until ` or ${
    let s = '';
    const from = i;
    while (i < n) {
      const c = src[i];
      if (c === '\\') {
        s += src.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === '`') {
        i++;
        push(s, from);
        return;
      }
      if (c === '$' && src[i + 1] === '{') {
        i += 2;
        push(s, from);
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
      if (found.length > before && trCall.test(src.slice(Math.max(0, start - 24), start))) found.length = before;
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
  // I18N-EN-2490: the api demo stores as the api lint names them (tests/unit-i18n-api-2442.spec.ts DEMO_FILE): whole files of fake data
  // that may not call tr()
  if (/^api\/[\w-]+-demo\.ts$/.test(r) || r === 'api/messaging-fake.ts') return 'demo';
  // I18N-REST-2520: the other whole demo stores (invented data behind the static demo and the specs; no request is made): the
  // calendars demo backend, the electricity fixtures, the plan wizard's sample house, the home screen's demo sites
  if (['calendars/demo.ts', 'electricity/fixtures.ts', 'plan-wizard/wizard-demo.ts', 'screens/home-site-demo.ts', 'screens/home-demo.ts'].includes(r)) return 'demo';
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
    const keptLits = [];
    const lits = hebrewLiterals(readFileSync(p, 'utf8'), keptLits);
    if (!lits.length && !keptLits.length) continue;
    const kind = kindOf(r);
    const key = kind === 'app' ? moduleOf(r) : kind === 'demo' ? '(demo data)' : '(public pages, own languages)';
    const row = byModule.get(key) ?? { module: key, kind, files: 0, literals: 0, kept: 0, fileList: [] };
    // I18N-REST-2520: `kept` = literals marked `i18n-keep` (Hebrew on purpose, the reason beside them); not counted in `literals`
    if (lits.length) row.files++;
    row.literals += lits.length;
    row.kept += keptLits.length;
    row.fileList.push({ file: r, literals: lits.length, kept: keptLits.length });
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
  placeholder: sum(cats, 'placeholder'),
  hardcodedModules: lits.filter((r) => r.kind === 'app' && r.literals > 0).length,
  hardcodedLiterals: sum(lits.filter((r) => r.kind === 'app'), 'literals'),
  hardcodedFiles: sum(lits.filter((r) => r.kind === 'app'), 'files'),
  keptLiterals: sum(lits.filter((r) => r.kind === 'app'), 'kept'),
};

if (JSON_OUT) {
  process.stdout.write(JSON.stringify({ totals, catalogues: cats, hardcoded: lits }, null, 2) + '\n');
} else {
  console.log(`language: ${LANG}`);
  console.log(`catalogues: ${totals.catalogues}, keys: ${totals.keys}, missing: ${totals.missing}, identical: ${totals.identical}, hebrew: ${totals.hebrew}, gap: ${totals.gap}, placeholder: ${totals.placeholder}`);
  console.log(`hard-coded Hebrew (app): ${totals.hardcodedLiterals} literals in ${totals.hardcodedFiles} files, ${totals.hardcodedModules} modules; kept on purpose (i18n-keep): ${totals.keptLiterals}`);
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
  md.push(`| ${LANG} text whose \`{placeholders}\` differ from the Hebrew | ${totals.placeholder} |`);
  md.push(`| hard-coded Hebrew literals outside catalogues (app) | ${totals.hardcodedLiterals} in ${totals.hardcodedFiles} files |`);
  md.push(`| Hebrew kept on purpose (\`i18n-keep\`, reason in the source) | ${totals.keptLiterals} |`);
  md.push('');
  md.push('## Catalogues (per module)');
  md.push('');
  md.push(`| catalogue | keys | missing | identical | hebrew | gap | placeholder | note |`);
  md.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const r of cats) {
    const note = [!r.hasTable ? `no ${LANG} table` : '', r.devMarked ? 'dev-marked' : '', r.unused ? `${r.unused} unused` : ''].filter(Boolean).join(', ');
    md.push(`| ${r.name} | ${r.keys} | ${r.missing} | ${r.identical} | ${r.hebrew} | ${r.gap} | ${r.placeholder} | ${note} |`);
  }
  const listed = cats.filter((r) => r.gapKeys.length || r.placeholderKeys.length);
  if (listed.length) {
    md.push('');
    md.push(`### Keys that show Hebrew in ${LANG}, or whose placeholders differ`);
    md.push('');
    for (const r of listed) {
      for (const k of r.gapKeys) md.push(`- ${r.name}: gap \`${k}\``);
      for (const k of r.placeholderKeys) md.push(`- ${r.name}: placeholder \`${k}\``);
    }
  }
  md.push('');
  md.push('## Hard-coded Hebrew outside catalogues (per module)');
  md.push('');
  md.push('These texts ignore the interface language. Moving them into a catalogue is the per-module work of Q-SYS-8.');
  md.push('');
  md.push('| module | files | literals | kept on purpose |');
  md.push('| --- | ---: | ---: | ---: |');
  for (const r of lits) md.push(`| ${r.module} | ${r.files} | ${r.literals} | ${r.kept ?? 0} |`);
  md.push('');
  writeFileSync(join(outDir, `MISSING_KEYS_${L}.md`), md.join('\n'), 'utf8');
  writeFileSync(join(outDir, `MISSING_KEYS_${L}.json`), JSON.stringify({ totals, catalogues: cats, hardcoded: lits }, null, 1) + '\n', 'utf8');
  console.log(`wrote docs/i18n/MISSING_KEYS_${L}.md and .json`);
}

// ---------------------------------------------------------------- ratchet (I18N-EN-2490)
// docs/i18n/EN_RATCHET.json: the keys allowed to show Hebrew / to differ in placeholders, and the most hard-coded Hebrew literals each
// module may still hold. The unit spec fails on anything above it; this mode only lowers it (a fixed key leaves the list, a module's
// count drops). --allow-raise is for a reviewed exception and must be explained in the change note.
function ratchetOf(t, catalogues, hardcoded) {
  const app = hardcoded.filter((r) => r.kind === 'app');
  return {
    lang: 'en',
    gapKeys: catalogues.flatMap((r) => r.gapKeys.map((k) => `${r.name}: ${k}`)).sort(),
    placeholderKeys: catalogues.flatMap((r) => r.placeholderKeys.map((k) => `${r.name}: ${k}`)).sort(),
    hardcodedTotal: t.hardcodedLiterals,
    hardcoded: Object.fromEntries(app.filter((r) => r.literals > 0).map((r) => [r.module, r.literals]).sort((a, b) => a[0].localeCompare(b[0]))),
    // I18N-REST-2520: the literals kept Hebrew on purpose (`i18n-keep`, reason in the source) - a new keep is a reviewed raise
    keptTotal: t.keptLiterals,
  };
}
if (RATCHET) {
  if (LANG !== 'en') throw new Error('--ratchet is for English only');
  const file = join(ROOT, 'docs', 'i18n', 'EN_RATCHET.json');
  const now = ratchetOf(totals, cats, lits);
  let old = null;
  try {
    old = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    old = null;
  }
  const raised = [];
  if (old) {
    for (const k of now.gapKeys) if (!old.gapKeys.includes(k)) raised.push(`gap ${k}`);
    for (const k of now.placeholderKeys) if (!old.placeholderKeys.includes(k)) raised.push(`placeholder ${k}`);
    for (const [m, n] of Object.entries(now.hardcoded)) if (n > (old.hardcoded[m] ?? 0)) raised.push(`hard-coded ${m}: ${old.hardcoded[m] ?? 0} -> ${n}`);
    if (old.keptTotal !== undefined && now.keptTotal > old.keptTotal) raised.push(`kept on purpose: ${old.keptTotal} -> ${now.keptTotal}`);
  }
  if (raised.length && !ALLOW_RAISE) {
    console.error(`refused: the ratchet would go up (fix these, or pass --allow-raise with a reason in the change note):\n  ${raised.join('\n  ')}`);
    process.exit(1);
  }
  // the reasons of the allowed keys are written by hand and kept; a reason whose key left the lists is dropped
  const allowed = new Set([...now.gapKeys, ...now.placeholderKeys]);
  const why = Object.fromEntries(Object.entries(old?.why ?? {}).filter(([k]) => allowed.has(k)));
  const note = 'I18N-EN-2490: written by `node scripts/i18n_missing_keys.mjs --ratchet` (it only lowers); read by frontend/tests/unit-i18n-en-ratchet-2490.spec.ts';
  writeFileSync(file, JSON.stringify({ note, why, ...now }, null, 1) + '\n', 'utf8');
  console.log(`wrote docs/i18n/EN_RATCHET.json (hard-coded ${old ? old.hardcodedTotal : '-'} -> ${now.hardcodedTotal}, gap keys ${now.gapKeys.length}, placeholder keys ${now.placeholderKeys.length})`);
}
