"""Export jobs (T048) and playback groups (chapter 25) with the NVR and go2rtc faked."""
from __future__ import annotations

import shutil
from dataclasses import replace
from pathlib import Path

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient
from test_recordings import FakeGo2rtc, set_track, xml_page

from smplwise.main import create_app
from smplwise.services import exports as ex
from smplwise.services import nvr, playback as pb, playback_groups as pg, recordings


def fake_pages(files):
    """`files` = [(start_raw, end_raw, kind, name, size)] → search pages with playback URIs carrying name/size."""

    def fake_search(_settings, track_id, start_wall, end_wall, position=0, page_size=40, search_id=None):
        items = [(s, e, k) for s, e, k, _, _ in files]
        page = nvr.parse_search_response(xml_page(items, "OK"), track_id)
        for m, (_, _, _, name, size) in zip(page.matches, files):
            m.playback_uri = f"rtsp://nvr.local:90/Streaming/tracks/{track_id}/?starttime=x&endtime=y&name={name}&size={size}"
        return page

    return fake_search


@pytest.fixture()
def lab(settings, monkeypatch):
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p", go2rtc_url="http://go2rtc:1984")
    app = create_app(s)
    c = TestClient(app)
    recordings.invalidate()
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    set_track(s, cam["id"])
    files = [
        ("2026-09-14T10:00:00Z", "2026-09-14T10:02:00Z", "MOTION", "f1", 1000),
        ("2026-09-14T10:05:00Z", "2026-09-14T10:07:00Z", "MOTION", "f2", 2000),
    ]
    monkeypatch.setattr(nvr, "search_recordings", fake_pages(files))
    ex.WORKER.db, ex.WORKER.settings = app.state.db, s
    ex.WORKER.cancel_flags.clear()
    return c, s, cam


def fake_downloader(contents: bytes, fail_names: set[str] | None = None):
    def dl(_settings, playback_uri, dest, progress=None):
        name = playback_uri.split("name=")[1].split("&")[0]
        if fail_names and name in fail_names:
            from smplwise.errors import ApiError

            raise ApiError(503, "source_unavailable", "down", retryable=True)
        Path(dest).write_bytes(contents)
        if progress:
            progress(len(contents))

    return dl


def test_estimate_and_permission(lab, monkeypatch):
    c, s, cam = lab
    # 07:00Z..07:10Z = 10:00..10:10 wall clock → both files
    r = c.post("/api/v1/exports/estimate", json={"camera_id": cam["id"], "from_at": "2026-09-14T07:00:00Z", "to_at": "2026-09-14T07:10:00Z"})
    assert r.status_code == 200, r.text
    assert r.json()["files"] == 2 and r.json()["estimate_bytes"] == 3000 and r.json()["coverage"] == "complete"
    # operator may export (explicit grant); viewer may not
    bind(c, s, "op", "operator", "installation", "*")
    bind(c, s, "ron", "viewer", "installation", "*")
    assert c.post("/api/v1/exports/estimate", json={"camera_id": cam["id"], "from_at": "2026-09-14T07:00:00Z", "to_at": "2026-09-14T07:10:00Z"}, headers=as_user("op")).status_code == 200
    assert c.post("/api/v1/exports/estimate", json={"camera_id": cam["id"], "from_at": "2026-09-14T07:00:00Z", "to_at": "2026-09-14T07:10:00Z"}, headers=as_user("ron")).status_code == 403
    assert c.post("/api/v1/exports/estimate", json={"camera_id": cam["id"], "from_at": "2026-09-14T07:00:00", "to_at": "2026-09-14T07:10:00Z"}).status_code == 422


