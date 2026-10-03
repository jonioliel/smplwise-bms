/**
 * CR-023 §6 formula engine, client side: tokens <-> text <-> the server's AST (ELECTRICITY_BILLING_API.md §5), the grammar
 * check and the evaluator. Pure functions (no DOM): the formula editor, the mock store and the unit specs share them. The server
 * is the authority (POST energy/formula/check); this module gives the instant answers the editor shows while typing.
 *
 * AST (server): {m: meterId} | {n: "0.30"} | {op: '+'|'-'|'*'|'/', args: [a, b]} | {neg: node}
 * Grammar:  expr := ['-'] term (('+'|'-') term)*    term := number '*' operand | operand [('*'|'/') number] | operand
 *           operand := meter | '(' expr ')'         numbers are decimals >= 0, a percentage is a number with '%' (30% = 0.30)
 * Linear only: a meter is multiplied or divided by a constant, never by another meter.
 */
export type FormulaAst = { m: string } | { n: string } | { op: '+' | '-' | '*' | '/'; args: [FormulaAst, FormulaAst] } | { neg: FormulaAst };

export type Op = '+' | '-' | '*' | '/' | '(' | ')';
export type Tok = { t: 'm'; id: string } | { t: 'op'; v: Op } | { t: 'n'; v: string; pct: boolean };

export type IssueCode = 'empty' | 'paren_open' | 'paren_close' | 'meter_times_meter' | 'dangling' | 'missing_operand' | 'number_alone' | 'number_times_number' | 'unknown_meter' | 'bad_char' | 'bad_number' | 'unexpected' | 'divide_by_meter';
export interface Issue {
  code: IssueCode;
  message: string;
  /** token index the editor marks, or -1 */
  at: number;
}

export const ISSUE_TEXT: Record<IssueCode, string> = {
  empty: 'הנוסחה ריקה. הוסיפו לפחות מונה אחד.',
  paren_open: 'חסר סוגר. כל סוגר שנפתח צריך להיסגר.',
  paren_close: 'יש סוגר סוגר בלי סוגר פותח.',
  meter_times_meter: 'אי אפשר להכפיל מונה במונה. אפשר להכפיל מונה במספר או באחוז.',
  divide_by_meter: 'אי אפשר לחלק במונה. אפשר לחלק במספר.',
  dangling: 'הנוסחה לא הושלמה. אחרי פעולה צריך מונה.',
  missing_operand: 'חסר מונה בנוסחה.',
  number_alone: 'מספר או אחוז צריכים להיות מוכפלים במונה.',
  number_times_number: 'אי אפשר להכפיל מספר במספר. הכפילו מונה.',
  unknown_meter: 'המונה לא נמצא.',
  bad_char: 'תו לא מוכר בנוסחה.',
  bad_number: 'המספר אינו תקין.',
  unexpected: 'הנוסחה אינה תקינה.',
};

export interface ParseResult {
  ast: FormulaAst | null;
  issues: Issue[];
  warnings: string[];
  meterIds: string[];
}

const issue = (code: IssueCode, at: number, extra = ''): Issue => ({ code, at, message: ISSUE_TEXT[code] + extra });
const num = (x: number): string => String(Math.round(x * 1e6) / 1e6);

