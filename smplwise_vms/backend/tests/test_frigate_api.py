"""NN5 F1 - the Frigate provider API end to end on the app: discovery import, status, reviews with per-user reviewed state and camera
scope, thumbnails and stills through Arx (never a Frigate URL or credential), recordings coverage, the HLS playlist and its
authorised segments, the design-only export, the catalogue / connection test, recorder health, the Hikvision-only layers refusing
a Frigate recorder, and the secrets sweep over every body. Fake Frigate only (`fixtures/fake_frigate.py`)."""
from __future__ import annotations

import json
import sys
import threading
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.services import autosync, connection_probe, events_ingest, recorder_health
from smplwise.services import go2rtc as g2
from smplwise.services.recorders import frigate as fr
from smplwise.services.recorders import frigate_events as fe
from smplwise.services.recorders import frigate_http as fh
from smplwise.services.recorders import frigate_io

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from conftest import as_user, bind  # noqa: E402
from fake_frigate import HOST, PASSWORD, PLANTED_PASSWORD, PLANTED_TOKEN_USER, T0, USER, WEBP, FakeFrigate, settings_for  # noqa: E402

BASE = "/api/v1/frigate/nvr-1"
LEAKS = (HOST, PASSWORD, PLANTED_PASSWORD, PLANTED_TOKEN_USER, "192.0.2.", "rtsp://", "frigate_token", "jwt-fake", "/media/frigate")


@pytest.fixture(autouse=True)
def _clean():
    fh.clear_cache()
    fr.clear_cache()
    frigate_io.clear_stills()
    fe.STATES.clear()
    yield
    fh.clear_cache()
    fr.clear_cache()
    frigate_io.clear_stills()


class Listener:
    def __init__(self, db, s) -> None:
        self.db, self.settings, self.recorder_id = db, s, "nvr-1"
        self.state = events_ingest.IngestState()
        self.stop = threading.Event()
        self.tz_getter = lambda: "Asia/Jerusalem"


class World:
    def __init__(self, c, app, fake, s):
        self.c, self.app, self.fake, self.s = c, app, fake, s
        self.bodies: list[str] = []

    def get(self, path, **kw):
        r = self.c.get(path, **kw)
        self.bodies.append(r.text if "text" in (r.headers.get("content-type", "") + "json") or "json" in r.headers.get("content-type", "") else "")
        return r

    def cams(self) -> dict[str, str]:
        with self.app.state.db.connection(mode="read") as conn:
            return {r["source_ref"]: r["id"] for r in conn.execute("SELECT id, source_ref FROM cameras WHERE recorder_id = 'nvr-1'").fetchall()}

    def poll(self, now=T0):
        lst = Listener(self.app.state.db, self.s)
        return fe.poll_reviews(lst, fr.FrigateAdapter("nvr-1", self.s, transport=self.fake.transport()), fe.state_of("nvr-1"), now)


@pytest.fixture()
def world(settings, monkeypatch):
    from smplwise.main import create_app

    fake = FakeFrigate()
    monkeypatch.setattr(fr, "TRANSPORT", fake.transport())
    s = settings_for(settings)
    app = create_app(s)
    with TestClient(app) as c:
        w = World(c, app, fake, s)
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline and len(w.cams()) < 3:
            time.sleep(0.05)
        assert len(w.cams()) == 3, "start-up discovery imported the cameras"
        yield w
        for body in w.bodies:
            for leak in LEAKS:
                assert leak not in body, f"{leak!r} leaked into an API body"


# ---------------------------------------------------------------------------------------------- discovery

