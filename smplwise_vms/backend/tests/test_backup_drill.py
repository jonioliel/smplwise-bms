"""DATASTORE-295 part 1: the automated restore drill - a real archive restored into a scratch directory passes; a damaged,
inconsistent, newer or leaking archive fails with the check named; the live database and the process-wide lease state are
untouched; the admin-only status / run / schedule API; the monthly schedule is OFF by default; the command line."""
from __future__ import annotations

import datetime as dt
import importlib.util
import json
import shutil
import time
import zipfile
from pathlib import Path

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import Database, get_setting, set_setting
from smplwise.main import create_app
from smplwise.services import backup as svc
from smplwise.services import backup_drill as drill

REPO = Path(__file__).resolve().parents[3]


def _seed(c: TestClient) -> dict:
    ids = seed_tree(c)
    c.post("/api/v1/cameras", json={"channel": 2, "alias": "Lobby cam"})
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    assert c.patch("/api/v1/settings", json={"ui.design": "b"}).status_code == 200
    return ids


def _archive(settings, **body) -> tuple[TestClient, Path]:
    app = create_app(settings)
    c = TestClient(app)
    _seed(c)
    r = c.post("/api/v1/backups", json=body)
    assert r.status_code == 201, r.text
    return c, svc.backups_dir(settings) / r.json()["name"]


def _rewrite(src: Path, dst: Path, change: dict[str, bytes | None]) -> Path:
    """Copy an archive, replacing (bytes) or dropping (None) the named members."""
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, "w", compression=zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            if info.filename in change:
                if change[info.filename] is not None:
                    zout.writestr(info.filename, change[info.filename])
                continue
            zout.writestr(info, zin.read(info.filename))
    return dst


def _failed(result: dict) -> list[str]:
    return [c["name"] for c in result["checks"] if not c["ok"] and c["severity"] == "fail"]


def test_a_real_archive_passes_and_nothing_live_is_touched(settings):
    from smplwise.services import capture_lease

    c, archive = _archive(settings)
    with Database(settings.db_path).connection(mode="read") as conn:
        floors_before = conn.execute("SELECT COUNT(*) FROM floors").fetchone()[0]
        rev_before = conn.execute("SELECT value FROM settings WHERE key = 'permission_revision'").fetchone()
    epoch_before = capture_lease.REG.epoch_all
    result = drill.run_drill(settings)
    assert result["result"] == "PASS", (_failed(result), result)
    names = {ch["name"] for ch in result["checks"]}
    assert {"archive_crc", "integrity_check", "foreign_key_check", "migration_version", "row_counts", "kept_settings_untouched",
            "archive_without_kept_settings", "restore"} <= names
    assert result["archive"]["name"] == archive.name and len(result["archive"]["sha256"]) == 64
    assert result["tables"]["floors"] == {"archive": 2, "restored": 2, "skipped_unsafe": 0, "ok": True, "key": True}
    assert result["schema"]["restored"] == result["schema"]["code"] == drill.code_schema_version()
    assert set(result["timings_ms"]) >= {"archive_check", "scratch_schema", "restore", "verify", "total"}
    assert result["restore"]["files"] >= 2
    # the scratch copy is gone, the result is recorded, the live installation is unchanged
    assert not list((settings.data_dir / drill.DRILL_DIR).glob("scratch-*"))
    assert drill.read_last(settings)["result"] == "PASS" and drill.read_history(settings)[0]["archive"] == archive.name
    with Database(settings.db_path).connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM floors").fetchone()[0] == floors_before
        assert conn.execute("SELECT value FROM settings WHERE key = 'permission_revision'").fetchone() == rev_before
    assert capture_lease.REG.epoch_all == epoch_before, "a drill never revokes the live capture leases"


def test_an_encrypted_sensitive_section_is_skipped_not_failed(settings):
    _archive(settings, backup_password="drill-password-0123456789")
    result = drill.run_drill(settings, write_result=False)
    assert result["result"] == "PASS", _failed(result)
    assert result["archive"]["sensitive"] == "encrypted" and result["restore"]["sensitive_checked"] is False
    assert not (settings.data_dir / drill.DRILL_DIR / drill.LAST_FILE).exists(), "write_result=False records nothing"