/** Checks the token list against the grammar; returns the AST when valid. */
export function parseTokens(toks: Tok[]): ParseResult {
  const issues: Issue[] = [];
  const meterIds: string[] = [];
  let i = 0;
  const peek = () => toks[i];
  const isOp = (t: Tok | undefined, v: Op) => !!t && t.t === 'op' && t.v === v;
  // parentheses balance first: one clear message beats a cascade
  let depth = 0;
  for (let k = 0; k < toks.length; k++) {
    if (isOp(toks[k], '(')) depth++;
    if (isOp(toks[k], ')')) {
      depth--;
      if (depth < 0) {
        issues.push(issue('paren_close', k));
        depth = 0;
      }
    }
  }
  if (depth > 0) issues.push(issue('paren_open', -1));
  if (toks.length === 0) return { ast: null, issues: [issue('empty', -1)], warnings: [], meterIds };

  const fail = (code: IssueCode, at: number): null => {
    if (!issues.some((x) => x.code === code)) issues.push(issue(code, at));
    return null;
  };
  const kOf = (n: { v: string; pct: boolean }): string => num(n.pct ? Number(n.v) / 100 : Number(n.v));
  const bin = (op: '+' | '-' | '*' | '/', a: FormulaAst, b: FormulaAst): FormulaAst => ({ op, args: [a, b] });

  const operand = (): FormulaAst | null => {
    const t = peek();
    if (!t) return fail('dangling', toks.length - 1);
    if (t.t === 'm') {
      i++;
      meterIds.push(t.id);
      return { m: t.id };
    }
    if (isOp(t, '(')) {
      i++;
      const e = expr();
      if (isOp(peek(), ')')) i++;
      else if (e) fail('paren_open', -1);
      return e;
    }
    if (t.t === 'n') return fail('number_alone', i);
    return fail(isOp(t, ')') ? 'missing_operand' : 'dangling', i);
  };
  const term = (): FormulaAst | null => {
    const t = peek();
    if (t?.t === 'n') {
      i++;
      if (!isOp(peek(), '*')) return fail('number_alone', i - 1);
      i++;
      if (peek()?.t === 'n') return fail('number_times_number', i);
      const o = operand();
      return o && bin('*', { n: kOf(t) }, o);
    }
    let o = operand();
    if (!o) return null;
    while (isOp(peek(), '*') || isOp(peek(), '/')) {
      const op = (peek() as { v: '*' | '/' }).v;
      i++;
      const r = peek();
      if (r?.t === 'n') {
        i++;
        o = op === '*' ? bin('*', o, { n: kOf(r) }) : bin('/', o, { n: num(Number(r.v) * (r.pct ? 0.01 : 1)) });
        continue;
      }
      if (r?.t === 'm' || isOp(r, '(')) {
        operand();
        return fail(op === '*' ? 'meter_times_meter' : 'divide_by_meter', i - 1);
      }
      return fail('dangling', i);
    }
    return o;
  };
  const expr = (): FormulaAst | null => {
    let neg = false;
    if (isOp(peek(), '-')) {
      neg = true;
      i++;
    }
    let left = term();
    if (left && neg) left = { neg: left };
    while (left && (isOp(peek(), '+') || isOp(peek(), '-'))) {
      const op = (peek() as { v: '+' | '-' }).v;
      i++;
      const right = term();
      if (!right) return null;
      left = bin(op, left, right);
    }
    return left;
  };
  const ast = expr();
  if (ast && i < toks.length && !issues.length) issues.push(issue(isOp(toks[i], ')') ? 'paren_close' : 'unexpected', i));
  const warnings: string[] = [];
  if (meterIds.some((m, idx) => meterIds.indexOf(m) !== idx)) warnings.push('המונה מופיע פעמיים בנוסחה.');
  return { ast: issues.length ? null : ast, issues, warnings, meterIds: [...new Set(meterIds)] };
}

// ------------------------------------------------------------------------------------------------ text mode

/** `[לוח סטודיו] + 30% * [תאורת לובי]`: meters in square brackets, `*` or `×` multiplies, `-` or `−` subtracts. */
export function tokensToText(toks: Tok[], nameOf: (id: string) => string): string {
  return toks
    .map((t) => (t.t === 'm' ? `[${nameOf(t.id)}]` : t.t === 'n' ? t.v + (t.pct ? '%' : '') : t.v))
    .join(' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')');
}

export function textToTokens(text: string, idOf: (name: string) => string | null): { toks: Tok[]; issues: Issue[] } {
  const toks: Tok[] = [];
  const issues: Issue[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '[') {
      const end = text.indexOf(']', i);
      if (end < 0) {
        issues.push({ code: 'unknown_meter', at: toks.length, message: 'חסר סוגר מרובע ] אחרי שם המונה.' });
        break;
      }
      const name = text.slice(i + 1, end).trim();
      const id = idOf(name);
      if (id) toks.push({ t: 'm', id });
      else issues.push({ code: 'unknown_meter', at: toks.length, message: `המונה [${name}] לא נמצא. הוסיפו אותו בשלב 1.` });
      i = end + 1;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < text.length && /[0-9.]/.test(text[j])) j++;
      const raw = text.slice(i, j);
      if (!/^\d+(\.\d+)?$/.test(raw)) issues.push({ code: 'bad_number', at: toks.length, message: ISSUE_TEXT.bad_number });
      let pct = false;
      if (text[j] === '%') {
        pct = true;
        j++;
      }
      toks.push({ t: 'n', v: raw, pct });
      i = j;
      continue;
    }
    if (c === '+') toks.push({ t: 'op', v: '+' });
    else if (c === '-' || c === '−' || c === '–') toks.push({ t: 'op', v: '-' });
    else if (c === '*' || c === '×' || c === 'x' || c === 'X') toks.push({ t: 'op', v: '*' });
    else if (c === '/' || c === '÷') toks.push({ t: 'op', v: '/' });
    else if (c === '(' || c === ')') toks.push({ t: 'op', v: c });
    else issues.push({ code: 'bad_char', at: toks.length, message: `${ISSUE_TEXT.bad_char} (${c})` });
    i++;
  }
  return { toks, issues };
}

// ------------------------------------------------------------------------------------------------ AST <-> tokens, sentence, evaluation

export function astToTokens(ast: FormulaAst): Tok[] {
  const out: Tok[] = [];
  const numTok = (k: string): Tok => {
    const x = Number(k);
    return x > 0 && x < 1 ? { t: 'n', v: num(x * 100), pct: true } : { t: 'n', v: k, pct: false };
  };
  const prec = (n: FormulaAst): number => ('op' in n ? (n.op === '+' || n.op === '-' ? 1 : 2) : 3);
  const walk = (n: FormulaAst, parentPrec: number, right: boolean) => {
    if ('m' in n) out.push({ t: 'm', id: n.m });
    else if ('n' in n) out.push(numTok(n.n));
    else if ('neg' in n) {
      out.push({ t: 'op', v: '-' });
      walk(n.neg, 3, false);
    } else {
      const p = prec(n);
      const paren = p < parentPrec || (right && p === parentPrec && p === 1);
      if (paren) out.push({ t: 'op', v: '(' });
      walk(n.args[0], p, false);
      out.push({ t: 'op', v: n.op });
      walk(n.args[1], p, true);
      if (paren) out.push({ t: 'op', v: ')' });
    }
  };
  walk(ast, 0, false);
  return out;
}

