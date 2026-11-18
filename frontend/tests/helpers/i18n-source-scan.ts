// CR-I18N-CAL-ELEC-2441: a source reader for the i18n specs of the area rows (calendars, electricity; reusable by home, map and
// plan wizard). It parses a TypeScript source with the compiler (comments never count) and answers two questions:
//   - which Hebrew string / template texts are NOT the first argument of `tr(...)` (the lint spec);
//   - which texts ARE passed to `tr(...)`, and which `tr(...)` calls do not pass a plain literal (the completeness spec).
import ts from 'typescript';

const HEBREW = /[֐-׿]/;

export interface FoundLiteral {
  line: number;
  /** The literal's text, white space collapsed (a template is reported one static part at a time). */
  text: string;
}

export interface TrCalls {
  /** The plain literals passed as the first argument of `tr(...)`. */
  keys: string[];
  /** `tr(...)` calls whose first argument is not a plain literal (a variable, a template with `${}`): `line: source`. */
  notLiteral: string[];
}

/** The translator's name in a module. A module that reads a second table imports it under an alias (`tr as trTime`, CR-I18N-COMBINED-B-2442)
 * and the spec names the alias. */
const TR: readonly string[] = ['tr'];
const parse = (name: string, source: string): ts.SourceFile => ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
const lineOf = (sf: ts.SourceFile, n: ts.Node): number => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
const isTrCall = (n: ts.Node, names: readonly string[] = TR): n is ts.CallExpression =>
  ts.isCallExpression(n) && ts.isIdentifier(n.expression) && names.includes(n.expression.text);
const isTextNode = (n: ts.Node): n is ts.LiteralLikeNode =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || n.kind === ts.SyntaxKind.TemplateHead || n.kind === ts.SyntaxKind.TemplateMiddle || n.kind === ts.SyntaxKind.TemplateTail;

/** Every string or template text with a Hebrew letter that is not the first argument of `tr(...)` (or of another translator in `names`). */
export function hebrewOutsideTr(name: string, source: string, names: readonly string[] = TR): FoundLiteral[] {
  const sf = parse(name, source);
  const out: FoundLiteral[] = [];
  const visit = (n: ts.Node): void => {
    if (isTextNode(n) && HEBREW.test(n.text)) {
      const p = n.parent;
      if (!(isTrCall(p, names) && (p.arguments[0] as ts.Node | undefined) === n)) out.push({ line: lineOf(sf, n), text: n.text.replace(/\s+/g, ' ').trim() });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** The `tr(...)` calls of a source (`names`: the calls of another translator, e.g. `['trTime']`). */
export function trCalls(name: string, source: string, names: readonly string[] = TR): TrCalls {
  const sf = parse(name, source);
  const keys: string[] = [];
  const notLiteral: string[] = [];
  const visit = (n: ts.Node): void => {
    if (isTrCall(n, names)) {
      const a = n.arguments[0];
      if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))) keys.push(a.text);
      else notLiteral.push(`${lineOf(sf, n)}: ${n.getText().slice(0, 80)}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { keys, notLiteral };
}

/** The module a source imports `tr` from (`import { tr } from '../i18n/msg/<module>'`), or null. An aliased import (`tr as trTime`) is
 * another translator, not the module's own. */
export function trModule(source: string): string | null {
  return /import\s*\{(?:[^}]*,)?\s*tr\s*(?:,[^}]*)?\}\s*from\s*'[./]+\/i18n\/(msg\/[\w-]+)'/.exec(source)?.[1] ?? null;
}

export const hasHebrew = (s: string): boolean => HEBREW.test(s);
