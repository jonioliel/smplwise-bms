import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// CR-HA-WORDING-2443 (code review 06:HA-1, 08:F26; MASTER_PLAN row CR-HA-WORDING, owner decision O8 = round 32 Q-DES-10 "c"):
// the owner's rule is that the interface never names the host platform ("Home Assistant" / "HA"); the settings screens may keep
// the name, because there it is one data source the installer has to find (Q-DES-10). This guard reads every string and
// template text of src/ with the compiler (comments never count, nor `css` templates and comments inside a template) and fails
// on either word outside the settings area. What may keep the name outside a settings screen is listed below with the reason,
// and each listed reader must itself be read by settings screens only - so an operator screen that starts showing one of
// these texts fails here too. An allow-list entry that no longer matches a text fails, so the list only shrinks.
// "Companion" (the platform's phone app, a notification channel name) is not one of the two words and is not checked here.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src');

/** The platform's name as a text shows it ("Home Assistant", "Home-Assistant"), or the abbreviation as a word of its own. Both
 * case-sensitive: `homeassistant` (the auth provider type), `<home-assistant>`, `ha.` and `?tab=ha` are identifiers, not text. */
const NAME = /Home[\s -]*Assistant/;
const ABBR = /\bHA\b/;
const brandIn = (s: string): boolean => NAME.test(s) || ABBR.test(s);

/** The settings area: the screens of Settings (src/screens/system-*.ts) and their two source-text tables. */
const isSettings = (rel: string): boolean => /^screens\/system-[a-z0-9-]+\.ts$/.test(rel) || /^i18n\/msg\/system-[ab]\.ts$/.test(rel);

interface Allowed {
  file: string;
  why: string;
  /** A found text is allowed when it contains one of these fragments (`exact`: when it IS one). Each must still match a text. */
  texts: string[];
  exact?: boolean;
  /** The names (exports or table keys) that carry these texts out of the file: every other file naming one must be a settings file. */
  readers: string[];
}

const ALLOWED: Allowed[] = [
  {
    file: 'i18n/local-identity.ts',
    why: 'the local users and service identity tabs of Settings (the file\'s header says so)',
    texts: ['Home Assistant'],
    readers: ['tabSub', 'haBadge', 'suggestAlso', 'siTitle', 'siSub', 'siUserId', 'siRemote', 'siPolicyRisk'],
  },
  {
    file: 'api/access.ts',
    why: 'the directory sync and audit action labels of Settings › Access',
    texts: ['נמחק ב־HA', 'בספריית HA', 'הושבת (HA)', 'הופעל (HA)'],
    readers: ['SYNC_LABEL', 'ACTION_LABEL'],
  },
  {
    file: 'i18n/msg/api-devices.ts',
    why: 'the source-text table (Hebrew -> English) of the api/access.ts labels above, read through tr() by text, not by name',
    texts: ['נמחק ב־HA', 'deleted in HA', 'בספריית HA', 'HA directory', 'הושבת (HA)', 'disabled (HA)', 'הופעל (HA)', 'enabled (HA)'],
    readers: [],
  },
  {
    file: 'api/setup.ts',
    why: 'the demo answers of the setup wizard (Settings › setup): the step that connects the platform',
    texts: ['Home Assistant', 'HA'],
    readers: ['demoSetupState'],
  },
  {
    file: 'fixtures/catalog.ts',
    why: 'demo roles and demo audit rows of Settings › Access / Audit',
    texts: ['ניהול HA', 'HA אישר', 'HA bridge'],
    readers: ['demoRoles', 'demoAudit'],
  },
  {
    file: 'fixtures/catalog.ts',
    why: 'the demo event\'s source code (`source: \'HA\'`): investigate-events shows it as "מערכת הבית" (checked below)',
    texts: ['HA'],
    exact: true,
    readers: [],
  },
];
const allowedFor = (file: string, text: string): { entry: Allowed; frag: string } | null => {
  for (const entry of ALLOWED) {
    if (entry.file !== file) continue;
    const frag = entry.texts.find((t) => (entry.exact ? text === t : text.includes(t)));
    if (frag) return { entry, frag };
  }
  return null;
};

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}
const rel = (p: string): string => path.relative(SRC, p).split(path.sep).join('/');
const FILES = walk(SRC).map((p) => ({ rel: rel(p), source: readFileSync(p, 'utf8') }));
/** CR-I18N-LAZY-LANG-2443 (merged in RELEASE-2439-TRAIN): a language pack file `i18n/lang/<lang>/<module>` holds that module's
 * own table, so it is judged as the module (settings area, allow-list) and is not a "reader" of the module's names. */
