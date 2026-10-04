"""CR-024 (docs/changes/CR-024-MULTI-NVR.md): one installation managing two recorders.

Every device here is a fake: two fake NVRs on reserved `.test` names (tests/fixtures/fake_devices.py, answered on httpx's
transport; the first fake also answers go2rtc), a stubbed resolver (no DNS from a test). The passwords are made-up canaries."""
from __future__ import annotations

import dataclasses
import json
import sys
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise import recorder_scope
from smplwise.db import Database, now_iso
from smplwise.main import create_app
from smplwise.mode import FULL, installation_mode
from smplwise.services import autosync, connection_probe, events_ingest
from smplwise.services import go2rtc as g2
from smplwise.services.recorders import registry

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import GO2RTC_HOST, NVR_ADDR, NVR_HOST, FakeDevices, install_many  # noqa: E402

NVR2_HOST = "fake-nvr-2.test"
NVR2_ADDR = "192.0.2.81"  # TEST-NET-1 (RFC 5737), documentation only
PW1 = "Canary-Pw-One-71"
PW2 = "Canary-Pw-Two-82"
ADD = {"vendor": "hikvision", "host": NVR2_HOST, "http_port": 80, "rtsp_port": 554, "username": "viewer", "password": PW2, "name": "NVR מחסן"}


@pytest.fixture()
def fakes(monkeypatch):
    one = FakeDevices()
    two = FakeDevices(nvr_host=NVR2_HOST, nvr_addr=NVR2_ADDR, shared=False)
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


@pytest.fixture()
def base(settings):
    """An installation running its first NVR from the legacy connection (fake NVR 1) with go2rtc."""
    return dataclasses.replace(settings, nvr_host=NVR_HOST, nvr_user="viewer", nvr_password=PW1, go2rtc_url=f"http://{GO2RTC_HOST}:1984")


def client(app, user="joni"):
    c = TestClient(app)
    c.headers.update(as_user(user))
    c.get("/api/v1/me")
    return c


def rows(settings, sql, args=()):
    with Database(settings.db_path).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


def two_recorders(base, fakes):
    """Add the second recorder through the API, restart, discover both. Returns (app, client)."""
    app = create_app(base)
    c = client(app)
    r = c.post("/api/v1/recorders", json=ADD)
    assert r.status_code == 201, r.text
    assert r.json()["recorder_id"] == "nvr-2" and r.json()["restart_required"] is True
    app = create_app(base)  # the restart that applies it
    autosync.run_once(app.state.db, app.state.settings, reason="startup")
    return app, client(app)


# ---------------------------------------------------------------- add, restart, discovery, names

