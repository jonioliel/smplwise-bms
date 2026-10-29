"""OFFBOX-RESTORE-2300: restoring a live installation FROM an encrypted off-box copy.

Real encryption throughout (the SWXB format, the keyring, the export / import of the key); the destinations are the real local-folder
adapter, the real S3 adapter against a fake S3 service and the real SFTP adapter over an in-memory-folder client. Covers: the full
round trip backup -> push -> list -> download -> decrypt -> verify -> restore into a FRESH data directory (API, service and command
line), the two-step confirmation, the pre-restore safety archive, and every refusal - wrong / missing key, tampered / truncated /
foreign file, wrong expected hash, schema newer than the installation, full disk, expired or changed stage, non-administrators."""
from __future__ import annotations

import json
import os
import shutil
import time
import zipfile
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient
from test_offbox_s3 import AK, SK, FakeS3Service

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import backup as backup_svc
from smplwise.services import backup_offbox as ob
from smplwise.services import offbox_keys, offbox_restore, offbox_runtime, offbox_s3

URL = "/api/v1/backups/offbox"


# ---------------------------------------------------------------- helpers


@pytest.fixture()
def world(settings, tmp_path):
    """Installation A (with a project and one backup pushed to a local share) and an empty installation B (a fresh data directory)."""
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    share = tmp_path / "share"
    share.mkdir()
    tid = c.post(f"{URL}/targets", json={"name": "USB", "kind": "local", "enabled": True, "config": {"path": str(share)}}).json()["id"]
    name = c.post("/api/v1/backups", json={"note": "for the off-box restore"}).json()["name"]
    assert offbox_runtime.run_push(app.state.db, settings, tid, trigger="manual")["ok"]
    key = c.post(f"{URL}/key/export", json={"confirm": "EXPORT"}).json()["key"]
    settings_b = replace(settings, data_dir=tmp_path / "dataB")
    app_b = create_app(settings_b)
    cb = TestClient(app_b)
    return SimpleNamespace(app=app, c=c, ids=ids, share=share, tid=tid, name=name, obj=name + ".swxb", key=key, settings=settings, db=app.state.db,
                           app_b=app_b, cb=cb, sb=settings_b, tmp=tmp_path)


def _b_target(w) -> str:
    r = w.cb.post(f"{URL}/targets", json={"name": "USB", "kind": "local", "enabled": False, "config": {"path": str(w.share)}})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _b_import_key(w) -> None:
    r = w.cb.post(f"{URL}/key/import", json={"key": w.key})
    assert r.status_code == 200, r.text


def _stages(settings) -> list[Path]:
    root = Path(settings.data_dir) / offbox_restore.STAGE_DIR
    return [p for p in root.iterdir()] if root.is_dir() else []


def _site_names(c: TestClient) -> list[str]:
    return sorted(s["name"] for s in c.get("/api/v1/sites?tree=true").json()["sites"])


def _prepare(w, tid: str, **over):
    return w.cb.post(f"{URL}/restore/prepare", json={"target_id": tid, "object": w.obj, **over})


def _code(r) -> str:
    return r.json().get("code")


# ---------------------------------------------------------------- the round trip (API)


