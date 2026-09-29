"""The events-window cache (T068): hit / miss, invalidation by every kind of write (trigger counters, migration 0031),
scope isolation between principals, memory bounds, TTL, and the counters in /health."""
from __future__ import annotations

import datetime as dt
import time

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient
from test_events import alert

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.services import events_cache, events_ingest
from smplwise.services.events_cache import WindowCache
from smplwise.services.timeutil import UTC


# ---------------------------------------------------------------- the cache object itself

def test_hit_miss_stale_and_ttl():
    c = WindowCache(max_entries=4, max_rows=100, ttl_s=0.2)
    assert c.get("k", (1,)) is None
    c.put("k", (1,), {"v": 1}, 1)
    assert c.get("k", (1,)) == {"v": 1}
    assert c.get("k", (2,)) is None, "a newer version never gets the old value"
    assert c.get("k", (1,)) is None, "the stale entry was dropped"
    c.put("k", (2,), {"v": 2}, 1)
    time.sleep(0.25)
    assert c.get("k", (2,)) is None, "TTL is a safety net"
    st = c.stats()
    assert st["hits"] == 1 and st["stale"] == 1 and st["expired"] == 1 and st["misses"] == 4 and st["size"] == 0 and st["rows"] == 0


def test_bounded_by_entries_and_rows_lru():
    c = WindowCache(max_entries=3, max_rows=10, ttl_s=60)
    for k in "abc":
        c.put(k, (0,), k, 1)
    assert c.get("a", (0,)) == "a"  # a is now the most recently used
    c.put("d", (0,), "d", 1)  # 4 entries > 3: b (least recently used) goes
    assert c.get("b", (0,)) is None and c.get("a", (0,)) == "a"
    c.put("big", (0,), "big", 8)  # rows 3 + 8 > 10: the oldest go until it fits
    st = c.stats()
    assert st["rows"] <= 10 and st["size"] <= 3 and st["evictions"] >= 2
    c.put("huge", (0,), "huge", 11)  # larger than the whole budget: never cached
    assert c.get("huge", (0,)) is None and c.stats()["oversize"] == 1


def test_disabled_cache_always_computes(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    monkeypatch.setattr(events_cache.CACHE, "enabled", False)
    events_cache.CACHE.reset_stats()
    for _ in range(3):
        assert c.get("/api/v1/events").status_code == 200
    assert events_cache.CACHE.stats()["hits"] == 0 and events_cache.CACHE.stats()["misses"] == 0


# ---------------------------------------------------------------- through the API

def _store(db: Database, ch: int, when: dt.datetime, et: str = "VMD", st: str = "active") -> dict:
    ts = when.astimezone(dt.timezone(dt.timedelta(hours=3))).strftime("%Y-%m-%dT%H:%M:%S+03:00")
    with db.connection() as conn:
        lookup = lambda c: conn.execute("SELECT * FROM cameras WHERE channel = ?", (c,)).fetchone()  # noqa: E731
        return events_ingest.store_alert(conn, events_ingest.parse_alert(alert(ch=ch, ts=ts, et=et, st=st)), "Asia/Jerusalem", lookup, when)


def test_list_is_cached_and_invalidated_by_every_write(settings):
    app = create_app(settings)
    c = TestClient(app)
    db: Database = app.state.db
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "Entrance"}).json()
    now = dt.datetime.now(UTC)
    e1 = _store(db, 1, now - dt.timedelta(minutes=10))
    events_cache.CACHE.reset_stats()
    a = c.get("/api/v1/events").json()
    b = c.get("/api/v1/events").json()
    st = events_cache.CACHE.stats()
    assert st["misses"] == 1 and st["hits"] == 1
    assert [e["id"] for e in a["events"]] == [e["id"] for e in b["events"]] == [e1["id"]]
    assert "thumbnail" in b["events"][0] and "ingest" in b, "per-request fields are added to a hit too"
    # a new event (insert) → the next read recomputes and shows it
    e2 = _store(db, 1, now - dt.timedelta(minutes=2), et="linedetection")
    assert [e["id"] for e in c.get("/api/v1/events").json()["events"]] == [e2["id"], e1["id"]]
    # a repeat (UPDATE count) is visible at once
    _store(db, 1, now - dt.timedelta(minutes=1, seconds=50), et="linedetection")
    assert c.get("/api/v1/events").json()["events"][0]["count"] == 2
    # an ack through the API
    assert c.post(f"/api/v1/events/{e1['id']}/ack").status_code == 200
    assert [e["id"] for e in c.get("/api/v1/events?unacked=true").json()["events"]] == [e2["id"]]
    assert next(e for e in c.get("/api/v1/events").json()["events"] if e["id"] == e1["id"])["acked_at"]
    # a camera rename (structure) reaches the cached names
    assert c.patch(f"/api/v1/cameras/{cam['id']}", json={"alias": "Gate"}).status_code == 200
    assert {e["camera_name"] for e in c.get("/api/v1/events").json()["events"]} == {"Gate"}
    # a delete (retention prune)
    with db.connection() as conn:
        conn.execute("DELETE FROM events WHERE id = ?", (e2["id"],))
    assert [e["id"] for e in c.get("/api/v1/events").json()["events"]] == [e1["id"]]
    st = events_cache.CACHE.stats()
    assert st["stale"] >= 5, st