def test_add_a_second_recorder_restart_and_discover_both(base, fakes):
    one, two = fakes
    app = create_app(base)
    c = client(app)
    r = c.post("/api/v1/recorders", json=ADD)
    assert r.status_code == 201, r.text
    assert PW2 not in r.text and "password_enc" not in r.text
    listing = c.get("/api/v1/recorders").json()
    by_id = {x["id"]: x for x in listing["recorders"]}
    assert by_id["nvr-2"]["pending_restart"] is True and by_id["nvr-2"]["status"]["state"] == "pending_restart"
    assert by_id["nvr-2"]["name"] == "NVR מחסן" and by_id["nvr-2"]["connection"]["has_password"] is True
    assert not any(h.startswith(NVR2_HOST) and "deviceInfo" not in h and "channels" not in h for h in two.hits), "the test is read-only"
    assert two.writes == [] and one.writes == []

    app2 = create_app(base)
    eff = app2.state.settings
    assert recorder_scope.child_ids(eff) == ["nvr-2"]
    child = recorder_scope.settings_for(eff, "nvr-2")
    assert child.nvr_host == NVR2_HOST and child.nvr_password == PW2 and child.nvr_recorder_id == "nvr-2"
    assert PW2 not in repr(eff) and PW2 not in repr(child)
    autosync.run_once(app2.state.db, eff, reason="startup")
    c2 = client(app2)
    cams = c2.get("/api/v1/cameras").json()
    assert sorted({x["recorder_id"] for x in cams["cameras"]}) == ["nvr-1", "nvr-2"] and len(cams["cameras"]) == 8
    assert [x["id"] for x in cams["recorders"]] == ["nvr-1", "nvr-2"]
    # the same name and channel on both recorders: told apart by the recorder's name
    names = [x["name"] for x in cams["cameras"] if x["channel"] == 1]
    assert len(set(names)) == 2 and any("NVR מחסן" in n for n in names), names
    assert all(x["recorder_name"] for x in cams["cameras"])
    only2 = c2.get("/api/v1/cameras", params={"recorder_id": "nvr-2"}).json()["cameras"]
    assert len(only2) == 4 and {x["recorder_id"] for x in only2} == {"nvr-2"}
    # every recorder's streams in go2rtc carry its id; the foreign streams were never touched
    assert {n for n in one.go2rtc["streams"] if n.startswith("smplwise_nvr-2_")} == {f"smplwise_nvr-2_ch{c}_{p}" for c in range(1, 5) for p in ("main", "sub")}
    assert one.go2rtc["foreign"] == ["intercom_door_1", "intercom_door_2"]
    assert all(w.split(" ", 2)[2].startswith("smplwise_") for w in one.writes if w.startswith("go2rtc")), one.writes
    listing = c2.get("/api/v1/recorders").json()
    assert {x["id"]: x["status"]["state"] for x in listing["recorders"]} == {"nvr-1": "online", "nvr-2": "online"}
    assert listing["count"] == 2
    caps = {r["id"] for r in c2.get("/api/v1/me").json().get("capabilities", {}).get("recorders", [])} or {r["id"] for r in c2.get("/api/v1/health").json()["capabilities"]["recorders"]}
    assert caps == {"nvr-1", "nvr-2"}
    with Database(base.db_path).connection(mode="read") as conn:
        rec = conn.execute("SELECT * FROM recorders WHERE id = 'nvr-2'").fetchone()
    assert json.loads(rec["capabilities_json"])["vendor"] == "hikvision" and rec["model"] == "DS-7616NI-FAKE"


def test_one_recorder_down_never_stops_the_other(base, fakes):
    one, two = fakes
    app, c = two_recorders(base, fakes)
    two.nvr["up"] = False
    one.hits.clear()
    autosync.run_once(app.state.db, app.state.settings, reason="periodic")
    assert autosync.STATE["cameras_last_error"] is None and autosync.STATE["cameras_last_ok"]
    assert autosync.recorder_state("nvr-2")["cameras_last_error"] == "source_unavailable"
    assert autosync.STATE["streams_last_error"] is None, "the stream sync still runs for the recorder that answered"
    cams = c.get("/api/v1/cameras").json()["cameras"]
    cam1 = next(x for x in cams if x["recorder_id"] == "nvr-1")
    cam2 = next(x for x in cams if x["recorder_id"] == "nvr-2")
    assert c.get(f"/api/v1/cameras/{cam1['id']}/snapshot.jpg").status_code == 200
    r = c.get(f"/api/v1/cameras/{cam2['id']}/snapshot.jpg")
    assert r.status_code == 503 and r.json()["code"] == "source_unavailable"
    states = {x["id"]: x["status"] for x in c.get("/api/v1/recorders").json()["recorders"]}
    assert states["nvr-1"]["state"] == "online" and states["nvr-2"]["state"] == "error" and states["nvr-2"]["error"] == "source_unavailable"
    health = {x["id"]: x for x in c.get("/api/v1/health").json()["recorders"]}
    assert health["nvr-2"]["discovery_last_error"] == "source_unavailable" and health["nvr-1"]["discovery_last_error"] is None
    assert c.get("/api/v1/recorders/nvr-2/health").json() == {"recorder_id": "nvr-2", "online": False, "model": None, "firmware": None, "error": "source_unavailable"}
    assert c.get("/api/v1/recorders/nvr-1/health").json()["online"] is True
    # the other recorder's 401 is its own problem too
    two.nvr.update(up=True, auth=False)
    autosync.run_once(app.state.db, app.state.settings, reason="periodic")
    assert autosync.STATE["cameras_last_error"] is None and autosync.recorder_state("nvr-2")["cameras_last_error"] == "source_forbidden"


