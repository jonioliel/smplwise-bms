"""Apply a draft: copy the wire module, decorate the router's routes with **wire(W.Model).

python apply.py <repo> <router> [--only fn1,fn2]   (reads $WIRE_DRAFT_DIR/<router>.py and .map.json)"""
from __future__ import annotations

import ast
import json
import re
import os
import sys
import tempfile
from pathlib import Path

repo = Path(sys.argv[1])
name = sys.argv[2]
DRAFTS = Path(os.environ.get("WIRE_DRAFT_DIR") or (Path(tempfile.gettempdir()) / "wire_draft"))
mapping = json.loads((DRAFTS / f"{name}.map.json").read_text(encoding="utf-8"))["map"]
wire_src = DRAFTS / f"{name}.py"
wire_dst = repo / "smplwise_vms" / "backend" / "smplwise" / "wire" / f"{name}.py"
router = repo / "smplwise_vms" / "backend" / "smplwise" / "routers" / f"{name}.py"
if not wire_dst.exists() or "--keep-wire" not in sys.argv:
    wire_dst.write_text(wire_src.read_text(encoding="utf-8"), encoding="utf-8", newline="\n")

text = router.read_text(encoding="utf-8")
_m = re.search(rf"^from \.\.wire import {name} as (\w+)$", text, re.M)
if _m:
    alias = _m.group(1)
else:
    alias = "WM" if re.search(r"\bW\b", text) else "W"
tree = ast.parse(text)
lines = text.splitlines(keepends=True)
offsets = [0]
for ln in lines:
    offsets.append(offsets[-1] + len(ln))


def pos(lineno: int, col: int) -> int:
    return offsets[lineno - 1] + len(lines[lineno - 1].encode("utf-8")[:col].decode("utf-8"))


edits: list[tuple[int, int, str]] = []
done = []
for node in ast.walk(tree):
    if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        continue
    model = mapping.get(node.name)
    if not model:
        continue
    if model.startswith(("SKIP", "NO_JSON")):  # a decorator an earlier draft added goes again
        for dec in node.decorator_list:
            if isinstance(dec, ast.Call):
                for k in dec.keywords:
                    if k.arg is None and isinstance(k.value, ast.Call) and getattr(k.value.func, "id", "") == "wire":
                        s, e = pos(k.value.lineno, k.value.col_offset) - 2, pos(k.value.end_lineno, k.value.end_col_offset)
                        while text[s - 1] == " ":
                            s -= 1
                        if text[s - 1] == ",":
                            s -= 1
                        edits.append((s, e, ""))
                        print("removed decorator", node.name)
        continue
    for dec in node.decorator_list:
        if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute) and dec.func.attr in ("get", "post", "put", "patch", "delete"):
            if any(k.arg == "response_model" for k in dec.keywords):
                continue
            existing = [k.value for k in dec.keywords if k.arg is None and isinstance(k.value, ast.Call) and getattr(k.value.func, "id", "") == "wire"]
            if existing:
                a = existing[0].args[0]
                s, e = pos(a.lineno, a.col_offset), pos(a.end_lineno, a.end_col_offset)
                if text[s:e] != f"{alias}.{model}":
                    edits.append((s, e, f"{alias}.{model}"))
                done.append(node.name)
                continue
            end = pos(dec.end_lineno, dec.end_col_offset) - 1  # the closing paren
            assert text[end] == ")", (node.name, text[end - 5:end + 1])
            before = text[:end].rstrip()
            ins_at = len(before)
            if before.endswith("("):
                ins = f"**wire({alias}.{model})"
            elif before.endswith(","):
                ins = f" **wire({alias}.{model}),"
            else:
                ins = f", **wire({alias}.{model})"
            edits.append((ins_at, ins_at, ins))
            done.append(node.name)
for at, end_, ins in sorted(edits, reverse=True):
    text = text[:at] + ins + text[end_:]

imports = []
if f"from ..wire import {name} as {alias}" not in text:
    imports.append(f"from ..wire import {name} as {alias}\n")
if not re.search(r"^from \.\.wire import (.*\b)?wire\b", text, re.M):
    imports.append("from ..wire import wire\n")
if imports:
    tree = ast.parse(text)
    last = None
    for n in tree.body:
        if isinstance(n, (ast.Import, ast.ImportFrom)):
            last = n
        elif isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            break
    assert last is not None
    lines = text.splitlines(keepends=True)
    idx = last.end_lineno
    lines[idx:idx] = imports
    text = "".join(lines)
router.write_text(text, encoding="utf-8", newline="\n")
want = [k for k, v in mapping.items() if not v.startswith(("SKIP", "NO_JSON"))]
missing = sorted(set(want) - set(done))
print(f"{name}: decorated {len(done)} routes" + (f"; NOT FOUND {missing}" if missing else ""))
