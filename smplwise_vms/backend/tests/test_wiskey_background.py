"""WisKey background (read) channel, B0 (decision D-006): the closed projection, and that no person field of WisKey's
`overview` (`station.last_access`: person name, employee number, event identity; the people list; every count) ever reaches
the cache, `GET /intercom/overview`, the change notices or a log line - including after a disconnect and a reconnect.

Reply shapes follow tests/test_intercom.py (the scripted Home Assistant WebSocket); WisKey's `overview` is still sent with
`last_access` and the whole directory, which is exactly why the guarantee is built on Arx's side."""
from __future__ import annotations

import copy
import json
import logging
import re
from typing import Any

import pytest
from fastapi.testclient import TestClient
from test_intercom import CLOSE, OFFLINE, OVERVIEW, STATION, FakeHa, feed, normal, ok, wait_for  # noqa: F401 - `feed` is a fixture

from smplwise.services import intercom_sync, wiskey_background as bg

PERSON_MARKERS = ("Dana", "1001", "+972500000000", "****1234", "person_name", "employee_no", "last_access", "access_granted")

# the D-006 proposed minimal background result, written out independently of WisKey's draft file (shape only)
D006_TOP = {"schema_version", "generated_at", "permission_revision", "stations"}
D006_STATION = {"id", "name", "online", "last_seen"}
UTC_Z = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def conforms_to_d006(doc: dict[str, Any]) -> None:
    assert set(doc) == D006_TOP and doc["schema_version"] == 1
    assert UTC_Z.match(doc["generated_at"])
    assert doc["permission_revision"] is None or (isinstance(doc["permission_revision"], int) and doc["permission_revision"] >= 0)
    for station in doc["stations"]:
        assert set(station) == D006_STATION
        assert isinstance(station["id"], str) and station["id"] and isinstance(station["name"], str)
        assert station["online"] is None or isinstance(station["online"], bool)
        assert station["last_seen"] is None or UTC_Z.match(station["last_seen"])


def stamped(doc: Any) -> str:
    return json.dumps(doc, ensure_ascii=False)


# ---------------------------------------------------------------- the projection

def test_the_closed_projection_is_built_from_four_station_fields():
    projection = bg.project_background(OVERVIEW, generated_at="2026-10-01T09:00:00Z")
    bg.assert_closed(projection)
    conforms_to_d006(projection)
    assert projection == {
        "schema_version": 1,
        "generated_at": "2026-10-01T09:00:00Z",
        "permission_revision": 3,
        "stations": [
            {"id": "entry-a", "name": "Main gate", "online": True, "last_seen": "2026-09-27T08:00:00Z"},
            {"id": "entry-b", "name": "Side door", "online": False, "last_seen": "2026-09-27T08:00:00Z"},
        ],
    }
    text = stamped(projection)
    assert not any(marker in text for marker in PERSON_MARKERS) and "192.0.2.10" not in text and "DS-KV6113" not in text


def test_unknown_is_unknown_not_a_guess():
    raw = {"access": {"revision": True}, "stations": [
        {"id": "a", "name": None, "online": "yes", "last_seen": "2026-09-27T08:00:00"},  # naive instant, non-boolean flag
        {"id": "b", "name": "  Gate  ", "last_seen": "2026-09-27T11:00:00+03:00"},
        {"id": "", "name": "no id"}, {"name": "no id either"}, "not a station", None,
    ]}
    projection = bg.project_background(raw)
    conforms_to_d006(projection)
    assert projection["permission_revision"] is None, "a boolean is not a revision"
    assert projection["stations"] == [
        {"id": "a", "name": "", "online": None, "last_seen": None},
        {"id": "b", "name": "Gate", "online": None, "last_seen": "2026-09-27T08:00:00Z"},
    ]


def test_every_forbidden_field_is_dropped_wherever_it_hides():
    """Each person / event / count field of WisKey's overview, planted on the reply, the stations and under `access`, with a
    marker value: none of the three projections (closed, service copy, closed-from-copy) keeps a marker."""
    planted = {name: f"SECRET-{name}" for name in bg.PERSON_FIELD_NAMES}
    raw = copy.deepcopy(OVERVIEW)
    raw.update(planted)
    raw["access"].update(planted)
    for station in raw["stations"]:
        station.update(planted)
        station["last_access"] = {**planted, "person_name": "SECRET-person_name"}
    for projection in (bg.project_background(raw), intercom_sync.project_overview(raw), bg.from_served_copy(intercom_sync.project_overview(raw))):
        assert "SECRET" not in stamped(projection)
        assert bg.find_person_fields(projection) == []


def test_closed_projection_check_refuses_anything_else():
    good = bg.project_background(OVERVIEW)
    bg.assert_closed(good)
    for label, mutate in {
        "extra top key": lambda d: d.update(user_count=1),
        "missing key": lambda d: d.pop("generated_at"),
        "extra station key": lambda d: d["stations"][0].update(call_state="ringing"),
        "person key": lambda d: d["stations"][0].update(person_name="x"),
        "last_access": lambda d: d["stations"][0].update(last_access=None),
        "station order": lambda d: d["stations"].__setitem__(0, dict(reversed(list(d["stations"][0].items())))),
        "online string": lambda d: d["stations"][0].update(online="true"),
        "last_seen not utc": lambda d: d["stations"][0].update(last_seen="2026-09-27T08:00:00+03:00"),
        "bad revision": lambda d: d.update(permission_revision=-1),
        "stations not a list": lambda d: d.update(stations={}),
    }.items():
        broken = copy.deepcopy(good)
        mutate(broken)
        with pytest.raises(ValueError):
            bg.assert_closed(broken)
        assert label


