"""T068 soak edge cases (T068-EDGE-2450): disconnects and a full disk, on fakes and temporary folders only - no lab, no device.

The long soak (tests/soak/soak_long.py) restarts its device fakes on a schedule and samples the backend; it never fills a disk
and it cannot tell which edge a failure belonged to. These tests walk each edge through a whole cycle on the real add-on
code - healthy, the fault, during the fault, the fault cleared - and check the same four things every time:

1. nothing crashes: the worker / listener / sync thread is still alive and the API still answers;
2. a health / diagnostic signal says what is wrong while it is wrong (the top-bar summary, the administrator's report, a
   counter or a state field) and stops saying it once it is over;
3. recovery happens on its own when the condition clears (no restart, no manual step);
4. data committed before the fault is still there afterwards (rows, files), and the database passes `integrity_check`.

Disconnects: the Home Assistant WebSocket dropping and refusing (three cycles), the NVR alert stream flapping (three cycles),
go2rtc going down and coming back EMPTY (a go2rtc restart forgets every stream added through its API).
Disk full: SQLite refusing writes (SQLITE_FULL) under the background writers, the export folder filling up while a file is
written and while an export is being finished, the thumbnails folder full, the crash guard's files on a full disk, and log
rotation (the faulthandler log cut back on a full disk; the soak harness's copy-truncate rotation of the backend log).

Each test prints one `T068_EDGE {json}` line with what it observed (`pytest -rA -s` shows them); the change note
docs/changes/T068-EDGE-2450.md carries the table."""
from __future__ import annotations

import asyncio
import collections
import datetime as dt
import errno
import json
import queue
import re
import sqlite3
import subprocess
import sys
import threading
import time
from dataclasses import replace
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from test_exports import fake_pages, lab  # noqa: F401 - `lab` is a fixture
from test_ha_structure_refresh import FakeHa

from smplwise import crashguard as cg
from smplwise import db as dbmod
from smplwise.main import create_app
from smplwise.services import autosync, events_ingest, health_report, ha_client, ha_sync, nvr, thumbnails
from smplwise.services import exports as ex
from smplwise.services import go2rtc as g2
from support.waiting import wait_for

BACKEND = Path(__file__).resolve().parents[1]
MB = 1024 * 1024
Usage = collections.namedtuple("Usage", "total used free")


def record(edge: str, **observed: Any) -> None:
    print("T068_EDGE " + json.dumps({"edge": edge, **observed}, ensure_ascii=False, sort_keys=True, default=str))


def summary_items(c: TestClient) -> dict[str, dict[str, Any]]:
    r = c.get("/api/v1/health/summary")
    assert r.status_code == 200, r.text
    return {i["id"]: i for i in r.json()["items"]}


def report_checks(c: TestClient) -> dict[str, dict[str, Any]]:
    health_report.invalidate()
    r = c.get("/api/v1/health/report")
    assert r.status_code == 200, r.text
    return {ch["id"]: ch for ch in r.json()["checks"]}


def summary_later(c: TestClient, monkeypatch: pytest.MonkeyPatch, seconds: float) -> dict[str, dict[str, Any]]:
    """The summary as it reads `seconds` from now (its own clock moved, nothing else)."""
    import types

    real = health_report.time
    with monkeypatch.context() as m:
        m.setattr(health_report, "time", types.SimpleNamespace(time=lambda: real.time() + seconds, monotonic=real.monotonic, sleep=real.sleep))
        return summary_items(c)


def integrity(db: Any) -> str:
    with db.connection(mode="read") as conn:
        return conn.execute("PRAGMA integrity_check").fetchone()[0]


def own_threads(started_before: set[int] | frozenset[int] = frozenset()) -> list[str]:
    """The live threads except pool workers (they grow on demand up to a cap, then are reused or idle out) and except the threads in
    `started_before`. TIMING-LANE-2480: AnyIO's worker threads are pool workers too - the test client's requests (summary, report) run
    their sync routes on them and an idle one exits about 10 s later, so on a loaded machine one is alive in some snapshots and gone
    in others (seen on the PC under load: cycle 0 `['AnyIO worker thread', 'MainThread', 'ha-sync']`, later cycles without it).
    `started_before` (idents alive before the test began): a daemon thread an EARLIER test of the same gate shard left behind ends
    whenever the machine gets round to it, possibly between two of this test's snapshots; it is not this test's."""
    return sorted(t.name for t in threading.enumerate()
                  if t.is_alive() and t.ident not in started_before and not t.name.startswith(("asyncio_", "ThreadPoolExecutor", "AnyIO worker thread")))


def threads_named(*prefixes: str) -> list[str]:
    return sorted(t.name for t in threading.enumerate() if t.is_alive() and t.name.startswith(prefixes))


# ======================================================================== a data disk that refuses writes

_WRITE = re.compile(r"^\s*(INSERT|UPDATE|DELETE|REPLACE)\b", re.IGNORECASE)
DISK = {"full": False}


class _FullDisk(sqlite3.Connection):
    """Every write statement fails as SQLite fails on a full disk (SQLITE_FULL, "database or disk is full"); reads work, as
    they do on a full disk."""

    @staticmethod
    def _check(sql: str) -> None:
        if DISK["full"] and _WRITE.match(sql or ""):
            exc = sqlite3.OperationalError("database or disk is full")
            exc.sqlite_errorcode = dbmod.SQLITE_FULL  # type: ignore[attr-defined]
            raise exc

    def execute(self, sql: str, *a: Any, **k: Any) -> sqlite3.Cursor:  # type: ignore[override]
        self._check(sql)
        return super().execute(sql, *a, **k)

    def executemany(self, sql: str, *a: Any, **k: Any) -> sqlite3.Cursor:  # type: ignore[override]
        self._check(sql)
        return super().executemany(sql, *a, **k)


class _Sqlite3Shim:
    def __getattr__(self, name: str) -> Any:
        return getattr(sqlite3, name)

    @staticmethod
    def connect(*a: Any, **k: Any) -> sqlite3.Connection:
        return sqlite3.connect(*a, factory=_FullDisk, **k)


