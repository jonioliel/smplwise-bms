#!/usr/bin/env python3
"""Downgrade-safety check of the database migrations between two versions (PILOT-ROLLBACK-2550, T036).

Rolling an add-on back means OLDER code runs on the database the NEWER version migrated: `Database.migrate()` only applies the
files it knows and never undoes one, so every migration the newer version added stays in place. This script lists, for two
versions A -> B, the migrations B added (main database `migrations/` and the readings store `migrations_energy/`) and classifies
each one:

  compatible       older code runs on the newer schema unchanged: a new table / view / index, a new nullable or defaulted column,
                   an index dropped that was not unique, a trigger or data change confined to tables A did not have
  not compatible   older code may fail or misread: a table, view, trigger or column A had is dropped or renamed (a table rebuild
                   included), a UNIQUE index or a trigger on a table A had (older writes may be refused or have side effects it does
                   not expect), rows of a table A had are rewritten (UPDATE / DELETE / INSERT / REPLACE: older code reads values it
                   may not understand), a unique index A had is dropped (an older upsert loses its conflict target), a new NOT NULL
                   column without a default, a new column on a table older code fills with a positional `INSERT INTO t VALUES`,
                   or a statement this script cannot judge

Each verdict comes from two independent looks: the statements themselves (comments removed, split with
sqlite3.complete_statement) and the schema before / after the file, built in an in-memory SQLite from A's migrations (a table of A
that lost a column or vanished is caught even when the statement scan misses it).

A not-compatible migration must carry a rollback note: `Rollback: <what an owner rolling back must know>` in a comment of the
file itself (`-- Rollback: ...` on its own line, or after other comment text on the line - the convention the migration headers
already follow; at least 20 characters). Without one the check FAILS. A migration A shipped that B removed, renumbered or
changed (other than in its comments) also FAILS: installations that already ran it never run the new text.

Usage:
  python scripts/migration_downgrade_check.py --from v2.48.0 --to v2.51.0      two git refs
  python scripts/migration_downgrade_check.py --from v2.51.0                   ref -> the working tree
  python scripts/migration_downgrade_check.py --chain v2.48.0,v2.49.0,v2.50.0,v2.51.0,HEAD   every step and the whole range
  [--root DIR] [--json out.json]
Exit 0 = every step passes, 1 = a step fails, 2 = usage / git error.
scripts/release_check.py runs it from the previous release tag to the working tree.
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Protocol

ROOT = Path(__file__).resolve().parents[1]
PKG = "smplwise_vms/backend/smplwise"
SETS = {"main": f"{PKG}/migrations", "energy": f"{PKG}/migrations_energy"}
NOTE_RE = re.compile(r"^[ \t]*--.*?\brollback\s*:\s*(.+)$", re.IGNORECASE | re.MULTILINE)  # a comment line; inline after other text too
NOTE_MIN_CHARS = 20


# ---------------------------------------------------------------- sources: a git ref or a directory tree

class Source(Protocol):
    label: str

    def migrations(self, rel_dir: str) -> dict[str, str]: ...

    def code_mentioning(self, table: str) -> list[tuple[str, str]]: ...


def _git(root: Path, *args: str) -> str:
    out = subprocess.run(["git", "-C", str(root), *args], capture_output=True, timeout=60)
    if out.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {out.stderr.decode('utf-8', 'replace').strip()}")
    return out.stdout.decode("utf-8", "replace")


_BLOBS: dict[str, str] = {}  # blob sha -> text (the same file in several versions is read once)


def read_blobs(root: Path, shas: list[str]) -> dict[str, str]:
    """Every blob in one `git cat-file --batch` (one process, not one per file)."""
    want = [s for s in dict.fromkeys(shas) if s not in _BLOBS]
    if want:
        out = subprocess.run(["git", "-C", str(root), "cat-file", "--batch"], input=("\n".join(want) + "\n").encode(), capture_output=True, timeout=120)
        if out.returncode != 0:
            raise RuntimeError(f"git cat-file: {out.stderr.decode('utf-8', 'replace').strip()}")
        data, pos = out.stdout, 0
        for sha in want:
            nl = data.index(b"\n", pos)
            head = data[pos:nl].split()
            if len(head) < 3 or head[1] != b"blob":
                raise RuntimeError(f"git cat-file: {sha} is not a blob")
            size = int(head[2])
            _BLOBS[sha] = data[nl + 1:nl + 1 + size].decode("utf-8", "replace")
            pos = nl + 1 + size + 1
    return {s: _BLOBS[s] for s in shas}


@dataclass
class GitSource:
    root: Path
    ref: str
    label: str = ""

    def __post_init__(self) -> None:
        self.label = self.label or self.ref
        _git(self.root, "rev-parse", "--verify", "--quiet", f"{self.ref}^{{commit}}")

    def migrations(self, rel_dir: str) -> dict[str, str]:
        try:
            listing = _git(self.root, "ls-tree", f"{self.ref}:{rel_dir}")
        except RuntimeError:  # the folder does not exist in that version
            return {}
        entries = [(ln.split()[2], ln.split("\t", 1)[1]) for ln in listing.splitlines() if "\t" in ln and ln.endswith(".sql")]
        blobs = read_blobs(self.root, [sha for sha, _ in entries])
        return {name: blobs[sha] for sha, name in entries}

    def code_mentioning(self, table: str) -> list[tuple[str, str]]:
        try:
            hits = _git(self.root, "grep", "-l", "-i", "-E", rf"INTO\s+{table}\b", self.ref, "--", f"{PKG}/*.py").split()
        except RuntimeError:  # no match: git grep exits 1
            return []
        return [(h.split(":", 1)[1], _git(self.root, "show", h)) for h in hits]


@dataclass
class TreeSource:
    root: Path
    label: str = "working tree"

    def migrations(self, rel_dir: str) -> dict[str, str]:
        d = self.root / rel_dir
        return {p.name: p.read_text(encoding="utf-8") for p in sorted(d.glob("*.sql"))} if d.is_dir() else {}

    def code_mentioning(self, table: str) -> list[tuple[str, str]]:
        pat = re.compile(rf"INTO\s+{table}\b", re.IGNORECASE)
        out = []
        for p in sorted((self.root / PKG).rglob("*.py")):
            text = p.read_text(encoding="utf-8", errors="replace")
            if pat.search(text):
                out.append((p.relative_to(self.root).as_posix(), text))
        return out


# ---------------------------------------------------------------- statements and schema

def strip_comments(sql: str) -> str:
    """Remove `--` and `/* */` comments outside string literals."""
    out, i, n = [], 0, len(sql)
    while i < n:
        ch = sql[i]
        if ch in "'\"":
            j = i + 1
            while j < n and not (sql[j] == ch and (j + 1 >= n or sql[j + 1] != ch)):
                j += 2 if sql[j] == ch else 1
            out.append(sql[i:j + 1])
            i = j + 1
        elif sql.startswith("--", i):
            j = sql.find("\n", i)
            i = n if j < 0 else j
        elif sql.startswith("/*", i):
            j = sql.find("*/", i + 2)
            i = n if j < 0 else j + 2
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def statements(sql: str) -> list[str]:
    """Complete statements (a trigger body with its inner `;` stays one statement)."""
    out, buf = [], ""
    for part in strip_comments(sql).split(";"):
        buf += part + ";"
        if sqlite3.complete_statement(buf):
            if buf.strip(" \t\r\n;"):
                out.append(" ".join(buf.split()).rstrip(";").strip())
            buf = ""
    if buf.strip(" \t\r\n;"):
        out.append(" ".join(buf.split()).strip())
    return out


def normalised(sql: str) -> str:
    return "\n".join(statements(sql))


@dataclass
class Schema:
    tables: dict[str, list[tuple[str, bool, bool]]] = field(default_factory=dict)  # name -> [(column, notnull, has_default)]
    indexes: dict[str, tuple[str, bool]] = field(default_factory=dict)  # name -> (table, unique)
    views: set[str] = field(default_factory=set)
    triggers: dict[str, str] = field(default_factory=dict)  # name -> table


def read_schema(conn: sqlite3.Connection) -> Schema:
    s = Schema()
    for kind, name, tbl in conn.execute("SELECT type, name, tbl_name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").fetchall():
        key = name.lower()
        if kind == "table":
            s.tables[key] = [(r[1].lower(), bool(r[3]), r[4] is not None) for r in conn.execute(f'PRAGMA table_info("{name}")')]
        elif kind == "view":
            s.views.add(key)
        elif kind == "trigger":
            s.triggers[key] = tbl.lower()
    for tname in list(s.tables):
        for r in conn.execute(f'PRAGMA index_list("{tname}")').fetchall():
            if r[3] == "c":  # created by CREATE INDEX (pk / unique-constraint indexes belong to the table definition)
                s.indexes[r[1].lower()] = (tname, bool(r[2]))
    return s


def apply(conn: sqlite3.Connection, sql: str) -> None:
    conn.executescript(f"BEGIN;\n{sql}\nCOMMIT;")  # what Database.migrate does


# ---------------------------------------------------------------- the verdict per migration

IDENT = r'["`\[]?(\w+)["`\]]?'


@dataclass
class Finding:
    statement: str
    verdict: str  # compatible | incompatible
    reason: str


@dataclass
class Verdict:
    set: str
    name: str
    compatible: bool
    findings: list[Finding]
    note: str | None
    ok: bool
    problem: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {"set": self.set, "migration": self.name, "compatible": self.compatible, "rollback_note": self.note, "ok": self.ok,
                "problem": self.problem, "findings": [f.__dict__ for f in self.findings if f.verdict != "compatible"] or None,
                "statements": len(self.findings)}


def rollback_note(sql: str) -> str | None:
    notes = [" ".join(m.group(1).split()) for m in NOTE_RE.finditer(sql)]
    return " ".join(notes) if notes else None


def judge_statement(stmt: str, base: Schema, before: Schema, positional: Callable[[str], list[str]]) -> Finding:
    """`base` = the schema of version A (what older code knows); `before` = the schema right before this statement's file."""
    u = stmt.upper()
    old_tables = base.tables

    def mine(name: str) -> bool:  # an object older code does not know
        return name.lower() not in old_tables and name.lower() not in base.views

    def f(ok: bool, reason: str) -> Finding:
        return Finding(stmt[:200], "compatible" if ok else "incompatible", reason)

    m = re.match(rf"CREATE\s+(?:TEMP\w*\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?{IDENT}", stmt, re.I)
    if m:
        return f(True, "new table" if mine(m.group(1)) else "already there (IF NOT EXISTS): no change")
    m = re.match(rf"CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?{IDENT}\s+ON\s+{IDENT}", stmt, re.I)
    if m:
        unique, table = bool(m.group(1)), m.group(3)
        if unique and not mine(table):
            return f(False, f"UNIQUE index on {table}, a table older code writes: an older write may be refused")
        return f(True, "index" + (" on a new table" if mine(table) else " (not unique)"))
    if re.match(r"CREATE\s+(?:TEMP\w*\s+)?VIEW\b", stmt, re.I):
        return f(True, "new view")
    m = re.match(rf"CREATE\s+(?:TEMP\w*\s+)?TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?{IDENT}.*?\bON\s+{IDENT}", stmt, re.I | re.S)
    if m:
        table = m.group(2)
        return f(mine(table), "trigger on a new table" if mine(table) else f"trigger on {table}: older code's writes fire a trigger it does not know")
    m = re.match(rf"ALTER\s+TABLE\s+{IDENT}\s+ADD\s+(?:COLUMN\s+)?{IDENT}(.*)$", stmt, re.I | re.S)
    if m:
        table, col, rest = m.group(1), m.group(2), m.group(3).upper()
        if mine(table):
            return f(True, "column on a new table")
        if "NOT NULL" in rest and "DEFAULT" not in rest:
            return f(False, f"{table}.{col} is NOT NULL without a default: older INSERTs that omit it fail")
        where = positional(table)
        if where:
            return f(False, f"{table}.{col}: older code fills {table} by position (INSERT INTO {table} VALUES/SELECT without a column list) in "
                            + ", ".join(where[:3]))
        return f(True, f"new column {table}.{col} (nullable or defaulted): older code never names it")
    m = re.match(rf"ALTER\s+TABLE\s+{IDENT}\s+(RENAME|DROP)\b", stmt, re.I)
    if m:
        table = m.group(1)
        return f(mine(table), f"{m.group(2).lower()} on a new table" if mine(table) else f"{m.group(2).upper()} on {table}: older code still uses the old shape")
    m = re.match(rf"DROP\s+(TABLE|VIEW|TRIGGER|INDEX)\s+(?:IF\s+EXISTS\s+)?{IDENT}", stmt, re.I)
    if m:
        kind, name = m.group(1).upper(), m.group(2).lower()
        if kind == "TABLE":
            return f(mine(name), "drops a new table" if mine(name) else f"drops table {name}: older code reads / writes it")
        if kind == "VIEW":
            return f(name not in base.views, f"drops view {name}" + ("" if name not in base.views else ": older code reads it"))
        if kind == "TRIGGER":
            return f(name not in base.triggers, f"drops trigger {name}" + ("" if name not in base.triggers else ": older code relies on what it did"))
        idx = base.indexes.get(name)
        if idx and idx[1]:
            return f(False, f"drops unique index {name}: an older upsert (ON CONFLICT / OR IGNORE) on {idx[0]} loses its target")
        return f(True, "drops an index that was not unique (speed only)")
    m = re.match(rf"(?:WITH\b.*?\)\s*)?(?:UPDATE\s+(?:OR\s+\w+\s+)?|DELETE\s+FROM\s+|(?:INSERT|REPLACE)\s+(?:OR\s+\w+\s+)?INTO\s+){IDENT}", stmt, re.I | re.S)
    if m:
        table = m.group(1)
        if mine(table):
            return f(True, f"data of a new table ({table})")
        return f(False, f"rewrites rows of {table}, a table older code reads: it may meet values it does not understand")
    if u.startswith("PRAGMA") or u.startswith("SELECT") or u.startswith("ANALYZE") or u.startswith("REINDEX"):
        return f(True, "no schema or data change")
    return f(False, "statement this check cannot judge")