def test_discovery_imports_cameras_with_enabled_state_and_never_writes(world):
    with world.app.state.db.connection(mode="read") as conn:
        rows = {r["source_ref"]: dict(r) for r in conn.execute("SELECT * FROM cameras WHERE recorder_id = 'nvr-1'").fetchall()}
        rec = dict(conn.execute("SELECT * FROM recorders WHERE id = 'nvr-1'").fetchone())
    assert {k: (v["channel"], v["enabled"], v["main_track"]) for k, v in rows.items()} == {"cam_front": (1, 1, None), "cam_yard": (2, 1, None), "cam_garage": (3, 0, None)}
    assert rows["cam_front"]["name_source"] == "Front door" and rows["cam_yard"]["status"] == "online" and rows["cam_garage"]["status"] == "offline"
    caps = json.loads(rows["cam_garage"]["capabilities_json"])
    assert caps["stream"]["enabled"] is False and caps["stream"]["reason"] == "disabled_in_frigate" and caps["encoding"]["sub"]["resolution"] == "1920x1080"
    assert rec["vendor"] == "frigate" and rec["model"] == "Frigate" and rec["firmware"] == "0.18.0-77a66e7"
    rcaps = json.loads(rec["capabilities_json"])
    assert rcaps["vendor"] == "frigate" and "review_items" in rcaps["features"] and rcaps["playback"] == "hls" and rcaps["write_encodings"] is False
    assert world.fake.non_get == ["POST /api/login"]


def test_rediscovery_keeps_ids_and_marks_a_removed_camera(world):
    ids = world.cams()
    del world.fake.cameras["cam_yard"]
    world.fake.cameras["cam_new"] = world.fake.cameras["cam_front"]
    world.fake.stats_fps = {"cam_front": 5.0, "cam_new": 5.0}
    r = world.c.post(f"{BASE}/discover")
    assert r.status_code == 200 and r.json()["created"] == 1 and r.json()["channels"] == 3
    after = world.cams()
    assert after["cam_front"] == ids["cam_front"] and after["cam_yard"] == ids["cam_yard"], "the old row is kept (history), never deleted"
    with world.app.state.db.connection(mode="read") as conn:
        yard = dict(conn.execute("SELECT * FROM cameras WHERE id = ?", (ids["cam_yard"],)).fetchone())
        new = dict(conn.execute("SELECT * FROM cameras WHERE source_ref = 'cam_new'").fetchone())
    assert (yard["enabled"], yard["status"]) == (0, "offline") and new["channel"] == 4, "a new camera takes the next free channel"


def test_discovery_is_refused_for_a_user_without_system_configure(world, settings):
    bind(world.c, world.s, "lena", "operator", "installation", "*")
    r = world.c.post(f"{BASE}/discover", headers=as_user("lena"))
    assert r.status_code == 403


# ---------------------------------------------------------------------------------------------- status

def test_status_reports_discovery_sync_and_warnings(world):
    r = world.get(f"{BASE}/status")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["version"] == "0.18.0-77a66e7" and d["version_ok"] and d["min_version"] == "0.18" and d["cameras"] == 3
    assert d["features"]["review_items"] and d["features"]["hls_playback"] and not d["features"]["faces"] and d["live"]["mode"] == "still"
    assert [w["code"] for w in d["warnings"]] == ["frigate_plain_http"]
    assert d["retention"]["motion_days"] == 10 and [x["name"] for x in d["detectors"]] == ["coral1", "coral2"]
    assert d["recorder"]["id"] == "nvr-1" and "sync" in d


def test_a_forced_refresh_needs_system_configure(world):
    bind(world.c, world.s, "lena", "operator", "installation", "*")
    assert world.c.get(f"{BASE}/status?refresh=true", headers=as_user("lena")).status_code == 403
    assert world.c.get(f"{BASE}/status?refresh=true").status_code == 200


def test_a_recorder_that_is_not_frigate_is_a_404(client):
    assert client.get("/api/v1/frigate/nvr-1/status").status_code == 404
    assert client.get("/api/v1/frigate/nvr-1/reviews").status_code == 404
    assert client.get("/api/v1/frigate/nvr-9/status").status_code == 404


def test_recorders_list_is_names_only(world):
    d = world.get("/api/v1/frigate/recorders").json()
    assert [r["id"] for r in d["recorders"]] == ["nvr-1"] and set(d["recorders"][0]) == {"id", "name", "enabled", "firmware"}


# ---------------------------------------------------------------------------------------------- reviews

