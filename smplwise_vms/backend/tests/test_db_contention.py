"""Opt-in SQLite contention load test for the round-10 "database is locked" storm (docs/operations/
TEST_ROUND_RESULTS_2026-09-26_ROUND10_HE.md, section 2). Skipped unless SW_DB_LOAD=1, so the normal suite stays fast.

    SW_DB_LOAD=1 [SW_DB_LOAD_S=90] [SW_DB_LOAD_SLOW=1] python -m pytest tests/test_db_contention.py -s -p no:cacheprovider -o addopts=""

What runs at the same time for SW_DB_LOAD_S seconds against a temporary database, through the product's own code:
- ha_state (2 threads): Home Assistant state_changed pushes (upsert_state + record_transition + rule evaluation),
  about 40 events/s - a busy HA with power sensors;
- alertstream: NVR alerts through events_ingest.LISTENER._handle (every tenth one a person detection that fires an
  ha_notify rule);
- audit: refusal-style audit rows from read-mode connections (write_aside);
- http_read (3 threads) and http_write: real API requests through the ASGI app (cameras, events, settings);
- exporter: POST /exports (the NVR file search) + DELETE, every few seconds;
- derive: events_derive.run_once (the periodic recording search over every camera);
- recorder: manual recording start/stop (an NVR PUT each);
- probe: a tiny write every 50 ms that measures how long an innocent writer waits for the write lock.

SW_DB_LOAD_SLOW=1 (default) gives the fakes realistic device latencies (NVR search page 2.5 s, NVR PUT 1.5 s, HA notify
4 s; override with SW_DB_LOAD_SEARCH_S / SW_DB_LOAD_PUT_S / SW_DB_LOAD_NOTIFY_S); SW_DB_LOAD_SLOW=0 makes every device answer at once, which measures pure SQLite contention. No NVR, no HA, no
network: every device is faked. The summary is printed (-s) and written to SW_DB_LOAD_OUT when set."""
from __future__ import annotations

import datetime as dt
import json
import os
import random
import sqlite3
import statistics
import threading
import time
from dataclasses import dataclass, field, replace
from typing import Any, Callable

import httpx
import pytest
from fastapi.testclient import TestClient

from smplwise import audit as audit_mod
from smplwise.db import Database, new_id, now_iso, set_setting
from smplwise.main import create_app
from smplwise.services import events_derive, events_ingest, ha_sync, nvr, nvr_write, recordings
from smplwise.services import rules as rules_svc

pytestmark = pytest.mark.skipif(os.environ.get("SW_DB_LOAD") != "1", reason="opt-in load test (SW_DB_LOAD=1)")

DURATION_S = float(os.environ.get("SW_DB_LOAD_S", "90"))
SLOW = os.environ.get("SW_DB_LOAD_SLOW", "1") != "0"
SEARCH_PAGE_S = float(os.environ.get("SW_DB_LOAD_SEARCH_S", "2.5")) if SLOW else 0.0
NVR_PUT_S = float(os.environ.get("SW_DB_LOAD_PUT_S", "1.5")) if SLOW else 0.0
HA_NOTIFY_S = float(os.environ.get("SW_DB_LOAD_NOTIFY_S", "4")) if SLOW else 0.0
TZ = "Asia/Jerusalem"
CAMERAS = 4

SEARCH_XML = """<?xml version="1.0" encoding="UTF-8"?>
<CMSearchResult><searchID>x</searchID><responseStatus>true</responseStatus><responseStatusStrg>OK</responseStatusStrg>
<numOfMatches>{n}</numOfMatches><matchList>{items}</matchList></CMSearchResult>"""
ITEM = """<searchMatchItem><trackID>{track}</trackID><timeSpan><startTime>{start}</startTime><endTime>{end}</endTime></timeSpan>
<mediaSegmentDescriptor><contentType>video</contentType><codecType>H.264-BP</codecType>
<playbackURI>rtsp://nvr.local:554/Streaming/tracks/{track}/?starttime={s2}&amp;endtime={e2}&amp;name=f{i}&amp;size={size}</playbackURI>
</mediaSegmentDescriptor><metadataMatches><metadataDescriptor>recordType.meta.hikvision.com/{kind}</metadataDescriptor></metadataMatches></searchMatchItem>"""


