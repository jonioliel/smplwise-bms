"""CR-024 owner answers of 2026-10-04 (docs/changes/CR-024-MULTI-NVR.md section 7):
1. synchronized playback across recorders - an EXPERIMENTAL setting, off by default, each member in its recorder's zone and clock offset;
2. disabling / enabling a recorder applies at once (no restart): background work, go2rtc streams, visibility;
3. the first recorder id is never handed to a new device while history exists under it.

Every device is a fake (two fake NVRs on reserved `.test` names, one with another zone and a clock offset; the fake go2rtc), the
resolver is stubbed, the recording search and the RTSP URL builder are replaced by recorders of what was asked. Made-up passwords."""
from __future__ import annotations

import dataclasses
import datetime as dt
import sys
from pathlib import Path

import pytest
from conftest import as_user
from fastapi.testclient import TestClient

from smplwise import recorder_scope
from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import autosync, connection_probe, events_ingest, recordings
from smplwise.services import playback as pb
from smplwise.services import playback_groups as pg

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import GO2RTC_HOST, NVR_ADDR, NVR_HOST, FakeDevices, install_many  # noqa: E402

NVR2_HOST = "fake-nvr-2.test"
NVR2_ADDR = "192.0.2.81"
PW1 = "Canary-Live-One-11"
PW2 = "Canary-Live-Two-22"
ADD = {"vendor": "hikvision", "host": NVR2_HOST, "http_port": 80, "rtsp_port": 554, "username": "viewer", "password": PW2, "name": "NVR לונדון"}
UTC = dt.timezone.utc


@pytest.fixture()
def fakes(monkeypatch):
    one = FakeDevices()  # Asia/Jerusalem, no drift
    two = FakeDevices(zone="Europe/London", nvr_host=NVR2_HOST, nvr_addr=NVR2_ADDR, shared=False)
    install_many([one, two], monkeypatch)
    table = {NVR_HOST: [NVR_ADDR], NVR2_HOST: [NVR2_ADDR]}
    monkeypatch.setattr(connection_probe, "RESOLVE", lambda h: list(table.get(h.strip().lower().rstrip("."), [])))
    monkeypatch.setattr(connection_probe, "HOSTNAME", lambda: "arx-test-host")
    monkeypatch.setattr(connection_probe, "LOCAL_ADDRESSES", lambda: set(), raising=False)
    for k in list(autosync.STATE):
        monkeypatch.setitem(autosync.STATE, k, None)
    monkeypatch.setattr(autosync, "RECORDER_STATE", {})
    yield one, two
    events_ingest.shutdown_extra()
    events_ingest.EXTRA.clear()
    pb.REGISTRY.sessions.clear()
    pg.GROUPS.clear()


@pytest.fixture()
def base(settings):
    return dataclasses.replace(settings, nvr_host=NVR_HOST, nvr_user="viewer", nvr_password=PW1, go2rtc_url=f"http://{GO2RTC_HOST}:1984")


def client(app):
    c = TestClient(app)
    c.headers.update(as_user("joni"))
    c.get("/api/v1/me")
    return c


def rows(settings, sql, args=()):
    with Database(settings.db_path).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


def two_recorders(base):
    app = create_app(base)
    c = client(app)
    r = c.post("/api/v1/recorders", json=ADD)
    assert r.status_code == 201 and r.json()["recorder_id"] == "nvr-2", r.text
    app = create_app(base)
    autosync.run_once(app.state.db, app.state.settings, reason="startup")
    return app, client(app)


def cam_of(settings, rid, channel=1):
    return rows(settings, "SELECT id FROM cameras WHERE recorder_id = ? AND channel = ?", (rid, channel))[0]["id"]


# ================================================================ 2. disable / enable at once

