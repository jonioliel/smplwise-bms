"""NN5 F1 - Frigate review items and events: normalizing, the severity layers, the idempotent store + mirrored event, polling with
overlap / open-item refresh / gone items, the defensive WebSocket parser, the debounced camera-offline events, notifications from
alerts only, and the event loop (WebSocket primary, polling backfill, coverage gap). Fake Frigate only."""
from __future__ import annotations

import datetime as dt
import json
import sys
import threading
import time
from pathlib import Path

import pytest

from smplwise.db import Database, now_iso
from smplwise.errors import ApiError
from smplwise.services import events_ingest, rules
from smplwise.services.recorders import frigate as fr
from smplwise.services.recorders import frigate_events as fe
from smplwise.services.recorders import frigate_http as fh

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_frigate import T0, FakeFrigate, review, settings_for  # noqa: E402

RID = "nvr-2"


@pytest.fixture(autouse=True)
def _clean():
    fh.clear_cache()
    fr.clear_cache()
    fe.STATES.clear()
    yield
    fh.clear_cache()
    fr.clear_cache()
    fe.STATES.clear()


@pytest.fixture()
def fake() -> FakeFrigate:
    return FakeFrigate()


class Listener:
    """The slice of AlertStreamListener that the Frigate loop uses."""

    def __init__(self, db, s) -> None:
        self.db, self.settings, self.recorder_id = db, s, RID
        self.state = events_ingest.IngestState()
        self.stop = threading.Event()
        self.tz_getter = lambda: "Asia/Jerusalem"


@pytest.fixture()
def world(settings, fake, monkeypatch):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    db = Database(settings.db_path)
    db.migrate()
    now = now_iso()
    with db.connection() as conn:
        conn.execute("INSERT INTO recorders(id, name, created_at) VALUES (?, 'Frigate', ?)", (RID, now))
        conn.execute("UPDATE recorders SET vendor = 'frigate' WHERE id = ?", (RID,))
        for i, key in enumerate(("cam_front", "cam_yard", "cam_garage"), start=1):
            conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, source_ref, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
                         (f"cid{i}", RID, i, key, key, now, now))
    s = settings_for(settings)
    ad = fr.FrigateAdapter(RID, s, transport=fake.transport())
    published: list = []
    monkeypatch.setattr(events_ingest, "publish", lambda ev: published.append(ev))
    fired: list = []
    monkeypatch.setattr(rules, "evaluate_event", lambda conn, ev, tz, deliver=True: fired.append(ev["id"]) or [])
    return {"db": db, "ad": ad, "lst": Listener(db, s), "fired": fired, "published": published, "settings": s}


def rows(db, sql, *args):
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


# ---------------------------------------------------------------------------------------------- normalizing

def test_normalize_review_shapes():
    n = fe.normalize_review(review("1791227000.100000-aaa111", "cam_front", T0, T0 + 30, "alert", ("person", "car"), ("porch",)))
    assert (n["review_id"], n["source_ref"], n["severity"], n["start_ts"], n["end_ts"]) == ("1791227000.100000-aaa111", "cam_front", "alert", T0, T0 + 30)
    assert n["objects"] == ["person", "car"] and n["zones"] == ["porch"] and n["thumb_time"] == T0 + 4
    assert fe.normalize_review({"id": "x", "camera": "c", "start_time": 1, "severity": "weird"})["severity"] == "detection"
    assert fe.normalize_review({"id": "x", "camera": "c", "start_time": 1, "data": {"sub_labels": {"a": 1}, "objects": "bad"}})["sub_labels"] == ["a"]
    for bad in (None, [], {"id": "x"}, {"id": "x", "camera": "c"}, {"camera": "c", "start_time": 1}, {"id": 5, "camera": "c", "start_time": 1}, "str"):
        assert fe.normalize_review(bad) is None


def test_event_type_mapping():
    assert fe.event_type(["dog", "person"]) == "person" and fe.event_type(["car"]) == "vehicle" and fe.event_type(["dog"]) == "other" and fe.event_type([]) == "other"