/** The readable sentence: `לוח סטודיו + 30% × תאורת לובי`. */
export function sentence(toks: Tok[], nameOf: (id: string) => string): string {
  return toks
    .map((t) => (t.t === 'm' ? nameOf(t.id) : t.t === 'n' ? t.v + (t.pct ? '%' : '') : t.v === '*' ? '×' : t.v === '-' ? '−' : t.v === '/' ? '÷' : t.v))
    .join(' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')');
}

export function evaluate(ast: FormulaAst, kwh: (id: string) => number): number {
  if ('m' in ast) return kwh(ast.m);
  if ('n' in ast) return Number(ast.n);
  if ('neg' in ast) return -evaluate(ast.neg, kwh);
  const a = evaluate(ast.args[0], kwh);
  const b = evaluate(ast.args[1], kwh);
  return ast.op === '+' ? a + b : ast.op === '-' ? a - b : ast.op === '*' ? a * b : b === 0 ? NaN : a / b;
}

export function meterIdsOf(ast: FormulaAst): string[] {
  const ids: string[] = [];
  const walk = (n: FormulaAst) => {
    if ('m' in n) ids.push(n.m);
    else if ('neg' in n) walk(n.neg);
    else if ('op' in n) n.args.forEach(walk);
  };
  walk(ast);
  return [...new Set(ids)];
}

/** d(result)/d(meter) for a linear formula: the multiplier each meter carries (1, -1, 0.3 ...). */
export function coefficients(ast: FormulaAst): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (n: FormulaAst, k: number) => {
    if ('m' in n) out[n.m] = (out[n.m] ?? 0) + k;
    else if ('neg' in n) walk(n.neg, -k);
    else if ('op' in n) {
      const [a, b] = n.args;
      if (n.op === '+') (walk(a, k), walk(b, k));
      else if (n.op === '-') (walk(a, k), walk(b, -k));
      else if (n.op === '*') ('n' in a ? walk(b, k * Number(a.n)) : walk(a, k * evaluate(b, () => 1)));
      else walk(a, k / evaluate(b, () => 1));
    }
  };
  walk(ast, 1);
  return out;
}

/** `30%`, `−`, `` for a coefficient (what the tables show in the "part" column). */
export function factorLabel(k: number): string {
  if (k === 1) return '';
  if (k === -1) return '−';
  const p = Math.round(Math.abs(k) * 10000) / 100;
  return `${k < 0 ? '−' : ''}${p}%`;
}

// ------------------------------------------------------------------------------------------------ presets

export type PresetId = 'sum' | 'mainsub' | 'pct' | 'custom';
export const PRESETS: { id: PresetId; label: string; hint: string }[] = [
  { id: 'sum', label: 'סכום', hint: 'כל המונים יחד' },
  { id: 'mainsub', label: 'ראשי פחות משנה', hint: 'מונה ראשי פחות מוני משנה' },
  { id: 'pct', label: 'חלק באחוזים', hint: 'אחוז מתוך מונה' },
  { id: 'custom', label: 'נוסחה חופשית', hint: 'מונים, פעולות ומספרים' },
];

export function presetTokens(preset: PresetId, ids: string[], opts: { main?: string; pct?: string } = {}): Tok[] {
  if (!ids.length) return [];
  const op = (v: Op): Tok => ({ t: 'op', v });
  const chain = (list: string[], o: Op): Tok[] => list.flatMap((id, i) => (i ? [op(o), { t: 'm', id } as Tok] : [{ t: 'm', id } as Tok]));
  if (preset === 'mainsub') {
    const main = opts.main && ids.includes(opts.main) ? opts.main : ids[0];
    return [{ t: 'm', id: main }, ...ids.filter((x) => x !== main).flatMap((id) => [op('-'), { t: 'm', id } as Tok])];
  }
  if (preset === 'pct') return [{ t: 'n', v: opts.pct ?? '30', pct: true }, op('*'), { t: 'm', id: ids[0] }];
  return chain(ids, '+');
}

/** Which preset the tokens still are (the preset card stays lit while the formula is exactly its output). */
export function detectPreset(toks: Tok[], ids: string[]): PresetId {
  const same = (a: Tok[], b: Tok[]) => JSON.stringify(a) === JSON.stringify(b);
  if (same(toks, presetTokens('sum', ids))) return 'sum';
  const first = toks[0];
  if (first?.t === 'm' && ids.length > 1 && same(toks, presetTokens('mainsub', ids, { main: first.id }))) return 'mainsub';
  return 'custom';
}
