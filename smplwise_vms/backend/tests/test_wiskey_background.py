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
from test_intercom import CLOSE, OVERVIEW, FakeHa, fail, feed, normal, ok, wait_for  # noqa: F401 - `feed` is a fixture

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


def test_a_change_in_what_is_no_longer_projected_is_still_one_notice(feed):
    """The activity log and the people screens refetch on `intercom_refresh`, which the feed sends only when the entry
    center changed. A new access record (last_access) or a people edit (counts) no longer changes the projection, so the
    change is noticed through an opaque digest of the dropped fields: one notice per real change, none for an identical
    refetch, and the notice and the served reply never carry the fields themselves."""
    app, s, install = feed
    current = {"ov": copy.deepcopy(OVERVIEW)}

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/overview":
            return [ok(msg, copy.deepcopy(current["ov"]))]
        return normal(msg, fake)

    fakes = install(script)
    q = intercom_sync.subscribe()
    try:
        intercom_sync.SYNC.start(s)
        wait_for(lambda: intercom_sync.STATE.state == "ready" and intercom_sync.SYNC._wiskey_sub is not None)
        base = intercom_sync.STATE.sequence

        def push_refresh() -> None:
            fake = fakes[0]
            assert fake.q is not None and intercom_sync.SYNC._event_loop is not None
            intercom_sync.SYNC._event_loop.call_soon_threadsafe(fake.q.put_nowait, {"id": intercom_sync.SYNC._wiskey_sub, "type": "event", "event": {"kind": "refresh"}})

        refreshes = intercom_sync.STATE.refreshes
        push_refresh()  # nothing changed: refetched, no notice
        wait_for(lambda: intercom_sync.STATE.refreshes > refreshes)
        assert intercom_sync.STATE.sequence == base

        eve = copy.deepcopy(OVERVIEW)
        eve["stations"][0]["last_access"] = {**eve["stations"][0]["last_access"], "person_name": "Eve", "employee_no": "2002", "timestamp": "2026-09-27T09:00:00+03:00"}
        current["ov"] = eve
        refreshes = intercom_sync.STATE.refreshes
        push_refresh()
        wait_for(lambda: intercom_sync.STATE.sequence == base + 1)
        counts = copy.deepcopy(eve)
        counts["stations"][1]["pending_user_count"] = 5
        current["ov"] = counts
        push_refresh()
        wait_for(lambda: intercom_sync.STATE.sequence == base + 2)
        again = intercom_sync.STATE.refreshes
        push_refresh()  # identical: refetched, no notice
        wait_for(lambda: intercom_sync.STATE.refreshes > again)
        assert intercom_sync.STATE.sequence == base + 2
        notices = []
        while not q.empty():
            notices.append(q.get_nowait())
        refreshed = [n for n in notices if n["type"] == "intercom_refresh"]
        assert [n["sequence"] for n in refreshed][-2:] == [base + 1, base + 2] and all(set(n) == {"type", "sequence"} for n in refreshed)
        deep_scan(TestClient(app).get("/api/v1/intercom/overview").json())
        assert "Eve" not in stamped(notices) and "2002" not in stamped(notices)
    finally:
        intercom_sync.unsubscribe(q)


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


# ---------------------------------------------------------------- the split: a second session under its own token

class TokenFakeHa(FakeHa):
    """FakeHa that accepts a set of tokens and remembers which one this connection authenticated with."""

    def __init__(self, script: Any, accepted: set[str]) -> None:
        super().__init__(script)
        self.accepted = accepted
        self.token: str | None = None

    async def send(self, raw: str) -> None:
        msg = json.loads(raw)
        if msg.get("type") == "auth":
            assert self.q
            self.sent.append(msg)
            self.token = msg.get("access_token")
            self.q.put_nowait({"type": "auth_ok" if self.token in self.accepted else "auth_invalid"})
            return
        await super().send(raw)


def restricted_overview(revision: int = 7) -> dict[str, Any]:
    """What WisKey sends a non-administrator background account with `overview: view` and nothing else: no users, no host,
    no technical station fields - but still `last_access` with a person name (WisKey's own D-006 finding)."""
    raw = copy.deepcopy(OVERVIEW)
    raw["access"] = {"allowed": True, "is_admin": False, "revision": revision, "areas": {"overview": "view", "users": "none", "events": "none", "stations": "none", "management": "none"}}
    raw["users"], raw["user_count"] = [], 0
    for station in raw["stations"]:
        for key in ("host", "model", "firmware", "capabilities", "observations", "clock", "event_status", "last_poll_ms"):
            station.pop(key, None)
    return raw