@pytest.fixture()
def full_disk(monkeypatch):
    """The add-on's database connections refuse writes while DISK["full"]; the data disk reports 100 MB free meanwhile (what
    a real full disk shows next to SQLITE_FULL)."""
    import shutil

    real_usage = shutil.disk_usage
    monkeypatch.setattr(dbmod, "sqlite3", _Sqlite3Shim())
    monkeypatch.setattr(health_report.shutil, "disk_usage",
                        lambda p: Usage(32 * 1024**3, 32 * 1024**3 - 100 * MB, 100 * MB) if DISK["full"] else real_usage(p))
    DISK["full"] = False
    yield DISK
    DISK["full"] = False


def enospc(path: Any = None) -> OSError:
    return OSError(errno.ENOSPC, "No space left on device", str(path) if path else None)


# ======================================================================== D1: the Home Assistant WebSocket drops and reconnects

def _state(entity_id: str, state: str, at: str) -> dict[str, Any]:
    return {"entity_id": entity_id, "state": state, "attributes": {"friendly_name": entity_id}, "last_changed": at, "last_updated": at}


class ScriptedHa:
    """`ha_client.ws_session` for the real HaSync loop: while `down` every connect is refused (Home Assistant restarting);
    otherwise a session that completes the real `on_ready` against FakeHa, then feeds `events` until `drop` is set (the socket
    closes under it)."""

    def __init__(self) -> None:
        self.fake = FakeHa()
        self.down = False
        self.drop = threading.Event()
        self.events: queue.Queue = queue.Queue()
        self.attempts = 0
        self.ready = 0

    async def ws_session(self, _settings, on_ready, on_event, stop, on_message=None):
        self.attempts += 1
        if self.down:
            raise ConnectionRefusedError("connection refused")
        await on_ready(self.fake.call)
        self.ready += 1
        while not stop.is_set():
            while True:
                try:
                    data = self.events.get_nowait()
                except queue.Empty:
                    break
                on_event(data)
            if self.drop.is_set():
                self.drop.clear()
                raise ConnectionResetError("the socket closed")
            await asyncio.sleep(0.01)


def _mirror(db: Any, entity_id: str) -> str | None:
    with db.connection(mode="read") as conn:
        r = conn.execute("SELECT state FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
        return r["state"] if r else None


def _door_events(db: Any) -> list[str]:
    with db.connection(mode="read") as conn:
        return [r["id"] for r in conn.execute("SELECT id FROM events WHERE source = 'ha' ORDER BY occurred_at").fetchall()]


def test_d1_ha_websocket_drop_and_reconnect_three_cycles(settings, monkeypatch):
    """The real HaSync loop against a scripted socket, three times: connected -> the socket drops -> connects refused while
    Home Assistant restarts -> connected again. While down: `connected` false, `last_error` ha_restarting, the summary and the
    report say the sync is disconnected. After each reconnect: the snapshot brings the states changed during the outage, the
    state committed before the drop is still there, `reconnects` counts the drop, and no thread or subscriber is left over."""
    started_before = frozenset(t.ident for t in threading.enumerate())  # not this test's threads (see own_threads)
    monkeypatch.setattr(ha_sync, "BACKOFF_START_S", 0.05)
    monkeypatch.setattr(ha_sync, "BACKOFF_MAX_S", 0.2)
    monkeypatch.setattr(ha_sync, "RESTART_BACKOFF_CAP_S", 0.2)
    monkeypatch.setattr(ha_sync, "REGISTRY_DEBOUNCE_S", 0.05)
    s = replace(settings, ha_url="http://ha.test:8123", ha_token="edge-token")
    app = create_app(s)
    c = TestClient(app)
    db = app.state.db
    ha = ScriptedHa()
    monkeypatch.setattr(ha_client, "ws_session", ha.ws_session)
    sync = ha_sync.HaSync()
    seen: list[dict[str, Any]] = []
    sync.start(db, s)
    try:
        wait_for(lambda: ha_sync.STATE.connected and ha.ready == 1, timeout=10, what="first connect")
        for cycle in range(3):
            at = f"2026-11-19T10:0{cycle}:00+00:00"
            # healthy: a pushed door transition is committed - the mirror row and the door event Arx keeps (HA never resends it)
            door = next(st for st in ha.fake.states if st["entity_id"] == "binary_sensor.front_contact")
            old = dict(door)
            door.update(state="on" if old["state"] == "off" else "off", last_changed=at, last_updated=at)
            ha.events.put({"entity_id": door["entity_id"], "old_state": old, "new_state": dict(door)})
            wait_for(lambda cycle=cycle: len(_door_events(db)) == cycle + 1, timeout=5, what="door event stored")
            door_events = _door_events(db)
            reconnects_before = ha_sync.STATE.reconnects
            # the fault: the socket closes, and Home Assistant refuses connects while it restarts
            ha.down = True
            attempts = ha.attempts
            ha.drop.set()
            wait_for(lambda: not ha_sync.STATE.connected and ha.attempts >= attempts + 2, timeout=10, what="refused while down")
            assert sync.thread is not None and sync.thread.is_alive(), "the sync loop survives the drop"
            assert ha_sync.STATE.last_error == ha_sync.ERR_RESTARTING
            item = summary_items(c).get("ha")
            check = report_checks(c)["ha_sync"]
            assert item is not None and item["status"] == "warn", item
            assert check["status"] == "warn" and "מנותק" in check["detail"], check
            # meanwhile in Home Assistant: one entity changed, the mirror cannot know yet
            next(st for st in ha.fake.states if st["entity_id"] == "switch.loose").update(state=f"on-{cycle}", last_updated=at)
            assert _mirror(db, "switch.loose") != f"on-{cycle}"
            # cleared: Home Assistant answers again
            ha.down = False
            wait_for(lambda cycle=cycle: ha_sync.STATE.connected and ha.ready == cycle + 2, timeout=10, what="reconnected")
            assert ha_sync.STATE.reconnects == reconnects_before + 1 and ha_sync.STATE.last_error is None
            assert _mirror(db, "switch.loose") == f"on-{cycle}", "the snapshot on reconnect brings what changed during the outage"
            assert _door_events(db) == door_events, "the door events committed before the drop are kept (and not recorded twice)"
            assert _mirror(db, "binary_sensor.front_contact") == door["state"]
            assert "ha" not in summary_items(c) and report_checks(c)["ha_sync"]["status"] == "ok"
            seen.append({"cycle": cycle, "down_summary": item["label"], "attempts_while_down": ha.attempts - attempts - 1,
                         "threads": own_threads(started_before)})
        # the event loop's executor grows lazily to a plateau and is left out; every other thread must be the same after each cycle
        assert all(x["threads"] == seen[0]["threads"] for x in seen), f"threads change per reconnect: {seen}"
    finally:
        sync.shutdown()
    assert sync.thread is None or not sync.thread.is_alive()
    assert integrity(db) == "ok"
    assert len(_door_events(db)) == 3
    record("D1 HA websocket drop / reconnect x3", cycles=seen, reconnects=ha_sync.STATE.reconnects, sessions=ha.ready, attempts=ha.attempts)


# ======================================================================== D2: the NVR alert stream flaps

def _alert_doc(channel: int, when: dt.datetime) -> bytes:
    return (f"<EventNotificationAlert version=\"2.0\" xmlns=\"http://www.hikvision.com/ver20/XMLSchema\"><channelID>{channel}</channelID>"
            f"<dateTime>{when.isoformat()}</dateTime><activePostCount>1</activePostCount><eventType>VMD</eventType>"
            "<eventState>active</eventState><eventDescription>Motion alarm</eventDescription></EventNotificationAlert>").encode()


HEARTBEAT = (b"<EventNotificationAlert version=\"2.0\" xmlns=\"http://www.hikvision.com/ver20/XMLSchema\"><channelID>1</channelID>"
             b"<dateTime>2026-11-19T10:00:00+02:00</dateTime><activePostCount>0</activePostCount><eventType>videoloss</eventType>"
             b"<eventState>inactive</eventState><eventDescription>videoloss alarm</eventDescription></EventNotificationAlert>")


class _QuickStop(threading.Event):
    """The listener's back-off waits on its stop event: capped so the test sees reconnects in milliseconds."""

    def wait(self, timeout: float | None = None) -> bool:
        return super().wait(0.05 if timeout is None else min(timeout, 0.05))


@pytest.fixture()
def ingest_state_saved():
    st = events_ingest.STATE
    keys = ("connected", "disconnected_since", "last_heartbeat_at", "last_error", "reconnects", "events_stored", "last_event_at")
    saved = {k: getattr(st, k) for k in keys}
    events_ingest.QUEUE.reset()
    yield st
    for k, v in saved.items():
        setattr(st, k, v)
    events_ingest.QUEUE.reset()


def _events(db: Any, where: str = "1=1") -> list[dict[str, Any]]:
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(f"SELECT id, type, channel, details_json FROM events WHERE {where} ORDER BY occurred_at").fetchall()]


