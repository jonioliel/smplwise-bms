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