# ---------------------------------------------------------------------------------------------- frames (defensive)

def test_parse_frame_variants():
    item = review("1791227000.100000-aaa111", "cam_front", T0, None)
    new = {"topic": "reviews", "payload": json.dumps({"type": "new", "before": {}, "after": item})}
    assert fe.parse_frame(json.dumps(new)) == [("review", item)]
    assert fe.parse_frame(json.dumps({"topic": "reviews", "payload": {"type": "update", "before": item, "after": None}}))[0][1] == item, "falls back to `before`"
    assert fe.parse_frame(json.dumps({"topic": "reviews", "payload": item}))[0][1] == item, "a bare item"
    assert fe.parse_frame(json.dumps({"topic": "events", "payload": "{}"})) == [("hint", "events")]
    assert fe.parse_frame(json.dumps({"topic": "tracked_object_update", "payload": {}})) == [("hint", "tracked_object_update")]
    assert fe.parse_frame(json.dumps({"topic": "cam_front/status/detect", "payload": "offline"})) == [("status", ("cam_front", False))]
    assert fe.parse_frame(json.dumps({"topic": "cam_front/status/detect", "payload": "online"})) == [("status", ("cam_front", True))]
    assert fe.parse_frame(new["payload"].encode()) == [], "a payload that is not a frame"
    for junk in ("not json", b"\xff\xfe", "[]", '{"topic": 5}', '{"payload": 1}', '{"topic": "cam/x/y/status/detect", "payload": "online"}', '{"topic": "stats", "payload": "{}"}', None, 5):
        assert fe.parse_frame(junk) == []


def test_offline_debounce_ignores_the_flap_and_reports_a_real_outage():
    t = fe.OfflineTracker(after_s=60)
    assert t.update("cam_front", False, 0) == [] and t.update("cam_front", True, 20) == [], "a flap under the debounce is nothing"
    assert t.update("cam_front", False, 100) == [] and t.tick(150) == []
    assert t.tick(161) == [("offline", "cam_front", 100)], "reported once, after 60 s"
    assert t.tick(300) == [] and t.update("cam_front", False, 310) == [], "no repeat while it stays offline"
    assert t.update("cam_front", True, 400) == [("online", "cam_front", 100)]
    assert t.update("cam_front", True, 410) == []


# ---------------------------------------------------------------------------------------------- the store

def test_apply_review_creates_one_review_and_one_mirrored_event(world):
    db = world["db"]
    item = review("1791227000.100000-aaa111", "cam_front", T0 - 1000, T0 - 960, "alert", ("person",), ("porch",))
    with db.connection() as conn:
        a = fe.apply_review(conn, RID, item, fe._camera_lookup(conn, RID))
    assert a.created and a.changed and a.notify
    rev = rows(db, "SELECT * FROM frigate_reviews")[0]
    assert (rev["recorder_id"], rev["camera_id"], rev["severity"], rev["end_ts"], rev["event_id"]) == (RID, "cid1", "alert", T0 - 960, a.event["id"])
    ev = rows(db, "SELECT * FROM events")[0]
    assert ev["dedup_key"] == f"frigate|{RID}|review|1791227000.100000-aaa111" and ev["source"] == "frigate" and ev["recorder_id"] == RID
    assert (ev["type"], ev["severity"], ev["state"], ev["camera_id"], ev["channel"], ev["confidence"]) == ("person", "alert", "inactive", "cid1", 1, "measured")
    assert ev["occurred_at"].endswith("Z") and json.loads(ev["details_json"])["zones"] == ["porch"]
    assert "192.0.2" not in json.dumps(ev)