@dataclass
class Stat:
    name: str
    ops: int = 0
    locked: int = 0
    other: int = 0
    other_kinds: dict[str, int] = field(default_factory=dict)
    lat: list[float] = field(default_factory=list)
    lock = threading.Lock()

    def ok(self, secs: float) -> None:
        with self.lock:
            self.ops += 1
            self.lat.append(secs)

    def fail(self, secs: float, exc: BaseException | str) -> None:
        text = exc if isinstance(exc, str) else f"{type(exc).__name__}: {exc}"
        with self.lock:
            self.ops += 1
            self.lat.append(secs)
            if "locked" in text.lower():
                self.locked += 1
            else:
                self.other += 1
                key = text[:80]
                self.other_kinds[key] = self.other_kinds.get(key, 0) + 1

    def summary(self) -> dict[str, Any]:
        lat = sorted(self.lat) or [0.0]
        return {"actor": self.name, "ops": self.ops, "locked": self.locked, "other_errors": self.other, "p50_s": round(statistics.median(lat), 3),
                "p95_s": round(lat[int(0.95 * (len(lat) - 1))], 3), "max_s": round(lat[-1], 3), "other_kinds": self.other_kinds}


def _search_page(track: int, n: int = 3) -> str:
    base = dt.datetime.now(dt.timezone.utc).replace(microsecond=0) - dt.timedelta(hours=1)
    items = []
    for i in range(n):
        s = base + dt.timedelta(minutes=5 * i)
        e = s + dt.timedelta(minutes=2)
        sw, ew = s.strftime("%Y-%m-%dT%H:%M:%SZ"), e.strftime("%Y-%m-%dT%H:%M:%SZ")
        items.append(ITEM.format(track=track, start=sw, end=ew, s2=sw.replace("-", "").replace(":", ""), e2=ew.replace("-", "").replace(":", ""), i=i, size=1000 * (i + 1), kind="MOTION"))
    return SEARCH_XML.format(n=n, items="\n".join(items))


def slow_search(_settings, track_id, start_wall, end_wall, position=0, page_size=40, search_id=None):
    time.sleep(SEARCH_PAGE_S)
    return nvr.parse_search_response(_search_page(int(track_id)), int(track_id))


class SlowNvr:
    def handler(self, request: httpx.Request) -> httpx.Response:
        time.sleep(NVR_PUT_S)
        return httpx.Response(200, text='<?xml version="1.0"?><ResponseStatus><statusCode>1</statusCode><statusString>OK</statusString></ResponseStatus>')

    def client(self, _settings=None) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self.handler), base_url="http://nvr")


def _state_event(eid: str, old: str, new: str, device_class: str | None) -> dict[str, Any]:
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    attrs = {"friendly_name": eid, **({"device_class": device_class} if device_class else {})}
    return {"entity_id": eid, "old_state": {"entity_id": eid, "state": old, "attributes": attrs, "last_changed": now, "last_updated": now},
            "new_state": {"entity_id": eid, "state": new, "attributes": attrs, "last_changed": now, "last_updated": now}}


def _handle_state_event(db: Database, data: dict[str, Any]) -> None:
    """The HA sync's state_changed path: the module function when it exists, else the same steps as the 0.1.126 closure."""
    fn: Callable[..., Any] | None = getattr(ha_sync, "handle_state_event", None)
    if fn is not None:
        fn(db, data)
        return
    from smplwise.services.correlation import record_transition

    with db.connection() as conn:
        ha_sync.upsert_state(conn, data["new_state"])
        transition = record_transition(conn, data.get("old_state"), data["new_state"])
        if transition:
            rules_svc.evaluate_event(conn, transition)


