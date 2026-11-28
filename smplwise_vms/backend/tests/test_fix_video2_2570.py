"""FIX-VIDEO2-2570: the video / devices findings of the second deep review (docs/review/DEEP-REVIEW-2570-VIDEO-DEVICES.md, VD2-NN).

- VD2-02: "detect by pressing" listens with the request's write lock released (another writer is not locked out for 30 s), and one
  listen per caller runs at a time (409 `listen_running`).
- VD2-04: a recording search on the autumn clock-change night places a file that crosses the repeated hour, finds the files of the
  second occurrence, and says the answer is partial (never `complete`); a playback start inside the repeated hour says the recorder
  may play the other occurrence.
- VD2-06: a recorder that says MORE but repeats a page is reported `partial`.
- VD2-07: an impossible date is a 422 naming the field, not a 500.
- VD2-08: a recording-schedule action that crosses midnight is read as the ranges of the days it covers (the week can be saved).
- VD2-09: a smart-rules save whose second document fails answers an error that says the first one was written.
- VD2-10: editing a shared view keeps the cameras the editor may not watch; editing a shared view needs the right to manage shared views.
Each test failed on v2.56.0 (6ea807b2e) and passes with the fix."""
from __future__ import annotations

import datetime as dt
import sqlite3
import types

import httpx
import pytest
from automations_fixture import *  # noqa: F401,F403
from automations_fixture import autos_app  # noqa: F401
from automations_fixture import API
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient
from test_kav079_api import with_wall_switch
from test_nvr_schedule import FakeNvr, TRACK, _action
from test_recordings import FakeGo2rtc, lab_client, set_track, xml_page  # noqa: F401 - lab_client is a fixture

from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import automation_ext as ext
from smplwise.services import nvr, nvr_schedule, nvr_write, recordings
from smplwise.services import playback as pb
from smplwise.services.timeutil import instant_in_repeated_hour, nvr_span_to_utc, parse_utc, wall_is_repeated, zone

TZ = zone("Asia/Jerusalem")  # 2026-10-25 02:00 IDT -> 01:00 IST: 01:00-02:00 wall clock happens twice (22:00Z-23:00Z, 23:00Z-24:00Z)
FOLD_DAY = "2026-10-25"


# ---------------------------------------------------------------- VD2-02

def test_detect_by_pressing_listens_without_holding_the_write_lock_and_one_listen_per_caller(autos_app):
    app, s, c, fake, tr = autos_app
    with_wall_switch(app, tr)
    assert c.patch(f"{API}/settings", json={"automations.wall_buttons_editable": "true"}).status_code == 200
    seen: dict[str, object] = {}

    class Probe(ext.Listener):
        def listen(self, triggers, timeout_s):
            # another writer (an alarm disarm, a door command's audit row) during the listen
            other = sqlite3.connect(str(app.state.db.path), timeout=0.3, isolation_level=None)
            try:
                other.execute("BEGIN IMMEDIATE")
                other.execute("ROLLBACK")
                seen["other_writer"] = "ok"
            except sqlite3.OperationalError as exc:
                seen["other_writer"] = str(exc)
            finally:
                other.close()
            user = next(iter(ext._LISTENING), None)
            seen["listening"] = user
            ctx = types.SimpleNamespace(principal=types.SimpleNamespace(user_id=user), cfg={})
            try:
                ext.detect_press(ctx, "dev_living_switch", [])
            except ApiError as exc:
                seen["second"] = (exc.status, exc.code)
            return triggers[0]

    ext.set_listener(Probe())
    try:
        r = c.post(f"{API}/automations-ext/wall-buttons/dev_living_switch/detect", json={})
    finally:
        ext.set_listener(None)
    assert r.status_code == 200 and r.json()["detected"] is True, r.text
    assert seen["other_writer"] == "ok", f"the listen held the write lock: {seen['other_writer']}"
    assert seen["listening"] is not None and seen["second"] == (409, "listen_running"), seen
    assert not ext._LISTENING, "the guard is released when the listen ends"
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'automation.button_detect'").fetchone()[0] == 1, "the audit row is still written"