def test_the_closed_projection_from_the_service_copy_has_the_same_shape():
    copy_ = intercom_sync.project_overview(OVERVIEW)
    derived = bg.from_served_copy(copy_)
    bg.assert_closed(derived)
    conforms_to_d006(derived)
    assert [s["id"] for s in derived["stations"]] == ["entry-a", "entry-b"] and derived["permission_revision"] is None
    assert bg.from_served_copy(None) is None


def test_the_service_projection_keeps_the_operational_fields_and_no_person_field():
    projected = intercom_sync.project_overview(OVERVIEW)
    assert set(projected) == {"version", "api_version", "default_zone", "stations"}
    gate = projected["stations"][0]
    assert gate["call_state"] == "idle" and gate["locks"] == [{"physical_index": 1, "name": "Gate"}] and gate["camera_entity"] == "camera.main_gate"
    assert {"id", "name", "online", "call_state"} <= set(gate), "the doorbell source (CR-018) reads id, name, online and call_state"
    assert bg.find_person_fields(projected) == []
    assert not {"last_access", "pending_user_count", "managed_user_count"} & set(gate)


# ---------------------------------------------------------------- the feed: cache, API, notices and log

def deep_scan(body: Any) -> None:
    text = stamped(body)
    assert not any(marker in text for marker in PERSON_MARKERS), [m for m in PERSON_MARKERS if m in text]
    assert bg.find_person_fields(body) == []


def test_nothing_personal_is_cached_served_pushed_or_logged_across_a_reconnect(feed, caplog):
    """Disconnect, then a reconnect whose overview names a different person: at every stage the cache, the served reply
    and the notices are free of every person field, and the copy kept while disconnected is the closed one, not a
    snapshot of the earlier last access."""
    app, s, install = feed
    caplog.set_level(logging.DEBUG, logger="smplwise.intercom")
    fakes: list[FakeHa] = []
    eve = copy.deepcopy(OVERVIEW)
    eve["stations"][0]["last_access"] = {**eve["stations"][0]["last_access"], "person_name": "Eve", "employee_no": "2002"}
    eve["users"][0]["display_name"] = "Eve"

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        first = fake is fakes[0]
        if msg["type"] == "hikvision_intercom/overview":
            return [ok(msg, copy.deepcopy(OVERVIEW if first else eve))]
        frames = normal(msg, fake)
        return frames + [CLOSE] if first and msg["type"] == "hikvision_intercom/subscribe" else frames

    q = intercom_sync.subscribe()
    try:
        fakes = install(script, refuse_after=2)
        intercom_sync.SYNC.start(s)
        client = TestClient(app)
        wait_for(lambda: intercom_sync.STATE.reconnects >= 1 and intercom_sync.STATE.state in ("ha_unavailable", "ready"))
        # while disconnected (the second connection is the last one HA accepts) and after it: always the closed copy
        wait_for(lambda: len(fakes) >= 2 and intercom_sync.STATE.state == "ready")
        body = client.get("/api/v1/intercom/overview").json()
        assert body["state"] == "ready" and [st["name"] for st in body["overview"]["stations"]] == ["Main gate", "Side door"]
        deep_scan(body)
        with intercom_sync.SYNC._cache_lock:
            cached = copy.deepcopy(intercom_sync.SYNC._cache)
        deep_scan(cached)
        assert "Eve" not in stamped(body) and "2002" not in stamped(body)
        notices = []
        while not q.empty():
            notices.append(q.get_nowait())
        assert notices and all(set(n) <= {"type", "sequence", "state"} for n in notices), notices
        assert all("Dana" not in stamped(n) and "Eve" not in stamped(n) for n in notices)
    finally:
        intercom_sync.unsubscribe(q)
    intercom_sync.SYNC.shutdown()
    logged = "\n".join(r.getMessage() for r in caplog.records if r.name == "smplwise.intercom")
    assert "WisKey feed connected" in logged, "the connection line is still written"
    for marker in (*PERSON_MARKERS, "Eve", "2002"):
        assert marker not in logged, f"{marker} in the log"
    assert re.search(r"WisKey feed connected: 2 stations, WisKey 4\.2\.0", logged), "only the station count and the WisKey version"


def test_a_stale_copy_after_a_refused_reconnect_is_closed_too(feed):
    app, s, install = feed

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        frames = normal(msg, fake)
        return frames + [CLOSE] if msg["type"] == "hikvision_intercom/subscribe" else frames

    install(script, refuse_after=1)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: install.refused["n"] >= 2 and intercom_sync.STATE.state == "ha_unavailable")
    body = TestClient(app).get("/api/v1/intercom/overview").json()
    assert body["fresh"] is False and len(body["overview"]["stations"]) == 2
    deep_scan(body)


def test_the_activity_log_projection_still_carries_the_event_fields():
    """D-004 / B1: `events/list` stays a one-off read (service identity today, the operator's own from B1); the overview is
    the only thing that lost the names."""
    event = {"id": "e1", "station_id": "entry-a", "timestamp": "2026-09-27T07:59:00+03:00", "received_at": "2026-09-27T05:00:00Z", "time_source": "device",
             "person_name": "Dana", "employee_no": "1001", "authentication": "card", "result": "granted", "event_type": "access_granted", "recovered": False, "door": 1}
    page = intercom_sync.project_event_page({"records": [event], "next": None})
    assert page["records"][0]["person_name"] == "Dana" and page["records"][0]["employee_no"] == "1001"
