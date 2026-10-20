#!/usr/bin/env python3
"""DATASTORE-295 part 3: where does SQL live outside the storage modules?

    python scripts/sql_boundary_report.py [--root smplwise_vms/backend/smplwise] [--json] [--top 30]

Static scan (ast, no import of the application): for every backend module it counts the `.execute()` / `.executemany()` /
`.executescript()` calls and the SQL statements written as string literals (plain and f-strings), splits them into reads and
writes, and lists the tables each module touches. A module counts as a STORE module when its file name says so (`store.py`,
`*_store.py`, `store_*.py`) or it is the database core (`db.py`); everything else holding SQL is outside the boundary.

The score orders the worst offenders: SQL statements + execute calls, writes count double, and SQL in an HTTP router counts
1.5x (the router is the layer that should hold none). Also printed: the tables written from the most modules - the tables whose
rules are spread widest, i.e. the first candidates for a store module of their own. Read-only; never changes a file."""
from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "smplwise_vms" / "backend" / "smplwise"
SQL_RE = re.compile(r"\b(SELECT\s.+?\sFROM\s|INSERT\s+(?:OR\s+\w+\s+)?INTO\s|REPLACE\s+INTO\s|UPDATE\s+\w+\s+SET\s|DELETE\s+FROM\s|"
                    r"CREATE\s+(?:TABLE|INDEX|TRIGGER|VIEW)|ALTER\s+TABLE|DROP\s+(?:TABLE|INDEX))", re.S)
WRITE_RE = re.compile(r"\b(INSERT\s|REPLACE\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s|ALTER\s|DROP\s)")
TABLE_RE = re.compile(r"\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_][a-z0-9_]*)")
WRITE_TABLE_RE = re.compile(r"\b(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-z_][a-z0-9_]*)")
EXEC_NAMES = {"execute", "executemany", "executescript"}
NOT_TABLES = {"sqlite_master", "pragma_table_info", "json_each", "select", "values", "set", "where", "the", "a"}


def is_store(rel: str) -> bool:
    name = rel.rsplit("/", 1)[-1]
    return name == "db.py" or name == "store.py" or name.endswith("_store.py") or name.startswith("store_")


def _literal_text(node: ast.AST) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.JoinedStr):  # an f-string: its literal parts, `{}` for each placeholder
        return "".join(v.value if isinstance(v, ast.Constant) and isinstance(v.value, str) else "{}" for v in node.values)
    return None


def scan_file(path: Path) -> dict:
    src = path.read_text(encoding="utf-8")
    tree = ast.parse(src, filename=str(path))
    execs = 0
    stmts: list[str] = []
    seen_nodes: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in EXEC_NAMES:
            execs += 1
        if isinstance(node, ast.JoinedStr):
            for v in node.values:
                seen_nodes.add(id(v))
    for node in ast.walk(tree):
        if id(node) in seen_nodes:
            continue
        text = _literal_text(node)
        if text and SQL_RE.search(text):
            stmts.append(text)
    writes = [s for s in stmts if WRITE_RE.search(s)]
    tables = sorted({t for s in stmts for t in TABLE_RE.findall(s)} - NOT_TABLES)
    written = sorted({t for s in writes for t in WRITE_TABLE_RE.findall(s)} - NOT_TABLES)
    return {"execute_calls": execs, "sql": len(stmts), "writes": len(writes), "reads": len(stmts) - len(writes), "tables": tables, "written": written}


def scan(root: Path) -> list[dict]:
    out = []
    for path in sorted(root.rglob("*.py")):
        rel = path.relative_to(root).as_posix()
        r = scan_file(path)
        if not (r["sql"] or r["execute_calls"]):
            continue
        layer = "router" if rel.startswith("routers/") else "service" if rel.startswith("services/") else "core"
        weight = 1.5 if layer == "router" else 1.0
        r.update({"module": rel, "layer": layer, "store": is_store(rel), "score": round((r["sql"] + r["writes"] + r["execute_calls"]) * weight, 1)})
        out.append(r)
    return out


def table_spread(rows: list[dict]) -> list[tuple[str, list[str]]]:
    writers: dict[str, set[str]] = defaultdict(set)
    for r in rows:
        if r["store"]:
            continue
        for t in r["written"]:
            writers[t].add(r["module"])
    return sorted(((t, sorted(m)) for t, m in writers.items()), key=lambda x: (-len(x[1]), x[0]))


def markdown(rows: list[dict], top: int) -> str:
    outside = sorted((r for r in rows if not r["store"]), key=lambda r: -r["score"])
    stores = [r for r in rows if r["store"]]
    lines = [f"Modules with SQL: {len(rows)} ({len(stores)} store modules, {len(outside)} outside the boundary). "
             f"SQL statements outside: {sum(r['sql'] for r in outside)} of {sum(r['sql'] for r in rows)}; "
             f"writes outside: {sum(r['writes'] for r in outside)} of {sum(r['writes'] for r in rows)}; "
             f"routers with SQL: {sum(1 for r in outside if r['layer'] == 'router')}.", "",
             "| # | module | layer | score | SQL | writes | execute() | tables written |", "|---|---|---|---|---|---|---|---|"]
    for i, r in enumerate(outside[:top], 1):
        lines.append(f"| {i} | `{r['module']}` | {r['layer']} | {r['score']} | {r['sql']} | {r['writes']} | {r['execute_calls']} | "
                     f"{', '.join(r['written'][:6])}{' ...' if len(r['written']) > 6 else ''} |")
    lines += ["", "Tables written from the most modules outside a store:", "", "| table | modules | written from |", "|---|---|---|"]
    for t, mods in table_spread(rows)[:top]:
        lines.append(f"| `{t}` | {len(mods)} | {', '.join(m.removeprefix('services/') for m in mods[:8])}{' ...' if len(mods) > 8 else ''} |")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", type=Path, default=ROOT)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--top", type=int, default=30)
    a = ap.parse_args(argv)
    rows = scan(a.root)
    if a.json:
        print(json.dumps(rows, indent=1))
    else:
        sys.stdout.write(markdown(rows, a.top))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
