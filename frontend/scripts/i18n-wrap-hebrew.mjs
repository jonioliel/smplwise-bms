#!/usr/bin/env node
// I18N-EN-2490 (owner O5): moves the Hebrew interface text still written into a module's sources into `tr()` of a source-text
// table (src/i18n/msg.ts: the Hebrew text is the key, the English sits in the English language pack). Mechanical, so a
// Hebrew page renders exactly as before; the English of every new key is written by hand afterwards
// (src/i18n/lang/en/i18n/msg/<table>.ts) - the missing-keys report (scripts/i18n_missing_keys.mjs) lists what is left.
//
// What it rewrites (TypeScript AST with the type checker):
//   - 'Hebrew' / `Hebrew`                       -> tr('Hebrew')
//   - `... ${a} Hebrew ${b.c} ...`              -> tr('... {a} Hebrew {c} ...', { a, c: b.c })   (values become placeholders)
//   - html`<b>Hebrew ${n} text</b>`             -> html`<b>${tr('Hebrew {n} text', { n })}</b>` when every value of that text
//                                                  node is a plain string / number (a template or a node is never glued in;
//                                                  the Hebrew around it is wrapped piece by piece instead)
//   - html`<x title="Hebrew ${n}">`             -> html`<x title=${tr('Hebrew {n}', { n })}>`
// What it leaves (listed with the reason in --report): css`` templates, HTML comments, data attributes (value, id, class,
// data-*, ...), object keys, comparisons and `case` labels, arguments of string-matching methods (includes, startsWith,
// split, replace, test ...), literal types, enum members, `{ he, en }` bilingual objects and `lang ? en : he` ternaries,
// declarations named demo / mock / fixture / sample / keyword / pattern / regex, console calls, text that already carries a
// `{name}` placeholder, and every literal the caller excludes with --skip-owner <declaration name>.
//
// Usage (from frontend/):
//   node scripts/i18n-wrap-hebrew.mjs --table <msg table> [--dry] [--report out.json] [--skip-owner NAME ...] <src files...>
// A file that already imports a translator from src/i18n/msg/<x> keeps it (and its table); otherwise
// `import { tr } from '<rel>/i18n/msg/<table>'` is added (as `trMsg` when the module declares its own `tr`).
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const FRONTEND = path.join(HERE, '..');
const SRC = path.join(FRONTEND, 'src');
const ts = createRequire(path.join(FRONTEND, 'package.json'))('typescript');

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const TABLE = opt('--table');
const DRY = args.includes('--dry');
const REPORT = opt('--report');
const SKIP_OWNERS = new Set();
for (let i = 0; i < args.length; i++) if (args[i] === '--skip-owner') SKIP_OWNERS.add(args[i + 1]);
const FILES = [];
for (let i = 0; i < args.length; i++) {
  if (['--table', '--report', '--skip-owner'].includes(args[i])) i++;
  else if (!args[i].startsWith('--')) FILES.push(path.resolve(args[i]));
}
if (!FILES.length) {
  console.error('usage: node scripts/i18n-wrap-hebrew.mjs --table <msg table> [--dry] [--report out.json] <files...>');
  process.exit(2);
}

