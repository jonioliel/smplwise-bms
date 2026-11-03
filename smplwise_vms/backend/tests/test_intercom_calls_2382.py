"""WISKEY-INBOUND-CALLS-2382: incoming door-station calls - the call book driven by FAKE WisKey station copies (no Home Assistant,
no station: the copies are what services/intercom_sync projects from WisKey's `overview`), the call log, the banner's read with its
setting (off by default), rights and sound rules, and the hooks on the existing call / door routes.

    py -3.12 -m pytest smplwise_vms/backend/tests/test_intercom_calls_2382.py -q"""
from __future__ import annotations

import copy
import datetime as dt
import uuid
from typing import Any

import pytest
from conftest import as_user, bind
from fake_trusted_bridge import FakeWisKeyFeed, station
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.rbac import Principal
from smplwise.services import intercom_calls, intercom_sync
from smplwise.services import notify_settings as nsettings

API = "/api/v1"
GATE, SIDE = "st-gate", "st-side"


def st(sid: str = GATE, call_state: str = "idle", online: bool = True, name: str = "שער ראשי") -> dict[str, Any]:
    """One station as the feed projects it (intercom_sync._station): the fields the call book reads."""
    return {"id": sid, "name": name, "online": online, "call_state": call_state, "lock_enabled": True, "locks": [{"physical_index": 1, "name": "שער"}], "has_camera": True}


def who(user: str = "dana") -> Principal:
    return Principal(user_id=f"dev-{user}", username=user, display_name=user.capitalize(), source="dev")


class Clock:
    def __init__(self) -> None:
        self.t = 1000.0
        self.at = dt.datetime(2026, 11, 3, 8, 0, 0, tzinfo=dt.timezone.utc)

    def mono(self) -> float:
        return self.t

    def now(self) -> dt.datetime:
        return self.at

    def tick(self, s: float) -> None:
        self.t += s
        self.at += dt.timedelta(seconds=s)


@pytest.fixture()
def book():
    b = intercom_calls.BOOK
    b.reset()
    clock = Clock()
    b.mono, b.clock = clock.mono, clock.now
    yield b, clock
    b.reset()


def feed(b: intercom_calls.CallBook, *copies: list[dict[str, Any]]) -> None:
    """Feed consecutive station copies, as intercom_sync._store hands them over (before, after)."""
    prev: list[dict[str, Any]] | None = None
    for cur in copies:
        b.on_stations(prev, cur)
        prev = cur


def rows(b: intercom_calls.CallBook) -> dict[str, dict[str, Any]]:
    """The newest queued snapshot of each call (what the writer would upsert)."""
    out: dict[str, dict[str, Any]] = {}
    for r in b.take():
        out[r["id"]] = r
    return out


# ================================================================ the call book (fake WisKey transitions)

def test_a_ring_answered_from_arx_then_hung_up_from_arx(book):
    b, clock = book
    feed(b, [st()], [st(call_state="ringing")])
    call = b.open_call(GATE)
    assert call and call.state == "ringing" and call.station_name == "שער ראשי"
    clock.tick(4)
    b.note_command(GATE, "answer", who("dana"), {"observed_state": "in_call"})  # WisKey's read-back already shows the call
    assert b.open_call(GATE).state == "in_call" and b.open_call(GATE).answered_by == "dev-dana"
    b.on_stations([st(call_state="ringing")], [st(call_state="in_call")])  # the copy catches up: nothing changes
    clock.tick(30)
    b.note_command(GATE, "hangUp", who("dana"), {"observed_state": None})  # read-back lost: decided by the next copy
    assert b.open_call(GATE) is not None
    b.on_stations([st(call_state="in_call")], [st(call_state="idle")])
    assert b.open_call(GATE) is None
    r = rows(b)[call.id]
    assert r["state"] == "ended" and r["outcome"] == "answered" and r["answered_via"] == "arx" and r["answered_by_name"] == "Dana"
    assert r["ended_by"] == "dev-dana" and r["observed"] == "ringing"
    assert r["answered_at"] == "2026-11-03T08:00:04.000Z" and r["ended_at"] == "2026-11-03T08:00:34.000Z"


