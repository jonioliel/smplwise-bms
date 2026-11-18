#!/usr/bin/env node
// CR-I18N-LAZY-LANG-2443 (code review 07:F11, owner O4 = a): moves the non-Hebrew text tables out of the catalogue modules into
// language packs, so English / Arabic / Russian are fetched only when the page is in that language.
//
// For every module under src/ (not the public pages, not the TV board, not the service worker) it finds the top-level
// declarations of a language table - `const en = { ... }`, `export const PF_EN = { ... }`, `msgCatalogue('msg/x', { ... })` - whose
// initialiser is a plain object literal that references nothing of the module, and:
//   1. writes the literal to src/i18n/lang/<lang>/<module path>.ts as `export const <name> = { ... };`
//   2. replaces it in the module with the pack's live table: `packTable<typeof import('<that file>').<name>>('<lang>', '<module>', '<name>')`
//      (a declared type stays on the declaration);
//   3. regenerates src/i18n/lang/<lang>.ts, the pack of the language (every file under src/i18n/lang/<lang>/).
// A table that references something of its module is listed and left in place.
//
// Re-runnable: a table already moved is a `packTable(...)` call and is skipped, so after a merge brings an inline table back the
// script moves only that one (it refuses to overwrite a pack file that already exports the same name).
//
// Usage (from frontend/): node scripts/i18n-split-langs.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const FRONTEND = path.join(HERE, '..');
const SRC = path.join(FRONTEND, 'src');
const LANG_DIR = path.join(SRC, 'i18n', 'lang');
const ts = createRequire(path.join(FRONTEND, 'package.json'))('typescript');
const DRY = process.argv.includes('--dry');
const LANGS = ['en', 'ar', 'ru'];
const SKIP_DIRS = ['public-ticket', 'notice-tv', 'pwa', path.join('i18n', 'lang')].map((d) => path.join(SRC, d) + path.sep);
// modules the public pages (vite.public.config.ts, target es2020, no top-level await) also bundle: they keep their tables
const SHARED_WITH_PUBLIC = new Set(['format/bytes']);
const GLOBALS = new Set(['undefined', 'String', 'Number', 'Math', 'JSON', 'Object', 'Array', 'Intl', 'Date', 'Boolean', 'NaN', 'Infinity']);

/** The language of a declaration name, or null. */
export function langOfName(name) {
  if (/_(KEYS|DEV_MARKED)$|Keys$/.test(name)) return null;
  for (const l of LANGS) {
    const U = l.toUpperCase();
    const C = l[0].toUpperCase() + l[1];
    if (name === l || name === U) return l;
    if (new RegExp(`^${l}[A-Z_]`).test(name)) return l; // enStationsText, en_x
    if (new RegExp(`^${U}_`).test(name)) return l; // EN_SUMMARY
    if (new RegExp(`_${U}$`).test(name)) return l; // PF_EN, LOC_TEXT_EN
    if (new RegExp(`[a-z0-9]${C}$`).test(name)) return l; // textEn
  }
  return null;
}

