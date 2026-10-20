"""FRIGATE-295 phase 1: every Frigate call Arx makes, checked against the published API of the version the owner runs (0.18.x).

`fixtures/frigate_openapi_0_18_2_routes.json` is the method + path list of Frigate's own OpenAPI document at tag v0.18.2
(docs/static/frigate-api.yaml). The fake Frigate (`fixtures/fake_frigate.py`) now answers with the 0.18.2 shapes read from Frigate's
source (frigate/api/*.py), so the guessed shapes the earlier phases carried fail here instead of on the owner's instance:
- clearing a sub label is `{"subLabel": ""}` (a null is a 422 validation error), and the value lands asynchronously;
- an export is deleted with `POST /api/exports/delete {"ids": [...]}` (there is no `DELETE /api/export/{id}`);
- an export is a QUEUED job (202, `export_id`), visible in `/api/exports` only once it starts; the body names `source`, not `playback`;
- `GET /api/profiles` is `{"profiles": [{"name", "friendly_name"}], "active_profile", "last_activated"}`, `GET /api/profile/active` is
  `{"active_profile": ...}`.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

from smplwise.services.recorders import frigate as fr
from smplwise.services.recorders import frigate_control as fc
from smplwise.services.recorders import frigate_http as fh

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from test_frigate_control import BASE, World, _clean, world  # noqa: E402,F401  (fixtures)
from test_frigate_f2b import EXPORT, _export  # noqa: E402

ROUTES = json.loads((Path(__file__).resolve().parent / "fixtures" / "frigate_openapi_0_18_2_routes.json").read_text(encoding="utf-8"))
EV = "1791228153.570607-8wg30r"
RV = "1791228116.185418-be2uit"

# Every call Arx sends, as (allow-list, method, concrete path). Each must be allowed by Arx AND exist in Frigate 0.18.2 with that method.
CALLS = [
    ("get", "GET", "/api/version"), ("get", "GET", "/api/stats"), ("get", "GET", "/api/config"), ("get", "GET", "/api/openapi.json"),
    ("get", "GET", "/api/go2rtc/streams"), ("get", "GET", "/api/labels"), ("get", "GET", "/api/sub_labels"), ("get", "GET", "/api/profile"),
    ("get", "GET", "/api/profiles"), ("get", "GET", "/api/profile/active"), ("get", "GET", "/api/events"), ("get", "GET", f"/api/events/{EV}"),
    ("get", "GET", f"/api/events/{EV}/thumbnail.jpg"), ("get", "GET", f"/api/events/{EV}/snapshot.jpg"), ("get", "GET", "/api/review"),
    ("get", "GET", f"/api/review/{RV}"), ("get", "GET", "/api/review/summary"), ("get", "GET", "/api/review/activity/motion"),
    ("get", "GET", "/api/front_door/recordings"), ("get", "GET", "/api/front_door/recordings/summary"), ("get", "GET", "/api/recordings/storage"),
    ("get", "GET", "/api/front_door/latest.jpg"), ("get", "GET", "/api/front_door/recordings/1791228000.5/snapshot.jpg"),
    ("control", "GET", "/api/front_door/ptz/info"), ("control", "GET", "/api/exports"), ("control", "GET", "/api/cases"),
    ("control", "GET", "/api/config/schema.json"), ("control", "GET", "/api/jobs/export/front_door_ab12cd"),
    ("clip", "GET", "/api/front_door/start/1791228000/end/1791228060/clip.mp4"), ("clip", "GET", f"/api/events/{EV}/clip.mp4"),
    ("analytics", "PUT", "/api/camera/front_door/set/improve_contrast"), ("analytics", "PUT", "/api/camera/front_door/set/detect"),
    ("analytics", "PUT", "/api/camera/front_door/set/zone/porch"), ("analytics", "PUT", "/api/camera/front_door/set/motion_mask/tree"),
    ("clip", "GET", "/api/review/1791228116.185418-be2uit/clip.mp4"),
    ("record", "PUT", "/api/camera/front_door/set/snapshots"), ("profile", "PUT", "/api/camera/*/set/profile"),
    ("review", "POST", "/api/reviews/viewed"), ("review", "DELETE", f"/api/review/{RV}/viewed"),
    ("events", "POST", f"/api/events/{EV}/retain"), ("events", "DELETE", f"/api/events/{EV}/retain"), ("events", "POST", f"/api/events/{EV}/sub_label"),
    ("events", "POST", "/api/events/front_door/person/create"), ("events", "PUT", f"/api/events/{EV}/end"),
    ("exports", "POST", "/api/export/front_door/start/1791228000/end/1791228060"), ("exports", "PATCH", "/api/export/front_door_ab12cd/rename"),
    ("exports", "POST", "/api/exports/delete"), ("exports", "POST", "/api/exports/reassign"),
    ("cases", "POST", "/api/cases"), ("cases", "PATCH", "/api/cases/abcdef123456"), ("cases", "DELETE", "/api/cases/abcdef123456"),
    ("config", "PUT", "/api/config/set"),
]


def _spec_has(method: str, path: str) -> bool:
    assert path.startswith("/api/")
    if path == "/api/openapi.json":
        return method == "GET"   # served by FastAPI itself, not listed inside the document
    rel = path[len("/api"):]
    for m, tpl in ROUTES["routes"]:
        if m != method:
            continue
        rx = "^" + re.sub(r"\\\{[^}]+\\\}", "[^/]+", re.escape(tpl)) + "$"
        if re.match(rx, rel):
            return True
    return False


def _arx_allows(kind: str, method: str, path: str) -> bool:
    if kind == "get":
        return method == "GET" and fh.allowed(path)
    if kind == "control":
        return method == "GET" and fh.control_read_allowed(path)
    if kind == "clip":
        return method == "GET" and fh.clip_allowed(path)
    return fh.write_allowed(kind, method, path)


@pytest.mark.parametrize("kind,method,path", CALLS)
def test_every_call_arx_makes_exists_in_frigate_0_18_2(kind, method, path):
    assert _arx_allows(kind, method, path), f"Arx does not allow its own call {method} {path}"
    assert _spec_has(method, path), f"{method} {path} is not a Frigate 0.18.2 route"


def test_every_write_allow_list_entry_is_one_of_the_checked_calls():
    """A write shape added later without a 0.18 check fails here (the list above is the place to add it, with its spec route)."""
    for klass, entries in fh.WRITE_ALLOWED.items():
        for method, rx in entries:
            assert any(k == klass and m == method and rx.fullmatch(p) for k, m, p in CALLS), (klass, method, rx.pattern)


def test_the_guessed_shapes_of_the_earlier_phases_are_gone():
    assert not _spec_has("DELETE", "/api/export/front_door_ab12cd"), "0.18.2 has no per-id export delete"
    assert not fh.write_allowed("exports", "DELETE", "/api/export/front_door_ab12cd")


# ---------------------------------------------------------------------------------------------- adapter + service, against the 0.18.2 fake

def _ctl(w: World) -> fc.FrigateControl:
    return fc.FrigateControl(fr.FrigateAdapter("nvr-1", w.s, transport=w.fake.transport()))


def test_profiles_are_read_from_the_0_18_documents_in_one_request(world):
    world.fake.active_profile = "away"
    n = len(world.fake.hits)
    got = _ctl(world).active_profile()
    assert got == {"names": ["away", "home"], "active": "away"}
    assert [h for h in world.fake.hits[n:] if "/profile" in h] == ["GET /api/profiles"], "the active profile comes with the list"
    world.fake.active_profile = None
    assert _ctl(world).active_profile()["active"] is None
    world.fake.active_profile = "home"
    view = world.call("GET", f"{BASE}/profiles").json()
    assert view["names"] == ["away", "home"] and view["active"] == "home", "document keys (profiles, active_profile, last_activated) are not profile names"


def test_a_sub_label_is_cleared_with_an_empty_string_and_its_late_arrival_is_waited_for(world, monkeypatch):
    monkeypatch.setattr(fc, "READBACK_DELAY_S", 0.0)
    world.poll()
    ev = world.fake.reviews[0]["data"]["detections"][0]
    world.policy(events=True)
    world.fake.sub_label_lag = 2   # Frigate shows the new value only on the third read
    s = world.call("POST", f"{BASE}/events/{ev}/sub-label", json={"sub_label": "arx-test"}).json()
    assert s["changed"] is True and s["verified"] is True and world.fake.event_state[ev]["sub_label"] == "arx-test"
    undo = world.call("POST", f"{BASE}/changes/{s['change_id']}/revert", json={})
    assert undo.status_code == 200 and undo.json()["verified"] is True and world.fake.event_state[ev]["sub_label"] is None
    sent = [b for m, p, b in world.fake.writes if p.endswith("/sub_label")]
    assert sent == [{"subLabel": "arx-test"}, {"subLabel": ""}], "never a null (0.18.2 answers 422)"
    world.fake.sub_label_lag = 99
    late = world.call("POST", f"{BASE}/events/{ev}/sub-label", json={"sub_label": "slow"}).json()
    assert late["changed"] is True and late["verified"] is False, "not settled within the read-back window: unverified, not repeated"
    assert len([1 for m, p, b in world.fake.writes if p.endswith("/sub_label")]) == 3


def test_an_export_is_queued_with_the_0_18_body_and_deleted_through_the_bulk_route(world):
    world.policy(exports=True)
    r = _export(world).json()
    eid = r["export_id"]
    assert world.fake.writes[-1] == ("POST", f"/api/export/cam_front/start/{EXPORT['start']:.3f}/end/{EXPORT['end']:.3f}", {"name": EXPORT["name"], "source": "recordings"})
    gone = world.call("POST", f"{BASE}/exports/{eid}/delete", json={"confirm": True, "supervised": True}).json()
    assert gone["deleted"] is True and gone["verified"] is True
    assert world.fake.writes[-1] == ("POST", "/api/exports/delete", {"ids": [eid]})
    assert not [h for h in world.fake.hits if h.startswith("DELETE /api/export")]


def test_a_queued_export_is_read_back_from_its_job(world):
    world.policy(exports=True)
    world.fake.export_queue_only = True
    r = _export(world).json()
    assert r["verified"] is True and r["queued"] is True and r["export_id"] in world.fake.export_jobs
    assert world.changes()[0]["status"] == "applied"
    world.fake.export_jobs.clear()
    r2 = _export(world, name="Lost job").json()
    assert r2["verified"] is False and r2["queued"] is False and world.changes()[0]["status"] == "unverified"