@pytest.fixture()
def split(settings, monkeypatch):
    import websockets
    from dataclasses import replace

    from smplwise.main import create_app
    from smplwise.services import wiskey_background_feed as wbf

    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123", wiskey_background_token="bg-token")
    intercom_sync.SYNC.reset()
    wbf.FEED.reset()
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    conns: list[TokenFakeHa] = []

    def install(service: Any, background: Any, accepted: tuple[str, ...] = ("t", "bg-token")) -> list[TokenFakeHa]:
        def connect(url: str, **_kw: Any) -> TokenFakeHa:
            assert url == "ws://ha.local:8123/api/websocket"
            fake = TokenFakeHa(lambda msg, f: (background if f.token == "bg-token" else service)(msg, f), set(accepted))
            conns.append(fake)
            return fake

        monkeypatch.setattr(websockets, "connect", connect)
        return conns

    app = create_app(s)
    yield app, s, install, wbf
    wbf.FEED.shutdown()
    intercom_sync.SYNC.shutdown()
    for thread in (wbf.FEED.thread, intercom_sync.SYNC.thread):
        if thread is not None:
            thread.join(timeout=5)
    wbf.FEED.reset()
    intercom_sync.SYNC.reset()


def by_token(conns: list[TokenFakeHa], token: str) -> TokenFakeHa:
    return next(c for c in conns if c.token == token)


def service_script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
    if msg["type"] == "hikvision_intercom/stations/test_unlock":
        return [ok(msg, {"accepted": True})]
    return normal(msg, fake)


def background_script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
    if msg["type"] == "hikvision_intercom/overview":
        return [ok(msg, restricted_overview())]
    if msg["type"] == "get_config":
        return [normal(msg, fake)[0]]
    return [ok(msg)]


def both_ready(wbf: Any) -> None:
    wait_for(lambda: wbf.FEED.status["state"] == "ready" and intercom_sync.STATE.state == "ready")


def test_the_background_session_has_its_own_connection_token_and_only_read_commands(split, caplog):
    app, s, install, wbf = split
    caplog.set_level(logging.DEBUG, logger="smplwise.intercom")
    conns = install(service_script, background_script)
    intercom_sync.SYNC.start(s)
    wbf.FEED.start(s)
    both_ready(wbf)
    service, background = by_token(conns, "t"), by_token(conns, "bg-token")
    assert service is not background and len(conns) == 2, "two connections, two identities"
    assert background.types() == ["auth", "hikvision_intercom/overview", "hikvision_intercom/subscribe"], "the background session asks for nothing but its read and its push"
    assert "subscribe_entities" in service.types(), "the service session keeps the entity watch for the ring state"

    client = TestClient(app)
    view = client.get("/api/v1/intercom/background").json()
    assert view["identity"] == "background" and view["split"] is True and view["configured"] is True and view["state"] == "ready" and view["fresh"] is True
    projection = view["projection"]
    bg.assert_closed(projection)
    conforms_to_d006(projection)
    assert projection["permission_revision"] == 7 and [st["id"] for st in projection["stations"]] == ["entry-a", "entry-b"]
    deep_scan(view)
    assert view["sync"]["subscribe"] == "ok" and view["sync"]["wiskey_version"] == "4.2.0"
    # the entry center still comes from the service session (the operational detail the door flows need)
    overview = client.get("/api/v1/intercom/overview").json()
    assert overview["overview"]["stations"][0]["locks"] == [{"physical_index": 1, "name": "Gate"}]
    deep_scan(overview)
    logged = "\n".join(r.getMessage() for r in caplog.records if r.name == "smplwise.intercom")
    assert "WisKey background feed connected: 2 stations, WisKey 4.2.0" in logged
    assert "bg-token" not in logged and not any(m in logged for m in PERSON_MARKERS)


def test_a_door_release_never_rides_the_background_session(split):
    from smplwise.services import intercom_client, wiskey_background_feed as wbf_mod

    app, s, install, wbf = split
    conns = install(service_script, background_script)
    intercom_sync.SYNC.start(s)
    wbf.FEED.start(s)
    both_ready(wbf)
    reply = intercom_sync.SYNC.action(s, "release", lambda call: intercom_client.release_door(call, "entry-a", 1), intercom_sync.project_release, who="u1")
    assert reply["release"] == {"accepted": True}
    assert any(m["type"] == "hikvision_intercom/stations/test_unlock" for m in by_token(conns, "t").sent)
    assert not any(m["type"] == "hikvision_intercom/stations/test_unlock" for m in by_token(conns, "bg-token").sent)
    with pytest.raises(ValueError):  # the session has no path for a write or an unlisted read, by construction
        wbf.FEED.command("stations/test_unlock", lambda call: intercom_client.release_door(call, "entry-a", 1))
    assert wbf_mod.READ_ALLOWLIST == {"authorization/session"}


