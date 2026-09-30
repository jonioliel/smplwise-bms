"""Migration files: unique numbers (two branches must never both ship an NNNN), and the T082 groups migration applied
to a database that already holds groups keeps them (revision 1) and the API works on them at once."""
from __future__ import annotations

import shutil
from collections import Counter

from fastapi.testclient import TestClient

from smplwise import db as dbmod
from smplwise.main import create_app


def test_migration_numbers_are_unique():
    numbers = [int(f.name.split("_", 1)[0]) for f in dbmod.MIGRATIONS_DIR.glob("*.sql")]
    dup = sorted(n for n, k in Counter(numbers).items() if k > 1)
    assert not dup, f"duplicate migration numbers: {dup}"


def test_review_m2_the_start_up_guard_creates_the_objects_of_0036_and_0037_whatever_schema_migrations_says(settings, caplog):
    """A database that recorded 36 and 37 from ANOTHER numbering (another branch shipped those numbers first) never runs ours:
    the alarm tables, ha_entities.config_entry_id and user_prefs are missing while schema_migrations says done. Start-up
    verifies the objects themselves, creates what is missing, warns, and is idempotent."""
    import logging

    database = dbmod.Database(settings.db_path)
    applied = database.migrate()
    assert 36 in applied and 37 in applied
    assert database.ensure_migration_objects() == [], "a healthy database: nothing to do, nothing logged"
    with database.connection() as conn:
        conn.execute("INSERT INTO ha_entities(entity_id, domain, state_seen_at, first_seen_at, updated_at) VALUES ('switch.x', 'switch', 't', 't', 't')")
        for t in ("alarm_zone_overrides", "alarm_panel_codes", "alarm_user_policy", "alarm_lockouts", "user_prefs"):
            conn.execute(f"DROP TABLE {t}")
        conn.execute("ALTER TABLE ha_entities DROP COLUMN config_entry_id")
        assert {v for (v,) in conn.execute("SELECT version FROM schema_migrations")} >= {36, 37}
    assert database.migrate() == [], "recorded as applied: the migrations do not run again"
    with caplog.at_level(logging.WARNING, logger="smplwise"):
        c = TestClient(create_app(settings))
    assert any("schema guard created" in r.getMessage() and "user_prefs" in r.getMessage() for r in caplog.records)
    with database.connection() as conn:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        assert {"alarm_zone_overrides", "alarm_panel_codes", "alarm_user_policy", "alarm_lockouts", "user_prefs"} <= tables
        assert "config_entry_id" in {r[1] for r in conn.execute("PRAGMA table_info(ha_entities)")}
        assert conn.execute("SELECT entity_id FROM ha_entities").fetchone()[0] == "switch.x", "existing rows are untouched"
        conn.execute("INSERT INTO user_prefs(user_id, key, value_json, updated_at) VALUES ('u', 'nav.order', '[]', 't')")  # and they work
        conn.execute("INSERT INTO alarm_lockouts(key, until_epoch) VALUES ('user:u', 1.0)")
    assert database.ensure_migration_objects() == [], "idempotent"
    assert c.get("/api/v1/alarm/panels").status_code in (200, 403) and c.get("/api/v1/me/prefs").status_code == 200


def test_group_revision_migration_on_existing_groups(settings, tmp_path, monkeypatch):
    real = dbmod.MIGRATIONS_DIR
    target = next(f for f in real.glob("*.sql") if f.name.endswith("_group_revision.sql"))
    number = int(target.name.split("_", 1)[0])
    older = tmp_path / "older"
    older.mkdir()
    for f in real.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) < number:
            shutil.copy(f, older / f.name)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", older)
    database = dbmod.Database(settings.db_path)
    database.migrate()
    with database.connection() as conn:
        conn.execute("INSERT INTO groups(id, name, created_at, created_by) VALUES ('g-old', 'קבוצה ותיקה', '2026-01-01T00:00:00Z', 'x')")
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real)
    assert number in dbmod.Database(settings.db_path).migrate()
    with database.connection() as conn:
        row = conn.execute("SELECT revision, updated_at FROM groups WHERE id = 'g-old'").fetchone()
    assert row["revision"] == 1 and row["updated_at"] is None
    c = TestClient(create_app(settings))
    g = c.get("/api/v1/access/groups").json()["groups"]
    assert [(x["id"], x["revision"]) for x in g] == [("g-old", 1)]
    assert c.patch("/api/v1/access/groups/g-old", json={"name": "שם חדש", "revision": 1}).json()["revision"] == 2
