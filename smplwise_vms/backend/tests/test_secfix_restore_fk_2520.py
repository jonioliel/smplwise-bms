"""SEC-FIX-2520 / DEEP-REVIEW-2520-BACKEND-CORE CORE-01: a `replace` restore failed with a foreign-key error (500, nothing restored)
on any installation holding a maintenance file: `maint_files` (never in an archive) references `maint_tasks` (a project table) with no
ON DELETE rule, so emptying `maint_tasks` was refused. The restore now finds the tables outside the archive that point into it from
the schema itself (transitively), checks the foreign keys at the end of the restore, removes the rows whose parent did not come back
(reported as `dependents_dropped`), refuses (409, rolled back) an archive whose own rows point at missing parents, and the restore
drill repeats the restore onto a copy of the live database so a populated installation is tested too.

A scratch data directory with the real migrations (and one app instance for the routes); no network."""
from __future__ import annotations

import json
import zipfile

import pytest
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import backup as svc
from smplwise.services import backup_drill as drill

NOW = "2026-11-25T10:00:00+00:00"


def _db(settings) -> Database:
    db = Database(settings.db_path)
    db.migrate()
    db.ensure_migration_objects()
    return db


def _task(conn, tid: str, title: str) -> None:
    conn.execute("INSERT INTO maint_tasks(id, kind, title, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                 (tid, "certificate", title, "dev-joni", NOW, NOW))


def _file(conn, fid: str, tid: str, deleted: bool = False) -> None:
    conn.execute("INSERT INTO maint_files(id, task_id, kind, path, sha256, bytes, uploaded_by, uploaded_at, deleted_at) VALUES (?,?,?,?,?,?,?,?,?)",
                 (fid, tid, "pdf", f"{tid}/{fid}.pdf", "0" * 64, 10, "dev-joni", NOW, NOW if deleted else None))


def _populated_archive(settings, db: Database) -> str:
    with db.connection() as conn:
        _task(conn, "t-1", "Fire certificate")
        entry = svc.create(settings, conn, "manual")
    with db.connection() as conn:  # after the archive: a file of t-1, a newer task t-2 with a (soft-deleted) file
        _file(conn, "f-1", "t-1")
        conn.execute("UPDATE maint_tasks SET title = 'renamed later' WHERE id = 't-1'")
        _task(conn, "t-2", "Elevator inspection")
        _file(conn, "f-2", "t-2", deleted=True)
    return entry["name"]


def test_the_dependents_come_from_the_schema(settings):
    db = _db(settings)
    with db.connection() as conn:
        tables = [t for t in svc.PROJECT_TABLES if t in svc._tables(conn)]
        assert "maint_files" in svc.restore_dependents(conn, tables)
        # a table added later that points at maint_files (a dependent of a dependent) is found the same way
        conn.execute("CREATE TABLE secfix_probe (id TEXT PRIMARY KEY, file_id TEXT NOT NULL REFERENCES maint_files(id))")
        deps = svc.restore_dependents(conn, tables)
        assert deps.index("maint_files") < deps.index("secfix_probe")
        assert not set(deps) & set(tables)


@pytest.mark.parametrize("scope", ["project", "project+access"])
def test_a_replace_restore_over_a_database_with_maintenance_files_succeeds(settings, scope):
    db = _db(settings)
    name = _populated_archive(settings, db)
    with db.connection() as conn:
        out = svc.restore(settings, conn, svc.backups_dir(settings) / name, mode="replace", scope=scope, process_hooks=False)
    assert out["tables"]["maint_tasks"] == 1
    assert out["dependents_dropped"] == {"maint_files": 1}  # f-2: its task t-2 is not in the archive
    with db.connection(mode="read") as conn:
        assert [tuple(r) for r in conn.execute("SELECT id, title FROM maint_tasks ORDER BY id")] == [("t-1", "Fire certificate")]
        assert [r[0] for r in conn.execute("SELECT id FROM maint_files ORDER BY id")] == ["f-1"]  # the file of a restored task stays
        assert conn.execute("PRAGMA foreign_key_check").fetchall() == []


def test_a_dependent_of_a_dependent_follows(settings):
    db = _db(settings)
    name = _populated_archive(settings, db)
    with db.connection() as conn:
        conn.execute("CREATE TABLE secfix_probe (id TEXT PRIMARY KEY, file_id TEXT NOT NULL REFERENCES maint_files(id))")
        conn.execute("INSERT INTO secfix_probe VALUES ('p-1', 'f-1'), ('p-2', 'f-2')")
    with db.connection() as conn:
        out = svc.restore(settings, conn, svc.backups_dir(settings) / name, mode="replace", scope="project", process_hooks=False)
    assert out["dependents_dropped"] == {"maint_files": 1, "secfix_probe": 1}
    with db.connection(mode="read") as conn:
        assert [r[0] for r in conn.execute("SELECT id FROM secfix_probe")] == ["p-1"]


def test_an_archive_whose_own_rows_point_at_missing_parents_is_refused_and_nothing_changes(settings):
    app = create_app(settings)
    c = TestClient(app)
    db = app.state.db
    with db.connection() as conn:
        _task(conn, "t-1", "Fire certificate")
        entry = svc.create(settings, conn, "manual")
    src = svc.backups_dir(settings) / entry["name"]
    bad = svc.backups_dir(settings) / "orphan.zip"
    record = {"id": "r-1", "task_id": "t-missing", "kind": "completion", "status": "done", "started_by": "dev-joni", "started_at": NOW}
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(bad, "w") as zout:
        for info in zin.infolist():
            body = zin.read(info.filename)
            if info.filename == "data/maint_records.json":
                body = json.dumps([record]).encode("utf-8")
            zout.writestr(info.filename, body)
        if "data/maint_records.json" not in zin.namelist():
            zout.writestr("data/maint_records.json", json.dumps([record]))
    with db.connection() as conn:
        _file(conn, "f-1", "t-1")
    r = c.post(f"/api/v1/backups/{bad.name}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert r.status_code == 409 and r.json()["code"] == "restore_refused", r.text
    assert "maint_records" in r.text  # refused by the foreign-key settle, not by another check
    with db.connection(mode="read") as conn:  # rolled back: nothing was restored, nothing was removed
        assert [r[0] for r in conn.execute("SELECT id FROM maint_tasks")] == ["t-1"]
        assert [r[0] for r in conn.execute("SELECT id FROM maint_files")] == ["f-1"]


def test_the_restore_route_answers_and_audits_the_dropped_rows(settings):
    app = create_app(settings)
    c = TestClient(app)
    db = app.state.db
    name = _populated_archive(settings, db)
    r = c.post(f"/api/v1/backups/{name}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert r.status_code == 200, r.text
    assert r.json()["dependents_dropped"] == {"maint_files": 1}
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'backup.restore' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert json.loads(row[0])["dependents_dropped"] == {"maint_files": 1}


def test_the_drill_restores_onto_a_copy_of_the_live_database_too(settings):
    db = _db(settings)
    name = _populated_archive(settings, db)
    result = drill.run_drill(settings, svc.backups_dir(settings) / name, write_result=False)
    check = next(ch for ch in result["checks"] if ch["name"] == "live_copy_restore")
    assert check["ok"] and check["detail"] == {"dependents_dropped": {"maint_files": 1}}, check
    assert result["result"] == "PASS", [ch for ch in result["checks"] if not ch["ok"]]
    assert "live_copy_restore" in result["timings_ms"]
    assert not list((settings.data_dir / drill.DRILL_DIR).glob("scratch-*"))
    with db.connection(mode="read") as conn:  # the live database is untouched
        assert [r[0] for r in conn.execute("SELECT id FROM maint_files ORDER BY id")] == ["f-1", "f-2"]
        assert conn.execute("SELECT title FROM maint_tasks WHERE id = 't-1'").fetchone()[0] == "renamed later"


def test_the_drill_fails_when_the_restore_onto_the_live_copy_fails(settings, monkeypatch):
    db = _db(settings)
    name = _populated_archive(settings, db)
    real = svc.restore
    calls = []

    def restore(*a, **kw):
        calls.append(1)
        if len(calls) == 2:  # the second restore of the drill is the one onto the live copy
            raise ValueError("refused on the live copy")
        return real(*a, **kw)

    monkeypatch.setattr(svc, "restore", restore)
    result = drill.run_drill(settings, svc.backups_dir(settings) / name, write_result=False)
    assert result["result"] == "FAIL" and [c["name"] for c in result["checks"] if not c["ok"] and c["severity"] == "fail"] == ["live_copy_restore"]