def test_apply_review_is_idempotent_and_updates_in_place(world):
    db = world["db"]
    open_item = review("1791227900.300000-ccc333", "cam_front", T0 - 100, None, "alert", ("person",))
    with db.connection() as conn:
        lookup = fe._camera_lookup(conn, RID)
        a1 = fe.apply_review(conn, RID, open_item, lookup)
        a2 = fe.apply_review(conn, RID, open_item, lookup)
        closed = review("1791227900.300000-ccc333", "cam_front", T0 - 100, T0 - 40, "alert", ("person", "dog"), detections=("d1", "d2"))
        a3 = fe.apply_review(conn, RID, closed, lookup)
    assert a1.created and not a2.changed and a3.changed and not a3.notify, "no second alert moment"
    assert len(rows(db, "SELECT * FROM events")) == 1 and len(rows(db, "SELECT * FROM frigate_reviews")) == 1
    ev = rows(db, "SELECT * FROM events")[0]
    assert (ev["state"], ev["count"], ev["ended_at"] is not None) == ("inactive", 2, True)
    assert json.loads(ev["details_json"])["labels"] == ["person", "dog"]


def test_a_detection_never_notifies_but_an_escalation_does_once(world):
    db = world["db"]
    with db.connection() as conn:
        lookup = fe._camera_lookup(conn, RID)
        d = fe.apply_review(conn, RID, review("1791227500.200000-bbb222", "cam_yard", T0 - 500, None, "detection", ("car",)), lookup)
        up = fe.apply_review(conn, RID, review("1791227500.200000-bbb222", "cam_yard", T0 - 500, None, "alert", ("car",)), lookup)
        again = fe.apply_review(conn, RID, review("1791227500.200000-bbb222", "cam_yard", T0 - 500, T0 - 400, "alert", ("car",)), lookup)
    assert (d.notify, up.notify, again.notify) == (False, True, False)
    assert rows(db, "SELECT severity FROM events")[0]["severity"] == "alert"


def test_a_review_for_an_unknown_camera_is_stored_without_a_camera(world):
    db = world["db"]
    with db.connection() as conn:
        a = fe.apply_review(conn, RID, review("1791227500.200000-ddd444", "cam_new", T0 - 5, None, "detection"), fe._camera_lookup(conn, RID))
    assert a.review["camera_id"] is None and a.event["camera_id"] is None
    assert rows(db, "SELECT camera_id FROM frigate_reviews")[0]["camera_id"] is None


def test_review_view_has_no_path_or_url(world):
    db = world["db"]
    with db.connection() as conn:
        a = fe.apply_review(conn, RID, review("1791227000.100000-aaa111", "cam_front", T0 - 1000, T0 - 960, "alert"), fe._camera_lookup(conn, RID))
    v = fe.review_view(a.review, reviewed=False)
    assert v["severity"] == "alert" and v["duration_s"] == 40.0 and v["open"] is False and v["reviewed"] is False and v["detections"] == 1
    assert "thumb_path" not in v and "/media/" not in json.dumps(v)


# ---------------------------------------------------------------------------------------------- polling

def test_first_poll_backfills_an_hour_and_stores_everything(world, fake):
    st = fe.state_of(RID)
    n = fe.poll_reviews(world["lst"], world["ad"], st, T0)
    assert n == 3 and st.polls == 1 and st.last_poll_ts == T0 - 100
    assert len(rows(world["db"], "SELECT * FROM frigate_reviews")) == 3 and len(world["published"]) == 3
    assert sorted(world["fired"]) == sorted(e["id"] for e in rows(world["db"], "SELECT id FROM events WHERE severity = 'alert'")), "rules saw the alerts only"
    assert len(world["fired"]) == 2
    assert rows(world["db"], "SELECT last_poll_ts FROM frigate_sync_state")[0]["last_poll_ts"] == T0 - 100


def test_a_second_poll_changes_nothing_and_publishes_nothing(world, fake):
    st = fe.state_of(RID)
    fe.poll_reviews(world["lst"], world["ad"], st, T0)
    world["published"].clear()
    assert fe.poll_reviews(world["lst"], world["ad"], st, T0 + 10) == 0 and world["published"] == []