const HEB_LETTER = /[א-ת]/;
const PLACEHOLDER = /\{\w+\}/;
const SKIP_METHODS = new Set([
  'includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf', 'replace', 'replaceAll', 'split', 'test', 'match', 'matchAll',
  'search', 'localeCompare', 'has', 'get', 'set', 'delete', 'add', 'querySelector', 'querySelectorAll', 'closest', 'getAttribute',
  'setAttribute', 'setItem', 'getItem', 'removeItem', 'postMessage', 'padStart', 'padEnd', 'join', 'exec', 'trim',
]);
const SKIP_FUNCTIONS = new Set(['RegExp', 'Symbol', 'require', 'post', 'patch', 'put', 'del', 'fetch', 'apiPost', 'apiPatch', 'apiPut', 'apiDelete']);
const SKIP_PROPS = /^(id|key|code|kind|type|value|slug|icon|cls|class|className|href|route|path|field|entity_id|he|nameHe|labelHe|titleHe|textHe|name_he|he_name|label_he|title_he|heName|match|matches|pattern|regex|re|keywords|words|aliases|search|query|lang|locale|dir|tag|tags|unitKey|storageKey|event|selector|format)$/;
const SKIP_OWNER_RE = /([Dd]emo|DEMO|[Mm]ock|MOCK|[Ff]ixture|FIXTURE|[Ss]ample|SAMPLE|[Kk]eyword|KEYWORD|[Rr]egex|REGEX|[Pp]attern|PATTERN|^re[A-Z_]|_RE$|WORDS$|Words$|^words$|ALIASES|aliases|MATCH|Match$)/;
const SKIP_ATTRS = /^(value|id|class|style|slot|name|part|for|href|src|type|key|role|lang|dir|pattern|accept|autocomplete|inputmode|tabindex|data-.*|@.*|\?.*)$/;

const configPath = path.join(FRONTEND, 'tsconfig.json');
const config = ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, FRONTEND);
const program = ts.createProgram(FILES, { ...config.options, noEmit: true });
const checker = program.getTypeChecker();

const report = { added: [], skipped: [], files: [] };

const isHebrew = (s) => HEB_LETTER.test(s);
const jsQuote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}'`;
const cookRaw = (raw) => (raw.includes('\\') ? new Function(`return \`${raw}\`;`)() : raw);
const propName = (n) => (n && (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isPrivateIdentifier(n)) ? n.text : '');

function typeParts(t) {
  return t.isUnion() ? t.types : [t];
}
/** A value lit renders as its String(): string, number, boolean, bigint, and enum / literal forms of them. */
function isPlainForHtml(expr) {
  const F = ts.TypeFlags;
  return typeParts(checker.getTypeAtLocation(expr)).every((p) => p.flags & (F.StringLike | F.NumberLike | F.BooleanLike | F.BigIntLike | F.EnumLike));
}
function isStringOrNumber(expr) {
  const F = ts.TypeFlags;
  return typeParts(checker.getTypeAtLocation(expr)).every((p) => p.flags & (F.StringLike | F.NumberLike));
}