def test_every_camera_route_reaches_only_the_cameras_own_recorder(base, fakes):
    one, two = fakes
    app, c = two_recorders(base, fakes)
    cam2 = next(x for x in c.get("/api/v1/cameras").json()["cameras"] if x["recorder_id"] == "nvr-2")
    one.hits.clear()
    two.hits.clear()
    for path in (f"/api/v1/cameras/{cam2['id']}/snapshot.jpg", f"/api/v1/cameras/{cam2['id']}/zones", f"/api/v1/cameras/{cam2['id']}/capabilities",
                 f"/api/v1/cameras/{cam2['id']}/osd", f"/api/v1/cameras/{cam2['id']}/schedules", f"/api/v1/cameras/{cam2['id']}/smart",
                 f"/api/v1/nvr/cameras/{cam2['id']}"):
        r = c.get(path)
        # a 503 is the fake answering 404 for a document it does not have; never a crash, never "recorder unavailable"
        assert r.status_code not in (500, 409), (path, r.status_code, r.text[:200])
    assert not [h for h in one.hits if h.startswith(NVR_HOST)], one.hits
    assert two.hits, "the second recorder answered"
    # the installation-level routes take ?recorder_id=
    two.hits.clear()
    assert c.get("/api/v1/nvr/system", params={"recorder_id": "nvr-2"}).json()["recorder_id"] == "nvr-2"
    assert any("/ISAPI/System/time" in h for h in two.hits) and not [h for h in one.hits if h.startswith(NVR_HOST)]
    assert c.get("/api/v1/nvr/system", params={"recorder_id": "nvr-9"}).status_code == 404
    assert c.get("/api/v1/storage", params={"recorder_id": "nvr-2"}).json()["recorder_id"] == "nvr-2"
    # the single-recorder default is unchanged: no recorder id = the first recorder
    one.hits.clear()
    two.hits.clear()
    assert c.get("/api/v1/nvr/system").json()["recorder_id"] == "nvr-1"
    assert any("/ISAPI/System/time" in h for h in one.hits) and not two.hits


def test_the_same_name_and_serial_on_two_recorders_are_two_cameras_and_a_swap_is_caught(base, fakes):
    one, two = fakes
    one.nvr["serials"] = {1: "SN-SAME-0001"}
    two.nvr["serials"] = {1: "SN-SAME-0001"}
    app, c = two_recorders(base, fakes)
    cams = rows(base, "SELECT id, recorder_id, channel, source_ref, device_fingerprint, enabled FROM cameras WHERE channel = 1 ORDER BY recorder_id")
    assert [x["recorder_id"] for x in cams] == ["nvr-1", "nvr-2"] and all(x["source_ref"] == "1" and x["enabled"] == 1 for x in cams)
    assert cams[0]["device_fingerprint"] and cams[1]["device_fingerprint"] and cams[0]["device_fingerprint"] != cams[1]["device_fingerprint"]
    assert not rows(base, "SELECT 1 FROM cameras WHERE device_fingerprint LIKE '%SN-SAME%'"), "the serial itself is never stored"
    autosync.run_once(app.state.db, app.state.settings, reason="periodic")
    assert all(x["enabled"] == 1 for x in rows(base, "SELECT enabled FROM cameras")), "a second discovery changes nothing"
    # another physical camera in slot 1 of the second recorder: disabled and audited, the first recorder's untouched
    two.nvr["serials"] = {1: "SN-OTHER-0002"}
    autosync.run_once(app.state.db, app.state.settings, reason="periodic")
    after = {x["recorder_id"]: x for x in rows(base, "SELECT recorder_id, enabled, device_fingerprint FROM cameras WHERE channel = 1")}
    assert after["nvr-2"]["enabled"] == 0 and after["nvr-1"]["enabled"] == 1 and after["nvr-2"]["device_fingerprint"] != cams[1]["device_fingerprint"]
    audit = rows(base, "SELECT details_json FROM audit_log WHERE action = 'cameras.replaced'")
    assert len(audit) == 1 and json.loads(audit[0]["details_json"])["recorder_id"] == "nvr-2" and "SN-" not in audit[0]["details_json"]
    # re-enabling it accepts the new camera; the next discovery leaves it enabled
    cid = rows(base, "SELECT id FROM cameras WHERE recorder_id = 'nvr-2' AND channel = 1")[0]["id"]
    assert c.patch(f"/api/v1/cameras/{cid}", json={"enabled": True}).status_code == 200
    autosync.run_once(app.state.db, app.state.settings, reason="periodic")
    assert rows(base, "SELECT enabled FROM cameras WHERE id = ?", (cid,))[0]["enabled"] == 1