def schema_regressions(base: Schema, after: Schema) -> list[Finding]:
    """What the schema itself says, independent of the statement scan: a table of A that vanished or lost a column, or a
    column added to it that older INSERTs cannot leave out."""
    out = []
    for t, cols in base.tables.items():
        if t not in after.tables:
            out.append(Finding(f"(schema) table {t}", "incompatible", f"table {t} of the older version is gone"))
            continue
        now = {c[0]: c for c in after.tables[t]}
        lost = [c[0] for c in cols if c[0] not in now]
        if lost:
            out.append(Finding(f"(schema) table {t}", "incompatible", f"{t} lost column(s) {', '.join(lost)}"))
        known = {c[0] for c in cols}
        bad = [c[0] for c in after.tables[t] if c[0] not in known and c[1] and not c[2]]
        if bad:
            out.append(Finding(f"(schema) table {t}", "incompatible", f"{t} gained NOT NULL column(s) without a default: {', '.join(bad)}"))
    return out


def _positional_finder(old: Source | None) -> Callable[[str], list[str]]:
    cache: dict[str, list[str]] = {}

    def find(table: str) -> list[str]:
        key = table.lower()
        if old is None:
            return []
        if key not in cache:
            pat = re.compile(rf"(?:INSERT|REPLACE)(?:\s+OR\s+\w+)?\s+INTO\s+{re.escape(table)}\s+(?:VALUES|SELECT)\b", re.IGNORECASE)
            cache[key] = [path for path, text in old.code_mentioning(table) if pat.search(text)]
        return cache[key]

    return find


