"""GATESPEED-293: the pre-migrated test database template (tests/db_template.py) gives exactly what the per-test migrations give."""
from __future__ import annotations

import dataclasses
import datetime as dt
import re
import sqlite3
from contextlib import closing
from pathlib import Path

import db_template
import pytest
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.main import create_app

# schema_version (SQLite's schema cookie, a change counter for prepared-statement invalidation) is NOT compared: a backup copy
# sets it from the destination's own counter (1) instead of the 700+ schema changes of the real path. Nothing in the product
# reads it (test_no_product_code_reads_the_schema_cookie).
PRAGMAS = ("page_size", "journal_mode", "user_version", "application_id", "auto_vacuum", "encoding")


def _real():
    return getattr(Database.migrate, "_sw_real", Database.migrate)


def _now():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def schema(path: Path):
    with closing(sqlite3.connect(path)) as c:
        return sorted(tuple(r) for r in c.execute("SELECT type, name, tbl_name, sql FROM sqlite_master"))


def pragmas(path: Path):
    with closing(sqlite3.connect(path)) as c:
        return {p: c.execute(f"PRAGMA {p}").fetchone()[0] for p in PRAGMAS}


def dump(path: Path, lo: str, hi: str):
    """Every row of every table, a clock stamp inside [lo, hi] replaced by <NOW> (the two paths ran a few seconds apart)."""
    out = {}
    with closing(sqlite3.connect(path)) as c:
        for (t,) in c.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").fetchall():
            rows = c.execute(f'SELECT * FROM "{t}"').fetchall()
            norm = [tuple("<NOW>" if isinstance(v, str) and db_template.STAMP.match(v) and lo <= v <= hi else v for v in r) for r in rows]
            out[t] = sorted(norm, key=repr)
    return out


def checks(path: Path):
    with closing(sqlite3.connect(path)) as c:
        return c.execute("PRAGMA integrity_check").fetchone()[0], c.execute("PRAGMA foreign_key_check").fetchall()


@pytest.fixture()
def window():
    lo = (_now() - dt.timedelta(seconds=2)).isoformat().replace("+00:00", "Z")
    yield lambda: (lo, (_now() + dt.timedelta(seconds=2)).isoformat().replace("+00:00", "Z"))


def test_template_copy_equals_the_real_migrations(tmp_path, window):
    real_path = tmp_path / "real" / "smplwise.db"
    versions = _real()(Database(real_path))
    tpl = db_template.build(_real(), Database, tmp_path / "tpl")
    copy_path = tmp_path / "copy" / "smplwise.db"
    Database(copy_path)                    # the data dir exists, as in create_app
    db_template.copy_into(tpl, copy_path)
    lo, hi = window()
    assert len(versions) >= 127 and tpl["versions"] == versions
    assert schema(copy_path) == schema(real_path)
    assert pragmas(copy_path) == pragmas(real_path)
    assert dump(copy_path, lo, hi) == dump(real_path, lo, hi)
    assert checks(copy_path) == ("ok", []) == checks(real_path)
    # the clock-derived values were re-stamped (schema_migrations.applied_at at least), never left at the build time
    assert tpl["stamps"] and any(t == "schema_migrations" and c == "applied_at" for t, c, _ in tpl["stamps"])
    # the real loop on the copy finds every version recorded and applies nothing
    assert _real()(Database(copy_path)) == []


def test_create_app_with_and_without_the_template_build_the_same_database(tmp_path, monkeypatch, settings):
    """End to end: create_app on the template path and on the per-test path (SW_TEST_DB_TEMPLATE=0) - same schema, pragmas,
    tables and row counts (start-up seeding after the migrations uses new ids and times, so rows are compared by count)."""
    monkeypatch.setenv("SW_TEST_DB_TEMPLATE", "1")
    if not getattr(Database.migrate, "_sw_template", False):
        pytest.skip("template not installed in this run (SW_TEST_DB_TEMPLATE=0)")
    before = db_template.STATS["copies"]
    TestClient(create_app(settings))
    assert db_template.STATS["copies"] == before + 1
    a = settings.db_path
    s2 = dataclasses.replace(settings, data_dir=tmp_path / "data_real")
    monkeypatch.setenv("SW_TEST_DB_TEMPLATE", "0")
    real_before = db_template.STATS["real"]
    TestClient(create_app(s2))
    assert db_template.STATS["real"] == real_before + 1
    b = s2.db_path
    assert schema(a) == schema(b) and pragmas(a) == pragmas(b)
    with closing(sqlite3.connect(a)) as ca, closing(sqlite3.connect(b)) as cb:
        tables = [r[0] for r in ca.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")]
        counts_a = {t: ca.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0] for t in tables}
        counts_b = {t: cb.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0] for t in tables}
    assert counts_a == counts_b


def test_direct_migrate_calls_and_non_empty_databases_take_the_real_path(tmp_path):
    before = dict(db_template.STATS)
    db = Database(tmp_path / "d" / "smplwise.db")
    applied = db.migrate()                 # a test that migrates by itself: the SQL files really run
    assert len(applied) >= 127 and db_template.STATS["copies"] == before["copies"]
    assert not db_template.is_fresh(db.path)


def test_a_patched_migrations_dir_takes_the_real_path(tmp_path, monkeypatch, settings):
    """integ/2100: an upgrade test that points MIGRATIONS_DIR at an older subset gets exactly that subset from create_app, never the
    full template (test_cameras / test_anchor_3d / test_tickets_258_review build an old database this way)."""
    import shutil

    from smplwise import db as dbmod

    monkeypatch.setenv("SW_TEST_DB_TEMPLATE", "1")
    old = tmp_path / "migrations_0022"
    old.mkdir()
    for f in dbmod.MIGRATIONS_DIR.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) <= 22:
            shutil.copy(f, old / f.name)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", old)
    before = dict(db_template.STATS)
    with TestClient(create_app(settings)):
        pass
    assert db_template.STATS["copies"] == before["copies"]
    with closing(sqlite3.connect(settings.db_path)) as c:
        assert c.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0] == 22


def test_no_product_code_reads_the_schema_cookie():
    src = Path(__file__).resolve().parents[1] / "smplwise"
    hits = [p.name for p in src.rglob("*.py") if re.search(r"pragma\s+schema_version", p.read_text(encoding="utf-8", errors="replace"), re.I)]
    assert hits == []


def test_fresh_detection(tmp_path):
    p = tmp_path / "x.db"
    assert db_template.is_fresh(p)
    with closing(sqlite3.connect(p)) as c:
        c.execute("PRAGMA journal_mode=WAL")   # what the early boot count leaves behind: a file without objects
    assert db_template.is_fresh(p)
    with closing(sqlite3.connect(p)) as c:
        c.execute("CREATE TABLE t(a)")
    assert not db_template.is_fresh(p)


def test_switch_off_means_no_patch(monkeypatch):
    monkeypatch.setenv("SW_TEST_DB_TEMPLATE", "0")
    assert db_template.enabled() is False

    class Fake:
        def migrate(self):
            return []

    assert db_template.install(Fake) is False and not getattr(Fake.migrate, "_sw_template", False)