# ---------------------------------------------------------------- remove keeps history, ids never reused

def test_removing_a_recorder_keeps_its_history_hides_its_cameras_and_never_reuses_its_id(base, fakes):
    one, two = fakes
    app, c = two_recorders(base, fakes)
    cam2 = rows(base, "SELECT id FROM cameras WHERE recorder_id = 'nvr-2' ORDER BY channel")[0]["id"]
    with Database(base.db_path).connection() as conn:  # history of that camera: an event and a placement on a map are kept
        conn.execute("INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, received_at, state, count, severity, confidence, dedup_key, created_at, recorder_id) "
                     "VALUES ('ev-old', 'alertstream', 'VMD', 'motion', ?, 1, ?, ?, 'inactive', 1, 'info', 'measured', 'k-old', ?, 'nvr-2')", (cam2, now_iso(), now_iso(), now_iso()))
    rev = c.get("/api/v1/recorders/nvr-2/connection").json()["revision"]
    assert c.request("DELETE", "/api/v1/recorders/nvr-2", json={"confirm_text": "remove", "if_revision": rev}).json()["code"] == "confirm_required"
    r = c.request("DELETE", "/api/v1/recorders/nvr-2", json={"confirm_text": "הסר", "if_revision": rev})
    assert r.status_code == 200 and r.json()["cameras_disabled"] == 4 and r.json()["restart_required"] is True
    assert len(rows(base, "SELECT id FROM cameras WHERE recorder_id = 'nvr-2' AND enabled = 0")) == 4, "the rows stay, disabled"
    assert rows(base, "SELECT id FROM events WHERE id = 'ev-old'"), "history kept"
    (conn_row,) = rows(base, "SELECT vendor, host, password_enc FROM recorder_connections WHERE recorder_id = 'nvr-2'")
    assert conn_row == {"vendor": "none", "host": None, "password_enc": None}
    assert {x["recorder_id"] for x in c.get("/api/v1/cameras").json()["cameras"]} == {"nvr-1"}, "its cameras are invisible"
    assert [x["id"] for x in c.get("/api/v1/recorders").json()["recorders"]] == ["nvr-1"]
    assert [x["id"] for x in c.get("/api/v1/recorders", params={"include_removed": True}).json()["recorders"] if x["removed"]] == ["nvr-2"]
    assert c.get("/api/v1/recorders/nvr-2/connection").status_code == 404
    assert c.get("/api/v1/events", params={"recorder_id": "nvr-2", "from": "2000-01-01T00:00:00Z", "to": "2100-01-01T00:00:00Z"}).json()["events"][0]["id"] == "ev-old"
    # after the restart the removed recorder is not run, and its own streams leave go2rtc (by exact name; foreign untouched)
    app2 = create_app(base)
    assert recorder_scope.child_ids(app2.state.settings) == []
    one.writes.clear()
    with Database(base.db_path).connection() as conn:
        res = autosync.ensure_streams(app2.state.settings, conn)
    assert res["removed"] == 8 and not [n for n in one.go2rtc["streams"] if n.startswith("smplwise_nvr-2_")]
    assert one.go2rtc["foreign"] == ["intercom_door_1", "intercom_door_2"]
    assert not [w for w in one.writes if not w.split(" ", 2)[2].startswith("smplwise_")], one.writes
    # the next recorder gets a new id
    c2 = client(app2)
    r = c2.post("/api/v1/recorders", json={**ADD, "name": "NVR חדש"})
    assert r.status_code == 201 and r.json()["recorder_id"] == "nvr-3"
    assert [a["action"] for a in rows(base, "SELECT action FROM audit_log WHERE action LIKE 'nvr.recorder.%' ORDER BY id")] == [
        "nvr.recorder.add", "nvr.recorder.remove", "nvr.recorder.add"]