def test_the_background_account_being_refused_is_its_own_state_and_leaves_the_service_session_alone(split):
    app, s, install, wbf = split

    def refused(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/overview":
            return [fail(msg, "unauthorized")]
        return [ok(msg)]

    install(service_script, refused)
    intercom_sync.SYNC.start(s)
    wbf.FEED.start(s)
    wait_for(lambda: wbf.FEED.status["state"] == "forbidden" and intercom_sync.STATE.state == "ready")
    view = TestClient(app).get("/api/v1/intercom/background").json()
    assert view["state"] == "forbidden" and view["projection"] is None and view["last_error"] == "unauthorized" and view["fresh"] is False
    assert TestClient(app).get("/api/v1/intercom/overview").json()["state"] == "ready", "the service session is unaffected"


def test_access_revoked_on_the_background_session_drops_its_copy(split):
    app, s, install, wbf = split

    def revoking(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/overview":
            return [ok(msg, restricted_overview())]
        if msg["type"] == "hikvision_intercom/subscribe":
            return [ok(msg), {"id": msg["id"], "type": "event", "event": {"kind": "access_revoked"}}]
        return [ok(msg)]

    install(service_script, revoking)
    intercom_sync.SYNC.start(s)
    wbf.FEED.start(s)
    wait_for(lambda: wbf.FEED.status["state"] == "forbidden")
    assert TestClient(app).get("/api/v1/intercom/background").json()["projection"] is None


def test_a_refresh_push_refetches_and_a_disconnect_keeps_serving_the_closed_copy(split):
    app, s, install, wbf = split
    calls = {"n": 0}

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/overview":
            calls["n"] += 1
            return [ok(msg, restricted_overview(revision=7 + calls["n"]))]
        if msg["type"] == "hikvision_intercom/subscribe":
            return [ok(msg), {"id": msg["id"], "type": "event", "event": {"kind": "refresh"}}]
        return [ok(msg)]

    conns = install(service_script, script)
    intercom_sync.SYNC.start(s)
    wbf.FEED.start(s)
    wait_for(lambda: wbf.FEED.status["state"] == "ready" and calls["n"] >= 2 and wbf.FEED.status["sequence"] >= 2)
    projection = TestClient(app).get("/api/v1/intercom/background").json()["projection"]
    assert projection["permission_revision"] >= 9, "the pushed refresh was refetched"
    # the background socket closes: the session reconnects; whatever is served in between is the closed projection
    first = by_token(conns, "bg-token")
    assert first.q is not None
    first.q.put_nowait(CLOSE)
    wait_for(lambda: wbf.FEED.status["reconnects"] >= 1)
    view = TestClient(app).get("/api/v1/intercom/background").json()
    deep_scan(view)
    if view["projection"] is not None:
        bg.assert_closed(view["projection"])


def test_a_failed_subscribe_is_reported_not_fatal(split):
    app, s, install, wbf = split

    def no_push(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/subscribe":
            return [{"id": msg["id"], "type": "result", "success": False, "error": {"code": "unauthorized", "message": "unauthorized"}}]
        return background_script(msg, fake)

    install(service_script, no_push)
    intercom_sync.SYNC.start(s)
    wbf.FEED.start(s)
    both_ready(wbf)
    view = TestClient(app).get("/api/v1/intercom/background").json()
    assert view["state"] == "ready" and view["sync"]["subscribe"] == "failed:unauthorized" and view["projection"]["stations"]


def test_without_a_token_the_feed_does_not_run_and_the_view_says_the_identity_is_the_service_one(feed):
    from smplwise.services import wiskey_background_feed as wbf

    app, s, install = feed
    wbf.FEED.reset()
    fakes = install(lambda msg, fake: normal(msg, fake))
    wbf.FEED.start(s)
    assert wbf.FEED.thread is None or not wbf.FEED.thread.is_alive()
    assert wbf.FEED.status["state"] == "not_configured"
    client = TestClient(app)
    before = client.get("/api/v1/intercom/background").json()
    assert before["split"] is False and before["identity"] == "service" and before["projection"] is None
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    view = client.get("/api/v1/intercom/background").json()
    assert view["identity"] == "service" and view["split"] is False and view["state"] == "ready" and view["fresh"] is True
    bg.assert_closed(view["projection"])
    deep_scan(view)
    assert len(fakes) == 1, "one connection: nothing is opened for a background account that does not exist"


def test_the_background_token_is_never_sent_to_the_supervisor_proxy(split):
    """Inside the add-on `ha_url` is the Supervisor proxy, which accepts only SUPERVISOR_TOKEN: with no core URL to reach
    (outside the add-on and no HA_CORE_URL) the background session does not connect at all, rather than send the account's
    token to the wrong endpoint."""
    from dataclasses import replace

    app, s, install, wbf = split
    conns = install(service_script, background_script)
    proxied = replace(s, ha_url="http://supervisor/core", ha_core_url=None)
    wbf.FEED.start(proxied)
    wait_for(lambda: wbf.FEED.status["state"] == "ha_unavailable" and wbf.FEED.status["last_error"] == "HaUnavailable")
    assert conns == [], "no connection was opened, so the token went nowhere"
