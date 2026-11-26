"""CORE-RELIABILITY-2540, deep review CORE-05: the daily and the manual backup held the single write lock while the whole
archive was compressed (plan files, the energy / water copies), so on a large installation every waiting writer failed with
"database is locked". Now the snapshot is read under a transaction and the archive is written with the write lock free; the
restore's safety archive keeps being written under the restore's own lock (the way back is the state right before it).

The proof: while the archive is being written, another thread takes a write transaction with a short wait - it gets it."""
from __future__ import annotations

import threading

from fastapi.testclient import TestClient

from smplwise.db import Database, get_setting, set_setting
from smplwise.main import create_app
from smplwise.services import backup as svc


def _probe_writer(db: Database) -> dict:
    """In another thread (another worker): one short write with at most 1 s of waiting for the lock."""
    out: dict = {}

    def run() -> None:
        try:
            with db.write_aside(label="core05 probe", wait_s=1.0) as conn:
                set_setting(conn, "test.core05_probe", "written")
            out["ok"] = True
        except Exception as exc:  # noqa: BLE001 - the answer of the probe
            out["ok"] = False
            out["error"] = f"{type(exc).__name__}: {exc}"

    t = threading.Thread(target=run)
    t.start()
    t.join(15)
    return out


def _watch_write_zip(monkeypatch, db: Database) -> list[dict]:
    seen: list[dict] = []
    real = svc.write_zip

    def watched(*a, **kw):
        seen.append(_probe_writer(db))  # the archive is about to be compressed: is the write lock free now?
        return real(*a, **kw)

    monkeypatch.setattr(svc, "write_zip", watched)
    return seen


def test_core05_the_daily_backup_writes_its_archive_without_the_write_lock(settings, monkeypatch):
    app = create_app(settings)
    db = app.state.db
    seen = _watch_write_zip(monkeypatch, db)
    e = svc.create_standalone(settings, db, "auto-daily", "daily")
    assert e["kind"] == "auto-daily"
    assert seen == [{"ok": True}], seen  # before the fix: "database is locked" - the daily backup held the write transaction
    with db.connection(mode="read") as conn:
        assert get_setting(conn, "test.core05_probe") == "written"


def test_core05_the_manual_backup_writes_its_archive_without_the_write_lock_and_still_audits(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    seen = _watch_write_zip(monkeypatch, app.state.db)
    r = c.post("/api/v1/backups", json={"note": "core05"})
    assert r.status_code == 201, r.text
    assert seen == [{"ok": True}], seen
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM audit_log WHERE action = 'backup.create' ORDER BY at DESC").fetchone()
    assert row is not None and row["resource_id"] == r.json()["name"] and row["decision"] == "allowed"


def test_core05_the_snapshot_is_the_state_at_its_read_not_what_was_written_while_compressing(settings, monkeypatch):
    """A write that lands while the archive is compressed is not in it (the snapshot was taken first) - and it is kept."""
    app = create_app(settings)
    db = app.state.db
    with db.connection() as conn:
        set_setting(conn, "ui.design", "b")
    real = svc.write_zip

    def racing(*a, **kw):
        with db.write_aside(label="core05 race", wait_s=1.0) as conn:
            set_setting(conn, "ui.design", "a")
        return real(*a, **kw)

    monkeypatch.setattr(svc, "write_zip", racing)
    e = svc.create_standalone(settings, db, "manual", "race")
    import json
    import zipfile

    with zipfile.ZipFile(svc.backups_dir(settings) / e["name"]) as z:
        rows = json.loads(z.read("data/settings.json"))
    assert {r["key"]: r["value"] for r in rows}.get("ui.design") == "b"
    with db.connection(mode="read") as conn:
        assert get_setting(conn, "ui.design") == "a"


def test_core05_a_weak_backup_password_is_still_refused_before_anything_is_written(settings):
    app = create_app(settings)
    c = TestClient(app)
    r = c.post("/api/v1/backups", json={"note": "weak", "backup_password": "x"})
    assert r.status_code == 422 and r.json()["code"] == "backup_password_weak"
    assert svc.list_backups(settings) == []