# ---------------------------------------------------------------- VD2-04 / 06 / 07

def test_the_zone_names_the_repeated_hour_and_not_the_spring_gap():
    assert wall_is_repeated(dt.datetime(2026, 10, 25, 1, 30), TZ) is True
    assert wall_is_repeated(dt.datetime(2026, 10, 25, 2, 30), TZ) is False
    assert wall_is_repeated(dt.datetime(2026, 3, 27, 2, 30), TZ) is False, "a spring-gap time names no instant twice"
    assert instant_in_repeated_hour(parse_utc("2026-10-24T22:30:00Z"), TZ) and instant_in_repeated_hour(parse_utc("2026-10-24T23:30:00Z"), TZ)
    assert not instant_in_repeated_hour(parse_utc("2026-10-25T00:30:00Z"), TZ)
    # a file from 01:40 (first occurrence) to 01:20 (second): 22:40Z -> 23:20Z
    s, e, amb = nvr_span_to_utc("2026-10-25T01:40:00Z", "2026-10-25T01:20:00Z", TZ)
    assert (s, e, amb) == (parse_utc("2026-10-24T22:40:00Z"), parse_utc("2026-10-24T23:20:00Z"), True)
    # an ordinary summer file is exact and not ambiguous
    assert nvr_span_to_utc("2026-09-14T10:00:00Z", "2026-09-14T10:30:00Z", TZ) == (parse_utc("2026-09-14T07:00:00Z"), parse_utc("2026-09-14T07:30:00Z"), False)
    assert nvr_span_to_utc("2026-09-14T10:30:00Z", "2026-09-14T10:00:00Z", TZ) is None, "a reversed file is malformed"


def _cam(client, s, channel: int, track: int) -> dict:
    cam = client.post("/api/v1/cameras", json={"channel": channel, "alias": f"vd2-{channel}"}).json()
    set_track(s, cam["id"], track)
    return cam