def test_disabling_a_recorder_applies_at_once_and_enabling_brings_it_back_without_a_restart(base, fakes):
    one, two = fakes
    app, c = two_recorders(base)
    cam1, cam2 = cam_of(base, "nvr-1"), cam_of(base, "nvr-2")
    assert {n for n in one.go2rtc["streams"] if n.startswith("smplwise_nvr-2_")}, "the second recorder's streams exist"
    lst = events_ingest.start_extra_one(app.state.db, app.state.settings, "nvr-2", lambda: "Europe/London")
    assert lst.thread is not None and lst.thread.is_alive()

    r = c.patch("/api/v1/recorders/nvr-2", json={"enabled": False})
    assert r.status_code == 200 and r.json()["restart_required"] is False, r.text
    assert r.json()["recorder"]["status"]["state"] == "disabled"
    # the stop ran after the answer: alert stream, go2rtc streams (exact names; foreign untouched)
    assert lst.stop.is_set()
    assert not [n for n in one.go2rtc["streams"] if n.startswith("smplwise_nvr-2_")]
    assert [n for n in one.go2rtc["streams"] if n.startswith("smplwise_nvr-1_")], "the first recorder's streams stay"
    assert one.go2rtc["foreign"] == ["intercom_door_1", "intercom_door_2"]
    assert all(w.split(" ", 2)[2].startswith("smplwise_") for w in one.writes if w.startswith("go2rtc"))
    # nothing reaches the device any more: a route, the discovery, the stream sync
    two.hits.clear()
    snap = c.get(f"/api/v1/cameras/{cam2}/snapshot.jpg")
    assert snap.status_code == 409 and snap.json()["code"] == "recorder_unavailable"
    sysr = c.get("/api/v1/nvr/system", params={"recorder_id": "nvr-2"})
    assert sysr.status_code == 409 and sysr.json()["code"] == "recorder_unavailable"
    autosync.run_once(app.state.db, app.state.settings, reason="periodic")
    with Database(base.db_path).connection() as conn:
        autosync.ensure_streams(app.state.settings, conn)
    assert two.hits == [], two.hits
    assert not [n for n in one.go2rtc["streams"] if n.startswith("smplwise_nvr-2_")], "the stream sync does not re-create them"
    # visibility: the camera stays listed, not offered for live; the capability set drops the recorder; no restart banner
    cams = {x["id"]: x for x in c.get("/api/v1/cameras").json()["cameras"]}
    assert cams[cam2]["recorder_enabled"] is False and cams[cam2]["can_view_live"] is False and cams[cam1]["recorder_enabled"] is True
    assert [x["id"] for x in c.get("/api/v1/health").json()["capabilities"]["recorders"]] == ["nvr-1"]
    assert c.get("/api/v1/me").json()["connection_pending_restart"] is False
    assert c.get(f"/api/v1/cameras/{cam1}/snapshot.jpg").status_code == 200, "the other recorder is untouched"

    # enable: the alert stream, one discovery and the stream sync run at once - still no restart
    two.hits.clear()
    r = c.patch("/api/v1/recorders/nvr-2", json={"enabled": True})
    assert r.status_code == 200 and r.json()["restart_required"] is False
    assert any("/ISAPI/System/deviceInfo" in h for h in two.hits), "discovered again"
    assert {n for n in one.go2rtc["streams"] if n.startswith("smplwise_nvr-2_")}, "its streams are back"
    assert events_ingest.EXTRA["nvr-2"].thread.is_alive()
    assert c.get(f"/api/v1/cameras/{cam2}/snapshot.jpg").status_code == 200
    assert c.get("/api/v1/cameras").json()["cameras"][0]["recorder_enabled"] is True
    assert c.get("/api/v1/me").json()["connection_pending_restart"] is False


def test_a_disabled_recorders_cameras_stay_on_the_map_marked_without_a_picture(base, fakes):
    """CR-024 section 7.2 (the disable dialog promises it): the placement stays, the map bundle marks the camera
    `recorder_enabled: false` (the map shows no live picture or snapshot and offers it for no saved view); enabling clears it."""
    import sqlite3

    from conftest import seed_tree

    app, c = two_recorders(base)
    tree = seed_tree(c)
    cam1, cam2 = cam_of(base, "nvr-1"), cam_of(base, "nvr-2")
    raw = sqlite3.connect(base.db_path)
    raw.execute("PRAGMA foreign_keys=OFF")
    for aid, cam in (("a1", cam1), ("a2", cam2)):
        raw.execute("INSERT INTO map_anchors(id, floor_id, plan_version_id, resource_type, resource_id, x, y, rotation_degrees, field_of_view_degrees, layer_id, label, revision, effective_from, created_by, updated_by, updated_at) "
                    "VALUES (?, ?, 'pv', 'camera', ?, 0.5, 0.5, 0, 90, 'cameras', 'x', 1, '2026-09-01T00:00:00Z', 't', 't', '2026-09-01T00:00:00Z')", (aid, tree["floor2"], cam))
    raw.commit()
    raw.close()

    def map_cams():
        bundle = c.get(f"/api/v1/floors/{tree['floor2']}/map").json()
        return {a["resource_id"]: a["camera"] for a in bundle["anchors"] if a["resource_type"] == "camera"}

    assert {k: v["recorder_enabled"] for k, v in map_cams().items()} == {cam1: True, cam2: True}
    assert c.patch("/api/v1/recorders/nvr-2", json={"enabled": False}).status_code == 200
    assert {k: v["recorder_enabled"] for k, v in map_cams().items()} == {cam1: True, cam2: False}, "placed, marked"
    assert len(rows(base, "SELECT id FROM map_anchors WHERE resource_id = ? AND effective_to IS NULL", (cam2,))) == 1
    # the camera table (Settings) keeps the row as it was; only the recorder flag changes
    listed = {x["id"]: x for x in c.get("/api/v1/cameras").json()["cameras"]}
    assert listed[cam2]["enabled"] is True and listed[cam2]["recorder_enabled"] is False
    assert c.patch("/api/v1/recorders/nvr-2", json={"enabled": True}).status_code == 200
    assert map_cams()[cam2]["recorder_enabled"] is True