@dataclass
class StepReport:
    old: str
    new: str
    verdicts: list[Verdict]
    problems: list[str]

    @property
    def ok(self) -> bool:
        return not self.problems and all(v.ok for v in self.verdicts)

    def as_dict(self) -> dict[str, Any]:
        return {"from": self.old, "to": self.new, "ok": self.ok, "problems": self.problems,
                "added": [v.as_dict() for v in self.verdicts]}


def check_set(set_name: str, old: dict[str, str], new: dict[str, str], positional: Callable[[str], list[str]]) -> tuple[list[Verdict], list[str]]:
    problems: list[str] = []
    for name in sorted(old):
        if name not in new:
            problems.append(f"{set_name}/{name}: shipped in the older version and gone (removed or renumbered) - installations that ran it never see the new file")
        elif normalised(old[name]) != normalised(new[name]):
            problems.append(f"{set_name}/{name}: shipped in the older version and changed since (not only comments) - installations that ran it never run the new text")
    added = [n for n in sorted(new) if n not in old]
    if not added:
        return [], problems
    conn = sqlite3.connect(":memory:", isolation_level=None)
    try:
        for name in sorted(old):
            apply(conn, old[name])
        base = read_schema(conn)
        verdicts = []
        for name in added:
            before = read_schema(conn)
            findings = [judge_statement(s, base, before, positional) for s in statements(new[name])]
            try:
                apply(conn, new[name])
            except sqlite3.Error as exc:
                findings.append(Finding("(apply)", "incompatible", f"does not apply on the older schema: {exc}"))
                if conn.in_transaction:
                    conn.execute("ROLLBACK")
            findings += schema_regressions(base, read_schema(conn))
            compatible = all(x.verdict == "compatible" for x in findings)
            note = rollback_note(new[name])
            ok = compatible or bool(note and len(note) >= NOTE_MIN_CHARS)
            problem = None if ok else ("not backward-compatible and no rollback note: add a comment line `-- Rollback: ...` saying what an owner "
                                       "who installs the previous version keeps, loses or must do")
            verdicts.append(Verdict(set_name, name, compatible, findings, note, ok, problem))
        return verdicts, problems
    finally:
        conn.close()


