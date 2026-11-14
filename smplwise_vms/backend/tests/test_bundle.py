"""Evidence bundle and snapshots (T050 / T046): a snapshot item is a JPEG copied into the case with its hash; the
bundle ZIP holds the preserved clips with their export manifests, the snapshots, the notes, a manifest with SHA-256
per file and a readable report; bookmarks that were never preserved are listed as skipped; verification recomputes
every hash and reports a tampered or missing file; the hash is explained as integrity, not authenticity."""
from __future__ import annotations

import hashlib
import io
import json
import zipfile
from dataclasses import replace

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.routers import cases
from smplwise.services import bundle as bundle_svc
from smplwise.services import exports as ex

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64 + b"\xff\xd9"


def test_snapshot_item_bundle_and_verification(settings, monkeypatch):
    s = replace(settings, nvr_host="nvr.example", nvr_user="u", nvr_password="p")
    app = create_app(s)
    c = TestClient(app)
    seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה"}).json()
    with app.state.db.connection() as conn:
        conn.execute("UPDATE cameras SET main_track = 101")
    monkeypatch.setattr(cases, "SNAPSHOT", lambda _s, ch: JPEG)
    case = c.post("/api/v1/cases", json={"title": "פריצה", "description": "בדיקה", "tags": ["לילה"]}).json()
    note = c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "note", "note": "נראה אדם"}).json()
    snap = c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "snapshot", "camera_id": cam["id"], "note": "רגע הכניסה"})
    assert snap.status_code == 201, snap.text
    snap = snap.json()
    assert snap["kind"] == "snapshot" and snap["preservation"] == "preserved" and snap["file_sha256"] == hashlib.sha256(JPEG).hexdigest() and snap["from_at"] == snap["to_at"]
    assert c.get(snap["file_url"].replace("api/v1", "/api/v1")).content == JPEG
    assert c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "snapshot"}).status_code == 422
    # a clip bookmark that was never preserved, and a clip preserved by a finished export job with its manifest on disk
    bookmark = c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "clip", "camera_id": cam["id"], "from_at": "2026-09-14T11:00:00Z", "to_at": "2026-09-14T11:01:00Z"}).json()
    clip = c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "clip", "camera_id": cam["id"], "from_at": "2026-09-14T10:00:00Z", "to_at": "2026-09-14T10:01:00Z", "note": "רכב"}).json()
    job_dir = ex.job_dir(s, "job1")
    job_dir.mkdir(parents=True)
    (job_dir / "clip.mp4").write_bytes(b"MP4" * 100)
    (job_dir / "manifest.json").write_text(json.dumps({"pipeline_version": "export-1", "job_id": "job1"}), encoding="utf-8")
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO export_jobs(id, owner_user_id, owner_username, camera_id, camera_name, requested_from, requested_to, state, progress, error, payload_json, created_at, updated_at) VALUES ('job1','u','joni',?,'כניסה','2026-09-14T10:00:00Z','2026-09-14T10:01:00Z','done',1.0,NULL,?,'x','x')",
            (cam["id"], json.dumps({"files": [], "output": "clip.mp4", "output_name": "entrance_2026-09-14.mp4", "manifest": "manifest.json", "sha256": hashlib.sha256(b"MP4" * 100).hexdigest(), "actual_from": "2026-09-14T09:59:58Z", "actual_to": "2026-09-14T10:01:00Z"})),
        )
        conn.execute("UPDATE case_items SET export_job_id = 'job1' WHERE id = ?", (clip["id"],))

    r = c.post(f"/api/v1/cases/{case['id']}/bundle")
    assert r.status_code == 201, r.text
    b = r.json()
    assert b["name"].startswith(f"case-{case['id'][:8]}-") and b["files"] == 5 and b["skipped"] == [{"item_id": bookmark["id"], "reason": "unknown"}]
    listed = c.get(f"/api/v1/cases/{case['id']}/bundles").json()["bundles"]
    assert listed[0]["name"] == b["name"] and listed[0]["bytes"] == b["bytes"]
    dl = c.get(f"/api/v1/cases/{case['id']}/bundles/{b['name']}")
    assert dl.status_code == 200 and dl.headers["content-type"] == "application/zip" and hashlib.sha256(dl.content).hexdigest() == b["sha256"]
    assert c.get(f"/api/v1/cases/{case['id']}/bundles/../../etc/passwd").status_code == 404
    z = zipfile.ZipFile(io.BytesIO(dl.content))
    names = set(z.namelist())
    assert {"manifest.json", "MANIFEST.sha256", "manifest.sig.json", "report.html", "notes.md", f"snapshots/{snap['id']}.jpg", f"clips/{clip['id']}_entrance_2026-09-14.mp4", f"clips/{clip['id']}.export-manifest.json"} == names
    m = json.loads(z.read("manifest.json"))
    assert m["schema"] == "smplwise-evidence-bundle/1" and m["case"]["title"] == "פריצה" and m["generated_by"] and "אמיתות" in m["integrity"] and m["signature"] == "manifest.sig.json"
    by = {i["item_id"]: i for i in m["items"]}
    assert by[snap["id"]]["file"]["sha256"] == hashlib.sha256(JPEG).hexdigest() and by[snap["id"]]["source"]["kind"] == "live-snapshot"
    assert by[clip["id"]]["source"]["job_id"] == "job1" and by[clip["id"]]["source"]["actual_from"] == "2026-09-14T09:59:58Z" and by[clip["id"]]["file"]["bytes"] == 300
    assert by[bookmark["id"]]["file"] is None and by[note["id"]]["kind"] == "note"
    assert z.read(f"clips/{clip['id']}_entrance_2026-09-14.mp4") == b"MP4" * 100
    report = z.read("report.html").decode("utf-8")
    assert "פריצה" in report and "אינו מוכיח את אמיתות" in report and 'dir="rtl"' in report
    assert "נראה אדם" in z.read("notes.md").decode("utf-8")
    assert z.read("MANIFEST.sha256").decode().split()[0] == hashlib.sha256(z.read("manifest.json")).hexdigest()

    # verification: the genuine bundle passes; a tampered clip and a removed snapshot are reported by path
    ok = c.post("/api/v1/cases/bundles/verify", files={"file": (b["name"], dl.content, "application/zip")}).json()
    assert ok["ok"] is True and ok["manifest_ok"] is True and {f["status"] for f in ok["files"]} == {"ok"} and ok["extra"] == [] and ok["case"] == "פריצה"
    tampered = io.BytesIO()
    with zipfile.ZipFile(tampered, "w") as out:
        for n in z.namelist():
            if n == f"clips/{clip['id']}_entrance_2026-09-14.mp4":
                out.writestr(n, b"MP4" * 99 + b"XXX")
            elif n == f"snapshots/{snap['id']}.jpg":
                continue
            else:
                out.writestr(n, z.read(n))
        out.writestr("extra.txt", b"?")
    bad = c.post("/api/v1/cases/bundles/verify", files={"file": ("x.zip", tampered.getvalue(), "application/zip")}).json()
    assert bad["ok"] is False and bad["manifest_ok"] is True and bad["extra"] == ["extra.txt"]
    st = {f["path"]: f["status"] for f in bad["files"]}
    assert st[f"clips/{clip['id']}_entrance_2026-09-14.mp4"] == "mismatch" and st[f"snapshots/{snap['id']}.jpg"] == "missing" and st["report.html"] == "ok"
    assert bundle_svc.verify(b"not a zip")["errors"] == ["not a zip file"]
    flipped = bytearray(dl.content)
    flipped[len(flipped) // 2] ^= 0xFF
    corrupt = c.post("/api/v1/cases/bundles/verify", files={"file": ("flip.zip", bytes(flipped), "application/zip")})
    assert corrupt.status_code == 200 and corrupt.json()["ok"] is False, "a byte flipped inside the archive is reported, never a crash"
    assert c.post("/api/v1/cases/bundles/verify", files={"file": ("x.zip", b"PK\x03\x04junk", "application/zip")}).json()["ok"] is False
    # removing the snapshot item removes its file; a viewer cannot build bundles
    path = s.data_dir / snap["file_path"]
    assert path.is_file()
    assert c.delete(f"/api/v1/cases/{case['id']}/items/{snap['id']}").status_code == 204 and not path.exists()
    bind(c, s, "ron", "viewer", "installation", "*")
    assert c.post(f"/api/v1/cases/{case['id']}/bundle", headers=as_user("ron")).status_code == 403


def test_snapshot_needs_nvr(client):
    seed_tree(client)
    cam = client.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    case = client.post("/api/v1/cases", json={"title": "t"}).json()
    assert client.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "snapshot", "camera_id": cam["id"]}).status_code == 503