def test_a_ring_answered_on_another_panel_is_answered_elsewhere_with_no_name(book):
    b, _ = book
    feed(b, [st()], [st(call_state="ringing")], [st(call_state="in_call")], [st()])
    (r,) = rows(b).values()
    assert r["outcome"] == "answered" and r["answered_via"] == "elsewhere" and r["answered_by"] is None and r["ended_by"] is None


def test_a_ring_nobody_answered_is_missed_and_a_rejected_one_names_who_rejected(book):
    b, clock = book
    feed(b, [st()], [st(call_state="ringing")], [st()])
    (missed,) = rows(b).values()
    assert missed["outcome"] == "missed" and missed["ended_by"] is None
    feed(b, [st()], [st(call_state="ringing")])
    b.note_command(GATE, "reject", who("omer"), None)  # no read-back: the next copy decides
    b.on_stations([st(call_state="ringing")], [st()])
    (rejected,) = rows(b).values()
    assert rejected["outcome"] == "rejected" and rejected["ended_by"] == "dev-omer" and rejected["ended_by_name"] == "Omer"
    # an old command does not explain a later transition
    feed(b, [st()], [st(call_state="ringing")])
    b.note_command(GATE, "reject", who("omer"), None)
    clock.tick(intercom_calls.COMMAND_WINDOW_S + 1)
    b.on_stations([st(call_state="ringing")], [st()])
    (late,) = rows(b).values()
    assert late["outcome"] == "missed" and late["ended_by"] is None


def test_a_station_that_drops_mid_ring_closes_the_call_as_unknown(book):
    b, _ = book
    feed(b, [st()], [st(call_state="ringing")], [st(online=False, call_state="unavailable")])
    (r,) = rows(b).values()
    assert r["outcome"] == "unknown" and r["state"] == "ended"
    feed(b, [st()], [st(call_state="ringing")], [st(call_state="in_call")], [st(call_state="unavailable")])
    (r2,) = rows(b).values()
    assert r2["outcome"] == "answered"  # answered, then the station's state became unreadable: still an answered call


def test_a_lagging_copy_never_mints_a_second_call_for_the_same_ring(book):
    """Rejected from Arx with WisKey's read-back `idle`: the call closes at once. The copy still shows the ring for a moment; that
    is the SAME ring, not a new call - and its end is not logged twice."""
    b, _ = book
    feed(b, [st()], [st(call_state="ringing")])
    b.note_command(GATE, "reject", who(), {"observed_state": "idle"})
    assert b.open_call(GATE) is None
    b.on_stations([st(call_state="ringing")], [st(call_state="ringing", name="שער ראשי ")])
    b.on_stations([st(call_state="ringing")], [st()])
    assert len(rows(b)) == 1 and b.open_call(GATE) is None
    # hung up from Arx while the copy still says in_call
    feed(b, [st()], [st(call_state="ringing")], [st(call_state="in_call")])
    b.note_command(GATE, "hangUp", who(), {"observed_state": "idle"})
    b.on_stations([st(call_state="in_call")], [st(call_state="in_call")])
    assert b.open_call(GATE) is None and len(rows(b)) == 1


def test_a_call_seen_first_in_progress_and_a_new_ring_after_a_call(book):
    b, _ = book
    b.on_stations(None, [st(call_state="in_call")])  # Arx (re)started during a call
    first = b.open_call(GATE)
    assert first.observed == "in_call" and first.answered_via == "elsewhere"
    b.on_stations([st(call_state="in_call")], [st(call_state="ringing")])  # straight into the next ring
    second = b.open_call(GATE)
    assert second.id != first.id and second.state == "ringing"
    r = rows(b)
    assert r[first.id]["state"] == "ended" and r[second.id]["state"] == "ringing"


def test_a_ring_already_in_progress_when_the_feed_starts_is_offered(book):
    b, _ = book
    b.on_stations([], [st(call_state="ringing"), st(SIDE, name="דלת צד")])
    assert b.open_call(GATE).state == "ringing" and b.open_call(SIDE) is None


