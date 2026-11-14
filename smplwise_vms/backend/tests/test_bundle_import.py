"""Evidence bundle verification and import (T050, the import half): a bundle built here verifies with per-file status,
schema version, the producing installation and a plain-language summary; imported into a SECOND installation it
becomes a new read-only case marked imported with provenance, and nothing in it becomes a camera, an event or a user.
Hostile archives (ZIP-slip names, symlinks, bombs, oversize) are refused before anything is read; tampered or
incomplete bundles are reported and never imported; the same bundle is imported once; permissions are checked
before the body; the imported bytes show in the storage screen and leave with the case."""
from __future__ import annotations

import asyncio
import hashlib
import io
import json
import sqlite3
import struct
import threading
import time
import tracemalloc
import zipfile
from dataclasses import replace
from pathlib import Path

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.routers import cases
from smplwise.rbac import Principal
from smplwise.services import bundle as bundle_svc
from smplwise.services import bundle_import
from smplwise.services import signing
from smplwise.services import exports as ex

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64 + b"\xff\xd9"
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00\x01" * 200
ZIP = {"Content-Type": "application/zip"}


def _source_bundle(settings, monkeypatch, tmp_path) -> tuple[TestClient, dict, bytes, dict]:
    """Installation A: a case with a note, a snapshot, a preserved clip and a never-preserved bookmark; its bundle."""
    s = replace(settings, nvr_host="nvr.example", nvr_user="u", nvr_password="p")
    app = create_app(s)
    c = TestClient(app)
    seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה"}).json()
    with app.state.db.connection() as conn:
        conn.execute("UPDATE cameras SET main_track = 101")
    monkeypatch.setattr(cases, "SNAPSHOT", lambda _s, ch: JPEG)
    case = c.post("/api/v1/cases", json={"title": "פריצה במחסן", "description": "תיק מקור", "tags": ["לילה"]}).json()
    note = c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "note", "note": "נראה אדם ליד הדלת"}).json()
    snap = c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "snapshot", "camera_id": cam["id"]}).json()
    bookmark = c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "clip", "camera_id": cam["id"], "from_at": "2026-09-14T11:00:00Z", "to_at": "2026-09-14T11:01:00Z"}).json()
    clip = c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "clip", "camera_id": cam["id"], "from_at": "2026-09-14T10:00:00Z", "to_at": "2026-09-14T10:01:00Z", "note": "רכב"}).json()
    job_dir = ex.job_dir(s, "job1")
    job_dir.mkdir(parents=True)
    (job_dir / "clip.mp4").write_bytes(MP4)
    (job_dir / "manifest.json").write_text(json.dumps({"pipeline_version": "export-1", "job_id": "job1"}), encoding="utf-8")
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO export_jobs(id, owner_user_id, owner_username, camera_id, camera_name, requested_from, requested_to, state, progress, error, payload_json, created_at, updated_at) VALUES ('job1','u','joni',?,'כניסה','2026-09-14T10:00:00Z','2026-09-14T10:01:00Z','done',1.0,NULL,?,'x','x')",
            (cam["id"], json.dumps({"files": [], "output": "clip.mp4", "output_name": "entrance.mp4", "manifest": "manifest.json", "sha256": hashlib.sha256(MP4).hexdigest()})),
        )
        conn.execute("UPDATE case_items SET export_job_id = 'job1' WHERE id = ?", (clip["id"],))
    b = c.post(f"/api/v1/cases/{case['id']}/bundle").json()
    data = c.get(f"/api/v1/cases/{case['id']}/bundles/{b['name']}").content
    return c, case, data, {"note": note, "snap": snap, "bookmark": bookmark, "clip": clip, "camera": cam}


def _second(settings, tmp_path) -> tuple[TestClient, object]:
    s = replace(settings, data_dir=tmp_path / "other")
    app = create_app(s)
    c = TestClient(app)
    c.get("/api/v1/me")
    return c, s


def _rezip(data: bytes, change: dict[str, bytes | None] | None = None, add: dict[str, bytes] | None = None) -> bytes:
    src = zipfile.ZipFile(io.BytesIO(data))
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for n in src.namelist():
            if change and n in change:
                if change[n] is not None:
                    z.writestr(n, change[n])
                continue
            z.writestr(n, src.read(n))
        for n, v in (add or {}).items():
            z.writestr(n, v)
    return out.getvalue()


def _staging_empty(s) -> bool:
    d = s.data_dir / "imported" / ".staging"
    return not d.exists() or not any(d.iterdir())