def test_roundtrip_backup_upload_download_decrypt_restore_into_a_fresh_installation(world):
    w = world
    assert _site_names(w.cb) == [], "B is empty"
    tid = _b_target(w)
    _b_import_key(w)
    copies = w.cb.get(f"{URL}/targets/{tid}/copies")
    assert copies.status_code == 200, copies.text
    assert [c["name"] for c in copies.json()["copies"]] == [w.obj] and copies.json()["copies"][0]["stamp"].endswith("Z")
    prep = _prepare(w, tid)
    assert prep.status_code == 200, prep.text
    p = prep.json()
    assert p["object"] == w.obj and p["key_id"] and p["tables"]["floors"] == 2 and p["schema_version"] >= 1 and p["expires_in_s"] > 0
    assert len(p["plain_sha256"]) == 64 and len(p["sealed_sha256"]) == 64
    assert _site_names(w.cb) == [], "preparing changes nothing"
    # the destructive step needs the explicit confirmation
    assert w.cb.post(f"{URL}/restore", json={"stage_id": p["id"], "confirm": "restore"}).status_code == 422
    assert _code(w.cb.post(f"{URL}/restore", json={"stage_id": p["id"]})) == "confirm_required"
    assert _site_names(w.cb) == []
    res = w.cb.post(f"{URL}/restore", json={"stage_id": p["id"], "confirm": "RESTORE", "mode": "replace", "scope": "project"})
    assert res.status_code == 200, res.text
    out = res.json()
    assert out["tables"]["floors"] == 2 and out["object"] == w.obj and out["safety_archive"]["name"].startswith("auto-pre-restore-")
    assert _site_names(w.cb) == _site_names(w.c) == ["אתר בדיקה"]
    # the pre-restore safety archive is a real backup of what B held before, and the stage is gone
    safety = backup_svc.backups_dir(w.sb) / out["safety_archive"]["name"]
    assert safety.is_file() and backup_svc.read_manifest(safety)["kind"] == "auto-pre-restore"
    assert _stages(w.sb) == []
    assert _code(w.cb.post(f"{URL}/restore", json={"stage_id": p["id"], "confirm": "RESTORE"})) == "stage_missing"
    # audit rows carry ids and counts - no key material, no path, no credential
    with w.app_b.state.db.connection(mode="read") as conn:
        rows = [tuple(r) for r in conn.execute("SELECT action, decision, resource_id, reason, details_json FROM audit_log WHERE action LIKE 'backup.offbox.%'")]
    acts = [r[0] for r in rows]
    assert "backup.offbox.restore_prepare" in acts and "backup.offbox.restore" in acts
    text = json.dumps(rows)
    assert w.key.split(":")[2] not in text and "SWXB-KEY" not in text and str(w.share) not in text
    assert w.obj in text and "auto-pre-restore" in text


