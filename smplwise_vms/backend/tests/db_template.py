"""Pre-migrated SQLite template for the backend tests (GATESPEED-293 phase 2).

Every test app (`create_app`) starts on an empty data directory and runs all migrations (127 SQL files, one fsynced
transaction each): about 0.5-2 s per test on the runner, most of the backend suite's time. With the template the migrations run
ONCE per pytest process into a template file; every fresh test database then receives a page copy of it (SQLite backup API) at
the exact moment `create_app` calls `Database.migrate()`. Everything before that call (the pre-upgrade backup check, the update
runs' early boot count) and everything after it (schema guards, seeding, start-up jobs) runs unchanged on the test's own file.

Identical results (proved by tests/test_db_template.py): the same sqlite_master, the same file-level pragmas, the same rows in
every table. The only values migrations derive from the clock (`strftime(..., 'now')`, `schema_migrations.applied_at`) are
re-stamped to the copy time, so a test sees "now" as it would after a real migration.

Where the template is NOT used (the real migration path runs):
  * SW_TEST_DB_TEMPLATE=0 (the fallback switch; the nightly or anyone can force the per-test path);
  * any `Database.migrate()` call that does not come from `create_app` (tests/test_migrations*.py and every test that migrates
    a database itself keep exercising the SQL files);
  * a database that is not empty (an upgrade or restart test keeps its own data and runs the real loop);
  * a test that points `MIGRATIONS_DIR` elsewhere (an older subset for an upgrade test) - the template holds the full set;
  * a template that cannot be built or that has a trigger on a re-stamped table (then nothing is patched).
"""
from __future__ import annotations

import atexit
import datetime as dt
import os
import shutil
import re
import sqlite3
import sys
import tempfile
import threading
from contextlib import closing
from pathlib import Path

STAMP = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")
_LOCK = threading.Lock()
_TPL: dict | None = None
STATS = {"copies": 0, "real": 0}


def enabled() -> bool:
    return os.environ.get("SW_TEST_DB_TEMPLATE", "1") != "0"


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _q(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def is_fresh(path: Path) -> bool:
    """No schema object at all (the file may exist: the early boot count opens it before the migrations)."""
    if not Path(path).exists():
        return True
    with closing(sqlite3.connect(path)) as c:
        return c.execute("SELECT count(*) FROM sqlite_master").fetchone()[0] == 0


def stamped_values(path: Path, lo: str, hi: str) -> list[tuple[str, str, str]]:
    """(table, column, value) of every TEXT value that looks like a UTC second stamp inside [lo, hi]: what the migrations took
    from the clock while the template was built (nothing else has written to the file)."""
    out: list[tuple[str, str, str]] = []
    with closing(sqlite3.connect(path)) as c:
        tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")]
        for t in tables:
            cols = [r[1] for r in c.execute(f"PRAGMA table_info({_q(t)})")]
            for col in cols:
                for (v,) in c.execute(f"SELECT DISTINCT {_q(col)} FROM {_q(t)} WHERE typeof({_q(col)}) = 'text' AND {_q(col)} BETWEEN ? AND ?", (lo, hi)):
                    if STAMP.match(v):
                        out.append((t, col, v))
    return out


def triggers_on(path: Path, tables: set[str]) -> list[str]:
    with closing(sqlite3.connect(path)) as c:
        return [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name IN (%s)" % ",".join("?" * len(tables)), tuple(tables))] if tables else []


def build(real_migrate, db_cls, where: Path | None = None) -> dict:
    """Run the real migrations once into a template file. Returns {path, versions, stamps}."""
    if where is None:
        d = Path(tempfile.mkdtemp(prefix="sw_db_template_"))
        atexit.register(shutil.rmtree, d, True)
    else:
        d = Path(where)
    path = d / "template.db"
    lo = _now()
    versions = real_migrate(db_cls(path))
    hi = _now()
    stamps = stamped_values(path, lo, hi)
    trig = triggers_on(path, {t for t, _, _ in stamps})
    if trig:
        raise RuntimeError(f"triggers on re-stamped tables: {trig}")
    with closing(sqlite3.connect(path)) as c:
        c.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    return {"path": path, "versions": list(versions), "stamps": stamps}


def copy_into(tpl: dict, target: Path) -> None:
    """Page copy of the template into the (empty) target, then the clock-derived values re-stamped to now."""
    with closing(sqlite3.connect(tpl["path"])) as src, closing(sqlite3.connect(target, isolation_level=None)) as dst:
        src.backup(dst)
        if tpl["stamps"]:
            now = _now()
            dst.execute("BEGIN")
            for t, col, old in tpl["stamps"]:
                dst.execute(f"UPDATE {_q(t)} SET {_q(col)} = ? WHERE {_q(col)} = ?", (now, old))
            dst.execute("COMMIT")


def install(db_cls) -> bool:
    """Patch db_cls.migrate (once per process). Returns True when patched."""
    if not enabled() or getattr(db_cls.migrate, "_sw_template", False):
        return False
    real = db_cls.migrate
    dbmod = sys.modules[db_cls.__module__]
    real_dir = Path(dbmod.MIGRATIONS_DIR)

    def migrate(self):  # noqa: ANN001 - same signature as Database.migrate
        global _TPL
        caller = sys._getframe(1).f_code
        # integ/2100: a test that monkeypatches MIGRATIONS_DIR (an "old database, then upgrade" test: test_cameras, test_anchor_3d,
        # test_tickets_258_review) must get exactly the migrations of that directory - never the full template
        if Path(dbmod.MIGRATIONS_DIR) != real_dir:
            STATS["real"] += 1
            return real(self)
        if not enabled() or not (caller.co_name == "create_app" and caller.co_filename.replace("\\", "/").endswith("smplwise/main.py")) or not is_fresh(self.path):
            STATS["real"] += 1
            return real(self)
        with _LOCK:
            if _TPL is None:
                try:
                    _TPL = build(real, db_cls)
                except Exception:  # noqa: BLE001 - no template, the real path for the whole run
                    _TPL = {}
        if not _TPL:
            STATS["real"] += 1
            return real(self)
        copy_into(_TPL, self.path)
        STATS["copies"] += 1
        extra = real(self)   # the real loop: applies nothing (every version is recorded) unless a file appeared since the build
        return list(_TPL["versions"]) + list(extra)

    migrate._sw_template = True
    migrate._sw_real = real
    db_cls.migrate = migrate
    return True