def test_reviews_list_filters_and_paging(world):
    assert world.poll() == 3
    items = world.get(f"{BASE}/reviews").json()["items"]
    assert [i["id"][:12] for i in items] == ["1791227900.3", "1791227500.2", "1791227000.1"], "newest first"
    first = items[2]
    assert first["severity"] == "alert" and first["objects"] == ["person"] and first["zones"] == ["porch"] and first["type"] == "person" and first["open"] is False
    assert first["camera_key"] == "cam_front" and first["camera_name"] == "Front door" and first["reviewed"] is False
    assert first["thumbnail"] == f"{BASE}/reviews/{first['id']}/thumbnail" and items[0]["open"] is True and items[0]["duration_s"] is None
    alerts = world.get(f"{BASE}/reviews?severity=alert").json()["items"]
    assert {i["severity"] for i in alerts} == {"alert"} and len(alerts) == 2
    cam = world.cams()["cam_yard"]
    assert [i["camera_key"] for i in world.get(f"{BASE}/reviews?camera_id={cam}").json()["items"]] == ["cam_yard"]
    page = world.get(f"{BASE}/reviews?limit=2").json()
    assert len(page["items"]) == 2 and page["next_before"] == T0 - 500
    rest = world.get(f"{BASE}/reviews?limit=2&before={page['next_before']}").json()
    assert [i["id"][:12] for i in rest["items"]] == ["1791227000.1"] and rest["next_before"] is None
    assert [i["id"][:12] for i in world.get(f"{BASE}/reviews?from={T0 - 600}&to={T0 - 50}").json()["items"]] == ["1791227900.3", "1791227500.2"]
    assert world.get(f"{BASE}/reviews?severity=motion").status_code == 422, "the motion layer is /activity, not an item"
    assert world.get(f"{BASE}/reviews?from=yesterday").status_code == 422


def test_review_detail(world):
    world.poll()
    rid = "1791227000.100000-aaa111"
    d = world.get(f"{BASE}/reviews/{rid}").json()
    assert d["id"] == rid and d["reviewed"] is False and d["detection_ids"] and d["severity"] == "alert"
    assert world.get(f"{BASE}/reviews/1791220000.000000-nope00").status_code == 404


def test_reviewed_is_per_user_and_never_written_to_frigate(world):
    world.poll()
    bind(world.c, world.s, "lena", "operator", "installation", "*")
    ids = ["1791227000.100000-aaa111", "1791227500.200000-bbb222"]
    r = world.c.post(f"{BASE}/reviews/reviewed", json={"ids": ids})
    assert r.status_code == 200 and r.json()["count"] == 2
    mine = world.get(f"{BASE}/reviews?reviewed=true").json()["items"]
    assert {i["id"] for i in mine} == set(ids) and all(i["reviewed"] for i in mine)
    assert [i["id"][:12] for i in world.get(f"{BASE}/reviews?reviewed=false").json()["items"]] == ["1791227900.3"]
    hers = world.get(f"{BASE}/reviews", headers=as_user("lena")).json()["items"]
    assert not any(i["reviewed"] for i in hers), "another user's reviewed state is her own"
    summary = world.get(f"{BASE}/reviews/summary").json()
    assert summary["severity"]["alert"] == {"total": 2, "unreviewed": 1} and summary["severity"]["detection"] == {"total": 1, "unreviewed": 0}
    assert world.c.post(f"{BASE}/reviews/reviewed", json={"ids": ids[:1], "reviewed": False}).status_code == 200
    assert len(world.get(f"{BASE}/reviews?reviewed=true").json()["items"]) == 1
    assert world.fake.non_get == ["POST /api/login"], "Frigate's own has_been_reviewed is never written"


def test_reviewed_bulk_validates_the_body(world):
    world.poll()
    assert world.c.post(f"{BASE}/reviews/reviewed", json={"ids": []}).status_code == 422
    assert world.c.post(f"{BASE}/reviews/reviewed", json={"ids": ["x"] * 201}).status_code == 422
    assert world.c.post(f"{BASE}/reviews/reviewed", json={"ids": ["1791227000.100000-aaa111"], "evil": 1}).status_code == 422
    assert world.c.post(f"{BASE}/reviews/reviewed", json={"ids": ["1791220000.000000-nope00"]}).status_code == 404