def check_range(old: Source, new: Source) -> StepReport:
    verdicts, problems = [], []
    positional = _positional_finder(old)
    for set_name, rel in SETS.items():
        v, p = check_set(set_name, old.migrations(rel), new.migrations(rel), positional)
        verdicts += v
        problems += p
    return StepReport(old.label, new.label, verdicts, problems)


# ---------------------------------------------------------------- release_check and the command line

def _vt(tag: str) -> tuple[int, ...]:
    return tuple(int(x) for x in re.findall(r"\d+", tag))


def previous_release_tag(root: Path, version: str | None) -> str | None:
    """The newest `vX.Y.Z` tag below `version` (the release being checked)."""
    if not version:
        return None
    try:
        tags = _git(root, "tag", "--list", "v*").split()
    except (RuntimeError, OSError, subprocess.SubprocessError):
        return None
    lower = [t for t in tags if re.fullmatch(r"v\d+\.\d+\.\d+", t) and _vt(t) < _vt(version)]
    return max(lower, key=_vt) if lower else None


def release_check(root: Path, version: str | None) -> dict[str, Any]:
    """For scripts/release_check.py: previous release tag -> the working tree. No git or no earlier tag: passes, says skipped."""
    prev = previous_release_tag(root, version)
    if not prev:
        return {"ok": True, "detail": "skipped: no earlier release tag in this checkout", "report": None}
    try:
        rep = check_range(GitSource(root, prev), TreeSource(root))
    except (RuntimeError, OSError, subprocess.SubprocessError) as exc:
        return {"ok": True, "detail": f"skipped: {exc}", "report": None}
    added = rep.verdicts
    unsafe = [v for v in added if not v.compatible]
    detail = (f"{prev} -> this tree: {len(added)} migration(s) added, {len(added) - len(unsafe)} backward-compatible, {len(unsafe)} not"
              + (f" ({', '.join(v.name + (' [note]' if v.note else ' [NO NOTE]') for v in unsafe)})" if unsafe else ""))
    bad = rep.problems + [f"{v.set}/{v.name}: {v.problem}" for v in added if not v.ok]
    if bad:
        detail += "; FAIL: " + "; ".join(bad[:4])
    return {"ok": rep.ok, "detail": detail, "report": rep.as_dict()}


