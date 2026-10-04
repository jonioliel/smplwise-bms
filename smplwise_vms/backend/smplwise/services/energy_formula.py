"""CR-023 P2 / owner decision D1: the account formula - a free, SAFE expression over meters.

Grammar (hand-written recursive descent; nothing is ever passed to eval):
    expr    := term (('+' | '-') term)*
    term    := unary (('*' | '/') unary)*
    unary   := '-' unary | primary
    primary := number ['%'] | '[' meter ']' | '(' expr ')'
A number is a non-negative decimal; '30%' is 0.30. A meter is written in square brackets by display name or id.
The AST (stored in energy_accounts.formula_json) references meter IDS only:
    {"m": id} | {"n": "0.30"} | {"op": "+"|"-"|"*"|"/", "args": [a, b]} | {"neg": node}

The formula must be LINEAR and homogeneous: result = sum(coefficient[m] x meter[m]). A meter may be multiplied or divided
by a constant, never by a meter; a bare constant term (e.g. "[A] + 5") is refused. That keeps a period split (VAT or price
change) and later time-of-use exact: the formula of the parts adds up to the formula of the whole."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation, localcontext
from typing import Any, Iterable, Mapping

MAX_TEXT = 2000
MAX_METERS = 64
MAX_DEPTH = 32
MAX_NODES = 400

MESSAGES_HE = {
    "empty": "הנוסחה ריקה.",
    "too_long": "הנוסחה ארוכה מדי.",
    "syntax": "שגיאת תחביר בנוסחה.",
    "unbalanced": "חסר סוגר בנוסחה.",
    "unknown_meter": "מונה לא מוכר בנוסחה.",
    "nonlinear": "אפשר להכפיל או לחלק מונה רק במספר, לא במונה אחר.",
    "constant_term": "הנוסחה חייבת להיות מורכבת ממונים. מספר בודד אפשר רק ככופל של מונה.",
    "division_by_zero": "חלוקה באפס.",
    "no_meter": "הנוסחה חייבת לכלול לפחות מונה אחד.",
    "too_many_meters": "יותר מדי מונים בנוסחה.",
}


class FormulaError(Exception):
    def __init__(self, code: str, pos: int | None = None, detail: str = ""):
        super().__init__(code)
        self.code = code
        self.pos = pos
        self.detail = detail

    def as_dict(self) -> dict[str, Any]:
        msg = MESSAGES_HE.get(self.code, "הנוסחה אינה תקינה.")
        if self.detail:
            msg = f"{msg} ({self.detail})"
        return {"code": self.code, "message": msg, "pos": self.pos}


# ---------------------------------------------------------------- tokenizer

_OPS = {"+": "+", "-": "-", "−": "-", "–": "-", "*": "*", "×": "*", "·": "*", "/": "/", "÷": "/", "(": "(", ")": ")", "%": "%"}


@dataclass
class _Tok:
    kind: str  # num | meter | op | end
    value: str
    pos: int


def _tokens(text: str) -> list[_Tok]:
    out: list[_Tok] = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c.isspace():
            i += 1
            continue
        if c.isdigit() or (c == "." and i + 1 < n and text[i + 1].isdigit()):
            j = i
            dots = 0
            while j < n and (text[j].isdigit() or text[j] == "."):
                dots += text[j] == "."
                j += 1
            if dots > 1:
                raise FormulaError("syntax", i, text[i:j])
            out.append(_Tok("num", text[i:j], i))
            i = j
            continue
        if c == "[":
            j = text.find("]", i + 1)
            if j < 0:
                raise FormulaError("unbalanced", i)
            name = text[i + 1:j].strip()
            if not name or "[" in name:
                raise FormulaError("syntax", i)
            out.append(_Tok("meter", name, i))
            i = j + 1
            continue
        if c == "]":
            raise FormulaError("unbalanced", i)
        if c in _OPS:
            out.append(_Tok("op", _OPS[c], i))
            i += 1
            continue
        raise FormulaError("syntax", i, c)
    out.append(_Tok("end", "", n))
    return out


# ---------------------------------------------------------------- parser (text -> AST)

class _Parser:
    def __init__(self, toks: list[_Tok], resolve):
        self.t = toks
        self.i = 0
        self.resolve = resolve
        self.depth = 0
        self.nodes = 0

    def peek(self) -> _Tok:
        return self.t[self.i]

    def take(self) -> _Tok:
        tok = self.t[self.i]
        self.i += 1
        return tok

    def node(self, n: dict[str, Any]) -> dict[str, Any]:
        self.nodes += 1
        if self.nodes > MAX_NODES:
            raise FormulaError("too_long")
        return n

    def expr(self) -> dict[str, Any]:
        self.depth += 1
        if self.depth > MAX_DEPTH:
            raise FormulaError("too_long", self.peek().pos)
        left = self.term()
        while self.peek().kind == "op" and self.peek().value in "+-":
            op = self.take().value
            left = self.node({"op": op, "args": [left, self.term()]})
        self.depth -= 1
        return left

    def term(self) -> dict[str, Any]:
        left = self.unary()
        while self.peek().kind == "op" and self.peek().value in "*/":
            op = self.take().value
            left = self.node({"op": op, "args": [left, self.unary()]})
        return left

    def unary(self) -> dict[str, Any]:
        if self.peek().kind == "op" and self.peek().value == "-":
            self.take()
            self.depth += 1
            if self.depth > MAX_DEPTH:
                raise FormulaError("too_long", self.peek().pos)
            inner = self.unary()
            self.depth -= 1
            return self.node({"neg": inner})
        return self.primary()

    def primary(self) -> dict[str, Any]:
        tok = self.take()
        if tok.kind == "num":
            try:
                value = Decimal(tok.value)
            except InvalidOperation:
                raise FormulaError("syntax", tok.pos) from None
            if self.peek().kind == "op" and self.peek().value == "%":
                self.take()
                value = value / Decimal(100)
            return self.node({"n": _dec_str(value)})
        if tok.kind == "meter":
            mid = self.resolve(tok.value)
            if mid is None:
                raise FormulaError("unknown_meter", tok.pos, tok.value)
            return self.node({"m": mid})
        if tok.kind == "op" and tok.value == "(":
            inner = self.expr()
            close = self.take()
            if not (close.kind == "op" and close.value == ")"):
                raise FormulaError("unbalanced", close.pos)
            return inner
        if tok.kind == "end":
            raise FormulaError("syntax" if self.i > 1 else "empty", tok.pos)
        if tok.kind == "op" and tok.value == ")":
            raise FormulaError("unbalanced", tok.pos)
        raise FormulaError("syntax", tok.pos)


def _dec_str(d: Decimal) -> str:
    s = format(d.normalize(), "f")
    return s if s not in ("-0", "") else "0"


def parse_text(text: str, names: Mapping[str, str]) -> dict[str, Any]:
    """Text -> AST. `names` maps meter id -> display name; a bracket matches an id first, then a unique name
    (case- and space-insensitive)."""
    if text is None or not str(text).strip():
        raise FormulaError("empty", 0)
    text = str(text)
    if len(text) > MAX_TEXT:
        raise FormulaError("too_long")
    by_name: dict[str, list[str]] = {}
    for mid, name in names.items():
        by_name.setdefault(_norm(name), []).append(mid)

    def resolve(token: str) -> str | None:
        if token in names:
            return token
        hits = by_name.get(_norm(token)) or []
        return hits[0] if len(hits) == 1 else None

    p = _Parser(_tokens(text), resolve)
    ast = p.expr()
    end = p.peek()
    if end.kind != "end":
        raise FormulaError("unbalanced" if end.value == ")" else "syntax", end.pos)
    return ast


def _norm(s: str) -> str:
    return " ".join(str(s).split()).casefold()


# ---------------------------------------------------------------- AST validation (a client may send an AST)

def validate_ast(ast: Any, depth: int = 0, count: list[int] | None = None) -> dict[str, Any]:
    """A closed, bounded AST from outside -> a clean copy. Raises FormulaError('syntax')."""
    count = count if count is not None else [0]
    count[0] += 1
    if depth > MAX_DEPTH or count[0] > MAX_NODES:
        raise FormulaError("too_long")
    if not isinstance(ast, dict):
        raise FormulaError("syntax")
    keys = set(ast)
    if keys == {"m"} and isinstance(ast["m"], str) and 0 < len(ast["m"]) <= 64:
        return {"m": ast["m"]}
    if keys == {"n"} and isinstance(ast["n"], (str, int)) and not isinstance(ast["n"], bool):
        try:
            d = Decimal(str(ast["n"]))
        except InvalidOperation:
            raise FormulaError("syntax") from None
        if not d.is_finite() or d < 0 or len(str(ast["n"])) > 30:
            raise FormulaError("syntax")
        return {"n": _dec_str(d)}
    if keys == {"neg"}:
        return {"neg": validate_ast(ast["neg"], depth + 1, count)}
    if keys == {"op", "args"} and ast["op"] in ("+", "-", "*", "/") and isinstance(ast["args"], list) and len(ast["args"]) == 2:
        return {"op": ast["op"], "args": [validate_ast(a, depth + 1, count) for a in ast["args"]]}
    raise FormulaError("syntax")


# ---------------------------------------------------------------- linear form

@dataclass
class Linear:
    coef: dict[str, Decimal] = field(default_factory=dict)  # meter id -> coefficient (insertion order = formula order)
    const: Decimal = Decimal(0)

    @property
    def is_const(self) -> bool:
        return not self.coef

    def scaled(self, k: Decimal) -> "Linear":
        return Linear({m: c * k for m, c in self.coef.items()}, self.const * k)

    def plus(self, other: "Linear", sign: int = 1) -> "Linear":
        coef = dict(self.coef)
        for m, c in other.coef.items():
            coef[m] = coef.get(m, Decimal(0)) + sign * c
        return Linear(coef, self.const + sign * other.const)


def linear(ast: dict[str, Any]) -> Linear:
    with localcontext() as ctx:
        ctx.prec = 34
        return _lin(ast)


def _lin(a: dict[str, Any]) -> Linear:
    if "m" in a:
        return Linear({a["m"]: Decimal(1)})
    if "n" in a:
        return Linear({}, Decimal(a["n"]))
    if "neg" in a:
        return _lin(a["neg"]).scaled(Decimal(-1))
    left, right = _lin(a["args"][0]), _lin(a["args"][1])
    op = a["op"]
    if op == "+":
        return left.plus(right)
    if op == "-":
        return left.plus(right, -1)
    if op == "*":
        if left.is_const:
            return right.scaled(left.const)
        if right.is_const:
            return left.scaled(right.const)
        raise FormulaError("nonlinear")
    # division
    if not right.is_const:
        raise FormulaError("nonlinear")
    if right.const == 0:
        raise FormulaError("division_by_zero")
    return left.scaled(Decimal(1) / right.const)


def meter_ids(ast: dict[str, Any]) -> list[str]:
    """Meter ids in order of first appearance."""
    out: list[str] = []

    def walk(a: dict[str, Any]) -> None:
        if "m" in a:
            if a["m"] not in out:
                out.append(a["m"])
        elif "neg" in a:
            walk(a["neg"])
        elif "args" in a:
            for x in a["args"]:
                walk(x)

    walk(ast)
    return out


def _occurrences(ast: dict[str, Any]) -> dict[str, int]:
    seen: dict[str, int] = {}

    def walk(a: dict[str, Any]) -> None:
        if "m" in a:
            seen[a["m"]] = seen.get(a["m"], 0) + 1
        elif "neg" in a:
            walk(a["neg"])
        elif "args" in a:
            for x in a["args"]:
                walk(x)

    walk(ast)
    return seen


@dataclass
class Compiled:
    ast: dict[str, Any]
    coefficients: dict[str, Decimal]
    meter_ids: list[str]
    warnings: list[dict[str, Any]]

    def evaluate(self, values: Mapping[str, Decimal]) -> Decimal:
        """result = sum(coefficient x value); a meter without a value counts 0 (the caller decides whether that is allowed)."""
        with localcontext() as ctx:
            ctx.prec = 34
            return sum((c * Decimal(values.get(m, 0)) for m, c in self.coefficients.items()), Decimal(0))


def compile_formula(ast: dict[str, Any], known: Iterable[str] | None = None) -> Compiled:
    """Validate linearity, the meter set and the bounds. `known` (meter ids that exist) - None skips that check."""
    ast = validate_ast(ast)
    ids = meter_ids(ast)
    if not ids:
        raise FormulaError("no_meter")
    if len(ids) > MAX_METERS:
        raise FormulaError("too_many_meters")
    if known is not None:
        known_set = set(known)
        for mid in ids:
            if mid not in known_set:
                raise FormulaError("unknown_meter", None, mid)
    lin = linear(ast)
    if lin.const != 0:
        raise FormulaError("constant_term")
    coefficients = {m: lin.coef.get(m, Decimal(0)) for m in ids}
    warnings = [{"code": "duplicate_meter", "message": "המונה מופיע יותר מפעם אחת.", "meter_id": m} for m, n in _occurrences(ast).items() if n > 1]
    return Compiled(ast, coefficients, ids, warnings)


# ---------------------------------------------------------------- rendering

_PREC = {"+": 1, "-": 1, "*": 2, "/": 2}


def to_text(ast: dict[str, Any], names: Mapping[str, str]) -> str:
    def name(mid: str) -> str:
        return f"[{names.get(mid, mid)}]"

    def r(a: dict[str, Any], parent: int = 0, right: bool = False) -> str:
        if "m" in a:
            return name(a["m"])
        if "n" in a:
            return a["n"]
        if "neg" in a:
            return "-" + r(a["neg"], 3)
        op = a["op"]
        p = _PREC[op]
        s = f"{r(a['args'][0], p)} {op} {r(a['args'][1], p, True)}"
        if p < parent or (right and p == parent and op in "-/") or (right and p == parent and parent == 2):
            return f"({s})"
        return s

    return r(ast)


_WORDS = {"+": "ועוד", "-": "פחות", "*": "כפול", "/": "חלקי"}


def sentence_he(ast: dict[str, Any], names: Mapping[str, str]) -> str:
    def r(a: dict[str, Any], parent: int = 0, right: bool = False) -> str:
        if "m" in a:
            return names.get(a["m"], a["m"])
        if "n" in a:
            return a["n"]
        if "neg" in a:
            return "מינוס " + r(a["neg"], 3)
        op = a["op"]
        p = _PREC[op]
        s = f"{r(a['args'][0], p)} {_WORDS[op]} {r(a['args'][1], p, True)}"
        if p < parent or (right and p == parent):
            return f"({s})"
        return s

    return r(ast)


# ---------------------------------------------------------------- presets

def preset(kind: str, meter_ids_: list[str], main_meter_id: str | None = None, percent: str | None = None) -> dict[str, Any]:
    ids = [m for i, m in enumerate(meter_ids_) if m and m not in meter_ids_[:i]]
    if kind == "sum":
        if not ids:
            raise FormulaError("no_meter")
        ast: dict[str, Any] = {"m": ids[0]}
        for m in ids[1:]:
            ast = {"op": "+", "args": [ast, {"m": m}]}
        return ast
    if kind == "main_minus_subs":
        main = main_meter_id or (ids[0] if ids else None)
        if not main:
            raise FormulaError("no_meter")
        ast = {"m": main}
        for m in ids:
            if m != main:
                ast = {"op": "-", "args": [ast, {"m": m}]}
        return ast
    if kind == "share":
        if len(ids) != 1 or percent is None:
            raise FormulaError("syntax")
        try:
            pct = Decimal(str(percent))
        except InvalidOperation:
            raise FormulaError("syntax") from None
        if not pct.is_finite() or pct <= 0 or pct > 1000:
            raise FormulaError("syntax")
        return {"op": "*", "args": [{"n": _dec_str(pct / 100)}, {"m": ids[0]}]}
    raise FormulaError("syntax")


def dumps(ast: dict[str, Any]) -> str:
    return json.dumps(ast, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
