"""PILOT-ROLLBACK-2550 (T036): scripts/migration_downgrade_check.py - the downgrade-safety classification of the migrations a release
adds, the rollback-note rule, the shipped-migration rule, the release-check wiring, and the real 2.48 -> today range."""
from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("migration_downgrade_check", ROOT / "scripts" / "migration_downgrade_check.py")
md = importlib.util.module_from_spec(spec)
assert spec.loader
sys.modules[spec.name] = md
spec.loader.exec_module(md)

OLD = {
    "0001_core.sql": "CREATE TABLE people(id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT);\n"
                     "CREATE TABLE doors(id TEXT PRIMARY KEY, label TEXT);\n"
                     "CREATE UNIQUE INDEX people_name ON people(name);\n"
                     "CREATE INDEX doors_label ON doors(label);\n",
}


def run(added: dict[str, str], positional: list[str] | None = None, old: dict[str, str] | None = None):
    new = {**(old or OLD), **added}
    return md.check_set("main", old or OLD, new, lambda table: list(positional or []) if table == "people" else [])


def one(sql: str, **kw):
    verdicts, problems = run({"0002_x.sql": sql}, **kw)
    assert problems == []
    return verdicts[0]


@pytest.mark.parametrize("sql", [
    "CREATE TABLE visits(id TEXT PRIMARY KEY, person TEXT NOT NULL);",
    "CREATE TABLE IF NOT EXISTS doors(id TEXT PRIMARY KEY, label TEXT);",
    "ALTER TABLE people ADD COLUMN origin TEXT CHECK (origin IS NULL OR origin IN ('a', 'b'));",
    "ALTER TABLE people ADD COLUMN flags INTEGER NOT NULL DEFAULT 0;",
    "CREATE INDEX people_kind ON people(kind);",
    "CREATE INDEX people_kind_partial ON people(kind) WHERE kind IS NOT NULL;",
    "CREATE TABLE t2(a TEXT); CREATE UNIQUE INDEX t2_a ON t2(a); CREATE TRIGGER t2_trg AFTER INSERT ON t2 BEGIN UPDATE t2 SET a = a; END;",
    "CREATE TABLE copy(id TEXT, name TEXT); INSERT INTO copy(id, name) SELECT id, name FROM people;",
    "DROP INDEX doors_label;",
    "CREATE VIEW v_people AS SELECT id FROM people;",
])
def test_backward_compatible_migrations_pass_without_a_note(sql):
    v = one(sql)
    assert v.compatible and v.ok and v.problem is None, [f.reason for f in v.findings]


@pytest.mark.parametrize("sql, reason", [
    ("ALTER TABLE people RENAME COLUMN name TO full_name;", "RENAME on people"),
    ("ALTER TABLE people DROP COLUMN kind;", "DROP on people"),
    ("DROP TABLE doors;", "drops table doors"),
    ("ALTER TABLE doors RENAME TO gates;", "RENAME on doors"),
    ("CREATE UNIQUE INDEX doors_label_u ON doors(label);", "UNIQUE index on doors"),
    ("CREATE TRIGGER doors_keep BEFORE DELETE ON doors BEGIN SELECT RAISE(ABORT, 'kept'); END;", "trigger on doors"),
    ("UPDATE people SET kind = 'resident_v2' WHERE kind = 'resident';", "rewrites rows of people"),
    ("DELETE FROM doors WHERE label IS NULL;", "rewrites rows of doors"),
    ("INSERT OR IGNORE INTO doors(id, label) VALUES ('d', 'x');", "rewrites rows of doors"),
    ("DROP INDEX people_name;", "drops unique index people_name"),
    ("CREATE TABLE people_new(id TEXT PRIMARY KEY, name TEXT NOT NULL);\nINSERT INTO people_new SELECT id, name FROM people;\n"
     "DROP TABLE people;\nALTER TABLE people_new RENAME TO people;", "drops table people"),
])
def test_not_backward_compatible_migrations_fail_without_a_note(sql, reason):
    v = one(sql)
    assert not v.compatible and not v.ok and "rollback note" in v.problem
    assert any(reason in f.reason for f in v.findings), [f.reason for f in v.findings]