def test_a_door_opened_during_or_just_after_the_call_joins_it(book):
    b, clock = book
    feed(b, [st()], [st(call_state="ringing")])
    cid = b.open_call(GATE).id
    assert b.note_door(GATE, who("dana")) == cid
    b.on_stations([st(call_state="ringing")], [st()])
    clock.tick(intercom_calls.DOOR_AFTER_S - 5)
    assert b.note_door(GATE, who("omer")) == cid  # the visitor walks in after the call ended
    r = rows(b)[cid]
    assert r["door_opened_by"] == "dev-omer" and r["door_opened_by_name"] == "Omer"
    clock.tick(10)
    assert b.note_door(GATE, who()) is None  # long after: an ordinary door opening, no call


def test_a_bad_station_row_never_breaks_the_others(book):
    b, _ = book
    assert intercom_calls.on_stations(None, [{"id": GATE, "online": True, "call_state": "ringing", "name": None}, "junk", {"no": "id"}]) == 1  # type: ignore[list-item]
    assert b.open_call(GATE).station_name == ""


# ================================================================ the log: writer, orphans, retention

def test_the_writer_upserts_and_start_up_closes_orphans(settings, book):
    b, clock = book
    app = create_app(settings)
    db: Database = app.state.db
    feed(b, [st()], [st(call_state="ringing")], [st(call_state="in_call")])
    assert intercom_calls.flush(db) >= 2
    with db.connection(mode="read") as conn:
        (row,) = conn.execute("SELECT * FROM intercom_calls").fetchall()
    assert row["state"] == "in_call" and row["outcome"] == "answered"
    with db.connection() as conn:
        conn.execute("INSERT INTO intercom_calls(id, station_id, station_name, rang_at, state, outcome, ended_at, updated_at) "
                     "VALUES ('old', 'x', 'x', '2026-01-01T00:00:00Z', 'ended', 'missed', '2026-01-01T00:00:30Z', '2026-01-01T00:00:30Z')")
        assert intercom_calls.close_orphans(conn, clock.now()) == 1
        states = {r["id"]: (r["state"], r["outcome"]) for r in conn.execute("SELECT id, state, outcome FROM intercom_calls").fetchall()}
    assert states == {row["id"]: ("ended", "answered")}  # the open one closed (answered), the 10-month-old one pruned


# ================================================================ the routes (a fake WisKey feed, mocked transport)

@pytest.fixture()
def world(settings, monkeypatch):
    intercom_calls.BOOK.reset()
    fake = FakeWisKeyFeed([station(GATE, "שער ראשי"), station(SIDE, "דלת צד")]).install(monkeypatch)
    app = create_app(settings)
    c = TestClient(app)
    yield {"c": c, "db": app.state.db, "feed": fake, "settings": settings}
    intercom_calls.BOOK.reset()


def _ring(world: dict[str, Any], sid: str = GATE, state: str = "ringing") -> None:
    """The fake WisKey copy changes (a station starts ringing): stored through the REAL feed path (_store), which hands the
    change to the call book."""
    raw = copy.deepcopy(world["feed"].raw)
    for s in raw["stations"]:
        if s["id"] == sid:
            s["call_state"] = state
    world["feed"].raw = raw
    intercom_sync.SYNC._store(raw)


def _set(c: TestClient, body: dict[str, Any], user: str | None = None):
    return c.put(f"{API}/intercom/calls/settings", json=body, headers=as_user(user) if user else {})


def _active(c: TestClient, user: str | None = None):
    return c.get(f"{API}/intercom/calls/active", headers=as_user(user) if user else {})


def _env(**fields: Any) -> dict[str, Any]:
    exp = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=15)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {"client_request_id": str(uuid.uuid4()), "expires_at": exp, **fields}