def test_duplicate_destination_rename_disable_and_time_zone(base, fakes):
    app, c = two_recorders(base, fakes)
    r = c.post("/api/v1/recorders", json={**ADD, "host": NVR_HOST, "name": "שוב"})
    assert r.status_code == 409 and r.json()["code"] == "recorder_duplicate", "the first recorder's device cannot be added twice"
    r = c.post("/api/v1/recorders", json={**ADD, "name": "שוב"})
    assert r.status_code == 409 and r.json()["code"] == "recorder_duplicate"
    assert c.patch("/api/v1/recorders/nvr-2", json={"time_zone": "Mars/Base"}).json()["code"] == "time_zone_invalid"
    r = c.patch("/api/v1/recorders/nvr-2", json={"name": "מחסן צפון", "time_zone": "Europe/London", "sort_order": 5})
    assert r.status_code == 200 and r.json()["recorder"]["name"] == "מחסן צפון" and r.json()["recorder"]["time_zone"] == "Europe/London"
    assert r.json()["restart_required"] is False
    r = c.patch("/api/v1/recorders/nvr-2", json={"enabled": False})
    assert r.json()["restart_required"] is True and r.json()["recorder"]["status"]["state"] == "disabled"
    app2 = create_app(base)  # restart: the disabled recorder is not run, its cameras stay listed, its device is not reached
    assert recorder_scope.child_ids(app2.state.settings) == []
    c2 = client(app2)
    cam2 = next(x for x in c2.get("/api/v1/cameras").json()["cameras"] if x["recorder_id"] == "nvr-2")
    r = c2.get(f"/api/v1/cameras/{cam2['id']}/snapshot.jpg")
    assert r.status_code in (200, 409)  # a cached copy may be served; never a call to the disabled device
    if r.status_code == 409:
        assert r.json()["code"] == "recorder_unavailable"
    assert installation_mode(app2.state.settings) == FULL
    assert c2.patch("/api/v1/recorders/nvr-2", json={"enabled": True}).json()["restart_required"] is True


# ---------------------------------------------------------------- events from two alert streams

def test_alert_events_of_two_recorders_never_merge(base, fakes):
    app, c = two_recorders(base, fakes)
    alert = events_ingest.parse_alert(
        '<EventNotificationAlert><channelID>9</channelID><dateTime>2026-10-04T10:00:00+03:00</dateTime><eventType>videoloss</eventType>'
        '<eventState>active</eventState><eventDescription>videoloss alarm</eventDescription></EventNotificationAlert>')
    assert alert is not None
    with Database(base.db_path).connection() as conn:
        lookup = lambda ch: None  # noqa: E731 - a device-level event: no camera on channel 9
        a = events_ingest.store_alert(conn, alert, "Asia/Jerusalem", lookup, recorder_id="nvr-1")
        b = events_ingest.store_alert(conn, alert, "Asia/Jerusalem", lookup, recorder_id="nvr-2")
    assert a and b and a["id"] != b["id"] and a["recorder_id"] == "nvr-1" and b["recorder_id"] == "nvr-2"
    window = {"from": "2026-10-04T00:00:00Z", "to": "2026-10-05T00:00:00Z"}
    assert [e["id"] for e in c.get("/api/v1/events", params={**window, "recorder_id": "nvr-2"}).json()["events"]] == [b["id"]]
    assert {e["id"] for e in c.get("/api/v1/events", params=window).json()["events"]} >= {a["id"], b["id"]}
    # each further recorder has its own listener, state and queue
    lst = events_ingest.AlertStreamListener("nvr-2", events_ingest.IngestState(), events_ingest.IngestQueue())
    assert lst.state is not events_ingest.STATE and lst.queue is not events_ingest.QUEUE


# ---------------------------------------------------------------- batches never mix recorders, sync groups refused