def test_the_first_recorder_disables_at_once_too_and_a_restart_keeps_the_choice(base, fakes):
    one, two = fakes
    app, c = two_recorders(base)
    cam1, cam2 = cam_of(base, "nvr-1"), cam_of(base, "nvr-2")
    r = c.patch("/api/v1/recorders/nvr-1", json={"enabled": False})
    assert r.status_code == 200 and r.json()["restart_required"] is False
    one.hits.clear()
    snap = c.get(f"/api/v1/cameras/{cam1}/snapshot.jpg")
    assert snap.status_code == 409 and snap.json()["code"] == "recorder_unavailable"
    autosync.run_once(app.state.db, app.state.settings, reason="periodic")
    assert not [h for h in one.hits if h.startswith(NVR_HOST)], one.hits
    assert not [n for n in one.go2rtc["streams"] if n.startswith("smplwise_nvr-1_")]
    assert c.get(f"/api/v1/cameras/{cam2}/snapshot.jpg").status_code == 200, "the second recorder carries on"
    assert c.get("/api/v1/health").json()["mode"] == "full"
    # a restart keeps it disabled (from the database) - and enabling then needs no further restart
    app2 = create_app(base)
    assert recorder_scope.is_disabled("nvr-1")
    c2 = client(app2)
    assert c2.get(f"/api/v1/cameras/{cam1}/snapshot.jpg").status_code == 409
    assert c2.patch("/api/v1/recorders/nvr-1", json={"enabled": True}).json()["restart_required"] is False
    assert c2.get(f"/api/v1/cameras/{cam1}/snapshot.jpg").status_code == 200


def test_a_recorder_disabled_at_the_last_start_is_loaded_and_enables_without_a_restart(base, fakes):
    one, two = fakes
    app, c = two_recorders(base)
    c.patch("/api/v1/recorders/nvr-2", json={"enabled": False})
    app2 = create_app(base)
    assert recorder_scope.child_ids(app2.state.settings) == ["nvr-2"] and recorder_scope.is_disabled("nvr-2")
    c2 = client(app2)
    cam2 = cam_of(base, "nvr-2")
    assert c2.get(f"/api/v1/cameras/{cam2}/snapshot.jpg").status_code == 409
    r = c2.patch("/api/v1/recorders/nvr-2", json={"enabled": True})
    assert r.json()["restart_required"] is False and c2.get(f"/api/v1/cameras/{cam2}/snapshot.jpg").status_code == 200


def test_removing_a_recorder_stops_it_at_once(base, fakes):
    one, two = fakes
    app, c = two_recorders(base)
    cam2 = cam_of(base, "nvr-2")
    rev = c.get("/api/v1/recorders/nvr-2/connection").json()["revision"]
    assert c.request("DELETE", "/api/v1/recorders/nvr-2", json={"confirm_text": "הסר", "if_revision": rev}).status_code == 200
    assert not [n for n in one.go2rtc["streams"] if n.startswith("smplwise_nvr-2_")]
    two.hits.clear()
    assert c.get(f"/api/v1/cameras/{cam2}/snapshot.jpg").status_code == 409
    autosync.run_once(app.state.db, app.state.settings, reason="periodic")
    assert two.hits == []


# ================================================================ 3. the first recorder id and its history

def test_the_first_id_is_reused_only_without_history(settings, fakes):
    fresh = dataclasses.replace(settings, go2rtc_url=f"http://{GO2RTC_HOST}:1984")  # no NVR at all (the dev placeholder host)
    c = client(create_app(fresh))
    assert c.get("/api/v1/recorders").json()["primary_has_history"] is False
    r = c.post("/api/v1/recorders", json={**ADD, "host": NVR_HOST, "password": PW1, "name": "ראשי"})
    assert r.status_code == 201 and r.json()["recorder_id"] == "nvr-1", "an installation without recorders and without history"