def test_the_banner_is_off_by_default(world):
    c = world["c"]
    _ring(world)
    r = _active(c)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["enabled"] is False and body["mode"] == "off" and body["calls"] == [] and body["feed"] == "ready"
    s = c.get(f"{API}/intercom/calls/settings").json()
    assert s["settings"] == {"mode": "off", "roles": [], "stations": [], "sound": True} == s["defaults"]
    assert {"id": "operator", "name": s["roles"][[r["id"] for r in s["roles"]].index("operator")]["name"]} in s["roles"]
    assert {st_["id"] for st_ in s["stations"]} == {GATE, SIDE}


def test_everyone_with_the_call_right_on_the_station_gets_the_ringing_call(world):
    c, settings = world["c"], world["settings"]
    assert _set(c, {"mode": "everyone", "roles": [], "stations": [], "sound": True}).status_code == 200
    _ring(world)
    body = _active(c).json()
    assert body["enabled"] is True and body["sound"] == "ring" and body["sound_reason"] is None
    (call,) = body["calls"]
    assert call["station_id"] == GATE and call["station_name"] == "שער ראשי" and call["state"] == "ringing" and call["answered_by_me"] is False
    assert call["can_open_door"] is True and call["locks"] == [{"physical_index": 1, "name": "ממסר 1"}] and call["online"] is True
    # an operator bound to the gate only: sees it; one bound to the side door only: does not
    bind(c, settings, "gateop", "operator", "access_control_station", GATE)
    bind(c, settings, "sideop", "operator", "access_control_station", SIDE)
    assert [x["station_id"] for x in _active(c, "gateop").json()["calls"]] == [GATE]
    assert _active(c, "gateop").json()["calls"][0]["can_open_door"] is False  # the operator holds no door permission
    assert _active(c, "sideop").json()["calls"] == []
    # a viewer (access.read, no access.call): refused at the gate, never polled into a banner
    bind(c, settings, "vera", "viewer", "installation", "*")
    assert _active(c, "vera").status_code == 403


def test_roles_and_stations_narrow_the_banner(world):
    c, settings = world["c"], world["settings"]
    bind(c, settings, "op", "operator", "installation", "*")
    bind(c, settings, "boss", "site_admin", "installation", "*")
    assert _set(c, {"mode": "roles", "roles": ["operator"], "stations": [], "sound": True}).status_code == 200
    _ring(world)
    _ring(world, SIDE)
    assert {x["station_id"] for x in _active(c, "op").json()["calls"]} == {GATE, SIDE}
    boss = _active(c, "boss").json()
    assert boss["enabled"] is False and boss["calls"] == []
    assert _set(c, {"mode": "roles", "roles": ["operator", "site_admin"], "stations": [SIDE], "sound": True}).status_code == 200
    assert [x["station_id"] for x in _active(c, "boss").json()["calls"]] == [SIDE]
    # invalid settings are refused; a non-administrator may not change them
    assert _set(c, {"mode": "roles", "roles": [], "stations": [], "sound": True}).status_code == 422
    assert _set(c, {"mode": "roles", "roles": ["no_such_role"]}).status_code == 422
    assert _set(c, {"mode": "loud"}).status_code == 422
    assert _set(c, {"mode": "everyone", "extra": 1}).status_code == 422
    assert _set(c, {"mode": "off"}, "op").status_code == 403
    assert c.get(f"{API}/intercom/calls/settings", headers=as_user("op")).status_code == 403
    with world["db"].connection(mode="read") as conn:
        audited = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'intercom.call_banner.settings'").fetchone()[0]
    assert audited == 2


def test_a_ring_on_a_last_known_copy_is_never_offered(world, monkeypatch):
    c = world["c"]
    _set(c, {"mode": "everyone"})
    _ring(world)
    monkeypatch.setattr(intercom_sync.SYNC, "served", lambda settings: ("ha_unavailable", intercom_sync.SYNC._cache))
    body = _active(c).json()
    assert body["calls"] == [] and body["feed"] == "ha_unavailable"