def test_round_trip_verify_and_import_into_another_installation(settings, monkeypatch, tmp_path):
    a, case, data, it = _source_bundle(settings, monkeypatch, tmp_path)
    monkeypatch.setattr(cases, "INTEGRITY_COOLDOWN_S", 0)
    sha = hashlib.sha256(data).hexdigest()
    manifest = json.loads(zipfile.ZipFile(io.BytesIO(data)).read("manifest.json"))
    iid_a = manifest["installation"]["id"]
    assert len(iid_a) == 32 and manifest["generated_by_display"] and manifest["installation"]["app_version"]
    assert a.get("/api/v1/evidence/signing").json()["installation_id"] == iid_a

    # verification here (raw ZIP body): per file ok, this installation, confirmed by the signature
    rep = a.post("/api/v1/cases/bundles/verify?name=b.zip", content=data, headers=ZIP).json()
    assert rep["ok"] is True and rep["schema_version"] == 1 and rep["supported"] is True
    assert {f["status"] for f in rep["files"]} == {"ok"} and all(f["bytes"] is not None for f in rep["files"])
    assert rep["origin"]["installation_id"] == iid_a and rep["origin"]["this_installation"] is True and rep["origin"]["confirmed_by_signature"] is True
    assert rep["origin"]["producer"] == "this_confirmed"
    assert rep["origin"]["exported_at"] == manifest["generated_at"] and rep["origin"]["exported_by"] == "joni"
    assert rep["bundle"] == {"sha256": sha, "bytes": len(data), "name": "b.zip"} and rep["importable"] is True and rep["already_imported"] is None
    assert "אינה מוכיחה שהצילום אמיתי" in rep["summary"] and "הופקה בהתקנה זו" in rep["summary"]

    # installation B: the same bundle is someone else's; integrity holds, the key is a stranger's
    b, sb = _second(settings, tmp_path)
    rep_b = b.post("/api/v1/cases/bundles/verify", files={"file": ("b.zip", data, "application/zip")}).json()
    assert rep_b["ok"] is True and rep_b["origin"]["this_installation"] is False and rep_b["signature"]["trust"] == "embedded_key_only"
    assert f"הופקה בהתקנה אחרת ({iid_a})" in rep_b["summary"] and rep_b["bundle"]["name"] == "b.zip"
    assert _staging_empty(sb), "the uploaded temp file is removed"

    r = b.post("/api/v1/cases/bundles/import?name=b.zip", content=data, headers=ZIP)
    assert r.status_code == 201, r.text
    imp = r.json()
    new = imp["case"]
    assert new["origin"] == "imported" and new["title"] == "פריצה במחסן" and new["id"] != case["id"] and new["owner_username"] == "joni"
    p = new["provenance"]
    assert p["source_installation_id"] == iid_a and p["this_installation"] is False and p["bundle_sha256"] == sha and p["exported_at"] == manifest["generated_at"]
    assert p["producer"] == "other" and p["confirmed_by_signature"] is False
    assert p["exported_by_display"] == "joni" and p["verification"]["ok"] is True and p["source_case"]["id"] == case["id"] and p["signature"]["trust"] == "embedded_key_only"
    assert imp["items"] == 4 and imp["files"] == 3  # snapshot, clip and its export manifest

    detail = b.get(f"/api/v1/cases/{new['id']}").json()
    by_kind = {}
    for i in detail["items"]:
        assert i["imported"] is True and i["camera_id"] is None and i["event_id"] is None and i["export_job_id"] is None
        by_kind.setdefault(i["kind"], []).append(i)
    note = by_kind["note"][0]
    assert note["note"] == "נראה אדם ליד הדלת" and note["preservation"] == "none" and note["origin"]["added_by"] == "joni"
    snap = by_kind["snapshot"][0]
    assert snap["preservation"] == "preserved" and snap["file_path"].startswith(f"imported/{sha}/snapshots/") and snap["file_sha256"] == hashlib.sha256(JPEG).hexdigest()
    assert snap["camera_name"] == "כניסה" and snap["origin"]["camera_id"] == it["camera"]["id"]
    clips = {i["origin"]["source_item_id"]: i for i in by_kind["clip"]}
    assert clips[it["clip"]["id"]]["preservation"] == "preserved" and clips[it["clip"]["id"]]["from_at"] == "2026-09-14T10:00:00Z"
    assert clips[it["bookmark"]["id"]]["preservation"] == "not_in_bundle" and clips[it["bookmark"]["id"]]["file_path"] is None
    assert detail["counts"]["preserved"] == 2
    # nothing from the bundle became a camera, an event, an export job or a user here
    assert b.get("/api/v1/cameras").json()["cameras"] == []
    with b.app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM events").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM export_jobs").fetchone()[0] == 0
        assert {r[0] for r in conn.execute("SELECT username FROM users")} == {"joni"}
        audit = conn.execute("SELECT decision, details_json FROM audit_log WHERE action = 'case.import'").fetchall()
        assert [x["decision"] for x in audit] == ["allowed"] and json.loads(audit[0]["details_json"])["bundle_sha256"] == sha
    assert (sb.data_dir / "imported" / sha / "manifest.json").is_file() and (sb.data_dir / "imported" / sha / "manifest.sig.json").is_file()
    assert not (sb.data_dir / "imported" / sha / "report.html").exists(), "the bundle's report is hashed, never stored to be rendered"

    # the imported files are served as what they are, sandboxed and never sniffed
    f = b.get("/" + snap["file_url"])
    assert f.status_code == 200 and f.content == JPEG and f.headers["content-type"] == "image/jpeg" and f.headers["x-content-type-options"] == "nosniff" and "sandbox" in f.headers["content-security-policy"]
    v = b.get("/" + clips[it["clip"]["id"]]["file_url"])
    assert v.status_code == 200 and v.content == MP4 and v.headers["content-type"] == "video/mp4"

    # imported items are read-only; the recorded hashes re-check; a changed copy is reported
    assert b.delete(f"/api/v1/cases/{new['id']}/items/{note['id']}").json()["code"] == "imported_read_only"
    chk = b.post(f"/api/v1/cases/{new['id']}/integrity").json()
    assert chk["ok"] is True and len(chk["files"]) == 2
    (sb.data_dir / snap["file_path"]).write_bytes(JPEG + b"x")
    chk = b.post(f"/api/v1/cases/{new['id']}/integrity").json()
    assert chk["ok"] is False and {f["item_id"]: f["status"] for f in chk["files"]}[snap["id"]] == "mismatch"
    (sb.data_dir / snap["file_path"]).write_bytes(JPEG)

    # the same bundle again: 409 pointing at the existing case (verify says so as well)
    dup = b.post("/api/v1/cases/bundles/import", content=data, headers=ZIP)
    assert dup.status_code == 409 and dup.json()["code"] == "already_imported" and dup.json()["details"]["case_id"] == new["id"]
    again = b.post("/api/v1/cases/bundles/verify", content=data, headers=ZIP).json()
    assert again["already_imported"]["case_id"] == new["id"] and again["importable"] is False

    # an imported case bundles again: its copies travel on, marked as imported, and verify back at A
    b2 = b.post(f"/api/v1/cases/{new['id']}/bundle").json()
    data2 = b.get("/" + b2["download_url"]).content
    m2 = json.loads(zipfile.ZipFile(io.BytesIO(data2)).read("manifest.json"))
    srcs = [i["source"]["kind"] for i in m2["items"] if i["file"]]
    assert srcs.count("imported") == 2 and m2["installation"]["id"] != iid_a
    back = a.post("/api/v1/cases/bundles/verify", content=data2, headers=ZIP).json()
    assert back["ok"] is True and back["origin"]["this_installation"] is False

    # storage accounting: the imported bytes count, and leave with the case; then the bundle can be imported again
    local = b.get("/api/v1/storage").json()["local"]
    stored = sum(f.stat().st_size for f in (sb.data_dir / "imported" / sha).rglob("*") if f.is_file())
    assert local["imported"] == {"cases": 1, "bytes": stored} and stored >= len(JPEG) + len(MP4)
    assert b.delete(f"/api/v1/cases/{new['id']}").status_code == 204
    assert not (sb.data_dir / "imported" / sha).exists()
    assert b.get("/api/v1/storage").json()["local"]["imported"] == {"cases": 0, "bytes": 0}
    assert b.post("/api/v1/cases/bundles/import", content=data, headers=ZIP).status_code == 201
    assert _staging_empty(sb)