const modOf = (rel: string): string => rel.replace(/^i18n\/lang\/(?:en|ar|ru)\//, '');

const isTextNode = (n: ts.Node): n is ts.LiteralLikeNode =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || n.kind === ts.SyntaxKind.TemplateHead || n.kind === ts.SyntaxKind.TemplateMiddle || n.kind === ts.SyntaxKind.TemplateTail;

/** The template a text belongs to is a `css` one (style text, its comments included, is never shown). */
function inCssTemplate(n: ts.Node): boolean {
  let p: ts.Node | undefined = n.parent;
  while (p && !ts.isTaggedTemplateExpression(p) && !ts.isSourceFile(p)) p = p.parent;
  return !!p && ts.isTaggedTemplateExpression(p) && ts.isIdentifier(p.tag) && p.tag.text === 'css';
}

/** Every string / template text of a source that names the platform, comments inside a template removed. */
function brandTexts(name: string, source: string): { line: number; text: string }[] {
  if (!brandIn(source)) return [];
  const sf = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
  const out: { line: number; text: string }[] = [];
  const visit = (n: ts.Node): void => {
    if (isTextNode(n) && !inCssTemplate(n)) {
      const text = n.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
      if (brandIn(text)) out.push({ line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, text });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** Source without comments, for the reader search. */
const code = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

test('no "Home Assistant" / "HA" in a text outside the settings area, except the listed ones', () => {
  const extra: string[] = [];
  const unused = new Set(ALLOWED.flatMap((e) => e.texts.map((t) => `${e.file}${e.exact ? ' =' : ':'} ${t}`)));
  for (const { rel: file, source } of FILES) {
    const f = modOf(file);
    if (isSettings(f)) continue;
    for (const hit of brandTexts(file, source)) {
      const ok = allowedFor(f, hit.text);
      if (ok) unused.delete(`${f}${ok.entry.exact ? ' =' : ':'} ${ok.frag}`);
      else extra.push(`${file}:${hit.line}: ${hit.text.slice(0, 90)}`);
    }
  }
  expect(extra, 'say it in the product\'s own words (for example "תשתית המערכת", "גשר Arx", "the sign-in service")').toEqual([]);
  expect([...unused], 'an allow-list fragment that matches no text any more: remove it').toEqual([]);
});

test('the texts allowed outside the settings area are read by settings screens only', () => {
  const wrong: string[] = [];
  for (const a of ALLOWED) {
    for (const name of a.readers) {
      const word = new RegExp(`\\b${name}\\b`);
      const readers = FILES.filter((x) => modOf(x.rel) !== a.file && word.test(code(x.source))).map((x) => x.rel);
      expect(readers.length, `${a.file} ${name} has a reader`).toBeGreaterThan(0);
      for (const r of readers) if (!isSettings(r)) wrong.push(`${a.file} ${name} <- ${r}`);
    }
  }
  expect(wrong).toEqual([]);
  // the demo events' source code is never shown as written: the events screen words it
  expect(FILES.find((x) => x.rel === 'screens/investigate-events.ts')!.source).toContain("HA: tr('מערכת הבית')");
});

test('the guard finds the platform name where it is written (self-check)', () => {
  expect(brandTexts('x.ts', "const a = 'מחובר ל־Home Assistant';").length).toBe(1);
  expect(brandTexts('x.ts', 'const a = `משתמש HA ${n}`;').length).toBe(1);
  expect(brandTexts('x.ts', "const a = 'פתחו את Home-Assistant';").length).toBe(1);
  expect(brandTexts('x.ts', "// Home Assistant\nconst a = 'ha.'; const b = '?tab=ha'; const c = 'homeassistant'; const d = 'home-assistant';").length).toBe(0);
  expect(brandTexts('x.ts', 'const s = css`/* HA entity card */ .x { color: red; }`;').length).toBe(0);
  expect(brandTexts('x.ts', 'const h = html`<!-- HA --><b>שלום</b>`;').length).toBe(0);
  expect(isSettings('screens/system-diagnostics.ts')).toBe(true);
  expect(isSettings('screens/live-wall.ts')).toBe(false);
});

test('the sign-in console note names the sign-in service, not the platform (review 08:F26)', () => {
  const auth = FILES.find((x) => x.rel === 'arx/auth.ts')!.source;
  expect(auth).toContain('Arx: the sign-in service refused PKCE on /auth/login_flow');
  expect(brandTexts('arx/auth.ts', auth)).toEqual([]);
});