def test_d2_nvr_alert_stream_flaps_three_times(settings, monkeypatch, ingest_state_saved):
    """The NVR's alert stream: up (one real alert per phase) -> the stream ends and the NVR stops answering -> back, three
    times. The listener never dies, the summary says "NVR מנותק" while it is down, each outage is one coverage gap, every alert
    stored before an outage is still there afterwards, the queue's accounting invariant holds, and no thread is left over."""
    s = replace(settings, nvr_host="nvr.test", nvr_user="u", nvr_password="p", go2rtc_url="http://go2rtc.test:1984")
    app = create_app(s)
    c = TestClient(app)
    db = app.state.db
    st = ingest_state_saved
    st.connected, st.disconnected_since, st.last_heartbeat_at, st.last_error = False, None, None, None
    monkeypatch.setattr(events_ingest, "GAP_AFTER_S", 0)
    base = dt.datetime.now(dt.timezone(dt.timedelta(hours=2))).replace(microsecond=0) - dt.timedelta(hours=1)
    dev: dict[str, Any] = {"down": False, "phase": 0, "hold": threading.Event(), "requests": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        dev["requests"] += 1
        if dev["down"]:
            raise httpx.ConnectError("no route to host", request=req)
        phase, hold = dev["phase"], dev["hold"]

        def stream():
            yield _alert_doc(phase + 1, base + dt.timedelta(minutes=phase)) + HEARTBEAT + b" " * 4096
            hold.wait(30)  # the NVR keeps the stream open until the test ends this phase

        return httpx.Response(200, content=stream())

    real = httpx.Client
    monkeypatch.setattr(events_ingest.httpx, "Client", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    listener = events_ingest.AlertStreamListener()
    listener.stop = _QuickStop()
    listener.start(db, s, lambda: "Asia/Jerusalem")
    cycles: list[dict[str, Any]] = []
    try:
        threads_up = None
        for phase in range(3):
            wait_for(lambda phase=phase: st.connected and len(_events(db, "type != 'coverage_gap'")) == phase + 1, timeout=10, what=f"phase {phase} up")
            assert "nvr" not in summary_items(c)
            now_threads = threads_named("alertstream")
            threads_up = threads_up or now_threads
            assert now_threads == threads_up, f"listener threads changed: {now_threads}"
            # the fault: the stream ends and the NVR stops answering. A coverage gap is keyed by the second its outage began
            # (a real reconnect takes 5 s and more): each outage of this fast test starts in a second of its own
            wait_for(lambda: int(time.time()) > dev.get("last_down", 0), timeout=3, what="next second")
            dev["last_down"] = int(time.time())
            dev["down"] = True
            dev["hold"].set()
            wait_for(lambda: not st.connected and dev["requests"] >= 2 * phase + 3, timeout=10, what=f"phase {phase} down")
            item = summary_later(c, monkeypatch, 120).get("nvr")  # the summary waits a minute before calling the NVR disconnected
            assert item is not None and item["status"] == "error" and "NVR מנותק" in item["label"], item
            assert listener.thread is not None and listener.thread.is_alive() and listener.writer is not None and listener.writer.is_alive()
            # cleared
            dev["phase"], dev["hold"], dev["down"] = phase + 1, threading.Event(), False
            cycles.append({"phase": phase, "summary": item["label"], "requests": dev["requests"]})
        wait_for(lambda: st.connected and len(_events(db, "type != 'coverage_gap'")) == 4, timeout=10, what="final up")
        assert "nvr" not in summary_items(c)
    finally:
        listener.shutdown()
        dev["hold"].set()
        if listener.thread is not None:
            listener.thread.join(timeout=3)
    alerts = _events(db, "type != 'coverage_gap'")
    gaps = _events(db, "type = 'coverage_gap'")
    assert [a["channel"] for a in alerts] == [1, 2, 3, 4], "every alert stored before an outage is kept"
    assert len(gaps) == 3 and {json.loads(g["details_json"])["reason"] for g in gaps} <= {"ConnectError", "disconnected"}
    q = events_ingest.QUEUE.stats()
    assert q["accepted"] == q["processed"] + q["failed"] + q["coalesced"] + q["dropped"] + q["depth"] and q["failed"] == 0, q
    assert integrity(db) == "ok"
    record("D2 NVR alert stream flaps x3", cycles=cycles, alerts=len(alerts), gaps=[json.loads(g["details_json"])["reason"] for g in gaps], queue=q)


# ======================================================================== D3: go2rtc goes down and comes back empty

class Go2rtcServer:
    """go2rtc's `/api` and `/api/streams` in memory. `down`: every request fails to connect. `restart()`: what a real go2rtc
    restart does to streams added through the API - they are gone (only its YAML streams come back)."""

    def __init__(self, yaml_streams: dict[str, list[str]]) -> None:
        self.yaml = dict(yaml_streams)
        self.store = {k: list(v) for k, v in yaml_streams.items()}
        self.down = False
        self.writes: list[tuple[str, str]] = []

    def restart(self) -> None:
        self.store = {k: list(v) for k, v in self.yaml.items()}

    def handler(self, request: httpx.Request) -> httpx.Response:
        if self.down:
            raise httpx.ConnectError("connection refused", request=request)
        if request.url.path == "/api":
            return httpx.Response(200, json={"version": "1.9.15"})
        name = request.url.params.get("name") or request.url.params.get("src")
        if request.method == "GET":
            return httpx.Response(200, json={n: {"producers": [{"url": u} for u in srcs], "consumers": None} for n, srcs in self.store.items()})
        if request.method == "DELETE":
            self.writes.append(("DELETE", name))
            self.store.pop(name, None)
            return httpx.Response(200)
        if request.method == "PUT":
            self.writes.append(("PUT", name))
            self.store[name] = [request.url.params["src"]]
            return httpx.Response(200)
        return httpx.Response(405)


def test_d3_go2rtc_down_then_back_empty_streams_restored(settings, monkeypatch):
    """The stream sync with the real go2rtc adapter: synced -> go2rtc down (the sync fails without raising, the summary and the
    report say so, the camera list is kept) -> go2rtc back but EMPTY after its restart -> the next periodic sync writes our
    streams again and the health clears. The intercom project's stream is never written or deleted."""
    s = replace(settings, nvr_host="nvr.test", nvr_user="u", nvr_password="p", go2rtc_url="http://go2rtc.test:1984")
    server = Go2rtcServer({"intercom_door_1": ["rtsp://door.invalid/1"]})
    real_client_for = g2.Go2rtc._client_for
    monkeypatch.setattr(g2.Go2rtc, "_client_for", lambda self, timeout_s: httpx.Client(base_url=self.base, transport=httpx.MockTransport(server.handler),
                                                                                     timeout=timeout_s, event_hooks=g2._REACH_HOOKS))
    assert real_client_for is not None
    monkeypatch.setattr(nvr, "device_info", lambda _s: {"model": "DS-7616", "firmware": "V4.84", "device_type": "NVR"})
    monkeypatch.setattr(nvr, "discover_channels", lambda _s: [nvr.DiscoveredChannel(channel=1, name="Entrance", online=True, main_track=101, sub_track=102),
                                                              nvr.DiscoveredChannel(channel=2, name="Yard", online=True, main_track=201, sub_track=202)])
    monkeypatch.setattr(nvr, "fetch_stream_encodings", lambda _s: {})
    with g2._SOURCE_DIGEST_LOCK:
        g2._SOURCE_DIGEST.clear()
    app = create_app(s)
    c = TestClient(app)
    db = app.state.db
    autosync.run_once(db, s, reason="startup")
    ours = sorted(n for n in server.store if n.startswith(g2.STREAM_PREFIX))
    assert len(ours) == 4 and autosync.STATE["streams_last_error"] is None
    cams_before = c.get("/api/v1/cameras").json()["cameras"]

    server.down = True
    autosync.run_once(db, s, reason="periodic")  # never raises
    items = summary_items(c)
    report = report_checks(c)
    assert autosync.STATE["streams_last_error"] == "media_unavailable"
    assert "go2rtc" in items or "video_service" in items, items
    assert report["go2rtc"]["status"] == "error", report["go2rtc"]
    assert len(c.get("/api/v1/cameras").json()["cameras"]) == len(cams_before), "the camera list is kept"

    server.down = False
    server.restart()  # back, but our streams are gone
    assert not [n for n in server.store if n.startswith(g2.STREAM_PREFIX)]
    autosync.run_once(db, s, reason="periodic")
    healed = summary_items(c)
    assert sorted(n for n in server.store if n.startswith(g2.STREAM_PREFIX)) == ours, "every stream of ours is written again"
    assert autosync.STATE["streams_last_error"] is None and "go2rtc" not in healed and "video_service" not in healed, healed
    assert report_checks(c)["go2rtc"]["status"] == "ok"
    assert server.store["intercom_door_1"] == ["rtsp://door.invalid/1"]
    assert not [w for w in server.writes if not w[1].startswith(g2.STREAM_PREFIX)], "no write outside the smplwise_ namespace"
    # a further sync with everything in place writes nothing
    writes = len(server.writes)
    autosync.run_once(db, s, reason="periodic")
    assert len(server.writes) == writes
    record("D3 go2rtc down, back empty", streams=len(ours), down_summary=items.get("video_service") or items.get("go2rtc"),
           down_report=report["go2rtc"]["detail"], rewritten=len(ours), foreign_untouched=True)


# ======================================================================== F1: SQLite refuses writes under the background writers

def _alert(ch: int, when: dt.datetime) -> events_ingest.ParsedAlert:
    return events_ingest.ParsedAlert(raw_type="VMD", state="active", channel=ch, dyn_channel=None, device_time=when.isoformat(), description="Motion alarm",
                                     target="", active_post_count=1)


def test_f1_sqlite_full_under_the_background_writers(settings, monkeypatch, full_disk, ingest_state_saved, caplog):
    """SQLite answers SQLITE_FULL to every write while the disk is full. The alert writer and the HA state handler keep running
    (each failure counted / raised as storage-full, never a crash), the API still reads, a write answers 507, the summary says the
    disk is full. Once space is freed the same writers store again, every row committed before the fault is still there and
    the database is intact."""
    monkeypatch.setattr(dbmod, "STORAGE_REFUSAL_WINDOW_S", 1.0)  # the "writes are refused" warning outlives the fault by this long (T068-EDGE-2450)
    s = replace(settings, nvr_host="nvr.test", nvr_user="u", nvr_password="p")
    app = create_app(s)
    c = TestClient(app)
    db = app.state.db
    db.invalidate_pool()  # every connection from here on is opened through the shim
    q = events_ingest.IngestQueue()
    listener = events_ingest.AlertStreamListener(recorder_id="nvr-edge", state=events_ingest.IngestState(), ingest_queue=q)
    listener.db, listener.settings, listener.tz_getter = db, s, lambda: "Asia/Jerusalem"
    listener.writer = threading.Thread(target=listener._drain, args=(listener.generation,), name="alertstream-writer-edge", daemon=True)
    listener.writer.start()
    t0 = dt.datetime.now(dt.timezone(dt.timedelta(hours=2))).replace(microsecond=0) - dt.timedelta(hours=2)
    try:
        # healthy
        for i in range(2):
            listener.submit(_alert(i + 1, t0 + dt.timedelta(minutes=i)))
        ha_sync.on_state_changed(db, {"entity_id": "light.edge", "old_state": None, "new_state": _state("light.edge", "on", "2026-11-19T09:00:00+00:00")})
        wait_for(lambda: q.stats()["processed"] == 2, timeout=5, what="healthy alerts stored")
        committed = _events(db)
        assert len(committed) == 2 and _mirror(db, "light.edge") == "on"
        assert c.get("/api/v1/events").status_code == 200  # the operator was here before (the first request of an installation writes its grant)

        # the fault
        full_disk["full"] = True
        caplog.clear()
        for i in range(5):
            listener.submit(_alert(i + 3, t0 + dt.timedelta(minutes=10 + i)))
        wait_for(lambda: q.stats()["failed"] == 5, timeout=10, what="alerts refused while full")
        assert listener.writer.is_alive(), "the alert writer survives SQLITE_FULL"
        with pytest.raises(sqlite3.OperationalError) as exc_info:
            ha_sync.on_state_changed(db, {"entity_id": "light.edge", "old_state": None, "new_state": _state("light.edge", "off", "2026-11-19T09:01:00+00:00")})
        assert dbmod.is_storage_full(exc_info.value), "the HA handler's failure is a storage-full error (the session logs it and goes on)"
        listed = c.get("/api/v1/events")
        assert listed.status_code == 200, "reads keep working on a full disk"
        write = c.patch("/api/v1/settings", json={"storage.min_free_mb": 900})
        assert write.status_code == 507 and write.json()["code"] == "storage_full", write.text
        storage = summary_items(c).get("storage")
        assert storage is not None and storage["status"] == "error", storage
        error_lines = sum(1 for r in caplog.records if r.levelname == "ERROR" and "alert handling failed" in r.getMessage())

        # cleared
        full_disk["full"] = False
        db.invalidate_pool()
        for i in range(2):
            listener.submit(_alert(i + 20, t0 + dt.timedelta(minutes=30 + i)))
        wait_for(lambda: q.stats()["processed"] == 4, timeout=5, what="stored again once space is freed")
        ha_sync.on_state_changed(db, {"entity_id": "light.edge", "old_state": None, "new_state": _state("light.edge", "off", "2026-11-19T09:02:00+00:00")})
    finally:
        listener.stop.set()
        listener.generation += 1
        listener.writer.join(timeout=8)
    after = _events(db)
    assert {e["id"] for e in committed} <= {e["id"] for e in after}, "rows committed before the fault are kept"
    assert len(after) == 4 and _mirror(db, "light.edge") == "off"
    wait_for(lambda: "storage" not in summary_items(c), timeout=10, what="the storage warning clears once the refusals stop")
    assert c.patch("/api/v1/settings", json={"storage.min_free_mb": 900}).status_code == 200
    stats = q.stats()
    assert stats["accepted"] == stats["processed"] + stats["failed"] + stats["coalesced"] + stats["dropped"] + stats["depth"], stats
    assert integrity(db) == "ok"
    record("F1 SQLite full: background writers", queue=stats, error_log_lines_while_full=error_lines, api_write=[write.status_code, write.json()["code"]],
           summary_item=storage, rows_before=len(committed), rows_after=len(after))


def test_f1b_a_full_disk_does_not_flood_the_log(settings, monkeypatch, full_disk, ingest_state_saved, caplog):
    """The writers that run all the time - the NVR alert writer (~6 alerts/s in the soak) and the Home Assistant state feed
    (~20 changes/s) - on a full disk: each refused write must not log a traceback (tens of lines, several times a second, onto
    the disk that is already full, burying every other message). One plain line per writer per minute says the disk is full
    and how many writes it refused; the counters keep the exact numbers; nothing else changes."""
    monkeypatch.setattr(ha_sync, "BACKOFF_START_S", 0.05)
    s = replace(settings, nvr_host="nvr.test", nvr_user="u", nvr_password="p", ha_url="http://ha.test:8123", ha_token="edge-token")
    app = create_app(s)
    db = app.state.db
    db.invalidate_pool()
    ha = ScriptedHa()
    monkeypatch.setattr(ha_client, "ws_session", ha.ws_session)
    sync = ha_sync.HaSync()
    q = events_ingest.IngestQueue()
    listener = events_ingest.AlertStreamListener(recorder_id="nvr-edge", state=events_ingest.IngestState(), ingest_queue=q)
    listener.db, listener.settings, listener.tz_getter = db, s, lambda: "Asia/Jerusalem"
    listener.writer = threading.Thread(target=listener._drain, args=(listener.generation,), name="alertstream-writer-edge", daemon=True)
    listener.writer.start()
    t0 = dt.datetime.now(dt.timezone(dt.timedelta(hours=2))).replace(microsecond=0) - dt.timedelta(hours=2)
    sync.start(db, s)
    try:
        wait_for(lambda: ha_sync.STATE.connected, timeout=10, what="HA connected")
        full_disk["full"] = True
        caplog.clear()
        for i in range(20):
            listener.submit(_alert(i + 1, t0 + dt.timedelta(minutes=i)))
            ha.events.put({"entity_id": "light.office", "old_state": None, "new_state": _state("light.office", f"s{i}", f"2026-11-19T09:{i:02d}:00+00:00")})
        wait_for(lambda: q.stats()["failed"] == 20 and ha.events.empty(), timeout=10, what="all refused")
        time.sleep(0.2)  # the last state taken off the queue is handled
        assert sync.thread is not None and sync.thread.is_alive() and ha_sync.STATE.connected, "a refused state write does not end the HA session"
        records = [r for r in caplog.records if r.name in ("smplwise.events", "smplwise.ha")]
        tracebacks = [r for r in records if r.exc_info]
        full_lines = [r.getMessage() for r in records if "data disk is full" in r.getMessage()]
        full_disk["full"] = False
        db.invalidate_pool()
        ha.events.put({"entity_id": "light.office", "old_state": None, "new_state": _state("light.office", "after", "2026-11-19T10:00:00+00:00")})
        listener.submit(_alert(40, t0 + dt.timedelta(minutes=60)))
        wait_for(lambda: q.stats()["processed"] == 1 and _mirror(db, "light.office") == "after", timeout=5, what="stored again")
    finally:
        sync.shutdown()
        listener.stop.set()
        listener.generation += 1
        listener.writer.join(timeout=8)
    assert not tracebacks, f"{len(tracebacks)} tracebacks for refused writes: {[r.getMessage() for r in tracebacks][:3]}"
    assert 1 <= len(full_lines) <= 2, full_lines
    record("F1b full disk: no log flood", refused_alerts=20, refused_states=20, log_lines=full_lines, tracebacks=len(tracebacks))


# ======================================================================== F2 / F3: the export folder fills up

RANGE = {"from_at": "2026-09-14T07:00:00Z", "to_at": "2026-09-14T07:10:00Z"}


def _job(c: TestClient, job_id: str) -> dict[str, Any]:
    return c.get(f"/api/v1/exports/{job_id}").json()


def test_f2_export_folder_full_while_writing_a_file(lab, monkeypatch):  # noqa: F811
    """The disk fills faster than the free-space check: the write of the second file fails with ENOSPC. The job pauses (it
    does not fail), the partial file is removed, the storage screen and the report show the paused job; when space is back the
    worker resumes it on its own and it completes. An export finished before the fault keeps its file and checksum."""
    c, s, cam = lab
    monkeypatch.setattr(ex, "ffmpeg_path", lambda: None)
    monkeypatch.setattr(ex, "PAUSE_BACKOFF_S", (0,))
    monkeypatch.setattr(ex, "RESUME_MARGIN_MB", 1)
    c.patch("/api/v1/settings", json={"storage.min_free_mb": 10})
    monkeypatch.setattr(ex.shutil, "disk_usage", lambda _p: Usage(100_000 * MB, 99_000 * MB, 1_000 * MB))  # the check sees room throughout
    state = {"full": False}

    def downloader(_settings, playback_uri, dest, progress=None):
        name = playback_uri.split("name=")[1].split("&")[0]
        with open(dest, "wb") as f:
            f.write(b"\x00\x00\x01\xba" + name.encode() * 64)
            if state["full"] and name == "f2":
                raise enospc(dest)
        if progress:
            progress(Path(dest).stat().st_size)

    ex.WORKER.downloader = downloader
    first = c.post("/api/v1/exports", json={"camera_id": cam["id"], **RANGE}).json()
    assert ex.WORKER.run_pending() == 1
    first = _job(c, first["id"])
    assert first["state"] == "done", first
    first_file = ex.output_path(s, first)
    first_bytes = first_file.read_bytes()

    state["full"] = True
    job = c.post("/api/v1/exports", json={"camera_id": cam["id"], **RANGE}).json()
    ex.WORKER.run_pending()
    j = _job(c, job["id"])
    assert j["state"] == ex.PAUSED and "הושהה" in (j["error"] or ""), j
    assert [f["state"] for f in j["files"]] == ["downloaded", "pending"]
    assert not (ex.job_dir(s, job["id"]) / "001.ps").exists(), "the partial file is not kept"
    assert c.get("/api/v1/storage/local").json()["exports"]["paused_disk_full"] == 1
    assert report_checks(c)["exports"]["status"] == "warn"

    state["full"] = False
    ex.WORKER.run_pending()
    j = _job(c, job["id"])
    assert j["state"] == "done" and j["download_ready"], j
    assert report_checks(c)["exports"]["status"] == "ok"
    assert first_file.read_bytes() == first_bytes and _job(c, first["id"])["sha256"] == first["sha256"], "the earlier export is untouched"
    record("F2 export folder full while writing", paused=True, resumed_to=j["state"], partial_removed=True, earlier_export_intact=True)


def test_f3_export_folder_full_while_finishing(lab, monkeypatch):  # noqa: F811
    """Every file is downloaded, then the disk fills while the export is being finished (the manifest cannot be written). The
    job must pause like any other full-disk stop and complete on its own once space is back - not end as an internal error that
    asks the operator to create the export again."""
    c, s, cam = lab
    monkeypatch.setattr(ex, "ffmpeg_path", lambda: None)
    monkeypatch.setattr(ex, "PAUSE_BACKOFF_S", (0,))
    monkeypatch.setattr(ex, "RESUME_MARGIN_MB", 1)
    c.patch("/api/v1/settings", json={"storage.min_free_mb": 10})
    monkeypatch.setattr(ex.shutil, "disk_usage", lambda _p: Usage(100_000 * MB, 99_000 * MB, 1_000 * MB))

    def downloader(_settings, playback_uri, dest, progress=None):
        Path(dest).write_bytes(b"\x00\x00\x01\xba" + b"z" * 300)
        if progress:
            progress(Path(dest).stat().st_size)

    ex.WORKER.downloader = downloader
    state = {"full": True}
    real_write_text = Path.write_text

    def write_text(self: Path, *a: Any, **k: Any) -> int:
        if state["full"] and self.name == "manifest.json":
            raise enospc(self)
        return real_write_text(self, *a, **k)

    monkeypatch.setattr(Path, "write_text", write_text)
    job = c.post("/api/v1/exports", json={"camera_id": cam["id"], **RANGE}).json()
    ex.WORKER.run_pending()
    j = _job(c, job["id"])
    assert j["state"] == ex.PAUSED, f"a full disk while finishing must pause the export, got {j['state']}: {j.get('error')}"
    assert "הושהה" in (j["error"] or "")
    leftovers = sorted(p.name for p in ex.job_dir(s, job["id"]).iterdir()) if ex.job_dir(s, job["id"]).exists() else []
    assert "manifest.json" not in leftovers

    state["full"] = False
    ex.WORKER.run_pending()
    j = _job(c, job["id"])
    assert j["state"] == "done" and j["download_ready"] and j["sha256"], j
    m = c.get(f"/api/v1/exports/{job['id']}/manifest").json()
    assert m["output"]["sha256"] == j["sha256"]
    record("F3 export folder full while finishing", paused=True, leftovers_while_paused=leftovers, resumed_to=j["state"])


# ======================================================================== F4: the thumbnails folder is full

def test_f4_thumbnail_folder_full_worker_survives_and_recovers(settings, monkeypatch):
    """Event pictures (evidence thumbnails) on a full disk: the grab fails and even the failure marker cannot be written. The
    worker thread survives and records why; once space is back a new request produces the picture."""
    s = replace(settings, nvr_host="nvr.test", nvr_user="u", nvr_password="p")
    app = create_app(s)
    db = app.state.db
    c = TestClient(app)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "edge"}).json()
    with db.connection() as conn:
        conn.execute("UPDATE cameras SET main_track = 101 WHERE id = ?", (cam["id"],))
        row = conn.execute("SELECT * FROM cameras WHERE id = ?", (cam["id"],)).fetchone()
        ev = events_ingest.store_alert(conn, _alert(1, dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=1)), "Asia/Jerusalem", lambda ch: row)
    eid = ev["id"]
    state = {"full": True}

    def grab(_url: str, out: Path, _settings: Any, timeout_s: int = 40) -> bool:
        if state["full"]:
            thumbnails.STATE["last_error"] = "No space left on device"
            return False
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(b"\xff\xd8\xff\xd9")
        return True

    real_write_text = Path.write_text

    def write_text(self: Path, *a: Any, **k: Any) -> int:
        if state["full"] and self.suffix == ".unavailable":
            raise enospc(self)
        return real_write_text(self, *a, **k)

    monkeypatch.setattr(thumbnails, "_grab", grab)
    monkeypatch.setattr(Path, "write_text", write_text)
    monkeypatch.setattr(thumbnails.playback, "playback_rtsp_url", lambda *a, **k: "rtsp://nvr.test/playback")
    saved = dict(thumbnails.STATE)
    worker = thumbnails.ThumbnailWorker()
    worker.start_with(db, s)
    try:
        assert worker.request(s, [eid]) == 1
        wait_for(lambda: thumbnails.STATE["busy"] is None and not worker.is_pending(eid) and thumbnails.STATE["last_error"] == "OSError", timeout=5, what="failed on a full disk")
        assert worker.is_alive(), "the thumbnail worker survives a full disk"
        assert thumbnails.status_for(s, eid) == "none", "no failure marker: the picture is asked again"
        state["full"] = False
        assert worker.request(s, [eid]) == 1
        wait_for(lambda: thumbnails.status_for(s, eid) == "ready", timeout=5, what="picture once space is back")
    finally:
        worker.stop_evt.set()
        worker.join(timeout=3)
        thumbnails.STATE.clear()
        thumbnails.STATE.update(saved)
    record("F4 thumbnails folder full", worker_alive=True, recovered=True)