def test_a_file_across_the_autumn_change_is_kept_and_the_day_is_partial(lab_client, monkeypatch):
    client, s = lab_client
    recordings.invalidate()
    cam = _cam(client, s, 4, 401)

    def fold_night(_settings, track_id, start_wall, end_wall, position=0, page_size=40, search_id=None):
        return nvr.parse_search_response(xml_page([("2026-10-25T00:10:00Z", "2026-10-25T00:30:00Z", "CMR"),
                                                   ("2026-10-25T01:40:00Z", "2026-10-25T01:20:00Z", "MOTION")], "OK"), track_id)

    monkeypatch.setattr(nvr, "search_recordings", fold_night)
    r = client.get(f"/api/v1/cameras/{cam['id']}/recordings?date={FOLD_DAY}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert ("2026-10-24T22:40:00Z", "2026-10-24T23:20:00Z", "motion") in [(x["start_at"], x["end_at"], x["kind"]) for x in body["segments"]], body
    assert body["coverage"] == "partial" and "שעון חורף" in body["note"], body


def test_a_search_inside_the_second_occurrence_finds_its_files(lab_client, monkeypatch):
    client, s = lab_client
    recordings.invalidate()
    cam = _cam(client, s, 5, 501)

    def repeated(_settings, track_id, start_wall, end_wall, position=0, page_size=40, search_id=None):
        return nvr.parse_search_response(xml_page([("2026-10-25T01:10:00Z", "2026-10-25T01:20:00Z", "MOTION")], "OK"), track_id)

    monkeypatch.setattr(nvr, "search_recordings", repeated)
    body = client.get(f"/api/v1/cameras/{cam['id']}/recordings?from=2026-10-24T23:00:00Z&to=2026-10-25T00:00:00Z").json()
    assert [(x["start_at"], x["end_at"]) for x in body["segments"]] == [("2026-10-24T23:10:00Z", "2026-10-24T23:20:00Z")], body
    assert body["coverage"] == "partial", "the file may belong to the other occurrence: never `complete`"


def test_a_repeated_page_is_partial_and_an_impossible_date_is_a_422(lab_client, monkeypatch):
    client, s = lab_client
    recordings.invalidate()
    cam = _cam(client, s, 6, 601)
    pages: list[int] = []

    def stuck(_settings, track_id, start_wall, end_wall, position=0, page_size=40, search_id=None):
        pages.append(position)
        return nvr.parse_search_response(xml_page([("2026-09-14T10:00:00Z", "2026-09-14T10:30:00Z", "CMR")], "MORE"), track_id)

    monkeypatch.setattr(nvr, "search_recordings", stuck)
    body = client.get(f"/api/v1/cameras/{cam['id']}/recordings?from=2026-09-14T06:00:00Z&to=2026-09-14T12:00:00Z").json()
    assert pages == [0, 40] and body["coverage"] == "partial" and "עמוד" in body["note"], body
    r = client.get(f"/api/v1/cameras/{cam['id']}/recordings?date=2026-02-30")
    assert r.status_code == 422 and r.json()["code"] == "validation" and r.json()["details"]["fields"] == ["date"], r.text


def test_a_playback_start_inside_the_repeated_hour_says_so(lab_client, monkeypatch):
    client, s = lab_client
    recordings.invalidate()
    pb.REGISTRY.sessions.clear()
    pb.set_instance_id("vd2")
    FakeGo2rtc.store, FakeGo2rtc.deleted = {}, []
    monkeypatch.setattr(pb.g2, "Go2rtc", FakeGo2rtc)
    cam = _cam(client, s, 7, 701)

    def files(_settings, track_id, start_wall, end_wall, position=0, page_size=40, search_id=None):
        return nvr.parse_search_response(xml_page([("2026-10-25T00:00:00Z", "2026-10-25T05:00:00Z", "CMR")], "OK"), track_id)

    monkeypatch.setattr(nvr, "search_recordings", files)
    inside = client.post("/api/v1/playback/sessions", json={"camera_id": cam["id"], "start_at": "2026-10-24T23:30:00Z"})
    assert inside.status_code == 201, inside.text
    assert "שעון חורף" in (inside.json().get("clock_change_note") or ""), inside.json()
    outside = client.post("/api/v1/playback/sessions", json={"camera_id": cam["id"], "start_at": "2026-10-25T02:00:00Z"})
    assert outside.status_code == 201 and outside.json().get("clock_change_note") is None


# ---------------------------------------------------------------- VD2-08

def test_a_recording_action_across_midnight_is_split_and_the_week_saves():
    track = TRACK.replace(_action(2, "Tuesday", "08:00:00", "Tuesday", "18:00:00", "CMR"), _action(2, "Tuesday", "22:00:00", "Wednesday", "06:00:00", "CMR"))
    days = nvr_schedule.record_from_track(track)["days"]
    assert days[1] == [{"begin": "22:00:00", "end": "24:00:00", "mode": "CMR"}], days[1]
    assert days[2] == [{"begin": "00:00:00", "end": "06:00:00", "mode": "CMR"}], days[2]
    assert days[0] == [{"begin": "00:00:00", "end": "24:00:00", "mode": "MOTION"}], "an action ending next day at 00:00 stays a whole day"
    nvr_schedule.check_week(days, modes=True)  # no 422: the next save of any day goes through
    doc = nvr_schedule.track_document(track, days)
    assert nvr_schedule.record_from_track(doc)["days"] == days, "written back as two actions, read back the same"


# ---------------------------------------------------------------- VD2-09

def test_a_smart_save_whose_second_document_fails_says_the_first_was_written(settings, monkeypatch):
    fake = FakeNvr()
    good = fake.handler

    def field_refused(request: httpx.Request) -> httpx.Response:
        if request.method == "PUT" and request.url.path.startswith("/ISAPI/Smart/FieldDetection"):
            return httpx.Response(400, text="<ResponseStatus><statusCode>6</statusCode><subStatusCode>badParameters</subStatusCode></ResponseStatus>")
        return good(request)

    fake.handler = field_refused
    monkeypatch.setattr(nvr_write, "_client", fake.client)
    monkeypatch.setattr(nvr, "_client", fake.client)
    with TestClient(create_app(settings)) as c:
        cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()
        r = c.put(f"/api/v1/cameras/{cam['id']}/smart", json={"line": {"enabled": False, "lines": [{"id": 1, "enabled": True, "points": [[100, 900], [900, 100]]}]},
                                                             "field": {"enabled": False, "regions": [{"id": 1, "points": [[100, 100], [900, 100], [900, 900], [100, 900]]}]}})
        assert r.status_code >= 400, r.text
        err = r.json()
        assert err["code"] == "smart_partial_write", err
        assert "חציית קו נכתב למקליט" in err["user_message"] and "פריצה לאזור" in err["user_message"], err["user_message"]
        assert err["details"]["applied"]["line"]["status"] == "applied" and "field" in err["details"]["failed"], err["details"]
        assert "<positionX>900</positionX>" in fake.docs["/ISAPI/Smart/LineDetection/1"], "the line rule really is on the recorder"
        # only one document asked and it fails: the refusal stands as it was
        only = c.put(f"/api/v1/cameras/{cam['id']}/smart", json={"field": {"enabled": False, "regions": [{"id": 1, "points": [[0, 0], [900, 0], [900, 900], [0, 900]]}]}})
        assert only.status_code >= 400 and only.json()["code"] != "smart_partial_write"


# ---------------------------------------------------------------- VD2-10

def _published_floor_with(c: TestClient, floor_id: str, camera_id: str) -> None:
    asset = c.post(f"/api/v1/floors/{floor_id}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor_id}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    assert c.post(f"/api/v1/floors/{floor_id}/anchors", json={"resource_type": "camera", "resource_id": camera_id, "x": 0.2, "y": 0.2}).status_code == 201


def test_editing_a_shared_view_keeps_the_cameras_the_editor_cannot_watch(settings):
    c = TestClient(create_app(settings))
    ids = seed_tree(c)
    cams = [c.post("/api/v1/cameras", json={"channel": i + 1, "alias": f"מצלמה {i + 1}"}).json()["id"] for i in range(3)]
    _published_floor_with(c, ids["floor2"], cams[1])
    bind(c, settings, "site", "site_admin", "site", ids["site"])  # may manage shared views; watches the cameras placed in his site
    bind(c, settings, "lead", "viewer", "floor", ids["floor2"])  # watches camera 2 only; may not manage shared views
    shared = c.post("/api/v1/views", json={"name": "כל המצלמות", "cameras": cams, "cols": 3, "rows": 1, "shared": True}).json()
    seen = next(v for v in c.get("/api/v1/views", headers=as_user("site")).json()["views"] if v["id"] == shared["id"])
    assert seen["cameras"] == [cams[1]] and seen["hidden_cameras"] == 2
    # the site administrator renames it from what he sees: the two cameras he may not watch stay, at their places
    r = c.put(f"/api/v1/views/{shared['id']}", json={"name": "כניסות", "cameras": seen["cameras"], "cols": 3, "rows": 1, "shared": True}, headers=as_user("site"))
    assert r.status_code == 200, r.text
    assert r.json()["cameras"] == [cams[1]] and r.json()["hidden_cameras"] == 2, "the answer shows only what he may watch"
    full = next(v for v in c.get("/api/v1/views").json()["views"] if v["id"] == shared["id"])
    assert full["cameras"] == cams and full["name"] == "כניסות", full
    # the owner of a shared view who cannot manage shared views no longer edits it for everybody
    mine = c.post("/api/v1/views", json={"name": "שלי", "cameras": [cams[1]]}, headers=as_user("lead")).json()
    from smplwise.db import Database

    with Database(settings.db_path).connection() as conn:
        conn.execute("UPDATE saved_views SET shared = 1 WHERE id = ?", (mine["id"],))  # shared while he still had the right
    r = c.put(f"/api/v1/views/{mine['id']}", json={"name": "שונה", "cameras": [cams[1]], "shared": True}, headers=as_user("lead"))
    assert r.status_code == 403, r.text
    assert c.put(f"/api/v1/views/{mine['id']}", json={"name": "שונה", "cameras": [cams[1]], "shared": True}, headers=as_user("site")).status_code == 403, "not his view either"