def test_tampered_and_incomplete_bundles_are_reported_and_never_imported(settings, monkeypatch, tmp_path):
    a, _case, data, it = _source_bundle(settings, monkeypatch, tmp_path)
    b, sb = _second(settings, tmp_path)
    names = zipfile.ZipFile(io.BytesIO(data)).namelist()
    clip_name = next(n for n in names if n.startswith("clips/") and n.endswith(".mp4"))
    snap_name = next(n for n in names if n.startswith("snapshots/"))

    tampered = _rezip(data, {clip_name: MP4[:-1] + b"X"})
    rep = b.post("/api/v1/cases/bundles/verify", content=tampered, headers=ZIP).json()
    st = {f["path"]: f["status"] for f in rep["files"]}
    assert rep["ok"] is False and st[clip_name] == "mismatch" and st["report.html"] == "ok" and rep["counts"]["mismatch"] == 1 and rep["importable"] is False
    assert "האימות נכשל" in rep["summary"] and "1 קבצים שונו" in rep["summary"]
    r = b.post("/api/v1/cases/bundles/import", content=tampered, headers=ZIP)
    assert r.status_code == 409 and r.json()["code"] == "bundle_not_verified" and r.json()["details"]["counts"]["mismatch"] == 1

    missing = _rezip(data, {snap_name: None})
    rep = b.post("/api/v1/cases/bundles/verify", content=missing, headers=ZIP).json()
    assert rep["ok"] is False and {f["path"]: f["status"] for f in rep["files"]}[snap_name] == "missing" and rep["counts"]["missing"] == 1
    assert b.post("/api/v1/cases/bundles/import", content=missing, headers=ZIP).status_code == 409

    extra = _rezip(data, add={"clips/extra.mp4": b"x"})
    assert b.post("/api/v1/cases/bundles/verify", content=extra, headers=ZIP).json()["extra"] == ["clips/extra.mp4"]
    assert b.post("/api/v1/cases/bundles/import", content=extra, headers=ZIP).status_code == 409

    # a manifest rewritten to match a swapped file breaks MANIFEST.sha256 and the signature
    m = json.loads(zipfile.ZipFile(io.BytesIO(data)).read("manifest.json"))
    for f in m["files"]:
        if f["path"] == clip_name:
            f["sha256"] = hashlib.sha256(b"forged").hexdigest()
    for i in m["items"]:
        if i["file"] and i["file"]["path"] == clip_name:
            i["file"]["sha256"] = hashlib.sha256(b"forged").hexdigest()
    forged = _rezip(data, {clip_name: b"forged", "manifest.json": json.dumps(m).encode()})
    rep = b.post("/api/v1/cases/bundles/verify", content=forged, headers=ZIP).json()
    assert rep["ok"] is False and rep["manifest_ok"] is False and rep["signature"]["valid"] is False
    assert b.post("/api/v1/cases/bundles/import", content=forged, headers=ZIP).status_code == 409

    assert b.post("/api/v1/cases/bundles/verify", content=b"not a zip at all", headers=ZIP).json()["errors"] == ["not a zip file"]
    assert b.post("/api/v1/cases/bundles/import", content=b"not a zip at all", headers=ZIP).status_code == 409

    assert b.get("/api/v1/cases").json()["cases"] == []
    assert not any(p for p in (sb.data_dir / "imported").iterdir() if p.name != ".staging") and _staging_empty(sb)
    with b.app.state.db.connection() as conn:
        rows = conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'case.import'").fetchall()
        assert rows and {r["decision"] for r in rows} == {"denied"} and {r["reason"] for r in rows} == {"not_verified"}