def test_a_stream_batch_never_mixes_recorders_and_a_sync_group_never_spans_them(base, fakes):
    app, c = two_recorders(base, fakes)
    cams = c.get("/api/v1/cameras").json()["cameras"]
    a = next(x for x in cams if x["recorder_id"] == "nvr-1")
    b = next(x for x in cams if x["recorder_id"] == "nvr-2")
    body = {"confirm": True, "changes": {"svc": False}, "targets": [{"camera_id": a["id"], "stream_ref": "101", "if_match": "0" * 16},
                                                                     {"camera_id": b["id"], "stream_ref": "201", "if_match": "0" * 16}]}
    r = c.post("/api/v1/nvr/stream-batches", json=body)
    assert r.status_code == 422 and r.json()["details"].get("field") == "targets", r.text
    b2 = next(x for x in cams if x["recorder_id"] == "nvr-2" and x["id"] != b["id"])
    r = c.post("/api/v1/nvr/stream-batches", json={**body, "recorder_id": "nvr-1", "targets": [
        body["targets"][1], {"camera_id": b2["id"], "stream_ref": "999", "if_match": "0" * 16}]})
    assert r.status_code == 422 and r.json()["details"].get("field") == "recorder_id"
    r = c.post("/api/v1/playback/groups", json={"camera_ids": [a["id"], b["id"]], "start_at": "2026-10-04T08:00:00Z"})
    assert r.status_code == 409 and r.json()["code"] == "sync_cross_recorder_unproven"
    # the batch device lock is the recorder's own device
    with Database(base.db_path).connection(mode="read") as conn:
        k1 = registry.adapter_for(conn, app.state.settings, "nvr-1").device_key
        k2 = registry.adapter_for(conn, app.state.settings, "nvr-2").device_key
    assert k1 == "addon-nvr" and k2.startswith("nvr-") and k1 != k2 and NVR2_HOST not in k2


# ---------------------------------------------------------------- permissions, remote channel, secrets

def test_permissions_audit_and_the_remote_channel(base, fakes, settings):
    app, c = two_recorders(base, fakes)
    for name, role in (("vera", "viewer"), ("olga", "operator")):
        bind(c, base, name, role, "installation", "*")
    for user in ("vera", "olga", "nobody"):
        u = TestClient(app)
        u.headers.update(as_user(user))
        assert u.get("/api/v1/recorders").status_code == 403
        assert u.post("/api/v1/recorders", json=ADD).status_code == 403
        assert u.get("/api/v1/recorders/nvr-404/health").status_code == 403, "403 before 404"
        assert u.request("DELETE", "/api/v1/recorders/nvr-2", json={"confirm_text": "הסר", "if_revision": 1}).status_code == 403
        assert u.patch("/api/v1/recorders/nvr-2", content=b"{not json", headers={"content-type": "application/json"}).status_code == 403
    denied = rows(base, "SELECT action, decision FROM audit_log WHERE decision = 'denied' AND actor_username IN ('vera', 'olga')")
    assert denied, "refusals are audited"
    from smplwise import remote_channel

    assert "/api/v1/recorders" in remote_channel.BLOCKED_ON_REMOTE
    body = json.dumps([c.get("/api/v1/recorders").json(), c.get("/api/v1/recorders/nvr-2").json(), c.get("/api/v1/health").json(),
                       c.get("/api/v1/me").json(), c.get("/api/v1/cameras").json()], ensure_ascii=False)
    assert PW1 not in body and PW2 not in body and "v1:" not in body
    audit = json.dumps(rows(base, "SELECT details_json FROM audit_log"), ensure_ascii=False)
    assert PW2 not in audit


def test_a_scope_on_one_recorders_cameras_shows_nothing_of_the_other(base, fakes):
    app, c = two_recorders(base, fakes)
    cam1 = rows(base, "SELECT id FROM cameras WHERE recorder_id = 'nvr-1' ORDER BY channel")[0]["id"]
    cam2 = rows(base, "SELECT id FROM cameras WHERE recorder_id = 'nvr-2' ORDER BY channel")[0]["id"]
    bind(c, base, "guard", "viewer", "camera", cam1)
    g = TestClient(app)
    g.headers.update(as_user("guard"))
    assert g.get(f"/api/v1/cameras/{cam1}/snapshot.jpg").status_code == 200
    assert g.get(f"/api/v1/cameras/{cam2}/snapshot.jpg").status_code == 403


# ---------------------------------------------------------------- the first recorder removed, another stays

