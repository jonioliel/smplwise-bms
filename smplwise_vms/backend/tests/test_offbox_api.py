"""DATASTORE-295 phase 2: the off-box API and runtime - targets with write-only sealed credentials, the connection test, dry run and
push (S3 through the SigV4 client against a fake S3 service that checks every signature), the push after the daily backup with the
`backup.offbox_failed` alert and its resolution, the keyring (export once with a confirmation, rotation that keeps old copies readable,
import on a new installation), the restore drill of the newest encrypted copy, and admin-only access."""
from __future__ import annotations

import asyncio
import json
import time
from dataclasses import replace
from pathlib import Path

import httpx
import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient
from test_offbox_s3 import AK, SK, FakeS3Service

from smplwise.db import Database, set_setting
from smplwise.main import create_app
from smplwise.services import backup as backup_svc
from smplwise.services import backup_drill as drill
from smplwise.services import backup_offbox as ob
from smplwise.services import offbox_keys, offbox_runtime, offbox_s3

URL = "/api/v1/backups/offbox"


@pytest.fixture()
def world(settings, tmp_path, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    svc = FakeS3Service(path_style=True)
    transport = httpx.MockTransport(svc.handler)
    monkeypatch.setattr(offbox_runtime, "S3_CLIENT", lambda d: offbox_s3.client_for(d, transport=transport))
    share = tmp_path / "share"
    share.mkdir()
    return type("W", (), {"app": app, "c": c, "svc": svc, "share": share, "settings": settings, "db": app.state.db})


def _s3_body(**over):
    body = {"name": "Cloud copy", "kind": "s3", "enabled": True,
            "config": {"endpoint": "https://s3.example.net", "bucket": "arx-bk", "region": "auto", "prefix": "arx-backups", "path_style": True},
            "secrets": {"access_key": AK, "secret_key": SK}, "retention": {"keep_last": 2, "keep_daily": 0, "keep_weekly": 0, "keep_monthly": 0}}
    body.update(over)
    return body


def _backup(w) -> str:
    r = w.c.post("/api/v1/backups", json={"note": "offbox"})
    assert r.status_code == 201, r.text
    return r.json()["name"]


def _wait(pred, timeout=30.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        v = pred()
        if v:
            return v
        time.sleep(0.1)
    raise AssertionError("timed out")


def test_targets_with_write_only_sealed_secrets(world):
    w = world
    r = w.c.post(f"{URL}/targets", json=_s3_body())
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["secrets"] == {"access_key": True, "secret_key": True} and "access_key" not in t["config"] and t["enabled"] is True
    assert SK not in r.text and AK not in r.text
    with w.db.connection(mode="read") as conn:
        blobs = [row[0] for row in conn.execute("SELECT value_enc FROM backup_offbox_secrets").fetchall()]
        cfg = conn.execute("SELECT config_json FROM backup_offbox_targets").fetchone()[0]
        audit_text = json.dumps([dict(x) for x in conn.execute("SELECT details_json FROM audit_log WHERE action LIKE 'backup.offbox.%'").fetchall()])
    assert len(blobs) == 2 and all(SK not in b and AK not in b for b in blobs)
    assert "store:offbox." in cfg and SK not in cfg
    assert SK not in audit_text and "secrets_set" in audit_text
    listing = w.c.get(URL).json()
    assert [x["id"] for x in listing["targets"]] == [t["id"]] and listing["transports"]["s3"] is True and SK not in json.dumps(listing)
    # updates: the kind is fixed; absent secrets are kept; "" clears and an enabled target then needs it again
    assert w.c.put(f"{URL}/targets/{t['id']}", json={**_s3_body(), "kind": "sftp"}).json()["code"] == "kind_immutable"
    upd = w.c.put(f"{URL}/targets/{t['id']}", json={**_s3_body(name="Renamed"), "secrets": {}})
    assert upd.status_code == 200 and upd.json()["name"] == "Renamed" and upd.json()["secrets"] == {"access_key": True, "secret_key": True}
    cleared = w.c.put(f"{URL}/targets/{t['id']}", json={**_s3_body(), "secrets": {"secret_key": ""}})
    assert cleared.status_code == 422 and cleared.json()["code"] == "secrets_missing"
    # refusals write nothing
    before = len(w.c.get(URL).json()["targets"])
    assert w.c.post(f"{URL}/targets", json=_s3_body(secrets={"access_key": AK})).json()["code"] == "secrets_missing"
    assert w.c.post(f"{URL}/targets", json=_s3_body(config={"endpoint": "https://s3.example.net", "bucket": "arx-bk", "password": "x"})).status_code == 422
    assert w.c.post(f"{URL}/targets", json=_s3_body(config={"endpoint": "http://s3.example.net", "bucket": "arx-bk"})).json()["code"] == "destination_invalid"
    sftp = {"name": "NAS", "kind": "sftp", "enabled": False, "config": {"host": "nas.example.net", "username": "arx", "remote_dir": "/backups"}}
    assert w.c.post(f"{URL}/targets", json=sftp).json()["code"] == "host_key_required"
    assert len(w.c.get(URL).json()["targets"]) == before
    ok = w.c.post(f"{URL}/targets", json={**sftp, "config": {**sftp["config"], "host_key": "SHA256:" + "B" * 43}})
    assert ok.status_code == 201 and ok.json()["secrets"] == {"key": False}
    assert w.c.patch(f"{URL}/targets/{ok.json()['id']}", json={"enabled": True}).json()["code"] == "secrets_missing"
    assert w.c.delete(f"{URL}/targets/{t['id']}").status_code == 204
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM backup_offbox_secrets WHERE target_id = ?", (t["id"],)).fetchone()[0] == 0


def test_connection_test_dry_run_and_push_through_sigv4(world):
    w = world
    _backup(w)
    t = w.c.post(f"{URL}/targets", json=_s3_body()).json()
    test = w.c.post(f"{URL}/targets/{t['id']}/test")
    assert test.status_code == 200 and test.json()["ok"] is True, test.text
    assert w.svc.objects == {}, "the marker was removed"
    dry = w.c.post(f"{URL}/targets/{t['id']}/push", json={"dry_run": True}).json()
    assert dry["dry_run"] and dry["result"]["ok"] and dry["result"]["plan"]["upload"]["name"].endswith(".zip.swxb") and w.svc.objects == {}
    assert w.c.post(f"{URL}/targets/{t['id']}/push", json={}).status_code == 202
    last = _wait(lambda: (w.c.get(URL).json()["targets"][0]["last"]["push"]))
    assert last["ok"] and last["verified"] and last["key_id"] and len(w.svc.objects) == 1
    assert next(iter(w.svc.objects)).startswith("arx-backups/manual-")
    assert w.c.get(URL).json()["targets"][0]["last"]["test"]["ok"] is True


def _alert(w) -> list[str]:
    with w.db.connection(mode="read") as conn:
        return [r[0] for r in conn.execute("SELECT state FROM notifications WHERE source = 'backup.offbox_failed' ORDER BY rowid").fetchall()]


def test_daily_push_raises_and_resolves_the_alert(world, tmp_path):
    w = world
    missing = tmp_path / "unmounted"
    r = w.c.post(f"{URL}/targets", json={"name": "USB", "kind": "local", "enabled": True, "config": {"path": str(missing)}})
    assert r.status_code == 201, r.text
    name = _backup(w)
    res = offbox_runtime.after_backup(w.db, w.settings, name)
    assert [x["error"] for x in res] == ["destination_unavailable"]
    assert _alert(w) == ["open"]
    missing.mkdir()
    res2 = offbox_runtime.after_backup(w.db, w.settings, name)
    assert res2[0]["ok"] and res2[0]["verified"] and _alert(w) == ["resolved"]
    assert (missing / name.replace(".zip", ".zip.swxb")).is_file()


def test_the_daily_loop_pushes_after_its_backup(world):
    w = world
    w.c.post(f"{URL}/targets", json={"name": "USB", "kind": "local", "enabled": True, "config": {"path": str(w.share)}})

    async def run() -> None:
        task = asyncio.create_task(backup_svc.daily_loop(w.db, w.settings, interval_s=0))
        try:
            end = time.monotonic() + 30
            while time.monotonic() < end and not list(w.share.glob("auto-daily-*.zip.swxb")):
                await asyncio.sleep(0.1)
        finally:
            task.cancel()

    asyncio.run(run())
    assert list(w.share.glob("auto-daily-*.zip.swxb")), "the daily backup's copy reached the enabled target"


def test_key_export_once_rotation_and_import(world, tmp_path):
    w = world
    t = w.c.post(f"{URL}/targets", json={"name": "USB", "kind": "local", "enabled": True, "config": {"path": str(w.share)}}).json()
    first = _backup(w)
    assert offbox_runtime.run_push(w.db, w.settings, t["id"], trigger="manual")["ok"]
    assert w.c.post(f"{URL}/key/export", json={"confirm": "yes"}).json()["code"] == "confirm_required"
    exp = w.c.post(f"{URL}/key/export", json={"confirm": "EXPORT"})
    assert exp.status_code == 200 and exp.json()["key"].startswith("SWXB-KEY-1:" + exp.json()["key_id"])
    again = w.c.post(f"{URL}/key/export", json={"confirm": "EXPORT"})
    assert again.status_code == 409 and again.json()["code"] == "key_already_exported" and "SWXB-KEY" not in again.text
    with w.db.connection(mode="read") as conn:
        rows = json.dumps([tuple(r) for r in conn.execute("SELECT action, decision, details_json FROM audit_log WHERE action = 'backup.offbox.key_export'")])
    assert exp.json()["key"].split(":")[2] not in rows and "allowed" in rows and "denied" in rows
    old_kid = exp.json()["key_id"]
    # rotation: a new active key; the copy sealed with the old one still opens
    rot = w.c.post(f"{URL}/key/rotate", json={"confirm": "ROTATE"}).json()
    assert rot["active"] != old_kid and {k["id"] for k in rot["keys"]} >= {old_kid}
    time.sleep(1.1)
    second = _backup(w)
    assert offbox_runtime.run_push(w.db, w.settings, t["id"], trigger="manual")["ok"]
    ring = offbox_keys.load(Path(w.settings.data_dir)).key_map()
    for name in (first, second):
        sealed = w.share / name.replace(".zip", ".zip.swxb")
        out = ob.open_file(sealed, tmp_path / f"{name}.out", ring)
        assert out["key_id"] == (old_kid if name == first else rot["active"])
    # a new installation that imports only the exported (old) key opens the old copy, not the new one
    fresh = tmp_path / "fresh-data"
    kid = offbox_keys.import_key(fresh, exp.json()["key"])
    assert kid == old_kid
    fresh_ring = offbox_keys.load(fresh).key_map()
    ob.open_file(w.share / first.replace(".zip", ".zip.swxb"), tmp_path / "f1", fresh_ring)
    with pytest.raises(ob.OffboxError) as e:
        ob.open_file(w.share / second.replace(".zip", ".zip.swxb"), tmp_path / "f2", fresh_ring)
    assert e.value.code == "key_mismatch"
    assert w.c.post(f"{URL}/key/import", json={"key": "SWXB-KEY-1:0000000000000000:" + "A" * 43 + "="}).json()["code"] == "key_import_invalid"
    assert (Path(w.settings.data_dir) / "keys" / offbox_keys.KEYRING_FILE).is_file()


def test_the_drill_restores_the_newest_encrypted_copy(world, tmp_path):
    w = world
    t = w.c.post(f"{URL}/targets", json={"name": "USB", "kind": "local", "enabled": True, "config": {"path": str(w.share)}}).json()
    _backup(w)
    assert offbox_runtime.run_push(w.db, w.settings, t["id"], trigger="manual")["ok"]
    r = drill.run_offbox_drill(w.db, w.settings, t["id"])
    assert r["result"] == "PASS", [c for c in r["checks"] if not c["ok"]]
    assert r["source"]["kind"] == "offbox" and r["source"]["object"].endswith(".zip.swxb") and "fetch" in r["timings_ms"]
    assert {"offbox_fetch", "offbox_decrypt", "integrity_check", "row_counts"} <= {c["name"] for c in r["checks"]}
    assert drill.read_last(w.settings, drill.LAST_OFFBOX_FILE)["result"] == "PASS" and drill.read_last(w.settings) is None
    assert not list((Path(w.settings.data_dir) / drill.DRILL_DIR).glob("offbox-*")), "the downloaded copy is removed"
    assert w.c.get(URL).json()["targets"][0]["last"]["drill"]["ok"] is True
    # through the API
    assert w.c.post("/api/v1/backups/drill", json={"target_id": "nope"}).status_code == 404
    assert w.c.post("/api/v1/backups/drill", json={"target_id": t["id"]}).status_code == 202

    def second_done():
        s = w.c.get("/api/v1/backups/drill").json()
        return not s["running"] and len(s["history"]) == 2 and s["history"][0]["source"] == "offbox"

    _wait(second_done)
    assert w.c.get("/api/v1/backups/drill").json()["last_offbox"]["result"] == "PASS"
    # without the key (a new installation that never imported it) the drill fails and says why
    (Path(w.settings.data_dir) / "keys" / offbox_keys.KEYRING_FILE).unlink()
    failed = drill.run_offbox_drill(w.db, w.settings, t["id"])
    assert failed["result"] == "FAIL" and [c["name"] for c in failed["checks"] if not c["ok"]] == ["offbox_fetch"]
    assert next(c for c in failed["checks"] if c["name"] == "offbox_fetch")["detail"]["error"] == "key_missing"


def test_the_monthly_drill_covers_enabled_targets_when_a_key_exists(world):
    w = world
    t = w.c.post(f"{URL}/targets", json={"name": "USB", "kind": "local", "enabled": True, "config": {"path": str(w.share)}}).json()
    _backup(w)
    assert drill.offbox_drill_targets(w.db, w.settings) == [], "no key yet: nothing to open"
    assert offbox_runtime.run_push(w.db, w.settings, t["id"], trigger="manual")["ok"]
    assert drill.offbox_drill_targets(w.db, w.settings) == [t["id"]]
    with w.db.connection() as conn:
        set_setting(conn, drill.SCHEDULE_KEY, "true")
    assert drill.monthly_tick(w.db, w.settings)["result"] == "PASS"
    assert drill.read_last(w.settings, drill.LAST_OFFBOX_FILE)["trigger"] == "monthly"


def test_only_system_administrators(world):
    w = world
    t = w.c.post(f"{URL}/targets", json={"name": "USB", "kind": "local", "enabled": False, "config": {"path": str(w.share)}}).json()
    ids = seed_tree(w.c)
    bind(w.c, w.settings, "ron", "site_admin", "site", ids["site"])
    h = as_user("ron")
    calls = [("get", URL, None), ("post", f"{URL}/targets", _s3_body()), ("put", f"{URL}/targets/{t['id']}", _s3_body()),
             ("patch", f"{URL}/targets/{t['id']}", {"enabled": True}), ("delete", f"{URL}/targets/{t['id']}", None),
             ("post", f"{URL}/targets/{t['id']}/test", None), ("post", f"{URL}/targets/{t['id']}/push", {}),
             ("post", f"{URL}/key/export", {"confirm": "EXPORT"}), ("post", f"{URL}/key/rotate", {"confirm": "ROTATE"}),
             ("post", f"{URL}/key/import", {"key": "x"})]
    for method, url, body in calls:
        resp = w.c.request(method.upper(), url, headers=h, **({"json": body} if body is not None else {}))
        assert resp.status_code == 403, (method, url, resp.status_code)
    assert not (Path(w.settings.data_dir) / "keys" / offbox_keys.KEYRING_FILE).exists()


def test_targets_and_secrets_never_travel_in_a_project_backup(world):
    w = world
    w.c.post(f"{URL}/targets", json=_s3_body())
    assert not {"backup_offbox_targets", "backup_offbox_secrets", "backup_offbox_runs"} & set(backup_svc.PROJECT_TABLES + backup_svc.ACCESS_TABLES)
    assert backup_svc._rel(w.settings, str(Path(w.settings.data_dir) / "keys" / offbox_keys.KEYRING_FILE)) is None
    assert not backup_svc.restorable("keys/" + offbox_keys.KEYRING_FILE)