def _zip_with(entries: list[tuple[zipfile.ZipInfo | str, bytes]]) -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        for info, data in entries:
            z.writestr(info, data)
    return out.getvalue()


def _raw_name(data: bytes, placeholder: str, name: str) -> bytes:
    """Rewrite an entry name inside the archive bytes (zipfile itself normalises some names on write)."""
    assert len(placeholder) == len(name)
    return data.replace(placeholder.encode(), name.encode())


@pytest.mark.parametrize("name", ["../evil.txt", "/abs/evil.txt", "C:/evil.txt", "a/../../evil.txt", "a\\..\\evil.txt", "a//evil.txt"])
def test_zip_slip_entries_are_refused_before_reading(settings, tmp_path, name):
    b, sb = _second(settings, tmp_path)
    placeholder = "P" * len(name)
    data = _raw_name(_zip_with([("manifest.json", b"{}"), (placeholder, b"boom")]), placeholder, name)
    r = b.post("/api/v1/cases/bundles/verify", content=data, headers=ZIP)
    assert r.status_code == 422 and r.json()["code"] == "unsafe_bundle" and r.json()["details"]["reason"] == "unsafe_entries", r.text
    r = b.post("/api/v1/cases/bundles/import", content=data, headers=ZIP)
    assert r.status_code == 422 and r.json()["code"] == "unsafe_bundle"
    assert not (tmp_path / "evil.txt").exists() and not (sb.data_dir / "evil.txt").exists() and _staging_empty(sb)
    with b.app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'case.bundle.verify' AND decision = 'denied' AND reason = 'unsafe_entries'").fetchone()[0] == 1


