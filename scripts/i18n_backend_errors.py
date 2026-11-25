#!/usr/bin/env python3
"""I18N-REST-2520: inventory of the server's Hebrew refusal texts and their English (report only; it never edits a source file).

It reads smplwise_vms/backend/smplwise/ with the AST (nothing is imported) and finds every call of an error constructor - `ApiError`,
the helpers of errors.py (`conflict`, `validation`, `forbidden`, `not_found`, `field_error`, `unauthenticated`), and the modules' own
error classes and helpers by name (`*Error`, `*Invalid`, `*Refused`, `_err*`, `_refuse*`, `_invalid*`, `_conflict*`, `bad*`, `deny*`,
`_problem*`, `need*`, `_422` ...) - and the Hebrew texts passed to it:
  constant  - a plain Hebrew literal: its English must be in smplwise/error_text_en.json (smplwise/error_text.py), else it is `missing`;
  template  - (I18N-RUNTIME-ERRORS-2520) `tpl("<Hebrew template>", name=...)` (smplwise/error_text.py): its English template must be in
              smplwise/error_text_tpl_en.json "templates", else it is `missing`; a Hebrew literal passed as a param must be in its
              "words", else it is `missing` too;
  runtime   - an f-string with Hebrew words (names and numbers filled at run time), also as a param of `tpl()`: the tables cannot
              hold it; turn it into `tpl()`. Counted per module.

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
TPL_TABLE = PKG / "error_text_tpl_en.json"
TPL_FUNCS = {"tpl", "Tpl", "err_tpl"}
RATCHET = ROOT / "docs" / "i18n" / "BE_ERRORS_EN_RATCHET.json"

HEB = re.compile(r"[֐-׿]")
ERR_FUNCS = {"ApiError", "conflict", "validation", "forbidden", "not_found", "field_error", "unauthenticated"}
ERR_RE = re.compile(r"^(_?(err|error|refuse|refused|invalid|conflict|bad|deny|denied|fail|reject|problem|need)\w*|_\d{3}|\w*(Error|Invalid|Refused))$", re.I)
MSG_KEYWORDS = ("user_message", "message", "what")
# RELEASE-2520-TRAIN (WISKEY-PAIRING-I18N-2520 Q1 = a): gates that build the refusal themselves from a keyword the caller passes - the
# Hebrew there is a refusal text too (rbac.require_system_admin(..., text="רק מנהל מערכת ...") raises 403 not_system_admin with it).
TEXT_KEYWORD_GATES = {"require_system_admin": ("text",)}


def _name(f: ast.AST) -> str:
    return f.id if isinstance(f, ast.Name) else f.attr if isinstance(f, ast.Attribute) else ""


def is_error_call(n: ast.AST) -> bool:
    return isinstance(n, ast.Call) and (_name(n.func) in ERR_FUNCS or bool(ERR_RE.match(_name(n.func))))


def _hebrew_fstring(n: ast.AST) -> bool:
    return isinstance(n, ast.JoinedStr) and any(isinstance(v, ast.Constant) and HEB.search(str(v.value)) for v in n.values)


def _tpl_tables() -> dict[str, dict[str, str]]:
    doc = json.loads(TPL_TABLE.read_text(encoding="utf-8")) if TPL_TABLE.exists() else {}
    return {"templates": dict(doc.get("templates") or {}), "words": dict(doc.get("words") or {})}


def is_tpl_call(n: ast.AST) -> bool:
    return (isinstance(n, ast.Call) and _name(n.func) in TPL_FUNCS and bool(n.args) and isinstance(n.args[0], ast.Constant)
            and isinstance(n.args[0].value, str))


def inventory(pkg: Path = PKG, table: dict[str, str] | None = None, tpl_tables: dict[str, dict[str, str]] | None = None) -> dict[str, Any]:
    """{constants: {text: [file:line]}, templates: {template: [file:line]}, missing: {module: [(file:line, text)]},
    runtime: {module: count}} for the package `pkg`."""
    table = json.loads(TABLE.read_text(encoding="utf-8")) if table is None else table
    tt = _tpl_tables() if tpl_tables is None else tpl_tables
    constants: dict[str, list[str]] = {}
    templates: dict[str, list[str]] = {}
    missing: dict[str, list[tuple[str, str]]] = {}
    runtime: Counter[str] = Counter()
    for p in sorted(pkg.rglob("*.py")):
        rel = p.relative_to(pkg).as_posix()
        tree = ast.parse(p.read_text(encoding="utf-8"))
        for n in ast.walk(tree):
            if is_tpl_call(n):
                assert isinstance(n, ast.Call)
                he = n.args[0].value  # type: ignore[attr-defined]
                templates.setdefault(he, []).append(f"{rel}:{n.lineno}")
                if he not in tt["templates"]:
                    missing.setdefault(rel, []).append((f"{rel}:{n.lineno}", he))
                for k in n.keywords:
                    v = k.value
                    if isinstance(v, ast.Constant) and isinstance(v.value, str) and HEB.search(v.value) and v.value not in tt["words"]:
                        missing.setdefault(rel, []).append((f"{rel}:{v.lineno}", v.value))
                    elif _hebrew_fstring(v):
                        runtime[rel] += 1
                continue
            gate_keys = TEXT_KEYWORD_GATES.get(_name(n.func), ()) if isinstance(n, ast.Call) else ()
            if not gate_keys and not is_error_call(n):
                continue
            assert isinstance(n, ast.Call)
            texts = [k.value for k in n.keywords if k.arg in gate_keys] if gate_keys else [*n.args, *(k.value for k in n.keywords if k.arg in MSG_KEYWORDS)]
            for a in texts:
                if isinstance(a, ast.Constant) and isinstance(a.value, str) and HEB.search(a.value):
                    constants.setdefault(a.value, []).append(f"{rel}:{a.lineno}")
                    if a.value not in table:
                        missing.setdefault(rel, []).append((f"{rel}:{a.lineno}", a.value))
                elif _hebrew_fstring(a):
                    runtime[rel] += 1
    return {"constants": constants, "templates": templates, "missing": missing, "runtime": dict(sorted(runtime.items()))}


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
          f"run-time templates (tpl): {len(inv['templates'])} distinct, {sum(len(v) for v in inv['templates'].values())} sites; "
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