def test_restore_into_an_existing_installation_brings_back_the_project_and_keeps_a_way_back(world):
    w = world
    w.c.post(f"/api/v1/buildings/{w.ids['building']}/floors", json={"name": "קומה 9", "level": 9})
    site = w.c.get("/api/v1/sites?tree=true").json()["sites"][0]
    assert w.c.patch(f"/api/v1/sites/{site['id']}", json={"name": "שונה אחרי הגיבוי"}).status_code == 200
    p = w.c.post(f"{URL}/restore/prepare", json={"target_id": w.tid, "object": w.obj})
    assert p.status_code == 200, p.text
    res = w.c.post(f"{URL}/restore", json={"stage_id": p.json()["id"], "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    assert _site_names(w.c) == ["אתר בדיקה"], "the copy replaced the later edit"
    names = [b["name"] for b in w.c.get("/api/v1/backups").json()["backups"]]
    safety = [n for n in names if n.startswith("auto-pre-restore-")]
    assert len(safety) == 1
    m = backup_svc.read_manifest(backup_svc.backups_dir(w.settings) / safety[0])
    assert m["kind"] == "auto-pre-restore" and m["tables"]["floors"] == 3, "the safety archive holds the state BEFORE the restore"


def test_a_retried_restore_with_a_wrong_password_keeps_the_stage_and_leaves_no_extra_safety_archive(world):
    w = world
    r = w.c.post("/api/v1/backups", json={"note": "sealed", "backup_password": "correct horse battery staple"})
    assert r.status_code == 201, r.text
    time.sleep(1.1)
    assert offbox_runtime.run_push(w.db, w.settings, w.tid, trigger="manual")["ok"]
    tid = _b_target(w)
    _b_import_key(w)
    newest = w.cb.get(f"{URL}/targets/{tid}/copies").json()["copies"][0]["name"]
    p = _prepare(w, tid, object=newest)
    assert p.status_code == 200 and p.json()["sensitive"] == "encrypted" and "backup_password_required" in p.json()["warnings"]
    bad = w.cb.post(f"{URL}/restore", json={"stage_id": p.json()["id"], "confirm": "RESTORE", "backup_password": "not the password at all"})
    assert bad.status_code == 409 and _code(bad) == "backup_password_wrong"
    assert not list(backup_svc.backups_dir(w.sb).glob("auto-pre-restore-*")), "a refused attempt leaves no safety archive"
    assert (Path(w.sb.data_dir) / offbox_restore.STAGE_DIR / p.json()["id"]).is_dir()
    ok = w.cb.post(f"{URL}/restore", json={"stage_id": p.json()["id"], "confirm": "RESTORE", "backup_password": "correct horse battery staple"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["sensitive"]["state"] == "encrypted"


# ---------------------------------------------------------------- the refusals


def test_no_key_and_a_wrong_key(world):
    w = world
    tid = _b_target(w)
    r = _prepare(w, tid)
    assert r.status_code == 422 and _code(r) == "key_missing"
    offbox_keys.load(Path(w.sb.data_dir), create=True)  # B's own, different key
    r = _prepare(w, tid)
    assert r.status_code == 422 and _code(r) == "key_mismatch" and "SWXB" not in r.text
    assert _stages(w.sb) == [] and _site_names(w.cb) == []


def test_a_tampered_truncated_or_foreign_copy_is_refused_and_leaves_nothing_behind(world):
    w = world
    tid = _b_target(w)
    _b_import_key(w)
    good = (w.share / w.obj).read_bytes()
    flipped = bytearray(good)
    flipped[len(flipped) // 2] ^= 0x01
    (w.share / w.obj).write_bytes(bytes(flipped))
    r = _prepare(w, tid)
    assert r.status_code == 422 and _code(r) == "sealed_damaged"
    (w.share / w.obj).write_bytes(good[:-7])
    assert _code(_prepare(w, tid)) == "sealed_damaged"
    (w.share / w.obj).write_bytes(good)
    foreign = "manual-20250101-000000.zip.swxb"
    (w.share / foreign).write_bytes(os.urandom(4096))
    assert _code(_prepare(w, tid, object=foreign)) == "sealed_invalid"
    assert _code(_prepare(w, tid, object="manual-19990101-000000.zip.swxb")) == "object_missing"
    assert _code(_prepare(w, tid, object="../etc/passwd")) == "object_name_invalid"
    # the hash the operator recorded must match the downloaded bytes
    r = _prepare(w, tid, expected_sha256="0" * 64)
    assert r.status_code == 422 and _code(r) == "verify_hash_mismatch"
    assert _code(_prepare(w, tid, expected_sha256="zz")) == "hash_invalid"
    assert _stages(w.sb) == [] and _site_names(w.cb) == []
    # and the untouched copy still works, with its recorded hash
    sealed_sha = ob.sha256_file(w.share / w.obj)
    ok = _prepare(w, tid, expected_sha256=sealed_sha.upper())
    assert ok.status_code == 200 and ok.json()["sealed_sha256"] == sealed_sha


def _with_schema(src_zip: Path, dst_zip: Path, schema: int) -> None:
    with zipfile.ZipFile(src_zip) as zin, zipfile.ZipFile(dst_zip, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "manifest.json":
                m = json.loads(data)
                m["schema_version"] = schema
                data = json.dumps(m).encode()
            zout.writestr(item, data)


def test_a_copy_from_a_newer_schema_is_refused_at_prepare_and_again_by_the_existing_restore(world):
    w = world
    tid = _b_target(w)
    _b_import_key(w)
    newer_zip = w.tmp / "newer.zip"
    _with_schema(backup_svc.backups_dir(w.settings) / w.name, newer_zip, 99999)
    name = "manual-20990101-000000.zip.swxb"
    ob.seal_file(newer_zip, w.share / name, offbox_keys.load(Path(w.settings.data_dir)).active_key())
    r = _prepare(w, tid, object=name)
    assert r.status_code == 409 and _code(r) == "schema_newer"
    assert _stages(w.sb) == []
    # a stage whose meta was edited to hide the schema still meets the restore's own refusal; the safety archive made for it is removed again
    p = _prepare(w, tid).json()
    d = Path(w.sb.data_dir) / offbox_restore.STAGE_DIR / p["id"]
    _with_schema(d / "archive.zip", w.tmp / "swapped.zip", 99999)
    shutil.copyfile(w.tmp / "swapped.zip", d / "archive.zip")
    meta = json.loads((d / "meta.json").read_text(encoding="utf-8"))
    meta["plain_sha256"] = ob.sha256_file(d / "archive.zip")
    (d / "meta.json").write_text(json.dumps(meta), encoding="utf-8")
    res = w.cb.post(f"{URL}/restore", json={"stage_id": p["id"], "confirm": "RESTORE"})
    assert res.status_code == 409 and _code(res) == "restore_refused"
    assert not list(backup_svc.backups_dir(w.sb).glob("auto-pre-restore-*"))
    assert _site_names(w.cb) == []


def test_not_enough_disk_is_refused_before_anything_is_downloaded(world, monkeypatch):
    w = world
    tid = _b_target(w)
    _b_import_key(w)
    monkeypatch.setattr(offbox_restore, "free_bytes", lambda path: 1024)
    r = _prepare(w, tid)
    assert r.status_code == 422 and _code(r) == "disk_insufficient"
    assert _stages(w.sb) == []


def test_an_expired_or_changed_stage_cannot_be_restored(world):
    w = world
    tid = _b_target(w)
    _b_import_key(w)
    p = _prepare(w, tid).json()
    d = Path(w.sb.data_dir) / offbox_restore.STAGE_DIR / p["id"]
    with open(d / "archive.zip", "ab") as f:
        f.write(b"x")
    r = w.cb.post(f"{URL}/restore", json={"stage_id": p["id"], "confirm": "RESTORE"})
    assert r.status_code == 409 and _code(r) == "stage_changed" and _site_names(w.cb) == []
    p2 = _prepare(w, tid).json()
    d2 = Path(w.sb.data_dir) / offbox_restore.STAGE_DIR / p2["id"]
    old = time.time() - offbox_restore.STAGE_TTL_S - 60
    os.utime(d2 / "meta.json", (old, old))
    assert _code(w.cb.post(f"{URL}/restore", json={"stage_id": p2["id"], "confirm": "RESTORE"})) == "stage_missing"
    assert not d2.exists(), "an expired stage is removed"
    assert _code(w.cb.post(f"{URL}/restore", json={"stage_id": "../../x", "confirm": "RESTORE"})) == "stage_missing"
    p3 = _prepare(w, tid).json()
    assert w.cb.delete(f"{URL}/restore/{p3['id']}").status_code == 204
    assert not (Path(w.sb.data_dir) / offbox_restore.STAGE_DIR / p3["id"]).exists()


def test_only_system_administrators_may_list_prepare_or_restore(world):
    w = world
    bind(w.c, w.settings, "ron", "site_admin", "site", w.ids["site"])
    h = as_user("ron")
    calls = [("get", f"{URL}/targets/{w.tid}/copies", None), ("post", f"{URL}/restore/prepare", {"target_id": w.tid, "object": w.obj}),
             ("post", f"{URL}/restore", {"stage_id": "0" * 16, "confirm": "RESTORE"}), ("delete", f"{URL}/restore/{'0' * 16}", None)]
    for method, url, body in calls:
        resp = w.c.request(method.upper(), url, headers=h, **({"json": body} if body is not None else {}))
        assert resp.status_code == 403, (method, url, resp.status_code)
    assert _stages(w.settings) == []


def test_a_transfer_in_progress_is_a_conflict(world):
    w = world
    tid = _b_target(w)
    _b_import_key(w)
    assert offbox_runtime._LOCK.acquire(blocking=False)
    try:
        r = _prepare(w, tid)
        assert r.status_code == 409 and _code(r) == "push_running"
        assert w.cb.get(f"{URL}/targets/{tid}/copies").status_code == 409
    finally:
        offbox_runtime._LOCK.release()


# ---------------------------------------------------------------- every destination kind, at the service level


class FakeSftp:
    """The SFTP client subset the adapter uses, over a folder (the remote directory's listing is the folder's)."""

    def __init__(self, root: Path):
        self.root = root

    def put(self, localpath, remotepath):
        shutil.copyfile(localpath, self.root / Path(remotepath).name)

    def get(self, remotepath, localpath):
        src = self.root / Path(remotepath).name
        if not src.is_file():
            raise FileNotFoundError("no such file")
        shutil.copyfile(src, localpath)

    def listdir_attr(self, path):
        return [SimpleNamespace(filename=p.name, st_size=p.stat().st_size) for p in self.root.iterdir() if p.is_file()]

    def remove(self, path):
        (self.root / Path(path).name).unlink()

    def posix_rename(self, a, b):
        os.replace(self.root / Path(a).name, self.root / Path(b).name)

    def close(self):
        return None


def _destination(kind: str, tmp: Path, monkeypatch) -> ob.Destination:
    if kind == "local":
        (tmp / "local-share").mkdir(exist_ok=True)
        return ob.build_destination({"kind": "local", "path": str(tmp / "local-share")}, data_dir=tmp / "data")
    if kind == "sftp":
        (tmp / "sftp-root").mkdir(exist_ok=True)
        monkeypatch.setenv("SW_T_SFTP_KEY", "not-a-real-key")
        return ob.build_destination({"kind": "sftp", "host": "backup.example", "port": 22, "username": "arx", "host_key": "SHA256:" + "A" * 43,
                                     "remote_dir": "/arx", "key": "env:SW_T_SFTP_KEY"}, sftp_client=lambda d: FakeSftp(tmp / "sftp-root"))
    svc = FakeS3Service(path_style=True)
    transport = httpx.MockTransport(svc.handler)
    monkeypatch.setenv("SW_T_S3_ID", AK)
    monkeypatch.setenv("SW_T_S3_SECRET", SK)
    return ob.build_destination({"kind": "s3", "endpoint": "https://s3.example.net", "bucket": "arx-bk", "region": svc.region, "path_style": True,
                                 "access_key": "env:SW_T_S3_ID", "secret_key": "env:SW_T_S3_SECRET"},
                                s3_client=lambda d: offbox_s3.client_for(d, transport=transport))


@pytest.mark.parametrize("kind", ["local", "sftp", "s3"])
def test_every_destination_kind_round_trips_into_a_fresh_data_directory(world, monkeypatch, kind):
    w = world
    dest = _destination(kind, w.tmp, monkeypatch)
    archive = backup_svc.backups_dir(w.settings) / w.name
    key = offbox_keys.load(Path(w.settings.data_dir)).active_key()
    up = ob.push(archive, dest, key)
    assert up["ok"] and up["verified"], up
    listed = offbox_restore.list_copies(dest)
    assert [c["name"] for c in listed] == [w.obj]
    ring = {ob.key_id(key): key}  # B holds only the exported key
    assert w.cb.get("/api/v1/me").status_code == 200  # the administrator of B exists before the restore, as in the screen flow
    with w.app_b.state.db.connection() as conn:
        meta = offbox_restore.prepare(dest, w.obj, w.sb, current_schema=backup_svc.schema_version(conn), keys=ring)
        assert meta["plain_sha256"] == ob.sha256_file(archive), "the decrypted archive is byte-identical to the original"
        out = offbox_restore.restore_staged(w.sb, conn, meta["id"], mode="replace", scope="project", actor_user_id=None)
    assert out["result"]["tables"]["floors"] == 2 and out["safety"]["name"].startswith("auto-pre-restore-")
    assert _site_names(w.cb) == ["אתר בדיקה"]
    dest.close()


def test_a_destination_error_is_a_code_not_a_traceback(world, monkeypatch):
    w = world
    dest = _destination("local", w.tmp, monkeypatch)
    shutil.rmtree(w.tmp / "local-share")  # the share is gone
    with pytest.raises(ob.OffboxError) as e:
        offbox_restore.list_copies(dest)
    assert e.value.code == "destination_unavailable"
    key = offbox_keys.load(Path(w.settings.data_dir)).active_key()
    with pytest.raises(ob.OffboxError) as e2:
        offbox_restore.prepare(dest, w.obj, w.sb, current_schema=10**6, keys={ob.key_id(key): key})
    assert e2.value.code == "destination_unavailable"
    assert _stages(w.sb) == []


# ---------------------------------------------------------------- the command line (a fresh installation, no UI)


def test_command_line_list_fetch_and_restore_on_a_fresh_data_directory(world, monkeypatch, capsys, tmp_path):
    w = world
    data3 = tmp_path / "data3"
    data3.mkdir()
    dest_json = tmp_path / "dest.json"
    dest_json.write_text(json.dumps({"kind": "local", "path": str(w.share)}), encoding="utf-8")
    monkeypatch.setenv("SW_T_EXPORTED_KEY", w.key)
    base = ["--data-dir", str(data3), "--dest-json", str(dest_json), "--key-env", "SW_T_EXPORTED_KEY"]
    assert offbox_restore.main(["list", *base]) == 0
    listing = capsys.readouterr().out
    assert w.obj in listing and w.key.split(":")[2] not in listing
    fetched = tmp_path / "fetched.zip"
    assert offbox_restore.main(["fetch", *base, "--object", w.obj, "--out", str(fetched)]) == 0
    assert zipfile.ZipFile(fetched).testzip() is None and backup_svc.read_manifest(fetched)["format"] == 1
    capsys.readouterr()
    # the destructive command refuses without the confirmation
    assert offbox_restore.main(["restore", *base]) == 2
    assert offbox_restore.main(["restore", *base, "--confirm", "restore"]) == 2
    assert offbox_restore.main(["restore", *base, "--confirm", "RESTORE", "--scope", "project"]) == 0
    done = capsys.readouterr().out
    assert "auto-pre-restore-" in done and "RESTART" in done and w.key.split(":")[2] not in done
    db = Database(data3 / "smplwise.db")
    with db.connection(mode="read") as conn:
        assert [r[0] for r in conn.execute("SELECT name FROM sites")] == ["אתר בדיקה"]
        audit_rows = [tuple(r) for r in conn.execute("SELECT action, details_json FROM audit_log WHERE action = 'backup.offbox.restore'")]
    assert len(audit_rows) == 1 and "cli" in audit_rows[0][1] and "SWXB-KEY" not in json.dumps(audit_rows)
    assert not list((data3 / offbox_restore.STAGE_DIR).iterdir()), "no staged copy is left"


def test_command_line_refusals_have_exit_codes_and_codes(world, monkeypatch, capsys, tmp_path):
    w = world
    data3 = tmp_path / "data3"
    data3.mkdir()
    dest_json = tmp_path / "dest.json"
    dest_json.write_text(json.dumps({"kind": "local", "path": str(w.share)}), encoding="utf-8")
    base = ["--data-dir", str(data3), "--dest-json", str(dest_json)]
    assert offbox_restore.main(["fetch", *base]) == 1  # no key in this installation
    assert "key_missing" in capsys.readouterr().err
    wrong = "SWXB-KEY-1:" + ob.key_id(b"k" * 32) + ":" + __import__("base64").b64encode(b"k" * 32).decode()
    monkeypatch.setenv("SW_T_OTHER_KEY", wrong)
    assert offbox_restore.main(["fetch", *base, "--key-env", "SW_T_OTHER_KEY"]) == 1
    assert "key_mismatch" in capsys.readouterr().err
    assert offbox_restore.main(["list", "--data-dir", str(tmp_path / "nowhere")]) == 2
    assert offbox_restore.main(["list", "--data-dir", str(data3)]) == 1  # neither --target-id nor --dest-json
    assert "destination_invalid" in capsys.readouterr().err
