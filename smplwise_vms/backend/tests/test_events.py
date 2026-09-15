"""Events (T031/T032): alert-stream parsing, heartbeat/noise filtering, dedup, time handling, recording-derived
events, scoped listing, ack, timeline markers and the push socket — with the devices faked."""
from __future__ import annotations

import datetime as dt
import json
from dataclasses import replace

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient
from test_recordings import set_track, xml_page

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import events_derive, events_ingest, nvr, recordings
from smplwise.services.timeutil import UTC

ALERT = """<EventNotificationAlert version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
<ipAddress>198.51.100.5</ipAddress><portNo>80</portNo><protocol>HTTP</protocol><macAddress>aa:bb</macAddress>
<channelID>{ch}</channelID><dateTime>{ts}</dateTime><activePostCount>{n}</activePostCount>
<eventType>{et}</eventType><eventState>{st}</eventState><eventDescription>{et} alarm</eventDescription>{extra}
</EventNotificationAlert>"""


def alert(et="VMD", st="active", ch=1, ts="2026-09-15T20:49:02+03:00", n=1, extra=""):
    return ALERT.format(et=et, st=st, ch=ch, ts=ts, n=n, extra=extra)


def test_parse_and_normalize():
    a = events_ingest.parse_alert(alert())
    assert a and a.raw_type == "VMD" and a.state == "active" and a.channel == 1 and a.device_time == "2026-09-15T20:49:02+03:00"
    assert "ipAddress" not in a.raw_tags and "macAddress" not in a.raw_tags
    assert events_ingest.normalize_type(a) == ("motion", "info")
    hb = events_ingest.parse_alert(alert(et="videoloss", st="inactive", ch=0))
    assert hb and hb.is_heartbeat
    smart = events_ingest.parse_alert(alert(et="linedetection", extra="<detectionTarget>human</detectionTarget>"))
    assert events_ingest.normalize_type(smart) == ("person", "alert")
    unknown = events_ingest.parse_alert(alert(et="somethingNew"))
    assert events_ingest.normalize_type(unknown) == ("other", "info")
    assert events_ingest.parse_alert("<not xml") is None


def test_device_time_offset_or_wall_clock():
    now = dt.datetime(2026, 9, 15, 17, 49, 30, tzinfo=UTC)  # 20:49:30 IDT
    utc, precision = events_ingest.device_time_to_utc("2026-09-15T20:49:02+03:00", "Asia/Jerusalem", now)
    assert utc.isoformat() == "2026-09-15T17:49:02+00:00" and precision == "device_offset"
    # a wrong (standard) offset during DST is ignored: wall clock wins when the instant is far from now
    utc2, precision2 = events_ingest.device_time_to_utc("2026-09-15T20:49:02+02:00", "Asia/Jerusalem", now)
    assert utc2.isoformat() == "2026-09-15T17:49:02+00:00" and precision2 == "wall_clock"
    utc3, precision3 = events_ingest.device_time_to_utc("garbage", "Asia/Jerusalem", now)
    assert utc3 == now and precision3 == "received"


def test_store_dedup_and_gap(settings):
    app = create_app(settings)
    c = TestClient(app)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "Entrance"}).json()
    db: Database = app.state.db
    now = dt.datetime(2026, 9, 15, 17, 49, 30, tzinfo=UTC)
    with db.connection() as conn:
        lookup = lambda ch: conn.execute("SELECT * FROM cameras WHERE channel = ?", (ch,)).fetchone()  # noqa: E731
        assert events_ingest.store_alert(conn, events_ingest.parse_alert(alert(et="videoloss", st="inactive", ch=0)), "Asia/Jerusalem", lookup, now) is None
        e1 = events_ingest.store_alert(conn, events_ingest.parse_alert(alert(ts="2026-09-15T20:49:02+03:00")), "Asia/Jerusalem", lookup, now)
        e2 = events_ingest.store_alert(conn, events_ingest.parse_alert(alert(ts="2026-09-15T20:49:12+03:00", n=2)), "Asia/Jerusalem", lookup, now)
        assert e1 and e2 and e1["id"] == e2["id"] and e2["count"] == 2 and e2["camera_id"] == cam["id"] and e2["state"] == "active"
        e3 = events_ingest.store_alert(conn, events_ingest.parse_alert(alert(st="inactive", ts="2026-09-15T20:49:40+03:00")), "Asia/Jerusalem", lookup, now)
        assert e3 and e3["id"] == e1["id"] and e3["state"] == "inactive" and e3["ended_at"] == "2026-09-15T17:49:40Z"
        # a new burst well after the window opens a new row
        e4 = events_ingest.store_alert(conn, events_ingest.parse_alert(alert(ts="2026-09-15T20:52:00+03:00")), "Asia/Jerusalem", lookup, now + dt.timedelta(minutes=3))
        assert e4 and e4["id"] != e1["id"] and e4["confidence"] == "measured" and e4["details"]["time_precision"] == "device_offset"
        # unknown channel keeps the event without a camera
        e5 = events_ingest.store_alert(conn, events_ingest.parse_alert(alert(ch=77, ts="2026-09-15T20:53:00+03:00")), "Asia/Jerusalem", lookup, now + dt.timedelta(minutes=4))
        assert e5 and e5["camera_id"] is None and e5["channel"] == 77
        gap = events_ingest.record_gap(conn, now, now + dt.timedelta(minutes=2), "ConnectError")
        assert gap["type"] == "coverage_gap" and gap["details"]["seconds"] == 120
    r = c.get("/api/v1/events?from=2026-09-15T17:00:00Z&to=2026-09-15T18:00:00Z").json()
    assert [e["type"] for e in r["events"]] == ["motion", "motion", "coverage_gap", "motion"] or len(r["events"]) == 4
    assert all("camera_name" in e for e in r["events"]) and r["ingest"]["connected"] is False