def test_camera_scope_limits_every_review_route(world):
    world.poll()
    cams = world.cams()
    bind(world.c, world.s, "lena", "operator", "camera", cams["cam_front"])
    h = as_user("lena")
    items = world.c.get(f"{BASE}/reviews", headers=h).json()["items"]
    assert {i["camera_key"] for i in items} == {"cam_front"} and len(items) == 2
    yard = "1791227500.200000-bbb222"
    assert world.c.get(f"{BASE}/reviews/{yard}", headers=h).status_code == 403
    assert world.c.get(f"{BASE}/reviews/{yard}/thumbnail", headers=h).status_code == 403
    assert world.c.post(f"{BASE}/reviews/reviewed", json={"ids": [yard, "1791227000.100000-aaa111"]}, headers=h).status_code == 403
    assert world.c.get(f"{BASE}/reviews?reviewed=true", headers=h).json()["items"] == [], "a refused bulk marks nothing"
    s = world.c.get(f"{BASE}/reviews/summary", headers=h).json()
    assert s["severity"]["alert"]["total"] == 2 and s["severity"]["detection"]["total"] == 0 and set(s["unreviewed_by_camera"]) == {cams["cam_front"]}
    assert world.c.get(f"{BASE}/reviews/1791227000.100000-aaa111/thumbnail", headers=h).status_code == 200


def test_a_user_with_no_events_read_gets_403_everywhere(world):
    world.poll()
    bind(world.c, world.s, "viewer1", "viewer", "installation", "*")
    h = as_user("viewer1")
    for path in ("/reviews", "/reviews/summary", "/reviews/1791227000.100000-aaa111", "/reviews/1791227000.100000-aaa111/thumbnail", "/activity"):
        assert world.c.get(BASE + path, headers=h).status_code == 403, path


def test_motion_activity_layer_is_scoped(world):
    cams = world.cams()
    d = world.get(f"{BASE}/activity?from={T0 - 600}&to={T0}").json()
    assert d["layer"] == "motion" and len(d["buckets"]) == 10 and set(d["buckets"][0]["cameras"]) == {"cam_front", "cam_yard"}
    bind(world.c, world.s, "lena", "operator", "camera", cams["cam_front"])
    scoped = world.c.get(f"{BASE}/activity?from={T0 - 600}&to={T0}", headers=as_user("lena")).json()
    assert all(b["cameras"] == ["cam_front"] for b in scoped["buckets"])
    assert world.get(f"{BASE}/activity?from={T0 - 200000}&to={T0}").status_code == 422


# ---------------------------------------------------------------------------------------------- pictures

def test_review_thumbnail_is_served_by_arx(world):
    world.poll()
    r = world.c.get(f"{BASE}/reviews/1791227000.100000-aaa111/thumbnail")
    assert r.status_code == 200 and r.content == WEBP and r.headers["content-type"] == "image/webp"
    assert "private" in r.headers["cache-control"] and "frigate" not in json.dumps(dict(r.headers)).lower()


def test_review_thumbnail_falls_back_to_the_tracked_object(world):
    world.poll()
    world.fake.reviews = []  # the review thumbnail is gone from Frigate
    r = world.c.get(f"{BASE}/reviews/1791227000.100000-aaa111/thumbnail")
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg"


def test_event_centre_shows_frigate_events_with_their_thumbnail(world):
    world.poll()
    ev = world.get("/api/v1/events?source=frigate").json()
    assert len(ev["events"]) == 3 and {e["source"] for e in ev["events"]} == {"frigate"}
    alert = next(e for e in ev["events"] if e["details"]["review_id"].endswith("aaa111"))
    assert (alert["type"], alert["severity"], alert["recorder_id"]) == ("person", "alert", "nvr-1")
    r = world.c.get(f"/api/v1/events/{alert['id']}/thumbnail")
    assert r.status_code == 200 and r.content == WEBP
    assert world.get("/api/v1/events").status_code == 200, "the unfiltered list copes with the new source"