def test_the_schema_look_catches_a_lost_column_the_statement_scan_cannot_name():
    v = one("CREATE TABLE people_new(id TEXT PRIMARY KEY, name TEXT NOT NULL);\nDROP TABLE people;\nALTER TABLE people_new RENAME TO people;")
    assert any("lost column(s) kind" in f.reason for f in v.findings)


def test_a_new_column_on_a_table_older_code_fills_by_position_is_not_compatible():
    v = one("ALTER TABLE people ADD COLUMN origin TEXT;", positional=["smplwise/services/people.py"])
    assert not v.compatible and "by position" in v.findings[0].reason and "smplwise/services/people.py" in v.findings[0].reason


def test_a_rollback_note_makes_a_not_compatible_migration_pass_and_a_short_one_does_not():
    noted = one("-- PEOPLE-KIND-2600: the kinds are renamed.\n"
                "-- Additive otherwise. Rollback: the previous version shows 'resident_v2' people as kind unknown until the restore of the\n"
                "-- 'before update' backup; nothing else is lost.\n"
                "UPDATE people SET kind = 'resident_v2' WHERE kind = 'resident';")
    assert not noted.compatible and noted.ok and noted.note.startswith("the previous version shows")
    short = one("-- Rollback: n/a\nUPDATE people SET kind = 'x';")
    assert not short.ok, "a note under 20 characters says nothing"
    not_a_comment = one("UPDATE people SET kind = 'Rollback: this text is data, not a note at all';")
    assert not not_a_comment.ok and not_a_comment.note is None


def test_a_shipped_migration_changed_removed_or_renumbered_fails():
    old = {**OLD, "0002_doors.sql": "-- first text\nALTER TABLE doors ADD COLUMN floor TEXT;\n"}
    # only the comments changed: fine
    verdicts, problems = md.check_set("main", old, {**old, "0002_doors.sql": "-- reworded comment\nALTER TABLE doors ADD COLUMN floor TEXT;"}, lambda t: [])
    assert problems == [] and verdicts == []
    _v, problems = md.check_set("main", old, {**old, "0002_doors.sql": "ALTER TABLE doors ADD COLUMN level TEXT;"}, lambda t: [])
    assert len(problems) == 1 and "changed since" in problems[0]
    _v, problems = md.check_set("main", old, {**OLD, "0003_doors.sql": old["0002_doors.sql"]}, lambda t: [])
    assert len(problems) == 1 and "gone (removed or renumbered)" in problems[0]


def test_statements_keep_a_trigger_body_whole_and_ignore_comments_and_strings():
    sql = ("-- a; comment\nCREATE TRIGGER t AFTER INSERT ON a BEGIN\n  UPDATE a SET x = ';'; /* ; */\n  DELETE FROM b;\nEND;\n"
           "INSERT INTO c VALUES ('--not a comment');")
    out = md.statements(sql)
    assert len(out) == 2 and out[0].startswith("CREATE TRIGGER") and out[0].endswith("END") and "--not a comment" in out[1]


def test_the_release_check_skips_without_git_and_passes_on_this_tree(tmp_path):
    skipped = md.release_check(tmp_path, "9.9.9")
    assert skipped["ok"] and skipped["detail"].startswith("skipped")
    assert md.previous_release_tag(tmp_path, "9.9.9") is None


def _has_tag(tag: str) -> bool:
    return subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--verify", "--quiet", f"{tag}^{{commit}}"], capture_output=True).returncode == 0


@pytest.mark.skipif(not _has_tag("v2.48.0"), reason="the checkout has no v2.48.0 tag")
def test_the_real_range_since_2_48_is_downgrade_safe():
    """The run the row reports: v2.48.0 -> this tree. Every migration added since is backward-compatible (all additive)."""
    rep = md.check_range(md.GitSource(ROOT, "v2.48.0"), md.TreeSource(ROOT))
    assert rep.problems == [], rep.problems
    names = [v.name for v in rep.verdicts]
    assert "0217_camera_discovery_origin.sql" in names and "0226_push_subscription_sign_in.sql" in names
    assert all(v.ok for v in rep.verdicts), [v.as_dict() for v in rep.verdicts if not v.ok]
    assert md.main(["--root", str(ROOT), "--from", "v2.48.0"]) == 0