for (const file of FILES) {
  const sf = program.getSourceFile(file);
  if (!sf) {
    console.error(`not in the program: ${file}`);
    continue;
  }
  const text = sf.getFullText();
  const rel = path.relative(SRC, file).split(path.sep).join('/');
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;

  // ---- the translator of the file
  let trName = null;
  let tableOfFile = null;
  const trNames = new Set();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const m = /(?:^|\/)i18n\/msg\/([\w-]+)$/.exec(st.moduleSpecifier.text);
    const named = st.importClause?.namedBindings;
    if (m && named && ts.isNamedImports(named)) {
      for (const el of named.elements) {
        if ((el.propertyName ?? el.name).text === 'tr') {
          trNames.add(el.name.text);
          if (!trName && (!TABLE || m[1] === TABLE)) {
            trName = el.name.text;
            tableOfFile = m[1];
          }
        }
      }
    }
  }
  let addImport = false;
  if (!trName) {
    if (!TABLE) {
      console.error(`${rel}: no msg table imported and no --table given; skipped`);
      continue;
    }
    const declared = new Set();
    const collect = (n) => {
      if ((ts.isVariableDeclaration(n) || ts.isFunctionDeclaration(n) || ts.isParameter(n) || ts.isImportSpecifier(n)) && n.name && ts.isIdentifier(n.name)) declared.add(n.name.text);
      ts.forEachChild(n, collect);
    };
    collect(sf);
    trName = declared.has('tr') ? 'trMsg' : 'tr';
    if (declared.has(trName)) throw new Error(`${rel}: both tr and trMsg are declared`);
    tableOfFile = TABLE;
    addImport = true;
  }
  trNames.add(trName);

  // ---- edits: { start, end, build() } ; builders render nested ranges through renderRange
  const edits = [];
  const keys = [];
  const skip = (node, reason, s = node.getText(sf)) => report.skipped.push({ file: rel, line: lineOf(node.getStart(sf)), reason, text: s.slice(0, 100) });

  function renderRange(start, end) {
    const inner = edits.filter((e) => e.start >= start && e.end <= end).sort((a, b) => a.start - b.start || b.end - a.end);
    let out = '';
    let at = start;
    for (const e of inner) {
      if (e.start < at) continue; // nested in an earlier edit: that edit renders it
      out += text.slice(at, e.start) + e.build();
      at = e.end;
    }
    return out + text.slice(at, end);
  }
  const exprText = (expr) => renderRange(expr.getStart(sf), expr.getEnd());

  /** Placeholder names for the values of one text. */
  function namer() {
    const byText = new Map();
    const used = new Set();
    return (expr) => {
      const t = expr.getText(sf);
      if (byText.has(t)) return byText.get(t);
      let base = 'v';
      let e = expr;
      while (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) e = e.expression;
      if (ts.isIdentifier(e)) base = e.text;
      else if (ts.isPropertyAccessExpression(e)) {
        base = e.name.text;
        if (base === 'length' || base === 'size') {
          const inner = e.expression;
          const n = ts.isIdentifier(inner) ? inner.text : ts.isPropertyAccessExpression(inner) ? inner.name.text : '';
          base = n ? `${n}Count` : 'n';
        }
      } else if (ts.isCallExpression(e)) {
        const c = e.expression;
        base = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : 'v';
        if (/^(toFixed|toString|toLocaleString|round|floor|ceil|String|Number|max|min|abs)$/.test(base)) {
          const a = ts.isPropertyAccessExpression(c) && /^(toFixed|toString|toLocaleString)$/.test(base) ? c.expression : e.arguments[0];
          base = a && ts.isIdentifier(a) ? a.text : a && ts.isPropertyAccessExpression(a) ? a.name.text : 'v';
        }
      }
      base = base.replace(/\W/g, '') || 'v';
      let name = base;
      for (let i = 2; used.has(name); i++) name = `${base}${i}`;
      used.add(name);
      byText.set(t, name);
      return name;
    };
  }
  /** `tr('key', { a, b: x.y })` from parts: strings and expressions. */
  function trCall(parts, forHtml) {
    const name = namer();
    let key = '';
    const vars = [];
    const seen = new Set();
    for (const p of parts) {
      if (typeof p === 'string') key += p;
      else {
        const n = name(p);
        key += `{${n}}`;
        if (seen.has(n)) continue;
        seen.add(n);
        const v = exprText(p);
        const value = forHtml || isStringOrNumber(p) ? v : `String(${v})`;
        vars.push(value === n ? n : `${n}: ${value}`);
      }
    }
    keys.push(key);
    return `${trName}(${jsQuote(key)}${vars.length ? `, { ${vars.join(', ')} }` : ''})`;
  }

  // ---- context rules for a plain string / template
  function skipReason(node) {
    let n = node;
    let p = node.parent;
    while (p && (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isSatisfiesExpression?.(p))) {
      n = p;
      p = p.parent;
    }
    if (!p) return 'top';
    if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
      const c = p.expression;
      if (ts.isIdentifier(c) && trNames.has(c.text)) return 'in-tr';
      if (ts.isIdentifier(c) && /^(tr|t)([A-Z]\w*)?$/.test(c.text) && p.arguments?.[0] === n) return `in-${c.text}`;
      if (ts.isIdentifier(c) && SKIP_FUNCTIONS.has(c.text)) return `call-${c.text}`;
      if (ts.isPropertyAccessExpression(c)) {
        if (SKIP_METHODS.has(c.name.text)) return `method-${c.name.text}`;
        if (ts.isIdentifier(c.expression) && c.expression.text === 'console') return 'console';
      }
    }
    if (ts.isPropertyAssignment(p) && p.name === n) return 'key';
    if (ts.isPropertyAssignment(p) && p.initializer === n) {
      const k = propName(p.name);
      if (SKIP_PROPS.test(k)) return `prop-${k}`;
      const obj = p.parent;
      if (ts.isObjectLiteralExpression(obj) && obj.properties.some((q) => q.name && /^(en|nameEn|labelEn|titleEn|textEn|name_en|en_name|label_en)$/.test(propName(q.name)))) return 'bilingual-object';
    }
    if (ts.isElementAccessExpression(p)) return 'index';
    if (ts.isLiteralTypeNode(p)) return 'type';
    if (ts.isCaseClause(p)) return 'case';
    if (ts.isEnumMember(p)) return 'enum';
    if (ts.isComputedPropertyName(p)) return 'key';
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p) || ts.isImportTypeNode?.(p)) return 'import';
    if (ts.isBinaryExpression(p)) {
      const k = p.operatorToken.kind;
      const K = ts.SyntaxKind;
      if ([K.EqualsEqualsEqualsToken, K.ExclamationEqualsEqualsToken, K.EqualsEqualsToken, K.ExclamationEqualsToken, K.InKeyword].includes(k)) return 'compare';
    }
    if (ts.isConditionalExpression(p) && /\blang\b|Lang\b|isEn|\ben\b|'he'|"he"|uiLang|docLang/.test(p.condition.getText(sf))) return 'bilingual-ternary';
    for (let q = p; q; q = q.parent) {
      const nm = (ts.isVariableDeclaration(q) || ts.isFunctionDeclaration(q) || ts.isMethodDeclaration(q) || ts.isPropertyDeclaration(q) || ts.isPropertyAssignment(q) || ts.isGetAccessorDeclaration(q)) && q.name ? propName(q.name) : '';
      if (nm && (SKIP_OWNERS.has(nm) || SKIP_OWNER_RE.test(nm))) return `owner-${nm}`;
      if (ts.isTaggedTemplateExpression(q) && ts.isIdentifier(q.tag) && /^(css|unsafeCSS)$/.test(q.tag.text)) return 'css';
    }
    return null;
  }

  function wrapString(node) {
    if (!isHebrew(node.text)) return;
    if (PLACEHOLDER.test(node.text)) return skip(node, 'has-placeholder');
    const why = skipReason(node);
    if (why) return skip(node, why);
    const start = node.getStart(sf);
    const end = node.getEnd();
    const lit = ts.isStringLiteral(node) ? node.getText(sf) : jsQuote(node.text);
    keys.push(node.text);
    edits.push({ start, end, build: () => `${trName}(${lit})` });
  }

  function wrapTemplate(node) {
    const pieces = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
    if (!pieces.some(isHebrew)) return;
    if (pieces.some((s) => PLACEHOLDER.test(s))) return skip(node, 'has-placeholder');
    const why = skipReason(node);
    if (why) return skip(node, why);
    const parts = [node.head.text];
    for (const s of node.templateSpans) parts.push(s.expression, s.literal.text);
    edits.push({ start: node.getStart(sf), end: node.getEnd(), build: () => trCall(parts.filter((x) => x !== ''), false) });
  }

  // ---- html`` / svg``
  function htmlTemplate(tpl) {
    // a stream of items: { ch, pos } for each raw character, { expr, start, end } for each ${...}
    const items = [];
    const pushRaw = (from, to) => {
      for (let i = from; i < to; i++) items.push({ ch: text[i], pos: i });
    };
    if (ts.isNoSubstitutionTemplateLiteral(tpl)) pushRaw(tpl.getStart(sf) + 1, tpl.getEnd() - 1);
    else {
      pushRaw(tpl.head.getStart(sf) + 1, tpl.head.getEnd() - 2);
      for (const s of tpl.templateSpans) {
        const lit = s.literal;
        items.push({ expr: s.expression, start: s.expression.getFullStart() - 2, end: lit.getStart(sf) + 1 });
        pushRaw(lit.getStart(sf) + 1, lit.getEnd() - (ts.isTemplateTail(lit) ? 1 : 2));
      }
    }
    const at = (i) => items[i]?.ch ?? '';
    const startsWith = (i, s) => [...s].every((c, k) => at(i + k).toLowerCase() === c);
    let i = 0;
    const textRun = [];
    const flushText = () => {
      if (textRun.length) handleText(textRun.splice(0));
    };
    while (i < items.length) {
      const it = items[i];
      if (it.expr) {
        textRun.push(it);
        i++;
        continue;
      }
      if (it.ch === '<' && startsWith(i, '<!--')) {
        flushText();
        i += 4;
        while (i < items.length && !startsWith(i, '-->')) i++;
        i += 3;
        continue;
      }
      if (it.ch === '<' && /[a-zA-Z/]/.test(at(i + 1))) {
        flushText();
        // a tag: read the name, then attributes until '>'
        i++;
        let tag = '';
        while (i < items.length && /[\w\-/]/.test(at(i))) tag += at(i++);
        let attr = '';
        while (i < items.length && at(i) !== '>') {
          const c = items[i];
          if (c.expr) {
            attr = '';
            i++;
            continue;
          }
          if (/[\s/]/.test(c.ch)) {
            i++;
            continue;
          }
          if (c.ch === '=') {
            i++;
            const q = at(i);
            if (q === '"' || q === "'") {
              const open = i;
              i++;
              const value = [];
              while (i < items.length && at(i) !== q) value.push(items[i++]);
              handleAttr(attr, value, items[open].pos, items[i]?.pos);
              i++;
            } else if (i < items.length && items[i].expr) i++;
            else while (i < items.length && !/[\s>]/.test(at(i)) && !items[i].expr) i++;
            attr = '';
            continue;
          }
          // attribute name
          attr = '';
          while (i < items.length && !items[i].expr && !/[\s=>/]/.test(at(i))) attr += at(i++);
        }
        i++; // '>'
        if (/^(style|script)$/i.test(tag)) {
          while (i < items.length && !startsWith(i, `</${tag.toLowerCase()}`)) i++;
        }
        continue;
      }
      textRun.push(it);
      i++;
    }
    flushText();
  }

  /** A text node's items: wrap the Hebrew. */
  function handleText(run) {
    if (!run.some((x) => x.ch && HEB_LETTER.test(x.ch))) return;
    // barriers: values that are not plain text, and HTML entities
    const segs = [];
    let cur = [];
    for (let k = 0; k < run.length; k++) {
      const x = run[k];
      if (x.expr && !isPlainForHtml(x.expr)) {
        segs.push(cur);
        cur = [];
        continue;
      }
      if (x.ch === '&') {
        let j = k + 1;
        let ent = '&';
        while (j < run.length && run[j].ch && /[#\w]/.test(run[j].ch)) ent += run[j++].ch;
        if (run[j]?.ch === ';' && ent.length > 1) {
          segs.push(cur);
          cur = [];
          k = j;
          continue;
        }
      }
      cur.push(x);
    }
    segs.push(cur);
    for (const seg of segs) {
      if (!seg.some((x) => x.ch && HEB_LETTER.test(x.ch))) continue;
      let a = 0;
      let b = seg.length - 1;
      while (a <= b && seg[a].ch !== undefined && /\s/.test(seg[a].ch)) a++;
      while (b >= a && seg[b].ch !== undefined && /\s/.test(seg[b].ch)) b--;
      const core = seg.slice(a, b + 1);
      // the text of a run: raw characters (cooked), whitespace collapsed
      const parts = [];
      let raw = '';
      const flushRaw = () => {
        if (raw) parts.push(cookRaw(raw).replace(/\s+/g, ' '));
        raw = '';
      };
      for (const x of core) {
        if (x.expr) {
          flushRaw();
          parts.push(x.expr);
        } else raw += x.ch;
      }
      flushRaw();
      if (parts.some((p) => typeof p === 'string' && PLACEHOLDER.test(p))) {
        report.skipped.push({ file: rel, line: lineOf(core[0].pos ?? core[0].start), reason: 'has-placeholder', text: parts.filter((p) => typeof p === 'string').join('…').slice(0, 100) });
        continue;
      }
      const start = core[0].expr ? core[0].start : core[0].pos;
      const last = core[core.length - 1];
      const end = last.expr ? last.end : last.pos + 1;
      edits.push({ start, end, build: () => `\${${trCall(parts, true)}}` });
    }
  }

  function handleAttr(name, value, openPos, closePos) {
    if (!value.some((x) => x.ch && HEB_LETTER.test(x.ch))) return;
    const line = lineOf(openPos);
    const shown = value.map((x) => x.ch ?? '${…}').join('').slice(0, 100);
    if (SKIP_ATTRS.test(name)) return report.skipped.push({ file: rel, line, reason: `attr-${name}`, text: shown });
    if (value.some((x) => x.expr && !isPlainForHtml(x.expr)) || value.some((x) => x.ch === '&')) return report.skipped.push({ file: rel, line, reason: 'attr-mixed', text: shown });
    const parts = [];
    let raw = '';
    for (const x of value) {
      if (x.expr) {
        if (raw) parts.push(cookRaw(raw));
        raw = '';
        parts.push(x.expr);
      } else raw += x.ch;
    }
    if (raw) parts.push(cookRaw(raw));
    if (parts.some((p) => typeof p === 'string' && PLACEHOLDER.test(p))) return report.skipped.push({ file: rel, line, reason: 'has-placeholder', text: shown });
    edits.push({ start: openPos, end: closePos + 1, build: () => `\${${trCall(parts, true)}}` });
  }

  const visit = (node) => {
    if (ts.isTaggedTemplateExpression(node)) {
      const tag = ts.isIdentifier(node.tag) ? node.tag.text : ts.isPropertyAccessExpression(node.tag) ? node.tag.name.text : '';
      if (/^(css|unsafeCSS)$/.test(tag)) return; // styles: comments and font names only
      if (/^(html|svg|shtml|staticHtml)$/.test(tag)) {
        const why = skipReason(node);
        if (why && /^owner-/.test(why)) return;
        htmlTemplate(node.template);
        if (ts.isTemplateExpression(node.template)) for (const s of node.template.templateSpans) visit(s.expression);
        return;
      }
    }
    if (ts.isStringLiteral(node) || (ts.isNoSubstitutionTemplateLiteral(node) && !ts.isTaggedTemplateExpression(node.parent))) wrapString(node);
    else if (ts.isTemplateExpression(node) && !ts.isTaggedTemplateExpression(node.parent)) {
      wrapTemplate(node);
      for (const s of node.templateSpans) visit(s.expression);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (!edits.length) {
    report.files.push({ file: rel, table: tableOfFile, edits: 0 });
    continue;
  }
  let out = renderRange(0, text.length);
  if (addImport) {
    const imports = sf.statements.filter((s) => ts.isImportDeclaration(s));
    const relImport = path.relative(path.dirname(file), path.join(SRC, 'i18n', 'msg', tableOfFile)).split(path.sep).join('/');
    const spec = relImport.startsWith('.') ? relImport : `./${relImport}`;
    const line = `import { ${trName === 'tr' ? 'tr' : `tr as ${trName}`} } from '${spec}';\n`;
    // a line of its own after the last import (and after a comment that ends that import's line)
    const lastEnd = imports.length ? imports[imports.length - 1].getEnd() : 0;
    const eol = text.indexOf('\n', lastEnd);
    const pos = imports.length ? (eol < 0 ? text.length : eol + 1) : 0;
    const before = renderRange(0, pos);
    out = `${before}${line}${out.slice(before.length)}`;
  }
  for (const k of keys) report.added.push({ file: rel, table: tableOfFile, key: k });
  report.files.push({ file: rel, table: tableOfFile, edits: edits.length });
  if (!DRY) fs.writeFileSync(file, out, 'utf8');
  console.log(`${rel}: ${edits.length} edits (${tableOfFile}${addImport ? ', import added' : ''})`);
}

if (REPORT) fs.writeFileSync(REPORT, JSON.stringify(report, null, 1) + '\n', 'utf8');
console.log(`keys: ${report.added.length}, skipped: ${report.skipped.length}`);