def test_no_archive_is_a_fail(settings):
    create_app(settings)
    result = drill.run_drill(settings)
    assert result["result"] == "FAIL" and _failed(result) == ["archive_present"]


def test_a_damaged_member_fails_the_crc_check(settings, tmp_path):
    _, archive = _archive(settings)
    raw = bytearray(archive.read_bytes())
    with zipfile.ZipFile(archive) as z:
        info = z.getinfo("data/floors.json")
    # flip a byte inside the member's compressed data (local header is 30 bytes + name + extra)
    off = info.header_offset + 30 + len(info.filename.encode()) + len(info.extra) + 2
    raw[off] ^= 0xFF
    bad = tmp_path / "damaged.zip"
    bad.write_bytes(bytes(raw))
    result = drill.run_drill(settings, bad, write_result=False)
    assert result["result"] == "FAIL" and "archive_crc" in _failed(result)


def test_a_truncated_file_is_not_readable(settings, tmp_path):
    _, archive = _archive(settings)
    bad = tmp_path / "cut.zip"
    bad.write_bytes(archive.read_bytes()[:200])
    result = drill.run_drill(settings, bad, write_result=False)
    assert result["result"] == "FAIL" and _failed(result) == ["archive_readable"]


def test_a_manifest_that_disagrees_with_the_rows_fails_the_row_counts(settings, tmp_path):
    _, archive = _archive(settings)
    with zipfile.ZipFile(archive) as z:
        m = json.loads(z.read("manifest.json"))
    m["tables"]["floors"] = 5
    bad = _rewrite(archive, tmp_path / "counts.zip", {"manifest.json": json.dumps(m).encode()})
    result = drill.run_drill(settings, bad, write_result=False)
    assert result["result"] == "FAIL" and _failed(result) == ["row_counts"]
    assert result["tables"]["floors"]["archive"] == 5 and result["tables"]["floors"]["restored"] == 2


def test_an_archive_carrying_a_kept_setting_fails_and_the_restore_still_ignores_it(settings, tmp_path):
    _, archive = _archive(settings)
    with zipfile.ZipFile(archive) as z:
        rows = json.loads(z.read("data/settings.json"))
        m = json.loads(z.read("manifest.json"))
    rows.append({"key": "bridge.secret", "value": "PLANTED-SECRET-77"})
    rows.append({"key": "doors.trusted_path", "value": "on"})
    m["tables"]["settings"] = len(rows)
    bad = _rewrite(archive, tmp_path / "leak.zip", {"data/settings.json": json.dumps(rows).encode(), "manifest.json": json.dumps(m).encode()})
    result = drill.run_drill(settings, bad, write_result=False, keep_scratch=True)
    try:
        failed = _failed(result)
        assert "archive_without_kept_settings" in failed
        assert "kept_settings_untouched" not in failed, "restore itself never writes a kept key"
        detail = next(ch for ch in result["checks"] if ch["name"] == "archive_without_kept_settings")["detail"]
        assert detail == {"carried": ["bridge.secret", "doors.trusted_path"]}
        scratch_db = Path(result["scratch_dir"]) / "smplwise.db"
        with Database(scratch_db).connection(mode="read") as conn:
            assert get_setting(conn, "bridge.secret") is None and get_setting(conn, "doors.trusted_path") is None
        assert "PLANTED-SECRET-77" not in json.dumps(result), "the drill result never echoes a setting value"
    finally:
        shutil.rmtree(result.get("scratch_dir") or tmp_path / "none", ignore_errors=True)


def test_an_archive_newer_than_the_build_is_refused(settings, tmp_path):
    _, archive = _archive(settings)
    with zipfile.ZipFile(archive) as z:
        m = json.loads(z.read("manifest.json"))
    m["schema_version"] = drill.code_schema_version() + 1
    bad = _rewrite(archive, tmp_path / "newer.zip", {"manifest.json": json.dumps(m).encode()})
    result = drill.run_drill(settings, bad, write_result=False)
    assert result["result"] == "FAIL" and _failed(result) == ["archive_schema_supported"]