def test_export_job_without_ffmpeg_delivers_raw_container(lab, monkeypatch):
    c, s, cam = lab
    monkeypatch.setattr(ex, "ffmpeg_path", lambda: None)
    ex.WORKER.downloader = fake_downloader(b"IMKH" + b"\x00" * 36 + b"\x00\x00\x01\xba" + b"x" * 500)
    r = c.post("/api/v1/exports", json={"camera_id": cam["id"], "from_at": "2026-09-14T07:00:30Z", "to_at": "2026-09-14T07:01:30Z"})
    assert r.status_code == 201, r.text
    job = r.json()
    assert job["state"] == "queued" and len(job["files"]) == 1 and job["files"][0]["name"] == "f1" and "playback_uri" not in job["files"][0]
    assert ex.WORKER.run_pending() == 1
    job = c.get(f"/api/v1/exports/{job['id']}").json()
    assert job["state"] == "done" and job["progress"] == 1.0 and job["container"] == "hikvision-ps" and job["remux"] == "unavailable"
    assert job["download_ready"] and job["output_name"].endswith(".mpg") and job["sha256"]
    d = c.get(f"/api/v1/exports/{job['id']}/download")
    assert d.status_code == 200 and d.headers["content-type"].startswith("video/mpeg") and len(d.content) == 544
    m = c.get(f"/api/v1/exports/{job['id']}/manifest").json()
    assert m["pipeline_version"] == "export-1" and m["requested_from"] == "2026-09-14T07:00:30Z" and m["source"]["files"][0]["name"] == "f1" and m["output"]["sha256"] == job["sha256"]
    # listing, other user, delete
    assert [j["id"] for j in c.get("/api/v1/exports").json()["jobs"]] == [job["id"]]
    bind(c, s, "ron", "viewer", "installation", "*")
    assert c.get(f"/api/v1/exports/{job['id']}", headers=as_user("ron")).status_code == 403
    assert c.delete(f"/api/v1/exports/{job['id']}").json()["deleted"] is True
    assert not ex.job_dir(s, job["id"]).exists()


def test_export_partial_and_cancel(lab, monkeypatch):
    c, s, cam = lab
    monkeypatch.setattr(ex, "ffmpeg_path", lambda: None)
    ex.WORKER.downloader = fake_downloader(b"\x00\x00\x01\xba" + b"y" * 100, fail_names={"f2"})
    r = c.post("/api/v1/exports", json={"camera_id": cam["id"], "from_at": "2026-09-14T07:00:00Z", "to_at": "2026-09-14T07:10:00Z"})
    assert r.status_code == 201
    ex.WORKER.run_pending()
    job = c.get(f"/api/v1/exports/{r.json()['id']}").json()
    assert job["state"] == "partial" and [f["state"] for f in job["files"]] == ["downloaded", "failed"] and job["error"]
    # cancel a queued job
    q = c.post("/api/v1/exports", json={"camera_id": cam["id"], "from_at": "2026-09-14T07:00:00Z", "to_at": "2026-09-14T07:10:00Z"}).json()
    cancelled = c.post(f"/api/v1/exports/{q['id']}/cancel").json()
    assert cancelled["state"] == "cancelled" and cancelled["error"] == "בוטל על ידי המשתמש", "a queued job says who stopped it, like a running one"
    # too large
    c.patch("/api/v1/settings", json={"exports.max_mb": 50})
    monkeypatch.setattr(nvr, "search_recordings", fake_pages([("2026-09-14T10:00:00Z", "2026-09-14T10:02:00Z", "CMR", "big", 60 * 1024 * 1024)]))
    big = c.post("/api/v1/exports", json={"camera_id": cam["id"], "from_at": "2026-09-14T07:00:00Z", "to_at": "2026-09-14T07:10:00Z"})
    assert big.status_code == 422 and big.json()["code"] == "export_too_large"


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg not installed on this machine")
def test_export_job_with_ffmpeg_produces_trimmed_mp4(lab, tmp_path):
    """End to end with a synthetic MPEG-PS made by ffmpeg (no customer data): remux, concat, trim, manifest."""
    import subprocess

    c, s, cam = lab
    ps = tmp_path / "synthetic.ps"
    subprocess.run([shutil.which("ffmpeg"), "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=10:duration=4", "-f", "lavfi", "-i", "sine=frequency=440:duration=4", "-c:v", "libx264", "-preset", "ultrafast", "-g", "10", "-c:a", "mp2", "-ar", "32000", "-f", "mpeg", str(ps)], check=True, timeout=120)
    ex.WORKER.downloader = fake_downloader(ps.read_bytes())
    # request 10:00:30..10:06:00 wall clock → both files (each 4 s of synthetic video), trimmed from 30 s after the first file start
    r = c.post("/api/v1/exports", json={"camera_id": cam["id"], "from_at": "2026-09-14T07:00:01Z", "to_at": "2026-09-14T07:06:00Z"})
    assert r.status_code == 201, r.text
    assert ex.WORKER.run_pending() == 1
    job = c.get(f"/api/v1/exports/{r.json()['id']}").json()
    assert job["state"] == "done", job
    assert job["container"] == "mp4" and job["remux"] == "done" and job["media_type"] == "video/mp4" and job["output_name"].endswith(".mp4")
    assert [f["state"] for f in job["files"]] == ["remuxed", "remuxed"]
    d = c.get(f"/api/v1/exports/{job['id']}/download")
    assert d.status_code == 200 and d.headers["content-type"] == "video/mp4" and b"ftyp" in d.content[:64]
    assert job["actual_from"] == "2026-09-14T07:00:01Z" and job["actual_to"] == "2026-09-14T07:06:00Z"