def test_snapshot_still_is_cached_clamped_and_scoped(world):
    cams = world.cams()
    url = f"{BASE}/cameras/{cams['cam_front']}/snapshot"
    r1 = world.c.get(url + "?h=240")
    r2 = world.c.get(url + "?h=240")
    assert r1.status_code == 200 and r1.content.endswith(b"h240") and r1.headers["x-still-cache"] == "miss" and r2.headers["x-still-cache"] == "hit"
    assert sum(1 for h in world.fake.hits if h.endswith("/cam_front/latest.jpg")) == 1, "two viewers, one Frigate read"
    assert world.c.get(url + "?h=99999").status_code == 422
    assert world.c.get(url + "?h=5000").status_code == 422
    big = world.c.get(url + "?h=3000")
    assert big.status_code == 200 and big.content.endswith(b"h1440"), "clamped to the maximum"
    tiny = world.c.get(url + "?h=10")
    assert tiny.content.endswith(b"h120")
    assert world.c.get(f"{BASE}/cameras/{cams['cam_garage']}/snapshot").status_code == 409, "disabled in Arx"
    bind(world.c, world.s, "lena", "operator", "camera", cams["cam_yard"])
    assert world.c.get(url, headers=as_user("lena")).status_code == 403
    assert world.c.get(f"{BASE}/cameras/{cams['cam_yard']}/snapshot", headers=as_user("lena")).status_code == 200


def test_snapshot_read_cap_answers_429(world):
    cams = world.cams()
    sem = threading.BoundedSemaphore(1)
    sem.acquire()
    frigate_io._INFLIGHT["nvr-1"] = sem
    r = world.c.get(f"{BASE}/cameras/{cams['cam_front']}/snapshot?h=300")
    assert r.status_code == 429 and r.json()["code"] == "frigate_busy"


def test_the_general_camera_snapshot_route_serves_a_frigate_camera(world):
    cams = world.cams()
    r = world.c.get(f"/api/v1/cameras/{cams['cam_yard']}/snapshot.jpg")
    assert r.status_code == 200 and r.content.startswith(b"\xff\xd8")


def test_a_frigate_error_on_a_still_is_a_json_error_not_a_leak(world):
    cams = world.cams()
    world.fake.latest_status = 500
    r = world.get(f"{BASE}/cameras/{cams['cam_front']}/snapshot?h=333")
    assert r.status_code == 503 and r.json()["code"] == "source_unavailable"


# ---------------------------------------------------------------------------------------------- recordings and playback

def test_recordings_coverage_policy_and_density(world):
    cams = world.cams()
    d = world.get(f"{BASE}/cameras/{cams['cam_front']}/recordings?from={T0 - 600}&to={T0}").json()
    assert d["policy"] == "motion" and d["sparse_by_design"] is True and d["partial"] is True and d["segments"] >= 20
    assert d["ranges"] and d["ratio"] >= 0.49 and d["density"] and d["camera_id"] == cams["cam_front"]
    empty = world.get(f"{BASE}/cameras/{cams['cam_yard']}/recordings?from={T0 - 600}&to={T0}").json()
    assert empty["ranges"] == [] and empty["covered_s"] == 0 and empty["partial"] is True and empty["policy"] == "motion", "no segments is reported with the policy, not as a fault"
    assert world.get(f"{BASE}/cameras/{cams['cam_front']}/recordings?from={T0 - 200000}&to={T0}").status_code == 422
    assert world.get(f"{BASE}/cameras/{cams['cam_front']}/recordings?from={T0}&to={T0 - 5}").status_code == 422


def test_recordings_summary_uses_the_site_zone(world):
    cams = world.cams()
    d = world.get(f"{BASE}/cameras/{cams['cam_front']}/recordings/summary").json()
    assert d["timezone"] == "Asia/Jerusalem" and d["days"][0]["day"] == "2026-10-05" and d["days"][0]["hours"][0]["duration"] == 300


