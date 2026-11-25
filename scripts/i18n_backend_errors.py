#!/usr/bin/env python3
"""I18N-REST-2520: inventory of the server's Hebrew refusal texts and their English (report only; it never edits a source file).

It reads smplwise_vms/backend/smplwise/ with the AST (nothing is imported) and finds every call of an error constructor - `ApiError`,
the helpers of errors.py (`conflict`, `validation`, `forbidden`, `not_found`, `field_error`, `unauthenticated`), and the modules' own
error classes and helpers by name (`*Error`, `*Invalid`, `*Refused`, `_err*`, `_refuse*`, `_invalid*`, `_conflict*`, `bad*`, `deny*`,
`_problem*`, `need*`, `_422` ...) - and the Hebrew texts passed to it:
  constant  - a plain Hebrew literal: its English must be in smplwise/error_text_en.json (smplwise/error_text.py), else it is `missing`;
  runtime   - an f-string with Hebrew words (names and numbers filled at run time): the table cannot hold it; it becomes a `Msg` of a
              catalogue (smplwise/i18n.py) when its module is worked on. Counted per module.

Usage (from the repository root):
  py -3.12 scripts/i18n_backend_errors.py              # the summary
  py -3.12 scripts/i18n_backend_errors.py --missing    # also every constant without English (file:line and text)
  py -3.12 scripts/i18n_backend_errors.py --ratchet    # lower docs/i18n/BE_ERRORS_EN_RATCHET.json to today's counts (never raises
                                                       # a count unless --allow-raise is given too; explain a raise in the change note)
The ratchet is read by smplwise_vms/backend/tests/test_i18n_errors_en_2520.py.
"""
from __future__ import annotations

import ast
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / "smplwise_vms" / "backend" / "smplwise"
TABLE = PKG / "error_text_en.json"
RATCHET = ROOT / "docs" / "i18n" / "BE_ERRORS_EN_RATCHET.json"

HEB = re.compile(r"[֐-׿]")
ERR_FUNCS = {"ApiError", "conflict", "validation", "forbidden", "not_found", "field_error", "unauthenticated"}
ERR_RE = re.compile(r"^(_?(err|error|refuse|refused|invalid|conflict|bad|deny|denied|fail|reject|problem|need)\w*|_\d{3}|\w*(Error|Invalid|Refused))$", re.I)
MSG_KEYWORDS = ("user_message", "message", "what")


def _name(f: ast.AST) -> str:
    return f.id if isinstance(f, ast.Name) else f.attr if isinstance(f, ast.Attribute) else ""


def is_error_call(n: ast.AST) -> bool:
    return isinstance(n, ast.Call) and (_name(n.func) in ERR_FUNCS or bool(ERR_RE.match(_name(n.func))))


def _hebrew_fstring(n: ast.AST) -> bool:
    return isinstance(n, ast.JoinedStr) and any(isinstance(v, ast.Constant) and HEB.search(str(v.value)) for v in n.values)


def inventory(pkg: Path = PKG, table: dict[str, str] | None = None) -> dict[str, Any]:
    """{constants: {text: [file:line]}, missing: {module: [(file:line, text)]}, runtime: {module: count}} for the package `pkg`."""
    table = json.loads(TABLE.read_text(encoding="utf-8")) if table is None else table
    constants: dict[str, list[str]] = {}
    missing: dict[str, list[tuple[str, str]]] = {}
    runtime: Counter[str] = Counter()
    for p in sorted(pkg.rglob("*.py")):
        rel = p.relative_to(pkg).as_posix()
        tree = ast.parse(p.read_text(encoding="utf-8"))
        for n in ast.walk(tree):
            if not is_error_call(n):
                continue
            assert isinstance(n, ast.Call)
            for a in [*n.args, *(k.value for k in n.keywords if k.arg in MSG_KEYWORDS)]:
                if isinstance(a, ast.Constant) and isinstance(a.value, str) and HEB.search(a.value):
                    constants.setdefault(a.value, []).append(f"{rel}:{a.lineno}")
                    if a.value not in table:
                        missing.setdefault(rel, []).append((f"{rel}:{a.lineno}", a.value))
                elif _hebrew_fstring(a):
                    runtime[rel] += 1
    return {"constants": constants, "missing": missing, "runtime": dict(sorted(runtime.items()))}


def ratchet_of(inv: dict[str, Any]) -> dict[str, Any]:
    missing = {m: len(v) for m, v in sorted(inv["missing"].items())}
    return {
        "missingTotal": sum(missing.values()),
        "missing": missing,
        "runtimeTotal": sum(inv["runtime"].values()),
        "runtime": inv["runtime"],
    }


def main(argv: list[str]) -> int:
    inv = inventory()
    now = ratchet_of(inv)
    print(f"constant Hebrew refusal texts: {len(inv['constants'])} distinct, {sum(len(v) for v in inv['constants'].values())} sites; "
          f"without English: {now['missingTotal']}; run-time (f-string) Hebrew texts: {now['runtimeTotal']} in {len(now['runtime'])} modules")
    if "--missing" in argv:
        for rows in inv["missing"].values():
            for where, text in rows:
                print(f"  {where}: {text}")
    if "--ratchet" in argv:
        old = json.loads(RATCHET.read_text(encoding="utf-8")) if RATCHET.exists() else None
        raised = []
        if old:
            for kind in ("missing", "runtime"):
                for m, c in now[kind].items():
                    if c > old[kind].get(m, 0):
                        raised.append(f"{kind} {m}: {old[kind].get(m, 0)} -> {c}")
        if raised and "--allow-raise" not in argv:
            print("refused: the ratchet would go up (add the English / make the text a Msg, or pass --allow-raise with a reason in the "
                  "change note):\n  " + "\n  ".join(raised), file=sys.stderr)
            return 1
        note = "I18N-REST-2520: written by `py -3.12 scripts/i18n_backend_errors.py --ratchet` (it only lowers); read by smplwise_vms/backend/tests/test_i18n_errors_en_2520.py"
        RATCHET.write_text(json.dumps({"note": note, **now}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
        print(f"wrote {RATCHET.relative_to(ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