def test_a_removed_first_recorder_with_history_never_attaches_to_a_new_device(base, fakes):
    app = create_app(base)
    autosync.run_once(app.state.db, app.state.settings, reason="startup")
    c = client(app)
    old_cams = rows(base, "SELECT id FROM cameras WHERE recorder_id = 'nvr-1'")
    assert len(old_cams) == 4
    rev = c.get("/api/v1/nvr/connection").json()["revision"] or 0
    assert c.request("DELETE", "/api/v1/nvr/connection", json={"confirm_text": "הסר", "if_revision": rev}).status_code == 200
    listing = c.get("/api/v1/recorders").json()
    assert listing["count"] == 0 and listing["primary_has_history"] is True
    r = c.post("/api/v1/recorders", json={**ADD, "name": "NVR חדש"})
    assert r.status_code == 201 and r.json()["recorder_id"] == "nvr-2", "history under nvr-1: a new id"
    # the old cameras keep their recorder and stay disabled; the new device never owns them
    assert {x["recorder_id"] for x in rows(base, "SELECT recorder_id FROM cameras WHERE id IN (%s)" % ",".join("?" * len(old_cams)), [x["id"] for x in old_cams])} == {"nvr-1"}
    assert not rows(base, "SELECT 1 FROM cameras WHERE recorder_id = 'nvr-1' AND enabled = 1")
    app2 = create_app(base)
    autosync.run_once(app2.state.db, app2.state.settings, reason="startup")
    assert len(rows(base, "SELECT id FROM cameras WHERE recorder_id = 'nvr-2'")) == 4, "the new device discovers its own rows"
    assert not rows(base, "SELECT 1 FROM cameras WHERE recorder_id = 'nvr-1' AND enabled = 1")


# ================================================================ 1. experimental synchronized playback across recorders