def test_time_zone_change_invalidates_day_windows(settings):
    app = create_app(settings)
    c = TestClient(app)
    c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"})
    day = dt.datetime.now(UTC).date().isoformat()
    r1 = c.get(f"/api/v1/events?date={day}").json()
    assert c.patch("/api/v1/settings", json={"time.zone": "America/New_York"}).status_code == 200
    r2 = c.get(f"/api/v1/events?date={day}").json()
    assert r1["timezone"] == "Asia/Jerusalem" and r2["timezone"] == "America/New_York" and r1["from"] != r2["from"]


def test_scope_isolation_between_principals(settings):
    """A floor operator and the administrator ask the very same window: each gets its own entry, the operator never
    sees the other camera's event, whichever of them filled the cache first."""
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    c.post("/api/v1/cameras", json={"channel": 2, "alias": "b"})
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.5, "y": 0.5})
    bind(c, settings, "ron", "operator", "floor", ids["floor2"])
    db: Database = app.state.db
    now = dt.datetime.now(UTC)
    e_cam = _store(db, 1, now - dt.timedelta(minutes=5))
    e_other = _store(db, 2, now - dt.timedelta(minutes=4), et="linedetection")
    events_cache.CACHE.reset_stats()
    admin = c.get("/api/v1/events").json()["events"]  # the administrator fills the cache first
    mine = c.get("/api/v1/events", headers=as_user("ron")).json()["events"]
    assert {e["id"] for e in admin} == {e_cam["id"], e_other["id"]}
    assert [e["id"] for e in mine] == [e_cam["id"]]
    assert events_cache.CACHE.stats()["hits"] == 0, "different scopes never share an entry"
    mine2 = c.get("/api/v1/events", headers=as_user("ron")).json()["events"]
    assert [e["id"] for e in mine2] == [e_cam["id"]] and events_cache.CACHE.stats()["hits"] == 1
    # facets: the operator's counts cover only the operator's camera
    fa = c.get("/api/v1/events/facets").json()
    fr = c.get("/api/v1/events/facets", headers=as_user("ron")).json()
    assert sum(t["count"] for t in fa["types"]) == 2 and sum(t["count"] for t in fr["types"]) == 1
    # a permission change takes effect on the next request (the scope is part of the key, computed every time)
    bind(c, settings, "ron", "operator", "installation", "*")
    assert {e["id"] for e in c.get("/api/v1/events", headers=as_user("ron")).json()["events"]} == {e_cam["id"], e_other["id"]}
    # a user without events.read is still refused, cache or not
    bind(c, settings, "vi", "viewer", "floor", ids["floor3"])
    assert c.get("/api/v1/events", headers=as_user("vi")).status_code == 403


def test_facets_survive_repeats_but_not_new_rows(settings):
    app = create_app(settings)
    c = TestClient(app)
    c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"})
    db: Database = app.state.db
    now = dt.datetime.now(UTC)
    _store(db, 1, now - dt.timedelta(minutes=5))
    events_cache.CACHE.reset_stats()
    f1 = c.get("/api/v1/events/facets").json()
    _store(db, 1, now - dt.timedelta(minutes=4, seconds=50))  # a repeat of the same burst: count + 1 only
    f2 = c.get("/api/v1/events/facets").json()
    assert events_cache.CACHE.stats()["hits"] == 1 and f1["types"] == f2["types"]
    _store(db, 1, now - dt.timedelta(minutes=1), et="linedetection")  # a new row
    f3 = c.get("/api/v1/events/facets").json()
    assert {t["type"] for t in f3["types"]} == {"motion", "line"}