def test_the_installation_stays_full_when_only_a_further_recorder_is_left(base, fakes):
    app, c = two_recorders(base, fakes)
    rev = c.get("/api/v1/recorders/nvr-1/connection").json().get("revision") or 0
    r = c.request("DELETE", "/api/v1/recorders/nvr-1", json={"confirm_text": "הסר", "if_revision": rev})
    assert r.status_code == 200, r.text
    app2 = create_app(base)
    eff = app2.state.settings
    assert eff.nvr_host is None and recorder_scope.child_ids(eff) == ["nvr-2"]
    assert installation_mode(eff) == FULL
    c2 = client(app2)
    assert {x["recorder_id"] for x in c2.get("/api/v1/cameras").json()["cameras"]} == {"nvr-2"}
    caps = c2.get("/api/v1/health").json()["capabilities"]
    assert caps["nvr"] is True and [x["id"] for x in caps["recorders"]] == ["nvr-2"]
    # adding an NVR again fills the first recorder (the installation's process-wide connection); its cameras stay disabled for review
    r = c2.post("/api/v1/recorders", json={**ADD, "host": NVR_HOST, "password": PW1, "name": "ראשי"})
    assert r.status_code == 201 and r.json()["recorder_id"] == "nvr-1"
    assert not rows(base, "SELECT 1 FROM cameras WHERE recorder_id = 'nvr-1' AND enabled = 1")


# ---------------------------------------------------------------- the adapter registration seam (a fake second vendor)

class FakeVendorAdapter:
    vendor = "provision_isr"

    def __init__(self, recorder_id, settings):
        self.recorder_id = recorder_id
        self._settings = settings

    @property
    def device_key(self):
        return f"fake-{self.recorder_id}"

    def capabilities(self):
        from smplwise.services.recorders.base import RecorderCapabilities

        return RecorderCapabilities(vendor=self.vendor, read_encodings=False, write_encodings=False, encoding_fields=frozenset(), add_channel=False,
                                    remove_channel=False, max_channels=None, live="rtsp", playback="none", events="poll")


def test_a_further_vendor_registers_through_the_seam(base, fakes):
    assert registry.selectable("provision_isr") is False, "Provision-ISR stays 'coming soon' until its adapter exists"
    spec = registry.VendorSpec("provision_isr", "Provision-ISR", "available", {"http_port": 80, "rtsp_port": 554}, registry._NETWORK_FIELDS)
    undo = registry.register_vendor(spec, FakeVendorAdapter)
    try:
        assert registry.selectable("provision_isr") is True
        assert {v["id"]: v["status"] for v in registry.catalogue()}["provision_isr"] == "available"
        app = create_app(base)
        from smplwise.services import connection_store

        with Database(base.db_path).connection() as conn:
            conn.execute("INSERT INTO recorders(id, name, created_at, vendor) VALUES ('nvr-2', 'פרוויז׳ן', ?, 'provision_isr')", (now_iso(),))
            connection_store.write_row(conn, base, vendor="provision_isr", host=NVR2_HOST, http_port=80, rtsp_port=554, username="viewer", password=PW2,
                                       extra=None, source="ui", actor_id=None, recorder_id="nvr-2")
        app = create_app(base)
        with Database(base.db_path).connection(mode="read") as conn:
            adapter = registry.adapter_for(conn, app.state.settings, "nvr-2")
            first = registry.adapter_for(conn, app.state.settings, "nvr-1")
        assert isinstance(adapter, FakeVendorAdapter) and adapter._settings.nvr_host == NVR2_HOST
        assert type(first).__name__ == "HikvisionAdapter"
        caps = {r["id"]: r for r in client(app).get("/api/v1/health").json()["capabilities"]["recorders"]}
        assert caps["nvr-2"]["vendor"] == "provision_isr" and caps["nvr-2"]["playback"] is False and caps["nvr-1"]["playback"] is True
    finally:
        undo()
    assert registry.selectable("provision_isr") is False and "provision_isr" not in registry.VENDORS


def test_settings_for_an_unknown_recorder_never_reaches_a_device(base):
    s = recorder_scope.settings_for(base, "nvr-7")
    assert s.nvr_host is None and s.nvr_recorder_id == "nvr-7"
    from smplwise.errors import ApiError
    from smplwise.services import nvr

    with pytest.raises(ApiError) as exc:
        nvr.device_info(s)
    assert exc.value.code == "recorder_unavailable"
    with pytest.raises(ApiError) as exc:
        g2.hikvision_rtsp_url(s, 1, "sub")
    assert exc.value.code == "recorder_unavailable"
    assert recorder_scope.next_id(["nvr-1", "nvr-2", "nvr-9", "x"]) == "nvr-10"
    assert recorder_scope.next_id([]) == "nvr-2"