def test_symlinks_bombs_and_entry_counts_are_refused(settings, tmp_path):
    b, sb = _second(settings, tmp_path)
    link = zipfile.ZipInfo("clips/link")
    link.create_system = 3
    link.external_attr = (0o120777 << 16)
    data = _zip_with([("manifest.json", b"{}"), (link, b"/etc/passwd")])
    r = b.post("/api/v1/cases/bundles/verify", content=data, headers=ZIP)
    assert r.status_code == 422 and r.json()["details"]["entries"][0]["reason"] == "symbolic link"

    bomb = io.BytesIO()
    with zipfile.ZipFile(bomb, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", b"{}")
        z.writestr("clips/zeros.bin", b"\x00" * (20 * 1024 * 1024))
    r = b.post("/api/v1/cases/bundles/verify", content=bomb.getvalue(), headers=ZIP)
    assert r.status_code == 422 and r.json()["details"]["entries"][0]["reason"] == "compression ratio (zip bomb)"

    many = io.BytesIO()
    with zipfile.ZipFile(many, "w") as z:
        for i in range(bundle_svc.Limits().max_entries + 1):
            z.writestr(f"n/{i}", b"")
    r = b.post("/api/v1/cases/bundles/verify", content=many.getvalue(), headers=ZIP)
    assert r.status_code == 422 and r.json()["details"]["reason"] == "too_many_entries"

    dup = _raw_name(_zip_with([("manifest.json", b"{}"), ("a.txt", b"1"), ("b.txt", b"2")]), "b.txt", "a.txt")
    r = b.post("/api/v1/cases/bundles/verify", content=dup, headers=ZIP)
    assert r.status_code == 422 and r.json()["details"]["entries"][0]["reason"] == "duplicate entry name"

    # the declared uncompressed total is bounded too (zipfile never inflates past a declared size)
    with pytest.raises(bundle_svc.UnsafeBundle) as e:
        bundle_svc.verify_source(_zip_with([("manifest.json", b"{}"), ("x.bin", b"1" * 5000)]), limits=bundle_svc.Limits(max_uncompressed=1000))
    assert e.value.code == "too_large_uncompressed"
    assert _staging_empty(sb)


def test_oversize_uploads_are_refused(settings, tmp_path):
    b, sb = _second(settings, tmp_path)
    assert b.patch("/api/v1/settings", json={"cases.import_max_mb": 16}).status_code == 200
    big = b"\x00" * (16 * 1024 * 1024 + 1)
    r = b.post("/api/v1/cases/bundles/verify", content=big, headers=ZIP)
    assert r.status_code == 413 and r.json()["code"] == "payload_too_large" and r.json()["details"]["max_bytes"] == 16 * 1024 * 1024
    r = b.post("/api/v1/cases/bundles/import", files={"file": ("big.zip", big, "application/zip")})
    assert r.status_code == 413

    # a body without Content-Length (chunked) is counted while it streams
    def gen():
        for _ in range(17):
            yield b"\x00" * (1024 * 1024)

    r = b.post("/api/v1/cases/bundles/verify", content=gen(), headers=ZIP)
    assert r.status_code == 413
    assert b.post("/api/v1/cases/bundles/verify", content=b"x", headers={"Content-Type": "text/html"}).status_code == 415
    assert b.post("/api/v1/cases/bundles/verify", content=b"", headers=ZIP).status_code == 422
    assert b.patch("/api/v1/settings", json={"cases.import_max_mb": 8}).status_code == 422
    assert _staging_empty(sb)


def test_permissions_are_checked_before_the_body(settings, monkeypatch, tmp_path):
    a, _case, data, _it = _source_bundle(settings, monkeypatch, tmp_path)
    b, sb = _second(settings, tmp_path)
    tree = seed_tree(b)
    # one camera anchored on a floor of the site, so a site-scoped operator reads cases (anchor row written directly)
    cam = b.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()
    raw = sqlite3.connect(sb.db_path)
    raw.execute("PRAGMA foreign_keys=OFF")
    raw.execute(
        "INSERT INTO map_anchors(id, floor_id, plan_version_id, resource_type, resource_id, x, y, rotation_degrees, field_of_view_degrees, layer_id, label, revision, effective_from, created_by, updated_by, updated_at) "
        "VALUES ('a1', ?, 'pv', 'camera', ?, 0.5, 0.5, 0, 90, 'cameras', 'x', 1, '2026-09-01T00:00:00Z', 't', 't', '2026-09-01T00:00:00Z')",
        (tree["floor2"], cam["id"]),
    )
    raw.commit()
    raw.close()
    bind(b, sb, "ron", "viewer", "installation", "*")
    bind(b, sb, "sara", "operator", "site", tree["site"])
    bind(b, sb, "dan", "operator", "installation", "*")
    # a refused caller gets an audited 403 - never a 415 / 422 / 413 for a body it was not entitled to send
    for who in ("ron", "nobody"):
        b.get("/api/v1/me", headers=as_user(who))
        for path in ("verify", "import"):
            r = b.post(f"/api/v1/cases/bundles/{path}", content=b"junk", headers={**as_user(who), "Content-Type": "text/plain"})
            assert r.status_code == 403, (who, path, r.text)
    # a site-scoped operator verifies, but imports only with cases.manage for the whole installation
    assert b.post("/api/v1/cases/bundles/verify", content=data, headers={**as_user("sara"), **ZIP}).json()["ok"] is True
    assert b.post("/api/v1/cases/bundles/import", content=b"junk", headers={**as_user("sara"), "Content-Type": "text/plain"}).status_code == 403
    assert b.get("/api/v1/cases", headers=as_user("sara")).json()["can_import"] is False
    assert b.get("/api/v1/cases", headers=as_user("dan")).json()["can_import"] is True
    r = b.post("/api/v1/cases/bundles/import", content=data, headers={**as_user("dan"), **ZIP})
    assert r.status_code == 201
    cid = r.json()["case"]["id"]
    # the scoped operator sees the imported case but not its items (they belong to no camera of hers)
    d = b.get(f"/api/v1/cases/{cid}", headers=as_user("sara")).json()
    assert d["items"] == [] and d["hidden_items"] == 4
    snap = next(i for i in b.get(f"/api/v1/cases/{cid}").json()["items"] if i["kind"] == "snapshot")
    assert b.get("/" + snap["file_url"], headers=as_user("sara")).status_code == 403
    with b.app.state.db.connection() as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE decision = 'denied' AND action IN ('events.read', 'cases.manage')").fetchone()[0]
    assert denied >= 5 and _staging_empty(sb)


def test_installation_id_survives_a_backup_restore(settings, tmp_path):
    from smplwise.services import backup

    assert "installation_id" in backup.SETTINGS_KEEP


# ---------------------------------------------------------------- review round 1 (security)

MB = 1024 * 1024


def _patch_cd(data: bytes, name: str, flag: int | None = None, usize: int | None = None) -> bytes:
    """Rewrite one central-directory record's flag bits / uncompressed size (a lying or crafted archive)."""
    b = bytearray(data)
    i = 0
    while True:
        i = b.find(b"PK\x01\x02", i)
        assert i >= 0, name
        nlen = struct.unpack_from("<H", b, i + 28)[0]
        if bytes(b[i + 46:i + 46 + nlen]) == name.encode():
            if flag is not None:
                struct.pack_into("<H", b, i + 8, flag)
            if usize is not None:
                struct.pack_into("<I", b, i + 24, usize)
            return bytes(b)
        i += 4


def test_central_directory_is_bounded_before_zipfile_indexes_it(settings, tmp_path):
    b, sb = _second(settings, tmp_path)
    # ZIP64 records declaring a million entries: refused from the end records alone, fast and without the index
    rec = struct.pack("<4sQ2H2L4Q", b"PK\x06\x06", 44, 45, 45, 0, 0, 1_000_000, 1_000_000, 46_000_000, 0)
    loc = struct.pack("<4sLQL", b"PK\x06\x07", 0, 0, 1)
    eocd = struct.pack("<4s4H2LH", b"PK\x05\x06", 0, 0, 0xFFFF, 0xFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0)
    million = rec + loc + eocd
    tracemalloc.start()
    t0 = time.monotonic()
    with pytest.raises(bundle_svc.UnsafeBundle) as e:
        bundle_svc.verify_source(million)
    took = time.monotonic() - t0
    _cur, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    assert e.value.code == "too_many_entries" and took < 1.0 and peak < 2 * MB
    r = b.post("/api/v1/cases/bundles/verify", content=million, headers=ZIP)
    assert r.status_code == 422 and r.json()["details"]["reason"] == "too_many_entries"
    # a small count but a central directory far larger than 5000 records can be
    huge = struct.pack("<4s4H2LH", b"PK\x05\x06", 0, 0, 3, 3, 10_000_000, 0, 0)
    r = b.post("/api/v1/cases/bundles/verify", content=huge, headers=ZIP)
    assert r.status_code == 422 and r.json()["details"]["reason"] == "central_directory_too_large"
    # an end record that under-states the count: zipfile's index is bounded by the directory size, inspect() refuses
    many = io.BytesIO()
    with zipfile.ZipFile(many, "w") as z:
        for i in range(bundle_svc.Limits().max_entries + 1):
            z.writestr(f"{i}", b"")
    lying = bytearray(many.getvalue())
    struct.pack_into("<HH", lying, len(lying) - 22 + 8, 10, 10)
    r = b.post("/api/v1/cases/bundles/verify", content=bytes(lying), headers=ZIP)
    assert r.status_code == 422 and r.json()["details"]["reason"] == "too_many_entries"
    assert _staging_empty(sb)


def test_lying_sizes_encrypted_and_control_char_entries(settings, monkeypatch, tmp_path):
    a, _case, data, _it = _source_bundle(settings, monkeypatch, tmp_path)
    b, sb = _second(settings, tmp_path)
    # a member whose declared size is smaller than its data: zipfile stops at the declared size, the CRC fails
    lying = _patch_cd(data, "notes.md", usize=3)
    rep = b.post("/api/v1/cases/bundles/verify", content=lying, headers=ZIP).json()
    assert rep["ok"] is False and {f["path"]: f["status"] for f in rep["files"]}["notes.md"] == "corrupt"
    assert b.post("/api/v1/cases/bundles/import", content=lying, headers=ZIP).status_code == 409
    # an entry flagged encrypted
    enc = _patch_cd(data, "notes.md", flag=0x1)
    r = b.post("/api/v1/cases/bundles/verify", content=enc, headers=ZIP)
    assert r.status_code == 422 and r.json()["details"]["entries"][0]["reason"] == "encrypted entry"
    # a control character in a name
    ctl = _raw_name(_zip_with([("manifest.json", b"{}"), ("aXb.txt", b"1")]), "aXb.txt", "a\x01b.txt")
    r = b.post("/api/v1/cases/bundles/verify", content=ctl, headers=ZIP)
    assert r.status_code == 422 and r.json()["details"]["entries"][0]["reason"] == "control character in the name"
    # a symlink on the import route
    link = zipfile.ZipInfo("clips/link")
    link.create_system = 3
    link.external_attr = 0o120777 << 16
    r = b.post("/api/v1/cases/bundles/import", content=_zip_with([("manifest.json", b"{}"), (link, b"/etc/passwd")]), headers=ZIP)
    assert r.status_code == 422 and r.json()["code"] == "unsafe_bundle"
    assert b.get("/api/v1/cases").json()["cases"] == [] and _staging_empty(sb)


def _strip_signature(data: bytes, mutate) -> bytes:
    """An attacker's copy: the signature removed, the manifest changed, MANIFEST.sha256 recomputed."""
    z = zipfile.ZipFile(io.BytesIO(data))
    m = json.loads(z.read("manifest.json"))
    mutate(m)
    mb = json.dumps(m, ensure_ascii=False).encode()
    return _rezip(data, {"manifest.json": mb, "manifest.sig.json": None, "MANIFEST.sha256": (hashlib.sha256(mb).hexdigest() + "  manifest.json\n").encode()})


def test_unsigned_bundle_with_our_id_is_only_a_claim(settings, monkeypatch, tmp_path):
    a, _case, data, _it = _source_bundle(settings, monkeypatch, tmp_path)

    def mutate(m):
        m["case"]["title"] = "\u202eזויף\u202c"
        m["case"]["tags"] = ["\u2066תג\x07\u2069"]
        m["generated_at"] = "yesterday-ish"

    forged = _strip_signature(data, mutate)
    rep = a.post("/api/v1/cases/bundles/verify?name=%E2%80%AEevil%07.zip", content=forged, headers=ZIP).json()
    assert rep["ok"] is True and rep["signature"]["present"] is False
    o = rep["origin"]
    assert o["this_installation"] is True and o["confirmed_by_signature"] is False and o["producer"] == "this_claimed"
    assert o["exported_at"] is None and rep["generated_at"] is None, "a garbage date never reaches the client"
    assert "טענה ולא הוכחה" in rep["summary"] and rep["bundle"]["name"] == "evil.zip" and rep["case"] == "זויף"
    r = a.post("/api/v1/cases/bundles/import", content=forged, headers=ZIP)
    assert r.status_code == 201, r.text
    p = r.json()["case"]["provenance"]
    assert p["producer"] == "this_claimed" and p["this_installation"] is True and p["confirmed_by_signature"] is False and p["exported_at"] is None
    assert r.json()["case"]["title"] == "זויף" and r.json()["case"]["tags"] == ["תג"]


def test_concurrent_duplicate_import_creates_one_case(settings, monkeypatch, tmp_path):
    a, _case, data, _it = _source_bundle(settings, monkeypatch, tmp_path)
    b, sb = _second(settings, tmp_path)
    sha = hashlib.sha256(data).hexdigest()
    who = Principal(user_id="dev-joni", username="joni", display_name="joni", source="dev")
    results: list[object] = []
    barrier = threading.Barrier(2)

    def run(i: int) -> None:
        path = tmp_path / f"up{i}.zip"
        path.write_bytes(data)
        up = {"path": path, "sha256": sha, "bytes": len(data), "name": "b.zip"}
        barrier.wait()
        try:
            results.append(cases._import_bundle(b.app.state.db, sb, up, who, None, None, signing.load_keyring(sb), 512 * MB))
        except Exception as exc:  # noqa: BLE001
            results.append(exc)

    threads = [threading.Thread(target=run, args=(i,)) for i in range(2)]
    for th in threads:
        th.start()
    for th in threads:
        th.join()
    ok = [x for x in results if isinstance(x, dict)]
    errs = [x for x in results if not isinstance(x, dict)]
    assert len(ok) == 1 and len(errs) == 1 and getattr(errs[0], "code", None) == "already_imported"
    assert len(b.get("/api/v1/cases").json()["cases"]) == 1
    assert (sb.data_dir / "imported" / sha / "manifest.json").is_file() and _staging_empty(sb)
    # delete + immediate re-import: the new files stay (the delete detaches only while no case refers to the hash)
    assert b.delete(f"/api/v1/cases/{ok[0]['case']['id']}").status_code == 204
    assert b.post("/api/v1/cases/bundles/import", content=data, headers=ZIP).status_code == 201
    assert (sb.data_dir / "imported" / sha / "manifest.json").is_file()


def test_one_transfer_at_a_time_free_space_and_integrity_cooldown(settings, monkeypatch, tmp_path):
    a, _case, data, _it = _source_bundle(settings, monkeypatch, tmp_path)
    b, sb = _second(settings, tmp_path)
    assert cases._TRANSFER_LOCK.acquire(blocking=False)
    try:
        for path in ("verify", "import"):
            r = b.post(f"/api/v1/cases/bundles/{path}", content=data, headers=ZIP)
            assert r.status_code == 429 and r.json()["code"] == "busy" and r.json()["retryable"] is True
    finally:
        cases._TRANSFER_LOCK.release()
    # below storage.min_free_mb: 507 before anything is written
    assert b.get("/api/v1/settings").json()["settings"]["storage.min_free_mb"] == 1024
    monkeypatch.setattr(bundle_import, "free_bytes", lambda s: 1100 * MB)
    r = b.post("/api/v1/cases/bundles/verify", content=data, headers=ZIP)
    assert r.status_code == 200
    monkeypatch.setattr(bundle_import, "free_bytes", lambda s: 1000 * MB)
    r = b.post("/api/v1/cases/bundles/verify", content=data, headers=ZIP)
    assert r.status_code == 507 and r.json()["code"] == "insufficient_storage" and r.json()["details"]["min_free_bytes"] == 1024 * MB
    # the import checks again before it copies the files out
    calls = iter([10_000 * MB] + [1024 * MB + 10] * 10)
    monkeypatch.setattr(bundle_import, "free_bytes", lambda s: next(calls))
    r = b.post("/api/v1/cases/bundles/import", content=data, headers=ZIP)
    assert r.status_code == 507 and b.get("/api/v1/cases").json()["cases"] == [] and _staging_empty(sb)
    monkeypatch.setattr(bundle_import, "free_bytes", lambda s: 10_000 * MB)
    cid = b.post("/api/v1/cases/bundles/import", content=data, headers=ZIP).json()["case"]["id"]
    # integrity: one re-hash per case per minute, one at a time
    assert b.post(f"/api/v1/cases/{cid}/integrity").status_code == 200
    r = b.post(f"/api/v1/cases/{cid}/integrity")
    assert r.status_code == 429 and r.json()["code"] == "cooldown"
    monkeypatch.setattr(cases, "INTEGRITY_COOLDOWN_S", 0)
    assert cases._INTEGRITY_LOCK.acquire(blocking=False)
    try:
        assert b.post(f"/api/v1/cases/{cid}/integrity").json()["code"] == "busy"
    finally:
        cases._INTEGRITY_LOCK.release()
    assert b.post(f"/api/v1/cases/{cid}/integrity").status_code == 200


def test_client_disconnect_and_chunked_multipart_over_the_cap(settings, tmp_path):
    b, sb = _second(settings, tmp_path)
    messages = [{"type": "http.request", "body": b"PK\x03\x04" + b"x" * 4096, "more_body": True}, {"type": "http.disconnect"}]

    async def receive():
        return messages.pop(0) if messages else {"type": "http.disconnect"}

    sent: list[dict] = []

    async def send(message):
        sent.append(message)

    scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "POST", "scheme": "http", "path": "/api/v1/cases/bundles/verify",
             "raw_path": b"/api/v1/cases/bundles/verify", "query_string": b"", "root_path": "", "headers": [(b"content-type", b"application/zip"), (b"host", b"testserver")],
             "client": ("testclient", 50000), "server": ("testserver", 80)}
    try:
        asyncio.run(b.app(scope, receive, send))
    except Exception:  # noqa: BLE001 - the server side of a vanished client may raise; what matters is what is left behind
        pass
    assert _staging_empty(sb) and not cases._TRANSFER_LOCK.locked()

    assert b.patch("/api/v1/settings", json={"cases.import_max_mb": 16}).status_code == 200
    boundary = "swT050boundary"

    def body():
        yield f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="big.zip"\r\nContent-Type: application/zip\r\n\r\n'.encode()
        for _ in range(17):
            yield b"\x00" * MB
        yield f"\r\n--{boundary}--\r\n".encode()

    r = b.post("/api/v1/cases/bundles/import", content=body(), headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    assert r.status_code == 413 and r.json()["code"] == "payload_too_large"
    assert _staging_empty(sb) and not cases._TRANSFER_LOCK.locked()



def _slow_upload(app, path: str, headers: list[tuple[bytes, bytes]], chunks: list[bytes], pause_s: float) -> list[dict]:
    """Drive the ASGI app with a body that trickles: the first chunk, then silence of pause_s per further chunk."""
    queue = [{"type": "http.request", "body": c, "more_body": True} for c in chunks]

    state = {"n": 0}

    async def receive():
        if queue:
            if state["n"]:
                await asyncio.sleep(pause_s)
            state["n"] += 1
            return queue.pop(0)
        await asyncio.sleep(3600)  # a client that never finishes

    sent: list[dict] = []

    async def send(message):
        sent.append(message)

    scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "POST", "scheme": "http", "path": path,
             "raw_path": path.encode(), "query_string": b"", "root_path": "", "headers": [(b"host", b"testserver"), *headers],
             "client": ("testclient", 50001), "server": ("testserver", 80)}
    asyncio.run(app(scope, receive, send))
    return sent