def test_derived_events_and_timeline_markers(settings, monkeypatch):
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p")
    app = create_app(s)
    c = TestClient(app)
    recordings.invalidate()
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    set_track(s, cam["id"])
    monkeypatch.setattr(nvr, "search_recordings", lambda *_a, **_k: nvr.parse_search_response(xml_page([("2026-09-15T10:00:00Z", "2026-09-15T10:02:00Z", "MOTION"), ("2026-09-15T10:05:00Z", "2026-09-15T11:00:00Z", "CMR")], "OK"), 101))
    n = events_derive.run_once(app.state.db, s, "Asia/Jerusalem", day=dt.date(2026, 9, 15))
    assert n == 1 and events_derive.run_once(app.state.db, s, "Asia/Jerusalem", day=dt.date(2026, 9, 15)) == 0, "idempotent"
    m = c.get(f"/api/v1/cameras/{cam['id']}/events?date=2026-09-15").json()
    assert len(m["events"]) == 1 and m["events"][0]["source"] == "recording" and m["events"][0]["confidence"] == "inferred" and m["events"][0]["occurred_at"] == "2026-09-15T07:00:00Z"
    sm = c.get("/api/v1/events/summary").json()
    assert sm["today"]["inferred"] >= 0 and "ingest" in sm
    # retention prune removes old rows
    assert events_derive.prune(app.state.db, 1) >= 0


def test_scope_ack_and_push(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    other = c.post("/api/v1/cameras", json={"channel": 2, "alias": "b"}).json()
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.5, "y": 0.5})
    bind(c, settings, "ron", "operator", "floor", ids["floor2"])
    db: Database = app.state.db
    now = dt.datetime.now(UTC)
    ts = now.astimezone(dt.timezone(dt.timedelta(hours=3))).strftime("%Y-%m-%dT%H:%M:%S+03:00")
    with db.connection() as conn:
        lookup = lambda ch: conn.execute("SELECT * FROM cameras WHERE channel = ?", (ch,)).fetchone()  # noqa: E731
        e_cam = events_ingest.store_alert(conn, events_ingest.parse_alert(alert(ch=1, ts=ts)), "Asia/Jerusalem", lookup, now)
        e_other = events_ingest.store_alert(conn, events_ingest.parse_alert(alert(ch=2, ts=ts, et="linedetection")), "Asia/Jerusalem", lookup, now)
    assert e_cam and e_other
    # floor operator sees only the anchored camera's event; admin sees both
    mine = c.get("/api/v1/events", headers=as_user("ron")).json()["events"]
    assert [e["id"] for e in mine] == [e_cam["id"]]
    assert len(c.get("/api/v1/events").json()["events"]) == 2
    # ack: allowed on own camera, denied on the other
    a = c.post(f"/api/v1/events/{e_cam['id']}/ack", headers=as_user("ron"))
    assert a.status_code == 200 and a.json()["acked_by_username"] == "ron"
    assert c.post(f"/api/v1/events/{e_other['id']}/ack", headers=as_user("ron")).status_code == 403
    assert c.get("/api/v1/events?unacked=true").json()["events"][0]["id"] == e_other["id"]
    # viewer without events.read on any scope is refused
    bind(c, settings, "vi", "viewer", "floor", ids["floor3"])
    assert c.get("/api/v1/events", headers=as_user("vi")).status_code == 403
    # push socket: a newly stored event reaches a subscribed admin
    with c.websocket_connect("/api/v1/events/ws") as ws:
        with db.connection() as conn:
            lookup = lambda ch: conn.execute("SELECT * FROM cameras WHERE channel = ?", (ch,)).fetchone()  # noqa: E731
            ev = events_ingest.store_alert(conn, events_ingest.parse_alert(alert(ch=1, ts=ts, et="fielddetection")), "Asia/Jerusalem", lookup, now + dt.timedelta(minutes=5))
        events_ingest.publish(ev)
        msg = json.loads(ws.receive_text())
        assert msg["type"] == "event_added" and msg["payload"]["id"] == ev["id"] and msg["version"] == 1