def test_the_ring_is_silent_in_quiet_hours_unless_the_doorbell_passes_them(world, monkeypatch):
    c = world["c"]
    _set(c, {"mode": "everyone"})
    _ring(world)
    monkeypatch.setattr(nsettings, "in_quiet_hours", lambda *a, **k: True)
    body = _active(c).json()
    assert body["sound"] == "silent" and body["sound_reason"] == "quiet_hours" and len(body["calls"]) == 1  # silent, still shown
    real = nsettings.load

    def passing(conn, *a, **k):
        out = real(conn, *a, **k)
        out["pass_through"]["alert"]["webpush"] = True  # the administrator lets the doorbell's severity through quiet hours
        return out

    monkeypatch.setattr(nsettings, "load", passing)
    assert _active(c).json()["sound"] == "ring"
    _set(c, {"mode": "everyone", "sound": False})
    body = _active(c).json()
    assert body["sound"] == "silent" and body["sound_reason"] == "setting_off"


def test_answer_reject_and_door_from_arx_are_logged_with_who(world):
    c, settings, db = world["c"], world["settings"], world["db"]
    _set(c, {"mode": "everyone"})
    bind(c, settings, "dana", "site_admin", "installation", "*")
    _ring(world)
    r = c.post(f"{API}/intercom/stations/{GATE}/call", json=_env(command="answer"), headers=as_user("dana"))
    assert r.status_code == 200, r.text
    assert world["feed"].sent[-1]["frames"][0]["command"] == "answer"
    _ring(world, GATE, "in_call")  # the station reports the call
    mine = _active(c, "dana").json()["calls"]
    assert len(mine) == 1 and mine[0]["state"] == "in_call" and mine[0]["answered_by_me"] is True
    assert _active(c).json()["calls"] == []  # somebody else's answered call is not offered to the others
    rel = c.post(f"{API}/intercom/stations/{GATE}/release", json=_env(confirmed=True, lock=1), headers=as_user("dana"))
    assert rel.status_code == 200, rel.text
    assert c.post(f"{API}/intercom/stations/{GATE}/call", json=_env(command="hangUp"), headers=as_user("dana")).status_code == 200
    _ring(world, GATE, "idle")
    # a second ring, rejected by the administrator
    _ring(world)
    assert c.post(f"{API}/intercom/stations/{GATE}/call", json=_env(command="reject")).status_code == 200
    _ring(world, GATE, "idle")
    log = c.get(f"{API}/intercom/calls", params={"station_id": GATE}).json()  # partly still in memory: served from there
    assert [x["outcome"] for x in log["calls"]] == ["rejected", "answered"]
    answered = log["calls"][1]
    assert answered["answered_via"] == "arx" and answered["answered_by_name"] == "dana" and answered["door_opened_by_name"] == "dana" and answered["ended_by_name"] == "dana"
    assert "answered_by" not in answered and "door_opened_by" not in answered  # user ids stay on the server
    assert intercom_calls.flush(db) > 0
    again = c.get(f"{API}/intercom/calls", params={"station_id": GATE}).json()["calls"]
    assert [x["outcome"] for x in again] == ["rejected", "answered"] and again[1]["answered_by_me"] is False
    assert c.get(f"{API}/intercom/calls", params={"station_id": GATE}, headers=as_user("dana")).json()["calls"][1]["answered_by_me"] is True


def test_the_log_shows_only_stations_the_caller_may_read(world):
    c, settings, db = world["c"], world["settings"], world["db"]
    _ring(world)
    _ring(world, GATE, "idle")
    _ring(world, SIDE)
    _ring(world, SIDE, "idle")
    intercom_calls.flush(db)
    assert {x["station_id"] for x in c.get(f"{API}/intercom/calls").json()["calls"]} == {GATE, SIDE}
    bind(c, settings, "gateop", "operator", "access_control_station", GATE)
    assert {x["station_id"] for x in c.get(f"{API}/intercom/calls", headers=as_user("gateop")).json()["calls"]} == {GATE}
    assert c.get(f"{API}/intercom/calls", params={"station_id": SIDE}, headers=as_user("gateop")).json()["calls"] == []
    bind(c, settings, "door", "door_opener", "installation", "*")  # access.read but neither the events nor the call right
    assert c.get(f"{API}/intercom/calls", headers=as_user("door")).json()["calls"] == []
    assert c.get(f"{API}/intercom/calls", headers=as_user("nobody")).status_code == 403
