"""NN5 F1 join (F1A backend + F1B UI): the calls the UI client (`frontend/src/api/frigate.ts`) makes, replayed against the real
backend with a FAKE Frigate (`fixtures/fake_frigate.py`, an in-process mock transport: no network, no real Frigate, no lab device,
no credential). The UI was written against an earlier F1A snapshot, so this pins the wire shapes it reads (WireStatus, WireCamera,
WireReview, WireSummary, WireActivity, vendor_details) and the F1 defaults: read-only toward Frigate (only the login is a non-GET),
viewer account, alerts first, faces / LPR / generative AI off, still tiles until a restream exists, no Frigate address or secret
in any body (the `world` fixture's teardown sweeps every body fetched through `world.get`)."""
from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path
from urllib.parse import parse_qs

from smplwise.services import recorder_health

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from conftest import as_user, bind  # noqa: E402
from test_frigate_api import BASE, T0, WEBP, world  # noqa: E402,F401  (the shared fake-Frigate world fixture)

REVIEW_FIELDS = {"id", "recorder_id", "camera_id", "camera_key", "camera_name", "severity", "start", "end", "open", "duration_s", "objects", "zones", "reviewed", "thumbnail"}
ISO = "%Y-%m-%dT%H:%M:%SZ"


def _ui_query(period_start: float, **extra: str) -> str:
    """What reviewQuery() builds: severity, from (a UTC ISO instant), reviewed, limit."""
    q = {"severity": "alert", "from": dt.datetime.fromtimestamp(period_start, dt.timezone.utc).strftime(ISO), "reviewed": "false", "limit": "50", **extra}
    return "&".join(f"{k}={v}" for k, v in q.items())


def test_recorders_status_and_cameras_have_the_shapes_the_ui_reads(world):
    rec = world.get("/api/v1/frigate/recorders").json()["recorders"]
    assert [(r["id"], r["enabled"], r["firmware"]) for r in rec] == [("nvr-1", True, "0.18.0-77a66e7")]
    st = world.get(f"{BASE}/status").json()
    assert isinstance(st["version"], str) and st["version_ok"] is True and isinstance(st["cameras"], int)
    assert st["live"]["mode"] == "still", "F1 default: still tiles, no restream"
    assert all(isinstance(v, (bool, type(None))) for v in st["features"].values())
    assert not any(st["features"].get(k) for k in ("faces", "lpr", "genai")), "face / LPR / generative AI are off in F1"
    ret = st["retention"]
    assert ret["motion_days"] == 10 and not ret.get("continuous_days"), "motion-only recording: the UI's recordingMode() reads motion (partial coverage)"
    assert all({"name", "type"} <= set(d) for d in st["detectors"]) and len(st["detectors"]) == 2
    assert "last_poll_error" in st["sync"] and "ws_state" in st["sync"]
    cams = world.get(f"{BASE}/cameras").json()["cameras"]
    assert all({"id", "key", "name", "enabled", "frigate_enabled"} <= set(c) for c in cams)
    assert {c["key"]: c["frigate_enabled"] for c in cams} == {"cam_front": True, "cam_yard": True, "cam_garage": False}