def test_the_overlap_catches_an_item_that_grew_after_it_was_seen(world, fake):
    st = fe.state_of(RID)
    fe.poll_reviews(world["lst"], world["ad"], st, T0)
    fake.reviews[2] = review("1791227900.300000-ccc333", "cam_front", T0 - 100, T0 - 30, "alert", ("person", "dog"))
    assert fe.poll_reviews(world["lst"], world["ad"], st, T0 + 20) == 1
    ev = rows(world["db"], "SELECT * FROM events WHERE dedup_key LIKE '%ccc333'")[0]
    assert ev["state"] == "inactive" and ev["ended_at"] is not None


def test_an_old_open_item_is_refreshed_by_id_and_a_gone_one_is_closed(world, fake):
    fake.reviews.append(review("1791226000.000001-old001", "cam_yard", T0 - 2000, None, "detection"))
    fake.reviews.append(review("1791226100.000002-old002", "cam_yard", T0 - 1900, None, "detection"))
    st = fe.state_of(RID)
    fe.poll_reviews(world["lst"], world["ad"], st, T0)
    assert len(rows(world["db"], "SELECT * FROM frigate_reviews WHERE end_ts IS NULL")) == 3
    # Frigate closes one and drops the other; both are older than the poll window now
    fake.reviews = [r for r in fake.reviews if not r["id"].endswith("old002")]
    for r in fake.reviews:
        if r["id"].endswith("old001"):
            r["end_time"] = T0 - 1800
    fe.poll_reviews(world["lst"], world["ad"], st, T0 + 5000 - 100) if False else None
    st.last_poll_ts = T0 + 3000  # the cursor moved on: the window no longer covers them
    fe.poll_reviews(world["lst"], world["ad"], st, T0 + 3600)
    by = {r["review_id"][-6:]: r for r in rows(world["db"], "SELECT * FROM frigate_reviews")}
    assert by["old001"]["end_ts"] == T0 - 1800, "refreshed by id"
    assert by["old002"]["end_ts"] is not None, "gone from Frigate: closed where it stood"


def test_a_poll_error_propagates_and_leaves_the_cursor(world, fake):
    st = fe.state_of(RID)
    fe.poll_reviews(world["lst"], world["ad"], st, T0)
    fake.down = True
    with pytest.raises(ApiError) as e:
        fe.poll_reviews(world["lst"], world["ad"], st, T0 + 5)
    assert e.value.code == "source_unavailable" and st.last_poll_ts == T0 - 100


def test_the_cursor_survives_a_restart(world, fake):
    fe.poll_reviews(world["lst"], world["ad"], fe.state_of(RID), T0)
    fe.STATES.clear()
    st = fe.state_of(RID)
    fe._load_cursor(world["lst"], st)
    assert st.last_poll_ts == T0 - 100


# ---------------------------------------------------------------------------------------------- the loop

class FakeWs:
    """`websockets.sync.client.connect` stand-in: a context manager whose `recv` hands out the queued frames, then times out."""

    def __init__(self, frames):
        self.frames, self.opened, self.kwargs = list(frames), 0, {}

    def __call__(self, url, **kwargs):
        self.opened += 1
        self.url, self.kwargs = url, kwargs
        return self

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def recv(self, timeout=None):
        if self.frames:
            return self.frames.pop(0)
        time.sleep(0.02)
        raise TimeoutError


def run(world, monkeypatch, ws, rounds=6, clock=None):
    monkeypatch.setenv("SW_FRIGATE_EVENTS", "1")
    lst = world["lst"]
    lst.stop.clear()
    ticks = iter(range(10_000))
    fe.run_loop(lst, adapter=world["ad"], ws_connect=ws, clock=clock or (lambda: T0 + next(ticks) * 0.01), max_rounds=rounds)
    lst.stop.set()