# ======================================================================== F5: crash guard files and log rotation on a full disk

def test_f5_crash_guard_on_a_full_disk_keeps_restarting(tmp_path, monkeypatch):
    """The crash guard's state file cannot be written (full disk): the supervisor still restarts the crashed server, and once
    space is back the record is written again."""
    state = {"full": True}
    real_write_text = Path.write_text

    def write_text(self: Path, *a: Any, **k: Any) -> int:
        if state["full"] and self.parent.name == "crash":
            raise enospc(self)
        return real_write_text(self, *a, **k)

    monkeypatch.setattr(Path, "write_text", write_text)
    codes = [-11, -11, 0]
    logs: list[str] = []

    class Child:
        def __init__(self, code: int) -> None:
            self.code = code

        def wait(self) -> int:
            return self.code

        def poll(self) -> int:
            return self.code

    sup = cg.Supervisor(tmp_path, ["python", "-m", "smplwise"], spawn=lambda env: Child(codes.pop(0)), sleep=lambda s, ev: None, log=logs.append, base_env={"PATH": "x"})
    assert sup.run() == 0 and sup.restarts == 2, "both crashes restarted although nothing could be recorded"
    assert cg.read_state(tmp_path) == {}
    state["full"] = False
    cg.record_crash(tmp_path, 11, 5.0, False)
    assert cg.state_view(tmp_path)["count_total"] == 1
    record("F5 crash guard on a full disk", restarts=sup.restarts, recorded_after_space_freed=True)


