"""Evidence bundle verification and import (T050, the import half): a bundle built here verifies with per-file status,
schema version, the producing installation and a plain-language summary; imported into a SECOND installation it
becomes a new read-only case marked imported with provenance, and nothing in it becomes a camera, an event or a user.
Hostile archives (ZIP-slip names, symlinks, bombs, oversize) are refused before anything is read; tampered or
incomplete bundles are reported and never imported; the same bundle is imported once; permissions are checked
before the body; the imported bytes show in the storage screen and leave with the case."""
from __future__ import annotations

import hashlib
import io
import json
import sqlite3
import zipfile
from dataclasses import replace
from pathlib import Path

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.routers import cases
from smplwise.services import bundle as bundle_svc
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