def test_timeline_is_cached_and_invalidated(settings):
    app = create_app(settings)
    c = TestClient(app)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    db: Database = app.state.db
    now = dt.datetime.now(UTC)
    local_day = now.astimezone(dt.timezone(dt.timedelta(hours=3))).date().isoformat()
    _store(db, 1, now - dt.timedelta(minutes=5))
    events_cache.CACHE.reset_stats()
    m1 = c.get(f"/api/v1/cameras/{cam['id']}/events?date={local_day}").json()
    m2 = c.get(f"/api/v1/cameras/{cam['id']}/events?date={local_day}").json()
    assert events_cache.CACHE.stats()["hits"] == 1 and m1 == m2
    _store(db, 1, now - dt.timedelta(minutes=1), et="linedetection")
    assert len(c.get(f"/api/v1/cameras/{cam['id']}/events?date={local_day}").json()["events"]) == len(m1["events"]) + 1


def test_windows_and_health_report_the_cache(settings):
    app = create_app(settings)
    c = TestClient(app)
    c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"})
    _store(app.state.db, 1, dt.datetime.now(UTC) - dt.timedelta(minutes=5))
    events_cache.CACHE.reset_stats()
    w1 = c.get("/api/v1/events/windows").json()
    w2 = c.get("/api/v1/events/windows").json()
    assert w1["windows"] == w2["windows"] and events_cache.CACHE.stats()["hits"] == 1
    h = c.get("/api/v1/health").json()["events"]["cache"]
    assert {"hits", "misses", "size", "rows", "max_entries", "max_rows", "ttl_s"} <= set(h) and h["ttl_s"] <= 5 and h["size"] >= 1


def test_event_centre_reads_never_wait_for_the_write_lock(settings):
    """The windows view (a 1000-row build), the timeline and the day summary are reads: with another writer holding
    SQLite's write lock they answer at once (the soak caught /events/windows holding the lock for its whole build)."""
    import sqlite3

    app = create_app(settings)
    c = TestClient(app)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    _store(app.state.db, 1, dt.datetime.now(UTC) - dt.timedelta(minutes=5))
    day = dt.datetime.now(UTC).date().isoformat()
    paths = ["/api/v1/events/windows", f"/api/v1/cameras/{cam['id']}/events?date={day}", "/api/v1/events/summary", "/api/v1/events", "/api/v1/events/facets"]
    for p in paths:
        assert c.get(p).status_code == 200  # warm: the throttled user touch is behind us
    blocker = sqlite3.connect(str(app.state.db.path), timeout=1, isolation_level=None)
    blocker.execute("BEGIN IMMEDIATE")
    try:
        for p in paths:
            t0 = time.perf_counter()
            r = c.get(p)
            assert r.status_code == 200 and time.perf_counter() - t0 < 5, (p, r.status_code)
    finally:
        blocker.execute("ROLLBACK")
        blocker.close()


def test_thumbnail_folder_index(settings, monkeypatch):
    """The list reads thumbnail state from one folder listing: what the worker writes shows at once, a file added behind
    its back within INDEX_TTL_S, a prune drops the index."""
    from smplwise.services import thumbnails

    d = thumbnails.thumb_dir(settings)
    d.mkdir(parents=True, exist_ok=True)
    (d / "aaa.jpg").write_bytes(b"x")
    (d / "bbb.unavailable").write_text("no")
    (d / "ccc.tmp.jpg").write_bytes(b"x")
    thumbnails.INDEX.invalidate()
    st = thumbnails.statuses_for(settings, ["aaa", "bbb", "ccc", "ddd"])
    assert st == {"aaa": "ready", "bbb": "unavailable", "ccc": "none", "ddd": "none"}
    rebuilds = thumbnails.INDEX.rebuilds
    thumbnails.INDEX.note(d, "ddd", True)  # the worker grabbed a frame
    assert thumbnails.statuses_for(settings, ["ddd"]) == {"ddd": "ready"} and thumbnails.INDEX.rebuilds == rebuilds
    (d / "eee.jpg").write_bytes(b"x")  # behind the index's back: seen after the TTL
    assert thumbnails.statuses_for(settings, ["eee"]) == {"eee": "none"}
    monkeypatch.setattr(thumbnails._DirIndex, "INDEX_TTL_S", 0.0)
    assert thumbnails.statuses_for(settings, ["eee"]) == {"eee": "ready"}
    assert thumbnails.status_for(settings, "aaa") == "ready", "the single-event path still asks the file system"