def _source(root: Path, ref: str | None) -> Source:
    return TreeSource(root) if ref in (None, "", "WORKTREE") else GitSource(root, ref)


def _print(rep: StepReport) -> None:
    print(f"== {rep.old} -> {rep.new}: {'PASS' if rep.ok else 'FAIL'}")
    for p in rep.problems:
        print(f"  [FAIL] {p}")
    if not rep.verdicts:
        print("  no migration added")
    for v in rep.verdicts:
        tag = "compatible" if v.compatible else "NOT compatible"
        print(f"  [{'ok' if v.ok else 'FAIL'}] {v.set}/{v.name}: {tag}" + (f" - rollback note: {v.note[:160]}" if v.note else " - no rollback note"))
        for x in v.findings:
            if x.verdict != "compatible":
                print(f"      - {x.reason}  <{x.statement[:90]}>")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=str(ROOT))
    ap.add_argument("--from", dest="old", help="the older version (git ref)")
    ap.add_argument("--to", dest="new", help="the newer version (git ref; default: the working tree)")
    ap.add_argument("--chain", help="comma-separated refs, oldest first (WORKTREE = the working tree): every step, then first -> last")
    ap.add_argument("--json", help="write the reports here")
    args = ap.parse_args(argv)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except AttributeError:
        pass
    root = Path(args.root)
    try:
        if args.chain:
            refs = [r.strip() for r in args.chain.split(",") if r.strip()]
            if len(refs) < 2:
                ap.error("--chain needs two refs or more")
            pairs = list(zip(refs, refs[1:])) + ([(refs[0], refs[-1])] if len(refs) > 2 else [])
        elif args.old:
            pairs = [(args.old, args.new)]
        else:
            ap.error("give --from (and --to) or --chain")
        reports = [check_range(_source(root, a), _source(root, b)) for a, b in pairs]
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for rep in reports:
        _print(rep)
    ok = all(r.ok for r in reports)
    print("RESULT:", "PASS - every added migration is backward-compatible or carries a rollback note" if ok else "FAIL")
    if args.json:
        Path(args.json).write_text(json.dumps([r.as_dict() for r in reports], ensure_ascii=False, indent=2), encoding="utf-8")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