def test_a_trickling_upload_times_out_and_frees_the_lock(settings, monkeypatch, tmp_path):
    b, sb = _second(settings, tmp_path)
    monkeypatch.setattr(cases, "UPLOAD_IDLE_S", 0.3)
    for path in ("/api/v1/cases/bundles/verify", "/api/v1/cases/bundles/import"):
        sent = _slow_upload(b.app, path, [(b"content-type", b"application/zip")], [b"PK\x03\x04" + b"x" * 1024], 0)
        start = next(m for m in sent if m["type"] == "http.response.start")
        body = b"".join(m.get("body", b"") for m in sent if m["type"] == "http.response.body")
        assert start["status"] == 408 and json.loads(body)["code"] == "upload_timeout"
        assert _staging_empty(sb) and not cases._TRANSFER_LOCK.locked()
    # multipart that stalls after its first part
    boundary = "swSlow"
    head = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="s.zip"\r\nContent-Type: application/zip\r\n\r\n'.encode()
    sent = _slow_upload(b.app, "/api/v1/cases/bundles/verify", [(b"content-type", f"multipart/form-data; boundary={boundary}".encode())], [head + b"x" * 2048], 0)
    assert next(m for m in sent if m["type"] == "http.response.start")["status"] == 408
    assert _staging_empty(sb) and not cases._TRANSFER_LOCK.locked()
    # the overall deadline: chunks keep coming, each within the idle timeout, but the whole body takes too long
    monkeypatch.setattr(cases, "UPLOAD_IDLE_S", 5)
    monkeypatch.setattr(cases, "UPLOAD_DEADLINE_S", 0.5)
    sent = _slow_upload(b.app, "/api/v1/cases/bundles/verify", [(b"content-type", b"application/zip")], [b"x" * 100] * 10, 0.2)
    assert next(m for m in sent if m["type"] == "http.response.start")["status"] == 408
    assert _staging_empty(sb) and not cases._TRANSFER_LOCK.locked()
    # and the next upload goes through
    assert b.post("/api/v1/cases/bundles/verify", content=b"not a zip", headers=ZIP).status_code == 200