def test_playback_plan_playlist_and_authorised_segments(world):
    cams = world.cams()
    cid = cams["cam_front"]
    plan = world.get(f"{BASE}/cameras/{cid}/playback?start={T0 - 600}&end={T0}").json()
    assert plan["kind"] == "hls" and plan["anchors"]["proven"] is False and plan["coverage"]["policy"] == "motion" and "cam_front" not in plan["playlist"] + plan["assets"]
    pl = world.c.get(f"{BASE}/cameras/{cid}/playback/index.m3u8?start={int(T0 - 600)}&end={int(T0)}")
    assert pl.status_code == 200 and pl.headers["content-type"].startswith("application/vnd.apple.mpegurl") and "no-store" in pl.headers["cache-control"]
    prefix = f"{BASE}/cameras/{cid}/playback/{int(T0 - 600)}/{int(T0)}/"
    lines = pl.text.splitlines()
    assert f'#EXT-X-MAP:URI="{prefix}init-v1.mp4"' in lines and prefix + "seg-1-v1.m4s" in lines
    assert not any(l.startswith("http") or "frigate.test" in l or "/vod/" in l for l in lines)
    seg = world.c.get(prefix + "seg-2-v1.m4s")
    assert seg.status_code == 200 and seg.headers["content-type"] == "video/mp4" and seg.content
    assert world.c.get(prefix + "init-v1.mp4").status_code == 200
    for bad in ("evil.ts", "..%2Fseg-1-v1.m4s", "seg-1-v1.m4s%3Fx", "index.m3u8"):
        assert world.c.get(prefix + bad).status_code in (404, 422), bad
    assert world.c.get(f"{BASE}/cameras/{cid}/playback/index.m3u8?start={int(T0)}&end={int(T0 - 10)}").status_code == 422
    assert world.c.get(f"{BASE}/cameras/{cid}/playback/index.m3u8?start={int(T0 - 100000)}&end={int(T0)}").status_code == 422


def test_every_segment_request_is_authorised_again(world):
    cams = world.cams()
    cid = cams["cam_front"]
    bind(world.c, world.s, "lena", "operator", "camera", cams["cam_yard"])
    h = as_user("lena")
    start, end = int(T0 - 600), int(T0)
    assert world.c.get(f"{BASE}/cameras/{cid}/playback/index.m3u8?start={start}&end={end}", headers=h).status_code == 403
    assert world.c.get(f"{BASE}/cameras/{cid}/playback/{start}/{end}/seg-1-v1.m4s", headers=h).status_code == 403
    assert world.c.get(f"{BASE}/cameras/{cid}/playback?start={start}&end={end}", headers=h).status_code == 403
    assert not any("/vod/" in x for x in world.fake.hits), "nothing was fetched from Frigate for a refused caller"
    bind(world.c, world.s, "viewer2", "viewer", "installation", "*")
    assert world.c.get(f"{BASE}/cameras/{cid}/playback/index.m3u8?start={start}&end={end}", headers=as_user("viewer2")).status_code == 403, "video.playback is its own permission"


def test_segment_reads_are_capped_per_recorder(world):
    cid = world.cams()["cam_front"]
    from smplwise.routers import frigate as router

    sem = threading.BoundedSemaphore(1)
    sem.acquire()
    router._ASSET_SEMS["nvr-1"] = sem
    r = world.c.get(f"{BASE}/cameras/{cid}/playback/{int(T0 - 600)}/{int(T0)}/seg-1-v1.m4s")
    assert r.status_code == 429 and r.json()["code"] == "frigate_busy"
    router._ASSET_SEMS.clear()


def test_export_is_a_design_and_creates_nothing(world):
    cid = world.cams()["cam_front"]
    d = world.get(f"{BASE}/cameras/{cid}/export-plan?start={T0 - 600}&end={T0 - 300}").json()
    assert d["executed"] is False and d["status"] == "design_only" and d["allow_listed"] is False
    assert not any("clip" in h or "export" in h for h in world.fake.hits)
    assert world.get(f"{BASE}/cameras/{cid}/export-plan?start={T0 - 20000}&end={T0}").status_code == 422


def test_storage_view(world):
    d = world.get(f"{BASE}/storage").json()
    by = {c["key"]: c for c in d["cameras"]}
    assert by["cam_front"]["name"] == "Front door" and by["cam_front"]["bandwidth_mb_per_h"] == 120.0 and d["policy"] == "motion"