def test_db_checks_find_a_foreign_key_violation(tmp_path):
    import sqlite3

    p = tmp_path / "x.db"
    conn = sqlite3.connect(p)
    conn.executescript("CREATE TABLE a(id TEXT PRIMARY KEY); CREATE TABLE b(id TEXT, a_id TEXT REFERENCES a(id)); INSERT INTO b VALUES('1','missing');")
    conn.commit()
    conn.close()
    out = drill.db_checks(p)
    assert out == {"integrity": "ok", "fk_violations": {"b": 1}}


def test_one_drill_at_a_time(settings):
    _archive(settings)
    assert drill._LOCK.acquire(blocking=False)
    try:
        with pytest.raises(drill.DrillBusy):
            drill.run_drill(settings)
        assert drill.start_background(settings) is False
    finally:
        drill._LOCK.release()


def test_the_monthly_schedule_is_off_by_default_and_runs_when_due(settings):
    _archive(settings)
    db = Database(settings.db_path)
    now = dt.datetime(2026, 10, 20, 12, tzinfo=dt.timezone.utc)
    assert drill.monthly_tick(db, settings, now) is None and drill.read_last(settings) is None, "OFF by default"
    with db.connection() as conn:
        set_setting(conn, drill.SCHEDULE_KEY, "true")
    first = drill.monthly_tick(db, settings, now)
    assert first is not None and first["trigger"] == "monthly" and first["result"] == "PASS"
    last = drill.read_last(settings)
    assert drill.monthly_tick(db, settings, now + dt.timedelta(days=29)) is None, "not again within the month"
    assert drill.due(True, last, drill.next_due(last) + dt.timedelta(seconds=1))
    assert not drill.due(False, None, now)
    assert drill.SCHEDULE_KEY in svc.SETTINGS_KEEP, "the switch is never exported or restored"


def test_admin_only_api_status_run_and_schedule(settings):
    c, archive = _archive(settings)
    s = c.get("/api/v1/backups/drill")
    assert s.status_code == 200, s.text
    assert s.json()["last"] is None and s.json()["schedule"] == {"monthly": False, "next_due_at": None, "due_now": False}
    assert c.post("/api/v1/backups/drill", json={"name": "nope.zip"}).status_code == 404
    r = c.post("/api/v1/backups/drill", json={"name": archive.name})
    assert r.status_code == 202, r.text
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        body = c.get("/api/v1/backups/drill").json()
        if body["last"] and not body["running"]:
            break
        time.sleep(0.2)
    assert body["last"]["result"] == "PASS" and body["last"]["archive"]["name"] == archive.name
    assert body["history"][0]["result"] == "PASS"
    sch = c.put("/api/v1/backups/drill/schedule", json={"monthly": True})
    assert sch.status_code == 200 and sch.json()["schedule"]["monthly"] is True and sch.json()["schedule"]["next_due_at"]
    with Database(settings.db_path).connection(mode="read") as conn:
        assert get_setting(conn, drill.SCHEDULE_KEY) == "true"
        acts = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'backup.drill%' ORDER BY rowid").fetchall()]
    assert acts == ["backup.drill.run", "backup.drill.schedule"]
    # the existing archive routes still resolve (the drill routes are declared before /backups/{name})
    assert c.get(f"/api/v1/backups/{archive.name}").status_code == 200
    ids = seed_tree(c)
    bind(c, settings, "ron", "site_admin", "site", ids["site"])
    for method, url, body in (("get", "/api/v1/backups/drill", None), ("post", "/api/v1/backups/drill", {}),
                              ("put", "/api/v1/backups/drill/schedule", {"monthly": False})):
        resp = getattr(c, method)(url, headers=as_user("ron"), **({"json": body} if body is not None else {}))
        assert resp.status_code == 403, (method, url, resp.status_code)


def test_the_command_line_entry_point(settings, capsys):
    _archive(settings)
    spec = importlib.util.spec_from_file_location("backup_restore_drill", REPO / "scripts" / "backup_restore_drill.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod.main(["--data-dir", str(settings.data_dir), "--no-record"]) == 0
    out = capsys.readouterr().out
    assert "restore drill: PASS" in out and "[ok  ] integrity_check" in out and "timings_ms:" in out
    assert not (settings.data_dir / drill.DRILL_DIR / drill.LAST_FILE).exists()
    assert drill.main(["--data-dir", str(settings.data_dir / "missing")]) == 2