function walk(dir, out = []) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) {
      if (!SKIP_DIRS.some((s) => (p + path.sep).startsWith(s))) walk(p, out);
    } else if (n.name.endsWith('.ts') && !n.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const modName = (p) => path.relative(SRC, p).split(path.sep).join('/').replace(/\.ts$/, '');

/** Strips `as const` / `satisfies X` / parentheses; returns { literal, wrapper } or null when the core is not an object literal. */
function coreLiteral(expr) {
  let e = expr;
  const wraps = [];
  for (;;) {
    if (ts.isParenthesizedExpression(e)) e = e.expression;
    else if (ts.isAsExpression(e) && e.type.getText() === 'const') {
      wraps.push('as const');
      e = e.expression;
    } else if (ts.isSatisfiesExpression?.(e)) {
      wraps.push(`satisfies ${e.type.getText()}`);
      e = e.expression;
    } else break;
  }
  return ts.isObjectLiteralExpression(e) ? { literal: e, wraps } : null;
}

/** Identifiers the literal reads that it does not declare itself (parameters of arrow functions inside it are its own). */
function freeIdentifiers(node) {
  const declared = new Set();
  const used = new Set();
  const visit = (n) => {
    if (ts.isParameter(n) || ts.isVariableDeclaration(n) || ts.isBindingElement(n)) {
      const collect = (b) => {
        if (ts.isIdentifier(b)) declared.add(b.text);
        else b.elements?.forEach((el) => !ts.isOmittedExpression(el) && collect(el.name));
      };
      collect(n.name);
    }
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const isName =
        (ts.isPropertyAssignment(p) && p.name === n) ||
        (ts.isPropertyAccessExpression(p) && p.name === n) ||
        (ts.isMethodDeclaration(p) && p.name === n) ||
        (ts.isParameter(p) && p.name === n) ||
        (ts.isBindingElement(p) && (p.name === n || p.propertyName === n)) ||
        (ts.isVariableDeclaration(p) && p.name === n) ||
        ts.isTypeReferenceNode(p) ||
        ts.isQualifiedName(p) ||
        ts.isPropertySignature(p);
      if (!isName) used.add(n.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return [...used].filter((u) => !declared.has(u) && !GLOBALS.has(u));
}

const files = walk(SRC);
const moved = [];
const left = [];
const edits = new Map(); // file -> [{start, end, text}]
const packFiles = new Map(); // lang file path -> [{name, text}]

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  if (!/\b(en|ar|ru|EN|AR|RU|En|Ar|Ru)\b|_(EN|AR|RU)\b|\ben[A-Z]|[a-z0-9](En|Ar|Ru)\b|msgCatalogue\(/.test(text)) continue;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const mod = modName(file);
  if (SHARED_WITH_PUBLIC.has(mod)) continue;
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    const decls = st.declarationList.declarations;
    if (decls.length !== 1) continue;
    const d = decls[0];
    if (!ts.isIdentifier(d.name) || !d.initializer) continue;
    const name = d.name.text;
    let lang = langOfName(name);
    let target = null; // { node to replace, literal info, kind }
    if (lang) {
      const c = coreLiteral(d.initializer);
      if (!c) {
        if (!/packTable/.test(d.initializer.getText())) left.push(`${mod}: ${name} (not an object literal)`);
        continue;
      }
      target = { replace: d.initializer, ...c, kind: 'decl' };
    } else if (
      ts.isCallExpression(d.initializer) &&
      d.initializer.expression.getText() === 'msgCatalogue' &&
      d.initializer.arguments.length === 2
    ) {
      const c = coreLiteral(d.initializer.arguments[1]);
      if (!c) continue;
      lang = 'en';
      target = { replace: d.initializer.arguments[1], ...c, kind: 'msg' };
    } else continue;
    // a property that reads something of the module (a shell label `tab: NAV_XT.en.tab`, a formatter) stays in the module as an
    // "extra" of the live table; a spread that does is not split (the table stays in place)
    const keep = [];
    const pack = [];
    let spreadReads = null;
    for (const p of target.literal.properties) {
      const free = freeIdentifiers(p);
      if (!free.length) pack.push(p);
      else if (ts.isSpreadAssignment(p)) spreadReads = free;
      else keep.push(p);
    }
    if (spreadReads) {
      left.push(`${mod}: ${name} (spreads ${spreadReads.join(', ')})`);
      continue;
    }
    if (target.kind === 'msg' && keep.length) {
      left.push(`${mod}: ${name} (msg table reads ${keep.map((p) => freeIdentifiers(p)).flat().join(', ')})`);
      continue;
    }
    const exportName = target.kind === 'msg' ? 'en' : name;
    const packFile = path.join(LANG_DIR, lang, ...mod.split('/')) + '.ts';
    const importSpec = path.relative(path.dirname(file), packFile).split(path.sep).join('/').replace(/\.ts$/, '');
    const spec = importSpec.startsWith('.') ? importSpec : './' + importSpec;
    // always the moved literal's own type (a declared type stays on the declaration and checks it, as it checked the literal)
    const typeArg = `<typeof import('${spec}').${exportName}>`;
    const coreFrom = path.relative(path.dirname(file), path.join(SRC, 'i18n', 'lang-packs')).split(path.sep).join('/');
    const table = `packTable${typeArg}('${lang}', '${mod}', '${exportName}')`;
    const withKept = keep.length ? `withEntries(${table}, {\n  ${keep.map((p) => p.getText(sf)).join(',\n  ')},\n})` : table;
    const call = `${withKept}${target.wraps.filter((w) => w.startsWith('satisfies')).map((w) => ' ' + w).join('')}`;
    const list = edits.get(file) ?? [];
    list.push({ start: target.replace.getStart(sf), end: target.replace.getEnd(), text: call, importFrom: coreFrom.startsWith('.') ? coreFrom : './' + coreFrom });
    edits.set(file, list);
    const body = keep.length ? `{${pack.map((p) => sf.text.slice(p.getFullStart(), p.getEnd())).join(',')},\n}` : target.literal.getText(sf);
    const lit = body + (target.wraps.includes('as const') ? ' as const' : '');
    const pf = packFiles.get(packFile) ?? [];
    pf.push({ name: exportName, text: lit, mod, srcName: name });
    packFiles.set(packFile, pf);
    moved.push({ mod, name, lang, bytes: Buffer.byteLength(lit) });
  }
}

const HEADER = (mod) =>
  `// CR-I18N-LAZY-LANG-2443: language pack table of src/${mod}.ts, fetched only when the page is in this language (i18n/lang-packs.ts).\n` +
  `// Moved by scripts/i18n-split-langs.mjs; edit the texts here.\n` +
  `/* eslint-disable */\n`;

if (!DRY) {
  for (const [file, list] of edits) {
    let text = fs.readFileSync(file, 'utf8');
    for (const e of [...list].sort((a, b) => b.start - a.start)) text = text.slice(0, e.start) + e.text + text.slice(e.end);
    const names = ['packTable', ...(text.includes('withEntries(') ? ['withEntries'] : [])];
    const existing = /import \{([^}]*)\} from '[^']*lang-packs';/.exec(text);
    if (existing) {
      const have = existing[1].split(',').map((s) => s.trim()).filter(Boolean);
      const all = [...new Set([...have, ...names])];
      text = text.replace(existing[0], existing[0].replace(existing[1], ` ${all.join(', ')} `));
    } else {
      // after the last import statement at the top (or at the start)
      const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
      const imports = sf.statements.filter((s) => ts.isImportDeclaration(s));
      // at the end of the last import's LINE (a trailing comment stays with its import)
      const end = imports.length ? imports[imports.length - 1].getEnd() : 0;
      const at = end ? (text.indexOf('\n', end) < 0 ? text.length : text.indexOf('\n', end)) : 0;
      const line = `${at ? '\n' : ''}import { ${names.join(', ')} } from '${list[0].importFrom}';${at ? '' : '\n'}`;
      text = text.slice(0, at) + line + text.slice(at);
    }
    fs.writeFileSync(file, text, 'utf8');
  }
  for (const [pf, tables] of packFiles) {
    fs.mkdirSync(path.dirname(pf), { recursive: true });
    let prev = fs.existsSync(pf) ? fs.readFileSync(pf, 'utf8') : HEADER(tables[0].mod);
    for (const t of tables) {
      if (new RegExp(`export const ${t.name}\\b`).test(prev)) throw new Error(`${pf} already exports ${t.name}: merge the inline table of ${t.mod} by hand`);
      prev += `\nexport const ${t.name} = ${t.text};\n`;
    }
    fs.writeFileSync(pf, prev, 'utf8');
  }
  // the pack of each language: every file under lang/<l>/
  for (const l of LANGS) {
    const dir = path.join(LANG_DIR, l);
    const own = fs.existsSync(dir) ? walk2(dir).map((p) => path.relative(dir, p).split(path.sep).join('/').replace(/\.ts$/, '')).sort() : [];
    const lines = [
      `// CR-I18N-LAZY-LANG-2443: the ${l} language pack - generated by scripts/i18n-split-langs.mjs (do not edit by hand; re-run it).`,
      `// One chunk, fetched by i18n/lang-packs.ts only when the page is in this language. It imports nothing of the application.`,
      `import type { LangPack } from '../lang-packs';`,
    ];
    const entries = [];
    own.forEach((m, i) => {
      lines.push(`import * as t${i} from './${l}/${m}';`);
      entries.push(`  '${m}': t${i},`);
    });
    lines.push('', `export const PACK: LangPack = {`, ...entries, '};', '');
    fs.writeFileSync(path.join(LANG_DIR, `${l}.ts`), lines.join('\n'), 'utf8');
  }
}

function walk2(dir, out = []) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) walk2(p, out);
    else if (n.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const byLang = Object.fromEntries(LANGS.map((l) => [l, moved.filter((m) => m.lang === l).reduce((s, m) => s + m.bytes, 0)]));
console.log(`moved ${moved.length} tables from ${edits.size} modules; source bytes by language: ${JSON.stringify(byLang)}`);
if (left.length) console.log(`left in place (${left.length}):\n  ${left.join('\n  ')}`);