def test_cameras_list_with_link_field_and_scope(world):
    cams = world.cams()
    with world.app.state.db.connection() as conn:  # the link FIELD exists; no UI or behaviour depends on it yet
        conn.execute("INSERT INTO camera_links(camera_id, linked_camera_id, kind, created_at) VALUES (?,?,?,?)", (cams["cam_front"], "other-recorder-cam", "same_place", "2026-10-05T00:00:00Z"))
    d = world.get(f"{BASE}/cameras").json()["cameras"]
    by = {c["key"]: c for c in d}
    assert set(by) == {"cam_front", "cam_yard", "cam_garage"} and by["cam_front"]["links"] == [{"camera_id": "other-recorder-cam", "kind": "same_place"}]
    assert by["cam_garage"]["frigate_enabled"] is False and by["cam_garage"]["disabled_reason"] == "disabled_in_frigate" and by["cam_front"]["ptz"] is True
    assert by["cam_front"]["can_view_live"] and by["cam_front"]["can_play"]
    bind(world.c, world.s, "lena", "operator", "camera", cams["cam_yard"])
    assert [c["key"] for c in world.c.get(f"{BASE}/cameras", headers=as_user("lena")).json()["cameras"]] == ["cam_yard"]


def test_camera_links_reject_self_links(world):
    cams = world.cams()
    import sqlite3

    with pytest.raises(sqlite3.IntegrityError):
        with world.app.state.db.connection() as conn:
            conn.execute("INSERT INTO camera_links(camera_id, linked_camera_id, created_at) VALUES (?,?,?)", (cams["cam_front"], cams["cam_front"], "x"))


# ---------------------------------------------------------------------------------------------- the rest of the product

def test_no_live_stream_is_created_for_a_frigate_camera(world, monkeypatch):
    from smplwise.routers import media

    created = []
    monkeypatch.setattr(g2.Go2rtc, "ensure_stream", lambda self, name, src, check=None: created.append(name) or "created")
    monkeypatch.setattr(g2.Go2rtc, "list_streams", lambda self: {"intercom_door_1": None})
    import dataclasses

    s = dataclasses.replace(world.s, go2rtc_url="http://go2rtc.test:1984")
    with world.app.state.db.connection() as conn:
        r = autosync.ensure_streams(s, conn, reason="manual")
        cam = dict(conn.execute("SELECT * FROM cameras WHERE source_ref = 'cam_front'").fetchone())
    assert r["skipped"] == 2 and created == [] and r["foreign_streams_untouched"] == 1
    from smplwise.errors import ApiError

    with pytest.raises(ApiError) as e:
        media.ensure_camera_stream(s, cam, "sub")
    assert e.value.code == "live_not_available" and e.value.details["fallback"] == "still"


def test_hikvision_isapi_routes_refuse_a_frigate_recorder(world):
    before = len(world.fake.hits)
    r = world.c.post("/api/v1/nvr/reboot", json={"confirm": "RESTART"})
    assert r.status_code == 409 and r.json()["code"] == "vendor_unsupported"
    assert len(world.fake.hits) == before, "no credential and no request went to Frigate over ISAPI"


def test_recorder_health_card_for_frigate(world):
    recorder_health.reset()
    world.c.post("/api/v1/recorder-health/check")
    d = world.get("/api/v1/recorder-health").json()
    card = next(r for r in d["recorders"] if r["id"] == "nvr-1")
    assert card["vendor"] == "frigate" and card["status"] in ("ok", "warn") and card["disks"]["state"] == "ok" and card["disks"]["total_mb"] == 1_000_000
    assert card["channels"]["total"] == 2 and card["channels"]["connected"] == 2, "the camera disabled in Frigate is not counted"
    assert card["vendor_details"]["detectors"][0]["name"] == "coral1" and card["vendor_details"]["storage"]["hours_left"] == 3000.0
    recorder_health.reset()


def test_the_catalogue_keeps_frigate_coming_soon_until_the_flag(settings):
    from smplwise.services.recorders import registry

    cat = {v["id"]: v for v in registry.catalogue()}
    assert cat["frigate"]["status"] == "planned" and [f["key"] for f in cat["frigate"]["fields"]][:4] == ["host", "http_port", "username", "password"]
    assert cat["frigate"]["default_ports"]["http_port"] == 8971
    undo = fr.register(selectable=True)
    try:
        assert {v["id"]: v for v in registry.catalogue()}["frigate"]["status"] == "available"
    finally:
        undo()
    assert {v["id"]: v for v in registry.catalogue()}["frigate"]["status"] == "planned"
    assert [v["id"] for v in registry.catalogue()] == ["hikvision", "provision_isr", "frigate", "none"]