def test_the_review_screen_flow_with_the_uis_own_query(world):
    assert world.poll() == 3
    q = _ui_query(T0 - 86400)
    assert set(parse_qs(q)) == {"severity", "from", "reviewed", "limit"}
    page = world.get(f"{BASE}/reviews?{q}").json()
    assert [i["severity"] for i in page["items"]] == ["alert", "alert"] and page["next_before"] is None
    for it in page["items"]:
        assert REVIEW_FIELDS <= set(it), REVIEW_FIELDS - set(it)
        assert it["thumbnail"] == f"/api/v1/frigate/nvr-1/reviews/{it['id']}/thumbnail", "an Arx path, never a Frigate URL"
        assert it["start"].endswith("Z") and (it["end"] is None or it["end"].endswith("Z")), "UTC ISO instants (Date.parse in the UI)"
        assert isinstance(it["objects"], list) and isinstance(it["zones"], list) and it["reviewed"] is False
    summary = world.get(f"{BASE}/reviews/summary?days=1").json()
    assert summary["severity"]["alert"] == {"total": 2, "unreviewed": 2} and set(summary["severity"]["detection"]) == {"total", "unreviewed"}
    assert set(summary["unreviewed_by_camera"]) <= set(world.cams().values())
    first = page["items"][0]
    thumb = world.c.get(first["thumbnail"])
    assert thumb.status_code == 200 and thumb.content == WEBP
    detail = world.get(f"{BASE}/reviews/{first['id']}").json()
    assert detail["id"] == first["id"] and "detections" in detail and "sub_labels" in detail
    ids = [i["id"] for i in page["items"]]
    assert world.c.post(f"{BASE}/reviews/reviewed", json={"ids": ids, "reviewed": True}).json()["count"] == 2
    assert world.get(f"{BASE}/reviews?{q}").json()["items"] == [], "the unreviewed filter drops them"
    assert world.get(f"{BASE}/reviews/summary?days=1").json()["severity"]["alert"] == {"total": 2, "unreviewed": 0}
    assert world.fake.non_get == ["POST /api/login"], "read-only toward Frigate: the login is the only non-GET"


def test_the_motion_layer_and_the_still_tile_the_ui_uses(world):
    cams = world.get(f"{BASE}/cameras").json()["cameras"]
    keys = {c["key"] for c in cams}
    act = world.get(f"{BASE}/activity?from={int(T0 - 3600)}&to={int(T0)}").json()
    assert act["buckets"] and all({"start", "motion", "cameras"} <= set(b) for b in act["buckets"])
    assert {k for b in act["buckets"] for k in b["cameras"]} <= keys, "motionSpans() joins buckets to cameras by key"
    yard = next(c for c in cams if c["key"] == "cam_yard")
    still = world.c.get(f"/api/v1/cameras/{yard['id']}/snapshot.jpg")
    assert still.status_code == 200 and still.headers["content-type"].startswith("image/jpeg"), "stillUrl() is the general snapshot route"


def test_the_health_card_carries_what_frigate_health_of_reads(world):
    recorder_health.reset()
    world.c.post("/api/v1/recorder-health/check")
    card = next(r for r in world.get("/api/v1/recorder-health").json()["recorders"] if r["id"] == "nvr-1")
    vd = card["vendor_details"]
    assert all("name" in d for d in vd["detectors"]) and "skipped_fps_total" in vd
    assert all("key" in c and "fps" in c for c in vd["cameras"])
    assert {"hours_left", "bandwidth_mb_per_h"} <= set(vd["storage"])
    assert vd["recording_policy"]["motion_days"] == 10, "the same retention keys the UI's recordingMode() reads"
    recorder_health.reset()


def test_a_camera_scoped_user_sees_only_her_camera_through_the_ui_calls(world):
    world.poll()
    cams = world.cams()
    bind(world.c, world.s, "lena", "operator", "camera", cams["cam_front"])
    h = as_user("lena")
    items = world.c.get(f"{BASE}/reviews?{_ui_query(T0 - 86400)}", headers=h).json()["items"]
    assert items and {i["camera_key"] for i in items} == {"cam_front"}
    assert world.c.post(f"{BASE}/reviews/reviewed", json={"ids": [i["id"] for i in items]}, headers=h).status_code == 200
    assert world.fake.non_get == ["POST /api/login"]


def test_every_ui_route_answers_and_nothing_leaks(world):
    """The `world` teardown sweeps every body fetched through world.get for the Frigate host, credentials and media paths."""
    world.poll()
    for path in ("/status", "/cameras", f"/reviews?{_ui_query(T0 - 86400)}", "/reviews/summary?days=7", f"/activity?from={int(T0 - 600)}&to={int(T0)}", "/storage"):
        assert world.get(BASE + path).status_code == 200, path
    assert world.get("/api/v1/frigate/recorders").status_code == 200