def test_sqlite_contention_under_mixed_load(settings, monkeypatch):
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p")
    app = create_app(s)
    db: Database = app.state.db
    boot = TestClient(app)
    cams = [boot.post("/api/v1/cameras", json={"channel": ch, "alias": f"cam{ch}"}).json() for ch in range(1, CAMERAS + 1)]
    with db.connection() as conn:
        for i, cam in enumerate(cams):
            conn.execute("UPDATE cameras SET main_track = ? WHERE id = ?", ((i + 1) * 100 + 1, cam["id"]))
        now = now_iso()
        conn.execute(
            "INSERT INTO rules(id, name, trigger_json, scope_json, window_json, cooldown_s, actions_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (new_id(), "person -> phone", json.dumps({"types": ["person"], "sources": [], "severity_min": "info"}), "{}", json.dumps({"kind": "always"}), 60,
             json.dumps([{"kind": "ha_notify", "service": "mobile_app_phone", "message": "person"}]), now, now),
        )
    recordings.invalidate()
    monkeypatch.setattr(nvr, "search_recordings", slow_search)
    monkeypatch.setattr(nvr_write, "_client", SlowNvr().client)
    notified: list[float] = []

    def slow_notify(service: str, message: str, title: str) -> str:
        time.sleep(HA_NOTIFY_S)
        notified.append(time.time())
        return "sent"

    monkeypatch.setattr(rules_svc, "HA_NOTIFY", slow_notify)
    monkeypatch.setattr(events_ingest.LISTENER, "db", db)
    monkeypatch.setattr(events_ingest.LISTENER, "settings", s)
    monkeypatch.setattr(events_ingest.LISTENER, "tz_getter", lambda: TZ)

    stats: dict[str, Stat] = {}
    stop = threading.Event()
    deadline = time.monotonic() + DURATION_S

    def actor(name: str, pause: float, step: Callable[[int], None]):
        st = stats.setdefault(name, Stat(name))

        def run() -> None:
            i = 0
            while not stop.is_set() and time.monotonic() < deadline:
                t0 = time.perf_counter()
                try:
                    step(i)
                    st.ok(time.perf_counter() - t0)
                except Exception as exc:  # noqa: BLE001 - counted, never fatal
                    st.fail(time.perf_counter() - t0, exc)
                i += 1
                if pause:
                    stop.wait(pause * (0.5 + random.random()))
        return threading.Thread(target=run, name=f"load-{name}", daemon=True)

    def ha_state(offset: int) -> Callable[[int], None]:
        def step(i: int) -> None:
            if i % 4 == 0:
                eid = f"binary_sensor.motion_{offset}_{i % 3}"
                on = (i // 4) % 2 == 0
                _handle_state_event(db, _state_event(eid, "off" if on else "on", "on" if on else "off", "motion"))
            else:
                eid = f"sensor.power_{offset}_{i % 7}"
                _handle_state_event(db, _state_event(eid, str(i - 1), str(i), "power"))
        return step

    def alert(i: int) -> None:
        ch = 1 + i % CAMERAS
        human = i % 10 == 0
        a = events_ingest.ParsedAlert(raw_type="VMD" if not human else "linedetection", state="active", channel=ch, dyn_channel=None,
                                      device_time=dt.datetime.now(dt.timezone(dt.timedelta(hours=3))).replace(microsecond=0).isoformat(),
                                      description="", target="human" if human else "", active_post_count=1)
        events_ingest.LISTENER._handle(a)

    def audit_step(i: int) -> None:
        with db.connection(mode="read") as conn:
            conn.execute("SELECT COUNT(*) FROM events").fetchone()
            audit_mod.audit(conn, actor=None, action="load.audit", decision="denied", reason="load", details={"i": i})

    def probe(i: int) -> None:
        with db.connection() as conn:
            set_setting(conn, "load.probe", str(i))

    clients: list[TestClient] = [boot]

    def http_client() -> TestClient:
        client = TestClient(app, raise_server_exceptions=False)
        clients.append(client)
        return client

    def http_read(k: int) -> Callable[[int], None]:
        c = http_client()
        paths = ["/api/v1/cameras", "/api/v1/events?limit=50", "/api/v1/settings", "/api/v1/me"]

        def step(i: int) -> None:
            r = c.get(paths[(i + k) % len(paths)])
            if r.status_code >= 500:
                raise RuntimeError(f"http {r.status_code} {r.text[:60]}")
        return step

    wc = http_client()

    def http_write(i: int) -> None:
        r = wc.patch("/api/v1/settings", json={"history.ha_secondary": "true" if i % 2 else "false"})
        if r.status_code >= 500:
            raise RuntimeError(f"http {r.status_code} {r.text[:60]}")

    ec = http_client()

    def exporter(i: int) -> None:
        end = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
        start = end - dt.timedelta(hours=2)
        r = ec.post("/api/v1/exports", json={"camera_id": cams[i % CAMERAS]["id"], "from_at": start.strftime("%Y-%m-%dT%H:%M:%SZ"), "to_at": end.strftime("%Y-%m-%dT%H:%M:%SZ")})
        if r.status_code >= 500:
            raise RuntimeError(f"http {r.status_code} {r.text[:60]}")
        if r.status_code == 201:
            ec.delete(f"/api/v1/exports/{r.json()['id']}")

    def derive(i: int) -> None:
        recordings.invalidate()
        events_derive.run_once(db, s, TZ)

    rc = http_client()

    def recorder(i: int) -> None:
        cam = cams[i % CAMERAS]["id"]
        r = rc.post(f"/api/v1/cameras/{cam}/record/start", json={"minutes": 1})
        if r.status_code >= 500:
            raise RuntimeError(f"http {r.status_code} {r.text[:60]}")
        r = rc.post(f"/api/v1/cameras/{cam}/record/stop")
        if r.status_code >= 500:
            raise RuntimeError(f"http {r.status_code} {r.text[:60]}")

    threads = [
        actor("ha_state_a", 0.05, ha_state(0)), actor("ha_state_b", 0.05, ha_state(1)),
        actor("alertstream", 0.2, alert), actor("audit", 0.1, audit_step), actor("probe", 0.05, probe),
        actor("http_read_1", 0.05, http_read(0)), actor("http_read_2", 0.05, http_read(1)), actor("http_read_3", 0.05, http_read(2)),
        actor("http_write", 0.3, http_write), actor("exporter", 5.0, exporter), actor("derive", 15.0, derive), actor("recorder", 5.0, recorder),
    ]
    started = time.time()
    for t in threads:
        t.start()
    for t in threads:
        t.join(DURATION_S + 120)
    stop.set()
    elapsed = time.time() - started
    wal = db.path.with_name(db.path.name + "-wal")
    for client in clients:
        client.close()
    c2 = sqlite3.connect(db.path)
    try:
        audit_rows = c2.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'load.audit'").fetchone()[0]
    finally:
        c2.close()  # Windows: an open handle keeps the temporary directory from being removed
    rows = [st.summary() for st in stats.values()]
    report = {"duration_s": round(elapsed, 1), "slow_devices": SLOW, "device_latency_s": {"nvr_search_page": SEARCH_PAGE_S, "nvr_put": NVR_PUT_S, "ha_notify": HA_NOTIFY_S},
              "total_ops": sum(r["ops"] for r in rows), "total_locked": sum(r["locked"] for r in rows), "total_other_errors": sum(r["other_errors"] for r in rows),
              "probe_max_wait_s": stats["probe"].summary()["max_s"], "ha_notifications": len(notified), "audit_rows_written": audit_rows, "audit_ok_ops": stats["audit"].ops - stats["audit"].locked - stats["audit"].other,
              "wal_bytes_at_end": wal.stat().st_size if wal.exists() else 0, "actors": rows}
    try:
        from smplwise import db as db_mod

        if hasattr(db_mod, "LOCK_STATS"):
            report["lock_stats"] = db_mod.lock_stats()
    except Exception:  # noqa: BLE001 - optional instrumentation
        pass
    print("\n" + json.dumps(report, ensure_ascii=False, indent=1))
    out = os.environ.get("SW_DB_LOAD_OUT")
    if out:
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(report, fh, ensure_ascii=False, indent=1)
    assert report["total_locked"] == 0, f"{report['total_locked']} 'database is locked' errors"
    assert report["total_other_errors"] == 0, [r["other_kinds"] for r in rows if r["other_errors"]]
    assert report["audit_rows_written"] == report["audit_ok_ops"], "every audit call that returned wrote its row"
    assert report["probe_max_wait_s"] < 5.0, "an innocent writer waited too long for the write lock"