def test_f6_fault_log_rotation_on_a_full_disk_falls_back_to_stderr(tmp_path, monkeypatch):
    """The faulthandler log is cut back (rotated) when it grows past its cap; when the cut cannot be written (full disk) the
    server still starts, with the fault handler on stderr. Once space is back the next start cuts the log and uses the file."""
    p = cg.fault_log_path(tmp_path)
    p.parent.mkdir(parents=True)
    p.write_bytes(b"x" * (cg.FAULT_LOG_MAX_BYTES + 1000))
    code = ("import sys, errno, pathlib; sys.path.insert(0, {backend!r}); from smplwise import crashguard\n"
            "full = {full}\n"
            "real = pathlib.Path.write_bytes\n"
            "def wb(self, data):\n"
            "    if full: raise OSError(errno.ENOSPC, 'No space left on device')\n"
            "    return real(self, data)\n"
            "pathlib.Path.write_bytes = wb\n"
            "print('FILE' if crashguard.enable_faulthandler(pathlib.Path({data!r})) else 'STDERR')\n")
    out = subprocess.run([sys.executable, "-c", code.format(backend=str(BACKEND), data=str(tmp_path), full=True)], capture_output=True, text=True, timeout=60)
    assert out.returncode == 0 and out.stdout.strip() == "STDERR", (out.stdout, out.stderr[-500:])
    out = subprocess.run([sys.executable, "-c", code.format(backend=str(BACKEND), data=str(tmp_path), full=False)], capture_output=True, text=True, timeout=60)
    assert out.returncode == 0 and out.stdout.strip() == "FILE", (out.stdout, out.stderr[-500:])
    assert p.stat().st_size < cg.FAULT_LOG_MAX_BYTES and cg.RUN_MARKER in p.read_text(encoding="utf-8", errors="replace")
    record("F6 fault log rotation on a full disk", full_disk="stderr fallback", after="cut back and file used")