def test_loop_applies_ws_reviews_at_once_and_polls_as_backfill(world, fake, monkeypatch):
    live = review("1791227990.400000-eee555", "cam_yard", T0 - 5, None, "alert", ("person",))
    ws = FakeWs([json.dumps({"topic": "reviews", "payload": json.dumps({"type": "new", "before": {}, "after": live})}), "junk", json.dumps({"topic": "events", "payload": "{}"})])
    run(world, monkeypatch, ws)
    ids = {r["review_id"][-6:] for r in rows(world["db"], "SELECT review_id FROM frigate_reviews")}
    assert ids >= {"aaa111", "bbb222", "ccc333", "eee555"}, "the poll backfilled three; the WebSocket added the fourth"
    assert ws.opened >= 1 and "additional_headers" in ws.kwargs and ws.kwargs["additional_headers"]["Cookie"].startswith("frigate_token=")
    assert ws.url.startswith("ws://"), "the plain-HTTP fake connects over ws"
    st = fe.state_of(RID)
    assert st.polls >= 1 and st.ws_frames >= 3
    assert world["lst"].state.last_heartbeat_at and world["lst"].state.last_event_at


def test_loop_never_sends_anything_but_gets_and_the_login(world, fake, monkeypatch):
    run(world, monkeypatch, FakeWs([]))
    assert fake.non_get == ["POST /api/login"]


def test_loop_records_a_coverage_gap_after_an_outage_and_backfills(world, fake, monkeypatch):
    fake.down = True
    run(world, monkeypatch, FakeWs([]), rounds=3)
    lst = world["lst"]
    assert lst.state.disconnected_since is not None and lst.state.last_error == "source_unavailable" and lst.state.reconnects == 0
    lst.state.disconnected_since = time.time() - 200  # the outage lasted > GAP_AFTER_S
    fake.down = False
    monkeypatch.setattr(fe, "WS_DOWN_POLL_S_DEFAULT", 0.0)
    run(world, monkeypatch, FakeWs([]), rounds=3)
    gaps = rows(world["db"], "SELECT * FROM events WHERE type = 'coverage_gap'")
    assert len(gaps) == 1 and gaps[0]["recorder_id"] == RID and gaps[0]["confidence"] == "measured"
    assert len(rows(world["db"], "SELECT * FROM frigate_reviews")) == 3, "the missed span is read back from Frigate's own history"
    assert lst.state.last_error is None and lst.state.disconnected_since is None


def test_loop_turns_a_real_offline_into_one_debounced_event(world, fake, monkeypatch):
    def frame(online):
        return json.dumps({"topic": "cam_yard/status/detect", "payload": "online" if online else "offline"})

    t = {"v": T0}
    ws = FakeWs([frame(False), frame(True), frame(False)])

    def clock():
        t["v"] += 30  # each loop round is 30 s: the third (offline) frame is past the debounce two rounds later
        return t["v"]

    run(world, monkeypatch, ws, rounds=10, clock=clock)
    offs = rows(world["db"], "SELECT * FROM events WHERE type = 'offline' AND source = 'frigate'")
    assert len(offs) == 1 and offs[0]["severity"] == "critical" and offs[0]["camera_id"] == "cid2"


def test_loop_is_off_when_the_env_says_so(world, fake, monkeypatch):
    monkeypatch.setenv("SW_FRIGATE_EVENTS", "0")
    fe.run_loop(world["lst"], adapter=world["ad"], ws_connect=FakeWs([]), max_rounds=3)
    assert fake.hits == [] and world["lst"].state.last_error == "disabled_by_env"


def test_a_ws_that_cannot_connect_never_stops_the_polling(world, fake, monkeypatch):
    def broken(url, **kw):
        raise OSError("refused")

    run(world, monkeypatch, broken)
    assert len(rows(world["db"], "SELECT * FROM frigate_reviews")) == 3 and fe.state_of(RID).ws_state in ("down", "off")


def test_the_ws_url_follows_the_scheme_and_carries_no_credentials_in_it(settings, fake):
    a = fr.FrigateAdapter(RID, settings_for(settings), transport=fake.transport())
    assert a.http.websocket_url() == "ws://frigate.test:8971/ws"
    s = settings_for(settings, scheme="https", tls_mode="trust")
    b = fr.FrigateAdapter(RID, s, transport=fake.transport())
    assert b.http.websocket_url() == "wss://frigate.test:8971/ws" and b.http.websocket_ssl() is not None
    assert "viewer-pass" not in b.http.websocket_url() and "arx-viewer" not in b.http.websocket_url()