def _probe_env(monkeypatch, fake):
    monkeypatch.setattr(connection_probe, "RESOLVE", lambda h: ["192.0.2.50"] if h == HOST else [])
    monkeypatch.setattr(connection_probe, "HOSTNAME", lambda: "arx.test")
    monkeypatch.setattr(connection_probe, "LOCAL_ADDRESSES", lambda: set(), raising=False)
    monkeypatch.setattr(connection_probe, "TRANSPORT", fake.transport())
    monkeypatch.setattr("smplwise.services.connection_store.connect_host", lambda target: HOST)


def test_connection_test_of_a_frigate_candidate(settings, monkeypatch):
    from smplwise.main import create_app

    fake = FakeFrigate()
    _probe_env(monkeypatch, fake)
    undo = fr.register(selectable=True)
    try:
        app = create_app(settings)
        with TestClient(app) as c:
            body = {"vendor": "frigate", "host": HOST, "http_port": 8971, "rtsp_port": 554, "username": USER, "password": PASSWORD, "extra": {"scheme": "http"}}
            ok = c.post("/api/v1/nvr/connection/test", json=body).json()
            res = ok.get("result", ok)
            assert res["ok"] is True and res["model"] == "Frigate" and res["channels"] == 3 and res["firmware"] == "0.18.0-77a66e7"
            assert res["transport"] == {"scheme": "http", "insecure": True} and res["warnings"] == ["frigate_plain_http"]
            assert HOST not in json.dumps(ok) and PASSWORD not in json.dumps(ok) and USER not in json.dumps(ok)
            bad = c.post("/api/v1/nvr/connection/test", json={**body, "password": "wrong"}).json()
            assert bad.get("result", bad)["code"] == "source_forbidden"
            fake.version = "0.15.1"
            old = c.post("/api/v1/nvr/connection/test", json=body).json()
            assert old.get("result", old)["code"] == "nvr_not_supported"
            fake.version = "0.18.0"
            fh.clear_cache()
            from smplwise.services.recorders import provision_isr as pisr

            monkeypatch.setattr(pisr, "PEER_CERTIFICATE", lambda host, port, timeout: {"sha256": "ab" * 32, "self_signed": True, "not_after": "2027-01-01T00:00:00Z"})
            pin = c.post("/api/v1/nvr/connection/test", json={**body, "extra": {"scheme": "https", "tls_mode": "pin"}}).json()
            res = pin.get("result", pin)
            assert res["code"] == "tls_pin_required" and res["certificate"]["sha256"] == "ab" * 32 and res["pin_required"] is True, "no credentials go out before a pin is saved"
            assert not any(h == "POST /api/login" for h in fake.hits[-1:]), "the login was not sent to an unpinned certificate"
    finally:
        undo()


def test_pin_mode_uses_the_pinned_context_on_the_real_connection(settings):
    from smplwise.services.recorders import provision_isr as pisr

    pin = "ab" * 32
    a = fr.FrigateAdapter("nvr-2", settings_for(settings, scheme="https", tls_mode="pin", tls_pin=pin))
    ctx = a.http._verify()
    assert isinstance(ctx, pisr.PinnedContext) and ctx.pin == pin
    assert a.http.tls_mode() == "pin" and fr.FrigateAdapter("nvr-2", settings_for(settings, scheme="https", tls_pin=pin)).http.tls_mode() == "pin", "a stored pin implies pin mode"
    assert fr.FrigateAdapter("nvr-2", settings_for(settings, scheme="https", tls_mode="trust")).http._verify() is False


def test_health_report_probe_handles_frigate(world):
    from smplwise.services import health_report

    out = health_report._probe_nvr(world.s)
    assert out["status"] == "ok" and out["model"] == "Frigate" and "0.18" in out["firmware"]