def _soak_long():
    soak_dir = str(Path(__file__).parent / "soak")
    if soak_dir not in sys.path:
        sys.path.insert(0, soak_dir)
    import soak_long

    return soak_long


CHATTY_CHILD = ("import sys\n"
                "for i in range(4000):\n"
                "    sys.stdout.write(f'line {i:05d} ' + 'x' * 200 + '\\n'); sys.stdout.flush()\n")


def test_f7_soak_backend_log_rotation_and_a_full_log_disk(tmp_path):
    """The soak harness writes the backend's output through a rotating pump. A child that logs all the time: (a) the live log
    and its kept copies stay under the cap, at most `keep` copies exist, the newest lines are kept and every kept line is whole;
    (b) while the log cannot be written (a full disk) the pump keeps draining the pipe - the child is never blocked - and counts
    what it dropped; once writing works again the log continues."""
    soak_long = _soak_long()
    log = tmp_path / "backend.log"
    child = subprocess.Popen([sys.executable, "-c", CHATTY_CHILD], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    pump = soak_long.LogPump(child.stdout, log, max_bytes=64 * 1024, keep=2)
    pump.start()
    assert child.wait(timeout=60) == 0
    pump.join(10)
    assert not pump.is_alive() and pump.rotations >= 3 and pump.write_errors == 0, pump.stats()
    kept = sorted(p.name for p in tmp_path.iterdir() if p.name.startswith("backend.log."))
    assert kept == ["backend.log.1", "backend.log.2"], kept
    for p in [log, *(tmp_path / k for k in kept)]:
        data = p.read_bytes()
        assert len(data) <= 64 * 1024 and data.endswith(b"\n")
        assert all(re.fullmatch(rb"line \d{5} x{200}\r?", ln) for ln in data.split(b"\n")[:-1]), p.name
    assert b"line 03999" in log.read_bytes(), "the newest lines are in the live log"

    # (b) the log's disk is full for the first 1000 lines
    log2 = tmp_path / "b2" / "backend.log"
    log2.parent.mkdir()
    child = subprocess.Popen([sys.executable, "-c", CHATTY_CHILD], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    pump2 = soak_long.LogPump(child.stdout, log2, max_bytes=0, keep=2)
    real_open = pump2._open
    seen = {"n": 0}

    def open_on_a_full_disk() -> None:
        seen["n"] += 1
        if seen["n"] <= 1000:
            raise OSError(errno.ENOSPC, "No space left on device")
        real_open()

    pump2._open = open_on_a_full_disk  # type: ignore[method-assign]
    pump2.start()
    assert child.wait(timeout=60) == 0, "the child is never blocked by a log that cannot be written"
    pump2.join(10)
    lines = log2.read_bytes().split(b"\n")[:-1]
    assert pump2.write_errors == 1000 and len(lines) == 3000 and lines[0].startswith(b"line 01000"), (pump2.stats(), len(lines))
    record("F7 soak backend log rotation / full log disk", rotations=pump.rotations, kept=kept, dropped_while_full=pump2.stats())


def test_f8_soak_disk_guard_stops_the_run_when_the_disk_is_low(tmp_path, monkeypatch):
    """The soak harness ends the run (reason `disk_low`) when the run folder's file system has less free space than
    --min-free-mb, before the runner's disk fills (the runner reached 100 % on 2026-11-18)."""
    soak_long = _soak_long()
    a = soak_long.parse(["--run-dir", str(tmp_path / "run"), "--minutes", "1", "--min-free-mb", "500"])
    soak = soak_long.Soak(a)
    monkeypatch.setattr(soak_long.shutil, "disk_usage", lambda _p: Usage(10_000 * MB, 9_600 * MB, 400 * MB))
    prev: dict[str, Any] = {}
    soak.guard({"host_mem_avail_mb": 4000, "rss_mb": 100}, prev)
    assert soak.stop.is_set() and soak.reason == "disk_low"
    soak2 = soak_long.Soak(soak_long.parse(["--run-dir", str(tmp_path / "run2"), "--minutes", "1", "--min-free-mb", "500"]))
    monkeypatch.setattr(soak_long.shutil, "disk_usage", lambda _p: Usage(10_000 * MB, 9_000 * MB, 1_000 * MB))
    soak2.guard({"host_mem_avail_mb": 4000, "rss_mb": 100}, {})
    assert not soak2.stop.is_set()
    record("F8 soak disk guard", reason=soak.reason)