@pytest.fixture()
def capture(monkeypatch):
    """The recording search answers one segment around what was asked; the RTSP builder records what it was asked for."""
    seen: dict[str, list] = {"search": [], "rtsp": []}

    def search(settings, conn, cam, start, end, tz_name):
        seen["search"].append((cam["recorder_id"], start, tz_name))
        seg = recordings.Segment(start_at=(start - dt.timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                                 end_at=(start + dt.timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), kind="continuous", track_id=101, start_raw="", end_raw="")
        return recordings.SearchResult(segments=[seg], coverage="complete", matches=1, pages=1, searched_at="", timezone=tz_name)

    def rtsp(settings, track_id, start, end, tz_name):
        seen["rtsp"].append((settings.nvr_recorder_id, start, tz_name))
        return f"rtsp://fake/{settings.nvr_recorder_id}/{track_id}"

    monkeypatch.setattr(recordings, "search_segments", search)
    monkeypatch.setattr(pb, "playback_rtsp_url", rtsp)
    return seen


AT = dt.datetime(2026, 10, 3, 8, 0, 0, tzinfo=UTC)


def _group(c, cams, at=AT):
    for gid in list(pg.GROUPS):  # one group at a time (the playback quota of 4 sessions)
        c.delete(f"/api/v1/playback/groups/{gid}")
    return c.post("/api/v1/playback/groups", json={"camera_ids": cams, "start_at": at.strftime("%Y-%m-%dT%H:%M:%SZ")})


def test_cross_recorder_sync_is_off_by_default(base, fakes, capture):
    app, c = two_recorders(base)
    r = _group(c, [cam_of(base, "nvr-1"), cam_of(base, "nvr-2")])
    assert r.status_code == 409 and r.json()["code"] == "sync_cross_recorder_unproven"
    assert c.get("/api/v1/settings").json()["settings"]["playback.cross_recorder_sync"] == "false"


def test_cross_recorder_sync_uses_each_recorders_zone_and_clock_offset(base, fakes, capture):
    one, two = fakes
    two.nvr["drift_s"] = 45  # the London recorder's clock runs 45 s ahead
    app, c = two_recorders(base)
    assert c.patch("/api/v1/recorders/nvr-2", json={"time_zone": "Europe/London"}).status_code == 200
    assert c.patch("/api/v1/settings", json={"playback.cross_recorder_sync": "true"}).status_code == 200
    cam1, cam2 = cam_of(base, "nvr-1"), cam_of(base, "nvr-2")
    r = _group(c, [cam1, cam2])
    assert r.status_code == 201, r.text
    g = r.json()
    assert g["experimental"] is True and g["sync"] == "experimental_cross_recorder" and g["missing"] == {}
    clocks = g["recorders"]
    assert clocks["nvr-1"]["time_zone"] == "Asia/Jerusalem" and clocks["nvr-1"]["offset_s"] == 0 and clocks["nvr-1"]["clock"] == "measured"
    assert clocks["nvr-2"]["time_zone"] == "Europe/London" and abs(clocks["nvr-2"]["offset_s"] - 45) <= 1
    off = clocks["nvr-2"]["offset_s"]
    # the search and the playback URL ask each recorder in its own terms: its zone, its clock
    s = {rid: (start, tz) for rid, start, tz in capture["search"]}
    assert s["nvr-1"] == (AT - dt.timedelta(seconds=1), "Asia/Jerusalem")
    assert s["nvr-2"] == (AT + dt.timedelta(seconds=off) - dt.timedelta(seconds=1), "Europe/London")
    u = {rid: (start, tz) for rid, start, tz in capture["rtsp"]}
    assert u["nvr-1"] == (AT, "Asia/Jerusalem") and u["nvr-2"] == (AT + dt.timedelta(seconds=off), "Europe/London")
    # both sessions stand for the same true instant (the group's clock)
    assert {x["requested_at"] for x in g["sessions"]} == {AT.strftime("%Y-%m-%dT%H:%M:%SZ")}
    # a seek keeps each member's offset
    capture["rtsp"].clear()
    later = AT + dt.timedelta(minutes=10)
    assert c.post(f"/api/v1/playback/groups/{g['id']}/seek", json={"start_at": later.strftime("%Y-%m-%dT%H:%M:%SZ")}).status_code == 200
    u = {rid: (start, tz) for rid, start, tz in capture["rtsp"]}
    assert u["nvr-2"] == (later + dt.timedelta(seconds=off), "Europe/London") and u["nvr-1"] == (later, "Asia/Jerusalem")
    audit = rows(base, "SELECT details_json FROM audit_log WHERE action = 'video.playback.group'")
    assert "experimental_cross_recorder" in audit[-1]["details_json"]


def test_a_naive_clock_in_the_recorders_zone_is_handled(base, fakes, capture):
    one, two = fakes
    two.nvr.update(drift_s=-30, naive=True)
    app, c = two_recorders(base)
    c.patch("/api/v1/recorders/nvr-2", json={"time_zone": "Europe/London"})
    c.patch("/api/v1/settings", json={"playback.cross_recorder_sync": "true"})
    g = _group(c, [cam_of(base, "nvr-1"), cam_of(base, "nvr-2")]).json()
    assert abs(g["recorders"]["nvr-2"]["offset_s"] + 30) <= 1 and g["missing"] == {}


def test_defensive_refusals_keep_the_other_members(base, fakes, capture):
    one, two = fakes
    app, c = two_recorders(base)
    c.patch("/api/v1/settings", json={"playback.cross_recorder_sync": "true"})
    cam1, cam2 = cam_of(base, "nvr-1"), cam_of(base, "nvr-2")
    # the London recorder reports +01:00 but its recorder has no zone (the installation's, Jerusalem): refused, never guessed
    g = _group(c, [cam1, cam2]).json()
    assert g["missing"] == {cam2: "recorder_zone_mismatch"} and len(g["sessions"]) == 1
    # a clock an hour off is a misconfigured recorder, not drift
    c.patch("/api/v1/recorders/nvr-2", json={"time_zone": "Europe/London"})
    two.nvr["drift_s"] = 3600
    g = _group(c, [cam1, cam2]).json()
    assert g["missing"] == {cam2: "clock_offset_too_large"} and g["recorders"]["nvr-2"]["refused"] == "clock_offset_too_large"
    # an unreadable clock: the member plays with offset 0 and says so
    two.nvr.update(drift_s=0, time_error=True)
    g = _group(c, [cam1, cam2]).json()
    assert g["missing"] == {} and g["recorders"]["nvr-2"]["clock"] == "unknown" and g["recorders"]["nvr-2"]["offset_s"] == 0
    # a disabled recorder's members are refused
    two.nvr["time_error"] = False
    c.patch("/api/v1/recorders/nvr-2", json={"enabled": False})
    r = _group(c, [cam1, cam2])
    assert r.status_code == 201, r.text
    assert r.json()["missing"].get(cam2) == "recorder_unavailable", r.json()


def test_a_single_recorder_group_is_untouched_by_the_setting(base, fakes, capture):
    one, two = fakes
    two.nvr["drift_s"] = 45
    app, c = two_recorders(base)
    c.patch("/api/v1/settings", json={"playback.cross_recorder_sync": "true"})
    g = _group(c, [cam_of(base, "nvr-2", 1), cam_of(base, "nvr-2", 2)]).json()
    assert "experimental" not in g and g["sync"] == "best_effort"
    assert {start for _rid, start, _tz in capture["rtsp"]} == {AT}, "no offset on the proven single-recorder path"
