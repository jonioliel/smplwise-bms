"""SEC-FIX-2520 / DEEP-REVIEW-2520-BACKEND-CORE CORE-04: a restore took the archive's settings rows by deny-list and unvalidated.
Now (a) every archive settings row passes the checks of a normal settings write (the PATCH /settings model's type, pattern, enum and
range; an integer for INT_KEYS) - an invalid value is skipped, the installation keeps its current value, and the answer and the
`backup.restore` audit row name the key; (b) the door-station listen / media switches and the audit retention are never taken from an
archive (with SEC-3's fail-closed security / remote families); (c) a damaged integer row reads as its default instead of breaking
GET /settings and the housekeeping pass.

A scratch data directory with the real migrations (and one app instance for the route); no network."""
from __future__ import annotations

import json
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from smplwise.db import Database, get_setting, set_setting
from smplwise.main import create_app
from smplwise.services import backup as svc
from smplwise.services.settings_store import DEFAULTS, read_settings, setting_value

BAD = {"events.retention_days": "thirty", "media.max_live_sessions": "999", "ui.skin": "nope", "media.video_notice_after_min": "7",
       "ui.tabs": "{not json"}
CURRENT = {"events.retention_days": "45", "media.max_live_sessions": "12", "ui.skin": "domus", "media.video_notice_after_min": "15"}
GOOD = {"ui.design": "b", "media.wall_profile": "main", "exports.retention_days": "30", "media.video_notice_after_min": "30"}


def _db(settings) -> Database:
    db = Database(settings.db_path)
    db.migrate()
    db.ensure_migration_objects()
    return db


def _set_all(db: Database, values: dict[str, str]) -> None:
    with db.connection() as conn:
        for k, v in values.items():
            set_setting(conn, k, v)


def _values(db: Database, keys) -> dict[str, str | None]:
    with db.connection(mode="read") as conn:
        return {k: get_setting(conn, k) for k in keys}


def _archive_with(settings, db: Database, rows: dict[str, str], name: str = "handmade.zip") -> Path:
    with db.connection() as conn:
        entry = svc.create(settings, conn, "manual")
    src = svc.backups_dir(settings) / entry["name"]
    out = svc.backups_dir(settings) / name
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(out, "w") as zout:
        for info in zin.infolist():
            body = zin.read(info.filename)
            if info.filename == "data/settings.json":
                have = [r for r in json.loads(body) if r.get("key") not in rows]
                body = json.dumps(have + [{"key": k, "value": v} for k, v in rows.items()]).encode("utf-8")
            zout.writestr(info.filename, body)
    return out


@pytest.mark.parametrize("mode", ["replace", "merge"])
def test_invalid_archive_values_are_skipped_and_the_current_values_stay(settings, mode):
    db = _db(settings)
    archive = _archive_with(settings, db, {**BAD, "ui.design": "b", "media.wall_profile": "main", "exports.retention_days": "30"})
    _set_all(db, CURRENT)
    with db.connection() as conn:
        out = svc.restore(settings, conn, archive, mode=mode, scope="project", process_hooks=False)
    assert out["settings_invalid"] == sorted(BAD), out["settings_invalid"]
    assert out["skipped_unsafe"].get("settings") == len(BAD)
    assert _values(db, CURRENT) == CURRENT  # the installation keeps its own value of an invalid key
    assert _values(db, ["ui.tabs"]) == {"ui.tabs": None}  # nothing stored: the default
    if mode == "replace":
        assert _values(db, ["ui.design", "media.wall_profile", "exports.retention_days"]) == {
            "ui.design": "b", "media.wall_profile": "main", "exports.retention_days": "30"}
    with db.connection(mode="read") as conn:
        assert read_settings(conn)["events.retention_days"] == 45  # GET /settings still answers


def test_valid_values_of_every_shape_pass(settings):
    fields = svc._patch_fields()
    for key in fields:  # every default of a key the settings write knows is a value a restore accepts
        if key in DEFAULTS:
            assert svc._valid_setting_value(key, DEFAULTS[key], fields), key
    for key, value in {**GOOD, "ui.tabs": json.dumps({"styles": {}}), "ui.palettes": "[]", "media.video_notice_after_min": "60"}.items():
        assert svc._valid_setting_value(key, value, fields), key
    assert not svc._valid_setting_value("events.retention_days", 30, fields)  # stored values are text
    assert svc._valid_setting_value("some.module_setting", "anything", fields)  # a module's own key: as before


def test_the_round_trip_of_a_real_installation_skips_nothing(settings):
    app = create_app(settings)
    c = TestClient(app)
    patch = {"ui.design": "b", "media.max_live_sessions": 9, "media.video_notice_after_min": 30, "ui.skin": "crystal",
             "events.retention_days": 60}
    assert c.patch("/api/v1/settings", json=patch).status_code == 200
    r = c.post("/api/v1/backups", json={})
    assert r.status_code == 201, r.text
    name = r.json()["name"]
    res = c.post(f"/api/v1/backups/{name}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    assert res.json()["settings_invalid"] == []
    assert c.get("/api/v1/settings").json()["settings"]["media.max_live_sessions"] == 9


def test_the_restore_route_audits_the_skipped_keys(settings):
    app = create_app(settings)
    c = TestClient(app)
    db = app.state.db
    archive = _archive_with(settings, db, {"events.retention_days": "thirty"})
    res = c.post(f"/api/v1/backups/{archive.name}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    assert res.json()["settings_invalid"] == ["events.retention_days"]
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'backup.restore' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert json.loads(row[0])["settings_invalid"] == ["events.retention_days"]
    assert c.get("/api/v1/settings").status_code == 200


@pytest.mark.parametrize("key", ["access.station_listen", "access.station_media", "audit.retention_days"])
def test_station_switches_and_the_audit_retention_never_come_from_an_archive(settings, key):
    db = _db(settings)
    loose = {"access.station_listen": "on", "access.station_media": "on", "audit.retention_days": "30"}[key]
    strict = {"access.station_listen": "off", "access.station_media": "off", "audit.retention_days": "3650"}[key]
    archive = _archive_with(settings, db, {key: loose})
    _set_all(db, {key: strict})
    with db.connection() as conn:
        svc.restore(settings, conn, archive, mode="replace", scope="project", process_hooks=False)
    assert _values(db, [key]) == {key: strict}
    assert svc._kept_setting(key) and svc._kept_setting("access.station_future_switch")


def test_a_damaged_integer_row_reads_as_its_default(settings):
    db = _db(settings)
    _set_all(db, {"events.retention_days": "thirty", "remote.idle_lock_minutes": "x"})
    with db.connection(mode="read") as conn:
        out = read_settings(conn)
        assert out["events.retention_days"] == int(DEFAULTS["events.retention_days"])
        assert out["remote.idle_lock_minutes"] == int(DEFAULTS["remote.idle_lock_minutes"])
        assert setting_value(conn, "events.retention_days") == int(DEFAULTS["events.retention_days"])