def test_playback_group_lifecycle(lab, monkeypatch):
    c, s, cam = lab
    pb.REGISTRY.sessions.clear()
    pg.GROUPS.clear()
    FakeGo2rtc.store = {}
    FakeGo2rtc.deleted = []
    monkeypatch.setattr(pb.g2, "Go2rtc", FakeGo2rtc)
    cam2 = c.post("/api/v1/cameras", json={"channel": 2, "alias": "b"}).json()
    set_track(s, cam2["id"], 201)
    # camera 1 records 10:00–10:02 and 10:05–10:07 (fixture); camera 2 the same (same fake search)
    r = c.post("/api/v1/playback/groups", json={"camera_ids": [cam["id"], cam2["id"]], "start_at": "2026-09-14T07:00:30Z"})
    assert r.status_code == 201, r.text
    g = r.json()
    assert len(g["sessions"]) == 2 and g["missing"] == {} and g["sync"] == "best_effort" and g["generation"] == 0
    names = {pb.stream_name(x["id"], 0) for x in g["sessions"]}
    assert names <= set(FakeGo2rtc.store)
    # seek into the gap (10:03) → both cameras have their next recording > 60 s later → reported missing, streams released
    r2 = c.post(f"/api/v1/playback/groups/{g['id']}/seek", json={"start_at": "2026-09-14T07:03:00Z"})
    assert r2.status_code == 200 and r2.json()["generation"] == 1 and set(r2.json()["missing"].values()) == {"gap"} and r2.json()["sessions"] == []
    assert all(n in FakeGo2rtc.deleted for n in names)
    # seek back to a recorded time → sessions again
    r3 = c.post(f"/api/v1/playback/groups/{g['id']}/seek", json={"start_at": "2026-09-14T07:05:10Z"})
    assert r3.status_code == 200 and len(r3.json()["sessions"]) == 2 and r3.json()["missing"] == {}
    # quota: cap 3 with 2 active → a 2-camera group is refused
    c.patch("/api/v1/settings", json={"playback.max_sessions": 3})
    assert c.post("/api/v1/playback/groups", json={"camera_ids": [cam["id"], cam2["id"]], "start_at": "2026-09-14T07:00:30Z"}).status_code == 429
    assert c.delete(f"/api/v1/playback/groups/{g['id']}").json()["state"] == "closed"
    assert pb.REGISTRY.active() == [] and g["id"] not in pg.GROUPS
